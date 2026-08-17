// Đo hiệu năng các điểm cuối REST của JAPANO Store.
//
// Mục đích: kiểm chứng bằng số liệu yêu cầu phi chức năng "API nghiệp vụ phản
// hồi dưới 500 ms", thay vì khẳng định suông trong báo cáo.
//
// Cách dùng:
//   node backend/scripts/benchmark-api.js [--base http://127.0.0.1:4199]
//                                         [--n 200] [--c 10] [--token <JWT>]
//
// Kết quả in ra bảng và ghi tệp JSON thô để báo cáo trích dẫn lại được.
const fs = require('fs');
const path = require('path');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg('base', 'http://127.0.0.1:4199');
const N = Number(arg('n', 200));
const CONC = Number(arg('c', 10));
const TOKEN = arg('token', '');
const OUT = arg('out', path.join(__dirname, '..', '..', 'docs', 'project_evidence',
  'api_benchmarks', 'api_benchmark.json'));

// Chỉ đo các điểm cuối đọc dữ liệu — không đo điểm cuối tạo đơn/thanh toán để
// phép đo không sinh dữ liệu rác và không chạm tới cổng thanh toán.
const ENDPOINTS = [
  { name: 'health', method: 'GET', path: '/api/health', auth: false },
  { name: 'products (danh sách đầy đủ)', method: 'GET', path: '/api/products', auth: false },
  { name: 'shop (cấu hình cửa hàng)', method: 'GET', path: '/api/shop', auth: false },
  { name: 'locations/provinces', method: 'GET', path: '/api/locations/provinces', auth: false },
  { name: 'product detail (ai-description)', method: 'GET', path: '/api/products/cardigan-dai/ai-description', auth: false },
  { name: 'product related (ngữ nghĩa)', method: 'GET', path: '/api/products/cardigan-dai/related', auth: false },
  { name: 'product reviews', method: 'GET', path: '/api/products/cardigan-dai/reviews?userId=u9', auth: false },
  { name: 'orders (của người dùng)', method: 'GET', path: '/api/orders', auth: true },
  { name: 'state (toàn bộ dữ liệu quản trị)', method: 'GET', path: '/api/state', auth: true },
  { name: 'analytics (bảng điều khiển)', method: 'GET', path: '/api/analytics', auth: true },
  { name: 'admin/live (đồng bộ 3 giây)', method: 'GET', path: '/api/admin/live', auth: true },
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function once(ep) {
  const headers = {};
  if (ep.auth && TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const started = process.hrtime.bigint();
  let ok = false;
  let status = 0;
  let bytes = 0;
  try {
    const res = await fetch(BASE + ep.path, { method: ep.method, headers });
    status = res.status;
    const text = await res.text();
    bytes = Buffer.byteLength(text);
    ok = res.ok;
  } catch {
    ok = false;
  }
  return { ms: Number(process.hrtime.bigint() - started) / 1e6, ok, status, bytes };
}

async function measure(ep) {
  await Promise.all(Array.from({ length: Math.min(CONC, 5) }, () => once(ep)));  // làm nóng

  const samples = [];
  let errors = 0;
  let bytes = 0;
  const wall = process.hrtime.bigint();
  let sent = 0;

  async function worker() {
    while (sent < N) {
      sent += 1;
      const r = await once(ep);
      if (r.ok) { samples.push(r.ms); bytes = r.bytes; } else errors += 1;
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  const elapsed = Number(process.hrtime.bigint() - wall) / 1e9;

  const sorted = [...samples].sort((a, b) => a - b);
  return {
    endpoint: ep.name,
    method: ep.method,
    path: ep.path,
    requests: N,
    concurrency: CONC,
    ok: samples.length,
    errors,
    errorRate: Number((errors / N * 100).toFixed(2)),
    responseBytes: bytes,
    avg: Number((samples.reduce((a, b) => a + b, 0) / (samples.length || 1)).toFixed(1)),
    p50: Number(percentile(sorted, 50).toFixed(1)),
    p95: Number(percentile(sorted, 95).toFixed(1)),
    p99: Number(percentile(sorted, 99).toFixed(1)),
    max: Number((sorted[sorted.length - 1] || 0).toFixed(1)),
    throughput: Number((samples.length / elapsed).toFixed(1)),
  };
}

(async () => {
  const results = [];
  for (const ep of ENDPOINTS) {
    if (ep.auth && !TOKEN) {
      console.log(`  bỏ qua ${ep.name} (cần token)`);
      continue;
    }
    const r = await measure(ep);
    results.push(r);
    const flag = r.ok === 0 ? 'KHÔNG ĐO ĐƯỢC'
      : r.errorRate > 5 ? 'NHIỄU (lỗi cao)'
      : r.p95 < 500 ? 'ĐẠT' : 'KHÔNG ĐẠT';
    console.log(
      `  ${r.endpoint.padEnd(36)} avg ${String(r.avg).padStart(7)}ms  `
      + `p50 ${String(r.p50).padStart(7)}  p95 ${String(r.p95).padStart(8)}  `
      + `p99 ${String(r.p99).padStart(8)}  ${String(r.throughput).padStart(6)} req/s  `
      + `${(r.responseBytes / 1024).toFixed(0).padStart(5)} KB  lỗi ${r.errorRate}%  [${flag}]`,
    );
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    requestsPerEndpoint: N,
    concurrency: CONC,
    note: 'Đo trên máy phát triển, backend và MongoDB Atlas thật. Ngưỡng đối chiếu: p95 < 500 ms.',
    results,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log('\n  → đã ghi', OUT);
})();
