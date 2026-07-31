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
