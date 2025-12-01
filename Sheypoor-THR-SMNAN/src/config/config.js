// src/config/config.js
module.exports = {
  TARGET_LOCATIONS: [
    {
      name: "تهران",
      search_url_param: "tehran-province",
      telegram_chat_id: process.env.TELEGRAM_CHAT_ID_TEHRAN,
    },
    {
      name: "سمنان",
      search_url_param: "semnan-province",
      telegram_chat_id: process.env.TELEGRAM_CHAT_ID_SEMNAN,
    },
    // {
    //   name: "اصفهان",
    //   search_url_param: "isfahan-province",
    //   telegram_chat_id: process.env.TELEGRAM_CHAT_ID_ESFAHAN,
    // },
  ],
  SEARCH_QUERIES: [
    "تصادفی",
    "تصادف",
    "کم ضرب",
    "کم‌ضرب",
    "کم ضربه",
    "روشن حرکت",
    "چپ شده",
    "چپی",
    "چپ کردم",
    "از جلو خورده",
    "از پشت خورده",
    "از بغل خورده",
    "نیاز به",
    "یاتاقان",
  ],
  SCRAPING_DELAY_PER_PROVINCE_MS: 10000,
  DIVAR_URL: "https://divar.ir",
  SHEYPOOR_URL: "https://www.sheypoor.com",
  USER_PHONE: process.env.USER_PHONE,
};
