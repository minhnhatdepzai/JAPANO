// Trợ lý phong cách AI: sức khoẻ dịch vụ AI, gợi ý trang chủ/liên quan, hồ sơ
// phong cách, mục tiêu mua sắm + sức khoẻ, ghép set trang phục, tư vấn size,
// và chatbot Ori.
const { fetchWithTimeout, serviceHealth } = require('../lib/httpFetch');
const { CATVTON_URL, FASHN_URL, MOTION_URL, AI_GATEWAY_URL, OLLAMA_URL } = require('../lib/serviceUrls');

// map 4 lựa chọn phong cách của app sang đúng từ vựng tag đang có trong catalog (backend/seed.js) để content-based match được
const STYLE_LABELS = {
  'toi-gian': ['tối giản', 'nhẹ nhàng', 'unisex'],
  'duong-pho': ['streetwear', 'học đường', 'unisex'],
  'thanh-lich': ['thanh lịch', 'công sở'],
  'nhat-co': ['truyền thống', 'nhật', 'lễ hội'],
};
const styleTags = (style) => STYLE_LABELS[style] || [style];

module.exports = function registerStylistRoutes(api, ctx) {
  const {
    read, update, tryonGpuBusy,
    getHomeRecommendations, getRecommendationDiagnostics, runPillow, analyzePortrait, buildGoalPlan, enhanceCoaching,
    composeOutfit, todaysOutfit, adviseSize, styleRecommendation, chatbot,
  } = ctx;

  api.get('/ai/health', async (req, res) => {
    const [fashn, motion, catvton, gateway, ollama] = await Promise.all([
      serviceHealth(FASHN_URL),
      serviceHealth(MOTION_URL),
      serviceHealth(CATVTON_URL),
      serviceHealth(AI_GATEWAY_URL),
      serviceHealth(OLLAMA_URL, '/api/tags'),
    ]);
    const recommendation = getRecommendationDiagnostics(read());
    res.json({
      ok: true,
      engine: fashn.online ? 'fashn-vton-1.5' : catvton.online ? 'catvton-fallback' : gateway.online ? 'ai-gateway' : 'unavailable',
      services: { fashn, motion, catvton, gateway, ollama, pillow: { configured: true, online: true } },
      pipelines: {
        chatbot: {
          status: 'active',
          engine: 'hybrid-post-transformer',
          grounded: true,
          ollamaEnabled: String(process.env.JAPANO_OLLAMA_CHAT || '0') === '1',
          ollamaOnline: Boolean(ollama.online),
          models: ['mlstm-style-matrix-memory', 'semantic-hashing-expert', 'sparse-moe-router', 'catalog-retrieval', 'ollama-optional'],
        },
        recommendation,
      },
      fallbackReady: false,
    });
  });

  async function polishWithOllama(userMessage, draft) {
    const startedAt = Date.now();
    // Retrieval là mặc định để tên/giá/sản phẩm luôn đúng catalog. Chỉ bật LLM viết lại
    // khi người vận hành chủ động đặt JAPANO_OLLAMA_CHAT=1.
    const model = process.env.OLLAMA_MODEL || process.env.JAPANO_OLLAMA_MODEL || 'qwen2.5:7b';
    if (String(process.env.JAPANO_OLLAMA_CHAT || '0') !== '1') {
      return { message: draft, used: false, model: 'local-grounded-retrieval', latencyMs: Date.now() - startedAt, fallbackReason: 'ollama-disabled' };
    }
    if (tryonGpuBusy()) {
      return { message: draft, used: false, model: 'local-grounded-retrieval', latencyMs: Date.now() - startedAt, fallbackReason: 'gpu-busy' };
    }
    try {
      const prompt = [
        'Bạn là Ori, trợ lý mua sắm thời trang Nhật của JAPANO.',
        'Viết lại câu trả lời nháp bằng tiếng Việt tự nhiên, thân thiện, tối đa 90 từ.',
        'Không bịa giá, voucher, trạng thái đơn hoặc sản phẩm; không thêm sản phẩm mới.',
        `Câu hỏi: ${String(userMessage || '').slice(0, 800)}`,
        `Câu trả lời nháp đã truy hồi từ dữ liệu thật: ${String(draft || '').slice(0, 1600)}`,
      ].join('\n');
      const response = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.25, num_predict: 180 } }),
      }, Number(process.env.JAPANO_OLLAMA_TIMEOUT_MS || 45000));
      if (!response.ok) {
        return { message: draft, used: false, model: 'local-grounded-retrieval', latencyMs: Date.now() - startedAt, fallbackReason: `ollama-http-${response.status}` };
      }
      const data = await response.json();
      const message = String(data.response || '').trim();
      return {
        message: message || draft,
        used: Boolean(message),
        model: message ? model : 'local-grounded-retrieval',
        latencyMs: Date.now() - startedAt,
        fallbackReason: message ? null : 'ollama-empty',
      };
    } catch (error) {
      return {
        message: draft, used: false, model: 'local-grounded-retrieval',
        latencyMs: Date.now() - startedAt,
        fallbackReason: error?.name === 'AbortError' ? 'ollama-timeout' : 'ollama-unavailable',
      };
    }
  }

  // gợi ý trang chủ: hybrid CF (cosine) + Matrix Factorization (SGD) + content-based + trending
  api.get('/recommendations/home', (req, res) => {
    const userId = String(req.query.userId || 'guest');
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
    const style = req.query.style ? String(req.query.style) : '';
    const s = read();
    const stored = s.profiles.find((row) => row.userId === userId);
    const profile = style ? { ...stored, preferredStyles: styleTags(style) } : stored;
    res.json(getHomeRecommendations(s, { userId, limit, profile }));
  });
  api.get('/recommendations/:userId', (req, res) => {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
    const s = read();
    const profile = s.profiles.find((row) => row.userId === String(req.params.userId));
    res.json(getHomeRecommendations(s, { userId: String(req.params.userId), limit, profile }));
  });

  // lưu hồ sơ phong cách (dùng làm tín hiệu content-based cho user mới / cold-start)
  function saveStylistProfile(userId, p = {}) {
    const s = read();
    const next = {
      userId: String(userId),
      preferredStyles: p.style ? styleTags(p.style) : (Array.isArray(p.preferredStyles) ? p.preferredStyles : undefined),
      heightCm: p.height ? Number(p.height) : (p.heightCm ? Number(p.heightCm) : undefined),
      weightKg: p.weight ? Number(p.weight) : (p.weightKg ? Number(p.weightKg) : undefined),
      usualSize: p.usualSize,
      occasion: p.occasion,
      budget: p.budget ? Number(p.budget) : undefined,
      updatedAt: Date.now(),
    };
    const i = s.profiles.findIndex((row) => row.userId === next.userId);
    const merged = { ...(i >= 0 ? s.profiles[i] : {}), ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) };
    if (i >= 0) s.profiles[i] = merged; else s.profiles.push(merged);
    ctx.write(s);
    return merged;
  }
  api.post('/stylist/profile', (req, res) => {
    const b = req.body || {};
    if (!b.userId) return res.status(400).json({ error: 'thiếu userId' });
    res.json({ ok: true, profile: saveStylistProfile(b.userId, b.profile || {}) });
  });
  // alias dạng /stylist/profile/:userId với body là hồ sơ trực tiếp (không bọc trong {profile})
  api.post('/stylist/profile/:userId', (req, res) => {
    res.json({ ok: true, profile: saveStylistProfile(req.params.userId, req.body || {}) });
  });
  api.get('/stylist/profile/:userId', (req, res) => {
    const profile = read().profiles.find((row) => row.userId === String(req.params.userId));
    res.json({ ok: true, profile: profile || null });
  });

  // Mục tiêu mua sắm + sức khoẻ: thuật toán tài chính quyết định con số,
  // LLM chỉ diễn đạt coach hành vi trong hàng rào an toàn.
  api.get('/goals/:userId', (req, res) => {
    const goals = (read().goals || [])
      .filter((goal) => goal.userId === String(req.params.userId))
      .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
    res.json({ ok: true, goals });
  });
  api.post('/goals/plan', async (req, res) => {
    const input = req.body || {};
    const userId = String(input.userId || 'guest');
    const state = read();
    const requestedId = String(input.productId || '');
    const product = state.products.find((item) => item.slug === requestedId || item.id === requestedId);
    if (!product) return res.status(400).json({ ok: false, message: 'Hãy chọn một sản phẩm JAPANO làm mục tiêu.' });
    const plan = buildGoalPlan(input, product);
    if (String(process.env.JAPANO_GOALS_LLM || '1') !== '0' && !tryonGpuBusy()) {
      plan.coaching = await enhanceCoaching({
        product,
        saving: plan.saving,
        wellness: plan.wellness,
        ollamaUrl: OLLAMA_URL,
        model: process.env.JAPANO_GOALS_MODEL || 'qwen2.5:7b',
        timeoutMs: Number(process.env.JAPANO_GOALS_TIMEOUT_MS || 90000),
      });
    }
    const now = Date.now();
    const goal = {
      id: `goal-${userId}-${product.slug}`,
      userId,
      productId: product.slug,
      product: { slug: product.slug, name: product.name, price: product.price, image: product.image },
      input: {
        age: Number(input.age) || undefined,
        heightCm: Number(input.heightCm) || undefined,
        currentWeightKg: Number(input.currentWeightKg) || undefined,
        targetWeightKg: Number(input.targetWeightKg) || undefined,
        monthlyIncome: Number(input.monthlyIncome) || 0,
        fixedExpenses: Number(input.fixedExpenses) || 0,
        currentSavings: Number(input.currentSavings) || 0,
        targetMonths: Number(input.targetMonths) || 6,
      },
      plan,
      createdAt: now,
      updatedAt: now,
    };
    update((next) => {
      const index = next.goals.findIndex((item) => item.id === goal.id);
      if (index >= 0) goal.createdAt = next.goals[index].createdAt || now;
      if (index >= 0) next.goals[index] = goal; else next.goals.push(goal);
      next.interactions.push({ id: `goal-i-${now}`, userId, productId: product.slug, type: 'goal', value: 1, createdAt: now, source: 'mobile' });
      return next;
    });
    res.json({ ok: true, goal });
  });

  // ghép đồ AI: set hôm nay (đổi mỗi ngày) và set phối quanh 1 sản phẩm cụ thể
  api.get('/outfits/today', (req, res) => {
    const set = todaysOutfit(read());
    if (!set) return res.status(200).json({ ok: false, message: 'Chưa đủ dữ liệu để ghép set hôm nay.' });
    res.json({ ok: true, ...set });
  });
  api.get('/outfits/:slug', (req, res) => {
    const set = composeOutfit(read(), req.params.slug);
    if (!set) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm để ghép set.' });
    res.json({ ok: true, ...set });
  });

  // tư vấn size dạng expert-system (số đo hoặc chiều cao/cân nặng) — chấp nhận cả body phẳng lẫn {profile}
  api.post('/stylist/size', (req, res) => {
    const b = req.body || {};
    const measurements = { ...b, ...(b.profile || {}) };
    const result = adviseSize(measurements);
    res.json({ ok: true, size: result.size, recommendedSize: result.size, advice: result.advice, message: result.advice });
  });

  // tư vấn phong cách cho "Ống kính JAPANO": hồ sơ + (tuỳ chọn) tông màu chủ đạo trích từ ảnh qua Pillow
  // + phân tích tâm trạng/độ tuổi qua ảnh (vision) để tinh chỉnh gợi ý và động viên người dùng.
  api.post('/stylist/recommend', async (req, res) => {
    const b = req.body || {};
    const userId = String(b.userId || 'guest');
    const s = read();
    const stored = s.profiles.find((row) => row.userId === userId);
    const profile = { ...stored, ...(b.profile || {}) };
    let dominantHex;
    let portrait = null;
    if (b.imageBase64) {
      const [colorResult, portraitResult] = await Promise.all([
        runPillow({ mode: 'dominant_color', imageBase64: b.imageBase64 }, 15000),
        tryonGpuBusy() ? Promise.resolve(null) : analyzePortrait({
          imageBase64: b.imageBase64,
          ollamaUrl: OLLAMA_URL,
          model: process.env.JAPANO_PORTRAIT_MODEL || 'qwen3-vl:8b',
          timeoutMs: Number(process.env.JAPANO_PORTRAIT_TIMEOUT_MS || 60000),
        }),
      ]);
      if (colorResult.ok) dominantHex = colorResult.hex;
      portrait = portraitResult;
    }
    const biasedProfile = portrait?.styleTags?.length
      ? { ...profile, preferredStyles: [...new Set([...(profile.preferredStyles || []), ...portrait.styleTags])] }
      : profile;
    const result = styleRecommendation(s, { userId, profile: biasedProfile, dominantHex, limit: 8 });
    res.json({
      ok: true,
      recommendation: result,
      ...result,
      mood: portrait?.mood || null,
      moodLabel: portrait?.moodLabel || null,
      ageRange: portrait?.ageRange || null,
      cheerUp: portrait?.cheerUp || null,
    });
  });

  // chatbot Ori: nhận diện ý định theo từ khoá + truy hồi sản phẩm từ engine gợi ý/ghép đồ đã có
  api.post('/stylist/chat', async (req, res) => {
    const b = req.body || {};
    const s = read();
    const userId = String(b.userId || 'guest');
    const stored = s.profiles.find((row) => row.userId === userId);
    const profile = { ...stored, ...(b.profile || {}) };
    const storedHistory = (s.chats || []).filter((row) => String(row.userId) === userId).slice(-12);
    const requestHistory = Array.isArray(b.history) ? b.history.slice(-12) : [];
    const history = requestHistory.length ? requestHistory : storedHistory;
    const result = chatbot.reply(s, { userId, message: b.message, profile, history });
    const generation = await polishWithOllama(b.message, result.message);
    const message = generation.message;
    const engine = generation.used ? 'hybrid-post-transformer+ollama' : 'hybrid-post-transformer';
    update((state) => {
      const createdAt = Date.now();
      state.chats.push({ id: `chat-${createdAt}`, userId, role: 'user', message: String(b.message || ''), createdAt });
      state.chats.push({
        id: `chat-${createdAt}-ai`, userId, role: 'assistant', message,
        productIds: result.productIds, createdAt: createdAt + 1, engine,
        intent: result.intent, confidence: result.confidence, modelTrace: result.modelTrace,
        generationModel: generation.model, latencyMs: generation.latencyMs,
        fallbackReason: generation.fallbackReason,
      });
      const explicitProductIntent = ['lookup', 'price', 'outfit'].includes(result.intent);
      (result.productIds || []).forEach((productId, index) => state.interactions.push({
        id: `chat-i-${createdAt}-${index}`, userId, productId,
        type: explicitProductIntent ? 'chat' : 'impression',
        value: explicitProductIntent ? 1 : 0, createdAt, source: 'mobile',
        metadata: { intent: result.intent, generatedByBot: true },
      }));
      return state;
    });
    res.json({
      ok: true, message, reply: message, productIds: result.productIds,
      products: result.productIds, engine, intent: result.intent,
      confidence: result.confidence, models: result.modelTrace?.models || [],
      modelTrace: result.modelTrace, generationModel: generation.model,
      latencyMs: generation.latencyMs, fallbackReason: generation.fallbackReason,
    });
  });
};
