#!/usr/bin/env node
// "App hiển thị sao thì MongoDB phải đúng như vậy" — kiểm tra đúng câu đó.
//
//   node backend/scripts/auditAppMatchesMongo.js
//
// Khác với verifyMongoMatchesApp.js (chỉ so số lượng và một sản phẩm mẫu),
// script này so TỪNG TRƯỜNG mà người dùng nhìn thấy, trên cả ba chặng dữ liệu
// phải đi qua trước khi lên màn hình:
//
//   MongoDB  →  API /api/products  →  mobile/lib/data.tsx trộn với BUNDLED  →  màn hình
//
// Chặng thứ ba là chặng hay bị bỏ quên: mobile/lib/catalog.ts có một danh mục
// GHI CỨNG biên dịch thẳng vào app. Hàm normalizedRemote() trộn nó với dữ liệu
// API, và ở vài trường thì bản ghi cứng THẮNG. Sửa trong admin/Mongo mà app vẫn
// hiện giá trị cũ là do đây, không phải do cache.
require('../instrument');
const fs = require('fs');
const path = require('path');
const { getDb, mongoEnabled } = require('../lib/mongo');
const { loadStateFromCollections } = require('../lib/mongoCollections');

const R = '\x1b[31m'; const Y = '\x1b[33m'; const G = '\x1b[32m'; const D = '\x1b[2m'; const O = '\x1b[0m';
const API = process.env.JAPANO_API_URL || `http://127.0.0.1:${process.env.PORT || 4100}`;
const CATALOG_TS = path.join(__dirname, '..', '..', 'mobile', 'lib', 'catalog.ts');
const money = (value) => `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}₫`;

let errors = 0; let warns = 0;
const ok = (msg, detail = '') => console.log(`  ${G}✓${O} ${msg}${detail ? ` ${D}${detail}${O}` : ''}`);
const bad = (msg, detail = '') => { errors += 1; console.log(`  ${R}✗${O} ${msg}${detail ? `\n      ${D}${detail}${O}` : ''}`); };
const warn = (msg, detail = '') => { warns += 1; console.log(`  ${Y}▲${O} ${msg}${detail ? `\n      ${D}${detail}${O}` : ''}`); };

// Đọc danh mục ghi cứng trong app. Parse bằng regex vì đây là TypeScript, không
// require() được từ Node thuần — chỉ cần các trường người dùng nhìn thấy.
function readBundled() {
  const source = fs.readFileSync(CATALOG_TS, 'utf8');
  const body = source.slice(source.indexOf('export const BUNDLED'), source.indexOf('export let PRODUCTS'));
  const rows = [];
  const re = /\{\s*slug:'([^']+)',\s*name:'([^']*)',[^}]*?price:(\d+),\s*old:(null|\d+)[^}]*?imageKeys:\[([^\]]*)\]/g;
  let match;
  while ((match = re.exec(body))) {
    rows.push({
      slug: match[1], name: match[2],
      price: Number(match[3]),
      old: match[4] === 'null' ? null : Number(match[4]),
      images: (match[5].match(/'/g) || []).length / 2,
    });
  }
  return rows;
}

async function main() {
  if (!mongoEnabled()) { console.error('MONGODB_URI chưa cấu hình.'); process.exit(1); }
  const db = await getDb();
  const state = await loadStateFromCollections(db);
  const mongoProducts = new Map((state.products || []).map((row) => [row.slug, row]));

  let apiProducts;
  try {
    const response = await fetch(`${API}/api/products`, { signal: AbortSignal.timeout(20000) });
    apiProducts = await response.json();
  } catch (error) {
    console.error(`${R}Không gọi được API tại ${API} — hãy chạy backend trước.${O}`);
    process.exit(1);
  }
  const apiBySlug = new Map(apiProducts.map((row) => [row.slug, row]));

  console.log('\n=== APP CÓ HIỂN THỊ ĐÚNG MONGODB KHÔNG ===\n');

  // ---- Chặng 1: MongoDB → API ---------------------------------------------
  console.log(`${D}Chặng 1 — MongoDB → API${O}`);
  const publishedMongo = (state.products || []).filter((row) => !row.status || ['published', 'active'].includes(String(row.status)));
  if (publishedMongo.length !== apiProducts.length) {
    bad(`API trả ${apiProducts.length} sản phẩm nhưng Mongo có ${publishedMongo.length} sản phẩm đang xuất bản`);
  } else {
    ok('số sản phẩm khớp', `${apiProducts.length}`);
  }

  const fieldDiffs = [];
  for (const product of publishedMongo) {
    const served = apiBySlug.get(product.slug);
    if (!served) { fieldDiffs.push(`${product.slug}: có trong Mongo nhưng API không trả`); continue; }
    const check = (field, a, b) => {
      if (String(a ?? '') !== String(b ?? '')) fieldDiffs.push(`${product.slug}.${field}: Mongo="${a}" ≠ API="${b}"`);
    };
    check('name', product.name, served.name);
    check('price', product.price, served.price);
    check('old', product.old, served.old);
    check('status', product.status, served.status);
    if ((product.images || []).length !== (served.images || []).length) {
      fieldDiffs.push(`${product.slug}.images: Mongo ${(product.images || []).length} ảnh ≠ API ${(served.images || []).length} ảnh`);
    }
    const mongoStock = (product.variants || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    const apiStock = (served.variants || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    if (mongoStock !== apiStock) fieldDiffs.push(`${product.slug}.stock: Mongo ${mongoStock} ≠ API ${apiStock}`);
  }
  if (fieldDiffs.length) bad(`${fieldDiffs.length} trường lệch giữa Mongo và API`, fieldDiffs.slice(0, 8).join('\n      '));
  else ok('mọi trường hiển thị đều khớp', 'tên, giá, giá gạch, trạng thái, số ảnh, tồn kho');

  // API tự TÍNH rating/reviewCount/sold, không đọc từ product — đây là khác
  // biệt hợp lệ, nhưng phải đúng với dữ liệu nguồn.
  const approved = (state.reviews || []).filter((row) => row.status === 'approved');
  let derivedWrong = 0;
  for (const served of apiProducts) {
    const mine = approved.filter((row) => row.productId === served.slug);
    const expected = mine.length;
    if (Number(served.reviewCount || 0) !== expected) derivedWrong += 1;
  }
  if (derivedWrong) warn(`${derivedWrong} sản phẩm có reviewCount không khớp số đánh giá đã duyệt trong Mongo`);
  else ok('rating/reviewCount/sold được API tính lại đúng từ Mongo', `${approved.length} đánh giá đã duyệt`);

  // ---- Chặng 2: API → danh mục ghi cứng trong app -------------------------
  console.log(`\n${D}Chặng 2 — API → danh mục ghi cứng trong app (mobile/lib/catalog.ts)${O}`);
  const bundled = readBundled();
  ok('đọc được danh mục ghi cứng', `${bundled.length} sản phẩm`);

  // 2a. Sản phẩm ghi cứng nhưng Mongo đã gỡ/ẩn → app VẪN hiện
  const ghosts = bundled.filter((row) => !apiBySlug.has(row.slug));
  if (ghosts.length) {
    bad(`${ghosts.length} sản phẩm bị API loại (đã ẩn/nháp/xoá trong Mongo) nhưng app VẪN hiện vì có bản ghi cứng`,
      ghosts.map((row) => `${row.slug} — app hiện "${row.name}" ${money(row.price)}`).join('\n      '));
  } else {
    ok('không có sản phẩm "ma"', 'ẩn sản phẩm trong Mongo là app cũng ẩn theo');
  }

  // 2b. name lấy từ bản ghi cứng, KHÔNG lấy từ Mongo
  const nameDiffs = [];
  const priceDiffs = [];
  for (const row of bundled) {
    const served = apiBySlug.get(row.slug);
    if (!served) continue;
    if (String(row.name) !== String(served.name)) nameDiffs.push(`${row.slug}: app hiện "${row.name}" · Mongo "${served.name}"`);
    if (Number(row.price) !== Number(served.price)) priceDiffs.push(`${row.slug}: ghi cứng ${money(row.price)} · Mongo ${money(served.price)}`);
  }
  if (nameDiffs.length) {
    bad(`${nameDiffs.length} sản phẩm hiện TÊN từ bản ghi cứng, không phải tên trong Mongo`, nameDiffs.slice(0, 8).join('\n      '));
  } else {
    ok('tên sản phẩm trùng nhau', 'ghi cứng và Mongo đang giống nhau nên chưa lộ ra lệch');
  }
  if (priceDiffs.length) {
    warn(`${priceDiffs.length} sản phẩm có giá ghi cứng khác Mongo (app dùng giá Mongo nên hiện đúng, nhưng bản ghi cứng đã cũ)`,
      priceDiffs.slice(0, 6).join('\n      '));
  } else {
    ok('giá ghi cứng cũng đang trùng Mongo');
  }

  // ---- Chặng 3: những trường app CỐ Ý không lấy từ Mongo -------------------
  console.log(`\n${D}Chặng 3 — trường mà app cố ý bỏ qua Mongo (đọc từ mã nguồn)${O}`);
  const merge = fs.readFileSync(path.join(__dirname, '..', '..', 'mobile', 'lib', 'data.tsx'), 'utf8');
  const overrides = [];
  if (/name:\s*base\.name/.test(merge)) overrides.push('name — luôn lấy từ bản ghi cứng');
  if (/slug:\s*base\.slug/.test(merge)) overrides.push('slug — luôn lấy từ bản ghi cứng (vô hại, dùng làm khoá)');
  if (/imageKeys:\s*base\.imageKeys/.test(merge)) overrides.push('imageKeys — ảnh đóng gói trong app, dùng khi mất mạng');
  if (/if\(!r\)return base/.test(merge.replace(/\s/g, ''))) overrides.push('sản phẩm không có trong API → GIỮ NGUYÊN bản ghi cứng thay vì ẩn đi');
  if (overrides.length) {
    warn(`${overrides.length} trường không phản ánh Mongo`, overrides.join('\n      '));
  } else {
    ok('app không ghi đè trường nào của Mongo');
  }

  // ---- Chặng 4: dữ liệu vận hành ------------------------------------------
  console.log(`\n${D}Chặng 4 — dữ liệu vận hành qua API${O}`);
  for (const [label, url, mongoCount] of [
    ['danh mục', '/api/categories', (state.categories || []).length],
    ['banner', '/api/banners', (state.banners || []).length],
    ['thẻ địa danh', '/api/flagcards', (state.flagcards || []).length],
  ]) {
    try {
      const response = await fetch(`${API}${url}`, { signal: AbortSignal.timeout(10000) });
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length === mongoCount) ok(`${label} khớp`, `${rows.length}`);
      else bad(`${label}: API ${Array.isArray(rows) ? rows.length : '?'} ≠ Mongo ${mongoCount}`);
    } catch { bad(`${label}: không gọi được`); }
  }

  console.log(`\n${errors ? R : G}${errors} lệch nghiêm trọng${O} · ${warns ? Y : G}${warns} cảnh báo${O}`);
  process.exit(0);
}

main().catch((error) => { console.error('✗', error.stack || error.message); process.exit(1); });
