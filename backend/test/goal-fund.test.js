const test = require('node:test');
const assert = require('node:assert/strict');

const { pushNotification } = require('../lib/notify');
const {
  GOAL_FUND_CONFIG, ensureGoalFund, addDeposit, removeDeposit, reconcileGoalRewards, fundView,
} = require('../lib/goalFund');

function baseState() {
  const state = {
    vouchers: [],
    orders: [],
    notifications: [],
    users: [{ id: 'u1', name: 'Minh' }],
    goals: [{
      id: 'goal-u1-ao-test',
      userId: 'u1',
      productId: 'ao-test',
      product: { slug: 'ao-test', name: 'Áo test', price: 1000000 },
      input: {},
      plan: {},
      createdAt: 1,
      updatedAt: 1,
    }],
  };
  ensureGoalFund(state.goals[0], 1000000);
  return state;
}
const goalOf = (state) => state.goals[0];

test('quỹ mới lập có mục tiêu bằng giá sản phẩm và chưa tích được đồng nào', () => {
  const state = baseState();
  const fund = fundView(goalOf(state));
  assert.equal(fund.target, 1000000);
  assert.equal(fund.saved, 0);
  assert.equal(fund.remaining, 1000000);
  assert.equal(fund.status, 'saving');
  assert.equal(state.vouchers.length, 0, 'chưa đủ tiền thì chưa có voucher thưởng');
});

test('nạp dần vào quỹ cộng đúng tiến độ và chưa thưởng khi còn thiếu', () => {
  const state = baseState();
  addDeposit(state, goalOf(state), { amount: 300000 });
  addDeposit(state, goalOf(state), { amount: 200000 });
  const fund = fundView(goalOf(state));
  assert.equal(fund.saved, 500000);
  assert.equal(fund.percent, 50);
  assert.equal(fund.status, 'saving');
  assert.equal(state.vouchers.length, 0);
});

// G6 — tiền TỰ KHAI không tạo ra quyền lợi tài chính. Quỹ này là sổ theo dõi:
// JAPANO không giữ tiền của khách và không xác minh số dư, nên đủ 100% chỉ
// được đổi trạng thái tiến độ.
test('ghi nhận đủ số tiền mục tiêu KHÔNG phát voucher', () => {
  const state = baseState();
  addDeposit(state, goalOf(state), { amount: 600000 });
  const result = addDeposit(state, goalOf(state), { amount: 400000 });

  assert.equal(result.justCompleted, true, 'vẫn ghi nhận cột mốc tiến độ');
  assert.equal(goalOf(state).fund.status, 'completed');
  assert.equal(result.voucher, null, 'không phát voucher từ số tiền tự khai');
  assert.equal(state.vouchers.length, 0, 'không có voucher nào được tạo');
  assert.equal(goalOf(state).fund.rewardVoucherCode, null);
});

test('ghi nhận thêm sau khi đã đủ vẫn không phát voucher', () => {
  const state = baseState();
  addDeposit(state, goalOf(state), { amount: 1000000 });
  addDeposit(state, goalOf(state), { amount: 500000 });
  assert.equal(state.vouchers.length, 0);
  assert.equal(fundView(goalOf(state)).saved, 1500000);
});

test('số tiền nạp không hợp lệ bị chặn', () => {
  const state = baseState();
  assert.throws(() => addDeposit(state, goalOf(state), { amount: 0 }), /lớn hơn 0/);
  assert.throws(() => addDeposit(state, goalOf(state), { amount: -5000 }), /lớn hơn 0/);
  assert.throws(() => addDeposit(state, goalOf(state), { amount: 999999999999 }), /tối đa/);
});

// G7 — gỡ khoản ghi nhầm phải tính lại tiến độ đúng thực tế. Trước đây trạng
// thái "completed" được giữ lại, khiến một mục tiêu đang thiếu tiền vẫn hiện là
// đã hoàn thành.
test('gỡ khoản ghi nhầm tính lại tiến độ đúng, không giữ trạng thái hoàn thành giả', () => {
  const state = baseState();
  addDeposit(state, goalOf(state), { amount: 400000 });
  const second = goalOf(state).fund.deposits[0].id;
  removeDeposit(state, goalOf(state), second);
  assert.equal(fundView(goalOf(state)).saved, 0);

  addDeposit(state, goalOf(state), { amount: 1000000 });
  assert.equal(goalOf(state).fund.status, 'completed');
  const depositId = goalOf(state).fund.deposits[0].id;
  removeDeposit(state, goalOf(state), depositId);
  assert.equal(fundView(goalOf(state)).saved, 0);
  assert.equal(goalOf(state).fund.status, 'saving', 'gỡ hết tiền thì quay lại đang tích luỹ');
  assert.equal(state.vouchers.length, 0);
});

test('mua đúng sản phẩm mục tiêu sau khi đủ quỹ mới được ghi nhận hoàn thành', () => {
  const state = baseState();
  addDeposit(state, goalOf(state), { amount: 1000000 });
  const completedAt = goalOf(state).fund.completedAt;

  // Đơn của người khác không tính.
  state.orders.push({
    id: 'o-other', code: 'JP900', userId: 'u2', createdAt: completedAt + 10,
    status: 'completed', payment: { status: 'paid', method: 'COD' },
    items: [{ slug: 'ao-test', qty: 1 }],
  });
  assert.equal(reconcileGoalRewards(state, Date.now(), pushNotification).length, 0);

  // Đơn mua sản phẩm khác cũng không tính.
  state.orders.push({
    id: 'o-wrong', code: 'JP901', userId: 'u1', createdAt: completedAt + 20,
    status: 'completed', payment: { status: 'paid', method: 'COD' },
    items: [{ slug: 'quan-khac', qty: 1 }],
  });
  assert.equal(reconcileGoalRewards(state, Date.now(), pushNotification).length, 0);

  // Đúng khách, đúng sản phẩm, đơn thành công → hoàn thành mục tiêu.
  state.orders.push({
    id: 'o-right', code: 'JP902', userId: 'u1', createdAt: completedAt + 30,
    status: 'completed', payment: { status: 'paid', method: 'COD' },
    items: [{ slug: 'ao-test', qty: 1 }],
  });
  const results = reconcileGoalRewards(state, Date.now(), pushNotification);
  assert.equal(results.length, 1);
  assert.equal(results[0].orderCode, 'JP902');
  assert.equal(goalOf(state).fund.status, 'achieved');
  assert.equal(goalOf(state).fund.achievedOrderId, 'o-right');
  assert.ok(state.notifications.some((item) => item.userId === 'u1' && /hoàn thành mục tiêu/i.test(item.title)));
});

test('reconcile chạy lại nhiều lần không ghi nhận trùng', () => {
  const state = baseState();
  addDeposit(state, goalOf(state), { amount: 1000000 });
  state.orders.push({
    id: 'o1', code: 'JP903', userId: 'u1', createdAt: Date.now(),
    status: 'completed', payment: { status: 'paid', method: 'COD' },
    items: [{ slug: 'ao-test', qty: 1 }],
  });
  assert.equal(reconcileGoalRewards(state, Date.now(), pushNotification).length, 1);
  assert.equal(reconcileGoalRewards(state, Date.now(), pushNotification).length, 0);
  assert.equal(state.vouchers.length, 0, 'reconcile không phát voucher từ tiền tự khai');
});

test('đơn đặt TRƯỚC khi tích đủ quỹ không được tính là hoàn thành mục tiêu', () => {
  const state = baseState();
  state.orders.push({
    id: 'o-early', code: 'JP904', userId: 'u1', createdAt: 1000,
    status: 'completed', payment: { status: 'paid', method: 'COD' },
    items: [{ slug: 'ao-test', qty: 1 }],
  });
  addDeposit(state, goalOf(state), { amount: 1000000 });
  assert.equal(reconcileGoalRewards(state, Date.now(), pushNotification).length, 0);
  assert.equal(goalOf(state).fund.status, 'completed');
});
