const test = require('node:test');
const assert = require('node:assert/strict');

const { adviseSize } = require('../lib/outfit');
const { makeComputeSizeFit } = require('../routes/tryon');

// Chính sách vết bục đường may.
//
// Yêu cầu sản phẩm: người 90-100kg mặc size S hoặc M thì PHẢI thấy vết nứt —
// không phụ thuộc shop còn size lớn hơn hay không. Bản trước bám vào
// `tearBecauseNoSizeFits` (catalog hết size) nên chính người đó tự chọn size S ở
// một shop bán tới 5XL vẫn ra ảnh phẳng lì.
//
// Chốt an toàn đi kèm: lệnh cấm bục của từng loại trang phục là TUYỆT ĐỐI. Hết
// size không phải lý do để làm hở thêm cơ thể.

const compute = makeComputeSizeFit(adviseSize);
const HEAVY = { height: 150.7, weight: 95 };     // ~ ảnh test người rất mập
const SMALL_CATALOG = { sizes: ['S', 'M', 'L', 'XL', 'XXL'] };
const FULL_CATALOG = { sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'] };
const TOP = { zone: 'upper', category: 'tops', tearWhenOutOfRange: true };

for (const size of ['S', 'M']) {
  test(`người 95kg mặc size ${size} phải bục — kể cả khi shop CÒN size lớn hơn`, () => {
    const fit = compute(size, HEAVY, { ...TOP, product: FULL_CATALOG });
    assert.equal(fit.outsideAvailableRange, false, 'shop có 5XL nên không phải hết size');
    assert.equal(fit.verdict, 'very_tight');
    assert.equal(fit.visualEffect.tearAllowed, true);
    assert.ok(fit.allowedEffects.includes('small_seam_split'));
  });

  test(`người 95kg mặc size ${size} phải bục — khi shop HẾT size lớn`, () => {
    const fit = compute(size, HEAVY, { ...TOP, product: SMALL_CATALOG });
    assert.equal(fit.outsideAvailableRange, true);
    assert.equal(fit.visualEffect.tearAllowed, true);
    assert.ok(fit.allowedEffects.includes('small_seam_split'));
  });
}

test('người cân đối chọn nhỏ 1-2 bậc thì KHÔNG bục, chỉ căng vải', () => {
  const slim = compute('S', { height: 165, weight: 55 }, { ...TOP, product: SMALL_CATALOG });
  assert.equal(slim.verdict, 'slightly_tight');
  assert.equal(slim.visualEffect.tearAllowed, false);

  const medium = compute('S', { height: 165, weight: 70 }, { ...TOP, product: SMALL_CATALOG });
  assert.equal(medium.verdict, 'tight');
  assert.equal(medium.visualEffect.tearAllowed, false);
  assert.ok(!medium.allowedEffects.includes('small_seam_split'));
});

test('kimono/yukata bị cấm bục vì KẾT CẤU thì hết size vẫn được bục', () => {
  // Khác với đồ bơi: cấm ở đây là để giữ đúng phom áo, không phải vì nguy cơ hở
  // cơ thể. Khi khách đã vượt mọi size đang bán, cho thấy đường may bục trung
  // thực hơn một tấm ảnh phẳng lì.
  const fit = compute('S', { height: 163, weight: 133 }, {
    product: { sizes: ['S', 'M', 'L', 'XL'] }, zone: 'overall', category: 'one-pieces',
    garmentTearAllowed: false, tearBlockReason: 'construction', tearWhenOutOfRange: true,
  });
  assert.equal(fit.outsideAvailableRange, true);
  assert.equal(fit.visualEffect.tearAllowed, true);
});

test('trang phục cấm bục vì AN TOÀN thì hết size cũng KHÔNG được bục', () => {
  // Crop top: garmentCoverage đặt tearAllowed=false vì hở bụng. Nó không phải đồ
  // bơi và thuộc vùng trên, nên nhánh `|| tearBecauseNoSizeFits` cũ đã vô hiệu
  // hoá đúng lệnh cấm này.
  const fit = compute('S', HEAVY, {
    ...TOP, product: SMALL_CATALOG, garmentTearAllowed: false, tearBlockReason: 'safety',
  });
  assert.equal(fit.outsideAvailableRange, true, 'đúng là đã hết size');
  assert.equal(fit.verdict, 'very_tight');
  assert.equal(fit.visualEffect.tearAllowed, false, 'nhưng vẫn không được bục');
  assert.ok(!fit.allowedEffects.includes('small_seam_split'));
  assert.ok(!fit.allowedEffects.includes('seam_separation'));
});

test('quần/váy không bao giờ bục dù rất chật', () => {
  const fit = compute('S', HEAVY, {
    zone: 'lower', category: 'bottoms', product: SMALL_CATALOG, tearWhenOutOfRange: false,
  });
  assert.equal(fit.visualEffect.tearAllowed, false);
});

test('đồ bơi rất chật chỉ căng vải, không tách đường may', () => {
  const fit = compute('S', HEAVY, {
    ...TOP, product: SMALL_CATALOG, garmentTearAllowed: false,
    tearBlockReason: 'safety', tearWhenOutOfRange: false,
  });
  assert.equal(fit.visualEffect.tearAllowed, false);
  assert.ok(!fit.allowedEffects.includes('seam_separation'));
});

test('garmentCoverage phân biệt được hai lý do cấm bục', () => {
  const { safetyPolicyFor } = require('../lib/garmentCoverage');
  assert.equal(safetyPolicyFor([{ name: 'Yukata vải bông' }]).tearBlockReason, 'construction');
  assert.equal(safetyPolicyFor([{ name: 'Áo croptop trắng' }]).tearBlockReason, 'safety');
  assert.equal(safetyPolicyFor([{ name: 'Bikini hai mảnh' }]).tearBlockReason, 'safety');
  assert.equal(safetyPolicyFor([{ name: 'Quần short kaki' }]).tearBlockReason, 'safety');
  assert.equal(safetyPolicyFor([{ name: 'Áo thun cotton basic' }]).tearBlockReason, null);
});
