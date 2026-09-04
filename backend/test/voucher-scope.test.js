// Phạm vi áp dụng voucher — V1..V8.
//
// Lỗi được khoá lại ở đây: voucher thưởng mục tiêu 30% từng giảm trên TOÀN BỘ
// giỏ hàng. Món mục tiêu 100.000₫ nằm cạnh món khác 900.000₫ thì cửa hàng mất
// 300.000₫ thay vì 30.000₫. Trường `appliesTo` có tồn tại nhưng không nơi nào
// trong code chạy thật đọc tới nó.
const test = require('node:test');
const assert = require('node:assert/strict');

const { validateVoucher } = require('../lib/flagcards');
const { voucherScope, discountFor, eligibleUnits } = require('../lib/voucherLifecycle');

const TARGET = 'ao-muc-tieu';
const OTHER = 'quan-khac';

function baseState(vouchers = []) {
  return {
    vouchers,
    voucherRedemptions: [],
    flagcards: [],
    flagcardCollections: [],
    flagcardConfig: null,
  };
}

function goalVoucher(overrides = {}) {
  return {
    code: 'GOAL30-U1-AAAA',
    type: 'percent',
    value: 30,
    min: 0,
    expiry: '—',
    limit: 1,
    used: 0,
    active: true,
    ownerUserId: 'u1',
    source: 'goal-fund',
    scope: 'product',
    eligibleProductIds: [TARGET],
    maxEligibleQty: 1,
    goalId: 'goal-u1',
    goalProductId: TARGET,
    ...overrides,
  };
}

const line = (slug, price, qty = 1) => ({ slug, productId: slug, price, qty, colorName: 'Sumi', size: 'M' });

test('V1 · voucher mục tiêu 30% chỉ giảm trên đúng món mục tiêu', () => {
  const state = baseState([goalVoucher()]);
  const items = [line(TARGET, 100_000), line(OTHER, 900_000)];
  const result = validateVoucher(state, { code: 'GOAL30-U1-AAAA', userId: 'u1', items });

  assert.equal(result.ok, true);
  assert.equal(result.discount, 30_000, 'phải là 30% của 100.000₫, không phải của cả giỏ 1.000.000₫');
  assert.equal(result.eligibleSubtotal, 100_000);
  assert.equal(result.subtotal, 1_000_000);
  assert.equal(result.scope, 'product');
  assert.deepEqual(result.eligibleProductIds, [TARGET]);
  assert.equal(result.maxEligibleQty, 1);
});

test('V2 · giỏ không có sản phẩm mục tiêu thì voucher bị từ chối', () => {
  const state = baseState([goalVoucher()]);
  const result = validateVoucher(state, { code: 'GOAL30-U1-AAAA', userId: 'u1', items: [line(OTHER, 900_000)] });
  assert.equal(result.ok, false);
  assert.match(result.message, /chưa có sản phẩm/i);
});

test('V3 · mua hai đơn vị sản phẩm mục tiêu thì chỉ MỘT đơn vị được giảm', () => {
  const state = baseState([goalVoucher()]);
  const result = validateVoucher(state, { code: 'GOAL30-U1-AAAA', userId: 'u1', items: [line(TARGET, 100_000, 2)] });
  assert.equal(result.eligibleSubtotal, 100_000, 'chỉ tính một đơn vị');
  assert.equal(result.discount, 30_000);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].qty, 1);
});

test('V4 · giá client gửi lên không được dùng — chỉ dòng hàng đã chuẩn hoá mới tính', () => {
  const state = baseState([goalVoucher()]);
  // Hàm chỉ nhìn `items` đã chuẩn hoá; `subtotal` bịa từ client bị bỏ qua khi
  // đã có items (route dùng normalizedOrderItems để dựng items từ catalog).
  const result = validateVoucher(state, {
    code: 'GOAL30-U1-AAAA',
    userId: 'u1',
    subtotal: 999_999_999,
    items: [line(TARGET, 100_000)],
  });
  assert.equal(result.discount, 30_000);
  assert.equal(result.subtotal, 100_000, 'subtotal tính lại từ items, không lấy số client gửi');
});

test('V5 · voucher chung và voucher legacy thiếu scope vẫn giảm toàn đơn như trước', () => {
  const legacy = {
    code: 'FLAG50', type: 'percent', value: 50, min: 0, expiry: '—',
    limit: 1, used: 0, active: true, appliesTo: 'all-products',
    ownerUserId: 'u1', source: 'flagcard-collection',
  };
  const state = baseState([legacy]);
  assert.equal(voucherScope(legacy), 'order');

  const withItems = validateVoucher(state, { code: 'FLAG50', userId: 'u1', items: [line(TARGET, 100_000), line(OTHER, 900_000)] });
  assert.equal(withItems.discount, 500_000, 'voucher chung vẫn giảm trên toàn giỏ');

  const legacyCall = validateVoucher(state, { code: 'FLAG50', userId: 'u1', subtotal: 1_000_000 });
  assert.equal(legacyCall.discount, 500_000, 'lời gọi cũ chỉ có subtotal vẫn chạy');
});

test('V6 · voucher mục tiêu thiếu items hoặc thiếu goalProductId thì fail closed', () => {
  const state = baseState([goalVoucher()]);
  const noItems = validateVoucher(state, { code: 'GOAL30-U1-AAAA', userId: 'u1', subtotal: 1_000_000 });
  assert.equal(noItems.ok, false, 'không biết giỏ có gì thì KHÔNG được giảm toàn đơn');
  assert.match(noItems.message, /không xác định được sản phẩm/i);

  const orphan = baseState([goalVoucher({ eligibleProductIds: [], goalProductId: undefined })]);
  const noProduct = validateVoucher(orphan, { code: 'GOAL30-U1-AAAA', userId: 'u1', items: [line(TARGET, 100_000)] });
  assert.equal(noProduct.ok, false);
  assert.match(noProduct.message, /liên hệ hỗ trợ/i);
});

test('V6b · voucher goal cũ KHÔNG khai scope vẫn được áp phạm vi sản phẩm ngay', () => {
  // Dữ liệu phát trước khi có trường `scope`: chỉ có source + goalProductId.
  const old = goalVoucher();
  delete old.scope;
  delete old.eligibleProductIds;
  delete old.maxEligibleQty;
  assert.equal(voucherScope(old), 'product', 'suy ra từ source=goal-fund');

  const state = baseState([old]);
  const result = validateVoucher(state, { code: 'GOAL30-U1-AAAA', userId: 'u1', items: [line(TARGET, 100_000), line(OTHER, 900_000)] });
  assert.equal(result.discount, 30_000, 'không được tiếp tục giảm toàn đơn');
});

test('V7 · sai chủ sở hữu, hết hạn, tạm khoá hoặc hết lượt đều bị từ chối', () => {
  const items = [line(TARGET, 100_000)];

  const wrongOwner = baseState([goalVoucher()]);
  assert.equal(validateVoucher(wrongOwner, { code: 'GOAL30-U1-AAAA', userId: 'u2', items }).ok, false);

  const expired = baseState([goalVoucher({ expiry: '2020-01-01' })]);
  assert.equal(validateVoucher(expired, { code: 'GOAL30-U1-AAAA', userId: 'u1', items }).ok, false);

  const inactive = baseState([goalVoucher({ active: false })]);
  assert.equal(validateVoucher(inactive, { code: 'GOAL30-U1-AAAA', userId: 'u1', items }).ok, false);

  const usedUp = baseState([goalVoucher({ used: 1, limit: 1 })]);
  assert.equal(validateVoucher(usedUp, { code: 'GOAL30-U1-AAAA', userId: 'u1', items }).ok, false);
});

test('trần giảm giá chặn theo giá đã khoá của mục tiêu', () => {
  // Giá mục tiêu khoá ở 100.000₫; sau đó cửa hàng tăng giá lên 500.000₫.
  const state = baseState([goalVoucher({ maxDiscountAmount: 30_000 })]);
  const result = validateVoucher(state, { code: 'GOAL30-U1-AAAA', userId: 'u1', items: [line(TARGET, 500_000)] });
  assert.equal(result.discount, 30_000, 'trần giữ đúng quyền lợi đã hứa, không nở theo giá mới');
});

test('tổng phân bổ theo dòng luôn bằng đúng số giảm', () => {
  const orderWide = {
    code: 'SALE10', type: 'percent', value: 10, min: 0, expiry: '—',
    limit: 99, used: 0, active: true,
  };
  const items = [line('a', 33_333), line('b', 33_333), line('c', 33_334)];
  const applied = discountFor(orderWide, items);
  const sum = applied.allocations.reduce((total, row) => total + row.amount, 0);
  assert.equal(sum, applied.discount, 'phần dư làm tròn phải được dồn hết, không rơi vãi');
});

test('eligibleUnits ưu tiên đơn vị đắt nhất khi chỉ một đơn vị được giảm', () => {
  const voucher = goalVoucher({ eligibleProductIds: [TARGET, OTHER] });
  const units = eligibleUnits(voucher, [line(TARGET, 100_000), line(OTHER, 900_000)]);
  assert.equal(units.length, 1);
  assert.equal(units[0].price, 900_000);
});
