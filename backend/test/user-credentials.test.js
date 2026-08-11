// Bảo vệ hai nửa của một lỗ hổng thật: hash mật khẩu từng bị GET /api/state và
// GET /api/admin/live trả về cho trang quản trị, rồi nằm lại trong localStorage
// của trình duyệt. Xem chú thích CREDENTIAL_FIELDS trong lib/store.js.
//
// Nửa thứ hai quan trọng không kém nửa thứ nhất: vì 'users' không nằm trong
// SERVER_MANAGED_FIELDS, trang quản trị vẫn gửi trả cả mảng users qua
// PUT /api/state. Nếu chỉ lọc chiều ra mà quên khôi phục ở chiều vào thì lần
// lưu kế tiếp sẽ xoá sạch mật khẩu của mọi người.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { scrubUsers, createStore } = require('../lib/store');

const HASH = '$2b$10$abcdefghijklmnopqrstuv';
const users = () => ([
  { id: 'u1', name: 'Minh', email: 'minh@japano.vn', role: 'customer', passwordHash: HASH, resetCodeHash: 'sha256-cua-ma-6-so', resetCodeExpiresAt: 123 },
  { id: 'u2', name: 'Lan', email: 'lan@japano.vn', role: 'admin', passwordHash: `${HASH}2`, googleId: '110000000000000000001' },
]);

function tempStore() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'japano-store-')), 'db.json');
  return createStore(file);
}

test('scrubUsers bóc sạch mọi trường xác thực trước khi rời máy chủ', () => {
  const safe = scrubUsers(users());
  for (const user of safe) {
    assert.equal(user.passwordHash, undefined, 'passwordHash không được lọt ra ngoài');
    assert.equal(user.resetCodeHash, undefined, 'resetCodeHash không được lọt ra ngoài');
    assert.equal(user.resetCodeExpiresAt, undefined, 'resetCodeExpiresAt không được lọt ra ngoài');
  }
  // Nhưng phần dữ liệu trang quản trị THẬT SỰ cần thì phải còn nguyên.
  assert.deepEqual(safe.map((u) => u.email), ['minh@japano.vn', 'lan@japano.vn']);
  assert.equal(safe[1].role, 'admin');
});

test('scrubUsers không sửa mảng gốc trong state', () => {
  const original = users();
  scrubUsers(original);
  assert.equal(original[0].passwordHash, HASH, 'state trên máy chủ phải giữ nguyên hash');
});

test('PUT /api/state từ trang quản trị KHÔNG xoá mật khẩu đã lưu', () => {
  const store = tempStore();
  store.write({ ...store.read(), users: users() });

  // Đúng những gì trang quản trị nhận được và gửi trả lại: users đã bị lọc.
  const asAdminSees = scrubUsers(store.read().users);
  assert.equal(asAdminSees[0].passwordHash, undefined);

  store.replaceFromAdmin({ users: asAdminSees.map((u) => ({ ...u, name: `${u.name} (đã sửa)` })) });

  const after = store.read().users;
  assert.equal(after[0].passwordHash, HASH, 'mật khẩu u1 phải được khôi phục từ dữ liệu máy chủ');
  assert.equal(after[1].passwordHash, `${HASH}2`, 'mật khẩu u2 phải được khôi phục từ dữ liệu máy chủ');
  assert.equal(after[0].resetCodeHash, 'sha256-cua-ma-6-so', 'mã đặt lại mật khẩu đang chờ phải còn hiệu lực');
  assert.equal(after[0].name, 'Minh (đã sửa)', 'các sửa đổi hợp lệ của quản trị viên vẫn phải được lưu');
});

test('googleId cũng được bảo vệ như mật khẩu', () => {
  const safe = scrubUsers(users());
  assert.equal(safe[1].googleId, undefined, 'googleId không được lọt ra trang quản trị');

  const store = tempStore();
  store.write({ ...store.read(), users: users() });
  // Kẻ tấn công chiếm phiên quản trị thử nối tài khoản admin sang Google của mình,
  // để rồi bấm "Đăng nhập bằng Google" là vào thẳng.
  store.replaceFromAdmin({ users: [{ id: 'u2', name: 'Lan', email: 'lan@japano.vn', googleId: 'google-cua-ke-tan-cong' }] });
  assert.equal(store.read().users[0].googleId, '110000000000000000001', 'googleId phía máy chủ mới là nguồn đúng duy nhất');
});

test('trang quản trị không thể tự đặt hash mật khẩu cho tài khoản có sẵn', () => {
  const store = tempStore();
  store.write({ ...store.read(), users: users() });

  // Kẻ tấn công chiếm được phiên quản trị thử ghi đè hash bằng mật khẩu chúng biết.
  store.replaceFromAdmin({ users: [{ id: 'u1', name: 'Minh', email: 'minh@japano.vn', passwordHash: '$2b$10$hash-cua-ke-tan-cong' }] });

  assert.equal(store.read().users[0].passwordHash, HASH, 'hash phía máy chủ mới là nguồn đúng duy nhất');
});

test('người dùng mới do quản trị viên tạo vẫn thêm được (chưa có hash)', () => {
  const store = tempStore();
  store.write({ ...store.read(), users: users() });

  store.replaceFromAdmin({ users: [...scrubUsers(store.read().users), { id: 'u3', name: 'Nam', email: 'nam@japano.vn', role: 'staff' }] });

  const after = store.read().users;
  assert.equal(after.length, 3);
  assert.equal(after[2].id, 'u3');
  assert.equal(after[2].passwordHash, undefined, 'tài khoản mới chưa có mật khẩu cho tới khi đặt qua luồng auth');
  assert.equal(after[0].passwordHash, HASH, 'người dùng cũ không bị ảnh hưởng');
});
