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
const {initDB} = require("./database/connect"); 
const authRoutes = require("./routes/auth-routes");
const { handleEventCreated } = require("./eventHandlers/event-handlers");

const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");

const app = express();
const PORT = process.env.PORT || 3001;

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
  points: 100,
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

//Ip based rate limiting for sensitive endpoints
const sensitiveEndpointsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, //Each client’s request count resets every 15 minutes
  max: 50, // Maximum number of requests per client

  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);

    res.status(429).json({ success: false, message: "Too many requests" });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

app.use("/api/auth/register", sensitiveEndpointsLimiter);

app.use("/api/auth", authRoutes);


async function startServer() {
  try {
    await initDB();
    await connectToRabbitMQ();

    //consume all the events
    await consumeEvent("event.user.created", handleEventCreated);

    app.listen(PORT, () => {
      logger.info(`User service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
    process.exit(1);
  }
} 

startServer();
