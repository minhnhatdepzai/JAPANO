// Ba lớp kiểm tra bắt buộc của luồng "Đăng nhập bằng Google" (xem chú thích
// đầu lib/googleAuth.js). Test này không gọi mạng — nó nạp module với biến môi
// trường dựng sẵn và kiểm những nhánh từ chối, vì đó mới là phần dễ làm sai và
// nguy hiểm nhất.
const test = require('node:test');
const assert = require('node:assert/strict');

function loadFresh(env = {}) {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../lib/googleAuth')];
  const mod = require('../lib/googleAuth');
  return { mod, restore: () => { process.env = previous; delete require.cache[require.resolve('../lib/googleAuth')]; } };
}

test('chưa cấu hình client id thì tính năng tắt hẳn, không âm thầm cho qua', async () => {
  const { mod, restore } = loadFresh({
    GOOGLE_CLIENT_ID_ANDROID: '', GOOGLE_CLIENT_ID_IOS: '', GOOGLE_CLIENT_ID_WEB: '', GOOGLE_CLIENT_IDS: '',
  });
  try {
    assert.equal(mod.googleAuthEnabled(), false);
    await assert.rejects(
      () => mod.verifyGoogleToken({ idToken: 'bat-ky-thu-gi' }),
      (error) => error.status === 503,
      'phải từ chối rõ ràng thay vì coi như đăng nhập thành công',
    );
  } finally { restore(); }
});

test('gom đủ client id của mọi nền tảng làm audience hợp lệ', () => {
  const { mod, restore } = loadFresh({
    GOOGLE_CLIENT_ID_ANDROID: 'android.apps.googleusercontent.com',
    GOOGLE_CLIENT_ID_IOS: 'ios.apps.googleusercontent.com',
    GOOGLE_CLIENT_ID_WEB: 'web.apps.googleusercontent.com',
    GOOGLE_CLIENT_IDS: 'them-mot.apps.googleusercontent.com, ',
  });
  try {
    assert.deepEqual(mod.allowedAudiences(), [
      'android.apps.googleusercontent.com',
      'ios.apps.googleusercontent.com',
      'web.apps.googleusercontent.com',
      'them-mot.apps.googleusercontent.com',
    ]);
    assert.equal(mod.googleAuthEnabled(), true);
  } finally { restore(); }
});

test('không có token nào thì báo lỗi 400', async () => {
  const { mod, restore } = loadFresh({ GOOGLE_CLIENT_ID_ANDROID: 'android.apps.googleusercontent.com' });
  try {
    await assert.rejects(() => mod.verifyGoogleToken({}), (error) => error.status === 400);
  } finally { restore(); }
});

test('token rác bị từ chối 401, không lộ chi tiết nội bộ ra ngoài', async () => {
  const { mod, restore } = loadFresh({ GOOGLE_CLIENT_ID_ANDROID: 'android.apps.googleusercontent.com' });
  try {
    await assert.rejects(
      () => mod.verifyGoogleToken({ idToken: 'day.khong-phai.jwt' }),
      (error) => error.status === 401 && /Không xác minh được tài khoản Google/.test(error.message),
    );
  } finally { restore(); }
});

// --- Nối tài khoản: phần dễ gây mất dữ liệu khách nhất ---------------------
const { linkOrCreateGoogleUser } = require('../lib/googleAuth');

const profile = (over = {}) => ({
  googleId: '110000000000000000042', email: 'minh@gmail.com',
  emailVerified: true, name: 'Minh', picture: 'https://lh3.google/anh.jpg', ...over,
});

test('khách từng đăng ký bằng mật khẩu bấm Google -> NỐI vào tài khoản cũ, không tạo mới', () => {
  const state = { users: [{
    id: 'u1', name: 'Minh', email: 'minh@gmail.com', passwordHash: '$2b$10$cu',
    orders: 12, spent: 5_000_000, vip: 'VIP',
  }] };

  const { user, isNew } = linkOrCreateGoogleUser(state, profile());

  assert.equal(isNew, false);
  assert.equal(state.users.length, 1, 'tuyệt đối không được sinh tài khoản thứ hai');
  assert.equal(user.id, 'u1');
  assert.equal(user.orders, 12, 'lịch sử đơn hàng phải còn nguyên');
  assert.equal(user.spent, 5_000_000, 'chi tiêu tích luỹ phải còn nguyên');
  assert.equal(user.passwordHash, '$2b$10$cu', 'vẫn đăng nhập được bằng mật khẩu như cũ');
  assert.deepEqual(user.authProviders, ['password', 'google'], 'từ nay dùng được cả hai cách');
});

test('khớp theo googleId được ưu tiên — khách đổi email trong tài khoản Google vẫn vào đúng', () => {
  const state = { users: [
    { id: 'u1', name: 'Minh', email: 'email-cu@gmail.com', googleId: '110000000000000000042', orders: 3 },
    { id: 'u2', name: 'Người khác', email: 'minh@gmail.com' },
  ] };

  const { user, isNew } = linkOrCreateGoogleUser(state, profile());

  assert.equal(isNew, false);
  assert.equal(user.id, 'u1', 'phải theo googleId, không được nhảy sang tài khoản trùng email');
  assert.equal(state.users.length, 2);
});

test('khách hoàn toàn mới -> tạo tài khoản Google, không có mật khẩu', () => {
  const state = { users: [] };
  const { user, isNew } = linkOrCreateGoogleUser(state, profile());

  assert.equal(isNew, true);
  assert.equal(state.users.length, 1);
  assert.equal(user.email, 'minh@gmail.com');
  assert.equal(user.googleId, '110000000000000000042');
  assert.equal(user.role, 'customer', 'tài khoản mới luôn là khách hàng thường');
  assert.equal(user.passwordHash, undefined, 'chưa có mật khẩu cho tới khi khách tự đặt');
  assert.deepEqual(user.authProviders, ['google']);
});

test('đăng nhập Google lần hai không tạo thêm tài khoản', () => {
  const state = { users: [] };
  linkOrCreateGoogleUser(state, profile());
  const { isNew } = linkOrCreateGoogleUser(state, profile());
  assert.equal(isNew, false);
  assert.equal(state.users.length, 1);
});

test('không ghi đè tên/ảnh khách đã tự đặt', () => {
  const state = { users: [{ id: 'u1', email: 'minh@gmail.com', name: 'Tên tôi tự đặt', avatar: 'anh-cua-toi.jpg' }] };
  const { user } = linkOrCreateGoogleUser(state, profile());
  assert.equal(user.name, 'Tên tôi tự đặt');
  assert.equal(user.avatar, 'anh-cua-toi.jpg');
});
