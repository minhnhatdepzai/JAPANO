const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FULFILLMENT_POLICY, ORDER_STATUS_FLOW, PRE_SHIP_STATUSES, RETURNABLE_ORDER_STATUSES,
  AUTO_CONFIRM_DAYS, returnWindowStartedAt, autoCompleteDeliveredOrders,
} = require('../lib/fulfillmentPolicy');
const { SPOT_REWARD_CONFIG, ensureSuggestionReward, issueSpotRewardVoucher } = require('../lib/communityRewards');

test('quy trình đơn hàng đi một chiều và không nhảy cóc được bước nào', () => {
  assert.deepEqual(ORDER_STATUS_FLOW.pending, ['confirmed', 'cancelled']);
  assert.ok(!ORDER_STATUS_FLOW.pending.includes('shipping'), 'chưa xác nhận thì chưa thể giao');
  assert.ok(ORDER_STATUS_FLOW.shipping.includes('delivered'));
  assert.ok(ORDER_STATUS_FLOW.delivered.includes('completed'));
  assert.deepEqual(ORDER_STATUS_FLOW.cancelled, [], 'đơn đã huỷ là trạng thái kết thúc');
  assert.deepEqual(ORDER_STATUS_FLOW.returned, []);
});

test('huỷ đơn chỉ áp dụng trước khi bàn giao vận chuyển', () => {
  assert.deepEqual(PRE_SHIP_STATUSES, FULFILLMENT_POLICY.cancel.allowedStatuses);
  assert.ok(!PRE_SHIP_STATUSES.includes('shipping'));
  assert.ok(!PRE_SHIP_STATUSES.includes('delivered'));
  assert.ok(!PRE_SHIP_STATUSES.includes('completed'));
});

test('trả hàng chỉ mở sau khi hàng đã tới tay khách', () => {
  assert.deepEqual(RETURNABLE_ORDER_STATUSES, ['delivered', 'completed']);
  assert.ok(!RETURNABLE_ORDER_STATUSES.includes('shipping'));
});

test('mỗi bước của quy trình đều chỉ rõ đúng một bên chịu trách nhiệm', () => {
  const known = Object.keys(FULFILLMENT_POLICY.actors);
  const stages = [
    ...FULFILLMENT_POLICY.order.stages, ...FULFILLMENT_POLICY.order.terminal,
    ...FULFILLMENT_POLICY.return.stages, ...FULFILLMENT_POLICY.return.terminal,
  ];
  for (const stage of stages) {
    assert.ok(known.includes(stage.actor), `bước "${stage.label}" thiếu bên chịu trách nhiệm hợp lệ`);
    assert.ok(stage.description.length > 20, `bước "${stage.label}" cần mô tả rõ ràng`);
  }
  // Quy trình trả hàng phải có đủ bước bên thứ ba lẫn bước cửa hàng nhận.
  const returnStatuses = FULFILLMENT_POLICY.return.stages.map((stage) => stage.status);
  assert.deepEqual(returnStatuses, ['requested', 'approved', 'shipped_back', 'received', 'refunded']);
  assert.equal(FULFILLMENT_POLICY.return.stages.find((s) => s.status === 'shipped_back').actor, 'customer');
  assert.equal(FULFILLMENT_POLICY.return.stages.find((s) => s.status === 'received').actor, 'shop');
  assert.equal(FULFILLMENT_POLICY.order.stages.find((s) => s.status === 'delivered').actor, 'carrier');
  assert.equal(FULFILLMENT_POLICY.order.stages.find((s) => s.status === 'completed').actor, 'customer');
});

test('hạn đổi/trả đếm từ lúc khách xác nhận, lùi về mốc giao hàng nếu chưa xác nhận', () => {
  assert.equal(returnWindowStartedAt({ completedAt: 500, deliveredAt: 100, createdAt: 1 }), 500);
  assert.equal(returnWindowStartedAt({ deliveredAt: 100, createdAt: 1 }), 100);
  assert.equal(returnWindowStartedAt({ createdAt: 1 }), 1);
});

test('đơn đã giao mà khách không xác nhận thì tự chốt sau đúng số ngày quy định', () => {
  const now = Date.now();
  const fresh = { id: 'o1', code: 'JP1', status: 'delivered', deliveredAt: now - 86400000, payment: { method: 'COD', status: 'unpaid' }, history: [] };
  const stale = { id: 'o2', code: 'JP2', status: 'delivered', deliveredAt: now - (AUTO_CONFIRM_DAYS + 1) * 86400000, payment: { method: 'COD', status: 'unpaid' }, history: [] };
  const state = { orders: [fresh, stale] };

  const completed = autoCompleteDeliveredOrders(state, now);
  assert.deepEqual(completed.map((order) => order.id), ['o2']);
  assert.equal(fresh.status, 'delivered', 'chưa tới hạn thì vẫn chờ khách');
  assert.equal(stale.status, 'completed');
  assert.equal(stale.payment.status, 'paid', 'đơn COD tự chốt được ghi nhận đã thu tiền');

  // Chạy lại không đổi gì thêm.
  assert.equal(autoCompleteDeliveredOrders(state, now).length, 0);
});

test('đóng góp địa điểm được duyệt phát đúng một voucher giảm tiền cá nhân', () => {
  const state = { vouchers: [] };
  const entry = { id: 'sug-1', userId: 'u1', prefecture: 'Kyoto', suggestion: 'Cầu X' };
  const reward = ensureSuggestionReward(entry);
  assert.equal(reward.status, 'pending');

  const voucher = issueSpotRewardVoucher(state, entry, {}, Date.now());
  assert.equal(voucher.type, 'amount');
  assert.equal(voucher.value, SPOT_REWARD_CONFIG.amount);
  assert.equal(voucher.min, SPOT_REWARD_CONFIG.minOrder);
  assert.equal(voucher.ownerUserId, 'u1', 'chỉ chính người đóng góp dùng được');
  assert.equal(voucher.limit, 1);
  assert.equal(voucher.source, 'community-spot');
  assert.equal(state.vouchers.length, 1);
});

test('admin có thể tự đặt mức thưởng nhưng không tạo được voucher vô nghĩa', () => {
  const state = { vouchers: [] };
  const entry = { id: 'sug-2', userId: 'u2', prefecture: 'Osaka', suggestion: 'Chợ Y' };
  const voucher = issueSpotRewardVoucher(state, entry, { amount: 120000, minOrder: 0, validDays: 15 }, Date.now());
  assert.equal(voucher.value, 120000);
  assert.equal(voucher.min, 0);

  const floored = issueSpotRewardVoucher(state, { id: 'sug-3', userId: 'u3', prefecture: 'Nara' }, { amount: -50 }, Date.now());
  assert.ok(floored.value >= 1000, 'mức thưởng âm/0 bị nâng lên mức tối thiểu thay vì tạo voucher rỗng');
});
