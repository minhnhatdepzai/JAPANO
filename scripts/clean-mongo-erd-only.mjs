import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.server' });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

const ERD_COLLECTION_NAMES = Object.freeze([
  'categories',
  'products',
  'productvariants',
  'images',
  'colors',
  'sizes',
  'users',
  'aichats',
  'wishlists',
  'notifications',
  'forgotpasswords',
  'reviews',
  'orders',
  'orderitems',
  'payments',
  'discountcodes',
  'carts',
]);

if (!MONGODB_URI) {
  console.error('[JAPANO] Thiếu MONGODB_URI trong .env.server');
  process.exit(1);
}

const keep = new Set(ERD_COLLECTION_NAMES);

try {
  await mongoose.connect(MONGODB_URI);
  const dbName = mongoose.connection.db.databaseName;
  const collections = await mongoose.connection.db.listCollections().toArray();
  const names = collections.map((item) => item.name).sort();
  const dropNames = names.filter((name) => !keep.has(name));

  console.log(`[JAPANO] Database: ${dbName}`);
  console.log(`[JAPANO] Giữ lại ${ERD_COLLECTION_NAMES.length} collection theo ERD:`);
  console.log(`  ${ERD_COLLECTION_NAMES.join(', ')}`);

  if (!dropNames.length) {
    console.log('[JAPANO] Không có collection thừa để xoá.');
  } else {
    console.log(`[JAPANO] Sẽ xoá ${dropNames.length} collection thừa:`);
    for (const name of dropNames) console.log(`  - ${name}`);
    for (const name of dropNames) {
      await mongoose.connection.db.dropCollection(name);
      console.log(`[JAPANO] Đã xoá: ${name}`);
    }
  }

  const after = await mongoose.connection.db.listCollections().toArray();
  console.log('[JAPANO] Collection còn lại sau khi dọn:');
  console.log(`  ${after.map((item) => item.name).sort().join(', ') || '(trống)'}`);
  await mongoose.disconnect();
  console.log('[JAPANO] Xong. MongoDB giờ chỉ còn collection theo ERD.');
} catch (error) {
  console.error('[JAPANO] Lỗi khi dọn MongoDB:', error?.message || error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
}
