const test = require('node:test');
const assert = require('node:assert/strict');

const { accessoryKind } = require('../lib/accessory');

// ---------------------------------------------------------------------------
// accessoryKind() quyết định phụ kiện được neo vào BỘ PHẬN NÀO trên cơ thể.
// Phân loại sai thì ảnh sai thấy rõ ngay: chiếc ba lô từng rơi vào nhóm "túi"
// nên nhân vật cầm nó trên tay thay vì đeo sau lưng, còn đai obi thì bị cầm
// lủng lẳng thay vì thắt ngang eo.
//
// Thứ tự các nhánh trong hàm cũng quan trọng: "balo vải" khớp cả mẫu ba lô lẫn
// mẫu túi, nên ba lô phải được xét trước.
// ---------------------------------------------------------------------------
const kindOf = (name, extra = {}) => accessoryKind({ name, ...extra });

test('ba lô đeo sau lưng, không phải cầm tay', () => {
  assert.equal(kindOf('Balo vải Nhật'), 'backpack');
  assert.equal(kindOf('Ba lô da bò'), 'backpack');
  assert.equal(kindOf('Canvas backpack'), 'backpack');
  assert.equal(accessoryKind({ name: 'Túi đeo', slug: 'balo-vai' }), 'backpack', 'slug cũng phải được xét');
});

test('túi xách vẫn là món cầm tay, không nhầm sang ba lô', () => {
  assert.equal(kindOf('Túi xách nữ'), 'bag');
  assert.equal(kindOf('Handbag da'), 'bag');
});

test('đai obi thắt ngang eo', () => {
  assert.equal(kindOf('Đai Obi lụa dệt hoa'), 'waist');
  assert.equal(kindOf('Thắt lưng vải'), 'waist');
});

test('món cầm tay: quạt, khăn, gấu bông, kiếm gỗ', () => {
  assert.equal(kindOf('Quạt giấy Nhật Bản'), 'hand');
  assert.equal(kindOf('Khăn gói Furoshiki'), 'hand');
  assert.equal(kindOf('Gấu bông Kumamon'), 'hand');
  assert.equal(kindOf('Kiếm gỗ Nhật bản'), 'sword');
});

test('món đội/đeo trên đầu tách làm ba loại neo khác nhau', () => {
  assert.equal(kindOf('Mũ bo Nhật'), 'hat');
  assert.equal(kindOf('Kẹp nơ tóc'), 'hair_clip');
  assert.equal(kindOf('Trâm cài tóc Kanzashi'), 'hair_clip');
  assert.equal(kindOf('Chụp tai nữ'), 'earmuffs');
});

test('món đi vào chân', () => {
  assert.equal(kindOf('Dép quai Nhật'), 'shoe');
  assert.equal(kindOf('Guốc gỗ Geta'), 'shoe');
  assert.equal(kindOf('Vớ tất cổ cao'), 'shoe');
  assert.equal(kindOf('Tất Tabi chia ngón'), 'shoe');
});

test('dù đi đường riêng vì phải dựng đứng và che đầu', () => {
  assert.equal(kindOf('Dù Nhật bản'), 'umbrella');
});

test('mọi phụ kiện trong catalog đều có điểm neo cụ thể', () => {
  const catalog = require('../data/db.json');
  const accessories = catalog.products.filter((product) => (product.cat || product.category) === 'phu-kien');
  assert.ok(accessories.length >= 10, `chỉ có ${accessories.length} phụ kiện`);
  const known = new Set(['backpack', 'bag', 'waist', 'hand', 'sword', 'hat', 'hair_clip', 'earmuffs', 'shoe', 'umbrella']);
  for (const product of accessories) {
    const kind = accessoryKind(product);
    assert.ok(known.has(kind), `${product.slug} → loại lạ "${kind}"`);
  }
});

// Đây là bài kiểm tra chống hồi quy đúng nghĩa: liệt kê tên thật trong catalog
// cùng chỗ nó PHẢI gắn vào. Đổi regex mà làm lệch một món là gãy ngay.
test('từng phụ kiện thật trong catalog gắn đúng bộ phận', () => {
  const expected = {
    'balo-vai': 'backpack',
    'giay-dep': 'shoe',
    'guoc-geta': 'shoe',
    'vo-tat': 'shoe',
    'tabi-chia-ngon': 'shoe',
    'mu-nhat': 'hat',
    'kep-no': 'hair_clip',
    'kanzashi-trau-cai': 'hair_clip',
    'chup-tai': 'earmuffs',
    'du-nhat': 'umbrella',
    'kiem-go': 'sword',
    'obi-lua': 'waist',
    'sensu-quat-gap': 'hand',
    'furoshiki-vai': 'hand',
    'gang-tay': 'hand',
  };
  const catalog = require('../data/db.json');
  for (const [slug, want] of Object.entries(expected)) {
    const product = catalog.products.find((item) => item.slug === slug);
    if (!product) continue; // sản phẩm có thể chưa được thêm vào catalog
    assert.equal(accessoryKind(product), want, `${slug} phải là "${want}"`);
  }
});
