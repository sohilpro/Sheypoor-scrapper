require("dotenv").config();
const scraper = require("./services/scraper");
const telegram = require("./services/telegram");
const filter = require("./services/filters");
const express = require("express");
const config = require("./config/config");
const redisManager = require("./services/db");

const app = express();
const PORT = process.env.PORT || 4004;

const PROVINCES = config.TARGET_LOCATIONS;
const DELAY_PER_PROVINCE = config.SCRAPING_DELAY_PER_PROVINCE_MS || 15000;

// وضعیت استان‌ها
let currentProvinceIndex = 0;
let provinceStatus = {};
PROVINCES.forEach((p) => {
  provinceStatus[p.name] = { last_run: null, last_error: null, ads_found: 0 };
});

function launchTelegramBot() {
  if (telegram.isConfigured && telegram.bot) {
    try {
      telegram.bot.launch();
      console.log(
        "✅ Telegram Bot is actively running and listening for updates..."
      );
    } catch (err) {
      console.error("❌ Failed to launch Telegram bot:", err.message);
    }
  }
}

/**
 * پردازش لیست آگهی‌ها و ارسال به تلگرام
 */
async function processAds(ads, province) {
  let count = 0;
  for (const ad of ads) {
    const processed = await redisManager.isAdProcessed(ad.id);
    if (processed) continue;

    const analysis = filter.analyzeAd(ad.title, ad.title);

    if (analysis.isCrashed) {
      console.log(
        `🚨 [${province.name}][${ad.site}] Crashed car found: ${ad.title}`
      );

      const phone = await scraper.getPhoneNumber(ad.url);
      const adData = await scraper.getAdData(ad.url);

      //       const message = `
      // 🚨 **CRASHED CAR FOUND**
      // 🚗 Site: **${ad.site.toUpperCase()}**
      // 🌍 Province: ${province.name}
      // 📌 Title: ${ad.title}
      // 🔗 URL: ${ad.url}
      // 📞 Phone: ${phone}
      // 📣 Reason: ${analysis.reason}
      // `;

      const caption = `
🚨 *خودروی تصادفی پیدا شد*
──────────────
📌 *عنوان:* ${ad.title}
💰 *قیمت:* ${adData.price} ${adData.isAgreed ? "" : "تومان"}

🌍 *استان:* ${province.name}
🚗 *سایت:* ${ad.site.toUpperCase()}

📞 *تلفن:* \`${phone || "نامشخص"}\`
💡 *علت تشخیص:* _${analysis.reason}_
──────────────
🔗 [مشاهده آگهی در شیپور](${ad.url})
`;
      await telegram.sendPhotoLog(
        adData.imageUrl,
        caption,
        province.telegram_chat_id,
        true
      );
      // await telegram.sendLog(message, province.telegram_chat_id);
      await redisManager.markAdAsProcessed(ad.id);
      count++;
    }
  }
  return count;
}

/**
 * Job اصلی: اجرای همزمان دیوار و شیپور برای هر استان
 */
async function runScraperCycle() {
  if (PROVINCES.length === 0) return;

  const target = PROVINCES[currentProvinceIndex];
  console.log(
    `\n--- 🚀 Starting cycle for: ${target.name} (Divar & Sheypoor) ---`
  );

  let totalAdsFound = 0;
  const sites = ["sheypoor"];

  try {
    const adsBySite = await Promise.all(
      sites.map(async (site) => {
        try {
          const ads = await scraper.scrapeAds(
            site,
            config.SEARCH_QUERIES,
            target.search_url_param
          );
          console.log(`\t> ${site} found ${ads.length} ads`);
          return { site, ads };
        } catch (siteErr) {
          console.error(
            `🔥 ERROR on ${site} for [${target.name}]:`,
            siteErr.message
          );
          await telegram.sendLog(
            `❌ ERROR on ${site} in ${target.name}: ${siteErr.message}`,
            target.telegram_chat_id
          );
          return { site, ads: [] };
        }
      })
    );

    // پردازش و ارسال به تلگرام
    for (const { site, ads } of adsBySite) {
      const processedCount = await processAds(ads, target);
      totalAdsFound += ads.length;
      console.log(
        `\t> ${site} processed. Found ${processedCount} new crashed ads.`
      );
    }
  } catch (err) {
    console.error("❌ Main scraper cycle error:", err.message);
    await telegram.sendLog(
      `❌ Scraper cycle error: ${err.message}`,
      target.telegram_chat_id
    );
  } finally {
    provinceStatus[target.name].last_run = new Date();
    provinceStatus[target.name].ads_found = totalAdsFound;
    currentProvinceIndex = (currentProvinceIndex + 1) % PROVINCES.length;

    // Delay تصادفی قبل از استان بعدی
    const randomDelay = DELAY_PER_PROVINCE + Math.floor(Math.random() * 5000);
    setTimeout(runScraperCycle, randomDelay);
  }
}

/**
 * REST API Status
 */
app.get("/status", (req, res) => {
  res.json({
    service: "Divar/Sheypoor Scraper (Concurrent)",
    status: "Running",
    provinces: provinceStatus,
    running_jobs:
      "1 (handling all provinces sequentially with concurrent sites)",
    current_province: PROVINCES[currentProvinceIndex]?.name || "N/A",
  });
});

/**
 * 🌐 Start Server
 */
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // ⬅️ فراخوانی در ابتدای برنامه
  launchTelegramBot();

  await scraper.initBrowser();

  // Login دیوار و شیپور
  const [isSheypoorReady] = await Promise.all([
    // scraper.login(config.DIVAR_URL, config.USER_PHONE, config.USER_PASSWORD),
    scraper.login(config.SHEYPOOR_URL, config.USER_PHONE, config.USER_PASSWORD),
  ]);

  if (!isSheypoorReady) {
    console.error(
      "FATAL: Failed to log in to one or both platforms. Please check cookies/manual login."
    );
    process.exit(1);
  }

  await redisManager.connect();
  runScraperCycle(); // شروع Job چرخشی
  console.log("✅ Scraper cycle started.");
});
