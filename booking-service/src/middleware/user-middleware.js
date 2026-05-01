const isUser = (req, res, next) => {
  // console.log('is user');
  // console.log(req.userInfo);
  
  
  if (req.userInfo.role === "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied! User rights required.",
    });
  }
  // console.log("is User ok");

  next();
}; 

module.exports = isUser;
