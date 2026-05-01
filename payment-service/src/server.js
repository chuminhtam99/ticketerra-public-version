require("dotenv").config();
const logger = require("./utils/logger");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config();
const { RateLimiterRedis } = require("rate-limiter-flexible");
const Redis = require("ioredis");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const paymentRoutes = require("./routes/payment-routes");
const {handleZeroOrderDone} = require("./eventHandlers/handlers");

const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");

const app = express();
const PORT = process.env.PORT || 3005;

const redisClient = new Redis(process.env.REDIS_URL);

// middleware
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
//DDos protection and rate limiting : chỉ cho 10 req từ client được vào server
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "middleware",
  points: 400,
  duration: 1,
});

app.use((req, res, next) => {
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({ success: false, message: "Too many requests" });
    });
});

app.use("/api/payment", paymentRoutes);

async function startServer() {
  try {
    await connectToRabbitMQ();

    consumeEvent("zero.order.done", handleZeroOrderDone);

    app.listen(PORT, () => {
      logger.info(`User service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
    process.exit(1);
  }
}

startServer();
