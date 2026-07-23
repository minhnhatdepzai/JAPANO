// Đánh giá sản phẩm đã xác minh mua hàng (verified purchase): xem/gửi đánh
// giá, bày tỏ hữu ích/không, và kiểm duyệt (admin duyệt/chặn thủ công).
const { successfulLiveOrder } = require('../lib/orderStatus');
const { OLLAMA_URL } = require('../lib/serviceUrls');

module.exports = function registerReviewRoutes(api, ctx) {
  const { read, update, httpError, moderateReview, REVIEW_MODERATION_MODEL, uploadReviewMedia } = ctx;

  function reviewPurchaseOrders(state, userId, productId) {
    return (state.orders || []).filter((order) => String(order.userId || order.customer?.id || '') === String(userId)
      && String(order.status || '').toLowerCase() === 'completed'
      && successfulLiveOrder(order)
      && (order.items || []).some((item) => String(item.slug || item.productId) === String(productId)));
  }

  function publicReview(state, review, userId = '') {
    const reactions = (state.reviewReactions || []).filter((reaction) => reaction.reviewId === review.id);
    return {
      id: review.id,
      productId: review.productId,
      userName: review.userName,
      rating: review.rating,
      comment: review.comment,
      media: review.media || null,
      verifiedPurchase: true,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      helpful: reactions.filter((reaction) => reaction.value === 'helpful').length,
      notHelpful: reactions.filter((reaction) => reaction.value === 'not_helpful').length,
      myReaction: reactions.find((reaction) => reaction.userId === String(userId))?.value || null,
    };
  }

  api.get('/products/:slug/reviews', (req, res) => {
    const state = read(), product = state.products.find((item) => item.slug === String(req.params.slug) || item.id === String(req.params.slug));
    if (!product) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
    const userId = String(req.query.userId || '');
    const reviews = (state.reviews || []).filter((review) => review.productId === product.slug && review.status === 'approved')
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
      .map((review) => publicReview(state, review, userId));
    const purchaseOrders = userId ? reviewPurchaseOrders(state, userId, product.slug) : [];
    const existing = userId ? (state.reviews || []).find((review) => review.userId === userId && review.productId === product.slug) : null;
    const average = reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length * 10) / 10 : 0;
    res.json({
      ok: true,
      productId: product.slug,
      summary: { average, count: reviews.length, distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: reviews.filter((review) => review.rating === rating).length })) },
      eligibility: { canReview: Boolean(userId && purchaseOrders.length && !existing), purchased: Boolean(purchaseOrders.length), alreadyReviewed: Boolean(existing), orderIds: purchaseOrders.map((order) => order.id) },
      reviews,
    });
  });

  api.post('/products/:slug/reviews', async (req, res) => {
    try {
      const snapshot = read(), product = snapshot.products.find((item) => item.slug === String(req.params.slug) || item.id === String(req.params.slug));
      if (!product) throw httpError(404, 'Không tìm thấy sản phẩm.');
      const userId = String(req.body?.userId || ''), rating = Number(req.body?.rating), comment = String(req.body?.comment || '').trim();
      if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để đánh giá.');
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Số sao phải từ 1 đến 5.');
      if (comment.length < 3 || comment.length > 2000) throw httpError(400, 'Bình luận cần từ 3 đến 2.000 ký tự.');
      const orders = reviewPurchaseOrders(snapshot, userId, product.slug);
      if (!orders.length) throw httpError(403, 'Chỉ khách đã mua và nhận sản phẩm mới được đánh giá.');
      if ((snapshot.reviews || []).some((review) => review.userId === userId && review.productId === product.slug)) throw httpError(409, 'Bạn đã đánh giá sản phẩm này rồi. Mỗi sản phẩm chỉ được đánh giá một lần.');
      const moderation = await moderateReview(comment, { samples: snapshot.moderationSamples, ollamaUrl: OLLAMA_URL, model: REVIEW_MODERATION_MODEL, timeoutMs: Number(process.env.JAPANO_REVIEW_MODERATION_TIMEOUT_MS || 45000) });
      const media = req.body?.media ? await uploadReviewMedia(req.body.media, req.body?.mediaKind) : null;
      let review;
      update((state) => {
        if (state.reviews.some((item) => item.userId === userId && item.productId === product.slug)) throw httpError(409, 'Bạn đã đánh giá sản phẩm này rồi.');
        const order = orders.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))[0];
        review = {
          id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          productId: product.slug,
          userId,
          userName: String(order.customer?.name || req.body?.userName || 'Khách đã mua'),
          orderId: order.id,
          orderCode: order.code,
          rating,
          comment,
          media,
          status: moderation.decision,
          moderation: { ...moderation, local: { ...moderation.local, compact: undefined }, checkedAt: Date.now() },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        state.reviews.push(review);
        if (review.status === 'rejected') state.moderationSamples.push({ id: `sample-${Date.now()}`, reviewId: review.id, label: 'rejected', normalizedText: moderation.local?.normalized || comment, learnedPhrases: [moderation.local?.normalized || comment], source: 'automatic', updatedAt: Date.now() });
        return state;
      });
      const blocked = review.status === 'rejected';
      res.status(blocked ? 422 : 201).json({ ok: !blocked, review: blocked ? null : publicReview(read(), review, userId), status: review.status, message: blocked ? 'Bình luận bị chặn vì có dấu hiệu công kích, phân biệt hoặc lách từ nhạy cảm.' : review.status === 'pending' ? 'Đánh giá đang chờ quản trị viên kiểm tra.' : 'Đánh giá đã được đăng.' });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không gửi được đánh giá.' });
    }
  });

  api.post('/reviews/:id/reaction', (req, res) => {
    try {
      const userId = String(req.body?.userId || ''), value = String(req.body?.value || '');
      if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để bày tỏ ý kiến.');
      if (!['helpful', 'not_helpful'].includes(value)) throw httpError(400, 'Lựa chọn không hợp lệ.');
      let output;
      update((state) => {
        const review = state.reviews.find((item) => item.id === String(req.params.id) && item.status === 'approved');
        if (!review) throw httpError(404, 'Không tìm thấy đánh giá.');
        const index = state.reviewReactions.findIndex((reaction) => reaction.reviewId === review.id && reaction.userId === userId);
        if (index >= 0 && state.reviewReactions[index].value === value) state.reviewReactions.splice(index, 1);
        else {
          const reaction = { id: `reaction-${Date.now()}`, reviewId: review.id, userId, value, updatedAt: Date.now() };
          if (index >= 0) state.reviewReactions[index] = reaction; else state.reviewReactions.push(reaction);
        }
        output = publicReview(state, review, userId);
        return state;
      });
      res.json({ ok: true, review: output });
    } catch (error) {
      res.status(error.status || 400).json({ ok: false, message: error.message || 'Không lưu được lựa chọn.' });
    }
  });

  api.get('/reviews/admin', (req, res) => {
    const state = read();
    const items = [...(state.reviews || [])].sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0)).map((review) => ({
      ...review,
      helpful: state.reviewReactions.filter((reaction) => reaction.reviewId === review.id && reaction.value === 'helpful').length,
      notHelpful: state.reviewReactions.filter((reaction) => reaction.reviewId === review.id && reaction.value === 'not_helpful').length,
    }));
    res.json({ ok: true, model: { name: REVIEW_MODERATION_MODEL, semantic: true, antiEvasion: true, learnedRejectedSamples: state.moderationSamples.length }, items });
  });

  api.patch('/reviews/:id/moderation', (req, res) => {
    try {
      const status = String(req.body?.status || '');
      if (!['approved', 'rejected', 'pending'].includes(status)) throw httpError(400, 'Trạng thái kiểm duyệt không hợp lệ.');
      let review;
      update((state) => {
        review = state.reviews.find((item) => item.id === String(req.params.id));
        if (!review) throw httpError(404, 'Không tìm thấy đánh giá.');
        review.status = status;
        review.adminNote = String(req.body?.adminNote || '').slice(0, 500);
        review.moderatedAt = Date.now();
        review.updatedAt = Date.now();
        if (status === 'rejected') {
          const normalizedText = review.moderation?.local?.normalized || String(review.comment || '');
          const existing = state.moderationSamples.find((sample) => sample.reviewId === review.id);
          const sample = { id: existing?.id || `sample-${Date.now()}`, reviewId: review.id, label: 'rejected', normalizedText, learnedPhrases: [normalizedText], updatedAt: Date.now() };
          if (existing) Object.assign(existing, sample); else state.moderationSamples.push(sample);
        }
        return state;
      });
      res.json({ ok: true, review });
    } catch (error) {
      res.status(error.status || 400).json({ ok: false, message: error.message || 'Không cập nhật được kiểm duyệt.' });
    }
  });
};
