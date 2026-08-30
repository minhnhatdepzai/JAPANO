type ApiOptions = RequestInit & { timeoutMs?: number };

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30_000);
  try {
    const response = await fetch(path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`, {
      ...options,
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    const type = response.headers.get("content-type") || "";
    const payload: unknown = type.includes("application/json") ? await response.json() : await response.blob();
    if (!response.ok) {
      // Backend luôn trả JSON có `message` cho lỗi nghiệp vụ; giữ nguyên câu chữ
      // của nó thay vì thay bằng thông báo tự chế.
      const detail = (payload && typeof payload === "object" ? payload : {}) as { message?: unknown; error?: unknown; code?: unknown };
      const error = new Error(String(detail.message || detail.error || `Yêu cầu thất bại (${response.status}).`));
      Object.assign(error, { status: response.status, data: payload, code: detail.code });
      throw error;
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const postJson = <T>(path: string, body: unknown, timeoutMs?: number) => api<T>(path, {
  method: "POST",
  body: JSON.stringify(body),
  timeoutMs,
});

type AiJob<T> = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  stage?: string;
  result?: T;
  error?: string;
};

export async function runAiJob<T>(
  jobsPath: string,
  body: unknown,
  options: { timeoutMs?: number; pollMs?: number; onStage?: (stage: string) => void } = {},
) {
  const created = await postJson<{ ok: boolean; job: AiJob<T> }>(jobsPath, body, 30_000);
  const jobId = created.job?.id;
  if (!jobId) throw new Error("Backend chưa tạo được tác vụ AI.");
  const deadline = Date.now() + (options.timeoutMs || 15 * 60_000);
  while (Date.now() < deadline) {
    const current = await api<{ ok: boolean; job: AiJob<T> }>(`${jobsPath}/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      timeoutMs: 20_000,
    });
    options.onStage?.(current.job.stage || "Đang xử lý");
    if (current.job.status === "completed" && current.job.result) return current.job.result;
    if (current.job.status === "failed") throw new Error(current.job.error || "Tác vụ AI thất bại.");
    if (current.job.status === "cancelled") throw new Error("Tác vụ AI đã bị hủy.");
    await new Promise((resolve) => setTimeout(resolve, options.pollMs || 1_200));
  }
  await api(`${jobsPath}/${encodeURIComponent(jobId)}`, { method: "DELETE", timeoutMs: 10_000 }).catch(() => undefined);
  throw new Error("Tác vụ AI quá thời gian chờ. Bạn có thể thử lại mà không cần tải lại trang.");
}
