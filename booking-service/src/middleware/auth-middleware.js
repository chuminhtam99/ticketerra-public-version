const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.cookies?.accessToken;
  // console.log('auth');

  if (!token) {
    return res.status(400).json({
      success: true,
      user: null,
      message: "Guest access.",
    });
  }

  //decode this token
  try {
    const decodedTokenInfo = jwt.verify(token, process.env.JWT_SECRET_KEY);

    req.userInfo = decodedTokenInfo;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      user: null,
      message: "Access denied. Token provided error",
    });
  }
};

module.exports = authMiddleware;
