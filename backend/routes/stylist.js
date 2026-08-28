// Trợ lý phong cách AI: sức khoẻ dịch vụ AI, gợi ý trang chủ/liên quan, hồ sơ
// phong cách, mục tiêu mua sắm + sức khoẻ, ghép set trang phục, tư vấn size,
// và chatbot Ori.
const { fetchWithTimeout, serviceHealth } = require('../lib/httpFetch');
const { CATVTON_URL, FASHN_URL, MOTION_URL, AI_GATEWAY_URL, OLLAMA_URL, EMBEDDING_URL } = require('../lib/serviceUrls');
const { setFocus, getFocus } = require('../lib/gpuArbiter');
const { pushNotification } = require('../lib/notify');
const {
  GOAL_FUND_CONFIG, ensureGoalFund, fundView, addDeposit, removeDeposit, ensureGoalRewardVoucher,
} = require('../lib/goalFund');
const {
  mergeBodySignals, summarizeBodyAnalysis, bodyAnalysisLogLine, bodyAnalysisEnabled, analyzeViaWorker,
  userProvidedMeasurement, profileForMeasurementMode, imageFingerprint,
} = require('../lib/bodyAnalysis');
const { logger } = require('../lib/logger');

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
    read, update, tryonGpuBusy, httpError, requireAuth, requireSelfOrStaff, roleAtLeast, sendPushToUser,
    getHomeRecommendations, getRecommendationDiagnostics, runPillow, analyzePortrait, buildGoalPlan, enhanceCoaching,
    composeOutfit, todaysOutfit, adviseSize, styleRecommendation, chatbot, runAccessoryPipeline,
  } = ctx;

  // Ứng dụng di động báo màn hình đang mở để backend ưu tiên GPU cho đúng tính
  // năng đó và nhả VRAM của các tính năng còn lại. Không bắt buộc đăng nhập:
  // đây chỉ là tín hiệu tối ưu tài nguyên, không đọc/ghi dữ liệu người dùng.
  api.post('/gpu/focus', async (req, res) => {
    const focus = String(req.body?.focus || '').trim();
    // Mỗi máy tự khai danh tính để lượt đổi màn hình của nó không cắt ngang
    // lượt thử đồ đang chạy trên máy khác.
    const owner = String(req.body?.clientId || req.body?.userId || '').trim();
    const result = await setFocus(focus, { cancelActive: true, owner }).catch((error) => ({
      ok: false,
      message: error?.message || 'Không đổi được ưu tiên GPU.',
    }));
    res.json(result);
  });

  api.get('/gpu/focus', (req, res) => res.json({ ok: true, ...getFocus() }));

  api.get('/ai/health', async (req, res) => {
    const [fashn, motion, catvton, gateway, ollama, embedding] = await Promise.all([
      serviceHealth(FASHN_URL),
      serviceHealth(MOTION_URL),
      serviceHealth(CATVTON_URL),
      serviceHealth(AI_GATEWAY_URL),
      serviceHealth(OLLAMA_URL, '/api/tags'),
      serviceHealth(EMBEDDING_URL),
    ]);
    const recommendation = getRecommendationDiagnostics(read());
    res.json({
      ok: true,
      engine: fashn.online ? 'fashn-vton-1.5' : catvton.online ? 'catvton-fallback' : gateway.online ? 'ai-gateway' : 'unavailable',
      services: { fashn, motion, catvton, gateway, ollama, embedding, pillow: { configured: true, online: true } },
      // Trạng thái adapter LoRA lấy thẳng từ service thử đồ: đường dẫn, đã nạp
      // hay chưa, hash checkpoint và danh mục được áp dụng. Không chứa secret.
      fitLora: fashn?.detail?.fitLora || { adapterLoaded: false, configuredPath: null },
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
  // Hồ sơ phong cách chứa chiều cao/cân nặng/size — dữ liệu cá nhân, nên phải
  // là chính chủ (hoặc nhân viên hỗ trợ) mới đọc/ghi được.
  api.post('/stylist/profile', requireSelfOrStaff((req) => req.body?.userId), (req, res) => {
    const b = req.body || {};
    res.json({ ok: true, profile: saveStylistProfile(b.userId, b.profile || {}) });
  });
  // alias dạng /stylist/profile/:userId với body là hồ sơ trực tiếp (không bọc trong {profile})
  api.post('/stylist/profile/:userId', requireSelfOrStaff((req) => req.params.userId), (req, res) => {
    res.json({ ok: true, profile: saveStylistProfile(req.params.userId, req.body || {}) });
  });
  api.get('/stylist/profile/:userId', requireSelfOrStaff((req) => req.params.userId), (req, res) => {
    const profile = read().profiles.find((row) => row.userId === String(req.params.userId));
    res.json({ ok: true, profile: profile || null });
  });

  // Mục tiêu mua sắm + sức khoẻ: thuật toán tài chính quyết định con số,
  // LLM chỉ diễn đạt coach hành vi trong hàng rào an toàn. Mỗi mục tiêu mua sắm
  // còn có một QUỸ TÍCH LUỸ (lib/goalFund.js) để khách nạp dần cho tới khi đủ
  // tiền — đủ quỹ thì được thưởng voucher giảm giá cá nhân.
  const goalWithFund = (goal) => ({ ...goal, fund: goal.fund ? fundView(goal) : null });

  function findOwnGoal(state, goalId, user) {
    const goal = (state.goals || []).find((item) => String(item.id) === String(goalId));
    if (!goal) throw httpError(404, 'Không tìm thấy mục tiêu.');
    if (String(goal.userId) !== String(user.id) && !roleAtLeast(user.role, 'admin')) {
      throw httpError(403, 'Bạn không có quyền thao tác với mục tiêu này.');
    }
    return goal;
  }

  // Mục tiêu chứa thu nhập/chi tiêu cá nhân nên chỉ chính chủ (hoặc admin) xem được.
  api.get('/goals/:userId', requireAuth, (req, res) => {
    const target = String(req.params.userId);
    if (target !== String(req.user.id) && !roleAtLeast(req.user.role, 'admin')) {
      return res.status(403).json({ ok: false, message: 'Bạn chỉ xem được mục tiêu của chính mình.' });
    }
    const goals = (read().goals || [])
      .filter((goal) => goal.userId === target)
      .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
    res.json({ ok: true, fundConfig: GOAL_FUND_CONFIG, goals: goals.map(goalWithFund) });
  });
  api.post('/goals/plan', requireAuth, async (req, res) => {
    const input = req.body || {};
    // userId luôn lấy từ phiên đăng nhập: quỹ tích luỹ và voucher thưởng gắn với
    // đúng một tài khoản, không thể tạo mục tiêu "giả danh" người khác.
    const userId = String(req.user.id);
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
      if (index >= 0) {
        goal.createdAt = next.goals[index].createdAt || now;
        // Lập lại kế hoạch KHÔNG được xoá quỹ đã tích: tiền khách đã bỏ vào và
        // voucher đã thưởng phải đi theo mục tiêu suốt vòng đời của nó.
        goal.fund = next.goals[index].fund || null;
        next.goals[index] = goal;
      } else {
        next.goals.push(goal);
      }
      ensureGoalFund(goal, product.price, now);
      // Số "đã tiết kiệm" khách khai lúc lập kế hoạch được ghi thành khoản đầu
      // tiên của quỹ, để tiến độ trên màn hình và sổ tích luỹ luôn là một.
      const openingBalance = Math.max(0, Number(input.currentSavings) || 0);
      if (index < 0 && openingBalance > 0) {
        goal.fund.deposits.push({ id: `dep-${now}-open`, amount: openingBalance, note: 'Số dư bạn đã tiết kiệm trước đó', at: now });
        ensureGoalFund(goal, product.price, now);
        if (goal.fund.status !== 'saving') ensureGoalRewardVoucher(next, goal, now);
      }
      next.interactions.push({ id: `goal-i-${now}`, userId, productId: product.slug, type: 'goal', value: 1, createdAt: now, source: 'mobile' });
      return next;
    });
    res.json({ ok: true, goal: goalWithFund(goal), fundConfig: GOAL_FUND_CONFIG });
  });

  // ---- Quỹ tích luỹ: nạp / gỡ khoản ghi nhầm -------------------------------
  // Đây là SỔ THEO DÕI, không phải ví: JAPANO không giữ tiền của khách. Mỗi
  // khoản chỉ là một dòng ghi nhận để biết khi nào đã đủ tiền mua món đã chọn.
  api.post('/goals/:id/deposits', requireAuth, (req, res) => {
    try {
      let payload = null;
      update((state) => {
        const goal = findOwnGoal(state, req.params.id, req.user);
        const now = Date.now();
        const result = addDeposit(state, goal, { amount: req.body?.amount, note: req.body?.note }, now);
        goal.updatedAt = now;
        if (result.justCompleted && result.voucher) {
          pushNotification(state, {
            userId: goal.userId,
            title: '🎉 Bạn đã tích đủ quỹ mục tiêu!',
            body: `Quỹ cho "${goal.product?.name || goal.productId}" đã đủ ${Number(goal.fund.target).toLocaleString('vi-VN')}₫. Nhận ngay mã ${result.voucher.code} giảm ${result.voucher.value}% khi mua món này.`,
            type: 'Khuyến mãi',
            action: 'goals',
          });
        }
        payload = { goal: goalWithFund(goal), justCompleted: result.justCompleted, rewardVoucher: result.voucher || null };
        return state;
      });
      res.json({ ok: true, ...payload });
      if (payload.justCompleted && payload.rewardVoucher) {
        void sendPushToUser(payload.goal.userId, {
          title: 'Đã tích đủ quỹ mục tiêu 🎉',
          body: `Nhận mã ${payload.rewardVoucher.code} giảm ${payload.rewardVoucher.value}%.`,
          data: { type: 'goal-reward' },
        });
      }
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không ghi nhận được khoản tích luỹ.' });
    }
  });

  api.delete('/goals/:id/deposits/:depositId', requireAuth, (req, res) => {
    try {
      let payload = null;
      update((state) => {
        const goal = findOwnGoal(state, req.params.id, req.user);
        removeDeposit(state, goal, req.params.depositId);
        goal.updatedAt = Date.now();
        payload = { goal: goalWithFund(goal) };
        return state;
      });
      res.json({ ok: true, ...payload });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không gỡ được khoản tích luỹ.' });
    }
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
    const state = read();
    const productId = String(b.productId || '').trim();
    const product = productId ? state.products.find((item) => item.slug === productId || item.id === productId) : null;
    // Dùng cùng luật hợp nhất với /tryon: estimate đã lưu riêng chỉ là nguồn AI,
    // không được âm thầm trở thành số đo thật ở lần gọi sau.
    const result = adviseSize(mergeBodySignals(measurements, null).profile, product);
    res.json({ ok: true, ...result, recommendedSize: result.size, message: result.advice });
  });

  // Phân tích vóc dáng từ ảnh: chiều cao/cân nặng ước lượng + tỉ lệ cơ thể.
  //
  // Trả về KHOẢNG kèm độ tin cậy, không bao giờ trả một con số tuyệt đối như thể
  // đã đo thật: một ảnh RGB đơn không có vật chuẩn thì không thể suy ra chiều
  // cao chính xác. Khi độ tin cậy dưới ngưỡng, valueCm/valueKg là null và client
  // phải nói thẳng là chưa đủ dữ liệu.
  //
  // Ảnh chỉ tồn tại trong bộ nhớ của tiến trình phân tích — không ghi ra đĩa,
  // không lưu vào state.
  api.post('/stylist/body-analysis', async (req, res) => {
    const b = req.body || {};
    const imageBase64 = String(b.personImageBase64 || b.imageBase64 || '');
    if (!imageBase64) {
      return res.status(400).json({ ok: false, message: 'Thiếu ảnh để phân tích vóc dáng.' });
    }
    if (!bodyAnalysisEnabled()) {
      return res.status(503).json({ ok: false, message: 'Tính năng phân tích vóc dáng đang tắt (JAPANO_BODY_ANALYSIS_ENABLED=0).' });
    }
    const profile = profileForMeasurementMode(b.profile || {}, b.measurementMode);
    try {
      const pipelinePayload = {
        mode: 'body_analysis',
        imageBase64,
        userHeightCm: userProvidedMeasurement(profile, 'height'),
        userWeightKg: userProvidedMeasurement(profile, 'weight'),
        scaleReference: b.scaleReference || null,
        sex: String(b.sex || profile.gender || profile.sex || '').trim() || undefined,
      };
      const timeoutMs = Number(process.env.JAPANO_BODY_ANALYSIS_TIMEOUT_MS || 120000);
      // Worker giữ YOLO + U2Net thường trú; nếu chưa bật thì rơi về spawn như cũ.
      const analysis = (await analyzeViaWorker(pipelinePayload, timeoutMs))
        || await runAccessoryPipeline(pipelinePayload, timeoutMs);
      if (!analysis?.ok) {
        return res.status(503).json({ ok: false, message: analysis?.message || 'Không phân tích được vóc dáng từ ảnh này.' });
      }
      analysis.imageFingerprint = imageFingerprint(imageBase64);
      // Số đo thật (nếu khách đã nhập) luôn thắng ước lượng của AI khi tính size.
      const merged = mergeBodySignals(profile, analysis);
      const productId = String(b.productId || '').trim();
      const state = read();
      const product = productId ? state.products.find((item) => item.slug === productId || item.id === productId) : null;
      const advice = adviseSize(merged.profile, product);
      logger.info(bodyAnalysisLogLine(analysis));
      res.json({
        ok: true,
        ...summarizeBodyAnalysis(analysis),
        recommendedSize: advice.size,
        sizeAdvice: advice.advice,
        sources: merged.sources,
        usedEstimate: merged.usedEstimate,
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message || 'Lỗi phân tích vóc dáng.' });
    }
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
    const referenced = new Set((result.productIds || []).map(String));
    const informationSources = [];
    const sourceUrls = new Set();
    for (const product of s.products || []) {
      if (!referenced.has(String(product.slug || product.id))) continue;
      for (const source of product.informationSources || []) {
        if (!source?.url || sourceUrls.has(source.url)) continue;
        sourceUrls.add(source.url);
        informationSources.push({ title: source.title, url: source.url });
      }
    }
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
      informationSources: informationSources.slice(0, 8),
    });
  });
};
