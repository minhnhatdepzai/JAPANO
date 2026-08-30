#!/usr/bin/env node
/**
 * Migration 34 -> 29 collection cho database JAPANO.
 *
 *   node scripts/migrate_lean_collections.js --dry-run    # mặc định, không ghi gì
 *   node scripts/migrate_lean_collections.js --backup     # chỉ tạo backup
 *   node scripts/migrate_lean_collections.js --apply      # ghi settings mới
 *   node scripts/migrate_lean_collections.js --drop       # xoá 5 collection cũ
 *
 * Năm collection bị bỏ và lý do — mỗi lý do đã được kiểm bằng source và dữ liệu:
 *
 *   product_details  -> đã nhúng trong products (Atlas đo được 100% document
 *                       products đã có description/story/tags/rating/sold).
 *   banners          -> nhúng vào settings/_id=banners. Vẫn là dữ liệu người
 *                       vận hành nhập, KHÔNG bị xoá, chỉ đổi chỗ ở.
 *   discount_rules   -> nhúng vào settings/_id=discount_rules.
 *   vip_memberships  -> suy ra từ orders. lib/vip.js reconcileVipState() chạy ở
 *                       MỌI read()/write() của server, nên bản persist chỉ là
 *                       bản sao luôn bị ghi đè.
 *   ai_descriptions  -> cache mô tả sinh bởi AI, dựng lại được từ catalog.
 *
 * KHÔNG đụng tới voucher_redemptions (chứng từ đối soát) và flagcard_collections
 * (có thể chứa quà admin cấp tay, không suy ra được từ đơn hàng).
 *
 * KHÔNG in URI/credential. KHÔNG tạo database thứ hai. KHÔNG drop khi chưa có
 * backup và chưa qua validate.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.server') });
const { MongoClient } = require(path.join(ROOT, 'node_modules/mongodb'));

const LEGACY = ['product_details', 'banners', 'discount_rules', 'vip_memberships', 'ai_descriptions'];
// Sao lưu cả đích đến, không chỉ nguồn: rollback cần khôi phục cả hai phía.
const ALSO_BACKUP = ['products', 'settings'];

const args = new Set(process.argv.slice(2));
const MODE = args.has('--drop') ? 'drop'
  : args.has('--apply') ? 'apply'
  : args.has('--backup') ? 'backup'
  : 'dry-run';

const BACKUP_DIR = path.join(ROOT, 'backend', 'data', 'migration-backups');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function backup(db, stamp) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const manifest = { createdAt: new Date().toISOString(), database: db.databaseName, artifacts: [] };
  for (const name of [...LEGACY, ...ALSO_BACKUP]) {
    const docs = await db.collection(name).find({}).toArray().catch(() => []);
    const indexes = await db.collection(name).indexes().catch(() => []);
    const payload = Buffer.from(JSON.stringify({ collection: name, indexes, documents: docs }, null, 0), 'utf8');
    const gz = zlib.gzipSync(payload);
    const file = path.join(BACKUP_DIR, `${stamp}__${name}.json.gz`);
    fs.writeFileSync(file, gz, { mode: 0o600 });
    manifest.artifacts.push({
      collection: name,
      file: path.relative(ROOT, file),
      documents: docs.length,
      indexCount: indexes.length,
      bytesGzip: gz.length,
      sha256: sha256(gz),
    });
    console.log(`  backup ${name.padEnd(18)} ${String(docs.length).padStart(4)} doc  ${String(gz.length).padStart(7)} B  ${sha256(gz).slice(0, 16)}…`);
  }
  const manifestFile = path.join(BACKUP_DIR, `${stamp}__manifest.json`);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(`  manifest -> ${path.relative(ROOT, manifestFile)}`);
  return manifest;
}

/**
 * So từng field một giữa products và product_details.
 *
 * Đây là điều kiện tiên quyết để được phép drop: nếu một sản phẩm nào đó có mô
 * tả trong product_details mà bản nhúng lại rỗng hoặc khác, drop sẽ mất nội
 * dung thật chứ không phải mất một bản sao.
 */
async function verifyProductMerge(db) {
  const details = await db.collection('product_details').find({}).toArray().catch(() => []);
  const products = await db.collection('products').find({}).toArray();
  const byId = new Map(products.map((p) => [String(p.id || p._id), p]));
  const problems = [];
  const FIELDS = ['description', 'story', 'colorHex', 'tags', 'visualTags', 'rating', 'sold'];

  for (const detail of details) {
    const product = byId.get(String(detail.productId));
    if (!product) { problems.push(`${detail.productId}: không tìm thấy product tương ứng`); continue; }
    for (const field of FIELDS) {
      const from = detail[field];
      const to = product[field];
      if (from == null || from === '' || (Array.isArray(from) && !from.length)) continue;
      const same = JSON.stringify(from) === JSON.stringify(to);
      if (!same) problems.push(`${detail.productId}.${field}: bản nhúng khác bản cũ`);
    }
  }
  return { detailCount: details.length, productCount: products.length, problems };
}

async function main() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  const dbName = String(process.env.MONGODB_DB || 'japano').trim();
  if (!uri) { console.error('Thiếu MONGODB_URI trong .env.server.'); process.exit(1); }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(dbName);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  console.log(`chế độ    : ${MODE}`);
  console.log(`database  : ${dbName}`);

  const before = (await db.listCollections().toArray()).map((c) => c.name).sort();
  console.log(`collection: ${before.length}`);

  const merge = await verifyProductMerge(db);
  console.log(`\nkiểm tra gộp product_details: ${merge.detailCount} detail / ${merge.productCount} product`);
  if (merge.problems.length) {
    console.log('  KHÁC BIỆT:');
    merge.problems.slice(0, 20).forEach((p) => console.log('   -', p));
  } else {
    console.log('  mọi field đã khớp — bản nhúng đầy đủ');
  }

  const legacyCounts = {};
  for (const name of LEGACY) {
    legacyCounts[name] = await db.collection(name).countDocuments().catch(() => 0);
  }
  console.log('\ncollection cũ:');
  for (const [name, count] of Object.entries(legacyCounts)) console.log(`  ${name.padEnd(18)} ${count} doc`);

  const settingsIds = (await db.collection('settings').find({}, { projection: { _id: 1 } }).toArray()).map((r) => String(r._id));
  const migrated = settingsIds.includes('banners') && settingsIds.includes('discount_rules');
  console.log(`\nsettings hiện có : ${settingsIds.join(', ')}`);
  console.log(`đã migrate chưa  : ${migrated ? 'RỒI' : 'CHƯA'}`);

  if (MODE === 'dry-run') {
    console.log('\n[dry-run] Sẽ thực hiện:');
    console.log(`  + ghi settings/_id=banners        (${legacyCounts.banners} mục)`);
    console.log(`  + ghi settings/_id=discount_rules (${legacyCounts.discount_rules} mục)`);
    console.log(`  - drop ${LEGACY.join(', ')}`);
    console.log(`  => ${before.length} -> ${before.length - LEGACY.filter((n) => before.includes(n)).length} collection`);
    console.log('\nKhông ghi gì. Chạy --backup rồi --apply, sau đó validate, cuối cùng mới --drop.');
  }

  if (MODE === 'backup') {
    console.log('\nĐang backup (gzip, quyền 0600):');
    await backup(db, stamp);
    console.log('\nRollback: node scripts/restore_lean_backup.js <stamp>');
  }

  if (MODE === 'apply') {
    if (merge.problems.length) {
      console.error('\nDỪNG: product_details chưa khớp bản nhúng. Không ghi gì.');
      await client.close();
      process.exit(2);
    }
    console.log('\nBackup trước khi ghi:');
    await backup(db, stamp);

    const banners = await db.collection('banners').find({}).toArray().catch(() => []);
    const rules = await db.collection('discount_rules').find({}).toArray().catch(() => []);
    const strip = (rows) => rows.map(({ _id, ...rest }) => rest);

    await db.collection('settings').updateOne(
      { _id: 'banners' }, { $set: { items: strip(banners) } }, { upsert: true });
    await db.collection('settings').updateOne(
      { _id: 'discount_rules' }, { $set: { items: strip(rules) } }, { upsert: true });

    console.log(`\nĐã ghi settings/_id=banners        ${banners.length} mục`);
    console.log(`Đã ghi settings/_id=discount_rules ${rules.length} mục`);
    console.log('\nCHƯA drop gì. Hãy restart backend, chạy validate, rồi mới --drop.');
  }

  if (MODE === 'drop') {
    if (!migrated) {
      console.error('\nDỪNG: settings chưa có banners/discount_rules. Chạy --apply trước.');
      await client.close();
      process.exit(2);
    }
    if (merge.problems.length) {
      console.error('\nDỪNG: product_details chưa khớp bản nhúng.');
      await client.close();
      process.exit(2);
    }
    const backups = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('manifest.json')) : [];
    if (!backups.length) {
      console.error('\nDỪNG: không tìm thấy backup nào. Chạy --backup trước.');
      await client.close();
      process.exit(2);
    }
    console.log(`\nCó ${backups.length} backup, mới nhất: ${backups.sort().pop()}`);
    for (const name of LEGACY) {
      if (!before.includes(name)) { console.log(`  ${name}: không tồn tại, bỏ qua`); continue; }
      await db.collection(name).drop();
      console.log(`  đã drop ${name}`);
    }
    const after = (await db.listCollections().toArray()).map((c) => c.name).sort();
    console.log(`\ncollection: ${before.length} -> ${after.length}`);
  }

  await client.close();
}

main().catch((error) => { console.error('LỖI:', error.message); process.exit(1); });
