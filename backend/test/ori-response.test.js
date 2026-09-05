const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { fetchChatJson } = require('../lib/chatHttp');
const registerStylistRoutes = require('../routes/stylist');

function harness(overrides = {}) {
  const routes = new Map();
  const api = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers.at(-1))]));
  const state = { profiles: [], products: [], chats: [], interactions: [] };
  const draft = { message: 'Ori có thể giúp bạn chọn trang phục. Bạn muốn mặc đi đâu?', intent: 'fallback', productIds: [], actions: [], modelTrace: { ruleIntent: 'fallback' } };
  registerStylistRoutes(api, {
    read: () => structuredClone(state), update: mutate => mutate(state),
    requireSelfOrStaff: () => () => {}, tryonGpuBusy: () => false,
    chatbot: { reply: () => draft }, ...overrides,
  });
  return async (body = { message: 'Giúp mình với', userId: 'guest' }) => {
    let status = 200, payload;
    await routes.get('post /stylist/chat')({ body }, { status(value) { status = value; return this; }, json(value) { payload = value; } });
    return { status, payload, state, draft };
  };
}

function enableChat(t, budget = '120') {
  const keys = ['JAPANO_OLLAMA_CHAT', 'JAPANO_CHAT_BUDGET_MS', 'JAPANO_OLLAMA_TIMEOUT_MS'];
  const saved = keys.map(key => process.env[key]);
  Object.assign(process.env, { JAPANO_OLLAMA_CHAT: '1', JAPANO_CHAT_BUDGET_MS: budget, JAPANO_OLLAMA_TIMEOUT_MS: '45000' });
  t.after(() => keys.forEach((key, i) => saved[i] === undefined ? delete process.env[key] : process.env[key] = saved[i]));
}

// Actual sockets: headers arrive, JSON never finishes. Aborting must also
// close the body, not just the already-resolved fetch promise.
test('Ori JSON deadline includes a stalled body after headers', async t => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"response":');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const started = Date.now();
  await assert.rejects(fetchChatJson(`http://127.0.0.1:${server.address().port}`, {}, 80), { name: 'AbortError' });
  assert.ok(Date.now() - started < 1000);
});

test('Ori returns the grounded answer when planner times out; does not spend a second budget', async t => {
  enableChat(t);
  let calls = 0, aborted = 0;
  t.mock.method(global, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => { aborted++; reject(new DOMException('aborted', 'AbortError')); }, { once: true });
  }));
  const started = Date.now();
  const { status, payload, draft } = await harness()();
  assert.equal(status, 200);
  assert.equal(payload.message, draft.message);
  assert.equal(payload.historySaved, true);
  assert.ok(calls >= 1 && calls <= 2);
  assert.equal(aborted, calls);
  assert.ok(Date.now() - started < 1000);
});

test('Ori bounds rewrite when planner succeeds but generation stalls', async t => {
  enableChat(t, '160');
  let calls = 0;
  t.mock.method(global, 'fetch', async (_url, { signal }) => {
    calls++;
    if (calls === 1) return Response.json({ message: { content: JSON.stringify({ intent: 'fallback', actionId: 'none', confidence: 0.9 }) } });
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
  });
  const { payload, draft } = await harness()();
  assert.equal(payload.message, draft.message);
  assert.equal(payload.fallbackReason, 'ollama-timeout');
  assert.equal(calls, 2);
  assert.ok(payload.responseLatencyMs < 1000);
});

test('Ori keeps navigation immediate while GPU is busy', async t => {
  enableChat(t);
  const fetchMock = t.mock.method(global, 'fetch', () => { throw new Error('must not call Ollama'); });
  const action = { id: 'open_cart', label: 'Mở giỏ hàng', auto: true };
  const { payload } = await harness({ tryonGpuBusy: () => true, chatbot: { reply: () => ({ message: 'Mở giỏ hàng', intent: 'navigation', actions: [action], productIds: [] }) } })();
  assert.deepEqual(payload.actions, [action]);
  assert.equal(payload.generationModel, 'whitelisted-action-router');
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('Ori returns its answer even if saving chat history fails', async t => {
  enableChat(t);
  const { status, payload, draft } = await harness({ tryonGpuBusy: () => true, update: () => { throw new Error('test history write failure'); } })();
  assert.equal(status, 200);
  assert.equal(payload.message, draft.message);
  assert.equal(payload.historySaved, false);
});

test('Ori responds with JSON instead of leaving an async route hanging on error', async t => {
  enableChat(t);
  const { status, payload } = await harness({ chatbot: { reply: () => { throw new Error('test retrieval failure'); } } })();
  assert.equal(status, 503);
  assert.equal(payload.code, 'CHAT_UNAVAILABLE');
  assert.ok(payload.message.trim());
});

test('Ori rejects empty input without calling the model', async t => {
  enableChat(t);
  const { status, payload } = await harness()({ message: '   ' });
  assert.equal(status, 400);
  assert.equal(payload.code, 'CHAT_MESSAGE_REQUIRED');
});
