// fetch có timeout + kiểm tra "sống" của các service AI cục bộ (FASHN, motion,
// CatVTON, AI gateway, Ollama) — dùng chung giữa routes/stylist.js (endpoint
// /ai/health) và routes/tryon.js (gọi thật các service này).
async function fetchWithTimeout(url, options = {}, timeoutMs = 1800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function serviceHealth(base, pathName = '/health') {
  if (!base) return { configured: false, online: false };
  try {
    const response = await fetchWithTimeout(`${base}${pathName}`, {}, 1600);
    const text = await response.text();
    let detail = {};
    try { detail = text ? JSON.parse(text) : {}; } catch { detail = { text: text.slice(0, 160) }; }
    return { configured: true, online: response.ok, status: response.status, detail };
  } catch (error) {
    return { configured: true, online: false, error: error.name === 'AbortError' ? 'timeout' : error.message };
  }
}

module.exports = { fetchWithTimeout, serviceHealth };
