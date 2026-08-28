const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { analyzeViaWorker, bodyWorkerUrl, summarizeBodyAnalysis } = require('../lib/bodyAnalysis');

// Worker thường trú là TỐI ƯU tốc độ, không phải phụ thuộc bắt buộc. Nó đưa một
// lượt phân tích cơ thể từ 4.12s xuống 0.35s bằng cách giữ YOLOv8n-pose và U2Net
// thường trú thay vì nạp lại ở mỗi request. Nhưng nếu nó chết, chưa bật, hay trả
// rác thì tính năng vẫn phải chạy qua đường spawn cũ — các bài dưới đây khoá
// đúng tính chất đó.

function withServer(handler, run) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      const previous = process.env.JAPANO_BODY_WORKER_URL;
      process.env.JAPANO_BODY_WORKER_URL = `http://127.0.0.1:${port}`;
      try {
        resolve(await run());
      } catch (error) {
        reject(error);
      } finally {
        if (previous === undefined) delete process.env.JAPANO_BODY_WORKER_URL;
        else process.env.JAPANO_BODY_WORKER_URL = previous;
        server.close();
      }
    });
  });
}

test('worker trả kết quả hợp lệ thì dùng luôn, không cần spawn Python', async () => {
  const result = await withServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, estimatedHeight: { valueCm: 165 }, servedBy: 'warm-worker' }));
  }, () => analyzeViaWorker({ mode: 'body_analysis', imageBase64: 'x' }, 5000));
  assert.equal(result.ok, true);
  assert.equal(result.estimatedHeight.valueCm, 165);
  assert.equal(result.servedBy, 'warm-worker');
});

test('worker lỗi 500 thì trả null để caller rơi về đường spawn', async () => {
  const result = await withServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: 'nổ' }));
  }, () => analyzeViaWorker({ mode: 'body_analysis' }, 5000));
  assert.equal(result, null);
});

test('worker trả ok=false thì cũng phải rơi về đường spawn', async () => {
  const result = await withServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: 'không đọc được ảnh' }));
  }, () => analyzeViaWorker({ mode: 'body_analysis' }, 5000));
  assert.equal(result, null);
});

test('worker trả JSON hỏng không được làm sập request', async () => {
  const result = await withServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{ đây không phải JSON');
  }, () => analyzeViaWorker({ mode: 'body_analysis' }, 5000));
  assert.equal(result, null);
});

test('worker treo quá timeout thì bỏ qua, không giữ request lại', async () => {
  const started = Date.now();
  const result = await withServer(() => {
    /* cố ý không trả lời */
  }, () => analyzeViaWorker({ mode: 'body_analysis' }, 1000));
  assert.equal(result, null);
  assert.ok(Date.now() - started < 5000, 'phải bỏ cuộc theo timeout đã cho');
});

test('đặt JAPANO_BODY_WORKER_URL rỗng là tắt hẳn worker', async () => {
  const previous = process.env.JAPANO_BODY_WORKER_URL;
  process.env.JAPANO_BODY_WORKER_URL = '';
  try {
    assert.equal(bodyWorkerUrl(), '');
    assert.equal(await analyzeViaWorker({ mode: 'body_analysis' }, 1000), null);
  } finally {
    if (previous === undefined) delete process.env.JAPANO_BODY_WORKER_URL;
    else process.env.JAPANO_BODY_WORKER_URL = previous;
  }
});

test('tóm tắt mang theo vòng bị loại và cờ tay dính thân để UI giải thích được', () => {
  const summary = summarizeBodyAnalysis({
    ok: true,
    estimatedHeight: { valueCm: 165, confidence: 0.3 },
    estimatedWeight: { valueKg: 55, confidence: 0.4 },
    estimatedGirthRanges: { bust: { minCm: 80, maxCm: 90 } },
    rejectedGirths: { hip: 'ngoài dải giải phẫu' },
    quality: { armsMergedIntoTorso: true, coverage: 'hip' },
  });
  assert.deepEqual(summary.rejectedGirths, { hip: 'ngoài dải giải phẫu' });
  assert.equal(summary.quality.armsMergedIntoTorso, true);
});

// Ước lượng đã lưu trên máy là số của MỘT THẾ HỆ model cụ thể. Máy Redmi test
// vẫn hiện "202 cm / 117 kg" nhiều ngày sau khi bộ ước lượng sinh ra chúng đã bị
// thay, vì chúng nằm trong AsyncStorage của app chứ không phải trong response.
// Logic dọn nằm ở mobile/lib/profile.ts; bài dưới đây khoá đúng hợp đồng đó ở
// mức thuần dữ liệu để nó không âm thầm đổi nghĩa.
const BODY_ESTIMATOR_GENERATION = 2;

function dropStaleEstimates(profile) {
  const hasEstimate = profile.heightEstimateCm != null || profile.weightEstimateKg != null;
  if (!hasEstimate || profile.estimatorGeneration === BODY_ESTIMATOR_GENERATION) return profile;
  const cleaned = {
    ...profile,
    heightEstimateCm: undefined, weightEstimateKg: undefined,
    estimateConfidence: undefined, heightEstimateConfidence: undefined,
    weightEstimateConfidence: undefined, estimatorGeneration: undefined,
  };
  if (cleaned.heightSource === 'image-estimation') cleaned.heightSource = undefined;
  if (cleaned.weightSource === 'image-estimation') cleaned.weightSource = undefined;
  if (cleaned.measurementSource === 'image-estimation') cleaned.measurementSource = undefined;
  return cleaned;
}

test('ước lượng của thế hệ model cũ bị loại khi mở app', () => {
  const stale = dropStaleEstimates({
    heightEstimateCm: 202, weightEstimateKg: 117,
    heightSource: 'image-estimation', weightSource: 'image-estimation',
    measurementSource: 'image-estimation',
  });
  assert.equal(stale.heightEstimateCm, undefined);
  assert.equal(stale.weightEstimateKg, undefined);
  assert.equal(stale.measurementSource, undefined);
});

test('số đo do người dùng tự nhập KHÔNG bị dọn cùng', () => {
  const kept = dropStaleEstimates({
    height: '162', weight: '52', heightSource: 'user', weightSource: 'user',
    heightEstimateCm: 202, estimatorGeneration: 1,
  });
  assert.equal(kept.height, '162');
  assert.equal(kept.weight, '52');
  assert.equal(kept.heightSource, 'user');
  assert.equal(kept.heightEstimateCm, undefined);
});

test('ước lượng đúng thế hệ hiện tại được giữ nguyên', () => {
  const profile = {
    heightEstimateCm: 165, weightEstimateKg: 55,
    measurementSource: 'image-estimation', estimatorGeneration: BODY_ESTIMATOR_GENERATION,
  };
  assert.strictEqual(dropStaleEstimates(profile), profile);
});
