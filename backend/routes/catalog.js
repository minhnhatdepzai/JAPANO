// Danh mục sản phẩm: danh sách, video, sản phẩm liên quan, mô tả AI, CRUD admin,
// và tra cứu địa giới hành chính Việt Nam (tỉnh/phường dùng cho địa chỉ).
const { successfulLiveOrder } = require('../lib/orderStatus');
const { resolveGarmentImage } = require('../lib/garmentImages');
const { OLLAMA_URL } = require('../lib/serviceUrls');
const { runGpuJob, GpuJobCancelledError } = require('../lib/gpuArbiter');

module.exports = function registerCatalogRoutes(api, ctx) {
  const {
    read, update, httpError, mongoEnabled, getDb, vietnamUnits, tryonGpuBusy,
    getRelatedProducts, analyzeProductImage, fallbackProductDescription, ensureVietnameseProductDescription,
    requireAdmin, requireStaff, roleAtLeast,
  } = ctx;

  // Ảnh sản phẩm thật đã đồng bộ lên Cloudinary (xem backend/scripts/syncProductsToCloud.js)
  // được cache trong bộ nhớ và làm mới định kỳ; MongoDB chỉ giữ URL/id, không giữ dữ liệu ảnh.
  let cloudProductImages = new Map();
  let cloudProductImagesLoadedAt = 0;
  const CLOUD_PRODUCT_IMAGES_TTL_MS = 60000;
  async function refreshCloudProductImages() {
    if (!mongoEnabled()) return;
    try {
      const db = await getDb();
      const docs = await db.collection('product_media').find({ type: 'image' }).sort({ productId: 1, position: 1 }).toArray();
      const map = new Map();
      for (const doc of docs) {
        const productId = String(doc.productId || '');
        if (!productId || !doc.url) continue;
        if (!map.has(productId)) map.set(productId, []);
        map.get(productId).push(doc.url);
      }
      cloudProductImages = map;
      cloudProductImagesLoadedAt = Date.now();
    } catch {
      // giữ cache cũ nếu Mongo tạm thời không phản hồi
    }
  }
  function ensureCloudProductImagesFresh() {
    if (Date.now() - cloudProductImagesLoadedAt > CLOUD_PRODUCT_IMAGES_TTL_MS) void refreshCloudProductImages();
  }
  void refreshCloudProductImages();

  function publicProduct(product, state) {
    const slug = encodeURIComponent(String(product.slug || product.id || 'san-pham'));
    const approvedReviews = (state.reviews || []).filter((review) => review.productId === product.slug && review.status === 'approved');
    const reviewCount = approvedReviews.length;
    const rating = reviewCount ? Math.round(approvedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount * 10) / 10 : 0;
    const sold = (state.orders || []).filter(successfulLiveOrder).reduce((total, order) => total + (order.items || []).filter((item) => String(item.slug || item.productId) === String(product.slug)).reduce((sum, item) => sum + Number(item.qty || 0), 0), 0);
    const cloudImages = cloudProductImages.get(String(product.id)) || cloudProductImages.get(String(product.slug));
    return {
      ...product,
      images: cloudImages && cloudImages.length ? cloudImages : product.images,
      rating,
      reviewCount,
      sold,
      videos: (product.videos || []).map((video, index) => {
        const raw = typeof video === 'string' ? video : video?.url;
        if (String(raw || '').startsWith('data:video/')) {
          return { ...(typeof video === 'object' ? video : {}), url: `/api/products/${slug}/videos/${index}` };
        }
        return typeof video === 'string' ? { url: video } : video;
      }),
    };
  }

  // Chỉ trả sản phẩm published/active cho khách — draft (chưa có ảnh thật)/
  // archived/hidden chỉ admin thấy qua /api/state. App mobile vốn đã tự lọc
  // tương tự phía client; lọc thêm ở đây để bất kỳ client nào gọi thẳng API
  // cũng không thấy sản phẩm chưa sẵn sàng bán.
  api.get('/products', (req, res) => {
    ensureCloudProductImagesFresh();
    const state = read();
    const visible = (state.products || []).filter((product) => !product.status || ['published', 'active'].includes(String(product.status)));
    res.json(visible.map((product) => publicProduct(product, state)));
  });
  api.get('/products/:slug/videos/:index', (req, res) => {
    const state = read();
    const product = state.products.find((item) => item.slug === String(req.params.slug) || item.id === String(req.params.slug));
    const video = product?.videos?.[Number(req.params.index)];
    const raw = typeof video === 'string' ? video : video?.url;
    const match = String(raw || '').match(/^data:(video\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
    if (!match) {
      if (/^https?:\/\//i.test(String(raw || ''))) return res.redirect(raw);
      return res.status(404).json({ ok: false, message: 'Không tìm thấy video sản phẩm.' });
    }
    const bytes = Buffer.from(match[2], 'base64');
    const range = req.headers.range;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', match[1]);
    if (range) {
      const parsed = range.match(/bytes=(\d*)-(\d*)/);
      const start = Math.max(0, Number(parsed?.[1] || 0));
      const end = Math.min(bytes.length - 1, Number(parsed?.[2] || bytes.length - 1));
      if (start > end) return res.status(416).end();
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
      res.setHeader('Content-Length', end - start + 1);
      return res.end(bytes.subarray(start, end + 1));
    }
    res.setHeader('Content-Length', bytes.length);
    res.end(bytes);
  });

  // Staff chỉ thấy/sửa được sản phẩm do chính mình tạo (ownerId); admin trở
  // lên không bị giới hạn phạm vi này.
  api.get('/staff/products', requireStaff, (req, res) => {
    const state = read();
    const scoped = roleAtLeast(req.user.role, 'admin')
      ? state.products
      : state.products.filter((product) => String(product.ownerId || '') === String(req.user.id));
    res.json(scoped);
  });

  api.put('/products/:id', requireStaff, (req, res) => {
    try {
      let saved;
      update((state) => {
        const id = String(req.params.id);
        const index = state.products.findIndex((product) => String(product.id) === id || String(product.slug) === id);
        const existing = index >= 0 ? state.products[index] : null;
        const isStaffOnly = !roleAtLeast(req.user.role, 'admin');
        if (isStaffOnly && existing && String(existing.ownerId || '') !== String(req.user.id)) {
          throw httpError(403, 'Bạn chỉ có thể sửa sản phẩm do chính mình đăng.');
        }
        const incoming = req.body && typeof req.body === 'object' ? req.body : {};
        if (!String(incoming.name || '').trim()) throw httpError(400, 'Tên sản phẩm không được để trống.');
        const product = { ...(existing || {}), ...incoming };
        product.id ||= `p${Date.now()}`;
        product.slug ||= String(product.name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        product.images = Array.isArray(product.images) ? product.images : [];
        product.videos = Array.isArray(product.videos) ? product.videos : [];
        product.variants = Array.isArray(product.variants) ? product.variants : [];
        product.image = product.images[0] || product.image || '';
        // Sản phẩm do staff đăng luôn gắn ownerId của chính họ — không cho đổi
        // sang người khác dù gửi field này lên.
        if (isStaffOnly) product.ownerId = req.user.id;
        // Xuất bản (bất kỳ trạng thái nào ngoài draft/archived/hidden) cần tối
        // thiểu 2 ảnh thật — tránh sản phẩm lên shop với 0-1 ảnh trông thiếu chuyên nghiệp.
        const publishing = !['draft', 'archived', 'hidden'].includes(String(product.status || 'published'));
        if (publishing && product.images.length < 2) {
          throw httpError(400, 'Cần ít nhất 2 ảnh sản phẩm trước khi xuất bản — hãy tải thêm ảnh hoặc để trạng thái "draft".');
        }
        product.updatedAt = Date.now();
        if (index >= 0) state.products[index] = product; else state.products.push(product);
        state.seeded = true;
        saved = product;
        return state;
      });
      res.json({ ok: true, product: saved });
    } catch (error) {
      res.status(error.status || 400).json({ ok: false, message: error.message || 'Không lưu được sản phẩm.' });
    }
  });

  api.delete('/products/:id', requireAdmin, (req, res) => {
    let removed = null;
    update((state) => {
      const id = String(req.params.id);
      const index = state.products.findIndex((product) => String(product.id) === id || String(product.slug) === id);
      if (index >= 0) [removed] = state.products.splice(index, 1);
      return state;
    });
    if (!removed) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
    res.json({ ok: true, product: removed });
  });

  const normalizeSearch = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function locationScore(name, query) {
    const normalized = normalizeSearch(name), compactName = normalized.replace(/\s+/g, ''), compactQuery = normalizeSearch(query).replace(/\s+/g, '');
    if (!compactQuery) return 1;
    if (compactName === compactQuery) return 100;
    if (compactName.startsWith(compactQuery)) return 80;
    if (compactName.includes(compactQuery)) return 60;
    const tokens = normalizeSearch(query).split(' ').filter(Boolean);
    return tokens.reduce((score, token) => score + (normalized.includes(token) ? 8 : 0), 0);
  }
  api.get('/locations/provinces', (req, res) => {
    const query = String(req.query.q || '');
    const items = vietnamUnits.map((province) => ({ code: province.Code, name: province.FullName, wardCount: province.Wards.length }))
      .map((province) => ({ ...province, score: locationScore(province.name, query) }))
      .filter((province) => province.score > 0)
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'vi'));
    res.json({ ok: true, source: 'Danh mục hành chính Việt Nam', updatedFor: '34 tỉnh/thành, 3.321 đơn vị cấp xã', items });
  });
  api.get('/locations/wards', (req, res) => {
    const province = vietnamUnits.find((item) => item.Code === String(req.query.provinceCode || ''));
    if (!province) return res.status(400).json({ ok: false, message: 'Hãy chọn tỉnh/thành phố hợp lệ.' });
    const query = String(req.query.q || ''), limit = Math.min(200, Math.max(1, Number(req.query.limit || 80)));
    const items = province.Wards.map((ward) => ({ code: ward.Code, name: ward.FullName, provinceCode: ward.ProvinceCode, score: locationScore(ward.FullName, query) }))
      .filter((ward) => ward.score > 0)
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'vi'))
      .slice(0, limit);
    res.json({ ok: true, province: { code: province.Code, name: province.FullName }, total: province.Wards.length, items });
  });

  // sản phẩm liên quan (item-based CF + content-based + xu hướng)
  api.get('/products/:slug/related', (req, res) => {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
    res.json({ productIds: getRelatedProducts(read(), req.params.slug, limit) });
  });

  // Qwen3-VL nhìn ảnh catalog, nhưng luôn bám tên/tag sản phẩm và có fallback tức thời.
  api.get('/products/:slug/ai-description', async (req, res) => {
    const state = read();
    const product = state.products.find((item) => item.slug === String(req.params.slug) || item.id === String(req.params.slug));
    if (!product) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
    const cached = (state.aiDescriptions || []).find((item) => item.productId === product.slug);
    const cachedAge = cached ? Date.now() - Number(cached.generatedAt || 0) : Infinity;
    const isVisionCache = ['qwen3-vl:8b', 'thi-giac-san-pham'].includes(cached?.description?.engine);
    if (cached && req.query.refresh !== '1' && (isVisionCache || cachedAge < 10 * 60 * 1000)) {
      const localized = ensureVietnameseProductDescription(cached.description, product);
      if (JSON.stringify(localized) !== JSON.stringify(cached.description)) {
        update((next) => {
          const row = next.aiDescriptions.find((item) => item.productId === product.slug);
          if (row) row.description = localized;
          return next;
        });
      }
      return res.json({ ok: true, cached: true, ...localized });
    }
    if (tryonGpuBusy()) {
      return res.json({ ok: true, cached: false, gpuBusy: true, ...fallbackProductDescription(product) });
    }
    const imagePath = resolveGarmentImage(product.slug);
    let description;
    try {
      description = await runGpuJob('vision', ({ signal }) => analyzeProductImage({
        product,
        imagePath,
        ollamaUrl: OLLAMA_URL,
        model: process.env.JAPANO_VISION_MODEL || 'qwen3-vl:8b',
        timeoutMs: Number(process.env.JAPANO_VISION_TIMEOUT_MS || 120000),
        signal,
      }), { productId: product.slug });
    } catch (error) {
      if (error instanceof GpuJobCancelledError || error?.code === 'GPU_JOB_CANCELLED') {
        return res.json({
          ok: true,
          cached: false,
          gpuBusy: true,
          ...fallbackProductDescription(product),
        });
      }
      throw error;
    }
    update((next) => {
      const row = { productId: product.slug, generatedAt: Date.now(), description };
      const index = next.aiDescriptions.findIndex((item) => item.productId === product.slug);
      if (index >= 0) next.aiDescriptions[index] = row; else next.aiDescriptions.push(row);
      return next;
    });
    res.json({ ok: true, cached: false, ...description });
  });

  return { publicProduct, ensureCloudProductImagesFresh };
};
