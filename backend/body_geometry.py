"""Hình học cơ thể: tách bề ngang THÂN khỏi hai cánh tay, và đo chiều dài đầu.

Tách khỏi `body_analysis.py` vì đây là bước TRÍCH ĐẶC TRƯNG — nơi lỗi thật sự
nằm, và là bước duy nhất có thể đo sai số bằng dữ liệu có nhãn. Toàn bộ hằng số
trong file này được fit trên VITON-HD `image-parse-v3` (nhãn 14/15 = tay trái/
phải, 13 = mặt, 1/2 = tóc/mũ) chứ không đặt bằng cảm giác; xem
`ai_training/fit_body_geometry_calibration.py` và
`ai_training/models/body_geometry.calibration.json`.

Bối cảnh lỗi: ảnh người mẫu áo đỏ tay buông sát thân cho ra silhouette liền một
dải rộng 497px ở ngang eo, trong khi hai khớp hông chỉ cách nhau 214px. Mọi thứ
suy ra sau đó — vòng eo 155cm, cân nặng 119kg — đều là hệ quả của một con số bề
ngang sai, không phải lỗi của regressor.
"""

import json
import math
import os
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
CALIBRATION_PATH = Path(os.getenv(
    'JAPANO_BODY_GEOMETRY_CALIBRATION',
    str(ROOT / 'ai_training/models/body_geometry.calibration.json'),
))

# Giá trị dự phòng khi chưa chạy fit — cùng thứ tự đại lượng với file calibration
# để đọc log không phải đoán. Đây là số liệu nhân trắc thô, KHÔNG phải kết quả fit.
DEFAULT_CALIBRATION = {
    'source': 'builtin-fallback',
    'armBreadthOverShoulderJoint': {'mean': 0.215, 'sd': 0.054},
    'torsoOverJoint': {
        'chest': {'joint': 'shoulder', 'mean': 1.00, 'sd': 0.12},
        'waist': {'joint': 'shoulder', 'mean': 0.99, 'sd': 0.15},
        'hip': {'joint': 'hip', 'mean': 1.68, 'sd': 0.27},
    },
    'headLength': {
        'vertexToEyeRatio': {'mean': 0.42, 'sd': 0.05},
        'vertexToNoseRatio': {'mean': 0.56, 'sd': 0.05},
        'overShoulderJoint': {'mean': 0.72, 'sd': 0.10},
    },
}


def _load_calibration():
    if not CALIBRATION_PATH.exists():
        return dict(DEFAULT_CALIBRATION)
    try:
        data = json.loads(CALIBRATION_PATH.read_text(encoding='utf-8'))
    except Exception:
        return dict(DEFAULT_CALIBRATION)
    merged = dict(DEFAULT_CALIBRATION)
    merged.update(data)
    return merged


CALIBRATION = _load_calibration()


def reload_calibration():
    """Nạp lại calibration — dùng trong test và sau khi train lại."""
    global CALIBRATION
    CALIBRATION = _load_calibration()
    return CALIBRATION


def _clamp(value, low, high):
    return max(low, min(high, value))


def row_runs(row):
    """Các đoạn pixel liên tục trong một hàng mặt nạ: [(start, end), ...]."""
    idx = np.flatnonzero(row)
    if idx.size == 0:
        return []
    brk = np.flatnonzero(np.diff(idx) > 1)
    starts = np.concatenate(([idx[0]], idx[brk + 1]))
    ends = np.concatenate((idx[brk], [idx[-1]]))
    return list(zip(starts.tolist(), ends.tolist()))


def central_run(mask, y, center_x):
    y = int(_clamp(int(round(y)), 0, mask.shape[0] - 1))
    runs = row_runs(mask[y])
    if not runs:
        return None
    return min(runs, key=lambda run: abs((run[0] + run[1]) / 2.0 - center_x))


# --- Cánh tay ---------------------------------------------------------------

def arm_polyline(shoulder, elbow, wrist):
    """Đường gãy vai → khuỷu → cổ tay. Bỏ qua khớp thiếu, giữ thứ tự."""
    points = [point for point in (shoulder, elbow, wrist) if point]
    return points if len(points) >= 2 else None


def arm_x_at(polyline, y, center_x):
    """Toạ độ x của cánh tay tại hàng y — lấy giao điểm XA trục thân nhất.

    Tay chống hông làm một hàng cắt qua đường gãy hai lần (cánh tay đi xuống,
    cẳng tay đi lên). Cánh tay khi đó phình ra phía ngoài, nên giao điểm cần
    dùng là giao điểm xa trục thân nhất — lấy giao điểm đầu tiên sẽ cắt nhầm
    vào trong và làm thân bị đo hụt.
    """
    if not polyline:
        return None
    hits = []
    for (x1, y1), (x2, y2) in zip(polyline, polyline[1:]):
        low, high = min(y1, y2), max(y1, y2)
        if low - 0.5 <= y <= high + 0.5:
            t = 0.0 if abs(y2 - y1) < 1e-6 else (y - y1) / (y2 - y1)
            hits.append(x1 + t * (x2 - x1))
    if hits:
        return max(hits, key=lambda x: abs(x - center_x))
    # Dưới điểm thấp nhất của đường gãy vẫn còn bàn tay buông tiếp.
    lowest = max(polyline, key=lambda point: point[1])
    if y > lowest[1]:
        return lowest[0]
    return None


def arm_half_width(mask, y, arm_x, run, center_x, global_half):
    """Nửa bề ngang cánh tay tại hàng y.

    Ưu tiên đo trực tiếp: nếu cánh tay dính vào thân thì mép NGOÀI của dải mask
    chính là mép ngoài cánh tay, nên khoảng cách từ tâm tay tới mép đó là nửa bề
    ngang thật của tay ở đúng hàng đó. Chỉ khi số đo đó phi lý so với ước lượng
    nhân trắc (tay khuất, khớp lệch) mới quay về giá trị chung.
    """
    if arm_x is None or run is None:
        return global_half, 'anthropometric'
    edge = run[0] if arm_x < center_x else run[1]
    local = abs(edge - arm_x)
    # Dải chấp nhận cố ý HẸP. Bản trước cho phép [0.55, 1.8] lần bề ngang tay
    # nhân trắc, tức mỗi bên được gỡ tới 1.8 lần. Khi mép ngoài của dải mask nằm
    # xa trục tay theo khung xương — người mặc váy xoè, tay chống nạnh, hoặc thân
    # rộng — phép cắt gỡ quá tay và trả về thân hẹp hơn thực tế.
    #
    # Bằng chứng: VITON-HD test (1.026 mẫu có nhãn tay hai bên), MAE vòng eo
    # 17.44 -> 16.37 px; quét cả [0.70,1.35] và [0.75,1.25] đều tốt hơn bản cũ.
    # Vòng ngực không đổi (lấy từ khung xương), vòng hông đi ngang.
    if 0.80 * global_half <= local <= 1.15 * global_half:
        return local, 'silhouette_edge'
    return _clamp(local, 0.80 * global_half, 1.15 * global_half), 'anthropometric_clamped'


def torso_width_at(mask, y, center_x, arms, global_half):
    """Bề ngang thân tại một hàng, sau khi cắt bỏ hai cánh tay bằng khung xương.

    Trả về dict để tầng trên biết vì sao có con số đó — cắt được tay, hay đã
    phải bỏ cuộc vì tay nằm chắn trước thân.
    """
    run = central_run(mask, y, center_x)
    if run is None:
        return None
    raw = float(run[1] - run[0] + 1)
    low, high = float(run[0]), float(run[1])
    carved = []
    for side, polyline in arms.items():
        arm_x = arm_x_at(polyline, y, center_x)
        if arm_x is None or not (run[0] - global_half <= arm_x <= run[1] + global_half):
            continue
        half, method = arm_half_width(mask, y, arm_x, run, center_x, global_half)
        if arm_x < center_x:
            low = max(low, arm_x + half)
        else:
            high = min(high, arm_x - half)
        carved.append({'side': side, 'x': round(arm_x, 1), 'half': round(half, 1), 'method': method})
    width = high - low + 1.0
    # Tay khoanh trước ngực / chống hông sát người có thể đẩy hai mép vào nhau.
    # Cắt tới mức đó là sai, thà giữ số thô và báo là không tách được.
    collapsed = width < raw * 0.32 or width <= 1.0
    if collapsed:
        return {'widthPx': raw, 'rawPx': raw, 'armsCarved': False,
                'reason': 'carve_collapsed', 'arms': carved}
    return {'widthPx': float(width), 'rawPx': raw, 'armsCarved': bool(carved),
            'reason': 'carved' if carved else 'no_arm_at_row', 'arms': carved}


def torso_width_band(mask, y_center, half_span, center_x, arms, global_half, samples=7):
    """Median bề ngang thân trên một dải hàng — chống nhiễu viền và nếp áo."""
    values, details = [], []
    for index in range(samples):
        offset = -half_span + (2.0 * half_span) * index / max(1, samples - 1)
        result = torso_width_at(mask, y_center + offset, center_x, arms, global_half)
        if result:
            values.append(result['widthPx'])
            details.append(result)
    if not values:
        return None
    carved = sum(1 for item in details if item['armsCarved'])
    raws = [item['rawPx'] for item in details]
    return {
        'widthPx': float(np.median(values)),
        'rawPx': float(np.median(raws)),
        'armsCarved': carved >= max(1, len(details) // 2),
        'rowsCarved': carved,
        'rows': len(details),
    }


# --- Chốt chặn giải phẫu ----------------------------------------------------

def skeleton_bounds(level, joint_span, sigma=3.0):
    """Dải bề ngang thân mà khung xương cho phép, tính bằng pixel.

    Kỳ vọng lấy từ VITON-HD (đo trên ảnh, đúng miền). Trần và sàn KHÔNG lấy từ
    VITON-HD: người mẫu Zalando gần như toàn dáng thon nên p99 bề ngang eo của
    họ chỉ 1.26 lần khoảng cách hai khớp vai, dùng làm trần sẽ kẹp một người béo
    thật xuống dáng trung bình. Cực trị vì vậy lấy từ ANSUR II (6.068 người, BMI
    tới 43.5) rồi cộng phần quần áo — xem `gateLimits` trong file calibration.
    """
    stats = CALIBRATION['torsoOverJoint'].get(level)
    if not stats or joint_span <= 0:
        return None
    mean, sd = float(stats['mean']), float(stats['sd'])
    limits = (CALIBRATION.get('gateLimits') or {}).get(level)
    if limits:
        low_ratio, high_ratio = float(limits['low']), float(limits['high'])
        source = 'ansur_extremes'
    else:
        low_ratio, high_ratio = max(0.2, mean - sigma * sd), mean + sigma * sd
        source = 'viton_sigma'
    return {
        'expected': joint_span * mean,
        'low': joint_span * low_ratio,
        'high': joint_span * high_ratio,
        'source': source,
    }


def gate_torso_width(width_px, level, joint_span, sigma=3.0):
    """So bề ngang đo được với khung xương; khung xương thắng khi mâu thuẫn.

    Hai khớp vai/hông là mốc độc lập với quần áo và với lỗi segmentation, nên
    khi silhouette rộng hơn mức mà GIẢI PHẪU NGƯỜI cho phép thì thứ sai gần như
    chắc chắn là silhouette. Trả lại ước lượng theo khung xương và nói rõ đã can
    thiệp — không im lặng kẹp số rồi báo cáo như đo được.

    Chốt này cố ý rộng. Nó tồn tại để bắt lỗi tách nền và lỗi gộp tay vào thân,
    KHÔNG phải để ép mọi người về dáng trung bình: một người béo thật vẫn phải đi
    qua được, và bài test "người rộng hơn thì nặng hơn" giữ đúng điều đó.
    """
    bounds = skeleton_bounds(level, joint_span, sigma)
    if not bounds or not width_px:
        return {'widthPx': width_px, 'gated': False, 'reason': 'no_skeleton_reference'}
    if width_px > bounds['high']:
        return {'widthPx': bounds['high'], 'gated': True, 'reason': 'wider_than_anatomy_allows',
                'observedPx': round(width_px, 1), 'limitPx': round(bounds['high'], 1),
                'limitSource': bounds['source']}
    if width_px < bounds['low']:
        return {'widthPx': bounds['low'], 'gated': True, 'reason': 'narrower_than_anatomy_allows',
                'observedPx': round(width_px, 1), 'limitPx': round(bounds['low'], 1),
                'limitSource': bounds['source']}
    return {'widthPx': width_px, 'gated': False, 'reason': 'within_skeleton_bounds'}


# --- Chiều dài đầu ----------------------------------------------------------

def head_length_px(vertex_y, eye_mid, nose, shoulder_joint_span):
    """Chiều dài đầu (đỉnh tóc → cằm) theo pixel, kèm độ lệch chuẩn tương đối.

    Ba đường độc lập, hợp nhất theo nghịch đảo phương sai. Một hệ số cố định như
    trước (mắt nằm ở 0.55 chiều dài đầu) sai tới 25% trên ảnh regression áo đỏ
    và đẩy chiều cao lên 206cm; gộp nhiều đường đo và mang theo phương sai giúp
    tầng trên biết cue này yếu tới đâu thay vì tin tuyệt đối.
    """
    calibration = CALIBRATION['headLength']
    cues = []
    if eye_mid and eye_mid[1] > vertex_y:
        stats = calibration['vertexToEyeRatio']
        value = (eye_mid[1] - vertex_y) / max(1e-6, stats['mean'])
        rel_sd = stats['sd'] / max(1e-6, stats['mean'])
        cues.append(('vertex_to_eye', value, rel_sd))
    if nose and nose[1] > vertex_y:
        stats = calibration['vertexToNoseRatio']
        value = (nose[1] - vertex_y) / max(1e-6, stats['mean'])
        rel_sd = stats['sd'] / max(1e-6, stats['mean'])
        cues.append(('vertex_to_nose', value, rel_sd))
    if shoulder_joint_span and shoulder_joint_span > 0:
        stats = calibration.get('overShoulderJoint')
        if stats:
            value = shoulder_joint_span * stats['mean']
            rel_sd = stats['sd'] / max(1e-6, stats['mean'])
            cues.append(('shoulder_joint_span', value, rel_sd))
    if not cues:
        return {'headPx': 0.0, 'relSd': 1.0, 'cues': []}
    weights = [1.0 / max(1e-6, (rel_sd * value) ** 2) for _, value, rel_sd in cues]
    total = sum(weights)
    value = sum(weight * item[1] for weight, item in zip(weights, cues)) / total
    combined_sd = math.sqrt(1.0 / total)
    return {
        'headPx': float(value),
        'relSd': float(combined_sd / max(1e-6, value)),
        'cues': [{'cue': name, 'headPx': round(px, 1), 'relSd': round(sd, 3)} for name, px, sd in cues],
    }


# --- Hồ sơ bề ngang thân ----------------------------------------------------

LEVEL_JOINT = {'shoulder': 'shoulder', 'chest': 'shoulder', 'waist': 'shoulder', 'hip': 'hip'}
# Vai đo bideltoid — bao gồm cơ delta và cánh tay — vì `shoulder_breadth_cm` của
# model ANSUR chính là bideltoidbreadth. Cắt tay ở mức này là sai đại lượng.
LEVELS_KEEPING_ARMS = ('shoulder',)


def build_arms(keypoints):
    """Hai đường gãy cánh tay từ bộ khớp đã lọc (giá trị None bị bỏ)."""
    arms = {}
    for side in ('left', 'right'):
        polyline = arm_polyline(
            keypoints.get(f'{side}_shoulder'),
            keypoints.get(f'{side}_elbow'),
            keypoints.get(f'{side}_wrist'),
        )
        if polyline:
            arms[side] = polyline
    return arms


def torso_profile(mask, keypoints, shoulder_y, hip_y, center_x=None):
    """Bề ngang thân tại ngực/eo/hông, hợp nhất silhouette và khung xương.

    Trọng số giữa hai nguồn không đặt bằng cảm giác mà chọn bằng MAE trên split
    train của VITON-HD (xem `silhouetteWeight` trong calibration): ngang ngực,
    cơ delta và cánh tay dính liền vào thân nên silhouette sai gấp đôi khung
    xương; ngang eo thì silhouette lại tốt hơn hẳn vì bụng thật có thể rộng hơn
    hoặc hẹp hơn khung chậu.
    """
    left_shoulder, right_shoulder = keypoints.get('left_shoulder'), keypoints.get('right_shoulder')
    left_hip, right_hip = keypoints.get('left_hip'), keypoints.get('right_hip')
    shoulder_span = abs(left_shoulder[0] - right_shoulder[0]) if left_shoulder and right_shoulder else 0.0
    hip_span = abs(left_hip[0] - right_hip[0]) if left_hip and right_hip else 0.0
    joints = {'shoulder': shoulder_span, 'hip': hip_span}

    if center_x is None:
        xs = [point[0] for point in (left_shoulder, right_shoulder, left_hip, right_hip) if point]
        center_x = float(np.mean(xs)) if xs else 0.0

    span = max(1.0, hip_y - shoulder_y)
    arms = build_arms(keypoints)
    global_half = 0.5 * CALIBRATION['armBreadthOverShoulderJoint']['mean'] * shoulder_span
    weights = CALIBRATION.get('silhouetteWeight') or {}

    # Khớp chính của một mốc có thể biến mất: ảnh cắt ngang đùi khiến hai khớp
    # hông bị loại vì độ tin cậy thấp. Khi đó `skeleton_px` = 0, chốt chặn tắt,
    # và bề ngang rơi hoàn toàn về silhouette thô — chính là đường dẫn tới 80.9kg
    # cho người mà ảnh đủ chỉ ra 58.9kg. Suy mốc thay thế từ khớp còn lại.
    fallback = CALIBRATION.get('fallbackJoint') or {}
    if not hip_span and shoulder_span:
        ratio = (fallback.get('hip_from_shoulder') or {}).get('mean')
        if ratio:
            joints['hip'] = shoulder_span * ratio / float(
                (CALIBRATION['torsoOverJoint'].get('hip') or {}).get('mean') or 1.0)
            joints['hipIsFallback'] = True
    if not shoulder_span and hip_span:
        ratio = (fallback.get('waist_from_hip') or {}).get('mean')
        if ratio:
            joints['shoulder'] = hip_span * ratio / float(
                (CALIBRATION['torsoOverJoint'].get('waist') or {}).get('mean') or 1.0)
            joints['shoulderIsFallback'] = True

    profile = {}
    for level, y in (('shoulder', shoulder_y + span * 0.04),
                     ('chest', shoulder_y + span * 0.22),
                     ('waist', shoulder_y + span * 0.62),
                     ('hip', hip_y)):
        joint_span = joints.get(LEVEL_JOINT[level], 0.0)
        stats = CALIBRATION['torsoOverJoint'].get(level) or {}
        skeleton_px = joint_span * float(stats.get('mean') or 0.0)

        # Không đo được bề ngang ở đúng hàng mà cơ thể bị CẮT KHỎI KHUNG HÌNH.
        # Ảnh cắt ngang đùi đặt hàng đo hông cách đáy mask 4%: ở đó dải mask là
        # mặt cắt ngang của thân + tay + váy, rộng hơn hẳn bề ngang hông thật.
        # Đo trên một ảnh và bản cắt 62% của chính nó: 58.9kg -> 80.9kg.
        near_edge = False
        if mask is not None:
            rows = np.flatnonzero(mask.any(axis=1))
            if rows.size:
                bottom = float(rows[-1])
                extent = max(1.0, bottom - float(rows[0]))
                near_edge = (bottom - y) < extent * 0.06

        band = None
        if mask is not None and global_half > 0 and not near_edge:
            band = torso_width_band(mask, y, span * 0.08, center_x,
                                    {} if level in LEVELS_KEEPING_ARMS else arms, global_half)
        silhouette_px = float(band['widthPx']) if band else 0.0
        gated = gate_torso_width(silhouette_px, level, joint_span) if silhouette_px else \
            {'widthPx': 0.0, 'gated': False, 'reason': 'no_silhouette'}

        weight = float(weights.get(level, 0.5)) if silhouette_px else 0.0
        if not skeleton_px:
            weight = 1.0 if silhouette_px else 0.0
        if (band and not band['armsCarved'] and level != 'chest' and skeleton_px
                and level not in LEVELS_KEEPING_ARMS):
            # Không cắt được tay ở hàng nào thì bề ngang đó vẫn có thể còn tay
            # trong đó; hạ trọng số thay vì tin như đã tách sạch.
            weight *= 0.5
        value = weight * gated['widthPx'] + (1.0 - weight) * skeleton_px
        profile[level] = {
            'widthPx': round(float(value), 2),
            'jointIsFallback': bool(joints.get(f'{LEVEL_JOINT[level]}IsFallback')),
            'rowNearMaskEdge': bool(near_edge),
            'silhouettePx': round(silhouette_px, 2),
            'rawSilhouettePx': round(float(band['rawPx']), 2) if band else 0.0,
            'skeletonPx': round(skeleton_px, 2),
            'silhouetteWeight': round(weight, 3),
            'armsCarved': bool(band and band['armsCarved']),
            'skeletonGated': bool(gated.get('gated')),
            'gateReason': gated.get('reason'),
            'jointSpanPx': round(joint_span, 2),
            'measuredAtY': round(float(y), 1),
        }
    profile['shoulderJointSpanPx'] = round(shoulder_span, 2)
    profile['hipJointSpanPx'] = round(hip_span, 2)
    profile['armHalfWidthPx'] = round(global_half, 2)
    return profile
