const amqp = require("amqplib");
const logger = require("./logger");

let connection = null;
let channel = null;

const EXCHANGE_NAME = "app_exchange_direct";

async function connectToRabbitMQ() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Declare exchange
    await channel.assertExchange(EXCHANGE_NAME, "direct", { durable: true });

    logger.info("✅ Connected to RabbitMQ, exchange and queues declared");
    return channel;
  } catch (e) {
    logger.error("❌ Error connecting to RabbitMQ", e);
  }
}

async function publishEvent(routingKey, message) {
  if (!channel) {
    await connectToRabbitMQ();
  }

  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(message)),
    // { persistent: true },
  );
  logger.info(`Event published: ${routingKey}`);
}

async function consumeEvent(routingKey, callback) {
  if (!channel) {
    await connectToRabbitMQ();
  }

  // Derive queue names from routingKey
  const MAIN_QUEUE = `${routingKey}.main`;
  const RETRY_QUEUE = `${routingKey}.retry`;
  const DLQ_QUEUE = `${routingKey}.dlq`;

  // Declare queues
  await channel.assertQueue(MAIN_QUEUE, { durable: true });

  await channel.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: {
      "x-message-ttl": 60000, // 60s delay
      "x-dead-letter-exchange": EXCHANGE_NAME,
      "x-dead-letter-routing-key": routingKey, // back to main
    },
  });

  await channel.assertQueue(DLQ_QUEUE, { durable: true });

  // Bind queues
  await channel.bindQueue(MAIN_QUEUE, EXCHANGE_NAME, routingKey);
  await channel.bindQueue(RETRY_QUEUE, EXCHANGE_NAME, `${routingKey}.retry`);
  await channel.bindQueue(DLQ_QUEUE, EXCHANGE_NAME, `${routingKey}.dlq`);
  // Consumer logic
  channel.consume(
    MAIN_QUEUE,
    async (msg) => {
      if (msg !== null) {
        const content = JSON.parse(msg.content.toString());
        try {
          await callback(content); // handler logic
          channel.ack(msg); // success
        } catch (err) {
          const retries = content.retries || 0;

          if (retries < 3) {
            // publish to retry queue with incremented counter
            publishEvent(RETRY_QUEUE, { ...content, retries: retries + 1 });
            channel.ack(msg); // remove from main queue
            logger.warn(`Retrying message, attempt ${retries + 1}`);
          } else {
            // send to DLQ
            publishEvent(`${routingKey}.dlq`, content);
            channel.ack(msg); // remove from main queue
            logger.error(
              `Message failed after ${retries} retries, sent to DLQ`,
            );
          }
        }
      }
    },
    { noAck: false },
  );

  logger.info(`Subscribed to queue: ${MAIN_QUEUE}, routingKey: ${routingKey}`);
}

module.exports = {
  connectToRabbitMQ,
  publishEvent,
  consumeEvent,
};
