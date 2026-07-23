// Tra cứu payment/return-request và khoá đối chiếu giỏ hàng cho phiên thanh
// toán — dùng chung giữa routes/orders.js, routes/paymentsStripe.js,
// routes/paymentsVnpay.js, routes/payments.js và routes/returns.js.
function findPayment(state, id) {
  const key = String(id || '');
  return (state.payments || []).find((item) => [item.id, item.code, item.orderId, item.orderCode, item.paymentIntentId, item.checkoutSessionId, item.transactionCode].map(String).includes(key));
}

function findReturnRequest(state, id) {
  const key = String(id || '');
  const requests = state.returnRequests || [];
  const exact = requests.find((item) => [item.id, item.code].map(String).includes(key));
  if (exact) return exact;
  return requests
    .filter((item) => [item.orderId, item.orderCode].map(String).includes(key))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
}

function checkoutItemsKey(items = []) {
  return JSON.stringify(items.map((item) => ({
    slug: String(item.slug || item.productId || ''),
    color: String(item.colorName || item.color || ''),
    size: String(item.size || ''),
    qty: Number(item.qty || 0),
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))));
}

function reusableStripeOrder(state, body = {}) {
  const requestedUserId = String(body?.userId || body?.customer?.id || '');
  const requestedAddress = String(body?.address || '').trim();
  const requestedItemsKey = checkoutItemsKey(body?.items || []);
  return [...(state.orders || [])].reverse().find((item) =>
    item.status === 'pending_payment'
    && String(item.userId || '') === requestedUserId
    && String(item.address || '').trim() === requestedAddress
    && checkoutItemsKey(item.items || []) === requestedItemsKey
    && Date.now() - Number(item.createdAt || 0) < 30 * 60 * 1000);
}

function reusableProviderOrder(state, body = {}, provider) {
  const requestedUserId = String(body?.userId || body?.customer?.id || '');
  const requestedAddress = String(body?.address || '').trim();
  const requestedItemsKey = checkoutItemsKey(body?.items || []);
  return [...(state.orders || [])].reverse().find((item) =>
    item.status === 'pending_payment'
    && item.payment?.provider === provider
    && String(item.userId || '') === requestedUserId
    && String(item.address || '').trim() === requestedAddress
    && checkoutItemsKey(item.items || []) === requestedItemsKey
    && Date.now() - Number(item.createdAt || 0) < 30 * 60 * 1000);
}

module.exports = { findPayment, findReturnRequest, checkoutItemsKey, reusableStripeOrder, reusableProviderOrder };
