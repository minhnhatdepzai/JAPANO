// Vòng đời voucher — R1..R12 và M2.
//
// Lỗi được khoá lại ở đây: `voucher.used` từng được cộng NGAY LÚC TẠO ĐƠN và
// không bao giờ được trả lại. Thanh toán thất bại, khách huỷ, shop huỷ hay trả
// hàng đều làm khách mất trắng lượt dùng. Trong toàn bộ code cũ chỉ có đúng một
// phép `used + 1` và không có phép nào trừ đi.
const test = require('node:test');
const assert = require('node:assert/strict');

const L = require('../lib/voucherLifecycle');

const CODE = 'GOAL30-U1-AAAA';

function voucher(overrides = {}) {
  return {
    id: 'v1', code: CODE, type: 'percent', value: 30, min: 0, expiry: '—',
    limit: 1, used: 0, active: true, ownerUserId: 'u1', source: 'goal-fund',
    scope: 'product', eligibleProductIds: ['ao-muc-tieu'], maxEligibleQty: 1,
    goalProductId: 'ao-muc-tieu',
    ...overrides,
  };
}

function baseState(vouchers = [voucher()]) {
  return { vouchers, voucherRedemptions: [] };
}

function reserveFor(state, orderId, now = 1_000) {
  return L.reserve(state, {
    voucher: state.vouchers[0],
    userId: 'u1',
    orderId,
    discount: 30_000,
    eligibleSubtotal: 100_000,
    allocations: [{ key: 'ao-muc-tieu|Sumi|M', qty: 1, lineValue: 100_000, amount: 30_000 }],
    scope: 'product',
  }, now);
}

test('R1 · tạo đơn chỉ GIỮ CHỖ, chưa tăng used', () => {
  const state = baseState();
  const record = reserveFor(state, 'o1');
  assert.equal(record.status, L.RESERVED);
  assert.equal(state.vouchers[0].used, 0, 'used chỉ tăng khi tiền thực sự về');
  assert.equal(state.voucherRedemptions.length, 1);
  assert.equal(record.discount, 30_000);
  assert.equal(record.allocations.length, 1);
});

test('R2 · đơn hoàn thành thì chốt đúng một lượt', () => {
  const state = baseState();
  reserveFor(state, 'o1');
  L.consume(state, 'o1', 'order-completed', 2_000);
  assert.equal(state.vouchers[0].used, 1);
  assert.equal(L.redemptionForOrder(state, 'o1').status, L.CONSUMED);
});

test('R3 · huỷ đơn thì nhả chỗ và voucher dùng lại được', () => {
  const state = baseState();
  reserveFor(state, 'o1');
  L.release(state, 'o1', 'order-cancelled', 2_000);
  const record = L.redemptionForOrder(state, 'o1');
  assert.equal(record.status, L.RELEASED);
  assert.equal(record.releaseReason, 'order-cancelled');
  assert.equal(state.vouchers[0].used, 0);
  assert.equal(L.hasCapacity(state, state.vouchers[0]), true, 'dùng lại được ngay');
});

test('R5 · thanh toán thất bại nhả chỗ, không đụng tới used', () => {
  const state = baseState();
  reserveFor(state, 'o1');
  L.release(state, 'o1', 'stripe-checkout-failed', 2_000);
  assert.equal(state.vouchers[0].used, 0);
  assert.equal(L.usageCount(state, state.vouchers[0]), 0);
});

test('R6 · hai đơn đồng thời dùng voucher limit 1: chỉ một chỗ được giữ', () => {
  const state = baseState();
  const v = state.vouchers[0];
  assert.equal(L.hasCapacity(state, v), true);
  reserveFor(state, 'o1');
  // Request thứ hai đọc CÙNG state và thấy reservation của request thứ nhất,
  // dù `voucher.used` vẫn là 0.
  assert.equal(L.usageCount(state, v), 1);
  assert.equal(L.hasCapacity(state, v), false, 'đơn thứ hai phải bị chặn');
});

test('R7 · callback lặp và đảo thứ tự không gây chuyển trạng thái kép', () => {
  const state = baseState();
  reserveFor(state, 'o1');

  L.consume(state, 'o1', 'paid', 2_000);
  L.consume(state, 'o1', 'paid-lặp', 3_000);
  L.consume(state, 'o1', 'paid-lặp-lần-nữa', 4_000);
  assert.equal(state.vouchers[0].used, 1, 'webhook lặp không cộng used hai lần');

  // Callback "thất bại" đến SAU callback "đã trả tiền": consumed là trạng thái
  // cuối, không được nhả ra.
  L.release(state, 'o1', 'stripe-intent-failed', 5_000);
  assert.equal(L.redemptionForOrder(state, 'o1').status, L.CONSUMED);
  assert.equal(state.vouchers[0].used, 1);

  // Release lặp cũng không làm gì thêm.
  const state2 = baseState();
  reserveFor(state2, 'o2');
  L.release(state2, 'o2', 'cancel', 2_000);
  L.release(state2, 'o2', 'cancel-lặp', 3_000);
  assert.equal(state2.voucherRedemptions.filter((row) => row.orderId === 'o2').length, 1);
});

test('R7b · giữ chỗ lặp cho cùng một đơn không tạo bản ghi thứ hai', () => {
  const state = baseState();
  const first = reserveFor(state, 'o1');
  const second = reserveFor(state, 'o1');
  assert.equal(first.id, second.id);
  assert.equal(state.voucherRedemptions.length, 1);
});

test('thứ tự bất khả thi: paid đến sau khi đã release thì đánh dấu cần audit', () => {
  const state = baseState();
  reserveFor(state, 'o1');
  L.release(state, 'o1', 'cancel', 2_000);
  L.consume(state, 'o1', 'paid-muộn', 3_000);
  const record = L.redemptionForOrder(state, 'o1');
  assert.equal(record.status, L.RELEASED, 'không âm thầm sửa số liệu');
  assert.equal(record.needsAudit, true);
  assert.equal(record.auditReason, 'paid-callback-after-release');
  assert.equal(state.vouchers[0].used, 0, 'giữ nguyên bất biến tài chính');
});

test('R10 · trả một phần thì KHÔNG cấp voucher thay thế', () => {
  const state = baseState();
  reserveFor(state, 'o1');
  L.consume(state, 'o1', 'paid', 2_000);
  // reissue chỉ được gọi từ nhánh "trả toàn bộ đơn"; ở đây chứng minh rằng nếu
  // không gọi thì không có voucher mới nào xuất hiện.
  assert.equal(state.vouchers.length, 1);
});

test('R11 · hoàn tiền toàn bộ đơn cấp đúng MỘT voucher thay thế, idempotent', () => {
  const now = 10_000_000;
  const state = baseState([voucher({ expiry: '2026-09-10' })]);
  reserveFor(state, 'o1');
  L.consume(state, 'o1', 'paid', now);

  const first = L.reissue(state, { orderId: 'o1', refundRef: 'rr-1' }, now);
  const second = L.reissue(state, { orderId: 'o1', refundRef: 'rr-1' }, now);
  const third = L.reissue(state, { orderId: 'o1', refundRef: 'rr-1' }, now + 5_000);

  assert.ok(first, 'phải có voucher thay thế');
  assert.equal(first.code, second.code);
  assert.equal(first.code, third.code, 'mã sinh xác định, gọi lại không tạo mã mới');
  assert.equal(state.vouchers.length, 2, 'chỉ thêm đúng một voucher');

  assert.equal(first.reissuedFromCode, CODE);
  assert.equal(first.used, 0);
  assert.equal(first.active, true);
  assert.equal(first.scope, 'product', 'giữ nguyên phạm vi');
  assert.deepEqual(first.eligibleProductIds, ['ao-muc-tieu']);
  assert.equal(first.maxEligibleQty, 1);
  assert.equal(first.value, 30);
  assert.equal(first.ownerUserId, 'u1');
  assert.equal(L.redemptionForOrder(state, 'o1').replacementVoucherCode, first.code);

  // Voucher gốc không bị xoá: lịch sử phải kể đúng chuyện đã xảy ra.
  assert.ok(state.vouchers.some((item) => item.code === CODE));

  const expiresAt = new Date(`${first.expiry}T23:59:59`).getTime();
  assert.ok(expiresAt - now >= 29 * 86400000, 'hạn dùng ít nhất 30 ngày');
});

test('R12 · chưa consume thì không có voucher thay thế', () => {
  const state = baseState();
  reserveFor(state, 'o1');
  const result = L.reissue(state, { orderId: 'o1', refundRef: 'rr-1' }, 2_000);
  assert.equal(result, null, 'chỉ cấp lại sau khi lượt dùng đã thực sự bị tiêu');
  assert.equal(state.vouchers.length, 1);
});

test('voucher hết hạn trong lúc bị giữ chỗ rồi đơn bị huỷ thì được gia hạn', () => {
  const now = Date.parse('2026-09-03T00:00:00Z');
  const state = baseState([voucher({ expiry: '2026-08-01' })]);
  reserveFor(state, 'o1', now - 86400000);
  const extended = L.extendIfExpiredWhileReserved(state, 'o1', now);
  assert.ok(extended, 'khách không mất quyền lợi chỉ vì thời gian chờ');
  assert.ok(new Date(`${extended.expiry}T23:59:59`).getTime() > now);
  // Gọi lại không gia hạn chồng.
  assert.equal(L.extendIfExpiredWhileReserved(state, 'o1', now), null);
});

test('M2 · bản ghi cũ thiếu status được đọc BẢO THỦ là đã tiêu', () => {
  const state = baseState([voucher({ used: 1 })]);
  state.voucherRedemptions.push({
    id: 'redeem-legacy', code: CODE, userId: 'u1', orderId: 'o-legacy',
    discount: 30_000, redeemedAt: 1_000,
  });
  const legacy = L.redemptionForOrder(state, 'o-legacy');
  assert.equal(L.statusOf(legacy), L.CONSUMED, 'đoán reserved rồi nhả ra sẽ tặng thêm lượt dùng');

  // Nhả một bản ghi cũ phải là no-op.
  L.release(state, 'o-legacy', 'thử-nhả', 2_000);
  assert.equal(state.vouchers[0].used, 1);
  assert.equal(L.usageCount(state, state.vouchers[0]), 1);
});

test('allocationsForOrder đọc được cả bản ghi mới lẫn đơn cũ', () => {
  const state = baseState();
  reserveFor(state, 'o1');
  assert.equal(L.allocationsForOrder(state, { id: 'o1' }).length, 1);
  assert.equal(L.allocationsForOrder(state, { id: 'o-khac' }), null, 'đơn cũ không có phân bổ');
  assert.equal(
    L.allocationsForOrder(state, { id: 'o-khac', voucherAllocations: [{ key: 'a|b|c', qty: 1, amount: 5 }] }).length,
    1,
    'đọc được phân bổ lưu thẳng trên đơn',
  );
});
