// Logging có cấu trúc (pino) + forward lỗi sang Sentry khi có SENTRY_DSN.
// Không cấu hình gì thêm thì log đẹp ra console (dev) hoặc JSON (production),
// và captureError chỉ log — không đụng Sentry nếu chưa bật.
const pino = require('pino');

const isProd = process.env.NODE_ENV === 'production';

const logger = pino(
  isProd
    ? { level: process.env.LOG_LEVEL || 'info' }
    : {
        level: process.env.LOG_LEVEL || 'debug',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
);

function sentryEnabled() {
  return Boolean(String(process.env.SENTRY_DSN || '').trim());
}

function captureError(error, context = {}) {
  logger.error({ err: error, ...context }, error?.message || 'Lỗi không xác định');
  if (!sentryEnabled()) return;
  try {
    require('@sentry/node').captureException(error, { extra: context });
  } catch {
    // Sentry chưa init được (xem instrument.js) — logging local vẫn đủ để không mất lỗi.
  }
}

module.exports = { logger, sentryEnabled, captureError };
