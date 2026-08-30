# Hidden body anchors and balanced try-on — 2026-08-29

## Scope

This change removes the visible five-person chooser from the customer flow. The
five local adult assets are retained only to define normalized body-shape
reference signatures. A customer supplies one photo; the server uses the
closest eligible reference only as a sizing prior when direct absolute evidence
is unavailable.

The reference is not a tape measurement. A single uncontrolled image cannot
prove height, weight, bust, waist or hip. User-entered measurements and usable
image estimates take precedence, while insufficient evidence remains explicit.
The API response exposes only a generic reference label/ranges/confidence and
never exposes the preset id, file name, URL, bytes or server path.

## Measured verification

- Input: `test-results/tryon-debug/1787936804598-fashn-person.jpg`, not a preset.
- Warm body-analysis response: HTTP 200 in 415 ms.
- Display ranges: height 160–170 cm, weight 50–60 kg, bust 90–100 cm,
  waist 70–80 cm, hip 90–100 cm; recommended size M.
- Closest hidden reference confidence: 0.434. It was reported as context only;
  `usedAnchor` was false because the image estimates were usable.
- Leakage check: no image URL/path, file name or internal anchor id in the
  returned reference object.
- Automated gates: 342 Node tests, mobile TypeScript and 102 Python tests passed
  (2 existing Python skips).

## Latency and quality decision

The app sends `qualityMode=balanced`: 20 FASHN steps with a 1536-pixel long
edge. A structure-critical long Haori measured 37.61 s when the optional FLUX
fidelity pass was skipped, but visual review rejected that result because the
outerwear became too short and lost its intended structure. The accepted Haori
path therefore retains fidelity and measured 74.99 s. Ordinary non-critical
garments may skip that extra pass; the app must not promise that every request
finishes below one minute.

This is inference profiling and sizing calibration, not fine-tuning. At the
time of verification `/health` reported no configured fit-LoRA path, no loaded
adapter and no checkpoint hash.

## Android delivery

- APK: `JAPANO-oppo-a78-v1.0.10.apk`
- Package/version: `vn.japano.app`, 1.0.10, versionCode 11, targetSdk 34.
- SHA-256: `88c489de5d880076bcd965b6100b68c163bac1ac40849584405621786a57a422`
- Size: 123,389,702 bytes.
- Redmi Note 8 Pro: `adb install -r` succeeded; version metadata, home logo,
  hidden-preset try-on screen and Android image-picker launch were verified.
- OPPO A78: not attached, so installation and visible flow remain unverified on
  that exact device.
