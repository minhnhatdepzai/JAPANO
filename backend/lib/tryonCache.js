// Cache kết quả thử đồ — CHỈ cho người mẫu dựng sẵn.
//
// Vì sao giới hạn ở preset: một lượt thử trên ảnh khách là ảnh cá nhân, và
// chính sách của dự án là không giữ lại ảnh cá nhân sau khi trả về. Ảnh preset
// thì ngược lại — do JAPANO dựng, đã duyệt, không gắn với ai cả — nên lưu lại
// được vô hại và tiết kiệm rất nhiều: cùng một mẫu + cùng một món + cùng cỡ sẽ
// luôn ra đúng một ảnh, mà mỗi lần dựng lại tốn 39-83 giây GPU.
//
// Cache nằm trên ĐĨA, không nằm trong MongoDB. MongoDB là nơi giữ dữ liệu kinh
// doanh; nhét ảnh 1-1.4 MB vào đó làm phình database và phá vỡ mô hình lưu trữ.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = process.env.JAPANO_TRYON_CACHE_DIR
  || path.join(__dirname, '..', 'data', 'tryon-cache');

// Ảnh preset bất biến, nên hạn dùng dài. Con số này chỉ để cache không phình
// vô hạn khi catalog đổi qua nhiều mùa.
const TTL_MS = Number(process.env.JAPANO_TRYON_CACHE_TTL_MS || 30 * 24 * 60 * 60 * 1000);

// Đổi số này khi pipeline dựng ảnh thay đổi (model, tham số, thứ tự mặc đồ).
// Nếu không, cache cũ sẽ tiếp tục trả ảnh dựng bằng pipeline đời trước và mọi
// cải tiến đều "không thấy tác dụng".
const PIPELINE_VERSION = 'v1-2026-08-29';

/**
 * Khoá cache. Mọi thứ ẢNH HƯỞNG tới ảnh đầu ra đều phải nằm trong khoá; thiếu
 * một biến là trả nhầm ảnh của cấu hình khác.
 */
function cacheKey({ presetId, presetSha256, productIds, size, color, accessoryIds, qualityMode }) {
  const descriptor = JSON.stringify({
    v: PIPELINE_VERSION,
    presetId: String(presetId || ''),
    // Gắn cả hash ảnh: nếu ảnh preset được thay bằng người mẫu khác dưới cùng
    // một id, khoá đổi theo và cache cũ tự động không còn khớp.
    presetSha256: String(presetSha256 || ''),
    productIds: [...(productIds || [])].map(String).sort(),
    size: String(size || '').toUpperCase(),
    color: String(color || ''),
    accessoryIds: [...(accessoryIds || [])].map(String).sort(),
    qualityMode: String(qualityMode || ''),
  });
  return crypto.createHash('sha256').update(descriptor).digest('hex');
}

function entryPath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

function readTryonCache(key) {
  try {
    const raw = fs.readFileSync(entryPath(key), 'utf8');
    const entry = JSON.parse(raw);
    if (!entry?.response?.imageBase64) return null;
    if (Date.now() - Number(entry.savedAt || 0) > TTL_MS) {
      fs.rmSync(entryPath(key), { force: true });
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

/**
 * Chỉ ghi khi lượt thử là preset VÀ đã qua mọi cổng chất lượng.
 * Cache một kết quả bị cảnh báo danh tính nghĩa là đóng băng vĩnh viễn một ảnh
 * hỏng và trả lại nó cho mọi khách sau đó.
 */
function writeTryonCache(key, payload) {
  // Hợp đồng: payload.response là NGUYÊN VĂN thân phản hồi sẽ trả lại lần sau.
  // Kiểm đúng chỗ đó — kiểm nhầm `payload.imageBase64` khiến cache im lặng
  // không bao giờ ghi được, và mọi lượt thử preset vẫn tốn trọn thời gian GPU.
  if (!key || !payload?.response?.imageBase64) return false;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const tmp = `${entryPath(key)}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ ...payload, savedAt: Date.now() }));
    // Ghi qua file tạm rồi rename: đọc song song không bao giờ thấy JSON dở dang.
    fs.renameSync(tmp, entryPath(key));
    return true;
  } catch {
    return false;
  }
}

function clearTryonCache() {
  try {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  } catch { /* không có gì để xoá */ }
}

module.exports = { CACHE_DIR, PIPELINE_VERSION, TTL_MS, cacheKey, readTryonCache, writeTryonCache, clearTryonCache };
