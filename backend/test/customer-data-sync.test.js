const test = require('node:test');
const assert = require('node:assert/strict');

const registerCustomerDataRoutes = require('../routes/customerData');

function harness(initial) {
  let state = structuredClone(initial);
  const routes = new Map();
  const api = {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); },
  };
  registerCustomerDataRoutes(api, {
    read: () => state,
    update: (mutate) => { state = mutate(state); },
    httpError: (status, message) => Object.assign(new Error(message), { status }),
    pushNotification: () => undefined,
    sendPushToUser: async () => undefined,
    requireSelfOrStaff: () => (_req, _res, next) => next(),
  });
  const call = async (method, path, req) => {
    const handlers = routes.get(`${method} ${path}`);
    assert.ok(handlers, `thiếu route ${method} ${path}`);
    let payload;
    let status = 200;
    const res = {
      status(code) { status = code; return this; },
      json(value) { payload = value; return this; },
    };
    for (const handler of handlers) {
      let nextCalled = false;
      await handler(req, res, () => { nextCalled = true; });
      if (handler !== handlers.at(-1) && !nextCalled) break;
    }
    return { status, payload };
  };
  return { call, state: () => state };
}

test('GET /carts trả đúng giỏ backend để thiết bị khác khôi phục', async () => {
  const app = harness({
    products: [], interactions: [], searchLogs: [], wishlists: [],
    carts: [
      { userId: 'u1', productId: 'ao-1', color: 'Đỏ', size: 'M', quantity: 2, updatedAt: 10 },
      { userId: 'u2', productId: 'ao-2', color: 'Đen', size: 'L', quantity: 5, updatedAt: 20 },
    ],
  });
  const response = await app.call('GET', '/carts', { query: { userId: 'u1' } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.payload.cart.map((row) => row.productId), ['ao-1']);
});

test('wishlist merge giữ dữ liệu từ app và thêm dữ liệu khách trên web', async () => {
  const app = harness({
    products: [{ id: 'p1', slug: 'ao-app' }, { id: 'p2', slug: 'ao-web' }],
    interactions: [], searchLogs: [], carts: [],
    wishlists: [{ id: 'w1', userId: 'u1', productSlug: 'ao-app', createdAt: 1 }],
  });
  const response = await app.call('POST', '/wishlist/sync', {
    body: { userId: 'u1', merge: true, slugs: ['ao-web'] },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(new Set(response.payload.wishlist), new Set(['ao-app', 'ao-web']));
  assert.equal(app.state().wishlists.filter((row) => row.userId === 'u1').length, 2);
});
