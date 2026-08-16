const test = require('node:test');
const assert = require('node:assert/strict');

const { httpError } = require('../lib/httpError');
const { addStock, restockCancelledOrder, restockReceivedReturn, restockRemainingOrderUnits } = require('../lib/inventory');
const { assertStockAvailable, decrementStock } = require('../routes/orders');

// Trước khi có lib/inventory.js, tồn kho chỉ đi một chiều: trừ lúc tạo đơn và
// không bao giờ cộng lại. Đo trên máy thật: huỷ đơn 2 sản phẩm mất luôn 2 sản
// phẩm, trả hàng + hoàn tiền xong vẫn mất 1. Bộ test này khoá lại cả hai chiều.
function baseState() {
  return {
    returnRequests: [],
    products: [{
      id: 'p1', slug: 'ao', name: 'Áo',
      variants: [
        { colorName: 'Đỏ', size: 'M', stock: 10 },
        { colorName: 'Đỏ', size: 'L', stock: 4 },
        { colorName: 'Xanh', size: 'M', stock: 6 },
      ],
    }],
    orders: [],
  };
}
const stockOf = (state, color, size) => state.products[0].variants.find((v) => v.colorName === color && v.size === size).stock;
const line = (qty, color = 'Đỏ', size = 'M') => ({ productId: 'ao', slug: 'ao', name: 'Áo', colorName: color, size, qty, price: 100000 });

test('huỷ đơn trả lại đúng số lượng đã giữ chỗ vào kho', () => {
  const state = baseState();
  const order = { id: 'o1', items: [line(2), line(1, 'Xanh')] };
  decrementStock(state, order.items);
  assert.equal(stockOf(state, 'Đỏ', 'M'), 8);
  assert.equal(stockOf(state, 'Xanh', 'M'), 5);

  restockCancelledOrder(state, order, 'cancel-approved');
  assert.equal(stockOf(state, 'Đỏ', 'M'), 10);
  assert.equal(stockOf(state, 'Xanh', 'M'), 6);
});

test('hoàn kho là idempotent — webhook lặp hay admin bấm hai lần không thổi phồng tồn kho', () => {
  const state = baseState();
  const order = { id: 'o1', items: [line(3)] };
  decrementStock(state, order.items);
  restockCancelledOrder(state, order, 'cancel-approved');
  restockCancelledOrder(state, order, 'stripe-checkout-failed');
  restockCancelledOrder(state, order, 'admin-cancelled-order');
  assert.equal(stockOf(state, 'Đỏ', 'M'), 10, 'chỉ được cộng đúng một lần');
});

test('cửa hàng nhận và kiểm hàng trả đạt thì hàng quay lại kho', () => {
  const state = baseState();
  const order = { id: 'o1', items: [line(2)] };
  decrementStock(state, order.items);
  const request = { id: 'ret-1', orderId: 'o1', kind: 'return', items: [line(1)] };
  state.returnRequests.push(request);

  restockReceivedReturn(state, request);
  assert.equal(stockOf(state, 'Đỏ', 'M'), 9, 'trả 1 trong 2 món thì chỉ cộng lại 1');
  restockReceivedReturn(state, request);
  assert.equal(stockOf(state, 'Đỏ', 'M'), 9, 'gọi lại không cộng thêm');
});

test('yêu cầu huỷ đơn không đi qua đường hoàn kho của trả hàng', () => {
  const state = baseState();
  const request = { id: 'ret-1', orderId: 'o1', kind: 'cancel', items: [line(2)] };
  assert.deepEqual(restockReceivedReturn(state, request), []);
  assert.equal(stockOf(state, 'Đỏ', 'M'), 10);
});

test('admin đánh dấu "đã trả hàng" chỉ cộng phần chưa từng được hoàn', () => {
  const state = baseState();
  const order = { id: 'o1', items: [line(3)] };
  decrementStock(state, order.items);
  assert.equal(stockOf(state, 'Đỏ', 'M'), 7);

  // Khách đã trả 1 món qua quy trình đổi/trả và cửa hàng đã nhận.
  const request = { id: 'ret-1', orderId: 'o1', kind: 'return', items: [line(1)] };
  state.returnRequests.push(request);
  restockReceivedReturn(state, request);
  assert.equal(stockOf(state, 'Đỏ', 'M'), 8);

  // Admin sau đó chốt cả đơn là "đã trả hàng": chỉ còn 2 món chưa hoàn.
  restockRemainingOrderUnits(state, order);
  assert.equal(stockOf(state, 'Đỏ', 'M'), 10, 'không được cộng trùng món đã hoàn ở bước trên');
});

test('không cộng kho cho biến thể không tồn tại', () => {
  const state = baseState();
  assert.deepEqual(addStock(state, [{ slug: 'khong-co', colorName: 'Đỏ', size: 'M', qty: 5 }]), []);
  assert.equal(stockOf(state, 'Đỏ', 'M'), 10);
});

// findVariant() cố ý lùi về "chỉ khớp size" cho sản phẩm một màu. Với tồn kho,
// sự dễ dãi đó từng cho phép đặt một màu không tồn tại và trừ kho của màu khác.
test('đặt màu hoặc kích cỡ không tồn tại bị từ chối thay vì trừ nhầm biến thể khác', () => {
  const state = baseState();
  assert.throws(
    () => assertStockAvailable(state, [line(1, 'Tím')], httpError),
    /không có màu/,
  );
  assert.throws(
    () => assertStockAvailable(state, [line(1, 'Đỏ', 'XXL')], httpError),
    /không có kích cỡ/,
  );
  assert.equal(stockOf(state, 'Đỏ', 'M'), 10, 'không biến thể nào bị đụng tới');
});

test('vẫn cho đặt sản phẩm một màu mà khách không gửi tên màu', () => {
  const state = baseState();
  state.products[0].variants = [{ colorName: 'Mặc định', size: 'M', stock: 5 }];
  assert.doesNotThrow(() => assertStockAvailable(state, [{ ...line(2), colorName: '' }], httpError));
});

// Phát hiện khi soi dữ liệu MongoDB thật: vài đơn cũ còn ghi màu "Mực" và
// "Sumi (mực)" — những tên đã được đổi thành "Sumi". findVariant() lùi về khớp
// theo size nên hoàn kho các đơn đó sẽ dồn số lượng sang một màu khác.
test('không cộng kho sang màu khác khi biến thể trên đơn cũ đã bị đổi tên', () => {
  const state = baseState();
  const before = stockOf(state, 'Đỏ', 'M');
  const restored = addStock(state, [{ slug: 'ao', colorName: 'Mực', size: 'M', qty: 3 }]);
  assert.deepEqual(restored, [], 'không được cộng cho biến thể không tồn tại');
  assert.equal(stockOf(state, 'Đỏ', 'M'), before, 'màu khác phải giữ nguyên tồn kho');
  assert.equal(addStock.lastSkipped.length, 1, 'phải ghi lại phần bị bỏ qua');
  assert.equal(addStock.lastSkipped[0].reason, 'biến thể không còn');
});

test('sản phẩm một màu vẫn hoàn kho được dù tên màu trên đơn khác', () => {
  const state = baseState();
  state.products[0].variants = [{ colorName: 'Mặc định', size: 'M', stock: 4 }];
  addStock(state, [{ slug: 'ao', colorName: 'Bất kỳ', size: 'M', qty: 2 }]);
  assert.equal(state.products[0].variants[0].stock, 6);
});
