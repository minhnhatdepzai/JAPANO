// Hợp nhất các nguồn số liệu vóc dáng trước khi tư vấn size.
//
// Có tới bốn nguồn cùng nói về một cơ thể: số đo vòng khách tự nhập, chiều
// cao/cân nặng khách tự nhập, ước lượng của AI từ ảnh, và tỉ lệ hình học đo
// trên ảnh. Thứ tự ưu tiên là một quyết định sản phẩm, không phải kỹ thuật:
//
//   1. số đo vòng THẬT do khách nhập
//   2. chiều cao/cân nặng THẬT do khách nhập
//   3. chiều cao/cân nặng AI ước lượng (chỉ khi đủ độ tin cậy)
//   4. tỉ lệ cơ thể đo từ ảnh (dùng để hiệu chỉnh severity, không thay số đo)
//   5. mặc định size M
//
// Ước lượng của AI KHÔNG BAO GIỜ được ghi đè dữ liệu thật của khách — kể cả khi
// nó "tự tin" hơn. Người dùng biết chiều cao của chính họ.

const num = (value) => {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const minConfidence = () => {
  const parsed = Number(process.env.JAPANO_BODY_ESTIMATE_MIN_CONFIDENCE);
  return Number.isFinite(parsed) ? parsed : 0.35;
};

const bodyAnalysisEnabled = () => String(process.env.JAPANO_BODY_ANALYSIS_ENABLED ?? '1').trim() !== '0';
const heightEstimationEnabled = () => String(process.env.JAPANO_HEIGHT_ESTIMATION_ENABLED ?? '1').trim() !== '0';
const weightEstimationEnabled = () => String(process.env.JAPANO_WEIGHT_ESTIMATION_ENABLED ?? '1').trim() !== '0';

const estimateField = (key) => (key === 'height' ? 'heightEstimateCm' : 'weightEstimateKg');
const valueFields = (key) => (key === 'height' ? ['height', 'heightCm'] : ['weight', 'weightKg']);

/**
 * Đọc số đo THẬT do khách nhập.
 *
 * Bản mobile đầu tiên của tính năng từng chép số AI vào `height`/`weight` rồi
 * chỉ đánh dấu bằng `measurementSource=image-estimation`. Nếu coi hai field đó
 * là số thật ở request kế tiếp, confidence sẽ bị nâng sai lên 1.0. Hai cờ nguồn
 * theo từng trường xử lý profile mới; nhánh legacy giữ an toàn cho profile đã
 * được lưu bởi bản app lỗi đó.
 */
function userProvidedMeasurement(profile = {}, key) {
  const explicitSource = String(profile[`${key}Source`] || '').trim();
  if (explicitSource === 'image-estimation') return 0;

  const raw = valueFields(key).map((field) => num(profile[field])).find(Boolean) || 0;
  if (!raw) return 0;

  if (!explicitSource && String(profile.measurementSource || '') === 'image-estimation') {
    const estimate = num(profile[estimateField(key)]);
    // Profile legacy chỉ bị coi là AI khi giá trị đã copy khớp với estimate đã
    // lưu. Nếu khách đã sửa thành một số khác thì đó vẫn là số người dùng nhập.
    if (estimate && Math.abs(raw - estimate) <= 1.1) return 0;
  }
  return raw;
}

function savedImageEstimate(profile = {}, key) {
  const enabled = key === 'height' ? heightEstimationEnabled() : weightEstimationEnabled();
  if (!enabled || String(profile.measurementSource || '') !== 'image-estimation') return 0;
  if (String(profile[`${key}Source`] || '') === 'user') return 0;
  const value = num(profile[estimateField(key)]);
  const confidence = num(profile[`${key}EstimateConfidence`] ?? profile.estimateConfidence);
  return value && confidence >= minConfidence() ? value : 0;
}

/**
 * Chọn nguồn số đo cho một lượt phân tích/thử đồ.
 *
 * Mỗi ảnh vừa chọn có thể là một người khác, nên chế độ `image` không được lấy
 * chiều cao/cân nặng/vòng đo đã lưu của ảnh trước để áp lên người trong ảnh
 * mới. Chế độ `user` vẫn giữ nguyên dữ liệu thật do khách chủ động nhập.
 */
function profileForMeasurementMode(profile = {}, mode = '') {
  if (String(mode || '').trim().toLowerCase() !== 'image') return { ...(profile || {}) };
  return {
    ...(profile || {}),
    height: '', heightCm: '', weight: '', weightKg: '',
    bust: '', bustCm: '', chest: '', waist: '', waistCm: '', hip: '', hipCm: '', shoulder: '',
    heightSource: 'image-estimation',
    weightSource: 'image-estimation',
    measurementSource: 'image-estimation',
  };
}

function usableEstimate(estimate, key) {
  if (!estimate) return 0;
  const value = num(estimate[key]);
  if (!value) return 0;
  return Number(estimate.confidence || 0) >= minConfidence() ? value : 0;
}

/**
 * Trộn hồ sơ khách nhập với kết quả phân tích ảnh.
 *
 * @returns {{ profile: object, sources: object, usedEstimate: boolean }}
 *   `profile` là hồ sơ đưa vào adviseSize; `sources` ghi rõ mỗi trường đến từ đâu
 *   để UI và log không bao giờ trình bày số ước lượng như số đo thật.
 */
function mergeBodySignals(profile = {}, bodyAnalysis = null) {
  const merged = { ...(profile || {}) };
  const sources = {};

  const realHeight = userProvidedMeasurement(profile, 'height');
  const realWeight = userProvidedMeasurement(profile, 'weight');
  const realBust = num(profile.bust);
  const realWaist = num(profile.waist);
  const realHip = num(profile.hip);

  if (realBust) sources.bust = 'user';
  if (realWaist) sources.waist = 'user';
  if (realHip) sources.hip = 'user';
  if (realHeight) sources.height = 'user';
  if (realWeight) sources.weight = 'user';

  let usedEstimate = false;
  if (bodyAnalysisEnabled()) {
    const estimatedHeight = (bodyAnalysis && heightEstimationEnabled()
      ? usableEstimate(bodyAnalysis.estimatedHeight, 'valueCm') : 0)
      || savedImageEstimate(profile, 'height');
    const estimatedWeight = (bodyAnalysis && weightEstimationEnabled()
      ? usableEstimate(bodyAnalysis.estimatedWeight, 'valueKg') : 0)
      || savedImageEstimate(profile, 'weight');
    if (!realHeight && estimatedHeight) {
      merged.height = estimatedHeight;
      merged.heightCm = estimatedHeight;
      sources.height = 'image-estimation';
      usedEstimate = true;
    }
    if (!realWeight && estimatedWeight) {
      merged.weight = estimatedWeight;
      merged.weightKg = estimatedWeight;
      sources.weight = 'image-estimation';
      usedEstimate = true;
    }
    // Vòng ngực/eo/hông đo từ ảnh CỐ Ý không được dùng để tính size.
    //
    // Đường viền ngoài của một người đang mặc quần áo là đường viền của QUẦN ÁO:
    // một chiếc áo phom rộng làm "vòng ngực" đo được phồng thêm 20–30cm. Đưa con
    // số đó vào bảng size sẽ khuyên khách mua size lớn hơn hẳn nhu cầu thật —
    // sai lầm tệ hơn hẳn việc chỉ dựa vào chiều cao/cân nặng.
    //
    // Số đo vòng vẫn được trả về trong response để tham khảo và chẩn đoán, kèm
    // cờ `girthsMeasureClothing`. Chỉ số đo vòng do CHÍNH KHÁCH nhập mới được
    // dùng cho bảng size.
  }

  return { profile: merged, sources, usedEstimate };
}

// Rút gọn kết quả phân tích cho phần response/log: không mang theo mảng pixel,
// không mang theo ảnh.
function summarizeBodyAnalysis(bodyAnalysis) {
  if (!bodyAnalysis?.ok) return null;
  return {
    estimatedHeight: bodyAnalysis.estimatedHeight,
    estimatedWeight: bodyAnalysis.estimatedWeight,
    estimatedGirths: bodyAnalysis.estimatedGirths || {},
    // Cờ này phải đi kèm số đo vòng ở MỌI nơi hiển thị: đó là vòng ngoài quần
    // áo, không phải vòng cơ thể, nên không dùng để chốt size.
    girthsMeasureClothing: bodyAnalysis.girthsMeasureClothing !== false,
    bodyShape: bodyAnalysis.bodyShape,
    quality: bodyAnalysis.quality,
    warnings: bodyAnalysis.warnings || [],
  };
}

// Dòng log gọn cho terminal backend — tuyệt đối không log base64 ảnh.
function bodyAnalysisLogLine(bodyAnalysis) {
  const height = bodyAnalysis?.estimatedHeight;
  const weight = bodyAnalysis?.estimatedWeight;
  const range = (value, unit) => (value?.minCm ?? value?.minKg) != null
    ? `${value.minCm ?? value.minKg}-${value.maxCm ?? value.maxKg} ${unit}`
    : 'không đủ dữ liệu';
  return [
    '[TRYON BODY]',
    `height estimate = ${range(height, 'cm')}`,
    `weight estimate = ${range(weight, 'kg')}`,
    `confidence = ${bodyAnalysis?.quality?.analysisConfidence ?? 0}`,
  ].join(' | ');
}

module.exports = {
  mergeBodySignals,
  summarizeBodyAnalysis,
  bodyAnalysisLogLine,
  bodyAnalysisEnabled,
  minConfidence,
  userProvidedMeasurement,
  profileForMeasurementMode,
};
