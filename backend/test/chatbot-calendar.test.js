// Chatbot phải trả lời được ngày tháng và mùa.
//
// Ba lỗi có thật, đo trên máy ngày 2026-09-02 trước khi sửa:
//   1. "hôm nay là ngày gì" -> "Mình chưa có đủ dữ kiện để trả lời chính xác
//      câu này" — chatbot không có bất kỳ khái niệm nào về thời gian.
//   2. "mùa đông nên mặc gì" -> nhảy thẳng vào một set ghép theo màu kèm giá,
//      không hề nhắc tới mùa.
//   3. "mùa hè mặc gì đẹp" -> chọn "Quạt giấy Nhật Bản" làm món chính. Đúng tag
//      `mùa hè` nhưng sai câu hỏi: người ta hỏi MẶC gì, không hỏi cầm gì.
const test = require('node:test');
const assert = require('node:assert/strict');

const { describeDay, seasonFromMessage, seasonOfMonth, seasonalPicks } = require('../lib/calendarVi');

const P = (name, cat, tags) => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, cat, tags, price: 100000, status: 'published' });

test('mô tả đúng ngày, thứ và mùa của một ngày cho trước', () => {
  const day = describeDay(new Date(2026, 8, 2)); // 02/09/2026
  assert.equal(day.day, 2);
  assert.equal(day.month, 9);
  assert.equal(day.year, 2026);
  assert.equal(day.weekday, 'thứ Tư');
  assert.match(day.dateText, /thứ Tư, ngày 02\/09\/2026/);
  assert.equal(day.season, 'thu');
});

test('ngày lễ cố định được nhận ra, ngày thường thì không bịa ra lễ', () => {
  assert.equal(describeDay(new Date(2026, 8, 2)).holiday, 'Quốc khánh Việt Nam');
  assert.match(describeDay(new Date(2026, 4, 5)).holiday, /Kodomo no Hi/);
  assert.equal(describeDay(new Date(2026, 8, 17)).holiday, null);
});

test('mùa suy từ tháng theo quy ước Việt Nam', () => {
  assert.equal(seasonOfMonth(1), 'đông');
  assert.equal(seasonOfMonth(3), 'xuân');
  assert.equal(seasonOfMonth(7), 'hè');
  assert.equal(seasonOfMonth(10), 'thu');
  assert.equal(seasonOfMonth(12), 'đông');
});

test('đọc được mùa từ câu hỏi, kể cả khi không gõ chữ "mùa"', () => {
  assert.equal(seasonFromMessage('mùa đông nên mặc gì'), 'đông');
  assert.equal(seasonFromMessage('trời lạnh quá mặc gì'), 'đông');
  assert.equal(seasonFromMessage('nắng nóng nên mặc gì'), 'hè');
  assert.equal(seasonFromMessage('mua he mac gi'), 'hè');
  assert.equal(seasonFromMessage('cho tôi xem áo khoác'), null);
});

test('gợi ý mùa hè KHÔNG lấy quạt giấy làm món chính', () => {
  const products = [
    P('Quạt giấy Nhật Bản', 'phu-kien', ['mùa hè', 'thủ công']),
    P('Jinbei mùa hè', 'trang-phuc', ['mùa hè', 'thoải mái']),
    P('Yukata hoa anh đào', 'ao-truyen-thong', ['mùa hè', 'lễ hội']),
  ];
  const picks = seasonalPicks(products, 'hè', 4);
  assert.ok(picks.length >= 2);
  assert.notEqual(picks[0].cat, 'phu-kien', `món đầu tiên phải mặc được, đang là ${picks[0].name}`);
  assert.ok(picks.some((item) => item.name === 'Jinbei mùa hè'));
});

test('gợi ý mùa đông lấy đúng đồ giữ ấm', () => {
  const products = [
    P('Áo Hanten chần bông mùa đông', 'ao-truyen-thong', ['mùa đông', 'ấm']),
    P('Jinbei mùa hè', 'trang-phuc', ['mùa hè']),
    P('Áo len cổ lọ dệt kim', 'ao-truyen-thong', ['áo len', 'mùa đông']),
  ];
  const picks = seasonalPicks(products, 'đông', 4);
  assert.ok(picks.length >= 2);
  assert.ok(picks.every((item) => !/Jinbei/.test(item.name)), 'đồ mùa hè không được lọt vào gợi ý mùa đông');
});

test('không có món nào hợp mùa thì trả rỗng, không vơ bừa', () => {
  const products = [P('Balo vải Nhật', 'phu-kien', ['balo'])];
  assert.deepEqual(seasonalPicks(products, 'đông', 4), []);
});
