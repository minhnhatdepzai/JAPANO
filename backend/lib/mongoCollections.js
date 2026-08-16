// Ánh xạ giữa state mà các route hiện dùng và các collection MongoDB chuẩn hoá.
// MongoDB là nguồn dữ liệu thật; state chỉ là mô hình đã JOIN trong bộ nhớ để
// giữ API mobile/admin tương thích trong lúc dữ liệu vật lý được tách đúng thực thể.
const { emptyState } = require('../seed');

const SCHEMA_VERSION = 6;

const DIRECT_COLLECTIONS = Object.freeze({
  categories: 'categories',
  users: 'users',
  addresses: 'addresses',
  carts: 'cart_items',
  wishlists: 'wishlist_items',
  payments: 'payments',
  returnRequests: 'return_requests',
  reviews: 'reviews',
  reviewReactions: 'review_reactions',
  moderationSamples: 'moderation_samples',
  notifications: 'notifications',
  discountRules: 'discount_rules',
  vouchers: 'vouchers',
  flagcards: 'flagcards',
  flagcardCollections: 'flagcard_collections',
  vipMemberships: 'vip_memberships',
  voucherRedemptions: 'voucher_redemptions',
  banners: 'banners',
  interactions: 'interactions',
  searchLogs: 'search_logs',
  pushTokens: 'push_tokens',
  profiles: 'profiles',
  chats: 'chats',
  tryonHistory: 'tryon_history',
  goals: 'goals',
  aiDescriptions: 'ai_descriptions',
  japanSpotReviews: 'japan_spot_reviews',
  japanSpotSuggestions: 'japan_spot_suggestions',
});

const NORMALIZED_COLLECTIONS = Object.freeze([
  'settings',
  'categories',
  'products',
  'product_details',
  'product_variants',
  'product_media',
  'users',
  'addresses',
  'cart_items',
  'wishlist_items',
  'orders',
  'order_items',
  'payments',
  'return_requests',
  'discount_rules',
  'vouchers',
  'voucher_redemptions',
  'reviews',
  'review_reactions',
  'moderation_samples',
  'notifications',
  'flagcards',
  'flagcard_collections',
  'vip_memberships',
  'banners',
  'interactions',
  'search_logs',
  'push_tokens',
  'profiles',
  'chats',
  'tryon_history',
  'goals',
  'ai_descriptions',
  'japan_spot_reviews',
  'japan_spot_suggestions',
]);

const LEGACY_COLLECTIONS = Object.freeze([
  'app_state',
  '_runtime_metadata',
  'carts',
  'wishlists',
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function withoutMongoId(document) {
  if (!document || typeof document !== 'object') return document;
  const { _id, ...rest } = document;
  return rest;
}

function safePart(value) {
  return encodeURIComponent(String(value ?? '').trim() || 'unknown');
}

function rowId(row, key, index) {
  if (row && typeof row === 'object') {
    return String(row.id || row.token || row.code || row.slug || row.userId || `${key}-${index}`);
  }
  return `${key}-${index}`;
}

function normalizeState(input) {
  const defaults = emptyState();
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const normalized = { ...defaults, ...source };
  normalized.shop = { ...defaults.shop, ...(source.shop || {}) };
  normalized.integrations = { ...defaults.integrations, ...(source.integrations || {}) };
  normalized.flagcardConfig = { ...defaults.flagcardConfig, ...(source.flagcardConfig || {}) };
  for (const key of Object.keys(DIRECT_COLLECTIONS)) {
    normalized[key] = Array.isArray(source[key]) ? source[key] : [];
  }
  normalized.products = Array.isArray(source.products) ? source.products : [];
  normalized.orders = Array.isArray(source.orders) ? source.orders : [];
  if (!normalized.discountRules.length) normalized.discountRules = clone(defaults.discountRules);
  normalized.schemaVersion = SCHEMA_VERSION;
  normalized.seeded = Boolean(source.seeded || normalized.products.length);
  return normalized;
}

function productMaps(products) {
  const byAny = new Map();
  const byId = new Map();
  for (const product of products || []) {
    const id = String(product.id || product._id || product.slug || '').trim();
    if (!id) continue;
    const normalized = { ...product, id };
    byId.set(id, normalized);
    byAny.set(id, normalized);
    if (product.slug) byAny.set(String(product.slug), normalized);
  }
  return { byAny, byId };
}

function canonicalProductId(value, maps) {
  const raw = String(value || '').trim();
  return maps.byAny.get(raw)?.id || raw;
}

function runtimeProductSlug(value, maps) {
  const raw = String(value || '').trim();
  return maps.byAny.get(raw)?.slug || raw;
}

function serializeProducts(products) {
  const core = [];
  const details = [];
  const variants = [];
  const media = [];

  for (const [productIndex, raw] of (products || []).entries()) {
    const product = clone(raw) || {};
    const id = String(product.id || product.slug || `product-${productIndex}`);
    const categoryId = String(product.categoryId || product.cat || product.category || '');
    const {
      _id, cat, category, desc, description, story, colorHex, tags, visualTags,
      rating, sold, variants: productVariants, images, videos, image,
      sale, discountPercent, old, compareAtPrice, ...coreFields
    } = product;
    core.push({
      _id: id,
      ...coreFields,
      id,
      categoryId,
      compareAtPrice: Number(compareAtPrice ?? old) > Number(product.price || 0)
        ? Number(compareAtPrice ?? old)
        : null,
    });
    details.push({
      _id: id,
      productId: id,
      description: String(description ?? desc ?? ''),
      story: String(story || ''),
      colorHex: String(colorHex || ''),
      tags: Array.isArray(tags) ? tags : [],
      visualTags: Array.isArray(visualTags) ? visualTags : [],
      rating: Number(rating || 0),
      sold: Number(sold || 0),
    });

    for (const [index, rawVariant] of (Array.isArray(productVariants) ? productVariants : []).entries()) {
      const variant = clone(rawVariant) || {};
      const variantId = String(variant.id || `variant-${safePart(id)}-${safePart(variant.sku || index)}`);
      variants.push({ _id: variantId, ...variant, id: variantId, productId: id, position: index });
    }

    const addMedia = (rawMedia, type, index, primary = false) => {
      const value = typeof rawMedia === 'string' ? { url: rawMedia } : clone(rawMedia) || {};
      const url = String(value.url || '');
      if (!url) return;
      const mediaId = String(value.id || `media-${id}-${type}-${index}`);
      media.push({ _id: mediaId, ...value, id: mediaId, productId: id, type, url, position: index, isPrimary: Boolean(primary) });
    };
    (Array.isArray(images) ? images : []).forEach((value, index) => addMedia(value, 'image', index, index === 0));
    (Array.isArray(videos) ? videos : []).forEach((value, index) => addMedia(value, 'video', index, false));
  }
  return { core, details, variants, media };
}

function hydrateProducts(coreDocs, detailDocs, variantDocs, mediaDocs) {
  const details = new Map((detailDocs || []).map((row) => [String(row.productId), withoutMongoId(row)]));
  const variants = new Map();
  const media = new Map();
  for (const row of variantDocs || []) {
    const key = String(row.productId);
    if (!variants.has(key)) variants.set(key, []);
    const { productId, position, ...value } = withoutMongoId(row);
    variants.get(key).push({ position: Number(position || 0), value });
  }
  for (const row of mediaDocs || []) {
    const key = String(row.productId);
    if (!media.has(key)) media.set(key, []);
    media.get(key).push(withoutMongoId(row));
  }

  return (coreDocs || []).map((raw) => {
    const core = withoutMongoId(raw);
    const id = String(core.id || raw._id);
    const detail = details.get(id) || {};
    const variantList = (variants.get(id) || []).sort((a, b) => a.position - b.position).map(({ value }) => {
      const { id: variantId, ...rest } = value;
      return variantId && !rest.sku ? { ...rest, id: variantId } : rest;
    });
    const productMedia = (media.get(id) || []).sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
    const images = productMedia.filter((item) => item.type === 'image').map((item) => item.url);
    const videos = productMedia.filter((item) => item.type === 'video').map((item) => {
      const { id: mediaId, productId, type, position, isPrimary, ...value } = item;
      return Object.keys(value).length === 1 && value.url ? value.url : value;
    });
    const price = Math.max(0, Number(core.price || 0));
    const old = Number(core.compareAtPrice || 0) > price ? Number(core.compareAtPrice) : null;
    const { categoryId, compareAtPrice: _compareAtPrice, ...base } = core;
    return {
      ...base,
      id,
      cat: categoryId || '',
      category: categoryId || '',
      old,
      sale: null,
      discountPercent: old ? Math.round((1 - price / old) * 100) : 0,
      desc: String(detail.description || ''),
      story: String(detail.story || ''),
      colorHex: String(detail.colorHex || ''),
      tags: Array.isArray(detail.tags) ? detail.tags : [],
      visualTags: Array.isArray(detail.visualTags) ? detail.visualTags : [],
      rating: Number(detail.rating || 0),
      sold: Number(detail.sold || 0),
      variants: variantList,
      images,
      image: images[0] || '',
      videos,
    };
  });
}

function serializeDirectRow(key, raw, index, maps, vouchersByCode) {
  const row = clone(raw) || {};
  delete row._id;
  if (key === 'users') {
    delete row.orders;
    delete row.spent;
    delete row.vip;
    delete row.vipMembership;
  }
  if (key === 'carts') {
    row.id ||= `cart-${safePart(row.userId)}-${safePart(row.productId)}-${safePart(row.color)}-${safePart(row.size)}`;
    row.productId = canonicalProductId(row.productId, maps);
  }
  if (key === 'wishlists') {
    row.id ||= `wish-${safePart(row.userId)}-${safePart(row.productSlug || row.productId)}`;
    row.productId = canonicalProductId(row.productId || row.productSlug, maps);
    delete row.productSlug;
  }
  if (['reviews', 'interactions', 'tryonHistory', 'goals', 'aiDescriptions'].includes(key) && row.productId) {
    row.productId = canonicalProductId(row.productId, maps);
  }
  if (key === 'chats' && Array.isArray(row.productIds)) {
    row.productIds = row.productIds.map((value) => canonicalProductId(value, maps));
  }
  // tryon_history.productId đã được chuẩn hoá sang products.id ở khối trên, nhưng
  // hai mảng bên cạnh thì chưa — nên cùng một document có productId='p7' (id) mà
  // productIds=['cardigan-dai'] (slug). Cùng một bảng mà hai kiểu tham chiếu thì
  // mọi phép nối bảng đều phải đoán, và ERD không vẽ đúng được.
  if (key === 'tryonHistory') {
    for (const field of ['productIds', 'accessoryIds']) {
      if (Array.isArray(row[field])) row[field] = row[field].map((value) => canonicalProductId(value, maps));
    }
  }
  if (key === 'flagcards' && Array.isArray(row.recommendedProductIds)) {
    row.recommendedProductIds = row.recommendedProductIds.map((value) => canonicalProductId(value, maps));
  }
  if (key === 'vouchers') row.id ||= `voucher-${safePart(row.code)}`;
  if (key === 'discountRules') row.id ||= `discount-${safePart(row.code)}`;
  if (key === 'vipMemberships') {
    row.discountRuleId ||= 'discount-vip-10';
    delete row.threshold;
    delete row.discountPercent;
    delete row.discountedUnitsPerOrder;
  }
  if (key === 'voucherRedemptions') {
    const voucher = vouchersByCode.get(String(row.code || '').toUpperCase());
    row.voucherId = String(row.voucherId || voucher?.id || '');
  }
  if (key === 'returnRequests' && Array.isArray(row.items)) {
    row.items = row.items.map((item) => ({ ...item, productId: canonicalProductId(item.productId || item.slug, maps) }));
  }
  const id = rowId(row, key, index);
  row.id ||= id;
  return { _id: id, ...row };
}

function serializeOrders(state, maps, payments) {
  const orders = [];
  const items = [];
  const paymentByOrder = new Map();
  for (const payment of payments) {
    if (!payment.orderId) continue;
    const key = String(payment.orderId);
    if (!paymentByOrder.has(key)) paymentByOrder.set(key, payment);
  }

  for (const [orderIndex, raw] of (state.orders || []).entries()) {
    const order = clone(raw) || {};
    const id = String(order.id || `order-${orderIndex}`);
    const orderPayment = order.payment && typeof order.payment === 'object' ? order.payment : {};
    let payment = paymentByOrder.get(id);
    if (!payment) {
      const paymentId = `payment-${id}`;
      payment = {
        _id: paymentId,
        id: paymentId,
        code: `PAY-${order.code || id}`,
        orderId: id,
        orderCode: order.code || '',
        userId: order.userId || order.customer?.id || '',
        provider: String(orderPayment.provider || orderPayment.method || 'cod').toLowerCase(),
        method: String(orderPayment.method || 'COD'),
        status: String(orderPayment.status || 'unpaid'),
        amount: Number(order.total || 0),
        currency: String(orderPayment.currency || 'VND'),
        transactionCode: String(orderPayment.txn || ''),
        refundable: false,
        refunds: [],
        createdAt: Number(order.createdAt || Date.now()),
        updatedAt: Number(order.updatedAt || order.createdAt || Date.now()),
      };
      payments.push(payment);
      paymentByOrder.set(id, payment);
    } else {
      payment.method = orderPayment.method || payment.method;
      payment.provider = orderPayment.provider || payment.provider;
      payment.status = orderPayment.status || payment.status;
      payment.currency = orderPayment.currency || payment.currency;
      payment.transactionCode = orderPayment.txn && orderPayment.txn !== '—' ? orderPayment.txn : payment.transactionCode;
      payment.paidAt = orderPayment.paidAt || payment.paidAt;
    }

    const {
      _id, payment: _payment, items: orderItems, returnRequest,
      voucherRedemption, ...core
    } = order;
    const voucher = (state.vouchers || []).find((item) => String(item.code || '').toUpperCase() === String(order.discountCode || '').toUpperCase());
    orders.push({ _id: id, ...core, id, voucherId: voucher?.id || null });
    for (const [itemIndex, rawItem] of (Array.isArray(orderItems) ? orderItems : []).entries()) {
      const item = clone(rawItem) || {};
      const product = maps.byAny.get(String(item.productId || item.slug || ''));
      const itemId = String(item.id || `order-item-${id}-${itemIndex}`);
      items.push({
        _id: itemId,
        ...item,
        id: itemId,
        orderId: id,
        productId: product?.id || String(item.productId || item.slug || ''),
        productSlug: product?.slug || String(item.slug || ''),
        productName: String(item.productName || item.name || product?.name || 'Sản phẩm'),
        position: itemIndex,
      });
      delete items[items.length - 1].slug;
      delete items[items.length - 1].name;
    }
  }
  return { orders, items, payments };
}

function paymentSummary(payment) {
  if (!payment) return { method: 'COD', provider: 'cod', status: 'unpaid', txn: '—', currency: 'VND' };
  return {
    method: payment.method || String(payment.provider || 'COD').toUpperCase(),
    provider: payment.provider || '',
    status: payment.status || 'unpaid',
    txn: payment.transactionCode || payment.paymentIntentId || payment.vnpTransactionNo || '—',
    currency: payment.currency || 'VND',
    ...(payment.paidAt ? { paidAt: payment.paidAt } : {}),
  };
}

function hydrateOrders(orderDocs, itemDocs, payments, returnRequests, redemptions, maps) {
  const itemsByOrder = new Map();
  for (const raw of itemDocs || []) {
    const item = withoutMongoId(raw);
    const key = String(item.orderId);
    if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
    const slug = runtimeProductSlug(item.productId || item.productSlug, maps);
    const { orderId, productSlug, productName, position, ...rest } = item;
    itemsByOrder.get(key).push({
      position: Number(position || 0),
      value: { ...rest, productId: slug, slug, name: productName || maps.byAny.get(String(item.productId))?.name || 'Sản phẩm' },
    });
  }
  const paymentsByOrder = new Map();
  for (const payment of payments || []) {
    const key = String(payment.orderId || '');
    const current = paymentsByOrder.get(key);
    if (!current || Number(payment.updatedAt || payment.createdAt || 0) >= Number(current.updatedAt || current.createdAt || 0)) {
      paymentsByOrder.set(key, payment);
    }
  }
  const returnsByOrder = new Map();
  for (const request of returnRequests || []) {
    const key = String(request.orderId || '');
    const current = returnsByOrder.get(key);
    if (!current || Number(request.createdAt || 0) >= Number(current.createdAt || 0)) returnsByOrder.set(key, request);
  }
  const redemptionsByOrder = new Map((redemptions || []).map((row) => [String(row.orderId || ''), row]));
  return (orderDocs || []).map((raw) => {
    const order = withoutMongoId(raw);
    const id = String(order.id || raw._id);
    const payment = paymentsByOrder.get(id);
    const request = returnsByOrder.get(id);
    const redemption = redemptionsByOrder.get(id);
    const { paymentId, voucherId, ...core } = order;
    return {
      ...core,
      id,
      items: (itemsByOrder.get(id) || []).sort((a, b) => a.position - b.position).map((entry) => entry.value),
      payment: paymentSummary(payment),
      ...(request ? { returnRequest: { id: request.id, code: request.code, status: request.status, kind: request.kind } } : {}),
      ...(redemption ? { voucherRedemption: clone(redemption) } : {}),
    };
  });
}

function serializeState(stateInput) {
  const state = normalizeState(stateInput);
  const collections = new Map();
  const products = serializeProducts(state.products);
  collections.set('products', products.core);
  collections.set('product_details', products.details);
  collections.set('product_variants', products.variants);
  collections.set('product_media', products.media);
  const maps = productMaps(state.products);

  const vouchers = (state.vouchers || []).map((row, index) => serializeDirectRow('vouchers', row, index, maps, new Map()));
  const vouchersByCode = new Map(vouchers.map((row) => [String(row.code || '').toUpperCase(), row]));

  for (const [key, collection] of Object.entries(DIRECT_COLLECTIONS)) {
    if (key === 'payments' || key === 'vouchers') continue;
    const docs = (state[key] || []).map((row, index) => serializeDirectRow(key, row, index, maps, vouchersByCode));
    collections.set(collection, docs);
  }
  collections.set('vouchers', vouchers);

  const payments = (state.payments || []).map((row, index) => serializeDirectRow('payments', row, index, maps, vouchersByCode));
  const orderData = serializeOrders(state, maps, payments);
  collections.set('orders', orderData.orders);
  collections.set('order_items', orderData.items);
  collections.set('payments', orderData.payments);
  collections.set('settings', [
    { _id: 'shop', ...clone(state.shop) },
    { _id: 'integrations', ...clone(state.integrations) },
    { _id: 'flagcard_config', ...clone(state.flagcardConfig) },
  ]);
  return collections;
}

function hydrateDirectRow(key, raw, maps, vouchersById) {
  const row = withoutMongoId(raw);
  if (key === 'carts' && row.productId) row.productId = runtimeProductSlug(row.productId, maps);
  if (key === 'wishlists') {
    row.productSlug = runtimeProductSlug(row.productId, maps);
    delete row.productId;
  }
  if (['reviews', 'interactions', 'tryonHistory', 'goals', 'aiDescriptions'].includes(key) && row.productId) {
    row.productId = runtimeProductSlug(row.productId, maps);
  }
  if (key === 'chats' && Array.isArray(row.productIds)) {
    row.productIds = row.productIds.map((value) => runtimeProductSlug(value, maps));
  }
  if (key === 'tryonHistory') {
    for (const field of ['productIds', 'accessoryIds']) {
      if (Array.isArray(row[field])) row[field] = row[field].map((value) => runtimeProductSlug(value, maps));
    }
  }
  if (key === 'flagcards' && Array.isArray(row.recommendedProductIds)) {
    row.recommendedProductIds = row.recommendedProductIds.map((value) => runtimeProductSlug(value, maps));
  }
  if (key === 'voucherRedemptions') {
    row.code ||= vouchersById.get(String(row.voucherId || ''))?.code || '';
  }
  if (key === 'vipMemberships') {
    // Các field quyền lợi được JOIN từ discount_rules ở loadStateFromCollections.
    delete row.threshold;
    delete row.discountPercent;
    delete row.discountedUnitsPerOrder;
  }
  if (key === 'returnRequests' && Array.isArray(row.items)) {
    row.items = row.items.map((item) => {
      const slug = runtimeProductSlug(item.productId || item.slug, maps);
      return { ...item, productId: slug, slug };
    });
  }
  return row;
}

async function loadStateFromCollections(db) {
  const reads = new Map();
  await Promise.all(NORMALIZED_COLLECTIONS.map(async (name) => {
    reads.set(name, await db.collection(name).find({}).toArray());
  }));
  const settings = new Map((reads.get('settings') || []).map((row) => [String(row._id), withoutMongoId(row)]));
  const products = hydrateProducts(
    reads.get('products'), reads.get('product_details'), reads.get('product_variants'), reads.get('product_media'),
  );
  const maps = productMaps(products);
  const state = {
    ...emptyState(),
    schemaVersion: SCHEMA_VERSION,
    seeded: products.length > 0,
    shop: { ...emptyState().shop, ...(settings.get('shop') || {}) },
    integrations: { ...emptyState().integrations, ...(settings.get('integrations') || {}) },
    flagcardConfig: { ...emptyState().flagcardConfig, ...(settings.get('flagcard_config') || {}) },
    products,
  };
  for (const [key, collection] of Object.entries(DIRECT_COLLECTIONS)) {
    if (key === 'payments' || key === 'returnRequests' || key === 'voucherRedemptions') continue;
    const rows = (reads.get(collection) || []).map(withoutMongoId);
    state[key] = key === 'discountRules' && !rows.length ? clone(emptyState().discountRules) : rows;
  }
  const vouchersById = new Map((state.vouchers || []).map((row) => [String(row.id), row]));
  for (const key of Object.keys(DIRECT_COLLECTIONS)) {
    if (key === 'payments') continue;
    if (key === 'returnRequests' || key === 'voucherRedemptions') {
      state[key] = (reads.get(DIRECT_COLLECTIONS[key]) || []).map((row) => hydrateDirectRow(key, row, maps, vouchersById));
    } else {
      state[key] = (state[key] || []).map((row) => hydrateDirectRow(key, row, maps, vouchersById));
    }
  }
  state.payments = (reads.get('payments') || []).map(withoutMongoId);
  state.orders = hydrateOrders(
    reads.get('orders'), reads.get('order_items'), state.payments,
    state.returnRequests, state.voucherRedemptions, maps,
  );
  const discountRulesById = new Map((state.discountRules || []).map((row) => [String(row.id), row]));
  state.vipMemberships = (state.vipMemberships || []).map((membership) => {
    const rule = discountRulesById.get(String(membership.discountRuleId || '')) || state.discountRules.find((row) => row.scope === 'vip');
    return {
      ...membership,
      discountRuleId: rule?.id || membership.discountRuleId || '',
      threshold: Number(rule?.qualificationValue || 0),
      discountPercent: Number(rule?.value || 0),
      discountedUnitsPerOrder: Number(rule?.maxUnitsPerOrder || 0),
    };
  });
  return normalizeState(state);
}

function repairLegacyReferences(stateInput) {
  const state = normalizeState(clone(stateInput));
  const usedSlugs = new Set();
  let repairedProducts = 0;
  let duplicateVariants = 0;
  state.products = state.products.map((raw, productIndex) => {
    const product = { ...raw };
    product.id ||= `product-${productIndex + 1}`;
    let slug = String(product.slug || product.name || product.id)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(product.id);
    const baseSlug = slug;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
    usedSlugs.add(slug);
    if (product.slug !== slug) { product.slug = slug; repairedProducts += 1; }
    if (!String(product.sku || '').replace(/-+$/g, '')) {
      product.sku = slug.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
      repairedProducts += 1;
    }
    const uniqueVariants = new Map();
    for (const [variantIndex, rawVariant] of (product.variants || []).entries()) {
      const variant = { ...rawVariant };
      const selection = `${String(variant.colorName || '').toLowerCase()}\u0000${String(variant.size || '').toUpperCase()}`;
      if (uniqueVariants.has(selection)) duplicateVariants += 1;
      const colorCode = String(variant.colorName || 'default').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'DEF';
      variant.sku = `${String(product.sku).replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase()}-${colorCode}-${String(variant.size || variantIndex + 1).toUpperCase()}`;
      uniqueVariants.set(selection, variant); // record sau cùng là chỉnh sửa mới nhất
    }
    product.variants = [...uniqueVariants.values()];
    return product;
  });
  const validUsers = new Set((state.users || []).map((row) => String(row.id)));
  const maps = productMaps(state.products);
  const report = [];
  if (repairedProducts) report.push(`products: chuẩn hoá slug/SKU cho ${repairedProducts} trường`);
  if (duplicateVariants) report.push(`product_variants: gộp ${duplicateVariants} biến thể trùng màu/size`);
  const removeInvalidUsers = ['addresses', 'carts', 'wishlists', 'profiles', 'goals'];
  for (const key of removeInvalidUsers) {
    const before = state[key].length;
    state[key] = state[key].filter((row) => validUsers.has(String(row.userId || '')));
    if (before !== state[key].length) report.push(`${key}: bỏ ${before - state[key].length} record mồ côi`);
  }
  const removeTargetedNotifications = state.notifications.length;
  state.notifications = state.notifications.filter((row) => !row.userId || validUsers.has(String(row.userId)));
  if (removeTargetedNotifications !== state.notifications.length) report.push(`notifications: bỏ ${removeTargetedNotifications - state.notifications.length} record mồ côi`);

  for (const key of ['interactions', 'searchLogs', 'chats', 'tryonHistory', 'japanSpotReviews', 'japanSpotSuggestions']) {
    let cleared = 0;
    state[key] = state[key].map((row) => {
      if (!row.userId || validUsers.has(String(row.userId))) return row;
      cleared += 1;
      const copy = { ...row };
      delete copy.userId;
      return copy;
    });
    if (cleared) report.push(`${key}: chuyển ${cleared} tham chiếu user cũ thành ẩn danh`);
  }
  state.orders = state.orders.map((order) => ({
    ...order,
    items: (order.items || []).filter((item) => maps.byAny.has(String(item.productId || item.slug || ''))),
  }));
  return { state, report };
}

function relationshipErrors(stateInput) {
  const state = normalizeState(stateInput);
  const users = new Set((state.users || []).map((row) => String(row.id)));
  const categories = new Set((state.categories || []).map((row) => String(row.id)));
  const products = productMaps(state.products);
  const orders = new Set((state.orders || []).map((row) => String(row.id)));
  const payments = new Set((state.payments || []).map((row) => String(row.id)));
  const reviews = new Set((state.reviews || []).map((row) => String(row.id)));
  const errors = [];
  const requireRef = (owner, ownerId, field, value, valid, optional = false) => {
    if ((value === undefined || value === null || value === '') && optional) return;
    if (!valid.has(String(value || ''))) errors.push(`${owner}/${ownerId}: ${field}=${value || '(rỗng)'} không tồn tại`);
  };
  for (const row of state.products) requireRef('products', row.id, 'categoryId', row.cat || row.categoryId || row.category, categories);
  for (const order of state.orders) {
    const orderUserId = order.userId || order.customer?.id;
    if (orderUserId && String(orderUserId) !== 'guest') requireRef('orders', order.id, 'userId', orderUserId, users);
    for (const item of order.items || []) {
      if (!products.byAny.has(String(item.productId || item.slug || ''))) errors.push(`order_items/${order.id}: productId không tồn tại`);
    }
  }
  for (const row of state.payments) {
    requireRef('payments', row.id, 'orderId', row.orderId, orders);
    requireRef('payments', row.id, 'userId', row.userId, users, true);
  }
  for (const row of state.returnRequests) {
    requireRef('return_requests', row.id, 'orderId', row.orderId, orders);
    requireRef('return_requests', row.id, 'paymentId', row.paymentId, payments, true);
    requireRef('return_requests', row.id, 'userId', row.userId, users);
  }
  for (const row of state.reviews) {
    if (!products.byAny.has(String(row.productId || ''))) errors.push(`reviews/${row.id}: productId không tồn tại`);
    requireRef('reviews', row.id, 'userId', row.userId, users);
    requireRef('reviews', row.id, 'orderId', row.orderId, orders, true);
  }
  for (const row of state.reviewReactions) {
    requireRef('review_reactions', row.id, 'reviewId', row.reviewId, reviews);
    requireRef('review_reactions', row.id, 'userId', row.userId, users);
  }
  const discountRules = new Set((state.discountRules || []).map((row) => String(row.id)));
  for (const row of state.vipMemberships) {
    requireRef('vip_memberships', row.id, 'userId', row.userId, users);
    requireRef('vip_memberships', row.id, 'discountRuleId', row.discountRuleId || 'discount-vip-10', discountRules);
  }
  for (const key of ['addresses', 'carts', 'wishlists', 'profiles', 'goals']) {
    for (const row of state[key]) requireRef(key, row.id || row.userId, 'userId', row.userId, users);
  }
  return errors;
}

async function replaceCollection(db, name, documents) {
  const collection = db.collection(name);
  const docs = documents.map((row) => clone(row));
  const ids = docs.map((row) => row._id);
  if (docs.length) {
    await collection.bulkWrite(docs.map((document) => ({
      replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true },
    })), { ordered: true });
    await collection.deleteMany({ _id: { $nin: ids } });
  } else {
    await collection.deleteMany({});
  }
}

async function persistStateToCollections(db, state, { only = null } = {}) {
  const errors = relationshipErrors(state);
  if (errors.length) {
    const error = new Error(`Dữ liệu vi phạm liên kết:\n- ${errors.slice(0, 12).join('\n- ')}`);
    error.code = 'INVALID_RELATIONSHIP';
    error.details = errors;
    throw error;
  }
  const serialized = serializeState(state);
  const selected = only ? new Set(only) : null;
  for (const [name, docs] of serialized) {
    if (selected && !selected.has(name)) continue;
    await replaceCollection(db, name, docs);
  }
  return serialized;
}

async function ensureMongoIndexes(db) {
  const definitions = {
    categories: [[{ id: 1 }, { unique: true, name: 'uq_categories_id' }]],
    products: [[{ id: 1 }, { unique: true, name: 'uq_products_id' }], [{ slug: 1 }, { unique: true, name: 'uq_products_slug' }], [{ categoryId: 1 }, { name: 'ix_products_category' }]],
    product_details: [[{ productId: 1 }, { unique: true, name: 'uq_product_details_product' }]],
    product_variants: [[{ id: 1 }, { unique: true, name: 'uq_product_variants_id' }], [{ productId: 1 }, { name: 'ix_product_variants_product' }], [{ sku: 1 }, { unique: true, sparse: true, name: 'uq_product_variants_sku' }], [{ productId: 1, colorName: 1, size: 1 }, { unique: true, name: 'uq_product_variants_selection' }]],
    product_media: [[{ id: 1 }, { unique: true, name: 'uq_product_media_id' }], [{ productId: 1, position: 1 }, { name: 'ix_product_media_product' }]],
    users: [[{ id: 1 }, { unique: true, name: 'uq_users_id' }], [{ email: 1 }, { name: 'ix_users_email' }]],
    addresses: [[{ id: 1 }, { unique: true, name: 'uq_addresses_id' }], [{ userId: 1 }, { name: 'ix_addresses_user' }]],
    cart_items: [[{ id: 1 }, { unique: true, name: 'uq_cart_items_id' }], [{ userId: 1, productId: 1, color: 1, size: 1 }, { unique: true, name: 'uq_cart_items_selection' }]],
    wishlist_items: [[{ id: 1 }, { unique: true, name: 'uq_wishlist_items_id' }], [{ userId: 1, productId: 1 }, { unique: true, name: 'uq_wishlist_items_user_product' }]],
    orders: [[{ id: 1 }, { unique: true, name: 'uq_orders_id' }], [{ code: 1 }, { unique: true, name: 'uq_orders_code' }], [{ userId: 1, createdAt: -1 }, { name: 'ix_orders_user_created' }]],
    order_items: [[{ id: 1 }, { unique: true, name: 'uq_order_items_id' }], [{ orderId: 1 }, { name: 'ix_order_items_order' }], [{ productId: 1 }, { name: 'ix_order_items_product' }]],
    payments: [[{ id: 1 }, { unique: true, name: 'uq_payments_id' }], [{ orderId: 1 }, { name: 'ix_payments_order' }], [{ userId: 1 }, { name: 'ix_payments_user' }]],
    return_requests: [[{ id: 1 }, { unique: true, name: 'uq_return_requests_id' }], [{ orderId: 1 }, { name: 'ix_return_requests_order' }], [{ paymentId: 1 }, { name: 'ix_return_requests_payment' }], [{ userId: 1 }, { name: 'ix_return_requests_user' }]],
    vouchers: [[{ id: 1 }, { unique: true, name: 'uq_vouchers_id' }], [{ code: 1 }, { unique: true, name: 'uq_vouchers_code' }]],
    discount_rules: [[{ id: 1 }, { unique: true, name: 'uq_discount_rules_id' }], [{ code: 1 }, { unique: true, name: 'uq_discount_rules_code' }]],
    voucher_redemptions: [[{ id: 1 }, { unique: true, name: 'uq_voucher_redemptions_id' }], [{ voucherId: 1 }, { name: 'ix_voucher_redemptions_voucher' }], [{ userId: 1 }, { name: 'ix_voucher_redemptions_user' }], [{ orderId: 1 }, { name: 'ix_voucher_redemptions_order' }]],
    reviews: [[{ id: 1 }, { unique: true, name: 'uq_reviews_id' }], [{ productId: 1 }, { name: 'ix_reviews_product' }], [{ userId: 1 }, { name: 'ix_reviews_user' }], [{ orderId: 1 }, { name: 'ix_reviews_order' }]],
    review_reactions: [[{ id: 1 }, { unique: true, name: 'uq_review_reactions_id' }], [{ reviewId: 1, userId: 1 }, { unique: true, name: 'uq_review_reactions_review_user' }]],
    vip_memberships: [[{ id: 1 }, { unique: true, name: 'uq_vip_memberships_id' }], [{ userId: 1, status: 1 }, { name: 'ix_vip_memberships_user_status' }], [{ discountRuleId: 1 }, { name: 'ix_vip_memberships_discount_rule' }]],
    profiles: [[{ userId: 1 }, { unique: true, name: 'uq_profiles_user' }]],
    push_tokens: [[{ token: 1 }, { unique: true, name: 'uq_push_tokens_token' }], [{ userId: 1 }, { name: 'ix_push_tokens_user' }]],
  };
  for (const name of NORMALIZED_COLLECTIONS) {
    // Tạo collection rỗng có chủ đích để Compass phản ánh đúng schema hỗ trợ.
    await db.createCollection(name).catch((error) => {
      if (error?.codeName !== 'NamespaceExists' && error?.code !== 48) throw error;
    });
  }
  for (const [name, indexes] of Object.entries(definitions)) {
    for (const [keys, options] of indexes) {
      await db.collection(name).createIndex(keys, options).catch((error) => {
        // Một database cũ có thể đã có đúng key pattern nhưng dùng tên index
        // tự sinh. Migration chính thức sẽ reset tên; boot thường chỉ cần coi
        // cùng key pattern là đã được bảo vệ.
        if (error?.code !== 85 && error?.code !== 86) throw error;
      });
    }
  }
}

async function resetMongoIndexes(db) {
  for (const name of NORMALIZED_COLLECTIONS) {
    await db.collection(name).dropIndexes().catch((error) => {
      if (error?.codeName !== 'NamespaceNotFound' && error?.code !== 26) throw error;
    });
  }
}

async function dropLegacyCollections(db) {
  for (const name of LEGACY_COLLECTIONS) {
    await db.collection(name).drop().catch((error) => {
      if (error?.codeName !== 'NamespaceNotFound' && error?.code !== 26) throw error;
    });
  }
}

module.exports = {
  SCHEMA_VERSION,
  DIRECT_COLLECTIONS,
  NORMALIZED_COLLECTIONS,
  LEGACY_COLLECTIONS,
  normalizeState,
  serializeState,
  loadStateFromCollections,
  persistStateToCollections,
  ensureMongoIndexes,
  resetMongoIndexes,
  dropLegacyCollections,
  repairLegacyReferences,
  relationshipErrors,
  productMaps,
  // Export để script dựng sản phẩm tự kiểm chứng được vòng serialize→hydrate
  // trước khi ghi dữ liệu, thay vì phát hiện sai schema sau khi sản phẩm đã
  // lên app mà không có ảnh (xem backend/scripts/buildJapanoProducts.js).
  hydrateProducts,
};
