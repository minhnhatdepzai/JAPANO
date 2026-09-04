const test = require('node:test');
const assert = require('node:assert/strict');
const { GpuJobQueue, GpuJobCancelledError } = require('../lib/gpuJobQueue');
const { FOCUS_PROFILES, focusRestorePlan } = require('../lib/gpuArbiter');

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('GPU queue chỉ chạy một job và ưu tiên motion, try-on, vision rồi recommendation', async () => {
  const queue = new GpuJobQueue();
  const gate = deferred();
  const order = [];

  const active = queue.run('tryon', async () => {
    order.push('active-tryon');
    await gate.promise;
  });
  await new Promise((resolve) => setImmediate(resolve));

  const recommendation = queue.run('recommendation', async () => { order.push('recommendation'); });
  const vision = queue.run('vision', async () => { order.push('vision'); });
  const nextTryon = queue.run('tryon', async () => { order.push('next-tryon'); });
  const motion = queue.run('motion', async () => { order.push('motion'); });

  assert.equal(queue.status().active.type, 'tryon');
  assert.deepEqual(queue.status().pending.map((item) => item.type), ['motion', 'tryon', 'vision', 'recommendation']);

  gate.resolve();
  await Promise.all([active, recommendation, vision, nextTryon, motion]);
  assert.deepEqual(order, ['active-tryon', 'motion', 'next-tryon', 'vision', 'recommendation']);
});

test('đổi focus hủy cả job đang chạy và các job cùng loại đang chờ', async () => {
  const queue = new GpuJobQueue();
  const active = queue.run('motion', ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  await new Promise((resolve) => setImmediate(resolve));
  const pending = queue.run('motion', async () => 'không được chạy');

  const cancelled = queue.cancel('motion', 'rời màn thử đồ');
  assert.equal(cancelled.length, 2);
  await assert.rejects(active, (error) => error instanceof GpuJobCancelledError);
  await assert.rejects(pending, (error) => error instanceof GpuJobCancelledError);
  assert.equal(queue.status().pending.length, 0);
});

test('try-on và motion độc quyền GPU; vision và suggestion chỉ dùng GPU khi hai job này nghỉ', () => {
  assert.deepEqual(FOCUS_PROFILES.tryon.keep, ['fashn']);
  assert.equal(FOCUS_PROFILES.tryon.embeddingDevice, 'off');
  assert.deepEqual(FOCUS_PROFILES.motion.keep, ['motion']);
  assert.equal(FOCUS_PROFILES.motion.embeddingDevice, 'off');
  assert.deepEqual(FOCUS_PROFILES.vision.keep, ['ollama']);
  assert.equal(FOCUS_PROFILES.vision.embeddingDevice, 'off');
  assert.deepEqual(FOCUS_PROFILES.browse.keep, ['embedding']);
  assert.equal(FOCUS_PROFILES.browse.embeddingDevice, 'cuda');
});

test('try-on trả ảnh trước rồi mới làm nóng lại FASHN khi focus không đổi', () => {
  assert.deepEqual(focusRestorePlan('tryon', 'tryon'), {
    restoreSynchronously: false,
    deferFashnWarmup: true,
  });
  assert.deepEqual(focusRestorePlan('tryon', 'browse'), {
    restoreSynchronously: true,
    deferFashnWarmup: false,
  });
  assert.deepEqual(focusRestorePlan('motion', 'motion'), {
    restoreSynchronously: false,
    deferFashnWarmup: false,
  });
});

// --- Huỷ theo chủ sở hữu -----------------------------------------------------
// GPU chỉ có một, nên rời màn hình thử đồ thì hàng chờ dọn tác vụ đang chạy.
// Nhưng khi nhiều máy cùng kết nối (điện thoại cắm USB để test, máy khác demo
// qua Tailscale), việc dọn đó phải giới hạn trong tác vụ CỦA CHÍNH máy vừa đổi
// màn hình — nếu không, người này thoát màn hình là lượt thử đồ của người kia
// chết theo. Lỗi này đã bắt được khi test thật, nên khoá lại bằng test.

test('huỷ theo owner: chỉ cắt job của đúng máy vừa đổi màn hình', async () => {
  const queue = new GpuJobQueue();
  const dangChay = [];

  const job = (owner) => queue.run('tryon', async ({ signal }) => {
    dangChay.push(owner);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 50);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); });
    });
    return owner;
  }, { owner });

  const dienThoai = job('may-usb');
  const mayDemo = job('may-demo');
  await new Promise((resolve) => setImmediate(resolve));

  queue.cancel(['tryon'], 'người dùng rời màn hình', 'may-demo');

  await assert.rejects(mayDemo, (error) => error instanceof GpuJobCancelledError);
  assert.equal(await dienThoai, 'may-usb', 'máy không đổi màn hình phải chạy xong');
});

// Huỷ job GPU phải bám ĐÚNG danh tính máy đã yêu cầu.
//
// Hai bài dưới đây thay cho hợp đồng cũ (huỷ không kèm owner thì dọn sạch, và
// job ẩn danh bị bất kỳ ai huỷ). Hợp đồng đó đã làm chết một lượt thử đồ thật:
// app trên điện thoại mở màn hình chủ, gửi focus="home", và cắt ngang lượt
// /api/tryon đang chạy dở của một client khác — backend trả 503 dù FASHN đã
// sinh xong ảnh.
test('đổi màn hình của máy này KHÔNG huỷ job của máy khác', async () => {
  const queue = new GpuJobQueue();
  const treo = (owner) => queue.run('tryon', ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  }), { owner });

  const cuaA = treo('may-a');
  treo('may-b');
  await new Promise((resolve) => setImmediate(resolve));

  const cancelled = queue.cancel(['tryon'], 'đổi màn hình', 'may-a');
  await assert.rejects(cuaA, (error) => error instanceof GpuJobCancelledError);
  assert.equal(cancelled.length, 1, 'chỉ được huỷ đúng job của may-a');
});

test('job ẩn danh KHÔNG bị máy có danh tính huỷ', async () => {
  const queue = new GpuJobQueue();
  const anDanh = queue.run('tryon', ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  }));
  await new Promise((resolve) => setImmediate(resolve));

  const cancelled = queue.cancel(['tryon'], 'đổi màn hình', 'may-nao-do');
  assert.equal(cancelled.length, 0, 'job không thuộc máy đó thì không được đụng vào');
  queue.cancel(['tryon'], 'dọn dẹp');
  await assert.rejects(anDanh, (error) => error instanceof GpuJobCancelledError);
});

test('huỷ ẩn danh vẫn dọn được job ẩn danh — script nội bộ tự dọn của mình', async () => {
  const queue = new GpuJobQueue();
  const anDanh = queue.run('tryon', ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  }));
  await new Promise((resolve) => setImmediate(resolve));
  queue.cancel(['tryon'], 'dọn dẹp');
  await assert.rejects(anDanh, (error) => error instanceof GpuJobCancelledError);
});
