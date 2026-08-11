const test = require('node:test');
const assert = require('node:assert/strict');

const { httpError } = require('../lib/httpError');
const {
  returnableItems, resolveSelection, computeRefund, allItemsRefunded,
} = require('../lib/refundMath');

// Đơn 3 món: 2 áo 100k + 1 quần 200k + 1 mũ 50k = 450k hàng, giảm 45k, ship 30k.
function baseState() {
  return {
    returnRequests: [],
    orders: [{
      id: 'o1',
      code: 'JP001',
      userId: 'u1',
      items: [
        { productId: 'ao', slug: 'ao', name: 'Áo', colorName: 'Đỏ', size: 'M', qty: 2, price: 100000 },
        { productId: 'quan', slug: 'quan', name: 'Quần', colorName: 'Đen', size: 'L', qty: 1, price: 200000 },
        { productId: 'mu', slug: 'mu', name: 'Mũ', colorName: 'Kem', size: 'M', qty: 1, price: 50000 },
      ],
      subtotal: 450000,
      discount: 45000,
      voucherDiscount: 45000,
      vipDiscount: 0,
      ship: 30000,
      total: 435000,
      status: 'completed',
    }],
  };
}
const order = (state) => state.orders[0];

test('trả một phần đơn chỉ hoàn tiền của đúng những món được chọn', () => {
  const state = baseState();
  const selection = resolveSelection(state, order(state), [{ slug: 'quan', colorName: 'Đen', size: 'L', qty: 1 }], httpError);
  const refund = computeRefund(state, order(state), selection);
  // Quần chiếm 200k/450k giá trị đơn nên gánh 200/450 của khoản giảm 45k = 20k.
  assert.equal(refund.breakdown.itemsValue, 200000);
  assert.equal(refund.breakdown.discountAllocated, 20000);
  assert.equal(refund.breakdown.shipRefunded, 0, 'trả một phần thì không hoàn phí vận chuyển');
  assert.equal(refund.amount, 180000);
  assert.equal(refund.coversWholeOrder, false);
});

test('trả một phần số lượng của cùng một dòng hàng', () => {
  const state = baseState();
  const selection = resolveSelection(state, order(state), [{ slug: 'ao', colorName: 'Đỏ', size: 'M', qty: 1 }], httpError);
  const refund = computeRefund(state, order(state), selection);
  assert.equal(selection[0].qty, 1);
  assert.equal(refund.breakdown.itemsValue, 100000);
  assert.equal(refund.amount, 100000 - 10000);
});

test('trả toàn bộ đơn hoàn cả phí vận chuyển và bằng đúng tổng đơn', () => {
  const state = baseState();
  const selection = resolveSelection(state, order(state), null, httpError);
  const refund = computeRefund(state, order(state), selection);
  assert.equal(refund.coversWholeOrder, true);
  assert.equal(refund.breakdown.shipRefunded, 30000);
  assert.equal(refund.amount, order(state).total);
});

test('không thể yêu cầu trả quá số lượng đã mua', () => {
  const state = baseState();
  assert.throws(
    () => resolveSelection(state, order(state), [{ slug: 'ao', colorName: 'Đỏ', size: 'M', qty: 3 }], httpError),
    /chỉ còn 2 sản phẩm/,
  );
});

test('món đã nằm trong một yêu cầu đang xử lý không được yêu cầu lại', () => {
  const state = baseState();
  state.returnRequests.push({
    id: 'ret-1', orderId: 'o1', kind: 'return', status: 'approved',
    items: [{ productId: 'quan', slug: 'quan', name: 'Quần', colorName: 'Đen', size: 'L', qty: 1, price: 200000 }],
  });
  const remaining = returnableItems(state, order(state));
  assert.equal(remaining.find((item) => item.slug === 'quan').remainingQty, 0);
  assert.throws(
    () => resolveSelection(state, order(state), [{ slug: 'quan', colorName: 'Đen', size: 'L', qty: 1 }], httpError),
    /không có trong đơn hàng này|chỉ còn 0/,
  );
});

test('yêu cầu bị từ chối trả lại quyền yêu cầu cho sản phẩm đó', () => {
  const state = baseState();
  state.returnRequests.push({
    id: 'ret-1', orderId: 'o1', kind: 'return', status: 'rejected',
    items: [{ productId: 'quan', slug: 'quan', name: 'Quần', colorName: 'Đen', size: 'L', qty: 1, price: 200000 }],
  });
  const remaining = returnableItems(state, order(state));
  assert.equal(remaining.find((item) => item.slug === 'quan').remainingQty, 1);
});

test('lần trả cuối cùng gom nốt phần còn lại được tính là trả cả đơn', () => {
  const state = baseState();
  state.returnRequests.push({
    id: 'ret-1', orderId: 'o1', kind: 'return', status: 'refunded',
    items: [
      { productId: 'ao', slug: 'ao', name: 'Áo', colorName: 'Đỏ', size: 'M', qty: 2, price: 100000 },
      { productId: 'quan', slug: 'quan', name: 'Quần', colorName: 'Đen', size: 'L', qty: 1, price: 200000 },
    ],
  });
  const selection = resolveSelection(state, order(state), null, httpError);
  const refund = computeRefund(state, order(state), selection);
  assert.deepEqual(selection.map((item) => item.slug), ['mu']);
  assert.equal(refund.coversWholeOrder, true);
  assert.equal(refund.breakdown.shipRefunded, 30000);
});

test('ưu đãi VIP chỉ bị trừ khi chính món được giảm VIP bị trả về', () => {
  const state = baseState();
  const target = order(state);
  target.vipDiscount = 20000;
  target.discount = 65000;
  target.vipPromotion = { productId: 'quan', colorName: 'Đen', size: 'L', discountedUnits: 1 };

  const withoutVipItem = computeRefund(state, target, resolveSelection(state, target, [{ slug: 'mu', colorName: 'Kem', size: 'M', qty: 1 }], httpError));
  assert.equal(withoutVipItem.breakdown.vipDiscountAllocated, 0);

  const withVipItem = computeRefund(state, target, resolveSelection(state, target, [{ slug: 'quan', colorName: 'Đen', size: 'L', qty: 1 }], httpError));
  assert.equal(withVipItem.breakdown.vipDiscountAllocated, 20000);
});

test('đơn chỉ được coi là "đã trả hàng" khi mọi sản phẩm đều đã hoàn tiền', () => {
  const state = baseState();
  state.returnRequests.push({
    id: 'ret-1', orderId: 'o1', kind: 'return', status: 'refunded',
    items: [{ productId: 'ao', slug: 'ao', name: 'Áo', colorName: 'Đỏ', size: 'M', qty: 2, price: 100000 }],
  });
  assert.equal(allItemsRefunded(state, order(state)), false);
  state.returnRequests.push({
    id: 'ret-2', orderId: 'o1', kind: 'return', status: 'refunded',
    items: [
      { productId: 'quan', slug: 'quan', name: 'Quần', colorName: 'Đen', size: 'L', qty: 1, price: 200000 },
      { productId: 'mu', slug: 'mu', name: 'Mũ', colorName: 'Kem', size: 'M', qty: 1, price: 50000 },
    ],
  });
  assert.equal(allItemsRefunded(state, order(state)), true);
});
