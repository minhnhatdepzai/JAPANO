const test = require('node:test');
const assert = require('node:assert/strict');
const register = require('../routes/tryon');

test('motion refuses HTTP-healthy services with missing weights or CUDA before scheduling GPU work', async () => {
  const routes = {};
  const api = { get: (url, fn) => { routes[`GET ${url}`] = fn; }, post: (url, fn) => { routes[`POST ${url}`] = fn; } };
  register(api, {});
  const previous = global.fetch;
  try {
    for (const detail of [{ ok:false, modelReady:false, cudaRuntimeReady:false }, { ok:false, modelReady:true, cudaRuntimeReady:false }, {}]) {
      global.fetch = async () => new Response(JSON.stringify(detail), { status:200 });
      let response;
      const res = { statusCode:200, status(code) { this.statusCode = code; return this; }, json(body) { response = body; return this; } };
      await routes['GET /tryon/motion/presets']({}, res);
      assert.equal(response.ready, false);
      await routes['POST /tryon/motion']({ body:{ imageBase64:'test', motion:'walk_natural' } }, res);
      assert.equal(res.statusCode, 503);
      assert.equal(response.code, 'MOTION_NOT_READY');
    }
    global.fetch = async () => new Response(JSON.stringify({ ok:true, modelReady:true, cudaRuntimeReady:true }), { status:200 });
    await routes['GET /tryon/motion/presets']({}, { json(body) { assert.equal(body.ready, true); } });
  } finally { global.fetch = previous; }
});
