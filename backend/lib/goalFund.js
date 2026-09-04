// Quỹ tích luỹ của "Mục tiêu mua sắm": khách ghi nhận dần từng khoản đã để
// dành cho một sản phẩm. Khi khách thực sự mua được sản phẩm mục tiêu bằng một
// đơn thành công, mục tiêu được đánh dấu hoàn thành trọn vẹn.
//
// Đủ 100% KHÔNG phát voucher. Số tiền ở đây do khách tự khai, JAPANO không giữ
// tiền và không xác minh số dư, nên nó chỉ được đổi trạng thái tiến độ.
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

/* Voucher thưởng mục tiêu: KHÔNG còn được phát từ tiền khách tự khai.
 *
 * Trước đây chỉ cần khai `currentSavings` đủ giá, hoặc bấm "nạp quỹ" tới 100%,
 * là hệ thống tự phát một voucher giảm 30% có giá trị tiền thật. Quỹ này là SỔ
 * THEO DÕI: JAPANO không giữ tiền, không xác minh số dư, nên một con số tự khai
 * không được phép tạo ra quyền lợi tài chính.
 *
 * Hàm này giờ chỉ CHUẨN HOÁ voucher đã phát trước đây (dữ liệu cũ) để nó chạy
 * đúng phạm vi sản phẩm, chứ không tạo voucher mới. Quyền lợi cũ được giữ
 * nguyên; điều thay đổi là nó chỉ còn giảm đúng món mục tiêu.
 */
function normalizeGoalVoucherScope(voucher, goal) {
  if (!voucher) return voucher;
  voucher.scope = 'product';
  const productId = String(voucher.goalProductId || goal?.productId || '');
  voucher.eligibleProductIds = productId ? [productId] : (Array.isArray(voucher.eligibleProductIds) ? voucher.eligibleProductIds : []);
  voucher.maxEligibleQty = Math.max(1, finite(voucher.maxEligibleQty, 1));
  // Trần giảm dựa trên GIÁ ĐÃ KHOÁ của mục tiêu, không phải giá giỏ hàng.
  const lockedPrice = Math.max(0, finite(goal?.fund?.target, finite(goal?.product?.price)));
  if (lockedPrice > 0) {
    const percent = Math.min(100, Math.max(0, finite(voucher.value)));
    const byPercent = String(voucher.type || 'percent') === 'percent'
      ? Math.round(lockedPrice * percent / 100)
      : Math.min(lockedPrice, Math.max(0, finite(voucher.value)));
    voucher.maxDiscountAmount = Math.max(0, Math.min(finite(voucher.maxDiscountAmount, byPercent) || byPercent, byPercent));
  }
  return voucher;
}

function ensureGoalRewardVoucher(state, goal, now = Date.now()) {
  const fund = goal?.fund;
  if (!fund) return null;
  const code = fund.rewardVoucherCode;
  // Không có mã cũ nghĩa là mục tiêu này chưa từng được thưởng — và từ nay
  // tiền tự khai không phát voucher nữa, nên không tạo mới ở đây.
  if (!code) return null;
  const voucher = (state.vouchers || []).find((item) => String(item.code) === String(code));
  if (!voucher) return null;
  return normalizeGoalVoucherScope(voucher, goal);
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
  // Đạt 100% chỉ đổi TRẠNG THÁI TIẾN ĐỘ. Không phát voucher: con số ở đây do
  // khách tự khai và JAPANO không giữ tiền của khách.
  return { fund: goal.fund, justCompleted, voucher: null };
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
  // Gỡ khoản ghi nhầm thì tiến độ phải tính lại đúng thực tế. Trước đây trạng
  // thái "completed" được giữ lại nếu đã từng phát voucher, khiến một mục tiêu
  // đang thiếu tiền vẫn hiện là đã hoàn thành.
  ensureGoalFund(goal, goal.product?.price, now);
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
    // Chỉ chuẩn hoá phạm vi cho voucher đã phát trước đây; không phát mới.
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
  normalizeGoalVoucherScope,
  ensureGoalFund,
  fundView,
  ensureGoalRewardVoucher,
  addDeposit,
  removeDeposit,
  reconcileGoalRewards,
};
