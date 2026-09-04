// Đánh giá sản phẩm đã xác minh mua hàng (verified purchase): xem/gửi đánh
// giá, bày tỏ hữu ích/không, và kiểm duyệt (admin duyệt/chặn thủ công).
const { successfulLiveOrder } = require('../lib/orderStatus');
const { OLLAMA_URL } = require('../lib/serviceUrls');

function reviewPurchaseOrders(state, userId, productId) {
  return (state.orders || []).filter((order) => String(order.userId || order.customer?.id || '') === String(userId)
    && String(order.status || '').toLowerCase() === 'completed'
    && successfulLiveOrder(order)
    && (order.items || []).some((item) => String(item.slug || item.productId) === String(productId)))
    .sort((left, right) => Number(left.createdAt || left.completedAt || 0) - Number(right.createdAt || right.completedAt || 0));
}

// Mỗi đơn mua đã hoàn tất tạo một "suất" đánh giá cho sản phẩm. Đánh giá cũ
// không có orderId (dữ liệu trước khi có verified purchase) được gán vào lần
// mua cũ nhất chỉ trong phép tính này, nhờ đó một lần mua lại mới vẫn mở được
// nút đánh giá mà không cho review cũ tạo vô hạn suất trống.
function reviewPurchaseSlots(state, userId, productId) {
  const orders = reviewPurchaseOrders(state, userId, productId);
  const orderById = new Map(orders.map((order) => [String(order.id), order]));
  const reviews = (state.reviews || []).filter((review) => String(review.userId) === String(userId)
    && String(review.productId) === String(productId));
  const reviewedOrderIds = new Set();
  let legacyReviewCount = 0;

  for (const review of reviews) {
    const orderId = String(review.orderId || '');
    if (orderId && orderById.has(orderId)) reviewedOrderIds.add(orderId);
    else legacyReviewCount += 1;
  }
  for (const order of orders) {
    if (!legacyReviewCount) break;
    const orderId = String(order.id);
    if (reviewedOrderIds.has(orderId)) continue;
    reviewedOrderIds.add(orderId);
    legacyReviewCount -= 1;
  }

  return {
    orders,
    reviews,
    reviewedOrderIds,
    availableOrders: orders.filter((order) => !reviewedOrderIds.has(String(order.id))),
  };
}

function registerReviewRoutes(api, ctx) {
  const { read, update, httpError, moderateReview, REVIEW_MODERATION_MODEL, uploadReviewMedia, requireAdmin } = ctx;

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
    const slots = userId ? reviewPurchaseSlots(state, userId, product.slug) : { orders: [], reviews: [], reviewedOrderIds: new Set(), availableOrders: [] };
    const average = reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length * 10) / 10 : 0;
    res.json({
      ok: true,
      productId: product.slug,
      summary: { average, count: reviews.length, distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: reviews.filter((review) => review.rating === rating).length })) },
      eligibility: {
        canReview: Boolean(userId && slots.availableOrders.length),
        purchased: Boolean(slots.orders.length),
        alreadyReviewed: Boolean(slots.reviews.length),
        orderIds: slots.orders.map((order) => order.id),
        eligibleOrderIds: slots.availableOrders.map((order) => order.id),
        reviewedOrderIds: slots.orders.filter((order) => slots.reviewedOrderIds.has(String(order.id))).map((order) => order.id),
        reviewCount: slots.reviews.length,
      },
      reviews,
    });
  });

  api.post('/products/:slug/reviews', async (req, res) => {
    try {
      const snapshot = read(), product = snapshot.products.find((item) => item.slug === String(req.params.slug) || item.id === String(req.params.slug));
      if (!product) throw httpError(404, 'Không tìm thấy sản phẩm.');
      const userId = String(req.body?.userId || ''), rating = Number(req.body?.rating), comment = String(req.body?.comment || '').trim();
      const requestedOrderId = String(req.body?.orderId || '');
      if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để đánh giá.');
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Số sao phải từ 1 đến 5.');
      if (comment.length < 3 || comment.length > 2000) throw httpError(400, 'Bình luận cần từ 3 đến 2.000 ký tự.');
      const slots = reviewPurchaseSlots(snapshot, userId, product.slug);
      if (!slots.orders.length) throw httpError(403, 'Chỉ khách đã mua và nhận sản phẩm mới được đánh giá.');
      if (requestedOrderId && !slots.orders.some((order) => String(order.id) === requestedOrderId)) {
        throw httpError(403, 'Đơn hàng này chưa đủ điều kiện đánh giá sản phẩm.');
      }
      const availableOrder = requestedOrderId
        ? slots.availableOrders.find((order) => String(order.id) === requestedOrderId)
        : slots.availableOrders[slots.availableOrders.length - 1];
      if (!availableOrder) throw httpError(409, 'Lần mua này đã được đánh giá. Khi mua lại và nhận hàng ở đơn khác, bạn vẫn có thể đánh giá tiếp.');
      const moderation = await moderateReview(comment, { samples: snapshot.moderationSamples, ollamaUrl: OLLAMA_URL, model: REVIEW_MODERATION_MODEL, timeoutMs: Number(process.env.JAPANO_REVIEW_MODERATION_TIMEOUT_MS || 45000) });
      const media = req.body?.media ? await uploadReviewMedia(req.body.media, req.body?.mediaKind) : null;
      let review;
      update((state) => {
        const currentSlots = reviewPurchaseSlots(state, userId, product.slug);
        const order = requestedOrderId
          ? currentSlots.availableOrders.find((item) => String(item.id) === requestedOrderId)
          : currentSlots.availableOrders[currentSlots.availableOrders.length - 1];
        if (!order) throw httpError(409, 'Lần mua này đã được đánh giá. Khi mua lại và nhận hàng ở đơn khác, bạn vẫn có thể đánh giá tiếp.');
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

  // Danh sách kiểm duyệt để lộ cả đánh giá đang chờ/bị từ chối và dữ liệu
  // chấm điểm nội bộ, nên chỉ quản trị viên mới được đọc.
  api.get('/reviews/admin', requireAdmin, (req, res) => {
    const state = read();
    const items = [...(state.reviews || [])].sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0)).map((review) => ({
      ...review,
      helpful: state.reviewReactions.filter((reaction) => reaction.reviewId === review.id && reaction.value === 'helpful').length,
      notHelpful: state.reviewReactions.filter((reaction) => reaction.reviewId === review.id && reaction.value === 'not_helpful').length,
    }));
    res.json({ ok: true, model: { name: REVIEW_MODERATION_MODEL, semantic: true, antiEvasion: true, learnedRejectedSamples: state.moderationSamples.length }, items });
  });

  // Duyệt/ẩn đánh giá là hành vi kiểm duyệt nội dung công khai — bắt buộc quản trị viên.
  api.patch('/reviews/:id/moderation', requireAdmin, (req, res) => {
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
}

module.exports = registerReviewRoutes;
module.exports.reviewPurchaseOrders = reviewPurchaseOrders;
module.exports.reviewPurchaseSlots = reviewPurchaseSlots;
