// Phân tích ĐỘ VỪA VẶN giữa vóc dáng người mặc và size trang phục đã chọn.
//
// Trước đây try-on chỉ biết `delta` (chênh lệch bậc size) và dùng nó để in một
// dòng cảnh báo chật/rộng dưới ảnh — bản thân bức ảnh thì luôn giống nhau, ai
// mặc size nào cũng vừa như nhau. Module này là tầng "suy luận fit": nó biến
// nhiều nguồn tín hiệu (bậc size, số đo vòng thật, chiều cao/cân nặng, tỉ lệ
// cơ thể đo từ ảnh) thành một mức độ nghiêm trọng liên tục `severity` và một
// bản mô tả hiệu ứng thị giác để FLUX dựng lại độ căng/độ rủ của vải.
//
// Nguyên tắc bất di bất dịch của toàn bộ tính năng:
//   GIỮ NGUYÊN CƠ THỂ NGƯỜI DÙNG — chỉ thay đổi cách vải ôm/rủ trên cơ thể đó.
// Không bao giờ làm người gầy đi để áo nhỏ vừa, cũng không làm người to ra để
// áo rộng vừa.

const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'];

// Bảng số đo chuẩn theo size (cm) — cùng nguồn với bảng trong lib/outfit.js
// (sizeFromMeasurements). Ở đây dùng để tính "ease": khoảng dư giữa vòng trang
// phục và vòng cơ thể, tức là tín hiệu fit CHÍNH XÁC HƠN bậc size rời rạc.
const SIZE_CHART = {
  S: { bust: 84, waist: 66, hip: 90 },
  M: { bust: 90, waist: 72, hip: 96 },
  L: { bust: 96, waist: 80, hip: 102 },
  XL: { bust: 104, waist: 88, hip: 110 },
  XXL: { bust: 112, waist: 98, hip: 118 },
  XXXL: { bust: 120, waist: 108, hip: 126 },
  '4XL': { bust: 128, waist: 118, hip: 134 },
  '5XL': { bust: 136, waist: 128, hip: 142 },
};

const VERDICTS = [
  'very_tight', 'tight', 'slightly_tight', 'good', 'slightly_loose', 'loose', 'very_loose', 'unknown',
];

const VERDICT_LABEL = {
  very_tight: 'RẤT CHẬT',
  tight: 'CHẬT',
  slightly_tight: 'HƠI CHẬT',
  good: 'VỪA',
  slightly_loose: 'HƠI RỘNG',
  loose: 'RỘNG',
  very_loose: 'RẤT RỘNG',
  unknown: 'CHƯA RÕ',
};

// Ngưỡng severity chia mức. Dùng chung cho cả hai chiều chật/rộng để mức độ
// "chật 2 bậc" và "rộng 2 bậc" được xử lý cân xứng.
const SEVERITY_GOOD_MAX = 0.12;
const SEVERITY_SLIGHT_MAX = 0.42;
const SEVERITY_STRONG_MAX = 0.72;

const num = (value) => {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const envNumber = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const envFlag = (name, fallback = '1') => String(process.env[name] ?? fallback).trim().toLowerCase() !== '0';

function sizeIndex(size) {
  return SIZE_ORDER.indexOf(String(size || '').toUpperCase().trim());
}

// Vùng cơ thể quyết định fit theo từng loại trang phục. Một chiếc quần chật ở
// hông/đùi chứ không phải ở ngực, nên prompt và điểm severity phải nhìn đúng
// vòng đo tương ứng.
function girthKeyFor(zone) {
  if (zone === 'lower') return 'hip';
  if (zone === 'overall') return 'bust';
  return 'bust';
}

// severity từ ease (cm dư của trang phục so với cơ thể).
// Ease dương = trang phục rộng hơn người; âm = người lớn hơn trang phục.
// Ngưỡng lấy theo kinh nghiệm may mặc: 0–8cm là vừa, âm là bó, >16cm là oversize.
function severityFromEase(easeCm) {
  const ease = Number(easeCm) || 0;
  if (ease < 0) return { direction: -1, severity: clamp01(Math.abs(ease) / 22) };
  if (ease <= 9) return { direction: 0, severity: clamp01((ease - 9) / 22) };
  return { direction: 1, severity: clamp01((ease - 9) / 24) };
}

// severity từ bậc size — tín hiệu luôn có, kể cả khi khách chưa nhập số đo nào.
function severityFromDelta(delta) {
  const steps = Math.abs(Number(delta) || 0);
  if (!steps) return 0;
  if (steps === 1) return 0.34;
  if (steps === 2) return 0.66;
  return clamp01(0.88 + (steps - 3) * 0.04);
}

function verdictFor(direction, severity) {
  if (!direction || severity <= SEVERITY_GOOD_MAX) return 'good';
  const tight = direction < 0;
  if (severity <= SEVERITY_SLIGHT_MAX) return tight ? 'slightly_tight' : 'slightly_loose';
  if (severity <= SEVERITY_STRONG_MAX) return tight ? 'tight' : 'loose';
  return tight ? 'very_tight' : 'very_loose';
}

// Hiệu ứng được phép xuất hiện trên ảnh — quality gate đọc đúng danh sách này
// để không đánh nhầm một nếp nhăn căng có chủ đích thành lỗi sinh ảnh.
function allowedEffectsFor(verdict, tearAllowed, garmentAllowsTear = true) {
  switch (verdict) {
    case 'slightly_tight': return ['fabric_tension'];
    case 'tight': return ['fabric_tension', 'seam_stress', 'button_strain'];
    case 'very_tight': {
      const effects = ['fabric_tension', 'seam_stress', 'button_strain'];
      // Với đồ bơi/đồ hở, một đường may bị tách rời cũng đồng nghĩa với việc
      // làm lộ vùng nhạy cảm — nên không chỉ cấm `small_seam_split` mà cấm luôn
      // `seam_separation`. Chật ở đây chỉ được thể hiện bằng vải căng và dây
      // hằn nhẹ.
      if (!garmentAllowsTear) return effects;
      effects.push('seam_separation');
      if (tearAllowed) effects.push('small_seam_split');
      return effects;
    }
    case 'slightly_loose': return ['extra_folds'];
    case 'loose': return ['dropped_shoulders', 'oversized_sleeves', 'extra_folds'];
    case 'very_loose': return ['dropped_shoulders', 'oversized_sleeves', 'extra_folds', 'wide_drape', 'oversized_silhouette'];
    default: return [];
  }
}

function messageFor({ verdict, chosen, recommended, severity }) {
  const pair = recommended ? `Bạn chọn ${chosen} nhưng hệ thống khuyến nghị ${recommended}.` : '';
  switch (verdict) {
    case 'good':
      return `Size ${chosen} phù hợp với vóc dáng hiện tại.`;
    case 'slightly_tight':
      return `${pair} Ảnh mô phỏng vải ôm sát hơn bình thường, vẫn mặc được.`.trim();
    case 'tight':
      return `${pair} Ảnh đang mô phỏng độ căng của vải và đường may bị kéo.`.trim();
    case 'very_tight':
      // Ngưỡng trong câu thông báo phải khớp ngưỡng thật của hiệu ứng, nếu không
      // khách thấy đường may bục trên ảnh mà chữ lại không nói gì.
      return `${pair} Vải được mô phỏng căng mạnh${severity >= envNumber('JAPANO_FIT_TEAR_MIN_SEVERITY', 0.60) ? ' và có bục một đoạn đường may vì cỡ này quá chật so với cơ thể' : ''}.`.trim();
    case 'slightly_loose':
      return `${pair} Ảnh mô phỏng form hơi rộng, có thêm nếp gấp.`.trim();
    case 'loose':
      return `${pair} Ảnh đang mô phỏng vai trễ, tay áo rộng và nhiều nếp rủ.`.trim();
    case 'very_loose':
      return `${pair} Ảnh đang mô phỏng form rất rộng, thân áo thùng thình và rủ như áo choàng.`.trim();
    default:
      return '';
  }
}

function titleFor(verdict) {
  switch (verdict) {
    case 'good': return '✓ Size phù hợp';
    case 'slightly_tight': return '⚠ Hơi chật';
    case 'tight': return '⚠ Chật';
    case 'very_tight': return '⚠ Quá chật';
    case 'slightly_loose': return '⚠ Hơi rộng';
    case 'loose': return '⚠ Rộng';
    case 'very_loose': return '⚠ Quá rộng';
    default: return '';
  }
}

// Tín hiệu vóc dáng: số đo thật của khách được ưu tiên, ảnh chỉ bổ sung phần
// còn thiếu (xem thứ tự ưu tiên đầy đủ ở lib/bodyAnalysis.js).
function bodyProfileFrom(profile = {}, bodyAnalysis = null) {
  const heightCm = num(profile.height ?? profile.heightCm);
  const weightKg = num(profile.weight ?? profile.weightKg);
  const shape = bodyAnalysis?.bodyShape || {};
  const result = {};
  if (heightCm) result.heightCm = heightCm;
  if (weightKg) result.weightKg = weightKg;
  if (heightCm && weightKg) result.bmiProxy = Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
  if (Number.isFinite(shape.bodyWidthRatio) && shape.bodyWidthRatio > 0) result.bodyWidthRatio = shape.bodyWidthRatio;
  if (Number.isFinite(shape.shoulderHipRatio) && shape.shoulderHipRatio > 0) result.shoulderHipRatio = shape.shoulderHipRatio;
  return Object.keys(result).length ? result : undefined;
}

/**
 * Phân tích fit đầy đủ.
 *
 * @param {object} input
 * @param {string} input.chosenSize      size khách bấm chọn
 * @param {string|null} input.recommendedSize  size hệ thống khuyến nghị (từ adviseSize)
 * @param {object} [input.profile]       hồ sơ số đo đã hợp nhất (thật > ước lượng)
 * @param {object} [input.bodyAnalysis]  kết quả body_analysis.py (có thể null)
 * @param {'upper'|'lower'|'overall'} [input.zone] vùng cơ thể của món chính
 * @param {'tops'|'bottoms'|'one-pieces'} [input.category] danh mục FASHN
 */
function analyzeFit(options = {}) {
  const {
    chosenSize, recommendedSize, profile = {}, bodyAnalysis = null,
    zone = 'upper', category = 'tops',
  } = options;
  // Thiếu size phải là unknown; không được biến sản phẩm không-size thành M.
  const chosen = String(chosenSize || '').toUpperCase();
  const chosenIndex = sizeIndex(chosen);
  const recommended = recommendedSize ? String(recommendedSize).toUpperCase() : null;
  const recommendedIndex = recommended ? sizeIndex(recommended) : -1;

  if (chosenIndex < 0 || recommendedIndex < 0) {
    return {
      chosenSize: chosen,
      chosen,
      recommendedSize: recommended,
      recommended,
      delta: 0,
      verdict: 'unknown',
      severity: 0,
      label: VERDICT_LABEL.unknown,
      title: '',
      zone,
      category,
      visualEffect: { tension: 0, looseness: 0, seamStress: 0, tearAllowed: false },
      allowedEffects: [],
      message: '',
      signals: ['size_unknown'],
    };
  }

  const delta = chosenIndex - recommendedIndex;
  const signals = ['size_delta'];
  let direction = Math.sign(delta);
  let severity = severityFromDelta(delta);

  // Số đo vòng thật cho phép tính ease bằng cm — tín hiệu mạnh hơn bậc size,
  // vì hai người cùng được khuyên size L vẫn có thể lệch nhau 10cm vòng ngực.
  const girthKey = girthKeyFor(zone);
  const bodyGirth = num(profile[girthKey] ?? profile[`${girthKey}Cm`]
    ?? (girthKey === 'bust' ? profile.chest : undefined));
  const chartGirth = SIZE_CHART[chosen]?.[girthKey];
  if (bodyGirth && chartGirth) {
    const ease = chartGirth - bodyGirth;
    const fromEase = severityFromEase(ease);
    signals.push('measured_ease');
    if (fromEase.direction) {
      direction = fromEase.direction;
      // Ease đo bằng cm là tín hiệu MẠNH NHẤT: nó so trực tiếp vòng cơ thể với
      // vòng của chính chiếc áo đang mặc. Bậc size chỉ được phép đẩy mức độ lên
      // cao hơn, không bao giờ được kéo nó xuống — người vòng ngực 100cm mặc áo
      // 90cm là chật thật, kể cả khi bảng size vẫn khuyên đúng size đó.
      severity = clamp01(Math.max(fromEase.severity, severity * 0.45 + fromEase.severity * 0.55));
      if (Math.sign(delta) === fromEase.direction) {
        severity = clamp01(Math.max(severity, severityFromDelta(delta)));
      }
    } else {
      // Số đo cho thấy vừa vặn: tin số đo, hạ mức cảnh báo theo bậc size xuống.
      severity = clamp01(severity * 0.45);
    }
  } else if (delta) {
    // Không có số đo vòng: BMI và tỉ lệ bề ngang đo từ ảnh dùng làm hiệu chỉnh
    // nhẹ. Người BMI cao mặc size nhỏ thì căng hơn hẳn người BMI thấp cùng bậc.
    const body = bodyProfileFrom(profile, bodyAnalysis) || {};
    if (delta < 0 && Number.isFinite(body.bmiProxy)) {
      signals.push('bmi_proxy');
      if (body.bmiProxy >= 27) severity = clamp01(severity + 0.08);
      if (body.bmiProxy >= 32) severity = clamp01(severity + 0.07);
    }
    if (delta > 0 && Number.isFinite(body.bmiProxy) && body.bmiProxy <= 19) {
      signals.push('bmi_proxy');
      severity = clamp01(severity + 0.08);
    }
    if (Number.isFinite(body.bodyWidthRatio)) {
      signals.push('image_body_ratio');
      if (delta < 0 && body.bodyWidthRatio >= 0.34) severity = clamp01(severity + 0.05);
      if (delta > 0 && body.bodyWidthRatio <= 0.24) severity = clamp01(severity + 0.05);
    }
  }

  const verdict = verdictFor(direction, severity);
  // 0.85 gần như không bao giờ chạm tới: đo trên đường cong severity thì 55kg
  // chọn S mới 0.34 và 70kg chọn S là 0.66 — cả hai đều dưới ngưỡng, nên người
  // mặc chật thật vẫn nhận về một tấm ảnh phẳng lì như vừa in. 0.60 cho đúng
  // nhóm "chật rõ rệt" thấy được hệ quả, mà vẫn nằm trong `very_tight`.
  //
  // Ba tầng chặn phía dưới KHÔNG đổi: không rách ở thân dưới, không rách với đồ
  // bơi/crop/short, và vết bục vẫn đi qua applySafeSeamSplit rồi mới tới cổng độ
  // che phủ — tức là rách để thấy chật, không phải rách để hở vùng nhạy cảm.
  const tearMinSeverity = envNumber('JAPANO_FIT_TEAR_MIN_SEVERITY', 0.60);
  const tearAllowed = verdict === 'very_tight' && severity >= tearMinSeverity && envFlag('JAPANO_FIT_TEAR_ENABLED');
  // Ba tầng chặn độc lập cho hiệu ứng bục đường may:
  //   1. Quần/váy — vùng đó rất dễ tạo ảnh phản cảm.
  //   2. Loại trang phục tự cấm (đồ bơi, bikini, crop top, short, váy ngắn) —
  //      xem lib/garmentCoverage.js. Với đồ bơi, một vết bục đồng nghĩa với
  //      việc làm lộ vùng nhạy cảm, nên đây là cấm tuyệt đối.
  //   3. Lời gọi truyền thẳng garmentTearAllowed = false.
  const garmentAllowsTear = options.garmentTearAllowed !== false;
  const tearSafe = tearAllowed && zone !== 'lower' && garmentAllowsTear;
  const tension = direction < 0 ? severity : 0;
  const looseness = direction > 0 ? severity : 0;
  const seamStress = direction < 0 ? clamp01(severity * (zone === 'lower' ? 0.7 : 1)) : 0;

  return {
    chosenSize: chosen,
    chosen,
    recommendedSize: recommended,
    recommended,
    delta,
    verdict,
    severity: Math.round(severity * 100) / 100,
    label: VERDICT_LABEL[verdict],
    title: titleFor(verdict),
    zone,
    category,
    bodyProfile: bodyProfileFrom(profile, bodyAnalysis),
    visualEffect: {
      tension: Math.round(tension * 100) / 100,
      looseness: Math.round(looseness * 100) / 100,
      seamStress: Math.round(seamStress * 100) / 100,
      tearAllowed: tearSafe,
    },
    allowedEffects: allowedEffectsFor(verdict, tearSafe, garmentAllowsTear),
    garmentTearAllowed: garmentAllowsTear,
    message: messageFor({ verdict, chosen, recommended, severity }),
    signals,
  };
}

/**
 * Có chạy lượt FLUX fit-refine hay không.
 *
 * FLUX là bước đắt nhất của cả pipeline (nạp ~15GB lên GPU 16GB), nên phải
 * tiết kiệm: ảnh vừa size thì không refine, lệch nhẹ chỉ refine khi severity
 * vượt ngưỡng cấu hình, lệch nhiều thì bắt buộc.
 */
function fitRefinePlan(fit, options = {}) {
  const disabled = !envFlag('JAPANO_FIT_EFFECT_ENABLED');
  if (disabled) return { shouldRefine: false, mandatory: false, reason: 'disabled_by_env' };
  // `qualityMode=fast` phải thật sự là một lượt VTON. Trước đây fast chỉ giảm
  // số bước FASHN nhưng vẫn có thể nối thêm cả lượt FLUX 30–60 giây, khiến một
  // ca hơi rộng trên Redmi lên 117 giây tổng. API vẫn có thể yêu cầu mô phỏng
  // fit chi tiết bằng `fitEffect:true`; mặc định fast ưu tiên trả ảnh trước.
  if (options.fast === true) {
    return { shouldRefine: false, mandatory: false, reason: 'fast_preview_single_pass' };
  }
  if (!fit || fit.verdict === 'unknown' || fit.verdict === 'good') {
    return { shouldRefine: false, mandatory: false, reason: 'fit_good' };
  }
  const minSeverity = envNumber('JAPANO_FIT_REFINE_MIN_SEVERITY', 0.35);
  if (fit.verdict === 'very_tight' || fit.verdict === 'very_loose') {
    return { shouldRefine: true, mandatory: true, reason: 'extreme_fit' };
  }
  if (['slightly_tight', 'tight', 'slightly_loose', 'loose'].includes(fit.verdict)) {
    // Lượt fit-refine là MỘT LƯỢT FLUX ĐẦY ĐỦ. Đo qua storefront ngày
    // 2026-09-02: lượt không refine mất 24,5-28,3 giây, lượt có refine lên
    // 45,3-64,1 giây — tức là nó chiếm 20-35 giây, phần lớn thời gian chờ của
    // khách. Trong khi ca kích hoạt điển hình lại rất nhẹ: log thật cho
    // `looseness=0.39, tension=0`, tức chỉ hơi rủ.
    //
    // Chênh lệch nhẹ thì không đáng nửa phút chờ. Phải gồm cả
    // `slightly_tight`/`slightly_loose`: đây chính là ca thực tế L so với M có
    // severity=0.39 từng vô tình lọt xuống ngưỡng 0.35 và làm Redmi chờ 65s ở
    // backend cho một lượt FLUX gần như không nhìn thấy khác biệt.
    // `very_tight`/`very_loose` ở nhánh trên vẫn luôn được dựng vì đó mới là
    // thứ khách cần thấy.
    const clearGapMin = envNumber('JAPANO_FIT_REFINE_CLEAR_GAP_MIN_SEVERITY', 0.55);
    return fit.severity >= clearGapMin
      ? { shouldRefine: true, mandatory: false, reason: 'clear_fit_gap' }
      : { shouldRefine: false, mandatory: false, reason: 'fit_gap_too_subtle_for_cost' };
  }
  return fit.severity >= minSeverity
    ? { shouldRefine: true, mandatory: false, reason: 'severity_above_threshold' }
    : { shouldRefine: false, mandatory: false, reason: 'severity_below_threshold' };
}

// Tín hiệu phụ gửi kèm cho bước chỉnh khổ vải trước VTON (adjust_garment_fit).
// Cố ý rất nhẹ tay: đây CHỈ là gợi ý hình học, hiệu ứng fit thật do FLUX dựng.
function garmentPreScaleDelta(fit) {
  if (!fit || fit.verdict === 'unknown' || fit.verdict === 'good') return 0;
  const magnitude = fit.severity >= 0.72 ? 2 : 1;
  return (fit.visualEffect.tension > 0 ? -1 : 1) * magnitude;
}

module.exports = {
  SIZE_ORDER,
  SIZE_CHART,
  VERDICTS,
  VERDICT_LABEL,
  analyzeFit,
  fitRefinePlan,
  garmentPreScaleDelta,
  allowedEffectsFor,
  severityFromDelta,
  severityFromEase,
  verdictFor,
  sizeIndex,
};
