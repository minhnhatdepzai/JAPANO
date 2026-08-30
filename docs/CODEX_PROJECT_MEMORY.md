# JAPANO project memory

Last updated: 2026-08-30. This is the short source-of-truth index for coding
agents. It contains no credentials and does not replace source code or tests.

## Repository and collaboration

- Monorepo: Expo SDK 51 / React Native 0.74 mobile, Express backend and static
  Web Admin. Current intended branch is `main`; never create or switch branches
  without an explicit request.
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
- Japan spots went from 20 to 25 in `mobile/lib/japanSpots.ts`; the backend table
  must stay in step and `backend/test/japan-scene.test.js` compares the two files
  directly.
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

## Current user-facing work

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
- App try-on requests the `balanced` FASHN profile: 20 diffusion steps and a
  1536-pixel long edge. Optional FLUX fidelity is skipped for ordinary garments;
  structure-critical outerwear such as long Haori still keeps it because the
  37.6 s no-fidelity experiment visibly shortened/mis-shaped the garment. That
  accepted Haori path measured about 75 s. Do not claim a universal sub-minute
  time. This is inference optimization, not model fine-tuning; `/health` still
  reports no configured/loaded fit LoRA or checkpoint hash.
- `npm run check` passed with 342 Node tests, mobile TypeScript and 102 Python
  tests (2 existing skips). Body analysis of a non-preset test image returned in
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
- Current Android release `1.0.13` uses `versionCode 14` and contains the new
  React Bits-inspired home hero/AI Studio FadeContent. Install it over the prior
  APK (`adb install -r` or normal Android update), never uninstall-first, so app
  data is preserved. It is served at
  `https://rd-system.tail6502ce.ts.net:4101/api/apk/app-release.apk`; SHA-256 is
  `56bfdea5f4f5b84b8aa689417e5998e805c2a89c4eadf4614d351b69b5633445`
  (123,394,198 bytes). Package `vn.japano.app`, version metadata, targetSdk 34,
  signing certificate SHA-1
  `5e8f16062ea3cd2c4a0d547876baa6f38cabf625`, APK MIME/length and full tailnet
  download hash were verified. The signing certificate matches prior APKs.
  Build and mobile typecheck pass, but `adb devices` was empty, so v1.0.13 has
  not been update-installed or visually verified on a phone. The previous
  v1.0.12 release was visually verified on Redmi Note 8 Pro.
- Release builds need JDK 17. The JDK 21 install on this machine has no `jlink`,
  so Gradle fails in `androidJdkImage`. Use
  `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew assembleRelease`.

## Web storefront (2026-08-30)

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
