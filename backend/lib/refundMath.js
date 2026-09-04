// Tính tiền hoàn cho TỪNG SẢN PHẨM trong một đơn nhiều món.
//
// Nguyên tắc phân bổ (để con số hoàn về luôn giải thích được cho khách):
//  - Voucher, ưu đãi thanh toán và các khoản giảm chung khác được chia theo tỉ
//    lệ giá trị dòng hàng: món chiếm 40% giá trị đơn thì gánh 40% khoản giảm.
//  - Ưu đãi VIP chỉ áp cho đúng số lượng của đúng sản phẩm đã ghi trong
//    vipPromotion, nên chỉ được trừ khi chính món đó được trả, và trừ theo tỉ lệ
//    số lượng trả trên số lượng đã được giảm.
//  - Phí vận chuyển chỉ hoàn khi khách trả TOÀN BỘ đơn — trả một phần thì cửa
//    hàng vẫn đã tốn phí giao lô hàng đó.
//
// Trạng thái "đã trả" được suy từ chính danh sách returnRequests: mọi yêu cầu
// chưa bị từ chối/huỷ đều giữ chỗ số lượng, nên không thể trả trùng một món.
const TERMINAL_RETURN_STATUSES = ['rejected', 'cancelled'];

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

function itemKey(item) {
  return [
    String(item?.slug || item?.productId || ''),
    String(item?.colorName || ''),
    String(item?.size || ''),
  ].join('|');
}

// Số lượng đã nằm trong một yêu cầu trả khác (đang xử lý hoặc đã hoàn tiền).
function reservedQuantities(state, orderId, excludeRequestId = '') {
  const map = new Map();
  for (const request of state.returnRequests || []) {
    if (String(request.orderId) !== String(orderId)) continue;
    if (String(request.id) === String(excludeRequestId)) continue;
    if (request.kind === 'cancel') continue;
    if (TERMINAL_RETURN_STATUSES.includes(String(request.status))) continue;
    for (const item of request.items || []) {
      const key = itemKey(item);
      map.set(key, (map.get(key) || 0) + Math.max(0, finite(item.qty)));
    }
  }
  return map;
}

// Danh sách món khách còn có thể yêu cầu trả, kèm số lượng còn lại.
function returnableItems(state, order, excludeRequestId = '') {
  const reserved = reservedQuantities(state, order.id, excludeRequestId);
  return (order.items || []).map((item) => {
    const key = itemKey(item);
    const already = reserved.get(key) || 0;
    const remaining = Math.max(0, finite(item.qty) - already);
    return { ...item, returnedQty: already, remainingQty: remaining };
  });
}

// Chọn món để trả. Không truyền items → mặc định trả toàn bộ phần còn lại
// (giữ nguyên hành vi cũ của yêu cầu trả cả đơn).
function resolveSelection(state, order, requestedItems, httpError, excludeRequestId = '') {
  const available = returnableItems(state, order, excludeRequestId);
  const openItems = available.filter((item) => item.remainingQty > 0);
  if (!openItems.length) throw httpError(409, 'Mọi sản phẩm trong đơn này đều đã có yêu cầu trả hàng.');

  if (!Array.isArray(requestedItems) || !requestedItems.length) {
    return openItems.map((item) => ({ ...item, qty: item.remainingQty }));
  }

  const byKey = new Map(available.map((item) => [itemKey(item), item]));
  const selection = [];
  for (const raw of requestedItems) {
    const key = itemKey(raw);
    const source = byKey.get(key)
      || available.find((item) => String(item.slug || item.productId) === String(raw.slug || raw.productId) && item.remainingQty > 0);
    if (!source) throw httpError(400, `Sản phẩm "${raw.name || raw.slug || raw.productId}" không có trong đơn hàng này.`);
    const qty = Math.max(1, Math.round(finite(raw.qty, source.remainingQty)));
    if (qty > source.remainingQty) {
      throw httpError(400, `"${source.name}" chỉ còn ${source.remainingQty} sản phẩm có thể yêu cầu trả.`);
    }
    if (selection.some((item) => itemKey(item) === itemKey(source))) {
      throw httpError(400, `"${source.name}" bị chọn trùng trong yêu cầu.`);
    }
    selection.push({ ...source, qty });
  }
  if (!selection.length) throw httpError(400, 'Vui lòng chọn ít nhất một sản phẩm cần trả.');
  return selection;
}

function vipAllocation(order, selection) {
  const promotion = order.vipPromotion;
  const vipDiscount = Math.max(0, finite(order.vipDiscount));
  if (!promotion || !vipDiscount) return 0;
  const line = selection.find((item) => String(item.slug || item.productId) === String(promotion.productId)
    && (!promotion.colorName || String(item.colorName) === String(promotion.colorName))
    && (!promotion.size || String(item.size) === String(promotion.size)));
  if (!line) return 0;
  const discountedUnits = Math.max(1, finite(promotion.discountedUnits, 1));
  const ratio = Math.min(1, finite(line.qty) / discountedUnits);
  return Math.round(vipDiscount * ratio);
}

// coversWholeOrder: mọi món của đơn đều nằm trong lần trả này (không còn gì để
// trả nữa) → hoàn cả phí vận chuyển và chuyển đơn sang trạng thái "đã trả hàng".
/* Phân bổ voucher theo dòng hàng, nếu đơn có ghi.
 *
 * Trả về Map(lineKey -> {amount, qty}) hoặc null cho đơn cũ.
 */
function voucherAllocationMap(order) {
  const rows = Array.isArray(order?.voucherAllocations) && order.voucherAllocations.length
    ? order.voucherAllocations
    : null;
  if (!rows) return null;
  const map = new Map();
  for (const row of rows) {
    const key = String(row?.key || '');
    if (!key) continue;
    const previous = map.get(key) || { amount: 0, qty: 0 };
    map.set(key, {
      amount: previous.amount + Math.max(0, finite(row.amount)),
      qty: previous.qty + Math.max(0, finite(row.qty)),
    });
  }
  return map.size ? map : null;
}

/* Trả một phần của dòng có nhiều đơn vị nhưng chỉ MỘT đơn vị được giảm.
 *
 * Quy tắc làm tròn xác định: hoàn theo tỉ lệ số đơn vị trả trên số đơn vị ĐƯỢC
 * GIẢM của dòng đó, làm tròn xuống rồi kẹp trong khoản đã phân bổ. Không bao
 * giờ hoàn quá số tiền thực trả cho dòng đó.
 */
function voucherAllocation(order, selection, allocations) {
  let total = 0;
  for (const item of selection) {
    const key = itemKey(item);
    const row = allocations.get(key);
    if (!row || !(row.amount > 0)) continue;
    const discountedQty = Math.max(1, finite(row.qty, 1));
    const returnedQty = Math.max(0, finite(item.qty));
    const share = returnedQty >= discountedQty
      ? row.amount
      : Math.floor((row.amount * returnedQty) / discountedQty);
    total += Math.max(0, Math.min(row.amount, share));
  }
  return total;
}

function computeRefund(state, order, selection, excludeRequestId = '') {
  const subtotal = Math.max(0, finite(order.subtotal) || (order.items || []).reduce((sum, item) => sum + finite(item.price) * finite(item.qty), 0));
  const selectedValue = selection.reduce((sum, item) => sum + finite(item.price) * finite(item.qty), 0);
  const totalUnits = (order.items || []).reduce((sum, item) => sum + finite(item.qty), 0);
  const reserved = reservedQuantities(state, order.id, excludeRequestId);
  const reservedUnits = [...reserved.values()].reduce((sum, qty) => sum + qty, 0);
  const selectedUnits = selection.reduce((sum, item) => sum + finite(item.qty), 0);
  const coversWholeOrder = totalUnits > 0 && reservedUnits + selectedUnits >= totalUnits;

  const vipDiscount = Math.max(0, finite(order.vipDiscount));
  const generalDiscount = Math.max(0, finite(order.discount) - vipDiscount);
  // Voucher phạm vi sản phẩm chỉ giảm đúng một vài dòng hàng, nên chia đều theo
  // giá trị là sai: trả lại món KHÔNG được giảm mà vẫn bị trừ, còn trả món ĐƯỢC
  // giảm lại được hoàn quá số thực trả. Đơn mới lưu sẵn phân bổ theo dòng; đơn
  // cũ không có thì mới rơi về chia theo tỉ lệ.
  const voucherDiscount = Math.max(0, finite(order.voucherDiscount));
  const otherGeneral = Math.max(0, generalDiscount - voucherDiscount);
  const allocations = voucherAllocationMap(order);
  const allocatedVoucher = allocations
    ? voucherAllocation(order, selection, allocations)
    : (subtotal > 0 ? Math.round((voucherDiscount * selectedValue) / subtotal) : 0);
  const allocatedOther = subtotal > 0 ? Math.round((otherGeneral * selectedValue) / subtotal) : 0;
  const allocatedGeneral = Math.min(generalDiscount, allocatedVoucher + allocatedOther);
  const allocatedVip = vipAllocation(order, selection);
  const ship = coversWholeOrder ? Math.max(0, finite(order.ship)) : 0;
  const amount = Math.max(0, selectedValue - allocatedGeneral - allocatedVip + ship);

  return {
    amount,
    coversWholeOrder,
    breakdown: {
      itemsValue: selectedValue,
      discountAllocated: allocatedGeneral,
      voucherDiscountAllocated: allocatedVoucher,
      voucherAllocationSource: allocations ? 'line-allocations' : 'pro-rata-fallback',
      vipDiscountAllocated: allocatedVip,
      shipRefunded: ship,
      orderSubtotal: subtotal,
    },
  };
}

// Đơn đã trả hết mọi món (và các yêu cầu đó đã hoàn tiền) thì bản thân đơn hàng
// mới được coi là "đã trả hàng".
function allItemsRefunded(state, order) {
  const totalUnits = (order.items || []).reduce((sum, item) => sum + finite(item.qty), 0);
  if (!totalUnits) return false;
  const refundedUnits = (state.returnRequests || [])
    .filter((request) => String(request.orderId) === String(order.id) && request.kind !== 'cancel' && request.status === 'refunded')
    .reduce((sum, request) => sum + (request.items || []).reduce((inner, item) => inner + finite(item.qty), 0), 0);
  return refundedUnits >= totalUnits;
}

module.exports = {
  itemKey,
  voucherAllocationMap,
  reservedQuantities,
  returnableItems,
  resolveSelection,
  computeRefund,
  allItemsRefunded,
};
