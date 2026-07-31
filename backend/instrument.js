// Sentry phải init trước khi require bất kỳ module nào khác thì mới auto-
// instrument được (Express, http...). File này luôn là require đầu tiên của
// server.js — kể cả trước dotenv config nên bản thân nó tự đọc .env.server.
// Không cấu hình SENTRY_DSN thì toàn bộ no-op, không ảnh hưởng app.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.server') });

const SENTRY_DSN = String(process.env.SENTRY_DSN || '').trim();

if (SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    });
  } catch (error) {
    console.error('Sentry init thất bại, tiếp tục chạy không có error tracking:', error.message || error);
  }
}
