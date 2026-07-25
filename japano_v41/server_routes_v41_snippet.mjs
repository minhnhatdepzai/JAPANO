// JAPANO_V41_AI_ROUTES_BEGIN
const JAPANO_AI_GATEWAY_URL = process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:__GATEWAY_PORT__';
const JAPANO_AI_ALLOW_API_FALLBACK = String(process.env.JAPANO_AI_ALLOW_API_FALLBACK || '1') !== '0';

function v41ToDataUri(mime, base64) {
  if (!base64) return '';
  if (String(base64).startsWith('data:')) return base64;
  return `data:${mime || 'image/png'};base64,${base64}`;
}
async function v41GatewayPost(path, body, timeout = 180000) {
  const res = await axios.post(`${JAPANO_AI_GATEWAY_URL}${path}`, body, { timeout });
  return res.data;
}
function v41FileToBase64(file) {
  if (!file?.buffer) return '';
  return file.buffer.toString('base64');
}
function v41FashionModeFromBody(body = {}) {
  const category = String(body.category || body.productCategory || body.type || '').toLowerCase();
  const name = String(body.productName || body.name || '').toLowerCase();
  const text = `${category} ${name}`;
  const swimwear = /bikini|swim|swimwear|đồ bơi|do boi|áo tắm|ao tam|crop|bra top/i.test(text);
  return {
    swimwear,
    preserveVisibleSkin: body.preserveVisibleSkin !== false,
    noExtraCovering: body.noExtraCovering !== false,
    adultConfirmed: body.adultConfirmed === true || String(body.adultConfirmed) === 'true',
  };
}

app.get('/api/v41/ai/health', async (_, res) => {
  try {
    const data = await axios.get(`${JAPANO_AI_GATEWAY_URL}/health`, { timeout: 6000 });
    res.json({ ok: true, gateway: JAPANO_AI_GATEWAY_URL, ...data.data });
  } catch (e) {
    res.status(503).json({ ok: false, gateway: JAPANO_AI_GATEWAY_URL, message: e.message });
  }
});

app.post('/api/v41/camera/analyze', upload.any(), async (req, res) => {
  try {
    const imageFile = (req.files || []).find((f) => String(f.fieldname || '').toLowerCase().includes('image') || String(f.mimetype || '').startsWith('image/'));
    const imageBase64 = req.body.imageBase64 || v41FileToBase64(imageFile);
    const products = req.body.products ? JSON.parse(req.body.products) : [];
    const userProfile = req.body.userProfile ? JSON.parse(req.body.userProfile) : {};
    const data = await v41GatewayPost('/camera/analyze', {
      imageBase64,
      products,
      userProfile,
      mode: req.body.mode || 'camera-stylist',
      adultConfirmed: req.body.adultConfirmed === 'true' || req.body.adultConfirmed === true,
      allowSwimwear: req.body.allowSwimwear !== 'false',
      preserveVisibleSkin: req.body.preserveVisibleSkin !== 'false',
      noExtraCovering: req.body.noExtraCovering !== 'false',
    }, 240000);
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, message: `V41 camera analyze lỗi: ${e.message}` });
  }
});

app.post('/api/v41/size/advice', async (req, res) => {
  try {
    const data = await v41GatewayPost('/size/advice', req.body || {}, 120000);
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, message: `V41 size advice lỗi: ${e.message}` });
  }
});

app.post('/api/v41/generate/realistic', async (req, res) => {
  try {
    const data = await v41GatewayPost('/generate/realistic', req.body || {}, 240000);
    if (data?.ok && data.imageBase64) {
      const asset = await createCloudinaryAsset({
        buffer: Buffer.from(String(data.imageBase64).replace(/^data:image\/\w+;base64,/, ''), 'base64'),
        filename: `v41-realistic-${Date.now()}.png`,
        mimetype: 'image/png',
        folder: 'generated/v41',
        tags: ['v41', 'local-ai', 'realistic'],
      }).catch(() => null);
      const url = asset ? normalizeCloudinaryUrl(asset) : v41ToDataUri('image/png', data.imageBase64);
      return res.json({ ...data, url, imageBase64: undefined });
    }
    if (!data?.ok && JAPANO_AI_ALLOW_API_FALLBACK && FOTOR_API_KEY && req.body?.prompt) {
      const taskId = await startFotorImageGeneration({ content: req.body.prompt, width: req.body.width || 896, height: req.body.height || 1152 });
      const fotorResult = await waitForFotorImages(taskId, { attempts: 18, delayMs: 3500 });
      return res.json({ ok: true, provider: 'api-fallback-fotor', urls: fotorResult.urls, message: data?.message || 'Local AI chưa tạo được, đã fallback API.' });
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, message: `V41 generate lỗi: ${e.message}` });
  }
});

app.post('/api/v41/tryon/advanced', upload.any(), async (req, res) => {
  try {
    const files = req.files || [];
    const person = files.find((f) => /person|user|body|model/i.test(String(f.fieldname))) || files[0];
    const garment = files.find((f) => /garment|cloth|product|bikini|outfit/i.test(String(f.fieldname))) || files[1];
    const accessories = files.filter((f) => /accessory|watch|necklace|bag|glass|ring/i.test(String(f.fieldname))).map(v41FileToBase64);
    const fashionMode = v41FashionModeFromBody(req.body || {});
    if (fashionMode.swimwear && !fashionMode.adultConfirmed) {
      return res.status(400).json({ ok: false, requiresAdultConfirmation: true, message: 'Try-on bikini/đồ bơi yêu cầu xác nhận người trong ảnh là người lớn.' });
    }
    const body = {
      personImageBase64: req.body.personImageBase64 || v41FileToBase64(person),
      garmentImageBase64: req.body.garmentImageBase64 || v41FileToBase64(garment),
      accessoryImagesBase64: req.body.accessoryImagesBase64 ? JSON.parse(req.body.accessoryImagesBase64) : accessories,
      category: req.body.category || req.body.productCategory || 'fashion',
      productName: req.body.productName || '',
      prompt: req.body.prompt || '',
      adultConfirmed: fashionMode.adultConfirmed,
      preserveVisibleSkin: fashionMode.preserveVisibleSkin,
      noExtraCovering: fashionMode.noExtraCovering,
      realisticRefine: req.body.realisticRefine !== 'false',
    };
    const data = await v41GatewayPost('/tryon/advanced', body, 300000);
    if (!data?.ok && JAPANO_AI_ALLOW_API_FALLBACK) {
      return res.json({ ...data, ok: false, fallbackReady: true, message: `${data?.message || 'Local try-on chưa sẵn sàng.'} Có thể dùng endpoint cũ /api/try-on/generate hoặc API fallback hiện tại.` });
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, message: `V41 try-on lỗi: ${e.message}` });
  }
});
// JAPANO_V41_AI_ROUTES_END
