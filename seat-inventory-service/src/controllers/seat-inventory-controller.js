const { publishEvent } = require("../utils/rabbitmq");
const { redisClient } = require("../database/redis");
const pool = require("../config/pool");
const axios = require("axios");
const logger = require("../utils/logger");

// get("/:eventId",
exports.findRealTimeEvent = async (req, res) => {
  console.log('get("/:eventId")');

  const eventId = req.params.eventId;

  try {
    // Step 1: Call event-service API
    const eventPromise = axios.get(
      `http://localhost:3002/api/events/${eventId}`,
    );

    // Step 2: Run event-service call first (we need ticket IDs)
    const eventResponse = await eventPromise;
    const event = eventResponse.data.event;
    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found." });
    }

    // Step 3: Collect ticket IDs from the event
    const ticketIds = [];
    event.sessions.forEach((session) => {
      session.tickets.forEach((ticket) => {
        ticketIds.push(ticket._id.toString());
      });
    });

    // Step 4: Query MySQL only for those ticket IDs
    let availabilityRows = [];
    if (ticketIds.length > 0) {
      const [rows] = await pool.query(
        "SELECT ticket_id, available FROM ticket_inventory WHERE ticket_id IN (?)",
        [ticketIds],
      );
      availabilityRows = rows;
    }

    // Step 5: Build lookup map
    const availabilityMap = {};
    availabilityRows.forEach((row) => {
      availabilityMap[row.ticket_id] = row.available;
    });

    // Step 6: Merge availability into tickets
    event.sessions.forEach((session) => {
      session.tickets.forEach((ticket) => {
        const availableCount = availabilityMap[ticket._id.toString()] ?? 0;
        ticket.numberOfTicketLeft = availableCount;

        // Check both conditions
        if (ticket.soldOut === "false" && availableCount === 0) {
          console.log("het hang");
          publishEvent("soldout.ticket", {
            eventId: eventId,
            ticketId: ticket._id.toString(), // use MongoDB ticket ID
          });
        }
      });
    });

    res.status(200).json({
      success: true,
      event,
    });
  } catch (err) {
    logger.error("Error in seat-inventory findRealTimeEvent:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
//post("/lock"
exports.lockSeats = async (req, res) => {
  console.log("post /lock");

  const connection = await pool.getConnection(); // get a dedicated connection
  try {
    await connection.beginTransaction();

    const { user_id, cartItems, eventId } = req.body;

    const sortedCartItems = [...cartItems].sort((a, b) =>
      a.ticketId.localeCompare(b.ticketId),
    );

    // Step 1: check and update inventory
    for (const item of sortedCartItems) {
      const [rows] = await connection.query(
        "SELECT total_quantity, available, booked FROM ticket_inventory WHERE ticket_id = ? FOR UPDATE",
        [item.ticketId],
      );

      if (rows.length === 0) {
        await connection.rollback();
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Ticket not found" });
      }

      const { total_quantity, available, booked } = rows[0];

      // Check if all tickets are already booked

      

      if (available - item.quantity < 0) {
        await connection.rollback();
        connection.release();
        return res.status(406).json({
          success: false,
          message: "Not enough tickets available",
        });
      }

      await connection.query(
        "UPDATE ticket_inventory SET available = available - ?, locked = locked + ? WHERE ticket_id = ? AND available > 0",
        [item.quantity, item.quantity, item.ticketId],
      );
    }

    // Step 2: insert lock row
    const [lockResult] = await connection.query(
      "INSERT INTO ticket_locks (user_id, expires_at) VALUES (?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
      [user_id],
    );

    const lockId = lockResult.insertId;

    // Step 3: with each ticketId and quantity in sortedCartItems , make a new row in  lock_items
    for (const item of sortedCartItems) {
      await connection.query(
        `INSERT INTO lock_items (lock_id, ticket_id, session_id, event_id, quantity)
   VALUES (?, ?, ?, ?, ?)`,
        [lockId, item.ticketId, item.sessionId, eventId, item.quantity],
      );
    }

    await connection.commit();
    connection.release();

    return res.status(200).json({ success: true,message: "Lock seats done" , lockId });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error("Lock seats failed:", err);
    return res
      .status(500)
      .json({ success: false, message: "Lock seats failed" });
  }
};
