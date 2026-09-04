// Kiểm thử tầng suy luận độ vừa vặn — phần quyết định ảnh thử đồ trông chật
// hay rộng. Đây là logic thuần (không GPU, không mạng) nên phải được khoá chặt
// bằng test: sai một ngưỡng ở đây là sai toàn bộ hiệu ứng hiển thị cho khách.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzeFit, fitRefinePlan, garmentPreScaleDelta, severityFromEase, verdictFor,
} = require('../lib/fitAnalysis');
const {
  mergeBodySignals, userProvidedMeasurement, profileForMeasurementMode,
} = require('../lib/bodyAnalysis');

const fit = (chosen, recommended, extra = {}) => analyzeFit({
  chosenSize: chosen, recommendedSize: recommended, ...extra,
});

// --- Case 1: vừa size --------------------------------------------------------
test('Case 1 — chọn M, khuyến nghị M: good, severity 0, KHÔNG chạy fit refine', () => {
  const result = fit('M', 'M');
  assert.equal(result.verdict, 'good');
  assert.equal(result.severity, 0);
  assert.equal(result.delta, 0);
  assert.deepEqual(result.allowedEffects, []);
  assert.equal(result.visualEffect.tearAllowed, false);
  const plan = fitRefinePlan(result);
  assert.equal(plan.shouldRefine, false);
  assert.equal(garmentPreScaleDelta(result), 0);
});

// --- Case 2: lệch một bậc ----------------------------------------------------
test('Case 2 — chọn L, khuyến nghị XL: hơi chật, không cho phép rách', () => {
  const result = fit('L', 'XL');
  assert.ok(['slightly_tight', 'tight'].includes(result.verdict));
  assert.equal(result.delta, -1);
  assert.ok(result.visualEffect.tension > 0);
  assert.equal(result.visualEffect.looseness, 0);
  assert.equal(result.visualEffect.tearAllowed, false);
  assert.ok(!result.allowedEffects.includes('small_seam_split'));
});

// --- Case 3: cực kỳ chật -----------------------------------------------------
test('Case 3 — chọn S, khuyến nghị XXL: very_tight, bắt buộc refine, cho phép bục đường may', () => {
  const result = fit('S', 'XXL');
  assert.equal(result.verdict, 'very_tight');
  assert.equal(result.delta, -4);
  assert.ok(result.severity >= 0.85);
  assert.equal(result.visualEffect.tearAllowed, true);
  assert.ok(result.allowedEffects.includes('small_seam_split'));
  assert.ok(result.allowedEffects.includes('seam_stress'));
  const plan = fitRefinePlan(result);
  assert.equal(plan.shouldRefine, true);
  assert.equal(plan.mandatory, true);
  assert.ok(garmentPreScaleDelta(result) < 0);
});

// --- Case 4: cực kỳ rộng -----------------------------------------------------
test('Case 4 — chọn XL, khuyến nghị S: very_loose, hiệu ứng rủ rộng, không có hiệu ứng rách', () => {
  const result = fit('XL', 'S');
  assert.equal(result.verdict, 'very_loose');
  assert.equal(result.delta, 3);
  assert.ok(result.visualEffect.looseness > 0.72);
  assert.equal(result.visualEffect.tension, 0);
  assert.equal(result.visualEffect.tearAllowed, false);
  assert.ok(result.allowedEffects.includes('oversized_silhouette'));
  assert.ok(!result.allowedEffects.includes('small_seam_split'));
  assert.equal(fitRefinePlan(result).mandatory, true);
  assert.ok(garmentPreScaleDelta(result) > 0);
});

// --- Case 5: thiếu dữ liệu ---------------------------------------------------
test('Case 5 — không có chiều cao/cân nặng: không crash, không bịa kết quả', () => {
  const noRecommendation = fit('M', null);
  assert.equal(noRecommendation.verdict, 'unknown');
  assert.equal(noRecommendation.severity, 0);
  assert.equal(fitRefinePlan(noRecommendation).shouldRefine, false);

  // Phân tích ảnh có độ tin cậy thấp thì KHÔNG được điền vào hồ sơ số đo.
  const lowConfidence = {
    ok: true,
    estimatedHeight: { valueCm: null, minCm: null, maxCm: null, confidence: 0.21 },
    estimatedWeight: { valueKg: null, minKg: null, maxKg: null, confidence: 0.18 },
    estimatedGirths: {},
    bodyShape: { bodyWidthRatio: 0.29 },
  };
  const merged = mergeBodySignals({}, lowConfidence);
  assert.equal(merged.usedEstimate, false);
  assert.equal(merged.profile.height, undefined);
  assert.equal(merged.profile.weight, undefined);
});

// --- Case 6: số đo thật thắng ước lượng của AI -------------------------------
test('Case 6 — khách nhập 170/65, AI đoán 180/80: hệ thống phải dùng 170/65', () => {
  const analysis = {
    ok: true,
    estimatedHeight: { valueCm: 180, minCm: 174, maxCm: 186, confidence: 0.72 },
    estimatedWeight: { valueKg: 80, minKg: 73, maxKg: 87, confidence: 0.66 },
    estimatedGirths: { bust: 104, waist: 92, hip: 108 },
    bodyShape: { bodyWidthRatio: 0.33 },
  };
  const merged = mergeBodySignals({ height: '170', weight: '65' }, analysis);
  assert.equal(String(merged.profile.height), '170');
  assert.equal(String(merged.profile.weight), '65');
  assert.equal(merged.sources.height, 'user');
  assert.equal(merged.sources.weight, 'user');
  // Vòng đo suy từ ảnh KHÔNG được đưa vào hồ sơ tính size: silhouette của một
  // người mặc quần áo là silhouette của quần áo, không phải của cơ thể.
  assert.equal(merged.profile.bust, undefined);
  assert.equal(merged.sources.bust, undefined);
});

test('ước lượng từ ảnh chỉ được dùng khi khách bỏ trống VÀ đủ độ tin cậy', () => {
  const analysis = {
    ok: true,
    estimatedHeight: { valueCm: 168, confidence: 0.61 },
    estimatedWeight: { valueKg: 60, confidence: 0.2 },
    estimatedGirths: {},
  };
  const merged = mergeBodySignals({}, analysis);
  assert.equal(Number(merged.profile.height), 168);
  assert.equal(merged.sources.height, 'image-estimation');
  // Cân nặng có confidence 0.2 < ngưỡng 0.35 -> không được dùng.
  assert.equal(merged.profile.weight, undefined);
});

test('số AI đã lưu riêng không bị nâng thành số đo thật ở request kế tiếp', () => {
  const profile = {
    height: '168', weight: '60', // dữ liệu legacy từng bị copy vào field thật
    heightEstimateCm: 168, weightEstimateKg: 60,
    heightEstimateConfidence: 0.61, weightEstimateConfidence: 0.52,
    estimateConfidence: 0.52,
    measurementSource: 'image-estimation',
  };
  assert.equal(userProvidedMeasurement(profile, 'height'), 0);
  assert.equal(userProvidedMeasurement(profile, 'weight'), 0);
  const merged = mergeBodySignals(profile, null);
  assert.equal(merged.profile.height, 168);
  assert.equal(merged.profile.weight, 60);
  assert.equal(merged.sources.height, 'image-estimation');
  assert.equal(merged.sources.weight, 'image-estimation');
});

test('số đo thật vẫn thắng estimate đã lưu theo từng trường', () => {
  const profile = {
    height: '170', weight: '',
    heightSource: 'user', weightSource: 'image-estimation',
    heightEstimateCm: 180, weightEstimateKg: 65,
    heightEstimateConfidence: 0.7, weightEstimateConfidence: 0.6,
    measurementSource: 'image-estimation',
  };
  const merged = mergeBodySignals(profile, null);
  assert.equal(Number(merged.profile.height), 170);
  assert.equal(Number(merged.profile.weight), 65);
  assert.equal(merged.sources.height, 'user');
  assert.equal(merged.sources.weight, 'image-estimation');
});

test('ảnh mới không kế thừa số đo thật của người trong ảnh trước', () => {
  const saved = {
    height: '182', weight: '91', bust: '114', waist: '100', hip: '116',
    heightSource: 'user', weightSource: 'user', measurementSource: 'user',
    heightEstimateCm: 168, weightEstimateKg: 58,
    heightEstimateConfidence: 0.7, weightEstimateConfidence: 0.6,
  };
  const imageProfile = profileForMeasurementMode(saved, 'image');
  assert.equal(userProvidedMeasurement(imageProfile, 'height'), 0);
  assert.equal(userProvidedMeasurement(imageProfile, 'weight'), 0);
  assert.equal(imageProfile.bust, '');
  assert.equal(imageProfile.waist, '');
  assert.equal(imageProfile.hip, '');
  const merged = mergeBodySignals(imageProfile, null);
  assert.equal(merged.profile.height, 168);
  assert.equal(merged.profile.weight, 58);
  assert.equal(merged.sources.height, 'image-estimation');
  assert.equal(merged.sources.weight, 'image-estimation');
});

test('chế độ số đo thật giữ nguyên dữ liệu khách nhập', () => {
  const saved = { height: '172', weight: '66', bust: '92', measurementSource: 'user' };
  const manual = profileForMeasurementMode(saved, 'user');
  assert.equal(userProvidedMeasurement(manual, 'height'), 172);
  assert.equal(userProvidedMeasurement(manual, 'weight'), 66);
  assert.equal(manual.bust, '92');
});

// --- Số đo vòng thật cho tín hiệu mịn hơn bậc size --------------------------
test('số đo vòng thật ghi đè phán quyết theo bậc size', () => {
  // Vòng ngực 112cm mà mặc áo S (bảng size 84cm) là chật thật, dù bậc size
  // được khuyến nghị có là gì đi nữa.
  const tight = analyzeFit({
    chosenSize: 'S', recommendedSize: 'M', zone: 'upper',
    profile: { bust: 112, waist: 98, hip: 118 },
  });
  assert.equal(tight.verdict, 'very_tight');
  assert.ok(tight.signals.includes('measured_ease'));

  // Ngược lại: người vòng ngực 84 mặc XXL (112cm) thì rất rộng.
  const loose = analyzeFit({
    chosenSize: 'XXL', recommendedSize: 'XL', zone: 'upper',
    profile: { bust: 84 },
  });
  assert.equal(loose.verdict, 'very_loose');
});

test('quần/váy không bao giờ được phép có hiệu ứng bục/rách', () => {
  const result = analyzeFit({ chosenSize: 'S', recommendedSize: 'XXL', zone: 'lower', category: 'bottoms' });
  assert.equal(result.verdict, 'very_tight');
  assert.equal(result.visualEffect.tearAllowed, false);
  assert.ok(!result.allowedEffects.includes('small_seam_split'));
});

test('severityFromEase phân biệt bó, vừa và thùng thình', () => {
  assert.equal(severityFromEase(-18).direction, -1);
  assert.equal(severityFromEase(4).direction, 0);
  assert.equal(severityFromEase(28).direction, 1);
  assert.ok(severityFromEase(-22).severity >= 0.9);
});

test('verdictFor giữ đúng ranh giới bảy mức', () => {
  assert.equal(verdictFor(0, 0.9), 'good');
  assert.equal(verdictFor(-1, 0.05), 'good');
  assert.equal(verdictFor(-1, 0.3), 'slightly_tight');
  assert.equal(verdictFor(-1, 0.6), 'tight');
  assert.equal(verdictFor(-1, 0.9), 'very_tight');
  assert.equal(verdictFor(1, 0.3), 'slightly_loose');
  assert.equal(verdictFor(1, 0.6), 'loose');
  assert.equal(verdictFor(1, 0.9), 'very_loose');
});

test('cờ môi trường tắt được toàn bộ hiệu ứng fit mà không phá luồng thử đồ', () => {
  const previous = process.env.JAPANO_FIT_EFFECT_ENABLED;
  process.env.JAPANO_FIT_EFFECT_ENABLED = '0';
  try {
    const plan = fitRefinePlan(fit('S', 'XXL'));
    assert.equal(plan.shouldRefine, false);
    assert.equal(plan.reason, 'disabled_by_env');
  } finally {
    if (previous === undefined) delete process.env.JAPANO_FIT_EFFECT_ENABLED;
    else process.env.JAPANO_FIT_EFFECT_ENABLED = previous;
  }
});

test('lệch fit nhẹ không tốn thêm một lượt FLUX nhưng lệch rõ vẫn refine', () => {
  const previous = process.env.JAPANO_FIT_REFINE_CLEAR_GAP_MIN_SEVERITY;
  delete process.env.JAPANO_FIT_REFINE_CLEAR_GAP_MIN_SEVERITY;
  try {
    assert.deepEqual(
      fitRefinePlan({ verdict: 'slightly_loose', severity: 0.39 }),
      { shouldRefine: false, mandatory: false, reason: 'fit_gap_too_subtle_for_cost' },
    );
    assert.deepEqual(
      fitRefinePlan({ verdict: 'slightly_tight', severity: 0.39 }),
      { shouldRefine: false, mandatory: false, reason: 'fit_gap_too_subtle_for_cost' },
    );
    assert.deepEqual(
      fitRefinePlan({ verdict: 'loose', severity: 0.6 }),
      { shouldRefine: true, mandatory: false, reason: 'clear_fit_gap' },
    );
  } finally {
    if (previous === undefined) delete process.env.JAPANO_FIT_REFINE_CLEAR_GAP_MIN_SEVERITY;
    else process.env.JAPANO_FIT_REFINE_CLEAR_GAP_MIN_SEVERITY = previous;
  }
});

test('fast preview luôn là một lượt VTON, kể cả fit cực đoan', () => {
  assert.deepEqual(
    fitRefinePlan({ verdict: 'very_tight', severity: 0.95 }, { fast: true }),
    { shouldRefine: false, mandatory: false, reason: 'fast_preview_single_pass' },
  );
  assert.equal(fitRefinePlan({ verdict: 'very_tight', severity: 0.95 }).shouldRefine, true);
});

test('ngưỡng rách có thể chỉnh bằng env và mặc định là 0.60', () => {
  const previous = process.env.JAPANO_FIT_TEAR_MIN_SEVERITY;
  process.env.JAPANO_FIT_TEAR_MIN_SEVERITY = '0.99';
  try {
    assert.equal(fit('S', 'XXL').visualEffect.tearAllowed, false);
  } finally {
    if (previous === undefined) delete process.env.JAPANO_FIT_TEAR_MIN_SEVERITY;
    else process.env.JAPANO_FIT_TEAR_MIN_SEVERITY = previous;
  }
});
