// Sức khoẻ hệ thống, cấu hình cửa hàng, seed/reset dữ liệu demo, và báo cáo
// phân tích (analytics) cho dashboard admin.
module.exports = function registerHealthRoutes(api, ctx) {
  const {
    read, write, update, invalidateCache, stateStore, getRecommendationDiagnostics,
    httpError, cloudinary, cloudinaryEnabled, cloudinaryHealth, mongoHealth,
    stripeEnabled, vnpayEnabled, STRIPE_CURRENCY, PORT, VIP_CONFIG, tryonGpuBusy, FORCE_REPOSE,
    seededState, emptyState, reconcileFlagRewards, buildAnalytics,
  } = ctx;

  api.get('/health', async (req, res) => {
    const state = read();
    const [cloudinaryStatus, mongoStatus] = await Promise.all([cloudinaryHealth(), mongoHealth()]);
    res.json({
      ok: true,
      seeded: state.seeded,
      time: Date.now(),
      port: PORT,
      database: { type: 'json', connected: true, file: stateStore.filePath },
      integrations: { mongo: mongoStatus.online, cloudinary: cloudinaryStatus.online, ai: true, localPreview: false, stripe: stripeEnabled(), vnpay: vnpayEnabled() },
      cloudinary: cloudinaryStatus,
      mongo: mongoStatus,
      vip: VIP_CONFIG,
      features: ['revenue-ensemble', 'demand-momentum', 'kmeans', 'rfm-churn', 'market-basket', 'hybrid-recommender', 'selective-ssm-sequence', 'lightgcn-user-item', 'autoregressive-next-item', 'adaptive-moe-ranking', 'pairwise-ranking', 'mlstm-style-chat-memory', 'semantic-chat-routing', 'grounded-chat-retrieval', 'behavior-search-learning', 'negative-feedback-learning', 'live-cart-state', 'product-video', 'shared-brand-logo', 'vietnam-34-provinces-3321-wards', 'verified-purchase-reviews', 'semantic-review-moderation', 'review-reactions', 'fashn-vton-1.5', 'flux2-pose-transfer', 'flux2-accessory-refine', 'one-to-all-animation-1.3b-v2', 'resource-guarded-video-generation', 'adaptive-repose-main-subject', 'tryon-quality-gate', 'accessory-quality-gate', 'single-subject-pose-lock', 'pose-accessories', 'product-vision', 'shopping-wellness-goals', 'historical-flagcards', 'flagcard-reward-voucher', 'stripe-test-checkout', 'stripe-card-discount', 'stripe-refunds', 'vnpay-sandbox-checkout', 'vnpay-refunds', 'return-refund-workflow'],
      stripe: { enabled: stripeEnabled(), mode: stripeEnabled() ? 'test' : 'disabled', currency: STRIPE_CURRENCY },
      vnpay: { enabled: vnpayEnabled(), mode: vnpayEnabled() ? 'test' : 'disabled', currency: 'VND' },
      tryon: { forceRepose: FORCE_REPOSE, gpuBusy: tryonGpuBusy() },
    });
  });

  // toàn bộ state (admin dùng để đồng bộ)
  api.get('/state', (req, res) => res.json(read()));
  api.get('/admin/live', (req, res) => {
    const state = read();
    res.json({
      ok: true,
      serverTime: Date.now(),
      orders: state.orders,
      payments: state.payments,
      returnRequests: state.returnRequests,
      interactions: state.interactions,
      carts: state.carts,
      reviews: state.reviews,
      reviewReactions: state.reviewReactions,
      users: state.users,
      shop: state.shop,
    });
  });
  api.put('/state', (req, res) => {
    try {
      stateStore.replaceFromAdmin(req.body);
      const saved = update((state) => {
        reconcileFlagRewards(state);
        return state;
      });
      invalidateCache();
      res.json({ ok: true, schemaVersion: saved.schemaVersion, state: saved });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message || 'state không hợp lệ' });
    }
  });

  function publicShop(shop) {
    const raw = String(shop?.logo || '');
    return { ...shop, logo: raw.startsWith('data:image/') ? `/api/shop/logo?v=${Number(shop.updatedAt || 0)}` : raw };
  }

  api.put('/shop', async (req, res) => {
    try {
      const incoming = req.body && typeof req.body === 'object' ? req.body : {};
      const allowed = ['name', 'hotline', 'email', 'address', 'shipFee', 'cod', 'stripe', 'vnpay', 'logo'];
      const patch = Object.fromEntries(allowed.filter((key) => Object.prototype.hasOwnProperty.call(incoming, key)).map((key) => [key, incoming[key]]));
      if (patch.logo && !/^data:image\/(?:png|jpe?g|webp|svg\+xml);base64,/i.test(String(patch.logo))) {
        throw httpError(400, 'Logo phải là ảnh PNG, JPG, WebP hoặc SVG hợp lệ.');
      }
      if (String(patch.logo || '').length > 6 * 1024 * 1024) throw httpError(413, 'Logo vượt quá dung lượng cho phép.');
      // Có Cloudinary thì tải logo lên đó và chỉ lưu URL — tránh nhúng base64 nặng vào db.json.
      if (patch.logo && cloudinaryEnabled()) {
        try {
          const uploaded = await cloudinary.uploader.upload(patch.logo, { folder: 'japano/shop', public_id: 'logo', overwrite: true, resource_type: 'image' });
          patch.logo = uploaded.secure_url;
        } catch (error) {
          throw httpError(502, 'Không tải được logo lên Cloudinary: ' + (error.message || 'lỗi không xác định'));
        }
      }
      let shop;
      update((state) => {
        state.shop = { ...state.shop, ...patch, updatedAt: Date.now() };
        shop = state.shop;
        return state;
      });
      res.json({ ok: true, shop: publicShop(shop) });
    } catch (error) {
      res.status(error.status || 400).json({ ok: false, message: error.message || 'Không lưu được thông tin cửa hàng.' });
    }
  });

  // seed / reset
  api.post('/seed', (req, res) => { const s = seededState(); reconcileFlagRewards(s); write(s); res.json(s); });
  api.post('/reset', (req, res) => { const s = emptyState(); write(s); res.json(s); });

  api.get('/shop/logo', (req, res) => {
    const raw = String(read().shop?.logo || '');
    const match = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
    if (!match) return res.status(404).end();
    const bytes = Buffer.from(match[2], 'base64');
    res.setHeader('Content-Type', match[1]);
    res.setHeader('Content-Length', bytes.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(bytes);
  });

  const collections = ['orders', 'payments', 'returnRequests', 'users', 'categories', 'notifications', 'banners', 'vouchers', 'flagcards'];
  collections.forEach((c) => api.get('/' + c, (req, res) => res.json(read()[c] || [])));
  api.get('/shop', (req, res) => res.json(publicShop(read().shop || {})));

  // phân tích doanh thu/nhu cầu/xu hướng/phân khúc khách hàng cho dashboard admin
  api.get('/analytics', (req, res) => {
    const state = read();
    const scope = String(req.query.scope || 'live') === 'all' ? 'all' : 'live';
    const scoped = scope === 'all' ? state : {
      ...state,
      orders: (state.orders || []).filter((row) => !['demo', 'admin-test'].includes(String(row.source || ''))),
      interactions: (state.interactions || []).filter((row) => row.source !== 'demo'),
    };
    res.json({
      ok: true,
      scope,
      sourceCounts: {
        liveOrders: (state.orders || []).filter((row) => !['demo', 'admin-test'].includes(String(row.source || ''))).length,
        demoOrders: (state.orders || []).filter((row) => ['demo', 'admin-test'].includes(String(row.source || ''))).length,
        liveInteractions: (state.interactions || []).filter((row) => row.source !== 'demo').length,
        demoInteractions: (state.interactions || []).filter((row) => row.source === 'demo').length,
      },
      ...buildAnalytics(scoped, { recommendationDiagnostics: getRecommendationDiagnostics(scoped) }),
    });
  });
};
