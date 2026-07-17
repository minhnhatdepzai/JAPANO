const test = require('node:test');
const assert = require('node:assert/strict');

const { emptyState, seededState } = require('../seed');
const {
  buildAnalytics,
  buildDemandAndTrends,
  buildMarketBasketRules,
} = require('../lib/analytics');
const {
  getHomeRecommendations,
  getRelatedProducts,
  invalidateCache,
} = require('../lib/recommend');
const { fallbackProductDescription } = require('../lib/productVision');
const { accessoryKind } = require('../lib/accessory');
const { ensureFlagcardState, reconcileFlagRewards, flagcardCollectionView, validateVoucher } = require('../lib/flagcards');
const { localModeration } = require('../lib/reviewModeration');
const { buildGoalPlan } = require('../lib/goals');

const FIXED_NOW = '2026-07-11T00:00:00+07:00';

test('analytics trả đủ chuỗi thời gian và ba model dự báo hữu hạn', () => {
  const analytics = buildAnalytics(seededState(), { now: FIXED_NOW });

  assert.equal(analytics.revenueByPeriod.day.length, 7);
  assert.equal(analytics.revenueByPeriod.week.length, 8);
  assert.equal(analytics.revenueByPeriod.month.length, 12);
  assert.equal(analytics.revenueByPeriod.year.length, 5);
  assert.equal(analytics.revenueForecast.history.length, 12);
  assert.equal(analytics.revenueForecast.forecast.length, 3);
  assert.equal(analytics.revenueForecast.models.length, 3);

  for (const point of analytics.revenueForecast.forecast) {
    assert.ok(Number.isFinite(point.value));
    assert.ok(Number.isFinite(point.low));
    assert.ok(Number.isFinite(point.high));
    assert.ok(point.low <= point.value && point.value <= point.high);
  }

  const modelNames = new Set(analytics.models.map((model) => model.name));
  assert.ok(modelNames.has('Revenue Ensemble'));
  assert.ok(modelNames.has('Holt Double Exponential Smoothing'));
  assert.ok(modelNames.has('RFM Churn Propensity'));
  assert.ok(modelNames.has('Market Basket'));
  assert.ok(analytics.predictions.length > 0);
  assert.ok(analytics.churnRisks.length > 0);
  assert.ok(analytics.marketBasketRules.length > 0);
});

test('wishlist bị xoá không còn được tính là tín hiệu nhu cầu', () => {
  const state = {
    products: [{
      id: 'p1',
      slug: 'test-product',
      name: 'Test product',
      price: 100000,
      rating: 4,
      sold: 0,
      createdAt: Date.now(),
      variants: [{ stock: 10 }],
    }],
    interactions: [
      { userId: 'u1', productId: 'test-product', type: 'wishlist', value: 1, createdAt: 1 },
      { userId: 'u1', productId: 'test-product', type: 'wishlist', value: 0, createdAt: 2 },
    ],
    chats: [],
  };

  const demand = buildDemandAndTrends(state, []);
  assert.equal(demand.predictions[0].features.wishlist, 0);
});

test('market basket tính support, confidence và lift cho cặp mua lặp lại', () => {
  const orders = [1, 2, 3].map((id) => ({
    id,
    status: 'completed',
    items: [{ productId: 'kimono-hong' }, { productId: 'guoc-geta' }],
  }));
  orders.push({
    id: 4,
    status: 'completed',
    items: [{ productId: 'kimono-hong' }, { productId: 'kep-no' }],
  });

  const rules = buildMarketBasketRules(orders);
  const rule = rules.find((item) => item.antecedent === 'kimono-hong' && item.consequent === 'guoc-geta');
  assert.ok(rule);
  assert.equal(rule.count, 3);
  assert.equal(rule.support, 0.75);
  assert.equal(rule.confidence, 0.75);
  assert.equal(rule.lift, 1);
});

test('hybrid recommender chỉ trả slug hợp lệ, không trùng và có model provenance', () => {
  const state = seededState();
  const knownSlugs = new Set(state.products.map((product) => product.slug));
  invalidateCache();

  const result = getHomeRecommendations(state, { userId: 'u1', limit: 8 });
  assert.equal(result.items.length, 8);
  assert.equal(new Set(result.items).size, result.items.length);
  result.items.forEach((slug) => assert.ok(knownSlugs.has(slug)));
  assert.ok(result.models.includes('matrix-factorization-sgd'));
  assert.ok(result.models.includes('association-rules'));
  assert.equal(result.modelStatus.matrixFactorizationActive, true);
  assert.ok(result.learnedFrom.includes('tìm kiếm'));

  const related = getRelatedProducts(state, 'kimono-hong', 6);
  assert.equal(new Set(related).size, related.length);
  assert.ok(!related.includes('kimono-hong'));
  related.forEach((slug) => assert.ok(knownSlugs.has(slug)));
});

test('tín hiệu tìm kiếm và thử đồ được đưa vào phân tích nhu cầu và sức khỏe mô hình gợi ý', () => {
  const state = seededState();
  state.interactions.push(
    { id:'search-live', userId:'khach-live', productId:'yukata-xanh', type:'search', value:1, createdAt:Date.now(), source:'mobile', metadata:{query:'yukata xanh'} },
    { id:'tryon-live', userId:'khach-live', productId:'yukata-xanh', type:'tryon', value:1, createdAt:Date.now(), source:'mobile' },
  );
  const analytics = buildAnalytics(state, { now: FIXED_NOW });
  const product = analytics.predictions.find((item) => item.productId === 'yukata-xanh');
  assert.ok(product.features.searches >= 1);
  assert.ok(product.features.tryons >= 1);
  assert.ok(analytics.recommendationHealth.typeCounts.search >= 1);
  assert.equal(analytics.recommendationHealth.active, true);
});

test('mô tả ảnh fallback luôn bám đúng tên sản phẩm và không bịa chất liệu', () => {
  const product = seededState().products.find((item) => item.slug === 'kimono-hong');
  const result = fallbackProductDescription(product);
  assert.match(result.headline, /Kimono truyền thống Hồng/);
  assert.match(result.details.join(' '), /Kimono truyền thống Hồng/);
  assert.equal(result.engine, 'catalog-grounded-fallback');
  assert.match(result.confidence, /không suy đoán chất liệu/i);
});

test('mục tiêu kết hợp quỹ mua sắm và lộ trình giảm cân có giới hạn an toàn', () => {
  const product = seededState().products.find((item) => item.slug === 'haori-dang-dai');
  const plan = buildGoalPlan({
    age: 25, heightCm: 165, currentWeightKg: 65, targetWeightKg: 60,
    monthlyIncome: 15000000, fixedExpenses: 11000000, currentSavings: 200000, targetMonths: 6,
  }, product);
  assert.ok(plan.saving.monthlySaving > 0);
  assert.ok(plan.saving.monthlySaving <= plan.saving.disposableIncome * 0.4);
  assert.equal(plan.wellness.weeklyRateKg, 0.5);
  assert.equal(plan.wellness.activityMinutesPerWeek, 150);
  assert.match(plan.disclaimer, /không thay thế/i);

  const minor = buildGoalPlan({ age: 16, heightCm: 165, currentWeightKg: 65, targetWeightKg: 55 }, product);
  assert.equal(minor.wellness.status, 'needs-professional-guidance');
  assert.equal(minor.wellness.weeklyRateKg, null);
});

test('phụ kiện nón và ô được định tuyến tới đúng điểm neo pose', () => {
  assert.equal(accessoryKind({ name: 'Mũ bo Nhật', slug: 'mu-nhat', tags: ['mũ'] }), 'hat');
  assert.equal(accessoryKind({ name: 'Dù Nhật bản', slug: 'du-nhat', tags: ['dù'] }), 'umbrella');
});

test('Flagcard chỉ cấp một lần cho đơn thành công trên 5 triệu', () => {
  const state = emptyState();
  ensureFlagcardState(state);
  state.orders = [
    { id: 'small', code: 'SMALL', userId: 'u-flag', total: 5_000_000, status: 'completed', payment: { status: 'paid' } },
    { id: 'eligible', code: 'BIG', userId: 'u-flag', total: 5_000_001, status: 'completed', payment: { status: 'paid' } },
  ];
  reconcileFlagRewards(state, 1000);
  reconcileFlagRewards(state, 2000);
  const view = flagcardCollectionView(state, 'u-flag');
  assert.equal(view.progress.owned, 1);
  assert.equal(state.orders[0].flagcardAward, undefined);
  assert.ok(state.orders[1].flagcardAward?.cardId);
  assert.equal(view.collection.awards.length, 1);
});

test('đủ 7 Flagcard cấp đúng một voucher cá nhân 50% toàn sản phẩm', () => {
  const state = emptyState();
  ensureFlagcardState(state);
  const now = Date.now();
  state.orders = Array.from({ length: 7 }, (_, index) => ({
    id: `flag-order-${index}`, code: `FLAG${index}`, userId: 'collector', total: 6_000_000,
    status: 'completed', payment: { status: 'paid' }, createdAt: index + 1,
  }));
  reconcileFlagRewards(state, now);
  reconcileFlagRewards(state, now + 1_000);
  const view = flagcardCollectionView(state, 'collector');
  assert.equal(view.progress.owned, 7);
  assert.equal(view.progress.completed, true);
  assert.equal(view.rewardVoucher.value, 50);
  assert.equal(view.rewardVoucher.ownerUserId, 'collector');
  assert.equal(view.rewardVoucher.appliesTo, 'all-products');
  assert.equal(state.vouchers.filter((item) => item.source === 'flagcard-collection').length, 1);
  assert.equal(validateVoucher(state, { code: view.rewardVoucher.code, userId: 'other', subtotal: 1_000_000 }).ok, false);
  assert.equal(validateVoucher(state, { code: view.rewardVoucher.code, userId: 'collector', subtotal: 1_000_000 }).discount, 500_000);
});

test('kiểm duyệt chặn câu công kích cố tình chen ký tự và bỏ dấu', () => {
  const result = localModeration('d.m.m chủ sh0p, đồ ng.u ng0c!');
  assert.equal(result.decision, 'rejected');
  assert.ok(result.categories.includes('công kích') || result.categories.includes('tục tĩu'));
});

test('kiểm duyệt không chặn phê bình sản phẩm trung thực', () => {
  const result = localModeration('Vải mỏng hơn mô tả, giao chậm hai ngày và tôi không hài lòng.');
  assert.equal(result.decision, 'approved');
});

test('danh mục địa chỉ có đủ 34 tỉnh và 3321 phường xã', () => {
  const units = require('../data/vietnam-administrative-units.json');
  assert.equal(units.length, 34);
  assert.equal(units.reduce((sum, province) => sum + province.Wards.length, 0), 3321);
  assert.ok(units.every((province) => province.Code && province.FullName && province.Wards.every((ward) => ward.Code && ward.FullName && ward.ProvinceCode === province.Code)));
});
