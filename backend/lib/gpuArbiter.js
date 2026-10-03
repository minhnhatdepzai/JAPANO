// Bộ điều phối GPU toàn cục: focus theo màn hình + hàng chờ ưu tiên.
//
// Chính sách:
// - motion (300): độc quyền GPU/RAM; thử đồ/Qwen dừng, embedding unload.
// - tryon (200): độc quyền GPU cho FASHN/FLUX; motion/Qwen dừng và semantic
//   embedding unload.
// - vision (120): Qwen3-VL mô tả ảnh; embedding tạm unload.
// - recommendation (100): dùng GPU khi tryon/motion/vision đều không chạy.
//
// Hàng chờ chỉ cho một job tạo sinh chạy tại một thời điểm. Chuyển màn hình có
// thể hủy cả job đang chờ lẫn request đang chạy qua AbortSignal.
const {
  FASHN_URL, MOTION_URL, OLLAMA_URL, EMBEDDING_URL,
} = require('./serviceUrls');
const { fetchWithTimeout } = require('./httpFetch');
const { logger } = require('./logger');
const { GpuJobQueue, GpuJobCancelledError, DEFAULT_PRIORITIES } = require('./gpuJobQueue');

const FOCUS_PROFILES = {
  tryon: {
    keep: ['fashn'],
    embeddingDevice: 'off',
    label: 'Thử đồ AI',
  },
  // Bikini hai mảnh chạy FLUX trên cùng service cổng 7862 nhưng không dùng
  // checkpoint FASHN. Tách focus để giữ service mà KHÔNG warm FASHN vô ích.
  swimwear: {
    keep: ['fashn'],
    embeddingDevice: 'off',
    label: 'Thử đồ bơi AI',
  },
  motion: {
    keep: ['motion'],
    embeddingDevice: 'off',
    label: 'Tạo ảnh chuyển động',
  },
  vision: {
    keep: ['ollama'],
    embeddingDevice: 'off',
    label: 'Phân tích ảnh sản phẩm',
  },
  chat: {
    keep: ['ollama', 'chatAdapter'],
    embeddingDevice: 'off',
    label: 'Trợ lý Ori',
  },
  home: {
    // Điều hướng từ màn thử đồ về tab/home thường chỉ kéo dài vài giây. Giữ
    // FASHN trong khoảng idle của chính service (180s) để một cleanup focus
    // ngắn không unload 4 GB rồi lượt try-on kế tiếp lại cold-start 7-9s.
    // Khi sang chat/motion, profile tương ứng vẫn nhả FASHN ngay để lấy VRAM.
    keep: ['embedding', 'fashn'],
    embeddingDevice: 'cuda',
    label: 'Trang chủ / gợi ý',
  },
  browse: {
    keep: ['embedding', 'fashn'],
    embeddingDevice: 'cuda',
    label: 'Duyệt sản phẩm / gợi ý nền',
  },
};
const DEFAULT_FOCUS = 'browse';

const gpuQueue = new GpuJobQueue(DEFAULT_PRIORITIES);
let currentFocus = DEFAULT_FOCUS;
let lastChangedAt = Date.now();
let lastActions = [];
let transitionChain = Promise.resolve();
let deferredFashnWarmupTimer = null;

function focusProfile(focus) {
  return FOCUS_PROFILES[focus] || FOCUS_PROFILES[DEFAULT_FOCUS];
}

async function postService(url, timeoutMs = 20000) {
  const response = await fetchWithTimeout(url, { method: 'POST' }, timeoutMs);
  return response.json().catch(() => ({}));
}

async function releaseFashn() {
  // /cancel là cooperative cancellation; /unload nhả model ngay khi job đã
  // thoát. Gọi cả hai giúp đổi sang motion/home không để FLUX giữ VRAM.
  await postService(`${FASHN_URL}/cancel`, 5000).catch(() => ({}));
  const body = await postService(`${FASHN_URL}/unload`, 20000);
  if (body?.skipped === 'gpu-job-active') {
    return { service: 'fashn', released: false, reason: 'đang dừng lượt thử đồ' };
  }
  return { service: 'fashn', released: Boolean(body?.ok), freeVramGb: body?.freeVramGb };
}

async function warmFashn() {
  // Nếu model đã nằm trên GPU hoặc một lượt đang chạy thì không chen thêm vào
  // LOCK của FastAPI. Warmup chỉ có ý nghĩa lúc người dùng vừa mở màn thử đồ.
  const healthResponse = await fetchWithTimeout(`${FASHN_URL}/health`, {}, 5000);
  const health = await healthResponse.json().catch(() => ({}));
  if (health?.loaded?.fashn || health?.gpuJobActive) {
    return { service: 'fashn', warmed: Boolean(health?.loaded?.fashn), skipped: health?.gpuJobActive ? 'gpu-job-active' : undefined };
  }
  const body = await postService(`${FASHN_URL}/warmup`, 60000);
  return { service: 'fashn', warmed: Boolean(body?.ok), engine: body?.engine, freeVramGb: body?.freeVramGb };
}

function focusRestorePlan(type, restoreFocus) {
  const sameFocus = String(type) === String(restoreFocus);
  return {
    restoreSynchronously: !sameFocus,
    // Fit-refine dùng FLUX và đẩy FASHN khỏi GPU. Nạp lại FASHN trước khi
    // resolve runGpuJob từng giữ ảnh đã xong thêm 15-30 giây ở backend. Khi
    // người dùng vẫn đứng ở màn try-on, trả ảnh trước rồi warm ở nền.
    deferFashnWarmup: sameFocus && type === 'tryon',
  };
}

function deferFashnWarmup() {
  if (deferredFashnWarmupTimer) clearTimeout(deferredFashnWarmupTimer);
  const configured = Number(process.env.JAPANO_FASHN_BACKGROUND_WARMUP_DELAY_MS || 750);
  const delayMs = Number.isFinite(configured) ? Math.max(100, Math.min(10000, configured)) : 750;
  deferredFashnWarmupTimer = setTimeout(() => {
    deferredFashnWarmupTimer = null;
    // Đi qua cùng transition chain để không đua với thao tác đổi sang
    // home/browse/motion. Kiểm tra lại focus và queue ngay trước khi nạp model.
    transitionChain = transitionChain
      .catch(() => undefined)
      .then(async () => {
        const queue = gpuQueue.status();
        if (currentFocus !== 'tryon' || queue.active || queue.pending.length) return;
        try {
          const action = await warmFashn();
          logger.info({ action }, 'GPU arbiter: làm nóng FASHN nền sau khi đã trả ảnh');
        } catch (error) {
          logger.warn({ error: error?.message || String(error) }, 'GPU arbiter: không làm nóng được FASHN ở nền');
        }
      });
  }, delayMs);
  deferredFashnWarmupTimer.unref?.();
}

async function releaseMotion() {
  const body = await postService(`${MOTION_URL}/cancel`, 10000);
  return {
    service: 'motion',
    released: Boolean(body?.ok),
    cancelled: Boolean(body?.cancelled),
  };
}

async function releaseOllama() {
  const listResponse = await fetchWithTimeout(`${OLLAMA_URL}/api/ps`, {}, 5000);
  const listed = await listResponse.json().catch(() => ({}));
  const names = (listed?.models || [])
    .map((row) => String(row?.name || row?.model || '').trim())
    .filter(Boolean);
  const released = [];
  for (const name of names) {
    try {
      await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name, keep_alive: 0 }),
      }, 15000);
      released.push(name);
    } catch {
      // Một model Ollama không nhả được không được chặn các model còn lại.
    }
  }
  return { service: 'ollama', released: released.length > 0, models: released };
}

async function setEmbeddingDevice(device) {
  const endpoint = device === 'off' ? '/unload' : '/device';
  const response = await fetchWithTimeout(`${EMBEDDING_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: device === 'off' ? undefined : JSON.stringify({ device }),
  }, 30000);
  const body = await response.json().catch(() => ({}));
  return {
    service: 'embedding',
    device: body?.device || device,
    moved: Boolean(body?.moved),
    released: device === 'off' && Boolean(body?.ok),
    unloaded: Boolean(body?.unloaded),
  };
}

const RELEASERS = {
  fashn: releaseFashn,
  motion: releaseMotion,
  ollama: releaseOllama,
  chatAdapter: async () => {
    const url = process.env.JAPANO_CHAT_ADAPTER_URL;
    if (!url) return {service:'chatAdapter',released:false,reason:'disabled'};
    const body = await postService(`${url.replace(/\/$/, '')}/unload`, 20000);
    return {service:'chatAdapter',released:Boolean(body.ok)};
  },
};

// Job đang chạy cần service nào. Nhả model của service đó giữa chừng làm hỏng
// đúng bức ảnh mà người dùng đang chờ: log thật cho thấy FASHN sinh xong ảnh,
// rồi bị unload trước khi backend kịp trả về, và request kết thúc bằng 503.
const SERVICE_NEEDED_BY_JOB = {
  tryon: 'fashn',
  swimwear: 'fashn',
  motion: 'motion',
  chat: 'chatAdapter',
};

function serviceLockedByActiveJob() {
  const active = gpuQueue.status()?.active;
  if (!active) return '';
  return SERVICE_NEEDED_BY_JOB[String(active.type)] || '';
}

function cancellationTargets(focus) {
  if (focus === 'tryon' || focus === 'swimwear') return ['motion', 'vision', 'recommendation'];
  if (focus === 'motion') return ['tryon', 'vision', 'recommendation'];
  // home/browse là focus THỤ ĐỘNG do AppState và router phát khi màn hình mờ,
  // back-stack đổi hoặc component cleanup. Chúng không chứng minh người dùng
  // muốn bỏ ảnh đang tạo, nên không được biến một inference đã bắt đầu thành
  // 409 trong khi worker vẫn sinh ảnh mồ côi. Đổi ảnh có /tryon/cancel riêng;
  // các tính năng GPU thật (chat/motion/tryon) vẫn huỷ đối thủ như trước.
  if (focus === 'home' || focus === 'browse') return [];
  if (focus === 'chat') return ['tryon', 'motion', 'vision'];
  return [];
}

async function applyFocus(next, changed, force) {
  const profile = focusProfile(next);
  const keep = new Set(profile.keep);
  // Không bao giờ nhả service mà job ĐANG CHẠY còn cần. Đổi màn hình chỉ nói
  // lên ý định của người dùng cho lượt SAU; nó không được phá lượt đang dở.
  const locked = serviceLockedByActiveJob();
  if (locked) keep.add(locked);
  const targets = Object.keys(RELEASERS).filter((service) => !keep.has(service));
  const actions = [];
  if (locked) {
    actions.push({ service: locked, released: false, reason: 'đang phục vụ một job GPU chưa xong' });
  }

  for (const service of targets) {
    try {
      actions.push(await RELEASERS[service]());
    } catch (error) {
      // Service AI tùy chọn có thể đang tắt.
      actions.push({ service, released: false, reason: error?.message || 'không gọi được' });
    }
  }
  try {
    actions.push(await setEmbeddingDevice(profile.embeddingDevice));
  } catch (error) {
    actions.push({
      service: 'embedding',
      device: profile.embeddingDevice,
      moved: false,
      reason: error?.message || 'không gọi được',
    });
  }
  if (next === 'tryon') {
    try {
      actions.push(await warmFashn());
    } catch (error) {
      actions.push({ service: 'fashn', warmed: false, reason: error?.message || 'không pre-warm được' });
    }
  }

  lastActions = actions;
  if (changed || force) logger.info({ focus: next, actions }, 'GPU arbiter: đổi màn hình ưu tiên');
  return {
    ok: true,
    focus: next,
    changed,
    kept: [...keep],
    embeddingDevice: profile.embeddingDevice,
    actions,
    queue: gpuQueue.status(),
  };
}

/**
 * Đổi focus. API màn hình truyền cancelActive=true; chuyển focus nội bộ trước
 * khi scheduler chạy job thì không hủy job khác mà để hàng chờ quyết định.
 */
function setFocus(focus, options = {}) {
  const next = FOCUS_PROFILES[focus] ? focus : DEFAULT_FOCUS;
  const changed = next !== currentFocus;
  currentFocus = next;
  if (changed) lastChangedAt = Date.now();

  let cancelled = [];
  if (options.cancelActive) {
    cancelled = gpuQueue.cancel(
      cancellationTargets(next),
      `Đã dừng tác vụ GPU vì người dùng chuyển sang ${focusProfile(next).label}.`,
      options.owner,
    );
  }

  // AppState/điều hướng có thể gửi nhiều tín hiệu giống nhau trong lúc một
  // transition nặng đang nhả/nạp model. Trước đây mỗi tín hiệu lại nối thêm
  // một applyFocus đầy đủ vào transitionChain. Một lượt bikini vì thế phải
  // chờ gần ba phút các transition "swimwear -> swimwear" vô ích, đến khi
  // client timeout thì cổng 18+ mới chạy xong và FLUX mới bắt đầu.
  //
  // Việc huỷ theo owner ở trên vẫn luôn được thực hiện. Chỉ bỏ phần quản lý
  // model lặp lại; runGpuJob và các chuyển focus thật dùng force/changed nên
  // vẫn chờ đúng transition cần thiết.
  if (!changed && !options.force) {
    const profile = focusProfile(next);
    return Promise.resolve({
      ok: true,
      focus: next,
      changed: false,
      kept: [...profile.keep],
      embeddingDevice: profile.embeddingDevice,
      actions: [],
      cancelled,
      queue: gpuQueue.status(),
      deduplicated: true,
    });
  }

  transitionChain = transitionChain
    .catch(() => undefined)
    .then(() => applyFocus(next, changed, Boolean(options.force)))
    .then((result) => ({ ...result, cancelled }));
  return transitionChain;
}

function runGpuJob(type, task, metadata = {}) {
  return gpuQueue.run(type, async (context) => {
    const returnFocus = currentFocus;
    await setFocus(type, { force: true });
    try {
      context.signal.throwIfAborted();
      return await task(context);
    } finally {
      // Job từ script/worker không được để focus tạo sinh bám lại vĩnh viễn.
      // Nếu màn hình đã đổi trong lúc chạy, giữ lựa chọn mới nhất của màn hình.
      const restoreFocus = currentFocus === type ? returnFocus : currentFocus;
      const plan = focusRestorePlan(type, restoreFocus);
      if (plan.restoreSynchronously) {
        await setFocus(restoreFocus, { force: true }).catch(() => undefined);
      } else if (plan.deferFashnWarmup) {
        deferFashnWarmup();
      }
    }
  }, metadata);
}

function cancelGpuJobs(types, reason, owner) {
  return gpuQueue.cancel(types, reason, owner);
}

function getFocus() {
  const profile = focusProfile(currentFocus);
  return {
    focus: currentFocus,
    label: profile.label,
    kept: profile.keep,
    embeddingDevice: profile.embeddingDevice,
    since: lastChangedAt,
    lastActions,
    profiles: Object.keys(FOCUS_PROFILES),
    queue: gpuQueue.status(),
  };
}

module.exports = {
  setFocus,
  getFocus,
  runGpuJob,
  cancelGpuJobs,
  FOCUS_PROFILES,
  DEFAULT_FOCUS,
  GpuJobCancelledError,
  focusRestorePlan,
  cancellationTargets,
};
