#!/usr/bin/env python3
"""Create a deterministic person-focused Celeb-FBI image set.

The raw dataset often contains large backgrounds, captions, or several people.
This preprocessing step uses the existing YOLOv8 pose detector to select the
largest detected person and keeps a small context margin. If detection fails,
the decoded source image is retained so the training split does not silently
lose difficult examples. A JSON manifest records every decision.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from collections import Counter
from pathlib import Path

import cv2


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def expanded_box(box, width: int, height: int, margin: float) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = (float(value) for value in box)
    box_width = max(1.0, x2 - x1)
    box_height = max(1.0, y2 - y1)
    x1 = max(0, int(round(x1 - box_width * margin)))
    y1 = max(0, int(round(y1 - box_height * margin)))
    x2 = min(width, int(round(x2 + box_width * margin)))
    y2 = min(height, int(round(y2 + box_height * margin)))
    return x1, y1, x2, y2


def write_image(path: Path, image) -> None:
    suffix = path.suffix.lower()
    params = [cv2.IMWRITE_JPEG_QUALITY, 94] if suffix in {".jpg", ".jpeg"} else [cv2.IMWRITE_PNG_COMPRESSION, 3]
    if not cv2.imwrite(str(path), image, params):
        raise RuntimeError(f"Could not write {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("/home/admin123/jp/datasets/celeb-fbi/Celeb-FBI Dataset"))
    parser.add_argument("--output", type=Path, default=Path("/home/admin123/jp/datasets/celeb-fbi-person-crops"))
    parser.add_argument("--model", type=Path, default=Path("backend/models/yolov8n-pose.pt"))
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--image-size", type=int, default=640)
    parser.add_argument("--confidence", type=float, default=0.25)
    parser.add_argument("--margin", type=float, default=0.08)
    parser.add_argument("--max-files", type=int, default=0)
    args = parser.parse_args()

    from train_photo_weight_model import load_samples
    from ultralytics import YOLO

    samples, source_audit = load_samples(args.source)
    if args.max_files:
        samples = samples[: args.max_files]
    args.output.mkdir(parents=True, exist_ok=True)
    if any(args.output.iterdir()):
        raise RuntimeError(f"Output must be empty: {args.output}")

    model = YOLO(str(args.model))
    records: list[dict] = []
    started = time.time()
    for offset in range(0, len(samples), args.batch_size):
        batch = samples[offset : offset + args.batch_size]
        paths = [sample.path for sample in batch]
        results = model.predict(
            source=paths,
            imgsz=args.image_size,
            conf=args.confidence,
            device=0,
            half=True,
            verbose=False,
            stream=False,
        )
        for sample, result in zip(batch, results, strict=True):
            image = result.orig_img
            height, width = image.shape[:2]
            boxes = result.boxes.xyxy.detach().cpu().numpy() if result.boxes is not None else []
            confidences = result.boxes.conf.detach().cpu().numpy() if result.boxes is not None else []
            if len(boxes):
                areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
                selected = int(areas.argmax())
                x1, y1, x2, y2 = expanded_box(boxes[selected], width, height, args.margin)
                crop = image[y1:y2, x1:x2]
                mode = "person_crop"
                confidence = round(float(confidences[selected]), 6)
                box = [x1, y1, x2, y2]
            else:
                crop = image
                mode = "full_image_fallback"
                confidence = None
                box = [0, 0, width, height]
            output_path = args.output / Path(sample.path).name
            write_image(output_path, crop)
            records.append(
                {
                    "file": output_path.name,
                    "subjectId": sample.subject_id,
                    "mode": mode,
                    "confidence": confidence,
                    "sourceSize": [width, height],
                    "box": box,
                    "outputSize": [int(crop.shape[1]), int(crop.shape[0])],
                    "outputSha256": sha256_file(output_path),
                }
            )
        print(json.dumps({"processed": len(records), "total": len(samples)}), flush=True)

    counts = Counter(record["mode"] for record in records)
    manifest = {
        "schemaVersion": 1,
        "source": str(args.source.resolve()),
        "output": str(args.output.resolve()),
        "sourceAccepted": source_audit["accepted"],
        "processed": len(records),
        "detector": str(args.model),
        "parameters": {
            "imageSize": args.image_size,
            "confidence": args.confidence,
            "margin": args.margin,
            "selection": "largest detected person by bounding-box area",
            "failurePolicy": "retain decoded full image",
        },
        "counts": dict(sorted(counts.items())),
        "elapsedSeconds": round(time.time() - started, 2),
        "records": records,
    }
    with (args.output / "crop-manifest.json").open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps({"complete": True, "counts": manifest["counts"], "manifest": str(args.output / "crop-manifest.json")}), flush=True)


if __name__ == "__main__":
    main()
