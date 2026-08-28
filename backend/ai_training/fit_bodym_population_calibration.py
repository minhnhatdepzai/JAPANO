"""Hiệu chuẩn đầu ra của model ANSUR về dân số chung, fit trên BodyM train.

Vì sao cần: ANSUR II là quân nhân Mỹ tại ngũ. Ở CÙNG một bề ngang chính diện, họ
mỏng hơn dân số chung (ít mỡ bụng), nên model học trên họ trả vòng đo nhỏ hơn
thực tế. Chấm end-to-end trên BodyM testB đo được sai lệch hệ thống khoảng
-13cm ở cả ba vòng và -13kg ở cân nặng — và sai lệch đó KHÔNG biến mất khi đưa
chiều cao thật vào, nên nó không phải lỗi thang đo.

Sai lệch hệ thống thì hiệu chuẩn được. File này fit một hiệu chỉnh tuyến tính
trên tập TRAIN của BodyM (2.018 người, không dính danh tính nào của testA/testB)
rồi để `body_analysis.py` áp lúc chạy.

Ràng buộc: BodyM là CC-BY-NC-4.0 nên file hiệu chuẩn sinh ra ở đây PHI THƯƠNG MẠI.
Đặt `JAPANO_BODY_POPULATION_CALIBRATION=0` để tắt và quay về đầu ra thuần ANSUR.
"""

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))

import body_analysis as BA  # noqa: E402

TARGETS = {'weight': 'weight', 'bust': 'chest', 'waist': 'waist', 'hip': 'hip'}


def load_split(root, split):
    base = Path(root) / split
    read = lambda name: list(csv.DictReader((base / name).open(encoding='utf-8')))
    hwg = {row['subject_id']: row for row in read('hwg_metadata.csv')}
    measures = {row['subject_id']: row for row in read('measurements.csv')}
    photos = {}
    for row in read('subject_to_photo_map.csv'):
        photos.setdefault(row['subject_id'], []).append(row['photo_id'])
    return hwg, measures, photos


def collect(root, split, limit=0, photos_per_subject=1):
    from accessory_pipeline import analyze

    hwg, measures, photos = load_split(root, split)
    mask_dir = Path(root) / split / 'mask'
    rows = []
    subjects = [s for s in sorted(measures) if s in photos and s in hwg]
    if limit:
        subjects = subjects[:limit]
    for index, subject in enumerate(subjects):
        gender = (hwg[subject].get('gender') or '').strip().lower()
        truth = {'weight': float(hwg[subject]['weight_kg']),
                 'chest': float(measures[subject]['chest']),
                 'waist': float(measures[subject]['waist']),
                 'hip': float(measures[subject]['hip']),
                 'height': float(measures[subject]['height'])}
        for photo in photos[subject][:photos_per_subject]:
            path = mask_dir / f'{photo}.png'
            if not path.exists():
                continue
            binary = np.array(Image.open(path).convert('L')) > 127
            image = Image.fromarray(np.stack([binary.astype(np.uint8) * 255] * 3, -1))
            pose = analyze(image, source_coordinates=True)
            original = BA.person_mask
            BA.person_mask = lambda img, box=None, m=binary: m
            try:
                # Tắt hiệu chuẩn khi thu thập, nếu không sẽ fit chồng lên chính nó.
                result = BA.analyze_body(image, pose, sex=gender, apply_population_calibration=False)
                measure = BA.measure_body(image, pose)
            finally:
                BA.person_mask = original
            height = result['estimatedHeight'].get('valueCm')
            girths = result.get('estimatedGirths') or {}
            rows.append({
                'subject': subject, 'gender': gender, 'truth': truth,
                'predHeight': height,
                'predWeight': result['estimatedWeight'].get('valueKg'),
                'predBust': girths.get('bust'), 'predWaist': girths.get('waist'),
                'predHip': girths.get('hip'),
                'slack': float(measure.get('clothingSlack') or 1.0),
                'coverage': measure.get('coverage'),
            })
        if (index + 1) % 200 == 0:
            print(f'  {index + 1}/{len(subjects)} người...', flush=True)
    return rows


def design(rows, key):
    """[dự đoán, chiều cao ước lượng, slack, là nam] — cố ý ít tham số."""
    x, y = [], []
    truth_key = TARGETS[key]
    for row in rows:
        predicted = row[f'pred{key.capitalize()}']
        height = row['predHeight']
        if predicted is None or not height:
            continue
        x.append([predicted, height, row['slack'], 1.0 if row['gender'] == 'male' else 0.0])
        y.append(row['truth'][truth_key])
    return np.array(x), np.array(y)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='/home/nhat/jp/datasets/bodym')
    parser.add_argument('--train-split', default='train')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--out', default=str(ROOT / 'models/bodym_population_calibration.json'))
    args = parser.parse_args()

    from sklearn.linear_model import RidgeCV

    rows = collect(args.root, args.train_split, args.limit)
    print(f'thu thập {len(rows)} ảnh từ split {args.train_split}')

    calibration = {
        'source': 'BodyM train split (Amazon), CC-BY-NC-4.0',
        'licenseRestriction': 'PHI THƯƠNG MẠI. Tắt bằng JAPANO_BODY_POPULATION_CALIBRATION=0.',
        'why': ('ANSUR II là quân nhân Mỹ; ở cùng bề ngang chính diện họ mỏng hơn dân số chung. '
                'Sai lệch đo được trên BodyM testB là khoảng -13cm mỗi vòng và -13kg cân nặng, và '
                'nó KHÔNG biến mất khi đưa chiều cao thật vào — tức là sai lệch dân số, không phải '
                'sai số thang đo.'),
        'featureOrder': ['prediction', 'estimatedHeightCm', 'clothingSlack', 'isMale'],
        'fitSamples': len(rows),
        'fitSubjects': len({row['subject'] for row in rows}),
        'identityDisjointFrom': ['testA', 'testB'],
        'fittedAt': datetime.now(timezone.utc).isoformat(),
        'targets': {},
    }
    for key in TARGETS:
        x, y = design(rows, key)
        if len(y) < 100:
            print(f'{key}: chỉ {len(y)} mẫu, bỏ qua')
            continue
        model = RidgeCV(alphas=np.logspace(-3, 3, 13)).fit(x, y)
        before = float(np.abs(x[:, 0] - y).mean())
        after = float(np.abs(model.predict(x) - y).mean())
        calibration['targets'][key] = {
            'coefficients': [round(float(c), 6) for c in model.coef_],
            'intercept': round(float(model.intercept_), 4),
            'trainMaeBefore': round(before, 3),
            'trainMaeAfter': round(after, 3),
            'trainBiasBefore': round(float((x[:, 0] - y).mean()), 3),
            'n': int(len(y)),
        }
        print(f'{key:7} n={len(y):5}  MAE {before:6.2f} -> {after:6.2f}  '
              f'(bias {float((x[:, 0] - y).mean()):+.2f})')

    Path(args.out).write_text(json.dumps(calibration, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'\n-> {args.out}')


if __name__ == '__main__':
    main()
