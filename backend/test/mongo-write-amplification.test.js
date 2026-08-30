const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeState, persistStateToCollections, forgetPersistedDigests,
} = require('../lib/mongoCollections');
const { seededState } = require('../seed');

// Khuếch đại ghi.
//
// `write()` trong store.js đẩy TOÀN BỘ state xuống Mongo. Đo trên dữ liệu demo:
// thêm đúng một món vào giỏ ghi lại 34 collection / 2.073 document / 68 lệnh.
// Phần lớn số đó không hề thay đổi.
//
// `skipUnchanged` so vân tay nội dung từng collection với lần ghi trước và chỉ
// gửi collection thật sự khác. Các bài dưới đây khoá đúng tính chất đó, đặc biệt
// là hai tính chất AN TOÀN: lần đầu phải ghi đủ, và lỗi ghi không được để lại
// vân tay khiến lần sau bỏ qua nhầm.

function recordingDb(name = 'test-db') {
  const written = [];
  return {
    written,
    db: {
      databaseName: name,
      collection: (collectionName) => ({
        async bulkWrite(ops) { written.push([collectionName, ops.length]); return {}; },
        async deleteMany() { written.push([collectionName, 0]); return {}; },
      }),
    },
    collections: () => new Set(written.map((row) => row[0])),
  };
}

function baseState() {
  return normalizeState(seededState());
}

test('lần persist đầu tiên phải ghi ĐỦ mọi collection', async () => {
  forgetPersistedDigests();
  const sink = recordingDb('first-write');
  await persistStateToCollections(sink.db, baseState(), { skipUnchanged: true });
  assert.ok(sink.collections().size > 10, 'khởi động nguội không được bỏ sót collection');
});

test('state không đổi thì không gửi lệnh nào xuống Mongo', async () => {
  forgetPersistedDigests();
  const state = baseState();
  const first = recordingDb('no-change');
  await persistStateToCollections(first.db, state, { skipUnchanged: true });
  const second = recordingDb('no-change');
  await persistStateToCollections(second.db, state, { skipUnchanged: true });
  assert.equal(second.written.length, 0);
});

test('thêm một món vào giỏ chỉ ghi cart_items, không ghi lại cả database', async () => {
  forgetPersistedDigests();
  const state = baseState();
  const warm = recordingDb('cart');
  await persistStateToCollections(warm.db, state, { skipUnchanged: true });
  const before = warm.collections().size;

  const changed = structuredClone(state);
  changed.carts.push({
    id: 'cart-test-amplification',
    userId: changed.users[0].id,
    productId: changed.products[0].id,
    color: 'Sumi', size: 'L', quantity: 1, updatedAt: Date.now(),
  });
  const sink = recordingDb('cart');
  await persistStateToCollections(sink.db, changed, { skipUnchanged: true });

  assert.deepEqual([...sink.collections()], ['cart_items']);
  assert.ok(before > 10 && sink.collections().size === 1,
    `phải giảm từ ${before} collection xuống đúng 1`);
});

test('đổi collection này không kéo theo collection khác', async () => {
  forgetPersistedDigests();
  const state = baseState();
  const warm = recordingDb('isolated');
  await persistStateToCollections(warm.db, state, { skipUnchanged: true });

  const changed = structuredClone(state);
  changed.interactions.push({
    id: 'ix-test-amplification', userId: changed.users[0].id,
    productId: changed.products[0].id, type: 'view', value: 1, createdAt: Date.now(),
  });
  const sink = recordingDb('isolated');
  await persistStateToCollections(sink.db, changed, { skipUnchanged: true });
  assert.deepEqual([...sink.collections()], ['interactions']);
});

test('mỗi database giữ vân tay riêng, không lẫn sang nhau', async () => {
  forgetPersistedDigests();
  const state = baseState();
  const a = recordingDb('db-a');
  await persistStateToCollections(a.db, state, { skipUnchanged: true });
  // Database khác chưa từng được ghi -> phải ghi đủ, không được ăn theo vân tay của db-a.
  const b = recordingDb('db-b');
  await persistStateToCollections(b.db, state, { skipUnchanged: true });
  assert.ok(b.collections().size > 10);
});

test('ghi lỗi thì KHÔNG lưu vân tay, lần sau phải thử lại collection đó', async () => {
  forgetPersistedDigests();
  const state = baseState();
  const failing = {
    databaseName: 'flaky',
    collection: () => ({
      async bulkWrite() { throw new Error('mạng chập'); },
      async deleteMany() { throw new Error('mạng chập'); },
    }),
  };
  await assert.rejects(() => persistStateToCollections(failing, state, { skipUnchanged: true }));

  const retry = recordingDb('flaky');
  await persistStateToCollections(retry.db, state, { skipUnchanged: true });
  assert.ok(retry.collections().size > 10, 'sau khi lỗi phải ghi lại đầy đủ');
});

test('forgetPersistedDigests buộc ghi lại toàn bộ', async () => {
  forgetPersistedDigests();
  const state = baseState();
  const first = recordingDb('forget');
  await persistStateToCollections(first.db, state, { skipUnchanged: true });
  forgetPersistedDigests();
  const second = recordingDb('forget');
  await persistStateToCollections(second.db, state, { skipUnchanged: true });
  assert.ok(second.collections().size > 10);
});

test('mặc định (không bật skipUnchanged) vẫn ghi đủ — script migration không đổi hành vi', async () => {
  forgetPersistedDigests();
  const state = baseState();
  const a = recordingDb('default');
  await persistStateToCollections(a.db, state);
  const b = recordingDb('default');
  await persistStateToCollections(b.db, state);
  assert.equal(a.collections().size, b.collections().size);
  assert.ok(b.collections().size > 10);
});
