// socket.js
let io;

function init(server) {
  io = require("socket.io")(server, {
    pingTimeout: 60000,
    cors: {
      origin: "http://localhost:5173", // adjust to your frontend
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {

    socket.on("join_event_room", (eventId) => {
      socket.join(eventId);
    });

    socket.on("leave_event_room", (eventId) => {
      socket.leave(eventId);
    });
  });
//   console.log("init socket ok");

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized! Call init(server) first.");
  }
  return io;
}

module.exports = { init, getIO };
