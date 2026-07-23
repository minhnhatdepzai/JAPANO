// Migrate script (chạy một lần / khi cần đồng bộ lại): tải toàn bộ ảnh sản
// phẩm thật lên Cloudinary, rồi lưu bản ghi sản phẩm vào MongoDB — phía Mongo
// chỉ giữ id/URL Cloudinary, không nhúng dữ liệu ảnh nhị phân.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.server') });
const cloudinary = require('cloudinary').v2;
const { MongoClient } = require('mongodb');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');
const ASSETS_DIR = path.join(__dirname, '..', '..', 'mobile', 'assets', 'products');

async function main() {
  if (!process.env.CLOUDINARY_URL) throw new Error('Thiếu CLOUDINARY_URL trong .env.server');
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI trong .env.server');
  cloudinary.config({ secure: true });

  const state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const products = state.products || [];
  console.log(`Tìm thấy ${products.length} sản phẩm trong db.json.`);

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'japano');
  const col = db.collection('products');

  let uploaded = 0, skipped = 0;
  for (const product of products) {
    const localImages = (product.images || []).filter((p) => typeof p === 'string' && p.startsWith('/assets/products/'));
    const cloudImages = [];
    for (let i = 0; i < localImages.length; i++) {
      const fileName = localImages[i].replace('/assets/products/', '');
      const filePath = path.join(ASSETS_DIR, fileName);
      if (!fs.existsSync(filePath)) { skipped++; continue; }
      const publicId = `${product.slug}_${i + 1}`;
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'japano/products',
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
      });
      cloudImages.push({ publicId: result.public_id, url: result.secure_url });
      uploaded++;
      process.stdout.write(`  uploaded ${product.slug} [${i + 1}/${localImages.length}]\r`);
    }
    await col.updateOne(
      { slug: product.slug },
      {
        $set: {
          slug: product.slug,
          name: product.name,
          cat: product.cat,
          price: product.price,
          oldPrice: product.oldPrice || null,
          colorHex: product.colorHex,
          kanji: product.kanji,
          tags: product.tags || [],
          images: cloudImages,
          updatedAt: Date.now(),
        },
      },
      { upsert: true },
    );
  }
  console.log(`\nXong. Ảnh đã tải lên Cloudinary: ${uploaded}, bỏ qua (không thấy file): ${skipped}.`);
  const count = await col.countDocuments();
  console.log(`MongoDB collection "products" hiện có ${count} bản ghi.`);
  await client.close();
}

main().catch((error) => { console.error('LỖI:', error.message); process.exit(1); });
