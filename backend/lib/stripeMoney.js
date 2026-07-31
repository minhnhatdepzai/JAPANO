// Quy đổi tiền cho Stripe: hầu hết tiền tệ Stripe nhận đơn vị "cent" (x100),
// riêng nhóm tiền tệ không có phần lẻ (VND, JPY, KRW...) giữ nguyên số nguyên.
const STRIPE_CURRENCY = String(process.env.STRIPE_CURRENCY || 'vnd').trim().toLowerCase();
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);

function stripeAmount(amount, currency = STRIPE_CURRENCY) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return ZERO_DECIMAL.has(String(currency).toLowerCase()) ? Math.round(value) : Math.round(value * 100);
}

function localStripeAmount(amount, currency = STRIPE_CURRENCY) {
  return ZERO_DECIMAL.has(String(currency).toLowerCase()) ? Number(amount || 0) : Number(amount || 0) / 100;
}

module.exports = { STRIPE_CURRENCY, stripeAmount, localStripeAmount };
