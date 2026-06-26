import { API_URL } from './api';

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export const japanoV41Api = {
  health: () => request('/api/v41/ai/health'),
  cameraAnalyze: (body: any) => request('/api/v41/camera/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  sizeAdvice: (body: any) => request('/api/v41/size/advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  generateRealistic: (body: any) => request('/api/v41/generate/realistic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  tryOnAdvancedForm: (form: FormData) => request('/api/v41/tryon/advanced', {
    method: 'POST',
    body: form,
  }),
};
