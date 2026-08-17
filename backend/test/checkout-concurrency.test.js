// Kiểm thử tính nguyên tử của luồng đặt hàng khi có nhiều yêu cầu đồng thời.
//
// BỐI CẢNH KIẾN TRÚC
// Hệ thống không dùng transaction nhiều tài liệu của MongoDB. Thay vào đó toàn
// bộ state nằm trong MỘT object trong bộ nhớ; store.update(mutator) đọc – sửa –
// ghi trong một lượt ĐỒNG BỘ. Node.js chạy một luồng nên trong khoảng thời gian
// mutator chạy không có yêu cầu nào khác chen vào được. Đây chính là cơ sở để
// nói "kiểm tra tồn kho rồi trừ kho là một thao tác không thể tách rời".
//
// Bộ kiểm thử này chứng minh hai điều:
//   1. Nhiều lượt update() đồng thời không làm mất cập nhật (no lost update).
//   2. Kiểm-tra-rồi-trừ tồn kho không bao giờ bán vượt số lượng còn lại.
//   3. Mutator ném lỗi thì KHÔNG để lại thay đổi dở dang (all-or-nothing).
//
// GIỚI HẠN: tính chất này chỉ đúng trong PHẠM VI MỘT TIẾN TRÌNH. Nếu chạy nhiều
// bản sao máy chủ cùng ghi vào một cơ sở dữ liệu thì phải chuyển sang thao tác
// nguyên tử phía MongoDB (findOneAndUpdate với điều kiện tồn kho) hoặc transaction.
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

function tempStore(initial) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'japano-conc-')), 'db.json');
  const store = createStore(file);
  store.write({ ...emptyState(), ...initial });
  return store;
}

test('200 lượt update() đồng thời không làm mất một cập nhật nào', async () => {
  const store = tempStore({ shop: { ...emptyState().shop, shipFee: 0 } });
  const N = 200;
  await Promise.all(Array.from({ length: N }, () => Promise.resolve().then(() => {
    store.update((state) => {
      state.shop.shipFee = Number(state.shop.shipFee || 0) + 1;
      return state;
    });
  })));
  assert.equal(store.read().shop.shipFee, N,
    'mỗi lượt phải cộng đúng 1; thiếu tức là có lượt đọc trên bản state đã cũ');
});

test('kiểm-tra-rồi-trừ tồn kho không bán vượt số lượng còn lại', async () => {
  const STOCK = 5;
  const ATTEMPTS = 50;
  const store = tempStore({
    products: [{
      id: 'p-test', slug: 'ao-test', name: 'Áo kiểm thử', cat: 'ao-khoac',
      price: 100000, variants: [{ colorName: 'Đen', size: 'M', stock: STOCK }],
    }],
    categories: [{ id: 'ao-khoac', name: 'Áo khoác' }],
  });

  let granted = 0;
  let rejected = 0;
  await Promise.all(Array.from({ length: ATTEMPTS }, () => Promise.resolve().then(() => {
    try {
      store.update((state) => {
        const variant = state.products[0].variants[0];
        // Mô phỏng đúng thứ tự trong routes/orders.js: kiểm tra rồi mới trừ,
        // cả hai nằm trong CÙNG một mutator đồng bộ.
        if (Number(variant.stock) < 1) {
          const error = new Error('Hết hàng');
          error.status = 409;
          throw error;
        }
        variant.stock = Number(variant.stock) - 1;
        return state;
      });
      granted += 1;
    } catch {
      rejected += 1;
    }
  })));

  const remaining = store.read().products[0].variants[0].stock;
  assert.equal(granted, STOCK, `chỉ được bán đúng ${STOCK} suất, thực tế bán ${granted}`);
  assert.equal(rejected, ATTEMPTS - STOCK, 'số lượt bị từ chối phải bằng phần còn lại');
  assert.equal(remaining, 0, 'tồn kho phải về đúng 0');
  assert.ok(remaining >= 0, 'tồn kho không bao giờ được âm');
});

test('mutator ném lỗi giữa chừng không để lại thay đổi dở dang', () => {
  const store = tempStore({
    products: [{
      id: 'p-test', slug: 'ao-test', name: 'Áo kiểm thử', cat: 'ao-khoac',
      price: 100000, variants: [{ colorName: 'Đen', size: 'M', stock: 3 }],
    }],
    categories: [{ id: 'ao-khoac', name: 'Áo khoác' }],
  });

  assert.throws(() => store.update((state) => {
    state.products[0].variants[0].stock = 0;     // đã trừ kho
    throw new Error('thanh toán thất bại');       // rồi hỏng ở bước sau
  }), /thanh toán thất bại/);

  assert.equal(store.read().products[0].variants[0].stock, 3,
    'tồn kho phải giữ nguyên vì lượt ghi không bao giờ được thực hiện');
});

test('hoàn kho là thao tác chỉ có tác dụng một lần (idempotent)', () => {
  const { restockCancelledOrder } = require('../lib/inventory');
  const state = {
    ...emptyState(),
    products: [{
      id: 'p-test', slug: 'ao-test', name: 'Áo kiểm thử', cat: 'ao-khoac',
      price: 100000, variants: [{ colorName: 'Đen', size: 'M', stock: 0 }],
    }],
  };
  const order = { id: 'o1', items: [{ slug: 'ao-test', colorName: 'Đen', size: 'M', qty: 2 }] };

  restockCancelledOrder(state, order);
  assert.equal(state.products[0].variants[0].stock, 2, 'lần đầu phải cộng lại 2');

  restockCancelledOrder(state, order);
  restockCancelledOrder(state, order);
  assert.equal(state.products[0].variants[0].stock, 2,
    'gọi lại nhiều lần không được cộng thêm — chốt bằng order.stockRestoredAt');
});
