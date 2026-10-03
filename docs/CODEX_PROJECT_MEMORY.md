# JAPANO project memory

Last updated: 2026-10-03. This is the short source-of-truth index for coding
agents. It contains no credentials and does not replace source code or tests.

### Public endpoint and Android 1.0.20 release preparation (2026-10-03)

- The live backend/admin is publicly reachable through Tailscale Funnel at
  `https://admin123-system-product-name.tailfeea7a.ts.net`; `/api/health` and
  `/admin/` returned HTTP 200 after all six supervised services were started.
- Mobile 1.0.20 (`versionCode 21`) embeds that HTTPS endpoint. The local release
  APK built with JDK 17, is 119,852,638 bytes, and has SHA-256
  `89f322cd48add0604d3eaf2a0cfe33e23c4c233b831041a079131468a27f0515`.
  It is signed by the dedicated JAPANO release certificate (certificate SHA-256
  `6fb5b38216e390a105107aaf3f926aec32b654e28bc472af9ef305d79a4cf67e`),
  not the checked-in debug key. Signing material is outside the repository and
  mirrored to GitHub Actions secrets.
- `.github/workflows/android-release.yml` builds and attaches the signed APK on
  `v*` tags. `deploy/systemd-user/japano-stack.service` makes the launcher
  restartable at login. Boot-without-login still requires the one-time privileged
  command `sudo loginctl enable-linger admin123`; it was not run because sudo
  requires the user's password.
- Current validation: 473/473 backend Node tests passed, mobile TypeScript passed,
  Storefront 13/13 Vitest plus typecheck/build passed, Android release build
  passed, and the correct AI environment passed 138 Python tests with 5 explicit
  skips. Three skips require the intentionally untracked licensed
  `body_geometry.calibration.json`; two synthetic cut-row cases are fixture
  limitations. Display-contract tests now distinguish the 10-unit readability
  bin from the wider uncertainty interval required by the evidence policy.
- No DrayTek/OpenVPN/WireGuard datacenter profile is present on this workstation.
  A Khaifrost portal login alone does not establish the VPN server, protocol,
  routes or certificates required to reach Proxmox. Prefer Tailscale installed
  directly on the target Linux VM, or request an OpenVPN/WireGuard profile.

### USB debugging with LAN image uploads (2026-10-02)

- A live Redmi request looked like a slow backend, but Node received only
  40,960/301,661 bytes through ADB reverse before `ERR_HTTP_REQUEST_TIMEOUT`
  after 306–324 seconds; the GPU had not started. Body analysis itself returned
  in 1.301 seconds once the full 295,913-byte payload reached the service.
- `scripts/run_all.py` now reads the physical phone's `wlan0` address even when
  its ADB serial is USB-only. Metro and the API use the workstation LAN address;
  USB remains connected for adb/scrcpy and reverse remains available as a
  fallback. It also restarts a healthy Metro unit whose compiled API URL is
  stale.
- Live USB validation: Redmi `192.168.100.26` sent requests directly to backend
  `192.168.100.10`; bikini try-on uploaded 301,658 bytes, returned HTTP 200 in
  52,271 ms, and visibly reached the mobile `Hoàn tất` screen. The body-analysis
  request returned HTTP 200 in 1,301 ms. Screenshot evidence is local at
  `/tmp/japano-bikini-lan-result.png` and is not a repository artifact.
- `mobile/app/tryon.tsx` now assigns the loading overlay to a request version.
  A stale run that exits after an image/product change can no longer leave the
  timer overlay stuck indefinitely or clear the active run's overlay.

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

### Local Android development recovery (2026-09-23)

- Redmi Note 8 Pro (`192.168.100.26:45199`) cold launch failed with
  `Unable to load script` / connection refused to `192.168.100.59:8081`.
  Backend 4100 remained healthy; Metro had stopped.
- Metro now runs in transient user unit `japano-metro`, working directory
  `mobile/`, with LAN host `192.168.100.59`, API port 4100 and
  `Restart=on-failure`. It is independent of the agent shell but is not
  installed for reboot persistence. Inspect via
  `journalctl --user -u japano-metro`; stop via
  `systemctl --user stop japano-metro` when development is finished.
- Device relaunch loaded the Android bundle and rendered the app navigation;
  a nonfatal Expo Linking URI-scheme warning remains. This verifies app startup,
  not body-analysis or try-on completion. Backend/FASHN are separate processes,
  not owned by the inactive legacy `japano-*` service units.
- No application code changed. GitNexus CLI impact was unavailable because
  `.gitnexus/run.cjs` is absent; this update records runtime evidence only.

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
  shared. On 2026-09-04 cross-device cart/wishlist parity was completed:
  authenticated Mobile and Storefront both hydrate from and write to backend
  `carts`/`wishlists`. Storefront guests are read-only: they may browse/search
  products, but cart, wishlist, checkout, account, Ori and AI try-on require a
  verified session. The BFF also returns 401 for protected API access without
  its HttpOnly cookie, so this is not merely a disabled button. Legacy shared
  guest cache is discarded; local storage is now keyed by authenticated user
  and remains only a fast/offline cache, not an independent source of truth.

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

## Try-on warm-up 70 lượt (2026-09-04 tối)

- Chạy tuần tự đúng 70 request qua API thật: 5 preset người lớn đã duyệt × 14
  trang phục (không dùng phụ kiện), size M, `qualityMode=fast`, GPU focus
  `tryon`. Kiểm tra cache trước khi chạy cho thấy 70/70 tổ hợp đều chưa có;
  kết quả thực tế có 0 cache hit và 0 `GPU_JOB_CANCELLED`.
- 67/70 request trả ảnh hợp lệ bằng `fashn-vton-1.5+fast-16steps`; 3 request
  trả `TRYON_AI_UNAVAILABLE` sau khi cả hai ảnh sinh nội bộ đều bị quality gate
  chặn vì `face_changed_or_covered`. Đây không phải lỗi OOM hay service chết.
  Thời gian client trung bình 21,56 giây, nhỏ nhất 19,86 giây, lớn nhất 37,76
  giây. GPU đạt đỉnh 100% ở cả 70 lượt; VRAM cao nhất 4.962/16.311 MiB.
- Sau lượt cuối, GPU queue rỗng, FASHN `gpuJobActive=false`, Motion `busy=false`
  và GPU utilization về 0%. FASHN vẫn được giữ warm trong VRAM; arbiter sẽ nhả
  nó khi người dùng chuyển sang Motion. Log có cấu trúc ở
  `test-results/tryon-warmup/20260904-212756/results.json`. Ảnh test không được
  đăng, gắn tài khoản hay tự động hiển thị trên UI; không có kiểm tra trực quan
  67 ảnh trong lượt warm-up này.

## Explore Japan 10 địa điểm × 5 preset (2026-09-04 tối)

- Chạy đúng 50 luồng theo mặc định hiện tại của app: gọi gợi ý theo từng
  preset, lấy sản phẩm đầu tiên và size API đề xuất, giữ nguyên pose, chạy
  `/api/tryon`, rồi ghép scene đầu tiên tại slot đầu tiên qua
  `/api/japan-spots/scene-photo`. Kết quả: 48/50 ảnh cảnh 1024×1536 thành công,
  cả 48 đều `groundSafe:true`; 2 lượt Kênh Otaru bị `COVERAGE_UNSAFE` ở bước
  try-on nên không ghép ảnh lỗi vào cảnh.
- Có 22 lượt inference mới và 28 cache hit do nhiều địa điểm cùng gợi ý đúng
  sản phẩm/size; cache cho phép đổi nền mà không đốt lại GPU. Inference mới
  trung bình 21,76 giây, ghép cảnh thành công trung bình 0,46 giây. GPU đạt đỉnh
  100%, VRAM cao nhất 5.055/16.311 MiB; sau test queue rỗng và GPU về 0%.
  Kết quả, 48 ảnh và contact sheet nằm ở
  `test-results/explore-japan-matrix/20260904-220446/`.
- Kiểm tra trực quan một ảnh mỗi địa điểm và đủ 5 vóc dáng tại Arashiyama:
  khuôn mặt/hình thể được giữ, kể cả preset ngoại cỡ; vị trí chân hợp lệ theo
  metadata. Chất lượng trình bày chưa đạt đồng đều: người mẫu đi chân trần,
  bóng/ánh sáng còn cảm giác ghép, và sản phẩm `khoac-nhat` (ảnh nguồn là happi
  đỏ mở vạt) bị FASHN biến thành áo ngắn gần kiểu T-shirt ở nhiều cảnh.
- Phát hiện lỗi size chưa sửa: preset 155 cm/115 kg được `sizeFromBody()` xác
  định cần 4XL, nhưng khi sản phẩm chỉ còn S–XXL, recommender rơi về
  `available[0]` nên trả S với confidence thấp ở cả 10 địa điểm. Cần đổi sang
  size khả dụng gần nhất (XXL) thay vì size đầu tiên. Đây là kết quả audit; chưa
  chỉnh code trong lượt test này.

## Try-on 15 trang phục × 5 ảnh và scene 4 × 10 (2026-09-05)

- Chạy tuần tự 75 request thật (15 trang phục × 5 ảnh VITON-HD có license kiểm
  thử), size M, profile người dùng nhập, `qualityMode=fast`, `fitEffect=false`.
  74/75 request trả ảnh; `so-mi-trang × very-slim` bị fail-closed HTTP 503 ở cả
  lượt chính và một lượt retry, không có overlay giả. P50 22,6 giây, P95 40,3
  giây, trung bình 28,0 giây; ca đổi pose chậm nhất 101,4 giây. Tổng batch chính
  2.109,6 giây.
- 74 output đều đọc được, kích thước 960×1280 và có 74 SHA-256 khác nhau.
  Contact sheet không thấy ảnh trắng/hỏng hoặc overlay thô, nhưng độ phủ người
  vẫn phụ thuộc ảnh đầu vào: nhiều mẫu chỉ có tới hông/đùi, không phải ảnh toàn
  thân phù hợp để ghép phong cảnh.
- Lấy bốn output pass đại diện (Kimono, Cardigan, Furina, Happi) ghép vào 10
  scene đã duyệt: 40/40 HTTP pass, 40/40 `groundSafe:true`, ảnh JPEG 1024×1536,
  40 hash khác nhau; bước `segmentation-composite` trung bình 0,51 giây. Visual
  review chỉ 10/40 đạt cảm giác đứng tự nhiên (ảnh Cardigan toàn thân); 30/40
  còn lại dùng ba ảnh nguồn đã cắt chân nên nhìn cụt/lơ lửng dù validator vùng
  đất đạt. Cần chặn hoặc cảnh báo ảnh không đủ chân trước khi cho ghép scene.
- Toàn bộ ảnh, JSON và contact sheet nằm ở
  `test-results/tryon/2026-09-05/15-outfits-x-5-samples-20260905-035506/`.

## Try-on 10 trang phục bổ sung × 5 ảnh full-body AI (2026-09-05)

- Chạy tuần tự 50 request thật với 10 SKU chưa dùng ở batch 15 bộ, size M,
  profile người dùng nhập, `qualityMode=fast`, `fitEffect=false`. Năm ảnh người
  là ảnh mẫu đã AI-outpaint phần chân, không phải ground truth đo cơ thể.
- 49/50 request trả ảnh; `hakama-nu × average` fail-closed HTTP 503 ở cả lượt
  chính và retry, không dùng overlay giả. P50 36,2 giây, P95 39,1 giây, trung
  bình 32,43 giây, chậm nhất 72,1 giây; batch chính mất 1.621,9 giây.
- 49/49 output đọc được, đều 960×1280 và có hash khác nhau. Manual visual review
  nghiêm ngặt: 0/50 giữ đúng đồng thời loại, kết cấu và phom garment; 35/50 còn
  nhận ra màu/họa tiết nhưng sai dáng, 14/50 không còn nhận ra đúng garment, 1
  lỗi kỹ thuật. Kimono/Yukata thường bị rút thành váy/áo ngắn, Samue thành suit,
  Hakama thành váy hoặc quần phổ thông. Không dùng tỷ lệ API 49/50 làm tỷ lệ
  thành công thị giác.
- Sáu SKU Yukata/Kimono/Haori có `_tryon-flat.png` nhưng chưa nằm trong allowlist
  flat-lay mặc định, nên runtime dùng `_1.jpg`; các cặp ảnh gần giống nhau nên
  đây chỉ là yếu tố cấu hình cần kiểm chứng thêm, không phải nguyên nhân đã được
  chứng minh. Riêng `hakama-nu_1.jpg` là garment gấp khó đọc.
- Kết quả, contact sheet, ảnh garment đã dùng và review nằm ở
  `test-results/tryon/2026-09-05/10-more-outfits-x-5-full-body-ai-20260905-050239/`.

## Bikini 1 bộ × 5 ảnh full-body AI (2026-09-05)

- Test thật `bikini-hoa-anh-dao`, size M, fast, không fit-effect/body-analysis,
  xác nhận 18+: 5/5 HTTP pass; 5 PNG 1152×1536 và 5 hash khác nhau. P50 36,72
  giây, trung bình 46,43 giây, cold-start 88,19 giây; bốn lượt sau trung bình
  35,99 giây.
- Visual review: 5/5 giữ đúng thiết kế hai mảnh, nền trắng và họa tiết hoa; mặt
  vẫn nhận ra. Nhưng 0/5 giữ nghiêm ngặt pose ban đầu và chưa đủ bằng chứng kết
  luận giữ chính xác hình thể/số đo; ba lượt báo `+pose`. Phần chân ảnh đầu vào
  do AI outpaint nên không phải ground truth.
- Log tách pha: cổng Qwen3-VL 18+ mất 28 giây ở lượt đầu và 4–7 giây ở các lượt
  sau; pose/fit 1–5 giây; sinh+validate bikini 55 giây lượt đầu và 26–30 giây
  sau. Pipeline dùng một lượt FLUX.2 đa tham chiếu cho người+áo+quần, 5 step
  low-memory/sequential offload (17–20 giây sampling), không phải hai lượt
  FASHN. GPU queue rỗng trước batch.
- Arbiter chuyển `vision → browse → swimwear → browse`; khi về `browse`, FLUX
  bị nhả và request sau lại nạp model. Cold-start Qwen/FLUX là nguyên nhân chính
  của cảm giác lâu. Kết quả và review:
  `test-results/tryon/2026-09-05/bikini-1-outfit-x-5-full-body-ai-20260905054341/`.

## Commerce, Lens and travel latency pass (2026-09-04)

- Product cards on Mobile/Storefront and the web PDP always show `Đã bán N`,
  including zero. The backend value remains derived only from successful real
  orders and excludes demo/admin-test orders; no fake sales or live Atlas
  mutations were introduced. Existing 70-product catalog remains the data set.
- Mobile catalog search now strips Vietnamese diacritics including `đ`, requires
  every token of a multi-word query to occur, and limits typo tolerance to one
  sufficiently long token. `Hà Nội` therefore returns an empty product result
  instead of matching `Haori` through the loose token `ha`. Storefront search
  already used strict whole-query substring matching.
- JAPANO Lens first runs the CPU color/catalog recommendation (`quick=true`) and
  renders usable products/copy, then enriches portrait/mood analysis in the
  background. The UI now has a moving scan line, staged labels and a real elapsed
  timer; no fake percentage is shown. Product detail likewise renders a grounded
  catalog description immediately while visual wording is upgraded in the
  background.
- Explore Japan uses the same fast VTON profile with body analysis skipped and
  caches only the current session's generated try-on in RAM. Re-composing a
  scene or revisiting the same photo/product/size/pose no longer reruns VTON;
  personal photos are still not written to disk or MongoDB. The UI reports the
  measured try-on/scene durations for each run.
- Hidden preset `nu-mem-mai` now points to the generated adult image
  `nu-mem-mai-110-120.jpg` and is labelled as a designed 110-120 kg size target.
  This range is a design prior, not a weight inferred from pixels; direct or
  user-entered measurements still win. Anchor generation is now 2.
- Payment-receipt and refund/return email templates always include the immutable
  address snapshot from the order (or `Chưa cung cấp` for legacy orders).
- Validation: 434/434 backend Node tests, 110 Python tests (108 pass, 2 configured
  skips), Mobile TypeScript, Storefront 13/13 Vitest, TypeScript and production
  build and ESLint all passed. After restarting only Backend/Storefront, direct
  backend and BFF returned byte-identical 70-product payloads; current real-sale
  distribution is 7 positive / 63 zero, with Yukata xanh highest at 12. The
  quick Lens endpoint returned grounded output in 160 ms and set
  `portraitPending=true`; preset metadata and the new JPEG both returned 200.
- Storefront guest-policy verification on 2026-09-04 passed in real Chromium at
  desktop 1440 and mobile 390: catalog stayed public, legacy guest cache was
  removed, cart/wishlist clicks and protected pages redirected to login, direct
  unauthenticated try-on POST returned 401, and an authenticated session still
  rendered `/thu-do` with HTTP 200.
- Release APK (SHA-256 `2f516ba83ebfdb950c2007483157695599032bbd4ac42482c3c21c8d8ca19fd2`)
  was built and update-installed with `adb install -r` on USB Redmi Note 8 Pro;
  version stays 1.0.19/20 and the logged-in account survived. UI-tree checks on
  the installed bundle confirmed `Đã bán 4`/`Đã bán 12`, query `ha noi` →
  `0 sản phẩm` + `Không tìm thấy`, the Lens heading/three staged modes, and a
  grounded Yukata style description visible one second after direct navigation.
  The animation itself and Explore Japan VTON were not exercised with a personal
  photo. All six JAPANO services remained active; the GPU queue was empty.

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

## Test mới 2 trang phục × 5 người (2026-09-05, 06:43)

- Yukata xanh chàm + Haori Seigaiha: 10/10 API trả PNG 960×1280, 10 hash khác nhau.
- Fast, size M, không fit-effect, bỏ body analysis và không gửi profile/số đo.
- Trung bình 33,16 s, P50 36,535 s, tổng request 331,55 s; queue rỗng khi kết thúc.
- Visual: Yukata 0/5 giữ đúng phom; Haori 2/5 còn nhận ra mở vạt nhưng chưa
  đạt xác nhận nghiêm ngặt, 3/5 bị đóng thành sơ mi (1 ca đổi thành tay dài).
  Sáu lượt có FLUX pose; ảnh người có phần chân AI outpaint, không là ground truth.
- Đã nhường GPU khi app có job. Test API, không phải xác nhận thao tác trên thiết bị.
- Ảnh, contact sheet và REVIEW.md: `test-results/tryon/2026-09-05/2-outfits-x-5-people-064308/`.

## Runtime stopped at user request (2026-09-05T08:23:51)

- Stopped only japano-backend, japano-body-analysis, japano-fashn and japano-motion user services.
- Verified all four inactive; no listening sockets on 4100/7862/7863/7864.
- Backend-served Web Admin is unavailable while stopped; app API calls cannot complete.
- Unrelated services and networking were not changed.

## Local PC runtime restored (2026-09-05T09:08:08)

- User is now physically on the PC (not remote). Backend + Body + FASHN + Motion started; all health endpoints returned HTTP 200. FASHN/FLUX load on demand.
- Started transient user service `japano-storefront-local` from repo `web/`, with `JAPANO_API_ORIGIN=http://127.0.0.1:4100` and `npm run dev` on 4200.
- Admin `http://localhost:4100/admin/` and Storefront `http://localhost:4200` returned 200; opened both through xdg-open on local X11 display :1.
- Existing remote networking unchanged. This does not launch the Android app or validate a fresh AI generation.

## Test 4 trang phục × 5 người trên PC (2026-09-05, 09:10)

- Chạy mới 20 ca API: Yukata xanh chàm, Haori Seigaiha, sơ mi trắng, cardigan dài.
  Fast/M, không fit-effect, bỏ body analysis, không profile/số đo; 5 ảnh có chân AI outpaint.
- 19/20 ảnh PNG 960×1280, hash khác nhau. Ca 11 sơ mi × very-slim HTTP 503:
  hai lần sinh nội bộ bị flat_or_blurred_garment/garment_unchanged chặn.
- Trung bình 37,61 s/ca, P50 37,435 s, min 21,26/max 81,39; batch 754,78 s.
  Hai lượt đầu 65,99/81,39 s; 18 lượt sau trung bình 33,60 s. Queue rỗng khi kết thúc.
- Visual: Yukata 0/5 giữ phom dài; Haori 3/5 đóng vạt, một ca đổi tay dài.
  Sơ mi 4 ảnh trả được giữ đặc điểm chính; cardigan có 3 ca rút ngắn và 2 ca
  đổi cả quần ngoài mục tiêu. Không đánh đồng HTTP thành công với chất lượng thị giác.
- Gallery offline, contact sheet, REVIEW.md, results.json và ZIP: `test-results/tryon/2026-09-05/4-outfits-x-5-people-091037/`.

## Ori response reliability and active device caveat (2026-09-05)

- `backend/lib/chatHttp.js` bounds the complete JSON response, including body
  after headers. Previous shared fetch timeout stopped at headers; reproduced
  a 60 ms request still pending until an external abort at 352 ms.
- Ori planning + rewriting now share `JAPANO_CHAT_BUDGET_MS` (default 8000,
  maximum 12000); planner at most 3000 ms, then remaining budget for rewriting.
  On timeout return the existing grounded draft; no invented catalog facts.
- Async chat exceptions return JSON; history write failures keep the answer
  and set historySaved=false. Web AiStylist scrolls to new responses.
- Backend 441/441, Web 13/13 + TypeScript and component ESLint passed. Real
  authenticated Chromium: six replies in 97–853 ms, bottom gap zero, simulated
  503 recovery followed by successful real retry. Evidence: `test-results/ori-fix-20260905/`.
- Applied backend restart at 09:33:58. Redmi was subsequently observed still
  showing a try-on timer (181 s) while backend queue and FASHN job state were
  idle. Restart may have interrupted the client request; exact stage unresolved.
  User is actively testing try-on: do not restart or launch competing benchmarks.
  Mobile chat tap validation was deferred; no APK reinstall was needed for server fix.


## AI adapters and runtime recovery (2026-09-28, in progress)

- Added opt-in LangGraph catalog-grounded chat (`JAPANO_CHAT_LANGGRAPH=1`),
  authenticated-user behavior summaries and an optional Qwen intent adapter at
  `JAPANO_CHAT_ADAPTER_URL=http://127.0.0.1:7866`. GPU arbiter now serializes chat
  with try-on/motion and releases the adapter before image generation.
- Real Qwen3-4B LoRA and VeRA runs completed (60 optimizer steps each), reload
  and hashes verified. Heldout intent accuracy: base 57/76, LoRA 75/76, VeRA
  76/76; synthetic/group-disjoint engineering evaluation, not production approval.
  ResNet18 layer4/head fine-tune completed: 593/600 heldout catalog photos correct.
  Models remain ignored under backend/ai_training/runs; evidence and instructions
  in docs/README_AI_TRAINING.md and docs/ai-evidence-20260928/.
- Kaggle workbench exports only allowlisted product fields, downloads licensed
  Bitext/Fashion Small/Retail demo data, verifies archive paths, saves provenance.
  No private customer records exported to SFT, no live Langfuse upload.
- Runtime initially had missing FLUX transformer and text-encoder shard; both
  restored from official revision e7b7dc27f91deacad38e78976d1f2b499d76a294.
  New model_readiness.py checks shards rather than config existence.
- User reported try-on and motion broken. Prioritize actual image/video recovery.
  Shirt retry returned a real image in 32.55s on nu-thanh-manh. Initial regular
  preset shirt/bikini were blocked by identity gates; keep gates intact.
  One-to-All source/environment/models are being installed under ~/jp/ai;
  motion was not ready at initial probe. Update this section after validation.
- Active local services: backend 4100, storefront 4200, Metro 8081, body 7863,
  FASHN 7862, motion 7864, adapter 7866 (transient systemd user units).
  Redmi connected by USB, chat tap and live reply observed. OPPO not validated.
- Backend 450 tests pass; mobile types pass. Full image-env Python suite has
  113 tests, 2 failures + 1 error related to missing body calibration, 2 skips.
  Do not claim full Python suite passes or fabricate calibration.

### Head distortion regression (2026-09-28)

- User's Redmi crossed-arm photo was unnecessarily sent through FLUX whole-body
  repose. `garmentRegion.ok=false` overrode the intended hands-only exclusion.
  Added `needsPoseCorrection` in routes/tryon.js: hands_cover_chest alone no
  longer requests repose; geometric problems and explicit pose requests remain.
  Strict identity stays enabled for this direct FASHN path. Two regression tests.
- Same source image + happi-matsuri S, fast, no fit synthesis: real output
  32.79s, poseTransferred=false, no attempts/warnings. Visually reviewed head
  against source. Quality gate faceDiff=24.383, no reasons; evidence under
  test-results/ai-upgrade-20260928/happi-head-{fixed,quality}.json and fixed.png.
  Backend restarted with fix. Old result on phone requires regenerating.
- Bikini nu-thanh-manh now returns real image in 45.64s after restoring FLUX;
  regular-body preset remains blocked by body identity gate.
- Motion presets and POST now require health.detail.ok/modelReady/cudaRuntimeReady,
  not just HTTP 200. New test covers incomplete weights and unavailable CUDA.
  One-to-All source pinned b3c9d886c93c43e767b995e93968708ee2d410cb;
  downloader revisions pinned in ai_training/download_motion_models.py.
  Pose 395 files complete, CPU pose inference exercised; ONNX advertised CUDA
  but emitted plugin-device warnings, so CUDA execution still needs validation.
  Animation/text weights still downloading in japano-download-motion-animation
  and japano-download-motion-text user units; no validated MP4 yet. Inspect
  these units before starting duplicate downloads. Do not call motion fixed.

### Latest motion and measurement validation (2026-09-28)

- Motion recovery complete: all pinned weights downloaded; 7 prompt embeddings cached via one_to_all_runner --prepare-prompts. Actual POST /api/tryon/motion walk_natural turbo returns MP4 in 57.13s, 49 frames/12fps, automatic quality gate passed. Visual contact sheet shows real leg/arm motion but somewhat runway-like gait. Evidence motion-live.mp4/json and motion-health.json under test-results/ai-upgrade-20260928. Device playback not validated. CUDA ONNX detector session checked with preload_dlls: actual providers CUDAExecutionProvider+CPUExecutionProvider.
- New body_evidence.py public policy applied at analyze_body exit: unscaled single photo height=null; inferred weight=null and girths empty; explicit height/weight win even for 160cm/150kg; reference-object height retained. absoluteMeasurementsRestricted=true disables matchBodyAnchor fallback in mergeBodySignals/summarizeBodyAnalysis. Actual worker and public Node API checked; no-reference response insufficient_evidence, referenceProfile=null, usedAnchor=false. This is not a trained accuracy improvement.
- mobile/lib/profile.ts BODY_ESTIMATOR_GENERATION=4 clears previous saved estimates; manual values retained. Backend 451 tests passed, mobile types passed; three new Python body evidence tests passed. Legacy Python tests expecting unscaled estimates require reconciliation, do not claim full suite passes.
- Added docs/LOI_THOAI_THUYET_TRINH_AI.md: detailed Vietnamese speech, actual training parameters/evidence, honest vector RAM cache vs VectorDB distinction, body measurement collection/eval plan.
- Bikini now allows a second seed attempt by default, with unchanged identity/coverage gates; live regular-preset retry pending validation.

- Bikini retry validated: nu-can-doi/M first seed blocked body_changed_not_garment, second passed unchanged gates, HTTP200 in70.36s, visually reviewed bikini-retry2.png. Backend now serves this retry policy. This supersedes earlier regular-preset failure notes.
- Body analysis targeted tests reconciled to new evidence contract:13/13 pass. Remaining full-suite calibration failures are not resolved. Adapter7866 restarted after CPU prompt preparation and healthy, device cpu.

### Phone mirror session (2026-09-28)

- USB no longer attached; discovered already paired Redmi via `adb mdns services`
  and connected at 192.168.100.26:38079 (wireless port is ephemeral).
- Re-established adb reverse 4100/8081, relaunched vn.japano.app/.MainActivity.
- Desktop scrcpy4.1 mirror running as transient user unit japano-phone-mirror,
  DISPLAY=:1, title `JAPANO - Dien thoai`, max-size1280, no audio. X11 window
  existence verified. This is the actual Redmi screen/control, not an emulator.
- Old app screen retained stale body estimates and an image-safety unavailable
  message; relaunched to load current runtime. Do not infer all AI flows passed
  from successful mirroring. Stop mirror with systemctl --user stop japano-phone-mirror.

### Statistical suggestions restored at user's request (2026-09-28)

- User explicitly wants photo-only approximate suggestions back. body_evidence
  now preserves existing model hypotheses for full-body, head-visible, segmented,
  low-tilt images with analysisConfidence>=0.6 and no arm/torso merge or cut rows.
  Uses uncertainty bounds rather than narrow 10-unit display bins; marks each
  as uncalibrated_statistical_suggestion, insufficient_evidence for measurement,
  usableForSizing=false. Poor/OOD evidence stays unavailable; manual values win.
- Actual body_weight_estimator.joblib, body_bmi_estimator.joblib,
  body_girth_estimators.joblib and bodym_population_calibration.json missing on
  this machine; targeted search Documents/Downloads/jp found no copies. Therefore
  no claim of restored old trained accuracy. Existing heuristic predictions may
  remain poor on extreme physiques. No new weight/girth training performed.
- Four body-evidence tests and thirteen body-analysis tests pass; worker restarted.

### ANSUR regressor recovery completed (2026-09-28)

- Downloaded Kaggle seshadrikolluri/ansur-ii, CC0 verified in metadata. Original data under ignored workbench/raw/ansur2. New restore_body_regressors.py uses person train/validation/test split, selects two HGB configurations by validation only, sealed test1214. Models/range priors restored through previously missing paths in ai_training/models via symlinks into runs/body-regression-20260928. No unrelated checkpoint overwritten.
- MAE physical table weight3.207kg/chest2.668cm/waist2.362cm/hip1.797cm; NOT photo accuracy. Test>=100kg n117 weightMAE4.663kg; >=150kg n0. Report copied docs/ai-evidence-20260928/body-regression-report.json. BodyM/head/torso calibration remains missing.
- Policy permits tentative height independent of arm merge, and arm-corrected in-domain ANSUR weight/girth hypotheses; keeps insufficient_evidence/usableForSizing=false semantics. 5/6 preset images returned full hypotheses; extreme preset weight/girth remain unavailable. Evidence body-restored-five-presets.json actually contains six presets. All synthetic presets lack measured ground truth. No accuracy claim from them. Worker restarted.13+4 targeted Python tests passed.

### Uploaded-photo bikini outage under repair (2026-09-28)

- User still cannot try on bikini. Actual Redmi screen shows AGE_VERIFICATION_UNAVAILABLE: Ollama was absent at11434 and qwen3-vl:8b missing. Earlier successful bikini cases used server-approved presets and did NOT validate this uploaded-photo gate. Do not generalize preset success to customer photos.
- Started transient user unit japano-ollama using ~/.local/ollama/bin/ollama; downloading qwen3-vl:8b (6.1GB). Inspect /tmp/japano-vision-pull.log and /api/tags before starting another download. Until download and real inference pass, uploaded bikini remains unvalidated. Safety gate unchanged.
- Exact currently selected Redmi image copied only to /tmp/japano-upload-failing.jpeg for local debugging. Pose analysis detects one person, confidence0.872, no fallback/repose required. This is not evidence that age check or generation succeeded.
- scripts/start-ai-demo.sh now starts Ollama; scripts/check-ai-ready.sh checks try-on, motion and presence of the required vision model. scripts/demo-preflight.sh now fails when Ollama/model missing; model presence alone is not inference validation. GitNexus impact on preflight file UNKNOWN; corroborating text search found no tracked invocations, script is direct executable shell entrypoint; only added top-level readiness check. Shell syntax passes; 12 adult-gate/pose/motion targeted Node tests pass.
- start-all.sh (`npm run dev:android`) also starts a missing local Ollama, preserves an existing server, checks exact vision model, warns on missing model, and cleans up only its own Ollama PID. Impact file UNKNOWN (shell function not indexed; bare cleanup query resolves an unrelated JS symbol, not this script); text confirms package.json caller and EXIT trap. Extracted startup block exercised against live Ollama without spawning duplicate process; syntax and diff whitespace pass. No backend restart required for these launcher changes.
- RESOLVED uploaded bikini outage: qwen3-vl:8b download completed and SHA verified by Ollama. Actual Redmi tap with existing customer photo + bikini-hoa-anh-dao S succeeded at19:24:26, POST /api/tryon HTTP20040886ms after separate vision step~19s. Vision unsure, existing explicit18+ attestation policy allowed; no gate bypass. Visually inspected actual phone result: both bikini pieces, retained hat/face/background and bent-leg pose. Screenshot test-results/ai-upgrade-20260928/bikini-upload-redmi.png. This is one verified uploaded-photo success, not100% success on arbitrary photos.
- Same original photo body worker remains insufficient: fullBodyVisible=false, feetVisible=false, coverage=knee, armsMergedIntoTorso=true. User continues to request all five predictions; no validated ground truth supplied. Do not claim calibrated photo accuracy or invent values. Mobile tryon UI copy corrected to distinguish absent predictions from available hypotheses and remove fixed10-unit claim; TryOn graph UNKNOWN confirmed Expo route/callers, runBodyAnalysis graphLOW. Mobile tsc passes; new copy not yet observed on running phone bundle (old copy still visible), deployment needs verification.
- User later supplied approximate height150–160cm/weight58kg. API with weight58 explicitly user_provided returns weight58, measurementStatus=partial, recommendedSize=M; height null/girths empty. This is user-input verification, NOT model accuracy. No midpoint height substituted. runBodyAnalysis now accepts includeManualMeasurements only on explicit Reanalyze; new-photo path still omits previous profile. Resets usingEstimate when no hypotheses. Latest mobile tsc passes.
- Device delivery: React Native debug_http_host still pointed at LAN192.168.100.59:8081 and timed out. Changed only that preference to127.0.0.1:8081, preserved other preferences, force-stopped/restarted app, Metro logs confirm Android bundle at19:31:29. New app now asks login; user asked to log in themselves (no password requested). Need resume visible measurement-flow validation after login. Do not claim newest UI/measurement-input flow has been validated on device.

### One-command launcher and measurement display follow-up (2026-09-28)

- Added executable `./run-all.sh` -> `scripts/run_all.py`: starts/preserves systemd user services Ollama, body, FASHN, motion, LoRA intent adapter, backend, storefront and optionally Metro/Android. New units Restart=on-failure; existing units preserved. Checks scene assets, MongoDB connection, actual model readiness and CUDA. Missing vision model pulled explicitly. No automatic training or credential/data reset. `--no-phone` passes live readiness. Phone ADB disconnected; full phone launch remains unvalidated. ADB HTTP probe uses nc -q3 to allow response after stdin EOF; reconnect bounded to10s.
- Actual existing try-on result composed at Naoshima via API in1.34s, groundSafe=true, image visually inspected; visible color cast/composite quality remains a limitation. Evidence japan-launcher-check.{png,json}. No blanket flawless claim.
- User requested ten-unit display groups. mobile/lib/bodyEstimateDisplay.ts renders centered10-unit groups only for existing numeric hypotheses, preserves manual/reference values and null; actual uncertainty shown separately. Five direct display contract checks pass. This is presentation, not improved model accuracy.
- runBodyAnalysis uses a monotonically increasing request version: delayed previous-photo success/error/finally cannot overwrite latest photo state. Added manual bust/waist/hip inputs. Impact runBodyAnalysis LOW2callers; TryOn UNKNOWN corroborated Expo route and navigation references. Mobile TypeScript and4Python evidence policy tests pass. New UI not yet visibly validated on disconnected Redmi.
- Generated one unlabelled5x2 contact sheet with ten synthetic adult women, diverse builds, full-body neutral studio poses. Built-in imagegen, output/imagegen/10-mau-voc-dang.png. No measured labels, no150kg ground truth, not a training/calibration dataset. Do not upload whole sheet expecting ten independent predictions: current person selector picks one subject.

### Broad-build measurement and live AI verification (2026-09-29)

- `regression_measure_for_build()` now requires three agreeing visual signals
  (raw hip, median torso and upper-thigh breadth) before replacing skeleton-
  blended chest/waist/hip widths with the arm-carved silhouette. Regression
  clothing slack is capped at 1.08 only inside this confirmed branch. This is
  geometry/calibration, not fine-tuning or photo-accuracy evidence.
- Ten unlabelled synthetic profiles now rank at 49.5, 55.9, 100.3, 51.3,
  54.9, 79.4, 111.8, 52.3, 51.4 and 84.2kg. Corrections applied only to
  `mau-03/06/07/10`. `mau-07` was re-analysed through the actual Redmi UI and
  displayed 107-117kg. These images have no measured ground truth.
- An invalid full-body head-count cue falls back to a broad population prior
  solely as an uncalibrated suggestion; `usableForSizing=false` remains. OOD
  suggestions surface only when the three-signal broad-build correction was
  confirmed. Body targeted tests 16/16 and evidence policy 5/5 pass. Full
  Python discovery still has legacy missing-calibration/contract failures.
- Fixed the JavaScript Unicode greeting rule: ASCII `\b` treated `hi` inside
  Vietnamese `hiện` as a greeting. Live LangGraph API now answers “Shop hiện có
  bikini nào và giá bao nhiêu?” with the catalog fact “Bikini hai mảnh hoa anh
  đào: 790.000₫”; related chat tests 21/21 pass.
- Fresh uncached `nu-nang-dong`/L/fast bikini generation returned HTTP 200 in
  51.34s with FLUX.2, identity and coverage gates clean. A bikini result then
  composed into `naoshima-miyanoura-promenade` in 1.29s with `groundSafe=true`.
  Both outputs were visually inspected. This does not guarantee arbitrary
  customer photos.
- Actual Redmi UI also showed `mau-07` wearing the two-piece bikini. Tapping the
  local motion control produced a walk clip in 57.329s; worker lastRun reports
  turbo, 49 frames, 12fps, 384x512, continuity0.8374 and motionScore2.8214 with
  quality ok. The app displayed the video plus the passed-quality label.
- Redmi USB serial `ylbilfx8ors475kf` is active. Metro runs on LAN
  `192.168.100.10:8081`; scrcpy service `japano-phone-mirror` is visible on X11
  display `:1`. Body and backend services were restarted with the changes.

### Same-photo analysis, fit effect and Redmi rerun (2026-09-30)

- `mobile/app/tryon.tsx` now reads the selected asset URI into one data URI and
  uses those exact bytes both for the preview and for body analysis/try-on. A
  forced re-analysis no longer sends the stored profile, so a prior person's
  59/69 kg estimate cannot be attached to the new photo. Manual measurements
  remain separate and keep priority for sizing. This is state consistency, not
  fine-tuning or proof of measurement accuracy.
- Exact `mau-10.png` through the body worker produced the point suggestion
  160.9 cm / 84.2 kg and 102.2/100.4/118.7 cm, with broad-build correction
  applied. On Redmi the UI showed compact groups 156-166 cm, 79-89 kg,
  97-107/95-105/114-124 cm; the wider model uncertainty remained visible as
  146-176 cm, 71-97 kg and 92-113/90-111/106-131 cm. The synthetic image has
  no scale or measured ground truth, so these values are only hypotheses.
- Fit analysis treats a confirmed broad build plus the smallest sold size S as
  `very_tight` even when the image estimate is not usable for automatic sizing.
  It does not invent a recommended size. The optional deterministic seam split
  exposes only a small upper-arm/outer-shoulder patch matched to sampled skin;
  it never applies to bikini/swimwear, crop tops, trousers, skirts or sensitive
  body zones. Try-on cache pipeline is `v5-2026-09-29-broad-build-safe-seam`.
- Live app-path API: `mau-10` + `so-mi-trang` + S returned HTTP 200 in 34.34 s,
  verdict `very_tight`, severity 0.78, safe seam applied. Evidence:
  `test-results/ai-upgrade-20260929/mau10-so-mi-S-app-path.{png,json}`. Hitachi
  scene composition returned HTTP 200 in 1.35 s with `groundSafe=true`.
- On Redmi serial `ylbilfx8ors475kf`, the same photo showed the measurement
  groups above, generated the white shirt result with `DO VUA: RAT CHAT`,
  recommended XXL and showed the safe shoulder seam. The result then generated
  and played motion `motion-1790746309348-1hgjp3`: H.264, 384x640, 10 fps,
  3.3 s, 444150 bytes. CUDA reached 100% GPU utilization and about 10 GB VRAM;
  `/animate` returned HTTP 200. Screenshots are under
  `test-results/ai-upgrade-20260929/redmi-mau10-*-20260930.png`.
- Chat remained catalog-grounded: the live bikini price question returned
  `Bikini hai manh hoa anh dao: 790.000d` from the current product data. Targeted
  Node tests passed 51/51 in the final four-suite rerun, Python
  identity-quality tests 5/5 and mobile TypeScript passed.
  `./scripts/check-ai-ready.sh` reported try-on, motion and
  uploaded-photo vision READY. ADB reverse must be recreated after changing the
  phone USB mode or reconnecting; otherwise the already-open screen can retain
  a stale motion-not-ready state until its next successful 10 s refresh.
- `scripts/run_all.py` now retries the device HTTP probe after installing each
  ADB reverse rule. MIUI can deny/empty the shell-UID netcat response while the
  application UID uses the same tunnel successfully; in that observed case the
  launcher requires the exact `reverse --list` mapping and lets the app perform
  its normal API readiness requests. The same command now starts or preserves
  persistent `japano-phone-mirror` scrcpy. A complete rerun with the Redmi took
  11.7 s, reported every AI/database/Metro check ready, recreated 4100/8081 and
  opened the mirror.
- Body-analysis UI follow-up: a new photo still performs one real worker POST,
  but an already successful result now shows a green completion state and the
  action becomes `Kiem tra lai`. Rechecking the unchanged photo confirms the
  result locally instead of uploading the same ~250 KB payload again. This
  avoids an observed MIUI/ADB partial-upload socket timeout and makes the
  deterministic same-photo behavior visible. Mobile body-analysis timeout was
  reduced from 180 s to 20 s; Fast Refresh invalidates orphaned analysis tasks
  so the card cannot keep spinning after a bundle update. Redmi verification:
  fresh `mau-10-test.png` produced one HTTP 200 analysis and all five groups;
  recheck changed the visible timestamp without another POST. Evidence is in
  `test-results/body-analysis-debug-20260930/`.

### Image measurement training and dataset audit (2026-09-30)

- Celeb-FBI: 7,211 raw / 6,196 accepted, deterministic 4,958/619/619 split.
  ResNet18 direct-weight MAE6.903kg; ResNet18 BMI MAE7.151kg photo-only;
  DenseNet201 BMI MAE6.912kg; YOLO person-cropped ResNet18 MAE6.986kg. Fixed
  baseline is6.244kg. All completed RGB checkpoints are
  TRAINED_EXPERIMENTAL_NOT_PROMOTED.
- Amazon BodyM masks fully downloaded. One subject shared by published testA/
  testB was removed from validation (22 photos), keeping testB intact. ResNet18
  five-target held-out testB: height5.649cm, weight7.293kg, chest4.084cm,
  waist4.667cm, hip3.958cm. Improves baseline, but checkpoint is research-only
  because CC-BY-NC-4.0; no production integration.
- jpersonwiki prior trained from15,752 valid rows: held-out MAE6.379kg vs median
  baseline11.330kg. It requires known height and does not inspect images; not
  promoted. Extreme groups remain badly underrepresented.
- There is no validated 150kg claim: Celeb-FBI test has n=1 >=140kg and BodyM
  testB has n=0. Keep manual/reference priority and insufficient-evidence state.
- Consolidated evidence: `backend/ai_training/evaluation/body_training_20260930.json`.
  Detailed presentation/commands: `docs/README_AI_TRAINING.md`. External audit
  reviewed Digital Scale/WayBED, SHAPY, 2DImage2BMI, Body2BMI-ITU and CC-BY-4.0
  BODIES.

### ConvNeXt and BODIES follow-up completed (2026-09-30)

- Downloaded official Zenodo BODIES v1.0 `data16` female/male archives; local
  MD5 values match (`3254bf28fdc1d25004c24f756930791c` and
  `e3a213c1455a79d8c4d156735f48a02b`). Extracted dataset has 12,000 synthetic
  SUPR subjects, official 8,000/2,000/2,000 train/validation/test split and two
  512px views. Provenance: `body_dataset/provenance/bodies_zenodo.manifest.json`.
- ConvNeXt-Tiny BODIES checkpoint `2eabff59...4141c`: held-out synthetic MAE
  3.076kg photo-only and 1.249kg with known height; test ≥140kg n91 gives
  6.771/1.941kg. This is synthetic T-pose evidence only, not customer accuracy.
- ConvNeXt ImageNet-only on locked Celeb-FBI test gives 6.486kg photo-only and
  4.804kg with known height. Cropped version gives 6.594/4.810kg. BODIES-backbone
  initialization gives 6.620/4.876kg, so synthetic transfer does not improve
  over ImageNet initialization. None is connected to production.
- ConvNeXt batch192 was observed at 100% GPU utilization and 15,686/16,311MiB
  VRAM. Runs contain optimizer-updated reloadable checkpoints, TorchScript,
  SHA-256, epoch logs and held-out reports. Real Celeb-FBI test still has only
  n9 in 110-139kg and n1 at ≥140kg; exact 150kg photo claims remain unsupported.
## 2026-09-30 — backend latency and heavy-weight bias audit

- Live logs showed ordinary catalog requests at 0–69 ms, body analysis commonly
  at 1.6–1.8 s, and `/api/gpu/focus` blocking 7.5–8.9 s while FASHN repeatedly
  warmed, unloaded on a short `browse` focus, then warmed again.
- `FOCUS_PROFILES.home/browse` now retain FASHN until its own 180 s idle
  timeout. Chat and motion profiles still release it for VRAM. Measured after
  backend restart: cold try-on focus 7,515 ms, browse 10 ms, second try-on 9 ms.
  GPU/body worker tests passed 18/18 and mobile typecheck passed.
- Four live backend body-analysis requests (`mau-03/06/07/10`) completed in
  1,17–1,29 s and returned 100.3/79.4/111.8/84.2 kg. These synthetic profiles
  have no ground truth and only verify ordering/runtime.
- A locked Celeb-FBI heavy test audit found 21 usable hypotheses among 30 images
  labelled 92–151 kg: numeric MAE 18.10 kg, bias -15.79 kg, 12/21 below the
  filename label by at least 10 kg. Manual review found a `132w` outlier whose
  public celebrity metadata is not trustworthy contemporaneous ground truth.
  No global upward offset was promoted: validation bias was +10.72 kg
  below 50 kg but -10.54 kg at >=110 kg (only five usable heavy validation
  cases). Evidence: `backend/ai_training/evaluation/body_weight_bias_audit_20260930.json`.

### Wireless ADB recovery and live image generation (2026-09-30)

- The phone-side `Network request failed` was reproduced with both ADB reverse
  rules absent while backend/model services were healthy. Wireless debugging
  changed the Redmi endpoint from `192.168.100.26:43171` to `:39423`.
- `scripts/run_all.py` now follows the sole authorized online device when a
  supplied wireless serial is stale, restarts scrcpy with the current serial,
  and starts `japano-adb-reverse`. `scripts/adb_reverse_watch.py` reconnects an
  already paired device and restores reverse tunnels 4100/8081; it never pairs
  a new device or clears app data.
- Live fault injection removed all reverse rules. The watchdog restored both in
  about two seconds and remained active. The app then completed body analysis
  in 1,213 ms and `POST /api/tryon` returned HTTP 200 in 28,004 ms. The Redmi UI
  visibly reached `Hoan tat`, displayed the generated Kimono and `Do vua: Rat
  chat`. Evidence: `test-results/ai-upgrade-20260930/kimono-redmi-adb-recovery.png`.
  This validates one real device/image recovery path, not arbitrary-photo success
  or uninterrupted operation through every Wi-Fi failure.

### Guarded BODIES prior for very broad builds (2026-10-01)

- The production geometry estimate still under-read the generated broad-build
  profiles, especially `mau-07/10`. A trained BODIES ConvNeXt-Tiny TorchScript
  prior is now loaded once on CPU by the body worker. Runtime hash:
  `f032720235e3d53f8c22a727008ec1c55fec5d2d456004252bc2591f0be79562`.
- It is applied only to full-body images after the existing three-signal broad
  geometry gate and only when the checkpoint predicts at least 135kg. Final
  weight is capped at BMI49.8 relative to the displayed height, confidence is
  capped at0.45, uncertainty remains wide and `usableForSizing=false`. Manual
  weight retains priority. BMI plausibility was aligned from45 to50 because
  `estimate_weight` already used50; values over50 still fail closed.
- Ten generated profiles now return 49.5/55.9/137.2/51.3/54.9/79.4/137.2/
  52.3/51.4/128.9kg. Only `mau-03/07/10` activate the heavy prior; moderate
  `mau-06` and all non-broad profiles are unchanged. This is a behavior check
  without measured ground truth, not an accuracy benchmark.
- Redmi verification on `mau-07` visibly showed weight group132-142kg, height
  group161-171cm and the five prediction fields. Evidence screenshot:
  `test-results/body-analysis-debug-20260930/redmi-heavy-bodies-prior.png`.
  Machine-readable audit:
  `backend/ai_training/evaluation/broad_build_prior_20261001.json` SHA-256
  `e9c473e2619f87834dc99c4f4a1f289cc0d4f8d5beb5890888fcd032b1bfa24b`.
- Targeted body-analysis tests pass18/18. The broader measurement-regression
  suite still has four known unrelated failures around missing torso calibration,
  uncertainty-vs-display contract and one synthetic torso-width assertion.

### Two real-photo body-analysis recovery (2026-10-01)

- The two Messenger photos on the Redmi exposed two different states. The
  seated photo is cropped below the knees. It now uses the experimental
  person-crop ConvNeXt fallback instead of returning an empty card. The live
  worker returns 161.4cm / 56.6kg and population-prior girths
  87.0/76.4/95.3cm; mobile renders the corresponding ten-unit groups. These
  values are low-confidence statistical suggestions and remain
  `usableForSizing=false`.
- The standing white-dress photo is full body. The live worker returned in about
  1.2s and the Redmi visibly displayed 157-167cm, 43-53kg, bust74-84cm,
  waist60-70cm and hip80-90cm. These are uncalibrated statistical suggestions,
  not verified measurements.
- `/api/stylist/body-analysis` previously ran the adult-image vision gate when
  the currently viewed product required18+, even though the route only measures
  body geometry. That gate could exceed the mobile 20s timeout after the CPU
  worker had already finished. The route now returns the measurement directly;
  the mandatory adult gate remains in `POST /api/tryon` before inference.
- Evidence screenshot:
  `test-results/live-debug/real-fullbody-selected-final.png`. Targeted backend
  tests pass26/26, mobile typecheck passes and the live full-body POST completed.

### Partial-body and seated-photo fallback (2026-10-01)

- Runtime now loads the Celeb-FBI person-crop ConvNeXt-Tiny TorchScript on CPU
  for photos classified as less than full-body with pose/analysis confidence at
  least0.35. Checkpoint SHA-256 is
  `615cfb1f19c95c8cb40834911250a700c5e94ff12f9b538d27debed2bbf36c1d`.
  It was fine-tuned with optimizer updates on 4,958 training identities and its
  locked test gives 6.116cm height MAE and 6.594kg photo-only weight MAE. That
  test is celebrity metadata, not customer-photo accuracy.
- Missing circumference rows use a new ANSUR II height+BMI population prior,
  trained on 3,883 rows with 971 validation and 1,214 held-out test rows. Test
  MAE is 2.954cm chest, 3.612cm waist and 3.090cm hip for the table-to-table
  task. Runtime hash is
  `9f6bf3f477aa3a448798be1d27790d47096dc1c28d9810658d2349775cfe5b6e`.
  Photo model error is additional, and ANSUR military personnel are not the
  target customer population.
- Partial outputs have confidence0.16-0.28, broad uncertainty, source/model/hash
  metadata, `measurementStatus=partial` and `usableForSizing=false`. Mobile
  displays them but does not persist them or automatically change size.
- Direct warm-worker verification on the seated Redmi photo completed in1.604s
  and returned all five suggestions. Focused tests pass25/25 Python and30/30
  Node; mobile TypeScript passes. The broad legacy regression suite retains its
  known calibration/old-bin failures and was not reported as green. Visible
  device evidence: `test-results/live-debug/partial-seated-visible-final.png`.
- Additional crops of the standing real photo verified missing-feet,
  upper-body-only and head-removed paths. All returned `measurementStatus=partial`,
  five numeric suggestions and `usableForSizing=false`. A photo counts as full
  body only when coverage, head and feet are all present.

### Wireless Metro LAN rerun (2026-10-01)

- Redmi wireless ADB is currently authorized at `192.168.100.26:37267`; this
  port is ephemeral. ADB reverse handled small API traffic, but a fresh Metro
  bundle built a multi-megabyte send queue and stalled at 50 percent when routed
  through reverse 8081. The same phone reached host LAN `192.168.100.10:8081`
  directly and Metro bundled the app in 561ms.
- `scripts/run_all.py` now always starts Expo with `--host lan`. For a wireless
  serial it derives the workstation LAN address from the route to the phone and
  updates only React Native's `debug_http_host`; USB/emulator keeps
  `127.0.0.1:8081`. Preference writes use a base64 payload inside app `run-as`,
  avoiding the earlier nested-shell truncation risk. Credentials and app data
  are untouched; API traffic remains on reverse 4100.
- Fresh `./run-all.sh --device 192.168.100.26:37267` completed in about 11.6s,
  reported database, body analysis, normal/bikini try-on, pose edit, motion
  CUDA, chatbot adapter and Metro ready, recreated both reverse rules and opened
  persistent scrcpy. The real device rendered the catalog home after login;
  evidence: `test-results/live-debug/wireless-full-rerun.png`. This validates
  startup/navigation on the current Wi-Fi, not generation success for every
  customer image.

### Kimono Tomesode construction fix on Redmi (2026-10-01)

- Root cause was the approved flat-lay allowlist, not the catalog metadata.
  `kimono-tomesode-den` already declared `garmentType=kimono` and had a clean
  `kimono-tomesode-den_tryon-flat.png`, but `resolveGarmentImage()` skipped it
  because the slug was absent from `APPROVED_TRYON_FLATS`. Runtime therefore
  sent `kimono-tomesode-den_1.jpg` as a model photo to FASHN `one-pieces`, which
  repeatedly converted the garment into a short western dress.
- The Tomesode flat-lay is now explicitly approved. Node sends
  `garment_photo_type=flat-lay` plus `garment_type=kimono`; FASHN routes that
  pair to the single-pass FLUX multi-reference `japanese-full-length` path.
  The structural quality gate rejects exposed upper arms or excessive exposed
  legs, so short, sleeveless and off-shoulder outputs fail closed.
- Targeted Node tests pass 50/50, including a regression assertion for the exact
  Tomesode resolver. Live wireless Redmi generation completed and visibly kept
  the crossed collar, wide sleeves, obi, ankle-length wrap and pine print.
  Engine observed during completion:
  `flux2-klein-4b-japanese-full-length+fast-16steps+adaptive-low-memory`.
  Evidence: `test-results/live-debug/kimono-fix/phone-kimono-fixed.png` and the
  byte-identical raw output `phone-kimono-fixed-raw.png`, SHA-256
  `486c23225033c2c5ed26840fa1fde0e76f7bd52ba3c89293f73039670aff4bb5`.

### Wedding-flower subject-selection body analysis fix (2026-10-01)

- The current Redmi photo contains one real full-body person in the centre and
  tall wedding flower structures at both sides. YOLO detected the person at
  confidence 0.893, but also produced false person boxes at 0.193 and 0.236.
  The previous ranking weighted box height heavily and confidence only x0.5,
  so the tall right flower structure won and body analysis returned five empty
  measurements with `poseConfidence=0.193`.
- `accessory_pipeline.analyze()` now uses `center-person-v1`: among reliable
  YOLO candidates, the centre distance dominates while confidence and visible
  shoulder/hip joints reject false people; apparent size only breaks ties. Body
  analysis and try-on share that pose. The try-on route refuses an older cached
  pose without this strategy marker, preventing its former largest/nearest rule
  from selecting another person. On the exact photo, the central real person
  scores 15.3297; the two flower false positives score 7.8277 and 6.7875.
- Mobile `Kiểm tra lại` now invokes `runBodyAnalysis()` on the displayed image
  even when an older result exists. Previously it only changed a timestamp, so
  stale failures survived worker/model fixes.
- Focused Python tests pass 62/62, including centred three-person, larger person
  at the edge, false object at centre and the real flower-arch regression. Node
  tests pass 57/57. Mobile TypeScript
  passes. On wireless Redmi the visible groups are height 158–168cm, weight
  48–58kg, bust 80–90cm, waist 64–74cm and hip 78–88cm at medium confidence.
  They remain statistical suggestions with `usableForSizing=false`. Evidence:
  `test-results/live-debug/body-current/phone-current-predictions-visible.png`.

### Multi-person centre isolation for try-on (2026-10-01)

- A real Redmi input at 2048x1366 contained four people. The prior try-on reused
  a source-coordinate body pose without regenerating `normalizedImageBase64`,
  then explicitly restored secondary-person boxes after generation. The visible
  result dressed the central woman but retained all three surrounding people
  and produced a poorly framed landscape strip.
- Multi-person pose caches now force a fresh `analyze` pass. It crops the chosen
  central subject to 768x1024, restricts U2Net to the primary box and composites
  that component onto a neutral gradient before VTON. `otherBoxes` is cleared
  after isolation and both secondary-person restore calls were removed.
- On the exact current Redmi source the pipeline chose the blue Ao Dai wearer,
  reported four reliable candidates, removed the two secondary people intersecting
  the normalized crop and produced `test-results/live-debug/current-review/current-isolated.jpg`.
- A fresh live Kimono request completed HTTP 200 in 53,045 ms. The Redmi result
  contains only the selected woman on a clean portrait background; the three
  surrounding people are absent. Visible evidence is
  `test-results/live-debug/current-review/phone-isolated-result-visible.png`.

### Seated JPEG classification and mobile try-on unblock (2026-10-01)

- Exact failure reproduced on `FB_IMG_1790834806848.jpg`: the original JPEG
  classified coverage=`knee`, but Android/ImagePicker-style quality-82
  recompression nudged ankle confidence above the visibility threshold and
  classified the same seated pose as coverage=`full`. The evidence policy then
  skipped the partial-photo checkpoint and returned five empty values.
- `body_analysis.is_seated_pose()` now uses two reliable hip-to-knee vectors.
  Two near-horizontal thighs mark the floor/cross-legged pose independently of
  ankle visibility. `analyze_body()` invokes the partial checkpoint for that
  posture and exposes `quality.seatedPose`; the public evidence policy excludes
  it from the standing-photo branch and permits the low-confidence partial
  branch. Both JPEG variants now return height149-159cm, weight42-52kg and
  bust/waist/hip78-88/66-76/82-92cm, `measurementStatus=partial`,
  `usableForSizing=false`.
- The first live try-on attempt exposed a second issue before inference:
  `saveStyleProfile()` could hang inside MIUI AsyncStorage, so no
  `POST /api/tryon` reached the backend after FASHN warmup. The shared storage
  function is CRITICAL impact and was left unchanged. Only the try-on `run()`
  caller now races the save against a 1.5s fallback to the current profile.
- Redmi verification after worker restart visibly showed all five ranges. A
  fresh seated-photo Yukata request then reached GPU inference and returned
  HTTP200 in47,571ms. A separate exact quality-82 API verification returned
  HTTP200 in55.348s with engine
  `flux2-klein-4b-pose+fashn-vton-1.5+fast-16steps+adaptive-low-memory`; visual
  review confirmed crossed collar, obi, wide sleeves and full-length Yukata.
  The opt-in debug artifact is
  `test-results/live-debug/seated-current/seated-yukata-direct.jpg`. Evidence
  screenshots are in the same directory. Body-evidence tests pass8/8 and
  mobile TypeScript passes. The wider legacy body regression suite still has
  four pre-existing calibration/old-bin failures and is not reported green.

### Mobile try-on stale backend timeout fix (2026-10-01)

- A Redmi try-on spinner exceeded 600 seconds while the GPU was idle and the
  active backend had received no new `POST /api/tryon`. Root cause was the
  shared request fallback applying the 720-second inference timeout to each
  candidate address: a stale Wi-Fi/Metro base could consume 12 minutes before
  ADB reverse or Tailscale was attempted.
- `generateTryOn()` now performs a 2.5-second `/api/health` discovery first,
  making `activeBase` point to a reachable backend before the long POST. Its
  default inference ceiling is 180 seconds. The try-on screen also sends GPU
  focus and saves the style profile in the background; neither is on the
  request's critical path.
- GitNexus marked `generateTryOn` HIGH impact because normal try-on and Japan
  travel try-on share it. Payload/result behavior was left unchanged. Mobile
  TypeScript passed, the fresh Metro bundle loaded on Redmi through
  `192.168.100.10:8081`, and backend health over ADB reverse was live. A
  pre-fix bikini request was observed aborting after 60.777 seconds while its
  worker finished afterward; do not count that interrupted request as a
  successful visible device result.
- A second failure exposed repeated same-focus transitions in `setFocus()`.
  App/navigation signals for `swimwear -> swimwear` each appended another full
  model release operation, so the adult-image gate did not finish until the
  client's 180-second timeout; FLUX then generated an orphan result after the
  client had disconnected. Same-focus, non-forced signals now still perform
  owner-scoped cancellation but skip duplicate resource transitions.
- After backend restart, the exact current Redmi photo passed the adult gate in
  about 10 seconds, FLUX `/swimwear-tryon` completed in about 29 seconds and the
  full `POST /api/tryon` returned HTTP 200 in 47,564 ms. The two-piece cherry
  blossom bikini result was visibly rendered on Redmi. Evidence:
  `test-results/live-debug/bikini-focus-fix/result-visible.png`. The targeted
  GPU queue/adult-gate suite passes 19/19.

### Try-on request lifecycle, Wi-Fi upload and swimwear gate fix (2026-10-01)

- A newly selected photo could display the timeout from the previous request:
  `choose()` cleared the banner, but the old async `run()` later caught its
  timeout and wrote it back. `tryOnVersion` now isolates every run/image/product;
  stale success, error and loading callbacks are ignored. `/api/tryon/cancel`
  cancels only the matching `clientId`, and a disconnected HTTP socket cancels
  its active GPU job instead of leaving orphan inference.
- ImagePicker quality-82 bytes are now the single preview/analysis/try-on source.
  The old helper preferred rereading the original content URI. A measured old
  upload sent only 475,136/879,595 bytes in 102,065 ms through wireless ADB and
  aborted before Express parsed JSON.
- `run-all.sh --device 192.168.100.26:37267` now derives the workstation LAN
  address and starts Metro with `EXPO_PUBLIC_API_URL=http://192.168.100.10:4100`.
  The configured endpoint is always tried before remembered fallbacks, so an
  earlier backend restart cannot pin later image uploads to `127.0.0.1`.
  Device logs confirmed direct `192.168.100.26 -> 192.168.100.10:4100` requests.
- Swimwear no longer treats `body_changed_not_garment` alone as a hard failure:
  replacing a long dress legitimately changes the newly exposed abdomen/legs.
  Face loss, subject loss, missing garment and blur remain hard failures; final
  chest/pelvis/buttocks coverage is still a blocking gate. Two post-fix live
  requests returned HTTP 200 in 43,499 ms and 45,974 ms. The user continued
  changing photos during device validation, so those 200 responses are runtime
  evidence rather than a stable final-result screenshot for the last photo.
- Verification: mobile TypeScript passes; focused Node try-on/GPU suite passes
  38/38, including the swimwear-specific regression; `git diff --check` passes.
- Android may retain Facebook/Gallery above JAPANO after image selection, so a
  plain `am start` can reopen that external screen. The one-command launcher now
  force-stops only `vn.japano.app` before starting `MainActivity`; app data and
  phone photos remain intact. A live restart loaded the Metro bundle in 341 ms
  and visibly returned to the JAPANO product screen on Redmi/scrcpy.
- A bare `./run-all.sh` used to calculate the Metro API URL from `args.device`
  before discovering the live wireless serial. With no explicit `--device`, it
  compiled `http://127.0.0.1:4100` into the bundle and reused that healthy but
  stale Metro process, sending large try-on photos through ADB reverse. The
  launcher now resolves the one online device first and restarts Metro when its
  compiled API URL differs. Expo's primary scheme is also explicitly `japano`;
  native Google Sign-In does not use the old reverse-client URI scheme.
- Live validation after the launcher fix used bare `./run-all.sh`: Metro changed
  from `http://127.0.0.1:4100` to `http://192.168.100.10:4100`, scrcpy remained
  active, and the current Redmi photo completed `POST /api/tryon` with HTTP 200
  in 39,807 ms. The result visibly reached step 3 in the mobile UI.
- Google login is separately blocked before the backend: logcat reports Google
  Play Services `DEVELOPER_ERROR`. `/api/auth/providers` returns `google:true`,
  app/backend Client ID hashes match, and the installed debug APK SHA-1 is
  `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`. Google Cloud
  must contain an Android OAuth client for that exact package/fingerprint; do
  not weaken token signature/audience verification as a workaround.
- Later the Redmi wireless serial became `offline` while the phone still
  answered ping. mDNS advertised no `_adb-tls-connect` service and the old port
  refused connections, so software could not reconnect until Wireless debugging
  is enabled again or USB is attached. The launcher now fails closed in this
  state, stops the stale mirror, disables scrcpy restart thrashing, and waits
  through the scrcpy handshake before printing that the mirror is open.
- The latest sleeveless-top result visibly changed the subject into a stiff,
  splayed stance although no repose stage ran (`fashn-vton-1.5` only). Root
  cause was FASHN defaulting to `segmentation_free=true`, allowing a top edit to
  redraw unrelated limbs. Human parsing is now the default; whole-image mode is
  explicit opt-in. The quality gate also compares normalized elbow/wrist/knee/
  ankle positions and hard-rejects unexpected multi-joint drift.
- Post-fix local real-photo verification used a seated subject with one bent leg
  and the sleeveless-wave top. FASHN returned HTTP 200 in 28.6s with
  `reposed=false`; visual review retained the seated pose, counter-supporting
  hand, bent leg, face and background. Six comparable joints had mean normalized
  drift 0.018, max 0.041, zero above 0.16. Artifact:
  `test-results/live-debug/pose-preserve-fix/top-result.png`.
- Repose `relaxed` no longer uses the rigid wide symmetric stance. Its skeleton
  uses a natural feminine catalog stance: one weight-bearing leg, the other foot
  half a step behind and inward, subtle opposing shoulder/hip tilt, one softly
  lowered arm and one slightly bent arm. The default FLUX re-pose pass increased
  from 4 to 6 steps because the 4-step result ignored the subtle guide and stayed
  symmetric. Explicit male profiles select `relaxed-masculine` with the former
  neutral hip-width geometry. Unknown profiles use the natural fashion stance;
  the system does not infer gender from facial appearance.
- Live local validation on 2026-10-01 forced a seated real-photo subject through
  re-pose plus FASHN fast. It returned HTTP 200 in about 52 seconds and visual
  review confirmed a complete, natural narrow stance with one foot behind in
  both the intermediate and final image. Evidence:
  `test-results/live-debug/pose-guides/feminine-standing-v2-reposed.png` and
  `test-results/live-debug/pose-guides/feminine-standing-v2.png`.
- Preserve-pose policy is conservative: valid standing photos retain their
  original pose even when side-on, shoulder-tilted, leaning, arms-raised or
  cross-legged. Automatic re-pose is limited to `occluded_torso`, an explicit
  travel-pose selection, or the diagnostic force flag. Cropped ankles alone do
  not trigger whole-person generation. Regression coverage lives in
  `backend/test/tryon-pose-policy.test.js`.
- Redmi device verification after the backend restart reused the photo still
  cached by the app and completed a live Haori try-on. The result retained the
  source head tilt, hands together in front and standing geometry, and the UI
  no longer displayed the pose-transfer identity warning. The cached input was
  itself a screenshot of an older bikini result, so this validates pose-policy
  delivery on-device but is not a clean garment-fidelity benchmark. Screenshot:
  `test-results/live-debug/current-pose-policy/redmi-regenerated-final-clear.png`.
- A later live seated red-dress + Haori request generated two valid FASHN images
  but returned 503 because both were rejected as `pose_changed_unexpectedly`.
  Exact replay showed stable legs (all knee/ankle drift <= 0.115), while only
  elbow/wrist detections shifted under the new sleeves. Pose rejection now
  requires changed joints in both arm and leg groups; arm-only detector drift no
  longer discards an otherwise deliverable image. Evidence is under
  `test-results/live-debug/pose-gate-failure/`.
- The next Redmi photo exposed a separate false rejection:
  `garment_construction_exposed:upperArms` was applied to the short-sleeve
  `haori-song-nami` SKU. Construction zones are now product-overridable through
  explicit `constructionCoveredZones` metadata; an empty array is intentional.
  Nami declares short sleeves and no upper-arm construction lock, while default
  long-sleeve Haori and Kimono/Yukata retain their construction gates.
- The Nami metadata was corrected in both JSON catalog snapshots and the live
  MongoDB `products` document. Exact replay of the seated balloon photo returned
  HTTP 200 in 64.470s; the Redmi retry returned HTTP 200 in 26.786s.
- A later seated red-dress + long Yukata request showed why a global joint-drift
  rule still failed: wide sleeves and the long hem hid both arm and leg joints,
  so the detector followed cloth edges even though face, hands, feet and seat
  anchors stayed stable. The quality payload now marks only the limb groups
  hidden by the product's construction metadata. Raw drift remains visible for
  diagnostics, but hidden groups cannot by themselves trigger
  `pose_changed_unexpectedly`; face, subject, torso, blur, garment and coverage
  gates remain active. Exact Yukata replay returned HTTP 200 in 40.237s with no
  rejected attempt. Three consecutive Redmi requests then returned HTTP 200 in
  27.643s, 55.944s and 25.800s. The last standing-photo result was visibly shown
  at step 3 in `test-results/live-debug/pose-gate-failure/phone-standing-result-visible.png`.
- Focused verification after these changes: 67/67 Node garment/try-on tests,
  9/9 Python identity/pose tests and 26/26 Python coverage tests pass. The test
  artifacts in `test-results/live-debug/pose-gate-failure/` retain the exact
  sources, rejected candidates, direct replay results and Redmi screenshots.
- A cropped standing photo must retain its original gesture. The long-Japanese-
  garment missing-ankles shortcut was removed from automatic re-pose: cropped
  feet describe the input framing and do not justify redrawing the head, hands,
  held object or gaze. Regression coverage is in
  `backend/test/tryon-pose-policy.test.js`.
- Passive `home`/`browse` focus signals no longer cancel an active GPU image
  job. Explicit image replacement still cancels through `/api/tryon/cancel`,
  while actual GPU features (`chat`, `tryon`, `motion`, `vision`) retain their
  resource arbitration rules. This fixes the phone race that returned 409 about
  three seconds after starting while FASHN later generated an unused image.
- Legacy `blazer-kaki` was catalogued under `category=haori`; the Haori
  construction gate consequently rejected its valid rolled sleeves as exposed
  upper arms. It now declares `garmentType=blazer` in JSON and live MongoDB,
  with a modern outerwear profile and name fallback that do not weaken Japanese
  garment checks. The focused Node suite passes 77/77.
- Exact replay with `source-camera-red.jpg` + `blazer-kaki` returned HTTP 200 in
  29.673 seconds. A Redmi Wi-Fi retry returned HTTP 200 in 30.104 seconds and
  visibly reached step 3 while retaining the source head angle, both hands and
  camera gesture. Evidence:
  `test-results/live-debug/pose-gate-failure/camera-blazer-pose-preserved.png`
  and `test-results/live-debug/pose-gate-failure/phone-camera-blazer-preserved.png`.
- A seated table photo failed three times with HTTP 503 `pose_not_corrected`.
  Only both hip keypoints were inferred, but `occluded_torso` forced a full
  standing re-pose; the resulting dress then hid the hip detector and the
  quality gate incorrectly declared the successful standing result uncorrected.
  `needsPoseCorrection()` now reserves automatic reconstruction for cases where
  both shoulder anchors and both hip anchors are missing. Seated/partial photos
  with visible shoulders go directly through VTON and retain their gesture.
- The focused Node suite passes 78/78 and mobile TypeScript passes. Exact replay
  of the seated source crop with `vay-lien-sakura` returned HTTP 200 in 50.378s,
  preserving the tilted head, chin-supporting hand, table arm and background.
  The contemporaneous Redmi then completed two bikini requests with HTTP 200 in
  39.021s and 73.410s. Evidence:
  `test-results/live-debug/seated-tryon/direct-seated-dress.png`.
- A later raised-hand photo in a long dress exposed a swimwear-specific pose
  false positive. Replacing opaque fabric reveals knees that the source pose
  detector could only guess, so two visually usable raised-hand bikini results
  were rejected as `pose_changed_unexpectedly`. The hard-failure policy now uses
  visible arm drift for swimwear: severe/multiple arm movement still blocks,
  while leg-only drift plus mild arm detector noise becomes a quality warning.
  Face, main-subject, blur, garment and final coverage gates remain blocking.
- Focused Node verification now passes 79/79 and mobile TypeScript passes. The
  exact Redmi retry returned HTTP 200 in 78.363s and visibly reached step 3 with
  the raised palm, body angle and stair background retained. Evidence:
  `test-results/live-debug/bikini-pose-gate/phone-success.png`.

### USB full-stack recovery and Yukata upper-arm false rejection (2026-10-02)

- Redmi Note 8 Pro was connected by USB as `ylbilfx8ors475kf`. `./run-all.sh`
  started supervised Ollama, body analysis, FASHN, motion, chat adapter,
  backend, storefront and Metro services; ADB reverse 4100/8081, its watchdog
  and scrcpy were active. MongoDB health was connected.
- Real smoke checks passed: catalog-grounded LangGraph chat returned the live
  two-piece bikini and price; bikini try-on returned a 980 KB image in 62.465s;
  the same result composed into the curated Hitachi scene at 1024x1536 in
  1.99s; motion returned a 492,502-byte ISO-BMFF MP4 in 66.62s.
- The phone's real Yukata request generated two images but returned 503 because
  both carried only `garment_construction_exposed:upperArms`. Upper arms are not
  a mandatory safety zone, and this detector is noisy on a raised arm holding a
  bag. That single reason is now a soft quality warning; face/body changes,
  sensitive zones and all other construction regions remain hard failures.
- Exact replay using the current phone photo and `yukata-xanh` returned HTTP
  200 in 29.399s with a 960x1280 PNG and the upper-arm warning. Visual review
  confirmed the original face, pose and background were retained. Focused Node
  garment/try-on verification passes 65/65.

### Furisode flat-lay, ankle gate and Android response size (2026-10-02)

- The raised-hand yellow-dress photo was not the failure source. The resolver
  selected `kimono-furisode-do_1.jpg`, a catalog model photo, because the SKU
  was absent from the approved flat-lay set. Both generated candidates became
  short red dresses and were correctly rejected. `kimono-furisode-do` now
  resolves to the reviewed `kimono-furisode-do_tryon-flat.png`; a regression
  test locks that behavior.
- With the correct flat-lay, visual inspection showed a valid black Furisode
  with wide sleeves, obi and ankle-length hem while retaining the original
  face, raised palm and stair background. Coverage measured 0.0789 skin in the
  leg box because bare feet/ankles are included in that box. The construction
  limit for legs is now 0.10; the synthetic regression accepts a small ankle
  strip while the full exposed-leg/short-hem case remains blocked.
- Exact API replay returned HTTP 200 in 44.66 seconds at 960x1280. The original
  PNG response was 2,599,058 bytes and the Redmi React Native fetch remained
  stuck after the server completed. FASHN now accepts `response_format=jpeg`;
  the Node route requests JPEG quality 92. Revalidation returned HTTP 200 in
  46.24 seconds with a 611,286-byte JSON response and a 454,536-byte image.
- A fresh tap on Redmi after reselecting the same Messenger photo reached the
  backend and returned HTTP 200 in 35.948 seconds. The device had navigated
  back to the product page before the final screenshot, so this proves device
  request/delivery success but is not a retained visible step-3 result.
- Focused validation: 66/66 Node garment/try-on tests, 27/27 Python coverage
  tests, Python compilation and Node syntax checks pass.
