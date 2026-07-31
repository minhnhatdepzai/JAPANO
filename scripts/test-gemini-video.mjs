import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const MODEL = process.env.JAPANO_GEMINI_VIDEO_MODEL || 'gemini-omni-flash-preview';
const key = String(process.env.GEMINI_API_KEY || '').trim();
const inputPath = path.resolve(process.argv[2] || '');
const outputPath = path.resolve(process.argv[3] || 'backend/data/motion/gemini-omni-test.mp4');

if (!key) throw new Error('Thiếu GEMINI_API_KEY trong .env.server.');
if (!process.argv[2]) throw new Error('Cần truyền đường dẫn ảnh đầu vào.');

const extension = path.extname(inputPath).toLowerCase();
const mimeType = extension === '.png' ? 'image/png' : 'image/jpeg';
const image = await fs.readFile(inputPath);
if (!image.length || image.length > 20 * 1024 * 1024) {
  throw new Error('Ảnh đầu vào trống hoặc vượt quá 20 MB.');
}

const prompt = process.env.JAPANO_GEMINI_VIDEO_TEST_PROMPT || [
  'Create a short vertical fashion product showcase from this exact image.',
  'The same adult woman makes one very small, natural weight shift and gently breathes; she may blink once.',
  'Keep her identity, face, hairstyle, body proportions, kimono design, every floral pattern, obi, handbag, accessories, and the entire background unchanged.',
  'Use a locked camera with no zoom, no pan, no cut, and no scene change.',
  'Do not add or remove objects. Do not alter hands, feet, clothing, face, or background. No dialogue.',
].join(' ');

const response = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': key,
  },
  body: JSON.stringify({
    model: MODEL,
    input: [
      { type: 'image', data: image.toString('base64'), mime_type: mimeType },
      { type: 'text', text: prompt },
    ],
    response_format: {
      type: 'video',
      aspect_ratio: '9:16',
      delivery: 'uri',
    },
    generation_config: {
      video_config: {
        task: 'image_to_video',
      },
    },
  }),
  signal: AbortSignal.timeout(Number(process.env.JAPANO_GEMINI_VIDEO_TIMEOUT_MS || 600_000)),
});

const body = await response.json().catch(() => ({}));
if (!response.ok) {
  const detail = body?.error?.message || body?.message || `HTTP ${response.status}`;
  throw new Error(`Gemini video request failed: ${detail}`);
}

function findVideo(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.type === 'video' && (value.data || value.uri)) return value;
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findVideo(item);
        if (found) return found;
      }
    } else {
      const found = findVideo(child);
      if (found) return found;
    }
  }
  return null;
}

const video = findVideo(body);
if (!video) {
  const status = body?.status || 'unknown';
  throw new Error(`Gemini không trả video (interaction status: ${status}).`);
}

let videoBytes;
if (video.data) {
  videoBytes = Buffer.from(video.data, 'base64');
} else {
  const downloadResponse = await fetch(video.uri, {
    headers: { 'x-goog-api-key': key },
    redirect: 'follow',
    signal: AbortSignal.timeout(180_000),
  });
  if (!downloadResponse.ok) {
    throw new Error(`Không tải được video Gemini: HTTP ${downloadResponse.status}.`);
  }
  videoBytes = Buffer.from(await downloadResponse.arrayBuffer());
}

if (videoBytes.length < 10_000) {
  throw new Error(`Gemini trả video quá nhỏ (${videoBytes.length} byte).`);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, videoBytes);
console.log(JSON.stringify({
  ok: true,
  model: MODEL,
  interactionId: body.id || null,
  status: body.status || null,
  output: outputPath,
  bytes: videoBytes.length,
}, null, 2));
