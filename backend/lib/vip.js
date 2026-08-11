const VIP_CONFIG = Object.freeze({
  monthlySpendThreshold: 5_000_000,
  validityDays: 30,
  discountPercent: 10,
  discountedUnitsPerOrder: 1,
});

const DAY_MS = 86_400_000;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function vipRule(state) {
  const rule = (state?.discountRules || []).find((item) => item?.active !== false && String(item.scope || '').toLowerCase() === 'vip');
  return {
    id: String(rule?.id || 'discount-vip-10'),
    code: String(rule?.code || 'JAPANO-VIP10'),
    monthlySpendThreshold: finite(rule?.qualificationValue, VIP_CONFIG.monthlySpendThreshold),
    validityDays: finite(rule?.validityDays, VIP_CONFIG.validityDays),
    discountPercent: finite(rule?.value, VIP_CONFIG.discountPercent),
    discountedUnitsPerOrder: finite(rule?.maxUnitsPerOrder, VIP_CONFIG.discountedUnitsPerOrder),
  };
}

function orderUserId(order) {
  return String(order?.userId || order?.customer?.id || '').trim();
}

function orderActivityAt(order) {
  const paidHistory = [...(order?.history || [])]
    .reverse()
    .find((entry) => String(entry?.s || '').toLowerCase() === 'paid');
  const completedHistory = [...(order?.history || [])]
    .reverse()
    .find((entry) => ['completed', 'delivered'].includes(String(entry?.s || '').toLowerCase()));
  return finite(order?.payment?.paidAt
    || paidHistory?.at
    || order?.completedAt
    || completedHistory?.at
    || order?.createdAt);
}

function isVipQualifyingOrder(order) {
  const status = String(order?.status || '').toLowerCase();
  const paymentStatus = String(order?.payment?.status || '').toLowerCase();
  if (['cancelled', 'canceled', 'returned', 'refunded', 'failed'].includes(status)) return false;
  if (['cancelled', 'canceled', 'refunded', 'failed'].includes(paymentStatus)) return false;
  return ['paid', 'partially_refunded'].includes(paymentStatus) || ['completed', 'delivered'].includes(status);
}

// Doanh số xét hạng là tiền hàng khách thực trả sau ưu đãi, không gồm phí ship.
// Khoản hoàn (nếu có) được trừ để một đơn hoàn toàn bộ không tiếp tục cấp VIP.
function vipQualifyingSpend(order) {
  if (!isVipQualifyingOrder(order)) return 0;
  const merchandisePaid = Number.isFinite(Number(order?.subtotal))
    ? Math.max(0, finite(order.subtotal) - finite(order.discount))
    : Math.max(0, finite(order?.total) - finite(order?.ship));
  const refunded = Math.max(finite(order?.payment?.refundedAmount), finite(order?.refundedAmount));
  return Math.max(0, Math.round(merchandisePaid - refunded));
}

function monthBounds(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  return { start, end, key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` };
}

function canReceiveVip(state, userId) {
  if (!userId || userId === 'guest') return false;
  const user = (state?.users || []).find((item) => String(item.id) === String(userId));
  return !user || !['admin', 'staff'].includes(String(user.role || '').toLowerCase());
}

function deriveVipMemberships(state, now = Date.now()) {
  const config = vipRule(state);
  const grouped = new Map();
  for (const order of state?.orders || []) {
    const userId = orderUserId(order);
    const at = orderActivityAt(order);
    const spend = vipQualifyingSpend(order);
    if (!canReceiveVip(state, userId) || !at || at > now || spend <= 0) continue;
    const period = monthBounds(at);
    const key = `${userId}\u0000${period.key}`;
    if (!grouped.has(key)) grouped.set(key, { userId, period, orders: [] });
    grouped.get(key).orders.push({ order, at, spend });
  }

  const memberships = [];
  for (const group of grouped.values()) {
    group.orders.sort((left, right) => left.at - right.at || String(left.order.id).localeCompare(String(right.order.id)));
    let cumulative = 0;
    let crossing = null;
    for (const entry of group.orders) {
      cumulative += entry.spend;
      if (!crossing && cumulative >= config.monthlySpendThreshold) crossing = { ...entry, cumulative };
    }
    if (!crossing) continue;
    const startedAt = crossing.at;
    const expiresAt = startedAt + config.validityDays * DAY_MS;
    memberships.push({
      id: `vip-${encodeURIComponent(group.userId)}-${group.period.key}`,
      userId: group.userId,
      discountRuleId: config.id,
      qualifyingPeriod: group.period.key,
      qualifyingOrderIds: group.orders.filter((entry) => entry.at <= crossing.at).map((entry) => String(entry.order.id)),
      qualifiedSpend: crossing.cumulative,
      threshold: config.monthlySpendThreshold,
      discountPercent: config.discountPercent,
      discountedUnitsPerOrder: config.discountedUnitsPerOrder,
      startedAt,
      expiresAt,
      status: now < expiresAt ? 'active' : 'expired',
      createdAt: startedAt,
      updatedAt: now,
    });
  }
  return memberships.sort((left, right) => left.startedAt - right.startedAt);
}

function vipStatus(state, userId, now = Date.now()) {
  const config = vipRule(state);
  const normalizedUserId = String(userId || '').trim();
  const memberships = deriveVipMemberships(state, now).filter((item) => item.userId === normalizedUserId);
  const activeMembership = memberships
    .filter((item) => item.startedAt <= now && now < item.expiresAt)
    .sort((left, right) => right.expiresAt - left.expiresAt)[0] || null;
  const period = monthBounds(now);
  const monthlyOrders = (state?.orders || []).filter((order) => {
    const at = orderActivityAt(order);
    return orderUserId(order) === normalizedUserId && at >= period.start && at < period.end;
  });
  const monthlySpend = monthlyOrders.reduce((sum, order) => sum + vipQualifyingSpend(order), 0);
  const threshold = config.monthlySpendThreshold;
  return {
    userId: normalizedUserId,
    isVip: Boolean(activeMembership),
    tier: activeMembership ? 'VIP' : 'Thành viên',
    membership: activeMembership,
    startedAt: activeMembership?.startedAt || null,
    expiresAt: activeMembership?.expiresAt || null,
    daysRemaining: activeMembership ? Math.max(1, Math.ceil((activeMembership.expiresAt - now) / DAY_MS)) : 0,
    currentMonth: {
      key: period.key,
      startsAt: period.start,
      endsAt: period.end,
      spend: monthlySpend,
      threshold,
      remaining: Math.max(0, threshold - monthlySpend),
      progressPercent: Math.min(100, Math.round(monthlySpend / threshold * 100)),
    },
    benefit: {
      available: Boolean(activeMembership),
      discountRuleId: config.id,
      discountPercent: config.discountPercent,
      discountedUnitsPerOrder: config.discountedUnitsPerOrder,
      description: `Giảm ${config.discountPercent}% cho ${config.discountedUnitsPerOrder} đơn vị sản phẩm tự chọn trong mỗi đơn hàng.`,
    },
  };
}

function vipDiscountForSelection(state, { userId, items, productId, selection, now = Date.now() } = {}) {
  const config = vipRule(state);
  const selectedId = String(productId || selection?.productId || selection?.slug || '').trim();
  if (!selectedId) return { discount: 0, promotion: null, status: vipStatus(state, userId, now) };
  const status = vipStatus(state, userId, now);
  if (!status.isVip) {
    const error = new Error(`Quyền lợi VIP đã hết hạn hoặc tài khoản chưa đạt ${config.monthlySpendThreshold.toLocaleString('vi-VN')}₫ trong tháng.`);
    error.status = 400;
    throw error;
  }
  const selectedColor = String(selection?.colorName || selection?.color || '').trim();
  const selectedSize = String(selection?.size || '').trim();
  const selected = (items || []).find((item) =>
    [item.productId, item.slug].map(String).includes(selectedId)
    && (!selectedColor || String(item.colorName || '') === selectedColor)
    && (!selectedSize || String(item.size || '') === selectedSize));
  if (!selected) {
    const error = new Error('Sản phẩm áp dụng ưu đãi VIP không nằm trong giỏ hàng.');
    error.status = 400;
    throw error;
  }
  const discount = Math.max(0, Math.round(finite(selected.price) * config.discountPercent / 100));
  return {
    discount,
    status,
    promotion: {
      membershipId: status.membership.id,
      discountRuleId: config.id,
      code: config.code,
      label: `VIP giảm ${config.discountPercent}% cho ${config.discountedUnitsPerOrder} sản phẩm`,
      percent: config.discountPercent,
      productId: String(selected.slug || selected.productId),
      productName: String(selected.name || 'Sản phẩm'),
      colorName: String(selected.colorName || ''),
      size: String(selected.size || ''),
      discountedUnits: config.discountedUnitsPerOrder,
      originalUnitPrice: finite(selected.price),
      discount,
    },
  };
}

function reconcileVipState(state, now = Date.now()) {
  state.users ||= [];
  // Các tài khoản mobile đời cũ chỉ xuất hiện trong order.userId. Bổ sung bản
  // ghi khách hàng để Admin vẫn quản lý đúng người, thay vì mất hạng VIP khỏi
  // danh sách chỉ vì trước đây app chưa có endpoint đăng ký tài khoản.
  for (const order of state.orders || []) {
    const userId = orderUserId(order);
    if (!userId || userId === 'guest' || state.users.some((user) => String(user.id) === userId)) continue;
    state.users.push({
      id: userId,
      name: String(order.customer?.name || userId),
      email: String(order.customer?.email || ''),
      role: 'customer',
      status: 'active',
      orders: 0,
      spent: 0,
      tryons: 0,
      vip: 'Thành viên',
      joinedAt: finite(order.createdAt, now),
    });
  }
  state.vipMemberships = deriveVipMemberships(state, now);
  state.users = (state.users || []).map((user) => {
    const status = vipStatus(state, user.id, now);
    const mine = (state.orders || []).filter((order) => orderUserId(order) === String(user.id));
    const successful = mine.filter(isVipQualifyingOrder);
    return {
      ...user,
      orders: mine.filter((order) => !['cancelled', 'canceled'].includes(String(order.status || '').toLowerCase())).length,
      spent: successful.reduce((sum, order) => sum + vipQualifyingSpend(order), 0),
      vip: status.tier,
      vipMembership: status,
    };
  });
  return state;
}

module.exports = {
  VIP_CONFIG,
  vipRule,
  monthBounds,
  isVipQualifyingOrder,
  vipQualifyingSpend,
  deriveVipMemberships,
  vipStatus,
  vipDiscountForSelection,
  reconcileVipState,
};
