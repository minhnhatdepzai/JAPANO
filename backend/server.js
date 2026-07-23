// Bootstrap: cấu hình, dịch vụ dùng chung (Stripe/Cloudinary/Mongo/store), di trú
// dữ liệu khi khởi động, và mount toàn bộ route theo domain (thư mục routes/).
// Từng domain (catalog, đơn hàng, thanh toán, thử đồ AI...) sống trong file
// riêng dưới routes/ — xem ở đó để sửa logic của domain tương ứng.
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.server') });

const { getDb, mongoEnabled, mongoHealth } = require('./lib/mongo');
const { emptyState, seededState } = require('./seed');
const { createStore } = require('./lib/store');
const {
  getHomeRecommendations,
  getRelatedProducts,
  getRecommendationDiagnostics,
  invalidateCache,
} = require('./lib/recommend');
const { buildAnalytics } = require('./lib/analytics');
const { composeOutfit, todaysOutfit, adviseSize, styleRecommendation } = require('./lib/outfit');
const chatbot = require('./lib/chatbot');
const { runPillow } = require('./lib/pillow');
const { analyzeProductImage, fallbackProductDescription, ensureVietnameseProductDescription } = require('./lib/productVision');
const { analyzePortrait } = require('./lib/portraitVision');
const { buildGoalPlan, enhanceCoaching } = require('./lib/goals');
const { runAccessoryPipeline, accessoryKind } = require('./lib/accessory');
const { moderateReview, DEFAULT_MODEL: REVIEW_MODERATION_MODEL } = require('./lib/reviewModeration');
const { VIP_CONFIG, vipStatus, vipDiscountForSelection, reconcileVipState } = require('./lib/vip');
const {
  ensureFlagcardState, awardFlagcardForOrder, reconcileFlagRewards, flagcardCollectionView,
  validateVoucher, getOrCreateCollection, ensureRewardVoucher,
} = require('./lib/flagcards');
const { httpError } = require('./lib/httpError');
const { stripe, stripeEnabled, STRIPE_PUBLISHABLE_KEY, STRIPE_MERCHANT_DISPLAY_NAME, STRIPE_WEBHOOK_SECRET } = require('./lib/stripeClient');
const { STRIPE_CURRENCY } = require('./lib/stripeMoney');
const { vnpayEnabled } = require('./lib/vnpaySign');
const { cloudinary, cloudinaryEnabled, cloudinaryHealth, uploadReviewMedia } = require('./lib/cloudinaryMedia');
const { FORCE_REPOSE } = require('./lib/tryonConfig');

const PORT = Number(process.env.PORT || 4100);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = process.env.JAPANO_DATA_FILE || path.join(DATA_DIR, 'db.json');
const MOTION_OUTPUT_DIR = path.join(DATA_DIR, 'motion');
const VIETNAM_UNITS_FILE = path.join(DATA_DIR, 'vietnam-administrative-units.json');
const TRYON_GPU_LOCK = process.env.JAPANO_TRYON_GPU_LOCK || '/tmp/japano-tryon-gpu.active';

function tryonGpuBusy() {
  try {
    const age = Date.now() - fs.statSync(TRYON_GPU_LOCK).mtimeMs;
    return age >= 0 && age < Number(process.env.JAPANO_TRYON_GPU_LOCK_MAX_AGE_MS || 30 * 60 * 1000);
  } catch { return false; }
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MOTION_OUTPUT_DIR)) fs.mkdirSync(MOTION_OUTPUT_DIR, { recursive: true });
const stateStore = createStore(DB_FILE);
const vietnamUnits = JSON.parse(fs.readFileSync(VIETNAM_UNITS_FILE, 'utf8'));
function read() { return reconcileVipState(stateStore.read()); }
function write(state) { const saved = stateStore.write(reconcileVipState(state)); invalidateCache(); return saved; }
function update(mutator) {
  const saved = stateStore.update((state) => {
    const result = mutator(state);
    return reconcileVipState(result && typeof result === 'object' ? result : state);
  });
  invalidateCache();
  return saved;
}

// Migration/idempotent reconciliation: old DB gains Flagcards and qualifying
// paid/completed orders receive at most one card even across restarts.
update((state) => {
  ensureFlagcardState(state);
  reconcileFlagRewards(state);
  reconcileVipState(state);
  state.payments ||= [];
  state.returnRequests ||= [];
  if (state.shop && state.shop.vnpay === undefined) state.shop.vnpay = true;
  const vietnameseProductNames = {
    'yukata-xanh': 'Yukata vải bông xanh đen',
    'cardigan-dai': 'Áo len khoác dáng dài',
    'blazer-kaki': 'Áo khoác kaki dáng dài',
    'ao-len-cardigan': 'Áo len khoác dệt kim',
    furina: 'Trang phục hóa thân Furina',
    'yae-miko': 'Trang phục hóa thân Yae Miko',
    yumeko: 'Trang phục hóa thân Yumeko Jabami',
    naruto: 'Trang phục hóa thân Naruto',
  };
  for (const order of state.orders || []) {
    if (!/stripe/i.test(String(order.payment?.method || ''))) continue;
    const existing = state.payments.find((item) => item.orderId === order.id || (order.payment?.txn && item.paymentIntentId === order.payment.txn));
    if (existing) continue;
    const transactionCode = String(order.payment?.txn || '');
    state.payments.push({
      id: `pay-migrated-${order.id}`,
      code: `PAY-${order.code || order.id}`,
      orderId: order.id,
      orderCode: order.code,
      userId: order.userId,
      provider: transactionCode.startsWith('pi_') && !transactionCode.startsWith('pi_seed_') ? 'stripe' : 'stripe-seed',
      method: 'Stripe',
      status: order.payment?.status || 'unpaid',
      amount: Number(order.total || 0),
      currency: STRIPE_CURRENCY,
      transactionCode,
      paymentIntentId: transactionCode.startsWith('pi_') ? transactionCode : '',
      checkoutSessionId: String(order.payment?.checkoutSessionId || ''),
      refundable: transactionCode.startsWith('pi_') && !transactionCode.startsWith('pi_seed_'),
      refunds: [],
      createdAt: Number(order.createdAt || Date.now()),
      updatedAt: Number(order.createdAt || Date.now()),
    });
  }
  // Ảnh *_tryon-* chỉ là reference nội bộ cho model, không phải ảnh gallery.
  // DB cũ có thể đã seed chúng vào trang chi tiết nên dọn idempotent khi chạy.
  for (const product of state.products || []) {
    if (vietnameseProductNames[product.slug]) product.name = vietnameseProductNames[product.slug];
    if (Array.isArray(product.images)) {
      product.images = product.images.filter((value) => !/_tryon-(?:flat|candidate)\.(?:jpe?g|png|webp)$/i.test(String(value)));
    }
    if (/_tryon-(?:flat|candidate)\.(?:jpe?g|png|webp)$/i.test(String(product.image || ''))) {
      product.image = product.images?.[0] || '';
    }
    product.videos = Array.isArray(product.videos) ? product.videos : [];
    const price = Math.max(0, Number(product.price || 0));
    const old = Math.max(0, Number(product.old || 0));
    product.price = price;
    product.old = old > price ? old : null;
    product.sale = null;
    product.discountPercent = product.old ? Math.round((1 - price / product.old) * 100) : 0;
  }
  for (const order of state.orders || []) {
    if (order.source) continue;
    const seeded = /^o\d{1,3}$/.test(String(order.id || '')) || /pi_seed_/i.test(String(order.payment?.txn || ''));
    order.source = seeded ? 'demo' : (order.userId || order.customer?.id ? 'mobile' : 'admin-test');
  }
  for (const interaction of state.interactions || []) {
    if (!interaction.source) interaction.source = /^i\d{1,3}$/.test(String(interaction.id || '')) ? 'demo' : 'mobile';
  }
  return state;
});

// ---------------------------------------------------------------------------
// Context dùng chung — mọi module dưới routes/ nhận đúng 1 bản ctx này (dependency
// injection qua tham số, không require ngược lại server.js để tránh phụ thuộc vòng).
// ---------------------------------------------------------------------------
const ctx = {
  read, write, update, invalidateCache, stateStore, httpError,
  cloudinary, cloudinaryEnabled, cloudinaryHealth, uploadReviewMedia,
  mongoEnabled, getDb, mongoHealth,
  stripe, stripeEnabled, vnpayEnabled,
  STRIPE_CURRENCY, STRIPE_PUBLISHABLE_KEY, STRIPE_MERCHANT_DISPLAY_NAME,
  PORT, MOTION_OUTPUT_DIR,
  VIP_CONFIG, vipStatus, vipDiscountForSelection,
  tryonGpuBusy, FORCE_REPOSE,
  seededState, emptyState,
  reconcileFlagRewards, ensureFlagcardState, flagcardCollectionView, getOrCreateCollection, ensureRewardVoucher, awardFlagcardForOrder, validateVoucher,
  buildAnalytics,
  vietnamUnits, getRelatedProducts, getRecommendationDiagnostics, analyzeProductImage, fallbackProductDescription, ensureVietnameseProductDescription,
  moderateReview, REVIEW_MODERATION_MODEL,
  getHomeRecommendations, runPillow, analyzePortrait, buildGoalPlan, enhanceCoaching,
  composeOutfit, todaysOutfit, adviseSize, styleRecommendation, chatbot,
  runAccessoryPipeline, accessoryKind,
};

const { makeStripeHelpers } = require('./routes/paymentsStripe');
const {
  finalizeStripeCheckout, finalizeStripePaymentIntent, markStripeCheckoutFailed,
  markStripePaymentIntentFailed, applyStripeRefundToState,
} = makeStripeHelpers(ctx);

const app = express();
app.use(cors());
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripeEnabled() || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, message: 'Stripe webhook chưa được cấu hình.' });
  }
  try {
    const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      await finalizeStripeCheckout(event.data.object.id);
    }
    if (event.type === 'payment_intent.succeeded') {
      await finalizeStripePaymentIntent(event.data.object.id);
    }
    if (event.type === 'checkout.session.async_payment_failed') {
      markStripeCheckoutFailed(event.data.object.id, 'async_payment_failed');
    }
    if (event.type === 'payment_intent.payment_failed') {
      markStripePaymentIntentFailed(event.data.object.id, event.data.object.last_payment_error?.code || 'payment_failed');
    }
    if (['refund.updated', 'refund.failed'].includes(event.type)) {
      applyStripeRefundToState(event.data.object);
    }
    if (event.type === 'charge.refunded') {
      for (const refund of event.data.object?.refunds?.data || []) applyStripeRefundToState(refund);
    }
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message || 'Webhook Stripe không hợp lệ.' });
  }
});
app.use(express.json({ limit: '120mb' }));

const PRODUCT_ASSETS_DIR = path.join(__dirname, '..', 'mobile', 'assets', 'products');
app.use('/assets/products', express.static(PRODUCT_ASSETS_DIR, { maxAge: '1h' }));

const api = express.Router();

// Mount từng domain — thứ tự không quan trọng vì các path không giao nhau,
// trừ /orders/:id (GET ở orders.js, PATCH ở returns.js — khác method nên vẫn ổn).
require('./routes/health')(api, ctx);
require('./routes/catalog')(api, ctx);
require('./routes/reviews')(api, ctx);
require('./routes/japanSpots')(api, ctx);
require('./routes/customerData')(api, ctx);
require('./routes/addresses')(api, ctx);
require('./routes/loyalty')(api, ctx);
require('./routes/stylist')(api, ctx);
require('./routes/tryon')(api, ctx);
require('./routes/orders')(api, ctx);
require('./routes/paymentsStripe')(api, ctx);
require('./routes/paymentsVnpay')(api, ctx);
require('./routes/payments')(api, ctx);
require('./routes/returns')(api, ctx);

app.use('/api', api);

// Cùng một nguồn ảnh cho ứng dụng và trang quản trị. Các đường dẫn sản phẩm
// dạng /assets/products/... trong cơ sở dữ liệu phải trả ảnh thật, không dùng ô
// màu thay thế khiến người bán hiểu nhầm là thiếu dữ liệu.
const MOBILE_ASSETS_DIR = path.join(__dirname, '..', 'mobile', 'assets');
app.use('/assets', express.static(MOBILE_ASSETS_DIR, { maxAge: '1h', etag: true }));

// phục vụ trang admin tĩnh
const ADMIN_DIR = path.join(__dirname, '..', 'admin');
app.use('/admin', express.static(ADMIN_DIR));
app.get('/', (req, res) => res.sendFile(path.join(ADMIN_DIR, 'index.html')));

const server = app.listen(PORT, () => {
  console.log('\n  JAPANO backend đang chạy');
  console.log('  ─────────────────────────────');
  console.log('  API      : http://localhost:' + PORT + '/api');
  console.log('  Admin    : http://localhost:' + PORT + '/  (hoặc /admin)');
  console.log('  Dữ liệu  : ' + DB_FILE);
  console.log('  Mobile   : đặt API_BASE = http://<IP-máy>:' + PORT + ' (Android emulator: http://10.0.2.2:' + PORT + ')\n');
});

// Điện thoại có thể đóng request khi người dùng rời màn hình trong lúc server
// đang trả ảnh base64 lớn. Đây là ngắt kết nối phía client, không phải lỗi làm
// hỏng backend; bắt EPIPE trên từng socket để server tiếp tục phục vụ lượt sau.
server.on('connection', (socket) => {
  socket.on('error', (error) => {
    if (error?.code !== 'EPIPE' && error?.code !== 'ECONNRESET') {
      console.error('HTTP socket error:', error);
    }
  });
});
