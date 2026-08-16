#!/usr/bin/env node
// Sinh dữ liệu mẫu để mọi bảng trong Compass đều có gì đó để nhìn.
//
//   node backend/scripts/seedDemoData.js          # thêm dữ liệu mẫu
//   node backend/scripts/seedDemoData.js --clean  # xoá sạch dữ liệu mẫu đã thêm
//
// Ba nguyên tắc, vì dữ liệu này ghi vào chính cơ sở dữ liệu đang chạy:
//
// 1. TÔN TRỌNG MỌI BẤT BIẾN. Đơn phải thoả total = hàng − giảm + ship, thanh
//    toán phải bằng tổng đơn, dòng hàng phải trỏ tới biến thể CÓ THẬT, tồn kho
//    phải trừ đúng. Sinh bừa thì bài kiểm tra auditMongoData.js sẽ đỏ rực ngay
//    sau đó, và dữ liệu mẫu trở thành thứ phải đi dọn.
//
// 2. GẮN DẤU ĐỂ GỠ ĐƯỢC. Mỗi document đều mang `demoBatch`. Không có dấu này
//    thì vài tuần sau không ai phân biệt nổi đâu là đơn thật đâu là đơn mẫu, và
//    báo cáo doanh thu sẽ tính cả tiền không tồn tại.
//
// 3. KHÔNG BỊA BẢNG DẪN XUẤT. `vip_memberships` và `flagcard_collections` do
//    máy chủ TỰ TÍNH lại từ đơn hàng (deriveVipMemberships / reconcileFlagRewards)
//    — chèn tay là lần reconcile kế tiếp xoá sạch. Muốn có VIP thì phải tạo đơn
//    đủ điều kiện rồi để hệ thống tự cấp, đúng như với khách thật.
require('../instrument');
const { getDb, mongoEnabled } = require('../lib/mongo');
const { loadStateFromCollections, persistStateToCollections } = require('../lib/mongoCollections');
const { reconcileVipState } = require('../lib/vip');
const { ensureFlagcardState, reconcileFlagRewards } = require('../lib/flagcards');

const BATCH = 'demo-2026-08';
const G = '\x1b[32m'; const Y = '\x1b[33m'; const D = '\x1b[2m'; const O = '\x1b[0m';
const DAY = 86400000;

// Nguồn ngẫu nhiên có hạt giống cố định: chạy lại cho ra cùng một bộ dữ liệu,
// nên khác biệt giữa hai lần chạy luôn là do code chứ không do may rủi.
let seed = 20260813;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (min, max) => min + Math.floor(rnd() * (max - min + 1));

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý'];
const DEM = ['Thị', 'Văn', 'Minh', 'Thu', 'Quang', 'Hải', 'Ngọc', 'Anh'];
const TEN = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Khanh', 'Linh', 'Mai', 'Nam', 'Oanh', 'Phúc', 'Quyên', 'Sơn', 'Trang', 'Uyên', 'Vy'];
const TINH = [
  { code: '79', name: 'Thành phố Hồ Chí Minh', ward: 'Phường Bến Nghé', wardCode: '26734' },
  { code: '01', name: 'Thành phố Hà Nội', ward: 'Phường Hàng Bạc', wardCode: '00073' },
  { code: '48', name: 'Thành phố Đà Nẵng', ward: 'Phường Hải Châu I', wardCode: '20194' },
  { code: '92', name: 'Thành phố Cần Thơ', ward: 'Phường Tân An', wardCode: '31150' },
  { code: '56', name: 'Tỉnh Khánh Hòa', ward: 'Phường Lộc Thọ', wardCode: '22369' },
];
const DUONG = ['Lê Lợi', 'Nguyễn Huệ', 'Trần Hưng Đạo', 'Hai Bà Trưng', 'Pasteur', 'Lý Tự Trọng', 'Nam Kỳ Khởi Nghĩa'];

const khongDau = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

async function clean(db) {
  const cols = (await db.listCollections().toArray()).map((c) => c.name);
  let total = 0;
  for (const name of cols) {
    const { deletedCount } = await db.collection(name).deleteMany({ demoBatch: BATCH });
    if (deletedCount) { total += deletedCount; console.log(`  ${name.padEnd(24)} −${deletedCount}`); }
  }
  console.log(`\n${G}Đã gỡ ${total} document mẫu.${O} Chạy lại backend để nạp trạng thái mới.`);
}

async function main() {
  if (!mongoEnabled()) { console.error('MONGODB_URI chưa cấu hình.'); process.exit(1); }
  const db = await getDb();

  if (process.argv.includes('--clean')) { await clean(db); process.exit(0); }

  const state = await loadStateFromCollections(db);
  const now = Date.now();
  ensureFlagcardState(state);

  // Chỉ đặt hàng những biến thể CÓ THẬT và còn hàng — đây là điều kiện để dữ
  // liệu mẫu không tạo ra tồn kho âm hay dòng hàng mồ côi.
  const sellable = (state.products || [])
    .filter((p) => ['published', 'active'].includes(String(p.status)))
    .map((p) => ({ p, variants: (p.variants || []).filter((v) => Number(v.stock) > 3) }))
    .filter((row) => row.variants.length);
  if (sellable.length < 5) { console.error('Không đủ sản phẩm còn hàng để sinh đơn.'); process.exit(1); }

  const made = {};
  const bump = (key, n = 1) => { made[key] = (made[key] || 0) + n; };
  const tag = (row) => ({ ...row, demoBatch: BATCH });

  // ---- Người dùng ----------------------------------------------------------
  const users = [];
  for (let i = 0; i < 10; i += 1) {
    const name = `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`;
    const id = `u-demo-${now}-${i}`;
    const user = tag({
      id, name,
      email: `${khongDau(name)}.${i}@demo.japano.vn`,
      role: 'customer', status: 'active',
      // Không có passwordHash: đây là tài khoản để NHÌN, không phải để đăng nhập.
      // Bịa một hash giả sẽ tạo ra tài khoản đăng nhập được bằng mật khẩu không ai biết.
      joinedAt: now - between(20, 300) * DAY,
      orders: 0, spent: 0, tryons: between(0, 6), vip: 'Thành viên',
    });
    users.push(user); state.users.push(user); bump('users');
  }

  // ---- Sổ địa chỉ ----------------------------------------------------------
  state.addresses ||= [];
  users.slice(0, 6).forEach((user, i) => {
    const tinh = pick(TINH);
    state.addresses.push(tag({
      id: `addr-demo-${now}-${i}`, userId: user.id,
      title: i % 2 ? 'Công ty' : 'Nhà riêng',
      name: user.name, phone: `09${between(10000000, 99999999)}`,
      street: `${between(1, 250)} ${pick(DUONG)}`,
      wardCode: tinh.wardCode, ward: tinh.ward,
      provinceCode: tinh.code, province: tinh.name,
      isDefault: true, createdAt: user.joinedAt, updatedAt: user.joinedAt,
    }));
    bump('addresses');
  });

  // ---- Hồ sơ phong cách ----------------------------------------------------
  state.profiles ||= [];
  users.slice(0, 5).forEach((user) => {
    state.profiles.push(tag({
      userId: user.id, gender: pick(['Nữ', 'Nam']),
      preferredStyles: [pick(['tối giản', 'lễ hội', 'cổ điển', 'đường phố']), pick(['thanh lịch', 'thoải mái'])],
      skinTone: pick(['Sáng', 'Trung bình', 'Ngăm']), occasion: pick(['Đi chơi', 'Đi làm', 'Lễ hội']),
      budget: between(4, 20) * 100000,
      heightCm: between(150, 182), weightKg: between(45, 78),
      usualSize: pick(['S', 'M', 'L', 'XL']), updatedAt: now - between(1, 60) * DAY,
    }));
    bump('profiles');
  });

  // ---- Đơn hàng, dòng hàng, thanh toán -------------------------------------
  const nextCode = (() => {
    let highest = 240700;
    for (const order of state.orders || []) {
      const m = /^JP(\d+)$/.exec(String(order.code || ''));
      if (m) highest = Math.max(highest, Number(m[1]));
    }
    return () => `JP${++highest}`;
  })();

  const ship = Number(state.shop?.shipFee) || 30000;
  // Phân bổ trạng thái để bảng đơn trông như một cửa hàng đang chạy thật, không
  // phải 30 đơn cùng một trạng thái.
  const PLAN = [
    ...Array(9).fill('completed'), ...Array(5).fill('shipping'), ...Array(4).fill('confirmed'),
    ...Array(3).fill('delivered'), ...Array(3).fill('pending'), ...Array(3).fill('cancelled'),
    ...Array(2).fill('returned'), ...Array(2).fill('pending_payment'),
  ];
  const madeOrders = [];

  PLAN.forEach((status, index) => {
    const user = pick(users);
    const createdAt = now - between(2, 110) * DAY;
    // Vài đơn cố tình lớn để khách chạm ngưỡng VIP và ngưỡng nhận thẻ địa danh
    // — hai bảng đó do máy chủ tự tính, không chèn tay được.
    const big = index % 7 === 0;
    const lines = [];
    for (let k = 0, n = big ? between(2, 3) : between(1, 2); k < n; k += 1) {
      const { p, variants } = pick(sellable);
      if (lines.some((line) => line.slug === p.slug)) continue;
      const variant = pick(variants);
      const qty = big ? between(1, 3) : 1;
      if (Number(variant.stock) < qty) continue;
      lines.push({
        productId: p.slug, slug: p.slug, name: p.name,
        colorName: variant.colorName, colorHex: variant.colorHex || p.colorHex || '#1A1410',
        size: variant.size, qty,
        price: Number(variant.price) > 0 ? Number(variant.price) : Number(p.price) || 0,
      });
      variant.stock = Math.max(0, Number(variant.stock) - qty);
    }
    if (!lines.length) return;

    const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
    const method = pick(['COD', 'Stripe', 'VNPay']);
    const provider = method === 'COD' ? 'cod' : method.toLowerCase();
    // Ưu đãi theo cổng thanh toán, đúng như routes/orders.js áp cho đơn thật.
    const paymentDiscount = provider === 'stripe' ? Math.round(subtotal * 0.1)
      : provider === 'vnpay' ? Math.round(subtotal * 0.05) : 0;
    const discount = paymentDiscount;
    const total = Math.max(0, subtotal - discount + ship);
    const paid = ['completed', 'delivered', 'returned'].includes(status)
      || (provider !== 'cod' && ['shipping', 'confirmed'].includes(status));
    const orderId = `o-demo-${now}-${index}`;
    const code = nextCode();
    const tinh = pick(TINH);

    const order = tag({
      id: orderId, code, userId: user.id,
      customer: { id: user.id, name: user.name, phone: `09${between(10000000, 99999999)}`, email: user.email },
      address: `${between(1, 250)} ${pick(DUONG)}, ${tinh.ward}, ${tinh.name}`,
      addressDetails: { street: `${between(1, 250)} ${pick(DUONG)}`, wardCode: tinh.wardCode, ward: tinh.ward, provinceCode: tinh.code, province: tinh.name },
      items: lines, subtotal, discount, voucherDiscount: 0, paymentDiscount, vipDiscount: 0,
      vipPromotion: null,
      paymentPromotion: paymentDiscount ? { code: provider === 'stripe' ? 'STRIPE10' : 'VNPAY5', label: 'Ưu đãi thanh toán', percent: provider === 'stripe' ? 10 : 5 } : null,
      discountCode: paymentDiscount ? (provider === 'stripe' ? 'STRIPE10' : 'VNPAY5') : '',
      ship, total,
      payment: { method, provider, status: paid ? 'paid' : (status === 'cancelled' ? 'cancelled' : 'unpaid'), txn: paid ? `demo_${orderId}` : '—', currency: provider === 'vnpay' ? 'VND' : 'vnd' },
      status, createdAt,
      history: [{ s: 'pending', at: createdAt }, { s: status, at: createdAt + DAY }],
      source: 'demo',
      ...(status === 'completed' || status === 'returned' ? { completedAt: createdAt + 3 * DAY } : {}),
      ...(status === 'delivered' ? { deliveredAt: createdAt + 2 * DAY } : {}),
    });
    // Đơn huỷ/trả PHẢI đánh dấu đã hoàn kho, nếu không bài kiểm tra tồn kho sẽ
    // báo đây là hàng bị mất — mà thực ra ở trên đã cộng trả lại rồi.
    if (['cancelled', 'returned'].includes(status)) {
      lines.forEach((line) => {
        const product = state.products.find((p) => p.slug === line.slug);
        const variant = (product?.variants || []).find((v) => v.colorName === line.colorName && v.size === line.size);
        if (variant) variant.stock = Number(variant.stock) + line.qty;
      });
      order.stockRestoredAt = createdAt + 2 * DAY;
      order.stockRestoredReason = 'demo-seed';
    }
    state.orders.push(order); madeOrders.push(order); bump('orders'); bump('order_items', lines.length);

    state.payments.push(tag({
      id: `pay-demo-${now}-${index}`, code: `PAY-${code}`,
      orderId, orderCode: code, userId: user.id,
      provider: provider === 'cod' ? 'cod' : provider, method,
      status: paid ? 'paid' : (status === 'cancelled' ? 'cancelled' : 'unpaid'),
      amount: total, currency: provider === 'vnpay' ? 'VND' : 'vnd',
      transactionCode: paid ? `demo_${orderId}` : '',
      refundable: false, refunds: [],
      createdAt, updatedAt: createdAt, ...(paid ? { paidAt: createdAt + 3600000 } : {}),
    }));
    bump('payments');

    user.orders = (user.orders || 0) + 1;
    if (paid) user.spent = (user.spent || 0) + total;
  });

  // ---- Yêu cầu trả hàng ----------------------------------------------------
  state.returnRequests ||= [];
  madeOrders.filter((o) => o.status === 'returned').forEach((order, i) => {
    const at = (order.completedAt || order.createdAt) + DAY;
    state.returnRequests.push(tag({
      id: `ret-demo-${now}-${i}`, kind: 'return',
      code: `RTN-${order.code}-${String(now).slice(-5)}`,
      orderId: order.id, orderCode: order.code, userId: order.userId,
      paymentId: '', paymentCode: '', status: 'refunded',
      reason: pick(['Sản phẩm không đúng mô tả', 'Không vừa kích thước', 'Sản phẩm bị lỗi/hư hỏng']),
      note: 'Dữ liệu mẫu — sản phẩm còn nguyên tem mác.',
      photos: [], codManualRefund: order.payment.method === 'COD',
      items: order.items.map((line) => ({ ...line })),
      coversWholeOrder: true, amount: order.total, currency: 'vnd',
      createdAt: at, updatedAt: at + DAY,
      stockRestoredAt: at + DAY,
      timeline: [
        { s: 'requested', at }, { s: 'approved', at: at + 3600000 },
        { s: 'received', at: at + DAY }, { s: 'refunded', at: at + DAY + 3600000 },
      ],
    }));
    bump('return_requests');
  });

  // ---- Đánh giá + phản hồi hữu ích ----------------------------------------
  const NHAN_XET = [
    'Vải mềm, form chuẩn, mặc lên rất tôn dáng. Giao hàng nhanh hơn dự kiến.',
    'Màu nhuộm đẹp đúng như ảnh, đường may chắc chắn. Sẽ ủng hộ tiếp shop.',
    'Chất liệu thoáng, mặc mùa hè rất dễ chịu. Size M vừa với 1m65 52kg.',
    'Đóng gói cẩn thận, có kèm thiệp cảm ơn. Sản phẩm đúng mô tả.',
    'Hoa văn tinh tế, nhìn ngoài đẹp hơn ảnh. Giá này là hợp lý.',
    'Giao đúng hẹn, tư vấn size nhiệt tình. Áo lên dáng đẹp.',
  ];
  const reviewed = new Set();
  const madeReviews = [];
  madeOrders.filter((o) => o.status === 'completed').slice(0, 12).forEach((order, i) => {
    const line = order.items[0];
    const key = `${order.userId}|${line.slug}`;
    if (reviewed.has(key)) return;
    reviewed.add(key);
    const at = (order.completedAt || order.createdAt) + 2 * DAY;
    const review = tag({
      id: `review-demo-${now}-${i}`, productId: line.slug,
      userId: order.userId, userName: order.customer.name,
      orderId: order.id, orderCode: order.code,
      rating: between(4, 5), comment: pick(NHAN_XET), media: null,
      status: 'approved',
      moderation: { decision: 'approved', score: 0, engine: 'demo-seed', reason: 'dữ liệu mẫu' },
      createdAt: at, updatedAt: at,
    });
    state.reviews.push(review); madeReviews.push(review); bump('reviews');
  });
  state.reviewReactions ||= [];
  madeReviews.slice(0, 8).forEach((review, i) => {
    users.slice(0, 3).forEach((user, k) => {
      state.reviewReactions.push(tag({
        id: `reaction-demo-${now}-${i}-${k}`, reviewId: review.id, userId: user.id,
        value: rnd() > 0.25 ? 'helpful' : 'not_helpful', updatedAt: review.createdAt + DAY,
      }));
      bump('review_reactions');
    });
  });

  // ---- Hành vi -------------------------------------------------------------
  const TYPES = ['view', 'view', 'view', 'cart', 'wish', 'tryon', 'purchase'];
  for (let i = 0; i < 150; i += 1) {
    const { p } = pick(sellable);
    state.interactions.push(tag({
      id: `i-demo-${now}-${i}`, userId: pick(users).id, productId: p.slug,
      type: pick(TYPES), value: between(1, 8),
      createdAt: now - between(1, 90) * DAY, source: 'demo',
    }));
    bump('interactions');
  }

  state.searchLogs ||= [];
  ['kimono', 'haori', 'yukata mùa hè', 'quạt giấy', 'guốc geta', 'hakama', 'obi lụa', 'áo khoác'].forEach((query, i) => {
    state.searchLogs.push(tag({
      id: `sl-demo-${now}-${i}`, userId: pick(users).id, query,
      resultCount: between(0, 12), createdAt: now - between(1, 30) * DAY,
    }));
    bump('search_logs');
  });

  state.chats ||= [];
  [
    ['user', 'Shop có kimono size L màu đen không ạ?'],
    ['bot', 'Dạ có ạ. Kimono truyền thống màu Sumi còn size L, giá 1.890.000₫. Chị muốn em gợi ý thêm obi phối cùng không ạ?'],
    ['user', 'Haori mặc mùa nào thì hợp?'],
    ['bot', 'Haori là áo khoác ngoài nên hợp nhất vào thu và đông ạ. Mùa hè thì chị cân nhắc Jinbei hoặc Yukata cho thoáng hơn.'],
    ['user', 'Đơn của tôi bao giờ giao?'],
    ['bot', 'Dạ đơn của anh đang ở bước bàn giao vận chuyển, dự kiến 2–3 ngày làm việc ạ.'],
  ].forEach(([role, message], i) => {
    state.chats.push(tag({
      id: `chat-demo-${now}-${i}`, userId: users[i % users.length].id, role, message,
      createdAt: now - (6 - i) * 3600000,
      ...(role === 'bot' ? { engine: 'demo-seed', intent: 'lookup', confidence: 0.9, latencyMs: between(120, 800) } : {}),
    }));
    bump('chats');
  });

  state.tryonHistory ||= [];
  for (let i = 0; i < 10; i += 1) {
    const { p } = pick(sellable);
    state.tryonHistory.push(tag({
      id: `tryon-demo-${now}-${i}`, userId: pick(users).id, productId: p.slug,
      productIds: [p.slug], accessoryIds: [],
      engine: 'fashn-vton-1.5+demo-seed', createdAt: now - between(1, 40) * DAY,
    }));
    bump('tryon_history');
  }

  // ---- Giỏ hàng và yêu thích ----------------------------------------------
  state.carts ||= [];
  users.slice(0, 4).forEach((user) => {
    const { p, variants } = pick(sellable);
    const variant = pick(variants);
    state.carts.push(tag({
      userId: user.id, productId: p.slug,
      color: variant.colorName, size: variant.size,
      quantity: between(1, 3), updatedAt: now - between(1, 5) * DAY,
    }));
    bump('cart_items');
  });
  state.wishlists ||= [];
  users.slice(0, 8).forEach((user, i) => {
    const { p } = pick(sellable);
    state.wishlists.push(tag({
      id: `wish-demo-${now}-${i}`, userId: user.id, productId: p.slug,
      createdAt: now - between(1, 45) * DAY,
    }));
    bump('wishlist_items');
  });

  // ---- Mục tiêu tiết kiệm --------------------------------------------------
  state.goals ||= [];
  users.slice(0, 3).forEach((user, i) => {
    const { p } = pick(sellable);
    const target = Number(p.price) || 900000;
    const saved = Math.round(target * (0.2 + rnd() * 0.6));
    state.goals.push(tag({
      id: `goal-demo-${now}-${i}`, userId: user.id, productId: p.slug,
      product: { slug: p.slug, name: p.name, price: target, image: (p.images || [])[0] || '' },
      input: { age: between(20, 38), heightCm: between(152, 180), currentWeightKg: between(46, 76), targetWeightKg: between(45, 70) },
      plan: { saving: { perWeek: Math.round(target / 12) }, wellness: {}, coaching: {}, methodology: 'demo-seed' },
      fund: { target, saved, rewardPercent: 30, deposits: [{ id: `dep-demo-${i}`, amount: saved, note: 'Dữ liệu mẫu', at: now - 10 * DAY }] },
      createdAt: now - between(10, 60) * DAY, updatedAt: now - DAY,
    }));
    bump('goals');
  });

  // ---- Thông báo -----------------------------------------------------------
  madeOrders.slice(0, 8).forEach((order, i) => {
    state.notifications.push(tag({
      id: `notif-demo-${now}-${i}`, userId: order.userId,
      title: `Đơn hàng #${order.code}`,
      body: `Đơn ${Number(order.total).toLocaleString('vi-VN')}đ của bạn đang ở bước "${order.status}".`,
      type: 'Đơn hàng', action: `order:${order.id}`, reach: 1, at: order.createdAt + DAY,
    }));
    bump('notifications');
  });
  ['Bộ sưu tập Haori mùa thu đã lên kệ', 'Miễn phí vận chuyển cho đơn từ 500.000₫', 'Thẻ địa danh Kyoto vừa được mở'].forEach((title, i) => {
    state.notifications.push(tag({
      id: `notif-demo-all-${now}-${i}`, userId: null, title,
      body: 'Thông báo mẫu gửi chung cho toàn bộ khách hàng.',
      type: 'Khuyến mãi', reach: 0, at: now - i * DAY,
    }));
    bump('notifications');
  });

  // ---- Khám phá Nhật Bản ---------------------------------------------------
  state.japanSpotReviews ||= [];
  [
    ['Chùa Kiyomizu-dera', 'Kyoto', 5, 'Đi sáng sớm thì vắng, ảnh đẹp mà không phải chờ.'],
    ['Kênh Otaru', 'Hokkaido', 4, 'Buổi tối đèn lồng dọc kênh rất đẹp, nên đi mùa đông.'],
    ['Núi Phú Sĩ', 'Shizuoka', 5, 'Trời quang mới thấy rõ đỉnh, nên xem dự báo trước khi đi.'],
  ].forEach(([place, prefecture, rating, comment], i) => {
    state.japanSpotReviews.push(tag({
      id: `jspot-review-demo-${now}-${i}`, place, prefecture,
      userId: users[i].id, userName: users[i].name,
      rating, comment, media: null, status: 'approved',
      moderation: { decision: 'approved', score: 0, engine: 'demo-seed', reason: 'dữ liệu mẫu' },
      createdAt: now - between(1, 30) * DAY,
    }));
    bump('japan_spot_reviews');
  });
  state.japanSpotSuggestions ||= [];
  [
    ['Kyoto', 'Đường Philosopher', 'Con đường ven kênh, mùa hoa anh đào đẹp nhất Kyoto.'],
    ['Hokkaido', 'Làng Biei', 'Đồi hoa nhiều màu vào tháng 7, thuê xe đạp đi rất hợp.'],
    ['Osaka', 'Chợ Kuromon', 'Chợ hải sản trong nhà, nên đi buổi trưa để ăn thử tại chỗ.'],
    ['Nara', 'Công viên Nara', 'Hươu dạn người, mua bánh senbei ngay cổng để cho ăn.'],
  ].forEach(([prefecture, place, suggestion], i) => {
    state.japanSpotSuggestions.push(tag({
      id: `jspot-suggestion-demo-${now}-${i}`, prefecture, place, suggestion,
      userId: users[i].id, userName: users[i].name,
      status: i === 0 ? 'approved' : 'pending', createdAt: now - between(1, 20) * DAY,
    }));
    bump('japan_spot_suggestions');
  });

  // ---- Token đẩy thông báo -------------------------------------------------
  // Ghi chú: app thật chưa lấy được token vì thiếu EAS projectId. Đây là dữ liệu
  // để bảng không trống, KHÔNG phải token gửi được thật.
  state.pushTokens ||= [];
  users.slice(0, 3).forEach((user, i) => {
    state.pushTokens.push(tag({
      userId: user.id, token: `ExponentPushToken[demo-${now}-${i}]`,
      platform: i % 2 ? 'ios' : 'android', createdAt: now - between(1, 30) * DAY,
    }));
    bump('push_tokens');
  });

  // ---- Quy đổi voucher -----------------------------------------------------
  // Tăng `used` đúng bằng số lần thật sự quy đổi ở đây — không cộng bừa, vì cột
  // này chính là thứ chặn khách khi chạm hạn mức.
  state.voucherRedemptions ||= [];
  const freeship = (state.vouchers || []).find((v) => v.code === 'FREESHIP');
  if (freeship) {
    madeOrders.slice(0, 3).forEach((order, i) => {
      state.voucherRedemptions.push(tag({
        id: `redeem-demo-${now}-${i}`, code: freeship.code, voucherId: freeship.id || `voucher-${freeship.code}`,
        userId: order.userId, orderId: order.id,
        discount: 30000, redeemedAt: order.createdAt,
      }));
      freeship.used = (Number(freeship.used) || 0) + 1;
      bump('voucher_redemptions');
    });
  }

  // ---- Luật giảm giá -------------------------------------------------------
  // KHÔNG dùng scope 'vip': lib/vip.js lấy rule vip ĐẦU TIÊN nó tìm thấy, thêm
  // một rule vip nữa là có thể đổi mức giảm của toàn bộ khách VIP.
  state.discountRules ||= [];
  [
    { id: 'discount-demo-newcomer', code: 'CHAOMUNG', name: 'Khách mới giảm 5%', scope: 'newcomer', type: 'percent', value: 5, active: false },
    { id: 'discount-demo-autumn', code: 'THUVANG', name: 'Ưu đãi mùa thu 8%', scope: 'seasonal', type: 'percent', value: 8, active: false },
  ].forEach((rule) => { state.discountRules.push(tag(rule)); bump('discount_rules'); });

  // ---- Mẫu kiểm duyệt ------------------------------------------------------
  state.moderationSamples ||= [];
  ['hang nay te qua di mat', 'shop lua dao'].forEach((text, i) => {
    state.moderationSamples.push(tag({
      id: `sample-demo-${now}-${i}`, reviewId: null, label: 'rejected',
      normalizedText: text, learnedPhrases: [text.split(' ')[0]],
      source: 'demo-seed', updatedAt: now - i * DAY,
    }));
    bump('moderation_samples');
  });

  // ---- Để máy chủ tự tính hai bảng dẫn xuất --------------------------------
  reconcileVipState(state);
  const reconciled = reconcileFlagRewards(state);
  console.log(`${D}  reconcile: ${(state.vipMemberships || []).length} VIP · ${(state.flagcardCollections || []).length} bộ thẻ · ${reconciled.awards?.length || 0} thẻ vừa trao${O}`);

  await persistStateToCollections(db, state);

  console.log(`\n${G}Đã thêm dữ liệu mẫu (dấu demoBatch="${BATCH}")${O}`);
  Object.entries(made).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} +${v}`));
  console.log(`\n${Y}Chạy lại backend${O} để nạp trạng thái mới, rồi mở Compass.`);
  console.log(`${D}Gỡ sạch: node backend/scripts/seedDemoData.js --clean${O}`);
  process.exit(0);
}

main().catch((error) => { console.error('✗', error.stack || error.message); process.exit(1); });
