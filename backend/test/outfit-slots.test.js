// Slot cơ thể của từng món và cách đọc ra bộ đồ còn thiếu chỗ nào.
//
// Bài test này khoá lại hai lỗi đã đo được trên máy ngày 2026-09-02:
//   1. giày/dép/guốc rơi vào profile mặc định nên bị coi là áo lớp trong
//      (zone=upper, layer=upper-base) — hệ thống nghĩ đôi dép là cái áo;
//   2. chọn mỗi áo khoác ngoài thì không chỗ nào nhận ra là thiếu áo lớp trong,
//      và đó chính là lý do model vẽ ra người cởi trần dưới lớp haori.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  slotOf, analyseOutfit, isBodySlot,
  SLOT_UPPER_BASE, SLOT_UPPER_OUTER, SLOT_LOWER, SLOT_FEET,
} = require('../lib/outfitSlots');

const P = (name, extra = {}) => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, ...extra });

test('giày dép nằm ở slot bàn chân, không bị coi là áo lớp trong', () => {
  const cases = [
    ['Dép quai Nhật', 'phu-kien'],
    ['Guốc gỗ Geta', 'phu-kien'],
    ['Tất Tabi chia ngón', 'phu-kien'],
  ];
  for (const [name, cat] of cases) {
    assert.equal(slotOf(P(name, { cat })), SLOT_FEET, name);
  }
});

test('phụ kiện không phải giày vẫn là phụ kiện, không chiếm slot cơ thể', () => {
  const bag = slotOf(P('Túi vải canvas', { cat: 'phu-kien' }));
  assert.ok(bag.startsWith('accessory:'), bag);
  assert.equal(isBodySlot(bag), false);
});

test('chọn mỗi áo khoác ngoài thì thiếu áo lớp trong là mức BẮT BUỘC', () => {
  // Đây đúng là bộ đầu vào đã tạo ra ảnh hở ngực: một mình chiếc haori.
  const analysis = analyseOutfit([P('Áo choàng Haori dáng dài', { cat: 'haori' })]);
  assert.equal(analysis.complete, false);
  assert.deepEqual(analysis.filled, [SLOT_UPPER_OUTER]);
  const base = analysis.missing.find((item) => item.slot === SLOT_UPPER_BASE);
  assert.ok(base, 'phải báo thiếu áo lớp trong');
  assert.equal(base.level, 'required');
  const lower = analysis.missing.find((item) => item.slot === SLOT_LOWER);
  assert.equal(lower.level, 'required');
});

test('bộ liền thân là đã mặc đủ thân, chỉ còn gợi ý giày ở mức tuỳ chọn', () => {
  const analysis = analyseOutfit([P('Kimono truyền thống Hồng', { cat: 'ao-truyen-thong' })]);
  assert.equal(analysis.torsoCovered, true);
  assert.equal(analysis.complete, true);
  const missingSlots = analysis.missing.map((item) => item.slot);
  assert.deepEqual(missingSlots, [SLOT_FEET]);
  assert.equal(analysis.missing[0].level, 'optional');
});

test('áo lớp trong cộng quần là đủ thân, không đòi thêm áo khoác', () => {
  const analysis = analyseOutfit([
    P('Sơ mi trắng tay ngắn', { cat: 'ao-truyen-thong' }),
    P('Hakama nữ vải dày', { cat: 'trang-phuc' }),
  ]);
  assert.equal(analysis.torsoCovered, true);
  assert.ok(!analysis.missing.some((item) => item.level === 'required'), JSON.stringify(analysis.missing));
});

test('bộ liền thân mặc chồng áo khoác bị báo xung đột', () => {
  const analysis = analyseOutfit([
    P('Kimono truyền thống Hồng', { cat: 'ao-truyen-thong' }),
    P('Áo choàng Haori dáng dài', { cat: 'haori' }),
  ]);
  assert.equal(analysis.complete, false);
  assert.equal(analysis.conflicts.length, 1);
  assert.equal(analysis.conflicts[0].reason, 'overall_conflict');
});

test('hai món cùng một slot bị báo trùng chỗ', () => {
  const analysis = analyseOutfit([
    P('Hakama nữ vải dày', { cat: 'trang-phuc' }),
    P('Hakama nữ màu tím', { cat: 'trang-phuc' }),
  ]);
  const duplicate = analysis.conflicts.find((item) => item.reason === 'duplicate_slot');
  assert.ok(duplicate, JSON.stringify(analysis.conflicts));
  assert.equal(duplicate.slot, SLOT_LOWER);
});

test('giày không chiếm chỗ thân nên không bao giờ xung đột với quần áo', () => {
  const analysis = analyseOutfit([
    P('Kimono truyền thống Hồng', { cat: 'ao-truyen-thong' }),
    P('Guốc gỗ Geta', { cat: 'phu-kien' }),
  ]);
  assert.equal(analysis.conflicts.length, 0);
  assert.ok(analysis.filled.includes(SLOT_FEET));
  assert.equal(analysis.complete, true);
});
