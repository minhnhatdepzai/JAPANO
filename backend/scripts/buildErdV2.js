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

// ============================================================================
// LƯỢC ĐỒ QUAN HỆ JAPANO
//
// Quy tắc tách bảng (đây là chỗ bản trước làm sai — tách quá tay):
//   TÁCH  khi là thực thể nghiệp vụ độc lập, có nhiều dòng cho mỗi bản ghi cha
//         và có màn hình / API riêng   (Images, OrderItems, ReturnImages...)
//   GỘP   khi chỉ là thuộc tính nhiều giá trị của chính thực thể đó
//         (styles của profile, refs của chat, facts của flagcard...)
//   ĐỂ NGUYÊN cột snapshot: ShippingAddress / ProductName trong đơn hàng là bản
//         chụp lúc đặt, KHÔNG phải khoá ngoại — đơn cũ không được đổi theo.
// ============================================================================

// ============================== SẢN PHẨM ====================================
T('Categories', 'Danh mục có phân cấp cha–con (ParentID tự trỏ).', [
  col('CategoryID', 'BIGINT', 'pk auto'),
  col('CategoryName', 'VARCHAR(150)', 'not null'),
  col('Kanji', 'VARCHAR(40)'),
  col('Slug', 'VARCHAR(80)', 'unique not null'),
  col('Description', 'VARCHAR(255)'),
  col('ParentID', 'BIGINT'),
]);
R('Categories.ParentID', 'Categories.CategoryID', 'SET NULL');

T('Products', 'Sản phẩm. Rating/Sold tính từ Reviews/OrderItems, không lưu sẵn.', [
  col('ProductID', 'BIGINT', 'pk auto'),
  col('CategoryID', 'BIGINT', 'not null'),
  col('ProductName', 'VARCHAR(190)', 'not null'),
  col('Kanji', 'VARCHAR(40)'),
  col('Slug', 'VARCHAR(120)', 'unique not null'),
  col('Brand', 'VARCHAR(80)'),
  col('Price', MONEY, 'not null', 'giá niêm yết'),
  col('OldPrice', MONEY, '', 'giá gạch khi giảm'),
  col('Description', 'TEXT'),
  col('Story', 'TEXT'),
  col('Status', 'VARCHAR(20)', 'not null', "'draft' | 'published' | 'archived'"),
  col('CreatedAt', NOW, 'not null'),
], { checks: ['Price >= 0'] });
R('Products.CategoryID', 'Categories.CategoryID', 'RESTRICT');

T('Images', 'Ảnh sản phẩm (Cloudinary giữ file, DB giữ URL + thứ tự hiển thị).', [
  col('ImageID', 'BIGINT', 'pk auto'),
  col('ProductID', 'BIGINT', 'not null'),
  col('Url', 'VARCHAR(500)', 'not null'),
  col('Position', 'INT', 'not null'),
]);
R('Images.ProductID', 'Products.ProductID', 'CASCADE');

T('Colors', 'Bảng màu dùng chung cho mọi biến thể.', [
  col('ColorID', 'BIGINT', 'pk auto'),
  col('ColorName', 'VARCHAR(60)', 'not null'),
  col('ColorCode', 'VARCHAR(16)', '', 'mã hex #RRGGBB'),
]);

T('Sizes', 'Bảng size dùng chung (S, M, L, XL, ... 5XL).', [
  col('SizeID', 'BIGINT', 'pk auto'),
  col('SizeName', 'VARCHAR(20)', 'unique not null'),
  col('SortOrder', 'INT', 'not null'),
]);

T('ProductVariants', 'Màu × size của một sản phẩm — nơi duy nhất giữ tồn kho.', [
  col('VariantID', 'BIGINT', 'pk auto'),
  col('ProductID', 'BIGINT', 'not null'),
  col('ColorID', 'BIGINT', 'not null'),
  col('SizeID', 'BIGINT', 'not null'),
  col('SKU', 'VARCHAR(60)', 'unique not null'),
  col('Price', MONEY, '', 'để trống thì lấy Products.Price'),
  col('StockQuantity', 'INT', 'not null'),
  col('Reserved', 'INT', 'not null', 'đã giữ chỗ cho đơn chưa giao'),
  col('Status', 'VARCHAR(20)', 'not null'),
], { uniques: [['ProductID', 'ColorID', 'SizeID']], checks: ['StockQuantity >= 0', 'Reserved >= 0'] });
R('ProductVariants.ProductID', 'Products.ProductID', 'CASCADE');
R('ProductVariants.ColorID', 'Colors.ColorID', 'RESTRICT');
R('ProductVariants.SizeID', 'Sizes.SizeID', 'RESTRICT');

// ============================== TÀI KHOẢN ===================================
T('Users', 'Tài khoản. Mật khẩu băm bcrypt, không lưu bản rõ.', [
  col('UserID', 'BIGINT', 'pk auto'),
  col('FullName', 'VARCHAR(150)', 'not null'),
  col('Email', 'VARCHAR(190)', 'unique'),
  col('PasswordHash', 'VARCHAR(255)'),
  col('Phone', 'VARCHAR(40)'),
  col('Role', 'VARCHAR(20)', 'not null', "'customer' | 'staff' | 'super_admin'"),
  col('Status', 'VARCHAR(20)', 'not null', "'active' | 'locked'"),
  col('StripeCustomerID', 'VARCHAR(60)', '', 'để lưu thẻ đã thêm'),
  // Mã quên mật khẩu là quan hệ 1–1, mỗi user nhiều nhất một mã còn hiệu lực,
  // nên là HAI CỘT chứ không phải một bảng riêng (code lưu đúng như vậy).
  col('ResetCodeHash', 'VARCHAR(64)', '', 'mã đặt lại mật khẩu, lưu bản băm'),
  col('ResetCodeExpiresAt', NOW, '', 'mã hết hạn sau 15 phút'),
  col('CreatedAt', NOW, 'not null'),
]);

T('Addresses', 'Sổ địa chỉ: một khách lưu nhiều địa chỉ, một cái mặc định.', [
  col('AddressID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT', 'not null'),
  col('RecipientName', 'VARCHAR(150)', 'not null'),
  col('Phone', 'VARCHAR(40)', 'not null'),
  col('Street', 'VARCHAR(255)', 'not null'),
  col('Ward', 'VARCHAR(120)', '', 'phường/xã — VN bỏ cấp quận/huyện'),
  col('Province', 'VARCHAR(120)'),
  col('IsDefault', 'BOOLEAN', 'not null'),
]);
R('Addresses.UserID', 'Users.UserID', 'CASCADE');

T('Profiles', 'Khảo sát phong cách để gợi ý sản phẩm (1–1 với Users).', [
  col('ProfileID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT', 'unique not null'),
  col('Gender', 'VARCHAR(30)'),
  col('SkinTone', 'VARCHAR(60)'),
  col('Styles', 'VARCHAR(255)', '', 'các phong cách đã chọn'),
  col('Occasion', 'VARCHAR(120)'),
  col('Budget', MONEY),
  col('HeightCm', 'INT'),
  col('WeightKg', 'INT'),
  col('UsualSize', 'VARCHAR(20)'),
  col('UpdatedAt', NOW),
]);
R('Profiles.UserID', 'Users.UserID', 'CASCADE');

// ========================= GIỎ HÀNG & YÊU THÍCH =============================
T('CartItems', 'Giỏ hàng: mỗi dòng là một biến thể khách đang chọn.', [
  col('CartID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT', 'not null'),
  col('VariantID', 'BIGINT', 'not null'),
  col('Quantity', 'INT', 'not null'),
  col('AddedAt', NOW, 'not null'),
], { uniques: [['UserID', 'VariantID']], checks: ['Quantity > 0'] });
R('CartItems.UserID', 'Users.UserID', 'CASCADE');
R('CartItems.VariantID', 'ProductVariants.VariantID', 'CASCADE');

T('Wishlist', 'Sản phẩm khách đã thả tim.', [
  col('WishlistID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT', 'not null'),
  col('ProductID', 'BIGINT', 'not null'),
  col('CreatedAt', NOW, 'not null'),
], { uniques: [['UserID', 'ProductID']] });
R('Wishlist.UserID', 'Users.UserID', 'CASCADE');
R('Wishlist.ProductID', 'Products.ProductID', 'CASCADE');

// =============================== ĐƠN HÀNG ===================================
T('Orders', 'Đơn hàng. Địa chỉ/số điện thoại là bản chụp lúc đặt, không đổi sau.', [
  col('OrderID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT', '', 'NULL = khách vãng lai'),
  col('DiscountID', 'BIGINT'),
  col('PaymentID', 'BIGINT'),
  col('OrderCode', 'VARCHAR(40)', 'unique not null'),
  col('OrderDate', NOW, 'not null'),
  col('OrderStatus', 'VARCHAR(30)', 'not null', "'pending' → 'shipping' → 'done' | 'cancelled'"),
  col('RecipientName', 'VARCHAR(150)', 'not null'),
  col('PhoneNumber', 'VARCHAR(40)', 'not null'),
  col('ShippingAddress', 'VARCHAR(255)', 'not null'),
  col('Subtotal', MONEY, 'not null'),
  col('DiscountAmount', MONEY, 'not null'),
  col('ShippingFee', MONEY, 'not null'),
  col('TotalAmount', MONEY, 'not null'),
  col('Source', 'VARCHAR(30)', '', "'mobile' | 'admin'"),
  col('CancelReason', 'VARCHAR(255)'),
], { checks: ['TotalAmount >= 0', 'DiscountAmount >= 0'] });
R('Orders.UserID', 'Users.UserID', 'SET NULL');
R('Orders.DiscountID', 'DiscountCodes.DiscountID', 'SET NULL');
R('Orders.PaymentID', 'Payments.PaymentID', 'SET NULL');

T('OrderItems', 'Dòng hàng. Tên/màu/size là bản chụp — sản phẩm đổi tên thì đơn cũ giữ nguyên.', [
  col('OrderItemID', 'BIGINT', 'pk auto'),
  col('OrderID', 'BIGINT', 'not null'),
  col('VariantID', 'BIGINT', '', 'NULL nếu biến thể đã bị xoá'),
  col('ProductName', 'VARCHAR(190)', 'not null'),
  col('ColorName', 'VARCHAR(60)'),
  col('SizeName', 'VARCHAR(20)'),
  col('Quantity', 'INT', 'not null'),
  col('UnitPrice', MONEY, 'not null'),
  col('LineTotal', MONEY, 'not null'),
], { checks: ['Quantity > 0'] });
R('OrderItems.OrderID', 'Orders.OrderID', 'CASCADE');
R('OrderItems.VariantID', 'ProductVariants.VariantID', 'SET NULL');

T('Payments', 'Giao dịch thanh toán (COD / Stripe Test / VNPay Sandbox).', [
  col('PaymentID', 'BIGINT', 'pk auto'),
  col('PaymentMethod', 'VARCHAR(40)', 'not null', "'cod' | 'card' | 'bank'"),
  col('Provider', 'VARCHAR(20)', 'not null', "'cod' | 'stripe' | 'vnpay'"),
  col('PaymentStatus', 'VARCHAR(20)', 'not null', "'unpaid' | 'paid' | 'refunded'"),
  col('Amount', MONEY, 'not null'),
  col('Currency', 'VARCHAR(10)', 'not null'),
  col('TransactionID', 'VARCHAR(120)', '', 'mã giao dịch phía cổng'),
  col('PaidAt', NOW),
  col('CreatedAt', NOW, 'not null'),
]);

// =========================== KHUYẾN MÃI & VIP ===============================
T('DiscountCodes', 'Mã giảm giá khách tự nhập lúc đặt hàng.', [
  col('DiscountID', 'BIGINT', 'pk auto'),
  col('Code', 'VARCHAR(40)', 'unique not null'),
  col('DiscountType', 'VARCHAR(20)', 'not null', "'percent' | 'amount'"),
  col('DiscountValue', 'INT', 'not null'),
  col('MinOrderAmount', MONEY, 'not null'),
  col('MaxDiscountAmount', MONEY),
  col('UsageLimit', 'INT', '', 'tổng lượt dùng, NULL = không giới hạn'),
  col('UsedCount', 'INT', 'not null'),
  col('PerUserLimit', 'INT'),
  col('StartDate', NOW),
  col('ExpiryDate', NOW),
  col('Status', 'VARCHAR(20)', 'not null'),
  col('CreatedAt', NOW, 'not null'),
], { checks: ['DiscountValue > 0', 'UsedCount >= 0'] });

T('VipMemberships', 'Hạng VIP đạt được theo mức chi tiêu từng tháng.', [
  col('VipID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT', 'not null'),
  col('QualifyingPeriod', 'CHAR(7)', 'not null', 'tháng xét, dạng YYYY-MM'),
  col('QualifiedSpend', MONEY, 'not null'),
  col('Threshold', MONEY, 'not null'),
  col('DiscountPercent', 'INT', 'not null'),
  col('DiscountedUnits', 'INT', 'not null', 'số món được giảm mỗi đơn'),
  col('Status', 'VARCHAR(20)', 'not null', "'active' | 'expired'"),
  col('StartedAt', NOW, 'not null'),
  col('ExpiresAt', NOW, 'not null'),
], { uniques: [['UserID', 'QualifyingPeriod']] });
R('VipMemberships.UserID', 'Users.UserID', 'CASCADE');

// ========================= ĐỔI TRẢ & HOÀN TIỀN ==============================
T('ReturnRequests', 'Yêu cầu huỷ đơn hoặc trả hàng — phân biệt bằng cột Kind.', [
  col('ReturnID', 'BIGINT', 'pk auto'),
  col('OrderID', 'BIGINT', 'not null'),
  col('UserID', 'BIGINT'),
  col('PaymentID', 'BIGINT'),
  col('ReturnCode', 'VARCHAR(60)', 'unique not null'),
  col('Kind', 'VARCHAR(10)', 'not null', "'cancel' | 'return'"),
  col('ReturnStatus', 'VARCHAR(30)', 'not null', "'pending' | 'approved' | 'rejected' | 'refunded'"),
  col('Reason', 'VARCHAR(255)'),
  col('Note', 'TEXT'),
  col('Amount', MONEY, 'not null', 'số tiền phải hoàn'),
  col('CodManualRefund', 'BOOLEAN', 'not null', 'đơn COD phải hoàn tiền tay'),
  // Một yêu cầu trả hàng chỉ dẫn tới đúng một lần hoàn tiền, nên trạng thái hoàn
  // tiền là CỘT tại đây, không cần bảng Refunds riêng (code cũng không có).
  col('RefundedAt', NOW, '', 'thời điểm đã hoàn tiền xong'),
  col('CreatedAt', NOW, 'not null'),
  col('UpdatedAt', NOW),
]);
R('ReturnRequests.OrderID', 'Orders.OrderID', 'CASCADE');
R('ReturnRequests.UserID', 'Users.UserID', 'SET NULL');
R('ReturnRequests.PaymentID', 'Payments.PaymentID', 'SET NULL');

T('ReturnImages', 'Ảnh khách chụp làm bằng chứng khi trả hàng.', [
  col('ReturnImageID', 'BIGINT', 'pk auto'),
  col('ReturnID', 'BIGINT', 'not null'),
  col('Url', 'VARCHAR(500)', 'not null'),
  col('Position', 'INT', 'not null'),
]);
R('ReturnImages.ReturnID', 'ReturnRequests.ReturnID', 'CASCADE');

// =============================== ĐÁNH GIÁ ===================================
T('Reviews', 'Đánh giá sản phẩm — chỉ cho đánh giá khi đã mua (OrderID).', [
  col('ReviewID', 'BIGINT', 'pk auto'),
  col('ProductID', 'BIGINT', 'not null'),
  col('UserID', 'BIGINT', 'not null'),
  col('OrderID', 'BIGINT'),
  col('Rating', 'TINYINT', 'not null'),
  col('Comment', 'TEXT'),
  col('MediaUrl', 'VARCHAR(500)'),
  col('MediaKind', 'VARCHAR(10)', '', "'image' | 'video'"),
  col('ReviewStatus', 'VARCHAR(20)', 'not null', "'visible' | 'hidden' — lọc từ ngữ"),
  col('ReviewDate', NOW, 'not null'),
], { uniques: [['ProductID', 'UserID', 'OrderID']], checks: ['Rating BETWEEN 1 AND 5'] });
R('Reviews.ProductID', 'Products.ProductID', 'CASCADE');
R('Reviews.UserID', 'Users.UserID', 'CASCADE');
R('Reviews.OrderID', 'Orders.OrderID', 'SET NULL');

T('ReviewReactions', 'Bình chọn "đánh giá này hữu ích" — mỗi khách một lần.', [
  col('ReactionID', 'BIGINT', 'pk auto'),
  col('ReviewID', 'BIGINT', 'not null'),
  col('UserID', 'BIGINT', 'not null'),
  col('Value', 'VARCHAR(20)', 'not null', "'helpful' | 'not_helpful'"),
  col('CreatedAt', NOW, 'not null'),
], { uniques: [['ReviewID', 'UserID']] });
R('ReviewReactions.ReviewID', 'Reviews.ReviewID', 'CASCADE');
R('ReviewReactions.UserID', 'Users.UserID', 'CASCADE');

// ============================ HÀNH VI & AI ==================================
T('Interactions', 'Nhật ký hành vi (xem, thêm giỏ, mua) — đầu vào cho gợi ý.', [
  col('InteractionID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT'),
  col('ProductID', 'BIGINT'),
  col('Type', 'VARCHAR(30)', 'not null', "'view' | 'cart' | 'purchase' | 'search'"),
  col('Value', 'INT', 'not null', 'trọng số hành vi'),
  col('Source', 'VARCHAR(30)', '', 'màn hình phát sinh'),
  col('CreatedAt', NOW, 'not null'),
]);
R('Interactions.UserID', 'Users.UserID', 'SET NULL');
R('Interactions.ProductID', 'Products.ProductID', 'SET NULL');

T('AIChat', 'Hội thoại với trợ lý AI. IsClientSend phân biệt khách hay bot.', [
  col('ChatID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT'),
  col('Content', 'TEXT'),
  col('IsClientSend', 'BOOLEAN', 'not null'),
  col('CreatedAt', NOW, 'not null'),
]);
R('AIChat.UserID', 'Users.UserID', 'SET NULL');

T('AIDescriptions', 'Mô tả sản phẩm do AI sinh, lưu lại để khỏi gọi model mỗi lần.', [
  col('DescriptionID', 'BIGINT', 'pk auto'),
  col('ProductID', 'BIGINT', 'unique not null'),
  col('Headline', 'VARCHAR(255)'),
  col('VisualSummary', 'TEXT'),
  col('StylingTip', 'TEXT'),
  col('PurchaseReason', 'TEXT'),
  col('Confidence', 'VARCHAR(10)'),
  col('Engine', 'VARCHAR(60)', '', 'tên mô hình đã dùng'),
  col('GeneratedAt', NOW, 'not null'),
]);
R('AIDescriptions.ProductID', 'Products.ProductID', 'CASCADE');

T('TryOnHistory', 'Lịch sử thử đồ ảo (ghép ảnh khách với sản phẩm).', [
  col('TryOnID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT'),
  col('ProductID', 'BIGINT'),
  col('Engine', 'VARCHAR(190)'),
  col('ResultUrl', 'VARCHAR(500)'),
  col('CreatedAt', NOW, 'not null'),
]);
R('TryOnHistory.UserID', 'Users.UserID', 'SET NULL');
R('TryOnHistory.ProductID', 'Products.ProductID', 'SET NULL');

T('Goals', 'Kế hoạch tiết kiệm để mua một sản phẩm.', [
  col('GoalID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT', 'not null'),
  col('ProductID', 'BIGINT'),
  col('MonthlyIncome', MONEY),
  col('FixedExpenses', MONEY),
  col('CurrentSavings', MONEY),
  col('TargetMonths', 'INT'),
  col('MonthlySaving', MONEY, '', 'số tiền cần để dành mỗi tháng'),
  col('CreatedAt', NOW, 'not null'),
]);
R('Goals.UserID', 'Users.UserID', 'CASCADE');
R('Goals.ProductID', 'Products.ProductID', 'SET NULL');

// =============================== FLAGCARD ===================================
T('Flagcards', 'Thẻ tỉnh thành Nhật Bản khách sưu tầm được khi mua hàng.', [
  col('FlagcardID', 'BIGINT', 'pk auto'),
  col('Slug', 'VARCHAR(80)', 'unique not null'),
  col('Title', 'VARCHAR(190)', 'not null'),
  col('Japanese', 'VARCHAR(190)'),
  col('Region', 'VARCHAR(120)'),
  col('Summary', 'TEXT'),
  col('SortOrder', 'INT'),
  col('Active', 'BOOLEAN', 'not null'),
]);

// Bảng này giữ tiến độ sưu tầm của khách: mốc hoàn thành bộ thẻ và mã voucher
// thưởng khi đủ bộ — có dữ liệu riêng nên không gộp thẳng vào Users được.
T('FlagcardCollections', 'Bộ sưu tập thẻ của một khách (1–1 với Users).', [
  col('CollectionID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT', 'unique not null'),
  col('CompletedAt', NOW, '', 'lúc sưu tầm đủ bộ thẻ'),
  col('RewardVoucherCode', 'VARCHAR(40)', '', 'mã giảm giá thưởng khi đủ bộ'),
  col('CreatedAt', NOW, 'not null'),
  col('UpdatedAt', NOW),
]);
R('FlagcardCollections.UserID', 'Users.UserID', 'CASCADE');

T('FlagcardAwards', 'Một lần khách nhận được thẻ, kèm đơn hàng đã kích hoạt.', [
  col('AwardID', 'BIGINT', 'pk auto'),
  col('CollectionID', 'BIGINT', 'not null'),
  col('FlagcardID', 'BIGINT'),
  col('OrderID', 'BIGINT'),
  col('AwardedAt', NOW, 'not null'),
  col('Source', 'VARCHAR(40)', '', "'order' | 'admin'"),
]);
R('FlagcardAwards.CollectionID', 'FlagcardCollections.CollectionID', 'CASCADE');
R('FlagcardAwards.FlagcardID', 'Flagcards.FlagcardID', 'SET NULL');
R('FlagcardAwards.OrderID', 'Orders.OrderID', 'SET NULL');

// ========================= ĐỊA ĐIỂM NHẬT BẢN ================================
T('JapanSpotReviews', 'Khách đánh giá địa điểm du lịch Nhật Bản.', [
  col('SpotReviewID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT'),
  col('Place', 'VARCHAR(190)', 'not null'),
  col('Prefecture', 'VARCHAR(120)', 'not null'),
  col('Rating', 'TINYINT', 'not null'),
  col('Comment', 'TEXT'),
  col('MediaUrl', 'VARCHAR(500)'),
  col('ReviewStatus', 'VARCHAR(20)', 'not null'),
  col('CreatedAt', NOW, 'not null'),
], { checks: ['Rating BETWEEN 1 AND 5'] });
R('JapanSpotReviews.UserID', 'Users.UserID', 'SET NULL');

T('JapanSpotSuggestions', 'Khách đề xuất thêm địa điểm cho một tỉnh.', [
  col('SuggestionID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT'),
  col('Prefecture', 'VARCHAR(120)', 'not null'),
  col('Suggestion', 'TEXT'),
  col('CreatedAt', NOW, 'not null'),
]);
R('JapanSpotSuggestions.UserID', 'Users.UserID', 'SET NULL');

// ============================ HỆ THỐNG ======================================
T('Notifications', 'Thông báo. UserID NULL = gửi toàn bộ khách hàng.', [
  col('NotificationID', 'BIGINT', 'pk auto'),
  col('UserID', 'BIGINT'),
  col('Title', 'VARCHAR(255)'),
  col('Content', 'TEXT'),
  col('Type', 'VARCHAR(60)', '', "'order' | 'promo' | 'system'"),
  col('Action', 'VARCHAR(120)', '', 'màn hình mở khi bấm vào'),
  col('IsRead', 'BOOLEAN', 'not null'),
  col('CreatedAt', NOW, 'not null'),
]);
R('Notifications.UserID', 'Users.UserID', 'CASCADE');

T('Banners', 'Ảnh quảng cáo trên trang chủ ứng dụng.', [
  col('BannerID', 'BIGINT', 'pk auto'),
  col('Title', 'VARCHAR(190)'),
  col('Image', 'VARCHAR(500)'),
  col('Link', 'VARCHAR(255)'),
  col('Active', 'BOOLEAN', 'not null'),
  col('SortOrder', 'INT'),
]);

T('ShopSettings', 'Cấu hình cửa hàng — bảng chỉ có đúng một dòng.', [
  col('SettingID', 'TINYINT', 'pk'),
  col('ShopName', 'VARCHAR(150)'),
  col('Hotline', 'VARCHAR(40)'),
  col('Email', 'VARCHAR(150)'),
  col('Address', 'VARCHAR(255)'),
  col('ShipFee', MONEY),
  col('Cod', 'BOOLEAN', '', 'bật thanh toán khi nhận'),
  col('Stripe', 'BOOLEAN'),
  col('Vnpay', 'BOOLEAN'),
  col('LogoUrl', 'VARCHAR(500)'),
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

// ---------- draw.io (mxGraph XML) ----------
// Sinh sơ đồ ERD dán thẳng vào https://app.diagrams.net (Extras > Edit Diagram,
// hoặc File > Open). Mỗi bảng là shape=table gốc của draw.io: cột trái là huy
// hiệu PK / FK1 / FK2, cột phải là tên thuộc tính (PK gạch chân, không in kiểu
// dữ liệu — kiểu nằm ở tooltip). Mỗi FK là một dây chân quạ nối từ
// đúng DÒNG khoá ngoại sang đúng DÒNG khoá chính.

// Cụm nghiệp vụ chỉ dùng để TÔ MÀU, không quyết định vị trí. Vị trí do thuật
// toán xếp tầng bên dưới quyết định, nếu không thì các bảng trục (users,
// products, orders) bị hàng chục bảng ở cột xa trỏ về và dây cắt nhau loạn xạ.
const GROUPS = [
  { name: 'Sản phẩm', fill: '#d5e8d4', stroke: '#82b366', tables: ['Categories', 'Products', 'Images', 'Colors', 'Sizes', 'ProductVariants'] },
  { name: 'Tài khoản', fill: '#dae8fc', stroke: '#6c8ebf', tables: ['Users', 'Addresses', 'Profiles'] },
  { name: 'Giỏ hàng & Yêu thích', fill: '#ffe6cc', stroke: '#d79b00', tables: ['CartItems', 'Wishlist'] },
  { name: 'Đơn hàng', fill: '#f8cecc', stroke: '#b85450', tables: ['Orders', 'OrderItems', 'Payments'] },
  { name: 'Khuyến mãi & VIP', fill: '#fff2cc', stroke: '#d6b656', tables: ['DiscountCodes', 'VipMemberships'] },
  { name: 'Đổi trả & Hoàn tiền', fill: '#e1d5e7', stroke: '#9673a6', tables: ['ReturnRequests', 'ReturnImages'] },
  { name: 'Đánh giá', fill: '#ffd9b3', stroke: '#d79b00', tables: ['Reviews', 'ReviewReactions'] },
  { name: 'Hành vi & AI', fill: '#d0f0e0', stroke: '#4d9e7f', tables: ['Interactions', 'AIChat', 'AIDescriptions', 'TryOnHistory', 'Goals'] },
  { name: 'Flagcard', fill: '#ffcccc', stroke: '#cc6666', tables: ['Flagcards', 'FlagcardCollections', 'FlagcardAwards'] },
  { name: 'Địa điểm Nhật Bản', fill: '#cce5ff', stroke: '#3d85c6', tables: ['JapanSpotReviews', 'JapanSpotSuggestions'] },
  { name: 'Hệ thống', fill: '#f5f5f5', stroke: '#999999', tables: ['Notifications', 'Banners', 'ShopSettings'] },
];

const TABLE_W = 250;   // bề ngang một bảng (hẹp lại vì không in kiểu dữ liệu)
const BADGE_W = 54;    // cột huy hiệu PK / FK1 / FK2
const HEAD_H = 34;     // ô tiêu đề tên bảng
const ROW_H = 26;      // chiều cao một dòng thuộc tính
const COL_GAP = 260;   // hành lang ngang giữa hai tầng (chỗ cho dây chạy dọc)
const ROW_GAP = 60;    // khoảng cách dọc giữa hai bảng cùng tầng
const LANE_H = 14;     // bề dày một "làn" dành cho dây dài đi xuyên tầng
const LANE_GAP = 26;   // khoảng cách dọc quanh một làn
const TOP = 330;       // chừa chỗ cho khung chú giải + nhãn tầng
const LEFT = 60;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, '_').toLowerCase();
const idOf = (page, t) => `p${page}_tbl_${t}`;
const rowIdOf = (page, t, c) => `p${page}_row_${t}_${c}`;

const moduleOf = new Map();
for (const g of GROUPS) for (const n of g.tables) moduleOf.set(n, g);
const groupOf = (name) => moduleOf.get(name) || GROUPS[GROUPS.length - 1];

// Danh sách quan hệ đã tách sẵn bảng con / bảng cha / tên cột.
const relations = refs.map((r, index) => {
  const [child, childCol] = r.from.split('.');
  const [parent, parentCol] = r.to.split('.');
  return { index, child, childCol, parent, parentCol };
}).filter((e) => tables.some((t) => t.name === e.child) && tables.some((t) => t.name === e.parent));

const tableHeight = (t, cols) => HEAD_H + (cols || t.cols).length * ROW_H;

// ============================================================================
// BỐ CỤC PHÂN TẦNG (thuật toán Sugiyama rút gọn)
//
// Bản vẽ trước xếp bảng theo cụm nghiệp vụ, nên các bảng trục (users, products,
// orders) bị hàng chục bảng ở cột xa trỏ về => dây cắt nhau chằng chịt. Bản này
// xếp lại theo 4 bước:
//   1. TẦNG: bảng con luôn nằm bên PHẢI mọi bảng cha của nó, nên mọi dây chảy
//      một chiều trái → phải, không dây nào vòng ngược ra sau lưng bảng.
//   2. LÀN: dây nào nhảy qua hơn một tầng thì được cấp một "làn" trống trong mỗi
//      tầng nó phải băng qua. Làn chiếm chỗ thật trong cột nên dây luồn giữa hai
//      bảng chứ không đè lên bảng.
//   3. BARYCENTER: lặp nhiều vòng, sắp lại thứ tự dọc trong từng tầng sao cho
//      mỗi bảng trôi về ngang tầm ĐÚNG DÒNG KHOÁ mà nó nối tới.
//   4. HOÁN VỊ: thử đổi chỗ từng cặp kề nhau, chỉ giữ lại nếu số cặp dây cắt
//      nhau (đo thật bằng hình học trên đường đi thực của dây) giảm xuống.
// ============================================================================
function layout(entities, edges) {
  const names = [...entities.keys()];
  const heightOf = (n) => tableHeight(entities.get(n).table, entities.get(n).cols);
  const real = edges.filter((e) => e.child !== e.parent);

  // --- bước 1: xếp tầng ---
  const parentsOf = new Map();
  const linked = new Set();
  for (const e of edges) {
    linked.add(e.child);
    linked.add(e.parent);
    if (e.child === e.parent) continue;
    if (!parentsOf.has(e.child)) parentsOf.set(e.child, []);
    parentsOf.get(e.child).push(e.parent);
  }
  const depth = new Map();
  const busy = new Set();
  const depthOf = (name) => {
    if (depth.has(name)) return depth.get(name);
    if (busy.has(name)) return 0; // chặn đệ quy vô hạn nếu lỡ có FK vòng tròn
    busy.add(name);
    const parents = (parentsOf.get(name) || []).filter((p) => entities.has(p));
    const value = parents.length ? Math.max(...parents.map(depthOf)) + 1 : 0;
    busy.delete(name);
    depth.set(name, value);
    return value;
  };
  names.forEach(depthOf);

  const lonely = names.filter((n) => !linked.has(n));
  const tableNodes = new Map();
  const layers = [];
  for (const n of names) {
    if (!linked.has(n)) continue;
    const node = { kind: 'table', name: n, h: heightOf(n) };
    tableNodes.set(n, node);
    const d = depth.get(n);
    (layers[d] ||= []).push(node);
  }
  for (let i = 0; i < layers.length; i += 1) layers[i] ||= [];

  // --- bước 2: cấp làn cho dây nhảy nhiều tầng ---
  const lanesOf = new Map(); // chỉ số quan hệ -> [làn tầng c-1, c-2, ... p+1]
  for (const e of real) {
    const c = depth.get(e.child);
    const p = depth.get(e.parent);
    const lanes = [];
    for (let L = c - 1; L > p; L -= 1) {
      const lane = { kind: 'lane', h: LANE_H, layer: L, edge: e };
      layers[L].push(lane);
      lanes.push(lane);
    }
    lanesOf.set(e.index, lanes);
  }

  // --- xếp toạ độ ---
  const columnX = (i) => LEFT + i * (TABLE_W + COL_GAP);
  const corridorX = (i) => columnX(i) - COL_GAP / 2; // hành lang ngay bên TRÁI tầng i
  const gapBetween = (a, b) => (a.kind === 'lane' || b.kind === 'lane' ? LANE_GAP : ROW_GAP);
  const columnHeight = (list) => list.reduce((sum, n, k) => sum + n.h + (k ? gapBetween(list[k - 1], n) : 0), 0);
  let tallest = Math.max(0, ...layers.map(columnHeight));
  const restack = (i) => {
    const list = layers[i];
    let y = TOP + (tallest - columnHeight(list)) / 2;
    list.forEach((n, k) => {
      if (k) y += gapBetween(list[k - 1], n);
      n.x = columnX(i);
      n.y = y;
      y += n.h;
    });
  };
  layers.forEach((_, i) => restack(i));

  const portOffset = (name, col) => {
    const cols = entities.get(name).cols;
    const i = cols.findIndex((c) => c.name === col);
    return HEAD_H + (i < 0 ? 0 : i) * ROW_H + ROW_H / 2;
  };
  const portY = (name, col) => tableNodes.get(name).y + portOffset(name, col);

  // Chuỗi điểm dừng của một dây: cổng trên bảng con → các làn → cổng trên bảng cha.
  const stopsOf = (e) => [
    { kind: 'port', table: e.child, col: e.childCol },
    ...lanesOf.get(e.index).map((lane) => ({ kind: 'lane', node: lane })),
    { kind: 'port', table: e.parent, col: e.parentCol },
  ];
  const nodeOfStop = (s) => (s.kind === 'port' ? tableNodes.get(s.table) : s.node);
  const yOfStop = (s) => (s.kind === 'port' ? portY(s.table, s.col) : s.node.y + s.node.h / 2);
  const offsetOfStop = (s) => (s.kind === 'port' ? portOffset(s.table, s.col) : s.node.h / 2);

  const neighbours = new Map();
  for (const e of real) {
    const stops = stopsOf(e);
    for (let k = 0; k + 1 < stops.length; k += 1) {
      for (const [a, b] of [[stops[k], stops[k + 1]], [stops[k + 1], stops[k]]]) {
        const node = nodeOfStop(a);
        if (!node) continue;
        if (!neighbours.has(node)) neighbours.set(node, []);
        neighbours.get(node).push({ self: a, other: b });
      }
    }
  }

  // Mỗi dây, khi đi từ tầng con về tầng cha, phải chạy DỌC một lần trong từng
  // hành lang nó băng qua. Nếu mọi đoạn dọc đều nằm đúng giữa hành lang thì
  // chúng đè chồng lên nhau — đúng cái lỗi cần tránh. Nên mỗi đoạn dọc được cấp
  // một RÃNH riêng: tô màu kiểu đồ thị khoảng (interval graph) — hai đoạn có
  // khoảng y rời nhau thì dùng chung rãnh, chồng khoảng y thì phải tách rãnh.
  const verticalRuns = () => {
    const perCorridor = new Map();
    for (const e of real) {
      const c = depth.get(e.child);
      const p = depth.get(e.parent);
      const lanes = lanesOf.get(e.index);
      let y = portY(e.child, e.childCol);
      for (let L = c; L > p; L -= 1) {
        const lane = lanes[c - L];
        const nextY = L - 1 > p ? lane.y + lane.h / 2 : portY(e.parent, e.parentCol);
        if (!perCorridor.has(L)) perCorridor.set(L, []);
        perCorridor.get(L).push({
          key: `${e.index}@${L}`,
          y0: Math.min(y, nextY),
          y1: Math.max(y, nextY),
          terminating: L - 1 === p, // đoạn dọc cuối, ngay sau đó là cắm vào bảng cha
        });
        y = nextY;
      }
    }
    return perCorridor;
  };
  // Rãnh số 0 nằm sát cột BÊN TRÁI (phía bảng cha). Thứ tự xét ảnh hưởng tới số
  // chỗ cắt nên thử vài kiểu rồi giữ kiểu tốt nhất (xem cuối hàm layout).
  const CHANNEL_MODES = ['y', 'ket-thuc-truoc', 'ket-thuc-sau'];
  const assignChannels = (mode) => {
    const x = new Map();
    for (const [L, runs] of verticalRuns()) {
      runs.sort((a, b) => {
        if (mode === 'ket-thuc-truoc' && a.terminating !== b.terminating) return a.terminating ? -1 : 1;
        if (mode === 'ket-thuc-sau' && a.terminating !== b.terminating) return a.terminating ? 1 : -1;
        return a.y0 - b.y0;
      });
      const busyUntil = [];
      for (const run of runs) {
        let k = busyUntil.findIndex((end) => end <= run.y0 - 4);
        if (k < 0) { k = busyUntil.length; busyUntil.push(-Infinity); }
        busyUntil[k] = run.y1;
        run.channel = k;
      }
      const step = COL_GAP / (busyUntil.length + 1);
      const leftEdge = columnX(L) - COL_GAP; // mép phải của cột bên trái
      for (const run of runs) x.set(run.key, leftEdge + (run.channel + 1) * step);
    }
    return x;
  };

  // Đường đi thật của dây (dùng cả để đếm giao cắt lẫn để xuất waypoint).
  const polyline = (e, channelX) => {
    const child = tableNodes.get(e.child);
    const parent = tableNodes.get(e.parent);
    const by = portY(e.parent, e.parentCol);
    const bx = parent.x + TABLE_W;
    const c = depth.get(e.child);
    const p = depth.get(e.parent);
    const lanes = lanesOf.get(e.index);
    const points = [[child.x, portY(e.child, e.childCol)]];
    for (let L = c; L > p; L -= 1) {
      const x = channelX.get(`${e.index}@${L}`) ?? corridorX(L);
      const lane = lanes[c - L];
      const nextY = L - 1 > p ? lane.y + lane.h / 2 : by;
      points.push([x, points[points.length - 1][1]]); // ngang ra rãnh của mình
      points.push([x, nextY]);                        // dọc theo rãnh
    }
    points.push([bx, by]);                            // ngang vào dòng khoá chính
    return points;
  };
  const segmentsOf = (points) => points.slice(1).map((p, i) => [points[i][0], points[i][1], p[0], p[1]]);
  const hits = (p, q) => {
    const d = (p[2] - p[0]) * (q[3] - q[1]) - (p[3] - p[1]) * (q[2] - q[0]);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((q[0] - p[0]) * (q[3] - q[1]) - (q[1] - p[1]) * (q[2] - q[0])) / d;
    const u = ((q[0] - p[0]) * (p[3] - p[1]) - (q[1] - p[1]) * (p[2] - p[0])) / d;
    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
  };
  // Đếm trên ĐÚNG hình học sẽ xuất ra file (đã cấp rãnh), nên con số này là số
  // chỗ giao cắt thật sự nhìn thấy trên bản vẽ. Bỏ qua các cặp dây chung một
  // đầu (cùng đổ về một dòng khoá chính, hoặc cùng ra từ một dòng khoá ngoại):
  // chúng chụm lại thành hình rẻ quạt, mắt người đọc vẫn theo được, không phải
  // lỗi bố cục — tính vào thì thuật toán sẽ tối ưu nhầm mục tiêu.
  const sameEnd = (a, b) => (a.parent === b.parent && a.parentCol === b.parentCol)
    || (a.child === b.child && a.childCol === b.childCol);
  const crossings = (mode = 'y') => {
    const channelX = assignChannels(mode);
    const all = real.map((e) => segmentsOf(polyline(e, channelX)));
    let n = 0;
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        if (sameEnd(real[i], real[j])) continue;
        if (all[i].some((s) => all[j].some((s2) => hits(s, s2)))) n += 1;
      }
    }
    return n;
  };

  // --- bước 3: barycenter theo đúng dòng khoá ---
  for (let pass = 0; pass < 12; pass += 1) {
    const order = pass % 2 === 0
      ? layers.map((_, i) => i)
      : layers.map((_, i) => layers.length - 1 - i);
    for (const i of order) {
      const key = new Map();
      for (const node of layers[i]) {
        const list = neighbours.get(node) || [];
        // Mốc mong muốn = vị trí mép trên để dòng khoá của nó thẳng hàng với đầu kia.
        key.set(node, list.length
          ? list.reduce((sum, p) => sum + (yOfStop(p.other) - offsetOfStop(p.self)), 0) / list.length
          : node.y);
      }
      layers[i].sort((a, b) => key.get(a) - key.get(b));
      restack(i);
    }
  }

  // --- bước 4: hoán vị cặp kề nhau, chỉ giữ nếu bớt dây cắt ---
  // Chấm điểm bằng kiểu xếp rãnh tốt nhất trong ba kiểu, để bước hoán vị không
  // tối ưu theo một cách đi dây mà cuối cùng lại không dùng.
  const score = () => Math.min(...CHANNEL_MODES.map(crossings));
  let best = score();
  for (let pass = 0; pass < 6; pass += 1) {
    let improved = false;
    for (let i = 0; i < layers.length; i += 1) {
      for (let k = 0; k + 1 < layers[i].length; k += 1) {
        const list = layers[i];
        [list[k], list[k + 1]] = [list[k + 1], list[k]];
        restack(i);
        const next = score();
        if (next < best) { best = next; improved = true; } else {
          [list[k], list[k + 1]] = [list[k + 1], list[k]];
          restack(i);
        }
      }
    }
    if (!improved) break;
  }

  // --- vị trí cuối cùng ---
  const place = new Map();
  for (const [name, node] of tableNodes) place.set(name, { x: node.x, y: node.y });
  const columns = layers.map((list) => list.filter((n) => n.kind === 'table').length);
  if (lonely.length) {
    const i = layers.length;
    let y = TOP;
    for (const n of lonely) {
      place.set(n, { x: columnX(i), y });
      y += heightOf(n) + ROW_GAP;
    }
    columns.push(lonely.length);
  }

  // Chốt kiểu xếp rãnh: thử cả ba, giữ kiểu ít chỗ cắt nhất.
  const bestMode = CHANNEL_MODES
    .map((mode) => ({ mode, score: crossings(mode) }))
    .sort((a, b) => a.score - b.score)[0];
  best = bestMode.score;
  const finalChannels = assignChannels(bestMode.mode);
  const waypoints = new Map();
  for (const e of real) waypoints.set(e.index, polyline(e, finalChannels).slice(1, -1));

  return {
    place,
    columns,
    lonelyCount: lonely.length,
    crossings: best,
    laneCount: [...lanesOf.values()].reduce((n, l) => n + l.length, 0),
    waypoints,
  };
}

// ============================================================================
// VẼ
// ============================================================================
function tableCells(page, name, entity, x, y) {
  const { table, cols } = entity;
  const g = groupOf(name);
  const pk = new Set(pkCols(table));
  const fk = new Set(relations.filter((e) => e.child === name).map((e) => e.childCol));
  const out = [];
  const title = entity.external ? `${name}  ⟵ ${g.name}` : name;
  const frame = entity.external
    ? `strokeColor=${g.stroke};fillColor=${g.fill};swimlaneFillColor=#fbfbfb;dashed=1;opacity=75;`
    : `strokeColor=${g.stroke};fillColor=${g.fill};swimlaneFillColor=#ffffff;`;

  out.push(`        <mxCell id="${idOf(page, name)}" value="${esc(title)}" style="shape=table;startSize=${HEAD_H};container=1;collapsible=1;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;fontSize=14;align=center;resizeLast=1;html=1;${frame}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${TABLE_W}" height="${tableHeight(table, cols)}" as="geometry" />
        </mxCell>`);

  // Đánh số FK1, FK2, FK3... theo đúng thứ tự cột trong bảng GỐC (không phải theo
  // danh sách cột đang hiển thị), để một bảng vẽ ở nhiều trang vẫn giữ nguyên số.
  const fkNo = new Map();
  table.cols.forEach((c) => { if (fk.has(c.name)) fkNo.set(c.name, fkNo.size + 1); });

  const lastPkIndex = cols.reduce((last, c, i) => (pk.has(c.name) ? i : last), -1);

  cols.forEach((c, i) => {
    const isPk = pk.has(c.name);
    const isFk = fk.has(c.name);
    // Ký hiệu chuẩn: PK ở trên, khoá ngoại đánh số FK1/FK2; cột vừa là PK vừa là
    // FK (bảng nối) ghi "PK,FK1".
    const badge = [isPk ? 'PK' : '', isFk ? `FK${fkNo.get(c.name)}` : ''].filter(Boolean).join(',');
    // Tên khoá chính gạch chân — quy ước ERD, không in kiểu dữ liệu ở đây nữa.
    const label = esc(isPk ? `<u>${esc(c.name)}</u>` : esc(c.name));
    // Kiểu dữ liệu + ràng buộc chuyển xuống tooltip, xem bằng cách rê chuột.
    const notNull = hasFlag(c, 'not') || isPk;
    const uniq = hasFlag(c, 'unique') || (table.uniques || []).some((u) => u.length === 1 && u[0] === c.name);
    const tip = esc([c.type, notNull ? 'NOT NULL' : 'NULL', uniq ? 'UNIQUE' : '', c.note].filter(Boolean).join(' · '));
    // Kẻ đường ngang dưới nhóm khoá chính, và đường dọc ngăn cột huy hiệu.
    const underPk = i === lastPkIndex ? 'bottom=1;' : 'bottom=0;';
    const rid = rowIdOf(page, name, c.name);
    out.push(`        <mxCell id="${rid}" value="" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;collapsible=0;dropTarget=0;points=[[0,0.5,0,0,0],[1,0.5,0,0,0]];portConstraint=eastwest;top=0;left=0;right=0;bottom=0;" vertex="1" parent="${idOf(page, name)}">
          <mxGeometry y="${HEAD_H + i * ROW_H}" width="${TABLE_W}" height="${ROW_H}" as="geometry" />
        </mxCell>
        <mxCell id="${rid}_b" value="${badge}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;right=1;${underPk}fontSize=10;fontStyle=1;fontColor=${isPk ? '#b85450' : '#6c8ebf'};align=center;overflow=hidden;whiteSpace=wrap;html=1;" vertex="1" parent="${rid}">
          <mxGeometry width="${BADGE_W}" height="${ROW_H}" as="geometry" />
        </mxCell>
        <mxCell id="${rid}_n" value="${label}" tooltip="${tip}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;right=0;${underPk}fontSize=12;align=left;spacingLeft=8;overflow=hidden;whiteSpace=wrap;html=1;" vertex="1" parent="${rid}">
          <mxGeometry x="${BADGE_W}" width="${TABLE_W - BADGE_W}" height="${ROW_H}" as="geometry" />
        </mxCell>`);
  });
  return out;
}

// Ký hiệu chân quạ: đầu bảng CON mang chân quạ (0..N dòng con), đầu bảng CHA mang
// gạch "đúng một" nếu FK NOT NULL, hoặc vòng tròn "0..1" nếu FK cho phép NULL.
// FK có ràng buộc UNIQUE thì quan hệ là 1–1 nên đầu con cũng chỉ là "0..1".
function edgeCell(page, e, entities, waypoints) {
  const child = entities.get(e.child).table;
  const c = child.cols.find((cc) => cc.name === e.childCol);
  const nullable = !(c && (hasFlag(c, 'not') || pkCols(child).includes(e.childCol)));
  const oneToOne = Boolean(c && hasFlag(c, 'unique'))
    || (child.uniques || []).some((u) => u.length === 1 && u[0] === e.childCol);
  const startArrow = oneToOne ? 'ERzeroToOne' : nullable ? 'ERzeroToMany' : 'ERoneToMany';
  const endArrow = nullable ? 'ERzeroToOne' : 'ERmandOne';
  const selfRef = e.child === e.parent;
  // Nhờ bố cục phân tầng, bảng cha luôn nằm bên trái bảng con nên ghim cứng được
  // cổng: dây rời cạnh TRÁI bảng con và vào cạnh PHẢI bảng cha. jumpStyle=arc vẽ
  // cầu vượt tại chỗ hai dây buộc phải cắt nhau cho đỡ rối mắt.
  const ports = selfRef ? '' : 'exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=1;entryY=0.5;entryDx=0;entryDy=0;';
  // Khi đã có waypoint thì KHÔNG giao cho bộ định tuyến của draw.io nữa: các điểm
  // truyền vào chính là các góc vuông đã tính sẵn, nối thẳng qua chúng là ra đúng
  // đường bậc thang mong muốn. Giao cho router thì nó tự bẻ lại và hỏng bố cục.
  const router = waypoints ? '' : 'edgeStyle=entityRelationEdgeStyle;';
  const style = `${router}fontSize=11;html=1;rounded=1;jumpStyle=arc;jumpSize=8;${ports}startArrow=${startArrow};startFill=0;endArrow=${endArrow};endFill=0;strokeColor=#5c5c5c;${selfRef ? 'curved=1;' : ''}`;
  const geometry = waypoints
    ? `          <mxGeometry relative="1" as="geometry">
            <Array as="points">
${waypoints.map(([x, y]) => `              <mxPoint x="${Math.round(x)}" y="${Math.round(y)}" />`).join('\n')}
            </Array>
          </mxGeometry>`
    : '          <mxGeometry relative="1" as="geometry" />';
  return `        <mxCell id="p${page}_fk_${e.index}" value="" style="${style}" edge="1" parent="1" source="${rowIdOf(page, e.child, e.childCol)}" target="${rowIdOf(page, e.parent, e.parentCol)}">
${geometry}
        </mxCell>`;
}

function noteCell(id, html, x, y, w, h) {
  return `        <mxCell id="${id}" value="${esc(html)}" style="text;html=1;align=left;verticalAlign=top;fontSize=13;spacing=12;strokeColor=#999999;fillColor=#ffffff;rounded=1;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />
        </mxCell>`;
}

const CARDINALITY_NOTE = 'Ký hiệu chân quạ: chân quạ = &quot;nhiều&quot; · gạch đứng = &quot;đúng một&quot; · vòng tròn = &quot;có thể không có&quot;.';

// Một trang ERD chi tiết. coreNames vẽ đầy đủ; nếu pullExternal thì các bảng cha
// nằm ngoài danh sách được vẽ rút gọn (viền đứt, chỉ hiện cột được tham chiếu).
function detailPage(page, coreNames, options = {}) {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const core = new Set(coreNames);
  const edges = relations.filter((e) => core.has(e.child) && (core.has(e.parent) || options.pullExternal));
  const externals = new Map();
  if (options.pullExternal) {
    for (const e of edges) {
      if (core.has(e.parent)) continue;
      if (!externals.has(e.parent)) externals.set(e.parent, new Set());
      externals.get(e.parent).add(e.parentCol);
    }
  }

  const entities = new Map();
  for (const n of coreNames) entities.set(n, { table: byName.get(n), cols: byName.get(n).cols, external: false });
  for (const [n, cols] of externals) {
    const t = byName.get(n);
    entities.set(n, { table: t, cols: t.cols.filter((c) => cols.has(c.name)), external: true });
  }

  const laid = layout(entities, edges);
  const cells = [];
  for (const [name, entity] of entities) {
    const { x, y } = laid.place.get(name);
    cells.push(...tableCells(page, name, entity, x, y));
  }
  if (options.layerLabels) {
    const headerY = Math.min(...[...laid.place.values()].map((p) => p.y)) - 56;
    laid.columns.forEach((count, i) => {
      if (!count) return;
      const isLonely = laid.lonelyCount && i === laid.columns.length - 1;
      const title = isLonely ? 'Bảng độc lập (không có khoá ngoại)'
        : i === 0 ? 'Tầng 0 · bảng gốc' : `Tầng ${i}`;
      cells.push(`        <mxCell id="p${page}_layer_${i}" value="${esc(title)}" style="text;html=1;align=center;verticalAlign=middle;fontSize=15;fontStyle=1;fontColor=#8a8a8a;" vertex="1" parent="1">
          <mxGeometry x="${LEFT + i * (TABLE_W + COL_GAP)}" y="${headerY}" width="${TABLE_W}" height="30" as="geometry" />
        </mxCell>`);
    });
  }
  for (const e of edges) cells.push(edgeCell(page, e, entities, laid.waypoints.get(e.index)));
  return {
    cells,
    crossings: laid.crossings,
    laneCount: laid.laneCount,
    tableCount: entities.size,
    edgeCount: edges.length,
  };
}

function pageXml(id, name, cells) {
  return `  <diagram id="${id}" name="${esc(name)}">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="826" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>`;
}

// Trang mở đầu: bản đồ cụm nghiệp vụ — mỗi mũi tên là "cụm này có FK trỏ cụm kia".
function overviewPage(page) {
  const cells = [];
  const BOX_W = 330;
  const BOX_H = 92;
  const PER_ROW = 4;
  GROUPS.forEach((g, i) => {
    const x = LEFT + (i % PER_ROW) * (BOX_W + 120);
    const y = 240 + Math.floor(i / PER_ROW) * (BOX_H + 90);
    const count = g.tables.filter((n) => tables.some((t) => t.name === n)).length;
    const label = esc(`<b>${g.name}</b><br><font style="font-size:11px" color="#666666">${count} bảng</font>`);
    cells.push(`        <mxCell id="p${page}_g_${slug(g.name)}" value="${label}" style="rounded=1;whiteSpace=wrap;html=1;fontSize=15;fillColor=${g.fill};strokeColor=${g.stroke};strokeWidth=2;verticalAlign=middle;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${BOX_W}" height="${BOX_H}" as="geometry" />
        </mxCell>`);
  });

  const pairs = new Map();
  for (const e of relations) {
    const from = groupOf(e.child).name;
    const to = groupOf(e.parent).name;
    if (from === to) continue;
    const key = `${from} ${to}`;
    pairs.set(key, (pairs.get(key) || 0) + 1);
  }
  let i = 0;
  for (const [key, count] of pairs) {
    const [from, to] = key.split(' ');
    cells.push(`        <mxCell id="p${page}_link_${i}" value="${count}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;jumpStyle=arc;jumpSize=8;endArrow=block;endFill=1;strokeColor=#8c8c8c;fontSize=11;fontColor=#555555;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="p${page}_g_${slug(from)}" target="p${page}_g_${slug(to)}">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`);
    i += 1;
  }

  cells.push(noteCell(`p${page}_note`,
    `<b>JAPANO — BẢN ĐỒ CỤM NGHIỆP VỤ</b> &nbsp; ${tables.length} bảng · ${relations.length} khoá ngoại`
    + `<br><br>Mỗi ô là một cụm bảng. Mũi tên <b>A → B</b> nghĩa là bảng thuộc cụm A có khoá ngoại trỏ tới bảng thuộc cụm B; số trên mũi tên là số khoá ngoại.`
    + `<br>Chi tiết từng cụm (đủ PK/FK và quan hệ) ở các tab kế tiếp. Tab cuối là ERD đầy đủ của cả hệ thống.`,
    LEFT, 40, 1500, 130));
  return cells;
}

function emitDrawio() {
  const pages = [];
  const stats = [];
  let page = 0;

  pages.push(pageXml('japano-erd-overview', '0 · Bản đồ cụm', overviewPage(page)));
  page += 1;

  GROUPS.forEach((g, i) => {
    const names = g.tables.filter((n) => tables.some((t) => t.name === n));
    if (!names.length) return;
    const built = detailPage(page, names, { pullExternal: true });
    const cells = built.cells.concat([noteCell(`p${page}_note`,
      `<b>${g.name}</b> &nbsp; ${names.length} bảng trong cụm · ${built.tableCount - names.length} bảng ngoài cụm (viền đứt, chỉ hiện cột được tham chiếu) · ${built.edgeCount} khoá ngoại`
      + `<br><br><b>PK</b> khoá chính (tên gạch chân) · <b>FK1, FK2…</b> khoá ngoại, đánh số theo thứ tự cột. Dây đi từ cột FK của bảng con sang cột PK của bảng cha; bảng cha luôn nằm bên trái.`
      + `<br>${CARDINALITY_NOTE}`,
      LEFT, 40, 1200, 120)]);
    pages.push(pageXml(`japano-erd-${slug(g.name)}`, `${i + 1} · ${g.name}`, cells));
    stats.push({ name: g.name, ...built });
    page += 1;
  });

  const full = detailPage(page, tables.map((t) => t.name), { layerLabels: true });
  const swatches = GROUPS.map((g) => `<span style="background-color:${g.fill};border:1px solid ${g.stroke};">&nbsp;&nbsp;&nbsp;</span> ${g.name}`).join(' &nbsp; ');
  const cells = full.cells.concat([noteCell(`p${page}_note`,
    `<b>JAPANO — SƠ ĐỒ QUAN HỆ THỰC THỂ (ERD) ĐẦY ĐỦ</b> &nbsp; ${tables.length} bảng · ${full.edgeCount} khoá ngoại`
    + `<br><br><b>PK</b> khoá chính (tên gạch chân) · <b>FK1, FK2…</b> khoá ngoại, đánh số theo thứ tự cột. Dây nối đi từ cột FK của bảng con sang cột PK của bảng cha.`
    + `<br>Kiểu dữ liệu và ràng buộc (NOT NULL / UNIQUE) nằm ở tooltip: rê chuột lên tên cột để xem, hoặc mở ${'japano_schema_v2.sql'}.`
    + `<br>${CARDINALITY_NOTE}`
    + `<br>Bảng xếp theo tầng phụ thuộc khoá ngoại: bảng cha luôn ở bên trái bảng con, nên <b>mọi dây đều chảy một chiều trái → phải</b>. Dây nhảy nhiều tầng đi theo làn trống giữa các bảng; chỗ buộc phải cắt nhau được vẽ cầu vượt.`
    + `<br><br>Màu theo cụm nghiệp vụ: ${swatches}`,
    LEFT, 30, 1500, 170)]);
  pages.push(pageXml('japano-erd-full', `${GROUPS.length + 1} · ERD đầy đủ`, cells));
  stats.push({ name: 'ERD đầy đủ', ...full });

  emitDrawio.stats = stats;
  return `<mxfile host="app.diagrams.net" type="device">\n${pages.join('\n')}\n</mxfile>\n`;
}

fs.writeFileSync(path.join(ROOT, 'japano_schema_v2.sql'), emitSql('mysql'));
fs.writeFileSync(path.join(ROOT, 'japano_schema_v2_sqlite.sql'), emitSql('sqlite'));
fs.writeFileSync(path.join(ROOT, 'japano_erd.drawio.xml'), emitDrawio());
console.log('Đã ghi japano_schema_v2.sql + japano_schema_v2_sqlite.sql + japano_erd.drawio.xml');
console.log('Số bảng:', tables.length, '| Số quan hệ FK:', refs.length);
console.log('Số cặp dây cắt nhau trên từng trang draw.io:');
for (const s of emitDrawio.stats) {
  console.log(`  ${String(s.crossings).padStart(4)} chỗ cắt  ${s.name} (${s.tableCount} bảng · ${s.edgeCount} dây · ${s.laneCount} làn)`);
}
