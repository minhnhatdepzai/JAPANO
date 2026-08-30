// Ghép ảnh khách vào phong cảnh Nhật Bản.
//
// Ràng buộc an toàn của tính năng này, theo đúng thứ tự quan trọng:
//   1. Client KHÔNG bao giờ gửi URL. Nó gửi tên địa điểm; máy chủ tra bảng của
//      mình (japanSceneBackgrounds.js). Nhận URL từ client biến máy chủ thành
//      proxy tải bất kỳ địa chỉ nào — kể cả địa chỉ nội bộ.
//   2. Ảnh nền chỉ được tải từ danh sách host cố định bên dưới.
//   3. Ảnh cá nhân KHÔNG được ghi xuống đĩa và KHÔNG vào MongoDB. Nó chỉ tồn
//      tại trong bộ nhớ đúng một lượt request.
//   4. Log không chứa base64.
const fs = require('fs');
const { findSceneBackground } = require('./japanSceneBackgrounds');
const { findScene, scenesForSpot, sceneImagePath } = require('./japanScenes');
const { bodyWorkerUrl } = require('./bodyAnalysis');

// Ảnh địa điểm đều là tệp Creative Commons trên Wikimedia Commons. Danh sách
// đóng: thêm host mới là một quyết định có cân nhắc, không phải chuyện tình cờ.
const ALLOWED_IMAGE_HOSTS = Object.freeze(['upload.wikimedia.org']);

const MAX_BACKGROUND_BYTES = 12 * 1024 * 1024;

// Ảnh nền là tệp tĩnh không đổi, nên giữ lại trong RAM để lượt sau khỏi tải
// mạng. Cache theo URL, giới hạn số mục để không phình vô hạn.
const BACKGROUND_CACHE = new Map();
const BACKGROUND_CACHE_MAX = 32;

function assertAllowedUrl(rawUrl) {
  const url = new URL(String(rawUrl));
  if (url.protocol !== 'https:') throw new Error('ảnh nền phải dùng HTTPS');
  if (!ALLOWED_IMAGE_HOSTS.includes(url.hostname)) {
    throw new Error(`host ảnh nền không nằm trong danh sách cho phép: ${url.hostname}`);
  }
  return url;
}

async function fetchBackgroundImage(rawUrl, timeoutMs = 15000) {
  const cached = BACKGROUND_CACHE.get(rawUrl);
  if (cached) return cached;

  const url = assertAllowedUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // Wikimedia từ chối user-agent rỗng. Giá trị phải thuần ASCII: header HTTP
      // là ByteString, chữ có dấu sẽ ném lỗi ngay khi dựng request.
      headers: { 'User-Agent': 'JAPANO/1.0 (japano-app; japanese fashion app)' },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`tải ảnh nền thất bại: HTTP ${response.status}`);
    const type = String(response.headers.get('content-type') || '');
    if (!type.startsWith('image/')) throw new Error(`ảnh nền không phải ảnh: ${type || 'không rõ'}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BACKGROUND_BYTES) throw new Error('ảnh nền quá lớn');
    const encoded = `data:${type.split(';')[0]};base64,${buffer.toString('base64')}`;
    if (BACKGROUND_CACHE.size >= BACKGROUND_CACHE_MAX) {
      BACKGROUND_CACHE.delete(BACKGROUND_CACHE.keys().next().value);
    }
    BACKGROUND_CACHE.set(rawUrl, encoded);
    return encoded;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ghép nhanh bằng tách nền (mặc định). Không dùng GPU và không sinh lại người,
 * nên khuôn mặt và cơ thể giữ nguyên từng pixel.
 */
async function composeViaWorker({ personImageBase64, backgroundImageBase64, composition, heightRatio, anchorX }, timeoutMs = 30000) {
  const base = bodyWorkerUrl();
  if (!base) return { ok: false, code: 'COMPOSER_UNAVAILABLE', message: 'Dịch vụ ghép ảnh chưa bật.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personImageBase64, backgroundImageBase64, composition, heightRatio, anchorX }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      return {
        ok: false,
        code: data?.code || 'COMPOSE_FAILED',
        message: data?.message || `Ghép ảnh thất bại (HTTP ${response.status}).`,
      };
    }
    return data;
  } catch (error) {
    return {
      ok: false,
      code: 'COMPOSER_UNAVAILABLE',
      message: `Không gọi được dịch vụ ghép ảnh: ${error.name === 'AbortError' ? 'quá hạn' : error.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ảnh nền của một scene đã duyệt, đọc từ đĩa.
 *
 * Scene nằm trong repo nên không cần gọi mạng lần nào lúc ghép ảnh — nhanh hơn,
 * và không có bề mặt SSRF nào để lo. Đường `fetchBackgroundImage` phía trên chỉ
 * còn phục vụ các ảnh minh hoạ địa điểm cũ chưa được curate thành scene.
 */
function loadSceneBackground(scene) {
  const cacheKey = `scene:${scene.id}`;
  const cached = BACKGROUND_CACHE.get(cacheKey);
  if (cached) return cached;
  const buffer = fs.readFileSync(sceneImagePath(scene));
  const encoded = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  if (BACKGROUND_CACHE.size >= BACKGROUND_CACHE_MAX) {
    BACKGROUND_CACHE.delete(BACKGROUND_CACHE.keys().next().value);
  }
  BACKGROUND_CACHE.set(cacheKey, encoded);
  return encoded;
}

function clearBackgroundCache() {
  BACKGROUND_CACHE.clear();
}

module.exports = {
  loadSceneBackground,
  findScene,
  scenesForSpot,
  ALLOWED_IMAGE_HOSTS,
  MAX_BACKGROUND_BYTES,
  assertAllowedUrl,
  fetchBackgroundImage,
  composeViaWorker,
  clearBackgroundCache,
  findSceneBackground,
};
