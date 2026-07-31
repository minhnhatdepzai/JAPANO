const test = require('node:test');
const assert = require('node:assert/strict');

const {
  stripDataUri, normalizeImageResult, clothTypeFor, fashnCategoryFor, makeComputeSizeFit,
} = require('../routes/tryon');

test('stripDataUri chỉ giữ phần base64, giữ nguyên chuỗi không phải data URI', () => {
  assert.equal(stripDataUri('data:image/png;base64,QUJD'), 'QUJD');
  assert.equal(stripDataUri('QUJD'), 'QUJD');
  assert.equal(stripDataUri(''), '');
});

test('normalizeImageResult nhận diện base64 trần, URL và các field kết quả khác nhau', () => {
  assert.equal(normalizeImageResult({ imageBase64: 'QUJD' }), 'data:image/png;base64,QUJD');
  assert.equal(normalizeImageResult({ finalImageBase64: 'QUJD' }), 'data:image/png;base64,QUJD');
  assert.equal(normalizeImageResult({ imageUrl: 'https://x.test/a.png' }), 'https://x.test/a.png');
  assert.equal(normalizeImageResult({ urls: ['https://x.test/b.png'] }), 'https://x.test/b.png');
  assert.equal(normalizeImageResult(null), '');
});

test('clothTypeFor phân loại quần/váy, đồ liền thân và mặc định áo trên', () => {
  assert.equal(clothTypeFor({ name: 'Quần âu nam' }), 'lower');
  assert.equal(clothTypeFor({ name: 'Chân váy xếp ly' }), 'lower');
  assert.equal(clothTypeFor({ name: 'Yukata vải bông', cat: 'ao-truyen-thong' }), 'overall');
  assert.equal(clothTypeFor({ name: 'Trang phục hóa thân Naruto', cat: 'cosplay' }), 'overall');
  assert.equal(clothTypeFor({ name: 'Áo len cardigan' }), 'upper');
});

test('fashnCategoryFor ánh xạ đúng sang category API của FASHN', () => {
  assert.equal(fashnCategoryFor({ name: 'Quần âu nam' }), 'bottoms');
  assert.equal(fashnCategoryFor({ name: 'Đầm dạ hội', cat: 'dam' }), 'one-pieces');
  assert.equal(fashnCategoryFor({ name: 'Áo khoác kaki' }), 'tops');
});

test('computeSizeFit báo "good" khi size chọn trùng size gợi ý', () => {
  const computeSizeFit = makeComputeSizeFit(() => ({ size: 'M', advice: '', usedMeasurements: true }));
  const result = computeSizeFit('M', { heightCm: 165, weightKg: 55 });
  assert.equal(result.verdict, 'good');
  assert.equal(result.delta, 0);
  assert.match(result.message, /phù hợp/);
});

test('computeSizeFit báo "tight" khi khách chọn size nhỏ hơn size gợi ý', () => {
  const computeSizeFit = makeComputeSizeFit(() => ({ size: 'L', advice: '', usedMeasurements: true }));
  const result = computeSizeFit('S', { heightCm: 175, weightKg: 70 });
  assert.equal(result.verdict, 'tight');
  assert.ok(result.delta < 0);
  assert.match(result.message, /chật/);
});

test('computeSizeFit báo "loose" khi khách chọn size lớn hơn size gợi ý', () => {
  const computeSizeFit = makeComputeSizeFit(() => ({ size: 'S', advice: '', usedMeasurements: true }));
  const result = computeSizeFit('XL', { heightCm: 150, weightKg: 45 });
  assert.equal(result.verdict, 'loose');
  assert.ok(result.delta > 0);
  assert.match(result.message, /rộng/);
});

test('computeSizeFit trả "unknown" khi thiếu hồ sơ số đo hoặc size không hợp lệ', () => {
  const computeSizeFit = makeComputeSizeFit(() => ({ size: 'M', advice: '', usedMeasurements: true }));
  assert.equal(computeSizeFit('M', null).verdict, 'unknown');
  assert.equal(computeSizeFit('KHONGHOPLE', { heightCm: 165, weightKg: 55 }).verdict, 'unknown');
});
