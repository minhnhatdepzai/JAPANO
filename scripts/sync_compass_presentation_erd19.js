#!/usr/bin/env node
'use strict';

/**
 * Tạo bản MongoDB local chỉ dùng để trình bày ERD 19 bảng trong Compass.
 *
 * Nguồn đọc: MongoDB Atlas từ .env.server (không ghi Atlas).
 * Đích ghi : mongodb://127.0.0.1:27017/japano_presentation_19.
 * Backend JAPANO vẫn dùng Atlas; database local này không phải runtime store.
 */
const crypto = require('crypto');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.server') });

const APPLY = process.argv.includes('--apply');
const SOURCE_DB = process.env.MONGODB_DB || 'japano';
const TARGET_URI = process.env.COMPASS_MONGODB_URI || 'mongodb://127.0.0.1:27017';
const TARGET_DB = 'japano_presentation_19';

const ERD_COLLECTIONS = [
  'notifications',
  'chats',
  'addresses',
  'profiles',
  'users',
  'interactions',
  'categories',
  'products',
  'product_variants',
  'product_media',
  'cart_items',
  'wishlist_items',
  'reviews',
  'orders',
  'order_items',
  'payments',
  'vouchers',
  'return_requests',
  'japan_spots',
];

function assertSafeTarget() {
  const parsed = new URL(TARGET_URI);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Từ chối ghi: COMPASS_MONGODB_URI phải trỏ tới localhost.');
  }
  if (TARGET_DB !== 'japano_presentation_19') {
    throw new Error('Từ chối ghi: sai tên database trình bày.');
  }
}

function alias(value, prefix) {
  const digest = crypto.createHash('sha256').update(String(value || prefix)).digest('hex').slice(0, 8);
  return `${prefix}-${digest}`;
}

function redactNestedReferences(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(redactNestedReferences);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (/(password|token|secret|session|paymentIntent|transaction(Code|No)|providerRef|refundId|tracking(Code|No|Number|Id)?)/i.test(key)) {
      value[key] = '[ĐÃ ẨN]';
    } else {
      redactNestedReferences(nested);
    }
  }
}

function sanitizeAddressRecord(value) {
  if (!value || typeof value !== 'object') return;
  const replacements = {
    name: 'Người nhận trình bày',
    receiver: 'Người nhận trình bày',
    phone: '09********',
    email: 'demo@example.invalid',
    street: 'Địa chỉ đã ẩn khi trình bày',
    address: 'Địa chỉ đã ẩn khi trình bày',
    detail: 'Địa chỉ đã ẩn khi trình bày',
    addressDetails: 'Địa chỉ đã ẩn khi trình bày',
    ward: 'Phường trình bày',
    district: 'Quận trình bày',
    province: 'TP. Hồ Chí Minh',
    postalCode: '000000',
  };
  for (const [key, replacement] of Object.entries(replacements)) {
    if (key in value) value[key] = replacement;
  }
  redactNestedReferences(value);
}

function sanitize(collection, source) {
  // Các document vừa được driver tạo riêng trong toArray(); chỉnh trực tiếp để
  // giữ nguyên kiểu BSON (đặc biệt ObjectId/Date) khi ghi sang MongoDB local.
  const doc = source;

  if (collection === 'users') {
    doc.name = 'Người dùng trình bày';
    doc.email = `${alias(doc.email || doc.id, 'demo')}@example.invalid`;
    if ('phone' in doc) doc.phone = '09********';
    if ('passwordHash' in doc) doc.passwordHash = 'PRESENTATION_ONLY_NO_LOGIN';
    if ('authProviders' in doc) doc.authProviders = Array.isArray(doc.authProviders) ? [] : {};
    redactNestedReferences(doc);
  }
  if (collection === 'addresses') {
    sanitizeAddressRecord(doc);
  }
  if (collection === 'profiles') {
    for (const key of ['height', 'weight', 'chest', 'waist', 'hip',
      'heightCm', 'weightKg', 'chestCm', 'waistCm', 'hipCm']) {
      if (key in doc) doc[key] = null;
    }
  }
  if (collection === 'chats' && 'message' in doc) {
    doc.message = '[Nội dung hội thoại đã ẩn khi trình bày]';
  }
  if (collection === 'orders') {
    if (doc.customer && typeof doc.customer === 'object') {
      doc.customer.name = 'Khách hàng trình bày';
      if ('email' in doc.customer) doc.customer.email = 'demo@example.invalid';
      if ('phone' in doc.customer) doc.customer.phone = '09********';
      sanitizeAddressRecord(doc.customer);
    }
    if (doc.address && typeof doc.address === 'object') sanitizeAddressRecord(doc.address);
    if ('addressDetails' in doc) doc.addressDetails = 'Địa chỉ đã ẩn khi trình bày';
    redactNestedReferences(doc);
  }
  if (collection === 'payments' || collection === 'return_requests') redactNestedReferences(doc);
  return doc;
}

async function main() {
  assertSafeTarget();
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI nguồn Atlas trong .env.server.');

  const sourceClient = new MongoClient(process.env.MONGODB_URI, { readPreference: 'secondaryPreferred' });
  const targetClient = new MongoClient(TARGET_URI);
  await Promise.all([sourceClient.connect(), targetClient.connect()]);

  try {
    const source = sourceClient.db(SOURCE_DB);
    const target = targetClient.db(TARGET_DB);
    const current = (await target.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name);

    if (!APPLY) {
      console.log(`DRY-RUN: sẽ đồng bộ ${ERD_COLLECTIONS.length} bảng vào ${TARGET_DB}.`);
      console.log(`Hiện tại database trình bày có ${current.length} bảng.`);
      return;
    }
    if (current.length > 0) {
      throw new Error(`Từ chối ghi đè: ${TARGET_DB} đã có ${current.length} bảng. Hãy sao lưu/xoá thủ công trước.`);
    }

    for (const name of ERD_COLLECTIONS) {
      await target.createCollection(name);
      const documents = await source.collection(name).find({}).toArray();
      if (documents.length) {
        await target.collection(name).insertMany(documents.map((doc) => sanitize(name, doc)), { ordered: true });
      }

      const indexes = await source.collection(name).listIndexes().toArray();
      for (const index of indexes) {
        if (index.name === '_id_') continue;
        const options = { name: index.name };
        for (const key of ['unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression']) {
          if (index[key] !== undefined) options[key] = index[key];
        }
        try {
          await target.collection(name).createIndex(index.key, options);
        } catch (error) {
          console.warn(`Bỏ qua index ${name}.${index.name}: ${error.codeName || error.message}`);
        }
      }
      console.log(`${name}: ${documents.length} document`);
    }

    const finalNames = (await target.listCollections({}, { nameOnly: true }).toArray())
      .map((item) => item.name)
      .sort();
    const expected = [...ERD_COLLECTIONS].sort();
    if (JSON.stringify(finalNames) !== JSON.stringify(expected)) {
      throw new Error(`Danh sách bảng local không khớp ERD: ${finalNames.join(', ')}`);
    }
    console.log(`ĐẠT: ${TARGET_DB} có đúng ${finalNames.length} bảng trình bày.`);
  } finally {
    await Promise.allSettled([sourceClient.close(), targetClient.close()]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
