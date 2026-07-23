// Hành vi mua sắm của khách: log tương tác (nuôi engine gợi ý), giỏ hàng, và
// danh sách yêu thích (wishlist là thực thể riêng — ERD v2, không suy từ log).
module.exports = function registerCustomerDataRoutes(api, ctx) {
  const { read, update, httpError } = ctx;

  // thu thập dữ liệu hành vi người dùng (xem, thích, giỏ hàng, thử đồ...) để nuôi engine gợi ý
  api.post('/interactions', (req, res) => {
    const b = req.body || {};
    const type = String(b.type || '').toLowerCase();
    if (!b.userId || !b.productId || !type) return res.status(400).json({ error: 'thiếu userId, productId hoặc type' });
    let cart = null;
    update((state) => {
      const now = Date.now(), userId = String(b.userId), productId = String(b.productId), metadata = b.metadata || {};
      state.interactions.push({ id: 'i' + now + Math.random().toString(36).slice(2, 7), userId, productId, type, value: b.value, metadata, createdAt: now, source: 'mobile' });
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
  });

  api.post('/carts/sync', (req, res) => {
    try {
      const userId = String(req.body?.userId || '');
      if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để đồng bộ giỏ hàng.');
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      let cart;
      update((state) => {
        state.carts = state.carts.filter((item) => item.userId !== userId);
        const now = Date.now();
        for (const item of items) {
          const productId = String(item.productId || item.slug || '');
          const product = state.products.find((candidate) => candidate.slug === productId || candidate.id === productId);
          const quantity = Math.min(20, Math.max(0, Number(item.quantity ?? item.qty) || 0));
          if (!product || quantity <= 0) continue;
          state.carts.push({ userId, productId: product.slug, color: String(item.color || item.colorName || 'Mặc định'), size: String(item.size || 'M'), quantity, updatedAt: now });
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
  api.get('/wishlist', (req, res) => {
    const userId = String(req.query.userId || '');
    if (!userId) return res.status(400).json({ ok: false, message: 'Thiếu userId.' });
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
