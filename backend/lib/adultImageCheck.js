// Kiểm tra ảnh có phải người trưởng thành hay không — dùng riêng cho cổng 18+.
//
// Vì sao không dùng lại `analyzePortrait`: prompt đó phục vụ tư vấn phong cách,
// được dặn "không bình luận về ngoại hình" và cho phép để trống độ tuổi. Đo
// thực tế trên ảnh người lớn rõ mặt, nó trả `ageRange: ""` sau 67 giây — tức là
// dùng nó làm cổng an toàn thì mọi lượt hợp lệ đều bị từ chối.
//
// Ở đây hỏi đúng MỘT câu nhị phân, prompt ngắn, `num_predict` nhỏ, nên vừa
// nhanh hơn nhiều vừa cho câu trả lời dùng được. Câu hỏi cố ý KHÔNG phải là
// "người này bao nhiêu tuổi" — hệ thống không đoán tuổi, chỉ hỏi có đủ căn cứ
// để tin đây là người trưởng thành hay không.

// Prompt cố ý NGẮN và một dòng. Bản dài nhiều dòng kèm num_predict thấp làm
// model trả về chuỗi rỗng; đo thực tế bản này trả lời trong ~3–4 giây.
const PROMPT = 'Look at the main person. Is this clearly an adult (18+)? '
  + 'Reply with only one word: yes, no, or unsure.';

function parseAnswer(text) {
  const raw = String(text || '').trim();
  if (!raw) return 'unsure';
  // Model chọn tên khoá tuỳ hứng ("adult", "answer", "result"...), nên nhận mọi
  // khoá thay vì cứng một cái — đúng lỗi từng khiến câu trả lời "yes" hợp lệ bị
  // đọc thành "unsure".
  try {
    const start = raw.indexOf('{');
    if (start >= 0) {
      const parsed = JSON.parse(raw.slice(start, raw.lastIndexOf('}') + 1));
      for (const value of Object.values(parsed)) {
        const answer = String(value).trim().toLowerCase();
        if (['yes', 'no', 'unsure'].includes(answer)) return answer;
      }
    }
  } catch { /* rơi xuống dò chuỗi */ }
  const lowered = raw.toLowerCase();
  if (/\bno\b/.test(lowered)) return 'no';
  if (/\byes\b/.test(lowered)) return 'yes';
  return 'unsure';
}

/**
 * @returns {{available:boolean, verdict:'yes'|'no'|'unsure', ms:number, error?:string}}
 *   `available=false` nghĩa là KHÔNG kiểm tra được (service chết, quá hạn) —
 *   khác hẳn với `verdict='unsure'` nghĩa là đã hỏi nhưng model không dám kết
 *   luận. Cả hai đều dẫn tới từ chối, nhưng thông báo cho người dùng khác nhau.
 */
async function checkAdultImage({ imageBase64, ollamaUrl, model, timeoutMs }) {
  const started = Date.now();
  const base = String(ollamaUrl || process.env.JAPANO_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const visionModel = model || process.env.JAPANO_VISION_MODEL || 'qwen3-vl:8b';
  const limit = Number(timeoutMs || process.env.JAPANO_ADULT_CHECK_TIMEOUT_MS || 120000);
  if (!imageBase64) return { available: false, verdict: 'unsure', ms: 0, error: 'no_image' };
  const image = String(imageBase64).replace(/^data:[^;]+;base64,/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limit);
  try {
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: visionModel,
        stream: false,
        format: 'json',
        messages: [{ role: 'user', content: PROMPT, images: [image] }],
        // Câu trả lời chỉ vài token, nhưng để quá thấp thì model trả rỗng.
        options: { temperature: 0, num_predict: 80 },
      }),
    });
    if (!response.ok) {
      return { available: false, verdict: 'unsure', ms: Date.now() - started, error: `http_${response.status}` };
    }
    const data = await response.json();
    return {
      available: true,
      verdict: parseAnswer(data.message?.content || data.response),
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      available: false,
      verdict: 'unsure',
      ms: Date.now() - started,
      error: error?.name === 'AbortError' ? 'timeout' : String(error?.message || 'error').slice(0, 80),
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { checkAdultImage, parseAnswer, PROMPT };
