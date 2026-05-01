const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    // await redisClient.flushDb();
    console.log("✅ Connected to Redis");
  }
}

// go log all the data:
async function getAllRedisData(pattern = "*") {
  let cursor = "0";

  do {
    // SCAN returns [cursor, keys]
    const reply = await redisClient.scan(cursor, {
      MATCH: pattern,
      COUNT: 100,
    });

    cursor = reply.cursor;
    const keys = reply.keys;

    for (const key of keys) {
      console.log("============");

      console.log("key la");
      console.log(key);

      const value = await redisClient.get(key);
      console.log("value la");
      console.log(value);
    }
  } while (cursor !== "0");
}

module.exports = { redisClient, connectRedis };
