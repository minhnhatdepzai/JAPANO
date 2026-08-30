// Hàng đợi bất đồng bộ nhẹ cho storefront web. Dữ liệu ảnh và kết quả chỉ tồn
// tại trong RAM với TTL ngắn; không tạo collection MongoDB và không ghi base64
// vào log. Các endpoint đồng bộ cũ vẫn nguyên vẹn cho ứng dụng mobile.
const crypto = require('crypto');

const JOB_TTL_MS = Math.max(2 * 60_000, Number(process.env.JAPANO_AI_JOB_TTL_MS || 15 * 60_000));
const MAX_JOBS = Math.max(10, Number(process.env.JAPANO_AI_JOB_MAX || 100));

module.exports = function registerAsyncAiJobs(api, ctx) {
  const jobs = new Map();
  const specs = [
    { kind: 'tryon', route: '/tryon/jobs', target: '/api/tryon', runningStage: 'Đang tạo ảnh thử đồ thật' },
    { kind: 'motion', route: '/tryon/motion/jobs', target: '/api/tryon/motion', runningStage: 'Đang tạo chuyển động' },
    { kind: 'travel-scene', route: '/japan-spots/scene-photo/jobs', target: '/api/japan-spots/scene-photo', runningStage: 'Đang ghép phong cảnh Nhật Bản' },
  ];

  function cleanup() {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (job.expiresAt <= now) jobs.delete(id);
    }
    if (jobs.size <= MAX_JOBS) return;
    [...jobs.values()]
      .sort((left, right) => left.updatedAt - right.updatedAt)
      .slice(0, jobs.size - MAX_JOBS)
      .forEach((job) => jobs.delete(job.id));
  }

  function publicJob(job) {
    return {
      id: job.id,
      type: job.kind,
      status: job.status,
      stage: job.stage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      expiresAt: job.expiresAt,
      ...(job.status === 'completed' ? { result: job.result } : {}),
      ...(job.status === 'failed' ? { error: job.error } : {}),
    };
  }

  async function run(job, spec) {
    if (job.status === 'cancelled') return;
    job.status = 'running';
    job.stage = spec.runningStage;
    job.updatedAt = Date.now();
    try {
      const response = await fetch(`http://127.0.0.1:${ctx.PORT}${spec.target}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(job.authorization ? { authorization: job.authorization } : {}),
        },
        body: JSON.stringify(job.input),
        signal: job.controller.signal,
      });
      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json')
        ? await response.json()
        : { ok: false, message: await response.text() };
      if (job.status === 'cancelled') return;
      if (!response.ok || result?.ok === false) {
        throw Object.assign(new Error(result?.message || `AI service HTTP ${response.status}`), { status: response.status });
      }
      job.status = 'completed';
      job.stage = 'Hoàn tất';
      job.result = result;
    } catch (error) {
      if (job.status !== 'cancelled') {
        job.status = 'failed';
        job.stage = 'Không hoàn tất';
        job.error = error?.name === 'AbortError' ? 'Tác vụ đã bị hủy.' : (error?.message || 'Tác vụ AI thất bại.');
      }
    } finally {
      job.input = undefined;
      job.authorization = undefined;
      job.updatedAt = Date.now();
      job.expiresAt = Date.now() + JOB_TTL_MS;
    }
  }

  for (const spec of specs) {
    api.post(spec.route, (req, res) => {
      cleanup();
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ ok: false, message: 'Dữ liệu tác vụ không hợp lệ.' });
      }
      const now = Date.now();
      const id = `${spec.kind}-${crypto.randomUUID()}`;
      const job = {
        id,
        kind: spec.kind,
        status: 'queued',
        stage: 'Đang xếp hàng',
        input: req.body,
        authorization: String(req.headers.authorization || ''),
        controller: new AbortController(),
        createdAt: now,
        updatedAt: now,
        expiresAt: now + JOB_TTL_MS,
      };
      jobs.set(id, job);
      setImmediate(() => run(job, spec));
      return res.status(202).json({ ok: true, job: publicJob(job) });
    });

    api.get(`${spec.route}/:id`, (req, res) => {
      cleanup();
      const job = jobs.get(String(req.params.id || ''));
      if (!job || job.kind !== spec.kind) return res.status(404).json({ ok: false, message: 'Tác vụ không còn tồn tại hoặc đã hết hạn.' });
      return res.json({ ok: true, job: publicJob(job) });
    });

    api.delete(`${spec.route}/:id`, (req, res) => {
      const job = jobs.get(String(req.params.id || ''));
      if (!job || job.kind !== spec.kind) return res.status(404).json({ ok: false, message: 'Không tìm thấy tác vụ.' });
      if (job.status === 'queued' || job.status === 'running') job.controller.abort();
      job.status = 'cancelled';
      job.stage = 'Đã hủy';
      job.input = undefined;
      job.result = undefined;
      job.updatedAt = Date.now();
      job.expiresAt = Date.now() + 2 * 60_000;
      return res.json({ ok: true, job: publicJob(job) });
    });
  }

  const timer = setInterval(cleanup, 60_000);
  timer.unref?.();
};
