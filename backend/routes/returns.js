// Yêu cầu huỷ đơn (trước khi giao) và trả hàng/hoàn tiền (sau khi giao) + cập
// nhật trạng thái đơn (admin). Cả hai loại yêu cầu dùng chung một hàng đợi
// (returnRequests, phân biệt bằng field kind: 'cancel' | 'return') để admin
// duyệt/từ chối tại một chỗ — huỷ trước-giao không cần ảnh, trả-sau-giao bắt
// buộc ảnh minh chứng. Dùng cả issueStripeRefund lẫn issueVnpayRefund tuỳ
// cổng thanh toán; đơn COD hoàn tiền thủ công vì không có cổng để gọi API.
const { STRIPE_CURRENCY } = require('../lib/stripeMoney');
const { findPayment, findReturnRequest } = require('../lib/paymentLookup');
const { makeStripeHelpers } = require('./paymentsStripe');
const { makeVnpayHelpers } = require('./paymentsVnpay');
const { pushNotification } = require('../lib/notify');

const PRE_SHIP_STATUSES = ['pending', 'pending_payment', 'confirmed'];

module.exports = function registerReturnsRoutes(api, ctx) {
  const {
    read, update, httpError, reconcileFlagRewards, flagcardCollectionView, vipStatus,
    requireAuth, requireAdmin, sendPushToUser, uploadReturnPhotos,
  } = ctx;
  const { issueStripeRefund } = makeStripeHelpers(ctx);
  const { issueVnpayRefund } = makeVnpayHelpers(ctx);

  function activeRequestFor(state, orderId) {
    return (state.returnRequests || []).find((item) => item.orderId === orderId && !['rejected', 'cancelled', 'refunded'].includes(item.status));
  }

  // Đơn COD chưa từng thu tiền trước khi giao — huỷ trước-giao thì không có gì
  // để hoàn. Đơn thanh toán trực tuyến (Stripe/VNPay) thu tiền ngay lúc đặt
  // hàng, nên huỷ trước-giao vẫn phải hoàn tiền qua đúng cổng đã thanh toán.
  function needsGatewayRefund(payment) {
    return Boolean(payment) && ['stripe', 'vnpay'].includes(payment.provider) && ['paid', 'partially_refunded'].includes(payment.status);
  }

  async function attemptGatewayRefund(returnRequest) {
    const snapshot = read();
    const returnPayment = findPayment(snapshot, returnRequest.paymentId);
    const refundArgs = { amount: returnRequest.amount, returnRequestId: returnRequest.id, returnCode: returnRequest.code };
    return returnPayment?.provider === 'vnpay'
      ? issueVnpayRefund(returnRequest.paymentId, refundArgs)
      : issueStripeRefund(returnRequest.paymentId, refundArgs);
  }

  function markRefunded(returnRequestId, note) {
    let updated = null;
    update((next) => {
      const rr = findReturnRequest(next, returnRequestId);
      if (!rr) return next;
      const now = Date.now();
      rr.status = 'refunded';
      rr.updatedAt = now;
      rr.timeline.push({ s: 'refunded', at: now, note });
      const order = next.orders.find((item) => item.id === rr.orderId);
      if (order) {
        order.returnStatus = 'refunded';
        order.returnRequest = { id: rr.id, code: rr.code, status: 'refunded', kind: rr.kind };
        order.history ||= [];
        order.history.push({ s: 'return_refunded', at: now });
      }
      pushNotification(next, { userId: rr.userId, title: `Đã hoàn tiền đơn #${rr.orderCode}`, body: `Số tiền ${Number(rr.amount).toLocaleString('vi-VN')}đ đã được hoàn.`, type: 'Đơn hàng', action: `order:${rr.orderId}` });
      updated = rr;
      return next;
    });
    return updated;
  }

  function markRefundFailed(returnRequestId, message) {
    let updated = null;
    update((next) => {
      const rr = findReturnRequest(next, returnRequestId);
      if (!rr) return next;
      const now = Date.now();
      rr.status = 'refund_failed';
      rr.updatedAt = now;
      rr.timeline.push({ s: 'refund_failed', at: now, note: message });
      const order = next.orders.find((item) => item.id === rr.orderId);
      if (order) { order.returnStatus = 'refund_failed'; order.returnRequest = { id: rr.id, code: rr.code, status: 'refund_failed', kind: rr.kind }; }
      pushNotification(next, { userId: rr.userId, title: `Hoàn tiền đơn #${rr.orderCode} gặp lỗi`, body: 'Cửa hàng sẽ xử lý hoàn tiền thủ công, xin lỗi vì sự bất tiện.', type: 'Đơn hàng', action: `order:${rr.orderId}` });
      updated = rr;
      return next;
    });
    return updated;
  }

  // Huỷ đơn — chỉ khi đơn CHƯA giao (chưa "đang giao"/"đã giao"). Luôn cần lý
  // do và luôn phải admin duyệt (không tự huỷ ngay) theo đúng yêu cầu nghiệp vụ.
  api.post('/orders/:id/cancel-request', requireAuth, (req, res) => {
    try {
      let response = null;
      update((state) => {
        state.returnRequests ||= [];
        const order = state.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
        if (!order) throw httpError(404, 'Không tìm thấy đơn hàng.');
        if (String(order.userId || order.customer?.id || '') !== req.user.id) throw httpError(403, 'Bạn không có quyền huỷ đơn hàng này.');
        if (!PRE_SHIP_STATUSES.includes(String(order.status))) throw httpError(400, 'Đơn đang được giao hoặc đã giao — vui lòng dùng "Đổi/Trả hàng" thay vì huỷ.');
        if (activeRequestFor(state, order.id)) throw httpError(409, 'Đơn đã có yêu cầu đang chờ xử lý.');
        const reason = String(req.body?.reason || '').trim();
        if (!reason) throw httpError(400, 'Vui lòng nhập lý do huỷ đơn.');
        const payment = findPayment(state, order.id);
        const now = Date.now();
        const request = {
          id: `ret-${now}`,
          kind: 'cancel',
          code: `CXL-${order.code}-${String(now).slice(-5)}`,
          orderId: order.id,
          orderCode: order.code,
          userId: order.userId,
          paymentId: payment?.id || '',
          paymentCode: payment?.code || '',
          status: 'requested',
          reason: reason.slice(0, 160),
          note: String(req.body?.note || '').trim().slice(0, 1000),
          photos: [],
          items: order.items.map((item) => ({ productId: item.productId, slug: item.slug, name: item.name, size: item.size, colorName: item.colorName, qty: item.qty, price: item.price })),
          amount: Math.max(0, Number(payment?.amount ?? order.total) - Number(payment?.refundedAmount || 0) - Number(payment?.pendingRefundAmount || 0)),
          currency: payment?.currency || STRIPE_CURRENCY,
          createdAt: now,
          updatedAt: now,
          timeline: [{ s: 'requested', at: now }],
        };
        state.returnRequests.push(request);
        order.returnStatus = request.status;
        order.returnRequest = { id: request.id, code: request.code, status: request.status, kind: 'cancel' };
        order.history ||= [];
        order.history.push({ s: 'cancel_requested', at: now, returnRequestId: request.id });
        pushNotification(state, { userId: order.userId, title: `Yêu cầu huỷ đơn #${order.code}`, body: 'Yêu cầu của bạn đang chờ cửa hàng xem xét.', type: 'Đơn hàng', action: `order:${order.id}` });
        response = { returnRequest: request, order };
        return state;
      });
      res.json({ ok: true, ...response });
      void sendPushToUser(response.order.userId, { title: `Yêu cầu huỷ đơn #${response.order.code}`, body: 'Đang chờ cửa hàng xem xét.', data: { orderId: response.order.id, type: 'cancel-request' } });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không gửi được yêu cầu huỷ đơn.' });
    }
  });

  // Trả hàng/hoàn tiền — chỉ sau khi đã giao ("completed"). Bắt buộc lý do +
  // ít nhất 1 ảnh minh chứng. Nhận cả COD lẫn Stripe/VNPay (COD hoàn tiền thủ
  // công vì không có cổng thanh toán để gọi API hoàn tự động).
  api.post('/orders/:id/returns', requireAuth, async (req, res) => {
    try {
      const snapshot = read();
      const order0 = snapshot.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
      if (!order0) throw httpError(404, 'Không tìm thấy đơn hàng.');
      if (String(order0.userId || order0.customer?.id || '') !== req.user.id) throw httpError(403, 'Bạn không có quyền yêu cầu trả đơn hàng này.');
      if (order0.status !== 'completed') throw httpError(400, 'Chỉ có thể yêu cầu trả hàng sau khi đơn đã giao thành công.');
      const reason = String(req.body?.reason || '').trim();
      if (!reason) throw httpError(400, 'Vui lòng chọn lý do trả hàng.');
      const rawPhotos = Array.isArray(req.body?.photos) ? req.body.photos : [];
      if (!rawPhotos.length) throw httpError(400, 'Vui lòng chụp ít nhất 1 ảnh sản phẩm/hàng hoá kèm theo.');
      const photos = await uploadReturnPhotos(rawPhotos);

      let response = null;
      update((state) => {
        state.returnRequests ||= [];
        const order = state.orders.find((item) => item.id === order0.id);
        if (!order) throw httpError(404, 'Không tìm thấy đơn hàng.');
        if (activeRequestFor(state, order.id)) throw httpError(409, 'Đơn đã có yêu cầu đang chờ xử lý.');
        const elapsed = Date.now() - Number(order.completedAt || order.history?.find((item) => item.s === 'completed')?.at || order.createdAt);
        if (elapsed > 30 * 86400000) throw httpError(400, 'Đơn đã quá thời hạn đổi trả 30 ngày.');
        const payment = findPayment(state, order.id);
        const isCod = String(order.payment?.method || '').toUpperCase() === 'COD';
        if (!isCod && (!payment || !['stripe', 'vnpay'].includes(payment.provider) || !['paid', 'partially_refunded'].includes(payment.status))) {
          throw httpError(400, 'Không tìm thấy giao dịch thanh toán hợp lệ cho đơn này.');
        }
        const now = Date.now();
        const request = {
          id: `ret-${now}`,
          kind: 'return',
          code: `RTN-${order.code}-${String(now).slice(-5)}`,
          orderId: order.id,
          orderCode: order.code,
          userId: order.userId,
          paymentId: payment?.id || '',
          paymentCode: payment?.code || '',
          status: 'requested',
          reason: reason.slice(0, 160),
          note: String(req.body?.note || '').trim().slice(0, 1000),
          photos,
          codManualRefund: isCod,
          items: order.items.map((item) => ({ productId: item.productId, slug: item.slug, name: item.name, size: item.size, colorName: item.colorName, qty: item.qty, price: item.price })),
          amount: Math.max(0, Number(payment?.amount ?? order.total) - Number(payment?.refundedAmount || 0) - Number(payment?.pendingRefundAmount || 0)),
          currency: payment?.currency || STRIPE_CURRENCY,
          createdAt: now,
          updatedAt: now,
          timeline: [{ s: 'requested', at: now }],
        };
        state.returnRequests.push(request);
        order.returnStatus = request.status;
        order.returnRequest = { id: request.id, code: request.code, status: request.status, kind: 'return' };
        order.history ||= [];
        order.history.push({ s: 'return_requested', at: now, returnRequestId: request.id });
        pushNotification(state, { userId: order.userId, title: `Yêu cầu trả hàng #${order.code}`, body: 'Yêu cầu của bạn đang chờ cửa hàng xem xét.', type: 'Đơn hàng', action: `order:${order.id}` });
        response = { returnRequest: request, order, payment };
        return state;
      });
      res.json({ ok: true, ...response });
      void sendPushToUser(response.order.userId, { title: `Yêu cầu trả hàng #${response.order.code}`, body: 'Đang chờ cửa hàng xem xét.', data: { orderId: response.order.id, type: 'return-request' } });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tạo được yêu cầu trả hàng.' });
    }
  });

  // Admin duyệt/từ chối/nhận hàng/hoàn tiền — dùng chung cho cả 2 kind.
  api.post('/returns/:id/action', requireAdmin, async (req, res) => {
    const action = String(req.body?.action || '').trim().toLowerCase();

    if (action === 'refund') {
      try {
        const snapshot = read();
        const returnRequest = findReturnRequest(snapshot, req.params.id);
        if (!returnRequest) throw httpError(404, 'Không tìm thấy yêu cầu.');
        if (!['received', 'refund_failed'].includes(returnRequest.status)) throw httpError(400, 'Cần xác nhận đã nhận hàng trả về trước khi hoàn tiền.');

        if (returnRequest.codManualRefund) {
          // COD không đi qua cổng thanh toán nên không có API để gọi — admin
          // xác nhận đã hoàn tiền thủ công (tiền mặt/chuyển khoản) ở đây.
          const updated = markRefunded(returnRequest.id, 'Hoàn tiền thủ công (đơn COD)');
          res.json({ ok: true, returnRequest: updated });
          void sendPushToUser(returnRequest.userId, { title: `Đã hoàn tiền đơn #${returnRequest.orderCode}`, body: 'Cửa hàng đã xác nhận hoàn tiền thủ công.', data: { type: 'refund', orderId: returnRequest.orderId } });
          return;
        }

        try {
          const gatewayResponse = await attemptGatewayRefund(returnRequest);
          const updated = markRefunded(returnRequest.id, 'Hoàn tiền qua cổng thanh toán');
          res.json({ ok: true, ...gatewayResponse, returnRequest: updated });
          void sendPushToUser(returnRequest.userId, { title: `Đã hoàn tiền đơn #${returnRequest.orderCode}`, body: `Số tiền ${Number(returnRequest.amount).toLocaleString('vi-VN')}đ đã được hoàn.`, data: { type: 'refund', orderId: returnRequest.orderId } });
        } catch (gatewayError) {
          markRefundFailed(returnRequest.id, gatewayError.message || 'Hoàn tiền qua cổng thanh toán thất bại.');
          throw gatewayError;
        }
      } catch (error) {
        res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không hoàn tiền được cho yêu cầu.' });
      }
      return;
    }

    const VALID_ACTIONS = ['approve', 'reject', 'receive', 'cancel'];
    if (!VALID_ACTIONS.includes(action)) return res.status(400).json({ ok: false, message: 'Thao tác không hợp lệ.' });

    // Duyệt yêu cầu HUỶ ĐƠN: nếu đơn đã thu tiền qua Stripe/VNPay trước khi
    // giao thì phải hoàn tiền qua đúng cổng đó ngay khi huỷ — COD chưa thu
    // tiền nên huỷ xong là xong, không có bước hoàn tiền nào cả.
    if (action === 'approve') {
      const snapshot = read();
      const returnRequest0 = findReturnRequest(snapshot, req.params.id);
      if (returnRequest0?.kind === 'cancel' && returnRequest0.status === 'requested') {
        const payment0 = findPayment(snapshot, returnRequest0.paymentId);
        if (needsGatewayRefund(payment0)) {
          try {
            const adminNote = String(req.body?.note || '').trim().slice(0, 1000);
            let cancelled = null;
            update((next) => {
              const rr = findReturnRequest(next, returnRequest0.id);
              const order = next.orders.find((item) => item.id === rr.orderId);
              const now = Date.now();
              rr.adminNote = adminNote;
              rr.status = 'approved';
              rr.timeline.push({ s: 'approved', at: now, note: adminNote });
              if (order) {
                order.status = 'cancelled';
                order.history.push({ s: 'cancelled', at: now, returnRequestId: rr.id });
                order.returnStatus = 'approved';
                order.returnRequest = { id: rr.id, code: rr.code, status: 'approved', kind: 'cancel' };
              }
              pushNotification(next, { userId: rr.userId, title: `Đơn #${rr.orderCode} đã được huỷ`, body: 'Yêu cầu huỷ đơn của bạn đã được chấp nhận, đang hoàn tiền qua cổng thanh toán.', type: 'Đơn hàng', action: `order:${rr.orderId}` });
              cancelled = { returnRequest: rr, order };
              return next;
            });
            void sendPushToUser(cancelled.order.userId, { title: `Đơn #${cancelled.returnRequest.orderCode} đã được huỷ`, body: 'Đang hoàn tiền qua cổng thanh toán.', data: { type: 'cancel-status', orderId: cancelled.order.id } });
            const updated = await attemptGatewayRefund(cancelled.returnRequest)
              .then(() => markRefunded(cancelled.returnRequest.id, 'Huỷ đơn đã thanh toán trực tuyến — hoàn tiền qua cổng thanh toán'))
              .catch((gatewayError) => { markRefundFailed(cancelled.returnRequest.id, gatewayError.message || 'Hoàn tiền thất bại sau khi huỷ đơn.'); throw gatewayError; });
            res.json({ ok: true, returnRequest: updated, order: cancelled.order });
            void sendPushToUser(cancelled.order.userId, { title: `Đã hoàn tiền đơn #${cancelled.returnRequest.orderCode}`, body: `Số tiền ${Number(cancelled.returnRequest.amount).toLocaleString('vi-VN')}đ đã được hoàn.`, data: { type: 'refund', orderId: cancelled.order.id } });
          } catch (error) {
            res.status(error.status || error.statusCode || 500).json({ ok: false, message: `Đã huỷ đơn nhưng hoàn tiền tự động thất bại (${error.message || 'lỗi cổng thanh toán'}) — vui lòng hoàn tiền thủ công.` });
          }
          return;
        }
      }
    }

    try {
      let response = null;
      let pendingPush = null;
      update((next) => {
        const returnRequest = findReturnRequest(next, req.params.id);
        if (!returnRequest) throw httpError(404, 'Không tìm thấy yêu cầu.');
        const from = {
          approve: ['requested'],
          reject: ['requested', 'approved'],
          receive: ['approved'],
          cancel: ['requested'],
        }[action];
        if (!from.includes(returnRequest.status)) throw httpError(400, `Không thể ${action} khi yêu cầu ở trạng thái ${returnRequest.status}.`);
        const now = Date.now();
        const order = next.orders.find((item) => item.id === returnRequest.orderId);
        const adminNote = String(req.body?.note || '').trim().slice(0, 1000);
        returnRequest.adminNote = adminNote;
        returnRequest.updatedAt = now;

        // Duyệt yêu cầu HUỶ ĐƠN (trước khi giao, COD chưa thu tiền) huỷ đơn
        // ngay — không có bước "nhận hàng" vì hàng chưa từng được gửi đi, và
        // không có bước hoàn tiền vì chưa từng thu tiền.
        if (action === 'approve' && returnRequest.kind === 'cancel') {
          returnRequest.status = 'approved';
          returnRequest.timeline.push({ s: 'approved', at: now, note: adminNote });
          if (order) { order.status = 'cancelled'; order.history.push({ s: 'cancelled', at: now, returnRequestId: returnRequest.id }); }
          pushNotification(next, { userId: returnRequest.userId, title: `Đơn #${returnRequest.orderCode} đã được huỷ`, body: 'Yêu cầu huỷ đơn của bạn đã được chấp nhận.', type: 'Đơn hàng', action: `order:${returnRequest.orderId}` });
          pendingPush = { title: `Đơn #${returnRequest.orderCode} đã được huỷ`, body: 'Yêu cầu huỷ đơn của bạn đã được chấp nhận.' };
        } else if (action === 'reject') {
          returnRequest.status = 'rejected';
          returnRequest.timeline.push({ s: 'rejected', at: now, note: adminNote });
          const label = returnRequest.kind === 'cancel' ? 'Yêu cầu huỷ đơn' : 'Yêu cầu trả hàng';
          const body = adminNote || (returnRequest.kind === 'cancel' ? 'Đơn của bạn tiếp tục được xử lý bình thường.' : 'Hàng không đủ điều kiện hoàn tiền và sẽ được gửi trả lại bạn.');
          pushNotification(next, { userId: returnRequest.userId, title: `${label} #${returnRequest.orderCode} bị từ chối`, body, type: 'Đơn hàng', action: `order:${returnRequest.orderId}` });
          pendingPush = { title: `${label} #${returnRequest.orderCode} bị từ chối`, body };
        } else {
          // approve (kind=return) → chờ khách gửi hàng về; receive → đã nhận hàng, sẵn sàng hoàn tiền; cancel → khách tự rút yêu cầu.
          returnRequest.status = action === 'approve' ? 'approved' : action === 'receive' ? 'received' : 'cancelled';
          returnRequest.timeline.push({ s: returnRequest.status, at: now, note: adminNote });
          if (action === 'approve') {
            pushNotification(next, { userId: returnRequest.userId, title: `Yêu cầu trả hàng #${returnRequest.orderCode} đã được duyệt`, body: 'Vui lòng gửi hàng về cửa hàng theo hướng dẫn.', type: 'Đơn hàng', action: `order:${returnRequest.orderId}` });
            pendingPush = { title: `Yêu cầu trả hàng #${returnRequest.orderCode} đã được duyệt`, body: 'Vui lòng gửi hàng về cửa hàng theo hướng dẫn.' };
          }
        }
        if (order) {
          order.returnStatus = returnRequest.status;
          order.returnRequest = { id: returnRequest.id, code: returnRequest.code, status: returnRequest.status, kind: returnRequest.kind };
        }
        response = { returnRequest, order };
        return next;
      });
      res.json({ ok: true, ...response });
      if (pendingPush) void sendPushToUser(response.returnRequest.userId, { ...pendingPush, data: { type: 'return-status', orderId: response.returnRequest.orderId } });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không cập nhật được yêu cầu.' });
    }
  });

  const ORDER_STATUS_LABELS = {
    confirmed: 'đã được xác nhận',
    shipping: 'đang được giao',
    completed: 'đã giao thành công',
    cancelled: 'đã bị huỷ',
    returned: 'đã hoàn trả',
  };
  api.patch('/orders/:id', requireAdmin, (req, res) => {
    let response;
    let statusChanged = false;
    const state = update((next) => {
      const order = next.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
      if (!order) return next;
      const now = Date.now();
      if (req.body?.status && req.body.status !== order.status) {
        order.status = String(req.body.status);
        statusChanged = true;
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
      if (statusChanged && order.userId) {
        const label = ORDER_STATUS_LABELS[order.status] || `chuyển sang "${order.status}"`;
        pushNotification(next, { userId: order.userId, title: `Đơn hàng #${order.code}`, body: `Đơn của bạn ${label}.`, type: 'Đơn hàng', action: `order:${order.id}` });
      }
      const reconciled = reconcileFlagRewards(next);
      response = { order, award: reconciled.awards.find((item) => item.orderId === order.id) || order.flagcardAward || null };
      return next;
    });
    if (!response) return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    if (statusChanged && response.order.userId) {
      const label = ORDER_STATUS_LABELS[response.order.status] || `chuyển sang "${response.order.status}"`;
      void sendPushToUser(response.order.userId, {
        title: `Đơn hàng #${response.order.code}`,
        body: `Đơn của bạn ${label}.`,
        data: { orderId: response.order.id, type: 'order-status' },
      });
    }
    res.json({ ok: true, ...response, collection: flagcardCollectionView(state, response.order.userId), vipStatus: vipStatus(state, response.order.userId) });
  });
};
