# Evidence: Technology Stack

Status: verified directly from `mobile/package.json`, `backend/package.json`, `mobile/app.json`, and the AI microservice source files. Every version string below is copied verbatim from the relevant `package.json` — none are estimated or taken from the (partially fabricated) prior draft.

## 1. Mobile (`mobile/package.json`)

| Category | Package | Version |
|---|---|---|
| Framework | `expo` | `~51.0.28` |
| | `react` | `18.2.0` |
| | `react-native` | `0.74.5` |
| Routing | `expo-router` | `~3.5.23` |
| Payments | `@stripe/stripe-react-native` | `0.37.2` |
| Storage/session | `@react-native-async-storage/async-storage` | `1.23.1` |
| | `expo-secure-store` | `~13.0.2` |
| Media/files | `expo-av` | `~14.0.7` |
| | `expo-image` | `~1.13.0` |
| | `expo-image-picker` | `~15.1.0` |
| | `expo-document-picker` | `~12.0.2` |
| | `expo-file-system` | `~17.0.1` |
| | `expo-media-library` | `~16.0.5` |
| | `expo-sharing` | `~12.0.1` |
| Notifications/device | `expo-notifications` | `~0.28.19` |
| | `expo-device` | `~6.0.2` |
| UI/graphics | `react-native-svg` | `15.2.0` |
| | `expo-linear-gradient` | `~13.0.2` |
| | `@expo/vector-icons` | `^14.0.2` |
| | `@expo-google-fonts/arimo` | `^0.4.3` |
| Web content | `react-native-webview` | `13.8.6` (used for the VNPay Sandbox checkout page and an embedded YouTube prefecture-intro video) |
| Platform glue | `react-native-safe-area-context` | `4.10.5` |
| | `react-native-screens` | `3.31.1` |
| | `expo-constants`, `expo-linking`, `expo-font`, `expo-splash-screen`, `expo-status-bar` | `~16.0.2`, `~6.3.1`, `~12.0.10`, `~0.27.6`, `~1.12.1` |
| Dev | `typescript` | `~5.3.3` |
| | `@babel/core` | `^7.24.0` |

**Important corrections to note explicitly:**
- **No state-management library** (no Redux/Zustand/MobX/Jotai/Recoil) — global state is plain React Context (`AuthProvider`, `StoreProvider`, `CatalogProvider`, `ShopProvider`, `BotChatProvider`), backed by `AsyncStorage`/`expo-secure-store`.
- **No data-fetching library** (no React Query/SWR/Apollo) — every network call goes through one hand-written client, `mobile/lib/api.ts`'s `requestJson()`.
- **`expo-camera` is NOT a dependency.** There is no live in-app camera preview anywhere. "Camera capture" screens (`app/camera.tsx`, `app/tryon.tsx`) use `expo-image-picker`'s `launchCameraAsync()`, which hands off to the OS's native camera app.
- `mobile/app.json` declares Android permissions `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`; app scheme `japano`; package id `vn.japano.app`.

## 2. Backend (`backend/package.json`)

| Category | Package | Version |
|---|---|---|
| Framework | `express` | `^4.19.2` |
| Auth | `bcryptjs` | `^3.0.3` |
| | `jsonwebtoken` | `^9.0.3` |
| Payments | `stripe` | `^22.3.2` |
| | (VNPay: no SDK package — hand-rolled HMAC signing in `backend/lib/vnpaySign.js`) | — |
| Database driver | `mongodb` | `^7.5.0` (official raw driver — **no `mongoose`** is a dependency) |
| Media | `cloudinary` | `^2.10.0` |
| Mail | `nodemailer` | `^9.0.3` |
| Logging | `pino` | `^10.3.1` |
| | `pino-http` | `^11.0.0` |
| | `pino-pretty` | `^13.1.3` |
| Error tracking | `@sentry/node` | `^10.67.0` |
| Security/HTTP | `helmet` | `^8.3.0` |
| | `express-rate-limit` | `^8.6.0` |
| | `cors` | `^2.8.5` |
| Config | `dotenv` | `^17.4.2` |

**Notes:**
- There is **no `devDependencies` key at all** in `backend/package.json`. Tests run via Node's built-in `node --test` runner (`"test": "node --test"`), not Jest/Mocha/Vitest.
- `"main": "server.js"`, `"type": "commonjs"`.

## 3. Root monorepo (`package.json`)

```json
{
  "name": "japano-monorepo",
  "workspaces": ["backend", "mobile"],
  "engines": { "node": ">=20" }
}
```
npm workspaces, not Lerna/Turborepo/Nx. Root scripts orchestrate both workspaces (`npm run check` = backend tests + mobile typecheck; `npm run dev:android` = `./start-all.sh`; `npm run verify`/`verify:ai` = live smoke tests via `scripts/verify.mjs`).

## 4. Admin panel (`admin/`)

No `package.json` of its own — plain HTML/CSS/vanilla JavaScript with **no build step and no framework dependency**, served as static files by the backend's own Express process (`server.js:274-280`). Structure: `admin/index.html`, `admin/styles.css`, `admin/js/*.js`.

## 5. AI/ML stack (Python microservices, backend root)

These are **not** npm dependencies — they run as separate OS processes the Node backend talks to over HTTP (or via `child_process.spawn` for two non-HTTP helpers). Verified via direct reading of each `.py` file's header/port declaration.

| Service | File | Model/pipeline | Port | GPU |
|---|---|---|---|---|
| Try-on (primary) | `backend/fashn_service.py` | FASHN VTON 1.5 + FLUX.2 Klein-4B (pose repose) | 7862 | CUDA, sequential load/unload to fit 16GB VRAM |
| Try-on (fallback) | `backend/catvton_service.py` | CatVTON diffusion model + ControlNet-OpenPose repose | 7861 | CUDA |
| Motion/video | `backend/motion_service.py` | One-to-All Animation 1.3B-v2 (Wan2.1-T2V-1.3B based) | 7864 | CUDA-only, no CPU fallback |
| Semantic embeddings | `backend/embedding_service.py` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (default) | 7865 | CUDA-preferred, CPU fallback |
| Pose/accessory (subprocess) | `backend/accessory_pipeline.py` | YOLOv8-pose (`backend/models/yolov8n-pose.pt`) | — (spawned) | — |
| Color extraction (subprocess) | `backend/tryon_preview.py` | Pillow dominant-color only; naive photo-overlay mode is hard-disabled in source | — (spawned) | — |
| LLM/VLM (external) | Ollama | `qwen2.5:7b` (chat/moderation/coaching text), `qwen3-vl:8b` (vision) | 11434 | Depends on Ollama's own config |

`backend/lib/serviceUrls.js` centralizes all these base URLs with env-var overrides and localhost defaults. Every AI integration point has a documented fallback so core commerce (browse/cart/checkout) never depends on GPU/model availability (`README.md:60`).

## 6. Corrections to the prior fabricated draft

| Prior draft claim | Verified reality |
|---|---|
| Expo SDK 54, React Native 0.81.5, React 19 | Expo `~51.0.28`, React Native `0.74.5`, React `18.2.0` |
| MongoDB + Mongoose as core DB tech | `mongodb` official driver only (optional mirror); zero `mongoose` usage anywhere (see `database-analysis.md`) |
| Node.js/Express/CORS/Multer | Express confirmed; CORS confirmed; **no `multer`** dependency exists — file uploads are base64 JSON, not multipart |
