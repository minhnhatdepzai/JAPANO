const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  recommendForSpot, sizeFromBody, sizesInStock, inStock, currentSeason, WEIGHTS,
} = require('../lib/japanSpotRecommendations');
const { SCENES, scenesForSpot, findScene, sceneImagePath } = require('../lib/japanScenes');
const { NORMALIZED_COLLECTIONS } = require('../lib/mongoCollections');

// Catalog thật của shop. Gợi ý chỉ được lấy từ đây — không có sản phẩm dựng sẵn
// nào trong bài kiểm tra, vì cái cần chứng minh là "sản phẩm gợi ý có thật".
const DB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'db.json'), 'utf8'));
const PRODUCTS = DB.products || [];

const SHRINE = { place: 'Đền Fushimi Inari', prefecture: 'Kyoto' };
const BEACH = { place: 'Thuỷ cung Churaumi', prefecture: 'Okinawa' };
const SWIM_TYPES = ['bikini_two_piece', 'one_piece_swimsuit', 'crop_top'];

const isSwim = (item) => SWIM_TYPES.includes(String(item.product.garmentType || ''));

test('1. gợi ý chỉ trả sản phẩm có thật trong catalog', () => {
  const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));
  const { recommendations } = recommendForSpot(PRODUCTS, { ...SHRINE, limit: 20 });
  assert.ok(recommendations.length >= 5, `chỉ có ${recommendations.length} gợi ý`);
  for (const item of recommendations) {
    assert.ok(bySlug.has(item.product.slug), `sản phẩm "${item.product.slug}" không có trong catalog`);
    assert.equal(item.product.name, bySlug.get(item.product.slug).name);
  }
});

test('2. không gợi ý sản phẩm hết hàng', () => {
  const { recommendations } = recommendForSpot(PRODUCTS, { ...SHRINE, limit: 40 });
  for (const item of recommendations) {
    assert.ok(inStock(item.product), `${item.product.slug} đã hết hàng mà vẫn được gợi ý`);
    assert.ok(sizesInStock(item.product).length > 0, `${item.product.slug} không còn size nào`);
  }
});

test('3. size gợi ý đi theo hồ sơ cơ thể', () => {
  assert.equal(sizeFromBody({ height: 160, weight: 45 }), 'S');
  assert.equal(sizeFromBody({ height: 165, weight: 55 }), 'M');
  assert.equal(sizeFromBody({ height: 168, weight: 70 }), 'L');
  // 175cm/80kg cho BMI 26,1 — vừa qua ngưỡng XL.
  assert.equal(sizeFromBody({ height: 175, weight: 80 }), 'XL');
  // 165cm/82kg cho BMI 30,1, tức là đã qua ngưỡng XXL chứ không còn XL. Ngưỡng
  // này phải trùng với localSize() ở mobile/app/tryon.tsx, nếu không màn gợi ý
  // và màn thử đồ sẽ nói hai cỡ khác nhau cho cùng một người.
  assert.equal(sizeFromBody({ height: 165, weight: 82 }), 'XXL');
  // 158cm/95kg cho BMI 38,1 — localSize() ở mobile trả 4XL, nên ở đây cũng phải
  // là 4XL. Bản đầu thiếu bậc này và trả XXXL.
  assert.equal(sizeFromBody({ height: 158, weight: 95 }), '4XL');
  assert.equal(sizeFromBody({ height: 180, weight: 105 }), 'XXXL');
  assert.equal(sizeFromBody({ height: 175, weight: 130 }), '5XL');
  assert.equal(sizeFromBody({ height: 170, weight: 0 }), null, 'không có cân nặng thì không đoán size');

  const slim = recommendForSpot(PRODUCTS, { ...SHRINE, body: { height: 165, weight: 52 }, limit: 5 });
  const heavy = recommendForSpot(PRODUCTS, { ...SHRINE, body: { height: 158, weight: 95 }, limit: 5 });
  assert.notDeepEqual(
    slim.recommendations.map((r) => r.recommendedSize),
    heavy.recommendations.map((r) => r.recommendedSize),
    'hai hồ sơ cơ thể rất khác nhau mà ra cùng một bộ size',
  );
});

test('4. mùa và màu thực sự làm đổi điểm', () => {
  const summer = recommendForSpot(PRODUCTS, { ...SHRINE, season: 'hè', limit: 40 });
  const winter = recommendForSpot(PRODUCTS, { ...SHRINE, season: 'đông', limit: 40 });
  const scoreOf = (result, slug) => result.recommendations.find((r) => r.product.slug === slug)?.score;

  const changed = summer.recommendations.some((item) => scoreOf(winter, item.product.slug) !== item.score);
  assert.ok(changed, 'đổi mùa mà không sản phẩm nào đổi điểm');

  // Màu: cùng một địa điểm, hai sản phẩm khác màu phải cho colorHarmony khác nhau.
  const harmonies = new Set(summer.recommendations.map((r) => r.colorHarmony));
  assert.ok(harmonies.size > 1, 'mọi sản phẩm đều cùng một mức hoà màu — điểm màu không hoạt động');

  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100, 'thang điểm phải cộng đúng 100');
});

test('5. đền/chùa KHÔNG BAO GIỜ gợi ý đồ bơi, kể cả khi đã xác nhận 18+', () => {
  for (const adultAllowed of [false, true]) {
    const { recommendations } = recommendForSpot(PRODUCTS, { ...SHRINE, limit: 40, adultAllowed });
    const swim = recommendations.filter(isSwim);
    assert.equal(swim.length, 0,
      `đền gợi ý ${swim.map((s) => s.product.name).join(', ')} với adultAllowed=${adultAllowed}`);
  }
});

test('6. địa điểm biển gợi ý đồ bơi CHỈ khi đã qua cổng người lớn', () => {
  const withConsent = recommendForSpot(PRODUCTS, { ...BEACH, limit: 40, adultAllowed: true });
  const without = recommendForSpot(PRODUCTS, { ...BEACH, limit: 40, adultAllowed: false });
  assert.ok(withConsent.recommendations.filter(isSwim).length > 0, 'biển + 18+ mà không có đồ bơi nào');
  assert.equal(without.recommendations.filter(isSwim).length, 0, 'chưa xác nhận 18+ mà vẫn hiện đồ bơi');
});

test('7. chỉ danh mục địa điểm được lưu; scene/gợi ý/ảnh ghép không tạo bảng', () => {
  // Danh mục địa điểm là master data người dùng nhìn thấy nên được lưu thật.
  assert.equal(NORMALIZED_COLLECTIONS.includes('japan_spots'), true);
  // Gợi ý, scene và ảnh ghép là dữ liệu suy ra hoặc file tĩnh, không lưu DB.
  for (const name of ['japan_scenes', 'spot_recommendations', 'scene_photos', 'tryon_results']) {
    assert.equal(NORMALIZED_COLLECTIONS.includes(name), false, `${name} đã bị thêm vào tập ghi MongoDB`);
  }
  assert.equal(NORMALIZED_COLLECTIONS.length, 30, 'chỉ được tăng đúng một collection danh mục');
});

test('8. đổi sản phẩm không phụ thuộc ảnh hay địa điểm — gợi ý ổn định', () => {
  const first = recommendForSpot(PRODUCTS, { ...SHRINE, season: 'thu', body: { height: 165, weight: 55 }, limit: 8 });
  const second = recommendForSpot(PRODUCTS, { ...SHRINE, season: 'thu', body: { height: 165, weight: 55 }, limit: 8 });
  assert.deepEqual(
    first.recommendations.map((r) => [r.product.slug, r.score]),
    second.recommendations.map((r) => [r.product.slug, r.score]),
    'cùng đầu vào mà hai lần gọi cho kết quả khác nhau',
  );
});

test('9. mỗi gợi ý phải kèm lý do lấy từ dữ liệu thật', () => {
  const { recommendations } = recommendForSpot(PRODUCTS, { ...SHRINE, body: { height: 165, weight: 55 }, limit: 8 });
  for (const item of recommendations) {
    assert.ok(item.reasons.length > 0, `${item.product.slug} không có lý do nào`);
    for (const reason of item.reasons) {
      assert.ok(reason.length > 12, `lý do quá ngắn: "${reason}"`);
      assert.ok(!/hợp với địa điểm\.?$/i.test(reason), `lý do chung chung: "${reason}"`);
    }
    assert.ok(['high', 'medium', 'low'].includes(item.fitConfidence));
    assert.ok(item.score >= 0 && item.score <= 100);
  }
});

test('10. thêm vào giỏ dùng đúng size CÒN HÀNG của đúng sản phẩm', () => {
  const { recommendations } = recommendForSpot(PRODUCTS, { ...SHRINE, body: { height: 165, weight: 55 }, limit: 10 });
  for (const item of recommendations) {
    if (!item.recommendedSize) continue;
    const available = sizesInStock(item.product);
    assert.ok(available.includes(item.recommendedSize),
      `${item.product.slug}: gợi ý size ${item.recommendedSize} nhưng chỉ còn ${available.join(', ')}`);
  }
});

test('11. khoá cache không được trộn hai địa điểm hay hai hồ sơ', () => {
  // Cache của route khoá theo [place, prefecture, season, bucket, limit, adult,
  // catalogVersion]. Ở đây kiểm phần quan trọng nhất: cùng tham số khác địa điểm
  // thì kết quả phải khác nhau, nếu không việc trộn khoá sẽ không ai phát hiện.
  const shrine = recommendForSpot(PRODUCTS, { ...SHRINE, limit: 6 });
  const beach = recommendForSpot(PRODUCTS, { ...BEACH, limit: 6 });
  assert.notDeepEqual(
    shrine.recommendations.map((r) => r.product.slug),
    beach.recommendations.map((r) => r.product.slug),
    'hai địa điểm rất khác nhau mà cho cùng danh sách',
  );
  assert.notEqual(shrine.profile.sceneColorName, beach.profile.sceneColorName);
});

test('12. mùa hiện tại luôn là một trong bốn mùa', () => {
  assert.ok(['xuân', 'hè', 'thu', 'đông'].includes(currentSeason()));
  assert.equal(currentSeason(new Date('2026-04-10')), 'xuân');
  assert.equal(currentSeason(new Date('2026-07-10')), 'hè');
  assert.equal(currentSeason(new Date('2026-10-10')), 'thu');
  assert.equal(currentSeason(new Date('2026-01-10')), 'đông');
});

// ---- Góc chụp -------------------------------------------------------------

test('scene: mỗi góc chụp có đủ giấy phép, nguồn và file ảnh', () => {
  assert.ok(SCENES.length >= 3, `chỉ có ${SCENES.length} góc chụp`);
  for (const scene of SCENES) {
    for (const field of ['sourceUrl', 'author', 'license', 'licenseUrl', 'attribution', 'checkedAt']) {
      assert.ok(scene[field], `${scene.id} thiếu ${field}`);
    }
    assert.ok(fs.existsSync(sceneImagePath(scene)), `${scene.id} thiếu file ảnh`);
  }
});

// Đây là bài giữ đúng lỗi đã sinh ra cả nhiệm vụ này: ảnh Naoshima cũ chụp từ
// ngoài biển nên chỗ đặt chân là mặt nước.
test('scene: điểm đặt chân phải nằm trong vùng mặt đất', () => {
  const inside = (point, polygon) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if ((yi > point[1]) !== (yj > point[1])
        && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + Number.EPSILON) + xi) hit = !hit;
    }
    return hit;
  };
  for (const scene of SCENES) {
    const { footAnchor, groundPolygon, personSlots } = scene.composition;
    assert.ok(inside([footAnchor.x, footAnchor.y], groundPolygon),
      `${scene.id}: footAnchor không đứng trên mặt đất`);
    for (const slot of personSlots) {
      assert.ok(inside([slot.x, footAnchor.y], groundPolygon),
        `${scene.id}: vị trí "${slot.id}" không đứng trên mặt đất`);
    }
  }
});

test('scene: Naoshima đã có góc chụp thay cho ảnh chụp ngoài biển', () => {
  const naoshima = scenesForSpot('Đảo nghệ thuật Naoshima', 'Kagawa');
  assert.ok(naoshima.length >= 2, `Naoshima chỉ có ${naoshima.length} góc chụp`);
  for (const scene of naoshima) {
    const full = findScene(scene.id);
    assert.ok(['bê tông', 'đường nhựa', 'đá lát', 'sàn gỗ', 'cỏ', 'cát'].includes(full.groundType),
      `${scene.id}: groundType "${full.groundType}" không phải mặt đất đứng được`);
  }
});

test('scene: danh sách công khai không lộ đường dẫn đĩa', () => {
  for (const scene of scenesForSpot('Đền Fushimi Inari', 'Kyoto')) {
    const serialized = JSON.stringify(scene);
    assert.equal('imageFile' in scene, false, `${scene.id} lộ tên file gốc`);
    assert.equal(serialized.includes('/home/'), false, `${scene.id} lộ đường dẫn tuyệt đối`);
    assert.ok(scene.footAnchor && scene.personSlots, 'app cần footAnchor và slot để vẽ hình bóng mờ');
  }
});

test('scene: địa điểm chưa curate thì trả rỗng, không ghép bừa', () => {
  assert.deepEqual(scenesForSpot('Kênh Otaru', 'Hokkaido'), []);
  assert.deepEqual(scenesForSpot('không tồn tại', 'không tồn tại'), []);
  assert.equal(findScene('khong-co'), null);
});
