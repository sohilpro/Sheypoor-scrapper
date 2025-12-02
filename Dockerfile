FROM ghcr.io/puppeteer/puppeteer:21.5.2

WORKDIR /app

# کپی کردن فایل‌های پکیج
COPY package*.json ./

# نصب پکیج‌ها
RUN npm ci

# کپی کردن تمام فایل‌های پروژه (پوشه‌های شیپور و...) به داخل کانتینر
COPY . .

USER root