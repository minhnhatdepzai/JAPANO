// Năm hồ sơ vóc dáng tham chiếu chạy NGẦM cho luồng thử đồ một chạm.
//
// Đây không phải năm người để khách chọn thay cho ảnh của mình. Ảnh khách vẫn
// là đầu vào duy nhất của VTON; các anchor chỉ giúp chọn một prior fit/size khi
// ảnh 2D không đủ căn cứ để suy ra cm/kg tuyệt đối. Vì vậy module không trả URL,
// tên file hay dữ liệu ảnh ra response.
//
// Chữ ký hình học được đo bằng chính body_analysis.py trên năm ảnh đã duyệt
// ngày 2026-08-29. Khi pipeline hình học thay đổi, phải đo lại chữ ký và tăng
// ANCHOR_GENERATION; không được sửa tay cho khớp một ảnh test riêng lẻ.

const { listTryonPresets } = require('./tryonPresets');

const ANCHOR_GENERATION = 2;
const MIN_FEATURES = 3;
const MIN_SIZING_CONFIDENCE = 0.28;

const SIGNATURES = Object.freeze({
  'nam-can-doi': {
    shoulderWidthRatio: 0.2807, hipWidthRatio: 0.2106, torsoRatio: 0.2986,
    legRatio: 0.4391, bodyWidthRatio: 0.1977, shoulderHipRatio: 1.3327,
  },
  'nu-can-doi': {
    shoulderWidthRatio: 0.2510, hipWidthRatio: 0.1953, torsoRatio: 0.2875,
    legRatio: 0.4600, bodyWidthRatio: 0.1797, shoulderHipRatio: 1.2851,
  },
  'nu-mem-mai': {
    shoulderWidthRatio: 0.3444, hipWidthRatio: 0.3379, torsoRatio: 0.3000,
    legRatio: 0.4544, bodyWidthRatio: 0.3388, shoulderHipRatio: 1.0193,
  },
  'nu-nang-dong': {
    shoulderWidthRatio: 0.2451, hipWidthRatio: 0.1949, torsoRatio: 0.2840,
    legRatio: 0.4641, bodyWidthRatio: 0.1805, shoulderHipRatio: 1.2574,
  },
  'nu-thanh-manh': {
    shoulderWidthRatio: 0.2415, hipWidthRatio: 0.1882, torsoRatio: 0.2864,
    legRatio: 0.4664, bodyWidthRatio: 0.1715, shoulderHipRatio: 1.2832,
  },
});

// Mẫu số là độ lệch có ý nghĩa của từng tỉ lệ, không phải sai số đo bằng cm.
// bodyWidth và shoulder/hip mang nhiều thông tin về fit nhất nên có trọng số cao.
const FEATURE_SCALE = Object.freeze({
  shoulderWidthRatio: 0.035,
  hipWidthRatio: 0.030,
  torsoRatio: 0.040,
  legRatio: 0.055,
  bodyWidthRatio: 0.030,
  shoulderHipRatio: 0.180,
});
const FEATURE_WEIGHT = Object.freeze({
  shoulderWidthRatio: 1.0,
  hipWidthRatio: 1.1,
  torsoRatio: 0.55,
  legRatio: 0.55,
  bodyWidthRatio: 1.5,
  shoulderHipRatio: 1.2,
});

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const midpoint = (range) => Array.isArray(range) && range.length === 2
  ? (Number(range[0]) + Number(range[1])) / 2
  : null;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizedSex(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['female', 'woman', 'nu', 'nữ'].includes(text)) return 'female';
  if (['male', 'man', 'nam'].includes(text)) return 'male';
  return '';
}

function distanceTo(signature, shape) {
  let weightedSquares = 0;
  let totalWeight = 0;
  let featureCount = 0;
  for (const [key, scale] of Object.entries(FEATURE_SCALE)) {
    const actual = finite(shape?.[key]);
    const expected = finite(signature?.[key]);
    if (actual == null || actual <= 0 || expected == null) continue;
    const weight = FEATURE_WEIGHT[key] || 1;
    weightedSquares += ((actual - expected) / scale) ** 2 * weight;
    totalWeight += weight;
    featureCount += 1;
  }
  if (!totalWeight) return { distance: Number.POSITIVE_INFINITY, featureCount: 0 };
  return { distance: Math.sqrt(weightedSquares / totalWeight), featureCount };
}

/**
 * Chọn anchor gần nhất nhưng không biến prior đó thành phép đo thật.
 *
 * @returns {object|null} metadata không chứa ảnh; `usableForSizing` chỉ bật khi
 * đủ ít nhất ba đặc trưng hình học và confidence đạt ngưỡng.
 */
function matchBodyAnchor(bodyAnalysis, sexHint = '') {
  const shape = bodyAnalysis?.bodyShape || {};
  const wantedSex = normalizedSex(sexHint);
  let candidates = listTryonPresets().filter((preset) => SIGNATURES[preset.id]);
  if (wantedSex && candidates.some((preset) => preset.gender === wantedSex)) {
    candidates = candidates.filter((preset) => preset.gender === wantedSex);
  }

  const ranked = candidates.map((preset) => ({
    preset,
    ...distanceTo(SIGNATURES[preset.id], shape),
  })).filter((row) => Number.isFinite(row.distance));
  ranked.sort((left, right) => left.distance - right.distance);
  const best = ranked[0];
  if (!best || best.featureCount < MIN_FEATURES) return null;

  const quality = clamp(Number(bodyAnalysis?.quality?.analysisConfidence ?? 0.5), 0.2, 1);
  const coverageFactor = bodyAnalysis?.quality?.fullBodyVisible === false ? 0.72 : 1;
  // 1/(1+d) dễ diễn giải và không cho một match hình học trở thành "100%".
  const confidence = clamp((1 / (1 + best.distance)) * quality * coverageFactor, 0.12, 0.86);
  const preset = best.preset;
  return {
    generation: ANCHOR_GENERATION,
    bodyProfile: preset.bodyProfile,
    confidence: Math.round(confidence * 1000) / 1000,
    featureCount: best.featureCount,
    heightCm: preset.heightCm,
    weightKg: preset.weightKg,
    bustCm: preset.bustCm,
    waistCm: preset.waistCm,
    hipCm: preset.hipCm,
    source: 'hidden-reference-anchor',
    usableForSizing: confidence >= MIN_SIZING_CONFIDENCE,
  };
}

function anchorSizingProfile(referenceProfile) {
  if (!referenceProfile?.usableForSizing) return {};
  const height = midpoint(referenceProfile.heightCm);
  const weight = midpoint(referenceProfile.weightKg);
  return {
    ...(height ? { height, heightCm: height } : {}),
    ...(weight ? { weight, weightKg: weight } : {}),
  };
}

module.exports = {
  ANCHOR_GENERATION,
  MIN_SIZING_CONFIDENCE,
  SIGNATURES,
  matchBodyAnchor,
  anchorSizingProfile,
};
