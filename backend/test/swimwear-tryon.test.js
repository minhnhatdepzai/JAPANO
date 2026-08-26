// Luồng thử đồ bơi và trang phục hở — phần dễ sai nhất về an toàn.
const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveOutfitGarments } = require('../routes/tryon');
const { coverageProfileFor, safetyPolicyFor, garmentTypeFor } = require('../lib/garmentCoverage');
const { analyzeFit, fitRefinePlan } = require('../lib/fitAnalysis');
const { evaluateAdultGate } = require('../lib/adultTryonPolicy');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const product = (slug, name, extra = {}) => ({ slug, id: slug, name, cat: 'trang-phuc', ...extra });

// resolveOutfitGarments cần ảnh sản phẩm thật; dùng catalog Nhật vừa thêm.
const stateWith = (...products) => ({ products });

test('bikini hai mảnh: áo và quần là hai món khác lớp nên mặc chồng được', () => {
  const top = product('bikini-top-test', 'Áo bikini phối dây');
  const bottom = product('bikini-bottom-test', 'Quần bikini lưng cao');
  assert.equal(coverageProfileFor(top).layer, 'upper-base');
  assert.equal(coverageProfileFor(bottom).layer, 'lower');
  // Hai lớp khác nhau => luật multi-garment hiện có cho phép mặc cùng lượt.
  assert.notEqual(coverageProfileFor(top).zone, coverageProfileFor(bottom).zone);
});

test('bikini hai mảnh KHÔNG bị gộp thành áo tắm một mảnh', () => {
  const policy = safetyPolicyFor([
    product('a', 'Áo bikini'), product('b', 'Quần bikini'),
  ]);
  assert.deepEqual(policy.garmentTypes, ['bikini_top', 'bikini_bottom']);
  assert.ok(!policy.garmentTypes.includes('one_piece_swimsuit'));
});

test('bikini không bao giờ được mô phỏng rách dù lệch size cực lớn', () => {
  const policy = safetyPolicyFor([product('a', 'Bikini hai mảnh')]);
  const fit = analyzeFit({
    chosenSize: 'S', recommendedSize: '5XL', zone: 'upper', category: 'tops',
    garmentTearAllowed: policy.tearAllowed,
  });
  assert.equal(fit.verdict, 'very_tight');
  assert.equal(fit.visualEffect.tearAllowed, false);
  assert.ok(!fit.allowedEffects.includes('small_seam_split'));
  // Đường may bị tách rời cũng bị cấm: với đồ bơi nó đồng nghĩa với hở da.
  assert.ok(!fit.allowedEffects.includes('seam_separation'));
});

test('quần short và chân váy ngắn cũng không được phép rách', () => {
  for (const name of ['Quần short hoa văn Nhật', 'Chân váy ngắn xếp ly']) {
    const policy = safetyPolicyFor([product('x', name)]);
    const fit = analyzeFit({
      chosenSize: 'S', recommendedSize: 'XXL', zone: 'lower', category: 'bottoms',
      garmentTearAllowed: policy.tearAllowed,
    });
    assert.equal(fit.visualEffect.tearAllowed, false, `${name} không được rách`);
  }
});

test('crop top vẫn chạy fit refine nhưng phải giữ nguyên chiều dài vạt áo', () => {
  const policy = safetyPolicyFor([product('c', 'Crop top họa tiết Seigaiha')]);
  assert.equal(policy.preserveHemLength, true);
  const fit = analyzeFit({
    chosenSize: 'XXL', recommendedSize: 'S', zone: 'upper', category: 'tops',
    garmentTearAllowed: policy.tearAllowed,
  });
  assert.equal(fit.verdict, 'very_loose');
  assert.equal(fitRefinePlan(fit).shouldRefine, true);
  // Rộng thì rủ thùng thình, nhưng vạt áo không được dài ra để che bụng —
  // ràng buộc đó nằm trong prompt (CROP_LOCK ở fashn_service.py).
  assert.ok(fit.allowedEffects.includes('oversized_silhouette'));
});

test('áo tắm một mảnh che bụng, không bị áp hiệu ứng hở bụng của bikini', () => {
  const onePiece = coverageProfileFor(product('s', 'Áo tắm một mảnh họa tiết sóng'));
  assert.equal(onePiece.coverageProfile.abdomen, 'covered');
  assert.equal(onePiece.swimwear, true);
  assert.equal(onePiece.tearAllowed, false);
});

test('vùng bắt buộc kín giống nhau ở mọi lượt, không phụ thuộc sản phẩm', () => {
  const swim = safetyPolicyFor([product('a', 'Bikini hai mảnh')]);
  const shirt = safetyPolicyFor([product('b', 'Áo sơ mi trắng')]);
  assert.deepEqual(swim.requiredCoveredZones, shirt.requiredCoveredZones);
  assert.deepEqual(swim.requiredCoveredZones, ['chest', 'pelvis', 'buttocks']);
});

test('không tồn tại đường nào cho phép cởi đồ hay tạo ảnh khỏa thân', () => {
  // Mọi loại trang phục đều phải khai báo ba vùng nhạy cảm là "covered".
  const types = ['bikini_two_piece', 'bikini_top', 'bikini_bottom', 'one_piece_swimsuit',
                 'crop_top', 'sleeveless_top', 'off_shoulder_top', 'shorts', 'short_skirt'];
  for (const garmentType of types) {
    const profile = coverageProfileFor({ name: 'x', garmentType });
    for (const zone of ['chest', 'pelvis', 'buttocks']) {
      assert.equal(profile.coverageProfile[zone], 'covered', `${garmentType}.${zone} phải kín`);
    }
  }
});

test('lượt thử đồ bơi bị chặn ở backend khi thiếu xác nhận, dù client có gửi gì', () => {
  const policy = safetyPolicyFor([product('a', 'Bikini hai mảnh')]);
  for (const consent of [undefined, false, 'true', 1, null]) {
    const gate = evaluateAdultGate({ policy, adultConsent: consent, imageCheck: { available: true, verdict: 'yes' } });
    assert.equal(gate.allowed, false, `adultConsent=${consent} phải bị chặn`);
  }
  // Chỉ đúng boolean true mới được chấp nhận.
  assert.equal(evaluateAdultGate({ policy, adultConsent: true, imageCheck: { available: true, verdict: 'yes' } }).allowed, true);
});

test('resolveOutfitGarments vẫn giữ luật cũ: một món thân dưới mỗi lượt', () => {
  const state = stateWith(
    product('quan-short-hoa-van', 'Quần short hoa văn Nhật'),
    product('vay-xep-ly-nhat', 'Chân váy ngắn xếp ly'),
  );
  assert.throws(
    () => resolveOutfitGarments(state, ['quan-short-hoa-van', 'vay-xep-ly-nhat'], httpError),
    /một món thân dưới/i,
  );
});

test('trang phục Nhật giữ nguyên phân lớp cũ để không phá luồng multi-garment', () => {
  assert.equal(coverageProfileFor({ name: 'Haori họa tiết Seigaiha' }).layer, 'upper-outer');
  assert.equal(coverageProfileFor({ name: 'Hakama nữ màu tím' }).layer, 'lower');
  assert.equal(coverageProfileFor({ name: 'Yukata hoa anh đào' }).layer, 'overall');
  assert.equal(garmentTypeFor({ name: 'Áo sơ mi trắng' }), 'tops');
});
