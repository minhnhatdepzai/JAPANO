// Chọn ảnh vải sản phẩm cho AI thử đồ. Dùng chung giữa routes/catalog.js (mô
// tả sản phẩm bằng vision AI) và routes/tryon.js (thử đồ thật).
const fs = require('fs');
const path = require('path');

const PRODUCT_ASSETS_DIR = path.join(__dirname, '..', '..', 'mobile', 'assets', 'products');

// Chỉ dùng flat-lay đã được người vận hành xem và duyệt. Tách nền semantic có
// thể để sót da/tay/người mẫu; tự động tin mọi file *_tryon-flat sẽ làm model
// mặc cả những phần đó lên khách hàng.
const APPROVED_TRYON_FLATS = new Set(
  String(process.env.JAPANO_APPROVED_TRYON_FLATS || 'kimono-hong,ao-len-cardigan,yumeko')
    .split(',').map((value) => value.trim()).filter(Boolean),
);

function resolveGarmentImage(productId) {
  try {
    const files = fs.readdirSync(PRODUCT_ASSETS_DIR).filter((name) => name.startsWith(`${productId}_`) && /\.(?:jpe?g|png|webp)$/i.test(name)).sort();
    // Ảnh *_tryon-flat là reference sạch dành riêng cho VTON: không có người
    // mẫu, bó hoa hay cảnh nền để parser nhận nhầm thành một phần trang phục.
    const cleanTryon = APPROVED_TRYON_FLATS.has(String(productId))
      ? files.find((name) => /_tryon-flat\.(?:jpe?g|png|webp)$/i.test(name))
      : null;
    if (cleanTryon) return path.join(PRODUCT_ASSETS_DIR, cleanTryon);
    const catalogFiles = files.filter((name) => !/_tryon-(?:flat|candidate)\.(?:jpe?g|png|webp)$/i.test(name));
    return catalogFiles.length ? path.join(PRODUCT_ASSETS_DIR, catalogFiles[0]) : null;
  } catch { return null; }
}

module.exports = { PRODUCT_ASSETS_DIR, APPROVED_TRYON_FLATS, resolveGarmentImage };
