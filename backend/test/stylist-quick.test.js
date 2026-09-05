const test = require('node:test');
const assert = require('node:assert/strict');

const registerStylistRoutes = require('../routes/stylist');

test('Ống kính quick trả gợi ý catalog mà không chờ vision chân dung', async () => {
  const routes = new Map();
  const api = {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); },
    put(path, ...handlers) { routes.set(`PUT ${path}`, handlers); },
    delete(path, ...handlers) { routes.set(`DELETE ${path}`, handlers); },
  };
  let portraitCalls = 0;
  registerStylistRoutes(api, {
    read: () => ({ profiles: [], products: [] }),
    update: (mutate) => mutate({ profiles: [], products: [] }),
    tryonGpuBusy: () => false,
    httpError: (status, message) => Object.assign(new Error(message), { status }),
    requireAuth: (_req, _res, next) => next(),
    requireSelfOrStaff: () => (_req, _res, next) => next(),
    roleAtLeast: () => false,
    sendPushToUser: async () => undefined,
    runPillow: async () => ({ ok: true, hex: '#243244' }),
    analyzePortrait: async () => { portraitCalls += 1; return { mood: 'vui' }; },
    styleRecommendation: () => ({ summary: 'Gợi ý nhanh', tags: ['tối giản'], products: [], accessories: [], reasons: {} }),
  });
  const handler = routes.get('POST /stylist/recommend').at(-1);
  let payload;
  await handler({ body: { userId: 'u1', imageBase64: 'data:image/jpeg;base64,AA==', quick: true } }, { json(value) { payload = value; } });
  assert.equal(portraitCalls, 0);
  assert.equal(payload.portraitPending, true);
  assert.equal(payload.summary, 'Gợi ý nhanh');
});
