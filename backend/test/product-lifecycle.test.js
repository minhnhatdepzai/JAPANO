const test = require('node:test');
const assert = require('node:assert/strict');

const { hideProduct } = require('../lib/productLifecycle');

function stateWithProduct() {
  return {
    products: [{ id: 'p1', slug: 'kimono-do', name: 'Kimono đỏ', status: 'published', price: 990000 }],
    orders: [{ id: 'o1', items: [{ productId: 'p1', name: 'Kimono đỏ' }] }],
  };
}

test('ẩn sản phẩm giữ nguyên bản ghi và dữ liệu liên quan', () => {
  const state = stateWithProduct();
  const product = hideProduct(state, 'p1', 1788060000000);

  assert.equal(state.products.length, 1, 'không được xoá sản phẩm khỏi catalog quản trị');
  assert.equal(product, state.products[0], 'phải cập nhật đúng bản ghi hiện có');
  assert.equal(product.status, 'hidden');
  assert.equal(product.updatedAt, 1788060000000);
  assert.equal(product.name, 'Kimono đỏ');
  assert.equal(state.orders[0].items[0].productId, 'p1', 'lịch sử đơn hàng phải được giữ');
});

test('có thể ẩn bằng slug và thao tác lặp lại vẫn an toàn', () => {
  const state = stateWithProduct();
  hideProduct(state, 'kimono-do', 100);
  const product = hideProduct(state, 'kimono-do', 200);

  assert.equal(state.products.length, 1);
  assert.equal(product.status, 'hidden');
  assert.equal(product.updatedAt, 200);
});

test('ẩn sản phẩm không tồn tại không làm thay đổi catalog', () => {
  const state = stateWithProduct();
  assert.equal(hideProduct(state, 'khong-co'), null);
  assert.equal(state.products.length, 1);
  assert.equal(state.products[0].status, 'published');
});
