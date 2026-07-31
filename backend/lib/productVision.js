const fs = require('fs');

const CATEGORY_LABELS = {
  'ao-truyen-thong': 'trang phục truyền thống Nhật',
  haori: 'áo khoác và trang phục phối nhiều lớp',
  'trang-phuc': 'trang phục mặc hằng ngày',
  'phu-kien': 'phụ kiện hoàn thiện bộ trang phục',
  cosplay: 'trang phục hóa thân theo nhân vật',
};

function cleanText(value, max = 500) {
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

function fallbackProductDescription(product = {}) {
  const name = cleanText(product.name || 'Sản phẩm JAPANO', 120);
  const category = CATEGORY_LABELS[product.cat || product.category] || 'thời trang Nhật';
  const tags = [...new Set([...(product.tags || []), ...(product.visualTags || [])].map((tag) => cleanText(tag, 40)).filter(Boolean))];
  const lower = `${name} ${tags.join(' ')}`.toLowerCase();
  const silhouette = /dáng dài|choàng|kimono|yukata/.test(lower)
    ? 'phom dài tạo đường nét thanh thoát và hiệu ứng phối lớp rõ ràng'
    : /cardigan|len|cổ lọ/.test(lower)
      ? 'phom mềm, dễ mặc nhiều lớp và hợp thời tiết mát'
      : /blazer|sơ mi|đồng phục/.test(lower)
        ? 'đường nét gọn giúp tổng thể chỉn chu nhưng vẫn dễ phối'
        : 'tỉ lệ gọn gàng, dễ làm điểm nhấn cho nhiều bộ trang phục';
  const palette = tags.find((tag) => /(hồng|xanh|đỏ|cam|trắng|kaki|chàm)/i.test(tag));
  const details = [
    `Thiết kế thuộc nhóm ${category}, bám đúng tên sản phẩm “${name}”.`,
    `Điểm nhìn chính là ${silhouette}.`,
    palette ? `Tông ${palette} tạo cá tính rõ mà vẫn dễ phối với màu trung tính.` : 'Bảng màu dễ kết hợp cùng đen, kem, chàm hoặc nâu.',
  ];
  return {
    headline: `${name} — một điểm nhấn Nhật dễ đưa vào tủ đồ`,
    visualSummary: `Dựa trên tên, danh mục và ảnh sản phẩm, mẫu này có ${silhouette}.`,
    details,
    stylingTip: /phu-kien/.test(String(product.cat || product.category))
      ? 'Dùng làm điểm nhấn cuối cùng cho bộ trang phục tối giản; giữ các món còn lại cùng một bảng màu.'
      : 'Phối cùng lớp trong trơn và một phụ kiện nhỏ để giữ đúng tinh thần tối giản Nhật.',
    purchaseReason: `Phù hợp nếu bạn muốn một món ${category} có nhận diện rõ, dễ phối lại nhiều lần thay vì chỉ mặc cho một dịp.`,
    confidence: 'Mô tả được tạo từ dữ liệu sản phẩm; không suy đoán chất liệu chưa được xác nhận.',
    engine: 'catalog-grounded-fallback',
  };
}

const ENGLISH_MARKERS = /\b(?:the|and|with|for|from|this|that|wear|summer|winter|elegant|elegance|minimalist|flair|fabric|cotton|color|colour|belt|tassel|white|blue|navy|dark|black|yellow|purple|pattern|motif|floral|paired|featuring|adorned|complete|look|accessory|handheld|authentic|versatile|design|casual|outings|events|description|seasonal|suitability|high|catalog|grounded|style|screen|screens|street|coach|online|mode|test|checkout|dashboard|admin|database|refund|payment|traditional|interior|simple|hair|soft|material|materials|product|highlighted|effortlessly|complements)\b/i;

function vietnameseOr(value, fallbackValue, max) {
  const text = cleanText(value, max);
  if (!text || ENGLISH_MARKERS.test(text)) return fallbackValue;
  return text;
}

function ensureVietnameseProductDescription(raw, product = {}) {
  const fallback = fallbackProductDescription(product);
  const isVision = raw?.engine === 'qwen3-vl:8b' || raw?.engine === 'thi-giac-san-pham';
  const details = Array.isArray(raw?.details)
    ? [...new Set(raw.details.map((item, index) => vietnameseOr(item, fallback.details[index] || '', 220)).filter(Boolean))].slice(0, 5)
    : fallback.details;
  return {
    headline: vietnameseOr(raw?.headline, fallback.headline, 180),
    visualSummary: vietnameseOr(raw?.visualSummary, fallback.visualSummary, 600),
    details: details.length ? details : fallback.details,
    stylingTip: vietnameseOr(raw?.stylingTip, fallback.stylingTip, 400),
    purchaseReason: vietnameseOr(raw?.purchaseReason, fallback.purchaseReason, 400),
    confidence: vietnameseOr(raw?.confidence, fallback.confidence, 240),
    engine: isVision ? 'thi-giac-san-pham' : fallback.engine,
  };
}

function normalizeVisionResult(raw, fallback, product) {
  if (!raw || typeof raw !== 'object') return fallback;
  const normalized = {
    headline: cleanText(raw.headline, 180) || fallback.headline,
    visualSummary: cleanText(raw.visualSummary, 600) || fallback.visualSummary,
    details: Array.isArray(raw.details) ? raw.details.map((item) => cleanText(item, 220)).filter(Boolean).slice(0, 5) : fallback.details,
    stylingTip: cleanText(raw.stylingTip, 400) || fallback.stylingTip,
    purchaseReason: cleanText(raw.purchaseReason, 400) || fallback.purchaseReason,
    confidence: cleanText(raw.confidence, 240) || 'AI phân tích ảnh; nên đối chiếu mô tả và thông số sản phẩm.',
    engine: 'qwen3-vl:8b',
  };
  return ensureVietnameseProductDescription(normalized, product);
}

async function analyzeProductImage({
  product, imagePath, ollamaUrl, model = 'qwen3-vl:8b', timeoutMs = 120000, signal,
}) {
  const fallback = fallbackProductDescription(product);
  if (!imagePath || !fs.existsSync(imagePath)) return fallback;
  const image = fs.readFileSync(imagePath).toString('base64');
  const prompt = [
    'Bạn là chuyên gia thị giác thời trang và copywriter trung thực cho JAPANO.',
    'Bắt buộc viết toàn bộ nội dung bằng tiếng Việt tự nhiên. Tuyệt đối không dùng câu, tiêu đề hoặc nhãn tiếng Anh.',
    'Phân tích ảnh sản phẩm cùng dữ liệu catalog bên dưới. Tên sản phẩm là ràng buộc chính; không đổi sang loại đồ khác.',
    'Chỉ nói điều nhìn thấy hoặc có trong dữ liệu. Không bịa chất liệu, xuất xứ, công dụng sức khỏe, khuyến mãi hay độ bền.',
    'Viết hấp dẫn nhưng không gây áp lực, không tạo khan hiếm giả.',
    `Tên: ${cleanText(product.name, 140)}`,
    `Danh mục: ${cleanText(product.cat || product.category, 80)}`,
    `Tag catalog: ${[...(product.tags || []), ...(product.visualTags || [])].join(', ')}`,
    `Mô tả catalog: ${cleanText(product.desc, 500)}`,
    'Chỉ trả JSON đúng schema:',
    '{"headline":"...","visualSummary":"...","details":["..."],"stylingTip":"...","purchaseReason":"...","confidence":"..."}',
  ].join('\n');
  const controller = new AbortController();
  const cancelFromQueue = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancelFromQueue();
  else signal?.addEventListener('abort', cancelFromQueue, { once: true });
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
        // Qwen3-VL mặc định có thể dành toàn bộ token budget cho reasoning và
        // không còn content JSON để parser đọc. Endpoint này chỉ cần schema
        // ngắn, nên tắt thinking để luôn nhận phần trả lời cuối.
        think: false,
        messages: [{ role: 'user', content: prompt, images: [image] }],
        options: { temperature: 0.15, num_predict: 900 },
      }),
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    return normalizeVisionResult(parseJsonText(data.message?.content || data.response), fallback, product);
  } catch (error) {
    if (signal?.aborted) throw signal.reason || error;
    return fallback;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelFromQueue);
  }
}

module.exports = { fallbackProductDescription, ensureVietnameseProductDescription, analyzeProductImage, parseJsonText };
