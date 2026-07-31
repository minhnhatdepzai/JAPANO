// "Khám phá Nhật Bản": đánh giá/bình luận cho từng địa điểm (theo place+prefecture)
// và đề xuất địa điểm khác trong cùng tỉnh — dữ liệu người dùng đóng góp, không
// cần đơn hàng. Mọi nội dung đều qua kiểm duyệt AI dùng chung với đánh giá sản phẩm.
const { OLLAMA_URL } = require('../lib/serviceUrls');

module.exports = function registerJapanSpotsRoutes(api, ctx) {
  const { read, update, httpError, moderateReview, REVIEW_MODERATION_MODEL, uploadReviewMedia, mongoEnabled, getDb, requireAdmin } = ctx;

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

  // Cả 4 endpoint dưới đây dùng MongoDB làm nơi lưu chính khi đã cấu hình
  // MONGODB_URI (collections "japanSpotReviews"/"japanSpotSuggestions" trong DB
  // MONGODB_DB); nếu chưa cấu hình Mongo thì lùi về lưu trong db.json như cũ để
  // tính năng vẫn hoạt động được.
  api.get('/japan-spots/reviews', async (req, res) => {
    try {
      const place = String(req.query.place || '').trim();
      const prefecture = String(req.query.prefecture || '').trim();
      if (!place || !prefecture) throw httpError(400, 'Thiếu place hoặc prefecture.');
      let reviews;
      if (mongoEnabled()) {
        const db = await getDb();
        reviews = await db.collection('japanSpotReviews').find({ place, prefecture }).sort({ createdAt: -1 }).toArray();
      } else {
        reviews = (read().japanSpotReviews || []).filter((item) => item.place === place && item.prefecture === prefecture)
          .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
      }
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
      if (mongoEnabled()) {
        const db = await getDb();
        await db.collection('japanSpotReviews').insertOne(review);
      } else {
        update((state) => {
          state.japanSpotReviews = state.japanSpotReviews || [];
          state.japanSpotReviews.push(review);
          return state;
        });
      }
      res.status(201).json({ ok: true, review: publicSpotReview(review) });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không gửi được đánh giá.' });
    }
  });

  api.get('/japan-spots/suggestions', async (req, res) => {
    try {
      const prefecture = String(req.query.prefecture || '').trim();
      if (!prefecture) throw httpError(400, 'Thiếu prefecture.');
      let suggestions;
      if (mongoEnabled()) {
        const db = await getDb();
        suggestions = await db.collection('japanSpotSuggestions').find({ prefecture }).sort({ createdAt: -1 }).toArray();
      } else {
        suggestions = (read().japanSpotSuggestions || []).filter((item) => item.prefecture === prefecture)
          .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
      }
      res.json({ ok: true, suggestions: suggestions.map((item) => ({ id: item.id, prefecture: item.prefecture, userName: item.userName, suggestion: item.suggestion, createdAt: item.createdAt })) });
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
        status: moderation.decision,
        moderation: moderationSummary(moderation),
        createdAt: Date.now(),
      };
      if (mongoEnabled()) {
        const db = await getDb();
        await db.collection('japanSpotSuggestions').insertOne(entry);
      } else {
        update((state) => {
          state.japanSpotSuggestions = state.japanSpotSuggestions || [];
          state.japanSpotSuggestions.push(entry);
          return state;
        });
      }
      res.status(201).json({ ok: true, suggestion: entry });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không gửi được gợi ý.' });
    }
  });

  // ---- Admin: duyệt/xoá đóng góp "Khám phá Nhật Bản" -------------------------
  // Dữ liệu có thể nằm ở Mongo (khi bật) nên đọc/xoá đúng nguồn, không qua /state.
  async function loadSpotCollection(name, jsonKey) {
    if (mongoEnabled()) {
      try { const db = await getDb(); return await db.collection(name).find({}).sort({ createdAt: -1 }).toArray(); }
      catch { /* fallback JSON */ }
    }
    return [...(read()[jsonKey] || [])].sort((l, r) => Number(r.createdAt || 0) - Number(l.createdAt || 0));
  }
  async function deleteSpotDoc(name, jsonKey, id) {
    if (mongoEnabled()) {
      try { const db = await getDb(); const r = await db.collection(name).deleteOne({ id }); if (r.deletedCount) return true; } catch { /* fallback */ }
    }
    let removed = false;
    update((state) => { const before = (state[jsonKey] || []).length; state[jsonKey] = (state[jsonKey] || []).filter((x) => x.id !== id); removed = state[jsonKey].length < before; return state; });
    return removed;
  }

  api.get('/japan-spots/admin', async (req, res) => {
    try {
      const [reviews, suggestions] = await Promise.all([
        loadSpotCollection('japanSpotReviews', 'japanSpotReviews'),
        loadSpotCollection('japanSpotSuggestions', 'japanSpotSuggestions'),
      ]);
      res.json({
        ok: true,
        reviews: reviews.map((r) => ({ id: r.id, place: r.place, prefecture: r.prefecture, userName: r.userName, userId: r.userId, rating: r.rating, comment: r.comment, media: r.media || null, status: r.status || 'approved', createdAt: r.createdAt })),
        suggestions: suggestions.map((s) => ({ id: s.id, prefecture: s.prefecture, userName: s.userName, userId: s.userId, suggestion: s.suggestion, status: s.status || 'approved', createdAt: s.createdAt })),
      });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không tải được dữ liệu Khám phá Nhật Bản.' });
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
  api.post('/moderation/test', async (req, res) => {
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
