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
    keep: ['ollama'],
    embeddingDevice: 'off',
    label: 'Trợ lý Ori',
  },
  home: {
    keep: ['embedding'],
    embeddingDevice: 'cuda',
    label: 'Trang chủ / gợi ý',
  },
  browse: {
    keep: ['embedding'],
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
};

function cancellationTargets(focus) {
  if (focus === 'tryon') return ['motion', 'vision', 'recommendation'];
  if (focus === 'motion') return ['tryon', 'vision', 'recommendation'];
  if (focus === 'home' || focus === 'browse' || focus === 'chat') return ['tryon', 'motion', 'vision'];
  return [];
}

async function applyFocus(next, changed, force) {
  const profile = focusProfile(next);
  const keep = new Set(profile.keep);
  const targets = Object.keys(RELEASERS).filter((service) => !keep.has(service));
  const actions = [];

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
  lastChangedAt = Date.now();

  let cancelled = [];
  if (options.cancelActive) {
    cancelled = gpuQueue.cancel(
      cancellationTargets(next),
      `Đã dừng tác vụ GPU vì người dùng chuyển sang ${focusProfile(next).label}.`,
    );
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
      await setFocus(restoreFocus, { force: true }).catch(() => undefined);
    }
  }, metadata);
}

function cancelGpuJobs(types, reason) {
  return gpuQueue.cancel(types, reason);
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
};
