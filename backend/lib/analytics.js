function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function productId(product) {
  return String(product?.slug || product?.id || product?.sku || product?.name || '');
}

function itemProductId(item) {
  return String(item?.productId || item?.slug || item?.id || item?.sku || item?.name || '');
}

function isSuccessfulOrder(order) {
  const status = String(order?.status || order?.orderStatus || '').toLowerCase();
  const payment = String(order?.payment?.status || order?.paymentStatus || '').toLowerCase();
  if (['cancelled', 'canceled', 'refunded', 'failed'].includes(status)) return false;
  return payment === 'paid' || ['completed', 'delivered'].includes(status);
}

function orderTotal(order) {
  return Math.max(0, finiteNumber(order?.total ?? order?.totalAmount, 0));
}

function mlLinearRegression(values) {
  const ys = Array.isArray(values) ? values.map((value) => finiteNumber(value, 0)) : [];
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: n ? ys[0] : 0, r2: 0, predict: () => (n ? ys[0] : 0) };
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let index = 0; index < n; index += 1) {
    covariance += (index - meanX) * (ys[index] - meanY);
    varianceX += (index - meanX) ** 2;
    varianceY += (ys[index] - meanY) ** 2;
  }
  const slope = varianceX ? covariance / varianceX : 0;
  const intercept = meanY - slope * meanX;
  const predict = (index) => slope * index + intercept;
  let residual = 0;
  for (let index = 0; index < n; index += 1) residual += (ys[index] - predict(index)) ** 2;
  const r2 = varianceY ? Math.max(0, Math.min(1, 1 - residual / varianceY)) : 0;
  return { slope, intercept, r2, predict };
}

function mlMape(values, predictor) {
  let error = 0;
  let count = 0;
  (values || []).forEach((raw, index) => {
    const value = finiteNumber(raw, 0);
    if (value <= 0) return;
    error += Math.abs((value - finiteNumber(predictor(index), 0)) / value);
    count += 1;
  });
  return count ? (error / count) * 100 : 0;
}

function mlKMeans(points, requestedK = 3, iterations = 30) {
  if (!Array.isArray(points) || !points.length) return { assignments: [], centroids: [], inertia: 0, k: 0 };
  const clean = points.map((point) => point.map((value) => finiteNumber(value, 0)));
  const dimensions = clean[0].length;
  const mean = new Array(dimensions).fill(0);
  const deviation = new Array(dimensions).fill(0);
  clean.forEach((point) => point.forEach((value, index) => { mean[index] += value; }));
  for (let index = 0; index < dimensions; index += 1) mean[index] /= clean.length;
  clean.forEach((point) => point.forEach((value, index) => { deviation[index] += (value - mean[index]) ** 2; }));
  for (let index = 0; index < dimensions; index += 1) deviation[index] = Math.sqrt(deviation[index] / clean.length) || 1;
  const normalized = clean.map((point) => point.map((value, index) => (value - mean[index]) / deviation[index]));
  const k = Math.max(1, Math.min(Math.floor(requestedK) || 1, normalized.length));
  const order = normalized.map((_, index) => index).sort((a, b) => normalized[a][0] - normalized[b][0]);
  const centroids = Array.from({ length: k }, (_, index) => normalized[order[Math.min(order.length - 1, Math.floor((index + 0.5) * order.length / k))]].slice());
  const assignments = new Array(normalized.length).fill(-1);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let changed = false;
    normalized.forEach((point, pointIndex) => {
      let best = 0;
      let bestDistance = Infinity;
      centroids.forEach((centroid, centroidIndex) => {
        const distance = point.reduce((sum, value, dimension) => sum + (value - centroid[dimension]) ** 2, 0);
        if (distance < bestDistance) { bestDistance = distance; best = centroidIndex; }
      });
      if (assignments[pointIndex] !== best) { assignments[pointIndex] = best; changed = true; }
    });
    const sums = Array.from({ length: k }, () => new Array(dimensions).fill(0));
    const counts = new Array(k).fill(0);
    normalized.forEach((point, pointIndex) => {
      const assignment = assignments[pointIndex];
      counts[assignment] += 1;
      point.forEach((value, dimension) => { sums[assignment][dimension] += value; });
    });
    for (let centroidIndex = 0; centroidIndex < k; centroidIndex += 1) {
      if (!counts[centroidIndex]) continue;
      for (let dimension = 0; dimension < dimensions; dimension += 1) centroids[centroidIndex][dimension] = sums[centroidIndex][dimension] / counts[centroidIndex];
    }
    if (!changed && iteration > 0) break;
  }
  let inertia = 0;
  normalized.forEach((point, pointIndex) => {
    inertia += point.reduce((sum, value, dimension) => sum + (value - centroids[assignments[pointIndex]][dimension]) ** 2, 0);
  });
  return {
    assignments,
    centroids: centroids.map((centroid) => centroid.map((value, dimension) => value * deviation[dimension] + mean[dimension])),
    inertia,
    k,
  };
}

function seededRandom(seed = 20260711) {
  let value = Number(seed) >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function mlMatrixFactorization(triples, nUsers, nItems, k = 8, epochs = 25, lr = 0.02, reg = 0.05) {
  // Khởi tạo có seed để cùng một tập dữ liệu luôn cho cùng thứ hạng gợi ý.
  const random = seededRandom(7919 + triples.length * 31 + nUsers * 17 + nItems);
  const rnd = () => (random() - 0.5) * 0.1;
  const P = Array.from({ length: Math.max(1, nUsers) }, () => Array.from({ length: k }, rnd));
  const Q = Array.from({ length: Math.max(1, nItems) }, () => Array.from({ length: k }, rnd));
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const [u, i, r] of triples) {
      let dot = 0;
      for (let f = 0; f < k; f += 1) dot += P[u][f] * Q[i][f];
      const error = r - dot;
      for (let f = 0; f < k; f += 1) {
        const pf = P[u][f];
        const qf = Q[i][f];
        P[u][f] += lr * (error * qf - reg * pf);
        Q[i][f] += lr * (error * pf - reg * qf);
      }
    }
  }
  return { P, Q, k };
}

function meanAbsoluteError(actual, predicted) {
  if (!actual.length) return 0;
  return actual.reduce((sum, value, index) => sum + Math.abs(value - finiteNumber(predicted[index], 0)), 0) / actual.length;
}

// Holt linear trend (double exponential smoothing). Grid nhỏ giúp tự chọn alpha/beta
// theo one-step backtest, không cần package ML và ổn định hơn OLS khi xu hướng đổi nhanh.
function mlHoltLinear(values, alpha = 0.55, beta = 0.25) {
  const ys = (values || []).map((value) => Math.max(0, finiteNumber(value, 0)));
  if (!ys.length) return { level: 0, trend: 0, fitted: [], predict: () => 0, alpha, beta };
  let level = ys[0];
  let trend = ys.length > 1 ? ys[1] - ys[0] : 0;
  const fitted = [ys[0]];
  for (let index = 1; index < ys.length; index += 1) {
    const previousLevel = level;
    fitted.push(Math.max(0, level + trend));
    level = alpha * ys[index] + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
  }
  return { level, trend, fitted, predict: (horizon = 1) => Math.max(0, level + Math.max(1, horizon) * trend), alpha, beta };
}

function tuneHolt(values) {
  let best = null;
  for (const alpha of [0.25, 0.45, 0.65, 0.8]) {
    for (const beta of [0.1, 0.25, 0.45]) {
      const model = mlHoltLinear(values, alpha, beta);
      const mae = meanAbsoluteError(values.slice(1), model.fitted.slice(1));
      if (!best || mae < best.mae) best = { ...model, mae };
    }
  }
  return best || { ...mlHoltLinear(values), mae: 0 };
}

function mlWeightedMovingAverage(values, window = 3) {
  const ys = (values || []).map((value) => Math.max(0, finiteNumber(value, 0)));
  const width = Math.max(1, Math.min(window, ys.length || 1));
  const forecastAt = (endExclusive) => {
    const slice = ys.slice(Math.max(0, endExclusive - width), endExclusive);
    if (!slice.length) return 0;
    const denominator = slice.reduce((sum, _, index) => sum + index + 1, 0);
    return slice.reduce((sum, value, index) => sum + value * (index + 1), 0) / denominator;
  };
  const fitted = ys.map((value, index) => index ? forecastAt(index) : value);
  const next = forecastAt(ys.length);
  return { window: width, fitted, predict: () => Math.max(0, next) };
}

function dateValue(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek(now) {
  const day = startOfDay(now);
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function revenueSeries(successful, now, unit, count) {
  const points = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    let start;
    let end;
    let label;
    if (unit === 'day') {
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
      end = new Date(start.getTime() + 86400000);
      label = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`;
    } else if (unit === 'week') {
      start = startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset * 7));
      end = new Date(start.getTime() + 7 * 86400000);
      label = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`;
    } else if (unit === 'month') {
      start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      label = `T${start.getMonth() + 1}/${String(start.getFullYear()).slice(-2)}`;
    } else {
      start = new Date(now.getFullYear() - offset, 0, 1);
      end = new Date(start.getFullYear() + 1, 0, 1);
      label = String(start.getFullYear());
    }
    const value = successful.reduce((sum, order) => {
      const date = dateValue(order.createdAt || order.orderDate);
      return date && date >= start && date < end ? sum + orderTotal(order) : sum;
    }, 0);
    points.push({ label, value: Math.round(value) });
  }
  return points;
}

function buildRevenueAnalytics(orders, now = new Date()) {
  const successful = (orders || []).filter(isSuccessfulOrder);
  const starts = {
    day: startOfDay(now),
    week: startOfWeek(now),
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    year: new Date(now.getFullYear(), 0, 1),
  };
  const revenueTotals = Object.fromEntries(Object.entries(starts).map(([key, start]) => [
    key,
    successful.reduce((sum, order) => {
      const date = dateValue(order.createdAt || order.orderDate);
      return date && date >= start && date <= now ? sum + orderTotal(order) : sum;
    }, 0),
  ]));

  const revenueByPeriod = {
    day: revenueSeries(successful, now, 'day', 7),
    week: revenueSeries(successful, now, 'week', 8),
    month: revenueSeries(successful, now, 'month', 12),
    year: revenueSeries(successful, now, 'year', 5),
  };

  const monthMap = new Map();
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    monthMap.set(monthKey(date), 0);
  }
  successful.forEach((order) => {
    const date = dateValue(order.createdAt || order.orderDate);
    if (!date) return;
    const key = monthKey(date);
    if (monthMap.has(key)) monthMap.set(key, monthMap.get(key) + orderTotal(order));
  });
  const history = [...monthMap.entries()].map(([label, value]) => ({ label, value: Math.round(value) }));
  const values = history.map((point) => point.value);
  const regression = mlLinearRegression(values);
  const olsFitted = values.map((_, index) => Math.max(0, regression.predict(index)));
  const holt = tuneHolt(values);
  const wma = mlWeightedMovingAverage(values, Math.min(4, Math.max(2, values.length)));
  const modelMae = {
    ols: meanAbsoluteError(values, olsFitted),
    holt: meanAbsoluteError(values.slice(1), holt.fitted.slice(1)),
    wma: meanAbsoluteError(values.slice(1), wma.fitted.slice(1)),
  };
  const inverse = Object.fromEntries(Object.entries(modelMae).map(([key, value]) => [key, 1 / Math.max(1, value)]));
  const inverseTotal = Object.values(inverse).reduce((sum, value) => sum + value, 0) || 1;
  const weights = Object.fromEntries(Object.entries(inverse).map(([key, value]) => [key, value / inverseTotal]));
  const forecast = [];
  const individualForecasts = { ols: [], holt: [], wma: [] };
  for (let horizon = 1; horizon <= 3; horizon += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + horizon, 1);
    const olsValue = Math.max(0, regression.predict(values.length - 1 + horizon));
    const holtValue = holt.predict(horizon);
    const wmaValue = wma.predict(horizon);
    individualForecasts.ols.push(Math.round(olsValue));
    individualForecasts.holt.push(Math.round(holtValue));
    individualForecasts.wma.push(Math.round(wmaValue));
    const value = weights.ols * olsValue + weights.holt * holtValue + weights.wma * wmaValue;
    const spread = Math.sqrt(((olsValue - value) ** 2 + (holtValue - value) ** 2 + (wmaValue - value) ** 2) / 3);
    forecast.push({
      label: monthKey(date),
      value: Math.max(0, Math.round(value)),
      low: Math.max(0, Math.round(value - 1.28 * spread)),
      high: Math.max(0, Math.round(value + 1.28 * spread)),
      forecast: true,
    });
  }
  return {
    successful,
    revenueByPeriod,
    revenueTotals,
    revenueForecast: {
      algorithm: 'Ensemble OLS + Holt linear trend + Weighted Moving Average trên 12 tháng',
      history,
      forecast,
      nextMonth: forecast[0]?.value || 0,
      slope: Math.round(regression.slope),
      intercept: Math.round(regression.intercept),
      r2: Math.round(regression.r2 * 1000) / 1000,
      mape: Math.round(mlMape(values, regression.predict) * 10) / 10,
      trend: regression.slope > 0 ? 'tăng' : regression.slope < 0 ? 'giảm' : 'ổn định',
      sampleSize: values.filter((value) => value > 0).length,
      confidence: 'Khoảng 80% dựa trên độ phân tán giữa ba model',
      models: [
        { key: 'ols', name: 'Linear Regression OLS', mae: Math.round(modelMae.ols), weight: Math.round(weights.ols * 1000) / 1000, forecast: individualForecasts.ols, r2: Math.round(regression.r2 * 1000) / 1000 },
        { key: 'holt', name: 'Holt Double Exponential Smoothing', mae: Math.round(modelMae.holt), weight: Math.round(weights.holt * 1000) / 1000, alpha: holt.alpha, beta: holt.beta, forecast: individualForecasts.holt },
        { key: 'wma', name: `Weighted Moving Average (${wma.window})`, mae: Math.round(modelMae.wma), weight: Math.round(weights.wma * 1000) / 1000, forecast: individualForecasts.wma },
      ],
    },
  };
}

function buildDemandAndTrends(state, successfulOrders) {
  const products = Array.isArray(state.products) ? state.products : [];
  const sales = new Map();
  const recentSales = new Map();
  const previousSales = new Map();
  const nowMs = Date.now();
  successfulOrders.forEach((order) => (order.items || []).forEach((item) => {
    const id = itemProductId(item);
    if (!id) return;
    const quantity = Math.max(1, finiteNumber(item.qty ?? item.quantity, 1));
    sales.set(id, (sales.get(id) || 0) + quantity);
    const createdAt = dateValue(order.createdAt || order.orderDate)?.getTime() || 0;
    const ageDays = (nowMs - createdAt) / 86400000;
    if (ageDays >= 0 && ageDays < 30) recentSales.set(id, (recentSales.get(id) || 0) + quantity);
    else if (ageDays >= 30 && ageDays < 60) previousSales.set(id, (previousSales.get(id) || 0) + quantity);
  }));
  const useHistoricalSales = [...sales.values()].reduce((sum, value) => sum + value, 0) === 0;
  const signals = new Map(products.map((product) => [productId(product), { wishlist: 0, cart: 0, views: 0, searches: 0, tryons: 0, chatMention: 0, reviews: 0, ratingTotal: 0 }]));
  const statefulSignals = new Map();
  const eventSignals = [];
  (state.interactions || []).forEach((interaction) => {
    const type = String(interaction.type || '').toLowerCase();
    if (['wishlist', 'like', 'favorite', 'cart', 'add_to_cart'].includes(type)) {
      const key = `${interaction.userId || 'guest'}|${interaction.productId || ''}|${type}`;
      const previous = statefulSignals.get(key);
      if (!previous || finiteNumber(interaction.createdAt, 0) >= finiteNumber(previous.createdAt, 0)) statefulSignals.set(key, interaction);
    } else eventSignals.push(interaction);
  });
  [...eventSignals, ...statefulSignals.values()].forEach((interaction) => {
    const id = String(interaction.productId || '');
    const row = signals.get(id);
    if (!row) return;
    const type = String(interaction.type || '').toLowerCase();
    const value = interaction.value == null ? 1 : Math.max(0, finiteNumber(interaction.value, 0));
    if (value <= 0) return;
    if (['wishlist', 'like', 'favorite'].includes(type)) row.wishlist += value;
    if (['cart', 'add_to_cart'].includes(type)) row.cart += value;
    if (['view', 'click', 'open'].includes(type)) row.views += value;
    if (type === 'search') row.searches += value;
    if (type === 'tryon') row.tryons += value;
    if (['chat', 'mention'].includes(type)) row.chatMention += value;
    if (type === 'review') { row.reviews += 1; row.ratingTotal += Math.min(5, value); }
  });
  const chatText = (state.chats || []).map((entry) => String(entry.message || entry.content || '')).join(' ').toLowerCase();
  products.forEach((product) => {
    const row = signals.get(productId(product));
    const terms = [product.slug, product.name].filter(Boolean).map((value) => String(value).toLowerCase());
    row.chatMention += terms.reduce((count, term) => count + (term && chatText.includes(term) ? 1 : 0), 0);
  });

  const soldValues = products.map((product) => useHistoricalSales ? finiteNumber(product.sold, 0) : (sales.get(productId(product)) || 0));
  const maxSold = Math.max(1, ...soldValues);
  const maxWishlist = Math.max(1, ...[...signals.values()].map((row) => row.wishlist));
  const maxCart = Math.max(1, ...[...signals.values()].map((row) => row.cart));
  const maxMention = Math.max(1, ...[...signals.values()].map((row) => row.chatMention));

  const predictions = products.map((product, index) => {
    const id = productId(product);
    const row = signals.get(id);
    const sold = soldValues[index];
    const rating = row.reviews ? row.ratingTotal / row.reviews : Math.min(5, Math.max(0, finiteNumber(product.rating, 4)));
    const created = dateValue(product.createdAt) || new Date();
    const ageDays = Math.max(0, (Date.now() - created.getTime()) / 86400000);
    const recency = Math.max(0, 1 - Math.min(ageDays, 90) / 90);
    const rawScore = 0.35 * (sold / maxSold)
      + 0.20 * (row.wishlist / maxWishlist)
      + 0.15 * (row.cart / maxCart)
      + 0.15 * (rating / 5)
      + 0.07 * recency
      + 0.03 * Math.min(1, row.searches / 5)
      + 0.03 * Math.min(1, row.tryons / 3)
      + 0.02 * (row.chatMention / maxMention);
    const score = Math.max(0, Math.min(100, Math.round(rawScore * 100)));
    const recent30 = recentSales.get(id) || 0;
    const previous30 = previousSales.get(id) || 0;
    const momentum = previous30 > 0 ? (recent30 - previous30) / previous30 : (recent30 > 0 ? 1 : 0);
    const trendUnits = Math.max(0, recent30 + (recent30 - previous30) * 0.55);
    const baselineUnits = Math.max(0, sold / Math.max(1, successfulOrders.length ? 6 : 1));
    const forecastUnits30 = Math.max(0, Math.round((0.65 * trendUnits + 0.35 * baselineUnits) * 10) / 10);
    const stock = (product.variants || []).reduce((sum, variant) => sum + Math.max(0, finiteNumber(variant.stock, 0)), 0);
    const dailyDemand = forecastUnits30 / 30;
    const daysToStockout = dailyDemand > 0 ? Math.round((stock / dailyDemand) * 10) / 10 : null;
    const inventoryRisk = stock === 0 ? 'Hết hàng' : daysToStockout != null && daysToStockout <= 14 ? 'Rủi ro cao' : daysToStockout != null && daysToStockout <= 30 ? 'Cần theo dõi' : 'An toàn';
    return {
      productId: id,
      id: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image || product.images?.[0] || '',
      category: product.cat || product.category || 'general',
      price: finiteNumber(product.price, 0),
      score,
      predictedDemand: rawScore >= 0.72 ? 'Rất dễ bán chạy' : rawScore >= 0.52 ? 'Có tiềm năng' : rawScore >= 0.34 ? 'Cần đẩy marketing' : 'Nhu cầu thấp',
      suggestion: rawScore >= 0.52 ? 'Nên tăng hiển thị ở trang chủ hoặc chiến dịch nổi bật.' : 'Nên thử ảnh, mô tả hoặc ưu đãi mới trước khi nhập thêm hàng.',
      forecastUnits30,
      forecastRevenue30: Math.round(forecastUnits30 * finiteNumber(product.price, 0)),
      momentumPercent: Math.round(momentum * 1000) / 10,
      stock,
      daysToStockout,
      inventoryRisk,
      features: { sold, recent30, previous30, wishlist: row.wishlist, cart: row.cart, views: row.views, searches: row.searches, tryons: row.tryons, avgRating: Math.round(rating * 10) / 10, chatMention: row.chatMention },
    };
  }).sort((a, b) => b.score - a.score);

  const categoryMap = new Map();
  products.forEach((product, index) => {
    const category = product.cat || product.category || 'general';
    const row = categoryMap.get(category) || { category, productCount: 0, sold: 0, wishlists: 0, carts: 0, views: 0, score: 0 };
    const signal = signals.get(productId(product));
    row.productCount += 1;
    row.sold += soldValues[index];
    row.wishlists += signal.wishlist;
    row.carts += signal.cart;
    row.views += signal.views;
    categoryMap.set(category, row);
  });
  const categoryTrends = [...categoryMap.values()].map((row) => ({ ...row, score: row.sold * 3 + row.wishlists * 2 + row.carts + Math.round(row.views * 0.2) })).sort((a, b) => b.score - a.score);
  const inventoryRisks = predictions
    .filter((prediction) => prediction.inventoryRisk !== 'An toàn')
    .sort((a, b) => {
      const left = a.daysToStockout == null ? Infinity : a.daysToStockout;
      const right = b.daysToStockout == null ? Infinity : b.daysToStockout;
      if (a.stock === 0 && b.stock !== 0) return -1;
      if (b.stock === 0 && a.stock !== 0) return 1;
      return left - right;
    });
  return { predictions, categoryTrends, inventoryRisks };
}

function buildSegments(state, successfulOrders, now = new Date()) {
  const customers = new Map();
  successfulOrders.forEach((order) => {
    const userId = String(order.userId || order.customer?.id || order.customer?.phone || order.customer?.name || 'guest');
    const date = dateValue(order.createdAt || order.orderDate) || now;
    const row = customers.get(userId) || { userId, spend: 0, orders: 0, lastAt: 0 };
    row.spend += orderTotal(order);
    row.orders += 1;
    row.lastAt = Math.max(row.lastAt, date.getTime());
    customers.set(userId, row);
  });
  if (customers.size < 3) {
    (state.users || []).forEach((user) => {
      const id = String(user.id || user.email || user.name || '');
      if (!id || customers.has(id) || !finiteNumber(user.spent, 0)) return;
      customers.set(id, { userId: id, spend: finiteNumber(user.spent, 0), orders: finiteNumber(user.orders, 0), lastAt: finiteNumber(user.lastOrderAt || user.joinedAt, now.getTime()) });
    });
  }
  const list = [...customers.values()];
  const points = list.map((row) => [row.spend, row.orders, Math.min(365, Math.max(0, (now.getTime() - row.lastAt) / 86400000))]);
  const model = mlKMeans(points, 3, 30);
  const aggregate = Array.from({ length: model.k }, () => ({ size: 0, spend: 0, orders: 0, recency: 0 }));
  model.assignments.forEach((cluster, index) => {
    aggregate[cluster].size += 1;
    aggregate[cluster].spend += points[index][0];
    aggregate[cluster].orders += points[index][1];
    aggregate[cluster].recency += points[index][2];
  });
  const names = ['Khách VIP / chi cao', 'Khách thường xuyên', 'Khách mới / ít mua'];
  const colors = ['#A33A2F', '#243244', '#6B7255'];
  const clusters = aggregate.filter((row) => row.size).map((row) => ({
    size: row.size,
    avgSpend: Math.round(row.spend / row.size),
    avgOrders: Math.round((row.orders / row.size) * 10) / 10,
    avgRecency: Math.round(row.recency / row.size),
  })).sort((a, b) => b.avgSpend - a.avgSpend).map((row, index) => ({ ...row, name: names[index] || `Nhóm ${index + 1}`, color: colors[index] || '#84918B' }));
  return {
    algorithm: 'K-Means (k≤3) trên chi tiêu, số đơn và độ gần đây; có chuẩn hoá z-score',
    k: model.k,
    inertia: Math.round(model.inertia * 100) / 100,
    totalCustomers: list.length,
    clusters,
  };
}

// RFM + churn propensity: mô hình chấm điểm minh bạch dựa trên độ lâu chưa mua,
// tần suất và tổng chi tiêu. Đây là xác suất ưu tiên chăm sóc, không phải khẳng định khách sẽ rời bỏ.
function buildChurnRisks(state, successfulOrders, now = new Date()) {
  const customers = new Map((state.users || []).map((user) => [String(user.id || user.email || user.name), {
    userId: String(user.id || user.email || user.name),
    name: user.name || user.email || 'Khách JAPANO',
    frequency: 0,
    monetary: 0,
    lastAt: finiteNumber(user.joinedAt, now.getTime()),
  }]));
  successfulOrders.forEach((order) => {
    const userId = String(order.userId || order.customer?.id || order.customer?.phone || order.customer?.name || 'guest');
    const row = customers.get(userId) || { userId, name: order.customer?.name || userId, frequency: 0, monetary: 0, lastAt: 0 };
    row.frequency += 1;
    row.monetary += orderTotal(order);
    row.lastAt = Math.max(row.lastAt, dateValue(order.createdAt || order.orderDate)?.getTime() || 0);
    customers.set(userId, row);
  });
  const rows = [...customers.values()].map((row) => ({
    ...row,
    recencyDays: Math.max(0, Math.round((now.getTime() - (row.lastAt || now.getTime())) / 86400000)),
  }));
  const maxRecency = Math.max(1, ...rows.map((row) => row.recencyDays));
  const maxFrequency = Math.max(1, ...rows.map((row) => row.frequency));
  const maxMonetary = Math.max(1, ...rows.map((row) => row.monetary));
  return rows.map((row) => {
    const recency = Math.min(1, row.recencyDays / Math.max(90, maxRecency));
    const frequency = row.frequency / maxFrequency;
    const monetary = row.monetary / maxMonetary;
    const raw = 0.62 * recency + 0.23 * (1 - frequency) + 0.15 * (1 - monetary);
    const probability = Math.max(0, Math.min(100, Math.round(raw * 100)));
    return {
      ...row,
      churnProbability: probability,
      risk: probability >= 70 ? 'Cao' : probability >= 45 ? 'Trung bình' : 'Thấp',
      action: probability >= 70 ? 'Gửi ưu đãi quay lại hoặc gợi ý cá nhân hoá.' : probability >= 45 ? 'Nhắc BST mới phù hợp gu.' : 'Duy trì chăm sóc hiện tại.',
    };
  }).sort((a, b) => b.churnProbability - a.churnProbability);
}

// Association rules kiểu Apriori cho giỏ hàng: support/confidence/lift từ các đơn hợp lệ.
function buildMarketBasketRules(successfulOrders, limit = 30) {
  const baskets = (successfulOrders || []).map((order) => [...new Set((order.items || []).map(itemProductId).filter(Boolean))]).filter((items) => items.length > 1);
  const total = Math.max(1, baskets.length);
  const itemCount = new Map();
  const pairCount = new Map();
  baskets.forEach((items) => {
    items.forEach((item) => itemCount.set(item, (itemCount.get(item) || 0) + 1));
    for (let left = 0; left < items.length; left += 1) {
      for (let right = left + 1; right < items.length; right += 1) {
        const pair = [items[left], items[right]].sort();
        const key = `${pair[0]}\u0000${pair[1]}`;
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
    }
  });
  const rules = [];
  pairCount.forEach((count, key) => {
    const [a, b] = key.split('\u0000');
    const support = count / total;
    for (const [antecedent, consequent] of [[a, b], [b, a]]) {
      const confidence = count / Math.max(1, itemCount.get(antecedent) || 0);
      const consequentSupport = (itemCount.get(consequent) || 0) / total;
      const lift = consequentSupport ? confidence / consequentSupport : 0;
      rules.push({ antecedent, consequent, count, support, confidence, lift });
    }
  });
  return rules
    .filter((rule) => rule.count >= 2)
    .sort((a, b) => (b.lift * b.confidence * b.support) - (a.lift * a.confidence * a.support))
    .slice(0, limit)
    .map((rule) => ({
      ...rule,
      support: Math.round(rule.support * 1000) / 1000,
      confidence: Math.round(rule.confidence * 1000) / 1000,
      lift: Math.round(rule.lift * 1000) / 1000,
    }));
}

// Từ khoá hot + từ khoá không ra kết quả — dữ liệu vốn đã được ghi ở mỗi lượt
// tìm kiếm (routes/customerData.js:/search-log) nhưng trước đây không hề được
// tổng hợp lại thành báo cáo nào cho admin.
function buildSearchIntelligence(searchLogs, now = new Date()) {
  const logs = Array.isArray(searchLogs) ? searchLogs : [];
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const totals = new Map();
  logs.forEach((log) => {
    const key = normalize(log.query);
    if (!key) return;
    const row = totals.get(key) || { query: String(log.query || '').trim(), count: 0, zeroResults: 0, lastAt: 0 };
    row.count += 1;
    if (finiteNumber(log.resultCount, 0) === 0) row.zeroResults += 1;
    row.lastAt = Math.max(row.lastAt, finiteNumber(log.createdAt, 0));
    totals.set(key, row);
  });
  const rows = [...totals.values()];
  const topQueries = rows.slice().sort((a, b) => b.count - a.count).slice(0, 20);
  const zeroResultQueries = rows
    .filter((row) => row.zeroResults > 0)
    .map((row) => ({ ...row, zeroResultRate: Math.round((row.zeroResults / row.count) * 1000) / 1000 }))
    .sort((a, b) => b.zeroResults - a.zeroResults)
    .slice(0, 20);
  const dayBuckets = new Map();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    dayBuckets.set(`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`, 0);
  }
  logs.forEach((log) => {
    const date = dateValue(log.createdAt);
    if (!date) return;
    const label = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (dayBuckets.has(label)) dayBuckets.set(label, dayBuckets.get(label) + 1);
  });
  const totalSearches = logs.length;
  const zeroResultSearches = logs.filter((log) => finiteNumber(log.resultCount, 0) === 0).length;
  return {
    totalSearches,
    zeroResultSearches,
    zeroResultRate: totalSearches ? Math.round((zeroResultSearches / totalSearches) * 1000) / 1000 : 0,
    uniqueQueries: rows.length,
    topQueries,
    zeroResultQueries,
    searchVolumeByDay: [...dayBuckets.entries()].map(([label, value]) => ({ label, value })),
  };
}

function buildAnalytics(state, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const revenue = buildRevenueAnalytics(state.orders || [], now);
  const demand = buildDemandAndTrends(state, revenue.successful);
  const segments = buildSegments(state, revenue.successful, now);
  const churnRisks = buildChurnRisks(state, revenue.successful, now);
  const marketBasketRules = buildMarketBasketRules(revenue.successful);
  const revenueModels = revenue.revenueForecast.models || [];
  const behaviorCounts = {};
  (state.interactions || []).forEach((row) => {
    const type = String(row.type || 'khác').toLowerCase();
    behaviorCounts[type] = (behaviorCounts[type] || 0) + 1;
  });
  revenue.successful.forEach((order) => (order.items || []).forEach(() => { behaviorCounts.purchase = (behaviorCounts.purchase || 0) + 1; }));
  const behaviorUsers = new Set((state.interactions || []).map((row) => String(row.userId || '')).filter(Boolean));
  const behaviorProducts = new Set((state.interactions || []).map((row) => String(row.productId || '')).filter(Boolean));
  revenue.successful.forEach((order) => {
    const userId = String(order.userId || order.customer?.id || '');
    if (userId) behaviorUsers.add(userId);
    (order.items || []).forEach((item) => { const id = itemProductId(item); if (id) behaviorProducts.add(id); });
  });
  const usableSignals = Object.entries(behaviorCounts).filter(([type]) => ['view','search','wishlist','cart','tryon','chat','goal','purchase'].includes(type)).reduce((sum, [,count]) => sum + count, 0);
  const recommendationPipeline = options.recommendationDiagnostics || null;
  const stageById = new Map((recommendationPipeline?.stages || []).map((stage) => [stage.id, stage]));
  const assistantChats = (state.chats || []).filter((row) => String(row.role || '').toLowerCase() === 'assistant');
  const tracedChats = assistantChats.filter((row) => row.modelTrace || row.engine);
  const fallbackChats = tracedChats.filter((row) => String(row.intent || '') === 'fallback');
  const llmChats = tracedChats.filter((row) => /ollama/i.test(String(row.engine || '')));
  const confidences = tracedChats.map((row) => finiteNumber(row.confidence, NaN)).filter(Number.isFinite);
  const latencies = tracedChats.map((row) => finiteNumber(row.latencyMs, NaN)).filter(Number.isFinite);
  const intentCounts = {};
  tracedChats.forEach((row) => {
    const intent = String(row.intent || 'unknown');
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
  });
  const botIntelligence = {
    status: tracedChats.length ? 'active' : 'waiting-for-telemetry',
    engine: 'hybrid-post-transformer',
    grounded: true,
    requests: tracedChats.length,
    llmResponses: llmChats.length,
    localResponses: tracedChats.length - llmChats.length,
    fallbackResponses: fallbackChats.length,
    fallbackRate: tracedChats.length ? fallbackChats.length / tracedChats.length : 0,
    averageConfidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null,
    averageLatencyMs: latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : null,
    intentCounts,
    models: ['mlstm-style-matrix-memory', 'semantic-hashing-expert', 'sparse-moe-router', 'catalog-retrieval', 'ollama-optional'],
  };
  const recommendationHealth = {
    active: recommendationPipeline ? recommendationPipeline.status === 'active' : usableSignals > 0,
    interactions: recommendationPipeline?.events ?? usableSignals,
    users: recommendationPipeline?.users ?? behaviorUsers.size,
    products: recommendationPipeline?.products ?? behaviorProducts.size,
    typeCounts: behaviorCounts,
    lastInteractionAt: Math.max(0, ...(state.interactions || []).map((row) => finiteNumber(row.createdAt, 0))),
    matrixFactorizationActive: behaviorUsers.size >= 2 && usableSignals >= 4,
    selectiveSsmActive: stageById.get('selective-ssm-sequence')?.active ?? usableSignals > 0,
    lightGcnActive: stageById.get('lightgcn-user-item')?.active ?? usableSignals > 0,
    autoregressiveNextItemActive: stageById.get('autoregressive-next-item')?.active ?? false,
    pairwiseRankerActive: stageById.get('pairwise-logistic-ranker')?.active ?? false,
    graphEdges: recommendationPipeline?.graphEdges ?? 0,
    graphDensity: recommendationPipeline?.graphDensity ?? 0,
    transitionCount: recommendationPipeline?.transitionCount ?? 0,
    trainingPairs: recommendationPipeline?.trainingPairs ?? 0,
    itemCoverage: recommendationPipeline?.itemCoverage ?? 0,
    negativeFeedbackEvents: recommendationPipeline?.negativeFeedbackEvents ?? 0,
    algorithm: 'Selective SSM chuỗi hành vi + LightGCN user-item + pairwise ranker, blend với Matrix Factorization/Item-CF/content/luật mua kèm/trending',
    weights: { purchase: 6, cart: 4, tryon: 3.5, wishlist: 3, chat: 2.5, search: 2, view: 1 },
  };
  const models = [
    { name: 'Revenue Ensemble', type: 'OLS + Holt + Weighted Moving Average', metric: `${revenueModels.length} model · dự báo 3 tháng` },
    ...revenueModels.map((model) => ({ name: model.name, type: 'Time-series forecast', metric: `MAE ${Math.round(model.mae).toLocaleString('vi-VN')} · trọng số ${Math.round(model.weight * 100)}%` })),
    { name: 'Phân khúc khách hàng', type: 'K-Means', metric: `${segments.totalCustomers} khách · k=${segments.k}` },
    { name: 'RFM Churn Propensity', type: 'Recency + Frequency + Monetary', metric: `${churnRisks.filter((row) => row.risk === 'Cao').length} khách rủi ro cao` },
    { name: 'Điểm nhu cầu sản phẩm', type: 'DemandScore + 30-day momentum', metric: `${demand.predictions.length} sản phẩm` },
    { name: 'Xu hướng danh mục', type: 'Bán ×3 + wishlist ×2 + giỏ + lượt xem', metric: `${demand.categoryTrends.length} danh mục` },
    { name: 'Market Basket', type: 'Association Rules (support/confidence/lift)', metric: `${marketBasketRules.length} luật phối/mua kèm` },
    { name: 'Gợi ý cá nhân hoá MoE', type: 'Selective SSM + LightGCN-style + autoregressive next-item + pairwise ranker', metric: `${recommendationHealth.interactions} hành vi · ${recommendationHealth.graphEdges} cạnh · ${recommendationHealth.trainingPairs} training pair` },
    { name: 'Semantic Embeddings', type: `Transformer đa ngôn ngữ (${stageById.get('semantic-embeddings')?.metrics?.cuda ? 'CUDA' : stageById.get('semantic-embeddings')?.metrics?.device === 'cpu' ? 'CPU' : 'thiết bị chưa rõ'})`, metric: stageById.get('semantic-embeddings')?.metrics?.ready ? `${stageById.get('semantic-embeddings')?.metrics?.cachedProducts || 0} sản phẩm đã embed` : (stageById.get('semantic-embeddings')?.metrics?.loading ? 'Đang kết nối embedding service…' : 'Chưa kích hoạt') },
    { name: 'Ori semantic router', type: 'mLSTM-style matrix memory + sparse Mixture-of-Experts', metric: `${botIntelligence.requests} lượt có telemetry · ${botIntelligence.averageConfidence == null ? 'chưa có confidence' : `confidence TB ${Math.round(botIntelligence.averageConfidence * 100)}%`}` },
    { name: 'Product Vision', type: 'Qwen3-VL 8B + catalog grounding', metric: `${(state.aiDescriptions || []).length} sản phẩm đã phân tích ảnh` },
    { name: 'Shopping & Wellness Coach', type: 'Qwen2.5 7B + SMART/if-then safety rules', metric: `${(state.goals || []).length} lộ trình đang lưu` },
  ];
  const searchIntelligence = buildSearchIntelligence(state.searchLogs, now);
  models.push({ name: 'Search Intelligence', type: 'Top từ khoá + tỉ lệ tìm 0 kết quả', metric: `${searchIntelligence.totalSearches} lượt tìm · ${Math.round(searchIntelligence.zeroResultRate * 100)}% không ra kết quả` });
  return {
    generatedAt: now.toISOString(),
    revenueByPeriod: revenue.revenueByPeriod,
    revenueTotals: revenue.revenueTotals,
    revenueForecast: revenue.revenueForecast,
    predictions: demand.predictions,
    categoryTrends: demand.categoryTrends,
    customerTrends: demand.categoryTrends,
    inventoryRisks: demand.inventoryRisks,
    segments,
    churnRisks,
    marketBasketRules,
    models,
    recommendationHealth,
    recommendationPipeline,
    botIntelligence,
    searchIntelligence,
  };
}

module.exports = {
  finiteNumber,
  productId,
  itemProductId,
  isSuccessfulOrder,
  buildSearchIntelligence,
  mlLinearRegression,
  mlMape,
  mlKMeans,
  mlMatrixFactorization,
  mlHoltLinear,
  mlWeightedMovingAverage,
  meanAbsoluteError,
  buildDemandAndTrends,
  buildMarketBasketRules,
  buildChurnRisks,
  buildAnalytics,
};
