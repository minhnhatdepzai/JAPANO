// Sinh file SQL (MySQL/MariaDB) mô tả toàn bộ app JAPANO như một ERD:
//   - CREATE TABLE với PRIMARY KEY + FOREIGN KEY (dây nối FK -> PK)
//   - INSERT dữ liệu thật lấy từ backend/data/db.json (đúng như app đang chạy)
// Chạy:  node backend/scripts/exportMysqlErd.js  ->  japano_erd.sql ở gốc repo.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');
const OUT_FILE = path.join(__dirname, '..', '..', 'japano_erd.sql');
const state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

// Vài sản phẩm thêm từ admin chưa có slug -> lấy id làm slug (đảm bảo UNIQUE,
// NOT NULL và mọi khóa ngoại tham chiếu products(slug) vẫn hợp lệ).
state.products.forEach((p) => { if (!p.slug) p.slug = p.id; });

// ---- helpers dựng giá trị SQL an toàn ---------------------------------------
const NULL = 'NULL';
function sql(v) {
  if (v === null || v === undefined || v === '') return NULL;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : NULL;
  if (typeof v === 'boolean') return v ? '1' : '0';
  const s = String(v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\x00/g, '');
  return `'${s}'`;
}
function bool(v) { return v ? '1' : '0'; }
function jsonCol(v) { return v == null ? NULL : sql(JSON.stringify(v)); }

// ---- chuẩn hoá tham chiếu để FK không bị "treo" -----------------------------
const productById = new Map(state.products.map((p) => [p.id, p]));
const productBySlug = new Map(state.products.map((p) => [p.slug, p]));
function toSlug(ref) {
  if (!ref) return null;
  if (productBySlug.has(ref)) return ref;
  if (productById.has(ref)) return productById.get(ref).slug;
  return null; // sản phẩm đã gỡ -> để NULL, FK vẫn hợp lệ
}

// Bổ sung user "stub" cho mọi userId được tham chiếu nhưng chưa có trong users
const users = state.users.map((u) => ({ ...u }));
const userIds = new Set(users.map((u) => u.id));
function nameForUser(id) {
  for (const o of state.orders) if (o.userId === id && o.customer?.name) return o.customer.name;
  for (const p of state.payments) if (p.userId === id && p.customer?.name) return p.customer.name;
  return id;
}
const REFERENCED_USER_KEYS = ['orders', 'payments', 'returnRequests', 'reviews', 'reviewReactions',
  'voucherRedemptions', 'flagcardCollections', 'interactions', 'profiles', 'chats', 'tryonHistory',
  'goals', 'japanSpotReviews', 'japanSpotSuggestions'];
for (const key of REFERENCED_USER_KEYS) {
  for (const row of state[key] || []) {
    const id = row.userId;
    if (id && !userIds.has(id)) {
      userIds.add(id);
      users.push({ id, name: nameForUser(id), email: null, role: 'customer', status: 'active',
        orders: 0, spent: 0, tryons: 0, vip: 'Mới', joinedAt: row.createdAt || Date.now(), _stub: true });
    }
  }
}
function userRef(id) { return id && userIds.has(id) ? id : null; }

// Bổ sung voucher "stub" cho các mã được tham chiếu nhưng chưa khai báo
const vouchers = state.vouchers.map((v) => ({ ...v }));
const voucherCodes = new Set(vouchers.map((v) => v.code));
const referencedCodes = new Set();
state.orders.forEach((o) => o.discountCode && referencedCodes.add(o.discountCode));
state.voucherRedemptions.forEach((r) => r.code && referencedCodes.add(r.code));
state.payments.forEach((p) => p.promotionCode && referencedCodes.add(p.promotionCode));
for (const code of referencedCodes) {
  if (!voucherCodes.has(code)) {
    voucherCodes.add(code);
    vouchers.push({ code, type: 'percent', value: 0, min: 0, expiry: null, limit: 0, used: 0, active: false, _stub: true });
  }
}
function voucherRef(code) { return code && voucherCodes.has(code) ? code : null; }

// Tập hợp id hợp lệ để FK tham chiếu chéo
const orderIds = new Set(state.orders.map((o) => o.id));
const paymentIds = new Set(state.payments.map((p) => p.id));
const returnIds = new Set(state.returnRequests.map((r) => r.id));
const reviewIds = new Set((state.reviews || []).map((r) => r.id));
const flagcardIds = new Set(state.flagcards.map((f) => f.id));
const ref = (val, set) => (val && set.has(val) ? val : null);

// ---- bộ đệm output ----------------------------------------------------------
const out = [];
const w = (line = '') => out.push(line);
function insert(table, columns, rows) {
  if (!rows.length) { w(`-- (không có dữ liệu cho ${table})`); w(); return; }
  w(`INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES`);
  rows.forEach((vals, i) => w(`  (${vals.join(', ')})${i === rows.length - 1 ? ';' : ','}`));
  w();
}

// ============================================================================
// PHẦN 1 — HEADER + SCHEMA (DDL)
// ============================================================================
w('-- =============================================================');
w('-- JAPANO — Sơ đồ quan hệ thực thể (ERD) cho MySQL / MariaDB');
w('-- Sinh tự động từ backend/data/db.json (dữ liệu thật đang chạy).');
w('-- Mỗi FOREIGN KEY chính là "dây nối" từ khóa ngoại (FK) đến khóa chính (PK).');
w('-- Thời gian lưu bằng BIGINT (epoch mili-giây) đúng như app dùng.');
w('-- =============================================================');
w();
w('DROP DATABASE IF EXISTS `japano`;');
w('CREATE DATABASE `japano` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
w('USE `japano`;');
w();
w('SET FOREIGN_KEY_CHECKS = 0;');
w('SET NAMES utf8mb4;');
w();

const DDL = `
-- ---- Bảng cấu hình (singleton) ----------------------------------------------
CREATE TABLE \`shop_settings\` (
  \`id\` TINYINT PRIMARY KEY DEFAULT 1,
  \`name\` VARCHAR(150), \`hotline\` VARCHAR(40), \`email\` VARCHAR(150),
  \`address\` VARCHAR(255), \`ship_fee\` INT, \`cod\` BOOLEAN, \`stripe\` BOOLEAN,
  \`vnpay\` BOOLEAN, \`logo\` TEXT
) ENGINE=InnoDB;

CREATE TABLE \`flagcard_config\` (
  \`id\` TINYINT PRIMARY KEY DEFAULT 1,
  \`active\` BOOLEAN, \`qualifying_order_min\` INT, \`required_cards\` INT,
  \`reward_percent\` INT, \`reward_voucher_min_order\` INT, \`reward_validity_days\` INT
) ENGINE=InnoDB;

CREATE TABLE \`integration_settings\` (
  \`id\` TINYINT PRIMARY KEY DEFAULT 1,
  \`mongo\` BOOLEAN, \`cloudinary\` BOOLEAN, \`ai\` BOOLEAN
) ENGINE=InnoDB;

-- ---- Thực thể gốc (không phụ thuộc FK) --------------------------------------
CREATE TABLE \`categories\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`name\` VARCHAR(150) NOT NULL,
  \`kanji\` VARCHAR(40)
) ENGINE=InnoDB;

CREATE TABLE \`users\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`name\` VARCHAR(150) NOT NULL,
  \`email\` VARCHAR(190) UNIQUE,
  \`role\` VARCHAR(30) NOT NULL DEFAULT 'customer',
  \`status\` VARCHAR(30) NOT NULL DEFAULT 'active',
  \`orders_count\` INT DEFAULT 0,
  \`spent\` BIGINT DEFAULT 0,
  \`tryons\` INT DEFAULT 0,
  \`vip\` VARCHAR(40),
  \`joined_at\` BIGINT
) ENGINE=InnoDB;

CREATE TABLE \`vouchers\` (
  \`code\` VARCHAR(40) PRIMARY KEY,
  \`type\` VARCHAR(20) NOT NULL,
  \`value\` INT NOT NULL,
  \`min_order\` INT DEFAULT 0,
  \`expiry\` DATE,
  \`usage_limit\` INT DEFAULT 0,
  \`used\` INT DEFAULT 0,
  \`active\` BOOLEAN DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE \`banners\` (
  \`id\` VARCHAR(40) PRIMARY KEY,
  \`title\` VARCHAR(190),
  \`img\` VARCHAR(255),
  \`link\` VARCHAR(255),
  \`active\` BOOLEAN DEFAULT 1,
  \`sort_order\` INT DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE \`notifications\` (
  \`id\` VARCHAR(60) PRIMARY KEY,
  \`title\` VARCHAR(255),
  \`body\` TEXT,
  \`type\` VARCHAR(60),
  \`action\` VARCHAR(120),
  \`reach\` INT DEFAULT 0,
  \`at\` BIGINT
) ENGINE=InnoDB;

CREATE TABLE \`flagcards\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`sort_order\` INT,
  \`glyph\` VARCHAR(16),
  \`accent\` VARCHAR(16),
  \`title\` VARCHAR(190),
  \`japanese\` VARCHAR(190),
  \`region\` VARCHAR(120),
  \`summary\` TEXT,
  \`formation_history\` TEXT,
  \`legend\` TEXT,
  \`outfit_style\` VARCHAR(190),
  \`outfit_reason\` TEXT,
  \`source_url\` VARCHAR(255),
  \`active\` BOOLEAN DEFAULT 1
) ENGINE=InnoDB;

-- ---- Sản phẩm và bảng con ---------------------------------------------------
CREATE TABLE \`products\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`slug\` VARCHAR(120) NOT NULL UNIQUE,
  \`name\` VARCHAR(190) NOT NULL,
  \`kanji\` VARCHAR(40),
  \`sku\` VARCHAR(60),
  \`category_id\` VARCHAR(80),
  \`brand\` VARCHAR(80),
  \`price\` BIGINT NOT NULL,
  \`old_price\` BIGINT,
  \`sale\` INT,
  \`status\` VARCHAR(30) DEFAULT 'published',
  \`color_hex\` VARCHAR(16),
  \`rating\` DECIMAL(3,1) DEFAULT 0,
  \`sold\` INT DEFAULT 0,
  \`description\` TEXT,
  \`story\` TEXT,
  \`image\` VARCHAR(255),
  CONSTRAINT \`fk_products_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`product_images\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`product_id\` VARCHAR(80) NOT NULL,
  \`url\` VARCHAR(255) NOT NULL,
  \`position\` INT DEFAULT 0,
  CONSTRAINT \`fk_pimg_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`product_variants\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`product_id\` VARCHAR(80) NOT NULL,
  \`color_name\` VARCHAR(60),
  \`color_hex\` VARCHAR(16),
  \`size\` VARCHAR(20),
  \`sku\` VARCHAR(60),
  \`stock\` INT DEFAULT 0,
  CONSTRAINT \`fk_pvar_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`product_tags\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`product_id\` VARCHAR(80) NOT NULL,
  \`tag\` VARCHAR(80) NOT NULL,
  \`kind\` VARCHAR(20) NOT NULL DEFAULT 'tag',
  CONSTRAINT \`fk_ptag_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- Bảng con của flagcards -------------------------------------------------
CREATE TABLE \`flagcard_facts\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`flagcard_id\` VARCHAR(80) NOT NULL,
  \`fact\` VARCHAR(255) NOT NULL,
  CONSTRAINT \`fk_ffact_card\` FOREIGN KEY (\`flagcard_id\`) REFERENCES \`flagcards\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`flagcard_checkins\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`flagcard_id\` VARCHAR(80) NOT NULL,
  \`name\` VARCHAR(120) NOT NULL,
  \`tip\` VARCHAR(255),
  CONSTRAINT \`fk_fchk_card\` FOREIGN KEY (\`flagcard_id\`) REFERENCES \`flagcards\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`flagcard_recommended_products\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`flagcard_id\` VARCHAR(80) NOT NULL,
  \`product_slug\` VARCHAR(120),
  CONSTRAINT \`fk_frec_card\` FOREIGN KEY (\`flagcard_id\`) REFERENCES \`flagcards\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_frec_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---- Hồ sơ phong cách của user ----------------------------------------------
CREATE TABLE \`profiles\` (
  \`user_id\` VARCHAR(80) PRIMARY KEY,
  \`gender\` VARCHAR(30),
  \`skin_tone\` VARCHAR(60),
  \`occasion\` VARCHAR(120),
  \`budget\` BIGINT,
  \`height_cm\` INT,
  \`weight_kg\` INT,
  \`usual_size\` VARCHAR(20),
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_profile_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`profile_styles\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` VARCHAR(80) NOT NULL,
  \`style\` VARCHAR(80) NOT NULL,
  CONSTRAINT \`fk_pstyle_profile\` FOREIGN KEY (\`user_id\`) REFERENCES \`profiles\`(\`user_id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- Đơn hàng ---------------------------------------------------------------
CREATE TABLE \`orders\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`code\` VARCHAR(40) NOT NULL,
  \`user_id\` VARCHAR(80),
  \`customer_name\` VARCHAR(150),
  \`customer_email\` VARCHAR(190),
  \`customer_phone\` VARCHAR(40),
  \`address\` VARCHAR(255),
  \`ward_code\` VARCHAR(20),
  \`ward\` VARCHAR(120),
  \`province_code\` VARCHAR(20),
  \`province\` VARCHAR(120),
  \`subtotal\` BIGINT,
  \`discount\` BIGINT DEFAULT 0,
  \`voucher_discount\` BIGINT DEFAULT 0,
  \`payment_discount\` BIGINT DEFAULT 0,
  \`discount_code\` VARCHAR(40),
  \`total\` BIGINT,
  \`ship\` BIGINT DEFAULT 0,
  \`payment_method\` VARCHAR(40),
  \`payment_provider\` VARCHAR(40),
  \`payment_status\` VARCHAR(40),
  \`payment_txn\` VARCHAR(120),
  \`payment_currency\` VARCHAR(10),
  \`status\` VARCHAR(30) NOT NULL,
  \`source\` VARCHAR(30),
  \`created_at\` BIGINT,
  CONSTRAINT \`fk_order_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT \`fk_order_voucher\` FOREIGN KEY (\`discount_code\`) REFERENCES \`vouchers\`(\`code\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`order_items\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`order_id\` VARCHAR(80) NOT NULL,
  \`product_slug\` VARCHAR(120),
  \`name\` VARCHAR(190),
  \`color_name\` VARCHAR(60),
  \`color_hex\` VARCHAR(16),
  \`size\` VARCHAR(20),
  \`qty\` INT NOT NULL DEFAULT 1,
  \`price\` BIGINT NOT NULL,
  CONSTRAINT \`fk_oitem_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_oitem_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`order_history\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`order_id\` VARCHAR(80) NOT NULL,
  \`status\` VARCHAR(30) NOT NULL,
  \`at\` BIGINT,
  CONSTRAINT \`fk_ohist_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- Thanh toán -------------------------------------------------------------
CREATE TABLE \`payments\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`code\` VARCHAR(60),
  \`order_id\` VARCHAR(80),
  \`user_id\` VARCHAR(80),
  \`provider\` VARCHAR(40),
  \`method\` VARCHAR(40),
  \`status\` VARCHAR(40),
  \`amount\` BIGINT,
  \`original_amount\` BIGINT,
  \`discount\` BIGINT DEFAULT 0,
  \`voucher_discount\` BIGINT DEFAULT 0,
  \`payment_discount\` BIGINT DEFAULT 0,
  \`promotion_code\` VARCHAR(40),
  \`currency\` VARCHAR(10),
  \`transaction_code\` VARCHAR(120),
  \`payment_intent_id\` VARCHAR(120),
  \`checkout_session_id\` VARCHAR(190),
  \`refundable\` BOOLEAN DEFAULT 0,
  \`amount_subtotal\` BIGINT,
  \`paid_at\` BIGINT,
  \`charge_id\` VARCHAR(120),
  \`receipt_url\` VARCHAR(500),
  \`created_at\` BIGINT,
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_pay_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT \`fk_pay_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---- Yêu cầu trả hàng / hoàn tiền -------------------------------------------
CREATE TABLE \`return_requests\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`code\` VARCHAR(60),
  \`order_id\` VARCHAR(80),
  \`user_id\` VARCHAR(80),
  \`payment_id\` VARCHAR(80),
  \`status\` VARCHAR(30),
  \`reason\` VARCHAR(255),
  \`note\` TEXT,
  \`admin_note\` TEXT,
  \`amount\` BIGINT,
  \`currency\` VARCHAR(10),
  \`refund_id\` VARCHAR(120),
  \`refund_status\` VARCHAR(40),
  \`created_at\` BIGINT,
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_ret_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT \`fk_ret_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT \`fk_ret_payment\` FOREIGN KEY (\`payment_id\`) REFERENCES \`payments\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`payment_refunds\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`payment_id\` VARCHAR(80) NOT NULL,
  \`amount\` BIGINT,
  \`currency\` VARCHAR(10),
  \`status\` VARCHAR(40),
  \`reason\` VARCHAR(120),
  \`failure_reason\` VARCHAR(255),
  \`return_request_id\` VARCHAR(80),
  \`created_at\` BIGINT,
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_refund_payment\` FOREIGN KEY (\`payment_id\`) REFERENCES \`payments\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_refund_return\` FOREIGN KEY (\`return_request_id\`) REFERENCES \`return_requests\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`return_request_items\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`return_request_id\` VARCHAR(80) NOT NULL,
  \`product_slug\` VARCHAR(120),
  \`name\` VARCHAR(190),
  \`size\` VARCHAR(20),
  \`color_name\` VARCHAR(60),
  \`qty\` INT DEFAULT 1,
  \`price\` BIGINT,
  CONSTRAINT \`fk_ritem_return\` FOREIGN KEY (\`return_request_id\`) REFERENCES \`return_requests\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_ritem_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`return_request_timeline\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`return_request_id\` VARCHAR(80) NOT NULL,
  \`status\` VARCHAR(30) NOT NULL,
  \`at\` BIGINT,
  \`refund_id\` VARCHAR(120),
  \`note\` VARCHAR(255),
  CONSTRAINT \`fk_rtl_return\` FOREIGN KEY (\`return_request_id\`) REFERENCES \`return_requests\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- Giỏ hàng ---------------------------------------------------------------
CREATE TABLE \`carts\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`user_id\` VARCHAR(80),
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_cart_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`cart_items\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`cart_id\` VARCHAR(80) NOT NULL,
  \`product_slug\` VARCHAR(120),
  \`color\` VARCHAR(60),
  \`size\` VARCHAR(20),
  \`qty\` INT DEFAULT 1,
  CONSTRAINT \`fk_citem_cart\` FOREIGN KEY (\`cart_id\`) REFERENCES \`carts\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_citem_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---- Đánh giá sản phẩm (đã xác minh mua hàng) -------------------------------
CREATE TABLE \`reviews\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`product_slug\` VARCHAR(120),
  \`user_id\` VARCHAR(80),
  \`order_id\` VARCHAR(80),
  \`order_code\` VARCHAR(40),
  \`rating\` TINYINT NOT NULL,
  \`comment\` TEXT,
  \`media_url\` VARCHAR(500),
  \`media_kind\` VARCHAR(10),
  \`status\` VARCHAR(20) DEFAULT 'approved',
  \`created_at\` BIGINT,
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_review_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT \`fk_review_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT \`fk_review_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`review_reactions\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`review_id\` VARCHAR(80) NOT NULL,
  \`user_id\` VARCHAR(80),
  \`value\` VARCHAR(20) NOT NULL,
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_reaction_review\` FOREIGN KEY (\`review_id\`) REFERENCES \`reviews\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_reaction_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`moderation_samples\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`review_id\` VARCHAR(80),
  \`label\` VARCHAR(30),
  \`normalized_text\` TEXT,
  \`source\` VARCHAR(30),
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_modsample_review\` FOREIGN KEY (\`review_id\`) REFERENCES \`reviews\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---- Voucher đã dùng --------------------------------------------------------
CREATE TABLE \`voucher_redemptions\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`code\` VARCHAR(40),
  \`user_id\` VARCHAR(80),
  \`order_id\` VARCHAR(80),
  \`discount\` BIGINT,
  \`redeemed_at\` BIGINT,
  CONSTRAINT \`fk_vred_voucher\` FOREIGN KEY (\`code\`) REFERENCES \`vouchers\`(\`code\`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT \`fk_vred_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT \`fk_vred_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---- Bộ sưu tập Flagcard của user -------------------------------------------
CREATE TABLE \`flagcard_collections\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`user_id\` VARCHAR(80),
  \`created_at\` BIGINT,
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_fcol_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`flagcard_collection_awards\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`collection_id\` VARCHAR(80) NOT NULL,
  \`flagcard_id\` VARCHAR(80),
  \`order_id\` VARCHAR(80),
  \`order_code\` VARCHAR(40),
  \`order_total\` BIGINT,
  \`awarded_at\` BIGINT,
  \`source\` VARCHAR(40),
  CONSTRAINT \`fk_faward_collection\` FOREIGN KEY (\`collection_id\`) REFERENCES \`flagcard_collections\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_faward_card\` FOREIGN KEY (\`flagcard_id\`) REFERENCES \`flagcards\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT \`fk_faward_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---- Hành vi / gợi ý (AI) ---------------------------------------------------
CREATE TABLE \`interactions\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`user_id\` VARCHAR(80),
  \`product_slug\` VARCHAR(120),
  \`type\` VARCHAR(30),
  \`value\` INT DEFAULT 1,
  \`created_at\` BIGINT,
  \`source\` VARCHAR(30),
  CONSTRAINT \`fk_inter_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_inter_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`chats\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`user_id\` VARCHAR(80),
  \`role\` VARCHAR(20),
  \`message\` TEXT,
  \`created_at\` BIGINT,
  CONSTRAINT \`fk_chat_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`chat_product_refs\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`chat_id\` VARCHAR(80) NOT NULL,
  \`product_slug\` VARCHAR(120),
  CONSTRAINT \`fk_cref_chat\` FOREIGN KEY (\`chat_id\`) REFERENCES \`chats\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_cref_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`tryon_history\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`user_id\` VARCHAR(80),
  \`product_slug\` VARCHAR(120),
  \`engine\` VARCHAR(190),
  \`created_at\` BIGINT,
  CONSTRAINT \`fk_tryon_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_tryon_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`tryon_accessories\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`tryon_id\` VARCHAR(80) NOT NULL,
  \`product_slug\` VARCHAR(120),
  CONSTRAINT \`fk_tacc_tryon\` FOREIGN KEY (\`tryon_id\`) REFERENCES \`tryon_history\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_tacc_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---- Mục tiêu mua sắm / sức khỏe --------------------------------------------
CREATE TABLE \`goals\` (
  \`id\` VARCHAR(120) PRIMARY KEY,
  \`user_id\` VARCHAR(80),
  \`product_slug\` VARCHAR(120),
  \`age\` INT,
  \`height_cm\` INT,
  \`current_weight_kg\` INT,
  \`target_weight_kg\` INT,
  \`monthly_income\` BIGINT,
  \`fixed_expenses\` BIGINT,
  \`current_savings\` BIGINT,
  \`target_months\` INT,
  \`plan\` JSON,
  \`created_at\` BIGINT,
  \`updated_at\` BIGINT,
  CONSTRAINT \`fk_goal_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT \`fk_goal_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---- Mô tả sản phẩm do AI sinh ----------------------------------------------
CREATE TABLE \`ai_descriptions\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`product_slug\` VARCHAR(120) UNIQUE,
  \`generated_at\` BIGINT,
  \`headline\` VARCHAR(255),
  \`visual_summary\` TEXT,
  \`styling_tip\` TEXT,
  \`purchase_reason\` TEXT,
  \`confidence\` VARCHAR(10),
  \`engine\` VARCHAR(60),
  CONSTRAINT \`fk_aidesc_product\` FOREIGN KEY (\`product_slug\`) REFERENCES \`products\`(\`slug\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`ai_description_details\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`ai_description_id\` INT NOT NULL,
  \`detail\` VARCHAR(500) NOT NULL,
  CONSTRAINT \`fk_aidetail_desc\` FOREIGN KEY (\`ai_description_id\`) REFERENCES \`ai_descriptions\`(\`id\`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- Khám phá Nhật Bản: đánh giá & đề xuất địa điểm -------------------------
CREATE TABLE \`japan_spot_reviews\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`place\` VARCHAR(190) NOT NULL,
  \`prefecture\` VARCHAR(120) NOT NULL,
  \`user_id\` VARCHAR(80),
  \`user_name\` VARCHAR(150),
  \`rating\` TINYINT NOT NULL,
  \`comment\` TEXT,
  \`media_url\` VARCHAR(500),
  \`media_kind\` VARCHAR(10),
  \`created_at\` BIGINT,
  CONSTRAINT \`fk_jsr_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE \`japan_spot_suggestions\` (
  \`id\` VARCHAR(80) PRIMARY KEY,
  \`prefecture\` VARCHAR(120) NOT NULL,
  \`user_id\` VARCHAR(80),
  \`user_name\` VARCHAR(150),
  \`suggestion\` TEXT,
  \`created_at\` BIGINT,
  CONSTRAINT \`fk_jss_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
`;
w(DDL.trim());
w();

// ============================================================================
// PHẦN 2 — DỮ LIỆU (INSERT)
// ============================================================================
w('-- =============================================================');
w('-- DỮ LIỆU THẬT (trích từ app đang chạy)');
w('-- =============================================================');
w();

// Singletons
const shop = state.shop || {};
insert('shop_settings', ['id', 'name', 'hotline', 'email', 'address', 'ship_fee', 'cod', 'stripe', 'vnpay', 'logo'],
  [[1, sql(shop.name), sql(shop.hotline), sql(shop.email), sql(shop.address), sql(shop.shipFee), bool(shop.cod), bool(shop.stripe), bool(shop.vnpay), sql(shop.logo)]]);
const fc = state.flagcardConfig || {};
insert('flagcard_config', ['id', 'active', 'qualifying_order_min', 'required_cards', 'reward_percent', 'reward_voucher_min_order', 'reward_validity_days'],
  [[1, bool(fc.active), sql(fc.qualifyingOrderMin), sql(fc.requiredCards), sql(fc.rewardPercent), sql(fc.rewardVoucherMinOrder), sql(fc.rewardValidityDays)]]);
const ig = state.integrations || {};
insert('integration_settings', ['id', 'mongo', 'cloudinary', 'ai'], [[1, bool(ig.mongo), bool(ig.cloudinary), bool(ig.ai)]]);

// categories
insert('categories', ['id', 'name', 'kanji'], state.categories.map((c) => [sql(c.id), sql(c.name), sql(c.kanji)]));

// users
insert('users', ['id', 'name', 'email', 'role', 'status', 'orders_count', 'spent', 'tryons', 'vip', 'joined_at'],
  users.map((u) => [sql(u.id), sql(u.name), sql(u.email), sql(u.role), sql(u.status), sql(u.orders || 0), sql(u.spent || 0), sql(u.tryons || 0), sql(u.vip), sql(u.joinedAt)]));

// vouchers
insert('vouchers', ['code', 'type', 'value', 'min_order', 'expiry', 'usage_limit', 'used', 'active'],
  vouchers.map((v) => [sql(v.code), sql(v.type), sql(v.value), sql(v.min || 0), sql(v.expiry), sql(v.limit || 0), sql(v.used || 0), bool(v.active)]));

// banners
insert('banners', ['id', 'title', 'img', 'link', 'active', 'sort_order'],
  state.banners.map((b) => [sql(b.id), sql(b.title), sql(b.img), sql(b.link), bool(b.active), sql(b.order || 0)]));

// notifications
insert('notifications', ['id', 'title', 'body', 'type', 'action', 'reach', 'at'],
  state.notifications.map((n) => [sql(n.id), sql(n.title), sql(n.body), sql(n.type), sql(n.action), sql(n.reach || 0), sql(n.at)]));

// flagcards + children
insert('flagcards', ['id', 'sort_order', 'glyph', 'accent', 'title', 'japanese', 'region', 'summary', 'formation_history', 'legend', 'outfit_style', 'outfit_reason', 'source_url', 'active'],
  state.flagcards.map((f) => [sql(f.id), sql(f.order), sql(f.glyph), sql(f.accent), sql(f.title), sql(f.japanese), sql(f.region), sql(f.summary), sql(f.formationHistory), sql(f.legend), sql(f.outfit?.style), sql(f.outfit?.reason), sql(f.sourceUrl), bool(f.active)]));
const facts = [], checkins = [], frecs = [];
state.flagcards.forEach((f) => {
  (f.funFacts || []).forEach((fact) => facts.push([sql(f.id), sql(fact)]));
  (f.checkins || []).forEach((c) => checkins.push([sql(f.id), sql(c.name), sql(c.tip)]));
  (f.recommendedProductIds || []).forEach((pid) => frecs.push([sql(f.id), sql(toSlug(pid))]));
});
insert('flagcard_facts', ['flagcard_id', 'fact'], facts);
insert('flagcard_checkins', ['flagcard_id', 'name', 'tip'], checkins);
insert('flagcard_recommended_products', ['flagcard_id', 'product_slug'], frecs);

// products + children
insert('products', ['id', 'slug', 'name', 'kanji', 'sku', 'category_id', 'brand', 'price', 'old_price', 'sale', 'status', 'color_hex', 'rating', 'sold', 'description', 'story', 'image'],
  state.products.map((p) => [sql(p.id), sql(p.slug), sql(p.name), sql(p.kanji), sql(p.sku), sql(p.cat || p.category), sql(p.brand), sql(p.price), sql(p.old), sql(p.sale), sql(p.status), sql(p.colorHex), sql(p.rating || 0), sql(p.sold || 0), sql(p.desc), sql(p.story), sql(p.image)]));
const pimgs = [], pvars = [], ptags = [];
state.products.forEach((p) => {
  (p.images || []).forEach((url, i) => pimgs.push([sql(p.id), sql(url), i]));
  (p.variants || []).forEach((v) => pvars.push([sql(p.id), sql(v.colorName), sql(v.colorHex), sql(v.size), sql(v.sku), sql(v.stock || 0)]));
  (p.tags || []).forEach((t) => ptags.push([sql(p.id), sql(t), sql('tag')]));
  (p.visualTags || []).forEach((t) => ptags.push([sql(p.id), sql(t), sql('visual')]));
});
insert('product_images', ['product_id', 'url', 'position'], pimgs);
insert('product_variants', ['product_id', 'color_name', 'color_hex', 'size', 'sku', 'stock'], pvars);
insert('product_tags', ['product_id', 'tag', 'kind'], ptags);

// profiles + styles
insert('profiles', ['user_id', 'gender', 'skin_tone', 'occasion', 'budget', 'height_cm', 'weight_kg', 'usual_size', 'updated_at'],
  state.profiles.filter((p) => userRef(p.userId)).map((p) => [sql(p.userId), sql(p.gender), sql(p.skinTone), sql(p.occasion), sql(p.budget), sql(p.heightCm), sql(p.weightKg), sql(p.usualSize), sql(p.updatedAt)]));
const pstyles = [];
state.profiles.forEach((p) => { if (userRef(p.userId)) (p.preferredStyles || []).forEach((s) => pstyles.push([sql(p.userId), sql(s)])); });
insert('profile_styles', ['user_id', 'style'], pstyles);

// orders + items + history
insert('orders', ['id', 'code', 'user_id', 'customer_name', 'customer_email', 'customer_phone', 'address', 'ward_code', 'ward', 'province_code', 'province', 'subtotal', 'discount', 'voucher_discount', 'payment_discount', 'discount_code', 'total', 'ship', 'payment_method', 'payment_provider', 'payment_status', 'payment_txn', 'payment_currency', 'status', 'source', 'created_at'],
  state.orders.map((o) => {
    const a = o.addressDetails || {}; const pay = o.payment || {};
    return [sql(o.id), sql(o.code), sql(userRef(o.userId)), sql(o.customer?.name), sql(o.customer?.email), sql(o.customer?.phone), sql(o.address), sql(a.wardCode), sql(a.ward), sql(a.provinceCode), sql(a.province), sql(o.subtotal), sql(o.discount || 0), sql(o.voucherDiscount || 0), sql(o.paymentDiscount || 0), sql(voucherRef(o.discountCode)), sql(o.total), sql(o.ship || 0), sql(pay.method), sql(pay.provider), sql(pay.status), sql(pay.txn), sql(pay.currency), sql(o.status), sql(o.source), sql(o.createdAt)];
  }));
const oitems = [], ohist = [];
state.orders.forEach((o) => {
  (o.items || []).forEach((it) => oitems.push([sql(o.id), sql(toSlug(it.slug || it.productId)), sql(it.name), sql(it.colorName), sql(it.colorHex), sql(it.size), sql(it.qty || 1), sql(it.price)]));
  (o.history || []).forEach((h) => ohist.push([sql(o.id), sql(h.s), sql(h.at)]));
});
insert('order_items', ['order_id', 'product_slug', 'name', 'color_name', 'color_hex', 'size', 'qty', 'price'], oitems);
insert('order_history', ['order_id', 'status', 'at'], ohist);

// payments (refunds inserted after return_requests exist)
insert('payments', ['id', 'code', 'order_id', 'user_id', 'provider', 'method', 'status', 'amount', 'original_amount', 'discount', 'voucher_discount', 'payment_discount', 'promotion_code', 'currency', 'transaction_code', 'payment_intent_id', 'checkout_session_id', 'refundable', 'amount_subtotal', 'paid_at', 'charge_id', 'receipt_url', 'created_at', 'updated_at'],
  state.payments.map((p) => [sql(p.id), sql(p.code), sql(ref(p.orderId, orderIds)), sql(userRef(p.userId)), sql(p.provider), sql(p.method), sql(p.status), sql(p.amount), sql(p.originalAmount), sql(p.discount || 0), sql(p.voucherDiscount || 0), sql(p.paymentDiscount || 0), sql(voucherRef(p.promotionCode)), sql(p.currency), sql(p.transactionCode), sql(p.paymentIntentId), sql(p.checkoutSessionId), bool(p.refundable), sql(p.amountSubtotal), sql(p.paidAt), sql(p.chargeId), sql(p.receiptUrl), sql(p.createdAt), sql(p.updatedAt)]));

// return_requests + items + timeline
insert('return_requests', ['id', 'code', 'order_id', 'user_id', 'payment_id', 'status', 'reason', 'note', 'admin_note', 'amount', 'currency', 'refund_id', 'refund_status', 'created_at', 'updated_at'],
  state.returnRequests.map((r) => [sql(r.id), sql(r.code), sql(ref(r.orderId, orderIds)), sql(userRef(r.userId)), sql(ref(r.paymentId, paymentIds)), sql(r.status), sql(r.reason), sql(r.note), sql(r.adminNote), sql(r.amount), sql(r.currency), sql(r.refundId), sql(r.refundStatus), sql(r.createdAt), sql(r.updatedAt)]));
const ritems = [], rtimeline = [];
state.returnRequests.forEach((r) => {
  (r.items || []).forEach((it) => ritems.push([sql(r.id), sql(toSlug(it.slug || it.productId)), sql(it.name), sql(it.size), sql(it.colorName), sql(it.qty || 1), sql(it.price)]));
  (r.timeline || []).forEach((t) => rtimeline.push([sql(r.id), sql(t.s), sql(t.at), sql(t.refundId), sql(t.note)]));
});
insert('return_request_items', ['return_request_id', 'product_slug', 'name', 'size', 'color_name', 'qty', 'price'], ritems);
insert('return_request_timeline', ['return_request_id', 'status', 'at', 'refund_id', 'note'], rtimeline);

// payment_refunds (sau khi đã có return_requests)
const refunds = [];
state.payments.forEach((p) => (p.refunds || []).forEach((r) => refunds.push([sql(r.id), sql(p.id), sql(r.amount), sql(r.currency), sql(r.status), sql(r.reason), sql(r.failureReason), sql(ref(r.returnRequestId, returnIds)), sql(r.createdAt), sql(r.updatedAt)])));
insert('payment_refunds', ['id', 'payment_id', 'amount', 'currency', 'status', 'reason', 'failure_reason', 'return_request_id', 'created_at', 'updated_at'], refunds);

// carts + items
const carts = [], citems = [];
(state.carts || []).forEach((c) => {
  carts.push([sql(c.id || `cart-${c.userId}`), sql(userRef(c.userId)), sql(c.updatedAt)]);
  (c.items || []).forEach((it) => citems.push([sql(c.id || `cart-${c.userId}`), sql(toSlug(it.slug || it.productId)), sql(it.color), sql(it.size), sql(it.qty || 1)]));
});
insert('carts', ['id', 'user_id', 'updated_at'], carts);
insert('cart_items', ['cart_id', 'product_slug', 'color', 'size', 'qty'], citems);

// reviews + reactions + moderation samples
insert('reviews', ['id', 'product_slug', 'user_id', 'order_id', 'order_code', 'rating', 'comment', 'media_url', 'media_kind', 'status', 'created_at', 'updated_at'],
  (state.reviews || []).map((r) => [sql(r.id), sql(toSlug(r.productId)), sql(userRef(r.userId)), sql(ref(r.orderId, orderIds)), sql(r.orderCode), sql(r.rating), sql(r.comment), sql(r.media?.url), sql(r.media?.kind), sql(r.status), sql(r.createdAt), sql(r.updatedAt)]));
insert('review_reactions', ['id', 'review_id', 'user_id', 'value', 'updated_at'],
  (state.reviewReactions || []).filter((r) => reviewIds.has(r.reviewId)).map((r) => [sql(r.id), sql(r.reviewId), sql(userRef(r.userId)), sql(r.value), sql(r.updatedAt)]));
insert('moderation_samples', ['id', 'review_id', 'label', 'normalized_text', 'source', 'updated_at'],
  (state.moderationSamples || []).map((m) => [sql(m.id), sql(ref(m.reviewId, reviewIds)), sql(m.label), sql(m.normalizedText), sql(m.source), sql(m.updatedAt)]));

// voucher_redemptions
insert('voucher_redemptions', ['id', 'code', 'user_id', 'order_id', 'discount', 'redeemed_at'],
  state.voucherRedemptions.map((r) => [sql(r.id), sql(voucherRef(r.code)), sql(userRef(r.userId)), sql(ref(r.orderId, orderIds)), sql(r.discount), sql(r.redeemedAt)]));

// flagcard_collections + awards
insert('flagcard_collections', ['id', 'user_id', 'created_at', 'updated_at'],
  state.flagcardCollections.map((c) => [sql(c.id), sql(userRef(c.userId)), sql(c.createdAt), sql(c.updatedAt)]));
const awards = [];
state.flagcardCollections.forEach((c) => (c.awards || []).forEach((a) => awards.push([sql(c.id), sql(ref(a.cardId, flagcardIds)), sql(ref(a.orderId, orderIds)), sql(a.orderCode), sql(a.orderTotal), sql(a.awardedAt), sql(a.source)])));
insert('flagcard_collection_awards', ['collection_id', 'flagcard_id', 'order_id', 'order_code', 'order_total', 'awarded_at', 'source'], awards);

// interactions
insert('interactions', ['id', 'user_id', 'product_slug', 'type', 'value', 'created_at', 'source'],
  state.interactions.filter((i) => userRef(i.userId)).map((i) => [sql(i.id), sql(userRef(i.userId)), sql(toSlug(i.productId)), sql(i.type), sql(i.value || 1), sql(i.createdAt), sql(i.source)]));

// chats + product refs
insert('chats', ['id', 'user_id', 'role', 'message', 'created_at'],
  state.chats.filter((c) => userRef(c.userId)).map((c) => [sql(c.id), sql(userRef(c.userId)), sql(c.role), sql(c.message), sql(c.createdAt)]));
const crefs = [];
const chatIds = new Set(state.chats.filter((c) => userRef(c.userId)).map((c) => c.id));
state.chats.forEach((c) => { if (chatIds.has(c.id)) (c.productIds || []).forEach((pid) => crefs.push([sql(c.id), sql(toSlug(pid))])); });
insert('chat_product_refs', ['chat_id', 'product_slug'], crefs);

// tryon_history + accessories
insert('tryon_history', ['id', 'user_id', 'product_slug', 'engine', 'created_at'],
  state.tryonHistory.filter((t) => userRef(t.userId)).map((t) => [sql(t.id), sql(userRef(t.userId)), sql(toSlug(t.productId)), sql(t.engine), sql(t.createdAt)]));
const taccs = [];
const tryonIds = new Set(state.tryonHistory.filter((t) => userRef(t.userId)).map((t) => t.id));
state.tryonHistory.forEach((t) => { if (tryonIds.has(t.id)) (t.accessoryIds || []).forEach((pid) => taccs.push([sql(t.id), sql(toSlug(pid))])); });
insert('tryon_accessories', ['tryon_id', 'product_slug'], taccs);

// goals
insert('goals', ['id', 'user_id', 'product_slug', 'age', 'height_cm', 'current_weight_kg', 'target_weight_kg', 'monthly_income', 'fixed_expenses', 'current_savings', 'target_months', 'plan', 'created_at', 'updated_at'],
  state.goals.filter((g) => userRef(g.userId)).map((g) => { const inp = g.input || {}; return [sql(g.id), sql(userRef(g.userId)), sql(toSlug(g.productId)), sql(inp.age), sql(inp.heightCm), sql(inp.currentWeightKg), sql(inp.targetWeightKg), sql(inp.monthlyIncome), sql(inp.fixedExpenses), sql(inp.currentSavings), sql(inp.targetMonths), jsonCol(g.plan), sql(g.createdAt), sql(g.updatedAt)]; }));

// ai_descriptions + details
const aiRows = [], aiDetailPlan = [];
state.aiDescriptions.forEach((d, idx) => {
  const desc = d.description || {};
  aiRows.push([sql(toSlug(d.productId)), sql(d.generatedAt), sql(desc.headline), sql(desc.visualSummary), sql(desc.stylingTip), sql(desc.purchaseReason), sql(desc.confidence), sql(desc.engine)]);
  aiDetailPlan.push({ slug: toSlug(d.productId), details: desc.details || [], seq: idx + 1 });
});
insert('ai_descriptions', ['product_slug', 'generated_at', 'headline', 'visual_summary', 'styling_tip', 'purchase_reason', 'confidence', 'engine'], aiRows);
// details tham chiếu ai_description qua product_slug (đã UNIQUE) để không phụ thuộc AUTO_INCREMENT
const aiDetailRows = [];
aiDetailPlan.forEach((p) => p.details.forEach((det) => aiDetailRows.push({ slug: p.slug, det })));
if (aiDetailRows.length) {
  w('-- ai_description_details: nối qua product_slug (UNIQUE) để lấy đúng id cha');
  aiDetailRows.forEach((r) => {
    w(`INSERT INTO \`ai_description_details\` (\`ai_description_id\`, \`detail\`) SELECT \`id\`, ${sql(r.det)} FROM \`ai_descriptions\` WHERE \`product_slug\` = ${sql(r.slug)};`);
  });
  w();
}

// japan spots
insert('japan_spot_reviews', ['id', 'place', 'prefecture', 'user_id', 'user_name', 'rating', 'comment', 'media_url', 'media_kind', 'created_at'],
  (state.japanSpotReviews || []).map((r) => [sql(r.id), sql(r.place), sql(r.prefecture), sql(userRef(r.userId)), sql(r.userName), sql(r.rating), sql(r.comment), sql(r.media?.url), sql(r.media?.kind), sql(r.createdAt)]));
insert('japan_spot_suggestions', ['id', 'prefecture', 'user_id', 'user_name', 'suggestion', 'created_at'],
  (state.japanSpotSuggestions || []).map((s) => [sql(s.id), sql(s.prefecture), sql(userRef(s.userId)), sql(s.userName), sql(s.suggestion), sql(s.createdAt)]));

w('SET FOREIGN_KEY_CHECKS = 1;');
w('-- Hết. Tổng cộng ' + out.filter((l) => l.startsWith('CREATE TABLE')).length + ' bảng.');

const mysqlText = out.join('\n');
fs.writeFileSync(OUT_FILE, mysqlText);

// ---- Bản SQLite (chạy được trên sqliteonline.com ở chế độ SQLite) -----------
// SQLite không có DROP/CREATE DATABASE, USE, SET; AUTO_INCREMENT viết khác;
// không có ENGINE=InnoDB; kiểu JSON quy về TEXT. FK vẫn giữ nguyên định nghĩa
// (là "dây nối" của ERD), chỉ tắt kiểm tra khi nạp để không kẹt thứ tự.
const SQLITE_OUT = path.join(__dirname, '..', '..', 'japano_erd_sqlite.sql');
const sqliteText = mysqlText
  .replace('-- JAPANO — Sơ đồ quan hệ thực thể (ERD) cho MySQL / MariaDB',
           '-- JAPANO — Sơ đồ quan hệ thực thể (ERD) cho SQLite (sqliteonline.com)')
  .replace(/DROP DATABASE IF EXISTS `japano`;\n/, '')
  .replace(/CREATE DATABASE `japano`[^\n]*\n/, '')
  .replace(/USE `japano`;\n/, '')
  .replace(/SET FOREIGN_KEY_CHECKS = 0;/, 'PRAGMA foreign_keys = OFF;')
  .replace(/SET NAMES utf8mb4;\n/, '')
  .replace(/\) ENGINE=InnoDB;/g, ');')
  .replace(/ INT AUTO_INCREMENT PRIMARY KEY/g, ' INTEGER PRIMARY KEY AUTOINCREMENT')
  .replace(/`plan` JSON/g, '`plan` TEXT')
  .replace(/SET FOREIGN_KEY_CHECKS = 1;/, 'PRAGMA foreign_keys = ON;');
fs.writeFileSync(SQLITE_OUT, sqliteText);

// ---- Bản DBML cho dbdiagram.io (chỉ schema + quan hệ, để VẼ sơ đồ ERD) ------
// dbdiagram.io không đọc SQL trong ô soạn thảo — nó dùng ngôn ngữ DBML. File
// này parse lại phần CREATE TABLE ở trên thành DBML: mỗi "Ref" là một dây nối
// FK -> PK mà dbdiagram sẽ vẽ thành đường kẻ giữa các bảng.
const DBML_OUT = path.join(__dirname, '..', '..', 'japano_erd.dbml');
function toDbml(ddl) {
  const lines = [
    '// JAPANO - So do quan he thuc the (ERD) cho dbdiagram.io',
    '// Dan TOAN BO noi dung file nay vao o soan thao ben TRAI cua dbdiagram.io.',
    '// Moi dong "Ref:" la mot day noi tu khoa ngoai (FK) den khoa chinh (PK).',
    '',
  ];
  const refs = [];
  const blockRe = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\n\) ENGINE=InnoDB;/g;
  let m;
  while ((m = blockRe.exec(ddl))) {
    const table = m[1];
    lines.push(`Table ${table} {`);
    m[2].split('\n').forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;
      line.split(/,\s*(?=`)/).forEach((fragRaw) => {
        const frag = fragRaw.trim().replace(/,+$/, '').trim();
        if (!frag) return;
        if (/^CONSTRAINT|^FOREIGN KEY/.test(frag)) {
          const cm = frag.match(/FOREIGN KEY \(`(\w+)`\) REFERENCES `(\w+)`\(`(\w+)`\)/);
          if (cm) refs.push(`Ref: ${table}.${cm[1]} > ${cm[2]}.${cm[3]}`);
          return;
        }
        const nameM = frag.match(/^`(\w+)`\s+(.*)$/);
        if (!nameM) return;
        const rest = nameM[2];
        const typeM = rest.match(/^([A-Za-z]+(?:\(\d+(?:,\d+)?\))?)/);
        const type = (typeM ? typeM[1] : 'text').toLowerCase();
        const settings = [];
        if (/PRIMARY KEY/.test(rest)) settings.push('pk');
        if (/\bUNIQUE\b/.test(rest)) settings.push('unique');
        if (/NOT NULL/.test(rest)) settings.push('not null');
        lines.push(`  ${nameM[1]} ${type}${settings.length ? ` [${settings.join(', ')}]` : ''}`);
      });
    });
    lines.push('}', '');
  }
  lines.push('// ---- Quan he (FK -> PK) ----', ...refs, '');
  return { text: lines.join('\n'), refCount: refs.length };
}
const dbml = toDbml(DDL);
fs.writeFileSync(DBML_OUT, dbml.text);

const tableCount = (DDL.match(/CREATE TABLE/g) || []).length;
console.log('Đã ghi', OUT_FILE, '(MySQL/MariaDB)');
console.log('Đã ghi', SQLITE_OUT, '(SQLite)');
console.log('Đã ghi', DBML_OUT, '(DBML cho dbdiagram.io) — quan hệ:', dbml.refCount);
console.log('Số bảng:', tableCount);
console.log('Số dòng SQL:', out.length);
console.log('Stub users thêm:', users.filter((u) => u._stub).length, '| Stub vouchers thêm:', vouchers.filter((v) => v._stub).length);
