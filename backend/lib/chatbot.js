const { finiteNumber, productId: pid } = require('./analytics');
const { getHomeRecommendations } = require('./recommend');
const { composeOutfit, todaysOutfit } = require('./outfit');
const { japanKnowledgeAnswer } = require('./japanKnowledge');
const { routeChatIntent, semanticSimilarity, normalizeText } = require('./postTransformer');

const INTENTS = [
  { name: 'greeting', test: /\b(chào|hi|hello|xin chào|alo)\b/i },
  { name: 'discount', test: /(giảm giá|khuyến mãi|voucher|mã giảm|sale|ưu đãi)/i },
  { name: 'order', test: /(đơn hàng|đơn của tôi|đã đặt|tình trạng đơn|giao hàng|ship tới đâu|vận chuyển)/i },
  { name: 'size', test: /(size|kích thước|mặc vừa|số đo|vòng ngực|vòng eo)/i },
  { name: 'tryon', test: /(thử đồ|thử ảnh|ướm thử|xem thử lên người)/i },
  { name: 'trend', test: /(hot|bán chạy|xu hướng|trend|nổi bật|hot trend)/i },
  { name: 'outfit', test: /(phối|mặc gì|phối đồ|outfit|set đồ|đi kèm|lên đồ)/i },
  { name: 'price', test: /(giá|bao nhiêu tiền|giá bao nhiêu|nhiêu tiền)/i },
  { name: 'shopping', test: /(shop|cửa hàng|sản phẩm|quần áo|áo quần|đồ mặc|thời trang|mua đồ|mua áo|mua quần|có đồ|có áo|có quần|đồ hàng|hàng nào)/i },
];

const COLOR_WORDS = ['đen','trắng','đỏ','hồng','xanh','vàng','nâu','be','tím','cam','xám','chàm'];
const OCCASION_WORDS = ['công sở','đi làm','đi học','lễ hội','matsuri','tốt nghiệp','đám cưới','hẹn hò','mặc nhà','du lịch','chụp ảnh','mùa hè','mùa đông'];

function detectRuleIntent(message, hasMentionedProduct = false) {
  const rawIntent = INTENTS.find((item) => item.test.test(message))?.name;
  if (rawIntent) return rawIntent;
  const normalized = normalizeText(message);
  if (/(shop|cua hang|san pham|quan ao|ao quan|do mac|thoi trang|mua do|mua ao|mua quan|co do|co ao|co quan|do hang|hang nao)/.test(normalized)) {
    return 'shopping';
  }
  return hasMentionedProduct ? 'lookup' : 'fallback';
}

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
    const semanticText = [
      p.name, p.kanji, p.cat, p.category, p.garmentType,
      ...(p.tags || []), ...(p.visualTags || []), p.desc, p.description, p.story,
    ].filter(Boolean).join(' ');
    const semantic = semanticSimilarity(message, semanticText);
    return { p, hits, semantic, score: hits * 2 + semantic };
  }).filter((x) => x.hits > 0 || x.semantic >= 0.34).sort((a, b) => b.score - a.score);
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

function isAvailableProduct(product) {
  const status = String(product?.status || '').toLowerCase();
  if (['archived', 'hidden', 'draft', 'out'].includes(status)) return false;
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return !variants.length || variants.some((variant) => finiteNumber(variant.stock, 0) > 0);
}

function availableSizes(product) {
  return [...new Set((product?.variants || [])
    .filter((variant) => finiteNumber(variant.stock, 0) > 0)
    .map((variant) => String(variant.size || '').trim().toUpperCase())
    .filter(Boolean))];
}

function productsFromHistory(history, products) {
  const ids = new Set();
  (history || []).slice(-12).reverse().forEach((row) => {
    for (const value of row?.productIds || []) ids.add(String(value));
  });
  return products.filter((product) => ids.has(String(pid(product))));
}

function catalogCandidates(message, products, fallbackIds = []) {
  const normalized = normalizeText(message);
  const under = priceRange(message);
  const colors = COLOR_WORDS.filter((word) => normalized.includes(normalizeText(word)));
  const occasions = OCCASION_WORDS.filter((word) => normalized.includes(normalizeText(word)));
  const wantsMale = /\b(nam|con trai|ban trai|chong)\b/.test(normalized);
  const wantsFemale = /\b(nu|con gai|ban gai|vo)\b/.test(normalized);
  const scored = products.map((product) => {
    const text = normalizeText([
      product.name, product.cat, product.category, product.garmentType,
      ...(product.tags || []), ...(product.visualTags || []), product.desc, product.description,
    ].filter(Boolean).join(' '));
    let score = semanticSimilarity(message, text);
    for (const color of colors) if (text.includes(normalizeText(color))) score += 1.2;
    for (const occasion of occasions) if (text.includes(normalizeText(occasion))) score += 1.1;
    if (wantsMale && /\b(nam|unisex)\b/.test(text)) score += 0.7;
    if (wantsFemale && /\b(nu|unisex)\b/.test(text)) score += 0.7;
    if (fallbackIds.includes(String(pid(product)))) score += 0.35;
    if (under && finiteNumber(product.price, 0) <= under) score += 0.8;
    if (under && finiteNumber(product.price, 0) > under) score -= 1.5;
    return { product, score };
  }).sort((left, right) => right.score - left.score);
  const eligible = scored.filter((row) => !under || finiteNumber(row.product.price, 0) <= under);
  return (eligible.length ? eligible : scored).slice(0, 4).map((row) => row.product);
}

// Chatbot dạng intent + truy hồi (retrieval), không cần LLM ngoài: nhận diện ý định qua từ khoá tiếng Việt,
// tận dụng lại engine gợi ý (recommend.js) và ghép đồ (outfit.js) đã có để trả lời có sản phẩm thật kèm theo.
function baseReply(state, { userId = 'guest', message = '', profile, history = [], routedIntent } = {}) {
  const products = (state.products || []).filter(isAvailableProduct);
  const historyProducts = productsFromHistory(history, products);
  const directMentioned = matchProducts(message, products);
  const refersToHistory = /(cai do|mon do|ao do|quan do|san pham do|mau do|no)/.test(normalizeText(message));
  const mentioned = refersToHistory && historyProducts.length
    ? historyProducts
    : directMentioned.length ? directMentioned : historyProducts;
  const ruleIntent = detectRuleIntent(message, mentioned.length > 0);
  const intent = routedIntent && routedIntent !== 'fallback' ? routedIntent : ruleIntent;
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
    const base = 'Bạn vào mục "Thử đồ AI" ở trang sản phẩm rồi bấm "Gợi ý size cho tôi" — Ori sẽ tính theo bảng size thật và số đo bạn nhập.';
    if (mentioned.length) {
      const lines = mentioned.slice(0, 3).map((product) => {
        const sizes = availableSizes(product);
        return `${product.name}: ${sizes.length ? `đang còn ${sizes.join(', ')}` : 'chưa có size còn hàng được khai báo'}`;
      });
      return { message: `${lines.join('\n')}\n${height || weight ? 'Ori sẽ dùng số đo đã lưu để tính trên đúng sản phẩm, không đoán M–L chung cho mọi form. ' : ''}${base}`, productIds: mentioned.map(pid) };
    }
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

  if (intent === 'shopping') {
    const fallback = getHomeRecommendations(state, { userId, limit: 8, profile });
    const pool = directMentioned.length
      ? directMentioned
      : catalogCandidates(message, products, fallback.items || []);
    const under = priceRange(message);
    const detail = [
      under ? `ngân sách tối đa ${money(under)}` : '',
      COLOR_WORDS.filter((word) => normalizeText(message).includes(normalizeText(word))).length ? 'màu bạn nhắc tới' : '',
      OCCASION_WORDS.filter((word) => normalizeText(message).includes(normalizeText(word))).length ? 'đúng dịp sử dụng' : '',
    ].filter(Boolean).join(', ');
    return {
      message: pool.length
        ? `Có nhé. Mình chọn ${pool.length} món đang bán${detail ? ` theo ${detail}` : ' từ catalog JAPANO'}; bạn chạm vào sản phẩm để xem màu, size còn hàng và thử đồ.`
        : 'Catalog hiện chưa có món khớp hoàn toàn. Bạn cho mình thêm loại đồ, màu, dịp mặc hoặc ngân sách để Ori lọc lại nhé.',
      productIds: pool.map(pid),
    };
  }

  // Trả lời kiến thức Nhật Bản trước nhánh lookup: câu như "kimono mặc khi nào"
  // cần một lời giải thích hữu ích, đồng thời vẫn đính kèm sản phẩm liên quan nếu có.
  const knowledge = japanKnowledgeAnswer(message);
  if (knowledge) {
    return { message: knowledge, productIds: mentioned.slice(0, 4).map(pid) };
  }

  if (intent === 'lookup') {
    let pool = mentioned;
    if (under) pool = pool.filter((p) => finiteNumber(p.price, 0) <= under).length ? pool.filter((p) => finiteNumber(p.price, 0) <= under) : pool;
    const cat = pool[0] ? categoryLabel(state, pool[0].cat || pool[0].category) : '';
    return { message: `Mình tìm được ${pool.length} món${cat ? ` trong nhóm ${cat}` : ''} hợp với câu hỏi của bạn:`, productIds: pool.map(pid) };
  }

  const fallback = getHomeRecommendations(state, { userId, limit: 4, profile });
  return { message: 'Mình chưa có đủ dữ kiện để trả lời chính xác câu này. Bạn có thể hỏi lại theo chủ đề cụ thể hơn — ví dụ tên trang phục Nhật, thành phố muốn đến, mùa du lịch, cách di chuyển, món ăn, văn hóa, hoặc nhu cầu phối đồ. Trong lúc đó, đây là vài món hợp gu của bạn:', productIds: fallback.items };
}

function reply(state, { userId = 'guest', message = '', profile, history } = {}) {
  const products = (state.products || []).filter(isAvailableProduct);
  const mentioned = matchProducts(message, products);
  const ruleIntent = detectRuleIntent(message, mentioned.length > 0);
  const trace = routeChatIntent(message, history, ruleIntent);
  // "lookup" là expert dựa trên catalog, không nằm trong prototype intent.
  if (ruleIntent === 'lookup' && trace.confidence < 0.58) trace.intent = 'lookup';
  // Câu mua sắm/catalog có luật rõ phải thắng semantic router. Trước đây router
  // có thể tự tin nhầm sang intent khác rồi trả câu “không đủ dữ kiện”.
  if (['lookup', 'shopping'].includes(ruleIntent)) trace.intent = ruleIntent;
  const result = baseReply(state, { userId, message, profile, history, routedIntent: trace.intent });
  return {
    ...result,
    intent: trace.intent,
    confidence: trace.confidence,
    modelTrace: trace,
  };
}

module.exports = { reply, matchProducts, availableSizes, catalogCandidates, detectRuleIntent };
