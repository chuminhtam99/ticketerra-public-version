const logger = require("../utils/logger");
const pool = require("../config/pool");
const { publishEvent } = require("../utils/rabbitmq");

const handleZeroOrderDone = async (event) => {
  const { order } = event;

  await publishEvent("seat.payment.done", {
    lockId: order.lock_id,
    orderId: order.order_id,
    userId: order.user_id,
  });
  await publishEvent("booking.payment.done", {
    lockId: order.lock_id,
    orderId: order.order_id,
    userId: order.user_id,
  });
};
 
module.exports = { handleZeroOrderDone };
