const logger = require("../utils/logger");
const pool = require("../config/pool");
const { sendOrderConfirmationEmail } = require("../helpers/email");

const handleSendEmail = async (event) => {
  console.log("handleSendEmail");

  const { user, order, eventInDB, items } = event;

  console.log(" 111 === eventInDB");
  console.log(eventInDB);

  try {
    if (user?.email) {
      sendOrderConfirmationEmail(user, order, eventInDB, items);
    }
    logger.info("sent ok");
  } catch (e) {
    logger.error(e, "Error occured handleEventCreated in user-service");
  }
};

module.exports = { handleSendEmail };
