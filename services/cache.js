const mongoose = require("mongoose");
const { client } = require("./redis");

// Store a reference to the original `exec` method.
// This is important so we can call the original logic
// if caching is not enabled or after checking the cache.
const exec = mongoose.Query.prototype.exec;

/**
 * === Prototype Chain Context ===
 *
 * Every query you create with Mongoose (e.g. `Model.find()`) is an instance
 * of `mongoose.Query`. That query instance inherits from `mongoose.Query.prototype`,
 * which is where we're attaching custom methods like `.cache()`, or overriding `.exec()`.
 *
 * Prototype chain:
 *   queryInstance
 *     ↑
 *   mongoose.Query.prototype ← we modify this!
 *     ↑
 *   Object.prototype
 */

// Override `.exec()` to support custom caching logic
// Do NOT use arrow function here to preserve `this` context
mongoose.Query.prototype.exec = async function () {
  console.log("executing query ", this.getQuery());

  // If caching is not enabled for this query, fall back to original `exec`
  if (!this.useCache) {
    console.log("not using cache");

    // Call the original `exec` method with the original context and arguments
    return exec.apply(this, arguments);
  }

  /**
   * Generate a unique cache key for this query.
   *
   * - `this.getQuery()` returns the query conditions (e.g. `{ name: 'John' }`)
   * - `this.mongooseCollection.name` provides the collection name (e.g. 'users')
   * - We're combining both into a single object, then stringifying it as the cache key.
   */
  const key = JSON.stringify({
    query: this.getQuery(),
    collection: this.mongooseCollection.name,
  });

  try {
    const cacheValue = await client.hgetAsync(this.hashKey, key);

    if (cacheValue) {
      console.log("found cache for key ", key, this.mongooseCollection.name);
      const doc = JSON.parse(cacheValue);
      return Array.isArray(doc)
        ? doc.map((d) => new this.model(d))
        : new this.model(doc);
    }

    const result = await exec.apply(this, arguments);

    await client.hsetAsync(this.hashKey, key, JSON.stringify(result));
    await client.expire(this.hashKey, 60);

    return result;
  } catch (err) {
    console.error("Redis cache error:", err);
    return exec.apply(this, arguments);
  }
};

/**
 * Custom `.cache()` method
 *
 * - Call this on a query to enable caching
 * - Accepts an optional options object with a `key` property
 * - Stores custom info (`useCache`, `hashKey`) directly on the query instance
 */
mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || "default");
  console.log("hash key ", this.hashKey);
  return this;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
    console.log("cache cleared for key ", hashKey);
  },
};
