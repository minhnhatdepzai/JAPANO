import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import axios from 'axios';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config({ path: '.env.server' });
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 120 * 1024 * 1024 } });
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://luutruminhnhatne_db_user:minhnhat2002@cluster0.mdxuy2q.mongodb.net/japano?retryWrites=true&w=majority';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash';
const FOTOR_API_KEY = process.env.FOTOR_API_KEY || '';
const FOTOR_PROVIDER = process.env.FOTOR_PROVIDER || 'gemini-3-pro-image-preview';
const DEMO_MODE = String(process.env.DEMO_MODE || '1') !== '0';
const FOTOR_TRYON_WIDTH = Number(process.env.FOTOR_TRYON_WIDTH || 896);
const FOTOR_TRYON_HEIGHT = Number(process.env.FOTOR_TRYON_HEIGHT || 1152);
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const CLOUDINARY_ROOT_FOLDER = process.env.CLOUDINARY_ROOT_FOLDER || 'japano';
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const FREE_TRY_ON_LIMIT = Number(process.env.FREE_TRY_ON_LIMIT || 2);
const VIP_PRICE = Number(process.env.VIP_PRICE || 500000);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_CURRENCY = String(process.env.STRIPE_CURRENCY || 'vnd').toLowerCase();
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || '2024-06-20';
const STRIPE_MERCHANT_DISPLAY_NAME = process.env.STRIPE_MERCHANT_DISPLAY_NAME || 'JAPANO Fashion AI';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION }) : null;
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 9000);
const GEMINI_COOLDOWN_MS = Number(process.env.GEMINI_COOLDOWN_MS || 120000);
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 10000);
const OLLAMA_COOLDOWN_MS = Number(process.env.OLLAMA_COOLDOWN_MS || 90000);
let geminiDisabledUntil = 0;
let ollamaDisabledUntil = 0;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
} else if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
}

app.use(cors());
app.use(express.json({ limit: '20mb' }));

mongoose.connect(MONGODB_URI).then(() => console.log('[JAPANO] MongoDB connected')).catch((err) => console.error('[JAPANO] MongoDB error:', err.message));

const { Schema } = mongoose;
const objectId = Schema.Types.ObjectId;
const strictSchemaOptions = { timestamps: true, strict: true, versionKey: false };

const productSnapshotSchema = new Schema({
  id: String,
  name: String,
  productName: String,
  category: String,
  subcategory: String,
  price: Number,
  image: String,
  story: String,
  description: String,
  badge: String,
  visualTags: [String],
  styleUseCase: String,
}, { _id: false, strict: true });

const statusTimelineSchema = new Schema({
  status: String,
  label: String,
  at: Date,
  note: String,
}, { _id: false, strict: true });

// Database đã được chuẩn hoá lại theo ERD người dùng gửi: sản phẩm -> biến thể -> màu/size/ảnh,
// giỏ hàng/yêu thích/đơn hàng lưu theo variant thay vì nhét mảng object lung tung.
const categorySchema = new Schema({
  categoryName: { type: String, required: true, trim: true, index: true },
  description: String,
  slug: { type: String, trim: true, index: true },
}, strictSchemaOptions);

const productSchema = new Schema({
  // id giữ để app hiện tại dùng được; _id là ProductID thật trong MongoDB.
  id: { type: String, required: true, unique: true, index: true },
  productName: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'inactive', 'draft', 'archived'], default: 'active', index: true },
  description: String,
  story: String,
  badge: String,
  categoryId: { type: objectId, ref: 'Category', index: true },
  category: { type: String, index: true },
  subcategory: { type: String, index: true },
  price: { type: Number, default: 0, min: 0 },
  image: String,
  visualTags: [String],
  styleUseCase: String,
}, strictSchemaOptions);

const colorSchema = new Schema({
  colorName: { type: String, required: true, trim: true, unique: true },
  colorCode: { type: String, default: '#000000' },
}, strictSchemaOptions);

const sizeSchema = new Schema({
  sizeName: { type: String, required: true, trim: true, unique: true },
}, strictSchemaOptions);

const productVariantSchema = new Schema({
  productId: { type: String, required: true, index: true },
  productRef: { type: objectId, ref: 'Product', index: true },
  colorId: { type: objectId, ref: 'Color', index: true },
  sizeId: { type: objectId, ref: 'Size', index: true },
  price: { type: Number, default: 0, min: 0 },
  stockQuantity: { type: Number, default: 0, min: 0 },
  sku: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['active', 'inactive', 'out_of_stock'], default: 'active', index: true },
}, strictSchemaOptions);

const productImageSchema = new Schema({
  url: { type: String, required: true },
  productVariantId: { type: objectId, ref: 'ProductVariant', index: true },
  productId: { type: String, index: true },
  alt: String,
  sortOrder: { type: Number, default: 0 },
}, strictSchemaOptions);

const serviceSchema = new Schema({
  name: String,
  description: String,
  price: Number,
  active: { type: Boolean, default: true },
}, strictSchemaOptions);

const userSchema = new Schema({
  fullName: { type: String, trim: true },
  name: { type: String, trim: true },
  email: { type: String, unique: true, required: true, index: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: String,
  address: String,
  role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
  status: { type: String, enum: ['active', 'blocked', 'deleted'], default: 'active', index: true },
  avatar: String,
  coins: { type: Number, default: 0 },
  birthday: String,
  specialDates: [{ name: String, date: String, productIds: [String] }],
  settings: { type: Object, default: () => ({}) },
  membership: { type: Object, default: () => ({ tier: 'free' }) },
  tryOnUsed: { type: Number, default: 0 },
  vip: { type: Boolean, default: false },
  vipUntil: String,
  stripeCustomerId: String,
}, strictSchemaOptions);

const cartSchema = new Schema({
  userId: { type: String, required: true, index: true },
  variantId: { type: objectId, ref: 'ProductVariant', index: true },
  productId: { type: String, required: true, index: true },
  quantity: { type: Number, default: 1, min: 1 },
  unitPrice: { type: Number, default: 0, min: 0 },
  productSnapshot: productSnapshotSchema,
}, strictSchemaOptions);
cartSchema.index({ userId: 1, productId: 1, variantId: 1 }, { unique: true, sparse: true });

const wishlistSchema = new Schema({
  userId: { type: String, required: true, index: true },
  variantId: { type: objectId, ref: 'ProductVariant', index: true },
  productId: { type: String, required: true, index: true },
  productSnapshot: productSnapshotSchema,
}, strictSchemaOptions);
wishlistSchema.index({ userId: 1, productId: 1, variantId: 1 }, { unique: true, sparse: true });

const notificationSchema = new Schema({
  title: { type: String, required: true },
  content: String,
  isRead: { type: Boolean, default: false, index: true },
  userId: { type: String, required: true, index: true },
}, strictSchemaOptions);

const forgotPasswordSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  token: { type: String, required: true, index: true },
  isUsed: { type: Boolean, default: false, index: true },
}, strictSchemaOptions);

const discountCodeSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  discountValue: { type: Number, default: 0, min: 0 },
  expiryDate: Date,
  active: { type: Boolean, default: true },
}, strictSchemaOptions);

const paymentSchema = new Schema({
  paymentMethod: { type: String, required: true },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending', index: true },
  transactionId: { type: String, index: true },
  amount: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'VND' },
  userId: { type: String, index: true },
}, strictSchemaOptions);

const orderSchema = new Schema({
  userId: { type: String, required: true, index: true },
  orderDate: { type: Date, default: Date.now, index: true },
  totalAmount: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0, min: 0 }, // alias trả về app cũ.
  shippingAddress: String,
  orderStatus: { type: String, default: 'pending_payment', index: true },
  status: { type: String, default: 'pending_payment', index: true }, // alias trả về app cũ.
  phoneNumber: String,
  discountCodeId: { type: objectId, ref: 'DiscountCode', index: true },
  paymentStatus: { type: String, default: 'pending', index: true },
  transactionId: String,
  paymentId: { type: objectId, ref: 'Payment', index: true },
  paymentMethod: String,
  stripePaymentIntentId: { type: String, index: true },
  type: { type: String, default: 'product-order', index: true },
  idempotencyKey: { type: String },
  statusTimeline: [statusTimelineSchema],
  checkoutMeta: { type: Object, default: () => ({}) },
}, strictSchemaOptions);
orderSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const orderItemSchema = new Schema({
  orderId: { type: objectId, ref: 'Order', required: true, index: true },
  variantId: { type: objectId, ref: 'ProductVariant', index: true },
  productId: { type: String, required: true, index: true },
  quantity: { type: Number, default: 1, min: 1 },
  unitPrice: { type: Number, default: 0, min: 0 },
  productSnapshot: productSnapshotSchema,
}, strictSchemaOptions);

const reviewSchema = new Schema({
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  reviewDate: { type: Date, default: Date.now },
  orderItemId: { type: objectId, ref: 'OrderItem', index: true },
  userId: { type: String, required: true, index: true },
}, strictSchemaOptions);

const aiChatSchema = new Schema({
  content: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  isChatSaved: { type: Boolean, default: true, index: true },
}, strictSchemaOptions);

const fileSchema = new Schema({
  userId: { type: String, index: true },
  filename: String,
  mimeType: String,
  size: Number,
  url: String,
  secureUrl: String,
  publicId: String,
  resourceType: String,
  format: String,
  bytes: Number,
  source: String,
  provider: String,
  cloudinary: Object,
  data: Buffer, // legacy fallback only: new uploads are stored in Cloudinary, not MongoDB
}, strictSchemaOptions);
const generatedImageSchema = new Schema({ userId: { type: String, index: true }, url: String, prompt: String, provider: String }, strictSchemaOptions);
const searchSchema = new Schema({ userId: { type: String, index: true }, term: String }, strictSchemaOptions);
const gameSchema = new Schema({ slug: String, name: String, description: String, rewardCoins: Number }, strictSchemaOptions);
const gameHistorySchema = new Schema({ userId: { type: String, index: true }, game: String, score: Number, coins: Number, result: String }, strictSchemaOptions);

const Category = mongoose.model('Category', categorySchema);
const Product = mongoose.model('Product', productSchema);
const Color = mongoose.model('Color', colorSchema);
const Size = mongoose.model('Size', sizeSchema);
const ProductVariant = mongoose.model('ProductVariant', productVariantSchema);
const ProductImage = mongoose.model('ProductImage', productImageSchema);
const Service = mongoose.model('Service', serviceSchema);
const User = mongoose.model('User', userSchema);
const Cart = mongoose.model('Cart', cartSchema);
const Wishlist = mongoose.model('Wishlist', wishlistSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const ForgotPassword = mongoose.model('ForgotPassword', forgotPasswordSchema);
const DiscountCode = mongoose.model('DiscountCode', discountCodeSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Order = mongoose.model('Order', orderSchema);
const OrderItem = mongoose.model('OrderItem', orderItemSchema);
const Review = mongoose.model('Review', reviewSchema);
const AIChat = mongoose.model('AIChat', aiChatSchema);
const FileAsset = mongoose.model('FileAsset', fileSchema);
const GeneratedImage = mongoose.model('GeneratedImage', generatedImageSchema);
const SearchHistory = mongoose.model('SearchHistory', searchSchema);
const Game = mongoose.model('Game', gameSchema);
const GameHistory = mongoose.model('GameHistory', gameHistorySchema);
const visionAnalysisSchema = new Schema({
  userId: { type: String, index: true },
  productId: { type: String, index: true },
  assetId: String,
  analysis: Object,
  recommendation: Object,
  source: { type: String, default: 'emotion-age-file-model' },
}, strictSchemaOptions);
const VisionAnalysis = mongoose.model('VisionAnalysis', visionAnalysisSchema);

const stylistProfileSchema = new Schema({
  userId: { type: String, unique: true, index: true },
  gender: String,
  preferredStyles: [String],
  heightCm: Number,
  weightKg: Number,
  skinTone: String,
  occasion: String,
  budget: Number,
  colorLikes: [String],
  colorAvoids: [String],
  lastQuizDate: String,
  source: String,
}, strictSchemaOptions);

const bodyProfileSchema = new Schema({
  userId: { type: String, unique: true, index: true },
  heightCm: Number,
  weightKg: Number,
  shoulderCm: Number,
  chestCm: Number,
  waistCm: Number,
  hipCm: Number,
  usualSize: String,
  fitPreference: String,
}, strictSchemaOptions);

const outfitCollectionSchema = new Schema({
  userId: { type: String, index: true },
  title: String,
  description: String,
  occasion: String,
  items: [productSnapshotSchema],
  cover: String,
}, strictSchemaOptions);

const dailyStylistQuizSchema = new Schema({
  userId: { type: String, index: true },
  dateKey: { type: String, index: true },
  answers: Object,
  profilePatch: Object,
}, strictSchemaOptions);

const StylistProfile = mongoose.model('StylistProfile', stylistProfileSchema);
const BodyProfile = mongoose.model('BodyProfile', bodyProfileSchema);
const OutfitCollection = mongoose.model('OutfitCollection', outfitCollectionSchema);
const DailyStylistQuiz = mongoose.model('DailyStylistQuiz', dailyStylistQuizSchema);

function legacyHashPassword(password = '') {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function hashPassword(password = '') {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password = '', storedHash = '') {
  const stored = String(storedHash || '');
  if (stored.startsWith('scrypt$')) {
    const [, salt, expectedHex] = stored.split('$');
    if (!salt || !expectedHex) return false;
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  }

  const legacy = legacyHashPassword(password);
  const a = Buffer.from(legacy);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isLegacyPasswordHash(storedHash = '') {
  return Boolean(storedHash) && !String(storedHash).startsWith('scrypt$');
}

function sanitizeCustomerPatch(patch = {}) {
  const blocked = new Set(['password', 'passwordHash', 'token', 'resetToken', 'stripeCustomerId', '_id', 'id', 'email']);
  return Object.fromEntries(Object.entries(patch).filter(([key]) => !blocked.has(key)));
}
function isVipUser(user) {
  if (!user) return false;
  if (user.vip === true) return true;
  if (user.membership?.tier === 'vip') return true;
  if (user.vipUntil && new Date(user.vipUntil).getTime() > Date.now()) return true;
  return false;
}
function publicUser(user) {
  const tryOnUsed = Number(user.tryOnUsed || 0);
  const vipActive = isVipUser(user);
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    address: user.address || '',
    avatar: user.avatar || '',
    coins: user.coins || 0,
    birthday: user.birthday || '',
    specialDates: user.specialDates || [],
    settings: user.settings || {},
    membership: user.membership || { tier: vipActive ? 'vip' : 'free' },
    vip: vipActive,
    vipUntil: user.vipUntil || '',
    tryOnUsed,
    tryOnLimit: FREE_TRY_ON_LIMIT,
    tryOnRemaining: vipActive ? null : Math.max(0, FREE_TRY_ON_LIMIT - tryOnUsed),
    stripeCustomerId: user.stripeCustomerId || '',
  };
}


function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general';
}

function productSnapshot(item = {}) {
  const id = String(item.id || item.productId || item.ProductID || item._id || '').trim();
  const name = String(item.name || item.productName || item.ProductName || item.title || 'Sản phẩm JAPANO').trim();
  const price = Number(item.price ?? item.unitPrice ?? item.Price ?? 0) || 0;
  return {
    id,
    name,
    productName: String(item.productName || name),
    category: String(item.category || item.categoryName || item.CategoryName || 'general'),
    subcategory: String(item.subcategory || item.subCategory || ''),
    price,
    image: String(item.image || item.url || item.imageUrl || ''),
    story: String(item.story || ''),
    description: String(item.description || ''),
    badge: String(item.badge || ''),
    visualTags: Array.isArray(item.visualTags) ? item.visualTags.map(String) : [],
    styleUseCase: String(item.styleUseCase || ''),
  };
}

async function ensureCategoryForProduct(snapshot) {
  const categoryName = snapshot.category || 'general';
  return Category.findOneAndUpdate(
    { slug: slugify(categoryName) },
    { $setOnInsert: { categoryName, description: `${categoryName} trong JAPANO`, slug: slugify(categoryName) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function ensureDefaultColorAndSize() {
  const [color, size] = await Promise.all([
    Color.findOneAndUpdate({ colorName: 'Mặc định' }, { $setOnInsert: { colorName: 'Mặc định', colorCode: '#000000' } }, { upsert: true, new: true }),
    Size.findOneAndUpdate({ sizeName: 'Freesize' }, { $setOnInsert: { sizeName: 'Freesize' } }, { upsert: true, new: true }),
  ]);
  return { color, size };
}

async function ensureProductVariantFromItem(item = {}) {
  const snapshot = productSnapshot(item);
  if (!snapshot.id) snapshot.id = `jp-${crypto.createHash('md5').update(`${snapshot.name}-${snapshot.price}`).digest('hex').slice(0, 10)}`;
  const category = await ensureCategoryForProduct(snapshot);
  const product = await Product.findOneAndUpdate(
    { id: snapshot.id },
    {
      id: snapshot.id,
      productName: snapshot.productName || snapshot.name,
      name: snapshot.name,
      status: 'active',
      description: snapshot.description,
      story: snapshot.story,
      badge: snapshot.badge,
      categoryId: category?._id,
      category: snapshot.category,
      subcategory: snapshot.subcategory,
      price: snapshot.price,
      image: snapshot.image,
      visualTags: snapshot.visualTags,
      styleUseCase: snapshot.styleUseCase,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const { color, size } = await ensureDefaultColorAndSize();
  const sku = String(item.sku || item.SKU || `${snapshot.id}-DEFAULT`).toUpperCase();
  const variant = await ProductVariant.findOneAndUpdate(
    { sku },
    {
      productId: snapshot.id,
      productRef: product._id,
      colorId: color?._id,
      sizeId: size?._id,
      price: snapshot.price,
      stockQuantity: Number(item.stockQuantity ?? item.quantityInStock ?? 999),
      sku,
      status: 'active',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (snapshot.image) {
    await ProductImage.findOneAndUpdate(
      { url: snapshot.image, productVariantId: variant._id },
      { url: snapshot.image, productVariantId: variant._id, productId: snapshot.id, alt: snapshot.name, sortOrder: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch(() => null);
  }
  return { product, variant, snapshot };
}

function expandQuantity(line = {}) {
  const quantity = Math.max(1, Number(line.quantity || 1));
  const snapshot = line.productSnapshot || { id: line.productId, name: 'Sản phẩm JAPANO', price: line.unitPrice || 0 };
  const item = { ...snapshot, id: snapshot.id || line.productId, price: Number(snapshot.price ?? line.unitPrice ?? 0) };
  return Array.from({ length: quantity }, () => item);
}

async function cartResponse(userId) {
  const lines = await Cart.find({ userId }).sort({ updatedAt: -1, createdAt: -1 }).lean();
  return { userId, items: lines.flatMap(expandQuantity), rows: lines };
}

async function wishlistResponse(userId) {
  const rows = await Wishlist.find({ userId }).sort({ updatedAt: -1, createdAt: -1 }).lean();
  return { userId, items: rows.map((row) => ({ ...(row.productSnapshot || {}), id: row.productId || row.productSnapshot?.id })), rows };
}

async function replaceCartFromClient(userId, items = []) {
  const grouped = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const { variant, snapshot } = await ensureProductVariantFromItem(item);
    const key = `${snapshot.id}:${String(variant?._id || '')}`;
    const current = grouped.get(key) || { quantity: 0, variant, snapshot };
    current.quantity += Math.max(1, Number(item.qty || item.quantity || 1));
    grouped.set(key, current);
  }
  await Cart.deleteMany({ userId });
  if (grouped.size) {
    await Cart.insertMany([...grouped.values()].map((row) => ({
      userId,
      variantId: row.variant?._id,
      productId: row.snapshot.id,
      quantity: row.quantity,
      unitPrice: row.snapshot.price,
      productSnapshot: row.snapshot,
    })), { ordered: false }).catch(async () => {
      for (const row of grouped.values()) {
        await Cart.findOneAndUpdate(
          { userId, productId: row.snapshot.id, variantId: row.variant?._id },
          { userId, variantId: row.variant?._id, productId: row.snapshot.id, quantity: row.quantity, unitPrice: row.snapshot.price, productSnapshot: row.snapshot },
          { upsert: true, new: true }
        );
      }
    });
  }
  return cartResponse(userId);
}

async function replaceWishlistFromClient(userId, items = []) {
  const rows = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const { variant, snapshot } = await ensureProductVariantFromItem(item);
    rows.set(`${snapshot.id}:${String(variant?._id || '')}`, { variant, snapshot });
  }
  await Wishlist.deleteMany({ userId });
  if (rows.size) {
    await Wishlist.insertMany([...rows.values()].map((row) => ({
      userId,
      variantId: row.variant?._id,
      productId: row.snapshot.id,
      productSnapshot: row.snapshot,
    })), { ordered: false }).catch(async () => {
      for (const row of rows.values()) {
        await Wishlist.findOneAndUpdate(
          { userId, productId: row.snapshot.id, variantId: row.variant?._id },
          { userId, variantId: row.variant?._id, productId: row.snapshot.id, productSnapshot: row.snapshot },
          { upsert: true, new: true }
        );
      }
    });
  }
  return wishlistResponse(userId);
}

async function orderWithItems(orderDoc) {
  if (!orderDoc) return null;
  const order = typeof orderDoc.toObject === 'function' ? orderDoc.toObject() : { ...orderDoc };
  const rows = await OrderItem.find({ orderId: order._id }).sort({ createdAt: 1 }).lean();
  const items = rows.flatMap((row) => expandQuantity({ quantity: row.quantity, productSnapshot: row.productSnapshot, productId: row.productId, unitPrice: row.unitPrice }));
  return { ...order, items, orderItems: rows, total: order.total ?? order.totalAmount, status: order.status || order.orderStatus };
}

async function createOrderWithItems(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const total = Number(payload.total ?? payload.totalAmount ?? items.reduce((sum, item) => sum + Number(item.price || item.unitPrice || 0) * Number(item.qty || item.quantity || 1), 0));
  const paymentMethod = payload.paymentMethod || payload.payment?.id || 'COD';
  const paymentStatus = payload.paymentStatus || (/stripe/i.test(String(paymentMethod)) || payload.stripePaymentIntentId ? 'paid' : 'pending');
  const payment = await Payment.create({
    paymentMethod,
    status: paymentStatus === 'paid' ? 'paid' : 'pending',
    transactionId: payload.transactionId || payload.stripePaymentIntentId || '',
    amount: total,
    currency: 'VND',
    userId: payload.userId,
  });
  const status = payload.status || payload.orderStatus || (paymentStatus === 'paid' ? 'paid' : 'pending_payment');
  const order = await Order.create({
    userId: payload.userId,
    orderDate: payload.orderDate ? new Date(payload.orderDate) : new Date(),
    totalAmount: total,
    total,
    shippingAddress: payload.shippingAddress || '',
    orderStatus: status,
    status,
    phoneNumber: payload.phoneNumber || payload.checkoutMeta?.customer?.phone || '',
    discountCodeId: payload.discountCodeId || undefined,
    paymentStatus,
    transactionId: payload.transactionId || payload.stripePaymentIntentId || '',
    paymentId: payment._id,
    paymentMethod,
    stripePaymentIntentId: payload.stripePaymentIntentId || '',
    type: payload.type || 'product-order',
    idempotencyKey: payload.idempotencyKey,
    checkoutMeta: payload.checkoutMeta || {},
    statusTimeline: payload.statusTimeline || [{ status, at: new Date(), note: 'Đơn hàng được tạo từ JAPANO app/web.' }],
  });
  for (const item of items) {
    const { variant, snapshot } = await ensureProductVariantFromItem(item);
    const quantity = Math.max(1, Number(item.qty || item.quantity || 1));
    await OrderItem.create({
      orderId: order._id,
      variantId: variant?._id,
      productId: snapshot.id,
      quantity,
      unitPrice: Number(item.unitPrice ?? item.price ?? snapshot.price ?? 0),
      productSnapshot: snapshot,
    });
  }
  return orderWithItems(order);
}

async function ordersForUser(userId) {
  const orders = await Order.find({ userId }).sort({ createdAt: -1, orderDate: -1 }).lean();
  return Promise.all(orders.map(orderWithItems));
}


function stripeEnabled() {
  return Boolean(stripe && STRIPE_SECRET_KEY && STRIPE_PUBLISHABLE_KEY);
}

function stripeAmount(amount, currency = STRIPE_CURRENCY) {
  const zeroDecimalCurrencies = new Set(['bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv','xaf','xof','xpf']);
  const n = Number(amount || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return zeroDecimalCurrencies.has(String(currency).toLowerCase()) ? Math.round(n) : Math.round(n * 100);
}

async function getOrCreateStripeCustomer(user) {
  if (!stripe) throw new Error('Stripe chưa được cấu hình trên backend. Thiếu STRIPE_SECRET_KEY.');
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({
    name: user.name || 'JAPANO Member',
    email: user.email || undefined,
    metadata: { internal_user_id: String(user._id) },
  });
  await User.findByIdAndUpdate(user._id, { stripeCustomerId: customer.id }).catch(() => null);
  return customer.id;
}

async function createStripePaymentSheet({ userId, amount, purpose = 'checkout', currency = STRIPE_CURRENCY, items = [], metadata = {} }) {
  if (!stripeEnabled()) {
    const missing = !STRIPE_SECRET_KEY ? 'STRIPE_SECRET_KEY' : 'STRIPE_PUBLISHABLE_KEY';
    const err = new Error(`Stripe chưa sẵn sàng. Thiếu ${missing}.`);
    err.status = 503;
    throw err;
  }
  if (!userId || userId === 'guest') {
    const err = new Error('Bạn cần đăng nhập để thanh toán bằng Stripe.');
    err.status = 401;
    throw err;
  }
  const user = await User.findById(userId).catch(() => null);
  if (!user) {
    const err = new Error('Không tìm thấy tài khoản người dùng.');
    err.status = 404;
    throw err;
  }

  const normalizedPurpose = String(purpose || 'checkout');
  const safeAmount = normalizedPurpose === 'vip' ? VIP_PRICE : Math.round(Number(amount || 0));
  const amountInMinorUnit = stripeAmount(safeAmount, currency);
  if (!amountInMinorUnit) {
    const err = new Error('Số tiền thanh toán không hợp lệ.');
    err.status = 400;
    throw err;
  }

  const customer = await getOrCreateStripeCustomer(user);
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer },
    { apiVersion: STRIPE_API_VERSION }
  );

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInMinorUnit,
    currency: String(currency || STRIPE_CURRENCY).toLowerCase(),
    customer,
    description: normalizedPurpose === 'vip' ? 'JAPANO VIP thử đồ AI không giới hạn' : 'Thanh toán đơn hàng JAPANO',
    metadata: {
      userId: String(user._id),
      purpose: normalizedPurpose,
      localAmount: String(safeAmount),
      itemCount: String(Array.isArray(items) ? items.length : 0),
      ...Object.fromEntries(Object.entries(metadata || {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v).slice(0, 450)])),
    },
    automatic_payment_methods: { enabled: true },
  });

  return {
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    paymentIntent: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    ephemeralKey: ephemeralKey.secret,
    customer,
    amount: safeAmount,
    stripeAmount: amountInMinorUnit,
    currency: String(currency || STRIPE_CURRENCY).toLowerCase(),
    merchantDisplayName: STRIPE_MERCHANT_DISPLAY_NAME,
  };
}

async function requireSucceededStripePayment({ userId, paymentIntentId, purpose, expectedAmount }) {
  if (!stripeEnabled()) {
    const err = new Error('Stripe chưa được cấu hình trên backend.');
    err.status = 503;
    throw err;
  }
  if (!paymentIntentId) {
    const err = new Error('Thiếu paymentIntentId để xác nhận thanh toán.');
    err.status = 400;
    throw err;
  }
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== 'succeeded') {
    const err = new Error(`Thanh toán Stripe chưa thành công. Trạng thái hiện tại: ${intent.status}.`);
    err.status = 402;
    throw err;
  }
  if (String(intent.metadata?.userId || '') !== String(userId)) {
    const err = new Error('PaymentIntent không thuộc về tài khoản đang đăng nhập.');
    err.status = 403;
    throw err;
  }
  if (purpose && String(intent.metadata?.purpose || '') !== String(purpose)) {
    const err = new Error('Sai mục đích thanh toán.');
    err.status = 400;
    throw err;
  }
  if (expectedAmount && Number(intent.metadata?.localAmount || 0) < Number(expectedAmount)) {
    const err = new Error('Số tiền PaymentIntent không khớp giao dịch cần thanh toán.');
    err.status = 400;
    throw err;
  }
  return intent;
}

async function finalizeVipUpgrade({ userId, paymentIntentId, paymentMethod = 'stripe' }) {
  await requireSucceededStripePayment({ userId, paymentIntentId, purpose: 'vip', expectedAmount: VIP_PRICE });
  const membership = {
    tier: 'vip',
    price: VIP_PRICE,
    currency: 'VND',
    upgradedAt: new Date().toISOString(),
    source: 'stripe-payment-sheet',
    stripePaymentIntentId: paymentIntentId,
  };
  const user = await User.findByIdAndUpdate(userId, { membership, vip: true }, { new: true }).catch(() => null);
  if (!user) {
    const err = new Error('Không tìm thấy tài khoản người dùng.');
    err.status = 404;
    throw err;
  }
  const existing = await Order.findOne({ type: 'vip-upgrade', stripePaymentIntentId: paymentIntentId }).catch(() => null);
  const order = existing ? await orderWithItems(existing) : await createOrderWithItems({
    userId,
    type: 'vip-upgrade',
    items: [{ id: 'vip-try-on-unlimited', name: 'VIP thử đồ AI không giới hạn', price: VIP_PRICE, qty: 1 }],
    total: VIP_PRICE,
    status: 'paid',
    paymentMethod,
    stripePaymentIntentId: paymentIntentId,
    paymentStatus: 'paid',
    statusTimeline: [{ status: 'paid', at: new Date(), note: 'Đã thanh toán Stripe và nâng cấp VIP 500.000đ.' }],
  });
  return { ok: true, vipPrice: VIP_PRICE, user: publicUser(user), order };
}

const storeWords = ['mua','bán','shop','cửa hàng','sản phẩm','dịch vụ','giỏ hàng','đơn hàng','giao hàng','thanh toán','đổi trả','bảo hành','giá','size','màu','xu','voucher','trò chơi','thử đồ','quần áo','đồ dùng','dụng cụ','thẻ bài','yêu thích','wishlist','quà','ngày lễ','tạo ảnh','ảnh','outfit','phối','mặc gì','pokemon','pikachu','yugioh','cosplay','fashion','product','service','cart','order','shipping','return','warranty','gift','try-on','image'];
function isStoreRelated(text = '', hasRecentImage = false) { if (hasRecentImage) return true; const normalized = String(text).toLowerCase(); return storeWords.some((w) => normalized.includes(w)); }
function refusal() { return 'Xin lỗi, tôi chỉ hỗ trợ các câu hỏi liên quan đến mua sắm, sản phẩm, dịch vụ, đơn hàng, giỏ hàng, thanh toán, xu, trò chơi, phối đồ, thử đồ và JAPANO.'; }

async function callOllama(prompt) {
  if (Date.now() < ollamaDisabledUntil) return null;
  try {
    const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      keep_alive: '10m',
      options: { temperature: 0.55, num_predict: 420 },
    }, { timeout: OLLAMA_TIMEOUT_MS });
    return res.data?.response?.trim() || null;
  } catch (e) {
    ollamaDisabledUntil = Date.now() + OLLAMA_COOLDOWN_MS;
    const status = e?.response?.status ? `HTTP ${e.response.status}` : e?.code || e?.message;
    console.warn(`[JAPANO] Ollama ${OLLAMA_MODEL} tạm bỏ qua:`, status);
    return null;
  }
}

async function callGeminiText(prompt) {
  if (!GEMINI_API_KEY || Date.now() < geminiDisabledUntil) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        contents: [{ parts: [{ text: prompt }] }]
      }, { timeout: GEMINI_TIMEOUT_MS });
      return res.data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ').trim() || null;
    } catch (e) {
      const status = e?.response?.status;
      const noRetry = status === 429 || status === 403 || e?.code === 'ECONNABORTED';
      if (status === 429 || status === 403 || e?.code === 'ECONNABORTED') {
        geminiDisabledUntil = Date.now() + GEMINI_COOLDOWN_MS;
      }
      console.warn('[JAPANO] Gemini text tạm bỏ qua:', status ? `HTTP ${status}` : e?.code || e?.message);
      if (noRetry || attempt === 1) return null;
      await sleep(700);
    }
  }
  return null;
}

function friendlyVisionError(error) {
  const raw = String(error?.response?.data?.message || error?.message || error || 'Vision AI chưa phân tích được ảnh này.');
  const compact = raw.replace(/\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
  if (/UnicodeEncodeError|charmap|cp1252/i.test(compact)) return 'Camera AI chưa phân tích được do Python trên Windows đang dùng sai mã hóa. Hãy chạy backend với PYTHONIOENCODING=utf-8 rồi thử lại.';
  if (/timeout|quá \d+ giây|timed out|ECONNABORTED/i.test(compact)) return 'Camera AI xử lý quá lâu. Hãy chụp ảnh rõ hơn, đủ sáng hơn hoặc giảm real-time scan.';
  if (/model|tflite|h5|tensorflow|opencv|cascade/i.test(compact)) return 'Camera AI chưa nạp được model nhận diện. Hãy kiểm tra file model trong server/models và môi trường Python.';
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
}

function friendlyAiServiceError(error, fallback = 'Dịch vụ AI đang quá tải, JAPANO dùng chế độ demo/fallback để không làm kẹt app.') {
  const raw = String(error?.response?.data?.msg || error?.response?.data?.message || error?.message || error || '');
  if (/429|rate|quota|Too Many/i.test(raw)) return 'AI đang quá tải hoặc hết quota. JAPANO tạm dùng chế độ tư vấn nhanh để không làm đứng app.';
  if (/403|API key|permission|forbidden|invalid/i.test(raw)) return 'API key AI chưa hợp lệ hoặc chưa có quyền. JAPANO tạm dùng chế độ demo/fallback.';
  if (/credit|No enough/i.test(raw)) return 'Fotor báo không đủ credit. JAPANO tạm dùng chế độ demo/fallback.';
  if (/timeout|ECONNABORTED|timed out/i.test(raw)) return 'AI xử lý quá lâu. JAPANO tạm dùng chế độ demo/fallback.';
  return raw ? `${fallback} Chi tiết rút gọn: ${raw.slice(0, 160)}` : fallback;
}


function cloudinaryEnabled() {
  const cfg = cloudinary.config() || {};
  return Boolean((process.env.CLOUDINARY_URL || cfg.cloud_name) && cfg.api_key && cfg.api_secret);
}

function resourceTypeFromMime(mimeType = '') {
  if (String(mimeType).startsWith('image/')) return 'image';
  if (String(mimeType).startsWith('video/')) return 'video';
  return 'raw';
}

function normalizeCloudinaryUrl(doc) {
  if (!doc) return '';
  return doc.secureUrl || doc.secure_url || doc.url || doc.cloudinary?.secure_url || doc.cloudinary?.url || '';
}

function sanitizeCloudinarySegment(value, fallback = 'uploads') {
  const raw = String(value || fallback).trim().replace(/\\/g, '/');
  const safe = raw
    .split('/')
    .map((part) => part.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
  return safe || fallback;
}

function cloudinaryFolderForMime(mimeType = '') {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audio';
  return 'files';
}

function publicCloudinaryConfig() {
  const cfg = cloudinary.config() || {};
  return {
    enabled: cloudinaryEnabled(),
    cloudName: cfg.cloud_name || CLOUDINARY_CLOUD_NAME || '',
    rootFolder: CLOUDINARY_ROOT_FOLDER,
    maxUploadMB: 120,
    supported: ['image', 'video', 'audio', 'raw'],
  };
}

async function uploadBufferToCloudinary(buffer, { filename = 'japano-file', mimeType = 'application/octet-stream', folder = 'uploads', publicId = '', tags = [] } = {}) {
  if (!cloudinaryEnabled()) throw new Error('Chưa cấu hình Cloudinary. Hãy thêm CLOUDINARY_URL hoặc CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET vào .env.server.');
  const resourceType = resourceTypeFromMime(mimeType);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: resourceType,
      folder: `${CLOUDINARY_ROOT_FOLDER}/${folder}`.replace(/\/+/g, '/'),
      public_id: publicId || undefined,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      tags: ['japano', ...tags],
      context: { filename },
    }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

async function uploadRemoteToCloudinary(url, { filename = 'remote-file', folder = 'generated', resourceType = 'image', tags = [] } = {}) {
  if (!cloudinaryEnabled()) throw new Error('Chưa cấu hình Cloudinary. Hãy thêm CLOUDINARY_URL hoặc CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET vào .env.server.');
  return cloudinary.uploader.upload(url, {
    resource_type: resourceType,
    folder: `${CLOUDINARY_ROOT_FOLDER}/${folder}`.replace(/\/+/g, '/'),
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    tags: ['japano', ...tags],
    context: { filename },
  });
}

async function createCloudinaryAsset({ userId = 'guest', filename = 'upload', mimeType = 'application/octet-stream', buffer, remoteUrl = '', source = 'upload', folder = 'uploads', provider = '', extra = {} }) {
  let result = null;
  if (buffer?.length) {
    result = await uploadBufferToCloudinary(buffer, { filename, mimeType, folder, tags: [source] });
  } else if (remoteUrl) {
    result = await uploadRemoteToCloudinary(remoteUrl, { filename, folder, resourceType: resourceTypeFromMime(mimeType || 'image/jpeg'), tags: [source] });
  } else {
    throw new Error('Thiếu buffer hoặc remoteUrl để upload Cloudinary.');
  }
  return FileAsset.create({
    userId,
    filename,
    mimeType: mimeType || result?.resource_type || 'application/octet-stream',
    size: Number(buffer?.length || result?.bytes || 0),
    url: result?.url || result?.secure_url || remoteUrl,
    secureUrl: result?.secure_url || result?.url || remoteUrl,
    publicId: result?.public_id || '',
    resourceType: result?.resource_type || resourceTypeFromMime(mimeType),
    format: result?.format || '',
    bytes: result?.bytes || Number(buffer?.length || 0),
    source,
    provider,
    cloudinary: result || null,
    ...extra,
  });
}

async function bufferFromAsset(asset) {
  if (!asset) return null;
  if (asset.data) return { buffer: asset.data, mimeType: asset.mimeType || 'image/jpeg' };
  const url = normalizeCloudinaryUrl(asset);
  if (!url) return null;
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000, maxContentLength: 25 * 1024 * 1024 });
  const mimeType = String(res.headers['content-type'] || asset.mimeType || 'image/jpeg').split(';')[0];
  return { buffer: Buffer.from(res.data), mimeType };
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function fotorHeaders() {
  if (!FOTOR_API_KEY) throw new Error('Chưa cấu hình FOTOR_API_KEY trong .env.server.');
  return { Authorization: `Bearer ${FOTOR_API_KEY}`, 'Content-Type': 'application/json' };
}

async function startFotorImageGeneration({ content, width = FOTOR_TRYON_WIDTH, height = FOTOR_TRYON_HEIGHT, provider = FOTOR_PROVIDER }) {
  const start = await axios.post(
    `https://api-b.fotor.com/v1/aiart/imagegeneration/${encodeURIComponent(provider)}`,
    { content, width, height },
    { headers: fotorHeaders(), timeout: 45000 },
  );
  const taskId = start.data?.data?.taskId;
  if (!taskId) throw new Error(start.data?.msg || 'Fotor không trả về taskId.');
  return taskId;
}

async function getFotorTask(taskId) {
  const res = await axios.get(`https://api-b.fotor.com/v1/aiart/tasks/${encodeURIComponent(taskId)}`, {
    headers: fotorHeaders(),
    timeout: 30000,
  });
  if (res.data?.code && res.data.code !== '000') throw new Error(res.data?.msg || 'Fotor task query failed.');
  return res.data?.data || res.data;
}

function extractFotorImageUrls(task = {}) {
  const urls = [];
  if (typeof task.resultUrl === 'string' && /^https?:\/\//i.test(task.resultUrl)) urls.push(task.resultUrl);
  const avatarResult = Array.isArray(task.avatarResult) ? task.avatarResult : [];
  for (const group of avatarResult) {
    for (const img of Array.isArray(group.images) ? group.images : []) {
      if (img?.url && /^https?:\/\//i.test(img.url)) urls.push(img.url);
    }
  }
  const images = Array.isArray(task.images) ? task.images : [];
  for (const img of images) {
    const url = typeof img === 'string' ? img : img?.url;
    if (url && /^https?:\/\//i.test(url)) urls.push(url);
  }
  return [...new Set(urls)];
}

async function waitForFotorImages(taskId, { attempts = 24, delayMs = 3500 } = {}) {
  let lastTask = null;
  for (let i = 0; i < attempts; i += 1) {
    lastTask = await getFotorTask(taskId);
    const status = Number(lastTask?.status);
    const urls = extractFotorImageUrls(lastTask);
    if (status === 1 && urls.length) return { task: lastTask, urls };
    if (status === 2) throw new Error(lastTask?.msg || 'Fotor xử lý thất bại.');
    await sleep(delayMs);
  }
  return { task: lastTask, urls: extractFotorImageUrls(lastTask), pending: true };
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = 0, env = {}, ...spawnOptions } = options;
    const child = spawn(command, args, {
      ...spawnOptions,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        TF_CPP_MIN_LOG_LEVEL: process.env.TF_CPP_MIN_LOG_LEVEL || '2',
        ...env,
      },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const done = (fn, value) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      fn(value);
    };
    const timer = timeout ? setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      done(reject, new Error(`${command} chạy quá ${Math.round(timeout / 1000)} giây nên đã dừng.`));
    }, timeout) : null;
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', (err) => done(reject, err));
    child.on('close', (code) => {
      if (code === 0) return done(resolve, { stdout, stderr });
      const compact = String(stderr || stdout || `${command} exited with code ${code}`).split(/\r?\n/).slice(-12).join('\n');
      done(reject, new Error(compact));
    });
  });
}

async function analyzeImageWithLocalVisionModel(imagePath) {
  return analyzeMediaWithLocalVisionModel(imagePath, 'image');
}

async function analyzeMediaWithLocalVisionModel(filePath, mediaKind = 'image') {
  const scriptPath = path.join(__dirname, 'vision_analyze.py');
  const args = [scriptPath, mediaKind === 'video' ? '--video' : '--image', filePath];
  const started = Date.now();
  const { stdout } = await runProcess(PYTHON_BIN, args, { timeout: mediaKind === 'video' ? 420000 : 240000 });
  const jsonLine = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '{}';
  const parsed = JSON.parse(jsonLine);
  return { ...parsed, mediaType: mediaKind, durationMs: Date.now() - started };
}


function pickVisionProducts({ baseProduct, allProducts = [], analysis = {} }) {
  const face = analysis?.face || {};
  const detector = analysis?.detector || {};
  const ageGroup = String(face.ageGroup || 'unknown');
  const emotion = String(face.primaryEmotion || 'neutral');
  const hasFace = Number(detector.faceCount || detector.personCount || 0) > 0 || Boolean(face.available);
  const productCategory = baseProduct?.category;
  const productSubcategory = baseProduct?.subcategory;

  const scored = allProducts.map((p) => {
    let score = 0;
    const category = String(p.category || '');
    const sub = String(p.subcategory || '');
    const hay = normalizeText(`${p.name || ''} ${p.description || ''} ${p.story || ''} ${(p.visualTags || []).join(' ')}`);
    if (baseProduct && String(p.id) === String(baseProduct.id)) score += 12;
    if (productCategory && category === productCategory) score += 3;
    if (productSubcategory && sub === productSubcategory) score += 2;
    if (hasFace && ['clothing', 'home-items'].includes(category)) score += 3;
    if (/child|teen/.test(ageGroup) && (/kids|pokemon|yugioh|cards|snacks/.test(sub) || category === 'cards')) score += 6;
    if (/adult|young-adult/.test(ageGroup) && (/women|men|outerwear|traditional|fashion-accessories|bags/.test(sub) || category === 'clothing')) score += 4;
    if (/senior/.test(ageGroup) && (/traditional|stationery|decor|tableware/.test(sub) || category === 'home-items')) score += 4;
    if (/happy|surprise/.test(emotion) && /red|pink|gold|festival|cute|cosplay|card|spark/i.test(hay)) score += 3;
    if (/sad|fear|neutral/.test(emotion) && /cream|navy|soft|cozy|cardigan|basic|minimal/i.test(hay)) score += 2;
    if (/angry|disgust/.test(emotion) && /calm|blue|navy|minimal|basic/i.test(hay)) score += 3;
    if (/try-on-ready|face-detected/.test((analysis?.visualTags || []).join(' ')) && category === 'clothing') score += 2;
    return { product: p, score };
  }).filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.product);

  const seen = new Set();
  return scored.filter((p) => {
    const key = String(p.id || p._id || p.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

function buildVisionRecommendation({ baseProduct, products = [], analysis = {} }) {
  const face = analysis?.face || {};
  const detector = analysis?.detector || {};
  const ageGroup = face.ageGroup || 'unknown';
  const emotion = face.primaryEmotion || 'neutral';
  const faceCount = Number(detector.faceCount || detector.personCount || 0);
  const suggested = pickVisionProducts({ baseProduct, allProducts: products, analysis });
  const confidence = face.emotionConfidence ? `${Math.round(Number(face.emotionConfidence))}%` : '';
  const reason = [
    faceCount > 0 ? `Model file đã phát hiện ${faceCount} khuôn mặt trong ảnh/frame, nên có thể dùng để tư vấn outfit gần với người dùng.` : `Chưa thấy khuôn mặt rõ, AI ưu tiên sản phẩm dễ phối dựa trên món đang xem.`,
    ageGroup !== 'unknown' ? `Nhóm tuổi ước lượng: ${ageGroup}, dùng để tránh gợi ý sai nhóm quần áo/đồ dùng.` : `Chưa đủ dữ liệu tuổi, AI dùng fallback theo sản phẩm và ngữ cảnh mua sắm.`,
    emotion ? `Biểu cảm chính: ${emotion}${confidence ? ` (${confidence})` : ''}, dùng để chọn màu sắc và mood phù hợp hơn.` : '',
  ].filter(Boolean).join(' ');
  return {
    title: baseProduct ? `AI thử đồ với ${baseProduct.name}` : 'AI gợi ý đồ bằng camera',
    ageGroup,
    emotion,
    faceCount,
    reason,
    products: suggested,
  };
}


function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productSearchHaystack(product = {}) {
  return normalizeText(`${product.name || ''} ${product.category || ''} ${product.subcategory || ''} ${product.description || ''} ${product.story || ''} ${(product.visualTags || []).join(' ')} ${product.styleUseCase || ''}`);
}

function isConversationalSearch(query = '') {
  const q = normalizeText(query);
  return /(mac gi|phoi|outfit|hop gi|hom nay|di choi|di lam|di hoc|qua|tet|noel|le|combo|set do|sinh nhat)/i.test(q) || q.split(' ').length >= 3;
}

function rankProductsForQuery(query = '', products = [], occasionKey = '') {
  const q = normalizeText(query);
  const tokens = q.split(/\s+/).filter(Boolean);
  const conversational = isConversationalSearch(query);
  return products
    .map((product) => {
      const haystack = productSearchHaystack(product);
      let score = 0;
      if (!q) score += 1;
      if (q && haystack.includes(q)) score += q.length === 1 ? 2 : 10;
      tokens.forEach((token) => {
        if (haystack.includes(token)) score += token.length === 1 ? 1 : 3;
        if (normalizeText(product.name || '').startsWith(token)) score += 3;
      });
      if (/ao|shirt|top|mac/.test(q) && /tops|outerwear|traditional|cosplay/.test(String(product.subcategory))) score += 4;
      if (/quan|vay|pants|bottom/.test(q) && /bottom|traditional/.test(String(product.subcategory))) score += 4;
      if (/giay|dep|sneaker|shoe/.test(q) && product.subcategory === 'footwear') score += 5;
      if (/the|card|pokemon|pikachu|yugioh|one piece|dragon/.test(q) && product.category === 'cards') score += 6;
      if (/dung cu|tool|bep|gaming|cosplay/.test(q) && product.category === 'tools') score += 4;
      if (/qua|gift|sinh nhat|1 6|20 10|8 3|noel|tet/.test(q) && ['home-items', 'cards', 'clothing'].includes(product.category)) score += 3;
      if (occasionKey && productSearchHaystack(product).includes(normalizeText(occasionKey))) score += 2;
      if (conversational && ['clothing', 'home-items'].includes(product.category)) score += 2;
      return { product, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

function pickChatProducts(message = '', products = [], occasionKey = '', limit = 8) {
  const ranked = rankProductsForQuery(message, products, occasionKey).map((x) => x.product);
  const fallback = products.filter((p) => ['clothing', 'home-items', 'cards'].includes(String(p.category))).slice(0, limit);
  const seen = new Set();
  return [...ranked, ...fallback].filter((p) => {
    const key = String(p.id || p._id || p.name || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function buildLocalChatAnswer({ message = '', products = [], productIds = [], latestVision = null, occasionKey = '' }) {
  const q = normalizeText(message);
  const picked = productIds.length
    ? productIds.map((id) => products.find((p) => String(p.id || p._id) === String(id))).filter(Boolean)
    : pickChatProducts(message, products, occasionKey, 5);
  const names = picked.slice(0, 4).map((p) => p.name).filter(Boolean);
  const nameLine = names.length ? `\n\nSản phẩm nên xem: ${names.join(' · ')}.` : '';

  if (latestVision?.analysis) {
    const face = latestVision.analysis.face || {};
    const detector = latestVision.analysis.detector || {};
    const faceCount = Number(detector.faceCount || detector.personCount || 0);
    const conf = face.emotionConfidence ? ` (${Math.round(Number(face.emotionConfidence))}%)` : '';
    return {
      message: `Tôi đã dùng kết quả emotion/age model gần nhất: phát hiện ${faceCount} khuôn mặt, nhóm tuổi ${face.ageGroup || 'chưa rõ'}, cảm xúc ${face.primaryEmotion || 'neutral'}${conf}.\n\nGợi ý an toàn: chọn nền kem/navy/nâu, form gọn, quần/váy tối màu, giày trắng/nâu. Nếu muốn nổi bật, thêm một phụ kiện đỏ/mận hoặc món có hoạ tiết Nhật. Với ảnh trẻ em/teen, ưu tiên đồ thoải mái và phụ kiện vui; với người lớn, ưu tiên haori, áo khoác nhẹ, túi canvas hoặc phụ kiện tối giản.${nameLine}`,
      productIds: picked.map((p) => String(p.id || p._id)).filter(Boolean),
    };
  }

  if (/mac gi|phoi|outfit|hop|size|ao|quan|vay|giay|style/.test(q)) {
    return {
      message: `Tôi gợi ý phối theo hướng dễ đẹp và dễ mua: 1 món chính tông kem/navy/nâu, 1 món dưới tối màu để cân bằng dáng, giày trắng/nâu, thêm phụ kiện đỏ Suoh hoặc túi canvas để có điểm nhấn. Nếu bạn gửi ảnh toàn thân, tôi sẽ tư vấn chính xác hơn theo màu da, form người và mood khuôn mặt.${nameLine}`,
      productIds: picked.map((p) => String(p.id || p._id)).filter(Boolean),
    };
  }

  if (/qua|gift|sinh nhat|1 6|noel|tet|le/.test(q)) {
    return {
      message: `Với nhu cầu quà tặng, nên chọn món dễ dùng, ít rủi ro size và có câu chuyện: thẻ bài/sưu tầm cho trẻ em hoặc fan anime, đồ dùng Nhật nhỏ gọn, phụ kiện thời trang, hoặc set áo + phụ kiện nếu đã biết size người nhận.${nameLine}`,
      productIds: picked.map((p) => String(p.id || p._id)).filter(Boolean),
    };
  }

  return {
    message: `Tôi đang ở chế độ trả lời ổn định tại máy vì Gemini/Ollama có thể đang quá tải hoặc chưa phản hồi. Bạn có thể hỏi về phối đồ, size, sản phẩm, giỏ hàng, thanh toán, quà tặng hoặc gửi ảnh/video để tôi dùng Vision AI gợi ý cụ thể hơn.${nameLine}`,
    productIds: picked.map((p) => String(p.id || p._id)).filter(Boolean),
  };
}

function buildLocalSearchSuggestionsFromProducts(query = '', products = [], occasionKey = '') {
  const q = normalizeText(query.trim());
  const ranked = rankProductsForQuery(query, products, occasionKey);
  const isOutfit = isConversationalSearch(query);

  const productSuggestions = ranked.slice(0, 8).map(({ product, score }, index) => ({
    id: `mongo-product-${product.id || product._id}-${index}`,
    type: 'product',
    title: product.name,
    subtitle: `AI khớp theo tên, danh mục, hình ảnh/tag, dịp mua sắm · ${Math.min(99, Math.max(35, score * 9))}%`,
    product,
    confidence: Math.min(0.98, score / 14),
    reason: `Phù hợp vì thuộc nhóm ${product.subcategory || product.category}, có màu/form/tag gần với truy vấn.`,
  }));

  const topIds = ranked.slice(0, 5).map((x) => x.product.id || String(x.product._id));
  const ai = isOutfit ? [
    { id: 'ai-intent-outfit', type: 'ai', title: 'AI: hôm nay nên mặc gì?', subtitle: 'Tạo set đồ + phụ kiện + lý do chọn theo ngữ cảnh của bạn.', query, productIds: topIds },
    { id: 'ai-intent-combo', type: 'ai', title: 'AI: tạo combo mua nhanh', subtitle: 'Gợi ý sản phẩm chính + đồ đi kèm để tăng giá trị đơn hàng.', query: `combo ${query}`, productIds: topIds },
  ] : [];

  const querySuggestions = [
    { id: 'q-tet', type: 'query', title: 'Set đồ đi Tết / lì xì / quà biếu', subtitle: 'Ưu tiên từ tháng 1 đến tháng 2', query: 'set đồ đi Tết quà biếu' },
    { id: 'q-national', type: 'query', title: 'Đồ đi chơi dịp 30/4, 1/5, 2/9', subtitle: 'Outfit thoải mái, cờ bay, phụ kiện du lịch', query: 'đồ đi chơi dịp lễ quốc gia' },
    { id: 'q-child', type: 'query', title: 'Quà 1/6 cho trẻ em', subtitle: 'Thẻ bài, snack Nhật, đồ dễ thương và set quà nhỏ', query: 'quà 1/6 cho trẻ em' },
    { id: 'q-card', type: 'query', title: 'Thẻ bài Pokémon / Yu-Gi-Oh! / One Piece', subtitle: 'Booster, binder, sleeve, card hiếm', query: 'thẻ bài pokemon yugioh one piece' },
  ].filter((item) => !q || normalizeText(item.title + ' ' + item.subtitle).includes(q) || q.length > 5).slice(0, 3);

  return [...ai, ...productSuggestions, ...querySuggestions].slice(0, 10);
}

async function callGeminiVision({ text, file }) {
  if (!GEMINI_API_KEY || !file || Date.now() < geminiDisabledUntil) return null;
  try {
    const payload = await bufferFromAsset(file);
    if (!payload?.buffer) return null;
    const base64 = payload.buffer.toString('base64');
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [
          { text: `Bạn là stylist bán hàng JAPANO. Dựa trên ảnh người dùng và câu hỏi: ${text}. Chỉ tư vấn phối đồ, sản phẩm, phụ kiện của cửa hàng. Trả lời tiếng Việt, cụ thể, dễ mua.` },
          { inlineData: { mimeType: payload.mimeType || file.mimeType || 'image/jpeg', data: base64 } },
        ],
      }],
    }, { timeout: GEMINI_TIMEOUT_MS });
    return res.data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ').trim();
  } catch (e) {
    const status = e?.response?.status;
    if (status === 429 || status === 403 || e?.code === 'ECONNABORTED') geminiDisabledUntil = Date.now() + GEMINI_COOLDOWN_MS;
    console.warn('[JAPANO] Gemini vision tạm bỏ qua:', status ? `HTTP ${status}` : e?.code || e?.message);
    return null;
  }
}

function parseProductIds(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {}
  return String(value).split(',').map((x) => x.trim()).filter(Boolean);
}

function orderProductsByIds(items, ids) {
  const byId = new Map(items.map((item) => [String(item.id || item._id), item]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

function tryOnPrompt({ products = [], comboTitle = '' }) {
  const productLines = products.map((p, index) => `${index + 1}. ${p.name} (${p.category}/${p.subcategory}) - ${p.description || ''} - tags: ${(p.visualTags || []).join(', ')}`).join('\n');
  return [
    'Bạn là AI virtual try-on cho shop JAPANO.',
    'Hãy chỉnh ảnh người dùng để người trong ảnh mặc đúng outfit/combo sản phẩm bên dưới.',
    'Giữ gương mặt, dáng người, tóc, tư thế và nền ảnh tự nhiên nhất có thể. Không đổi danh tính người trong ảnh.',
    'Không thêm chữ, watermark, logo, khung ảnh hay UI. Ảnh đầu ra là ảnh thời trang tự nhiên, rõ trang phục.',
    comboTitle ? `Tên combo: ${comboTitle}` : '',
    `Sản phẩm cần mặc/phối:\n${productLines}`,
    'Nếu combo có nhiều món, hãy phối thành một bộ hoàn chỉnh: áo/quần/váy/áo khoác/phụ kiện/đạo cụ phù hợp. Nếu chỉ có một món, chỉ thay hoặc thêm đúng món đó.',
  ].filter(Boolean).join('\n');
}

async function resolveTryOnSourceImage(req) {
  const file = req.file || (Array.isArray(req.files) ? req.files[0] : null);
  if (file?.buffer) {
    return {
      buffer: file.buffer,
      mimeType: file.mimetype || 'image/jpeg',
      filename: file.originalname || 'tryon-upload.jpg',
      source: 'upload',
    };
  }

  const imageUrl = String(req.body?.imageUrl || '').trim();
  if (imageUrl) {
    if (!/^https?:\/\//i.test(imageUrl)) throw new Error('Link ảnh phải bắt đầu bằng http:// hoặc https://.');
    const fetched = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000, maxContentLength: 15 * 1024 * 1024 });
    const mimeType = String(fetched.headers['content-type'] || 'image/jpeg').split(';')[0];
    if (!mimeType.startsWith('image/')) throw new Error('Link này không trả về file ảnh hợp lệ.');
    return {
      buffer: Buffer.from(fetched.data),
      mimeType,
      filename: path.basename(new URL(imageUrl).pathname) || 'tryon-link.jpg',
      source: 'link',
    };
  }

  const imageBase64 = String(req.body?.imageBase64 || '').trim();
  if (imageBase64) {
    return {
      buffer: Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64'),
      mimeType: req.body?.mimeType || 'image/png',
      filename: 'tryon-clipboard.png',
      source: 'base64',
    };
  }

  throw new Error('Thiếu ảnh người dùng. Hãy gửi file ảnh, link ảnh hoặc base64 ảnh.');
}


function buildFallbackStyleSuggestions(product, allProducts) {
  const pick = (ids) => ids.map((id) => allProducts.find((p) => String(p.id) === String(id))).filter(Boolean);
  const fallbackMap = {
    'women-tops': ['p18', 'p21', 'p22', 'p23'],
    'women-bottoms': ['p2', 'p21', 'p22', 'p24'],
    'men-tops': ['p20', 'p22', 'p9'],
    'men-bottoms': ['p3', 'p19', 'p22'],
    outerwear: ['p2', 'p18', 'p22', 'p24'],
    'japan-traditional': ['p18', 'p22', 'p24', 'p23'],
    'vietnam-traditional': ['p23', 'p24', 'p25'],
    kids: ['p36', 'p22', 'p26', 'p32'],
    cosplay: ['p31', 'p29', 'p22', 'p30'],
    footwear: ['p2', 'p18', 'p21', 'p23'],
    'fashion-accessories': ['p2', 'p18', 'p21', 'p22'],
    tableware: ['p7', 'p26', 'p28', 'p25'],
    decor: ['p25', 'p8', 'p7', 'p24'],
    stationery: ['p8', 'p24', 'p25'],
    snacks: ['p26', 'p32', 'p36'],
    'tech-small': ['p27', 'p30', 'p9'],
    bags: ['p19', 'p20', 'p22', 'p8'],
    collectibles: ['p29', 'p31', 'p16'],
    'kitchen-tools': ['p28', 'p26', 'p7'],
    'craft-tools': ['p29', 'p31', 'p16'],
    'school-tools': ['p8', 'p24', 'p25'],
    'cosplay-tools': ['p31', 'p5', 'p29'],
    'gaming-tools': ['p30', 'p12', 'p35', 'p33'],
    'card-tools': ['p16', 'p35', 'p12', 'p13'],
    pokemon: ['p13', 'p32', 'p36', 'p16'],
    yugioh: ['p14', 'p33', 'p12', 'p35'],
    'one-piece': ['p15', 'p35', 'p16'],
    'dragon-ball': ['p34', 'p16', 'p35'],
    'anime-cards': ['p29', 'p31', 'p16'],
    'rare-holo': ['p16', 'p35', 'p12'],
    'card-accessories': ['p16', 'p35', 'p12', 'p13'],
  };
  const ids = fallbackMap[product.subcategory] || fallbackMap[product.category] || ['p2', 'p18', 'p22', 'p23'];
  const items = [product, ...pick(ids).filter((p) => String(p.id) !== String(product.id))].slice(0, 5);
  const productTags = Array.isArray(product.visualTags) ? product.visualTags.join(', ') : product.subcategory;
  return [{
    id: `${product.id || product._id}-server-style-0`,
    title: product.category === 'cards' ? 'AI gợi ý combo sưu tầm' : product.category === 'tools' || product.category === 'home-items' ? 'AI gợi ý combo đi kèm' : 'AI gợi ý phối đồ hoàn chỉnh',
    mood: productTags || 'đồng bộ hình ảnh',
    reason: `AI dựa vào ảnh sản phẩm, nhóm ${product.subcategory}, màu/form và câu chuyện của món chính để chọn các món có cùng ngôn ngữ thị giác. Combo này giúp người dùng mua đủ set: món chính, phụ kiện bổ trợ và đồ đi kèm để ảnh/diện mạo không bị rời rạc.`,
    items,
  }];
}


function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function compactProduct(product = {}) {
  return {
    id: product.id || String(product._id || ''),
    name: product.name,
    category: product.category,
    subcategory: product.subcategory,
    price: product.price,
    image: product.image,
    story: product.story,
    description: product.description,
    badge: product.badge,
    visualTags: product.visualTags || [],
    styleUseCase: product.styleUseCase || '',
  };
}

function estimateSizeFromBody(body = {}) {
  const chest = Number(body.chestCm || 0);
  const waist = Number(body.waistCm || 0);
  const hip = Number(body.hipCm || 0);
  const weight = Number(body.weightKg || 0);
  if (body.usualSize) return String(body.usualSize).toUpperCase();
  const max = Math.max(chest, waist + 18, hip, weight + 40);
  if (!max) return 'M';
  if (max < 86) return 'S';
  if (max < 96) return 'M';
  if (max < 106) return 'L';
  if (max < 116) return 'XL';
  return 'XXL';
}

function sizeAdviceForProduct(product = {}, body = {}) {
  const size = estimateSizeFromBody(body);
  const sub = String(product.subcategory || '');
  const category = String(product.category || '');
  const fit = String(body.fitPreference || 'regular');
  const notes = [];
  if (!body || !Object.keys(body).length) notes.push('Chưa có đủ số đo, AI đang dùng size mặc định.');
  if (/outerwear|japan-traditional|vietnam-traditional/.test(sub)) notes.push('Món này nên chọn rộng hơn 0.5-1 size để mặc thoải mái.');
  if (/women-bottoms|men-bottoms/.test(sub)) notes.push('Ưu tiên kiểm tra vòng eo và vòng mông trước khi chốt size.');
  if (/tops|men-tops|women-tops/.test(sub)) notes.push('Ưu tiên kiểm tra vai và ngực để áo không bị căng.');
  if (category !== 'clothing') notes.push('Sản phẩm này không phụ thuộc size cơ thể nhiều.');
  if (fit === 'oversize') notes.push('Bạn thích form rộng, có thể tăng 1 size nếu muốn streetwear.');
  if (fit === 'slim') notes.push('Bạn thích form gọn, không nên tăng size nếu số đo sát bảng size.');
  return {
    recommendedSize: category === 'clothing' ? size : 'Free size',
    confidence: body?.heightCm || body?.weightKg || body?.chestCm ? 0.78 : 0.45,
    notes,
  };
}

function scoreProductsForStylist(products = [], profile = {}, body = {}, mode = '') {
  const styleWords = (profile.preferredStyles || []).map((x) => normalizeText(x)).join(' ');
  const occasion = normalizeText(profile.occasion || mode || '');
  const skinTone = normalizeText(profile.skinTone || '');
  const budget = Number(profile.budget || 0);
  const gender = normalizeText(profile.gender || '');
  return products.map((product) => {
    const hay = productSearchHaystack(product);
    let score = 0;
    if (product.category === 'clothing') score += 5;
    if (/di hoc|school|hoc|study/.test(occasion) && /tops|bottom|bags|school|stationery|footwear/.test(hay)) score += 5;
    if (/di lam|cong so|work|office/.test(occasion) && /men|women|outerwear|traditional|bags|navy|cream|minimal/.test(hay)) score += 5;
    if (/di choi|hen ho|date|weekend/.test(occasion) && /cosplay|outerwear|fashion|bags|red|cute|festival/.test(hay)) score += 5;
    if (/tiẹc|tiec|party|le hoi|festival/.test(occasion) && /traditional|cosplay|red|gold|pink|decor/.test(hay)) score += 5;
    for (const token of styleWords.split(/\s+/).filter(Boolean)) if (hay.includes(token)) score += 2;
    if (/nu|female|women/.test(gender) && /women|fashion|traditional|bags|footwear/.test(hay)) score += 2;
    if (/nam|male|men/.test(gender) && /men|outerwear|footwear|bags/.test(hay)) score += 2;
    if (/sang|light|fair/.test(skinTone) && /navy|red|pink|cream/.test(hay)) score += 2;
    if (/ngam|tan|dark/.test(skinTone) && /cream|gold|navy|brown|red/.test(hay)) score += 2;
    if (budget && Number(product.price || 0) <= budget) score += 3;
    return { product, score };
  }).filter((x) => x.score > 0).sort((a,b)=>b.score-a.score).map((x)=>x.product);
}

function buildStylistSets({ products = [], profile = {}, body = {} }) {
  const modes = [
    { key: 'today', title: 'Set đồ hôm nay', mode: profile.occasion || 'hôm nay mặc gì', tone: 'Dễ mặc, cân bằng màu và hợp hoạt động trong ngày.' },
    { key: 'going-out', title: 'Set đi chơi', mode: 'đi chơi hẹn hò weekend', tone: 'Có điểm nhấn hơn, hợp chụp ảnh và đi cà phê.' },
    { key: 'school-work', title: 'Set đi học/đi làm', mode: 'đi học đi làm công sở', tone: 'Gọn, lịch sự, không quá lòe loẹt.' },
    { key: 'party', title: 'Set đi tiệc', mode: 'đi tiệc lễ hội festival', tone: 'Nổi bật hơn bằng phụ kiện/màu nhấn.' },
    { key: 'seasonal', title: 'Set theo mùa', mode: 'mùa này áo khoác thoải mái', tone: 'Ưu tiên chất liệu và khả năng phối nhiều lớp.' },
    { key: 'skin-tone', title: 'Set theo màu da', mode: `màu da ${profile.skinTone || ''}`, tone: 'Chọn màu giúp da sáng và tổng thể hài hòa.' },
  ];
  const used = new Set();
  return modes.map((mode) => {
    const ranked = scoreProductsForStylist(products, { ...profile, occasion: mode.mode }, body, mode.key)
      .filter((p) => !used.has(String(p.id || p._id)))
      .slice(0, 4);
    ranked.forEach((p) => used.add(String(p.id || p._id)));
    const fallback = ranked.length ? ranked : products.filter((p) => p.category === 'clothing').slice(0, 4);
    return {
      id: mode.key,
      title: mode.title,
      tone: mode.tone,
      sizeAdvice: fallback[0] ? sizeAdviceForProduct(fallback[0], body) : null,
      products: fallback.map(compactProduct),
      reason: `Dựa trên phong cách ${Array.isArray(profile.preferredStyles) ? profile.preferredStyles.join(', ') : 'chưa chọn'}, dịp ${profile.occasion || mode.mode}, màu da ${profile.skinTone || 'chưa rõ'} và ngân sách ${profile.budget ? Number(profile.budget).toLocaleString('vi-VN') + 'đ' : 'linh hoạt'}.`,
    };
  });
}

app.get('/api/health', (_, res) => res.json({ ok: true, mongo: mongoose.connection.readyState === 1, ollamaModel: OLLAMA_MODEL, ollamaUrl: OLLAMA_URL, geminiEnabled: Boolean(GEMINI_API_KEY), geminiTextModel: GEMINI_TEXT_MODEL, fotorEnabled: Boolean(FOTOR_API_KEY), fotorProvider: FOTOR_PROVIDER, cloudinaryEnabled: cloudinaryEnabled(), database: 'MongoDB Atlas / japano', mediaStorage: 'Cloudinary', vision: { engine: 'emotion-age-file', emotionModel: process.env.EMOTION_MODEL_PATH || 'server/models/emotion_fulltrain_best_model.tflite', python: PYTHON_BIN, endpoint: '/api/vision/style-from-media' } }));

app.get('/api/cloudinary/config', (_, res) => res.json(publicCloudinaryConfig()));

app.post('/api/media/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Missing file' });
    const userId = req.body.userId || 'guest';
    const fallbackFolder = cloudinaryFolderForMime(req.file.mimetype);
    const folder = sanitizeCloudinarySegment(req.body.folder || fallbackFolder, fallbackFolder);
    const source = sanitizeCloudinarySegment(req.body.source || 'media-upload', 'media-upload').replace(/\//g, '-');
    const doc = await createCloudinaryAsset({
      userId,
      filename: req.file.originalname || `upload-${Date.now()}`,
      mimeType: req.file.mimetype || 'application/octet-stream',
      buffer: req.file.buffer,
      source,
      folder,
    });
    res.json({
      ok: true,
      assetId: String(doc._id),
      url: normalizeCloudinaryUrl(doc),
      secureUrl: doc.secureUrl || normalizeCloudinaryUrl(doc),
      publicId: doc.publicId,
      resourceType: doc.resourceType,
      format: doc.format,
      bytes: doc.bytes,
      folder,
      cloudinary: publicCloudinaryConfig(),
      message: 'Đã upload và lưu file trên Cloudinary.',
    });
  } catch (e) {
    res.status(500).json({ message: 'Upload Cloudinary failed', error: e.message, cloudinary: publicCloudinaryConfig() });
  }
});

app.post('/api/media/upload-remote', async (req, res) => {
  try {
    const remoteUrl = String(req.body?.url || req.body?.remoteUrl || '').trim();
    if (!/^https?:\/\//i.test(remoteUrl)) return res.status(400).json({ message: 'URL phải bắt đầu bằng http:// hoặc https://.' });
    const mimeType = String(req.body?.mimeType || '').trim() || (String(req.body?.resourceType || '').toLowerCase() === 'video' ? 'video/mp4' : 'image/jpeg');
    const fallbackFolder = cloudinaryFolderForMime(mimeType);
    const folder = sanitizeCloudinarySegment(req.body?.folder || fallbackFolder, fallbackFolder);
    const source = sanitizeCloudinarySegment(req.body?.source || 'remote-upload', 'remote-upload').replace(/\//g, '-');
    const doc = await createCloudinaryAsset({
      userId: req.body?.userId || 'guest',
      filename: req.body?.filename || path.basename(new URL(remoteUrl).pathname) || `remote-${Date.now()}`,
      mimeType,
      remoteUrl,
      source,
      folder,
    });
    res.json({
      ok: true,
      assetId: String(doc._id),
      url: normalizeCloudinaryUrl(doc),
      secureUrl: doc.secureUrl || normalizeCloudinaryUrl(doc),
      publicId: doc.publicId,
      resourceType: doc.resourceType,
      format: doc.format,
      bytes: doc.bytes,
      folder,
      cloudinary: publicCloudinaryConfig(),
      message: 'Đã copy file từ URL sang Cloudinary.',
    });
  } catch (e) {
    res.status(500).json({ message: 'Upload remote Cloudinary failed', error: e.message, cloudinary: publicCloudinaryConfig() });
  }
});

app.post('/api/admin/media/upload', upload.single('file'), async (req, res) => {
  try {
    const admin = await requireAdmin(req.body?.adminId);
    if (!admin) return res.status(403).json({ message: 'Bạn cần đăng nhập bằng tài khoản admin để upload media quản trị.' });
    if (!req.file) return res.status(400).json({ message: 'Missing file' });
    const fallbackFolder = cloudinaryFolderForMime(req.file.mimetype);
    const folder = sanitizeCloudinarySegment(req.body.folder || `admin/${fallbackFolder}`, `admin/${fallbackFolder}`);
    const source = sanitizeCloudinarySegment(req.body.source || 'admin-upload', 'admin-upload').replace(/\//g, '-');
    const doc = await createCloudinaryAsset({
      userId: String(admin._id),
      filename: req.file.originalname || `admin-upload-${Date.now()}`,
      mimeType: req.file.mimetype || 'application/octet-stream',
      buffer: req.file.buffer,
      source,
      folder,
    });
    res.json({
      ok: true,
      assetId: String(doc._id),
      url: normalizeCloudinaryUrl(doc),
      secureUrl: doc.secureUrl || normalizeCloudinaryUrl(doc),
      publicId: doc.publicId,
      resourceType: doc.resourceType,
      format: doc.format,
      bytes: doc.bytes,
      folder,
      cloudinary: publicCloudinaryConfig(),
      message: 'Admin đã upload file lên Cloudinary.',
    });
  } catch (e) {
    res.status(500).json({ message: 'Admin upload Cloudinary failed', error: e.message, cloudinary: publicCloudinaryConfig() });
  }
});


app.get('/api/vision/health', async (_, res) => {
  const emotionModel = process.env.EMOTION_MODEL_PATH || path.join('server', 'models', 'emotion_fulltrain_best_model.tflite');
  const emotionModelPath = path.resolve(process.cwd(), emotionModel);
  const h5ModelPath = path.resolve(process.cwd(), 'server', 'models', 'emotion_fulltrain_best_model.h5');
  const emotionModelReady = await fs.access(emotionModelPath).then(() => true).catch(() => false);
  const h5ModelReady = await fs.access(h5ModelPath).then(() => true).catch(() => false);
  res.json({
    ok: true,
    python: PYTHON_BIN,
    engine: 'emotion-age-file',
    emotionModel,
    emotionModelReady,
    h5ModelReady,
    endpoint: '/api/vision/style-from-media',
    note: emotionModelReady || h5ModelReady
      ? 'Emotion model file is present. Camera realtime uses frame-by-frame emotion + age analysis;'
      : 'Thiếu emotion model file. Hãy đặt model vào server/models/emotion_fulltrain_best_model.tflite hoặc .h5.'
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email và mật khẩu là bắt buộc.' });
    if (String(password).length < 6) return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' });

    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: 'Email đã tồn tại.' });

    const user = await User.create({
      fullName: name || 'JAPANO Member',
      name: name || 'JAPANO Member',
      email: normalizedEmail,
      phone,
      passwordHash: hashPassword(password),
      coins: 100,
      role: 'customer',
      status: 'active',
    });
    res.json({ user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Sai email hoặc mật khẩu.' });
    }

    if (isLegacyPasswordHash(user.passwordHash)) {
      user.passwordHash = hashPassword(password);
      await user.save().catch(() => null);
    }

    res.json({ user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (email) {
    await ForgotPassword.create({ email, token: crypto.randomBytes(24).toString('hex'), isUsed: false }).catch(() => null);
  }
  res.json({ ok: true, message: 'Đã ghi nhận yêu cầu quên mật khẩu.' });
});

app.get('/api/customers/:userId', async (req, res) => { const user = await User.findById(req.params.userId).lean().catch(() => null); res.json(user ? publicUser(user) : null); });
app.post('/api/customers', async (req, res) => { const { userId, ...patch } = req.body; const safePatch = sanitizeCustomerPatch(patch); const user = await User.findByIdAndUpdate(userId, safePatch, { new: true }).catch(() => null); res.json(user ? publicUser(user) : null); });
app.post('/api/users/:userId/settings', async (req, res) => { const user = await User.findByIdAndUpdate(req.params.userId, { settings: req.body }, { new: true }).catch(() => null); res.json(user ? publicUser(user) : { ok: false }); });

app.get('/api/users/:userId/try-on-usage', async (req, res) => {
  const user = await User.findById(req.params.userId).lean().catch(() => null);
  if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản người dùng.' });
  const publicProfile = publicUser(user);
  res.json({
    user: publicProfile,
    tryOnUsed: publicProfile.tryOnUsed,
    tryOnLimit: FREE_TRY_ON_LIMIT,
    tryOnRemaining: publicProfile.tryOnRemaining,
    vip: publicProfile.vip,
    vipPrice: VIP_PRICE,
  });
});

app.post('/api/vip/upgrade', async (req, res) => {
  try {
    const userId = req.body.userId || req.body.id;
    if (!userId || userId === 'guest') return res.status(401).json({ message: 'Bạn cần đăng nhập để nâng cấp VIP.' });
    if (process.env.ALLOW_DEMO_VIP_UPGRADE === 'true' && !req.body.paymentIntentId) {
      const membership = { tier: 'vip', price: VIP_PRICE, currency: 'VND', upgradedAt: new Date().toISOString(), source: 'demo-vip-upgrade' };
      const user = await User.findByIdAndUpdate(userId, { membership, vip: true }, { new: true }).catch(() => null);
      if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản người dùng.' });
      return res.json({ ok: true, vipPrice: VIP_PRICE, user: publicUser(user), demo: true });
    }
    const result = await finalizeVipUpgrade({ userId, paymentIntentId: req.body.paymentIntentId, paymentMethod: req.body.paymentMethod || 'stripe' });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

app.get('/api/stripe/config', (req, res) => {
  res.json({
    enabled: stripeEnabled(),
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    merchantDisplayName: STRIPE_MERCHANT_DISPLAY_NAME,
    currency: STRIPE_CURRENCY,
    vipPrice: VIP_PRICE,
    keyMode: STRIPE_SECRET_KEY.startsWith('rk_') ? 'restricted' : (STRIPE_SECRET_KEY.startsWith('sk_') ? 'secret' : 'missing'),
  });
});

app.post('/api/stripe/payment-sheet', async (req, res) => {
  try {
    const result = await createStripePaymentSheet({
      userId: req.body.userId,
      amount: req.body.amount,
      purpose: req.body.purpose || 'checkout',
      currency: req.body.currency || STRIPE_CURRENCY,
      items: req.body.items || [],
      metadata: req.body.metadata || {},
    });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

app.post('/api/stripe/confirm-vip', async (req, res) => {
  try {
    const result = await finalizeVipUpgrade({ userId: req.body.userId, paymentIntentId: req.body.paymentIntentId, paymentMethod: 'stripe' });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

app.post('/api/stripe/confirm-order', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId || userId === 'guest') return res.status(401).json({ message: 'Bạn cần đăng nhập để xác nhận thanh toán.' });
    await requireSucceededStripePayment({ userId, paymentIntentId: req.body.paymentIntentId, purpose: 'checkout', expectedAmount: req.body.total });
    const existing = await Order.findOne({ stripePaymentIntentId: req.body.paymentIntentId }).catch(() => null);
    if (existing) return res.json({ ok: true, order: await orderWithItems(existing) });
    const order = await createOrderWithItems({
      userId,
      items: Array.isArray(req.body.items) ? req.body.items : [],
      total: Number(req.body.total || 0),
      status: 'paid',
      paymentMethod: 'stripe',
      shippingAddress: req.body.shippingAddress || '',
      type: 'product-order',
      stripePaymentIntentId: req.body.paymentIntentId,
      paymentStatus: 'paid',
      checkoutMeta: req.body.checkoutMeta || {},
      statusTimeline: [{ status: 'paid', at: new Date(), note: 'Đã thanh toán bằng Stripe PaymentSheet.' }],
    });
    res.json({ ok: true, order });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

app.post('/payment-sheet', async (req, res) => {
  try {
    const result = await createStripePaymentSheet({
      userId: req.body.userId,
      amount: req.body.amount,
      purpose: req.body.purpose || 'checkout',
      currency: req.body.currency || STRIPE_CURRENCY,
      items: req.body.items || [],
      metadata: req.body.metadata || {},
    });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

app.post('/save-payment', async (req, res) => {
  try {
    const intent = await requireSucceededStripePayment({
      userId: req.body.userId,
      paymentIntentId: req.body.paymentIntentId,
      purpose: req.body.purpose || undefined,
    });
    res.json({ success: true, status: intent.status, paymentIntentId: intent.id });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
});



app.get('/api/recommendations/home', async (req, res) => {
  try {
    const { userId = 'guest', occasionKey = '' } = req.query;
    const [products, user, recentSearches, wishlist] = await Promise.all([
      Product.find().limit(240).lean().catch(() => []),
      String(userId) !== 'guest' ? User.findById(userId).lean().catch(() => null) : null,
      String(userId) !== 'guest' ? SearchHistory.find({ userId }).sort({ createdAt: -1 }).limit(10).lean().catch(() => []) : [],
      String(userId) !== 'guest' ? Wishlist.find({ userId }).lean().catch(() => []) : [],
    ]);
    const contextQuery = [occasionKey, user?.birthday ? 'sinh nhật' : '', ...(recentSearches || []).map((x) => x.term)].filter(Boolean).join(' ');
    const ranked = rankProductsForQuery(contextQuery || 'hôm nay mặc gì mua quà', products, String(occasionKey));
    const hero = ranked.slice(0, 6).map((x) => x.product);
    const wishlistIds = new Set((Array.isArray(wishlist) ? wishlist.map((x) => x.productId || x.productSnapshot?.id) : (wishlist?.items || []).map((x) => x.id)).filter(Boolean));
    const forYou = ranked.filter((x) => !wishlistIds.has(x.product.id)).slice(0, 12).map((x) => x.product);
    res.json({
      occasionKey,
      campaignTitle: occasionKey ? `Gợi ý theo dịp ${occasionKey}` : 'Gợi ý thông minh hôm nay',
      campaignSubtitle: 'AI kết hợp lịch, tìm kiếm gần đây, wishlist và sản phẩm đang bán để đề xuất.',
      hero,
      rails: [
        { id: 'for-you', title: 'Dành cho bạn', items: forYou },
        { id: 'wishlist-adjacent', title: 'Hợp với mục yêu thích', items: ranked.filter((x) => wishlistIds.has(x.product.id)).map((x) => x.product).slice(0, 8) },
      ],
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/search/suggest', async (req, res) => {
  try {
    const { q = '', userId = 'guest', occasionKey = '' } = req.body || {};
    const products = await Product.find().limit(240).lean().catch(() => []);
    let suggestions = buildLocalSearchSuggestionsFromProducts(q, products, occasionKey);

    const looksConversational = /(mặc gì|mac gi|phối|phoi|outfit|hôm nay|hom nay|đi chơi|di choi|quà|qua|ngày lễ|ngay le|tết|tet|noel)/i.test(String(q));
    if (looksConversational && GEMINI_API_KEY) {
      const aiJson = await callGeminiText(`Bạn là AI search assistant cho shop JAPANO. Trả về JSON hợp lệ, không markdown. Người dùng nhập: "${q}". Sản phẩm có trong catalog: ${JSON.stringify(products.slice(0, 60)).slice(0, 7000)}. Hãy tạo tối đa 5 gợi ý ngắn gồm: title, subtitle, query, productIds. Chỉ gợi ý nội dung mua sắm, phối đồ, quà tặng, dịp lễ.`);
      try {
        const parsed = JSON.parse(String(aiJson || '{}'));
        const arr = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
        const aiSuggestions = arr.slice(0, 5).map((item, index) => ({
          id: `gemini-${index}`,
          type: 'ai',
          title: item.title || item.query || 'AI gợi ý mua sắm',
          subtitle: item.subtitle || 'Gợi ý theo ngữ cảnh và dịp đặc biệt',
          query: item.query || q,
        }));
        suggestions = [...aiSuggestions, ...suggestions].slice(0, 10);
      } catch {}
    }

    if (userId && q) await SearchHistory.create({ userId, term: q }).catch(() => null);
    res.json({ query: q, suggestions, source: suggestions.some((s) => s.id?.startsWith('gemini')) ? 'gemini+mongo' : 'mongo-local' });
  } catch (e) {
    res.status(500).json({ message: e.message, suggestions: [] });
  }
});

app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
  try {
    const userId = req.body.userId || 'guest';
    if (!req.file) return res.status(400).json({ message: 'Missing file' });
    const doc = await createCloudinaryAsset({
      userId,
      filename: req.file.originalname || `chat-file-${Date.now()}`,
      mimeType: req.file.mimetype || 'application/octet-stream',
      buffer: req.file.buffer,
      source: 'chat-upload',
      folder: 'chat',
    });
    res.json({
      message: 'Tôi đã nhận file và đã lưu trên Cloudinary. Bạn có thể hỏi tôi phối đồ hoặc tư vấn sản phẩm dựa trên file này.',
      assetId: String(doc._id),
      url: normalizeCloudinaryUrl(doc),
      cloudinaryPublicId: doc.publicId,
    });
  } catch (e) {
    res.status(500).json({ message: 'Upload Cloudinary failed', error: e.message });
  }
});

async function handleVisionStyleFromMedia(req, res) {
  const userId = req.body.userId || 'guest';
  const productId = req.body.productId || '';
  const file = req.file || (Array.isArray(req.files) ? req.files[0] : null);
  if (!file) return res.status(400).json({ message: 'Missing image/video file' });
  const mime = file.mimetype || 'application/octet-stream';
  const mediaKind = String(req.body.mediaKind || (mime.startsWith('video/') ? 'video' : 'image')).toLowerCase() === 'video' ? 'video' : 'image';
  const ext = path.extname(file.originalname || '') || (mediaKind === 'video' ? '.mp4' : '.jpg');
  const tmpPath = path.join(os.tmpdir(), `japano-vision-${mediaKind}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  try {
    await fs.writeFile(tmpPath, file.buffer);
    const asset = await createCloudinaryAsset({
      userId,
      filename: file.originalname || (mediaKind === 'video' ? 'vision-video.mp4' : 'vision-image.jpg'),
      mimeType: mime,
      buffer: file.buffer,
      source: `vision-${mediaKind}`,
      folder: mediaKind === 'video' ? 'vision/videos' : 'vision/images',
    });
    let analysis = null;
    try {
      analysis = await analyzeMediaWithLocalVisionModel(tmpPath, mediaKind);
    } catch (e) {
      analysis = {
        ok: false,
        mediaType: mediaKind,
        durationMs: 0,
        detector: { available: false, faceCount: 0, personCount: 0, warning: e.message },
        face: { available: false, faces: [], primaryEmotion: 'neutral', ageGroup: 'unknown', warning: e.message },
        video: mediaKind === 'video' ? { framesAnalyzed: 0, warning: e.message } : undefined,
        visualTags: [],
        warning: e.message,
      };
    }

    const [baseProduct, allProducts] = await Promise.all([
      productId ? Product.findOne({ id: productId }).lean().catch(() => null) : null,
      Product.find().limit(240).lean().catch(() => []),
    ]);
    let recommendation = buildVisionRecommendation({ baseProduct, products: allProducts, analysis });

    if (GEMINI_API_KEY) {
      const geminiText = await callGeminiText(`Bạn là AI stylist bán hàng JAPANO. Dựa trên kết quả model file cảm xúc + model tuổi từ ${mediaKind === 'video' ? 'video' : 'ảnh'} sau, hãy viết lý do tư vấn ngắn gọn bằng tiếng Việt, không nói ngoài mua sắm. Dữ liệu phân tích: ${JSON.stringify({ analysis, baseProduct, productNames: recommendation.products.map((p) => p.name).slice(0, 8) }).slice(0, 8000)}`);
      if (geminiText) recommendation.reason = geminiText;
    }

    const saved = await VisionAnalysis.create({ userId, productId, assetId: String(asset._id), analysis, recommendation });
    res.json({
      analysisId: String(saved._id),
      assetId: String(asset._id),
      imageUrl: mediaKind === 'image' ? normalizeCloudinaryUrl(asset) : null,
      fileUrl: normalizeCloudinaryUrl(asset),
      mediaType: mediaKind,
      analysis,
      recommendation,
      message: mediaKind === 'video'
        ? 'Đã tách frame từ video, phân tích emotion/age model và tạo gợi ý phối đồ phù hợp.'
        : 'Đã phân tích ảnh bằng emotion/age model file và tạo gợi ý phối đồ phù hợp.',
    });
  } catch (e) {
    res.status(500).json({ message: friendlyVisionError(e) });
  } finally {
    await fs.unlink(tmpPath).catch(() => null);
  }
}

app.post('/api/vision/style-from-media', upload.any(), handleVisionStyleFromMedia);
app.post('/api/vision/style-from-image', upload.single('image'), (req, res) => {
  if (req.file) req.files = [req.file];
  req.body.mediaKind = 'image';
  return handleVisionStyleFromMedia(req, res);
});

app.get('/api/vision/history/:userId', async (req, res) => {
  const items = await VisionAnalysis.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(50).lean();
  res.json(items);
});
app.get('/api/assets/:id', async (req, res) => {
  try {
    const doc = await FileAsset.findById(req.params.id).lean();
    if (!doc) return res.status(404).send('Not found');
    const url = normalizeCloudinaryUrl(doc);
    if (url) return res.redirect(url);
    if (doc.data) {
      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      return res.send(doc.data);
    }
    return res.status(404).send('Asset has no Cloudinary URL');
  } catch {
    res.status(404).send('Not found');
  }
});


async function getTryOnAccess(userId = 'guest') {
  if (!userId || userId === 'guest') {
    return { ok: false, status: 401, message: 'Bạn cần đăng nhập để dùng 2 lượt thử đồ miễn phí và nâng cấp VIP.', upgradeRequired: false };
  }
  const user = await User.findById(userId).lean().catch(() => null);
  if (!user) return { ok: false, status: 404, message: 'Không tìm thấy tài khoản người dùng.' };
  const vipActive = isVipUser(user);
  const tryOnUsed = Number(user.tryOnUsed || 0);
  if (!vipActive && tryOnUsed >= FREE_TRY_ON_LIMIT) {
    return {
      ok: false,
      status: 402,
      message: `Bạn đã dùng hết ${FREE_TRY_ON_LIMIT} lượt thử đồ miễn phí. Hãy nâng cấp VIP ${VIP_PRICE.toLocaleString('vi-VN')}đ để thử không giới hạn.`,
      upgradeRequired: true,
      vipPrice: VIP_PRICE,
      usage: { tryOnUsed, tryOnLimit: FREE_TRY_ON_LIMIT, tryOnRemaining: 0, vip: false },
    };
  }
  return { ok: true, user, vip: vipActive, usage: { tryOnUsed, tryOnLimit: FREE_TRY_ON_LIMIT, tryOnRemaining: vipActive ? null : Math.max(0, FREE_TRY_ON_LIMIT - tryOnUsed), vip: vipActive } };
}

async function consumeTryOnUse(userId = 'guest') {
  if (!userId || userId === 'guest') return null;
  const user = await User.findById(userId).catch(() => null);
  if (!user) return null;
  const vipActive = isVipUser(user);
  if (!vipActive) user.tryOnUsed = Number(user.tryOnUsed || 0) + 1;
  await user.save().catch(() => null);
  return publicUser(user);
}


app.post('/api/try-on/generate', upload.single('file'), async (req, res) => {
  try {
    const userId = req.body.userId || 'guest';
    const access = await getTryOnAccess(userId);
    if (!access.ok) return res.status(access.status || 403).json(access);
    const productId = req.body.productId || '';
    const comboTitle = req.body.comboTitle || '';
    const productIds = parseProductIds(req.body.productIds || (productId ? [productId] : []));
    if (!productIds.length) return res.status(400).json({ message: 'Thiếu productIds để tạo ảnh thử đồ.' });

    const source = await resolveTryOnSourceImage(req);
    const sourceAsset = await createCloudinaryAsset({
      userId,
      filename: source.filename,
      mimeType: source.mimeType,
      buffer: source.buffer,
      source: `tryon-${source.source}`,
      folder: 'try-on/source',
    });
    const sourceImageUrl = normalizeCloudinaryUrl(sourceAsset);

    const foundProducts = await Product.find({ id: { $in: productIds } }).limit(20).lean().catch(() => []);
    const selectedProducts = orderProductsByIds(foundProducts, productIds);
    if (!selectedProducts.length) return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong database. Hãy mở app để seed catalog hoặc chạy lại backend.' });

    const prompt = tryOnPrompt({ products: selectedProducts, comboTitle });
    const content = [
      { type: 'text', text: prompt },
      { type: 'image_url', url: sourceImageUrl, role: 'smart_reference' },
      ...selectedProducts
        .map((p) => String(p.image || '').trim())
        .filter((url) => /^https?:\/\//i.test(url))
        .slice(0, 6)
        .map((url) => ({ type: 'image_url', url, role: 'smart_reference' })),
    ];

    const demoTryOnResponse = (reason = '') => res.json({
      ok: true,
      demo: true,
      provider: 'demo-fallback',
      taskId: null,
      sourceAssetId: String(sourceAsset._id),
      imageUrl: sourceImageUrl,
      sourceImageUrl,
      products: selectedProducts,
      prompt,
      usage: access.usage,
      message: `${reason || 'AI tạo ảnh đang chưa sẵn sàng.'} Demo Mode đang hiển thị lại ảnh gốc để luồng thử đồ không bị văng lỗi. Khi Fotor hoạt động, ảnh kết quả thật sẽ thay thế ảnh demo.`,
    });

    if (!FOTOR_API_KEY && DEMO_MODE) {
      return demoTryOnResponse('Backend chưa cấu hình FOTOR_API_KEY.');
    }

    try {
      const taskId = await startFotorImageGeneration({ content, width: FOTOR_TRYON_WIDTH, height: FOTOR_TRYON_HEIGHT });
      const fotorResult = await waitForFotorImages(taskId);

      if (fotorResult.pending && !fotorResult.urls.length) {
        return res.status(202).json({
          ok: true,
          pending: true,
          provider: `fotor:${FOTOR_PROVIDER}`,
          taskId,
          sourceAssetId: String(sourceAsset._id),
          sourceImageUrl,
          products: selectedProducts,
          prompt,
          message: 'Fotor đã nhận task thử đồ nhưng chưa trả ảnh xong. Ảnh nguồn vẫn được giữ lại; hãy bấm tạo lại sau ít phút.',
        });
      }

      const fotorImageUrl = fotorResult.urls[0];
      if (!fotorImageUrl) throw new Error('Fotor hoàn tất nhưng chưa có URL ảnh kết quả.');

      const generatedAsset = await createCloudinaryAsset({
        userId,
        filename: `fotor-tryon-result-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        remoteUrl: fotorImageUrl,
        source: 'fotor-tryon-result',
        folder: 'try-on/results',
        provider: `fotor:${FOTOR_PROVIDER}`,
        extra: { productIds, sourceAssetId: String(sourceAsset._id), fotorTaskId: taskId, fotorOriginalUrl: fotorImageUrl },
      });

      const imageUrl = normalizeCloudinaryUrl(generatedAsset);
      await GeneratedImage.create({ userId, url: imageUrl, prompt, provider: `fotor:${FOTOR_PROVIDER}`, taskId, sourceAssetId: String(sourceAsset._id), productIds }).catch(() => null);
      const updatedUser = await consumeTryOnUse(userId);

      return res.json({
        ok: true,
        provider: `fotor:${FOTOR_PROVIDER}`,
        taskId,
        imageAssetId: String(generatedAsset._id),
        sourceAssetId: String(sourceAsset._id),
        imageUrl,
        sourceImageUrl,
        products: selectedProducts,
        prompt,
        usage: updatedUser ? { tryOnUsed: updatedUser.tryOnUsed, tryOnLimit: updatedUser.tryOnLimit, tryOnRemaining: updatedUser.tryOnRemaining, vip: updatedUser.vip, membership: updatedUser.membership } : access.usage,
        user: updatedUser,
        message: 'Fotor đã tạo ảnh thử đồ và kết quả đã được lưu lên Cloudinary.',
      });
    } catch (e) {
      if (DEMO_MODE) return demoTryOnResponse(friendlyAiServiceError(e, 'Fotor chưa tạo được ảnh thật.'));
      throw e;
    }
  } catch (e) {
    res.status(500).json({ message: friendlyAiServiceError(e, 'Không thể tạo ảnh thử đồ bằng Fotor.') });
  }
});


app.get('/api/stylist-profile/:userId', async (req, res) => {
  const userId = req.params.userId;
  const [profile, body] = await Promise.all([
    StylistProfile.findOne({ userId }).lean().catch(() => null),
    BodyProfile.findOne({ userId }).lean().catch(() => null),
  ]);
  res.json({ profile, bodyProfile: body });
});

app.post('/api/stylist-profile/:userId', async (req, res) => {
  const userId = req.params.userId;
  const body = { ...req.body, userId };
  const profile = await StylistProfile.findOneAndUpdate({ userId }, body, { upsert: true, new: true }).lean();
  res.json({ ok: true, profile });
});

app.get('/api/body-profile/:userId', async (req, res) => {
  const userId = req.params.userId;
  const bodyProfile = await BodyProfile.findOne({ userId }).lean().catch(() => null);
  res.json({ bodyProfile });
});

app.post('/api/body-profile/:userId', async (req, res) => {
  const userId = req.params.userId;
  const bodyProfile = await BodyProfile.findOneAndUpdate({ userId }, { ...req.body, userId }, { upsert: true, new: true }).lean();
  res.json({ ok: true, bodyProfile });
});

app.get('/api/stylist-daily-quiz/:userId', async (req, res) => {
  const userId = req.params.userId;
  const dateKey = String(req.query.dateKey || todayKey());
  const quiz = await DailyStylistQuiz.findOne({ userId, dateKey }).lean().catch(() => null);
  const profile = await StylistProfile.findOne({ userId }).lean().catch(() => null);
  res.json({ dateKey, done: Boolean(quiz), quiz, profile });
});

app.post('/api/stylist-daily-quiz/:userId', async (req, res) => {
  const userId = req.params.userId;
  const dateKey = String(req.body.dateKey || todayKey());
  const answers = req.body.answers || req.body || {};
  const profilePatch = {
    gender: answers.gender || answers.sex,
    preferredStyles: Array.isArray(answers.preferredStyles) ? answers.preferredStyles : String(answers.preferredStyles || '').split(',').map((x)=>x.trim()).filter(Boolean),
    heightCm: Number(answers.heightCm || 0) || undefined,
    weightKg: Number(answers.weightKg || 0) || undefined,
    skinTone: answers.skinTone || '',
    occasion: answers.occasion || '',
    budget: Number(answers.budget || 0) || undefined,
    colorLikes: Array.isArray(answers.colorLikes) ? answers.colorLikes : String(answers.colorLikes || '').split(',').map((x)=>x.trim()).filter(Boolean),
    lastQuizDate: dateKey,
    source: 'daily-quiz',
  };
  const quiz = await DailyStylistQuiz.findOneAndUpdate({ userId, dateKey }, { userId, dateKey, answers, profilePatch }, { upsert: true, new: true }).lean();
  const profile = await StylistProfile.findOneAndUpdate({ userId }, { $set: profilePatch }, { upsert: true, new: true }).lean();
  if (profilePatch.heightCm || profilePatch.weightKg) {
    await BodyProfile.findOneAndUpdate({ userId }, { $set: { userId, heightCm: profilePatch.heightCm, weightKg: profilePatch.weightKg } }, { upsert: true }).catch(() => null);
  }
  res.json({ ok: true, quiz, profile });
});

app.post('/api/ai-stylist/suggest', async (req, res) => {
  try {
    const userId = req.body.userId || 'guest';
    const [profile, bodyProfile, catalog] = await Promise.all([
      StylistProfile.findOne({ userId }).lean().catch(() => null),
      BodyProfile.findOne({ userId }).lean().catch(() => null),
      Product.find().limit(240).lean().catch(() => []),
    ]);
    const mergedProfile = { ...(profile || {}), ...(req.body.profile || {}) };
    const mergedBody = { ...(bodyProfile || {}), ...(req.body.bodyProfile || {}) };
    let sets = buildStylistSets({ products: catalog, profile: mergedProfile, body: mergedBody });
    let summary = 'AI Stylist đã tạo set dựa trên quiz hằng ngày, số đo cơ thể, màu da, dịp mặc và ngân sách.';
    if (GEMINI_API_KEY) {
      const ai = await callGeminiText(`Bạn là AI Stylist của JAPANO. Dựa trên profile ${JSON.stringify(mergedProfile)} và body ${JSON.stringify(mergedBody)}, hãy viết 1 đoạn tư vấn ngắn tiếng Việt. Không nói ngoài mua sắm. Các set đã chọn: ${JSON.stringify(sets).slice(0, 9000)}`);
      if (ai) summary = ai;
    }
    res.json({ ok: true, profile: mergedProfile, bodyProfile: mergedBody, summary, sets });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/tryon-history/:userId', async (req, res) => {
  const userId = req.params.userId;
  const [images, sourceAssets] = await Promise.all([
    GeneratedImage.find({ userId }).sort({ createdAt: -1 }).limit(80).lean().catch(() => []),
    FileAsset.find({ userId, source: /tryon-|vision-/ }).sort({ createdAt: -1 }).limit(80).lean().catch(() => []),
  ]);
  const assetsById = new Map(sourceAssets.map((asset) => [String(asset._id), asset]));
  const history = images.map((img) => {
    const source = assetsById.get(String(img.sourceAssetId || '')) || null;
    return {
      id: String(img._id || img.id || img.url),
      url: img.url,
      resultUrl: img.url,
      sourceUrl: source ? normalizeCloudinaryUrl(source) : '',
      prompt: img.prompt || '',
      provider: img.provider || '',
      productIds: img.productIds || [],
      createdAt: img.createdAt,
    };
  });
  res.json({ history });
});

app.get('/api/outfit-collections/:userId', async (req, res) => {
  const items = await OutfitCollection.find({ userId: req.params.userId }).sort({ updatedAt: -1 }).limit(100).lean();
  res.json({ collections: items });
});

app.post('/api/outfit-collections/:userId', async (req, res) => {
  const userId = req.params.userId;
  const id = req.body.id || req.body._id;
  const patch = {
    userId,
    title: req.body.title || 'Bộ sưu tập outfit',
    description: req.body.description || '',
    occasion: req.body.occasion || '',
    items: Array.isArray(req.body.items) ? req.body.items : [],
    cover: req.body.cover || req.body.items?.[0]?.image || '',
  };
  const saved = id
    ? await OutfitCollection.findOneAndUpdate({ _id: id, userId }, patch, { new: true }).lean()
    : await OutfitCollection.create(patch);
  res.json({ ok: true, collection: saved });
});

app.delete('/api/outfit-collections/:userId/:id', async (req, res) => {
  await OutfitCollection.deleteOne({ userId: req.params.userId, _id: req.params.id }).catch(() => null);
  res.json({ ok: true });
});

app.get('/api/products/:id/size-advice', async (req, res) => {
  const product = await Product.findOne({ id: req.params.id }).lean().catch(() => null);
  const body = await BodyProfile.findOne({ userId: req.query.userId || 'guest' }).lean().catch(() => null);
  res.json({ product, bodyProfile: body, advice: sizeAdviceForProduct(product || {}, body || {}) });
});

app.post('/api/chat', async (req, res) => {
  const {
    userId = 'guest',
    message = '',
    hasRecentImage = false,
    occasionKey = '',
    visionAnalysis = null,
    visionRecommendation = null,
    history = [],
  } = req.body;
  if (!message.trim()) return res.status(400).json({ message: 'message is required' });

  const latestVision = visionAnalysis
    ? { analysis: visionAnalysis, recommendation: visionRecommendation || null }
    : await VisionAnalysis.findOne({ userId }).sort({ createdAt: -1 }).lean().catch(() => null);

  const hasVisionContext = Boolean(latestVision?.analysis);
  if (!isStoreRelated(message, hasRecentImage || hasVisionContext)) {
    return res.json({ message: refusal() });
  }

  const products = await Product.find().limit(120).lean().catch(() => []);
  const [stylistProfile, bodyProfile, outfitCollections] = await Promise.all([
    StylistProfile.findOne({ userId }).lean().catch(() => null),
    BodyProfile.findOne({ userId }).lean().catch(() => null),
    OutfitCollection.find({ userId }).sort({ updatedAt: -1 }).limit(12).lean().catch(() => []),
  ]);
  const profilePrompt = `

HỒ SƠ AI STYLIST CÁ NHÂN:
${JSON.stringify({ stylistProfile, bodyProfile, outfitCollections: (outfitCollections || []).map((c) => ({ title: c.title, occasion: c.occasion, itemNames: (c.items || []).map((p) => p.name).slice(0, 8) })) }).slice(0, 5000)}

Khi tư vấn, hãy dùng số đo để gợi ý size, dùng quiz hằng ngày để chọn dịp/phong cách, và nếu hợp thì nhắc người dùng lưu vào Bộ sưu tập outfit.`;
  let answer = null;
  let productIds = [];

  if (latestVision?.recommendation?.products?.length) {
    productIds = latestVision.recommendation.products
      .map((p) => String(p.id || p._id || ''))
      .filter(Boolean)
      .slice(0, 8);
  }

  if (!productIds.length && latestVision?.analysis) {
    const rec = buildVisionRecommendation({ baseProduct: null, products, analysis: latestVision.analysis });
    productIds = (rec.products || []).map((p) => String(p.id || p._id || '')).filter(Boolean).slice(0, 8);
  }

  const safeHistory = Array.isArray(history)
    ? history.slice(-20).map((m) => `${m.role === 'assistant' || m.role === 'bot' ? 'Assistant' : 'User'}: ${String(m.text || m.content || '').slice(0, 500)}`).join('\n')
    : '';
  const memoryPrompt = safeHistory ? `\n\nNGỮ CẢNH CHAT GẦN NHẤT, tối đa 10 lượt hỏi/đáp, chỉ dùng trong phiên hiện tại và không lưu DB:\n${safeHistory}` : '';

  let geminiVisionBrief = '';
  if (latestVision?.analysis && GEMINI_API_KEY) {
    const face = latestVision.analysis.face || {};
    const detector = latestVision.analysis.detector || {};
    const visionFacts = {
      mediaType: latestVision.analysis.mediaType,
      engine: latestVision.analysis.engine || 'emotion-age-file',
      faceCount: Number(detector.faceCount || detector.personCount || 0),
      face: {
        ageGroup: face.ageGroup || 'unknown',
        ageEstimate: face.ageEstimate || null,
        primaryEmotion: face.primaryEmotion || 'neutral',
        emotionConfidence: face.emotionConfidence || null,
        emotionScores: face.emotionScores || {},
        faces: (face.faces || []).slice(0, 3),
      },
      visualTags: latestVision.analysis.visualTags || [],
      recommendation: latestVision.recommendation || null,
      selectedProductIds: productIds,
    };
    geminiVisionBrief = await callGeminiText(`Bạn là Gemini stylist evaluator cho chatbot bán hàng JAPANO. Dựa trên kết quả emotion/age model file sau, hãy viết một đánh giá ngắn bằng tiếng Việt để Ollama dùng tiếp. Không đoán nhạy cảm, không khẳng định danh tính. Tập trung: biểu cảm, nhóm tuổi ước lượng, màu/form/phụ kiện nên gợi ý, sản phẩm phù hợp. Câu hỏi người dùng: "${message}". Sản phẩm có thể chọn: ${JSON.stringify(products.slice(0, 60)).slice(0, 9000)}. Kết quả vision: ${JSON.stringify(visionFacts).slice(0, 8000)}`) || '';
  }

  if (!latestVision?.analysis && hasRecentImage) {
    const recentFile = await FileAsset.findOne({ userId, mimeType: /^image\// }).sort({ createdAt: -1 });
    answer = await callGeminiVision({ text: message, file: recentFile });
  }

  if (!answer) {
    const visionPrompt = latestVision?.analysis
      ? `\n\nKẾT QUẢ VISION AI GẦN NHẤT CỦA NGƯỜI DÙNG:\n${JSON.stringify({ analysis: latestVision.analysis, recommendation: latestVision.recommendation }, null, 0).slice(0, 7000)}\n\nĐÁNH GIÁ TỪ GEMINI DỰA TRÊN emotion/age model/DEEPFACE:\n${geminiVisionBrief || 'Gemini chưa phản hồi, hãy tự dùng dữ liệu emotion/age model phía trên.'}\n\nYêu cầu bắt buộc: nếu người dùng gửi ảnh/video hoặc hỏi phối đồ, phải nói rõ model file nhận diện cảm xúc gì, nhóm tuổi ước lượng gì, rồi mới gợi ý outfit/sản phẩm. Không nói rằng không có ảnh nếu đã có vision context.`
      : '';

    const prompt = `Bạn là trợ lý bán hàng JAPANO chạy bằng Ollama. Chỉ trả lời về mua sắm, sản phẩm, dịch vụ, đơn hàng, giỏ hàng, thanh toán, xu, trò chơi, thẻ bài, thời trang, phối đồ, thử đồ và tạo ảnh. Nếu tư vấn phối đồ hãy trả lời cụ thể theo: tuổi ước lượng, biểu cảm, màu sắc, form đồ, phụ kiện và sản phẩm có thể mua. Giọng thân thiện, ngắn gọn nhưng đủ ý. Sản phẩm trong DB: ${JSON.stringify(products).slice(0, 12000)}. Dịp đặc biệt đang ưu tiên (nếu có): ${occasionKey}.${memoryPrompt}${profilePrompt}${visionPrompt}\n\nCâu hỏi hiện tại: ${message}`;
    answer = await callOllama(prompt);
  }

  if (!answer && geminiVisionBrief) {
    answer = `${geminiVisionBrief}\n\nGợi ý nhanh: ưu tiên outfit tông kem/navy/nâu, form gọn, thêm phụ kiện nhỏ như túi canvas/kẹp tóc/đạo cụ cosplay nếu bạn muốn nổi bật. Bạn có thể hỏi tiếp: “phối thành 1 set hoàn chỉnh cho tôi”.`;
  }

  if (!answer) {
    const local = buildLocalChatAnswer({ message, products, productIds, latestVision, occasionKey });
    answer = local.message;
    if (!productIds.length && Array.isArray(local.productIds)) productIds = local.productIds;
  }

  res.json({ message: answer, productIds });
});

app.post('/api/chat/create-image', async (req, res) => {
  const { userId = 'guest', prompt = '', occasionKey = '' } = req.body;
  if (!prompt.trim()) return res.status(400).json({ message: 'prompt is required' });
  try {
    const enhanced = await callGeminiText(`Bạn là AI prompt stylist của JAPANO. Viết lại prompt tạo ảnh thương mại điện tử ngắn gọn, đẹp, có yếu tố Nhật cổ, không thêm chữ trong ảnh. Dịp đặc biệt nếu có: ${occasionKey}. Prompt gốc: ${prompt}`);
    const finalPrompt = `${enhanced || prompt}. JAPANO ecommerce fashion lookbook, clean premium product visual, antique Japanese color palette, no text, no watermark, mobile commerce hero image.`;
    const taskId = await startFotorImageGeneration({
      content: [{ type: 'text', text: finalPrompt }],
      width: 1024,
      height: 1024,
    });
    const fotorResult = await waitForFotorImages(taskId, { attempts: 18, delayMs: 3500 });
    if (fotorResult.pending && !fotorResult.urls.length) {
      return res.status(202).json({
        message: 'Fotor đã nhận yêu cầu tạo ảnh nhưng chưa xử lý xong. Hãy thử lại sau ít phút.',
        taskId,
        images: [],
        provider: `fotor:${FOTOR_PROVIDER}`,
        prompt: finalPrompt,
      });
    }
    const uploadedImages = [];
    for (const [index, url] of fotorResult.urls.slice(0, 4).entries()) {
      const asset = await createCloudinaryAsset({
        userId,
        filename: `fotor-chat-image-${Date.now()}-${index}.jpg`,
        mimeType: 'image/jpeg',
        remoteUrl: url,
        source: 'fotor-chat-image',
        folder: 'chat/generated',
        provider: `fotor:${FOTOR_PROVIDER}`,
        extra: { fotorTaskId: taskId, fotorOriginalUrl: url },
      });
      const cloudUrl = normalizeCloudinaryUrl(asset);
      await GeneratedImage.create({ userId, url: cloudUrl, prompt: finalPrompt, provider: `fotor:${FOTOR_PROVIDER}`, taskId }).catch(() => null);
      uploadedImages.push({ url: cloudUrl, assetId: String(asset._id) });
    }
    res.json({
      message: 'Fotor đã tạo ảnh và Cloudinary đã lưu kết quả.',
      taskId,
      images: uploadedImages,
      provider: `fotor:${FOTOR_PROVIDER}`,
      prompt: finalPrompt,
    });
  } catch (e) {
    const msg = friendlyAiServiceError(e, 'Không thể tạo ảnh bằng Fotor.');
    if (DEMO_MODE) {
      return res.json({
        demo: true,
        images: [],
        provider: 'demo-fallback',
        prompt,
        message: `${msg} JAPANO vẫn giữ cuộc chat hoạt động; hãy thêm Fotor credit/API đúng để tạo ảnh thật.`,
      });
    }
    res.status(400).json({ message: msg, images: [] });
  }
});

app.get('/api/generated-images/:userId', async (req, res) => res.json(await GeneratedImage.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(80).lean()));
app.post('/api/generated-images', async (req, res) => res.json(await GeneratedImage.create(req.body)));

app.get('/api/products/:id/style-suggestions', async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id }).lean() || await Product.findById(req.params.id).lean().catch(() => null);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
    const allProducts = await Product.find().limit(120).lean();
    const fallback = buildFallbackStyleSuggestions(product, allProducts);
    let summary = '';

    if (GEMINI_API_KEY) {
      const prompt = `Bạn là AI stylist của JAPANO. Hãy phân tích sản phẩm chính dựa trên ảnh, mô tả, màu sắc, form, tag thị giác và các sản phẩm đi kèm trong database. Chỉ trả lời bằng tiếng Việt. Không nói ngoài mua sắm.\n\nSẢN PHẨM CHÍNH:\n${JSON.stringify(product)}\n\nẢNH SẢN PHẨM CHÍNH: ${product.image}\n\nSẢN PHẨM CÓ THỂ PHỐI KÈM:\n${JSON.stringify(allProducts.slice(0, 80)).slice(0, 9000)}\n\nYêu cầu: viết 1 đoạn summary ngắn 2-3 câu giải thích vì sao nên phối/mua kèm các món trong gợi ý. Tập trung vào hình ảnh, màu sắc, form đồ, công năng và dịp sử dụng.`;
      summary = await callGeminiText(prompt) || '';
    }

    if (!summary) {
      summary = `AI đã dùng ảnh, màu sắc, form và câu chuyện của ${product.name} để chọn các món đi kèm. Gợi ý ưu tiên đồ có cùng tông thị giác, dễ mua chung và có lý do sử dụng rõ ràng.`;
    }

    res.json({ summary, suggestions: fallback });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/products', async (_, res) => res.json(await Product.find({ status: { $ne: 'archived' } }).limit(200).lean()));
app.post('/api/products', async (req, res) => { const result = await ensureProductVariantFromItem(req.body); res.json(result.product); });
app.post('/api/products/bulk', async (req, res) => { const items = Array.isArray(req.body.items) ? req.body.items : []; for (const item of items) { await ensureProductVariantFromItem(item); } res.json({ ok: true, count: items.length, normalized: true }); });
app.get('/api/services', async (_, res) => res.json(await Service.find({ active: true }).lean()));
app.post('/api/services', async (req, res) => res.json(await Service.create(req.body)));
app.get('/api/cart/:userId', async (req, res) => res.json(await cartResponse(req.params.userId)));
app.post('/api/cart/:userId', async (req, res) => res.json(await replaceCartFromClient(req.params.userId, req.body.items || [])));
app.get('/api/orders/:userId', async (req, res) => res.json(await ordersForUser(req.params.userId)));
app.post('/api/orders', async (req, res) => {
  const idempotencyKey = req.body.idempotencyKey || `order-${req.body.userId || 'guest'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const existing = await Order.findOne({ idempotencyKey }).lean().catch(() => null);
  if (existing) return res.json(await orderWithItems(existing));
  const order = await createOrderWithItems({ ...req.body, idempotencyKey, statusTimeline: [{ status: req.body.status || 'pending_payment', at: new Date(), note: 'Đơn hàng được tạo từ JAPANO app/web.' }] });
  res.json(order);
});

app.post('/api/checkout/quote', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const subtotal = items.reduce((sum, item) => sum + Number(item.price || item.unitPrice || 0) * Number(item.qty || 1), 0);
    const shippingOptions = [
      { id: 'standard', name: 'Tiêu chuẩn', fee: 28000, eta: '2-4 ngày', recommended: subtotal < 1500000 },
      { id: 'fast', name: 'Nhanh', fee: 45000, eta: '1-2 ngày', recommended: false },
      { id: 'gift', name: 'Gói quà + hẹn giờ', fee: 69000, eta: '2-5 ngày', recommended: subtotal >= 1500000 },
    ];
    const selected = shippingOptions.find((x) => x.id === req.body.shippingMethodId) || shippingOptions[0];
    const discount = subtotal >= 1500000 ? 80000 : 0;
    const total = Math.max(0, subtotal + selected.fee - discount);
    res.json({ subtotal, shippingOptions, selectedShipping: selected, discount, total, trust: ['COD khả dụng', 'Lưu lịch sử mua', 'Đồng bộ web/mobile'] });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/checkout/intent', async (req, res) => {
  const idempotencyKey = req.body.idempotencyKey || `intent-${req.body.userId || 'guest'}-${Date.now()}`;
  res.json({ idempotencyKey, intentId: `jp_intent_${Date.now()}`, status: 'requires_confirmation', provider: req.body.paymentProvider || 'COD' });
});

app.get('/api/orders/:orderId/track', async (req, res) => {
  const order = await Order.findById(req.params.orderId).lean().catch(() => null);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  const timeline = order.statusTimeline || [
    { status: order.status || 'pending_payment', label: 'Đã tạo đơn', at: order.createdAt },
    { status: 'packing', label: 'Đang chuẩn bị hàng', at: null },
    { status: 'shipped', label: 'Đang giao hàng', at: null },
    { status: 'delivered', label: 'Đã nhận hàng', at: null },
  ];
  res.json({ orderId: String(order._id), status: order.status, timeline });
});
app.get('/api/wishlist/:userId', async (req, res) => res.json(await wishlistResponse(req.params.userId)));
app.post('/api/wishlist/:userId', async (req, res) => res.json(await replaceWishlistFromClient(req.params.userId, req.body.items || [])));
app.get('/api/search-history/:userId', async (req, res) => res.json(await SearchHistory.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(50).lean()));
app.post('/api/search-history', async (req, res) => res.json(await SearchHistory.create(req.body)));
app.get('/api/games', async (_, res) => res.json(await Game.find().lean()));
app.post('/api/games', async (req, res) => res.json(await Game.create(req.body)));
app.get('/api/game-history/:userId', async (req, res) => res.json(await GameHistory.find({ userId: req.params.userId }).sort({ createdAt: -1 }).lean()));
app.post('/api/game-history', async (req, res) => res.json(await GameHistory.create(req.body)));

function getLanApiUrls() {
  const urls = [];
  for (const items of Object.values(os.networkInterfaces())) {
    for (const item of items || []) {
      if (item && item.family === 'IPv4' && !item.internal) urls.push(`http://${item.address}:${PORT}`);
    }
  }
  return urls;
}

app.listen(PORT, '0.0.0.0', () => {
  const lan = getLanApiUrls();
  console.log(`[JAPANO] API server running at http://localhost:${PORT}`);
  if (lan.length) console.log(`[JAPANO] LAN API: ${lan.join(' | ')}`);
});
