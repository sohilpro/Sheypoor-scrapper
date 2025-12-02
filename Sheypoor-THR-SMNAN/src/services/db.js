const { createClient } = require("redis");

class RedisManager {
  constructor() {
    // 1. دریافت آدرس ردیس از متغیرهای محیطی
    // در داکر کامپوز، ما REDIS_HOST=redis را ست کردیم
    // اگر متغیر نبود، پیش‌فرض روی لوکال‌هاست می‌رود (برای تست دستی)
    const host = process.env.REDIS_HOST || "127.0.0.1";
    const port = process.env.REDIS_PORT || 6379;

    const connectionUrl = `redis://${host}:${port}`;

    console.log(`🔌 Redis Target: ${connectionUrl}`);

    // 2. تنظیم کلاینت با URL داینامیک
    this.client = createClient({
      url: connectionUrl,
    });

    this.client.on("error", (err) =>
      console.error("❌ Redis Client Error:", err.message)
    );
    this.client.on("connect", () =>
      console.log(`✅ Successfully connected to Redis at ${host}`)
    );

    this.AD_KEY_PREFIX = "ad:processed:";
    this.AD_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 روز
  }

  async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
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
