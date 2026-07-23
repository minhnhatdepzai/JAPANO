// Đơn "đã thành công thật" (không phải đơn demo/admin-test, không huỷ/hoàn),
// dùng chung giữa routes/catalog.js (đếm sold) và routes/reviews.js (điều
// kiện được đánh giá).
function successfulLiveOrder(order) {
  const status = String(order.status || '').toLowerCase();
  const payment = String(order.payment?.status || '').toLowerCase();
  return !['demo', 'admin-test'].includes(String(order.source || ''))
    && !['cancelled', 'canceled', 'returned', 'refunded', 'failed'].includes(status)
    && (status === 'completed' || payment === 'paid');
}

module.exports = { successfulLiveOrder };
