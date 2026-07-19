const DEFAULT_MODEL = process.env.JAPANO_REVIEW_MODERATION_MODEL || 'qwen2.5:7b';

const LEET = Object.freeze({
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't',
});

const RULES = [
  { category: 'công kích', severity: 0.96, phrases: ['do ngu', 'ngu ngoc', 'oc cho', 'oc lon', 'mat day', 'vo hoc', 'khon nan', 'suc vat', 'rac ruoi', 'phe vat', 'thang ngu', 'con ngu', 'shop ngu', 'chu shop ngu'] },
  { category: 'tục tĩu', severity: 0.95, phrases: ['dmm', 'dm may', 'dit me', 'du ma', 'con cac', 'cai lon', 'vai lon', 'clm', 'cc may'] },
  { category: 'đe doạ', severity: 0.99, phrases: ['giet may', 'danh may', 'tim den nha', 'cho may chet', 'xu may', 'dap shop', 'dot shop'] },
  { category: 'phân biệt đối xử', severity: 0.99, phrases: ['dan bac ky', 'dan nam ky', 'do nha que', 'do dan toc', 'khuyet tat ma', 'be de', 'do gay', 'do les', 'do da den'] },
  { category: 'hạ nhục', severity: 0.92, phrases: ['khong bang con', 'an hai', 'do bo di', 'do vo dung', 'that nhuc nha', 'nhin nhu an xin', 'ban hang nhu an cuop'] },
];

const TARGETS = ['shop', 'chu shop', 'nhan vien', 'may', 'mày', 'no', 'nó', 'bon nay', 'lũ này', 'nguoi ban'];
const NEGATIVE_ATTACKS = ['ngu', 'dot', 'mat day', 'vo hoc', 'khon nan', 'lua gat', 'rac', 'vo dung', 'an hai', 'bo di', 'suc vat'];

function stripMarks(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function normalizeForModeration(value) {
  let text = stripMarks(value).toLowerCase();
  text = [...text].map((char) => LEET[char] || char).join('');
  text = text.replace(/([a-z])\1{2,}/g, '$1$1');
  text = text.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text;
}

function compact(value) {
  return normalizeForModeration(value).replace(/\s+/g, '');
}

function phraseMatch(text, phrase) {
  const normalizedPhrase = normalizeForModeration(phrase);
  if (!normalizedPhrase) return false;
  const padded = ` ${text} `;
  if (padded.includes(` ${normalizedPhrase} `)) return true;
  const compactText = text.replace(/\s+/g, '');
  const compactPhrase = normalizedPhrase.replace(/\s+/g, '');
  return compactPhrase.length >= 3 && compactText.includes(compactPhrase);
}

function learnedPhrases(samples = []) {
  return samples
    .filter((sample) => sample?.label === 'rejected')
    .flatMap((sample) => sample.learnedPhrases || [sample.normalizedText])
    .map(normalizeForModeration)
    .filter((value) => value.length >= 3)
    .slice(-400);
}

function localModeration(text, samples = []) {
  const normalized = normalizeForModeration(text);
  const matches = [];
  for (const rule of RULES) {
    for (const phrase of rule.phrases) {
      if (phraseMatch(normalized, phrase)) matches.push({ category: rule.category, phrase, severity: rule.severity });
    }
  }
  for (const phrase of learnedPhrases(samples)) {
    if (phraseMatch(normalized, phrase)) matches.push({ category: 'mẫu vi phạm đã học', phrase, severity: 0.94 });
  }
  const targetAttack = TARGETS.some((target) => phraseMatch(normalized, target))
    && NEGATIVE_ATTACKS.some((attack) => phraseMatch(normalized, attack));
  if (targetAttack) matches.push({ category: 'công kích có chủ đích', phrase: 'mục tiêu + lời hạ nhục', severity: 0.94 });

  const score = matches.reduce((maximum, match) => Math.max(maximum, match.severity), 0);
  return {
    normalized,
    compact: compact(text),
    score,
    decision: score >= 0.75 ? 'rejected' : score >= 0.4 ? 'pending' : 'approved',
    categories: [...new Set(matches.map((match) => match.category))],
    matches,
  };
}

function extractJson(raw) {
  const text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || text.match(/\{[\s\S]*\}/)?.[0] || '';
  try { return JSON.parse(candidate); } catch { return null; }
}

async function semanticModeration(text, { ollamaUrl, model = DEFAULT_MODEL, timeoutMs = 45000 } = {}) {
  if (!ollamaUrl) return { available: false, reason: 'Chưa cấu hình Ollama.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const prompt = [
      'Bạn là mô hình kiểm duyệt bình luận thương mại điện tử tiếng Việt.',
      'Phát hiện cả cách lách luật: viết tắt, chen ký tự, số thay chữ, bỏ dấu, đảo cụm từ, nói mỉa, ám chỉ hạ nhục, công kích cá nhân, phân biệt vùng miền/giới/khuyết tật, đe doạ.',
      'Không chặn phê bình sản phẩm hợp lệ, ví dụ: giao chậm, vải xấu, không đúng mô tả, nghi ngờ lừa đảo nếu người dùng mô tả trải nghiệm mà không hạ nhục cá nhân.',
      'Chỉ trả JSON: {"harmful":boolean,"confidence":0..1,"categories":string[],"reason":string}.',
      `Bình luận cần kiểm duyệt: ${JSON.stringify(String(text || '').slice(0, 2000))}`,
    ].join('\n');
    const response = await fetch(`${String(ollamaUrl).replace(/\/+$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json', keep_alive: '0', options: { temperature: 0, num_predict: 180 } }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const data = await response.json();
    const parsed = extractJson(data.response);
    if (!parsed || typeof parsed.harmful !== 'boolean') throw new Error('Mô hình không trả JSON hợp lệ.');
    return {
      available: true,
      model,
      harmful: parsed.harmful,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      categories: Array.isArray(parsed.categories) ? parsed.categories.map(String).slice(0, 8) : [],
      reason: String(parsed.reason || '').slice(0, 500),
    };
  } catch (error) {
    return { available: false, model, reason: error.name === 'AbortError' ? 'Mô hình phản hồi quá lâu.' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function moderateReview(text, options = {}) {
  const local = localModeration(text, options.samples || []);
  if (local.decision === 'rejected') {
    return { decision: 'rejected', score: local.score, engine: 'bộ lọc chống lách luật', local, semantic: null, reason: local.categories.join(', ') };
  }
  const semantic = await semanticModeration(text, options);
  if (semantic.available && semantic.harmful && semantic.confidence >= 0.62) {
    return { decision: 'rejected', score: Math.max(local.score, semantic.confidence), engine: semantic.model, local, semantic, reason: semantic.reason || semantic.categories.join(', ') };
  }
  if (local.decision === 'pending' || (semantic.available && semantic.harmful)) {
    return { decision: 'pending', score: Math.max(local.score, semantic.confidence || 0), engine: semantic.model || 'bộ lọc chống lách luật', local, semantic, reason: semantic.reason || local.categories.join(', ') };
  }
  return { decision: 'approved', score: Math.max(local.score, semantic.confidence || 0), engine: semantic.model || 'bộ lọc chống lách luật', local, semantic, reason: 'Không phát hiện công kích hoặc nội dung nhạy cảm.' };
}

module.exports = { normalizeForModeration, localModeration, semanticModeration, moderateReview, DEFAULT_MODEL };
