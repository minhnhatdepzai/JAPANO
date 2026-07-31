// Push notification thật qua Expo Push API (HTTP, không cần SDK/tài khoản trả
// phí riêng) — token lấy từ thiết bị khi người dùng cho phép nhận thông báo
// (xem mobile/lib/push.ts, đăng ký qua POST /api/push/register).
const { fetchWithTimeout } = require('./httpFetch');
const { logger } = require('./logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(token) {
  return /^Expo(nent)?PushToken\[.+\]$/.test(String(token || ''));
}

// Expo giới hạn tối đa 100 message/request — chia lô cho broadcast tới nhiều token.
function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function sendPushToTokens(tokens, { title, body, data } = {}) {
  const valid = [...new Set(tokens)].filter(isExpoPushToken);
  if (!valid.length) return { sent: 0 };
  try {
    let sent = 0;
    for (const batch of chunk(valid, 100)) {
      const messages = batch.map((to) => ({ to, title, body, data: data || {}, sound: 'default' }));
      // eslint-disable-next-line no-await-in-loop
      const response = await fetchWithTimeout(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      }, 8000);
      if (!response.ok) logger.warn({ status: response.status }, 'Expo Push API trả lỗi.');
      else sent += batch.length;
    }
    return { sent };
  } catch (error) {
    logger.warn({ err: error }, 'Gửi push notification thất bại — bỏ qua, không chặn thao tác chính.');
    return { sent: 0, error: error.message };
  }
}

// ctx-aware helper: đọc token đã đăng ký của userId rồi gửi luôn.
function makeSendPushToUser({ read }) {
  return async function sendPushToUser(userId, notification) {
    const tokens = (read().pushTokens || [])
      .filter((row) => String(row.userId) === String(userId))
      .map((row) => row.token);
    if (!tokens.length) return { sent: 0 };
    return sendPushToTokens(tokens, notification);
  };
}

// Broadcast — dùng cho thông báo chung admin gửi cho toàn bộ khách.
function makeSendPushToAll({ read }) {
  return async function sendPushToAll(notification) {
    const tokens = (read().pushTokens || []).map((row) => row.token);
    if (!tokens.length) return { sent: 0 };
    return sendPushToTokens(tokens, notification);
  };
}

module.exports = { isExpoPushToken, sendPushToTokens, makeSendPushToUser, makeSendPushToAll };
