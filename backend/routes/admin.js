// Quản lý vai trò/thông tin user (chỉ super_admin), voucher đền bù cá nhân do
// admin tự chọn mức giảm + lý do, và soạn thông báo chung/riêng cho khách —
// tách khỏi routes/health.js vì đây đều là thao tác "quyền lực" cần ghi rõ ai
// được phép làm gì.
const { pushNotification } = require('../lib/notify');

module.exports = function registerAdminRoutes(api, ctx) {
  const { update, httpError, requireSuperAdmin, requireAdmin, sendPushToUser, sendPushToAll } = ctx;

  const ALLOWED_ROLES = ['customer', 'staff', 'admin', 'super_admin'];

  // Super admin: thêm/hạ quyền admin khác, gán vai trò staff, sửa thông tin user.
  api.patch('/admin/users/:id', requireSuperAdmin, (req, res) => {
    try {
      let updated;
      update((state) => {
        const user = state.users.find((item) => String(item.id) === String(req.params.id));
        if (!user) throw httpError(404, 'Không tìm thấy người dùng.');
        const body = req.body || {};
        if (body.role !== undefined) {
          const role = String(body.role);
          if (!ALLOWED_ROLES.includes(role)) throw httpError(400, 'Vai trò không hợp lệ.');
          if (String(user.id) === String(req.user.id) && role !== 'super_admin') {
            throw httpError(400, 'Không thể tự hạ quyền của chính mình.');
          }
          user.role = role;
        }
        if (body.name !== undefined) {
          const name = String(body.name).trim().slice(0, 120);
          if (name) user.name = name;
        }
        if (body.email !== undefined) {
          const email = String(body.email).trim().toLowerCase();
          if (email) {
            if (state.users.some((item) => item.id !== user.id && String(item.email || '').toLowerCase() === email)) {
              throw httpError(409, 'Email này đã được dùng bởi tài khoản khác.');
            }
            user.email = email;
          }
        }
        if (body.status !== undefined) user.status = String(body.status);
        updated = user;
        return state;
      });
      res.json({ ok: true, user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, status: updated.status } });
    } catch (error) {
      res.status(error.status || 400).json({ ok: false, message: error.message || 'Không cập nhật được người dùng.' });
    }
  });

  // Voucher đền bù cá nhân — mức giảm và lý do đều do admin tự ghi (vd lỗi
  // hàng do bên shop). Chỉ 1 khách dùng được (ownerUserId khoá trong flagcards.validateVoucher).
  api.post('/admin/customers/:userId/voucher', requireAdmin, (req, res) => {
    try {
      const targetUserId = String(req.params.userId);
      const body = req.body || {};
      const type = body.type === 'amount' ? 'amount' : 'percent';
      const value = Math.max(0, Number(body.value) || 0);
      const reason = String(body.reason || '').trim();
      if (!value) throw httpError(400, 'Vui lòng nhập mức giảm giá.');
      if (type === 'percent' && value > 100) throw httpError(400, 'Giảm theo % tối đa 100.');
      if (!reason) throw httpError(400, 'Vui lòng ghi lý do cấp voucher.');
      let voucher;
      update((state) => {
        const user = state.users.find((item) => String(item.id) === targetUserId);
        if (!user) throw httpError(404, 'Không tìm thấy khách hàng.');
        const now = Date.now();
        voucher = {
          code: `COMP-${targetUserId.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()}-${now.toString(36).toUpperCase().slice(-4)}`,
          type,
          value,
          min: Math.max(0, Number(body.min) || 0),
          expiry: new Date(now + Math.max(1, Number(body.validDays) || 30) * 86400000).toISOString().slice(0, 10),
          limit: 1,
          used: 0,
          active: true,
          appliesTo: 'all-products',
          ownerUserId: targetUserId,
          source: 'admin-compensation',
          reason: reason.slice(0, 300),
          issuedBy: req.user.id,
          issuedAt: now,
        };
        state.vouchers ||= [];
        state.vouchers.push(voucher);
        const amountLabel = type === 'percent' ? `${value}%` : `${Number(value).toLocaleString('vi-VN')}đ`;
        pushNotification(state, {
          userId: targetUserId,
          title: 'Bạn vừa nhận một voucher từ JAPANO',
          body: `Mã ${voucher.code} — giảm ${amountLabel}. Lý do: ${reason}`,
          type: 'Khuyến mãi',
        });
        return state;
      });
      const amountLabel = type === 'percent' ? `${value}%` : `${Number(value).toLocaleString('vi-VN')}đ`;
      res.json({ ok: true, voucher });
      void sendPushToUser(targetUserId, { title: 'Bạn vừa nhận một voucher từ JAPANO', body: `Mã ${voucher.code} — giảm ${amountLabel}.`, data: { type: 'voucher' } });
    } catch (error) {
      res.status(error.status || 400).json({ ok: false, message: error.message || 'Không tạo được voucher.' });
    }
  });

  // Soạn thông báo: để trống userId → gửi chung cho tất cả; có userId → chỉ
  // riêng khách đó thấy (cả trong app lẫn push).
  api.post('/admin/notifications', requireAdmin, (req, res) => {
    try {
      const body = req.body || {};
      const title = String(body.title || '').trim();
      const text = String(body.body || '').trim();
      const targetUserId = body.userId ? String(body.userId) : null;
      if (!title || !text) throw httpError(400, 'Vui lòng nhập tiêu đề và nội dung thông báo.');
      let notification;
      update((state) => {
        if (targetUserId && !state.users.some((u) => String(u.id) === targetUserId)) {
          throw httpError(404, 'Không tìm thấy khách hàng để gửi riêng.');
        }
        notification = pushNotification(state, { userId: targetUserId, title, body: text, type: String(body.type || 'Hệ thống'), action: body.action || undefined });
        return state;
      });
      res.json({ ok: true, notification });
      if (targetUserId) void sendPushToUser(targetUserId, { title, body: text, data: { type: 'admin-notification' } });
      else void sendPushToAll({ title, body: text, data: { type: 'admin-notification' } });
    } catch (error) {
      res.status(error.status || 400).json({ ok: false, message: error.message || 'Không gửi được thông báo.' });
    }
  });
};
