const winston = require("winston");
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(), // Adds a timestamp to each log entry
    winston.format.errors({ stack: true }), // Ensures error stack traces are included in logs
    winston.format.splat(), // Allows string interpolation (e.g., logger.info("User %s logged in", username))
    winston.format.json() //Outputs logs in JSON format (structured, machine-readable).
  ),
  defaultMeta: { service: "user-service" }, // Adds metadata to every log entry, eg: every log will include "service": "identity-service"

  transports: [
    // Where Logs Go
    new winston.transports.Console({
      // Logs are printed to the terminal
      format: winston.format.combine(
        winston.format.colorize(), // Adds colors based on log level (e.g., errors in red)
        winston.format.simple() // Human-readable format (instead of JSON)
      ),
    }),
    // new winston.transports.File({ filename: "error.log", level: "error" }), // Only logs with level error go into error.log
    // new winston.transports.File({ filename: "combined.log" }), // - All logs (regardless of level) go into combined.log
  ],
});

module.exports = logger;
