// ================= JAPANO V43 WEB FULL ROUTES START =================
// Product page + link upload + webcam analyze + try-on web support.
// This block is inserted near the bottom of server/index.mjs, before app.listen.

const JAPANO_V43_GATEWAY_URL = process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001';

const JAPANO_V43_SAMPLE_PRODUCTS = [
  {
    id: 'v43-crop-white-001',
    name: 'Áo croptop trắng minimal JAPANO',
    category: 'clothing',
    subcategory: 'women-tops',
    price: 169000,
    originalPrice: 219000,
    discountPercent: 23,
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',
    images: ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80'],
    sizes: ['S', 'M', 'L'],
    colors: ['Trắng', 'Kem'],
    fit: 'ôm nhẹ, hở eo',
    badge: 'Crop-top',
    story: 'Dễ phối chân váy, quần jeans, túi canvas.',
    description: 'Áo croptop form gọn, phù hợp chụp outfit và thử đồ AI.',
    visualTags: ['crop top', 'white', 'minimal', 'visible waist', 'summer'],
    styleUseCase: 'đi chơi, cafe, lookbook',
    status: 'active'
  },
  {
    id: 'v43-bikini-black-001',
    name: 'Bikini đen basic người lớn',
    category: 'clothing',
    subcategory: 'swimwear',
    price: 289000,
    originalPrice: 359000,
    discountPercent: 19,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    images: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80'],
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Đen'],
    fit: 'đồ bơi, cần xác nhận người lớn',
    badge: 'Swimwear',
    story: 'Dùng cho try-on đồ bơi hợp lệ, giữ đúng form sản phẩm.',
    description: 'Bikini basic cho chế độ adult fashion swimwear, không tự thêm lớp che nếu sản phẩm là đồ bơi hợp lệ.',
    visualTags: ['bikini', 'swimwear', 'adult fashion', 'beach'],
    styleUseCase: 'đi biển, resort, lookbook swimwear',
    status: 'active'
  },
  {
    id: 'v43-cardigan-cream-001',
    name: 'Áo cardigan kem mềm',
    category: 'clothing',
    subcategory: 'outerwear',
    price: 249000,
    originalPrice: 329000,
    discountPercent: 24,
    image: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=900&q=80',
    sizes: ['M', 'L', 'XL'],
    colors: ['Kem', 'Be'],
    fit: 'regular',
    badge: 'Cozy',
    description: 'Cardigan mềm cho phong cách dịu, hợp camera stylist khi biểu cảm neutral/calm.',
    visualTags: ['cream', 'cozy', 'soft', 'cardigan', 'minimal'],
    status: 'active'
  },
  {
    id: 'v43-skirt-black-001',
    name: 'Chân váy đen chữ A',
    category: 'clothing',
    subcategory: 'women-bottoms',
    price: 199000,
    image: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=900&q=80',
    sizes: ['S', 'M', 'L'],
    colors: ['Đen'],
    fit: 'A-line',
    badge: 'Best match',
    description: 'Chân váy dễ phối với croptop, áo sơ mi, cardigan.',
    visualTags: ['black skirt', 'a-line', 'school', 'casual'],
    status: 'active'
  },
  {
    id: 'v43-jeans-blue-001',
    name: 'Quần jeans xanh cạp cao',
    category: 'clothing',
    subcategory: 'women-bottoms',
    price: 299000,
    image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Xanh denim'],
    fit: 'cạp cao, regular',
    badge: 'Cạp cao',
    description: 'Hợp crop-top, áo phông, sơ mi Nhật basic.',
    visualTags: ['jeans', 'high waist', 'denim', 'casual'],
    status: 'active'
  },
  {
    id: 'v43-necklace-silver-001',
    name: 'Dây chuyền bạc mảnh 45cm',
    category: 'accessories',
    subcategory: 'fashion-accessories',
    price: 89000,
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80',
    sizes: ['40cm', '45cm', '50cm'],
    colors: ['Bạc'],
    fit: '45cm cổ vừa',
    badge: 'Accessory',
    description: 'Phụ kiện dùng cho try-on nhiều ảnh, gợi ý theo cổ/vai.',
    visualTags: ['silver necklace', 'minimal', '45cm'],
    status: 'active'
  },
  {
    id: 'v43-watch-gold-001',
    name: 'Đồng hồ mặt nhỏ 32mm',
    category: 'accessories',
    subcategory: 'watch',
    price: 219000,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
    sizes: ['28mm', '32mm', '36mm'],
    colors: ['Vàng', 'Bạc'],
    fit: 'mặt nhỏ, cổ tay nhỏ-vừa',
    badge: 'Size advisor',
    description: 'Gợi ý theo chu vi cổ tay, hợp outfit thanh lịch.',
    visualTags: ['watch', '32mm', 'gold', 'minimal'],
    status: 'active'
  },
  {
    id: 'v43-bag-canvas-001',
    name: 'Túi canvas Nhật basic',
    category: 'accessories',
    subcategory: 'bags',
    price: 159000,
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80',
    sizes: ['Free size'],
    colors: ['Kem', 'Nâu'],
    fit: 'đeo vai',
    badge: 'Everyday',
    description: 'Túi canvas dễ phối cho outfit đi học, cafe, dạo phố.',
    visualTags: ['canvas bag', 'cream', 'casual', 'japan'],
    status: 'active'
  },
  {
    id: 'v43-sunglasses-001',
    name: 'Kính mát oval đen',
    category: 'accessories',
    subcategory: 'glasses',
    price: 129000,
    image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=900&q=80',
    sizes: ['Free size'],
    colors: ['Đen'],
    fit: 'oval',
    badge: 'Camera match',
    description: 'Phối với bikini, croptop, set street style.',
    visualTags: ['sunglasses', 'oval', 'black', 'street'],
    status: 'active'
  },
  {
    id: 'v43-haori-navy-001',
    name: 'Áo khoác haori navy',
    category: 'clothing',
    subcategory: 'japan-traditional',
    price: 369000,
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80',
    sizes: ['M', 'L', 'XL'],
    colors: ['Navy', 'Đen'],
    fit: 'oversize nhẹ',
    badge: 'Japan mood',
    description: 'Phối với váy đen, quần jeans, túi canvas.',
    visualTags: ['haori', 'navy', 'japanese', 'outerwear'],
    status: 'active'
  },
  {
    id: 'v43-sneaker-white-001',
    name: 'Sneaker trắng basic',
    category: 'footwear',
    subcategory: 'footwear',
    price: 329000,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80',
    sizes: ['36', '37', '38', '39', '40', '41'],
    colors: ['Trắng'],
    fit: 'true to size',
    badge: 'Basic',
    description: 'Dễ phối với hầu hết outfit JAPANO.',
    visualTags: ['sneaker', 'white', 'basic'],
    status: 'active'
  },
  {
    id: 'v43-shirt-blue-001',
    name: 'Sơ mi xanh pastel',
    category: 'clothing',
    subcategory: 'women-tops',
    price: 229000,
    image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=900&q=80',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Xanh pastel'],
    fit: 'regular',
    badge: 'Pastel',
    description: 'Phong cách nhẹ nhàng, hợp văn phòng, đi học.',
    visualTags: ['shirt', 'pastel', 'blue', 'soft'],
    status: 'active'
  }
];

function v43PublicProduct(product = {}) {
  try {
    return typeof publicProductView === 'function' ? publicProductView(product) : product;
  } catch {
    return product;
  }
}

function v43DataUriToBuffer(data = '') {
  const text = String(data || '');
  const base64 = text.includes(',') ? text.split(',').pop() : text;
  return Buffer.from(base64 || '', 'base64');
}

async function v43ResolveImageInput({ imageUrl = '', imageBase64 = '', fallbackName = 'v43-image.jpg' } = {}) {
  if (imageBase64) {
    const mimeMatch = String(imageBase64).match(/^data:([^;]+);base64,/i);
    return {
      buffer: v43DataUriToBuffer(imageBase64),
      mimeType: mimeMatch?.[1] || 'image/png',
      filename: fallbackName,
      source: 'base64'
    };
  }
  const url = String(imageUrl || '').trim();
  if (url) {
    if (!/^https?:\/\//i.test(url)) throw new Error('Link ảnh phải bắt đầu bằng http:// hoặc https://');
    const fetched = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 25 * 1024 * 1024 });
    const mimeType = String(fetched.headers['content-type'] || 'image/jpeg').split(';')[0];
    if (!mimeType.startsWith('image/')) throw new Error('Link không trả về ảnh hợp lệ.');
    return {
      buffer: Buffer.from(fetched.data),
      mimeType,
      filename: path.basename(new URL(url).pathname) || fallbackName,
      source: 'url',
      originalUrl: url
    };
  }
  throw new Error('Thiếu ảnh. Hãy chọn ảnh từ máy, dán link ảnh hoặc chụp webcam.');
}

function v43BufferToDataUri(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
}

async function v43GatewayPost(pathName, body, timeout = 240000) {
  const url = `${JAPANO_V43_GATEWAY_URL.replace(/\/+$/, '')}${pathName}`;
  const res = await axios.post(url, body, { timeout, maxBodyLength: 50 * 1024 * 1024, maxContentLength: 50 * 1024 * 1024 });
  return res.data;
}

async function v43AllProducts(limit = 240) {
  const rows = await Product.find({ status: { $ne: 'archived' } }).limit(limit).lean().catch(() => []);
  return rows.map(v43PublicProduct);
}

app.get('/api/v43/web/products', async (req, res) => {
  try {
    let items = await v43AllProducts(240);
    if (!items.length) items = JAPANO_V43_SAMPLE_PRODUCTS;
    res.json({ ok: true, items, count: items.length });
  } catch (e) {
    res.json({ ok: true, items: JAPANO_V43_SAMPLE_PRODUCTS, count: JAPANO_V43_SAMPLE_PRODUCTS.length, warning: e.message });
  }
});

app.post('/api/v43/web/seed-products', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) && req.body.items.length ? req.body.items : JAPANO_V43_SAMPLE_PRODUCTS;
    const saved = [];
    for (const item of items) {
      try {
        const result = await ensureProductVariantFromItem({ ...item, status: 'active' });
        saved.push(v43PublicProduct(result.product || result));
      } catch (e) {
        console.warn('[JAPANO V43] seed item failed', item.id, e.message);
      }
    }
    const all = await v43AllProducts(240);
    res.json({ ok: true, insertedOrUpdated: saved.length, count: all.length, items: all });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v43/web/camera-analyze', async (req, res) => {
  const started = Date.now();
  let tmpPath = '';
  try {
    const userId = req.body?.userId || 'web-guest';
    const adultConfirmed = Boolean(req.body?.adultConfirmed);
    const image = await v43ResolveImageInput({
      imageUrl: req.body?.imageUrl,
      imageBase64: req.body?.imageBase64,
      fallbackName: 'web-camera-frame.png'
    });

    const ext = image.mimeType.includes('png') ? '.png' : '.jpg';
    tmpPath = path.join(os.tmpdir(), `japano-v43-webcam-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    await fs.writeFile(tmpPath, image.buffer);

    let fileModelAnalysis = null;
    try {
      fileModelAnalysis = await analyzeMediaWithLocalVisionModel(tmpPath, 'image');
    } catch (e) {
      fileModelAnalysis = {
        ok: false,
        detector: { available: false, faceCount: 0, personCount: 0, warning: e.message },
        face: { available: false, primaryEmotion: 'neutral', ageGroup: 'unknown', warning: e.message },
        visualTags: [],
      };
    }

    const products = await v43AllProducts(80);
    const recommendation = buildVisionRecommendation({ baseProduct: null, products, analysis: fileModelAnalysis });

    let gateway = null;
    try {
      gateway = await v43GatewayPost('/camera/analyze', {
        imageBase64: v43BufferToDataUri(image.buffer, image.mimeType),
        prompt: 'Analyze fashion style, expression mood, broad age group, outfit, accessory and product recommendations. Return safe shopping advice only.',
        adultConfirmed,
        allowSwimwear: true,
        noExtraCovering: true,
        userProfile: req.body?.profile || {},
        products: products.slice(0, 30),
      }, 240000);
    } catch (e) {
      gateway = { ok: false, message: e.message };
    }

    const face = fileModelAnalysis?.face || {};
    const detector = fileModelAnalysis?.detector || {};
    const styleAI = gateway?.analysis || {};
    const expression = face.primaryEmotion || styleAI.primaryEmotion || styleAI.expression || 'neutral';
    const ageGroup = face.ageGroup || styleAI.ageGroup || 'unknown';

    res.json({
      ok: true,
      durationMs: Date.now() - started,
      note: 'Emotion/age chỉ là ước lượng bằng model ảnh, dùng để gợi ý phong cách; không dùng để xác minh danh tính hoặc tuổi thật.',
      inputSource: image.source,
      detector,
      face: {
        available: Boolean(face.available || Number(detector.faceCount || 0) > 0),
        faceCount: Number(detector.faceCount || detector.personCount || 0),
        primaryEmotion: expression,
        emotionConfidence: face.emotionConfidence || null,
        ageGroup,
        ageEstimate: face.ageEstimate || null,
      },
      style: {
        summary: styleAI.summary || recommendation.reason || 'AI đã phân tích ảnh và chọn sản phẩm phù hợp.',
        styleTags: styleAI.styleTags || fileModelAnalysis?.visualTags || [],
        bodyFitHints: styleAI.bodyFitHints || [],
        accessoryAdvice: styleAI.accessoryAdvice || [],
        sizeQuestions: styleAI.sizeQuestions || [],
      },
      recommendation,
      products: (recommendation.products || products).slice(0, 12).map(v43PublicProduct),
      gateway,
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    if (tmpPath) await fs.unlink(tmpPath).catch(() => null);
  }
});

app.post('/api/v43/web/tryon', async (req, res) => {
  try {
    const adultConfirmed = Boolean(req.body?.adultConfirmed);
    const category = String(req.body?.category || req.body?.product?.subcategory || 'fashion');
    const productName = String(req.body?.productName || req.body?.product?.name || 'JAPANO outfit');

    const person = await v43ResolveImageInput({
      imageUrl: req.body?.personImageUrl,
      imageBase64: req.body?.personImageBase64,
      fallbackName: 'person.png',
    });

    let garment = null;
    if (req.body?.garmentImageUrl || req.body?.garmentImageBase64) {
      garment = await v43ResolveImageInput({
        imageUrl: req.body?.garmentImageUrl,
        imageBase64: req.body?.garmentImageBase64,
        fallbackName: 'garment.png',
      });
    }

    const accessoryInputs = Array.isArray(req.body?.accessoryImageUrls) ? req.body.accessoryImageUrls : [];
    const accessoryBase64Inputs = Array.isArray(req.body?.accessoryImagesBase64) ? req.body.accessoryImagesBase64 : [];
    const accessories = [];
    for (const url of accessoryInputs.slice(0, 5)) {
      try { accessories.push(await v43ResolveImageInput({ imageUrl: url, fallbackName: 'accessory.jpg' })); } catch {}
    }
    for (const b64 of accessoryBase64Inputs.slice(0, 5)) {
      try { accessories.push(await v43ResolveImageInput({ imageBase64: b64, fallbackName: 'accessory.png' })); } catch {}
    }

    const product = req.body?.product || {};
    const prompt = [
      'JAPANO advanced web try-on.',
      `Product: ${productName}`,
      `Category: ${category}`,
      product?.description ? `Description: ${product.description}` : '',
      'Preserve identity, pose, body shape and lighting.',
      'If swimwear/crop-top adult fashion: preserve garment cut and visible skin, do not add extra covering layers.',
      'Place accessories naturally: necklace on neck, watch on wrist, glasses on eyes, bag on shoulder/hand.',
      req.body?.prompt || '',
    ].filter(Boolean).join('\n');

    let gateway = null;
    try {
      gateway = await v43GatewayPost('/tryon/advanced', {
        personImageBase64: v43BufferToDataUri(person.buffer, person.mimeType),
        garmentImageBase64: garment ? v43BufferToDataUri(garment.buffer, garment.mimeType) : '',
        accessoryImagesBase64: accessories.map((x) => v43BufferToDataUri(x.buffer, x.mimeType)),
        category,
        productName,
        adultConfirmed,
        preserveVisibleSkin: true,
        noExtraCovering: true,
        realisticRefine: true,
        prompt,
      }, 240000);
    } catch (e) {
      gateway = { ok: false, message: e.message };
    }

    let generated = null;
    if (!gateway?.ok && req.body?.allowGenerateFallback !== false) {
      try {
        generated = await v43GatewayPost('/generate/realistic', {
          prompt: `${prompt}\nCreate a realistic fashion ecommerce preview image.`,
          width: Number(req.body?.width || 768),
          height: Number(req.body?.height || 1024),
          steps: 4,
          adultConfirmed,
          allowSwimwear: true,
          references: [],
        }, 300000);
      } catch (e) {
        generated = { ok: false, message: e.message };
      }
    }

    res.json({
      ok: true,
      mode: gateway?.ok ? 'catvton-or-local-runner' : generated?.ok ? 'sdxl-generated-fallback' : 'preview-fallback',
      message: gateway?.ok
        ? 'Đã gửi ảnh vào AI try-on local.'
        : generated?.ok
          ? 'CatVTON runner chưa nối hoàn chỉnh, đã tạo ảnh realistic fallback từ prompt.'
          : 'CatVTON runner chưa nối hoàn chỉnh. Web hiển thị preview ảnh người + sản phẩm để không đứng luồng.',
      prompt,
      sourcePersonImageBase64: v43BufferToDataUri(person.buffer, person.mimeType),
      sourceGarmentImageBase64: garment ? v43BufferToDataUri(garment.buffer, garment.mimeType) : '',
      accessoryImagesBase64: accessories.map((x) => v43BufferToDataUri(x.buffer, x.mimeType)),
      imageBase64: gateway?.imageBase64 || generated?.imageBase64 || '',
      gateway,
      generated,
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ================= JAPANO V43 WEB FULL ROUTES END =================
