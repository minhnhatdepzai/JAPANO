// Giá theo BIẾN THỂ (màu + kích cỡ).
//
// Quy tắc: `variant.price` là TUỲ CHỌN. Không khai báo (hoặc <= 0) thì dùng giá
// của sản phẩm. Nhờ vậy 218 biến thể sẵn có không phải sửa gì, và cửa hàng chỉ
// cần đặt giá riêng cho đúng những biến thể thật sự khác giá — ví dụ size XXL
// tốn vải hơn, hay màu nhuộm thủ công đắt hơn.
//
// Máy chủ LUÔN là nơi quyết định giá cuối cùng: routes/orders.js tính lại đơn
// giá từ đây thay vì tin số tiền client gửi lên, nên sửa giá trong trang quản
// trị là đơn mới ăn giá mới ngay, và khách không thể tự khai giá rẻ hơn.

const DEFAULT_COLOR = 'Mặc định';
const DEFAULT_SIZE = 'M';
// Phụ thu nhẹ theo lượng vải. S là giá niêm yết; mỗi bậc lớn hơn tăng 10.000đ.
// Size lạ/size phụ kiện không nằm trong bảng thì không tự cộng.
const SIZE_SURCHARGE = Object.freeze({ S: 0, M: 10_000, L: 20_000, XL: 30_000, XXL: 40_000, XXXL: 50_000, '4XL': 60_000, '5XL': 70_000 });

const sameColor = (variant, colorName) =>
  String(variant.colorName || DEFAULT_COLOR) === String(colorName || DEFAULT_COLOR);
const sameSize = (variant, size) =>
  String(variant.size || DEFAULT_SIZE) === String(size || DEFAULT_SIZE);

/**
 * Tìm biến thể khớp màu+size. Khớp cả hai là tốt nhất; chỉ khớp size cũng chấp
 * nhận được (sản phẩm một màu). Sản phẩm không khai báo variants — ảnh minh
 * hoạ, phụ kiện cũ — trả null để nơi gọi bỏ qua thay vì chặn nhầm.
 */
function findVariant(product, colorName, size) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  return variants.find((v) => sameColor(v, colorName) && sameSize(v, size))
    || variants.find((v) => sameSize(v, size))
    || null;
}

/** Giá của riêng một biến thể, hoặc null nếu biến thể đó không đặt giá riêng. */
function variantOwnPrice(variant) {
  const price = Number(variant?.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function sizeSurcharge(size) {
  return SIZE_SURCHARGE[String(size || DEFAULT_SIZE).trim().toUpperCase()] ?? 0;
}

/** Đơn giá thực tế khách phải trả cho một lựa chọn màu+size. */
function unitPrice(product, colorName, size) {
  const variant = findVariant(product, colorName, size);
  return variantOwnPrice(variant) ?? Math.max(0, Number(product?.price) || 0) + sizeSurcharge(size);
}

/**
 * Khoảng giá của cả sản phẩm — để danh sách hiển thị "từ X" khi các biến thể
 * lệch giá nhau, thay vì chỉ nêu một con số rồi khách bấm vào thấy số khác.
 */
function priceRange(product) {
  const base = Math.max(0, Number(product?.price) || 0);
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return { min: base, max: base, varies: false };
  const prices = variants.map((variant) => variantOwnPrice(variant) ?? base + sizeSurcharge(variant.size));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, varies: min !== max };
}

module.exports = { findVariant, variantOwnPrice, sizeSurcharge, unitPrice, priceRange, SIZE_SURCHARGE, DEFAULT_COLOR, DEFAULT_SIZE };
