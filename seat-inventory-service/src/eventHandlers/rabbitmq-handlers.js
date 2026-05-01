const logger = require("../utils/logger");
const pool = require("../config/pool");
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL);

const handleEventCreated = async (event) => {
  try {
    console.log("handleEventCreated voi event la: ");
    console.log(event);
    const { ticketId, numberOfTicketLeft } = event;
    console.log("ticketId la:", ticketId);

    await pool.query(
      `INSERT IGNORE INTO ticket_inventory 
   (ticket_id, total_quantity, available, locked, booked) 
   VALUES (?, ?, ?, 0, 0)`,
      [ticketId, numberOfTicketLeft, numberOfTicketLeft],
    );

    logger.info("done handling event");
  } catch (e) {
    logger.error(e, "Error occured handleEventCreated in user-service");
  }
};
const handlePaymentDone = async (event) => {
  // console.log("handle payment done in seat");

  const { lockId } = event;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Step 1: find all tickets and quantities in lock_items for this lockId
    const [lockItems] = await connection.query(
      "SELECT ticket_id, session_id, event_id, quantity FROM lock_items WHERE lock_id = ? ORDER BY ticket_id",
      [lockId],
    );

    // Step 2: update ticket_inventory (locked → booked)
    for (const item of lockItems) {
      await connection.query(
        `UPDATE ticket_inventory
         SET locked = locked - ?, booked = booked + ?
         WHERE ticket_id = ?`,
        [item.quantity, item.quantity, item.ticket_id],
      );
    }

    // Step 3: delete the lock (cascade deletes lock_items too)
    await connection.query("DELETE FROM ticket_locks WHERE lock_id = ?", [
      lockId,
    ]);

    await connection.commit();

    // Step 4: collect data for payload and publish to Redis
    const items = [];
    for (const item of lockItems) {
      // fetch current available count from ticket_inventory
      const [rows] = await connection.query(
        "SELECT available FROM ticket_inventory WHERE ticket_id = ?",
        [item.ticket_id],
      );

      const available = rows.length > 0 ? rows[0].available : 0;

      items.push({
        sessionId: item.session_id,
        ticketId: item.ticket_id,
        numberOfTicketLeft: available,
      });
    }

    // eventId is the same for all lockItems
    const eventId = lockItems.length > 0 ? lockItems[0].event_id : null;

    const payload = {
      type: "event_stock_update",
      eventId,
      items,
    };

    redis.publish("socket_events", JSON.stringify(payload));

    console.log(`Payment done: lock ${lockId} released and tickets booked`);
  } catch (err) {
    await connection.rollback();
    console.error("handlePaymentDone failed:", err);
    throw err;
  } finally {
    connection.release();
  }
};

const handlePaymentFail = async (event) => {
  console.log("handle payment fail in seat");

  const { lockId } = event;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Step 1: find all tickets and quantities in lock_items for this lockId
    const [lockItems] = await connection.query(
      "SELECT ticket_id, quantity FROM lock_items WHERE lock_id = ? ORDER BY ticket_id",
      [lockId],
    );

    // Step 2: lock and update ticket_inventory rows
    for (const item of lockItems) {
      await connection.query(
        `UPDATE ticket_inventory
         SET locked = locked - ?, available = available + ?
         WHERE ticket_id = ?`,
        [item.quantity, item.quantity, item.ticket_id],
      );
    }

    // Step 3: delete the lock (cascade will delete lock_items too)
    await connection.query("DELETE FROM ticket_locks WHERE lock_id = ?", [
      lockId,
    ]);

    await connection.commit();
    console.log(`Payment done: lock ${lockId} released and tickets booked`);
  } catch (err) {
    await connection.rollback();
    console.error("handlePaymentDone failed:", err);
    throw err;
  } finally {
    connection.release();
  }
};
const handlePaymentTimeout = async (event) => {
  console.log("handle payment timeout in seat");

  const { lockId } = event;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Step 1: find all tickets and quantities in lock_items for this lockId
    const [lockItems] = await connection.query(
      "SELECT ticket_id, quantity FROM lock_items WHERE lock_id = ? ORDER BY ticket_id",
      [lockId],
    );

    // Step 2: lock and update ticket_inventory rows
    for (const item of lockItems) {
      await connection.query(
        `UPDATE ticket_inventory
         SET locked = locked - ?, available = available + ?
         WHERE ticket_id = ?`,
        [item.quantity, item.quantity, item.ticket_id],
      );
    }

    // Step 3: check expires_at before deleting the lock
    const [rows] = await connection.query(
      "SELECT expires_at FROM ticket_locks WHERE lock_id = ?",
      [lockId],
    );

    if (rows.length === 0) {
      throw new Error(`Lock ${lockId} not found`);
    }

    const expiresAt = rows[0].expires_at;
    const now = new Date();

    if (now > expiresAt) {
      // expired → safe to delete
      await connection.query("DELETE FROM ticket_locks WHERE lock_id = ?", [
        lockId,
      ]);
    } else {
      // not expired → rollback
      throw new Error(`Lock ${lockId} has not expired yet`);
    }

    await connection.commit();
    console.log(`Payment timeout: lock ${lockId} released`);
  } catch (err) {
    await connection.rollback();
    console.error("handlePaymentTimeout failed:", err);
    // IMPORTANT: rethrow so RabbitMQ consumer sees the error
    throw err;
  } finally {
    connection.release();
  }
};
module.exports = {
  handleEventCreated,
  handlePaymentDone,
  handlePaymentFail,
  handlePaymentTimeout,
};
