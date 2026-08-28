"""So sai số bề ngang thân: thuật toán CŨ và MỚI, trên split test của VITON-HD.

Ground truth là nhãn parsing (thân = silhouette trừ nhãn 14/15), chỉ tính những
hàng mà CẢ HAI cánh tay đều được gán nhãn — áo dài tay khiến tay nằm dưới nhãn
áo nên hiệu đó không còn là thân thật.

Chạy trên `image-parse-v3` chứ không chạy rembg: mục đích là đo sai số của bước
SUY LUẬN hình học, tách khỏi sai số của bộ tách nền. Sai số tách nền được báo
riêng trong regression trên ảnh thật.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))

import body_analysis as BA          # noqa: E402  thuật toán CŨ
import body_geometry as BG          # noqa: E402  thuật toán MỚI

LABEL_ARMS = (14, 15)
LEVEL_JOINT = {'chest': 'shoulderJointSpan', 'waist': 'shoulderJointSpan', 'hip': 'hipJointSpan'}


def baseline_widths(mask, row):
    """Đúng đường đi của body_analysis.py trước khi sửa."""
    shoulder_y, hip_y = row['shoulderY'], row['hipY']
    span = max(1.0, hip_y - shoulder_y)
    l_sh, r_sh = row['l_shoulder'], row['r_shoulder']
    l_hip, r_hip = row['l_hip'], row['r_hip']
    center_x = (l_sh[0] + r_sh[0]) / 2.0
    hip_center_x = (l_hip[0] + r_hip[0]) / 2.0
    waist_center_x = center_x + (hip_center_x - center_x) * 0.62

    bust_y = shoulder_y + span * 0.22
    waist_y = shoulder_y + span * 0.62
    bust = BA._torso_width_over_band(mask, bust_y - span * 0.10, bust_y + span * 0.10, center_x)
    waist = BA._symmetric_width_at(mask, waist_y, waist_center_x)
    hip = BA._symmetric_width_at(mask, hip_y, hip_center_x)
    outer = abs(l_sh[0] - r_sh[0]) * 1.16
    if outer > 1 and bust:
        bust = min(bust, outer)
    return {'chest': bust, 'waist': waist, 'hip': hip}


def new_widths(mask, row):
    """Đúng đường đi production sau khi sửa: body_geometry.torso_profile."""
    keypoints = {
        'left_shoulder': row['l_shoulder'], 'right_shoulder': row['r_shoulder'],
        'left_hip': row['l_hip'], 'right_hip': row['r_hip'],
        'left_elbow': row.get('l_elbow'), 'right_elbow': row.get('r_elbow'),
        'left_wrist': row.get('l_wrist'), 'right_wrist': row.get('r_wrist'),
    }
    profile = BG.torso_profile(mask, keypoints, row['shoulderY'], row['hipY'])
    return {level: profile[level]['widthPx'] for level in LEVEL_JOINT}


def evaluate(records, root, split, limit=0):
    parse_dir = Path(root) / split / 'image-parse-v3'
    rows = [r for r in records if r.get('sourceSplit') == split]
    if limit:
        rows = rows[:limit]
    errors = {level: {'baseline': [], 'new': [], 'gt': []} for level in LEVEL_JOINT}
    merged_errors = {level: {'baseline': [], 'new': []} for level in LEVEL_JOINT}
    used = 0
    for row in rows:
        path = parse_dir / f"{row['sample']}.png"
        if not path.exists():
            continue
        parse = np.array(Image.open(path))
        silhouette = parse != 0
        base = baseline_widths(silhouette, row)
        fresh = new_widths(silhouette, row)
        counted = False
        for level in LEVEL_JOINT:
            if not row.get(f'{level}GtValid'):
                continue
            gt = row.get(f'{level}TorsoPx', 0)
            if gt <= 10:
                continue
            errors[level]['gt'].append(gt)
            errors[level]['baseline'].append(base[level] - gt)
            errors[level]['new'].append(fresh[level] - gt)
            if row.get(f'{level}Merged'):
                merged_errors[level]['baseline'].append(base[level] - gt)
                merged_errors[level]['new'].append(fresh[level] - gt)
            counted = True
        used += int(counted)
    return errors, merged_errors, used


def summarize(name, values, gt):
    array = np.asarray(values, dtype=float)
    truth = np.asarray(gt, dtype=float)
    relative = np.abs(array) / np.maximum(1.0, truth) * 100.0
    return {
        'algorithm': name,
        'n': int(array.size),
        'maePx': round(float(np.abs(array).mean()), 2),
        'medianAbsPx': round(float(np.median(np.abs(array))), 2),
        'p90AbsPx': round(float(np.percentile(np.abs(array), 90)), 2),
        'biasPx': round(float(array.mean()), 2),
        'mapePct': round(float(relative.mean()), 2),
        'within10pct': round(float((relative <= 10).mean()), 4),
        'within20pct': round(float((relative <= 20).mean()), 4),
        'over30pctRate': round(float((relative > 30).mean()), 4),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--records', default=str(ROOT / 'body_dataset/torso_calibration.jsonl'))
    parser.add_argument('--root', default='/home/nhat/jp/datasets/viton-hd')
    parser.add_argument('--split', default='test')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--out', default=str(ROOT / 'evaluation/torso_extraction.json'))
    args = parser.parse_args()

    records = [json.loads(line) for line in Path(args.records).read_text().splitlines() if line.strip()]
    errors, merged, used = evaluate(records, args.root, args.split, args.limit)

    report = {'split': args.split, 'samplesUsed': used, 'levels': {}, 'armsMergedSubset': {},
              'groundTruth': 'VITON-HD image-parse-v3, thân = silhouette − nhãn 14/15, chỉ hàng có nhãn cả hai tay',
              'calibrationSource': BG.CALIBRATION.get('source')}
    for level in LEVEL_JOINT:
        gt = errors[level]['gt']
        if not gt:
            continue
        report['levels'][level] = {
            'baseline': summarize('baseline', errors[level]['baseline'], gt),
            'new': summarize('arm-carve+skeleton-gate', errors[level]['new'], gt),
        }
        if merged[level]['baseline']:
            subset_gt = [g for g, m in zip(gt, [True] * len(gt))][:len(merged[level]['baseline'])]
            report['armsMergedSubset'][level] = {
                'n': len(merged[level]['baseline']),
                'baselineMaePx': round(float(np.abs(merged[level]['baseline']).mean()), 2),
                'newMaePx': round(float(np.abs(merged[level]['new']).mean()), 2),
            }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
