// NGUỒN SỰ THẬT DUY NHẤT cho việc trừ/hoàn tồn kho.
//
// Trước file này, tồn kho chỉ có MỘT chiều: routes/orders.js trừ kho lúc tạo
// đơn và không nơi nào cộng lại. Hệ quả đo được trên máy thật: huỷ một đơn 2
// sản phẩm làm bay 2 sản phẩm khỏi kho vĩnh viễn, trả hàng và hoàn tiền xong
// vẫn mất 1 sản phẩm, thanh toán trực tuyến thất bại cũng giữ luôn hàng đã
// giữ chỗ. Sau vài chục đơn huỷ/trả, kho trên hệ thống cạn trong khi hàng vẫn
// nằm trong cửa hàng — sản phẩm biến mất khỏi gian hàng vì recommend.js và
// admin đều coi tổng tồn = 0 là hết hàng.
//
// Mọi đường trả hàng về kho đều đi qua đây, và mỗi đường đều CHỈ CHẠY MỘT LẦN:
// webhook Stripe có thể gửi lại cùng một sự kiện, admin có thể bấm duyệt hai
// lần, reconcile chạy mỗi 15 giây — nên cộng kho nhiều lần là rủi ro thật, còn
// nguy hiểm hơn cả không cộng. Dấu mốc idempotent nằm ngay trên chính bản ghi
// (order.stockRestoredAt / returnRequest.stockRestoredAt) nên nó bền qua
// restart và qua cả MongoDB lẫn db.json.

// Cộng thẳng số lượng vào đúng biến thể. Không tự phán đoán gì — nơi gọi đã
// quyết định là hàng thực sự quay lại kho.
// Tìm ĐÚNG biến thể để cộng kho. findVariant() của pricing.js cố ý dễ dãi: khớp
// không được cả màu lẫn size thì lùi về chỉ khớp size. Với việc TÍNH GIÁ thì
// chấp nhận được, nhưng với việc CỘNG KHO thì đó là cộng nhầm hàng.
//
// Trường hợp thật gặp trong dữ liệu: vài đơn cũ còn ghi màu "Mực" và
// "Sumi (mực)", những tên đã được đổi thành "Sumi". Hoàn kho các đơn đó qua
// findVariant sẽ dồn số lượng vào một màu khác — kho của màu đó phình lên trong
// khi màu thật vẫn thiếu, và không ai biết vì chẳng có lỗi nào được báo.
function exactVariant(product, colorName, size) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  const wantColor = String(colorName || 'Mặc định');
  const wantSize = String(size || 'M');
  const exact = variants.find((variant) => String(variant.colorName || 'Mặc định') === wantColor
    && String(variant.size || 'M') === wantSize);
  if (exact) return exact;
  // Sản phẩm chỉ có một màu thì tên màu trên đơn không quan trọng, khớp size là đủ.
  const colors = new Set(variants.map((variant) => String(variant.colorName || 'Mặc định')));
  if (colors.size === 1) return variants.find((variant) => String(variant.size || 'M') === wantSize) || null;
  return null;
}

function addStock(state, items) {
  const restored = [];
  const skipped = [];
  for (const item of items || []) {
    const slug = String(item.slug || item.productId || '');
    const product = (state.products || []).find((p) => p.slug === slug || p.id === slug);
    const qty = Math.max(0, Math.round(Number(item.qty) || 0));
    if (!qty) continue;
    if (!product) { skipped.push({ slug, colorName: item.colorName, size: item.size, qty, reason: 'sản phẩm không còn' }); continue; }
    const variant = exactVariant(product, item.colorName, item.size);
    if (!variant) {
      // Thà bỏ sót và ghi lại còn hơn cộng nhầm sang biến thể khác.
      skipped.push({ slug, colorName: item.colorName, size: item.size, qty, reason: 'biến thể không còn' });
      continue;
    }
    variant.stock = Math.max(0, Number(variant.stock || 0)) + qty;
    restored.push({ slug, colorName: variant.colorName, size: variant.size, qty, stock: variant.stock });
  }
  addStock.lastSkipped = skipped;
  return restored;
}

function logRestock(target, reason, restored) {
  if (!restored.length) return;
  target.stockLedger ||= [];
  target.stockLedger.push({ at: Date.now(), reason, items: restored });
}

/**
 * Hàng chưa từng rời cửa hàng (đơn bị huỷ, thanh toán trực tuyến thất bại hoặc
 * hết hạn) — toàn bộ số lượng đã giữ chỗ được trả lại kho.
 * Idempotent theo order.stockRestoredAt.
 */
function restockCancelledOrder(state, order, reason = 'order-cancelled') {
  if (!order || order.stockRestoredAt) return [];
  const restored = addStock(state, order.items);
  order.stockRestoredAt = Date.now();
  order.stockRestoredReason = reason;
  logRestock(order, reason, restored);
  return restored;
}

/**
 * Hàng đã tới tay khách rồi quay về kho qua quy trình đổi/trả. Chỉ gọi khi cửa
 * hàng đã NHẬN VÀ KIỂM HÀNG ĐẠT (return status = 'received') — đó là thời điểm
 * hàng thật sự nằm trong kho và bán lại được. Yêu cầu bị từ chối thì hàng được
 * gửi trả lại khách nên không cộng kho.
 * Idempotent theo returnRequest.stockRestoredAt.
 */
function restockReceivedReturn(state, returnRequest, reason = 'return-received') {
  if (!returnRequest || returnRequest.kind === 'cancel' || returnRequest.stockRestoredAt) return [];
  const restored = addStock(state, returnRequest.items);
  returnRequest.stockRestoredAt = Date.now();
  returnRequest.stockRestoredReason = reason;
  logRestock(returnRequest, reason, restored);
  return restored;
}

const itemKey = (item) => [String(item?.slug || item?.productId || ''), String(item?.colorName || ''), String(item?.size || '')].join('|');

/**
 * Admin đánh dấu thẳng đơn là "đã trả hàng" qua PATCH /api/orders/:id mà không
 * đi qua quy trình đổi/trả. Hàng về kho, nhưng một phần của đơn có thể ĐÃ được
 * cộng kho bởi một yêu cầu trả từng phần trước đó — cộng lại cả đơn sẽ thổi
 * phồng tồn kho. Chỉ cộng đúng phần số lượng chưa từng được hoàn.
 */
function restockRemainingOrderUnits(state, order, reason = 'order-returned-manual') {
  if (!order || order.stockRestoredAt) return [];
  const alreadyRestored = new Map();
  for (const request of state.returnRequests || []) {
    if (String(request.orderId) !== String(order.id) || !request.stockRestoredAt) continue;
    for (const item of request.items || []) {
      const key = itemKey(item);
      alreadyRestored.set(key, (alreadyRestored.get(key) || 0) + Math.max(0, Number(item.qty) || 0));
    }
  }
  const outstanding = (order.items || []).map((item) => {
    const done = alreadyRestored.get(itemKey(item)) || 0;
    return { ...item, qty: Math.max(0, (Number(item.qty) || 0) - done) };
  }).filter((item) => item.qty > 0);

  const restored = addStock(state, outstanding);
  order.stockRestoredAt = Date.now();
  order.stockRestoredReason = reason;
  logRestock(order, reason, restored);
  return restored;
}

module.exports = { addStock, restockCancelledOrder, restockReceivedReturn, restockRemainingOrderUnits };
