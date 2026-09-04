# JAPANO project memory

Last updated: 2026-09-04. This is the short source-of-truth index for coding
agents. It contains no credentials and does not replace source code or tests.

## Repository and collaboration

- Monorepo: Expo SDK 51 / React Native 0.74 mobile, Express backend and static
  Web Admin. Current intended branch is `main`; never create or switch branches
  without an explicit request.
- Project-local Claude Code skill `japano-ui-ux-95` coordinates an evidence-first
  audit and improvement loop across Mobile, Storefront and Admin. Its reusable
  prompt is `PROMPT_CLAUDE_UI_UX_95.md`; a 9.5 claim requires runtime screenshots
  and caps unverified mobile/device work at 8.9.
- Concurrent Claude Code work is normal. Preserve dirty files and inspect the
  exact overlapping diff before editing.
- Root `README.md` is the detailed product/setup document. This file records
  current runtime facts, evidence, blockers and the next file to inspect.
- After material work, update this file and update README when externally
  visible behavior, commands, limits or benchmarks changed.

## Runtime map

| Capability | Service / entry point | Default |
|---|---|---|
| Backend + Admin | `japano-backend`, `backend/server.js` | `:4100` |
| Public Admin via Tailscale Serve | backend `/admin/` | `https://rd-system.tail6502ce.ts.net:4101/admin/` |
| Body analysis | `japano-body-analysis`, `backend/body_analysis_service.py` | `:7863`, CPU |
| Virtual try-on | `japano-fashn`, `backend/fashn_service.py` | `:7862`, CUDA on demand |
| Motion | `japano-motion`, `backend/motion_service.py` | CUDA on demand |
| Mobile | Expo Router under `mobile/app` | USB uses `adb reverse`; remote uses configured Tailscale API URL |

Use `./scripts/japano-services.sh status` before changing or restarting service
ownership. Preserve Android app data; use update installs, not uninstall.

## Report, ERD and Compass presentation (2026-09-04)

- Correction from the user: the authoritative thesis source is
  `/home/nhat/Downloads/Thầy Nguyễn Ngọc Chấn_Phát triển ứng dụng thương mại điện tử thời trang JAPANO Store (1).docx`.
  Future work must patch that old document surgically into a separate output;
  never rebuild or replace it with `docs/report/tools/build_report.py`. The
  mistakenly rebuilt repo-root DOCX was moved to desktop trash on 2026-09-04;
  the external source remained unchanged (SHA-256 starts `4636587c`).
- Claude Code handoff artifacts are
  `.claude/skills/japano-thesis-docx-patch/SKILL.md` and
  `PROMPT_CLAUDE_UPDATE_JAPANO_THESIS_ERD19.md`. They require the official
  project-local `docx` skill, preserve all non-target content and validate the
  before/after DOCX structure plus rendered changed pages.
- The thesis report must present exactly the canonical **19-table, 24-relation**
  ERD and only the two approved Use Case diagrams: customer shopping (`D04`)
  and Web Admin (`D05`). Do not reintroduce a physical-collection count or the
  old extra Use Case figures into the generated DOCX.
- Runtime remains MongoDB Atlas. The local Docker service
  `japano-mongodb-compass` exposes `127.0.0.1:27017` only for the presentation;
  database `japano_presentation_19` contains the exact 19 ERD collections.
  `scripts/sync_compass_presentation_erd19.js` is dry-run by default, refuses a
  remote target or a non-empty destination, and sanitizes personal/secret data.
- Fresh mobile evidence was captured from the connected Redmi Note 8 Pro with
  app `vn.japano.app` 1.0.19 (versionCode 20) while the backend health endpoint
  confirmed MongoDB Atlas. Use `docs/report/assets/screens/mobile-2026-09-04/`
  in the report; do not restore the older embedded mobile UI screenshots.

## AI truth and current evidence

- Body analysis uses pose, segmentation, geometry and calibrated regressors.
  A single photo without a scale reference cannot reliably determine absolute
  height/weight/girth. The API must expose insufficient evidence or broad
  uncertainty; manual values override estimates. Never infer a child's adult
  clothing size from an adult garment listing.
- Try-on uses the real FASHN/FLUX path and quality gates. Measurement failure is
  not itself a try-on failure. Do not fall back to pasting a product image over
  the person.
- Motion is inference-tuned, not fine-tuned. Accepted profiles and measurements
  are in `docs/project_evidence/ai_benchmarks/MOTION_INFERENCE_2026-08-29.md`:
  walk about 58 s direct / 65 s through backend, turn about 71 s and pose about
  66 s on the local RTX 5060 Ti 16 GB. Resolution remains 384 x 640.
- Chatbot and wellness/goal responses must be grounded in live catalog/user
  inputs and deterministic safety/business rules. LLM rewriting may improve
  language but must not invent inventory, prices, body facts or medical advice.
- The 2026-08-29 body/try-on smoke test returned a real image in 37.865 s; a
  forced pose-transfer case returned in 61.893 s with an identity warning. See
  `docs/project_evidence/ai_benchmarks/TRYON_CHAT_GOALS_2026-08-29.md`.
- Two-piece swimwear no longer uses FASHN `one-pieces`: the approved catalog
  reference is split into one top and one bottom, then FLUX.2 edits both in one
  multi-reference pass. A real full-API smoke returned 1152 x 1536 in 58.066 s
  after the image-analysis adult check had populated the 10-minute fingerprint
  cache; identity/structure and coverage gates passed with no warning. Evidence:
  `docs/project_evidence/ai_benchmarks/BRAND_CINEMATIC_SWIMWEAR_2026-08-29.md`.
- A later OPPO request exposed a post-inference coverage regression: FLUX had
  produced the two-piece image, but the checker reused clean-image pose boxes
  and a full-zone threshold. Coverage now detects pose separately for clean and
  result images and uses a fail-closed protected core for minimal swimwear. Real
  cold-cache API smoke returned HTTP 200 in about 73 s with zero coverage
  reasons/warnings; exposed protected-core tests still block. Backend-only fix,
  so no APK reinstall is required. Post-fix OPPO tap remains unverified.
- Five adult try-on presets live in `mobile/assets/tryon-presets/` (768x1152 JPEG).
  The client sends only `presetId`; the server loads its own file and verifies
  SHA-256 against the manifest in `backend/lib/tryonPresets.js` before treating
  the request as approved adult imagery. That hash check is what the `adult:true`
  flag hangs on, so never bypass it and never accept a client-supplied image on
  the preset path. Measured 5x7 matrix: 7/7 real images, 27.3-67.1 s cold.
- Try-on results are cached on disk under `backend/data/tryon-cache/` for
  **presets only** — a customer photo is personal data and is never written. A
  cache hit returns in about 27 ms versus 40.8 s uncached, byte-identical.
  Results carrying a quality or identity warning are never cached. Bump
  `PIPELINE_VERSION` in `backend/lib/tryonCache.js` whenever the generation
  pipeline changes, or old images will mask the change.
- `POST /api/japan-spots/scene-photo` composites the person onto a real photo of
  the place using U2Net segmentation — no GPU and no generative model, so face
  and body survive pixel-for-pixel. Measured 912 ms (preset) and 1 195 ms (a
  try-on result). The client sends only a place name; the URL is resolved by
  `backend/lib/japanSceneBackgrounds.js` and fetching is restricted to HTTPS on
  `upload.wikimedia.org`. Accepting a client URL here would be an SSRF hole.
- Japan spots currently contain 35 entries in `mobile/lib/japanSpots.ts`; the
  backend table must stay in step and `backend/test/japan-scene.test.js`
  compares the two files directly.
- Population calibration used to move `valueKg` without moving
  `uncertaintyMin/MaxKg` or `displayBinKg`, producing a 79.4 kg estimate labelled
  "50-60 kg" with an interval that excluded its own point estimate. Fixed, with
  `backend/test/python/test_weight_calibration_consistency.py` guarding it.
- Chat dataset/license decisions are recorded in
  `backend/ai_training/chatbot_dataset/provenance/`. No external chatbot data
  has been copied into production and no chatbot/wellness checkpoint exists.
- Never claim a model was fine-tuned without a licensed dataset manifest,
  training log, saved adapter/checkpoint hash, reload test and disjoint eval.

## Travel try-on scenes (2026-08-29)

- A background is only usable if a person can physically stand in it.
  `backend/lib/japanScenes.js` carries per-scene `footAnchor`, `groundPolygon`,
  `personHeightRatio`, `safeZone`, `landmarkAvoidRects`, light direction and
  shadow settings. A shared "centre, bottom of frame" position is wrong for
  almost every real photograph — the old Naoshima shot was taken from a boat, so
  it put the model waist-deep in the sea.
- Scene metadata is measured on the **source image**, but the output frame is
  portrait and scenery is usually landscape. `_cover()` therefore crops **around
  the foot anchor** and maps the anchor into frame coordinates. Cropping centre
  first silently moves the ground out from under the person; that bug placed a
  model standing on a traffic cone.
- Licence and resolution do not make a scene usable. Three of six well-licensed,
  high-resolution candidates were rejected on composition alone. Always run
  `node scripts/validate_japan_scenes.js`.
- Scene images are downloaded into `mobile/assets/japan-scenes/` rather than
  hotlinked: Wikimedia only serves thumbnail widths it has already rendered
  (1800px returns HTTP 400 while 1920px succeeds), and serving our own copy means
  compositing makes no outbound request at all.
- `GET /api/japan-spots/recommendations` scores the live catalog with
  deterministic rules — no LLM, 8 ms cold and 25 ms cached, RAM cache with TTL and
  a bounded size. `sizeFromBody()` thresholds must stay identical to
  `localSize()` in `mobile/app/tryon.tsx`, including the 4XL/5XL tiers; they
  diverged once and the two screens reported different sizes for the same person.
- Swimwear is filtered by spot: never at a `modest` spot (shrine, temple,
  memorial), and at a beach spot only when the request passed the adult gate.
- No MongoDB collection was added for scenes, recommendations or composites.

## Travel pose, dataset and app parity (2026-09-01)

- Storefront and Expo app now consume the same scene contract:
  `recommendedPoseId`, four `poseOptions`, and curated `personSlots`. Both send
  `travelPoseId` to `/api/tryon` and `slotId` to scene composition. Changing a
  pose invalidates the GPU result; changing only a slot preserves the try-on
  result and requires only the CPU scene-compose retry.
- The compositor checks the lowest real silhouette contact footprint after the
  final cover/crop transform. Any contact outside the curated ground polygon is
  `UNSAFE_SCENE_PLACEMENT`; uncurated scenes are rejected. The strengthened
  validator passes 36/36 scenes covering all 35 displayed places and 38 curated
  person slots. OPPO logs on 2026-09-01 proved repeated 422s at Arashiyama,
  Itsukushima and Ginzan were independent of the person image: those places had
  catalog backgrounds but no curated scene. Every displayed place now resolves
  to a local licensed image, ground polygon and safe default slot. A real prior
  try-on result passed all 38 slots with `groundSafe:true`; the legacy payload
  matrix through `https://rd-system.tail6502ce.ts.net:4101` passed 35/35 with
  HTTP 200, real contact points and no failure. The mobile error branch preserves
  the backend reason instead of replacing every scene failure with generic copy.
- Data-source truth is in
  `backend/ai_training/provenance/tryon_sources.manifest.json`; run
  `python3 backend/ai_training/audit_tryon_sources.py`. Local VITON-HD is intact
  at 11,647 train / 2,032 test pairs but remains non-commercial and upper-body
  studio-biased. StreetTryOn/DeepFashion2 and Dress Code require official
  access; FIT-VTO 100K is CC-BY-NC-ND and is not approved for adapter training.
- Real A/B on RTX 5060 Ti used the same preset, Yukata and `three-quarter` pose:
  balanced-20steps 54.83 s vs high-25steps 54.57 s, both with no quality warning,
  SSIM 0.992 and mean absolute pixel difference 0.74/255. More steps did not
  visibly improve this sample. The phone now requests the separately validated
  `fast` preview (16 steps, 1280-pixel long edge); a warm, uncached single-garment
  API smoke on 2026-09-03 completed in 22.835 s without a coverage warning.
- Try-on latency regression fixed on 2026-09-02: when FLUX fit-refine evicted
  FASHN, `runGpuJob()` synchronously warmed FASHN again before resolving the
  already-finished image. Same-focus try-on now returns immediately after its
  quality gate and schedules FASHN warmup in the serialized transition chain;
  real generation settings and quality gates are unchanged.
- Mobile TypeScript passes. OPPO A78 is online through Tailscale at
  `100.79.192.97`, but ADB `:5555` refuses the connection, so the new controls
  have not yet been visibly verified on that phone.

## Current user-facing work

- Verified-purchase reviews are scoped to each completed order and product: a
  later completed repurchase unlocks another review, while the same order stays
  limited to one. Legacy reviews without `orderId` consume the oldest matching
  purchase slot. Regression coverage is in
  `backend/test/reviews-repeat-purchase.test.js`; the complete backend suite
  passed 358/358, mobile TypeScript passed, and the restarted live API returned
  the new per-order eligibility fields.

- Brand splash assets live in `mobile/assets/brand/`. `BrandSplash.tsx` animates
  the exact JAPANO monogram, staggered JAPANO letters, falling sakura, an adult
  woman with wagasa, and the final tagline `QUẦN ÁO NHẬT BẢN`. Native splash is
  configured in `mobile/app.json`.
- Android launcher/adaptive icons now use `japano-app-icon.png` and
  `japano-adaptive-foreground.png`. `BrandLogo` falls back to the bundled JAPANO
  monogram when `/api/shop` has no logo. Product browsing uses native-driver
  poster/scroll transforms and honors Reduce Motion.
- The 2026-08-29 premium UI pass gives the mobile home an editorial journey
  hero, a first-screen JAPANO AI Studio, neutral product cards, compact AI reason
  chips and a clearer floating try-on tab. Web Admin has a responsive two-column
  secure login and an authenticated command-centre header. Desktop and 390x844
  login layouts were visually checked; the authenticated dashboard was syntax
  checked but not visually authenticated because no current admin credential was
  available. No API or role boundary changed.
- Mobile session restoration is optimistic from the locally cached user plus the
  SecureStore token, while `/api/auth/me` still validates in the background and
  clears a revoked session. On the attached Redmi this removed the network-bound
  blank interval: the cold-launch home was visible at the 5-second capture rather
  than around 15 seconds.
- The follow-up 9.5 UI pass shortens the branded animation from a 4.1 s hard stop
  to 2.65 s, keeps the Japanese scene visible throughout startup, gives product
  names two stable lines, replaces technical ranking prose with customer-facing
  copy, enlarges favourite targets, and makes recommendation skeletons exactly
  the same 281 px height as loaded cards. A 9 s Redmi screen recording showed
  launcher -> branded background -> monogram splash -> home without the old
  white interval; home content appeared roughly 3-4 s after launch. Product tab,
  grid scroll and accessibility labels were visually/UI-tree checked on Redmi.
  Admin navigation now supports Enter/Space, exposes `aria-current`, live status
  and busy states, and uses a command-centre-shaped dashboard skeleton to avoid
  post-login layout shift.
- The 2026-08-30 app polish makes the product catalog denser without becoming
  cramped: filters collapse behind a labelled control, product count and sort
  stay visible, and the first product row appears above the fold. Product detail
  exposes a real Share action, replaces engine-oriented copy with customer
  language and keeps only two sticky primary actions: `Thử trên ảnh` and
  `Thêm vào giỏ`. Try-on now shows a three-step journey, a shorter product
  preview, icon-labelled camera/gallery actions and optional manual measurements
  collapsed by default. Catalog, product detail and try-on were visually checked
  in the running native app on the attached Redmi Note 8 Pro.
- Web Admin now has consistent Vietnamese login/dashboard language, corrected
  contrast tokens, labelled form controls and switches, focus-safe auth gating,
  keyboard-scrollable data tables, a non-clipped 390 px header and an accessible
  forgot/reset-password flow backed by the existing auth endpoints. Login and
  the authenticated dashboard were checked at desktop and 390x844. All 16 Admin
  routes returned zero axe WCAG 2/2.1 A/AA violations with Reduce Motion. The
  authenticated visual audit used a short-lived local QA token plus a mocked
  `/auth/me` identity only; the configured admin password still returns 401 and
  was deliberately not reset. The recovery contract was browser-tested with a
  mocked response; no email or password mutation was performed.
- Product management in Web Admin no longer exposes permanent deletion. The
  row action only toggles `published`/`hidden`, explains that hidden products
  can be restored, and keeps the row in Admin. For defense in depth, legacy
  `DELETE /api/products/:id` now performs the same soft-hide instead of removing
  the database record, preserving orders, analytics and wishlist references.
  Product lifecycle tests pass 3/3; the related catalog set passes 12/12 and the
  full backend suite passes 345/345. A mocked authenticated browser check
  confirmed 0 delete buttons, one hide PUT, no DELETE request, the row retained
  and the status changed to `Đã ẩn`.
- Storefront `web/` is a separate React 19/vinext project, not Expo Web or Web
  Admin. On 2026-08-30 its existing dev process was verified at
  `http://127.0.0.1:4200`: home, `/san-pham` and `/thu-do` returned 200; desktop
  1440 px and mobile 390 px rendered without console or failed-response errors;
  TypeScript and 7/7 unit tests passed. A transient user service forwards the
  Tailscale address `http://100.69.188.16:4200` to localhost for the current
  session. Permanent HTTPS Serve was not configured because `tailscale serve`
  requires sudo on this host; the current forward can disappear after
  logout/reboot.
- Storefront product cards now hide the primary image on hover only when a real
  secondary image exists. Single-image products keep their image visible while
  quick actions appear; Chromium verified the affected Hōmongi card at desktop
  width with no console/page errors, and storefront typecheck, lint, 7 unit
  tests and production build passed.
- The `/cua-hang` panel lazy-loads the user-supplied Google Maps Embed for
  Trường Cao đẳng FPT Polytechnic after explicit interaction, replacing the
  unconfigured MapLibre runtime path. Chromium received HTTP 200 from the embed
  and rendered it without console/page errors; list filtering and the existing
  coordinate-based directions link remain unchanged.
- Storefront hero and AI split now use locally hosted, realistic Pexels footage:
  falling sakura petals (3.42 MB MP4) and a Fuji timelapse composited with a
  real flying flock (1.11 MB MP4), each with a WebP poster. Videos pause outside
  the viewport or in a hidden tab; Reduce Motion, Data Saver and playback errors
  keep the static poster. The home store section renders the exact supplied
  Google Maps Embed instead of the old coordinate artwork.
- React Bits adaptations are intentionally scoped: storefront uses FadeContent
  for four editorial sections and SpotlightCard for three trust cards; mobile
  uses a native-driver FadeContent only for the home hero and AI Studio; Admin
  uses SpotlightCard only on actionable KPI cards and ShinyText on the ready
  status. All three honor Reduce Motion, and cart, checkout, payment, login and
  try-on result flows were left unchanged. Source/license notices are in
  `THIRD_PARTY_NOTICES.md`.
- Body/try-on false rejection is fixed for pose-transfer cases: strict pixel
  identity becomes an explicit warning only when pose transfer is required;
  ordinary poses stay strict. Missing measurements no longer imply try-on
  failure.
- Chatbot handles generic/no-accent commerce queries, live price/size and
  conversational product references. Unhelpful Ollama rewrites fall back to the
  grounded draft. Health coaching is no longer stored as a product/fund goal.
- The try-on and Japan-scene screens no longer expose the five preset people.
  A customer selects only their own image; `backend/lib/bodyAnchors.js` matches
  its normalized geometry against five hidden reference profiles and uses the
  nearest range only as a size prior when direct evidence is missing. The API
  never returns an anchor id/image path and never presents its midpoint as a
  measured body fact. Real/user measurements still win. A shared in-flight
  promise prevents a rapid Analyze/Create sequence from running body analysis
  twice. The product page still has a "Mặc bộ này ở đâu trên đất Nhật" section
  fed by `spotsForProduct()`; spot detail has a "Đưa mình tới đây" composite box.
- App try-on requests the `fast` FASHN preview profile: 16 diffusion steps and a
  1280-pixel long edge. It starts the GPU focus/warmup in parallel with the CPU
  body analysis instead of waiting for analysis to finish first. Optional FLUX
  fidelity is skipped for ordinary garments;
  structure-critical outerwear such as long Haori still keeps it because the
  37.6 s no-fidelity experiment visibly shortened/mis-shaped the garment. That
  accepted Haori path measured about 75 s. Do not claim a universal sub-minute
  time. This is inference optimization, not model fine-tuning; `/health` still
  reports no configured/loaded fit LoRA or checkpoint hash.
- Redmi validation on 2026-09-03 measured why a normal try-on exceeded one
  minute: a mild fit delta (`severity=0.39`) caused a second full FLUX pass; the
  backend request took 65.544 s and observed UI waits reached 117–161 s because
  mobile also waited indefinitely for CPU body analysis. `qualityMode=fast` now
  waits at most 4.5 s for that analysis, sends `skipBodyAnalysis=true`, and
  guarantees one VTON pass unless the caller explicitly asks for
  `fitEffect=true`. A real library-uploaded photo then returned HTTP 200 in
  23.576 s; an earlier optimized sample measured 19.918 s. FASHN plus final
  quality/safety checks remain active. During device testing Android moved
  through Home, Settings and Camera without `GPU_JOB_CANCELLED`. `useGpuFocus`
  defers a conflicting focus signal until the in-flight job ends, then releases
  GPU normally. This is inference policy, not fine-tuning.
- Mobile TryOn no longer fetches or displays quick sample people. The only
  inputs are Camera and the device image library. Loading UI spends its first
  five seconds on "Đang kiểm tra ảnh", then starts a separately labelled AI
  elapsed clock at zero. The clock is based on wall time so it catches up after
  Android suspends JS timers in the background. Color, size and per-variant
  stock are visible, and adding an accessory to an existing result continues
  from that result instead of rerunning the outfit.
- Mobile catalog keeps its last good server response, reloads whenever the app
  becomes active and retries every 12 s only while offline. A transient backend
  restart therefore no longer strands TryOn on bundled products without real
  variants. Direct Redmi validation showed S/M sold out, L with one unit for
  the Sumi kimono, and the Shu color with 56 total units.
- Local motion was restarted and verified directly on Redmi: One-to-All 1.3B
  reported `modelReady=true`, `/api/tryon/motion` completed in 70.186 s, and
  cropped frames two seconds apart had different hashes. This proves playback,
  not visual identity preservation or a fast video profile.
- The 2026-09-03 full gates passed with 429 Node tests, mobile TypeScript and 110
  Python tests (108 passed, 2 configured skips). Body analysis of a non-preset
  test image returned in
  415 ms with 10-unit display ranges and size M. The hidden reference metadata
  did not leak an id, filename or image URL.
- The 2026-08-30 UI handoff reran the same full gate: 342/342 Node tests,
  TypeScript typecheck and 102 Python tests completed (100 passed, 2 configured skips).
  No new try-on image or motion video was generated during this UI-only pass, so
  GPU output quality/timing was not re-benchmarked.
- The only ERD is `JAPANO_ERD.drawio`: one app-level page, 18 selected logical
  collections and 23 references. Every connector is now anchored to the exact
  source FK row and target logical `id` PK row; its validator rejects any
  table-level or wrong-row endpoint. Table, row and edge strokes are uniformly
  `#222222` at 1.2 px; only table names and logical PKs are bold. MongoDB `_id`
  remains the physical key and references are application-enforced. A read-only
  Atlas integrity audit found three stale `mobile/tryon` interactions whose
  `userId` no longer resolves; no live data was changed.
- Current Android release `1.0.19` uses `versionCode 20`, package
  `vn.japano.app`, targetSdk 34. Install it over the prior APK (`adb install -r`
  or normal Android update), never uninstall-first, so app data is preserved.
  The current local release APK is 123,415,060 bytes with SHA-256
  `df09926faa955370c6557d26ea53d95c24b304a3213aa3551d1c7f9dbcf98085`.
  Build with JDK 17 and update-install both passed. Version metadata and
  `lastUpdateTime=2026-09-03 22:36:33` were verified on USB-connected Redmi Note
  8 Pro `ylbilfx8ors475kf`; its TryOn UI and real request/background flow were
  checked as described above. OPPO was not connected and was not changed.
- Release builds need JDK 17. The JDK 21 install on this machine has no `jlink`,
  so Gradle fails in `androidJdkImage`. Use
  `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew assembleRelease`.

## Web storefront (2026-08-30)

- Live checks on 2026-09-03 confirmed backend MongoDB database `japano`; direct
  backend `/api/products` and Storefront BFF `/api/products` were byte-identical
  (70 products, SHA-256
  `1c3a617d9107eaef7ad429e73938d84bca7e1f1a1accc98cdf388d0482faa599`).
  Mobile JWT and Storefront HttpOnly-session JWT resolve the same normalized
  email to the same backend user id, so catalog, user identity and orders are
  shared. Cross-device cart/wishlist parity is not complete: Mobile caches cart
  per user in AsyncStorage and syncs it to the backend, whereas Storefront keeps
  both collections in browser localStorage and only merges a non-empty guest
  cart at login. Use the backend as source of truth before claiming full data
  synchronization.

- `web/` là **website độc lập**, không phải Expo Web. React 19 + App Router qua
  `vinext`, TypeScript strict, TanStack Query, Zod, React Hook Form, Motion for
  React và Google Maps Embed. Nó **không** nằm trong npm workspaces gốc và có
  `package.json`/`package-lock.json`/`node_modules` riêng. Chạy bằng
  `npm --prefix web run <script>`. Không import bất kỳ tệp nào của `mobile/`.
- Backend mặc định là `https://rd-system.tail6502ce.ts.net:4101` ở
  `web/.env.example`, `web/wrangler.jsonc`, `web/lib/server-api.ts`,
  `web/app/api/[...path]/route.ts` và `web/app/media/[...path]/route.ts`.
  Không đổi về `127.0.0.1:4100`. Cổng `:4101` là tailnet-only.
- Trình duyệt chỉ gọi same-origin `/api` và `/media`. JWT bị BFF tách khỏi body
  và đặt vào cookie `japano_session` HttpOnly/SameSite=Lax. Mutation kiểm tra
  Origin (cross-site → 403). `admin`, `state`, `seed`, `reset`, `analytics`,
  `users`, `payments` bị chặn ở BFF (404).
- `backend/routes/asyncAiJobs.js` cung cấp hàng đợi AI bất đồng bộ cho web:
  `POST/GET/DELETE` cho `/api/tryon/jobs`, `/api/tryon/motion/jobs`,
  `/api/japan-spots/scene-photo/jobs`. Chỉ RAM + TTL, không collection MongoDB,
  ảnh đầu vào bị xoá khi job kết thúc, DELETE abort được request. Endpoint đồng
  bộ cũ giữ nguyên cho app.
- **Bẫy dữ liệu biến thể:** catalog có hai thế hệ. Nhóm cũ dùng
  `colorName`/`colorHex`/`sku`; 36 sản phẩm `jp*` chỉ có `color`/`id`. Render
  thẳng thì key React là `undefined` (cảnh báo trùng key) và nhãn hiện
  "Màu undefined". `web/lib/product.ts` chuẩn hoá tại biên — dùng
  `sellableVariants()`/`uniqueColors()`/`uniqueSizes()`, đừng đọc
  `product.variants` thô trong component.
- **Rate limit `/api/auth/*` đã được thu hẹp (2026-08-30).** Trước đây
  `api.use('/auth', authLimiter)` áp bộ đếm chống brute-force 20 lần/15 phút lên
  cả `/auth/me` và `/auth/providers`. `/auth/me` bị 429 rơi vào nhánh `catch`
  của `mobile/lib/auth.tsx`, nhánh này **xoá token trong SecureStore** — tức là
  đăng xuất oan người dùng thật khi nhiều thiết bị dùng chung một IP. Giờ chỉ
  `login`, `register`, `google`, `forgot-password`, `reset-password` bị siết;
  hai route đọc kia nằm dưới giới hạn API chung 600 lần/5 phút. Không có hợp
  đồng API nào thay đổi.
- Logo: ảnh `japano-logo-transparent.png` là ảnh vuông 1254 px gồm cả wordmark,
  thu về chiều cao header thì chữ chỉ còn vài pixel. Header dùng
  `japano-monogram.png` cộng wordmark đánh máy. Link thương hiệu **không đặt
  `aria-label`** — WCAG 2.5.3 đòi tên khả truy cập chứa đúng chữ nhìn thấy, mà
  dòng phụ bị ẩn dưới 640 px nên tên rút ngắn theo.
- Ảnh Wikimedia của địa điểm Nhật đi qua `/media/wikimedia/<path>`: host đích
  ghi cứng trong route nên không mở SSRF, đồng thời bỏ cookie bên thứ ba
  `WMF-Uniq` và cho ta kiểm soát cache. Attribution vẫn hiển thị nguyên vẹn.
- Kết quả đo 2026-08-30 trên bản build production chạy bằng workerd:
  Lighthouse desktop 5 trang — performance 93-99, accessibility 100,
  best-practices 100, SEO 100; LCP 1.0-1.7 s, CLS ≤ 0.038, TBT 0 ms.
  Playwright 30/30 pass trên hai project (`mobile-390`, `desktop-1440`).
  Smoke AI thật 4/4 pass: try-on 641 KB PNG 1152x1536 trong 57,9 s
  (`fashn-vton-1.5+balanced-20steps`), motion 438 KB MP4 mở được, ghép cảnh
  399 KB JPEG kèm attribution Wikimedia, và DELETE huỷ được job đang chạy.
- Motion storefront 2026-08-30: `web/components/cinematic-motion.tsx` dùng
  GSAP 3.15 cho click ink, route brush, cart flight/badge và order-success;
  hero dùng video sakura cục bộ và AI split dùng video Fuji + chim cục bộ qua
  `cinematic-background-video.tsx`. Wrapper giới hạn autoplay ở phần đang nhìn,
  dừng khi tab ẩn và chuyển sang poster khi Reduce Motion/Data Saver hoặc lỗi.
  Three.js và `@types/three` đã được gỡ khỏi dependency. Cart drawer chờ tối đa
  460 ms; xác nhận đơn chỉ chạy sau khi backend tạo COD thành công.
- Validation sau footage/React Bits: Admin JavaScript syntax sạch; mobile
  TypeScript sạch nhưng không có thiết bị trong `adb devices`, nên chưa có xác
  minh app trực quan. Storefront ESLint/TypeScript/Vitest 7/7/build pass; bộ E2E
  tập trung footage, React Bits, bản đồ và Reduce Motion đạt 5 pass + 1 mobile
  skip có chủ đích. Full dev E2E đạt 29 pass + 1 skip; hai PDP case dừng vì cảnh
  báo preload `as` của Vinext dev. Full workerd production còn lộ hydration
  React #418 ở các trang client sau điều hướng; đây là giới hạn chưa xử lý, còn
  các case motion/map/reduced-motion vẫn pass. Browser desktop xác nhận hai MP4
  thực sự tăng `currentTime`, ba SpotlightCard phản hồi con trỏ, cart-flight,
  drawer/count, order overlay và route brush.
  Lighthouse production `/`: Performance 94, Accessibility/Best Practices/SEO
  100, FCP 0,8 s, LCP 1,5 s, TBT 10 ms, CLS 0,003. Điểm tối ưu tiếp theo là
  thumbnail AVIF/WebP: audit ước tính image-delivery còn tiết kiệm được ~1,8 MB.
- Chưa xác minh: Cloudflare deploy thật (máy chưa `wrangler login` và origin
  tailnet-only không public — chỉ build + `--dry-run` chạy được), đăng nhập
  Google thật trên web (thiếu `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`), và một giao
  dịch Stripe/VNPay hoàn chỉnh từ website.

## UI/UX audit gate (2026-09-02)

- Chạy theo skill `japano-ui-ux-95`. Báo cáo đầy đủ:
  `docs/project_evidence/ui_ux/UI_UX_AUDIT_2026-09-02.md`; 152 ảnh before/after ở
  `test-results/ui-ux/2026-09-02/`.
- Điểm có bằng chứng chạy thật: **Storefront 9.5 (đạt cổng)**, **Admin 9.38
  (chưa đạt)**, **App Expo không chấm** — không có OPPO A78 cắm máy và không có
  AVD nào; dựng emulator bị cấm vì từng làm sập phiên remote desktop.
- Sau khi sửa: axe WCAG 2.0/2.1 A+AA = **0 vi phạm trên 62 tổ hợp tuyến×khung
  nhìn**, 0 tràn ngang ở 390/720/1440px, reflow 200% đạt, vùng chạm ≥24px đã
  hit-test, skip link + `<main>` đã thêm cho Admin.
- **Bẫy khi dựng thực thể backend tách biệt:** `backend/instrument.js` gọi
  `dotenv.config()`, mà dotenv KHÔNG ghi đè biến môi trường đã tồn tại. `unset
  MONGODB_URI` là sai — biến hết tồn tại nên dotenv tiêm lại giá trị Atlas thật.
  Phải đặt `MONGODB_URI=""` (tồn tại nhưng rỗng). Lần làm sai đã tạo nhầm một
  tài khoản `super_admin` trong Atlas thật; đã xoá và xác minh lại (38 user).
  Khởi động đúng sẽ in `injected env (0)` và trỏ `Dữ liệu` vào tệp JSON cục bộ.
- Nguyên nhân gốc của tràn ngang trong Admin là `1fr` = `minmax(auto,1fr)`: rãnh
  grid không co xuống dưới min-content. Dùng `minmax(0,1fr)` cho các quy tắc gộp
  cột, `minmax(min(210px,100%),1fr)` cho `.g-auto`.
- Đo focus bằng `element.focus()` trong JS là dương tính giả — nó không kích
  hoạt `:focus-visible`. Luôn kiểm bằng phím Tab thật.

## Thử nguyên bộ + slot cơ thể (2026-09-02)

- Báo cáo đầy đủ: `docs/project_evidence/tryon/FULL_OUTFIT_2026-09-02.md`.
  Skill điều phối: `japano-full-outfit-tryon`, prompt
  `PROMPT_CLAUDE_FULL_OUTFIT_TRYON.md`.
- **Lỗ hổng cổng an toàn đã vá.** `coverage_quality` chỉ chặn khi
  `after > 0.34`, tức là chấm TRUNG BÌNH cả ô ngực. Áo khoác mở trước chỉ hở một
  dải giữa nên một ảnh hở ngực thật vẫn lọt: đo được chest 0.0014 → 0.1422
  (gấp ~100 lần) mà `coverageCheck.ok = true`, ảnh trả về là người cởi trần dưới
  lớp haori. Đã thêm nhánh "đang mặc thành không mặc" đo trên LÕI bảo vệ
  (`before_core < 0.06 && after_core > 0.12 && core_gain > 0.08`). Phải dùng lõi:
  bản chấm cả ô làm quần short hở chân bị chặn oan vì ô mông chồng lấn ô chân.
- **Giày dép đã ghép được.** `add_shoe` vốn hoạt động, nhưng lượt
  `/accessory-refine` vẽ lại cả khung nên faceDiff 74.7 / garmentDiff 73.5 và cổng
  loại sạch. Mode mới `confine_accessory_region` giữ nét FLUX trong đúng vùng
  `rough` khác `clean`; sau đó faceDiff = garmentDiff = 0 theo cấu trúc.
- **Slot cơ thể**: `backend/lib/outfitSlots.js` nối `garmentCoverage.js` với
  `outfit.js`. Trước đó giày/guốc/vớ bị phân loại `zone=upper, layer=upper-base`
  (hệ thống tưởng dép là áo) và không chỗ nào biết bộ đồ thiếu gì.
  `GET /api/outfits/completeness` trả slot còn trống + gợi ý cho từng slot.
- **VẪN HỎNG**: mặc chồng món thứ hai bị cổng chặn
  (`face_changed_or_covered` + `body_changed_not_garment`) vì lượt FASHN thứ hai
  dựng lại tư thế/tỉ lệ người. Khôi phục pixel khuôn mặt KHÔNG cứu được — đã thử
  và đã gỡ bản vá. Đây là vấn đề mức sinh ảnh khi nối chuỗi nhiều lượt.
- Địa điểm Nhật: 35 → **37** (Đền Meiji Jingu, Cầu Kintai-kyō), 38/38 scene đạt
  validator. Ảnh Kiyomizu-dera 5852px CC BY-SA 4.0 bị loại vì chụp từ trên cao,
  tiền cảnh là ngọn cây — giấy phép và độ phân giải không thay được bố cục.
  `backend/test/japan-travel-tryon.test.js` chốt cứng con số 37, sửa bảng phải sửa test.
- Storefront đã bắt kịp app: gửi `productIds` + `accessoryIds`. Trước đó web chỉ
  thử được một món trong khi `mobile/app/tryon.tsx` đã gửi đủ từ lâu.
- Ghép cảnh vẫn còn **quầng sáng viền chân** do mask U2Net; hình học đã đúng.

## Chatbot: ngày tháng, mùa và lễ (2026-09-02)

- `backend/lib/calendarVi.js` là nguồn dữ kiện tất định cho ngày/mùa/lễ; chatbot
  có thêm ba intent `date`, `holiday_soon`, `season_outfit`. Test:
  `backend/test/chatbot-calendar.test.js`.
- Ba lỗi đã sửa, đo trước khi sửa: "hôm nay là ngày gì" trả "chưa đủ dữ kiện" (bot
  không có khái niệm thời gian); "mùa đông nên mặc gì" khớp intent `outfit` chung
  nên trả set ghép theo màu, không nhắc mùa; "mùa hè mặc gì đẹp" chọn **Quạt giấy**
  làm món chính vì nó có tag `mùa hè` — đúng tag, sai câu hỏi.
- `seasonalPicks()` vì vậy luôn xếp QUẦN ÁO trước phụ kiện và giữ tối đa một phụ
  kiện. Từ khoá mùa đọc từ tag/tên thật trong catalog, không đoán.
- Thứ tự trong mảng `INTENTS` là quan trọng: `INTENTS.find` lấy khớp ĐẦU TIÊN, nên
  `date`/`holiday_soon`/`season_outfit` phải đứng trước `outfit`.
- Trong `reply()`, `ruleIntent` thắng semantic router khi nó khớp
  (`if (ruleIntent !== 'fallback')`). "sắp tới có lễ gì" từng bị router đẩy sang
  `travel` và trả về danh sách phong cảnh Nhật — thêm luật là hết.
- **Chỉ tra được lễ DƯƠNG LỊCH.** Tết Nguyên đán, Trung thu, Vu Lan theo âm lịch
  nên đổi ngày mỗi năm; câu trả lời nói rõ giới hạn này thay vì đoán bừa.

## Thử riêng phụ kiện (2026-09-03)

- `runAccessoryOnlyTryOn()` trong `backend/routes/tryon.js`: chọn MỖI phụ kiện thì
  bỏ hẳn lượt FASHN, ghép thẳng lên ảnh khách. Quần áo của khách giữ nguyên từng
  pixel (`garmentDiff = 0`), và nhanh hơn vì không có lượt VTON.
- Trước đó luồng bắt buộc phải có ít nhất một món quần áo mới sinh được ảnh nền,
  nên bấm "Thử ngay" trên balo/dù/chụp tai đều báo lỗi — dù toàn bộ hàm đặt
  (`add_hat`, `add_earmuffs`, `add_backpack`, `add_umbrella`, `add_shoe`…) đã có
  và chạy tốt từ lâu. Thiếu đường đi tới chứ không thiếu năng lực.
- Đo thật ngày 2026-09-03 với preset `nu-can-doi`: balo 42,2s · dù 30,6s ·
  chụp tai 29,8s · nón 27,1s · giày 29,8s — tất cả ra ảnh, cổng chất lượng đạt.
- Trâm/kẹp tóc từng trượt cổng (`hair_clip_missing`) vì phép đo lấy TRUNG BÌNH
  trên nửa cái đầu, trong khi món chỉ chiếm vài phần trăm diện tích đó. Đã đổi
  sang đo ĐỈNH theo ô nhỏ (`region_peak_diff`): trâm Kanzashi 2.318 -> 14.565,
  kẹp nơ 8.072 -> 89.894, ảnh không đổi vẫn ~0. Test:
  `backend/test/python/test_accessory_small_props.py`.
- **9/13 loại phụ kiện ghép được** (đo 2026-09-03, preset `nu-can-doi`, 27-33s):
  nón, chụp tai, kẹp nơ, trâm, balo, dù, dép, guốc, đai obi.
- **4 loại CẦM TAY vẫn hỏng**: kiếm gỗ, quạt giấy, găng tay, khăn furoshiki —
  đều `hand_pose_not_engaged`. Cổng đòi ít nhất một cổ tay rời vị trí buông thõng,
  nhưng lượt `/accessory-refine` chỉ hoà cái cutout vào ảnh chứ KHÔNG dựng lại tư
  thế tay. Đã mở quyền sửa vùng cánh tay cho nhóm này (`armRegionsFor` +
  `extra_regions` của `confine_to_accessory_region`) — cần thiết về mặt logic
  (không thể vừa đòi tay cử động vừa cấm sửa pixel cánh tay) nhưng ĐO RỒI: vẫn
  không đủ. Muốn xong phải có bước dựng lại tư thế tay, không phải chỉnh mặt nạ.
- `backend/test/tryon.test.js` từng neo vào `indexOf('await runGpuJob(')` trên CẢ
  tệp nên bất kỳ hàm phụ trợ nào phía trên gọi runGpuJob đều làm nó đỏ oan; đã
  đổi sang neo vào đúng handler `api.post('/tryon'`.

## Nới false-positive và fast preview thử đồ (2026-09-03)

- Coverage gate không còn huỷ ảnh chỉ vì một ô ngực/chậu/mông có hơn 34% màu da.
  Cổ chữ V, bóng da, quần/váy ngắn và vải màu da ở mức mơ hồ chỉ tạo cảnh báo
  `coverage_review:*`; cổng vẫn chặn khi gần như toàn bộ lõi vùng nhạy cảm là da.
- Cổng đồng ý, quyền sử dụng ảnh và kiểm tra người trưởng thành cho trang phục
  18+ không đổi. Đây là giảm false-positive, không phải gỡ kiểm soát ảnh trẻ em
  hay ảnh khoả thân rõ ràng.
- Profile `fast` bỏ lượt FLUX 20–35 giây chỉ dùng để sửa thẩm mỹ phần gấu áo hở;
  final quality/coverage gate vẫn chạy. Có thể bật lại lượt sửa bằng
  `JAPANO_FAST_COVERAGE_REFINE=1` sau khi có bộ benchmark chứng minh cần thiết.
- App gửi `qualityMode: fast` (16 bước, 1280 px) và làm nóng GPU song song với
  body analysis. Smoke API thật, không dùng cache, trên RTX 5060 Ti hoàn tất
  trong 22.835 s; bằng chứng ở
  `docs/project_evidence/tryon/FAST_PREVIEW_2026-09-03.md`.

## Validation gates

Run the narrow test first, then before handoff run as much of this as relevant:

```bash
npm --workspace mobile run typecheck
npm --workspace backend test
python3 -m unittest discover -s backend/test/python -v
npm run check
git diff --check
```

For AI claims, add a dated artifact under `docs/project_evidence/` containing
hardware, input class, settings, timings, output gate and rejected candidates.
For phone work, record device model, APK version/versionCode, install method,
backend URL and the actual visible flow tested.

## Mục tiêu/sức khoẻ và vòng đời voucher (2026-09-03)

- **Tiền tự khai không còn tạo ra quyền lợi tài chính.** Quỹ mục tiêu là SỔ
  THEO DÕI: JAPANO không giữ tiền và không xác minh số dư. Đủ 100% chỉ đổi
  trạng thái tiến độ + lời chúc. `addDeposit` trả `voucher: null`;
  `ensureGoalRewardVoucher` không còn đúc voucher mới, nó chỉ CHUẨN HOÁ voucher
  đã phát trước đây về phạm vi sản phẩm. Đường phát voucher lúc lập kế hoạch
  (`currentSavings` khai đủ ngay) cũng đã gỡ. `removeDeposit` không giữ trạng
  thái `completed` giả nữa.
- **Voucher mục tiêu chỉ giảm đúng sản phẩm mục tiêu.** `appliesTo` từng được
  GHI ở bốn nơi nhưng không nơi nào ĐỌC, nên voucher 30% giảm trên toàn giỏ:
  món mục tiêu 100.000₫ cạnh món khác 900.000₫ mất 300.000₫ thay vì 30.000₫.
  `backend/lib/voucherLifecycle.js` thực thi `scope`/`eligibleProductIds`/
  `maxEligibleQty`/`maxDiscountAmount`; `voucherScope()` suy `product` từ
  `source === 'goal-fund'` nên voucher cũ chưa khai `scope` cũng bị giới hạn
  ngay ở runtime. Voucher chung/Flagcard thiếu `scope` giữ nguyên toàn đơn.
  Voucher mục tiêu thiếu `items` hoặc thiếu `goalProductId` **fail closed**.
- **Voucher không còn bị tiêu lúc tạo đơn.** Trước đây `voucher.used` cộng ngay
  ở `orders.js` và trong toàn bộ code KHÔNG có phép trừ nào, nên thanh toán
  thất bại/huỷ đơn/trả hàng đều làm khách mất trắng lượt dùng. Vòng đời mới:
  `reserved` khi tạo đơn → `consumed` khi tiền thực sự về (COD hoàn tất,
  callback Stripe/VNPay `paid`) → `released` khi huỷ/thất bại. `consumed` là
  trạng thái cuối: callback thất bại đến sau callback paid không nhả nó ra, và
  paid đến sau release chỉ đánh dấu `needsAudit`, không sửa số. Hạn mức đọc từ
  sổ đổi (`usageCount`) nên hai đơn dùng voucher limit 1 chỉ một cái qua được.
- **Hoàn tiền theo phân bổ dòng hàng.** Đơn mới lưu `voucherAllocations`; trả
  món không được giảm thì không bị trừ, trả món được giảm chỉ hoàn số thực trả.
  Đơn cũ không có phân bổ vẫn chạy bằng chia theo tỉ lệ (`pro-rata-fallback`).
  Voucher thay thế chỉ cấp SAU khi hoàn tiền thành công cho toàn bộ đơn, mã
  sinh xác định theo `(mã gốc + id yêu cầu hoàn)` nên gọi lại không đẻ mã mới.
- **Sức khoẻ: sàng lọc an toàn tất định.** Bốn câu (mang thai/hậu sản, bệnh nền
  hoặc thuốc, tiền sử rối loạn ăn uống, đang điều trị), mỗi câu `yes`/`no`/
  `prefer_not_to_say`. Backend TỰ SUY trạng thái; `safetyStatus` client gửi lên
  bị bỏ qua. Bất kỳ câu nào khác `no` (kể cả chưa trả lời đủ) →
  `needs-professional-guidance`, không `weeklyRateKg`, không `estimatedWeeks`.
  Chỉ lưu trạng thái tổng hợp + `screenedAt` + `policyVersion` + provenance,
  không lưu chi tiết bệnh lý. LLM không được gọi khi trạng thái đã chặn, và
  `sanitizeCoaching` loại bỏ mọi nội dung tự đặt ra tốc độ kg/tuần.
- **Mục tiêu sức khoẻ không lưu dữ liệu thương mại** kể cả khi client nhét
  `currentSavings`/`monthlyIncome`/product vào payload. Mọi số đo gắn nhãn
  `provenance: 'self-reported'`, `verified: false`.
- **`/api/vouchers/validate` không còn tin client.** Chủ sở hữu lấy từ JWT
  (`optionalAuth`), giá tính lại từ catalog qua `normalizedOrderItems`, và
  route nhận `items` thay vì chỉ `subtotal`. Mobile bỏ gửi `userId`.
- **Mobile:** form sức khoẻ mở lần đầu để TRỐNG (số điền sẵn 25/165/65/15 triệu
  đã gỡ; chỉ nạp lại giá trị từ mục tiêu đã lưu của chính người dùng), có nhãn
  "Thông tin do bạn tự khai · Không phải xác minh y tế", 4 câu sàng lọc dạng
  radiogroup có nhãn accessibility. "Nạp vào quỹ" → "Ghi nhận đã để dành".
  `VoucherField` nhận `items`, tự kiểm lại mã khi giỏ đổi và GỠ mã kèm thông
  báo nếu không còn áp dụng được — không bao giờ giữ preview cũ.
- **Chưa chạy migration trên dữ liệu thật.** `backend/scripts/auditVoucherRedemptions.js`
  mặc định dry-run; nhánh dry-run đọc THẲNG tệp vì `store.initialize()` chuẩn
  hoá lược đồ rồi ghi lại (lỗi này đã xảy ra thật một lần: nó sửa
  `schemaVersion` 6→8 trong `db.json` và đã được hoàn tác). Dry-run trên
  `db.json` hiện tại: 4 voucher, 5 bản ghi đổi đều thiếu `status` (đọc bảo thủ
  là đã tiêu), 0 giữ chỗ treo, 3 voucher có `used` lệch số lượt đã tiêu
  (THU20 133/1, VIP100 57/0, FREESHIP 414/4 — dữ liệu seed demo). **Chưa chạy
  `--apply`.** Không thêm unique index nào lúc boot.
- Kiểm chứng: 427 test Node (426 → 427 sau khi thêm 3 tệp voucher), 110 test
  Python, mobile typecheck, web typecheck/test/build, `npm run check` exit 0,
  `git diff --check` sạch. Tám luồng runtime chạy thật trên store tệp tạm.
  **Chưa xác minh trên thiết bị OPPO; typecheck/build không phải bằng chứng cho
  luồng thiết bị hoàn chỉnh.**

## Vá báo cáo tốt nghiệp (2026-09-04)

Sửa TRỰC TIẾP `Thầy Nguyễn Ngọc Chấn_...JAPANO Store (1).docx` ở gốc repo.
Bản gốc SHA-256 `4636587c5a2e…` sao lưu trong scratchpad phiên làm việc.

- **Danh mục hình / Danh mục bảng đã điền.** Hai heading và hai field
  `TOC \c "Hinh"` / `TOC \c "Bang"` vốn ĐÃ CÓ trong tài liệu nhưng vĩnh viễn
  rỗng: 113 caption chỉ là chữ thường, không mang field SEQ nào để TOC bám vào.
  Đã chèn SEQ vào từng caption (72 `Hinh` + 41 `Bang`) và điền kết quả vào
  trong field nên bấm F9 trong Word vẫn dựng lại đúng.
  **Cờ `\h` của SEQ chỉ Word tôn trọng — LibreOffice vẫn in số ra trang**, làm
  113 caption thành `2Hình 3.2:`. Phải bọc các run của field bằng `<w:vanish/>`
  mới ẩn được ở cả hai. Số trang lấy từ bản PDF render thật, khớp 113/113.
- **Hai hình Use Case đã thay** qua đúng relationship cũ (`rId10`→`image3.png`,
  `rId11`→`image4.png`) nên vị trí, caption và đánh số không đổi. Dùng
  `D21-uc-ung-dung-nguoi-dung.png` / `D22-uc-web-quan-tri.png` chứ không phải
  D04/D05: D21/D22 tỉ lệ 0.868 khớp khung dọc sẵn có (0.787/0.845), giữ màu
  nhóm + chú giải như hình cũ, và không có nhãn «include» đè lên chữ. Phải sửa
  cả `wp:extent` lẫn `a:ext` — **chỉ trong đúng hai đoạn đó**; regex theo giá trị
  `cx` làm hỏng 36 khung ảnh khác vì nhiều ảnh trùng chiều rộng.
- **Chương 4 chuyển sang một mô hình 19 bảng.** 4.2/4.2.1 bỏ đoạn "ba con số";
  4.2.2 chỉ nói cách kiểm chứng; 4.3.2 đổi thành "Khoá định danh và tham chiếu";
  4.4 thành bảng 19 dòng × 5 cột (tên kỹ thuật, tên nghiệp vụ, lưu gì, vai trò,
  nhiệm vụ backend); 4.4.1 thành "Cách sáu cụm phối hợp trên một luồng mua hàng".
  Sáu cụm: tài khoản 4 · catalog 4 · ý định mua 2 · đơn hàng 4 · khuyến mãi 3 ·
  Nhật Bản 2 = 19. Quét toàn văn: `30 collection` = 0, `collection vật lý` = 0.
  Script: `docs/report/tools/patch_chapter4.py`.
  **Bảng đổi số cột phải đặt lại `tblGrid`/`tblW`/`tblLayout=fixed`** — giữ độ
  rộng cũ thì cột "Tên nghiệp vụ" bị bóp còn một hai ký tự mỗi dòng.
- Cấu trúc sau khi vá: heading 340 → 340 (chỉ 6 tiêu đề mục 4.2–4.4.1 đổi chữ),
  bảng 136 → 136, ảnh 95 → 95, section 3 → 3. Validator skill `docx` với
  `--original`: PASSED.
- **Chưa xong:** viết thêm phần thuật toán/công thức; nhúng 11 ảnh giao diện mới
  ở `docs/report/assets/screens/mobile-2026-09-04-v2/`; và **chỉnh số trang danh
  mục một lần cuối** sau khi nội dung đã chốt (số trang hiện lệch 1–2 vì nội dung
  còn đổi).
- Ảnh giao diện: 11 ảnh đã mở kiểm chứng từng cái. Ba ảnh chụp lần đầu bị bỏ vì
  mở ra thấy đều là màn onboarding chứ không đúng tên file — **tên file không
  phải bằng chứng**. Màn "Thử đồ thông minh" trước nay chưa có hình nào trong
  báo cáo dù là tính năng chủ đạo; nay đã chụp được.

## Try-on warm-up 30 ảnh (2026-09-04)

- Chạy tuần tự ma trận 5 preset người lớn đã duyệt × 6 trang phục qua API thật,
  `qualityMode=fast`, GPU focus `tryon`; thêm một Yukata thay thế cho ca đầu bị
  quality gate chặn. Tổng cộng 31 request, **30 ảnh hợp lệ**, 1
  `COVERAGE_UNSAFE`, 0 cache hit và 0 `GPU_JOB_CANCELLED`.
- 30 ảnh hợp lệ đều là inference mới bằng
  `fashn-vton-1.5+fast-16steps`; thời gian client trung bình 29.18 giây/request,
  nhỏ nhất 20.0 giây, lớn nhất 64.8 giây. Kết quả và log có cấu trúc ở
  `test-results/tryon-warmup/20260904-125836/results.json`.
- Sau benchmark: backend 4100, body 7863, FASHN 7862 và storefront 4200 active;
  motion inactive; hàng đợi GPU rỗng, RTX 5060 Ti dùng 5,747/16,311 MiB. Kiểm
  tra trực quan ba mẫu đại diện cho thấy đúng người/dáng và đúng trang phục,
  nhưng còn artifact nhỏ ở biên tay/áo nên `ok=true` không thay thế QA bằng mắt.

## Fast navigation

- Body: `backend/body_analysis.py`, `backend/body_geometry.py`,
  `backend/routes/stylist.js`, `mobile/app/tryon.tsx`
- Try-on/motion: `backend/routes/tryon.js`, `backend/fashn_service.py`,
  `backend/motion_service.py`, `backend/one_to_all_runner.py`
- Chat/catalog: search route registration in `backend/server.js`, then the
  matching route and `backend/lib` grounding helpers
- Goals/wellness: search `backend/routes` for goal endpoints and their tests
- Web storefront: `web/README.md`, `web/lib/server-api.ts`,
  `web/app/api/[...path]/route.ts`, `web/lib/product.ts`,
  `backend/routes/asyncAiJobs.js`, `backend/routes/catalog.js`

## Database shape (2026-08-29)

- Live read-only audit at 2026-08-29T14:59:43Z found Atlas `japano` with **30
  collections**, 2,169 documents, 28 unique indexes, 0 TTL and 0 validators.
  The 30th collection is `japan_spots`: 25 visible catalog records materialized
  from the mobile catalog, linked to real `products.id`; image blobs remain at
  their licensed source and MongoDB stores URLs/attribution only. Index size is
  relatively high versus logical data because
  WiredTiger charges roughly 36 KB per collection and per index regardless of
  document count — so merging tiny config collections saves real space, and the
  next real saving is dropping indexes nothing queries.
- Five collections were merged or removed: `product_details` into `products`,
  `banners` and `discount_rules` into `settings` (as `{_id, items:[...]}`),
  `vip_memberships` derived from `orders` via `reconcileVipState`,
  `ai_descriptions` back to a RAM cache. `voucher_redemptions` and
  `flagcard_collections` stay: one is a reconciliation ledger, the other can
  hold admin-granted cards that no order implies.
- Sync the destination master with `npm run db:japan-spots:sync -- --apply`.
  The command upserts only `japan_spots`, never deletes other collections, and
  `GET /api/japan-spots/catalog` is the runtime read endpoint.
- **Never decide "is this database migrated?" by counting a collection.** The old
  boot used `product_details.countDocuments()`; once that collection was dropped
  the count read 0, boot concluded the database was empty, and overwrote Atlas
  with `db.json`. That destroyed 17 products, 85 variants, 17 media (recovered)
  and 263 order/payment/interaction documents (**not recovered — no local backup
  held them**). The marker is now `settings/_id=storage_schema` via
  `hasNormalizedStorage()`, and `store.js` refuses to seed over a database that
  already has products.
- `replaceCollection()` deletes stale documents **before** upserting. Reversing
  that order makes a changed `_id` convention collide with the unique index of
  the very document about to be deleted, and the E11000 leaves the backend
  running but never listening on 4100.
- A migration that touches the global write path must back up the **whole**
  database, not only the collections it means to change.
- Regenerate and verify with: `node scripts/atlas_audit.js --out
  docs/database/atlas-snapshot.json`, `python3 scripts/build_erd.py`,
  `python3 scripts/validate_erd_against_atlas.py`. Backup/rollback:
  `scripts/migrate_lean_collections.js` and `scripts/restore_lean_backup.js`.

## Canonical ERD file

- `JAPANO_ERD.drawio` is the only ERD file kept in the repository and contains
  exactly one page: 19 logical app tables and 24 relations. Table headers are
  centered, PK/FK use a narrow left column, Vietnamese fields are left aligned,
  and connectors start at exact FK rows. `interactions` is deliberately shown
  between users and products because it is the direct behavioural source for
  recommendations; profiles and successful orders are the other ranking inputs.
  Eleven support/technical Atlas collections are intentionally not drawn.
- Read-only Atlas audit on 2026-08-29 found 34 collections, 2,455 documents,
  787,090 bytes, 0 TTL indexes and 0 validators. Storage decision evidence is
  `docs/database/ERD_STORAGE_AUDIT_2026-08-29.md`: target 29 collections after a
  separately backed-up migration. No live collection/document was deleted by
  the ERD audit.
- The old 36-entity `erd.drawio`, separate physical/Core files and duplicate
  editable defense overview were moved to desktop trash on 2026-08-29. Rebuild
  only through `atlas_audit.js`, `build_erd.py` and the validators; do not create
  `core`, `physical`, `final`, `v2` or parallel ERD copies.
- `validate_drawio.py` now rejects duplicate relationships and explicit
  connector segments that overlap by more than 12 px, in addition to broken
  references, out-of-page tables, clipped rows and connectors crossing tables.
  On 2026-08-29 the single canonical file passed: 1 page / 19 tables / 24
  relations, with no invented table, duplicate table or broken relation.
- Both canonical ERDs now display Vietnamese-only business labels. The shared
  `scripts/erd_i18n_vi.py` dictionary covers all 30 live collections and all
  224 fields in the current snapshot. Technical names remain in hidden
  `data-collection` / `data-field` XML attributes so Atlas validation stays
  source-accurate. The app ERD uses row-level FK connectors and distinct edge
  ports/routes to avoid bundled lines.
- The Core presentation generator also corrected four stale display fields
  against the 2026-08-29 snapshot: address `receiver` became `name`, category
  `slug` became `kanji`, voucher `expiresAt` became `expiry`, and order-item
  `color` became `colorName`.
- Mobile API/runtime URL: `mobile/lib/api.ts`, `mobile/app.json`,
  `scripts/verify-oppo.sh`
- Brand splash: `mobile/components/BrandSplash.tsx`, `mobile/app/_layout.tsx`,
  `mobile/assets/brand/`
