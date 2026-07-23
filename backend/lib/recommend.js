const {
  finiteNumber,
  productId: pid,
  itemProductId,
  isSuccessfulOrder,
  mlMatrixFactorization,
  buildDemandAndTrends,
  buildMarketBasketRules,
} = require('./analytics');
const { buildAdvancedModel, scoreAdvanced } = require('./advancedRecommend');

// Trọng số phản ánh mức độ chủ ý: tìm kiếm mạnh hơn lượt xem nhưng nhẹ hơn
// yêu thích/thử đồ; mua hàng là tín hiệu xác nhận mạnh nhất.
const TYPE_WEIGHT = { view: 1, search: 2, wishlist: 3, cart: 4, tryon: 3.5, chat: 2.5, goal: 2.5, purchase: 6 };
const HALF_LIFE_DAYS = 14; // hành vi gần đây ảnh hưởng mạnh hơn, giống re-ranking real-time của TikTok
const CACHE_TTL_MS = 60000;
const NEIGHBOR_LIMIT = 12;
const CATEGORY_CAP = 2;

let cache = new WeakMap();

function decay(weight, ageDays) {
  return weight * Math.pow(0.5, Math.max(0, ageDays) / HALF_LIFE_DAYS);
}

function tokenize(value) {
  return String(value || '').trim().toLowerCase();
}

function toTokenMap(pairs) {
  const map = new Map();
  pairs.forEach(([token, weight]) => { if (token) map.set(token, (map.get(token) || 0) + weight); });
  return map;
}

function cosineMaps(a, b) {
  if (!a || !b || !a.size || !b.size) return 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  small.forEach((weight, token) => { const other = large.get(token); if (other) dot += weight * other; });
  if (!dot) return 0;
  let normA = 0; a.forEach((w) => { normA += w * w; });
  let normB = 0; b.forEach((w) => { normB += w * w; });
  return dot / Math.sqrt(normA * normB);
}

function priceBucket(price, sortedPrices) {
  if (!sortedPrices.length) return 'gia:vua';
  const rank = sortedPrices.filter((p) => p <= price).length / sortedPrices.length;
  if (rank <= 0.25) return 'gia:thap';
  if (rank <= 0.6) return 'gia:vua';
  if (rank <= 0.85) return 'gia:cao';
  return 'gia:premium';
}

function productTokenMap(product, sortedPrices) {
  const pairs = [];
  new Set([...(product.tags || []), ...(product.visualTags || [])]).forEach((t) => pairs.push([`tag:${tokenize(t)}`, 2]));
  const cat = product.cat || product.category;
  if (cat) pairs.push([`cat:${tokenize(cat)}`, 1.5]);
  pairs.push([priceBucket(finiteNumber(product.price, 0), sortedPrices), 0.5]);
  return toTokenMap(pairs);
}

function profileTokenPairs(profile) {
  if (!profile) return [];
  const phrases = [...(Array.isArray(profile.preferredStyles) ? profile.preferredStyles : []), profile.occasion].filter(Boolean);
  const pairs = [];
  phrases.forEach((phrase) => String(phrase).split(/[\/,]+/).forEach((part) => {
    const token = tokenize(part);
    if (!token) return;
    pairs.push([`tag:${token}`, 1.5]);
    // khớp thêm theo từng từ để bắt các nhãn nhiều-từ không trùng khít với tag catalog (vd "nhật cổ" -> "nhật")
    token.split(/\s+/).forEach((word) => { if (word.length >= 3) pairs.push([`tag:${word}`, 1]); });
  }));
  return pairs;
}

function dateAgeDays(timestamp, now) {
  const numeric = Number(timestamp);
  const parsed = Number.isFinite(numeric) && numeric > 0 ? numeric : Date.parse(timestamp);
  const t = Number.isFinite(parsed) ? parsed : now;
  return (now - t) / 86400000;
}

function timestampMs(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecommendableProduct(product) {
  const status = String(product?.status || '').toLowerCase();
  if (['archived', 'hidden', 'draft', 'out'].includes(status)) return false;
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length && variants.reduce((sum, variant) => sum + Math.max(0, finiteNumber(variant.stock, 0)), 0) <= 0) return false;
  return true;
}

function build(state, now = Date.now()) {
  const products = (state.products || []).filter(isRecommendableProduct);
  const itemIndex = new Map(products.map((p, i) => [pid(p), i]));
  const nItems = products.length;
  const sortedPrices = products.map((p) => finiteNumber(p.price, 0)).sort((a, b) => a - b);

  const successfulOrders = (state.orders || []).filter(isSuccessfulOrder);
  const events = [];
  const negativeEvents = [];
  const stateful = new Map();
  const interactionRows = [];
  (state.interactions || []).forEach((row) => {
    const type = String(row.type || '').toLowerCase();
    if (['wishlist', 'cart'].includes(type)) {
      const key = `${row.userId || 'guest'}|${itemProductId(row)}|${type}`;
      const previous = stateful.get(key);
      if (!previous || finiteNumber(row.createdAt, 0) >= finiteNumber(previous.createdAt, 0)) stateful.set(key, row);
    } else interactionRows.push(row);
  });
  [...interactionRows, ...stateful.values()].forEach((row) => {
    const productSlug = itemProductId(row);
    const weight = TYPE_WEIGHT[String(row.type || '').toLowerCase()];
    if (!weight || !itemIndex.has(productSlug) || !row.userId) return;
    const value = row.value == null ? 1 : Math.max(0, finiteNumber(row.value, 0));
    if (value <= 0) {
      negativeEvents.push({ userId: String(row.userId), productSlug, at: row.createdAt || now, type: String(row.type || '') });
      return;
    }
    events.push({ userId: String(row.userId), productSlug, weight: weight * Math.min(5, value), at: row.createdAt || now });
  });
  successfulOrders.forEach((order) => {
    const userId = String(order.userId || order.customer?.id || '');
    if (!userId) return;
    (order.items || []).forEach((item) => {
      const productSlug = itemProductId(item);
      if (!itemIndex.has(productSlug)) return;
      events.push({ userId, productSlug, weight: TYPE_WEIGHT.purchase, at: order.createdAt || now });
    });
  });

  const userIds = [...new Set(events.map((e) => e.userId))];
  const userIndex = new Map(userIds.map((u, i) => [u, i]));
  const itemVectors = Array.from({ length: nItems }, () => new Map());
  const userRecent = new Map();
  const userNegatives = new Map();
  negativeEvents.forEach((event) => {
    const rows = userNegatives.get(event.userId) || new Map();
    const previous = rows.get(event.productSlug);
    if (!previous || timestampMs(event.at, now) > timestampMs(previous.at, now)) rows.set(event.productSlug, event);
    userNegatives.set(event.userId, rows);
  });
  events.forEach(({ userId, productSlug, weight, at }) => {
    const ui = userIndex.get(userId);
    const ii = itemIndex.get(productSlug);
    const decayed = decay(weight, dateAgeDays(at, now));
    itemVectors[ii].set(ui, (itemVectors[ii].get(ui) || 0) + decayed);
    const list = userRecent.get(userId) || [];
    list.push({ productSlug, weight: decayed, at: timestampMs(at, now) });
    userRecent.set(userId, list);
  });

  const triples = [];
  itemVectors.forEach((vec, ii) => vec.forEach((weight, ui) => triples.push([ui, ii, weight])));

  const norms = itemVectors.map((vec) => Math.sqrt([...vec.values()].reduce((s, v) => s + v * v, 0)) || 1);
  const itemSim = new Map();
  for (let a = 0; a < nItems; a += 1) {
    const sims = [];
    for (let b = 0; b < nItems; b += 1) {
      if (a === b || !itemVectors[a].size || !itemVectors[b].size) continue;
      const [small, large] = itemVectors[a].size < itemVectors[b].size ? [itemVectors[a], itemVectors[b]] : [itemVectors[b], itemVectors[a]];
      let dot = 0; small.forEach((v, u) => { const o = large.get(u); if (o) dot += v * o; });
      if (dot > 0) sims.push([b, dot / (norms[a] * norms[b])]);
    }
    sims.sort((x, y) => y[1] - x[1]);
    itemSim.set(pid(products[a]), sims.slice(0, NEIGHBOR_LIMIT).map(([b, score]) => ({ slug: pid(products[b]), score })));
  }

  let mf = null;
  if (userIds.length >= 2 && triples.length >= 4) {
    const model = mlMatrixFactorization(triples, userIds.length, nItems, 8, 25);
    mf = { ...model, userIndex, itemIndex };
  }

  const demand = buildDemandAndTrends(state, successfulOrders);
  const trendingByProduct = new Map(demand.predictions.map((p) => [p.productId, p.score / 100]));

  const contentVectors = new Map(products.map((p) => [pid(p), productTokenMap(p, sortedPrices)]));
  const marketBasketRules = buildMarketBasketRules(successfulOrders, 100);
  const basketByAntecedent = new Map();
  marketBasketRules.forEach((rule) => {
    const rows = basketByAntecedent.get(rule.antecedent) || [];
    rows.push(rule);
    basketByAntecedent.set(rule.antecedent, rows);
  });
  const advanced = buildAdvancedModel({ products, events: events.map((event) => ({
    ...event,
    at: timestampMs(event.at, now),
  })), now });

  return {
    products, itemIndex, itemSim, mf, userIndex, userRecent, userNegatives,
    trendingByProduct, predictions: demand.predictions, categoryTrends: demand.categoryTrends,
    contentVectors,
    marketBasketRules,
    basketByAntecedent,
    advanced,
    categoryLabel: new Map((state.categories || []).map((c) => [c.id, c.name])),
    generatedAt: now,
    trainingStats: {
      users: userIds.length,
      events: events.length,
      products: nItems,
      matrixFactorizationActive: Boolean(mf),
      itemCollaborativeFilteringActive: [...itemSim.values()].some((neighbors) => neighbors.length > 0),
      contentModelActive: contentVectors.size > 0,
      marketBasketRules: marketBasketRules.length,
      selectiveSsmActive: advanced.sequences.size > 0,
      lightGcnActive: advanced.graph.edges > 0,
      autoregressiveNextItemActive: advanced.transitions.count > 0,
      pairwiseRankerActive: advanced.diagnostics.rankerTrained,
      negativeFeedbackEvents: negativeEvents.length,
      ...advanced.diagnostics,
    },
  };
}

function getCached(state) {
  const now = Date.now();
  const cached = state && typeof state === 'object' ? cache.get(state) : null;
  if (cached?.data && now - cached.at < CACHE_TTL_MS) return cached.data;
  const data = build(state, now);
  if (state && typeof state === 'object') cache.set(state, { at: now, data });
  return data;
}

// Gọi sau khi ghi interactions/orders/profiles/products mới để engine phản ánh ngay, không đợi hết TTL.
function invalidateCache() {
  cache = new WeakMap();
}

function userContentVector(reco, userId, profile) {
  const pairs = [];
  (reco.userRecent.get(String(userId)) || []).forEach(({ productSlug, weight }) => {
    const vec = reco.contentVectors.get(productSlug);
    if (vec) vec.forEach((w, token) => pairs.push([token, w * weight]));
  });
  profileTokenPairs(profile).forEach(([token, weight]) => pairs.push([token, weight]));
  return toTokenMap(pairs);
}

function pickWeights(interactionCount, hasContentSignal) {
  if (interactionCount >= 3) return { mf: 0.09, cf: 0.07, basket: 0.07, content: 0.07, trending: 0.06, sequence: 0.15, graph: 0.12, transition: 0.14, rank: 0.23 };
  if (interactionCount >= 1) return { mf: 0.04, cf: 0.08, basket: 0.08, content: 0.09, trending: 0.11, sequence: 0.15, graph: 0.1, transition: 0.12, rank: 0.23 };
  return hasContentSignal
    ? { mf: 0, cf: 0, basket: 0, content: 0.3, trending: 0.45, sequence: 0, graph: 0, transition: 0, rank: 0.25 }
    : { mf: 0, cf: 0, basket: 0, content: 0, trending: 0.7, sequence: 0, graph: 0, transition: 0, rank: 0.3 };
}

function normalize(values) {
  const nums = [...values.values()];
  const max = Math.max(0, ...nums);
  const min = Math.min(0, ...nums);
  const range = max - min || 1;
  const out = new Map();
  values.forEach((v, k) => out.set(k, (v - min) / range));
  return out;
}

function logit(probability) {
  const value = Math.min(0.999999, Math.max(0.000001, finiteNumber(probability, 0.5)));
  return Math.log(value / (1 - value));
}

function categoryOf(reco, slug) {
  const product = reco.products.find((p) => pid(p) === slug);
  return product ? String(product.cat || product.category || 'general') : 'general';
}

function reasonFor(reco, slug, contributions, exploring) {
  if (exploring) return 'Gợi ý khám phá — có thể bạn sẽ thích thử';
  const cat = categoryOf(reco, slug);
  const catLabel = reco.categoryLabel.get(cat) || cat;
  const entries = Object.entries(contributions).sort((a, b) => b[1] - a[1]);
  const top = entries[0]?.[0];
  if (top === 'mf' || top === 'cf') return `Vì bạn đã quan tâm các mẫu ${catLabel}`;
  if (top === 'basket') return 'Thường được mua/phối cùng món bạn đã quan tâm';
  if (top === 'content') return `Hợp phong cách bạn đã chọn`;
  if (top === 'sequence') return 'Phù hợp với chuỗi quan tâm gần đây của bạn';
  if (top === 'graph') return 'Được cộng đồng có sở thích tương tự quan tâm';
  if (top === 'transition') return 'Thường là lựa chọn tiếp theo trong hành trình mua sắm tương tự';
  if (top === 'rank') return 'Mô hình xếp hạng dự đoán bạn có thể quan tâm';
  return `Đang là xu hướng trong danh mục ${catLabel}`;
}

function scoreCandidates(reco, userId, profile) {
  const interactions = reco.userRecent.get(String(userId)) || [];
  const recentDistinct = [...new Map(interactions.slice().reverse().map((e) => [e.productSlug, e])).values()].slice(0, 8);
  const contentVector = userContentVector(reco, userId, profile);
  const weights = pickWeights(new Set(interactions.map((e) => e.productSlug)).size, contentVector.size > 0);

  const mfRaw = new Map();
  const uidx = reco.mf?.userIndex.get(String(userId));
  if (reco.mf && uidx != null) {
    reco.products.forEach((p) => {
      const iidx = reco.itemIndex.get(pid(p));
      let dot = 0;
      for (let f = 0; f < reco.mf.k; f += 1) dot += reco.mf.P[uidx][f] * reco.mf.Q[iidx][f];
      mfRaw.set(pid(p), dot);
    });
  }
  const mfNorm = normalize(mfRaw);

  const scored = reco.products.map((p) => {
    const slug = pid(p);
    const mfScore = mfNorm.get(slug) || 0;
    const cfScore = recentDistinct.reduce((best, r) => {
      if (r.productSlug === slug) return best;
      const neighbor = (reco.itemSim.get(r.productSlug) || []).find((n) => n.slug === slug);
      return neighbor ? Math.max(best, neighbor.score) : best;
    }, 0);
    const contentScore = cosineMaps(contentVector, reco.contentVectors.get(slug));
    const basketScore = recentDistinct.reduce((best, recent) => {
      const rule = (reco.basketByAntecedent.get(recent.productSlug) || []).find((candidate) => candidate.consequent === slug);
      return rule ? Math.max(best, Math.min(1, rule.confidence * Math.min(3, rule.lift) / 1.5)) : best;
    }, 0);
    const trendingScore = reco.trendingByProduct.get(slug) || 0;
    const advanced = scoreAdvanced(reco.advanced, String(userId), slug, contentScore, trendingScore);
    const rejected = reco.userNegatives.get(String(userId))?.has(slug) ? 0.45 : 0;
    const contributions = {
      mf: weights.mf * mfScore, cf: weights.cf * cfScore,
      basket: weights.basket * basketScore, content: weights.content * contentScore,
      trending: weights.trending * trendingScore,
      sequence: weights.sequence * advanced.sequence,
      graph: weights.graph * advanced.graph,
      transition: weights.transition * advanced.transition,
      rank: weights.rank * advanced.rank,
      negative: -rejected,
    };
    // Final stacked ranker: MoE experts tạo retrieval score đã calibration,
    // pairwise model tạo logit cuối. Diversification chỉ chạy sau điểm này.
    const retrievalMass = Math.max(0.0001, 1 - weights.rank);
    const retrievalScore = Object.entries(contributions)
      .filter(([name]) => !['rank', 'negative'].includes(name))
      .reduce((sum, [, value]) => sum + value, 0) / retrievalMass;
    const finalLogit = 0.7 * logit(advanced.rank) + 2.2 * (retrievalScore - 0.5) - rejected * 5;
    const score = 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, finalLogit))));
    return { slug, score, contributions, category: categoryOf(reco, slug) };
  }).sort((a, b) => b.score - a.score);

  return scored;
}

function diversify(scored, limit, excludeSlugs) {
  const excluded = new Set(excludeSlugs || []);
  const pool = scored.filter((c) => !excluded.has(c.slug));
  const picked = [];
  const catCount = new Map();
  pool.forEach((c) => {
    if (picked.length >= limit) return;
    const count = catCount.get(c.category) || 0;
    if (count < CATEGORY_CAP) { picked.push(c); catCount.set(c.category, count + 1); }
  });
  if (picked.length < limit) {
    const pickedSlugs = new Set(picked.map((c) => c.slug));
    pool.forEach((c) => { if (picked.length < limit && !pickedSlugs.has(c.slug)) picked.push(c); });
  }
  return picked;
}

function weightedSample(candidates, excludeSlugs) {
  const excluded = new Set(excludeSlugs || []);
  const pool = candidates.filter((c) => !excluded.has(c.slug));
  const total = pool.reduce((sum, c) => sum + Math.max(0.01, c.contributions.trending), 0);
  if (!total) return pool[0];
  let roll = Math.random() * total;
  for (const c of pool) {
    roll -= Math.max(0.01, c.contributions.trending);
    if (roll <= 0) return c;
  }
  return pool[pool.length - 1];
}

function getHomeRecommendations(state, { userId = 'guest', limit = 8, profile } = {}) {
  const reco = getCached(state);
  const scored = scoreCandidates(reco, userId, profile);
  const mainCount = limit >= 4 ? limit - 1 : limit;
  const main = diversify(scored, mainCount, []);
  const items = [...main];
  if (limit >= 4) {
    const explorePick = weightedSample(scored, main.map((c) => c.slug));
    if (explorePick) items.push(explorePick);
  }
  const reasons = {};
  items.forEach((c, i) => { reasons[c.slug] = reasonFor(reco, c.slug, c.contributions, limit >= 4 && i === items.length - 1); });
  return {
    items: items.map((c) => c.slug),
    reasons,
    source: 'adaptive mixture-of-experts: selective SSM sequence + LightGCN graph + autoregressive next-item distribution + pairwise ranker, blended with classic retrieval',
    models: ['selective-ssm-sequence', 'lightgcn-user-item', 'autoregressive-next-item', 'adaptive-moe-gate', 'pairwise-logistic-ranker', 'matrix-factorization-sgd', 'item-cf-cosine', 'association-rules', 'content-profile', 'demand-trending'],
    modelStatus: reco.trainingStats,
    learnedFrom: ['tìm kiếm', 'xem sản phẩm', 'yêu thích', 'thêm giỏ', 'thử đồ', 'trò chuyện', 'mua hàng'],
  };
}

function getRelatedProducts(state, slug, limit = 8) {
  const reco = getCached(state);
  const target = String(slug);
  const picked = [];
  const seen = new Set([target]);
  (reco.basketByAntecedent.get(target) || [])
    .slice()
    .sort((a, b) => (b.confidence * b.lift) - (a.confidence * a.lift))
    .forEach((rule) => { if (!seen.has(rule.consequent) && picked.length < limit) { picked.push(rule.consequent); seen.add(rule.consequent); } });
  (reco.itemSim.get(target) || []).forEach((n) => { if (!seen.has(n.slug) && picked.length < limit) { picked.push(n.slug); seen.add(n.slug); } });
  if (picked.length < limit) {
    const cat = categoryOf(reco, target);
    reco.products
      .filter((p) => !seen.has(pid(p)) && categoryOf(reco, pid(p)) === cat)
      .sort((a, b) => (reco.trendingByProduct.get(pid(b)) || 0) - (reco.trendingByProduct.get(pid(a)) || 0))
      .forEach((p) => { if (picked.length < limit && !seen.has(pid(p))) { picked.push(pid(p)); seen.add(pid(p)); } });
  }
  if (picked.length < limit) {
    const targetVector = reco.contentVectors.get(target);
    reco.products
      .filter((p) => !seen.has(pid(p)))
      .map((p) => ({ slug: pid(p), score: cosineMaps(targetVector, reco.contentVectors.get(pid(p))) }))
      .sort((a, b) => b.score - a.score)
      .forEach((c) => { if (picked.length < limit && !seen.has(c.slug)) { picked.push(c.slug); seen.add(c.slug); } });
  }
  if (picked.length < limit) {
    reco.products
      .filter((p) => !seen.has(pid(p)))
      .sort((a, b) => (reco.trendingByProduct.get(pid(b)) || 0) - (reco.trendingByProduct.get(pid(a)) || 0))
      .forEach((p) => { if (picked.length < limit && !seen.has(pid(p))) { picked.push(pid(p)); seen.add(pid(p)); } });
  }
  return picked.slice(0, limit);
}

function buildTagIndex(products) {
  const sortedPrices = products.map((p) => finiteNumber(p.price, 0)).sort((a, b) => a - b);
  const vectors = new Map(products.map((p) => [pid(p), productTokenMap(p, sortedPrices)]));
  return { vectors, similarity: (a, b) => cosineMaps(vectors.get(a), vectors.get(b)) };
}

function trendingList(state) {
  const reco = getCached(state);
  return reco.predictions;
}

function getRecommendationDiagnostics(state) {
  const builtAt = Date.now();
  const reco = build(state, builtAt);
  const stats = reco.trainingStats;
  const productCount = Math.max(1, stats.products);
  const activeProducts = new Set();
  reco.userRecent.forEach((rows) => rows.forEach((row) => activeProducts.add(row.productSlug)));
  return {
    status: stats.events > 0 ? 'active' : 'waiting-for-data',
    generatedAt: new Date(builtAt).toISOString(),
    events: stats.events,
    users: stats.users,
    products: stats.products,
    itemCoverage: stats.products ? activeProducts.size / productCount : 0,
    graphEdges: stats.graphEdges,
    graphDensity: stats.graphDensity,
    transitionCount: stats.transitionCount,
    trainingPairs: stats.rankerTrainingPairs,
    negativeFeedbackEvents: stats.negativeFeedbackEvents,
    embeddingDimensions: stats.embeddingDimensions,
    stages: [
      { id: 'selective-ssm-sequence', role: 'sequence encoder', active: stats.selectiveSsmActive, metrics: { users: stats.sequenceUsers, maxLength: stats.maxSequenceLength } },
      { id: 'lightgcn-user-item', role: 'relationship encoder', active: stats.lightGcnActive, metrics: { layers: stats.graphLayers, nodes: stats.graphNodes, edges: stats.graphEdges, density: stats.graphDensity } },
      { id: 'autoregressive-next-item', role: 'generative next-item expert', active: stats.autoregressiveNextItemActive, metrics: { transitions: stats.transitionCount, sources: stats.transitionSources } },
      { id: 'pairwise-logistic-ranker', role: 'final ranker', active: stats.pairwiseRankerActive, metrics: { epochs: stats.rankerEpochs, positives: stats.rankerPositiveEvents, pairs: stats.rankerTrainingPairs } },
      { id: 'adaptive-moe-gate', role: 'expert fusion', active: stats.events > 0, metrics: { experts: 9 } },
    ],
    implementation: 'online-js',
    evaluation: { status: 'not-measured', ndcgAt10: null, recallAt10: null, sampleSize: 0 },
  };
}

module.exports = {
  getHomeRecommendations,
  getRelatedProducts,
  getRecommendationDiagnostics,
  invalidateCache,
  buildTagIndex,
  trendingList,
  TYPE_WEIGHT,
};
