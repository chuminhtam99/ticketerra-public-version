const logger = require("../utils/logger");
const jwt = require("jsonwebtoken");

const validateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]; // lấy token từ header
  const token = authHeader && authHeader.split(" ")[1]; 

  if (!token) {
    logger.warn("Access attempt without valid token!");
    return res.status(401).json({
      message: "Authentication required",
      success: false,
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => { // check để lấy thông tin user từ token, save user vào req.user
    if (err) {
      logger.warn("Invalid token!");
      return res.status(429).json({
        message: "Invalid token!",
        success: false,
      });
    }

    req.user = user;
    next();
  });
};

module.exports = { validateToken };
