// Sinh ERD một trang từ đúng các collection MongoDB nguồn đang chạy.
// Nhãn nghiệp vụ bằng tiếng Việt; tên field thật đặt trong ngoặc để đối chiếu Compass.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.server'), quiet: true });
const { MongoClient } = require('mongodb');
const { NORMALIZED_COLLECTIONS, LEGACY_COLLECTIONS } = require('../lib/mongoCollections');

const OUTPUT = path.join(__dirname, '..', '..', 'japano_erd.drawio.xml');

const TITLES = {
  settings: 'Cấu hình hệ thống', categories: 'Danh mục sản phẩm', products: 'Sản phẩm',
  product_details: 'Chi tiết sản phẩm', product_variants: 'Biến thể sản phẩm', product_media: 'Media sản phẩm',
  users: 'Người dùng', addresses: 'Địa chỉ nhận hàng', cart_items: 'Dòng giỏ hàng', wishlist_items: 'Sản phẩm yêu thích',
  orders: 'Đơn hàng', order_items: 'Chi tiết đơn hàng', payments: 'Thanh toán', return_requests: 'Yêu cầu hủy / trả hàng',
  discount_rules: 'Quy tắc giảm giá', vip_memberships: 'Thành viên VIP',
  vouchers: 'Voucher giảm giá', voucher_redemptions: 'Lượt sử dụng voucher', reviews: 'Đánh giá sản phẩm',
  review_reactions: 'Phản hồi đánh giá', moderation_samples: 'Mẫu kiểm duyệt', notifications: 'Thông báo',
  flagcards: 'Thẻ địa danh', flagcard_collections: 'Bộ sưu tập thẻ', banners: 'Banner', interactions: 'Hành vi người dùng',
  search_logs: 'Lịch sử tìm kiếm', push_tokens: 'Thiết bị nhận thông báo', profiles: 'Hồ sơ phong cách',
  chats: 'Hội thoại trợ lý', tryon_history: 'Lịch sử thử đồ', goals: 'Mục tiêu mua sắm', ai_descriptions: 'Mô tả sản phẩm AI',
  japan_spot_reviews: 'Đánh giá địa điểm Nhật', japan_spot_suggestions: 'Gợi ý địa điểm Nhật',
};

const GROUP = {
  settings: 'technical', categories: 'catalog', products: 'catalog', product_details: 'catalog', product_variants: 'catalog', product_media: 'catalog',
  users: 'customer', addresses: 'customer', cart_items: 'commerce', wishlist_items: 'commerce', orders: 'commerce', order_items: 'commerce', payments: 'commerce', return_requests: 'commerce', discount_rules: 'loyalty', vip_memberships: 'loyalty', vouchers: 'commerce', voucher_redemptions: 'commerce', reviews: 'commerce', review_reactions: 'commerce',
  profiles: 'customer', notifications: 'customer', push_tokens: 'customer', interactions: 'ai', search_logs: 'ai', chats: 'ai', tryon_history: 'ai', goals: 'ai', ai_descriptions: 'ai', moderation_samples: 'ai',
  flagcards: 'loyalty', flagcard_collections: 'loyalty', banners: 'content', japan_spot_reviews: 'content', japan_spot_suggestions: 'content',
};

const COLORS = {
  catalog: ['#d5e8d4', '#82b366'], commerce: ['#fff2cc', '#d6b656'], customer: ['#dae8fc', '#6c8ebf'],
  loyalty: ['#e1d5e7', '#9673a6'], ai: ['#f8cecc', '#b85450'], content: ['#ffe6cc', '#d79b00'], technical: ['#f5f5f5', '#666666'],
};

const EMPTY_SCHEMAS = {
  settings: ['_id:string'],
  cart_items: ['_id:string', 'id:string', 'userId:string', 'productId:string', 'color:string', 'size:string', 'quantity:number', 'updatedAt:number'],
  search_logs: ['_id:string', 'id:string', 'userId:string', 'query:string', 'resultCount:number', 'createdAt:number'],
  push_tokens: ['_id:string', 'id:string', 'userId:string', 'token:string', 'platform:string', 'updatedAt:number'],
  japan_spot_suggestions: ['_id:string', 'id:string', 'userId:string', 'prefecture:string', 'suggestion:string', 'status:string', 'createdAt:number'],
};

const VI = {
  _id: 'Khóa chính MongoDB', id: 'Mã nghiệp vụ', categoryId: 'Mã danh mục', productId: 'Mã sản phẩm', productIds: 'Danh sách mã sản phẩm',
  orderId: 'Mã đơn hàng', paymentId: 'Mã thanh toán', userId: 'Mã người dùng', reviewId: 'Mã đánh giá', voucherId: 'Mã voucher',
  discountRuleId: 'Mã quy tắc giảm giá', scope: 'Phạm vi áp dụng', maxUnitsPerOrder: 'Số sản phẩm tối đa mỗi đơn', qualificationType: 'Điều kiện đạt hạng', qualificationValue: 'Ngưỡng đạt hạng', validityDays: 'Số ngày hiệu lực',
  qualifyingPeriod: 'Kỳ xét hạng', qualifyingOrderIds: 'Đơn hàng dùng để xét', qualifiedSpend: 'Chi tiêu đủ điều kiện', startedAt: 'Ngày bắt đầu', expiresAt: 'Ngày hết hạn',
  name: 'Tên', title: 'Tiêu đề', code: 'Mã hiển thị', slug: 'Đường dẫn định danh', sku: 'Mã SKU', status: 'Trạng thái', active: 'Đang hoạt động',
  kanji: 'Tên Kanji', brand: 'Thương hiệu', price: 'Giá bán', compareAtPrice: 'Giá gốc so sánh', description: 'Mô tả', story: 'Câu chuyện sản phẩm',
  colorHex: 'Mã màu', colorName: 'Tên màu', color: 'Màu đã chọn', size: 'Kích thước', stock: 'Số lượng tồn kho', position: 'Thứ tự hiển thị',
  tags: 'Từ khóa', visualTags: 'Từ khóa thị giác', rating: 'Điểm đánh giá', sold: 'Số lượng đã bán', ownerId: 'Mã nhân viên tạo',
  type: 'Loại', url: 'URL Cloudinary', isPrimary: 'Media chính', publicId: 'Mã Cloudinary',
  email: 'Email', phone: 'Số điện thoại', role: 'Vai trò', passwordHash: 'Mật khẩu đã băm', stripeCustomerId: 'Mã khách Stripe', joinedAt: 'Ngày tham gia',
  street: 'Địa chỉ đường', ward: 'Phường / xã', wardCode: 'Mã phường / xã', province: 'Tỉnh / thành', provinceCode: 'Mã tỉnh / thành', isDefault: 'Địa chỉ mặc định',
  quantity: 'Số lượng', items: 'Danh sách mặt hàng snapshot', productSlug: 'Slug sản phẩm snapshot', productName: 'Tên sản phẩm snapshot',
  customer: 'Thông tin khách snapshot', address: 'Địa chỉ giao snapshot', addressDetails: 'Chi tiết địa chỉ snapshot', subtotal: 'Tạm tính', total: 'Tổng thanh toán', ship: 'Phí vận chuyển', discount: 'Tổng giảm giá',
  discountCode: 'Mã ưu đãi snapshot', voucherDiscount: 'Tiền giảm voucher', paymentDiscount: 'Tiền giảm cổng thanh toán', vipDiscount: 'Tiền giảm VIP',
  paymentPromotion: 'Ưu đãi thanh toán snapshot', vipPromotion: 'Ưu đãi VIP snapshot', history: 'Lịch sử trạng thái', source: 'Nguồn tạo', clientRequestId: 'Mã chống tạo trùng',
  returnStatus: 'Trạng thái hậu mãi', flagcardAward: 'Thẻ được thưởng', completedAt: 'Thời điểm hoàn tất',
  provider: 'Nhà cung cấp thanh toán', method: 'Phương thức', amount: 'Số tiền', currency: 'Tiền tệ', transactionCode: 'Mã giao dịch', paymentIntentId: 'Mã Payment Intent', checkoutSessionId: 'Mã phiên thanh toán',
  refundable: 'Có thể hoàn tiền', refunds: 'Các lần hoàn tiền', originalAmount: 'Số tiền ban đầu', amountSubtotal: 'Tạm tính thanh toán', paidAt: 'Thời điểm đã trả', updatedAt: 'Thời điểm cập nhật', createdAt: 'Thời điểm tạo',
  orderCode: 'Mã đơn hiển thị', paymentCode: 'Mã thanh toán hiển thị', reason: 'Lý do', note: 'Ghi chú khách', adminNote: 'Ghi chú quản trị', photos: 'Ảnh minh chứng Cloudinary', timeline: 'Dòng xử lý', refundStatus: 'Trạng thái hoàn tiền',
  value: 'Giá trị', min: 'Đơn tối thiểu', expiry: 'Ngày hết hạn', limit: 'Giới hạn sử dụng', used: 'Số lượt đã dùng', redeemedAt: 'Thời điểm sử dụng',
  comment: 'Nội dung đánh giá', userName: 'Tên người đánh giá', media: 'Media Cloudinary', moderation: 'Kết quả kiểm duyệt', moderatedAt: 'Thời điểm kiểm duyệt',
  label: 'Nhãn kiểm duyệt', normalizedText: 'Nội dung chuẩn hóa', learnedPhrases: 'Cụm từ đã học', reach: 'Số người nhận', body: 'Nội dung', action: 'Hành động mở', at: 'Thời điểm',
  glyph: 'Biểu tượng', accent: 'Màu nhấn', japanese: 'Tên tiếng Nhật', region: 'Vùng', summary: 'Tóm tắt', formationHistory: 'Lịch sử hình thành', legend: 'Truyền thuyết', funFacts: 'Thông tin thú vị', checkins: 'Điểm check-in', outfit: 'Gợi ý trang phục', recommendedProductIds: 'Sản phẩm đề xuất', sourceUrl: 'Nguồn tham khảo',
  cardIds: 'Danh sách mã thẻ', awards: 'Lịch sử nhận thẻ', rewardVoucherCode: 'Mã voucher phần thưởng',
  query: 'Từ khóa tìm kiếm', resultCount: 'Số kết quả', token: 'Token thiết bị', platform: 'Nền tảng', message: 'Tin nhắn', engine: 'Bộ máy xử lý', intent: 'Ý định', confidence: 'Độ tin cậy', generationModel: 'Model sinh', latencyMs: 'Độ trễ', fallbackReason: 'Lý do dự phòng', modelTrace: 'Dấu vết model',
  gender: 'Giới tính', preferredStyles: 'Phong cách yêu thích', skinTone: 'Tông da', occasion: 'Dịp sử dụng', budget: 'Ngân sách', heightCm: 'Chiều cao', weightKg: 'Cân nặng', usualSize: 'Size thường dùng',
  accessoryIds: 'Mã phụ kiện', input: 'Dữ liệu đầu vào', plan: 'Kế hoạch', product: 'Sản phẩm snapshot', generatedAt: 'Thời điểm sinh',
  img: 'URL ảnh banner', link: 'Liên kết', place: 'Địa điểm', prefecture: 'Tỉnh Nhật', suggestion: 'Nội dung gợi ý',
  hotline: 'Hotline', shipFee: 'Phí giao hàng', cod: 'Bật COD', stripe: 'Bật Stripe', vnpay: 'Bật VNPay', logo: 'URL logo Cloudinary', mongo: 'Bật MongoDB', cloudinary: 'Bật Cloudinary', ai: 'Bật AI',
  qualifyingOrderMin: 'Giá trị đơn nhận thẻ', requiredCards: 'Số thẻ yêu cầu', rewardPercent: 'Phần trăm thưởng', rewardVoucherMinOrder: 'Đơn tối thiểu dùng thưởng', rewardValidityDays: 'Số ngày hiệu lực',
};

const RELATIONS = [
  ['products', 'categories', 'categoryId → id'], ['product_details', 'products', 'productId → id'], ['product_variants', 'products', 'productId → id'], ['product_media', 'products', 'productId → id'],
  ['addresses', 'users', 'userId → id'], ['cart_items', 'users', 'userId → id'], ['cart_items', 'products', 'productId → id'], ['wishlist_items', 'users', 'userId → id'], ['wishlist_items', 'products', 'productId → id'],
  ['orders', 'users', 'userId → id'], ['orders', 'vouchers', 'voucherId → id'], ['order_items', 'orders', 'orderId → id'], ['order_items', 'products', 'productId → id'],
  ['payments', 'orders', 'orderId → id'], ['payments', 'users', 'userId → id'], ['return_requests', 'orders', 'orderId → id'], ['return_requests', 'payments', 'paymentId → id'], ['return_requests', 'users', 'userId → id'],
  ['vip_memberships', 'users', 'userId → id'], ['vip_memberships', 'discount_rules', 'discountRuleId → id'], ['vip_memberships', 'orders', 'qualifyingOrderIds[] → id'],
  ['voucher_redemptions', 'vouchers', 'voucherId → id'], ['voucher_redemptions', 'orders', 'orderId → id'], ['voucher_redemptions', 'users', 'userId → id'],
  ['reviews', 'products', 'productId → id'], ['reviews', 'orders', 'orderId → id'], ['reviews', 'users', 'userId → id'], ['review_reactions', 'reviews', 'reviewId → id'], ['review_reactions', 'users', 'userId → id'],
  ['profiles', 'users', 'userId → id'], ['notifications', 'users', 'userId → id'], ['push_tokens', 'users', 'userId → id'], ['interactions', 'users', 'userId → id'], ['interactions', 'products', 'productId → id'],
  ['search_logs', 'users', 'userId → id'], ['chats', 'users', 'userId → id'], ['tryon_history', 'users', 'userId → id'], ['tryon_history', 'products', 'productId → id'], ['goals', 'users', 'userId → id'], ['goals', 'products', 'productId → id'], ['ai_descriptions', 'products', 'productId → id'],
  ['flagcard_collections', 'users', 'userId → id'], ['flagcard_collections', 'flagcards', 'cardIds[] → id'], ['flagcards', 'products', 'recommendedProductIds[] → id'],
  ['japan_spot_reviews', 'users', 'userId → id'], ['japan_spot_suggestions', 'users', 'userId → id'], ['moderation_samples', 'reviews', 'reviewId → id'],
];

const REF_FIELDS = new Set(['categoryId', 'productId', 'productIds', 'orderId', 'paymentId', 'userId', 'reviewId', 'voucherId', 'discountRuleId', 'qualifyingOrderIds', 'cardIds', 'recommendedProductIds', 'ownerId']);

function xml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function valueType(value) { if (value === null) return 'null'; if (Array.isArray(value)) return 'array'; if (value instanceof Date) return 'date'; return typeof value; }
function viType(type) { return ({ string: 'chuỗi', number: 'số', boolean: 'đúng/sai', array: 'danh sách', object: 'đối tượng', date: 'ngày giờ', null: 'rỗng' })[type] || type; }
function inferSchema(docs, fallback = []) {
  const fields = new Map();
  for (const item of fallback) { const [name, type] = item.split(':'); fields.set(name, new Set([type])); }
  for (const doc of docs) for (const [name, value] of Object.entries(doc)) {
    if (!fields.has(name)) fields.set(name, new Set());
    fields.get(name).add(valueType(value));
  }
  return [...fields].map(([name, types]) => ({ name, type: [...types].sort().map(viType).join(' | ') }));
}
function cell(id, value, style, x, y, width, height) { return `        <mxCell id="${xml(id)}" value="${xml(value)}" style="${xml(style)}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" /></mxCell>`; }
function edge(id, source, target, value) { return `        <mxCell id="${xml(id)}" value="${xml(value)}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;dashed=1;dashPattern=4 4;endArrow=block;endFill=1;strokeColor=#666666;fontSize=9;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry" /></mxCell>`; }
function tableHtml(name, fields, count) {
  const [fill] = COLORS[GROUP[name]];
  const rows = fields.map(({ name: field, type }) => {
    const prefix = field === '_id' ? 'PK' : REF_FIELDS.has(field) ? 'REF' : '';
    return `<div style="padding:2px 0;border-top:1px solid #eeeeee"><span style="color:#b85450;font-weight:bold">${prefix}${prefix ? ' ' : ''}</span><b>${VI[field] || 'Thuộc tính bổ sung'}</b><span style="color:#666"> (${field}) · ${type}</span></div>`;
  }).join('');
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;text-align:left"><div style="font-size:14px;font-weight:bold;text-align:center;background:${fill};padding:6px">${TITLES[name]}<br><span style="font-size:10px;font-weight:normal">${name}</span></div><div style="font-size:9px;color:#666;padding:4px 6px">Collection nguồn · ${count} document</div><div style="padding:0 7px 7px">${rows}</div></div>`;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI trong .env.server');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'japano');
    const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name);
    const legacy = LEGACY_COLLECTIONS.filter((name) => existing.includes(name));
    const unexpected = existing.filter((name) => !NORMALIZED_COLLECTIONS.includes(name));
    const missing = NORMALIZED_COLLECTIONS.filter((name) => !existing.includes(name));
    if (legacy.length || unexpected.length || missing.length) {
      throw new Error(`MongoDB chưa khớp ERD. Legacy: ${legacy.join(', ') || 'không'}; thừa: ${unexpected.join(', ') || 'không'}; thiếu: ${missing.join(', ') || 'không'}.`);
    }

    const schemas = new Map();
    const counts = new Map();
    for (const name of NORMALIZED_COLLECTIONS) {
      const docs = await db.collection(name).find({}).limit(1000).toArray();
      schemas.set(name, inferSchema(docs, EMPTY_SCHEMAS[name] || []));
      counts.set(name, await db.collection(name).countDocuments());
    }

    const columnX = [50, 425, 800, 1175, 1550, 1925, 2300];
    const columnY = columnX.map(() => 285);
    const ids = new Map(NORMALIZED_COLLECTIONS.map((name) => [name, `table_${name}`]));
    const root = ['      <root>', '        <mxCell id="0" />', '        <mxCell id="1" parent="0" />'];
    root.push(cell('title', '<b>JAPANO · ERD MONGODB COLLECTION-FIRST</b><br><br><b>Database vật lý:</b> mỗi khối là một collection nguồn thật trong MongoDB Compass; không có app_state hoặc projection. REF là tham chiếu logic được backend kiểm tra và index. Media thật nằm trên Cloudinary, MongoDB chỉ giữ URL.', 'text;html=1;align=left;verticalAlign=middle;fontSize=14;spacing=14;rounded=1;fillColor=#ffffff;strokeColor=#333333;strokeWidth=2;', 50, 35, 2590, 105));
    root.push(cell('legend', '<b>Luồng chính:</b> Danh mục → Sản phẩm → Chi tiết / Biến thể / Media · Người dùng → Đơn hàng → Chi tiết đơn → Thanh toán → Hủy/Trả · Voucher → Lượt dùng → Đơn hàng.<br><b>VIP:</b> vip_memberships nối discountRuleId tới discount_rules; membership không lặp phần trăm giảm/ngưỡng. Tiền giảm đã áp dụng vẫn nằm tại đơn để bảo toàn lịch sử.', 'text;html=1;align=left;verticalAlign=middle;fontSize=11;spacing=10;rounded=1;fillColor=#f5f5f5;strokeColor=#999999;', 50, 155, 2590, 90));

    for (const name of NORMALIZED_COLLECTIONS) {
      const height = Math.max(120, 78 + schemas.get(name).length * 18);
      let column = 0;
      for (let index = 1; index < columnX.length; index++) if (columnY[index] < columnY[column]) column = index;
      const y = columnY[column];
      columnY[column] += height + 36;
      const [, stroke] = COLORS[GROUP[name]];
      root.push(cell(ids.get(name), tableHtml(name, schemas.get(name), counts.get(name)), `rounded=1;whiteSpace=wrap;html=1;overflow=hidden;strokeWidth=1.5;strokeColor=${stroke};fillColor=#ffffff;align=left;verticalAlign=top;spacing=0;`, columnX[column], y, 345, height));
    }
    RELATIONS.forEach(([from, to, label], index) => root.push(edge(`relation_${index}`, ids.get(from), ids.get(to), label)));
    const footerY = Math.max(...columnY) + 20;
    root.push(cell('cloudinary', '<b>Cloudinary (ngoài database)</b><br>Giữ file ảnh/video. product_media.url, reviews.media, return_requests.photos, banners.img và settings.logo chỉ lưu URL.', 'rounded=1;whiteSpace=wrap;html=1;fontSize=11;align=left;verticalAlign=middle;spacing=11;fillColor=#e1d5e7;strokeColor=#9673a6;strokeWidth=2;', 2300, footerY, 345, 110));
    root.push('      </root>');
    const height = footerY + 180;
    const document = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="JAPANO" version="24.7.17">\n  <diagram id="japano-mongodb" name="ERD MongoDB chuẩn">\n    <mxGraphModel dx="${Math.max(2800, Math.round(height * 0.7))}" dy="${height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2700" pageHeight="${height}" math="0" shadow="0">\n${root.join('\n')}\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n`;
    fs.writeFileSync(OUTPUT, document);
    console.log(`Đã tạo ${OUTPUT}`);
    console.log(`${NORMALIZED_COLLECTIONS.length} collection nguồn, ${RELATIONS.length} liên kết, 1 trang Draw.io.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => { console.error('LỖI:', error.message); process.exitCode = 1; });
