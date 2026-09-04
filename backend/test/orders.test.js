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

// ---------------------------------------------------------------------------
// R1/R6/V1/V8 ở cấp ĐƯỜNG TẠO ĐƠN — không chỉ ở module vòng đời.
const L = require('../lib/voucherLifecycle');

function stateWithGoalVoucher() {
  const state = baseState();
  // Giá đặt sao cho SAU phụ thu theo size (M +10.000, L +20.000 — xem
  // lib/pricing.js) ra đúng 100.000₫ và 900.000₫, để con số trong bài đọc thẳng.
  state.products.push({
    id: 'p2', slug: 'quan-khac', name: 'Quần khác', price: 880000,
    variants: [{ colorName: 'Đen', size: 'L', stock: 5 }],
  });
  state.products[0].price = 90000;
  state.vouchers.push({
    id: 'v1', code: 'GOAL30-U1-AAAA', type: 'percent', value: 30, min: 0, expiry: '—',
    limit: 1, used: 0, active: true, ownerUserId: 'u1', source: 'goal-fund',
    scope: 'product', eligibleProductIds: ['ao-test'], maxEligibleQty: 1,
    goalId: 'goal-u1', goalProductId: 'ao-test',
  });
  return state;
}

test('R1 · tạo đơn COD chỉ giữ chỗ voucher, chưa tăng used', () => {
  const state = stateWithGoalVoucher();
  const result = create(state, {
    userId: 'u1', voucherCode: 'GOAL30-U1-AAAA',
    items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 1 }],
  });
  assert.equal(state.vouchers[0].used, 0, 'used chỉ tăng khi tiền thực sự về');
  assert.equal(state.voucherRedemptions.length, 1);
  assert.equal(state.voucherRedemptions[0].status, 'reserved');
  assert.equal(result.order.voucherDiscount, 30000);
});

test('V1/V8 · đơn nhiều món: voucher mục tiêu chỉ giảm đúng món mục tiêu', () => {
  const state = stateWithGoalVoucher();
  const result = create(state, {
    userId: 'u1', voucherCode: 'GOAL30-U1-AAAA',
    items: [
      { slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 1 },
      { slug: 'quan-khac', colorName: 'Đen', size: 'L', qty: 1 },
    ],
  });
  assert.equal(result.order.subtotal, 1000000);
  assert.equal(result.order.voucherDiscount, 30000, 'không phải 300.000₫');
  assert.equal(result.order.voucherScope, 'product');
  assert.equal(result.order.voucherEligibleSubtotal, 100000);
  assert.equal(result.order.voucherAllocations.length, 1);
  assert.equal(result.order.voucherAllocations[0].amount, 30000);
  // Đơn đã lưu và bản ghi giữ chỗ phải khớp nhau từng đồng.
  const record = L.redemptionForOrder(state, result.order.id);
  assert.equal(record.discount, result.order.voucherDiscount);
  assert.equal(
    record.allocations.reduce((sum, row) => sum + row.amount, 0),
    result.order.voucherDiscount,
  );
});

test('V4 · giá client gửi lên bị bỏ qua, backend tính lại từ catalog', () => {
  const state = stateWithGoalVoucher();
  const result = create(state, {
    userId: 'u1', voucherCode: 'GOAL30-U1-AAAA',
    items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 1, price: 99999999 }],
  });
  assert.equal(result.order.items[0].price, 100000);
  assert.equal(result.order.voucherDiscount, 30000);
});

test('V2 · voucher mục tiêu bị từ chối khi giỏ không có món mục tiêu', () => {
  const state = stateWithGoalVoucher();
  assert.throws(() => create(state, {
    userId: 'u1', voucherCode: 'GOAL30-U1-AAAA',
    items: [{ slug: 'quan-khac', colorName: 'Đen', size: 'L', qty: 1 }],
  }), /chưa có sản phẩm/i);
});

test('R6 · hai đơn liên tiếp dùng voucher limit 1: đơn thứ hai bị chặn', () => {
  const state = stateWithGoalVoucher();
  create(state, {
    userId: 'u1', voucherCode: 'GOAL30-U1-AAAA',
    items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 1 }],
  });
  // Chưa consume, `used` vẫn 0 — nhưng chỗ đã bị giữ nên đơn sau phải trượt.
  assert.equal(state.vouchers[0].used, 0);
  assert.throws(() => create(state, {
    userId: 'u1', voucherCode: 'GOAL30-U1-AAAA',
    items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 1 }],
  }), /hết lượt sử dụng/i);
});

test('R2/R3 · chốt rồi nhả trên cùng một đơn: chỉ một lượt được tính', () => {
  const state = stateWithGoalVoucher();
  const { order } = create(state, {
    userId: 'u1', voucherCode: 'GOAL30-U1-AAAA',
    items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 1 }],
  });
  L.consume(state, order.id, 'order-completed');
  assert.equal(state.vouchers[0].used, 1);
  L.release(state, order.id, 'huỷ-muộn');
  assert.equal(state.vouchers[0].used, 1, 'đã tiêu là trạng thái cuối');
});

test('đơn không dùng voucher không tạo bản ghi đổi nào', () => {
  const state = stateWithGoalVoucher();
  create(state, { userId: 'u1', items: [{ slug: 'ao-test', colorName: 'Đỏ', size: 'M', qty: 1 }] });
  assert.equal(state.voucherRedemptions.length, 0);
});
