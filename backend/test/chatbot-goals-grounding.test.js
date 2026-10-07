const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const chatbot = require('../lib/chatbot');
const { buildGoalPlan, buildWellnessPlan } = require('../lib/goals');
const { groundedRewriteOrDraft } = require('../routes/stylist');

const state = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'db.json'), 'utf8'));
const liveIds = new Set((state.products || []).map((product) => String(product.slug || product.id)));

test('câu hỏi quần áo chung được trả bằng catalog thay vì từ chối', () => {
  const result = chatbot.reply(state, { userId:'eval-chat', message:'shop có quần áo gì vậy?' });
  assert.equal(result.intent, 'shopping');
  assert.ok(result.productIds.length > 0);
  assert.doesNotMatch(result.message, /không.*trả lời|không đủ dữ kiện/i);
  result.productIds.forEach((id) => assert.ok(liveIds.has(String(id))));
});

test('câu không dấu theo dịp và ngân sách vẫn truy hồi sản phẩm thật', () => {
  const result = chatbot.reply(state, {
    userId:'eval-chat',
    message:'toi muon mua do mau xanh di le hoi duoi 2 trieu',
  });
  assert.equal(result.intent, 'shopping');
  assert.ok(result.productIds.length > 0);
  const selected = state.products.filter((product) => result.productIds.includes(product.slug));
  assert.ok(selected.every((product) => Number(product.price) <= 2_000_000));
});

test('hỏi size sản phẩm trả size còn hàng chứ không đoán chung M-L', () => {
  const result = chatbot.reply(state, { userId:'eval-chat', message:'Yukata xanh còn size gì?' });
  assert.equal(result.intent, 'size');
  assert.match(result.message, /Yukata vải bông xanh đen/);
  assert.match(result.message, /đang còn/);
  assert.doesNotMatch(result.message, /thường quanh M–L/);
});

test('hỏi tổng catalog trả số đếm và tồn kho đúng từ database', () => {
  const result = chatbot.reply(state, { userId:'eval-chat', message:'Shop có bao nhiêu sản phẩm và còn tổng bao nhiêu hàng?' });
  const published = state.products.filter((product) => ['published', 'active'].includes(String(product.status || 'published')));
  const units = published.reduce((total, product) => total + (product.variants || [])
    .reduce((sum, variant) => sum + Math.max(0, Math.floor(Number(variant.stock) || 0)), 0), 0);
  assert.equal(result.intent, 'inventory');
  assert.match(result.message, new RegExp(`${published.length} sản phẩm đang công khai`));
  assert.match(result.message, new RegExp(`${units.toLocaleString('vi-VN')} sản phẩm`));
  assert.deepEqual(result.productIds, []);
});

test('hỏi tồn theo sản phẩm và size trả đúng tổng từng biến thể', () => {
  const product = state.products.find((item) => item.slug === 'yukata-xanh');
  const expected = product.variants.filter((variant) => variant.size === 'M')
    .reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
  const result = chatbot.reply(state, { userId:'eval-chat', message:'Yukata vải bông xanh đen còn size M bao nhiêu?' });
  assert.equal(result.intent, 'inventory');
  assert.deepEqual(result.productIds, ['yukata-xanh']);
  assert.match(result.message, new RegExp(`còn ${expected.toLocaleString('vi-VN')} sản phẩm \\(size M\\)`));
  assert.match(result.message, /Sumi: \d+/);
  assert.doesNotMatch(result.message, /Yukata là áo choàng/);
});

test('hỏi sản phẩm hết hàng và không tồn tại không được bịa gợi ý thay thế', () => {
  const soldOut = state.products.find((product) => product.status === 'published'
    && product.variants?.length && product.variants.every((variant) => Number(variant.stock) <= 0));
  assert.ok(soldOut);
  const empty = chatbot.reply(state, { userId:'eval-chat', message:`${soldOut.name} còn hàng không?` });
  assert.equal(empty.intent, 'inventory');
  assert.match(empty.message, /hết hàng \(0 sản phẩm\)/);
  assert.deepEqual(empty.productIds, []);

  const unknown = chatbot.reply(state, { userId:'eval-chat', message:'iPhone còn hàng không?' });
  assert.equal(unknown.intent, 'inventory');
  assert.match(unknown.message, /không tìm thấy.*catalog công khai/i);
  assert.deepEqual(unknown.productIds, []);
});

test('câu nối tiếp dùng productIds trong lịch sử để trả đúng giá', () => {
  const result = chatbot.reply(state, {
    userId:'eval-chat', message:'cái đó giá bao nhiêu?',
    history:[{ role:'assistant', message:'Mình tìm được Yukata.', productIds:['yukata-xanh'] }],
  });
  assert.equal(result.intent, 'price');
  assert.deepEqual(result.productIds, ['yukata-xanh']);
  assert.match(result.message, /1\.290\.000₫/);
});

test('Ollama từ chối hoặc làm rơi dữ kiện thì giữ bản grounded', () => {
  const draft = 'Yukata vải bông xanh đen: 1.290.000₫';
  assert.equal(groundedRewriteOrDraft('Xin lỗi, tôi không thể trả lời.', draft).message, draft);
  assert.equal(groundedRewriteOrDraft('Mẫu Yukata này rất đẹp.', draft).message, draft);
  assert.equal(groundedRewriteOrDraft('Yukata vải bông xanh đen giá 1.290.000₫.', draft).accepted, true);
  assert.equal(groundedRewriteOrDraft('Yukata vải bông xanh đen giá 1.590.000₫.', draft).reason, 'ollama-invented-money');
  assert.equal(groundedRewriteOrDraft('Mẫu này giá 1.290.000₫.', draft, ['Yukata vải bông xanh đen']).reason, 'ollama-dropped-catalog-products');
});

test('lệnh mở mua sắm trả action điều hướng có kiểm soát', () => {
  const result = chatbot.reply(state, { userId:'eval-chat', message:'Mở trang mua sắm cho tôi' });
  assert.equal(result.intent, 'navigation');
  assert.deepEqual(result.actions, [{ id:'open_shop', label:'Mở trang mua sắm', auto:true }]);
  assert.match(result.message, /mở trang mua sắm/i);
});

test('lệnh tới thanh toán trả đúng action checkout thay vì gợi ý sản phẩm', () => {
  const result = chatbot.reply(state, { userId:'eval-chat', message:'Đi tới trang thanh toán giúp tôi' });
  assert.equal(result.intent, 'navigation');
  assert.deepEqual(result.actions, [{ id:'open_checkout', label:'Tới trang thanh toán', auto:true }]);
  assert.deepEqual(result.productIds, []);
});

test('cách nói tính tiền và xem đơn đã mua không bị semantic catalog bắt nhầm', () => {
  const checkout = chatbot.reply(state, { userId:'eval-chat', message:'Tính tiền giúp tôi đi' });
  assert.equal(checkout.intent, 'navigation');
  assert.equal(checkout.actions[0].id, 'open_checkout');
  const orders = chatbot.reply(state, { userId:'eval-chat', message:'Tôi muốn xem các đơn đã mua' });
  assert.equal(orders.intent, 'navigation');
  assert.equal(orders.actions[0].id, 'open_orders');
});

test('hỏi địa điểm đẹp trả địa điểm từ catalog phong cảnh và nút Khám phá Nhật Bản', () => {
  const result = chatbot.reply(state, { userId:'eval-chat', message:'Ở Nhật có địa điểm nào đẹp để chụp ảnh?' });
  assert.equal(result.intent, 'travel');
  assert.match(result.message, /Kyoto|Tokyo|Yamanashi|Nara|Kagawa/);
  assert.ok(result.message.split('\n').length >= 4);
  assert.deepEqual(result.actions, [{ id:'open_explore_japan', label:'Mở Khám phá Nhật Bản', auto:false }]);
});

test('trời mưa ưu tiên đồ che mưa và không trả Jinbei mùa hè', () => {
  const result = chatbot.reply(state, { userId:'eval-chat', message:'Trời mưa mà, mưa mưa mặc gì?' });
  assert.equal(result.intent, 'weather_outfit');
  assert.ok(result.productIds.includes('du-nhat'));
  assert.ok(!result.productIds.includes('jinbei-mua-he'));
  assert.match(result.message, /mưa|chống ướt|áo khoác/i);
});

test('phối đồ có ngân sách không tạo tổng vượt giới hạn', () => {
  const result = chatbot.reply(state, { userId:'eval-chat', message:'Phối đồ đi làm dưới 2 triệu' });
  assert.equal(result.intent, 'outfit');
  const selected = state.products.filter((product) => result.productIds.includes(product.slug));
  assert.ok(selected.length > 0);
  assert.ok(selected.reduce((sum, product) => sum + Number(product.price || 0), 0) <= 2_000_000);
  assert.match(result.message, /2\.000\.000₫/);
});

test('coaching sức khỏe chỉ nói đúng mục tiêu sức khỏe, không chèn mua áo hay tiết kiệm', () => {
  const product = { slug:'yukata-xanh', name:'Yukata vải bông xanh đen', price:1_290_000 };
  const plan = buildGoalPlan({
    goalType:'health', healthGoal:'move-more', activityLevel:'low',
    age:30, heightCm:165, currentWeightKg:65, targetWeightKg:62,
  }, product);
  const text = JSON.stringify(plan.coaching).toLowerCase();
  assert.equal(plan.goalType, 'health');
  assert.equal(plan.wellness.healthGoal, 'move-more');
  assert.doesNotMatch(text, /yukata|quỹ mua|nhận thu nhập|mua bốc đồng/);
  assert.match(text, /vận động|đi bộ/);
});

test('dữ liệu sức khỏe ngoài phạm vi không tạo lịch giảm cân giả', () => {
  const plan = buildWellnessPlan({
    healthGoal:'gradual-loss', age:30, heightCm:80,
    currentWeightKg:500, targetWeightKg:50, activityLevel:'low',
  });
  assert.equal(plan.status, 'insufficient-input');
  assert.equal(plan.currentBmi, null);
  assert.equal(plan.estimatedWeeks, null);
  assert.match(plan.safetyMessage, /120–230 cm/);
});

test('người dưới 18 tuổi không nhận lịch giảm cân cá nhân', () => {
  const plan = buildWellnessPlan({
    healthGoal:'gradual-loss', age:16, heightCm:165,
    currentWeightKg:65, targetWeightKg:55, activityLevel:'some',
  });
  assert.equal(plan.status, 'needs-professional-guidance');
  assert.equal(plan.estimatedWeeks, null);
});
