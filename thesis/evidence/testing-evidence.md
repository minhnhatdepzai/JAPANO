# Evidence: Testing Infrastructure

Status: verified by direct file reads and by executing the real test command. All numbers in this file are copied from actual command output — none are estimated.

> **SUPERSEDED NUMBERS — recount 2026-08.** This file is a point-in-time snapshot. The codebase has since grown: the real count is now **6 test files / 50 test cases (50 pass, 0 fail)**, not 5 files / 46 cases. The added coverage is `backend/test/gpu-queue.test.js` (3 cases) plus 1 new case in `analytics-recommend.test.js`. The thesis chapters and appendices use the corrected figures; see `thesis/appendices/phu-luc-c-ghi-chu-pham-vi.md` section C.1. Everything else in this file (per-file breakdown of the original 5 files, coverage gaps, honest summary) remains accurate.

## 1. Test files inventory

A repository-wide search for `*.test.js`, `*.test.ts`, `*.spec.*` (excluding `node_modules`) found **exactly 5 test files, all under `backend/test/`**. No test files exist under `mobile/`, `admin/`, or anywhere else in the repo.

| File | Modules under test | Test case count |
|---|---|---|
| `backend/test/vip.test.js` | `backend/lib/vip.js` (`VIP_CONFIG`, `deriveVipMemberships`, `vipStatus`, `vipQualifyingSpend`, `vipDiscountForSelection`, `reconcileVipState`) | 7 |
| `backend/test/embeddings.test.js` | `backend/lib/embeddings.js` (`cosineSimilarity`, `productText`) | 4 |
| `backend/test/orders.test.js` | `backend/lib/httpError.js`, `backend/lib/vip.js`, `backend/lib/flagcards.js`, `backend/lib/notify.js`, `backend/routes/orders.js` (`makeCreateOrderInState`, `normalizedOrderItems`, `findVariant`) | 7 |
| `backend/test/tryon.test.js` | `backend/routes/tryon.js` (`stripDataUri`, `normalizeImageResult`, `clothTypeFor`, `fashnCategoryFor`, `makeComputeSizeFit`) | 8 |
| `backend/test/analytics-recommend.test.js` | `backend/seed.js`, `backend/lib/analytics.js`, `backend/lib/recommend.js`, `backend/lib/advancedRecommend.js`, `backend/lib/chatbot.js`, `backend/lib/productVision.js`, `backend/lib/accessory.js`, `backend/lib/flagcards.js`, `backend/lib/reviewModeration.js`, `backend/lib/goals.js`, `backend/data/vietnam-administrative-units.json` | 20 |

**Total: 46 test cases**, matching the real run output in Section 3 exactly.

### Full list of test case names (verbatim, as literal strings in source)

**`backend/test/vip.test.js`**
- L35 `'cộng nhiều đơn trong cùng tháng và kích hoạt đúng khi chạm 5 triệu'`
- L52 `'không cộng đơn tháng khác, chưa trả, bị huỷ hoặc hoàn toàn bộ'`
- L67 `'đơn hoàn một phần chỉ tính tiền hàng thực giữ lại'`
- L75 `'VIP hết hiệu lực đúng biên 30 ngày và nhân viên không được cấp VIP'`
- L87 `'ưu đãi VIP giảm 10% đúng một đơn vị của dòng khách chọn'`
- L103 `'server từ chối chọn sản phẩm ngoài giỏ hoặc dùng quyền khi chưa VIP'`
- L115 `'reconcile cập nhật hạng, chi tiêu và membership cho trang quản trị'`

**`backend/test/embeddings.test.js`**
- L8 `'cosineSimilarity trả 1 cho hai vector giống hệt, 0 cho vector rỗng/lệch chiều'`
- L14 `'cosineSimilarity trả 0 cho hai vector trực giao'`
- L18 `'productText gộp tên, danh mục và tag thành một chuỗi để embed'`
- L25 `'productText trả rỗng khi sản phẩm thiếu dữ liệu'`

**`backend/test/orders.test.js`**
- L41 `'tạo đơn thành công trừ đúng số lượng vào kho biến thể'`
- L48 `'đặt vượt quá tồn kho biến thể bị chặn với lỗi 409 rõ ràng'`
- L59 `'biến thể hết hàng (stock 0) không cho đặt dù chỉ 1 sản phẩm'`
- L67 `'cùng clientRequestId không tạo đơn trùng và không trừ kho hai lần'`
- L77 `'sản phẩm không khai báo variants thì bỏ qua kiểm tra tồn kho'`
- L84 `'normalizedOrderItems giới hạn số lượng từ 1 đến 20'`
- L96 `'findVariant khớp theo size khi không tìm thấy đúng màu'`

**`backend/test/tryon.test.js`**
- L8 `'stripDataUri chỉ giữ phần base64, giữ nguyên chuỗi không phải data URI'`
- L14 `'normalizeImageResult nhận diện base64 trần, URL và các field kết quả khác nhau'`
- L22 `'clothTypeFor phân loại quần/váy, đồ liền thân và mặc định áo trên'`
- L30 `'fashnCategoryFor ánh xạ đúng sang category API của FASHN'`
- L36 `'computeSizeFit báo "good" khi size chọn trùng size gợi ý'`
- L44 `'computeSizeFit báo "tight" khi khách chọn size nhỏ hơn size gợi ý'`
- L52 `'computeSizeFit báo "loose" khi khách chọn size lớn hơn size gợi ý'`
- L60 `'computeSizeFit trả "unknown" khi thiếu hồ sơ số đo hoặc size không hợp lệ'`

**`backend/test/analytics-recommend.test.js`**
- L27 `'analytics trả đủ chuỗi thời gian và ba model dự báo hữu hạn'`
- L55 `'wishlist bị xoá không còn được tính là tín hiệu nhu cầu'`
- L78 `'market basket tính support, confidence và lift cho cặp mua lặp lại'`
- L99 `'hybrid recommender chỉ trả slug hợp lệ, không trùng và có model provenance'`
- L128 `'cache recommendation cô lập giữa các state khác nhau'`
- L143 `'autoregressive next-item expert học chuyển tiếp A sang B theo session'`
- L158 `'diagnostics chỉ bật ranker khi có causal training pair thật và ghi nhận feedback âm'`
- L177 `'botchat trả provenance của mLSTM memory và sparse MoE router'`
- L193 `'analytics tổng hợp telemetry botchat và diagnostics model thật'`
- L209 `'tín hiệu tìm kiếm và thử đồ được đưa vào phân tích nhu cầu và sức khỏe mô hình gợi ý'`
- L223 `'search intelligence gộp đúng từ khoá hot và từ khoá không ra kết quả'`
- L246 `'search intelligence không vỡ khi chưa có log tìm kiếm nào'`
- L254 `'mô tả ảnh fallback luôn bám đúng tên sản phẩm và không bịa chất liệu'`
- L263 `'mục tiêu kết hợp quỹ mua sắm và lộ trình giảm cân có giới hạn an toàn'`
- L280 `'phụ kiện nón và ô được định tuyến tới đúng điểm neo pose'`
- L285 `'Flagcard chỉ cấp một lần cho đơn thành công từ 5 triệu'`
- L301 `'đủ 7 Flagcard cấp đúng một voucher cá nhân 50% toàn sản phẩm'`
- L322 `'kiểm duyệt chặn câu công kích cố tình chen ký tự và bỏ dấu'`
- L328 `'kiểm duyệt không chặn phê bình sản phẩm trung thực'`
- L333 `'danh mục địa chỉ có đủ 34 tỉnh và 3321 phường xã'`

## 2. Test runner / framework

- `backend/package.json` script: `"test": "node --test"` — the **built-in Node.js test runner** (`node:test` module), not a third-party framework.
- Root `package.json` script: `"check": "npm --workspace backend test && npm --workspace mobile run typecheck"` — chains the backend test run with a mobile TypeScript typecheck (`tsc --noEmit`), not a test framework itself.
- Confirmed no third-party test framework dependency exists anywhere: no `jest`, `mocha`, `vitest`, or `ava` in any `package.json`; no `jest.config.*`, `vitest.config.*`, `.mocharc*` in the repo.
- Every test file opens with `const test = require('node:test'); const assert = require('node:assert/strict');`, confirming direct use of Node's native test runner.

## 3. Real test run output

Command run from repo root: `npm --workspace backend test`. Executed twice to confirm reproducibility (exit code `0` both times).

```
1..46
# tests 46
# suites 0
# pass 46
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 131.197996
```

- **46/46 tests pass, 0 failed, 0 skipped.**
- A second independent run reproduced the same `46/46` result (duration varied slightly: `125.342089` ms — normal run-to-run jitter, not a flake).
- One benign warning appeared in the log between subtests 20-21 (does **not** fail the run):
  ```
  WARN: Không gọi được embedding service — bỏ qua semantic matching, các tín hiệu khác vẫn hoạt động bình thường.
  err.message: "fetch failed: connect ECONNREFUSED 127.0.0.1:7865"
    at fetchWithTimeout (backend/lib/httpFetch.js:7:16)
    at embedTexts (backend/lib/embeddings.js:58:20)
    at refreshProductEmbeddings (backend/lib/embeddings.js:98:21)
  ```
  This confirms the test suite gracefully degrades when the optional Python embedding microservice (port 7865) isn't running — it is a caught, logged warning, not a crash.

## 4. CI/CD

**No CI/CD pipeline exists in this repository.**
- No `.github/workflows/` directory.
- No `.gitlab-ci.yml`, `.travis.yml`, `azure-pipelines.yml`, `Jenkinsfile`, or `.circleci/` anywhere in the repo.
- `.agents/` and `.codex/` directories exist at the repo root but are empty.
- `scripts/verify.mjs` (invoked via root `package.json` scripts `"verify"` / `"verify:ai"`) is a **manual smoke-test script** — it makes live HTTP requests against an already-running backend (see `scripts/verify.mjs` calling `http://127.0.0.1:${PORT}/api/health`), not an automated CI job, and is not wired into `npm test`.

## 5. Mobile / E2E testing

**No E2E or UI test framework is configured for the mobile app.**
- `mobile/package.json` has no Detox, Maestro, Playwright, or Appium dependency.
- No `.detoxrc*`, `playwright.config*`, `e2e/`, or `maestro/` exists anywhere in the repo.
- `mobile/package.json` scripts are limited to `start`, `android`, `ios`, `web`, `typecheck` — no `test` script.
- Mobile's only automated check is TypeScript type-checking (`tsc --noEmit`), chained into the root `"check"` script alongside the backend test run.

## 6. Testability pattern: pure-function re-exports

Several route files export internal pure functions specifically so they can be unit-tested without spinning up the HTTP server (`grep -n "module\.exports\." backend/routes/*.js` found this pattern in 4 files, 16 export lines total). Verified examples:

1. `backend/routes/orders.js:253` — `module.exports.makeCreateOrderInState = makeCreateOrderInState;` (defined L103) — consumed by `backend/test/orders.test.js` (require L9-10, used in its `create()` helper).
2. `backend/routes/orders.js:254` — `module.exports.normalizedOrderItems = normalizedOrderItems;` (defined L22) — exercised in `backend/test/orders.test.js:84`.
3. `backend/routes/orders.js:259` — `module.exports.findVariant = findVariant;` (defined L41) — exercised in `backend/test/orders.test.js:96`.
4. `backend/routes/tryon.js:543-547` — 5 exports (`stripDataUri` L12, `normalizeImageResult` L28, `clothTypeFor` L36, `fashnCategoryFor` L78, `makeComputeSizeFit` L58) — all imported and tested by `backend/test/tryon.test.js:4-6`.
5. `backend/routes/paymentsVnpay.js:349` — `module.exports.makeVnpayHelpers = makeVnpayHelpers;` (defined L13) — **exists but is not currently imported by any test file** (verified by grepping `backend/test/*.js` for `paymentsVnpay|makeVnpayHelpers`: no matches).
6. `backend/routes/paymentsStripe.js:732` — `module.exports.makeStripeHelpers = makeStripeHelpers;` (defined L10) — **exists but is not currently imported by any test file** (same grep method, no matches).

This shows the export-for-testability pattern is applied more broadly across the route layer (including payments) than the current test suite actually exercises — payments logic (`paymentsStripe.js`, `paymentsVnpay.js`) has no dedicated unit tests despite being structured to allow them.

## Honest summary for thesis use

- Testing is real, automated, and passing (46/46), using Node's built-in test runner — this is a legitimate, citable fact.
- Coverage is concentrated on: VIP/loyalty logic, product embeddings math, order creation/stock/idempotency, try-on pure-function helpers, and the recommendation/analytics/moderation/goals cluster.
- Coverage gaps that must be stated honestly, not glossed over: **no tests for authentication (`backend/lib/auth.js`), no tests for the returns/cancellation workflow (`backend/routes/returns.js`), no tests for payments (`paymentsStripe.js`, `paymentsVnpay.js`) despite testable exports existing, no CI/CD automation, and no mobile or admin-panel tests of any kind.**
