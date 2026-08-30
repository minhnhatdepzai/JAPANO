---
name: japano-motion-fast-inference
description: Profile and accelerate JAPANO One-to-All/Wan motion inference with cold/warm stage timings, controlled frame-step sweeps, GPU verification, and unchanged quality gates. Use when video generation is slow, GPU utilization is questioned, motion profiles change, or OPPO Android MP4 delivery needs validation; do not use this skill as evidence that a model was fine-tuned.
---

# JAPANO motion fast inference

Work only from the current state of `/home/nhat/Downloads/japano`. Preserve
concurrent changes and identify process ownership before cancelling, restarting,
or changing a live service.

## Diagnose the real wait

Trace `backend/motion_service.py`, `backend/one_to_all_runner.py`,
`backend/motion_quality.py`, the `/api/tryon/motion` route, GPU arbitration, and
the mobile request/playback path. Record separately:

- queue and VRAM handoff;
- pose preparation;
- prompt-cache hit or build;
- transformer and VAE load;
- diffusion;
- tensor transfer and H.264 encode;
- semantic quality gate;
- API transfer and mobile-visible total.

For every run record input dimensions, output dimensions, frames, FPS, steps,
seed, checkpoint, dtype, peak VRAM/RAM, GPU utilization, success/rejection, and
an `ffprobe` result. A health response or 100% GPU utilization is not latency
evidence. Measure one cold run and at least one comparable warm run when model
residency exists.

The current runner is a short-lived subprocess and therefore reloads pose,
transformer, checkpoint shards, and VAE for every request. Treat `/warmup` as a
CUDA/file probe until source evidence proves weights remain resident.

## Optimize in evidence order

1. Add machine-readable stage timings before changing quality parameters.
2. Reuse action pose tensors, prompt embeddings, and safe preprocessing keyed by
   checkpoint, action, resolution, frames, and source hash.
3. Benchmark persistent model residency with an idle timeout only if GPU
   arbitration can explicitly unload it before FASHN/Ollama work.
4. Verify BF16 CUDA placement and benchmark supported SDPA/Flash Attention
   options one at a time. Do not enable compile, quantization, or CPU offload on
   speculation.
5. Sweep frames and steps on the same accepted try-on image, action, seed, and
   resolution. The existing gate requires at least 17 frames. Keep the fastest
   candidate that passes the unchanged file, continuity, full-body pose, and
   action gates, then compare garment and identity visually.
6. Preserve an Android-compatible H.264/yuv420p MP4. Hardware encoding matters
   only after measuring encode as a meaningful fraction of total time.

Prefer explicit `quality` and `fast` profiles over silent global degradation.
The mobile response should state the actual profile and measured generation
time when the API contract supports it. Retry only a failed stage and cap it;
never hide a slow or rejected first run behind an unreported retry.

## Quality and fine-tuning boundary

Reject an optimization that causes face/body drift, changes garment category,
color, pattern, logo, fit/length/seam state, introduces temporal tears, loses
the full body, or fails the selected action. Save baseline and candidate MP4s,
contact sheets, metrics, and identical-parameter manifests.

Fine-tuning improves domain behavior; it does not inherently reduce diffusion
cost. Use `fine-tuned` only after a licensed dataset manifest, a real optimizer
update, saved adapter/checkpoint with hash, reload test, disjoint evaluation,
and accepted baseline comparison. For latency, use measured inference changes,
distillation, a compatible acceleration adapter, or a smaller model and label
each accurately.

## Completion gate

Report cold/warm end-to-end time, stage breakdown, quality result, playable MP4
metadata, and API result. On OPPO A78, preserve app data, use update install, and
verify actual playback/logcat when ADB is available. Otherwise label device
playback `PENDING_DEVICE`; do not call backend generation an Android pass.
