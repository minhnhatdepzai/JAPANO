// Đăng ký/huỷ token push (Expo) cho thiết bị — xem lib/push.js để gửi thật.
module.exports = function registerPushRoutes(api, ctx) {
  const { update, requireAuth } = ctx;

  api.post('/push/register', requireAuth, (req, res) => {
    const token = String(req.body?.token || '').trim();
    const platform = String(req.body?.platform || 'unknown');
    if (!token) return res.status(400).json({ ok: false, message: 'Thiếu push token.' });
    update((state) => {
      state.pushTokens = (state.pushTokens || []).filter((row) => row.token !== token);
      state.pushTokens.push({ userId: req.user.id, token, platform, createdAt: Date.now() });
      return state;
    });
    res.json({ ok: true });
  });

  api.post('/push/unregister', requireAuth, (req, res) => {
    const token = String(req.body?.token || '').trim();
    update((state) => {
      state.pushTokens = (state.pushTokens || []).filter((row) => !(row.token === token && row.userId === req.user.id));
      return state;
    });
    res.json({ ok: true });
  });
};
