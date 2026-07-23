// Địa chỉ các service AI cục bộ — dùng chung giữa routes/stylist.js
// (endpoint /ai/health) và routes/tryon.js (thử đồ + chuyển động).
const CATVTON_URL = String(process.env.JAPANO_CATVTON_URL || 'http://127.0.0.1:7861').replace(/\/+$/, '');
const FASHN_URL = String(process.env.JAPANO_FASHN_URL || 'http://127.0.0.1:7862').replace(/\/+$/, '');
const MOTION_URL = String(process.env.JAPANO_MOTION_URL || 'http://127.0.0.1:7864').replace(/\/+$/, '');
// The mobile action button is enabled only when the new local One-to-All
// service and its CUDA/quality gates report healthy.
const MOTION_ENGINE_LABEL = String(process.env.JAPANO_MOTION_ENGINE_LABEL || 'one-to-all-animation-1.3b-v2').trim();
const AI_GATEWAY_URL = String(process.env.JAPANO_AI_GATEWAY_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');
const OLLAMA_URL = String(process.env.OLLAMA_URL || process.env.JAPANO_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');

module.exports = { CATVTON_URL, FASHN_URL, MOTION_URL, MOTION_ENGINE_LABEL, AI_GATEWAY_URL, OLLAMA_URL };
