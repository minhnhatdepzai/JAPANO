# Evidence: Feature Inventory

Status: synthesized from the verified mobile screen inventory (33 files under `mobile/app/`) and the verified 109-endpoint backend API (`api-inventory.md`), cross-referenced so every feature listed here has both a UI entry point and a working backend endpoint, unless explicitly flagged otherwise. A repo-wide grep for coin/mini-game/gacha/XP/leaderboard terms across `mobile/app`, `mobile/lib`, `mobile/components` found **zero matches** — the prior draft's claimed "Games: Caro AI, Sudoku AI, Né quái vật, Trú mưa" and coin economy do not exist anywhere in this codebase and must not appear in the thesis.

## 1. Account and identity

| Feature | Mobile entry point | Backend endpoint(s) | Status |
|---|---|---|---|
| Registration with live password-strength meter | `mobile/app/register.tsx`, `mobile/lib/passwordStrength.ts` | `POST /api/auth/register` | Working |
| Login | `mobile/app/login.tsx` | `POST /api/auth/login` | Working |
| Forgot/reset password (6-digit code) | `mobile/app/forgot-password.tsx` | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | Working; email delivery uses a sandbox mailbox unless real SMTP is configured (`backend/lib/mailer.js`) |
| Session persistence | `mobile/lib/auth.tsx` (JWT in `expo-secure-store`) | `GET /api/auth/me` | Working |
| Google/Apple social login | `mobile/app/login.tsx` buttons | none | **Not implemented** — buttons only call `showToast('...sẽ sớm ra mắt')` (stub) |
| Profile info edit | `mobile/app/profile.tsx` | none reachable from this screen | **Not functional** — form inputs are uncontrolled (`defaultValue` only, no `onChangeText`); "Lưu thay đổi" calls only `router.back()`, no API call |
| App settings (dark mode, font size, language, push toggle) | `mobile/app/settings.tsx` | — | **Mostly not persisted** — local `useState` only, except the "botchat Ori" toggle, which genuinely persists via `lib/botchat.tsx` |
| Guest browsing | `AuthGate` allow-list, `mobile/app/_layout.tsx:24-29` | — | Working — browsing catalog/product/category requires no login; cart/wishlist/chat/try-on/checkout do |

## 2. Catalog, search, and product detail

| Feature | Mobile entry point | Backend endpoint(s) |
|---|---|---|
| Home feed (personalized recs, daily outfit, categories) | `mobile/app/(tabs)/index.tsx` | `GET /api/recommendations/home`, `GET /api/outfits/today`, `GET /api/products`, `GET /api/categories` |
| Full catalog browse + fuzzy search (hand-rolled Levenshtein) + sort | `mobile/app/(tabs)/products.tsx` | `GET /api/products`, `POST /api/search-log`, `POST /api/interactions` |
| Category browse | `mobile/app/category/[cat].tsx` | `GET /api/products` (client-side filter) |
| Product detail (gallery zoom, AI photo description, outfit cross-sell, related products, reviews) | `mobile/app/product/[slug].tsx` | `GET /api/products/:slug/ai-description`, `GET /api/outfits/:slug`, `GET /api/products/:slug/related`, `GET /api/products/:slug/reviews`, `POST /api/reviews/:id/reaction` |
| Product videos | (embedded in product detail) | `GET /api/products/:slug/videos/:index` |

## 3. Shopping (cart, wishlist, checkout, orders)

| Feature | Mobile entry point | Backend endpoint(s) |
|---|---|---|
| Wishlist | `mobile/app/(tabs)/wishlist.tsx` | `GET /api/wishlist`, `POST /api/wishlist/sync` |
| Cart, voucher application, Flagcard-eligibility banner | `mobile/app/cart.tsx`, `mobile/components/VoucherPicker.tsx` | `POST /api/carts/sync`, `POST /api/vouchers/validate` |
| Address book | `mobile/app/addresses.tsx` | full CRUD, `backend/routes/addresses.js` (5 endpoints) |
| Checkout — COD | `mobile/app/checkout.tsx` | `POST /api/orders` |
| Checkout — Stripe card (native CardForm), saved cards | `mobile/app/checkout.tsx` | `POST /api/stripe/payment-intent`, `GET/DELETE /api/stripe/cards`, `POST /api/stripe/payment-intent/confirm` |
| Checkout — VNPay Sandbox (embedded WebView) | `mobile/app/checkout.tsx` | `POST /api/vnpay/payment-url`, `POST /api/vnpay/return` |
| VIP 10% one-item discount at checkout | `mobile/app/checkout.tsx` | `GET /api/vip/status/:userId` |
| Order confirmation / payment result polling | `mobile/app/success.tsx`, `mobile/app/payment-result.tsx` | `GET /api/payments/:id` |
| Order history (active/history tabs) | `mobile/app/orders.tsx` | `GET /api/orders` |
| Order detail, delivery timeline | `mobile/app/order/[id].tsx` | `GET /api/orders/:id` |
| Cancel request (pre-shipping) | `mobile/app/order/[id].tsx` | `POST /api/orders/:id/cancel-request` |
| Return/refund request (post-delivery, ≥1 required photo) | `mobile/app/order/[id].tsx` | `POST /api/orders/:id/returns` |
| Product review after purchase (rating + comment + optional video/audio) | `mobile/app/order/[id].tsx`, `mobile/components/MediaAttach.tsx` | `POST /api/products/:slug/reviews` |

## 4. AI-assisted shopping

| Feature | Mobile entry point | Backend endpoint(s) |
|---|---|---|
| "Ori" chat assistant (full-screen) | `mobile/app/chat.tsx` | `POST /api/stylist/chat` |
| "Ori" floating chat bubble (app-wide) | `mobile/lib/botchat.tsx` | `POST /api/stylist/chat` |
| Camera-based style/outfit recommendation ("JAPANO Lens") | `mobile/app/camera.tsx` | `POST /api/stylist/recommend` |
| Virtual try-on (photo → AI-composited outfit image) | `mobile/app/tryon.tsx` | `POST /api/tryon` |
| "Ảnh sống" motion video generation | `mobile/app/tryon.tsx` | `POST /api/tryon/motion`, `GET /api/tryon/motion/presets`, `GET /api/tryon/motion/video/:id` |
| Size advice | product detail / try-on flow | `POST /api/stylist/size` |
| Style/body profile | `mobile/lib/profile.ts`, `POST /api/stylist/profile` |
| Shopping/wellness goal plans (savings plan, optional Ollama coaching) | `mobile/app/goals.tsx` | `POST /api/goals/plan`, `GET /api/goals/:userId` |

## 5. Content and loyalty

| Feature | Mobile entry point | Backend endpoint(s) |
|---|---|---|
| Japan destination explorer (region→prefecture→spot drill-down, interactive map) | `mobile/app/explore-japan.tsx`, `mobile/components/JapanMap.tsx` | `GET /api/japan-spots/reviews`, `GET /api/japan-spots/suggestions` |
| Community spot reviews/suggestions | `mobile/app/explore-japan.tsx` | `POST /api/japan-spots/reviews`, `POST /api/japan-spots/suggestions` |
| Daily "spot of the day" popup | `mobile/components/DailyJapanSpot.tsx` | (uses `mobile/lib/japanSpots.ts`, static data) |
| Flagcard collectible loyalty program (7 landmark cards, reward voucher at completion) | `mobile/app/flagcards.tsx`, `mobile/app/flagcard-intro.tsx` | `GET /api/flagcards/collection/:userId`, `GET /api/flagcards-program` |
| JAPANO VIP (monthly-spend-based, 10% one-item discount) | surfaced in `(tabs)/me.tsx`, checkout | `GET /api/vip/status/:userId` |
| Notifications inbox | `mobile/app/notifications.tsx` | `GET /api/notifications` |
| Push notifications | `mobile/lib/push.ts`, `PushNotificationRouter` in `_layout.tsx` | `POST /api/push/register`, `POST /api/push/unregister` |

## 6. Web admin panel (`admin/`)

Verified against `backend/routes/admin.js`, `health.js`, `catalog.js`, `returns.js`, `reviews.js`, `japanSpots.js`, `loyalty.js`, and this session's own admin-panel work (`admin/js/core.js`, `views-commerce.js`, `views-content.js`, `actions.js`).

| Feature | Backend endpoint(s) |
|---|---|
| Dashboard KPIs, live order/payment/return polling | `GET /api/admin/live`, `GET /api/analytics` |
| Product management (create/edit/hide/delete, ≥2-image publish rule) | `PUT/DELETE /api/products/:id`, `GET /api/staff/products` |
| Staff role scoped to own products only | `GET /api/staff/products` (`requireStaff`), enforced ownership check in `PUT /api/products/:id` |
| Super-admin user/role management | `PATCH /api/admin/users/:id` (`requireSuperAdmin`) |
| Order management, status updates | `GET /api/orders`, `PATCH /api/orders/:id` |
| Cancel/return request review workflow (approve/reject/receive/refund) | `POST /api/returns/:id/action` |
| Personal compensation vouchers | `POST /api/admin/customers/:userId/voucher` |
| Broadcast / targeted notifications | `POST /api/admin/notifications` |
| Review moderation | `GET /api/reviews/admin`, `PATCH /api/reviews/:id/moderation` |
| Japan-spot community content moderation | `GET /api/japan-spots/admin`, `DELETE /api/japan-spots/reviews/:id`, `DELETE /api/japan-spots/suggestions/:id` |
| Shop settings (logo, hotline, etc.) | `PUT /api/shop` |
| Full-state bulk view/export | `GET /api/state`, `PUT /api/state` (with server-side guard rails — see `database-analysis.md`) |
| Demo data seed/reset | `POST /api/seed`, `POST /api/reset` |

## 7. Explicitly confirmed NOT to exist (to prevent re-fabrication)

- No mini-games of any kind (no Caro/Gomoku, Sudoku, endless-runner, or rain-shelter game).
- No coin/point ("xu") economy anywhere in mobile or backend source.
- No `expo-camera` live in-app camera preview (camera capture is OS hand-off via `expo-image-picker`).
- No live/production payment processing — Stripe is hard-gated to `sk_test_`/`pk_test_` keys only (`backend/lib/stripeClient.js:14`); VNPay points at the sandbox host by default.
- No CI/CD pipeline, no E2E/UI test framework for mobile (see `testing-evidence.md`).
