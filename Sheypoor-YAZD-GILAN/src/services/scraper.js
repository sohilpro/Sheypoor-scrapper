const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { saveCookies, loadCookies } = require("../utils/cookieManager");
const config = require("../config/config");
const axios = require("axios");
const { delay, getRandomDelay, fillSheypoorOtp } = require("../utils/helper");
const telegram = require("./telegram");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const COMMON_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";
const MIN_DELAY_MS = 120 * 1000; // 30 ثانیه
const MAX_DELAY_MS = 300 * 1000; // 75 ثانیه

const LOGIN_DELAY = 2 * 1000;
const WAITING_FOR_GOTO = 5 * 1000;

// For Divar
const ACCOUNT_LINK_XPATH = "//a[contains(., 'حساب من')]";
const PHONE_INPUT_SELECTOR =
  'input[name="username"][type="text"][inputmode="numeric"]';
const SHEYPOOR_OTP_CONTAINER_SELECTOR = "div#_6hY4V"; // والد اینپوت‌ها
const USER_ICON_SELECTOR = 'span[data-test-id="icon-user"]';

class Scraper {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        // executablePath: "/usr/bin/google-chrome",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          `--window-size=1920,1080`,
        ],
      });
      console.log("✅ Browser launched.");
    }
  }

  async login(siteUrl, phone) {
    if (!this.browser) await this.initBrowser();

    const YOUR_TELEGRAM_USER_ID = +process.env.YOUR_TELEGRAM_USER_ID;

    // 1. تلاش برای ورود با کوکی (روش سریع)
    const cookiePage = await this.browser.newPage();
    await cookiePage.setUserAgent(COMMON_USER_AGENT);
    let loginSuccess = false;

    try {
      const loaded = await loadCookies(cookiePage, siteUrl);
      console.log("Loaded cookies =>", loaded);
      await delay(LOGIN_DELAY);
      if (loaded) {
        await cookiePage.goto(siteUrl, { waitUntil: "networkidle2" });

        // 🌟🌟 چک کردن وضعیت ورود برای شیپور 🌟🌟
        loginSuccess = await cookiePage.evaluate(() => {
          const accountLink = Array.from(document.querySelectorAll("a")).find(
            (el) => el.textContent.includes("حساب من")
          );
          return !!accountLink;
        });
      }
    } catch (err) {
      console.warn("Cookie login failed:", err.message);
    } finally {
      await cookiePage.close();
    }

    if (loginSuccess) {
      console.log("✅ Quick login via cookies successful (Sheypoor).");
      return true;
    }

    // --- 2. حالت اتوماتیک (Fallback) ---
    console.log(
      `❌ Cookie login failed for ${siteUrl}. Starting automated flow.`
    );

    const visiblePage = await this.browser.newPage();
    await visiblePage.setViewport({ width: 1920, height: 1080 });
    await visiblePage.setUserAgent(COMMON_USER_AGENT);
    await delay(WAITING_FOR_GOTO);
    await visiblePage.goto(siteUrl, { waitUntil: "networkidle2" });

    try {
      // 🔥🔥 مرحله جدید: انتخاب شماره تلفن توسط کاربر 🔥🔥
      // مرورگر باز شده، اما قبل از کلیک و تایپ، از کاربر شماره را می‌گیریم
      // console.log("Waiting for user to select phone number via Telegram...");

      // --- 2.1. کلیک بر روی "حساب من" ---
      await visiblePage.waitForSelector(USER_ICON_SELECTOR, {
        visible: true,
        timeout: 10000,
      });

      const linkFound = await visiblePage.evaluate(() => {
        const link = Array.from(document.querySelectorAll("a")).find((el) =>
          el.textContent.includes("حساب من")
        );
        if (link) {
          link.click();
          return true;
        }
        return false;
      });

      if (!linkFound) {
        throw new Error("Account link not found using DOM text search.");
      }

      // فراخوانی متد askPhoneNumber از آبجکت telegramBot
      // const selectedPhone = await telegram.askPhoneNumber(
      //   YOUR_TELEGRAM_USER_ID
      // );

      await delay(10000);

      console.log(`User selected: ${phone}. Proceeding with login...`);

      // --- 2.2. پر کردن شماره موبایل انتخاب شده ---
      await visiblePage.waitForSelector(PHONE_INPUT_SELECTOR, {
        timeout: 5000,
      });

      // نرمال‌سازی شماره (اگر نیاز است)
      const normalizedPhone = phone.trim();

      await delay(1000);
      await visiblePage.type(PHONE_INPUT_SELECTOR, normalizedPhone, {
        delay: 100,
      });
      console.log(`✅ Phone number set: ${normalizedPhone}`);

      // 💡 اگر دکمه تاییدی وجود دارد اینجا کلیک کنید، اگر نه که خود شیپور می‌رود مرحله بعد

      // --- 2.3. انتظار برای صفحه OTP و دریافت کد از تلگرام ---

      // انتظار برای کانتینر OTP
      await visiblePage.waitForSelector(SHEYPOOR_OTP_CONTAINER_SELECTOR, {
        timeout: 15000,
      });
      console.log(
        "✅ OTP input modal visible. Requesting code via Telegram..."
      );

      await telegram.sendLog(
        `کد تایید برای شماره ${normalizedPhone} ارسال شد. لطفا کد 4 رقمی را وارد کنید:`,
        YOUR_TELEGRAM_USER_ID
      );

      // 🌟 انتظار برای کد 4 رقمی از تلگرام 🌟
      const otpCode = await telegram.getOtpCode(YOUR_TELEGRAM_USER_ID, 60000);

      if (otpCode.length !== 4) {
        throw new Error("Received OTP is not 4 digits.");
      }

      // 🔥🔥 مرحله جدید: ارسال پیام تایید کد به کاربر 🔥🔥
      await telegram.sendLog(
        `✅ کد ۴ رقمی ${otpCode} صحیح است. در حال ورود به سایت...`,
        YOUR_TELEGRAM_USER_ID
      );

      // --- 2.4. پر کردن 4 اینپوت OTP ---
      await fillSheypoorOtp(visiblePage, otpCode);
      console.log(`✅ OTP typed: ${otpCode}.`);

      // صبر برای ناوبری (ورود موفق)
      await visiblePage.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 20000,
      });
      console.log("✅ Final Sheypoor Login successful.");

      // ============================================================
      // 💾 ذخیره شماره تلفن فعال در فایل (بخش جدید)
      // ============================================================
      try {
        // مسیر فایل ذخیره سازی (مثلاً در پوشه src یا کنار فایل کانفیگ)
        const savePath = path.join(__dirname, "../../active_phone.txt");

        // نوشتن شماره در فایل (اگر فایل باشد جایگزین می‌شود، نباشد ساخته می‌شود)
        fs.writeFileSync(savePath, normalizedPhone, "utf8");

        console.log(`💾 Active phone number saved to: ${savePath}`);
      } catch (fileErr) {
        console.error("❌ Error saving phone number to file:", fileErr.message);
      }
      // ============================================================

      // ارسال پیام موفقیت به تلگرام (همراه با چت آیدی)
      await telegram.sendLog(
        `✅ ورود موفقیت آمیز بود!\n📱 شماره فعال: ${normalizedPhone}\nبرای تغییر شماره ربات را /start کنید.`,
        YOUR_TELEGRAM_USER_ID
      );

      // --- 2.5. ذخیره کوکی‌ها و پایان ---
      await saveCookies(visiblePage, siteUrl);
      await visiblePage.close();
      resolve(true);
    } catch (error) {
      // --- 3. مدیریت شکست ---
      console.error(`❌ Sheypoor Automated Login Failed: ${error.message}`);

      // بستن مرورگر فعلی در صورت خطا
      if (visiblePage) await visibleBrowser.close();

      // تلاش مجدد یا واگذاری به لاگین دستی
      // setTimeout(async () => { ... }, 60000);
    }
  }

  async scrapeAds(siteName, searchKeywords = [], location) {
    if (!this.browser) await this.initBrowser();

    const page = await this.browser.newPage();
    await page.setUserAgent(COMMON_USER_AGENT);

    let baseUrl = siteName === "divar" ? config.DIVAR_URL : config.SHEYPOOR_URL;
    baseUrl = baseUrl.replace(/\/+$/, "");

    await loadCookies(page, baseUrl);

    const buildDivarUrl = (phrase) => {
      return `${baseUrl}/s/${encodeURIComponent(
        location
      )}?q=${encodeURIComponent(phrase)}`;
    };

    const collected = new Map();
    const phrases = [];
    if (Array.isArray(searchKeywords) && searchKeywords.length) {
      phrases.push(searchKeywords.join(" "));
      for (const k of searchKeywords) {
        if (k && !phrases.includes(k)) phrases.push(k);
      }
    } else if (typeof searchKeywords === "string" && searchKeywords.trim()) {
      phrases.push(searchKeywords);
    } else {
      phrases.push("");
    }

    console.log("🔎 Will search phrases:", phrases);

    try {
      for (const phrase of phrases) {
        const searchUrl =
          siteName === "divar" ? buildDivarUrl(phrase) : buildDivarUrl(phrase);

        console.log(`ℹ️ Navigating to: ${searchUrl}`);
        await delay(WAITING_FOR_GOTO);
        try {
          await page.goto(searchUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
        } catch (navErr) {
          console.warn(
            `⚠️ Navigation failed for phrase "${phrase}": ${navErr.message}`
          );
          continue;
        } // شناسایی انتخابگر اصلی کارت‌ها

        const adSelectors =
          siteName === "divar"
            ? "article.kt-post-card"
            : 'a[data-test-id^="ad-item-"]';

        try {
          await page.waitForSelector(adSelectors, { timeout: 10000 }); // افزایش تایم‌آوت
        } catch (waitErr) {
          console.log(
            `ℹ️ No results selector for phrase "${phrase}". Continuing.`
          );
          continue;
        } // استخراج آگهی‌ها از صفحه جاری

        const adsOnPage = await page.$$eval(
          adSelectors,
          (ads, currentSiteName, baseUrlForEval) => {
            return ads
              .map((ad) => {
                let title, url, mileage, price, location;

                if (currentSiteName === "divar") {
                  const titleEl = ad.querySelector(".kt-post-card__title");
                  title = titleEl ? titleEl.textContent.trim() : "N/A";

                  const a = ad.querySelector("a");
                  const relativeUrl = a ? a.getAttribute("href") : null;
                  url =
                    relativeUrl && relativeUrl.startsWith("/")
                      ? baseUrlForEval + relativeUrl
                      : relativeUrl;

                  // استخراج قیمت و کیلومتر از دیوارهای توضیحات
                  const descs = ad.querySelectorAll(
                    ".kt-post-card__description"
                  );
                  if (descs.length === 1) {
                    price = descs[0].textContent.trim();
                  } else if (descs.length >= 2) {
                    mileage = descs[0].textContent.trim();
                    price = descs[1].textContent.trim();
                  }
                } else {
                  // ----------------- منطق شیپور (Sheypoor Logic) -----------------

                  // عنوان در تگ H2
                  const titleEl = ad.querySelector("h2");
                  title = titleEl
                    ? titleEl.textContent.trim().replace("Ad", "").trim()
                    : "N/A"; // حذف برچسب 'Ad'

                  // URL از ویژگی href در تگ A اصلی
                  const relativeUrl = ad.getAttribute("href");
                  url =
                    relativeUrl && relativeUrl.startsWith("/")
                      ? baseUrlForEval + relativeUrl
                      : relativeUrl;

                  // قیمت: در تگ span با کلاس‌های Bolder
                  const priceSpan = ad.querySelector(
                    ".text-heading-4-bolder, .text-heading-5-bolder"
                  );
                  price = priceSpan ? priceSpan.textContent.trim() : "N/A";

                  // موقعیت مکانی (Location)
                  // پیدا کردن اولین تگ small که پس از div قیمت می‌آید
                  const locationEl = ad.querySelector(
                    "small.text-heading-6-lighter"
                  );
                  location = locationEl ? locationEl.textContent.trim() : "N/A";
                  mileage = "N/A (Sheypoor)"; // کیلومتر در لیست شیپور معمولا نیست
                }

                const id = url.split("/").filter(Boolean).pop() || url;

                return {
                  id,
                  title,
                  url,
                  site: currentSiteName,
                  mileage,
                  price,
                  location,
                  description: "Not extracted from list view",
                };
              })
              .filter(Boolean);
          },
          siteName,
          baseUrl
        );

        console.log(`✅ Found ${adsOnPage.length} ads for phrase "${phrase}"`); // ادغام و حذف تکراری‌ها

        for (const ad of adsOnPage) {
          if (!collected.has(ad.id)) {
            collected.set(ad.id, ad);
          }
        } // تأخیر محترمانه بین درخواست‌های جستجو برای جلوگیری از rate-limit

        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
      }
    } catch (err) {
      console.error("❌ scrapeAds main error:", err.message);
    } finally {
      await page.close();
    }

    const result = Array.from(collected.values());
    console.log(`✅ Total unique ads collected: ${result.length}`);
    return result;
  }

  async getAdData(adUrl) {
    try {
      // ۱. دریافت HTML صفحه
      const response = await axios.get(adUrl);
      const $ = cheerio.load(response.data);
      let imageUrl = null;
      // ---------------------------------------------
      // بخش ۱: استخراج عکس (طبق کد قبلی)
      // ---------------------------------------------
      imageUrl = $('img[alt="slider-img-0"]').attr("src");

      if (!imageUrl) {
        // این دستور میگه: برو تو swiper-wrapper، اولین swiper-slide رو بگیر، عکس توش رو بده
        imageUrl = $(".swiper-wrapper .swiper-slide")
          .first()
          .find("img")
          .attr("src");
      }
      // ---------------------------------------------
      // بخش ۲: استخراج قیمت
      // ---------------------------------------------
      let price = "نامشخص";
      let isAgreed = false; // آیا توافقی است؟

      // الف) تلاش برای پیدا کردن قیمت عددی
      // کلاس text-heading-4-bolder دقیقا مربوط به قیمت در کد شماست
      const priceElement = $("strong span.text-heading-4-bolder");

      if (priceElement.length > 0) {
        // نکته مهم: برای اینکه متن‌های داخل SVG (اگر باشه) رو نگیریم،
        // یک کپی از المنت می‌گیریم، بچه‌هاشو (SVG) حذف می‌کنیم و متن رو می‌گیریم.
        price = priceElement.clone().children().remove().end().text().trim();
      }
      // ب) اگر قیمت عددی نبود، چک می‌کنیم آیا "توافقی" نوشته شده؟
      else {
        // دنبال کلمه "توافقی" می‌گردیم
        // کلاس text-body-3-bolder که در کد شما بود
        const agreedElement = $('span.text-body-3-bolder:contains("توافقی")');

        if (agreedElement.length > 0) {
          price = "توافقی";
          isAgreed = true;
        }
      }

      // لاگ برای تست
      console.log(`📸 عکس: ${imageUrl || "ندارد"}`);
      console.log(`💰 قیمت: ${price}`);

      // بازگرداندن آبجکت نهایی
      return {
        imageUrl: imageUrl || null,
        price: price, // مثلا: "۸,۵۵۰,۰۰۰,۰۰۰" یا "توافقی"
        isAgreed, // true یا false
      };
    } catch (error) {
      console.error("❌ خطا در دریافت شیپور:", error.message);
      return null;
    }
  }

  async getPhoneNumber(adUrl) {
    if (!this.browser) await this.initBrowser();
    const page = await this.browser.newPage();
    await page.setUserAgent(COMMON_USER_AGENT);

    const isDivar = adUrl.includes("divar");
    const siteUrl = isDivar ? config.DIVAR_URL : config.SHEYPOOR_URL;

    await loadCookies(page, siteUrl);

    try {
      await page.goto(adUrl, {
        waitUntil: "networkidle2",
        timeout: 45000,
      });
    } catch (err) {
      console.error("❌ Error loading page:", err.message);
      await page.close();
      return "N/A";
    }

    let phoneNumber = "N/A";

    try {
      // ============================
      // 📌 منطق دیوار (DIVAR)
      // ============================
      if (isDivar) {
        const adIdMatch = adUrl.split("/").filter(Boolean);
        if (!adIdMatch) {
          throw new Error("Could not extract Ad ID from Sheypoor URL.");
        }

        const adId = adIdMatch[adIdMatch.length - 1];

        const DivarApiUrl = `https://api.divar.ir/v8/postcontact/web/contact_info_v2/${adId}`;

        const randomTime = getRandomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
        const randomSeconds = (randomTime / 1000).toFixed(1); // نمایش به صورت ثانیه
        console.log(
          `⏱️ Waiting for a random delay of ${randomSeconds} seconds...`
        );

        await delay(randomTime);

        const cookies = await page.cookies(siteUrl);
        const cookieHeader = cookies
          .map((c) => `${c.name}=${c.value}`)
          .join("; ");

        const tokenCookie = cookies.find((c) => c.name === "token");
        if (!tokenCookie) {
          throw new Error(
            "Divar API: Authentication 'token' cookie not found."
          );
        }

        const authorizationHeader = `Bearer ${tokenCookie.value}`;

        const response = await axios.post(
          DivarApiUrl,
          {},
          {
            headers: {
              // ✅ هدرهای حیاتی امنیتی
              Authorization: authorizationHeader,
              "x-render-type": "CSR",
              "Content-Type": "application/json",
              "User-Agent": COMMON_USER_AGENT,
              Cookie: cookieHeader,
              "Accept-Language": "fa-IR,fa;q=0.9",
              Origin: "https://divar.ir",
              Referer: "https://divar.ir/",
            },
            timeout: 15000,
          }
        ); // 3. ✅ استخراج شماره از پاسخ API (تطبیق با ساختار JSON ارسالی)

        const widgets = response.data.widget_list;

        const phoneWidget = widgets.find(
          (w) => w.data.title === "شمارهٔ موبایل" // 👈 عنوان مورد انتظار
        );

        if (phoneWidget) {
          // شماره انگلیسی از payload را استخراج می‌کنیم
          const enNumber =
            phoneWidget.data?.action?.payload?.phone_number?.trim();

          phoneNumber = enNumber;
          console.log(`✅ Divar Phone Result (API): ${phoneNumber}`);
        } else {
          phoneNumber = "چت دیوار";
          console.log(`✅ Divar Phone Result (API): ${phoneNumber}`);
        }
      } else {
        const adIdMatch = adUrl.match(/(\d+)\.html$/);
        if (!adIdMatch) {
          throw new Error("Could not extract Ad ID from Sheypoor URL.");
        }
        const adId = adIdMatch[1];
        const sheypoorApiUrl = `https://www.sheypoor.com/api/v10.0.0/listings/${adId}/number`;
        console.log(`ℹ️ [Sheypoor API] Fetching number for: ${adUrl}`); // 2. ساخت درخواست API (استخراج کوکی برای احراز هویت)

        const randomTime = getRandomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
        const randomSeconds = (randomTime / 1000).toFixed(1); // نمایش به صورت ثانیه
        console.log(
          `⏱️ Waiting for a random delay of ${randomSeconds} seconds...`
        );

        await delay(randomTime);

        const cookies = await page.cookies(siteUrl);
        const cookieHeader = cookies
          .map((c) => `${c.name}=${c.value}`)
          .join("; ");
        const response = await axios.get(sheypoorApiUrl, {
          headers: {
            Cookie: cookieHeader,
            "User-Agent": COMMON_USER_AGENT,
          },
          timeout: 15000,
        }); // 3. ✅ استخراج شماره از پاسخ API (تطبیق با ساختار JSON ارسالی)

        if (
          response.data &&
          response.data.data &&
          response.data.data.attributes
        ) {
          phoneNumber = response.data.data.attributes.phoneNumber.trim();
        } else {
          throw new Error(
            "API response was missing expected data path (data.attributes.phoneNumber)."
          );
        }
        console.log(`✅ Sheypoor Phone Result (API): ${phoneNumber}`);
      }
    } catch (error) {
      console.error(
        `❌ Error getting phone number (${isDivar ? "Divar" : "Sheypoor"}):`,
        error.message
      );
    }

    await page.close();
    return phoneNumber;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log("Browser closed.");
    }
  }
}

module.exports = new Scraper();
