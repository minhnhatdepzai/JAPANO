#!/usr/bin/env node
/**
 * Audit MongoDB Atlas — CHỈ ĐỌC, dùng lại được.
 *
 *   node scripts/atlas_audit.js            # bảng tóm tắt
 *   node scripts/atlas_audit.js --json     # snapshot đầy đủ cho generator ERD
 *   node scripts/atlas_audit.js --out docs/database/atlas-snapshot.json
 *
 * Thu thập BẰNG CHỨNG để vẽ ERD, thay vì suy từ code:
 *   · countDocuments chính xác (không phải estimated)
 *   · index đầy đủ: key, unique, sparse, partialFilterExpression, expireAfterSeconds
 *   · validator thật từ listCollections
 *   · thống kê field: tên, kiểu BSON, tỉ lệ xuất hiện, tỉ lệ null
 *   · logical reference: coverage, resolved, orphan
 *
 * KHÔNG ghi, KHÔNG xoá, KHÔNG tạo index. KHÔNG in URI/credential.
 * KHÔNG xuất giá trị thô của bất kỳ field nào — chỉ tên, kiểu và tỉ lệ.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.server') });
const { MongoClient } = require(path.join(ROOT, 'node_modules/mongodb'));

const SAMPLE = Number(process.env.JAPANO_AUDIT_SAMPLE || 400);

// Logical reference cần kiểm chứng. MongoDB KHÔNG có foreign key phía server —
// đây là tham chiếu ở tầng ứng dụng, nên phải đo orphan bằng dữ liệu thật.
const REFERENCES = [
  ['addresses', 'userId', 'users', 'id'],
  ['cart_items', 'userId', 'users', 'id'],
  ['cart_items', 'productId', 'products', 'id'],
  ['wishlist_items', 'userId', 'users', 'id'],
  ['wishlist_items', 'productId', 'products', 'id'],
  ['orders', 'userId', 'users', 'id'],
  ['orders', 'voucherId', 'vouchers', 'id'],
  ['order_items', 'orderId', 'orders', 'id'],
  ['order_items', 'productId', 'products', 'id'],
  ['payments', 'orderId', 'orders', 'id'],
  ['payments', 'userId', 'users', 'id'],
  ['return_requests', 'orderId', 'orders', 'id'],
  ['return_requests', 'paymentId', 'payments', 'id'],
  ['return_requests', 'userId', 'users', 'id'],
  ['products', 'categoryId', 'categories', 'id'],
  ['product_variants', 'productId', 'products', 'id'],
  ['product_media', 'productId', 'products', 'id'],
  ['product_details', 'productId', 'products', 'id'],
  ['reviews', 'productId', 'products', 'id'],
  ['reviews', 'userId', 'users', 'id'],
  ['reviews', 'orderId', 'orders', 'id'],
  ['review_reactions', 'reviewId', 'reviews', 'id'],
  ['review_reactions', 'userId', 'users', 'id'],
  ['interactions', 'userId', 'users', 'id'],
  ['interactions', 'productId', 'products', 'id'],
  ['japan_spots', 'productId', 'products', 'id'],
  ['profiles', 'userId', 'users', 'id'],
  ['voucher_redemptions', 'voucherId', 'vouchers', 'id'],
  ['voucher_redemptions', 'userId', 'users', 'id'],
  ['vip_memberships', 'userId', 'users', 'id'],
  ['vip_memberships', 'discountRuleId', 'discount_rules', 'id'],
  ['flagcard_collections', 'userId', 'users', 'id'],
  ['ai_descriptions', 'productId', 'products', 'id'],
  ['moderation_samples', 'reviewId', 'reviews', 'id'],
  ['goals', 'userId', 'users', 'id'],
  ['chats', 'userId', 'users', 'id'],
  ['push_tokens', 'userId', 'users', 'id'],
];

function bsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value && value._bsontype) return String(value._bsontype).toLowerCase();
  const t = typeof value;
  if (t === 'number') return Number.isInteger(value) ? 'int' : 'double';
  if (t === 'object') return 'object';
  return t;
}

// Mốc thời gian document mới nhất. Đây là bằng chứng để phân biệt "collection
// chết" với "collection theo mùa": số document bằng 0 không nói được gì, nhưng
// một collection có document ghi tuần trước thì chắc chắn còn writer sống.
// Trả null khi không có field thời gian đáng tin — không đoán từ ObjectId, vì
// nhiều document ở đây dùng _id dạng chuỗi.
async function newestDocumentAt(collection) {
  for (const field of ['createdAt', 'updatedAt', 'at', 'timestamp', 'issuedAt']) {
    try {
      const [row] = await collection.find({ [field]: { $exists: true, $ne: null } },
        { projection: { [field]: 1, _id: 0 } }).sort({ [field]: -1 }).limit(1).toArray();
      const value = row?.[field];
      if (value == null) continue;
      const asDate = value instanceof Date ? value
        : (typeof value === 'number' ? new Date(value) : new Date(String(value)));
      if (Number.isNaN(asDate.getTime())) continue;
      return { field, iso: asDate.toISOString() };
    } catch { /* field không sắp xếp được — thử field kế tiếp */ }
  }
  return null;
}

async function fieldStats(collection, total) {
  if (!total) return [];
  const docs = await collection.find({}, { limit: Math.min(SAMPLE, total) }).toArray();
  const seen = new Map();
  for (const doc of docs) {
    for (const [key, value] of Object.entries(doc)) {
      const entry = seen.get(key) || { present: 0, nulls: 0, types: new Map() };
      entry.present += 1;
      if (value === null || value === undefined) entry.nulls += 1;
      const type = bsonType(value);
      entry.types.set(type, (entry.types.get(type) || 0) + 1);
      seen.set(key, entry);
    }
  }
  return [...seen.entries()]
    .map(([name, entry]) => ({
      field: name,
      bsonTypes: [...entry.types.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}:${Math.round(n / docs.length * 100)}%`),
      presencePct: Math.round((entry.present / docs.length) * 100),
      nullPct: Math.round((entry.nulls / docs.length) * 100),
    }))
    .sort((a, b) => b.presencePct - a.presencePct);
}

async function referenceStats(db, existing) {
  const out = [];
  for (const [from, field, to, key] of REFERENCES) {
    if (!existing.has(from) || !existing.has(to)) continue;
    const source = db.collection(from);
    const total = await source.countDocuments({});
    const withField = await source.countDocuments({ [field]: { $exists: true, $nin: [null, ''] } });
    let orphans = 0;
    let resolved = 0;
    if (withField) {
      const values = await source.distinct(field, { [field]: { $exists: true, $nin: [null, ''] } });
      const present = await db.collection(to).distinct(key, { [key]: { $in: values } });
      const presentSet = new Set(present.map(String));
      const missing = values.filter((value) => !presentSet.has(String(value)));
      // Đếm theo DOCUMENT, không theo giá trị distinct.
      orphans = missing.length ? await source.countDocuments({ [field]: { $in: missing } }) : 0;
      resolved = withField - orphans;
    }
    out.push({
      from, field, to, key,
      sourceDocs: total,
      withField,
      coveragePct: total ? Math.round((withField / total) * 100) : 0,
      resolved,
      orphans,
      // Bắt buộc theo DỮ LIỆU nếu mọi document đều có field này.
      observedOptionality: total === 0 ? 'không có dữ liệu' : (withField === total ? 'required' : 'optional'),
      observedCardinality: total === 0 ? 'không có dữ liệu' : 'nhiều-1',
      enforcedBy: 'application-level (MongoDB không có FK phía server)',
    });
  }
  return out;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('Thiếu MONGODB_URI.'); process.exit(2); }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const db = client.db(String(process.env.MONGODB_DB || 'japano').trim());

  const infos = await db.listCollections().toArray();
  const existing = new Set(infos.map((i) => i.name));
  const collections = [];
  for (const info of infos) {
    const collection = db.collection(info.name);
    const count = await collection.countDocuments({});
    let stats = {};
    try {
      const raw = await db.command({ collStats: info.name });
      stats = {
        sizeBytes: raw.size,
        storageBytes: raw.storageSize,
        avgObjBytes: Math.round(raw.avgObjSize || 0),
        // Index thường là phần chi phí bị bỏ quên: bỏ một collection nhỏ nhưng
        // nhiều index có thể tiết kiệm hơn bỏ một collection lớn chỉ có _id.
        totalIndexBytes: raw.totalIndexSize ?? null,
      };
    } catch { /* tier thấp có thể chặn */ }
    const indexes = (await collection.indexes()).map((index) => ({
      name: index.name,
      key: index.key,
      unique: index.unique === true,
      sparse: index.sparse === true,
      partialFilterExpression: index.partialFilterExpression || null,
      expireAfterSeconds: index.expireAfterSeconds,
    }));
    collections.push({
      name: info.name,
      count,
      ...stats,
      indexes,
      uniqueFields: indexes.filter((i) => i.unique).map((i) => Object.keys(i.key)),
      ttlIndexes: indexes.filter((i) => i.expireAfterSeconds !== undefined).map((i) => i.name),
      validator: (info.options && info.options.validator) ? info.options.validator : null,
      hasValidator: Boolean(info.options && info.options.validator),
      fields: await fieldStats(collection, count),
      newestDocument: await newestDocumentAt(collection),
    });
  }
  collections.sort((a, b) => b.count - a.count);
  const references = await referenceStats(db, existing);
  await client.close();

  const snapshot = {
    database: db.databaseName,
    snapshotAt: new Date().toISOString(),
    sampleSizePerCollection: SAMPLE,
    collectionCount: collections.length,
    documentTotal: collections.reduce((sum, c) => sum + c.count, 0),
    ttlIndexCount: collections.reduce((sum, c) => sum + c.ttlIndexes.length, 0),
    validatorCount: collections.filter((c) => c.hasValidator).length,
    uniqueIndexCount: collections.reduce((sum, c) => sum + c.indexes.filter((i) => i.unique).length, 0),
    collections,
    references,
  };

  const outIndex = process.argv.indexOf('--out');
  if (outIndex > -1 && process.argv[outIndex + 1]) {
    fs.writeFileSync(path.resolve(process.argv[outIndex + 1]), JSON.stringify(snapshot, null, 2));
    console.log(`-> ${process.argv[outIndex + 1]}`);
    return;
  }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(snapshot, null, 2)); return; }

  console.log(`Atlas database "${snapshot.database}" — ${snapshot.collectionCount} collection, `
    + `${snapshot.documentTotal} document, ${snapshot.uniqueIndexCount} unique index, `
    + `TTL ${snapshot.ttlIndexCount}, validator ${snapshot.validatorCount}`);
  console.log(`snapshot ${snapshot.snapshotAt}\n`);
  console.log('collection'.padEnd(24) + 'docs'.padStart(7) + '  unique index');
  for (const c of collections) {
    const uniques = c.indexes.filter((i) => i.unique)
      .map((i) => `${Object.keys(i.key).join('+')}${i.sparse ? ' (sparse)' : ''}`);
    console.log(c.name.padEnd(24) + String(c.count).padStart(7) + '  ' + (uniques.join(', ') || '—'));
  }
  const orphaned = references.filter((r) => r.orphans > 0);
  console.log(`\nLogical reference: ${references.length} kiểm chứng, ${orphaned.length} có orphan`);
  for (const r of orphaned) console.log(`  ✗ ${r.from}.${r.field} -> ${r.to}.${r.key}: ${r.orphans} orphan`);
}

main().catch((error) => { console.error('Audit thất bại:', error.name); process.exit(1); });
