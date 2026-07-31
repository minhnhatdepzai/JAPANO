// Tạo notification trong state — cá nhân nếu có userId (chỉ user đó thấy),
// chung nếu không (mọi người thấy). Tách khỏi việc gửi push thật (lib/push.js)
// vì hàm này chạy đồng bộ bên trong update(), còn gửi push là async — route
// gọi hàm này để lưu, rồi tự gọi sendPushToUser/sendPushToAll sau khi update() xong.
function pushNotification(state, { userId, title, body, type = 'Hệ thống', action } = {}) {
  state.notifications ||= [];
  const notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: userId ? String(userId) : null,
    title: String(title || '').slice(0, 200),
    body: String(body || '').slice(0, 500),
    type,
    action: action || undefined,
    reach: userId ? 1 : (state.users || []).length,
    at: Date.now(),
  };
  state.notifications.push(notification);
  // Giữ tối đa 2000 dòng gần nhất — tránh phình vô hạn trong state.
  if (state.notifications.length > 2000) state.notifications = state.notifications.slice(-2000);
  return notification;
}

module.exports = { pushNotification };
