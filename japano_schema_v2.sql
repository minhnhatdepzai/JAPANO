-- JAPANO — ERD v2 (DDL MySQL/MariaDB) — schema chuẩn hoá.
DROP DATABASE IF EXISTS `japano_v2`;
CREATE DATABASE `japano_v2` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `japano_v2`;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `currencies` (
  `code` VARCHAR(10),
  `name` VARCHAR(60) NOT NULL,
  `symbol` VARCHAR(10),
  PRIMARY KEY (`code`)
) ENGINE=InnoDB;

CREATE TABLE `categories` (
  `id` BIGINT AUTO_INCREMENT,
  `slug` VARCHAR(80) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `kanji` VARCHAR(40),
  `parent_id` BIGINT,
  PRIMARY KEY (`id`),
  UNIQUE (`slug`),
  FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `products` (
  `id` BIGINT AUTO_INCREMENT,
  `slug` VARCHAR(120) NOT NULL,
  `name` VARCHAR(190) NOT NULL,
  `kanji` VARCHAR(40),
  `brand` VARCHAR(80),
  `base_price` BIGINT NOT NULL,
  `old_price` BIGINT,
  `currency_code` VARCHAR(10) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `description` TEXT,
  `story` TEXT,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME,
  PRIMARY KEY (`id`),
  UNIQUE (`slug`),
  CHECK (base_price >= 0),
  FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `product_categories` (
  `product_id` BIGINT NOT NULL,
  `category_id` BIGINT NOT NULL,
  PRIMARY KEY (`product_id`, `category_id`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `product_images` (
  `id` BIGINT AUTO_INCREMENT,
  `product_id` BIGINT NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `position` INT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `product_variants` (
  `id` BIGINT AUTO_INCREMENT,
  `product_id` BIGINT NOT NULL,
  `color_name` VARCHAR(60) NOT NULL,
  `color_hex` VARCHAR(16),
  `size` VARCHAR(20) NOT NULL,
  `sku` VARCHAR(60) NOT NULL,
  `price` BIGINT,
  `stock` INT NOT NULL,
  `reserved` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`sku`),
  UNIQUE (`product_id`, `color_name`, `size`),
  CHECK (stock >= 0),
  CHECK (reserved >= 0),
  CHECK (reserved <= stock),
  CHECK (price IS NULL OR price >= 0),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `inventory_movements` (
  `id` BIGINT AUTO_INCREMENT,
  `variant_id` BIGINT NOT NULL,
  `delta` INT NOT NULL,
  `reason` VARCHAR(30) NOT NULL,
  `order_id` BIGINT,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `users` (
  `id` BIGINT AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(190),
  `phone` VARCHAR(40),
  `password_hash` VARCHAR(255),
  `role` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`email`)
) ENGINE=InnoDB;

CREATE TABLE `addresses` (
  `id` BIGINT AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `recipient_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(40) NOT NULL,
  `street` VARCHAR(255) NOT NULL,
  `ward_code` VARCHAR(20),
  `ward` VARCHAR(120),
  `province_code` VARCHAR(20),
  `province` VARCHAR(120),
  `is_default` BOOLEAN NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `carts` (
  `id` BIGINT AUTO_INCREMENT,
  `user_id` BIGINT,
  `session_token` VARCHAR(64),
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `cart_items` (
  `id` BIGINT AUTO_INCREMENT,
  `cart_id` BIGINT NOT NULL,
  `variant_id` BIGINT NOT NULL,
  `quantity` INT NOT NULL,
  `added_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`cart_id`, `variant_id`),
  CHECK (quantity > 0),
  FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `wishlists` (
  `id` BIGINT AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`user_id`, `product_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `vouchers` (
  `id` BIGINT AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `value` INT NOT NULL,
  `min_order` BIGINT NOT NULL,
  `max_discount` BIGINT,
  `usage_limit` INT,
  `per_user_limit` INT,
  `used_count` INT NOT NULL,
  `starts_at` DATETIME,
  `expires_at` DATETIME,
  `active` BOOLEAN NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`code`),
  CHECK (value >= 0),
  CHECK (min_order >= 0)
) ENGINE=InnoDB;

CREATE TABLE `payment_promotions` (
  `code` VARCHAR(40),
  `provider` VARCHAR(20) NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `value` INT NOT NULL,
  `active` BOOLEAN NOT NULL,
  PRIMARY KEY (`code`),
  CHECK (value >= 0)
) ENGINE=InnoDB;

CREATE TABLE `orders` (
  `id` BIGINT AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `user_id` BIGINT,
  `status` VARCHAR(30) NOT NULL,
  `shipping_address_id` BIGINT,
  `ship_recipient` VARCHAR(150) NOT NULL,
  `ship_phone` VARCHAR(40) NOT NULL,
  `ship_street` VARCHAR(255) NOT NULL,
  `ship_ward_code` VARCHAR(20),
  `ship_ward` VARCHAR(120),
  `ship_province_code` VARCHAR(20),
  `ship_province` VARCHAR(120),
  `contact_email` VARCHAR(190),
  `subtotal` BIGINT NOT NULL,
  `discount_total` BIGINT NOT NULL,
  `shipping_fee` BIGINT NOT NULL,
  `grand_total` BIGINT NOT NULL,
  `currency_code` VARCHAR(10) NOT NULL,
  `source` VARCHAR(30),
  `placed_at` DATETIME NOT NULL,
  `cancelled_at` DATETIME,
  `cancel_reason` VARCHAR(255),
  PRIMARY KEY (`id`),
  UNIQUE (`code`),
  CHECK (subtotal >= 0),
  CHECK (discount_total >= 0),
  CHECK (shipping_fee >= 0),
  CHECK (grand_total >= 0),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `order_items` (
  `id` BIGINT AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `variant_id` BIGINT,
  `product_id` BIGINT,
  `name_snapshot` VARCHAR(190) NOT NULL,
  `color_snapshot` VARCHAR(60),
  `size_snapshot` VARCHAR(20),
  `unit_price` BIGINT NOT NULL,
  `quantity` INT NOT NULL,
  `line_total` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  CHECK (line_total >= 0),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `order_discounts` (
  `id` BIGINT AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `source_type` VARCHAR(20) NOT NULL,
  `voucher_id` BIGINT,
  `promotion_code` VARCHAR(40),
  `amount` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  CHECK (amount >= 0),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`promotion_code`) REFERENCES `payment_promotions`(`code`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `order_status_history` (
  `id` BIGINT AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `from_status` VARCHAR(30),
  `to_status` VARCHAR(30) NOT NULL,
  `changed_by` BIGINT,
  `note` VARCHAR(255),
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `payments` (
  `id` BIGINT AUTO_INCREMENT,
  `code` VARCHAR(60) NOT NULL,
  `order_id` BIGINT NOT NULL,
  `provider` VARCHAR(20) NOT NULL,
  `method` VARCHAR(40),
  `status` VARCHAR(20) NOT NULL,
  `amount` BIGINT NOT NULL,
  `currency_code` VARCHAR(10) NOT NULL,
  `transaction_code` VARCHAR(120),
  `paid_at` DATETIME,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`code`),
  CHECK (amount >= 0),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `return_requests` (
  `id` BIGINT AUTO_INCREMENT,
  `code` VARCHAR(60) NOT NULL,
  `order_id` BIGINT NOT NULL,
  `user_id` BIGINT,
  `payment_id` BIGINT,
  `status` VARCHAR(30) NOT NULL,
  `reason` VARCHAR(255),
  `note` TEXT,
  `amount` BIGINT NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`code`),
  CHECK (amount >= 0),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `return_request_items` (
  `id` BIGINT AUTO_INCREMENT,
  `return_request_id` BIGINT NOT NULL,
  `order_item_id` BIGINT NOT NULL,
  `quantity` INT NOT NULL,
  PRIMARY KEY (`id`),
  CHECK (quantity > 0),
  FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `refunds` (
  `id` BIGINT AUTO_INCREMENT,
  `payment_id` BIGINT NOT NULL,
  `return_request_id` BIGINT,
  `amount` BIGINT NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `reason` VARCHAR(120),
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  CHECK (amount > 0),
  FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `voucher_redemptions` (
  `id` BIGINT AUTO_INCREMENT,
  `voucher_id` BIGINT NOT NULL,
  `user_id` BIGINT,
  `order_id` BIGINT NOT NULL,
  `discount_amount` BIGINT NOT NULL,
  `redeemed_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`voucher_id`, `order_id`),
  CHECK (discount_amount >= 0),
  FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `reviews` (
  `id` BIGINT AUTO_INCREMENT,
  `product_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `order_id` BIGINT,
  `rating` TINYINT NOT NULL,
  `comment` TEXT,
  `media_url` VARCHAR(500),
  `media_kind` VARCHAR(10),
  `status` VARCHAR(20) NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`user_id`, `product_id`),
  CHECK (rating BETWEEN 1 AND 5),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `review_reactions` (
  `id` BIGINT AUTO_INCREMENT,
  `review_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `value` VARCHAR(20) NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`review_id`, `user_id`),
  FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `moderation_samples` (
  `id` BIGINT AUTO_INCREMENT,
  `review_id` BIGINT,
  `label` VARCHAR(30),
  `normalized_text` TEXT,
  `source` VARCHAR(30),
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `interactions` (
  `id` BIGINT AUTO_INCREMENT,
  `user_id` BIGINT,
  `product_id` BIGINT,
  `type` VARCHAR(30) NOT NULL,
  `value` INT NOT NULL,
  `created_at` DATETIME NOT NULL,
  `source` VARCHAR(30),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `chats` (
  `id` BIGINT AUTO_INCREMENT,
  `user_id` BIGINT,
  `role` VARCHAR(20) NOT NULL,
  `message` TEXT,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `chat_product_refs` (
  `id` BIGINT AUTO_INCREMENT,
  `chat_id` BIGINT NOT NULL,
  `product_id` BIGINT,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `tryon_history` (
  `id` BIGINT AUTO_INCREMENT,
  `user_id` BIGINT,
  `product_id` BIGINT,
  `engine` VARCHAR(190),
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `tryon_accessories` (
  `id` BIGINT AUTO_INCREMENT,
  `tryon_id` BIGINT NOT NULL,
  `product_id` BIGINT,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`tryon_id`) REFERENCES `tryon_history`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `goals` (
  `id` BIGINT AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `product_id` BIGINT,
  `monthly_income` BIGINT,
  `fixed_expenses` BIGINT,
  `current_savings` BIGINT,
  `target_months` INT,
  `plan` JSON,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `ai_descriptions` (
  `id` BIGINT AUTO_INCREMENT,
  `product_id` BIGINT NOT NULL,
  `headline` VARCHAR(255),
  `visual_summary` TEXT,
  `styling_tip` TEXT,
  `purchase_reason` TEXT,
  `confidence` VARCHAR(10),
  `engine` VARCHAR(60),
  `generated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`product_id`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `ai_description_details` (
  `id` BIGINT AUTO_INCREMENT,
  `ai_description_id` BIGINT NOT NULL,
  `detail` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`ai_description_id`) REFERENCES `ai_descriptions`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `flagcards` (
  `id` BIGINT AUTO_INCREMENT,
  `slug` VARCHAR(80) NOT NULL,
  `sort_order` INT,
  `title` VARCHAR(190) NOT NULL,
  `japanese` VARCHAR(190),
  `region` VARCHAR(120),
  `summary` TEXT,
  `active` BOOLEAN NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`slug`)
) ENGINE=InnoDB;

CREATE TABLE `flagcard_facts` (
  `id` BIGINT AUTO_INCREMENT,
  `flagcard_id` BIGINT NOT NULL,
  `fact` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`flagcard_id`) REFERENCES `flagcards`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `flagcard_checkins` (
  `id` BIGINT AUTO_INCREMENT,
  `flagcard_id` BIGINT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `tip` VARCHAR(255),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`flagcard_id`) REFERENCES `flagcards`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `flagcard_recommended_products` (
  `id` BIGINT AUTO_INCREMENT,
  `flagcard_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE (`flagcard_id`, `product_id`),
  FOREIGN KEY (`flagcard_id`) REFERENCES `flagcards`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `flagcard_collections` (
  `id` BIGINT AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME,
  PRIMARY KEY (`id`),
  UNIQUE (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `flagcard_collection_awards` (
  `id` BIGINT AUTO_INCREMENT,
  `collection_id` BIGINT NOT NULL,
  `flagcard_id` BIGINT,
  `order_id` BIGINT,
  `awarded_at` DATETIME NOT NULL,
  `source` VARCHAR(40),
  PRIMARY KEY (`id`),
  UNIQUE (`collection_id`, `flagcard_id`),
  FOREIGN KEY (`collection_id`) REFERENCES `flagcard_collections`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (`flagcard_id`) REFERENCES `flagcards`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `japan_spot_reviews` (
  `id` BIGINT AUTO_INCREMENT,
  `place` VARCHAR(190) NOT NULL,
  `prefecture` VARCHAR(120) NOT NULL,
  `user_id` BIGINT,
  `rating` TINYINT NOT NULL,
  `comment` TEXT,
  `media_url` VARCHAR(500),
  `media_kind` VARCHAR(10),
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  CHECK (rating BETWEEN 1 AND 5),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `japan_spot_suggestions` (
  `id` BIGINT AUTO_INCREMENT,
  `prefecture` VARCHAR(120) NOT NULL,
  `user_id` BIGINT,
  `suggestion` TEXT,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `notifications` (
  `id` BIGINT AUTO_INCREMENT,
  `title` VARCHAR(255),
  `body` TEXT,
  `type` VARCHAR(60),
  `action` VARCHAR(120),
  `reach` INT,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `banners` (
  `id` BIGINT AUTO_INCREMENT,
  `title` VARCHAR(190),
  `image` VARCHAR(500),
  `link` VARCHAR(255),
  `active` BOOLEAN NOT NULL,
  `sort_order` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `shop_settings` (
  `id` TINYINT,
  `name` VARCHAR(150),
  `hotline` VARCHAR(40),
  `email` VARCHAR(150),
  `address` VARCHAR(255),
  `ship_fee` BIGINT,
  `cod` BOOLEAN,
  `stripe` BOOLEAN,
  `vnpay` BOOLEAN,
  `logo_url` VARCHAR(500),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `flagcard_config` (
  `id` TINYINT,
  `active` BOOLEAN,
  `qualifying_order_min` BIGINT,
  `required_cards` INT,
  `reward_percent` INT,
  `reward_validity_days` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `integration_settings` (
  `id` TINYINT,
  `mongo` BOOLEAN,
  `cloudinary` BOOLEAN,
  `ai` BOOLEAN,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;