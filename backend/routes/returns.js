// Vòng đời đơn hàng (giao → khách nhận → xác nhận) và toàn bộ quy trình
// huỷ/đổi/trả/hoàn tiền. Quy trình chuẩn và các mốc thời gian nằm ở
// lib/fulfillmentPolicy.js — file này chỉ thực thi đúng theo đó.
//
// Huỷ đơn (trước khi bàn giao vận chuyển) và trả hàng (sau khi khách đã nhận)
// dùng chung một hàng đợi returnRequests, phân biệt bằng field kind
// ('cancel' | 'return'). Trả hàng hỗ trợ TRẢ TỪNG SẢN PHẨM trong đơn nhiều món:
// mỗi yêu cầu mang danh sách items riêng, tiền hoàn tính theo lib/refundMath.js.
// Dùng cả issueStripeRefund lẫn issueVnpayRefund tuỳ cổng thanh toán; đơn COD
// hoàn tiền thủ công vì không có cổng để gọi API.
const { STRIPE_CURRENCY } = require('../lib/stripeMoney');
const { consume: consumeVoucher, release: releaseVoucher, reissue: reissueVoucher, extendIfExpiredWhileReserved } = require('../lib/voucherLifecycle');
const { findPayment, findReturnRequest } = require('../lib/paymentLookup');
const { makeStripeHelpers } = require('./paymentsStripe');
const { makeVnpayHelpers } = require('./paymentsVnpay');
const { pushNotification } = require('../lib/notify');
const { restockCancelledOrder, restockReceivedReturn, restockRemainingOrderUnits } = require('../lib/inventory');
const { resolveSelection, computeRefund, returnableItems, allItemsRefunded } = require('../lib/refundMath');
const {
  FULFILLMENT_POLICY, ORDER_STATUS_FLOW, PRE_SHIP_STATUSES, RETURNABLE_ORDER_STATUSES,
  RETURN_WINDOW_DAYS, SHIP_BACK_DAYS, returnWindowMs, returnWindowStartedAt,
} = require('../lib/fulfillmentPolicy');

module.exports = function registerReturnsRoutes(api, ctx) {
  const {
    read, update, httpError, reconcileFlagRewards, flagcardCollectionView, vipStatus,
    requireAuth, requireAdmin, sendPushToUser, uploadReturnPhotos, reconcileGoalRewards,
    sendRefundNotice,
  } = ctx;
  const { issueStripeRefund } = makeStripeHelpers(ctx);
  const { issueVnpayRefund } = makeVnpayHelpers(ctx);

  // Quy trình chuẩn để app và trang quản trị hiển thị đúng một nội dung.
  api.get('/policies/fulfillment', (req, res) => res.json({ ok: true, policy: FULFILLMENT_POLICY }));

  function activeRequestFor(state, orderId) {
    return (state.returnRequests || []).find((item) => item.orderId === orderId && !['rejected', 'cancelled', 'refunded'].includes(item.status));
  }
  function activeCancelFor(state, orderId) {
    return (state.returnRequests || []).find((item) => item.orderId === orderId && item.kind === 'cancel' && !['rejected', 'cancelled', 'refunded'].includes(item.status));
  }

  // Đơn COD chưa từng thu tiền trước khi giao — huỷ trước-giao thì không có gì
  // để hoàn. Đơn thanh toán trực tuyến (Stripe/VNPay) thu tiền ngay lúc đặt
  // hàng, nên huỷ trước-giao vẫn phải hoàn tiền qua đúng cổng đã thanh toán.
  function needsGatewayRefund(payment) {
    return Boolean(payment) && ['stripe', 'vnpay'].includes(payment.provider) && ['paid', 'partially_refunded'].includes(payment.status);
  }

  function remainingRefundable(payment, order) {
    return Math.max(0, Number(payment?.amount ?? order?.total ?? 0) - Number(payment?.refundedAmount || 0) - Number(payment?.pendingRefundAmount || 0));
  }

  async function attemptGatewayRefund(returnRequest) {
    const snapshot = read();
    const returnPayment = findPayment(snapshot, returnRequest.paymentId);
    const refundArgs = { amount: returnRequest.amount, returnRequestId: returnRequest.id, returnCode: returnRequest.code };
    return returnPayment?.provider === 'vnpay'
      ? issueVnpayRefund(returnRequest.paymentId, refundArgs)
      : issueStripeRefund(returnRequest.paymentId, refundArgs);
  }

  function itemSummary(items) {
    return (items || []).map((item) => `${item.name} ×${item.qty}`).join(', ');
  }

  // Mọi đường hoàn tiền (huỷ đơn, trả hàng, hoàn thủ công cho COD) đều kết thúc
  // ở đây, nên đây là chỗ duy nhất cần gắn email xác nhận hoàn tiền.
  function markRefunded(returnRequestId, note) {
    let updated = null;
    let mailPayload = null;
    update((next) => {
      const rr = findReturnRequest(next, returnRequestId);
      if (!rr) return next;
      const now = Date.now();
      const wasRefunded = rr.status === 'refunded';
      rr.status = 'refunded';
      rr.updatedAt = now;
      rr.timeline.push({ s: 'refunded', at: now, note });
      const order = next.orders.find((item) => item.id === rr.orderId);
      if (order) {
        order.returnStatus = 'refunded';
        order.returnRequest = { id: rr.id, code: rr.code, status: 'refunded', kind: rr.kind };
        order.history ||= [];
        order.history.push({ s: 'return_refunded', at: now });
        // Chỉ khi MỌI sản phẩm trong đơn đã được trả và hoàn tiền thì bản thân
        // đơn hàng mới chuyển sang "đã trả hàng" — trả một phần thì đơn vẫn giữ
        // trạng thái hoàn tất để lịch sử mua hàng của khách không bị sai.
        if (rr.kind === 'return' && allItemsRefunded(next, order)) {
          order.status = 'returned';
          order.history.push({ s: 'returned', at: now });
        }
        // Voucher: chỉ xử lý SAU KHI hoàn tiền đã thực sự thành công (đang ở
        // đúng nhánh này), và chỉ khi khách trả lại toàn bộ giá trị đơn.
        // Trả một phần thì quyền lợi voucher đã dùng cho phần khách giữ lại.
        const wholeOrder = rr.coversWholeOrder || (rr.kind === 'return' && allItemsRefunded(next, order)) || rr.kind === 'cancel';
        if (wholeOrder) {
          // Chưa tiêu (huỷ trước khi giao) thì chỉ cần nhả chỗ; đã tiêu thì cấp
          // một voucher thay thế mới, giữ nguyên quyền lợi cũ.
          const released = releaseVoucher(next, order.id, `refunded:${rr.id}`, now);
          if (released) extendIfExpiredWhileReserved(next, order.id, now);
          reissueVoucher(next, { orderId: order.id, refundRef: rr.id }, now);
        }
      }
      const scope = rr.coversWholeOrder ? 'toàn bộ đơn' : itemSummary(rr.items);
      pushNotification(next, { userId: rr.userId, title: `Đã hoàn tiền đơn #${rr.orderCode}`, body: `Số tiền ${Number(rr.amount).toLocaleString('vi-VN')}đ (${scope}) đã được hoàn về phương thức bạn đã thanh toán.`, type: 'Đơn hàng', action: `order:${rr.orderId}` });
      if (!wasRefunded) mailPayload = { returnRequest: rr, order, manual: Boolean(rr.codManualRefund) };
      updated = rr;
      return next;
    });
    // Gửi ngoài update() — mutator chạy đồng bộ, còn gửi thư là bất đồng bộ.
    if (mailPayload && sendRefundNotice) {
      void sendRefundNotice(mailPayload.returnRequest.userId, mailPayload);
    }
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

  // ---- Khách xem trước những gì mình còn có thể trả -------------------------
  api.get('/orders/:id/returnable', requireAuth, (req, res) => {
    try {
      const state = read();
      const order = state.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
      if (!order) throw httpError(404, 'Không tìm thấy đơn hàng.');
      if (String(order.userId || order.customer?.id || '') !== req.user.id) throw httpError(403, 'Bạn không có quyền xem đơn hàng này.');
      const startedAt = returnWindowStartedAt(order);
      const deadline = startedAt ? startedAt + returnWindowMs() : 0;
      res.json({
        ok: true,
        items: returnableItems(state, order),
        window: { days: RETURN_WINDOW_DAYS, startedAt, deadline, expired: Boolean(deadline) && Date.now() > deadline },
        eligible: RETURNABLE_ORDER_STATUSES.includes(String(order.status)),
      });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tải được danh sách sản phẩm có thể trả.' });
    }
  });

  // ---- Khách xác nhận đã nhận hàng ----------------------------------------
  // Bên thứ ba (đơn vị vận chuyển) báo "đã giao" → đơn ở trạng thái delivered.
  // Chính khách mới là người chốt "đúng hàng, đã nhận" để đơn sang completed và
  // mở cửa sổ đổi/trả. Không xác nhận thì lib/fulfillmentPolicy tự chốt sau hạn.
  api.post('/orders/:id/confirm-received', requireAuth, (req, res) => {
    try {
      let response = null;
      update((state) => {
        const order = state.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
        if (!order) throw httpError(404, 'Không tìm thấy đơn hàng.');
        if (String(order.userId || order.customer?.id || '') !== req.user.id) throw httpError(403, 'Bạn không có quyền xác nhận đơn hàng này.');
        if (order.status === 'completed') throw httpError(409, 'Đơn hàng này đã được xác nhận nhận hàng.');
        if (order.status !== 'delivered') throw httpError(400, 'Chỉ xác nhận được khi đơn vị vận chuyển đã báo giao hàng thành công.');
        const now = Date.now();
        order.status = 'completed';
        order.completedAt = now;
        order.confirmedReceivedAt = now;
        order.history ||= [];
        order.history.push({ s: 'completed', at: now, note: 'Khách xác nhận đã nhận hàng' });
        if (order.payment?.method === 'COD' && order.payment.status !== 'paid') {
          order.payment.status = 'paid';
          order.payment.paidAt ||= now;
          order.history.push({ s: 'paid', at: now });
        }
        pushNotification(state, {
          userId: order.userId,
          title: `Đã xác nhận nhận hàng · #${order.code}`,
          body: `Cảm ơn bạn! Bạn có ${RETURN_WINDOW_DAYS} ngày để yêu cầu đổi/trả nếu sản phẩm chưa ưng ý.`,
          type: 'Đơn hàng',
          action: `order:${order.id}`,
        });
        // Khách đã nhận và (với COD) đã trả tiền: chốt lượt dùng voucher.
        consumeVoucher(state, order.id, 'order-completed', now);
        reconcileFlagRewards(state);
        if (reconcileGoalRewards) reconcileGoalRewards(state, now, pushNotification);
        response = { order };
        return state;
      });
      res.json({ ok: true, ...response });
      void sendPushToUser(response.order.userId, { title: `Đã xác nhận nhận hàng · #${response.order.code}`, body: `Bạn có ${RETURN_WINDOW_DAYS} ngày để yêu cầu đổi/trả.`, data: { orderId: response.order.id, type: 'order-status' } });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không xác nhận được đơn hàng.' });
    }
  });

  // Huỷ đơn — chỉ khi đơn CHƯA bàn giao đơn vị vận chuyển. Luôn cần lý do và
  // luôn phải cửa hàng duyệt (không tự huỷ ngay) theo đúng chính sách.
  api.post('/orders/:id/cancel-request', requireAuth, (req, res) => {
    try {
      let response = null;
      update((state) => {
        state.returnRequests ||= [];
        const order = state.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
        if (!order) throw httpError(404, 'Không tìm thấy đơn hàng.');
        if (String(order.userId || order.customer?.id || '') !== req.user.id) throw httpError(403, 'Bạn không có quyền huỷ đơn hàng này.');
        if (!PRE_SHIP_STATUSES.includes(String(order.status))) throw httpError(400, 'Đơn đã bàn giao đơn vị vận chuyển hoặc đã giao — vui lòng dùng "Đổi/Trả hàng" thay vì huỷ.');
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
          coversWholeOrder: true,
          amount: remainingRefundable(payment, order),
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

  // Trả hàng/hoàn tiền — sau khi hàng đã tới tay khách (delivered/completed).
  // Bắt buộc lý do + ít nhất 1 ảnh minh chứng. Khách chọn TỪNG SẢN PHẨM muốn
  // trả (body.items); bỏ trống thì mặc định trả toàn bộ phần chưa yêu cầu.
  // Nhận cả COD lẫn Stripe/VNPay (COD hoàn tiền thủ công vì không có cổng).
  api.post('/orders/:id/returns', requireAuth, async (req, res) => {
    try {
      const snapshot = read();
      const order0 = snapshot.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
      if (!order0) throw httpError(404, 'Không tìm thấy đơn hàng.');
      if (String(order0.userId || order0.customer?.id || '') !== req.user.id) throw httpError(403, 'Bạn không có quyền yêu cầu trả đơn hàng này.');
      if (!RETURNABLE_ORDER_STATUSES.includes(String(order0.status))) {
        throw httpError(400, 'Chỉ yêu cầu trả hàng được sau khi đơn đã được giao tới bạn.');
      }
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
        if (activeCancelFor(state, order.id)) throw httpError(409, 'Đơn đang có yêu cầu huỷ chờ xử lý.');
        const startedAt = returnWindowStartedAt(order);
        if (startedAt && Date.now() - startedAt > returnWindowMs()) {
          throw httpError(400, `Đơn đã quá thời hạn đổi trả ${RETURN_WINDOW_DAYS} ngày.`);
        }
        const payment = findPayment(state, order.id);
        const isCod = String(order.payment?.method || '').toUpperCase() === 'COD';
        if (!isCod && (!payment || !['stripe', 'vnpay'].includes(payment.provider) || !['paid', 'partially_refunded'].includes(payment.status))) {
          throw httpError(400, 'Không tìm thấy giao dịch thanh toán hợp lệ cho đơn này.');
        }
        const selection = resolveSelection(state, order, req.body?.items, httpError);
        const refund = computeRefund(state, order, selection);
        const remaining = remainingRefundable(payment, order);
        const amount = Math.min(refund.amount, remaining || refund.amount);
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
          items: selection.map((item) => ({ productId: item.productId, slug: item.slug, name: item.name, size: item.size, colorName: item.colorName, qty: item.qty, price: item.price })),
          coversWholeOrder: refund.coversWholeOrder,
          refundBreakdown: refund.breakdown,
          amount,
          currency: payment?.currency || STRIPE_CURRENCY,
          createdAt: now,
          updatedAt: now,
          shipBackDeadline: null,
          timeline: [{ s: 'requested', at: now, note: itemSummary(selection) }],
        };
        state.returnRequests.push(request);
        order.returnStatus = request.status;
        order.returnRequest = { id: request.id, code: request.code, status: request.status, kind: 'return' };
        order.history ||= [];
        order.history.push({ s: 'return_requested', at: now, returnRequestId: request.id });
        pushNotification(state, { userId: order.userId, title: `Yêu cầu trả hàng #${order.code}`, body: `${itemSummary(selection)} — yêu cầu đang chờ cửa hàng xem xét.`, type: 'Đơn hàng', action: `order:${order.id}` });
        response = { returnRequest: request, order, payment };
        return state;
      });
      res.json({ ok: true, ...response });
      void sendPushToUser(response.order.userId, { title: `Yêu cầu trả hàng #${response.order.code}`, body: 'Đang chờ cửa hàng xem xét.', data: { orderId: response.order.id, type: 'return-request' } });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tạo được yêu cầu trả hàng.' });
    }
  });

  // ---- Khách gửi hàng về (bước bên thứ ba của chiều ngược) ------------------
  // Tách riêng với bước "cửa hàng đã nhận": mã vận đơn chứng minh đơn vị vận
  // chuyển đã nhận kiện hàng, còn hàng về tới kho lại là việc của cửa hàng.
  api.post('/returns/:id/ship-back', requireAuth, (req, res) => {
    try {
      let response = null;
      update((state) => {
        const rr = findReturnRequest(state, req.params.id);
        if (!rr) throw httpError(404, 'Không tìm thấy yêu cầu.');
        if (String(rr.userId) !== req.user.id) throw httpError(403, 'Bạn không có quyền cập nhật yêu cầu này.');
        if (rr.kind !== 'return') throw httpError(400, 'Yêu cầu huỷ đơn không có bước gửi hàng về.');
        if (rr.status !== 'approved') throw httpError(400, 'Chỉ khai báo được sau khi cửa hàng duyệt yêu cầu trả hàng.');
        const carrier = String(req.body?.carrier || '').trim();
        const trackingCode = String(req.body?.trackingCode || '').trim();
        if (!carrier) throw httpError(400, 'Vui lòng nhập tên đơn vị vận chuyển.');
        if (trackingCode.length < 4) throw httpError(400, 'Vui lòng nhập mã vận đơn chiều về.');
        const now = Date.now();
        rr.status = 'shipped_back';
        rr.updatedAt = now;
        rr.shipBack = { carrier: carrier.slice(0, 80), trackingCode: trackingCode.slice(0, 60), note: String(req.body?.note || '').trim().slice(0, 300), at: now };
        rr.timeline.push({ s: 'shipped_back', at: now, note: `${carrier} · ${trackingCode}` });
        const order = state.orders.find((item) => item.id === rr.orderId);
        if (order) {
          order.returnStatus = rr.status;
          order.returnRequest = { id: rr.id, code: rr.code, status: rr.status, kind: rr.kind };
        }
        pushNotification(state, { userId: rr.userId, title: `Đã ghi nhận vận đơn trả hàng #${rr.orderCode}`, body: `${carrier} · ${trackingCode}. Cửa hàng sẽ kiểm hàng ngay khi nhận được.`, type: 'Đơn hàng', action: `order:${rr.orderId}` });
        response = { returnRequest: rr, order };
        return state;
      });
      res.json({ ok: true, ...response });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không cập nhật được vận đơn trả hàng.' });
    }
  });

  // ---- Khách tự rút yêu cầu khi chưa được duyệt ----------------------------
  api.post('/returns/:id/withdraw', requireAuth, (req, res) => {
    try {
      let response = null;
      update((state) => {
        const rr = findReturnRequest(state, req.params.id);
        if (!rr) throw httpError(404, 'Không tìm thấy yêu cầu.');
        if (String(rr.userId) !== req.user.id) throw httpError(403, 'Bạn không có quyền rút yêu cầu này.');
        if (rr.status !== 'requested') throw httpError(400, 'Chỉ rút được khi yêu cầu chưa được cửa hàng xử lý.');
        const now = Date.now();
        rr.status = 'cancelled';
        rr.updatedAt = now;
        rr.timeline.push({ s: 'cancelled', at: now, note: 'Khách tự rút yêu cầu' });
        const order = state.orders.find((item) => item.id === rr.orderId);
        if (order) {
          order.returnStatus = rr.status;
          order.returnRequest = { id: rr.id, code: rr.code, status: rr.status, kind: rr.kind };
        }
        response = { returnRequest: rr, order };
        return state;
      });
      res.json({ ok: true, ...response });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không rút được yêu cầu.' });
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
        if (!['received', 'refund_failed'].includes(returnRequest.status)) throw httpError(400, 'Cần xác nhận đã nhận và kiểm hàng trả về trước khi hoàn tiền.');

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
                releaseVoucher(next, order.id, 'order-cancelled', now);
                order.returnStatus = 'approved';
                order.returnRequest = { id: rr.id, code: rr.code, status: 'approved', kind: 'cancel' };
                // Hàng chưa từng rời cửa hàng — trả lại kho ngay khi huỷ được duyệt.
                restockCancelledOrder(next, order, 'cancel-approved');
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
          reject: ['requested', 'approved', 'shipped_back'],
          // Nhận hàng: bình thường sau khi khách khai vận đơn, nhưng khách mang
          // trực tiếp tới cửa hàng thì bỏ qua bước vận chuyển vẫn hợp lệ.
          receive: ['approved', 'shipped_back'],
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
          if (order) {
            order.status = 'cancelled';
            order.history.push({ s: 'cancelled', at: now, returnRequestId: returnRequest.id });
            releaseVoucher(next, order.id, 'order-cancelled', now);
            restockCancelledOrder(next, order, 'cancel-approved');
          }
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
          // approve (kind=return) → chờ khách gửi hàng về; receive → shop đã
          // nhận & kiểm hàng đạt, sẵn sàng hoàn tiền; cancel → khách rút yêu cầu.
          returnRequest.status = action === 'approve' ? 'approved' : action === 'receive' ? 'received' : 'cancelled';
          returnRequest.timeline.push({ s: returnRequest.status, at: now, note: adminNote });
          if (action === 'approve') {
            returnRequest.shipBackDeadline = now + SHIP_BACK_DAYS * 86400000;
            const body = `Vui lòng gửi ${itemSummary(returnRequest.items)} về cửa hàng trong ${SHIP_BACK_DAYS} ngày và nhập mã vận đơn trong ứng dụng.`;
            pushNotification(next, { userId: returnRequest.userId, title: `Yêu cầu trả hàng #${returnRequest.orderCode} đã được duyệt`, body, type: 'Đơn hàng', action: `order:${returnRequest.orderId}` });
            pendingPush = { title: `Yêu cầu trả hàng #${returnRequest.orderCode} đã được duyệt`, body };
          }
          if (action === 'receive') {
            // Kiểm hàng đạt = hàng đã nằm trong kho và bán lại được. Đây là mốc
            // đúng để cộng kho, không phải lúc hoàn tiền: tiền và hàng là hai
            // dòng riêng, hoàn tiền có thể lỗi nhưng hàng thì đã về rồi.
            restockReceivedReturn(next, returnRequest, 'return-received');
            const body = 'Cửa hàng đã nhận và kiểm hàng trả về. Khoản hoàn tiền sẽ được xử lý ngay.';
            pushNotification(next, { userId: returnRequest.userId, title: `Đã nhận hàng trả về #${returnRequest.orderCode}`, body, type: 'Đơn hàng', action: `order:${returnRequest.orderId}` });
            pendingPush = { title: `Đã nhận hàng trả về #${returnRequest.orderCode}`, body };
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
    confirmed: 'đã được cửa hàng xác nhận',
    shipping: 'đã được bàn giao cho đơn vị vận chuyển',
    delivered: 'đã được đơn vị vận chuyển giao tới bạn',
    completed: 'đã hoàn tất',
    cancelled: 'đã bị huỷ',
    returned: 'đã hoàn trả',
  };
  api.patch('/orders/:id', requireAdmin, (req, res) => {
    let response;
    let statusChanged = false;
    let failure = null;
    const state = update((next) => {
      const order = next.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
      if (!order) return next;
      const now = Date.now();
      if (req.body?.status && req.body.status !== order.status) {
        const target = String(req.body.status);
        const allowed = ORDER_STATUS_FLOW[String(order.status)] || [];
        // Quy trình một chiều: không cho nhảy cóc hay lùi trạng thái, để lịch sử
        // đơn luôn kể đúng những gì đã thực sự xảy ra.
        if (!allowed.includes(target)) {
          failure = `Không thể chuyển đơn từ "${order.status}" sang "${target}". Bước hợp lệ tiếp theo: ${allowed.join(', ') || 'không còn bước nào'}.`;
          return next;
        }
        order.status = target;
        statusChanged = true;
        if (order.status === 'delivered') order.deliveredAt ||= now;
        if (order.status === 'completed') order.completedAt ||= now;
        // Đơn kết thúc mà hàng không đi tới khách (huỷ) hoặc quay về kho (trả)
        // thì tồn kho phải được hoàn — xem lib/inventory.js.
        if (order.status === 'cancelled') {
          restockCancelledOrder(next, order, 'admin-cancelled-order');
          // Shop huỷ đơn: khách không được mất lượt dùng voucher.
          releaseVoucher(next, order.id, 'admin-cancelled-order', now);
          extendIfExpiredWhileReserved(next, order.id, now);
        }
        if (order.status === 'returned') restockRemainingOrderUnits(next, order, 'admin-marked-returned');
        // Đơn hoàn tất = tiền đã về (COD thu tại nhà, online đã paid từ trước).
        if (order.status === 'completed') consumeVoucher(next, order.id, 'admin-completed-order', now);
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
        const extra = order.status === 'delivered'
          ? ' Vui lòng kiểm hàng và bấm "Đã nhận hàng" trong ứng dụng.'
          : order.status === 'completed' ? ` Bạn có ${RETURN_WINDOW_DAYS} ngày để yêu cầu đổi/trả.` : '';
        pushNotification(next, { userId: order.userId, title: `Đơn hàng #${order.code}`, body: `Đơn của bạn ${label}.${extra}`, type: 'Đơn hàng', action: `order:${order.id}` });
      }
      const reconciled = reconcileFlagRewards(next);
      if (reconcileGoalRewards) reconcileGoalRewards(next, now, pushNotification);
      response = { order, award: reconciled.awards.find((item) => item.orderId === order.id) || order.flagcardAward || null };
      return next;
    });
    if (failure) return res.status(400).json({ ok: false, message: failure });
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
