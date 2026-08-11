// Migration idempotent: đưa media catalog lên Cloudinary và chỉ lưu URL trong
// product_media. Không dùng db.json khi MongoDB đã được cấu hình.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.server') });
const cloudinary = require('cloudinary').v2;
const { createStore } = require('../lib/store');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'mobile', 'assets', 'products');
const STORE_FILE = path.join(__dirname, '..', 'data', 'db.json');

function localAssetPath(value) {
  const raw = String(value || '');
  if (!raw.startsWith('/assets/products/')) return null;
  const name = path.basename(raw);
  const filePath = path.join(ASSETS_DIR, name);
  return fs.existsSync(filePath) ? filePath : null;
}

async function cloudUrlFor(value, product, index) {
  const raw = typeof value === 'string' ? value : value?.url;
  if (/^https?:\/\//i.test(String(raw || ''))) return raw;
  const filePath = localAssetPath(raw);
  let source = filePath;
  // Placeholder SVG của admin cũ là data URI URL-encoded, đổi sang base64 để
  // Cloudinary nhận như một ảnh bình thường thay vì lưu nó trong database.
  if (!source && /^data:image\/svg\+xml;utf8,/i.test(String(raw || ''))) {
    const svg = decodeURIComponent(String(raw).slice(String(raw).indexOf(',') + 1));
    source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
  if (!source) throw new Error(`${product.slug}: ảnh #${index + 1} không phải URL Cloudinary hay asset cục bộ hợp lệ.`);
  const result = await cloudinary.uploader.upload(source, {
    folder: 'japano/products',
    public_id: `${product.slug}_${index + 1}`,
    overwrite: true,
    resource_type: 'image',
  });
  return result.secure_url;
}

async function main() {
  if (!process.env.CLOUDINARY_URL) throw new Error('Thiếu CLOUDINARY_URL trong .env.server');
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI trong .env.server');
  cloudinary.config({ secure: true });

  console.log('Đang kết nối MongoDB và Cloudinary…');
  const store = createStore(STORE_FILE);
  await store.initialize();
  const state = store.read();

    const products = Array.isArray(state.products) ? state.products : [];
    const start = Math.max(0, Number(process.argv[2] || 0));
    const count = Math.max(1, Number(process.argv[3] || products.length));
    const selected = products.slice(start, start + count);
    console.log(`Đang xử lý ${selected.length}/${products.length} sản phẩm…`);
    let uploaded = 0;
    for (const product of selected) {
      const before = Array.isArray(product.images) ? product.images : [];
      const images = [];
      for (let index = 0; index < before.length; index++) {
        const raw = typeof before[index] === 'string' ? before[index] : before[index]?.url;
        const wasCloud = /^https?:\/\//i.test(String(raw || ''));
        const url = await cloudUrlFor(before[index], product, index);
        if (!wasCloud) uploaded++;
        images.push(url);
      }
      product.images = images;
      product.image = images[0] || '';
      console.log(`  ✓ ${product.slug}: ${images.length} ảnh`);
    }

    // Goal lưu snapshot sản phẩm để render offline; thay các đường dẫn asset
    // cũ trong snapshot bằng URL Cloudinary của sản phẩm tương ứng.
    const productBySlug = new Map(products.map((product) => [String(product.slug || product.id || ''), product]));
    for (const goal of state.goals || []) {
      const product = productBySlug.get(String(goal.product?.slug || goal.product?.id || goal.productId || ''));
      if (product?.images?.[0] && goal.product && /^\/assets\/products\//.test(String(goal.product.image || ''))) {
        goal.product.image = product.images[0];
      }
    }

    store.write(state);
    await store.flush();
    console.log(`Đã đồng bộ ${selected.length} sản phẩm; tải mới ${uploaded} ảnh lên Cloudinary.`);
}

main().catch((error) => { console.error('LỖI:', error.message); process.exit(1); });
