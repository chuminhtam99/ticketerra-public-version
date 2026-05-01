require("dotenv").config();
const logger = require("./utils/logger");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config();
const { RateLimiterRedis } = require("rate-limiter-flexible");
const connectToDB = require("./database/db");
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");
const { handleSoldOutTicket } = require("./eventHandlers/rabbitmq-handlers");
const { redisClient, connectRedis } = require("./database/redis");

const eventRoutes = require("./routes/event-routes");

const app = express();
const PORT = process.env.PORT || 3002;

connectToDB();
connectRedis();
// middleware
app.use(helmet());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3003"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

//DDos protection and rate limiting : chỉ cho 10 req từ client được vào server
// const rateLimiter = new RateLimiterRedis({
//   storeClient: redisClient,
//   keyPrefix: "middleware",
//   points: 10,
//   duration: 1,
// });

// app.use((req, res, next) => {
//   rateLimiter
//     .consume(req.ip)
//     .then(() => next())
//     .catch(() => {
//       logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
//       res.status(429).json({ success: false, message: "Too many requests" });
//     });
// });

app.use(
  "/api/events",

  eventRoutes,
);

async function startServer() {
  try {
    await connectToRabbitMQ();

    consumeEvent("soldout.ticket", handleSoldOutTicket);
    app.listen(PORT, () => {
      logger.info(`Event service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
    process.exit(1);
  }
}

startServer();
