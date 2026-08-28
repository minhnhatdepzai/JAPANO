// Thử đồ thật bằng FASHN VTON 1.5. FLUX.2 chỉ đổi tư thế khi bộ phân tích pose
// xác định tay/vật đang che thân; CatVTON là fallback có kiểm định chất lượng.
// Đây là domain lớn nhất trong backend nên tách riêng khỏi các domain khác.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveGarmentImage, resolveAccessoryImage } = require('../lib/garmentImages');
const { fetchWithTimeout, serviceHealth } = require('../lib/httpFetch');
const { CATVTON_URL, FASHN_URL, MOTION_URL, MOTION_ENGINE_LABEL, OLLAMA_URL } = require('../lib/serviceUrls');
const { FORCE_REPOSE, FASHN_FIDELITY_REFINE } = require('../lib/tryonConfig');
const { runGpuJob, GpuJobCancelledError, setFocus, getFocus } = require('../lib/gpuArbiter');
const { SIZE_ORDER, analyzeFit, fitRefinePlan, garmentPreScaleDelta } = require('../lib/fitAnalysis');
const {
  mergeBodySignals, summarizeBodyAnalysis, bodyAnalysisLogLine, bodyAnalysisEnabled, analyzeViaWorker,
  userProvidedMeasurement, profileForMeasurementMode, imageFingerprint,
} = require('../lib/bodyAnalysis');
const { availableSizesFor } = require('../lib/outfit');
const { logger } = require('../lib/logger');
const {
  garmentTypeFor, coverageProfileFor, safetyPolicyFor,
} = require('../lib/garmentCoverage');
const { evaluateAdultGate, adultGateLogLine } = require('../lib/adultTryonPolicy');
const { checkAdultImage } = require('../lib/adultImageCheck');

function stripDataUri(value) {
  const text = String(value || '');
  return text.startsWith('data:') && text.includes(',') ? text.slice(text.indexOf(',') + 1) : text;
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new GpuJobCancelledError();
}

const ACCESSORY_QUALITY_LABELS = {
  main_subject_lost:'không nhận rõ nhân vật chính',
  face_changed_or_covered:'khuôn mặt bị thay đổi hoặc che khuất',
  hat_obscures_eyes:'mũ đang che mắt',
  garment_fidelity_changed:'trang phục bị lệch mẫu',
  hand_pose_not_engaged:'tay chưa cầm phụ kiện tự nhiên',
  hat_missing:'chưa nhận rõ mũ',
  hair_clip_missing:'chưa nhận rõ kẹp tóc',
  earmuffs_missing:'chưa nhận rõ chụp tai',
  shoe_missing:'chưa nhận rõ dép/giày ở bàn chân',
  accessory_quality_check_failed:'không chấm được chất lượng phụ kiện',
};
const MAX_TRYON_ACCESSORIES = 3;

function choosePassingAccessoryCandidate(candidates) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => (
      candidate?.image
      && candidate?.quality?.ok
      && candidate.stage !== 'accessory-pose-fallback'
    ))
    .sort((a, b) => Number(a.quality?.score ?? 9999) - Number(b.quality?.score ?? 9999))[0] || null;
}
const accessoryQualityLabels = (reasons = []) => reasons.map((reason) => ACCESSORY_QUALITY_LABELS[reason] || reason);

function normalizeImageResult(data) {
  if (!data) return '';
  const raw = data.finalImageBase64 || data.imageBase64 || data.result?.imageBase64 || data.result?.finalImageBase64 || data.urls?.[0] || data.imageUrl || '';
  if (!raw) return '';
  const value = String(raw);
  return value.startsWith('data:') || value.startsWith('http') ? value : `data:image/png;base64,${value}`;
}

// Phân vùng cơ thể cho VTON. Sai ở đây là sai nặng: FASHN nhận `bottoms` hay
// `tops` từ hàm này, nên một chiếc hakama bị đoán nhầm thành áo sẽ được model
// mặc lên thân trên của khách.
//
// Bảng phân loại thật nằm ở lib/garmentCoverage.js — nơi mỗi loại trang phục
// khai báo tường minh cả vùng cơ thể lẫn ĐỘ CHE PHỦ. Ở đây chỉ lấy ra phần
// vùng cơ thể để giữ nguyên giao diện cũ của pipeline.
function clothTypeFor(product = {}) {
  return coverageProfileFor(product).zone;
}

// Mặc thử NHIỀU món cùng lúc (áo + quần + phụ kiện).
//
// FASHN VTON thay đúng MỘT lớp mỗi lượt, nên nhiều món được ghép nối tiếp:
// quần/váy → áo trong → áo khoác ngoài. Hai món thân trên vẫn hợp lệ nếu một
// món là lớp trong và món kia là Haori/áo khoác. Đây chính là cách phối sơ mi +
// Haori; chỉ chặn hai món cùng một lớp vì lượt sau sẽ xoá món trước.
function garmentLayerFor(product = {}) {
  return coverageProfileFor(product).layer;
}

function shouldRefineGarment(product, garmentImagePath, fidelityFlag = FASHN_FIDELITY_REFINE) {
  const isFlatLay = /_tryon-flat\.(?:jpe?g|png|webp)$/i.test(path.basename(String(garmentImagePath || '')));
  // Áo khoác mở phía trước rất dễ bị VTON rút thành áo ngắn và xoá áo trong.
  // Với flat-lay đã duyệt, luôn chạy lượt đối chiếu cấu trúc cho lớp ngoài;
  // cờ toàn cục vẫn điều khiển các loại trang phục còn lại.
  return isFlatLay && (fidelityFlag || garmentLayerFor(product) === 'upper-outer');
}

// Quần/váy được mặc trước để áo nằm ngoài cạp; lớp khoác luôn đi sau áo trong,
// kể cả khi khách mở màn hình từ sản phẩm Haori rồi mới chọn sơ mi.
const GARMENT_LAYER_ORDER = { lower: 0, 'upper-base': 1, 'upper-outer': 2, overall: 3 };

function resolveOutfitGarments(state, requestedIds, httpError) {
  const seen = new Set();
  const garments = [];
  for (const rawId of requestedIds) {
    const id = String(rawId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const product = state.products.find((item) => item.slug === id || item.id === id);
    if (!product) throw httpError(404, `Không tìm thấy sản phẩm "${id}".`);
    if ((product.cat || product.category) === 'phu-kien') {
      throw httpError(400, `"${product.name}" là phụ kiện — hãy chọn ở mục phụ kiện thay vì mục trang phục.`);
    }
    const imagePath = resolveGarmentImage(product.slug);
    if (!imagePath) throw httpError(404, `Không tìm thấy ảnh sản phẩm để ghép cho "${product.name}".`);
    garments.push({ product, imagePath, zone: clothTypeFor(product), layer: garmentLayerFor(product) });
  }
  if (!garments.length) throw httpError(400, 'Chưa chọn trang phục nào để thử.');

  const overall = garments.find((item) => item.zone === 'overall');
  if (overall && garments.length > 1) {
    throw httpError(400, `"${overall.product.name}" là bộ liền thân đã phủ kín người, không thể mặc chồng thêm món khác. Hãy thử riêng bộ này, hoặc bỏ nó ra để phối áo với quần.`);
  }
  const lower = garments.filter((item) => item.zone === 'lower');
  if (lower.length > 1) {
    throw httpError(400, `Chỉ mặc thử được một món thân dưới mỗi lượt. Bạn đang chọn ${lower.map((item) => `"${item.product.name}"`).join(' và ')}.`);
  }
  for (const layer of ['upper-base', 'upper-outer']) {
    const inLayer = garments.filter((item) => item.layer === layer);
    if (inLayer.length > 1) {
      const label = layer === 'upper-outer' ? 'áo khoác ngoài' : 'áo lớp trong';
      throw httpError(400, `Chỉ mặc thử được một ${label} mỗi lượt. Bạn đang chọn ${inLayer.map((item) => `"${item.product.name}"`).join(' và ')}.`);
    }
  }
  return garments.sort((left, right) => GARMENT_LAYER_ORDER[left.layer] - GARMENT_LAYER_ORDER[right.layer]);
}

// Đi bộ đứng đầu và là lựa chọn mặc định. Trước đây danh sách chỉ có mỗi
// 'pose_sway' — kiểu lắc hông tạo dáng, nhìn gượng và không giống người thật đi
// lại, trong khi khách chỉ muốn thấy bộ đồ rủ và chuyển động thế nào khi mình
// bước đi bình thường. Bước đi đã được cài đặt sẵn ở one_to_all_runner.py
// (cả prompt lẫn quỹ đạo khớp) nhưng chưa bao giờ được mở ra cho người dùng.
const MOTION_PRESETS = [
  { id:'walk_natural', label:'Đi bộ tự nhiên', icon:'walk-outline' },
  { id:'turn_show', label:'Xoay một vòng', icon:'sync-outline' },
  { id:'pose_sway', label:'Tạo dáng tại chỗ', icon:'body-outline' },
];
const DEFAULT_MOTION = MOTION_PRESETS[0].id;

// Ước lượng size phù hợp và mức độ lệch so với size khách chọn.
//
// Kết quả KHÔNG còn chỉ là một dòng cảnh báo dưới ảnh: `severity` và
// `visualEffect` ở đây chính là đầu vào điều khiển bước FLUX fit-refine, tức là
// thứ quyết định bức ảnh cuối cùng trông chật hay rộng. Xem lib/fitAnalysis.js.
//
// Không co giãn ảnh catalog trước inference như một cách "giả" độ vừa vặn: thao
// tác đó làm sai hoa văn/phom và là một nguyên nhân khiến engine cũ tạo ra tấm
// vải hình chữ nhật. Chỉnh khổ vải chỉ là tín hiệu phụ rất nhẹ (xem
// garmentPreScaleDelta), hiệu ứng thật do model chỉnh ảnh dựng lại.
//
// Factory nhận adviseSize làm tham số (thay vì đọc thẳng ctx) để test được độc
// lập, không cần dựng cả registerTryonRoutes.
function makeComputeSizeFit(adviseSize) {
  return function computeSizeFit(chosenSizeRaw, profile, options = {}) {
    const chosen = String(chosenSizeRaw || '').toUpperCase();
    if (!profile || SIZE_ORDER.indexOf(chosen) < 0) {
      return analyzeFit({ chosenSize: chosen, recommendedSize: null, ...options });
    }
    const advice = adviseSize(profile, options.product || null);
    const tearBecauseNoSizeFits = Boolean(advice.outsideAvailableRange && options.tearWhenOutOfRange);
    const fit = analyzeFit({
      chosenSize: chosen,
      // Chấm độ chật/rộng theo cỡ cơ thể lý tưởng, nhưng bên ngoài chỉ khuyên
      // một size sản phẩm thật sự đang bán.
      recommendedSize: advice.fitReferenceSize || advice.size || null,
      profile,
      zone: options.zone || 'upper',
      category: options.category || 'tops',
      bodyAnalysis: options.bodyAnalysis || null,
      // Lệnh cấm bục có hai loại, và chỉ một loại được nới khi hết size.
      //
      //   tearBlockReason='safety'       (đồ bơi, crop top, short, váy ngắn)
      //       tuyệt đối. Hết size KHÔNG phải lý do để làm hở thêm cơ thể.
      //   tearBlockReason='construction' (kimono, yukata, haori, áo khoác)
      //       cấm vì phải giữ đúng kết cấu. Nhưng khi cơ thể đã vượt mọi size
      //       đang bán, một đường may bục vẫn trung thực hơn tấm ảnh phẳng lì.
      //
      // Bản trước chỉ có một boolean nên `|| tearBecauseNoSizeFits` nới cho CẢ
      // HAI — crop top bị cấm vì hở bụng vẫn bị bật cho rách khi hết size.
      garmentTearAllowed: options.garmentTearAllowed !== false
        || (tearBecauseNoSizeFits && options.tearBlockReason !== 'safety'),
    });
    return {
      ...fit,
      recommendedSize: advice.size || null,
      recommended: advice.size || null,
      idealSize: advice.idealSize || null,
      availableSizes: advice.availableSizes || [],
      sizingMode: advice.sizingMode || 'unknown',
      outsideAvailableRange: Boolean(advice.outsideAvailableRange),
      tearBecauseNoSizeFits,
      sizeAdvice: advice.advice || '',
      message: advice.outsideAvailableRange ? `${fit.message} ${advice.advice}`.trim() : fit.message,
    };
  };
}

// Phân loại danh mục FASHN cho sản phẩm — chỉ phụ thuộc tên/tag nên đặt ở scope
// module để test trực tiếp, không cần ctx.
function fashnCategoryFor(product = {}) {
  return coverageProfileFor(product).fashnCategory;
}

module.exports = function registerTryonRoutes(api, ctx) {
  const {
    read, update, httpError, adviseSize, runAccessoryPipeline, accessoryKind,
    tryonGpuBusy, MOTION_OUTPUT_DIR, analyzePortrait,
  } = ctx;
  const computeSizeFit = makeComputeSizeFit(adviseSize);

  // Chỉnh khổ ảnh vải trước khi gửi cho VTON — CHỈ là tín hiệu phụ rất nhẹ để
  // model có sẵn một chút thiên hướng bó/rộng. Hiệu ứng vừa vặn thật sự (vải
  // căng, đường may bục, form rủ thùng thình) do bước FLUX fit-refine dựng lại
  // sau VTON; crop/scale ảnh vải không phải là mô phỏng fit.
  //
  // Tên file tạm phải GIỮ NGUYÊN tên gốc ở cuối: cả garment_photo_type
  // ('flat-lay' hay 'model') lẫn shouldRefineGarment đều nhận dạng bằng hậu tố
  // `_tryon-flat`. Đặt tên tuỳ tiện ở đây từng khiến flat-lay đã duyệt bị gửi đi
  // như ảnh người mẫu.
  async function adjustGarmentForFit(garmentImagePath, fitDelta) {
    if (!fitDelta) return garmentImagePath;
    try {
      const imageBase64 = fs.readFileSync(garmentImagePath).toString('base64');
      const result = await runAccessoryPipeline({ mode: 'fit_adjust', imageBase64, fitDelta }, 20000);
      if (!result.ok || !result.imageBase64) return garmentImagePath;
      const tempPath = path.join(os.tmpdir(), `japano-fit-${Date.now()}-${path.basename(garmentImagePath)}`);
      fs.writeFileSync(tempPath, Buffer.from(result.imageBase64, 'base64'));
      return tempPath;
    } catch { return garmentImagePath; }
  }

  // Một số ảnh (tư thế lạ, tay che ngực...) khiến CatVTON không nhận diện được
  // vùng trang phục và âm thầm trả gần như nguyên ảnh gốc dù HTTP 200 OK — kiểm
  // tra độ khác biệt để không báo "thành công" giả trong trường hợp đó.
  const GARMENT_UNCHANGED_THRESHOLD = 10;
  // eslint-disable-next-line no-unused-vars
  async function isGarmentUnchanged(personImageBase64, resultImage, pose, clothType) {
    if (!resultImage || !resultImage.startsWith('data:')) return false;
    try {
      const compareImageBase64 = resultImage.slice(resultImage.indexOf(',') + 1);
      const result = await runAccessoryPipeline({ mode: 'similarity', imageBase64: personImageBase64, compareImageBase64, pose, clothType }, 20000);
      return result.ok && typeof result.score === 'number' && result.score < GARMENT_UNCHANGED_THRESHOLD;
    } catch { return false; }
  }

  // `fitEffect` cho cổng chất lượng biết hiệu ứng vừa vặn nào là CÓ CHỦ ĐÍCH,
  // để một chiếc áo bị kéo căng (bề mặt phẳng, ít kết cấu hơn) không bị đánh
  // nhầm thành ảnh mờ/hỏng.
  async function validateTryOnResult(personImageBase64, resultImage, pose, clothType, requireStraightPose = false, fitEffect = null, strictIdentity = true) {
    if (!resultImage || !resultImage.startsWith('data:')) return { ok: true, reasons: [] };
    try {
      const compareImageBase64 = resultImage.slice(resultImage.indexOf(',') + 1);
      const checked = await runAccessoryPipeline({
        mode: 'quality', imageBase64: personImageBase64, compareImageBase64,
        pose, clothType, requireStraightPose, fitEffect, strictIdentity,
      }, 90000);
      return checked.ok && checked.quality ? checked.quality : { ok: false, reasons: ['quality_check_failed'] };
    } catch (error) {
      return { ok: false, reasons: [`quality_check_error:${error.message}`] };
    }
  }

  async function validateAccessoryResult(cleanImage, resultImage, kinds) {
    if (!cleanImage?.startsWith('data:') || !resultImage?.startsWith('data:')) {
      return { ok:false, reasons:['accessory_quality_input_invalid'], score:9999 };
    }
    try {
      const checked = await runAccessoryPipeline({
        mode:'accessory_quality',
        imageBase64:stripDataUri(cleanImage),
        compareImageBase64:stripDataUri(resultImage),
        kinds,
      }, 90000);
      return checked.ok && checked.quality
        ? checked.quality
        : { ok:false, reasons:['accessory_quality_check_failed'], score:9999 };
    } catch (error) {
      return { ok:false, reasons:[`accessory_quality_error:${error.message}`], score:9999 };
    }
  }

  async function tryFashn(
    personImageBase64,
    garmentImagePath,
    product,
    shouldRepose = false,
    generationAttempt = 0,
    signal,
    skipFidelity = false,
  ) {
    const form = new FormData();
    const person = Buffer.from(stripDataUri(personImageBase64), 'base64');
    const garment = fs.readFileSync(garmentImagePath);
    form.append('person', new Blob([person], { type: 'image/jpeg' }), 'person.jpg');
    form.append('cloth', new Blob([garment], { type: 'image/jpeg' }), path.basename(garmentImagePath));
    form.append('category', fashnCategoryFor(product));
    const garmentPhotoType = /_tryon-flat\.(?:jpe?g|png|webp)$/i.test(path.basename(garmentImagePath)) ? 'flat-lay' : 'model';
    form.append('garment_photo_type', garmentPhotoType);
    // Khi phía sau đã có fit-refine thì không chạy thêm một lượt FLUX fidelity
    // trên cùng ảnh. Hai lượt liên tiếp vừa tốn thời gian vừa tranh 16 GB VRAM;
    // fit-refine đã nhận chính ảnh flat-lay để khóa cổ, nút và form áo.
    const shouldRefine = !skipFidelity && shouldRefineGarment(product, garmentImagePath);
    form.append('refine', shouldRefine ? 'true' : 'false');
    form.append('repose', shouldRepose ? 'true' : 'false');
    form.append('seed', String(Number(process.env.JAPANO_FASHN_SEED || 42) + generationAttempt * 101));
    const response = await fetchWithTimeout(
      `${FASHN_URL}/tryon`,
      { method: 'POST', body: form, signal },
      Number(process.env.JAPANO_TRYON_TIMEOUT_MS || 900000),
    );
    if (!response.ok) {
      let detail = '';
      try { detail = String((await response.json()).detail || ''); } catch {}
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    const type = String(response.headers.get('content-type') || 'image/png');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error('FASHN không trả ảnh');
    // Chẩn đoán: ghi đúng ba tấm ảnh đi vào và đi ra khỏi FASHN. Khi ảnh kết quả
    // là một người khác hẳn, đây là cách duy nhất biết lỗi nằm ở đầu vào hay ở
    // mô hình. Mặc định TẮT; chỉ bật khi gỡ lỗi bằng ảnh test.
    const dbg = String(process.env.JAPANO_TRYON_DEBUG_DIR || '').trim();
    if (dbg) {
      try {
        fs.mkdirSync(dbg, { recursive: true });
        const stamp = Date.now();
        fs.writeFileSync(`${dbg}/${stamp}-fashn-person.jpg`, person);
        fs.writeFileSync(`${dbg}/${stamp}-fashn-cloth.jpg`, garment);
        fs.writeFileSync(`${dbg}/${stamp}-fashn-out.png`, bytes);
        logger.info(`[TRYON DEBUG] person=${person.length}B cloth=${path.basename(garmentImagePath)} photoType=${garmentPhotoType} repose=${shouldRepose}`);
      } catch (error) {
        logger.warn(`[TRYON DEBUG] không ghi được: ${error.message}`);
      }
    }
    return {
      image: `data:${type.startsWith('image/') ? type.split(';')[0] : 'image/png'};base64,${bytes.toString('base64')}`,
      engine: String(response.headers.get('x-japano-engine') || 'fashn-vton-1.5'),
      reposed: String(response.headers.get('x-japano-reposed') || '').toLowerCase() === 'true',
    };
  }

  async function tryAccessoryRefine(roughImage, cleanImage, accessories, generationAttempt = 0, signal) {
    const form = new FormData();
    const rough = Buffer.from(stripDataUri(roughImage), 'base64');
    const clean = Buffer.from(stripDataUri(cleanImage), 'base64');
    form.append('rough', new Blob([rough], { type:'image/png' }), 'rough.png');
    form.append('clean', new Blob([clean], { type:'image/png' }), 'clean.png');
    const metadata = [];
    for (const item of accessories.slice(0, 4)) {
      if (!item.imagePath || !fs.existsSync(item.imagePath)) continue;
      const bytes = fs.readFileSync(item.imagePath);
      form.append('accessories', new Blob([bytes], { type:'image/jpeg' }), path.basename(item.imagePath));
      metadata.push({ id:item.id, name:item.name, kind:item.kind });
    }
    if (!metadata.length) throw new Error('Không có ảnh phụ kiện để làm đẹp.');
    form.append('metadata', JSON.stringify(metadata));
    form.append('seed', String(Number(process.env.JAPANO_ACCESSORY_REFINE_SEED || 101) + generationAttempt * 137));
    const response = await fetchWithTimeout(
      `${FASHN_URL}/accessory-refine`,
      { method:'POST', body:form, signal },
      Number(process.env.JAPANO_ACCESSORY_REFINE_TIMEOUT_MS || 420000),
    );
    if (!response.ok) {
      let detail = '';
      try { detail = String((await response.json()).detail || ''); } catch {}
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    const type = String(response.headers.get('content-type') || 'image/png');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error('FLUX accessory refiner không trả ảnh.');
    return {
      image:`data:${type.startsWith('image/') ? type.split(';')[0] : 'image/png'};base64,${bytes.toString('base64')}`,
      engine:String(response.headers.get('x-japano-engine') || 'flux2-klein-4b-accessory-refine'),
    };
  }

  // Mô phỏng độ vừa vặn bằng FLUX.2 trên ảnh ĐÃ mặc đồ xong.
  //
  // Thứ tự này là cố ý: FASHN giữ đúng màu/hoạ tiết/kết cấu trang phục, sau đó
  // model chỉnh ảnh mới sửa CÁCH bộ đồ nằm trên cơ thể. Làm ngược lại (bóp méo
  // ảnh vải trước khi vào VTON) sẽ phá luôn thiết kế sản phẩm.
  async function tryFitRefine(tryonImage, garmentImagePath, fit, product, attempt = 0, signal) {
    const form = new FormData();
    const person = Buffer.from(stripDataUri(tryonImage), 'base64');
    form.append('person', new Blob([person], { type:'image/png' }), 'tryon.png');
    // Ảnh vải chỉ được gửi kèm khi là flat-lay ĐÃ DUYỆT (nền trắng, không có
    // người). Ảnh sản phẩm chụp trên người mẫu làm FLUX bám vào khung cảnh của
    // ảnh đó và trả về một người hoàn toàn khác — đã dựng lại được lỗi này khi
    // chạy thật với ảnh "cardigan-dai" (người mẫu ngồi ghế sofa).
    const isFlatLayReference = /_tryon-flat\.(?:jpe?g|png|webp)$/i.test(path.basename(String(garmentImagePath || '')));
    if (isFlatLayReference) {
      const garment = fs.readFileSync(garmentImagePath);
      form.append('cloth', new Blob([garment], { type:'image/jpeg' }), path.basename(garmentImagePath));
    }
    form.append('category', fashnCategoryFor(product));
    form.append('verdict', fit.verdict);
    form.append('severity', String(fit.severity));
    form.append('tear_allowed', fit.visualEffect.tearAllowed ? 'true' : 'false');
    // Kimono/Haori/áo khoác cần prompt riêng về độ rủ và tay áo rộng, nếu không
    // FLUX dễ kéo chúng thành áo thun bó.
    form.append('outerwear', (garmentLayerFor(product) === 'upper-outer' || clothTypeFor(product) === 'overall') ? 'true' : 'false');
    form.append('garment_type', garmentTypeFor(product));
    form.append('selected_size', fit.chosenSize || '');
    form.append('recommended_size', fit.recommendedSize || '');
    form.append('seed', String(Number(process.env.JAPANO_FIT_SEED || 77) + attempt * 53));
    const response = await fetchWithTimeout(
      `${FASHN_URL}/fit-refine`,
      { method:'POST', body:form, signal },
      Number(process.env.JAPANO_FIT_REFINE_TIMEOUT_MS || 420000),
    );
    if (!response.ok) {
      let detail = '';
      try { detail = String((await response.json()).detail || ''); } catch {}
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    const type = String(response.headers.get('content-type') || 'image/png');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error('FLUX fit-refine không trả ảnh.');
    return {
      image:`data:${type.startsWith('image/') ? type.split(';')[0] : 'image/png'};base64,${bytes.toString('base64')}`,
      engine:String(response.headers.get('x-japano-engine') || 'flux2-klein-4b-fit-refine'),
    };
  }

  // Cổng ĐỘ CHE PHỦ: chạy trên ảnh thử đồ hoàn chỉnh, hỏi đúng câu hỏi an toàn
  // — vùng bắt buộc kín có bị hở không, và vùng hở có đúng thiết kế không.
  // Tách khỏi cổng fit vì hai cổng trả lời hai câu hỏi khác nhau.
  async function validateCoverage(sourceImage, resultImage, pose, policy) {
    if (!resultImage?.startsWith('data:')) return { ok: true, reasons: [], skipped: 'no_image' };
    try {
      const checked = await runAccessoryPipeline({
        mode: 'coverage_quality',
        imageBase64: stripDataUri(sourceImage),
        compareImageBase64: stripDataUri(resultImage),
        pose,
        coverage: {
          allowedExposedZones: policy.allowedExposedZones,
          requiredCoveredZones: policy.requiredCoveredZones,
        },
      }, 120000);
      return checked.ok && checked.quality ? checked.quality : { ok: false, reasons: ['coverage_check_failed'] };
    } catch (error) {
      return { ok: false, reasons: [`coverage_check_error:${error.message}`] };
    }
  }

  // Cổng chất lượng riêng cho hiệu ứng fit: cấm sửa cơ thể, cấm hở da, cấm đổi
  // màu/hoạ tiết trang phục; đồng thời báo lại nếu hiệu ứng không hiện ra.
  async function validateFitEffect(cleanImage, refinedImage, pose, clothType, fit) {
    if (!cleanImage?.startsWith('data:') || !refinedImage?.startsWith('data:')) {
      return { ok:false, reasons:['fit_quality_input_invalid'] };
    }
    try {
      const checked = await runAccessoryPipeline({
        mode:'fit_quality',
        imageBase64:stripDataUri(cleanImage),
        compareImageBase64:stripDataUri(refinedImage),
        pose, clothType,
        fit:{ verdict:fit.verdict, severity:fit.severity, tearAllowed:fit.visualEffect.tearAllowed },
      }, 120000);
      return checked.ok && checked.quality ? checked.quality : { ok:false, reasons:['fit_quality_check_failed'] };
    } catch (error) {
      return { ok:false, reasons:[`fit_quality_error:${error.message}`] };
    }
  }

  async function applySafeSeamSplit(image) {
    const split = await runAccessoryPipeline({
      mode: 'seam_split', imageBase64: stripDataUri(image),
    }, 60000);
    if (!split?.ok || !split.imageBase64 || !split.seamSplit?.applied) {
      throw new Error(split?.seamSplit?.reason || split?.message || 'không xác định được đường may an toàn');
    }
    return {
      image: `data:image/png;base64,${split.imageBase64}`,
      seamSplit: split.seamSplit,
    };
  }

  async function applySafeTightFit(image, severity) {
    const fitted = await runAccessoryPipeline({
      mode: 'tight_fit', imageBase64: stripDataUri(image), severity,
    }, 60000);
    if (!fitted?.ok || !fitted.imageBase64 || !fitted.tightFit?.applied) {
      throw new Error(fitted?.tightFit?.reason || fitted?.message || 'không xác định được vùng vải cần kéo căng');
    }
    return {
      image: `data:image/png;base64,${fitted.imageBase64}`,
      tightFit: fitted.tightFit,
    };
  }

  // eslint-disable-next-line no-unused-vars
  async function tryCatvton(personImageBase64, garmentImagePath, product, mainPersonBox, keypoints, shouldRepose = false, signal) {
    if (String(process.env.JAPANO_CATVTON_DISABLE || '0') === '1') throw new Error('CatVTON đã tắt');
    const form = new FormData();
    const person = Buffer.from(stripDataUri(personImageBase64), 'base64');
    const garment = fs.readFileSync(garmentImagePath);
    form.append('person', new Blob([person], { type: 'image/jpeg' }), 'person.jpg');
    form.append('cloth', new Blob([garment], { type: 'image/jpeg' }), path.basename(garmentImagePath));
    form.append('cloth_type', clothTypeFor(product));
    form.append('main_person_box', JSON.stringify(mainPersonBox || []));
    if (keypoints) form.append('keypoints', JSON.stringify(keypoints));
    form.append('repose', shouldRepose ? 'true' : 'false');
    const response = await fetchWithTimeout(
      `${CATVTON_URL}/tryon`,
      { method: 'POST', body: form, signal },
      Number(process.env.JAPANO_TRYON_TIMEOUT_MS || 720000),
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = String(response.headers.get('content-type') || '');
    if (type.includes('application/json')) {
      const data = await response.json();
      const image = normalizeImageResult(data);
      if (!image) throw new Error(data.message || 'CatVTON không trả ảnh');
      return { image, reposed: Boolean(data.reposed) };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error('CatVTON trả ảnh rỗng');
    return {
      image: `data:${type.startsWith('image/') ? type.split(';')[0] : 'image/png'};base64,${bytes.toString('base64')}`,
      reposed: String(response.headers.get('x-japano-reposed') || '').toLowerCase() === 'true',
    };
  }

  api.post('/tryon', async (req, res) => {
    const startedAt = Date.now();
    const b = req.body || {};
    const requestedGarmentIds = Array.isArray(b.productIds) && b.productIds.length
      ? b.productIds.slice(0, 3)
      : [b.productId];
    if (!b.personImageBase64 || !requestedGarmentIds.filter(Boolean).length) {
      return res.status(400).json({ ok: false, message: 'Thiếu ảnh người dùng hoặc sản phẩm cần thử.' });
    }
    const state = read();
    let outfitGarments;
    try {
      outfitGarments = resolveOutfitGarments(state, requestedGarmentIds, httpError);
    } catch (error) {
      return res.status(error.status || 400).json({ ok: false, message: error.message });
    }
    // Món đầu tiên đi qua đúng đường cũ (phân tích tư thế, sửa dáng, quality
    // gate); các món còn lại được mặc chồng lên ảnh kết quả ở bước sau.
    const [primaryGarment, ...extraGarments] = outfitGarments;
    const product = primaryGarment.product;
    let garmentImagePath = primaryGarment.imagePath;
    const availableSizes = availableSizesFor(product);
    const requestedSize = String(b.size || '').trim().toUpperCase();
    if (availableSizes.length && (!requestedSize || !availableSizes.includes(requestedSize))) {
      return res.status(400).json({
        ok: false,
        code: 'SIZE_NOT_AVAILABLE',
        message: `Size ${requestedSize || '(trống)'} không có ở sản phẩm này. Hãy chọn một trong: ${availableSizes.join(', ')}.`,
        availableSizes,
      });
    }

    // ---- Cổng an toàn cho trang phục 18+ ----------------------------------
    // Chạy TRƯỚC mọi thao tác GPU: ảnh không được phép đi vào model khi lượt
    // thử chưa hợp lệ. Xem lib/adultTryonPolicy.js.
    const safetyPolicy = safetyPolicyFor(outfitGarments.map((item) => item.product));
    if (safetyPolicy.requires18Plus) {
      // Ứng dụng di động báo focus 'tryon' NGAY TRƯỚC khi gọi API, và arbiter
      // hiểu điều đó là "nhả VRAM của Ollama". Nhưng cổng tuổi lại cần đúng
      // model thị giác đó ngay sau vài mili-giây, nên nó phải nạp lại từ đầu —
      // đo thực tế mất 67 giây rồi quá hạn, tức là mọi lượt thử đồ bơi đều hỏng.
      //
      // Vì vậy: chủ động kéo focus về 'vision' cho riêng bước kiểm tra, rồi trả
      // lại cho try-on. Không huỷ tác vụ đang chạy (cancelActive mặc định false)
      // nên lượt thử đồ của người khác không bị ảnh hưởng.
      const focusBeforeCheck = getFocus()?.focus || 'browse';
      await setFocus('vision').catch(() => undefined);
      let imageCheck;
      try {
        imageCheck = await checkAdultImage({
          imageBase64: b.personImageBase64,
          ollamaUrl: OLLAMA_URL,
        });
      } finally {
        await setFocus(focusBeforeCheck).catch(() => undefined);
      }
      const gate = evaluateAdultGate({
        policy: safetyPolicy,
        adultConsent: b.adultConsent === true,
        imageCheck,
      });
      logger.info(adultGateLogLine(gate, safetyPolicy));
      if (!gate.allowed) {
        return res.status(403).json({
          ok: false,
          code: gate.code,
          message: gate.message,
          requiresAdultConsent: true,
          garmentTypes: safetyPolicy.garmentTypes,
        });
      }
    }
    const requestedAccessoryIds = [...new Set((b.accessoryIds || b.accessoryProductIds || []).map(String).filter(Boolean))];
    if (requestedAccessoryIds.length > MAX_TRYON_ACCESSORIES) {
      return res.status(400).json({
        ok:false,
        code:'TOO_MANY_TRYON_ACCESSORIES',
        message:`Mỗi lượt chỉ ghép tối đa ${MAX_TRYON_ACCESSORIES} phụ kiện để giữ đúng vị trí và hình dáng. Hãy bỏ bớt ${requestedAccessoryIds.length - MAX_TRYON_ACCESSORIES} món rồi tạo lại ảnh.`,
      });
    }
    const accessoryIds = requestedAccessoryIds;
    const accessories = accessoryIds
      .map((id) => state.products.find((item) => item.slug === id || item.id === id))
      .filter((item) => item && (item.cat === 'phu-kien' || item.category === 'phu-kien'));
    const attempts = [];
    const cachedBody = b.bodyAnalysisCache && typeof b.bodyAnalysisCache === 'object' ? b.bodyAnalysisCache : null;
    const currentFingerprint = imageFingerprint(b.personImageBase64);
    const cachedPose = cachedBody?.imageFingerprint === currentFingerprint && cachedBody?.poseCache?.box
      ? cachedBody.poseCache
      : null;
    let poseAnalysis = cachedPose
      ? { ok: true, pose: cachedPose, normalizedImageBase64: '', reused: true }
      : await runAccessoryPipeline({ mode: 'analyze', imageBase64: b.personImageBase64 }, 60000);
    if (!poseAnalysis.ok || !poseAnalysis.pose?.box) {
      return res.status(422).json({
        ok: false,
        code: 'PERSON_NOT_DETECTED',
        message: 'Không nhận diện chắc chắn được người trong ảnh. Hệ thống đã dừng thay vì dựng một người khác.',
      });
    }
    if (poseAnalysis.pose.fallback || Number(poseAnalysis.pose.confidence || 0) < 0.07) {
      return res.status(422).json({
        ok: false,
        code: 'PERSON_NOT_DETECTED',
        message: 'Người trong ảnh quá nhỏ, bị che quá nhiều hoặc không đủ rõ. Hệ thống đã dừng để giữ đúng danh tính.',
      });
    }
    // Chặn sớm những ảnh không thể thay đồ (tay che ngực, không thấy thân trên...)
    // Chỉ từ chối khi thật sự không có người/thân trên để mặc thử. Các ca tay che
    // ngực vẫn cho chạy: CatVTON được cấp thêm mask thân người (từ khớp vai–hông)
    // để vẫn mặc áo lên trọn thân — chấp nhận ảnh có thể chưa hoàn hảo.
    const garmentRegion = poseAnalysis.pose.garmentRegion;
    // Không chặn ảnh khó chỉ vì pose detector thiếu khớp/người bị cắt. FLUX là
    // tầng phục hồi tư thế và vẫn phải được thử; quality gate sẽ đánh giá ảnh AI
    // sau cùng. Đây là best-effort cho ảnh đứng, ngồi, nghiêng, cận người...
    const occluded = Boolean(garmentRegion && garmentRegion.ok === false);
    const poseSuitability = poseAnalysis.pose.poseSuitability || { requiresRepose: occluded, reasons: [] };
    // Luôn dùng model sửa ảnh đa tham chiếu cho nhân vật chính. Điều này bảo đảm
    // ảnh được chấm là "đủ tốt" nhưng vẫn giơ tay/ngồi/nghiêng không đi tắt vào
    // VTON và giữ nguyên tư thế như pipeline cũ.
    // Tay đặt trước/sau thân là ca FASHN xử lý được bằng mask thân người. Ép
    // qua FLUX chỉ vì lý do này vừa thêm 15-25 giây vừa có nguy cơ vẽ lại mặt.
    // Chỉ re-pose cho các lỗi hình học thật sự (ngồi/nghiêng/người quá nhỏ...).
    const hardPoseReasons = (poseSuitability.reasons || []).filter((reason) => reason !== 'hands_cover_torso');
    const requiresRepose = Boolean(
      FORCE_REPOSE || occluded || (poseSuitability.requiresRepose && hardPoseReasons.length > 0),
    );
    const reposeReasons = [...new Set([
      ...hardPoseReasons,
      ...(FORCE_REPOSE ? ['always_repose'] : []),
    ])];
    const normalizedPersonImageBase64 = poseAnalysis.normalizedImageBase64 || b.personImageBase64;
    const clothType = clothTypeFor(product);
    // Ảnh mới là nguồn vóc dáng mặc định. Chỉ dùng hồ sơ thật đã lưu khi khách
    // chủ động chuyển sang chế độ nhập số đo.
    const measurementProfile = profileForMeasurementMode(b.profile || {}, b.measurementMode);

    // ---- Phân tích vóc dáng từ chính bức ảnh vừa chọn ----------------------
    // Dùng lại pose vừa tính (không chạy YOLO lần hai) và mặt nạ nền rembg đã
    // có sẵn cho phụ kiện, nên không nạp thêm model nặng nào lên GPU.
    let bodyAnalysis = cachedPose ? { ok: true, ...cachedBody } : null;
    if (bodyAnalysisEnabled() && !bodyAnalysis && b.skipBodyAnalysis !== true) {
      const bodyPayload = {
        mode: 'body_analysis',
        imageBase64: normalizedPersonImageBase64,
        // Pose chỉ dùng lại được khi nó cùng hệ toạ độ với ảnh đang gửi đi.
        pose: poseAnalysis.normalizedImageBase64 ? poseAnalysis.pose : null,
        userHeightCm: userProvidedMeasurement(measurementProfile, 'height'),
        userWeightKg: userProvidedMeasurement(measurementProfile, 'weight'),
        scaleReference: b.scaleReference || null,
        sex: String(b.sex || measurementProfile.gender || measurementProfile.sex || '').trim() || undefined,
      };
      const bodyTimeoutMs = Number(process.env.JAPANO_BODY_ANALYSIS_TIMEOUT_MS || 120000);
      // Worker thường trú cắt ~3.7s khỏi mỗi lượt thử đồ bằng cách không nạp lại
      // YOLO + U2Net. Không chạy được thì rơi về spawn như cũ.
      const analysis = (await analyzeViaWorker(bodyPayload, bodyTimeoutMs))
        || await runAccessoryPipeline(bodyPayload, bodyTimeoutMs);
      if (analysis?.ok && analysis.estimatedHeight) {
        bodyAnalysis = analysis;
        logger.info(bodyAnalysisLogLine(analysis));
      } else {
        attempts.push(`Phân tích vóc dáng: ${analysis?.message || 'không đọc được vóc dáng từ ảnh'}`);
      }
    }

    // Số đo thật của khách luôn thắng ước lượng của AI (xem lib/bodyAnalysis.js).
    const mergedBody = mergeBodySignals(measurementProfile, bodyAnalysis);
    const sizeFit = computeSizeFit(b.size, mergedBody.profile, {
      zone: primaryGarment.zone,
      category: fashnCategoryFor(product),
      bodyAnalysis,
      garmentTearAllowed: safetyPolicy.tearAllowed,
      tearBlockReason: safetyPolicy.tearBlockReason || null,
      tearWhenOutOfRange: !safetyPolicy.containsSwimwear && primaryGarment.zone !== 'lower',
      product,
    });
    const fitPlan = fitRefinePlan(sizeFit);
    logger.info(
      `[TRYON FIT] selected=${sizeFit.chosenSize} recommended=${sizeFit.recommendedSize || '?'} `
      + `delta=${sizeFit.delta} verdict=${sizeFit.verdict} severity=${sizeFit.severity} `
      + `signals=${(sizeFit.signals || []).join('+')} refine=${fitPlan.shouldRefine}(${fitPlan.reason})`,
    );

    // Tín hiệu phụ: chỉnh khổ ảnh vải rất nhẹ theo hướng chật/rộng để VTON có
    // sẵn thiên hướng đúng. Hiệu ứng chính vẫn do bước fit-refine đảm nhiệm.
    const preScaleDelta = fitPlan.shouldRefine ? garmentPreScaleDelta(sizeFit) : 0;
    if (preScaleDelta) {
      garmentImagePath = await adjustGarmentForFit(garmentImagePath, preScaleDelta);
      for (const extra of extraGarments) {
        extra.imagePath = await adjustGarmentForFit(extra.imagePath, preScaleDelta);
      }
    }
    let imageUrl = '';
    let engine = '';
    let poseTransferred = false;
    let qualityWarning = null;
    let appliedAccessories = [];
    let skippedAccessories = [];
    const appliedGarments = [];
    const skippedGarments = [];
    let garmentWarning = '';
    let accessoryWarning = '';
    let accessoryQuality = null;
    let coverageBlocked = null;
    // Phải khai báo ở scope của handler, KHÔNG ở trong callback runGpuJob: phần
    // dựng response nằm ngoài callback và có đọc biến này.
    let coverageQuality = null;
    let coverageFixRequested = false;
    let fitEffect = {
      applied: false,
      requested: fitPlan.shouldRefine,
      reason: fitPlan.reason,
      verdict: sizeFit.verdict,
      severity: sizeFit.severity,
      engine: '',
      effects: fitPlan.shouldRefine ? sizeFit.allowedEffects : [],
      quality: null,
    };
    // Một lượt tốt phải được trả ngay. Trước đây mặc định chạy lại hai lần khi
    // quality gate chặn, rồi fit-refine có thể tiếp tục thêm hai lần nữa: trên
    // điện thoại tổng thời gian dễ vượt 2-5 phút và reverse proxy ngắt kết nối.
    // Checkpoint đã qua acceptance gate 8/8 nên giữ retry là cấu hình opt-in.
    const automaticAttempts = Math.max(1, Math.min(3, Number(process.env.JAPANO_TRYON_AUTO_ATTEMPTS || 1)));
    try {
      // Ghi chủ sở hữu để lượt đổi màn hình của máy KHÁC không huỷ lượt này.
      const jobOwner = String(b.clientId || b.deviceId || b.userId || '').trim();
      await runGpuJob('tryon', async ({ signal }) => {
        throwIfCancelled(signal);
        for (let generationAttempt = 0; generationAttempt < automaticAttempts && !imageUrl; generationAttempt += 1) {
          throwIfCancelled(signal);
      try {
        const fashn = await tryFashn(
          normalizedPersonImageBase64,
          garmentImagePath,
          product,
          requiresRepose,
          generationAttempt,
          signal,
          fitPlan.shouldRefine,
        );
        imageUrl = fashn.image;
        poseTransferred = fashn.reposed;
        engine = fashn.engine;
      } catch (error) {
        throwIfCancelled(signal);
        attempts.push(`FASHN lượt ${generationAttempt + 1}: ${error.message}`);
        continue;
      }
      if ((poseAnalysis.pose.otherBoxes || []).length) {
        const restored = await runAccessoryPipeline({
          mode: 'restore_secondary',
          imageBase64: normalizedPersonImageBase64,
          compareImageBase64: imageUrl,
          boxes: poseAnalysis.pose.otherBoxes,
        }, 90000);
        if (restored.ok && restored.imageBase64 && restored.restored > 0) {
          imageUrl = `data:image/png;base64,${restored.imageBase64}`;
          engine = `${engine}+secondary-person-lock`;
        }
      }
      const quality = await validateTryOnResult(normalizedPersonImageBase64, imageUrl, poseAnalysis.pose, clothType, requiresRepose, sizeFit.visualEffect);
      if (!quality.ok) {
        attempts.push(`FASHN lượt ${generationAttempt + 1} bị quality gate chặn: ${(quality.reasons || []).join(', ')}`);
        const hardFailure = (quality.reasons || []).some((reason) => [
          'main_subject_lost', 'face_changed_or_covered', 'body_changed_not_garment',
          'secondary_person_changed', 'garment_unchanged', 'flat_or_blurred_garment', 'pose_not_corrected',
        ].includes(reason));
        if (!hardFailure) {
          // Cảnh báo mềm không được phép biến một ảnh đã tạo thành màn hình lỗi.
          qualityWarning = quality;
          engine = `${engine}+quality-warning`;
          break;
        }
        imageUrl = ''; engine = ''; poseTransferred = false;
      }
        }
    // Không trả best-effort sau lỗi cứng. Một ảnh đổi mặt/cơ thể không trở thành
    // hợp lệ chỉ vì đó là ứng viên ít tệ nhất trong các lượt sinh.
    // CatVTON không biết đổi pose; chỉ thử fallback với ảnh vốn đã có pose tốt.
    if (!imageUrl && !requiresRepose && String(process.env.JAPANO_CATVTON_FALLBACK || '0') === '1') {
      try {
        const catvton = await tryCatvton(
          normalizedPersonImageBase64,
          garmentImagePath,
          product,
          poseAnalysis.pose.box,
          poseAnalysis.pose.keypoints,
          false,
          signal,
        );
        const quality = await validateTryOnResult(normalizedPersonImageBase64, catvton.image, poseAnalysis.pose, clothType, false);
        if (!quality.ok) {
          attempts.push(`CatVTON fallback bị chặn: ${(quality.reasons || []).join(', ')}`);
        } else {
          imageUrl = catvton.image;
          engine = 'catvton-quality-fallback';
        }
      } catch (error) {
        throwIfCancelled(signal);
        attempts.push(`CatVTON fallback: ${error.message}`);
      }
    }
    if (imageUrl) appliedGarments.push({ slug: product.slug, name: product.name, zone: primaryGarment.zone });

    // ---- Mặc chồng các món còn lại (áo + quần cùng lúc) --------------------
    // Nối tiếp: ảnh kết quả của lượt trước trở thành "ảnh người" của lượt sau.
    // requiresRepose LUÔN false ở đây — tư thế đã được sửa xong ở lượt đầu, sửa
    // thêm lần nữa chỉ làm nhân vật biến dạng và mất luôn món vừa mặc.
    for (const extra of extraGarments) {
      if (!imageUrl) break;
      throwIfCancelled(signal);
      const baseImage = imageUrl;
      const extraClothType = extra.zone;
      let layered = '';
      let layeredEngine = '';
      for (let layerAttempt = 0; layerAttempt < automaticAttempts && !layered; layerAttempt += 1) {
        throwIfCancelled(signal);
        try {
          const fashn = await tryFashn(baseImage, extra.imagePath, extra.product, false, layerAttempt, signal);
          // So với ảnh của LƯỢT TRƯỚC, không phải ảnh gốc: ở đây chỉ cần biết
          // đúng vùng này có thật sự đổi sang món mới hay không.
          const quality = await validateTryOnResult(baseImage, fashn.image, poseAnalysis.pose, extraClothType, false, sizeFit.visualEffect);
          if (quality.ok) {
            layered = fashn.image;
            layeredEngine = fashn.engine;
            break;
          }
          attempts.push(`Mặc chồng "${extra.product.name}" lượt ${layerAttempt + 1} bị chặn: ${(quality.reasons || []).join(', ')}`);
        } catch (error) {
          throwIfCancelled(signal);
          attempts.push(`Mặc chồng "${extra.product.name}" lượt ${layerAttempt + 1}: ${error.message}`);
        }
      }
      // Không mặc chồng bằng ảnh bị quality gate từ chối; giữ ảnh lớp trước.
      if (layered) {
        imageUrl = layered;
        engine = `${engine}+${extraClothType}:${layeredEngine || 'fashn'}`;
        appliedGarments.push({ slug: extra.product.slug, name: extra.product.name, zone: extra.zone });
      } else {
        skippedGarments.push(extra.product.name);
      }
    }
    if (skippedGarments.length) {
      garmentWarning = `Chưa ghép được ${skippedGarments.join(', ')} lên ảnh; các món còn lại vẫn được mặc thử bình thường.`;
    }

    // ---- Mô phỏng độ vừa vặn (fit-aware rendering) ------------------------
    // Chạy CÓ ĐIỀU KIỆN: size vừa thì bỏ qua hoàn toàn để khỏi tốn một lượt nạp
    // FLUX 15GB lên GPU 16GB. Lệch nhiều thì bắt buộc chạy, vì đó chính là thứ
    // khách cần nhìn thấy.
    // Áo crop bị VTON dựng thành áo dài che bụng là lỗi thiết kế thường gặp
    // nhất của nhóm trang phục hở. Cổng che phủ phát hiện được (cảnh báo
    // `intended_exposure_missing`), và bước fit-refine có sẵn khoá CROP_LOCK để
    // sửa — nên khi gặp cảnh báo đó thì BẬT refine kể cả khi lệch size chưa đủ
    // ngưỡng. Không có bước này, cảnh báo chỉ nằm trong log mà ảnh vẫn sai.
    if (imageUrl && safetyPolicy.preserveHemLength && !fitPlan.shouldRefine) {
      const preview = await validateCoverage(
        normalizedPersonImageBase64, imageUrl, poseAnalysis.pose, safetyPolicy,
      );
      const missing = (preview.warnings || []).filter((item) => item.startsWith('intended_exposure_missing'));
      if (missing.length) {
        coverageFixRequested = true;
        fitPlan.shouldRefine = true;
        fitEffect.requested = true;
        fitEffect.reason = 'coverage_fix';
        attempts.push(`Chạy lại bước mô phỏng để giữ đúng thiết kế: ${missing.join(', ')}`);
        logger.info(`[TRYON SAFETY] bật fit-refine để sửa độ che phủ: ${missing.join(', ')}`);
      }
    }

    // Hậu kỳ texture ngay trên ảnh VTON sạch: hoa văn bị kéo ngang và nếp căng
    // hội tụ từ hai sườn. Cách này rõ hơn prompt FLUX, không sinh lại người/nền
    // và bỏ được một lượt model tuần tự vốn chiếm thêm 20-30 giây trên GPU 16 GB.
    //
    // Điều kiện là ĐỘ CHẬT THẬT SỰ, không phải "catalog hết size". Bản trước bám
    // vào `tearBecauseNoSizeFits`, nên một người 95kg tự chọn size S vẫn ra ảnh
    // phẳng lì nếu shop có bán tới 5XL — trong khi chính người đó mặc S là
    // trường hợp cần thấy hệ quả rõ nhất. `tearAllowed` đã gồm đủ các chốt:
    // very_tight, severity >= 0.85, không phải thân dưới, và loại trang phục cho
    // phép. Đo trên đường cong severity: 55kg chọn S chỉ 0.34, 70kg chọn S là
    // 0.66 — cả hai đều KHÔNG chạm ngưỡng, nên đổi cổng này không làm rách nhầm.
    if (imageUrl && sizeFit.visualEffect.tearAllowed) {
      try {
        const fitted = await applySafeTightFit(imageUrl, sizeFit.severity);
        imageUrl = fitted.image;
        engine = `${engine}+fit:${sizeFit.verdict}:safe-tension`;
        fitEffect = {
          ...fitEffect,
          applied: true,
          reason: sizeFit.tearBecauseNoSizeFits ? 'no_sold_size_safe_tension' : 'very_tight_safe_tension',
          engine: 'deterministic-safe-tension',
          tightFit: fitted.tightFit,
          quality: { ok: true, reasons: [], safeTensionApplied: true },
        };
      } catch (error) {
        attempts.push(`Không tạo được nếp căng vải an toàn: ${error.message}`);
      }
    }

    if (imageUrl && fitPlan.shouldRefine && !fitEffect.applied) {
      const cleanFitInput = imageUrl;
      const maxFitAttempts = fitPlan.mandatory
        ? Math.max(1, Math.min(3, Number(process.env.JAPANO_FIT_REFINE_ATTEMPTS || 1)))
        : 1;
      for (let fitAttempt = 0; fitAttempt < maxFitAttempts && !fitEffect.applied; fitAttempt += 1) {
        throwIfCancelled(signal);
        try {
          const refined = await tryFitRefine(cleanFitInput, garmentImagePath, sizeFit, product, fitAttempt, signal);
          const fitQuality = await validateFitEffect(cleanFitInput, refined.image, poseAnalysis.pose, clothType, sizeFit);
          fitEffect.quality = fitQuality;
          if (fitQuality.ok) {
            imageUrl = refined.image;
            engine = `${engine}+fit:${sizeFit.verdict}`;
            fitEffect = {
              ...fitEffect,
              applied: true,
              engine: refined.engine,
              effects: sizeFit.allowedEffects,
              quality: fitQuality,
            };
            logger.info(
              `[TRYON FIT EFFECT] engine=${refined.engine} tension=${sizeFit.visualEffect.tension} `
              + `looseness=${sizeFit.visualEffect.looseness} seamStress=${sizeFit.visualEffect.seamStress} `
              + `tearAllowed=${sizeFit.visualEffect.tearAllowed}`,
            );
            break;
          }
          // Ảnh mô phỏng bị từ chối thì GIỮ ảnh VTON sạch. Thà mất hiệu ứng còn
          // hơn trả về một ảnh đã sửa cơ thể người hoặc làm hở da.
          attempts.push(`Mô phỏng độ vừa vặn lượt ${fitAttempt + 1} bị chặn: ${(fitQuality.reasons || []).join(', ')}`);
        } catch (error) {
          throwIfCancelled(signal);
          attempts.push(`Mô phỏng độ vừa vặn lượt ${fitAttempt + 1}: ${error.message}`);
        }
      }
      if (!fitEffect.applied) {
        fitEffect.reason = 'refine_failed';
        // In kèm số đo đã khiến cổng từ chối: khi hiệu ứng biến mất, biết
        // "trượt ở đâu, trượt bao nhiêu" quan trọng hơn nhiều so với chỉ biết tên lý do.
        const q = fitEffect.quality || {};
        const drift = Object.entries(q.bodyDrift || {})
          .map(([key, value]) => `${key}=${value}`).join(' ');
        logger.info(
          `[TRYON FIT EFFECT] không áp dụng được hiệu ứng fit (${(q.reasons || []).join(', ') || 'lỗi engine'})`
          + (drift ? ` drift[${drift}]` : '')
          + ` skinGain=${q.skinGain} colorShift=${q.colorShift} structureChange=${q.structureChange}`,
        );
      }
    }

    // Quá chật tới mức very_tight thì vết bục là BẮT BUỘC, dù shop còn size lớn
    // hơn hay không — khách chọn size nhỏ là để nhìn thấy đúng hệ quả đó. Hậu kỳ
    // đúng đường vai trên ảnh đã qua gate, không ép model sinh lại mặt/cơ thể.
    if (imageUrl && sizeFit.visualEffect.tearAllowed) {
      try {
        const previousQuality = fitEffect.quality;
        const split = await applySafeSeamSplit(imageUrl);
        imageUrl = split.image;
        engine = `${engine}+safe-seam-split`;
        fitEffect = {
          ...fitEffect,
          applied: true,
          reason: fitEffect.applied ? fitEffect.reason : 'safe_seam_split_fallback',
          engine: `${fitEffect.engine || 'deterministic'}+safe-seam-split`,
          seamSplitApplied: true,
          seamSplit: split.seamSplit,
          refineRejectedReasons: previousQuality?.ok === false ? previousQuality.reasons || [] : [],
          quality: previousQuality?.ok === true
            ? { ...previousQuality, seamSplitApplied: true }
            : { ok: true, reasons: [], seamSplitApplied: true },
        };
      } catch (error) {
        attempts.push(`Không tạo được vết bục đường may bắt buộc: ${error.message}`);
      }
    }

    // ---- Cổng an toàn về độ che phủ ---------------------------------------
    // Chạy trên ảnh cuối cùng của phần trang phục. Vi phạm vùng bắt buộc kín là
    // lỗi CHẶN: thà không trả ảnh còn hơn trả một ảnh hở vùng nhạy cảm.
    if (imageUrl) {
      coverageQuality = await validateCoverage(
        normalizedPersonImageBase64, imageUrl, poseAnalysis.pose, safetyPolicy,
      );
      const criticalCoverage = (coverageQuality.reasons || []).filter((reason) => reason.startsWith('required_zone_exposed'));
      if (criticalCoverage.length) {
        // Kèm số đo da của từng vùng: khi cổng chặn nhầm, biết "vùng nào, da
        // trước bao nhiêu, sau bao nhiêu" là cách duy nhất phân biệt ảnh thật sự
        // hở với khung vùng đặt sai chỗ.
        // Chẩn đoán: khi bật JAPANO_TRYON_DEBUG_DIR, ghi lại đúng tấm ảnh vừa bị
        // chặn để soi bằng mắt. Cổng an toàn chặn nhầm hay chặn đúng là câu hỏi
        // không thể trả lời bằng số liệu suông. Mặc định TẮT — ảnh thử đồ là dữ
        // liệu nhạy cảm, chỉ bật khi đang gỡ lỗi với ảnh test.
        const debugDir = String(process.env.JAPANO_TRYON_DEBUG_DIR || '').trim();
        if (debugDir) {
          try {
            const fsp = require('fs');
            fsp.mkdirSync(debugDir, { recursive: true });
            const stamp = Date.now();
            for (const [ten, anh] of [['clean', normalizedPersonImageBase64], ['blocked', imageUrl]]) {
              if (!anh?.startsWith('data:')) continue;
              fsp.writeFileSync(`${debugDir}/${stamp}-${ten}.png`, Buffer.from(anh.split(',')[1], 'base64'));
            }
            logger.info(`[TRYON SAFETY] đã ghi ảnh chẩn đoán vào ${debugDir}`);
          } catch (error) {
            logger.warn(`[TRYON SAFETY] không ghi được ảnh chẩn đoán: ${error.message}`);
          }
        }
        const zoneDetail = Object.entries(coverageQuality.zones || {})
          .map(([zone, v]) => `${zone}:${v.before}->${v.after}(+${v.gain})`).join(' ');
        logger.warn(
          `[TRYON SAFETY] chặn ảnh vì hở vùng bắt buộc kín: ${criticalCoverage.join(', ')}`
          + (zoneDetail ? ` | ${zoneDetail}` : ''),
        );
        imageUrl = '';
        coverageBlocked = criticalCoverage;
      } else if (!coverageQuality.ok) {
        attempts.push(`Cổng độ che phủ cảnh báo: ${(coverageQuality.reasons || []).join(', ')}`);
      } else if ((coverageQuality.warnings || []).length) {
        attempts.push(`Độ che phủ chưa đúng thiết kế: ${coverageQuality.warnings.join(', ')}`);
      }
    }

    if (imageUrl && accessories.length) {
      const cleanTryOnImage = imageUrl;
      const accessoryPayload = accessories.map((item) => ({
        id: item.slug,
        name: item.name,
        kind: accessoryKind(item),
        imagePath: resolveAccessoryImage(item.slug),
      })).filter((item) => item.imagePath);
      const composed = await runAccessoryPipeline({
        mode: 'compose',
        imageBase64: imageUrl,
        accessories: accessoryPayload,
      }, 180000);
      if (!composed.ok || !composed.imageBase64 || !composed.applied?.length) {
        skippedAccessories = accessories.map((item) => item.name);
        accessoryWarning = `Chưa ghép tự nhiên được ${skippedAccessories.join(', ')}; hệ thống giữ ảnh quần áo sạch, không trả bản phụ kiện dán thô.`;
        attempts.push(`Phụ kiện: ${composed.message || 'không có phụ kiện được áp dụng'}`);
      } else {
        appliedAccessories = composed.applied;
        const kinds = appliedAccessories.map((item) => item.kind);
        const roughImage = `data:image/png;base64,${composed.imageBase64}`;
        const roughQuality = await validateAccessoryResult(cleanTryOnImage, roughImage, kinds);
        // roughImage chỉ là sơ đồ vị trí cho FLUX, tuyệt đối không được trả cho
        // khách vì nó còn là các cutout dán lên ảnh.
        const candidates = [];
        if (String(process.env.JAPANO_ACCESSORY_REFINE || '1').trim().toLowerCase() !== '0') {
          const refineAttempts = Math.max(1, Math.min(3, Number(process.env.JAPANO_ACCESSORY_REFINE_ATTEMPTS || 2)));
          for (let generationAttempt = 0; generationAttempt < refineAttempts; generationAttempt += 1) {
            try {
              throwIfCancelled(signal);
              const refined = await tryAccessoryRefine(
                roughImage,
                cleanTryOnImage,
                accessoryPayload,
                generationAttempt,
                signal,
              );
              let refinedImage = refined.image;
              if ((poseAnalysis.pose.otherBoxes || []).length) {
                const restored = await runAccessoryPipeline({
                  mode:'restore_secondary', imageBase64:cleanTryOnImage,
                  compareImageBase64:refinedImage, boxes:poseAnalysis.pose.otherBoxes,
                }, 90000);
                if (restored.ok && restored.imageBase64 && restored.restored > 0) {
                  refinedImage = `data:image/png;base64,${restored.imageBase64}`;
                }
              }
              const checked = await validateAccessoryResult(cleanTryOnImage, refinedImage, kinds);
              candidates.push({ image:refinedImage, stage:refined.engine, quality:checked });
              if (checked.ok) break;
              attempts.push(`Làm đẹp phụ kiện lượt ${generationAttempt + 1} chưa đạt: ${(checked.reasons || []).join(', ')}`);
            } catch (error) {
              throwIfCancelled(signal);
              attempts.push(`Làm đẹp phụ kiện lượt ${generationAttempt + 1}: ${error.message}`);
            }
          }
        }
        const best = choosePassingAccessoryCandidate(candidates);
        if (best) {
          imageUrl = best.image;
          accessoryQuality = best.quality;
          engine = `${engine}+${best.stage}`;
        } else {
          const bestRejected = [...candidates].sort((a, b) => Number(a.quality?.score ?? 9999) - Number(b.quality?.score ?? 9999))[0];
          imageUrl = cleanTryOnImage;
          accessoryQuality = bestRejected?.quality || roughQuality;
          skippedAccessories = appliedAccessories.map((item) => item.name);
          appliedAccessories = [];
          const reasons = accessoryQualityLabels(accessoryQuality?.reasons || ['accessory_quality_check_failed']);
          accessoryWarning = `Chưa ghép tự nhiên được ${skippedAccessories.join(', ')} (${reasons.join(', ')}); hệ thống giữ ảnh quần áo sạch, không trả bản phụ kiện dán thô.`;
          attempts.push(`Không có ảnh phụ kiện refined nào qua quality gate: ${reasons.join(', ')}`);
        }
      }
    }
      }, {
        userId: String(b.userId || 'guest'),
        productId: product.slug,
        owner: jobOwner,
      });
    } catch (error) {
      if (error instanceof GpuJobCancelledError || error?.code === 'GPU_JOB_CANCELLED') {
        return res.status(409).json({
          ok: false,
          code: 'GPU_JOB_CANCELLED',
          message: 'Đã dừng thử đồ vì bạn chuyển sang tính năng khác.',
        });
      }
      return res.status(error?.status || 500).json({
        ok: false,
        code: 'TRYON_GPU_QUEUE_ERROR',
        message: error?.message || 'Hàng chờ GPU không xử lý được lượt thử đồ.',
      });
    }
    if (!imageUrl && coverageBlocked) {
      return res.status(422).json({
        ok: false,
        code: 'COVERAGE_UNSAFE',
        message: 'Ảnh tạo ra không giữ được độ che phủ an toàn nên hệ thống đã huỷ kết quả. '
          + 'Hãy thử lại với ảnh chụp thẳng, đủ sáng và thấy rõ toàn thân.',
        coverage: coverageBlocked,
        sizeFit,
      });
    }
    if (!imageUrl) {
      // Không có ảnh không có nghĩa là không có thông tin: phân tích vóc dáng và
      // độ vừa vặn đã chạy xong trước khi engine ảnh lỗi, và đó là thứ khách vẫn
      // dùng được ngay (đổi sang size được khuyến nghị chẳng hạn).
      return res.status(503).json({
        ok: false,
        code: 'TRYON_AI_UNAVAILABLE',
        message: 'AI chưa tạo được ảnh thử đồ thật. Vui lòng thử lại; ứng dụng sẽ không dùng ảnh sản phẩm chồng lên ảnh của bạn để giả làm kết quả.',
        attempts,
        sizeFit,
        recommendedSize: sizeFit.recommended || undefined,
        bodyAnalysis: bodyAnalysis ? { ...summarizeBodyAnalysis(bodyAnalysis), sources: mergedBody.sources } : undefined,
        fitEffect,
      });
    }
    const userId = String(b.userId || 'guest');
    update((next) => {
      const createdAt = Date.now();
      // Cả bộ đã mặc đều phải vào tín hiệu hành vi. Nếu chỉ ghi món đầu thì
      // recommend.js sẽ không bao giờ học được rằng khách đã thử món thứ hai,
      // và trang quản trị đếm thiếu lượt thử đồ của nó.
      //
      // Trước đây mỗi lượt còn được ghi thêm một bản sao vào collection
      // `tryonHistory`. Bảng đó không có một chỗ đọc nào trong backend, mobile
      // hay admin — mọi con số "lượt thử đồ" đều tính từ interactions — nên nó
      // đã bị bỏ. Phần metadata riêng của lượt thử (engine, phụ kiện) không mất
      // đi mà chuyển vào interactions.metadata, cùng `runId` để ghép lại các
      // món được mặc trong cùng một lượt.
      const runId = `tryon-${createdAt}`;
      appliedGarments.forEach((item, index) => {
        next.interactions.push({
          id: `tryon-i-${createdAt}-${index}`, userId, productId: item.slug,
          type: 'tryon', value: 1, createdAt, source: 'mobile',
          metadata: {
            runId,
            engine,
            garments: appliedGarments.map((g) => g.slug),
            accessoryIds,
            appliedAccessories,
            skippedAccessories,
            // Chẩn đoán fit — nguồn dữ liệu cho màn "AI Try-On Diagnostics" ở
            // trang quản trị. Không lưu ảnh, chỉ lưu số liệu.
            fit: {
              chosenSize: sizeFit.chosenSize,
              recommendedSize: sizeFit.recommendedSize,
              delta: sizeFit.delta,
              verdict: sizeFit.verdict,
              severity: sizeFit.severity,
              signals: sizeFit.signals,
              effectApplied: fitEffect.applied,
              effectEngine: fitEffect.engine || '',
              effectReasons: fitEffect.quality?.reasons || [],
            },
            body: bodyAnalysis ? {
              heightRange: [bodyAnalysis.estimatedHeight?.minCm ?? null, bodyAnalysis.estimatedHeight?.maxCm ?? null],
              weightRange: [bodyAnalysis.estimatedWeight?.minKg ?? null, bodyAnalysis.estimatedWeight?.maxKg ?? null],
              confidence: bodyAnalysis.quality?.analysisConfidence ?? 0,
              sources: mergedBody.sources,
            } : null,
            qualityGate: qualityWarning ? (qualityWarning.reasons || []) : [],
            // Chẩn đoán an toàn cho trang quản trị. Chỉ số liệu quyết định —
            // không ảnh, không base64, không thông tin nhận dạng cá nhân.
            safety: {
              garmentTypes: safetyPolicy.garmentTypes,
              requires18Plus: safetyPolicy.requires18Plus,
              containsSwimwear: safetyPolicy.containsSwimwear,
              allowedExposedZones: safetyPolicy.allowedExposedZones,
              tearAllowed: sizeFit.visualEffect.tearAllowed,
              coverageOk: coverageQuality ? coverageQuality.ok : null,
              coverageReasons: coverageQuality?.reasons || [],
            },
            durationMs: Date.now() - startedAt,
          },
        });
      });
      return next;
    });
    res.json({
      ok: true,
      imageBase64: imageUrl,
      // Kết quả local là data URI vài MB. Không lặp lại cùng dữ liệu ở hai field:
      // React Native phải parse/copy gấp đôi JSON trên máy cấu hình thấp như Redmi.
      // Client đã ưu tiên imageUrl và tự fallback sang imageBase64.
      imageUrl: /^https?:|^file:/i.test(imageUrl) ? imageUrl : undefined,
      engine,
      attempts,
      // Danh sách món đã thực sự lên ảnh — client cần biết để hiện đúng những gì
      // đang mặc, và để nút "Thêm cả bộ vào giỏ" không thêm nhầm món bị bỏ qua.
      garments: appliedGarments,
      skippedGarments,
      message: garmentWarning
        || accessoryWarning
        || (fitEffect.applied
          ? `${sizeFit.message} Ảnh đã được mô phỏng lại theo độ vừa vặn thực tế.`
          : appliedGarments.length > 1
          ? `Đã mặc thử cả bộ ${appliedGarments.map((item) => item.name).join(' + ')}${appliedAccessories.length ? ` kèm ${appliedAccessories.map((item) => item.name).join(', ')}` : ''}.`
          : appliedAccessories.length
          ? `Đã thay đồ cho một nhân vật chính và dùng FLUX.2 làm đẹp: ${appliedAccessories.map((item) => item.name).join(', ')}.`
          : qualityWarning
            ? (qualityWarning.message || `Đã trả ảnh thử đồ tốt nhất. AI còn cảnh báo: ${(qualityWarning.reasons || []).join(', ')}.`)
            : poseTransferred
          ? 'FLUX.2 đã đưa nhân vật chính về tư thế phù hợp, sau đó FASHN VTON 1.5 mặc trang phục và kiểm tra chất lượng.'
          : 'FASHN VTON 1.5 đã mặc trang phục cho đúng nhân vật chính và kết quả đã qua kiểm tra chất lượng.'),
      recommendedSize: sizeFit.recommended || undefined,
      sizeFit,
      // Ước lượng vóc dáng luôn kèm khoảng + độ tin cậy; client có trách nhiệm
      // hiển thị đúng là "ước lượng", không phải số đo thật.
      bodyAnalysis: bodyAnalysis ? { ...summarizeBodyAnalysis(bodyAnalysis), sources: mergedBody.sources } : undefined,
      fitEffect,
      // Thông tin an toàn cho client hiển thị và cho trang quản trị chẩn đoán.
      safety: {
        garmentTypes: safetyPolicy.garmentTypes,
        requires18Plus: safetyPolicy.requires18Plus,
        containsSwimwear: safetyPolicy.containsSwimwear,
        intentionalSkinExposure: safetyPolicy.intentionalSkinExposure,
        allowedExposedZones: safetyPolicy.allowedExposedZones,
        requiredCoveredZones: safetyPolicy.requiredCoveredZones,
        tearAllowed: sizeFit.visualEffect.tearAllowed,
        coverageCheck: coverageQuality
          ? { ok: coverageQuality.ok, reasons: coverageQuality.reasons, warnings: coverageQuality.warnings || [] }
          : null,
        coverageFixRequested,
      },
      durationMs: Date.now() - startedAt,
      qualityWarning: qualityWarning || undefined,
      accessoryWarning: accessoryWarning || undefined,
      mainSubject: {
        box: poseAnalysis.pose.box,
        confidence: poseAnalysis.pose.confidence,
        poseNormalized: Boolean(poseAnalysis.normalizedImageBase64),
        poseTransferred,
        poseTransferReasons: reposeReasons,
        inferredKeypoints: poseAnalysis.pose.inferredKeypoints || [],
        occluded,
      },
      appliedAccessories,
      skippedAccessories,
      accessoryQuality: accessoryQuality || undefined,
    });
  });

  api.get('/tryon/motion/presets', async (req, res) => {
    const health = await serviceHealth(MOTION_URL);
    res.json({ ok:true, engine:MOTION_ENGINE_LABEL, ready:Boolean(health.online), presets:MOTION_PRESETS });
  });

  api.post('/tryon/motion', async (req, res) => {
    const imageBase64 = String(req.body?.imageBase64 || '');
    const motion = String(req.body?.motion || '');
    if (!imageBase64 || !MOTION_PRESETS.some((item) => item.id === motion)) {
      return res.status(400).json({ ok:false, message:'Thiếu ảnh thử đồ hoặc chuyển động mẫu không hợp lệ.' });
    }
    try {
      const health = await serviceHealth(MOTION_URL);
      if (!health.online) {
        return res.status(503).json({
          ok: false,
          engine: MOTION_ENGINE_LABEL,
          message: 'Engine chuyển động mới chưa sẵn sàng. Ảnh thử đồ vẫn giữ nguyên; chưa tạo video để tránh dùng model cũ hoặc trả clip lỗi.',
        });
      }
      let queuedMs = 0;
      // Motion có priority cao nhất. Scheduler nhả FASHN/Ollama, chuyển
      // recommendation embedding sang CPU rồi mới cho job chiếm GPU.
      const bytes = await runGpuJob('motion', async ({ signal, queuedMs: waitMs }) => {
        queuedMs = waitMs;
        const response = await fetchWithTimeout(`${MOTION_URL}/animate`, {
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({ imageBase64, motion, seed:Number(req.body?.seed || 42) }),
          signal,
        }, Number(process.env.JAPANO_MOTION_TIMEOUT_MS || 720000));
        if (!response.ok) {
          const detail = await response.text();
          let message = detail;
          try { message = JSON.parse(detail)?.detail || detail; } catch { /* plain response */ }
          throw httpError(response.status, String(message || 'Model chuyển động không phản hồi.'));
        }
        return Buffer.from(await response.arrayBuffer());
      }, {
        userId: String(req.body?.userId || 'guest'),
        motion,
      });
      if (!bytes.length) throw httpError(502, 'Model chuyển động không trả MP4.');
      const id = `motion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      fs.writeFileSync(path.join(MOTION_OUTPUT_DIR, `${id}.mp4`), bytes);
      res.json({
        ok:true,
        engine:MOTION_ENGINE_LABEL,
        motion,
        queuedMs,
        videoUrl:`/api/tryon/motion/video/${id}`,
      });
    } catch (error) {
      if (error instanceof GpuJobCancelledError || error?.code === 'GPU_JOB_CANCELLED' || error?.name === 'AbortError') {
        return res.status(409).json({
          ok:false,
          code:'GPU_JOB_CANCELLED',
          engine:MOTION_ENGINE_LABEL,
          message:'Đã dừng tạo chuyển động vì bạn rời màn hình hoặc chuyển sang thử đồ.',
        });
      }
      const unavailable = error?.cause?.code === 'ECONNREFUSED' || error?.message === 'fetch failed';
      res.status(error.status || (unavailable ? 503 : 500)).json({
        ok:false,
        engine:MOTION_ENGINE_LABEL,
        message: unavailable
          ? 'Engine chuyển động mới vừa mất kết nối. Ảnh thử đồ vẫn giữ nguyên; hãy thử lại sau khi service sẵn sàng.'
          : (error.message || 'Không tạo được chuyển động AI.'),
      });
    }
  });

  api.get('/tryon/motion/video/:id', (req, res) => {
    const id = String(req.params.id || '');
    if (!/^motion-[a-z0-9-]+$/i.test(id)) return res.status(400).json({ ok:false, message:'Mã video không hợp lệ.' });
    const file = path.join(MOTION_OUTPUT_DIR, `${id}.mp4`);
    if (!fs.existsSync(file)) return res.status(404).json({ ok:false, message:'Video đã hết hạn hoặc không tồn tại.' });
    res.sendFile(file);
  });
};

module.exports.stripDataUri = stripDataUri;
module.exports.normalizeImageResult = normalizeImageResult;
module.exports.clothTypeFor = clothTypeFor;
module.exports.garmentLayerFor = garmentLayerFor;
module.exports.shouldRefineGarment = shouldRefineGarment;
module.exports.fashnCategoryFor = fashnCategoryFor;
module.exports.makeComputeSizeFit = makeComputeSizeFit;

module.exports.resolveOutfitGarments = resolveOutfitGarments;
module.exports.MAX_TRYON_ACCESSORIES = MAX_TRYON_ACCESSORIES;
module.exports.choosePassingAccessoryCandidate = choosePassingAccessoryCandidate;
