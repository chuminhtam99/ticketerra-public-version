const pool = require("../config/pool");
const bcrypt = require("bcryptjs");
const logger = require("../utils/logger");
const jwt = require("jsonwebtoken");
const { validateRegistration, validateLogin } = require("../utils/validation");

// post("/register"
exports.registerUser = async (req, res) => {
  logger.info("POST /register called");

  try {
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { username, email, password, role } = req.body;

    // 1. Check if user already exists
    const [existing] = await pool.query(
      "SELECT user_id FROM user WHERE username = ? OR email = ?",
      [username, email],
    );

    if (existing.length > 0) {
      return res.status(401).json({
        success: false,
        message: "User already exists",
      });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Insert new user
    const [result] = await pool.query(
      `INSERT INTO user (username, email, password, role) 
       VALUES (?, ?, ?, ?)`,
      [username, email, hashedPassword, role || "user"],
    );

    // 4. Respond
    if (result.insertId) {
      res.status(201).json({
        success: true,
        message: "User registered successfully!",
        userId: result.insertId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Unable to register user, please try again.",
      });
    }
  } catch (err) {
    logger.error("❌ Error registering user:", err); // ✅ use logger.error
    res.status(500).json({
      success: false,
      message: "Some error occurred! Please try again",
    });
  }
};

//post("/login"
exports.loginUser = async (req, res) => {
  logger.info("POST /login called");

  try {
    const { error } = validateLogin(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { username, password } = req.body;

    // 1. Find user by username OR email
    const [rows] = await pool.query(
      "SELECT * FROM user WHERE username = ? OR email = ? LIMIT 1",
      [username, username],
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User doesn't exist",
      });
    }

    const user = rows[0];

    // 2. Compare password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Password is wrong!",
      });
    }

    // 3. Create JWT
    const accessToken = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "180m" },
    );
    // console.log(accessToken);

    // 4. Set cookie
    res.cookie("accessToken", accessToken, {
      secure: process.env.NODE_ENV === "production",
      maxAge: 180 * 60 * 1000, // 180 minutes
    });

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      accessToken,
    });
  } catch (err) {
    logger.error("❌ Error logging in:", err);
    res.status(500).json({
      success: false,
      message: "Server error, please try again",
    });
  }
};

// get("/logout"
exports.logoutUser = async (req, res) => {
  logger.info("GET /logout called");

  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(200).json({
      success: true,
      user: null,
      message: "No login, weird",
    });
  }

  try {
    res.clearCookie("accessToken");
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    logger.error("❌ Error logging out:", err);
    res.status(500).json({
      success: false,
      message: "Server fails",
    });
  }
};

//router.get("/user"
exports.getUser = async (req, res) => {
  logger.info("GET /user called");

  try {
    const userId = req.userInfo.userId;

    // Query the Users table
    const [rows] = await pool.query(
      "SELECT user_id, username, email, role, name, phone, dob, gender, paymentMethod, createdAt, updatedAt FROM user WHERE user_id = ?",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = rows[0];

    res.status(200).json({
      success: true,
      message: "Access ok.",
      user,
    });
  } catch (err) {
    logger.error("❌ Error fetching user ", err);
    res.status(500).json({
      success: false,
      message: "Server error, please try again",
    });
  }
};

//get("/user/:id"
exports.findUserById = async (req, res) => {
  logger.info("get into /user/:id");
  try {
    const userId = req.params.id;

    // Query the Users table
    const [rows] = await pool.query(
      "SELECT user_id, username, email, role, name, phone, dob, gender, paymentMethod, createdAt, updatedAt FROM user WHERE user_id = ?",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = rows[0];

    res.status(200).json({
      success: true,
      message: "Access ok.",
      user,
    });
  } catch (err) {
    logger.error("❌ Error fetching user by ID:", err);
    res.status(500).json({
      success: false,
      message: "Server error, please try again",
    });
  }
};
//'post("/user/my-account
exports.updateUserDetails = async (req, res) => {
  logger.info("POST /user/my-account called");

  try {
    const { name, phone, dob, gender } = req.body;
    const userId = req.userInfo.userId;
    console.log(dob);

    // 1. Check if user exists
    const [rows] = await pool.query("SELECT * FROM user WHERE user_id = ?", [
      userId,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 2. Update user fields
    await pool.query(
      `UPDATE user 
       SET name = ?, phone = ?, dob = ?, gender = ?, updatedAt = CURRENT_TIMESTAMP 
       WHERE user_id = ?`,
      [name || null, phone || null, dob || null, gender || null, userId],
    );

    // 3. Fetch updated user
    const [updatedRows] = await pool.query(
      "SELECT user_id, username, email, role, name, phone, dob, gender, paymentMethod, createdAt, updatedAt FROM user WHERE user_id = ?",
      [userId],
    );

    const updatedUser = updatedRows[0];
    console.log(updatedUser);

    res.json({
      success: true,
      message: "Account updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    logger.error("❌ Failed to update account:", err);
    res.status(400).json({
      success: false,
      message: "Failed to update account",
      error: err.message,
    });
  }
};

// get ("/event/:id")
exports.findEventsByUser = async (req, res) => {
  console.log("findEventsByUser");

  const userId = req.params.id;

  try {
    // Get all event_ids for this user
    const [rows] = await pool.query(
      "SELECT event_id FROM user_events WHERE user_id = ?",
      [userId],
    );

    // Map to array of eventId strings
    const eventIds = rows.map((row) => row.event_id);

    return res.status(200).json({ success: true, eventIds });
  } catch (err) {
    console.error("findEventsByUser failed:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch events by user" });
  }
};
