// Thử đồ thật bằng FASHN VTON 1.5. FLUX.2 chỉ đổi tư thế khi bộ phân tích pose
// xác định tay/vật đang che thân; CatVTON là fallback có kiểm định chất lượng.
// Đây là domain lớn nhất trong backend nên tách riêng khỏi các domain khác.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveGarmentImage } = require('../lib/garmentImages');
const { fetchWithTimeout, serviceHealth } = require('../lib/httpFetch');
const { CATVTON_URL, FASHN_URL, MOTION_URL, MOTION_ENGINE_LABEL } = require('../lib/serviceUrls');
const { FORCE_REPOSE, FASHN_FIDELITY_REFINE } = require('../lib/tryonConfig');

function stripDataUri(value) {
  const text = String(value || '');
  return text.startsWith('data:') && text.includes(',') ? text.slice(text.indexOf(',') + 1) : text;
}

const ACCESSORY_QUALITY_LABELS = {
  main_subject_lost:'không nhận rõ nhân vật chính',
  face_changed_or_covered:'khuôn mặt bị thay đổi hoặc che khuất',
  hat_obscures_eyes:'mũ đang che mắt',
  garment_fidelity_changed:'trang phục bị lệch mẫu',
  hand_pose_not_engaged:'tay chưa cầm phụ kiện tự nhiên',
  hat_missing:'chưa nhận rõ mũ',
  accessory_quality_check_failed:'không chấm được chất lượng phụ kiện',
};
const accessoryQualityLabels = (reasons = []) => reasons.map((reason) => ACCESSORY_QUALITY_LABELS[reason] || reason);

function normalizeImageResult(data) {
  if (!data) return '';
  const raw = data.finalImageBase64 || data.imageBase64 || data.result?.imageBase64 || data.result?.finalImageBase64 || data.urls?.[0] || data.imageUrl || '';
  if (!raw) return '';
  const value = String(raw);
  return value.startsWith('data:') || value.startsWith('http') ? value : `data:image/png;base64,${value}`;
}

function clothTypeFor(product = {}) {
  const text = `${product.name || ''} ${product.cat || product.category || ''}`.toLowerCase();
  if (/(quần|quan|chân váy|chan vay|lower)/i.test(text)) return 'lower';
  if (/(kimono|yukata|đầm|dam|dress|cosplay|outfit|overall|đồng phục|dong phuc|uniform|bộ đồ|bo do)/i.test(text)) return 'overall';
  return 'upper';
}

const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'];

const MOTION_PRESETS = [
  { id:'runway_walk', label:'Đi một vòng', icon:'walk-outline' },
  { id:'spin', label:'Xoay một vòng', icon:'sync-outline' },
  { id:'jump', label:'Nhảy lên', icon:'arrow-up-circle-outline' },
  { id:'pose_sway', label:'Khoe dáng qua lại', icon:'body-outline' },
  { id:'sit_stand', label:'Đứng lên · ngồi xuống', icon:'accessibility-outline' },
];

module.exports = function registerTryonRoutes(api, ctx) {
  const { read, update, httpError, adviseSize, runAccessoryPipeline, accessoryKind, tryonGpuBusy, MOTION_OUTPUT_DIR } = ctx;

  // Ước lượng size phù hợp và độ lệch so với size khách chọn để cảnh báo chật/rộng.
  // Không co giãn ảnh catalog trước inference: thao tác đó làm sai hoa văn/phom và
  // là một nguyên nhân khiến engine cũ tạo ra tấm vải hình chữ nhật.
  function computeSizeFit(chosenSizeRaw, profile) {
    const chosen = String(chosenSizeRaw || 'M').toUpperCase();
    const chosenIndex = SIZE_ORDER.indexOf(chosen);
    if (!profile || chosenIndex < 0) return { chosen, recommended: null, delta: 0, verdict: 'unknown', message: '' };
    const { size: recommended } = adviseSize(profile);
    const recommendedIndex = SIZE_ORDER.indexOf(recommended);
    const delta = recommendedIndex < 0 ? 0 : chosenIndex - recommendedIndex;
    const verdict = delta === 0 ? 'good' : delta < 0 ? 'tight' : 'loose';
    const message = verdict === 'good'
      ? `Kích cỡ ${chosen} phù hợp với số đo bạn nhập.`
      : verdict === 'tight'
        ? `Bạn chọn size ${chosen} nhưng số đo hợp với size ${recommended} hơn — trang phục trong ảnh có thể hơi chật/bó sát so với thực tế.`
        : `Bạn chọn size ${chosen} nhưng số đo hợp với size ${recommended} hơn — trang phục trong ảnh có thể hơi rộng/thùng thình so với thực tế.`;
    return { chosen, recommended, delta, verdict, message };
  }

  // Ảnh vải chỉ được chỉnh khổ (hẹp/rộng hơn) trước khi gửi cho AI — đây là ước
  // lượng hình ảnh, không phải mô phỏng vải vật lý chính xác 100%.
  // eslint-disable-next-line no-unused-vars
  async function adjustGarmentForFit(garmentImagePath, fitDelta) {
    if (!fitDelta) return garmentImagePath;
    try {
      const imageBase64 = fs.readFileSync(garmentImagePath).toString('base64');
      const result = await runAccessoryPipeline({ mode: 'fit_adjust', imageBase64, fitDelta }, 20000);
      if (!result.ok || !result.imageBase64) return garmentImagePath;
      const tempPath = path.join(os.tmpdir(), `japano-fit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
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

  async function validateTryOnResult(personImageBase64, resultImage, pose, clothType, requireStraightPose = false) {
    if (!resultImage || !resultImage.startsWith('data:')) return { ok: true, reasons: [] };
    try {
      const compareImageBase64 = resultImage.slice(resultImage.indexOf(',') + 1);
      const checked = await runAccessoryPipeline({
        mode: 'quality', imageBase64: personImageBase64, compareImageBase64,
        pose, clothType, requireStraightPose,
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

  function fashnCategoryFor(product = {}) {
    const type = clothTypeFor(product);
    return type === 'lower' ? 'bottoms' : type === 'overall' ? 'one-pieces' : 'tops';
  }

  async function tryFashn(personImageBase64, garmentImagePath, product, shouldRepose = false, generationAttempt = 0) {
    const form = new FormData();
    const person = Buffer.from(stripDataUri(personImageBase64), 'base64');
    const garment = fs.readFileSync(garmentImagePath);
    form.append('person', new Blob([person], { type: 'image/jpeg' }), 'person.jpg');
    form.append('cloth', new Blob([garment], { type: 'image/jpeg' }), path.basename(garmentImagePath));
    form.append('category', fashnCategoryFor(product));
    const garmentPhotoType = /_tryon-flat\.(?:jpe?g|png|webp)$/i.test(path.basename(garmentImagePath)) ? 'flat-lay' : 'model';
    form.append('garment_photo_type', garmentPhotoType);
    const shouldRefine = FASHN_FIDELITY_REFINE
      && garmentPhotoType === 'flat-lay'
      && fashnCategoryFor(product) === 'one-pieces';
    form.append('refine', shouldRefine ? 'true' : 'false');
    form.append('repose', shouldRepose ? 'true' : 'false');
    form.append('seed', String(Number(process.env.JAPANO_FASHN_SEED || 42) + generationAttempt * 101));
    const response = await fetchWithTimeout(`${FASHN_URL}/tryon`, { method: 'POST', body: form }, Number(process.env.JAPANO_TRYON_TIMEOUT_MS || 900000));
    if (!response.ok) {
      let detail = '';
      try { detail = String((await response.json()).detail || ''); } catch {}
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    const type = String(response.headers.get('content-type') || 'image/png');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error('FASHN không trả ảnh');
    return {
      image: `data:${type.startsWith('image/') ? type.split(';')[0] : 'image/png'};base64,${bytes.toString('base64')}`,
      engine: String(response.headers.get('x-japano-engine') || 'fashn-vton-1.5'),
      reposed: String(response.headers.get('x-japano-reposed') || '').toLowerCase() === 'true',
    };
  }

  async function tryAccessoryRefine(roughImage, cleanImage, accessories, generationAttempt = 0) {
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
      { method:'POST', body:form },
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

  // eslint-disable-next-line no-unused-vars
  async function tryCatvton(personImageBase64, garmentImagePath, product, mainPersonBox, keypoints, shouldRepose = false) {
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
    const response = await fetchWithTimeout(`${CATVTON_URL}/tryon`, { method: 'POST', body: form }, Number(process.env.JAPANO_TRYON_TIMEOUT_MS || 720000));
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
    const b = req.body || {};
    if (!b.personImageBase64 || !b.productId) return res.status(400).json({ ok: false, message: 'Thiếu ảnh người dùng hoặc productId.' });
    const state = read();
    const product = state.products.find((item) => item.slug === String(b.productId) || item.id === String(b.productId));
    if (!product) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
    let garmentImagePath = resolveGarmentImage(product.slug);
    if (!garmentImagePath) return res.status(404).json({ ok: false, message: 'Không tìm thấy ảnh sản phẩm để ghép.' });
    const sizeFit = computeSizeFit(b.size, b.profile);
    const accessoryIds = [...new Set((b.accessoryIds || b.accessoryProductIds || []).map(String))].slice(0, 4);
    const accessories = accessoryIds
      .map((id) => state.products.find((item) => item.slug === id || item.id === id))
      .filter((item) => item && (item.cat === 'phu-kien' || item.category === 'phu-kien'));
    const attempts = [];
    let poseAnalysis = await runAccessoryPipeline({ mode: 'analyze', imageBase64: b.personImageBase64 }, 60000);
    if (!poseAnalysis.ok || !poseAnalysis.pose?.box) {
      // Pose detector hỏng/không nhận được người không còn là lý do chặn request.
      // FLUX vẫn được thử với khung trung tâm; nếu cả GPU pipeline thất bại, phía
      // dưới còn một ảnh preview cục bộ để UI không bao giờ trắng.
      poseAnalysis = {
        ok: true,
        pose: {
          box: [150, 50, 620, 1000], keypoints: {}, otherBoxes: [], confidence: 0,
          fallback: true, inferredKeypoints: [],
          garmentRegion: { ok: false, reason: 'no_person', message: 'Đang dùng khung người trung tâm dự phòng.' },
          poseSuitability: { requiresRepose: true, score: 0, reasons: ['detector_fallback'] },
        },
        normalizedImageBase64: '',
      };
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
    const requiresRepose = Boolean(FORCE_REPOSE || poseSuitability.requiresRepose || occluded);
    const reposeReasons = [...new Set([
      ...(poseSuitability.reasons || []),
      ...(FORCE_REPOSE ? ['always_repose'] : []),
    ])];
    const normalizedPersonImageBase64 = poseAnalysis.normalizedImageBase64 || b.personImageBase64;
    const clothType = clothTypeFor(product);
    let imageUrl = '';
    let engine = '';
    let poseTransferred = false;
    let rejectedQuality = null;
    let qualityWarning = null;
    let bestCandidate = null;
    const automaticAttempts = Math.max(1, Math.min(3, Number(process.env.JAPANO_TRYON_AUTO_ATTEMPTS || 2)));
    for (let generationAttempt = 0; generationAttempt < automaticAttempts && !imageUrl; generationAttempt += 1) {
      try {
        const fashn = await tryFashn(
          normalizedPersonImageBase64,
          garmentImagePath,
          product,
          requiresRepose,
          generationAttempt,
        );
        imageUrl = fashn.image;
        poseTransferred = fashn.reposed;
        engine = fashn.engine;
      } catch (error) {
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
      const quality = await validateTryOnResult(normalizedPersonImageBase64, imageUrl, poseAnalysis.pose, clothType, requiresRepose);
      if (!quality.ok) {
        rejectedQuality = quality;
        attempts.push(`FASHN lượt ${generationAttempt + 1} bị quality gate chặn: ${(quality.reasons || []).join(', ')}`);
        const penaltyWeights = {
          main_subject_lost: 100,
          garment_unchanged: 90,
          flat_or_blurred_garment: 60,
          pose_not_corrected: 45,
          secondary_person_changed: 30,
        };
        const penalty = (quality.reasons || []).reduce((sum, reason) => sum + (penaltyWeights[reason] || 20), 0);
        const candidate = { imageUrl, engine, poseTransferred, quality, penalty };
        if (!bestCandidate || candidate.penalty < bestCandidate.penalty) bestCandidate = candidate;
        const hardFailure = (quality.reasons || []).some((reason) => [
          'main_subject_lost', 'garment_unchanged', 'flat_or_blurred_garment', 'pose_not_corrected',
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
    // Sau khi đã tự đổi seed mà vẫn còn cảnh báo cứng, trả ứng viên tốt nhất.
    // Người dùng cần nhìn thấy kết quả để tự quyết định thay vì nhận màn hình rỗng.
    if (!imageUrl && bestCandidate) {
      imageUrl = bestCandidate.imageUrl;
      engine = `${bestCandidate.engine}+best-effort`;
      poseTransferred = bestCandidate.poseTransferred;
      qualityWarning = bestCandidate.quality;
    }
    // CatVTON không biết đổi pose; chỉ thử fallback với ảnh vốn đã có pose tốt.
    if (!imageUrl && !requiresRepose && String(process.env.JAPANO_CATVTON_FALLBACK || '0') === '1') {
      try {
        const catvton = await tryCatvton(normalizedPersonImageBase64, garmentImagePath, product, poseAnalysis.pose.box, poseAnalysis.pose.keypoints, false);
        const quality = await validateTryOnResult(normalizedPersonImageBase64, catvton.image, poseAnalysis.pose, clothType, false);
        if (!quality.ok) {
          rejectedQuality = quality;
          attempts.push(`CatVTON fallback bị chặn: ${(quality.reasons || []).join(', ')}`);
        } else {
          imageUrl = catvton.image;
          engine = 'catvton-quality-fallback';
        }
      } catch (error) { attempts.push(`CatVTON fallback: ${error.message}`); }
    }
    if (!imageUrl) {
      return res.status(503).json({
        ok: false,
        code: 'TRYON_AI_UNAVAILABLE',
        message: 'AI chưa tạo được ảnh thử đồ thật. Vui lòng thử lại; ứng dụng sẽ không dùng ảnh sản phẩm chồng lên ảnh của bạn để giả làm kết quả.',
        attempts,
      });
    }
    let appliedAccessories = [];
    let accessoryWarning = '';
    let accessoryQuality = null;
    if (accessories.length) {
      const cleanTryOnImage = imageUrl;
      const accessoryPayload = accessories.map((item) => ({
        id: item.slug,
        name: item.name,
        kind: accessoryKind(item),
        imagePath: resolveGarmentImage(item.slug),
      })).filter((item) => item.imagePath);
      const composed = await runAccessoryPipeline({
        mode: 'compose',
        imageBase64: imageUrl,
        accessories: accessoryPayload,
      }, 180000);
      if (!composed.ok || !composed.imageBase64 || !composed.applied?.length) {
        accessoryWarning = 'Trang phục đã được thay; phụ kiện chưa ghép được tự nhiên nên ảnh chính vẫn được hiển thị.';
        attempts.push(`Phụ kiện: ${composed.message || 'không có phụ kiện được áp dụng'}`);
      } else {
        appliedAccessories = composed.applied;
        const kinds = appliedAccessories.map((item) => item.kind);
        const roughImage = `data:image/png;base64,${composed.imageBase64}`;
        const roughQuality = await validateAccessoryResult(cleanTryOnImage, roughImage, kinds);
        const candidates = [{ image:roughImage, stage:'accessory-pose-fallback', quality:roughQuality }];
        if (String(process.env.JAPANO_ACCESSORY_REFINE || '1').trim().toLowerCase() !== '0') {
          const refineAttempts = Math.max(1, Math.min(3, Number(process.env.JAPANO_ACCESSORY_REFINE_ATTEMPTS || 2)));
          for (let generationAttempt = 0; generationAttempt < refineAttempts; generationAttempt += 1) {
            try {
              const refined = await tryAccessoryRefine(roughImage, cleanTryOnImage, accessoryPayload, generationAttempt);
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
              attempts.push(`Làm đẹp phụ kiện lượt ${generationAttempt + 1}: ${error.message}`);
            }
          }
        }
        const passing = candidates.filter((candidate) => candidate.quality?.ok);
        const pool = passing.length ? passing : candidates;
        pool.sort((a, b) => Number(a.quality?.score ?? 9999) - Number(b.quality?.score ?? 9999));
        const best = pool[0];
        imageUrl = best.image;
        accessoryQuality = best.quality;
        engine = `${engine}+${best.stage}`;
        if (!best.quality?.ok) {
          accessoryWarning = `Đã ghép ${appliedAccessories.map((item) => item.name).join(', ')} bằng ảnh tốt nhất; AI còn cảnh báo: ${accessoryQualityLabels(best.quality?.reasons || ['accessory_quality_unknown']).join(', ')}.`;
        }
      }
    }
    const userId = String(b.userId || 'guest');
    update((next) => {
      const createdAt = Date.now();
      next.tryonHistory.push({ id: `tryon-${createdAt}`, userId, productId: product.slug, accessoryIds, engine, createdAt });
      next.interactions.push({ id: `tryon-i-${createdAt}`, userId, productId: product.slug, type: 'tryon', value: 1, createdAt, source: 'mobile' });
      return next;
    });
    res.json({
      ok: true,
      imageBase64: imageUrl,
      imageUrl,
      engine,
      attempts,
      message: accessoryWarning
        || (appliedAccessories.length
          ? `Đã thay đồ cho một nhân vật chính và dùng FLUX.2 làm đẹp: ${appliedAccessories.map((item) => item.name).join(', ')}.`
          : qualityWarning
            ? (qualityWarning.message || `Đã trả ảnh thử đồ tốt nhất. AI còn cảnh báo: ${(qualityWarning.reasons || []).join(', ')}.`)
            : poseTransferred
          ? 'FLUX.2 đã đưa nhân vật chính về tư thế phù hợp, sau đó FASHN VTON 1.5 mặc trang phục và kiểm tra chất lượng.'
          : 'FASHN VTON 1.5 đã mặc trang phục cho đúng nhân vật chính và kết quả đã qua kiểm tra chất lượng.'),
      recommendedSize: sizeFit.recommended || undefined,
      sizeFit,
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
      // FASHN mặc định tự nhả model sau mỗi lượt. Motion engine phải tự giới hạn
      // GPU/RAM; endpoint không được phép fallback ngầm về model cũ hay CPU.
      const response = await fetchWithTimeout(`${MOTION_URL}/animate`, {
        method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({ imageBase64, motion, seed:Number(req.body?.seed || 42) }),
      }, Number(process.env.JAPANO_MOTION_TIMEOUT_MS || 720000));
      if (!response.ok) {
        const detail = await response.text();
        let message = detail;
        try { message = JSON.parse(detail)?.detail || detail; } catch { /* plain response */ }
        throw httpError(response.status, String(message || 'Model chuyển động không phản hồi.'));
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw httpError(502, 'Model chuyển động không trả MP4.');
      const id = `motion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      fs.writeFileSync(path.join(MOTION_OUTPUT_DIR, `${id}.mp4`), bytes);
      res.json({ ok:true, engine:MOTION_ENGINE_LABEL, motion, videoUrl:`/api/tryon/motion/video/${id}` });
    } catch (error) {
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
