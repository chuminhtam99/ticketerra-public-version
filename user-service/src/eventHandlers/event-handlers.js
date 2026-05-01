const logger = require("../utils/logger");
const pool = require("../config/pool");

const handleEventCreated = async (event) => {
  try {
    // console.log("handleEventCreated voi event la: ");
    // console.log(event);
    const { user_id, event_id } = event;
    await pool.query(
      "INSERT INTO user_events (user_id, event_id) VALUES (?, ?)",
      [user_id, event_id],
    );
    logger.info("save a new row in user_events table!");
  } catch (e) {
    logger.error(e, "Error occured handleEventCreated in user-service");
  }
}; 
 
module.exports = { handleEventCreated };
