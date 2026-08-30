const test = require('node:test');
const assert = require('node:assert/strict');

const {
  readCachedAdultCheck,
  writeCachedAdultCheck,
} = require('../lib/adultImageCheck');

test('cache kiểm tra 18+ chỉ lưu quyết định theo fingerprint, không lưu ảnh', () => {
  const key = `adult-check-${Date.now()}`;
  assert.equal(readCachedAdultCheck(key), null);
  writeCachedAdultCheck(key, { available:true, verdict:'yes', ms:3210 });
  const cached = readCachedAdultCheck(key);
  assert.equal(cached.available, true);
  assert.equal(cached.verdict, 'yes');
  assert.equal(cached.cached, true);
  assert.equal(cached.ms, 0);
  assert.equal('imageBase64' in cached, false);
});

test('cache không lưu kết quả khi dịch vụ kiểm tra ảnh không sẵn sàng', () => {
  const key = `adult-check-unavailable-${Date.now()}`;
  writeCachedAdultCheck(key, { available:false, verdict:'unsure', error:'timeout' });
  assert.equal(readCachedAdultCheck(key), null);
});
