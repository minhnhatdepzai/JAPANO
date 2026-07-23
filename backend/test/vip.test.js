const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VIP_CONFIG,
  deriveVipMemberships,
  vipStatus,
  vipQualifyingSpend,
  vipDiscountForSelection,
  reconcileVipState,
} = require('../lib/vip');

const at = (year, month, day, hour = 10) => new Date(year, month - 1, day, hour).getTime();

function paidOrder(id, userId, subtotal, paidAt, extra = {}) {
  return {
    id,
    userId,
    customer: { id: userId, name: userId },
    subtotal,
    discount: 0,
    ship: 30_000,
    total: subtotal + 30_000,
    status: 'confirmed',
    payment: { method: 'Stripe', status: 'paid' },
    history: [{ s: 'paid', at: paidAt }],
    createdAt: paidAt - 60_000,
    ...extra,
  };
}

function baseState(orders = []) {
  return { users: [{ id: 'customer-1', role: 'customer', name: 'Khách VIP' }], orders };
}

test('cộng nhiều đơn trong cùng tháng và kích hoạt đúng khi chạm 5 triệu', () => {
  const firstAt = at(2026, 7, 5);
  const crossingAt = at(2026, 7, 20);
  const state = baseState([
    paidOrder('o1', 'customer-1', 2_400_000, firstAt),
    paidOrder('o2', 'customer-1', 2_599_999, crossingAt),
  ]);
  assert.equal(vipStatus(state, 'customer-1', crossingAt + 1).isVip, false);

  state.orders.push(paidOrder('o3', 'customer-1', 1, crossingAt + 1_000));
  const status = vipStatus(state, 'customer-1', crossingAt + 2_000);
  assert.equal(status.isVip, true);
  assert.equal(status.currentMonth.spend, VIP_CONFIG.monthlySpendThreshold);
  assert.equal(status.startedAt, crossingAt + 1_000);
  assert.equal(status.expiresAt, crossingAt + 1_000 + 30 * 86_400_000);
});

test('không cộng đơn tháng khác, chưa trả, bị huỷ hoặc hoàn toàn bộ', () => {
  const now = at(2026, 7, 25);
  const orders = [
    paidOrder('june', 'customer-1', 4_900_000, at(2026, 6, 30)),
    paidOrder('july', 'customer-1', 1_000_000, at(2026, 7, 2)),
    paidOrder('cancelled', 'customer-1', 5_000_000, at(2026, 7, 3), { status: 'cancelled' }),
    paidOrder('refunded', 'customer-1', 5_000_000, at(2026, 7, 4), { status: 'returned', payment: { status: 'refunded' } }),
    { ...paidOrder('pending', 'customer-1', 5_000_000, at(2026, 7, 5)), status: 'pending', payment: { method: 'COD', status: 'unpaid' } },
  ];
  const status = vipStatus(baseState(orders), 'customer-1', now);
  assert.equal(status.isVip, false);
  assert.equal(status.currentMonth.spend, 1_000_000);
  assert.equal(status.currentMonth.remaining, 4_000_000);
});

test('đơn hoàn một phần chỉ tính tiền hàng thực giữ lại', () => {
  const order = paidOrder('partial', 'customer-1', 5_500_000, at(2026, 7, 4), {
    payment: { method: 'Stripe', status: 'partially_refunded', refundedAmount: 700_000 },
  });
  assert.equal(vipQualifyingSpend(order), 4_800_000);
  assert.equal(vipStatus(baseState([order]), 'customer-1', at(2026, 7, 5)).isVip, false);
});

test('VIP hết hiệu lực đúng biên 30 ngày và nhân viên không được cấp VIP', () => {
  const startedAt = at(2026, 7, 1);
  const state = baseState([paidOrder('qualified', 'customer-1', 5_000_000, startedAt)]);
  const expiresAt = startedAt + 30 * 86_400_000;
  assert.equal(vipStatus(state, 'customer-1', expiresAt - 1).isVip, true);
  assert.equal(vipStatus(state, 'customer-1', expiresAt).isVip, false);

  state.users.push({ id: 'staff-1', role: 'staff' });
  state.orders.push(paidOrder('staff-order', 'staff-1', 9_000_000, startedAt));
  assert.equal(deriveVipMemberships(state, startedAt + 1).some((item) => item.userId === 'staff-1'), false);
});

test('ưu đãi VIP giảm 10% đúng một đơn vị của dòng khách chọn', () => {
  const qualifiedAt = at(2026, 7, 2);
  const state = baseState([paidOrder('qualified', 'customer-1', 5_000_000, qualifiedAt)]);
  const items = [
    { slug: 'kimono-hong', productId: 'kimono-hong', name: 'Kimono', colorName: 'Shu', size: 'M', qty: 3, price: 1_890_000 },
    { slug: 'mu-nhat', productId: 'mu-nhat', name: 'Mũ Nhật', colorName: 'Sumi', size: 'M', qty: 2, price: 280_000 },
  ];
  const result = vipDiscountForSelection(state, {
    userId: 'customer-1', items, now: qualifiedAt + 1,
    selection: { slug: 'kimono-hong', colorName: 'Shu', size: 'M' },
  });
  assert.equal(result.discount, 189_000);
  assert.equal(result.promotion.discountedUnits, 1);
  assert.equal(result.promotion.productId, 'kimono-hong');
});

test('server từ chối chọn sản phẩm ngoài giỏ hoặc dùng quyền khi chưa VIP', () => {
  const qualifiedAt = at(2026, 7, 2);
  const items = [{ slug: 'mu-nhat', productId: 'mu-nhat', name: 'Mũ Nhật', qty: 1, price: 280_000 }];
  const qualified = baseState([paidOrder('qualified', 'customer-1', 5_000_000, qualifiedAt)]);
  assert.throws(() => vipDiscountForSelection(qualified, {
    userId: 'customer-1', items, productId: 'khong-trong-gio', now: qualifiedAt + 1,
  }), /không nằm trong giỏ/);
  assert.throws(() => vipDiscountForSelection(baseState([]), {
    userId: 'customer-1', items, productId: 'mu-nhat', now: qualifiedAt + 1,
  }), /chưa đạt/);
});

test('reconcile cập nhật hạng, chi tiêu và membership cho trang quản trị', () => {
  const now = at(2026, 7, 8);
  const state = baseState([paidOrder('qualified', 'customer-1', 5_000_000, now - 1_000)]);
  reconcileVipState(state, now);
  assert.equal(state.vipMemberships.length, 1);
  assert.equal(state.users[0].vip, 'VIP');
  assert.equal(state.users[0].vipMembership.isVip, true);
  assert.equal(state.users[0].spent, 5_000_000);
});
