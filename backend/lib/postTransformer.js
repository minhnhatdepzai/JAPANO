// Các khối inference "post-Transformer" nhẹ cho botchat.
//
// - Feature hashing tạo semantic vector cục bộ, không gọi dịch vụ ngoài.
// - mLSTM-style matrix memory giữ ngữ cảnh nhiều lượt bằng outer-product
//   key/value memory và exponential gates.
// - Mixture-of-Experts router trộn luật chính xác, semantic prototype và memory.
//
// Đây là implementation online nhỏ, không phải checkpoint xLSTM/Mamba đã
// pre-train. Tên provenance trong API luôn dùng hậu tố "-style"/"-router".

const TEXT_DIM = 48;

function normalizeText(value) {
  return String(value || '')
    .slice(0, 4000)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function norm(vector) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
}

function normalizeVector(vector) {
  const length = norm(vector);
  return vector.map((value) => value / length);
}

function dot(a, b) {
  let total = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) total += a[index] * b[index];
  return total;
}

function cosine(a, b) {
  return dot(a, b) / (norm(a) * norm(b));
}

function textEmbedding(text) {
  const clean = normalizeText(text);
  const vector = new Array(TEXT_DIM).fill(0);
  if (!clean) return vector;
  const words = clean.split(' ').filter(Boolean);
  const features = [
    ...words.map((word) => [`w:${word}`, 1]),
    ...words.slice(0, -1).map((word, index) => [`b:${word}_${words[index + 1]}`, 1.35]),
  ];
  for (let index = 0; index < clean.length - 2; index += 1) {
    const gram = clean.slice(index, index + 3);
    if (!gram.includes(' ')) features.push([`c:${gram}`, 0.25]);
  }
  features.forEach(([feature, weight]) => {
    const code = hash(feature);
    const first = code % TEXT_DIM;
    const second = ((code >>> 8) + first * 7) % TEXT_DIM;
    vector[first] += (code & 1 ? 1 : -1) * weight;
    vector[second] += (code & 2 ? 1 : -1) * weight * 0.5;
  });
  return normalizeVector(vector);
}

const INTENT_PROTOTYPES = {
  navigation: ['mở trang mua sắm', 'đi tới trang thanh toán', 'cho tôi vào giỏ hàng'],
  travel: ['địa điểm nào đẹp ở nhật', 'gợi ý nơi chụp ảnh tại nhật bản', 'phong cảnh nhật bản nên đi đâu'],
  weather_outfit: ['trời mưa mặc gì', 'phối đồ ngày mưa', 'áo khoác và dù khi trời mưa'],
  greeting: ['xin chào ori', 'chào bạn', 'hello shop'],
  discount: ['mã giảm giá khuyến mãi', 'voucher ưu đãi đang có', 'sản phẩm sale'],
  order: ['đơn hàng của tôi ở đâu', 'kiểm tra giao hàng vận chuyển', 'tình trạng đơn đã đặt'],
  size: ['tư vấn size theo số đo', 'mặc cỡ nào vừa', 'chiều cao cân nặng chọn size'],
  tryon: ['thử đồ bằng ảnh', 'xem trang phục lên người', 'ướm thử quần áo'],
  trend: ['sản phẩm đang thịnh hành', 'món hot bán chạy', 'xu hướng thời trang'],
  outfit: ['gợi ý phối đồ', 'mặc gì cùng sản phẩm này', 'tạo set trang phục'],
  price: ['sản phẩm giá bao nhiêu', 'hỏi giá tiền', 'ngân sách mua đồ'],
  shopping: ['shop có quần áo gì', 'tìm đồ thời trang để mua', 'gợi ý sản phẩm trong cửa hàng'],
};

const PROTOTYPE_VECTORS = new Map(Object.entries(INTENT_PROTOTYPES).map(([intent, phrases]) => {
  const combined = new Array(TEXT_DIM).fill(0);
  phrases.forEach((phrase) => {
    const vector = textEmbedding(phrase);
    for (let index = 0; index < TEXT_DIM; index += 1) combined[index] += vector[index];
  });
  return [intent, normalizeVector(combined)];
}));

function historyText(row) {
  return String(row?.message || row?.content || row?.text || '').slice(0, 1200);
}

function matrixMemory(history, queryVector) {
  const memory = Array.from({ length: TEXT_DIM }, () => new Array(TEXT_DIM).fill(0));
  const normalizer = new Array(TEXT_DIM).fill(0);
  const rows = (history || []).filter((row) => historyText(row)).slice(-12);
  rows.forEach((row, rowIndex) => {
    const value = textEmbedding(historyText(row));
    const roleScale = String(row.role || '').toLowerCase() === 'user' ? 1 : 0.45;
    const recency = Math.exp(-0.16 * (rows.length - 1 - rowIndex));
    const inputGate = roleScale * recency;
    const forgetGate = 0.9 + 0.07 * recency;
    for (let i = 0; i < TEXT_DIM; i += 1) {
      normalizer[i] = forgetGate * normalizer[i] + inputGate * value[i];
      for (let j = 0; j < TEXT_DIM; j += 1) {
        memory[i][j] = forgetGate * memory[i][j] + inputGate * value[i] * value[j];
      }
    }
  });
  const recalled = new Array(TEXT_DIM).fill(0);
  for (let i = 0; i < TEXT_DIM; i += 1) {
    for (let j = 0; j < TEXT_DIM; j += 1) recalled[i] += memory[i][j] * queryVector[j];
  }
  const denominator = Math.max(1, Math.abs(dot(normalizer, queryVector)));
  return normalizeVector(recalled.map((value) => value / denominator));
}

function semanticIntent(vector) {
  let best = { intent: 'fallback', score: 0 };
  PROTOTYPE_VECTORS.forEach((prototype, intent) => {
    const score = Math.max(0, cosine(vector, prototype));
    if (score > best.score) best = { intent, score };
  });
  return best;
}

function routeChatIntent(message, history = [], ruleIntent = 'fallback') {
  const query = textEmbedding(message);
  const recalled = matrixMemory(history, query);
  const semantic = semanticIntent(query);
  const contextual = semanticIntent(recalled);
  const candidates = new Set([ruleIntent, semantic.intent, contextual.intent].filter((intent) => intent && intent !== 'fallback'));
  let best = { intent: ruleIntent || 'fallback', score: ruleIntent !== 'fallback' ? 0.96 : 0 };
  candidates.forEach((intent) => {
    const exact = intent === ruleIntent && ruleIntent !== 'fallback' ? 0.96 : 0;
    const semanticScore = intent === semantic.intent ? semantic.score : 0;
    const memoryScore = intent === contextual.intent ? contextual.score : 0;
    // Sparse MoE gate: luật có độ chính xác cao, semantic giải quyết paraphrase,
    // matrix memory chỉ làm tín hiệu phụ để tránh ngữ cảnh cũ lấn câu hiện tại.
    const score = Math.min(1, exact * 0.58 + semanticScore * 0.32 + memoryScore * 0.1);
    if (score > best.score || best.intent === 'fallback') best = { intent, score };
  });
  if (best.score < 0.2) best = { intent: 'fallback', score: best.score };
  return {
    intent: best.intent,
    confidence: Number(best.score.toFixed(4)),
    semanticIntent: semantic.intent,
    memoryIntent: contextual.intent,
    memoryTurns: Math.min(12, (history || []).length),
    models: ['exact-intent-expert', 'semantic-hashing-expert', 'mlstm-style-matrix-memory', 'sparse-moe-router'],
  };
}

function semanticSimilarity(left, right) {
  if (!left || !right) return 0;
  return Math.max(0, cosine(textEmbedding(left), textEmbedding(right)));
}

module.exports = {
  normalizeText,
  textEmbedding,
  semanticSimilarity,
  routeChatIntent,
};
