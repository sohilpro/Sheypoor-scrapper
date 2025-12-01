const { Telegraf, Markup } = require("telegraf"); // 🆕 Markup اضافه شد
const fs = require("fs"); // 🆕 fs اضافه شد
const path = require("path"); // 🆕 path اضافه شد
require("dotenv").config();

const BOT_TOKEN = process.env.TOKEN_SHIRAZ_ISFAHAN;

class TelegramService {
  /** @type {Telegraf | null} */
  bot = null;
  isConfigured = false;

  constructor() {
    if (!BOT_TOKEN) {
      console.error("FATAL: Telegram BOT_TOKEN is not configured.");
    } else {
      this.bot = new Telegraf(BOT_TOKEN);
      this.isConfigured = true;

      // 🆕 هندل کردن کالبک‌های دکمه‌ها برای جلوگیری از لودینگ بی‌پایان در تلگرام
      this.bot.on("callback_query", (ctx, next) => {
        ctx.answerCbQuery().catch(() => {});
        return next();
      });
    }
  }

  // این متد را به کلاس تلگرام خود اضافه کنید
  async sendPhotoLog(imageUrl, caption, chatId, isCritical = false) {
    if (!this.isConfigured || !chatId || !this.bot) {
      console.log(`[Telegram] Skipping log...`);
      return false;
    }

    try {
      // اگر عکس وجود داشت، عکس را با کپشن بفرست
      if (imageUrl) {
        await this.bot.telegram.sendPhoto(chatId, imageUrl, {
          caption: caption,
          parse_mode: "Markdown", // یا HTML اگر راحت‌ترید
          disable_notification: !isCritical,
        });
      } else {
        // اگر عکس نبود، همان پیام متنی معمولی را بفرست
        await this.bot.telegram.sendMessage(chatId, caption, {
          parse_mode: "Markdown",
          disable_notification: !isCritical,
          disable_web_page_preview: true, // برای اینکه لینک پیش‌نمایش نسازد
        });
      }
      return true;
    } catch (error) {
      const errorMessage = error.response
        ? error.response.description
        : error.message;

      console.error(
        `[Telegram] Failed to send photo message to ${chatId}: ${errorMessage}`
      );
      // تلاش مجدد برای ارسال متن خالی در صورت خرابی عکس
      if (imageUrl) {
        console.log("[Telegram] Retrying with text only...");
        return this.sendLog(caption, chatId, isCritical);
      }
      return false;
    }
  }

  /**
   * ارسال یک پیام متنی به یک کانال تلگرام مشخص
   */
  async sendLog(message, chatId, isCritical = false) {
    if (!this.isConfigured || !chatId || !this.bot) {
      console.log(`[Telegram] Skipping log...`);
      return false;
    }
    try {
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        disable_notification: !isCritical,
      });
      return true;
    } catch (error) {
      const errorMessage = error.response
        ? error.response.description
        : error.message;

      console.error(
        `[Telegram] Failed to send message to ${chatId}: ${errorMessage}`
      );
      return false;
    }
  }

  async askPhoneNumber(expectedChatId) {
    if (!this.isConfigured || !this.bot) {
      throw new Error("Telegram bot is not configured.");
    }

    // 1. خواندن فایل phones.txt
    const filePath = path.join(__dirname, "../../../phones.txt"); // مسیر فایل را تنظیم کنید
    if (!fs.existsSync(filePath)) {
      await this.sendLog("❌ فایل phones.txt پیدا نشد!", expectedChatId);
      throw new Error("phones.txt not found");
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    // جدا کردن خط به خط و حذف فضاهای خالی
    const phoneList = fileContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (phoneList.length === 0) {
      await this.sendLog("❌ فایل phones.txt خالی است!", expectedChatId);
      throw new Error("phones.txt is empty");
    }

    // 2. ساخت دکمه‌های شیشه‌ای
    // هر ردیف 1 دکمه داشته باشد
    const buttons = phoneList.map((phone) => [
      Markup.button.callback(`📱 ${phone}`, `NUM_${phone}`),
    ]);

    console.log(
      `[Telegram] Asking user ${expectedChatId} to select a phone number...`
    );

    await this.bot.telegram.sendMessage(
      expectedChatId,
      "🤖 **لطفا شماره موبایل مورد نظر برای ورود به تهران سمنان را انتخاب کنید:**",
      Markup.inlineKeyboard(buttons)
    );

    // 3. انتظار برای کلیک روی دکمه (Promise)
    return new Promise((resolve, reject) => {
      let isListenerDone = false;
      const timeoutMs = 120000; // 2 دقیقه زمان انتخاب

      const selectionListener = (ctx) => {
        if (isListenerDone) return;
        // بررسی اینکه آیا از دکمه‌های ما (callback_query) است یا خیر
        if (!ctx.callbackQuery || !ctx.callbackQuery.data) return;

        // بررسی اینکه آیا همان یوزر ادمین کلیک کرده است
        if (
          ctx.chat?.id.toString() !== expectedChatId.toString() &&
          ctx.from?.id.toString() !== expectedChatId.toString()
        )
          return;

        const data = ctx.callbackQuery.data;

        // چک کردن پیشوند NUM_
        if (data.startsWith("NUM_")) {
          const selectedPhone = data.replace("NUM_", "");

          isListenerDone = true;
          clearTimeout(timeout);

          // ارسال پیام تایید برای کاربر
          ctx.reply(`✅ شماره ${selectedPhone} انتخاب شد. در حال ورود...`);

          resolve(selectedPhone);
        }
      };

      // تنظیم تایم‌اوت
      const timeout = setTimeout(() => {
        if (isListenerDone) return;
        isListenerDone = true;
        reject(new Error("Phone selection timed out."));
      }, timeoutMs);

      // گوش دادن به اونت callback_query
      this.bot.on("callback_query", selectionListener);
    });
  }

  /**
   * منتظر دریافت کد OTP شش رقمی از یک چت مشخص می‌ماند.
   */
  async getOtpCode(expectedChatId, timeoutMs = 60000) {
    if (!this.isConfigured || !this.bot) {
      throw new Error("Telegram bot is not configured.");
    }

    console.log(
      `[Telegram] Waiting for OTP code from Chat ID ${expectedChatId} for ${
        timeoutMs / 1000
      }s...`
    );

    return new Promise((resolve, reject) => {
      // 🌟🌟 FIX: پرچم منطقی برای جایگزینی removeListener 🌟🌟
      let isListenerDone = false;

      // 2. تعریف Listener
      const otpListener = (ctx) => {
        if (isListenerDone) return; // ⬅️ اگر قبلاً Resolve یا Reject شده، نادیده بگیر

        // اطمینان از اینکه پیام از چت مورد انتظار آمده باشد
        if (ctx.chat.id.toString() !== expectedChatId.toString()) {
          return;
        }

        const text = ctx.message.text.trim();
        // 4. بررسی کد: اگر متن دقیقا شامل 6 رقم باشد
        const otpMatch = text.match(/^\d{4}$/);

        if (otpMatch) {
          const receivedCode = otpMatch[0];

          // 5. پاکسازی و Resolve
          isListenerDone = true; // ⬅️ پرچم را تنظیم کن
          clearTimeout(timeout);

          // ❌ this.bot.removeListener حذف شد

          resolve(receivedCode);
        }
      };

      // 1. تنظیم مهلت زمانی (Timeout)
      const timeout = setTimeout(() => {
        if (isListenerDone) return; // ⬅️ اگر قبلاً Resolve شده، کاری نکن

        // 3. Reject پس از پایان مهلت
        isListenerDone = true; // ⬅️ پرچم را تنظیم کن

        // ❌ this.bot.removeListener حذف شد

        reject(new Error("OTP Code retrieval timed out (60 seconds)."));
      }, timeoutMs);

      // 6. Listener را اضافه کن
      this.bot.on("text", otpListener);
    });
  }
}

// ⬅️ صادرات یک نمونه Singleton
module.exports = new TelegramService();
