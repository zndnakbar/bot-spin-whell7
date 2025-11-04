import 'dotenv/config';
export const ENV = {
  PORT: Number(process.env.PORT||8080),
  ADMIN_API_KEY: process.env.ADMIN_API_KEY||'dev-key',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS||'http://localhost:8080').split(','),
  DAILY_TIMEZONE: process.env.DAILY_TIMEZONE||'Asia/Jakarta',
  MIN_INTERVAL_BETWEEN_SPINS_SEC: Number(process.env.MIN_INTERVAL_BETWEEN_SPINS_SEC||86400),
  COOKIE_NAME: process.env.COOKIE_NAME||'bot_anon_id',
};
