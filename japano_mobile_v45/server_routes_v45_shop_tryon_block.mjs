// ================= JAPANO V45 SHOP TRYON ROUTES START =================

const JAPANO_V45_GATEWAY_URL = process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001';

function v45FirstImage(product = {}) {
  const p = product || {};
  if (Array.isArray(p.images) && p.images[0]) {
    const first = p.images[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.secure_url) return first.secure_url;
  }
  if (p.image) return p.image;
  if (p.thumbnail) return p.thumbnail;
  if (p.photo) return p.photo;
  if (Array.isArray(p.media) && p.media[0]) {
    const first = p.media[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.secure_url) return first.secure_url;
  }
  return '';
}

function v45PublicProduct(product = {}) {
  try {
    const base = typeof publicProductView === 'function' ? publicProductView(product) : product;
    const image = v45FirstImage(base);
    return { ...base, image, firstImage: image };
  } catch {
    const image = v45FirstImage(product);
    return { ...product, image, firstImage: image };
  }
}

function v45ProductText(p = {}) {
  return `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${p.description || ''} ${(p.visualTags || []).join(' ')}`.toLowerCase();
}

function v45IsAccessory(p = {}) {
  const t = v45ProductText(p);
  return ['accessory','accessories','phụ kiện','phu kien','dây chuyền','day chuyen','necklace','đồng hồ','dong ho','watch','túi','tui','bag','kính','kinh','glasses','sunglasses','nón','non','hat','vòng','vong','bracelet'].some((x) => t.includes(x));
}

function v45DataUriToBuffer(data = '') {
  const text = String(data || '');
  const base64 = text.includes(',') ? text.split(',').pop() : text;
  return Buffer.from(base64 || '', 'base64');
}

function v45BufferToDataUri(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
}

async function v45DownloadImage(url, fallbackName = 'shop-image.jpg') {
  if (!url || !/^https?:\/\//i.test(String(url))) {
    throw new Error(`Sản phẩm shop chưa có link ảnh hợp lệ: ${fallbackName}`);
  }
  const fetched = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 30 * 1024 * 1024 });
  const mimeType = String(fetched.headers['content-type'] || 'image/jpeg').split(';')[0];
  if (!mimeType.startsWith('image/')) throw new Error('Ảnh sản phẩm shop không hợp lệ.');
  return { buffer: Buffer.from(fetched.data), mimeType, sourceUrl: url };
}

async function v45GatewayPost(pathName, body, timeout = 300000) {
  const url = `${JAPANO_V45_GATEWAY_URL.replace(/\/+$/, '')}${pathName}`;
  const res = await axios.post(url, body, { timeout, maxBodyLength: 70 * 1024 * 1024, maxContentLength: 70 * 1024 * 1024 });
  return res.data;
}

async function v45AllShopProducts(limit = 240) {
  const rows = await Product.find({ status: { $ne: 'archived' } }).limit(limit).lean();
  return rows.map(v45PublicProduct).filter((p) => v45FirstImage(p));
}

async function v45FindProductsByIds(ids = []) {
  const wanted = [...new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean))];
  if (!wanted.length) return [];
  const all = await v45AllShopProducts(500);
  return wanted
    .map((id) => all.find((p) => String(p._id || '') === id || String(p.id || '') === id || String(p.sku || '') === id || String(p.slug || '') === id || String(p.name || '') === id))
    .filter(Boolean);
}

function v45BuildTips({ mainProduct, accessories = [], sizeInfo = '' } = {}) {
  const accNames = accessories.map((x) => x.name).filter(Boolean);
  return {
    summary: `Đồ chính lấy từ shop: ${mainProduct?.name || 'chưa chọn'}. Phụ kiện shop: ${accNames.join(', ') || 'chưa chọn'}.`,
    sizeAdvice: [
      sizeInfo ? `Dựa trên thông tin size bạn nhập: ${sizeInfo}` : 'Nhập chiều cao/cân nặng/eo/hông để gợi ý size sát hơn.',
      mainProduct?.sizes?.length ? `Sản phẩm có size: ${mainProduct.sizes.join(', ')}` : 'Kiểm tra bảng size thật của sản phẩm trước khi mua.',
    ],
    accessoryAdvice: [
      'Dây chuyền: gắn ở cổ, không che mặt.',
      'Đồng hồ/vòng: gắn ở cổ tay.',
      'Túi: đặt ở vai hoặc tay.',
      'Kính: đặt đúng mắt, giữ tỉ lệ khuôn mặt.',
      'Giày: đặt ở chân nếu ảnh người full body.',
    ],
  };
}

app.get('/api/v45/shop/products', async (req, res) => {
  try {
    const items = await v45AllShopProducts(300);
    const recommended = [
      ...items.filter((p) => !v45IsAccessory(p)).slice(0, 8),
      ...items.filter((p) => v45IsAccessory(p)).slice(0, 8),
    ];
    res.json({ ok: true, count: items.length, items, recommended });
  } catch (e) {
    res.status(500).json({ ok: false, message: `Không đọc được sản phẩm shop: ${e.message}` });
  }
});

app.post('/api/v45/shop/recommend', async (req, res) => {
  try {
    const items = await v45AllShopProducts(300);
    const selectedId = String(req.body?.selectedProductId || '');
    const selected = items.find((p) => String(p._id || p.id || p.sku || p.slug || p.name) === selectedId) || items[0];
    const garments = items.filter((p) => !v45IsAccessory(p));
    const accessories = items.filter((p) => v45IsAccessory(p));
    const picked = [
      selected,
      ...garments.filter((p) => String(p._id || p.id || p.name) !== selectedId).slice(0, 5),
      ...accessories.slice(0, 8),
    ].filter(Boolean);
    const tips = v45BuildTips({ mainProduct: selected, accessories: accessories.slice(0, 5), sizeInfo: req.body?.sizeInfo || '' });
    res.json({ ok: true, items: picked, tips });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v45/mobile/tryon-shop', async (req, res) => {
  try {
    const adultConfirmed = Boolean(req.body?.adultConfirmed);
    const sizeInfo = String(req.body?.sizeInfo || '');
    const personImageBase64 = String(req.body?.personImageBase64 || '');
    if (!personImageBase64) throw new Error('Thiếu ảnh người dùng.');

    const mainProducts = await v45FindProductsByIds([req.body?.mainProductId]);
    const mainProduct = mainProducts[0];
    if (!mainProduct) throw new Error('Không tìm thấy sản phẩm chính trong database shop.');

    const accessoryProducts = await v45FindProductsByIds(req.body?.accessoryProductIds || []);
    const mainImage = v45FirstImage(mainProduct);
    const accessoryImages = accessoryProducts.map(v45FirstImage).filter(Boolean);

    const garment = await v45DownloadImage(mainImage, mainProduct.name || 'main-product');
    const accessoryRefs = [];
    for (let i = 0; i < accessoryImages.slice(0, 5).length; i++) {
      try {
        accessoryRefs.push(await v45DownloadImage(accessoryImages[i], `accessory-${i + 1}`));
      } catch (e) {
        console.warn('[V45] accessory download fail', e.message);
      }
    }

    const personBuffer = v45DataUriToBuffer(personImageBase64);
    const personMime = (personImageBase64.match(/^data:([^;]+);base64,/i)?.[1]) || 'image/jpeg';
    const tips = v45BuildTips({ mainProduct, accessories: accessoryProducts, sizeInfo });

    let gateway = null;
    try {
      gateway = await v45GatewayPost('/tryon/advanced', {
        personImageBase64: v45BufferToDataUri(personBuffer, personMime),
        garmentImageBase64: v45BufferToDataUri(garment.buffer, garment.mimeType),
        accessoryImagesBase64: accessoryRefs.map((x) => v45BufferToDataUri(x.buffer, x.mimeType)),
        product: mainProduct,
        accessories: accessoryProducts,
        adultConfirmed,
        preserveVisibleSkin: true,
        noExtraCovering: true,
        realisticRefine: true,
        anchorIdentity: 'uploaded-person-is-source',
        consistencyPolicy: 'first-image-anchor',
        prompt: [
          'IMPORTANT: The uploaded person image is the source person and identity anchor.',
          'Use the shop product image as garment/reference to put onto the uploaded person.',
          'Do NOT paste the uploaded person onto the sample product model.',
          'Do NOT use outside products. All garment and accessory references are shop products.',
          `Main shop product: ${mainProduct.name || ''}`,
          `Accessory shop products: ${accessoryProducts.map((x) => x.name).join(', ') || 'none'}`,
          'Attach accessories naturally: necklace on neck, watch/bracelet on wrist, bag on shoulder/hand, glasses on eyes, shoes on feet.',
          'Preserve face, body, pose and lighting from the uploaded person as much as possible.',
          'If multiple outputs are inconsistent, select the first image as final.',
        ].join('\n'),
      }, 300000);
    } catch (e) {
      gateway = { ok: false, message: e.message };
    }

    let fallback = null;
    if (!gateway?.ok) {
      try {
        fallback = await v45GatewayPost('/generate/realistic', {
          prompt: [
            'Create a realistic fashion try-on preview.',
            'The customer/uploaded person is the main subject.',
            `Apply shop product: ${mainProduct.name || ''}.`,
            `Use accessory shop products: ${accessoryProducts.map((x) => x.name).join(', ') || 'none'}.`,
            'Keep identity close to the first uploaded person image.',
            'Use only shop product references, not random outside products.',
          ].join('\n'),
          width: 768,
          height: 1024,
          steps: 4,
          adultConfirmed,
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
        ? 'Đã tạo thử đồ bằng sản phẩm trong shop. Ảnh người dùng là ảnh gốc.'
        : fallback?.ok
          ? 'Try-on runner chưa nối trực tiếp, đã fallback generate nhưng vẫn dùng sản phẩm shop làm reference.'
          : 'AI Gateway chưa trả ảnh. Route đã lấy đúng sản phẩm shop và ảnh đầu tiên.',
      finalImageBase64,
      mainProduct,
      accessoryProducts,
      tips,
      gateway,
      fallback,
      debug: {
        mainProductImage: mainImage,
        accessoryImages,
        policy: 'shop-products-only; first-image-anchor',
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ================= JAPANO V45 SHOP TRYON ROUTES END =================
