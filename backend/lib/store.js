const fs = require('fs');
const path = require('path');
const { emptyState, seededState } = require('../seed');

const SERVER_MANAGED_FIELDS = Object.freeze(['orders', 'interactions', 'profiles', 'chats', 'tryonHistory', 'goals', 'aiDescriptions', 'flagcardCollections', 'voucherRedemptions', 'vipMemberships', 'payments', 'returnRequests', 'carts', 'reviews', 'reviewReactions', 'moderationSamples', 'addresses', 'wishlists']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(input) {
  const defaults = emptyState();
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const normalized = { ...defaults, ...source };
  normalized.shop = { ...defaults.shop, ...(source.shop || {}) };
  normalized.integrations = { ...defaults.integrations, ...(source.integrations || {}) };
  for (const key of ['categories', 'products', 'orders', 'users', 'notifications', 'vouchers', 'banners', 'flagcards', ...SERVER_MANAGED_FIELDS]) {
    normalized[key] = Array.isArray(source[key]) ? source[key] : clone(defaults[key]);
  }
  normalized.flagcardConfig = { ...defaults.flagcardConfig, ...(source.flagcardConfig || {}) };
  normalized.schemaVersion = Math.max(5, Number(source.schemaVersion || 0));
  normalized.seeded = Boolean(source.seeded || normalized.products.length);
  return normalized;
}

function createStore(filePath) {
  const resolved = path.resolve(filePath);
  const directory = path.dirname(resolved);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });

  function write(state) {
    const normalized = normalizeState(state);
    const temporary = `${resolved}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(normalized, null, 2));
    fs.renameSync(temporary, resolved);
    return normalized;
  }

  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      return normalizeState(parsed);
    } catch (error) {
      const initial = seededState();
      return write(initial);
    }
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
    // Giao dịch Stripe/refund chỉ được thay đổi bởi API server sau khi đối
    // chiếu Stripe. Admin state cũ không được ghi đè các mã PI/re_ mới.
    merged.payments = current.payments;
    merged.returnRequests = current.returnRequests;
    if (Array.isArray(incoming.orders)) {
      const currentOrders = new Map(current.orders.map((order) => [String(order.id), order]));
      const incomingIds = new Set(incoming.orders.map((order) => String(order.id)));
      merged.orders = incoming.orders.map((order) => {
        const saved = currentOrders.get(String(order.id));
        if (!saved) return order;
        const stripeManaged = /stripe/i.test(String(saved.payment?.method || saved.payment?.provider || ''));
        const history = [...(saved.history || []), ...(order.history || [])].filter((entry, index, list) =>
          list.findIndex((candidate) => `${candidate.s}|${candidate.at}|${candidate.refundId || ''}` === `${entry.s}|${entry.at}|${entry.refundId || ''}`) === index);
        const serverTerminal = ['refunded', 'refund_pending'].includes(String(saved.payment?.status || '')) || saved.status === 'returned';
        return {
          ...saved,
          ...order,
          status: serverTerminal ? saved.status : order.status,
          payment: stripeManaged ? saved.payment : { ...saved.payment, ...(order.payment || {}) },
          returnStatus: saved.returnStatus,
          returnRequest: saved.returnRequest,
          history,
        };
      }).concat(current.orders.filter((order) => !incomingIds.has(String(order.id))));
    }
    // Đơn hàng chỉ thay đổi qua API trạng thái/checkout/webhook. Một bản giao
    // diện quản trị mở từ trước tuyệt đối không được ghi đè hay xoá đơn mới.
    merged.orders = current.orders;
    merged.flagcardConfig = { ...current.flagcardConfig, ...(incoming.flagcardConfig || {}) };
    merged.schemaVersion = Math.max(5, Number(current.schemaVersion || 0), Number(incoming.schemaVersion || 0));
    return write(merged);
  }

  function update(mutator) {
    const current = read();
    const result = mutator(current);
    const next = result && typeof result === 'object' ? result : current;
    return write(next);
  }

  if (!fs.existsSync(resolved)) write(seededState());
  else {
    const current = read();
    // Persist schema migrations so old admin state gains server-managed collections.
    write(current);
  }

  return { filePath: resolved, read, write, update, replaceFromAdmin };
}

module.exports = { SERVER_MANAGED_FIELDS, normalizeState, createStore };
