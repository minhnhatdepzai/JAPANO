# Brand, cinematic catalog and two-piece swimwear evidence — 2026-08-29

## Scope

- Android launcher/adaptive icon and in-app greeting logo.
- Native-driver product poster/scroll effects with Reduce Motion support.
- Adult two-piece swimwear try-on on the local RTX 5060 Ti 16 GB.

## Root cause and rejected candidates

The catalog flat-lay contained two tops and two bottoms, while the backend sent
the set as FASHN category `one-pieces`. A real request returned HTTP 200 in
39.561 s but visually produced a connected dress/jumpsuit; the coverage checker
also reported missing intended abdomen exposure. This candidate was rejected.

A second experiment split the set into sequential `bottoms` then `tops` FASHN
passes. It took 91.748 s and was rejected by the identity/body quality gate. A
manual inspection confirmed the lower reference had become a skirt-like panel,
so lowering the gate threshold would have shipped the wrong product.

## Accepted pipeline

- Approved reference assets contain exactly one top and one bottom.
- FLUX.2 Klein 4B receives the person, top and bottom simultaneously in one
  multi-reference edit. The prompt locks identity/body and explicitly forbids a
  skirt, shorts, dress, jumpsuit, fabric bridge, transparency and unsafe
  exposure.
- Chest, pelvis and buttocks remain mandatory covered zones. Explicit 18+
  attestation remains required. A visual `no` and an unavailable safety service
  still fail closed; an `unsure` verdict is disclosed and may rely on the adult
  user's attestation.
- The image-analysis request caches only `{verdict, fingerprint}` in memory for
  ten minutes. It never stores the image/base64. The following try-on reuses the
  decision and avoids loading the vision model twice.
- GPU job type `swimwear` keeps the service available without pre-warming the
  unused FASHN checkpoint.

## Real smoke result

Input: `test-assets/people/average/00858_00.jpg`, catalog product
`bikini-hoa-anh-dao`, size M, explicit adult consent.

| Stage | Result |
|---|---:|
| Body analysis + first adult check | 25.396 s, adult `yes`, recommended M |
| Full `/api/tryon` after cache | 58.066 s backend / 58.181 s wall |
| Engine | `flux2-klein-4b-two-piece-swimwear` |
| Output | PNG 1152 x 1536 |
| Quality | HTTP 200, identity/structure gate pass, no attempts |
| Coverage | pass, zero reasons, zero warnings |

Manual visual inspection confirmed two disconnected pieces, exposed midriff,
high-waist brief ending at the upper thighs, matching white/pink sakura print,
and no skirt/jumpsuit. The original face and overall body identity remained
recognizable. Temporary diagnostic images were not committed.

## Coverage regression found from the current OPPO flow

A later OPPO request reached FLUX successfully and produced the correct
two-piece image, but the backend returned HTTP 422 with
`required_zone_exposed:chest,pelvis,buttocks`. The failure was after inference,
not an adult-gate or model-generation failure.

Root cause:

- the coverage checker reused pose/body boxes from the clean input when scoring
  an output where FLUX had changed the person's scale and position;
- the standard full-zone 34% skin threshold treated legitimate exposed skin
  around a bikini top/brief as if the protected area itself were uncovered.

The checker now detects pose separately on clean and result images. For
`minimal-swimwear`, it still requires chest, pelvis and buttocks coverage but
scores the protected garment core inside each region. It remains fail-closed:
tests with an exposed/nude protected core are rejected.

Post-fix real full-API smoke, same catalog product and adult consent:

| Stage | Result |
|---|---:|
| Full `/api/tryon`, cold cache | 72.564 s backend / about 73 s wall |
| Response | HTTP 200, real `data:image` (1,127,958 characters) |
| Engine | `flux2-klein-4b-two-piece-swimwear` |
| Coverage | pass, zero reasons, zero warnings |
| Attempts / adult gate | no retries; adult `yes` |

This was a backend-only correction, so the installed APK does not need another
download. The post-fix button flow has not yet been tapped and visually checked
on the OPPO itself.

## Validation

- Mobile TypeScript: pass.
- Python syntax compile for `backend/fashn_service.py`: pass.
- Focused Node tests: 89/89 pass across adult policy/cache, garment coverage,
  swimwear, try-on and GPU queue. Focused Python coverage tests: 21/21 pass.
- `git diff --check`: pass.
- Android release build: pass; `vn.japano.app` 1.0.4 (`versionCode 5`), v1/v2
  signature verified. The icon extracted from the APK is the JAPANO monogram.
  Tailnet download returned HTTP 200 with APK MIME. Artifact SHA-256:
  `bc7fac10f5dea9a5fc5e307a255893f41922cbf18c282768f45945ac35be0bb9`.
- No ADB device was attached; launcher icon, greeting logo, cinematic scroll and
  update-install are not yet visually verified on the OPPO A78.
