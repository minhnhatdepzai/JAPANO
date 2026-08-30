const test = require('node:test');
const assert = require('node:assert/strict');

const {
  serializeState, hasNormalizedStorage, STORAGE_SCHEMA_ID, LEAN_STORAGE_VERSION,
} = require('../lib/mongoCollections');

// Giả lập tối thiểu phần API Mongo mà hasNormalizedStorage dùng.
function fakeDb({ settings = [], productCount = 0, failSettings = false } = {}) {
  return {
    collection: (name) => ({
      findOne: async (filter) => {
        if (name !== 'settings') return null;
        if (failSettings) throw new Error('không đọc được settings');
        return settings.find((row) => String(row._id) === String(filter._id)) || null;
      },
      estimatedDocumentCount: async () => (name === 'products' ? productCount : 0),
    }),
  };
}

test('serializeState ghi dấu mốc lược đồ vào settings', () => {
  const collections = serializeState({ products: [], orders: [] });
  const marker = (collections.get('settings') || []).find((row) => row._id === STORAGE_SCHEMA_ID);
  assert.ok(marker, 'thiếu settings/_id=storage_schema');
  assert.equal(marker.version, LEAN_STORAGE_VERSION);
});

test('có dấu mốc thì coi là đã chuẩn hoá', async () => {
  const db = fakeDb({ settings: [{ _id: STORAGE_SCHEMA_ID, version: LEAN_STORAGE_VERSION }] });
  assert.equal(await hasNormalizedStorage(db), true);
});

// Đây là bài quan trọng nhất của file — nó khoá lại một lỗi ĐÃ THỰC SỰ XOÁ dữ
// liệu trên Atlas. Boot cũ hỏi `product_details.countDocuments()`. Sau khi gộp
// product_details vào products rồi drop nó, phép đếm trả 0 — trùng đúng con số
// của "database trống tinh". Boot kết luận phải seed lại và ghi đè Atlas bằng
// db.json, xoá mất 17 sản phẩm, 85 biến thể và 17 ảnh chỉ tồn tại trên Atlas.
test('database đã có sản phẩm nhưng CHƯA có dấu mốc vẫn phải coi là đã chuẩn hoá', async () => {
  const db = fakeDb({ settings: [], productCount: 71 });
  assert.equal(await hasNormalizedStorage(db), true,
    'database có 71 sản phẩm mà bị coi là trống — đây chính là đường dẫn tới việc ghi đè mất dữ liệu');
});

test('chỉ database THỰC SỰ trống mới được coi là chưa chuẩn hoá', async () => {
  assert.equal(await hasNormalizedStorage(fakeDb({ settings: [], productCount: 0 })), false);
});

test('không đọc được settings thì rơi về đếm sản phẩm, không kết luận là trống', async () => {
  const db = fakeDb({ failSettings: true, productCount: 12 });
  assert.equal(await hasNormalizedStorage(db), true,
    'lỗi đọc settings không được biến thành "database trống"');
});

test('dấu mốc không bị nhầm với document settings khác', async () => {
  const db = fakeDb({
    settings: [{ _id: 'shop', name: 'JAPANO' }, { _id: 'banners', items: [] }],
    productCount: 0,
  });
  assert.equal(await hasNormalizedStorage(db), false,
    'shop/banners không phải dấu mốc lược đồ');
});
