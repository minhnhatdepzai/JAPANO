#!/usr/bin/env python3
"""Pre-train a photo-compatible height/BMI backbone on BODIES silhouettes.

This is optimizer-based training on the official, identity-disjoint BODIES
train/validation/test split. Front and side renders are treated as two views of
the same subject and averaged before subject-level evaluation. The resulting
checkpoint is intended only as initialization for real-photo fine-tuning.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

from train_photo_bmi_model import build_model, compute_metrics, load_backbone_initialization
from train_photo_weight_model import Sample, make_transforms, sha256_file, weight_bin, write_json


@dataclass(frozen=True)
class Subject:
    subject_id: str
    gender: str
    row: int
    image_path: str
    height_cm: float
    weight_kg: float


def load_subjects(dataset_root: Path, split: str, genders: tuple[str, ...]) -> list[Subject]:
    subjects: list[Subject] = []
    for gender in genders:
        folder = dataset_root / "train_test_data_fold1" / "dataloaders" / gender
        image_path = folder / f"{split}_512_images.npy"
        labels_path = folder / f"{split}_h_w_measures_{gender}_density.npy"
        if not image_path.is_file() or not labels_path.is_file():
            raise FileNotFoundError(f"Missing BODIES {split}/{gender} arrays under {folder}")
        images = np.load(image_path, mmap_mode="r")
        labels = np.load(labels_path)
        if images.shape != (len(labels), 512, 512, 2) or labels.shape[1] != 2:
            raise ValueError(f"Unexpected BODIES shapes for {split}/{gender}: {images.shape}, {labels.shape}")
        for row, (height_m, weight_kg) in enumerate(labels):
            height_cm = float(height_m) * 100.0
            weight_kg = float(weight_kg)
            if not (120.0 <= height_cm <= 230.0 and 8.0 <= weight_kg <= 250.0):
                raise ValueError(f"Out-of-range label in {split}/{gender}/{row}: {height_cm}, {weight_kg}")
            subjects.append(
                Subject(
                    subject_id=f"{gender}:{split}:{row}",
                    gender=gender,
                    row=row,
                    image_path=str(image_path),
                    height_cm=height_cm,
                    weight_kg=weight_kg,
                )
            )
    return subjects


class BodiesDataset(Dataset):
    def __init__(self, subjects: list[Subject], transform, target_mean, target_std, views: int = 2):
        self.subjects = subjects
        self.transform = transform
        self.target_mean = torch.tensor(target_mean, dtype=torch.float32)
        self.target_std = torch.tensor(target_std, dtype=torch.float32)
        self.views = views
        self._arrays: dict[str, np.ndarray] = {}

    def __len__(self):
        return len(self.subjects) * self.views

    def _array(self, path: str):
        if path not in self._arrays:
            self._arrays[path] = np.load(path, mmap_mode="r")
        return self._arrays[path]

    def __getitem__(self, index):
        subject_index, view_index = divmod(index, self.views)
        subject = self.subjects[subject_index]
        pixels = np.asarray(self._array(subject.image_path)[subject.row, :, :, view_index])
        image = Image.fromarray(pixels).convert("RGB")
        bmi = subject.weight_kg / (subject.height_cm / 100.0) ** 2
        target = torch.tensor([subject.height_cm, bmi], dtype=torch.float32)
        return self.transform(image), (target - self.target_mean) / self.target_std, subject_index


def subject_metrics(subjects: list[Subject], actual_targets, predicted_targets) -> dict:
    samples = [
        Sample(s.subject_id, s.image_path, s.height_cm, s.weight_kg, s.gender, 18, "synthetic")
        for s in subjects
    ]
    return compute_metrics(samples, actual_targets, predicted_targets)


@torch.inference_mode()
def evaluate(model, loader, device, target_mean, target_std, subject_count: int):
    model.eval()
    mean = torch.tensor(target_mean, device=device)
    std = torch.tensor(target_std, device=device)
    predictions: dict[int, list[torch.Tensor]] = defaultdict(list)
    actual: dict[int, torch.Tensor] = {}
    for images, targets, subject_indices in loader:
        images = images.to(device, non_blocking=True)
        outputs = model(images) * std + mean
        denormalized_targets = targets.to(device, non_blocking=True) * std + mean
        for row, subject_index in enumerate(subject_indices.tolist()):
            predictions[subject_index].append(outputs[row].detach().cpu())
            actual[subject_index] = denormalized_targets[row].detach().cpu()
    if len(predictions) != subject_count:
        raise RuntimeError(f"Expected {subject_count} evaluated subjects, got {len(predictions)}")
    ordered_actual = torch.stack([actual[index] for index in range(subject_count)])
    ordered_predicted = torch.stack(
        [torch.stack(predictions[index]).mean(dim=0) for index in range(subject_count)]
    )
    return ordered_actual, ordered_predicted


def baseline_metrics(train_subjects: list[Subject], test_subjects: list[Subject]) -> dict:
    by_gender = defaultdict(list)
    for subject in train_subjects:
        by_gender[subject.gender].append(subject)
    actual, predicted = [], []
    for subject in test_subjects:
        peers = by_gender[subject.gender]
        mean_height = sum(item.height_cm for item in peers) / len(peers)
        mean_bmi = sum(item.weight_kg / (item.height_cm / 100.0) ** 2 for item in peers) / len(peers)
        actual.append([subject.height_cm, subject.weight_kg / (subject.height_cm / 100.0) ** 2])
        predicted.append([mean_height, mean_bmi])
    return subject_metrics(test_subjects, torch.tensor(actual), torch.tensor(predicted))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path("/home/admin123/jp/datasets/bodies/extracted/data16"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("backend/ai_training/runs/bodies-convnext-pretrain-20260930"),
    )
    parser.add_argument("--architecture", choices=("resnet18", "densenet201", "convnext_tiny"), default="convnext_tiny")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=192)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--seed", type=int, default=1709)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--genders", nargs="+", choices=("female", "male"), default=["female", "male"])
    parser.add_argument("--init-backbone", type=Path)
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.cuda.manual_seed_all(args.seed)
    torch.backends.cudnn.benchmark = True
    args.output.mkdir(parents=True, exist_ok=True)

    genders = tuple(dict.fromkeys(args.genders))
    split_subjects = {
        split: load_subjects(args.dataset, split, genders)
        for split in ("train", "validation", "test")
    }
    train_targets = [
        (subject.height_cm, subject.weight_kg / (subject.height_cm / 100.0) ** 2)
        for subject in split_subjects["train"]
    ]
    target_mean = [sum(row[column] for row in train_targets) / len(train_targets) for column in range(2)]
    target_std = [
        math.sqrt(sum((row[column] - target_mean[column]) ** 2 for row in train_targets) / len(train_targets))
        for column in range(2)
    ]
    train_transform, eval_transform = make_transforms(args.image_size)
    datasets = {
        split: BodiesDataset(
            subjects,
            train_transform if split == "train" else eval_transform,
            target_mean,
            target_std,
        )
        for split, subjects in split_subjects.items()
    }
    bin_counts = Counter(weight_bin(subject.weight_kg) for subject in split_subjects["train"])
    sample_weights = [
        1.0 / math.sqrt(bin_counts[weight_bin(subject.weight_kg)])
        for subject in split_subjects["train"]
        for _ in range(2)
    ]
    sampler = WeightedRandomSampler(
        sample_weights,
        len(sample_weights),
        replacement=True,
        generator=torch.Generator().manual_seed(args.seed),
    )
    loader_args = dict(
        batch_size=args.batch_size,
        num_workers=args.workers,
        pin_memory=True,
        persistent_workers=args.workers > 0,
    )
    loaders = {
        "train": DataLoader(datasets["train"], sampler=sampler, **loader_args),
        "validation": DataLoader(datasets["validation"], shuffle=False, **loader_args),
        "test": DataLoader(datasets["test"], shuffle=False, **loader_args),
    }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type != "cuda":
        raise RuntimeError("CUDA is required")
    torch.cuda.reset_peak_memory_stats()
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
    best_path = args.output / f"bodies_height_bmi_{args.architecture}.pt"
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
        actual, predicted = evaluate(
            model,
            loaders["validation"],
            device,
            target_mean,
            target_std,
            len(split_subjects["validation"]),
        )
        metrics = subject_metrics(split_subjects["validation"], actual, predicted)
        record = {
            "epoch": epoch,
            "trainLoss": round(loss_total / seen, 6),
            "seconds": round(time.time() - epoch_started, 2),
            "validation": metrics,
        }
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
                    "seed": args.seed,
                    "bestEpoch": epoch,
                    "dataset": "BODIES v1.0 data16",
                    "source": "https://doi.org/10.5281/zenodo.17912003",
                    "license": "CC BY 4.0",
                    "role": "synthetic_pretraining_only",
                    "initialization": initialization,
                },
                best_path,
            )

    checkpoint = torch.load(best_path, map_location=device, weights_only=False)
    model = build_model(pretrained=False, architecture=args.architecture).to(device)
    model.load_state_dict(checkpoint["stateDict"])
    actual, predicted = evaluate(
        model,
        loaders["test"],
        device,
        target_mean,
        target_std,
        len(split_subjects["test"]),
    )
    held_out = subject_metrics(split_subjects["test"], actual, predicted)
    peak_allocated = torch.cuda.max_memory_allocated() / (1024**2)
    peak_reserved = torch.cuda.max_memory_reserved() / (1024**2)

    model = model.eval().cpu()
    scripted_path = args.output / f"bodies_height_bmi_{args.architecture}.torchscript.pt"
    torch.jit.save(torch.jit.trace(model, torch.zeros(1, 3, args.image_size, args.image_size)), scripted_path)
    reloaded = torch.jit.load(str(scripted_path), map_location="cpu")
    with torch.inference_mode():
        reload_shape = list(reloaded(torch.zeros(1, 3, args.image_size, args.image_size)).shape)

    report = {
        "status": "TRAINED_SYNTHETIC_PRETRAINING_NOT_PRODUCTION",
        "dataset": {
            "name": "BODIES v1.0 data16",
            "doi": "https://doi.org/10.5281/zenodo.17912003",
            "license": "CC BY 4.0",
            "synthetic": True,
            "viewsPerSubject": 2,
            "weightBins": {
                split: dict(sorted(Counter(weight_bin(s.weight_kg) for s in subjects).items()))
                for split, subjects in split_subjects.items()
            },
        },
        "training": {
            "architecture": f"{args.architecture}, all layers optimized for height and BMI",
            "initialization": initialization or "ImageNet pretrained",
            "epochs": args.epochs,
            "batchSize": args.batch_size,
            "bestEpoch": checkpoint["bestEpoch"],
            "device": torch.cuda.get_device_name(0),
            "elapsedSeconds": round(time.time() - started, 2),
            "peakAllocatedMiB": round(peak_allocated, 1),
            "peakReservedMiB": round(peak_reserved, 1),
        },
        "splitCounts": {split: len(subjects) for split, subjects in split_subjects.items()},
        "identityDisjoint": True,
        "baseline": baseline_metrics(split_subjects["train"], split_subjects["test"]),
        "heldOutTest": held_out,
        "artifacts": {
            "checkpoint": best_path.name,
            "checkpointSha256": sha256_file(best_path),
            "torchscript": scripted_path.name,
            "torchscriptSha256": sha256_file(scripted_path),
            "reloadOutputShape": reload_shape,
        },
        "limitations": [
            "BODIES contains rendered synthetic bodies in a fixed T-pose, not uncontrolled customer photos.",
            "Synthetic held-out performance does not establish real-photo accuracy.",
            "Use this checkpoint only to initialize real-photo fine-tuning and evaluate on an untouched real-photo test set.",
            "A single uncontrolled image cannot determine exact height or weight.",
        ],
    }
    write_json(args.output / "training-log.json", log)
    write_json(args.output / "report.json", report)
    print(
        json.dumps(
            {
                "complete": True,
                "report": str(args.output / "report.json"),
                "heldOut": held_out,
                "sha256": report["artifacts"]["checkpointSha256"],
            },
            ensure_ascii=False,
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
