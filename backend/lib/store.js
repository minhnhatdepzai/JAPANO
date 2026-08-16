const fs = require('fs');
const path = require('path');
const { seededState } = require('../seed');
const { getDb, mongoEnabled } = require('./mongo');
const { logger } = require('./logger');
const {
  normalizeState,
  loadStateFromCollections,
  persistStateToCollections,
  ensureMongoIndexes,
  dropLegacyCollections,
  repairLegacyReferences,
  relationshipErrors,
} = require('./mongoCollections');

// Thông tin xác thực KHÔNG được rời khỏi máy chủ. Trước đây GET /api/state và
// GET /api/admin/live trả nguyên mảng users, nên trang quản trị nhận đủ 17 hash
// bcrypt lẫn resetCodeHash rồi ghi vào localStorage của trình duyệt — bất kỳ ai
// mở devtools trên máy đó, hoặc bất kỳ lỗ hổng XSS nào trong trang quản trị,
// đều lấy được. Riêng resetCodeHash là sha256 không muối của một mã 6 chữ số:
// dò hết một triệu khả năng chỉ mất vài giây, tức là chiếm được tài khoản.
//
// Hai nửa của cách sửa phải đi cùng nhau:
//   · scrubUsers()          — lọc ở chiều RA (dùng trong routes/health.js)
//   · preserveCredentials() — khôi phục ở chiều VÀO. Vì 'users' không nằm trong
//     SERVER_MANAGED_FIELDS, trang quản trị vẫn gửi trả cả mảng users qua
//     PUT /api/state; nếu chỉ lọc chiều ra thì lần lưu kế tiếp sẽ ghi đè mất
//     toàn bộ mật khẩu và không ai đăng nhập được nữa.
// googleId nằm trong danh sách này vì nó LÀ một thông tin xác thực: ai đặt
// được googleId của một tài khoản thì đăng nhập được vào tài khoản đó bằng
// Google. Chặn passwordHash mà bỏ ngỏ googleId thì coi như không chặn gì.
const CREDENTIAL_FIELDS = Object.freeze(['passwordHash', 'resetCodeHash', 'resetCodeExpiresAt', 'googleId']);

function scrubUsers(users) {
  return (users || []).map((user) => {
    const safe = { ...user };
    for (const field of CREDENTIAL_FIELDS) delete safe[field];
    return safe;
  });
}

function preserveCredentials(currentUsers, incomingUsers) {
  if (!Array.isArray(incomingUsers)) return currentUsers;
  const byId = new Map((currentUsers || []).map((user) => [String(user.id), user]));
  return incomingUsers.map((incoming) => {
    const existing = byId.get(String(incoming.id));
    if (!existing) return incoming;
    const merged = { ...incoming };
    for (const field of CREDENTIAL_FIELDS) {
      if (existing[field] === undefined) delete merged[field];
      else merged[field] = existing[field];
    }
    return merged;
  });
}

const SERVER_MANAGED_FIELDS = Object.freeze([
  'orders', 'interactions', 'searchLogs', 'pushTokens', 'profiles', 'chats',
  'tryonHistory', 'goals', 'aiDescriptions', 'flagcardCollections',
  'voucherRedemptions', 'vipMemberships', 'payments', 'returnRequests', 'carts',
  'reviews', 'reviewReactions', 'moderationSamples', 'addresses', 'wishlists',
]);

// read() sao chép sâu toàn bộ state cho MỖI lời gọi (68 điểm gọi trong routes/)
// nên đây là hot path tốn CPU nhất của backend. structuredClone của Node nhanh
// hơn vòng JSON.parse(JSON.stringify(...)) khoảng 35% trên db hiện tại
// (~1.53ms → ~1.00ms) mà giữ nguyên ngữ nghĩa cho dữ liệu thuần JSON.
function clone(value) {
  return structuredClone(value);
}

// Tên cũ được giữ làm API tương thích cho các script nội bộ. Hàm này hiện ghi
// thẳng vào các collection nguồn, không còn tạo projection hay app_state.
async function syncMongoViews(db, state) {
  await persistStateToCollections(db, normalizeState(state));
  await ensureMongoIndexes(db);
}

function createStore(filePath) {
  const resolved = path.resolve(filePath);
  const directory = path.dirname(resolved);
  let useMongo = mongoEnabled();
  let mongoState = null;
  let mongoReady = false;
  let persistQueue = Promise.resolve();
  let persistTimer = null;

  if (!useMongo && !fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });

  function readFileState() {
    try {
      return normalizeState(JSON.parse(fs.readFileSync(resolved, 'utf8')));
    } catch {
      return normalizeState(seededState());
    }
  }

  function writeFile(state) {
    const normalized = normalizeState(state);
    const temporary = `${resolved}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(normalized, null, 2));
    fs.renameSync(temporary, resolved);
    return normalized;
  }

  // MongoDB is an optional primary store in deployed environments.  Keep a
  // durable local copy when it becomes unavailable so a broken remote URI
  // cannot take down the demo/Admin during a presentation.
  function activateFileFallback(state, error) {
    const fallback = normalizeState(state || mongoState || readFileState());
    useMongo = false;
    mongoReady = false;
    mongoState = null;
    // Ghi đè db.json bằng state lấy từ MongoDB là thao tác PHÁ HUỶ, và nó xảy ra
    // đúng lúc tệ nhất: khi MongoDB vừa trục trặc. Nếu dữ liệu trên MongoDB
    // đang thiếu (migration dở dang, script ghi sai collection), bản thiếu đó
    // đè mất bản đầy đủ dưới đĩa và không còn đường lùi.
    //
    // Chuyện này đã xảy ra thật: một script đẩy sản phẩm ghi sai collection
    // khiến MongoDB có sản phẩm nhưng không có ảnh; một lần MongoDB chập là
    // db.json bị thay bằng bản không ảnh, mất luôn mô tả và ảnh của 9 sản phẩm.
    // Giữ lại một bản sao trước khi ghi đè để luôn còn đường khôi phục.
    try {
      if (fs.existsSync(resolved)) {
        const backup = `${resolved}.pre-fallback-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        fs.copyFileSync(resolved, backup);
        logger.warn({ backup }, 'Đã sao lưu db.json trước khi ghi đè bằng dữ liệu từ MongoDB.');
      }
    } catch (backupError) {
      logger.error({ err: backupError }, 'Không sao lưu được db.json trước khi chuyển sang JSON cục bộ.');
    }
    writeFile(fallback);
    logger.warn({ err: error }, 'MongoDB không khả dụng; chuyển sang dữ liệu JSON cục bộ.');
    return fallback;
  }

  function assertValid(state) {
    const errors = relationshipErrors(state);
    if (!errors.length) return;
    const error = new Error(`Dữ liệu vi phạm liên kết: ${errors.slice(0, 4).join('; ')}`);
    error.status = 409;
    error.code = 'INVALID_RELATIONSHIP';
    error.details = errors;
    throw error;
  }

  function scheduleMongoPersistence() {
    const snapshot = clone(mongoState);
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistQueue = persistQueue
        .then(async () => persistStateToCollections(await getDb(), snapshot))
        .catch((error) => activateFileFallback(snapshot, error));
    }, 40);
  }

  function write(state) {
    if (!useMongo) return writeFile(state);
    const normalized = normalizeState(state);
    assertValid(normalized);
    mongoState = normalized;
    scheduleMongoPersistence();
    return clone(mongoState);
  }

  function read() {
    if (!useMongo) return readFileState();
    // initialize() hoàn tất trước app.listen; fallback chỉ bảo vệ module boot.
    return clone(mongoState || readFileState());
  }

  function replaceFromAdmin(incoming) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      const error = new Error('state không hợp lệ');
      error.status = 400;
      throw error;
    }
    const current = read();
    const merged = { ...current, ...incoming };
    merged.shop = { ...current.shop, ...(incoming.shop || {}) };
    merged.integrations = { ...current.integrations, ...(incoming.integrations || {}) };
    for (const field of SERVER_MANAGED_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(incoming, field)) merged[field] = current[field];
    }
    merged.payments = current.payments;
    merged.returnRequests = current.returnRequests;
    merged.orders = current.orders;
    merged.flagcardConfig = { ...current.flagcardConfig, ...(incoming.flagcardConfig || {}) };
    merged.users = preserveCredentials(current.users, incoming.users);
    return write(merged);
  }

  function update(mutator) {
    const current = read();
    const result = mutator(current);
    return write(result && typeof result === 'object' ? result : current);
  }

  async function initialize() {
    if (!useMongo || mongoReady) return false;
    try {
      const db = await getDb();
      if (!db) throw new Error('MongoDB không khả dụng');
      const legacy = await db.collection('app_state').findOne({ _id: 'main' });
      const normalizedProductCount = await db.collection('product_details').countDocuments({});
      let migrated = false;

      if (legacy && normalizedProductCount === 0) {
        const { _id, _updatedAt, _syncedAt, ...legacyState } = legacy;
        const repaired = repairLegacyReferences(legacyState);
        mongoState = normalizeState(repaired.state);
        await persistStateToCollections(db, mongoState);
        const verified = await loadStateFromCollections(db);
        const verificationErrors = relationshipErrors(verified);
        if (verificationErrors.length || verified.products.length !== mongoState.products.length || verified.orders.length !== mongoState.orders.length) {
          throw new Error(`Migration collection-first không đạt kiểm tra: ${verificationErrors.join('; ') || 'sai số lượng dữ liệu'}`);
        }
        await dropLegacyCollections(db);
        mongoState = verified;
        migrated = true;
        if (repaired.report.length) logger.warn({ repairs: repaired.report }, 'Đã sửa tham chiếu mồ côi khi bỏ app_state.');
      } else if (normalizedProductCount > 0) {
        mongoState = await loadStateFromCollections(db);
        // app_state cũ có thể còn sót sau một lần migration bị ngắt ở bước cuối.
        if (legacy) await dropLegacyCollections(db);
      } else {
        const repaired = repairLegacyReferences(readFileState());
        mongoState = normalizeState(repaired.state);
        await persistStateToCollections(db, mongoState);
        migrated = true;
      }

      await ensureMongoIndexes(db);
      mongoReady = true;
      return migrated;
    } catch (error) {
      // Chỉ hạ xuống JSON khi MongoDB thực sự không truy cập được. Lỗi migration
      // hoặc dữ liệu Mongo không hợp lệ vẫn phải làm boot thất bại để tránh che
      // mất một lỗi toàn vẹn dữ liệu bằng một nguồn dữ liệu khác.
      if (!mongoEnabled()) {
        activateFileFallback(mongoState || readFileState(), error);
        return false;
      }
      throw error;
    }
  }

  async function flush() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
      const snapshot = clone(mongoState);
      persistQueue = persistQueue.then(async () => persistStateToCollections(await getDb(), snapshot));
    }
    await persistQueue;
  }

  if (!useMongo && !fs.existsSync(resolved)) writeFile(seededState());
  if (!useMongo && fs.existsSync(resolved)) writeFile(readFileState());

  return {
    filePath: resolved,
    get storage() { return useMongo ? 'mongodb-collections' : 'json'; },
    read,
    write,
    update,
    replaceFromAdmin,
    initialize,
    hydrateFromMongoIfNewer: initialize,
    flush,
  };
}

module.exports = { SERVER_MANAGED_FIELDS, CREDENTIAL_FIELDS, scrubUsers, normalizeState, createStore, syncMongoViews };
