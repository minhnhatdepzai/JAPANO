// Sức khoẻ hệ thống, cấu hình cửa hàng, seed/reset dữ liệu demo, và báo cáo
// phân tích (analytics) cho dashboard admin.
const { scrubUsers } = require('../lib/store');
const { fitConfig } = require('../lib/tryonConfig');

module.exports = function registerHealthRoutes(api, ctx) {
  const {
    read, write, update, invalidateCache, stateStore, getRecommendationDiagnostics,
    httpError, cloudinary, cloudinaryEnabled, cloudinaryHealth, mongoHealth,
    stripeEnabled, vnpayEnabled, STRIPE_CURRENCY, PORT, VIP_CONFIG, tryonGpuBusy, FORCE_REPOSE,
    seededState, emptyState, reconcileFlagRewards, buildAnalytics,
    requireAdmin, optionalAuth, roleAtLeast,
  } = ctx;

  api.get('/health', async (req, res) => {
    const state = read();
    const [cloudinaryStatus, mongoStatus] = await Promise.all([cloudinaryHealth(), mongoHealth()]);
    res.json({
      ok: true,
      seeded: state.seeded,
      time: Date.now(),
      port: PORT,
      // start-all.sh so sánh marker này với source hiện tại. Nếu còn một
      // backend cũ giữ cổng 4100, script sẽ thay đúng tiến trình JAPANO đó
      // thay vì báo sẵn sàng nhầm và phục vụ code trước khi sửa.
      sourceVersion: String(process.env.JAPANO_SOURCE_VERSION || 'unversioned'),
      database: stateStore.storage.startsWith('mongodb')
        ? { type: 'mongodb', model: 'collection-first', connected: mongoStatus.online, database: process.env.MONGODB_DB || 'japano' }
        : { type: 'json', connected: true, file: stateStore.filePath },
      integrations: { mongo: mongoStatus.online, cloudinary: cloudinaryStatus.online, ai: true, localPreview: false, stripe: stripeEnabled(), vnpay: vnpayEnabled() },
      cloudinary: cloudinaryStatus,
      mongo: mongoStatus,
      vip: VIP_CONFIG,
      features: ['revenue-ensemble', 'demand-momentum', 'kmeans', 'rfm-churn', 'market-basket', 'hybrid-recommender', 'selective-ssm-sequence', 'lightgcn-user-item', 'autoregressive-next-item', 'adaptive-moe-ranking', 'pairwise-ranking', 'mlstm-style-chat-memory', 'semantic-chat-routing', 'grounded-chat-retrieval', 'behavior-search-learning', 'negative-feedback-learning', 'live-cart-state', 'product-video', 'shared-brand-logo', 'vietnam-34-provinces-3321-wards', 'verified-purchase-reviews', 'semantic-review-moderation', 'review-reactions', 'fashn-vton-1.5', 'flux2-pose-transfer', 'flux2-accessory-refine', 'one-to-all-animation-1.3b-v1', 'resource-guarded-video-generation', 'adaptive-repose-main-subject', 'tryon-quality-gate', 'accessory-quality-gate', 'single-subject-pose-lock', 'pose-accessories', 'product-vision', 'shopping-wellness-goals', 'historical-flagcards', 'flagcard-reward-voucher', 'stripe-test-checkout', 'stripe-card-discount', 'stripe-refunds', 'vnpay-sandbox-checkout', 'vnpay-refunds', 'return-refund-workflow', 'per-item-partial-returns', 'carrier-confirmed-delivery', 'customer-confirmed-receipt', 'return-ship-back-tracking', 'published-fulfillment-policy', 'goal-savings-fund', 'goal-completion-voucher', 'community-spot-contribution-reward'],
      stripe: { enabled: stripeEnabled(), mode: stripeEnabled() ? 'test' : 'disabled', currency: STRIPE_CURRENCY },
      vnpay: { enabled: vnpayEnabled(), mode: vnpayEnabled() ? 'test' : 'disabled', currency: 'VND' },
      tryon: { forceRepose: FORCE_REPOSE, gpuBusy: tryonGpuBusy(), fit: fitConfig() },
    });
  });

  // toàn bộ state (admin dùng để đồng bộ) — lộ hết đơn hàng/khách hàng nên bắt
  // buộc admin. Quyền admin vẫn KHÔNG đủ để được xem hash mật khẩu của người
  // khác: scrubUsers() bóc chúng ra, và lib/store.js giữ lại ở chiều ghi vào.
  api.get('/state', requireAdmin, (req, res) => {
    const state = read();
    res.json({ ...state, users: scrubUsers(state.users) });
  });
  api.get('/admin/live', requireAdmin, (req, res) => {
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
      users: scrubUsers(state.users),
      shop: state.shop,
    });
  });
  api.put('/state', requireAdmin, (req, res) => {
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

  const DEFAULT_STORE_LOCATION = Object.freeze({
    id: 'japano-qtsc9',
    name: 'JAPANO Store — QTSC9',
    address: 'Tòa nhà QTSC9 (tòa T), đường Tô Ký, phường Trung Mỹ Tây, TP Hồ Chí Minh',
    latitude: 10.8537915,
    longitude: 106.6260636,
    phone: '',
    openingHours: 'Liên hệ trước khi đến',
    services: ['Tư vấn sản phẩm', 'Hỗ trợ đặt hàng', 'Hướng dẫn thử đồ AI'],
    active: true,
  });

  function normalizeLocations(value, hotline) {
    if (!Array.isArray(value)) throw httpError(400, 'Danh sách địa điểm phải là một mảng.');
    if (value.length > 12) throw httpError(400, 'Chỉ hỗ trợ tối đa 12 địa điểm trong cấu hình cửa hàng.');
    const seen = new Set();
    return value.map((raw, index) => {
      const item = raw && typeof raw === 'object' ? raw : {};
      const id = String(item.id || `japano-location-${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
      const name = String(item.name || '').trim();
      const address = String(item.address || '').trim();
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);
      if (!id || seen.has(id)) throw httpError(400, 'Mỗi địa điểm cần mã riêng, không được trùng.');
      if (!name || name.length > 120) throw httpError(400, 'Tên địa điểm không hợp lệ.');
      if (!address || address.length > 280) throw httpError(400, 'Địa chỉ địa điểm không hợp lệ.');
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw httpError(400, 'Vĩ độ phải nằm trong khoảng -90 đến 90.');
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw httpError(400, 'Kinh độ phải nằm trong khoảng -180 đến 180.');
      seen.add(id);
      return {
        id,
        name,
        address,
        latitude,
        longitude,
        phone: String(item.phone || hotline || '').trim().slice(0, 40),
        openingHours: String(item.openingHours || 'Liên hệ trước khi đến').trim().slice(0, 160),
        services: Array.isArray(item.services)
          ? [...new Set(item.services.map((entry) => String(entry || '').trim()).filter(Boolean))].slice(0, 12)
          : [],
        active: item.active !== false,
      };
    });
  }

  // Bổ sung đúng một địa điểm mặc định vào document shop hiện có. Đây là cấu
  // hình nhỏ, không tạo collection stores và không nhân bản dữ liệu.
  if (!Array.isArray(read().shop?.locations) || read().shop.locations.length === 0) {
    update((state) => {
      state.shop ||= {};
      state.shop.locations = normalizeLocations([{ ...DEFAULT_STORE_LOCATION, phone: state.shop.hotline }], state.shop.hotline);
      state.shop.updatedAt = Date.now();
      return state;
    });
  }

  api.put('/shop', requireAdmin, async (req, res) => {
    try {
      const incoming = req.body && typeof req.body === 'object' ? req.body : {};
      const allowed = ['name', 'hotline', 'email', 'address', 'shipFee', 'cod', 'stripe', 'vnpay', 'logo', 'locations'];
      const patch = Object.fromEntries(allowed.filter((key) => Object.prototype.hasOwnProperty.call(incoming, key)).map((key) => [key, incoming[key]]));
      if (Object.prototype.hasOwnProperty.call(patch, 'locations')) {
        patch.locations = normalizeLocations(patch.locations, patch.hotline || read().shop?.hotline);
      }
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

  // seed / reset — xoá/ghi đè toàn bộ dữ liệu nên bắt buộc admin.
  api.post('/seed', requireAdmin, (req, res) => { const s = seededState(); reconcileFlagRewards(s); write(s); res.json(s); });
  api.post('/reset', requireAdmin, (req, res) => { const s = emptyState(); write(s); res.json(s); });

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

  // Danh mục/banner/thẻ bài là dữ liệu công khai của shop — ai xem cũng được.
  const publicCollections = ['categories', 'banners', 'flagcards'];
  publicCollections.forEach((c) => api.get('/' + c, (req, res) => res.json(read()[c] || [])));
  // Voucher thì không: ngoài mã khuyến mãi chung còn có voucher CÁ NHÂN (thưởng
  // quỹ mục tiêu, thưởng đóng góp địa điểm, đền bù, đủ bộ thẻ địa danh). Chỉ trả
  // mã chung cho mọi người, mã cá nhân chỉ trả cho đúng chủ sở hữu.
  api.get('/vouchers', optionalAuth, (req, res) => {
    const all = read().vouchers || [];
    res.json(all.filter((voucher) => !voucher.ownerUserId || (req.user?.id && String(voucher.ownerUserId) === String(req.user.id))));
  });
  // Đơn hàng/giao dịch/khách hàng chứa dữ liệu cá nhân — chỉ admin trở lên xem toàn bộ.
  const adminOnlyCollections = ['payments', 'returnRequests', 'users'];
  adminOnlyCollections.forEach((c) => api.get('/' + c, requireAdmin, (req, res) => res.json(read()[c] || [])));
  // Khách đã đăng nhập chỉ thấy đơn của chính mình; admin trở lên thấy toàn bộ cho dashboard.
  api.get('/orders', optionalAuth, (req, res) => {
    const all = read().orders || [];
    if (roleAtLeast(req.user?.role, 'admin')) return res.json(all);
    if (req.user?.id) return res.json(all.filter((order) => String(order.userId) === String(req.user.id)));
    return res.status(401).json({ ok: false, message: 'Bạn cần đăng nhập để xem đơn hàng.' });
  });
  // Thông báo chung (không userId) ai cũng thấy; thông báo riêng chỉ đúng chủ thấy.
  api.get('/notifications', optionalAuth, (req, res) => {
    const all = read().notifications || [];
    const visible = all.filter((n) => !n.userId || (req.user?.id && String(n.userId) === String(req.user.id)));
    res.json(visible);
  });
  api.get('/shop', (req, res) => res.json(publicShop(read().shop || {})));

  // phân tích doanh thu/nhu cầu/xu hướng/phân khúc khách hàng cho dashboard admin.
  // Bắt buộc admin: payload gồm doanh thu theo kỳ, dự báo, phân khúc và danh
  // sách khách có nguy cơ rời bỏ (kèm tên, số đơn, số tiền đã chi) — toàn bộ
  // sổ sách kinh doanh. Trước đây route này để trống quyền nên ai gọi cũng đọc được.
  api.get('/analytics', requireAdmin, (req, res) => {
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
