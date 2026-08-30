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

const crypto = require('crypto');
const { matchBodyAnchor, anchorSizingProfile } = require('./bodyAnchors');

// Worker thường trú cho bước phân tích cơ thể.
//
// Đường mặc định (`runAccessoryPipeline`) sinh một tiến trình Python MỚI cho mỗi
// request, nên mỗi lượt phải nạp lại YOLOv8n-pose và U2Net — đo được 4.12 giây
// một lượt, hơn một nửa là nạp model. Worker giữ hai model đó thường trú.
//
// Đây là TỐI ƯU, không phải phụ thuộc: mọi lỗi (chưa bật service, timeout, trả
// dữ liệu hỏng) đều rơi về đường cũ. Tắt hẳn bằng JAPANO_BODY_WORKER_URL=''.
const bodyWorkerUrl = () => {
  const raw = process.env.JAPANO_BODY_WORKER_URL;
  if (raw !== undefined) return String(raw).trim();
  return 'http://127.0.0.1:7863';
};

async function analyzeViaWorker(payload, timeoutMs) {
  const base = bodyWorkerUrl();
  if (!base) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const response = await fetch(`${base}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.ok ? data : null;
  } catch {
    // Worker chưa chạy hoặc quá hạn — im lặng rơi về đường spawn.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const num = (value) => {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

// Khoá cache theo đúng bytes ảnh. Mobile phân tích vóc dáng ngay sau khi chọn
// ảnh; /tryon dùng lại pose đó thay vì nạp YOLO thêm một lần. Hash ngăn việc
// vô tình áp pose của ảnh trước lên ảnh vừa chọn sau Fast Refresh.
function imageFingerprint(value) {
  const text = String(value || '').trim();
  const raw = text.startsWith('data:') && text.includes(',') ? text.slice(text.indexOf(',') + 1) : text;
  if (!raw) return '';
  try {
    return crypto.createHash('sha256').update(Buffer.from(raw, 'base64')).digest('hex').slice(0, 24);
  } catch {
    return '';
  }
}

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

/**
 * Một ước lượng chỉ được dùng để CHỌN SIZE khi nó đủ tin cậy.
 *
 * Ngưỡng hiển thị của Python thấp hơn ngưỡng này: ảnh không có vật chuẩn vẫn cho
 * ra một khoảng 10cm đáng hiển thị kèm nhãn "độ tin cậy thấp", nhưng con số chủ
 * yếu đến từ prior dân số nên không được âm thầm quyết định size. `usableForSizing`
 * do Python đặt là tiếng nói cuối cùng khi có; nếu không có thì so confidence.
 */
function usableEstimate(estimate, key) {
  if (!estimate) return 0;
  const value = num(estimate[key]);
  if (!value) return 0;
  if (estimate.usableForSizing === false) return 0;
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
  let usedAnchor = false;
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
    // Khi ảnh không đủ scale tuyệt đối, dùng mẫu hình học gần nhất làm PRIOR
    // cho việc chọn size. Hai midpoint này chỉ sống trong `profile` nội bộ của
    // phép tư vấn; response số đo vẫn giữ null và nói rõ đây là dải tham chiếu.
    // Như vậy khách không phải nhập tay nhưng hệ thống cũng không gọi prior là
    // số đo thật.
    const referenceProfile = bodyAnalysis?.referenceProfile || matchBodyAnchor(
      bodyAnalysis,
      profile.gender || profile.sex,
    );
    const anchorProfile = anchorSizingProfile(referenceProfile);
    if (!realHeight && !estimatedHeight && anchorProfile.height) {
      merged.height = anchorProfile.height;
      merged.heightCm = anchorProfile.heightCm;
      sources.height = 'body-anchor-prior';
      usedAnchor = true;
    }
    if (!realWeight && !estimatedWeight && anchorProfile.weight) {
      merged.weight = anchorProfile.weight;
      merged.weightKg = anchorProfile.weightKg;
      sources.weight = 'body-anchor-prior';
      usedAnchor = true;
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

  return { profile: merged, sources, usedEstimate, usedAnchor };
}

// Rút gọn kết quả phân tích cho phần response/log: không mang theo mảng pixel,
// không mang theo ảnh.
function summarizeBodyAnalysis(bodyAnalysis) {
  if (!bodyAnalysis?.ok) return null;
  const referenceProfile = bodyAnalysis.referenceProfile || matchBodyAnchor(bodyAnalysis);
  const measurementCount = [
    bodyAnalysis.estimatedHeight?.valueCm,
    bodyAnalysis.estimatedWeight?.valueKg,
    bodyAnalysis.estimatedGirthRanges?.bust?.valueCm,
    bodyAnalysis.estimatedGirthRanges?.waist?.valueCm,
    bodyAnalysis.estimatedGirthRanges?.hip?.valueCm,
  ].filter((value) => Number(value) > 0).length;
  const measurementStatus = measurementCount === 0
    ? 'insufficient_evidence'
    : measurementCount < 5 ? 'partial' : 'estimated';
  const rejectedCue = String(bodyAnalysis.estimatedHeight?.cueRejected || '');
  const measurementMessage = measurementStatus === 'insufficient_evidence'
    ? (rejectedCue === 'head_count_out_of_range'
      ? `Tỉ lệ cơ thể nằm ngoài miền dữ liệu có thể đo tuyệt đối.${referenceProfile ? ' AI dùng dải vóc dáng tham chiếu gần nhất để chọn size và thử đồ, không coi đó là số đo thật.' : ' Bạn vẫn có thể thử trang phục.'}`
      : `Ảnh chưa có đủ bằng chứng để suy ra số đo tuyệt đối.${referenceProfile ? ' AI dùng dải vóc dáng tham chiếu gần nhất để chọn size và thử đồ, không coi đó là số đo thật.' : ' Bạn vẫn có thể thử trang phục.'}`)
    : measurementStatus === 'partial'
      ? 'AI chỉ ước lượng được một phần số đo từ ảnh này; các ô trống không được dùng để chọn size.'
      : 'Các số dưới đây là khoảng ước lượng từ ảnh, không phải phép đo bằng thước.';
  return {
    estimatedHeight: bodyAnalysis.estimatedHeight,
    estimatedWeight: bodyAnalysis.estimatedWeight,
    estimatedGirths: bodyAnalysis.estimatedGirths || {},
    estimatedGirthRanges: bodyAnalysis.estimatedGirthRanges || {},
    // Vòng nào bị chốt chặn giải phẫu loại bỏ, kèm lý do. UI phải nói "chưa đo
    // được" cho đúng vòng đó thay vì im lặng bỏ trống.
    rejectedGirths: bodyAnalysis.rejectedGirths || null,
    // Cờ này phải đi kèm số đo vòng ở MỌI nơi hiển thị: đó là vòng ngoài quần
    // áo, không phải vòng cơ thể, nên không dùng để chốt size.
    girthsMeasureClothing: bodyAnalysis.girthsMeasureClothing !== false,
    bodyShape: bodyAnalysis.bodyShape,
    referenceProfile,
    quality: bodyAnalysis.quality,
    warnings: bodyAnalysis.warnings || [],
    measurementStatus,
    measurementMessage,
    // Thử đồ chỉ cần nhận diện/segmentation người; không phụ thuộc việc có suy
    // ra được cm/kg hay không. Route try-on vẫn có cổng riêng cho ảnh không có
    // người, chất lượng sinh ảnh và độ che phủ.
    tryOnEligible: true,
    // Chỉ là keypoint/bounding box, không chứa ảnh. Client gửi lại cùng
    // imageFingerprint để try-on tránh phân tích pose trùng lặp.
    poseCache: bodyAnalysis.poseCache,
    imageFingerprint: bodyAnalysis.imageFingerprint,
  };
}

// Dòng log gọn cho terminal backend — tuyệt đối không log base64 ảnh.
function bodyAnalysisLogLine(bodyAnalysis) {
  const height = bodyAnalysis?.estimatedHeight;
  const weight = bodyAnalysis?.estimatedWeight;
  const bust = bodyAnalysis?.estimatedGirthRanges?.bust;
  const waist = bodyAnalysis?.estimatedGirthRanges?.waist;
  const range = (value, unit) => (value?.minCm ?? value?.minKg) != null
    ? `${value.minCm ?? value.minKg}-${value.maxCm ?? value.maxKg} ${unit}`
    : 'không đủ dữ liệu';
  return [
    '[TRYON BODY]',
    `height estimate = ${range(height, 'cm')}`,
    `weight estimate = ${range(weight, 'kg')}`,
    `bust estimate = ${range(bust, 'cm')}`,
    `waist estimate = ${range(waist, 'cm')}`,
    `confidence = ${bodyAnalysis?.quality?.analysisConfidence ?? 0}`,
    // Hai cờ chẩn đoán quan trọng nhất khi số đo trông sai: tay có bị gộp vào
    // thân không, và chiều cao đến từ ảnh hay chủ yếu từ prior dân số.
    `armsMerged = ${bodyAnalysis?.quality?.armsMergedIntoTorso === true}`,
    `heightBasis = ${height?.basis || height?.source || 'n/a'}`,
  ].join(' | ');
}

module.exports = {
  analyzeViaWorker,
  bodyWorkerUrl,
  mergeBodySignals,
  summarizeBodyAnalysis,
  bodyAnalysisLogLine,
  bodyAnalysisEnabled,
  minConfidence,
  userProvidedMeasurement,
  profileForMeasurementMode,
  imageFingerprint,
};
