// Pipeline recommendation tuần tự + đồ thị chạy online, không cần native ML runtime:
// 1) Selective SSM mã hoá chuỗi hành vi theo thời gian (Mamba-inspired).
// 2) LightGCN truyền thông tin trên đồ thị user-item.
// 3) Autoregressive next-item expert sinh phân phối món tiếp theo theo session.
// 4) Pairwise logistic ranker học trọng số cuối từ implicit feedback.
//
// Đây không phải checkpoint Mamba/HSTU/xLSTM. Tên model trong API cố ý mô tả
// chính xác kiến trúc được cài đặt, tránh nhầm với các model deep-learning lớn.

const DIM = 12;
const GRAPH_LAYERS = 2;
const RANK_EPOCHS = 12;

function sigmoid(value) {
  if (value > 20) return 1;
  if (value < -20) return 0;
  return 1 / (1 + Math.exp(-value));
}

function dot(a, b) {
  let total = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) total += a[i] * b[i];
  return total;
}

function norm(vector) {
  return Math.sqrt(dot(vector, vector)) || 1;
}

function cosine(a, b) {
  return dot(a, b) / (norm(a) * norm(b));
}

function addScaled(target, source, scale) {
  for (let i = 0; i < target.length; i += 1) target[i] += (source[i] || 0) * scale;
}

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function productKey(product) {
  return String(product?.slug || product?.id || product?.sku || product?.name || '');
}

function timestampMs(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function itemEmbedding(product) {
  const out = new Array(DIM).fill(0);
  const tokens = [
    product.cat, product.category,
    ...(product.tags || []), ...(product.visualTags || []),
    ...String(product.name || '').toLowerCase().split(/\s+/).filter((word) => word.length >= 3),
  ].filter(Boolean);
  if (!tokens.length) tokens.push(productKey(product));
  tokens.forEach((token, tokenIndex) => {
    const seed = hash(token);
    for (let d = 0; d < DIM; d += 1) {
      // Feature hashing có dấu; deterministic giữa các lần rebuild.
      const bit = (seed >>> (d % 24)) & 1;
      out[d] += (bit ? 1 : -1) * (tokenIndex ? 0.55 : 1);
    }
  });
  const length = norm(out);
  return out.map((value) => value / length);
}

function encodeSequences(events, baseItems, now) {
  const grouped = new Map();
  events.forEach((event) => {
    const rows = grouped.get(event.userId) || [];
    rows.push(event);
    grouped.set(event.userId, rows);
  });
  const states = new Map();
  grouped.forEach((rows, userId) => {
    const state = new Array(DIM).fill(0);
    rows.sort((a, b) => a.at - b.at).slice(-64).forEach((event) => {
      const input = baseItems.get(event.productSlug);
      if (!input) return;
      const ageDays = Math.max(0, (now - event.at) / 86400000);
      const select = sigmoid(-0.35 + Math.log1p(event.weight) - Math.min(3, ageDays / 14));
      const retention = 0.72 + 0.22 * (1 - select);
      for (let d = 0; d < DIM; d += 1) {
        // Diagonal selective state transition: retention/input gate thay đổi
        // theo từng event, tương tự selective scan nhưng đủ nhẹ cho online JS.
        state[d] = retention * state[d] + select * input[d] * Math.log1p(event.weight);
      }
    });
    states.set(userId, state);
  });
  return states;
}

function buildLightGcn(events, products, baseItems) {
  const users = [...new Set(events.map((event) => event.userId))];
  const itemIds = products.map(productKey);
  const userNeighbors = new Map(users.map((id) => [id, new Map()]));
  const itemNeighbors = new Map(itemIds.map((id) => [id, new Map()]));
  events.forEach((event) => {
    const u = userNeighbors.get(event.userId);
    const i = itemNeighbors.get(event.productSlug);
    if (!u || !i) return;
    u.set(event.productSlug, (u.get(event.productSlug) || 0) + event.weight);
    i.set(event.userId, (i.get(event.userId) || 0) + event.weight);
  });

  let userLayer = new Map(users.map((id) => [id, new Array(DIM).fill(0)]));
  users.forEach((id) => {
    const neighbors = userNeighbors.get(id);
    neighbors.forEach((weight, itemId) => addScaled(userLayer.get(id), baseItems.get(itemId), Math.log1p(weight)));
  });
  let itemLayer = new Map(itemIds.map((id) => [id, baseItems.get(id).slice()]));
  const userSum = new Map([...userLayer].map(([id, vector]) => [id, vector.slice()]));
  const itemSum = new Map([...itemLayer].map(([id, vector]) => [id, vector.slice()]));

  for (let layer = 0; layer < GRAPH_LAYERS; layer += 1) {
    const nextUsers = new Map(users.map((id) => [id, new Array(DIM).fill(0)]));
    const nextItems = new Map(itemIds.map((id) => [id, new Array(DIM).fill(0)]));
    users.forEach((userId) => {
      const neighbors = userNeighbors.get(userId);
      neighbors.forEach((weight, itemId) => {
        const degreeScale = Math.log1p(weight) / Math.sqrt(Math.max(1, neighbors.size) * Math.max(1, itemNeighbors.get(itemId).size));
        addScaled(nextUsers.get(userId), itemLayer.get(itemId), degreeScale);
        addScaled(nextItems.get(itemId), userLayer.get(userId), degreeScale);
      });
    });
    userLayer = nextUsers;
    itemLayer = nextItems;
    users.forEach((id) => addScaled(userSum.get(id), userLayer.get(id), 1));
    itemIds.forEach((id) => addScaled(itemSum.get(id), itemLayer.get(id), 1));
  }
  const divisor = GRAPH_LAYERS + 1;
  userSum.forEach((vector) => { for (let d = 0; d < DIM; d += 1) vector[d] /= divisor; });
  itemSum.forEach((vector) => { for (let d = 0; d < DIM; d += 1) vector[d] /= divisor; });
  const uniqueEdges = events.length
    ? new Set(events.map((event) => `${event.userId}|${event.productSlug}`)).size
    : 0;
  return { users: userSum, items: itemSum, edges: uniqueEdges };
}

function buildTransitions(events) {
  const grouped = new Map();
  events.forEach((event) => {
    const rows = grouped.get(event.userId) || [];
    rows.push(event);
    grouped.set(event.userId, rows);
  });
  const counts = new Map();
  let transitionCount = 0;
  grouped.forEach((rows) => {
    rows.sort((a, b) => a.at - b.at);
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      const gapHours = Math.max(0, (current.at - previous.at) / 3600000);
      if (gapHours > 72 || previous.productSlug === current.productSlug) continue;
      const next = counts.get(previous.productSlug) || new Map();
      const sessionDecay = Math.exp(-gapHours / 24);
      next.set(current.productSlug, (next.get(current.productSlug) || 0) + sessionDecay * Math.log1p(current.weight));
      counts.set(previous.productSlug, next);
      transitionCount += 1;
    }
  });
  const probabilities = new Map();
  counts.forEach((next, source) => {
    const total = [...next.values()].reduce((sum, value) => sum + value, 0) || 1;
    probabilities.set(source, new Map([...next].map(([slug, value]) => [slug, value / total])));
  });
  return { probabilities, count: transitionCount, sources: probabilities.size };
}

function transitionScore(model, userId, slug) {
  const rows = model.userEvents.get(userId) || [];
  const recent = rows[rows.length - 1];
  if (!recent) return 0;
  return model.transitions.probabilities.get(recent.productSlug)?.get(slug) || 0;
}

function featureVector(model, userId, slug, contentScore = 0, trendingScore = 0) {
  const sequence = model.sequences.get(userId);
  const graphUser = model.graph.users.get(userId);
  const item = model.baseItems.get(slug);
  const graphItem = model.graph.items.get(slug);
  return [
    sequence && item ? (cosine(sequence, item) + 1) / 2 : 0,
    graphUser && graphItem ? (cosine(graphUser, graphItem) + 1) / 2 : 0,
    transitionScore(model, userId, slug),
    Math.max(0, trendingScore),
  ];
}

function trainRanker(model, holdouts, products, knownPositive) {
  const weights = [0.8, 0.9, 0.7, 0.35];
  if (products.length < 2) return { weights, positives: 0, pairs: 0, trained: false };
  const positives = holdouts.filter((event) => event.weight >= 2).sort((a, b) => a.at - b.at).slice(-500);
  let pairs = 0;
  for (let epoch = 0; epoch < RANK_EPOCHS; epoch += 1) {
    positives.forEach((event, index) => {
      const start = hash(`${event.userId}:${event.productSlug}:${epoch}:${index}`) % products.length;
      let negativeSlug = '';
      for (let offset = 0; offset < products.length; offset += 1) {
        const candidate = productKey(products[(start + offset) % products.length]);
        if (candidate && !knownPositive.get(event.userId)?.has(candidate)) {
          negativeSlug = candidate;
          break;
        }
      }
      if (!negativeSlug) return;
      pairs += 1;
      const positiveFeatures = featureVector(model, event.userId, event.productSlug);
      const negativeFeatures = featureVector(model, event.userId, negativeSlug);
      const difference = positiveFeatures.map((value, i) => value - negativeFeatures[i]);
      const gradient = 1 - sigmoid(dot(weights, difference));
      for (let i = 0; i < weights.length; i += 1) {
        weights[i] += 0.035 * (gradient * difference[i] - 0.002 * weights[i]);
      }
    });
  }
  return { weights, positives: positives.length, pairs, trained: pairs > 0 };
}

function buildAdvancedModel({ products, events, now = Date.now() }) {
  const cleanEvents = events
    .filter((event) => event.userId && event.productSlug)
    .map((event) => ({ ...event, at: timestampMs(event.at, now) }))
    .sort((a, b) => a.at - b.at);
  const baseItems = new Map(products.map((product) => [productKey(product), itemEmbedding(product)]));
  const grouped = new Map();
  const knownPositive = new Map();
  cleanEvents.forEach((event) => {
    const rows = grouped.get(event.userId) || [];
    rows.push(event);
    grouped.set(event.userId, rows);
    const positives = knownPositive.get(event.userId) || new Set();
    positives.add(event.productSlug);
    knownPositive.set(event.userId, positives);
  });
  // Chronological leave-last-out: target ranker không xuất hiện trong state,
  // graph hay transition dùng để tạo feature huấn luyện.
  const holdoutSet = new Set();
  grouped.forEach((rows) => {
    if (rows.length < 2) return;
    const lastPositive = rows.slice().reverse().find((event) => event.weight >= 2);
    if (lastPositive) holdoutSet.add(lastPositive);
  });
  const causalEvents = cleanEvents.filter((event) => !holdoutSet.has(event));
  const causalSequences = encodeSequences(causalEvents, baseItems, now);
  const causalGraph = buildLightGcn(causalEvents, products, baseItems);
  const causalUserEvents = new Map();
  causalEvents.forEach((event) => {
    const rows = causalUserEvents.get(event.userId) || [];
    rows.push(event);
    causalUserEvents.set(event.userId, rows);
  });
  const causalModel = {
    baseItems,
    sequences: causalSequences,
    graph: causalGraph,
    transitions: buildTransitions(causalEvents),
    userEvents: causalUserEvents,
  };
  const ranker = trainRanker(causalModel, [...holdoutSet], products, knownPositive);

  // Inference dùng toàn bộ lịch sử đã quan sát; chỉ trọng số ranker được học
  // trên target causal phía trên.
  const sequences = encodeSequences(cleanEvents, baseItems, now);
  const graph = buildLightGcn(cleanEvents, products, baseItems);
  const userEvents = new Map();
  cleanEvents.forEach((event) => {
    const rows = userEvents.get(event.userId) || [];
    rows.push(event);
    userEvents.set(event.userId, rows);
  });
  userEvents.forEach((rows) => rows.sort((a, b) => a.at - b.at));
  const transitions = buildTransitions(cleanEvents);
  const model = { baseItems, sequences, graph, transitions, userEvents, rankWeights: null, diagnostics: null };
  model.rankWeights = ranker.weights;
  const userCount = userEvents.size;
  const productCount = products.length;
  model.diagnostics = {
    embeddingDimensions: DIM,
    graphLayers: GRAPH_LAYERS,
    graphNodes: userCount + productCount,
    graphEdges: graph.edges,
    graphDensity: userCount && productCount ? graph.edges / (userCount * productCount) : 0,
    sequenceUsers: sequences.size,
    maxSequenceLength: 64,
    transitionCount: transitions.count,
    transitionSources: transitions.sources,
    rankerEpochs: RANK_EPOCHS,
    rankerPositiveEvents: ranker.positives,
    rankerTrainingPairs: ranker.pairs,
    rankerTrained: ranker.trained,
    causalHoldouts: holdoutSet.size,
  };
  return model;
}

function scoreAdvanced(model, userId, slug, contentScore, trendingScore) {
  const features = featureVector(model, String(userId), String(slug), contentScore, trendingScore);
  return {
    sequence: features[0],
    graph: features[1],
    transition: features[2],
    rank: sigmoid(dot(model.rankWeights, features)),
  };
}

module.exports = { buildAdvancedModel, scoreAdvanced };
