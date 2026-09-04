// Tạo đơn hàng (COD trực tiếp; Stripe/VNPay tạo qua routes/paymentsStripe.js
// và routes/paymentsVnpay.js nhưng đều gọi chung createOrderInState ở đây) +
// tra cứu đơn. Cũng export các helper cho 2 module thanh toán dùng lại.
const { STRIPE_CURRENCY } = require('../lib/stripeMoney');
const { reserve: reserveVoucher, hasCapacity } = require('../lib/voucherLifecycle');
const { findPayment, findReturnRequest } = require('../lib/paymentLookup');
const { findVariant, unitPrice } = require('../lib/pricing');

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
      // Giá LUÔN tính lại ở máy chủ theo đúng màu+size khách chọn — không tin
      // con số client gửi lên. Biến thể có giá riêng thì ăn giá riêng, không
      // thì lấy giá sản phẩm (xem lib/pricing.js).
      price: product
        ? unitPrice(product, item.colorName || item.color, item.size)
        : Number(item.price) || 0,
    };
  }).filter((item) => item.productId && item.price >= 0);
}

function assertStockAvailable(state, items, httpError) {
  for (const item of items) {
    const product = state.products.find((p) => p.slug === item.slug || p.id === item.slug);
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) continue;
    // findVariant() cố ý dễ dãi: khớp không được cả màu lẫn size thì lùi về chỉ
    // khớp size, để sản phẩm một màu không bị chặn oan. Với TỒN KHO thì sự dễ
    // dãi đó là một lỗ hổng: đặt một màu không hề tồn tại vẫn được nhận đơn, và
    // số lượng bị trừ vào biến thể của MỘT MÀU KHÁC. Ở đây bắt buộc màu phải là
    // màu thật của sản phẩm trước khi cho đi tiếp.
    const colors = new Set(variants.map((variant) => String(variant.colorName || 'Mặc định')));
    const requestedColor = String(item.colorName || 'Mặc định');
    if (colors.size > 1 && !colors.has(requestedColor)) {
      throw httpError(400, `"${item.name}" không có màu "${requestedColor}". Vui lòng chọn lại màu.`);
    }
    const sizes = new Set(variants.map((variant) => String(variant.size || 'M')));
    const requestedSize = String(item.size || 'M');
    if (!sizes.has(requestedSize)) {
      throw httpError(400, `"${item.name}" không có kích cỡ "${requestedSize}". Vui lòng chọn lại kích cỡ.`);
    }
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

// Mã đơn cũ tính bằng `'JP' + (240700 + s.orders.length)`, tức là suy ra từ SỐ
// LƯỢNG đơn đang có. Xoá một đơn cũ là đơn kế tiếp nhận lại đúng mã của một đơn
// đã tồn tại — hai đơn khác nhau cùng mã, mà tra cứu đơn lại cho phép tìm theo
// `code`, nên khách có thể mở nhầm đơn của người khác. Ở đây lấy mốc cao nhất
// từng dùng rồi tăng tiếp, và dò tới khi chắc chắn chưa ai giữ mã đó.
function nextOrderCode(state) {
  const used = new Set((state.orders || []).map((order) => String(order.code || '')));
  let highest = 240700 + (state.orders || []).length;
  for (const code of used) {
    const match = /^JP(\d+)$/.exec(code);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  let candidate = highest + 1;
  while (used.has(`JP${candidate}`)) candidate += 1;
  return `JP${candidate}`;
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
    // Truyền cả DÒNG HÀNG đã chuẩn hoá từ catalog server, không chỉ subtotal:
    // voucher phạm vi sản phẩm phải biết giỏ có gì mới tính đúng được.
    const voucherResult = b.voucherCode ? validateVoucher(s, { code: b.voucherCode, userId, subtotal, items }) : null;
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
      code: nextOrderCode(s),
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
      // GIỮ CHỖ, chưa tiêu. `voucher.used` chỉ tăng khi tiền thực sự về
      // (COD hoàn thành, hoặc callback thanh toán báo paid) — xem
      // lib/voucherLifecycle.js. Trước đây cộng ngay ở đây nên thanh toán thất
      // bại hay huỷ đơn đều làm khách mất trắng lượt dùng.
      order.voucherAllocations = voucherResult.allocations || [];
      order.voucherScope = voucherResult.scope || 'order';
      order.voucherEligibleSubtotal = Number(voucherResult.eligibleSubtotal || 0);
      const redemption = reserveVoucher(s, {
        voucher,
        userId,
        orderId: order.id,
        discount: voucherDiscount,
        eligibleSubtotal: voucherResult.eligibleSubtotal,
        allocations: voucherResult.allocations,
        scope: voucherResult.scope,
      }, now);
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
  const { read, write, httpError, requireAuth, reconcileGoalRewards, pushNotification } = ctx;
  const createOrderInState = makeCreateOrderInState(ctx);

  // Tạo đơn COD từ app mobile. Giá/voucher luôn được tính lại từ catalog server.
  // Bắt buộc đăng nhập — userId luôn lấy từ JWT đã xác thực, không tin body,
  // để không ai đặt hàng "giả danh" người khác.
  api.post('/orders', requireAuth, (req, res) => {
    try {
      const state = read();
      const result = createOrderInState(state, { ...req.body, userId: req.user.id });
      // Mua đúng món đã tích đủ quỹ = mục tiêu hoàn thành trọn vẹn (lib/goalFund.js).
      if (reconcileGoalRewards) reconcileGoalRewards(state, Date.now(), pushNotification);
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

  // Một đơn nhiều món có thể có NHIỀU yêu cầu trả hàng (mỗi lần trả một vài
  // món khác nhau), nên trả về cả danh sách. `returnRequest` là yêu cầu mới
  // nhất, giữ lại cho các màn hình cũ chỉ đọc một yêu cầu.
  // Yêu cầu đăng nhập VÀ đúng chủ đơn. Trước đây route này hoàn toàn công khai:
  // mã đơn được sinh tuần tự (JP240700, JP240701, ...) nên chỉ cần đếm lên là
  // đọc được họ tên, số điện thoại, địa chỉ nhận và toàn bộ giá trị đơn của mọi
  // khách hàng — không cần token, không để lại dấu vết gì.
  api.get('/orders/:id', requireAuth, (req, res) => {
    const state = read();
    const order = state.orders.find((item) => item.id === req.params.id || item.code === req.params.id);
    if (!order) return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    const ownerId = String(order.userId || order.customer?.id || '');
    if (ownerId !== String(req.user.id) && !ctx.roleAtLeast(req.user.role, 'staff')) {
      // 404 chứ không 403: trả 403 là xác nhận "mã đơn này có thật", đủ để dò
      // ra dải mã đang dùng dù không đọc được nội dung.
      return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    }
    const returnRequests = (state.returnRequests || [])
      .filter((item) => String(item.orderId) === String(order.id))
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
    res.json({
      ok: true,
      order,
      payment: findPayment(state, order.id) || null,
      returnRequest: findReturnRequest(state, order.id) || null,
      returnRequests,
    });
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
