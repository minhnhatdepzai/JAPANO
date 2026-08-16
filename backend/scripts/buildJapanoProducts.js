// Dựng lại các sản phẩm Nhật Bản vào db.json, mobile/assets/images.ts,
// mobile/lib/catalog.ts — và KIỂM CHỨNG trước khi ghi.
//
// Vì sao có bước kiểm chứng: lần đầu đẩy dữ liệu lên MongoDB tôi tự suy ra
// định dạng document và nhét mảng ảnh vào product_details, trong khi
// hydrateProducts() chỉ đọc ảnh từ product_media. Không có gì báo lỗi cả —
// script chạy "thành công", 9 sản phẩm lên Mongo với 0 ảnh, rồi một lần
// MongoDB chập khiến activateFileFallback() ghi đè db.json bằng bản đã hỏng.
// Mất luôn cả ảnh lẫn mô tả.
//
// Nên ở đây, trước khi ghi bất cứ file nào, state được cho đi qua đúng vòng
// serializeState → hydrateProducts mà backend dùng, rồi so lại từng trường.
// Sai định dạng là script dừng ngay, không ghi gì.
//
//   node backend/scripts/buildJapanoProducts.js            # chỉ ghi file local
//   node backend/scripts/buildJapanoProducts.js --push     # ghi file + đẩy MongoDB
require('../instrument');
const fs = require('fs');
const path = require('path');
const { serializeState, normalizeState } = require('../lib/mongoCollections');
const { buildProducts, readCredits } = require('./japanoNewProducts');

const ROOT = path.join(__dirname, '..', '..');
const DB_FILE = process.env.JAPANO_DATA_FILE || path.join(ROOT, 'backend', 'data', 'db.json');
const IMAGES_TS = path.join(ROOT, 'mobile', 'assets', 'images.ts');
const CATALOG_TS = path.join(ROOT, 'mobile', 'lib', 'catalog.ts');
const PRODUCT_COLLECTIONS = ['products', 'product_details', 'product_variants', 'product_media'];

const fail = (message) => { console.error(`✗ ${message}`); process.exit(1); };

// Chạy đúng vòng đọc–ghi của backend rồi so từng trường. Đây là chỗ bắt được
// mọi sai lệch schema, thay vì phát hiện khi sản phẩm đã lên app mà không ảnh.
function assertRoundTrip(products) {
  const { hydrateProducts } = require('../lib/mongoCollections');
  const collections = serializeState({ ...normalizeState({ products }), products });
  const hydrated = (typeof hydrateProducts === 'function'
    ? hydrateProducts(
      collections.get('products'), collections.get('product_details'),
      collections.get('product_variants'), collections.get('product_media'),
    )
    : null);
  if (!hydrated) return { skipped: true };

  const byslug = new Map(hydrated.map((item) => [item.slug, item]));
  for (const source of products) {
    const back = byslug.get(source.slug);
    if (!back) fail(`round-trip: mất hẳn sản phẩm "${source.slug}"`);
    if ((back.images || []).length !== source.images.length) {
      fail(`round-trip: "${source.slug}" có ${source.images.length} ảnh nhưng đọc lại chỉ còn ${(back.images || []).length}`);
    }
    if (String(back.desc || back.description || '') !== source.desc) {
      fail(`round-trip: "${source.slug}" mất mô tả sau khi đọc lại`);
    }
    if ((back.variants || []).length !== source.variants.length) {
      fail(`round-trip: "${source.slug}" có ${source.variants.length} biến thể nhưng đọc lại còn ${(back.variants || []).length}`);
    }
    const stock = (back.variants || []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
    if (!stock) fail(`round-trip: "${source.slug}" mất toàn bộ tồn kho`);
  }
  return { skipped: false, count: products.length };
}

function writeDbJson(products) {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const slugs = new Set(products.map((item) => item.slug));
  db.products = [...db.products.filter((item) => !slugs.has(item.slug)), ...products];
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  return db.products.length;
}

function writeImagesTs(products) {
  let source = fs.readFileSync(IMAGES_TS, 'utf8');
  const lines = [];
  for (const product of products) {
    for (const image of product.images) {
      const file = path.basename(image);
      const key = file.replace(/\.jpg$/, '');
      if (!source.includes(`'${key}'`)) lines.push(`  '${key}': require('./products/${file}'),`);
    }
  }
  if (lines.length) {
    source = `${source.replace(/\n};\s*$/, '\n')}${lines.join('\n')}\n};\n`;
    fs.writeFileSync(IMAGES_TS, source);
  }
  return lines.length;
}

function writeCatalogTs(products) {
  let source = fs.readFileSync(CATALOG_TS, 'utf8');
  let added = 0;
  const rows = [];
  for (const product of products) {
    if (source.includes(`slug:'${product.slug}'`)) continue;
    const keys = product.images.map((image) => path.basename(image).replace(/\.jpg$/, ''));
    const imgs = keys.map((key) => `IMAGES['${key}']`).join(',');
    const keyList = keys.map((key) => `'${key}'`).join(',');
    rows.push(`  { slug:'${product.slug}', name:'${product.name}', kanji:'${product.kanji}', cat:'${product.cat}', price:${product.price}, old:${product.old ?? 'null'}, rating:0, sold:0, images:[${imgs}], imageKeys:[${keyList}] },`);
    added += 1;
  }
  if (rows.length) {
    source = source.replace(/\n\];\n\nexport let PRODUCTS/, `\n${rows.join('\n')}\n];\n\nexport let PRODUCTS`);
    fs.writeFileSync(CATALOG_TS, source);
  }
  return added;
}

async function pushToMongo(products) {
  const { getDb, mongoEnabled } = require('../lib/mongo');
  if (!mongoEnabled()) { console.log('  (MONGODB_URI chưa cấu hình — bỏ qua bước đẩy)'); return; }
  const db = await getDb();
  if (!db) fail('không kết nối được MongoDB');

  const state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const collections = serializeState(state);
  const ids = new Set(products.map((item) => item.id));

  for (const name of PRODUCT_COLLECTIONS) {
    const docs = (collections.get(name) || []).filter((doc) => ids.has(String(doc.productId || doc.id)));
    const key = name === 'products' ? 'id' : 'productId';
    await db.collection(name).deleteMany({ [key]: { $in: [...ids] } });
    if (docs.length) await db.collection(name).insertMany(docs);
    console.log(`  ${name.padEnd(18)} ${docs.length} bản ghi`);
  }

  // Đọc NGƯỢC lại từ MongoDB và kiểm tra thật — "insert xong không báo lỗi"
  // không có nghĩa là dữ liệu đọc lại được đúng.
  const { loadStateFromCollections } = require('../lib/mongoCollections');
  const back = await loadStateFromCollections(db);
  for (const product of products) {
    const live = (back.products || []).find((item) => item.slug === product.slug);
    if (!live) fail(`đọc lại từ MongoDB: thiếu "${product.slug}"`);
    if ((live.images || []).length !== product.images.length) {
      fail(`đọc lại từ MongoDB: "${product.slug}" có ${(live.images || []).length}/${product.images.length} ảnh`);
    }
    if (!(live.variants || []).length) fail(`đọc lại từ MongoDB: "${product.slug}" không có biến thể`);
  }
  console.log(`  ✓ đọc lại từ MongoDB: ${products.length} sản phẩm đủ ảnh và biến thể`);
}

async function main() {
  const { products, skipped } = buildProducts();
  if (!products.length) fail('không dựng được sản phẩm nào — kiểm tra IMAGE-CREDITS.json');
  for (const item of skipped) console.log(`  ⊘ bỏ qua ${item.slug}: chỉ ${item.images} ảnh (cần ≥2)`);

  const result = assertRoundTrip(products);
  console.log(result.skipped
    ? '  (không kiểm chứng được round-trip: hydrateProducts không export)'
    : `  ✓ round-trip serialize→hydrate: ${result.count} sản phẩm giữ nguyên ảnh, mô tả, biến thể, tồn kho`);

  const total = writeDbJson(products);
  console.log(`  db.json      ${products.length} sản phẩm (tổng ${total})`);
  console.log(`  images.ts    +${writeImagesTs(products)} ảnh`);
  console.log(`  catalog.ts   +${writeCatalogTs(products)} sản phẩm`);

  if (process.argv.includes('--push')) await pushToMongo(products);

  const lower = products.filter((item) => /quần|chân váy|hakama/i.test(item.name));
  console.log(`\nXong. Sản phẩm thân dưới: ${lower.length} (${lower.map((item) => item.name).join(', ')})`);
  process.exit(0);
}

main().catch((error) => fail(error.message));
