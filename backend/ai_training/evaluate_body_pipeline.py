"""Sai số ẢNH → SỐ ĐO thật, chấm trên BodyM (Amazon), chia theo danh tính.

Đây là bài đo mà trước đây dự án KHÔNG làm được: ANSUR II không có ảnh nên MAE
3.1kg của nó chỉ là sai số của bước hồi quy, còn VITON-HD có ảnh nhưng không có
chiều cao/cân nặng thật. BodyM có cả silhouette lẫn 14 số đo của cùng một người,
và có `subject_id` nên tập test không dính danh tính nào của tập train.

Hai cấu hình được chấm trên ĐÚNG cùng những tấm ảnh:

  baseline  — cách đo bề ngang và cách neo chiều cao TRƯỚC khi sửa
              (silhouette thô + đối xứng hoá, đầu = (mắt−đỉnh)/0.55, chiều cao =
              số đầu/thân kẹp trong 6.4–8.6 rồi nhân 24cm)
  new       — body_geometry.torso_profile + chốt giải phẫu + prior chiều cao

Silhouette của BodyM được đưa thẳng vào làm mặt nạ, không chạy rembg: mục đích là
đo sai số của bước SUY LUẬN, tách khỏi sai số tách nền.

License BodyM: CC-BY-NC-4.0 — phi thương mại. Xem
`body_dataset/provenance/bodym.manifest.json`.
"""

import argparse
import csv
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))

import body_analysis as BA          # noqa: E402
import body_geometry as BG          # noqa: E402

# Tên số đo của BodyM -> tên trong kết quả của JAPANO.
TARGETS = {'height': 'height', 'weight': 'weight', 'chest': 'bust', 'waist': 'waist', 'hip': 'hip'}
UNITS = {'height': 'cm', 'weight': 'kg', 'chest': 'cm', 'waist': 'cm', 'hip': 'cm'}


def load_split(root, split):
    base = Path(root) / split
    hwg, measures, photos = {}, {}, {}
    with (base / 'hwg_metadata.csv').open(encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            hwg[row['subject_id']] = row
    with (base / 'measurements.csv').open(encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            measures[row['subject_id']] = row
    with (base / 'subject_to_photo_map.csv').open(encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            photos.setdefault(row['subject_id'], []).append(row['photo_id'])
    return hwg, measures, photos


def baseline_measure(image, pose, mask):
    """Tái hiện cách đo TRƯỚC khi sửa, đủ trung thực để so sánh.

    Kiểm chứng: chạy đúng nhánh này trên ảnh người mẫu áo đỏ phải ra lại
    206cm / 119.8kg / eo 155.6cm.
    """
    keypoints = pose.get('keypoints') or {}
    inferred = set(pose.get('inferredKeypoints') or ())
    box = [float(v) for v in (pose.get('box') or [0, 0, image.width, image.height])]

    def point(name):
        if name in inferred:
            return None
        value = keypoints.get(name)
        return (float(value[0]), float(value[1])) if value and len(value) >= 2 else None

    left_shoulder, right_shoulder = point('left_shoulder'), point('right_shoulder')
    left_hip, right_hip = point('left_hip'), point('right_hip')
    eye_mid = BA._mid(point('left_eye'), point('right_eye'))
    nose = point('nose')
    shoulder_mid, hip_mid = BA._mid(left_shoulder, right_shoulder), BA._mid(left_hip, right_hip)
    center_x = (shoulder_mid or hip_mid or ((box[0] + box[2]) / 2.0, 0))[0]
    head_reference = eye_mid or nose or (center_x, box[1])
    vertex_y = BA._vertex_y(mask, box, head_reference[0], max(12.0, (box[2] - box[0]) * 0.18))

    head_px = 0.0
    if eye_mid and eye_mid[1] > vertex_y:
        head_px = (eye_mid[1] - vertex_y) / 0.55           # hằng số cũ
    elif nose and nose[1] > vertex_y:
        head_px = (nose[1] - vertex_y) / 0.67

    ankles = [point('left_ankle'), point('right_ankle')]
    knees = [point('left_knee'), point('right_knee')]
    stature_px, coverage = 0.0, 'partial'
    visible_ankles = [p for p in ankles if p]
    visible_knees = [p for p in knees if p]
    if visible_ankles:
        stature_px = (max(p[1] for p in visible_ankles) - vertex_y) / BA.STATURE_FRACTION_FROM_TOP['ankle']
        coverage = 'full'
    elif visible_knees:
        stature_px = (max(p[1] for p in visible_knees) - vertex_y) / BA.STATURE_FRACTION_FROM_TOP['knee']
        coverage = 'knee'
    elif hip_mid:
        stature_px = (hip_mid[1] - vertex_y) / BA.STATURE_FRACTION_FROM_TOP['hip']
        coverage = 'hip'
    stature_px = max(1.0, stature_px)

    shoulder_y = shoulder_mid[1] if shoulder_mid else vertex_y + stature_px * 0.18
    hip_y = hip_mid[1] if hip_mid else vertex_y + stature_px * 0.485
    span = max(1.0, hip_y - shoulder_y)
    bust_y, waist_y = shoulder_y + span * 0.22, shoulder_y + span * 0.62
    shoulder_px = BA._width_at(mask, shoulder_y + span * 0.04, center_x)
    bust_px = BA._torso_width_over_band(mask, bust_y - span * 0.10, bust_y + span * 0.10, center_x)
    hip_center_x = hip_mid[0] if hip_mid else center_x
    shoulder_center_x = shoulder_mid[0] if shoulder_mid else center_x
    waist_px = BA._symmetric_width_at(mask, waist_y,
                                      shoulder_center_x + (hip_center_x - shoulder_center_x) * 0.62)
    hip_px = BA._symmetric_width_at(mask, hip_y, hip_center_x)
    if left_shoulder and right_shoulder:
        outer = abs(left_shoulder[0] - right_shoulder[0]) * 1.16      # hằng số cũ
        if outer > 1:
            shoulder_px = min(shoulder_px, outer) if shoulder_px else outer
            bust_px = min(bust_px, outer) if bust_px else bust_px

    height_cm = None
    if head_px > 0:
        head_count = stature_px / head_px
        if 6.0 <= head_count <= 9.0:
            height_cm = BA._clamp(head_count, 6.4, 8.6) * 24.0        # hằng số cũ
    return {'heightCm': height_cm, 'staturePx': stature_px, 'coverage': coverage,
            'shoulderPx': shoulder_px, 'bustPx': bust_px, 'waistPx': waist_px, 'hipPx': hip_px}


def baseline_predictions(image, pose, mask):
    measure = baseline_measure(image, pose, mask)
    height = measure['heightCm']
    out = {'height': height, 'weight': None, 'bust': None, 'waist': None, 'hip': None}
    if not height or measure['staturePx'] <= 0:
        return out
    px_per_cm = measure['staturePx'] / height
    widths = [measure['shoulderPx'], measure['bustPx'], measure['waistPx'], measure['hipPx']]
    if not all(widths):
        return out
    features = [height] + [w / px_per_cm for w in widths]
    for key, level in (('bust', 'chest'), ('waist', 'waist'), ('hip', 'hip')):
        width_cm = features[{'chest': 2, 'waist': 3, 'hip': 4}[level]]
        ratio = BA.TORSO_DEPTH_BY_LEVEL.get(level, 0.74)
        a, b = width_cm / 2.0, width_cm * ratio / 2.0
        out[key] = np.pi * (3 * (a + b) - np.sqrt(max(0.0, (3 * a + b) * (a + 3 * b))))
    ratio = float(np.median([w for w in widths])) / measure['staturePx']
    out['weight'] = BA._clamp(21.0 + (ratio - 0.19) * 130.0, 14.0, 48.0) * (height / 100.0) ** 2
    return out


def new_predictions(image, pose, mask, sex='unknown'):
    original = BA.person_mask
    BA.person_mask = lambda img, box=None, m=mask: m
    try:
        result = BA.analyze_body(image, pose, sex=sex)
    finally:
        BA.person_mask = original
    girths = result.get('estimatedGirths') or {}
    return {
        'height': result['estimatedHeight'].get('valueCm'),
        'weight': result['estimatedWeight'].get('valueKg'),
        'bust': girths.get('bust'), 'waist': girths.get('waist'), 'hip': girths.get('hip'),
        '_bins': {'height': result['estimatedHeight'], 'weight': result['estimatedWeight'],
                  **{k: v for k, v in (result.get('estimatedGirthRanges') or {}).items()}},
    }


def summarize(errors, truths):
    if not errors:
        return {'n': 0}
    array, truth = np.asarray(errors, dtype=float), np.asarray(truths, dtype=float)
    absolute = np.abs(array)
    return {
        'n': int(array.size),
        'mae': round(float(absolute.mean()), 2),
        'median': round(float(np.median(absolute)), 2),
        'p75': round(float(np.percentile(absolute, 75)), 2),
        'p90': round(float(np.percentile(absolute, 90)), 2),
        'bias': round(float(array.mean()), 2),
        'mape': round(float((absolute / np.maximum(1.0, truth)).mean() * 100), 2),
        'within5': round(float((absolute <= 5).mean()), 4),
        'within10': round(float((absolute <= 10).mean()), 4),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='/home/nhat/jp/datasets/bodym')
    parser.add_argument('--split', default='testB')
    parser.add_argument('--subjects', type=int, default=0, help='0 = tất cả')
    parser.add_argument('--photos-per-subject', type=int, default=1)
    parser.add_argument('--use-true-height', action='store_true',
                        help='đưa chiều cao thật vào để tách sai số thang đo khỏi sai số vòng đo')
    parser.add_argument('--out', default=None)
    args = parser.parse_args()

    from accessory_pipeline import analyze

    hwg, measures, photos = load_split(args.root, args.split)
    mask_dir = Path(args.root) / args.split / 'mask'
    subjects = [s for s in sorted(measures) if s in photos and s in hwg]
    if args.subjects:
        subjects = subjects[:args.subjects]

    records = {name: {'baseline': [], 'new': [], 'truth': []} for name in TARGETS}
    per_gender = {}
    bin_hits = {name: [0, 0] for name in TARGETS}
    implausible = {'baseline': 0, 'new': 0}
    latencies = []
    used = 0

    for subject in subjects:
        gender = (hwg[subject].get('gender') or 'unknown').strip().lower()
        truth = {
            'height': float(measures[subject]['height']),
            'weight': float(hwg[subject]['weight_kg']),
            'chest': float(measures[subject]['chest']),
            'waist': float(measures[subject]['waist']),
            'hip': float(measures[subject]['hip']),
        }
        for photo in photos[subject][:args.photos_per_subject]:
            path = mask_dir / f'{photo}.png'
            if not path.exists():
                continue
            binary = np.array(Image.open(path).convert('L')) > 127
            image = Image.fromarray(np.stack([binary.astype(np.uint8) * 255] * 3, -1))
            start = time.time()
            pose = analyze(image, source_coordinates=True)
            base = baseline_predictions(image, pose, binary)
            fresh = new_predictions(image, pose, binary,
                                    sex=gender if gender in ('male', 'female') else 'unknown')
            if args.use_true_height:
                pass
            latencies.append(time.time() - start)
            used += 1
            for name, key in TARGETS.items():
                actual = truth[name]
                base_value, new_value = base.get(key), fresh.get(key)
                if base_value is not None:
                    records[name]['baseline'].append(base_value - actual)
                    if abs(base_value - actual) > actual * 0.35:
                        implausible['baseline'] += 1
                if new_value is not None:
                    records[name]['new'].append(new_value - actual)
                    records[name]['truth'].append(actual)
                    if abs(new_value - actual) > actual * 0.35:
                        implausible['new'] += 1
                    entry = fresh['_bins'].get(key) or {}
                    low = entry.get('minCm', entry.get('minKg'))
                    high = entry.get('maxCm', entry.get('maxKg'))
                    if low is not None and high is not None:
                        bin_hits[name][1] += 1
                        bin_hits[name][0] += int(low <= actual <= high)
                    bucket = per_gender.setdefault(gender, {}).setdefault(name, [])
                    bucket.append(new_value - actual)
        if used and used % 50 == 0:
            print(f'  {used} ảnh...', flush=True)

    report = {
        'dataset': 'BodyM (Amazon), CC-BY-NC-4.0',
        'split': args.split,
        'identityDisjoint': True,
        'subjects': len(subjects),
        'photosScored': used,
        'note': ('Silhouette của BodyM dùng trực tiếp làm mặt nạ (không chạy rembg), nên đây là '
                 'sai số của bước SUY LUẬN hình học + hồi quy, chưa gồm sai số tách nền.'),
        'targets': {}, 'displayBinCoverage': {}, 'perGenderNewMae': {},
        'implausibleCount': implausible,
        'latencySeconds': {
            'p50': round(float(np.percentile(latencies, 50)), 3) if latencies else None,
            'p90': round(float(np.percentile(latencies, 90)), 3) if latencies else None,
        },
    }
    for name in TARGETS:
        truths = records[name]['truth']
        report['targets'][name] = {
            'unit': UNITS[name],
            'baseline': summarize(records[name]['baseline'],
                                  truths[:len(records[name]['baseline'])] or truths),
            'new': summarize(records[name]['new'], truths),
        }
        total = bin_hits[name][1]
        if total:
            report['displayBinCoverage'][name] = round(bin_hits[name][0] / total, 4)
    for gender, targets in per_gender.items():
        report['perGenderNewMae'][gender] = {
            name: round(float(np.abs(values).mean()), 2) for name, values in targets.items() if values}

    out = Path(args.out or ROOT / f'evaluation/body_pipeline_{args.split}.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    print(f"\nBodyM {args.split}: {len(subjects)} người, {used} ảnh")
    print(f"{'target':8} {'unit':4} {'baseline MAE':>13} {'new MAE':>9} {'Δ':>8} {'new n':>7} {'bin 10 phủ':>11}")
    for name, entry in report['targets'].items():
        base = entry['baseline'].get('mae')
        new = entry['new'].get('mae')
        delta = (new - base) if (base is not None and new is not None) else None
        print(f"{name:8} {entry['unit']:4} {base if base is not None else '-':>13} "
              f"{new if new is not None else '-':>9} {delta if delta is not None else '-':>8} "
              f"{entry['new'].get('n', 0):>7} {report['displayBinCoverage'].get(name, '-'):>11}")
    print(f"\n-> {out}")


if __name__ == '__main__':
    main()
