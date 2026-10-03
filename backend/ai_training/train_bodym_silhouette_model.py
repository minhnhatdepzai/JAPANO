#!/usr/bin/env python3
"""Research-only BodyM silhouette fine-tuning for body measurements.

BodyM is CC-BY-NC-4.0. Artifacts produced by this script are therefore marked
non-commercial and must not be promoted into a commercial JAPANO deployment.
Official train/testA/testB subject splits are preserved.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import time
from collections import Counter, defaultdict
from pathlib import Path

import torch
from PIL import Image, ImageOps
from torch import nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import models, transforms

from train_photo_weight_model import sha256_file, write_json

TARGETS = ("height_cm", "weight_kg", "chest_cm", "waist_cm", "hip_cm")


def weight_bin(value: float) -> str:
    if value < 50:
        return "lt50"
    if value < 70:
        return "50_69"
    if value < 90:
        return "70_89"
    if value < 110:
        return "90_109"
    if value < 140:
        return "110_139"
    return "ge140"


def load_split(root: Path, split: str) -> list[dict]:
    base = root / split
    with (base / "hwg_metadata.csv").open(encoding="utf-8") as handle:
        hwg = {row["subject_id"]: row for row in csv.DictReader(handle)}
    with (base / "measurements.csv").open(encoding="utf-8") as handle:
        measures = {row["subject_id"]: row for row in csv.DictReader(handle)}
    samples = []
    with (base / "subject_to_photo_map.csv").open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            subject = row["subject_id"]
            path = base / "mask" / f"{row['photo_id']}.png"
            if subject not in hwg or subject not in measures or not path.exists():
                continue
            metadata, measurement = hwg[subject], measures[subject]
            try:
                sample = {
                    "subject_id": subject,
                    "photo_id": row["photo_id"],
                    "path": str(path.resolve()),
                    "gender": metadata["gender"].lower(),
                    "height_cm": float(metadata["height_cm"]),
                    "weight_kg": float(metadata["weight_kg"]),
                    "chest_cm": float(measurement["chest"]),
                    "waist_cm": float(measurement["waist"]),
                    "hip_cm": float(measurement["hip"]),
                }
            except (KeyError, TypeError, ValueError):
                continue
            if not (130 <= sample["height_cm"] <= 220 and 30 <= sample["weight_kg"] <= 250):
                continue
            samples.append(sample)
    if not samples:
        raise RuntimeError(f"No usable samples in {base}")
    return samples


class SilhouetteDataset(Dataset):
    def __init__(self, samples, transform, target_mean, target_std):
        self.samples = samples
        self.transform = transform
        self.mean = torch.tensor(target_mean, dtype=torch.float32)
        self.std = torch.tensor(target_std, dtype=torch.float32)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        sample = self.samples[index]
        with Image.open(sample["path"]) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
        target = torch.tensor([sample[name] for name in TARGETS], dtype=torch.float32)
        return self.transform(image), (target - self.mean) / self.std, index


def build_model(pretrained=True):
    weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.resnet18(weights=weights)
    model.fc = nn.Sequential(nn.Dropout(0.15), nn.Linear(model.fc.in_features, len(TARGETS)))
    return model


def make_transforms(size):
    training = transforms.Compose([
        transforms.Resize((size, size), antialias=True),
        transforms.RandomHorizontalFlip(),
        transforms.RandomAffine(degrees=3, translate=(0.025, 0.025), scale=(0.96, 1.04), fill=0),
        transforms.ToTensor(),
        transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5)),
    ])
    evaluation = transforms.Compose([
        transforms.Resize((size, size), antialias=True),
        transforms.ToTensor(),
        transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5)),
    ])
    return training, evaluation


def summary(actual, predicted):
    error = predicted - actual
    absolute = error.abs()
    return {
        "count": int(actual.numel()),
        "mae": round(float(absolute.mean()), 4),
        "rmse": round(float(torch.sqrt(error.square().mean())), 4),
        "bias": round(float(error.mean()), 4),
        "p90AbsoluteError": round(float(torch.quantile(absolute, 0.9)), 4),
        "within5": round(float((absolute <= 5).float().mean()), 4),
        "within10": round(float((absolute <= 10).float().mean()), 4),
    }


def metrics(samples, actual, predicted):
    result = {name: summary(actual[:, index], predicted[:, index]) for index, name in enumerate(TARGETS)}
    result["weightByBin"] = {}
    for name in ("lt50", "50_69", "70_89", "90_109", "110_139", "ge140"):
        mask = torch.tensor([weight_bin(sample["weight_kg"]) == name for sample in samples])
        if mask.any():
            result["weightByBin"][name] = summary(actual[mask, 1], predicted[mask, 1])
    return result


def baseline_metrics(train, test):
    by_gender = defaultdict(list)
    for sample in train:
        by_gender[sample["gender"]].append(sample)
    actual, predicted = [], []
    for sample in test:
        peers = by_gender[sample["gender"]]
        actual.append([sample[name] for name in TARGETS])
        predicted.append([sum(peer[name] for peer in peers) / len(peers) for name in TARGETS])
    return metrics(test, torch.tensor(actual), torch.tensor(predicted))


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("/home/admin123/jp/datasets/bodym"))
    parser.add_argument("--output", type=Path, default=Path("backend/ai_training/runs/bodym-silhouette-20260930"))
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--seed", type=int, default=1709)
    args = parser.parse_args()
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.cuda.manual_seed_all(args.seed)
    torch.backends.cudnn.benchmark = True
    args.output.mkdir(parents=True, exist_ok=True)

    splits = {name: load_split(args.root, name) for name in ("train", "testA", "testB")}
    # The published CSVs currently contain one subject in both testA and testB.
    # Keep testB intact and remove that identity from validation before any fit.
    test_b_ids = {sample["subject_id"] for sample in splits["testB"]}
    validation_before = len(splits["testA"])
    splits["testA"] = [sample for sample in splits["testA"] if sample["subject_id"] not in test_b_ids]
    validation_overlap_photos_removed = validation_before - len(splits["testA"])
    ids = {name: {sample["subject_id"] for sample in values} for name, values in splits.items()}
    if any(ids[a] & ids[b] for a, b in (("train", "testA"), ("train", "testB"), ("testA", "testB"))):
        raise RuntimeError("Official BodyM splits unexpectedly share identities")
    train = splits["train"]
    target_mean = [sum(sample[name] for sample in train) / len(train) for name in TARGETS]
    target_std = [math.sqrt(sum((sample[name] - target_mean[i]) ** 2 for sample in train) / len(train)) for i, name in enumerate(TARGETS)]
    write_json(args.output / "split-summary.json", {
        "identityDisjointAfterFiltering": True,
        "sourceOverlapRemovedFromValidationPhotos": validation_overlap_photos_removed,
        "splits": {name: {"photos": len(values), "subjects": len(ids[name])} for name, values in splits.items()},
        "targetOrder": TARGETS,
    })
    train_transform, eval_transform = make_transforms(args.image_size)
    datasets = {
        "train": SilhouetteDataset(train, train_transform, target_mean, target_std),
        "testA": SilhouetteDataset(splits["testA"], eval_transform, target_mean, target_std),
        "testB": SilhouetteDataset(splits["testB"], eval_transform, target_mean, target_std),
    }
    subject_counts = Counter(sample["subject_id"] for sample in train)
    bin_counts = Counter(weight_bin(sample["weight_kg"]) for sample in train)
    sample_weights = [1 / subject_counts[s["subject_id"]] / math.sqrt(bin_counts[weight_bin(s["weight_kg"])]) for s in train]
    sampler = WeightedRandomSampler(sample_weights, len(train), replacement=True, generator=torch.Generator().manual_seed(args.seed))
    common = dict(batch_size=args.batch_size, num_workers=args.workers, pin_memory=True, persistent_workers=args.workers > 0)
    loaders = {
        "train": DataLoader(datasets["train"], sampler=sampler, **common),
        "testA": DataLoader(datasets["testA"], shuffle=False, **common),
        "testB": DataLoader(datasets["testB"], shuffle=False, **common),
    }
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type != "cuda":
        raise RuntimeError("CUDA is required")
    model = build_model(pretrained=True).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.02)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    loss_fn = nn.SmoothL1Loss(beta=0.5)
    scaler = torch.amp.GradScaler("cuda")
    best_score = float("inf")
    best_path = args.output / "bodym_silhouette_resnet18.pt"
    training_log = []
    started = time.time()
    for epoch in range(1, args.epochs + 1):
        model.train()
        total, seen = 0.0, 0
        epoch_started = time.time()
        for images, targets, _ in loaders["train"]:
            images = images.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", dtype=torch.float16):
                loss = loss_fn(model(images), targets)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            total += float(loss.detach()) * images.shape[0]
            seen += images.shape[0]
        scheduler.step()
        actual, predicted, _ = evaluate(model, loaders["testA"], device, target_mean, target_std)
        validation = metrics(splits["testA"], actual, predicted)
        record = {"epoch": epoch, "trainLoss": round(total / seen, 6), "seconds": round(time.time() - epoch_started, 2), "validation": validation}
        training_log.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
        score = sum(validation[name]["mae"] for name in ("weight_kg", "chest_cm", "waist_cm", "hip_cm"))
        if score < best_score:
            best_score = score
            torch.save({
                "schemaVersion": 1, "architecture": "resnet18", "stateDict": model.state_dict(),
                "targetOrder": TARGETS, "targetMean": target_mean, "targetStd": target_std,
                "imageSize": args.image_size, "normalizationMean": (0.5, 0.5, 0.5), "normalizationStd": (0.5, 0.5, 0.5),
                "bestEpoch": epoch, "dataset": "Amazon BodyM", "license": "CC-BY-NC-4.0",
            }, best_path)

    checkpoint = torch.load(best_path, map_location=device, weights_only=False)
    model = build_model(pretrained=False).to(device)
    model.load_state_dict(checkpoint["stateDict"])
    actual, predicted, indices = evaluate(model, loaders["testB"], device, target_mean, target_std)
    test_metrics = metrics(splits["testB"], actual, predicted)
    with (args.output / "testB-predictions.csv").open("w", newline="", encoding="utf-8") as handle:
        fields = ["subjectId", "photoId"] + [f"actual_{name}" for name in TARGETS] + [f"predicted_{name}" for name in TARGETS]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row, sample_index in enumerate(indices.tolist()):
            sample = splits["testB"][sample_index]
            record = {"subjectId": sample["subject_id"], "photoId": sample["photo_id"]}
            record.update({f"actual_{name}": round(float(actual[row, i]), 3) for i, name in enumerate(TARGETS)})
            record.update({f"predicted_{name}": round(float(predicted[row, i]), 3) for i, name in enumerate(TARGETS)})
            writer.writerow(record)
    model = model.eval().cpu()
    script_path = args.output / "bodym_silhouette_resnet18.torchscript.pt"
    torch.jit.save(torch.jit.trace(model, torch.zeros(1, 3, args.image_size, args.image_size)), script_path)
    reload_shape = list(torch.jit.load(str(script_path))(torch.zeros(1, 3, args.image_size, args.image_size)).shape)
    report = {
        "status": "TRAINED_RESEARCH_ONLY_NOT_PROMOTED",
        "license": "CC-BY-NC-4.0",
        "source": "Amazon BodyM official public S3 bucket",
        "training": {"architecture": "ImageNet-pretrained ResNet-18 fine-tuned end-to-end", "epochs": args.epochs, "batchSize": args.batch_size, "bestEpoch": checkpoint["bestEpoch"], "device": torch.cuda.get_device_name(0), "elapsedSeconds": round(time.time() - started, 2)},
        "splitCounts": {name: {"photos": len(values), "subjects": len(ids[name])} for name, values in splits.items()},
        "identityDisjoint": True,
        "baseline": baseline_metrics(train, splits["testB"]),
        "heldOutTestB": test_metrics,
        "artifacts": {"checkpoint": best_path.name, "checkpointSha256": sha256_file(best_path), "torchscript": script_path.name, "torchscriptSha256": sha256_file(script_path), "reloadOutputShape": reload_shape},
        "limitations": ["CC-BY-NC forbids commercial deployment.", "Silhouettes remove RGB clothing/background errors.", "BodyM subjects wear fitted clothing and do not represent loose garments.", "TestB is held out by identity but remains the same dataset source."],
    }
    write_json(args.output / "training-log.json", training_log)
    write_json(args.output / "report.json", report)
    print(json.dumps({"complete": True, "heldOutTestB": test_metrics, "checkpointSha256": report["artifacts"]["checkpointSha256"]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
