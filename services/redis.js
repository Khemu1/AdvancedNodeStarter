const redis = require("redis");
const util = require("util");

const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);

client.getAsync = util.promisify(client.get).bind(client);
client.setAsync = util.promisify(client.set).bind(client);
client.hgetAsync = util.promisify(client.hget).bind(client);
client.hsetAsync = util.promisify(client.hset).bind(client);

client.on("error", (err) => {
  console.error("Redis error:", err);
});

const connectToRedis = async () => {
  try {
    await client.connect?.(); // For redis v4+
    await client.flushAll?.(); // or client.flushall() depending on version
    console.log("Redis connected successfully");
  } catch (err) {
    console.error("Error connecting to Redis:", err);
  }
};

module.exports = {
  client,
  connectToRedis,
};
