const {
  finiteNumber,
  productId: pid,
  itemProductId,
  isSuccessfulOrder,
  mlMatrixFactorization,
  buildDemandAndTrends,
  buildMarketBasketRules,
} = require('./analytics');

// Trọng số phản ánh mức độ chủ ý: tìm kiếm mạnh hơn lượt xem nhưng nhẹ hơn
// yêu thích/thử đồ; mua hàng là tín hiệu xác nhận mạnh nhất.
const TYPE_WEIGHT = { view: 1, search: 2, wishlist: 3, cart: 4, tryon: 3.5, chat: 2.5, goal: 2.5, purchase: 6 };
const HALF_LIFE_DAYS = 14; // hành vi gần đây ảnh hưởng mạnh hơn, giống re-ranking real-time của TikTok
const CACHE_TTL_MS = 60000;
const NEIGHBOR_LIMIT = 12;
const CATEGORY_CAP = 2;

let cache = { at: 0, key: '', data: null };

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
  const t = Number(timestamp) || now;
  return (now - t) / 86400000;
}

function build(state, now = Date.now()) {
  const products = (state.products || []).filter((p) => !['archived', 'hidden'].includes(String(p.status || '')));
  const itemIndex = new Map(products.map((p, i) => [pid(p), i]));
  const nItems = products.length;
  const sortedPrices = products.map((p) => finiteNumber(p.price, 0)).sort((a, b) => a - b);

  const successfulOrders = (state.orders || []).filter(isSuccessfulOrder);
  const events = [];
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
    if (value <= 0) return;
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
  events.forEach(({ userId, productSlug, weight, at }) => {
    const ui = userIndex.get(userId);
    const ii = itemIndex.get(productSlug);
    const decayed = decay(weight, dateAgeDays(at, now));
    itemVectors[ii].set(ui, (itemVectors[ii].get(ui) || 0) + decayed);
    const list = userRecent.get(userId) || [];
    list.push({ productSlug, weight: decayed, at: Number(at) || now });
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

  return {
    products, itemIndex, itemSim, mf, userIndex, userRecent,
    trendingByProduct, predictions: demand.predictions, categoryTrends: demand.categoryTrends,
    contentVectors,
    marketBasketRules,
    basketByAntecedent,
    categoryLabel: new Map((state.categories || []).map((c) => [c.id, c.name])),
    generatedAt: now,
    trainingStats: {
      users: userIds.length,
      events: events.length,
      products: nItems,
      matrixFactorizationActive: Boolean(mf),
      itemCollaborativeFilteringActive: itemSim.size > 0,
      contentModelActive: contentVectors.size > 0,
      marketBasketRules: marketBasketRules.length,
    },
  };
}

function getCached(state) {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL_MS) return cache.data;
  const data = build(state, now);
  cache = { at: now, data };
  return data;
}

// Gọi sau khi ghi interactions/orders/profiles/products mới để engine phản ánh ngay, không đợi hết TTL.
function invalidateCache() {
  cache = { at: 0, key: '', data: null };
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
  if (interactionCount >= 3) return { mf: 0.3, cf: 0.2, basket: 0.2, content: 0.15, trending: 0.15 };
  if (interactionCount >= 1) return { mf: 0.1, cf: 0.25, basket: 0.25, content: 0.2, trending: 0.2 };
  return hasContentSignal ? { mf: 0, cf: 0, basket: 0, content: 0.35, trending: 0.65 } : { mf: 0, cf: 0, basket: 0, content: 0, trending: 1 };
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
    const contributions = { mf: weights.mf * mfScore, cf: weights.cf * cfScore, basket: weights.basket * basketScore, content: weights.content * contentScore, trending: weights.trending * trendingScore };
    const score = contributions.mf + contributions.cf + contributions.basket + contributions.content + contributions.trending;
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
    source: 'ensemble: Matrix Factorization SGD + item-CF cosine + market-basket rules + content-based + time-decay trending',
    models: ['matrix-factorization-sgd', 'item-cf-cosine', 'association-rules', 'content-profile', 'demand-trending'],
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

module.exports = { getHomeRecommendations, getRelatedProducts, invalidateCache, buildTagIndex, trendingList, TYPE_WEIGHT };
