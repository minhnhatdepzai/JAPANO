const test = require('node:test');
const assert = require('node:assert/strict');

const { adviseSize, availableSizesFor } = require('../lib/outfit');
const { imageFingerprint } = require('../lib/bodyAnalysis');
const { makeComputeSizeFit } = require('../routes/tryon');

test('người thấp nhưng nặng không còn bị ép xuống size S', () => {
  const result = adviseSize({ height: 152, weight: 78 });
  assert.notEqual(result.size, 'S');
  assert.equal(result.idealSize, 'XXXL');
  assert.match(result.advice, /chiều dài/i);
});

test('chỉ khuyên size sản phẩm đang bán và báo khi cơ thể nằm ngoài dải', () => {
  const product = { sizes: ['S', 'M', 'L', 'XL'], variants: [] };
  const result = adviseSize({ height: 158, weight: 92 }, product);
  assert.equal(result.idealSize, '4XL');
  assert.equal(result.size, 'XL');
  assert.equal(result.outsideAvailableRange, true);
  assert.deepEqual(result.availableSizes, ['S', 'M', 'L', 'XL']);
});

test('sản phẩm thiếu size không tự sinh M', () => {
  const result = adviseSize({ height: 165, weight: 58 }, { sizes: [], variants: [] });
  assert.equal(result.size, null);
  assert.equal(result.sizingMode, 'no_size');
  assert.match(result.advice, /không tự bịa size M/i);
});

test('fit dùng size cơ thể lý tưởng nhưng size khuyên vẫn thuộc catalog', () => {
  const product = { sizes: ['S', 'M', 'L', 'XL'] };
  const compute = makeComputeSizeFit(adviseSize);
  const fit = compute('S', { height: 158, weight: 92 }, { product, zone: 'upper', category: 'tops' });
  assert.equal(fit.recommendedSize, 'XL');
  assert.equal(fit.idealSize, '4XL');
  assert.equal(fit.outsideAvailableRange, true);
  assert.equal(fit.verdict, 'very_tight');
});

test('không có size đủ lớn thì Yukata được bục đường may nhưng đồ bơi vẫn bị cấm', () => {
  const product = { sizes: ['S', 'M', 'L', 'XL'] };
  const compute = makeComputeSizeFit(adviseSize);
  const common = { product, zone: 'overall', category: 'one-pieces', garmentTearAllowed: false };
  const yukata = compute('S', { height: 163, weight: 133 }, { ...common, tearWhenOutOfRange: true });
  assert.equal(yukata.outsideAvailableRange, true);
  assert.equal(yukata.tearBecauseNoSizeFits, true);
  assert.equal(yukata.visualEffect.tearAllowed, true);
  assert.ok(yukata.allowedEffects.includes('small_seam_split'));

  const swimwear = compute('S', { height: 163, weight: 133 }, { ...common, tearWhenOutOfRange: false });
  assert.equal(swimwear.visualEffect.tearAllowed, false);
});

test('cache pose chỉ dùng lại khi bytes ảnh thật sự giống nhau', () => {
  const a = 'data:image/jpeg;base64,' + Buffer.from('anh-a').toString('base64');
  const b = 'data:image/jpeg;base64,' + Buffer.from('anh-b').toString('base64');
  assert.equal(imageFingerprint(a), imageFingerprint(a.split(',')[1]));
  assert.notEqual(imageFingerprint(a), imageFingerprint(b));
});

test('size được hợp nhất từ cả product.sizes và variants, không trùng', () => {
  assert.deepEqual(availableSizesFor({ sizes: ['M', 'S'], variants: [{ size: 'L' }, { size: 'M' }] }), ['S', 'M', 'L']);
});
