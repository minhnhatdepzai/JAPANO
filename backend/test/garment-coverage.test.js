// Phân loại trang phục và sàn an toàn về độ che phủ.
//
// Đây là nơi quyết định hai chuyện không được nhầm lẫn: vùng da nào lộ ra là
// đúng thiết kế, và vùng nào bắt buộc phải kín trong mọi trường hợp.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALWAYS_COVERED_ZONES, garmentTypeFor, coverageProfileFor, safetyPolicyFor, exposedZonesOf,
} = require('../lib/garmentCoverage');

test('nhận dạng từng loại trang phục, không gộp bằng một mẫu chung', () => {
  const cases = [
    ['Bikini hai mảnh hoa anh đào', 'bikini_two_piece'],
    ['Set bikini họa tiết sóng', 'bikini_two_piece'],
    ['Áo bikini phối dây', 'bikini_top'],
    ['Quần bikini lưng cao', 'bikini_bottom'],
    ['Áo tắm một mảnh họa tiết sóng', 'one_piece_swimsuit'],
    ['Đồ bơi liền thân', 'one_piece_swimsuit'],
    ['Crop top họa tiết seigaiha', 'crop_top'],
    ['Áo lửng cổ tròn', 'crop_top'],
    ['Áo sát nách họa tiết sóng', 'sleeveless_top'],
    ['Áo trễ vai tay bồng', 'off_shoulder_top'],
    ['Quần short phối hoa văn Nhật', 'shorts'],
    ['Chân váy ngắn xếp ly', 'short_skirt'],
    ['Yukata hoa anh đào', 'yukata'],
    ['Kimono furisode', 'kimono'],
    ['Haori họa tiết seigaiha', 'haori'],
    ['Hakama nữ', 'hakama'],
    ['Jinbei mùa hè', 'jinbei'],
    ['Samue vải bông', 'samue'],
    ['Noragi denim', 'noragi'],
    ['Happi matsuri', 'happi'],
  ];
  for (const [name, expected] of cases) {
    assert.equal(garmentTypeFor({ name }), expected, `"${name}" phải là ${expected}`);
  }
});

test('bikini hai mảnh KHÔNG bị nhận nhầm thành áo tắm một mảnh', () => {
  assert.equal(garmentTypeFor({ name: 'Bikini hai mảnh' }), 'bikini_two_piece');
  assert.notEqual(garmentTypeFor({ name: 'Bikini hai mảnh' }), 'one_piece_swimsuit');
  assert.equal(garmentTypeFor({ name: 'Áo tắm một mảnh' }), 'one_piece_swimsuit');
});

test('không khớp nhầm chuỗi con: "lưng cao bikini" không phải áo bikini', () => {
  // "c-ao" chứa "ao" nên mẫu "áo bikini" thiếu ranh giới từ sẽ khớp nhầm và
  // biến một chiếc quần bikini thành áo bikini.
  assert.equal(garmentTypeFor({ slug: 'bikini-bottom-test', name: 'Quần bikini lưng cao' }), 'bikini_bottom');
  assert.equal(garmentTypeFor({ name: 'Quần bikini cạp cao' }), 'bikini_bottom');
  assert.equal(garmentTypeFor({ name: 'Áo bikini phối dây' }), 'bikini_top');
});

test('garmentType khai báo trong catalog thắng suy đoán từ tên', () => {
  const product = { name: 'Sản phẩm tên mơ hồ', garmentType: 'crop_top' };
  assert.equal(garmentTypeFor(product), 'crop_top');
});

test('catalog cũ không có garmentType vẫn rơi về ba vùng như trước', () => {
  assert.equal(garmentTypeFor({ name: 'Quần âu nam' }), 'bottoms');
  assert.equal(garmentTypeFor({ name: 'Đầm dạ hội' }), 'one-pieces');
  assert.equal(garmentTypeFor({ name: 'Áo sơ mi trắng' }), 'tops');
});

// --- Sàn an toàn -------------------------------------------------------------
test('ngực, vùng chậu và mông LUÔN kín ở mọi loại trang phục', () => {
  for (const name of ['Bikini hai mảnh', 'Áo tắm một mảnh', 'Crop top', 'Quần short',
                      'Chân váy ngắn', 'Áo sát nách', 'Yukata']) {
    const profile = coverageProfileFor({ name });
    for (const zone of ALWAYS_COVERED_ZONES) {
      assert.equal(profile.coverageProfile[zone], 'covered',
        `${name}: vùng ${zone} phải luôn kín`);
    }
  }
});

test('sản phẩm KHÔNG thể tự khai báo hở vùng nhạy cảm', () => {
  const profile = coverageProfileFor({
    name: 'Bikini hai mảnh',
    coverageProfile: { chest: 'exposed', pelvis: 'exposed', buttocks: 'exposed', abdomen: 'exposed' },
  });
  assert.equal(profile.coverageProfile.chest, 'covered');
  assert.equal(profile.coverageProfile.pelvis, 'covered');
  assert.equal(profile.coverageProfile.buttocks, 'covered');
  // Vùng không thuộc sàn an toàn thì vẫn tôn trọng khai báo của catalog.
  assert.equal(profile.coverageProfile.abdomen, 'exposed');
});

test('đồ bơi và đồ ngắn KHÔNG BAO GIỜ được phép mô phỏng rách', () => {
  for (const name of ['Bikini hai mảnh', 'Áo bikini', 'Quần bikini', 'Áo tắm một mảnh',
                      'Crop top', 'Quần short', 'Chân váy ngắn']) {
    assert.equal(coverageProfileFor({ name }).tearAllowed, false, `${name} không được phép rách`);
  }
});

test('sản phẩm được phép siết chặt tearAllowed nhưng không được nới lỏng', () => {
  assert.equal(coverageProfileFor({ name: 'Áo thun cotton' }).tearAllowed, true);
  assert.equal(coverageProfileFor({ name: 'Áo thun cotton', tearAllowed: false }).tearAllowed, false);
  // Bikini khai báo tearAllowed:true vẫn bị từ chối.
  assert.equal(coverageProfileFor({ name: 'Bikini hai mảnh', tearAllowed: true }).tearAllowed, false);
});

test('cardigan hiện đại không bị category haori cũ làm cấm mô phỏng bục đường may', () => {
  const profile = coverageProfileFor({
    name: 'Áo len khoác dệt kim', slug: 'ao-len-cardigan', category: 'haori',
  });
  assert.equal(profile.garmentType, 'cardigan');
  assert.equal(profile.layer, 'upper-outer');
  assert.equal(profile.tearAllowed, true);
  assert.equal(profile.preserveConstruction, false);
});

test('đồ bơi và đồ hở nhiều yêu cầu xác nhận 18+', () => {
  for (const name of ['Bikini hai mảnh', 'Áo tắm một mảnh', 'Crop top']) {
    assert.equal(coverageProfileFor({ name }).adultOnlyTryOn, true, `${name} phải yêu cầu 18+`);
  }
  for (const name of ['Áo sơ mi trắng', 'Yukata hoa anh đào', 'Quần short']) {
    assert.equal(coverageProfileFor({ name }).adultOnlyTryOn, false, `${name} không cần cổng 18+`);
  }
});

// --- Vùng da lộ có chủ đích --------------------------------------------------
test('crop top hở bụng, giữ kín vai và tay', () => {
  const coverage = coverageProfileFor({ name: 'Crop top' }).coverageProfile;
  assert.equal(coverage.abdomen, 'exposed');
  assert.equal(coverage.shoulders, 'covered');
  assert.equal(coverage.upperArms, 'covered');
});

test('áo sát nách hở vai và bắp tay, giữ kín bụng', () => {
  const coverage = coverageProfileFor({ name: 'Áo sát nách' }).coverageProfile;
  assert.equal(coverage.shoulders, 'exposed');
  assert.equal(coverage.upperArms, 'exposed');
  assert.equal(coverage.abdomen, 'covered');
});

test('áo trễ vai hở vai nhưng vẫn che bắp tay', () => {
  const coverage = coverageProfileFor({ name: 'Áo trễ vai' }).coverageProfile;
  assert.equal(coverage.shoulders, 'exposed');
  assert.equal(coverage.upperArms, 'covered');
});

test('quần short và váy ngắn hở chân, giữ kín vùng chậu và mông', () => {
  for (const name of ['Quần short', 'Chân váy ngắn']) {
    const coverage = coverageProfileFor({ name }).coverageProfile;
    assert.equal(coverage.legs, 'exposed', `${name} phải hở chân`);
    assert.equal(coverage.pelvis, 'covered');
    assert.equal(coverage.buttocks, 'covered');
  }
});

test('áo tắm một mảnh che bụng, bikini thì không', () => {
  assert.equal(coverageProfileFor({ name: 'Áo tắm một mảnh' }).coverageProfile.abdomen, 'covered');
  assert.equal(coverageProfileFor({ name: 'Bikini hai mảnh' }).coverageProfile.abdomen, 'exposed');
});

test('jinbei hở bắp tay và chân đúng đặc trưng đồ mùa hè', () => {
  const coverage = coverageProfileFor({ name: 'Jinbei mùa hè' }).coverageProfile;
  assert.equal(coverage.upperArms, 'exposed');
  assert.equal(coverage.legs, 'exposed');
});

test('exposedZonesOf liệt kê đúng vùng hở', () => {
  const coverage = coverageProfileFor({ name: 'Bikini hai mảnh' }).coverageProfile;
  const zones = exposedZonesOf(coverage);
  assert.ok(zones.includes('abdomen'));
  assert.ok(zones.includes('legs'));
  assert.ok(!zones.includes('chest'));
});

// --- Chính sách cho cả lượt thử ---------------------------------------------
test('một lượt nhiều món gộp theo hướng an toàn nhất', () => {
  const policy = safetyPolicyFor([{ name: 'Áo bikini' }, { name: 'Quần short' }]);
  assert.equal(policy.requires18Plus, true, 'chỉ cần một món cần 18+ là cả lượt cần');
  assert.equal(policy.containsSwimwear, true);
  assert.equal(policy.tearAllowed, false, 'chỉ cần một món cấm rách là cả lượt cấm');
  assert.deepEqual(policy.requiredCoveredZones, ALWAYS_COVERED_ZONES);
  assert.equal(policy.coverageStyle, 'minimal-swimwear');
});

test('lượt thử đồ thường không kích hoạt cổng 18+ và vẫn cho phép rách', () => {
  const policy = safetyPolicyFor([{ name: 'Áo sơ mi trắng' }]);
  assert.equal(policy.requires18Plus, false);
  assert.equal(policy.containsSwimwear, false);
  assert.equal(policy.tearAllowed, true);
  assert.equal(policy.intentionalSkinExposure, false);
  assert.equal(policy.coverageStyle, 'standard');
});

test('bikini top + bikini bottom được xem là một bộ hai mảnh hợp lệ', () => {
  const policy = safetyPolicyFor([{ name: 'Áo bikini' }, { name: 'Quần bikini' }]);
  assert.deepEqual(policy.garmentTypes, ['bikini_top', 'bikini_bottom']);
  assert.ok(policy.allowedExposedZones.includes('abdomen'));
  assert.equal(policy.tearAllowed, false);
});

test('crop top yêu cầu giữ nguyên chiều dài vạt áo', () => {
  assert.equal(safetyPolicyFor([{ name: 'Crop top' }]).preserveHemLength, true);
  assert.equal(safetyPolicyFor([{ name: 'Áo sơ mi trắng' }]).preserveHemLength, false);
});

test('trang phục Nhật yêu cầu giữ nguyên kết cấu', () => {
  for (const name of ['Yukata', 'Kimono furisode', 'Haori', 'Hakama nữ']) {
    assert.equal(safetyPolicyFor([{ name }]).preserveConstruction, true, `${name} phải giữ kết cấu`);
  }
});
