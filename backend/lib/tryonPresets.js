// Bộ "mẫu thử nhanh": ảnh người mẫu trưởng thành do JAPANO dựng sẵn để khách
// xem một món đồ lên dáng người thật mà không phải tự chụp ảnh.
//
// Vì sao ảnh nằm ở server chứ không nhận từ client: nếu app gửi lên "ảnh của
// preset", kẻ tấn công chỉ cần gửi presetId hợp lệ kèm một ảnh bất kỳ là bỏ
// qua được cổng kiểm tra 18+. Ở đây presetId chỉ là một CÁI TÊN; backend tự đọc
// file của mình và tự đối chiếu SHA-256 với manifest trước khi tin. Không có
// đường nào để client đẩy nội dung ảnh vào luồng preset.
//
// SHA-256 không phải trang trí: nó chặn trường hợp file trên đĩa bị thay bằng
// một ảnh khác (rsync sai, sửa tay, hoặc một tiến trình khác ghi đè) mà cờ
// adult:true vẫn còn nguyên trong code.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRESET_DIR = path.join(__dirname, '..', '..', 'mobile', 'assets', 'tryon-presets');

// Khoảng số đo dưới đây KHÔNG phải số đo khai báo của một người thật — người
// mẫu là ảnh dựng. Phần lớn là bin của pipeline body_analysis; riêng mẫu ngoại
// cỡ 110–120 kg là MỤC TIÊU THIẾT KẾ đã chủ động dùng để dựng ảnh, không phải
// cân nặng AI suy ra từ pixel. Chúng chỉ làm prior chọn size và không được trả
// như một phép đo chính xác của ảnh khách.
const PRESETS = Object.freeze([
  {
    id: 'nu-thanh-manh',
    label: 'Nữ · dáng thanh mảnh',
    file: 'nu-thanh-manh.jpg',
    adult: true,
    gender: 'female',
    bodyProfile: 'slim',
    heightCm: [160, 170],
    weightKg: [50, 60],
    bustCm: [80, 90],
    waistCm: [70, 80],
    hipCm: [90, 100],
    preferredCategories: ['ao-truyen-thong', 'trang-phuc', 'cosplay'],
    sha256: 'd2a2fce7c4684a6a9d77f9212652883705ea087112524352b4403c81c9768143',
  },
  {
    id: 'nu-can-doi',
    label: 'Nữ · dáng cân đối',
    file: 'nu-can-doi.jpg',
    adult: true,
    gender: 'female',
    bodyProfile: 'regular',
    heightCm: [160, 170],
    weightKg: [60, 70],
    bustCm: [90, 100],
    waistCm: [70, 80],
    hipCm: [90, 100],
    preferredCategories: ['trang-phuc', 'ao-truyen-thong', 'haori'],
    sha256: '079b9d51632b70c8e4b327e0cf6bdc69c2524eecac22d23f6f88d11e4fbce607',
  },
  {
    id: 'nu-nang-dong',
    label: 'Nữ · dáng năng động',
    file: 'nu-nang-dong.jpg',
    adult: true,
    gender: 'female',
    bodyProfile: 'athletic',
    heightCm: [160, 170],
    weightKg: [50, 60],
    bustCm: [80, 90],
    waistCm: [70, 80],
    hipCm: [90, 100],
    preferredCategories: ['trang-phuc', 'cosplay', 'haori'],
    sha256: 'de3430066f018aca6d3004bb7cfd8b42e6c0fbb0b778d538efc571ed6d99f5da',
  },
  {
    id: 'nu-mem-mai',
    label: 'Nữ · ngoại cỡ 110–120 kg',
    file: 'nu-mem-mai-110-120.jpg',
    adult: true,
    gender: 'female',
    bodyProfile: 'curvy',
    heightCm: [150, 160],
    weightKg: [110, 120],
    bustCm: [140, 150],
    waistCm: [130, 140],
    hipCm: [150, 160],
    preferredCategories: ['ao-truyen-thong', 'haori', 'trang-phuc'],
    sha256: '502eae63036697551113e04520ddbafdbea27d31215596a92b45072c6b3793f0',
  },
  {
    id: 'nam-can-doi',
    label: 'Nam · dáng cân đối',
    file: 'nam-can-doi.jpg',
    adult: true,
    gender: 'male',
    bodyProfile: 'regular',
    heightCm: [160, 170],
    weightKg: [60, 70],
    bustCm: [90, 100],
    waistCm: [80, 90],
    hipCm: [100, 110],
    preferredCategories: ['haori', 'trang-phuc', 'ao-truyen-thong'],
    sha256: '6b277e853cc430e757f05bbf62c557321710859ac88e31c1338f58dcbab521dd',
  },
]);

const BY_ID = new Map(PRESETS.map((preset) => [preset.id, preset]));

function presetImagePath(preset) {
  return path.join(PRESET_DIR, preset.file);
}

/** Thông tin an toàn để trả cho app: không có đường dẫn đĩa, không có base64. */
function publicPreset(preset) {
  return {
    id: preset.id,
    label: preset.label,
    imageUrl: `/assets/tryon-presets/${preset.file}`,
    gender: preset.gender,
    bodyProfile: preset.bodyProfile,
    heightCm: preset.heightCm,
    weightKg: preset.weightKg,
    bustCm: preset.bustCm,
    waistCm: preset.waistCm,
    hipCm: preset.hipCm,
    preferredCategories: preset.preferredCategories,
  };
}

function listTryonPresets() {
  return PRESETS.map(publicPreset);
}

/**
 * Đọc ảnh preset từ đĩa và chỉ trả về khi SHA-256 khớp manifest.
 *
 * Trả `{ ok:false, reason }` thay vì ném lỗi để route phân biệt được "id lạ"
 * với "file đã bị đổi" — hai chuyện cần hai thông báo khác nhau.
 */
function loadTryonPreset(id) {
  const preset = BY_ID.get(String(id || '').trim());
  if (!preset) return { ok: false, reason: 'unknown_preset' };
  let buffer;
  try {
    buffer = fs.readFileSync(presetImagePath(preset));
  } catch {
    return { ok: false, reason: 'preset_file_missing', preset: publicPreset(preset) };
  }
  const digest = crypto.createHash('sha256').update(buffer).digest('hex');
  if (digest !== preset.sha256) {
    return { ok: false, reason: 'preset_hash_mismatch', preset: publicPreset(preset) };
  }
  // adult:true chỉ có hiệu lực SAU khi hash khớp. Thứ tự này là cả điểm mấu chốt
  // của module: cờ người lớn gắn với đúng những byte đã được duyệt, không gắn
  // với cái tên preset.
  if (preset.adult !== true) return { ok: false, reason: 'preset_not_adult' };
  return {
    ok: true,
    preset,
    publicPreset: publicPreset(preset),
    imageBase64: `data:image/jpeg;base64,${buffer.toString('base64')}`,
    sha256: digest,
  };
}

module.exports = {
  PRESET_DIR,
  listTryonPresets,
  loadTryonPreset,
  publicPreset,
};
