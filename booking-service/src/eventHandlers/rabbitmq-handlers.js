const logger = require("../utils/logger");
const pool = require("../config/pool");

const handlePaymentDone = async (event) => {
  const connection = await pool.getConnection();

  try {
    console.log("handle payment done in booking");

    const { orderId, userId } = event;

    //  Start transaction
    await connection.beginTransaction();

    // Step 1: confirm the order by updating its status
    await connection.query(
      `UPDATE orders
       SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [orderId],
    );

    // Step 2: insert into user_orders to link the user with the order
    await connection.query(
      `INSERT INTO user_orders (user_id, order_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), order_id = VALUES(order_id)`,
      [userId, orderId],
    );

    //  Commit transaction if both succeed
    await connection.commit();



    console.log(`Order ${orderId} confirmed and linked to user ${userId}`);
  } catch (e) { 
    //  Rollback if anything fails
    await connection.rollback();
    logger.error(e, "Error occurred in handlePaymentDone (booking-service)");
    throw e;
  } finally {
    // Always release connection back to pool
    connection.release();
  }
};
const handlePaymentFail = async (event) => {
  try {
    console.log("handle payment fail in seat");

    const { orderId, userId } = event;

    // Step 1: mark the order fail
    await pool.query(
      `UPDATE orders
       SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [orderId],
    );

    console.log(`Order ${orderId} is marked fail`);
  } catch (e) {
    logger.error(e, "Error occurred in handlePaymentFail (booking-service)");
    throw e; // rethrow if you want upstream to handle it
  }
};
const handlePaymentTimeout = async (event) => {
  try {
    console.log("handle payment timeout in seat");

    const { orderId, userId } = event;

    // Step 1: mark the order cancelled
    await pool.query(
      `UPDATE orders
       SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [orderId],
    );

    console.log(`Order ${orderId} is marked fail`);
  } catch (e) {
    logger.error(e, "Error occurred in handlePaymentFail (booking-service)");
    throw e; // rethrow if you want upstream to handle it
  }
};
module.exports = { handlePaymentDone, handlePaymentFail, handlePaymentTimeout };
