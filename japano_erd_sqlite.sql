-- =============================================================
-- JAPANO — Sơ đồ quan hệ thực thể (ERD) cho SQLite (sqliteonline.com)
-- Sinh tự động từ backend/data/db.json (dữ liệu thật đang chạy).
-- Mỗi FOREIGN KEY chính là "dây nối" từ khóa ngoại (FK) đến khóa chính (PK).
-- Thời gian lưu bằng BIGINT (epoch mili-giây) đúng như app dùng.
-- =============================================================


PRAGMA foreign_keys = OFF;

-- ---- Bảng cấu hình (singleton) ----------------------------------------------
CREATE TABLE `shop_settings` (
  `id` TINYINT PRIMARY KEY DEFAULT 1,
  `name` VARCHAR(150), `hotline` VARCHAR(40), `email` VARCHAR(150),
  `address` VARCHAR(255), `ship_fee` INT, `cod` BOOLEAN, `stripe` BOOLEAN,
  `vnpay` BOOLEAN, `logo` TEXT
);

CREATE TABLE `flagcard_config` (
  `id` TINYINT PRIMARY KEY DEFAULT 1,
  `active` BOOLEAN, `qualifying_order_min` INT, `required_cards` INT,
  `reward_percent` INT, `reward_voucher_min_order` INT, `reward_validity_days` INT
);

CREATE TABLE `integration_settings` (
  `id` TINYINT PRIMARY KEY DEFAULT 1,
  `mongo` BOOLEAN, `cloudinary` BOOLEAN, `ai` BOOLEAN
);

-- ---- Thực thể gốc (không phụ thuộc FK) --------------------------------------
CREATE TABLE `categories` (
  `id` VARCHAR(80) PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `kanji` VARCHAR(40)
);

CREATE TABLE `users` (
  `id` VARCHAR(80) PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(190) UNIQUE,
  `role` VARCHAR(30) NOT NULL DEFAULT 'customer',
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `orders_count` INT DEFAULT 0,
  `spent` BIGINT DEFAULT 0,
  `tryons` INT DEFAULT 0,
  `vip` VARCHAR(40),
  `joined_at` BIGINT
);

CREATE TABLE `vouchers` (
  `code` VARCHAR(40) PRIMARY KEY,
  `type` VARCHAR(20) NOT NULL,
  `value` INT NOT NULL,
  `min_order` INT DEFAULT 0,
  `expiry` DATE,
  `usage_limit` INT DEFAULT 0,
  `used` INT DEFAULT 0,
  `active` BOOLEAN DEFAULT 1
);

CREATE TABLE `banners` (
  `id` VARCHAR(40) PRIMARY KEY,
  `title` VARCHAR(190),
  `img` VARCHAR(255),
  `link` VARCHAR(255),
  `active` BOOLEAN DEFAULT 1,
  `sort_order` INT DEFAULT 0
);

CREATE TABLE `notifications` (
  `id` VARCHAR(60) PRIMARY KEY,
  `title` VARCHAR(255),
  `body` TEXT,
  `type` VARCHAR(60),
  `action` VARCHAR(120),
  `reach` INT DEFAULT 0,
  `at` BIGINT
);

CREATE TABLE `flagcards` (
  `id` VARCHAR(80) PRIMARY KEY,
  `sort_order` INT,
  `glyph` VARCHAR(16),
  `accent` VARCHAR(16),
  `title` VARCHAR(190),
  `japanese` VARCHAR(190),
  `region` VARCHAR(120),
  `summary` TEXT,
  `formation_history` TEXT,
  `legend` TEXT,
  `outfit_style` VARCHAR(190),
  `outfit_reason` TEXT,
  `source_url` VARCHAR(255),
  `active` BOOLEAN DEFAULT 1
);

-- ---- Sản phẩm và bảng con ---------------------------------------------------
CREATE TABLE `products` (
  `id` VARCHAR(80) PRIMARY KEY,
  `slug` VARCHAR(120) NOT NULL UNIQUE,
  `name` VARCHAR(190) NOT NULL,
  `kanji` VARCHAR(40),
  `sku` VARCHAR(60),
  `category_id` VARCHAR(80),
  `brand` VARCHAR(80),
  `price` BIGINT NOT NULL,
  `old_price` BIGINT,
  `sale` INT,
  `status` VARCHAR(30) DEFAULT 'published',
  `color_hex` VARCHAR(16),
  `rating` DECIMAL(3,1) DEFAULT 0,
  `sold` INT DEFAULT 0,
  `description` TEXT,
  `story` TEXT,
  `image` VARCHAR(255),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `product_images` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `product_id` VARCHAR(80) NOT NULL,
  `url` VARCHAR(255) NOT NULL,
  `position` INT DEFAULT 0,
  CONSTRAINT `fk_pimg_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE `product_variants` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `product_id` VARCHAR(80) NOT NULL,
  `color_name` VARCHAR(60),
  `color_hex` VARCHAR(16),
  `size` VARCHAR(20),
  `sku` VARCHAR(60),
  `stock` INT DEFAULT 0,
  CONSTRAINT `fk_pvar_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE `product_tags` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `product_id` VARCHAR(80) NOT NULL,
  `tag` VARCHAR(80) NOT NULL,
  `kind` VARCHAR(20) NOT NULL DEFAULT 'tag',
  CONSTRAINT `fk_ptag_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- ---- Bảng con của flagcards -------------------------------------------------
CREATE TABLE `flagcard_facts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `flagcard_id` VARCHAR(80) NOT NULL,
  `fact` VARCHAR(255) NOT NULL,
  CONSTRAINT `fk_ffact_card` FOREIGN KEY (`flagcard_id`) REFERENCES `flagcards`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE `flagcard_checkins` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `flagcard_id` VARCHAR(80) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `tip` VARCHAR(255),
  CONSTRAINT `fk_fchk_card` FOREIGN KEY (`flagcard_id`) REFERENCES `flagcards`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE `flagcard_recommended_products` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `flagcard_id` VARCHAR(80) NOT NULL,
  `product_slug` VARCHAR(120),
  CONSTRAINT `fk_frec_card` FOREIGN KEY (`flagcard_id`) REFERENCES `flagcards`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_frec_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ---- Hồ sơ phong cách của user ----------------------------------------------
CREATE TABLE `profiles` (
  `user_id` VARCHAR(80) PRIMARY KEY,
  `gender` VARCHAR(30),
  `skin_tone` VARCHAR(60),
  `occasion` VARCHAR(120),
  `budget` BIGINT,
  `height_cm` INT,
  `weight_kg` INT,
  `usual_size` VARCHAR(20),
  `updated_at` BIGINT,
  CONSTRAINT `fk_profile_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE `profile_styles` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` VARCHAR(80) NOT NULL,
  `style` VARCHAR(80) NOT NULL,
  CONSTRAINT `fk_pstyle_profile` FOREIGN KEY (`user_id`) REFERENCES `profiles`(`user_id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- ---- Đơn hàng ---------------------------------------------------------------
CREATE TABLE `orders` (
  `id` VARCHAR(80) PRIMARY KEY,
  `code` VARCHAR(40) NOT NULL,
  `user_id` VARCHAR(80),
  `customer_name` VARCHAR(150),
  `customer_email` VARCHAR(190),
  `customer_phone` VARCHAR(40),
  `address` VARCHAR(255),
  `ward_code` VARCHAR(20),
  `ward` VARCHAR(120),
  `province_code` VARCHAR(20),
  `province` VARCHAR(120),
  `subtotal` BIGINT,
  `discount` BIGINT DEFAULT 0,
  `voucher_discount` BIGINT DEFAULT 0,
  `payment_discount` BIGINT DEFAULT 0,
  `discount_code` VARCHAR(40),
  `total` BIGINT,
  `ship` BIGINT DEFAULT 0,
  `payment_method` VARCHAR(40),
  `payment_provider` VARCHAR(40),
  `payment_status` VARCHAR(40),
  `payment_txn` VARCHAR(120),
  `payment_currency` VARCHAR(10),
  `status` VARCHAR(30) NOT NULL,
  `source` VARCHAR(30),
  `created_at` BIGINT,
  CONSTRAINT `fk_order_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_order_voucher` FOREIGN KEY (`discount_code`) REFERENCES `vouchers`(`code`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `order_items` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `order_id` VARCHAR(80) NOT NULL,
  `product_slug` VARCHAR(120),
  `name` VARCHAR(190),
  `color_name` VARCHAR(60),
  `color_hex` VARCHAR(16),
  `size` VARCHAR(20),
  `qty` INT NOT NULL DEFAULT 1,
  `price` BIGINT NOT NULL,
  CONSTRAINT `fk_oitem_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_oitem_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `order_history` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `order_id` VARCHAR(80) NOT NULL,
  `status` VARCHAR(30) NOT NULL,
  `at` BIGINT,
  CONSTRAINT `fk_ohist_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- ---- Thanh toán -------------------------------------------------------------
CREATE TABLE `payments` (
  `id` VARCHAR(80) PRIMARY KEY,
  `code` VARCHAR(60),
  `order_id` VARCHAR(80),
  `user_id` VARCHAR(80),
  `provider` VARCHAR(40),
  `method` VARCHAR(40),
  `status` VARCHAR(40),
  `amount` BIGINT,
  `original_amount` BIGINT,
  `discount` BIGINT DEFAULT 0,
  `voucher_discount` BIGINT DEFAULT 0,
  `payment_discount` BIGINT DEFAULT 0,
  `promotion_code` VARCHAR(40),
  `currency` VARCHAR(10),
  `transaction_code` VARCHAR(120),
  `payment_intent_id` VARCHAR(120),
  `checkout_session_id` VARCHAR(190),
  `refundable` BOOLEAN DEFAULT 0,
  `amount_subtotal` BIGINT,
  `paid_at` BIGINT,
  `charge_id` VARCHAR(120),
  `receipt_url` VARCHAR(500),
  `created_at` BIGINT,
  `updated_at` BIGINT,
  CONSTRAINT `fk_pay_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_pay_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ---- Yêu cầu trả hàng / hoàn tiền -------------------------------------------
CREATE TABLE `return_requests` (
  `id` VARCHAR(80) PRIMARY KEY,
  `code` VARCHAR(60),
  `order_id` VARCHAR(80),
  `user_id` VARCHAR(80),
  `payment_id` VARCHAR(80),
  `status` VARCHAR(30),
  `reason` VARCHAR(255),
  `note` TEXT,
  `admin_note` TEXT,
  `amount` BIGINT,
  `currency` VARCHAR(10),
  `refund_id` VARCHAR(120),
  `refund_status` VARCHAR(40),
  `created_at` BIGINT,
  `updated_at` BIGINT,
  CONSTRAINT `fk_ret_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_ret_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_ret_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `payment_refunds` (
  `id` VARCHAR(80) PRIMARY KEY,
  `payment_id` VARCHAR(80) NOT NULL,
  `amount` BIGINT,
  `currency` VARCHAR(10),
  `status` VARCHAR(40),
  `reason` VARCHAR(120),
  `failure_reason` VARCHAR(255),
  `return_request_id` VARCHAR(80),
  `created_at` BIGINT,
  `updated_at` BIGINT,
  CONSTRAINT `fk_refund_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_refund_return` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `return_request_items` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `return_request_id` VARCHAR(80) NOT NULL,
  `product_slug` VARCHAR(120),
  `name` VARCHAR(190),
  `size` VARCHAR(20),
  `color_name` VARCHAR(60),
  `qty` INT DEFAULT 1,
  `price` BIGINT,
  CONSTRAINT `fk_ritem_return` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_ritem_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `return_request_timeline` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `return_request_id` VARCHAR(80) NOT NULL,
  `status` VARCHAR(30) NOT NULL,
  `at` BIGINT,
  `refund_id` VARCHAR(120),
  `note` VARCHAR(255),
  CONSTRAINT `fk_rtl_return` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- ---- Giỏ hàng ---------------------------------------------------------------
CREATE TABLE `carts` (
  `id` VARCHAR(80) PRIMARY KEY,
  `user_id` VARCHAR(80),
  `updated_at` BIGINT,
  CONSTRAINT `fk_cart_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE `cart_items` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `cart_id` VARCHAR(80) NOT NULL,
  `product_slug` VARCHAR(120),
  `color` VARCHAR(60),
  `size` VARCHAR(20),
  `qty` INT DEFAULT 1,
  CONSTRAINT `fk_citem_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_citem_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ---- Đánh giá sản phẩm (đã xác minh mua hàng) -------------------------------
CREATE TABLE `reviews` (
  `id` VARCHAR(80) PRIMARY KEY,
  `product_slug` VARCHAR(120),
  `user_id` VARCHAR(80),
  `order_id` VARCHAR(80),
  `order_code` VARCHAR(40),
  `rating` TINYINT NOT NULL,
  `comment` TEXT,
  `media_url` VARCHAR(500),
  `media_kind` VARCHAR(10),
  `status` VARCHAR(20) DEFAULT 'approved',
  `created_at` BIGINT,
  `updated_at` BIGINT,
  CONSTRAINT `fk_review_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_review_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_review_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `review_reactions` (
  `id` VARCHAR(80) PRIMARY KEY,
  `review_id` VARCHAR(80) NOT NULL,
  `user_id` VARCHAR(80),
  `value` VARCHAR(20) NOT NULL,
  `updated_at` BIGINT,
  CONSTRAINT `fk_reaction_review` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_reaction_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `moderation_samples` (
  `id` VARCHAR(80) PRIMARY KEY,
  `review_id` VARCHAR(80),
  `label` VARCHAR(30),
  `normalized_text` TEXT,
  `source` VARCHAR(30),
  `updated_at` BIGINT,
  CONSTRAINT `fk_modsample_review` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ---- Voucher đã dùng --------------------------------------------------------
CREATE TABLE `voucher_redemptions` (
  `id` VARCHAR(80) PRIMARY KEY,
  `code` VARCHAR(40),
  `user_id` VARCHAR(80),
  `order_id` VARCHAR(80),
  `discount` BIGINT,
  `redeemed_at` BIGINT,
  CONSTRAINT `fk_vred_voucher` FOREIGN KEY (`code`) REFERENCES `vouchers`(`code`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_vred_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_vred_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ---- Bộ sưu tập Flagcard của user -------------------------------------------
CREATE TABLE `flagcard_collections` (
  `id` VARCHAR(80) PRIMARY KEY,
  `user_id` VARCHAR(80),
  `created_at` BIGINT,
  `updated_at` BIGINT,
  CONSTRAINT `fk_fcol_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE `flagcard_collection_awards` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `collection_id` VARCHAR(80) NOT NULL,
  `flagcard_id` VARCHAR(80),
  `order_id` VARCHAR(80),
  `order_code` VARCHAR(40),
  `order_total` BIGINT,
  `awarded_at` BIGINT,
  `source` VARCHAR(40),
  CONSTRAINT `fk_faward_collection` FOREIGN KEY (`collection_id`) REFERENCES `flagcard_collections`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_faward_card` FOREIGN KEY (`flagcard_id`) REFERENCES `flagcards`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_faward_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ---- Hành vi / gợi ý (AI) ---------------------------------------------------
CREATE TABLE `interactions` (
  `id` VARCHAR(80) PRIMARY KEY,
  `user_id` VARCHAR(80),
  `product_slug` VARCHAR(120),
  `type` VARCHAR(30),
  `value` INT DEFAULT 1,
  `created_at` BIGINT,
  `source` VARCHAR(30),
  CONSTRAINT `fk_inter_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_inter_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `chats` (
  `id` VARCHAR(80) PRIMARY KEY,
  `user_id` VARCHAR(80),
  `role` VARCHAR(20),
  `message` TEXT,
  `created_at` BIGINT,
  CONSTRAINT `fk_chat_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE `chat_product_refs` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `chat_id` VARCHAR(80) NOT NULL,
  `product_slug` VARCHAR(120),
  CONSTRAINT `fk_cref_chat` FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cref_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `tryon_history` (
  `id` VARCHAR(80) PRIMARY KEY,
  `user_id` VARCHAR(80),
  `product_slug` VARCHAR(120),
  `engine` VARCHAR(190),
  `created_at` BIGINT,
  CONSTRAINT `fk_tryon_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_tryon_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `tryon_accessories` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `tryon_id` VARCHAR(80) NOT NULL,
  `product_slug` VARCHAR(120),
  CONSTRAINT `fk_tacc_tryon` FOREIGN KEY (`tryon_id`) REFERENCES `tryon_history`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_tacc_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ---- Mục tiêu mua sắm / sức khỏe --------------------------------------------
CREATE TABLE `goals` (
  `id` VARCHAR(120) PRIMARY KEY,
  `user_id` VARCHAR(80),
  `product_slug` VARCHAR(120),
  `age` INT,
  `height_cm` INT,
  `current_weight_kg` INT,
  `target_weight_kg` INT,
  `monthly_income` BIGINT,
  `fixed_expenses` BIGINT,
  `current_savings` BIGINT,
  `target_months` INT,
  `plan` TEXT,
  `created_at` BIGINT,
  `updated_at` BIGINT,
  CONSTRAINT `fk_goal_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_goal_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ---- Mô tả sản phẩm do AI sinh ----------------------------------------------
CREATE TABLE `ai_descriptions` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `product_slug` VARCHAR(120) UNIQUE,
  `generated_at` BIGINT,
  `headline` VARCHAR(255),
  `visual_summary` TEXT,
  `styling_tip` TEXT,
  `purchase_reason` TEXT,
  `confidence` VARCHAR(10),
  `engine` VARCHAR(60),
  CONSTRAINT `fk_aidesc_product` FOREIGN KEY (`product_slug`) REFERENCES `products`(`slug`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE `ai_description_details` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `ai_description_id` INT NOT NULL,
  `detail` VARCHAR(500) NOT NULL,
  CONSTRAINT `fk_aidetail_desc` FOREIGN KEY (`ai_description_id`) REFERENCES `ai_descriptions`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- ---- Khám phá Nhật Bản: đánh giá & đề xuất địa điểm -------------------------
CREATE TABLE `japan_spot_reviews` (
  `id` VARCHAR(80) PRIMARY KEY,
  `place` VARCHAR(190) NOT NULL,
  `prefecture` VARCHAR(120) NOT NULL,
  `user_id` VARCHAR(80),
  `user_name` VARCHAR(150),
  `rating` TINYINT NOT NULL,
  `comment` TEXT,
  `media_url` VARCHAR(500),
  `media_kind` VARCHAR(10),
  `created_at` BIGINT,
  CONSTRAINT `fk_jsr_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE `japan_spot_suggestions` (
  `id` VARCHAR(80) PRIMARY KEY,
  `prefecture` VARCHAR(120) NOT NULL,
  `user_id` VARCHAR(80),
  `user_name` VARCHAR(150),
  `suggestion` TEXT,
  `created_at` BIGINT,
  CONSTRAINT `fk_jss_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- =============================================================
-- DỮ LIỆU THẬT (trích từ app đang chạy)
-- =============================================================

INSERT INTO `shop_settings` (`id`, `name`, `hotline`, `email`, `address`, `ship_fee`, `cod`, `stripe`, `vnpay`, `logo`) VALUES
  (1, 'JAPANO Store', '1900 6868', 'shop@japano.vn', '123 Lê Lợi, P. Bến Nghé, HCM', 30000, 1, 1, 1, NULL);

INSERT INTO `flagcard_config` (`id`, `active`, `qualifying_order_min`, `required_cards`, `reward_percent`, `reward_voucher_min_order`, `reward_validity_days`) VALUES
  (1, 1, 5000000, 7, 50, 0, 90);

INSERT INTO `integration_settings` (`id`, `mongo`, `cloudinary`, `ai`) VALUES
  (1, 0, 0, 0);

INSERT INTO `categories` (`id`, `name`, `kanji`) VALUES
  ('ao-truyen-thong', 'Áo truyền thống', '着物'),
  ('haori', 'Áo khoác', '羽織'),
  ('trang-phuc', 'Trang phục', '制服'),
  ('phu-kien', 'Phụ kiện', '小物'),
  ('cosplay', 'Cosplay', 'コス');

INSERT INTO `users` (`id`, `name`, `email`, `role`, `status`, `orders_count`, `spent`, `tryons`, `vip`, `joined_at`) VALUES
  ('u1', 'Trần Minh', 'tran.minh@japano.vn', 'admin', 'active', 4, 5640000, 0, 'Mới', 1781588172477),
  ('u2', 'Nguyễn Thu Hà', 'nguyen.thu.ha@japano.vn', 'staff', 'active', 3, 2200000, 1, 'Mới', 1779255372477),
  ('u3', 'Lê Quốc Bảo', 'le.quoc.bao@japano.vn', 'staff', 'active', 4, 2170000, 2, 'Mới', 1776922572477),
  ('u4', 'Phạm Mỹ Linh', 'pham.my.linh@japano.vn', 'customer', 'active', 3, 670000, 3, 'Thành viên', 1774589772477),
  ('u5', 'Hoàng Anh Tú', 'hoang.anh.tu@japano.vn', 'customer', 'active', 4, 5930000, 4, 'Thành viên', 1772256972477),
  ('u6', 'Đặng Khánh Vy', 'đang.khanh.vy@japano.vn', 'customer', 'active', 2, 1470000, 0, 'Thành viên', 1769924172477),
  ('u7', 'Vũ Hải Nam', 'vu.hai.nam@japano.vn', 'customer', 'locked', 3, 2300000, 1, 'Thành viên', 1767591372477),
  ('u8', 'Bùi Ngọc Ánh', 'bui.ngoc.anh@japano.vn', 'customer', 'active', 2, 730000, 2, 'VIP', 1765258572477),
  ('u9', 'Đỗ Gia Huy', 'đo.gia.huy@japano.vn', 'customer', 'active', 3, 2570000, 3, 'VIP', 1762925772477),
  ('u10', 'Lý Cẩm Tú', 'ly.cam.tu@japano.vn', 'customer', 'active', 2, 2610000, 4, 'VIP', 1760592972477),
  ('demo-minh', 'Trần Minh', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1784162249095),
  ('codex-e2e', 'codex-e2e', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1783922576844),
  ('codex-e2e-final', 'codex-e2e-final', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1783923811011),
  ('codex-always-repose-proof', 'codex-always-repose-proof', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1783929417836),
  ('verification', 'verification', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1783935103669),
  ('qa-accessory', 'qa-accessory', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1783938237451),
  ('qa-accessory-v2', 'qa-accessory-v2', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1783939475987),
  ('ban@japano.vn', 'ban@japano.vn', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1784137348968),
  ('guest', 'guest', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1784138417748),
  ('verify-user', 'verify-user', NULL, 'customer', 'active', 0, 0, 0, 'Mới', 1784552301757);

INSERT INTO `vouchers` (`code`, `type`, `value`, `min_order`, `expiry`, `usage_limit`, `used`, `active`) VALUES
  ('THU20', 'percent', 20, 500000, '2027-12-31', 500, 132, 1),
  ('FREESHIP', 'amount', 30000, 0, '2027-11-30', 1000, 411, 1),
  ('VIP100', 'amount', 100000, 1500000, '2027-12-15', 200, 57, 0),
  ('JAPANO10', 'percent', 0, 0, NULL, 0, 0, 0),
  ('STRIPE10', 'percent', 0, 0, NULL, 0, 0, 0),
  ('VNPAY5', 'percent', 0, 0, NULL, 0, 0, 0);

INSERT INTO `banners` (`id`, `title`, `img`, `link`, `active`, `sort_order`) VALUES
  ('b1', 'BST Thu — Momiji', '#8A2F26', '/category/ao-truyen-thong', 1, 1),
  ('b2', 'Cách tân Nhật Bản', '#243244', '/culture', 1, 2),
  ('b3', 'Cosplay Fest', '#6D28D9', '/category/cosplay', 1, 3);

INSERT INTO `notifications` (`id`, `title`, `body`, `type`, `action`, `reach`, `at`) VALUES
  ('n0', '🚩 Sưu tầm 7 Flagcard — nhận ngay voucher 50%!', 'Mỗi đơn hàng đủ điều kiện tặng 1 thẻ địa danh Nhật Bản. Đủ bộ 7 thẻ, giảm ngay 50% mọi sản phẩm. Chạm để xem trước bộ thẻ.', 'Khuyến mãi', 'flagcard-intro', 10, 1783919172477),
  ('n1', 'Ưu đãi Thu — giảm 20% Haori', 'Cách tân tủ đồ mùa lá đỏ, dùng mã THU20', 'Khuyến mãi', NULL, 10, 1783913772477),
  ('n2', 'Bảo trì hệ thống 02:00–03:00', 'App có thể gián đoạn ngắn để nâng cấp.', 'Hệ thống', NULL, 10, 1783748172477);

INSERT INTO `flagcards` (`id`, `sort_order`, `glyph`, `accent`, `title`, `japanese`, `region`, `summary`, `formation_history`, `legend`, `outfit_style`, `outfit_reason`, `source_url`, `active`) VALUES
  ('fushimi-inari', 1, '⛩️', '#D64A2D', 'Fushimi Inari Taisha', '伏見稲荷大社', 'Kyoto', 'Con đường hàng nghìn cổng torii đỏ dẫn lên núi Inari — biểu tượng của lời cầu thịnh vượng.', 'Đền được gia tộc Hata dâng thờ thần lúa gạo và sake từ thế kỷ VIII. Khi thương nghiệp phát triển, Inari dần được cầu nguyện cho sự thịnh vượng trong kinh doanh.', 'Cáo kitsune được xem là sứ giả của Inari. Chìa khóa trong miệng tượng cáo tượng trưng cho chìa khóa kho lúa — nguồn của cải và no đủ.', 'Nhật cổ đỏ–trắng', 'Tông đỏ–trắng đồng điệu với torii nhưng vẫn tôn chủ thể.', 'https://kyoto.travel/en/destinations/fushimi-inaritaisha-shrine/', 1),
  ('kiyomizu-dera', 2, '🏯', '#B06B3B', 'Kiyomizu-dera', '清水寺', 'Kyoto', 'Ngôi chùa trên sườn núi nổi tiếng với sân khấu gỗ nhìn xuống cố đô Kyoto.', 'Chính điện và hiên gỗ dựa trên các cột cao khoảng 13 mét. Quần thể là một phần Di sản “Các di tích lịch sử Kyoto cổ”, thể hiện truyền thống kiến trúc tôn giáo bằng gỗ của Kyoto.', 'Nước ở thác Otowa chia thành ba dòng, dân gian gắn với sức khỏe, trường thọ và thành công học tập. Thành ngữ “nhảy khỏi sân khấu Kiyomizu” mang nghĩa dám quyết định lớn.', 'Thanh lịch màu trà', 'Màu trà, kem và hồng dịu hợp kiến trúc gỗ và lá mùa thu.', 'https://kyoto.travel/en/destinations/kiyomizudera-temple/', 1),
  ('himeji-castle', 3, '🕊️', '#54708D', 'Himeji Castle', '姫路城', 'Hyogo', '“Lâu đài Hạc Trắng” với tường vữa trắng và hệ thống phòng thủ như mê cung.', 'Công trình đầu tiên được thiết lập năm 1346. Toyotomi Hideyoshi xây thành quy mô lớn, rồi lâu đài được cải tạo mạnh trong chín năm đầu thời Edo để thành hình dáng ngày nay.', 'Dáng thành trắng như chim hạc dang cánh tạo nên tên gọi Shirasagi-jō. Truyền thuyết Okiku bên chiếc giếng cổ cũng gắn với khu thành Himeji.', 'Trắng–chàm tối giản', 'Tương phản chàm–trắng làm nổi bật sắc Hạc Trắng.', 'https://www.japan.travel/en/world-heritage/himeji-jo-castle/', 1),
  ('itsukushima', 4, '🌊', '#B33C35', 'Itsukushima Shrine', '厳島神社', 'Hiroshima', 'Quần thể đền màu son và đại torii như nổi trên biển khi thủy triều lên.', 'Đền được cho là xây từ năm 593 và được Taira no Kiyomori mở rộng, tái thiết năm 1168 thành hệ thống điện thờ sơn son trên mặt nước.', 'Itsukushima thờ vị thần bảo hộ khỏi tai họa trên biển và chiến tranh. Hòn đảo được xem linh thiêng nên kiến trúc được dựng trên nước để giữ sự thanh tịnh.', 'Lễ hội son–chàm', 'Sắc son và chàm bắt màu đẹp với mặt nước và hành lang đền.', 'https://www.japan.travel/en/world-heritage/itsukushima-shinto-shrine/', 1),
  ('nikko-toshogu', 5, '🐒', '#9C7737', 'Nikkō Tōshō-gū', '日光東照宮', 'Tochigi', 'Lăng miếu Tokugawa Ieyasu giữa rừng tuyết tùng, nổi tiếng với chạm khắc dát màu tinh xảo.', 'Nơi đây tưởng niệm và an táng Tokugawa Ieyasu, vị shogun mở đầu Mạc phủ Tokugawa. Khoảng 127.000 nghệ nhân đã tham gia kiến tạo quần thể bằng kỹ thuật hàng đầu đương thời.', 'Mèo ngủ Nemuri-neko với chim sẻ phía sau được diễn giải như biểu tượng cho tương lai hòa bình; bộ Ba Chú Khỉ truyền tải “không nhìn, không nghe, không nói điều xấu”.', 'Đen–vàng trang trọng', 'Tông tối làm nổi chi tiết vàng–đỏ dày đặc của Tōshō-gū.', 'https://www.japan.travel/en/world-heritage/the-shrines-and-temples-of-nikko/', 1),
  ('shirakawa-go', 6, '❄️', '#66808B', 'Shirakawa-gō', '白川郷', 'Gifu', 'Làng miền núi với mái nhà gasshō-zukuri dốc như hai bàn tay chắp lại.', 'Vùng núi từng biệt lập đã phát triển kiểu nhà mái tranh dốc khoảng 60 độ để tuyết dày dễ trượt xuống. Tầng áp mái được tận dụng nuôi tằm, một sinh kế quan trọng của cư dân.', 'Tên gasshō nghĩa là “chắp tay cầu nguyện”, gợi hình dáng mái nhà. Tinh thần kết nối cộng đồng thể hiện qua việc cư dân cùng nhau thay và bảo dưỡng mái tranh.', 'Layer mùa đông mộc mạc', 'Layer trung tính hợp làng tuyết và quan trọng hơn là giữ ấm, dễ đi bộ.', 'https://www.japan.travel/en/world-heritage/the-historic-villages-of-shirakawa-go-and-gokayama/', 1),
  ('matsumoto-castle', 7, '🐦‍⬛', '#34363D', 'Matsumoto Castle', '松本城', 'Nagano', '“Lâu đài Quạ” màu đen soi bóng xuống hào nước, phía xa là dãy Alps Nhật Bản.', 'Đại thiên thủ năm tầng, sáu tầng bên trong được dựng vào cuối thế kỷ XVI và thuộc nhóm tháp thành cổ nhất còn tồn tại tại Nhật Bản.', 'Màu đen uy nghi khiến thành có biệt danh Karasu-jō — Lâu đài Quạ. Hình ảnh thành phản chiếu trong hào được xem như hai thế giới của chiến thành và thành phố hiện đại.', 'Đen–đỏ samurai hiện đại', 'Đường nét mạnh và tông đen–đỏ hòa với thành Quạ cùng cầu son.', 'https://www.japan.travel/en/spot/1356/', 1);

INSERT INTO `flagcard_facts` (`flagcard_id`, `fact`) VALUES
  ('fushimi-inari', 'Có hơn 5.000 cổng torii màu son trên các lối núi.'),
  ('fushimi-inari', 'Đây là trung tâm của khoảng 40.000 đền Inari trên khắp Nhật Bản.'),
  ('kiyomizu-dera', 'Chính điện thờ Bồ Tát Quan Âm.'),
  ('kiyomizu-dera', 'Hiên chùa là điểm ngắm hoàng hôn và toàn cảnh phía tây Kyoto.'),
  ('himeji-castle', 'Lớp vữa trắng vừa đẹp vừa giúp chống lửa và đạn.'),
  ('himeji-castle', 'Lối đi quanh co được thiết kế để làm quân địch mất phương hướng.'),
  ('itsukushima', 'Sân khấu cao vẫn dùng cho nhã nhạc và vũ điệu cung đình gagaku.'),
  ('itsukushima', 'Cảnh quan thay đổi hoàn toàn giữa lúc triều lên và triều xuống.'),
  ('nikko-toshogu', 'Cổng Yomeimon phủ kín chạm khắc và màu sắc.'),
  ('nikko-toshogu', '“Con voi tưởng tượng” được tạc bởi nghệ nhân chưa từng nhìn thấy voi thật.'),
  ('shirakawa-go', 'Nhiều kết cấu gỗ ghép với nhau mà không dùng đinh.'),
  ('shirakawa-go', 'Ogimachi có cụm nhà lớn và điểm quan sát toàn cảnh từ trên cao.'),
  ('matsumoto-castle', 'Nội thất gỗ nguyên bản có cầu thang rất dốc.'),
  ('matsumoto-castle', 'Hào nước, cầu son và nền Alps tạo nên ba lớp cảnh quan đặc trưng.');

INSERT INTO `flagcard_checkins` (`flagcard_id`, `name`, `tip`) VALUES
  ('fushimi-inari', 'Senbon Torii', 'Chụp ở đoạn cổng dày, đứng lệch tâm để giữ chiều sâu.'),
  ('fushimi-inari', 'Yotsutsuji', 'Đi lên điểm ngắm cảnh để lấy hậu cảnh Kyoto.'),
  ('fushimi-inari', 'Romon Gate', 'Khung hình chính diện với cổng lớn màu son.'),
  ('kiyomizu-dera', 'Kiyomizu Stage', 'Lấy lan can gỗ và thung lũng trong cùng khung hình.'),
  ('kiyomizu-dera', 'Otowa Waterfall', 'Chụp nhẹ nhàng khi trải nghiệm dòng nước, không cản lối.'),
  ('kiyomizu-dera', 'Sannenzaka', 'Check-in phố dốc cổ vào sáng sớm để ít đông.'),
  ('himeji-castle', 'Sannomaru Square', 'Góc rộng đẹp nhất để lấy trọn đại thiên thủ.'),
  ('himeji-castle', 'Bizenmaru', 'Chụp từ dưới lên để nhấn mạnh các tầng mái trắng.'),
  ('himeji-castle', 'Nishinomaru Garden', 'Dùng hành lang dài làm đường dẫn thị giác.'),
  ('itsukushima', 'Otorii Gate', 'Canh giờ thủy triều cao để có hiệu ứng cổng nổi.'),
  ('itsukushima', 'Vermilion Corridors', 'Chụp dọc hành lang, tránh đứng giữa luồng người.'),
  ('itsukushima', 'Senjokaku', 'Lấy sàn gỗ rộng và đền năm tầng ở hậu cảnh.'),
  ('nikko-toshogu', 'Yomeimon Gate', 'Dùng góc chính diện và trang phục tối để nổi trên nền vàng.'),
  ('nikko-toshogu', 'Three Wise Monkeys', 'Tạo dáng ba biểu tượng một cách vui vẻ nhưng trật tự.'),
  ('nikko-toshogu', 'Shinkyo Bridge', 'Check-in từ khu vực cho phép, không bước vào vùng hạn chế.'),
  ('shirakawa-go', 'Shiroyama Observatory', 'Chụp toàn làng; mùa đông cần tuân thủ lối đi chống trượt.'),
  ('shirakawa-go', 'Wada House', 'Góc hàng rào và mái tranh cho chiều sâu đẹp.'),
  ('shirakawa-go', 'Ogimachi Lanes', 'Tôn trọng nhà dân và không đi vào khu vực riêng.'),
  ('matsumoto-castle', 'Uzumibashi Bridge', 'Dùng cầu son làm điểm nhấn cạnh tường thành đen.'),
  ('matsumoto-castle', 'Moat Reflection', 'Sáng sớm ít gió cho mặt nước phản chiếu rõ.'),
  ('matsumoto-castle', 'Honmaru Garden', 'Chụp dọc từ sân để giữ trọn các tầng thiên thủ.');

INSERT INTO `flagcard_recommended_products` (`flagcard_id`, `product_slug`) VALUES
  ('fushimi-inari', 'yukata-xanh'),
  ('fushimi-inari', 'kimono-hong'),
  ('fushimi-inari', 'guoc-geta'),
  ('fushimi-inari', 'kep-no'),
  ('kiyomizu-dera', 'kimono-hong'),
  ('kiyomizu-dera', 'haori-dang-dai'),
  ('kiyomizu-dera', 'du-nhat'),
  ('kiyomizu-dera', 'guoc-geta'),
  ('himeji-castle', 'yukata-xanh'),
  ('himeji-castle', 'haori-dang-dai'),
  ('himeji-castle', 'guoc-geta'),
  ('himeji-castle', 'kiem-go'),
  ('itsukushima', 'kimono-hong'),
  ('itsukushima', 'yukata-xanh'),
  ('itsukushima', 'du-nhat'),
  ('itsukushima', 'kep-no'),
  ('nikko-toshogu', 'haori-dang-dai'),
  ('nikko-toshogu', 'ao-len-co-lo'),
  ('nikko-toshogu', 'mu-nhat'),
  ('nikko-toshogu', 'gang-tay'),
  ('shirakawa-go', 'cardigan-dai'),
  ('shirakawa-go', 'ao-len-co-lo'),
  ('shirakawa-go', 'chup-tai'),
  ('shirakawa-go', 'gang-tay'),
  ('matsumoto-castle', 'haori-dang-dai'),
  ('matsumoto-castle', 'blazer-kaki'),
  ('matsumoto-castle', 'kiem-go'),
  ('matsumoto-castle', 'guoc-geta');

INSERT INTO `products` (`id`, `slug`, `name`, `kanji`, `sku`, `category_id`, `brand`, `price`, `old_price`, `sale`, `status`, `color_hex`, `rating`, `sold`, `description`, `story`, `image`) VALUES
  ('p1', 'kimono-hong', 'Kimono truyền thống Hồng', '着物', 'KIMONOH', 'ao-truyen-thong', 'JAPANO', 1890000, 2290000, NULL, 'published', '#C06A86', 4.7, 120, 'Sản phẩm Kimono truyền thống Hồng theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Kimono truyền thống Hồng đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/kimono-hong_1.jpg'),
  ('p2', 'yukata-xanh', 'Yukata vải bông xanh đen', '浴衣', 'YUKATAX', 'ao-truyen-thong', 'JAPANO', 1290000, 1590000, NULL, 'published', '#243244', 4.7, 54, 'Sản phẩm Yukata cotton xanh đen theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Yukata cotton xanh đen đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/yukata-xanh_1.jpg'),
  ('p3', 'haori-dang-dai', 'Áo choàng Haori dáng dài', '羽織', 'HAORIDA', 'haori', 'JAPANO', 1350000, 1690000, NULL, 'published', '#33261d', 4.5, 88, 'Sản phẩm Áo choàng Haori dáng dài theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Áo choàng Haori dáng dài đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/haori-dang-dai_1.jpg'),
  ('p4', 'cardigan-dai', 'Áo len khoác dáng dài', '羽織', 'CARDIGA', 'haori', 'JAPANO', 890000, 1090000, NULL, 'published', '#6B7255', 4.7, 54, 'Sản phẩm Cardigan len dáng dài theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Cardigan len dáng dài đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/cardigan-dai_1.jpg'),
  ('p5', 'blazer-kaki', 'Áo khoác kaki dáng dài', '羽織', 'BLAZERK', 'haori', 'JAPANO', 990000, NULL, NULL, 'published', '#B08D3C', 5, 203, 'Sản phẩm Blazer kaki trench theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Blazer kaki trench đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/blazer-kaki_1.jpg'),
  ('p6', 'ao-len-cardigan', 'Áo len khoác dệt kim', '羽織', 'AOLENCA', 'haori', 'JAPANO', 650000, NULL, NULL, 'published', '#A88C75', 4.5, 96, 'Sản phẩm Áo len dệt kim cardigan theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Áo len dệt kim cardigan đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/ao-len-cardigan_1.jpg'),
  ('p7', 'khoac-nhat', 'Áo khoác Nhật bản mùa', '羽織', 'KHOACNH', 'haori', 'JAPANO', 1150000, NULL, NULL, 'published', '#2F3B35', 4.7, 203, 'Sản phẩm Áo khoác Nhật bản mùa theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Áo khoác Nhật bản mùa đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/khoac-nhat_1.jpg'),
  ('p8', 'dong-phuc-thuy-thu', 'Đồng phục thủy thủ nữ', '制服', 'DONGPHU', 'trang-phuc', 'JAPANO', 720000, NULL, NULL, 'published', '#243244', 4.5, 96, 'Sản phẩm Đồng phục thủy thủ nữ theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Đồng phục thủy thủ nữ đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/dong-phuc-thuy-thu_1.jpg'),
  ('p9', 'so-mi-trang', 'Sơ mi trắng tay ngắn', '制服', 'SOMITRA', 'trang-phuc', 'JAPANO', 550000, NULL, NULL, 'published', '#E5E7EB', 4.5, 88, 'Sản phẩm Sơ mi trắng tay ngắn theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Sơ mi trắng tay ngắn đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/so-mi-trang_1.jpg'),
  ('p10', 'ao-len-co-lo', 'Áo len cổ lọ dệt kim', '制服', 'AOLENCO', 'trang-phuc', 'JAPANO', 590000, NULL, NULL, 'published', '#8B6B4A', 5, 54, 'Sản phẩm Áo len cổ lọ dệt kim theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Áo len cổ lọ dệt kim đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/ao-len-co-lo_1.jpg'),
  ('p11', 'balo-vai', 'Balo vải Nhật', '鞄', 'BALOVAI', 'phu-kien', 'JAPANO', 490000, NULL, NULL, 'published', '#8A2F26', 4.8, 96, 'Sản phẩm Balo vải Nhật theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Balo vải Nhật đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/balo-vai_1.jpg'),
  ('p12', 'giay-dep', 'Dép quai Nhật', '履物', 'GIAYDEP', 'phu-kien', 'JAPANO', 390000, NULL, NULL, 'published', '#795548', 4.5, 203, 'Sản phẩm Dép quai Nhật theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Dép quai Nhật đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/giay-dep_1.jpg'),
  ('p13', 'mu-nhat', 'Mũ bo Nhật', '帽子', 'MUNHAT', 'phu-kien', 'JAPANO', 280000, NULL, NULL, 'published', '#31363A', 4.5, 120, 'Sản phẩm Mũ bo Nhật theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Mũ bo Nhật đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/mu-nhat_1.jpg'),
  ('p14', 'du-nhat', 'Dù Nhật bản', '傘', 'DUNHAT', 'phu-kien', 'JAPANO', 350000, NULL, NULL, 'published', '#6B7255', 4.6, 120, 'Sản phẩm Dù Nhật bản theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Dù Nhật bản đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/du-nhat_1.jpg'),
  ('p15', 'gang-tay', 'Găng tay len', '手袋', 'GANGTAY', 'phu-kien', 'JAPANO', 180000, NULL, NULL, 'published', '#7B5D51', 4.8, 167, 'Sản phẩm Găng tay len theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Găng tay len đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/gang-tay_1.jpg'),
  ('p16', 'vo-tat', 'Vớ tất cổ cao', '靴下', 'VOTAT', 'phu-kien', 'JAPANO', 90000, NULL, NULL, 'published', '#F1EEE8', 4.8, 120, 'Sản phẩm Vớ tất cổ cao theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Vớ tất cổ cao đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/vo-tat_1.jpg'),
  ('p17', 'kep-no', 'Kẹp nơ tóc', '髪飾り', 'KEPNO', 'phu-kien', 'JAPANO', 120000, NULL, NULL, 'published', '#A33A2F', 4.6, 203, 'Sản phẩm Kẹp nơ tóc theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Kẹp nơ tóc đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/kep-no_1.jpg'),
  ('p18', 'chup-tai', 'Chụp tai nữ', '小物', 'CHUPTAI', 'phu-kien', 'JAPANO', 250000, NULL, NULL, 'published', '#D7B9B2', 4.7, 88, 'Sản phẩm Chụp tai nữ theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Chụp tai nữ đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/chup-tai_1.jpg'),
  ('p19', 'guoc-geta', 'Guốc gỗ Geta', '下駄', 'GUOCGET', 'phu-kien', 'JAPANO', 420000, NULL, NULL, 'published', '#7c5a3a', 4.8, 203, 'Sản phẩm Guốc gỗ Geta theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Guốc gỗ Geta đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/guoc-geta_1.jpg'),
  ('p20', 'kiem-go', 'Kiếm gỗ Nhật bản', '木刀', 'KIEMGO', 'phu-kien', 'JAPANO', 320000, NULL, NULL, 'published', '#6F4E37', 4.7, 96, 'Sản phẩm Kiếm gỗ Nhật bản theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Kiếm gỗ Nhật bản đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/kiem-go_1.jpg'),
  ('p21', 'furina', 'Trang phục hóa thân Furina', 'コス', 'FURINA', 'cosplay', 'JAPANO', 980000, NULL, NULL, 'published', '#4FA3D1', 4.9, 145, 'Sản phẩm Cosplay Furina theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Cosplay Furina đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/furina_1.jpg'),
  ('p22', 'yae-miko', 'Trang phục hóa thân Yae Miko', 'コス', 'YAEMIKO', 'cosplay', 'JAPANO', 1050000, 1250000, NULL, 'published', '#C0483B', 4.8, 145, 'Sản phẩm Cosplay Yae Miko theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Cosplay Yae Miko đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/yae-miko_1.jpg'),
  ('p23', 'yumeko', 'Trang phục hóa thân Yumeko Jabami', 'コス', 'YUMEKO', 'cosplay', 'JAPANO', 990000, NULL, NULL, 'published', '#8A2F26', 4.7, 203, 'Sản phẩm Cosplay Yumeko Jabami theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Cosplay Yumeko Jabami đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/yumeko_1.jpg'),
  ('p24', 'naruto', 'Trang phục hóa thân Naruto', 'コス', 'NARUTO', 'cosplay', 'JAPANO', 850000, NULL, NULL, 'published', '#D97706', 4.9, 203, 'Sản phẩm Cosplay Naruto theo tinh thần thời trang Nhật Bản, dễ phối và phù hợp nhiều dịp.', 'Thiết kế Cosplay Naruto đề cao đường nét gọn, vật liệu bền và vẻ đẹp wabi-sabi.', '/assets/products/naruto_1.jpg'),
  ('p1784163066006', 'p1784163066006', 'Trang sức', NULL, 'TRANG-', 'ao-truyen-thong', 'JAPANO', 10000, 12000, NULL, 'draft', '#6A3817', 0, 0, 'Trang sức — thiết kế mang tinh thần Nhật Bản, phom dáng tối giản dễ phối. Chất liệu thoáng nhẹ, đường may tỉ mỉ, phù hợp đi làm, dạo phố và những dịp thường ngày. Item lý tưởng để "cách tân" tủ đồ theo lối iki.', 'Bắt nguồn từ thời Heian và hoàn thiện ở thời Edo, trang sức mang theo triết lý wabi-sabi — vẻ đẹp của sự mộc mạc, tự nhiên. Mỗi nếp vải, mỗi sắc nhuộm đều gợi nhắc mùa và tâm thế người mặc. Khoác lên mình, bạn không chỉ mặc một bộ trang phục mà đang kể một câu chuyện văn hoá.', NULL);

INSERT INTO `product_images` (`product_id`, `url`, `position`) VALUES
  ('p1', '/assets/products/kimono-hong_1.jpg', 0),
  ('p1', '/assets/products/kimono-hong_2.jpg', 1),
  ('p1', '/assets/products/kimono-hong_3.jpg', 2),
  ('p1', '/assets/products/kimono-hong_4.jpg', 3),
  ('p2', '/assets/products/yukata-xanh_1.jpg', 0),
  ('p2', '/assets/products/yukata-xanh_2.jpg', 1),
  ('p2', '/assets/products/yukata-xanh_3.jpg', 2),
  ('p2', '/assets/products/yukata-xanh_4.jpg', 3),
  ('p3', '/assets/products/haori-dang-dai_1.jpg', 0),
  ('p3', '/assets/products/haori-dang-dai_2.jpg', 1),
  ('p3', '/assets/products/haori-dang-dai_3.jpg', 2),
  ('p3', '/assets/products/haori-dang-dai_4.jpg', 3),
  ('p4', '/assets/products/cardigan-dai_1.jpg', 0),
  ('p4', '/assets/products/cardigan-dai_2.jpg', 1),
  ('p4', '/assets/products/cardigan-dai_3.jpg', 2),
  ('p4', '/assets/products/cardigan-dai_4.jpg', 3),
  ('p5', '/assets/products/blazer-kaki_1.jpg', 0),
  ('p5', '/assets/products/blazer-kaki_2.jpg', 1),
  ('p5', '/assets/products/blazer-kaki_3.jpg', 2),
  ('p5', '/assets/products/blazer-kaki_4.jpg', 3),
  ('p6', '/assets/products/ao-len-cardigan_1.jpg', 0),
  ('p6', '/assets/products/ao-len-cardigan_2.jpg', 1),
  ('p6', '/assets/products/ao-len-cardigan_3.jpg', 2),
  ('p6', '/assets/products/ao-len-cardigan_4.jpg', 3),
  ('p7', '/assets/products/khoac-nhat_1.jpg', 0),
  ('p8', '/assets/products/dong-phuc-thuy-thu_1.jpg', 0),
  ('p8', '/assets/products/dong-phuc-thuy-thu_2.jpg', 1),
  ('p8', '/assets/products/dong-phuc-thuy-thu_3.jpg', 2),
  ('p8', '/assets/products/dong-phuc-thuy-thu_4.jpg', 3),
  ('p9', '/assets/products/so-mi-trang_1.jpg', 0),
  ('p9', '/assets/products/so-mi-trang_2.jpg', 1),
  ('p10', '/assets/products/ao-len-co-lo_1.jpg', 0),
  ('p10', '/assets/products/ao-len-co-lo_2.jpg', 1),
  ('p10', '/assets/products/ao-len-co-lo_3.jpg', 2),
  ('p10', '/assets/products/ao-len-co-lo_4.jpg', 3),
  ('p11', '/assets/products/balo-vai_1.jpg', 0),
  ('p11', '/assets/products/balo-vai_2.jpg', 1),
  ('p11', '/assets/products/balo-vai_3.jpg', 2),
  ('p11', '/assets/products/balo-vai_4.jpg', 3),
  ('p12', '/assets/products/giay-dep_1.jpg', 0),
  ('p12', '/assets/products/giay-dep_2.jpg', 1),
  ('p12', '/assets/products/giay-dep_3.jpg', 2),
  ('p12', '/assets/products/giay-dep_4.jpg', 3),
  ('p13', '/assets/products/mu-nhat_1.jpg', 0),
  ('p13', '/assets/products/mu-nhat_2.jpg', 1),
  ('p13', '/assets/products/mu-nhat_3.jpg', 2),
  ('p13', '/assets/products/mu-nhat_4.jpg', 3),
  ('p14', '/assets/products/du-nhat_1.jpg', 0),
  ('p14', '/assets/products/du-nhat_2.jpg', 1),
  ('p14', '/assets/products/du-nhat_3.jpg', 2),
  ('p14', '/assets/products/du-nhat_4.jpg', 3),
  ('p15', '/assets/products/gang-tay_1.jpg', 0),
  ('p15', '/assets/products/gang-tay_2.jpg', 1),
  ('p15', '/assets/products/gang-tay_3.jpg', 2),
  ('p15', '/assets/products/gang-tay_4.jpg', 3),
  ('p16', '/assets/products/vo-tat_1.jpg', 0),
  ('p16', '/assets/products/vo-tat_2.jpg', 1),
  ('p16', '/assets/products/vo-tat_3.jpg', 2),
  ('p16', '/assets/products/vo-tat_4.jpg', 3),
  ('p17', '/assets/products/kep-no_1.jpg', 0),
  ('p17', '/assets/products/kep-no_2.jpg', 1),
  ('p17', '/assets/products/kep-no_3.jpg', 2),
  ('p17', '/assets/products/kep-no_4.jpg', 3),
  ('p18', '/assets/products/chup-tai_1.jpg', 0),
  ('p18', '/assets/products/chup-tai_2.jpg', 1),
  ('p18', '/assets/products/chup-tai_3.jpg', 2),
  ('p18', '/assets/products/chup-tai_4.jpg', 3),
  ('p19', '/assets/products/guoc-geta_1.jpg', 0),
  ('p20', '/assets/products/kiem-go_1.jpg', 0),
  ('p21', '/assets/products/furina_1.jpg', 0),
  ('p21', '/assets/products/furina_2.jpg', 1),
  ('p21', '/assets/products/furina_3.jpg', 2),
  ('p21', '/assets/products/furina_4.jpg', 3),
  ('p22', '/assets/products/yae-miko_1.jpg', 0),
  ('p22', '/assets/products/yae-miko_2.jpg', 1),
  ('p22', '/assets/products/yae-miko_3.jpg', 2),
  ('p22', '/assets/products/yae-miko_4.jpg', 3),
  ('p23', '/assets/products/yumeko_1.jpg', 0),
  ('p23', '/assets/products/yumeko_2.jpg', 1),
  ('p23', '/assets/products/yumeko_3.jpg', 2),
  ('p23', '/assets/products/yumeko_4.jpg', 3),
  ('p24', '/assets/products/naruto_1.jpg', 0),
  ('p24', '/assets/products/naruto_2.jpg', 1),
  ('p24', '/assets/products/naruto_3.jpg', 2),
  ('p24', '/assets/products/naruto_4.jpg', 3),
  ('p1784163066006', 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D''http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg''%20width%3D''160''%20height%3D''190''%3E%3Crect%20width%3D''160''%20height%3D''190''%20fill%3D''%236A3817''%2F%3E%3Ctext%20x%3D''50%25''%20y%3D''54%25''%20font-size%3D''60''%20text-anchor%3D''middle''%20fill%3D''rgba(255%2C255%2C255%2C.85)''%20font-family%3D''serif''%3E%E7%9D%80%E7%89%A9%3C%2Ftext%3E%3C%2Fsvg%3E', 0);

INSERT INTO `product_variants` (`product_id`, `color_name`, `color_hex`, `size`, `sku`, `stock`) VALUES
  ('p1', 'Sumi', '#1A1410', 'S', 'KIMONOH-SU-S', 0),
  ('p1', 'Sumi', '#1A1410', 'M', 'KIMONOH-SU-M', 5),
  ('p1', 'Sumi', '#1A1410', 'L', 'KIMONOH-SU-L', 10),
  ('p1', 'Shu', '#A33A2F', 'S', 'KIMONOH-SH-S', 7),
  ('p1', 'Shu', '#A33A2F', 'M', 'KIMONOH-SH-M', 12),
  ('p1', 'Shu', '#A33A2F', 'L', 'KIMONOH-SH-L', 17),
  ('p1', 'Shu', '#A33A2F', 'XL', 'KIMONOH-SH-XL', 22),
  ('p2', 'Sumi', '#1A1410', 'S', 'YUKATAX-SU-S', 11),
  ('p2', 'Sumi', '#1A1410', 'M', 'YUKATAX-SU-M', 16),
  ('p2', 'Sumi', '#1A1410', 'L', 'YUKATAX-SU-L', 21),
  ('p2', 'Sumi', '#1A1410', 'XL', 'YUKATAX-SU-XL', 26),
  ('p2', 'Shu', '#A33A2F', 'S', 'YUKATAX-SH-S', 18),
  ('p2', 'Shu', '#A33A2F', 'M', 'YUKATAX-SH-M', 23),
  ('p2', 'Shu', '#A33A2F', 'L', 'YUKATAX-SH-L', 28),
  ('p2', 'Aizome', '#243244', 'S', 'YUKATAX-AI-S', 25),
  ('p2', 'Aizome', '#243244', 'M', 'YUKATAX-AI-M', 30),
  ('p2', 'Aizome', '#243244', 'L', 'YUKATAX-AI-L', 35),
  ('p2', 'Aizome', '#243244', 'XL', 'YUKATAX-AI-XL', 40),
  ('p3', 'Sumi', '#1A1410', 'S', 'HAORIDA-SU-S', 22),
  ('p3', 'Sumi', '#1A1410', 'M', 'HAORIDA-SU-M', 27),
  ('p3', 'Sumi', '#1A1410', 'L', 'HAORIDA-SU-L', 32),
  ('p3', 'Shu', '#A33A2F', 'S', 'HAORIDA-SH-S', 29),
  ('p3', 'Shu', '#A33A2F', 'M', 'HAORIDA-SH-M', 34),
  ('p3', 'Shu', '#A33A2F', 'L', 'HAORIDA-SH-L', 39),
  ('p3', 'Shu', '#A33A2F', 'XL', 'HAORIDA-SH-XL', 3),
  ('p4', 'Sumi', '#1A1410', 'S', 'CARDIGA-SU-S', 33),
  ('p4', 'Sumi', '#1A1410', 'M', 'CARDIGA-SU-M', 38),
  ('p4', 'Sumi', '#1A1410', 'L', 'CARDIGA-SU-L', 2),
  ('p4', 'Sumi', '#1A1410', 'XL', 'CARDIGA-SU-XL', 7),
  ('p4', 'Shu', '#A33A2F', 'S', 'CARDIGA-SH-S', 40),
  ('p4', 'Shu', '#A33A2F', 'M', 'CARDIGA-SH-M', 4),
  ('p4', 'Shu', '#A33A2F', 'L', 'CARDIGA-SH-L', 9),
  ('p4', 'Aizome', '#243244', 'S', 'CARDIGA-AI-S', 6),
  ('p4', 'Aizome', '#243244', 'M', 'CARDIGA-AI-M', 11),
  ('p4', 'Aizome', '#243244', 'L', 'CARDIGA-AI-L', 16),
  ('p4', 'Aizome', '#243244', 'XL', 'CARDIGA-AI-XL', 21),
  ('p5', 'Sumi', '#1A1410', 'S', 'BLAZERK-SU-S', 3),
  ('p5', 'Sumi', '#1A1410', 'M', 'BLAZERK-SU-M', 8),
  ('p5', 'Sumi', '#1A1410', 'L', 'BLAZERK-SU-L', 13),
  ('p5', 'Shu', '#A33A2F', 'S', 'BLAZERK-SH-S', 10),
  ('p5', 'Shu', '#A33A2F', 'M', 'BLAZERK-SH-M', 15),
  ('p5', 'Shu', '#A33A2F', 'L', 'BLAZERK-SH-L', 20),
  ('p5', 'Shu', '#A33A2F', 'XL', 'BLAZERK-SH-XL', 25),
  ('p6', 'Sumi', '#1A1410', 'S', 'AOLENCA-SU-S', 14),
  ('p6', 'Sumi', '#1A1410', 'M', 'AOLENCA-SU-M', 19),
  ('p6', 'Sumi', '#1A1410', 'L', 'AOLENCA-SU-L', 24),
  ('p6', 'Sumi', '#1A1410', 'XL', 'AOLENCA-SU-XL', 29),
  ('p6', 'Shu', '#A33A2F', 'S', 'AOLENCA-SH-S', 21),
  ('p6', 'Shu', '#A33A2F', 'M', 'AOLENCA-SH-M', 26),
  ('p6', 'Shu', '#A33A2F', 'L', 'AOLENCA-SH-L', 31),
  ('p6', 'Aizome', '#243244', 'S', 'AOLENCA-AI-S', 28),
  ('p6', 'Aizome', '#243244', 'M', 'AOLENCA-AI-M', 33),
  ('p6', 'Aizome', '#243244', 'L', 'AOLENCA-AI-L', 38),
  ('p6', 'Aizome', '#243244', 'XL', 'AOLENCA-AI-XL', 2),
  ('p7', 'Sumi', '#1A1410', 'S', 'KHOACNH-SU-S', 25),
  ('p7', 'Sumi', '#1A1410', 'M', 'KHOACNH-SU-M', 30),
  ('p7', 'Sumi', '#1A1410', 'L', 'KHOACNH-SU-L', 35),
  ('p7', 'Shu', '#A33A2F', 'S', 'KHOACNH-SH-S', 32),
  ('p7', 'Shu', '#A33A2F', 'M', 'KHOACNH-SH-M', 37),
  ('p7', 'Shu', '#A33A2F', 'L', 'KHOACNH-SH-L', 1),
  ('p7', 'Shu', '#A33A2F', 'XL', 'KHOACNH-SH-XL', 6),
  ('p8', 'Sumi', '#1A1410', 'S', 'DONGPHU-SU-S', 36),
  ('p8', 'Sumi', '#1A1410', 'M', 'DONGPHU-SU-M', 0),
  ('p8', 'Sumi', '#1A1410', 'L', 'DONGPHU-SU-L', 5),
  ('p8', 'Sumi', '#1A1410', 'XL', 'DONGPHU-SU-XL', 10),
  ('p8', 'Shu', '#A33A2F', 'S', 'DONGPHU-SH-S', 2),
  ('p8', 'Shu', '#A33A2F', 'M', 'DONGPHU-SH-M', 7),
  ('p8', 'Shu', '#A33A2F', 'L', 'DONGPHU-SH-L', 12),
  ('p8', 'Aizome', '#243244', 'S', 'DONGPHU-AI-S', 9),
  ('p8', 'Aizome', '#243244', 'M', 'DONGPHU-AI-M', 14),
  ('p8', 'Aizome', '#243244', 'L', 'DONGPHU-AI-L', 19),
  ('p8', 'Aizome', '#243244', 'XL', 'DONGPHU-AI-XL', 24),
  ('p9', 'Sumi', '#1A1410', 'S', 'SOMITRA-SU-S', 6),
  ('p9', 'Sumi', '#1A1410', 'M', 'SOMITRA-SU-M', 11),
  ('p9', 'Sumi', '#1A1410', 'L', 'SOMITRA-SU-L', 16),
  ('p9', 'Shu', '#A33A2F', 'S', 'SOMITRA-SH-S', 13),
  ('p9', 'Shu', '#A33A2F', 'M', 'SOMITRA-SH-M', 18),
  ('p9', 'Shu', '#A33A2F', 'L', 'SOMITRA-SH-L', 23),
  ('p9', 'Shu', '#A33A2F', 'XL', 'SOMITRA-SH-XL', 28),
  ('p10', 'Sumi', '#1A1410', 'S', 'AOLENCO-SU-S', 17),
  ('p10', 'Sumi', '#1A1410', 'M', 'AOLENCO-SU-M', 22),
  ('p10', 'Sumi', '#1A1410', 'L', 'AOLENCO-SU-L', 27),
  ('p10', 'Sumi', '#1A1410', 'XL', 'AOLENCO-SU-XL', 32),
  ('p10', 'Shu', '#A33A2F', 'S', 'AOLENCO-SH-S', 24),
  ('p10', 'Shu', '#A33A2F', 'M', 'AOLENCO-SH-M', 29),
  ('p10', 'Shu', '#A33A2F', 'L', 'AOLENCO-SH-L', 34),
  ('p10', 'Aizome', '#243244', 'S', 'AOLENCO-AI-S', 31),
  ('p10', 'Aizome', '#243244', 'M', 'AOLENCO-AI-M', 36),
  ('p10', 'Aizome', '#243244', 'L', 'AOLENCO-AI-L', 0),
  ('p10', 'Aizome', '#243244', 'XL', 'AOLENCO-AI-XL', 5),
  ('p11', 'Sumi', '#1A1410', 'S', 'BALOVAI-SU-S', 0),
  ('p11', 'Sumi', '#1A1410', 'M', 'BALOVAI-SU-M', 0),
  ('p11', 'Sumi', '#1A1410', 'L', 'BALOVAI-SU-L', 0),
  ('p11', 'Shu', '#A33A2F', 'S', 'BALOVAI-SH-S', 0),
  ('p11', 'Shu', '#A33A2F', 'M', 'BALOVAI-SH-M', 0),
  ('p11', 'Shu', '#A33A2F', 'L', 'BALOVAI-SH-L', 0),
  ('p11', 'Shu', '#A33A2F', 'XL', 'BALOVAI-SH-XL', 0),
  ('p12', 'Sumi', '#1A1410', 'S', 'GIAYDEP-SU-S', 39),
  ('p12', 'Sumi', '#1A1410', 'M', 'GIAYDEP-SU-M', 3),
  ('p12', 'Sumi', '#1A1410', 'L', 'GIAYDEP-SU-L', 8),
  ('p12', 'Sumi', '#1A1410', 'XL', 'GIAYDEP-SU-XL', 13),
  ('p12', 'Shu', '#A33A2F', 'S', 'GIAYDEP-SH-S', 5),
  ('p12', 'Shu', '#A33A2F', 'M', 'GIAYDEP-SH-M', 10),
  ('p12', 'Shu', '#A33A2F', 'L', 'GIAYDEP-SH-L', 15),
  ('p12', 'Aizome', '#243244', 'S', 'GIAYDEP-AI-S', 12),
  ('p12', 'Aizome', '#243244', 'M', 'GIAYDEP-AI-M', 17),
  ('p12', 'Aizome', '#243244', 'L', 'GIAYDEP-AI-L', 22),
  ('p12', 'Aizome', '#243244', 'XL', 'GIAYDEP-AI-XL', 27),
  ('p13', 'Sumi', '#1A1410', 'S', 'MUNHAT-SU-S', 9),
  ('p13', 'Sumi', '#1A1410', 'M', 'MUNHAT-SU-M', 14),
  ('p13', 'Sumi', '#1A1410', 'L', 'MUNHAT-SU-L', 19),
  ('p13', 'Shu', '#A33A2F', 'S', 'MUNHAT-SH-S', 16),
  ('p13', 'Shu', '#A33A2F', 'M', 'MUNHAT-SH-M', 21),
  ('p13', 'Shu', '#A33A2F', 'L', 'MUNHAT-SH-L', 26),
  ('p13', 'Shu', '#A33A2F', 'XL', 'MUNHAT-SH-XL', 31),
  ('p14', 'Sumi', '#1A1410', 'S', 'DUNHAT-SU-S', 20),
  ('p14', 'Sumi', '#1A1410', 'M', 'DUNHAT-SU-M', 25),
  ('p14', 'Sumi', '#1A1410', 'L', 'DUNHAT-SU-L', 30),
  ('p14', 'Sumi', '#1A1410', 'XL', 'DUNHAT-SU-XL', 35),
  ('p14', 'Shu', '#A33A2F', 'S', 'DUNHAT-SH-S', 27),
  ('p14', 'Shu', '#A33A2F', 'M', 'DUNHAT-SH-M', 32),
  ('p14', 'Shu', '#A33A2F', 'L', 'DUNHAT-SH-L', 37),
  ('p14', 'Aizome', '#243244', 'S', 'DUNHAT-AI-S', 34),
  ('p14', 'Aizome', '#243244', 'M', 'DUNHAT-AI-M', 39),
  ('p14', 'Aizome', '#243244', 'L', 'DUNHAT-AI-L', 3),
  ('p14', 'Aizome', '#243244', 'XL', 'DUNHAT-AI-XL', 8),
  ('p15', 'Sumi', '#1A1410', 'S', 'GANGTAY-SU-S', 31),
  ('p15', 'Sumi', '#1A1410', 'M', 'GANGTAY-SU-M', 36),
  ('p15', 'Sumi', '#1A1410', 'L', 'GANGTAY-SU-L', 0),
  ('p15', 'Shu', '#A33A2F', 'S', 'GANGTAY-SH-S', 38),
  ('p15', 'Shu', '#A33A2F', 'M', 'GANGTAY-SH-M', 2),
  ('p15', 'Shu', '#A33A2F', 'L', 'GANGTAY-SH-L', 7),
  ('p15', 'Shu', '#A33A2F', 'XL', 'GANGTAY-SH-XL', 12),
  ('p16', 'Sumi', '#1A1410', 'S', 'VOTAT-SU-S', 1),
  ('p16', 'Sumi', '#1A1410', 'M', 'VOTAT-SU-M', 6),
  ('p16', 'Sumi', '#1A1410', 'L', 'VOTAT-SU-L', 11),
  ('p16', 'Sumi', '#1A1410', 'XL', 'VOTAT-SU-XL', 16),
  ('p16', 'Shu', '#A33A2F', 'S', 'VOTAT-SH-S', 8),
  ('p16', 'Shu', '#A33A2F', 'M', 'VOTAT-SH-M', 13),
  ('p16', 'Shu', '#A33A2F', 'L', 'VOTAT-SH-L', 18),
  ('p16', 'Aizome', '#243244', 'S', 'VOTAT-AI-S', 15),
  ('p16', 'Aizome', '#243244', 'M', 'VOTAT-AI-M', 20),
  ('p16', 'Aizome', '#243244', 'L', 'VOTAT-AI-L', 25),
  ('p16', 'Aizome', '#243244', 'XL', 'VOTAT-AI-XL', 30),
  ('p17', 'Sumi', '#1A1410', 'S', 'KEPNO-SU-S', 12),
  ('p17', 'Sumi', '#1A1410', 'M', 'KEPNO-SU-M', 17),
  ('p17', 'Sumi', '#1A1410', 'L', 'KEPNO-SU-L', 22),
  ('p17', 'Shu', '#A33A2F', 'S', 'KEPNO-SH-S', 19),
  ('p17', 'Shu', '#A33A2F', 'M', 'KEPNO-SH-M', 24),
  ('p17', 'Shu', '#A33A2F', 'L', 'KEPNO-SH-L', 29),
  ('p17', 'Shu', '#A33A2F', 'XL', 'KEPNO-SH-XL', 34),
  ('p18', 'Sumi', '#1A1410', 'S', 'CHUPTAI-SU-S', 23),
  ('p18', 'Sumi', '#1A1410', 'M', 'CHUPTAI-SU-M', 28),
  ('p18', 'Sumi', '#1A1410', 'L', 'CHUPTAI-SU-L', 33),
  ('p18', 'Sumi', '#1A1410', 'XL', 'CHUPTAI-SU-XL', 38),
  ('p18', 'Shu', '#A33A2F', 'S', 'CHUPTAI-SH-S', 30),
  ('p18', 'Shu', '#A33A2F', 'M', 'CHUPTAI-SH-M', 35),
  ('p18', 'Shu', '#A33A2F', 'L', 'CHUPTAI-SH-L', 40),
  ('p18', 'Aizome', '#243244', 'S', 'CHUPTAI-AI-S', 37),
  ('p18', 'Aizome', '#243244', 'M', 'CHUPTAI-AI-M', 1),
  ('p18', 'Aizome', '#243244', 'L', 'CHUPTAI-AI-L', 6),
  ('p18', 'Aizome', '#243244', 'XL', 'CHUPTAI-AI-XL', 11),
  ('p19', 'Sumi', '#1A1410', 'S', 'GUOCGET-SU-S', 34),
  ('p19', 'Sumi', '#1A1410', 'M', 'GUOCGET-SU-M', 39),
  ('p19', 'Sumi', '#1A1410', 'L', 'GUOCGET-SU-L', 3),
  ('p19', 'Shu', '#A33A2F', 'S', 'GUOCGET-SH-S', 0),
  ('p19', 'Shu', '#A33A2F', 'M', 'GUOCGET-SH-M', 5),
  ('p19', 'Shu', '#A33A2F', 'L', 'GUOCGET-SH-L', 10),
  ('p19', 'Shu', '#A33A2F', 'XL', 'GUOCGET-SH-XL', 15),
  ('p20', 'Sumi', '#1A1410', 'S', 'KIEMGO-SU-S', 4),
  ('p20', 'Sumi', '#1A1410', 'M', 'KIEMGO-SU-M', 9),
  ('p20', 'Sumi', '#1A1410', 'L', 'KIEMGO-SU-L', 14),
  ('p20', 'Sumi', '#1A1410', 'XL', 'KIEMGO-SU-XL', 19),
  ('p20', 'Shu', '#A33A2F', 'S', 'KIEMGO-SH-S', 11),
  ('p20', 'Shu', '#A33A2F', 'M', 'KIEMGO-SH-M', 16),
  ('p20', 'Shu', '#A33A2F', 'L', 'KIEMGO-SH-L', 21),
  ('p20', 'Aizome', '#243244', 'S', 'KIEMGO-AI-S', 18),
  ('p20', 'Aizome', '#243244', 'M', 'KIEMGO-AI-M', 23),
  ('p20', 'Aizome', '#243244', 'L', 'KIEMGO-AI-L', 28),
  ('p20', 'Aizome', '#243244', 'XL', 'KIEMGO-AI-XL', 33),
  ('p21', 'Sumi', '#1A1410', 'S', 'FURINA-SU-S', 15),
  ('p21', 'Sumi', '#1A1410', 'M', 'FURINA-SU-M', 20),
  ('p21', 'Sumi', '#1A1410', 'L', 'FURINA-SU-L', 25),
  ('p21', 'Shu', '#A33A2F', 'S', 'FURINA-SH-S', 22),
  ('p21', 'Shu', '#A33A2F', 'M', 'FURINA-SH-M', 27),
  ('p21', 'Shu', '#A33A2F', 'L', 'FURINA-SH-L', 32),
  ('p21', 'Shu', '#A33A2F', 'XL', 'FURINA-SH-XL', 37),
  ('p22', 'Sumi', '#1A1410', 'S', 'YAEMIKO-SU-S', 26),
  ('p22', 'Sumi', '#1A1410', 'M', 'YAEMIKO-SU-M', 31),
  ('p22', 'Sumi', '#1A1410', 'L', 'YAEMIKO-SU-L', 36),
  ('p22', 'Sumi', '#1A1410', 'XL', 'YAEMIKO-SU-XL', 0),
  ('p22', 'Shu', '#A33A2F', 'S', 'YAEMIKO-SH-S', 33),
  ('p22', 'Shu', '#A33A2F', 'M', 'YAEMIKO-SH-M', 38),
  ('p22', 'Shu', '#A33A2F', 'L', 'YAEMIKO-SH-L', 2),
  ('p22', 'Aizome', '#243244', 'S', 'YAEMIKO-AI-S', 40),
  ('p22', 'Aizome', '#243244', 'M', 'YAEMIKO-AI-M', 4),
  ('p22', 'Aizome', '#243244', 'L', 'YAEMIKO-AI-L', 9),
  ('p22', 'Aizome', '#243244', 'XL', 'YAEMIKO-AI-XL', 14),
  ('p23', 'Sumi', '#1A1410', 'S', 'YUMEKO-SU-S', 37),
  ('p23', 'Sumi', '#1A1410', 'M', 'YUMEKO-SU-M', 1),
  ('p23', 'Sumi', '#1A1410', 'L', 'YUMEKO-SU-L', 6),
  ('p23', 'Shu', '#A33A2F', 'S', 'YUMEKO-SH-S', 3),
  ('p23', 'Shu', '#A33A2F', 'M', 'YUMEKO-SH-M', 8),
  ('p23', 'Shu', '#A33A2F', 'L', 'YUMEKO-SH-L', 13),
  ('p23', 'Shu', '#A33A2F', 'XL', 'YUMEKO-SH-XL', 18),
  ('p24', 'Sumi', '#1A1410', 'S', 'NARUTO-SU-S', 7),
  ('p24', 'Sumi', '#1A1410', 'M', 'NARUTO-SU-M', 12),
  ('p24', 'Sumi', '#1A1410', 'L', 'NARUTO-SU-L', 17),
  ('p24', 'Sumi', '#1A1410', 'XL', 'NARUTO-SU-XL', 22),
  ('p24', 'Shu', '#A33A2F', 'S', 'NARUTO-SH-S', 14),
  ('p24', 'Shu', '#A33A2F', 'M', 'NARUTO-SH-M', 19),
  ('p24', 'Shu', '#A33A2F', 'L', 'NARUTO-SH-L', 24),
  ('p24', 'Aizome', '#243244', 'S', 'NARUTO-AI-S', 21),
  ('p24', 'Aizome', '#243244', 'M', 'NARUTO-AI-M', 26),
  ('p24', 'Aizome', '#243244', 'L', 'NARUTO-AI-L', 31),
  ('p24', 'Aizome', '#243244', 'XL', 'NARUTO-AI-XL', 36),
  ('p1784163066006', 'Sumi', '#6A3817', 'M', 'SP-SU-M', 12),
  ('p1784163066006', 'Màu mới', '#A33A2F', 'M', 'SP-MÀ-M', 1),
  ('p1784163066006', 'Màu mới', '#A33A2F', 'M', 'SP-MÀ-M', 2),
  ('p1784163066006', 'Màu mới', '#A33A2F', 'M', 'SP-MÀ-M', 3);

INSERT INTO `product_tags` (`product_id`, `tag`, `kind`) VALUES
  ('p1', 'lễ hội', 'tag'),
  ('p1', 'thanh lịch', 'tag'),
  ('p1', 'hồng', 'tag'),
  ('p1', 'lễ hội', 'visual'),
  ('p1', 'thanh lịch', 'visual'),
  ('p1', 'hồng', 'visual'),
  ('p2', 'mùa hè', 'tag'),
  ('p2', 'xanh', 'tag'),
  ('p2', 'tối giản', 'tag'),
  ('p2', 'mùa hè', 'visual'),
  ('p2', 'xanh', 'visual'),
  ('p2', 'tối giản', 'visual'),
  ('p3', 'layer', 'tag'),
  ('p3', 'truyền thống', 'tag'),
  ('p3', 'dáng dài', 'tag'),
  ('p3', 'layer', 'visual'),
  ('p3', 'truyền thống', 'visual'),
  ('p3', 'dáng dài', 'visual'),
  ('p4', 'cardigan', 'tag'),
  ('p4', 'ấm', 'tag'),
  ('p4', 'công sở', 'tag'),
  ('p4', 'cardigan', 'visual'),
  ('p4', 'ấm', 'visual'),
  ('p4', 'công sở', 'visual'),
  ('p5', 'blazer', 'tag'),
  ('p5', 'kaki', 'tag'),
  ('p5', 'công sở', 'tag'),
  ('p5', 'blazer', 'visual'),
  ('p5', 'kaki', 'visual'),
  ('p5', 'công sở', 'visual'),
  ('p6', 'cardigan', 'tag'),
  ('p6', 'dệt kim', 'tag'),
  ('p6', 'nhẹ nhàng', 'tag'),
  ('p6', 'cardigan', 'visual'),
  ('p6', 'dệt kim', 'visual'),
  ('p6', 'nhẹ nhàng', 'visual'),
  ('p7', 'áo khoác', 'tag'),
  ('p7', 'nhật', 'tag'),
  ('p7', 'layer', 'tag'),
  ('p7', 'áo khoác', 'visual'),
  ('p7', 'nhật', 'visual'),
  ('p7', 'layer', 'visual'),
  ('p8', 'thủy thủ', 'tag'),
  ('p8', 'nữ', 'tag'),
  ('p8', 'học đường', 'tag'),
  ('p8', 'thủy thủ', 'visual'),
  ('p8', 'nữ', 'visual'),
  ('p8', 'học đường', 'visual'),
  ('p9', 'sơ mi', 'tag'),
  ('p9', 'trắng', 'tag'),
  ('p9', 'công sở', 'tag'),
  ('p9', 'sơ mi', 'visual'),
  ('p9', 'trắng', 'visual'),
  ('p9', 'công sở', 'visual'),
  ('p10', 'áo len', 'tag'),
  ('p10', 'cổ lọ', 'tag'),
  ('p10', 'mùa đông', 'tag'),
  ('p10', 'áo len', 'visual'),
  ('p10', 'cổ lọ', 'visual'),
  ('p10', 'mùa đông', 'visual'),
  ('p11', 'balo', 'tag'),
  ('p11', 'đi học', 'tag'),
  ('p11', 'vải', 'tag'),
  ('p11', 'balo', 'visual'),
  ('p11', 'đi học', 'visual'),
  ('p11', 'vải', 'visual'),
  ('p12', 'dép', 'tag'),
  ('p12', 'giày', 'tag'),
  ('p12', 'hằng ngày', 'tag'),
  ('p12', 'dép', 'visual'),
  ('p12', 'giày', 'visual'),
  ('p12', 'hằng ngày', 'visual'),
  ('p13', 'mũ', 'tag'),
  ('p13', 'streetwear', 'tag'),
  ('p13', 'unisex', 'tag'),
  ('p13', 'mũ', 'visual'),
  ('p13', 'streetwear', 'visual'),
  ('p13', 'unisex', 'visual'),
  ('p14', 'dù', 'tag'),
  ('p14', 'lễ hội', 'tag'),
  ('p14', 'chụp ảnh', 'tag'),
  ('p14', 'dù', 'visual'),
  ('p14', 'lễ hội', 'visual'),
  ('p14', 'chụp ảnh', 'visual'),
  ('p15', 'găng tay', 'tag'),
  ('p15', 'len', 'tag'),
  ('p15', 'mùa đông', 'tag'),
  ('p15', 'găng tay', 'visual'),
  ('p15', 'len', 'visual'),
  ('p15', 'mùa đông', 'visual'),
  ('p16', 'vớ', 'tag'),
  ('p16', 'tất', 'tag'),
  ('p16', 'học đường', 'tag'),
  ('p16', 'vớ', 'visual'),
  ('p16', 'tất', 'visual'),
  ('p16', 'học đường', 'visual'),
  ('p17', 'kẹp tóc', 'tag'),
  ('p17', 'nơ', 'tag'),
  ('p17', 'dễ thương', 'tag'),
  ('p17', 'kẹp tóc', 'visual'),
  ('p17', 'nơ', 'visual'),
  ('p17', 'dễ thương', 'visual'),
  ('p18', 'chụp tai', 'tag'),
  ('p18', 'nữ', 'tag'),
  ('p18', 'mùa đông', 'tag'),
  ('p18', 'chụp tai', 'visual'),
  ('p18', 'nữ', 'visual'),
  ('p18', 'mùa đông', 'visual'),
  ('p19', 'geta', 'tag'),
  ('p19', 'guốc gỗ', 'tag'),
  ('p19', 'truyền thống', 'tag'),
  ('p19', 'geta', 'visual'),
  ('p19', 'guốc gỗ', 'visual'),
  ('p19', 'truyền thống', 'visual'),
  ('p20', 'kiếm gỗ', 'tag'),
  ('p20', 'đạo cụ', 'tag'),
  ('p20', 'cosplay', 'tag'),
  ('p20', 'kiếm gỗ', 'visual'),
  ('p20', 'đạo cụ', 'visual'),
  ('p20', 'cosplay', 'visual'),
  ('p21', 'cosplay', 'tag'),
  ('p21', 'sự kiện', 'tag'),
  ('p21', 'xanh', 'tag'),
  ('p21', 'cosplay', 'visual'),
  ('p21', 'sự kiện', 'visual'),
  ('p21', 'xanh', 'visual'),
  ('p22', 'cosplay', 'tag'),
  ('p22', 'sự kiện', 'tag'),
  ('p22', 'hồng', 'tag'),
  ('p22', 'cosplay', 'visual'),
  ('p22', 'sự kiện', 'visual'),
  ('p22', 'hồng', 'visual'),
  ('p23', 'cosplay', 'tag'),
  ('p23', 'đỏ', 'tag'),
  ('p23', 'học đường', 'tag'),
  ('p23', 'cosplay', 'visual'),
  ('p23', 'đỏ', 'visual'),
  ('p23', 'học đường', 'visual'),
  ('p24', 'cosplay', 'tag'),
  ('p24', 'anime', 'tag'),
  ('p24', 'cam', 'tag'),
  ('p24', 'cosplay', 'visual'),
  ('p24', 'anime', 'visual'),
  ('p24', 'cam', 'visual');

INSERT INTO `profiles` (`user_id`, `gender`, `skin_tone`, `occasion`, `budget`, `height_cm`, `weight_kg`, `usual_size`, `updated_at`) VALUES
  ('u1', 'Unisex', 'Trung bình', 'Đi học/đi làm', 700000, 156, 48, 'S', 1783920972477),
  ('u2', 'Nữ', 'Sáng', 'Đi chơi', 950000, 159, 52, 'M', 1783834572477),
  ('u3', 'Unisex', 'Trung bình', 'Đi học/đi làm', 1200000, 162, 56, 'L', 1783748172477),
  ('u4', 'Nữ', 'Sáng', 'Đi chơi', 1450000, 165, 60, 'XL', 1783661772477),
  ('u5', 'Unisex', 'Trung bình', 'Đi học/đi làm', 1700000, 168, 64, 'S', 1783575372477),
  ('u6', 'Nữ', 'Sáng', 'Đi chơi', 1950000, 171, 68, 'M', 1783488972477),
  ('demo-minh', NULL, NULL, NULL, NULL, 165, NULL, NULL, 1784630227904),
  ('verify-user', NULL, NULL, 'Đi làm', 1500000, NULL, NULL, NULL, 1784552301777);

INSERT INTO `profile_styles` (`user_id`, `style`) VALUES
  ('u1', 'Nhật cổ'),
  ('u1', 'Thanh lịch'),
  ('u2', 'Tối giản'),
  ('u2', 'Công sở'),
  ('u3', 'Streetwear'),
  ('u4', 'Nhật cổ'),
  ('u4', 'Thanh lịch'),
  ('u5', 'Tối giản'),
  ('u5', 'Công sở'),
  ('u6', 'Streetwear'),
  ('demo-minh', 'truyền thống'),
  ('demo-minh', 'nhật'),
  ('demo-minh', 'lễ hội'),
  ('verify-user', 'tối giản'),
  ('verify-user', 'nhẹ nhàng'),
  ('verify-user', 'unisex');

INSERT INTO `orders` (`id`, `code`, `user_id`, `customer_name`, `customer_email`, `customer_phone`, `address`, `ward_code`, `ward`, `province_code`, `province`, `subtotal`, `discount`, `voucher_discount`, `payment_discount`, `discount_code`, `total`, `ship`, `payment_method`, `payment_provider`, `payment_status`, `payment_txn`, `payment_currency`, `status`, `source`, `created_at`) VALUES
  ('o1', 'JP240700', 'u1', 'Trần Minh', NULL, '0910000000', '123 Lê Lợi, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1970000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0001', NULL, 'completed', 'demo', 1783748172477),
  ('o2', 'JP240701', 'u2', 'Nguyễn Thu Hà', NULL, '0910007919', '45 Bà Triệu, P. Hoàn Kiếm, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1470000, 30000, 'COD', NULL, 'paid', '—', NULL, 'completed', 'demo', 1783053372477),
  ('o3', 'JP240702', 'u3', 'Lê Quốc Bảo', NULL, '0910015838', '78 Trần Phú, P. Hải Châu, Đà Nẵng', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 310000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0003', NULL, 'shipping', 'demo', 1782358572477),
  ('o4', 'JP240703', 'u4', 'Phạm Mỹ Linh', NULL, '0910023757', '12 Nguyễn Huệ, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1680000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'confirmed', 'demo', 1781663772477),
  ('o5', 'JP240704', 'u5', 'Hoàng Anh Tú', NULL, '0910031676', '90 Cầu Giấy, P. Cầu Giấy, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1020000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0005', NULL, 'completed', 'demo', 1780968972477),
  ('o6', 'JP240705', 'u6', 'Đặng Khánh Vy', NULL, '0910039595', '123 Lê Lợi, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1810000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'cancelled', 'demo', 1780274172477),
  ('o7', 'JP240706', 'u7', 'Vũ Hải Nam', NULL, '0910047514', '45 Bà Triệu, P. Hoàn Kiếm, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1470000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0007', NULL, 'completed', 'demo', 1779579372477),
  ('o8', 'JP240707', 'u8', 'Bùi Ngọc Ánh', NULL, '0910055433', '78 Trần Phú, P. Hải Châu, Đà Nẵng', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 730000, 30000, 'COD', NULL, 'paid', '—', NULL, 'completed', 'demo', 1778884572477),
  ('o9', 'JP240708', 'u9', 'Đỗ Gia Huy', NULL, '0910063352', '12 Nguyễn Huệ, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 450000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0009', NULL, 'shipping', 'demo', 1778189772477),
  ('o10', 'JP240709', 'u10', 'Lý Cẩm Tú', NULL, '0910071271', '90 Cầu Giấy, P. Cầu Giấy, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 3620000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'confirmed', 'demo', 1777494972477),
  ('o11', 'JP240710', 'u1', 'Trần Minh', NULL, '0910079190', '123 Lê Lợi, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1020000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0011', NULL, 'completed', 'demo', 1776800172477),
  ('o12', 'JP240711', 'u2', 'Nguyễn Thu Hà', NULL, '0910087109', '45 Bà Triệu, P. Hoàn Kiếm, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1210000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'cancelled', 'demo', 1776105372477),
  ('o13', 'JP240712', 'u3', 'Lê Quốc Bảo', NULL, '0910095028', '78 Trần Phú, P. Hải Châu, Đà Nẵng', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1260000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0013', NULL, 'completed', 'demo', 1775453772477),
  ('o14', 'JP240713', 'u4', 'Phạm Mỹ Linh', NULL, '0910102947', '12 Nguyễn Huệ, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 670000, 30000, 'COD', NULL, 'paid', '—', NULL, 'completed', 'demo', 1774758972477),
  ('o15', 'JP240714', 'u5', 'Hoàng Anh Tú', NULL, '0910110866', '90 Cầu Giấy, P. Cầu Giấy, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1920000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0015', NULL, 'shipping', 'demo', 1774064172477),
  ('o16', 'JP240715', 'u6', 'Đặng Khánh Vy', NULL, '0910118785', '123 Lê Lợi, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1750000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'confirmed', 'demo', 1773369372477),
  ('o17', 'JP240716', 'u7', 'Vũ Hải Nam', NULL, '0910126704', '45 Bà Triệu, P. Hoàn Kiếm, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 520000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0017', NULL, 'completed', 'demo', 1772674572477),
  ('o18', 'JP240717', 'u8', 'Bùi Ngọc Ánh', NULL, '0910134623', '78 Trần Phú, P. Hải Châu, Đà Nẵng', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 210000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'cancelled', 'demo', 1771979772477),
  ('o19', 'JP240718', 'u9', 'Đỗ Gia Huy', NULL, '0910142542', '12 Nguyễn Huệ, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1100000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0019', NULL, 'completed', 'demo', 1771284972477),
  ('o20', 'JP240719', 'u10', 'Lý Cẩm Tú', NULL, '0910150461', '90 Cầu Giấy, P. Cầu Giấy, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 2610000, 30000, 'COD', NULL, 'paid', '—', NULL, 'completed', 'demo', 1770590172477),
  ('o21', 'JP240720', 'u1', 'Trần Minh', NULL, '0910158380', '123 Lê Lợi, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1180000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0021', NULL, 'shipping', 'demo', 1769895372477),
  ('o22', 'JP240721', 'u2', 'Nguyễn Thu Hà', NULL, '0910166299', '45 Bà Triệu, P. Hoàn Kiếm, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1090000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'confirmed', 'demo', 1769200572477),
  ('o23', 'JP240722', 'u3', 'Lê Quốc Bảo', NULL, '0910174218', '78 Trần Phú, P. Hải Châu, Đà Nẵng', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 150000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0023', NULL, 'completed', 'demo', 1768505772477),
  ('o24', 'JP240723', 'u4', 'Phạm Mỹ Linh', NULL, '0910182137', '12 Nguyễn Huệ, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 2130000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'cancelled', 'demo', 1767810972477),
  ('o25', 'JP240724', 'u5', 'Hoàng Anh Tú', NULL, '0910190056', '90 Cầu Giấy, P. Cầu Giấy, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1970000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0025', NULL, 'completed', 'demo', 1767159372477),
  ('o26', 'JP240725', 'u6', 'Đặng Khánh Vy', NULL, '0910197975', '123 Lê Lợi, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1470000, 30000, 'COD', NULL, 'paid', '—', NULL, 'completed', 'demo', 1766464572477),
  ('o27', 'JP240726', 'u7', 'Vũ Hải Nam', NULL, '0910205894', '45 Bà Triệu, P. Hoàn Kiếm, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 310000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0027', NULL, 'shipping', 'demo', 1765769772477),
  ('o28', 'JP240727', 'u8', 'Bùi Ngọc Ánh', NULL, '0910213813', '78 Trần Phú, P. Hải Châu, Đà Nẵng', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1680000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'confirmed', 'demo', 1765074972477),
  ('o29', 'JP240728', 'u9', 'Đỗ Gia Huy', NULL, '0910221732', '12 Nguyễn Huệ, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1020000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0029', NULL, 'completed', 'demo', 1764380172477),
  ('o30', 'JP240729', 'u10', 'Lý Cẩm Tú', NULL, '0910229651', '90 Cầu Giấy, P. Cầu Giấy, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1810000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'cancelled', 'demo', 1763685372477),
  ('o31', 'JP240730', 'u1', 'Trần Minh', NULL, '0910237570', '123 Lê Lợi, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1470000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0031', NULL, 'completed', 'demo', 1762990572477),
  ('o32', 'JP240731', 'u2', 'Nguyễn Thu Hà', NULL, '0910245489', '45 Bà Triệu, P. Hoàn Kiếm, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 730000, 30000, 'COD', NULL, 'paid', '—', NULL, 'completed', 'demo', 1762295772477),
  ('o33', 'JP240732', 'u3', 'Lê Quốc Bảo', NULL, '0910253408', '78 Trần Phú, P. Hải Châu, Đà Nẵng', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 450000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0033', NULL, 'shipping', 'demo', 1761600972477),
  ('o34', 'JP240733', 'u4', 'Phạm Mỹ Linh', NULL, '0910261327', '12 Nguyễn Huệ, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 3620000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'confirmed', 'demo', 1760906172477),
  ('o35', 'JP240734', 'u5', 'Hoàng Anh Tú', NULL, '0910269246', '90 Cầu Giấy, P. Cầu Giấy, Hà Nội', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1020000, 30000, 'Stripe', NULL, 'paid', 'pi_seed_0035', NULL, 'completed', 'demo', 1760211372477),
  ('o36', 'JP240735', 'u6', 'Đặng Khánh Vy', NULL, '0910277165', '123 Lê Lợi, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1210000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'cancelled', 'demo', 1759516572477),
  ('o1784162249095', 'JP240736', 'demo-minh', 'Trần Minh', NULL, '0901 234 567', '123 Lê Lợi, P. Bến Nghé, Hồ Chí Minh', NULL, NULL, NULL, NULL, 6060000, 606000, 0, 0, 'JAPANO10', 5484000, 30000, 'COD', NULL, 'unpaid', '—', NULL, 'shipping', 'mobile', 1784162249095),
  ('o1784162785835', 'JP240737', NULL, 'Lý Cẩm Tú', NULL, '0996908503', '12 Nguyễn Huệ, P. Bến Nghé, HCM', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 1380000, 30000, 'COD', NULL, 'paid', '—', NULL, 'completed', 'admin-test', 1784162785835),
  ('o1784194545648', 'JP240738', 'demo-minh', 'JAPANO Stripe Test', 'nhat.stripe.test@example.com', '0901234567', '123 Test, Ho Chi Minh', NULL, NULL, NULL, NULL, 90000, 9000, 0, 9000, 'STRIPE10', 111000, 30000, 'Stripe', 'stripe', 'cancelled', '—', 'vnd', 'cancelled', 'mobile', 1784194545648),
  ('o1784194860381', 'JP240739', 'demo-minh', 'JAPANO E2E Test', 'nhat.stripe.test@example.com', '0901234567', '123 Test, Ho Chi Minh', NULL, NULL, NULL, NULL, 90000, 9000, 0, 9000, 'STRIPE10', 111000, 30000, 'Stripe', 'stripe', 'refunded', 'pi_3TtlnV46LydUHMTH0eTu2tK4', 'vnd', 'returned', 'mobile', 1784194860381),
  ('o1784206566598', 'JP240740', 'demo-minh', 'Trần Minh', 'ban@japano.vn', '0908239032', '1, Phường An Hội Tây, Thành phố Hồ Chí Minh', '26882', 'Phường An Hội Tây', '79', 'Thành phố Hồ Chí Minh', 6610000, 661000, 0, 661000, 'STRIPE10', 5979000, 30000, 'Stripe', 'stripe', 'paid', 'pi_3Ttov746LydUHMTH124J7NIy', 'vnd', 'confirmed', 'mobile', 1784206566598),
  ('o1784207098908', 'JP240741', 'demo-minh', 'Trần Minh', 'ban@japano.vn', '0908239032', '1, Phường An Hội Tây, Thành phố Hồ Chí Minh', '26882', 'Phường An Hội Tây', '79', 'Thành phố Hồ Chí Minh', 6610000, 661000, 0, 661000, 'STRIPE10', 5979000, 30000, 'Stripe', 'stripe', 'cancelled', '—', 'vnd', 'cancelled', 'mobile', 1784207098908),
  ('o1784207395309', 'JP240742', 'demo-minh', 'Trần Minh', 'ban@japano.vn', '123123123', '123, Phường An Thắng, Thành phố Đà Nẵng', '20575', 'Phường An Thắng', '48', 'Thành phố Đà Nẵng', 1890000, 189000, 0, 189000, 'STRIPE10', 1731000, 30000, 'Stripe', 'stripe', 'failed', '—', 'vnd', 'pending_payment', 'mobile', 1784207395309),
  ('o1784207985812', 'JP240743', 'demo-minh', 'Trần Minh', 'ban@japano.vn', '123123123', '123, Phường An Bình, Thành phố Cần Thơ', '31150', 'Phường An Bình', '92', 'Thành phố Cần Thơ', 1890000, 189000, 0, 189000, 'STRIPE10', 1731000, 30000, 'Stripe', 'stripe', 'failed', '—', 'vnd', 'pending_payment', 'mobile', 1784207985812),
  ('o1784265344904', 'JP240744', 'demo-minh', 'Trần Minh', 'ban@japano.vn', '0909999999', '123, Phường An Đông, Thành phố Hồ Chí Minh', '27316', 'Phường An Đông', '79', 'Thành phố Hồ Chí Minh', 1290000, 129000, 0, 129000, 'STRIPE10', 1191000, 30000, 'Stripe', 'stripe', 'paid', 'pi_3Tu47h46LydUHMTH0y0QFB34', 'vnd', 'confirmed', 'mobile', 1784265344904),
  ('o1784539452366', 'JP240745', 'demo-minh', 'Trần Minh', 'ban@japano.vn', '0908232358', '124, Phường An Bình, Thành phố Cần Thơ', '31150', 'Phường An Bình', '92', 'Thành phố Cần Thơ', 890000, 89000, 0, 89000, 'STRIPE10', 831000, 30000, 'Stripe', 'stripe', 'paid', 'pi_3TvDQm46LydUHMTH1O5YAysw', 'vnd', 'confirmed', 'mobile', 1784539452366),
  ('o1784623762896', 'JP240746', 'demo-minh', 'Trần Minh', 'ban@japano.vn', '0909060686', '123, Phường An Bình, Thành phố Cần Thơ', '31150', 'Phường An Bình', '92', 'Thành phố Cần Thơ', 1290000, 64500, 0, 64500, 'VNPAY5', 1255500, 30000, 'VNPay', 'vnpay', 'paid', 'JP240746', 'VND', 'confirmed', 'mobile', 1784623762896),
  ('o1784625155471', 'JP240747', 'demo-minh', 'Trần Minh', 'ban@japano.vn', '0909090906', '123, Phường Bình Thuỷ, Thành phố Cần Thơ', '31168', 'Phường Bình Thuỷ', '92', 'Thành phố Cần Thơ', 1290000, 64500, 0, 64500, 'VNPAY5', 1255500, 30000, 'VNPay', 'vnpay', 'pending', 'JP240747', 'VND', 'pending_payment', 'mobile', 1784625155471),
  ('o1784625616396', 'JP240748', 'demo-minh', 'Trần Minh', 'ban@japano.vn', '0908980986', '122, Phường Bình Thuỷ, Thành phố Cần Thơ', '31168', 'Phường Bình Thuỷ', '92', 'Thành phố Cần Thơ', 1290000, 64500, 0, 64500, 'VNPAY5', 1255500, 30000, 'VNPay', 'vnpay', 'pending', 'JP240748', 'VND', 'pending_payment', 'mobile', 1784625616396),
  ('o1784631853615', 'JP240749', 'demo-minh', 'Lê Minh Nhật', 'ban@japano.vn', '0909090909', '45, Phường Thới An, Thành phố Hồ Chí Minh', '26773', 'Phường Thới An', '79', 'Thành phố Hồ Chí Minh', 4470000, 30000, 30000, 0, 'FREESHIP', 4470000, 30000, 'COD', 'cod', 'unpaid', '—', 'vnd', 'pending', 'mobile', 1784631853615);

INSERT INTO `order_items` (`order_id`, `product_slug`, `name`, `color_name`, `color_hex`, `size`, `qty`, `price`) VALUES
  ('o1', 'haori-dang-dai', 'Áo choàng Haori dáng dài', 'Sumi', '#33261d', 'S', 1, 1350000),
  ('o1', 'ao-len-co-lo', 'Áo len cổ lọ dệt kim', 'Aizome', '#8B6B4A', 'M', 1, 590000),
  ('o2', 'dong-phuc-thuy-thu', 'Đồng phục thủy thủ nữ', 'Sumi', '#243244', 'M', 2, 720000),
  ('o3', 'mu-nhat', 'Mũ bo Nhật', 'Sumi', '#31363A', 'L', 1, 280000),
  ('o4', 'chup-tai', 'Chụp tai nữ', 'Sumi', '#D7B9B2', 'XL', 2, 250000),
  ('o4', 'khoac-nhat', 'Áo khoác Nhật bản mùa', 'Aizome', '#2F3B35', 'S', 1, 1150000),
  ('o5', 'yumeko', 'Cosplay Yumeko Jabami', 'Sumi', '#8A2F26', 'S', 1, 990000),
  ('o6', 'cardigan-dai', 'Cardigan len dáng dài', 'Sumi', '#6B7255', 'M', 2, 890000),
  ('o7', 'so-mi-trang', 'Sơ mi trắng tay ngắn', 'Sumi', '#E5E7EB', 'L', 1, 550000),
  ('o7', 'cardigan-dai', 'Cardigan len dáng dài', 'Aizome', '#6B7255', 'XL', 1, 890000),
  ('o8', 'du-nhat', 'Dù Nhật bản', 'Sumi', '#6B7255', 'XL', 2, 350000),
  ('o9', 'guoc-geta', 'Guốc gỗ Geta', 'Sumi', '#7c5a3a', 'S', 1, 420000),
  ('o10', 'naruto', 'Cosplay Naruto', 'Sumi', '#D97706', 'M', 2, 850000),
  ('o10', 'kimono-hong', 'Kimono truyền thống Hồng', 'Aizome', '#C06A86', 'L', 1, 1890000),
  ('o11', 'blazer-kaki', 'Blazer kaki trench', 'Sumi', '#B08D3C', 'L', 1, 990000),
  ('o12', 'ao-len-co-lo', 'Áo len cổ lọ dệt kim', 'Sumi', '#8B6B4A', 'XL', 2, 590000),
  ('o13', 'gang-tay', 'Găng tay len', 'Sumi', '#7B5D51', 'S', 1, 180000),
  ('o13', 'yae-miko', 'Cosplay Yae Miko', 'Aizome', '#C0483B', 'M', 1, 1050000),
  ('o14', 'kiem-go', 'Kiếm gỗ Nhật bản', 'Sumi', '#6F4E37', 'M', 2, 320000),
  ('o15', 'kimono-hong', 'Kimono truyền thống Hồng', 'Sumi', '#C06A86', 'L', 1, 1890000),
  ('o16', 'ao-len-cardigan', 'Áo len dệt kim cardigan', 'Sumi', '#A88C75', 'XL', 2, 650000),
  ('o16', 'guoc-geta', 'Guốc gỗ Geta', 'Aizome', '#7c5a3a', 'S', 1, 420000),
  ('o17', 'balo-vai', 'Balo vải Nhật', 'Sumi', '#8A2F26', 'S', 1, 490000),
  ('o18', 'vo-tat', 'Vớ tất cổ cao', 'Sumi', '#F1EEE8', 'M', 2, 90000),
  ('o19', 'furina', 'Cosplay Furina', 'Sumi', '#4FA3D1', 'L', 1, 980000),
  ('o19', 'vo-tat', 'Vớ tất cổ cao', 'Aizome', '#F1EEE8', 'XL', 1, 90000),
  ('o20', 'yukata-xanh', 'Yukata cotton xanh đen', 'Sumi', '#243244', 'XL', 2, 1290000),
  ('o21', 'khoac-nhat', 'Áo khoác Nhật bản mùa', 'Sumi', '#2F3B35', 'S', 1, 1150000),
  ('o22', 'giay-dep', 'Dép quai Nhật', 'Sumi', '#795548', 'M', 2, 390000),
  ('o22', 'mu-nhat', 'Mũ bo Nhật', 'Aizome', '#31363A', 'L', 1, 280000),
  ('o23', 'kep-no', 'Kẹp nơ tóc', 'Sumi', '#A33A2F', 'L', 1, 120000),
  ('o24', 'yae-miko', 'Cosplay Yae Miko', 'Sumi', '#C0483B', 'XL', 2, 1050000),
  ('o25', 'haori-dang-dai', 'Áo choàng Haori dáng dài', 'Sumi', '#33261d', 'S', 1, 1350000),
  ('o25', 'ao-len-co-lo', 'Áo len cổ lọ dệt kim', 'Aizome', '#8B6B4A', 'M', 1, 590000),
  ('o26', 'dong-phuc-thuy-thu', 'Đồng phục thủy thủ nữ', 'Sumi', '#243244', 'M', 2, 720000),
  ('o27', 'mu-nhat', 'Mũ bo Nhật', 'Sumi', '#31363A', 'L', 1, 280000),
  ('o28', 'chup-tai', 'Chụp tai nữ', 'Sumi', '#D7B9B2', 'XL', 2, 250000),
  ('o28', 'khoac-nhat', 'Áo khoác Nhật bản mùa', 'Aizome', '#2F3B35', 'S', 1, 1150000),
  ('o29', 'yumeko', 'Cosplay Yumeko Jabami', 'Sumi', '#8A2F26', 'S', 1, 990000),
  ('o30', 'cardigan-dai', 'Cardigan len dáng dài', 'Sumi', '#6B7255', 'M', 2, 890000),
  ('o31', 'so-mi-trang', 'Sơ mi trắng tay ngắn', 'Sumi', '#E5E7EB', 'L', 1, 550000),
  ('o31', 'cardigan-dai', 'Cardigan len dáng dài', 'Aizome', '#6B7255', 'XL', 1, 890000),
  ('o32', 'du-nhat', 'Dù Nhật bản', 'Sumi', '#6B7255', 'XL', 2, 350000),
  ('o33', 'guoc-geta', 'Guốc gỗ Geta', 'Sumi', '#7c5a3a', 'S', 1, 420000),
  ('o34', 'naruto', 'Cosplay Naruto', 'Sumi', '#D97706', 'M', 2, 850000),
  ('o34', 'kimono-hong', 'Kimono truyền thống Hồng', 'Aizome', '#C06A86', 'L', 1, 1890000),
  ('o35', 'blazer-kaki', 'Blazer kaki trench', 'Sumi', '#B08D3C', 'L', 1, 990000),
  ('o36', 'ao-len-co-lo', 'Áo len cổ lọ dệt kim', 'Sumi', '#8B6B4A', 'XL', 2, 590000),
  ('o1784162249095', 'kimono-hong', 'Kimono truyền thống Hồng', 'Sumi', '#1A1410', 'M', 1, 1890000),
  ('o1784162249095', 'yukata-xanh', 'Yukata cotton xanh đen', 'Sumi', '#1A1410', 'M', 1, 1290000),
  ('o1784162249095', 'cardigan-dai', 'Cardigan len dáng dài', 'Sumi', '#1A1410', 'M', 1, 890000),
  ('o1784162249095', 'mu-nhat', 'Mũ bo Nhật', 'Sumi', '#1A1410', 'M', 1, 280000),
  ('o1784162249095', 'guoc-geta', 'Guốc gỗ Geta', 'Sumi', '#1A1410', 'M', 1, 420000),
  ('o1784162249095', 'yukata-xanh', 'Yukata cotton xanh đen', 'Sumi (mực)', '#1A1410', 'M', 1, 1290000),
  ('o1784162785835', 'haori-dang-dai', 'Áo choàng Haori dáng dài', 'Sumi', '#1A1410', 'L', 1, 1350000),
  ('o1784194545648', 'vo-tat', 'Vớ tất cổ cao', 'Sumi', '#F1EEE8', 'M', 1, 90000),
  ('o1784194860381', 'vo-tat', 'Vớ tất cổ cao', 'Sumi', '#F1EEE8', 'M', 1, 90000),
  ('o1784206566598', 'kimono-hong', 'Kimono truyền thống Hồng', 'Sumi', '#1A1410', 'M', 1, 1890000),
  ('o1784206566598', 'yukata-xanh', 'Yukata vải bông xanh đen', 'Sumi', '#1A1410', 'M', 1, 1290000),
  ('o1784206566598', 'cardigan-dai', 'Áo len khoác dáng dài', 'Sumi', '#1A1410', 'M', 1, 890000),
  ('o1784206566598', 'mu-nhat', 'Mũ bo Nhật', 'Sumi', '#1A1410', 'M', 1, 280000),
  ('o1784206566598', 'guoc-geta', 'Guốc gỗ Geta', 'Sumi', '#1A1410', 'M', 1, 420000),
  ('o1784206566598', 'yukata-xanh', 'Yukata vải bông xanh đen', 'Sumi (mực)', '#1A1410', 'M', 1, 1290000),
  ('o1784206566598', 'so-mi-trang', 'Sơ mi trắng tay ngắn', 'Mực', '#1A1410', 'M', 1, 550000),
  ('o1784207098908', 'kimono-hong', 'Kimono truyền thống Hồng', 'Sumi', '#1A1410', 'M', 1, 1890000),
  ('o1784207098908', 'yukata-xanh', 'Yukata vải bông xanh đen', 'Sumi', '#1A1410', 'M', 1, 1290000),
  ('o1784207098908', 'cardigan-dai', 'Áo len khoác dáng dài', 'Sumi', '#1A1410', 'M', 1, 890000),
  ('o1784207098908', 'mu-nhat', 'Mũ bo Nhật', 'Sumi', '#1A1410', 'M', 1, 280000),
  ('o1784207098908', 'guoc-geta', 'Guốc gỗ Geta', 'Sumi', '#1A1410', 'M', 1, 420000),
  ('o1784207098908', 'yukata-xanh', 'Yukata vải bông xanh đen', 'Sumi (mực)', '#1A1410', 'M', 1, 1290000),
  ('o1784207098908', 'so-mi-trang', 'Sơ mi trắng tay ngắn', 'Mực', '#1A1410', 'M', 1, 550000),
  ('o1784207395309', 'kimono-hong', 'Kimono truyền thống Hồng', 'Mực', '#1A1410', 'M', 1, 1890000),
  ('o1784207985812', 'kimono-hong', 'Kimono truyền thống Hồng', 'Mực', '#1A1410', 'M', 1, 1890000),
  ('o1784265344904', 'yukata-xanh', 'Yukata vải bông xanh đen', 'Mực', '#1A1410', 'M', 1, 1290000),
  ('o1784539452366', 'cardigan-dai', 'Áo len khoác dáng dài', 'Mực', '#1A1410', 'M', 1, 890000),
  ('o1784623762896', 'yukata-xanh', 'Yukata vải bông xanh đen', 'Mực', '#1A1410', 'M', 1, 1290000),
  ('o1784625155471', 'yukata-xanh', 'Yukata vải bông xanh đen', 'Mực', '#1A1410', 'M', 1, 1290000),
  ('o1784625616396', 'yukata-xanh', 'Yukata vải bông xanh đen', 'Mực', '#1A1410', 'M', 1, 1290000),
  ('o1784631853615', 'yukata-xanh', 'Yukata vải bông xanh đen', 'Mực', '#1A1410', 'M', 2, 1290000),
  ('o1784631853615', 'kimono-hong', 'Kimono truyền thống Hồng', 'Mực', '#1A1410', 'M', 1, 1890000);

INSERT INTO `order_history` (`order_id`, `status`, `at`) VALUES
  ('o1', 'pending', 1783748172477),
  ('o1', 'confirmed', 1783776972477),
  ('o1', 'shipping', 1783805772477),
  ('o1', 'completed', 1783834572477),
  ('o2', 'pending', 1783053372477),
  ('o2', 'confirmed', 1783082172477),
  ('o2', 'shipping', 1783110972477),
  ('o2', 'completed', 1783139772477),
  ('o3', 'pending', 1782358572477),
  ('o3', 'confirmed', 1782387372477),
  ('o3', 'shipping', 1782416172477),
  ('o4', 'pending', 1781663772477),
  ('o4', 'confirmed', 1781692572477),
  ('o5', 'pending', 1780968972477),
  ('o5', 'confirmed', 1780997772477),
  ('o5', 'shipping', 1781026572477),
  ('o5', 'completed', 1781055372477),
  ('o6', 'pending', 1780274172477),
  ('o6', 'cancelled', 1780277772477),
  ('o7', 'pending', 1779579372477),
  ('o7', 'confirmed', 1779608172477),
  ('o7', 'shipping', 1779636972477),
  ('o7', 'completed', 1779665772477),
  ('o8', 'pending', 1778884572477),
  ('o8', 'confirmed', 1778913372477),
  ('o8', 'shipping', 1778942172477),
  ('o8', 'completed', 1778970972477),
  ('o9', 'pending', 1778189772477),
  ('o9', 'confirmed', 1778218572477),
  ('o9', 'shipping', 1778247372477),
  ('o10', 'pending', 1777494972477),
  ('o10', 'confirmed', 1777523772477),
  ('o11', 'pending', 1776800172477),
  ('o11', 'confirmed', 1776828972477),
  ('o11', 'shipping', 1776857772477),
  ('o11', 'completed', 1776886572477),
  ('o12', 'pending', 1776105372477),
  ('o12', 'cancelled', 1776108972477),
  ('o13', 'pending', 1775453772477),
  ('o13', 'confirmed', 1775482572477),
  ('o13', 'shipping', 1775511372477),
  ('o13', 'completed', 1775540172477),
  ('o14', 'pending', 1774758972477),
  ('o14', 'confirmed', 1774787772477),
  ('o14', 'shipping', 1774816572477),
  ('o14', 'completed', 1774845372477),
  ('o15', 'pending', 1774064172477),
  ('o15', 'confirmed', 1774092972477),
  ('o15', 'shipping', 1774121772477),
  ('o16', 'pending', 1773369372477),
  ('o16', 'confirmed', 1773398172477),
  ('o17', 'pending', 1772674572477),
  ('o17', 'confirmed', 1772703372477),
  ('o17', 'shipping', 1772732172477),
  ('o17', 'completed', 1772760972477),
  ('o18', 'pending', 1771979772477),
  ('o18', 'cancelled', 1771983372477),
  ('o19', 'pending', 1771284972477),
  ('o19', 'confirmed', 1771313772477),
  ('o19', 'shipping', 1771342572477),
  ('o19', 'completed', 1771371372477),
  ('o20', 'pending', 1770590172477),
  ('o20', 'confirmed', 1770618972477),
  ('o20', 'shipping', 1770647772477),
  ('o20', 'completed', 1770676572477),
  ('o21', 'pending', 1769895372477),
  ('o21', 'confirmed', 1769924172477),
  ('o21', 'shipping', 1769952972477),
  ('o22', 'pending', 1769200572477),
  ('o22', 'confirmed', 1769229372477),
  ('o23', 'pending', 1768505772477),
  ('o23', 'confirmed', 1768534572477),
  ('o23', 'shipping', 1768563372477),
  ('o23', 'completed', 1768592172477),
  ('o24', 'pending', 1767810972477),
  ('o24', 'cancelled', 1767814572477),
  ('o25', 'pending', 1767159372477),
  ('o25', 'confirmed', 1767188172477),
  ('o25', 'shipping', 1767216972477),
  ('o25', 'completed', 1767245772477),
  ('o26', 'pending', 1766464572477),
  ('o26', 'confirmed', 1766493372477),
  ('o26', 'shipping', 1766522172477),
  ('o26', 'completed', 1766550972477),
  ('o27', 'pending', 1765769772477),
  ('o27', 'confirmed', 1765798572477),
  ('o27', 'shipping', 1765827372477),
  ('o28', 'pending', 1765074972477),
  ('o28', 'confirmed', 1765103772477),
  ('o29', 'pending', 1764380172477),
  ('o29', 'confirmed', 1764408972477),
  ('o29', 'shipping', 1764437772477),
  ('o29', 'completed', 1764466572477),
  ('o30', 'pending', 1763685372477),
  ('o30', 'cancelled', 1763688972477),
  ('o31', 'pending', 1762990572477),
  ('o31', 'confirmed', 1763019372477),
  ('o31', 'shipping', 1763048172477),
  ('o31', 'completed', 1763076972477),
  ('o32', 'pending', 1762295772477),
  ('o32', 'confirmed', 1762324572477),
  ('o32', 'shipping', 1762353372477),
  ('o32', 'completed', 1762382172477),
  ('o33', 'pending', 1761600972477),
  ('o33', 'confirmed', 1761629772477),
  ('o33', 'shipping', 1761658572477),
  ('o34', 'pending', 1760906172477),
  ('o34', 'confirmed', 1760934972477),
  ('o35', 'pending', 1760211372477),
  ('o35', 'confirmed', 1760240172477),
  ('o35', 'shipping', 1760268972477),
  ('o35', 'completed', 1760297772477),
  ('o36', 'pending', 1759516572477),
  ('o36', 'cancelled', 1759520172477),
  ('o1784162249095', 'pending', 1784162249095),
  ('o1784162249095', 'confirmed', 1784163236406),
  ('o1784162249095', 'shipping', 1784163337272),
  ('o1784162785835', 'pending', 1784162785835),
  ('o1784162785835', 'confirmed', 1784163181214),
  ('o1784162785835', 'shipping', 1784163185799),
  ('o1784162785835', 'completed', 1784163193358),
  ('o1784194545648', 'pending_payment', 1784194545648),
  ('o1784194545648', 'cancelled', 1784195363995),
  ('o1784194860381', 'pending_payment', 1784194860381),
  ('o1784194860381', 'paid', 1784194904499),
  ('o1784194860381', 'completed', 1784194939554),
  ('o1784194860381', 'return_requested', 1784194939560),
  ('o1784194860381', 'return_approved', 1784194939564),
  ('o1784194860381', 'return_received', 1784194939569),
  ('o1784194860381', 'refunded', 1784194940649),
  ('o1784206566598', 'pending_payment', 1784206566598),
  ('o1784206566598', 'paid', 1784206908261),
  ('o1784207098908', 'pending_payment', 1784207098908),
  ('o1784207098908', 'cancelled', 1784207166209),
  ('o1784207395309', 'pending_payment', 1784207395309),
  ('o1784207395309', 'payment_failed', 1784648129410),
  ('o1784207985812', 'pending_payment', 1784207985812),
  ('o1784207985812', 'payment_failed', 1784648129714),
  ('o1784265344904', 'pending_payment', 1784265344904),
  ('o1784265344904', 'paid', 1784267003258),
  ('o1784539452366', 'pending_payment', 1784539452366),
  ('o1784539452366', 'paid', 1784539454896),
  ('o1784623762896', 'pending_payment', 1784623762896),
  ('o1784623762896', 'paid', 1784625548234),
  ('o1784625155471', 'pending_payment', 1784625155471),
  ('o1784625616396', 'pending_payment', 1784625616396),
  ('o1784631853615', 'pending', 1784631853615);

INSERT INTO `payments` (`id`, `code`, `order_id`, `user_id`, `provider`, `method`, `status`, `amount`, `original_amount`, `discount`, `voucher_discount`, `payment_discount`, `promotion_code`, `currency`, `transaction_code`, `payment_intent_id`, `checkout_session_id`, `refundable`, `amount_subtotal`, `paid_at`, `charge_id`, `receipt_url`, `created_at`, `updated_at`) VALUES
  ('pay-migrated-o1', 'PAY-JP240700', 'o1', 'u1', 'stripe-seed', 'Stripe', 'paid', 1970000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0001', 'pi_seed_0001', NULL, 0, NULL, NULL, NULL, NULL, 1783748172477, 1783748172477),
  ('pay-migrated-o3', 'PAY-JP240702', 'o3', 'u3', 'stripe-seed', 'Stripe', 'paid', 310000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0003', 'pi_seed_0003', NULL, 0, NULL, NULL, NULL, NULL, 1782358572477, 1782358572477),
  ('pay-migrated-o5', 'PAY-JP240704', 'o5', 'u5', 'stripe-seed', 'Stripe', 'paid', 1020000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0005', 'pi_seed_0005', NULL, 0, NULL, NULL, NULL, NULL, 1780968972477, 1780968972477),
  ('pay-migrated-o7', 'PAY-JP240706', 'o7', 'u7', 'stripe-seed', 'Stripe', 'paid', 1470000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0007', 'pi_seed_0007', NULL, 0, NULL, NULL, NULL, NULL, 1779579372477, 1779579372477),
  ('pay-migrated-o9', 'PAY-JP240708', 'o9', 'u9', 'stripe-seed', 'Stripe', 'paid', 450000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0009', 'pi_seed_0009', NULL, 0, NULL, NULL, NULL, NULL, 1778189772477, 1778189772477),
  ('pay-migrated-o11', 'PAY-JP240710', 'o11', 'u1', 'stripe-seed', 'Stripe', 'paid', 1020000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0011', 'pi_seed_0011', NULL, 0, NULL, NULL, NULL, NULL, 1776800172477, 1776800172477),
  ('pay-migrated-o13', 'PAY-JP240712', 'o13', 'u3', 'stripe-seed', 'Stripe', 'paid', 1260000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0013', 'pi_seed_0013', NULL, 0, NULL, NULL, NULL, NULL, 1775453772477, 1775453772477),
  ('pay-migrated-o15', 'PAY-JP240714', 'o15', 'u5', 'stripe-seed', 'Stripe', 'paid', 1920000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0015', 'pi_seed_0015', NULL, 0, NULL, NULL, NULL, NULL, 1774064172477, 1774064172477),
  ('pay-migrated-o17', 'PAY-JP240716', 'o17', 'u7', 'stripe-seed', 'Stripe', 'paid', 520000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0017', 'pi_seed_0017', NULL, 0, NULL, NULL, NULL, NULL, 1772674572477, 1772674572477),
  ('pay-migrated-o19', 'PAY-JP240718', 'o19', 'u9', 'stripe-seed', 'Stripe', 'paid', 1100000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0019', 'pi_seed_0019', NULL, 0, NULL, NULL, NULL, NULL, 1771284972477, 1771284972477),
  ('pay-migrated-o21', 'PAY-JP240720', 'o21', 'u1', 'stripe-seed', 'Stripe', 'paid', 1180000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0021', 'pi_seed_0021', NULL, 0, NULL, NULL, NULL, NULL, 1769895372477, 1769895372477),
  ('pay-migrated-o23', 'PAY-JP240722', 'o23', 'u3', 'stripe-seed', 'Stripe', 'paid', 150000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0023', 'pi_seed_0023', NULL, 0, NULL, NULL, NULL, NULL, 1768505772477, 1768505772477),
  ('pay-migrated-o25', 'PAY-JP240724', 'o25', 'u5', 'stripe-seed', 'Stripe', 'paid', 1970000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0025', 'pi_seed_0025', NULL, 0, NULL, NULL, NULL, NULL, 1767159372477, 1767159372477),
  ('pay-migrated-o27', 'PAY-JP240726', 'o27', 'u7', 'stripe-seed', 'Stripe', 'paid', 310000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0027', 'pi_seed_0027', NULL, 0, NULL, NULL, NULL, NULL, 1765769772477, 1765769772477),
  ('pay-migrated-o29', 'PAY-JP240728', 'o29', 'u9', 'stripe-seed', 'Stripe', 'paid', 1020000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0029', 'pi_seed_0029', NULL, 0, NULL, NULL, NULL, NULL, 1764380172477, 1764380172477),
  ('pay-migrated-o31', 'PAY-JP240730', 'o31', 'u1', 'stripe-seed', 'Stripe', 'paid', 1470000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0031', 'pi_seed_0031', NULL, 0, NULL, NULL, NULL, NULL, 1762990572477, 1762990572477),
  ('pay-migrated-o33', 'PAY-JP240732', 'o33', 'u3', 'stripe-seed', 'Stripe', 'paid', 450000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0033', 'pi_seed_0033', NULL, 0, NULL, NULL, NULL, NULL, 1761600972477, 1761600972477),
  ('pay-migrated-o35', 'PAY-JP240734', 'o35', 'u5', 'stripe-seed', 'Stripe', 'paid', 1020000, NULL, 0, 0, 0, NULL, 'vnd', 'pi_seed_0035', 'pi_seed_0035', NULL, 0, NULL, NULL, NULL, NULL, 1760211372477, 1760211372477),
  ('pay-1784194545648', 'PAY-JP240738-545648', 'o1784194545648', 'demo-minh', 'stripe', 'Stripe', 'cancelled', 111000, 120000, 9000, 0, 9000, 'STRIPE10', 'vnd', NULL, NULL, 'cs_test_a1fWHQT1FRyfGWm39GdtpECM3j0DcZGwMDrbkXxUUx3DPeZY6DBjnP0d1t', 0, NULL, NULL, NULL, NULL, 1784194545648, 1784195363995),
  ('pay-1784194860381', 'PAY-JP240739-860381', 'o1784194860381', 'demo-minh', 'stripe', 'Stripe', 'refunded', 111000, 120000, 9000, 0, 9000, 'STRIPE10', 'vnd', 'pi_3TtlnV46LydUHMTH0eTu2tK4', 'pi_3TtlnV46LydUHMTH0eTu2tK4', 'cs_test_a1jG6ajYqRFxApaNIHWtbtoa2VvU5qUawvJnD701Fx7Sq1zrnbim93NNGC', 1, 111000, 1784194904499, 'ch_3TtlnV46LydUHMTH0FLn161f', 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xVFdDU2s0Nkx5ZFVITVRIKNjO4tIGMgbH-4NYXGE6LBZFCGm1yP4XHvm_pSY7LrroYLMO4CFGEPAKaoYhZ2gXlHNHXdmKOTjZcaNL', 1784194860381, 1784194940649),
  ('pay-1784206566598', 'PAY-JP240740-566598', 'o1784206566598', 'demo-minh', 'stripe', 'Stripe', 'paid', 5979000, 6640000, 661000, 0, 661000, 'STRIPE10', 'vnd', 'pi_3Ttov746LydUHMTH124J7NIy', 'pi_3Ttov746LydUHMTH124J7NIy', 'cs_test_a1W0KtihRPHC7vSZTjmgLzkVW66r2a7QowIYPrrJqaSRKo9dSpQsD7DouY', 1, 5979000, 1784206908261, 'ch_3Ttov746LydUHMTH1e5jLgUo', 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xVFdDU2s0Nkx5ZFVITVRIKLys49IGMgYN7gh26c86LBavAyLegG0VAC_L-VGXSEF2IckR04K8ARmbS46o1Q2F05ZcS9q3jQuq6i-2', 1784206566598, 1784206908261),
  ('pay-1784207098909', 'PAY-JP240741-098909', 'o1784207098908', 'demo-minh', 'stripe', 'Stripe', 'cancelled', 5979000, 6640000, 661000, 0, 661000, 'STRIPE10', 'vnd', NULL, NULL, 'cs_test_a1E6UsIdXEsv8pBMvgWcjDqvNYs3daJgh34jElXMx7pYsm1OjiRKswXmzh', 0, NULL, NULL, NULL, NULL, 1784207098909, 1784207166209),
  ('pay-1784207395309', 'PAY-JP240742-395309', 'o1784207395309', 'demo-minh', 'stripe', 'Stripe', 'failed', 1731000, 1920000, 189000, 0, 189000, 'STRIPE10', 'vnd', NULL, NULL, 'cs_test_a1uu56gEHL5otNR80WV6spg26agnmuac875MfOjjNiwCGhGorVNDsZV6fY', 0, NULL, NULL, NULL, NULL, 1784207395309, 1784648129410),
  ('pay-1784207985812', 'PAY-JP240743-985812', 'o1784207985812', 'demo-minh', 'stripe', 'Stripe', 'failed', 1731000, 1920000, 189000, 0, 189000, 'STRIPE10', 'vnd', NULL, NULL, 'cs_test_a1DT7KUjAiN1aLJpR6MQp1OeSZ94eM2EbFH205SXkfQiMoNloFTis6APEn', 0, NULL, NULL, NULL, NULL, 1784207985812, 1784648129714),
  ('pay-1784265344904', 'PAY-JP240744-344904', 'o1784265344904', 'demo-minh', 'stripe', 'Stripe', 'paid', 1191000, 1320000, 129000, 0, 129000, 'STRIPE10', 'vnd', 'pi_3Tu47h46LydUHMTH0y0QFB34', 'pi_3Tu47h46LydUHMTH0y0QFB34', NULL, 1, NULL, 1784267003258, 'ch_3Tu47h46LydUHMTH0AzZmYm7', 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xVFdDU2s0Nkx5ZFVITVRIKPuB59IGMgaWPYKMyb06LBbnVvJNcZNIBDILo9B6_izYenYvIa7wbqKeS_1uuyBlq9JeeFhrhxfUrDj7', 1784265344904, 1784267003258),
  ('pay-1784539452366', 'PAY-JP240745-452366', 'o1784539452366', 'demo-minh', 'stripe', 'Stripe', 'paid', 831000, 920000, 89000, 0, 89000, 'STRIPE10', 'vnd', 'pi_3TvDQm46LydUHMTH1O5YAysw', 'pi_3TvDQm46LydUHMTH1O5YAysw', NULL, 1, NULL, 1784539454896, 'ch_3TvDQm46LydUHMTH1yWxTmLU', 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xVFdDU2s0Nkx5ZFVITVRIKL7S99IGMgZXo_o1uIo6LBYtZN6_XA0FCrpC652slIxxXgBHN-PLLzH_i4tPUOXPO4OJsjPjqSAOKeeW', 1784539452366, 1784539454896),
  ('pay-1784623762896', 'PAY-JP240746-762896', 'o1784623762896', 'demo-minh', 'vnpay', 'VNPay', 'paid', 1255500, 1320000, 64500, 0, 64500, 'VNPAY5', 'VND', 'JP240746', NULL, NULL, 1, NULL, 1784625548234, NULL, NULL, 1784623762896, 1784625548234),
  ('pay-1784625155471', 'PAY-JP240747-155471', 'o1784625155471', 'demo-minh', 'vnpay', 'VNPay', 'pending', 1255500, 1320000, 64500, 0, 64500, 'VNPAY5', 'VND', 'JP240747', NULL, NULL, 0, NULL, NULL, NULL, NULL, 1784625155471, 1784625437554),
  ('pay-1784625616396', 'PAY-JP240748-616396', 'o1784625616396', 'demo-minh', 'vnpay', 'VNPay', 'pending', 1255500, 1320000, 64500, 0, 64500, 'VNPAY5', 'VND', 'JP240748', NULL, NULL, 0, NULL, NULL, NULL, NULL, 1784625616396, 1784625616397);

INSERT INTO `return_requests` (`id`, `code`, `order_id`, `user_id`, `payment_id`, `status`, `reason`, `note`, `admin_note`, `amount`, `currency`, `refund_id`, `refund_status`, `created_at`, `updated_at`) VALUES
  ('ret-1784194939560', 'RTN-JP240739-39560', 'o1784194860381', 'demo-minh', 'pay-1784194860381', 'refunded', 'Kiểm thử quy trình trả hàng Stripe', 'E2E tự động: sản phẩm còn nguyên vẹn.', NULL, 111000, 'vnd', 're_3TtlnV46LydUHMTH0Apc9O77', 'succeeded', 1784194939560, 1784194940649);

INSERT INTO `return_request_items` (`return_request_id`, `product_slug`, `name`, `size`, `color_name`, `qty`, `price`) VALUES
  ('ret-1784194939560', 'vo-tat', 'Vớ tất cổ cao', 'M', 'Sumi', 1, 90000);

INSERT INTO `return_request_timeline` (`return_request_id`, `status`, `at`, `refund_id`, `note`) VALUES
  ('ret-1784194939560', 'requested', 1784194939560, NULL, NULL),
  ('ret-1784194939560', 'approved', 1784194939564, NULL, NULL),
  ('ret-1784194939560', 'received', 1784194939569, NULL, NULL),
  ('ret-1784194939560', 'refunded', 1784194940649, 're_3TtlnV46LydUHMTH0Apc9O77', NULL);

INSERT INTO `payment_refunds` (`id`, `payment_id`, `amount`, `currency`, `status`, `reason`, `failure_reason`, `return_request_id`, `created_at`, `updated_at`) VALUES
  ('re_3TtlnV46LydUHMTH0Apc9O77', 'pay-1784194860381', 111000, 'vnd', 'succeeded', 'requested_by_customer', NULL, 'ret-1784194939560', 1784194939000, 1784194940649);

-- (không có dữ liệu cho carts)

-- (không có dữ liệu cho cart_items)

-- (không có dữ liệu cho reviews)

-- (không có dữ liệu cho review_reactions)

-- (không có dữ liệu cho moderation_samples)

INSERT INTO `voucher_redemptions` (`id`, `code`, `user_id`, `order_id`, `discount`, `redeemed_at`) VALUES
  ('redeem-o1784631853615', 'FREESHIP', 'demo-minh', 'o1784631853615', 30000, 1784631853615);

INSERT INTO `flagcard_collections` (`id`, `user_id`, `created_at`, `updated_at`) VALUES
  ('flags-demo-minh', 'demo-minh', 1784206908261, 1784540414640);

INSERT INTO `flagcard_collection_awards` (`collection_id`, `flagcard_id`, `order_id`, `order_code`, `order_total`, `awarded_at`, `source`) VALUES
  ('flags-demo-minh', 'kiyomizu-dera', 'o1784206566598', 'JP240740', 5979000, 1784206908261, 'qualifying-order'),
  ('flags-demo-minh', 'fushimi-inari', 'o1784162249095', 'JP240736', 5484000, 1784540414640, 'qualifying-order');

INSERT INTO `interactions` (`id`, `user_id`, `product_slug`, `type`, `value`, `created_at`, `source`) VALUES
  ('i1', 'u1', 'kimono-hong', 'view', 1, 1783920972477, 'demo'),
  ('i2', 'u2', 'so-mi-trang', 'view', 1, 1783902972477, 'demo'),
  ('i3', 'u3', 'kep-no', 'wishlist', 1, 1783884972477, 'demo'),
  ('i4', 'u4', 'kimono-hong', 'cart', 1, 1783866972477, 'demo'),
  ('i5', 'u5', 'so-mi-trang', 'purchase', 5, 1783848972477, 'demo'),
  ('i6', 'u6', 'giay-dep', 'tryon', 1, 1783830972477, 'demo'),
  ('i7', 'u7', 'kiem-go', 'view', 1, 1783812972477, 'demo'),
  ('i8', 'u8', 'cardigan-dai', 'view', 1, 1783794972477, 'demo'),
  ('i9', 'u9', 'giay-dep', 'wishlist', 1, 1783776972477, 'demo'),
  ('i10', 'u10', 'kiem-go', 'cart', 1, 1783758972477, 'demo'),
  ('i11', 'u1', 'yumeko', 'purchase', 5, 1783740972477, 'demo'),
  ('i12', 'u2', 'khoac-nhat', 'tryon', 1, 1783722972477, 'demo'),
  ('i13', 'u3', 'gang-tay', 'view', 1, 1783704972477, 'demo'),
  ('i14', 'u4', 'yumeko', 'view', 1, 1783686972477, 'demo'),
  ('i15', 'u5', 'khoac-nhat', 'wishlist', 1, 1783668972477, 'demo'),
  ('i16', 'u6', 'ao-len-co-lo', 'cart', 1, 1783650972477, 'demo'),
  ('i17', 'u7', 'chup-tai', 'purchase', 5, 1783632972477, 'demo'),
  ('i18', 'u8', 'yukata-xanh', 'tryon', 1, 1783614972477, 'demo'),
  ('i19', 'u9', 'ao-len-co-lo', 'view', 1, 1783596972477, 'demo'),
  ('i20', 'u10', 'chup-tai', 'view', 1, 1783578972477, 'demo'),
  ('i21', 'u1', 'furina', 'wishlist', 1, 1783560972477, 'demo'),
  ('i22', 'u2', 'blazer-kaki', 'cart', 1, 1783542972477, 'demo'),
  ('i23', 'u3', 'mu-nhat', 'purchase', 5, 1783524972477, 'demo'),
  ('i24', 'u4', 'furina', 'tryon', 1, 1783506972477, 'demo'),
  ('i25', 'u5', 'blazer-kaki', 'view', 1, 1783488972477, 'demo'),
  ('i26', 'u6', 'dong-phuc-thuy-thu', 'view', 1, 1783470972477, 'demo'),
  ('i27', 'u7', 'vo-tat', 'wishlist', 1, 1783452972477, 'demo'),
  ('i28', 'u8', 'naruto', 'cart', 1, 1783434972477, 'demo'),
  ('i29', 'u9', 'dong-phuc-thuy-thu', 'purchase', 5, 1783416972477, 'demo'),
  ('i30', 'u10', 'vo-tat', 'tryon', 1, 1783398972477, 'demo'),
  ('i31', 'u1', 'guoc-geta', 'view', 1, 1783380972477, 'demo'),
  ('i32', 'u2', 'haori-dang-dai', 'view', 1, 1783362972477, 'demo'),
  ('i33', 'u3', 'balo-vai', 'wishlist', 1, 1783344972477, 'demo'),
  ('i34', 'u4', 'guoc-geta', 'cart', 1, 1783326972477, 'demo'),
  ('i35', 'u5', 'haori-dang-dai', 'purchase', 5, 1783308972477, 'demo'),
  ('i36', 'u6', 'ao-len-cardigan', 'tryon', 1, 1783290972477, 'demo'),
  ('i37', 'u7', 'du-nhat', 'view', 1, 1783272972477, 'demo'),
  ('i38', 'u8', 'yae-miko', 'view', 1, 1783254972477, 'demo'),
  ('i39', 'u9', 'ao-len-cardigan', 'wishlist', 1, 1783236972477, 'demo'),
  ('i40', 'u10', 'du-nhat', 'cart', 1, 1783218972477, 'demo'),
  ('i41', 'u1', 'kep-no', 'purchase', 5, 1783200972477, 'demo'),
  ('i42', 'u2', 'kimono-hong', 'tryon', 1, 1783182972477, 'demo'),
  ('i43', 'u3', 'so-mi-trang', 'view', 1, 1783164972477, 'demo'),
  ('i44', 'u4', 'kep-no', 'view', 1, 1783146972477, 'demo'),
  ('i45', 'u5', 'kimono-hong', 'wishlist', 1, 1783128972477, 'demo'),
  ('i46', 'u6', 'cardigan-dai', 'cart', 1, 1783110972477, 'demo'),
  ('i47', 'u7', 'giay-dep', 'purchase', 5, 1783092972477, 'demo'),
  ('i48', 'u8', 'kiem-go', 'tryon', 1, 1783074972477, 'demo'),
  ('i49', 'u9', 'cardigan-dai', 'view', 1, 1783056972477, 'demo'),
  ('i50', 'u10', 'giay-dep', 'view', 1, 1783038972477, 'demo'),
  ('i51', 'u1', 'gang-tay', 'wishlist', 1, 1783020972477, 'demo'),
  ('i52', 'u2', 'yumeko', 'cart', 1, 1783002972477, 'demo'),
  ('i53', 'u3', 'khoac-nhat', 'purchase', 5, 1782984972477, 'demo'),
  ('i54', 'u4', 'gang-tay', 'tryon', 1, 1782966972477, 'demo'),
  ('i55', 'u5', 'yumeko', 'view', 1, 1782948972477, 'demo'),
  ('i56', 'u6', 'yukata-xanh', 'view', 1, 1782930972477, 'demo'),
  ('i57', 'u7', 'ao-len-co-lo', 'wishlist', 1, 1782912972477, 'demo'),
  ('i58', 'u8', 'chup-tai', 'cart', 1, 1782894972477, 'demo'),
  ('i59', 'u9', 'yukata-xanh', 'purchase', 5, 1782876972477, 'demo'),
  ('i60', 'u10', 'ao-len-co-lo', 'tryon', 1, 1782858972477, 'demo'),
  ('i61', 'u1', 'mu-nhat', 'view', 1, 1782840972477, 'demo'),
  ('i62', 'u2', 'furina', 'view', 1, 1782822972477, 'demo'),
  ('i63', 'u3', 'blazer-kaki', 'wishlist', 1, 1782804972477, 'demo'),
  ('i64', 'u4', 'mu-nhat', 'cart', 1, 1782786972477, 'demo'),
  ('i65', 'u5', 'furina', 'purchase', 5, 1782768972477, 'demo'),
  ('i66', 'u6', 'naruto', 'tryon', 1, 1782750972477, 'demo'),
  ('i67', 'u7', 'dong-phuc-thuy-thu', 'view', 1, 1782732972477, 'demo'),
  ('i68', 'u8', 'vo-tat', 'view', 1, 1782714972477, 'demo'),
  ('i69', 'u9', 'naruto', 'wishlist', 1, 1782696972477, 'demo'),
  ('i70', 'u10', 'dong-phuc-thuy-thu', 'cart', 1, 1782678972477, 'demo'),
  ('i71', 'u1', 'balo-vai', 'purchase', 5, 1782660972477, 'demo'),
  ('i72', 'u2', 'guoc-geta', 'tryon', 1, 1782642972477, 'demo'),
  ('i73', 'u3', 'haori-dang-dai', 'view', 1, 1782624972477, 'demo'),
  ('i74', 'u4', 'balo-vai', 'view', 1, 1782606972477, 'demo'),
  ('i75', 'u5', 'guoc-geta', 'wishlist', 1, 1782588972477, 'demo'),
  ('i76', 'u6', 'yae-miko', 'cart', 1, 1782570972477, 'demo'),
  ('i77', 'u7', 'ao-len-cardigan', 'purchase', 5, 1782552972477, 'demo'),
  ('i78', 'u8', 'du-nhat', 'tryon', 1, 1782534972477, 'demo'),
  ('i79', 'u9', 'yae-miko', 'view', 1, 1782516972477, 'demo'),
  ('i80', 'u10', 'ao-len-cardigan', 'view', 1, 1782498972477, 'demo'),
  ('i81', 'u1', 'so-mi-trang', 'wishlist', 1, 1782480972477, 'demo'),
  ('i82', 'u2', 'kep-no', 'cart', 1, 1782462972477, 'demo'),
  ('i83', 'u3', 'kimono-hong', 'purchase', 5, 1782444972477, 'demo'),
  ('i84', 'u4', 'so-mi-trang', 'tryon', 1, 1782426972477, 'demo'),
  ('i85', 'u5', 'kep-no', 'view', 1, 1782408972477, 'demo'),
  ('i86', 'u6', 'kiem-go', 'view', 1, 1782390972477, 'demo'),
  ('i87', 'u7', 'cardigan-dai', 'wishlist', 1, 1782372972477, 'demo'),
  ('i88', 'u8', 'giay-dep', 'cart', 1, 1782354972477, 'demo'),
  ('i89', 'u9', 'kiem-go', 'purchase', 5, 1782336972477, 'demo'),
  ('i90', 'u10', 'cardigan-dai', 'tryon', 1, 1782318972477, 'demo'),
  ('i91', 'u1', 'khoac-nhat', 'view', 1, 1782300972477, 'demo'),
  ('i92', 'u2', 'gang-tay', 'view', 1, 1782282972477, 'demo'),
  ('i93', 'u3', 'yumeko', 'wishlist', 1, 1782264972477, 'demo'),
  ('i94', 'u4', 'khoac-nhat', 'cart', 1, 1782246972477, 'demo'),
  ('i95', 'u5', 'gang-tay', 'purchase', 5, 1782228972477, 'demo'),
  ('i96', 'u6', 'chup-tai', 'tryon', 1, 1782210972477, 'demo'),
  ('i97', 'u7', 'yukata-xanh', 'view', 1, 1782192972477, 'demo'),
  ('i98', 'u8', 'ao-len-co-lo', 'view', 1, 1782174972477, 'demo'),
  ('i99', 'u9', 'chup-tai', 'wishlist', 1, 1782156972477, 'demo'),
  ('i100', 'u10', 'yukata-xanh', 'cart', 1, 1782138972477, 'demo'),
  ('i101', 'u1', 'blazer-kaki', 'purchase', 5, 1782120972477, 'demo'),
  ('i102', 'u2', 'mu-nhat', 'tryon', 1, 1782102972477, 'demo'),
  ('i103', 'u3', 'furina', 'view', 1, 1782084972477, 'demo'),
  ('i104', 'u4', 'blazer-kaki', 'view', 1, 1782066972477, 'demo'),
  ('i105', 'u5', 'mu-nhat', 'wishlist', 1, 1782048972477, 'demo'),
  ('i106', 'u6', 'vo-tat', 'cart', 1, 1782030972477, 'demo'),
  ('i107', 'u7', 'naruto', 'purchase', 5, 1782012972477, 'demo'),
  ('i108', 'u8', 'dong-phuc-thuy-thu', 'tryon', 1, 1781994972477, 'demo'),
  ('i109', 'u9', 'vo-tat', 'view', 1, 1781976972477, 'demo'),
  ('i110', 'u10', 'naruto', 'view', 1, 1781958972477, 'demo'),
  ('i111', 'u1', 'haori-dang-dai', 'wishlist', 1, 1781940972477, 'demo'),
  ('i112', 'u2', 'balo-vai', 'cart', 1, 1781922972477, 'demo'),
  ('i113', 'u3', 'guoc-geta', 'purchase', 5, 1781904972477, 'demo'),
  ('i114', 'u4', 'haori-dang-dai', 'tryon', 1, 1781886972477, 'demo'),
  ('i115', 'u5', 'balo-vai', 'view', 1, 1781868972477, 'demo'),
  ('i116', 'u6', 'du-nhat', 'view', 1, 1781850972477, 'demo'),
  ('i117', 'u7', 'yae-miko', 'wishlist', 1, 1781832972477, 'demo'),
  ('i118', 'u8', 'ao-len-cardigan', 'cart', 1, 1781814972477, 'demo'),
  ('i119', 'u9', 'du-nhat', 'purchase', 5, 1781796972477, 'demo'),
  ('i120', 'u10', 'yae-miko', 'tryon', 1, 1781778972477, 'demo'),
  ('i1783921470712iduyq', 'demo-minh', 'yukata-xanh', 'view', 1, 1783921470712, 'mobile'),
  ('tryon-i-1783922576844', 'codex-e2e', 'kimono-hong', 'tryon', 1, 1783922576844, 'mobile'),
  ('i17839234099101ijyt', 'demo-minh', 'kimono-hong', 'view', 1, 1783923409910, 'mobile'),
  ('tryon-i-1783923811011', 'codex-e2e-final', 'kimono-hong', 'tryon', 1, 1783923811011, 'mobile'),
  ('i17839246575689tgn7', 'demo-minh', 'kimono-hong', 'view', 1, 1783924657568, 'mobile'),
  ('tryon-i-1783924782408', 'demo-minh', 'kimono-hong', 'tryon', 1, 1783924782408, 'mobile'),
  ('i17839261001061ks25', 'demo-minh', 'kimono-hong', 'view', 1, 1783926100106, 'mobile'),
  ('tryon-i-1783926237100', 'demo-minh', 'kimono-hong', 'tryon', 1, 1783926237100, 'mobile'),
  ('tryon-i-1783929417836', 'codex-always-repose-proof', 'kimono-hong', 'tryon', 1, 1783929417836, 'mobile'),
  ('i1783930002294d0c58', 'demo-minh', 'kimono-hong', 'view', 1, 1783930002294, 'mobile'),
  ('tryon-i-1783930151009', 'demo-minh', 'kimono-hong', 'tryon', 1, 1783930151009, 'mobile'),
  ('i1783930306532jszrj', 'demo-minh', 'cardigan-dai', 'view', 1, 1783930306532, 'mobile'),
  ('tryon-i-1783930451540', 'demo-minh', 'cardigan-dai', 'tryon', 1, 1783930451540, 'mobile'),
  ('i178393048004171628', 'demo-minh', 'furina', 'view', 1, 1783930480041, 'mobile'),
  ('tryon-i-1783930590799', 'demo-minh', 'furina', 'tryon', 1, 1783930590799, 'mobile'),
  ('i1783930709706g30u4', 'demo-minh', 'furina', 'view', 1, 1783930709706, 'mobile'),
  ('tryon-i-1783930750343', 'demo-minh', 'furina', 'tryon', 1, 1783930750343, 'mobile'),
  ('i17839330072758pvn4', 'demo-minh', 'ao-len-cardigan', 'view', 1, 1783933007275, 'mobile'),
  ('i1783933965358xs8v5', 'demo-minh', 'ao-len-cardigan', 'view', 1, 1783933965358, 'mobile'),
  ('tryon-i-1783934125356', 'demo-minh', 'ao-len-cardigan', 'tryon', 1, 1783934125356, 'mobile'),
  ('i1783934268562r86gc', 'demo-minh', 'khoac-nhat', 'view', 1, 1783934268562, 'mobile'),
  ('tryon-i-1783934432155', 'demo-minh', 'khoac-nhat', 'tryon', 1, 1783934432155, 'mobile'),
  ('i1783934510550opn14', 'demo-minh', 'khoac-nhat', 'view', 1, 1783934510550, 'mobile'),
  ('i17839346434818pd69', 'demo-minh', 'kimono-hong', 'view', 1, 1783934643481, 'mobile'),
  ('tryon-i-1783935103669', 'verification', 'ao-len-cardigan', 'tryon', 1, 1783935103669, 'mobile'),
  ('i178393593048251x0n', 'demo-minh', 'so-mi-trang', 'view', 1, 1783935930482, 'mobile'),
  ('tryon-i-1783936115370', 'demo-minh', 'so-mi-trang', 'tryon', 1, 1783936115370, 'mobile'),
  ('i1783936368581vh2jq', 'demo-minh', 'so-mi-trang', 'view', 1, 1783936368581, 'mobile'),
  ('i1783936436208jj74d', 'demo-minh', 'so-mi-trang', 'view', 1, 1783936436208, 'mobile'),
  ('i17839371622628xwp4', 'demo-minh', 'kimono-hong', 'view', 1, 1783937162262, 'mobile'),
  ('tryon-i-1783937381105', 'demo-minh', 'kimono-hong', 'tryon', 1, 1783937381105, 'mobile'),
  ('chat-i-1783937458499-0', 'demo-minh', 'kimono-hong', 'chat', 1, 1783937458499, 'mobile'),
  ('chat-i-1783937458499-1', 'demo-minh', 'so-mi-trang', 'chat', 1, 1783937458499, 'mobile'),
  ('chat-i-1783937458499-2', 'demo-minh', 'cardigan-dai', 'chat', 1, 1783937458499, 'mobile'),
  ('chat-i-1783937639209-0', 'demo-minh', 'kimono-hong', 'chat', 1, 1783937639209, 'mobile'),
  ('chat-i-1783937639209-1', 'demo-minh', 'so-mi-trang', 'chat', 1, 1783937639209, 'mobile'),
  ('chat-i-1783937639209-2', 'demo-minh', 'cardigan-dai', 'chat', 1, 1783937639209, 'mobile'),
  ('chat-i-1783937639209-3', 'demo-minh', 'yukata-xanh', 'chat', 1, 1783937639209, 'mobile'),
  ('chat-i-1783937653141-0', 'demo-minh', 'ao-len-co-lo', 'chat', 1, 1783937653141, 'mobile'),
  ('chat-i-1783937653141-1', 'demo-minh', 'cardigan-dai', 'chat', 1, 1783937653141, 'mobile'),
  ('chat-i-1783937653141-2', 'demo-minh', 'guoc-geta', 'chat', 1, 1783937653141, 'mobile'),
  ('chat-i-1783937766725-0', 'demo-minh', 'blazer-kaki', 'chat', 1, 1783937766725, 'mobile'),
  ('chat-i-1783937766725-1', 'demo-minh', 'so-mi-trang', 'chat', 1, 1783937766725, 'mobile'),
  ('chat-i-1783937766725-2', 'demo-minh', 'mu-nhat', 'chat', 1, 1783937766725, 'mobile'),
  ('i17839378359463y8g6', 'demo-minh', 'so-mi-trang', 'cart', 1, 1783937835946, 'mobile'),
  ('tryon-i-1783938237451', 'qa-accessory', 'kimono-hong', 'tryon', 1, 1783938237451, 'mobile'),
  ('tryon-i-1783939475987', 'qa-accessory-v2', 'kimono-hong', 'tryon', 1, 1783939475987, 'mobile'),
  ('i1784110103233knz5r', 'demo-minh', 'kimono-hong', 'view', 1, 1784110103233, 'mobile'),
  ('i17841373489681q0f8', 'ban@japano.vn', 'kimono-hong', 'view', 1, 1784137348968, 'mobile'),
  ('i17841373492034sah1', 'ban@japano.vn', 'kimono-hong', 'view', 1, 1784137349203, 'mobile'),
  ('i1784137354848ajcyd', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784137354848, 'mobile'),
  ('tryon-i-1784137382405', 'demo-minh', 'kimono-hong', 'tryon', 1, 1784137382405, 'mobile'),
  ('tryon-i-1784138417748', 'guest', 'ao-len-cardigan', 'tryon', 1, 1784138417748, 'mobile'),
  ('i1784138923648zqxv4', 'ban@japano.vn', 'kimono-hong', 'view', 1, 1784138923648, 'mobile'),
  ('tryon-i-1784139163142', 'demo-minh', 'kimono-hong', 'tryon', 1, 1784139163142, 'mobile'),
  ('tryon-i-1784161955667', 'guest', 'ao-len-cardigan', 'tryon', 1, 1784161955667, 'mobile'),
  ('i17841621549960gj2j', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784162154996, 'mobile'),
  ('i1784162155182jqgju', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784162155182, 'mobile'),
  ('i1784162161737bl1tx', 'ban@japano.vn', 'cardigan-dai', 'cart', 1, 1784162161737, 'mobile'),
  ('i17841621617407ly5t', 'ban@japano.vn', 'yukata-xanh', 'cart', 1, 1784162161740, 'mobile'),
  ('i1784162161741a3alv', 'ban@japano.vn', 'guoc-geta', 'cart', 1, 1784162161741, 'mobile'),
  ('i17841621617449785l', 'ban@japano.vn', 'mu-nhat', 'cart', 1, 1784162161744, 'mobile'),
  ('i1784162181146qk0gz', 'ban@japano.vn', 'yukata-xanh', 'cart', 1, 1784162181146, 'mobile'),
  ('i1784162298361angng', 'ban@japano.vn', 'kimono-hong', 'view', 1, 1784162298361, 'mobile'),
  ('goal-i-1784162335805', 'demo-minh', 'kimono-hong', 'goal', 1, 1784162335805, 'mobile'),
  ('tryon-i-1784162536119', 'demo-minh', 'kimono-hong', 'tryon', 1, 1784162536119, 'mobile'),
  ('i17841956840987boeh', 'ban@japano.vn', 'furina', 'view', 1, 1784195684098, 'mobile'),
  ('i1784195690199bjjri', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784195690199, 'mobile'),
  ('i1784195944225oig6m', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784195944225, 'mobile'),
  ('i1784196065950m9hwo', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784196065950, 'mobile'),
  ('i1784196107396ocf5l', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784196107396, 'mobile'),
  ('i1784196302011sq6gd', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784196302011, 'mobile'),
  ('i1784196860151jleac', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784196860151, 'mobile'),
  ('i1784197018079a1790', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784197018079, 'mobile'),
  ('i1784197118774l8d2z', 'ban@japano.vn', 'haori-dang-dai', 'view', 1, 1784197118774, 'mobile'),
  ('i17841972118946yl13', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784197211894, 'mobile'),
  ('i1784197462133bkfjo', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784197462133, 'mobile'),
  ('i1784197572537ash9z', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784197572537, 'mobile'),
  ('i1784199038726vdgop', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784199038726, 'mobile'),
  ('i17842013269894tu3t', 'ban@japano.vn', 'yukata-xanh', 'search', 1, 1784201326989, 'mobile'),
  ('i17842055249040sk9x', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784205524904, 'mobile'),
  ('i178420568925267a6p', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784205689252, 'mobile'),
  ('i17842064390543mytt', 'ban@japano.vn', 'so-mi-trang', 'view', 1, 1784206439054, 'mobile'),
  ('i1784206443759uxrit', 'ban@japano.vn', 'so-mi-trang', 'cart', 1, 1784206443759, 'mobile'),
  ('i1784206657434kr6ch', 'ban@japano.vn', 'so-mi-trang', 'view', 1, 1784206657434, 'mobile'),
  ('i1784207368261aobj7', 'ban@japano.vn', 'kimono-hong', 'view', 1, 1784207368261, 'mobile'),
  ('i1784207371325kywts', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784207371325, 'mobile'),
  ('i1784263311689ey3l4', 'ban@japano.vn', 'khoac-nhat', 'view', 1, 1784263311689, 'mobile'),
  ('i17842633706280tij7', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784263370628, 'mobile'),
  ('i17842633776995bo1k', 'ban@japano.vn', 'yukata-xanh', 'cart', 1, 1784263377699, 'mobile'),
  ('i17845393735260n14b', 'ban@japano.vn', 'cardigan-dai', 'view', 1, 1784539373526, 'mobile'),
  ('i1784539377007h493o', 'ban@japano.vn', 'cardigan-dai', 'cart', 1, 1784539377007, 'mobile'),
  ('i17845393882086z96i', 'ban@japano.vn', 'cardigan-dai', 'view', 1, 1784539388208, 'mobile'),
  ('chat-i-1784539549020-0', 'demo-minh', 'cardigan-dai', 'chat', 1, 1784539549020, 'mobile'),
  ('chat-i-1784539549020-1', 'demo-minh', 'kimono-hong', 'chat', 1, 1784539549020, 'mobile'),
  ('chat-i-1784539549020-2', 'demo-minh', 'so-mi-trang', 'chat', 1, 1784539549020, 'mobile'),
  ('chat-i-1784539558463-0', 'demo-minh', 'cardigan-dai', 'chat', 1, 1784539558463, 'mobile'),
  ('chat-i-1784539558463-1', 'demo-minh', 'so-mi-trang', 'chat', 1, 1784539558463, 'mobile'),
  ('chat-i-1784539558463-2', 'demo-minh', 'kimono-hong', 'chat', 1, 1784539558463, 'mobile'),
  ('chat-i-1784539558463-3', 'demo-minh', 'ao-len-cardigan', 'chat', 1, 1784539558463, 'mobile'),
  ('chat-i-1784539563146-0', 'demo-minh', 'cardigan-dai', 'chat', 1, 1784539563146, 'mobile'),
  ('chat-i-1784539563146-1', 'demo-minh', 'so-mi-trang', 'chat', 1, 1784539563146, 'mobile'),
  ('chat-i-1784539563146-2', 'demo-minh', 'kimono-hong', 'chat', 1, 1784539563146, 'mobile'),
  ('chat-i-1784539563146-3', 'demo-minh', 'ao-len-co-lo', 'chat', 1, 1784539563146, 'mobile'),
  ('chat-i-1784539824648-0', 'guest', 'kimono-hong', 'chat', 1, 1784539824648, 'mobile'),
  ('chat-i-1784539881181-0', 'demo-minh', 'cardigan-dai', 'chat', 1, 1784539881181, 'mobile'),
  ('chat-i-1784539881181-1', 'demo-minh', 'so-mi-trang', 'chat', 1, 1784539881181, 'mobile'),
  ('chat-i-1784539881181-2', 'demo-minh', 'kimono-hong', 'chat', 1, 1784539881181, 'mobile'),
  ('chat-i-1784539886834-0', 'demo-minh', 'so-mi-trang', 'chat', 1, 1784539886834, 'mobile'),
  ('chat-i-1784539886834-1', 'demo-minh', 'cardigan-dai', 'chat', 1, 1784539886834, 'mobile'),
  ('chat-i-1784539886834-2', 'demo-minh', 'guoc-geta', 'chat', 1, 1784539886834, 'mobile'),
  ('chat-i-1784539895194-0', 'demo-minh', 'cardigan-dai', 'chat', 1, 1784539895194, 'mobile'),
  ('chat-i-1784539895194-1', 'demo-minh', 'so-mi-trang', 'chat', 1, 1784539895194, 'mobile'),
  ('chat-i-1784539895194-2', 'demo-minh', 'kimono-hong', 'chat', 1, 1784539895194, 'mobile'),
  ('chat-i-1784539895194-3', 'demo-minh', 'haori-dang-dai', 'chat', 1, 1784539895194, 'mobile'),
  ('i1784539972858duoov', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784539972858, 'mobile'),
  ('i1784539974473ddbxt', 'ban@japano.vn', 'yukata-xanh', 'cart', 1, 1784539974473, 'mobile'),
  ('i1784542876742tik8m', 'ban@japano.vn', 'cardigan-dai', 'view', 1, 1784542876742, 'mobile'),
  ('tryon-i-1784543038770', 'demo-minh', 'cardigan-dai', 'tryon', 1, 1784543038770, 'mobile'),
  ('i1784543197325r43n9', 'ban@japano.vn', 'kimono-hong', 'view', 1, 1784543197325, 'mobile'),
  ('tryon-i-1784543345384', 'demo-minh', 'kimono-hong', 'tryon', 1, 1784543345384, 'mobile'),
  ('i178454413248816ul4', 'ban@japano.vn', 'cardigan-dai', 'view', 1, 1784544132488, 'mobile'),
  ('tryon-i-1784544252320', 'demo-minh', 'cardigan-dai', 'tryon', 1, 1784544252320, 'mobile'),
  ('i1784545163353z1z00', 'ban@japano.vn', 'cardigan-dai', 'view', 1, 1784545163353, 'mobile'),
  ('tryon-i-1784545278299', 'demo-minh', 'cardigan-dai', 'tryon', 1, 1784545278299, 'mobile'),
  ('tryon-i-1784550081133', 'demo-minh', 'cardigan-dai', 'tryon', 1, 1784550081133, 'mobile'),
  ('i1784552301757ysgjc', 'verify-user', 'haori-dang-dai', 'wishlist', 1, 1784552301757, 'mobile'),
  ('chat-i-1784552301793-0', 'verify-user', 'yukata-xanh', 'chat', 1, 1784552301793, 'mobile'),
  ('i1784625590457yxdxh', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784625590457, 'mobile'),
  ('i1784625594983m0joz', 'ban@japano.vn', 'yukata-xanh', 'cart', 1, 1784625594983, 'mobile'),
  ('i17846260539231oipj', 'ban@japano.vn', 'giay-dep', 'view', 1, 1784626053923, 'mobile'),
  ('i1784626492008nri5d', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784626492008, 'mobile'),
  ('tryon-i-1784626798861', 'demo-minh', 'yukata-xanh', 'tryon', 1, 1784626798861, 'mobile'),
  ('i17846293739747jegz', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784629373974, 'mobile'),
  ('tryon-i-1784629626209', 'demo-minh', 'yukata-xanh', 'tryon', 1, 1784629626209, 'mobile'),
  ('i1784630440872ogw1v', 'ban@japano.vn', 'kimono-hong', 'search', 1, 1784630440872, 'mobile'),
  ('i1784630440921bgtso', 'ban@japano.vn', 'blazer-kaki', 'search', 1, 1784630440921, 'mobile'),
  ('i17846304410014rsqp', 'ban@japano.vn', 'ao-len-cardigan', 'search', 1, 1784630441001, 'mobile'),
  ('i1784630953600lxi7z', 'ban@japano.vn', 'kimono-hong', 'view', 1, 1784630953600, 'mobile'),
  ('i1784630955375sbtam', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784630955375, 'mobile'),
  ('i1784631014734d98ge', 'ban@japano.vn', 'haori-dang-dai', 'wishlist', 1, 1784631014734, 'mobile'),
  ('i1784631783901bbdjd', 'ban@japano.vn', 'yukata-xanh', 'view', 1, 1784631783901, 'mobile'),
  ('i178463178562042gap', 'ban@japano.vn', 'yukata-xanh', 'cart', 2, 1784631785620, 'mobile'),
  ('i1784631790907dtfuy', 'ban@japano.vn', 'kimono-hong', 'cart', 2, 1784631790907, 'mobile'),
  ('i17846317929199kg7c', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784631792919, 'mobile'),
  ('i1784631793713sg4k6', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784631793713, 'mobile'),
  ('i17846317955370xtuc', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784631795537, 'mobile'),
  ('i1784631797096wt9qq', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784631797096, 'mobile'),
  ('i1784631797531m2lze', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784631797531, 'mobile'),
  ('i1784631797894rdqmt', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784631797894, 'mobile'),
  ('i17846318281964wz9s', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784631828196, 'mobile'),
  ('i1784631828504q0r8c', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784631828504, 'mobile'),
  ('i1784631828507ga1wt', 'ban@japano.vn', 'kimono-hong', 'cart', 1, 1784631828507, 'mobile'),
  ('goal-i-1784632482421', 'demo-minh', 'kimono-hong', 'goal', 1, 1784632482421, 'mobile'),
  ('i17846504766851fhy2', 'ban@japano.vn', 'kimono-hong', 'view', 1, 1784650476685, 'mobile'),
  ('i1784651461100y8nou', 'ban@japano.vn', 'khoac-nhat', 'view', 1, 1784651461100, 'mobile'),
  ('i17846514708272hwp6', 'ban@japano.vn', 'blazer-kaki', 'view', 1, 1784651470827, 'mobile');

INSERT INTO `chats` (`id`, `user_id`, `role`, `message`, `created_at`) VALUES
  ('chat-1783936617114', 'demo-minh', 'user', 'hi', 1783936617114),
  ('chat-1783936617114-ai', 'demo-minh', 'assistant', 'Xin chào! Mình là Ori 織, trợ lý phối đồ của JAPANO. Mình có thể gợi ý sản phẩm, ghép set, tư vấn size hoặc xem đơn hàng giúp bạn — bạn đang tìm gì hôm nay?', 1783936617115),
  ('chat-1783937458499', 'demo-minh', 'user', 'hello', 1783937458499),
  ('chat-1783937458499-ai', 'demo-minh', 'assistant', 'Hôm nay bạn thế nào? Mình là Ori 織. Bạn kể mình nghe tâm trạng hoặc dịp sắp tới, mình sẽ gợi ý món phù hợp trong shop — bạn có thể thêm giỏ và mua ngay trong botchat.', 1783937458500),
  ('chat-1783937639209', 'demo-minh', 'user', 'i dont know with 185cm, i want buy what to wear phoi tho%idi lam', 1783937639209),
  ('chat-1783937639209-ai', 'demo-minh', 'assistant', 'Ori chưa chắc hiểu ý bạn lắm, nhưng đây là vài gợi ý có thể bạn sẽ thích — hoặc bạn thử hỏi rõ hơn về giá, size, phối đồ, khuyến mãi nhé:', 1783937639210),
  ('chat-1783937653141', 'demo-minh', 'user', 'phối đồ đi làm', 1783937653141),
  ('chat-1783937653141-ai', 'demo-minh', 'assistant', 'Set phối cùng Áo len cổ lọ dệt kim — tổng khoảng 1.900.000₫. Đây là gợi ý phối đồ theo màu và chủ đề hợp nhau:', 1783937653142),
  ('chat-1783937766725', 'demo-minh', 'user', 'Phối đồ đi làm', 1783937766725),
  ('chat-1783937766725-ai', 'demo-minh', 'assistant', 'Set phối cùng Blazer kaki trench — tổng khoảng 1.820.000₫. Đây là gợi ý phối đồ theo màu và chủ đề hợp nhau:', 1783937766726),
  ('chat-1784539549020', 'demo-minh', 'user', 'Hi', 1784539549020),
  ('chat-1784539549020-ai', 'demo-minh', 'assistant', 'Hôm nay bạn thế nào? Mình là Ori 織. Bạn kể mình nghe tâm trạng hoặc dịp sắp tới, mình sẽ gợi ý món phù hợp trong shop — bạn có thể thêm giỏ và mua ngay trong botchat.', 1784539549021),
  ('chat-1784539558463', 'demo-minh', 'user', 'Tôi tên gì', 1784539558463),
  ('chat-1784539558463-ai', 'demo-minh', 'assistant', 'Ori chưa chắc hiểu ý bạn lắm, nhưng đây là vài gợi ý có thể bạn sẽ thích — hoặc bạn thử hỏi rõ hơn về giá, size, phối đồ, khuyến mãi nhé:', 1784539558464),
  ('chat-1784539563146', 'demo-minh', 'user', 'Hôm nay vui vẻ', 1784539563146),
  ('chat-1784539563146-ai', 'demo-minh', 'assistant', 'Ori chưa chắc hiểu ý bạn lắm, nhưng đây là vài gợi ý có thể bạn sẽ thích — hoặc bạn thử hỏi rõ hơn về giá, size, phối đồ, khuyến mãi nhé:', 1784539563147),
  ('chat-1784539824648', 'guest', 'user', 'Kimono mặc khi nào?', 1784539824648),
  ('chat-1784539824648-ai', 'guest', 'assistant', 'Kimono là trang phục truyền thống dáng chữ T, quấn thân trái phủ lên phải và cố định bằng obi. Kimono thường dùng trong lễ cưới, trà đạo, lễ trưởng thành và dịp trang trọng; chỉ mặc vạt phải phủ trái cho người đã mất. Khi phối hiện đại, bạn có thể khoác kimono hoặc haori ngoài áo trơn, giữ phụ kiện tối giản để họa tiết nổi bật.', 1784539824649),
  ('chat-1784539824680', 'guest', 'user', 'Đi Kyoto 3 ngày có gì?', 1784539824680),
  ('chat-1784539824680-ai', 'guest', 'assistant', 'Kyoto nổi tiếng với Fushimi Inari, Kiyomizu-dera, Arashiyama, Kinkaku-ji và khu Gion. Hãy đi sớm để bớt đông, chia lịch theo phía đông/tây thành phố và giữ yên lặng tại đền chùa. Nếu thuê kimono, nên chọn dép dễ đi vì nhiều đường dốc và lát đá.', 1784539824681),
  ('chat-1784539824710', 'guest', 'user', 'Ori có phải chatbot không?', 1784539824710),
  ('chat-1784539824710-ai', 'guest', 'assistant', 'Mình là Ori, chatbot của JAPANO. Mình có thể tư vấn sản phẩm thật trong shop, giá, size, phối đồ, thử đồ, ưu đãi và đơn hàng; ngoài ra còn giải đáp về trang phục truyền thống, thời trang đường phố, văn hóa, ẩm thực, di chuyển và địa điểm du lịch Nhật Bản. Bạn cứ hỏi tự nhiên, ví dụ “đi Kyoto 3 ngày nên mặc gì?”.', 1784539824711),
  ('chat-1784539881181', 'demo-minh', 'user', 'Hi', 1784539881181),
  ('chat-1784539881181-ai', 'demo-minh', 'assistant', 'Hôm nay bạn thế nào? Mình là Ori 織. Bạn kể mình nghe tâm trạng hoặc dịp sắp tới, mình sẽ gợi ý món phù hợp trong shop — bạn có thể thêm giỏ và mua ngay trong botchat.', 1784539881182),
  ('chat-1784539886834', 'demo-minh', 'user', 'Phối đồ đi làm', 1784539886834),
  ('chat-1784539886834-ai', 'demo-minh', 'assistant', 'Bộ đồ phối cùng Sơ mi trắng tay ngắn — tổng khoảng 1.860.000₫. Đây là gợi ý phối đồ theo màu và chủ đề hợp nhau:', 1784539886835),
  ('chat-1784539895194', 'demo-minh', 'user', 'Tôi tên gì', 1784539895194),
  ('chat-1784539895194-ai', 'demo-minh', 'assistant', 'Mình chưa có đủ dữ kiện để trả lời chính xác câu này. Bạn có thể hỏi lại theo chủ đề cụ thể hơn — ví dụ tên trang phục Nhật, thành phố muốn đến, mùa du lịch, cách di chuyển, món ăn, văn hóa, hoặc nhu cầu phối đồ. Trong lúc đó, đây là vài món hợp gu của bạn:', 1784539895195),
  ('chat-1784539915406', 'demo-minh', 'user', 'Tokyo thì nên dồ gì', 1784539915406),
  ('chat-1784539915406-ai', 'demo-minh', 'assistant', 'Tokyo hợp cho chuyến đi kết hợp hiện đại và truyền thống: Asakusa–Sensō-ji, Ueno, Meiji Jingū, Shibuya, Shinjuku và các khu mua sắm như Ginza hoặc Harajuku. Nên gom điểm theo khu vì thành phố rất rộng; dùng thẻ IC cho tàu nội đô và tránh giờ cao điểm nếu mang hành lý lớn.', 1784539915407),
  ('chat-1784539936936', 'demo-minh', 'user', 'Giá vé Việt Nam Tokyo', 1784539936936),
  ('chat-1784539936936-ai', 'demo-minh', 'assistant', 'Bạn muốn hỏi giá sản phẩm nào? Cho mình tên hoặc loại đồ (vd: kimono, haori, phụ kiện) nhé.', 1784539936937),
  ('chat-1784539948520', 'demo-minh', 'user', 'Giá vé du lịch', 1784539948520),
  ('chat-1784539948520-ai', 'demo-minh', 'assistant', 'Bạn muốn hỏi giá sản phẩm nào? Cho mình tên hoặc loại đồ (vd: kimono, haori, phụ kiện) nhé.', 1784539948521),
  ('chat-1784552301793', 'verify-user', 'user', 'Gợi ý đồ tối giản để đi làm', 1784552301793),
  ('chat-1784552301793-ai', 'verify-user', 'assistant', 'Mình tìm được 1 món trong nhóm Áo truyền thống hợp với câu hỏi của bạn:', 1784552301794);

INSERT INTO `chat_product_refs` (`chat_id`, `product_slug`) VALUES
  ('chat-1783937458499-ai', 'kimono-hong'),
  ('chat-1783937458499-ai', 'so-mi-trang'),
  ('chat-1783937458499-ai', 'cardigan-dai'),
  ('chat-1783937639209-ai', 'kimono-hong'),
  ('chat-1783937639209-ai', 'so-mi-trang'),
  ('chat-1783937639209-ai', 'cardigan-dai'),
  ('chat-1783937639209-ai', 'yukata-xanh'),
  ('chat-1783937653141-ai', 'ao-len-co-lo'),
  ('chat-1783937653141-ai', 'cardigan-dai'),
  ('chat-1783937653141-ai', 'guoc-geta'),
  ('chat-1783937766725-ai', 'blazer-kaki'),
  ('chat-1783937766725-ai', 'so-mi-trang'),
  ('chat-1783937766725-ai', 'mu-nhat'),
  ('chat-1784539549020-ai', 'cardigan-dai'),
  ('chat-1784539549020-ai', 'kimono-hong'),
  ('chat-1784539549020-ai', 'so-mi-trang'),
  ('chat-1784539558463-ai', 'cardigan-dai'),
  ('chat-1784539558463-ai', 'so-mi-trang'),
  ('chat-1784539558463-ai', 'kimono-hong'),
  ('chat-1784539558463-ai', 'ao-len-cardigan'),
  ('chat-1784539563146-ai', 'cardigan-dai'),
  ('chat-1784539563146-ai', 'so-mi-trang'),
  ('chat-1784539563146-ai', 'kimono-hong'),
  ('chat-1784539563146-ai', 'ao-len-co-lo'),
  ('chat-1784539824648-ai', 'kimono-hong'),
  ('chat-1784539881181-ai', 'cardigan-dai'),
  ('chat-1784539881181-ai', 'so-mi-trang'),
  ('chat-1784539881181-ai', 'kimono-hong'),
  ('chat-1784539886834-ai', 'so-mi-trang'),
  ('chat-1784539886834-ai', 'cardigan-dai'),
  ('chat-1784539886834-ai', 'guoc-geta'),
  ('chat-1784539895194-ai', 'cardigan-dai'),
  ('chat-1784539895194-ai', 'so-mi-trang'),
  ('chat-1784539895194-ai', 'kimono-hong'),
  ('chat-1784539895194-ai', 'haori-dang-dai'),
  ('chat-1784552301793-ai', 'yukata-xanh');

INSERT INTO `tryon_history` (`id`, `user_id`, `product_slug`, `engine`, `created_at`) VALUES
  ('tryon-1783922576844', 'codex-e2e', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity', 1783922576844),
  ('tryon-1783923811011', 'codex-e2e-final', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity', 1783923811011),
  ('tryon-1783924782408', 'demo-minh', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity', 1783924782408),
  ('tryon-1783926237100', 'demo-minh', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity', 1783926237100),
  ('tryon-1783929417836', 'codex-always-repose-proof', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity', 1783929417836),
  ('tryon-1783930151009', 'demo-minh', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity', 1783930151009),
  ('tryon-1783930451540', 'demo-minh', 'cardigan-dai', 'flux2-klein-4b-pose+fashn-vton-1.5', 1783930451540),
  ('tryon-1783930590799', 'demo-minh', 'furina', 'flux2-klein-4b-pose+fashn-vton-1.5', 1783930590799),
  ('tryon-1783930750343', 'demo-minh', 'furina', 'flux2-klein-4b-pose+fashn-vton-1.5', 1783930750343),
  ('tryon-1783934125356', 'demo-minh', 'ao-len-cardigan', 'flux2-klein-4b-pose+fashn-vton-1.5', 1783934125356),
  ('tryon-1783934432155', 'demo-minh', 'khoac-nhat', 'flux2-klein-4b-pose+fashn-vton-1.5', 1783934432155),
  ('tryon-1783935103669', 'verification', 'ao-len-cardigan', 'flux2-klein-4b-pose+fashn-vton-1.5', 1783935103669),
  ('tryon-1783936115370', 'demo-minh', 'so-mi-trang', 'flux2-klein-4b-pose+fashn-vton-1.5', 1783936115370),
  ('tryon-1783937381105', 'demo-minh', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity', 1783937381105),
  ('tryon-1783938237451', 'qa-accessory', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity+accessory-pose', 1783938237451),
  ('tryon-1783939475987', 'qa-accessory-v2', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity+flux2-klein-4b-accessory-refine', 1783939475987),
  ('tryon-1784137382405', 'demo-minh', 'kimono-hong', 'local-preview-last-resort', 1784137382405),
  ('tryon-1784138417748', 'guest', 'ao-len-cardigan', 'fashn-vton-1.5', 1784138417748),
  ('tryon-1784139163142', 'demo-minh', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+flux2-klein-4b-fidelity+secondary-person-lock', 1784139163142),
  ('tryon-1784161955667', 'guest', 'ao-len-cardigan', 'fashn-vton-1.5+adaptive-low-memory', 1784161955667),
  ('tryon-1784162536119', 'demo-minh', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+adaptive-low-memory+secondary-person-lock', 1784162536119),
  ('tryon-1784543038770', 'demo-minh', 'cardigan-dai', 'flux2-klein-4b-pose+fashn-vton-1.5+adaptive-low-memory', 1784543038770),
  ('tryon-1784543345384', 'demo-minh', 'kimono-hong', 'flux2-klein-4b-pose+fashn-vton-1.5+adaptive-low-memory', 1784543345384),
  ('tryon-1784544252320', 'demo-minh', 'cardigan-dai', 'flux2-klein-4b-pose+fashn-vton-1.5+adaptive-low-memory', 1784544252320),
  ('tryon-1784545278299', 'demo-minh', 'cardigan-dai', 'flux2-klein-4b-pose+fashn-vton-1.5+adaptive-low-memory', 1784545278299),
  ('tryon-1784550081133', 'demo-minh', 'cardigan-dai', 'flux2-klein-4b-pose+fashn-vton-1.5+adaptive-low-memory', 1784550081133),
  ('tryon-1784626798861', 'demo-minh', 'yukata-xanh', 'flux2-klein-4b-pose+fashn-vton-1.5+adaptive-low-memory', 1784626798861),
  ('tryon-1784629626209', 'demo-minh', 'yukata-xanh', 'flux2-klein-4b-pose+fashn-vton-1.5+adaptive-low-memory', 1784629626209);

INSERT INTO `tryon_accessories` (`tryon_id`, `product_slug`) VALUES
  ('tryon-1783938237451', 'mu-nhat'),
  ('tryon-1783938237451', 'du-nhat'),
  ('tryon-1783939475987', 'mu-nhat'),
  ('tryon-1783939475987', 'du-nhat');

INSERT INTO `goals` (`id`, `user_id`, `product_slug`, `age`, `height_cm`, `current_weight_kg`, `target_weight_kg`, `monthly_income`, `fixed_expenses`, `current_savings`, `target_months`, `plan`, `created_at`, `updated_at`) VALUES
  ('goal-demo-minh-kimono-hong', 'demo-minh', 'kimono-hong', 25, 165, 65, 60, 15000000, 11000000, 200000, 6, '{"saving":{"productId":"kimono-hong","productName":"Kimono truyền thống Hồng","targetPrice":1890000,"currentSavings":200000,"gap":1690000,"progressPercent":10.6,"disposableIncome":4000000,"monthlySaving":480000,"weeklySaving":110855,"requestedMonths":6,"estimatedMonths":4,"feasibleByRequestedDate":true,"milestones":[{"milestone":25,"amount":472500,"reached":false},{"milestone":50,"amount":945000,"reached":false},{"milestone":75,"amount":1417500,"reached":false},{"milestone":100,"amount":1890000,"reached":false}],"actions":["Tách tự động 480.000₫ ngay sau ngày nhận thu nhập.","Giới hạn khoảng 110.855₫ mỗi tuần cho quỹ “Kimono truyền thống Hồng”.","Mỗi cuối tuần ghi lại một khoản đã tránh chi tiêu bốc đồng và chuyển đúng số đó vào quỹ."]},"wellness":{"status":"gradual-loss","currentBmi":23.9,"targetBmi":22,"targetWeightKg":60,"lossKg":5,"weeklyRateKg":0.5,"estimatedWeeks":10,"activityMinutesPerWeek":150,"strengthDaysPerWeek":2,"safetyMessage":"Đây là lộ trình thói quen chung, không phải chẩn đoán hay đơn điều trị. Nếu có bệnh nền, mang thai, tiền sử rối loạn ăn uống hoặc đang dùng thuốc, hãy hỏi chuyên gia y tế.","habits":["Bắt đầu bằng 20–30 phút đi bộ nhanh, 5 ngày/tuần; tăng dần theo thể lực.","Tập sức mạnh toàn thân 2 ngày/tuần, có ngày nghỉ xen kẽ.","Giữ bữa ăn đều đặn, ưu tiên rau, đạm phù hợp và nước; không nhịn ăn để “bù”.","Theo dõi giấc ngủ, năng lượng và mức vận động; cân tối đa 1 lần/tuần nếu việc cân không gây căng thẳng."],"sources":["https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html","https://www.who.int/initiatives/behealthy/physical-activity"]},"coaching":{"motivation":"Mục tiêu không phải ép mình thay đổi thật nhanh, mà là xây thói quen đủ bền để bạn tự tin mặc Kimono truyền thống Hồng và vẫn giữ ngân sách an toàn.","identityStatement":"Tôi là người chăm sóc cơ thể bằng lựa chọn nhỏ, đồng thời chi tiêu có kế hoạch.","implementationIntentions":["Nếu vừa nhận thu nhập, tôi sẽ chuyển tiền vào quỹ mua sắm trước khi mở ứng dụng giải trí.","Nếu bỏ lỡ một buổi vận động, tôi sẽ quay lại bằng 10 phút đi bộ trong ngày kế tiếp.","Nếu muốn mua bốc đồng, tôi sẽ chờ 24 giờ và kiểm tra lại quỹ mục tiêu."],"obstaclePlans":["Tuần bận: giảm thời lượng mỗi buổi nhưng giữ nhịp xuất hiện.","Chi phí bất ngờ: ưu tiên quỹ khẩn cấp và kéo dài hạn mua thay vì vay để mua đồ.","Tâm trạng xuống: chọn một hành động nhỏ có thể làm trong 5 phút, không tự trách."],"weeklyFocus":"Mỗi tuần chỉ nâng một thói quen: vận động, bữa ăn đều, ngủ hoặc tiết kiệm.","reflectionQuestion":"Tuần này hành động nhỏ nào giúp bạn vừa khoẻ hơn vừa gần mục tiêu mua sắm hơn?","engine":"SMART + implementation-intentions + habit-stacking"},"methodology":["SMART goals","Implementation intentions","Habit stacking","Self-compassion","Progress milestones"],"disclaimer":"Lộ trình chỉ hỗ trợ lập kế hoạch thói quen và ngân sách, không thay thế tư vấn y tế, dinh dưỡng hoặc tài chính cá nhân."}', 1784162335805, 1784632482421);

INSERT INTO `ai_descriptions` (`product_slug`, `generated_at`, `headline`, `visual_summary`, `styling_tip`, `purchase_reason`, `confidence`, `engine`) VALUES
  ('yukata-xanh', 1784631824813, 'Yukata Xanh Đen Tinh Tế - Phong Cách Nhật Bản Cho Mọi Khoảnh Khắc Mùa Hè', 'Dựa trên tên, danh mục và ảnh sản phẩm, mẫu này có phom dài tạo đường nét thanh thoát và hiệu ứng phối lớp rõ ràng.', 'Kết hợp cùng obi đơn giản để tạo vẻ ngoài truyền thống, hoặc mặc riêng với giày dép thoải mái cho những chuyến đi ngắn ngày.', 'Phù hợp nếu bạn muốn một món trang phục truyền thống Nhật có nhận diện rõ, dễ phối lại nhiều lần thay vì chỉ mặc cho một dịp.', '95', 'thi-giac-san-pham'),
  ('kimono-hong', 1784650549952, 'Kimono truyền thống Hồng - Tinh hoa mùa xuân Nhật Bản', 'Áo kimono màu hồng pastel rực rỡ với họa tiết hoa đào, hoa cúc và mây trắng tinh tế. Dải thắt lưng tím đậm điểm xuyến họa tiết truyền thống, viền cổ đỏ tươi tạo điểm nhấn sang trọng.', 'Kết hợp đơn giản với phụ kiện nhỏ như vòng cổ mỏng hoặc túi xách nhỏ để tôn lên vẻ thanh lịch. Dùng trong các buổi tiệc gia đình hoặc lễ hội truyền thống sẽ rất nổi bật.', 'Sản phẩm dễ phối đồ, mang đến vẻ đẹp tinh tế cho mọi dịp đặc biệt. Thiết kế độc đáo kết hợp giữa nét cổ điển và hiện đại.', 'Mô tả được tạo từ dữ liệu sản phẩm; không suy đoán chất liệu chưa được xác nhận.', 'thi-giac-san-pham'),
  ('cardigan-dai', 1784545184208, 'Áo len khoác dáng dài - Phong cách Nhật Bản cho mọi phong cách', 'Áo len màu hồng pastel dáng dài, cổ chữ V rộng rãi, tay dài ôm nhẹ. Chất liệu mềm mại với đường viền gân dọc tinh tế. Kết hợp cùng áo thun trắng in chữ và chân váy đen, tạo vẻ thanh lịch nhưng vẫn năng động trong không gian công sở', 'Chọn áo thun trắng đơn giản kết hợp với chân váy ngắn hoặc quần jeans ống loe để tạo vẻ ngoài trẻ trung. Có thể thêm phụ kiện nhỏ như vòng cổ hoặc túi xách tay để tăng điểm nhấn', 'Áo len khoác dáng dài này là lựa chọn hoàn hảo cho những ai yêu thích sự đơn giản nhưng vẫn muốn nổi bật. Thiết kế dễ phối đồ và phù hợp với nhiều dịp, từ công sở đến các buổi gặp gỡ bạn bè', 'Cao', 'thi-giac-san-pham'),
  ('furina', 1783930516299, 'Cosplay Furina: Blue & Gold Elegance for Events', 'Hình ảnh hai người mẫu mặc trang phục cosplay màu xanh đậm và vàng kim với mũ vương miện bằng kim loại, găng tay trắng, phụ kiện trang sức lấp lánh. Chi tiết cận cảnh mũ vương miện, trang sức kim loại và mi giả nguyên bản được hiển thị rõ ràng. Thương hiệu ''喵屋'' xuất hiện ở góc dưới phải.', 'Kết hợp với phụ kiện đơn giản để tạo điểm nhấn cho các sự kiện đặc biệt, hoặc phối cùng trang phục tối giản để tôn lên vẻ sang trọng của bộ trang phục.', 'Thiết kế tinh tế theo phong cách Nhật Bản, màu sắc nổi bật và tính ứng dụng cao cho nhiều dịp khác nhau.', 'High', 'qwen3-vl:8b'),
  ('ao-len-cardigan', 1783934013805, 'Áo len dệt kim cardigan — một điểm nhấn Nhật dễ đưa vào tủ đồ', 'Dựa trên tiêu đề, danh mục và ảnh catalog, mẫu này có phom mềm, dễ mặc nhiều lớp và hợp thời tiết mát.', 'Phối cùng lớp trong trơn và một phụ kiện nhỏ để giữ đúng tinh thần tối giản Nhật.', 'Phù hợp nếu bạn muốn một món áo khoác và trang phục layer có nhận diện rõ, dễ phối lại nhiều lần thay vì chỉ mặc cho một dịp.', 'Mô tả nền từ dữ liệu catalog; không suy đoán chất liệu không có trong dữ liệu.', 'catalog-grounded-fallback'),
  ('khoac-nhat', 1784651504430, 'Áo khoác Nhật Bản mùa - Tinh hoa lễ hội trên nền đỏ rực', 'Áo khoác haori truyền thống Nhật Bản với nền vải đỏ tươi nổi bật, điểm nhấn là chữ ''祭'' (lễ hội) lớn trang trí giữa ngực. Xung quanh là họa tiết tròn xoáy, hoa văn hình học và đường viền sóng trắng tinh tế, tạo nên vẻ đẹp cổ điển nhưng trẻ trung.', 'Dùng làm layer thêm vào bộ đồ thường ngày, kết hợp với quần jeans hoặc váy ngắn để tạo phong cách trẻ trung. Hoặc phối cùng trang phục truyền thống Nhật Bản cho dịp lễ hội.', 'Áo khoác này mang đến vẻ đẹp tinh tế của văn hóa Nhật Bản, dễ dàng phối đồ và phù hợp cho nhiều dịp từ công sở đến dạo phố.', '95%', 'thi-giac-san-pham'),
  ('so-mi-trang', 1784206464545, 'Sơ mi trắng tay ngắn — một điểm nhấn Nhật dễ đưa vào tủ đồ', 'Dựa trên tên, danh mục và ảnh sản phẩm, mẫu này có đường nét gọn giúp tổng thể chỉn chu nhưng vẫn dễ phối.', 'Phối cùng lớp trong trơn và một phụ kiện nhỏ để giữ đúng tinh thần tối giản Nhật.', 'Phù hợp nếu bạn muốn một món trang phục mặc hằng ngày có nhận diện rõ, dễ phối lại nhiều lần thay vì chỉ mặc cho một dịp.', 'Mô tả được tạo từ dữ liệu sản phẩm; không suy đoán chất liệu chưa được xác nhận.', 'catalog-grounded-fallback'),
  ('haori-dang-dai', 1784197159179, 'Áo choàng Haori dáng dài — một điểm nhấn Nhật dễ đưa vào tủ đồ', 'Dựa trên tên, danh mục và ảnh sản phẩm, mẫu này có phom dài tạo đường nét thanh thoát và hiệu ứng phối lớp rõ ràng.', 'Phối cùng lớp trong trơn và một phụ kiện nhỏ để giữ đúng tinh thần tối giản Nhật.', 'Phù hợp nếu bạn muốn một món áo khoác và trang phục phối nhiều lớp có nhận diện rõ, dễ phối lại nhiều lần thay vì chỉ mặc cho một dịp.', 'Mô tả được tạo từ dữ liệu sản phẩm; không suy đoán chất liệu chưa được xác nhận.', 'catalog-grounded-fallback'),
  ('giay-dep', 1784626104154, 'Dép quai Nhật — một điểm nhấn Nhật dễ đưa vào tủ đồ', 'Dựa trên tên, danh mục và ảnh sản phẩm, mẫu này có tỉ lệ gọn gàng, dễ làm điểm nhấn cho nhiều bộ trang phục.', 'Dùng làm điểm nhấn cuối cùng cho bộ trang phục tối giản; giữ các món còn lại cùng một bảng màu.', 'Phù hợp nếu bạn muốn một món phụ kiện hoàn thiện bộ trang phục có nhận diện rõ, dễ phối lại nhiều lần thay vì chỉ mặc cho một dịp.', 'Mô tả được tạo từ dữ liệu sản phẩm; không suy đoán chất liệu chưa được xác nhận.', 'catalog-grounded-fallback'),
  ('blazer-kaki', 1784651509055, 'Áo khoác kaki dáng dài - Tinh tế từ phong cách Nhật Bản', 'Áo khoác màu be dịu nhẹ với cổ áo đứng thanh lịch, thiết kế 2 hàng nút tròn chắc chắn. Tay áo có viền kẻ sọc trắng đen khi cuộn lên, chất liệu mềm mại phù hợp công sở. Phối cùng áo trắng và quần jeans tạo vẻ năng động, tinh tế.', 'Kết hợp với áo trắng đơn giản và quần jeans ống rộng để tạo vẻ thanh lịch, năng động. Có thể thêm phụ kiện nhỏ như vòng cổ hoặc đồng hồ để tăng điểm nhấn.', 'Dễ phối đồ với nhiều phong cách từ công sở đến dạo phố, mang đến sự tự tin mỗi ngày', '95%', 'thi-giac-san-pham');

-- ai_description_details: nối qua product_slug (UNIQUE) để lấy đúng id cha
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Màu xanh đen sang trọng, họa tiết hoa trắng và tím nhạt tinh tế' FROM `ai_descriptions` WHERE `product_slug` = 'yukata-xanh';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Chất liệu vải bông mềm mại, thoáng khí cho mùa hè' FROM `ai_descriptions` WHERE `product_slug` = 'yukata-xanh';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Thiết kế tối giản theo phong cách Nhật Bản, dễ phối đồ với nhiều dịp' FROM `ai_descriptions` WHERE `product_slug` = 'yukata-xanh';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Phù hợp cho các buổi dạo phố, tiệc trà hoặc tham quan văn hóa' FROM `ai_descriptions` WHERE `product_slug` = 'yukata-xanh';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Màu hồng dịu nhẹ làm nền cho những bông hoa rực rỡ - đào, cúc, hồng môn' FROM `ai_descriptions` WHERE `product_slug` = 'kimono-hong';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Dải thắt lưng tím với họa tiết cầu kỳ và dây buộc đỏ truyền thống' FROM `ai_descriptions` WHERE `product_slug` = 'kimono-hong';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Thiết kế phù hợp cho các dịp lễ hội, sự kiện trang trọng' FROM `ai_descriptions` WHERE `product_slug` = 'kimono-hong';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Dáng dài ôm vừa vặn, phù hợp mọi dáng người' FROM `ai_descriptions` WHERE `product_slug` = 'cardigan-dai';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Màu hồng pastel dịu mắt, dễ phối đồ' FROM `ai_descriptions` WHERE `product_slug` = 'cardigan-dai';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Thiết kế đơn giản nhưng tinh tế theo phong cách Nhật Bản' FROM `ai_descriptions` WHERE `product_slug` = 'cardigan-dai';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Phù hợp cho cả công việc và dạo phố' FROM `ai_descriptions` WHERE `product_slug` = 'cardigan-dai';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Mũ vương miện bằng kim loại toàn bộ' FROM `ai_descriptions` WHERE `product_slug` = 'furina';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Phụ kiện trang sức kim loại lấp lánh' FROM `ai_descriptions` WHERE `product_slug` = 'furina';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Mi giả nguyên bản đi kèm' FROM `ai_descriptions` WHERE `product_slug` = 'furina';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Tông màu xanh đậm kết hợp vàng kim' FROM `ai_descriptions` WHERE `product_slug` = 'furina';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Thiết kế theo phong cách thời trang Nhật Bản' FROM `ai_descriptions` WHERE `product_slug` = 'furina';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Thiết kế thuộc nhóm áo khoác và trang phục layer, bám đúng tên sản phẩm “Áo len dệt kim cardigan”.' FROM `ai_descriptions` WHERE `product_slug` = 'ao-len-cardigan';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Điểm nhìn chính là phom mềm, dễ mặc nhiều lớp và hợp thời tiết mát.' FROM `ai_descriptions` WHERE `product_slug` = 'ao-len-cardigan';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Bảng màu dễ kết hợp cùng đen, kem, chàm hoặc nâu.' FROM `ai_descriptions` WHERE `product_slug` = 'ao-len-cardigan';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Màu đỏ rực rỡ làm nền cho các họa tiết trắng nổi bật' FROM `ai_descriptions` WHERE `product_slug` = 'khoac-nhat';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Chữ ''祭'' (lễ hội) lớn ở vị trí trung tâm ngực' FROM `ai_descriptions` WHERE `product_slug` = 'khoac-nhat';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Họa tiết tròn xoáy và hình học được bố trí cân đối trên thân áo' FROM `ai_descriptions` WHERE `product_slug` = 'khoac-nhat';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Đường viền sóng trắng chạy dọc phần dưới tạo điểm nhấn đặc trưng' FROM `ai_descriptions` WHERE `product_slug` = 'khoac-nhat';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Thiết kế thuộc nhóm trang phục mặc hằng ngày, bám đúng tên sản phẩm “Sơ mi trắng tay ngắn”.' FROM `ai_descriptions` WHERE `product_slug` = 'so-mi-trang';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Điểm nhìn chính là đường nét gọn giúp tổng thể chỉn chu nhưng vẫn dễ phối.' FROM `ai_descriptions` WHERE `product_slug` = 'so-mi-trang';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Tông trắng tạo cá tính rõ mà vẫn dễ phối với màu trung tính.' FROM `ai_descriptions` WHERE `product_slug` = 'so-mi-trang';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Thiết kế thuộc nhóm áo khoác và trang phục phối nhiều lớp, bám đúng tên sản phẩm “Áo choàng Haori dáng dài”.' FROM `ai_descriptions` WHERE `product_slug` = 'haori-dang-dai';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Điểm nhìn chính là phom dài tạo đường nét thanh thoát và hiệu ứng phối lớp rõ ràng.' FROM `ai_descriptions` WHERE `product_slug` = 'haori-dang-dai';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Bảng màu dễ kết hợp cùng đen, kem, chàm hoặc nâu.' FROM `ai_descriptions` WHERE `product_slug` = 'haori-dang-dai';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Thiết kế thuộc nhóm phụ kiện hoàn thiện bộ trang phục, bám đúng tên sản phẩm “Dép quai Nhật”.' FROM `ai_descriptions` WHERE `product_slug` = 'giay-dep';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Điểm nhìn chính là tỉ lệ gọn gàng, dễ làm điểm nhấn cho nhiều bộ trang phục.' FROM `ai_descriptions` WHERE `product_slug` = 'giay-dep';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Bảng màu dễ kết hợp cùng đen, kem, chàm hoặc nâu.' FROM `ai_descriptions` WHERE `product_slug` = 'giay-dep';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Màu be trung tính dễ phối đồ' FROM `ai_descriptions` WHERE `product_slug` = 'blazer-kaki';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Cổ áo đứng tôn dáng chuẩn phong cách Nhật Bản' FROM `ai_descriptions` WHERE `product_slug` = 'blazer-kaki';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, '2 hàng nút tròn đồng bộ tạo điểm nhấn sang trọng' FROM `ai_descriptions` WHERE `product_slug` = 'blazer-kaki';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Tay áo có viền kẻ sọc trắng đen khi cuộn lên' FROM `ai_descriptions` WHERE `product_slug` = 'blazer-kaki';
INSERT INTO `ai_description_details` (`ai_description_id`, `detail`) SELECT `id`, 'Chất liệu mềm mại, phù hợp công sở và dạo phố' FROM `ai_descriptions` WHERE `product_slug` = 'blazer-kaki';

INSERT INTO `japan_spot_reviews` (`id`, `place`, `prefecture`, `user_id`, `user_name`, `rating`, `comment`, `media_url`, `media_kind`, `created_at`) VALUES
  ('jspot-review-1784644821964-ss6t2', 'Kênh Otaru', 'Hokkaido', 'demo-minh', 'Trần Minh', 5, 'Rất đẹp, đèn vàng tuyệt vời', NULL, NULL, 1784644821964);

-- (không có dữ liệu cho japan_spot_suggestions)

PRAGMA foreign_keys = ON;
-- Hết. Tổng cộng 0 bảng.