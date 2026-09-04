// Thanh toán thẻ qua Stripe (test mode): PaymentIntent gốc trong app + Checkout
// Session dự phòng, cộng hoàn tiền. finalizeStripeCheckout/finalizeStripePaymentIntent/
// markStripe*/applyStripeRefundToState cũng được webhook Stripe (đăng ký ở
// server.js, trước body-parser JSON) và routes/payments.js, routes/returns.js dùng lại
// — nên được export qua makeStripeHelpers(ctx) để tạo lại với cùng ctx dùng chung.
const { stripeAmount, localStripeAmount, STRIPE_CURRENCY } = require('../lib/stripeMoney');
const { consume: consumeVoucher, release: releaseVoucher } = require('../lib/voucherLifecycle');
const { findPayment, findReturnRequest, checkoutItemsKey, reusableStripeOrder } = require('../lib/paymentLookup');
const { restockCancelledOrder, restockRemainingOrderUnits } = require('../lib/inventory');
const { makeCreateOrderInState, requestedVipProductId } = require('./orders');

function makeStripeHelpers(ctx) {
  const { read, update, httpError, stripe, stripeEnabled, reconcileFlagRewards, flagcardCollectionView, reconcileGoalRewards, pushNotification, sendPaymentReceipt } = ctx;
  const createOrderInState = makeCreateOrderInState(ctx);

  function applyStripeRefundToState(refund) {
    if (!refund?.id) return null;
    let response = null;
    update((state) => {
      const intentId = String(typeof refund.payment_intent === 'object' ? refund.payment_intent?.id : refund.payment_intent || '');
      const payment = findPayment(state, intentId)
        || (state.payments || []).find((item) => (item.refunds || []).some((entry) => entry.id === refund.id));
      if (!payment) return state;
      const now = Date.now();
      const record = {
        id: String(refund.id),
        amount: localStripeAmount(refund.amount, refund.currency || payment.currency),
        currency: String(refund.currency || payment.currency || STRIPE_CURRENCY),
        status: String(refund.status || 'pending'),
        reason: String(refund.reason || 'requested_by_customer'),
        failureReason: String(refund.failure_reason || ''),
        returnRequestId: String(refund.metadata?.returnRequestId || ''),
        createdAt: Number(refund.created || 0) * 1000 || now,
        updatedAt: now,
      };
      payment.refunds ||= [];
      const existingIndex = payment.refunds.findIndex((item) => item.id === record.id);
      if (existingIndex >= 0) payment.refunds[existingIndex] = { ...payment.refunds[existingIndex], ...record };
      else payment.refunds.push(record);
      payment.refundedAmount = payment.refunds
        .filter((item) => item.status === 'succeeded')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      payment.pendingRefundAmount = payment.refunds
        .filter((item) => item.status === 'pending')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const fullyRefunded = payment.refundedAmount >= Number(payment.amount || 0);
      payment.status = payment.pendingRefundAmount > 0
        ? 'refund_pending'
        : fullyRefunded
          ? 'refunded'
          : payment.refundedAmount > 0
            ? 'partially_refunded'
            : 'paid';
      payment.refundId = record.id;
      if (payment.refundedAmount > 0) payment.refundedAt = now;
      payment.updatedAt = now;

      const order = state.orders.find((item) => item.id === payment.orderId);
      if (order) {
        order.payment = {
          ...order.payment,
          status: payment.status,
          refundId: record.id,
          refundedAmount: payment.refundedAmount,
          pendingRefundAmount: payment.pendingRefundAmount,
        };
      }
      const returnRequest = findReturnRequest(state, record.returnRequestId)
        || (state.returnRequests || []).find((item) => item.paymentId === payment.id && item.refundId === record.id);
      if (returnRequest) {
        returnRequest.refundId = record.id;
        returnRequest.refundStatus = record.status;
        returnRequest.updatedAt = now;
        if (record.status === 'pending') returnRequest.status = 'refund_pending';
        else if (record.status === 'failed' || record.status === 'canceled') returnRequest.status = 'refund_failed';
        else if (record.status === 'succeeded') returnRequest.status = 'refunded';
        returnRequest.timeline ||= [];
        if (!returnRequest.timeline.some((item) => item.s === returnRequest.status && item.refundId === record.id)) {
          returnRequest.timeline.push({ s: returnRequest.status, at: now, refundId: record.id });
        }
        if (order) {
          order.returnStatus = returnRequest.status;
          order.returnRequest = { id: returnRequest.id, code: returnRequest.code, status: returnRequest.status };
          if (returnRequest.status === 'refunded' && fullyRefunded) order.status = 'returned';
        }
      } else if (order && fullyRefunded) {
        // Hoàn tiền thẳng từ trang quản trị, không đi qua yêu cầu đổi/trả — vẫn
        // phải hoàn kho, nếu không mỗi lần hoàn tiền lại làm bốc hơi tồn kho.
        order.status = order.status === 'completed' ? 'returned' : 'cancelled';
        if (order.status === 'returned') restockRemainingOrderUnits(state, order, 'gateway-full-refund');
        else restockCancelledOrder(state, order, 'gateway-full-refund');
      }
      if (order) {
        order.history ||= [];
        const historyStatus = returnRequest?.status || payment.status;
        if (!order.history.some((item) => item.s === historyStatus && item.refundId === record.id)) {
          order.history.push({ s: historyStatus, at: now, refundId: record.id, amount: record.amount });
        }
      }
      response = { payment, order, refund: record, returnRequest };
      return state;
    });
    return response;
  }

  function markStripeCheckoutFailed(sessionId, reason = 'payment_failed') {
    let result = null;
    update((state) => {
      const payment = findPayment(state, sessionId);
      if (!payment || payment.status === 'paid' || payment.status === 'refunded') return state;
      payment.status = 'failed';
      payment.failureReason = reason;
      payment.updatedAt = Date.now();
      const order = state.orders.find((item) => item.id === payment.orderId);
      if (order) {
        order.payment.status = 'failed';
        order.history ||= [];
        order.history.push({ s: 'payment_failed', at: Date.now() });
        // Kho đã bị giữ chỗ lúc tạo đơn; thanh toán hỏng thì hàng chưa bao giờ
        // rời cửa hàng nên phải nhả lại để khách khác mua được.
        restockCancelledOrder(state, order, 'stripe-checkout-failed');
        // Voucher cũng vậy: chỗ đã giữ phải nhả để khách dùng lại được.
        releaseVoucher(state, order.id, 'stripe-checkout-failed');
      }
      result = { payment, order };
      return state;
    });
    return result;
  }

  async function finalizeStripeCheckout(sessionId) {
    if (!stripeEnabled()) throw httpError(503, 'Chế độ thử nghiệm Stripe chưa sẵn sàng.');
    const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
      expand: ['payment_intent.latest_charge'],
    });
    if (!['paid', 'no_payment_required'].includes(String(session.payment_status))) {
      throw httpError(402, `Stripe chưa xác nhận thanh toán. Trạng thái: ${session.payment_status}.`);
    }
    const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
    const intentId = String(intent?.id || session.payment_intent || '');
    if (!intentId) throw httpError(502, 'Stripe không trả PaymentIntent cho Checkout Session.');
    const charge = intent && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    let result = null;
    const state = update((next) => {
      const payment = findPayment(next, session.id) || findPayment(next, session.metadata?.orderId);
      const order = next.orders.find((item) => item.id === (payment?.orderId || session.metadata?.orderId));
      if (!payment || !order) return next;
      const now = Date.now();
      const card = charge?.payment_method_details?.card;
      // Webhook Stripe, lượt reconcile và lượt xác nhận từ app có thể cùng chạy
      // qua đây cho MỘT giao dịch — nhớ trạng thái trước khi ghi đè để chỉ gửi
      // biên nhận đúng một lần.
      const wasPaid = payment.status === 'paid';
      payment.status = 'paid';
      payment.paymentIntentId = intentId;
      payment.transactionCode = intentId;
      payment.checkoutSessionId = session.id;
      payment.amount = localStripeAmount(session.amount_total, session.currency);
      payment.amountSubtotal = localStripeAmount(session.amount_subtotal, session.currency);
      payment.currency = String(session.currency || STRIPE_CURRENCY);
      payment.paidAt ||= now;
      payment.updatedAt = now;
      payment.refundable = true;
      payment.chargeId = String(charge?.id || '');
      payment.receiptUrl = String(charge?.receipt_url || '');
      payment.paymentMethodType = String(charge?.payment_method_details?.type || 'card');
      payment.customer = session.customer_details ? {
        name: String(session.customer_details.name || order.customer?.name || ''),
        email: String(session.customer_details.email || order.customer?.email || ''),
        phone: String(session.customer_details.phone || order.customer?.phone || ''),
        address: session.customer_details.address || null,
      } : payment.customer;
      payment.card = card ? { brand: card.brand, last4: card.last4, funding: card.funding } : payment.card;
      order.payment = {
        ...order.payment,
        method: 'Stripe', provider: 'stripe', status: 'paid', txn: intentId,
        currency: payment.currency, checkoutSessionId: session.id, paymentId: payment.id,
        card: payment.card,
      };
      if (['pending_payment', 'pending'].includes(order.status)) order.status = 'confirmed';
      order.history ||= [];
      if (!order.history.some((item) => item.s === 'paid' && item.txn === intentId)) {
        order.history.push({ s: 'paid', at: now, txn: intentId });
      }
      // Tiền đã thực sự về: chốt lượt dùng voucher đúng một lần. Hàm này
      // idempotent nên webhook lặp hay retry không cộng `used` hai lần.
      consumeVoucher(next, order.id, 'stripe-paid', now);
      reconcileFlagRewards(next);
      if (reconcileGoalRewards) reconcileGoalRewards(next, now, pushNotification);
      result = { order, payment, alreadyPaid: wasPaid };
      return next;
    });
    if (!result) throw httpError(404, 'Không tìm thấy đơn hàng gắn với Stripe Checkout Session.');
    if (!result.alreadyPaid && sendPaymentReceipt) {
      void sendPaymentReceipt(result.order.userId, { order: result.order, payment: result.payment });
    }
    return { ...result, collection: flagcardCollectionView(state, result.order.userId) };
  }

  async function finalizeStripePaymentIntent(paymentIntentId) {
    if (!stripeEnabled()) throw httpError(503, 'Chế độ thử nghiệm Stripe chưa sẵn sàng.');
    const intent = typeof paymentIntentId === 'object'
      ? paymentIntentId
      : await stripe.paymentIntents.retrieve(String(paymentIntentId || ''), { expand: ['latest_charge'] });
    if (String(intent.status) !== 'succeeded') {
      throw httpError(402, `Stripe chưa xác nhận thanh toán. Trạng thái: ${intent.status}.`);
    }

    const snapshot = read();
    const existingPayment = findPayment(snapshot, intent.id) || findPayment(snapshot, intent.metadata?.orderId);
    const existingOrder = existingPayment
      ? snapshot.orders.find((item) => item.id === existingPayment.orderId)
      : snapshot.orders.find((item) => item.id === intent.metadata?.orderId);
    if (!existingPayment || !existingOrder) throw httpError(404, 'Không tìm thấy đơn hàng gắn với Stripe PaymentIntent.');
    if (String(intent.metadata?.orderId || '') !== String(existingOrder.id)) {
      throw httpError(409, 'PaymentIntent không khớp đơn hàng JAPANO.');
    }
    if (Number(intent.amount) !== stripeAmount(existingOrder.total, intent.currency)
      || String(intent.currency || '').toLowerCase() !== String(existingPayment.currency || STRIPE_CURRENCY).toLowerCase()) {
      throw httpError(409, 'Số tiền PaymentIntent không khớp đơn hàng JAPANO.');
    }

    const charge = intent.latest_charge && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    let result = null;
    const state = update((next) => {
      const payment = findPayment(next, intent.id) || findPayment(next, intent.metadata?.orderId);
      const order = payment ? next.orders.find((item) => item.id === payment.orderId) : null;
      if (!payment || !order) return next;
      const now = Date.now();
      const card = charge?.payment_method_details?.card;
      const billing = charge?.billing_details;
      const wasPaid = payment.status === 'paid'; // chống gửi biên nhận trùng, xem finalizeStripeCheckout
      payment.status = 'paid';
      payment.intentStatus = String(intent.status);
      payment.paymentIntentId = intent.id;
      payment.transactionCode = intent.id;
      payment.amount = localStripeAmount(intent.amount_received || intent.amount, intent.currency);
      payment.currency = String(intent.currency || STRIPE_CURRENCY);
      payment.paidAt ||= now;
      payment.updatedAt = now;
      payment.refundable = true;
      payment.chargeId = String(charge?.id || '');
      payment.receiptUrl = String(charge?.receipt_url || '');
      payment.paymentMethodType = String(charge?.payment_method_details?.type || 'card');
      payment.customer = {
        name: String(billing?.name || order.customer?.name || ''),
        email: String(billing?.email || order.customer?.email || ''),
        phone: String(billing?.phone || order.customer?.phone || ''),
        address: billing?.address || null,
      };
      payment.card = card ? { brand: card.brand, last4: card.last4, funding: card.funding } : payment.card;
      order.payment = {
        ...order.payment,
        method: 'Stripe', provider: 'stripe', status: 'paid', txn: intent.id,
        currency: payment.currency, paymentIntentId: intent.id, paymentId: payment.id,
        card: payment.card,
      };
      if (['pending_payment', 'pending'].includes(order.status)) order.status = 'confirmed';
      order.history ||= [];
      if (!order.history.some((item) => item.s === 'paid' && item.txn === intent.id)) {
        order.history.push({ s: 'paid', at: now, txn: intent.id });
      }
      // Tiền đã thực sự về: chốt lượt dùng voucher đúng một lần. Hàm này
      // idempotent nên webhook lặp hay retry không cộng `used` hai lần.
      consumeVoucher(next, order.id, 'stripe-paid', now);
      reconcileFlagRewards(next);
      if (reconcileGoalRewards) reconcileGoalRewards(next, now, pushNotification);
      result = { order, payment, alreadyPaid: wasPaid };
      return next;
    });
    if (!result) throw httpError(404, 'Không tìm thấy giao dịch PaymentIntent để cập nhật.');
    if (!result.alreadyPaid && sendPaymentReceipt) {
      void sendPaymentReceipt(result.order.userId, { order: result.order, payment: result.payment });
    }
    return { ...result, collection: flagcardCollectionView(state, result.order.userId) };
  }

  function markStripePaymentIntentFailed(paymentIntentId, reason = 'payment_failed') {
    let result = null;
    update((state) => {
      const payment = findPayment(state, paymentIntentId);
      const order = payment ? state.orders.find((item) => item.id === payment.orderId) : null;
      if (!payment || !order || payment.status === 'paid' || payment.status === 'refunded') return state;
      payment.status = 'failed';
      payment.intentStatus = 'requires_payment_method';
      payment.failureReason = String(reason || 'payment_failed');
      payment.updatedAt = Date.now();
      order.payment.status = 'failed';
      order.history ||= [];
      order.history.push({ s: 'payment_failed', at: Date.now(), reason: payment.failureReason });
      restockCancelledOrder(state, order, 'stripe-intent-failed');
      releaseVoucher(state, order.id, 'stripe-intent-failed');
      result = { payment, order };
      return state;
    });
    return result;
  }

  function stripeLandingPage({ ok, title, message, orderId = '', status = 'failed' }) {
    const deepLink = `japano://payment-result?orderId=${encodeURIComponent(orderId)}&status=${encodeURIComponent(status)}`;
    const androidIntent = `intent://payment-result?orderId=${encodeURIComponent(orderId)}&status=${encodeURIComponent(status)}#Intent;scheme=japano;package=vn.japano.app;end`;
    const color = ok ? '#15803D' : '#B91C1C';
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui;background:#F4EDE1;color:#1A1410;display:grid;place-items:center;min-height:100vh;margin:0}.box{max-width:520px;background:#fff;padding:32px;border-radius:22px;box-shadow:0 20px 50px #0002;text-align:center}.icon{font-size:42px;color:${color}}h1{font-size:24px}p{line-height:1.6;color:#6B625A}a{display:inline-block;margin-top:14px;background:#1A1410;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700}</style></head><body><main class="box"><div class="icon">${ok ? '✓' : '!'}</div><h1>${title}</h1><p>${message}</p><a id="back" href="${deepLink}">Quay lại ứng dụng JAPANO</a></main><script>var target=/Android/i.test(navigator.userAgent)?${JSON.stringify(androidIntent)}:${JSON.stringify(deepLink)};document.getElementById('back').href=target;setTimeout(function(){location.href=target},900)</script></body></html>`;
  }

  async function issueStripeRefund(paymentId, body = {}) {
    if (!stripeEnabled()) throw httpError(503, 'Chế độ thử nghiệm Stripe chưa sẵn sàng.');
    const snapshot = read();
    const payment = findPayment(snapshot, paymentId);
    if (!payment) throw httpError(404, 'Không tìm thấy giao dịch.');
    if (!payment.refundable || !String(payment.paymentIntentId || '').startsWith('pi_') || String(payment.paymentIntentId).startsWith('pi_seed_')) {
      throw httpError(400, 'Giao dịch mẫu này không tồn tại trên Stripe nên không thể hoàn tiền qua API.');
    }
    if (!['paid', 'partially_refunded'].includes(payment.status)) {
      throw httpError(400, `Giao dịch ở trạng thái ${payment.status}, không thể hoàn tiền.`);
    }
    const alreadyRefunded = Number(payment.refundedAmount || 0) + Number(payment.pendingRefundAmount || 0);
    const remaining = Math.max(0, Number(payment.amount || 0) - alreadyRefunded);
    const requested = body?.amount === undefined || body?.amount === null || body?.amount === ''
      ? remaining
      : Math.min(remaining, Math.max(1, Number(body.amount)));
    if (requested <= 0) throw httpError(400, 'Giao dịch đã được hoàn hoặc đang chờ hoàn đủ tiền.');
    const returnRequestId = String(body.returnRequestId || '');
    const refund = await stripe.refunds.create({
      payment_intent: payment.paymentIntentId,
      amount: stripeAmount(requested, payment.currency),
      reason: 'requested_by_customer',
      metadata: {
        orderId: payment.orderId,
        paymentId: payment.id,
        returnRequestId,
        returnCode: String(body.returnCode || ''),
        source: returnRequestId ? 'japano-return-admin-test' : 'japano-admin-test',
      },
    }, { idempotencyKey: `japano-refund-${payment.id}-${returnRequestId || 'direct'}-${stripeAmount(alreadyRefunded + requested, payment.currency)}` });
    const response = applyStripeRefundToState(refund);
    if (!response) throw httpError(500, 'Stripe đã tạo refund nhưng database chưa tìm thấy giao dịch để đồng bộ.');
    return response;
  }

  return {
    createOrderInState,
    applyStripeRefundToState, markStripeCheckoutFailed, finalizeStripeCheckout,
    finalizeStripePaymentIntent, markStripePaymentIntentFailed, stripeLandingPage, issueStripeRefund,
  };
}

module.exports = function registerStripeRoutes(api, ctx) {
  const {
    read, write, httpError, stripe, stripeEnabled,
    STRIPE_PUBLISHABLE_KEY, STRIPE_MERCHANT_DISPLAY_NAME, requireAuth, requireAdmin,
  } = ctx;
  const {
    finalizeStripeCheckout, finalizeStripePaymentIntent, stripeLandingPage,
  } = makeStripeHelpers(ctx);
  const createOrderInState = makeCreateOrderInState(ctx);

  // Lưu thẻ để lần sau thanh toán nhanh không cần nhập lại: mỗi user có một
  // Stripe Customer (tạo khi thanh toán lần đầu), setup_future_usage khiến
  // Stripe tự lưu thẻ vào customer đó sau khi PaymentIntent thành công.
  async function ensureStripeCustomer(state, user) {
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await stripe.customers.create({ email: user.email || undefined, name: user.name || undefined, metadata: { userId: user.id } });
    user.stripeCustomerId = customer.id;
    return customer.id;
  }

  api.get('/stripe/cards', requireAuth, async (req, res) => {
    if (!stripeEnabled()) return res.json({ ok: true, cards: [] });
    try {
      const state = read();
      const user = state.users.find((u) => String(u.id) === String(req.user.id));
      if (!user?.stripeCustomerId) return res.json({ ok: true, cards: [] });
      const methods = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card' });
      res.json({
        ok: true,
        cards: methods.data.map((pm) => ({ id: pm.id, brand: pm.card?.brand || '', last4: pm.card?.last4 || '', expMonth: pm.card?.exp_month || 0, expYear: pm.card?.exp_year || 0 })),
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ ok: false, message: error.message || 'Không tải được danh sách thẻ đã lưu.' });
    }
  });

  api.delete('/stripe/cards/:id', requireAuth, async (req, res) => {
    if (!stripeEnabled()) return res.status(503).json({ ok: false, message: 'Stripe thử nghiệm chưa được cấu hình.' });
    try {
      const state = read();
      const user = state.users.find((u) => String(u.id) === String(req.user.id));
      const pm = await stripe.paymentMethods.retrieve(req.params.id);
      if (!user?.stripeCustomerId || pm.customer !== user.stripeCustomerId) throw httpError(403, 'Thẻ này không thuộc tài khoản của bạn.');
      await stripe.paymentMethods.detach(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không xoá được thẻ đã lưu.' });
    }
  });

  api.get('/stripe/config', (req, res) => {
    res.json({
      ok: true,
      enabled: stripeEnabled(),
      mode: stripeEnabled() ? 'test' : 'disabled',
      // Publishable keys are intentionally safe to expose to the mobile SDK.
      // The Stripe secret key remains server-only in .env.server.
      publishableKey: stripeEnabled() ? STRIPE_PUBLISHABLE_KEY : '',
      currency: STRIPE_CURRENCY,
      merchantDisplayName: STRIPE_MERCHANT_DISPLAY_NAME,
      dashboardUrl: 'https://dashboard.stripe.com/test/payments',
    });
  });

  // Android đôi khi không mở ổn định URL Stripe Checkout rất dài. Ứng dụng chỉ
  // cần mở đường dẫn ngắn này; backend lấy URL còn hiệu lực từ Stripe rồi chuyển tiếp.
  api.get('/stripe/checkout/open/:sessionId', async (req, res) => {
    if (!stripeEnabled()) return res.status(503).type('text').send('Stripe thử nghiệm chưa được cấu hình.');
    try {
      const session = await stripe.checkout.sessions.retrieve(String(req.params.sessionId || ''));
      if (!session.url || session.status !== 'open') {
        return res.status(410).type('text').send('Phiên thanh toán đã đóng hoặc hết hạn. Vui lòng quay lại ứng dụng để tạo phiên mới.');
      }
      res.redirect(303, session.url);
    } catch (error) {
      res.status(error.statusCode || 404).type('text').send('Không tìm thấy phiên thanh toán Stripe.');
    }
  });

  // Native card flow: the mobile app collects card data inside Stripe CardField.
  // This endpoint creates only the PaymentIntent and never receives card numbers/CVC.
  api.post('/stripe/payment-intent', requireAuth, async (req, res) => {
    if (!stripeEnabled()) return res.status(503).json({ ok: false, message: 'Chế độ thử nghiệm Stripe chưa được cấu hình.' });
    req.body = { ...req.body, userId: req.user.id }; // userId luôn từ JWT, không tin client
    try {
      const state = read();
      let order = reusableStripeOrder(state, req.body || {});
      let payment = order ? findPayment(state, order.id) : null;

      if (payment?.paymentIntentId && ['pending', 'failed'].includes(String(payment.status))) {
        const previousIntent = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
        if (previousIntent.status === 'succeeded') {
          const finalized = await finalizeStripePaymentIntent(previousIntent.id);
          return res.json({
            ok: true, reused: true, clientSecret: '', intentStatus: previousIntent.status,
            order: finalized.order, payment: finalized.payment, mode: 'test',
          });
        }
        if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(previousIntent.status)) {
          payment.status = 'pending';
          payment.intentStatus = previousIntent.status;
          payment.failureReason = '';
          payment.updatedAt = Date.now();
          order.payment.status = 'pending';
          write(state);
          return res.json({
            ok: true, reused: true, clientSecret: previousIntent.client_secret,
            intentStatus: previousIntent.status, order, payment, mode: 'test',
          });
        }
      }

      let result = null;
      if (!order) {
        result = createOrderInState(state, req.body || {}, {
          paymentMethod: 'Stripe', paymentStatus: 'pending', orderStatus: 'pending_payment',
        });
        order = result.order;
      }
      if (order.total <= 0) throw httpError(400, 'Tổng tiền thanh toán phải lớn hơn 0.');

      const stripeUser = state.users.find((u) => String(u.id) === String(req.user.id));
      const stripeCustomerId = stripeUser ? await ensureStripeCustomer(state, stripeUser) : undefined;
      const savedPaymentMethodId = String(req.body?.paymentMethodId || '').trim();

      const now = Date.now();
      payment ||= {
        id: `pay-${now}`,
        code: `PAY-${order.code}-${String(now).slice(-6)}`,
        orderId: order.id,
        orderCode: order.code,
        userId: order.userId,
        provider: 'stripe',
        method: 'Stripe',
        status: 'pending',
        amount: order.total,
        originalAmount: order.subtotal + order.ship,
        discount: order.discount,
        voucherDiscount: order.voucherDiscount,
        paymentDiscount: order.paymentDiscount,
        vipDiscount: order.vipDiscount,
        vipPromotion: order.vipPromotion,
        promotionCode: 'STRIPE10',
        currency: STRIPE_CURRENCY,
        transactionCode: '',
        paymentIntentId: '',
        checkoutSessionId: '',
        refundable: false,
        refunds: [],
        createdAt: now,
        updatedAt: now,
      };
      const nativeAttempt = Number(payment.nativeAttempt || 0) + 1;
      const customerEmail = String(req.body?.customer?.email || '').trim();
      // Lưu thẻ cho lần sau phải do khách ĐỒNG Ý, không mặc định.
      //
      // Trước đây `setup_future_usage: 'off_session'` được gắn cho mọi giao dịch
      // có Stripe Customer, nên thẻ của khách bị lưu lại mà không ai hỏi và
      // không có gì báo — lần sau mở app đã thấy thẻ nằm sẵn đó. Đây là thông
      // tin thanh toán, phải hỏi trước. Thẻ đã lưu sẵn (savedPaymentMethodId)
      // thì đương nhiên giữ nguyên, vì khách đã đồng ý ở lần trước rồi.
      const saveCard = req.body?.saveCard === true || Boolean(savedPaymentMethodId);
      const intent = await stripe.paymentIntents.create({
        amount: stripeAmount(order.total),
        currency: STRIPE_CURRENCY,
        payment_method_types: ['card'],
        description: `Thanh toán trong ứng dụng JAPANO #${order.code}`,
        ...(customerEmail ? { receipt_email: customerEmail } : {}),
        ...(stripeCustomerId ? { customer: stripeCustomerId, ...(saveCard ? { setup_future_usage: 'off_session' } : {}) } : {}),
        ...(savedPaymentMethodId ? { payment_method: savedPaymentMethodId } : {}),
        metadata: {
          orderId: order.id, orderCode: order.code, userId: order.userId, paymentId: payment.id,
          paymentCode: payment.code, promotion: 'STRIPE10', discount: String(order.discount), channel: 'mobile-native',
        },
      }, { idempotencyKey: `japano-native-payment-${order.id}-${nativeAttempt}` });
      if (!intent.client_secret) throw httpError(502, 'Stripe chưa trả client secret cho ứng dụng.');

      payment.status = 'pending';
      payment.intentStatus = intent.status;
      payment.paymentIntentId = intent.id;
      payment.transactionCode = intent.id;
      payment.nativeAttempt = nativeAttempt;
      payment.updatedAt = Date.now();
      order.payment = {
        ...order.payment, status: 'pending', paymentIntentId: intent.id, paymentId: payment.id,
      };
      state.payments ||= [];
      if (!state.payments.some((item) => item.id === payment.id)) state.payments.push(payment);
      write(state);
      res.json({
        ok: true, clientSecret: intent.client_secret, paymentIntentId: intent.id, intentStatus: intent.status,
        order, payment, mode: 'test', flagcardEligibility: result?.flagcardEligibility,
      });
    } catch (error) {
      res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không tạo được Stripe PaymentIntent.' });
    }
  });

  api.post('/stripe/payment-intent/confirm', async (req, res) => {
    try {
      const payment = findPayment(read(), req.body?.paymentIntentId || req.body?.orderId);
      if (!payment?.paymentIntentId) throw httpError(404, 'Không tìm thấy PaymentIntent của đơn hàng.');
      if (req.body?.orderId && String(payment.orderId) !== String(req.body.orderId)) {
        throw httpError(409, 'PaymentIntent không khớp đơn hàng cần xác nhận.');
      }
      const result = await finalizeStripePaymentIntent(payment.paymentIntentId);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không xác nhận được Stripe PaymentIntent.' });
    }
  });

  api.post('/stripe/checkout-session', requireAuth, async (req, res) => {
    if (!stripeEnabled()) return res.status(503).json({ ok: false, message: 'Chế độ thử nghiệm Stripe chưa được cấu hình.' });
    req.body = { ...req.body, userId: req.user.id }; // userId luôn từ JWT, không tin client
    try {
      const state = read();
      const requestedUserId = String(req.body?.userId || req.body?.customer?.id || '');
      const requestedAddress = String(req.body?.address || '').trim();
      const requestedItemsKey = checkoutItemsKey(req.body?.items || []);
      const requestedVipProduct = requestedVipProductId(req.body || {});
      const reusableOrder = [...(state.orders || [])].reverse().find((item) =>
        item.status === 'pending_payment'
        && String(item.userId || '') === requestedUserId
        && String(item.address || '').trim() === requestedAddress
        && checkoutItemsKey(item.items || []) === requestedItemsKey
        && String(item.vipPromotion?.productId || '') === requestedVipProduct
        && Date.now() - Number(item.createdAt || 0) < 30 * 60 * 1000);
      const reusablePayment = reusableOrder && findPayment(state, reusableOrder.id);
      if (reusablePayment?.checkoutSessionId && reusablePayment.status === 'pending') {
        const previousSession = await stripe.checkout.sessions.retrieve(reusablePayment.checkoutSessionId);
        if (previousSession.status === 'open' && previousSession.url) {
          const publicBase = `${req.protocol}://${req.get('host')}`;
          return res.json({
            ok: true,
            reused: true,
            url: `${publicBase}/api/stripe/checkout/open/${encodeURIComponent(previousSession.id)}`,
            sessionId: previousSession.id,
            order: reusableOrder,
            payment: reusablePayment,
            mode: 'test',
          });
        }
      }
      const result = createOrderInState(state, req.body || {}, {
        paymentMethod: 'Stripe', paymentStatus: 'pending', orderStatus: 'pending_payment',
      });
      const { order } = result;
      if (order.total <= 0) throw httpError(400, 'Tổng tiền thanh toán phải lớn hơn 0.');
      const payment = {
        id: `pay-${Date.now()}`,
        code: `PAY-${order.code}-${String(Date.now()).slice(-6)}`,
        orderId: order.id,
        orderCode: order.code,
        userId: order.userId,
        provider: 'stripe',
        method: 'Stripe',
        status: 'pending',
        amount: order.total,
        originalAmount: order.subtotal + order.ship,
        discount: order.discount,
        voucherDiscount: order.voucherDiscount,
        paymentDiscount: order.paymentDiscount,
        vipDiscount: order.vipDiscount,
        vipPromotion: order.vipPromotion,
        promotionCode: 'STRIPE10',
        currency: STRIPE_CURRENCY,
        transactionCode: '',
        paymentIntentId: '',
        checkoutSessionId: '',
        refundable: false,
        refunds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const publicBase = `${req.protocol}://${req.get('host')}`;
      const customerEmail = String(req.body?.customer?.email || '').trim();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        locale: 'vi',
        client_reference_id: order.id,
        ...(customerEmail ? { customer_email: customerEmail } : {}),
        billing_address_collection: 'auto',
        phone_number_collection: { enabled: true },
        line_items: [{
          price_data: {
            currency: STRIPE_CURRENCY,
            unit_amount: stripeAmount(order.total),
            product_data: {
              name: `Đơn hàng JAPANO #${order.code}`,
              description: `${order.items.length} dòng sản phẩm · ưu đãi Stripe 10%: -${order.paymentDiscount.toLocaleString('vi-VN')}₫ · tổng giảm: -${order.discount.toLocaleString('vi-VN')}₫ · đã gồm phí vận chuyển`,
              metadata: { orderId: order.id, orderCode: order.code, promotion: 'STRIPE10' },
            },
          },
          quantity: 1,
        }],
        metadata: {
          orderId: order.id, orderCode: order.code, userId: order.userId, paymentId: payment.id,
          paymentCode: payment.code, promotion: 'STRIPE10', discount: String(order.discount),
          customerName: String(order.customer?.name || '').slice(0, 100),
        },
        payment_intent_data: {
          description: `Thanh toán đơn JAPANO #${order.code}`,
          ...(customerEmail ? { receipt_email: customerEmail } : {}),
          metadata: {
            orderId: order.id, orderCode: order.code, userId: order.userId, paymentId: payment.id,
            paymentCode: payment.code, promotion: 'STRIPE10', discount: String(order.discount),
          },
        },
        success_url: `${publicBase}/api/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicBase}/api/stripe/checkout/cancel?orderId=${encodeURIComponent(order.id)}`,
      }, { idempotencyKey: `japano-checkout-${order.id}` });
      payment.checkoutSessionId = session.id;
      payment.updatedAt = Date.now();
      order.payment = { ...order.payment, checkoutSessionId: session.id, paymentId: payment.id };
      state.payments ||= [];
      state.payments.push(payment);
      write(state);
      res.json({
        ok: true, url: `${publicBase}/api/stripe/checkout/open/${encodeURIComponent(session.id)}`, sessionId: session.id, order, payment,
        mode: 'test', flagcardEligibility: result.flagcardEligibility,
      });
    } catch (error) {
      res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không tạo được Stripe Checkout Session.' });
    }
  });

  api.post('/stripe/checkout/confirm', async (req, res) => {
    try {
      const result = await finalizeStripeCheckout(req.body?.sessionId);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không xác nhận được thanh toán Stripe.' });
    }
  });

  api.get('/stripe/checkout/success', async (req, res) => {
    try {
      const result = await finalizeStripeCheckout(req.query.session_id);
      res.type('html').send(stripeLandingPage({
        ok: true,
        title: 'Thanh toán Stripe thành công',
        message: `Đơn #${result.order.code} đã thanh toán. Mã giao dịch: ${result.payment.transactionCode}.`,
        orderId: result.order.id,
        status: 'paid',
      }));
    } catch (error) {
      res.status(error.status || 500).type('html').send(stripeLandingPage({
        ok: false, title: 'Chưa xác nhận được thanh toán', message: error.message || 'Stripe chưa xác nhận giao dịch.', status: 'failed',
      }));
    }
  });

  api.get('/stripe/checkout/cancel', (req, res) => {
    let result = null;
    ctx.update((state) => {
      const order = state.orders.find((item) => item.id === String(req.query.orderId || ''));
      const payment = order ? findPayment(state, order.id) : null;
      if (order && payment && payment.status === 'pending') {
        payment.status = 'cancelled';
        payment.updatedAt = Date.now();
        order.payment.status = 'cancelled';
        order.status = 'cancelled';
        order.history ||= [];
        order.history.push({ s: 'cancelled', at: Date.now() });
        restockCancelledOrder(state, order, 'stripe-checkout-cancelled');
      }
      result = { order, payment };
      return state;
    });
    res.type('html').send(stripeLandingPage({
      ok: false,
      title: 'Đã hủy thanh toán Stripe',
      message: 'Không có khoản tiền nào bị trừ. Bạn có thể quay lại giỏ hàng và thử lại.',
      orderId: result?.order?.id || String(req.query.orderId || ''),
      status: 'cancelled',
    }));
  });

  // Đối soát gọi ngược sang cổng thanh toán và ghi lại trạng thái giao dịch.
  api.post('/stripe/reconcile', requireAdmin, async (req, res) => {
    if (!stripeEnabled()) return res.status(503).json({ ok: false, message: 'Chế độ thử nghiệm Stripe chưa sẵn sàng.' });
    const { applyStripeRefundToState, markStripeCheckoutFailed } = makeStripeHelpers(ctx);
    const snapshot = read();
    const candidates = (snapshot.payments || [])
      .filter((payment) => payment.provider === 'stripe' && (
        (payment.status === 'pending' && (payment.checkoutSessionId || payment.paymentIntentId))
        || payment.status === 'refund_pending'
      ))
      .slice(0, 30);
    const results = [];
    for (const payment of candidates) {
      try {
        if (payment.status === 'pending' && payment.checkoutSessionId) {
          const session = await stripe.checkout.sessions.retrieve(payment.checkoutSessionId);
          if (['paid', 'no_payment_required'].includes(String(session.payment_status))) {
            const finalized = await finalizeStripeCheckout(session.id);
            results.push({ paymentId: payment.id, status: finalized.payment.status });
          } else if (session.status === 'expired') {
            const failed = markStripeCheckoutFailed(session.id, 'checkout_expired');
            results.push({ paymentId: payment.id, status: failed?.payment?.status || 'failed' });
          }
        }
        if (payment.status === 'pending' && payment.paymentIntentId && !payment.checkoutSessionId) {
          const intent = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
          if (intent.status === 'succeeded') {
            const finalized = await finalizeStripePaymentIntent(intent.id);
            results.push({ paymentId: payment.id, status: finalized.payment.status });
          } else {
            results.push({ paymentId: payment.id, status: intent.status });
          }
        }
        if (payment.status === 'refund_pending' && payment.paymentIntentId) {
          const refunds = await stripe.refunds.list({ payment_intent: payment.paymentIntentId, limit: 25 });
          for (const refund of refunds.data) applyStripeRefundToState(refund);
          results.push({ paymentId: payment.id, status: findPayment(read(), payment.id)?.status || payment.status });
        }
      } catch (error) {
        results.push({ paymentId: payment.id, status: 'sync_error', message: error.message });
      }
    }
    res.json({ ok: true, checked: candidates.length, results });
  });
};

module.exports.makeStripeHelpers = makeStripeHelpers;
