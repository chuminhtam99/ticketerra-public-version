import dotenv from "dotenv";
dotenv.config();
import he from "he";
import fetch from "node-fetch";
import cron from "node-cron";
import connectToDB from "./database/db.js";
import Event from "./models/Event.js";
import pool from "./config/pool.js";

// Utility: random integer between min and max
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomTrueFalse() {
  return Math.random() < 0.5 ? "true" : "false";
}

// Category mapping
function normalizeCategory(rawCategory) {
  switch (rawCategory) {
    case "music":
      return "Nhạc sống & Concert";
    case "theatersandart":
      return "Sân khấu & Nghệ thuật";
    case "sport":
      return "Thể Thao";
    case "seminarsworkshops":
      return "Hội thảo & Workshop";
    case "attractionsexperiences":
      return "Tham quan & Trải nghiệm";
    case "others":
      return "Khác";
    default:
      return "Khác";
  }
}

// Crawl detailed event by ID
// Crawl detailed event by ID
async function crawlEventDetail(eventId) {
  try {
    const url = `https://api-v2.ticketbox.vn/gin/api/v2/events/${eventId}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const item = data?.data?.result;

    if (!item || !item.id) {
      console.error(`Invalid event data for ${eventId}`, data);
      return;
    }

    // Build sessions safely (without numberOfTicketLeft here)
    const sessions = [];
    const ticketAvailabilityDocs = [];

    if (Array.isArray(item.showings)) {
      for (const showing of item.showings) {
        const tickets = [];

        if (Array.isArray(showing?.ticketTypes)) {
          for (const tt of showing.ticketTypes) {
            // Ticket document (no numberOfTicketLeft here)
            const ticket = {
              name: tt?.name || "",
              price: tt?.price || 0,
              minOrder: tt?.minQtyPerOrder || 1,
              desc: tt?.description || "",
              image: tt?.imageUrl || "",
            };
            tickets.push(ticket);
          }
        }

        sessions.push({
          eventDate: showing?.startTime ? new Date(showing.startTime) : null,
          startBookingTime:
            Array.isArray(showing?.ticketTypes) &&
            showing.ticketTypes.length > 0
              ? new Date(
                  showing.ticketTypes[
                    randomInt(0, showing.ticketTypes.length - 1)
                  ]?.startTime || showing.startTime,
                )
              : showing?.startTime
                ? new Date(showing.startTime)
                : null,
          startTime: showing?.startTime ? new Date(showing.startTime) : null,
          tickets,
        });
      }
    }

    // Normalize category
    let category = "Khác";
    if (Array.isArray(item?.categoriesV2) && item.categoriesV2.length > 0) {
      category = normalizeCategory(item.categoriesV2[0]);
    }

    // Check for duplicates

    // Decode HTML entities
    const cleanDescription = he.decode(item?.description || "");
    const cleanOrganizerInfo = he.decode(item?.orgDescription || "");
    const existing = await Event.findOne({ eventName: item.title });

    // Check for duplicates
    if (existing) {
      console.log(`Skipping duplicate event: ${item.title}`);
      return;
    }

    // Build event document
    const eventDoc = new Event({
      backgroundImage: item?.bannerURL || "",
      eventImage: item?.bannerURL || "",
      eventName: item?.title || "",
      onAd: randomTrueFalse(),
      isSpecial: randomTrueFalse(),
      eventAddress: item?.address || "",
      eventType: item?.type === 1 ? "offline" : "online",
      venueName: item?.venue || "",
      category,
      eventDesc: cleanDescription,
      organizerName: item?.orgName || "",
      organizerInfo: cleanOrganizerInfo,
      sessions,
      paymentInfo: {
        accountOwner: "Tina Chu",
        accountNumber: "0123456789",
        bankName: "Techcombank",
        branch: "Hanoi Branch",
      },
      originalId: item.id,
      numberOfClick: randomInt(1, 25),
    });

    // Save event first
    // After saving eventDoc
    const savedEvent = await eventDoc.save();
    

    for (const session of savedEvent.sessions) {
      for (const ticket of session.tickets) {
        try {
          let qty = randomInt(100, 200);
          // Use the MongoDB _id that now exists on the saved ticket
          await pool.query(
            `INSERT INTO ticket_inventory 
         (ticket_id, total_quantity, available, locked, booked) 
         VALUES (?, ?, ?, 0, 0)
         ON DUPLICATE KEY UPDATE 
           total_quantity = VALUES(total_quantity),
           available = VALUES(available)`,
            [ticket._id.toString(), qty, qty],
          );
          console.log(" added ==");
        } catch (err) {
          console.error("Error inserting ticket inventory:", err.message);
        }
      }
    }

    if (ticketAvailabilityDocs.length > 0) {
      await TicketAvailability.insertMany(ticketAvailabilityDocs);
    }

    // console.log(`Saved new event: ${item.title} (${eventId})`);
  } catch (err) {
    console.error(`Error crawling event ${eventId}:`, err.message);
  }
}

// Crawl list of events and then details
async function crawlEvents() {
  const categories = [
    "music",
    "theatersandart",
    "sport",
    "seminarsworkshops",
    "attractionsexperiences",
    "others",
  ];

  for (const cat of categories) {
    try {
      const url = `https://api-v2.ticketbox.vn/search/v2/events?limit=100&page=1&categories=${cat}`;
      const resp = await fetch(url);
      const data = await resp.json();
      const results = data?.data?.results;

      if (!Array.isArray(results)) {
        console.error(`No results for category ${cat}`, data);
        continue;
      }

      // console.log(`Fetched ${cat} event list...`);

      for (const item of results) {
        if (!item?.id) {
          console.error("Skipping invalid item:", item);
          continue;
        }
        await crawlEventDetail(item.id);
      }
    } catch (err) {
      console.error(`Error fetching category ${cat}:`, err.message);
    }
  }
}

// Connect to DB and start crawler
(async () => {
  await connectToDB();
  await crawlEvents();
  cron.schedule("0 2 * * *", async () => {
    // console.log("Running daily Ticketbox crawl...");
    await crawlEvents();
  });
})();
