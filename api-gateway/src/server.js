require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const logger = require("./utils/logger");
const proxy = require("express-http-proxy");
const cookieParser = require("cookie-parser");
const http = require("http");
const errorHandler = require("./middleware/errorhandler");

const { init } = require("./helpers/socket"); 

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Wrap Express in HTTP server
const server = http.createServer(app);

// ✅ Initialize Socket.IO
init(server);

// Middleware
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

// ✅ Rate limiting with Redis
const Redis = require("ioredis");
const redisClient = new Redis(process.env.REDIS_URL);

const ratelimitOptions = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ success: false, message: "Too many requests" });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});
app.use(ratelimitOptions);

// ✅ Proxy setup (example)
const proxyOptions = {
  proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/v1/, "/api"),
  proxyErrorHandler: (err, res, next) => {
    logger.error(`Proxy error: ${err.message}`);
    res.status(500).json({ message: "Internal server error", error: err.message });
  },
};

app.use(
  "/v1/auth",
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData) => {
      logger.info(`Response from Identity service: ${proxyRes.statusCode}`);
      return proxyResData;
    },
  }),
);



app.use(
  "/v1/events",
  proxy(process.env.EVENT_SERVICE_URL, {
    ...proxyOptions,
    parseReqBody: false, // forward raw multipart stream
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // don’t override Content-Type here
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Event service: ${proxyRes.statusCode}`,
      );
      return proxyResData;
    },
  }),
);

app.use(
  "/v1/seats",
  proxy(process.env.SEAT_SERVICE_URL, {
    ...proxyOptions,
    // parseReqBody: false, // forward raw multipart stream
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // don’t override Content-Type here
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Seat service: ${proxyRes.statusCode}`,
      );
      return proxyResData;
    },
  }),
);
app.use(
  "/v1/booking",
  proxy(process.env.BOOKING_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // don’t override Content-Type here
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from BOOKING service: ${proxyRes.statusCode}`,
      ); 
      return proxyResData;
    },
  }),
);app.use(
  "/v1/payment",
  proxy(process.env.PAYMENT_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // don’t override Content-Type here
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from PAYMENT service: ${proxyRes.statusCode}`,
      ); 
      return proxyResData;
    },
  }),
);

app.use(errorHandler);  



// ✅ Start server
server.listen(PORT, () => {
  logger.info(`API Gateway + Socket.IO running on port ${PORT}`);
});
 