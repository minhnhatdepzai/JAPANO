const { finiteNumber, productId: pid } = require('./analytics');
const { getHomeRecommendations } = require('./recommend');
const { composeOutfit, todaysOutfit } = require('./outfit');
const { japanKnowledgeAnswer } = require('./japanKnowledge');
const { SCENES } = require('./japanScenes');
const { routeChatIntent, semanticSimilarity, normalizeText } = require('./postTransformer');
const { describeDay, seasonFromMessage, seasonalPicks, upcomingHolidays, SEASON_NOTE } = require('./calendarVi');

const INTENTS = [
  { name: 'greeting', test: /\b(chào|hi|hello|xin chào|alo)\b/i },
  { name: 'discount', test: /(giảm giá|khuyến mãi|voucher|mã giảm|sale|ưu đãi)/i },
  { name: 'order', test: /(đơn hàng|đơn của tôi|đã đặt|tình trạng đơn|giao hàng|ship tới đâu|vận chuyển)/i },
  { name: 'size', test: /(size|kích thước|mặc vừa|số đo|vòng ngực|vòng eo)/i },
  { name: 'tryon', test: /(thử đồ|thử ảnh|ướm thử|xem thử lên người)/i },
  { name: 'trend', test: /(hot|bán chạy|xu hướng|trend|nổi bật|hot trend)/i },
  // `date` và `season_outfit` phải đứng TRƯỚC `outfit`: INTENTS.find lấy khớp
  // đầu tiên, mà "mùa đông nên mặc gì" cũng khớp /mặc gì/ của `outfit` rồi trả
  // về một set ghép theo màu, không hề nhắc tới mùa.
  { name: 'date', test: /(hôm nay.*(ngày|thứ|lễ|dịp)|(ngày|thứ|lễ) gì hôm nay|hôm nay là ngày|bây giờ là ngày|mấy giờ rồi|hôm nay ngày mấy|nay ngày mấy|hôm nay thứ mấy)/i },
  // Hỏi lễ sắp tới từng bị semantic router đẩy sang `travel` và trả về danh sách
  // phong cảnh Nhật Bản. Có luật rõ ở đây thì luật thắng router.
  { name: 'holiday_soon', test: /((sắp tới|sap toi|sắp có|tháng này|thang nay|tuần này|tuan nay|gần đây).*(lễ|le |dịp|dip)|(lễ|dịp) gì (sắp|sap|tới|toi)|có lễ gì)/i },
  { name: 'season_outfit', test: /(mùa (đông|hè|hạ|thu|xuân)|mua (dong|he|thu|xuan)|trời (lạnh|nóng)|troi (lanh|nong)|rét|nắng nóng|oi bức|se lạnh|nồm|mưa phùn)/i },
  { name: 'outfit', test: /(phối|mặc gì|phối đồ|outfit|set đồ|đi kèm|lên đồ)/i },
  { name: 'price', test: /(giá|bao nhiêu tiền|giá bao nhiêu|nhiêu tiền)/i },
  { name: 'shopping', test: /(shop|cửa hàng|sản phẩm|quần áo|áo quần|đồ mặc|thời trang|mua đồ|mua áo|mua quần|có đồ|có áo|có quần|đồ hàng|hàng nào)/i },
];

const COLOR_WORDS = ['đen','trắng','đỏ','hồng','xanh','vàng','nâu','be','tím','cam','xám','chàm'];
const OCCASION_WORDS = ['công sở','đi làm','đi học','lễ hội','matsuri','tốt nghiệp','đám cưới','hẹn hò','mặc nhà','du lịch','chụp ảnh','mùa hè','mùa đông'];
const NAVIGATION_ACTIONS = [
  { id:'open_checkout', label:'Tới trang thanh toán', test: /(thanh toan|checkout|tra tien|tinh tien|chot don)/ },
  { id:'open_cart', label:'Mở giỏ hàng', test: /(gio hang|gio cua toi)/ },
  { id:'open_wishlist', label:'Mở danh sách yêu thích', test: /(yeu thich|wishlist)/ },
  { id:'open_orders', label:'Mở đơn hàng của tôi', test: /(don hang|lich su mua|don da mua)/ },
  { id:'open_explore_japan', label:'Mở Khám phá Nhật Bản', test: /(kham pha nhat|du lich nhat|dia diem nhat|phong canh nhat)/ },
  { id:'open_tryon', label:'Mở Thử đồ AI', test: /(thu do ai|thu do|uom thu)/ },
  { id:'open_shop', label:'Mở trang mua sắm', test: /(mua sam|cua hang|shop|catalog|trang san pham)/ },
];
const DEFAULT_TRAVEL_SCENE_IDS = [
  'fushimi-inari-senbon-torii',
  'kawaguchi-lakeside-promenade',
  'arashiyama-bamboo-path',
  'shibuya-sky-roof-deck',
  'nara-park-lawn',
];

function isTravelQuestion(message) {
  const normalized = normalizeText(message);
  return /(dia diem|noi|cho|canh|phong canh).*(nao|dep|goi y|nen di|chup anh)|((nao|dep|goi y|nen di).*(dia diem|noi|cho|canh|phong canh))|di dau.*nhat/.test(normalized);
}

function isRainQuestion(message) {
  const raw = String(message || '').toLowerCase();
  if (/mưa/.test(raw)) return true;
  const normalized = normalizeText(message);
  // Không coi "mua sắm/mua đồ" là thời tiết khi người dùng gõ không dấu.
  return /(troi|ngay|luc).{0,12}\bmua\b|\bmua (phun|rao|lon|nho)\b|\b(ao mua|chong mua|am uot|troi xau)\b/.test(normalized);
}

function navigationActionFor(message) {
  const normalized = normalizeText(message);
  const explicit = /(^|\b)(mo|vao|di toi|toi trang|dua toi|dan toi|chuyen toi|cho toi toi|cho toi vao|cho toi mo|toi muon vao|toi muon mo|toi muon xem|xem trang|tinh tien|chot don)\b/.test(normalized);
  if (!explicit) return null;
  const found = NAVIGATION_ACTIONS.find((action) => action.test.test(normalized));
  return found ? { id:found.id, label:found.label, auto:true } : null;
}

function detectRuleIntent(message, hasMentionedProduct = false) {
  // Câu hỏi phong cảnh phải được trả lời; chỉ lệnh "mở/đi tới" mới điều hướng.
  if (isTravelQuestion(message)) return 'travel';
  if (isRainQuestion(message)) return 'weather_outfit';
  if (navigationActionFor(message)) return 'navigation';
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

function hasLexicalProductMention(message, products) {
  const normalized = normalizeText(message);
  const garment = normalized.match(/\b(yukata|kimono|haori|hakama|jinbei|samue|noragi|happi|obi|kanzashi|furoshiki|cardigan|blazer)\b/)?.[1];
  if (garment && products.some((product) => normalizeText([product.name, product.garmentType, product.cat].filter(Boolean).join(' ')).includes(garment))) return true;
  return products.some((product) => {
    const name = normalizeText(product.name);
    const kanji = normalizeText(product.kanji);
    return (name.length >= 5 && normalized.includes(name)) || (kanji.length >= 2 && normalized.includes(kanji));
  });
}

function priceRange(message) {
  const text = String(message || '').toLowerCase();
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu)/);
  if (!m) return null;
  const unit = m[2].startsWith('tr') ? 1000000 : 1000;
  return Number(m[1].replace(',', '.')) * unit;
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

function catalogCandidates(message, products, fallbackIds = [], limit = 4) {
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
  return (eligible.length ? eligible : scored).slice(0, limit).map((row) => row.product);
}

function budgetOutfit(message, products, budget) {
  const normalized = normalizeText(message);
  const officeQuery = /(di lam|cong so|van phong)/.test(normalized);
  const officePriority = ['so-mi-trang', 'chan-vay-xep-ly', 'blazer-kaki', 'ao-len-cardigan', 'cardigan-dai', 'giay-dep'];
  const ranked = catalogCandidates(message, products, [], 16);
  const candidates = officeQuery
    ? [
      ...officePriority.map((id) => products.find((product) => String(pid(product)) === id)).filter(Boolean),
      ...ranked.filter((product) => !officePriority.includes(String(pid(product)))),
    ]
    : ranked;
  const selected = [];
  let total = 0;
  for (const product of candidates) {
    const price = finiteNumber(product.price, 0);
    if (price <= 0 || total + price > budget) continue;
    selected.push(product);
    total += price;
    if (officeQuery && selected.length >= 3) break;
    if (selected.length >= 4) break;
  }
  return { items:selected, totalPrice:total };
}

function weatherCandidates(message, products, limit = 4) {
  const under = priceRange(message);
  const rainPriority = new Map([
    ['du-nhat', 100],
    ['blazer-kaki', 90],
    ['ao-len-cardigan', 80],
    ['cardigan-dai', 70],
    ['khoac-nhat', 60],
    ['noragi-denim', 50],
  ]);
  return products
    .filter((product) => !under || finiteNumber(product.price, 0) <= under)
    .map((product) => {
      const id = String(pid(product));
      const text = normalizeText([
        product.name, product.cat, product.category, product.garmentType,
        ...(product.tags || []), ...(product.visualTags || []), product.desc, product.description,
      ].filter(Boolean).join(' '));
      let score = rainPriority.get(id) || semanticSimilarity(message, text);
      if (id === 'du-nhat') score += 9;
      if (/(ao khoac|khoac ngoai|cardigan|blazer|haori|noragi)/.test(text)) score += 4;
      if (/(giay|dep|phu kien)/.test(text)) score += 0.7;
      if (/(jinbei|mua he|bikini|do boi)/.test(text)) score -= 8;
      return { product, score };
    })
    .sort((left, right) => right.score - left.score || finiteNumber(left.product.price, 0) - finiteNumber(right.product.price, 0))
    .slice(0, limit)
    .map((row) => row.product);
}

function recommendJapanPlaces(message, limit = 5) {
  const normalized = normalizeText(message);
  const queryWords = normalized.split(' ').filter((word) => word.length >= 3);
  const defaultRank = new Map(DEFAULT_TRAVEL_SCENE_IDS.map((id, index) => [id, DEFAULT_TRAVEL_SCENE_IDS.length - index]));
  const scored = SCENES.map((scene) => {
    const text = normalizeText([
      scene.spotPlace, scene.spotPrefecture, scene.name, scene.mood, scene.timeOfDay,
      scene.season, scene.groundType, scene.wardrobeNote,
    ].filter(Boolean).join(' '));
    let score = (defaultRank.get(scene.id) || 0) * 0.2;
    for (const word of queryWords) if (text.includes(word)) score += 0.45;
    if (/(dem|toi|neon|den long)/.test(normalized) && /(evening|night|neon|den long)/.test(text)) score += 4;
    if (/(mua thu|la do|la vang)/.test(normalized) && /(autumn|la thu|la vang)/.test(text)) score += 4;
    if (/(co kinh|truyen thong|kimono)/.test(normalized) && /(co kinh|truyen thong|den|chua|kimono)/.test(text)) score += 3;
    if (/(thien nhien|nui|ho|rung)/.test(normalized) && /(nui|ho|rung|tre|co)/.test(text)) score += 3;
    return { scene, score };
  }).sort((left, right) => right.score - left.score);
  const seen = new Set();
  const selected = [];
  for (const row of scored) {
    const key = `${row.scene.spotPlace}::${row.scene.spotPrefecture}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(row.scene);
    if (selected.length >= limit) break;
  }
  return selected;
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
  const ruleIntent = detectRuleIntent(message, hasLexicalProductMention(message, products) || (refersToHistory && historyProducts.length > 0));
  const intent = routedIntent && routedIntent !== 'fallback' ? routedIntent : ruleIntent;
  const under = priceRange(message);

  if (intent === 'navigation') {
    const action = navigationActionFor(message);
    if (!action) return { message: 'Bạn muốn Ori mở trang mua sắm, giỏ hàng, thanh toán, yêu thích, đơn hàng, thử đồ hay Khám phá Nhật Bản?', productIds: [], actions: [] };
    return { message: `Được nhé, Ori đang ${action.label.toLowerCase()} cho bạn.`, productIds: [], actions: [action] };
  }

  if (intent === 'travel') {
    const places = recommendJapanPlaces(message);
    const lines = places.map((scene, index) => `${index + 1}. ${scene.spotPlace} (${scene.spotPrefecture}) — ${scene.mood.toLowerCase()}, đứng trên ${scene.groundType}; ${scene.wardrobeNote}`);
    return {
      message: `Nếu muốn vừa tham quan vừa chụp/thử đồ đẹp, Ori chọn từ 36 góc phong cảnh đã duyệt:\n${lines.join('\n')}`,
      productIds: [],
      actions: [{ id:'open_explore_japan', label:'Mở Khám phá Nhật Bản', auto:false }],
    };
  }

  // "Hôm nay là ngày gì" — trả lời đúng câu hỏi trước, rồi mới bán hàng.
  if (intent === 'date') {
    const today = describeDay();
    const picks = seasonalPicks(products, today.season, 3);
    const lead = today.holiday
      ? `Hôm nay là ${today.dateText} — ${today.holiday}.`
      : `Hôm nay là ${today.dateText}.`;
    const seasonLine = `Đang là mùa ${today.season}, ${today.seasonNote}.`;
    const outfitLine = picks.length
      ? ` Vậy nên mặc gì cho hợp: ${picks.map((product) => `${product.name} (${money(product.price)})`).join(', ')}.`
      : ' Kho đang thiếu món đúng mùa, bạn xem tạm mấy gợi ý bên dưới nhé.';
    return {
      message: `${lead} ${seasonLine}${outfitLine}`,
      productIds: picks.map(pid),
      actions: [{ id:'open_shop', label:'Xem đồ hợp mùa', auto:false }],
    };
  }

  if (intent === 'holiday_soon') {
    const today = describeDay();
    const soon = upcomingHolidays(new Date(), 60, 3);
    if (!soon.length) {
      const picks = seasonalPicks(products, today.season, 3);
      return {
        message: `Trong 60 ngày tới mình không thấy ngày lễ dương lịch nào trong danh sách. Hôm nay là ${today.dateText}, đang mùa ${today.season}.${picks.length ? ` Mặc gì cho hợp thì: ${picks.map((product) => product.name).join(', ')}.` : ''} Lưu ý: mình chưa tra được lễ theo âm lịch như Tết hay Trung thu.`,
        productIds: picks.map(pid),
      };
    }
    const next = soon[0];
    const picks = seasonalPicks(products, next.season, 3);
    const list = soon.map((item) => `${item.name} (${item.dateText}, còn ${item.inDays} ngày)`).join('; ');
    return {
      message: `Sắp tới có: ${list}. Gần nhất là ${next.name} — rơi vào mùa ${next.season}, nên chuẩn bị: ${picks.map((product) => `${product.name} (${money(product.price)})`).join(', ')}. Mình chỉ tra được lễ dương lịch, chưa tính được Tết hay Trung thu theo âm lịch.`,
      productIds: picks.map(pid),
      actions: [{ id:'open_shop', label:'Xem đồ cho dịp lễ', auto:false }],
    };
  }

  // Hỏi theo mùa: phải NÓI RA mùa và lý do, rồi mới tới sản phẩm.
  if (intent === 'season_outfit') {
    const today = describeDay();
    const asked = seasonFromMessage(message) || today.season;
    const picks = seasonalPicks(products, asked, 4);
    if (!picks.length) {
      return {
        message: `Mùa ${asked} thì ${SEASON_NOTE[asked]}. Hiện shop chưa có món nào gắn đúng mùa ${asked} còn hàng — bạn thử hỏi mình theo dịp (đi làm, lễ hội, du lịch) để mình tìm cách khác nhé.`,
        productIds: [],
      };
    }
    const isNow = asked === today.season;
    const timeLine = isNow
      ? `Đang là mùa ${asked} — ${SEASON_NOTE[asked]}.`
      : `Mùa ${asked} thì ${SEASON_NOTE[asked]}.`;
    return {
      message: `${timeLine} Mấy món này hợp nhất trong shop: ${picks.map((product) => `${product.name} (${money(product.price)})`).join(', ')}. Bạn muốn mình ghép nguyên set quanh một món thì nói tên món đó nhé.`,
      productIds: picks.map(pid),
      actions: [{ id:'open_shop', label:`Xem đồ mùa ${asked}`, auto:false }],
    };
  }

  if (intent === 'weather_outfit') {
    const pool = weatherCandidates(message, products);
    const named = pool.map((product) => `${product.name} (${money(product.price)})`).join(', ');
    return {
      message: `Trời mưa nên ưu tiên một lớp áo khoác nhẹ, màu ít lộ vết nước và mang dù; tránh chọn set mùa hè mỏng như Jinbei. Các món phù hợp nhất đang bán là: ${named}.`,
      productIds: pool.map(pid),
      actions: [{ id:'open_shop', label:'Xem thêm đồ phù hợp trời mưa', auto:false }],
    };
  }

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
    if (!orders.length) return { message: 'Mình chưa thấy đơn hàng nào gắn với tài khoản này. Bạn có thể mở lịch sử đơn để kiểm tra nhé.', productIds: [], actions: [{ id:'open_orders', label:'Mở đơn hàng của tôi', auto:false }] };
    const latest = orders[0];
    return { message: `Đơn ${latest.code} đang ở trạng thái "${latest.status}", tổng ${money(latest.total)}. Mở chi tiết đơn hàng nhé.`, productIds: [], actions: [{ id:'open_orders', label:'Mở đơn hàng của tôi', auto:false }] };
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
    return {
      message: 'Bạn mở Thử đồ AI để chụp hoặc tải ảnh từ thư viện và xem trang phục lên người nhé — Ori sẽ ghép giúp bạn.',
      productIds: mentioned.map(pid),
      actions: [{ id:'open_tryon', label:'Mở Thử đồ AI', auto:false, ...(mentioned[0] ? { productId:String(pid(mentioned[0])) } : {}) }],
    };
  }

  if (intent === 'trend') {
    const trending = getHomeRecommendations(state, { userId: 'guest', limit: 4 });
    return { message: 'Đang thịnh hành ở JAPANO có mấy món này nè:', productIds: trending.items };
  }

  if (intent === 'outfit') {
    if (under) {
      const budgetSet = budgetOutfit(message, products, under);
      if (!budgetSet.items.length) return { message: `Mình chưa tìm được món còn hàng trong ngân sách ${money(under)}. Bạn thử tăng ngân sách hoặc đổi loại trang phục nhé.`, productIds: [] };
      return {
        message: `Mình giữ cả set trong ngân sách tối đa ${money(under)} — tổng hiện tại ${money(budgetSet.totalPrice)}. Set gồm: ${budgetSet.items.map((product) => `${product.name} (${money(product.price)})`).join(', ')}. Bạn có thể đổi size/màu rồi thêm giỏ.`,
        productIds: budgetSet.items.map(pid),
        actions: [{ id:'open_shop', label:'Mở trang mua sắm', auto:false }],
      };
    }
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
      actions: [{ id:'open_shop', label:'Mở trang mua sắm', auto:false }],
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

function reply(state, { userId = 'guest', message = '', profile, history, plannedIntent, plannedConfidence } = {}) {
  const products = (state.products || []).filter(isAvailableProduct);
  const mentioned = matchProducts(message, products);
  const normalized = normalizeText(message);
  const refersToHistory = /(cai do|mon do|ao do|quan do|san pham do|mau do|no)/.test(normalized);
  const ruleIntent = detectRuleIntent(message, hasLexicalProductMention(message, products) || refersToHistory);
  const trace = routeChatIntent(message, history, ruleIntent);
  // "lookup" là expert dựa trên catalog, không nằm trong prototype intent.
  if (ruleIntent === 'lookup' && trace.confidence < 0.58) trace.intent = 'lookup';
  // Câu mua sắm/catalog có luật rõ phải thắng semantic router. Trước đây router
  // có thể tự tin nhầm sang intent khác rồi trả câu “không đủ dữ kiện”.
  if (ruleIntent !== 'fallback') {
    trace.intent = ruleIntent;
    trace.confidence = Math.max(0.96, Number(trace.confidence || 0));
  } else if (plannedIntent && plannedIntent !== 'fallback') {
    trace.intent = plannedIntent;
    trace.confidence = Math.max(0.65, Math.min(1, Number(plannedConfidence || 0.75)));
    trace.models = [...new Set([...(trace.models || []), 'qwen3-vl-intent-planner'])];
  }
  trace.ruleIntent = ruleIntent;
  const result = baseReply(state, { userId, message, profile, history, routedIntent: trace.intent });
  return {
    ...result,
    intent: trace.intent,
    confidence: trace.confidence,
    modelTrace: trace,
  };
}

module.exports = {
  reply, matchProducts, availableSizes, catalogCandidates, detectRuleIntent,
  navigationActionFor, recommendJapanPlaces, weatherCandidates, hasLexicalProductMention,
};
