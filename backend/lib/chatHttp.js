// Chat JSON must finish inside the budget, including reading the response body.
// Keep this separate from image/video fetches, which have different lifetimes.
async function fetchChatJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetch(url, { ...options, signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(new Error(`ollama-http-${response.status}`), { status: response.status });
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchChatJson };
