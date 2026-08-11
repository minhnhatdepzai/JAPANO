// Quỹ tích luỹ của "Mục tiêu mua sắm": khách nạp dần từng khoản vào quỹ của
// một sản phẩm; khi quỹ đủ giá mục tiêu, hệ thống tự phát một voucher giảm 30%
// dành riêng cho khách đó. Khi khách thực sự mua được sản phẩm mục tiêu bằng
// một đơn thành công, mục tiêu được đánh dấu hoàn thành trọn vẹn.
//
// Đây là SỔ TÍCH LUỸ, không phải ví điện tử: JAPANO không giữ tiền của khách.
// Mỗi khoản nạp chỉ là một dòng ghi nhận để theo dõi tiến độ, khách có thể gỡ
// khoản ghi nhầm bất cứ lúc nào (xem removeDeposit).
const { isSuccessfulOrder } = require('./flagcards');

const REWARD_PERCENT = Math.min(100, Math.max(1, Number(process.env.JAPANO_GOAL_REWARD_PERCENT || 30)));
const REWARD_VALID_DAYS = Math.max(1, Number(process.env.JAPANO_GOAL_REWARD_DAYS || 60));
const MAX_DEPOSIT = 500_000_000;

const GOAL_FUND_CONFIG = Object.freeze({
  rewardPercent: REWARD_PERCENT,
  rewardValidityDays: REWARD_VALID_DAYS,
  maxDepositPerEntry: MAX_DEPOSIT,
  isLedgerOnly: true,
});

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clone = (value) => JSON.parse(JSON.stringify(value));

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rewardCodeFor(goal) {
  const user = String(goal.userId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-6) || 'MEMBER';
  return `GOAL${REWARD_PERCENT}-${user}-${hashString(goal.id).toString(36).toUpperCase().slice(-4)}`;
}

function expiryDate(now, days) {
  return new Date(now + Math.max(1, days) * 86400000).toISOString().slice(0, 10);
}

// Mục tiêu cũ (tạo trước khi có quỹ) vẫn phải đọc được: hàm này bù field còn
// thiếu mà không đụng tới số liệu đã có.
function ensureGoalFund(goal, targetPrice, now = Date.now()) {
  const fund = goal.fund && typeof goal.fund === 'object' ? goal.fund : {};
  fund.deposits = Array.isArray(fund.deposits) ? fund.deposits : [];
  // Giá mục tiêu được khoá ngay khi lập kế hoạch để cửa hàng tăng giá về sau
  // không đẩy khách ra xa mục tiêu họ đang tích luỹ dở.
  fund.target = Math.max(0, finite(fund.target, finite(targetPrice)));
  fund.saved = fund.deposits.reduce((sum, item) => sum + Math.max(0, finite(item.amount)), 0);
  fund.rewardPercent = finite(fund.rewardPercent, REWARD_PERCENT);
  fund.status = fund.achievedOrderId ? 'achieved' : (fund.target > 0 && fund.saved >= fund.target ? 'completed' : 'saving');
  fund.completedAt = fund.status === 'saving' ? null : finite(fund.completedAt, now) || now;
  fund.rewardVoucherCode = fund.rewardVoucherCode || null;
  fund.achievedOrderId = fund.achievedOrderId || null;
  fund.achievedOrderCode = fund.achievedOrderCode || null;
  fund.achievedAt = fund.achievedAt || null;
  fund.updatedAt = now;
  goal.fund = fund;
  return fund;
}

function fundView(goal) {
  const fund = goal.fund || {};
  const target = Math.max(0, finite(fund.target));
  const saved = Math.max(0, finite(fund.saved));
  const remaining = Math.max(0, target - saved);
  return {
    ...clone(fund),
    remaining,
    percent: target > 0 ? Math.min(100, Math.round((saved / target) * 1000) / 10) : 0,
  };
}

// Voucher thưởng là voucher cá nhân (ownerUserId) dùng đúng 1 lần — cùng cơ chế
// khoá quyền sở hữu với voucher thưởng bộ thẻ địa danh trong lib/flagcards.js.
function ensureGoalRewardVoucher(state, goal, now = Date.now()) {
  const fund = goal.fund;
  if (!fund || fund.status === 'saving') return null;
  state.vouchers ||= [];
  const code = fund.rewardVoucherCode || rewardCodeFor(goal);
  let voucher = state.vouchers.find((item) => String(item.code) === code);
  if (!voucher) {
    voucher = {
      code,
      type: 'percent',
      value: Math.min(100, Math.max(1, finite(fund.rewardPercent, REWARD_PERCENT))),
      min: 0,
      expiry: expiryDate(finite(fund.completedAt, now) || now, REWARD_VALID_DAYS),
      limit: 1,
      used: 0,
      active: true,
      appliesTo: 'all-products',
      ownerUserId: String(goal.userId),
      source: 'goal-fund',
      goalId: goal.id,
      goalProductId: goal.productId,
      reason: `Hoàn thành quỹ tích luỹ mục tiêu "${goal.product?.name || goal.productId}"`,
      issuedAt: now,
    };
    state.vouchers.push(voucher);
  }
  fund.rewardVoucherCode = code;
  return voucher;
}

function addDeposit(state, goal, { amount, note }, now = Date.now()) {
  const value = Math.round(finite(amount));
  if (!(value > 0)) {
    const error = new Error('Số tiền nạp vào quỹ phải lớn hơn 0.');
    error.status = 400;
    throw error;
  }
  if (value > MAX_DEPOSIT) {
    const error = new Error(`Mỗi lần chỉ ghi nhận tối đa ${MAX_DEPOSIT.toLocaleString('vi-VN')}₫.`);
    error.status = 400;
    throw error;
  }
  const fund = ensureGoalFund(goal, goal.product?.price, now);
  const wasCompleted = fund.status !== 'saving';
  fund.deposits.push({
    id: `dep-${now}-${Math.random().toString(36).slice(2, 6)}`,
    amount: value,
    note: String(note || '').trim().slice(0, 120),
    at: now,
  });
  ensureGoalFund(goal, goal.product?.price, now);
  const justCompleted = !wasCompleted && goal.fund.status !== 'saving';
  const voucher = goal.fund.status === 'saving' ? null : ensureGoalRewardVoucher(state, goal, now);
  return { fund: goal.fund, justCompleted, voucher };
}

// Ghi nhầm là chuyện thường; cho gỡ khoản nạp để số liệu luôn khớp thực tế.
// Đã phát voucher thưởng rồi thì không thu hồi — khách đã đạt mốc một lần.
function removeDeposit(state, goal, depositId, now = Date.now()) {
  const fund = ensureGoalFund(goal, goal.product?.price, now);
  const before = fund.deposits.length;
  fund.deposits = fund.deposits.filter((item) => String(item.id) !== String(depositId));
  if (fund.deposits.length === before) {
    const error = new Error('Không tìm thấy khoản tích luỹ này.');
    error.status = 404;
    throw error;
  }
  const keepCompleted = Boolean(fund.rewardVoucherCode);
  ensureGoalFund(goal, goal.product?.price, now);
  if (keepCompleted && goal.fund.status === 'saving') goal.fund.status = 'completed';
  return goal.fund;
}

function goalProductInOrder(goal, order) {
  return (order.items || []).some((item) => String(item.slug || item.productId) === String(goal.productId));
}

// Idempotent: chạy lại bao nhiêu lần cũng chỉ ghi nhận một lần cho mỗi mục tiêu.
// "Hoàn thành mục tiêu" = tích đủ quỹ VÀ mua được đúng sản phẩm đó.
function reconcileGoalRewards(state, now = Date.now(), notify = null) {
  const results = [];
  for (const goal of state.goals || []) {
    if (!goal.fund) continue;
    ensureGoalFund(goal, goal.product?.price, now);
    if (goal.fund.status === 'saving') continue;
    ensureGoalRewardVoucher(state, goal, now);
    if (goal.fund.achievedOrderId) continue;
    const order = (state.orders || [])
      .filter((item) => String(item.userId || item.customer?.id || '') === String(goal.userId))
      .filter((item) => isSuccessfulOrder(item) && goalProductInOrder(goal, item))
      .filter((item) => finite(item.createdAt) >= finite(goal.fund.completedAt))
      .sort((left, right) => finite(left.createdAt) - finite(right.createdAt))[0];
    if (!order) continue;
    goal.fund.achievedOrderId = order.id;
    goal.fund.achievedOrderCode = order.code;
    goal.fund.achievedAt = now;
    goal.fund.status = 'achieved';
    goal.updatedAt = now;
    results.push({ goalId: goal.id, userId: goal.userId, orderId: order.id, orderCode: order.code, productName: goal.product?.name || goal.productId });
    if (notify) {
      notify(state, {
        userId: goal.userId,
        title: '🎯 Bạn đã hoàn thành mục tiêu!',
        body: `Tích đủ quỹ và mua được "${goal.product?.name || goal.productId}" trong đơn #${order.code}. Chúc mừng bạn!`,
        type: 'Hệ thống',
        action: `order:${order.id}`,
      });
    }
  }
  return results;
}

module.exports = {
  GOAL_FUND_CONFIG,
  ensureGoalFund,
  fundView,
  ensureGoalRewardVoucher,
  addDeposit,
  removeDeposit,
  reconcileGoalRewards,
};
