const pool = require("../config/pool");
const logger = require("../utils/logger");

async function initDB() {
  console.log("init ok");

  try {
    await pool.query(`
  CREATE TABLE IF NOT EXISTS ticket_inventory (
    ticket_id      VARCHAR(24) PRIMARY KEY,
    total_quantity INT NOT NULL,
    available      INT NOT NULL,
    locked         INT NOT NULL,
    booked         INT NOT NULL,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_available_nonnegative CHECK (available >= 0),
    CONSTRAINT chk_booked_nonnegative CHECK (booked >= 0),
    CONSTRAINT chk_locked_nonnegative CHECK (locked >= 0),
    CONSTRAINT chk_total_quantity_nonnegative CHECK (total_quantity >= 0)
  );
`);
    // table for marking which order expires
    await pool.query(`
CREATE TABLE IF NOT EXISTS ticket_locks (
  lock_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(user_id)
);
    `);

    await pool.query(`
CREATE TABLE IF NOT EXISTS lock_items (
    lock_item_id BIGINT AUTO_INCREMENT PRIMARY KEY, -- unique ID for this row
    lock_id      BIGINT NOT NULL,
    ticket_id    VARCHAR(24) NOT NULL,
    session_id   VARCHAR(24) NOT NULL,
    event_id      VARCHAR(24) NOT NULL,
    quantity     INT NOT NULL,
    FOREIGN KEY (lock_id) REFERENCES ticket_locks(lock_id) ON DELETE CASCADE
);
`);

    logger.info("✅ ticket_inventory and ticket_locks tables ensured");
  } catch (err) {
    logger.error("❌ Error ensuring tables:", err.message);
    process.exit(1);
  }
}
module.exports = { initDB };
