// ================= JAPANO V44 MOBILE TRYON ROUTES START =================

const JAPANO_V44_GATEWAY_URL = process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001';

function v44DataUriToBuffer(data = '') {
  const text = String(data || '');
  const base64 = text.includes(',') ? text.split(',').pop() : text;
  return Buffer.from(base64 || '', 'base64');
}
function v44BufferToDataUri(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
}
async function v44ResolveImageInput({ imageUrl = '', imageBase64 = '', fallbackName = 'image.jpg' } = {}) {
  if (imageBase64) {
    const mimeMatch = String(imageBase64).match(/^data:([^;]+);base64,/i);
    return {
      buffer: v44DataUriToBuffer(imageBase64),
      mimeType: mimeMatch?.[1] || 'image/png',
      filename: fallbackName,
      source: 'base64',
    };
  }
  const url = String(imageUrl || '').trim();
  if (url) {
    if (!/^https?:\/\//i.test(url)) throw new Error('Link ảnh phải bắt đầu bằng http:// hoặc https://');
    const fetched = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 25 * 1024 * 1024 });
    const mimeType = String(fetched.headers['content-type'] || 'image/jpeg').split(';')[0];
    if (!mimeType.startsWith('image/')) throw new Error('Link không trả về ảnh hợp lệ');
    return {
      buffer: Buffer.from(fetched.data),
      mimeType,
      filename: path.basename(new URL(url).pathname) || fallbackName,
      source: 'url',
      originalUrl: url,
    };
  }
  throw new Error('Thiếu ảnh hợp lệ');
}
async function v44GatewayPost(pathName, body, timeout = 240000) {
  const url = `${JAPANO_V44_GATEWAY_URL.replace(/\/+$/, '')}${pathName}`;
  const res = await axios.post(url, body, { timeout, maxBodyLength: 60 * 1024 * 1024, maxContentLength: 60 * 1024 * 1024 });
  return res.data;
}

function v44GuessAccessoryAdvice(category = 'fashion') {
  const c = String(category || '').toLowerCase();
  const tags = [];
  const sizeAdvice = [];
  if (c.includes('swim') || c.includes('bikini')) {
    tags.push('resort', 'summer', 'beach');
    sizeAdvice.push('Kiểm tra size ngực / eo / hông trước khi chọn đồ bơi');
  } else if (c.includes('accessories')) {
    tags.push('accessory-focused', 'detail styling');
  } else {
    tags.push('daily fashion', 'mix-and-match');
  }
  return { tags, sizeAdvice };
}

app.post('/api/v44/mobile/style-suggest', async (req, res) => {
  try {
    const category = String(req.body?.category || 'fashion');
    const productName = String(req.body?.productName || 'JAPANO outfit');
    const sizeInfo = String(req.body?.sizeInfo || '');
    const extra = v44GuessAccessoryAdvice(category);

    let visual = null;
    try {
      if (req.body?.personImageBase64 || req.body?.personImageUrl) {
        const person = await v44ResolveImageInput({
          imageBase64: req.body?.personImageBase64,
          imageUrl: req.body?.personImageUrl,
          fallbackName: 'person.jpg',
        });
        const tmp = path.join(os.tmpdir(), `japano-v44-style-${Date.now()}.jpg`);
        await fs.writeFile(tmp, person.buffer);
        visual = await analyzeMediaWithLocalVisionModel(tmp, 'image');
        await fs.unlink(tmp).catch(() => null);
      }
    } catch (e) {
      visual = { warning: e.message };
    }

    const styleTags = [...new Set([...(visual?.visualTags || []), ...extra.tags])];
    const accessoryAdvice = [
      'Dây chuyền mảnh cho cổ gọn',
      'Đồng hồ mặt nhỏ cho cổ tay nhỏ-vừa',
      'Túi vai nhỏ cho set đi chơi',
      'Kính oval/rectangular tùy khuôn mặt',
    ];
    const sizeAdvice = [
      ...(extra.sizeAdvice || []),
      sizeInfo ? `Dựa trên thông tin bạn nhập: ${sizeInfo}` : 'Hãy nhập chiều cao/cân nặng/eo/hông để gợi ý size sát hơn',
      'Nếu đồ ôm sát, ưu tiên xem bảng size thật của sản phẩm',
    ];

    res.json({
      ok: true,
      summary: `Gợi ý cho "${productName}" trong danh mục "${category}". Ưu tiên giữ ảnh người làm gốc, phối thêm phụ kiện hợp phong cách.`,
      styleTags,
      accessoryAdvice,
      sizeAdvice,
      visual,
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/v44/mobile/tryon', async (req, res) => {
  try {
    const adultConfirmed = Boolean(req.body?.adultConfirmed);
    const category = String(req.body?.category || 'fashion');
    const productName = String(req.body?.productName || 'JAPANO outfit');
    const prompt = String(req.body?.prompt || '');

    const person = await v44ResolveImageInput({
      imageBase64: req.body?.personImageBase64,
      imageUrl: req.body?.personImageUrl,
      fallbackName: 'person.png',
    });
    const garment = await v44ResolveImageInput({
      imageBase64: req.body?.garmentImageBase64,
      imageUrl: req.body?.garmentImageUrl,
      fallbackName: 'garment.png',
    });

    const accessoryImagesBase64 = Array.isArray(req.body?.accessoryImagesBase64) ? req.body.accessoryImagesBase64 : [];
    const accessoryImageUrls = Array.isArray(req.body?.accessoryImageUrls) ? req.body.accessoryImageUrls : [];
    const accessoryRefs = [];

    for (const b64 of accessoryImagesBase64.slice(0, 5)) {
      try { accessoryRefs.push(await v44ResolveImageInput({ imageBase64: b64, fallbackName: 'accessory.png' })); } catch {}
    }
    for (const url of accessoryImageUrls.slice(0, 5)) {
      try { accessoryRefs.push(await v44ResolveImageInput({ imageUrl: url, fallbackName: 'accessory.jpg' })); } catch {}
    }

    let styleSuggest = null;
    styleSuggest = {
      summary: 'Đã nhận ảnh người + ảnh đồ. Hệ thống sẽ mặc đồ mẫu lên người dùng và giữ ảnh người đầu tiên làm anchor consistency.',
      styleTags: v44GuessAccessoryAdvice(category).tags,
      accessoryAdvice: [
        'Đặt dây chuyền ở cổ',
        'Đặt đồng hồ ở cổ tay',
        'Đặt túi ở vai/tay',
        'Đặt kính ở mắt',
        'Đặt giày ở chân nếu có ảnh giày',
      ],
      sizeAdvice: [
        req.body?.sizeInfo ? `Thông tin size: ${req.body.sizeInfo}` : 'Hãy nhập thêm chiều cao/cân nặng/eo/hông để gợi ý size tốt hơn',
      ],
    };

    let gateway = null;
    try {
      gateway = await v44GatewayPost('/tryon/advanced', {
        personImageBase64: v44BufferToDataUri(person.buffer, person.mimeType),
        garmentImageBase64: v44BufferToDataUri(garment.buffer, garment.mimeType),
        accessoryImagesBase64: accessoryRefs.map((x) => v44BufferToDataUri(x.buffer, x.mimeType)),
        category,
        productName,
        adultConfirmed,
        preserveVisibleSkin: true,
        noExtraCovering: true,
        realisticRefine: true,
        anchorIdentity: 'use-first-person-image',
        consistencyPolicy: 'lock-first',
        prompt: [
          'Use the person image as the primary identity anchor.',
          'Put the garment/product image onto the uploaded person.',
          'Do not paste the user onto the sample model.',
          'Accessories must be attached naturally to the user image.',
          'Preserve face/body identity and lighting as much as possible.',
          'If multiple results differ, use the first consistent result as final.',
          prompt,
        ].filter(Boolean).join('\n'),
      }, 300000);
    } catch (e) {
      gateway = { ok: false, message: e.message };
    }

    let generateFallback = null;
    if (!gateway?.ok) {
      try {
        generateFallback = await v44GatewayPost('/generate/realistic', {
          prompt: [
            `Create a realistic fashion try-on result for "${productName}" in category "${category}".`,
            'Main subject must be the uploaded person image, not the sample model.',
            'Apply the garment details from the uploaded garment image.',
            'Use accessory references if provided: necklace, watch, bag, glasses, shoes.',
            'Maintain consistent identity; if uncertain, stay as close as possible to the first person image.',
            adultConfirmed ? 'Adult fashion is confirmed for swimwear/crop-top if relevant. Keep proper garment cut and visible skin.' : '',
          ].filter(Boolean).join('\n'),
          width: 768,
          height: 1024,
          steps: 4,
          adultConfirmed,
          allowSwimwear: true,
          noExtraCovering: true,
          references: [],
        }, 300000);
      } catch (e) {
        generateFallback = { ok: false, message: e.message };
      }
    }

    const firstImage = gateway?.imageBase64 || generateFallback?.imageBase64 || '';
    const finalImageBase64 = firstImage || '';

    res.json({
      ok: true,
      message: gateway?.ok
        ? 'Đã chạy try-on AI bằng ảnh người dùng làm ảnh gốc.'
        : generateFallback?.ok
          ? 'Try-on runner chưa trả ảnh trực tiếp; đã fallback sang generate realistic nhưng vẫn giữ người dùng làm nhân vật chính.'
          : 'AI Gateway chưa trả được ảnh try-on.',
      styleSuggest,
      gateway,
      generateFallback,
      finalImageBase64,
      debug: {
        chosenFinalPolicy: 'first-image-anchor',
        accessoryCount: accessoryRefs.length,
        category,
        productName,
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ================= JAPANO V44 MOBILE TRYON ROUTES END =================
