// src/services/filter.js

class AdFilter {
  constructor() {
    this.crashKeywords = [
      "تصادفی",
      "چپی",
      "سقف ستون",
      "رنگ کامل",
      "تعویض پلاک",
      "اوراقی",
    ];
    this.safeKeywords = ["بدون رنگ", "فنی عالی", "کم کارکرد", "درحد صفر"];
  }

  /**
   * @param {string} title - عنوان آگهی
   * @param {string} description - توضیحات آگهی
   * @returns {{isCrashed: boolean, reason: string}}
   */
  analyzeAd(title, description) {
    const text = (title + " " + description).toLowerCase();
    let crashScore = 0;
    let safeScore = 0;
    let reasons = [];

    // افزایش امتیاز تصادفی بودن
    this.crashKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        crashScore += 1;
        reasons.push(keyword);
      }
    });

    // کاهش امتیاز در صورت وجود کلمات سالم
    this.safeKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        safeScore += 1;
      }
    });

    const isCrashed = crashScore > safeScore;
    const reason = isCrashed
      ? `${reasons.join(", ")}`
      : "Clean Ad (Based on analysis)";

    return { isCrashed, reason };
  }
}

module.exports = new AdFilter();
