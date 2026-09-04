// Giữ chân người dùng ở bộ gợi ý: feed không được đóng băng, không được đảo
// lộn, không bày lại món đã mua, và quan tâm thật phải thắng mệt mỏi hiển thị.
//
// Ba lỗi rò dưới đây đều đo được trên kho hạt giống trước khi sửa:
//   - hai lượt mở liên tiếp trùng 7/8 món, và trùng y hệt sau nhiều giờ;
//   - món vừa mua vẫn đứng hạng 2 trang chủ;
//   - chỉ 11/30 lượt có một món chưa ai tương tác.
const test = require('node:test');
const assert = require('node:assert/strict');

const { seededState } = require('../seed');
const {
  getHomeRecommendations,
  invalidateCache,
  noteImpressions,
  impressionFatigue,
  resetImpressionLedger,
} = require('../lib/recommend');

const HOUR = 3600 * 1000;

function storeWithHistory({ purchase = null } = {}) {
  const state = seededState();
  const products = state.products.filter((p) => String(p.status || '') !== 'archived');
  const slugOf = (p) => p.slug || p.id;
  const now = Date.now();
  state.interactions = state.interactions || [];
  products.slice(0, 4).forEach((product, index) => {
    for (let k = 0; k < 3; k += 1) {
      state.interactions.push({
        userId: 'u1', productId: slugOf(product), type: 'view', value: 1,
        createdAt: now - index * HOUR - k * 600e3,
      });
    }
  });
  // đám đông để có tín hiệu cộng tác, nếu không mọi món đều bằng điểm
  for (let u = 0; u < 12; u += 1) {
    products.slice(0, 10).forEach((product, index) => {
      if ((u + index) % 3) return;
      state.interactions.push({
        userId: `crowd-${u}`, productId: slugOf(product), type: 'view', value: 1,
        createdAt: now - index * HOUR,
      });
    });
  }
  if (purchase) {
    state.orders = state.orders || [];
    state.orders.push({
      id: 'order-recsys', userId: 'u1', status: 'delivered', paymentStatus: 'paid',
      createdAt: now - 2 * 86400e3, items: [{ productId: purchase, qty: 1, price: 100000 }],
    });
  }
  return { state, products, slugOf, now };
}

function visit(state, at, userId = 'u1') {
  invalidateCache();
  return getHomeRecommendations(state, { userId, limit: 8, now: at }).items;
}

test('kéo làm mới trong cùng phiên không xáo lại cửa hàng', () => {
  resetImpressionLedger();
  const { state, now } = storeWithHistory();
  const first = visit(state, now);
  const refreshed = visit(state, now + 3000);
  const shared = first.filter((slug) => refreshed.includes(slug)).length;
  // ô cuối là ô khám phá, được phép đổi; bảy ô còn lại phải đứng yên
  assert.ok(shared >= 7, `chỉ còn ${shared}/8 món sau khi làm mới 3 giây`);
  assert.equal(first[0], refreshed[0]);
});

test('feed đổi món sau vài giờ nhưng giữ nguyên mỏ neo khớp mạnh nhất', () => {
  resetImpressionLedger();
  const { state, now } = storeWithHistory();
  const morning = visit(state, now);
  visit(state, now + 3 * HOUR);
  const evening = visit(state, now + 9 * HOUR);
  const nextDay = visit(state, now + 24 * HOUR);

  const shared = morning.filter((slug) => evening.includes(slug)).length;
  assert.ok(shared < 8, 'feed đóng băng: sau 9 giờ vẫn đúng 8/8 món cũ');
  assert.ok(shared >= 2, `feed đảo lộn: chỉ còn ${shared}/8 món quen sau 9 giờ`);
  assert.equal(evening[0], morning[0], 'mỏ neo hạng 1 không được đổi vì mệt mỏi hiển thị');
  assert.equal(nextDay[0], morning[0]);
});

test('nợ hiển thị phân rã: nghỉ vài ngày rồi quay lại thì món cũ được bày lại', () => {
  resetImpressionLedger();
  const { state, now } = storeWithHistory();
  const first = visit(state, now);
  [3, 9, 24].forEach((h) => visit(state, now + h * HOUR));
  const returning = visit(state, now + 96 * HOUR);
  const shared = first.filter((slug) => returning.includes(slug)).length;
  assert.ok(shared >= 4, `sau 4 ngày nghỉ chỉ có ${shared}/8 món quen quay lại`);
});

test('món vừa mua không còn được bày ở trang chủ', () => {
  resetImpressionLedger();
  const { state, products, slugOf, now } = storeWithHistory({ purchase: null });
  const bought = slugOf(products[0]);
  const before = visit(state, now);
  assert.ok(before.includes(bought), 'kịch bản chưa hợp lệ: món này vốn phải nằm trong feed');

  resetImpressionLedger();
  const owned = storeWithHistory({ purchase: bought });
  const after = [0, 3, 9, 24].map((h) => visit(owned.state, owned.now + h * HOUR));
  after.forEach((items, index) => {
    assert.ok(!items.includes(bought), `lượt ${index} vẫn bày lại món đã mua "${bought}"`);
  });
});

test('ô khám phá với tới hàng chưa ai chạm', () => {
  resetImpressionLedger();
  const { state, products, slugOf, now } = storeWithHistory();
  const coldStock = new Set(products.slice(20).map(slugOf));
  let hits = 0;
  for (let i = 0; i < 30; i += 1) {
    if (visit(state, now + i * 1800e3).some((slug) => coldStock.has(slug))) hits += 1;
  }
  // trước khi sửa: 11/30, vì ô khám phá bốc thăm theo điểm xu hướng nên hàng
  // chưa ai chạm (xu hướng = 0) gần như không bao giờ được bày
  assert.ok(hits >= 18, `chỉ ${hits}/30 lượt chạm tới kho lạnh`);
});

test('quan tâm thật xoá sạch nợ hiển thị', () => {
  resetImpressionLedger();
  const at = Date.now();
  const later = at + 8 * HOUR;
  noteImpressions('u1', ['ao-thu'], at);
  noteImpressions('u1', ['ao-thu'], at + 4 * HOUR);
  noteImpressions('u1', ['ao-thu'], later);

  const tired = impressionFatigue('u1', 'ao-thu', later + HOUR, null);
  assert.ok(tired > 0.15, `bày ba lượt mà mệt mỏi chỉ ${tired.toFixed(3)}`);

  const engaged = impressionFatigue('u1', 'ao-thu', later + HOUR, later + 60e3);
  assert.equal(engaged, 0, 'chạm vào sau khi thấy thì phải xoá nợ ngay');

  const stale = impressionFatigue('u1', 'ao-thu', later + 30 * 24 * HOUR, null);
  assert.ok(stale < 0.02, `sau một tháng nợ vẫn còn ${stale.toFixed(3)}`);
});

test('sổ hiển thị của người này không dính sang người khác', () => {
  resetImpressionLedger();
  const at = Date.now();
  [0, 4, 8].forEach((h) => noteImpressions('u1', ['ao-thu'], at + h * HOUR));
  assert.ok(impressionFatigue('u1', 'ao-thu', at + 9 * HOUR, null) > 0.15);
  assert.equal(impressionFatigue('u2', 'ao-thu', at + 9 * HOUR, null), 0);
});

// --- Bộ xếp hạng nhớ được những gì đã học ---------------------------------
//
// Trước khi sửa, `trainRanker` luôn khởi tạo bằng bốn số cứng, mà `build()`
// chạy lại mỗi khi cache 60 giây hết hạn. Nghĩa là mọi thứ nó học được đều bị
// vứt đi vài chục lần mỗi giờ: một cửa hàng chạy sáu tháng vẫn xếp hạng y như
// ngày khai trương.
const { buildAdvancedModel, usableRankWeights, COLD_RANK_WEIGHTS } = require('../lib/advancedRecommend');
const { persistRankWeights } = require('../lib/recommend');

test('bộ xếp hạng khởi động ấm từ trọng số đã học, và từ chối trọng số hỏng', () => {
  const { state } = storeWithHistory();
  const products = state.products.filter((p) => String(p.status || '') !== 'archived');
  const now = Date.now();
  const events = state.interactions
    .filter((row) => row.type === 'view')
    .map((row) => ({ userId: row.userId, productSlug: row.productId, weight: 1, at: row.createdAt }));

  const cold = buildAdvancedModel({ products, events, now });
  assert.equal(cold.diagnostics.rankerWarmStarted, false);

  const warm = buildAdvancedModel({ products, events, now, warmRankWeights: cold.rankWeights });
  assert.equal(warm.diagnostics.rankerWarmStarted, true);

  // trọng số hỏng (sai độ dài, NaN, phình vô hạn) phải rơi về khởi động nguội
  [null, [1, 2], [1, 2, 3, Number.NaN], [1, 2, 3, 9999]].forEach((broken) => {
    assert.equal(usableRankWeights(broken), null);
    const guarded = buildAdvancedModel({ products, events, now, warmRankWeights: broken });
    assert.equal(guarded.diagnostics.rankerWarmStarted, false);
  });
  assert.equal(COLD_RANK_WEIGHTS.length, 4);
});

test('trọng số đã học được ghi xuống store để lần khởi động sau dùng lại', () => {
  const { state, now } = storeWithHistory();
  invalidateCache();
  getHomeRecommendations(state, { userId: 'u1', limit: 8, now });

  let written = null;
  const update = (mutate) => { written = mutate({ ...state }); };
  assert.equal(persistRankWeights(state, update), true);
  assert.ok(Array.isArray(written.recsysModel.rankWeights));
  assert.equal(written.recsysModel.rankWeights.length, 4);
  assert.deepEqual(written.recsysModel.coldWeights, COLD_RANK_WEIGHTS);

  // có tiết lưu: lượt ghi thứ hai ngay sau đó phải bị bỏ qua
  assert.equal(persistRankWeights(state, update), false);
  assert.equal(persistRankWeights(state, null), false);
});

// Trọng số phải sống sót qua MongoDB. `serializeState()` chỉ ghi đúng danh sách
// collection cho phép, nên một khoá state mới mà không khai báo sẽ bị **rơi âm
// thầm**: tính năng khởi động ấm trông như chạy trên máy dev (db.json) nhưng
// không bao giờ có tác dụng thật trên Atlas.
const { serializeState, NORMALIZED_COLLECTIONS } = require('../lib/mongoCollections');

test('trọng số đã học sống sót qua vòng ghi MongoDB, không đẻ thêm collection', () => {
  const state = seededState();
  state.recsysModel = { rankWeights: [0.81, 0.92, 0.68, 0.4], updatedAt: 1756900000000, coldWeights: COLD_RANK_WEIGHTS };

  const collections = serializeState(state);
  const settings = new Map(collections.get('settings').map((row) => [String(row._id), row]));
  const saved = settings.get('recsys_model');

  assert.ok(saved, 'recsysModel không được ghi vào bất kỳ collection nào');
  assert.deepEqual(saved.rankWeights, [0.81, 0.92, 0.68, 0.4]);
  assert.equal(saved.updatedAt, 1756900000000);

  // cổng ERD: số collection phải đứng yên
  assert.ok(!NORMALIZED_COLLECTIONS.includes('recsys_model'));
  assert.ok(!NORMALIZED_COLLECTIONS.includes('recsysModel'));
  assert.equal(new Set(collections.keys()).size, new Set(NORMALIZED_COLLECTIONS).size);

  // store chưa từng học thì vẫn ghi một document rỗng, không phải undefined
  const fresh = serializeState(seededState());
  const freshSettings = new Map(fresh.get('settings').map((row) => [String(row._id), row]));
  assert.deepEqual(freshSettings.get('recsys_model'), { _id: 'recsys_model' });
});
