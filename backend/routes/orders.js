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

// Biến thể khớp theo màu+size; sản phẩm không khai báo variants (ảnh minh hoạ,
// phụ kiện cũ) thì bỏ qua kiểm tra tồn kho thay vì chặn nhầm.
function findVariant(product, colorName, size) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  return variants.find((v) => String(v.colorName || 'Mặc định') === String(colorName) && String(v.size || 'M') === String(size))
    || variants.find((v) => String(v.size || 'M') === String(size))
    || null;
}

function assertStockAvailable(state, items, httpError) {
  for (const item of items) {
    const product = state.products.find((p) => p.slug === item.slug || p.id === item.slug);
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) continue;
    const variant = findVariant(product, item.colorName, item.size);
    const stock = variant ? Math.max(0, Number(variant.stock) || 0) : 0;
    if (!variant || stock < item.qty) {
      throw httpError(409, `"${item.name}" (${item.colorName}/${item.size}) chỉ còn ${stock} sản phẩm, không đủ số lượng bạn chọn.`);
    }
  }
}

// Trừ kho ngay khi tạo đơn (kể cả online-pending) để hai khách không cùng mua
// được nốt sản phẩm cuối cùng — đơn online bị huỷ/thất bại sẽ không tự hoàn
// kho lại trong bản này (xem ghi chú theo dõi tồn kho ở README/kế hoạch kế tiếp).
function decrementStock(state, items) {
  items.forEach((item) => {
    const product = state.products.find((p) => p.slug === item.slug || p.id === item.slug);
    const variant = product && findVariant(product, item.colorName, item.size);
    if (variant) variant.stock = Math.max(0, Number(variant.stock || 0) - item.qty);
  });
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

function makeCreateOrderInState({ httpError, validateVoucher, vipDiscountForSelection, vipStatus, awardFlagcardForOrder, pushNotification }) {
  return function createOrderInState(s, body = {}, options = {}) {
    const b = body || {};
    const now = Date.now();
    const userId = String(b.userId || b.customer?.id || 'guest').trim() || 'guest';
    // Idempotency: double-tap hoặc app gọi lại do mất mạng giữa chừng không tạo đơn trùng.
    const clientRequestId = String(b.clientRequestId || '').trim();
    if (clientRequestId) {
      const existing = s.orders.find((order) => order.clientRequestId === clientRequestId);
      if (existing) {
        return {
          order: existing,
          award: null,
          vipStatus: vipStatus(s, existing.userId, now),
          flagcardEligibility: {
            qualifiesByAmount: false,
            threshold: Number(s.flagcardConfig.qualifyingOrderMin),
            awarded: Boolean(existing.flagcardAward),
            pendingSuccessfulPayment: false,
          },
          duplicate: true,
        };
      }
    }
    upsertOrderCustomer(s, b, userId, now);
    const items = normalizedOrderItems(s, b.items);
    if (!items.length) throw httpError(400, 'Giỏ hàng không có sản phẩm hợp lệ.');
    assertStockAvailable(s, items, httpError);
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
      clientRequestId: clientRequestId || null,
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
    decrementStock(s, items);
    if (userId && userId !== 'guest') {
      pushNotification(s, {
        userId,
        title: `Đặt hàng thành công · #${order.code}`,
        body: `Đơn ${Number(order.total).toLocaleString('vi-VN')}đ đã được ghi nhận, cảm ơn bạn đã mua sắm tại JAPANO.`,
        type: 'Đơn hàng',
        action: `order:${order.id}`,
      });
    }
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
  const { read, write, httpError, requireAuth } = ctx;
  const createOrderInState = makeCreateOrderInState(ctx);

  // Tạo đơn COD từ app mobile. Giá/voucher luôn được tính lại từ catalog server.
  // Bắt buộc đăng nhập — userId luôn lấy từ JWT đã xác thực, không tin body,
  // để không ai đặt hàng "giả danh" người khác.
  api.post('/orders', requireAuth, (req, res) => {
    try {
      const state = read();
      const result = createOrderInState(state, { ...req.body, userId: req.user.id });
      write(state);
      res.json({ ok: true, ...result });
      if (!result.duplicate) {
        void ctx.sendPushToUser(req.user.id, {
          title: `Đặt hàng thành công · #${result.order.code}`,
          body: `Đơn ${Number(result.order.total).toLocaleString('vi-VN')}đ đã được ghi nhận.`,
          data: { orderId: result.order.id, type: 'order-created' },
        });
      }
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
module.exports.findVariant = findVariant;
module.exports.assertStockAvailable = assertStockAvailable;
module.exports.decrementStock = decrementStock;
