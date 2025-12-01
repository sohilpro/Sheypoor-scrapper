/**
 * اجرای برنامه را برای تعداد مشخصی میلی‌ثانیه متوقف می‌کند.
 * @param {number} ms - تعداد میلی‌ثانیه‌ها برای تأخیر.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * یک عدد تصادفی بین دو مقدار (شامل هر دو) تولید می‌کند.
 * @param {number} min - حداقل مقدار (بر حسب میلی‌ثانیه).
 * @param {number} max - حداکثر مقدار (بر حسب میلی‌ثانیه).
 * @returns {number} زمان تأخیر تصادفی.
 */
const getRandomDelay = (min, max) => {
  // Math.floor(Math.random() * (max - min + 1)) + min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const SHEYPOOR_OTP_INPUTS_SELECTOR =
  'div#_6hY4V input[type="text"][inputmode="numeric"]';

async function fillSheypoorOtp(page, otpCode) {
  if (otpCode.length !== 4) {
    throw new Error("OTP code for Sheypoor must be exactly 4 digits.");
  }

  const inputs = await page.$$(SHEYPOOR_OTP_INPUTS_SELECTOR);

  if (inputs.length < 4) {
    throw new Error(
      `Could not find 4 OTP input fields in Sheypoor modal. Found: ${inputs.length}`
    );
  }

  for (let i = 0; i < 4; i++) {
    const digit = otpCode[i];
    // از type استفاده می‌کنیم چون روی اینپوت‌های مجزا است
    await inputs[i].type(digit, { delay: 50 });
  }
}

module.exports = {
  delay,
  getRandomDelay,
  fillSheypoorOtp,
};
