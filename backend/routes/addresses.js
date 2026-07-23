// SỔ ĐỊA CHỈ (ERD v2: bảng addresses) — khách lưu nhiều địa chỉ, chọn mặc định;
// đồng bộ đa thiết bị qua backend thay vì lưu cục bộ trên máy.
module.exports = function registerAddressRoutes(api, ctx) {
  const { read, update, httpError } = ctx;

  function publicAddress(a) {
    return {
      id: a.id, userId: a.userId, title: a.title || 'Địa chỉ',
      name: a.name, phone: a.phone, street: a.street,
      wardCode: a.wardCode || '', ward: a.ward || '',
      provinceCode: a.provinceCode || '', province: a.province || '',
      isDefault: Boolean(a.isDefault), updatedAt: a.updatedAt || a.createdAt || Date.now(),
    };
  }
  function readAddressBody(b) {
    const name = String(b?.name || '').trim();
    const phone = String(b?.phone || '').trim();
    const street = String(b?.street || '').trim();
    if (!name) throw httpError(400, 'Thiếu họ tên người nhận.');
    if (phone.replace(/\D/g, '').length < 9) throw httpError(400, 'Số điện thoại không hợp lệ.');
    if (!street) throw httpError(400, 'Thiếu số nhà / tên đường.');
    return {
      title: String(b?.title || '').trim() || 'Địa chỉ',
      name, phone, street,
      wardCode: String(b?.wardCode || '').trim(),
      ward: String(b?.ward || '').trim(),
      provinceCode: String(b?.provinceCode || '').trim(),
      province: String(b?.province || '').trim(),
    };
  }

  api.get('/addresses', (req, res) => {
    const userId = String(req.query.userId || '');
    if (!userId) return res.status(400).json({ ok: false, message: 'Thiếu userId.' });
    const list = (read().addresses || []).filter((a) => a.userId === userId)
      .sort((l, r) => (Number(r.isDefault) - Number(l.isDefault)) || (Number(r.updatedAt || 0) - Number(l.updatedAt || 0)));
    res.json({ ok: true, addresses: list.map(publicAddress) });
  });

  api.post('/addresses', (req, res) => {
    try {
      const userId = String(req.body?.userId || '');
      if (!userId || userId === 'guest') throw httpError(401, 'Bạn cần đăng nhập để lưu địa chỉ.');
      const fields = readAddressBody(req.body);
      const now = Date.now();
      let created;
      update((state) => {
        state.addresses = state.addresses || [];
        const mine = state.addresses.filter((a) => a.userId === userId);
        const makeDefault = Boolean(req.body?.isDefault) || mine.length === 0;
        if (makeDefault) state.addresses.forEach((a) => { if (a.userId === userId) a.isDefault = false; });
        created = { id: `addr-${now}-${Math.random().toString(36).slice(2, 6)}`, userId, ...fields, isDefault: makeDefault, createdAt: now, updatedAt: now };
        state.addresses.push(created);
        return state;
      });
      res.status(201).json({ ok: true, address: publicAddress(created) });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không lưu được địa chỉ.' });
    }
  });

  api.put('/addresses/:id', (req, res) => {
    try {
      const userId = String(req.body?.userId || '');
      const fields = readAddressBody(req.body);
      let updated;
      update((state) => {
        const target = (state.addresses || []).find((a) => a.id === String(req.params.id) && a.userId === userId);
        if (!target) throw httpError(404, 'Không tìm thấy địa chỉ.');
        if (req.body?.isDefault) state.addresses.forEach((a) => { if (a.userId === userId) a.isDefault = false; });
        Object.assign(target, fields, { updatedAt: Date.now() });
        if (req.body?.isDefault) target.isDefault = true;
        updated = target;
        return state;
      });
      res.json({ ok: true, address: publicAddress(updated) });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không cập nhật được địa chỉ.' });
    }
  });

  api.post('/addresses/:id/default', (req, res) => {
    try {
      const userId = String(req.body?.userId || '');
      update((state) => {
        const target = (state.addresses || []).find((a) => a.id === String(req.params.id) && a.userId === userId);
        if (!target) throw httpError(404, 'Không tìm thấy địa chỉ.');
        state.addresses.forEach((a) => { if (a.userId === userId) a.isDefault = false; });
        target.isDefault = true; target.updatedAt = Date.now();
        return state;
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không đặt được mặc định.' });
    }
  });

  api.delete('/addresses/:id', (req, res) => {
    try {
      const userId = String(req.query.userId || req.body?.userId || '');
      update((state) => {
        const before = (state.addresses || []).length;
        state.addresses = (state.addresses || []).filter((a) => !(a.id === String(req.params.id) && a.userId === userId));
        if (state.addresses.length === before) throw httpError(404, 'Không tìm thấy địa chỉ.');
        const mine = state.addresses.filter((a) => a.userId === userId);
        if (mine.length && !mine.some((a) => a.isDefault)) mine[0].isDefault = true;
        return state;
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.message || 'Không xoá được địa chỉ.' });
    }
  });
};
