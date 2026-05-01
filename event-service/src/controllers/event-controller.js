const Event = require("../models/Event");
const { uploadToCloudinary } = require("../helpers/cloudinaryHelper");
const fs = require("fs");
const { publishEvent } = require("../utils/rabbitmq");
const { redisClient } = require("../database/redis");
// const { log } = require("winston");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const recommendHelperFunction = async (res) => {
  try {
    // const { from, to } = req.query;
    const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    // Build cache key
    const cacheKey = `events:guestrecommend:${from}:${to}`;

    // 1. Try Redis first
    const cachedEvents = await redisClient.get(cacheKey);
    if (cachedEvents) {
      return res
        .status(200)
        .json({ success: true, events: JSON.parse(cachedEvents) });
    }

    // 2. Query MongoDB if not cached
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const events = await Event.find({
      earliestDate: { $gte: fromDate, $lte: toDate },
    })
      .sort({ numberOfClick: 1 })
      .select("backgroundImage eventName earliestDate lowestPrice ")
      .lean();

    // 3. Save result to Redis with expiration (e.g. 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(events), { EX: 3600 });
    return res.status(200).json({ success: true, events });
  } catch (err) {
    console.error("Error fetching events in month:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch events in month" });
  }
};

exports.recommendEvents = async (req, res) => {
  const token = req.cookies?.accessToken;
  console.log("recommendEvents");

  if (!token) {
    return recommendHelperFunction(res);
  }

  //decode this token
  try {
    console.log("aaaa");

    const decodedTokenInfo = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const userId = decodedTokenInfo.userId;

    // find the event_id booked
    const bookingRes = await axios.get(
      `http://localhost:3004/api/booking/events/${userId}`,
    );

    const eventIds = bookingRes.data.events;

    if (!eventIds || eventIds.length === 0) {
      return recommendHelperFunction(res);
    }

    const pastEvents = await Event.find({ _id: { $in: eventIds } });

    if (pastEvents.length === 0) {
      return recommendHelperFunction(res);
    }

    // Extract categories and lowest prices
    const categories = [
      ...new Set(pastEvents.map((e) => e.category).filter(Boolean)),
    ];
    const lowestPrices = pastEvents
      .map((e) => e.lowestPrice)
      .filter((p) => p != null);

    // Calculate median (or average) price
    let medianPrice = null;
    if (lowestPrices.length > 0) {
      const sorted = lowestPrices.sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianPrice =
        sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // Step 4: Query for recommended events
    const now = new Date();
    const recommendations = await Event.find({
      category: { $in: categories },
      lowestPrice: { $lte: medianPrice },
      lastDate: { $gt: now },
    })
      .select("_id backgroundImage eventName earliestDate lowestPrice")
      .sort({ numberOfClick: -1 })
      .limit(6);

    console.log(recommendations);

    return res.json({
      success: true,
      events: recommendations,
    });
  } catch (error) {
    console.log(error);

    return res.status(401).json({
      success: false,
      message: "error",
    });
  }
};

// post("/"
exports.createEvent = async (req, res) => {
  console.log('post("/")');

  try {
    const eventData = JSON.parse(req.body.data);

    // Handle uploaded files
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const { fieldname, path } = file;
        const { url } = await uploadToCloudinary(path);

        if (fieldname === "eventImage") {
          eventData.eventImage = url;
        } else if (fieldname === "backgroundImage") {
          eventData.backgroundImage = url;
        } else if (fieldname.startsWith("ticketImages_")) {
          const parts = fieldname.split("_"); // ["ticketImages","0","1"]
          const sIdx = parseInt(parts[1], 10);
          const tIdx = parseInt(parts[2], 10);

          if (
            eventData.sessions[sIdx] &&
            eventData.sessions[sIdx].tickets[tIdx]
          ) {
            eventData.sessions[sIdx].tickets[tIdx].image = url;
          }
        }
        fs.unlinkSync(path);
      }
    }

    // Save event
    const event = new Event(eventData);
    await event.save();

    // Create TicketAvailability records for each ticket

    for (const session of event.sessions) {
      for (const ticket of session.tickets) {
        await publishEvent("event.seat.created", {
          ticketId: ticket._id.toString(),
          numberOfTicketLeft: ticket.quantity,
        });
      }
    }

    await publishEvent("event.user.created", {
      user_id: req.userInfo.userId,
      event_id: event._id,
    });

    res.status(201).json({
      success: true,
      message: "Event created and linked to user successfully.",
      event,
    });
  } catch (err) {
    console.error("Error saving event:", err);
    res.status(400).json({
      success: false,
      message: "Failed to create event.",
      error: err.message,
    });
  }
};
// get("/auth"
exports.checkAuth = async (req, res) => {
  console.log("get /auth");

  res.status(200).json({
    success: true,
    message: "Access ok.",
  });
};
//get("/:eventId"
exports.getEvent = async (req, res) => {
  console.log('vao get "/:eventId")');

  const eventId = req.params.eventId;

  const cachedKey = `event:${eventId}`;

  try {
    // Step 1: Try Redis cache first
    const cachedEvent = await redisClient.get(cachedKey);
    if (cachedEvent) {
      // console.log('co cache o get Event');

      return res.status(200).json({
        success: true,
        message: "ok (from cache)",
        event: JSON.parse(cachedEvent),
      });
    }

    // Step 2: Query MongoDB for event (increment click count)
    const event = await Event.findByIdAndUpdate(
      eventId,
      { $inc: { numberOfClick: 1 } },
      { returnDocument: "after" },
    ).lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // Step 3: Store result in Redis
    await redisClient.set(cachedKey, JSON.stringify(event), {
      EX: 60 * 5, // expire after 5 minutes
    });

    res.status(200).json({
      success: true,
      message: "ok",
      event,
    });
  } catch (err) {
    console.error("Error finding event:", err);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

// "/search"
exports.searchEvents = async (req, res) => {
  console.log('"/search"');

  try {
    const { name, category } = req.query;

    let events = [];

    if (name) {
      console.log(name);

      // Text search by name
      events = await Event.find({ eventName: { $regex: name, $options: "i" } })
        .collation({ locale: "vi", strength: 2 })
        .lean();
    } else if (category) {
      // Exact match by category
      events = await Event.find({ category: category }).lean();
    } else {
      return res.status(400).json({ error: "Missing search query" });
    }

    res.status(200).json(events);
  } catch (err) {
    console.error("Error searching events:", err);
    res.status(500).json({ error: "Failed to search events" });
  }
};

//"/my-event"

exports.getMyEvent = async (req, res) => {
  console.log("/my-event");

  try {
    // Step 1: call User service to get eventIds
    const eventIdsResponse = await axios.get(
      `http://localhost:3001/api/auth/event/${req.userInfo.userId}`,
    );

    const eventIds = eventIdsResponse.data.eventIds;
    console.log(eventIdsResponse);

    if (!eventIds || eventIds.length === 0) {
      return res.status(200).json({ success: true, events: [] });
    }

    // Step 2: query MongoDB for those events
    const events = await Event.find(
      { _id: { $in: eventIds } },
      { _id: 1, eventImage: 1, eventName: 1, eventAddress: 1 },
    );

    // Step 3: return result
    return res.status(200).json({ success: true, events });
  } catch (err) {
    console.error("getMyEvent failed:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch my events" });
  }
};

// get("/in-banner");
exports.getEventInBanner = async (req, res) => {
  try {
    // Get query params
    const { from, to } = req.query;

    // Build cache key (optional)
    const cacheKey = `events:in-banner:${from}`;

    // Check Redis cache first
    const cachedEvents = await redisClient.get(cacheKey);
    if (cachedEvents) {
      return res.status(200).json(JSON.parse(cachedEvents));
    }
    // Convert to Date objects
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Query DB but only select backgroundImage
    let events = await Event.find({
      onAd: true,
      earliestDate: { $gte: fromDate, $lte: toDate },
    })
      .sort({ earliestDate: 1 })
      .limit(6)
      .select("backgroundImage");

    // Save to cache
    await redisClient.set(cacheKey, JSON.stringify(events), { EX: 60 * 60 }); // cache for 1h

    return res.status(200).json(events);
  } catch (err) {
    console.error("Error fetching banner events:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// get "/in-special
exports.getSpecialEvent = async (req, res) => {
  try {
    // 1. Read query params (required)
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: "Missing required query params: from, to",
      });
    }

    // 3. Build cache key based on "from" date
    const cacheKey = `events:special:${from}`;

    // 4. Try Redis first
    const cachedEvents = await redisClient.get(cacheKey);
    if (cachedEvents) {
      return res
        .status(200)
        .json({ success: true, events: JSON.parse(cachedEvents) });
    }

    // 5. Query MongoDB if not cached
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const events = await Event.find({
      isSpecial: true,
      earliestDate: { $gte: fromDate, $lte: toDate },
      category: { $in: ["Nhạc sống & Concert", "Tham quan & Trải nghiệm"] },
    })
      .limit(20)
      .select("backgroundImage")
      .lean();

    // 6. Save result to Redis with expiration (e.g. 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(events), { EX: 3600 });

    return res.status(200).json({ success: true, events });
  } catch (err) {
    console.error("Error fetching special events:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch events" });
  }
};

//get "/trending"
exports.getTrendingEvent = async (req, res) => {
  try {
    // 1. Read query params (required)
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: "Missing required query params: from, to",
      });
    }

    // 3. Build cache key based on "from" date
    const cacheKey = `events:trending:${from}`;

    // 4. Try Redis first
    const cachedEvents = await redisClient.get(cacheKey);
    if (cachedEvents) {
      return res
        .status(200)
        .json({ success: true, events: JSON.parse(cachedEvents) });
    }
    // 2. Convert to Date objects
    const fromDate = new Date(from);
    const toDate = new Date(to);
    // 5. Query MongoDB if not cached
    const events = await Event.find({
      earliestDate: { $gte: fromDate, $lte: toDate },
    })
      .sort({ numberOfClick: -1 }) // highest clicks first
      .limit(7) // cap the number of results
      .select("backgroundImage") // only return backgroundImage
      .lean();

    // 6. Save result to Redis with expiration (e.g. 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(events), { EX: 3600 });

    return res.status(200).json({ success: true, events });
  } catch (err) {
    console.error("Error fetching trending events:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch events" });
  }
};

//GET /events/latest/week
exports.getEventInWeek = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: "Missing required query params: from, to",
      });
    }

    // Build cache key
    const cacheKey = `events:week:${from}:${to}`;

    // 1. Try Redis first
    const cachedEvents = await redisClient.get(cacheKey);
    if (cachedEvents) {
      return res
        .status(200)
        .json({ success: true, events: JSON.parse(cachedEvents) });
    }

    // 2. Query MongoDB if not cached
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const events = await Event.find({
      earliestDate: { $gte: fromDate, $lte: toDate },
    })
      .sort({ numberOfClick: 1 })
      .select("backgroundImage eventName earliestDate lowestPrice")
      .lean();

    // 3. Save result to Redis with expiration (e.g. 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(events), { EX: 3600 });

    return res.status(200).json({ success: true, events });
  } catch (err) {
    console.error("Error fetching events in week:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch events in week" });
  }
};

//GET /events/latest/month
exports.getEventInMonth = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: "Missing required query params: from, to",
      });
    }

    // Build cache key
    const cacheKey = `events:month:${from}:${to}`;

    // 1. Try Redis first
    const cachedEvents = await redisClient.get(cacheKey);
    if (cachedEvents) {
      return res
        .status(200)
        .json({ success: true, events: JSON.parse(cachedEvents) });
    }

    // 2. Query MongoDB if not cached
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const events = await Event.find({
      earliestDate: { $gte: fromDate, $lte: toDate },
    })
      .sort({ numberOfClick: -1 })
      .select("backgroundImage eventName earliestDate lowestPrice ")
      .lean();

    // 3. Save result to Redis with expiration (e.g. 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(events), { EX: 3600 });

    return res.status(200).json({ success: true, events });
  } catch (err) {
    console.error("Error fetching events in month:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch events in month" });
  }
};
//ost("/cart-item/total",
exports.getItemsDetails = async (req, res) => {
  console.log("post /cart-item/total-price");

  try {
    console.log(req.body);
    const { cartItems, eventId } = req.body;

    // Fetch the event document
    const event = await Event.findById(eventId).lean();
    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    const responseArray = [];
    let totalPrice = 0;

    for (const item of cartItems) {
      // Find the session
      const session = event.sessions.find(
        (s) => s._id.toString() === item.sessionId,
      );
      if (!session) {
        return res
          .status(404)
          .json({ success: false, message: "Session not found" });
      }

      // Find the ticket
      const ticket = session.tickets.find(
        (t) => t._id.toString() === item.ticketId,
      );
      if (!ticket) {
        return res
          .status(404)
          .json({ success: false, message: "Ticket not found" });
      }

      const orderItem = {
        event_id: event._id.toString(),
        eventName: event.eventName,
        ticket_id: ticket._id.toString(),
        ticketName: ticket.name,
        ticketPrice: ticket.price,
        quantity: item.quantity,
      };

      responseArray.push(orderItem);
      totalPrice += ticket.price * item.quantity;
    }

    if (totalPrice > 4294967295) {
      return res.status(400).json({
        success: false,
        message: "Total price exceeds allowed maximum",
      });
    }

    return res.json({
      success: true,
      items: responseArray,
      totalPrice,
    });
  } catch (err) {
    console.error("Error in getItemsDetails:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to get item details" });
  }
};
