// Đăng ký/đăng nhập thật (bcrypt + JWT). Thay thế "auth cục bộ" cũ ở mobile
// (mobile/lib/auth.tsx trước đây chỉ lưu AsyncStorage, backend không xác thực).
const crypto = require('crypto');
const { hashPassword, verifyPassword, passwordStrength, signToken, requireAuth } = require('../lib/auth');
const { sendMail } = require('../lib/mailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_CODE_TTL_MS = 30 * 60000;

function publicUser(user) {
  return {
    id: user.id, name: user.name, email: user.email,
    role: user.role || 'customer', vip: user.vip || 'Thành viên',
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function requireStrongPassword(password, httpError) {
  if (password.length < 8) throw httpError(400, 'Mật khẩu cần ít nhất 8 ký tự.');
  if (passwordStrength(password) === 'weak') {
    throw httpError(400, 'Mật khẩu quá yếu — hãy kết hợp chữ hoa, chữ thường, số hoặc ký tự đặc biệt, tránh mật khẩu quá phổ biến.');
  }
}

module.exports = function registerAuthRoutes(api, ctx) {
  const { read, update, httpError } = ctx;

  api.post('/auth/register', (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!name) throw httpError(400, 'Thiếu họ tên.');
      if (!EMAIL_RE.test(email)) throw httpError(400, 'Email không hợp lệ.');
      requireStrongPassword(password, httpError);
      let created;
      update((state) => {
        state.users ||= [];
        if (state.users.some((u) => String(u.email || '').toLowerCase() === email)) {
          throw httpError(409, 'Email này đã được đăng ký.');
        }
        const now = Date.now();
        created = {
          id: `u-${now}-${Math.random().toString(36).slice(2, 8)}`,
          name, email, passwordHash: hashPassword(password),
          role: 'customer', status: 'active', orders: 0, spent: 0, tryons: 0,
          vip: 'Thành viên', joinedAt: now,
        };
        state.users.push(created);
        return state;
      });
      res.status(201).json({ ok: true, token: signToken(created), user: publicUser(created) });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không đăng ký được.' });
    }
  });

  api.post('/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = (read().users || []).find((u) => String(u.email || '').toLowerCase() === email);
    // Thông báo chung chung dù sai email hay sai mật khẩu — tránh lộ email nào đã đăng ký.
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ ok: false, message: 'Email hoặc mật khẩu không đúng.' });
    }
    if (String(user.status || 'active') !== 'active') {
      return res.status(403).json({ ok: false, message: 'Tài khoản đã bị khoá.' });
    }
    res.json({ ok: true, token: signToken(user), user: publicUser(user) });
  });

  api.get('/auth/me', requireAuth, (req, res) => {
    const user = (read().users || []).find((u) => String(u.id) === req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'Không tìm thấy tài khoản.' });
    res.json({ ok: true, user: publicUser(user) });
  });

  // Quên mật khẩu — gửi mã 6 số qua email (SMTP thật nếu có cấu hình, hoặc hộp
  // thư Ethereal sandbox nếu chưa). Luôn trả về thông báo chung chung dù email
  // có tồn tại hay không, tránh lộ danh sách email đã đăng ký.
  api.post('/auth/forgot-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const generic = { ok: true, message: 'Nếu email này đã đăng ký, chúng tôi đã gửi mã đặt lại mật khẩu — vui lòng kiểm tra hộp thư.' };
    if (!EMAIL_RE.test(email)) return res.json(generic);
    try {
      let user;
      let code;
      update((state) => {
        user = (state.users || []).find((u) => String(u.email || '').toLowerCase() === email);
        if (!user) return state;
        code = String(Math.floor(100000 + Math.random() * 900000));
        user.resetCodeHash = sha256(code);
        user.resetCodeExpiresAt = Date.now() + RESET_CODE_TTL_MS;
        return state;
      });
      if (!user) return res.json(generic);
      const mail = await sendMail({
        to: user.email,
        subject: 'JAPANO — Mã đặt lại mật khẩu',
        html: `<p>Xin chào ${user.name || ''},</p><p>Mã đặt lại mật khẩu của bạn là:</p><h2 style="letter-spacing:4px">${code}</h2><p>Mã có hiệu lực trong 30 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`,
        text: `Mã đặt lại mật khẩu JAPANO của bạn là ${code} (hiệu lực 30 phút).`,
      });
      res.json({ ...generic, ...(mail.sandbox ? { sandboxPreviewUrl: mail.previewUrl } : {}) });
    } catch (error) {
      res.json(generic);
    }
  });

  api.post('/auth/reset-password', (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const code = String(req.body?.code || '').trim();
      const newPassword = String(req.body?.newPassword || '');
      if (!EMAIL_RE.test(email) || !code) throw httpError(400, 'Thiếu email hoặc mã đặt lại mật khẩu.');
      requireStrongPassword(newPassword, httpError);
      let updated = false;
      update((state) => {
        const user = (state.users || []).find((u) => String(u.email || '').toLowerCase() === email);
        if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) throw httpError(400, 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
        if (Date.now() > Number(user.resetCodeExpiresAt)) throw httpError(400, 'Mã đặt lại mật khẩu đã hết hạn, vui lòng yêu cầu mã mới.');
        if (user.resetCodeHash !== sha256(code)) throw httpError(400, 'Mã đặt lại mật khẩu không đúng.');
        user.passwordHash = hashPassword(newPassword);
        delete user.resetCodeHash;
        delete user.resetCodeExpiresAt;
        updated = true;
        return state;
      });
      res.json({ ok: true, updated, message: 'Đã đặt lại mật khẩu — vui lòng đăng nhập lại.' });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không đặt lại được mật khẩu.' });
    }
  });
};
