// Tương thích ngược và di trú — M1..M6.
//
// Nguyên tắc: boot KHÔNG tự viết lại dữ liệu production, bản ghi cũ được đọc
// bảo thủ, và mọi trường mới phải sống sót qua vòng ghi–đọc MongoDB.
const test = require('node:test');
const assert = require('node:assert/strict');

const { serializeState, NORMALIZED_COLLECTIONS } = require('../lib/mongoCollections');
const { audit, repair } = require('../scripts/auditVoucherRedemptions');
const { statusOf, CONSUMED, RELEASED } = require('../lib/voucherLifecycle');
const { emptyState } = require('../seed');

function stateWith(overrides = {}) {
  return { ...emptyState(), ...overrides };
}

test('M1 · mọi trường mới của voucher và bản ghi đổi sống sót qua vòng ghi Mongo', () => {
  const state = stateWith({
    vouchers: [{
      id: 'v1', code: 'GOAL30-U1-AAAA', type: 'percent', value: 30, min: 0,
      expiry: '2026-12-31', limit: 1, used: 1, active: true,
      ownerUserId: 'u1', source: 'goal-fund',
      scope: 'product', eligibleProductIds: ['ao-muc-tieu'], maxEligibleQty: 1,
      maxDiscountAmount: 30000, goalId: 'goal-u1', goalProductId: 'ao-muc-tieu',
      reissuedFromCode: 'GOAL30-U1-OLD',
    }],
    voucherRedemptions: [{
      id: 'redeem-o1', voucherId: 'v1', code: 'GOAL30-U1-AAAA', userId: 'u1', orderId: 'o1',
      status: 'consumed', discount: 30000, eligibleSubtotal: 100000,
      allocations: [{ key: 'ao-muc-tieu|Sumi|M', qty: 1, lineValue: 100000, amount: 30000 }],
      scope: 'product', reservedAt: 1000, consumedAt: 2000, releasedAt: null,
      releaseReason: null, replacementVoucherCode: 'GOAL30-U1-AAAA-RZZZZ',
      redeemedAt: 2000, history: [{ status: 'reserved', at: 1000 }, { status: 'consumed', at: 2000 }],
    }],
  });

  const collections = serializeState(state);
  const voucher = collections.get('vouchers').find((row) => row.code === 'GOAL30-U1-AAAA');
  assert.equal(voucher.scope, 'product');
  assert.deepEqual(voucher.eligibleProductIds, ['ao-muc-tieu']);
  assert.equal(voucher.maxEligibleQty, 1);
  assert.equal(voucher.maxDiscountAmount, 30000);
  assert.equal(voucher.reissuedFromCode, 'GOAL30-U1-OLD');

  const redemption = collections.get('voucher_redemptions')[0];
  assert.equal(redemption.status, 'consumed');
  assert.equal(redemption.eligibleSubtotal, 100000);
  assert.equal(redemption.allocations.length, 1);
  assert.equal(redemption.allocations[0].amount, 30000);
  assert.equal(redemption.reservedAt, 1000);
  assert.equal(redemption.consumedAt, 2000);
  assert.equal(redemption.replacementVoucherCode, 'GOAL30-U1-AAAA-RZZZZ');
  assert.equal(redemption.history.length, 2);

  // Không đẻ thêm collection nào: cổng ERD phải đứng yên.
  assert.equal(new Set(collections.keys()).size, new Set(NORMALIZED_COLLECTIONS).size);
});

test('M2 · bản ghi cũ thiếu status được audit đọc là đã tiêu, không tự giảm used', () => {
  const state = stateWith({
    vouchers: [{ id: 'v1', code: 'OLD10', type: 'percent', value: 10, limit: 5, used: 2, active: true }],
    voucherRedemptions: [
      { id: 'r1', code: 'OLD10', userId: 'u1', orderId: 'o1', discount: 1000, redeemedAt: 1 },
      { id: 'r2', code: 'OLD10', userId: 'u2', orderId: 'o2', discount: 1000, redeemedAt: 2 },
    ],
    orders: [
      { id: 'o1', status: 'completed', payment: { status: 'paid' } },
      { id: 'o2', status: 'completed', payment: { status: 'paid' } },
    ],
  });
  const report = audit(state);
  assert.equal(report.legacyWithoutStatus, 2);
  assert.equal(report.usedMismatch.length, 0, 'used=2 khớp với 2 bản ghi đọc là đã tiêu');
  assert.equal(report.releasableReservations.length, 0, 'không đề xuất nhả bản ghi cũ');
  assert.equal(statusOf(state.voucherRedemptions[0]), CONSUMED);
});

test('M4 · dry-run không ghi gì và báo cáo không chứa PII', () => {
  const state = stateWith({
    vouchers: [{ id: 'v1', code: 'X1', type: 'percent', value: 10, limit: 1, used: 0, active: true }],
    voucherRedemptions: [{
      id: 'r1', code: 'X1', userId: 'u-secret', orderId: 'o1', status: 'reserved',
      discount: 1000, reservedAt: 1,
    }],
    orders: [{
      id: 'o1', status: 'cancelled', payment: { status: 'failed' },
      customer: { name: 'Nguyễn Văn A', phone: '0900000000' },
      address: '123 đường bí mật',
    }],
  });
  const before = JSON.stringify(state);
  const report = audit(state);
  assert.equal(JSON.stringify(state), before, 'audit chỉ ĐỌC');
  assert.equal(report.releasableReservations.length, 1);

  const { printReport } = require('../scripts/auditVoucherRedemptions');
  const text = printReport(report, null);
  assert.match(text, /DRY-RUN/);
  assert.doesNotMatch(text, /Nguyễn Văn A|0900000000|đường bí mật/, 'không in PII');
});

test('M5 · vá chạy hai lần cho cùng kết quả (idempotent)', () => {
  const state = stateWith({
    vouchers: [{
      id: 'v1', code: 'GOAL30-U1-AAAA', type: 'percent', value: 30, limit: 1, used: 0,
      active: true, source: 'goal-fund', goalId: 'goal-u1', goalProductId: 'ao-muc-tieu',
    }],
    voucherRedemptions: [{
      id: 'r1', code: 'GOAL30-U1-AAAA', userId: 'u1', orderId: 'o1', status: 'reserved',
      discount: 30000, reservedAt: 1,
    }],
    orders: [{ id: 'o1', status: 'cancelled', payment: { status: 'failed' } }],
    goals: [{ id: 'goal-u1', userId: 'u1', productId: 'ao-muc-tieu', product: { price: 100000 } }],
  });

  const first = repair(state, audit(state), 5000);
  assert.equal(first.released, 1);
  assert.equal(statusOf(state.voucherRedemptions[0]), RELEASED);
  assert.equal(state.vouchers[0].scope, 'product');
  assert.deepEqual(state.vouchers[0].eligibleProductIds, ['ao-muc-tieu']);
  assert.equal(state.vouchers[0].maxDiscountAmount, 30000, 'trần theo giá đã khoá của mục tiêu');
  assert.equal(state.vouchers[0].maxEligibleQty, 1);
  const snapshot = JSON.stringify(state);

  const second = repair(state, audit(state), 6000);
  assert.equal(second.released, 0, 'lần hai không nhả thêm gì');
  assert.equal(JSON.stringify(state), snapshot, 'trạng thái không đổi khi chạy lại');
});

test('voucher goal mồ côi (mất bản ghi mục tiêu) vẫn bị giới hạn đúng sản phẩm', () => {
  const state = stateWith({
    vouchers: [{
      id: 'v1', code: 'GOAL30-U9-ZZZZ', type: 'percent', value: 30, limit: 1, used: 0,
      active: true, source: 'goal-fund', goalId: 'goal-đã-xoá', goalProductId: 'ao-muc-tieu',
    }],
    voucherRedemptions: [],
    orders: [],
    goals: [],
  });
  repair(state, audit(state), 5000);
  assert.equal(state.vouchers[0].scope, 'product');
  assert.deepEqual(state.vouchers[0].eligibleProductIds, ['ao-muc-tieu']);
  assert.equal(state.vouchers[0].maxEligibleQty, 1);
  // Không suy ra được giá đã khoá thì không có trần tiền — nhưng phạm vi sản
  // phẩm + tối đa một đơn vị vẫn chặn được thiệt hại toàn giỏ.
  assert.equal(state.vouchers[0].maxDiscountAmount, undefined);
});

// Lỗi thật đã xảy ra trong lúc phát triển: dry-run gọi store.initialize(), hàm
// này chuẩn hoá lược đồ rồi GHI LẠI, nên một lệnh "chỉ rà soát" đã sửa
// schemaVersion 6→8 và thêm trường mới vào db.json thật.
test('M4b · dry-run không được chạm vào store (không initialize, không write)', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, '../scripts/auditVoucherRedemptions.js'), 'utf8',
  );
  const dryRunBlock = source
    .slice(source.indexOf('async function main'), source.indexOf('createStore(file)'))
    .split('\n')
    .filter((row) => !row.trim().startsWith('//'))
    .join('\n');
  assert.doesNotMatch(dryRunBlock, /store\.initialize|store\.write|store\.update/,
    'nhánh dry-run phải chạy TRƯỚC khi dựng store');
  assert.match(dryRunBlock, /readFileSync/, 'dry-run đọc thẳng tệp');
});

test('M6 · boot không tự chạy di trú voucher', () => {
  const source = require('fs').readFileSync(require('path').resolve(__dirname, '../server.js'), 'utf8');
  assert.doesNotMatch(source, /auditVoucherRedemptions/, 'script vá không được gọi lúc khởi động');
  const mongo = require('fs').readFileSync(require('path').resolve(__dirname, '../lib/mongoCollections.js'), 'utf8');
  assert.doesNotMatch(mongo, /uq_voucher_redemptions_(order|voucher_user)/, 'không thêm unique index mới lúc boot');
});
