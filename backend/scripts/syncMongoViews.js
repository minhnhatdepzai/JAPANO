// Kiểm tra và ghi chuẩn hoá lại các collection nguồn hiện hành. Tên file được
// giữ để không làm hỏng lệnh vận hành cũ; hệ thống không còn Mongo projection.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.server') });
const { MongoClient } = require('mongodb');
const { loadStateFromCollections, persistStateToCollections, ensureMongoIndexes, relationshipErrors } = require('../lib/mongoCollections');
const { reconcileVipState } = require('../lib/vip');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI trong .env.server');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'japano');
    const state = reconcileVipState(await loadStateFromCollections(db));
    const errors = relationshipErrors(state);
    if (errors.length) throw new Error(`Dữ liệu lỗi liên kết: ${errors.join('; ')}`);
    await persistStateToCollections(db, state);
    await ensureMongoIndexes(db);
    console.log(`Đã kiểm tra và chuẩn hoá collection-first: ${state.products.length} sản phẩm, ${state.orders.length} đơn hàng.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => { console.error('LỖI:', error.message); process.exit(1); });
