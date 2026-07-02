// JAPANO_WEB_V42_ROUTES_BEGIN
// Web routes for JAPANO V42: URL image input, browser webcam frame input, realistic generation.
const JAPANO_V42_GATEWAY_URL = process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001';

function v42StripDataUri(value = '') {
  const text = String(value || '');
  if (text.startsWith('data:') && text.includes(',')) return text.split(',', 2)[1];
  return text;
}

function v42AsDataUri(base64 = '', mimeType = 'image/png') {
  if (!base64) return '';
  if (String(base64).startsWith('data:')) return base64;
  return `data:${mimeType || 'image/png'};base64,${base64}`;
}

function v42AssertHttpUrl(url = '') {
  const text = String(url || '').trim();
  if (!/^https?:\/\//i.test(text)) throw new Error('Link ảnh phải bắt đầu bằng http:// hoặc https://');
  return text;
}

async function v42DownloadImageBase64(url) {
  const cleanUrl = v42AssertHttpUrl(url);
  const response = await axios.get(cleanUrl, {
    responseType: 'arraybuffer',
    timeout: 45000,
    maxContentLength: 35 * 1024 * 1024,
    headers: { 'User-Agent': 'JAPANO-Web-AI/42' },
  });
  const mimeType = String(response.headers?.['content-type'] || 'image/jpeg').split(';')[0] || 'image/jpeg';
  if (!mimeType.startsWith('image/')) throw new Error(`Link không phải ảnh hợp lệ: ${mimeType}`);
  return {
    base64: Buffer.from(response.data).toString('base64'),
    mimeType,
    size: Buffer.byteLength(response.data),
  };
}

async function v42GatewayPost(pathname, body, timeout = 240000) {
  const response = await axios.post(`${JAPANO_V42_GATEWAY_URL}${pathname}`, body, { timeout, maxBodyLength: Infinity, maxContentLength: Infinity });
  return response.data;
}

async function v42MaybeCloudinaryImage(data, filenamePrefix = 'v42-web') {
  const raw = data?.imageBase64 || data?.dataUrl || '';
  if (!raw) return data;
  const base64 = v42StripDataUri(raw);
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) return data;
  try {
    const asset = await createCloudinaryAsset({
      userId: data?.userId || 'web-v42',
      filename: `${filenamePrefix}-${Date.now()}.png`,
      mimeType: 'image/png',
      buffer,
      folder: 'generated/v42-web',
      source: 'v42-web-ai',
    });
    const url = normalizeCloudinaryUrl(asset);
    return { ...data, url, imageUrl: url, imageBase64: undefined, dataUrl: undefined, cloudinarySaved: true };
  } catch (e) {
    return { ...data, url: v42AsDataUri(raw, 'image/png'), dataUrl: v42AsDataUri(raw, 'image/png'), cloudinarySaved: false, cloudinaryWarning: e.message };
  }
}

app.get('/api/v42/web/health', async (req, res) => {
  try {
    const gateway = await axios.get(`${JAPANO_V42_GATEWAY_URL}/health`, { timeout: 7000 }).then((r) => r.data);
    res.json({ ok: true, api: 'JAPANO_WEB_V42', backend: true, gatewayUrl: JAPANO_V42_GATEWAY_URL, gateway });
  } catch (e) {
    res.status(503).json({ ok: false, api: 'JAPANO_WEB_V42', backend: true, gatewayUrl: JAPANO_V42_GATEWAY_URL, message: e.message });
  }
});

app.post('/api/v42/web/camera-url', async (req, res) => {
  try {
    const img = await v42DownloadImageBase64(req.body.imageUrl || req.body.url);
    const data = await v42GatewayPost('/camera/analyze', {
      imageBase64: img.base64,
      products: Array.isArray(req.body.products) ? req.body.products : [],
      userProfile: req.body.userProfile || {},
      mode: req.body.mode || 'web-camera-url',
      adultConfirmed: Boolean(req.body.adultConfirmed),
      allowSwimwear: req.body.allowSwimwear !== false,
      preserveVisibleSkin: req.body.preserveVisibleSkin !== false,
      noExtraCovering: req.body.noExtraCovering !== false,
    }, 240000);
    res.json({ ...data, source: { imageUrl: req.body.imageUrl || req.body.url, mimeType: img.mimeType, size: img.size } });
  } catch (e) {
    res.status(500).json({ ok: false, message: `V42 camera URL lỗi: ${e.message}` });
  }
});

app.post('/api/v42/web/camera-base64', async (req, res) => {
  try {
    const data = await v42GatewayPost('/camera/analyze', {
      imageBase64: v42StripDataUri(req.body.imageBase64 || req.body.dataUrl || ''),
      products: Array.isArray(req.body.products) ? req.body.products : [],
      userProfile: req.body.userProfile || {},
      mode: req.body.mode || 'web-webcam-frame',
      adultConfirmed: Boolean(req.body.adultConfirmed),
      allowSwimwear: req.body.allowSwimwear !== false,
      preserveVisibleSkin: req.body.preserveVisibleSkin !== false,
      noExtraCovering: req.body.noExtraCovering !== false,
    }, 240000);
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, message: `V42 webcam analyze lỗi: ${e.message}` });
  }
});

app.post('/api/v42/web/generate-realistic', async (req, res) => {
  try {
    const data = await v42GatewayPost('/generate/realistic', {
      prompt: req.body.prompt || '',
      negativePrompt: req.body.negativePrompt,
      width: Number(req.body.width || 768),
      height: Number(req.body.height || 1024),
      steps: Number(req.body.steps || 4),
      mode: req.body.mode || 'web-realistic-fashion',
      adultConfirmed: Boolean(req.body.adultConfirmed),
      allowSwimwear: req.body.allowSwimwear !== false,
      references: Array.isArray(req.body.references) ? req.body.references : [],
    }, 360000);
    res.json(await v42MaybeCloudinaryImage({ ...data, userId: req.body.userId || 'web-v42' }, 'v42-realistic'));
  } catch (e) {
    res.status(500).json({ ok: false, message: `V42 generate realistic lỗi: ${e.message}` });
  }
});

app.post('/api/v42/web/tryon-url', async (req, res) => {
  try {
    const personUrl = req.body.personImageUrl || req.body.personUrl;
    const garmentUrl = req.body.garmentImageUrl || req.body.garmentUrl;
    if (!personUrl || !garmentUrl) return res.status(400).json({ ok: false, message: 'Thiếu personImageUrl hoặc garmentImageUrl.' });

    const category = String(req.body.category || 'fashion');
    const productName = String(req.body.productName || 'JAPANO product');
    const categoryText = `${category} ${productName}`.toLowerCase();
    const swimwear = /bikini|swim|swimwear|đồ bơi|do boi|áo tắm|ao tam|crop|bra top/.test(categoryText);
    if (swimwear && !req.body.adultConfirmed) {
      return res.status(400).json({ ok: false, requiresAdultConfirmation: true, message: 'Try-on bikini/đồ bơi/crop-top yêu cầu xác nhận người trong ảnh là người lớn.' });
    }

    const person = await v42DownloadImageBase64(personUrl);
    const garment = await v42DownloadImageBase64(garmentUrl);
    const accessoryUrls = Array.isArray(req.body.accessoryImageUrls) ? req.body.accessoryImageUrls.filter(Boolean).slice(0, 8) : [];
    const accessories = [];
    for (const url of accessoryUrls) {
      try { accessories.push((await v42DownloadImageBase64(url)).base64); } catch {}
    }

    const payload = {
      personImageBase64: person.base64,
      garmentImageBase64: garment.base64,
      accessoryImagesBase64: accessories,
      category,
      productName,
      prompt: req.body.prompt || '',
      adultConfirmed: Boolean(req.body.adultConfirmed),
      preserveVisibleSkin: req.body.preserveVisibleSkin !== false,
      noExtraCovering: req.body.noExtraCovering !== false,
      realisticRefine: req.body.realisticRefine !== false,
    };

    const tryon = await v42GatewayPost('/tryon/advanced', payload, 300000);
    if (tryon?.ok && (tryon.imageBase64 || tryon.dataUrl)) {
      return res.json(await v42MaybeCloudinaryImage({ ...tryon, userId: req.body.userId || 'web-v42' }, 'v42-tryon'));
    }

    // Local CatVTON runner may not be wired yet. Generate a realistic preview instead of leaving the web UI empty.
    const fallbackPrompt = [
      'Adult fashion ecommerce preview, photorealistic model wearing the referenced clothing concept.',
      `Product: ${productName}. Category: ${category}.`,
      req.body.prompt || '',
      'Preserve visible skin and garment cut if item is legitimate swimwear/crop-top; do not add extra covering layers unless requested.',
      accessoryUrls.length ? 'Include matching accessories naturally: necklace, watch, glasses, bag if referenced.' : '',
      'High-end Japanese fashion catalog lighting, realistic fabric, no body distortion, no explicit nudity.',
    ].filter(Boolean).join(' ');
    const generated = await v42GatewayPost('/generate/realistic', {
      prompt: fallbackPrompt,
      width: 768,
      height: 1024,
      steps: 4,
      mode: 'web-tryon-fallback-realistic',
      adultConfirmed: Boolean(req.body.adultConfirmed),
      allowSwimwear: true,
    }, 360000).catch((e) => ({ ok: false, message: e.message }));

    const output = await v42MaybeCloudinaryImage({ ...generated, userId: req.body.userId || 'web-v42' }, 'v42-tryon-preview');
    res.json({
      ok: Boolean(output?.ok),
      provider: output?.ok ? 'sdxl-preview-while-catvton-runner-not-wired' : 'v42-tryon-scaffold',
      tryon,
      ...output,
      message: output?.ok
        ? 'CatVTON runner chưa nối trực tiếp, web đã tạo ảnh preview realistic bằng SDXL local. Nối runner CatVTON để có try-on chính xác theo người thật.'
        : (tryon?.message || output?.message || 'Local try-on chưa sẵn sàng.'),
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: `V42 try-on URL lỗi: ${e.message}` });
  }
});
// JAPANO_WEB_V42_ROUTES_END
