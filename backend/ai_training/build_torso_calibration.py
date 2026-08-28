"""Trích ground-truth bề ngang THÂN (đã loại hai cánh tay) từ VITON-HD parsing.

Vì sao cần file này: lỗi gốc của ảnh regression áo đỏ KHÔNG nằm ở regressor mà
ở bước trích đặc trưng — segmentation gộp hai cánh tay vào thân nên "eo" đo được
497px trong khi khoảng cách hai khớp hông chỉ 214px. Muốn sửa cho chắc thì phải
có nhãn tay/thân thật để đo sai số, chứ không thể chỉnh hằng số bằng cảm giác.

VITON-HD (`image-parse-v3`) có đúng nhãn đó: 14 = left_arm, 15 = right_arm, tách
khỏi 5/6/7 (áo/váy/khoác), 9/12 (quần/chân váy) và 10 (da cổ-ngực). Kèm theo là
`openpose_json` (BODY_25) nên có cả khớp vai/khuỷu/cổ tay/hông ở cùng toạ độ.

Với mỗi ảnh, script ghi lại tại ba mốc ngực/eo/hông:
  * `silhouette_px` — bề ngang của TOÀN BỘ người (đúng thứ rembg trả về, có tay);
  * `torso_px`      — bề ngang thân THẬT theo nhãn parsing (không tay);
  * các khoảng cách khớp để hồi quy/đặt trần.

License: VITON-HD là CC-BY-NC-SA-4.0 — chỉ nghiên cứu/đồ án, không thương mại.
Xem backend/ai_training/provenance/viton_hd.manifest.json.
"""

import argparse
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

# Nhãn của image-parse-v3 (bộ ATR 20 lớp mà VITON-HD/HR-VITON dùng).
LABEL_BACKGROUND = 0
LABEL_ARMS = (14, 15)
# Thân = áo + váy + khoác + quần + chân váy + da cổ/ngực. KHÔNG gồm tay, đầu,
# tóc, chân, giày — đây là những vùng làm bề ngang thân sai lệch.
LABEL_TORSO = (5, 6, 7, 9, 10, 12)
LABEL_HEAD = (1, 2, 4, 13)   # mũ, tóc, kính, mặt — dùng để đo chiều dài đầu
LABEL_FACE = (13,)
LABEL_HAIR = (1, 2)

# OpenPose BODY_25
OP = {'nose': 0, 'neck': 1, 'r_shoulder': 2, 'r_elbow': 3, 'r_wrist': 4,
      'l_shoulder': 5, 'l_elbow': 6, 'l_wrist': 7, 'mid_hip': 8,
      'r_hip': 9, 'r_knee': 10, 'r_ankle': 11, 'l_hip': 12, 'l_knee': 13,
      'l_ankle': 14, 'r_eye': 15, 'l_eye': 16, 'r_ear': 17, 'l_ear': 18}


def read_pose(path):
    try:
        data = json.loads(Path(path).read_text())
    except Exception:
        return None
    people = data.get('people') or []
    if not people:
        return None
    flat = people[0].get('pose_keypoints_2d') or []
    if len(flat) < 75:
        return None
    points = {}
    for name, index in OP.items():
        x, y, c = flat[index * 3:index * 3 + 3]
        points[name] = (float(x), float(y), float(c)) if c > 0.2 else None
    return points


def row_runs(row):
    idx = np.flatnonzero(row)
    if idx.size == 0:
        return []
    brk = np.flatnonzero(np.diff(idx) > 1)
    starts = np.concatenate(([idx[0]], idx[brk + 1]))
    ends = np.concatenate((idx[brk], [idx[-1]]))
    return list(zip(starts.tolist(), ends.tolist()))


def central_run_width(mask, y, center_x):
    """Bề ngang của đoạn liên tục chứa trục thân tại hàng y."""
    y = int(np.clip(y, 0, mask.shape[0] - 1))
    runs = row_runs(mask[y])
    if not runs:
        return 0.0
    run = min(runs, key=lambda r: abs((r[0] + r[1]) / 2.0 - center_x))
    return float(run[1] - run[0] + 1)


def band_width(mask, y, center_x, half=4):
    """Median trên vài hàng quanh y — chống nhiễu răng cưa của nhãn parsing."""
    values = [central_run_width(mask, y + d, center_x) for d in range(-half, half + 1)]
    values = [v for v in values if v > 0]
    return float(np.median(values)) if values else 0.0


def level_record(silhouette, arms, y, center_x):
    """Bề ngang tại một hàng: cả người, thân đã trừ tay, và tay có được gán nhãn.

    Chỉ khi HAI cánh tay đều có nhãn ở đúng hàng đó thì `torsoPx` mới là ground
    truth dùng được — áo dài tay khiến cánh tay nằm dưới nhãn 5 (upper_clothes)
    nên hiệu silhouette - arms vẫn còn nguyên tay.
    """
    y = int(np.clip(y, 0, silhouette.shape[0] - 1))
    sil_runs = row_runs(silhouette[y])
    if not sil_runs:
        return None
    sil_run = min(sil_runs, key=lambda r: abs((r[0] + r[1]) / 2.0 - center_x))
    torso_row = silhouette[y] & ~arms[y]
    torso_runs = row_runs(torso_row)
    if not torso_runs:
        return None
    torso_run = min(torso_runs, key=lambda r: abs((r[0] + r[1]) / 2.0 - center_x))
    arm_runs = row_runs(arms[y])
    left_arms = [r for r in arm_runs if (r[0] + r[1]) / 2.0 < torso_run[0]]
    right_arms = [r for r in arm_runs if (r[0] + r[1]) / 2.0 > torso_run[1]]
    both = bool(left_arms and right_arms)
    arm_px = 0.0
    if both:
        arm_px = float(np.mean([
            max(r[1] - r[0] + 1 for r in left_arms),
            max(r[1] - r[0] + 1 for r in right_arms),
        ]))
    return {
        'silhouettePx': float(sil_run[1] - sil_run[0] + 1),
        'torsoPx': float(torso_run[1] - torso_run[0] + 1),
        'torsoLeft': float(torso_run[0]),
        'torsoRight': float(torso_run[1]),
        'bothArmsLabelled': both,
        'armPx': arm_px,
        'merged': bool(len(sil_runs) == 1 and len(torso_runs) >= 1 and
                       (sil_run[1] - sil_run[0]) > (torso_run[1] - torso_run[0]) * 1.08),
    }


def head_record(parse, pose):
    """Chiều dài đầu THẬT (đỉnh tóc → cằm) từ nhãn parsing.

    Đây là hằng số neo duy nhất mà một ảnh đơn có thể cho, nên sai số của nó đi
    thẳng vào sai số chiều cao. Code cũ suy nó từ (mắt − đỉnh đầu)/0.55 — một hệ
    số cố định. Với ảnh regression áo đỏ, cách đó cho 208px trong khi đầu thật
    dài khoảng 278px, tức hụt 25% và thổi chiều cao lên hơn 40cm.
    """
    head = np.isin(parse, LABEL_HEAD)
    face = np.isin(parse, LABEL_FACE)
    out = {'headLenPx': 0.0, 'faceTopY': 0.0, 'vertexY': 0.0, 'chinY': 0.0,
           'headWidthPx': 0.0, 'headGtValid': False}
    head_rows = np.flatnonzero(head.any(axis=1))
    face_rows = np.flatnonzero(face.any(axis=1))
    if head_rows.size == 0 or face_rows.size == 0:
        return out
    vertex_y, chin_y, face_top = float(head_rows[0]), float(face_rows[-1]), float(face_rows[0])
    if chin_y <= vertex_y:
        return out
    band = head[int(vertex_y):int(chin_y) + 1]
    widths = [max((r[1] - r[0] + 1) for r in row_runs(row)) for row in band if row.any()]
    out.update({
        'headLenPx': round(chin_y - vertex_y, 2),
        'faceTopY': round(face_top, 2),
        'vertexY': round(vertex_y, 2),
        'chinY': round(chin_y, 2),
        'headWidthPx': round(float(np.max(widths)), 2) if widths else 0.0,
        # Tóc dài phủ vai làm nhãn "hair" kéo xuống quá cằm; loại các mẫu đó.
        'headGtValid': bool(chin_y - vertex_y > 40 and vertex_y < face_top),
    })
    for key in ('nose', 'l_eye', 'r_eye', 'l_ear', 'r_ear', 'neck'):
        point = pose.get(key)
        out[key] = [round(point[0], 2), round(point[1], 2)] if point else None
    return out


def sample_record(parse_path, pose_path):
    parse = np.array(Image.open(parse_path))
    pose = read_pose(pose_path)
    if pose is None:
        return None
    for key in ('l_shoulder', 'r_shoulder', 'l_hip', 'r_hip'):
        if not pose.get(key):
            return None
    l_sh, r_sh = pose['l_shoulder'], pose['r_shoulder']
    l_hip, r_hip = pose['l_hip'], pose['r_hip']
    shoulder_span = abs(l_sh[0] - r_sh[0])
    hip_span = abs(l_hip[0] - r_hip[0])
    if shoulder_span < 20 or hip_span < 10:
        return None

    silhouette = parse != LABEL_BACKGROUND
    arms = np.isin(parse, LABEL_ARMS)
    if (silhouette & ~arms).sum() < 500:
        return None

    shoulder_y = (l_sh[1] + r_sh[1]) / 2.0
    hip_y = (l_hip[1] + r_hip[1]) / 2.0
    span = hip_y - shoulder_y
    if span < 40:
        return None
    center_x = (l_sh[0] + r_sh[0] + l_hip[0] + r_hip[0]) / 4.0

    record = {
        'shoulderJointSpan': round(shoulder_span, 2),
        'hipJointSpan': round(hip_span, 2),
        'shoulderY': round(shoulder_y, 2),
        'hipY': round(hip_y, 2),
        'torsoSpanY': round(span, 2),
        'centerX': round(center_x, 2),
        'imageHeight': int(parse.shape[0]),
        'imageWidth': int(parse.shape[1]),
        'shoulderTiltDeg': round(float(np.degrees(np.arctan2(
            abs(l_sh[1] - r_sh[1]), max(1.0, shoulder_span)))), 2),
    }
    for key in ('l_elbow', 'r_elbow', 'l_wrist', 'r_wrist'):
        point = pose.get(key)
        record[key] = [round(point[0], 2), round(point[1], 2)] if point else None
    record['l_shoulder'] = [round(l_sh[0], 2), round(l_sh[1], 2)]
    record['r_shoulder'] = [round(r_sh[0], 2), round(r_sh[1], 2)]
    record['l_hip'] = [round(l_hip[0], 2), round(l_hip[1], 2)]
    record['r_hip'] = [round(r_hip[0], 2), round(r_hip[1], 2)]

    # Bề ngang vai = bideltoid (qua cơ delta) — cố ý GIỮ hai cánh tay, vì đó
    # đúng là đại lượng mà model ANSUR dùng làm `shoulder_breadth_cm`.
    shoulder_rows = [level_record(silhouette, arms, shoulder_y + span * 0.04 + d, center_x)
                     for d in (-6, -3, 0, 3, 6)]
    shoulder_rows = [r for r in shoulder_rows if r]
    record['shoulderSilhouettePx'] = round(float(np.median(
        [r['silhouettePx'] for r in shoulder_rows])), 2) if shoulder_rows else 0.0

    levels = {'chest': shoulder_y + span * 0.22,
              'waist': shoulder_y + span * 0.62,
              'hip': hip_y}
    valid_levels = 0
    for name, y in levels.items():
        # Median trên vài hàng để nhãn parsing răng cưa không chi phối.
        rows = [level_record(silhouette, arms, y + d, center_x) for d in (-6, -3, 0, 3, 6)]
        rows = [r for r in rows if r]
        if not rows:
            return None
        record[f'{name}Y'] = round(y, 2)
        record[f'{name}SilhouettePx'] = round(float(np.median([r['silhouettePx'] for r in rows])), 2)
        record[f'{name}TorsoPx'] = round(float(np.median([r['torsoPx'] for r in rows])), 2)
        record[f'{name}ArmPx'] = round(float(np.median([r['armPx'] for r in rows])), 2)
        labelled = sum(r['bothArmsLabelled'] for r in rows) >= 3
        record[f'{name}GtValid'] = bool(labelled)
        record[f'{name}Merged'] = bool(sum(r['merged'] for r in rows) >= 3)
        valid_levels += int(labelled)
    record.update(head_record(parse, pose))
    record['gtValidLevels'] = valid_levels
    if valid_levels == 0:
        return None
    return record


def identity_of(name):
    """VITON-HD đặt tên `<identity>_00.jpg`; giữ mọi frame của một người cùng split."""
    return name.split('_')[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default=os.getenv('JAPANO_VITON_ROOT', '/home/nhat/jp/datasets/viton-hd'))
    parser.add_argument('--out', default=str(Path(__file__).resolve().parent / 'body_dataset/torso_calibration.jsonl'))
    parser.add_argument('--limit', type=int, default=0)
    args = parser.parse_args()

    root = Path(args.root)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    written = skipped = 0
    with out.open('w', encoding='utf-8') as handle:
        for split in ('train', 'test'):
            parse_dir = root / split / 'image-parse-v3'
            pose_dir = root / split / 'openpose_json'
            if not parse_dir.is_dir():
                continue
            names = sorted(p.name for p in parse_dir.glob('*.png'))
            if args.limit:
                names = names[:args.limit]
            for name in names:
                stem = name[:-4]
                pose_path = pose_dir / f'{stem}_keypoints.json'
                if not pose_path.exists():
                    skipped += 1
                    continue
                try:
                    record = sample_record(parse_dir / name, pose_path)
                except Exception:
                    record = None
                if record is None:
                    skipped += 1
                    continue
                record['sample'] = stem
                record['identity'] = identity_of(stem)
                record['sourceSplit'] = split
                handle.write(json.dumps(record) + '\n')
                written += 1
                if written % 2000 == 0:
                    print(f'  {written} records...', flush=True)
    print(f'wrote {written} records ({skipped} skipped) -> {out}')


if __name__ == '__main__':
    main()
