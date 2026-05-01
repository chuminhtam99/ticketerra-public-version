const pool = require("../config/pool");
const logger = require("../utils/logger");

async function initDB() {
  try {
    // index order_key
    await pool.query(`
CREATE TABLE IF NOT EXISTS orders (
    order_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_key     VARCHAR(50) NOT NULL UNIQUE,
    user_id       INT NOT NULL,
    event_id      VARCHAR(24) NOT NULL,
    paymentMethod ENUM('credit card','chuyển khoản') NOT NULL,
    totalPrice    INT UNSIGNED NOT NULL,
    purchaseDate  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status        ENUM('PENDING','CONFIRMED','FAILED','CANCELLED') NOT NULL,
    lock_id       BIGINT NULL,  -- allow NULL so ON DELETE SET NULL works
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_lock
        FOREIGN KEY (lock_id) REFERENCES ticket_locks(lock_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES \`user\`(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
`);
// index order_id 
    await pool.query(`
  CREATE TABLE IF NOT EXISTS order_items (
    order_item_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id      BIGINT NOT NULL,
    event_id      VARCHAR(24) NOT NULL,
    eventName     VARCHAR(100) NOT NULL,
    ticket_id     VARCHAR(24) NOT NULL,
    ticketName    VARCHAR(100) NOT NULL,
    ticketPrice   DECIMAL(10,2) NOT NULL,
    quantity      INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
  );
`);

    await pool.query(`
  CREATE TABLE IF NOT EXISTS user_orders (
    user_id INT NOT NULL,
    order_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, order_id),
    CONSTRAINT fk_user_orders_user
      FOREIGN KEY (user_id) REFERENCES \`user\`(user_id)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_user_orders_order
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
      ON DELETE CASCADE
      ON UPDATE CASCADE
  );
`);
 
    logger.info("✅ orders and order_items tables ensured");
  } catch (err) {
    logger.error("❌ Error ensuring tables:", err.message);
    process.exit(1);
  }
}

module.exports = { initDB };
