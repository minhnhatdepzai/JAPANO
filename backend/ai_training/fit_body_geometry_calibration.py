"""Fit hằng số hình học cơ thể trên VITON-HD parsing, chia theo split của dataset.

Đầu vào: `body_dataset/torso_calibration.jsonl` do `build_torso_calibration.py`
sinh ra. Đầu ra: `models/body_geometry.calibration.json`.

Split: dùng đúng train/test gốc của VITON-HD (tác giả đã chia theo người mẫu),
không tự chia lại — tự chia theo tên file sẽ để cùng một người rơi vào hai bên.
Mọi hằng số chỉ fit trên `train`; `test` chỉ dùng để báo sai số.
"""

import argparse
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
LEVEL_JOINT = {'chest': 'shoulderJointSpan', 'waist': 'shoulderJointSpan', 'hip': 'hipJointSpan'}


def load(path):
    return [json.loads(line) for line in Path(path).read_text(encoding='utf-8').splitlines() if line.strip()]


def robust_stats(values, low=1.0, high=99.0):
    """mean/sd sau khi cắt đuôi — nhãn parsing có vài mẫu hỏng hẳn."""
    array = np.asarray([v for v in values if np.isfinite(v)], dtype=float)
    if array.size < 10:
        return None
    lo, hi = np.percentile(array, [low, high])
    kept = array[(array >= lo) & (array <= hi)]
    if kept.size < 10:
        kept = array
    return {'mean': round(float(kept.mean()), 4), 'sd': round(float(kept.std()), 4),
            'n': int(kept.size),
            'p1': round(float(np.percentile(array, 1)), 4),
            'p99': round(float(np.percentile(array, 99)), 4)}


def mid(a, b):
    if a and b:
        return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)
    return a or b


def fit(rows):
    calibration = {'torsoOverJoint': {}, 'headLength': {}}
    for level, joint_key in LEVEL_JOINT.items():
        values = []
        for row in rows:
            if not row.get(f'{level}GtValid'):
                continue
            torso, joint = row.get(f'{level}TorsoPx', 0), row.get(joint_key, 0)
            if torso > 10 and joint > 10:
                values.append(torso / joint)
        stats = robust_stats(values)
        if stats:
            stats['joint'] = 'shoulder' if joint_key == 'shoulderJointSpan' else 'hip'
            calibration['torsoOverJoint'][level] = stats

    # Bề ngang vai = bideltoid: cố ý ĐO CẢ HAI CÁNH TAY, vì `shoulder_breadth_cm`
    # của model ANSUR chính là bideltoidbreadth (qua cơ delta) chứ không phải
    # biacromial. Hằng số 1.16 dùng trước đây hẹp hơn thực tế 17% nên nó chặn
    # nhầm cả bề ngang ngực xuống thấp.
    shoulder_ratio = [row['shoulderSilhouettePx'] / row['shoulderJointSpan']
                      for row in rows
                      if row.get('shoulderSilhouettePx', 0) > 10 and row.get('shoulderJointSpan', 0) > 10]
    stats = robust_stats(shoulder_ratio)
    if stats:
        stats['joint'] = 'shoulder'
        stats['measures'] = 'bideltoid (bao gồm cơ delta và cánh tay)'
        calibration['torsoOverJoint']['shoulder'] = stats

    arm = []
    for row in rows:
        span = row.get('shoulderJointSpan', 0)
        if span <= 10:
            continue
        widths = [row.get(f'{lvl}ArmPx', 0) for lvl in ('chest', 'waist')
                  if row.get(f'{lvl}GtValid') and row.get(f'{lvl}ArmPx', 0) > 3]
        if widths:
            arm.append(float(np.mean(widths)) / span)
    stats = robust_stats(arm)
    if stats:
        calibration['armBreadthOverShoulderJoint'] = stats

    eye, nose, shoulder = [], [], []
    for row in rows:
        if not row.get('headGtValid'):
            continue
        length, vertex = row.get('headLenPx', 0), row.get('vertexY', 0)
        if length <= 40:
            continue
        eye_mid = mid(row.get('l_eye'), row.get('r_eye'))
        if eye_mid and eye_mid[1] > vertex:
            eye.append((eye_mid[1] - vertex) / length)
        nose_point = row.get('nose')
        if nose_point and nose_point[1] > vertex:
            nose.append((nose_point[1] - vertex) / length)
        if row.get('shoulderJointSpan', 0) > 10:
            shoulder.append(length / row['shoulderJointSpan'])
    for key, values in (('vertexToEyeRatio', eye), ('vertexToNoseRatio', nose),
                        ('overShoulderJoint', shoulder)):
        stats = robust_stats(values)
        if stats:
            calibration['headLength'][key] = stats
    return calibration


# VITON-HD dùng để lấy GIÁ TRỊ KỲ VỌNG (nó đo trên ảnh, đúng miền), nhưng KHÔNG
# dùng để đặt giới hạn trên: người mẫu Zalando gần như toàn dáng thon, p99 bề
# ngang eo của họ chỉ 1.26 lần khoảng cách hai khớp vai. Lấy đó làm trần thì một
# người béo thật sẽ bị kẹp xuống dáng trung bình — đúng kiểu lỗi mà bài test
# "người rộng hơn phải nặng hơn" bắt được.
#
# Giới hạn vì vậy lấy từ ANSUR II, tập có BMI tới 43.5 và số đo thật của 6.068
# người, rồi nhân thêm phần quần áo (ảnh đo đường viền ngoài của trang phục).
ANSUR_DIR = Path('/home/nhat/jp/datasets/ansur2')
CLOTHING_ALLOWANCE = 1.25
# Khớp vai của OpenPose/YOLO nằm hơi vào trong so với mỏm vai. Hệ số quy đổi suy
# từ hai đại lượng đo độc lập: ANSUR cho bideltoid/biacromial = 1.233, VITON-HD
# cho bideltoid/khoảng-cách-hai-khớp-vai = 1.3931.
JOINT_OVER_BIACROMIAL = 1.233 / 1.3931


def ansur_gate_limits():
    """Trần/sàn bề ngang thân theo khoảng cách khớp, lấy từ cực trị ANSUR II."""
    import csv

    columns = {'chest': 'chestbreadth', 'waist': 'waistbreadth', 'shoulder': 'bideltoidbreadth'}
    values = {name: [] for name in columns}
    found = False
    for filename in ('ANSUR II FEMALE Public.csv', 'ANSUR II MALE Public.csv'):
        path = ANSUR_DIR / filename
        if not path.exists():
            continue
        found = True
        with path.open(encoding='latin-1') as handle:
            for raw in csv.DictReader(handle):
                row = {key.strip().lower(): value for key, value in raw.items()}
                try:
                    joint = float(row['biacromialbreadth']) * JOINT_OVER_BIACROMIAL
                    if joint <= 0:
                        continue
                    for name, column in columns.items():
                        values[name].append(float(row[column]) / joint)
                except (KeyError, TypeError, ValueError):
                    continue
    if not found:
        return None
    limits = {}
    for name, series in values.items():
        if len(series) < 100:
            continue
        array = np.asarray(series)
        limits[name] = {
            'low': round(float(array.min()) * 0.92, 4),
            'high': round(float(array.max()) * CLOTHING_ALLOWANCE, 4),
            'ansurMin': round(float(array.min()), 4),
            'ansurMax': round(float(array.max()), 4),
            'ansurMean': round(float(array.mean()), 4),
            'n': int(array.size),
        }
    return limits


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--records', default=str(ROOT / 'body_dataset/torso_calibration.jsonl'))
    parser.add_argument('--out', default=str(ROOT / 'models/body_geometry.calibration.json'))
    args = parser.parse_args()

    rows = load(args.records)
    train = [row for row in rows if row.get('sourceSplit') == 'train']
    test = [row for row in rows if row.get('sourceSplit') == 'test']
    calibration = fit(train)
    limits = ansur_gate_limits()
    if limits:
        # Hông: ANSUR không đo khoảng cách hai khớp hông nên không suy trực tiếp
        # được. Dùng độ trải TƯƠNG ĐỐI của vòng eo trong ANSUR (max/mean) áp lên
        # giá trị kỳ vọng đo trên VITON-HD.
        waist = limits.get('waist')
        hip_stats = calibration['torsoOverJoint'].get('hip')
        if waist and hip_stats:
            spread_high = waist['ansurMax'] / max(1e-6, waist['ansurMean'])
            spread_low = waist['ansurMin'] / max(1e-6, waist['ansurMean'])
            limits['hip'] = {
                'low': round(hip_stats['mean'] * spread_low * 0.92, 4),
                'high': round(hip_stats['mean'] * spread_high * CLOTHING_ALLOWANCE, 4),
                'derivedFrom': 'độ trải tương đối của waistbreadth trong ANSUR II × kỳ vọng hông của VITON-HD',
            }
        calibration['gateLimits'] = limits
        calibration['gateLimitsNote'] = (
            'Trần/sàn của chốt chặn khung xương. Kỳ vọng lấy từ VITON-HD (đúng miền ảnh), '
            'cực trị lấy từ ANSUR II (có người BMI tới 43.5) rồi nhân %.2f cho phần quần áo. '
            'Cố ý rộng: mục tiêu là chặn lỗi segmentation, không phải ép mọi người về dáng trung bình.'
            % CLOTHING_ALLOWANCE)
    calibration.update({
        'source': 'VITON-HD image-parse-v3 (CC-BY-NC-SA-4.0) — fit trên split train gốc',
        'licenseRestriction': 'NonCommercial + ShareAlike: nghiên cứu/đồ án, không phát hành thương mại.',
        'trainRecords': len(train),
        'testRecords': len(test),
        'note': ('Tỉ lệ đo trên ảnh studio 768x1024, người đứng thẳng chính diện, đa số dáng '
                 'thon. KHÔNG đại diện cho ảnh chụp bằng điện thoại, người ngồi, hay dáng rất '
                 'mập — dùng làm chốt chặn ±3sd chứ không dùng làm số đo.'),
    })
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(calibration, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(calibration, ensure_ascii=False, indent=2))
    print(f'\n-> {args.out}  (train {len(train)}, test {len(test)})')


if __name__ == '__main__':
    main()
