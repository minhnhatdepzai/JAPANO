// Tạo đơn hàng (COD trực tiếp; Stripe/VNPay tạo qua routes/paymentsStripe.js
// và routes/paymentsVnpay.js nhưng đều gọi chung createOrderInState ở đây) +
// tra cứu đơn. Cũng export các helper cho 2 module thanh toán dùng lại.
const { STRIPE_CURRENCY } = require('../lib/stripeMoney');
const { findPayment, findReturnRequest } = require('../lib/paymentLookup');

const PAYMENT_PROMOS = {
  stripe: { code: 'STRIPE10', percent: 10, label: 'Ưu đãi thanh toán thẻ Stripe 10%' },
  vnpay: { code: 'VNPAY5', percent: 5, label: 'Ưu đãi thanh toán qua VNPay 5%' },
};

function paymentProviderOf(method) {
  const value = String(method || '');
  if (/stripe/i.test(value)) return 'stripe';
  if (/vnpay/i.test(value)) return 'vnpay';
  return 'cod';
}
function isOnlinePayment(method) {
  return paymentProviderOf(method) !== 'cod';
}

function normalizedOrderItems(state, inputItems) {
  return (Array.isArray(inputItems) ? inputItems : []).map((item) => {
    const product = state.products.find((candidate) => candidate.slug === String(item.slug || item.productId) || candidate.id === String(item.slug || item.productId));
    const qty = Math.min(20, Math.max(1, Number(item.qty) || 1));
    return {
      productId: product?.slug || String(item.slug || item.productId || ''),
      slug: product?.slug || String(item.slug || item.productId || ''),
      name: product?.name || String(item.name || 'Sản phẩm'),
      colorName: item.colorName || item.color || 'Mặc định',
      colorHex: item.colorHex || product?.colorHex || '#1A1410',
      size: item.size || 'M',
      qty,
      price: Number(product?.price ?? item.price) || 0,
    };
  }).filter((item) => item.productId && item.price >= 0);
}

function upsertOrderCustomer(state, body, userId, now) {
  if (!userId || userId === 'guest') return null;
  state.users ||= [];
  const customer = body?.customer || {};
  let user = state.users.find((item) => String(item.id) === String(userId));
  if (!user) {
    user = {
      id: userId,
      name: String(customer.name || customer.email || 'Thành viên JAPANO').trim(),
      email: String(customer.email || '').trim().toLowerCase(),
      role: 'customer',
      status: 'active',
      orders: 0,
      spent: 0,
      tryons: 0,
      vip: 'Thành viên',
      joinedAt: now,
    };
    state.users.push(user);
  } else if (String(user.role || '').toLowerCase() === 'customer') {
    if (customer.name) user.name = String(customer.name).trim();
    if (customer.email) user.email = String(customer.email).trim().toLowerCase();
  }
  return user;
}

function requestedVipProductId(body = {}) {
  return String(body.vipProductId || body.vipSelection?.productId || body.vipSelection?.slug || '').trim();
}

function makeCreateOrderInState({ httpError, validateVoucher, vipDiscountForSelection, vipStatus, awardFlagcardForOrder }) {
  return function createOrderInState(s, body = {}, options = {}) {
    const b = body || {};
    const now = Date.now();
    const userId = String(b.userId || b.customer?.id || 'guest').trim() || 'guest';
    upsertOrderCustomer(s, b, userId, now);
    const items = normalizedOrderItems(s, b.items);
    if (!items.length) throw httpError(400, 'Giỏ hàng không có sản phẩm hợp lệ.');
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const method = String(options.paymentMethod || b.paymentMethod || 'COD');
    const provider = paymentProviderOf(method);
    const promo = PAYMENT_PROMOS[provider] || null;
    const voucherResult = b.voucherCode ? validateVoucher(s, { code: b.voucherCode, userId, subtotal }) : null;
    if (b.voucherCode && !voucherResult?.ok) throw httpError(400, voucherResult?.message || 'Voucher không hợp lệ.');
    const voucherDiscount = Number(voucherResult?.discount || 0);
    const paymentDiscount = promo ? Math.round(subtotal * (promo.percent / 100)) : 0;
    const vipResult = vipDiscountForSelection(s, {
      userId,
      items,
      productId: requestedVipProductId(b),
      selection: b.vipSelection,
      now,
    });
    const vipDiscount = Number(vipResult.discount || 0);
    const discount = Math.min(subtotal, voucherDiscount + paymentDiscount + vipDiscount);
    const ship = Number(s.shop.shipFee) || 0;
    const order = {
      id: 'o' + now,
      code: 'JP' + (240700 + s.orders.length),
      userId,
      customer: { ...(b.customer || { name: 'Khách lẻ', phone: '' }), id: userId },
      address: b.address || '',
      addressDetails: b.addressDetails && typeof b.addressDetails === 'object' ? b.addressDetails : null,
      items,
      subtotal,
      discount,
      voucherDiscount,
      paymentDiscount,
      vipDiscount,
      vipPromotion: vipResult.promotion,
      paymentPromotion: paymentDiscount > 0 ? { code: promo.code, label: promo.label, percent: promo.percent } : null,
      discountCode: voucherResult?.voucher?.code || (paymentDiscount > 0 ? promo.code : (vipDiscount > 0 ? 'JAPANO-VIP10' : '')),
      total: Math.max(0, subtotal - discount + ship),
      ship,
      payment: {
        method,
        provider,
        status: String(options.paymentStatus || 'unpaid'),
        txn: String(options.transactionCode || '—'),
        currency: provider === 'vnpay' ? 'VND' : STRIPE_CURRENCY,
      },
      status: String(options.orderStatus || 'pending'),
      createdAt: now,
      history: [{ s: String(options.orderStatus || 'pending'), at: now }],
      source: 'mobile',
    };
    if (voucherResult?.voucher) {
      const voucher = s.vouchers.find((item) => item.code === voucherResult.voucher.code);
      voucher.used = (Number(voucher.used) || 0) + 1;
      const redemption = { id: `redeem-${order.id}`, code: voucher.code, userId, orderId: order.id, discount: voucherDiscount, redeemedAt: now };
      s.voucherRedemptions.push(redemption);
      order.voucherRedemption = redemption;
    }
    s.orders.push(order);
    // COD được xác nhận ngay khi tạo đơn; thanh toán trực tuyến chỉ cấp thẻ sau callback paid.
    const qualifiesByAmount = order.total >= Number(s.flagcardConfig.qualifyingOrderMin);
    const award = !isOnlinePayment(method) && qualifiesByAmount
      ? awardFlagcardForOrder(s, order, now)
      : null;
    s.seeded = true;
    return {
      order,
      award,
      vipStatus: vipStatus(s, userId, now),
      flagcardEligibility: {
        qualifiesByAmount,
        threshold: Number(s.flagcardConfig.qualifyingOrderMin),
        awarded: Boolean(award?.cardId),
        pendingSuccessfulPayment: isOnlinePayment(method) && qualifiesByAmount,
      },
    };
  };
}

module.exports = function registerOrdersRoutes(api, ctx) {
  const { read, write, httpError } = ctx;
  const createOrderInState = makeCreateOrderInState(ctx);

  // Tạo đơn COD từ app mobile. Giá/voucher luôn được tính lại từ catalog server.
  api.post('/orders', (req, res) => {
    try {
      const state = read();
      const result = createOrderInState(state, req.body || {});
      write(state);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tạo được đơn hàng.' });
    }
  });

  api.get('/orders/:id', (req, res) => {
    const state = read();
    const order = state.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
    if (!order) return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    res.json({ ok: true, order, payment: findPayment(state, order.id) || null, returnRequest: findReturnRequest(state, order.id) || null });
  });

  return { createOrderInState };
};

module.exports.makeCreateOrderInState = makeCreateOrderInState;
module.exports.normalizedOrderItems = normalizedOrderItems;
module.exports.paymentProviderOf = paymentProviderOf;
module.exports.isOnlinePayment = isOnlinePayment;
module.exports.requestedVipProductId = requestedVipProductId;
module.exports.upsertOrderCustomer = upsertOrderCustomer;
