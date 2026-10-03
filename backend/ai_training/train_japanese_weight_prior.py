#!/usr/bin/env python3
"""Train a Japanese population weight prior from Wikidata-derived records.

This is tabular model training, not image fine-tuning. It estimates a conditional
weight distribution from known height, age and gender and is useful only as a
population prior or uncertainty check for the vision pipeline.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def gender_code(value: str) -> float:
    value = (value or "").strip().lower()
    if value in {"male", "man", "男性"}:
        return 1.0
    if value in {"female", "woman", "女性"}:
        return 0.0
    return 0.5


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


def summary(actual, predicted):
    error = predicted - actual
    absolute = np.abs(error)
    return {
        "count": int(actual.size),
        "maeKg": round(float(mean_absolute_error(actual, predicted)), 4),
        "rmseKg": round(float(mean_squared_error(actual, predicted) ** 0.5), 4),
        "biasKg": round(float(error.mean()), 4),
        "p90AbsoluteErrorKg": round(float(np.quantile(absolute, 0.9)), 4),
        "within5Kg": round(float((absolute <= 5).mean()), 4),
        "within10Kg": round(float((absolute <= 10).mean()), 4),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=Path("/home/admin123/jp/datasets/jpersonwiki/jpersonwiki.csv"))
    parser.add_argument("--output", type=Path, default=Path("backend/ai_training/runs/japanese-weight-prior-20260930"))
    parser.add_argument("--seed", type=int, default=1709)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    records = []
    rejected = Counter()
    with args.csv.open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            try:
                height = float(row.get("height_cm") or "nan")
                weight = float(row.get("weight_kg") or "nan")
                age = float(row.get("age") or "nan")
            except ValueError:
                rejected["non_numeric"] += 1
                continue
            if not np.isfinite(height) or not np.isfinite(weight):
                rejected["missing_height_or_weight"] += 1
                continue
            if not 130 <= height <= 220 or not 30 <= weight <= 250:
                rejected["implausible_range"] += 1
                continue
            if not np.isfinite(age) or not 15 <= age <= 110:
                age = np.nan
            records.append((row["qid"], height, age, gender_code(row.get("gender", "")), weight))
    if len(records) < 1000:
        raise RuntimeError(f"Only {len(records)} usable records")

    x = np.array([[height, age, gender] for _, height, age, gender, _ in records], dtype=np.float64)
    y = np.array([weight for *_, weight in records], dtype=np.float64)
    indices = np.arange(len(records))
    strata = np.array([weight_bin(value) for value in y])
    train_indices, test_indices = train_test_split(indices, test_size=0.2, random_state=args.seed, stratify=strata)
    x_train, x_test = x[train_indices], x[test_indices]
    y_train, y_test = y[train_indices], y[test_indices]
    models = {
        "p10": HistGradientBoostingRegressor(loss="quantile", quantile=0.10, max_iter=250, learning_rate=0.06, l2_regularization=1.0, random_state=args.seed),
        "median": HistGradientBoostingRegressor(loss="absolute_error", max_iter=300, learning_rate=0.06, l2_regularization=1.0, random_state=args.seed),
        "p90": HistGradientBoostingRegressor(loss="quantile", quantile=0.90, max_iter=250, learning_rate=0.06, l2_regularization=1.0, random_state=args.seed),
    }
    for model in models.values():
        model.fit(x_train, y_train)
    predicted = models["median"].predict(x_test)
    lower = models["p10"].predict(x_test)
    upper = models["p90"].predict(x_test)
    baseline_value = float(np.median(y_train))
    report = {
        "status": "TRAINED_POPULATION_PRIOR_NOT_IMAGE_MODEL_NOT_PROMOTED",
        "dataset": {
            "kaggleRef": "rentoda/jpersonwiki",
            "source": "Wikidata",
            "license": "CC-BY-SA-4.0",
            "csvSha256": file_hash(args.csv),
            "rawRows": sum(rejected.values()) + len(records),
            "acceptedRows": len(records),
            "rejected": dict(rejected),
            "weightRangeKg": [float(y.min()), float(y.max())],
            "acceptedWeightBins": dict(sorted(Counter(weight_bin(value) for value in y).items())),
        },
        "features": ["known_height_cm", "age_optional", "gender_optional"],
        "split": {"seed": args.seed, "train": len(train_indices), "test": len(test_indices), "identityDisjointByQid": True},
        "baselineMedian": summary(y_test, np.full_like(y_test, baseline_value)),
        "heldOutTest": summary(y_test, predicted),
        "central80Coverage": round(float(((y_test >= lower) & (y_test <= upper)).mean()), 4),
        "byWeightBin": {},
        "limitations": [
            "This model does not inspect an image.",
            "Wikidata height and weight may be self-reported, historical or stale.",
            "Public figures and athletes are not representative of all Japanese customers.",
            "CC-BY-SA attribution and share-alike obligations must be reviewed before deployment.",
        ],
    }
    for name in ("lt50", "50_69", "70_89", "90_109", "110_139", "ge140"):
        mask = np.array([weight_bin(value) == name for value in y_test])
        if mask.any():
            report["byWeightBin"][name] = summary(y_test[mask], predicted[mask])
    checkpoint = {
        "schemaVersion": 1,
        "models": models,
        "featureOrder": report["features"],
        "dataset": report["dataset"],
        "seed": args.seed,
    }
    checkpoint_path = args.output / "japanese_weight_prior.joblib"
    joblib.dump(checkpoint, checkpoint_path)
    reloaded = joblib.load(checkpoint_path)
    reload_prediction = reloaded["models"]["median"].predict(x_test[:3]).tolist()
    report["artifact"] = {"path": checkpoint_path.name, "sha256": file_hash(checkpoint_path), "reloadPredictionCount": len(reload_prediction)}
    (args.output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output / "test-qids.json").write_text(json.dumps([records[index][0] for index in test_indices], indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
