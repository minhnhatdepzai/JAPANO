#!/usr/bin/env node
/**
 * Rollback migration 34 -> 29.
 *
 *   node scripts/restore_lean_backup.js                 # liệt kê backup có sẵn
 *   node scripts/restore_lean_backup.js <stamp> --check # kiểm SHA-256, không ghi
 *   node scripts/restore_lean_backup.js <stamp> --restore
 *
 * Khôi phục dựng LẠI từng collection từ file gzip và gỡ hai document settings
 * đã thêm, đưa database về đúng hình dạng trước migration.
 *
 * SHA-256 được kiểm TRƯỚC khi ghi. Một backup hỏng mà vẫn restore thì còn tệ
 * hơn không restore: nó ghi đè dữ liệu đang chạy bằng rác.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.server') });
const { MongoClient } = require(path.join(ROOT, 'node_modules/mongodb'));

const BACKUP_DIR = path.join(ROOT, 'backend', 'data', 'migration-backups');
const [stamp, flag] = process.argv.slice(2);

function listManifests() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('__manifest.json')).sort();
}

function verify(manifest) {
  const results = [];
  for (const artifact of manifest.artifacts) {
    const file = path.join(ROOT, artifact.file);
    if (!fs.existsSync(file)) { results.push({ ...artifact, ok: false, why: 'thiếu file' }); continue; }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    results.push({ ...artifact, ok: actual === artifact.sha256, why: actual === artifact.sha256 ? '' : 'SHA-256 lệch' });
  }
  return results;
}

async function main() {
  const manifests = listManifests();
  if (!stamp) {
    console.log(manifests.length ? 'Backup có sẵn:' : 'Chưa có backup nào.');
    manifests.forEach((m) => console.log('  ', m.replace('__manifest.json', '')));
    return;
  }

  const manifestFile = path.join(BACKUP_DIR, `${stamp}__manifest.json`);
  if (!fs.existsSync(manifestFile)) {
    console.error(`Không tìm thấy manifest cho "${stamp}".`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const checks = verify(manifest);
  console.log(`backup ${stamp} — ${manifest.artifacts.length} artifact`);
  for (const c of checks) {
    console.log(`  ${c.ok ? 'ok  ' : 'HỎNG'} ${c.collection.padEnd(18)} ${String(c.documents).padStart(4)} doc  ${c.why}`);
  }
  const broken = checks.filter((c) => !c.ok);
  if (broken.length) { console.error('\nBackup không toàn vẹn — KHÔNG restore.'); process.exit(2); }
  if (flag !== '--restore') { console.log('\nToàn vẹn. Thêm --restore để ghi lại vào database.'); return; }

  const uri = String(process.env.MONGODB_URI || '').trim();
  const dbName = String(process.env.MONGODB_DB || 'japano').trim();
  if (!uri) { console.error('Thiếu MONGODB_URI.'); process.exit(1); }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(dbName);

  for (const artifact of manifest.artifacts) {
    const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, artifact.file))).toString('utf8'));
    const collection = db.collection(payload.collection);
    await collection.deleteMany({});
    if (payload.documents.length) await collection.insertMany(payload.documents);
    for (const index of payload.indexes || []) {
      if (index.name === '_id_') continue;
      const { key, name, v, ...options } = index;
      await collection.createIndex(key, { name, ...options }).catch(() => undefined);
    }
    console.log(`  khôi phục ${payload.collection.padEnd(18)} ${payload.documents.length} doc`);
  }

  // Gỡ hai document settings do migration thêm vào, trả settings về hình cũ.
  await db.collection('settings').deleteMany({ _id: { $in: ['banners', 'discount_rules'] } });
  console.log('  đã gỡ settings/_id=banners và settings/_id=discount_rules');

  const after = (await db.listCollections().toArray()).length;
  console.log(`\ncollection sau rollback: ${after}`);
  await client.close();
}

main().catch((error) => { console.error('LỖI:', error.message); process.exit(1); });
