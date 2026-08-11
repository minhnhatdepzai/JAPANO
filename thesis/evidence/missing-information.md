# Evidence: Missing Information and Required Disclosures

Purpose: this file exists so that every gap, discrepancy, or unverifiable claim discovered while building this evidence pack is recorded in one place — both to keep the other 9 evidence files honest (they cite this file rather than silently omitting caveats) and to give the thesis author a concrete punch-list of what still needs a human decision or a live-system check before submission.

## 1. A prior draft report contains substantial fabrication — do not reuse its content

Two Word documents exist at the repo root: `baocao (2).docx` and `baocao (2).backup.docx` (the backup is identical except it lacks the later-added appendices — confirmed by a full-text diff, 480 lines of appendix-only difference, everything else byte-for-byte the same paragraph text). Both share the same 8-chapter structure (Chương 1: Giới thiệu dự án → Chương 8: Kết luận và hướng phát triển) and the same front matter (FPT Polytechnic, advisor Nguyễn Ngọc Chấn, team of 3).

**The chapter/section numbering and academic front-matter conventions in this document are a legitimate, reusable structural template** — they are the basis for the outline produced alongside this evidence pack.

**The technical content of the main 8 chapters is substantially wrong and must not be reused.** Specific, verified fabrications:

| Claim in the draft | Verified reality |
|---|---|
| Backend is one file, `server/index.mjs` | Real backend is `backend/server.js` (326 lines) + 17 files under `backend/routes/` + 36 files under `backend/lib/` (`api-inventory.md`; recount 2026-08 — was 34 before `gpuArbiter.js` and `gpuJobQueue.js` were added) |
| MongoDB + Mongoose is the database, with normalized collections (Users, Products, ProductVariants, Cart, Orders, OrderItems, Payments, etc.) | Primary store is a JSON file, `backend/data/db.json`; MongoDB, if configured, mirrors the *entire* state as one document; zero `mongoose` usage anywhere in the repo (`database-analysis.md`) |
| Default port 4000 | Default port is 4100 (`backend/server.js:48`) |
| Mobile paths `app/_layout.tsx`, `context/AppContext.tsx`, `data/catalog.ts` (implying a different, un-prefixed structure) | Real paths are `mobile/app/_layout.tsx`, and there is no `AppContext.tsx` — state is split across `mobile/lib/auth.tsx`, `store.tsx`, `data.tsx`, `shop.tsx`, `botchat.tsx`; catalog data is `mobile/lib/catalog.ts` |
| Password hashing via scrypt | Real hashing is bcrypt (`bcryptjs`, cost 10) — `backend/lib/auth.js:20-22` |
| Default admin accounts `a@gmail.com` / password `1`, `lnhat1938@gmail.com` / password `1` | No such accounts or password exist in the real system; the real password-strength check would reject `"1"` outright, and admin bootstrap uses `JAPANO_ADMIN_EMAIL`/`JAPANO_ADMIN_PASSWORD` env vars, never a literal `"1"` |
| Order status `pending_cod` | No such status exists; real order statuses are `pending`, `confirmed`, `shipping`, `completed`, `cancelled`, `returned` (see `mobile/app/orders.tsx`'s status map) |
| "Games" tab/admin section: Caro AI, Sudoku AI, "Né quái vật", "Trú mưa", with a coin ("xu") economy | Confirmed absent by repo-wide search — no game code, no coin/point system anywhere in `mobile/` or `backend/` (`feature-inventory.md` §7) |
| "DemandScore v3", "What-if Simulator", "AI Pricing Optimizer" as named admin dashboard features | Not found under these names; the real analytics engine (`backend/lib/analytics.js`, `backend/lib/recommend.js`) does real forecasting/segmentation/demand-scoring work, but the specific claimed feature names and version numbers do not match source |
| `npm run start-server`, Windows-style paths (`server\vision-requirements.txt`, `py -3 -m venv`), `EXPO_PUBLIC_API_URL=http://localhost:4000` | Real scripts are `npm run backend`/`./start-all.sh`; real default API URL uses port 4100; no `vision-requirements.txt` file exists in the repo |

**Notably, the appendices (Phụ lục A–P) that only appear in the non-backup file are much more consistent with the real, verified infrastructure** — correct ports (4100/7862/7864/8081), correct AI pipeline names (FASHN VTON 1.5, FLUX.2), the correct GPU (RTX 5060 Ti, 16GB), `start-all.sh`, and an honest "no fabricated fallback try-on image" principle that matches `backend/tryon_preview.py`'s hard-disabled overlay mode. This suggests the appendices were written with more care/verification than the main chapters, but they were not independently re-verified line-by-line for this evidence pack (they are not part of what was requested), and any reuse of their content should be spot-checked against source the same way the main chapters were.

## 2. README.md's own "Giới hạn hiện tại" (current limitations) section is stale on one specific point

`README.md` is otherwise detailed, precise, and matches verified source closely (recommendation engine internals, AI service list, folder structure, environment variables — all independently confirmed by the research passes behind this evidence pack). However, its limitations section states (`README.md:549-550`):
> "Admin chưa có màn login; các mutation endpoint chưa có server-side authentication/authorization." / "Mobile login/register hiện lưu local bằng AsyncStorage, chưa có JWT/session/password verification."

**This is no longer true.** `backend/lib/auth.js` implements real bcrypt password hashing and JWT issuance/verification; `backend/routes/auth.js` implements real register/login/forgot-password/reset-password endpoints; the role-based middleware (`requireAuth`, `requireAdmin`, `requireSuperAdmin`, `requireStaff`) is applied across many (though not all — see `security-analysis.md` §2) routes; `.env.example` documents `JWT_SECRET`/`JWT_TTL`/admin-bootstrap variables as first-class, required configuration. This section of the README predates that work and was not updated afterward. **The thesis should describe the real, current auth/RBAC implementation (as documented in `security-analysis.md`) and should not cite this specific part of the README.** Every other section of the README remains a reliable cross-reference.

## 3. No usable git history

Covered fully in `git-history-summary.md`. The `.git/` directory present in this repository snapshot is not a valid initialized repository (no `HEAD`/`objects`/`refs`). No commit log, authorship breakdown, or development timeline can be produced from this snapshot. If the team has a separate hosted copy (GitHub/GitLab) with real history, that must be consulted directly — it is out of scope for this evidence pack.

## 4. Verified code-level gaps that a thesis presenting this system honestly should disclose

(Full detail and citations in the respective evidence files — this is a consolidated pointer list.)

- **Inconsistent authorization**: five backend route files (`customerData.js`, `reviews.js`, `stylist.js`, `loyalty.js`, `japanSpots.js`) have endpoints with no auth middleware that trust a client-supplied `userId`, including one endpoint literally named `/flagcards/admin/grant` with no admin check at all. (`security-analysis.md` §2)
- **CSP disabled** on the admin panel, which itself uses 17 live `innerHTML` call sites and stores its JWT in `localStorage` — a self-acknowledged, unaudited XSS-to-token-theft risk per the code's own comment. (`security-analysis.md` §4, §7.1)
- **CORS fully open** (`cors()` with no origin allowlist). (`security-analysis.md` §4)
- **Upload MIME validation is declaration-based**, not content/magic-byte verified. (`security-analysis.md` §3)
- **Hardcoded fallback VNPay sandbox secret** in `backend/lib/vnpaySign.js:8-9` (publicly-documented sandbox demo credentials, not a production leak, but still a hardcoded secret in source). (`security-analysis.md` §6)
- **Mobile `profile.tsx` does not actually save changes** — uncontrolled form inputs, "Save" just navigates back. (`feature-inventory.md` §1, from the mobile research pass)
- **Mobile `settings.tsx` toggles are mostly local-only**, not persisted, except the botchat-enable toggle. (`feature-inventory.md` §1)
- **Google/Apple login buttons are UI stubs** with no backend integration. (`feature-inventory.md` §1)
- **Stock is not restored** for abandoned/failed online-payment orders (self-documented in `backend/routes/orders.js:62-64`). (`security-analysis.md` §7.3)
- **No CI/CD pipeline** and **no E2E/UI test framework for mobile** exist. (`testing-evidence.md` §4-5)
- **Automated test coverage is concentrated** in VIP logic, embeddings math, order creation, try-on pure functions, and the recommendation/analytics/moderation cluster — there are **no tests for authentication, the returns/cancellation workflow, or either payment gateway**, despite `paymentsStripe.js`/`paymentsVnpay.js` exposing the same testable-export pattern the tested files use. (`testing-evidence.md` §6, Honest summary)

## 5. What this evidence pack cannot verify from static source reading alone

These require either live-system access, team knowledge, or artifacts outside the code — the thesis must not fabricate values for any of them:

- **Real user statistics, usage numbers, or business metrics.** This is a demo system seeded with synthetic/demo data (`backend/seed.js`); any "number of users," "orders processed," "revenue," or similar figure in the thesis must either be clearly labeled as demo/seed data or omitted. Do not present seed-data counts as if they were real adoption metrics.
- **Performance/load-testing numbers** (API response times under load, concurrent-user capacity, try-on pipeline latency in production conditions). No load-testing tooling or results exist in this repository. If the thesis needs performance figures, they must come from the team actually running and measuring the system, not estimation.
- **Whether the described GPU hardware (RTX 5060 Ti, 16GB VRAM) is what the team's actual demo machine has** — this figure appears in the appendices of the prior draft and is consistent with values hardcoded/defaulted in `.env.example` (`JAPANO_MIN_GPU_FREE_GB=8`, VRAM budget comments), but this evidence pack did not run `nvidia-smi` on a live machine to independently confirm it. Treat as plausible-and-internally-consistent, not independently hardware-verified.
- **Whether the AI microservices (FASHN, motion, embedding, CatVTON) are actually installed and runnable on the team's machine** — the Node backend code that calls them is real and verified, but these are external model repositories not vendored into this repo (`README.md:258`: *"Repo không có một requirements.txt chung cho toàn bộ AI stack"*). Whether they are actually set up is a team/environment fact, not something derivable from this repo.
- **Individual team-member contribution breakdown** — the prior draft's task-assignment table (§1.4) cannot be verified against a commit history (see §3 above) or any other source available here. If the thesis needs a contribution breakdown, the team must supply it directly.
- **Screenshots and diagrams.** No UI screenshots exist in this evidence pack (only 13 embedded images were found inside the prior `.docx`, not independently reviewed or extracted here since they are presentation assets, not technical evidence). Every figure the outline calls for (Use Case diagrams, screen screenshots, sitemap diagrams) needs to be produced fresh — either drawn from the verified feature/route inventories in this pack, or captured live from a running instance of the app — before the thesis is finalized.
- **Formal NDCG/Recall or other ML evaluation metrics for the recommendation engine.** `README.md:217` states outright: *"Offline ranking evaluation chưa được triển khai; NDCG@10 và Recall@10 hiện được báo là not-measured, không có số accuracy giả"* ("Offline ranking evaluation has not been implemented; NDCG@10 and Recall@10 are currently reported as not-measured, with no fabricated accuracy numbers"). Any thesis chapter describing the recommender must carry this same caveat rather than inventing an accuracy figure.

## 6. How to use this file

Every other evidence file in `thesis/evidence/` and the Chapter 3 draft in `thesis/chapters/` treat this file as the canonical list of caveats. Where a claim elsewhere in the pack has a caveat, it either restates the specific caveat inline or points back here. When extending this evidence pack to write further chapters, any new gap discovered should be added here rather than silently worked around.
