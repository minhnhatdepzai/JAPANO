// Sinh Từ điển dữ liệu (Data Dictionary) từ DỮ LIỆU THẬT đang có.
//
// Không mô tả theo trí nhớ: kịch bản đọc bản chụp backend/data/db.json, suy ra
// kiểu dữ liệu, tỉ lệ có giá trị, tính duy nhất và giá trị mẫu cho từng trường,
// rồi đối chiếu với danh sách collection khai báo trong mongoCollections.js.
//
// Cách dùng: node backend/scripts/generate-data-dictionary.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'project_audit', 'data_dictionary.md');

// Ánh xạ khoá trong state → tên collection vật lý (theo DIRECT_COLLECTIONS và
// NORMALIZED_COLLECTIONS trong backend/lib/mongoCollections.js).
const STATE_TO_COLLECTION = {
  categories: 'categories', products: 'products', users: 'users', addresses: 'addresses',
  carts: 'cart_items', wishlists: 'wishlist_items', orders: 'orders', payments: 'payments',
  returnRequests: 'return_requests', reviews: 'reviews', reviewReactions: 'review_reactions',
  moderationSamples: 'moderation_samples', notifications: 'notifications',
  discountRules: 'discount_rules', vouchers: 'vouchers', voucherRedemptions: 'voucher_redemptions',
  flagcards: 'flagcards', flagcardCollections: 'flagcard_collections',
  vipMemberships: 'vip_memberships', banners: 'banners', interactions: 'interactions',
  searchLogs: 'search_logs', pushTokens: 'push_tokens', profiles: 'profiles', chats: 'chats',
  goals: 'goals', aiDescriptions: 'ai_descriptions',
  japanSpotReviews: 'japan_spot_reviews', japanSpotSuggestions: 'japan_spot_suggestions',
};

// Trường được dùng làm tham chiếu sang collection khác.
const REFERENCES = {
  userId: 'users', productId: 'products', orderId: 'orders', paymentId: 'payments',
  reviewId: 'reviews', cardId: 'flagcards', discountRuleId: 'discount_rules',
  categoryId: 'categories', slug: 'products (theo slug)', returnRequestId: 'return_requests',
};

function typeOf(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return 'mảng';
  if (value instanceof Date) return 'ngày giờ';
  const t = typeof value;
  if (t === 'number') return Number.isInteger(value) ? 'số nguyên' : 'số thực';
  if (t === 'boolean') return 'luận lý';
  if (t === 'object') return 'đối tượng';
  if (t === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'chuỗi (ngày)';
    return 'chuỗi';
  }
  return t;
}

function sample(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return `[${value.length} phần tử]`;
  if (typeof value === 'object') return `{${Object.keys(value).slice(0, 3).join(', ')}…}`;
  const s = String(value);
  return s.length > 34 ? `${s.slice(0, 31)}…` : s;
}

function analyse(rows) {
  const fields = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const [key, value] of Object.entries(row)) {
      if (!fields.has(key)) fields.set(key, { types: new Set(), present: 0, values: [], first: value });
      const f = fields.get(key);
      const t = typeOf(value);
      if (t) { f.types.add(t); f.present += 1; }
      if (f.values.length < 400 && (typeof value === 'string' || typeof value === 'number')) {
        f.values.push(String(value));
      }
      if (f.first === undefined || f.first === null) f.first = value;
    }
  }
  return [...fields.entries()].map(([name, f]) => {
    const total = rows.length || 1;
    const unique = f.values.length >= total * 0.9 && new Set(f.values).size === f.values.length && f.values.length > 1;
    return {
      name,
      type: [...f.types].join(' / ') || '—',
      required: f.present === rows.length && rows.length > 0,
      presentPct: Math.round((f.present / total) * 100),
      unique,
      reference: REFERENCES[name] || '',
      sample: sample(f.first),
    };
  }).sort((a, b) => b.presentPct - a.presentPct);
}

const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend', 'data', 'db.json'), 'utf8'));
const lines = [];
lines.push('# Từ điển dữ liệu (Data Dictionary)');
lines.push('');
lines.push('> Sinh tự động từ `backend/data/db.json` bằng `backend/scripts/generate-data-dictionary.js`.');
lines.push('> Cột **Bắt buộc** nghĩa là trường có mặt ở 100% bản ghi hiện có; cột **Duy nhất** là suy ra');
lines.push('> từ dữ liệu thật, không phải ràng buộc do cơ sở dữ liệu áp đặt — MongoDB chỉ ép duy nhất ở');
lines.push('> những trường có khai báo chỉ mục unique trong `ensureMongoIndexes()`.');
lines.push('');
lines.push(`Thời điểm sinh: ${new Date().toISOString()}`);
lines.push('');

const summary = [];
for (const [stateKey, collection] of Object.entries(STATE_TO_COLLECTION)) {
  const rows = Array.isArray(db[stateKey]) ? db[stateKey] : [];
  summary.push({ collection, stateKey, count: rows.length });
}
lines.push('## Tổng quan');
lines.push('');
lines.push('| Collection | Khoá trong state | Số bản ghi |');
lines.push('|---|---|---:|');
for (const s of summary.sort((a, b) => b.count - a.count)) {
  lines.push(`| \`${s.collection}\` | \`${s.stateKey}\` | ${s.count} |`);
}
lines.push('');
lines.push('> Ngoài các collection trên, hệ thống còn tách `product_details`, `product_variants`');
lines.push('> và `product_media` từ mảng `products` khi ghi xuống MongoDB, cùng `order_items`');
lines.push('> tách từ `orders.items`, và `settings` lưu cấu hình cửa hàng.');
lines.push('');

for (const [stateKey, collection] of Object.entries(STATE_TO_COLLECTION)) {
  const rows = Array.isArray(db[stateKey]) ? db[stateKey] : [];
  if (!rows.length) continue;
  lines.push(`## \`${collection}\``);
  lines.push('');
  lines.push(`Số bản ghi: **${rows.length}**`);
  lines.push('');
  lines.push('| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |');
  lines.push('|---|---|:---:|:---:|---:|---|---|');
  for (const f of analyse(rows)) {
    lines.push(`| \`${f.name}\` | ${f.type} | ${f.required ? '✔' : ''} | ${f.unique ? '✔' : ''} | ${f.presentPct}% | ${f.reference} | ${f.sample.replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n'));
console.log(`  → đã ghi ${OUT}`);
console.log(`  ${summary.filter((s) => s.count).length} collection có dữ liệu`);
