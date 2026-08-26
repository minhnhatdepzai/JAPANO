// Bộ sản phẩm Nhật Bản mới thêm vào catalog.
//
// Kiểm tra những thứ sẽ âm thầm phá thử đồ nếu sai: trùng slug/SKU, thiếu ảnh
// flat-lay, khai báo độ che phủ không khớp với loại trang phục.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { coverageProfileFor, garmentTypeFor } = require('../lib/garmentCoverage');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'mobile', 'assets', 'products');
const CATALOG_PATH = path.join(ROOT, 'backend', 'data', 'japanese-products.json');
const DB_PATH = path.join(ROOT, 'backend', 'data', 'db.json');

const catalog = fs.existsSync(CATALOG_PATH) ? JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) : [];

test('bộ bổ sung có đúng 36 sản phẩm Nhật để catalog công khai đạt 70', () => {
  assert.equal(catalog.length, 36, `hiện có ${catalog.length}`);
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const existing = new Set(db.products.map((item) => item.slug));
  const additions = catalog.filter((item) => !existing.has(item.slug));
  const visibleExisting = db.products.filter((item) =>
    !item.status || ['published', 'active'].includes(String(item.status)));
  assert.equal(visibleExisting.length + additions.length, 70,
    `sau merge sẽ có ${visibleExisting.length + additions.length} sản phẩm công khai, không phải 70`);
});

test('mỗi sản phẩm có slug và SKU duy nhất', () => {
  const slugs = catalog.map((item) => item.slug);
  const skus = catalog.map((item) => item.sku);
  assert.equal(new Set(slugs).size, slugs.length, 'slug bị trùng');
  assert.equal(new Set(skus).size, skus.length, 'SKU bị trùng');
  for (const item of catalog) {
    assert.match(item.slug, /^[a-z0-9-]+$/, `slug xấu: ${item.slug}`);
    assert.ok(item.sku, `${item.slug} thiếu SKU`);
  }
});

test('không trùng slug/SKU với catalog sẵn có', () => {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const slugs = db.products.map((item) => item.slug);
  const skus = db.products.map((item) => item.sku).filter(Boolean);
  assert.equal(new Set(slugs).size, slugs.length, 'db.json có slug trùng');
  assert.equal(new Set(skus).size, skus.length, 'db.json có SKU trùng');
});

test('mỗi sản phẩm có ảnh catalog và ảnh flat-lay thật trên đĩa', () => {
  for (const item of catalog) {
    const flat = path.join(ASSETS, `${item.slug}_tryon-flat.png`);
    const image = path.join(ASSETS, `${item.slug}_1.jpg`);
    assert.ok(fs.existsSync(flat), `${item.slug}: thiếu ảnh flat-lay`);
    assert.ok(fs.existsSync(image), `${item.slug}: thiếu ảnh catalog`);
    // Ảnh rỗng cũng là thiếu ảnh.
    assert.ok(fs.statSync(flat).size > 20000, `${item.slug}: ảnh flat-lay quá nhỏ`);
  }
});

test('mỗi sản phẩm khai báo đủ metadata bắt buộc, không dùng placeholder', () => {
  for (const item of catalog) {
    for (const field of ['name', 'kanji', 'price', 'cat', 'garmentType', 'desc', 'sizes', 'variants', 'colorHex']) {
      assert.ok(item[field], `${item.slug} thiếu ${field}`);
    }
    assert.ok(item.price > 0, `${item.slug} giá không hợp lệ`);
    assert.deepEqual(item.images, [`/assets/products/${item.slug}_1.jpg`],
      `${item.slug}: URL ảnh catalog không đúng route backend`);
    assert.equal(item.tryonFlat, `/assets/products/${item.slug}_tryon-flat.png`,
      `${item.slug}: URL ảnh flat-lay không đúng route backend`);
    assert.ok(Array.isArray(item.sizes) && item.sizes.length >= 3, `${item.slug} thiếu size`);
    assert.ok(item.variants.every((v) => v.stock >= 0), `${item.slug} tồn kho không hợp lệ`);
    assert.ok(!/placeholder|lorem|TODO/i.test(item.desc), `${item.slug} mô tả là placeholder`);
  }
});

test('garmentType khai báo khớp với bộ phân loại', () => {
  for (const item of catalog) {
    assert.equal(garmentTypeFor(item), item.garmentType,
      `${item.slug}: khai báo ${item.garmentType}`);
  }
});

test('đồ bơi và crop top được đánh dấu adultOnlyTryOn và cấm rách', () => {
  const adultTypes = new Set(['bikini_two_piece', 'bikini_top', 'bikini_bottom', 'one_piece_swimsuit', 'crop_top']);
  for (const item of catalog) {
    const profile = coverageProfileFor(item);
    if (adultTypes.has(item.garmentType)) {
      assert.equal(profile.adultOnlyTryOn, true, `${item.slug} phải là 18+`);
      assert.equal(profile.tearAllowed, false, `${item.slug} không được phép rách`);
    }
  }
});

test('mọi sản phẩm mới đều giữ kín ngực, vùng chậu và mông', () => {
  for (const item of catalog) {
    const coverage = coverageProfileFor(item).coverageProfile;
    for (const zone of ['chest', 'pelvis', 'buttocks']) {
      assert.equal(coverage[zone], 'covered', `${item.slug}.${zone}`);
    }
  }
});

test('có đủ cả trang phục truyền thống lẫn hiện đại', () => {
  const types = new Set(catalog.map((item) => item.garmentType));
  for (const traditional of ['yukata', 'kimono', 'haori', 'hakama', 'jinbei', 'samue', 'noragi', 'happi']) {
    assert.ok(types.has(traditional), `thiếu trang phục truyền thống: ${traditional}`);
  }
  for (const modern of ['crop_top', 'sleeveless_top', 'shorts', 'short_skirt',
                        'one_piece_swimsuit', 'bikini_two_piece']) {
    assert.ok(types.has(modern), `thiếu trang phục hiện đại: ${modern}`);
  }
});

test('ảnh sản phẩm được ghi nguồn và không lấy từ internet', () => {
  const credits = path.join(ASSETS, 'IMAGE-CREDITS.json');
  assert.ok(fs.existsSync(credits), 'thiếu file ghi nguồn ảnh');
  const data = JSON.parse(fs.readFileSync(credits, 'utf8'));
  for (const item of catalog) {
    const entry = data.products?.[item.slug];
    assert.ok(entry, `${item.slug} chưa được ghi nguồn ảnh`);
    assert.match(entry.source, /FLUX|sinh cục bộ/i, `${item.slug}: nguồn ảnh không rõ`);
    // Ảnh sản phẩm phải là flat-lay, không chứa hình ảnh cơ thể người.
    assert.match(entry.contains, /không có người/i, `${item.slug}: ảnh phải là flat-lay`);
  }
});

test('mọi sản phẩm có nguồn thông tin văn hoá kiểm chứng được', () => {
  const allowed = new Set(['www.kyohaku.go.jp', 'web-japan.org', 'www.gov-online.go.jp']);
  for (const item of catalog) {
    assert.ok(Array.isArray(item.informationSources) && item.informationSources.length > 0,
      `${item.slug}: thiếu nguồn thông tin`);
    for (const source of item.informationSources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:', `${item.slug}: nguồn không dùng HTTPS`);
      assert.ok(allowed.has(url.hostname), `${item.slug}: domain nguồn chưa được duyệt`);
      assert.ok(source.title, `${item.slug}: nguồn thiếu tiêu đề`);
    }
  }
});
