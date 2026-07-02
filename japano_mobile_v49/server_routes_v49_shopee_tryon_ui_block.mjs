// ================= JAPANO V49 SHOPEE TRYON UI ROUTES START =================

const JAPANO_V49_GATEWAY_URL = process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001';
const JAPANO_V49_EXTRA_ACCESSORIES = [
  {
    "id": "v49-umbrella-clear",
    "sku": "V49-UMBRELLA-CLEAR",
    "slug": "v49-umbrella-clear",
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
      "cute",
      "beach"
    ],
    "description": "Dù trong suốt dùng làm phụ kiện phối outfit khi chụp ngoài trời.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-headscarf-pastel",
    "sku": "V49-HEADSCARF-PASTEL",
    "slug": "v49-headscarf-pastel",
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
      "feminine",
      "resort"
    ],
    "description": "Khăn trùm đầu/khăn lụa nhẹ phối với váy, croptop hoặc outfit đi biển.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-necklace-silver",
    "sku": "V49-NECKLACE-SILVER",
    "slug": "v49-necklace-silver",
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
      "minimal",
      "crop",
      "dress"
    ],
    "description": "Dây chuyền mảnh hợp áo cổ rộng, croptop, váy, sơ mi.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-necklace-gold",
    "sku": "V49-NECKLACE-GOLD",
    "slug": "v49-necklace-gold",
    "name": "Dây chuyền vàng mặt nhỏ",
    "category": "accessories",
    "subcategory": "necklace",
    "price": 99000,
    "originalPrice": 129000,
    "discountPercent": 23,
    "image": "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Gold+necklace+2"
    ],
    "sizes": [
      "40cm",
      "45cm"
    ],
    "colors": [
      "Vàng"
    ],
    "fit": "mặt nhỏ",
    "visualTags": [
      "necklace",
      "gold",
      "pendant",
      "elegant"
    ],
    "description": "Dây chuyền vàng mặt nhỏ hợp outfit nữ tính, công sở, đi chơi.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-watch-gold",
    "sku": "V49-WATCH-GOLD",
    "slug": "v49-watch-gold",
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
      "elegant",
      "office"
    ],
    "description": "Đồng hồ nữ mặt nhỏ phối sơ mi, blazer, cardigan.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-bag-mini-black",
    "sku": "V49-BAG-MINI-BLACK",
    "slug": "v49-bag-mini-black",
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
      "street",
      "crop"
    ],
    "description": "Túi xách mini phối crop top, váy, blazer, outfit đi chơi.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-tote-flower",
    "sku": "V49-TOTE-FLOWER",
    "slug": "v49-tote-flower",
    "name": "Túi tote hoa mini",
    "category": "accessories",
    "subcategory": "bags",
    "price": 149000,
    "originalPrice": 189000,
    "discountPercent": 21,
    "image": "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Tote+2"
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
    "description": "Túi tote hoa mini phối outfit đi học, cafe, du lịch nhẹ.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-sunglasses-oval",
    "sku": "V49-SUNGLASSES-OVAL",
    "slug": "v49-sunglasses-oval",
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
      "beach",
      "swim"
    ],
    "description": "Kính mát oval hợp outfit đi biển, street style, croptop.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-earrings-pearl",
    "sku": "V49-EARRINGS-PEARL",
    "slug": "v49-earrings-pearl",
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
      "small",
      "dress"
    ],
    "description": "Bông tai nhỏ giúp outfit thanh lịch hơn.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-belt-brown",
    "sku": "V49-BELT-BROWN",
    "slug": "v49-belt-brown",
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
      "waist",
      "jeans"
    ],
    "description": "Thắt lưng phối jeans, váy chữ A, quần ống rộng.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-hairclip-ribbon",
    "sku": "V49-HAIRCLIP-RIBBON",
    "slug": "v49-hairclip-ribbon",
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
      "black",
      "school"
    ],
    "description": "Kẹp tóc nơ đen phối phong cách dễ thương, học đường, Nhật.",
    "status": "active",
    "stock": 50,
    "allowTryOn": true
  }
];
const JAPANO_V49_FALLBACK_PRODUCTS = [
  {
    "id": "v49-demo-croptop",
    "sku": "V49-DEMO-CROPTOP",
    "slug": "v49-demo-croptop",
    "name": "Áo croptop trắng basic",
    "category": "clothing",
    "subcategory": "women-tops",
    "price": 169000,
    "originalPrice": 219000,
    "discountPercent": 23,
    "image": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Croptop+2"
    ],
    "sizes": [
      "S",
      "M",
      "L",
      "XL",
      "2XL",
      "3XL"
    ],
    "colors": [
      "Trắng",
      "Kem"
    ],
    "visualTags": [
      "crop",
      "summer",
      "white"
    ],
    "stock": 50,
    "allowTryOn": true
  },
  {
    "id": "v49-demo-jeans",
    "sku": "V49-DEMO-JEANS",
    "slug": "v49-demo-jeans",
    "name": "Quần jeans xanh cạp cao",
    "category": "clothing",
    "subcategory": "women-bottoms",
    "price": 299000,
    "originalPrice": 369000,
    "discountPercent": 19,
    "image": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=85",
    "images": [
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=85",
      "https://placehold.co/900x1200/fdf2f8/be185d?text=Jeans+2"
    ],
    "sizes": [
      "S",
      "M",
      "L",
      "XL",
      "2XL",
      "3XL"
    ],
    "colors": [
      "Xanh denim"
    ],
    "visualTags": [
      "jeans",
      "high waist",
      "denim"
    ],
    "stock": 50,
    "allowTryOn": true
  }
];

function v49FirstImage(product = {}) {
  const p = product || {};
  if (Array.isArray(p.images) && p.images[0]) {
    const first = p.images[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.secure_url) return first.secure_url;
  }
  return p.image || p.firstImage || p.thumbnail || p.photo || '';
}

function v49PublicProduct(product = {}) {
  try {
    const base = typeof publicProductView === 'function' ? publicProductView(product) : product;
    const image = v49FirstImage(base) || base.image;
    return { ...base, image, firstImage: image };
  } catch {
    const image = v49FirstImage(product) || product.image;
    return { ...product, image, firstImage: image };
  }
}

function v49ProductText(p = {}) {
  return `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${p.description || ''} ${(p.visualTags || []).join(' ')}`.toLowerCase();
}

function v49IsAccessory(p = {}) {
  const t = v49ProductText(p);
  return ['accessory','accessories','phụ kiện','phu kien','dây chuyền','day chuyen','necklace','đồng hồ','dong ho','watch','túi','tui','bag','tote','kính','kinh','glasses','sunglasses','nón','non','hat','vòng','vong','bracelet','dù','du','umbrella','khăn','khan','scarf','headscarf','bông tai','bong tai','earrings','thắt lưng','that lung','belt','kẹp tóc','kep toc','hairclip'].some((x) => t.includes(x));
}

function v49DataUriToBuffer(data = '') {
  const text = String(data || '');
  const base64 = text.includes(',') ? text.split(',').pop() : text;
  return Buffer.from(base64 || '', 'base64');
}

function v49BufferToDataUri(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
}

async function v49GatewayPost(pathName, body, timeout = 300000) {
  const url = `${JAPANO_V49_GATEWAY_URL.replace(/\/+$/, '')}${pathName}`;
  const res = await axios.post(url, body, { timeout, maxBodyLength: 80 * 1024 * 1024, maxContentLength: 80 * 1024 * 1024 });
  return res.data;
}

async function v49DownloadImage(url, fallbackName = 'shop-image.jpg') {
  if (!url || !/^https?:\/\//i.test(String(url))) throw new Error(`Sản phẩm shop chưa có link ảnh hợp lệ: ${fallbackName}`);
  const fetched = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 30 * 1024 * 1024 });
  const mimeType = String(fetched.headers['content-type'] || 'image/jpeg').split(';')[0];
  if (!mimeType.startsWith('image/')) throw new Error('Ảnh sản phẩm shop không hợp lệ.');
  return { buffer: Buffer.from(fetched.data), mimeType, sourceUrl: url };
}

async function v49AllProducts(limit = 500) {
  let rows = [];
  try {
    rows = await Product.find({ status: { $ne: 'archived' } }).limit(limit).lean();
  } catch (e) {
    rows = [];
  }
  const combined = [...rows.map(v49PublicProduct), ...JAPANO_V49_FALLBACK_PRODUCTS, ...JAPANO_V49_EXTRA_ACCESSORIES];
  const byKey = new Map();
  for (const p of combined) {
    const key = String(p._id || p.id || p.sku || p.slug || p.name || Math.random());
    if (!byKey.has(key) && v49FirstImage(p)) byKey.set(key, v49PublicProduct(p));
  }
  return [...byKey.values()];
}

async function v49FindProductByAnyId(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  try {
    if (/^[a-f0-9]{24}$/i.test(key)) {
      const byMongo = await Product.findById(key).lean();
      if (byMongo) return v49PublicProduct(byMongo);
    }
    const row = await Product.findOne({ $or: [{ id: key }, { sku: key }, { slug: key }, { name: key }] }).lean();
    if (row) return v49PublicProduct(row);
  } catch {}
  const all = [...JAPANO_V49_FALLBACK_PRODUCTS, ...JAPANO_V49_EXTRA_ACCESSORIES];
  return all.find((p) => [p.id, p.sku, p.slug, p.name].map(String).includes(key)) || null;
}

async function v49UpsertProduct(item) {
  const clean = { ...item, image: v49FirstImage(item) || item.image, images: Array.isArray(item.images) ? item.images : [item.image].filter(Boolean), status: 'active', allowTryOn: true };
  if (typeof ensureProductVariantFromItem === 'function') {
    const result = await ensureProductVariantFromItem(clean);
    return result?.product || result;
  }
  const query = { $or: [clean.id ? { id: clean.id } : null, clean.sku ? { sku: clean.sku } : null, clean.slug ? { slug: clean.slug } : null, clean.name ? { name: clean.name } : null].filter(Boolean) };
  return await Product.findOneAndUpdate(query, { $set: clean }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

function v49RecommendSizeServer(quiz = {}) {
  const weight = Number(quiz.weight || 0);
  const bust = Number(quiz.bust || 0);
  const waist = Number(quiz.waist || 0);
  const hip = Number(quiz.hip || 0);
  let size = 'M';
  if (weight <= 47 && waist <= 66 && hip <= 88) size = 'S';
  else if (weight <= 54 && waist <= 72 && hip <= 94) size = 'M';
  else if (weight <= 61 && waist <= 78 && hip <= 100) size = 'L';
  else if (weight <= 68 && waist <= 84 && hip <= 106) size = 'XL';
  else if (weight <= 76 && waist <= 92 && hip <= 112) size = '2XL';
  else size = '3XL';
  if (bust >= 106 || waist >= 92 || hip >= 112) size = '3XL';
  return size;
}

function v49BuildTips({ mainProduct, accessories = [], quiz = {}, visual = null, selectedSize = '' } = {}) {
  const rec = selectedSize || v49RecommendSizeServer(quiz);
  const accNames = accessories.map((x) => x.name).filter(Boolean);
  return {
    summary: `Sản phẩm chính là "${mainProduct?.name || 'sản phẩm shop'}". Hệ thống ưu tiên phụ kiện hợp với ảnh người dùng và món đồ đã bấm.`,
    sizeAdvice: [
      `Size gợi ý: ${rec}`,
      mainProduct?.sizes?.length ? `Size sản phẩm có: ${mainProduct.sizes.join(', ')}` : 'Sản phẩm nên có size S, M, L, XL, 2XL, 3XL.',
    ],
    accessoryAdvice: [
      accNames.length ? `Phụ kiện gợi ý: ${accNames.join(', ')}` : 'Chọn phụ kiện không che form đồ chính.',
      'Dù đặt ở tay; dây chuyền ở cổ; khăn trùm đầu ở đầu/tóc; đồng hồ/vòng ở cổ tay; túi ở vai/tay; kính ở mắt.',
    ],
    visualTags: visual?.visualTags || [],
  };
}

app.get('/api/v49/shop/products', async (req, res) => {
  try {
    const items = await v49AllProducts(500);
    res.json({ ok: true, count: items.length, items });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.get('/api/v49/shop/product/:id', async (req, res) => {
  try {
    const item = await v49FindProductByAnyId(req.params.id);
    if (!item) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v49/shop/seed-extra-accessories', async (req, res) => {
  try {
    const saved = [];
    const failed = [];
    for (const item of JAPANO_V49_EXTRA_ACCESSORIES) {
      try { saved.push(v49PublicProduct(await v49UpsertProduct(item))); }
      catch (e) { failed.push({ id: item.id, message: e.message }); }
    }
    res.json({ ok: true, insertedOrUpdated: saved.length, failed, items: saved });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v49/shop/recommend-accessories', async (req, res) => {
  try {
    const mainProduct = await v49FindProductByAnyId(req.body?.mainProductId) || JAPANO_V49_FALLBACK_PRODUCTS[0];
    const all = await v49AllProducts(500);
    const accessories = all.filter(v49IsAccessory);

    let visual = null;
    try {
      if (req.body?.personImageBase64) {
        const personBuffer = v49DataUriToBuffer(req.body.personImageBase64);
        const tmp = path.join(os.tmpdir(), `japano-v49-suggest-${Date.now()}.jpg`);
        await fs.writeFile(tmp, personBuffer);
        visual = await analyzeMediaWithLocalVisionModel(tmp, 'image');
        await fs.unlink(tmp).catch(() => null);
      }
    } catch (e) {
      visual = { warning: e.message, visualTags: [] };
    }

    const mainText = v49ProductText(mainProduct);
    const visualText = `${(visual?.visualTags || []).join(' ')}`.toLowerCase();

    function score(p) {
      const t = v49ProductText(p);
      let s = 0;
      for (const tag of (mainProduct.visualTags || [])) if (t.includes(String(tag).toLowerCase())) s += 2;
      for (const tag of (visual?.visualTags || [])) if (t.includes(String(tag).toLowerCase())) s += 2;

      if (mainText.includes('bikini') || mainText.includes('swim') || mainText.includes('đồ bơi')) {
        if (t.includes('dù') || t.includes('umbrella') || t.includes('kính') || t.includes('sunglasses') || t.includes('khăn') || t.includes('túi')) s += 8;
      }
      if (mainText.includes('sơ mi') || mainText.includes('cardigan') || mainText.includes('blazer')) {
        if (t.includes('đồng hồ') || t.includes('watch') || t.includes('dây chuyền') || t.includes('necklace') || t.includes('bông tai')) s += 8;
      }
      if (mainText.includes('croptop') || mainText.includes('crop')) {
        if (t.includes('dây chuyền') || t.includes('necklace') || t.includes('túi') || t.includes('belt') || t.includes('kính')) s += 8;
      }
      if (visualText.includes('cute') || visualText.includes('soft')) {
        if (t.includes('kẹp tóc') || t.includes('khăn') || t.includes('pastel') || t.includes('ngọc trai')) s += 4;
      }
      return s;
    }

    const ranked = accessories.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s).map((x) => x.p);
    const autoSelected = ranked.slice(0, 3);
    const tips = v49BuildTips({ mainProduct, accessories: autoSelected, quiz: req.body?.quiz || {}, visual, selectedSize: req.body?.selectedSize || '' });
    res.json({ ok: true, items: ranked, autoSelected, tips, visual });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v49/mobile/tryon-selected-product', async (req, res) => {
  try {
    const personImageBase64 = String(req.body?.personImageBase64 || '');
    if (!personImageBase64) throw new Error('Thiếu ảnh người dùng.');

    const mainProduct = await v49FindProductByAnyId(req.body?.mainProductId) || JAPANO_V49_FALLBACK_PRODUCTS[0];

    const accIds = Array.isArray(req.body?.accessoryProductIds) ? req.body.accessoryProductIds : [];
    const accessories = [];
    for (const id of accIds.slice(0, 5)) {
      const p = await v49FindProductByAnyId(id);
      if (p && v49IsAccessory(p)) accessories.push(p);
    }

    const personMime = (personImageBase64.match(/^data:([^;]+);base64,/i)?.[1]) || 'image/jpeg';
    const personBuffer = v49DataUriToBuffer(personImageBase64);
    const garment = await v49DownloadImage(v49FirstImage(mainProduct), mainProduct.name || 'main-product');

    const accessoryRefs = [];
    for (const p of accessories) {
      try { accessoryRefs.push(await v49DownloadImage(v49FirstImage(p), p.name || 'accessory')); }
      catch (e) { console.warn('[V49] accessory fail', e.message); }
    }

    const tips = v49BuildTips({ mainProduct, accessories, quiz: req.body?.quiz || {}, selectedSize: req.body?.selectedSize || req.body?.recommendedSize || '' });

    let gateway = null;
    try {
      gateway = await v49GatewayPost('/tryon/advanced', {
        personImageBase64: v49BufferToDataUri(personBuffer, personMime),
        garmentImageBase64: v49BufferToDataUri(garment.buffer, garment.mimeType),
        accessoryImagesBase64: accessoryRefs.map((x) => v49BufferToDataUri(x.buffer, x.mimeType)),
        product: mainProduct,
        accessories,
        selectedSize: req.body?.selectedSize || req.body?.recommendedSize || '',
        adultConfirmed: Boolean(req.body?.adultConfirmed),
        preserveVisibleSkin: true,
        noExtraCovering: true,
        realisticRefine: true,
        anchorIdentity: 'uploaded-person-is-source',
        consistencyPolicy: 'first-image-anchor',
        prompt: [
          'Use uploaded person image as source person and identity anchor.',
          'Use first image of selected shop product as garment/product reference.',
          'Product image comes from shop database only.',
          'Put shop product onto the uploaded person.',
          `Selected product: ${mainProduct.name || ''}`,
          `Selected size: ${req.body?.selectedSize || req.body?.recommendedSize || ''}`,
          `Selected accessories: ${accessories.map((x) => x.name).join(', ') || 'none'}`,
          'Attach accessories naturally: umbrella in hand, necklace on neck, headscarf on head/hair, watch/bracelet on wrist, bag on shoulder/hand, glasses on eyes.',
          'If multiple outputs are inconsistent, use the first image as final.',
        ].join('\n'),
      }, 300000);
    } catch (e) {
      gateway = { ok: false, message: e.message };
    }

    let fallback = null;
    if (!gateway?.ok) {
      try {
        fallback = await v49GatewayPost('/generate/realistic', {
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
      } catch (e) {
        fallback = { ok: false, message: e.message };
      }
    }

    const finalImageBase64 = gateway?.imageBase64 || fallback?.imageBase64 || '';
    res.json({
      ok: true,
      message: gateway?.ok
        ? 'Đã tạo thử đồ với sản phẩm người dùng bấm trong shop.'
        : fallback?.ok
          ? 'Try-on runner chưa nối trực tiếp; đã fallback generate theo sản phẩm shop.'
          : 'AI Gateway chưa trả ảnh, nhưng backend đã lấy đúng sản phẩm và phụ kiện từ shop.',
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

// ================= JAPANO V49 SHOPEE TRYON UI ROUTES END =================
