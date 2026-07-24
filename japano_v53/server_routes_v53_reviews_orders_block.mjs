// ================= JAPANO V53 PRODUCT REVIEWS + ORDER QUICK ACTIONS START =================

const JAPANO_V53_FAKE_REVIEW_TEMPLATES = [
  { name: 'Minh Anh', rating: 5, comment: 'Mình mua xong mặc lên rất ổn, vải mềm, form đúng mô tả. Shop đóng gói kỹ.', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80' },
  { name: 'Gia Hân', rating: 5, comment: 'Sản phẩm giống hình, màu lên đẹp. Size tư vấn khá chuẩn, mặc chụp ảnh rất xinh.', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80' },
  { name: 'Thanh Trúc', rating: 4, comment: 'Chất lượng ổn trong tầm giá. Giao hàng nhanh, đường may gọn.', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80' },
  { name: 'Ngọc Mai', rating: 5, comment: 'Mình thích nhất là form mặc lên nhìn gọn người. Sẽ mua thêm màu khác.', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80' },
  { name: 'Khánh Linh', rating: 4, comment: 'Đồ đẹp, giá hợp lý. Nếu shop thêm nhiều màu hơn thì tốt.', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80' },
];

function v53Text(value) { return String(value || '').trim(); }
function v53Lower(value) { return v53Text(value).toLowerCase(); }
function v53MoneyNumber(value) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function v53IsMongoId(value) { return /^[a-f\d]{24}$/i.test(String(value || '')); }

function v53IsSuccessfulOrder(order = {}) {
  const status = v53Lower(order.status || order.orderStatus);
  const paymentStatus = v53Lower(order.paymentStatus);
  return [
    'paid',
    'success',
    'successful',
    'confirmed',
    'completed',
    'complete',
    'delivered',
    'shipping',
    'shipped',
    'fulfilled',
    'done',
  ].includes(status) || ['paid', 'success', 'successful'].includes(paymentStatus);
}

function v53IsCancelledOrder(order = {}) {
  const status = v53Lower(order.status || order.orderStatus);
  return ['cancelled', 'canceled', 'cancel', 'failed', 'refunded'].includes(status);
}

function v53FakeReviewsForProduct(productId = '') {
  const key = v53Text(productId) || 'japano-product';
  let seed = 0;
  for (const ch of key) seed = (seed + ch.charCodeAt(0)) % 9973;
  return JAPANO_V53_FAKE_REVIEW_TEMPLATES.map((item, index) => ({
    id: `fake-${key}-${index}`,
    _id: `fake-${key}-${index}`,
    productId: key,
    userId: `fake-user-${index}`,
    userName: item.name,
    userAvatar: item.image,
    rating: item.rating,
    comment: item.comment,
    verifiedPurchase: true,
    isFake: true,
    reviewDate: new Date(Date.now() - (index + 2 + (seed % 5)) * 86400000).toISOString(),
    createdAt: new Date(Date.now() - (index + 2 + (seed % 5)) * 86400000).toISOString(),
  }));
}

async function v53GetOrderByAnyId(orderId) {
  if (!orderId) return null;
  if (v53IsMongoId(orderId)) return Order.findById(orderId).lean().catch(() => null);
  return Order.findOne({ $or: [{ idempotencyKey: orderId }, { transactionId: orderId }, { stripePaymentIntentId: orderId }] }).lean().catch(() => null);
}

async function v53FindReviewableOrderItem({ userId, productId, orderId = '', orderItemId = '' }) {
  const cleanUserId = v53Text(userId);
  const cleanProductId = v53Text(productId);
  if (!cleanUserId || !cleanProductId) return null;

  let items = [];
  if (orderItemId && v53IsMongoId(orderItemId)) {
    const row = await OrderItem.findById(orderItemId).lean().catch(() => null);
    if (row) items = [row];
  } else if (orderId && v53IsMongoId(orderId)) {
    items = await OrderItem.find({ orderId, productId: cleanProductId }).sort({ createdAt: -1 }).lean().catch(() => []);
  } else {
    items = await OrderItem.find({ productId: cleanProductId }).sort({ createdAt: -1 }).limit(80).lean().catch(() => []);
  }

  for (const item of items) {
    const order = await Order.findById(item.orderId).lean().catch(() => null);
    if (!order) continue;
    if (String(order.userId) !== String(cleanUserId)) continue;
    if (!v53IsSuccessfulOrder(order)) continue;
    if (v53IsCancelledOrder(order)) continue;
    const existed = await Review.collection.findOne({
      userId: cleanUserId,
      productId: cleanProductId,
      orderItemId: String(item._id),
    }).catch(() => null);
    if (existed) continue;
    return { item, order };
  }
  return null;
}

async function v53CanUserReviewProduct(userId, productId) {
  const found = await v53FindReviewableOrderItem({ userId, productId });
  if (!found) return { canReview: false, reason: 'Bạn chỉ được đánh giá sau khi đơn hàng mua sản phẩm này đã thanh toán/hoàn tất thành công.' };
  return {
    canReview: true,
    orderId: String(found.order._id),
    orderItemId: String(found.item._id),
    reason: 'Đủ điều kiện đánh giá vì đã mua hàng thành công.',
  };
}

async function v53PublicReviews(productId, userId = '') {
  const cleanProductId = v53Text(productId);
  const rows = await Review.collection
    .find({ productId: cleanProductId })
    .sort({ createdAt: -1, reviewDate: -1 })
    .limit(100)
    .toArray()
    .catch(() => []);

  const real = rows.map((r) => ({
    id: String(r._id),
    _id: String(r._id),
    productId: r.productId || cleanProductId,
    userId: r.userId || '',
    userName: r.userName || r.customerName || 'Khách JAPANO',
    userAvatar: r.userAvatar || '',
    rating: Math.max(1, Math.min(5, Number(r.rating || 5))),
    comment: r.comment || '',
    verifiedPurchase: r.verifiedPurchase !== false,
    isFake: false,
    orderId: r.orderId || '',
    orderItemId: r.orderItemId || '',
    reviewDate: r.reviewDate || r.createdAt || null,
    createdAt: r.createdAt || r.reviewDate || null,
  }));

  const fake = v53FakeReviewsForProduct(cleanProductId);
  const reviews = [...real, ...fake].slice(0, 60);
  const count = reviews.length;
  const averageRating = count ? Math.round((reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count) * 10) / 10 : 0;
  const eligibility = userId ? await v53CanUserReviewProduct(userId, cleanProductId) : { canReview: false, reason: 'Đăng nhập và mua hàng thành công để đánh giá.' };
  return { ok: true, productId: cleanProductId, averageRating, count, reviews, eligibility };
}

app.get('/api/products/:productId/reviews', async (req, res) => {
  try {
    res.json(await v53PublicReviews(req.params.productId, req.query.userId || ''));
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.get('/api/products/:productId/review-eligibility', async (req, res) => {
  try {
    const userId = req.query.userId || '';
    res.json({ ok: true, productId: req.params.productId, ...(await v53CanUserReviewProduct(userId, req.params.productId)) });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/products/:productId/reviews', async (req, res) => {
  try {
    const productId = v53Text(req.params.productId);
    const userId = v53Text(req.body?.userId);
    const rating = Math.max(1, Math.min(5, Number(req.body?.rating || 5)));
    const comment = v53Text(req.body?.comment).slice(0, 1200);
    if (!userId) return res.status(401).json({ ok: false, message: 'Bạn cần đăng nhập để đánh giá sản phẩm.' });
    if (!productId) return res.status(400).json({ ok: false, message: 'Thiếu productId.' });
    if (!comment || comment.length < 3) return res.status(400).json({ ok: false, message: 'Vui lòng nhập nội dung đánh giá rõ hơn.' });

    const found = await v53FindReviewableOrderItem({
      userId,
      productId,
      orderId: req.body?.orderId || '',
      orderItemId: req.body?.orderItemId || '',
    });
    if (!found) return res.status(403).json({ ok: false, message: 'Chỉ khách đã mua hàng thành công mới được đánh giá sản phẩm này.' });

    const orderItemId = String(found.item._id);
    const existed = await Review.collection.findOne({ userId, productId, orderItemId }).catch(() => null);
    if (existed) return res.status(409).json({ ok: false, message: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi.' });

    const user = await User.findById(userId).lean().catch(() => null);
    const now = new Date();
    const doc = {
      productId,
      orderId: String(found.order._id),
      orderItemId,
      userId,
      userName: req.body?.userName || user?.name || user?.fullName || 'Khách JAPANO',
      userAvatar: user?.avatar || '',
      rating,
      comment,
      verifiedPurchase: true,
      reviewDate: now,
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await Review.collection.insertOne(doc);
    res.json({ ok: true, message: 'Đã gửi đánh giá sản phẩm.', review: { ...doc, id: String(inserted.insertedId), _id: String(inserted.insertedId) }, reviews: await v53PublicReviews(productId, userId) });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

async function v53AdminUpdateOrderStatus(req, res, quickStatus = '') {
  try {
    const admin = await requireAdmin(req.body?.adminId || req.query?.adminId);
    if (!admin) return res.status(403).json({ ok: false, message: 'Bạn cần đăng nhập admin để cập nhật đơn hàng.' });

    const orderId = req.params.orderId;
    const action = v53Lower(quickStatus || req.body?.status || req.body?.action || '');
    const order = await v53GetOrderByAnyId(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });

    const now = new Date();
    let status = action || 'confirmed';
    let paymentStatus = order.paymentStatus || 'pending';
    let note = req.body?.note || '';

    if (['success', 'complete', 'completed', 'confirm', 'confirmed', 'paid', 'delivered'].includes(action)) {
      status = 'completed';
      paymentStatus = 'paid';
      note = note || 'Admin xác nhận đơn hàng thành công.';
    } else if (['cancel', 'cancelled', 'canceled', 'huy', 'huỷ'].includes(action)) {
      status = 'cancelled';
      paymentStatus = v53Lower(order.paymentStatus) === 'paid' ? 'refunded' : 'failed';
      note = note || 'Admin hủy đơn hàng nhanh.';
    } else if (['shipping', 'shipped'].includes(action)) {
      status = action;
      paymentStatus = v53Lower(paymentStatus) === 'paid' ? 'paid' : paymentStatus;
      note = note || `Admin cập nhật trạng thái ${action}.`;
    }

    const timeline = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
    timeline.push({ status, label: status === 'completed' ? 'Đã hoàn tất' : status === 'cancelled' ? 'Đã hủy' : status, at: now, note });

    const updated = await Order.findByIdAndUpdate(order._id, {
      status,
      orderStatus: status,
      paymentStatus,
      statusTimeline: timeline,
      updatedAt: now,
    }, { new: true }).lean();

    if (order.paymentId) {
      await Payment.findByIdAndUpdate(order.paymentId, { status: paymentStatus, updatedAt: now }).catch(() => null);
    }

    res.json({ ok: true, message: status === 'completed' ? 'Đã xác nhận đơn hàng thành công. Khách có thể đánh giá sản phẩm.' : status === 'cancelled' ? 'Đã hủy đơn hàng.' : 'Đã cập nhật đơn hàng.', order: await orderWithItems(updated) });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
}

app.patch('/api/admin/orders/:orderId/status', (req, res) => v53AdminUpdateOrderStatus(req, res));
app.patch('/api/admin/orders/:orderId/success', (req, res) => v53AdminUpdateOrderStatus(req, res, 'success'));
app.patch('/api/admin/orders/:orderId/cancel', (req, res) => v53AdminUpdateOrderStatus(req, res, 'cancel'));

app.post('/api/v53/reviews/seed-fake', async (req, res) => {
  try {
    const admin = req.body?.adminId ? await requireAdmin(req.body.adminId) : null;
    if (req.body?.adminId && !admin) return res.status(403).json({ ok: false, message: 'Chỉ admin được seed review ảo vào database.' });
    const products = await Product.find({}).limit(30).lean().catch(() => []);
    let inserted = 0;
    for (const product of products) {
      const productId = product.id || String(product._id);
      const existed = await Review.collection.countDocuments({ productId, isFake: true }).catch(() => 0);
      if (existed) continue;
      for (const fake of v53FakeReviewsForProduct(productId).slice(0, 3)) {
        await Review.collection.insertOne({ ...fake, createdAt: new Date(fake.createdAt), reviewDate: new Date(fake.reviewDate), updatedAt: new Date(), isFake: true });
        inserted += 1;
      }
    }
    res.json({ ok: true, inserted, message: `Đã seed ${inserted} review ảo.` });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ================= JAPANO V53 PRODUCT REVIEWS + ORDER QUICK ACTIONS END =================
