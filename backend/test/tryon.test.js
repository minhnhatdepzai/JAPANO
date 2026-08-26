const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const {
  stripDataUri, normalizeImageResult, clothTypeFor, garmentLayerFor, shouldRefineGarment, fashnCategoryFor, makeComputeSizeFit, MAX_TRYON_ACCESSORIES, choosePassingAccessoryCandidate,
} = require('../routes/tryon');

test('biến coverageFixRequested sống tới lúc dựng response, không làm request treo', () => {
  // Regression cho lỗi production: biến từng được khai báo bên trong callback
  // runGpuJob nhưng lại đọc khi res.json ở bên ngoài. Ảnh đã tạo xong rồi
  // ReferenceError khiến client chờ tới lúc báo Network request failed.
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'tryon.js'), 'utf8');
  const declarations = [...source.matchAll(/let coverageFixRequested = false;/g)].map((match) => match.index);
  assert.equal(declarations.length, 1, 'coverageFixRequested phải chỉ có một khai báo');
  assert.ok(declarations[0] < source.indexOf("await runGpuJob('tryon'"),
    'coverageFixRequested phải nằm ngoài callback runGpuJob');
  assert.ok(source.indexOf('coverageFixRequested,', declarations[0]) > declarations[0],
    'response phải dùng lại biến đã khai báo ở scope handler');
});

test('giới hạn ba phụ kiện để không rơi về bản ghép dán thô', () => {
  assert.equal(MAX_TRYON_ACCESSORIES, 3);
});

test('không bao giờ chọn ảnh phụ kiện dán thô làm kết quả trả về', () => {
  const raw = { image:'raw-image', stage:'accessory-pose-fallback', quality:{ ok:true, score:1 } };
  const refined = { image:'refined-image', stage:'flux-accessory-refine', quality:{ ok:true, score:8 } };
  assert.equal(choosePassingAccessoryCandidate([raw, refined]), refined);
  assert.equal(choosePassingAccessoryCandidate([raw]), null);
});

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

test('garmentLayerFor phân biệt áo trong với Haori khoác ngoài', () => {
  assert.equal(garmentLayerFor({ name: 'Sơ mi trắng', cat: 'trang-phuc' }), 'upper-base');
  assert.equal(garmentLayerFor({ name: 'Áo choàng Haori', cat: 'haori' }), 'upper-outer');
  assert.equal(garmentLayerFor({ name: 'Hakama nữ' }), 'lower');
});

test('Haori flat-lay luôn đối chiếu lại chiều dài và tay áo dù refine toàn cục đang tắt', () => {
  const haori = { name: 'Áo choàng Haori', cat: 'haori' };
  const shirt = { name: 'Sơ mi trắng', cat: 'trang-phuc' };
  assert.equal(shouldRefineGarment(haori, '/tmp/haori-dang-dai_tryon-flat.png', false), true);
  assert.equal(shouldRefineGarment(shirt, '/tmp/so-mi-trang_tryon-flat.png', false), false);
  assert.equal(shouldRefineGarment(haori, '/tmp/haori-dang-dai_1.jpg', true), false);
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
  // Từ "chật" nằm ở tiêu đề banner; phần message mô tả hiệu ứng đang được dựng
  // trên ảnh, vì đây không còn là một cảnh báo suông nữa.
  assert.match(result.title, /Chật/);
  assert.match(result.message, /căng/);
});

// Lệch 3 bậc size không còn được gộp chung với lệch 1 bậc: thang đánh giá giờ
// có bảy mức, và chính mức này quyết định cường độ hiệu ứng vải rủ trên ảnh.
test('computeSizeFit báo "very_loose" khi khách chọn size lớn hơn hẳn size gợi ý', () => {
  const computeSizeFit = makeComputeSizeFit(() => ({ size: 'S', advice: '', usedMeasurements: true }));
  const result = computeSizeFit('XL', { heightCm: 150, weightKg: 45 });
  assert.equal(result.verdict, 'very_loose');
  assert.ok(result.delta > 0);
  assert.ok(result.severity > 0.72);
  assert.match(result.title, /rộng/);
  assert.match(result.message, /rộng/);
});

test('computeSizeFit trả "unknown" khi thiếu hồ sơ số đo hoặc size không hợp lệ', () => {
  const computeSizeFit = makeComputeSizeFit(() => ({ size: 'M', advice: '', usedMeasurements: true }));
  assert.equal(computeSizeFit('M', null).verdict, 'unknown');
  assert.equal(computeSizeFit('KHONGHOPLE', { heightCm: 165, weightKg: 55 }).verdict, 'unknown');
});

// ---------------------------------------------------------------------------
// Mặc thử nhiều món cùng lúc (áo + quần + phụ kiện).
//
// FASHN VTON thay đúng một lớp mỗi lượt, nên nhiều món được ghép nối tiếp.
// Bộ test này cho phép áo trong + áo khoác, nhưng vẫn khoá những tổ hợp cùng
// một lớp vì món sau sẽ đè mất món trước.
// ---------------------------------------------------------------------------
const { resolveOutfitGarments } = require('../routes/tryon');
const { httpError: makeHttpError } = require('../lib/httpError');
const { resolveGarmentImage } = require('../lib/garmentImages');

test('Haori dùng ảnh flat-lay đã duyệt thay vì bộ ảnh khăn bị gắn nhầm', () => {
  assert.equal(path.basename(resolveGarmentImage('haori-dang-dai')), 'haori-dang-dai_tryon-flat.png');
});

function outfitState() {
  return {
    products: [
      { id: 'p1', slug: 'so-mi-trang', name: 'Sơ mi trắng tay ngắn', cat: 'trang-phuc' },
      { id: 'p2', slug: 'haori-dang-dai', name: 'Áo choàng Haori dáng dài', cat: 'haori' },
      { id: 'p3', slug: 'hakama-nu', name: 'Hakama nữ vải dày', cat: 'ao-truyen-thong' },
      { id: 'p4', slug: 'kimono-hong', name: 'Kimono truyền thống Hồng', cat: 'ao-truyen-thong' },
      { id: 'p5', slug: 'balo-vai', name: 'Balo vải Nhật', cat: 'phu-kien' },
      { id: 'p6', slug: 'ao-len-co-lo', name: 'Áo len cổ lọ', cat: 'trang-phuc' },
    ],
  };
}

test('mặc quần trước rồi mới tới áo, để vạt áo nằm ngoài cạp quần', () => {
  const state = outfitState();
  // hakama-nu là "chân váy/quần" theo clothTypeFor nên phải xuống lượt đầu.
  const garments = resolveOutfitGarments(state, ['so-mi-trang', 'hakama-nu'], makeHttpError);
  assert.equal(garments.length, 2);
  assert.equal(garments[0].zone, 'lower', 'món thân dưới phải được mặc trước');
  assert.equal(garments[1].zone, 'upper');
});

test('bộ liền thân không mặc chồng thêm món nào khác', () => {
  const state = outfitState();
  assert.throws(
    () => resolveOutfitGarments(state, ['kimono-hong', 'so-mi-trang'], makeHttpError),
    /bộ liền thân đã phủ kín người/,
  );
  // nhưng thử riêng thì hoàn toàn hợp lệ
  assert.equal(resolveOutfitGarments(state, ['kimono-hong'], makeHttpError).length, 1);
});

test('sơ mi và Haori được phối lớp, luôn mặc áo trong trước áo khoác', () => {
  const state = outfitState();
  const garments = resolveOutfitGarments(state, ['haori-dang-dai', 'so-mi-trang'], makeHttpError);
  assert.deepEqual(garments.map((item) => item.product.slug), ['so-mi-trang', 'haori-dang-dai']);
  assert.deepEqual(garments.map((item) => item.layer), ['upper-base', 'upper-outer']);
});

test('hai áo cùng là lớp trong vẫn bị chặn vì món sau sẽ xoá món trước', () => {
  const state = outfitState();
  assert.throws(
    () => resolveOutfitGarments(state, ['so-mi-trang', 'ao-len-co-lo'], makeHttpError),
    /một áo lớp trong/,
  );
});

test('phụ kiện phải đi đường phụ kiện, không nằm trong danh sách trang phục', () => {
  const state = outfitState();
  assert.throws(
    () => resolveOutfitGarments(state, ['so-mi-trang', 'balo-vai'], makeHttpError),
    /là phụ kiện/,
  );
});

test('sản phẩm không tồn tại và danh sách rỗng đều bị chặn với lý do rõ ràng', () => {
  const state = outfitState();
  assert.throws(() => resolveOutfitGarments(state, ['khong-co-that'], makeHttpError), /Không tìm thấy sản phẩm/);
  assert.throws(() => resolveOutfitGarments(state, [], makeHttpError), /Chưa chọn trang phục nào/);
});

test('slug trùng lặp chỉ được tính một lần, không tự tạo xung đột giả', () => {
  const state = outfitState();
  const garments = resolveOutfitGarments(state, ['so-mi-trang', 'so-mi-trang'], makeHttpError);
  assert.equal(garments.length, 1);
});
