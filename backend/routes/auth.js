// Đăng ký/đăng nhập thật (bcrypt + JWT). Thay thế "auth cục bộ" cũ ở mobile
// (mobile/lib/auth.tsx trước đây chỉ lưu AsyncStorage, backend không xác thực).
const { hashPassword, verifyPassword, passwordStrength, signToken, requireAuth } = require('../lib/auth');
const { sendMail } = require('../lib/mailer');
const { googleAuthEnabled, verifyGoogleToken, linkOrCreateGoogleUser } = require('../lib/googleAuth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_CODE_TTL_MS = 30 * 60000;
// Số lần nhập sai mã trước khi mã bị huỷ hẳn.
const MAX_RESET_ATTEMPTS = 5;
// Khoảng cách tối thiểu giữa hai lần gửi mã cho CÙNG một email.
const RESEND_COOLDOWN_MS = 60_000;

const lastResetSentAt = new Map();
function resendDue(email) {
  const now = Date.now();
  const previous = lastResetSentAt.get(email) || 0;
  if (now - previous < RESEND_COOLDOWN_MS) return false;
  lastResetSentAt.set(email, now);
  return true;
}

function publicUser(user) {
  return {
    id: user.id, name: user.name, email: user.email,
    role: user.role || 'customer', vip: user.vip || 'Thành viên',
    avatar: user.avatar || null,
    // Để ứng dụng biết tài khoản này đăng nhập được bằng cách nào — tài khoản
    // tạo qua Google chưa có mật khẩu nên màn Cài đặt không nên mời đổi mật khẩu.
    authProviders: user.authProviders || (user.passwordHash ? ['password'] : []),
  };
}

function requireStrongPassword(password, httpError) {
  if (password.length < 8) throw httpError(400, 'Mật khẩu cần ít nhất 8 ký tự.');
  if (passwordStrength(password) === 'weak') {
    throw httpError(400, 'Mật khẩu quá yếu — hãy kết hợp chữ hoa, chữ thường, số hoặc ký tự đặc biệt, tránh mật khẩu quá phổ biến.');
  }
}

// Sau nhiều lớp proxy, req.ip có thể là IP của proxy chứ không phải của khách;
// X-Forwarded-For giữ IP gốc ở phần tử đầu tiên.
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || '';
}

// Mặc định gửi cảnh báo cho MỌI lần đăng nhập. Khi trình diễn liên tục thì đặt
// JAPANO_LOGIN_ALERT_MIN_INTERVAL_MS để gộp các lần đăng nhập sát nhau của cùng
// một tài khoản, tránh làm ngập hộp thư.
const LOGIN_ALERT_MIN_INTERVAL_MS = Number(process.env.JAPANO_LOGIN_ALERT_MIN_INTERVAL_MS || 0);
const lastLoginAlertAt = new Map();
function loginAlertDue(userId) {
  if (LOGIN_ALERT_MIN_INTERVAL_MS <= 0) return true;
  const now = Date.now();
  const previous = lastLoginAlertAt.get(String(userId)) || 0;
  if (now - previous < LOGIN_ALERT_MIN_INTERVAL_MS) return false;
  lastLoginAlertAt.set(String(userId), now);
  return true;
}

module.exports = function registerAuthRoutes(api, ctx) {
  const { read, update, httpError, sendLoginAlert, sendPasswordChangedAlert } = ctx;

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
    // Cảnh báo đăng nhập qua email — gửi nền, không await: máy chủ thư chậm
    // hay chết cũng không được làm khách phải chờ hay đăng nhập hỏng.
    if (sendLoginAlert && loginAlertDue(user.id)) {
      void sendLoginAlert(user, {
        ip: clientIp(req),
        userAgent: req.headers['user-agent'],
        at: Date.now(),
      });
    }
    res.json({ ok: true, token: signToken(user), user: publicUser(user) });
  });

  // Đăng nhập bằng Google. Ứng dụng chỉ chuyển tiếp token của Google; toàn bộ
  // việc xác minh nằm ở lib/googleAuth.js — không tin bất cứ trường nào do
  // client tự khai.
  api.post('/auth/google', async (req, res) => {
    try {
      const profile = await verifyGoogleToken({
        idToken: req.body?.idToken,
        accessToken: req.body?.accessToken,
      });

      let account;
      let isNew = false;
      update((state) => {
        const result = linkOrCreateGoogleUser(state, profile);
        account = result.user;
        isNew = result.isNew;
        return state;
      });

      if (String(account.status || 'active') !== 'active') {
        return res.status(403).json({ ok: false, message: 'Tài khoản đã bị khoá.' });
      }
      if (sendLoginAlert && loginAlertDue(account.id)) {
        void sendLoginAlert(account, { ip: clientIp(req), userAgent: req.headers['user-agent'], at: Date.now() });
      }
      res.json({ ok: true, isNew, token: signToken(account), user: publicUser(account) });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không đăng nhập được bằng Google.' });
    }
  });

  // Cho ứng dụng biết có nên hiện nút "Đăng nhập bằng Google" hay không.
  api.get('/auth/providers', (req, res) => {
    res.json({ ok: true, password: true, google: googleAuthEnabled() });
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
    const generic = {
      ok: true,
      message: 'Nếu email này đã đăng ký, chúng tôi đã gửi mã đặt lại mật khẩu — vui lòng kiểm tra hộp thư.',
      expiresInSeconds: RESET_CODE_TTL_MS / 1000,
      resendAfterSeconds: RESEND_COOLDOWN_MS / 1000,
    };
    if (!EMAIL_RE.test(email)) return res.json(generic);
    // Chống dội mã: giới hạn theo EMAIL, không chỉ theo IP như authLimiter.
    // Không có bước này thì một người có thể liên tục gửi mã tới hộp thư của
    // người khác để quấy rối, và mỗi lần lại vô hiệu hoá mã họ đang dùng.
    if (!resendDue(email)) return res.json(generic);
    try {
      let user;
      let code;
      update((state) => {
        user = (state.users || []).find((u) => String(u.email || '').toLowerCase() === email);
        if (!user) return state;
        code = String(Math.floor(100000 + Math.random() * 900000));
        // bcrypt thay cho sha256 trần: mã chỉ có 6 chữ số nên chỉ một triệu khả
        // năng — sha256 không muối thì dò hết trong vài giây nếu dữ liệu lọt ra
        // ngoài, tức là chiếm được tài khoản.
        user.resetCodeHash = hashPassword(code);
        user.resetCodeExpiresAt = Date.now() + RESET_CODE_TTL_MS;
        user.resetCodeAttempts = 0;
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
      let account = null;
      // QUAN TRỌNG: không được `throw` bên trong store.update(). Mutator ném lỗi
      // thì write() không chạy và MỌI thay đổi trong lượt đó bị vứt bỏ — kể cả
      // bộ đếm số lần nhập sai. Lần đầu viết hàm này tôi ném ngay tại chỗ, kết
      // quả là bộ đếm luôn đứng ở 1 và chống dò mã hoàn toàn vô tác dụng.
      // Vì vậy: ghi nhận kết quả vào biến, để update() ghi state xong, rồi mới ném.
      let outcome = 'invalid';
      let remaining = 0;
      update((state) => {
        const user = (state.users || []).find((u) => String(u.email || '').toLowerCase() === email);
        if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) { outcome = 'invalid'; return state; }
        if (Date.now() > Number(user.resetCodeExpiresAt)) { outcome = 'expired'; return state; }

        if (!verifyPassword(code, user.resetCodeHash)) {
          // Mã 6 số chỉ có một triệu khả năng; không giới hạn số lần thử thì dò
          // dần là ra, nên sai quá ngưỡng là huỷ mã luôn.
          const attempts = Number(user.resetCodeAttempts || 0) + 1;
          user.resetCodeAttempts = attempts;
          if (attempts >= MAX_RESET_ATTEMPTS) {
            delete user.resetCodeHash;
            delete user.resetCodeExpiresAt;
            delete user.resetCodeAttempts;
            outcome = 'locked';
          } else {
            outcome = 'wrong';
            remaining = MAX_RESET_ATTEMPTS - attempts;
          }
          return state;
        }

        user.passwordHash = hashPassword(newPassword);
        // Đổi mật khẩu xong thì tài khoản đăng nhập được bằng mật khẩu, kể cả
        // tài khoản trước đó chỉ có Google.
        user.authProviders = [...new Set([...(user.authProviders || []), 'password'])];
        delete user.resetCodeHash;
        delete user.resetCodeExpiresAt;
        delete user.resetCodeAttempts;
        updated = true;
        account = user;
        outcome = 'ok';
        return state;
      });

      if (outcome === 'invalid') throw httpError(400, 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
      if (outcome === 'expired') throw httpError(400, 'Mã đặt lại mật khẩu đã hết hạn, vui lòng yêu cầu mã mới.');
      if (outcome === 'locked') throw httpError(429, 'Bạn đã nhập sai mã quá nhiều lần. Mã này đã bị huỷ — hãy yêu cầu mã mới.');
      if (outcome === 'wrong') throw httpError(400, `Mã đặt lại mật khẩu không đúng. Còn ${remaining} lần thử.`);
      // Báo cho chủ tài khoản biết mật khẩu vừa bị đổi — nếu không phải họ làm
      // thì đây là tín hiệu duy nhất để kịp phản ứng.
      if (account && sendPasswordChangedAlert) {
        void sendPasswordChangedAlert(account, { ip: clientIp(req), userAgent: req.headers['user-agent'], at: Date.now() });
      }
      res.json({ ok: true, updated, message: 'Đã đặt lại mật khẩu — vui lòng đăng nhập lại.' });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không đặt lại được mật khẩu.' });
    }
  });
};
