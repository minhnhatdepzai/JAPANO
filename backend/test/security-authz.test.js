// Kiểm thử kiểm soát truy cập ở tầng máy chủ.
//
// Nguyên tắc: ẩn nút trên giao diện KHÔNG phải là phân quyền. Mọi điểm cuối
// thay đổi dữ liệu hoặc để lộ dữ liệu cá nhân đều phải tự từ chối khi người gọi
// không có vai trò phù hợp, kể cả khi gọi thẳng bằng curl.
//
// Chạy: node --test backend/test/security-authz.test.js
//
// Bộ kiểm thử tự dựng máy chủ riêng trên một cổng trống và một tệp dữ liệu tạm,
// nên không cần khởi động backend trước và không đụng vào dữ liệu thật. Đặt
// JAPANO_TEST_BASE nếu muốn trỏ vào một máy chủ đang chạy sẵn.
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const EXTERNAL = process.env.JAPANO_TEST_BASE || '';
let BASE = EXTERNAL;
let child = null;
let tmpDir = '';

/** Xin hệ điều hành một cổng trống để hai lần chạy song song không tranh nhau. */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Đợi máy chủ trả lời, tối đa `timeoutMs`. */
async function waitReady(base, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`Máy chủ kiểm thử thoát sớm với mã ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch { /* chưa mở cổng, thử lại */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Máy chủ kiểm thử không sẵn sàng trong thời gian chờ');
}

test.before(async () => {
  if (EXTERNAL) return;
  const port = await freePort();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'japano-authz-'));
  BASE = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(port),
      // Tệp dữ liệu tạm: máy chủ sẽ tự gieo dữ liệu mẫu vào đây.
      JAPANO_DATA_FILE: path.join(tmpDir, 'db.json'),
      // Ép dùng store dạng tệp, không chạm vào MongoDB thật.
      MONGODB_URI: '',
      MONGODB_DB: '',
      // Giới hạn tần suất mặc định sẽ chặn nhầm loạt yêu cầu dồn dập của bộ test.
      JAPANO_RATE_LIMIT_MAX: '100000',
      NODE_ENV: 'test',
    },
  });
  await waitReady(BASE);
});

test.after(() => {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function call(method, path, { body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* phản hồi không phải JSON */ }
  return { status: res.status, json };
}

/** Điểm cuối phải từ chối người gọi ẩn danh bằng 401 hoặc 403. */
function assertDenied(result, label) {
  assert.ok(
    result.status === 401 || result.status === 403,
    `${label}: phải trả 401/403 cho người gọi ẩn danh, thực tế trả ${result.status}`,
  );
}

test('GET /reviews/admin — không cho ẩn danh đọc toàn bộ đánh giá', async () => {
  assertDenied(await call('GET', '/reviews/admin'), 'GET /reviews/admin');
});

test('PATCH /reviews/:id/moderation — không cho ẩn danh kiểm duyệt', async () => {
  const r = await call('PATCH', '/reviews/khong-ton-tai/moderation', { body: { status: 'approved' } });
  assertDenied(r, 'PATCH /reviews/:id/moderation');
});

test('POST /flagcards/admin/grant — không cho ẩn danh tự cấp thẻ thưởng', async () => {
  const r = await call('POST', '/flagcards/admin/grant', { body: { userId: 'u1', cardId: 'x' } });
  assertDenied(r, 'POST /flagcards/admin/grant');
});

test('GET /payments/:id — không để lộ đơn hàng và thông tin cá nhân cho ẩn danh', async () => {
  const r = await call('GET', '/payments/PAY-JP240784');
  assertDenied(r, 'GET /payments/:id');
});

test('GET /japan-spots/admin — không cho ẩn danh đọc hàng chờ kiểm duyệt', async () => {
  assertDenied(await call('GET', '/japan-spots/admin'), 'GET /japan-spots/admin');
});

test('POST /stripe/reconcile — không cho ẩn danh kích hoạt đối soát', async () => {
  assertDenied(await call('POST', '/stripe/reconcile'), 'POST /stripe/reconcile');
});

test('POST /vnpay/reconcile — không cho ẩn danh kích hoạt đối soát', async () => {
  assertDenied(await call('POST', '/vnpay/reconcile'), 'POST /vnpay/reconcile');
});

test('GET /state — không cho ẩn danh đọc toàn bộ cơ sở dữ liệu', async () => {
  assertDenied(await call('GET', '/state'), 'GET /state');
});

test('GET /orders — không cho ẩn danh đọc đơn hàng', async () => {
  const r = await call('GET', '/orders');
  assert.strictEqual(r.status, 401, `GET /orders phải trả 401, thực tế ${r.status}`);
});

test('Các điểm cuối công khai vẫn phải mở cho khách chưa đăng nhập', async () => {
  for (const path of ['/health', '/products', '/shop', '/locations/provinces']) {
    const r = await call('GET', path);
    assert.strictEqual(r.status, 200, `${path} phải mở công khai, thực tế ${r.status}`);
  }
});
