// Semantic embeddings thật — gọi sang embedding_service.py (sentence-transformer
// đa ngôn ngữ, ƯU TIÊN CUDA và chỉ rơi về CPU khi máy không có GPU — cùng
// device-selection pattern với fashn_service.py/catvton_service.py) thay vì
// chạy CPU-only trong tiến trình Node. Bắt được sản phẩm "cùng chủ đề" mà so
// khớp tag/từ khoá không thấy được (vd "Kimono hồng" ~ "Yukata xanh" vì cùng
// trang phục truyền thống, dù hai sản phẩm không chung tag nào). Service này
// tuỳ chọn — không cấu hình/không chạy thì chỉ mất tín hiệu semantic, pipeline
// gợi ý MoE chính (recommend.js/advancedRecommend.js) không hề bị ảnh hưởng.
const { fetchWithTimeout, serviceHealth } = require('./httpFetch');
const { EMBEDDING_URL } = require('./serviceUrls');
const { logger } = require('./logger');

function productText(product) {
  const parts = [
    product?.name,
    product?.cat || product?.category,
    ...(Array.isArray(product?.tags) ? product.tags : []),
    ...(Array.isArray(product?.visualTags) ? product.visualTags : []),
  ].filter(Boolean);
  return parts.join(', ');
}

function contentHash(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Vector đã normalize ở embedding_service.py nên dot product chính là cosine similarity.
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

let serviceStatus = { checkedAt: 0, online: null, device: null, cuda: false, model: null };
function applyHealth(online, detail) {
  serviceStatus = {
    checkedAt: Date.now(),
    online,
    device: detail?.device ?? serviceStatus.device,
    cuda: detail && 'cuda' in detail ? Boolean(detail.cuda) : serviceStatus.cuda,
    model: detail?.model ?? serviceStatus.model,
  };
}
function refreshServiceStatusAsync() {
  void serviceHealth(EMBEDDING_URL)
    .then((health) => applyHealth(Boolean(health.online), health.detail))
    .catch(() => applyHealth(false, null));
}
refreshServiceStatusAsync();

async function embedTexts(texts) {
  const response = await fetchWithTimeout(`${EMBEDDING_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  }, Number(process.env.JAPANO_EMBEDDING_TIMEOUT_MS || 30000));
  if (!response.ok) throw new Error(`Embedding service HTTP ${response.status}`);
  const data = await response.json();
  applyHealth(true, data);
  return data.embeddings;
}

async function embedText(text) {
  const [vector] = await embedTexts([String(text || '').slice(0, 500)]);
  return vector;
}

const cache = new Map(); // slug -> { hash, vector }
let refreshing = false;
let lastError = null;

async function refreshProductEmbeddings(products) {
  if (refreshing) return;
  refreshing = true;
  try {
    const pending = [];
    for (const product of products || []) {
      const slug = String(product?.slug || product?.id || '');
      const text = productText(product);
      if (!slug || !text) continue;
      const hash = contentHash(text);
      const cached = cache.get(slug);
      if (cached && cached.hash === hash) continue;
      pending.push({ slug, hash, text: text.slice(0, 500) });
    }
    if (!pending.length) {
      lastError = null;
      return;
    }
    // Gộp thành 1 request batch — GPU tận dụng batch tốt hơn nhiều so với gọi
    // từng sản phẩm một, và giảm round-trip HTTP.
    const vectors = await embedTexts(pending.map((item) => item.text));
    pending.forEach((item, index) => cache.set(item.slug, { hash: item.hash, vector: vectors[index] }));
    lastError = null;
  } catch (error) {
    lastError = error;
    applyHealth(false, null);
    logger.warn({ err: error }, 'Không gọi được embedding service — bỏ qua semantic matching, các tín hiệu khác vẫn hoạt động bình thường.');
  } finally {
    refreshing = false;
  }
}

// Gọi được ở mọi request (fire-and-forget) — request hiện tại vẫn dùng cache
// cũ/rỗng ngay lập tức, các request sau khi refresh xong sẽ có tín hiệu mới.
function ensureProductEmbeddingsFresh(products) {
  if (!refreshing) void refreshProductEmbeddings(products);
}

function getProductEmbedding(slug) {
  return cache.get(String(slug))?.vector || null;
}

function embeddingsStatus() {
  return {
    model: serviceStatus.model || process.env.JAPANO_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    ready: serviceStatus.online === true,
    loading: serviceStatus.online === null,
    error: lastError ? String(lastError.message || lastError) : (serviceStatus.online === false ? 'Embedding service không phản hồi (đã cấu hình JAPANO_EMBEDDING_URL chưa? xem embedding_service.py)' : null),
    cachedProducts: cache.size,
    device: serviceStatus.device,
    cuda: serviceStatus.cuda,
  };
}

module.exports = {
  embedText,
  cosineSimilarity,
  productText,
  ensureProductEmbeddingsFresh,
  getProductEmbedding,
  embeddingsStatus,
};
