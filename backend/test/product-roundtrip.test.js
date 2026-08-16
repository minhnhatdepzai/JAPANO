const test = require('node:test');
const assert = require('node:assert/strict');

const { serializeState, hydrateProducts } = require('../lib/mongoCollections');
const { buildProducts, DEFINITIONS } = require('../scripts/japanoNewProducts');

// ---------------------------------------------------------------------------
// Vòng đời của một sản phẩm khi MongoDB là nguồn chính:
//   product  →  serializeState()  →  4 collection  →  hydrateProducts()  →  product
//
// Ảnh KHÔNG nằm trong product_details mà nằm ở collection product_media riêng.
// Ghi sai chỗ thì không có gì báo lỗi: insert vẫn thành công, sản phẩm vẫn lên
// app, chỉ là không có tấm ảnh nào. Nó đã xảy ra thật, và tệ hơn nữa là một lần
// MongoDB chập sau đó khiến bản thiếu ảnh ghi đè db.json.
//
// Bộ test này khoá lại chính vòng đó, để lần sau sai schema là gãy ngay ở CI
// chứ không phải khi khách mở app.
// ---------------------------------------------------------------------------

function roundTrip(products) {
  const collections = serializeState({ products });
  return hydrateProducts(
    collections.get('products'),
    collections.get('product_details'),
    collections.get('product_variants'),
    collections.get('product_media'),
  );
}

const sample = () => ({
  id: 'p-test-1', slug: 'ao-test', name: 'Áo thử nghiệm', kanji: '試', sku: 'TEST',
  cat: 'haori', category: 'haori', brand: 'JAPANO',
  price: 500000, old: 700000, sale: null, discountPercent: 29,
  status: 'published', colorHex: '#243244', rating: 0, sold: 0,
  tags: ['thử'], visualTags: ['thử'],
  desc: 'Mô tả sản phẩm thử nghiệm.', story: 'Câu chuyện sản phẩm thử nghiệm.',
  image: '/assets/products/ao-test_1.jpg',
  images: ['/assets/products/ao-test_1.jpg', '/assets/products/ao-test_2.jpg'],
  videos: [],
  variants: [
    { colorName: 'Ai', colorHex: '#243244', size: 'M', sku: 'TEST-AI-M', stock: 5 },
    { colorName: 'Ai', colorHex: '#243244', size: 'L', sku: 'TEST-AI-L', stock: 3 },
  ],
  createdAt: 1700000000000,
});

test('ảnh sản phẩm sống sót qua vòng serialize → hydrate', () => {
  const [back] = roundTrip([sample()]);
  assert.deepEqual(back.images, sample().images, 'ảnh phải quay về nguyên vẹn, đúng thứ tự');
  assert.equal(back.image, sample().images[0], 'ảnh đại diện phải là tấm đầu tiên');
});

test('mô tả, câu chuyện và thẻ không bị rơi khi tách sang product_details', () => {
  const [back] = roundTrip([sample()]);
  assert.equal(back.desc, sample().desc);
  assert.equal(back.story, sample().story);
  assert.deepEqual(back.tags, sample().tags);
  assert.equal(back.colorHex, sample().colorHex);
});

test('biến thể giữ đủ màu, size và tồn kho', () => {
  const [back] = roundTrip([sample()]);
  assert.equal(back.variants.length, 2);
  assert.equal(back.variants.reduce((sum, v) => sum + v.stock, 0), 8);
  assert.equal(back.variants[0].colorName, 'Ai');
  assert.equal(back.variants[0].size, 'M');
});

test('giá gạch (old) đi qua compareAtPrice rồi quay về đúng', () => {
  const [back] = roundTrip([sample()]);
  assert.equal(back.price, 500000);
  assert.equal(back.old, 700000);
});

test('ảnh phải nằm ở product_media, không phải product_details', () => {
  const collections = serializeState({ products: [sample()] });
  const media = collections.get('product_media') || [];
  const details = collections.get('product_details') || [];
  assert.equal(media.filter((row) => row.type === 'image').length, 2, 'hai ảnh phải thành hai document media');
  assert.ok(media.every((row) => row.productId === 'p-test-1'));
  assert.equal(details[0].images, undefined, 'product_details không được mang mảng ảnh');
});

// Đây là bài kiểm tra thật sự đáng giá: bộ sản phẩm Nhật Bản đang bán phải đi
// qua đúng vòng đó mà không rụng gì.
test('toàn bộ sản phẩm Nhật Bản trong catalog qua được vòng round-trip', () => {
  const { products } = buildProducts();
  assert.ok(products.length >= 8, `chỉ dựng được ${products.length} sản phẩm`);
  const back = new Map(roundTrip(products).map((item) => [item.slug, item]));
  for (const source of products) {
    const item = back.get(source.slug);
    assert.ok(item, `mất sản phẩm ${source.slug}`);
    assert.equal((item.images || []).length, source.images.length, `${source.slug} rụng ảnh`);
    assert.ok(String(item.desc || '').length > 0, `${source.slug} rụng mô tả`);
    assert.equal((item.variants || []).length, source.variants.length, `${source.slug} rụng biến thể`);
    assert.ok(item.variants.some((v) => Number(v.stock) > 0), `${source.slug} hết sạch tồn kho`);
  }
});

test('mọi sản phẩm xuất bản đều đạt tối thiểu 2 ảnh mà backend yêu cầu', () => {
  const { products } = buildProducts();
  for (const product of products) {
    assert.ok(product.images.length >= 2, `${product.slug} chỉ có ${product.images.length} ảnh`);
  }
});

test('catalog có ít nhất một món thân dưới để phối bộ áo + quần', () => {
  const { clothTypeFor } = require('../routes/tryon');
  const { products } = buildProducts();
  const lower = products.filter((product) => clothTypeFor(product) === 'lower');
  assert.ok(lower.length >= 1, 'không có món thân dưới nào — tính năng thử cả bộ sẽ vô dụng');
});

test('định nghĩa sản phẩm không trùng slug hay SKU', () => {
  const slugs = DEFINITIONS.map((item) => item.slug);
  const skus = DEFINITIONS.map((item) => item.sku);
  assert.equal(new Set(slugs).size, slugs.length, 'có slug trùng');
  assert.equal(new Set(skus).size, skus.length, 'có SKU trùng');
});
