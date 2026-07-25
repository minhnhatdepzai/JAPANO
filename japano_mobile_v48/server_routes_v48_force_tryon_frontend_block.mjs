// ================= JAPANO V48 FORCE TRYON FRONTEND ROUTES START =================

const JAPANO_V48_GATEWAY_URL = process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001';
const JAPANO_V48_EXTRA_ACCESSORIES = [
  {
    "id": "v48-umbrella-clear",
    "sku": "V48-UMBRELLA-CLEAR",
    "slug": "v48-umbrella-clear",
    "name": "Dù trong suốt phong cách Nhật",
    "category": "accessories",
    "subcategory": "umbrella",
    "price": 179000,
    "originalPrice": 229000,
    "discountPercent": 22,
    "image": "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Du+2",
      "https://placehold.co/900x1200/ecfeff/0891b2?text=Du+3"
    ],
    "sizes": [
      "Free size"
    ],
    "colors": [
      "Trong suốt",
      "Trắng"
    ],
    "fit": "cầm tay",
    "visualTags": [
      "umbrella",
      "rainy",
      "japan",
      "transparent",
      "cute"
    ],
    "description": "Dù trong suốt dùng làm phụ kiện phối outfit khi chụp ngoài trời.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v48-headscarf-pastel",
    "sku": "V48-HEADSCARF-PASTEL",
    "slug": "v48-headscarf-pastel",
    "name": "Khăn trùm đầu lụa pastel",
    "category": "accessories",
    "subcategory": "headscarf",
    "price": 129000,
    "originalPrice": 169000,
    "discountPercent": 24,
    "image": "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Khan+2",
      "https://placehold.co/900x1200/ecfeff/0891b2?text=Khan+3"
    ],
    "sizes": [
      "Free size"
    ],
    "colors": [
      "Hồng pastel",
      "Kem"
    ],
    "fit": "lụa nhẹ",
    "visualTags": [
      "headscarf",
      "scarf",
      "pastel",
      "soft",
      "feminine"
    ],
    "description": "Khăn trùm đầu/khăn lụa nhẹ phối với váy, croptop hoặc outfit đi biển.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v48-necklace-silver",
    "sku": "V48-NECKLACE-SILVER",
    "slug": "v48-necklace-silver",
    "name": "Dây chuyền bạc mảnh 45cm",
    "category": "accessories",
    "subcategory": "necklace",
    "price": 89000,
    "originalPrice": 119000,
    "discountPercent": 25,
    "image": "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Day+chuyen+2"
    ],
    "sizes": [
      "40cm",
      "45cm",
      "50cm"
    ],
    "colors": [
      "Bạc"
    ],
    "fit": "45cm cổ vừa",
    "visualTags": [
      "necklace",
      "silver",
      "minimal"
    ],
    "description": "Dây chuyền mảnh hợp áo cổ rộng, croptop, váy, sơ mi.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v48-watch-gold",
    "sku": "V48-WATCH-GOLD",
    "slug": "v48-watch-gold",
    "name": "Đồng hồ nữ mặt nhỏ 32mm",
    "category": "accessories",
    "subcategory": "watch",
    "price": 219000,
    "originalPrice": 279000,
    "discountPercent": 22,
    "image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Dong+ho+2"
    ],
    "sizes": [
      "28mm",
      "32mm",
      "36mm"
    ],
    "colors": [
      "Vàng",
      "Bạc"
    ],
    "fit": "mặt nhỏ",
    "visualTags": [
      "watch",
      "gold",
      "32mm",
      "elegant"
    ],
    "description": "Đồng hồ nữ mặt nhỏ phối sơ mi, blazer, cardigan.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v48-bag-mini-black",
    "sku": "V48-BAG-MINI-BLACK",
    "slug": "v48-bag-mini-black",
    "name": "Túi xách đen mini",
    "category": "accessories",
    "subcategory": "bags",
    "price": 199000,
    "originalPrice": 249000,
    "discountPercent": 20,
    "image": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Tui+2"
    ],
    "sizes": [
      "Free size"
    ],
    "colors": [
      "Đen"
    ],
    "fit": "mini bag",
    "visualTags": [
      "bag",
      "black",
      "mini",
      "street"
    ],
    "description": "Túi xách mini phối crop top, váy, blazer, outfit đi chơi.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v48-sunglasses-oval",
    "sku": "V48-SUNGLASSES-OVAL",
    "slug": "v48-sunglasses-oval",
    "name": "Kính mát oval đen",
    "category": "accessories",
    "subcategory": "glasses",
    "price": 129000,
    "originalPrice": 159000,
    "discountPercent": 19,
    "image": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Kinh+2"
    ],
    "sizes": [
      "Free size"
    ],
    "colors": [
      "Đen"
    ],
    "fit": "oval",
    "visualTags": [
      "sunglasses",
      "black",
      "oval",
      "beach"
    ],
    "description": "Kính mát oval hợp outfit đi biển, street style, croptop.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v48-earrings-pearl",
    "sku": "V48-EARRINGS-PEARL",
    "slug": "v48-earrings-pearl",
    "name": "Bông tai ngọc trai nhỏ",
    "category": "accessories",
    "subcategory": "earrings",
    "price": 89000,
    "originalPrice": 119000,
    "discountPercent": 25,
    "image": "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Bong+tai+2"
    ],
    "sizes": [
      "Free size"
    ],
    "colors": [
      "Trắng ngọc trai"
    ],
    "fit": "nhỏ gọn",
    "visualTags": [
      "earrings",
      "pearl",
      "elegant",
      "small"
    ],
    "description": "Bông tai nhỏ giúp outfit thanh lịch hơn.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v48-belt-brown",
    "sku": "V48-BELT-BROWN",
    "slug": "v48-belt-brown",
    "name": "Thắt lưng nâu basic",
    "category": "accessories",
    "subcategory": "belt",
    "price": 99000,
    "originalPrice": 139000,
    "discountPercent": 29,
    "image": "https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=That+lung+2"
    ],
    "sizes": [
      "Free size"
    ],
    "colors": [
      "Nâu",
      "Đen"
    ],
    "fit": "eo 60-85cm",
    "visualTags": [
      "belt",
      "brown",
      "basic",
      "waist"
    ],
    "description": "Thắt lưng phối jeans, váy chữ A, quần ống rộng.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v48-hairclip-ribbon",
    "sku": "V48-HAIRCLIP-RIBBON",
    "slug": "v48-hairclip-ribbon",
    "name": "Kẹp tóc nơ đen",
    "category": "accessories",
    "subcategory": "hairclip",
    "price": 59000,
    "originalPrice": 79000,
    "discountPercent": 25,
    "image": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Kep+toc+2"
    ],
    "sizes": [
      "Free size"
    ],
    "colors": [
      "Đen"
    ],
    "fit": "kẹp tóc",
    "visualTags": [
      "hairclip",
      "ribbon",
      "cute",
      "black"
    ],
    "description": "Kẹp tóc nơ đen phối phong cách dễ thương, học đường, Nhật.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  }
];

function v48FirstImage(product = {}) {
  const p = product || {};
  if (Array.isArray(p.images) && p.images[0]) {
    const first = p.images[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.secure_url) return first.secure_url;
  }
  return p.image || p.firstImage || p.thumbnail || p.photo || '';
}

function v48PublicProduct(product = {}) {
  try {
    const base = typeof publicProductView === 'function' ? publicProductView(product) : product;
    const image = v48FirstImage(base) || base.image;
    return { ...base, image, firstImage: image };
  } catch {
    const image = v48FirstImage(product) || product.image;
    return { ...product, image, firstImage: image };
  }
}

function v48ProductText(p = {}) {
  return `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${p.description || ''} ${(p.visualTags || []).join(' ')}`.toLowerCase();
}

function v48IsAccessory(p = {}) {
  const t = v48ProductText(p);
  return ['accessory','accessories','phụ kiện','phu kien','dây chuyền','day chuyen','necklace','đồng hồ','dong ho','watch','túi','tui','bag','tote','kính','kinh','glasses','sunglasses','nón','non','hat','vòng','vong','bracelet','dù','du','umbrella','khăn','khan','scarf','headscarf','bông tai','bong tai','earrings','thắt lưng','that lung','belt','kẹp tóc','kep toc','hairclip'].some((x) => t.includes(x));
}

function v48DataUriToBuffer(data = '') {
  const text = String(data || '');
  const base64 = text.includes(',') ? text.split(',').pop() : text;
  return Buffer.from(base64 || '', 'base64');
}

function v48BufferToDataUri(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
}

async function v48GatewayPost(pathName, body, timeout = 300000) {
  const url = `${JAPANO_V48_GATEWAY_URL.replace(/\/+$/, '')}${pathName}`;
  const res = await axios.post(url, body, { timeout, maxBodyLength: 80 * 1024 * 1024, maxContentLength: 80 * 1024 * 1024 });
  return res.data;
}

async function v48DownloadImage(url, fallbackName = 'shop-image.jpg') {
  if (!url || !/^https?:\/\//i.test(String(url))) throw new Error(`Sản phẩm shop chưa có link ảnh hợp lệ: ${fallbackName}`);
  const fetched = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 30 * 1024 * 1024 });
  const mimeType = String(fetched.headers['content-type'] || 'image/jpeg').split(';')[0];
  if (!mimeType.startsWith('image/')) throw new Error('Ảnh sản phẩm shop không hợp lệ.');
  return { buffer: Buffer.from(fetched.data), mimeType, sourceUrl: url };
}

async function v48AllProducts(limit = 500) {
  const rows = await Product.find({ status: { $ne: 'archived' } }).limit(limit).lean();
  return rows.map(v48PublicProduct).filter((p) => v48FirstImage(p));
}

async function v48FindProductByAnyId(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  try {
    if (/^[a-f0-9]{24}$/i.test(key)) {
      const byMongo = await Product.findById(key).lean();
      if (byMongo) return v48PublicProduct(byMongo);
    }
  } catch {}
  const row = await Product.findOne({ $or: [{ id: key }, { sku: key }, { slug: key }, { name: key }] }).lean();
  return row ? v48PublicProduct(row) : null;
}

async function v48UpsertProduct(item) {
  const clean = { ...item, image: v48FirstImage(item) || item.image, images: Array.isArray(item.images) ? item.images : [item.image].filter(Boolean), status: 'active', allowTryOn: true };
  if (typeof ensureProductVariantFromItem === 'function') {
    const result = await ensureProductVariantFromItem(clean);
    return result?.product || result;
  }
  const query = { $or: [clean.id ? { id: clean.id } : null, clean.sku ? { sku: clean.sku } : null, clean.slug ? { slug: clean.slug } : null, clean.name ? { name: clean.name } : null].filter(Boolean) };
  return await Product.findOneAndUpdate(query, { $set: clean }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

function v48BuildTips({ mainProduct, accessories = [], sizeInfo = '', visual = null } = {}) {
  const accNames = accessories.map((x) => x.name).filter(Boolean);
  return {
    summary: `Đồ chính là "${mainProduct?.name || 'sản phẩm shop'}". Phụ kiện được chọn lại dựa trên ảnh người dùng và món đồ chính.`,
    sizeAdvice: [
      sizeInfo ? `Thông tin người dùng nhập: ${sizeInfo}` : 'Có thể nhập chiều cao/cân nặng/eo/hông/cổ tay để gợi ý size sát hơn.',
      mainProduct?.sizes?.length ? `Size sản phẩm đang thử: ${mainProduct.sizes.join(', ')}` : 'Kiểm tra bảng size thật của shop trước khi mua.',
    ],
    accessoryAdvice: [
      accNames.length ? `Phụ kiện hợp nhất: ${accNames.join(', ')}` : 'Chọn phụ kiện không che mặt và không che form đồ chính.',
      'Dù đặt ở tay; dây chuyền ở cổ; khăn trùm đầu ở đầu/tóc; đồng hồ/vòng ở cổ tay; túi ở vai/tay; kính ở mắt.',
    ],
    visualTags: visual?.visualTags || [],
  };
}

app.get('/api/v48/shop/products', async (req, res) => {
  try {
    const items = await v48AllProducts(500);
    res.json({ ok: true, count: items.length, items });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v48/shop/seed-extra-accessories', async (req, res) => {
  try {
    const saved = [];
    const failed = [];
    for (const item of JAPANO_V48_EXTRA_ACCESSORIES) {
      try { saved.push(v48PublicProduct(await v48UpsertProduct(item))); }
      catch (e) { failed.push({ id: item.id, message: e.message }); }
    }
    res.json({ ok: true, insertedOrUpdated: saved.length, failed, items: saved });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v48/shop/recommend-accessories', async (req, res) => {
  try {
    const mainProduct = await v48FindProductByAnyId(req.body?.mainProductId);
    if (!mainProduct) throw new Error('Không tìm thấy sản phẩm chính trong shop.');

    const all = await v48AllProducts(500);
    const accessories = all.filter(v48IsAccessory);

    let visual = null;
    try {
      if (req.body?.personImageBase64) {
        const personBuffer = v48DataUriToBuffer(req.body.personImageBase64);
        const tmp = path.join(os.tmpdir(), `japano-v48-suggest-${Date.now()}.jpg`);
        await fs.writeFile(tmp, personBuffer);
        visual = await analyzeMediaWithLocalVisionModel(tmp, 'image');
        await fs.unlink(tmp).catch(() => null);
      }
    } catch (e) { visual = { warning: e.message, visualTags: [] }; }

    const mainText = v48ProductText(mainProduct);
    const visualText = `${(visual?.visualTags || []).join(' ')}`.toLowerCase();

    function score(p) {
      const t = v48ProductText(p);
      let s = 0;
      for (const tag of (mainProduct.visualTags || [])) if (t.includes(String(tag).toLowerCase())) s += 2;
      for (const tag of (visual?.visualTags || [])) if (t.includes(String(tag).toLowerCase())) s += 2;
      if (mainText.includes('bikini') || mainText.includes('swim') || mainText.includes('đồ bơi')) {
        if (t.includes('dù') || t.includes('umbrella') || t.includes('kính') || t.includes('sunglasses') || t.includes('khăn') || t.includes('túi')) s += 7;
      }
      if (mainText.includes('sơ mi') || mainText.includes('cardigan') || mainText.includes('blazer')) {
        if (t.includes('đồng hồ') || t.includes('watch') || t.includes('dây chuyền') || t.includes('necklace') || t.includes('bông tai')) s += 7;
      }
      if (mainText.includes('croptop') || mainText.includes('crop')) {
        if (t.includes('dây chuyền') || t.includes('necklace') || t.includes('túi') || t.includes('belt') || t.includes('kính')) s += 7;
      }
      if (visualText.includes('cute') || visualText.includes('soft')) {
        if (t.includes('kẹp tóc') || t.includes('khăn') || t.includes('pastel') || t.includes('ngọc trai')) s += 4;
      }
      return s;
    }

    const ranked = accessories.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s).map((x) => x.p);
    const autoSelected = ranked.slice(0, 3);
    const tips = v48BuildTips({ mainProduct, accessories: autoSelected, sizeInfo: req.body?.sizeInfo || '', visual });
    res.json({ ok: true, items: ranked, autoSelected, tips, visual });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v48/mobile/tryon-selected-product', async (req, res) => {
  try {
    const personImageBase64 = String(req.body?.personImageBase64 || '');
    if (!personImageBase64) throw new Error('Thiếu ảnh người dùng.');
    const mainProduct = await v48FindProductByAnyId(req.body?.mainProductId);
    if (!mainProduct) throw new Error('Không tìm thấy sản phẩm chính trong shop.');

    const accIds = Array.isArray(req.body?.accessoryProductIds) ? req.body.accessoryProductIds : [];
    const accessories = [];
    for (const id of accIds.slice(0, 5)) {
      const p = await v48FindProductByAnyId(id);
      if (p && v48IsAccessory(p)) accessories.push(p);
    }

    const personMime = (personImageBase64.match(/^data:([^;]+);base64,/i)?.[1]) || 'image/jpeg';
    const personBuffer = v48DataUriToBuffer(personImageBase64);
    const garment = await v48DownloadImage(v48FirstImage(mainProduct), mainProduct.name || 'main-product');
    const accessoryRefs = [];
    for (const p of accessories) {
      try { accessoryRefs.push(await v48DownloadImage(v48FirstImage(p), p.name || 'accessory')); } catch (e) { console.warn('[V48] accessory fail', e.message); }
    }

    const tips = v48BuildTips({ mainProduct, accessories, sizeInfo: req.body?.sizeInfo || '' });
    let gateway = null;
    try {
      gateway = await v48GatewayPost('/tryon/advanced', {
        personImageBase64: v48BufferToDataUri(personBuffer, personMime),
        garmentImageBase64: v48BufferToDataUri(garment.buffer, garment.mimeType),
        accessoryImagesBase64: accessoryRefs.map((x) => v48BufferToDataUri(x.buffer, x.mimeType)),
        product: mainProduct,
        accessories,
        adultConfirmed: Boolean(req.body?.adultConfirmed),
        preserveVisibleSkin: true,
        noExtraCovering: true,
        realisticRefine: true,
        anchorIdentity: 'uploaded-person-is-source',
        consistencyPolicy: 'first-image-anchor',
        prompt: [
          'Use uploaded person image as source person and identity anchor.',
          'Use first image of selected shop product as garment/product reference.',
          'There is NO user-uploaded product image field. Product image comes from shop database only.',
          'Do not paste person onto product sample. Put shop product onto uploaded person.',
          `Selected product: ${mainProduct.name || ''}`,
          `Selected accessories: ${accessories.map((x) => x.name).join(', ') || 'none'}`,
          'Attach accessories naturally: umbrella in hand, necklace on neck, headscarf on head/hair, watch/bracelet on wrist, bag on shoulder/hand, glasses on eyes.',
          'If multiple outputs are inconsistent, use the first image as final.',
        ].join('\n'),
      }, 300000);
    } catch (e) { gateway = { ok: false, message: e.message }; }

    let fallback = null;
    if (!gateway?.ok) {
      try {
        fallback = await v48GatewayPost('/generate/realistic', {
          prompt: [
            'Create a realistic fashion try-on preview.',
            'Main subject is uploaded user/person.',
            `Apply selected shop product: ${mainProduct.name || ''}.`,
            `Use selected shop accessories: ${accessories.map((x) => x.name).join(', ') || 'none'}.`,
            'Use shop products only. Keep close to first uploaded person image.',
          ].join('\n'),
          width: 768,
          height: 1024,
          steps: 4,
          adultConfirmed: Boolean(req.body?.adultConfirmed),
          allowSwimwear: true,
          noExtraCovering: true,
        }, 300000);
      } catch (e) { fallback = { ok: false, message: e.message }; }
    }

    const finalImageBase64 = gateway?.imageBase64 || fallback?.imageBase64 || '';
    res.json({
      ok: true,
      message: gateway?.ok
        ? 'Đã tạo thử đồ với sản phẩm người dùng bấm trong shop.'
        : fallback?.ok
          ? 'Try-on runner chưa nối trực tiếp; đã fallback generate theo sản phẩm shop.'
          : 'AI Gateway chưa trả ảnh, nhưng frontend/backend đã lấy đúng sản phẩm và phụ kiện từ shop.',
      finalImageBase64,
      mainProduct,
      accessories,
      tips,
      gateway,
      fallback,
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ================= JAPANO V48 FORCE TRYON FRONTEND ROUTES END =================
