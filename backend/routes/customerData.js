// Hành vi mua sắm của khách: log tương tác (nuôi engine gợi ý), giỏ hàng, và
// danh sách yêu thích (wishlist là thực thể riêng — ERD v2, không suy từ log).
module.exports = function registerCustomerDataRoutes(api, ctx) {
  const { read, update, httpError, pushNotification, sendPushToUser, requireSelfOrStaff } = ctx;

  // thu thập dữ liệu hành vi người dùng (xem, thích, giỏ hàng, thử đồ...) để nuôi engine gợi ý
  api.post('/interactions', (req, res) => {
    const b = req.body || {};
    const type = String(b.type || '').toLowerCase();
    if (!b.userId || !b.productId || !type) return res.status(400).json({ error: 'thiếu userId, productId hoặc type' });
    let cart = null;
    let wishlistAdded = null;
    update((state) => {
      const now = Date.now(), userId = String(b.userId), productId = String(b.productId), metadata = b.metadata || {};
      state.interactions.push({ id: 'i' + now + Math.random().toString(36).slice(2, 7), userId, productId, type, value: b.value, metadata, createdAt: now, source: 'mobile' });
      if (type === 'wishlist' && Number(b.value) > 0) {
        const product = state.products.find((p) => p.slug === productId || p.id === productId);
        pushNotification(state, {
          userId,
          title: 'Đã thêm vào yêu thích',
          body: product ? `${product.name} đang chờ bạn trong danh sách yêu thích.` : 'Sản phẩm đã được lưu vào danh sách yêu thích.',
          type: 'Yêu thích',
          action: `product:${productId}`,
        });
        wishlistAdded = { userId, name: product?.name || 'Sản phẩm' };
      }
      if (type === 'cart') {
        const color = String(metadata.color || 'Mặc định'), size = String(metadata.size || 'M'), quantity = Math.max(0, Number(b.value) || 0);
        const index = state.carts.findIndex((item) => item.userId === userId && item.productId === productId && item.color === color && item.size === size);
        if (quantity <= 0) {
          if (index >= 0) state.carts.splice(index, 1);
        } else {
          const next = { ...(index >= 0 ? state.carts[index] : {}), userId, productId, color, size, quantity, updatedAt: now };
          if (index >= 0) state.carts[index] = next; else state.carts.push(next);
        }
        cart = state.carts.filter((item) => item.userId === userId);
      }
      return state;
    });
    res.json({ ok: true, cart });
    if (wishlistAdded) {
      void sendPushToUser(wishlistAdded.userId, { title: 'Đã thêm vào yêu thích', body: `${wishlistAdded.name} đang chờ bạn trong danh sách yêu thích.`, data: { type: 'wishlist' } });
    }
  });

  // Ghi mọi lượt tìm kiếm — kể cả 0 kết quả — để nuôi báo cáo "search intelligence"
  // (từ khoá hot, từ khoá không ra kết quả) cho admin. Khác với /interactions
  // type=search (chỉ gắn vào sản phẩm được trả về, dùng cho engine gợi ý).
  api.post('/search-log', (req, res) => {
    const b = req.body || {};
    const query = String(b.query || '').trim();
    if (!query) return res.status(400).json({ ok: false, message: 'Thiếu từ khoá tìm kiếm.' });
    update((state) => {
      state.searchLogs ||= [];
      state.searchLogs.push({
        id: 'sl' + Date.now() + Math.random().toString(36).slice(2, 7),
        userId: String(b.userId || 'guest'),
        query,
        resultCount: Math.max(0, Number(b.resultCount) || 0),
        createdAt: Date.now(),
      });
      // Giữ tối đa 5000 dòng gần nhất — đủ để phân tích xu hướng mà không để
      // log phình vô hạn trong state (1 file JSON + mirror MongoDB).
      if (state.searchLogs.length > 5000) state.searchLogs = state.searchLogs.slice(-5000);
      return state;
    });
    res.json({ ok: true });
  });

  api.post('/carts/sync', requireSelfOrStaff((req) => req.body?.userId), (req, res) => {
    try {
      const userId = String(req.body?.userId || '');
      if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để đồng bộ giỏ hàng.');
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      let cart;
      update((state) => {
        const merge = req.body?.merge === true;
        if (!merge) state.carts = state.carts.filter((item) => item.userId !== userId);
        const now = Date.now();
        for (const item of items) {
          const productId = String(item.productId || item.slug || '');
          const product = state.products.find((candidate) => candidate.slug === productId || candidate.id === productId);
          const quantity = Math.min(20, Math.max(0, Number(item.quantity ?? item.qty) || 0));
          if (!product || quantity <= 0) continue;
          const color = String(item.color || item.colorName || 'Mặc định');
          const size = String(item.size || 'M');
          const existing = merge ? state.carts.find((row) => row.userId === userId && row.productId === product.slug && row.color === color && row.size === size) : null;
          if (existing) {
            existing.quantity = Math.min(20, Math.max(existing.quantity || 0, quantity));
            existing.updatedAt = now;
          } else {
            state.carts.push({ userId, productId: product.slug, color, size, quantity, updatedAt: now });
          }
        }
        cart = state.carts.filter((item) => item.userId === userId);
        return state;
      });
      res.json({ ok: true, cart });
    } catch (error) {
      res.status(error.status || 400).json({ ok: false, message: error.message || 'Không đồng bộ được giỏ hàng.' });
    }
  });

  // ---------------------------------------------------------------------------
  // WISHLIST (ERD v2: bảng wishlists) — thực thể riêng, không suy ra từ log
  // interactions nữa. Mỗi (user, product) là 1 dòng UNIQUE.
  // ---------------------------------------------------------------------------
  api.get('/wishlist', requireSelfOrStaff((req) => req.query.userId), (req, res) => {
    const userId = String(req.query.userId || '');
    const slugs = (read().wishlists || []).filter((w) => w.userId === userId)
      .sort((l, r) => Number(r.createdAt || 0) - Number(l.createdAt || 0))
      .map((w) => w.productSlug);
    res.json({ ok: true, wishlist: slugs });
  });

  api.post('/wishlist/sync', (req, res) => {
    try {
      const userId = String(req.body?.userId || '');
      if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để lưu yêu thích.');
      const slugs = Array.isArray(req.body?.slugs) ? req.body.slugs : [];
      let wishlist;
      update((state) => {
        state.wishlists = state.wishlists || [];
        const existing = new Map(state.wishlists.filter((w) => w.userId === userId).map((w) => [w.productSlug, w]));
        state.wishlists = state.wishlists.filter((w) => w.userId !== userId);
        const now = Date.now();
        const seen = new Set();
        for (const raw of slugs) {
          const slug = String(raw || '');
          if (!slug || seen.has(slug)) continue;
          const product = state.products.find((p) => p.slug === slug || p.id === slug);
          if (!product) continue;
          seen.add(product.slug);
          const prev = existing.get(product.slug);
          state.wishlists.push({ id: prev?.id || `wish-${now}-${Math.random().toString(36).slice(2, 6)}`, userId, productSlug: product.slug, createdAt: prev?.createdAt || now });
        }
        wishlist = state.wishlists.filter((w) => w.userId === userId).map((w) => w.productSlug);
        return state;
      });
      res.json({ ok: true, wishlist });
    } catch (error) {
      res.status(error.status || 400).json({ ok: false, message: error.message || 'Không lưu được yêu thích.' });
    }
  });
};
