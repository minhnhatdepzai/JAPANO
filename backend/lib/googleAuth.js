// Xác minh danh tính Google cho luồng "Đăng nhập bằng Google".
//
// Nguyên tắc bảo mật của file này — cả ba đều bắt buộc, thiếu một là thủng:
//   1. KIỂM CHỮ KÝ. Không bao giờ tin dữ liệu người dùng gửi lên (email, tên);
//      chỉ tin những gì Google đã ký. Client chỉ chuyển tiếp token, chưa từng
//      là nguồn sự thật.
//   2. KIỂM AUDIENCE (aud). Một ID token hợp lệ do Google cấp cho ỨNG DỤNG
//      KHÁC vẫn có chữ ký đúng. Không đối chiếu aud với client id của mình thì
//      bất kỳ ai có một app Google bất kỳ đều đăng nhập được vào JAPANO.
//   3. KIỂM email_verified. Việc nối tài khoản Google vào tài khoản mật khẩu
//      sẵn có dựa trên email; nếu email chưa được Google xác minh thì kẻ tấn
//      công tạo tài khoản mang email người khác là chiếm được tài khoản đó.
const { OAuth2Client } = require('google-auth-library');
const { fetchWithTimeout } = require('./httpFetch');
const { logger } = require('./logger');

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// Mỗi nền tảng có một OAuth client id riêng trong Google Cloud Console, nhưng
// tất cả đều là "khán giả" hợp lệ của cùng một backend.
function allowedAudiences() {
  return [
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_CLIENT_ID_IOS,
    process.env.GOOGLE_CLIENT_ID_WEB,
    ...String(process.env.GOOGLE_CLIENT_IDS || '').split(','),
  ].map((value) => String(value || '').trim()).filter(Boolean);
}

function googleAuthEnabled() {
  return allowedAudiences().length > 0;
}

const client = new OAuth2Client();

function normalizeProfile(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  return {
    googleId: String(payload.sub || payload.user_id || ''),
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: String(payload.name || '').trim() || (email ? email.split('@')[0] : ''),
    picture: String(payload.picture || ''),
  };
}

// Đường chính: ID token đã ký. google-auth-library tự lấy khoá công khai của
// Google, kiểm chữ ký, hạn dùng, issuer và audience.
async function verifyIdToken(idToken) {
  const ticket = await client.verifyIdToken({ idToken: String(idToken), audience: allowedAudiences() });
  return normalizeProfile(ticket.getPayload() || {});
}

// Đường dự phòng: một số cấu hình OAuth trên Android chỉ trả access token chứ
// không kèm ID token. Access token không tự mang chữ ký nên phải hỏi thẳng
// Google — và vẫn phải tự tay đối chiếu aud, vì tokeninfo sẵn lòng mô tả token
// của bất kỳ ứng dụng nào.
async function verifyAccessToken(accessToken) {
  const token = encodeURIComponent(String(accessToken));
  const infoResponse = await fetchWithTimeout(`${TOKENINFO_URL}?access_token=${token}`, {}, 8000);
  if (!infoResponse.ok) throw new Error('Google không chấp nhận access token này.');
  const info = await infoResponse.json();

  const audience = String(info.aud || info.azp || '');
  if (!allowedAudiences().includes(audience)) {
    throw new Error('Access token thuộc về một ứng dụng Google khác, không phải JAPANO.');
  }

  const profileResponse = await fetchWithTimeout(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 8000);
  if (!profileResponse.ok) throw new Error('Không lấy được hồ sơ Google.');
  const profile = await profileResponse.json();

  return normalizeProfile({ ...profile, email_verified: profile.email_verified ?? info.email_verified });
}

/**
 * Đổi token Google lấy hồ sơ đã được xác minh. Ném lỗi nếu token không hợp lệ,
 * sai audience, hoặc email chưa được Google xác minh.
 */
async function verifyGoogleToken({ idToken, accessToken } = {}) {
  if (!googleAuthEnabled()) {
    const error = new Error('Đăng nhập Google chưa được cấu hình trên máy chủ (thiếu GOOGLE_CLIENT_ID_*).');
    error.status = 503;
    throw error;
  }
  if (!idToken && !accessToken) {
    const error = new Error('Thiếu token Google.');
    error.status = 400;
    throw error;
  }

  let profile;
  try {
    profile = idToken ? await verifyIdToken(idToken) : await verifyAccessToken(accessToken);
  } catch (cause) {
    logger.warn({ err: cause }, 'Xác minh token Google thất bại.');
    const error = new Error('Không xác minh được tài khoản Google. Vui lòng thử đăng nhập lại.');
    error.status = 401;
    throw error;
  }

  if (!profile.email) {
    const error = new Error('Tài khoản Google này không chia sẻ địa chỉ email.');
    error.status = 400;
    throw error;
  }
  if (!profile.emailVerified) {
    const error = new Error('Email của tài khoản Google này chưa được xác minh.');
    error.status = 403;
    throw error;
  }
  return profile;
}

/**
 * Tìm (hoặc tạo) tài khoản JAPANO ứng với một hồ sơ Google ĐÃ XÁC MINH.
 * Sửa `state` tại chỗ để gọi được bên trong store.update().
 *
 * Thứ tự tra cứu rất quan trọng:
 *   1. Theo googleId — nguồn đúng nhất, và không đổi kể cả khi khách đổi email
 *      trong tài khoản Google.
 *   2. Theo email — dành cho khách từng đăng ký bằng mật khẩu rồi giờ bấm
 *      "Đăng nhập bằng Google". Không có bước này thì họ bị tạo tài khoản thứ
 *      hai và mất sạch đơn hàng, voucher, hạng VIP đã tích luỹ.
 * Bước 2 chỉ an toàn vì verifyGoogleToken() đã chặn email chưa được xác minh.
 */
function linkOrCreateGoogleUser(state, profile) {
  state.users ||= [];
  const existing = state.users.find((user) => String(user.googleId || '') === profile.googleId)
    || state.users.find((user) => String(user.email || '').toLowerCase() === profile.email);

  if (existing) {
    existing.googleId = profile.googleId;
    existing.authProviders = [...new Set([...(existing.authProviders || (existing.passwordHash ? ['password'] : [])), 'google'])];
    if (!existing.avatar && profile.picture) existing.avatar = profile.picture;
    if (!existing.name && profile.name) existing.name = profile.name;
    return { user: existing, isNew: false };
  }

  const now = Date.now();
  // Tài khoản tạo qua Google KHÔNG có passwordHash, nên đăng nhập bằng mật khẩu
  // tự động trượt (verifyPassword trả false khi thiếu hash) cho tới khi khách
  // tự đặt mật khẩu qua luồng "Quên mật khẩu".
  const user = {
    id: `u-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: profile.name, email: profile.email,
    googleId: profile.googleId, authProviders: ['google'],
    avatar: profile.picture || undefined,
    role: 'customer', status: 'active', orders: 0, spent: 0, tryons: 0,
    vip: 'Thành viên', joinedAt: now,
  };
  state.users.push(user);
  return { user, isNew: true };
}

module.exports = { googleAuthEnabled, verifyGoogleToken, allowedAudiences, linkOrCreateGoogleUser };
