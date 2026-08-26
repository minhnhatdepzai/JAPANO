// Cờ cấu hình thử đồ AI — dùng chung giữa routes/health.js (báo cáo trạng thái)
// và routes/tryon.js (quyết định luồng xử lý).
// Ảnh có dáng phù hợp đi thẳng FASHN để nhanh và nhẹ hơn. FLUX.2 chỉ đổi tư
// thế khi pose detector thấy tay/vật che thân hoặc dáng chưa phù hợp. Biến môi
// trường vẫn cho phép ép đổi dáng khi cần kiểm thử pipeline đầy đủ.
const FORCE_REPOSE = String(process.env.JAPANO_FORCE_REPOSE || '0').trim().toLowerCase() !== '0';
// FLUX fidelity refinement có thể đẩy tổng VRAM sát giới hạn 16 GB khi máy
// đồng thời chạy Android emulator và Remote Desktop. FASHN đã tạo ảnh mặc đồ
// hoàn chỉnh; chỉ bật lượt làm đẹp bổ sung khi chủ động kiểm thử trên máy có
// đủ headroom bằng JAPANO_FASHN_FIDELITY_REFINE=1.
const FASHN_FIDELITY_REFINE = String(process.env.JAPANO_FASHN_FIDELITY_REFINE || '0').trim().toLowerCase() !== '0';

module.exports = { FORCE_REPOSE, FASHN_FIDELITY_REFINE };

// --- Mô phỏng độ vừa vặn (fit-aware try-on) ---------------------------------
// Đọc env NGAY LÚC GỌI (không cache vào hằng số) để test và script chẩn đoán có
// thể bật/tắt từng phần mà không phải khởi động lại tiến trình.
const flag = (name, fallback = '1') => String(process.env[name] ?? fallback).trim().toLowerCase() !== '0';
const number = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fitConfig = () => ({
  fitEffectEnabled: flag('JAPANO_FIT_EFFECT_ENABLED'),
  bodyAnalysisEnabled: flag('JAPANO_BODY_ANALYSIS_ENABLED'),
  heightEstimationEnabled: flag('JAPANO_HEIGHT_ESTIMATION_ENABLED'),
  weightEstimationEnabled: flag('JAPANO_WEIGHT_ESTIMATION_ENABLED'),
  fitRefineMinSeverity: number('JAPANO_FIT_REFINE_MIN_SEVERITY', 0.35),
  fitTearMinSeverity: number('JAPANO_FIT_TEAR_MIN_SEVERITY', 0.85),
  bodyEstimateMinConfidence: number('JAPANO_BODY_ESTIMATE_MIN_CONFIDENCE', 0.35),
  fitLoraPath: process.env.JAPANO_FIT_LORA_PATH || '',
  // LoRA fit được train trên dữ liệu upper-body (VITON-HD) nên mặc định chỉ áp
  // cho `tops`. Danh mục khác dùng FLUX gốc — xem backend/AI_FIT_TRYON.md.
  fitLoraCategories: String(process.env.JAPANO_FIT_LORA_CATEGORIES || 'tops')
    .split(',').map((item) => item.trim()).filter(Boolean),
});

module.exports.fitConfig = fitConfig;
