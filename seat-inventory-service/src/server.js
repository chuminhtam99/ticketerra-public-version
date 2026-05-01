require("dotenv").config();
const logger = require("./utils/logger");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config();
const { RateLimiterRedis } = require("rate-limiter-flexible");
const { redisClient, connectRedis } = require("./database/redis");
const { initDB } = require("./database/connect");
const seatInventoryRoute = require("./routes/seat-inventory-routes");
const {
  handleEventCreated,
  handlePaymentDone,
  handlePaymentFail,
  handlePaymentTimeout,
} = require("./eventHandlers/rabbitmq-handlers");
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");

const app = express();
const PORT = process.env.PORT || 3003;

connectRedis();
// middleware
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

//DDos protection and rate limiting : chỉ cho 10 req từ client được vào server
// const rateLimiter = new RateLimiterRedis({
//   storeClient: redisClient,
//   keyPrefix: "middleware",
//   points: 10,
//   duration: 1,
// });

// app.use((req, res, next) => {
//   rateLimiter
//     .consume(req.ip)
//     .then(() => next())
//     .catch(() => {
//       logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
//       res.status(429).json({ success: false, message: "Too many requests" });
//     });
// });

app.use(
  "/api/seats",

  seatInventoryRoute,
);

async function startServer() {
  try {
    await initDB();
    await connectToRabbitMQ();
    await consumeEvent("event.seat.created", handleEventCreated);
    await consumeEvent("seat.payment.done", handlePaymentDone);
    await consumeEvent("seat.payment.fail", handlePaymentFail);
    await consumeEvent("seat.payment.timeout", handlePaymentTimeout);

    app.listen(PORT, () => {
      logger.info(`Event service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
    process.exit(1);
  }
}

startServer();
