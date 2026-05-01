const pool = require("../config/pool"); 
const logger = require("../utils/logger")

async function initDB() {
  try {
    await pool.query(`
CREATE TABLE IF NOT EXISTS user (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin', 'both') NOT NULL DEFAULT 'user',
  name VARCHAR(255),
  phone VARCHAR(20),
  dob DATE,
  gender ENUM('Nam', 'Nữ', 'Khác'),
  paymentMethod ENUM('credit card', 'chuyển khoản') DEFAULT 'chuyển khoản',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

    `);

    await pool.query(`
CREATE TABLE IF NOT EXISTS user_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id VARCHAR(24) NOT NULL,
  CONSTRAINT fk_user_events_user
    FOREIGN KEY (user_id) REFERENCES user(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_event (event_id)
);

    `);
 
    logger.info("✅ user and user_events tables ensured");
  } catch (err) {
    logger.error("❌ Error ensuring tables:", err.message);
    process.exit(1);
  }
}

module.exports = {initDB};
