import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const apiPort = process.env.PORT || '4100';
const base = String(process.env.JAPANO_API_URL || `http://127.0.0.1:${apiPort}`).replace(/\/$/, '');
const withAi = process.argv.includes('--ai');
const allowSeed = process.argv.includes('--seed');

async function request(route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { text }; }
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status} ${data.message || text}`);
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const health = await request('/api/health');
  assert(health.ok, 'Health endpoint không trả ok=true');

  let state = await request('/api/state');
  if (allowSeed && (!Array.isArray(state.products) || state.products.length === 0)) {
    state = await request('/api/seed', { method: 'POST' });
  }
  assert(Array.isArray(state.products), 'State thiếu products');

  const analytics = await request('/api/analytics');
  assert(analytics.ok !== false, 'Analytics trả ok=false');
  assert(analytics.revenueForecast || analytics.analytics?.revenueForecast, 'Analytics thiếu revenueForecast');

  await request('/api/interactions', {
    method: 'POST',
    body: JSON.stringify({ userId: 'verify-user', productId: 'haori-dang-dai', type: 'wishlist', value: 1 }),
  });
  const recommendations = await request('/api/recommendations/home?userId=verify-user&limit=6');
  const recommendationItems = recommendations.items || recommendations.products || recommendations.recommendations || [];
  assert(Array.isArray(recommendationItems), 'Recommendations không trả danh sách');

  const profile = { style: 'toi-gian', preferredStyles: ['Tối giản'], occasion: 'Đi làm', budget: 1500000 };
  await request('/api/stylist/profile/verify-user', { method: 'POST', body: JSON.stringify(profile) });
  const stylist = await request('/api/stylist/recommend', {
    method: 'POST',
    body: JSON.stringify({ userId: 'verify-user', profile }),
  });
  assert(Array.isArray(stylist.items || stylist.products || stylist.recommendations), 'Stylist thiếu danh sách sản phẩm');

  const size = await request('/api/stylist/size', {
    method: 'POST',
    body: JSON.stringify({ productId: 'haori-dang-dai', height: 165, weight: 54, bust: 86, waist: 70, hip: 92 }),
  });
  assert(size.size || size.recommendedSize, 'Size advisor thiếu size');

  const chat = await request('/api/stylist/chat', {
    method: 'POST',
    body: JSON.stringify({ userId: 'verify-user', message: 'Gợi ý đồ tối giản để đi làm', profile }),
  });
  assert(chat.reply || chat.message, 'Stylist chat thiếu câu trả lời');

  if (withAi) {
    const imagePath = path.join(root, 'mobile/assets/products/haori-dang-dai_1.jpg');
    const image = await fs.readFile(imagePath);
    const personImageBase64 = `data:image/jpeg;base64,${image.toString('base64')}`;
    const tryon = await request('/api/tryon', {
      method: 'POST',
      body: JSON.stringify({ userId: 'verify-user', productId: 'haori-dang-dai', personImageBase64 }),
    });
    assert(tryon.imageBase64 || tryon.finalImageBase64, 'Try-on thiếu ảnh kết quả');

    const vision = await request('/api/products/haori-dang-dai/ai-description?refresh=1');
    assert(vision.headline && vision.visualSummary, 'AI vision thiếu mô tả sản phẩm');

    const goal = await request('/api/goals/plan', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'verify-user', productId: 'haori-dang-dai', age: 25, heightCm: 165,
        currentWeightKg: 65, targetWeightKg: 60, monthlyIncome: 15000000,
        fixedExpenses: 11000000, currentSavings: 200000, targetMonths: 6,
      }),
    });
    assert(goal.goal?.plan?.saving && goal.goal?.plan?.wellness, 'Mục tiêu thiếu lộ trình');
  }

  console.log(JSON.stringify({
    ok: true,
    api: base,
    products: state.products.length,
    recommendations: recommendationItems.length,
    aiChecked: withAi,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
