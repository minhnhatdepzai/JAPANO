// "Khám phá Nhật Bản": đánh giá/bình luận cho từng địa điểm (theo place+prefecture)
// và đề xuất địa điểm chụp ảnh MỚI trong cùng tỉnh — dữ liệu người dùng đóng góp,
// không cần đơn hàng. Mọi nội dung đều qua kiểm duyệt AI dùng chung với đánh giá
// sản phẩm.
//
// Để khuyến khích cộng đồng chia sẻ địa điểm đẹp có thật, mỗi gợi ý được quản
// trị viên duyệt sẽ nhận một voucher giảm tiền cá nhân (lib/communityRewards.js).
const { OLLAMA_URL } = require('../lib/serviceUrls');
const { pushNotification } = require('../lib/notify');
const { SPOT_REWARD_CONFIG, ensureSuggestionReward, issueSpotRewardVoucher } = require('../lib/communityRewards');

module.exports = function registerJapanSpotsRoutes(api, ctx) {
  const { read, update, httpError, moderateReview, REVIEW_MODERATION_MODEL, uploadReviewMedia, requireAdmin, sendPushToUser } = ctx;

  const MODERATION_BLOCK_MESSAGE = 'Nội dung bị chặn vì có dấu hiệu công kích, tục tĩu, phân biệt đối xử, đe doạ hoặc lách từ nhạy cảm. Vui lòng góp ý văn minh.';
  async function moderateUserText(text) {
    const moderation = await moderateReview(String(text || ''), { samples: read().moderationSamples, ollamaUrl: OLLAMA_URL, model: REVIEW_MODERATION_MODEL, timeoutMs: Number(process.env.JAPANO_REVIEW_MODERATION_TIMEOUT_MS || 45000) });
    if (moderation.decision === 'rejected') {
      const normalized = moderation.local?.normalized || String(text || '');
      if (normalized.length >= 3) update((state) => {
        state.moderationSamples = state.moderationSamples || [];
        state.moderationSamples.push({ id: `sample-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, reviewId: null, label: 'rejected', normalizedText: normalized, learnedPhrases: [normalized], source: 'auto-community', updatedAt: Date.now() });
        return state;
      });
    }
    return moderation;
  }
  function moderationSummary(m) {
    return { decision: m.decision, score: m.score, engine: m.engine, reason: m.reason, categories: [...new Set([...(m.local?.categories || []), ...(m.semantic?.categories || [])])], checkedAt: Date.now() };
  }

  function publicSpotReview(review) {
    return { id: review.id, place: review.place, prefecture: review.prefecture, userName: review.userName, rating: review.rating, comment: review.comment, media: review.media || null, createdAt: review.createdAt };
  }

  // Đi qua state store chung để collection MongoDB luôn là nguồn dữ liệu
  // duy nhất. Store tự materialize thành japan_spot_reviews/suggestions để xem.
  api.get('/japan-spots/reviews', async (req, res) => {
    try {
      const place = String(req.query.place || '').trim();
      const prefecture = String(req.query.prefecture || '').trim();
      if (!place || !prefecture) throw httpError(400, 'Thiếu place hoặc prefecture.');
      let reviews = (read().japanSpotReviews || []).filter((item) => item.place === place && item.prefecture === prefecture)
        .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
      reviews = reviews.map(publicSpotReview);
      const average = reviews.length ? Math.round((reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length) * 10) / 10 : 0;
      res.json({ ok: true, reviews, average, count: reviews.length });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tải được đánh giá.' });
    }
  });
  api.post('/japan-spots/reviews', async (req, res) => {
    try {
      const b = req.body || {};
      const place = String(b.place || '').trim();
      const prefecture = String(b.prefecture || '').trim();
      const rating = Number(b.rating);
      const comment = String(b.comment || '').trim();
      const userId = String(b.userId || '');
      if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để đánh giá.');
      if (!place || !prefecture) throw httpError(400, 'Thiếu địa điểm hoặc tỉnh.');
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Số sao phải từ 1 đến 5.');
      if (comment.length < 3 || comment.length > 500) throw httpError(400, 'Bình luận cần từ 3 đến 500 ký tự.');
      const moderation = await moderateUserText(comment);
      if (moderation.decision === 'rejected') throw httpError(422, MODERATION_BLOCK_MESSAGE);
      const media = b.media ? await uploadReviewMedia(b.media, b.mediaKind) : null;
      const review = {
        id: `jspot-review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        place, prefecture, userId,
        userName: String(b.userName || 'Khách JAPANO'),
        rating, comment, media,
        status: moderation.decision,
        moderation: moderationSummary(moderation),
        createdAt: Date.now(),
      };
      update((state) => {
        state.japanSpotReviews = state.japanSpotReviews || [];
        state.japanSpotReviews.push(review);
        return state;
      });
      res.status(201).json({ ok: true, review: publicSpotReview(review) });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không gửi được đánh giá.' });
    }
  });

  // Chương trình thưởng được công khai để app hiển thị đúng mức thưởng thật.
  api.get('/japan-spots/reward-program', (req, res) => res.json({ ok: true, config: SPOT_REWARD_CONFIG }));

  // Trạng thái thưởng chỉ hiện cho chính người đóng góp (kèm userId), người
  // khác chỉ thấy nội dung gợi ý.
  api.get('/japan-spots/suggestions', async (req, res) => {
    try {
      const prefecture = String(req.query.prefecture || '').trim();
      const viewerId = String(req.query.userId || '');
      if (!prefecture) throw httpError(400, 'Thiếu prefecture.');
      let suggestions = (read().japanSpotSuggestions || []).filter((item) => item.prefecture === prefecture)
        .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
      res.json({
        ok: true,
        rewardConfig: SPOT_REWARD_CONFIG,
        suggestions: suggestions.map((item) => ({
          id: item.id,
          prefecture: item.prefecture,
          userName: item.userName,
          suggestion: item.suggestion,
          createdAt: item.createdAt,
          mine: Boolean(viewerId) && String(item.userId) === viewerId,
          reward: viewerId && String(item.userId) === viewerId ? (item.reward || { status: 'pending' }) : null,
        })),
      });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tải được gợi ý.' });
    }
  });
  api.post('/japan-spots/suggestions', async (req, res) => {
    try {
      const b = req.body || {};
      const prefecture = String(b.prefecture || '').trim();
      const suggestion = String(b.suggestion || '').trim();
      const userId = String(b.userId || '');
      if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để gửi gợi ý.');
      if (!prefecture) throw httpError(400, 'Thiếu tỉnh.');
      if (suggestion.length < 3 || suggestion.length > 500) throw httpError(400, 'Gợi ý cần từ 3 đến 500 ký tự.');
      const moderation = await moderateUserText(suggestion);
      if (moderation.decision === 'rejected') throw httpError(422, MODERATION_BLOCK_MESSAGE);
      const entry = {
        id: `jspot-suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prefecture, userId,
        userName: String(b.userName || 'Khách JAPANO'),
        suggestion,
        place: String(b.place || '').trim().slice(0, 120),
        status: moderation.decision,
        moderation: moderationSummary(moderation),
        reward: { status: 'pending' },
        createdAt: Date.now(),
      };
      update((state) => {
        state.japanSpotSuggestions = state.japanSpotSuggestions || [];
        state.japanSpotSuggestions.push(entry);
        pushNotification(state, {
          userId,
          title: 'Đã nhận đóng góp địa điểm của bạn',
          body: `Cảm ơn bạn đã chia sẻ một địa điểm ở ${prefecture}. Nếu được duyệt, bạn sẽ nhận ${SPOT_REWARD_CONFIG.label}.`,
          type: 'Hệ thống',
          action: 'explore-japan',
        });
        return state;
      });
      res.status(201).json({ ok: true, suggestion: entry, rewardConfig: SPOT_REWARD_CONFIG });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không gửi được gợi ý.' });
    }
  });

  // ---- Admin: duyệt/xoá đóng góp "Khám phá Nhật Bản" -------------------------
  // Dữ liệu luôn đi qua state store; MongoDB là persistence layer của store.
  async function loadSpotCollection(name, jsonKey) {
    return [...(read()[jsonKey] || [])].sort((l, r) => Number(r.createdAt || 0) - Number(l.createdAt || 0));
  }
  async function deleteSpotDoc(name, jsonKey, id) {
    let removed = false;
    update((state) => { const before = (state[jsonKey] || []).length; state[jsonKey] = (state[jsonKey] || []).filter((x) => x.id !== id); removed = state[jsonKey].length < before; return state; });
    return removed;
  }

  // Hàng chờ kiểm duyệt nội dung cộng đồng — chỉ quản trị viên.
  api.get('/japan-spots/admin', requireAdmin, async (req, res) => {
    try {
      const [reviews, suggestions] = await Promise.all([
        loadSpotCollection('japanSpotReviews', 'japanSpotReviews'),
        loadSpotCollection('japanSpotSuggestions', 'japanSpotSuggestions'),
      ]);
      res.json({
        ok: true,
        rewardConfig: SPOT_REWARD_CONFIG,
        reviews: reviews.map((r) => ({ id: r.id, place: r.place, prefecture: r.prefecture, userName: r.userName, userId: r.userId, rating: r.rating, comment: r.comment, media: r.media || null, status: r.status || 'approved', createdAt: r.createdAt })),
        suggestions: suggestions.map((s) => ({ id: s.id, prefecture: s.prefecture, place: s.place || '', userName: s.userName, userId: s.userId, suggestion: s.suggestion, status: s.status || 'approved', reward: s.reward || { status: 'pending' }, createdAt: s.createdAt })),
      });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tải được dữ liệu Khám phá Nhật Bản.' });
    }
  });

  // ---- Admin: duyệt đóng góp địa điểm mới và trả thưởng ----------------------
  // Duyệt = xác nhận địa điểm có thật, mô tả dùng được để bổ sung vào danh sách.
  // Voucher chỉ phát đúng một lần cho mỗi gợi ý (reward.status khoá lại).
  api.post('/japan-spots/suggestions/:id/approve', requireAdmin, (req, res) => {
    try {
      let payload = null;
      update((state) => {
        const entry = (state.japanSpotSuggestions || []).find((item) => item.id === String(req.params.id));
        if (!entry) throw httpError(404, 'Không tìm thấy gợi ý.');
        const reward = ensureSuggestionReward(entry);
        if (reward.status === 'approved') throw httpError(409, 'Gợi ý này đã được duyệt và trả thưởng.');
        if (!entry.userId || entry.userId === 'guest') throw httpError(400, 'Gợi ý không gắn với tài khoản nào nên không trả thưởng được.');
        const now = Date.now();
        const voucher = issueSpotRewardVoucher(state, entry, {
          amount: req.body?.amount,
          minOrder: req.body?.minOrder,
          validDays: req.body?.validDays,
          issuedBy: req.user?.id,
        }, now);
        entry.status = 'approved';
        entry.reward = {
          status: 'approved',
          voucherCode: voucher.code,
          amount: voucher.value,
          minOrder: voucher.min,
          expiry: voucher.expiry,
          note: String(req.body?.note || '').trim().slice(0, 300),
          approvedBy: req.user?.id || 'admin',
          approvedAt: now,
        };
        pushNotification(state, {
          userId: entry.userId,
          title: '🗾 Đóng góp địa điểm của bạn đã được duyệt!',
          body: `Cảm ơn bạn đã chia sẻ địa điểm ở ${entry.prefecture}. Nhận ngay mã ${voucher.code} — giảm ${Number(voucher.value).toLocaleString('vi-VN')}₫ cho đơn từ ${Number(voucher.min).toLocaleString('vi-VN')}₫.`,
          type: 'Khuyến mãi',
          action: 'vouchers',
        });
        payload = { suggestion: entry, voucher };
        return state;
      });
      res.json({ ok: true, ...payload });
      void sendPushToUser(payload.suggestion.userId, {
        title: 'Đóng góp địa điểm đã được duyệt 🎁',
        body: `Bạn nhận mã ${payload.voucher.code} giảm ${Number(payload.voucher.value).toLocaleString('vi-VN')}₫.`,
        data: { type: 'spot-reward' },
      });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không duyệt được gợi ý.' });
    }
  });

  api.post('/japan-spots/suggestions/:id/reject', requireAdmin, (req, res) => {
    try {
      let payload = null;
      update((state) => {
        const entry = (state.japanSpotSuggestions || []).find((item) => item.id === String(req.params.id));
        if (!entry) throw httpError(404, 'Không tìm thấy gợi ý.');
        const reward = ensureSuggestionReward(entry);
        if (reward.status === 'approved') throw httpError(409, 'Gợi ý đã được trả thưởng, không thể từ chối.');
        const note = String(req.body?.note || '').trim().slice(0, 300);
        entry.reward = { status: 'rejected', note, reviewedBy: req.user?.id || 'admin', reviewedAt: Date.now() };
        if (entry.userId && entry.userId !== 'guest') {
          pushNotification(state, {
            userId: entry.userId,
            title: 'Đóng góp địa điểm chưa được duyệt',
            body: note || `Gợi ý ở ${entry.prefecture} chưa đủ thông tin để bổ sung vào danh sách. Bạn có thể gửi lại với mô tả chi tiết hơn nhé.`,
            type: 'Hệ thống',
            action: 'explore-japan',
          });
        }
        payload = { suggestion: entry };
        return state;
      });
      res.json({ ok: true, ...payload });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không cập nhật được gợi ý.' });
    }
  });
  api.delete('/japan-spots/reviews/:id', requireAdmin, async (req, res) => {
    const ok = await deleteSpotDoc('japanSpotReviews', 'japanSpotReviews', String(req.params.id));
    res.status(ok ? 200 : 404).json({ ok, message: ok ? 'Đã xoá đánh giá.' : 'Không tìm thấy đánh giá.' });
  });
  api.delete('/japan-spots/suggestions/:id', requireAdmin, async (req, res) => {
    const ok = await deleteSpotDoc('japanSpotSuggestions', 'japanSpotSuggestions', String(req.params.id));
    res.status(ok ? 200 : 404).json({ ok, message: ok ? 'Đã xoá gợi ý.' : 'Không tìm thấy gợi ý.' });
  });

  // ---- Admin: công cụ thử bộ lọc kiểm duyệt AI (không lưu, không học) ---------
  // Công cụ thử bộ kiểm duyệt: gọi thẳng mô hình ngôn ngữ nên vừa tốn tài nguyên
  // vừa là công cụ nội bộ.
  api.post('/moderation/test', requireAdmin, async (req, res) => {
    try {
      const text = String(req.body?.text || '');
      if (!text.trim()) throw httpError(400, 'Nhập nội dung cần kiểm tra.');
      const moderation = await moderateReview(text, { samples: read().moderationSamples, ollamaUrl: OLLAMA_URL, model: REVIEW_MODERATION_MODEL, timeoutMs: Number(process.env.JAPANO_REVIEW_MODERATION_TIMEOUT_MS || 20000) });
      res.json({
        ok: true,
        decision: moderation.decision,
        score: moderation.score,
        engine: moderation.engine,
        reason: moderation.reason,
        normalized: moderation.local?.normalized || '',
        categories: [...new Set([...(moderation.local?.categories || []), ...(moderation.semantic?.categories || [])])],
        matches: (moderation.local?.matches || []).map((m) => ({ category: m.category, phrase: m.phrase, severity: m.severity })),
        semantic: moderation.semantic ? { available: moderation.semantic.available, harmful: moderation.semantic.harmful, confidence: moderation.semantic.confidence, model: moderation.semantic.model } : null,
      });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không kiểm tra được.' });
    }
  });
};
