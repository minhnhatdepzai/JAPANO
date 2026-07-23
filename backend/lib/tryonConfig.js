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
