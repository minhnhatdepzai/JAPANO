# Evidence: Security Analysis

Status: verified by direct reading of `backend/lib/auth.js` (full), `backend/server.js`, all 17 route files, `backend/lib/vnpaySign.js` (full), `backend/lib/stripeClient.js` (full), `backend/lib/cloudinaryMedia.js` (full), `backend/lib/mailer.js`, `.env.example`, `.gitignore`. Findings include both verified strengths and verified, precisely-cited gaps — nothing here is assumed "probably fine."

## 1. Authentication (`backend/lib/auth.js`)

- **Password hashing**: `bcryptjs`, cost factor **10** (`hashPassword()`, L20-22: `bcrypt.hashSync(String(password), 10)`). `verifyPassword()` (L42-49) wraps `bcrypt.compareSync` in try/catch, returns `false` on any error.
- **Password strength enforcement**: `passwordStrength()` (L27-40) scores length/character-class composition and blocklists common weak passwords (`12345678`, `password`, `qwerty123`, etc., L26); enforced at registration and password reset.
- **JWT**: `jsonwebtoken`. `signToken()` embeds `{sub, role, email}` with `expiresIn: TOKEN_TTL` (default **30 days**, `JWT_TTL` env-overridable, L18).
- **Secret handling (fail-closed in production)** — L8-16:
  ```js
  if (!secret) {
    if (isProd) throw new Error('JWT_SECRET chưa được cấu hình...');
    secret = crypto.randomBytes(32).toString('hex');
    logger.warn('JWT_SECRET chưa cấu hình — dùng secret ngẫu nhiên tạm cho dev...');
  }
  ```
  Missing `JWT_SECRET` with `NODE_ENV=production` **crashes boot** (good, fail-closed). In dev, a random in-memory secret is generated and a warning logged — all sessions invalidate on restart, which is an accepted dev-only trade-off, not a silent production risk.
- **Role hierarchy**, L88-91: `ROLE_RANK = {customer:0, staff:1, admin:2, super_admin:3}`; `roleAtLeast()` resolves unknown/undefined roles to `-1`, i.e. **fails every check by default** (safe default-deny).
- **Middleware**: `requireAuth` (L69-74, 401 on invalid/missing token), `optionalAuth` (L78-82, never blocks, sets `req.user=null`), `requireAdmin`/`requireSuperAdmin`/`requireStaff` (L93-114, layered on `requireAuth` + `roleAtLeast`).
- **Admin bootstrap**: `ensureAdminSeeded()` (L119-139) creates/promotes exactly one `super_admin` from `JAPANO_ADMIN_EMAIL`/`JAPANO_ADMIN_PASSWORD`; if the account exists, it does **not** overwrite an existing password hash (L125-129) — avoids clobbering a password already changed by the admin.

## 2. Authorization patterns — strong in the payment/order path, inconsistent elsewhere

### Verified good pattern: JWT identity always overrides client-supplied `userId`
Explicit, commented in source, in every order/payment/address/return flow:
- `routes/orders.js:222-224,228` — `{...req.body, userId: req.user.id}`, comment: *"userId luôn lấy từ JWT đã xác thực, không tin body"*.
- `routes/paymentsVnpay.js:220`, `routes/paymentsStripe.js:399,522` — identical pattern/comment.
- `routes/returns.js:93,144` — explicitly checks `order.userId !== req.user.id → 403` before allowing cancel/return.
- `routes/addresses.js` — every CRUD handler derives `userId` from `req.user.id`, never the body.
- No route was found that reads a client-supplied `role` field for an authorization decision — the only consumer of `body.role` is the `requireSuperAdmin`-gated role-change endpoint itself (`admin.js:20-26`), validated against an allowlist.

### Verified gap: several routes have zero auth middleware and trust a client-supplied `userId`
None of the following files contain `requireAuth` at all:

| File | Endpoint | Issue |
|---|---|---|
| `routes/customerData.js` | `POST /interactions` (L7-10) | Writes behavior data under any `userId` |
| `routes/customerData.js` | `POST /carts/sync` (L70-93) | **Fully overwrites** any user's cart if their `userId` is known |
| `routes/customerData.js` | `GET /wishlist` (L99-106) | Discloses any user's wishlist |
| `routes/customerData.js` | `POST /wishlist/sync` (L108-136) | **Fully overwrites** any user's wishlist |
| `routes/reviews.js` | `POST /products/:slug/reviews` (L53-58) | Can post a review "as" any `userId` with a matching completed order |
| `routes/reviews.js` | `POST /reviews/:id/reaction` (L96-99) | Reaction attributable to any `userId` |
| `routes/loyalty.js` | `POST /flagcards/admin/grant` (L26-48) | **Named "admin" but has no admin/auth check at all** — anyone can grant a Flagcard/voucher to any `userId` |
| `routes/loyalty.js` | `GET /flagcards/collection/:userId`, `GET /vip/status/:userId` (L10-12,52-56) | Discloses any user's loyalty/VIP data by ID |
| `routes/stylist.js` | `POST/GET /stylist/profile[/:userId]` (L133-144) | Can overwrite or read any user's body-measurement/style profile |
| `routes/japanSpots.js` | `POST /japan-spots/reviews`, `/suggestions` (L54-68,111-140) | Content attributable to any `userId` |

`userId` values are opaque (`u-<timestamp>-<random>`, `routes/auth.js:47`), which raises the bar for blind guessing, but any leak of a `userId` (visible in an order confirmation, a push payload, an admin export) would let anyone read/write that user's cart, wishlist, stylist profile, or loyalty data without a password or token. This reads as an incompletely finished migration away from an older unauthenticated design — corroborated by `lib/vip.js:187-189`'s own comment that legacy accounts predate the registration endpoint (see §7.4).

### Four concrete sensitive-endpoint examples (correctly protected)
1. `DELETE /api/products/:id` → `requireAdmin` (`catalog.js:152`).
2. `PATCH /api/admin/users/:id` → `requireSuperAdmin`, with a self-demotion guard (`admin.js:13`, L23-25).
3. `POST /api/payments/:id/refund` → `requireAdmin` (`payments.js:32`).
4. `POST /api/returns/:id/action` → `requireAdmin` (`returns.js:204`).

## 3. Input validation and injection risks

- **Registration/login**: email regex-validated, password strength-checked, generic `401` on either wrong email or wrong password (`auth.js:65-67` comment: explicitly to avoid revealing which emails are registered), banned accounts (`status!=='active'`) blocked with `403`.
- **Password reset**: always returns the same generic success message regardless of whether the email exists; reset code stored only as `sha256(code)`, 30-minute TTL, single-use. Minor note: the hash comparison (`auth.js:124`) uses plain `!==`, not a timing-safe compare — low practical risk since it's a digest of a 6-digit space, but inconsistent with VNPay's use of `crypto.timingSafeEqual` for its signature check (§6).
- **Checkout amounts are server-computed, not trusted from the client**: item prices are looked up from `state.products`; `subtotal/discount/total` are derived server-side in `makeCreateOrderInState()` (`orders.js:103-216`) and that server value is what Stripe/VNPay actually charge.
- **Narrow gap in the same function**: `normalizedOrderItems()` (`orders.js:22-37`) falls back to the **client-supplied** `item.price`/`item.name` (L34, `?? item.price`) when `productId` doesn't match a real catalog product. This cannot underprice a *real* product, but does allow injecting a fabricated line item at an attacker-chosen non-negative price into an order.
- **Media uploads** (`lib/cloudinaryMedia.js`): no `multer`/multipart path exists — all media is base64 data URIs in the JSON body. Type checking is a **regex on the declared MIME prefix only** (e.g. `/^data:(video|audio)\/.../i`), with **no magic-byte/content verification** — a client could mislabel arbitrary bytes. Size limits are enforced on base64 **string length**, not decoded byte size (self-aware: the user-facing message says "~30MB" acknowledging base64 overhead against a 40MB string cap).
- **NoSQL query safety**: the primary Mongo usage is a whole-document mirror keyed by a fixed literal (`{_id:'main'}`) — no user input reaches it. The one place real per-field Mongo queries occur (`routes/japanSpots.js:42`, `find({place, prefecture})`) coerces both fields with `String(req.query.x || '').trim()` first, neutralizing operator-injection attempts like `?place[$ne]=`.
- **Command execution**: `child_process.spawn` (`lib/accessory.js`, `lib/pillow.js`) uses a fixed argument array, not shell string concatenation — the safer pattern, no shell-injection vector found.

## 4. HTTP security middleware (`backend/server.js`)

- **Helmet**: `helmet({contentSecurityPolicy:false})` (L190). **CSP is explicitly disabled**, with a self-aware comment (L188-189): *"CSP off because the admin panel is plain JS with no build step, and the dynamic innerHTML chains in admin/js/*.js haven't been fully audited yet."* This concern is concrete, not hypothetical: `admin/js/*.js` contains **17 live `.innerHTML =` sites**, and the admin JWT is stored in **`localStorage`** (`admin/js/core.js:10-11,18`). Any future XSS in the admin panel would be directly exploitable to steal the admin session token, since CSP — the primary browser defense against this — is off. This is a real, currently-open, self-acknowledged risk.
- **CORS**: `cors()` with **no options object** — per the `cors` package's documented default, this reflects any request's `Origin` header back, i.e. all origins allowed, no allowlist.
- **Rate limiting**, `express-rate-limit` v8.6.0, two tiers:
  - General: 600 requests / 5 minutes (`JAPANO_RATE_LIMIT_MAX`), applied to the whole `/api` router (L192-198,265).
  - Auth-specific: **20 requests / 15 minutes** (`JAPANO_AUTH_RATE_LIMIT_MAX`), scoped to `/api/auth/*` only (L236-243), registered before the auth routes — a materially stricter brute-force guard on login/register/forgot-password/reset-password.
  - Caveat: keys by `req.ip`; no `app.set('trust proxy', ...)` found anywhere — if deployed behind a reverse proxy without that setting, per-client limiting could misbehave. A deployment-configuration caveat, not a bug in the current dev setup.
- **Body size limit**: `express.json({limit:'120mb'})` (L228) — large, driven by base64 media in JSON bodies; correctly registered *after* the Stripe webhook's raw-body parser (L199), so webhook verification is unaffected. A 120MB-per-request allowance on several of the no-auth endpoints from §2 is a meaningful resource-exhaustion consideration even with rate limiting in place.

## 5. Secrets management

- `.env.example` (134 lines) documents all config keys with placeholder values only (`sk_test_xxx`, `doi-chuoi-ngau-nhien-dai-o-day`, etc.) — no real secrets in this file.
- `.env.server` exists with restrictive permissions (`-rw-------`, owner-only).
- `.gitignore` contains `.env` / `.env.*` / `!.env.example` — by standard glob semantics this should ignore `.env.server`. **Caveat**: this could not be confirmed via git itself, because `.git/` in this environment is not a fully initialized repository (`git status`/`git check-ignore` both fail with "not a git repository") — see `git-history-summary.md`. The ignore-status conclusion here rests on manual pattern analysis, not git's own confirmation.
- **Gap**: `lib/mailer.js` reads `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`MAIL_FROM` for real password-reset emails, but **none of these keys appear in `.env.example`**. The app degrades gracefully (Ethereal sandbox fallback) when unset, but this is an undocumented configuration surface.

## 6. Payment security

### Stripe
- **Test-mode is hard-enforced in code**, not just documented: `stripeClient.js:14` — `stripeEnabled()` requires `STRIPE_SECRET_KEY.startsWith('sk_test_') && STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')`. Live keys would make every Stripe route respond `503`.
- **Webhook signature verification is real**: `server.js:199-227`, `stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)`, correctly mounted with `express.raw()` before the JSON parser. Fails closed (`503`) if `STRIPE_WEBHOOK_SECRET` is unconfigured.
- **Refunds are server-clamped**: `Math.min(remaining, Math.max(1, Number(body.amount)))` (`paymentsStripe.js:287-289`) — an admin cannot refund more than is actually owed; uses a Stripe idempotency key to guard against duplicate refunds on retry.
- `POST /stripe/reconcile` has no auth middleware — it only queries Stripe's own API for already-pending payments' true status (cannot fabricate a "paid" state), but is still an unauthenticated compute/outbound-call surface.

### VNPay
- **Sandbox confirmed**: default URLs are `sandbox.vnpayment.vn/...`, matching `.env.example`.
- **Signature**: HMAC-SHA512 (`vnpaySign.js:58-60`).
- **Verification uses a timing-safe comparison** — a genuinely good practice: `verifyVnpayParams()` (L91-103) uses `crypto.timingSafeEqual` on the expected vs. received hash buffers, invoked on every return/IPN confirmation.
- **Gap — hardcoded fallback sandbox secret in source** (`vnpaySign.js:8-9`):
  ```js
  const VNPAY_TMN_CODE = String(process.env.VNPAY_TMN_CODE || 'TD3422D1').trim();
  const VNPAY_HASH_SECRET = String(process.env.VNPAY_HASH_SECRET || 'SMKTJ11T9JQDIZQPCF7E8ZIJ6DXV969Z').trim();
  ```
  The code's own comment notes this is VNPay's publicly-documented sandbox demo merchant (not a proprietary leak), but it is still, factually, a hardcoded default secret in source control.
- Refund amounts are server-clamped the same way as Stripe; `POST /vnpay/reconcile` is similarly unauthenticated but only reads VNPay's own API.

## 7. Self-documented gaps (honest comments found directly in source)

1. **CSP off, admin XSS surface explicitly unaudited** (`server.js:188-189`) — see §4.
2. **`JWT_SECRET` missing → hard failure in prod, ephemeral secret in dev** (`auth.js:12,15`) — the code itself distinguishes these two cases explicitly.
3. **Stock not restored on failed/cancelled online payments** (`orders.js:62-64`): *"Stock is decremented immediately at order creation... a failed/cancelled online order will not automatically restore stock in this version."* A self-admitted business-logic gap, not a classic security bug, but honest and citable.
4. **Legacy accounts predate the registration endpoint** (`lib/vip.js:187-189`): *"Older mobile accounts only ever appeared in order.userId... because the app didn't used to have a registration endpoint."* Useful context for why the unauthenticated-`userId` pattern in §2 exists — the JWT model was retrofitted onto older data/routes, and that migration was not completed everywhere.
5. **Undocumented SMTP env vars** — see §5.

## Summary for thesis use

**Verified strengths**: bcrypt password hashing; fail-closed JWT secret handling in production; consistent JWT-over-client-body precedence in the order/payment/address/return path, with inline comments explaining why; default-deny role hierarchy; real Stripe webhook signature verification; real VNPay HMAC-SHA512 verification using a timing-safe comparison; server-computed payment amounts everywhere checked; hard-coded test-mode-only gate preventing any live Stripe transaction.

**Verified gaps, to be stated plainly rather than hidden**: (a) a materially inconsistent authorization model — five route files trust a client-supplied `userId` with no authentication at all, including one endpoint named `/flagcards/admin/grant` with no admin check; (b) CSP disabled while the admin panel both uses extensive `innerHTML` and stores its JWT in `localStorage`; (c) fully open CORS; (d) upload MIME validation is declaration-based, not content-based; (e) a hardcoded fallback VNPay sandbox secret in source; (f) two unauthenticated (but gateway-verified) payment-reconciliation endpoints; (g) git's own ignore-status for `.env.server` could not be confirmed in this environment (see `git-history-summary.md`).
