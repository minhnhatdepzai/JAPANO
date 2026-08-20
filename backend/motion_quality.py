"""Reject One-to-All clips that are static, torn, or miss the chosen action."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np


MOTION_ALIASES = {
    "walk_natural": "runway_walk",
    "turn_show": "spin",
}


def read_video(path: Path) -> tuple[list[np.ndarray], float]:
    capture = cv2.VideoCapture(str(path))
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 12.0)
    frames: list[np.ndarray] = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frames.append(frame)
    capture.release()
    if not frames:
        raise RuntimeError("Không đọc được frame nào từ video One-to-All.")
    return frames, fps


def visual_metrics(frames: list[np.ndarray]) -> dict[str, float]:
    step = max(1, len(frames) // 24)
    grays = [cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (128, 192)) for frame in frames[::step]]
    flows: list[float] = []
    correlations: list[float] = []
    changes: list[float] = []
    for before, after in zip(grays, grays[1:]):
        flow = cv2.calcOpticalFlowFarneback(before, after, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        magnitude = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
        flows.append(float(np.percentile(magnitude, 90)))
        first = before.astype(np.float32).ravel()
        second = after.astype(np.float32).ravel()
        changes.append(float(np.mean(np.abs(first - second)) / 255.0))
        first -= first.mean()
        second -= second.mean()
        denominator = float(np.linalg.norm(first) * np.linalg.norm(second))
        correlations.append(float(np.dot(first, second) / denominator) if denominator else 0.0)
    return {
        "motionScore": float(np.mean(flows)) if flows else 0.0,
        "continuity": float(np.percentile(correlations, 10)) if correlations else 0.0,
        "frameChangeP95": float(np.percentile(changes, 95)) if changes else 1.0,
    }


def detect_poses(frames: list[np.ndarray], pose_root: Path, source_root: Path) -> list[np.ndarray]:
    sys.path.insert(0, str(source_root / "video-generation"))
    from wanpose_utils.pose2d import Pose2d

    detector = pose_root / "det/yolov10m.onnx"
    estimator = pose_root / "pose2d/vitpose_h_wholebody.onnx"
    model = Pose2d(checkpoint=str(estimator), detector_checkpoint=str(detector))
    sample_count = min(13, len(frames))
    indexes = np.linspace(0, len(frames) - 1, sample_count).round().astype(int)
    rgb_frames = [cv2.cvtColor(frames[index], cv2.COLOR_BGR2RGB) for index in indexes]
    results = model(rgb_frames)
    poses: list[np.ndarray] = []
    for result in results:
        if result is None:
            continue
        body = np.asarray(result["keypoints_body"][:-2], dtype=np.float32)
        if body.shape == (18, 3) and int((body[:, 2] > 0.25).sum()) >= 12:
            poses.append(body)
    return poses


def action_metrics(poses: list[np.ndarray]) -> dict[str, float]:
    points = np.stack([pose[:, :2] for pose in poses])
    shoulder_width = np.linalg.norm(points[:, 2] - points[:, 5], axis=1)
    hip_center = (points[:, 8] + points[:, 11]) / 2.0
    ankle_center = (points[:, 10] + points[:, 13]) / 2.0
    ankle_gap = np.linalg.norm(points[:, 10] - points[:, 13], axis=1)
    body_height = np.maximum(points[:, 10, 1], points[:, 13, 1]) - points[:, 0, 1]
    first_last = float(np.mean(np.linalg.norm(points[0] - points[-1], axis=1)))
    return {
        "shoulderCompression": float(shoulder_width.min() / max(shoulder_width.max(), 1e-5)),
        "hipTravelX": float(np.ptp(hip_center[:, 0])),
        "hipTravelY": float(np.ptp(hip_center[:, 1])),
        "ankleTravelY": float(np.ptp(ankle_center[:, 1])),
        "ankleGapChange": float(np.ptp(ankle_gap)),
        "bodyScaleChange": float(np.ptp(body_height)),
        "firstLastPoseDistance": first_last,
    }


def validate_action(motion: str, metrics: dict[str, float]) -> str | None:
    if motion == "spin":
        if metrics["shoulderCompression"] > 0.82:
            return "nhân vật chưa xoay đủ qua góc nghiêng/lưng"
        if metrics["firstLastPoseDistance"] > 0.18:
            return "vòng xoay chưa trở về dáng ban đầu"
    elif motion == "jump" and max(metrics["ankleTravelY"], metrics["hipTravelY"]) < 0.055:
        return "chưa nhận thấy pha bật nhảy và tiếp đất rõ"
    elif motion == "pose_sway" and metrics["hipTravelX"] < 0.045:
        return "dáng chưa chuyển trọng tâm qua lại đủ rõ"
    elif motion == "sit_stand" and metrics["hipTravelY"] < 0.075:
        return "chưa nhận thấy hạ hông ngồi xuống rồi đứng lên"
    elif motion == "runway_walk" and max(metrics["ankleGapChange"], metrics["bodyScaleChange"]) < 0.045:
        return "chưa nhận thấy bước chân đi bộ đủ rõ"
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument(
        "--motion",
        choices=["walk_natural", "turn_show", "runway_walk", "spin", "jump", "pose_sway", "sit_stand"],
        required=True,
    )
    parser.add_argument("--repo", type=Path, required=True)
    args = parser.parse_args()
    quality_motion = MOTION_ALIASES.get(args.motion, args.motion)

    frames, fps = read_video(args.video)
    height, width = frames[0].shape[:2]
    visual = visual_metrics(frames)
    rejection = None
    if len(frames) < 17 or width < 240 or height < 240:
        rejection = "video thiếu frame hoặc độ phân giải quá thấp"
    elif visual["motionScore"] < 1.35:
        rejection = "video gần như đứng yên"
    elif visual["continuity"] < 0.58 or visual["frameChangeP95"] > 0.32:
        rejection = "video bị nhảy cảnh hoặc rách hình"

    poses: list[np.ndarray] = []
    action: dict[str, float] = {}
    if rejection is None:
        poses = detect_poses(
            frames,
            args.repo / "pretrained_models/process_checkpoint",
            args.repo,
        )
        if len(poses) < 7:
            rejection = "không giữ được một nhân vật toàn thân rõ xuyên suốt video"
        else:
            action = action_metrics(poses)
            rejection = validate_action(quality_motion, action)

    report = {
        "ok": rejection is None,
        "motion": args.motion,
        "qualityMotion": quality_motion,
        "frames": len(frames),
        "fps": round(fps, 3),
        "width": width,
        "height": height,
        "poseSamples": len(poses),
        **{key: round(value, 4) for key, value in visual.items()},
        **{key: round(value, 4) for key, value in action.items()},
    }
    if rejection:
        report["reason"] = rejection
        print(json.dumps(report, ensure_ascii=False), file=sys.stderr)
        return 3
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
