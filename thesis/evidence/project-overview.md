# Evidence: Project Overview

Status: synthesized from `README.md` (root), the existing draft report's front matter (verified accurate — team/title/advisor information, not technical claims), and the verified technical evidence in the other files in this pack.

## What the project is

JAPANO is a Japan-fashion-themed e-commerce platform consisting of three coordinated applications sharing one backend:

1. **Mobile app** (`mobile/`) — Expo/React Native, the primary customer-facing shopping experience (catalog, cart, checkout, orders, returns) plus a set of AI-assisted features (chat assistant, virtual try-on, style/size advice, savings-goal planning) and a Japan-destination content/loyalty layer (Flagcards, community spot reviews).
2. **Web admin panel** (`admin/`) — a no-build-step, vanilla HTML/CSS/JS dashboard for managing products, orders, returns, users/roles, vouchers, notifications, and content moderation.
3. **Backend API** (`backend/`) — a single Node.js/Express process (default port 4100) that serves the REST API, the admin panel's static files, and orchestrates optional local AI microservices.

Full technical detail for each is in `architecture.md`, `api-inventory.md`, `technology-stack.md`, `database-analysis.md`, and `feature-inventory.md`.

## Team and academic context (front-matter, from the existing draft report)

- Institution: Trường Cao đẳng FPT Polytechnic.
- Advisor: Thầy Nguyễn Ngọc Chấn.
- Team: Lê Minh Nhật (PS46869), Hồ Ngọc Vũ (PS46157), Đặng Huy Phát (PS43608).
- Stated project period: 05/2026 – 07/2026.

**Caveat on this section:** this information comes from the front matter of a prior draft report found alongside the codebase (`baocao (2).docx`). While the *chapter/section structure* of that document is a reasonable template to follow (see `missing-information.md`), its *technical content* was found to be substantially fabricated or badly outdated (wrong file paths, wrong primary database technology, wrong default port, invented features). The front-matter/team information itself is not a technical claim this evidence pack can independently verify from source code — it should be confirmed with the team before being reused verbatim in a new thesis.

## Problem statement (grounded in what the code actually addresses)

The system solves for: (a) a mobile-first shopping flow for Japan-style fashion products with a full cart→checkout→order→post-sale-service lifecycle (cancellation, return/refund with photo evidence, review), (b) three payment paths (COD, Stripe Test Mode, VNPay Sandbox) unified behind one order-creation code path so pricing/discount logic is never duplicated per gateway, (c) an admin operating surface with role-scoped access (customer-invisible; staff/admin/super_admin tiers with different capability), and (d) a set of AI-assisted shopping aids (chat, try-on, size/style advice) layered on top of, but never blocking, the core commerce flow — every AI integration point has a documented fallback so the app functions without a GPU or external model reachable (`README.md:60`, verified in `architecture.md` §6).

## Honest scope framing for the thesis

This is a **student capstone / demo-and-research prototype**, not a deployed production system — a framing the codebase itself adopts (`README.md:11-12`'s own banner: *"JAPANO hiện là full-stack demo/research prototype, chưa phải hệ thống production"*). The thesis should present it as such: a substantial, largely-working, real full-stack implementation with a JWT-based auth/RBAC layer that was added during development (see `missing-information.md` for the exact discrepancy this creates against the README's own stated limitations section), genuine automated test coverage in specific areas, and a set of clearly identified, honestly documented gaps (see `security-analysis.md`, `testing-evidence.md`, and `feature-inventory.md` §7) rather than a finished commercial product.

## What must NOT be claimed (see other evidence files for full detail)

- MongoDB/Mongoose as the primary database (it is an optional single-document mirror of a JSON file — `database-analysis.md`).
- A single-file `server/index.mjs` backend (the real backend is modular, 17 route files + 34 lib files — `api-inventory.md`, `architecture.md`).
- Any mini-game or coin/point economy feature (confirmed absent by repo-wide search — `feature-inventory.md` §7).
- Live/production payment processing (both gateways are hard-restricted to test/sandbox credentials — `security-analysis.md` §6).
- A commit-history-based development narrative (no usable git history exists in this repository snapshot — `git-history-summary.md`).
