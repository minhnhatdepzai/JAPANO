#!/usr/bin/env node
// Đối chiếu MongoDB (thứ bạn thấy trong Compass) với dữ liệu API đang phục vụ
// cho app và trang quản trị.
//
//   npm run db:verify
//
// Câu hỏi cần trả lời: "mở Compass lên có đúng là thứ app đang chạy không?"
// Nếu lệch, phải chỉ ra lệch ở đâu chứ không chỉ báo đỏ.
//
// Cách làm: đọc thẳng từ các collection nguồn bằng chính hàm mà máy chủ dùng
// (loadStateFromCollections), rồi so với những gì API trả về qua HTTP. Hai
// đường đi khác nhau tới cùng một dữ liệu — khớp thì mới thật sự yên tâm.
require('../instrument');
const { getDb, mongoEnabled } = require('../lib/mongo');
const { loadStateFromCollections } = require('../lib/mongoCollections');
const { unitPrice } = require('../lib/pricing');

const G = '\x1b[32m'; const R = '\x1b[31m'; const Y = '\x1b[33m'; const D = '\x1b[2m'; const O = '\x1b[0m';
const API = process.env.JAPANO_API_URL || `http://127.0.0.1:${process.env.PORT || 4100}`;

let problems = 0;
const ok = (label, detail = '') => console.log(`  ${G}✓${O} ${label}${detail ? ` ${D}${detail}${O}` : ''}`);
const bad = (label, detail = '') => { problems += 1; console.log(`  ${R}✗${O} ${label}${detail ? ` — ${detail}` : ''}`); };

async function fetchJson(path) {
  const response = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function main() {
  console.log('\n=== ĐỐI CHIẾU MONGODB ↔ APP ĐANG CHẠY ===\n');
  if (!mongoEnabled()) {
    console.log(`${Y}MONGODB_URI chưa cấu hình — máy chủ đang chạy bằng tệp JSON, không có gì để đối chiếu.${O}\n`);
    process.exit(0);
  }

  const db = await getDb();
  console.log(`MongoDB : ${db.databaseName}`);
  console.log(`API     : ${API}\n`);

  // ---- 1. Kho dữ liệu máy chủ đang dùng ------------------------------------
  console.log('1) Máy chủ đang đọc từ đâu');
  const health = await fetchJson('/api/health');
  if (health?.database?.type === 'mongodb' && health.database.connected) {
    ok('máy chủ đang dùng MongoDB', `(${health.database.model}, db=${health.database.database})`);
  } else {
    bad('máy chủ KHÔNG dùng MongoDB', `đang dùng: ${health?.database?.type} — Compass sẽ không phản ánh app`);
  }

  // ---- 2. Số lượng bản ghi từng collection ---------------------------------
  console.log('\n2) Số lượng bản ghi (Mongo ↔ state máy chủ dựng ra)');
  const state = await loadStateFromCollections(db);
  const pairs = [
    ['products', 'products'], ['orders', 'orders'], ['users', 'users'],
    ['payments', 'payments'], ['reviews', 'reviews'], ['vouchers', 'vouchers'],
    ['flagcards', 'flagcards'], ['notifications', 'notifications'],
  ];
  for (const [collection, stateKey] of pairs) {
    const inMongo = await db.collection(collection).countDocuments({});
    const inState = (state[stateKey] || []).length;
    if (inMongo === inState) ok(`${collection}`, `${inMongo} bản ghi`);
    else bad(`${collection}`, `Mongo ${inMongo} ≠ state ${inState}`);
  }

  // ---- 3. Dữ liệu API trả cho APP có khớp Mongo không -----------------------
  console.log('\n3) API phục vụ app có khớp Mongo không');
  const apiProducts = await fetchJson('/api/products');
  const apiList = Array.isArray(apiProducts) ? apiProducts : (apiProducts.items || apiProducts.products || []);
  const published = (state.products || []).filter((p) => !p.status || !['draft', 'archived', 'hidden'].includes(String(p.status)));
  if (apiList.length === published.length) ok('số sản phẩm app thấy', `${apiList.length} (khớp số đang xuất bản trong Mongo)`);
  else bad('số sản phẩm app thấy', `API ${apiList.length} ≠ Mongo đang xuất bản ${published.length}`);

  const sample = apiList[0];
  const inMongo = (state.products || []).find((p) => String(p.slug) === String(sample?.slug) || String(p.id) === String(sample?.id));
  if (!sample) bad('không lấy được sản phẩm mẫu từ API');
  else if (!inMongo) bad(`sản phẩm "${sample.slug}" API trả về nhưng KHÔNG có trong Mongo`);
  else if (Number(sample.price) !== Number(inMongo.price)) bad(`giá "${sample.slug}"`, `API ${sample.price} ≠ Mongo ${inMongo.price}`);
  else ok(`sản phẩm mẫu "${sample.slug}"`, `giá ${Number(inMongo.price).toLocaleString('vi-VN')}₫ khớp`);

  // ---- 4. Giá theo biến thể -------------------------------------------------
  console.log('\n4) Giá theo biến thể (màu/kích cỡ)');
  const variantsWithPrice = await db.collection('product_variants').countDocuments({ price: { $exists: true } });
  const totalVariants = await db.collection('product_variants').countDocuments({});
  ok('biến thể trong Mongo', `${totalVariants} tổng · ${variantsWithPrice} có giá riêng`);
  const priced = await db.collection('product_variants').findOne({ price: { $exists: true } });
  if (priced) {
    const product = (state.products || []).find((p) => String(p.id) === String(priced.productId));
    const resolved = unitPrice(product, priced.colorName, priced.size);
    if (resolved === Number(priced.price)) {
      ok(`"${product?.name || priced.productId}" ${priced.colorName}/${priced.size}`, `${resolved.toLocaleString('vi-VN')}₫ (đúng giá riêng, không phải giá chung)`);
    } else {
      bad(`giá biến thể ${priced.colorName}/${priced.size}`, `tính ra ${resolved} ≠ Mongo ${priced.price}`);
    }
  } else {
    console.log(`  ${D}chưa biến thể nào đặt giá riêng — đặt thử trong trang quản trị rồi chạy lại${O}`);
  }

  // ---- 5. Toàn vẹn liên kết -------------------------------------------------
  console.log('\n5) Toàn vẹn liên kết giữa các collection');
  const { relationshipErrors } = require('../lib/mongoCollections');
  const errors = relationshipErrors(state);
  if (!errors.length) ok('không có tham chiếu mồ côi');
  else { bad(`${errors.length} liên kết hỏng`); errors.slice(0, 5).forEach((e) => console.log(`      ${D}${e}${O}`)); }

  // ---- Kết luận -------------------------------------------------------------
  console.log(problems === 0
    ? `\n${G}KẾT LUẬN: MongoDB khớp với app đang chạy.${O} Mở Compass sẽ thấy đúng dữ liệu này.\n`
    : `\n${R}KẾT LUẬN: có ${problems} điểm lệch${O} — xem các dòng ✗ ở trên.\n`);
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((error) => { console.error(`${R}Lỗi:${O}`, error.message); process.exit(1); });
