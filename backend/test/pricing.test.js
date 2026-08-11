// Giá theo biến thể (màu + kích cỡ). Quy tắc cốt lõi: variant.price là TUỲ
// CHỌN — thiếu thì rơi về giá sản phẩm, nên toàn bộ biến thể cũ không đổi hành
// vi. Test này khoá luôn tính chất đó để một thay đổi sau này không âm thầm
// làm mọi sản phẩm cũ về giá 0.
const test = require('node:test');
const assert = require('node:assert/strict');
const { findVariant, unitPrice, priceRange, variantOwnPrice } = require('../lib/pricing');

const product = (variants) => ({ id: 'p1', slug: 'kimono', price: 1_000_000, variants });

test('biến thể không đặt giá riêng thì dùng giá sản phẩm', () => {
  const p = product([
    { colorName: 'Sumi', size: 'M', stock: 3 },
    { colorName: 'Sumi', size: 'L', stock: 2 },
  ]);
  assert.equal(unitPrice(p, 'Sumi', 'M'), 1_000_000);
  assert.equal(unitPrice(p, 'Sumi', 'L'), 1_000_000);
  assert.equal(priceRange(p).varies, false);
});

test('biến thể có giá riêng thì ăn giá riêng', () => {
  const p = product([
    { colorName: 'Sumi', size: 'M', price: 1_200_000 },
    { colorName: 'Sumi', size: 'XXL', price: 1_450_000 },
    { colorName: 'Aizome', size: 'M' },
  ]);
  assert.equal(unitPrice(p, 'Sumi', 'M'), 1_200_000);
  assert.equal(unitPrice(p, 'Sumi', 'XXL'), 1_450_000);
  assert.equal(unitPrice(p, 'Aizome', 'M'), 1_000_000, 'biến thể không đặt giá vẫn theo giá sản phẩm');
});

test('giá 0 hoặc âm bị bỏ qua, không làm sản phẩm thành miễn phí', () => {
  const p = product([
    { colorName: 'Sumi', size: 'M', price: 0 },
    { colorName: 'Sumi', size: 'L', price: -5 },
    { colorName: 'Sumi', size: 'S', price: 'không phải số' },
  ]);
  assert.equal(unitPrice(p, 'Sumi', 'M'), 1_000_000);
  assert.equal(unitPrice(p, 'Sumi', 'L'), 1_000_000);
  assert.equal(unitPrice(p, 'Sumi', 'S'), 1_000_000);
  assert.equal(variantOwnPrice({ price: 0 }), null);
});

test('sản phẩm không khai báo biến thể vẫn dùng được', () => {
  const p = { id: 'p2', price: 490_000 };
  assert.equal(findVariant(p, 'Sumi', 'M'), null);
  assert.equal(unitPrice(p, 'Sumi', 'M'), 490_000);
  assert.deepEqual(priceRange(p), { min: 490_000, max: 490_000, varies: false });
});

test('khớp theo size khi màu không tồn tại (sản phẩm một màu)', () => {
  const p = product([{ colorName: 'Mặc định', size: 'L', price: 800_000 }]);
  assert.equal(unitPrice(p, 'MàuKhôngCó', 'L'), 800_000);
});

test('priceRange báo "có chênh lệch" để danh sách hiện "từ X"', () => {
  const p = product([
    { colorName: 'Sumi', size: 'M', price: 900_000 },
    { colorName: 'Sumi', size: 'XXL', price: 1_300_000 },
  ]);
  assert.deepEqual(priceRange(p), { min: 900_000, max: 1_300_000, varies: true });
});

test('giá trị mặc định màu/size khớp đúng biến thể', () => {
  const p = product([{ size: 'M', price: 777_000 }]); // không có colorName
  assert.equal(unitPrice(p, undefined, undefined), 777_000, 'thiếu lựa chọn thì coi như Mặc định/M');
});
