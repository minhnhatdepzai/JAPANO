#!/usr/bin/env node
/**
 * Materialize danh mục địa điểm đang hiển thị trong app vào Atlas.
 *
 *   node scripts/sync_japan_spots.js             # chỉ kiểm tra, không ghi
 *   node scripts/sync_japan_spots.js --apply     # upsert, không xoá document
 *
 * Mobile vẫn có dữ liệu đóng gói để mở được khi mất mạng. MongoDB là bản danh
 * mục nghiệp vụ cho API/Admin/Compass; chỉ lưu URL ảnh và nguồn, không lưu blob.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'node_modules/dotenv')).config({
  path: path.join(ROOT, '.env.server'),
  quiet: true,
});
const ts = require(path.join(ROOT, 'node_modules/typescript'));
const { MongoClient } = require(path.join(ROOT, 'node_modules/mongodb'));

function loadMobileCatalog() {
  const file = path.join(ROOT, 'mobile', 'lib', 'japanSpots.ts');
  const source = fs.readFileSync(file, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(javascript, { module, exports: module.exports }, {
    filename: file,
    timeout: 5_000,
  });
  const { SPOTS, REGION_OF_PREFECTURE, PREFECTURE_VIDEO } = module.exports;
  if (!Array.isArray(SPOTS) || !SPOTS.length) throw new Error('Không đọc được SPOTS từ mobile/lib/japanSpots.ts.');
  return { spots: SPOTS, regions: REGION_OF_PREFECTURE || {}, videos: PREFECTURE_VIDEO || {} };
}

function safeId(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = String(process.env.MONGODB_URI || '').trim();
  const database = String(process.env.MONGODB_DB || 'japano').trim();
  if (!uri) throw new Error('Thiếu MONGODB_URI trong .env.server.');

  const catalog = loadMobileCatalog();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20_000 });
  await client.connect();
  try {
    const db = client.db(database);
    const products = await db.collection('products').find({}, { projection: { _id: 0, id: 1, slug: 1 } }).toArray();
    const productBySlug = new Map(products.map((product) => [String(product.slug || ''), String(product.id || '')]));
    const missingProducts = [...new Set(catalog.spots.map((spot) => spot.slug).filter((slug) => !productBySlug.has(String(slug))))];
    if (missingProducts.length) throw new Error(`Địa điểm trỏ tới sản phẩm không tồn tại: ${missingProducts.join(', ')}`);

    const docs = catalog.spots.map((spot, position) => {
      const id = `jspot-${safeId(spot.prefecture)}-${safeId(spot.place)}`;
      const { slug, time, tip, ...content } = spot;
      return {
        _id: id,
        id,
        ...content,
        region: String(catalog.regions[spot.prefecture] || ''),
        bestTime: time,
        photoTip: tip,
        productId: productBySlug.get(String(slug)),
        productSlug: slug,
        prefectureVideoId: catalog.videos[spot.prefecture] || null,
        active: true,
        position,
      };
    });
    const duplicateIds = docs.filter((doc, index) => docs.findIndex((other) => other.id === doc.id) !== index);
    const duplicatePlaces = docs.filter((doc, index) => docs.findIndex((other) => other.place === doc.place && other.prefecture === doc.prefecture) !== index);
    if (duplicateIds.length || duplicatePlaces.length) throw new Error('Danh mục có mã hoặc cặp địa điểm/tỉnh bị trùng.');

    const before = await db.collection('japan_spots').countDocuments({}).catch(() => 0);
    console.log(`database    : ${database}`);
    console.log(`mobile      : ${docs.length} địa điểm`);
    console.log(`japan_spots : ${before} document hiện có`);
    console.log(`sản phẩm    : ${productBySlug.size} slug, 0 tham chiếu thiếu`);

    if (!apply) {
      console.log('\n[dry-run] Không ghi gì. Chạy lại với --apply để upsert danh mục.');
      return;
    }

    const collection = db.collection('japan_spots');
    await collection.bulkWrite(docs.map((document) => ({
      replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true },
    })), { ordered: false });
    await collection.createIndex({ id: 1 }, { unique: true, name: 'uq_japan_spots_id' });
    await collection.createIndex({ place: 1, prefecture: 1 }, { unique: true, name: 'uq_japan_spots_place_prefecture' });
    await collection.createIndex({ prefecture: 1, active: 1 }, { name: 'ix_japan_spots_prefecture_active' });
    await collection.createIndex({ productId: 1 }, { name: 'ix_japan_spots_product' });

    const ids = docs.map((doc) => doc.id);
    const written = await collection.countDocuments({ id: { $in: ids } });
    const unresolved = await collection.countDocuments({ id: { $in: ids }, productId: { $nin: [...productBySlug.values()] } });
    if (written !== docs.length || unresolved) throw new Error(`Kiểm tra sau ghi thất bại: ${written}/${docs.length}, ${unresolved} tham chiếu sai.`);
    console.log(`\nĐÃ GHI      : ${written} địa điểm, ${unresolved} tham chiếu sản phẩm sai`);
    console.log('Không xoá hoặc sửa collection nghiệp vụ nào khác.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('LỖI:', error.message);
  process.exitCode = 1;
});
