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

import body_geometry as GEOMETRY

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
# Chiều dài đầu người trưởng thành đo TRÊN ẢNH (đỉnh tóc → cằm). Đây là hằng số
# tra bảng nhân trắc, KHÔNG fit từ dữ liệu của dự án — độ lệch chuẩn ~1cm của nó
# (≈4.4%) được cộng thẳng vào sai số chiều cao thay vì giấu đi.
HEAD_HEIGHT_CM = {'female': 21.9, 'male': 23.3, 'unknown': 22.5}
HEAD_HEIGHT_SD_CM = 1.0
HEAD_LENGTH_CM = float(os.getenv('JAPANO_HEAD_LENGTH_CM', '22.5'))

# Prior chiều cao người trưởng thành. Cố ý ĐỂ RỘNG (sd 9-10cm) vì người dùng
# JAPANO là người Việt (nữ ~156cm) nhưng ảnh tải lên có thể là người mẫu châu Âu
# (nữ ~168cm); một prior hẹp theo một dân số sẽ kéo sai nhóm còn lại.
HEIGHT_PRIOR_CM = {
    'female': {'mean': 162.0, 'sd': 9.0},
    'male': {'mean': 173.0, 'sd': 9.0},
    'unknown': {'mean': 166.0, 'sd': 10.0},
}
# Sai số tương đối TỐI THIỂU của ước lượng chiều cao từ một ảnh đơn. Ngay cả khi
# mọi khớp đều rõ, phối cảnh (đầu gần ống kính hơn chân) và tư thế vẫn tạo sai số
# cỡ 7%. Không có sàn này thì phép truyền sai số sẽ tự tin quá mức và prior mất
# tác dụng — đúng cơ chế đã cho ra 206cm trên ảnh regression áo đỏ.
HEIGHT_CUE_MIN_REL_SD = {'full': 0.07, 'knee': 0.10, 'hip': 0.12, 'shoulder': 0.16, 'partial': 0.18}
HEIGHT_PLAUSIBLE_CM = (135.0, 205.0)
# Số đầu/thân của người trưởng thành thật là 6.8-8.0. Ngoài dải này nghĩa là phép
# đo đầu hoặc phép ngoại suy chiều cao đã hỏng, không phải người đó khác thường.
HEAD_COUNT_PLAUSIBLE = (5.5, 9.5)
# Ngưỡng tin cậy tối thiểu của một khớp để được dùng làm MỐC ĐO. Khớp yếu vẫn
# hữu ích cho pipeline phụ kiện nhưng không đủ để neo chiều cao.
LANDMARK_MIN_CONFIDENCE = float(os.getenv('JAPANO_LANDMARK_MIN_CONFIDENCE', '0.5'))
# Khớp nằm sát mép ảnh gần như luôn là khớp bị YOLO đẩy ra biên khi bộ phận đó
# đã bị cắt khỏi khung hình.
LANDMARK_EDGE_MARGIN = 0.015
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


def _display_bin(value, step=10):
    """Trả bin hiển thị có độ rộng cố định, ví dụ 163 -> [160, 170]."""
    parsed = _num(value)
    if not parsed:
        return None, None
    lower = int(math.floor(parsed / step) * step)
    return lower, lower + step


def _with_cm_display_bin(estimate):
    """Tách khoảng dễ đọc trên UI khỏi khoảng bất định dùng để chẩn đoán.

    Một ảnh 2D vẫn có sai số thật rộng hơn 10 cm. `uncertainty*` giữ sự thật đó
    cho calibration/log; `minCm/maxCm` là đúng một bin 10 cm mà người dùng yêu
    cầu. Số đo người dùng tự nhập không phải dự đoán nên vẫn giữ nguyên.
    """
    value = _num((estimate or {}).get('valueCm'))
    if not value or estimate.get('source') == 'user_provided':
        return estimate
    display_min, display_max = _display_bin(value)
    result = dict(estimate)
    result.update({
        'uncertaintyMinCm': estimate.get('minCm'),
        'uncertaintyMaxCm': estimate.get('maxCm'),
        'minCm': display_min,
        'maxCm': display_max,
        'displayBinCm': [display_min, display_max],
    })
    return result


def _point(keypoints, name, inferred=(), min_confidence=0.0, image_size=None):
    """Toạ độ một khớp, sau khi loại những khớp KHÔNG dùng làm mốc đo được.

    Ba lý do loại, tất cả đều đã tự tay gây ra sai số trên ảnh regression áo đỏ:

    1. Khớp do `accessory_pipeline.analyze()` BÙ ra từ tỉ lệ box. Chúng tồn tại
       để pipeline phụ kiện luôn có đủ điểm neo, nhưng chúng không phải quan sát.
    2. Khớp có độ tin cậy thấp. YOLO vẫn xuất đủ 17 khớp kể cả khi bộ phận đó
       nằm ngoài khung hình.
    3. Khớp nằm sát mép ảnh. Ảnh áo đỏ bị cắt ngang đùi, YOLO đặt hai đầu gối ở
       y=1303 và 1319 trên ảnh cao 1320 với độ tin cậy 0.25/0.32. Hệ thống tưởng
       "nhìn thấy đầu gối", ngoại suy chiều cao từ đó và cho ra 206cm.
    """
    if name in inferred:
        return None
    value = (keypoints or {}).get(name)
    if not value or len(value) < 2:
        return None
    if min_confidence and len(value) >= 3 and float(value[2]) < min_confidence:
        return None
    x, y = float(value[0]), float(value[1])
    if image_size:
        width, height = image_size
        margin_y, margin_x = height * LANDMARK_EDGE_MARGIN, width * LANDMARK_EDGE_MARGIN
        if y <= margin_y or y >= height - margin_y or x <= margin_x or x >= width - margin_x:
            return None
    return (x, y)


def _mid(a, b):
    if a and b:
        return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)
    return a or b


_REMBG_SESSION = None


def rembg_session():
    """Phiên rembg dùng chung, tạo đúng một lần cho cả tiến trình.

    `rembg.remove()` gọi không kèm session sẽ DỰNG LẠI ONNX session ở mỗi lần
    gọi. Đo trên chính ảnh regression: 1.26s mỗi lần gọi, trong đó 1.15s là dựng
    session và chỉ 0.11s là suy luận thật. Với ngân sách phân tích cơ thể 2 giây
    thì đó là hơn một nửa ngân sách bị đốt để nạp lại đúng một model không đổi.
    """
    global _REMBG_SESSION
    if _REMBG_SESSION is None:
        try:
            from rembg import new_session
            _REMBG_SESSION = new_session(os.getenv('JAPANO_REMBG_MODEL', 'u2net'))
        except Exception:
            _REMBG_SESSION = False
    return _REMBG_SESSION or None


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
    session = rembg_session()
    try:
        cutout = remove(image.convert('RGBA'), session=session) if session \
            else remove(image.convert('RGBA'))
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


def _symmetric_width_at(mask, y, center_x):
    """Ước lượng bề ngang thân khi một cánh tay dính vào silhouette.

    Nếu trục thân lệch hẳn về một phía trong đoạn mask, phía dài thường chứa
    cánh tay đang buông/chạm áo. Nửa ngắn hơn là đường viền thân sạch hơn; phản
    chiếu nó qua trục thân giúp bỏ cánh tay mà không cắt người theo một ngưỡng
    pixel cố định.
    """
    if mask is None:
        return 0.0
    y = int(_clamp(int(y), 0, mask.shape[0] - 1))
    runs = _row_runs(mask[y])
    if not runs:
        return 0.0
    run = min(runs, key=lambda item: abs((item[0] + item[1]) / 2.0 - center_x))
    raw = float(run[1] - run[0] + 1)
    if not (run[0] <= center_x <= run[1]):
        return raw
    left = center_x - run[0] + 0.5
    right = run[1] - center_x + 0.5
    short, long = min(left, right), max(left, right)
    return float(short * 2.0) if long > 0 and short / long < 0.72 else raw


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
    """Đo các đại lượng hình học của cơ thể trong ảnh (đơn vị pixel + tỉ lệ).

    Bề ngang thân được lấy từ `body_geometry.torso_profile`, tức là đã cắt hai
    cánh tay bằng khung xương và đã đối chiếu với khoảng cách khớp vai/hông.
    Trước đây hàm này đo trực tiếp trên silhouette: với ảnh người tay buông sát
    thân, cả tay lẫn thân nằm trong MỘT dải liên tục nên "eo" đo được 497px
    trong khi hai khớp hông chỉ cách nhau 214px.
    """
    box = [float(value) for value in (pose.get('box') or [0, 0, image.width, image.height])]
    keypoints = pose.get('keypoints') or {}
    inferred = set(pose.get('inferredKeypoints') or ())
    size = (image.width, image.height)
    mask = person_mask(image, box)
    if mask is not None:
        mask = _largest_component(mask)

    def landmark(name, strict=True):
        return _point(keypoints, name, inferred,
                      LANDMARK_MIN_CONFIDENCE if strict else 0.0,
                      size if strict else None)

    left_shoulder, right_shoulder = landmark('left_shoulder'), landmark('right_shoulder')
    left_hip, right_hip = landmark('left_hip'), landmark('right_hip')
    left_eye, right_eye = landmark('left_eye'), landmark('right_eye')
    nose = landmark('nose')
    left_elbow, right_elbow = landmark('left_elbow'), landmark('right_elbow')
    left_wrist, right_wrist = landmark('left_wrist'), landmark('right_wrist')
    ankles = [landmark('left_ankle'), landmark('right_ankle')]
    knees = [landmark('left_knee'), landmark('right_knee')]

    shoulder_mid = _mid(left_shoulder, right_shoulder)
    hip_mid = _mid(left_hip, right_hip)
    eye_mid = _mid(left_eye, right_eye)
    center_x = (shoulder_mid or hip_mid or ((box[0] + box[2]) / 2.0, 0))[0]

    head_reference = eye_mid or nose or (center_x, box[1])
    head_half_width = max(12.0, (box[2] - box[0]) * 0.18)
    vertex_y = _vertex_y(mask, box, head_reference[0], head_half_width)

    shoulder_joint_span = abs(left_shoulder[0] - right_shoulder[0]) \
        if left_shoulder and right_shoulder else 0.0
    hip_joint_span = abs(left_hip[0] - right_hip[0]) if left_hip and right_hip else 0.0

    # Chiều dài đầu: ba đường đo độc lập hợp nhất theo nghịch đảo phương sai,
    # thay cho một hệ số cố định (mắt ở 0.55 chiều dài đầu) vốn hụt 25% ở ảnh áo
    # đỏ. Hệ số của cả ba đường được fit trên 6.479 khuôn mặt có nhãn parsing.
    head = GEOMETRY.head_length_px(vertex_y, eye_mid, nose, shoulder_joint_span)
    head_px = head['headPx']

    # Chiều cao pixel: chỉ dùng mốc THẬT SỰ nhìn thấy được.
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

    shoulder_y = shoulder_mid[1] if shoulder_mid else vertex_y + stature_px * STATURE_FRACTION_FROM_TOP['shoulder']
    hip_y = hip_mid[1] if hip_mid else vertex_y + stature_px * STATURE_FRACTION_FROM_TOP['hip']
    torso_span = max(1.0, hip_y - shoulder_y)

    geometry_keypoints = {
        'left_shoulder': left_shoulder, 'right_shoulder': right_shoulder,
        'left_hip': left_hip, 'right_hip': right_hip,
        'left_elbow': left_elbow, 'right_elbow': right_elbow,
        'left_wrist': left_wrist, 'right_wrist': right_wrist,
    }
    profile = GEOMETRY.torso_profile(mask, geometry_keypoints, shoulder_y, hip_y, center_x)

    shoulder_px = profile['shoulder']['widthPx']
    bust_px = profile['chest']['widthPx']
    waist_px = profile['waist']['widthPx']
    hip_px = profile['hip']['widthPx']
    bust_y = profile['chest']['measuredAtY']
    waist_y = profile['waist']['measuredAtY']

    torso_px = torso_span
    leg_px = 0.0
    if visible_ankles:
        leg_px = max(point[1] for point in visible_ankles) - hip_y
    elif visible_knees:
        leg_px = (max(point[1] for point in visible_knees) - hip_y) * 1.9

    tilt = 0.0
    if left_shoulder and right_shoulder:
        dx = abs(left_shoulder[0] - right_shoulder[0])
        dy = abs(left_shoulder[1] - right_shoulder[1])
        tilt = math.degrees(math.atan2(dy, max(1.0, dx)))

    mean_torso_px = float(np.median([value for value in (shoulder_px, bust_px, waist_px, hip_px) if value] or [0.0]))

    # Độ rộng của quần áo: bề ngang thân ĐÃ CẮT TAY so với bề ngang mà khung
    # xương dự đoán. Bản trước so ĐƯỜNG VIỀN THÔ (còn nguyên hai tay) nên nó chủ
    # yếu đo... hai cánh tay: một người mặc đồ bó sát, tay buông, vẫn bị chấm
    # slack 1.29. Đưa con số đó vào model làm đầu vào khiến model trừ mất phần
    # quần áo không tồn tại — sai số trên BodyM lệch −10cm ở cả ba vòng.
    #
    # Vẫn phải nói thẳng giới hạn: một ảnh chính diện KHÔNG tách được "áo rộng"
    # khỏi "bụng to". Đại lượng này vì vậy là "rộng hơn khung xương bao nhiêu",
    # và nó được dùng như một cảnh báo, không phải một phép đo quần áo.
    clothing_slack = 1.0
    slack_samples = []
    for level in ('waist', 'hip'):
        entry = profile[level]
        if entry['widthPx'] > 1 and entry['skeletonPx'] > 1:
            slack_samples.append(entry['widthPx'] / entry['skeletonPx'])
    if slack_samples:
        clothing_slack = max(1.0, float(np.median(slack_samples)))

    return {
        'mask': mask,
        'box': box,
        'centerX': center_x,
        'vertexY': vertex_y,
        'headPx': head_px,
        'headCues': head['cues'],
        'headRelSd': head['relSd'],
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
        'shoulderJointSpanPx': shoulder_joint_span,
        'hipJointSpanPx': hip_joint_span,
        'torsoProfile': profile,
        'armsMergedIntoTorso': bool(
            profile['waist']['rawSilhouettePx'] > profile['waist']['widthPx'] * 1.12
            or profile['hip']['rawSilhouettePx'] > profile['hip']['widthPx'] * 1.12),
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


def _sex_key(sex):
    value = str(sex or '').strip().lower()
    if value in ('f', 'female', 'nu', 'nữ', 'woman', 'women'):
        return 'female'
    if value in ('m', 'male', 'nam', 'man', 'men'):
        return 'male'
    return 'unknown'


def height_cue(measure, sex='unknown'):
    """Ước lượng chiều cao THÔ từ ảnh, kèm sai số tương đối của chính nó.

    Đây vẫn là phép neo theo chiều dài đầu — không có vật chuẩn thì không còn
    cách nào khác — nhưng khác bản cũ ở ba điểm:

    * chiều dài đầu lấy từ ba đường đo hợp nhất, không phải một hệ số cố định;
    * sai số của từng khâu (đo đầu, hằng số cm, ngoại suy phần thân bị cắt) được
      cộng theo phương sai và trả ra ngoài, thay vì bị nuốt mất;
    * số đầu/thân phi lý thì TRẢ VỀ KHÔNG CÓ CUE, chứ không kẹp về biên rồi nhân
      lên thành một con số trông có vẻ hợp lý.

    Ảnh áo đỏ trước đây rơi đúng vào nhánh kẹp biên: 8.61 đầu/thân bị kẹp còn
    8.6, nhân 24cm ra 206.4cm.
    """
    head_px = measure.get('headPx') or 0.0
    stature_px = measure.get('staturePx') or 0.0
    if head_px <= 0 or stature_px <= 0:
        return None
    head_count = stature_px / head_px
    if not (HEAD_COUNT_PLAUSIBLE[0] <= head_count <= HEAD_COUNT_PLAUSIBLE[1]):
        return {'valueCm': None, 'relSd': None, 'headCount': round(head_count, 2),
                'reason': 'head_count_out_of_range'}
    head_cm = HEAD_HEIGHT_CM.get(_sex_key(sex), HEAD_HEIGHT_CM['unknown'])
    value = head_count * head_cm
    coverage = measure.get('coverage') or 'partial'
    fraction_sd = {'full': 0.010, 'knee': 0.013, 'hip': 0.031, 'shoulder': 0.052, 'partial': 0.060}
    parts = [
        float(measure.get('headRelSd') or 0.10),
        HEAD_HEIGHT_SD_CM / head_cm,
        fraction_sd.get(coverage, 0.06),
        _clamp(measure.get('tiltDeg', 0.0) / 90.0, 0.0, 1.0) * 0.12,
    ]
    rel_sd = math.sqrt(sum(part * part for part in parts))
    rel_sd = max(rel_sd, HEIGHT_CUE_MIN_REL_SD.get(coverage, 0.12))
    return {'valueCm': value, 'relSd': rel_sd, 'headCount': round(head_count, 2), 'reason': 'head_anchored'}


def estimate_height(measure, quality, user_height_cm=0.0, reference=None, sex='unknown'):
    """Ước lượng chiều cao. Mode B khi có mốc chuẩn, Mode A khi chỉ có ảnh.

    Mode A KHÔNG phải phép đo. Một ảnh đơn không có vật chuẩn chỉ cho tỉ lệ, nên
    kết quả là hậu nghiệm của một prior dân số sau khi cập nhật bằng cue từ ảnh
    (hợp nhất theo nghịch đảo phương sai). Trọng số thật của cue được trả ra
    trong `priorWeight` để không ai đọc nhầm nó thành số đo.
    """
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

    if reference and _num(reference.get('pixelLength')) and _num(reference.get('realLengthCm')):
        px_per_cm = _num(reference['pixelLength']) / _num(reference['realLengthCm'])
        value = measure['staturePx'] / px_per_cm
        spread = value * (0.03 + 0.05 * (1.0 - quality))
        return _with_cm_display_bin({
            'valueCm': round(value, 1),
            'minCm': round(value - spread, 1),
            'maxCm': round(value + spread, 1),
            'confidence': round(_clamp(0.55 + quality * 0.4, 0.0, 0.95), 3),
            'mode': 'B',
            'source': 'reference_object',
            'method': 'quy đổi theo vật chuẩn trong ảnh',
        })

    prior = HEIGHT_PRIOR_CM.get(_sex_key(sex), HEIGHT_PRIOR_CM['unknown'])
    cue = height_cue(measure, sex)
    unusable = {
        'valueCm': None, 'minCm': None, 'maxCm': None,
        'confidence': round(_clamp(quality * 0.4, 0.0, 0.34), 3),
        'mode': 'A', 'source': 'image_estimate',
    }
    if quality < min_confidence:
        return {**unusable, 'method': 'chất lượng tư thế/ảnh dưới ngưỡng, không đủ dữ liệu'}
    if not cue or cue.get('valueCm') is None:
        reason = (cue or {}).get('reason', 'no_head_reference')
        detail = f" (đo được {cue['headCount']} đầu/thân)" if cue and cue.get('headCount') else ''
        return {**unusable, 'method': f'không đo được chiều dài đầu đáng tin cậy: {reason}{detail}',
                'cueRejected': reason}

    raw_cue = cue['valueCm']
    cue_sd = max(1.0, raw_cue * cue['relSd'])
    implausible_cue = not (HEIGHT_PLAUSIBLE_CM[0] * 0.8 <= raw_cue <= HEIGHT_PLAUSIBLE_CM[1] * 1.2)
    if implausible_cue:
        # Cue lệch tới mức này thì khâu đo đã hỏng; nới sai số của nó ra để prior
        # chi phối, thay vì để nó kéo kết quả đi.
        cue_sd *= 3.0

    prior_precision = 1.0 / (prior['sd'] ** 2)
    cue_precision = 1.0 / (cue_sd ** 2)
    total = prior_precision + cue_precision
    value = (prior['mean'] * prior_precision + raw_cue * cue_precision) / total
    posterior_sd = math.sqrt(1.0 / total)
    cue_weight = cue_precision / total

    clamped = _clamp(value, *HEIGHT_PLAUSIBLE_CM)
    hit_bound = abs(clamped - value) > 0.05
    value = clamped

    confidence = _clamp(quality * (0.30 + 0.50 * cue_weight), 0.0, 0.80)
    if implausible_cue or hit_bound:
        confidence = min(confidence, 0.40)
    # Ngưỡng hiển thị THẤP HƠN ngưỡng dùng để chọn size. Một ước lượng chủ yếu
    # dựa vào prior vẫn đáng hiển thị kèm nhãn "độ tin cậy thấp" và lời mời nhập
    # số thật — trả null cho một tấm ảnh rõ ràng không giúp được ai. Nhưng nó
    # KHÔNG được âm thầm dùng để quyết định size: `usableForSizing` nói rõ điều đó.
    display_floor = float(os.getenv('JAPANO_BODY_DISPLAY_MIN_CONFIDENCE', '0.20'))
    if confidence < display_floor:
        return {**unusable, 'confidence': round(confidence, 3),
                'method': 'ước lượng chỉ dựa vào prior dân số, không đủ tin cậy để hiển thị'}

    spread = 1.96 * posterior_sd
    return _with_cm_display_bin({
        'valueCm': round(value, 1),
        'minCm': round(value - spread, 1),
        'maxCm': round(value + spread, 1),
        'confidence': round(confidence, 3),
        'mode': 'A',
        'source': 'image_estimate',
        'method': (f"prior dân số ({prior['mean']}±{prior['sd']}cm) cập nhật bằng cue "
                   f"{round(raw_cue, 1)}±{round(cue_sd, 1)}cm từ {cue['headCount']} đầu/thân"),
        'cueCm': round(raw_cue, 1),
        'cueSdCm': round(cue_sd, 1),
        'headCount': cue['headCount'],
        'priorMeanCm': prior['mean'],
        'priorSdCm': prior['sd'],
        'cueWeight': round(cue_weight, 3),
        'posteriorSdCm': round(posterior_sd, 2),
        'usableForSizing': bool(confidence >= min_confidence),
        'basis': 'population_prior' if cue_weight < 0.5 else 'image_cue',
        'clampedToPlausibleRange': hit_bound,
        'implausibleCue': implausible_cue,
        'sexAssumed': _sex_key(sex),
    })


# --- Chốt chặn giải phẫu trên ĐẦU RA ---------------------------------------
# Kiểm tra đặc trưng đầu vào có nằm trong phân bố train là chưa đủ: khi đầu vào
# lệch miền, hệ thống rơi về phép xấp xỉ elip và phép đó vẫn có thể in ra "vòng
# hông 57cm" hoặc "vòng eo 114cm". Người trưởng thành không có số đo như vậy, nên
# đúng ra phải nói KHÔNG ĐO ĐƯỢC thay vì hiển thị một con số sai.
#
# Dải dưới đây cố ý RỘNG: mục tiêu là loại kết quả bất khả thi về giải phẫu, chứ
# không phải ép mọi người về dáng trung bình. Người rất mập vẫn phải đi qua được.
GIRTH_PLAUSIBLE_CM = {'bust': (60.0, 170.0), 'waist': (48.0, 170.0), 'hip': (60.0, 180.0)}
# Quan hệ giữa các vòng. Biên lấy rộng hơn phân bố ANSUR II nhiều lần.
GIRTH_RATIO_LIMITS = {('hip', 'bust'): (0.70, 1.45), ('waist', 'hip'): (0.50, 1.35)}
BMI_PLAUSIBLE = (13.0, 45.0)


def girth_plausibility(girths, height_cm):
    """Lọc các vòng đo bất khả thi. Trả (vòng còn dùng được, lý do đã loại)."""
    kept, rejected = {}, {}
    for key, value in (girths or {}).items():
        low, high = GIRTH_PLAUSIBLE_CM.get(key, (0.0, 1e9))
        if not (low <= float(value) <= high):
            rejected[key] = f'ngoài dải giải phẫu {low:.0f}-{high:.0f}cm (đo được {value}cm)'
        else:
            kept[key] = value
    for (numerator, denominator), (low, high) in GIRTH_RATIO_LIMITS.items():
        a, b = kept.get(numerator), kept.get(denominator)
        if not a or not b:
            continue
        ratio = float(a) / float(b)
        if not (low <= ratio <= high):
            # Không biết vòng nào sai, nên loại cả cặp thay vì đoán.
            rejected[numerator] = f'tỉ lệ {numerator}/{denominator}={ratio:.2f} ngoài dải {low}-{high}'
            rejected[denominator] = f'tỉ lệ {numerator}/{denominator}={ratio:.2f} ngoài dải {low}-{high}'
            kept.pop(numerator, None)
            kept.pop(denominator, None)
    if height_cm:
        # Vòng ngực/hông lớn hơn cả chiều cao là dấu hiệu thang đo pixel→cm hỏng.
        for key in list(kept):
            if float(kept[key]) > height_cm * 0.95:
                rejected[key] = f'lớn hơn 95% chiều cao ước lượng ({height_cm}cm) — thang đo pixel/cm nhiều khả năng sai'
                kept.pop(key)
    return kept, rejected


def weight_plausibility(weight_kg, height_cm):
    """BMI phải nằm trong dải người thật. Trả lý do nếu không."""
    if not weight_kg or not height_cm:
        return True, None
    bmi = float(weight_kg) / (float(height_cm) / 100.0) ** 2
    if BMI_PLAUSIBLE[0] <= bmi <= BMI_PLAUSIBLE[1]:
        return True, None
    return False, f'BMI suy ra {bmi:.1f} ngoài dải {BMI_PLAUSIBLE[0]}-{BMI_PLAUSIBLE[1]}'


# --- Hiệu chuẩn về dân số chung --------------------------------------------
# Model hồi quy học trên ANSUR II — quân nhân Mỹ tại ngũ. Ở cùng một bề ngang
# chính diện, họ mỏng hơn dân số chung, nên vòng đo suy ra bị nhỏ đi một cách hệ
# thống. Đo end-to-end trên BodyM cho ra sai lệch khoảng -13cm mỗi vòng và -13kg,
# và sai lệch đó KHÔNG mất đi khi đưa chiều cao thật vào ⇒ không phải lỗi thang đo.
#
# Hệ số hiệu chỉnh fit trên tập TRAIN của BodyM (2.018 người, rời danh tính khỏi
# testA/testB dùng để báo cáo). Vì BodyM là CC-BY-NC-4.0, lớp hiệu chuẩn này PHI
# THƯƠNG MẠI — đặt JAPANO_BODY_POPULATION_CALIBRATION=0 để tắt.
_POPULATION_CALIBRATION = None


def load_population_calibration():
    global _POPULATION_CALIBRATION
    if _POPULATION_CALIBRATION is None:
        if str(os.getenv('JAPANO_BODY_POPULATION_CALIBRATION', '1')).strip() == '0':
            _POPULATION_CALIBRATION = False
        else:
            path = Path(os.getenv(
                'JAPANO_BODY_POPULATION_CALIBRATION_JSON',
                str(ROOT / 'ai_training/models/bodym_population_calibration.json')))
            try:
                _POPULATION_CALIBRATION = json.loads(path.read_text(encoding='utf-8'))
            except Exception:
                _POPULATION_CALIBRATION = False
    return _POPULATION_CALIBRATION or None


def calibrate_to_population(key, value, height_cm, slack, sex):
    """Đưa một dự đoán từ miền ANSUR về miền dân số chung. Trả (giá trị, đã áp?)."""
    calibration = load_population_calibration()
    entry = ((calibration or {}).get('targets') or {}).get(key)
    if not entry or value is None or not height_cm:
        return value, False
    features = [float(value), float(height_cm), float(slack or 1.0),
                1.0 if _sex_key(sex) == 'male' else 0.0]
    adjusted = float(entry['intercept']) + sum(
        c * f for c, f in zip(entry['coefficients'], features))
    # Hiệu chuẩn là hiệu chỉnh, không phải model thay thế: chặn ở ±40% để một hệ
    # số fit hỏng không thể tự mình tạo ra một con số vô lý.
    adjusted = _clamp(adjusted, float(value) * 0.6, float(value) * 1.4)
    return round(adjusted, 1), True


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
_BMI_BUNDLE = None


def _feature_schema_ok(bundle, expected):
    """Checkpoint cũ thiếu cột `clothing_slack` phải bị từ chối, không đoán bừa."""
    names = (bundle or {}).get('features') or []
    return len(names) == expected


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


def load_bmi_estimator():
    """Model BMI ← bốn tỉ lệ bề ngang/chiều cao (đo thẳng trên pixel).

    Đây là nhánh cân nặng ÍT phụ thuộc nhất vào chiều cao: đầu vào của nó là tỉ
    lệ, mà tỉ lệ thì không cần biết một centimet dài bao nhiêu pixel. Chiều cao
    chỉ xuất hiện một lần ở bước cuối (BMI × (h/100)²) thay vì nhân vào cả bốn
    bề ngang rồi lại nhân tiếp qua model.
    """
    global _BMI_BUNDLE
    if _BMI_BUNDLE is None:
        _BMI_BUNDLE = _load_joblib(
            'JAPANO_BODY_BMI_MODEL', 'ai_training/models/body_bmi_estimator.joblib') or False
    return _BMI_BUNDLE or None


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


# Sau khi regressor được train lại trên đặc trưng ĐÃ LÀM NHIỄU GIỐNG ẢNH (áo
# rộng, tay còn sót, sai số chiều cao), cổng lệch-miền không còn phải gánh vai
# trò chốt an toàn duy nhất nữa, nên nới từ 3sd lên 4sd. Cụ thể: người rất mập
# có bề ngang vai/chiều cao 0.351 — nằm trong dải ANSUR thật (max 0.364) nhưng
# lệch 3.3sd, và ở mức 3sd họ bị đẩy sang công thức BMI tuyến tính rồi bị ước
# lượng nhẹ đi hàng chục kg. Chốt chặn cuối giờ là `girth_plausibility` và
# `weight_plausibility`, đặt trên ĐẦU RA chứ không phải đầu vào.
OUT_OF_DISTRIBUTION_SIGMA = float(os.getenv('JAPANO_BODY_OOD_SIGMA', '4.0'))


def features_in_distribution(features, sigma=None):
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
    sigma = OUT_OF_DISTRIBUTION_SIGMA if sigma is None else sigma
    if not BREADTH_DISTRIBUTION or not features:
        return False, ['no_distribution_reference']
    height = features[0]
    if height <= 0:
        return False, ['no_height']
    outside = []
    for name, value in zip(('shoulder', 'chest', 'waist', 'hip'), features[1:5]):
        stats = BREADTH_DISTRIBUTION.get(name)
        if not stats:
            continue
        ratio = value / height
        deviation = abs(ratio - stats['mean']) / max(1e-6, stats['sd'])
        if deviation > sigma:
            outside.append(f'{name}:{ratio:.3f}~{deviation:.1f}sd')
    return (not outside), outside


def measurement_features(measure, height_cm):
    """Đầu vào của model: chiều cao, bốn bề ngang (cm) và độ rộng quần áo ĐO ĐƯỢC.

    Đại lượng thứ sáu không phải trang trí. Model được train trên số đo bằng
    thước rồi làm nhiễu để giống ảnh; nếu không nói cho nó biết tấm ảnh này có áo
    rộng hay không, nó sẽ trừ bớt phần quần áo trong MỌI trường hợp. Chấm trên
    BodyM (người mặc đồ bó sát) cho thấy đúng lỗi đó: cả ba vòng lệch −10cm.
    """
    if not height_cm or measure['staturePx'] <= 0:
        return None
    px_per_cm = measure['staturePx'] / height_cm
    if px_per_cm <= 0:
        return None
    widths = [measure['shoulderPx'], measure['bustPx'], measure['waistPx'], measure['hipPx']]
    if not all(widths):
        return None
    slack = float(measure.get('clothingSlack') or 1.0)
    return [height_cm] + [value / px_per_cm for value in widths] + [slack]


def ratio_features(measure):
    """Bốn tỉ lệ bề ngang/chiều cao, đo thẳng trên pixel — không cần thang cm."""
    stature = measure.get('staturePx') or 0.0
    if stature <= 0:
        return None
    widths = [measure['shoulderPx'], measure['bustPx'], measure['waistPx'], measure['hipPx']]
    if not all(widths):
        return None
    slack = float(measure.get('clothingSlack') or 1.0)
    return [value / stature for value in widths] + [slack]


def bmi_from_ratios(measure):
    """BMI dự đoán từ tỉ lệ, hoặc None nếu chưa train / thiếu bề ngang."""
    bundle = load_bmi_estimator()
    features = ratio_features(measure)
    if bundle is None or features is None or not _feature_schema_ok(bundle, len(features)):
        return None
    try:
        value = float(bundle['model'].predict(np.array([features]))[0])
    except Exception:
        return None
    return value if BMI_PLAUSIBLE[0] <= value <= BMI_PLAUSIBLE[1] else None


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
    display_floor = float(os.getenv('JAPANO_BODY_DISPLAY_MIN_CONFIDENCE', '0.20'))
    partial_body = measure['coverage'] != 'full'
    if not height_cm or quality < display_floor:
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
    # Ảnh cắt ngang đùi KHÔNG còn tự động bị loại khỏi nhánh học máy. Bốn bề
    # ngang giờ đo từ khung xương + silhouette đã cắt tay nên chúng vẫn đúng khi
    # thiếu bàn chân; thứ kém tin cậy là CHIỀU CAO, và sai số đó được cộng vào
    # khoảng bất định phía dưới thay vì vứt cả model đi. Điều bắt buộc giữ lại:
    # không tích phân thể tích trên mask bị cắt, và không mượn số của ảnh trước.
    # Nhánh CHÍNH: BMI từ tỉ lệ. Nó dùng được kể cả khi đặc trưng quy ra cm lệch
    # miền, vì nó không quy ra cm — đúng trường hợp người rất mập, vốn bị nhánh
    # cũ đẩy sang công thức BMI tuyến tính và ước lượng nhẹ đi hàng chục kg.
    bmi = bmi_from_ratios(measure)
    if bmi:
        estimates.append(bmi * (height_cm / 100.0) ** 2)
        model_name = 'ansur2-bmi-from-ratios'

    if (trained is not None and features is not None and in_distribution
            and _feature_schema_ok(trained, len(features))):
        try:
            predicted = float(trained['model'].predict(np.array([features]))[0])
            if 25.0 <= predicted <= 200.0:
                estimates.append(predicted)
                model_name = 'ansur2-bmi+breadth' if bmi else 'ansur2-regressor'
        except Exception:
            pass

    # Mô hình thể tích và công thức tỉ lệ chỉ còn là phương án DỰ PHÒNG cho
    # trường hợp chưa train model hoặc thiếu bề ngang. Trộn chúng vào khi đã có
    # model train trên 6.068 người thật chỉ kéo kết quả xấu đi.
    if not estimates:
        # Ngoài phân bố thường chính là lúc tay dính vào thân. Mô hình thể tích
        # sẽ coi toàn bộ dải tay+thân là một khối elip khổng lồ và chạm trần BMI
        # 50 (ảnh Redmi từng bị đẩy lên 133 kg). Tỉ lệ bề ngang đã được chặn bởi
        # khớp vai ổn định hơn cho nhánh này.
        fallback = ratio_weight(shape, height_cm) if outside else 0.0
        if fallback:
            estimates.append(fallback)
            model_name = 'ratio-bmi-out-of-distribution'
        else:
            volumetric = volumetric_weight(measure, px_per_cm)
            if volumetric:
                estimates.append(volumetric)
            else:
                fallback = ratio_weight(shape, height_cm)
                if fallback:
                    estimates.append(fallback)
                    model_name = 'ratio-bmi-fallback'
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
    if partial_body:
        confidence *= {'knee': 0.9, 'hip': 0.78, 'shoulder': 0.62, 'partial': 0.55}.get(measure['coverage'], 0.7)
        # Đủ mask + tỉ lệ thân thì vẫn trả estimate cho try-on, nhưng chỉ vừa
        # chạm ngưỡng và UI sẽ nói độ tin cậy thấp/trung bình.
        if estimates and measure['hasMask'] and quality >= min_confidence:
            confidence = max(confidence, min_confidence)
    if confidence < min_confidence:
        return {
            'valueKg': None,
            'minKg': None,
            'maxKg': None,
            'confidence': round(confidence, 3),
            'source': 'image_estimate',
            'model': model_name,
        }
    # Giữ khoảng bất định rộng cho chẩn đoán/calibration, nhưng UI chỉ nhận một
    # bin 10 kg. Khoảng kiểu 58-108 kg không giúp người dùng chọn size; nếu ảnh
    # không đủ tin cậy thì hàm đã trả null ở nhánh phía trên.
    spread = value * (0.10 + 0.12 * (1.0 - confidence))
    if len(estimates) > 1:
        spread = max(spread, (max(estimates) - min(estimates)) / 2.0)
    # Quần áo chỉ có thể làm đường viền RỘNG RA, không bao giờ hẹp lại. Vì vậy
    # sai số do đồ rộng là bất đối xứng: giá trị thật nằm ở phía THẤP hơn, nên
    # chỉ nới biên dưới thay vì nới đều hai phía.
    lower_extra = value * (1.0 - 1.0 / max(1.0, 1.0 + slack_penalty * 1.4))
    uncertainty_min = round(max(0.0, value - spread - lower_extra))
    uncertainty_max = round(value + spread)
    display_min = int(math.floor(value / 10.0) * 10)
    display_max = display_min + 10
    return {
        'outOfDistribution': bool(outside),
        'outOfDistributionDetail': outside or None,
        # Giữ một chữ số cho tính fit nội bộ; UI chỉ hiển thị bin 10 kg.
        'valueKg': round(value, 1),
        'minKg': display_min,
        'maxKg': display_max,
        'uncertaintyMinKg': uncertainty_min,
        'uncertaintyMaxKg': uncertainty_max,
        'displayBinKg': [display_min, display_max],
        'confidence': round(confidence, 3),
        'source': 'image_estimate',
        'model': model_name,
    }


def analyze_body(image, pose=None, user_height_cm=0.0, user_weight_kg=0.0, reference=None,
                 sex='unknown', apply_population_calibration=True):
    """Điểm vào chính. `pose` là kết quả analyze() ở toạ độ ẢNH GỐC."""
    if pose is None:
        from accessory_pipeline import analyze  # lazy: tránh import vòng
        pose = analyze(image, source_coordinates=True)

    measure = measure_body(image, pose)
    shape = body_shape_ratios(measure)
    quality = pose_quality(pose, measure)
    height = estimate_height(measure, quality, _num(user_height_cm), reference, sex)
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
    if (girth_bundle is not None and features is not None and girths_in_distribution
            and _feature_schema_ok(girth_bundle, len(features))):
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

    # Hiệu chuẩn dân số CHẠY TRƯỚC chốt chặn giải phẫu: chốt chặn phải xét con
    # số cuối cùng mà người dùng nhìn thấy, không phải số trung gian.
    population_calibrated = []
    if apply_population_calibration:
        slack = measure.get('clothingSlack', 1.0)
        height_cm = height.get('valueCm')
        for key in list(girths):
            adjusted, applied = calibrate_to_population(key, girths[key], height_cm, slack, sex)
            if applied:
                girths[key] = adjusted
                population_calibrated.append(key)
        # Số đo do khách tự nhập KHÔNG BAO GIỜ bị hiệu chuẩn. Hiệu chuẩn tồn tại
        # để sửa sai lệch của MODEL; áp nó lên con số người dùng tự khai là ghi đè
        # dữ liệu thật bằng một dự đoán.
        if weight.get('valueKg') is not None and weight.get('source') != 'user_provided':
            adjusted, applied = calibrate_to_population(
                'weight', weight['valueKg'], height_cm, slack, sex)
            if applied:
                weight = {**weight, 'valueKg': adjusted,
                          'minKg': int(math.floor(adjusted / 10.0) * 10),
                          'maxKg': int(math.floor(adjusted / 10.0) * 10) + 10}
                population_calibrated.append('weight')

    # Chốt chặn giải phẫu: số nào không thể tồn tại trên một người thật thì bỏ
    # hẳn, không hiển thị. Ảnh chụp màn hình app (có cả chrome giao diện) và ảnh
    # cắt sát hông từng cho ra "vòng hông 57cm" và "vòng eo 114cm" theo đường
    # xấp xỉ elip — cả hai đều đi qua mọi kiểm tra cũ.
    girths, rejected_girths = girth_plausibility(girths, height.get('valueCm'))
    if rejected_girths:
        warnings.append(
            'Một số vòng đo bị loại vì không hợp lý về giải phẫu: '
            + '; '.join(f'{key} ({reason})' for key, reason in rejected_girths.items())
            + '. Hãy chụp lại toàn thân, đứng thẳng, nền đơn giản.')

    weight_ok, weight_reason = weight_plausibility(weight.get('valueKg'), height.get('valueCm'))
    if not weight_ok:
        warnings.append(f'Cân nặng ước lượng bị loại vì {weight_reason}.')
        weight = {**weight, 'valueKg': None, 'minKg': None, 'maxKg': None,
                  'implausible': True, 'implausibleReason': weight_reason,
                  'model': weight.get('model')}

    # API/UI không trình bày một con số vòng đo đơn lẻ như thể đã dùng thước.
    # Mỗi vòng được đưa vào một bin đúng 10 cm; khoảng sai số rộng hơn vẫn giữ
    # riêng vì silhouette có cả lớp quần áo và có thể bị tay che/phồng ra.
    girth_ranges = {}
    for key, value in girths.items():
        display_min, display_max = _display_bin(value)
        if display_min is None:
            continue
        model_confidence = 0.82 if girth_source == 'ansur2-regressor' else 0.55
        confidence = round(_clamp(quality * model_confidence, 0.0, 0.82), 3)
        spread = max(6.0, float(value) * (0.06 + 0.10 * (1.0 - confidence)))
        girth_ranges[key] = {
            'valueCm': value,
            'minCm': display_min,
            'maxCm': display_max,
            'uncertaintyMinCm': round(max(0.0, float(value) - spread), 1),
            'uncertaintyMaxCm': round(float(value) + spread, 1),
            'displayBinCm': [display_min, display_max],
            'confidence': confidence,
            'source': 'image_estimate',
            'model': girth_source,
        }

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
        'estimatedGirthRanges': girth_ranges,
        'rejectedGirths': rejected_girths or None,
        'populationCalibrated': population_calibrated or None,
        'girthsMeasureClothing': True,
        'girthSource': girth_source,
        'models': {
            'weight': weight.get('model'),
            'girth': girth_source,
            'anthropometry': ANTHROPOMETRY_SOURCE,
        },
        'quality': {
            'fullBodyVisible': measure['coverage'] == 'full',
            'armsMergedIntoTorso': measure.get('armsMergedIntoTorso', False),
            'shoulderJointSpanPx': round(measure.get('shoulderJointSpanPx', 0.0), 1),
            'hipJointSpanPx': round(measure.get('hipJointSpanPx', 0.0), 1),
            'clothingSlack': measure.get('clothingSlack', 1.0),
            'feetVisible': measure['feetVisible'],
            'headVisible': measure['headVisible'],
            'segmentationAvailable': measure['hasMask'],
            'coverage': measure['coverage'],
            'tiltDeg': round(measure['tiltDeg'], 1),
            'poseConfidence': round(float(pose.get('confidence') or 0.0), 3),
            'analysisConfidence': quality,
        },
        'torsoProfile': {
            level: {key: value for key, value in measure['torsoProfile'][level].items()}
            for level in ('shoulder', 'chest', 'waist', 'hip')
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
