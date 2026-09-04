const test = require('node:test');
const assert = require('node:assert/strict');

const registerReviewRoutes = require('../routes/reviews');
const { reviewPurchaseSlots } = require('../routes/reviews');
const { httpError } = require('../lib/httpError');

function completedOrder(id, createdAt) {
  return {
    id,
    code: id.toUpperCase(),
    userId: 'u-repeat',
    status: 'completed',
    createdAt,
    customer: { id: 'u-repeat', name: 'Khách mua lại' },
    items: [{ slug: 'ao-lap-lai', name: 'Áo mua lại', qty: 1 }],
  };
}

function baseState() {
  return {
    products: [{ id: 'p-repeat', slug: 'ao-lap-lai', name: 'Áo mua lại' }],
    orders: [completedOrder('order-old', 1000), completedOrder('order-new', 2000)],
    reviews: [{
      id: 'review-old', productId: 'ao-lap-lai', userId: 'u-repeat', userName: 'Khách mua lại',
      orderId: 'order-old', orderCode: 'ORDER-OLD', rating: 4, comment: 'Lần đầu dùng tốt.',
      status: 'approved', createdAt: 1500, updatedAt: 1500,
    }],
    reviewReactions: [],
    moderationSamples: [],
  };
}

function makeHarness() {
  let state = baseState();
  const routes = { get: new Map(), post: new Map(), patch: new Map() };
  const api = {
    get: (path, ...handlers) => routes.get.set(path, handlers.at(-1)),
    post: (path, ...handlers) => routes.post.set(path, handlers.at(-1)),
    patch: (path, ...handlers) => routes.patch.set(path, handlers.at(-1)),
  };
  registerReviewRoutes(api, {
    read: () => state,
    update: (mutate) => { state = mutate(state) || state; },
    httpError,
    moderateReview: async (comment) => ({ decision: 'approved', score: 0, local: { normalized: comment } }),
    REVIEW_MODERATION_MODEL: 'test-model',
    uploadReviewMedia: async () => null,
    requireAdmin: (_req, _res, next) => next(),
  });
  return { routes, getState: () => state };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('mỗi đơn mua lại đã hoàn tất tạo thêm một suất đánh giá', () => {
  const slots = reviewPurchaseSlots(baseState(), 'u-repeat', 'ao-lap-lai');
  assert.deepEqual(slots.orders.map((order) => order.id), ['order-old', 'order-new']);
  assert.deepEqual(slots.availableOrders.map((order) => order.id), ['order-new']);
  assert.deepEqual([...slots.reviewedOrderIds], ['order-old']);
});

test('API cho đánh giá lần mua mới nhưng chặn gửi hai lần trên cùng đơn', async () => {
  const { routes, getState } = makeHarness();
  const getReviews = routes.get.get('/products/:slug/reviews');
  const createReview = routes.post.get('/products/:slug/reviews');

  const before = response();
  getReviews({ params: { slug: 'ao-lap-lai' }, query: { userId: 'u-repeat' } }, before);
  assert.equal(before.statusCode, 200);
  assert.equal(before.body.eligibility.canReview, true);
  assert.deepEqual(before.body.eligibility.reviewedOrderIds, ['order-old']);
  assert.deepEqual(before.body.eligibility.eligibleOrderIds, ['order-new']);

  const created = response();
  await createReview({
    params: { slug: 'ao-lap-lai' },
    body: { userId: 'u-repeat', userName: 'Khách mua lại', orderId: 'order-new', rating: 5, comment: 'Mua lần hai vẫn rất tốt.' },
  }, created);
  assert.equal(created.statusCode, 201);
  assert.equal(getState().reviews.length, 2);
  assert.equal(getState().reviews.at(-1).orderId, 'order-new');

  const duplicate = response();
  await createReview({
    params: { slug: 'ao-lap-lai' },
    body: { userId: 'u-repeat', orderId: 'order-new', rating: 5, comment: 'Gửi lại lần nữa.' },
  }, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.match(duplicate.body.message, /Lần mua này đã được đánh giá/);
  assert.equal(getState().reviews.length, 2);
});

test('review cũ thiếu orderId chỉ dùng một suất cũ, không khoá lần mua lại', () => {
  const state = baseState();
  delete state.reviews[0].orderId;
  const slots = reviewPurchaseSlots(state, 'u-repeat', 'ao-lap-lai');
  assert.deepEqual([...slots.reviewedOrderIds], ['order-old']);
  assert.deepEqual(slots.availableOrders.map((order) => order.id), ['order-new']);
});

