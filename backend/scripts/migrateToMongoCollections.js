// Migration một lần: app_state/projection -> các collection nguồn chuẩn hoá.
// Chỉ xoá app_state sau khi đọc ngược toàn bộ dữ liệu và kiểm tra liên kết đạt.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.server'), quiet: true });
const { MongoClient } = require('mongodb');
const {
  normalizeState,
  loadStateFromCollections,
  persistStateToCollections,
  ensureMongoIndexes,
  resetMongoIndexes,
  dropLegacyCollections,
  repairLegacyReferences,
  relationshipErrors,
  NORMALIZED_COLLECTIONS,
} = require('../lib/mongoCollections');
const { reconcileVipState } = require('../lib/vip');

function backupPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(__dirname, '..', 'data', 'migration-backups', `before-collection-first-${stamp}.json`);
}

function assertSameCounts(before, after) {
  const keys = [
    'categories', 'products', 'orders', 'reviews', 'reviewReactions', 'users',
    'addresses', 'returnRequests', 'vouchers', 'voucherRedemptions',
    'flagcards', 'flagcardCollections', 'banners', 'interactions', 'chats',
    'aiDescriptions', 'japanSpotReviews',
  ];
  const mismatches = keys.filter((key) => (before[key] || []).length !== (after[key] || []).length)
    .map((key) => `${key}: ${before[key]?.length || 0} -> ${after[key]?.length || 0}`);
  if (mismatches.length) throw new Error(`Sai số lượng sau migration: ${mismatches.join('; ')}`);
  const beforeItems = (before.orders || []).reduce((sum, order) => sum + (order.items || []).length, 0);
  const afterItems = (after.orders || []).reduce((sum, order) => sum + (order.items || []).length, 0);
  if (beforeItems !== afterItems) throw new Error(`Sai order_items: ${beforeItems} -> ${afterItems}`);
  if ((after.payments || []).length < (after.orders || []).length) {
    throw new Error(`Thiếu bản ghi thanh toán: ${after.payments.length} payment cho ${after.orders.length} order`);
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI trong .env.server');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'japano');
    const legacy = await db.collection('app_state').findOne({ _id: 'main' });
    if (!legacy) {
      const current = reconcileVipState(await loadStateFromCollections(db));
      const errors = relationshipErrors(current);
      if (errors.length) throw new Error(`Database collection-first đang lỗi liên kết: ${errors.join('; ')}`);
      await ensureMongoIndexes(db);
      await persistStateToCollections(db, current);
      console.log(`Database đã ở cấu trúc collection-first (${current.products.length} sản phẩm, ${current.orders.length} đơn hàng).`);
      return;
    }

    const backup = backupPath();
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.writeFileSync(backup, JSON.stringify(legacy, null, 2), { mode: 0o600 });
    const { _id, _updatedAt, _syncedAt, ...legacyState } = legacy;
    const repaired = repairLegacyReferences(legacyState);
    const state = reconcileVipState(normalizeState(repaired.state));
    const errors = relationshipErrors(state);
    if (errors.length) throw new Error(`Không thể migration vì còn lỗi liên kết: ${errors.join('; ')}`);

    await persistStateToCollections(db, state);
    await resetMongoIndexes(db);
    await ensureMongoIndexes(db);
    const verified = await loadStateFromCollections(db);
    const verificationErrors = relationshipErrors(verified);
    if (verificationErrors.length) throw new Error(`Đọc kiểm tra sau migration bị lỗi: ${verificationErrors.join('; ')}`);
    assertSameCounts(state, verified);

    const invalidMedia = (verified.products || []).flatMap((product) => [...(product.images || []), ...(product.videos || [])])
      .filter((value) => !/^https?:\/\//i.test(String(typeof value === 'string' ? value : value?.url || '')));
    if (invalidMedia.length) throw new Error(`Còn ${invalidMedia.length} media không phải URL Cloudinary/HTTP.`);

    await dropLegacyCollections(db);
    const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name));
    const legacyLeft = ['app_state', '_runtime_metadata', 'carts', 'wishlists'].filter((name) => names.has(name));
    if (legacyLeft.length) throw new Error(`Chưa xoá hết collection cũ: ${legacyLeft.join(', ')}`);
    const missing = NORMALIZED_COLLECTIONS.filter((name) => !names.has(name));
    if (missing.length) throw new Error(`Thiếu collection chuẩn: ${missing.join(', ')}`);

    console.log(`Đã migration xong database "${db.databaseName}".`);
    console.log(`- ${verified.categories.length} danh mục, ${verified.products.length} sản phẩm`);
    console.log(`- ${verified.orders.length} đơn hàng, ${(verified.orders || []).reduce((sum, order) => sum + order.items.length, 0)} dòng sản phẩm`);
    console.log(`- app_state và _runtime_metadata đã được xoá`);
    console.log(`- Backup khôi phục: ${backup}`);
    if (repaired.report.length) console.log(`- Dọn dữ liệu cũ: ${repaired.report.join('; ')}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('LỖI:', error.message);
  process.exitCode = 1;
});
