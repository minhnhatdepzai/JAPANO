const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.server') });
const Stripe = require('stripe');
const { emptyState, seededState } = require('./seed');
const { createStore } = require('./lib/store');
const { getHomeRecommendations, getRelatedProducts, invalidateCache } = require('./lib/recommend');
const { buildAnalytics } = require('./lib/analytics');
const { composeOutfit, todaysOutfit, adviseSize, styleRecommendation } = require('./lib/outfit');
const chatbot = require('./lib/chatbot');
const { runPillow } = require('./lib/pillow');
const { analyzeProductImage, fallbackProductDescription, ensureVietnameseProductDescription } = require('./lib/productVision');
const { buildGoalPlan, enhanceCoaching } = require('./lib/goals');
const { runAccessoryPipeline, accessoryKind } = require('./lib/accessory');
const { moderateReview, DEFAULT_MODEL: REVIEW_MODERATION_MODEL } = require('./lib/reviewModeration');
const {
  ensureFlagcardState,
  reconcileFlagRewards,
  flagcardCollectionView,
  validateVoucher,
  getOrCreateCollection,
  ensureRewardVoucher,
} = require('./lib/flagcards');

const PORT = Number(process.env.PORT || 4100);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = process.env.JAPANO_DATA_FILE || path.join(DATA_DIR, 'db.json');
const VIETNAM_UNITS_FILE = path.join(DATA_DIR, 'vietnam-administrative-units.json');
const TRYON_GPU_LOCK = process.env.JAPANO_TRYON_GPU_LOCK || '/tmp/japano-tryon-gpu.active';
const STRIPE_SECRET_KEY = String(process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_PUBLISHABLE_KEY = String(process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
const STRIPE_CURRENCY = String(process.env.STRIPE_CURRENCY || 'vnd').trim().toLowerCase();
const STRIPE_API_VERSION = String(process.env.STRIPE_API_VERSION || '2026-06-24.dahlia').trim();
const STRIPE_MERCHANT_DISPLAY_NAME = String(process.env.STRIPE_MERCHANT_DISPLAY_NAME || 'JAPANO Store').trim();
const STRIPE_WEBHOOK_SECRET = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })
  : null;

function stripeEnabled() {
  return Boolean(stripe && STRIPE_SECRET_KEY.startsWith('sk_test_') && STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_'));
}

function stripeAmount(amount, currency = STRIPE_CURRENCY) {
  const zeroDecimal = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return zeroDecimal.has(String(currency).toLowerCase()) ? Math.round(value) : Math.round(value * 100);
}

function localStripeAmount(amount, currency = STRIPE_CURRENCY) {
  const zeroDecimal = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
  return zeroDecimal.has(String(currency).toLowerCase()) ? Number(amount || 0) : Number(amount || 0) / 100;
}

function tryonGpuBusy() {
  try {
    const age = Date.now() - fs.statSync(TRYON_GPU_LOCK).mtimeMs;
    return age >= 0 && age < Number(process.env.JAPANO_TRYON_GPU_LOCK_MAX_AGE_MS || 30 * 60 * 1000);
  } catch { return false; }
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const stateStore = createStore(DB_FILE);
const vietnamUnits = JSON.parse(fs.readFileSync(VIETNAM_UNITS_FILE, 'utf8'));
function read() { return stateStore.read(); }
function write(state) { const saved = stateStore.write(state); invalidateCache(); return saved; }
function update(mutator) { const saved = stateStore.update(mutator); invalidateCache(); return saved; }

// Migration/idempotent reconciliation: old DB gains Flagcards and qualifying
// paid/completed orders receive at most one card even across restarts.
update((state) => {
  ensureFlagcardState(state);
  reconcileFlagRewards(state);
  state.payments ||= [];
  state.returnRequests ||= [];
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
    if (event.type === 'checkout.session.async_payment_failed') {
      markStripeCheckoutFailed(event.data.object.id, 'async_payment_failed');
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

api.get('/health', (req, res) => {
  const state = read();
  res.json({
    ok: true,
    seeded: state.seeded,
    time: Date.now(),
    port: PORT,
    database: { type: 'json', connected: true, file: stateStore.filePath },
    integrations: { mongo: false, cloudinary: false, ai: true, localPreview: false, stripe: stripeEnabled() },
    features: ['revenue-ensemble', 'demand-momentum', 'kmeans', 'rfm-churn', 'market-basket', 'hybrid-recommender', 'behavior-search-learning', 'live-cart-state', 'product-video', 'shared-brand-logo', 'vietnam-34-provinces-3321-wards', 'verified-purchase-reviews', 'semantic-review-moderation', 'review-reactions', 'fashn-vton-1.5', 'flux2-pose-transfer', 'flux2-accessory-refine', 'adaptive-repose-main-subject', 'tryon-quality-gate', 'accessory-quality-gate', 'single-subject-pose-lock', 'pose-accessories', 'product-vision', 'shopping-wellness-goals', 'historical-flagcards', 'flagcard-reward-voucher', 'stripe-test-checkout', 'stripe-card-discount', 'stripe-refunds', 'return-refund-workflow'],
    stripe: { enabled: stripeEnabled(), mode: stripeEnabled() ? 'test' : 'disabled', currency: STRIPE_CURRENCY },
    tryon: { forceRepose: FORCE_REPOSE, gpuBusy: tryonGpuBusy() },
  });
});

// toàn bộ state (admin dùng để đồng bộ)
api.get('/state', (req, res) => res.json(read()));
api.get('/admin/live', (req, res) => {
  const state = read();
  res.json({
    ok: true,
    serverTime: Date.now(),
    orders: state.orders,
    payments: state.payments,
    returnRequests: state.returnRequests,
    interactions: state.interactions,
    carts: state.carts,
    reviews: state.reviews,
    reviewReactions: state.reviewReactions,
    users: state.users,
    shop: state.shop,
  });
});
api.put('/state', (req, res) => {
  try {
    stateStore.replaceFromAdmin(req.body);
    const saved = update((state) => {
      reconcileFlagRewards(state);
      return state;
    });
    invalidateCache();
    res.json({ ok: true, schemaVersion: saved.schemaVersion, state: saved });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || 'state không hợp lệ' });
  }
});

api.put('/shop', (req, res) => {
  try {
    const incoming = req.body && typeof req.body === 'object' ? req.body : {};
    let shop;
    update((state) => {
      const allowed = ['name', 'hotline', 'email', 'address', 'shipFee', 'cod', 'stripe', 'logo'];
      const patch = Object.fromEntries(allowed.filter((key) => Object.prototype.hasOwnProperty.call(incoming, key)).map((key) => [key, incoming[key]]));
      if (patch.logo && !/^data:image\/(?:png|jpe?g|webp|svg\+xml);base64,/i.test(String(patch.logo))) {
        throw httpError(400, 'Logo phải là ảnh PNG, JPG, WebP hoặc SVG hợp lệ.');
      }
      if (String(patch.logo || '').length > 6 * 1024 * 1024) throw httpError(413, 'Logo vượt quá dung lượng cho phép.');
      state.shop = { ...state.shop, ...patch, updatedAt: Date.now() };
      shop = state.shop;
      return state;
    });
    res.json({ ok: true, shop: publicShop(shop) });
  } catch (error) {
    res.status(error.status || 400).json({ ok: false, message: error.message || 'Không lưu được thông tin cửa hàng.' });
  }
});

// seed / reset
api.post('/seed', (req, res) => { const s = seededState(); reconcileFlagRewards(s); write(s); res.json(s); });
api.post('/reset', (req, res) => { const s = emptyState(); write(s); res.json(s); });

// endpoints riêng cho mobile
function successfulLiveOrder(order) {
  const status = String(order.status || '').toLowerCase();
  const payment = String(order.payment?.status || '').toLowerCase();
  return !['demo', 'admin-test'].includes(String(order.source || ''))
    && !['cancelled', 'canceled', 'returned', 'refunded', 'failed'].includes(status)
    && (status === 'completed' || payment === 'paid');
}

function publicProduct(product, state) {
  const slug = encodeURIComponent(String(product.slug || product.id || 'san-pham'));
  const approvedReviews = (state.reviews || []).filter((review) => review.productId === product.slug && review.status === 'approved');
  const reviewCount = approvedReviews.length;
  const rating = reviewCount ? Math.round(approvedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount * 10) / 10 : 0;
  const sold = (state.orders || []).filter(successfulLiveOrder).reduce((total, order) => total + (order.items || []).filter((item) => String(item.slug || item.productId) === String(product.slug)).reduce((sum, item) => sum + Number(item.qty || 0), 0), 0);
  return {
    ...product,
    rating,
    reviewCount,
    sold,
    videos: (product.videos || []).map((video, index) => {
      const raw = typeof video === 'string' ? video : video?.url;
      if (String(raw || '').startsWith('data:video/')) {
        return { ...(typeof video === 'object' ? video : {}), url: `/api/products/${slug}/videos/${index}` };
      }
      return typeof video === 'string' ? { url: video } : video;
    }),
  };
}

api.get('/products', (req, res) => { const state = read(); res.json((state.products || []).map((product) => publicProduct(product, state))); });
api.get('/products/:slug/videos/:index', (req, res) => {
  const state = read();
  const product = state.products.find((item) => item.slug === String(req.params.slug) || item.id === String(req.params.slug));
  const video = product?.videos?.[Number(req.params.index)];
  const raw = typeof video === 'string' ? video : video?.url;
  const match = String(raw || '').match(/^data:(video\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!match) {
    if (/^https?:\/\//i.test(String(raw || ''))) return res.redirect(raw);
    return res.status(404).json({ ok: false, message: 'Không tìm thấy video sản phẩm.' });
  }
  const bytes = Buffer.from(match[2], 'base64');
  const range = req.headers.range;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', match[1]);
  if (range) {
    const parsed = range.match(/bytes=(\d*)-(\d*)/);
    const start = Math.max(0, Number(parsed?.[1] || 0));
    const end = Math.min(bytes.length - 1, Number(parsed?.[2] || bytes.length - 1));
    if (start > end) return res.status(416).end();
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
    res.setHeader('Content-Length', end - start + 1);
    return res.end(bytes.subarray(start, end + 1));
  }
  res.setHeader('Content-Length', bytes.length);
  res.end(bytes);
});

function reviewPurchaseOrders(state, userId, productId) {
  return (state.orders || []).filter((order) => String(order.userId || order.customer?.id || '') === String(userId)
    && String(order.status || '').toLowerCase() === 'completed'
    && successfulLiveOrder(order)
    && (order.items || []).some((item) => String(item.slug || item.productId) === String(productId)));
}

function publicReview(state, review, userId = '') {
  const reactions = (state.reviewReactions || []).filter((reaction) => reaction.reviewId === review.id);
  return {
    id: review.id,
    productId: review.productId,
    userName: review.userName,
    rating: review.rating,
    comment: review.comment,
    verifiedPurchase: true,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    helpful: reactions.filter((reaction) => reaction.value === 'helpful').length,
    notHelpful: reactions.filter((reaction) => reaction.value === 'not_helpful').length,
    myReaction: reactions.find((reaction) => reaction.userId === String(userId))?.value || null,
  };
}

api.get('/products/:slug/reviews', (req, res) => {
  const state = read(), product = state.products.find((item) => item.slug === String(req.params.slug) || item.id === String(req.params.slug));
  if (!product) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
  const userId = String(req.query.userId || '');
  const reviews = (state.reviews || []).filter((review) => review.productId === product.slug && review.status === 'approved')
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .map((review) => publicReview(state, review, userId));
  const purchaseOrders = userId ? reviewPurchaseOrders(state, userId, product.slug) : [];
  const existing = userId ? (state.reviews || []).find((review) => review.userId === userId && review.productId === product.slug) : null;
  const average = reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length * 10) / 10 : 0;
  res.json({
    ok: true,
    productId: product.slug,
    summary: { average, count: reviews.length, distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: reviews.filter((review) => review.rating === rating).length })) },
    eligibility: { canReview: Boolean(userId && purchaseOrders.length && !existing), purchased: Boolean(purchaseOrders.length), alreadyReviewed: Boolean(existing), orderIds: purchaseOrders.map((order) => order.id) },
    reviews,
  });
});

api.post('/products/:slug/reviews', async (req, res) => {
  try {
    const snapshot = read(), product = snapshot.products.find((item) => item.slug === String(req.params.slug) || item.id === String(req.params.slug));
    if (!product) throw httpError(404, 'Không tìm thấy sản phẩm.');
    const userId = String(req.body?.userId || ''), rating = Number(req.body?.rating), comment = String(req.body?.comment || '').trim();
    if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để đánh giá.');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Số sao phải từ 1 đến 5.');
    if (comment.length < 3 || comment.length > 2000) throw httpError(400, 'Bình luận cần từ 3 đến 2.000 ký tự.');
    const orders = reviewPurchaseOrders(snapshot, userId, product.slug);
    if (!orders.length) throw httpError(403, 'Chỉ khách đã mua và nhận sản phẩm mới được đánh giá.');
    if ((snapshot.reviews || []).some((review) => review.userId === userId && review.productId === product.slug)) throw httpError(409, 'Bạn đã đánh giá sản phẩm này rồi. Mỗi sản phẩm chỉ được đánh giá một lần.');
    const moderation = await moderateReview(comment, { samples: snapshot.moderationSamples, ollamaUrl: OLLAMA_URL, model: REVIEW_MODERATION_MODEL, timeoutMs: Number(process.env.JAPANO_REVIEW_MODERATION_TIMEOUT_MS || 45000) });
    let review;
    update((state) => {
      if (state.reviews.some((item) => item.userId === userId && item.productId === product.slug)) throw httpError(409, 'Bạn đã đánh giá sản phẩm này rồi.');
      const order = orders.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))[0];
      review = {
        id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productId: product.slug,
        userId,
        userName: String(order.customer?.name || req.body?.userName || 'Khách đã mua'),
        orderId: order.id,
        orderCode: order.code,
        rating,
        comment,
        status: moderation.decision,
        moderation: { ...moderation, local: { ...moderation.local, compact: undefined }, checkedAt: Date.now() },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      state.reviews.push(review);
      if (review.status === 'rejected') state.moderationSamples.push({ id: `sample-${Date.now()}`, reviewId: review.id, label: 'rejected', normalizedText: moderation.local?.normalized || comment, learnedPhrases: [moderation.local?.normalized || comment], source: 'automatic', updatedAt: Date.now() });
      return state;
    });
    const blocked = review.status === 'rejected';
    res.status(blocked ? 422 : 201).json({ ok: !blocked, review: blocked ? null : publicReview(read(), review, userId), status: review.status, message: blocked ? 'Bình luận bị chặn vì có dấu hiệu công kích, phân biệt hoặc lách từ nhạy cảm.' : review.status === 'pending' ? 'Đánh giá đang chờ quản trị viên kiểm tra.' : 'Đánh giá đã được đăng.' });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || 'Không gửi được đánh giá.' });
  }
});

api.post('/reviews/:id/reaction', (req, res) => {
  try {
    const userId = String(req.body?.userId || ''), value = String(req.body?.value || '');
    if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để bày tỏ ý kiến.');
    if (!['helpful', 'not_helpful'].includes(value)) throw httpError(400, 'Lựa chọn không hợp lệ.');
    let output;
    update((state) => {
      const review = state.reviews.find((item) => item.id === String(req.params.id) && item.status === 'approved');
      if (!review) throw httpError(404, 'Không tìm thấy đánh giá.');
      const index = state.reviewReactions.findIndex((reaction) => reaction.reviewId === review.id && reaction.userId === userId);
      if (index >= 0 && state.reviewReactions[index].value === value) state.reviewReactions.splice(index, 1);
      else {
        const reaction = { id: `reaction-${Date.now()}`, reviewId: review.id, userId, value, updatedAt: Date.now() };
        if (index >= 0) state.reviewReactions[index] = reaction; else state.reviewReactions.push(reaction);
      }
      output = publicReview(state, review, userId);
      return state;
    });
    res.json({ ok: true, review: output });
  } catch (error) {
    res.status(error.status || 400).json({ ok: false, message: error.message || 'Không lưu được lựa chọn.' });
  }
});

api.get('/reviews/admin', (req, res) => {
  const state = read();
  const items = [...(state.reviews || [])].sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0)).map((review) => ({
    ...review,
    helpful: state.reviewReactions.filter((reaction) => reaction.reviewId === review.id && reaction.value === 'helpful').length,
    notHelpful: state.reviewReactions.filter((reaction) => reaction.reviewId === review.id && reaction.value === 'not_helpful').length,
  }));
  res.json({ ok: true, model: { name: REVIEW_MODERATION_MODEL, semantic: true, antiEvasion: true, learnedRejectedSamples: state.moderationSamples.length }, items });
});

api.patch('/reviews/:id/moderation', (req, res) => {
  try {
    const status = String(req.body?.status || '');
    if (!['approved', 'rejected', 'pending'].includes(status)) throw httpError(400, 'Trạng thái kiểm duyệt không hợp lệ.');
    let review;
    update((state) => {
      review = state.reviews.find((item) => item.id === String(req.params.id));
      if (!review) throw httpError(404, 'Không tìm thấy đánh giá.');
      review.status = status;
      review.adminNote = String(req.body?.adminNote || '').slice(0, 500);
      review.moderatedAt = Date.now();
      review.updatedAt = Date.now();
      if (status === 'rejected') {
        const normalizedText = review.moderation?.local?.normalized || String(review.comment || '');
        const existing = state.moderationSamples.find((sample) => sample.reviewId === review.id);
        const sample = { id: existing?.id || `sample-${Date.now()}`, reviewId: review.id, label: 'rejected', normalizedText, learnedPhrases: [normalizedText], updatedAt: Date.now() };
        if (existing) Object.assign(existing, sample); else state.moderationSamples.push(sample);
      }
      return state;
    });
    res.json({ ok: true, review });
  } catch (error) {
    res.status(error.status || 400).json({ ok: false, message: error.message || 'Không cập nhật được kiểm duyệt.' });
  }
});

api.put('/products/:id', (req, res) => {
  try {
    let saved;
    update((state) => {
      const id = String(req.params.id);
      const index = state.products.findIndex((product) => String(product.id) === id || String(product.slug) === id);
      const incoming = req.body && typeof req.body === 'object' ? req.body : {};
      if (!String(incoming.name || '').trim()) throw httpError(400, 'Tên sản phẩm không được để trống.');
      const product = { ...(index >= 0 ? state.products[index] : {}), ...incoming };
      product.id ||= `p${Date.now()}`;
      product.slug ||= String(product.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      product.images = Array.isArray(product.images) ? product.images : [];
      product.videos = Array.isArray(product.videos) ? product.videos : [];
      product.variants = Array.isArray(product.variants) ? product.variants : [];
      product.image = product.images[0] || product.image || '';
      product.updatedAt = Date.now();
      if (index >= 0) state.products[index] = product; else state.products.push(product);
      state.seeded = true;
      saved = product;
      return state;
    });
    res.json({ ok: true, product: saved });
  } catch (error) {
    res.status(error.status || 400).json({ ok: false, message: error.message || 'Không lưu được sản phẩm.' });
  }
});

api.delete('/products/:id', (req, res) => {
  let removed = null;
  update((state) => {
    const id = String(req.params.id);
    const index = state.products.findIndex((product) => String(product.id) === id || String(product.slug) === id);
    if (index >= 0) [removed] = state.products.splice(index, 1);
    return state;
  });
  if (!removed) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
  res.json({ ok: true, product: removed });
});

function publicShop(shop) {
  const raw = String(shop?.logo || '');
  return { ...shop, logo: raw.startsWith('data:image/') ? `/api/shop/logo?v=${Number(shop.updatedAt || 0)}` : raw };
}

api.get('/shop/logo', (req, res) => {
  const raw = String(read().shop?.logo || '');
  const match = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!match) return res.status(404).end();
  const bytes = Buffer.from(match[2], 'base64');
  res.setHeader('Content-Type', match[1]);
  res.setHeader('Content-Length', bytes.length);
  res.setHeader('Cache-Control', 'no-cache');
  res.end(bytes);
});

const collections = ['orders', 'payments', 'returnRequests', 'users', 'categories', 'notifications', 'banners', 'vouchers', 'flagcards'];
collections.forEach((c) => api.get('/' + c, (req, res) => res.json(read()[c] || [])));
api.get('/shop', (req, res) => res.json(publicShop(read().shop || {})));

const normalizeSearch = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function locationScore(name, query) {
  const normalized = normalizeSearch(name), compactName = normalized.replace(/\s+/g, ''), compactQuery = normalizeSearch(query).replace(/\s+/g, '');
  if (!compactQuery) return 1;
  if (compactName === compactQuery) return 100;
  if (compactName.startsWith(compactQuery)) return 80;
  if (compactName.includes(compactQuery)) return 60;
  const tokens = normalizeSearch(query).split(' ').filter(Boolean);
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 8 : 0), 0);
}
api.get('/locations/provinces', (req, res) => {
  const query = String(req.query.q || '');
  const items = vietnamUnits.map((province) => ({ code: province.Code, name: province.FullName, wardCount: province.Wards.length }))
    .map((province) => ({ ...province, score: locationScore(province.name, query) }))
    .filter((province) => province.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'vi'));
  res.json({ ok: true, source: 'Danh mục hành chính Việt Nam', updatedFor: '34 tỉnh/thành, 3.321 đơn vị cấp xã', items });
});
api.get('/locations/wards', (req, res) => {
  const province = vietnamUnits.find((item) => item.Code === String(req.query.provinceCode || ''));
  if (!province) return res.status(400).json({ ok: false, message: 'Hãy chọn tỉnh/thành phố hợp lệ.' });
  const query = String(req.query.q || ''), limit = Math.min(200, Math.max(1, Number(req.query.limit || 80)));
  const items = province.Wards.map((ward) => ({ code: ward.Code, name: ward.FullName, provinceCode: ward.ProvinceCode, score: locationScore(ward.FullName, query) }))
    .filter((ward) => ward.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'vi'))
    .slice(0, limit);
  res.json({ ok: true, province: { code: province.Code, name: province.FullName }, total: province.Wards.length, items });
});

// map 4 lựa chọn phong cách của app sang đúng từ vựng tag đang có trong catalog (backend/seed.js) để content-based match được
const STYLE_LABELS = {
  'toi-gian': ['tối giản', 'nhẹ nhàng', 'unisex'],
  'duong-pho': ['streetwear', 'học đường', 'unisex'],
  'thanh-lich': ['thanh lịch', 'công sở'],
  'nhat-co': ['truyền thống', 'nhật', 'lễ hội'],
};
const styleTags = (style) => STYLE_LABELS[style] || [style];

const CATVTON_URL = String(process.env.JAPANO_CATVTON_URL || 'http://127.0.0.1:7861').replace(/\/+$/, '');
const FASHN_URL = String(process.env.JAPANO_FASHN_URL || 'http://127.0.0.1:7862').replace(/\/+$/, '');
// Ảnh có dáng phù hợp đi thẳng FASHN để nhanh và nhẹ hơn. FLUX.2 chỉ đổi tư
// thế khi pose detector thấy tay/vật che thân hoặc dáng chưa phù hợp. Biến môi
// trường vẫn cho phép ép đổi dáng khi cần kiểm thử pipeline đầy đủ.
const FORCE_REPOSE = String(process.env.JAPANO_FORCE_REPOSE || '0').trim().toLowerCase() !== '0';
// FLUX fidelity refinement có thể đẩy tổng VRAM sát giới hạn 16 GB khi máy
// đồng thời chạy Android emulator và Remote Desktop. FASHN đã tạo ảnh mặc đồ
// hoàn chỉnh; chỉ bật lượt làm đẹp bổ sung khi chủ động kiểm thử trên máy có
// đủ headroom bằng JAPANO_FASHN_FIDELITY_REFINE=1.
const FASHN_FIDELITY_REFINE = String(process.env.JAPANO_FASHN_FIDELITY_REFINE || '0').trim().toLowerCase() !== '0';
// Chỉ dùng flat-lay đã được người vận hành xem và duyệt. Tách nền semantic có
// thể để sót da/tay/người mẫu; tự động tin mọi file *_tryon-flat sẽ làm model
// mặc cả những phần đó lên khách hàng.
const APPROVED_TRYON_FLATS = new Set(
  String(process.env.JAPANO_APPROVED_TRYON_FLATS || 'kimono-hong,ao-len-cardigan,yumeko')
    .split(',').map((value) => value.trim()).filter(Boolean),
);
const AI_GATEWAY_URL = String(process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');
const OLLAMA_URL = String(process.env.OLLAMA_URL || process.env.JAPANO_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');

async function fetchWithTimeout(url, options = {}, timeoutMs = 1800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function serviceHealth(base, pathName = '/health') {
  if (!base) return { configured: false, online: false };
  try {
    const response = await fetchWithTimeout(`${base}${pathName}`, {}, 1600);
    const text = await response.text();
    let detail = {};
    try { detail = text ? JSON.parse(text) : {}; } catch { detail = { text: text.slice(0, 160) }; }
    return { configured: true, online: response.ok, status: response.status, detail };
  } catch (error) {
    return { configured: true, online: false, error: error.name === 'AbortError' ? 'timeout' : error.message };
  }
}

api.get('/ai/health', async (req, res) => {
  const [fashn, catvton, gateway, ollama] = await Promise.all([
    serviceHealth(FASHN_URL),
    serviceHealth(CATVTON_URL),
    serviceHealth(AI_GATEWAY_URL),
    serviceHealth(OLLAMA_URL, '/api/tags'),
  ]);
  res.json({
    ok: true,
    engine: fashn.online ? 'fashn-vton-1.5' : catvton.online ? 'catvton-fallback' : gateway.online ? 'ai-gateway' : 'unavailable',
    services: { fashn, catvton, gateway, ollama, pillow: { configured: true, online: true } },
    fallbackReady: false,
  });
});

async function polishWithOllama(userMessage, draft) {
  // Retrieval là mặc định để tên/giá/sản phẩm luôn đúng catalog. Chỉ bật LLM viết lại
  // khi người vận hành chủ động đặt JAPANO_OLLAMA_CHAT=1.
  if (String(process.env.JAPANO_OLLAMA_CHAT || '0') !== '1') return draft;
  if (tryonGpuBusy()) return draft;
  try {
    const model = process.env.OLLAMA_MODEL || process.env.JAPANO_OLLAMA_MODEL || 'qwen2.5:7b';
    const prompt = [
      'Bạn là Ori, trợ lý mua sắm thời trang Nhật của JAPANO.',
      'Viết lại câu trả lời nháp bằng tiếng Việt tự nhiên, thân thiện, tối đa 90 từ.',
      'Không bịa giá, voucher, trạng thái đơn hoặc sản phẩm; không thêm sản phẩm mới.',
      `Câu hỏi: ${String(userMessage || '').slice(0, 800)}`,
      `Câu trả lời nháp đã truy hồi từ dữ liệu thật: ${String(draft || '').slice(0, 1600)}`,
    ].join('\n');
    const response = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.25, num_predict: 180 } }),
    }, Number(process.env.JAPANO_OLLAMA_TIMEOUT_MS || 45000));
    if (!response.ok) return draft;
    const data = await response.json();
    return String(data.response || '').trim() || draft;
  } catch { return draft; }
}

// gợi ý trang chủ: hybrid CF (cosine) + Matrix Factorization (SGD) + content-based + trending
api.get('/recommendations/home', (req, res) => {
  const userId = String(req.query.userId || 'guest');
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
  const style = req.query.style ? String(req.query.style) : '';
  const s = read();
  const stored = s.profiles.find((row) => row.userId === userId);
  const profile = style ? { ...stored, preferredStyles: styleTags(style) } : stored;
  res.json(getHomeRecommendations(s, { userId, limit, profile }));
});
api.get('/recommendations/:userId', (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
  const s = read();
  const profile = s.profiles.find((row) => row.userId === String(req.params.userId));
  res.json(getHomeRecommendations(s, { userId: String(req.params.userId), limit, profile }));
});

// sản phẩm liên quan (item-based CF + content-based + xu hướng)
api.get('/products/:slug/related', (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
  res.json({ productIds: getRelatedProducts(read(), req.params.slug, limit) });
});

// Qwen3-VL nhìn ảnh catalog, nhưng luôn bám tên/tag sản phẩm và có fallback tức thời.
api.get('/products/:slug/ai-description', async (req, res) => {
  const state = read();
  const product = state.products.find((item) => item.slug === String(req.params.slug) || item.id === String(req.params.slug));
  if (!product) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
  const cached = (state.aiDescriptions || []).find((item) => item.productId === product.slug);
  const cachedAge = cached ? Date.now() - Number(cached.generatedAt || 0) : Infinity;
  const isVisionCache = cached?.description?.engine === 'qwen3-vl:8b';
  if (cached && req.query.refresh !== '1' && (isVisionCache || cachedAge < 10 * 60 * 1000)) {
    const localized = ensureVietnameseProductDescription(cached.description, product);
    if (JSON.stringify(localized) !== JSON.stringify(cached.description)) {
      update((next) => {
        const row = next.aiDescriptions.find((item) => item.productId === product.slug);
        if (row) row.description = localized;
        return next;
      });
    }
    return res.json({ ok: true, cached: true, ...localized });
  }
  if (tryonGpuBusy()) {
    return res.json({ ok: true, cached: false, gpuBusy: true, ...fallbackProductDescription(product) });
  }
  const imagePath = resolveGarmentImage(product.slug);
  const description = await analyzeProductImage({
    product,
    imagePath,
    ollamaUrl: OLLAMA_URL,
    model: process.env.JAPANO_VISION_MODEL || 'qwen3-vl:8b',
    timeoutMs: Number(process.env.JAPANO_VISION_TIMEOUT_MS || 120000),
  });
  update((next) => {
    const row = { productId: product.slug, generatedAt: Date.now(), description };
    const index = next.aiDescriptions.findIndex((item) => item.productId === product.slug);
    if (index >= 0) next.aiDescriptions[index] = row; else next.aiDescriptions.push(row);
    return next;
  });
  res.json({ ok: true, cached: false, ...description });
});

// thu thập dữ liệu hành vi người dùng (xem, thích, giỏ hàng, thử đồ...) để nuôi engine gợi ý
api.post('/interactions', (req, res) => {
  const b = req.body || {};
  const type = String(b.type || '').toLowerCase();
  if (!b.userId || !b.productId || !type) return res.status(400).json({ error: 'thiếu userId, productId hoặc type' });
  let cart = null;
  update((state) => {
    const now = Date.now(), userId = String(b.userId), productId = String(b.productId), metadata = b.metadata || {};
    state.interactions.push({ id: 'i' + now + Math.random().toString(36).slice(2, 7), userId, productId, type, value: b.value, metadata, createdAt: now, source: 'mobile' });
    if (type === 'cart') {
      const color = String(metadata.color || 'Mặc định'), size = String(metadata.size || 'M'), quantity = Math.max(0, Number(b.value) || 0);
      const index = state.carts.findIndex((item) => item.userId === userId && item.productId === productId && item.color === color && item.size === size);
      if (quantity <= 0) {
        if (index >= 0) state.carts.splice(index, 1);
      } else {
        const next = { ...(index >= 0 ? state.carts[index] : {}), userId, productId, color, size, quantity, updatedAt: now };
        if (index >= 0) state.carts[index] = next; else state.carts.push(next);
      }
      cart = state.carts.filter((item) => item.userId === userId);
    }
    return state;
  });
  res.json({ ok: true, cart });
});

api.post('/carts/sync', (req, res) => {
  try {
    const userId = String(req.body?.userId || '');
    if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để đồng bộ giỏ hàng.');
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    let cart;
    update((state) => {
      state.carts = state.carts.filter((item) => item.userId !== userId);
      const now = Date.now();
      for (const item of items) {
        const productId = String(item.productId || item.slug || '');
        const product = state.products.find((candidate) => candidate.slug === productId || candidate.id === productId);
        const quantity = Math.min(20, Math.max(0, Number(item.quantity ?? item.qty) || 0));
        if (!product || quantity <= 0) continue;
        state.carts.push({ userId, productId: product.slug, color: String(item.color || item.colorName || 'Mặc định'), size: String(item.size || 'M'), quantity, updatedAt: now });
      }
      cart = state.carts.filter((item) => item.userId === userId);
      return state;
    });
    res.json({ ok: true, cart });
  } catch (error) {
    res.status(error.status || 400).json({ ok: false, message: error.message || 'Không đồng bộ được giỏ hàng.' });
  }
});

// lưu hồ sơ phong cách (dùng làm tín hiệu content-based cho user mới / cold-start)
function saveStylistProfile(userId, p = {}) {
  const s = read();
  const next = {
    userId: String(userId),
    preferredStyles: p.style ? styleTags(p.style) : (Array.isArray(p.preferredStyles) ? p.preferredStyles : undefined),
    heightCm: p.height ? Number(p.height) : (p.heightCm ? Number(p.heightCm) : undefined),
    weightKg: p.weight ? Number(p.weight) : (p.weightKg ? Number(p.weightKg) : undefined),
    usualSize: p.usualSize,
    occasion: p.occasion,
    budget: p.budget ? Number(p.budget) : undefined,
    updatedAt: Date.now(),
  };
  const i = s.profiles.findIndex((row) => row.userId === next.userId);
  const merged = { ...(i >= 0 ? s.profiles[i] : {}), ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) };
  if (i >= 0) s.profiles[i] = merged; else s.profiles.push(merged);
  write(s);
  return merged;
}
api.post('/stylist/profile', (req, res) => {
  const b = req.body || {};
  if (!b.userId) return res.status(400).json({ error: 'thiếu userId' });
  res.json({ ok: true, profile: saveStylistProfile(b.userId, b.profile || {}) });
});
// alias dạng /stylist/profile/:userId với body là hồ sơ trực tiếp (không bọc trong {profile})
api.post('/stylist/profile/:userId', (req, res) => {
  res.json({ ok: true, profile: saveStylistProfile(req.params.userId, req.body || {}) });
});
api.get('/stylist/profile/:userId', (req, res) => {
  const profile = read().profiles.find((row) => row.userId === String(req.params.userId));
  res.json({ ok: true, profile: profile || null });
});

// Mục tiêu mua sắm + sức khoẻ: thuật toán tài chính quyết định con số,
// LLM chỉ diễn đạt coach hành vi trong hàng rào an toàn.
api.get('/goals/:userId', (req, res) => {
  const goals = (read().goals || [])
    .filter((goal) => goal.userId === String(req.params.userId))
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
  res.json({ ok: true, goals });
});
api.post('/goals/plan', async (req, res) => {
  const input = req.body || {};
  const userId = String(input.userId || 'guest');
  const state = read();
  const requestedId = String(input.productId || '');
  const product = state.products.find((item) => item.slug === requestedId || item.id === requestedId);
  if (!product) return res.status(400).json({ ok: false, message: 'Hãy chọn một sản phẩm JAPANO làm mục tiêu.' });
  const plan = buildGoalPlan(input, product);
  if (String(process.env.JAPANO_GOALS_LLM || '1') !== '0' && !tryonGpuBusy()) {
    plan.coaching = await enhanceCoaching({
      product,
      saving: plan.saving,
      wellness: plan.wellness,
      ollamaUrl: OLLAMA_URL,
      model: process.env.JAPANO_GOALS_MODEL || 'qwen2.5:7b',
      timeoutMs: Number(process.env.JAPANO_GOALS_TIMEOUT_MS || 90000),
    });
  }
  const now = Date.now();
  const goal = {
    id: `goal-${userId}-${product.slug}`,
    userId,
    productId: product.slug,
    product: { slug: product.slug, name: product.name, price: product.price, image: product.image },
    input: {
      age: Number(input.age) || undefined,
      heightCm: Number(input.heightCm) || undefined,
      currentWeightKg: Number(input.currentWeightKg) || undefined,
      targetWeightKg: Number(input.targetWeightKg) || undefined,
      monthlyIncome: Number(input.monthlyIncome) || 0,
      fixedExpenses: Number(input.fixedExpenses) || 0,
      currentSavings: Number(input.currentSavings) || 0,
      targetMonths: Number(input.targetMonths) || 6,
    },
    plan,
    createdAt: now,
    updatedAt: now,
  };
  update((next) => {
    const index = next.goals.findIndex((item) => item.id === goal.id);
    if (index >= 0) goal.createdAt = next.goals[index].createdAt || now;
    if (index >= 0) next.goals[index] = goal; else next.goals.push(goal);
    next.interactions.push({ id: `goal-i-${now}`, userId, productId: product.slug, type: 'goal', value: 1, createdAt: now, source: 'mobile' });
    return next;
  });
  res.json({ ok: true, goal });
});

// phân tích doanh thu/nhu cầu/xu hướng/phân khúc khách hàng cho dashboard admin
api.get('/analytics', (req, res) => {
  const state = read();
  const scope = String(req.query.scope || 'live') === 'all' ? 'all' : 'live';
  const scoped = scope === 'all' ? state : {
    ...state,
    orders: (state.orders || []).filter((row) => !['demo', 'admin-test'].includes(String(row.source || ''))),
    interactions: (state.interactions || []).filter((row) => row.source !== 'demo'),
  };
  res.json({
    ok: true,
    scope,
    sourceCounts: {
      liveOrders: (state.orders || []).filter((row) => !['demo', 'admin-test'].includes(String(row.source || ''))).length,
      demoOrders: (state.orders || []).filter((row) => ['demo', 'admin-test'].includes(String(row.source || ''))).length,
      liveInteractions: (state.interactions || []).filter((row) => row.source !== 'demo').length,
      demoInteractions: (state.interactions || []).filter((row) => row.source === 'demo').length,
    },
    ...buildAnalytics(scoped),
  });
});

// ghép đồ AI: set hôm nay (đổi mỗi ngày) và set phối quanh 1 sản phẩm cụ thể
api.get('/outfits/today', (req, res) => {
  const set = todaysOutfit(read());
  if (!set) return res.status(200).json({ ok: false, message: 'Chưa đủ dữ liệu để ghép set hôm nay.' });
  res.json({ ok: true, ...set });
});
api.get('/outfits/:slug', (req, res) => {
  const set = composeOutfit(read(), req.params.slug);
  if (!set) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm để ghép set.' });
  res.json({ ok: true, ...set });
});

// tư vấn size dạng expert-system (số đo hoặc chiều cao/cân nặng) — chấp nhận cả body phẳng lẫn {profile}
api.post('/stylist/size', (req, res) => {
  const b = req.body || {};
  const measurements = { ...b, ...(b.profile || {}) };
  const result = adviseSize(measurements);
  res.json({ ok: true, size: result.size, recommendedSize: result.size, advice: result.advice, message: result.advice });
});

// tư vấn phong cách cho "Ống kính JAPANO": hồ sơ + (tuỳ chọn) tông màu chủ đạo trích từ ảnh qua Pillow
api.post('/stylist/recommend', async (req, res) => {
  const b = req.body || {};
  const userId = String(b.userId || 'guest');
  const s = read();
  const stored = s.profiles.find((row) => row.userId === userId);
  const profile = { ...stored, ...(b.profile || {}) };
  let dominantHex;
  if (b.imageBase64) {
    const colorResult = await runPillow({ mode: 'dominant_color', imageBase64: b.imageBase64 }, 15000);
    if (colorResult.ok) dominantHex = colorResult.hex;
  }
  const result = styleRecommendation(s, { userId, profile, dominantHex, limit: 8 });
  res.json({ ok: true, recommendation: result, ...result });
});

// chatbot Ori: nhận diện ý định theo từ khoá + truy hồi sản phẩm từ engine gợi ý/ghép đồ đã có
api.post('/stylist/chat', async (req, res) => {
  const b = req.body || {};
  const s = read();
  const userId = String(b.userId || 'guest');
  const stored = s.profiles.find((row) => row.userId === userId);
  const profile = { ...stored, ...(b.profile || {}) };
  const result = chatbot.reply(s, { userId: b.userId, message: b.message, profile });
  const message = await polishWithOllama(b.message, result.message);
  update((state) => {
    const createdAt = Date.now();
    state.chats.push({ id: `chat-${createdAt}`, userId, role: 'user', message: String(b.message || ''), createdAt });
    state.chats.push({ id: `chat-${createdAt}-ai`, userId, role: 'assistant', message, productIds: result.productIds, createdAt: createdAt + 1 });
    (result.productIds || []).forEach((productId, index) => state.interactions.push({
      id: `chat-i-${createdAt}-${index}`, userId, productId, type: 'chat', value: 1, createdAt, source: 'mobile',
    }));
    return state;
  });
  res.json({ ok: true, message, reply: message, productIds: result.productIds, products: result.productIds, engine: message === result.message ? 'retrieval' : 'retrieval+ollama' });
});

// Thử đồ thật bằng FASHN VTON 1.5. FLUX.2 chỉ đổi tư thế khi bộ phân tích pose
// xác định tay/vật đang che thân; CatVTON là fallback có kiểm định chất lượng.
function resolveGarmentImage(productId) {
  const dir = path.join(__dirname, '..', 'mobile', 'assets', 'products');
  try {
    const files = fs.readdirSync(dir).filter((name) => name.startsWith(`${productId}_`) && /\.(?:jpe?g|png|webp)$/i.test(name)).sort();
    // Ảnh *_tryon-flat là reference sạch dành riêng cho VTON: không có người
    // mẫu, bó hoa hay cảnh nền để parser nhận nhầm thành một phần trang phục.
    const cleanTryon = APPROVED_TRYON_FLATS.has(String(productId))
      ? files.find((name) => /_tryon-flat\.(?:jpe?g|png|webp)$/i.test(name))
      : null;
    if (cleanTryon) return path.join(dir, cleanTryon);
    const catalogFiles = files.filter((name) => !/_tryon-(?:flat|candidate)\.(?:jpe?g|png|webp)$/i.test(name));
    return catalogFiles.length ? path.join(dir, catalogFiles[0]) : null;
  } catch { return null; }
}

function stripDataUri(value) {
  const text = String(value || '');
  return text.startsWith('data:') && text.includes(',') ? text.slice(text.indexOf(',') + 1) : text;
}

const ACCESSORY_QUALITY_LABELS = {
  main_subject_lost:'không nhận rõ nhân vật chính',
  face_changed_or_covered:'khuôn mặt bị thay đổi hoặc che khuất',
  hat_obscures_eyes:'mũ đang che mắt',
  garment_fidelity_changed:'trang phục bị lệch mẫu',
  hand_pose_not_engaged:'tay chưa cầm phụ kiện tự nhiên',
  hat_missing:'chưa nhận rõ mũ',
  accessory_quality_check_failed:'không chấm được chất lượng phụ kiện',
};
const accessoryQualityLabels = (reasons = []) => reasons.map((reason) => ACCESSORY_QUALITY_LABELS[reason] || reason);

function normalizeImageResult(data) {
  if (!data) return '';
  const raw = data.finalImageBase64 || data.imageBase64 || data.result?.imageBase64 || data.result?.finalImageBase64 || data.urls?.[0] || data.imageUrl || '';
  if (!raw) return '';
  const value = String(raw);
  return value.startsWith('data:') || value.startsWith('http') ? value : `data:image/png;base64,${value}`;
}

function clothTypeFor(product = {}) {
  const text = `${product.name || ''} ${product.cat || product.category || ''}`.toLowerCase();
  if (/(quần|quan|chân váy|chan vay|lower)/i.test(text)) return 'lower';
  if (/(kimono|yukata|đầm|dam|dress|cosplay|outfit|overall|đồng phục|dong phuc|uniform|bộ đồ|bo do)/i.test(text)) return 'overall';
  return 'upper';
}

// Ước lượng size phù hợp và độ lệch so với size khách chọn để cảnh báo chật/rộng.
// Không co giãn ảnh catalog trước inference: thao tác đó làm sai hoa văn/phom và
// là một nguyên nhân khiến engine cũ tạo ra tấm vải hình chữ nhật.
const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'];
function computeSizeFit(chosenSizeRaw, profile) {
  const chosen = String(chosenSizeRaw || 'M').toUpperCase();
  const chosenIndex = SIZE_ORDER.indexOf(chosen);
  if (!profile || chosenIndex < 0) return { chosen, recommended: null, delta: 0, verdict: 'unknown', message: '' };
  const { size: recommended } = adviseSize(profile);
  const recommendedIndex = SIZE_ORDER.indexOf(recommended);
  const delta = recommendedIndex < 0 ? 0 : chosenIndex - recommendedIndex;
  const verdict = delta === 0 ? 'good' : delta < 0 ? 'tight' : 'loose';
  const message = verdict === 'good'
    ? `Kích cỡ ${chosen} phù hợp với số đo bạn nhập.`
    : verdict === 'tight'
      ? `Bạn chọn size ${chosen} nhưng số đo hợp với size ${recommended} hơn — trang phục trong ảnh có thể hơi chật/bó sát so với thực tế.`
      : `Bạn chọn size ${chosen} nhưng số đo hợp với size ${recommended} hơn — trang phục trong ảnh có thể hơi rộng/thùng thình so với thực tế.`;
  return { chosen, recommended, delta, verdict, message };
}

// Ảnh vải chỉ được chỉnh khổ (hẹp/rộng hơn) trước khi gửi cho AI — đây là ước
// lượng hình ảnh, không phải mô phỏng vải vật lý chính xác 100%.
async function adjustGarmentForFit(garmentImagePath, fitDelta) {
  if (!fitDelta) return garmentImagePath;
  try {
    const imageBase64 = fs.readFileSync(garmentImagePath).toString('base64');
    const result = await runAccessoryPipeline({ mode: 'fit_adjust', imageBase64, fitDelta }, 20000);
    if (!result.ok || !result.imageBase64) return garmentImagePath;
    const tempPath = path.join(os.tmpdir(), `japano-fit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
    fs.writeFileSync(tempPath, Buffer.from(result.imageBase64, 'base64'));
    return tempPath;
  } catch { return garmentImagePath; }
}

// Một số ảnh (tư thế lạ, tay che ngực...) khiến CatVTON không nhận diện được
// vùng trang phục và âm thầm trả gần như nguyên ảnh gốc dù HTTP 200 OK — kiểm
// tra độ khác biệt để không báo "thành công" giả trong trường hợp đó.
const GARMENT_UNCHANGED_THRESHOLD = 10;
async function isGarmentUnchanged(personImageBase64, resultImage, pose, clothType) {
  if (!resultImage || !resultImage.startsWith('data:')) return false;
  try {
    const compareImageBase64 = resultImage.slice(resultImage.indexOf(',') + 1);
    const result = await runAccessoryPipeline({ mode: 'similarity', imageBase64: personImageBase64, compareImageBase64, pose, clothType }, 20000);
    return result.ok && typeof result.score === 'number' && result.score < GARMENT_UNCHANGED_THRESHOLD;
  } catch { return false; }
}

async function validateTryOnResult(personImageBase64, resultImage, pose, clothType, requireStraightPose = false) {
  if (!resultImage || !resultImage.startsWith('data:')) return { ok: true, reasons: [] };
  try {
    const compareImageBase64 = resultImage.slice(resultImage.indexOf(',') + 1);
    const checked = await runAccessoryPipeline({
      mode: 'quality', imageBase64: personImageBase64, compareImageBase64,
      pose, clothType, requireStraightPose,
    }, 90000);
    return checked.ok && checked.quality ? checked.quality : { ok: false, reasons: ['quality_check_failed'] };
  } catch (error) {
    return { ok: false, reasons: [`quality_check_error:${error.message}`] };
  }
}

async function validateAccessoryResult(cleanImage, resultImage, kinds) {
  if (!cleanImage?.startsWith('data:') || !resultImage?.startsWith('data:')) {
    return { ok:false, reasons:['accessory_quality_input_invalid'], score:9999 };
  }
  try {
    const checked = await runAccessoryPipeline({
      mode:'accessory_quality',
      imageBase64:stripDataUri(cleanImage),
      compareImageBase64:stripDataUri(resultImage),
      kinds,
    }, 90000);
    return checked.ok && checked.quality
      ? checked.quality
      : { ok:false, reasons:['accessory_quality_check_failed'], score:9999 };
  } catch (error) {
    return { ok:false, reasons:[`accessory_quality_error:${error.message}`], score:9999 };
  }
}

function fashnCategoryFor(product = {}) {
  const type = clothTypeFor(product);
  return type === 'lower' ? 'bottoms' : type === 'overall' ? 'one-pieces' : 'tops';
}

async function tryFashn(personImageBase64, garmentImagePath, product, shouldRepose = false, generationAttempt = 0) {
  const form = new FormData();
  const person = Buffer.from(stripDataUri(personImageBase64), 'base64');
  const garment = fs.readFileSync(garmentImagePath);
  form.append('person', new Blob([person], { type: 'image/jpeg' }), 'person.jpg');
  form.append('cloth', new Blob([garment], { type: 'image/jpeg' }), path.basename(garmentImagePath));
  form.append('category', fashnCategoryFor(product));
  const garmentPhotoType = /_tryon-flat\.(?:jpe?g|png|webp)$/i.test(path.basename(garmentImagePath)) ? 'flat-lay' : 'model';
  form.append('garment_photo_type', garmentPhotoType);
  const shouldRefine = FASHN_FIDELITY_REFINE
    && garmentPhotoType === 'flat-lay'
    && fashnCategoryFor(product) === 'one-pieces';
  form.append('refine', shouldRefine ? 'true' : 'false');
  form.append('repose', shouldRepose ? 'true' : 'false');
  form.append('seed', String(Number(process.env.JAPANO_FASHN_SEED || 42) + generationAttempt * 101));
  const response = await fetchWithTimeout(`${FASHN_URL}/tryon`, { method: 'POST', body: form }, Number(process.env.JAPANO_TRYON_TIMEOUT_MS || 900000));
  if (!response.ok) {
    let detail = '';
    try { detail = String((await response.json()).detail || ''); } catch {}
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  const type = String(response.headers.get('content-type') || 'image/png');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('FASHN không trả ảnh');
  return {
    image: `data:${type.startsWith('image/') ? type.split(';')[0] : 'image/png'};base64,${bytes.toString('base64')}`,
    engine: String(response.headers.get('x-japano-engine') || 'fashn-vton-1.5'),
    reposed: String(response.headers.get('x-japano-reposed') || '').toLowerCase() === 'true',
  };
}

async function tryAccessoryRefine(roughImage, cleanImage, accessories, generationAttempt = 0) {
  const form = new FormData();
  const rough = Buffer.from(stripDataUri(roughImage), 'base64');
  const clean = Buffer.from(stripDataUri(cleanImage), 'base64');
  form.append('rough', new Blob([rough], { type:'image/png' }), 'rough.png');
  form.append('clean', new Blob([clean], { type:'image/png' }), 'clean.png');
  const metadata = [];
  for (const item of accessories.slice(0, 4)) {
    if (!item.imagePath || !fs.existsSync(item.imagePath)) continue;
    const bytes = fs.readFileSync(item.imagePath);
    form.append('accessories', new Blob([bytes], { type:'image/jpeg' }), path.basename(item.imagePath));
    metadata.push({ id:item.id, name:item.name, kind:item.kind });
  }
  if (!metadata.length) throw new Error('Không có ảnh phụ kiện để làm đẹp.');
  form.append('metadata', JSON.stringify(metadata));
  form.append('seed', String(Number(process.env.JAPANO_ACCESSORY_REFINE_SEED || 101) + generationAttempt * 137));
  const response = await fetchWithTimeout(
    `${FASHN_URL}/accessory-refine`,
    { method:'POST', body:form },
    Number(process.env.JAPANO_ACCESSORY_REFINE_TIMEOUT_MS || 420000),
  );
  if (!response.ok) {
    let detail = '';
    try { detail = String((await response.json()).detail || ''); } catch {}
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  const type = String(response.headers.get('content-type') || 'image/png');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('FLUX accessory refiner không trả ảnh.');
  return {
    image:`data:${type.startsWith('image/') ? type.split(';')[0] : 'image/png'};base64,${bytes.toString('base64')}`,
    engine:String(response.headers.get('x-japano-engine') || 'flux2-klein-4b-accessory-refine'),
  };
}

async function tryCatvton(personImageBase64, garmentImagePath, product, mainPersonBox, keypoints, shouldRepose = false) {
  if (String(process.env.JAPANO_CATVTON_DISABLE || '0') === '1') throw new Error('CatVTON đã tắt');
  const form = new FormData();
  const person = Buffer.from(stripDataUri(personImageBase64), 'base64');
  const garment = fs.readFileSync(garmentImagePath);
  form.append('person', new Blob([person], { type: 'image/jpeg' }), 'person.jpg');
  form.append('cloth', new Blob([garment], { type: 'image/jpeg' }), path.basename(garmentImagePath));
  form.append('cloth_type', clothTypeFor(product));
  form.append('main_person_box', JSON.stringify(mainPersonBox || []));
  if (keypoints) form.append('keypoints', JSON.stringify(keypoints));
  form.append('repose', shouldRepose ? 'true' : 'false');
  const response = await fetchWithTimeout(`${CATVTON_URL}/tryon`, { method: 'POST', body: form }, Number(process.env.JAPANO_TRYON_TIMEOUT_MS || 720000));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = String(response.headers.get('content-type') || '');
  if (type.includes('application/json')) {
    const data = await response.json();
    const image = normalizeImageResult(data);
    if (!image) throw new Error(data.message || 'CatVTON không trả ảnh');
    return { image, reposed: Boolean(data.reposed) };
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('CatVTON trả ảnh rỗng');
  return {
    image: `data:${type.startsWith('image/') ? type.split(';')[0] : 'image/png'};base64,${bytes.toString('base64')}`,
    reposed: String(response.headers.get('x-japano-reposed') || '').toLowerCase() === 'true',
  };
}

async function tryGateway(personImageBase64, garmentImagePath, product, body) {
  const garmentImageBase64 = fs.readFileSync(garmentImagePath).toString('base64');
  const accessoryImagesBase64 = (body.accessoryIds || body.accessoryProductIds || [])
    .map((id) => resolveGarmentImage(String(id)))
    .filter(Boolean)
    .slice(0, 4)
    .map((file) => fs.readFileSync(file).toString('base64'));
  const response = await fetchWithTimeout(`${AI_GATEWAY_URL}/tryon/advanced`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      personImageBase64,
      garmentImageBase64,
      accessoryImagesBase64,
      category: product.cat || product.category || 'fashion',
      productName: product.name || '',
      selectedSize: body.size || body.selectedSize || '',
      adultConfirmed: Boolean(body.adultConfirmed),
      steps: Number(process.env.JAPANO_TRYON_STEPS || 60),
      guidanceScale: Number(process.env.JAPANO_TRYON_CFG || 3.5),
      seed: Number(process.env.JAPANO_TRYON_SEED || 70),
    }),
  }, Number(process.env.JAPANO_TRYON_TIMEOUT_MS || 720000));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const image = normalizeImageResult(data);
  if (!image) throw new Error(data.message || 'Gateway không trả ảnh');
  return image;
}

api.post('/tryon', async (req, res) => {
  const b = req.body || {};
  if (!b.personImageBase64 || !b.productId) return res.status(400).json({ ok: false, message: 'Thiếu ảnh người dùng hoặc productId.' });
  const state = read();
  const product = state.products.find((item) => item.slug === String(b.productId) || item.id === String(b.productId));
  if (!product) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
  let garmentImagePath = resolveGarmentImage(product.slug);
  if (!garmentImagePath) return res.status(404).json({ ok: false, message: 'Không tìm thấy ảnh sản phẩm để ghép.' });
  const sizeFit = computeSizeFit(b.size, b.profile);
  const accessoryIds = [...new Set((b.accessoryIds || b.accessoryProductIds || []).map(String))].slice(0, 4);
  const accessories = accessoryIds
    .map((id) => state.products.find((item) => item.slug === id || item.id === id))
    .filter((item) => item && (item.cat === 'phu-kien' || item.category === 'phu-kien'));
  const attempts = [];
  let poseAnalysis = await runAccessoryPipeline({ mode: 'analyze', imageBase64: b.personImageBase64 }, 60000);
  if (!poseAnalysis.ok || !poseAnalysis.pose?.box) {
    // Pose detector hỏng/không nhận được người không còn là lý do chặn request.
    // FLUX vẫn được thử với khung trung tâm; nếu cả GPU pipeline thất bại, phía
    // dưới còn một ảnh preview cục bộ để UI không bao giờ trắng.
    poseAnalysis = {
      ok: true,
      pose: {
        box: [150, 50, 620, 1000], keypoints: {}, otherBoxes: [], confidence: 0,
        fallback: true, inferredKeypoints: [],
        garmentRegion: { ok: false, reason: 'no_person', message: 'Đang dùng khung người trung tâm dự phòng.' },
        poseSuitability: { requiresRepose: true, score: 0, reasons: ['detector_fallback'] },
      },
      normalizedImageBase64: '',
    };
  }
  // Chặn sớm những ảnh không thể thay đồ (tay che ngực, không thấy thân trên...)
  // Chỉ từ chối khi thật sự không có người/thân trên để mặc thử. Các ca tay che
  // ngực vẫn cho chạy: CatVTON được cấp thêm mask thân người (từ khớp vai–hông)
  // để vẫn mặc áo lên trọn thân — chấp nhận ảnh có thể chưa hoàn hảo.
  const garmentRegion = poseAnalysis.pose.garmentRegion;
  // Không chặn ảnh khó chỉ vì pose detector thiếu khớp/người bị cắt. FLUX là
  // tầng phục hồi tư thế và vẫn phải được thử; quality gate sẽ đánh giá ảnh AI
  // sau cùng. Đây là best-effort cho ảnh đứng, ngồi, nghiêng, cận người...
  const occluded = Boolean(garmentRegion && garmentRegion.ok === false);
  const poseSuitability = poseAnalysis.pose.poseSuitability || { requiresRepose: occluded, reasons: [] };
  // Luôn dùng model sửa ảnh đa tham chiếu cho nhân vật chính. Điều này bảo đảm
  // ảnh được chấm là "đủ tốt" nhưng vẫn giơ tay/ngồi/nghiêng không đi tắt vào
  // VTON và giữ nguyên tư thế như pipeline cũ.
  const requiresRepose = Boolean(FORCE_REPOSE || poseSuitability.requiresRepose || occluded);
  const reposeReasons = [...new Set([
    ...(poseSuitability.reasons || []),
    ...(FORCE_REPOSE ? ['always_repose'] : []),
  ])];
  const normalizedPersonImageBase64 = poseAnalysis.normalizedImageBase64 || b.personImageBase64;
  const clothType = clothTypeFor(product);
  let imageUrl = '';
  let engine = '';
  let poseTransferred = false;
  let rejectedQuality = null;
  let qualityWarning = null;
  let bestCandidate = null;
  const automaticAttempts = Math.max(1, Math.min(3, Number(process.env.JAPANO_TRYON_AUTO_ATTEMPTS || 2)));
  for (let generationAttempt = 0; generationAttempt < automaticAttempts && !imageUrl; generationAttempt += 1) {
    try {
      const fashn = await tryFashn(
        normalizedPersonImageBase64,
        garmentImagePath,
        product,
        requiresRepose,
        generationAttempt,
      );
      imageUrl = fashn.image;
      poseTransferred = fashn.reposed;
      engine = fashn.engine;
    } catch (error) {
      attempts.push(`FASHN lượt ${generationAttempt + 1}: ${error.message}`);
      continue;
    }
    if ((poseAnalysis.pose.otherBoxes || []).length) {
      const restored = await runAccessoryPipeline({
        mode: 'restore_secondary',
        imageBase64: normalizedPersonImageBase64,
        compareImageBase64: imageUrl,
        boxes: poseAnalysis.pose.otherBoxes,
      }, 90000);
      if (restored.ok && restored.imageBase64 && restored.restored > 0) {
        imageUrl = `data:image/png;base64,${restored.imageBase64}`;
        engine = `${engine}+secondary-person-lock`;
      }
    }
    const quality = await validateTryOnResult(normalizedPersonImageBase64, imageUrl, poseAnalysis.pose, clothType, requiresRepose);
    if (!quality.ok) {
      rejectedQuality = quality;
      attempts.push(`FASHN lượt ${generationAttempt + 1} bị quality gate chặn: ${(quality.reasons || []).join(', ')}`);
      const penaltyWeights = {
        main_subject_lost: 100,
        garment_unchanged: 90,
        flat_or_blurred_garment: 60,
        pose_not_corrected: 45,
        secondary_person_changed: 30,
      };
      const penalty = (quality.reasons || []).reduce((sum, reason) => sum + (penaltyWeights[reason] || 20), 0);
      const candidate = { imageUrl, engine, poseTransferred, quality, penalty };
      if (!bestCandidate || candidate.penalty < bestCandidate.penalty) bestCandidate = candidate;
      const hardFailure = (quality.reasons || []).some((reason) => [
        'main_subject_lost', 'garment_unchanged', 'flat_or_blurred_garment', 'pose_not_corrected',
      ].includes(reason));
      if (!hardFailure) {
        // Cảnh báo mềm không được phép biến một ảnh đã tạo thành màn hình lỗi.
        qualityWarning = quality;
        engine = `${engine}+quality-warning`;
        break;
      }
      imageUrl = ''; engine = ''; poseTransferred = false;
    }
  }
  // Sau khi đã tự đổi seed mà vẫn còn cảnh báo cứng, trả ứng viên tốt nhất.
  // Người dùng cần nhìn thấy kết quả để tự quyết định thay vì nhận màn hình rỗng.
  if (!imageUrl && bestCandidate) {
    imageUrl = bestCandidate.imageUrl;
    engine = `${bestCandidate.engine}+best-effort`;
    poseTransferred = bestCandidate.poseTransferred;
    qualityWarning = bestCandidate.quality;
  }
  // CatVTON không biết đổi pose; chỉ thử fallback với ảnh vốn đã có pose tốt.
  if (!imageUrl && !requiresRepose && String(process.env.JAPANO_CATVTON_FALLBACK || '0') === '1') {
    try {
      const catvton = await tryCatvton(normalizedPersonImageBase64, garmentImagePath, product, poseAnalysis.pose.box, poseAnalysis.pose.keypoints, false);
      const quality = await validateTryOnResult(normalizedPersonImageBase64, catvton.image, poseAnalysis.pose, clothType, false);
      if (!quality.ok) {
        rejectedQuality = quality;
        attempts.push(`CatVTON fallback bị chặn: ${(quality.reasons || []).join(', ')}`);
      } else {
        imageUrl = catvton.image;
        engine = 'catvton-quality-fallback';
      }
    } catch (error) { attempts.push(`CatVTON fallback: ${error.message}`); }
  }
  if (!imageUrl) {
    return res.status(503).json({
      ok: false,
      code: 'TRYON_AI_UNAVAILABLE',
      message: 'AI chưa tạo được ảnh thử đồ thật. Vui lòng thử lại; ứng dụng sẽ không dùng ảnh sản phẩm chồng lên ảnh của bạn để giả làm kết quả.',
      attempts,
    });
  }
  let appliedAccessories = [];
  let accessoryWarning = '';
  let accessoryQuality = null;
  if (accessories.length) {
    const cleanTryOnImage = imageUrl;
    const accessoryPayload = accessories.map((item) => ({
      id: item.slug,
      name: item.name,
      kind: accessoryKind(item),
      imagePath: resolveGarmentImage(item.slug),
    })).filter((item) => item.imagePath);
    const composed = await runAccessoryPipeline({
      mode: 'compose',
      imageBase64: imageUrl,
      accessories: accessoryPayload,
    }, 180000);
    if (!composed.ok || !composed.imageBase64 || !composed.applied?.length) {
      accessoryWarning = 'Trang phục đã được thay; phụ kiện chưa ghép được tự nhiên nên ảnh chính vẫn được hiển thị.';
      attempts.push(`Phụ kiện: ${composed.message || 'không có phụ kiện được áp dụng'}`);
    } else {
      appliedAccessories = composed.applied;
      const kinds = appliedAccessories.map((item) => item.kind);
      const roughImage = `data:image/png;base64,${composed.imageBase64}`;
      const roughQuality = await validateAccessoryResult(cleanTryOnImage, roughImage, kinds);
      const candidates = [{ image:roughImage, stage:'accessory-pose-fallback', quality:roughQuality }];
      if (String(process.env.JAPANO_ACCESSORY_REFINE || '1').trim().toLowerCase() !== '0') {
        const refineAttempts = Math.max(1, Math.min(3, Number(process.env.JAPANO_ACCESSORY_REFINE_ATTEMPTS || 2)));
        for (let generationAttempt = 0; generationAttempt < refineAttempts; generationAttempt += 1) {
          try {
            const refined = await tryAccessoryRefine(roughImage, cleanTryOnImage, accessoryPayload, generationAttempt);
            let refinedImage = refined.image;
            if ((poseAnalysis.pose.otherBoxes || []).length) {
              const restored = await runAccessoryPipeline({
                mode:'restore_secondary', imageBase64:cleanTryOnImage,
                compareImageBase64:refinedImage, boxes:poseAnalysis.pose.otherBoxes,
              }, 90000);
              if (restored.ok && restored.imageBase64 && restored.restored > 0) {
                refinedImage = `data:image/png;base64,${restored.imageBase64}`;
              }
            }
            const checked = await validateAccessoryResult(cleanTryOnImage, refinedImage, kinds);
            candidates.push({ image:refinedImage, stage:refined.engine, quality:checked });
            if (checked.ok) break;
            attempts.push(`Làm đẹp phụ kiện lượt ${generationAttempt + 1} chưa đạt: ${(checked.reasons || []).join(', ')}`);
          } catch (error) {
            attempts.push(`Làm đẹp phụ kiện lượt ${generationAttempt + 1}: ${error.message}`);
          }
        }
      }
      const passing = candidates.filter((candidate) => candidate.quality?.ok);
      const pool = passing.length ? passing : candidates;
      pool.sort((a, b) => Number(a.quality?.score ?? 9999) - Number(b.quality?.score ?? 9999));
      const best = pool[0];
      imageUrl = best.image;
      accessoryQuality = best.quality;
      engine = `${engine}+${best.stage}`;
      if (!best.quality?.ok) {
        accessoryWarning = `Đã ghép ${appliedAccessories.map((item) => item.name).join(', ')} bằng ảnh tốt nhất; AI còn cảnh báo: ${accessoryQualityLabels(best.quality?.reasons || ['accessory_quality_unknown']).join(', ')}.`;
      }
    }
  }
  const userId = String(b.userId || 'guest');
  update((next) => {
    const createdAt = Date.now();
    next.tryonHistory.push({ id: `tryon-${createdAt}`, userId, productId: product.slug, accessoryIds, engine, createdAt });
    next.interactions.push({ id: `tryon-i-${createdAt}`, userId, productId: product.slug, type: 'tryon', value: 1, createdAt, source: 'mobile' });
    return next;
  });
  res.json({
    ok: true,
    imageBase64: imageUrl,
    imageUrl,
    engine,
    attempts,
    message: accessoryWarning
      || (appliedAccessories.length
        ? `Đã thay đồ cho một nhân vật chính và dùng FLUX.2 làm đẹp: ${appliedAccessories.map((item) => item.name).join(', ')}.`
        : qualityWarning
          ? (qualityWarning.message || `Đã trả ảnh thử đồ tốt nhất. AI còn cảnh báo: ${(qualityWarning.reasons || []).join(', ')}.`)
          : poseTransferred
        ? 'FLUX.2 đã đưa nhân vật chính về tư thế phù hợp, sau đó FASHN VTON 1.5 mặc trang phục và kiểm tra chất lượng.'
        : 'FASHN VTON 1.5 đã mặc trang phục cho đúng nhân vật chính và kết quả đã qua kiểm tra chất lượng.'),
    recommendedSize: sizeFit.recommended || undefined,
    sizeFit,
    qualityWarning: qualityWarning || undefined,
    accessoryWarning: accessoryWarning || undefined,
    mainSubject: {
      box: poseAnalysis.pose.box,
      confidence: poseAnalysis.pose.confidence,
      poseNormalized: Boolean(poseAnalysis.normalizedImageBase64),
      poseTransferred,
      poseTransferReasons: reposeReasons,
      inferredKeypoints: poseAnalysis.pose.inferredKeypoints || [],
      occluded,
    },
    appliedAccessories,
    accessoryQuality: accessoryQuality || undefined,
  });
});

// Bộ sưu tập Flagcard lịch sử + voucher cá nhân.
api.get('/flagcards/collection/:userId', (req, res) => {
  res.json({ ok: true, ...flagcardCollectionView(read(), String(req.params.userId)) });
});
api.get('/flagcards-program', (req, res) => {
  const state = read();
  ensureFlagcardState(state);
  res.json({ ok: true, config: state.flagcardConfig, cards: state.flagcards });
});
api.post('/flagcards/reconcile', (req, res) => {
  let result;
  const state = update((next) => {
    result = reconcileFlagRewards(next);
    return next;
  });
  res.json({ ok: true, awards: result.awards, collections: state.flagcardCollections, vouchers: state.vouchers.filter((item) => item.source === 'flagcard-collection') });
});
api.post('/flagcards/admin/grant', (req, res) => {
  const userId = String(req.body?.userId || '').trim();
  const cardId = String(req.body?.cardId || '').trim();
  if (!userId || !cardId) return res.status(400).json({ ok: false, message: 'Thiếu userId hoặc cardId.' });
  let view;
  update((state) => {
    ensureFlagcardState(state);
    const card = state.flagcards.find((item) => item.id === cardId && item.active !== false);
    if (!card) return state;
    const collection = getOrCreateCollection(state, userId);
    if (!collection.cardIds.includes(cardId)) {
      const award = { cardId, orderId: null, orderCode: 'ADMIN', orderTotal: 0, awardedAt: Date.now(), source: 'admin-grant' };
      collection.cardIds.push(cardId);
      collection.awards.push(award);
      collection.updatedAt = Date.now();
    }
    ensureRewardVoucher(state, collection);
    view = flagcardCollectionView(state, userId);
    return state;
  });
  if (!view) return res.status(404).json({ ok: false, message: 'Không tìm thấy Flagcard.' });
  res.json({ ok: true, ...view });
});

api.post('/vouchers/validate', (req, res) => {
  const result = validateVoucher(read(), {
    code: req.body?.code,
    userId: req.body?.userId,
    subtotal: req.body?.subtotal,
  });
  res.status(result.ok ? 200 : 400).json(result);
});

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

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function createOrderInState(s, body = {}, options = {}) {
  const b = body || {};
  const now = Date.now();
  const userId = String(b.userId || b.customer?.id || 'guest');
  const items = normalizedOrderItems(s, b.items);
  if (!items.length) throw httpError(400, 'Giỏ hàng không có sản phẩm hợp lệ.');
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const method = String(options.paymentMethod || b.paymentMethod || 'COD');
  const voucherResult = b.voucherCode ? validateVoucher(s, { code: b.voucherCode, userId, subtotal }) : null;
  if (b.voucherCode && !voucherResult?.ok) throw httpError(400, voucherResult?.message || 'Voucher không hợp lệ.');
  const voucherDiscount = Number(voucherResult?.discount || 0);
  const paymentDiscount = /stripe/i.test(method) ? Math.round(subtotal * 0.1) : 0;
  const discount = Math.min(subtotal, voucherDiscount + paymentDiscount);
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
    paymentPromotion: paymentDiscount > 0 ? { code: 'STRIPE10', label: 'Ưu đãi thanh toán thẻ Stripe 10%', percent: 10 } : null,
    discountCode: voucherResult?.voucher?.code || (paymentDiscount > 0 ? 'STRIPE10' : ''),
    total: Math.max(0, subtotal - discount + ship),
    ship,
    payment: {
      method,
      provider: /stripe/i.test(method) ? 'stripe' : 'cod',
      status: String(options.paymentStatus || 'unpaid'),
      txn: String(options.transactionCode || '—'),
      currency: STRIPE_CURRENCY,
    },
    status: String(options.orderStatus || 'pending'),
    createdAt: now,
    history: [{ s: String(options.orderStatus || 'pending'), at: now }],
    source: 'mobile',
  };
  if (voucherResult?.voucher) {
    const voucher = s.vouchers.find((item) => item.code === voucherResult.voucher.code);
    voucher.used = (Number(voucher.used) || 0) + 1;
    const redemption = { id: `redeem-${order.id}`, code: voucher.code, userId, orderId: order.id, discount, redeemedAt: now };
    s.voucherRedemptions.push(redemption);
    order.voucherRedemption = redemption;
  }
  s.orders.push(order);
  s.seeded = true;
  return {
    order,
    flagcardEligibility: {
      qualifiesByAmount: order.total > Number(s.flagcardConfig.qualifyingOrderMin),
      threshold: Number(s.flagcardConfig.qualifyingOrderMin),
      awarded: false,
      pendingSuccessfulPayment: true,
    },
  };
}

function findPayment(state, id) {
  const key = String(id || '');
  return (state.payments || []).find((item) => [item.id, item.code, item.orderId, item.orderCode, item.paymentIntentId, item.checkoutSessionId, item.transactionCode].map(String).includes(key));
}

function findReturnRequest(state, id) {
  const key = String(id || '');
  const requests = state.returnRequests || [];
  const exact = requests.find((item) => [item.id, item.code].map(String).includes(key));
  if (exact) return exact;
  return requests
    .filter((item) => [item.orderId, item.orderCode].map(String).includes(key))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
}

function applyStripeRefundToState(refund) {
  if (!refund?.id) return null;
  let response = null;
  update((state) => {
    const intentId = String(typeof refund.payment_intent === 'object' ? refund.payment_intent?.id : refund.payment_intent || '');
    const payment = findPayment(state, intentId)
      || (state.payments || []).find((item) => (item.refunds || []).some((entry) => entry.id === refund.id));
    if (!payment) return state;
    const now = Date.now();
    const record = {
      id: String(refund.id),
      amount: localStripeAmount(refund.amount, refund.currency || payment.currency),
      currency: String(refund.currency || payment.currency || STRIPE_CURRENCY),
      status: String(refund.status || 'pending'),
      reason: String(refund.reason || 'requested_by_customer'),
      failureReason: String(refund.failure_reason || ''),
      returnRequestId: String(refund.metadata?.returnRequestId || ''),
      createdAt: Number(refund.created || 0) * 1000 || now,
      updatedAt: now,
    };
    payment.refunds ||= [];
    const existingIndex = payment.refunds.findIndex((item) => item.id === record.id);
    if (existingIndex >= 0) payment.refunds[existingIndex] = { ...payment.refunds[existingIndex], ...record };
    else payment.refunds.push(record);
    payment.refundedAmount = payment.refunds
      .filter((item) => item.status === 'succeeded')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    payment.pendingRefundAmount = payment.refunds
      .filter((item) => item.status === 'pending')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const fullyRefunded = payment.refundedAmount >= Number(payment.amount || 0);
    payment.status = payment.pendingRefundAmount > 0
      ? 'refund_pending'
      : fullyRefunded
        ? 'refunded'
        : payment.refundedAmount > 0
          ? 'partially_refunded'
          : 'paid';
    payment.refundId = record.id;
    if (payment.refundedAmount > 0) payment.refundedAt = now;
    payment.updatedAt = now;

    const order = state.orders.find((item) => item.id === payment.orderId);
    if (order) {
      order.payment = {
        ...order.payment,
        status: payment.status,
        refundId: record.id,
        refundedAmount: payment.refundedAmount,
        pendingRefundAmount: payment.pendingRefundAmount,
      };
    }
    const returnRequest = findReturnRequest(state, record.returnRequestId)
      || (state.returnRequests || []).find((item) => item.paymentId === payment.id && item.refundId === record.id);
    if (returnRequest) {
      returnRequest.refundId = record.id;
      returnRequest.refundStatus = record.status;
      returnRequest.updatedAt = now;
      if (record.status === 'pending') returnRequest.status = 'refund_pending';
      else if (record.status === 'failed' || record.status === 'canceled') returnRequest.status = 'refund_failed';
      else if (record.status === 'succeeded') returnRequest.status = 'refunded';
      returnRequest.timeline ||= [];
      if (!returnRequest.timeline.some((item) => item.s === returnRequest.status && item.refundId === record.id)) {
        returnRequest.timeline.push({ s: returnRequest.status, at: now, refundId: record.id });
      }
      if (order) {
        order.returnStatus = returnRequest.status;
        order.returnRequest = { id: returnRequest.id, code: returnRequest.code, status: returnRequest.status };
        if (returnRequest.status === 'refunded' && fullyRefunded) order.status = 'returned';
      }
    } else if (order && fullyRefunded) {
      order.status = order.status === 'completed' ? 'returned' : 'cancelled';
    }
    if (order) {
      order.history ||= [];
      const historyStatus = returnRequest?.status || payment.status;
      if (!order.history.some((item) => item.s === historyStatus && item.refundId === record.id)) {
        order.history.push({ s: historyStatus, at: now, refundId: record.id, amount: record.amount });
      }
    }
    response = { payment, order, refund: record, returnRequest };
    return state;
  });
  return response;
}

function markStripeCheckoutFailed(sessionId, reason = 'payment_failed') {
  let result = null;
  update((state) => {
    const payment = findPayment(state, sessionId);
    if (!payment || payment.status === 'paid' || payment.status === 'refunded') return state;
    payment.status = 'failed';
    payment.failureReason = reason;
    payment.updatedAt = Date.now();
    const order = state.orders.find((item) => item.id === payment.orderId);
    if (order) {
      order.payment.status = 'failed';
      order.history ||= [];
      order.history.push({ s: 'payment_failed', at: Date.now() });
    }
    result = { payment, order };
    return state;
  });
  return result;
}

async function finalizeStripeCheckout(sessionId) {
  if (!stripeEnabled()) throw httpError(503, 'Chế độ thử nghiệm Stripe chưa sẵn sàng.');
  const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
    expand: ['payment_intent.latest_charge'],
  });
  if (!['paid', 'no_payment_required'].includes(String(session.payment_status))) {
    throw httpError(402, `Stripe chưa xác nhận thanh toán. Trạng thái: ${session.payment_status}.`);
  }
  const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const intentId = String(intent?.id || session.payment_intent || '');
  if (!intentId) throw httpError(502, 'Stripe không trả PaymentIntent cho Checkout Session.');
  const charge = intent && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
  let result = null;
  const state = update((next) => {
    const payment = findPayment(next, session.id) || findPayment(next, session.metadata?.orderId);
    const order = next.orders.find((item) => item.id === (payment?.orderId || session.metadata?.orderId));
    if (!payment || !order) return next;
    const now = Date.now();
    const card = charge?.payment_method_details?.card;
    payment.status = 'paid';
    payment.paymentIntentId = intentId;
    payment.transactionCode = intentId;
    payment.checkoutSessionId = session.id;
    payment.amount = localStripeAmount(session.amount_total, session.currency);
    payment.amountSubtotal = localStripeAmount(session.amount_subtotal, session.currency);
    payment.currency = String(session.currency || STRIPE_CURRENCY);
    payment.paidAt ||= now;
    payment.updatedAt = now;
    payment.refundable = true;
    payment.chargeId = String(charge?.id || '');
    payment.receiptUrl = String(charge?.receipt_url || '');
    payment.paymentMethodType = String(charge?.payment_method_details?.type || 'card');
    payment.customer = session.customer_details ? {
      name: String(session.customer_details.name || order.customer?.name || ''),
      email: String(session.customer_details.email || order.customer?.email || ''),
      phone: String(session.customer_details.phone || order.customer?.phone || ''),
      address: session.customer_details.address || null,
    } : payment.customer;
    payment.card = card ? { brand: card.brand, last4: card.last4, funding: card.funding } : payment.card;
    order.payment = {
      ...order.payment,
      method: 'Stripe', provider: 'stripe', status: 'paid', txn: intentId,
      currency: payment.currency, checkoutSessionId: session.id, paymentId: payment.id,
      card: payment.card,
    };
    if (['pending_payment', 'pending'].includes(order.status)) order.status = 'confirmed';
    order.history ||= [];
    if (!order.history.some((item) => item.s === 'paid' && item.txn === intentId)) {
      order.history.push({ s: 'paid', at: now, txn: intentId });
    }
    reconcileFlagRewards(next);
    result = { order, payment };
    return next;
  });
  if (!result) throw httpError(404, 'Không tìm thấy đơn hàng gắn với Stripe Checkout Session.');
  return { ...result, collection: flagcardCollectionView(state, result.order.userId) };
}

function stripeLandingPage({ ok, title, message, orderId = '', status = 'failed' }) {
  const deepLink = `japano://payment-result?orderId=${encodeURIComponent(orderId)}&status=${encodeURIComponent(status)}`;
  const androidIntent = `intent://payment-result?orderId=${encodeURIComponent(orderId)}&status=${encodeURIComponent(status)}#Intent;scheme=japano;package=vn.japano.app;end`;
  const color = ok ? '#15803D' : '#B91C1C';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui;background:#F4EDE1;color:#1A1410;display:grid;place-items:center;min-height:100vh;margin:0}.box{max-width:520px;background:#fff;padding:32px;border-radius:22px;box-shadow:0 20px 50px #0002;text-align:center}.icon{font-size:42px;color:${color}}h1{font-size:24px}p{line-height:1.6;color:#6B625A}a{display:inline-block;margin-top:14px;background:#1A1410;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700}</style></head><body><main class="box"><div class="icon">${ok ? '✓' : '!'}</div><h1>${title}</h1><p>${message}</p><a id="back" href="${deepLink}">Quay lại ứng dụng JAPANO</a></main><script>var target=/Android/i.test(navigator.userAgent)?${JSON.stringify(androidIntent)}:${JSON.stringify(deepLink)};document.getElementById('back').href=target;setTimeout(function(){location.href=target},900)</script></body></html>`;
}

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

api.get('/stripe/config', (req, res) => {
  res.json({
    ok: true,
    enabled: stripeEnabled(),
    mode: stripeEnabled() ? 'test' : 'disabled',
    currency: STRIPE_CURRENCY,
    merchantDisplayName: STRIPE_MERCHANT_DISPLAY_NAME,
    dashboardUrl: 'https://dashboard.stripe.com/test/payments',
  });
});

// Android đôi khi không mở ổn định URL Stripe Checkout rất dài. Ứng dụng chỉ
// cần mở đường dẫn ngắn này; backend lấy URL còn hiệu lực từ Stripe rồi chuyển tiếp.
api.get('/stripe/checkout/open/:sessionId', async (req, res) => {
  if (!stripeEnabled()) return res.status(503).type('text').send('Stripe thử nghiệm chưa được cấu hình.');
  try {
    const session = await stripe.checkout.sessions.retrieve(String(req.params.sessionId || ''));
    if (!session.url || session.status !== 'open') {
      return res.status(410).type('text').send('Phiên thanh toán đã đóng hoặc hết hạn. Vui lòng quay lại ứng dụng để tạo phiên mới.');
    }
    res.redirect(303, session.url);
  } catch (error) {
    res.status(error.statusCode || 404).type('text').send('Không tìm thấy phiên thanh toán Stripe.');
  }
});

function checkoutItemsKey(items = []) {
  return JSON.stringify(items.map((item) => ({
    slug: String(item.slug || item.productId || ''),
    color: String(item.colorName || item.color || ''),
    size: String(item.size || ''),
    qty: Number(item.qty || 0),
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))));
}

api.post('/stripe/checkout-session', async (req, res) => {
  if (!stripeEnabled()) return res.status(503).json({ ok: false, message: 'Chế độ thử nghiệm Stripe chưa được cấu hình.' });
  try {
    const state = read();
    const requestedUserId = String(req.body?.userId || req.body?.customer?.id || '');
    const requestedAddress = String(req.body?.address || '').trim();
    const requestedItemsKey = checkoutItemsKey(req.body?.items || []);
    const reusableOrder = [...(state.orders || [])].reverse().find((item) =>
      item.status === 'pending_payment'
      && String(item.userId || '') === requestedUserId
      && String(item.address || '').trim() === requestedAddress
      && checkoutItemsKey(item.items || []) === requestedItemsKey
      && Date.now() - Number(item.createdAt || 0) < 30 * 60 * 1000);
    const reusablePayment = reusableOrder && findPayment(state, reusableOrder.id);
    if (reusablePayment?.checkoutSessionId && reusablePayment.status === 'pending') {
      const previousSession = await stripe.checkout.sessions.retrieve(reusablePayment.checkoutSessionId);
      if (previousSession.status === 'open' && previousSession.url) {
        const publicBase = `${req.protocol}://${req.get('host')}`;
        return res.json({
          ok: true,
          reused: true,
          url: `${publicBase}/api/stripe/checkout/open/${encodeURIComponent(previousSession.id)}`,
          sessionId: previousSession.id,
          order: reusableOrder,
          payment: reusablePayment,
          mode: 'test',
        });
      }
    }
    const result = createOrderInState(state, req.body || {}, {
      paymentMethod: 'Stripe', paymentStatus: 'pending', orderStatus: 'pending_payment',
    });
    const { order } = result;
    if (order.total <= 0) throw httpError(400, 'Tổng tiền thanh toán phải lớn hơn 0.');
    const payment = {
      id: `pay-${Date.now()}`,
      code: `PAY-${order.code}-${String(Date.now()).slice(-6)}`,
      orderId: order.id,
      orderCode: order.code,
      userId: order.userId,
      provider: 'stripe',
      method: 'Stripe',
      status: 'pending',
      amount: order.total,
      originalAmount: order.subtotal + order.ship,
      discount: order.discount,
      voucherDiscount: order.voucherDiscount,
      paymentDiscount: order.paymentDiscount,
      promotionCode: 'STRIPE10',
      currency: STRIPE_CURRENCY,
      transactionCode: '',
      paymentIntentId: '',
      checkoutSessionId: '',
      refundable: false,
      refunds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const publicBase = `${req.protocol}://${req.get('host')}`;
    const customerEmail = String(req.body?.customer?.email || '').trim();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      locale: 'vi',
      client_reference_id: order.id,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      line_items: [{
        price_data: {
          currency: STRIPE_CURRENCY,
          unit_amount: stripeAmount(order.total),
          product_data: {
            name: `Đơn hàng JAPANO #${order.code}`,
            description: `${order.items.length} dòng sản phẩm · ưu đãi Stripe 10%: -${order.paymentDiscount.toLocaleString('vi-VN')}₫ · tổng giảm: -${order.discount.toLocaleString('vi-VN')}₫ · đã gồm phí vận chuyển`,
            metadata: { orderId: order.id, orderCode: order.code, promotion: 'STRIPE10' },
          },
        },
        quantity: 1,
      }],
      metadata: {
        orderId: order.id, orderCode: order.code, userId: order.userId, paymentId: payment.id,
        paymentCode: payment.code, promotion: 'STRIPE10', discount: String(order.discount),
        customerName: String(order.customer?.name || '').slice(0, 100),
      },
      payment_intent_data: {
        description: `Thanh toán đơn JAPANO #${order.code}`,
        ...(customerEmail ? { receipt_email: customerEmail } : {}),
        metadata: {
          orderId: order.id, orderCode: order.code, userId: order.userId, paymentId: payment.id,
          paymentCode: payment.code, promotion: 'STRIPE10', discount: String(order.discount),
        },
      },
      success_url: `${publicBase}/api/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicBase}/api/stripe/checkout/cancel?orderId=${encodeURIComponent(order.id)}`,
    }, { idempotencyKey: `japano-checkout-${order.id}` });
    payment.checkoutSessionId = session.id;
    payment.updatedAt = Date.now();
    order.payment = { ...order.payment, checkoutSessionId: session.id, paymentId: payment.id };
    state.payments ||= [];
    state.payments.push(payment);
    write(state);
    res.json({
      ok: true, url: `${publicBase}/api/stripe/checkout/open/${encodeURIComponent(session.id)}`, sessionId: session.id, order, payment,
      mode: 'test', flagcardEligibility: result.flagcardEligibility,
    });
  } catch (error) {
    res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không tạo được Stripe Checkout Session.' });
  }
});

api.post('/stripe/checkout/confirm', async (req, res) => {
  try {
    const result = await finalizeStripeCheckout(req.body?.sessionId);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Không xác nhận được thanh toán Stripe.' });
  }
});

api.get('/stripe/checkout/success', async (req, res) => {
  try {
    const result = await finalizeStripeCheckout(req.query.session_id);
    res.type('html').send(stripeLandingPage({
      ok: true,
      title: 'Thanh toán Stripe thành công',
      message: `Đơn #${result.order.code} đã thanh toán. Mã giao dịch: ${result.payment.transactionCode}.`,
      orderId: result.order.id,
      status: 'paid',
    }));
  } catch (error) {
    res.status(error.status || 500).type('html').send(stripeLandingPage({
      ok: false, title: 'Chưa xác nhận được thanh toán', message: error.message || 'Stripe chưa xác nhận giao dịch.', status: 'failed',
    }));
  }
});

api.get('/stripe/checkout/cancel', (req, res) => {
  let result = null;
  update((state) => {
    const order = state.orders.find((item) => item.id === String(req.query.orderId || ''));
    const payment = order ? findPayment(state, order.id) : null;
    if (order && payment && payment.status === 'pending') {
      payment.status = 'cancelled';
      payment.updatedAt = Date.now();
      order.payment.status = 'cancelled';
      order.status = 'cancelled';
      order.history ||= [];
      order.history.push({ s: 'cancelled', at: Date.now() });
    }
    result = { order, payment };
    return state;
  });
  res.type('html').send(stripeLandingPage({
    ok: false,
    title: 'Đã hủy thanh toán Stripe',
    message: 'Không có khoản tiền nào bị trừ. Bạn có thể quay lại giỏ hàng và thử lại.',
    orderId: result?.order?.id || String(req.query.orderId || ''),
    status: 'cancelled',
  }));
});

api.get('/payments/:id', (req, res) => {
  const state = read();
  const payment = findPayment(state, req.params.id);
  if (!payment) return res.status(404).json({ ok: false, message: 'Không tìm thấy giao dịch.' });
  const order = state.orders.find((item) => item.id === payment.orderId) || null;
  res.json({ ok: true, payment, order });
});

api.post('/stripe/reconcile', async (req, res) => {
  if (!stripeEnabled()) return res.status(503).json({ ok: false, message: 'Chế độ thử nghiệm Stripe chưa sẵn sàng.' });
  const snapshot = read();
  const candidates = (snapshot.payments || [])
    .filter((payment) => payment.provider === 'stripe' && (
      (payment.status === 'pending' && payment.checkoutSessionId)
      || payment.status === 'refund_pending'
    ))
    .slice(0, 30);
  const results = [];
  for (const payment of candidates) {
    try {
      if (payment.status === 'pending' && payment.checkoutSessionId) {
        const session = await stripe.checkout.sessions.retrieve(payment.checkoutSessionId);
        if (['paid', 'no_payment_required'].includes(String(session.payment_status))) {
          const finalized = await finalizeStripeCheckout(session.id);
          results.push({ paymentId: payment.id, status: finalized.payment.status });
        } else if (session.status === 'expired') {
          const failed = markStripeCheckoutFailed(session.id, 'checkout_expired');
          results.push({ paymentId: payment.id, status: failed?.payment?.status || 'failed' });
        }
      }
      if (payment.status === 'refund_pending' && payment.paymentIntentId) {
        const refunds = await stripe.refunds.list({ payment_intent: payment.paymentIntentId, limit: 25 });
        for (const refund of refunds.data) applyStripeRefundToState(refund);
        results.push({ paymentId: payment.id, status: findPayment(read(), payment.id)?.status || payment.status });
      }
    } catch (error) {
      results.push({ paymentId: payment.id, status: 'sync_error', message: error.message });
    }
  }
  res.json({ ok: true, checked: candidates.length, results });
});

async function issueStripeRefund(paymentId, body = {}) {
  if (!stripeEnabled()) throw httpError(503, 'Chế độ thử nghiệm Stripe chưa sẵn sàng.');
  const snapshot = read();
  const payment = findPayment(snapshot, paymentId);
  if (!payment) throw httpError(404, 'Không tìm thấy giao dịch.');
  if (!payment.refundable || !String(payment.paymentIntentId || '').startsWith('pi_') || String(payment.paymentIntentId).startsWith('pi_seed_')) {
    throw httpError(400, 'Giao dịch mẫu này không tồn tại trên Stripe nên không thể hoàn tiền qua API.');
  }
  if (!['paid', 'partially_refunded'].includes(payment.status)) {
    throw httpError(400, `Giao dịch ở trạng thái ${payment.status}, không thể hoàn tiền.`);
  }
  const alreadyRefunded = Number(payment.refundedAmount || 0) + Number(payment.pendingRefundAmount || 0);
  const remaining = Math.max(0, Number(payment.amount || 0) - alreadyRefunded);
  const requested = body?.amount === undefined || body?.amount === null || body?.amount === ''
    ? remaining
    : Math.min(remaining, Math.max(1, Number(body.amount)));
  if (requested <= 0) throw httpError(400, 'Giao dịch đã được hoàn hoặc đang chờ hoàn đủ tiền.');
  const returnRequestId = String(body.returnRequestId || '');
  const refund = await stripe.refunds.create({
    payment_intent: payment.paymentIntentId,
    amount: stripeAmount(requested, payment.currency),
    reason: 'requested_by_customer',
    metadata: {
      orderId: payment.orderId,
      paymentId: payment.id,
      returnRequestId,
      returnCode: String(body.returnCode || ''),
      source: returnRequestId ? 'japano-return-admin-test' : 'japano-admin-test',
    },
  }, { idempotencyKey: `japano-refund-${payment.id}-${returnRequestId || 'direct'}-${stripeAmount(alreadyRefunded + requested, payment.currency)}` });
  const response = applyStripeRefundToState(refund);
  if (!response) throw httpError(500, 'Stripe đã tạo refund nhưng database chưa tìm thấy giao dịch để đồng bộ.');
  return response;
}

api.post('/payments/:id/refund', async (req, res) => {
  try {
    const response = await issueStripeRefund(req.params.id, req.body || {});
    res.json({ ok: true, ...response });
  } catch (error) {
    res.status(error.status || error.statusCode || 500).json({ ok: false, message: error.message || 'Stripe không hoàn tiền được.' });
  }
});

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
      if (!payment || payment.provider !== 'stripe' || !['paid', 'partially_refunded'].includes(payment.status)) {
        throw httpError(400, 'Đơn phải được thanh toán thành công bằng Stripe mới có thể hoàn về thẻ.');
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
      const response = await issueStripeRefund(returnRequest.paymentId, {
        amount: returnRequest.amount,
        returnRequestId: returnRequest.id,
        returnCode: returnRequest.code,
      });
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
    if (req.body?.status) {
      order.status = String(req.body.status);
      if (order.status === 'completed') order.completedAt ||= Date.now();
      order.history ||= [];
      order.history.push({ s: order.status, at: Date.now() });
    }
    if (req.body?.paymentStatus) order.payment.status = String(req.body.paymentStatus);
    if (order.status === 'completed' && order.payment.method === 'COD') order.payment.status = 'paid';
    const reconciled = reconcileFlagRewards(next);
    response = { order, award: reconciled.awards.find((item) => item.orderId === order.id) || order.flagcardAward || null };
    return next;
  });
  if (!response) return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
  res.json({ ok: true, ...response, collection: flagcardCollectionView(state, response.order.userId) });
});

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
