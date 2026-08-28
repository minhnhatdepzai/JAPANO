"""So checkpoint CŨ và MỚI trên CÙNG một tập test, cả sạch lẫn nhiễu-giống-ảnh.

Bảng metrics trong `body_estimator.metrics.json` chỉ nói về checkpoint vừa train.
Muốn quyết định có bật checkpoint mới hay không thì phải chấm cả hai trên đúng
một tập test và đúng một bộ nhiễu — file này làm việc đó.

Tập test: chia theo hàng ANSUR (mỗi hàng là một người, đo một lần) với cùng seed
mà `train_body_estimator.py` dùng, nên hai bên chấm trên đúng cùng những người,
và không người nào từng xuất hiện trong tập train.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from train_body_estimator import FEATURES, corrupt_features, load_ansur  # noqa: E402

TARGETS = {'weight_kg': 'kg', 'chest_circ_cm': 'cm', 'waist_circ_cm': 'cm', 'hip_circ_cm': 'cm'}


def load_bundle(path):
    import joblib
    return joblib.load(path)


def score(model, x, y):
    predicted = model.predict(x)
    error = np.abs(predicted - y)
    return {
        'mae': round(float(error.mean()), 3),
        'median': round(float(np.median(error)), 3),
        'p75': round(float(np.percentile(error, 75)), 3),
        'p90': round(float(np.percentile(error, 90)), 3),
        'rmse': round(float(np.sqrt(((predicted - y) ** 2).mean())), 3),
        'within5': round(float((error <= 5).mean()), 4),
        'within10': round(float((error <= 10).mean()), 4),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline-weight', required=True)
    parser.add_argument('--baseline-girth', required=True)
    parser.add_argument('--candidate-weight', default=str(ROOT / 'models/body_weight_estimator.joblib'))
    parser.add_argument('--candidate-girth', default=str(ROOT / 'models/body_girth_estimators.joblib'))
    parser.add_argument('--seed', type=int, default=17)
    parser.add_argument('--out', default=str(ROOT / 'evaluation/body_estimator_baseline_vs_new.json'))
    args = parser.parse_args()

    from sklearn.model_selection import train_test_split

    rows = load_ansur()
    features = np.array([[row[name] for name in FEATURES] for row in rows])
    sexes = np.array([row['sex'] for row in rows])
    report = {
        'dataset': 'ANSUR II Public (CC0-1.0), 6068 người',
        'split': 'train_test_split(test_size=0.2, random_state=%d) — mỗi hàng là một người, không trùng danh tính' % args.seed,
        'corruption': 'train_body_estimator.CORRUPTIONS — mô phỏng áo rộng, tay còn sót, sai số chiều cao',
        'targets': {},
    }
    baseline_weight = load_bundle(args.baseline_weight)
    candidate_weight = load_bundle(args.candidate_weight)
    baseline_girth = load_bundle(args.baseline_girth)
    candidate_girth = load_bundle(args.candidate_girth)

    for target, unit in TARGETS.items():
        targets = np.array([row[target] for row in rows])
        _, x_test, _, y_test, _, sex_test = train_test_split(
            features, targets, sexes, test_size=0.2, random_state=args.seed)
        rng = np.random.default_rng(args.seed)
        x_noisy = np.array([corrupt_features(row, rng) for row in x_test])

        if target == 'weight_kg':
            old, new = baseline_weight['model'], candidate_weight['model']
        else:
            old = baseline_girth['models'].get(target)
            new = candidate_girth['models'].get(target)
        if old is None or new is None:
            continue
        entry = {
            'unit': unit,
            'testSamples': int(len(y_test)),
            'clean': {'baseline': score(old, x_test, y_test), 'candidate': score(new, x_test, y_test)},
            'photoLike': {'baseline': score(old, x_noisy, y_test), 'candidate': score(new, x_noisy, y_test)},
            'photoLikePerSex': {},
        }
        for sex in ('F', 'M'):
            mask = sex_test == sex
            if mask.sum():
                entry['photoLikePerSex'][sex] = {
                    'baseline': score(old, x_noisy[mask], y_test[mask])['mae'],
                    'candidate': score(new, x_noisy[mask], y_test[mask])['mae'],
                }
        entry['decision'] = (
            'promote' if entry['photoLike']['candidate']['mae'] < entry['photoLike']['baseline']['mae']
            else 'keep_baseline')
        report['targets'][target] = entry

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    print(f"{'target':15} {'condition':11} {'baseline':>9} {'candidate':>10} {'Δ':>8}  decision")
    for target, entry in report['targets'].items():
        for condition in ('clean', 'photoLike'):
            base = entry[condition]['baseline']['mae']
            cand = entry[condition]['candidate']['mae']
            print(f"{target:15} {condition:11} {base:9.3f} {cand:10.3f} {cand - base:+8.3f}"
                  f"  {entry['decision'] if condition == 'photoLike' else ''}")
    print(f'\n-> {args.out}')


if __name__ == '__main__':
    main()
