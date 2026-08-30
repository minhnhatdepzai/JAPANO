const test = require('node:test');
const assert = require('node:assert/strict');

const {
  serializeState, loadStateFromCollections, NORMALIZED_COLLECTIONS,
} = require('../lib/mongoCollections');
const { reconcileVipState } = require('../lib/vip');

// Giả lập một database từ đúng những gì serializeState sinh ra. Không chạm Atlas.
function fakeDb(collections, extra = {}) {
  return {
    collection: (name) => ({
      find: () => ({ toArray: async () => extra[name] || collections.get(name) || [] }),
    }),
  };
}

function sampleState() {
  return {
    products: [{
      id: 'p1', slug: 'kimono-hong', name: 'Kimono hồng', categoryId: 'ao-truyen-thong',
      price: 500000, desc: 'Mô tả thật', story: 'Câu chuyện', tags: ['nhat-ban'],
      images: ['https://res.cloudinary.com/x/a.jpg'],
      variants: [{ sku: 'K-M', size: 'M', colorName: 'Hồng', stock: 3, price: 500000 }],
    }],
    categories: [{ id: 'ao-truyen-thong', name: 'Áo truyền thống' }],
    banners: [
      { id: 'b1', title: 'Khuyến mãi thu', img: '#8A2F26', link: '/', active: true, order: 1 },
      { id: 'b2', title: 'Hàng mới về', img: '#243244', link: '/new', active: false, order: 2 },
    ],
    discountRules: [
      { id: 'discount-vip-10', code: 'VIP10', scope: 'vip', percent: 10, active: true },
      { id: 'discount-tet', code: 'TET', scope: 'campaign', percent: 15, active: false },
    ],
    aiDescriptions: [{ productId: 'kimono-hong', headline: 'Cache AI', confidence: 0.8 }],
    japanSpots: [{
      id: 'jspot-kyoto-arashiyama', place: 'Rừng tre Arashiyama', prefecture: 'Kyoto',
      region: 'Kansai', productId: 'p1', photoUrl: 'https://example.test/arashiyama.jpg',
      bestTime: '07:00–09:00', sourceUrl: 'https://kyoto.travel/', active: true,
    }],
    vipMemberships: [{ id: 'vip-1', userId: 'u1', discountRuleId: 'discount-vip-10' }],
    users: [], orders: [], payments: [], vouchers: [], voucherRedemptions: [],
  };
}

test('schema mới: banner và quy tắc giảm giá sống sót qua vòng ghi–đọc', async () => {
  const state = sampleState();
  const collections = serializeState(state);
  const back = await loadStateFromCollections(fakeDb(collections));

  assert.equal(back.banners.length, 2, 'banner bị rơi khi ghi xuống Mongo');
  assert.equal(back.banners[0].title, 'Khuyến mãi thu');
  assert.equal(back.banners[1].active, false, 'cờ active của banner phải giữ nguyên');
  assert.equal(back.discountRules.length, 2, 'quy tắc giảm giá bị rơi');
  assert.equal(back.discountRules.find((r) => r.code === 'TET').percent, 15);
});

test('banner và quy tắc giảm giá KHÔNG còn là collection riêng', () => {
  const collections = serializeState(sampleState());
  assert.equal(collections.has('banners'), false);
  assert.equal(collections.has('discount_rules'), false);
  assert.equal(NORMALIZED_COLLECTIONS.includes('banners'), false);
  assert.equal(NORMALIZED_COLLECTIONS.includes('discount_rules'), false);

  const ids = (collections.get('settings') || []).map((row) => row._id);
  assert.ok(ids.includes('banners'), 'settings phải mang document banners');
  assert.ok(ids.includes('discount_rules'), 'settings phải mang document discount_rules');
});

// Đây là bài quan trọng nhất của file. Trước khi sửa, serializeState bỏ hẳn
// banners/discountRules mà không nhúng vào đâu: 3 banner do Admin tạo biến mất
// sau đúng một lần ghi, và /api/banners trả rỗng.
test('không bao giờ được ghi một state mà đọc lại thì mất dữ liệu người vận hành nhập', async () => {
  const state = sampleState();
  const back = await loadStateFromCollections(fakeDb(serializeState(state)));
  for (const key of ['banners', 'discountRules', 'products', 'categories', 'japanSpots']) {
    assert.equal(back[key].length, state[key].length,
      `${key}: ${state[key].length} → ${back[key].length} sau một vòng ghi–đọc`);
  }
});

test('dual-read: database chưa migrate vẫn đọc được từ collection cũ', async () => {
  const collections = serializeState({ ...sampleState(), banners: [], discountRules: [] });
  // Mô phỏng Atlas cũ: settings CHƯA có document banners/discount_rules,
  // nhưng hai collection cũ vẫn còn dữ liệu.
  const settingsWithoutNewDocs = (collections.get('settings') || [])
    .filter((row) => row._id !== 'banners' && row._id !== 'discount_rules');
  const back = await loadStateFromCollections(fakeDb(collections, {
    settings: settingsWithoutNewDocs,
    banners: [{ _id: 'b-old', id: 'b-old', title: 'Banner cũ', active: true }],
    discount_rules: [{ _id: 'd-old', id: 'd-old', code: 'OLD', scope: 'vip', percent: 5 }],
  }));

  assert.equal(back.banners.length, 1, 'không đọc được banner từ schema cũ');
  assert.equal(back.banners[0].title, 'Banner cũ');
  assert.equal(back.banners[0]._id, undefined, '_id của Mongo không được lọt vào state runtime');
  assert.equal(back.discountRules[0].code, 'OLD');
});

// Ranh giới tinh vi: "Admin đã xoá hết banner" và "database chưa migrate" đều
// cho ra mảng rỗng. Nếu phân biệt bằng độ dài, banner vừa bị xoá sẽ sống lại.
test('mảng rỗng cố ý khác với chưa migrate', async () => {
  const collections = serializeState({ ...sampleState(), banners: [] });
  const back = await loadStateFromCollections(fakeDb(collections, {
    banners: [{ _id: 'b-zombie', id: 'b-zombie', title: 'Banner đã xoá' }],
  }));
  assert.equal(back.banners.length, 0,
    'settings đã nói banner rỗng — không được hồi sinh banner từ collection cũ');
});

test('cache AI và VIP suy ra không được ghi xuống Mongo', async () => {
  const collections = serializeState(sampleState());
  assert.equal(collections.has('ai_descriptions'), false, 'cache AI không được thành collection');
  assert.equal(collections.has('vip_memberships'), false, 'VIP là dữ liệu suy ra, không persist');

  const back = await loadStateFromCollections(fakeDb(collections));
  assert.deepEqual(back.aiDescriptions, [], 'cache AI phải khởi động lại từ rỗng');
  // VIP phải được TÍNH LẠI từ đơn hàng chứ không đọc từ database.
  const reconciled = reconcileVipState({ ...back, orders: [], users: [] });
  assert.ok(Array.isArray(reconciled.vipMemberships), 'reconcileVipState phải dựng lại vipMemberships');
});

test('product_details đã gộp vào products mà không rơi mô tả hay ảnh', async () => {
  const collections = serializeState(sampleState());
  assert.equal(collections.has('product_details'), false);
  const back = await loadStateFromCollections(fakeDb(collections));
  const product = back.products[0];
  assert.equal(product.desc, 'Mô tả thật');
  assert.equal(product.story, 'Câu chuyện');
  assert.deepEqual(product.tags, ['nhat-ban']);
  assert.equal(product.images.length, 1);
  assert.equal(product.variants.length, 1);
});
