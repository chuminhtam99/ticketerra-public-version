const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment-controller");
const authMiddleware = require("../middleware/auth-middleware");
const userMiddleware = require("../middleware/user-middleware");
const axios = require("axios");

// router.get("/register", paymentController.registerUser);

router.post("/connect-stripe", paymentController.connectStripe);
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.webhookHandle,
);
// this rout is for testing, normally we dont call this, webhook call handlePaymentSuccess directly
router.get(
  "/success/:orderId",
  authMiddleware,
  userMiddleware,
  async (req, res, next) => {
    console.log("handlePaymentSuccess");

    // Step 0: check the idempotent process by go to booking service and find matching order
    let order;
    try {
      const orderResponse = await axios.get(
        `http://localhost:3004/api/booking/orders/${req.params.orderId}`,
      );
      order = orderResponse.data.order;
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
    try {
      await paymentController.handlePaymentSuccess(order);

      res.json({ success: true });
    } catch (err) {
      console.error("Webhook handling error:", err);
      res.status(500).send("Webhook handler failed");
    }
  },
);
// this rout is for testing, normally we dont call this, webhook call handlePaymentSuccess directly
router.get(
  "/failure/:orderId",
  authMiddleware,
  userMiddleware,
  async (req, res, next) => {
    console.log("handlePayment failure");

    // Step 0: check the idempotent process by go to booking service and find matching order
    let order;
    try {
      const orderResponse = await axios.get(
        `http://localhost:3004/api/booking/orders/${req.params.orderId}`,
      );
      order = orderResponse.data.order;
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
    try {
      await paymentController.handlePaymentFailure(order);

      res.json({ success: true });
    } catch (err) {
      console.error("Webhook handling error:", err);
      res.status(500).send("Webhook handler failed");
    }
  },
);

router.get(
  "/timeout/:orderId",
  authMiddleware,
  userMiddleware,
  async (req, res, next) => {
    console.log("handlePayment timeout");

    // Step 0: check the idempotent process by go to booking service and find matching order
    let order;
    try {
      const orderResponse = await axios.get(
        `http://localhost:3004/api/booking/orders/${req.params.orderId}`,
      );
      order = orderResponse.data.order;
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
        message: "duplicate sign",
      });
    }

    // because time-out can be accessed by network, check auth and ownership:
    
    try {
      await paymentController.handlePaymentTimeOut(order);

      res.json({ success: true });
    } catch (err) {
      console.error("Webhook handling error:", err);
      res.status(500).send("Webhook handler failed");
    }
  },
);
module.exports = router;
