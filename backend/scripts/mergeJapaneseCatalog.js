// Gộp bộ sản phẩm Nhật Bản (backend/data/japanese-products.json) vào catalog.
//
//   node backend/scripts/mergeJapaneseCatalog.js          # xem trước
//   node backend/scripts/mergeJapaneseCatalog.js --write   # ghi vào db.json
//
// Chạy được nhiều lần: sản phẩm đã có thì CẬP NHẬT metadata, không tạo bản sao.
// Ảnh không đi vào db.json — chúng nằm ở mobile/assets/products/ và được tham
// chiếu qua slug, đúng như các sản phẩm sẵn có.
//
// Nguồn dữ liệu thật có thể là MongoDB (theo .env.server) chứ không phải
// db.json. Script vì vậy ghi qua chính store của ứng dụng thay vì sửa file —
// sửa db.json khi backend đang chạy Mongo sẽ không có tác dụng gì.
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.server') });

const ROOT = path.join(__dirname, '..', '..');
const DB = path.join(ROOT, 'backend', 'data', 'db.json');
const CATALOG = path.join(ROOT, 'backend', 'data', 'japanese-products.json');
const ASSETS = path.join(ROOT, 'mobile', 'assets', 'products');

async function main() {
  const write = process.argv.includes('--write');
  if (!fs.existsSync(CATALOG)) {
    console.error(`Chưa có ${CATALOG}. Chạy backend/scripts/generateJapaneseCatalog.py trước.`);
    process.exit(1);
  }
  const incoming = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const { mongoEnabled } = require('../lib/mongo');
  const { createStore } = require('../lib/store');
  const useStore = mongoEnabled();
  const store = useStore ? createStore(DB) : null;
  if (store) await store.initialize();
  const db = useStore ? null : JSON.parse(fs.readFileSync(DB, 'utf8'));
  const products = useStore ? (store.read().products || []) : (db.products || []);
  console.log(useStore ? 'Nguồn dữ liệu: MongoDB' : 'Nguồn dữ liệu: db.json');

  const bySlug = new Map(products.map((item) => [item.slug, item]));
  const existingSkus = new Set(products.map((item) => item.sku).filter(Boolean));
  const problems = [];
  let added = 0;
  let updated = 0;

  for (const product of incoming) {
    // Ảnh flat-lay là điều kiện bắt buộc: không có nó thì thử đồ sẽ dùng ảnh
    // catalog có nền/bối cảnh và cho ra kết quả sai.
    const flat = path.join(ASSETS, `${product.slug}_tryon-flat.png`);
    const catalogImage = path.join(ASSETS, `${product.slug}_1.jpg`);
    if (!fs.existsSync(flat)) problems.push(`${product.slug}: thiếu ảnh flat-lay`);
    if (!fs.existsSync(catalogImage)) problems.push(`${product.slug}: thiếu ảnh catalog`);

    const current = bySlug.get(product.slug);
    if (current) {
      Object.assign(current, product, { id: current.id, createdAt: current.createdAt });
      updated += 1;
      continue;
    }
    if (existingSkus.has(product.sku)) {
      problems.push(`${product.slug}: SKU ${product.sku} đã tồn tại`);
      continue;
    }
    products.push({ ...product, createdAt: Date.now() });
    existingSkus.add(product.sku);
    added += 1;
  }

  if (problems.length) {
    console.error('Có vấn đề, KHÔNG ghi:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`Thêm ${added}, cập nhật ${updated}. Tổng sau khi gộp: ${products.length}`);
  if (!write) {
    console.log(`(xem trước — thêm --write để ghi vào ${useStore ? 'MongoDB' : 'db.json'})`);
    return;
  }
  if (useStore) {
    await store.update((state) => {
      state.products = products;
      return state;
    });
    if (store.flush) await store.flush();
    console.log('Đã ghi vào MongoDB qua store.update()');
  } else {
    db.products = products;
    fs.writeFileSync(DB, JSON.stringify(db, null, 2), 'utf8');
    console.log(`Đã ghi ${DB}`);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
