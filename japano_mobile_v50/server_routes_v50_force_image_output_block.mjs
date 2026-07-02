// ================= JAPANO V50 FORCE IMAGE OUTPUT ROUTES START =================
// This route intentionally uses the SAME endpoint as V49 and must be inserted BEFORE V49.
// It guarantees an image is returned even when AI Gateway/model does not return imageBase64.

async function v50FindProductByAnyIdSafe(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  try {
    if (typeof v49FindProductByAnyId === 'function') {
      const p = await v49FindProductByAnyId(key);
      if (p) return p;
    }
  } catch {}
  try {
    if (/^[a-f0-9]{24}$/i.test(key)) {
      const p = await Product.findById(key).lean();
      if (p) return p;
    }
  } catch {}
  try {
    const p = await Product.findOne({ $or: [{ id: key }, { sku: key }, { slug: key }, { name: key }] }).lean();
    if (p) return p;
  } catch {}
  return null;
}

function v50FirstImage(product = {}) {
  const p = product || {};
  if (Array.isArray(p.images) && p.images[0]) {
    const first = p.images[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.secure_url) return first.secure_url;
  }
  return p.image || p.firstImage || p.thumbnail || p.photo || '';
}

function v50DataUriToBuffer(data = '') {
  const text = String(data || '');
  const base64 = text.includes(',') ? text.split(',').pop() : text;
  return Buffer.from(base64 || '', 'base64');
}

function v50BufferToDataUri(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
}

async function v50DownloadImage(url, fallbackName = 'shop-image.jpg') {
  if (!url || !/^https?:\/\//i.test(String(url))) throw new Error(`Sản phẩm shop chưa có link ảnh hợp lệ: ${fallbackName}`);
  const fetched = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 30 * 1024 * 1024 });
  const mimeType = String(fetched.headers['content-type'] || 'image/jpeg').split(';')[0];
  if (!mimeType.startsWith('image/')) throw new Error('Ảnh sản phẩm shop không hợp lệ.');
  return { buffer: Buffer.from(fetched.data), mimeType, sourceUrl: url };
}

async function v50GatewayPostSafe(pathName, body, timeout = 300000) {
  const base = process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001';
  const url = `${base.replace(/\/+$/, '')}${pathName}`;
  const res = await axios.post(url, body, { timeout, maxBodyLength: 80 * 1024 * 1024, maxContentLength: 80 * 1024 * 1024 });
  return res.data;
}

function v50IsAccessorySafe(p = {}) {
  const t = `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${p.description || ''} ${(p.visualTags || []).join(' ')}`.toLowerCase();
  return ['accessory','accessories','phụ kiện','phu kien','dây chuyền','day chuyen','necklace','đồng hồ','dong ho','watch','túi','tui','bag','tote','kính','kinh','glasses','sunglasses','nón','non','hat','vòng','vong','bracelet','dù','du','umbrella','khăn','khan','scarf','headscarf','bông tai','bong tai','earrings','thắt lưng','that lung','belt','kẹp tóc','kep toc','hairclip'].some((x) => t.includes(x));
}

async function v50LocalPreview(payload) {
  const py = process.env.PYTHON_BIN || process.env.PYTHON || 'python3';
  const script = path.join(process.cwd(), 'japano_mobile_v50', 'local_tryon_preview.py');

  return await new Promise((resolve) => {
    const child = spawn(py, [script], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => out += d.toString());
    child.stderr.on('data', (d) => err += d.toString());
    child.on('close', () => {
      try {
        const data = JSON.parse(out.trim() || '{}');
        if (data?.ok && data?.imageBase64) resolve(data);
        else resolve({ ok: false, message: data?.message || err || 'local preview failed' });
      } catch (e) {
        resolve({ ok: false, message: err || e.message || 'local preview parse failed' });
      }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

app.post('/api/v49/mobile/tryon-selected-product', async (req, res) => {
  try {
    const personImageBase64 = String(req.body?.personImageBase64 || '');
    if (!personImageBase64) throw new Error('Thiếu ảnh người dùng.');

    const mainProduct = await v50FindProductByAnyIdSafe(req.body?.mainProductId) || {
      id: 'fallback-shop-product',
      name: 'Sản phẩm shop',
      price: '',
      image: '',
      images: [],
    };

    const accIds = Array.isArray(req.body?.accessoryProductIds) ? req.body.accessoryProductIds : [];
    const accessories = [];
    for (const id of accIds.slice(0, 5)) {
      const p = await v50FindProductByAnyIdSafe(id);
      if (p && v50IsAccessorySafe(p)) accessories.push(p);
    }

    const personMime = (personImageBase64.match(/^data:([^;]+);base64,/i)?.[1]) || 'image/jpeg';
    const personBuffer = v50DataUriToBuffer(personImageBase64);

    let garmentDataUri = '';
    const productImage = v50FirstImage(mainProduct);
    try {
      if (productImage) {
        const garment = await v50DownloadImage(productImage, mainProduct.name || 'main-product');
        garmentDataUri = v50BufferToDataUri(garment.buffer, garment.mimeType);
      }
    } catch (e) {
      console.warn('[V50] garment download failed:', e.message);
    }

    const accessoryDataUris = [];
    for (const p of accessories) {
      try {
        const img = v50FirstImage(p);
        if (!img) continue;
        const a = await v50DownloadImage(img, p.name || 'accessory');
        accessoryDataUris.push(v50BufferToDataUri(a.buffer, a.mimeType));
      } catch (e) {
        console.warn('[V50] accessory download failed:', e.message);
      }
    }

    let gateway = null;
    try {
      gateway = await v50GatewayPostSafe('/tryon/advanced', {
        personImageBase64: v50BufferToDataUri(personBuffer, personMime),
        garmentImageBase64: garmentDataUri,
        accessoryImagesBase64: accessoryDataUris,
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
        ].join('\n'),
      }, 300000);
    } catch (e) {
      gateway = { ok: false, message: e.message };
    }

    let finalImageBase64 = gateway?.imageBase64 || gateway?.finalImageBase64 || gateway?.image || '';

    let localPreview = null;
    if (!finalImageBase64) {
      localPreview = await v50LocalPreview({
        personImageBase64,
        product: {
          ...mainProduct,
          firstImage: productImage,
          image: productImage,
        },
        accessories: accessories.map((p) => ({
          ...p,
          firstImage: v50FirstImage(p),
          image: v50FirstImage(p),
        })),
        selectedSize: req.body?.selectedSize || req.body?.recommendedSize || '',
        productImageUrl: productImage,
      });
      if (localPreview?.ok && localPreview?.imageBase64) {
        finalImageBase64 = localPreview.imageBase64;
      }
    }

    res.json({
      ok: true,
      message: finalImageBase64
        ? (gateway?.imageBase64 || gateway?.finalImageBase64 || gateway?.image
          ? 'AI Gateway đã trả ảnh thử đồ.'
          : 'AI Gateway chưa trả ảnh thật, nên V50 đã tạo ảnh preview fallback để app luôn có ảnh. Muốn ảnh AI thật cần cài model/gateway tạo ảnh.')
        : 'Không tạo được ảnh fallback. Kiểm tra Python/Pillow.',
      finalImageBase64,
      mainProduct,
      accessories,
      tips: {
        summary: `Sản phẩm chính: ${mainProduct?.name || 'sản phẩm shop'}.`,
        sizeAdvice: [`Size đã chọn/gợi ý: ${req.body?.selectedSize || req.body?.recommendedSize || 'chưa chọn'}`],
        accessoryAdvice: accessories.length
          ? [`Phụ kiện đã chọn: ${accessories.map((x) => x.name).join(', ')}`]
          : ['Chưa chọn phụ kiện.'],
      },
      gateway,
      localPreview,
      debug: {
        v50ForcedRoute: true,
        gatewayReturnedImage: Boolean(gateway?.imageBase64 || gateway?.finalImageBase64 || gateway?.image),
        localPreviewReturnedImage: Boolean(localPreview?.imageBase64),
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message, v50: true });
  }
});

// ================= JAPANO V50 FORCE IMAGE OUTPUT ROUTES END =================
