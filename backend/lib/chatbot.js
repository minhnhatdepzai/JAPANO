const { finiteNumber, productId: pid } = require('./analytics');
const { getHomeRecommendations } = require('./recommend');
const { composeOutfit, todaysOutfit } = require('./outfit');

const INTENTS = [
  { name: 'greeting', test: /\b(chào|hi|hello|xin chào|alo)\b/i },
  { name: 'discount', test: /(giảm giá|khuyến mãi|voucher|mã giảm|sale|ưu đãi)/i },
  { name: 'order', test: /(đơn hàng|đơn của tôi|đã đặt|tình trạng đơn|giao hàng|ship tới đâu|vận chuyển)/i },
  { name: 'size', test: /(size|kích thước|mặc vừa|số đo|vòng ngực|vòng eo)/i },
  { name: 'tryon', test: /(thử đồ|thử ảnh|ướm thử|xem thử lên người)/i },
  { name: 'trend', test: /(hot|bán chạy|xu hướng|trend|nổi bật|hot trend)/i },
  { name: 'outfit', test: /(phối|mặc gì|phối đồ|outfit|set đồ|đi kèm|lên đồ)/i },
  { name: 'price', test: /(giá|bao nhiêu tiền|giá bao nhiêu|nhiêu tiền)/i },
];

function words(text) {
  return String(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
}

// So khớp theo TỪ TRỌN VẸN (không phải substring thô) để tránh khớp nhầm kiểu "kim" bên trong "kimono".
function matchProducts(message, products, limit = 4) {
  const messageWords = new Set(words(message));
  const scored = products.map((p) => {
    const shortPhrases = [p.cat, p.category, ...(p.tags || []), ...(p.visualTags || [])].filter(Boolean).map((s) => String(s).toLowerCase());
    let hits = 0;
    shortPhrases.forEach((phrase) => { const w = words(phrase); if (w.length && w.every((word) => messageWords.has(word))) hits += 1; });
    words(p.name).forEach((word) => { if (messageWords.has(word)) hits += 1; });
    return { p, hits };
  }).filter((x) => x.hits > 0).sort((a, b) => b.hits - a.hits);
  return scored.slice(0, limit).map((x) => x.p);
}

function priceRange(message) {
  const text = String(message || '').toLowerCase();
  const m = text.match(/(\d+)\s*(k|nghìn|ngàn|tr|triệu)/);
  if (!m) return null;
  const unit = m[2].startsWith('tr') ? 1000000 : 1000;
  return Number(m[1]) * unit;
}

function money(n) { return `${Math.round(finiteNumber(n, 0)).toLocaleString('vi-VN')}₫`; }

function categoryLabel(state, cat) {
  const found = (state.categories || []).find((c) => c.id === cat);
  return found ? found.name : cat;
}

// Chatbot dạng intent + truy hồi (retrieval), không cần LLM ngoài: nhận diện ý định qua từ khoá tiếng Việt,
// tận dụng lại engine gợi ý (recommend.js) và ghép đồ (outfit.js) đã có để trả lời có sản phẩm thật kèm theo.
function reply(state, { userId = 'guest', message = '', profile } = {}) {
  const products = (state.products || []).filter((p) => !['archived', 'hidden'].includes(String(p.status || '')));
  const mentioned = matchProducts(message, products);
  const intent = INTENTS.find((i) => i.test.test(message))?.name || (mentioned.length ? 'lookup' : 'fallback');
  const under = priceRange(message);

  if (intent === 'greeting') {
    const suggestions = getHomeRecommendations(state, { userId, limit: 3, profile });
    return { message: 'Hôm nay bạn thế nào? Mình là Ori 織. Bạn kể mình nghe tâm trạng hoặc dịp sắp tới, mình sẽ gợi ý món phù hợp trong shop — bạn có thể thêm giỏ và mua ngay trong botchat.', productIds: suggestions.items };
  }

  if (intent === 'discount') {
    const vouchers = (state.vouchers || []).filter((v) => v.active);
    if (!vouchers.length) return { message: 'Hiện chưa có voucher nào đang chạy, bạn quay lại sau nhé!', productIds: [] };
    const lines = vouchers.map((v) => `${v.code} — ${v.type === 'percent' ? `giảm ${v.value}%` : `giảm ${money(v.value)}`}${v.min ? ` cho đơn từ ${money(v.min)}` : ''}`);
    return { message: `Đang có ${vouchers.length} ưu đãi cho bạn:\n${lines.join('\n')}`, productIds: [] };
  }

  if (intent === 'order') {
    const orders = (state.orders || []).filter((o) => String(o.userId) === String(userId)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!orders.length) return { message: 'Mình chưa thấy đơn hàng nào gắn với tài khoản này. Bạn có thể xem lịch sử đơn ở tab Đơn hàng nhé.', productIds: [] };
    const latest = orders[0];
    return { message: `Đơn ${latest.code} đang ở trạng thái "${latest.status}", tổng ${money(latest.total)}. Xem chi tiết ở tab Đơn hàng nha.`, productIds: [] };
  }

  if (intent === 'size') {
    const height = profile?.height || profile?.heightCm;
    const weight = profile?.weight || profile?.weightKg;
    const base = 'Bạn vào mục "Thử đồ AI" ở trang sản phẩm rồi bấm "Gợi ý size cho tôi" — Ori sẽ tính theo số đo của bạn.';
    if (height || weight) return { message: `Với chiều cao/cân nặng đã lưu, size gợi ý thường quanh M–L tuỳ form áo. ${base}`, productIds: mentioned.map(pid) };
    return { message: base, productIds: mentioned.map(pid) };
  }

  if (intent === 'tryon') {
    return { message: 'Bạn mở trang sản phẩm rồi bấm "Thử đồ AI" để chụp/tải ảnh và xem thử lên người nhé — Ori sẽ ghép giúp bạn.', productIds: mentioned.map(pid) };
  }

  if (intent === 'trend') {
    const trending = getHomeRecommendations(state, { userId: 'guest', limit: 4 });
    return { message: 'Đang thịnh hành ở JAPANO có mấy món này nè:', productIds: trending.items };
  }

  if (intent === 'outfit') {
    const anchor = mentioned[0] || null;
    const set = anchor ? composeOutfit(state, pid(anchor)) : todaysOutfit(state);
    if (!set) return { message: 'Kho đồ đang trống quá, chưa ghép được set nào. Bạn thử lại sau nhé.', productIds: [] };
    return { message: `${set.title} — tổng khoảng ${money(set.totalPrice)}. Đây là gợi ý phối đồ theo màu và chủ đề hợp nhau:`, productIds: set.items.map((i) => i.slug) };
  }

  if (intent === 'price') {
    if (mentioned.length) {
      const lines = mentioned.map((p) => `${p.name}: ${money(p.price)}`);
      return { message: lines.join('\n'), productIds: mentioned.map(pid) };
    }
    return { message: 'Bạn muốn hỏi giá sản phẩm nào? Cho mình tên hoặc loại đồ (vd: kimono, haori, phụ kiện) nhé.', productIds: [] };
  }

  if (intent === 'lookup') {
    let pool = mentioned;
    if (under) pool = pool.filter((p) => finiteNumber(p.price, 0) <= under).length ? pool.filter((p) => finiteNumber(p.price, 0) <= under) : pool;
    const cat = pool[0] ? categoryLabel(state, pool[0].cat || pool[0].category) : '';
    return { message: `Mình tìm được ${pool.length} món${cat ? ` trong nhóm ${cat}` : ''} hợp với câu hỏi của bạn:`, productIds: pool.map(pid) };
  }

  const fallback = getHomeRecommendations(state, { userId, limit: 4, profile });
  return { message: 'Ori chưa chắc hiểu ý bạn lắm, nhưng đây là vài gợi ý có thể bạn sẽ thích — hoặc bạn thử hỏi rõ hơn về giá, size, phối đồ, khuyến mãi nhé:', productIds: fallback.items };
}

module.exports = { reply };
