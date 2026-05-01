const { publishEvent } = require("../utils/rabbitmq");
const { redisClient } = require("../database/redis");
const pool = require("../config/pool");
const axios = require("axios");
const logger = require("../utils/logger");

//post(  "/carts/:eventId"
exports.ticketCheckout = async (req, res) => {
  console.log('"/carts/:eventId",');

  const { cartItems, paymentMethod, orderKey } = req.body;
  const { eventId } = req.params;
  // console.log("===");

  // console.log(req.body);

  try {
    // Step 1: Idempotency check
    const [rows] = await pool.query(
      "SELECT order_id FROM orders WHERE user_id = ? AND order_key = ?",
      [req.userInfo.userId, orderKey],
    );

    if (rows.length > 0) {
      return res.json({ success: true, orderId: rows[0].order_id });
    }

    // Step 2: call seat service to lock the seat and make a new row in lock table

    let seatResponse;
    try {
      seatResponse = await axios.post(`http://localhost:3003/api/seats/lock`, {
        user_id: req.userInfo.userId,
        cartItems,
        eventId: eventId,
      });
    } catch (err) {
      console.error("Seat service error:", err.message);

      return res
        .status(err.response.status)
        .json({ success: false, message: "Seat service failed" });
    }

    const lockId = seatResponse.data.lockId;

    // Step 3: Create a new order in orders table
    const [result] = await pool.query(
      `INSERT INTO orders 
        (order_key, user_id, event_id, paymentMethod, totalPrice, status, lock_id) 
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        orderKey,
        req.userInfo.userId,
        eventId,
        paymentMethod,
        0, // placeholder totalPrice, update later
        lockId,
      ],
    );

    const orderId = result.insertId;

    // Step 4 : Call event service with each item in cart
    let eventResponse;

    try {
      eventResponse = await axios.post(
        `http://localhost:3002/api/events/cart-item/total-price`,
        {
          cartItems,
          eventId,
        },
      );
    } catch (err) {
      console.error("Event service error:", err.message);
      return res
        .status(502)
        .json({ success: false, message: "Event service calling fails" });
    }

    // Step 5: Insert order_items and update totalPrice
    try {
      const items = eventResponse.data.items;
      const totalPrice = eventResponse.data.totalPrice;

      for (const item of items) {
        await pool.query(
          `INSERT INTO order_items 
            (order_id, event_id, eventName, ticket_id, ticketName, ticketPrice, quantity) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.event_id,
            item.eventName,
            item.ticket_id,
            item.ticketName,
            item.ticketPrice,
            item.quantity,
          ],
        );
      }

      // Update totalPrice in orders
      await pool.query("UPDATE orders SET totalPrice = ? WHERE order_id = ?", [
        totalPrice,
        orderId,
      ]);

      return res.status(201).json({ success: true, orderId });
    } catch (err) {
      console.error("Error inserting order_items:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Failed in checkout" });
    }
  } catch (err) {
    console.error("Checkout failed:", err.message);
    return res.status(500).json({ success: false, message: "Checkout failed" });
  }
};
// get("/items/:orderId"
exports.getItemsInOrder = async (req, res) => {
  console.log("get(/items/:orderId");

  const { orderId } = req.params;

  try {
    // Query order_items by order_id
    const [rows] = await pool.query(
      `SELECT order_item_id, order_id, event_id, eventName, ticket_id, ticketName, ticketPrice, quantity
       FROM order_items
       WHERE order_id = ?`,
      [orderId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No items found for this order",
      });
    }

    console.log(rows);

    return res.status(200).json({
      success: true,
      items: rows,
    });
  } catch (err) {
    console.error("getItemsInOrder failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order items",
    });
  }
};
//post(  "/create-payment-intent"
exports.createPaymentIntent = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.userInfo.userId;
    //Step 1: check ownership and valid order
    // Lookup order in DB
    const [rows] = await pool.query("SELECT * FROM orders WHERE order_id = ?", [
      orderId,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const order = rows[0];

    // Check ownership
    if (String(order.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, error: "Not your order" });
    }

    // If already paid
    if (order.status === "CONFIRMED") {
      return res.json({
        success: false,
        error: "Order already paid",
        alreadyPaid: true,
      });
    }

    // If not reserved/pending
    if (order.status !== "PENDING") {
      return res.json({ success: false, error: "Order not reserved" });
    }

    // if totalPrice == 0 => go to payment service and get "/success/:orderId" , then return to browser
    if (order.totalPrice === 0) {
      await publishEvent("zero.order.done", {
        order: order,
      });
      return res.json({ success: true, zeroOrder: true });
    }

    // Step 2: Get each items to rendering UI
    // find the orderItems base on orderId:
    const [orderItems] = await pool.query(
      "SELECT ticket_id, ticketName, ticketPrice, quantity FROM order_items WHERE order_id = ?",
      [orderId],
    );

    // Step 3: Call payment service to create Stripe instance for this order
    let stripeResponse;
    try {
      stripeResponse = await axios.post(
        "http://localhost:3005/api/payment/connect-stripe",
        {
          amount: parseInt(order.totalPrice, 10), // ensure integer
          metadata: {
            orderId: String(order.order_id),
            userId: String(order.user_id),
            lockId: String(order.lock_id),
          },
        },
      );
    } catch (err) {
      logger.error("Stripe service error:", err.message);
      return res
        .status(502)
        .json({ success: false, error: "Payment service failed" });
    }

    if (stripeResponse.status === 200) {
      return res.status(200).json({
        success: true,
        clientSecret: stripeResponse.data.clientSecret,
        order,
        orderItems,
      });
    } else {
      return res
        .status(stripeResponse.status)
        .json({ success: false, error: "Stripe service error" });
    }
  } catch (err) {
    console.error("Stripe error:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to create payment intent" });
  }
};

// get("/user/tickets"
exports.getAllTickets = async (req, res) => {
  const userId = req.userInfo.userId;
  console.log('get("/user/tickets , userid", userId)');

  try {
    // Step 1: get all order_ids for this user

    // Step 2: get orders info

    // Step 3: get order_items info

    // Step 4: merge orders + order_items

    // console.log(tickets);

    return res.status(200).json({ success: true, tickets });
  } catch (err) {
    console.error("getAllTickets failed:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch tickets" });
  }
};
//get("/events/:userId"
exports.getEventsBooked = async (req, res) => {
  const { userId } = req.params;
  console.log("getEventsBooked");

  const [rows] = await pool.query(
    `
      SELECT o.event_id
      FROM orders o
      INNER JOIN user_orders uo ON o.order_id = uo.order_id
      WHERE uo.user_id = ?
      `,
    [userId],
  );

  // Step 3: Return results
  return res.json({
    success: true,
    events: rows.map((r) => r.event_id),
  });
};
