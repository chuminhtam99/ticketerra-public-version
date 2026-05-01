const Event = require("../models/Event");

const handleSoldOutTicket = async (event) => {

  const { eventId, ticketId } = event;

  try {
    // Find the event by ID
    const doc = await Event.findById(eventId);

    if (!doc) {
      console.log(`Event ${eventId} not found`);
      return;
    }

    // Flag to track if the ticket was found
    let ticketFound = false;

    // Iterate through sessions and tickets
    doc.sessions.forEach((session) => {
      session.tickets.forEach((ticket) => {
        if (ticket._id && ticket._id.toString() === ticketId.toString()) {
          ticketFound = true;
          ticket.soldOut = "true";
        }
      });
    });

    if (ticketFound) {
      await doc.save();
    } else {
      console.log(`Ticket ${ticketId} not found in event ${eventId}`);
    }
  } catch (err) {
    console.error("handleSoldOutTicket failed:", err);
  }
};

module.exports = {
  handleSoldOutTicket,
};
