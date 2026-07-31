// Thanh toán qua VNPay Sandbox: tạo URL thanh toán, xác nhận return/IPN, đối
// soát giao dịch treo, và hoàn tiền. finalizeVnpayReturnFromParams/issueVnpayRefund
// được export qua makeVnpayHelpers(ctx) để routes/payments.js và routes/returns.js dùng lại.
const {
  vnpayEnabled, vnpayAmount, localVnpayAmount, vnpayAsciiText, vnpayFormatDate,
  buildVnpayPaymentUrl, verifyVnpayParams, vnpayApiSign,
  VNPAY_TMN_CODE, VNPAY_API_URL, VNPAY_RETURN_URL, VNPAY_VERSION,
} = require('../lib/vnpaySign');
const { findPayment, findReturnRequest, reusableProviderOrder } = require('../lib/paymentLookup');
const { STRIPE_CURRENCY } = require('../lib/stripeMoney');
const { makeCreateOrderInState } = require('./orders');

function makeVnpayHelpers(ctx) {
  const { read, update, httpError, reconcileFlagRewards } = ctx;

  // Đối soát dùng chung cho cả app tự bắt returnUrl trong WebView lẫn IPN thật.
  // Trả {code} thay vì ném lỗi để mỗi endpoint tự dịch sang định dạng riêng.
  function finalizeVnpayReturnFromParams(params = {}, options = {}) {
    if (!options.skipVerify && !verifyVnpayParams(params)) return { code: 'invalid_signature' };
    const txnRef = String(params.vnp_TxnRef || '');
    let outcome = { code: 'not_found' };
    update((state) => {
      const payment = findPayment(state, txnRef);
      const order = payment
        ? state.orders.find((item) => item.id === payment.orderId)
        : state.orders.find((item) => item.code === txnRef);
      if (!payment || !order) { outcome = { code: 'not_found' }; return state; }
      if (Number(params.vnp_Amount) !== vnpayAmount(order.total)) {
        outcome = { code: 'amount_mismatch', order, payment };
        return state;
      }
      if (payment.status === 'paid') { outcome = { code: 'already_done', order, payment }; return state; }
      const now = Date.now();
      const responseCode = String(params.vnp_ResponseCode || '');
      const transactionStatus = String(params.vnp_TransactionStatus || responseCode);
      if (responseCode === '00' && transactionStatus === '00') {
        payment.status = 'paid';
        payment.transactionCode = txnRef;
        payment.vnpTransactionNo = String(params.vnp_TransactionNo || '');
        payment.vnpBankCode = String(params.vnp_BankCode || '');
        payment.vnpCardType = String(params.vnp_CardType || '');
        payment.vnpPayDate = String(params.vnp_PayDate || '');
        payment.amount = localVnpayAmount(params.vnp_Amount);
        payment.paidAt ||= now;
        payment.updatedAt = now;
        payment.refundable = true;
        payment.paymentMethodType = payment.vnpCardType || 'vnpay';
        order.payment = {
          ...order.payment,
          method: 'VNPay', provider: 'vnpay', status: 'paid', txn: txnRef,
          currency: 'VND', paymentId: payment.id,
          bank: { code: payment.vnpBankCode, type: payment.vnpCardType },
        };
        if (['pending_payment', 'pending'].includes(order.status)) order.status = 'confirmed';
        order.history ||= [];
        if (!order.history.some((item) => item.s === 'paid' && item.txn === txnRef)) {
          order.history.push({ s: 'paid', at: now, txn: txnRef });
        }
        reconcileFlagRewards(state);
        outcome = { code: 'success', order, payment };
      } else {
        payment.status = responseCode === '24' ? 'cancelled' : 'failed';
        payment.failureReason = responseCode;
        payment.updatedAt = now;
        order.payment.status = payment.status;
        order.history ||= [];
        order.history.push({ s: payment.status, at: now, reason: responseCode });
        outcome = { code: payment.status, order, payment };
      }
      return state;
    });
    return outcome;
  }

  async function vnpayQueryTransaction(payment) {
    const now = new Date();
    const requestId = `QR${Date.now()}`;
    const createDate = vnpayFormatDate(now);
    const orderInfo = vnpayAsciiText(`Kiem tra giao dich ${payment.orderCode}`);
    const transactionDate = String(payment.vnpCreateDate || createDate);
    const ipAddr = '127.0.0.1';
    const signParts = [requestId, VNPAY_VERSION, 'querydr', VNPAY_TMN_CODE, payment.transactionCode, transactionDate, createDate, ipAddr, orderInfo];
    const secureHash = vnpayApiSign(signParts);
    const payload = {
      vnp_RequestId: requestId, vnp_Version: VNPAY_VERSION, vnp_Command: 'querydr', vnp_TmnCode: VNPAY_TMN_CODE,
      vnp_TxnRef: payment.transactionCode, vnp_OrderInfo: orderInfo, vnp_TransactionDate: transactionDate,
      vnp_CreateDate: createDate, vnp_IpAddr: ipAddr, vnp_SecureHash: secureHash,
    };
    const response = await fetch(VNPAY_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return response.json();
  }

  async function issueVnpayRefund(paymentId, body = {}) {
    if (!vnpayEnabled()) throw httpError(503, 'Chế độ thử nghiệm VNPay chưa sẵn sàng.');
    const snapshot = read();
    const payment = findPayment(snapshot, paymentId);
    if (!payment || payment.provider !== 'vnpay') throw httpError(404, 'Không tìm thấy giao dịch VNPay.');
    if (!payment.refundable || !['paid', 'partially_refunded'].includes(payment.status)) {
      throw httpError(400, `Giao dịch ở trạng thái ${payment.status}, không thể hoàn tiền.`);
    }
    const alreadyRefunded = Number(payment.refundedAmount || 0) + Number(payment.pendingRefundAmount || 0);
    const remaining = Math.max(0, Number(payment.amount || 0) - alreadyRefunded);
    const requested = body?.amount === undefined || body?.amount === null || body?.amount === ''
      ? remaining
      : Math.min(remaining, Math.max(1, Number(body.amount)));
    if (requested <= 0) throw httpError(400, 'Giao dịch đã được hoàn hoặc đang chờ hoàn đủ tiền.');
    const isFullRefund = alreadyRefunded === 0 && requested >= remaining;

    const now = new Date();
    const requestId = `REF${Date.now()}`;
    const createDate = vnpayFormatDate(now);
    const ipAddr = '127.0.0.1';
    const orderInfo = vnpayAsciiText(`Hoan tien don hang ${payment.orderCode}`);
    const amount = vnpayAmount(requested);
    const transactionType = isFullRefund ? '02' : '03';
    const transactionNo = String(payment.vnpTransactionNo || '0');
    const transactionDate = String(payment.vnpCreateDate || createDate);
    const createBy = 'japano-admin-test';
    const signParts = [requestId, VNPAY_VERSION, 'refund', VNPAY_TMN_CODE, transactionType, payment.transactionCode, String(amount), transactionNo, transactionDate, createBy, createDate, ipAddr, orderInfo];
    const secureHash = vnpayApiSign(signParts);
    const payload = {
      vnp_RequestId: requestId, vnp_Version: VNPAY_VERSION, vnp_Command: 'refund', vnp_TmnCode: VNPAY_TMN_CODE,
      vnp_TransactionType: transactionType, vnp_TxnRef: payment.transactionCode, vnp_Amount: amount,
      vnp_TransactionNo: transactionNo, vnp_TransactionDate: transactionDate, vnp_CreateBy: createBy,
      vnp_CreateDate: createDate, vnp_IpAddr: ipAddr, vnp_OrderInfo: orderInfo, vnp_SecureHash: secureHash,
    };
    let response;
    try {
      response = await fetch(VNPAY_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (error) {
      throw httpError(502, 'Không kết nối được VNPay để hoàn tiền.');
    }
    const data = await response.json().catch(() => ({}));
    if (String(data.vnp_ResponseCode) !== '00') {
      throw httpError(422, `VNPay từ chối hoàn tiền: ${data.vnp_Message || data.vnp_ResponseCode || 'lỗi không xác định'}.`);
    }

    const returnRequestId = String(body.returnRequestId || '');
    const record = {
      id: `vnpref-${Date.now()}`,
      amount: requested,
      currency: 'VND',
      status: 'succeeded',
      reason: 'requested_by_customer',
      returnRequestId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    let result = null;
    update((state) => {
      const p = findPayment(state, payment.id);
      if (!p) return state;
      const now2 = Date.now();
      p.refunds ||= [];
      p.refunds.push(record);
      p.refundedAmount = p.refunds.filter((item) => item.status === 'succeeded').reduce((sum, item) => sum + Number(item.amount || 0), 0);
      p.pendingRefundAmount = 0;
      const fullyRefunded = p.refundedAmount >= Number(p.amount || 0);
      p.status = fullyRefunded ? 'refunded' : 'partially_refunded';
      p.refundId = record.id;
      p.refundedAt = now2;
      p.updatedAt = now2;
      const order = state.orders.find((item) => item.id === p.orderId);
      if (order) {
        order.payment = { ...order.payment, status: p.status, refundId: record.id, refundedAmount: p.refundedAmount };
      }
      const returnRequest = findReturnRequest(state, returnRequestId)
        || (state.returnRequests || []).find((item) => item.paymentId === p.id && !['rejected', 'cancelled', 'refunded'].includes(item.status));
      if (returnRequest) {
        returnRequest.refundId = record.id;
        returnRequest.refundStatus = record.status;
        returnRequest.status = 'refunded';
        returnRequest.updatedAt = now2;
        returnRequest.timeline ||= [];
        returnRequest.timeline.push({ s: 'refunded', at: now2, refundId: record.id });
        if (order) {
          order.returnStatus = 'refunded';
          order.returnRequest = { id: returnRequest.id, code: returnRequest.code, status: 'refunded' };
          if (fullyRefunded) order.status = 'returned';
        }
      } else if (order && fullyRefunded) {
        order.status = order.status === 'completed' ? 'returned' : 'cancelled';
      }
      if (order) {
        order.history ||= [];
        order.history.push({ s: p.status, at: now2, refundId: record.id, amount: record.amount });
      }
      result = { payment: p, order, refund: record, returnRequest };
      return state;
    });
    if (!result) throw httpError(500, 'VNPay đã hoàn tiền nhưng database chưa tìm thấy giao dịch để đồng bộ.');
    return result;
  }

  return { finalizeVnpayReturnFromParams, vnpayQueryTransaction, issueVnpayRefund };
}

module.exports = function registerVnpayRoutes(api, ctx) {
  const { read, write, httpError, requireAuth } = ctx;
  const { finalizeVnpayReturnFromParams, vnpayQueryTransaction } = makeVnpayHelpers(ctx);
  const createOrderInState = makeCreateOrderInState(ctx);

  api.get('/vnpay/config', (req, res) => {
    res.json({
      ok: true,
      enabled: vnpayEnabled(),
      mode: vnpayEnabled() ? 'test' : 'disabled',
      currency: 'VND',
      merchantDisplayName: ctx.STRIPE_MERCHANT_DISPLAY_NAME,
      // App dùng chuỗi này để nhận biết WebView vừa điều hướng tới trang kết
      // quả VNPay (đường dẫn không cần tồn tại thật, chỉ để app bắt URL).
      returnUrlMarker: VNPAY_RETURN_URL,
    });
  });

  // Tạo/khôi phục đơn hàng + phiên thanh toán VNPay Sandbox, trả về URL để app
  // mở trong WebView ngay trong màn hình thanh toán (không rời ứng dụng).
  api.post('/vnpay/payment-url', requireAuth, (req, res) => {
    if (!vnpayEnabled()) return res.status(503).json({ ok: false, message: 'Chế độ thử nghiệm VNPay chưa được cấu hình.' });
    req.body = { ...req.body, userId: req.user.id }; // userId luôn từ JWT, không tin client
    try {
      const state = read();
      let order = reusableProviderOrder(state, req.body || {}, 'vnpay');
      let payment = order ? findPayment(state, order.id) : null;

      let result = null;
      if (!order) {
        result = createOrderInState(state, req.body || {}, {
          paymentMethod: 'VNPay', paymentStatus: 'pending', orderStatus: 'pending_payment',
        });
        order = result.order;
      }
      if (order.total <= 0) throw httpError(400, 'Tổng tiền thanh toán phải lớn hơn 0.');

      const now = Date.now();
      payment ||= {
        id: `pay-${now}`,
        code: `PAY-${order.code}-${String(now).slice(-6)}`,
        orderId: order.id,
        orderCode: order.code,
        userId: order.userId,
        provider: 'vnpay',
        method: 'VNPay',
        status: 'pending',
        amount: order.total,
        originalAmount: order.subtotal + order.ship,
        discount: order.discount,
        voucherDiscount: order.voucherDiscount,
        paymentDiscount: order.paymentDiscount,
        promotionCode: 'VNPAY5',
        currency: 'VND',
        transactionCode: order.code,
        refundable: false,
        refunds: [],
        createdAt: now,
        updatedAt: now,
      };

      const ipAddr = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
      const { paymentUrl, createDate } = buildVnpayPaymentUrl({
        txnRef: order.code,
        amount: order.total,
        orderInfo: `Thanh toan don hang ${order.code} JAPANO`,
        ipAddr,
        bankCode: req.body?.bankCode,
        locale: req.body?.locale,
      });
      payment.status = 'pending';
      payment.transactionCode = order.code;
      payment.vnpCreateDate = createDate;
      payment.updatedAt = Date.now();
      order.payment = { ...order.payment, status: 'pending', txn: order.code, paymentId: payment.id };
      state.payments ||= [];
      if (!state.payments.some((item) => item.id === payment.id)) state.payments.push(payment);
      write(state);
      res.json({
        ok: true, paymentUrl, returnUrlMarker: VNPAY_RETURN_URL,
        order, payment, mode: 'test', flagcardEligibility: result?.flagcardEligibility,
      });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tạo được liên kết thanh toán VNPay.' });
    }
  });

  // App gọi endpoint này ngay khi WebView bắt được returnUrl (kèm toàn bộ query
  // VNPay trả về) — vì backend chạy trên máy cá nhân/LAN, VNPay không thể gọi
  // thẳng IPN nên đây là đường xác nhận chính cho môi trường thử nghiệm.
  api.post('/vnpay/return', (req, res) => {
    try {
      const result = finalizeVnpayReturnFromParams(req.body || {});
      if (result.code === 'invalid_signature') throw httpError(400, 'Chữ ký VNPay không hợp lệ.');
      if (result.code === 'not_found') throw httpError(404, 'Không tìm thấy đơn hàng gắn với giao dịch VNPay.');
      if (result.code === 'amount_mismatch') throw httpError(409, 'Số tiền VNPay trả về không khớp đơn hàng.');
      res.json({ ok: true, status: result.code, order: result.order, payment: result.payment });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không xác nhận được thanh toán VNPay.' });
    }
  });

  // IPN thật theo đúng hợp đồng VNPay (chỉ nhận được khi backend có địa chỉ
  // public); giữ lại để triển khai thật vẫn hoạt động đúng chuẩn ngay cả khi
  // môi trường thử nghiệm LAN chỉ dùng được đường /vnpay/return ở trên.
  api.get('/vnpay/ipn', (req, res) => {
    try {
      const result = finalizeVnpayReturnFromParams(req.query || {});
      if (result.code === 'invalid_signature') return res.json({ RspCode: '97', Message: 'Invalid signature' });
      if (result.code === 'not_found') return res.json({ RspCode: '01', Message: 'Order not found' });
      if (result.code === 'amount_mismatch') return res.json({ RspCode: '04', Message: 'Invalid amount' });
      if (result.code === 'already_done') return res.json({ RspCode: '02', Message: 'Order already confirmed' });
      return res.json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (error) {
      res.json({ RspCode: '99', Message: 'Unknown error' });
    }
  });

  // Đối soát các giao dịch VNPay còn "pending" quá lâu (app có thể đã bị đóng
  // trước khi kịp gửi /vnpay/return) bằng API tra soát chính thức (querydr).
  api.post('/vnpay/reconcile', async (req, res) => {
    if (!vnpayEnabled()) return res.status(503).json({ ok: false, message: 'Chế độ thử nghiệm VNPay chưa sẵn sàng.' });
    const snapshot = read();
    const candidates = (snapshot.payments || [])
      .filter((payment) => payment.provider === 'vnpay' && payment.status === 'pending' && Date.now() - Number(payment.createdAt || 0) > 60000)
      .slice(0, 30);
    const results = [];
    for (const payment of candidates) {
      try {
        const data = await vnpayQueryTransaction(payment);
        if (String(data.vnp_ResponseCode) === '00' && String(data.vnp_TransactionStatus) === '00') {
          const finalized = finalizeVnpayReturnFromParams({
            vnp_TxnRef: payment.transactionCode,
            vnp_Amount: data.vnp_Amount,
            vnp_ResponseCode: '00',
            vnp_TransactionStatus: '00',
            vnp_TransactionNo: data.vnp_TransactionNo,
            vnp_BankCode: data.vnp_BankCode,
          }, { skipVerify: true });
          results.push({ paymentId: payment.id, status: finalized.payment?.status || 'paid' });
        } else {
          results.push({ paymentId: payment.id, status: 'pending', message: data.vnp_Message || '' });
        }
      } catch (error) {
        results.push({ paymentId: payment.id, status: 'sync_error', message: error.message });
      }
    }
    res.json({ ok: true, checked: candidates.length, results });
  });
};

module.exports.makeVnpayHelpers = makeVnpayHelpers;
