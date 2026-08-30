#!/usr/bin/env node
/**
 * Kiểm kê MongoDB Atlas — CHỈ ĐỌC.
 *
 *   node scripts/atlas-inventory.js            # bảng cho người đọc
 *   node scripts/atlas-inventory.js --json     # JSON cho script khác dùng
 *
 * Vì sao cần: `backend/data/db.json` là seed/fallback, KHÔNG phải bản sao của
 * Atlas. Đo trên hệ thống thật ngày 2026-08-28, 13/34 collection đã lệch nhau
 * (interactions 836 so với 671). Mọi con số đưa vào tài liệu phải lấy từ đây.
 *
 * An toàn: chỉ gọi listCollections / estimatedDocumentCount / collStats /
 * indexes. Không ghi, không xoá, không in URI hay credential.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.server') });
const { MongoClient } = require(path.join(ROOT, 'node_modules/mongodb'));

const asJson = process.argv.includes('--json');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Thiếu MONGODB_URI trong .env.server.');
    process.exit(2);
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(String(process.env.MONGODB_DB || 'japano').trim());

  const rows = [];
  for (const info of await db.listCollections().toArray()) {
    const collection = db.collection(info.name);
    const indexes = await collection.indexes();
    let stats = {};
    try {
      const raw = await db.command({ collStats: info.name });
      stats = { sizeBytes: raw.size, storageBytes: raw.storageSize, avgObjBytes: Math.round(raw.avgObjSize || 0) };
    } catch {
      // Atlas ở tier thấp có thể chặn collStats; số document vẫn lấy được.
    }
    rows.push({
      name: info.name,
      count: await collection.estimatedDocumentCount(),
      ...stats,
      indexCount: indexes.length,
      indexNames: indexes.map((index) => index.name),
      ttlIndexes: indexes
        .filter((index) => index.expireAfterSeconds !== undefined)
        .map((index) => `${index.name}=${index.expireAfterSeconds}s`),
      hasValidator: Boolean(info.options && info.options.validator),
    });
  }
  rows.sort((left, right) => right.count - left.count);
  await client.close();

  const totalBytes = rows.reduce((sum, row) => sum + (row.sizeBytes || 0), 0);
  const summary = {
    database: db.databaseName,
    checkedAt: new Date().toISOString(),
    collectionCount: rows.length,
    totalBytes,
    ttlCollections: rows.filter((row) => row.ttlIndexes.length).length,
    validatorCollections: rows.filter((row) => row.hasValidator).length,
  };

  if (asJson) {
    console.log(JSON.stringify({ ...summary, rows }, null, 2));
    return;
  }
  console.log(`Database: ${summary.database} — ${summary.collectionCount} collection, `
    + `${(totalBytes / 1048576).toFixed(2)} MB, kiểm tra ${summary.checkedAt}`);
  console.log(`TTL index: ${summary.ttlCollections} collection · Validator: ${summary.validatorCollections} collection\n`);
  console.log('collection'.padEnd(26) + 'docs'.padStart(7) + 'size KB'.padStart(10) + 'idx'.padStart(5) + '  TTL');
  for (const row of rows) {
    console.log(row.name.padEnd(26)
      + String(row.count).padStart(7)
      + ((row.sizeBytes || 0) / 1024).toFixed(1).padStart(10)
      + String(row.indexCount).padStart(5)
      + '  ' + (row.ttlIndexes.join(',') || '—'));
  }
}

main().catch((error) => {
  // Không in stack: chuỗi kết nối có thể lọt vào message của driver.
  console.error('Không kiểm kê được:', error.name);
  process.exit(1);
});
