---
name: japano-full-outfit-tryon
description: Extend JAPANO virtual try-on from one garment to a complete, believable outfit — footwear, dresses, layered tops/bottoms and accessories in a single look — with slot-aware pairing suggestions, photoreal Japan scene compositing, and identical behaviour on mobile and storefront. Use for multi-item try-on, "the pants vanished" defects, outfit completeness, accessory compositing, scene realism, or adding Japan locations.
---

# JAPANO full-outfit try-on

Use together with `japano-travel-tryon` (scene pipeline order and camera rules),
`japano-project-memory` (read first), `japano-gpu-performance` (latency budget)
and `japano-fit-trainer` (only if a real LoRA is on the table).

The question this feature must answer is not "can you put a shirt on me". It is:

> "If I wear **this whole outfit** and photograph myself **there**, does it look
> like a real holiday photo of me?"

A pass that produces a floating top over erased trousers, or a person pasted at
the wrong scale onto a temple, has not answered it.

---

## 1. Read the ground truth before proposing anything

The pipeline is further along than it looks. Do not rebuild what exists.

| Fact | Where |
|---|---|
| Multi-garment already works: `productIds` array, capped at 3 | `backend/routes/tryon.js` (`b.productIds.slice(0, 3)`) |
| Slot validation + layer ordering | `resolveOutfitGarments()` in `backend/routes/tryon.js` |
| Per-garment taxonomy: zone, layer, `fashnCategory`, coverage map, `adultOnlyTryOn`, `tearAllowed` | `backend/lib/garmentCoverage.js` (`GARMENT_PROFILES`) |
| Absolute safety floor — chest/pelvis/buttocks always covered | `ALWAYS_COVERED_ZONES`, same file |
| Two-piece sets are split into one top + one bottom and worn sequentially | `resolveTwoPieceGarmentImages()` in `backend/lib/garmentImages.js` |
| Outfit pairing engine (HSL harmony + tag cosine + trending) | `composeOutfit()` in `backend/lib/outfit.js` |
| Accessories run a **separate** pipeline, not the FASHN path | `backend/lib/accessory.js` → `backend/accessory_pipeline.py` |
| Scene metadata per image: `footAnchor`, `groundPolygon`, `personHeightRatio`, `safeZone`, `landmarkAvoidRects`, `personSlots`, light/shadow | `backend/lib/japanScenes.js` |
| Compositing is U2Net segmentation — no GPU, no generative model | `backend/scene_compose.py` |
| Backgrounds resolve server-side; client sends a **place name only** | `backend/lib/japanSceneBackgrounds.js` |

**The single most important engine constraint:** FASHN accepts **one garment
region per pass**. Every additional garment is another full-image regeneration.
That is the root of both the latency budget and the "it erased my trousers"
class of bug. Any design that assumes "send all items at once" is wrong.

---

## 2. Known gaps — these are the work, not the discovery

These were verified in the repository. Confirm each still holds before acting;
do not treat this list as permission to skip reading the code.

1. **No footwear slot exists.** Layers are `upper-base`, `upper-outer`, `lower`,
   `overall`. Shoes have nowhere to go, so they cannot be tried on at all.
2. **Accessories are rejected outright** on the try-on path: products in
   `phu-kien` throw a 400 telling the user to use the accessory section. A user
   who wants "áo + quần + túi" in one image cannot get it.
3. **Two taxonomies that never meet.** `garmentCoverage.js` knows body zones and
   layers per garment type; `outfit.js` derives a coarse role from *category*
   alone (`base`/`outer`/`accessory`/`standalone`) and has **no bottom and no
   footwear role**. Because of that, nothing in the system can answer "this look
   has a top and no bottom" — which is exactly what the pairing suggestion needs.
4. **Client parity is inverted.** `mobile/app/tryon.tsx` already sends
   `productIds`; `web/components/tryon-studio.tsx` still sends a single
   `productId`. The storefront is behind the app, not ahead of it.

---

## 3. Non-negotiable rules

**Never weaken safety to complete a look.** `ALWAYS_COVERED_ZONES`, the adult
gate, the preset SHA-256 check and the coverage gates stay exactly as strict.
An outfit that cannot be assembled safely is refused, not degraded.

**Never fabricate a garment.** If an item has no usable try-on image, say so.
Pasting a catalog cut-out over the body is a fallback this project has already
rejected once; do not reintroduce it.

**Never composite before dressing.** Try on first, gate, then place into the
scene. `japano-travel-tryon` explains why.

**Never call inference work "fine-tuning".** `AGENTS.md` rule 4 is binding: a
fine-tune claim requires a licensed dataset manifest, optimizer updates, a
reloadable checkpoint/adapter with a hash, a reload test and held-out evaluation.
Prompt changes, scheduler changes, mask changes, LoRA *inference*, and parameter
sweeps are **not** fine-tuning. Say "inference-tuned" or "pipeline change". If a
real LoRA is warranted, switch to `japano-fit-trainer` and do it properly.

**Never let latency regress silently.** Each extra garment is another GPU pass.
Measure and report the per-item cost; if a 3-item look crosses the budget, say
so with numbers instead of shipping a spinner that runs for two minutes.

**Client parity is part of "done".** A capability that exists on only one of
mobile / storefront is unfinished. Same slots, same suggestions, same copy, same
error states, same refusals.

---

## 4. Design guidance for the four asks

### 4a. Preserving what is already worn

The failure mode is that pass N regenerates the whole person and loses what pass
N−1 put on. Establish which is actually happening before choosing a fix:

- the model returned a person with no trousers (generation lost it), or
- the pipeline never sent trousers and the original photo's trousers were
  replaced by bare legs during the `tops` pass.

The honest fixes, in order of preference: run passes in a fixed layer order and
carry the *result* image forward as the next pass's person image; mask-protect
regions no pass owns; and verify preservation by comparing body-zone coverage
before and after each pass, not by eyeballing one screenshot.

Add a regression test that dresses a top onto a person already wearing a bottom
and asserts the lower zone is still covered afterwards.

### 4b. Footwear, dresses and accessories in one look

Extend the taxonomy rather than special-casing. A slot model needs at least
`head`, `upper-base`, `upper-outer`, `lower`, `overall`, `feet`, and
`accessory-*`, with explicit rules for which slots conflict (`overall` excludes
`upper-base` + `lower`; `feet` conflicts with nothing).

Footwear and accessories may not belong on the FASHN path at all — the accessory
pipeline already exists and is segmentation-based. Decide per slot which engine
owns it, write the decision down, and make the router explicit. Do not send
shoes to a garment model just because the plumbing is there.

Whatever the routing, the user-visible result must be **one image** containing
every chosen item, or an explicit refusal naming the item that could not be
placed.

### 4c. Suggesting what is missing

The suggestion must be driven by **slot completeness against the current look**,
not by generic "you may also like". Bridge `garmentCoverage.js`'s slot knowledge
into `outfit.js` so the engine can say "this look has upper-base and feet, it is
missing lower" and then rank candidates for that specific empty slot with the
existing HSL-harmony + tag-cosine + trending scoring.

Suggestions must be honest about stock and price, must respect the adult gate,
and must never suggest an item that would violate a slot conflict.

### 4d. Making the Japan composite look real

The composite is already pixel-preserving; realism failures are almost always
**geometry and light**, not model quality. Work the measurable causes:

- scale from `personHeightRatio`, position from `footAnchor`/`personSlots`,
  standing surface from `groundPolygon` — a person must be *on* ground;
- crop around the foot anchor, never centre-crop (this is what once put a model
  on a traffic cone);
- shadow direction and softness consistent with the scene's light direction;
- edge quality from segmentation — halos and chopped hair read as fake faster
  than anything else;
- colour temperature and white balance matched between subject and background.

Judge realism with before/after image pairs at full size, not thumbnails.

### 4e. Adding Japan locations

Licence and resolution do **not** make a scene usable — composition does. Three
of six well-licensed candidates were rejected on composition alone. For each new
location: confirm the licence, download into the repo (do not hotlink), measure
`footAnchor`/`groundPolygon`/`personHeightRatio`/`safeZone`/`landmarkAvoidRects`
on the **source image**, add matching entries to both
`backend/lib/japanScenes.js` and `mobile/lib/japanSpots.ts`, then run
`node scripts/validate_japan_scenes.js`.

`backend/test/japan-scene.test.js` compares the backend table against the mobile
table directly — they must stay in step or the suite fails.

---

## 5. Evidence gate

A claim of "done" requires all of the following. Screenshots of a happy path are
not sufficient.

| Requirement | How it is demonstrated |
|---|---|
| Multi-slot look renders | Real API run producing one image containing every requested item; slots listed in the response |
| Nothing is silently dropped | Body-zone coverage compared before/after each pass; a test asserting a prior garment survives the next pass |
| Footwear works | A real run with shoes in the look, image inspected at full size |
| Accessory in the same image | A real run combining garment + accessory, or an explicit documented refusal |
| Suggestions are slot-driven | Given a look missing a slot, the API names that slot and proposes items for it |
| Scene realism | Before/after full-size pairs on at least 3 scenes, with the geometry values used |
| New locations | `node scripts/validate_japan_scenes.js` passes; backend/mobile tables in step |
| Parity | The same look, suggestions and refusals reproduced on storefront **and** mobile, each with its own evidence |
| Latency | Measured seconds per pass and per look, compared against the previous baseline |
| Safety intact | Adult gate, coverage gates and preset hash check all still enforced, with the tests to prove it |
| Suites green | `npm --workspace backend test`, `npm run test:python`, mobile typecheck, storefront typecheck/lint/build |

Bump `PIPELINE_VERSION` in `backend/lib/tryonCache.js` whenever generation
changes, or cached preset images will mask the change entirely.

Device reality: if no OPPO A78 is attached, mobile evidence is **missing**, and
that must be stated plainly rather than substituted with code reading. Do not
boot a GPU-accelerated emulator on this machine — it has crashed the user's
remote desktop session before.

---

## 6. Reporting

Report per capability: what works with evidence, what is refused by design, what
is still broken, measured latency, and what remains unverified and why. Never
present an intended behaviour as a delivered one, and never describe a parameter
or prompt change as training.
