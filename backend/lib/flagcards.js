const DEFAULT_FLAGCARD_CONFIG = Object.freeze({
  active: true,
  qualifyingOrderMin: 5_000_000,
  requiredCards: 7,
  rewardPercent: 50,
  rewardVoucherMinOrder: 0,
  rewardValidityDays: 90,
});

const FLAGCARDS = Object.freeze([
  {
    id: 'fushimi-inari', order: 1, glyph: '⛩️', accent: '#D64A2D',
    title: 'Fushimi Inari Taisha', japanese: '伏見稲荷大社', region: 'Kyoto',
    summary: 'Con đường hàng nghìn cổng torii đỏ dẫn lên núi Inari — biểu tượng của lời cầu thịnh vượng.',
    formationHistory: 'Đền được gia tộc Hata dâng thờ thần lúa gạo và sake từ thế kỷ VIII. Khi thương nghiệp phát triển, Inari dần được cầu nguyện cho sự thịnh vượng trong kinh doanh.',
    legend: 'Cáo kitsune được xem là sứ giả của Inari. Chìa khóa trong miệng tượng cáo tượng trưng cho chìa khóa kho lúa — nguồn của cải và no đủ.',
    funFacts: ['Có hơn 5.000 cổng torii màu son trên các lối núi.', 'Đây là trung tâm của khoảng 40.000 đền Inari trên khắp Nhật Bản.'],
    checkins: [
      { name: 'Senbon Torii', tip: 'Chụp ở đoạn cổng dày, đứng lệch tâm để giữ chiều sâu.' },
      { name: 'Yotsutsuji', tip: 'Đi lên điểm ngắm cảnh để lấy hậu cảnh Kyoto.' },
      { name: 'Romon Gate', tip: 'Khung hình chính diện với cổng lớn màu son.' },
    ],
    outfit: { style: 'Nhật cổ đỏ–trắng', clothing: ['Yukata hoặc kimono gọn nhẹ', 'Haori mỏng khi chiều tối'], accessories: ['Guốc geta', 'Kẹp nơ tóc'], reason: 'Tông đỏ–trắng đồng điệu với torii nhưng vẫn tôn chủ thể.' },
    recommendedProductIds: ['yukata-xanh', 'kimono-hong', 'guoc-geta', 'kep-no'],
    sourceUrl: 'https://kyoto.travel/en/destinations/fushimi-inaritaisha-shrine/', active: true,
  },
  {
    id: 'kiyomizu-dera', order: 2, glyph: '🏯', accent: '#B06B3B',
    title: 'Kiyomizu-dera', japanese: '清水寺', region: 'Kyoto',
    summary: 'Ngôi chùa trên sườn núi nổi tiếng với sân khấu gỗ nhìn xuống cố đô Kyoto.',
    formationHistory: 'Chính điện và hiên gỗ dựa trên các cột cao khoảng 13 mét. Quần thể là một phần Di sản “Các di tích lịch sử Kyoto cổ”, thể hiện truyền thống kiến trúc tôn giáo bằng gỗ của Kyoto.',
    legend: 'Nước ở thác Otowa chia thành ba dòng, dân gian gắn với sức khỏe, trường thọ và thành công học tập. Thành ngữ “nhảy khỏi sân khấu Kiyomizu” mang nghĩa dám quyết định lớn.',
    funFacts: ['Chính điện thờ Bồ Tát Quan Âm.', 'Hiên chùa là điểm ngắm hoàng hôn và toàn cảnh phía tây Kyoto.'],
    checkins: [
      { name: 'Kiyomizu Stage', tip: 'Lấy lan can gỗ và thung lũng trong cùng khung hình.' },
      { name: 'Otowa Waterfall', tip: 'Chụp nhẹ nhàng khi trải nghiệm dòng nước, không cản lối.' },
      { name: 'Sannenzaka', tip: 'Check-in phố dốc cổ vào sáng sớm để ít đông.' },
    ],
    outfit: { style: 'Thanh lịch màu trà', clothing: ['Kimono hoa nhã', 'Haori dáng dài'], accessories: ['Dù Nhật', 'Guốc geta'], reason: 'Màu trà, kem và hồng dịu hợp kiến trúc gỗ và lá mùa thu.' },
    recommendedProductIds: ['kimono-hong', 'haori-dang-dai', 'du-nhat', 'guoc-geta'],
    sourceUrl: 'https://kyoto.travel/en/destinations/kiyomizudera-temple/', active: true,
  },
  {
    id: 'himeji-castle', order: 3, glyph: '🕊️', accent: '#54708D',
    title: 'Himeji Castle', japanese: '姫路城', region: 'Hyogo',
    summary: '“Lâu đài Hạc Trắng” với tường vữa trắng và hệ thống phòng thủ như mê cung.',
    formationHistory: 'Công trình đầu tiên được thiết lập năm 1346. Toyotomi Hideyoshi xây thành quy mô lớn, rồi lâu đài được cải tạo mạnh trong chín năm đầu thời Edo để thành hình dáng ngày nay.',
    legend: 'Dáng thành trắng như chim hạc dang cánh tạo nên tên gọi Shirasagi-jō. Truyền thuyết Okiku bên chiếc giếng cổ cũng gắn với khu thành Himeji.',
    funFacts: ['Lớp vữa trắng vừa đẹp vừa giúp chống lửa và đạn.', 'Lối đi quanh co được thiết kế để làm quân địch mất phương hướng.'],
    checkins: [
      { name: 'Sannomaru Square', tip: 'Góc rộng đẹp nhất để lấy trọn đại thiên thủ.' },
      { name: 'Bizenmaru', tip: 'Chụp từ dưới lên để nhấn mạnh các tầng mái trắng.' },
      { name: 'Nishinomaru Garden', tip: 'Dùng hành lang dài làm đường dẫn thị giác.' },
    ],
    outfit: { style: 'Trắng–chàm tối giản', clothing: ['Yukata xanh đen', 'Haori đường nét gọn'], accessories: ['Guốc geta', 'Kiếm gỗ dùng như đạo cụ đúng khu vực cho phép'], reason: 'Tương phản chàm–trắng làm nổi bật sắc Hạc Trắng.' },
    recommendedProductIds: ['yukata-xanh', 'haori-dang-dai', 'guoc-geta', 'kiem-go'],
    sourceUrl: 'https://www.japan.travel/en/world-heritage/himeji-jo-castle/', active: true,
  },
  {
    id: 'itsukushima', order: 4, glyph: '🌊', accent: '#B33C35',
    title: 'Itsukushima Shrine', japanese: '厳島神社', region: 'Hiroshima',
    summary: 'Quần thể đền màu son và đại torii như nổi trên biển khi thủy triều lên.',
    formationHistory: 'Đền được cho là xây từ năm 593 và được Taira no Kiyomori mở rộng, tái thiết năm 1168 thành hệ thống điện thờ sơn son trên mặt nước.',
    legend: 'Itsukushima thờ vị thần bảo hộ khỏi tai họa trên biển và chiến tranh. Hòn đảo được xem linh thiêng nên kiến trúc được dựng trên nước để giữ sự thanh tịnh.',
    funFacts: ['Sân khấu cao vẫn dùng cho nhã nhạc và vũ điệu cung đình gagaku.', 'Cảnh quan thay đổi hoàn toàn giữa lúc triều lên và triều xuống.'],
    checkins: [
      { name: 'Otorii Gate', tip: 'Canh giờ thủy triều cao để có hiệu ứng cổng nổi.' },
      { name: 'Vermilion Corridors', tip: 'Chụp dọc hành lang, tránh đứng giữa luồng người.' },
      { name: 'Senjokaku', tip: 'Lấy sàn gỗ rộng và đền năm tầng ở hậu cảnh.' },
    ],
    outfit: { style: 'Lễ hội son–chàm', clothing: ['Kimono hoặc yukata', 'Haori nhẹ chống gió biển'], accessories: ['Dù Nhật', 'Kẹp tóc'], reason: 'Sắc son và chàm bắt màu đẹp với mặt nước và hành lang đền.' },
    recommendedProductIds: ['kimono-hong', 'yukata-xanh', 'du-nhat', 'kep-no'],
    sourceUrl: 'https://www.japan.travel/en/world-heritage/itsukushima-shinto-shrine/', active: true,
  },
  {
    id: 'nikko-toshogu', order: 5, glyph: '🐒', accent: '#9C7737',
    title: 'Nikkō Tōshō-gū', japanese: '日光東照宮', region: 'Tochigi',
    summary: 'Lăng miếu Tokugawa Ieyasu giữa rừng tuyết tùng, nổi tiếng với chạm khắc dát màu tinh xảo.',
    formationHistory: 'Nơi đây tưởng niệm và an táng Tokugawa Ieyasu, vị shogun mở đầu Mạc phủ Tokugawa. Khoảng 127.000 nghệ nhân đã tham gia kiến tạo quần thể bằng kỹ thuật hàng đầu đương thời.',
    legend: 'Mèo ngủ Nemuri-neko với chim sẻ phía sau được diễn giải như biểu tượng cho tương lai hòa bình; bộ Ba Chú Khỉ truyền tải “không nhìn, không nghe, không nói điều xấu”.',
    funFacts: ['Cổng Yomeimon phủ kín chạm khắc và màu sắc.', '“Con voi tưởng tượng” được tạc bởi nghệ nhân chưa từng nhìn thấy voi thật.'],
    checkins: [
      { name: 'Yomeimon Gate', tip: 'Dùng góc chính diện và trang phục tối để nổi trên nền vàng.' },
      { name: 'Three Wise Monkeys', tip: 'Tạo dáng ba biểu tượng một cách vui vẻ nhưng trật tự.' },
      { name: 'Shinkyo Bridge', tip: 'Check-in từ khu vực cho phép, không bước vào vùng hạn chế.' },
    ],
    outfit: { style: 'Đen–vàng trang trọng', clothing: ['Haori tối màu', 'Áo cổ lọ khi trời lạnh'], accessories: ['Mũ bo Nhật', 'Găng tay'], reason: 'Tông tối làm nổi chi tiết vàng–đỏ dày đặc của Tōshō-gū.' },
    recommendedProductIds: ['haori-dang-dai', 'ao-len-co-lo', 'mu-nhat', 'gang-tay'],
    sourceUrl: 'https://www.japan.travel/en/world-heritage/the-shrines-and-temples-of-nikko/', active: true,
  },
  {
    id: 'shirakawa-go', order: 6, glyph: '❄️', accent: '#66808B',
    title: 'Shirakawa-gō', japanese: '白川郷', region: 'Gifu',
    summary: 'Làng miền núi với mái nhà gasshō-zukuri dốc như hai bàn tay chắp lại.',
    formationHistory: 'Vùng núi từng biệt lập đã phát triển kiểu nhà mái tranh dốc khoảng 60 độ để tuyết dày dễ trượt xuống. Tầng áp mái được tận dụng nuôi tằm, một sinh kế quan trọng của cư dân.',
    legend: 'Tên gasshō nghĩa là “chắp tay cầu nguyện”, gợi hình dáng mái nhà. Tinh thần kết nối cộng đồng thể hiện qua việc cư dân cùng nhau thay và bảo dưỡng mái tranh.',
    funFacts: ['Nhiều kết cấu gỗ ghép với nhau mà không dùng đinh.', 'Ogimachi có cụm nhà lớn và điểm quan sát toàn cảnh từ trên cao.'],
    checkins: [
      { name: 'Shiroyama Observatory', tip: 'Chụp toàn làng; mùa đông cần tuân thủ lối đi chống trượt.' },
      { name: 'Wada House', tip: 'Góc hàng rào và mái tranh cho chiều sâu đẹp.' },
      { name: 'Ogimachi Lanes', tip: 'Tôn trọng nhà dân và không đi vào khu vực riêng.' },
    ],
    outfit: { style: 'Layer mùa đông mộc mạc', clothing: ['Cardigan dài', 'Áo len cổ lọ'], accessories: ['Chụp tai', 'Găng tay', 'Dép/giày ấm'], reason: 'Layer trung tính hợp làng tuyết và quan trọng hơn là giữ ấm, dễ đi bộ.' },
    recommendedProductIds: ['cardigan-dai', 'ao-len-co-lo', 'chup-tai', 'gang-tay'],
    sourceUrl: 'https://www.japan.travel/en/world-heritage/the-historic-villages-of-shirakawa-go-and-gokayama/', active: true,
  },
  {
    id: 'matsumoto-castle', order: 7, glyph: '🐦‍⬛', accent: '#34363D',
    title: 'Matsumoto Castle', japanese: '松本城', region: 'Nagano',
    summary: '“Lâu đài Quạ” màu đen soi bóng xuống hào nước, phía xa là dãy Alps Nhật Bản.',
    formationHistory: 'Đại thiên thủ năm tầng, sáu tầng bên trong được dựng vào cuối thế kỷ XVI và thuộc nhóm tháp thành cổ nhất còn tồn tại tại Nhật Bản.',
    legend: 'Màu đen uy nghi khiến thành có biệt danh Karasu-jō — Lâu đài Quạ. Hình ảnh thành phản chiếu trong hào được xem như hai thế giới của chiến thành và thành phố hiện đại.',
    funFacts: ['Nội thất gỗ nguyên bản có cầu thang rất dốc.', 'Hào nước, cầu son và nền Alps tạo nên ba lớp cảnh quan đặc trưng.'],
    checkins: [
      { name: 'Uzumibashi Bridge', tip: 'Dùng cầu son làm điểm nhấn cạnh tường thành đen.' },
      { name: 'Moat Reflection', tip: 'Sáng sớm ít gió cho mặt nước phản chiếu rõ.' },
      { name: 'Honmaru Garden', tip: 'Chụp dọc từ sân để giữ trọn các tầng thiên thủ.' },
    ],
    outfit: { style: 'Đen–đỏ samurai hiện đại', clothing: ['Haori đen', 'Blazer kaki tối giản'], accessories: ['Kiếm gỗ làm đạo cụ đúng quy định', 'Guốc geta'], reason: 'Đường nét mạnh và tông đen–đỏ hòa với thành Quạ cùng cầu son.' },
    recommendedProductIds: ['haori-dang-dai', 'blazer-kaki', 'kiem-go', 'guoc-geta'],
    sourceUrl: 'https://www.japan.travel/en/spot/1356/', active: true,
  },
]);

const clone = (value) => JSON.parse(JSON.stringify(value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function ensureFlagcardState(state) {
  if (!Array.isArray(state.flagcards) || !state.flagcards.length) state.flagcards = clone(FLAGCARDS);
  if (!Array.isArray(state.flagcardCollections)) state.flagcardCollections = [];
  if (!Array.isArray(state.voucherRedemptions)) state.voucherRedemptions = [];
  state.flagcardConfig = { ...DEFAULT_FLAGCARD_CONFIG, ...(state.flagcardConfig || {}) };
  return state;
}

function isSuccessfulOrder(order) {
  const payment = String(order?.payment?.status || '').toLowerCase();
  const method = String(order?.payment?.method || order?.payment?.provider || '').toLowerCase();
  const status = String(order?.status || '').toLowerCase();
  const codAccepted = /cod/.test(method) && !['cancelled', 'failed', 'returned', 'refunded'].includes(status);
  return payment === 'paid' || ['completed', 'delivered'].includes(status) || codAccepted;
}

function orderUserId(order) {
  return String(order?.userId || order?.customer?.id || '').trim();
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rewardCodeFor(userId) {
  const clean = String(userId).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-8) || 'MEMBER';
  return `FLAG50-${clean}-${hashString(userId).toString(36).toUpperCase().slice(-3)}`;
}

function expiryDate(now, days) {
  return new Date(now + Math.max(1, finite(days, 90)) * 86400000).toISOString().slice(0, 10);
}

function ensureRewardVoucher(state, collection, now = Date.now()) {
  const config = state.flagcardConfig;
  const activeCards = state.flagcards.filter((card) => card.active !== false);
  const required = Math.min(activeCards.length, Math.max(1, finite(config.requiredCards, 7)));
  if (collection.cardIds.length < required) return null;
  let code = collection.rewardVoucherCode || rewardCodeFor(collection.userId);
  let voucher = state.vouchers.find((item) => item.code === code);
  if (!voucher) {
    voucher = {
      code,
      type: 'percent',
      value: Math.min(100, Math.max(1, finite(config.rewardPercent, 50))),
      min: Math.max(0, finite(config.rewardVoucherMinOrder, 0)),
      expiry: expiryDate(now, config.rewardValidityDays),
      limit: 1,
      used: 0,
      active: true,
      appliesTo: 'all-products',
      ownerUserId: collection.userId,
      source: 'flagcard-collection',
      issuedAt: now,
    };
    state.vouchers.push(voucher);
  }
  collection.completedAt ||= now;
  collection.rewardVoucherCode = code;
  return voucher;
}

function getOrCreateCollection(state, userId, now = Date.now()) {
  let collection = state.flagcardCollections.find((item) => String(item.userId) === String(userId));
  if (!collection) {
    collection = { id: `flags-${userId}`, userId: String(userId), cardIds: [], awards: [], createdAt: now, updatedAt: now };
    state.flagcardCollections.push(collection);
  }
  collection.cardIds = [...new Set((collection.cardIds || []).map(String))];
  collection.awards = Array.isArray(collection.awards) ? collection.awards : [];
  return collection;
}

function awardFlagcardForOrder(state, order, now = Date.now()) {
  ensureFlagcardState(state);
  const config = state.flagcardConfig;
  const userId = orderUserId(order);
  if (!config.active || !userId || !isSuccessfulOrder(order) || finite(order.total) < finite(config.qualifyingOrderMin, 5_000_000)) return null;
  if (order.flagcardAward?.cardId) return order.flagcardAward;
  const collection = getOrCreateCollection(state, userId, now);
  const available = state.flagcards
    .filter((card) => card.active !== false && !collection.cardIds.includes(card.id))
    .sort((left, right) => finite(left.order) - finite(right.order));
  if (!available.length) {
    ensureRewardVoucher(state, collection, now);
    return null;
  }
  const card = available[hashString(order.id || order.code) % available.length];
  const award = { cardId: card.id, orderId: order.id, orderCode: order.code, orderTotal: finite(order.total), awardedAt: now, source: 'qualifying-order' };
  collection.cardIds.push(card.id);
  collection.awards.push(award);
  collection.updatedAt = now;
  order.flagcardAward = award;
  const voucher = ensureRewardVoucher(state, collection, now);
  return { ...award, card: clone(card), completedCollection: Boolean(voucher), rewardVoucher: voucher ? clone(voucher) : null };
}

function reconcileFlagRewards(state, now = Date.now()) {
  ensureFlagcardState(state);
  const awards = [];
  [...(state.orders || [])]
    .sort((left, right) => finite(left.createdAt) - finite(right.createdAt))
    .forEach((order) => {
      const award = awardFlagcardForOrder(state, order, finite(order.completedAt || now, now));
      if (award?.cardId) awards.push({ orderId: order.id, ...award });
    });
  state.flagcardCollections.forEach((collection) => ensureRewardVoucher(state, collection, now));
  return { state, awards };
}

function flagcardCollectionView(state, userId) {
  ensureFlagcardState(state);
  const collection = state.flagcardCollections.find((item) => String(item.userId) === String(userId)) || {
    userId: String(userId), cardIds: [], awards: [],
  };
  const activeCards = state.flagcards.filter((card) => card.active !== false).sort((a, b) => finite(a.order) - finite(b.order));
  const awardByCard = new Map((collection.awards || []).map((award) => [award.cardId, award]));
  const required = Math.min(activeCards.length, Math.max(1, finite(state.flagcardConfig.requiredCards, 7)));
  const voucher = collection.rewardVoucherCode ? state.vouchers.find((item) => item.code === collection.rewardVoucherCode) : null;
  return {
    config: clone(state.flagcardConfig),
    progress: { owned: collection.cardIds?.length || 0, required, percent: Math.min(100, Math.round(((collection.cardIds?.length || 0) / required) * 100)), completed: (collection.cardIds?.length || 0) >= required },
    cards: activeCards.map((card) => ({ ...clone(card), owned: (collection.cardIds || []).includes(card.id), award: awardByCard.get(card.id) || null })),
    collection: clone(collection),
    rewardVoucher: voucher ? clone(voucher) : null,
  };
}

function validateVoucher(state, { code, userId, subtotal }) {
  ensureFlagcardState(state);
  const voucher = (state.vouchers || []).find((item) => String(item.code).toUpperCase() === String(code || '').trim().toUpperCase());
  if (!voucher) return { ok: false, message: 'Mã voucher không tồn tại.' };
  if (!voucher.active) return { ok: false, message: 'Voucher đang tạm khóa.' };
  if (voucher.ownerUserId && String(voucher.ownerUserId) !== String(userId || '')) return { ok: false, message: 'Đây là voucher cá nhân của tài khoản khác.' };
  if (finite(voucher.used) >= Math.max(1, finite(voucher.limit, 1))) return { ok: false, message: 'Voucher đã hết lượt sử dụng.' };
  if (voucher.expiry && voucher.expiry !== '—' && new Date(`${voucher.expiry}T23:59:59`).getTime() < Date.now()) return { ok: false, message: 'Voucher đã hết hạn.' };
  if (finite(subtotal) < finite(voucher.min)) return { ok: false, message: `Đơn hàng cần tối thiểu ${finite(voucher.min).toLocaleString('vi-VN')}₫.` };
  const discount = voucher.type === 'percent'
    ? Math.round(finite(subtotal) * Math.min(100, Math.max(0, finite(voucher.value))) / 100)
    : Math.min(finite(subtotal), Math.max(0, finite(voucher.value)));
  return { ok: true, voucher: clone(voucher), discount, subtotal: finite(subtotal) };
}

module.exports = {
  DEFAULT_FLAGCARD_CONFIG,
  FLAGCARDS,
  ensureFlagcardState,
  isSuccessfulOrder,
  awardFlagcardForOrder,
  reconcileFlagRewards,
  flagcardCollectionView,
  validateVoucher,
  getOrCreateCollection,
  ensureRewardVoucher,
};
