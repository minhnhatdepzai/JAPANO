# Evidence: System Architecture

Status: synthesized from direct verification of `backend/server.js`, `mobile/app/_layout.tsx`, `mobile/app/(tabs)/_layout.tsx`, `README.md`'s architecture diagram (cross-checked against source, not trusted blindly), and the backend/mobile research passes recorded in `api-inventory.md` and `feature-inventory.md`.

## 1. Deployment topology

JAPANO is an npm workspaces monorepo (`package.json:5-8`: `"workspaces": ["backend", "mobile"]`) with three runtime surfaces sharing one backend process:

```
mobile/  (Expo Router, TypeScript)  ──┐
                                       ├──▶  backend/server.js (Express, port 4100)
admin/   (static HTML/CSS/vanilla JS) ─┘            │
                                                      ├──▶ backend/data/db.json (JSON file, primary store)
                                                      ├──▶ MongoDB (optional single-document mirror)
                                                      ├──▶ Cloudinary (optional media storage)
                                                      ├──▶ Stripe Test Mode / VNPay Sandbox
                                                      └──▶ local Python AI microservices (FASHN, motion, CatVTON, embeddings) + Ollama
```

- The Express app serves **three things from one process on one port (4100)**: the JSON REST API under `/api/*`, the static admin panel under `/admin` (and a `/` → `/admin/` redirect, `server.js:280`), and static product/media assets under `/assets/*` (`server.js:230-231, 270-271`).
- The mobile app is a single Expo/React Native codebase (`mobile/`) that runs on Android, iOS, and web from the same source (`README.md:5-9` badges; `npm --workspace mobile run android|ios|web` scripts).
- The admin panel (`admin/index.html` + `admin/js/*.js`) has no build step — plain JS loaded directly by the browser, served as static files by the same Express process it talks to.

## 2. Backend request architecture (`backend/server.js`)

- **Entry order** (`server.js:5`): `require('./instrument')` first — loads `dotenv` and conditionally initializes Sentry, required to run before anything else so Sentry can auto-instrument Express/HTTP.
- **Middleware chain, in registration order** (`server.js:186-275`):
  1. `cors()`
  2. `helmet({contentSecurityPolicy:false})` — CSP explicitly disabled with an inline comment explaining why (admin's un-audited dynamic `innerHTML`); other helmet headers remain active.
  3. `pinoHttp` structured request logging (health-check polling excluded from noise).
  4. `POST /api/stripe/webhook` mounted directly on `app` (not the `/api` router), using `express.raw()` so the raw byte body is available for Stripe signature verification — registered **before** the JSON body parser.
  5. `express.json({limit:'120mb'})` — large limit because several endpoints accept base64 images/video in the JSON body.
  6. Static `/assets/products`.
  7. `express.Router()` for `/api`, with a stricter rate limiter scoped to `/api/auth/*` only.
  8. All 17 route modules mounted via the shared dependency-injection `ctx` object (see §3).
  9. A general rate limiter wraps the whole `/api` router.
  10. Static `/assets`, static `/admin`, then `GET /` → redirect to `/admin/`.
  11. Sentry error handler (conditional) + a catch-all JSON error middleware that never leaks stack traces, plus `unhandledRejection`/`uncaughtException` guards.
- **Boot sequence** (`server.js:299-326`): `hydrateFromMongoIfNewer()` → run idempotent data migrations (Flagcard backfill, VIP reconciliation, admin-account seeding) → `app.listen(PORT)`.

## 3. Dependency-injection pattern across route modules

Every file under `backend/routes/` follows the identical shape:
```js
module.exports = function registerXRoutes(api, ctx) { /* api.get/post/... */ };
```
All 17 route files receive the **same `ctx` instance**, built once in `server.js:157-178`, aggregating: `read/write/update` (the JSON store's primitives), `httpError`, auth middleware (`requireAuth`, `optionalAuth`, `requireAdmin`, `requireSuperAdmin`, `requireStaff`), Cloudinary/Mongo/Stripe/VNPay helpers, VIP/Flagcard helpers, analytics builders, the Vietnam address dataset, and push-notification senders (the latter two, `ctx.sendPushToUser`/`ctx.sendPushToAll`, are attached after the fact via factory functions because they need `ctx.read` to already exist). This is the architecture's central seam: no route file talks to the filesystem, Mongo, Stripe, or Cloudinary directly — everything flows through `ctx`, making the persistence/payment/media layers swappable in principle without touching route logic.

Cross-route code reuse follows the same pattern one level down: `routes/payments.js` and `routes/returns.js` both `require('./paymentsStripe')`/`require('./paymentsVnpay')` directly to reuse `makeStripeHelpers`/`makeVnpayHelpers`, which in turn `require('./orders')` for `makeCreateOrderInState` — so order creation, whether via COD, Stripe, or VNPay, runs through one shared function, not three parallel implementations.

## 4. Mobile navigation architecture (`mobile/app/_layout.tsx`, `mobile/app/(tabs)/_layout.tsx`)

- File-based routing via `expo-router ~3.5.23`. Provider nesting in the root layout (`_layout.tsx:82-126`): `SafeAreaProvider` → `AuthProvider` → `ShopProvider` → `StoreProvider` → `CatalogProvider` → `BotChatProvider` → `Stack`.
- Two always-mounted, invisible logic components sit alongside the `Stack`:
  - **`AuthGate`** (`_layout.tsx:31-45`) — redirects unauthenticated users to `/login` for any route not in an explicit guest allow-list (`index`, `onboarding`, `login`, `register`, `forgot-password`, `culture`, `product/*`, `category/*`, plus the Home and Products tabs). This is the mechanism behind the "browse without an account, but must log in to buy/wishlist/chat/try-on" policy.
  - **`PushNotificationRouter`** (`_layout.tsx:57-72`) — routes a tapped push notification straight to `/order/[id]` using `data.orderId` from the payload, covering both the cold-start case (`getLastNotificationResponseAsync`) and the already-running-app case (a live listener).
- Two always-mounted UI overlays: `DailyJapanSpot` (global once-per-day modal) and `FloatingCartButton` (persistent cart shortcut).
- The tab bar (`(tabs)/_layout.tsx`) has 4 functional tabs (Home, Products, Wishlist, Me) plus one special center slot (`scan`) that is not a real screen — it is a 3-line redirect stub (`export default function Scan(){return <Redirect href="/camera"/>;}`) that exists only so the tab bar's custom raised FAB button has a route slot to point at; tapping it forwards straight to `/camera`.
- Global state is plain React Context throughout (`lib/auth.tsx`, `lib/store.tsx`, `lib/data.tsx`, `lib/shop.tsx`, `lib/botchat.tsx`) backed by `AsyncStorage`/`expo-secure-store` — there is no Redux/Zustand/MobX and no React Query/SWR; all network access goes through one hand-written client, `lib/api.ts`'s `requestJson()`.

## 5. Client-to-backend connection resolution

`mobile/lib/api.ts`'s `requestJson()` tries a sequence of candidate base URLs per request (env var → Expo dev host → web hostname → Android emulator alias `10.0.2.2` → `localhost` → `127.0.0.1`), with per-request timeout/abort and an auto-attached `Authorization: Bearer` header once a JWT exists. This is why the app can run against a backend reached via `adb reverse`, a LAN IP, or the Android emulator's special host alias without code changes — the resolution order, not a single hardcoded URL, handles it.

## 6. AI/ML service architecture

The backend does not run AI models in-process. It orchestrates a set of independent local services over HTTP, plus two subprocess-invoked Python helpers:

| Service | Port | Role | Node-side caller |
|---|---|---|---|
| `backend/fashn_service.py` | 7862 | FASHN VTON 1.5 (primary try-on) + FLUX.2 Klein-4B (pose repose / accessory refine, sequentially loaded/unloaded to fit one 16GB GPU) | `backend/routes/tryon.js` via `backend/lib/serviceUrls.js` |
| `backend/catvton_service.py` | 7861 | CatVTON diffusion try-on (fallback engine) | `backend/routes/tryon.js` |
| `backend/motion_service.py` | 7864 | One-to-All Animation 1.3B-v2 (Wan2.1-based) image-to-video, 5 motion presets | `backend/routes/tryon.js`'s `/tryon/motion*` handlers |
| `backend/embedding_service.py` | 7865 | Multilingual sentence-transformer for product-text embeddings | `backend/lib/embeddings.js` → `backend/lib/recommend.js` |
| Ollama (external) | 11434 | `qwen2.5:7b` (chat rewrite, moderation, goals coaching), `qwen3-vl:8b` (vision: product photos, selfies) | `backend/lib/productVision.js`, `backend/lib/portraitVision.js`, `backend/lib/reviewModeration.js`, `backend/lib/goals.js` |

Two further Python files are **subprocess-invoked helpers**, not HTTP services: `accessory_pipeline.py` (pose/keypoint detection via a bundled YOLOv8-pose weight file, `backend/models/yolov8n-pose.pt`, spawned by `backend/lib/accessory.js`) and `tryon_preview.py` (Pillow-only dominant-color extraction, spawned by `backend/lib/pillow.js`; its alternate "overlay a product photo onto the user photo" mode is explicitly hard-disabled in source with a message stating only real AI try-on results are accepted — see `security-analysis.md`/`missing-information.md` for the "no fabricated fallback image" principle this enforces).

Every AI integration point has a JSON-blob or CPU-only fallback path so the core commerce flow (browse, cart, checkout, orders) never depends on a GPU or an external model being reachable — confirmed by `README.md:60`: *"Core backend, Admin, recommendation và bot fallback chạy được không cần GPU."* ("Core backend, Admin, recommendation and bot fallback run without needing a GPU.")

## 7. Data flow: request lifecycle example (order creation)

1. Mobile `checkout.tsx` calls `createOrder()`/`createStripePaymentIntent()`/`createVnpayPaymentUrl()` in `lib/api.ts`.
2. Request hits `backend/server.js`'s middleware chain, reaches the appropriate route (`routes/orders.js`, `routes/paymentsStripe.js`, or `routes/paymentsVnpay.js`).
3. All three call the shared `makeCreateOrderInState()` (`routes/orders.js`), which re-derives price/discount/VIP/voucher from the **live catalog and server-side state** — the client-submitted price is never trusted (see `security-analysis.md`).
4. `ctx.update(mutator)` → `backend/lib/store.js`'s `update()`: `read()` the current JSON file, apply the mutation, `write()` atomically (temp file + rename), fire an async best-effort Mongo mirror write.
5. Response returns to the mobile client; a push notification is dispatched via `ctx.sendPushToUser` (Expo Push API).

## Correction vs. the prior fabricated draft

The prior draft's architecture description (`context/AppContext.tsx`, `data/catalog.ts`, `server/index.mjs`) does not correspond to any real file in this repository — see `api-inventory.md`'s and `database-analysis.md`'s correction tables for exhaustive detail. This document describes only file paths and structures independently verified to exist.
