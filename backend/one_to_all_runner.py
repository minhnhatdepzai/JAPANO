"""Run One-to-All Animation 1.3B for one JAPANO motion request.

The runner is intentionally a short-lived process: FASHN finishes the try-on
image first and releases CUDA, then this process owns the GPU until the video
is encoded.  Text embeddings are calculated on CPU before the video model is
moved to CUDA so a 16 GB card is used for generation rather than storing T5.
"""

from __future__ import annotations

import argparse
import copy
import gc
import json
import math
import os
import sys
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
import torch
from diffusers.schedulers import FlowMatchEulerDiscreteScheduler
from PIL import Image
from safetensors.torch import load_file as safe_load, save_file as safe_save


MOTIONS = {
    "runway_walk": "The same full-body fashion model walks forward on a runway with clear alternating steps and natural arm movement, then returns to the starting mark. Keep the exact face and clothing.",
    "spin": "The same full-body fashion model completes one clear 360 degree turn in place: front, left profile, back, right profile, then front again. Keep the exact face and clothing.",
    "jump": "The same full-body fashion model bends the knees, jumps once with both feet visibly airborne, lands, and stands straight. Keep the exact face and clothing.",
    "pose_sway": "The same full-body fashion model performs a tasteful fashion pose sequence, shifting weight left and right with natural hip, shoulder and arm movement. Keep the exact face and clothing.",
    "sit_stand": "The same full-body fashion model sits naturally onto a chair and then stands fully upright again. Keep the exact face and clothing.",
}

# Curated upstream driving clips are used where they match the customer-facing
# action.  A real detected motion preserves joint timing and foreshortening;
# the procedural fallback below is kept only for presets that still need a
# licensed, curated driving clip.
DRIVING_MOTIONS = {
    # This section stays upright and cycles through restrained catalogue poses.
    # Other sections include high-knee dance moves unsuitable for customers.
    # Slow this 1.8-second source segment to the 4-second output. Both wrists
    # remain below the shoulders, feet stay grounded, and the hips move enough
    # to read as a natural catalogue pose rather than a frozen photograph.
    "pose_sway": ("examples/vid.mp4", 2.5, 4.3),
}

NEGATIVE = (
    "different person, changed face, changed outfit, changed clothing, extra person, "
    "deformed body, extra limbs, fused hands, blur, frame tearing, camera movement, "
    "cropped body, static image, frozen pose, low quality"
)


def resize_crop(image: Image.Image, width: int, height: int) -> Image.Image:
    source_width, source_height = image.size
    scale = max(width / source_width, height / source_height)
    resized = image.resize((round(source_width * scale), round(source_height * scale)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - width) // 2)
    top = max(0, (resized.height - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def transform_points(points: np.ndarray, center: np.ndarray, x_scale: float, y_scale: float, dx: float, dy: float) -> np.ndarray:
    output = points.copy()
    output[:, 0] = center[0] + (output[:, 0] - center[0]) * x_scale + dx
    output[:, 1] = center[1] + (output[:, 1] - center[1]) * y_scale + dy
    return np.clip(output, 0.01, 0.99)


def body_motion(base: np.ndarray, motion: str, t: float) -> np.ndarray:
    """Create a deterministic, smooth 18-joint pose for the requested action."""
    pose = base.copy()
    neck = base[1].copy()
    hips = (base[8] + base[11]) / 2.0
    center = (neck + hips) / 2.0

    if motion == "spin":
        angle = 2.0 * math.pi * t
        yaw = math.cos(angle)
        pose = transform_points(pose, center, max(0.12, abs(yaw)), 1.0, 0.015 * math.sin(angle), 0.0)
        if yaw < 0:
            pose[:, 0] = 2.0 * center[0] - pose[:, 0]
        # Arms stay slightly away from the torso so side/back frames remain legible.
        pose[4, 0] += 0.025 * math.sin(angle)
        pose[7, 0] -= 0.025 * math.sin(angle)
        return np.clip(pose, 0.01, 0.99)

    if motion == "jump":
        airborne = math.sin(math.pi * t) ** 2
        crouch = math.exp(-((t - 0.12) / 0.09) ** 2) + math.exp(-((t - 0.88) / 0.09) ** 2)
        pose[:, 1] -= 0.16 * airborne
        pose[[9, 12], 1] += 0.07 * crouch
        pose[[10, 13], 0] += np.array([0.035, -0.035]) * crouch
        pose[[4, 7], 1] -= 0.12 * airborne
        return np.clip(pose, 0.01, 0.99)

    if motion == "pose_sway":
        sway = math.sin(2.0 * math.pi * t)
        upper = [0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 16, 17]
        lower = [8, 9, 10, 11, 12, 13]
        pose[upper, 0] += 0.055 * sway
        pose[lower, 0] += 0.025 * sway
        pose[4, 0] += 0.07 * sway
        pose[7, 0] -= 0.07 * sway
        pose[4, 1] -= 0.035 * abs(sway)
        pose[7, 1] -= 0.035 * abs(sway)
        return np.clip(pose, 0.01, 0.99)

    if motion == "sit_stand":
        seated = math.sin(math.pi * t) ** 2
        pose[[0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 16, 17], 1] += 0.16 * seated
        pose[[8, 11], 1] += 0.19 * seated
        pose[[9, 12], 0] += np.array([0.09, -0.09]) * seated
        pose[[9, 12], 1] += 0.08 * seated
        pose[[10, 13], 0] += np.array([0.14, -0.14]) * seated
        pose[[4, 7], 1] += 0.07 * seated
        return np.clip(pose, 0.01, 0.99)

    # runway_walk
    stride = math.sin(6.0 * math.pi * t)
    bob = abs(stride)
    pose[:, 1] -= 0.012 * bob
    pose[10, 0] += 0.08 * stride
    pose[13, 0] -= 0.08 * stride
    pose[9, 1] -= 0.035 * max(0.0, -stride)
    pose[12, 1] -= 0.035 * max(0.0, stride)
    pose[4, 0] -= 0.07 * stride
    pose[7, 0] += 0.07 * stride
    approach = math.sin(math.pi * t)
    pose = transform_points(pose, center, 1.0 + 0.06 * approach, 1.0 + 0.06 * approach, 0.0, 0.0)
    return np.clip(pose, 0.01, 0.99)


POSE_LIMBS = (
    (1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7),
    (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13),
    (1, 0), (0, 14), (14, 16), (0, 15), (15, 17),
)
POSE_COLORS = (
    (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0),
    (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85),
    (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
    (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255),
    (255, 0, 170),
)


def draw_body_pose(pose: dict, height: int, width: int) -> np.ndarray:
    """Draw the One-to-All body control without importing training datasets.

    Importing ``opensora.dataset.utils`` executes the whole training package
    and pulls PyTorch Lightning into a production inference process.  This
    local equivalent keeps startup/RAM small and draws the same 18-joint
    OpenPose representation used by the checkpoint.
    """
    import cv2

    canvas = np.zeros((height, width, 3), dtype=np.uint8)
    candidate = np.asarray(pose["bodies"]["candidate"], dtype=np.float32)
    subset = np.asarray(pose["bodies"]["subset"])[0]
    score = np.asarray(pose["bodies"]["score"], dtype=np.float32)[0]
    thickness = max(2, round(min(height, width) / 128))
    for limb_index, (first, second) in enumerate(POSE_LIMBS):
        first_index, second_index = int(subset[first]), int(subset[second])
        if first_index < 0 or second_index < 0:
            continue
        confidence = float(max(0.25, score[first] * score[second]))
        color = tuple(round(channel * confidence) for channel in POSE_COLORS[limb_index])
        p1 = tuple(np.rint(candidate[first_index] * (width, height)).astype(int))
        p2 = tuple(np.rint(candidate[second_index] * (width, height)).astype(int))
        cv2.line(canvas, p1, p2, color, thickness * 2, cv2.LINE_AA)
    for joint in range(18):
        index = int(subset[joint])
        if index < 0:
            continue
        confidence = float(max(0.25, score[joint]))
        color = tuple(round(channel * confidence) for channel in POSE_COLORS[min(joint, 16)])
        point = tuple(np.rint(candidate[index] * (width, height)).astype(int))
        cv2.circle(canvas, point, thickness * 2, color, -1, cv2.LINE_AA)
    return canvas


def render_procedural_pose_sequence(reference_pose: dict, motion: str, width: int, height: int, frames: int):
    base = np.asarray(reference_pose["bodies"]["candidate"], dtype=np.float32)
    if base.shape != (18, 2):
        raise RuntimeError(f"Pose detector returned {base.shape}; expected 18 body joints.")
    images = []
    for index in range(frames):
        current = copy.deepcopy(reference_pose)
        current["bodies"]["candidate"] = body_motion(base, motion, index / max(1, frames - 1))
        current["hands_score"] = np.zeros_like(current["hands_score"])
        current["faces_score"] = np.zeros_like(current["faces_score"])
        images.append(draw_body_pose(current, height, width))
    array = np.stack(images)
    return torch.from_numpy(array).float().permute(3, 0, 1, 2).unsqueeze(0) / 255.0 * 2.0 - 1.0


def load_pose_model(pose_root: Path):
    from wanpose_utils.pose2d import Pose2d

    detector = pose_root / "det/yolov10m.onnx"
    estimator = pose_root / "pose2d/vitpose_h_wholebody.onnx"
    return Pose2d(checkpoint=str(estimator), detector_checkpoint=str(detector))


def load_reference_pose(image: Image.Image, pose_model):
    from infer_function import aaposemeta_to_dwpose

    result = pose_model([np.asarray(image)])[0]
    if result is None:
        raise RuntimeError("Pose detector did not find one clear person in the try-on image.")
    return result, aaposemeta_to_dwpose(result)


def read_driving_frames(video_path: Path, start_seconds: float, end_seconds: float, frames: int) -> list[np.ndarray]:
    import cv2

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open driving video: {video_path}")
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if fps <= 0 or total <= 0:
        capture.release()
        raise RuntimeError(f"Driving video has invalid metadata: {video_path}")
    first = max(0, min(total - 1, round(start_seconds * fps)))
    last = max(first, min(total - 1, round(end_seconds * fps)))
    indices = np.rint(np.linspace(first, last, frames)).astype(int)
    images: list[np.ndarray] = []
    for index in indices:
        capture.set(cv2.CAP_PROP_POS_FRAMES, int(index))
        ok, frame = capture.read()
        if not ok:
            capture.release()
            raise RuntimeError(f"Cannot read frame {index} from driving video: {video_path}")
        images.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    capture.release()
    return images


def render_driving_pose_sequence(
    reference_meta,
    pose_model,
    video_path: Path,
    start_seconds: float,
    end_seconds: float,
    width: int,
    height: int,
    frames: int,
):
    from infer_function import aaposemeta_to_dwpose, align_to_reference

    driving_frames = read_driving_frames(video_path, start_seconds, end_seconds, frames)
    driving_metas = pose_model(driving_frames)
    if len(driving_metas) != frames or any(meta is None for meta in driving_metas):
        raise RuntimeError("Driving pose detector lost the subject in one or more frames.")
    driving_poses = [aaposemeta_to_dwpose(meta) for meta in driving_metas]
    aligned_poses = align_to_reference(reference_meta, driving_metas, driving_poses, anchor_idx=0)
    images = [draw_body_pose(pose, height, width) for pose in aligned_poses]
    array = np.stack(images)
    return torch.from_numpy(array).float().permute(3, 0, 1, 2).unsqueeze(0) / 255.0 * 2.0 - 1.0


def prompt_cache_path(checkpoint_root: Path, motion: str) -> Path:
    return checkpoint_root / "japano_prompt_cache" / f"{motion}.safetensors"


def prepare_prompt_cache(model_root: Path, checkpoint_root: Path, dtype: torch.dtype) -> None:
    from opensora.encoder_variants import get_text_enc

    print(json.dumps({"stage": "text-encoder", "status": "loading"}), flush=True)
    encoder = get_text_enc("wanx-t2v", str(model_root), dtype)
    with torch.inference_mode():
        prompts = [MOTIONS[motion] for motion in MOTIONS] + [NEGATIVE]
        embeddings = encoder.encode_prompt(
            prompts,
            device=torch.device("cpu"),
            dtype=dtype,
            max_sequence_length=226,
        ).cpu()
    cache_root = checkpoint_root / "japano_prompt_cache"
    cache_root.mkdir(parents=True, exist_ok=True)
    negative = embeddings[-1:].contiguous()
    for index, motion in enumerate(MOTIONS):
        safe_save(
            {"positive": embeddings[index : index + 1].contiguous(), "negative": negative},
            str(prompt_cache_path(checkpoint_root, motion)),
        )
    del embeddings, encoder
    gc.collect()
    print(json.dumps({"stage": "text-encoder", "status": "cached", "motions": len(MOTIONS)}), flush=True)


def load_prompt_embeddings(model_root: Path, checkpoint_root: Path, motion: str, dtype: torch.dtype):
    cache = prompt_cache_path(checkpoint_root, motion)
    if not cache.is_file():
        prepare_prompt_cache(model_root, checkpoint_root, dtype)
    tensors = safe_load(str(cache), device="cpu")
    positive = tensors["positive"].to(dtype=dtype)
    negative = tensors["negative"].to(dtype=dtype)
    return positive, negative


def build_pipeline(repo: Path, model_root: Path, checkpoint_root: Path, device: torch.device, dtype: torch.dtype):
    from diffusers.models import AutoencoderKLWan
    from opensora.model_variants.wanx_diffusers_src import WanTransformer3DModel_Refextractor_2D_Controlnet_prefix
    from opensora.sample.pipeline_wanx_vhuman_tokenreplace import WanPipeline

    config_root = repo / "video-generation/configs"
    transformer = WanTransformer3DModel_Refextractor_2D_Controlnet_prefix.from_config(
        str(config_root / "wan2.1_t2v_1.3b.json")
    ).to(dtype)
    transformer.set_up_controlnet(str(config_root / "wan2.1_t2v_1.3b_controlnet_2.json"), dtype)
    transformer.set_up_refextractor(str(config_root / "wan2.1_t2v_1.3b_refextractor_2d_withmask2.json"), dtype)
    state = {}
    for shard in sorted(checkpoint_root.glob("*.safetensors")):
        state.update(safe_load(str(shard), device="cpu"))
    if not state:
        raise RuntimeError("One-to-All checkpoint shards are missing.")
    transformer.load_state_dict(state, strict=True, assign=True)
    del state
    gc.collect()
    transformer.eval().requires_grad_(False).to(device)

    vae = AutoencoderKLWan.from_pretrained(str(model_root / "vae"), torch_dtype=dtype)
    vae.eval().requires_grad_(False).to(device)
    scheduler = FlowMatchEulerDiscreteScheduler(shift=7.0, num_train_timesteps=1000, use_dynamic_shifting=False)
    return WanPipeline(tokenizer=None, text_encoder=None, transformer=transformer, vae=vae, scheduler=scheduler)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image")
    parser.add_argument("--motion", choices=sorted(MOTIONS))
    parser.add_argument("--output")
    parser.add_argument("--repo", required=True)
    parser.add_argument(
        "--checkpoint",
        default=os.getenv("JAPANO_ONE_TO_ALL_CHECKPOINT", "One-to-All-1.3b_1"),
        help="Checkpoint directory name below <repo>/checkpoints.",
    )
    parser.add_argument("--prepare-prompts", action="store_true")
    parser.add_argument("--frames", type=int, default=49)
    parser.add_argument("--fps", type=float, default=12.0)
    parser.add_argument("--steps", type=int, default=30)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    video_generation = repo / "video-generation"
    if not video_generation.is_dir():
        raise RuntimeError(f"One-to-All source is missing: {video_generation}")
    # The upstream project keeps its Python packages below video-generation
    # instead of installing them into site-packages. Make the runner independent
    # of the service's current working directory.
    sys.path.insert(0, str(video_generation))
    model_root = repo / "pretrained_models/Wan2.1-T2V-1.3B-Diffusers"
    checkpoint_name = Path(args.checkpoint).name
    if checkpoint_name != args.checkpoint:
        raise RuntimeError("--checkpoint must be a directory name, not a path.")
    checkpoint_root = repo / "checkpoints" / checkpoint_name
    pose_root = repo / "pretrained_models/process_checkpoint"
    dtype = torch.bfloat16
    if args.prepare_prompts:
        prepare_prompt_cache(model_root, checkpoint_root, dtype)
        return 0
    if not args.image or not args.motion or not args.output:
        parser.error("--image, --motion and --output are required for video generation")
    if not torch.cuda.is_available():
        raise RuntimeError("One-to-All requires CUDA; CPU fallback is disabled.")
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    device = torch.device("cuda:0")
    print(json.dumps({"stage": "pose", "status": "loading", "device": "cuda"}), flush=True)
    source = Image.open(args.image).convert("RGB")
    ratio = source.height / max(1, source.width)
    if ratio >= 1.0:
        width, height = 384, round(384 * ratio / 16) * 16
    else:
        height, width = 384, round(384 / ratio / 16) * 16
    width, height = min(width, 640), min(height, 640)
    source = resize_crop(source, width, height)

    pose_model = load_pose_model(pose_root)
    reference_meta, reference_pose = load_reference_pose(source, pose_model)
    driving = DRIVING_MOTIONS.get(args.motion)
    if driving:
        driving_path = repo / driving[0]
        print(
            json.dumps(
                {
                    "stage": "pose",
                    "status": "driving-video",
                    "source": str(driving_path),
                    "segment": [driving[1], driving[2]],
                }
            ),
            flush=True,
        )
        control = render_driving_pose_sequence(
            reference_meta,
            pose_model,
            driving_path,
            driving[1],
            driving[2],
            width,
            height,
            args.frames,
        )
    else:
        control = render_procedural_pose_sequence(reference_pose, args.motion, width, height, args.frames)
    del pose_model
    gc.collect()
    pose_image = draw_body_pose(reference_pose, height, width)
    image_pose = torch.from_numpy(pose_image).float().permute(2, 0, 1).unsqueeze(0).unsqueeze(2) / 255.0 * 2.0 - 1.0
    mask = torch.zeros((1, 1, 1, height, width), dtype=torch.float32)

    print(json.dumps({"stage": "pose", "status": "ready", "frames": args.frames}), flush=True)
    prompt_embeds, negative_embeds = load_prompt_embeddings(model_root, checkpoint_root, args.motion, dtype)
    torch.cuda.empty_cache()
    print(json.dumps({"stage": "video-model", "status": "loading", "device": str(device)}), flush=True)
    pipeline = build_pipeline(repo, model_root, checkpoint_root, device, dtype)
    generator = torch.Generator(device=device).manual_seed(max(0, args.seed))
    print(json.dumps({"stage": "denoise", "status": "running", "steps": args.steps}), flush=True)
    with torch.inference_mode(), torch.autocast("cuda", dtype=dtype):
        result = pipeline(
            prompt=None,
            negative_prompt=None,
            prompt_embeds=prompt_embeds.to(device),
            negative_prompt_embeds=negative_embeds.to(device),
            image=source,
            image_mask=mask,
            control_video=control,
            image_pose=image_pose,
            height=height,
            width=width,
            num_frames=args.frames,
            image_guidance_scale=2.5,
            pose_guidance_scale=1.5,
            num_inference_steps=args.steps,
            generator=generator,
            black_image_cfg=True,
            black_pose_cfg=True,
            controlnet_conditioning_scale=1.0,
            return_tensor=True,
            case1=False,
        ).frames
    frames = (result[0].detach().float().cpu() / 2.0 + 0.5).clamp(0, 1).permute(1, 2, 3, 0).numpy()
    frames = (frames * 255.0).round().astype(np.uint8)
    imageio.mimwrite(str(output), list(frames), fps=args.fps, quality=7, codec="libx264")
    print(json.dumps({"ok": True, "output": str(output), "frames": len(frames), "width": width, "height": height}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise
