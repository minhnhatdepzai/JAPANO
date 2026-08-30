---
name: japano-travel-tryon
description: Use when working on the JAPANO "Đưa tôi đến đây" travel try-on flow — spot-based product recommendations, in-place virtual try-on, Japan scene compositing, scene metadata and camera angles.
---

# JAPANO travel try-on

The business question this feature answers is not "can you paste me into a
photo". It is:

> "If I wear this JAPANO product and photograph myself here, will it look good?"

Every change must keep that question answerable. Read
`docs/CODEX_PROJECT_MEMORY.md` first.

## The pipeline, in this order

```
ảnh người dùng  →  thử sản phẩm JAPANO  →  cổng danh tính/chất lượng
                →  ghép người ĐÃ MẶC ĐỒ vào phong cảnh  →  ảnh cuối
```

Never composite into the scene first and try the garment on afterwards. Once the
person is on a busy background, the try-on model has a far harder time holding
the face, the body and the perspective.

If try-on fails, do not composite the failed image. If try-on succeeded and only
the composite failed, keep the try-on image on screen and offer to retry the
composite alone — never make the user run try-on again.

## Non-negotiables

- **Recommended products must exist and be in stock.** No placeholder IDs, no
  invented products. Everything comes from the live catalog.
- **Try-on and compositing happen in the same screen.** Changing product must not
  clear the photo, the spot, the scene or the scroll position.
- **No new MongoDB collection** for recommendations, scenes, composites or
  try-on results. These are derived data or static files; RAM/disk caches with a
  TTL are the correct home.
- **Face, identity, body and skin tone survive unchanged.** The fast composite
  only replaces the background. No generative face repair in fast mode.
- **Personal photos are never persisted**, never logged as base64, never sent to
  an arbitrary URL. Only preset results may be cached.
- **No LLM call on screen open.** Scoring is rule-based so it is fast, free,
  stable between two opens, and testable.

## Scene metadata is not optional

A background is only usable if a person can physically stand in it. The
Naoshima scene that started this work had a valid licence, the right place and
enough resolution — and was shot from a boat, so the bottom 45% of the frame was
open sea. Compositing put the model waist-deep in water.

Every scene therefore carries its own `composition`:
`footAnchor`, `groundPolygon`, `personHeightRatio`, `safeZone`,
`landmarkAvoidRects`, `lightDirection`, `lightTemperature`, `shadow*`,
`personSlots`. A single shared "centre, bottom of frame" position is wrong for
almost every real photograph.

Two rules that are easy to get wrong:

- Metadata is measured on the **source image**. The output frame is portrait and
  most scenery is landscape, so cropping happens. Crop **around the foot anchor**
  and map the anchor into frame coordinates; cropping centre-first silently moves
  the ground out from under the person. This bug put a model on top of a traffic
  cone.
- Licence and resolution do not make a scene usable. Of six well-licensed,
  high-resolution candidates reviewed on 2026-08-29, three were rejected for
  composition: a bamboo close-up with no path, an aerial village view, and a
  canal shot whose lower centre was water.

Run `node scripts/validate_japan_scenes.js` after any scene change. It fails on
anchors outside the ground polygon, missing licence fields, small images,
oversized people and slots that do not stand on ground.

## Swimwear

Swimwear may be recommended at a beach or resort spot, and only when the request
has passed the adult gate. It is never recommended at a shrine, temple, memorial
or any spot marked `modest`. Never disable the adult gate or the coverage gate,
and never route a child image into that flow.

## Verifying

`/run` and `/verify`. HTTP 200 is not evidence — **look at the image**. For each
composite check: feet on ground, not floating, not on water, landmark not
covered, sensible scale, light plausible, no halo, face unchanged, body not
distorted, garment unchanged, attribution shown. Save QA output to
`test-results/japan-scenes/` and build a before/after contact sheet.

Report real timings for recommendations, try-on and compositing separately.
