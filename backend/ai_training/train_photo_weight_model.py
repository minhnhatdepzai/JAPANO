#!/usr/bin/env python3
"""Fine-tune ResNet-18 for photo-to-height/weight regression.

This is a real optimizer-based training job. It produces a reloadable checkpoint,
TorchScript inference artifact, immutable split manifest, training log and held-out
metrics. Celeb-FBI labels come from filenames; each serial number is treated as a
different subject and appears in exactly one split.

The model is an experimental visual prior. A single uncontrolled photo still
cannot establish exact height or weight and the checkpoint must not be promoted
without an external, consented customer-photo evaluation.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import random
import re
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path

import torch
from PIL import Image, ImageFile, ImageOps
from torch import nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import models, transforms

ImageFile.LOAD_TRUNCATED_IMAGES = False

FILENAME_RE = re.compile(
    r"^(?P<subject>\d+)_(?P<height>\d+(?:\.[0-9 ]+)?)h_"
    r"(?P<weight>\d+(?:\.\d+)?)w_(?P<gender>male|female)_"
    r"(?P<age>\d+)a_?\.(?:png|jpe?g)$",
    re.IGNORECASE,
)
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


@dataclass(frozen=True)
class Sample:
    subject_id: str
    path: str
    height_cm: float
    weight_kg: float
    gender: str
    age: int
    sha256: str


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_height(value: str) -> float:
    clean = value.replace(" ", "")
    if "." in clean:
        feet, inches = (int(part) for part in clean.split(".", 1))
    else:
        feet, inches = int(clean), 0
    # A few source records write 5.12 instead of 6.0.
    if inches == 12:
        feet += 1
        inches = 0
    if not (0 <= inches <= 11):
        raise ValueError("invalid inches")
    return (feet * 12 + inches) * 2.54


def load_samples(dataset_dir: Path) -> tuple[list[Sample], dict]:
    samples: list[Sample] = []
    rejected: list[dict] = []
    seen_hashes: dict[str, str] = {}
    for path in sorted(dataset_dir.iterdir()):
        if not path.is_file():
            continue
        match = FILENAME_RE.match(path.name)
        if not match:
            rejected.append({"file": path.name, "reason": "filename_schema"})
            continue
        try:
            height_cm = parse_height(match.group("height"))
            weight_kg = float(match.group("weight"))
            age = int(match.group("age"))
            with Image.open(path) as image:
                image.verify()
        except Exception as exc:
            rejected.append({"file": path.name, "reason": f"decode_or_label:{type(exc).__name__}"})
            continue
        if not 137 <= height_cm <= 220:
            rejected.append({"file": path.name, "reason": "height_out_of_range"})
            continue
        if not 35 <= weight_kg <= 205:
            rejected.append({"file": path.name, "reason": "weight_out_of_range"})
            continue
        if not 18 <= age <= 100:
            rejected.append({"file": path.name, "reason": "age_out_of_range"})
            continue
        image_hash = sha256_file(path)
        if image_hash in seen_hashes:
            rejected.append({"file": path.name, "reason": f"exact_duplicate:{seen_hashes[image_hash]}"})
            continue
        seen_hashes[image_hash] = path.name
        samples.append(
            Sample(
                subject_id=match.group("subject"),
                path=str(path.resolve()),
                height_cm=round(height_cm, 2),
                weight_kg=weight_kg,
                gender=match.group("gender").lower(),
                age=age,
                sha256=image_hash,
            )
        )
    if len(samples) < 100:
        raise RuntimeError(f"Only {len(samples)} valid samples found in {dataset_dir}")
    if len({sample.subject_id for sample in samples}) != len(samples):
        raise RuntimeError("Subject IDs are not unique; group-aware splitting is required")
    return samples, {"accepted": len(samples), "rejected": rejected}


def weight_bin(weight: float) -> str:
    if weight < 50:
        return "lt50"
    if weight < 70:
        return "50_69"
    if weight < 90:
        return "70_89"
    if weight < 110:
        return "90_109"
    if weight < 140:
        return "110_139"
    return "ge140"


def stratified_split(samples: list[Sample], seed: int) -> dict[str, list[Sample]]:
    groups: dict[str, list[Sample]] = defaultdict(list)
    for sample in samples:
        groups[f"{sample.gender}:{weight_bin(sample.weight_kg)}"].append(sample)
    rng = random.Random(seed)
    splits = {"train": [], "validation": [], "test": []}
    for key in sorted(groups):
        items = groups[key]
        rng.shuffle(items)
        count = len(items)
        test_count = max(1, round(count * 0.10)) if count >= 3 else 0
        validation_count = max(1, round(count * 0.10)) if count >= 3 else 0
        splits["test"].extend(items[:test_count])
        splits["validation"].extend(items[test_count : test_count + validation_count])
        splits["train"].extend(items[test_count + validation_count :])
    for values in splits.values():
        rng.shuffle(values)
    ids = [{sample.subject_id for sample in values} for values in splits.values()]
    if any(ids[i] & ids[j] for i in range(3) for j in range(i + 1, 3)):
        raise RuntimeError("Identity leakage across splits")
    return splits


class PadToSquare:
    def __init__(self, fill=(124, 116, 104)):
        self.fill = fill

    def __call__(self, image: Image.Image) -> Image.Image:
        width, height = image.size
        edge = max(width, height)
        left = (edge - width) // 2
        top = (edge - height) // 2
        return ImageOps.expand(image, (left, top, edge - width - left, edge - height - top), fill=self.fill)


class BodyDataset(Dataset):
    def __init__(self, samples: list[Sample], transform, target_mean, target_std):
        self.samples = samples
        self.transform = transform
        self.target_mean = torch.tensor(target_mean, dtype=torch.float32)
        self.target_std = torch.tensor(target_std, dtype=torch.float32)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        sample = self.samples[index]
        with Image.open(sample.path) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
        image = self.transform(image)
        target = torch.tensor([sample.height_cm, sample.weight_kg], dtype=torch.float32)
        return image, (target - self.target_mean) / self.target_std, index


def make_transforms(size: int):
    train = transforms.Compose(
        [
            PadToSquare(),
            transforms.Resize((size, size), antialias=True),
            transforms.RandomHorizontalFlip(),
            transforms.RandomApply([transforms.ColorJitter(0.18, 0.18, 0.12, 0.03)], p=0.65),
            transforms.RandomAffine(degrees=4, translate=(0.025, 0.025), scale=(0.96, 1.04)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
    evaluation = transforms.Compose(
        [
            PadToSquare(),
            transforms.Resize((size, size), antialias=True),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
    return train, evaluation


def build_model(pretrained: bool = True):
    weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.resnet18(weights=weights)
    model.fc = nn.Sequential(nn.Dropout(0.20), nn.Linear(model.fc.in_features, 2))
    return model


def summarize_errors(actual, predicted) -> dict:
    residual = predicted - actual
    absolute = residual.abs()
    return {
        "count": int(actual.numel()),
        "mae": round(float(absolute.mean()), 4),
        "rmse": round(float(torch.sqrt((residual.square()).mean())), 4),
        "bias": round(float(residual.mean()), 4),
        "p90AbsoluteError": round(float(torch.quantile(absolute, 0.90)), 4),
        "within5": round(float((absolute <= 5).float().mean()), 4),
        "within10": round(float((absolute <= 10).float().mean()), 4),
    }


@torch.inference_mode()
def evaluate(model, loader, device, target_mean, target_std):
    model.eval()
    mean = torch.tensor(target_mean, device=device)
    std = torch.tensor(target_std, device=device)
    predictions, actuals, indices = [], [], []
    for images, normalized, batch_indices in loader:
        images = images.to(device, non_blocking=True)
        normalized = normalized.to(device, non_blocking=True)
        output = model(images)
        predictions.append((output * std + mean).cpu())
        actuals.append((normalized * std + mean).cpu())
        indices.append(batch_indices)
    return torch.cat(actuals), torch.cat(predictions), torch.cat(indices)


def metrics_for(samples, actual, predicted) -> dict:
    result = {
        "heightCm": summarize_errors(actual[:, 0], predicted[:, 0]),
        "weightKg": summarize_errors(actual[:, 1], predicted[:, 1]),
        "weightByBin": {},
        "weightByGender": {},
    }
    for name in ("lt50", "50_69", "70_89", "90_109", "110_139", "ge140"):
        mask = torch.tensor([weight_bin(s.weight_kg) == name for s in samples])
        if mask.any():
            result["weightByBin"][name] = summarize_errors(actual[mask, 1], predicted[mask, 1])
    for gender in ("female", "male"):
        mask = torch.tensor([s.gender == gender for s in samples])
        if mask.any():
            result["weightByGender"][gender] = summarize_errors(actual[mask, 1], predicted[mask, 1])
    return result


def baseline_metrics(train_samples, test_samples):
    by_gender = defaultdict(list)
    for sample in train_samples:
        by_gender[sample.gender].append(sample)
    predictions = []
    actual = []
    for sample in test_samples:
        peers = by_gender[sample.gender]
        predictions.append(
            [
                sum(item.height_cm for item in peers) / len(peers),
                sum(item.weight_kg for item in peers) / len(peers),
            ]
        )
        actual.append([sample.height_cm, sample.weight_kg])
    return metrics_for(test_samples, torch.tensor(actual), torch.tensor(predictions))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=Path("/home/admin123/jp/datasets/celeb-fbi/Celeb-FBI Dataset"))
    parser.add_argument("--output", type=Path, default=Path("backend/ai_training/runs/photo-weight-celeb-fbi-20260930"))
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=192)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--seed", type=int, default=1709)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    args = parser.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.cuda.manual_seed_all(args.seed)
    torch.backends.cudnn.benchmark = True
    args.output.mkdir(parents=True, exist_ok=True)

    samples, audit = load_samples(args.dataset)
    splits = stratified_split(samples, args.seed)
    train_samples = splits["train"]
    target_mean = [
        sum(sample.height_cm for sample in train_samples) / len(train_samples),
        sum(sample.weight_kg for sample in train_samples) / len(train_samples),
    ]
    target_std = [
        math.sqrt(sum((sample.height_cm - target_mean[0]) ** 2 for sample in train_samples) / len(train_samples)),
        math.sqrt(sum((sample.weight_kg - target_mean[1]) ** 2 for sample in train_samples) / len(train_samples)),
    ]
    split_payload = {
        "seed": args.seed,
        "identityDisjoint": True,
        "splits": {name: [asdict(sample) for sample in values] for name, values in splits.items()},
    }
    write_json(args.output / "splits.json", split_payload)

    train_transform, eval_transform = make_transforms(args.image_size)
    datasets = {
        "train": BodyDataset(train_samples, train_transform, target_mean, target_std),
        "validation": BodyDataset(splits["validation"], eval_transform, target_mean, target_std),
        "test": BodyDataset(splits["test"], eval_transform, target_mean, target_std),
    }
    bin_counts = Counter(weight_bin(sample.weight_kg) for sample in train_samples)
    sample_weights = [1.0 / math.sqrt(bin_counts[weight_bin(sample.weight_kg)]) for sample in train_samples]
    sampler = WeightedRandomSampler(sample_weights, len(train_samples), replacement=True, generator=torch.Generator().manual_seed(args.seed))
    common = dict(batch_size=args.batch_size, num_workers=args.workers, pin_memory=True, persistent_workers=args.workers > 0)
    loaders = {
        "train": DataLoader(datasets["train"], sampler=sampler, **common),
        "validation": DataLoader(datasets["validation"], shuffle=False, **common),
        "test": DataLoader(datasets["test"], shuffle=False, **common),
    }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type != "cuda":
        raise RuntimeError("CUDA is required for this training run")
    model = build_model(pretrained=True).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=0.02)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    loss_fn = nn.SmoothL1Loss(beta=0.5, reduction="none")
    scaler = torch.amp.GradScaler("cuda")
    run_log = []
    best_mae = float("inf")
    best_path = args.output / "photo_body_resnet18.pt"
    started = time.time()

    for epoch in range(1, args.epochs + 1):
        model.train()
        loss_sum = 0.0
        seen = 0
        epoch_start = time.time()
        for images, targets, _ in loaders["train"]:
            images = images.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", dtype=torch.float16):
                output = model(images)
                per_target = loss_fn(output, targets).mean(dim=0)
                loss = per_target[0] * 0.6 + per_target[1] * 1.4
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            batch = images.shape[0]
            loss_sum += float(loss.detach()) * batch
            seen += batch
        scheduler.step()
        actual, predicted, _ = evaluate(model, loaders["validation"], device, target_mean, target_std)
        validation_metrics = metrics_for(splits["validation"], actual, predicted)
        record = {
            "epoch": epoch,
            "trainLoss": round(loss_sum / seen, 6),
            "learningRate": optimizer.param_groups[0]["lr"],
            "seconds": round(time.time() - epoch_start, 2),
            "validation": validation_metrics,
        }
        run_log.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
        validation_mae = validation_metrics["weightKg"]["mae"]
        if validation_mae < best_mae:
            best_mae = validation_mae
            torch.save(
                {
                    "schemaVersion": 1,
                    "architecture": "resnet18",
                    "stateDict": model.state_dict(),
                    "targetMean": target_mean,
                    "targetStd": target_std,
                    "imageSize": args.image_size,
                    "imagenetMean": IMAGENET_MEAN,
                    "imagenetStd": IMAGENET_STD,
                    "seed": args.seed,
                    "bestEpoch": epoch,
                    "dataset": "pronaydebnath1/celeb-fbi",
                    "license": "CDLA-Permissive-1.0",
                },
                best_path,
            )

    checkpoint = torch.load(best_path, map_location=device, weights_only=False)
    model = build_model(pretrained=False).to(device)
    model.load_state_dict(checkpoint["stateDict"])
    actual, predicted, indices = evaluate(model, loaders["test"], device, target_mean, target_std)
    test_metrics = metrics_for(splits["test"], actual, predicted)
    baseline = baseline_metrics(train_samples, splits["test"])
    per_sample_path = args.output / "test_predictions.csv"
    with per_sample_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["subjectId", "file", "gender", "heightCm", "predictedHeightCm", "weightKg", "predictedWeightKg", "weightAbsoluteErrorKg"])
        writer.writeheader()
        for row_index, sample_index in enumerate(indices.tolist()):
            sample = splits["test"][sample_index]
            writer.writerow(
                {
                    "subjectId": sample.subject_id,
                    "file": Path(sample.path).name,
                    "gender": sample.gender,
                    "heightCm": sample.height_cm,
                    "predictedHeightCm": round(float(predicted[row_index, 0]), 3),
                    "weightKg": sample.weight_kg,
                    "predictedWeightKg": round(float(predicted[row_index, 1]), 3),
                    "weightAbsoluteErrorKg": round(abs(float(predicted[row_index, 1] - actual[row_index, 1])), 3),
                }
            )

    # TorchScript reload test uses the exact evaluation preprocessing contract.
    model = model.eval().cpu()
    scripted = torch.jit.trace(model, torch.zeros(1, 3, args.image_size, args.image_size))
    scripted_path = args.output / "photo_body_resnet18.torchscript.pt"
    torch.jit.save(scripted, scripted_path)
    reloaded = torch.jit.load(str(scripted_path), map_location="cpu")
    with torch.inference_mode():
        reload_shape = list(reloaded(torch.zeros(1, 3, args.image_size, args.image_size)).shape)
    checkpoint_hash = sha256_file(best_path)
    torchscript_hash = sha256_file(scripted_path)
    report = {
        "status": "TRAINED_EXPERIMENTAL_NOT_PROMOTED",
        "dataset": {
            "kaggleRef": "pronaydebnath1/celeb-fbi",
            "license": "Community Data License Agreement - Permissive 1.0",
            "localPath": str(args.dataset.resolve()),
            "audit": audit,
            "acceptedWeightBins": dict(sorted(Counter(weight_bin(s.weight_kg) for s in samples).items())),
            "acceptedWeightRangeKg": [min(s.weight_kg for s in samples), max(s.weight_kg for s in samples)],
            "acceptedHeightRangeCm": [min(s.height_cm for s in samples), max(s.height_cm for s in samples)],
        },
        "training": {
            "architecture": "ImageNet-pretrained ResNet-18, all layers fine-tuned, two-output regression head",
            "optimizer": "AdamW",
            "loss": "weighted SmoothL1 on standardized height and weight",
            "sampling": "inverse square-root frequency by weight bin",
            "epochs": args.epochs,
            "batchSize": args.batch_size,
            "seed": args.seed,
            "device": torch.cuda.get_device_name(0),
            "elapsedSeconds": round(time.time() - started, 2),
            "bestEpoch": checkpoint["bestEpoch"],
        },
        "splitCounts": {name: len(values) for name, values in splits.items()},
        "identityDisjoint": True,
        "baseline": baseline,
        "heldOutTest": test_metrics,
        "artifacts": {
            "checkpoint": best_path.name,
            "checkpointSha256": checkpoint_hash,
            "torchscript": scripted_path.name,
            "torchscriptSha256": torchscript_hash,
            "reloadOutputShape": reload_shape,
        },
        "limitations": [
            "Internal Celeb-FBI test performance is not customer-photo accuracy.",
            "Labels are public celebrity metadata, not measurements collected during photography.",
            "Rare >=110 kg samples yield unstable subgroup metrics.",
            "Background, clothing, fame and demographic bias can create shortcuts.",
            "A single image without a scale reference cannot determine exact height or weight.",
        ],
    }
    write_json(args.output / "training-log.json", run_log)
    write_json(args.output / "report.json", report)
    print(json.dumps({"complete": True, "report": str(args.output / 'report.json'), "heldOutWeight": test_metrics["weightKg"], "checkpointSha256": checkpoint_hash}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
