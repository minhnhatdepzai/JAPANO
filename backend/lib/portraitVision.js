const STYLE_VOCAB = [
  'lễ hội', 'thanh lịch', 'mùa hè', 'tối giản', 'layer', 'truyền thống', 'dáng dài',
  'công sở', 'nhẹ nhàng', 'học đường', 'streetwear', 'unisex', 'dễ thương', 'ấm',
];
const MOOD_LABELS = {
  vui: 'Bạn trông khá vui vẻ và tràn năng lượng ✦',
  binh_thuong: 'Bạn trông bình thản, sẵn sàng thử vài phong cách mới',
  buon: 'Bạn trông có vẻ hơi buồn hoặc mệt hôm nay',
  met_moi: 'Bạn trông hơi mệt, chắc là một ngày dài',
};

function cleanText(value, max = 300) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseJsonText(value) {
  const text = String(value || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(fenced.slice(start, end + 1)); } catch { return null; }
}

function fallbackPortrait() {
  return {
    mood: 'binh_thuong',
    moodLabel: MOOD_LABELS.binh_thuong,
    ageRange: '',
    styleTags: [],
    cheerUp: null,
    engine: 'fallback',
  };
}

function normalizePortrait(raw) {
  const fallback = fallbackPortrait();
  if (!raw || typeof raw !== 'object') return fallback;
  const mood = ['vui', 'binh_thuong', 'buon', 'met_moi'].includes(raw.mood) ? raw.mood : 'binh_thuong';
  const ageRange = /^(?:<18|18-24|25-34|35-44|45\+)$/.test(String(raw.ageRange || '')) ? raw.ageRange : '';
  const styleTags = Array.isArray(raw.styleTags)
    ? raw.styleTags.map((tag) => cleanText(tag, 30)).filter((tag) => STYLE_VOCAB.includes(tag)).slice(0, 4)
    : [];
  const needsCheerUp = mood === 'buon' || mood === 'met_moi';
  const cheerUp = needsCheerUp && raw.cheerUp && typeof raw.cheerUp === 'object' ? {
    message: cleanText(raw.cheerUp.message, 220) || 'Hôm nay có vẻ hơi mệt, JAPANO ở đây để giúp bạn vui hơn một chút nhé.',
    joke: cleanText(raw.cheerUp.joke, 220),
    destination: cleanText(raw.cheerUp.destination, 260),
  } : null;
  return {
    mood,
    moodLabel: MOOD_LABELS[mood],
    ageRange,
    styleTags,
    cheerUp,
    engine: 'qwen3-vl:8b',
  };
}

async function analyzePortrait({ imageBase64, ollamaUrl, model = 'qwen3-vl:8b', timeoutMs = 60000 }) {
  const fallback = fallbackPortrait();
  if (!imageBase64) return fallback;
  const image = String(imageBase64).replace(/^data:[^;]+;base64,/, '');
  const prompt = [
    'Bạn là trợ lý phong cách thân thiện của JAPANO, một cửa hàng thời trang phong cách Nhật tại Việt Nam.',
    'Nhìn ảnh chân dung/khuôn mặt người dùng và ước lượng: tâm trạng và độ tuổi. Đây là ước lượng tương đối, không phải chẩn đoán y khoa hay khẳng định tuyệt đối.',
    'Bắt buộc viết toàn bộ nội dung bằng tiếng Việt tự nhiên, gần gũi, không dùng tiếng Anh.',
    'Không bình luận về ngoại hình, cân nặng, khuyết điểm. Chỉ tập trung vào cảm xúc/biểu cảm khuôn mặt và ước lượng độ tuổi.',
    `Chọn mood là một trong: vui, binh_thuong, buon, met_moi.`,
    `Chọn ageRange là một trong: <18, 18-24, 25-34, 35-44, 45+ (để trống nếu không đủ căn cứ).`,
    `Chọn tối đa 4 styleTags PHẢI lấy nguyên văn từ danh sách sau (không tự bịa từ khác): ${STYLE_VOCAB.join(', ')}.`,
    'Nếu mood là buon hoặc met_moi: điền thêm cheerUp gồm message (một câu động viên ngắn, ấm áp), joke (một câu đùa nhẹ nhàng, vô hại, không chế giễu người dùng), và destination (một gợi ý ngắn kiểu "nếu có dịp ghé Nhật Bản, có thể thử tới ___ để đổi gió" — tên địa danh thật ở Nhật Bản, có thật). Nếu mood là vui hoặc binh_thuong thì để cheerUp là null.',
    'Chỉ trả JSON đúng schema, không thêm chữ nào khác:',
    '{"mood":"...","ageRange":"...","styleTags":["..."],"cheerUp":null}',
  ].join('\n');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${ollamaUrl.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: [{ role: 'user', content: prompt, images: [image] }],
        options: { temperature: 0.2, num_predict: 900 },
      }),
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    return normalizePortrait(parseJsonText(data.message?.content || data.response));
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { analyzePortrait, STYLE_VOCAB };
