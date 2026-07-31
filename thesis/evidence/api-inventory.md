# Evidence: Backend API Inventory

Status: verified by direct reading of `backend/server.js` (full, 326 lines), all 17 files under `backend/routes/`, and cross-checked against a live `GET /api/health` call earlier in this project's development. Every endpoint below is a literal `api.get/post/put/patch/delete(...)` call found in source — none are inferred from naming. **Total: 109 distinct HTTP endpoints** (108 under the `/api` router + 1 Stripe webhook mounted directly on the Express app). This directly refutes the prior fabricated draft's claims of a single-file backend on port 4000 with a small, different endpoint set.

## Entry point and request pipeline (`backend/server.js`)

- Default port: `const PORT = Number(process.env.PORT || 4100);` — `server.js:48`.
- Middleware order: `cors()` → `helmet({contentSecurityPolicy:false})` (CSP intentionally off; comment at `server.js:188-189` explains the admin panel's un-audited dynamic `innerHTML` is the reason) → `pinoHttp` structured request logging → Stripe webhook (raw body, mounted directly on `app`, before the JSON parser) → `express.json({limit:'120mb'})` (large limit for base64 image/video payloads) → static `/assets/products` → `express.Router()` for `/api` with `authLimiter` scoped to `/api/auth/*` → 17 route modules mounted → `generalApiLimiter` wraps the whole `/api` router → static `/assets` → static `/admin` → `GET /` redirects to `/admin/`.
- Dependency-injection pattern: every route file is `module.exports = function registerXRoutes(api, ctx) {...}`, and all 17 receive the **same** `ctx` object (`server.js:157-178`) aggregating `read/write/update`, auth middleware, Cloudinary/Stripe/VNPay helpers, VIP/Flagcard helpers, analytics, and more.
- Boot sequence (`server.js:299-326`): `hydrateFromMongoIfNewer()` → run idempotent migrations → `app.listen(PORT)`.

## Route-by-route endpoint list

### `backend/routes/addresses.js` — 5 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/addresses` | requireAuth | Caller's saved addresses, default-first (L32) |
| POST | `/api/addresses` | requireAuth | Create address; auto-default if first (L39) |
| PUT | `/api/addresses/:id` | requireAuth | Update owned address (L60) |
| POST | `/api/addresses/:id/default` | requireAuth | Set default, unset others (L80) |
| DELETE | `/api/addresses/:id` | requireAuth | Delete; promote another to default if needed (L96) |

### `backend/routes/admin.js` — 3 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| PATCH | `/api/admin/users/:id` | requireSuperAdmin | Edit role/name/email/status; blocks self-demotion out of super_admin (L13) |
| POST | `/api/admin/customers/:userId/voucher` | requireAdmin | Issue personal compensation voucher, admin-chosen value + reason (L53) |
| POST | `/api/admin/notifications` | requireAdmin | Broadcast or targeted notification (L105) |

### `backend/routes/auth.js` — 5 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/auth/register` | public | Validate + password-strength check, bcrypt hash, create customer, return JWT (L31) |
| POST | `/api/auth/login` | public | bcrypt verify, account-lock check, generic error on failure (L61) |
| GET | `/api/auth/me` | requireAuth | Caller's public profile (L75) |
| POST | `/api/auth/forgot-password` | public | SHA-256-hashed 6-digit code, 30min TTL, emailed via `lib/mailer.js` (L84) |
| POST | `/api/auth/reset-password` | public | Verify code+expiry, set new bcrypt hash (L112) |

### `backend/routes/catalog.js` — 9 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/products` | public | Published products, live rating/sold enrichment (L66) |
| GET | `/api/products/:slug/videos/:index` | public | Streams base64 video with HTTP range support (L72) |
| GET | `/api/staff/products` | requireStaff | Staff see only own `ownerId`; admin+ see all (L103) |
| PUT | `/api/products/:id` | requireStaff | Create/update; staff can't edit others'/reassign owner; ≥2 images to publish (L111) |
| DELETE | `/api/products/:id` | requireAdmin | Delete by id or slug (L152) |
| GET | `/api/locations/provinces` | public | Fuzzy search over 34-province VN dataset (L174) |
| GET | `/api/locations/wards` | public | Fuzzy search of wards within a province (L182) |
| GET | `/api/products/:slug/related` | public | Related-product slugs from `lib/recommend.js` (L194) |
| GET | `/api/products/:slug/ai-description` | public | Cached/fresh AI description via Qwen3-VL (L200) |

### `backend/routes/customerData.js` — 5 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/interactions` | — | Logs behavior event feeding the recommender (L7) |
| POST | `/api/search-log` | — | Logs search query + result count, capped at 5000 rows (L49) |
| POST | `/api/carts/sync` | — | Replace caller's cart, re-validated against catalog (L70) |
| GET | `/api/wishlist` | — | User's wishlist slugs (L99) |
| POST | `/api/wishlist/sync` | — | Replace wishlist (L108) |

### `backend/routes/health.js` — 19 endpoints (12 literal + 7 via two `forEach` loops)
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/health` | public | Health snapshot incl. `database:{type:'json',...}` (L12/L20) |
| GET | `/api/state` | requireAdmin | Full raw state dump (L33) |
| GET | `/api/admin/live` | requireAdmin | Lighter live slice for dashboard polling (L34) |
| PUT | `/api/state` | requireAdmin | Bulk admin state replace via `replaceFromAdmin` (L50) |
| PUT | `/api/shop` | requireAdmin | Update shop settings, Cloudinary logo upload (L69) |
| POST | `/api/seed` | requireAdmin | Reload demo dataset (L100) |
| POST | `/api/reset` | requireAdmin | Wipe to empty state (L101) |
| GET | `/api/shop/logo` | public | Stream shop logo bytes (L103) |
| GET | `/api/categories`, `/api/banners`, `/api/vouchers`, `/api/flagcards` | public | Generated loop, public read-only (L115-116) |
| GET | `/api/payments`, `/api/returnRequests`, `/api/users` | requireAdmin | Generated loop (L118-119) |
| GET | `/api/orders` | optionalAuth | Admin+ sees all; customer sees own; anonymous → 401 (L121) |
| GET | `/api/notifications` | optionalAuth | Broadcast + own personal notifications (L128) |
| GET | `/api/shop` | public | Public shop info (L133) |
| GET | `/api/analytics` | public | Full analytics payload, `?scope=live|all` (L136) |

### `backend/routes/japanSpots.js` — 8 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/japan-spots/reviews` | public | Reviews for place+prefecture, Mongo or JSON fallback (L34) |
| POST | `/api/japan-spots/reviews` | requireAuth | Submit review, AI-moderated, optional media (L54) |
| GET | `/api/japan-spots/suggestions` | public | Place suggestions for a prefecture (L94) |
| POST | `/api/japan-spots/suggestions` | requireAuth | Submit suggestion, moderated (L111) |
| GET | `/api/japan-spots/admin` | — | Admin listing, all statuses (L165) |
| DELETE | `/api/japan-spots/reviews/:id` | requireAdmin | Delete review (L180) |
| DELETE | `/api/japan-spots/suggestions/:id` | requireAdmin | Delete suggestion (L184) |
| POST | `/api/moderation/test` | — | Test moderation model, no persistence (L190) |

### `backend/routes/loyalty.js` — 6 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/flagcards/collection/:userId` | — | User's Flagcard progress + reward voucher (L10) |
| GET | `/api/flagcards-program` | — | Flagcard config + card catalog (L13) |
| POST | `/api/flagcards/reconcile` | — | Recompute awards across all orders (L18) |
| POST | `/api/flagcards/admin/grant` | — | Manually grant a card (L26) |
| GET | `/api/vip/status/:userId` | — | VIP status from this month's order history (L52) |
| POST | `/api/vouchers/validate` | — | Validate voucher, return computed discount (L58) |

### `backend/routes/orders.js` — 2 endpoints (+ shared internals)
| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/orders` | requireAuth | Create order; server re-prices from live catalog, decrements stock, awards Flagcard, sends push (L225) |
| GET | `/api/orders/:id` | public | Fetch order + payment/return-request records (L243) |

Also exports `makeCreateOrderInState`, `normalizedOrderItems`, `paymentProviderOf`, `isOnlinePayment`, `decrementStock` — consumed directly by `paymentsStripe.js` and `paymentsVnpay.js` to share identical order-creation logic.

### `backend/routes/payments.js` — 2 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/payments/:id` | — | Look up payment; self-heals pending Stripe status via live poll (L12) |
| POST | `/api/payments/:id/refund` | requireAdmin | Dispatch refund to the correct gateway (L32) |

### `backend/routes/paymentsStripe.js` — 11 endpoints (+1 webhook in `server.js`)
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/stripe/cards` | requireAuth | List caller's saved cards via Stripe Customer (L336) |
| DELETE | `/api/stripe/cards/:id` | requireAuth | Detach saved card after ownership check (L352) |
| GET | `/api/stripe/config` | public | Publishable key + currency for mobile SDK (L366) |
| GET | `/api/stripe/checkout/open/:sessionId` | public | Resolve open Checkout Session URL, 303 redirect (L382) |
| POST | `/api/stripe/payment-intent` | requireAuth | Create/reuse/repair native PaymentIntent; creates Stripe Customer (L397) |
| POST | `/api/stripe/payment-intent/confirm` | public | Finalize order after client confirms PaymentIntent (L506) |
| POST | `/api/stripe/checkout-session` | requireAuth | Create/reuse Checkout Session (L520) |
| POST | `/api/stripe/checkout/confirm` | public | Finalize order from completed Checkout Session (L636) |
| GET | `/api/stripe/checkout/success` | public | Success redirect target, deep-links back to app (L645) |
| GET | `/api/stripe/checkout/cancel` | public | Cancel redirect target (L662) |
| POST | `/api/stripe/reconcile` | public | Batch-check up to 30 pending/refund-pending payments (L687) |
| POST | `/api/stripe/webhook` | signature-verified | Mounted in `server.js:199-227` (raw body); dispatches to `finalizeStripeCheckout`/`finalizeStripePaymentIntent`/`markStripe*Failed`/`applyStripeRefundToState` |

### `backend/routes/paymentsVnpay.js` — 5 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/vnpay/config` | public | Enabled flag + return-URL marker (L203) |
| POST | `/api/vnpay/payment-url` | requireAuth | Create/reuse order, HMAC-signed Sandbox payment URL (L218) |
| POST | `/api/vnpay/return` | public | WebView-captured return callback, signature-verified (L288) |
| GET | `/api/vnpay/ipn` | public | Server-to-server IPN endpoint, `RspCode` JSON contract (L303) |
| POST | `/api/vnpay/reconcile` | public | Batch-query VNPay `querydr` for stuck-pending payments (L318) |

### `backend/routes/push.js` — 2 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/push/register` | requireAuth | Store/refresh Expo push token (L5) |
| POST | `/api/push/unregister` | requireAuth | Remove push token (L17) |

### `backend/routes/returns.js` — 4 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/orders/:id/cancel-request` | requireAuth | Request cancel on not-yet-shipped order, reason required (L86) |
| POST | `/api/orders/:id/returns` | requireAuth | Request return on completed order, ≤30 days, reason + ≥1 photo (L139) |
| POST | `/api/returns/:id/action` | requireAdmin | `approve/reject/receive/cancel/refund`; auto-refunds paid-online cancels (L204) |
| PATCH | `/api/orders/:id` | requireAdmin | Direct status update; auto-marks COD paid on completion (L349) |

### `backend/routes/reviews.js` — 5 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/products/:slug/reviews` | public | Approved reviews + rating distribution + eligibility (L34) |
| POST | `/api/products/:slug/reviews` | requireAuth | Submit review; verified-purchase-only, one per user/product (L53) |
| POST | `/api/reviews/:id/reaction` | public | Toggle helpful/not-helpful (L96) |
| GET | `/api/reviews/admin` | — | Admin listing, all statuses (L120) |
| PATCH | `/api/reviews/:id/moderation` | — | Admin override; rejections stored as learned bad-phrase samples (L130) |

### `backend/routes/stylist.js` — 13 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/ai/health` | public | Liveness of every local AI microservice + diagnostics (L23) |
| GET | `/api/recommendations/home` | public | Home recommendations, `?userId=`/`?style=` (L98) |
| GET | `/api/recommendations/:userId` | public | Same engine, path param (L107) |
| POST | `/api/stylist/profile` | — | Save style/body profile, wrapped body (L133) |
| POST | `/api/stylist/profile/:userId` | — | Same, flat-body alias (L139) |
| GET | `/api/stylist/profile/:userId` | — | Fetch saved profile (L142) |
| GET | `/api/goals/:userId` | — | List saved goal plans (L149) |
| POST | `/api/goals/plan` | — | Savings + wellness/BMI plan, optional Ollama coaching (L155) |
| GET | `/api/outfits/today` | — | Daily-rotating outfit around a trending product (L204) |
| GET | `/api/outfits/:slug` | — | Outfit set anchored on a product (L209) |
| POST | `/api/stylist/size` | — | Expert-system size advice (L216) |
| POST | `/api/stylist/recommend` | — | "JAPANO Lens": selfie color/mood/style analysis (L225) |
| POST | `/api/stylist/chat` | — | "Ori" chatbot: intent routing + catalog-grounded reply (L262) |

### `backend/routes/tryon.js` — 4 endpoints
| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/tryon` | — | Core pipeline: pose → FASHN(±FLUX.2) → quality gate → CatVTON fallback → accessory refine (L244) |
| GET | `/api/tryon/motion/presets` | — | 5 motion presets + engine reachability (L485) |
| POST | `/api/tryon/motion` | — | Send try-on image to motion service, save MP4 (L490) |
| GET | `/api/tryon/motion/video/:id` | — | Serve generated MP4 by id (L534) |

## Architectural notes

- `routes/payments.js` and `routes/returns.js` both `require('./paymentsStripe')`/`require('./paymentsVnpay')` directly (not via `ctx`) to reuse `makeStripeHelpers`/`makeVnpayHelpers`, which in turn `require('./orders')` for `makeCreateOrderInState` — a shared-logic chain, not code duplication across payment providers.
- `catalog.js`'s returned `{ publicProduct, ensureCloudProductImagesFresh }` is not consumed anywhere else in the codebase (verified by grep) — a small piece of dead/unused export surface, noted here for completeness rather than omitted.

## Correction table (prior fabricated draft vs. verified reality)

| Prior draft claim | Verified reality |
|---|---|
| Single file `server/index.mjs` | No such path exists. Real entry point `backend/server.js` (326 lines) requiring 17 files under `backend/routes/`. |
| MongoDB/Mongoose primary database | JSON file `backend/data/db.json` is primary (confirmed on disk, 363,130 bytes); Mongo is an optional single-document mirror; no `mongoose` dependency exists at all. |
| Port 4000 | `PORT = Number(process.env.PORT || 4100)` — default is 4100. |
