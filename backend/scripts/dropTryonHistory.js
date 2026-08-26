#!/usr/bin/env node
/**
 * Gỡ collection `tryon_history` khỏi MongoDB Atlas.
 *
 * Bảng này ghi trùng hoàn toàn với `interactions` (type='tryon') — mọi con số
 * "lượt thử đồ" trong máy gợi ý và trang quản trị đều đếm từ interactions, và
 * không có một dòng mã nào trong backend/mobile/admin đọc tryon_history.
 *
 * Script làm 3 việc, theo đúng thứ tự an toàn:
 *   1. Xuất toàn bộ tryon_history ra tệp JSON sao lưu.
 *   2. Với những lượt CHƯA có bản ghi tương ứng trong interactions, tạo bù một
 *      interaction (type='tryon') kèm metadata (engine, phụ kiện) — không mất
 *      dữ liệu nào.
 *   3. Xoá collection.
 *
 * Chạy thử trước khi xoá thật:  node scripts/dropTryonHistory.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.server'), quiet: true });
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DRY = process.argv.includes('--dry-run');
const MATCH_WINDOW_MS = 5000;

async function main() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) throw new Error('Thiếu MONGODB_URI trong .env.server');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(String(process.env.MONGODB_DB || 'japano'));

  const names = (await db.listCollections().toArray()).map((c) => c.name);
  if (!names.includes('tryon_history')) {
    console.log('tryon_history không còn tồn tại — không có gì để làm.');
    await client.close();
    return;
  }

  const history = await db.collection('tryon_history').find({}).toArray();
  const tryons = await db.collection('interactions').find({ type: 'tryon' }).toArray();
  console.log(`tryon_history: ${history.length} doc · interactions type=tryon: ${tryons.length} doc`);

  const backupDir = path.join(__dirname, '..', 'data', 'backup');
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, `tryon_history-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  if (!DRY) fs.writeFileSync(backup, JSON.stringify(history, null, 2));
  console.log(`Sao lưu: ${DRY ? '(bỏ qua vì --dry-run) ' : ''}${backup}`);

  // Lượt nào chưa có bản ghi hành vi tương ứng thì tạo bù.
  const covered = (row) => tryons.some((i) => String(i.userId) === String(row.userId)
    && String(i.productId) === String(row.productId)
    && Math.abs(Number(i.createdAt) - Number(row.createdAt)) <= MATCH_WINDOW_MS);

  const backfill = [];
  for (const row of history) {
    if (covered(row)) continue;
    const garments = Array.isArray(row.productIds) && row.productIds.length
      ? row.productIds : [row.productId].filter(Boolean);
    garments.forEach((slug, index) => {
      // Dùng chính id của lượt thử (duy nhất) làm gốc; createdAt của dữ liệu
      // demo bị trùng nhau nên không thể dùng làm khoá.
      const id = `${row.id}-i${index}`;
      backfill.push({
        _id: id,
        id,
        userId: row.userId ?? null,
        productId: slug,
        type: 'tryon',
        value: 1,
        createdAt: row.createdAt,
        source: 'backfill-tryon-history',
        metadata: {
          runId: row.id,
          engine: row.engine || '',
          garments,
          accessoryIds: row.accessoryIds || [],
          appliedAccessories: row.appliedAccessories || [],
          skippedAccessories: row.skippedAccessories || [],
        },
      });
    });
  }
  console.log(`Cần tạo bù ${backfill.length} interaction cho ${history.filter((r) => !covered(r)).length} lượt chưa có bản sao.`);

  if (DRY) {
    console.log('--dry-run: KHÔNG ghi và KHÔNG xoá gì.');
    await client.close();
    return;
  }

  if (backfill.length) {
    // upsert để chạy lại được nhiều lần mà không vỡ vì trùng _id.
    const result = await db.collection('interactions').bulkWrite(
      backfill.map((doc) => ({ updateOne: { filter: { _id: doc._id }, update: { $setOnInsert: doc }, upsert: true } })),
      { ordered: false },
    );
    console.log(`Đã thêm ${result.upsertedCount} interaction (bỏ qua ${backfill.length - result.upsertedCount} đã có).`);
  }
  await db.collection('tryon_history').drop();
  console.log('Đã xoá collection tryon_history.');

  const after = (await db.listCollections().toArray()).length;
  const total = await db.collection('interactions').countDocuments({ type: 'tryon' });
  console.log(`Còn ${after} collection · interactions type=tryon: ${total} doc`);
  await client.close();
}

main().catch((error) => { console.error('LỖI:', error.message); process.exit(1); });
