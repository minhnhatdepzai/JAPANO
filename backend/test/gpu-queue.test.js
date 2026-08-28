const test = require('node:test');
const assert = require('node:assert/strict');
const { GpuJobQueue, GpuJobCancelledError } = require('../lib/gpuJobQueue');
const { FOCUS_PROFILES } = require('../lib/gpuArbiter');

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

test('huỷ không kèm owner vẫn dọn sạch như trước', async () => {
  const queue = new GpuJobQueue();
  const treo = (owner) => queue.run('tryon', ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  }), { owner });

  const a = treo('may-a');
  const b = treo('may-b');
  await new Promise((resolve) => setImmediate(resolve));

  queue.cancel(['tryon'], 'đổi màn hình');
  await assert.rejects(a, (error) => error instanceof GpuJobCancelledError);
  await assert.rejects(b, (error) => error instanceof GpuJobCancelledError);
});

test('job không khai owner vẫn bị huỷ dù lệnh huỷ có owner', async () => {
  const queue = new GpuJobQueue();
  const anDanh = queue.run('tryon', ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  }));
  await new Promise((resolve) => setImmediate(resolve));

  queue.cancel(['tryon'], 'đổi màn hình', 'may-nao-do');
  await assert.rejects(anDanh, (error) => error instanceof GpuJobCancelledError);
});
