// Sinh hai DDL v2 chuẩn hoá (bản thiết kế SQL lịch sử):
//   - japano_schema_v2.sql        -> DDL MySQL/MariaDB (khoá, UNIQUE, CHECK, FK)
//   - japano_schema_v2_sqlite.sql -> DDL SQLite (chạy thử trên sqliteonline.com)
//
// Không ghi japano_erd.dbml tại đây: file DBML đó hiện mô tả đúng app_state
// schemaVersion 5 đang chạy (JSON + Mongo mirror), không còn là output của bản
// thiết kế SQL v2 này.
// v2 sửa 11 nhóm lỗi đã review: sổ địa chỉ, biến thể-tồn kho, vòng đời đơn,
// tách thanh toán/hoàn tiền, tách voucher vs khuyến mãi cổng, review 1-lần,
// wishlist/giỏ là thực thể thật, ràng buộc CHECK, danh mục N–N + phân cấp...
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// ---- DSL nhỏ để mô tả bảng ---------------------------------------------------
const tables = [];
const refs = [];
function T(name, note, cols, opts = {}) { tables.push({ name, note, cols, ...opts }); }
function col(name, type, flags = '', note = '') { return { name, type, flags, note }; }
// R(childTable.col, parentTable.col, onDelete)
function R(from, to, onDelete = 'SET NULL') { refs.push({ from, to, onDelete }); }

const NOW = "DATETIME";      // thời điểm (SQLite lưu text ISO, MySQL DATETIME)
const MONEY = "BIGINT";      // tiền VND để nguyên đồng (số nguyên)

// ============================ DANH MỤC DÙNG CHUNG ============================
T('currencies', 'Chuẩn hoá mã tiền tệ — hết cảnh lẫn "vnd"/"VND".', [
  col('code', 'VARCHAR(10)', 'pk'),
  col('name', 'VARCHAR(60)', 'not null'),
  col('symbol', 'VARCHAR(10)'),
]);

T('categories', 'Danh mục có phân cấp cha–con (parent_id tự trỏ).', [
  col('id', 'BIGINT', 'pk auto'),
  col('slug', 'VARCHAR(80)', 'unique not null'),
  col('name', 'VARCHAR(150)', 'not null'),
  col('kanji', 'VARCHAR(40)'),
  col('parent_id', 'BIGINT'),
]);
R('categories.parent_id', 'categories.id', 'SET NULL');

// ============================== SẢN PHẨM ====================================
T('products', 'Bỏ rating/sold denormalized — tính từ reviews/order_items.', [
  col('id', 'BIGINT', 'pk auto'),
  col('slug', 'VARCHAR(120)', 'unique not null'),
  col('name', 'VARCHAR(190)', 'not null'),
  col('kanji', 'VARCHAR(40)'),
  col('brand', 'VARCHAR(80)'),
  col('base_price', MONEY, 'not null', 'giá niêm yết mặc định'),
  col('old_price', MONEY, '', 'giá gạch (khuyến mãi hiển thị)'),
  col('currency_code', 'VARCHAR(10)', 'not null'),
  col('status', "VARCHAR(20)", 'not null', "'draft' | 'published' | 'archived'"),
  col('description', 'TEXT'),
  col('story', 'TEXT'),
  col('created_at', NOW, 'not null'),
  col('updated_at', NOW),
], { checks: ['base_price >= 0'] });
R('products.currency_code', 'currencies.code', 'RESTRICT');

T('product_categories', 'N–N: 1 sản phẩm thuộc nhiều danh mục.', [
  col('product_id', 'BIGINT', 'not null'),
  col('category_id', 'BIGINT', 'not null'),
], { pk: ['product_id', 'category_id'] });
R('product_categories.product_id', 'products.id', 'CASCADE');
R('product_categories.category_id', 'categories.id', 'CASCADE');

T('product_images', 'Ảnh sản phẩm (ảnh lưu Cloudinary, DB giữ URL).', [
  col('id', 'BIGINT', 'pk auto'),
  col('product_id', 'BIGINT', 'not null'),
  col('url', 'VARCHAR(500)', 'not null'),
  col('position', 'INT', 'not null'),
]);
R('product_images.product_id', 'products.id', 'CASCADE');

T('product_variants', 'UNIQUE(product_id,color,size) + SKU UNIQUE — hết trùng biến thể.', [
  col('id', 'BIGINT', 'pk auto'),
  col('product_id', 'BIGINT', 'not null'),
  col('color_name', 'VARCHAR(60)', 'not null'),
  col('color_hex', 'VARCHAR(16)'),
  col('size', 'VARCHAR(20)', 'not null'),
  col('sku', 'VARCHAR(60)', 'unique not null'),
  col('price', MONEY, '', 'giá riêng của biến thể (NULL = dùng base_price)'),
  col('stock', 'INT', 'not null', 'tồn kho thực'),
  col('reserved', 'INT', 'not null', 'đã giữ chỗ cho đơn chưa hoàn tất'),
], { uniques: [['product_id', 'color_name', 'size']], checks: ['stock >= 0', 'reserved >= 0', 'reserved <= stock', 'price IS NULL OR price >= 0'] });
R('product_variants.product_id', 'products.id', 'CASCADE');

T('inventory_movements', 'Sổ cái tồn kho: mọi lần +/- kho (nhập, bán, huỷ-hoàn, trả).', [
  col('id', 'BIGINT', 'pk auto'),
  col('variant_id', 'BIGINT', 'not null'),
  col('delta', 'INT', 'not null', 'âm = giảm, dương = tăng'),
  col('reason', 'VARCHAR(30)', 'not null', "'purchase'|'sale'|'cancel_restock'|'return_restock'|'adjust'"),
  col('order_id', 'BIGINT', '', 'đơn liên quan (nếu có)'),
  col('created_at', NOW, 'not null'),
]);
R('inventory_movements.variant_id', 'product_variants.id', 'CASCADE');
R('inventory_movements.order_id', 'orders.id', 'SET NULL');

// ============================ NGƯỜI DÙNG & ĐỊA CHỈ ==========================
T('users', 'Bỏ orders_count/spent/tryons denormalized — tính từ giao dịch.', [
  col('id', 'BIGINT', 'pk auto'),
  col('name', 'VARCHAR(150)', 'not null'),
  col('email', 'VARCHAR(190)', 'unique'),
  col('phone', 'VARCHAR(40)'),
  col('password_hash', 'VARCHAR(255)'),
  col('role', "VARCHAR(20)", 'not null', "'admin'|'staff'|'customer'"),
  col('status', "VARCHAR(20)", 'not null', "'active'|'locked'"),
  col('created_at', NOW, 'not null'),
]);

T('addresses', 'SỔ ĐỊA CHỈ: khách lưu nhiều địa chỉ, chọn mặc định. (Không có quận/huyện theo cải cách 2025.)', [
  col('id', 'BIGINT', 'pk auto'),
  col('user_id', 'BIGINT', 'not null'),
  col('recipient_name', 'VARCHAR(150)', 'not null'),
  col('phone', 'VARCHAR(40)', 'not null'),
  col('street', 'VARCHAR(255)', 'not null'),
  col('ward_code', 'VARCHAR(20)'),
  col('ward', 'VARCHAR(120)'),
  col('province_code', 'VARCHAR(20)'),
  col('province', 'VARCHAR(120)'),
  col('is_default', 'BOOLEAN', 'not null'),
  col('created_at', NOW, 'not null'),
]);
R('addresses.user_id', 'users.id', 'CASCADE');

T('profiles', 'Hồ sơ phong cách dùng cho stylist/gợi ý — 1 khách 1 hồ sơ.', [
  col('id', 'BIGINT', 'pk auto'),
  col('user_id', 'BIGINT', 'not null'),
  col('gender', 'VARCHAR(30)'),
  col('skin_tone', 'VARCHAR(60)'),
  col('occasion', 'VARCHAR(120)'),
  col('budget', MONEY),
  col('height_cm', 'INT'),
  col('weight_kg', 'INT'),
  col('usual_size', 'VARCHAR(20)'),
  col('updated_at', NOW),
], { uniques: [['user_id']] });
R('profiles.user_id', 'users.id', 'CASCADE');

T('profile_styles', 'Phong cách yêu thích trong hồ sơ (mảng preferredStyles chuẩn hoá thành hàng).', [
  col('id', 'BIGINT', 'pk auto'),
  col('profile_id', 'BIGINT', 'not null'),
  col('position', 'INT', 'not null'),
  col('style', 'VARCHAR(80)', 'not null'),
], { uniques: [['profile_id', 'position']] });
R('profile_styles.profile_id', 'profiles.id', 'CASCADE');

// ============================== GIỎ & WISHLIST ==============================
T('carts', 'Giỏ hỗ trợ cả khách vãng lai (session_token) để merge khi đăng nhập.', [
  col('id', 'BIGINT', 'pk auto'),
  col('user_id', 'BIGINT', '', 'NULL nếu là khách chưa đăng nhập'),
  col('session_token', 'VARCHAR(64)', '', 'định danh giỏ của khách vãng lai'),
  col('updated_at', NOW, 'not null'),
]);
R('carts.user_id', 'users.id', 'CASCADE');

T('cart_items', 'Trỏ thẳng biến thể — không còn màu/size dạng chữ tự do.', [
  col('id', 'BIGINT', 'pk auto'),
  col('cart_id', 'BIGINT', 'not null'),
  col('variant_id', 'BIGINT', 'not null'),
  col('quantity', 'INT', 'not null'),
  col('added_at', NOW, 'not null'),
], { uniques: [['cart_id', 'variant_id']], checks: ['quantity > 0'] });
R('cart_items.cart_id', 'carts.id', 'CASCADE');
R('cart_items.variant_id', 'product_variants.id', 'RESTRICT');

T('wishlists', 'Thực thể riêng (không suy ra từ log) — thêm/bỏ tim sạch sẽ.', [
  col('id', 'BIGINT', 'pk auto'),
  col('user_id', 'BIGINT', 'not null'),
  col('product_id', 'BIGINT', 'not null'),
  col('created_at', NOW, 'not null'),
], { uniques: [['user_id', 'product_id']] });
R('wishlists.user_id', 'users.id', 'CASCADE');
R('wishlists.product_id', 'products.id', 'CASCADE');

// ============================ VOUCHER vs KHUYẾN MÃI =========================
T('vouchers', 'Mã giảm giá của SHOP — có giới hạn tổng & theo từng khách.', [
  col('id', 'BIGINT', 'pk auto'),
  col('code', 'VARCHAR(40)', 'unique not null'),
  col('type', "VARCHAR(20)", 'not null', "'percent'|'amount'"),
  col('value', 'INT', 'not null'),
  col('min_order', MONEY, 'not null'),
  col('max_discount', MONEY, '', 'trần giảm cho loại percent'),
  col('usage_limit', 'INT', '', 'tổng lượt cho phép (NULL = không giới hạn)'),
  col('per_user_limit', 'INT', '', 'lượt tối đa mỗi khách'),
  col('used_count', 'INT', 'not null'),
  col('starts_at', NOW),
  col('expires_at', NOW),
  col('active', 'BOOLEAN', 'not null'),
], { checks: ['value >= 0', 'min_order >= 0'] });

T('payment_promotions', 'Khuyến mãi của CỔNG THANH TOÁN (STRIPE10, VNPAY5, JAPANO10) — TÁCH khỏi voucher.', [
  col('code', 'VARCHAR(40)', 'pk'),
  col('provider', "VARCHAR(20)", 'not null', "'stripe'|'vnpay'|'cod'"),
  col('type', "VARCHAR(20)", 'not null', "'percent'|'amount'"),
  col('value', 'INT', 'not null'),
  col('active', 'BOOLEAN', 'not null'),
], { checks: ['value >= 0'] });

// ================================ ĐƠN HÀNG ==================================
T('orders', 'Bỏ hết field payment_* & discount trùng — địa chỉ giao được SNAPSHOT.', [
  col('id', 'BIGINT', 'pk auto'),
  col('code', 'VARCHAR(40)', 'unique not null'),
  col('user_id', 'BIGINT', '', 'NULL nếu khách vãng lai'),
  col('status', "VARCHAR(30)", 'not null', "pending|confirmed|shipping|completed|cancelled|returned"),
  col('shipping_address_id', 'BIGINT', '', 'tham chiếu sổ địa chỉ (có thể NULL sau này)'),
  col('ship_recipient', 'VARCHAR(150)', 'not null', 'SNAPSHOT — giữ nguyên kể cả khi sổ địa chỉ đổi'),
  col('ship_phone', 'VARCHAR(40)', 'not null'),
  col('ship_street', 'VARCHAR(255)', 'not null'),
  col('ship_ward_code', 'VARCHAR(20)'),
  col('ship_ward', 'VARCHAR(120)'),
  col('ship_province_code', 'VARCHAR(20)'),
  col('ship_province', 'VARCHAR(120)'),
  col('contact_email', 'VARCHAR(190)'),
  col('subtotal', MONEY, 'not null'),
  col('discount_total', MONEY, 'not null'),
  col('shipping_fee', MONEY, 'not null'),
  col('grand_total', MONEY, 'not null'),
  col('currency_code', 'VARCHAR(10)', 'not null'),
  col('source', 'VARCHAR(30)'),
  col('placed_at', NOW, 'not null'),
  col('cancelled_at', NOW),
  col('cancel_reason', 'VARCHAR(255)'),
], { checks: ['subtotal >= 0', 'discount_total >= 0', 'shipping_fee >= 0', 'grand_total >= 0'] });
R('orders.user_id', 'users.id', 'SET NULL');
R('orders.shipping_address_id', 'addresses.id', 'SET NULL');
R('orders.currency_code', 'currencies.code', 'RESTRICT');

T('order_items', 'Nối biến thể (variant_id) + snapshot tên/giá — báo cáo theo biến thể được.', [
  col('id', 'BIGINT', 'pk auto'),
  col('order_id', 'BIGINT', 'not null'),
  col('variant_id', 'BIGINT', '', 'biến thể đã mua (RESTRICT: không cho xoá biến thể đã bán)'),
  col('product_id', 'BIGINT', ''),
  col('name_snapshot', 'VARCHAR(190)', 'not null'),
  col('color_snapshot', 'VARCHAR(60)'),
  col('size_snapshot', 'VARCHAR(20)'),
  col('unit_price', MONEY, 'not null'),
  col('quantity', 'INT', 'not null'),
  col('line_total', MONEY, 'not null'),
], { checks: ['quantity > 0', 'unit_price >= 0', 'line_total >= 0'] });
R('order_items.order_id', 'orders.id', 'CASCADE');
R('order_items.variant_id', 'product_variants.id', 'RESTRICT');
R('order_items.product_id', 'products.id', 'SET NULL');

T('order_discounts', 'Mỗi khoản giảm là 1 dòng — 1 đơn có thể áp NHIỀU giảm giá.', [
  col('id', 'BIGINT', 'pk auto'),
  col('order_id', 'BIGINT', 'not null'),
  col('source_type', "VARCHAR(20)", 'not null', "'voucher'|'payment_promo'"),
  col('voucher_id', 'BIGINT', ''),
  col('promotion_code', 'VARCHAR(40)', ''),
  col('amount', MONEY, 'not null'),
], { checks: ['amount >= 0'] });
R('order_discounts.order_id', 'orders.id', 'CASCADE');
R('order_discounts.voucher_id', 'vouchers.id', 'SET NULL');
R('order_discounts.promotion_code', 'payment_promotions.code', 'SET NULL');

T('order_status_history', 'Nhật ký chuyển trạng thái có from→to + người đổi (kiểm soát state machine).', [
  col('id', 'BIGINT', 'pk auto'),
  col('order_id', 'BIGINT', 'not null'),
  col('from_status', 'VARCHAR(30)'),
  col('to_status', 'VARCHAR(30)', 'not null'),
  col('changed_by', 'BIGINT', '', 'user gây ra thay đổi'),
  col('note', 'VARCHAR(255)'),
  col('created_at', NOW, 'not null'),
]);
R('order_status_history.order_id', 'orders.id', 'CASCADE');
R('order_status_history.changed_by', 'users.id', 'SET NULL');

// ============================ THANH TOÁN & HOÀN TIỀN ========================
T('payments', 'NGUỒN SỰ THẬT thanh toán — 1 đơn có NHIỀU lần thử (retry).', [
  col('id', 'BIGINT', 'pk auto'),
  col('code', 'VARCHAR(60)', 'unique not null'),
  col('order_id', 'BIGINT', 'not null'),
  col('provider', "VARCHAR(20)", 'not null', "'stripe'|'vnpay'|'cod'"),
  col('method', 'VARCHAR(40)'),
  col('status', "VARCHAR(20)", 'not null', "pending|paid|failed|cancelled|refunded"),
  col('amount', MONEY, 'not null'),
  col('currency_code', 'VARCHAR(10)', 'not null'),
  col('transaction_code', 'VARCHAR(120)'),
  col('paid_at', NOW),
  col('created_at', NOW, 'not null'),
], { checks: ['amount >= 0'] });
R('payments.order_id', 'orders.id', 'CASCADE');
R('payments.currency_code', 'currencies.code', 'RESTRICT');

T('return_requests', 'Yêu cầu trả hàng gắn đúng đơn + lần thanh toán.', [
  col('id', 'BIGINT', 'pk auto'),
  col('code', 'VARCHAR(60)', 'unique not null'),
  col('order_id', 'BIGINT', 'not null'),
  col('user_id', 'BIGINT', ''),
  col('payment_id', 'BIGINT', ''),
  col('status', "VARCHAR(30)", 'not null'),
  col('reason', 'VARCHAR(255)'),
  col('note', 'TEXT'),
  col('amount', MONEY, 'not null'),
  col('created_at', NOW, 'not null'),
], { checks: ['amount >= 0'] });
R('return_requests.order_id', 'orders.id', 'CASCADE');
R('return_requests.user_id', 'users.id', 'SET NULL');
R('return_requests.payment_id', 'payments.id', 'SET NULL');

T('return_request_items', 'Nối đúng order_item — trả 1 trong 2 món cùng sản phẩm không còn mơ hồ.', [
  col('id', 'BIGINT', 'pk auto'),
  col('return_request_id', 'BIGINT', 'not null'),
  col('order_item_id', 'BIGINT', 'not null'),
  col('quantity', 'INT', 'not null'),
], { checks: ['quantity > 0'] });
R('return_request_items.return_request_id', 'return_requests.id', 'CASCADE');
R('return_request_items.order_item_id', 'order_items.id', 'RESTRICT');

T('refunds', 'Hoàn tiền theo từng payment (app đảm bảo tổng hoàn ≤ số đã trả).', [
  col('id', 'BIGINT', 'pk auto'),
  col('payment_id', 'BIGINT', 'not null'),
  col('return_request_id', 'BIGINT', ''),
  col('amount', MONEY, 'not null'),
  col('status', "VARCHAR(20)", 'not null'),
  col('reason', 'VARCHAR(120)'),
  col('created_at', NOW, 'not null'),
], { checks: ['amount > 0'] });
R('refunds.payment_id', 'payments.id', 'CASCADE');
R('refunds.return_request_id', 'return_requests.id', 'SET NULL');

T('voucher_redemptions', 'Ghi nhận mỗi lần dùng voucher (1 voucher/đơn).', [
  col('id', 'BIGINT', 'pk auto'),
  col('voucher_id', 'BIGINT', 'not null'),
  col('user_id', 'BIGINT', ''),
  col('order_id', 'BIGINT', 'not null'),
  col('discount_amount', MONEY, 'not null'),
  col('redeemed_at', NOW, 'not null'),
], { uniques: [['voucher_id', 'order_id']], checks: ['discount_amount >= 0'] });
R('voucher_redemptions.voucher_id', 'vouchers.id', 'CASCADE');
R('voucher_redemptions.user_id', 'users.id', 'SET NULL');
R('voucher_redemptions.order_id', 'orders.id', 'CASCADE');

// ================================ ĐÁNH GIÁ ==================================
T('reviews', 'UNIQUE(user_id,product_id) — mỗi khách 1 đánh giá/sản phẩm; rating 1..5.', [
  col('id', 'BIGINT', 'pk auto'),
  col('product_id', 'BIGINT', 'not null'),
  col('user_id', 'BIGINT', 'not null'),
  col('order_id', 'BIGINT', '', 'đơn đã mua để xác minh'),
  col('rating', 'TINYINT', 'not null'),
  col('comment', 'TEXT'),
  col('media_url', 'VARCHAR(500)'),
  col('media_kind', "VARCHAR(10)", '', "'video'|'audio'"),
  col('status', "VARCHAR(20)", 'not null', "'pending'|'approved'|'rejected'"),
  col('created_at', NOW, 'not null'),
], { uniques: [['user_id', 'product_id']], checks: ['rating BETWEEN 1 AND 5'] });
R('reviews.product_id', 'products.id', 'RESTRICT');
R('reviews.user_id', 'users.id', 'CASCADE');
R('reviews.order_id', 'orders.id', 'SET NULL');

T('review_reactions', 'Hữu ích/không — mỗi khách 1 phản ứng/đánh giá.', [
  col('id', 'BIGINT', 'pk auto'),
  col('review_id', 'BIGINT', 'not null'),
  col('user_id', 'BIGINT', 'not null'),
  col('value', "VARCHAR(20)", 'not null', "'helpful'|'not_helpful'"),
  col('created_at', NOW, 'not null'),
], { uniques: [['review_id', 'user_id']] });
R('review_reactions.review_id', 'reviews.id', 'CASCADE');
R('review_reactions.user_id', 'users.id', 'CASCADE');

T('moderation_samples', 'Mẫu học kiểm duyệt bình luận.', [
  col('id', 'BIGINT', 'pk auto'),
  col('review_id', 'BIGINT', ''),
  col('label', 'VARCHAR(30)'),
  col('normalized_text', 'TEXT'),
  col('source', 'VARCHAR(30)'),
  col('created_at', NOW, 'not null'),
]);
R('moderation_samples.review_id', 'reviews.id', 'SET NULL');

// ============================ HÀNH VI / AI / THỬ ĐỒ =========================
T('interactions', 'Log hành vi thuần tuý cho AI gợi ý (wishlist/cart đã tách ra bảng riêng).', [
  col('id', 'BIGINT', 'pk auto'),
  col('user_id', 'BIGINT', ''),
  col('product_id', 'BIGINT', ''),
  col('type', "VARCHAR(30)", 'not null', "'view'|'search'|'cart'|'purchase'|'tryon'|'chat'|'goal'"),
  col('value', 'INT', 'not null'),
  col('created_at', NOW, 'not null'),
  col('source', 'VARCHAR(30)'),
]);
R('interactions.user_id', 'users.id', 'CASCADE');
R('interactions.product_id', 'products.id', 'SET NULL');

T('chats', 'Hội thoại trợ lý Ori.', [
  col('id', 'BIGINT', 'pk auto'),
  col('user_id', 'BIGINT', ''),
  col('role', "VARCHAR(20)", 'not null', "'user'|'assistant'"),
  col('message', 'TEXT'),
  col('created_at', NOW, 'not null'),
]);
R('chats.user_id', 'users.id', 'CASCADE');

T('chat_product_refs', 'Sản phẩm Ori gợi ý trong 1 câu trả lời.', [
  col('id', 'BIGINT', 'pk auto'),
  col('chat_id', 'BIGINT', 'not null'),
  col('product_id', 'BIGINT', ''),
]);
R('chat_product_refs.chat_id', 'chats.id', 'CASCADE');
R('chat_product_refs.product_id', 'products.id', 'SET NULL');

T('tryon_history', 'Lịch sử thử đồ ảo.', [
  col('id', 'BIGINT', 'pk auto'),
  col('user_id', 'BIGINT', ''),
  col('product_id', 'BIGINT', ''),
  col('engine', 'VARCHAR(190)'),
  col('created_at', NOW, 'not null'),
]);
R('tryon_history.user_id', 'users.id', 'CASCADE');
R('tryon_history.product_id', 'products.id', 'SET NULL');

T('tryon_accessories', 'Phụ kiện dùng kèm trong 1 lần thử đồ.', [
  col('id', 'BIGINT', 'pk auto'),
  col('tryon_id', 'BIGINT', 'not null'),
  col('product_id', 'BIGINT', ''),
]);
R('tryon_accessories.tryon_id', 'tryon_history.id', 'CASCADE');
R('tryon_accessories.product_id', 'products.id', 'SET NULL');

T('goals', 'Mục tiêu mua sắm/sức khoẻ (plan chi tiết lưu JSON).', [
  col('id', 'BIGINT', 'pk auto'),
  col('user_id', 'BIGINT', 'not null'),
  col('product_id', 'BIGINT', ''),
  col('monthly_income', MONEY),
  col('fixed_expenses', MONEY),
  col('current_savings', MONEY),
  col('target_months', 'INT'),
  col('plan', 'JSON'),
  col('created_at', NOW, 'not null'),
  col('updated_at', NOW),
]);
R('goals.user_id', 'users.id', 'CASCADE');
R('goals.product_id', 'products.id', 'SET NULL');

T('ai_descriptions', 'Mô tả sản phẩm do AI sinh (1 bản/sản phẩm).', [
  col('id', 'BIGINT', 'pk auto'),
  col('product_id', 'BIGINT', 'unique not null'),
  col('headline', 'VARCHAR(255)'),
  col('visual_summary', 'TEXT'),
  col('styling_tip', 'TEXT'),
  col('purchase_reason', 'TEXT'),
  col('confidence', 'VARCHAR(10)'),
  col('engine', 'VARCHAR(60)'),
  col('generated_at', NOW, 'not null'),
]);
R('ai_descriptions.product_id', 'products.id', 'CASCADE');

T('ai_description_details', 'Các gạch đầu dòng của mô tả AI.', [
  col('id', 'BIGINT', 'pk auto'),
  col('ai_description_id', 'BIGINT', 'not null'),
  col('detail', 'VARCHAR(500)', 'not null'),
]);
R('ai_description_details.ai_description_id', 'ai_descriptions.id', 'CASCADE');

// ============================ KHÁM PHÁ NHẬT BẢN =============================
T('flagcards', 'Thẻ địa danh (sưu tầm đủ bộ nhận voucher).', [
  col('id', 'BIGINT', 'pk auto'),
  col('slug', 'VARCHAR(80)', 'unique not null'),
  col('sort_order', 'INT'),
  col('title', 'VARCHAR(190)', 'not null'),
  col('japanese', 'VARCHAR(190)'),
  col('region', 'VARCHAR(120)'),
  col('summary', 'TEXT'),
  col('active', 'BOOLEAN', 'not null'),
]);

T('flagcard_facts', 'Fun-fact của thẻ.', [
  col('id', 'BIGINT', 'pk auto'),
  col('flagcard_id', 'BIGINT', 'not null'),
  col('fact', 'VARCHAR(255)', 'not null'),
]);
R('flagcard_facts.flagcard_id', 'flagcards.id', 'CASCADE');

T('flagcard_checkins', 'Điểm check-in gợi ý của thẻ.', [
  col('id', 'BIGINT', 'pk auto'),
  col('flagcard_id', 'BIGINT', 'not null'),
  col('name', 'VARCHAR(120)', 'not null'),
  col('tip', 'VARCHAR(255)'),
]);
R('flagcard_checkins.flagcard_id', 'flagcards.id', 'CASCADE');

T('flagcard_recommended_products', 'N–N thẻ ↔ sản phẩm gợi ý.', [
  col('id', 'BIGINT', 'pk auto'),
  col('flagcard_id', 'BIGINT', 'not null'),
  col('product_id', 'BIGINT', 'not null'),
], { uniques: [['flagcard_id', 'product_id']] });
R('flagcard_recommended_products.flagcard_id', 'flagcards.id', 'CASCADE');
R('flagcard_recommended_products.product_id', 'products.id', 'CASCADE');

T('flagcard_collections', 'Bộ sưu tập thẻ của khách.', [
  col('id', 'BIGINT', 'pk auto'),
  col('user_id', 'BIGINT', 'not null'),
  col('created_at', NOW, 'not null'),
  col('updated_at', NOW),
], { uniques: [['user_id']] });
R('flagcard_collections.user_id', 'users.id', 'CASCADE');

T('flagcard_collection_awards', 'Mỗi lần khách được tặng 1 thẻ (đơn đủ điều kiện).', [
  col('id', 'BIGINT', 'pk auto'),
  col('collection_id', 'BIGINT', 'not null'),
  col('flagcard_id', 'BIGINT', ''),
  col('order_id', 'BIGINT', ''),
  col('awarded_at', NOW, 'not null'),
  col('source', 'VARCHAR(40)'),
], { uniques: [['collection_id', 'flagcard_id']] });
R('flagcard_collection_awards.collection_id', 'flagcard_collections.id', 'CASCADE');
R('flagcard_collection_awards.flagcard_id', 'flagcards.id', 'SET NULL');
R('flagcard_collection_awards.order_id', 'orders.id', 'SET NULL');

T('japan_spot_reviews', 'Đánh giá địa điểm trong "Khám phá Nhật Bản" (rating 1..5).', [
  col('id', 'BIGINT', 'pk auto'),
  col('place', 'VARCHAR(190)', 'not null'),
  col('prefecture', 'VARCHAR(120)', 'not null'),
  col('user_id', 'BIGINT', ''),
  col('rating', 'TINYINT', 'not null'),
  col('comment', 'TEXT'),
  col('media_url', 'VARCHAR(500)'),
  col('media_kind', 'VARCHAR(10)'),
  col('created_at', NOW, 'not null'),
], { checks: ['rating BETWEEN 1 AND 5'] });
R('japan_spot_reviews.user_id', 'users.id', 'SET NULL');

T('japan_spot_suggestions', 'Khách đề xuất địa điểm mới cho hệ thống.', [
  col('id', 'BIGINT', 'pk auto'),
  col('prefecture', 'VARCHAR(120)', 'not null'),
  col('user_id', 'BIGINT', ''),
  col('suggestion', 'TEXT'),
  col('created_at', NOW, 'not null'),
]);
R('japan_spot_suggestions.user_id', 'users.id', 'SET NULL');

// ============================ THÔNG BÁO / BANNER / CẤU HÌNH =================
T('notifications', 'Thông báo đẩy cho khách.', [
  col('id', 'BIGINT', 'pk auto'),
  col('title', 'VARCHAR(255)'),
  col('body', 'TEXT'),
  col('type', 'VARCHAR(60)'),
  col('action', 'VARCHAR(120)'),
  col('reach', 'INT'),
  col('created_at', NOW, 'not null'),
]);

T('banners', 'Banner trang chủ.', [
  col('id', 'BIGINT', 'pk auto'),
  col('title', 'VARCHAR(190)'),
  col('image', 'VARCHAR(500)'),
  col('link', 'VARCHAR(255)'),
  col('active', 'BOOLEAN', 'not null'),
  col('sort_order', 'INT'),
]);

T('shop_settings', 'Cấu hình cửa hàng (singleton id=1).', [
  col('id', 'TINYINT', 'pk'),
  col('name', 'VARCHAR(150)'),
  col('hotline', 'VARCHAR(40)'),
  col('email', 'VARCHAR(150)'),
  col('address', 'VARCHAR(255)'),
  col('ship_fee', MONEY),
  col('cod', 'BOOLEAN'),
  col('stripe', 'BOOLEAN'),
  col('vnpay', 'BOOLEAN'),
  col('logo_url', 'VARCHAR(500)'),
]);

T('flagcard_config', 'Cấu hình chương trình Flagcard (singleton).', [
  col('id', 'TINYINT', 'pk'),
  col('active', 'BOOLEAN'),
  col('qualifying_order_min', MONEY),
  col('required_cards', 'INT'),
  col('reward_percent', 'INT'),
  col('reward_validity_days', 'INT'),
]);

T('integration_settings', 'Trạng thái tích hợp Mongo/Cloudinary/AI (singleton).', [
  col('id', 'TINYINT', 'pk'),
  col('mongo', 'BOOLEAN'),
  col('cloudinary', 'BOOLEAN'),
  col('ai', 'BOOLEAN'),
]);

// ============================================================================
// EMIT
// ============================================================================
const hasFlag = (c, f) => new RegExp(`(^|\\s)${f}(\\s|$)`).test(c.flags || '');
const pkCols = (t) => t.pk ? t.pk : t.cols.filter((c) => hasFlag(c, 'pk')).map((c) => c.name);

// ---------- DBML ----------
function emitDbml() {
  const L = [
    '// JAPANO — ERD v2 (đã chuẩn hoá) cho dbdiagram.io',
    '// Dán TOÀN BỘ nội dung file này vào ô soạn thảo BÊN TRÁI của dbdiagram.io.',
    '// Mỗi dòng "Ref:" là một dây nối từ khoá ngoại (FK) đến khoá chính (PK).',
    '',
  ];
  for (const t of tables) {
    L.push(`Table ${t.name} {`);
    for (const c of t.cols) {
      const s = [];
      if (hasFlag(c, 'pk') && (!t.pk)) s.push('pk');
      if (hasFlag(c, 'unique')) s.push('unique');
      if (hasFlag(c, 'not')) s.push('not null'); // "not null"
      if (c.note) s.push(`note: '${c.note.replace(/'/g, "\\'")}'`);
      L.push(`  ${c.name} ${c.type.toLowerCase()}${s.length ? ` [${s.join(', ')}]` : ''}`);
    }
    if (t.pk && t.pk.length > 1) L.push(`  indexes {\n    (${t.pk.join(', ')}) [pk]\n  }`);
    if (t.note) L.push(`  Note: '${t.note.replace(/'/g, "\\'")}'`);
    L.push('}', '');
  }
  L.push('// ---- Quan hệ (FK -> PK) ----');
  for (const r of refs) L.push(`Ref: ${r.from} > ${r.to}`);
  L.push('');
  return L.join('\n');
}

// ---------- SQL (MySQL) ----------
function emitSql(dialect) {
  const sqlite = dialect === 'sqlite';
  const L = [];
  L.push(`-- JAPANO — ERD v2 (DDL ${sqlite ? 'SQLite' : 'MySQL/MariaDB'}) — schema chuẩn hoá.`);
  if (sqlite) L.push('PRAGMA foreign_keys = OFF;');
  else { L.push('DROP DATABASE IF EXISTS `japano_v2`;', 'CREATE DATABASE `japano_v2` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;', 'USE `japano_v2`;', 'SET FOREIGN_KEY_CHECKS = 0;'); }
  L.push('');
  const q = (s) => '`' + s + '`';
  for (const t of tables) {
    const inner = [];
    const pk = pkCols(t);
    for (const c of t.cols) {
      let type = c.type;
      const isAuto = hasFlag(c, 'auto');
      let line;
      if (isAuto && sqlite) line = `${q(c.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
      else {
        line = `${q(c.name)} ${type}`;
        if (hasFlag(c, 'not')) line += ' NOT NULL';
        if (isAuto && !sqlite) line += ' AUTO_INCREMENT';
      }
      inner.push('  ' + line);
    }
    // PK (bỏ qua nếu đã inline AUTOINCREMENT cho sqlite)
    const autoPkInlineSqlite = sqlite && pk.length === 1 && t.cols.some((c) => c.name === pk[0] && hasFlag(c, 'auto'));
    if (pk.length && !autoPkInlineSqlite) inner.push(`  PRIMARY KEY (${pk.map(q).join(', ')})`);
    for (const c of t.cols) if (hasFlag(c, 'unique')) inner.push(`  UNIQUE (${q(c.name)})`);
    for (const u of (t.uniques || [])) inner.push(`  UNIQUE (${u.map(q).join(', ')})`);
    for (const ck of (t.checks || [])) inner.push(`  CHECK (${ck})`);
    for (const r of refs.filter((r) => r.from.split('.')[0] === t.name)) {
      const fromCol = r.from.split('.')[1];
      const [pt, pc] = r.to.split('.');
      inner.push(`  FOREIGN KEY (${q(fromCol)}) REFERENCES ${q(pt)}(${q(pc)}) ON UPDATE CASCADE ON DELETE ${r.onDelete}`);
    }
    L.push(`CREATE TABLE ${q(t.name)} (`);
    L.push(inner.join(',\n'));
    L.push(sqlite ? ');' : ') ENGINE=InnoDB;');
    L.push('');
  }
  L.push(sqlite ? 'PRAGMA foreign_keys = ON;' : 'SET FOREIGN_KEY_CHECKS = 1;');
  return L.join('\n');
}

fs.writeFileSync(path.join(ROOT, 'japano_schema_v2.sql'), emitSql('mysql'));
fs.writeFileSync(path.join(ROOT, 'japano_schema_v2_sqlite.sql'), emitSql('sqlite'));
console.log('Đã ghi japano_schema_v2.sql + japano_schema_v2_sqlite.sql (không ghi đè japano_erd.dbml hiện hành)');
console.log('Số bảng:', tables.length, '| Số quan hệ FK:', refs.length);
