// Yêu cầu trả hàng/hoàn tiền + cập nhật trạng thái đơn (admin). Dùng cả
// issueStripeRefund lẫn issueVnpayRefund tuỳ theo cổng thanh toán đã dùng.
const { STRIPE_CURRENCY } = require('../lib/stripeMoney');
const { findPayment, findReturnRequest } = require('../lib/paymentLookup');
const { makeStripeHelpers } = require('./paymentsStripe');
const { makeVnpayHelpers } = require('./paymentsVnpay');

module.exports = function registerReturnsRoutes(api, ctx) {
  const { read, update, httpError, reconcileFlagRewards, flagcardCollectionView, vipStatus } = ctx;
  const { issueStripeRefund } = makeStripeHelpers(ctx);
  const { issueVnpayRefund } = makeVnpayHelpers(ctx);

  api.post('/orders/:id/returns', (req, res) => {
    try {
      let response = null;
      update((state) => {
        state.returnRequests ||= [];
        const order = state.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
        if (!order) throw httpError(404, 'Không tìm thấy đơn hàng.');
        const userId = String(req.body?.userId || '');
        if (userId && String(order.userId || order.customer?.id || '') !== userId) throw httpError(403, 'Bạn không có quyền yêu cầu trả đơn hàng này.');
        if (order.status !== 'completed') throw httpError(400, 'Chỉ có thể yêu cầu trả hàng sau khi đơn đã giao thành công.');
        const payment = findPayment(state, order.id);
        if (!payment || !['stripe', 'vnpay'].includes(payment.provider) || !['paid', 'partially_refunded'].includes(payment.status)) {
          throw httpError(400, 'Đơn phải được thanh toán trực tuyến thành công (Stripe/VNPay) mới có thể hoàn tiền tự động.');
        }
        const existing = state.returnRequests.find((item) => item.orderId === order.id && !['rejected', 'cancelled', 'refunded'].includes(item.status));
        if (existing) throw httpError(409, `Đơn đã có yêu cầu trả hàng ${existing.code}.`);
        const elapsed = Date.now() - Number(order.completedAt || order.history?.find((item) => item.s === 'completed')?.at || order.createdAt);
        if (elapsed > 30 * 86400000) throw httpError(400, 'Đơn đã quá thời hạn đổi trả 30 ngày.');
        const reason = String(req.body?.reason || '').trim();
        if (!reason) throw httpError(400, 'Vui lòng chọn lý do trả hàng.');
        const now = Date.now();
        const request = {
          id: `ret-${now}`,
          code: `RTN-${order.code}-${String(now).slice(-5)}`,
          orderId: order.id,
          orderCode: order.code,
          userId: order.userId,
          paymentId: payment.id,
          paymentCode: payment.code,
          status: 'requested',
          reason: reason.slice(0, 160),
          note: String(req.body?.note || '').trim().slice(0, 1000),
          items: order.items.map((item) => ({ productId: item.productId, slug: item.slug, name: item.name, size: item.size, colorName: item.colorName, qty: item.qty, price: item.price })),
          amount: Math.max(0, Number(payment.amount || order.total) - Number(payment.refundedAmount || 0) - Number(payment.pendingRefundAmount || 0)),
          currency: payment.currency || STRIPE_CURRENCY,
          createdAt: now,
          updatedAt: now,
          timeline: [{ s: 'requested', at: now }],
        };
        state.returnRequests.push(request);
        order.returnStatus = request.status;
        order.returnRequest = { id: request.id, code: request.code, status: request.status };
        order.history ||= [];
        order.history.push({ s: 'return_requested', at: now, returnRequestId: request.id });
        response = { returnRequest: request, order, payment };
        return state;
      });
      res.json({ ok: true, ...response });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tạo được yêu cầu trả hàng.' });
    }
  });

  api.post('/returns/:id/action', async (req, res) => {
    const action = String(req.body?.action || '').trim().toLowerCase();
    if (action === 'refund') {
      try {
        const snapshot = read();
        const returnRequest = findReturnRequest(snapshot, req.params.id);
        if (!returnRequest) throw httpError(404, 'Không tìm thấy yêu cầu trả hàng.');
        if (!['received', 'refund_failed'].includes(returnRequest.status)) throw httpError(400, 'Cần xác nhận đã nhận hàng trả về trước khi hoàn tiền.');
        const returnPayment = findPayment(snapshot, returnRequest.paymentId);
        const refundArgs = { amount: returnRequest.amount, returnRequestId: returnRequest.id, returnCode: returnRequest.code };
        const response = returnPayment?.provider === 'vnpay'
          ? await issueVnpayRefund(returnRequest.paymentId, refundArgs)
          : await issueStripeRefund(returnRequest.paymentId, refundArgs);
        return res.json({ ok: true, ...response });
      } catch (error) {
        return res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không hoàn tiền được cho yêu cầu trả hàng.' });
      }
    }
    const transitions = {
      approve: { from: ['requested'], to: 'approved' },
      reject: { from: ['requested', 'approved'], to: 'rejected' },
      receive: { from: ['approved'], to: 'received' },
      cancel: { from: ['requested'], to: 'cancelled' },
    };
    const transition = transitions[action];
    if (!transition) return res.status(400).json({ ok: false, message: 'Thao tác trả hàng không hợp lệ.' });
    try {
      let response = null;
      update((state) => {
        const returnRequest = findReturnRequest(state, req.params.id);
        if (!returnRequest) throw httpError(404, 'Không tìm thấy yêu cầu trả hàng.');
        if (!transition.from.includes(returnRequest.status)) throw httpError(400, `Không thể ${action} khi yêu cầu ở trạng thái ${returnRequest.status}.`);
        const now = Date.now();
        returnRequest.status = transition.to;
        returnRequest.updatedAt = now;
        returnRequest.adminNote = String(req.body?.note || '').trim().slice(0, 1000);
        returnRequest.timeline ||= [];
        returnRequest.timeline.push({ s: transition.to, at: now, note: returnRequest.adminNote });
        const order = state.orders.find((item) => item.id === returnRequest.orderId);
        if (order) {
          order.returnStatus = transition.to;
          order.returnRequest = { id: returnRequest.id, code: returnRequest.code, status: transition.to };
          order.history ||= [];
          order.history.push({ s: `return_${transition.to}`, at: now, returnRequestId: returnRequest.id });
        }
        response = { returnRequest, order };
        return state;
      });
      res.json({ ok: true, ...response });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không cập nhật được yêu cầu trả hàng.' });
    }
  });

  api.patch('/orders/:id', (req, res) => {
    let response;
    const state = update((next) => {
      const order = next.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
      if (!order) return next;
      const now = Date.now();
      if (req.body?.status) {
        order.status = String(req.body.status);
        if (order.status === 'completed') order.completedAt ||= now;
        order.history ||= [];
        order.history.push({ s: order.status, at: now });
      }
      if (req.body?.paymentStatus) {
        const previousPaymentStatus = String(order.payment.status || '');
        order.payment.status = String(req.body.paymentStatus);
        if (order.payment.status === 'paid' && previousPaymentStatus !== 'paid') {
          order.payment.paidAt ||= now;
          order.history ||= [];
          order.history.push({ s: 'paid', at: now });
        }
      }
      if (order.status === 'completed' && order.payment.method === 'COD') {
        if (order.payment.status !== 'paid') {
          order.payment.status = 'paid';
          order.payment.paidAt ||= now;
          order.history ||= [];
          if (!order.history.some((entry) => entry.s === 'paid')) order.history.push({ s: 'paid', at: now });
        }
      }
      const reconciled = reconcileFlagRewards(next);
      response = { order, award: reconciled.awards.find((item) => item.orderId === order.id) || order.flagcardAward || null };
      return next;
    });
    if (!response) return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    res.json({ ok: true, ...response, collection: flagcardCollectionView(state, response.order.userId), vipStatus: vipStatus(state, response.order.userId) });
  });
};
