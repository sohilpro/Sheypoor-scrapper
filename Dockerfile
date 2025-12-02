FROM ghcr.io/puppeteer/puppeteer:21.5.2

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

# کپی کردن فایل‌های پکیج
COPY package*.json ./

# نصب پکیج‌ها
RUN npm ci

# کپی کردن تمام فایل‌های پروژه (پوشه‌های شیپور و...) به داخل کانتینر
COPY . .

USER root