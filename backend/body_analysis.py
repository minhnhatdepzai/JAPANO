"""Phân tích vóc dáng từ MỘT ảnh RGB cho JAPANO Try-On.

Module này trả lời ba câu hỏi cho pipeline thử đồ:

  1. Hình dạng cơ thể trong ảnh ra sao (vai, hông, thân, chân, tỉ lệ bề ngang)?
  2. Chiều cao ước lượng là bao nhiêu — và ước lượng đó có đáng tin không?
  3. Cân nặng ước lượng là bao nhiêu — dưới dạng KHOẢNG, không phải một con số?

Giới hạn phải nói thẳng: một ảnh 2D không có vật chuẩn thì KHÔNG cho phép suy
ra chiều cao tuyệt đối chính xác. Vì vậy có hai chế độ:

  Mode B (scaleReference='user_height' | 'reference_object'):
      có thông tin chuẩn -> quy đổi pixel sang cm chính xác, độ tin cậy cao.
  Mode A (scaleReference=None):
      neo tỉ lệ vào chiều dài đầu người trưởng thành (vertex→cằm ≈ 23.4cm,
      độ lệch chuẩn ~1cm — hằng số nhân trắc ổn định nhất có thể đo trên ảnh),
      chỉ trả về KHOẢNG kèm confidence; confidence thấp thì trả None.

Không load thêm model nặng: dùng lại YOLOv8n-pose đã có trong accessory_pipeline
và (tuỳ chọn) mặt nạ nền rembg vốn đã được cài cho phụ kiện.
"""

import json
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
TRAINED_MODEL_PATH = Path(
    os.getenv('JAPANO_BODY_ESTIMATOR_MODEL', str(ROOT / 'ai_training/models/body_weight_estimator.joblib'))
)

# --- Hằng số nhân trắc -------------------------------------------------------
# Mặc định là bảng Drillis & Contini (1966). Nếu đã chạy
# `backend/ai_training/train_body_estimator.py --ansur`, các giá trị này được
# THAY bằng tỉ lệ fit trên 6.068 người thật của ANSUR II (CC0-1.0) — xem
# `ai_training/models/anthropometry.json`. Tỉ lệ mắt và mắt cá vẫn giữ bảng cũ
# vì ANSUR không đo hai mốc đó.
STATURE_FRACTION_FROM_TOP = {
    'eye': 0.064,
    'shoulder': 0.182,
    'hip': 0.470,
    'knee': 0.715,
    'ankle': 0.961,
}
STATURE_FRACTION_SD = {}
ANTHROPOMETRY_SOURCE = 'drillis-contini-1966'
# Chiều dài đầu (đỉnh đầu → cằm) người trưởng thành: ~23.4cm không tính tóc.
# Trên ẢNH thì "đỉnh đầu" luôn là đỉnh tóc, nên hằng số dùng ở đây là bản có
# tóc (~24cm) — đây cũng chính là chiều dài đầu mà quy tắc "cơ thể cao 7.5 đầu"
# ngầm giả định.
HEAD_LENGTH_CM = float(os.getenv('JAPANO_HEAD_LENGTH_CM', '24.0'))
# Tỉ lệ đỉnh đầu → đường mắt trên tổng chiều dài đầu. Giá trị giải phẫu thuần
# (không tóc) là ~0.49; đo trên ảnh thật với đỉnh tóc làm mốc thì rơi vào
# 0.52–0.62 tuỳ kiểu tóc. Lấy 0.55 làm trung bình — chọn 0.45 như trước khiến
# đầu bị đo to hơn thực tế ~20% và chiều cao bị hụt cả chục cm.
VERTEX_TO_EYE_RATIO = float(os.getenv('JAPANO_VERTEX_TO_EYE_RATIO', '0.55'))
VERTEX_TO_NOSE_RATIO = 0.67
# Tỉ lệ chiều sâu / chiều rộng của lát cắt cơ thể khi dựng khối elip. Ảnh chính
# diện chỉ thấy bề ngang, bề dày phải giả định theo vùng cơ thể.
# Tỉ lệ độ sâu/bề ngang. Số mặc định là ước lượng thô dùng chung cho cả thân;
# ANSUR II cho thấy thực tế khác nhau rõ theo từng mốc (ngực 0.89, eo 0.72,
# hông 0.69), nên khi có file anthropometry.json thì dùng số thật.
DEPTH_RATIO = {'head': 1.12, 'torso': 0.74, 'limb': 1.0}
TORSO_DEPTH_BY_LEVEL = {'chest': 0.74, 'waist': 0.74, 'hip': 0.74}
BODY_DENSITY_KG_PER_L = float(os.getenv('JAPANO_BODY_DENSITY', '1.01'))
# Hệ số hiệu chỉnh thể tích. Mô hình lát cắt elip luôn ƯỚC LƯỢNG THỪA: tiết diện
# thật của cơ thể nhỏ hơn hình elip bao quanh nó (eo thóp vào, cổ, khe giữa hai
# chân), và đường viền đo được còn cộng thêm độ dày của quần áo. Đo thử trên ảnh
# người thật cho thấy mức thừa khoảng 20–25%.
#
# Đây là hằng số hiệu chuẩn, KHÔNG phải hằng số vật lý — khi có tập ảnh kèm cân
# nặng thật, hãy fit lại bằng backend/ai_training/train_body_estimator.py và ưu
# tiên dùng model đó thay cho công thức này.
VOLUME_CALIBRATION = float(os.getenv('JAPANO_BODY_VOLUME_CALIBRATION', '0.78'))


def _load_anthropometry():
    """Nạp tỉ lệ nhân trắc đã fit trên dữ liệu thật, nếu đã train."""
    global STATURE_FRACTION_FROM_TOP, STATURE_FRACTION_SD, ANTHROPOMETRY_SOURCE
    global TORSO_DEPTH_BY_LEVEL, DEPTH_RATIO
    path = Path(os.getenv(
        'JAPANO_ANTHROPOMETRY_JSON',
        str(ROOT / 'ai_training/models/anthropometry.json'),
    ))
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return False
    for name, stats in (data.get('statureFractionFromTop') or {}).items():
        if name in STATURE_FRACTION_FROM_TOP and stats.get('mean'):
            STATURE_FRACTION_FROM_TOP[name] = float(stats['mean'])
            STATURE_FRACTION_SD[name] = float(stats.get('sd') or 0)
    depths = data.get('depthOverBreadth') or {}
    for level in ('chest', 'waist', 'hip'):
        if depths.get(level, {}).get('mean'):
            TORSO_DEPTH_BY_LEVEL[level] = float(depths[level]['mean'])
    if TORSO_DEPTH_BY_LEVEL:
        # Mô hình thể tích dùng một tỉ lệ chung cho thân; lấy trung bình ba mốc.
        DEPTH_RATIO['torso'] = round(sum(TORSO_DEPTH_BY_LEVEL.values()) / 3, 4)
    ANTHROPOMETRY_SOURCE = data.get('source', 'fitted')
    return True


ANTHROPOMETRY_FITTED = _load_anthropometry()


def _load_joblib(env_name, default_relative):
    path = Path(os.getenv(env_name, str(ROOT / default_relative)))
    if not path.exists():
        return None
    try:
        import joblib
        return joblib.load(path)
    except Exception:
        return None


def _num(value):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return 0.0
    return parsed if math.isfinite(parsed) and parsed > 0 else 0.0


def _clamp(value, low, high):
    return max(low, min(high, value))


def _point(keypoints, name, inferred=()):
    """Toạ độ một khớp — bỏ qua khớp do accessory_pipeline BÙ ra từ tỉ lệ box.

    `analyze()` tự điền các khớp bị khuất để pipeline phụ kiện luôn có đủ điểm
    neo. Với việc ĐO ĐẠC thì những điểm đó vô dụng, thậm chí nguy hiểm: một tấm
    ảnh cắt ngang đùi vẫn có "mắt cá chân" nằm ở 96% chiều cao box, khiến hệ
    thống tưởng nhìn thấy cả người và tự tin hẳn lên.
    """
    if name in inferred:
        return None
    value = (keypoints or {}).get(name)
    if not value or len(value) < 2:
        return None
    return (float(value[0]), float(value[1]))


def _mid(a, b):
    if a and b:
        return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)
    return a or b


def person_mask(image, box=None):
    """Mặt nạ nhị phân của người chính. Trả None nếu không tách được nền.

    rembg (U2Net) đã có sẵn trong môi trường cho pipeline phụ kiện, nên không
    tải thêm model phân đoạn nào khác. Nếu thiếu, toàn bộ ước lượng vẫn chạy
    được bằng keypoint, chỉ giảm độ tin cậy.
    """
    try:
        from rembg import remove
    except Exception:
        return None
    try:
        cutout = remove(image.convert('RGBA'))
    except Exception:
        return None
    alpha = np.asarray(cutout.convert('RGBA'))[:, :, 3]
    mask = alpha > 96
    if box:
        x1, y1, x2, y2 = [int(max(0, value)) for value in box]
        limited = np.zeros_like(mask)
        y2 = min(mask.shape[0], max(y1 + 1, y2))
        x2 = min(mask.shape[1], max(x1 + 1, x2))
        # Nới ngang một chút: tay dang hoặc áo rộng có thể vượt ra ngoài box.
        pad = int((x2 - x1) * 0.12)
        limited[y1:y2, max(0, x1 - pad):min(mask.shape[1], x2 + pad)] = mask[y1:y2, max(0, x1 - pad):min(mask.shape[1], x2 + pad)]
        mask = limited
    if not mask.any():
        return None
    return mask


def _largest_component(mask):
    """Giữ lại vùng liên thông lớn nhất — loại bóng, người phụ, vật thể nền."""
    try:
        from scipy import ndimage
    except Exception:
        return mask
    labels, count = ndimage.label(mask)
    if count <= 1:
        return mask
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    return labels == (int(np.argmax(sizes)) + 1)


def _row_runs(row):
    """Các đoạn pixel liên tục trong một hàng của mặt nạ: [(start, end), ...]."""
    indices = np.flatnonzero(row)
    if indices.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(indices) > 1)
    starts = np.concatenate(([indices[0]], indices[breaks + 1]))
    ends = np.concatenate((indices[breaks], [indices[-1]]))
    return list(zip(starts.tolist(), ends.tolist()))


def _width_at(mask, y, center_x):
    """Bề ngang (pixel) của thân người tại hàng y — chọn đoạn chứa trục thân."""
    if mask is None:
        return 0.0
    y = int(_clamp(int(y), 0, mask.shape[0] - 1))
    runs = _row_runs(mask[y])
    if not runs:
        return 0.0
    best = min(runs, key=lambda run: abs((run[0] + run[1]) / 2.0 - center_x))
    return float(best[1] - best[0] + 1)


def _torso_width_over_band(mask, y_from, y_to, center_x, samples=9):
    """Bề ngang THÂN NGƯỜI trên một dải hàng, loại ảnh hưởng của hai cánh tay.

    Ở ngang ngực, tay buông thường dính liền vào thân nên một hàng pixel chỉ có
    MỘT đoạn liên tục gồm cả tay lẫn thân. Đo như vậy cho ra bề ngang ngực
    ~46cm ở một người mẫu gầy — vượt xa phân bố nhân trắc thật (ANSUR: 27cm) và
    khiến model hồi quy ngoại suy thành người nặng 107kg.

    Cách xử lý: quét nhiều hàng trong dải, hàng nào tách được ba đoạn
    (tay | thân | tay) thì lấy đoạn giữa; hàng nào dính liền thì bỏ qua nếu còn
    hàng sạch hơn. Lấy giá trị NHỎ NHẤT trong dải vì tay chỉ có thể làm bề ngang
    đo được rộng ra, không bao giờ hẹp lại.
    """
    if mask is None:
        return 0.0
    y_from, y_to = int(min(y_from, y_to)), int(max(y_from, y_to))
    if y_to <= y_from:
        return _width_at(mask, y_from, center_x)
    separated, merged = [], []
    for index in range(samples):
        y = int(_clamp(y_from + (y_to - y_from) * index / max(1, samples - 1), 0, mask.shape[0] - 1))
        runs = _row_runs(mask[y])
        if not runs:
            continue
        central = min(runs, key=lambda run: abs((run[0] + run[1]) / 2.0 - center_x))
        width = float(central[1] - central[0] + 1)
        (separated if len(runs) >= 3 else merged).append(width)
    if separated:
        return float(np.median(separated))
    return min(merged) if merged else 0.0


def _vertex_y(mask, box, head_x, head_half_width):
    """Toạ độ đỉnh đầu: hàng có pixel người cao nhất trong dải ngang quanh đầu."""
    if mask is not None:
        x1 = int(_clamp(head_x - head_half_width, 0, mask.shape[1] - 1))
        x2 = int(_clamp(head_x + head_half_width, x1 + 1, mask.shape[1]))
        band = mask[:, x1:x2]
        rows = np.flatnonzero(band.any(axis=1))
        if rows.size:
            return float(rows[0])
    return float(box[1]) if box else 0.0


def _ellipse_area_cm2(width_cm, depth_ratio):
    depth_cm = width_cm * depth_ratio
    return math.pi / 4.0 * width_cm * depth_cm


def measure_body(image, pose):
    """Đo các đại lượng hình học của cơ thể trong ảnh (đơn vị pixel + tỉ lệ)."""
    box = [float(value) for value in (pose.get('box') or [0, 0, image.width, image.height])]
    keypoints = pose.get('keypoints') or {}
    inferred = set(pose.get('inferredKeypoints') or ())
    mask = person_mask(image, box)
    if mask is not None:
        mask = _largest_component(mask)

    left_shoulder = _point(keypoints, 'left_shoulder', inferred)
    right_shoulder = _point(keypoints, 'right_shoulder', inferred)
    left_hip = _point(keypoints, 'left_hip', inferred)
    right_hip = _point(keypoints, 'right_hip', inferred)
    left_eye = _point(keypoints, 'left_eye', inferred)
    right_eye = _point(keypoints, 'right_eye', inferred)
    nose = _point(keypoints, 'nose', inferred)
    ankles = [_point(keypoints, 'left_ankle', inferred), _point(keypoints, 'right_ankle', inferred)]
    knees = [_point(keypoints, 'left_knee', inferred), _point(keypoints, 'right_knee', inferred)]

    shoulder_mid = _mid(left_shoulder, right_shoulder)
    hip_mid = _mid(left_hip, right_hip)
    eye_mid = _mid(left_eye, right_eye)
    center_x = (shoulder_mid or hip_mid or ((box[0] + box[2]) / 2.0, 0))[0]

    head_reference = eye_mid or nose or (center_x, box[1])
    head_half_width = max(12.0, (box[2] - box[0]) * 0.18)
    vertex_y = _vertex_y(mask, box, head_reference[0], head_half_width)

    # Chiều dài đầu theo pixel — neo tỉ lệ quan trọng nhất của Mode A.
    head_px = 0.0
    if eye_mid and eye_mid[1] > vertex_y:
        head_px = (eye_mid[1] - vertex_y) / VERTEX_TO_EYE_RATIO
    elif nose and nose[1] > vertex_y:
        head_px = (nose[1] - vertex_y) / VERTEX_TO_NOSE_RATIO

    # Chiều cao pixel: ưu tiên mốc thấp nhất còn nhìn thấy, quy về toàn thân
    # bằng bảng tỉ lệ nhân trắc.
    stature_px = 0.0
    coverage = 'partial'
    visible_ankles = [point for point in ankles if point]
    visible_knees = [point for point in knees if point]
    if visible_ankles:
        ankle_y = max(point[1] for point in visible_ankles)
        stature_px = (ankle_y - vertex_y) / STATURE_FRACTION_FROM_TOP['ankle']
        coverage = 'full'
    elif visible_knees:
        knee_y = max(point[1] for point in visible_knees)
        stature_px = (knee_y - vertex_y) / STATURE_FRACTION_FROM_TOP['knee']
        coverage = 'knee'
    elif hip_mid:
        stature_px = (hip_mid[1] - vertex_y) / STATURE_FRACTION_FROM_TOP['hip']
        coverage = 'hip'
    elif shoulder_mid:
        stature_px = (shoulder_mid[1] - vertex_y) / STATURE_FRACTION_FROM_TOP['shoulder']
        coverage = 'shoulder'
    stature_px = max(1.0, stature_px)

    # Bề ngang thật của thân người: silhouette đo chính xác hơn khoảng cách khớp
    # vai/hông (khớp nằm bên trong cơ thể, luôn hẹp hơn đường viền ngoài).
    shoulder_y = shoulder_mid[1] if shoulder_mid else vertex_y + stature_px * STATURE_FRACTION_FROM_TOP['shoulder']
    hip_y = hip_mid[1] if hip_mid else vertex_y + stature_px * STATURE_FRACTION_FROM_TOP['hip']
    torso_span = max(1.0, hip_y - shoulder_y)
    bust_y = shoulder_y + torso_span * 0.22
    waist_y = shoulder_y + torso_span * 0.62

    shoulder_px = _width_at(mask, shoulder_y + torso_span * 0.04, center_x)
    # Ngực đo trên cả một dải quanh đường ngực để loại được hai cánh tay.
    bust_px = _torso_width_over_band(mask, bust_y - torso_span * 0.10, bust_y + torso_span * 0.10, center_x)
    waist_px = _width_at(mask, waist_y, center_x)
    hip_px = _width_at(mask, hip_y, center_x)
    if not shoulder_px and left_shoulder and right_shoulder:
        # Không có silhouette: quy đổi khoảng cách hai khớp vai ra bề ngang
        # ngoài (hệ số nhân trắc ~1.16 cho phần mềm + cơ delta).
        shoulder_px = abs(left_shoulder[0] - right_shoulder[0]) * 1.16
    if not hip_px and left_hip and right_hip:
        hip_px = abs(left_hip[0] - right_hip[0]) * 1.35

    torso_px = max(1.0, hip_y - shoulder_y)
    leg_px = 0.0
    if visible_ankles:
        leg_px = max(point[1] for point in visible_ankles) - hip_y
    elif visible_knees:
        leg_px = (max(point[1] for point in visible_knees) - hip_y) * 1.9

    # Độ nghiêng vai: ảnh chụp nghiêng/quay ngang làm mọi bề ngang bị co lại.
    tilt = 0.0
    if left_shoulder and right_shoulder:
        dx = abs(left_shoulder[0] - right_shoulder[0])
        dy = abs(left_shoulder[1] - right_shoulder[1])
        tilt = math.degrees(math.atan2(dy, max(1.0, dx)))

    mean_torso_px = float(np.mean([value for value in (bust_px, waist_px, hip_px) if value] or [0.0]))

    # Đường viền ngoài của một người MẶC QUẦN ÁO là đường viền của quần áo. Khi
    # silhouette rộng hơn hẳn khoảng cách khớp vai/hông, người đó đang mặc đồ
    # rộng và mọi số đo suy từ silhouette đều bị phồng lên. Không có cách nào
    # sửa được điều đó từ một ảnh 2D — chỉ có thể phát hiện và nói ra.
    clothing_slack = 1.0
    if left_shoulder and right_shoulder and shoulder_px:
        joint_span = abs(left_shoulder[0] - right_shoulder[0]) * 1.16
        if joint_span > 1:
            clothing_slack = max(clothing_slack, float(mean_torso_px / joint_span) if mean_torso_px else 1.0)

    return {
        'mask': mask,
        'box': box,
        'centerX': center_x,
        'vertexY': vertex_y,
        'headPx': head_px,
        'staturePx': stature_px,
        'coverage': coverage,
        'shoulderY': shoulder_y,
        'hipY': hip_y,
        'bustY': bust_y,
        'waistY': waist_y,
        'shoulderPx': shoulder_px,
        'bustPx': bust_px,
        'waistPx': waist_px,
        'hipPx': hip_px,
        'torsoPx': torso_px,
        'legPx': leg_px,
        'meanTorsoPx': mean_torso_px,
        'tiltDeg': tilt,
        'clothingSlack': round(clothing_slack, 3),
        'headVisible': bool(eye_mid or nose),
        'feetVisible': bool(visible_ankles),
        'hasMask': mask is not None,
    }


def body_shape_ratios(measure):
    stature = max(1.0, measure['staturePx'])
    shoulder = measure['shoulderPx']
    hip = measure['hipPx']
    return {
        'shoulderWidthRatio': round(shoulder / stature, 4) if shoulder else 0.0,
        'hipWidthRatio': round(hip / stature, 4) if hip else 0.0,
        'torsoRatio': round(measure['torsoPx'] / stature, 4),
        'legRatio': round(measure['legPx'] / stature, 4) if measure['legPx'] else 0.0,
        'bodyWidthRatio': round(measure['meanTorsoPx'] / stature, 4) if measure['meanTorsoPx'] else 0.0,
        'shoulderHipRatio': round(shoulder / hip, 4) if shoulder and hip else 0.0,
    }


def pose_quality(pose, measure):
    """Điểm 0..1 cho biết ảnh này đáng tin tới đâu cho việc đo đạc."""
    score = float(pose.get('confidence') or 0.0)
    # Ảnh cắt ngang thân buộc phải ngoại suy chiều cao, sai số tăng nhanh theo
    # mức cắt — nên phần thưởng độ phủ giảm mạnh, và ảnh chỉ thấy tới vai thì
    # gần như không còn đáng tin.
    coverage_bonus = {'full': 0.30, 'knee': 0.14, 'hip': 0.02, 'shoulder': -0.10, 'partial': -0.15}
    score = score * 0.55 + coverage_bonus.get(measure['coverage'], 0.0) + (0.14 if measure['hasMask'] else 0.0)
    if measure['headVisible']:
        score += 0.08
    if measure['headPx'] <= 0:
        score -= 0.16
    # Nghiêng người/nghiêng máy làm bề ngang sai lệch mạnh.
    score -= _clamp(measure['tiltDeg'] / 90.0, 0.0, 1.0) * 0.22
    if pose.get('fallback'):
        score -= 0.4
    return round(_clamp(score, 0.0, 1.0), 3)


def estimate_height(measure, quality, user_height_cm=0.0, reference=None):
    """Ước lượng chiều cao. Mode B khi có mốc chuẩn, Mode A khi chỉ có ảnh."""
    min_confidence = float(os.getenv('JAPANO_BODY_ESTIMATE_MIN_CONFIDENCE', '0.35'))

    if user_height_cm:
        return {
            'valueCm': round(user_height_cm, 1),
            'minCm': round(user_height_cm, 1),
            'maxCm': round(user_height_cm, 1),
            'confidence': 1.0,
            'mode': 'B',
            'source': 'user_provided',
            'method': 'người dùng nhập trực tiếp',
        }

    # Mode B với vật chuẩn: {'pixelLength': .., 'realLengthCm': ..}
    if reference and _num(reference.get('pixelLength')) and _num(reference.get('realLengthCm')):
        px_per_cm = _num(reference['pixelLength']) / _num(reference['realLengthCm'])
        value = measure['staturePx'] / px_per_cm
        spread = value * (0.03 + 0.05 * (1.0 - quality))
        return {
            'valueCm': round(value, 1),
            'minCm': round(value - spread, 1),
            'maxCm': round(value + spread, 1),
            'confidence': round(_clamp(0.55 + quality * 0.4, 0.0, 0.95), 3),
            'mode': 'B',
            'source': 'reference_object',
            'method': 'quy đổi theo vật chuẩn trong ảnh',
        }

    # Mode A: neo vào chiều dài đầu.
    if measure['headPx'] <= 0 or quality < min_confidence:
        return {
            'valueCm': None,
            'minCm': None,
            'maxCm': None,
            'confidence': round(quality, 3),
            'mode': 'A',
            'source': 'image_estimate',
            'method': 'không đủ dữ liệu để ước lượng đáng tin cậy',
        }
    head_count = measure['staturePx'] / measure['headPx']
    # Người trưởng thành cao khoảng 7.0–8.0 lần chiều dài đầu; kiểu tóc và góc
    # máy đẩy con số này ra ngoài một chút nên vẫn chấp nhận dải 6.4–8.6 (kéo về
    # biên, hạ tin cậy).
    #
    # Nhưng lệch HẲN khỏi dải đó thì phép đo đã hỏng, thường vì hai lý do rất
    # thật: ảnh chụp gần khiến đầu bị phóng đại do phối cảnh, hoặc ảnh bị cắt
    # ngang thân nên chiều cao phải ngoại suy. Lúc đó câu trả lời đúng là "không
    # đủ dữ liệu" — kéo về biên rồi trả một con số trông hợp lý mới là bịa.
    if head_count < 6.0 or head_count > 9.0:
        return {
            'valueCm': None,
            'minCm': None,
            'maxCm': None,
            'confidence': round(_clamp(quality * 0.4, 0.0, 0.34), 3),
            'mode': 'A',
            'source': 'image_estimate',
            'method': f'tỉ lệ đầu/thân đo được ({round(head_count, 2)}) nằm ngoài dải hợp lý — '
                      'ảnh chụp quá gần hoặc bị cắt thân',
        }
    clamped = _clamp(head_count, 6.4, 8.6)
    penalty = 0.18 if abs(clamped - head_count) > 0.01 else 0.0
    value = clamped * HEAD_LENGTH_CM
    confidence = _clamp(quality * 0.8 - penalty, 0.0, 0.8)
    if confidence < min_confidence:
        return {
            'valueCm': None,
            'minCm': None,
            'maxCm': None,
            'confidence': round(confidence, 3),
            'mode': 'A',
            'source': 'image_estimate',
            'method': 'không đủ dữ liệu để ước lượng đáng tin cậy',
        }
    # Sai số gồm: SD chiều dài đầu (~4.3%) + sai số tư thế/ống kính.
    spread = value * (0.045 + 0.06 * (1.0 - confidence))
    return {
        'valueCm': round(value, 1),
        'minCm': round(value - spread, 1),
        'maxCm': round(value + spread, 1),
        'confidence': round(confidence, 3),
        'mode': 'A',
        'source': 'image_estimate',
        'method': f'neo theo chiều dài đầu ({round(head_count, 2)} đầu/thân)',
    }


def volumetric_weight(measure, px_per_cm):
    """Cân nặng theo mô hình khối: mỗi hàng pixel là một lát cắt elip.

    Ảnh chính diện chỉ cho bề ngang, nên bề dày được giả định theo vùng cơ thể
    (đầu gần tròn, thân dẹt, tay/chân gần tròn). Đây là ước lượng thể tích, sai
    số tăng khi mặc đồ dày hoặc tay ép sát thân.
    """
    mask = measure['mask']
    if mask is None or px_per_cm <= 0:
        return 0.0
    row_height_cm = 1.0 / px_per_cm
    shoulder_y, hip_y = measure['shoulderY'], measure['hipY']
    center_x = measure['centerX']
    volume_cm3 = 0.0
    rows = np.flatnonzero(mask.any(axis=1))
    for y in rows:
        runs = _row_runs(mask[y])
        if not runs:
            continue
        torso_run = min(runs, key=lambda run: abs((run[0] + run[1]) / 2.0 - center_x))
        for run in runs:
            width_cm = (run[1] - run[0] + 1) / px_per_cm
            if y < shoulder_y:
                ratio = DEPTH_RATIO['head']
            elif run is torso_run and y <= hip_y:
                ratio = DEPTH_RATIO['torso']
            else:
                ratio = DEPTH_RATIO['limb']
            volume_cm3 += _ellipse_area_cm2(width_cm, ratio) * row_height_cm
    return volume_cm3 / 1000.0 * BODY_DENSITY_KG_PER_L * VOLUME_CALIBRATION


def ratio_weight(shape, height_cm):
    """Dự phòng khi không có silhouette: suy BMI từ tỉ lệ bề ngang thân/chiều cao.

    Hiệu chuẩn: người trưởng thành BMI ~21 có bề ngang thân trung bình khoảng
    0.19 lần chiều cao (ví dụ cao 170cm, bề ngang thân ~32cm). Hệ số 130 lấy từ
    quan hệ xấp xỉ tuyến tính giữa bề ngang thân và BMI trong dải 18–35.
    Đây là ước lượng thô, chỉ dùng khi KHÔNG tách được nền.
    """
    ratio = shape.get('bodyWidthRatio') or shape.get('shoulderWidthRatio') or 0.0
    if not ratio or not height_cm:
        return 0.0
    bmi = _clamp(21.0 + (ratio - 0.19) * 130.0, 14.0, 48.0)
    return bmi * (height_cm / 100.0) ** 2


_WEIGHT_BUNDLE = None
_GIRTH_BUNDLE = None


def load_trained_estimator():
    """Model hồi quy cân nặng đã train trên ANSUR II (nếu có).

    Đầu vào của model là SỐ ĐO VẬT LÝ (chiều cao + bốn bề ngang, đơn vị cm) —
    đúng những đại lượng đo được từ ảnh chính diện. Sai số công bố của model
    (~3.1 kg) là sai số của riêng bước hồi quy; sai số đo pixel→cm nằm ngoài
    con số đó. Xem ai_training/models/body_estimator.metrics.json.
    """
    global _WEIGHT_BUNDLE
    if _WEIGHT_BUNDLE is None:
        _WEIGHT_BUNDLE = _load_joblib(
            'JAPANO_BODY_ESTIMATOR_MODEL', 'ai_training/models/body_weight_estimator.joblib') or False
    return _WEIGHT_BUNDLE or None


def load_girth_estimators():
    """Model bề ngang → vòng đo. Thay cho phép xấp xỉ elip Ramanujan."""
    global _GIRTH_BUNDLE
    if _GIRTH_BUNDLE is None:
        _GIRTH_BUNDLE = _load_joblib(
            'JAPANO_BODY_GIRTH_MODEL', 'ai_training/models/body_girth_estimators.joblib') or False
    return _GIRTH_BUNDLE or None


BREADTH_DISTRIBUTION = {}


def _load_breadth_distribution():
    path = Path(os.getenv('JAPANO_ANTHROPOMETRY_JSON', str(ROOT / 'ai_training/models/anthropometry.json')))
    if not path.exists():
        return {}
    try:
        return (json.loads(path.read_text(encoding='utf-8')).get('breadthOverStature') or {})
    except Exception:
        return {}


BREADTH_DISTRIBUTION = _load_breadth_distribution()


def features_in_distribution(features, sigma=3.0):
    """Đầu vào có nằm trong phân bố mà model được train hay không.

    Đây là chốt chặn quan trọng nhất của cả nhánh học máy. Model ANSUR II học
    trên bề ngang CƠ THỂ TRẦN đo bằng thước; ảnh chính diện lại cho bề ngang
    SILHOUETTE gồm cả quần áo và hai cánh tay dính vào thân. Với người mặc áo
    phom rộng, bề ngang ngực đo được ~0.25 lần chiều cao trong khi ANSUR chỉ
    0.165 ± 0.011 — lệch hơn 8 độ lệch chuẩn.

    Đưa đầu vào lệch miền như vậy vào model là ngoại suy mù: đo thử trên ảnh
    thật cho ra 107kg cho một người mẫu khoảng 55kg. Vì vậy khi đầu vào ra ngoài
    ±3SD, hệ thống KHÔNG dùng model mà quay về mô hình thể tích và hạ độ tin cậy.
    """
    if not BREADTH_DISTRIBUTION or not features:
        return False, ['no_distribution_reference']
    height = features[0]
    if height <= 0:
        return False, ['no_height']
    outside = []
    for name, value in zip(('shoulder', 'chest', 'waist', 'hip'), features[1:]):
        stats = BREADTH_DISTRIBUTION.get(name)
        if not stats:
            continue
        ratio = value / height
        deviation = abs(ratio - stats['mean']) / max(1e-6, stats['sd'])
        if deviation > sigma:
            outside.append(f'{name}:{ratio:.3f}~{deviation:.1f}sd')
    return (not outside), outside


def measurement_features(measure, height_cm):
    """Năm đại lượng model cần, quy từ pixel sang cm."""
    if not height_cm or measure['staturePx'] <= 0:
        return None
    px_per_cm = measure['staturePx'] / height_cm
    if px_per_cm <= 0:
        return None
    widths = [measure['shoulderPx'], measure['bustPx'], measure['waistPx'], measure['hipPx']]
    if not all(widths):
        return None
    return [height_cm] + [value / px_per_cm for value in widths]


def estimate_weight(measure, shape, height, quality, user_weight_kg=0.0):
    if user_weight_kg:
        return {
            'valueKg': round(user_weight_kg, 1),
            'minKg': round(user_weight_kg, 1),
            'maxKg': round(user_weight_kg, 1),
            'confidence': 1.0,
            'source': 'user_provided',
            'model': 'user_provided',
        }
    height_cm = height.get('valueCm') or 0.0
    min_confidence = float(os.getenv('JAPANO_BODY_ESTIMATE_MIN_CONFIDENCE', '0.35'))
    # Không thể cân một cơ thể chỉ nhìn thấy một phần.
    #
    # Ảnh cắt ngang đùi vẫn suy ra được chiều cao (ngoại suy theo tỉ lệ), nhưng
    # thể tích thì không: phần cơ thể bị cắt không có trong mặt nạ, còn phần
    # nhìn thấy lại bị phối cảnh của ống kính gần phóng to lên. Đo thử trên ảnh
    # thật cho ra những con số lệch tới 60kg. Thà nói "không đủ dữ liệu".
    if measure['coverage'] != 'full':
        return {
            'valueKg': None,
            'minKg': None,
            'maxKg': None,
            'confidence': round(min(quality * 0.5, 0.34), 3),
            'source': 'image_estimate',
            'model': 'partial_body_not_measurable',
        }
    if not height_cm or quality < min_confidence:
        # Không có thang đo cm thì không thể quy thể tích ra kg. Độ tin cậy phải
        # phản ánh đúng điều đó, không được lấy điểm chất lượng tư thế làm bình
        # phong cho một giá trị null.
        return {
            'valueKg': None,
            'minKg': None,
            'maxKg': None,
            'confidence': round(min(quality * 0.8, float(height.get('confidence') or 0.0)), 3),
            'source': 'image_estimate',
            'model': 'insufficient_data',
        }

    px_per_cm = measure['staturePx'] / height_cm
    estimates = []
    model_name = 'volumetric-anthropometric'

    trained = load_trained_estimator()
    features = measurement_features(measure, height_cm)
    in_distribution, outside = features_in_distribution(features) if features else (False, ['no_features'])
    if trained is not None and features is not None and in_distribution:
        try:
            predicted = float(trained['model'].predict(np.array([features]))[0])
            if 25.0 <= predicted <= 200.0:
                # Model train trên số đo thật đáng tin hơn hẳn mô hình thể tích
                # tự chế, nên nó là ước lượng CHÍNH khi dùng được.
                estimates.append(predicted)
                model_name = 'ansur2-regressor'
        except Exception:
            pass

    # Mô hình thể tích và công thức tỉ lệ chỉ còn là phương án DỰ PHÒNG cho
    # trường hợp chưa train model hoặc thiếu bề ngang. Trộn chúng vào khi đã có
    # model train trên 6.068 người thật chỉ kéo kết quả xấu đi.
    if not estimates:
        volumetric = volumetric_weight(measure, px_per_cm)
        if volumetric:
            estimates.append(volumetric)
        else:
            fallback = ratio_weight(shape, height_cm)
            if fallback:
                estimates.append(fallback)
    if not estimates:
        return {
            'valueKg': None,
            'minKg': None,
            'maxKg': None,
            'confidence': round(quality * 0.6, 3),
            'source': 'image_estimate',
            'model': 'insufficient_data',
        }

    value = float(np.mean(estimates))
    # Chặn theo BMI hợp lệ để một mặt nạ lỗi không tạo ra con số phi lý.
    value = _clamp(value, 12.0 * (height_cm / 100.0) ** 2, 50.0 * (height_cm / 100.0) ** 2)
    # Đồ rộng làm silhouette phồng lên; thể tích tính ra sẽ lớn hơn cơ thể thật.
    slack = float(measure.get('clothingSlack') or 1.0)
    slack_penalty = _clamp((slack - 1.15) * 1.2, 0.0, 0.45)
    confidence = _clamp(
        quality * (0.75 if measure['hasMask'] else 0.5) * height.get('confidence', 0.5) ** 0.5 * (1.0 - slack_penalty),
        0.0, 0.8,
    )
    if confidence < min_confidence:
        return {
            'valueKg': None,
            'minKg': None,
            'maxKg': None,
            'confidence': round(confidence, 3),
            'source': 'image_estimate',
            'model': model_name,
        }
    # Khoảng tin cậy rộng có chủ ý: quần áo dày, tư thế và góc máy đều đẩy sai số.
    spread = value * (0.10 + 0.12 * (1.0 - confidence))
    if len(estimates) > 1:
        spread = max(spread, (max(estimates) - min(estimates)) / 2.0)
    # Quần áo chỉ có thể làm đường viền RỘNG RA, không bao giờ hẹp lại. Vì vậy
    # sai số do đồ rộng là bất đối xứng: giá trị thật nằm ở phía THẤP hơn, nên
    # chỉ nới biên dưới thay vì nới đều hai phía.
    lower_extra = value * (1.0 - 1.0 / max(1.0, 1.0 + slack_penalty * 1.4))
    return {
        'outOfDistribution': bool(outside),
        'outOfDistributionDetail': outside or None,
        'valueKg': round(value),
        'minKg': round(max(0.0, value - spread - lower_extra)),
        'maxKg': round(value + spread),
        'confidence': round(confidence, 3),
        'source': 'image_estimate',
        'model': model_name,
    }


def analyze_body(image, pose=None, user_height_cm=0.0, user_weight_kg=0.0, reference=None):
    """Điểm vào chính. `pose` là kết quả analyze() ở toạ độ ẢNH GỐC."""
    if pose is None:
        from accessory_pipeline import analyze  # lazy: tránh import vòng
        pose = analyze(image, source_coordinates=True)

    measure = measure_body(image, pose)
    shape = body_shape_ratios(measure)
    quality = pose_quality(pose, measure)
    height = estimate_height(measure, quality, _num(user_height_cm), reference)
    weight = estimate_weight(measure, shape, height, quality, _num(user_weight_kg))

    warnings = ['Ước lượng từ một ảnh 2D có sai số, không phải phép đo nhân trắc chính xác.']
    if not measure['feetVisible']:
        warnings.append('Ảnh không thấy bàn chân — chiều cao được suy từ tỉ lệ cơ thể nên sai số lớn hơn.')
    if not measure['hasMask']:
        warnings.append('Không tách được nền, cân nặng chỉ suy từ tỉ lệ khung xương.')
    if measure['tiltDeg'] > 18:
        warnings.append('Người trong ảnh đang nghiêng — số đo bề ngang có thể bị thu hẹp.')
    if float(measure.get('clothingSlack') or 1.0) > 1.15:
        warnings.append('Bạn đang mặc đồ khá rộng — ước lượng cân nặng có thể cao hơn thực tế.')
    if weight.get('outOfDistribution'):
        warnings.append(
            'Số đo bề ngang trên ảnh nằm ngoài phân bố dữ liệu huấn luyện '
            '(thường do quần áo rộng hoặc tay che thân), nên hệ thống dùng mô hình '
            'hình học thay cho mô hình học máy.'
        )
    if height['valueCm'] is None:
        warnings.append('Không đủ dữ liệu để ước lượng chiều cao đáng tin cậy.')
    if weight['valueKg'] is None:
        warnings.append(
            'Không đủ dữ liệu để ước lượng cân nặng đáng tin cậy.'
            + (' Hãy chụp toàn thân, thấy rõ bàn chân.' if measure['coverage'] != 'full' else '')
        )

    # Số đo vòng ước lượng (chu vi elip Ramanujan). CHÚ Ý: đo trên đường viền
    # ngoài của người ĐANG MẶC QUẦN ÁO, nên đây là vòng ngoài trang phục chứ
    # không phải vòng cơ thể. Vì vậy nó KHÔNG được dùng để tính size (xem
    # lib/bodyAnalysis.js) — chỉ hiển thị để tham khảo và để chẩn đoán.
    girths = {}
    girth_source = 'none'
    features = measurement_features(measure, height.get('valueCm') or 0)
    girth_bundle = load_girth_estimators()
    girths_in_distribution = features_in_distribution(features)[0] if features else False
    if girth_bundle is not None and features is not None and girths_in_distribution:
        # Model bề ngang → vòng đo, train trên ANSUR II: MAE ~1.8–2.8cm. Chính
        # xác hơn hẳn phép xấp xỉ chu vi elip với tỉ lệ độ sâu giả định, vốn
        # từng cho ra vòng ngực 126cm cho một người mẫu gầy.
        try:
            row = np.array([features])
            for key, target in (('bust', 'chest_circ_cm'), ('waist', 'waist_circ_cm'), ('hip', 'hip_circ_cm')):
                model = girth_bundle['models'].get(target)
                if model is not None:
                    girths[key] = round(float(model.predict(row)[0]), 1)
            girth_source = 'ansur2-regressor'
        except Exception:
            girths = {}
    if not girths and features is not None and not girths_in_distribution:
        girth_source = 'ellipse-approximation-out-of-distribution'
    if not girths and measure['hasMask'] and height.get('valueCm'):
        px_per_cm = measure['staturePx'] / height['valueCm']
        for key, pixels, level in (
            ('bust', measure['bustPx'], 'chest'),
            ('waist', measure['waistPx'], 'waist'),
            ('hip', measure['hipPx'], 'hip'),
        ):
            if not pixels:
                continue
            width_cm = pixels / px_per_cm
            ratio = TORSO_DEPTH_BY_LEVEL.get(level, DEPTH_RATIO['torso'])
            a, b = width_cm / 2.0, width_cm * ratio / 2.0
            circumference = math.pi * (3 * (a + b) - math.sqrt(max(0.0, (3 * a + b) * (a + 3 * b))))
            girths[key] = round(circumference, 1)
        if girth_source == 'none':
            girth_source = 'ellipse-approximation'

    return {
        'ok': True,
        'bodyShape': {
            'shoulderWidthRatio': shape['shoulderWidthRatio'],
            'hipWidthRatio': shape['hipWidthRatio'],
            'torsoRatio': shape['torsoRatio'],
            'legRatio': shape['legRatio'],
            'bodyWidthRatio': shape['bodyWidthRatio'],
            'shoulderHipRatio': shape['shoulderHipRatio'],
        },
        'estimatedHeight': height,
        'estimatedWeight': weight,
        'estimatedGirths': girths,
        'girthsMeasureClothing': True,
        'girthSource': girth_source,
        'models': {
            'weight': weight.get('model'),
            'girth': girth_source,
            'anthropometry': ANTHROPOMETRY_SOURCE,
        },
        'quality': {
            'fullBodyVisible': measure['coverage'] == 'full',
            'clothingSlack': measure.get('clothingSlack', 1.0),
            'feetVisible': measure['feetVisible'],
            'headVisible': measure['headVisible'],
            'segmentationAvailable': measure['hasMask'],
            'coverage': measure['coverage'],
            'tiltDeg': round(measure['tiltDeg'], 1),
            'poseConfidence': round(float(pose.get('confidence') or 0.0), 3),
            'analysisConfidence': quality,
        },
        'pixels': {
            'staturePx': round(measure['staturePx'], 1),
            'headPx': round(measure['headPx'], 1),
            'shoulderPx': round(measure['shoulderPx'], 1),
            'bustPx': round(measure['bustPx'], 1),
            'waistPx': round(measure['waistPx'], 1),
            'hipPx': round(measure['hipPx'], 1),
            'torsoPx': round(measure['torsoPx'], 1),
            'legPx': round(measure['legPx'], 1),
        },
        'warnings': warnings,
    }


def analyze_body_file(path, **kwargs):
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
    return analyze_body(image, **kwargs)
