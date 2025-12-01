// src/utils/cookieManager.js

const fs = require("fs").promises; // استفاده از fs.promises برای کار با توابع آسنکرون
const path = require("path");

// تابعی برای تعیین نام فایل کوکی بر اساس URL سایت
const getCookieFileName = (url) => {
  // استخراج نام دامین اصلی از URL (مثلاً divar.ir یا sheypoor.com)
  const urlObject = new URL(url);
  const domain = urlObject.hostname.replace("www.", "").replace(/\./g, "_"); // تبدیل . به _ برای نام فایل
  return path.join(__dirname, `../../cookies_${domain}.json`);
};

class CookieManager {
  /**
   * کوکی‌های فعال Puppeteer را ذخیره می‌کند تا Session حفظ شود.
   * @param {object} page - آبجکت صفحه Puppeteer
   * @param {string} url - آدرس وبسایت (برای تعیین نام فایل)
   */
  async saveCookies(page, url) {
    try {
      const cookies = await page.cookies();
      const filePath = getCookieFileName(url);

      await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
      console.log(`✅ Cookies saved successfully to ${filePath}`);

      return true;
    } catch (error) {
      console.error(`❌ Error saving cookies for ${url}:`, error.message);
      return false;
    }
  }

  /**
   * کوکی‌های ذخیره شده را بارگذاری و به صفحه Puppeteer تزریق می‌کند.
   * @param {object} page - آبجکت صفحه Puppeteer
   * @param {string} url - آدرس وبسایت (برای تعیین نام فایل)
   * @returns {Promise<boolean>} - true اگر کوکی‌ها با موفقیت لود شدند
   */
  async loadCookies(page, url) {
    const filePath = getCookieFileName(url);

    try {
      const data = await fs.readFile(filePath, "utf8");
      const cookies = JSON.parse(data);

      if (cookies && cookies.length > 0) {
        await page.setCookie(...cookies);
        console.log(`✅ Cookies loaded successfully from ${filePath}.`);
        return true;
      }
      return false;
    } catch (error) {
      // اگر فایل وجود نداشته باشد یا خوانده نشود، یک پیام دوستانه نمایش داده می‌شود
      if (error.code === "ENOENT") {
        console.log(
          `ℹ️ Cookie file not found at ${filePath}. Proceeding without saved session.`
        );
      } else {
        console.error(`❌ Error loading cookies for ${url}:`, error.message);
      }
      return false;
    }
  }
}

module.exports = new CookieManager();
