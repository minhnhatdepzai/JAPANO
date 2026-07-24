// ================= JAPANO V47 SELECTED PRODUCT ACCESSORY ROUTES START =================

const JAPANO_V47_GATEWAY_URL = process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001';
const JAPANO_V47_EXTRA_ACCESSORIES = [
  {
    "id": "v47-umbrella-001",
    "sku": "V47-UMBRELLA-001",
    "slug": "v47-umbrella-001",
    "name": "Dù trong suốt phong cách Nhật",
    "category": "accessories",
    "subcategory": "umbrella",
    "price": 179000,
    "originalPrice": 229000,
    "discountPercent": 22,
    "image": "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=umbrella+2",
      "https://placehold.co/900x1200/ecfeff/0891b2?text=umbrella+3",
      "https://placehold.co/900x1200/fff7ed/c2410c?text=umbrella+4"
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
    "id": "v47-headscarf-002",
    "sku": "V47-HEADSCARF-002",
    "slug": "v47-headscarf-002",
    "name": "Khăn trùm đầu lụa pastel",
    "category": "accessories",
    "subcategory": "headscarf",
    "price": 129000,
    "originalPrice": 169000,
    "discountPercent": 24,
    "image": "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=headscarf+2",
      "https://placehold.co/900x1200/ecfeff/0891b2?text=headscarf+3",
      "https://placehold.co/900x1200/fff7ed/c2410c?text=headscarf+4"
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
    "description": "Khăn trùm đầu/khăn lụa nhẹ phối với váy, áo croptop hoặc outfit đi biển.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v47-earrings-pearl-003",
    "sku": "V47-EARRINGS-PEARL-003",
    "slug": "v47-earrings-pearl-003",
    "name": "Bông tai ngọc trai nhỏ",
    "category": "accessories",
    "subcategory": "earrings",
    "price": 89000,
    "originalPrice": 119000,
    "discountPercent": 25,
    "image": "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=earrings+2",
      "https://placehold.co/900x1200/ecfeff/0891b2?text=earrings+3",
      "https://placehold.co/900x1200/fff7ed/c2410c?text=earrings+4"
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
    "description": "Bông tai nhỏ giúp outfit thanh lịch hơn, hợp sơ mi, cardigan, váy.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v47-belt-brown-004",
    "sku": "V47-BELT-BROWN-004",
    "slug": "v47-belt-brown-004",
    "name": "Thắt lưng nâu basic",
    "category": "accessories",
    "subcategory": "belt",
    "price": 99000,
    "originalPrice": 139000,
    "discountPercent": 29,
    "image": "https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=belt+2",
      "https://placehold.co/900x1200/ecfeff/0891b2?text=belt+3",
      "https://placehold.co/900x1200/fff7ed/c2410c?text=belt+4"
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
    "description": "Thắt lưng dùng phối quần jeans, váy chữ A, quần ống rộng.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v47-hairclip-ribbon-005",
    "sku": "V47-HAIRCLIP-RIBBON-005",
    "slug": "v47-hairclip-ribbon-005",
    "name": "Kẹp tóc nơ đen",
    "category": "accessories",
    "subcategory": "hairclip",
    "price": 59000,
    "originalPrice": 79000,
    "discountPercent": 25,
    "image": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=hairclip+2",
      "https://placehold.co/900x1200/ecfeff/0891b2?text=hairclip+3",
      "https://placehold.co/900x1200/fff7ed/c2410c?text=hairclip+4"
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
  },
  {
    "id": "v47-tote-flower-006",
    "sku": "V47-TOTE-FLOWER-006",
    "slug": "v47-tote-flower-006",
    "name": "Túi tote hoa mini",
    "category": "accessories",
    "subcategory": "bags",
    "price": 149000,
    "originalPrice": 189000,
    "discountPercent": 21,
    "image": "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=tote+2",
      "https://placehold.co/900x1200/ecfeff/0891b2?text=tote+3",
      "https://placehold.co/900x1200/fff7ed/c2410c?text=tote+4"
    ],
    "sizes": [
      "Free size"
    ],
    "colors": [
      "Kem",
      "Hoa nhí"
    ],
    "fit": "đeo vai",
    "visualTags": [
      "tote",
      "bag",
      "flower",
      "casual",
      "cute"
    ],
    "description": "Túi tote hoa mini phối với outfit đi học, cafe, du lịch nhẹ.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  }
];

function v47FirstImage(product = {}) {
  const p = product || {};
  if (Array.isArray(p.images) && p.images[0]) {
    const first = p.images[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.secure_url) return first.secure_url;
  }
  return p.image || p.firstImage || p.thumbnail || p.photo || '';
}

function v47PublicProduct(product = {}) {
  try {
    const base = typeof publicProductView === 'function' ? publicProductView(product) : product;
    const image = v47FirstImage(base) || base.image;
    return { ...base, image, firstImage: image };
  } catch {
    const image = v47FirstImage(product) || product.image;
    return { ...product, image, firstImage: image };
  }
}

function v47ProductText(p = {}) {
  return `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${p.description || ''} ${(p.visualTags || []).join(' ')}`.toLowerCase();
}

function v47IsAccessory(p = {}) {
  const t = v47ProductText(p);
  return ['accessory','accessories','phụ kiện','phu kien','dây chuyền','day chuyen','necklace','đồng hồ','dong ho','watch','túi','tui','bag','tote','kính','kinh','glasses','sunglasses','nón','non','hat','vòng','vong','bracelet','dù','du','umbrella','khăn','khan','scarf','headscarf','bông tai','bong tai','earrings','thắt lưng','that lung','belt','kẹp tóc','kep toc','hairclip'].some((x) => t.includes(x));
}

function v47DataUriToBuffer(data = '') {
  const text = String(data || '');
  const base64 = text.includes(',') ? text.split(',').pop() : text;
  return Buffer.from(base64 || '', 'base64');
}

function v47BufferToDataUri(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
}

async function v47GatewayPost(pathName, body, timeout = 300000) {
  const url = `${JAPANO_V47_GATEWAY_URL.replace(/\/+$/, '')}${pathName}`;
  const res = await axios.post(url, body, { timeout, maxBodyLength: 80 * 1024 * 1024, maxContentLength: 80 * 1024 * 1024 });
  return res.data;
}

async function v47DownloadImage(url, fallbackName = 'shop-image.jpg') {
  if (!url || !/^https?:\/\//i.test(String(url))) {
    throw new Error(`Sản phẩm shop chưa có link ảnh hợp lệ: ${fallbackName}`);
  }
  const fetched = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 30 * 1024 * 1024 });
  const mimeType = String(fetched.headers['content-type'] || 'image/jpeg').split(';')[0];
  if (!mimeType.startsWith('image/')) throw new Error('Ảnh sản phẩm shop không hợp lệ.');
  return { buffer: Buffer.from(fetched.data), mimeType, sourceUrl: url };
}

async function v47AllProducts(limit = 500) {
  const rows = await Product.find({ status: { $ne: 'archived' } }).limit(limit).lean();
  return rows.map(v47PublicProduct).filter((p) => v47FirstImage(p));
}

async function v47FindProductByAnyId(id) {
  const key = String(id || '').trim();
  if (!key) return null;

  try {
    if (/^[a-f0-9]{24}$/i.test(key)) {
      const byMongo = await Product.findById(key).lean();
      if (byMongo) return v47PublicProduct(byMongo);
    }
  } catch {}

  const row = await Product.findOne({
    $or: [
      { id: key },
      { sku: key },
      { slug: key },
      { name: key },
    ],
  }).lean();

  return row ? v47PublicProduct(row) : null;
}

async function v47UpsertProduct(item) {
  const clean = {
    ...item,
    image: v47FirstImage(item) || item.image,
    images: Array.isArray(item.images) && item.images.length ? item.images : [item.image].filter(Boolean),
    status: 'active',
    allowTryOn: true,
  };

  if (typeof ensureProductVariantFromItem === 'function') {
    const result = await ensureProductVariantFromItem(clean);
    return result?.product || result;
  }

  const query = {
    $or: [
      clean.id ? { id: clean.id } : null,
      clean.sku ? { sku: clean.sku } : null,
      clean.slug ? { slug: clean.slug } : null,
      clean.name ? { name: clean.name } : null,
    ].filter(Boolean),
  };

  return await Product.findOneAndUpdate(query, { $set: clean }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

function v47BuildTips({ mainProduct, accessories = [], sizeInfo = '', visual = null } = {}) {
  const mainName = mainProduct?.name || 'sản phẩm shop';
  const accNames = accessories.map((x) => x.name).filter(Boolean);
  const styleTags = [...new Set([...(mainProduct?.visualTags || []), ...(visual?.visualTags || [])])];
  return {
    summary: `Dựa trên ảnh người dùng và món "${mainName}", hệ thống ưu tiên phụ kiện cùng tone và đúng vị trí khi thử đồ.`,
    styleTags,
    sizeAdvice: [
      sizeInfo ? `Thông tin người dùng nhập: ${sizeInfo}` : 'Có thể nhập chiều cao/cân nặng/eo/hông/cổ tay để gợi ý size chính xác hơn.',
      mainProduct?.sizes?.length ? `Size sản phẩm đang thử: ${mainProduct.sizes.join(', ')}` : 'Kiểm tra bảng size thực tế của shop trước khi mua.',
    ],
    accessoryAdvice: [
      accNames.length ? `Phụ kiện gợi ý: ${accNames.join(', ')}` : 'Chọn phụ kiện nhẹ, không che mặt và không che form đồ chính.',
      'Dù đặt ở tay; dây chuyền ở cổ; khăn trùm đầu ở tóc/đầu; đồng hồ/vòng ở cổ tay; túi ở vai/tay; kính ở mắt.',
    ],
  };
}

app.get('/api/v47/shop/products', async (req, res) => {
  try {
    const type = String(req.query?.type || 'all');
    let items = await v47AllProducts(500);
    if (type === 'accessories') items = items.filter(v47IsAccessory);
    if (type === 'garments') items = items.filter((p) => !v47IsAccessory(p));
    res.json({ ok: true, count: items.length, items });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v47/shop/seed-extra-accessories', async (req, res) => {
  try {
    const saved = [];
    const failed = [];
    for (const item of JAPANO_V47_EXTRA_ACCESSORIES) {
      try {
        const p = await v47UpsertProduct(item);
        saved.push(v47PublicProduct(p));
      } catch (e) {
        failed.push({ id: item.id, message: e.message });
      }
    }
    res.json({ ok: true, insertedOrUpdated: saved.length, failed, items: saved });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v47/shop/recommend-accessories', async (req, res) => {
  try {
    const mainProduct = await v47FindProductByAnyId(req.body?.mainProductId);
    if (!mainProduct) throw new Error('Không tìm thấy sản phẩm chính trong shop.');

    const all = await v47AllProducts(500);
    const accessories = all.filter(v47IsAccessory);

    let visual = null;
    try {
      if (req.body?.personImageBase64) {
        const personBuffer = v47DataUriToBuffer(req.body.personImageBase64);
        const tmp = path.join(os.tmpdir(), `japano-v47-suggest-${Date.now()}.jpg`);
        await fs.writeFile(tmp, personBuffer);
        visual = await analyzeMediaWithLocalVisionModel(tmp, 'image');
        await fs.unlink(tmp).catch(() => null);
      }
    } catch (e) {
      visual = { warning: e.message, visualTags: [] };
    }

    const mainText = v47ProductText(mainProduct);
    const visualText = `${(visual?.visualTags || []).join(' ')}`.toLowerCase();

    function score(p) {
      const t = v47ProductText(p);
      let s = 0;
      for (const tag of (mainProduct.visualTags || [])) {
        if (t.includes(String(tag).toLowerCase())) s += 2;
      }
      for (const tag of (visual?.visualTags || [])) {
        if (t.includes(String(tag).toLowerCase())) s += 2;
      }
      if (mainText.includes('bikini') || mainText.includes('swim') || mainText.includes('đồ bơi')) {
        if (t.includes('dù') || t.includes('umbrella') || t.includes('kính') || t.includes('sunglasses') || t.includes('khăn') || t.includes('túi')) s += 5;
      }
      if (mainText.includes('sơ mi') || mainText.includes('cardigan') || mainText.includes('blazer')) {
        if (t.includes('đồng hồ') || t.includes('watch') || t.includes('dây chuyền') || t.includes('necklace') || t.includes('bông tai')) s += 5;
      }
      if (mainText.includes('croptop') || mainText.includes('crop')) {
        if (t.includes('dây chuyền') || t.includes('necklace') || t.includes('túi') || t.includes('belt') || t.includes('kính')) s += 5;
      }
      if (visualText.includes('cute') || visualText.includes('soft')) {
        if (t.includes('kẹp tóc') || t.includes('khăn') || t.includes('pastel') || t.includes('ngọc trai')) s += 3;
      }
      return s;
    }

    const ranked = accessories
      .map((p) => ({ p, s: score(p) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);

    const autoSelected = ranked.slice(0, 3);
    const tips = v47BuildTips({ mainProduct, accessories: autoSelected, sizeInfo: req.body?.sizeInfo || '', visual });

    res.json({ ok: true, items: ranked, autoSelected, tips, visual });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v47/mobile/tryon-selected-product', async (req, res) => {
  try {
    const personImageBase64 = String(req.body?.personImageBase64 || '');
    if (!personImageBase64) throw new Error('Thiếu ảnh người dùng.');

    const mainProduct = await v47FindProductByAnyId(req.body?.mainProductId);
    if (!mainProduct) throw new Error('Không tìm thấy sản phẩm chính trong shop.');

    const accIds = Array.isArray(req.body?.accessoryProductIds) ? req.body.accessoryProductIds : [];
    const accessories = [];
    for (const id of accIds.slice(0, 5)) {
      const p = await v47FindProductByAnyId(id);
      if (p && v47IsAccessory(p)) accessories.push(p);
    }

    const personMime = (personImageBase64.match(/^data:([^;]+);base64,/i)?.[1]) || 'image/jpeg';
    const personBuffer = v47DataUriToBuffer(personImageBase64);
    const mainImage = v47FirstImage(mainProduct);
    const garment = await v47DownloadImage(mainImage, mainProduct.name || 'main-product');
    const accessoryRefs = [];
    for (const p of accessories) {
      try { accessoryRefs.push(await v47DownloadImage(v47FirstImage(p), p.name || 'accessory')); } catch (e) { console.warn('[V47] accessory fail', e.message); }
    }

    const tips = v47BuildTips({ mainProduct, accessories, sizeInfo: req.body?.sizeInfo || '' });

    let gateway = null;
    try {
      gateway = await v47GatewayPost('/tryon/advanced', {
        personImageBase64: v47BufferToDataUri(personBuffer, personMime),
        garmentImageBase64: v47BufferToDataUri(garment.buffer, garment.mimeType),
        accessoryImagesBase64: accessoryRefs.map((x) => v47BufferToDataUri(x.buffer, x.mimeType)),
        product: mainProduct,
        accessories,
        adultConfirmed: Boolean(req.body?.adultConfirmed),
        preserveVisibleSkin: true,
        noExtraCovering: true,
        realisticRefine: true,
        anchorIdentity: 'uploaded-person-is-source',
        consistencyPolicy: 'first-image-anchor',
        prompt: [
          'The user selected a product in the shop and pressed try-on.',
          'Use the uploaded person image as the source person and identity anchor.',
          'Use the first image of the selected shop product as garment/product reference.',
          'Do not show an upload field for the product. Product image comes from shop database only.',
          'Do not paste the person onto the product sample model. Put the shop product onto the uploaded person.',
          `Selected shop product: ${mainProduct.name || ''}`,
          `Selected shop accessories: ${accessories.map((x) => x.name).join(', ') || 'none'}`,
          'Attach accessories naturally: umbrella in hand, necklace on neck, headscarf on head/hair, watch/bracelet on wrist, bag on shoulder/hand, glasses on eyes, shoes on feet.',
          'If multiple outputs are inconsistent, use the first image as final.',
        ].join('\n'),
      }, 300000);
    } catch (e) {
      gateway = { ok: false, message: e.message };
    }

    let fallback = null;
    if (!gateway?.ok) {
      try {
        fallback = await v47GatewayPost('/generate/realistic', {
          prompt: [
            'Create a realistic fashion try-on preview.',
            `Main person is the uploaded customer/person image.`,
            `Apply selected shop product: ${mainProduct.name || ''}.`,
            `Use selected shop accessories: ${accessories.map((x) => x.name).join(', ') || 'none'}.`,
            'Use shop products only. Keep close to the first person image.',
          ].join('\n'),
          width: 768,
          height: 1024,
          steps: 4,
          adultConfirmed: Boolean(req.body?.adultConfirmed),
          allowSwimwear: true,
          noExtraCovering: true,
        }, 300000);
      } catch (e) {
        fallback = { ok: false, message: e.message };
      }
    }

    const finalImageBase64 = gateway?.imageBase64 || fallback?.imageBase64 || '';

    res.json({
      ok: true,
      message: gateway?.ok
        ? 'Đã tạo thử đồ với sản phẩm người dùng đã chọn trong shop.'
        : fallback?.ok
          ? 'Try-on runner chưa nối trực tiếp; đã fallback generate theo sản phẩm shop đã chọn.'
          : 'AI Gateway chưa trả ảnh, nhưng route đã lấy đúng sản phẩm và phụ kiện từ shop.',
      finalImageBase64,
      mainProduct,
      accessories,
      tips,
      gateway,
      fallback,
      debug: { productImage: mainImage, accessoryImages: accessories.map(v47FirstImage), policy: 'selected-product-first-image' },
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ================= JAPANO V47 SELECTED PRODUCT ACCESSORY ROUTES END =================
