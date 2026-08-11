// Auth thật: bcrypt hash mật khẩu + JWT ký/verify, thay cho "auth cục bộ" cũ
// (mobile chỉ lưu AsyncStorage, backend không hề biết ai đang gọi API).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logger } = require('./logger');

const isProd = process.env.NODE_ENV === 'production';
let secret = String(process.env.JWT_SECRET || '').trim();
if (!secret) {
  if (isProd) {
    throw new Error('JWT_SECRET chưa được cấu hình trong .env.server — bắt buộc trước khi chạy production.');
  }
  secret = crypto.randomBytes(32).toString('hex');
  logger.warn('JWT_SECRET chưa cấu hình — dùng secret ngẫu nhiên tạm cho dev (token mất hiệu lực khi restart). Đặt JWT_SECRET trong .env.server để cố định.');
}

const TOKEN_TTL = process.env.JWT_TTL || '30d';

function hashPassword(password) {
  return bcrypt.hashSync(String(password), 10);
}

// Cùng công thức chấm điểm với mobile/lib/passwordStrength.ts (thanh đo mạnh/yếu
// khi gõ) — giữ 2 bản đồng bộ tay vì backend/mobile không share code chung.
const COMMON_WEAK_PASSWORDS = new Set(['12345678', 'password', '11111111', 'qwerty123', '123456789', 'password1', 'abc12345', 'iloveyou', '87654321', 'letmein11']);
function passwordStrength(password) {
  const pw = String(password || '');
  if (COMMON_WEAK_PASSWORDS.has(pw.toLowerCase())) return 'weak';
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

function verifyPassword(password, hash) {
  if (!hash) return false;
  try {
    return bcrypt.compareSync(String(password), String(hash));
  } catch {
    return false;
  }
}

function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role || 'customer', email: user.email || '' }, secret, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  try {
    return jwt.verify(String(token || ''), secret);
  } catch {
    return null;
  }
}

function tokenFromHeader(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

// Bắt buộc phải có JWT hợp lệ; gắn req.user = { id, role, email }.
function requireAuth(req, res, next) {
  const payload = verifyToken(tokenFromHeader(req));
  if (!payload) return res.status(401).json({ ok: false, message: 'Bạn cần đăng nhập để tiếp tục.' });
  req.user = { id: payload.sub, role: payload.role, email: payload.email };
  next();
}

// Có token thì gắn req.user, không có/không hợp lệ vẫn cho qua với req.user=null
// (dùng cho các endpoint khách vãng lai vẫn được phép gọi).
function optionalAuth(req, res, next) {
  const payload = verifyToken(tokenFromHeader(req));
  req.user = payload ? { id: payload.sub, role: payload.role, email: payload.email } : null;
  next();
}

// Phân cấp vai trò: customer (khách mua hàng, mặc định) < staff (nhân viên —
// vào được trang admin nhưng chỉ thấy/sửa sản phẩm được gán cho mình) <
// admin (quản lý toàn bộ shop) < super_admin (như admin, cộng thêm quyền
// thêm/xoá tài khoản admin khác và đổi vai trò bất kỳ user nào).
const ROLE_RANK = { customer: 0, staff: 1, admin: 2, super_admin: 3 };
function roleAtLeast(role, min) {
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[min] ?? Infinity);
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!roleAtLeast(req.user?.role, 'admin')) return res.status(403).json({ ok: false, message: 'Chỉ quản trị viên mới thực hiện được thao tác này.' });
    next();
  });
}

function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!roleAtLeast(req.user?.role, 'super_admin')) return res.status(403).json({ ok: false, message: 'Chỉ super admin mới thực hiện được thao tác này.' });
    next();
  });
}

// Vào được trang admin (staff trở lên) nhưng KHÔNG tự động có toàn quyền —
// từng route con tự kiểm tra phạm vi (vd chỉ sản phẩm do chính staff đó tạo).
function requireStaff(req, res, next) {
  requireAuth(req, res, () => {
    if (!roleAtLeast(req.user?.role, 'staff')) return res.status(403).json({ ok: false, message: 'Tài khoản này chưa có quyền vào trang quản trị.' });
    next();
  });
}

// Chặn IDOR cho các endpoint nhận userId từ URL/query. Trước đây một số route
// (hồ sơ phong cách kèm chiều cao/cân nặng, wishlist, bộ sưu tập thẻ kèm mã
// voucher cá nhân, hạng VIP) tin thẳng userId do client gửi lên và không hề xác
// thực — chỉ cần đổi số trong URL là đọc/ghi được dữ liệu của người khác, mà
// các tài khoản seed lại mang id dễ đoán như 'u1', 'u2'.
//
// pickUserId nhận req và trả về userId mà lời gọi đang nhắm tới; nhân viên trở
// lên vẫn xem được dữ liệu khách hàng để hỗ trợ vận hành.
function requireSelfOrStaff(pickUserId) {
  return function guard(req, res, next) {
    requireAuth(req, res, () => {
      const target = String(pickUserId(req) || '').trim();
      if (!target) return res.status(400).json({ ok: false, message: 'Thiếu mã khách hàng.' });
      if (String(req.user.id) === target || roleAtLeast(req.user?.role, 'staff')) return next();
      res.status(403).json({ ok: false, message: 'Bạn chỉ xem được dữ liệu của chính mình.' });
    });
  };
}

// Chạy trong migration lúc boot: JAPANO_ADMIN_EMAIL/PASSWORD trong .env.server
// tạo (hoặc thăng hạng) đúng một tài khoản super_admin gốc. Không đụng mật
// khẩu đã có sẵn để không âm thầm ghi đè mật khẩu admin đã tự đổi.
function ensureAdminSeeded(state) {
  const email = String(process.env.JAPANO_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.JAPANO_ADMIN_PASSWORD || '');
  if (!email || !password) return;
  state.users ||= [];
  const existing = state.users.find((u) => String(u.email || '').toLowerCase() === email);
  if (existing) {
    existing.role = 'super_admin';
    if (!existing.passwordHash) existing.passwordHash = hashPassword(password);
    return;
  }
  state.users.push({
    id: `admin-${Date.now()}`,
    name: 'Quản trị viên JAPANO',
    email,
    passwordHash: hashPassword(password),
    role: 'super_admin',
    status: 'active',
    joinedAt: Date.now(),
  });
}

module.exports = {
  hashPassword, verifyPassword, passwordStrength, signToken, verifyToken, roleAtLeast, ROLE_RANK,
  requireAuth, optionalAuth, requireAdmin, requireSuperAdmin, requireStaff, requireSelfOrStaff,
  tokenFromHeader, ensureAdminSeeded,
};
