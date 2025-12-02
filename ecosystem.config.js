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
      name: "SHI-MAZANDARAN",
      script: "src/index.js",
      cwd: "./Sheypoor-MZNDRN",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "450M", // ✅ محدودیت رم
      restart_delay: 5000, // ✅ ۵ ثانیه استراحت قبل از شروع مجدد
      env: {
        ...sharedEnv,
        PORT: 4000,
        BOT_TOKEN: process.env.TOKEN_MAZANDARAN,
      },
    },
    {
      name: "SHI-QOM-ARAK",
      script: "src/index.js",
      cwd: "./Sheypoor-QOM-ARAK",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "450M",
      restart_delay: 5000,
      env: {
        ...sharedEnv,
        PORT: 4001,
        BOT_TOKEN: process.env.TOKEN_QOM_ARAK,
      },
    },
    {
      name: "SHI-SHIRAZ-ISFAHAN",
      script: "src/index.js",
      cwd: "./Sheypoor-SHZ-ISFHN",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "450M",
      restart_delay: 5000,
      env: {
        ...sharedEnv,
        PORT: 4002,
        BOT_TOKEN: process.env.TOKEN_SHIRAZ_ISFAHAN,
      },
    },
    {
      name: "SHI-TEHRAN-SEMNAN",
      script: "src/index.js",
      cwd: "./Sheypoor-THR-SMNAN",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "450M",
      restart_delay: 5000,
      env: {
        ...sharedEnv,
        PORT: 4003,
        BOT_TOKEN: process.env.TOKEN_TEHRAN_SEMNAN,
      },
    },
    {
      name: "SHI-YAZD-GILAN",
      script: "src/index.js",
      cwd: "./Sheypoor-YAZD-GILAN",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "450M",
      restart_delay: 5000,
      env: {
        ...sharedEnv,
        PORT: 4004,
        BOT_TOKEN: process.env.TOKEN_YAZD_GILAN,
      },
    },
  ],
};
