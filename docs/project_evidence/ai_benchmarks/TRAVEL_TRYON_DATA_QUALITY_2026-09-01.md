# Travel try-on — data, app parity and quality A/B (2026-09-01)

## Scope

- Search Kaggle and official GitHub sources for VTON, fit and pose data.
- Keep Storefront and Expo app on one backend contract.
- Test whether `high` 25 steps is visibly better than `balanced` 20 steps before
  changing the customer-facing default.

## Hardware and runtime

- GPU: NVIDIA GeForce RTX 5060 Ti, 16,311 MiB.
- Backend `:4100`, FASHN/FLUX `:7862`, body analysis `:7863`.
- Base path: FLUX.2 Klein 4B pose edit, then FASHN VTON 1.5.
- Fit LoRA was not configured or loaded during this A/B.

## Dataset audit

Command:

```bash
python3 backend/ai_training/audit_tryon_sources.py
```

Result: `AUDIT_OK`. Local VITON-HD contains 11,647 train and 2,032 test entries
for each required image/cloth/mask/OpenPose/parsing directory; pair-list hashes
match the existing provenance manifest. It remains research-only and does not
provide real fit labels or multi-category coverage. Full decisions and license
gates are in `backend/ai_training/provenance/tryon_sources.manifest.json`.

## Real A/B

Fixed inputs:

- preset: `nu-can-doi`
- product: `yukata-xanh`
- size: `M`
- travel pose: `three-quarter`
- uncached request for each quality profile

| Profile | Engine | HTTP | Duration | Quality warning | Coverage |
|---|---|---:|---:|---|---|
| balanced | `flux2-klein-4b-pose+fashn-vton-1.5+balanced-20steps` | 200 | 54.83 s | none | pass |
| high | `flux2-klein-4b-pose+fashn-vton-1.5+high-25steps` | 200 | 54.57 s | none | pass |

Image comparison at 1152×1536:

- SSIM: `0.992118`
- mean absolute RGB difference: `0.7397 / 255`
- exact RGB pixel equality: `44.12%`

Visual review found no material realism gain from five additional FASHN steps.
Both results preserved a plausible face, Yukata structure and coverage, but the
three-quarter pose remained subtle. Decision: keep `balanced` in both clients;
do not use step count as a substitute for pose-diverse, licensed ground truth.

## Validation

- `npm --workspace mobile run typecheck`: pass.
- `node scripts/validate_japan_scenes.js`: 36/36 pass, covering 35/35 displayed
  places and 38 curated person slots.
- Existing real try-on output matrix: 38/38 HTTP 200, `groundSafe:true`, all with
  real silhouette contact points after final cover/crop.
- OPPO/Tailscale legacy payload matrix (no `sceneId` or `slotId`): 35/35 HTTP
  200 and `groundSafe:true` at `rd-system.tail6502ce.ts.net:4101`.
- Mobile visible-device result: not verified. OPPO A78 is online in Tailscale,
  but `adb connect 100.79.192.97:5555` returns `Connection refused`.

## OPPO scene-compose regression

Backend access logs showed the OPPO repeatedly receiving HTTP 422 at
`Đền Itsukushima · Miyajima` and `Suối nước nóng Ginzan`. The response hashes
matched the fail-closed "chưa có góc chụp" response, so changing the person
photo could never fix it. Both catalog locations now have local, licensed scene
files plus measured `groundPolygon`, `safeZone`, `footAnchor` and `personSlots`.

- Tailnet legacy payload smoke (no `sceneId`/`slotId`): HTTP 200 for both.
- Tailnet curated payload smoke: 419 ms Itsukushima, 446 ms Ginzan.
- Existing real try-on image: 506 ms Itsukushima, 557 ms Ginzan.
- All four responses reported `groundSafe:true` and 9 contact points.

## Full catalog scene-compose regression

The same OPPO access-log signature later exposed Arashiyama: the try-on request
had succeeded, then scene composition returned the exact fail-closed 422 because
the displayed place had no curated ground metadata. An audit found only 14 of
35 displayed places had at least one scene. The catalog now has 36 scenes for
all 35 places (Naoshima intentionally has two), with 38 total person slots.

- All 36 local scene assets pass the license, resolution, safe-zone and ground
  polygon validator.
- All 38 scene/slot combinations were composed from an existing real try-on
  PNG; every result was HTTP 200, `groundSafe:true` and had 9 contact points.
- All 35 legacy payloads were repeated through the OPPO Tailscale endpoint;
  every place returned HTTP 200 with a safe placement.
- Visual contact-sheet review found no placement on water or in the air. The
  Ōdōri source was replaced with a lawn foreground composition so the person
  remains grounded while Sapporo TV Tower stays visible in the portrait crop.
- `npm run check` passes: 349 Node tests, mobile TypeScript, and 104 Python tests
  (2 skipped). Android Expo export also passes with 1,378 modules and 154 assets.
- Visible OPPO UI remains unverified because no ADB device is attached; network
  behavior through the same Tailscale endpoint is verified.
