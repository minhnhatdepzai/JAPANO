// Phạm vi áp dụng và vòng đời của voucher — một chỗ duy nhất.
//
// Hai lỗi mà module này tồn tại để sửa, cả hai đều đo được trên code cũ:
//
// 1. `appliesTo: 'all-products'` được GHI ở bốn nơi nhưng KHÔNG nơi nào ĐỌC.
//    Voucher thưởng mục tiêu 30% vì thế giảm trên toàn bộ giỏ: món mục tiêu
//    100.000₫ nằm cạnh món khác 900.000₫ thì cửa hàng mất 300.000₫ thay vì
//    30.000₫.
//
// 2. `voucher.used` được cộng đúng một chỗ (lúc TẠO đơn) và không bao giờ được
//    trả lại. Thanh toán thất bại, khách huỷ đơn, shop huỷ đơn hay trả hàng
//    đều làm khách mất trắng lượt dùng.
//
// Nguyên tắc: tạo đơn chỉ GIỮ CHỖ (reserved). `used` chỉ tăng khi tiền thực sự
// đã nhận (consumed). Mọi kết thúc không thành công đều nhả chỗ (released).
// `consumed` là trạng thái cuối của một lượt dùng — callback thất bại đến sau
// callback thành công không được phép nhả nó ra.

const RESERVED = 'reserved';
const CONSUMED = 'consumed';
const RELEASED = 'released';

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

function lineKey(item) {
  return [
    String(item?.slug || item?.productId || ''),
    String(item?.colorName || item?.color || ''),
    String(item?.size || ''),
  ].join('|');
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function findVoucher(state, code) {
  const wanted = normalizeCode(code);
  return (state.vouchers || []).find((item) => normalizeCode(item.code) === wanted) || null;
}

/* ---------------------------------------------------------------------------
 * PHẠM VI ÁP DỤNG
 * ------------------------------------------------------------------------- */

// Voucher nào là voucher "chỉ đúng một sản phẩm"? Chỉ khi nó nói ra điều đó.
// Voucher chung, voucher bộ thẻ địa danh và voucher cũ không khai `scope` giữ
// nguyên hành vi toàn đơn — đổi mặc định sẽ lấy mất quyền lợi khách đang có.
function voucherScope(voucher) {
  const declared = String(voucher?.scope || '').toLowerCase();
  if (declared === 'product' || declared === 'order') return declared;
  // Voucher thưởng mục tiêu luôn là phạm vi sản phẩm, kể cả bản phát trước khi
  // có trường `scope` — đó là ý định ban đầu, chỉ là code cũ không thực thi.
  if (String(voucher?.source || '') === 'goal-fund') return 'product';
  return 'order';
}

function eligibleProductIds(voucher) {
  const listed = Array.isArray(voucher?.eligibleProductIds)
    ? voucher.eligibleProductIds.map((value) => String(value)).filter(Boolean)
    : [];
  if (listed.length) return listed;
  if (voucher?.goalProductId) return [String(voucher.goalProductId)];
  return [];
}

function maxEligibleQty(voucher) {
  const declared = finite(voucher?.maxEligibleQty, 0);
  if (declared > 0) return Math.floor(declared);
  return voucherScope(voucher) === 'product' ? 1 : Infinity;
}

function matchesProduct(item, ids) {
  const candidates = new Set([
    String(item?.slug || ''),
    String(item?.productId || ''),
    String(item?.id || ''),
  ].filter(Boolean));
  return ids.some((id) => candidates.has(String(id)));
}

/* Chọn những đơn vị hàng được hưởng giảm giá.
 *
 * Với phạm vi sản phẩm và `maxEligibleQty = 1`, chỉ MỘT đơn vị được giảm — kể
 * cả khi khách mua hai cái cùng món. Ưu tiên đơn vị đắt nhất để phần giảm có
 * lợi cho khách, nhưng trần `maxDiscountAmount` vẫn chặn ở trên.
 */
function eligibleUnits(voucher, items) {
  const rows = Array.isArray(items) ? items : [];
  if (voucherScope(voucher) === 'order') {
    return rows.map((item) => ({
      key: lineKey(item),
      price: Math.max(0, finite(item.price)),
      qty: Math.max(0, Math.floor(finite(item.qty ?? item.quantity, 0))),
    })).filter((row) => row.qty > 0);
  }
  const ids = eligibleProductIds(voucher);
  if (!ids.length) return [];
  const matched = rows
    .filter((item) => matchesProduct(item, ids))
    .map((item) => ({
      key: lineKey(item),
      price: Math.max(0, finite(item.price)),
      qty: Math.max(0, Math.floor(finite(item.qty ?? item.quantity, 0))),
    }))
    .filter((row) => row.qty > 0)
    .sort((left, right) => right.price - left.price);
  let budget = maxEligibleQty(voucher);
  const picked = [];
  for (const row of matched) {
    if (budget <= 0) break;
    const take = Math.min(row.qty, budget);
    picked.push({ ...row, qty: take });
    budget -= take;
  }
  return picked;
}

/* Tính giảm giá và phân bổ về từng dòng hàng.
 *
 * Tổng các khoản phân bổ LUÔN bằng đúng `discount` — phần dư do làm tròn được
 * dồn vào dòng cuối, nếu không thì lúc hoàn tiền sẽ lệch vài đồng và không ai
 * giải thích được con số.
 */
function discountFor(voucher, items) {
  const units = eligibleUnits(voucher, items);
  const eligibleSubtotal = units.reduce((sum, row) => sum + row.price * row.qty, 0);
  if (!(eligibleSubtotal > 0)) {
    return { discount: 0, eligibleSubtotal: 0, allocations: [], units };
  }
  const type = String(voucher?.type || 'percent');
  let discount = type === 'percent'
    ? Math.round(eligibleSubtotal * Math.min(100, Math.max(0, finite(voucher?.value))) / 100)
    : Math.min(eligibleSubtotal, Math.max(0, finite(voucher?.value)));
  const cap = finite(voucher?.maxDiscountAmount, 0);
  if (cap > 0) discount = Math.min(discount, cap);
  discount = Math.max(0, Math.min(eligibleSubtotal, Math.round(discount)));

  const allocations = [];
  let remaining = discount;
  units.forEach((row, index) => {
    const lineValue = row.price * row.qty;
    const share = index === units.length - 1
      ? remaining
      : Math.min(remaining, Math.round((discount * lineValue) / eligibleSubtotal));
    remaining -= share;
    if (share > 0) allocations.push({ key: row.key, qty: row.qty, lineValue, amount: share });
  });
  return { discount, eligibleSubtotal, allocations, units };
}

/* ---------------------------------------------------------------------------
 * VÒNG ĐỜI
 * ------------------------------------------------------------------------- */

function redemptions(state) {
  if (!Array.isArray(state.voucherRedemptions)) state.voucherRedemptions = [];
  return state.voucherRedemptions;
}

// Bản ghi cũ không có `status`: đọc BẢO THỦ là đã tiêu. Đoán là "reserved" rồi
// nhả ra sẽ tặng thêm lượt dùng cho voucher đã tiêu thật.
function statusOf(redemption) {
  const raw = String(redemption?.status || '');
  return [RESERVED, CONSUMED, RELEASED].includes(raw) ? raw : CONSUMED;
}

function redemptionForOrder(state, orderId) {
  return redemptions(state).find((row) => String(row.orderId) === String(orderId)) || null;
}

function activeRedemptions(state, code) {
  const wanted = normalizeCode(code);
  return redemptions(state).filter((row) => normalizeCode(row.code) === wanted
    && [RESERVED, CONSUMED].includes(statusOf(row)));
}

// Bao nhiêu lượt đang bị giữ hoặc đã tiêu — đây là con số chặn, không phải
// `voucher.used`. Hai request tạo đơn gần như đồng thời cùng đọc `used = 0`,
// nhưng cái thứ hai nhìn thấy reservation của cái thứ nhất trong cùng state.
function usageCount(state, voucher) {
  const fromLedger = activeRedemptions(state, voucher?.code).length;
  return Math.max(fromLedger, finite(voucher?.used, 0));
}

function hasCapacity(state, voucher) {
  const limit = Math.max(1, finite(voucher?.limit, 1));
  return usageCount(state, voucher) < limit;
}

/* Giữ chỗ khi tạo đơn. KHÔNG tăng `voucher.used`.
 *
 * Idempotent theo `orderId`: gọi lại cho cùng một đơn trả về bản ghi cũ thay vì
 * tạo bản ghi thứ hai.
 */
function reserve(state, { voucher, userId, orderId, discount, eligibleSubtotal, allocations, scope }, now = Date.now()) {
  const existing = redemptionForOrder(state, orderId);
  if (existing) return existing;
  const record = {
    id: `redeem-${orderId}`,
    voucherId: voucher?.id || null,
    code: voucher.code,
    userId: String(userId || ''),
    orderId: String(orderId),
    status: RESERVED,
    discount: Math.max(0, finite(discount)),
    eligibleSubtotal: Math.max(0, finite(eligibleSubtotal)),
    allocations: Array.isArray(allocations) ? allocations : [],
    scope: scope || voucherScope(voucher),
    reservedAt: now,
    consumedAt: null,
    releasedAt: null,
    releaseReason: null,
    replacementVoucherCode: null,
    // `redeemedAt` giữ lại cho báo cáo/ERD cũ vốn đọc trường này.
    redeemedAt: now,
    history: [{ status: RESERVED, at: now }],
  };
  redemptions(state).push(record);
  return record;
}

/* Chốt lượt dùng khi tiền đã thực sự về. Idempotent. */
function consume(state, orderId, reason = '', now = Date.now()) {
  const record = redemptionForOrder(state, orderId);
  if (!record) return null;
  const status = statusOf(record);
  if (status === CONSUMED) return record;
  if (status === RELEASED) {
    // Thứ tự sự kiện bất khả thi: callback "đã trả tiền" đáng tin đến sau khi
    // chỗ đã bị nhả. Không âm thầm sửa số — đánh dấu để người thật xem lại.
    record.needsAudit = true;
    record.auditReason = 'paid-callback-after-release';
    record.history = [...(record.history || []), { status: 'audit', at: now, note: reason || 'paid sau khi release' }];
    return record;
  }
  const voucher = findVoucher(state, record.code);
  if (voucher) voucher.used = Math.max(0, finite(voucher.used, 0)) + 1;
  record.status = CONSUMED;
  record.consumedAt = now;
  record.redeemedAt = now;
  record.history = [...(record.history || []), { status: CONSUMED, at: now, note: reason || undefined }];
  return record;
}

/* Nhả chỗ khi đơn kết thúc mà tiền không về. Idempotent.
 * `consumed` là trạng thái cuối: không bao giờ nhả một lượt đã tiêu ở đây.
 */
function release(state, orderId, reason = '', now = Date.now()) {
  const record = redemptionForOrder(state, orderId);
  if (!record) return null;
  const status = statusOf(record);
  if (status !== RESERVED) return record;
  record.status = RELEASED;
  record.releasedAt = now;
  record.releaseReason = String(reason || '').slice(0, 200) || null;
  record.history = [...(record.history || []), { status: RELEASED, at: now, note: record.releaseReason || undefined }];
  return record;
}

/* Voucher thay thế sau khi hoàn tiền THÀNH CÔNG cho toàn bộ đơn.
 *
 * Bản ghi cũ không bị xoá — lịch sử phải kể đúng chuyện đã xảy ra. Mã sinh xác
 * định từ (mã gốc + id yêu cầu hoàn) nên gọi lại bao nhiêu lần cũng chỉ ra một
 * voucher, kể cả khi callback bị lặp.
 */
const REISSUE_MIN_DAYS = 30;

function reissue(state, { orderId, refundRef }, now = Date.now()) {
  const record = redemptionForOrder(state, orderId);
  if (!record) return null;
  if (statusOf(record) !== CONSUMED) return null;
  if (record.replacementVoucherCode) {
    return findVoucher(state, record.replacementVoucherCode);
  }
  const original = findVoucher(state, record.code);
  if (!original) return null;
  const code = `${normalizeCode(original.code)}-R${hashString(`${original.code}|${refundRef || orderId}`).slice(-4)}`;
  const already = findVoucher(state, code);
  if (already) {
    record.replacementVoucherCode = code;
    return already;
  }
  const remainingMs = original.expiry && original.expiry !== '—'
    ? new Date(`${original.expiry}T23:59:59`).getTime() - now
    : 0;
  const days = Math.max(REISSUE_MIN_DAYS, Math.ceil(remainingMs / 86400000));
  const replacement = {
    ...JSON.parse(JSON.stringify(original)),
    code,
    used: 0,
    active: true,
    limit: Math.max(1, finite(original.limit, 1)),
    expiry: new Date(now + days * 86400000).toISOString().slice(0, 10),
    reissuedFromCode: original.code,
    reissuedForOrderId: String(orderId),
    reissuedForRefundRef: refundRef ? String(refundRef) : null,
    issuedAt: now,
    reason: `Hoàn tiền đơn hàng — cấp lại quyền lợi của mã ${original.code}`,
  };
  delete replacement.id;
  delete replacement._id;
  (state.vouchers || (state.vouchers = [])).push(replacement);
  record.replacementVoucherCode = code;
  record.history = [...(record.history || []), { status: 'reissued', at: now, note: code }];
  return replacement;
}

/* Voucher đang bị giữ chỗ mà hết hạn trong lúc chờ, rồi đơn bị huỷ: khách
 * không được mất quyền lợi chỉ vì thời gian chờ. Gia hạn tại chỗ, idempotent.
 */
function extendIfExpiredWhileReserved(state, orderId, now = Date.now()) {
  const record = redemptionForOrder(state, orderId);
  if (!record) return null;
  const voucher = findVoucher(state, record.code);
  if (!voucher || !voucher.expiry || voucher.expiry === '—') return null;
  const expiresAt = new Date(`${voucher.expiry}T23:59:59`).getTime();
  if (!(expiresAt < now)) return null;
  voucher.expiry = new Date(now + REISSUE_MIN_DAYS * 86400000).toISOString().slice(0, 10);
  voucher.extendedFromExpiry = voucher.extendedFromExpiry || null;
  record.history = [...(record.history || []), { status: 'extended', at: now, note: voucher.expiry }];
  return voucher;
}

// Phân bổ voucher theo dòng hàng cho một đơn: bản ghi mới có allocations chính
// xác; đơn cũ không có thì trả null để bên gọi rơi về chia theo tỉ lệ.
function allocationsForOrder(state, order) {
  const record = redemptionForOrder(state, order?.id);
  const fromRecord = Array.isArray(record?.allocations) ? record.allocations : null;
  if (fromRecord && fromRecord.length) return fromRecord;
  const fromOrder = Array.isArray(order?.voucherAllocations) ? order.voucherAllocations : null;
  if (fromOrder && fromOrder.length) return fromOrder;
  return null;
}

module.exports = {
  RESERVED,
  CONSUMED,
  RELEASED,
  REISSUE_MIN_DAYS,
  lineKey,
  voucherScope,
  eligibleProductIds,
  maxEligibleQty,
  eligibleUnits,
  discountFor,
  statusOf,
  redemptionForOrder,
  activeRedemptions,
  usageCount,
  hasCapacity,
  reserve,
  consume,
  release,
  reissue,
  extendIfExpiredWhileReserved,
  allocationsForOrder,
};
