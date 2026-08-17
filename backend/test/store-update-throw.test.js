// Khoá lại một cái bẫy đã cắn thật khi làm chống-dò-mã cho luồng quên mật khẩu.
//
// store.update(mutator) chỉ ghi state khi mutator TRẢ VỀ bình thường. Nếu mutator
// ném lỗi thì write() không bao giờ chạy, và MỌI thay đổi trong lượt đó biến mất.
//
// Hệ quả rất dễ mắc: vừa tăng bộ đếm số lần nhập sai vừa `throw` để báo lỗi cho
// client — bộ đếm không bao giờ được lưu, nên nó đứng yên ở 1 và cơ chế chống
// dò mã hoàn toàn vô tác dụng dù nhìn code thì tưởng là có.
//
// Cách đúng: ghi nhận kết quả vào biến, để update() ghi state xong, rồi mới ném
// lỗi bên ngoài (xem routes/auth.js — /auth/reset-password).
// Bài kiểm thử này thao tác trên store dạng TỆP. Nếu môi trường có MONGODB_URI
// thì createStore() sẽ chuyển sang MongoDB và bài kiểm thử treo chờ kết nối.
// Xoá biến môi trường trước khi nạp module để bài kiểm thử luôn độc lập môi trường.
delete process.env.MONGODB_URI;
delete process.env.MONGODB_DB;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../lib/store');
const { emptyState } = require('../seed');

function tempStore() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'japano-upd-')), 'db.json');
  const store = createStore(file);
  // Phải dựng trên emptyState(): nếu lấy state đã seed rồi thay mảng users thì
  // toàn bộ đơn hàng/giỏ hàng của bản seed trở thành tham chiếu mồ côi và
  // assertValid() sẽ chặn lượt ghi bằng lỗi INVALID_RELATIONSHIP.
  store.write({ ...emptyState(), users: [{ id: 'u1', email: 'a@b.vn', resetCodeAttempts: 0 }] });
  return store;
}

test('mutator NÉM LỖI thì mọi thay đổi trong lượt đó bị vứt bỏ', () => {
  const store = tempStore();
  assert.throws(() => store.update((state) => {
    state.users[0].resetCodeAttempts = 99;
    throw new Error('lỗi nghiệp vụ');
  }), /lỗi nghiệp vụ/);

  assert.equal(store.read().users[0].resetCodeAttempts, 0,
    'đây chính là cái bẫy: thay đổi trước khi throw KHÔNG được lưu');
});

test('mutator trả về bình thường thì thay đổi được lưu', () => {
  const store = tempStore();
  store.update((state) => { state.users[0].resetCodeAttempts = 3; return state; });
  assert.equal(store.read().users[0].resetCodeAttempts, 3);
});

test('mẫu đúng: ghi state trước, ném lỗi sau — bộ đếm vẫn tăng', () => {
  const store = tempStore();

  // Mô phỏng đúng cách routes/auth.js xử lý một lần nhập sai mã.
  const attemptWrongCode = () => {
    let outcome = 'ok';
    let remaining = 0;
    store.update((state) => {
      const user = state.users[0];
      const attempts = Number(user.resetCodeAttempts || 0) + 1;
      user.resetCodeAttempts = attempts;
      if (attempts >= 5) { delete user.resetCodeAttempts; outcome = 'locked'; }
      else { outcome = 'wrong'; remaining = 5 - attempts; }
      return state; // ghi state — KHÔNG ném ở đây
    });
    if (outcome === 'locked') { const e = new Error('locked'); e.status = 429; throw e; }
    if (outcome === 'wrong') { const e = new Error(`còn ${remaining}`); e.status = 400; throw e; }
  };

  const messages = [];
  for (let i = 0; i < 5; i += 1) {
    try { attemptWrongCode(); } catch (error) { messages.push(error.message); }
  }
  assert.deepEqual(messages, ['còn 4', 'còn 3', 'còn 2', 'còn 1', 'locked'],
    'bộ đếm phải giảm dần rồi khoá — không được đứng yên');
});
