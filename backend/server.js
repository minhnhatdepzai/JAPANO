// Bootstrap: cấu hình, dịch vụ dùng chung (Stripe/Cloudinary/Mongo/store), di trú
// dữ liệu khi khởi động, và mount toàn bộ route theo domain (thư mục routes/).
// Từng domain (catalog, đơn hàng, thanh toán, thử đồ AI...) sống trong file
// riêng dưới routes/ — xem ở đó để sửa logic của domain tương ứng.
require('./instrument'); // Sentry + dotenv — phải require trước mọi thứ khác
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const { logger, captureError, sentryEnabled } = require('./lib/logger');

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
const { GOAL_FUND_CONFIG, reconcileGoalRewards } = require('./lib/goalFund');
const { SPOT_REWARD_CONFIG } = require('./lib/communityRewards');
const { FULFILLMENT_POLICY, autoCompleteDeliveredOrders } = require('./lib/fulfillmentPolicy');
const { httpError } = require('./lib/httpError');
const { stripe, stripeEnabled, STRIPE_PUBLISHABLE_KEY, STRIPE_MERCHANT_DISPLAY_NAME, STRIPE_WEBHOOK_SECRET } = require('./lib/stripeClient');
const { STRIPE_CURRENCY } = require('./lib/stripeMoney');
const { vnpayEnabled } = require('./lib/vnpaySign');
const { cloudinary, cloudinaryEnabled, cloudinaryHealth, uploadReviewMedia, uploadReturnPhotos } = require('./lib/cloudinaryMedia');
const { FORCE_REPOSE } = require('./lib/tryonConfig');
const { requireAuth, optionalAuth, requireAdmin, requireSuperAdmin, requireStaff, requireSelfOrStaff, roleAtLeast, ensureAdminSeeded } = require('./lib/auth');
const { makeSendPushToUser, makeSendPushToAll } = require('./lib/push');
const { makeMailNotifier } = require('./lib/emails');
const { pushNotification } = require('./lib/notify');

const PORT = Number(process.env.PORT || 4100);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = process.env.JAPANO_DATA_FILE || path.join(DATA_DIR, 'db.json');
const MOTION_OUTPUT_DIR = path.join(DATA_DIR, 'motion');
const VIETNAM_UNITS_FILE = path.join(DATA_DIR, 'vietnam-administrative-units.json');
const TRYON_GPU_LOCK = process.env.JAPANO_TRYON_GPU_LOCK || '/tmp/japano-tryon-gpu.active';

function tryonGpuBusy() {
  try {
    const age = Date.now() - fs.statSync(TRYON_GPU_LOCK).mtimeMs;
    if (age < 0 || age >= Number(process.env.JAPANO_TRYON_GPU_LOCK_MAX_AGE_MS || 30 * 60 * 1000)) return false;
    // Khoá ghi PID của tiến trình thử đồ. Nếu tiến trình đó đã chết (máy sập,
    // bị kill, restart service) mà khoá còn nằm lại thì chatbot/vision sẽ bị
    // chặn oan tới 30 phút — kiểm tra PID còn sống thật hay không, và dọn khoá
    // mồ côi ngay để GPU được dùng lại bình thường.
    const pid = Number(String(fs.readFileSync(TRYON_GPU_LOCK, 'utf8')).trim());
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0); // chỉ kiểm tra tồn tại, không gửi tín hiệu thật
      } catch (error) {
        if (error.code === 'ESRCH') {
          fs.unlinkSync(TRYON_GPU_LOCK);
          logger.warn({ pid }, 'Dọn khoá GPU mồ côi: tiến trình thử đồ đã không còn chạy');
          return false;
        }
      }
    }
    return true;
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
// paid/completed orders receive at most one card even across restarts. Chạy
// bên trong boot() phía dưới (sau khi đã hydrate MongoDB nếu có), không chạy
// ngay ở đây nữa.
function runMigration(state) {
  ensureFlagcardState(state);
  reconcileFlagRewards(state);
  reconcileVipState(state);
  autoCompleteDeliveredOrders(state, Date.now());
  reconcileGoalRewards(state, Date.now(), pushNotification);
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
  ensureAdminSeeded(state);
  return state;
}

// ---------------------------------------------------------------------------
// Context dùng chung — mọi module dưới routes/ nhận đúng 1 bản ctx này (dependency
// injection qua tham số, không require ngược lại server.js để tránh phụ thuộc vòng).
// ---------------------------------------------------------------------------
const ctx = {
  read, write, update, invalidateCache, stateStore, httpError,
  cloudinary, cloudinaryEnabled, cloudinaryHealth, uploadReviewMedia, uploadReturnPhotos,
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
  requireAuth, optionalAuth, requireAdmin, requireSuperAdmin, requireStaff, requireSelfOrStaff, roleAtLeast,
  pushNotification,
  GOAL_FUND_CONFIG, reconcileGoalRewards, SPOT_REWARD_CONFIG, FULFILLMENT_POLICY,
};
ctx.sendPushToUser = makeSendPushToUser(ctx);
ctx.sendPushToAll = makeSendPushToAll(ctx);
// Email giao dịch (cảnh báo đăng nhập, biên nhận thanh toán, xác nhận hoàn
// tiền) — cùng kiểu factory đọc state như push ở trên. Xem lib/emails.js.
Object.assign(ctx, makeMailNotifier(ctx));

const { makeStripeHelpers } = require('./routes/paymentsStripe');
const {
  finalizeStripeCheckout, finalizeStripePaymentIntent, markStripeCheckoutFailed,
  markStripePaymentIntentFailed, applyStripeRefundToState,
} = makeStripeHelpers(ctx);

const app = express();
// CORS mở cho mọi origin — hợp lý khi chạy dev/demo (app di động và trang quản
// trị gọi từ nhiều địa chỉ khác nhau). Khi triển khai thật, đặt
// JAPANO_ALLOWED_ORIGINS="https://admin.japano.vn,https://japano.vn" để chỉ cho
// phép đúng origin của mình.
const ALLOWED_ORIGINS = String(process.env.JAPANO_ALLOWED_ORIGINS || '')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors(ALLOWED_ORIGINS.length ? { origin: ALLOWED_ORIGINS } : {}));
// CSP tắt vì admin là JS thuần không build step, chưa audit hết chuỗi
// innerHTML động trong admin/js/*.js — các header bảo mật khác của helmet vẫn bật.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
const generalApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: Number(process.env.JAPANO_RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' },
});
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

// Chống brute-force đăng nhập/đăng ký — chặt hơn giới hạn API chung.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.JAPANO_AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Quá nhiều lần thử, vui lòng thử lại sau ít phút.' },
});
// Chỉ các endpoint thật sự nhận thông tin đăng nhập mới bị siết. `/auth/me` là
// kiểm tra phiên và `/auth/providers` là đọc cấu hình công khai — đặt chúng dưới
// bộ đếm chống brute-force khiến 20 lần mở app trong 15 phút (nhiều máy dùng
// chung một IP ra Internet là đủ) trả 429; ứng dụng coi đó là phiên bị thu hồi
// và xoá token trong SecureStore, tức là đăng xuất oan. Hai route đó vẫn nằm
// dưới giới hạn API chung ở `app.use('/api', generalApiLimiter, api)`.
api.use(['/auth/login', '/auth/register', '/auth/google', '/auth/forgot-password', '/auth/reset-password'], authLimiter);

// Mount từng domain — thứ tự không quan trọng vì các path không giao nhau,
// trừ /orders/:id (GET ở orders.js, PATCH ở returns.js — khác method nên vẫn ổn).
require('./routes/auth')(api, ctx);
require('./routes/push')(api, ctx);
require('./routes/apkDownload')(api, ctx);
require('./routes/admin')(api, ctx);
require('./routes/health')(api, ctx);
require('./routes/catalog')(api, ctx);
require('./routes/reviews')(api, ctx);
require('./routes/japanSpots')(api, ctx);
require('./routes/customerData')(api, ctx);
require('./routes/addresses')(api, ctx);
require('./routes/loyalty')(api, ctx);
require('./routes/stylist')(api, ctx);
require('./routes/tryon')(api, ctx);
require('./routes/asyncAiJobs')(api, ctx);
require('./routes/orders')(api, ctx);
require('./routes/paymentsStripe')(api, ctx);
require('./routes/paymentsVnpay')(api, ctx);
require('./routes/payments')(api, ctx);
require('./routes/returns')(api, ctx);

app.use('/api', generalApiLimiter, api);

// Cùng một nguồn ảnh cho ứng dụng và trang quản trị. Các đường dẫn sản phẩm
// dạng /assets/products/... trong cơ sở dữ liệu phải trả ảnh thật, không dùng ô
// màu thay thế khiến người bán hiểu nhầm là thiếu dữ liệu.
const MOBILE_ASSETS_DIR = path.join(__dirname, '..', 'mobile', 'assets');
app.use('/assets', express.static(MOBILE_ASSETS_DIR, { maxAge: '1h', etag: true }));

// phục vụ trang admin tĩnh
const ADMIN_DIR = path.join(__dirname, '..', 'admin');
app.use('/admin', express.static(ADMIN_DIR));
// Trước đây route này trả thẳng index.html tại "/" — nhưng styles.css và
// js/*.js trong file đó dùng đường dẫn tương đối nên trình duyệt lại xin
// "/styles.css", "/js/core.js" (404, không nằm dưới /admin). Chuyển hướng
// sang /admin/ để mọi asset tương đối tự phân giải đúng.
app.get('/', (req, res) => res.redirect('/admin/'));

// Hầu hết route đã tự try/catch và trả JSON lỗi riêng; đây là lưới an toàn cho
// phần còn sót (throw đồng bộ hoặc gọi next(err)) để không bao giờ crash tiến
// trình hay rò rỉ stack trace ra client.
if (sentryEnabled()) {
  try { require('@sentry/node').setupExpressErrorHandler(app); } catch (error) { captureError(error, { stage: 'sentry-express-handler' }); }
}
app.use((err, req, res, _next) => {
  captureError(err, { url: req.originalUrl, method: req.method });
  if (res.headersSent) return;
  res.status(err?.status || 500).json({ ok: false, message: err?.expose ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại.' });
});

process.on('unhandledRejection', (error) => captureError(error, { stage: 'unhandledRejection' }));
process.on('uncaughtException', (error) => captureError(error, { stage: 'uncaughtException' }));

// Khi có MONGODB_URI, các collection MongoDB là nguồn dữ liệu chính. Store JOIN
// các collection thành state tương thích trước khi mở cổng; không dùng app_state.
async function boot() {
  await stateStore.initialize();
  update(runMigration);

  const server = app.listen(PORT, () => {
    console.log('\n  JAPANO backend đang chạy');
    console.log('  ─────────────────────────────');
    console.log('  API      : http://localhost:' + PORT + '/api');
    console.log('  Admin    : http://localhost:' + PORT + '/  (hoặc /admin)');
    console.log('  Dữ liệu  : ' + (stateStore.storage.startsWith('mongodb') ? `MongoDB collections (${process.env.MONGODB_DB || 'japano'})` : DB_FILE));
    console.log('  Mobile   : đặt API_BASE = http://<IP-máy>:' + PORT + ' (Android emulator: http://10.0.2.2:' + PORT + ')\n');
  });

  // Khách không bấm "Đã nhận hàng" thì đơn không thể treo mãi ở trạng thái "đơn
  // vị vận chuyển đã giao" — cửa sổ đổi/trả sẽ không bao giờ bắt đầu đếm. Quét
  // mỗi giờ để tự chốt đúng theo mốc trong lib/fulfillmentPolicy.js.
  const autoConfirmTimer = setInterval(() => {
    try {
      update((state) => {
        const completed = autoCompleteDeliveredOrders(state, Date.now(), (order) => {
          if (!order.userId) return;
          pushNotification(state, {
            userId: order.userId,
            title: `Đơn hàng #${order.code} đã tự động hoàn tất`,
            body: 'Bạn chưa xác nhận nhận hàng nên hệ thống đã tự chốt đơn. Nếu có vấn đề, hãy gửi yêu cầu đổi/trả.',
            type: 'Đơn hàng',
            action: `order:${order.id}`,
          });
        });
        if (completed.length) reconcileGoalRewards(state, Date.now(), pushNotification);
        return state;
      });
    } catch (error) {
      captureError(error, { stage: 'auto-confirm-delivered-orders' });
    }
  }, 60 * 60 * 1000);
  autoConfirmTimer.unref?.();

  // Điện thoại có thể đóng request khi người dùng rời màn hình trong lúc server
  // đang trả ảnh base64 lớn. Đây là ngắt kết nối phía client, không phải lỗi làm
  // hỏng backend; bắt EPIPE trên từng socket để server tiếp tục phục vụ lượt sau.
  server.on('connection', (socket) => {
    socket.on('error', (error) => {
      if (error?.code !== 'EPIPE' && error?.code !== 'ECONNRESET') {
        logger.warn({ err: error }, 'HTTP socket error');
      }
    });
  });
}

boot();
