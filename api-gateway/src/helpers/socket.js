// socket.js
const { Server } = require("socket.io");
const Redis = require("ioredis");
const logger = require("../utils/logger");

let io;

function init(server) {
  io = new Server(server, {
    pingTimeout: 60000,
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // ✅ Handle client connections
  io.on("connection", (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on("join_event_room", (eventId) => {
      socket.join(eventId);
      logger.info(`Client ${socket.id} joined room ${eventId}`);
    });

    socket.on("leave_event_room", (eventId) => {
      socket.leave(eventId);
      logger.info(`Client ${socket.id} left room ${eventId}`);
    });
  });

  // ✅ Redis subscription
  const redisClient = new Redis(process.env.REDIS_URL);
  redisClient.subscribe("socket_events");

  redisClient.on("message", (channel, message) => {
    const data = JSON.parse(message);

    if (data.type === "event_stock_update") { 
      console.log("emit event_stock_update");

      // Emit only to the event room
      io.to(data.eventId).emit("event_stock_update", data);
      logger.info(`Stock update emitted to room ${data.eventId}`);
    } else {
      // fallback: broadcast
      io.emit(channel, data);
    }
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized! Call init(server) first.");
  }
  return io;
}

module.exports = { init, getIO };
