// Thưởng cho cộng đồng đóng góp địa điểm chụp ảnh mới ở Nhật Bản.
//
// Mục tiêu nghiệp vụ: khuyến khích khách chia sẻ địa điểm đẹp có thật. Gợi ý
// được quản trị viên duyệt (đúng địa điểm, mô tả dùng được) sẽ nhận một voucher
// GIẢM TIỀN cho đơn kế tiếp. Voucher là cá nhân, một lượt dùng — giống voucher
// đền bù trong routes/admin.js và voucher thưởng thẻ địa danh trong lib/flagcards.js.
const DEFAULT_REWARD_AMOUNT = Math.max(0, Number(process.env.JAPANO_SPOT_REWARD_AMOUNT || 50_000));
const DEFAULT_REWARD_MIN_ORDER = Math.max(0, Number(process.env.JAPANO_SPOT_REWARD_MIN_ORDER || 300_000));
const DEFAULT_REWARD_DAYS = Math.max(1, Number(process.env.JAPANO_SPOT_REWARD_DAYS || 60));

const SPOT_REWARD_CONFIG = Object.freeze({
  amount: DEFAULT_REWARD_AMOUNT,
  minOrder: DEFAULT_REWARD_MIN_ORDER,
  validityDays: DEFAULT_REWARD_DAYS,
  label: `Giảm ${DEFAULT_REWARD_AMOUNT.toLocaleString('vi-VN')}₫ cho đơn từ ${DEFAULT_REWARD_MIN_ORDER.toLocaleString('vi-VN')}₫`,
});

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

function rewardCode(userId, seed) {
  const user = String(userId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-6) || 'MEMBER';
  const tail = String(seed || Date.now()).replace(/[^A-Za-z0-9]/g, '').slice(-5).toUpperCase();
  return `SPOT-${user}-${tail}`;
}

// Trạng thái duyệt nằm ngay trên bản ghi gợi ý (japanSpotSuggestions) để một
// gợi ý chỉ được thưởng đúng một lần, kể cả khi admin bấm duyệt hai lần.
function ensureSuggestionReward(entry) {
  entry.reward = entry.reward && typeof entry.reward === 'object' ? entry.reward : { status: 'pending' };
  entry.reward.status = ['pending', 'approved', 'rejected'].includes(entry.reward.status) ? entry.reward.status : 'pending';
  return entry.reward;
}

function issueSpotRewardVoucher(state, entry, options = {}, now = Date.now()) {
  const amount = Math.max(1000, Math.round(finite(options.amount, DEFAULT_REWARD_AMOUNT)));
  const minOrder = Math.max(0, Math.round(finite(options.minOrder, DEFAULT_REWARD_MIN_ORDER)));
  const validDays = Math.max(1, Math.round(finite(options.validDays, DEFAULT_REWARD_DAYS)));
  state.vouchers ||= [];
  const voucher = {
    code: rewardCode(entry.userId, entry.id),
    type: 'amount',
    value: amount,
    min: minOrder,
    expiry: new Date(now + validDays * 86400000).toISOString().slice(0, 10),
    limit: 1,
    used: 0,
    active: true,
    appliesTo: 'all-products',
    ownerUserId: String(entry.userId),
    source: 'community-spot',
    suggestionId: entry.id,
    reason: `Cảm ơn đóng góp địa điểm chụp ảnh mới tại ${entry.prefecture}`,
    issuedBy: options.issuedBy || 'admin',
    issuedAt: now,
  };
  state.vouchers.push(voucher);
  return voucher;
}

module.exports = { SPOT_REWARD_CONFIG, ensureSuggestionReward, issueSpotRewardVoucher };
