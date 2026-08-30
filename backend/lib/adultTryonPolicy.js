// Cổng an toàn cho việc thử đồ bơi và trang phục hở (chỉ dành cho người 18+).
//
// Hai điều kiện ĐỘC LẬP:
//
//   1. Người dùng tự xác nhận đủ 18 tuổi và có quyền dùng bức ảnh.
//   2. Ảnh không có tín hiệu rõ ràng là trẻ vị thành niên.
//
// Model thị giác không phải giấy tờ xác minh tuổi. `unsure` thường chỉ có nghĩa
// ảnh xa/ánh sáng khó, nên nếu đã có xác nhận 18+ thì cho phép đi tiếp với cờ
// `attestationFallback`; kết quả vẫn phải qua sàn che phủ ngực/vùng chậu/mông.
// `no` vẫn chặn tuyệt đối, còn service không chạy được vẫn fail-closed.

// Kết quả của lib/adultImageCheck.js: 'yes' | 'no' | 'unsure'.
const ADULT_VERDICT = 'yes';
const MINOR_VERDICT = 'no';

const REFUSALS = {
  ADULT_CONSENT_REQUIRED: 'Trang phục này chỉ dành cho người từ 18 tuổi. Hãy xác nhận bạn đủ 18 tuổi và có quyền sử dụng bức ảnh trước khi thử.',
  MINOR_SUSPECTED: 'Ảnh có dấu hiệu là người chưa đủ 18 tuổi nên hệ thống không thử trang phục này. Hãy dùng ảnh của người trưởng thành.',
  AGE_UNVERIFIED: 'Không đủ căn cứ để xác định đây là ảnh người trưởng thành. Hãy dùng ảnh rõ mặt, đủ sáng, chụp người trưởng thành.',
  AGE_VERIFICATION_UNAVAILABLE: 'Dịch vụ kiểm tra an toàn ảnh đang không sẵn sàng nên chưa thể thử trang phục dành cho người 18+. Hãy thử lại sau.',
};

const flag = (name, fallback = '1') => String(process.env[name] ?? fallback).trim().toLowerCase() !== '0';

/**
 * Quyết định cho phép hay từ chối một lượt thử trang phục 18+.
 *
 * @param {object} input
 * @param {object} input.policy          kết quả safetyPolicyFor()
 * @param {boolean} input.adultConsent   người dùng đã tick xác nhận 18+ chưa
 * @param {object|null} input.imageCheck kết quả checkAdultImage: {available, verdict}
 */
function evaluateAdultGate({ policy, adultConsent, imageCheck }) {
  if (!policy?.requires18Plus) {
    return { allowed: true, required: false, code: null, message: '' };
  }
  if (adultConsent !== true) {
    return { allowed: false, required: true, code: 'ADULT_CONSENT_REQUIRED', message: REFUSALS.ADULT_CONSENT_REQUIRED };
  }
  // Có thể tắt tầng kiểm tra bằng thị giác khi vận hành ở môi trường không có
  // model vision — nhưng phải là quyết định có chủ đích của người vận hành.
  if (!flag('JAPANO_ADULT_VISION_CHECK')) {
    return { allowed: true, required: true, code: null, message: '', verdict: null, visionSkipped: true };
  }
  // KHÔNG kiểm tra được (service chết, quá hạn) khác với ĐÃ HỎI nhưng model
  // không dám kết luận. Cả hai đều từ chối, nhưng người dùng cần biết nên thử
  // lại sau hay nên đổi ảnh.
  if (!imageCheck?.available) {
    return {
      allowed: false, required: true, code: 'AGE_VERIFICATION_UNAVAILABLE',
      message: REFUSALS.AGE_VERIFICATION_UNAVAILABLE, error: imageCheck?.error || 'unavailable',
    };
  }
  const verdict = String(imageCheck.verdict || 'unsure').toLowerCase();
  if (verdict === MINOR_VERDICT) {
    return { allowed: false, required: true, code: 'MINOR_SUSPECTED', message: REFUSALS.MINOR_SUSPECTED, verdict };
  }
  if (verdict !== ADULT_VERDICT) {
    return {
      allowed: true, required: true, code: null, message: '', verdict,
      attestationFallback: true,
      warning: 'Không suy đoán được tuổi từ ảnh; lượt thử tiếp tục dựa trên xác nhận 18+ của người dùng.',
    };
  }
  return { allowed: true, required: true, code: null, message: '', verdict };
}

// Ghi log an toàn: chỉ số liệu quyết định, không kèm ảnh, không kèm base64.
function adultGateLogLine(gate, policy) {
  return [
    '[TRYON SAFETY]',
    `types=${(policy?.garmentTypes || []).join('+') || 'none'}`,
    `requires18Plus=${Boolean(policy?.requires18Plus)}`,
    `swimwear=${Boolean(policy?.containsSwimwear)}`,
    `allowed=${gate.allowed}`,
    gate.code ? `reason=${gate.code}` : 'reason=none',
    gate.verdict ? `adultCheck=${gate.verdict}` : '',
    gate.attestationFallback ? 'attestationFallback=true' : '',
  ].filter(Boolean).join(' | ');
}

module.exports = { evaluateAdultGate, adultGateLogLine, ADULT_VERDICT, MINOR_VERDICT, REFUSALS };
