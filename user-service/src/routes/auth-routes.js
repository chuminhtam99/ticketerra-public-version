
const express = require("express");
const router = express.Router();
const userController = require("../controllers/auth-controller");
const authMiddleware = require("../middleware/auth-middleware");
const userMiddleware = require("../middleware/user-middleware");


router.post("/register", userController.registerUser); 
router.post("/login", userController.loginUser); 
router.get("/logout", userController.logoutUser); 

router.get("/user/:id", userController.findUserById);// for cross-service calling
router.get("/user", authMiddleware, userMiddleware, userController.getUser);
router.post("/user/my-account", authMiddleware, userMiddleware, userController.updateUserDetails);
router.get("/event/:id",authMiddleware, userMiddleware, userController.findEventsByUser);

router.get("/", authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.userInfo,
  });
});

module.exports = router;