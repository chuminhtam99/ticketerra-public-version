const logger = require("../utils/logger");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // use your secret key
const { publishEvent } = require("../utils/rabbitmq");
const axios = require("axios");

///connect-stripe
exports.connectStripe = async (req, res) => {
  try {
    const { amount, metadata } = req.body;

    // Stripe expects integer amounts in the smallest currency unit
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: "vnd",
      automatic_payment_methods: { enabled: true },
      metadata, // contains orderId , lockId, userId
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({ success: false, error: "Stripe error" });
  }
};

//get(  "/success/:orderId"
exports.handlePaymentSuccess = async (order) => {
  await publishEvent("seat.payment.done", {
    lockId,
    orderId,
    userId,
  });
  await publishEvent("booking.payment.done", {
    lockId,
    orderId,
    userId,
  });

  try {
    const [userResponse, bookingResponse, eventResponse] = await Promise.all([
      axios.get(`http://localhost:3001/api/auth/user/${order.user_id}`),
      axios.get(`http://localhost:3004/api/booking/items/${order.order_id}`),
      axios.get(`http://localhost:3002/api/events/${order.event_id}`),
    ]);

    await publishEvent("email.sent", {
      user: userResponse.data.user,
      order,
      eventInDB: eventResponse.data.event,
      items: bookingResponse.data.items,
    });
  } catch (err) {
    logger.error("sending notification error:", err.message);
    throw err; // don't use res here
  }
};
exports.handlePaymentFailure = async (order) => {
  // Step 1 : call Seat Inventory Service to release lock, change those in locked -> available
  // Step 2 : call Booking Service to mark order FAILED
  // sample code

};
exports.handlePaymentTimeOut = async (order) => {
  // Step 1 : call Seat Inventory Service to release lock, then moves the quantity slot from locked -> available
  // Step 2 : call Booking Service to mark order CANCELLED

};

exports.webhookHandle = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Step 1: check the idempotent process by go to booking service and find matching order
  let order;
  try {
    const orderResponse = await axios.get(
      `http://localhost:3004/api/booking/orders/${event.data.object.metadata.orderId}`,
    );
    order = orderResponse.data.order; // matches your getOrder controller response
  } catch (err) {
    console.error("Failed to fetch order:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not retrieve order" });
  }

  // Idempotency check: if order != pending, stop here
  if (order.status !== "PENDING") {
    return res.status(409).json({
      success: false,
      message: "duplicate webhook sign",
    });
  }

  // Step 2 : handle the sign from Stripe
  try {
    if (event.type === "payment_intent.succeeded") {
      await handlePaymentSuccess(order);
      // note : notification user can get like this:
      // event.data.object.metadata.userId
    }

    if (event.type === "payment_intent.payment_failed") {
      await handlePaymentFailure(order);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    res.status(500).send("Webhook handler failed");
  }
};
