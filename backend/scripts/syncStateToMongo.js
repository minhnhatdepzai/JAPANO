// Đồng bộ toàn bộ dữ liệu đang chạy thật của app (backend/data/db.json) sang
// MongoDB — mỗi mảng cấp cao nhất trở thành một collection riêng, đúng cấu
// trúc thực thể (ERD) mà app đang dùng. Chạy lại bất cứ lúc nào để cập nhật.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.server') });
const { MongoClient } = require('mongodb');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

// products đã có script riêng (syncProductsToCloud.js) vì cần tải ảnh lên
// Cloudinary trước; bỏ qua ở đây để tránh ghi đè URL ảnh đã đồng bộ.
const SKIP_KEYS = new Set(['products', 'schemaVersion', 'seeded']);
const SINGLETON_KEYS = new Set(['shop', 'integrations', 'flagcardConfig']);

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI trong .env.server');
  const state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'japano');

  const summary = [];
  for (const [key, value] of Object.entries(state)) {
    if (SKIP_KEYS.has(key)) continue;
    if (SINGLETON_KEYS.has(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      await db.collection('settings').updateOne({ _id: key }, { $set: { _id: key, ...value } }, { upsert: true });
      summary.push(`settings.${key}: 1 document (singleton)`);
      continue;
    }
    if (!Array.isArray(value)) continue;
    const col = db.collection(key);
    await col.deleteMany({});
    if (value.length) {
      const docs = value.map((item) => (item && typeof item === 'object' ? { ...item, _id: item.id || item._id || item.slug || undefined } : item));
      await col.insertMany(docs, { ordered: false }).catch(() => col.insertMany(value.map((item) => ({ ...item })), { ordered: false }));
    }
    summary.push(`${key}: ${value.length} documents`);
  }

  console.log('Đã đồng bộ sang MongoDB database "%s":', db.databaseName);
  summary.forEach((line) => console.log('  -', line));
  await client.close();
}

main().catch((error) => { console.error('LỖI:', error.message); process.exit(1); });
