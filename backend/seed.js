/* Dữ liệu mẫu JAPANO. Slug và ảnh khớp với mobile/assets/products. */
const fs = require('fs');
const path = require('path');
const { FLAGCARDS, DEFAULT_FLAGCARD_CONFIG } = require('./lib/flagcards');

const CATS = [
  { id: 'ao-truyen-thong', name: 'Áo truyền thống', kanji: '着物' },
  { id: 'haori', name: 'Áo khoác', kanji: '羽織' },
  { id: 'trang-phuc', name: 'Trang phục', kanji: '制服' },
  { id: 'phu-kien', name: 'Phụ kiện', kanji: '小物' },
  { id: 'cosplay', name: 'Cosplay', kanji: 'コス' },
];

const SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'];
const NAMES = ['Trần Minh', 'Nguyễn Thu Hà', 'Lê Quốc Bảo', 'Phạm Mỹ Linh', 'Hoàng Anh Tú', 'Đặng Khánh Vy', 'Vũ Hải Nam', 'Bùi Ngọc Ánh', 'Đỗ Gia Huy', 'Lý Cẩm Tú'];
const ADDR = ['123 Lê Lợi, P. Bến Nghé, HCM', '45 Bà Triệu, P. Hoàn Kiếm, Hà Nội', '78 Trần Phú, P. Hải Châu, Đà Nẵng', '12 Nguyễn Huệ, P. Bến Nghé, HCM', '90 Cầu Giấy, P. Cầu Giấy, Hà Nội'];
const PRODUCT_ASSET_DIR = path.join(__dirname, '..', 'mobile', 'assets', 'products');

// slug, name, category, price, old price, color, kanji, rating, historical sold, tags
const PRODUCT_BASE = [
  ['kimono-hong', 'Kimono truyền thống Hồng', 'ao-truyen-thong', 1890000, 2290000, '#C06A86', '着物', 4.7, 120, ['lễ hội', 'thanh lịch', 'hồng']],
  ['yukata-xanh', 'Yukata vải bông xanh đen', 'ao-truyen-thong', 1290000, 1590000, '#243244', '浴衣', 4.7, 54, ['mùa hè', 'xanh', 'tối giản']],
  ['haori-dang-dai', 'Áo choàng Haori dáng dài', 'haori', 1350000, 1690000, '#33261d', '羽織', 4.5, 88, ['layer', 'truyền thống', 'dáng dài']],
  ['cardigan-dai', 'Áo len khoác dáng dài', 'haori', 890000, 1090000, '#6B7255', '羽織', 4.7, 54, ['áo len khoác', 'ấm', 'công sở']],
  ['blazer-kaki', 'Áo khoác kaki dáng dài', 'haori', 990000, null, '#B08D3C', '羽織', 5.0, 203, ['áo khoác', 'kaki', 'công sở']],
  ['ao-len-cardigan', 'Áo len khoác dệt kim', 'haori', 650000, null, '#A88C75', '羽織', 4.5, 96, ['áo len khoác', 'dệt kim', 'nhẹ nhàng']],
  ['khoac-nhat', 'Áo khoác Nhật bản mùa', 'haori', 1150000, null, '#2F3B35', '羽織', 4.7, 203, ['áo khoác', 'nhật', 'layer']],
  ['dong-phuc-thuy-thu', 'Đồng phục thủy thủ nữ', 'trang-phuc', 720000, null, '#243244', '制服', 4.5, 96, ['thủy thủ', 'nữ', 'học đường']],
  ['so-mi-trang', 'Sơ mi trắng tay ngắn', 'trang-phuc', 550000, null, '#E5E7EB', '制服', 4.5, 88, ['sơ mi', 'trắng', 'công sở']],
  ['ao-len-co-lo', 'Áo len cổ lọ dệt kim', 'trang-phuc', 590000, null, '#8B6B4A', '制服', 5.0, 54, ['áo len', 'cổ lọ', 'mùa đông']],
  ['balo-vai', 'Balo vải Nhật', 'phu-kien', 490000, null, '#8A2F26', '鞄', 4.8, 96, ['balo', 'đi học', 'vải']],
  ['giay-dep', 'Dép quai Nhật', 'phu-kien', 390000, null, '#795548', '履物', 4.5, 203, ['dép', 'giày', 'hằng ngày']],
  ['mu-nhat', 'Mũ bo Nhật', 'phu-kien', 280000, null, '#31363A', '帽子', 4.5, 120, ['mũ', 'streetwear', 'unisex']],
  ['du-nhat', 'Dù Nhật bản', 'phu-kien', 350000, null, '#6B7255', '傘', 4.6, 120, ['dù', 'lễ hội', 'chụp ảnh']],
  ['gang-tay', 'Găng tay len', 'phu-kien', 180000, null, '#7B5D51', '手袋', 4.8, 167, ['găng tay', 'len', 'mùa đông']],
  ['vo-tat', 'Vớ tất cổ cao', 'phu-kien', 90000, null, '#F1EEE8', '靴下', 4.8, 120, ['vớ', 'tất', 'học đường']],
  ['kep-no', 'Kẹp nơ tóc', 'phu-kien', 120000, null, '#A33A2F', '髪飾り', 4.6, 203, ['kẹp tóc', 'nơ', 'dễ thương']],
  ['chup-tai', 'Chụp tai nữ', 'phu-kien', 250000, null, '#D7B9B2', '小物', 4.7, 88, ['chụp tai', 'nữ', 'mùa đông']],
  ['guoc-geta', 'Guốc gỗ Geta', 'phu-kien', 420000, null, '#7c5a3a', '下駄', 4.8, 203, ['geta', 'guốc gỗ', 'truyền thống']],
  ['kiem-go', 'Kiếm gỗ Nhật bản', 'phu-kien', 320000, null, '#6F4E37', '木刀', 4.7, 96, ['kiếm gỗ', 'đạo cụ', 'cosplay']],
  ['furina', 'Trang phục hóa thân Furina', 'cosplay', 980000, null, '#4FA3D1', 'コス', 4.9, 145, ['hóa thân', 'sự kiện', 'xanh']],
  ['yae-miko', 'Trang phục hóa thân Yae Miko', 'cosplay', 1050000, 1250000, '#C0483B', 'コス', 4.8, 145, ['hóa thân', 'sự kiện', 'hồng']],
  ['yumeko', 'Trang phục hóa thân Yumeko Jabami', 'cosplay', 990000, null, '#8A2F26', 'コス', 4.7, 203, ['hóa thân', 'đỏ', 'học đường']],
  ['naruto', 'Trang phục hóa thân Naruto', 'cosplay', 850000, null, '#D97706', 'コス', 4.9, 203, ['hóa thân', 'hoạt hình Nhật', 'cam']],
];

function skuPrefix(slug) {
  return slug.replace(/[^a-z0-9]/gi, '').slice(0, 7).toUpperCase();
}

function productImages(slug) {
  let files = [];
  try {
    files = fs.readdirSync(PRODUCT_ASSET_DIR)
      .filter((name) => name.startsWith(`${slug}_`) && /\.(?:jpe?g|png|webp)$/i.test(name))
      .filter((name) => !/_tryon-(?:flat|candidate)\.(?:jpe?g|png|webp)$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {}
  if (!files.length) files = [`${slug}_1.jpg`];
  return files.map((name) => `/assets/products/${name}`);
}

function makeVariants(slug, productIndex) {
  const colors = [
    ['Sumi', '#1A1410'],
    ['Shu', '#A33A2F'],
    ['Aizome', '#243244'],
  ].slice(0, 2 + (productIndex % 2));
  const prefix = skuPrefix(slug);
  const variants = [];
  colors.forEach((color, colorIndex) => {
    SIZES.slice(0, 3 + ((productIndex + colorIndex) % 2)).forEach((size, sizeIndex) => {
      variants.push({
        colorName: color[0],
        colorHex: color[1],
        size,
        sku: `${prefix}-${color[0].slice(0, 2).toUpperCase()}-${size}`,
        stock: slug === 'balo-vai' ? 0 : (productIndex * 11 + colorIndex * 7 + sizeIndex * 5) % 41,
      });
    });
  });
  return variants;
}

function emptyState() {
  return {
    seeded: false,
    schemaVersion: 5,
    shop: { name: 'JAPANO Store', hotline: '1900 6868', email: 'shop@japano.vn', address: '123 Lê Lợi, P. Bến Nghé, HCM', shipFee: 30000, cod: true, stripe: true, vnpay: true, logo: null },
    integrations: { mongo: false, cloudinary: false, ai: false },
    categories: JSON.parse(JSON.stringify(CATS)),
    products: [],
    orders: [],
    payments: [],
    returnRequests: [],
    carts: [],
    reviews: [],
    reviewReactions: [],
    moderationSamples: [],
    users: [],
    addresses: [],
    wishlists: [],
    notifications: [],
    vouchers: [],
    flagcards: JSON.parse(JSON.stringify(FLAGCARDS)),
    flagcardCollections: [],
    vipMemberships: [],
    flagcardConfig: { ...DEFAULT_FLAGCARD_CONFIG },
    voucherRedemptions: [],
    banners: [],
    interactions: [],
    searchLogs: [],
    pushTokens: [],
    profiles: [],
    chats: [],
    tryonHistory: [],
    goals: [],
    aiDescriptions: [],
    japanSpotReviews: [],
    japanSpotSuggestions: [],
  };
}

// Sản phẩm cosplay/anime mới — CHƯA có ảnh sản phẩm thật nên nằm ở trạng thái
// draft (ẩn khỏi shop, xem catalog.js) cho tới khi admin tải ảnh thật lên qua
// trang quản trị. Không tự chế ảnh giả — xem quy ước "ảnh phải là ảnh thật,
// không dùng ô màu thay thế" đã ghi ở đầu server.js.
const DRAFT_COSPLAY_PRODUCTS = [
  { slug: 'doraemon', name: 'Trang phục hóa thân Doraemon', price: 890000, colorHex: '#2E86DE', tags: ['hóa thân', 'hoạt hình Nhật', 'xanh dương'] },
  { slug: 'son-goku', name: 'Trang phục hóa thân Songoku', price: 950000, colorHex: '#F58220', tags: ['hóa thân', 'hoạt hình Nhật', 'cam'] },
  { slug: 'luffy', name: 'Trang phục hóa thân Luffy', price: 890000, colorHex: '#B91C1C', tags: ['hóa thân', 'hoạt hình Nhật', 'đỏ'] },
];

function draftVariants(slug) {
  const prefix = skuPrefix(slug);
  return SIZES.slice(0, 4).map((size) => ({ colorName: 'Mặc định', colorHex: '#1A1410', size, sku: `${prefix}-${size}`, stock: 0 }));
}

function seededState() {
  const state = emptyState();
  const now = Date.now();

  state.products = PRODUCT_BASE.map((base, index) => {
    const [slug, name, cat, price, old, colorHex, kanji, rating, sold, tags] = base;
    const images = productImages(slug);
    return {
      id: `p${index + 1}`,
      slug,
      name,
      kanji,
      sku: skuPrefix(slug),
      cat,
      category: cat,
      brand: 'JAPANO',
      price,
      old,
      sale: old ? Math.round((1 - price / old) * 100) : null,
      discountPercent: old ? Math.round((1 - price / old) * 100) : 0,
      status: 'published',
      colorHex,
      rating,
      sold,
      tags,
      visualTags: tags,
      desc: `Sản phẩm ${name} theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.`,
      story: `Thiết kế ${name} đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.`,
      image: images[0],
      images,
      videos: [],
      variants: makeVariants(slug, index),
      createdAt: now - (index + 3) * 86400000,
    };
  });

  const roles = ['admin', 'staff', 'staff', 'customer', 'customer', 'customer', 'customer', 'customer', 'customer', 'customer'];
  state.users = NAMES.map((name, index) => ({
    id: `u${index + 1}`,
    name,
    email: `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '.')}@japano.vn`,
    role: roles[index],
    status: index === 6 ? 'locked' : 'active',
    orders: 0,
    spent: 0,
    tryons: index % 5,
    vip: index > 6 ? 'VIP' : index > 2 ? 'Thành viên' : 'Mới',
    joinedAt: now - (index + 1) * 27 * 86400000,
  }));

  const orderStatuses = ['completed', 'completed', 'shipping', 'confirmed', 'completed', 'cancelled'];
  state.orders = Array.from({ length: 36 }, (_, index) => {
    const product = state.products[(index * 5 + 2) % state.products.length];
    const second = state.products[(index * 7 + 9) % state.products.length];
    const user = state.users[index % state.users.length];
    const status = orderStatuses[index % orderStatuses.length];
    const createdAt = now - (index * 8 + 2) * 86400000 - (index % 12) * 3600000;
    const qty = 1 + (index % 2);
    const items = [
      { productId: product.slug, slug: product.slug, name: product.name, colorName: 'Sumi', colorHex: product.colorHex, size: SIZES[index % SIZES.length], qty, price: product.price },
      ...(index % 3 === 0 ? [{ productId: second.slug, slug: second.slug, name: second.name, colorName: 'Aizome', colorHex: second.colorHex, size: SIZES[(index + 1) % SIZES.length], qty: 1, price: second.price }] : []),
    ];
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0) + state.shop.shipFee;
    const paymentMethod = index % 2 ? 'COD' : 'Stripe';
    const paid = status === 'completed' || (paymentMethod === 'Stripe' && status !== 'cancelled');
    const history = status === 'cancelled'
      ? [{ s: 'pending', at: createdAt }, { s: 'cancelled', at: createdAt + 3600000 }]
      : ['pending', 'confirmed', 'shipping', 'completed']
        .slice(0, Math.max(1, ['pending', 'confirmed', 'shipping', 'completed'].indexOf(status) + 1))
        .map((step, stepIndex) => ({ s: step, at: createdAt + stepIndex * 8 * 3600000 }));
    return {
      id: `o${index + 1}`,
      code: `JP${240700 + index}`,
      userId: user.id,
      customer: { id: user.id, name: user.name, phone: `09${String(10000000 + index * 7919).slice(-8)}` },
      address: ADDR[index % ADDR.length],
      items,
      total,
      ship: state.shop.shipFee,
      payment: { method: paymentMethod, status: paid ? 'paid' : 'unpaid', txn: paymentMethod === 'Stripe' ? `pi_seed_${String(index + 1).padStart(4, '0')}` : '—' },
      status,
      createdAt,
      history,
      source: 'demo',
    };
  });

  state.payments = state.orders
    .filter((order) => order.payment.method === 'Stripe')
    .map((order, index) => ({
      id: `pay-seed-${index + 1}`,
      code: `PAY-SEED-${String(index + 1).padStart(4, '0')}`,
      orderId: order.id,
      orderCode: order.code,
      userId: order.userId,
      provider: 'stripe-seed',
      method: 'Stripe',
      status: order.payment.status,
      amount: order.total,
      currency: 'vnd',
      transactionCode: order.payment.txn,
      paymentIntentId: order.payment.txn,
      checkoutSessionId: '',
      refundable: false,
      refunds: [],
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    }));

  state.users = state.users.map((user) => {
    const orders = state.orders.filter((order) => order.userId === user.id && order.status !== 'cancelled');
    return { ...user, orders: orders.length, spent: orders.filter((order) => order.payment.status === 'paid' || order.status === 'completed').reduce((sum, order) => sum + order.total, 0) };
  });

  const interactionTypes = ['view', 'view', 'wishlist', 'cart', 'purchase', 'tryon'];
  state.interactions = Array.from({ length: 120 }, (_, index) => {
    const user = state.users[index % state.users.length];
    const product = state.products[(index * 7 + (index % 5)) % state.products.length];
    const type = interactionTypes[index % interactionTypes.length];
    return { id: `i${index + 1}`, userId: user.id, productId: product.slug, type, value: type === 'purchase' ? 5 : undefined, createdAt: now - index * 5 * 3600000, source: 'demo' };
  });

  state.profiles = state.users.slice(0, 6).map((user, index) => ({
    userId: user.id,
    gender: index % 2 ? 'Nữ' : 'Unisex',
    preferredStyles: index % 3 === 0 ? ['Nhật cổ', 'Thanh lịch'] : index % 3 === 1 ? ['Tối giản', 'Công sở'] : ['Streetwear'],
    skinTone: index % 2 ? 'Sáng' : 'Trung bình',
    occasion: index % 2 ? 'Đi chơi' : 'Đi học/đi làm',
    budget: 700000 + index * 250000,
    heightCm: 156 + index * 3,
    weightKg: 48 + index * 4,
    usualSize: SIZES[index % SIZES.length],
    updatedAt: now - index * 86400000,
  }));

  state.notifications = [
    { id: 'n0', title: '🚩 Sưu tầm 7 Flagcard — nhận ngay voucher 50%!', body: 'Mỗi đơn hàng đủ điều kiện tặng 1 thẻ địa danh Nhật Bản. Đủ bộ 7 thẻ, giảm ngay 50% mọi sản phẩm. Chạm để xem trước bộ thẻ.', type: 'Khuyến mãi', action: 'flagcard-intro', reach: state.users.length, at: now - 30 * 60000 },
    { id: 'n1', title: 'Ưu đãi Thu — giảm 20% Haori', body: 'Cách tân tủ đồ mùa lá đỏ, dùng mã THU20', type: 'Khuyến mãi', reach: state.users.length, at: now - 2 * 3600000 },
    { id: 'n2', title: 'Bảo trì hệ thống 02:00–03:00', body: 'App có thể gián đoạn ngắn để nâng cấp.', type: 'Hệ thống', reach: state.users.length, at: now - 2 * 86400000 },
  ];
  state.vouchers = [
    { code: 'THU20', type: 'percent', value: 20, min: 500000, expiry: '2027-12-31', limit: 500, used: 132, active: true },
    { code: 'FREESHIP', type: 'amount', value: 30000, min: 0, expiry: '2027-11-30', limit: 1000, used: 410, active: true },
    { code: 'VIP100', type: 'amount', value: 100000, min: 1500000, expiry: '2027-12-15', limit: 200, used: 57, active: false },
  ];
  state.banners = [
    { id: 'b1', title: 'BST Thu — Momiji', img: '#8A2F26', link: '/category/ao-truyen-thong', active: true, order: 1 },
    { id: 'b2', title: 'Cách tân Nhật Bản', img: '#243244', link: '/culture', active: true, order: 2 },
    { id: 'b3', title: 'Cosplay Fest', img: '#6D28D9', link: '/category/cosplay', active: false, order: 3 },
  ];

  // Thêm SAU khi đơn/tương tác demo đã được sinh ở trên — các đoạn đó chọn sản
  // phẩm demo theo index modulo state.products.length lúc đó (23 sản phẩm gốc),
  // nên push muộn để không làm lệch dữ liệu demo (đơn mua kèm, xu hướng...).
  state.products.push(...DRAFT_COSPLAY_PRODUCTS.map((draft, index) => ({
    id: `p-draft-${index + 1}`,
    slug: draft.slug,
    name: draft.name,
    kanji: 'コス',
    sku: skuPrefix(draft.slug),
    cat: 'cosplay',
    category: 'cosplay',
    brand: 'JAPANO',
    price: draft.price,
    old: null,
    sale: null,
    discountPercent: 0,
    status: 'draft',
    colorHex: draft.colorHex,
    rating: 0,
    sold: 0,
    tags: draft.tags,
    visualTags: draft.tags,
    desc: `Trang phục hóa thân ${draft.name.replace('Trang phục hóa thân ', '')} — đang chờ ảnh sản phẩm thật, admin cần tải ảnh lên trước khi xuất bản.`,
    story: '',
    image: '',
    images: [],
    videos: [],
    variants: draftVariants(draft.slug),
    createdAt: now,
  })));

  state.seeded = true;
  return state;
}

module.exports = { CATS, PRODUCT_BASE, emptyState, seededState };
