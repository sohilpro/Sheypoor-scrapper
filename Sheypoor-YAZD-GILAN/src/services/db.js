// src/services/redisManager.js

const { createClient } = require("redis");

class RedisManager {
  constructor() {
    this.client = createClient();
    this.client.on("error", (err) => console.error("Redis Client Error", err));
    this.AD_KEY_PREFIX = "ad:processed:";
    this.AD_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 روز
  }

  async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
      console.log("✅ Redis connected.");
    }
  }

  // چک می‌کند که آیا آگهی با این ID قبلا پردازش شده است یا خیر
  async isAdProcessed(adId) {
    await this.connect();
    const key = this.AD_KEY_PREFIX + adId;
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  // آگهی را به عنوان پردازش شده ثبت می‌کند و TTL می‌زند
  async markAdAsProcessed(adId) {
    await this.connect();
    const key = this.AD_KEY_PREFIX + adId;
    // ذخیره با یک مقدار ساده (مثلاً '1') و تنظیم زمان انقضا
    await this.client.set(key, "1", {
      EX: this.AD_TTL_SECONDS,
    });
  }
}

module.exports = new RedisManager();
