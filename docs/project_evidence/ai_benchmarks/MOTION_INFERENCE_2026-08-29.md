# JAPANO motion inference benchmark - 2026-08-29

Hardware: NVIDIA GeForce RTX 5060 Ti 16 GB. Engine: One-to-All Animation
1.3B v1 on Wan2.1, BF16 CUDA. The same local accepted try-on image, seed 42,
384 x 640 output, H.264 yuv420p, 49 frames and 12 FPS were used unless the row
says otherwise. The private input image is not included in this document.

## Accepted runtime profiles

| Action | Selected profile | End-to-end | Diffusion | Gate result |
|---|---:|---:|---:|---|
| `walk_natural` | turbo, 12 steps, guidance 1.0/1.0 | 57.834 s direct; 64.925 s through backend | 40.569 s | PASS |
| `turn_show` | turn_fast, 33 frames, 12 steps, guidance 1.5/1.0 | 71.144 s | 49.579 s | PASS and visual A/B accepted |
| `pose_sway` | turbo, procedural pose v2 | 65.527 s | 40.768 s | PASS and visual A/B accepted |

The former quality baseline used 49 frames, 30 steps and guidance 2.5/1.5. A
full `walk_natural` request took 295.4 seconds. The selected walk profile is
therefore about 5.1 times faster while preserving the same frame count,
resolution, codec and quality gate.

## Rejected candidates

| Candidate | Time | Rejection |
|---|---:|---|
| 25 frames, 12 steps | 71.81 s runner | `motionScore=1.1548`, nearly static |
| 25 frames, 16 steps | 93.18 s runner | `motionScore=1.1590`, nearly static |
| `turn_show` turbo | 59.683 s | coarse gate passed, visual side/back garment quality rejected |
| original driving-video `pose_sway` | 65.284 s turbo | coarse gate passed, visual action looked like a dance and garment ghosted |
| procedural pose v1 | 60.398 s | `motionScore=1.0581`, nearly static |

No threshold was lowered to accept a faster clip. `turn_show` deliberately uses
two-pass image guidance instead of the faster single-pass turbo profile.
`pose_sway` uses a larger but restrained procedural weight shift rather than
the dance segment bundled upstream.

## Measured bottleneck

For the accepted turbo walk run: pose 2.109 s, prompt cache 0.0 s, model load
8.304 s, diffusion 40.569 s, GPU-to-CPU conversion 1.227 s, H.264 encode 0.236
s, semantic quality gate 3.604 s. Encoding is not the bottleneck. The main gain
came from replacing three transformer passes per diffusion step with one
directly conditioned pass and reducing steps, not from lowering resolution.

This is inference tuning, not model fine-tuning. A future claim of a fine-tuned
motion model still requires licensed training data, optimizer updates, a saved
checkpoint or adapter with hash, reload verification, and disjoint evaluation.
