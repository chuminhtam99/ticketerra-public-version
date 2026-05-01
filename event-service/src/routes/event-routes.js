const express = require("express");
const router = express.Router();
const eventController = require("../controllers/event-controller");
const authMiddleware = require("../middleware/auth-middleware");
const adminMiddleware = require("../middleware/admin-middleware");
// const userMiddleware = require("../middleware/user-middleware");
const uploadMiddleware = require("../middleware/upload-middleware");

router.get("/auth", authMiddleware, adminMiddleware, eventController.checkAuth);
router.get("/search", eventController.searchEvents);
router.get(
  "/my-event",
  authMiddleware,
  adminMiddleware,
  eventController.getMyEvent,
);
router.get("/in-banner", eventController.getEventInBanner);
router.get("/recommend", eventController.recommendEvents);
router.get("/in-special", eventController.getSpecialEvent);
router.get("/trending", eventController.getTrendingEvent);
router.get("/:eventId", eventController.getEvent);
router.get("/latest/month", eventController.getEventInMonth);
router.get("/latest/week", eventController.getEventInWeek);
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  uploadMiddleware.any(),
  eventController.createEvent,
);
router.post(
  "/cart-item/total-price",

  eventController.getItemsDetails, // cross service call
);

module.exports = router;
