const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/booking-controller");
const authMiddleware = require("../middleware/auth-middleware");
const adminMiddleware = require("../middleware/admin-middleware");
const userMiddleware = require("../middleware/user-middleware");

router.post(
  "/create-payment-intent",
  authMiddleware,
  userMiddleware,
  bookingController.createPaymentIntent,
); // thuc ra la GET dung hon, nhung van o ben write side
router.post(
  "/carts/:eventId",
  authMiddleware,
  userMiddleware,
  bookingController.ticketCheckout,
); // ben write side @PostMapping("/checkout")

router.get("/items/:orderId", bookingController.getItemsInOrder); // provided order id, get all items in order, for cross service call
router.get("/events/:userId", bookingController.getEventsBooked); // READ SIDE, provided user id , find which event_id she/he booked , for cross service call

router.get(
  "/orders/auth/:orderId",
  authMiddleware,
  userMiddleware,
  bookingController.getOrder,
); // for payment result page

router.get("/user/tickets", authMiddleware, bookingController.getAllTickets); // từ vé của tôi => READ SIDE

module.exports = router;
