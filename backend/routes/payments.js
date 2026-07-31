// Tra cứu 1 giao dịch + hoàn tiền — dùng chung cho cả Stripe lẫn VNPay
// (dispatch theo payment.provider), nên tách khỏi 2 module riêng của từng cổng.
const { findPayment } = require('../lib/paymentLookup');
const { makeStripeHelpers } = require('./paymentsStripe');
const { makeVnpayHelpers } = require('./paymentsVnpay');

module.exports = function registerPaymentsRoutes(api, ctx) {
  const { read, stripe, stripeEnabled, requireAdmin } = ctx;
  const { finalizeStripePaymentIntent, issueStripeRefund } = makeStripeHelpers(ctx);
  const { issueVnpayRefund } = makeVnpayHelpers(ctx);

  api.get('/payments/:id', async (req, res) => {
    let state = read();
    let payment = findPayment(state, req.params.id);
    if (!payment) return res.status(404).json({ ok: false, message: 'Không tìm thấy giao dịch.' });
    // Recover automatically if the app confirmed the card but briefly lost its
    // connection before the native confirmation callback reached this backend.
    if (stripeEnabled() && ['pending', 'failed'].includes(String(payment.status)) && payment.paymentIntentId) {
      try {
        const intent = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
        if (intent.status === 'succeeded') await finalizeStripePaymentIntent(intent.id);
      } catch {
        // Status reads should remain available even while Stripe is unreachable.
      }
      state = read();
      payment = findPayment(state, req.params.id);
    }
    const order = state.orders.find((item) => item.id === payment.orderId) || null;
    res.json({ ok: true, payment, order });
  });

  api.post('/payments/:id/refund', requireAdmin, async (req, res) => {
    try {
      const payment = findPayment(read(), req.params.id);
      if (!payment) throw ctx.httpError(404, 'Không tìm thấy giao dịch.');
      const response = payment.provider === 'vnpay'
        ? await issueVnpayRefund(req.params.id, req.body || {})
        : await issueStripeRefund(req.params.id, req.body || {});
      res.json({ ok: true, ...response });
    } catch (error) {
      res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không hoàn tiền được.' });
    }
  });
};
