// Cổng an toàn 18+ cho đồ bơi và trang phục hở.
//
// Thiếu xác nhận, tín hiệu trẻ vị thành niên hoặc dịch vụ kiểm tra chết đều bị
// từ chối. `unsure` không phải bằng chứng là trẻ em: sau xác nhận 18+ có thể đi
// tiếp, nhưng kết quả vẫn phải qua quality gate che phủ bắt buộc.
const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateAdultGate, adultGateLogLine } = require('../lib/adultTryonPolicy');
const { safetyPolicyFor } = require('../lib/garmentCoverage');

const swimwear = safetyPolicyFor([{ name: 'Bikini hai mảnh hoa anh đào' }]);
const ordinary = safetyPolicyFor([{ name: 'Áo sơ mi trắng' }]);
const adultCheck = { available: true, verdict: 'yes' };

test('trang phục thường không kích hoạt cổng 18+', () => {
  const gate = evaluateAdultGate({ policy: ordinary, adultConsent: false, imageCheck: null });
  assert.equal(gate.allowed, true);
  assert.equal(gate.required, false);
});

test('đồ bơi mà chưa xác nhận 18+ thì bị từ chối', () => {
  const gate = evaluateAdultGate({ policy: swimwear, adultConsent: false, imageCheck: adultCheck });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, 'ADULT_CONSENT_REQUIRED');
  assert.match(gate.message, /18 tuổi/);
});

test('xác nhận 18+ nhưng ảnh có dấu hiệu trẻ vị thành niên thì bị từ chối', () => {
  const gate = evaluateAdultGate({
    policy: swimwear, adultConsent: true, imageCheck: { available: true, verdict: 'no' },
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, 'MINOR_SUSPECTED');
});

test('model đã hỏi nhưng không dám kết luận thì dựa vào xác nhận 18+, không bịa tuổi', () => {
  for (const verdict of ['unsure', '', 'khong-ro', undefined]) {
    const gate = evaluateAdultGate({
      policy: swimwear, adultConsent: true, imageCheck: { available: true, verdict },
    });
    assert.equal(gate.allowed, true, `verdict=${verdict} được tiếp tục sau xác nhận`);
    assert.equal(gate.code, null);
    assert.equal(gate.attestationFallback, true);
    assert.match(gate.warning, /xác nhận 18\+/i);
  }
});

test('dịch vụ kiểm tra ảnh chết hoặc quá hạn thì fail-closed, không cho qua', () => {
  // Phân biệt rõ với ca trên: ở đây model CHƯA ĐƯỢC HỎI, nên thông báo cho
  // người dùng phải khác (thử lại sau, chứ không phải đổi ảnh).
  for (const imageCheck of [null, undefined,
                            { available: false, verdict: 'unsure', error: 'timeout' },
                            { available: false, verdict: 'yes' }]) {
    const gate = evaluateAdultGate({ policy: swimwear, adultConsent: true, imageCheck });
    assert.equal(gate.allowed, false, `imageCheck=${JSON.stringify(imageCheck)} phải bị chặn`);
    assert.equal(gate.code, 'AGE_VERIFICATION_UNAVAILABLE');
  }
});

test('đủ xác nhận và ảnh là người trưởng thành thì cho phép', () => {
  const gate = evaluateAdultGate({ policy: swimwear, adultConsent: true, imageCheck: adultCheck });
  assert.equal(gate.allowed, true);
  assert.equal(gate.required, true);
  assert.equal(gate.verdict, 'yes');
});

test('tắt tầng kiểm tra bằng thị giác phải là quyết định có chủ đích qua env', () => {
  const previous = process.env.JAPANO_ADULT_VISION_CHECK;
  process.env.JAPANO_ADULT_VISION_CHECK = '0';
  try {
    const gate = evaluateAdultGate({ policy: swimwear, adultConsent: true, imageCheck: null });
    assert.equal(gate.allowed, true);
    assert.equal(gate.visionSkipped, true);
    // Xác nhận 18+ vẫn là bắt buộc dù đã tắt kiểm tra ảnh.
    const noConsent = evaluateAdultGate({ policy: swimwear, adultConsent: false, imageCheck: null });
    assert.equal(noConsent.allowed, false);
  } finally {
    if (previous === undefined) delete process.env.JAPANO_ADULT_VISION_CHECK;
    else process.env.JAPANO_ADULT_VISION_CHECK = previous;
  }
});

test('log an toàn không chứa ảnh, base64 hay dữ liệu nhạy cảm', () => {
  const gate = evaluateAdultGate({ policy: swimwear, adultConsent: true, imageCheck: adultCheck });
  const line = adultGateLogLine(gate, swimwear);
  assert.match(line, /\[TRYON SAFETY\]/);
  assert.match(line, /requires18Plus=true/);
  assert.ok(!line.includes('base64'));
  assert.ok(!line.includes('data:image'));
  assert.ok(line.length < 240);
});

test('một lượt gồm cả bikini lẫn đồ thường vẫn phải qua cổng 18+', () => {
  const mixed = safetyPolicyFor([{ name: 'Áo bikini' }, { name: 'Haori họa tiết sóng' }]);
  const gate = evaluateAdultGate({ policy: mixed, adultConsent: false, imageCheck: adultCheck });
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, 'ADULT_CONSENT_REQUIRED');
});
