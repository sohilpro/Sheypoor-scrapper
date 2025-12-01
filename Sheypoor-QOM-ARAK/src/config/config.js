// src/config/config.js
module.exports = {
  TARGET_LOCATIONS: [
    {
      name: "قم",
      search_url_param: "qom-province",
      telegram_chat_id: process.env.TELEGRAM_CHAT_ID_QOM,
    },
    {
      name: "اراک",
      search_url_param: "arak",
      telegram_chat_id: process.env.TELEGRAM_CHAT_ID_ARAK,
    },
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
