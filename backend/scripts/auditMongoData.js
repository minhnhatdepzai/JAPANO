#!/usr/bin/env node
// Soi tính HỢP LÝ của dữ liệu trong MongoDB, không chỉ tính toàn vẹn liên kết.
//
//   node backend/scripts/auditMongoData.js
//
// verifyMongoMatchesApp.js trả lời "Mongo có khớp app không". Script này trả
// lời câu khác: "dữ liệu trong Mongo có vô lý ở đâu không". Một bản ghi hoàn
// toàn hợp lệ về mặt tham chiếu vẫn có thể vô lý về nghiệp vụ — đơn đã hoàn tất
// mà chưa thu tiền, tiền hoàn lớn hơn tiền đã trả, tồn kho âm, hai tài khoản
// trùng email, sản phẩm giảm giá mà giá gạch lại thấp hơn giá bán.
require('../instrument');
const fs = require('fs');
const path = require('path');
const { getDb, mongoEnabled } = require('../lib/mongo');
const { loadStateFromCollections } = require('../lib/mongoCollections');

const R = '\x1b[31m'; const Y = '\x1b[33m'; const G = '\x1b[32m'; const D = '\x1b[2m'; const O = '\x1b[0m';
const ASSETS = path.join(__dirname, '..', '..', 'mobile', 'assets');

const findings = [];
const add = (level, area, message, sample) => findings.push({ level, area, message, sample });
const money = (value) => `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}₫`;

async function main() {
  if (!mongoEnabled()) { console.error('MONGODB_URI chưa cấu hình.'); process.exit(1); }
  const db = await getDb();
  const state = await loadStateFromCollections(db);
  const products = state.products || [];
  const orders = state.orders || [];
  const payments = state.payments || [];
  const users = state.users || [];
  const returns = state.returnRequests || [];
  const reviews = state.reviews || [];
  const vouchers = state.vouchers || [];
  const now = Date.now();

  // ---- 1. Trùng lặp khoá nghiệp vụ -----------------------------------------
  const dup = (list, key, label) => {
    const seen = new Map();
    for (const row of list) {
      const value = String(typeof key === 'function' ? key(row) : row[key] || '').trim().toLowerCase();
      if (!value) continue;
      seen.set(value, (seen.get(value) || 0) + 1);
    }
    const bad = [...seen.entries()].filter(([, count]) => count > 1);
    if (bad.length) add('error', 'trùng lặp', `${label}: ${bad.length} giá trị bị trùng`, bad.slice(0, 5).map(([v, c]) => `${v}×${c}`).join(', '));
  };
  dup(products, 'slug', 'products.slug');
  dup(products, 'id', 'products.id');
  dup(orders, 'code', 'orders.code');
  dup(users, (u) => u.email, 'users.email');
  const variantKeys = new Map();
  for (const product of products) {
    for (const variant of product.variants || []) {
      const key = `${product.slug}|${variant.colorName}|${variant.size}`;
      variantKeys.set(key, (variantKeys.get(key) || 0) + 1);
    }
  }
  const dupVariants = [...variantKeys.entries()].filter(([, count]) => count > 1);
  if (dupVariants.length) add('error', 'trùng lặp', `biến thể trùng màu+size: ${dupVariants.length}`, dupVariants.slice(0, 3).map(([k]) => k).join(', '));

  // ---- 2. Tồn kho ----------------------------------------------------------
  let negative = 0; let zeroPublished = [];
  for (const product of products) {
    const variants = product.variants || [];
    for (const variant of variants) if (Number(variant.stock) < 0) negative += 1;
    const total = variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
    const published = !product.status || ['published', 'active'].includes(String(product.status));
    if (published && variants.length && total === 0) zeroPublished.push(product.slug);
  }
  if (negative) add('error', 'tồn kho', `${negative} biến thể có tồn kho ÂM`);
  if (zeroPublished.length) {
    add('warn', 'tồn kho', `${zeroPublished.length} sản phẩm đang xuất bản nhưng hết sạch hàng (app vẫn hiện, bấm vào không mua được)`, zeroPublished.slice(0, 6).join(', '));
  }

  // ---- 3. Số tiền của đơn --------------------------------------------------
  let totalMismatch = 0; const totalSamples = [];
  let emptyItems = 0;
  for (const order of orders) {
    const items = order.items || [];
    if (!items.length) { emptyItems += 1; continue; }
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
    const expected = Math.max(0, subtotal - (Number(order.discount) || 0) + (Number(order.ship) || 0));
    const actual = Number(order.total) || 0;
    if (Math.abs(expected - actual) > 1) {
      totalMismatch += 1;
      if (totalSamples.length < 4) totalSamples.push(`${order.code}: ghi ${money(actual)} nhưng tính ra ${money(expected)}`);
    }
    if ((Number(order.discount) || 0) > subtotal) {
      add('error', 'đơn hàng', `${order.code}: giảm giá ${money(order.discount)} lớn hơn tiền hàng ${money(subtotal)}`);
    }
  }
  if (emptyItems) add('error', 'đơn hàng', `${emptyItems} đơn không có sản phẩm nào`);
  if (totalMismatch) add('error', 'đơn hàng', `${totalMismatch}/${orders.length} đơn có tổng tiền KHÔNG khớp công thức (hàng − giảm + ship)`, totalSamples.join(' | '));

  // ---- 4. Trạng thái đơn ↔ thanh toán --------------------------------------
  const paymentByOrder = new Map(payments.map((row) => [String(row.orderId), row]));
  let completedUnpaid = 0; const completedUnpaidSamples = [];
  let paidCancelled = 0;
  let returnedNoRequest = [];
  for (const order of orders) {
    const status = String(order.status || '');
    const payStatus = String(order.payment?.status || '');
    if (['completed', 'delivered'].includes(status) && ['unpaid', 'pending', 'failed'].includes(payStatus)) {
      completedUnpaid += 1;
      if (completedUnpaidSamples.length < 5) completedUnpaidSamples.push(`${order.code} (${status}/${payStatus})`);
    }
    if (status === 'cancelled' && payStatus === 'paid') paidCancelled += 1;
    if (status === 'returned' && !returns.some((r) => String(r.orderId) === String(order.id))) returnedNoRequest.push(order.code);
  }
  if (completedUnpaid) add('error', 'đơn ↔ thanh toán', `${completedUnpaid} đơn đã giao/hoàn tất nhưng thanh toán vẫn chưa trả`, completedUnpaidSamples.join(', '));
  if (paidCancelled) add('warn', 'đơn ↔ thanh toán', `${paidCancelled} đơn đã HUỶ nhưng thanh toán vẫn ghi "đã trả" — cần đối chiếu đã hoàn tiền chưa`);
  if (returnedNoRequest.length) add('warn', 'đơn ↔ trả hàng', `${returnedNoRequest.length} đơn ở trạng thái "đã trả hàng" nhưng không có yêu cầu trả nào`, returnedNoRequest.slice(0, 5).join(', '));

  // ---- 5. Thanh toán -------------------------------------------------------
  let payAmountMismatch = 0; const paySamples = [];
  let overRefund = 0;
  for (const payment of payments) {
    const order = orders.find((row) => String(row.id) === String(payment.orderId));
    if (order && Math.abs((Number(payment.amount) || 0) - (Number(order.total) || 0)) > 1) {
      payAmountMismatch += 1;
      if (paySamples.length < 4) paySamples.push(`${payment.code}: ${money(payment.amount)} ≠ đơn ${money(order.total)}`);
    }
    if ((Number(payment.refundedAmount) || 0) > (Number(payment.amount) || 0) + 1) overRefund += 1;
  }
  if (payAmountMismatch) add('error', 'thanh toán', `${payAmountMismatch} giao dịch có số tiền khác tổng đơn`, paySamples.join(' | '));
  if (overRefund) add('error', 'thanh toán', `${overRefund} giao dịch hoàn tiền NHIỀU HƠN số đã thu`);

  // ---- 6. Trả hàng ---------------------------------------------------------
  for (const request of returns) {
    const order = orders.find((row) => String(row.id) === String(request.orderId));
    if (order && (Number(request.amount) || 0) > (Number(order.total) || 0) + 1) {
      add('error', 'trả hàng', `${request.code}: hoàn ${money(request.amount)} lớn hơn giá trị đơn ${money(order.total)}`);
    }
    const requestQty = (request.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const orderQty = (order?.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    if (order && requestQty > orderQty) {
      add('error', 'trả hàng', `${request.code}: trả ${requestQty} món nhưng đơn chỉ có ${orderQty}`);
    }
  }

  // ---- 7. Tồn kho đã mất vì huỷ/trả trước khi có cơ chế hoàn kho -----------
  // Đây là hệ quả đo được của lỗi tồn kho một chiều đã sửa: các đơn kết thúc
  // bằng huỷ/trả trước đó đã trừ kho và không bao giờ được cộng lại.
  const lost = new Map();
  for (const order of orders) {
    if (!['cancelled', 'returned'].includes(String(order.status))) continue;
    if (order.stockRestoredAt) continue;
    for (const item of order.items || []) {
      const key = `${item.slug || item.productId}|${item.colorName}|${item.size}`;
      lost.set(key, (lost.get(key) || 0) + (Number(item.qty) || 0));
    }
  }
  const lostUnits = [...lost.values()].reduce((sum, qty) => sum + qty, 0);
  if (lostUnits) {
    add('warn', 'tồn kho', `${lostUnits} sản phẩm bị trừ kho bởi ${[...new Set(orders.filter((o) => ['cancelled', 'returned'].includes(String(o.status)) && !o.stockRestoredAt).map((o) => o.code))].length} đơn huỷ/trả nhưng chưa từng được cộng lại`, [...lost.entries()].slice(0, 5).map(([k, v]) => `${k}×${v}`).join(', '));
  }

  // ---- 8. Người dùng -------------------------------------------------------
  const noLogin = users.filter((user) => !user.passwordHash && !user.googleId);
  if (noLogin.length) add('warn', 'người dùng', `${noLogin.length} tài khoản không có cách nào đăng nhập (không mật khẩu, không Google)`, noLogin.slice(0, 5).map((u) => u.email || u.id).join(', '));
  const admins = users.filter((user) => ['admin', 'super_admin'].includes(String(user.role)));
  if (!admins.length) add('error', 'người dùng', 'KHÔNG có tài khoản admin nào — không ai vào được trang quản trị');
  const noEmail = users.filter((user) => !String(user.email || '').includes('@'));
  if (noEmail.length) add('warn', 'người dùng', `${noEmail.length} tài khoản không có email hợp lệ`, noEmail.slice(0, 4).map((u) => u.id).join(', '));

  // ---- 9. Sản phẩm ---------------------------------------------------------
  const fakeDiscount = products.filter((p) => p.old !== null && p.old !== undefined && Number(p.old) > 0 && Number(p.old) <= Number(p.price));
  if (fakeDiscount.length) add('error', 'sản phẩm', `${fakeDiscount.length} sản phẩm có giá gạch KHÔNG cao hơn giá bán (giảm giá giả)`, fakeDiscount.slice(0, 5).map((p) => p.slug).join(', '));
  const thinImages = products.filter((p) => {
    const published = !p.status || ['published', 'active'].includes(String(p.status));
    return published && (p.images || []).length < 2;
  });
  if (thinImages.length) add('warn', 'sản phẩm', `${thinImages.length} sản phẩm đang bán nhưng dưới 2 ảnh (chính backend cũng từ chối xuất bản mức này)`, thinImages.slice(0, 6).map((p) => `${p.slug}:${(p.images || []).length}`).join(', '));
  const zeroPrice = products.filter((p) => !(Number(p.price) > 0));
  if (zeroPrice.length) add('error', 'sản phẩm', `${zeroPrice.length} sản phẩm có giá 0`, zeroPrice.slice(0, 5).map((p) => p.slug).join(', '));

  // ---- 10. Ảnh trỏ tới file không tồn tại ----------------------------------
  const missingFiles = new Set();
  for (const product of products) {
    for (const image of product.images || []) {
      const value = String(image);
      if (!value.startsWith('/assets/')) continue;
      if (!fs.existsSync(path.join(ASSETS, value.replace('/assets/', '')))) missingFiles.add(value);
    }
  }
  if (missingFiles.size) add('error', 'ảnh', `${missingFiles.size} đường dẫn ảnh trong DB không có file thật trên đĩa`, [...missingFiles].slice(0, 5).join(', '));

  // ---- 11. Đánh giá --------------------------------------------------------
  const badRating = reviews.filter((r) => !(Number(r.rating) >= 1 && Number(r.rating) <= 5));
  if (badRating.length) add('error', 'đánh giá', `${badRating.length} đánh giá có số sao ngoài khoảng 1–5`);

  // ---- 12. Voucher ---------------------------------------------------------
  for (const voucher of vouchers) {
    if (Number(voucher.limit) > 0 && Number(voucher.used) > Number(voucher.limit)) {
      add('error', 'voucher', `${voucher.code}: đã dùng ${voucher.used} lượt vượt giới hạn ${voucher.limit}`);
    }
    if (voucher.active && voucher.expiry && new Date(voucher.expiry).getTime() < now) {
      add('warn', 'voucher', `${voucher.code}: còn bật nhưng đã hết hạn ${voucher.expiry}`);
    }
    if (String(voucher.type) === 'percent' && Number(voucher.value) > 100) {
      add('error', 'voucher', `${voucher.code}: giảm ${voucher.value}% (>100%)`);
    }
  }

  // ---- 12b. Bộ đếm lượt dùng voucher có khớp thực tế không -----------------
  // `used` là con số CHẶN khách: validateVoucher từ chối khi used >= limit.
  // Nếu nó được seed một số bịa thì cửa hàng tự khoá mất phần lớn hạn mức của
  // chính mình mà không ai biết vì sao.
  const redemptions = state.voucherRedemptions || [];
  let phantom = 0; const phantomSamples = [];
  for (const voucher of vouchers) {
    const byOrder = orders.filter((order) => String(order.discountCode || '') === voucher.code).length;
    const byRedemption = redemptions.filter((row) => String(row.code || '') === voucher.code).length;
    const real = Math.max(byOrder, byRedemption);
    const claimed = Number(voucher.used) || 0;
    if (claimed > real + 2) {
      phantom += claimed - real;
      phantomSamples.push(`${voucher.code}: ghi ${claimed} nhưng thực tế ${real}`);
    }
  }
  if (phantom) {
    add('error', 'voucher', `${phantom} lượt dùng voucher là số ma — không có đơn hàng hay bản ghi quy đổi nào đứng sau`, phantomSamples.join(' | '));
  }
  const voucherCodes = new Set(vouchers.map((row) => String(row.code)));
  const promoCodes = new Set(['STRIPE10', 'VNPAY5', 'JAPANO-VIP10']);
  const unknownCodes = [...new Set(orders
    .map((order) => String(order.discountCode || '').trim())
    .filter((code) => code && !voucherCodes.has(code) && !promoCodes.has(code)))];
  if (unknownCodes.length) {
    add('warn', 'voucher', `${unknownCodes.length} mã giảm giá trên đơn không tồn tại trong danh sách voucher`, unknownCodes.join(', '));
  }

  // ---- 12c. Ràng buộc ở tầng cơ sở dữ liệu ---------------------------------
  // Trùng email hiện chỉ được chặn bằng một phép kiểm trong mã nguồn
  // (state.users.some(...)). Đó là đọc-rồi-ghi: hai lượt đăng ký cùng lúc vẫn
  // lọt qua. Chỉ unique index mới chặn được thật.
  const userIndexes = await db.collection('users').indexes();
  if (!userIndexes.some((index) => index.unique && JSON.stringify(index.key).includes('email'))) {
    add('warn', 'ràng buộc DB', 'collection users KHÔNG có unique index trên email — hai tài khoản có thể trùng email nếu đăng ký cùng lúc');
  }

  // ---- 12d. db.json dự phòng có lệch với MongoDB không ---------------------
  // lib/store.js sẽ GHI ĐÈ trạng thái bằng db.json khi MongoDB chập. File càng
  // cũ thì lúc đó app càng lùi về xa.
  try {
    const dbFile = path.join(__dirname, '..', 'data', 'db.json');
    const local = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const drift = [];
    for (const key of ['products', 'orders', 'users', 'payments', 'reviews']) {
      const delta = (state[key] || []).length - (local[key] || []).length;
      if (delta) drift.push(`${key} lệch ${delta > 0 ? '+' : ''}${delta}`);
    }
    if (drift.length) {
      add('warn', 'dự phòng', 'db.json không còn khớp MongoDB — nếu Mongo chập, app sẽ lùi về bản này', drift.join(', '));
    }
  } catch { /* không đọc được thì bỏ qua */ }

  // ---- 13. Mốc thời gian ---------------------------------------------------
  const future = orders.filter((order) => Number(order.createdAt) > now + 86400000);
  if (future.length) add('warn', 'thời gian', `${future.length} đơn có ngày tạo ở TƯƠNG LAI`, future.slice(0, 4).map((o) => `${o.code}: ${new Date(Number(o.createdAt)).toLocaleString('vi-VN')}`).join(', '));
  const noDate = orders.filter((order) => !Number(order.createdAt));
  if (noDate.length) add('error', 'thời gian', `${noDate.length} đơn không có ngày tạo`);

  // ---- 14. Collection rỗng đáng ngờ ---------------------------------------
  const emptyButExpected = [];
  for (const name of ['cart_items', 'push_tokens', 'japan_spot_suggestions']) {
    if (await db.collection(name).countDocuments({}) === 0) emptyButExpected.push(name);
  }
  if (emptyButExpected.length) add('info', 'collection', `rỗng: ${emptyButExpected.join(', ')}`, 'bình thường nếu tính năng chưa dùng tới');

  // ---- Báo cáo -------------------------------------------------------------
  console.log('\n=== SOI TÍNH HỢP LÝ CỦA DỮ LIỆU MONGODB ===\n');
  console.log(`${D}products ${products.length} · orders ${orders.length} · payments ${payments.length} · users ${users.length} · returns ${returns.length} · reviews ${reviews.length}${O}\n`);
  const order = { error: 0, warn: 1, info: 2 };
  const icon = { error: `${R}✗${O}`, warn: `${Y}▲${O}`, info: `${D}·${O}` };
  findings.sort((a, b) => order[a.level] - order[b.level]);
  if (!findings.length) console.log(`  ${G}✓${O} không tìm thấy điểm vô lý nào`);
  for (const finding of findings) {
    console.log(`  ${icon[finding.level]} [${finding.area}] ${finding.message}`);
    if (finding.sample) console.log(`      ${D}${finding.sample}${O}`);
  }
  const errors = findings.filter((f) => f.level === 'error').length;
  const warns = findings.filter((f) => f.level === 'warn').length;
  console.log(`\n${errors ? R : G}${errors} lỗi${O} · ${warns ? Y : G}${warns} cảnh báo${O}`);
  process.exit(0);
}

main().catch((error) => { console.error('✗', error.stack || error.message); process.exit(1); });
