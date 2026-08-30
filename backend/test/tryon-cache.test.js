const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Cache đọc thư mục từ biến môi trường lúc nạp module, nên phải đặt trước require.
const CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'japano-tryon-cache-'));
process.env.JAPANO_TRYON_CACHE_DIR = CACHE_DIR;

const { cacheKey, readTryonCache, writeTryonCache, clearTryonCache } = require('../lib/tryonCache');

test.after(() => fs.rmSync(CACHE_DIR, { recursive: true, force: true }));

const base = {
  presetId: 'nu-can-doi',
  presetSha256: 'abc123',
  productIds: ['kimono-hong'],
  size: 'M',
  color: 'Mực',
  accessoryIds: [],
  qualityMode: 'high',
};

test('khoá ổn định giữa các lần gọi và không phụ thuộc thứ tự mảng', () => {
  assert.equal(cacheKey(base), cacheKey({ ...base }));
  assert.equal(
    cacheKey({ ...base, productIds: ['a', 'b'], accessoryIds: ['x', 'y'] }),
    cacheKey({ ...base, productIds: ['b', 'a'], accessoryIds: ['y', 'x'] }),
    'thứ tự người dùng chọn món không được tạo ra hai khoá khác nhau',
  );
  assert.equal(cacheKey({ ...base, size: 'm' }), cacheKey({ ...base, size: 'M' }), 'size phải chuẩn hoá hoa/thường');
});

// Mỗi biến dưới đây đổi ảnh đầu ra, nên phải đổi khoá. Bỏ sót một biến nghĩa là
// trả ảnh của cấu hình khác — sai lặng lẽ và rất khó phát hiện.
test('mọi biến ảnh hưởng tới ảnh đều đổi khoá', () => {
  const variants = {
    presetId: 'nam-can-doi',
    presetSha256: 'khac',
    productIds: ['yukata-xanh'],
    size: 'L',
    color: 'Trắng',
    accessoryIds: ['kep-no'],
    qualityMode: 'fast',
  };
  for (const [field, value] of Object.entries(variants)) {
    assert.notEqual(cacheKey(base), cacheKey({ ...base, [field]: value }), `đổi ${field} mà khoá không đổi`);
  }
});

test('ghi rồi đọc lại đúng nội dung', () => {
  const key = cacheKey(base);
  assert.equal(readTryonCache(key), null, 'cache rỗng phải trả null');
  assert.equal(writeTryonCache(key, { response: { imageBase64: 'data:image/png;base64,AAA', ok: true } }), true);
  const hit = readTryonCache(key);
  assert.equal(hit.response.imageBase64, 'data:image/png;base64,AAA');
  assert.ok(Number(hit.savedAt) > 0, 'phải đóng dấu thời gian để tính hạn dùng');
});

test('không ghi khi thiếu ảnh — cache rỗng còn tệ hơn không cache', () => {
  assert.equal(writeTryonCache(cacheKey({ ...base, size: 'S' }), { response: {} }), false);
  assert.equal(writeTryonCache(cacheKey({ ...base, size: 'S' }), null), false);
  // Ảnh đặt sai tầng (ngoài `response`) cũng phải bị từ chối, vì lần đọc sau sẽ
  // không tìm thấy gì để trả về.
  assert.equal(writeTryonCache(cacheKey({ ...base, size: 'S' }), { imageBase64: 'x' }), false);
  assert.equal(writeTryonCache('', { response: { imageBase64: 'x' } }), false);
  assert.equal(readTryonCache(cacheKey({ ...base, size: 'S' })), null);
});

test('file hỏng không làm sập đường đọc', () => {
  const key = cacheKey({ ...base, size: 'XL' });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), '{ khong phai JSON');
  assert.equal(readTryonCache(key), null);
});

test('clearTryonCache dọn sạch và vẫn ghi lại được', () => {
  const key = cacheKey({ ...base, color: 'Đỏ' });
  writeTryonCache(key, { response: { imageBase64: 'data:image/png;base64,BBB' } });
  assert.ok(readTryonCache(key));
  clearTryonCache();
  assert.equal(readTryonCache(key), null);
  assert.equal(writeTryonCache(key, { response: { imageBase64: 'data:image/png;base64,CCC' } }), true);
  assert.equal(readTryonCache(key).response.imageBase64, 'data:image/png;base64,CCC');
});
