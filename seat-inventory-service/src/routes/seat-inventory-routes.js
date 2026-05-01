const express = require("express");
const router = express.Router();
const SeatInventoryController = require("../controllers/seat-inventory-controller");
const authMiddleware = require("../middleware/auth-middleware");
const adminMiddleware = require("../middleware/admin-middleware");
const userMiddleware = require("../middleware/user-middleware");

router.get(
  "/:eventId",
  authMiddleware,
  userMiddleware,
  SeatInventoryController.findRealTimeEvent,
);
router.post("/lock", SeatInventoryController.lockSeats); // cross-service calling
module.exports = router;
