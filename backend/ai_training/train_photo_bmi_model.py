#!/usr/bin/env python3
"""Fine-tune an image model for body-shape (BMI) and stature priors.

Unlike direct weight regression, BMI is the visual target that is most closely
related to body shape. The report evaluates two honest use cases separately:
`estimatedHeight` uses only the photo, while `knownHeight` combines the visual
BMI prediction with a height supplied/measured by the user.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import time
from collections import Counter, defaultdict
from dataclasses import asdict
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

from train_photo_weight_model import (
    IMAGENET_MEAN,
    IMAGENET_STD,
    Sample,
    build_model as build_resnet18,
    load_samples,
    make_transforms,
    sha256_file,
    stratified_split,
    weight_bin,
    write_json,
)


def build_model(pretrained: bool, architecture: str):
    if architecture == "resnet18":
        return build_resnet18(pretrained)
    if architecture == "densenet201":
        from torchvision import models

        weights = models.DenseNet201_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.densenet201(weights=weights)
        model.classifier = nn.Sequential(nn.Dropout(0.20), nn.Linear(model.classifier.in_features, 2))
        return model
    if architecture == "convnext_tiny":
        from torchvision import models

        weights = models.ConvNeXt_Tiny_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.convnext_tiny(weights=weights)
        input_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(input_features, 2)
        return model
    raise ValueError(f"Unsupported architecture: {architecture}")


def load_backbone_initialization(model, architecture: str, checkpoint_path: Path) -> dict:
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    source_architecture = checkpoint.get("architecture")
    if source_architecture != architecture:
        raise ValueError(
            f"Backbone architecture mismatch: checkpoint={source_architecture}, requested={architecture}"
        )
    head_prefix = "fc." if architecture == "resnet18" else "classifier."
    backbone_state = {
        key: value for key, value in checkpoint["stateDict"].items() if not key.startswith(head_prefix)
    }
    missing, unexpected = model.load_state_dict(backbone_state, strict=False)
    if unexpected or any(not key.startswith(head_prefix) for key in missing):
        raise RuntimeError(f"Unsafe backbone load: missing={missing}, unexpected={unexpected}")
    return {
        "checkpoint": str(checkpoint_path.resolve()),
        "checkpointSha256": sha256_file(checkpoint_path),
        "sourceDataset": checkpoint.get("dataset"),
        "sourceLicense": checkpoint.get("license"),
        "loadedParameterTensors": len(backbone_state),
        "reinitializedHead": True,
    }


class BmiDataset(Dataset):
    def __init__(self, samples: list[Sample], transform, target_mean, target_std):
        self.samples = samples
        self.transform = transform
        self.target_mean = torch.tensor(target_mean, dtype=torch.float32)
        self.target_std = torch.tensor(target_std, dtype=torch.float32)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        from PIL import Image, ImageOps

        sample = self.samples[index]
        with Image.open(sample.path) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
        bmi = sample.weight_kg / (sample.height_cm / 100.0) ** 2
        target = torch.tensor([sample.height_cm, bmi], dtype=torch.float32)
        return self.transform(image), (target - self.target_mean) / self.target_std, index


def error_summary(actual: torch.Tensor, predicted: torch.Tensor) -> dict:
    error = predicted - actual
    absolute = error.abs()
    return {
        "count": int(actual.numel()),
        "mae": round(float(absolute.mean()), 4),
        "rmse": round(float(torch.sqrt(error.square().mean())), 4),
        "bias": round(float(error.mean()), 4),
        "p90AbsoluteError": round(float(torch.quantile(absolute, 0.90)), 4),
        "within5": round(float((absolute <= 5).float().mean()), 4),
        "within10": round(float((absolute <= 10).float().mean()), 4),
    }


def compute_metrics(samples: list[Sample], actual_targets, predicted_targets) -> dict:
    actual_height = actual_targets[:, 0]
    actual_bmi = actual_targets[:, 1]
    predicted_height = predicted_targets[:, 0]
    predicted_bmi = predicted_targets[:, 1].clamp(12.0, 75.0)
    actual_weight = actual_bmi * (actual_height / 100.0).square()
    estimated_height_weight = predicted_bmi * (predicted_height / 100.0).square()
    known_height_weight = predicted_bmi * (actual_height / 100.0).square()
    result = {
        "heightCm": error_summary(actual_height, predicted_height),
        "bmi": error_summary(actual_bmi, predicted_bmi),
        "weightKgEstimatedHeight": error_summary(actual_weight, estimated_height_weight),
        "weightKgKnownHeight": error_summary(actual_weight, known_height_weight),
        "byWeightBin": {},
    }
    for name in ("lt50", "50_69", "70_89", "90_109", "110_139", "ge140"):
        mask = torch.tensor([weight_bin(sample.weight_kg) == name for sample in samples])
        if mask.any():
            result["byWeightBin"][name] = {
                "estimatedHeight": error_summary(actual_weight[mask], estimated_height_weight[mask]),
                "knownHeight": error_summary(actual_weight[mask], known_height_weight[mask]),
            }
    return result


@torch.inference_mode()
def evaluate(model, loader, device, target_mean, target_std):
    model.eval()
    mean = torch.tensor(target_mean, device=device)
    std = torch.tensor(target_std, device=device)
    actual, predicted, indices = [], [], []
    for images, targets, batch_indices in loader:
        images = images.to(device, non_blocking=True)
        targets = targets.to(device, non_blocking=True)
        actual.append((targets * std + mean).cpu())
        predicted.append((model(images) * std + mean).cpu())
        indices.append(batch_indices)
    return torch.cat(actual), torch.cat(predicted), torch.cat(indices)


def baseline_metrics(train_samples: list[Sample], test_samples: list[Sample]) -> dict:
    by_gender = defaultdict(list)
    for sample in train_samples:
        by_gender[sample.gender].append(sample)
    actual, predicted = [], []
    for sample in test_samples:
        peers = by_gender[sample.gender]
        mean_height = sum(item.height_cm for item in peers) / len(peers)
        mean_bmi = sum(item.weight_kg / (item.height_cm / 100) ** 2 for item in peers) / len(peers)
        actual.append([sample.height_cm, sample.weight_kg / (sample.height_cm / 100) ** 2])
        predicted.append([mean_height, mean_bmi])
    return compute_metrics(test_samples, torch.tensor(actual), torch.tensor(predicted))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=Path("/home/admin123/jp/datasets/celeb-fbi/Celeb-FBI Dataset"))
    parser.add_argument("--output", type=Path, default=Path("backend/ai_training/runs/photo-bmi-celeb-fbi-20260930"))
    parser.add_argument("--epochs", type=int, default=24)
    parser.add_argument("--batch-size", type=int, default=192)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--seed", type=int, default=1709)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--architecture", choices=("resnet18", "densenet201", "convnext_tiny"), default="resnet18")
    parser.add_argument(
        "--init-backbone",
        type=Path,
        help="Optional same-architecture checkpoint used to initialize only the visual backbone.",
    )
    args = parser.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.cuda.manual_seed_all(args.seed)
    torch.backends.cudnn.benchmark = True
    args.output.mkdir(parents=True, exist_ok=True)
    samples, audit = load_samples(args.dataset)
    splits = stratified_split(samples, args.seed)
    train_samples = splits["train"]
    train_targets = [
        (sample.height_cm, sample.weight_kg / (sample.height_cm / 100) ** 2)
        for sample in train_samples
    ]
    target_mean = [sum(value[index] for value in train_targets) / len(train_targets) for index in range(2)]
    target_std = [
        math.sqrt(sum((value[index] - target_mean[index]) ** 2 for value in train_targets) / len(train_targets))
        for index in range(2)
    ]
    write_json(
        args.output / "splits.json",
        {"seed": args.seed, "identityDisjoint": True, "splits": {name: [asdict(s) for s in values] for name, values in splits.items()}},
    )
    train_transform, eval_transform = make_transforms(args.image_size)
    datasets = {
        "train": BmiDataset(train_samples, train_transform, target_mean, target_std),
        "validation": BmiDataset(splits["validation"], eval_transform, target_mean, target_std),
        "test": BmiDataset(splits["test"], eval_transform, target_mean, target_std),
    }
    bin_counts = Counter(weight_bin(sample.weight_kg) for sample in train_samples)
    sample_weights = [1.0 / math.sqrt(bin_counts[weight_bin(sample.weight_kg)]) for sample in train_samples]
    sampler = WeightedRandomSampler(sample_weights, len(train_samples), replacement=True, generator=torch.Generator().manual_seed(args.seed))
    loader_args = dict(batch_size=args.batch_size, num_workers=args.workers, pin_memory=True, persistent_workers=args.workers > 0)
    loaders = {
        "train": DataLoader(datasets["train"], sampler=sampler, **loader_args),
        "validation": DataLoader(datasets["validation"], shuffle=False, **loader_args),
        "test": DataLoader(datasets["test"], shuffle=False, **loader_args),
    }
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type != "cuda":
        raise RuntimeError("CUDA is required")
    model = build_model(pretrained=args.init_backbone is None, architecture=args.architecture)
    initialization = None
    if args.init_backbone is not None:
        initialization = load_backbone_initialization(model, args.architecture, args.init_backbone)
    model = model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=0.02)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    loss_fn = nn.SmoothL1Loss(beta=0.5, reduction="none")
    scaler = torch.amp.GradScaler("cuda")
    best_score = float("inf")
    best_path = args.output / f"photo_bmi_{args.architecture}.pt"
    log = []
    started = time.time()
    for epoch in range(1, args.epochs + 1):
        model.train()
        loss_total = 0.0
        seen = 0
        epoch_started = time.time()
        for images, targets, _ in loaders["train"]:
            images = images.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", dtype=torch.float16):
                losses = loss_fn(model(images), targets).mean(dim=0)
                loss = losses[0] * 0.35 + losses[1] * 1.65
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            loss_total += float(loss.detach()) * images.shape[0]
            seen += images.shape[0]
        scheduler.step()
        actual, predicted, _ = evaluate(model, loaders["validation"], device, target_mean, target_std)
        metrics = compute_metrics(splits["validation"], actual, predicted)
        record = {"epoch": epoch, "trainLoss": round(loss_total / seen, 6), "seconds": round(time.time() - epoch_started, 2), "validation": metrics}
        log.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
        score = metrics["weightKgEstimatedHeight"]["mae"]
        if score < best_score:
            best_score = score
            torch.save(
                {
                    "schemaVersion": 1,
                    "architecture": args.architecture,
                    "stateDict": model.state_dict(),
                    "targetOrder": ["height_cm", "bmi"],
                    "targetMean": target_mean,
                    "targetStd": target_std,
                    "imageSize": args.image_size,
                    "imagenetMean": IMAGENET_MEAN,
                    "imagenetStd": IMAGENET_STD,
                    "seed": args.seed,
                    "bestEpoch": epoch,
                    "dataset": "pronaydebnath1/celeb-fbi",
                    "license": "CDLA-Permissive-1.0",
                    "initialization": initialization,
                },
                best_path,
            )

    checkpoint = torch.load(best_path, map_location=device, weights_only=False)
    model = build_model(pretrained=False, architecture=args.architecture).to(device)
    model.load_state_dict(checkpoint["stateDict"])
    actual, predicted, indices = evaluate(model, loaders["test"], device, target_mean, target_std)
    test_metrics = compute_metrics(splits["test"], actual, predicted)
    with (args.output / "test_predictions.csv").open("w", newline="", encoding="utf-8") as handle:
        fields = ["subjectId", "file", "heightCm", "predictedHeightCm", "bmi", "predictedBmi", "weightKg", "predictedWeightEstimatedHeightKg", "predictedWeightKnownHeightKg"]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row_index, sample_index in enumerate(indices.tolist()):
            sample = splits["test"][sample_index]
            ph = float(predicted[row_index, 0])
            pb = min(75.0, max(12.0, float(predicted[row_index, 1])))
            writer.writerow({
                "subjectId": sample.subject_id, "file": Path(sample.path).name,
                "heightCm": sample.height_cm, "predictedHeightCm": round(ph, 3),
                "bmi": round(sample.weight_kg / (sample.height_cm / 100) ** 2, 3), "predictedBmi": round(pb, 3),
                "weightKg": sample.weight_kg,
                "predictedWeightEstimatedHeightKg": round(pb * (ph / 100) ** 2, 3),
                "predictedWeightKnownHeightKg": round(pb * (sample.height_cm / 100) ** 2, 3),
            })
    model = model.eval().cpu()
    scripted_path = args.output / f"photo_bmi_{args.architecture}.torchscript.pt"
    torch.jit.save(torch.jit.trace(model, torch.zeros(1, 3, args.image_size, args.image_size)), scripted_path)
    reloaded = torch.jit.load(str(scripted_path), map_location="cpu")
    with torch.inference_mode():
        reload_shape = list(reloaded(torch.zeros(1, 3, args.image_size, args.image_size)).shape)
    report = {
        "status": "TRAINED_EXPERIMENTAL_NOT_PROMOTED",
        "dataset": {"kaggleRef": "pronaydebnath1/celeb-fbi", "license": "Community Data License Agreement - Permissive 1.0", "audit": audit, "weightBins": dict(sorted(Counter(weight_bin(s.weight_kg) for s in samples).items()))},
        "training": {"architecture": f"{args.architecture}, all layers fine-tuned for height and BMI", "initialization": initialization or "ImageNet pretrained", "epochs": args.epochs, "batchSize": args.batch_size, "bestEpoch": checkpoint["bestEpoch"], "device": torch.cuda.get_device_name(0), "elapsedSeconds": round(time.time() - started, 2)},
        "splitCounts": {name: len(values) for name, values in splits.items()},
        "identityDisjoint": True,
        "baseline": baseline_metrics(train_samples, splits["test"]),
        "heldOutTest": test_metrics,
        "artifacts": {"checkpoint": best_path.name, "checkpointSha256": sha256_file(best_path), "torchscript": scripted_path.name, "torchscriptSha256": sha256_file(scripted_path), "reloadOutputShape": reload_shape},
        "limitations": ["Internal celebrity-image test performance is not customer-photo accuracy.", "Known-height mode requires a measured or user-supplied height.", "The >=110 kg slice is small and cannot support a production accuracy claim.", "A single uncontrolled image cannot determine exact height or weight."],
    }
    write_json(args.output / "training-log.json", log)
    write_json(args.output / "report.json", report)
    print(json.dumps({"complete": True, "report": str(args.output / 'report.json'), "heldOut": test_metrics, "sha256": report["artifacts"]["checkpointSha256"]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
