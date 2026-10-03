"""Train an ANSUR II girth prior for photos with incomplete body coverage.

This model never measures a circumference from a photo.  It maps the height
and BMI hypotheses of the cropped-photo model to broad population suggestions
for bust/chest, waist and hip.  Runtime labels every output as low-confidence
and unusable for sizing.
"""

import argparse
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

import train_body_estimator as source


FEATURES = ["stature_cm", "bmi"]
TARGETS = ["chest_circ_cm", "waist_circ_cm", "hip_circ_cm"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=101)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError("Use a new output directory")
    args.output.mkdir(parents=True)

    source.ANSUR_DIR = args.data
    rows = source.add_ratio_features(source.load_ansur())
    indices = np.arange(len(rows))
    sex = np.asarray([row["sex"] for row in rows])
    trainval, test = train_test_split(
        indices, test_size=0.20, random_state=args.seed, stratify=sex)
    train, validation = train_test_split(
        trainval, test_size=0.20, random_state=args.seed, stratify=sex[trainval])
    x = np.asarray([[row[name] for name in FEATURES] for row in rows], dtype=np.float32)

    models = {}
    metrics = {}
    for target in TARGETS:
        y = np.asarray([row[target] for row in rows], dtype=np.float32)
        candidates = []
        for leaves in (9, 15, 25):
            model = HistGradientBoostingRegressor(
                max_iter=220,
                max_leaf_nodes=leaves,
                l2_regularization=8,
                random_state=args.seed,
            ).fit(x[train], y[train])
            validation_mae = mean_absolute_error(y[validation], model.predict(x[validation]))
            candidates.append((validation_mae, leaves, model))
        validation_mae, leaves, model = min(candidates, key=lambda item: item[0])
        prediction = model.predict(x[test])
        error = np.abs(prediction - y[test])
        models[target] = model
        metrics[target] = {
            "selectedMaxLeafNodes": leaves,
            "validationMAE": round(float(validation_mae), 4),
            "heldOutTestMAE": round(float(error.mean()), 4),
            "heldOutTestP90AbsoluteError": round(float(np.quantile(error, 0.90)), 4),
            "heldOutTestBias": round(float(np.mean(prediction - y[test])), 4),
        }

    checkpoint = args.output / "partial_girth_prior.joblib"
    joblib.dump({
        "schemaVersion": 1,
        "models": models,
        "features": FEATURES,
        "targets": TARGETS,
        "metadata": {
            "source": "ANSUR II Public",
            "license": "CC0-1.0",
            "seed": args.seed,
            "photoValidated": False,
            "purpose": "population girth prior when photo rows are missing",
        },
    }, checkpoint)
    reloaded = joblib.load(checkpoint)
    report = {
        "status": "TRAINED_EXPERIMENTAL_RUNTIME_PRIOR",
        "dataset": "ANSUR II Public",
        "license": "CC0-1.0",
        "sampleCount": len(rows),
        "splitCounts": {
            "train": len(train), "validation": len(validation), "test": len(test),
        },
        "identityDisjoint": True,
        "features": FEATURES,
        "targets": TARGETS,
        "metrics": metrics,
        "checkpoint": checkpoint.name,
        "checkpointSha256": sha256(checkpoint),
        "reloadVerified": sorted(reloaded["models"]) == sorted(TARGETS),
        "limitations": [
            "This is table-to-table population regression, not photo-to-girth accuracy.",
            "ANSUR II military personnel are not representative of Vietnamese customers.",
            "Runtime height and BMI hypotheses add error beyond these held-out metrics.",
            "Outputs are broad suggestions and must never choose a clothing size.",
        ],
    }
    (args.output / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
