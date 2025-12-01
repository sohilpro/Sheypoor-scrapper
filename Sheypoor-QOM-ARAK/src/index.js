require("dotenv").config();
const scraper = require("./services/scraper");
const telegram = require("./services/telegram");
const filter = require("./services/filters");
const express = require("express");
const config = require("./config/config");
const redisManager = require("./services/db");
const fs = require("fs");
const path = require("path");
const { Markup } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 4000;

const PROVINCES = config.TARGET_LOCATIONS;
const DELAY_PER_PROVINCE = config.SCRAPING_DELAY_PER_PROVINCE_MS || 15000;

// وضعیت استان‌ها
let currentProvinceIndex = 0;
let provinceStatus = {};
PROVINCES.forEach((p) => {
  provinceStatus[p.name] = { last_run: null, last_error: null, ads_found: 0 };
});

function launchTelegramBot() {
  if (!telegram.bot) return;

  const bot = telegram.bot;
  const ADMIN_ID = process.env.YOUR_TELEGRAM_USER_ID;

  // ============================================================
  // 🛠️ تابع کمکی: ساختن کیبورد دکمه‌ها
  // ============================================================
  const getMainKeyboard = () => {
    // مسیر فایل‌ها
    const phonesPath = path.join(__dirname, "../../phones.txt");
    const activePhonePath = path.join(__dirname, "../active_phone.txt");

    let phoneList = [];
    let activePhone = null;

    if (fs.existsSync(phonesPath)) {
      phoneList = fs
        .readFileSync(phonesPath, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    }

    if (fs.existsSync(activePhonePath)) {
      activePhone = fs.readFileSync(activePhonePath, "utf-8").trim();
    }

    const buttons = phoneList.map((phone) => {
      let label = `📱 ${phone}`;
      if (activePhone && phone === activePhone) {
        label = `✅ ${phone} (فعال)`;
      }
      return [Markup.button.callback(label, `SET_NUM_${phone}`)];
    });

    buttons.push([
      Markup.button.callback("🗑️🔴 پاکسازی و ریستارت برنامه", "ACTION_RESTART"),
    ]);

    return Markup.inlineKeyboard(buttons);
  };

  // ============================================================
  // 🛠️ تابع کمکی: عملیات ریستارت
  // ============================================================
  const performRestart = async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID)
      return ctx.reply("⛔ شما دسترسی ندارید.");

    try {
      await ctx.reply("🗑️ در حال پاک‌سازی کوکی‌ها و ریستارت ربات...");

      const filesToDelete = [
        "cookies_divar_ir.json",
        "cookies_sheypoor_com.json",
        // "active_phone.txt", // اگر میخواهید شماره فعال بماند، این خط را کامنت کنید
      ];

      let deletedCount = 0;

      filesToDelete.forEach((fileName) => {
        // مسیر فایل را چک کنید (معمولا داخل src است)
        const filePath = path.join(process.cwd(), fileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted: ${filePath}`);
            deletedCount++;
          } catch (e) {
            console.error(`خطا در حذف ${fileName}:`, e);
          }
        }
      });

      const msg =
        deletedCount > 0
          ? `✅ ${deletedCount} فایل کوکی پاک شد.\n🔄 در حال ریستارت...`
          : "ℹ️ کوکی‌ها قبلا پاک شده‌اند.\n🔄 در حال ریستارت...";

      await ctx.reply(msg);

      setTimeout(() => {
        process.exit(0);
      }, 1000);
    } catch (error) {
      console.error("Error in reset:", error);
      ctx.reply(`❌ خطا: ${error.message}`);
    }
  };

  if (telegram.isConfigured && bot) {
    try {
      // 1. هندلر دستور /start
      bot.start((ctx) => {
        if (ctx.from.id.toString() !== ADMIN_ID) return;
        ctx.reply(
          "👋 سلام ادمین!\nشماره مورد نظر را انتخاب کنید تا لاگین شروع شود:",
          getMainKeyboard()
        );
      });

      // 2. هندلر دستور /restart
      bot.command("restart", async (ctx) => {
        await performRestart(ctx);
      });

      // 3. هندلر دکمه "ریستارت"
      bot.action("ACTION_RESTART", async (ctx) => {
        await ctx.answerCbQuery();
        await performRestart(ctx);
      });

      // 4. هندلر انتخاب شماره (شروع لاگین)
      // 4. هندلر انتخاب شماره (ذخیره + پاکسازی + ریستارت)
      bot.action(/^SET_NUM_(.+)$/, async (ctx) => {
        if (ctx.from.id.toString() !== ADMIN_ID) return;

        const selectedPhone = ctx.match[1];
        const activePhonePath = path.join(__dirname, "../active_phone.txt");

        // 1. ذخیره شماره جدید
        fs.writeFileSync(activePhonePath, selectedPhone, "utf-8");
        await ctx.answerCbQuery(`شماره ${selectedPhone} ذخیره شد.`);

        // 2. حذف کوکی‌های قدیمی (تا با اکانت قبلی قاطی نشود)
        const cookiesPath = path.join(
          __dirname,
          "../cookies_sheypoor_com.json"
        ); // یا cookies_divar_ir.json
        if (fs.existsSync(cookiesPath)) {
          try {
            fs.unlinkSync(cookiesPath);
          } catch (e) {}
        }

        // 3. اعلام ریستارت به کاربر
        await ctx.editMessageText(
          `✅ شماره فعال روی **${selectedPhone}** تنظیم شد.\n🗑️ کوکی‌های قبلی پاک شدند.\n🔄 **برنامه در حال ریستارت است...**\n\n(بعد از بالا آمدن، ربات به صورت خودکار با شماره جدید تلاش برای ورود می‌کند)`,
          getMainKeyboard() // دکمه‌ها را نگه میداریم تا تیک سبز جابجا شده را ببیند
        );

        console.log(`♻️ Switching to ${selectedPhone}. Restarting process...`);

        // 4. ریستارت برنامه (PM2 دوباره روشنش می‌کند)
        setTimeout(() => {
          process.exit(0);
        }, 1500);
      });

      bot.launch();
      console.log("✅ Telegram Bot is actively running...");

      process.once("SIGINT", () => bot.stop("SIGINT"));
      process.once("SIGTERM", () => bot.stop("SIGTERM"));
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
  // const [isSheypoorReady] = await Promise.all([
  //   // scraper.login(config.DIVAR_URL, config.USER_PHONE, config.USER_PASSWORD),
  //   scraper.login(config.SHEYPOOR_URL, config.USER_PHONE, config.USER_PASSWORD),
  // ]);

  // if (!isSheypoorReady) {
  //   console.error(
  //     "FATAL: Failed to log in to one or both platforms. Please check cookies/manual login."
  //   );
  //   process.exit(1);
  // }

  // ============================================================
  // 🔥 لاگین هوشمند بعد از ریستارت 🔥
  // ============================================================
  const activePhonePath = path.join(__dirname, "../active_phone.txt"); // مسیر را چک کنید
  let autoPhone = null;

  // خواندن شماره فعال (اگر وجود داشت)
  if (fs.existsSync(activePhonePath)) {
    autoPhone = fs.readFileSync(activePhonePath, "utf-8").trim();
    console.log(`ℹ️ Found active phone config: ${autoPhone}`);
  }

  // تلاش برای لاگین (اگر کوکی نباشد، از autoPhone استفاده می‌کند)
  try {
    // آدرس سایت را بر اساس پروژه تنظیم کن
    const siteUrl = config.SHEYPOOR_URL;

    // فراخوانی متد لاگین:
    // اگر کوکی باشد -> با کوکی می‌رود.
    // اگر کوکی نباشد (که الان پاک کردیم) -> از autoPhone استفاده می‌کند.
    await scraper.login(siteUrl, autoPhone, telegram);
  } catch (e) {
    console.log("⚠️ Login process finished with warnings.");
  }

  await redisManager.connect();
  runScraperCycle(); // شروع Job چرخشی
  console.log("✅ Scraper cycle started.");
});
