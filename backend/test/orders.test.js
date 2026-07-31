const test = require('node:test');
const assert = require('node:assert/strict');

const { httpError } = require('../lib/httpError');
const { vipStatus, vipDiscountForSelection } = require('../lib/vip');
const { validateVoucher, awardFlagcardForOrder } = require('../lib/flagcards');
const { pushNotification } = require('../lib/notify');
const {
  makeCreateOrderInState, normalizedOrderItems, findVariant,
} = require('../routes/orders');

function baseState() {
  return {
    products: [{
      id: 'p1',
      slug: 'ao-test',
      name: 'Áo test',
      price: 100000,
      variants: [
        { colorName: 'Đỏ', size: 'M', stock: 2 },
        { colorName: 'Đỏ', size: 'L', stock: 0 },
      ],
    }],
    orders: [],
    users: [],
    vouchers: [],
    voucherRedemptions: [],
    shop: { shipFee: 30000 },
    flagcardConfig: {
      active: true, qualifyingOrderMin: 5000000, requiredCards: 7,
      rewardPercent: 50, rewardVoucherMinOrder: 0, rewardValidityDays: 90,
    },
  };
}

function create(state, body, options) {
  const fn = makeCreateOrderInState({ httpError, validateVoucher, vipDiscountForSelection, vipStatus, awardFlagcardForOrder, pushNotification });
  return fn(state, body, options);
}

test('tạo đơn thành công trừ đúng số lượng vào kho biến thể', () => {
  const state = baseState();
  const result = create(state, { userId: 'u1', items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 2 }] });
  assert.equal(result.order.items[0].qty, 2);
  assert.equal(state.products[0].variants[0].stock, 0);
});

test('đặt vượt quá tồn kho biến thể bị chặn với lỗi 409 rõ ràng', () => {
  const state = baseState();
  assert.throws(
    () => create(state, { userId: 'u1', items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 5 }] }),
    (error) => error.status === 409 && /chỉ còn 2/.test(error.message),
  );
  // Đơn bị từ chối thì không được tạo và không được trừ kho.
  assert.equal(state.orders.length, 0);
  assert.equal(state.products[0].variants[0].stock, 2);
});

test('biến thể hết hàng (stock 0) không cho đặt dù chỉ 1 sản phẩm', () => {
  const state = baseState();
  assert.throws(
    () => create(state, { userId: 'u1', items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'L', qty: 1 }] }),
    /chỉ còn 0/,
  );
});

test('cùng clientRequestId không tạo đơn trùng và không trừ kho hai lần', () => {
  const state = baseState();
  const first = create(state, { userId: 'u1', clientRequestId: 'req-1', items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 1 }] });
  const second = create(state, { userId: 'u1', clientRequestId: 'req-1', items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 1 }] });
  assert.equal(second.order.id, first.order.id);
  assert.equal(second.duplicate, true);
  assert.equal(state.orders.length, 1);
  assert.equal(state.products[0].variants[0].stock, 1);
});

test('sản phẩm không khai báo variants thì bỏ qua kiểm tra tồn kho', () => {
  const state = baseState();
  state.products.push({ id: 'p2', slug: 'phu-kien-cu', name: 'Phụ kiện cũ', price: 50000 });
  const result = create(state, { userId: 'u1', items: [{ slug: 'phu-kien-cu', qty: 3 }] });
  assert.equal(result.order.items[0].qty, 3);
});

test('normalizedOrderItems giới hạn số lượng từ 1 đến 20', () => {
  const state = baseState();
  const items = normalizedOrderItems(state, [
    { slug: 'ao-test', qty: 999 },
    { slug: 'ao-test', qty: 0 },
    { slug: 'ao-test', qty: -5 },
  ]);
  assert.equal(items[0].qty, 20);
  assert.equal(items[1].qty, 1);
  assert.equal(items[2].qty, 1);
});

test('findVariant khớp theo size khi không tìm thấy đúng màu', () => {
  const product = { variants: [{ colorName: 'Xanh', size: 'M', stock: 4 }] };
  const variant = findVariant(product, 'Không tồn tại', 'M');
  assert.equal(variant.stock, 4);
});
