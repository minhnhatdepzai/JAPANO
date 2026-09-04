---
name: japano-ui-ux-95
description: Audit and improve JAPANO mobile, Storefront and Web Admin UI/UX to an evidence-backed 9.5/10 quality gate. Use when reviewing, scoring, polishing or redesigning any combination of the three JAPANO interfaces.
---

# JAPANO UI/UX 9.5 gate

Use this skill together with `japano-project-memory`, `frontend-design`,
`web-design-guidelines`, `webapp-testing`, `dashboard-design` for Admin, and
`vercel-react-best-practices` for Storefront. Read each applicable skill before
acting.

## Non-negotiable workflow

1. Read `AGENTS.md` and `docs/CODEX_PROJECT_MEMORY.md`. Inspect the current
   branch and relevant dirty diff; preserve all unrelated work.
2. Audit before editing. Inspect source, then run the actual interfaces and
   capture representative screens. Do not score from source code alone.
3. Test these surfaces independently:
   - Expo/React Native app in `mobile/`.
   - Next.js Storefront in `web/`.
   - Web Admin in `admin/`, including authenticated views when legitimate test
     access is available.
4. Produce a baseline scorecard with evidence and a prioritized defect list.
5. If any surface scores below 9.5, continue into implementation in the same
   task. Fix the highest-impact issues without changing business rules, API
   contracts, permissions, pricing, inventory, AI safety or personal data.
6. Re-run the same flows and viewports, capture after evidence, and rescore. Do
   not stop merely because the code compiles.

## Evidence requirements

- Storefront and Admin: inspect desktop at 1440x900 and mobile at 390x844 or
  412x915. Test keyboard-only navigation, visible focus, 200% zoom, Reduce
  Motion, loading/empty/error/success states, long Vietnamese text and overflow.
- Mobile: prefer the connected OPPO A78. Exercise taps, back navigation,
  scrolling, safe areas, keyboard-open chat/forms, loading/error states and
  readable targets. If the phone cannot be controlled, use an emulator where
  possible and explicitly mark OPPO validation as missing.
- Store screenshots and the audit under `test-results/ui-ux/<date>/` and
  `docs/project_evidence/ui_ux/UI_UX_AUDIT_<date>.md`. Never include secrets or
  personal customer images.
- Run automated accessibility checks for web pages where tooling permits, but
  treat axe/lighthouse as supporting evidence rather than a substitute for
  visual inspection.

## Scoring rubric — 10 points per surface

| Category | Points | Pass evidence |
| --- | ---: | --- |
| Task completion and navigation | 1.5 | Primary journeys work without dead ends or ambiguous actions |
| Information architecture and hierarchy | 1.25 | First screen exposes the right priority; headings and grouping scan clearly |
| Brand and visual craft | 1.25 | Distinct JAPANO identity, disciplined typography, imagery and spacing |
| Consistency and design system | 1.0 | Tokens, controls, states, icons and copy behave consistently |
| Accessibility | 1.5 | Keyboard/touch targets, labels, focus, contrast, zoom and reduced motion pass |
| Responsive/mobile ergonomics | 1.25 | No clipping/overflow; safe areas and keyboard avoidance work |
| Feedback and resilience | 1.0 | Honest loading, empty, error, retry and success states guide the user |
| Perceived performance | 0.75 | Stable skeletons, no avoidable layout shift, duplicate request or blocking |
| Content quality | 0.5 | Natural Vietnamese, consistent action names, no engine jargon for customers |

The final score is the sum of demonstrated category scores, not an impression.
Each of App, Storefront and Admin must independently reach at least 9.5/10.
Also require all of the following:

- no blocker or high-severity usability defect;
- no known WCAG A/AA violation in the audited web flows;
- no clipped primary action, hidden input behind the keyboard, inaccessible
  control, fake loading percentage or crash in the tested flows;
- before/after screenshots and commands/results are recorded.

If real visual/device evidence is unavailable, cap that surface at 8.9 and
state exactly what remains unverified. Never award points for intended code.

## JAPANO critical journeys

- App: launch/home, catalog/filter, product detail, try-on, Japan exploration,
  cart/checkout, Ori chat with keyboard open, account/settings.
- Storefront: home, catalog/search/filter, product detail, try-on, Japan scene,
  cart/checkout and account states.
- Admin: login/recovery, dashboard, products/inventory, orders/returns,
  customers, reviews/moderation, analytics/AI monitoring and responsive tables.

Do not flatten all three products into one identical layout. Keep the shared
brand system, while optimizing the App for thumb use, Storefront for discovery
and conversion, and Admin for fast, trustworthy decisions.

## Implementation guardrails

- Use GitNexus impact analysis before editing and change detection afterward.
- Reuse existing components and tokens before adding dependencies. Do not add a
  library solely to claim improvement; document why any new dependency earns
  its runtime and maintenance cost.
- Do not replace real content with placeholders, remove features to make a
  screenshot cleaner, or weaken authentication/safety to reach a page.
- Preserve user data and use update installs on Android; never uninstall the
  existing app merely to test UI.
- Run targeted tests during work, then backend tests when shared contracts were
  touched, mobile typecheck, Storefront build/typecheck and Playwright/axe flows
  relevant to the changed screens.

## Required handoff

Report the baseline and final score for each surface, exact issues fixed, files
changed, validation commands, screenshot paths and remaining limitations. A
claim of 9.5 is invalid unless the evidence gate above is satisfied.
