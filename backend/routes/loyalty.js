// Chương trình thân thiết: bộ sưu tập Flagcard (thẻ địa danh + voucher đổi
// thưởng), hạng VIP (suy từ lịch sử mua), và kiểm tra mã giảm giá.
module.exports = function registerLoyaltyRoutes(api, ctx) {
  const {
    read, update, ensureFlagcardState, reconcileFlagRewards, flagcardCollectionView,
    getOrCreateCollection, ensureRewardVoucher, validateVoucher, VIP_CONFIG, vipStatus,
    requireSelfOrStaff,
  } = ctx;

  // Bộ sưu tập Flagcard lịch sử + voucher cá nhân — voucher là tài sản có giá
  // trị thật nên chỉ chính chủ (hoặc nhân viên) mới được xem.
  api.get('/flagcards/collection/:userId', requireSelfOrStaff((req) => req.params.userId), (req, res) => {
    res.json({ ok: true, ...flagcardCollectionView(read(), String(req.params.userId)) });
  });
  api.get('/flagcards-program', (req, res) => {
    const state = read();
    ensureFlagcardState(state);
    res.json({ ok: true, config: state.flagcardConfig, cards: state.flagcards });
  });
  api.post('/flagcards/reconcile', (req, res) => {
    let result;
    const state = update((next) => {
      result = reconcileFlagRewards(next);
      return next;
    });
    res.json({ ok: true, awards: result.awards, collections: state.flagcardCollections, vouchers: state.vouchers.filter((item) => item.source === 'flagcard-collection') });
  });
  api.post('/flagcards/admin/grant', (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    const cardId = String(req.body?.cardId || '').trim();
    if (!userId || !cardId) return res.status(400).json({ ok: false, message: 'Thiếu userId hoặc cardId.' });
    let view;
    update((state) => {
      ensureFlagcardState(state);
      const card = state.flagcards.find((item) => item.id === cardId && item.active !== false);
      if (!card) return state;
      const collection = getOrCreateCollection(state, userId);
      if (!collection.cardIds.includes(cardId)) {
        const award = { cardId, orderId: null, orderCode: 'ADMIN', orderTotal: 0, awardedAt: Date.now(), source: 'admin-grant' };
        collection.cardIds.push(cardId);
        collection.awards.push(award);
        collection.updatedAt = Date.now();
      }
      ensureRewardVoucher(state, collection);
      view = flagcardCollectionView(state, userId);
      return state;
    });
    if (!view) return res.status(404).json({ ok: false, message: 'Không tìm thấy Flagcard.' });
    res.json({ ok: true, ...view });
  });

  // Hạng VIP được suy ra từ các đơn đã thanh toán/hoàn tất trong từng tháng.
  // Trạng thái luôn tính tại thời điểm gọi nên ngày hết hạn không thể bị cache cũ.
  api.get('/vip/status/:userId', requireSelfOrStaff((req) => req.params.userId), (req, res) => {
    const userId = String(req.params.userId || '').trim();
    res.json({ ok: true, config: VIP_CONFIG, status: vipStatus(read(), userId) });
  });

  api.post('/vouchers/validate', (req, res) => {
    const result = validateVoucher(read(), {
      code: req.body?.code,
      userId: req.body?.userId,
      subtotal: req.body?.subtotal,
    });
    res.status(result.ok ? 200 : 400).json(result);
  });
};
