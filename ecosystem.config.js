require("dotenv").config({ path: "./.env" });

const sharedEnv = {
  USER_PHONE: process.env.USER_PHONE,
  USER_PASSWORD: process.env.USER_PASSWORD,
  YOUR_TELEGRAM_USER_ID: process.env.YOUR_TELEGRAM_USER_ID,

  TELEGRAM_CHAT_ID_GILAN: process.env.TELEGRAM_CHAT_ID_GILAN,
  TELEGRAM_CHAT_ID_YAZD: process.env.TELEGRAM_CHAT_ID_YAZD,
  TELEGRAM_CHAT_ID_SHIRAZ: process.env.TELEGRAM_CHAT_ID_SHIRAZ,
  TELEGRAM_CHAT_ID_ESFAHAN: process.env.TELEGRAM_CHAT_ID_ESFAHAN,
  TELEGRAM_CHAT_ID_TEHRAN: process.env.TELEGRAM_CHAT_ID_TEHRAN,
  TELEGRAM_CHAT_ID_SEMNAN: process.env.TELEGRAM_CHAT_ID_SEMNAN,
  TELEGRAM_CHAT_ID_QOM: process.env.TELEGRAM_CHAT_ID_QOM,
  TELEGRAM_CHAT_ID_ARAK: process.env.TELEGRAM_CHAT_ID_ARAK,
  TELEGRAM_CHAT_ID_MAZANDARAN: process.env.TELEGRAM_CHAT_ID_MAZANDARAN,
};

module.exports = {
  apps: [
    {
      name: "DIV-MAZANDARAN",
      script: "src/index.js",
      cwd: "./Divar-MZNDRN",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        ...sharedEnv,
        PORT: 3001,
        // ✅ اینجا توکن مخصوص مازندران تبدیل میشه به BOT_TOKEN
        BOT_TOKEN: process.env.TOKEN_MAZANDARAN,
      },
    },
    {
      name: "DIV-QOM-ARAK",
      script: "src/index.js",
      cwd: "./Divar-QOM-ARAK",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        ...sharedEnv,
        PORT: 3002,
        BOT_TOKEN: process.env.TOKEN_QOM_ARAK, // ✅ توکن قم و اراک
      },
    },
    {
      name: "DIV-SHIRAZ-ISFAHAN",
      script: "src/index.js",
      cwd: "./Divar-SHZ-ISFHN",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        ...sharedEnv,
        PORT: 3003,
        BOT_TOKEN: process.env.TOKEN_SHIRAZ_ISFAHAN, // ✅ توکن شیراز و اصفهان
      },
    },
    {
      name: "DIV-TEHRAN-SEMNAN",
      script: "src/index.js",
      cwd: "./Divar-THR-SMNAN",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        ...sharedEnv,
        PORT: 3004,
        BOT_TOKEN: process.env.TOKEN_TEHRAN_SEMNAN, // ✅ توکن تهران و سمنان
      },
    },
    {
      name: "DIV-YAZD-GILAN",
      script: "src/index.js",
      cwd: "./Divar-YAZD-GILAN",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        ...sharedEnv,
        PORT: 3005,
        BOT_TOKEN: process.env.TOKEN_YAZD_GILAN, // ✅ توکن یزد و گیلان
      },
    },
  ],
};
