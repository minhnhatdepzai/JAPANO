const test = require('node:test');
const assert = require('node:assert/strict');

// Chỉ test các hàm thuần/đồng bộ — không gọi embedText() thật ở đây để suite
// test giữ được tốc độ nhanh, offline (tải model MiniLM cần mạng + vài giây).
const { cosineSimilarity, productText } = require('../lib/embeddings');

test('cosineSimilarity trả 1 cho hai vector giống hệt, 0 cho vector rỗng/lệch chiều', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosineSimilarity(null, [1, 0, 0]), 0);
  assert.equal(cosineSimilarity([1, 0], [1, 0, 0]), 0);
});

test('cosineSimilarity trả 0 cho hai vector trực giao', () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test('productText gộp tên, danh mục và tag thành một chuỗi để embed', () => {
  const text = productText({
    name: 'Kimono hồng', kanji: '着物', cat: 'ao-truyen-thong', garmentType: 'kimono',
    tags: ['truyền thống', 'lụa'], desc: 'Trang phục dự tiệc mùa xuân', story: 'Lấy cảm hứng từ kosode.',
  });
  assert.match(text, /Kimono hồng/);
  assert.match(text, /着物/);
  assert.match(text, /ao-truyen-thong/);
  assert.match(text, /kimono/);
  assert.match(text, /truyền thống/);
  assert.match(text, /dự tiệc mùa xuân/);
  assert.match(text, /kosode/);
});

test('productText trả rỗng khi sản phẩm thiếu dữ liệu', () => {
  assert.equal(productText({}), '');
  assert.equal(productText(null), '');
});
