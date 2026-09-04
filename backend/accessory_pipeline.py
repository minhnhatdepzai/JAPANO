import base64
import io
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
POSE_MODEL = ROOT / 'backend/models/yolov8n-pose.pt'
TARGET_SIZE = (768, 1024)


def decode_image(value):
    text = str(value or '')
    if text.startswith('data:') and ',' in text:
        text = text.split(',', 1)[1]
    # Camera Android/iOS thường lưu chiều xoay trong EXIF thay vì xoay pixel.
    # Nếu bỏ qua EXIF, YOLO nhìn người nằm ngang và CatVTON crop sai thân người.
    source = Image.open(io.BytesIO(base64.b64decode(text)))
    return ImageOps.exif_transpose(source).convert('RGBA')


def encode_png(image):
    out = io.BytesIO()
    image.convert('RGB').save(out, 'PNG')
    return base64.b64encode(out.getvalue()).decode('ascii')


def subject_crop(width, height, box, points=None, point_conf=None):
    """Tạo khung 3:4 quanh đúng người chính, cho phép pad ra ngoài ảnh.

    CatVTON luôn đưa ảnh về 768x1024 bằng center-crop. Chuẩn hoá trước giúp
    người ngồi, nằm nghiêng, đứng lệch tâm hoặc ảnh ngang không bị cắt mất thân.
    """
    x1, y1, x2, y2 = [float(v) for v in box]
    visible = []
    if points is not None:
        for index, point in enumerate(points):
            confidence = float(point_conf[index]) if point_conf is not None else 1.0
            if confidence >= 0.06 and float(point[0]) > 0 and float(point[1]) > 0:
                visible.append((float(point[0]), float(point[1])))
    if visible:
        x1 = min(x1, *(point[0] for point in visible))
        y1 = min(y1, *(point[1] for point in visible))
        x2 = max(x2, *(point[0] for point in visible))
        y2 = max(y2, *(point[1] for point in visible))

    box_w, box_h = max(1.0, x2 - x1), max(1.0, y2 - y1)
    content_x1 = x1 - box_w * 0.16
    content_x2 = x2 + box_w * 0.16
    content_y1 = y1 - box_h * 0.09
    content_y2 = y2 + box_h * 0.07
    content_w = content_x2 - content_x1
    content_h = content_y2 - content_y1
    target_ratio = TARGET_SIZE[0] / TARGET_SIZE[1]
    crop_w = max(content_w, content_h * target_ratio)
    crop_h = crop_w / target_ratio
    center_x = (content_x1 + content_x2) / 2
    center_y = (content_y1 + content_y2) / 2

    # Ảnh cắt nửa người cần thêm không gian phía dưới cho áo/váy; ảnh đủ người
    # giữ tâm hình học để không làm bàn chân rơi khỏi khung.
    if y2 >= height * 0.94 and y1 > height * 0.04:
        center_y -= crop_h * 0.025
    return (center_x - crop_w / 2, center_y - crop_h / 2,
            center_x + crop_w / 2, center_y + crop_h / 2)


def crop_and_pad(image, crop):
    left, top, right, bottom = crop
    crop_w = max(2, int(round(right - left)))
    crop_h = max(2, int(round(bottom - top)))
    # Nền pad dùng chính ảnh làm mờ, tránh viền đen khi người sát mép ảnh.
    background = ImageOps.fit(image.convert('RGB'), (crop_w, crop_h), method=Image.Resampling.LANCZOS)
    background = background.filter(ImageFilter.GaussianBlur(max(8, int(min(crop_w, crop_h) * .025))))
    src_left, src_top = max(0, int(math.floor(left))), max(0, int(math.floor(top)))
    src_right, src_bottom = min(image.width, int(math.ceil(right))), min(image.height, int(math.ceil(bottom)))
    if src_right > src_left and src_bottom > src_top:
        piece = image.convert('RGB').crop((src_left, src_top, src_right, src_bottom))
        background.paste(piece, (int(round(src_left - left)), int(round(src_top - top))))
    return background.resize(TARGET_SIZE, Image.Resampling.LANCZOS)


def target_transform(crop, x, y):
    left, top, right, bottom = crop
    return (float((x - left) * TARGET_SIZE[0] / max(1.0, right - left)),
            float((y - top) * TARGET_SIZE[1] / max(1.0, bottom - top)))


def fallback_pose():
    return {
        'box': [150, 50, 620, 1000],
        'keypoints': {},
        'confidence': 0,
        'fallback': True,
        'otherBoxes': [],
        'otherConfidences': [],
        'personCount': 0,
        'inferredKeypoints': [],
        'garmentRegion': {
            'ok': False,
            'reason': 'no_person',
            'message': 'Chưa nhận rõ người chính trong ảnh. Hãy dùng ảnh sáng hơn và để người chiếm phần lớn khung hình.',
        },
        'poseSuitability': {
            'requiresRepose': True,
            'score': 0,
            'reasons': ['no_person'],
        },
    }


def infer_pose_keypoints(keypoints, box):
    """Bù các khớp bị khuất bằng tỷ lệ cơ thể trong box của người chính."""
    x1, y1, x2, y2 = [float(v) for v in box]
    width, height = max(1.0, x2 - x1), max(1.0, y2 - y1)
    estimates = {
        'left_eye': (.43, .105), 'right_eye': (.57, .105),
        'left_ear': (.37, .12), 'right_ear': (.63, .12),
        'left_shoulder': (.31, .24), 'right_shoulder': (.69, .24),
        'left_elbow': (.25, .40), 'right_elbow': (.75, .40),
        'left_wrist': (.22, .55), 'right_wrist': (.78, .55),
        'left_hip': (.40, .57), 'right_hip': (.60, .57),
        'left_knee': (.41, .77), 'right_knee': (.59, .77),
        'left_ankle': (.41, .96), 'right_ankle': (.59, .96),
    }
    inferred = []
    result = dict(keypoints or {})
    for name, (rx, ry) in estimates.items():
        if name not in result:
            result[name] = [round(x1 + width * rx, 2), round(y1 + height * ry, 2), 0.05]
            inferred.append(name)
    return result, inferred


def garment_region_quality(pose):
    # Đánh giá xem ảnh có phù hợp để thay đồ không, dựa trên khớp cơ thể đã phát
    # hiện. Trả về ok=False + lý do khi vùng trang phục bị che (tay khoanh/che
    # ngực) hoặc thân trên không rõ — để chặn ngay trước khi gọi CatVTON tốn thời
    # gian và tránh trả ảnh hỏng. Ước lượng heuristic, ưu tiên không chặn nhầm ảnh tốt.
    if pose.get('fallback'):
        return {'ok': False, 'reason': 'no_person',
                'message': 'Chưa nhận rõ một người chính trong ảnh. Hãy chọn ảnh có một người đứng rõ ràng.'}
    kp = pose.get('keypoints') or {}
    x1, y1, x2, y2 = pose['box']
    box_w = max(1.0, x2 - x1)

    def has(name):
        return name in kp
    has_shoulders = has('left_shoulder') and has('right_shoulder')
    if not has_shoulders:
        return {'ok': True, 'reason': 'estimated_torso',
                'message': 'Vùng vai bị khuất; hệ thống sẽ ước lượng theo người chính.'}

    shoulder_y = (kp['left_shoulder'][1] + kp['right_shoulder'][1]) / 2
    shoulder_xs = [kp['left_shoulder'][0], kp['right_shoulder'][0]]
    hips = [kp[name][1] for name in ('left_hip', 'right_hip') if has(name)]
    hip_y = min(hips) if hips else shoulder_y + (y2 - y1) * 0.45
    torso_h = max(1.0, hip_y - shoulder_y)

    # Vùng trang phục = quanh ngực/thân trên, nới nhẹ theo bề ngang vai.
    margin = box_w * 0.12
    torso_x_min = min(shoulder_xs) - margin
    torso_x_max = max(shoulder_xs) + margin
    chest_y_min = shoulder_y - torso_h * 0.28
    chest_y_max = shoulder_y + torso_h * 0.72

    def wrist_over_chest(name):
        if not has(name):
            return False
        wx, wy = kp[name][0], kp[name][1]
        return torso_x_min <= wx <= torso_x_max and chest_y_min <= wy <= chest_y_max

    if wrist_over_chest('left_wrist') and wrist_over_chest('right_wrist'):
        return {'ok': False, 'reason': 'hands_cover_chest',
                'message': 'Hai tay đang che vùng trang phục; hệ thống sẽ tăng cường mask thân người để vẫn thử đồ.'}

    return {'ok': True, 'reason': 'ok', 'message': ''}


def pose_suitability(pose):
    """Quyết định có cần dựng lại thân người về pose thử đồ chuẩn hay không."""
    if pose.get('fallback'):
        return {'requiresRepose': False, 'score': 0, 'reasons': ['no_person']}
    kp = pose.get('keypoints') or {}
    x1, y1, x2, y2 = [float(value) for value in pose['box']]
    box_w, box_h = max(1.0, x2 - x1), max(1.0, y2 - y1)
    reasons = []

    def point(name):
        value = kp.get(name)
        return (float(value[0]), float(value[1])) if value else None

    left_shoulder, right_shoulder = point('left_shoulder'), point('right_shoulder')
    left_hip, right_hip = point('left_hip'), point('right_hip')
    if left_shoulder and right_shoulder:
        shoulder_span = abs(left_shoulder[0] - right_shoulder[0])
        shoulder_tilt = abs(left_shoulder[1] - right_shoulder[1]) / box_h
        if shoulder_span < box_w * .28:
            reasons.append('side_profile')
        if shoulder_tilt > .085:
            reasons.append('tilted_shoulders')
        shoulder_y = (left_shoulder[1] + right_shoulder[1]) / 2
        shoulder_min_x = min(left_shoulder[0], right_shoulder[0]) - box_w * .10
        shoulder_max_x = max(left_shoulder[0], right_shoulder[0]) + box_w * .10
        hip_values = [point(name) for name in ('left_hip', 'right_hip')]
        hip_values = [value for value in hip_values if value]
        hip_y = sum(value[1] for value in hip_values) / len(hip_values) if hip_values else shoulder_y + box_h * .36
        torso_h = max(box_h * .20, hip_y - shoulder_y)
        risky_wrists = 0
        for name in ('left_wrist', 'right_wrist'):
            wrist = point(name)
            if wrist and shoulder_min_x <= wrist[0] <= shoulder_max_x and shoulder_y - torso_h * .32 <= wrist[1] <= hip_y:
                risky_wrists += 1
        raised_elbows = sum(1 for name in ('left_elbow', 'right_elbow') if point(name) and point(name)[1] < shoulder_y + torso_h * .34)
        raised_wrists = sum(1 for name in ('left_wrist', 'right_wrist') if point(name) and point(name)[1] < shoulder_y + torso_h * .18)
        if risky_wrists >= 2 or (risky_wrists >= 1 and raised_elbows >= 1):
            reasons.append('hands_cover_torso')
        # Hai tay giơ cao/đưa ngang tuy không che ngực vẫn làm VTON dễ kéo méo
        # tay áo và giữ nguyên pose xấu. Đưa riêng nhân vật chính về pose catalog
        # trước khi mặc thay vì cố ghép trực tiếp như pipeline cũ.
        if raised_wrists >= 1 or raised_elbows >= 2:
            reasons.append('arms_raised')
    if left_hip and right_hip and left_shoulder and right_shoulder:
        shoulder_center = (left_shoulder[0] + right_shoulder[0]) / 2
        hip_center = (left_hip[0] + right_hip[0]) / 2
        if abs(shoulder_center - hip_center) > box_w * .14:
            reasons.append('leaning_body')

    # Độ tin cậy thấp/nhiều khớp phải nội suy cũng cần dựng pose trước khi mặc.
    inferred = pose.get('inferredKeypoints') or []
    if any(name in inferred for name in ('left_shoulder', 'right_shoulder', 'left_hip', 'right_hip')):
        reasons.append('occluded_torso')
    reasons = list(dict.fromkeys(reasons))
    return {
        'requiresRepose': bool(reasons),
        'score': max(0, 100 - len(reasons) * 24),
        'reasons': reasons,
    }


def analyze(image, include_normalized=False, source_coordinates=False):
    from ultralytics import YOLO

    rgb = image.convert('RGB')
    width, height = rgb.size
    model = YOLO(str(POSE_MODEL))
    result = model.predict(np.asarray(rgb), imgsz=640, conf=0.16, verbose=False, device='cpu')[0]
    if result.boxes is None or len(result.boxes) == 0:
        # Lượt hai chỉ chạy khi ảnh khó: tăng độ phân giải và hạ confidence để
        # nhận người ngồi, nghiêng mạnh hoặc bị cắt một phần cơ thể.
        result = model.predict(np.asarray(rgb), imgsz=960, conf=0.07, verbose=False, device='cpu')[0]
    if result.boxes is None or len(result.boxes) == 0:
        pose = fallback_pose()
        if source_coordinates:
            pose['box'] = [round(width * .195, 2), round(height * .049, 2),
                           round(width * .807, 2), round(height * .977, 2)]
        return (pose, None) if include_normalized else pose

    boxes = result.boxes.xyxy.cpu().numpy()
    confidences = result.boxes.conf.cpu().numpy()
    points = result.keypoints.xy.cpu().numpy() if result.keypoints is not None else np.zeros((len(boxes), 17, 2))
    point_conf = result.keypoints.conf.cpu().numpy() if result.keypoints is not None and result.keypoints.conf is not None else np.ones((len(boxes), 17))
    center = np.array([width / 2, height / 2])
    diagonal = max(1.0, math.hypot(width, height))
    # Ảnh nhiều người: CHỈ MỘT người được thay đồ, và đó phải là người TO NHẤT,
    # GẦN ỐNG KÍNH NHẤT. Những người còn lại được giữ nguyên (xem otherBoxes,
    # restore_secondary_people và cổng secondary_person_changed).
    #
    # Không có chiều sâu thật từ một ảnh đơn, nên "gần ống kính" được đo bằng KÍCH
    # THƯỚC BIỂU KIẾN. Dùng riêng diện tích thì hụt: người đứng sát máy thường bị
    # cắt mất chân, nên diện tích box của họ có thể nhỏ hơn người đứng xa mà thấy
    # trọn người. Chiều CAO box bắt được điều đó tốt hơn, nên nó có trọng số riêng.
    #
    # Vị trí trong khung chỉ còn là tiêu chí phụ để phân xử khi hai người xấp xỉ
    # bằng nhau — trước đây centrality + contains_center cộng lại tới 4.5 điểm,
    # đủ để một người nhỏ hơn đứng giữa khung thắng người to đứng lệch.
    scored = []
    for index, box in enumerate(boxes):
        x1, y1, x2, y2 = box
        area = max(1.0, (x2 - x1) * (y2 - y1)) / max(1.0, width * height)
        box_height = max(1.0, y2 - y1) / max(1.0, height)
        box_center = np.array([(x1 + x2) / 2, (y1 + y2) / 2])
        centrality = max(0.0, 1.0 - np.linalg.norm(box_center - center) / diagonal)
        contains_center = 1.0 if x1 <= center[0] <= x2 and y1 <= center[1] <= y2 else 0.0
        score = (area * 6.0 + box_height * 4.0
                 + centrality * 0.8 + contains_center * 0.7
                 + float(confidences[index]) * 0.5)
        scored.append((score, index))
    _, selected = max(scored)
    subject_scores = [
        {
            'index': index,
            'score': round(float(score), 4),
            'areaRatio': round(float(max(1.0, (boxes[index][2] - boxes[index][0])
                                         * (boxes[index][3] - boxes[index][1]))
                                     / max(1.0, width * height)), 4),
            'heightRatio': round(float(max(1.0, boxes[index][3] - boxes[index][1])
                                       / max(1.0, height)), 4),
            'confidence': round(float(confidences[index]), 4),
            'selected': index == selected,
        }
        for score, index in sorted(scored, reverse=True)
    ]

    names = ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder',
             'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
             'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle']
    if source_coordinates:
        # Các bước ghép/kiểm tra thao tác trực tiếp trên ảnh hiện tại. Đặc biệt
        # chế độ GPU ít bộ nhớ trả 576x768, không được dùng nhầm tọa độ chuẩn
        # 768x1024 rồi dán phụ kiện lệch sang phải và xuống dưới.
        crop = (0.0, 0.0, float(width), float(height))
        normalized = rgb
        transform = lambda x, y: (float(x), float(y))
        target_width, target_height = width, height
    else:
        crop = subject_crop(width, height, boxes[selected], points[selected], point_conf[selected])
        normalized = crop_and_pad(rgb, crop)
        transform = lambda x, y: target_transform(crop, x, y)
        target_width, target_height = TARGET_SIZE
    transformed = {}
    raw_kp = {}
    for index, name in enumerate(names):
        conf = float(point_conf[selected][index])
        x, y = points[selected][index]
        # Bỏ hẳn điểm quá yếu (nhiễu), nhưng giữ ngưỡng thấp cho việc phát hiện
        # tay che ngực để bắt được cả tư thế tay khó (chắp tay, ôm đồ trước ngực).
        if conf < 0.06:
            continue
        tx, ty = transform(float(x), float(y))
        raw_kp[name] = [round(tx, 2), round(ty, 2), round(conf, 3)]
        if conf >= 0.18:
            transformed[name] = [round(tx, 2), round(ty, 2), round(conf, 3)]
    x1, y1 = transform(boxes[selected][0], boxes[selected][1])
    x2, y2 = transform(boxes[selected][2], boxes[selected][3])
    box = [max(0, round(x1, 2)), max(0, round(y1, 2)),
           min(target_width, round(x2, 2)), min(target_height, round(y2, 2))]
    other_boxes = []
    other_confidences = []
    selected_box = boxes[selected]
    selected_area = max(1.0, (selected_box[2] - selected_box[0]) * (selected_box[3] - selected_box[1]))
    for index, other in enumerate(boxes):
        if index == selected:
            continue
        other_confidence = float(confidences[index])
        other_area = max(0.0, (other[2] - other[0]) * (other[3] - other[1]))
        overlap_x = max(0.0, min(selected_box[2], other[2]) - max(selected_box[0], other[0]))
        overlap_y = max(0.0, min(selected_box[3], other[3]) - max(selected_box[1], other[1]))
        overlap = overlap_x * overlap_y
        # Low-confidence fragments (a sleeve, reflection, blurred padding) were
        # previously treated as a second person. That made the quality gate
        # reject valid one-person results as secondary_person_changed.
        if other_confidence < .35 or other_area < width * height * .018:
            continue
        if overlap / max(1.0, other_area) > .62 or overlap / selected_area > .62:
            continue
        ox1, oy1 = transform(other[0], other[1])
        ox2, oy2 = transform(other[2], other[3])
        transformed_other = [max(0, round(ox1, 2)), max(0, round(oy1, 2)),
                             min(target_width, round(ox2, 2)), min(target_height, round(oy2, 2))]
        if transformed_other[2] - transformed_other[0] < 36 or transformed_other[3] - transformed_other[1] < 72:
            continue
        other_boxes.append(transformed_other)
        other_confidences.append(round(other_confidence, 3))
    transformed, inferred = infer_pose_keypoints(transformed, box)
    pose = {
        'box': box,
        'keypoints': transformed,
        'otherBoxes': other_boxes,
        'otherConfidences': other_confidences,
        'personCount': 1 + len(other_boxes),
        # Vì sao đúng người này được chọn — để log/UI giải thích được khi ảnh có
        # nhiều người và khách thấy hệ thống thay đồ cho "người kia".
        'subjectSelection': {
            'rule': 'to nhất + gần ống kính nhất (diện tích x6 + chiều cao box x4), vị trí chỉ để phân xử',
            'dressedPersonCount': 1,
            'candidates': subject_scores,
        },
        'confidence': round(float(confidences[selected]), 3),
        'fallback': False,
        'inferredKeypoints': inferred,
        'normalization': {
            'sourceSize': [width, height],
            'crop': [round(value, 2) for value in crop],
            'targetSize': [target_width, target_height],
        },
    }
    # Dùng keypoint ngưỡng thấp (raw_kp) để đánh giá tay che ngực nhạy hơn.
    pose['garmentRegion'] = garment_region_quality({'box': box, 'keypoints': raw_kp, 'fallback': False})
    pose['poseSuitability'] = pose_suitability(pose)
    return (pose, normalized) if include_normalized else pose


def remove_background(path):
    source = Image.open(path).convert('RGBA')
    # Ảnh catalog nền trắng được xử lý trực tiếp để giữ chi tiết vải; ảnh có
    # cảnh nền như ô/dù dùng U2Net của rembg đã có sẵn trên máy.
    corner = np.asarray(source.convert('RGB').resize((64, 64)))
    bright_ratio = float(np.mean(np.all(corner > 235, axis=2)))
    if bright_ratio > 0.55:
        data = np.asarray(source).copy()
        rgb = data[:, :, :3].astype(np.int32)
        distance = np.sqrt(np.sum((255 - rgb) ** 2, axis=2))
        alpha = np.clip((distance - 7) * 12, 0, 255).astype(np.uint8)
        data[:, :, 3] = np.minimum(data[:, :, 3], alpha)
        cutout = Image.fromarray(data, 'RGBA')
    else:
        from rembg import remove
        cutout = remove(source).convert('RGBA')
    cleaned = np.asarray(cutout).copy()
    alpha = cleaned[:, :, 3]
    alpha[alpha < 28] = 0
    cleaned[:, :, 3] = alpha
    cutout = Image.fromarray(cleaned, 'RGBA')
    bbox = cutout.getbbox()
    return cutout.crop(bbox) if bbox else cutout


def keypoint(pose, name, fallback):
    value = (pose.get('keypoints') or {}).get(name)
    return (float(value[0]), float(value[1])) if value else fallback


def resize_alpha(image, width):
    width = max(20, int(width))
    height = max(20, int(image.height * width / max(1, image.width)))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def paste_with_shadow(canvas, item, xy, blur=8, opacity=90):
    x, y = map(int, xy)
    if opacity > 0:
        shadow = Image.new('RGBA', item.size, (0, 0, 0, 0))
        alpha = item.getchannel('A').point(lambda value: value * opacity // 255)
        shadow.putalpha(alpha)
        shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
        canvas.alpha_composite(shadow, (x + 4, y + 7))
    canvas.alpha_composite(item, (x, y))


def add_hat(canvas, item, pose):
    x1, y1, x2, y2 = pose['box']
    left_eye = keypoint(pose, 'left_eye', (x1 + (x2 - x1) * .43, y1 + (y2 - y1) * .12))
    right_eye = keypoint(pose, 'right_eye', (x1 + (x2 - x1) * .57, y1 + (y2 - y1) * .12))
    left_ear = keypoint(pose, 'left_ear', (left_eye[0] - (x2 - x1) * .09, left_eye[1]))
    right_ear = keypoint(pose, 'right_ear', (right_eye[0] + (x2 - x1) * .09, right_eye[1]))
    face_width = max(abs(right_ear[0] - left_ear[0]), abs(right_eye[0] - left_eye[0]) * 2.1, (x2 - x1) * .2)
    hat = resize_alpha(item, min((x2 - x1) * .62, face_width * 1.85))
    center_x = (left_eye[0] + right_eye[0]) / 2
    # Ảnh catalog mũ thường có vành nằm sát đáy cutout. Neo đáy mũ phía trên
    # đường mắt để bản ghép thô không che mặt; FLUX refinement sẽ xử lý tóc và
    # bóng tiếp xúc ở bước sau.
    brim_y = (left_eye[1] + right_eye[1]) / 2 - face_width * .55
    paste_with_shadow(canvas, hat, (center_x - hat.width / 2, brim_y - hat.height), blur=5, opacity=65)
    return 'đội nón đúng vị trí đầu'


def add_hair_clip(canvas, item, pose):
    x1, y1, x2, y2 = pose['box']
    box_w = x2 - x1
    left_eye = keypoint(pose, 'left_eye', (x1 + box_w * .43, y1 + (y2 - y1) * .12))
    right_eye = keypoint(pose, 'right_eye', (x1 + box_w * .57, y1 + (y2 - y1) * .12))
    left_ear = keypoint(pose, 'left_ear', (left_eye[0] - box_w * .09, left_eye[1]))
    right_ear = keypoint(pose, 'right_ear', (right_eye[0] + box_w * .09, right_eye[1]))
    face_width = max(abs(right_ear[0] - left_ear[0]), box_w * .2)
    clip = resize_alpha(item, min(box_w * .23, face_width * .72))
    # Dùng phía có nhiều khoảng trống hơn, ghim vào tóc ngang thái dương. Neo
    # theo tâm thay vì đáy ảnh để phần tua của trâm rủ xuống tự nhiên.
    # Tọa độ left/right của COCO là theo cơ thể người (nên có thể đảo với bên
    # trái/phải màn hình). Chọn trực tiếp tai gần mép ảnh hơn và đẩy phụ kiện
    # ra phía ngoài khuôn mặt.
    ear = min((left_ear, right_ear), key=lambda point: min(point[0], canvas.width - point[0]))
    side = -1 if ear[0] < (left_eye[0] + right_eye[0]) / 2 else 1
    center_x = ear[0] + side * face_width * .08
    center_y = ear[1] - face_width * .20
    paste_with_shadow(canvas, clip, (center_x - clip.width / 2, center_y - clip.height * .30), blur=3, opacity=45)
    return 'kẹp vào tóc cạnh thái dương'


def add_earmuffs(canvas, item, pose):
    x1, y1, x2, y2 = pose['box']
    box_w = x2 - x1
    left_eye = keypoint(pose, 'left_eye', (x1 + box_w * .43, y1 + (y2 - y1) * .12))
    right_eye = keypoint(pose, 'right_eye', (x1 + box_w * .57, y1 + (y2 - y1) * .12))
    left_ear = keypoint(pose, 'left_ear', (left_eye[0] - box_w * .09, left_eye[1]))
    right_ear = keypoint(pose, 'right_ear', (right_eye[0] + box_w * .09, right_eye[1]))
    face_width = max(abs(right_ear[0] - left_ear[0]), box_w * .2)
    earmuffs = resize_alpha(item, min(box_w * .40, face_width * 1.18))
    center_x = (left_ear[0] + right_ear[0]) / 2
    ear_y = (left_ear[1] + right_ear[1]) / 2
    # Lưu mặt trước khi đặt chụp tai; sau đó dán lại bằng mask mềm để bản ghép
    # thô đã thể hiện đúng quan hệ che khuất: vòng/đệm nằm sau tóc và hai bên
    # tai, tuyệt đối không nằm đè như sticker lên mắt mũi.
    fx1 = max(0, int(center_x - face_width * .43))
    fy1 = max(0, int(min(left_eye[1], right_eye[1]) - face_width * .30))
    fx2 = min(canvas.width, int(center_x + face_width * .43))
    fy2 = min(canvas.height, int(ear_y + face_width * .82))
    face_patch = canvas.crop((fx1, fy1, fx2, fy2))
    # Ảnh reference đứng riêng có vòng chụp ở nửa trên và hai đệm tai ở đáy.
    paste_with_shadow(canvas, earmuffs, (center_x - earmuffs.width / 2, ear_y - earmuffs.height * .57), blur=4, opacity=55)
    if face_patch.width and face_patch.height:
        mask = Image.new('L', face_patch.size, 0)
        ImageDraw.Draw(mask).ellipse((2, 1, face_patch.width - 2, face_patch.height - 1), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(max(2, int(face_width * .025))))
        canvas.paste(face_patch, (fx1, fy1), mask)
    return 'đeo hai bên tai và vòng qua đỉnh đầu'


def add_umbrella(canvas, item, pose):
    x1, y1, x2, y2 = pose['box']
    box_w, box_h = x2 - x1, y2 - y1
    left_eye = keypoint(pose, 'left_eye', (x1 + box_w * .43, y1 + box_h * .12))
    right_eye = keypoint(pose, 'right_eye', (x1 + box_w * .57, y1 + box_h * .12))
    face_width = max(abs(right_eye[0] - left_eye[0]) * 2.1, box_w * .2)
    head_top = min(left_eye[1], right_eye[1]) - face_width * .55
    left = keypoint(pose, 'left_wrist', (x1 + box_w * .22, y1 + box_h * .48))
    right = keypoint(pose, 'right_wrist', (x2 - box_w * .22, y1 + box_h * .48))
    umbrella = resize_alpha(item, min(320, max(160, face_width * 2.6)))
    # Tán ô luôn nổi phía trên đỉnh đầu thật (chừa khoảng hở), không đè lên
    # mặt; chọn tay tạo được tán ô ở phía trống nhất, phạt mạnh vùng giao với
    # người phụ để phụ kiện không che hoặc bị hiểu là gắn vào họ.
    candidates = []
    for wrist in (left, right):
        side = -1 if wrist[0] < (x1 + x2) / 2 else 1
        center_x = wrist[0] + side * box_w * .28
        center_y = head_top - umbrella.height * .55
        box = [center_x - umbrella.width / 2, center_y - umbrella.height / 2,
               center_x + umbrella.width / 2, center_y + umbrella.height / 2]
        penalty = max(0, -box[0]) + max(0, box[2] - canvas.width)
        for other in pose.get('otherBoxes') or []:
            overlap_w = max(0, min(box[2], other[2]) - max(box[0], other[0]))
            overlap_h = max(0, min(box[3], other[3]) - max(box[1], other[1]))
            penalty += overlap_w * overlap_h * .05
        penalty += wrist[1] * .02
        candidates.append((penalty, wrist, side))
    _, wrist, side = min(candidates, key=lambda value: value[0])
    canopy_center_x = wrist[0] + side * box_w * .28
    canopy_center_y = head_top - umbrella.height * .55
    ux = max(-umbrella.width * .12, min(canvas.width - umbrella.width * .88, canopy_center_x - umbrella.width / 2))
    uy = max(-umbrella.height * .18, canopy_center_y - umbrella.height / 2)
    paste_with_shadow(canvas, umbrella, (ux, uy), opacity=0)

    center = (int(ux + umbrella.width / 2), int(uy + umbrella.height / 2))
    hand = (int(wrist[0]), int(wrist[1]))
    # Lưu vùng bàn tay trước khi vẽ cán. Dán lại phần giữa bàn tay sau đó tạo
    # occlusion cán-nằm-sau-ngón thay cho chấm tròn màu da giả của bản cũ.
    hand_radius = max(10, int(box_w * .045))
    hx1, hy1 = max(0, hand[0] - hand_radius), max(0, hand[1] - hand_radius)
    hx2, hy2 = min(canvas.width, hand[0] + hand_radius), min(canvas.height, hand[1] + hand_radius)
    hand_patch = canvas.crop((hx1, hy1, hx2, hy2))
    draw = ImageDraw.Draw(canvas, 'RGBA')
    draw.line((center[0] + 3, center[1] + 4, hand[0] + 3, hand[1] + 4), fill=(0, 0, 0, 80), width=7)
    draw.line((center[0], center[1], hand[0], hand[1]), fill=(94, 52, 48, 255), width=4)
    if hand_patch.width and hand_patch.height:
        mask = Image.new('L', hand_patch.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        inset = max(2, int(hand_radius * .38))
        mask_draw.ellipse((inset, inset, hand_patch.width - inset, hand_patch.height - inset), fill=230)
        mask = mask.filter(ImageFilter.GaussianBlur(max(2, int(hand_radius * .12))))
        canvas.paste(hand_patch, (hx1, hy1), mask)
    return 'đặt ô vào tay có tư thế phù hợp nhất'


def add_shoe(canvas, item, pose):
    x1, y1, x2, y2 = pose['box']
    box_w, box_h = x2 - x1, y2 - y1
    left_ankle = keypoint(pose, 'left_ankle', (x1 + box_w * .38, y2 - box_h * .04))
    right_ankle = keypoint(pose, 'right_ankle', (x1 + box_w * .62, y2 - box_h * .04))
    # Reference hiện có là cả đôi, nên đặt giữa hai cổ chân và neo ĐÁY vào mặt
    # đất. Bản cũ neo một đôi vào một chân và thường đẩy nó ra ngoài mép ảnh.
    shoe = resize_alpha(item, max(90, min(330, box_w * .58)))
    center_x = (left_ankle[0] + right_ankle[0]) / 2
    # YOLO trả cổ chân, trong khi bàn chân kéo dài xuống thêm khoảng 7–10% thân.
    ground_y = min(canvas.height - 2, max(left_ankle[1], right_ankle[1]) + box_h * .10)
    paste_with_shadow(canvas, shoe, (center_x - shoe.width * .5, ground_y - shoe.height), blur=5, opacity=55)
    return 'mang đôi dép/giày vào hai bàn chân'


def body_mask(pose, size, grow=1.0):
    """Mặt nạ thô của thân + đầu, dựng từ khớp xương.

    Pipeline này chỉ có PIL và numpy, không có model tách người, nên không thể
    cắt chính xác viền cơ thể. Nhưng một đa giác vai–hông cộng một hình bầu dục
    đầu là đủ để biết chỗ nào LÀ người: dùng nó đục bớt phần ba lô chồng lên
    thân, phần còn lại lộ ra hai bên đúng như nhìn một người đeo ba lô từ phía
    trước. Không có bước này thì ba lô nằm đè lên ngực như dán decal.
    """
    x1, y1, x2, y2 = pose['box']
    box_w, box_h = x2 - x1, y2 - y1
    left_shoulder = keypoint(pose, 'left_shoulder', (x1 + box_w * .32, y1 + box_h * .22))
    right_shoulder = keypoint(pose, 'right_shoulder', (x1 + box_w * .68, y1 + box_h * .22))
    left_hip = keypoint(pose, 'left_hip', (x1 + box_w * .38, y1 + box_h * .56))
    right_hip = keypoint(pose, 'right_hip', (x1 + box_w * .62, y1 + box_h * .56))

    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    pad = max(6.0, abs(right_shoulder[0] - left_shoulder[0]) * .12 * grow)
    draw.polygon([
        (left_shoulder[0] - pad, left_shoulder[1] - pad),
        (right_shoulder[0] + pad, right_shoulder[1] - pad),
        (right_hip[0] + pad, right_hip[1] + pad),
        (left_hip[0] - pad, left_hip[1] + pad),
    ], fill=255)

    shoulder_mid_y = (left_shoulder[1] + right_shoulder[1]) / 2
    head_r = max(10.0, abs(right_shoulder[0] - left_shoulder[0]) * .42)
    head_cx = (left_shoulder[0] + right_shoulder[0]) / 2
    head_cy = shoulder_mid_y - head_r * .75
    draw.ellipse([head_cx - head_r, head_cy - head_r * 1.25,
                  head_cx + head_r, head_cy + head_r * 1.25], fill=255)
    # Làm mềm mép để chỗ giao giữa ba lô và thân không thành đường cắt gắt.
    return mask.filter(ImageFilter.GaussianBlur(max(2, int(pad * .5))))


def dominant_color(item):
    """Màu đại diện của phụ kiện, lấy từ các điểm ảnh không trong suốt."""
    small = item.resize((32, 32), Image.Resampling.LANCZOS)
    pixels = np.asarray(small.convert('RGBA'), dtype=np.float32)
    alpha = pixels[:, :, 3]
    solid = alpha > 40
    if not solid.any():
        return (60, 60, 66)
    rgb = pixels[:, :, :3][solid]
    return tuple(int(value) for value in rgb.mean(axis=0))


def add_backpack(canvas, item, pose):
    """Đeo ba lô SAU LƯNG, quai vắt qua hai vai — không phải cầm trên tay."""
    x1, y1, x2, y2 = pose['box']
    box_w, box_h = x2 - x1, y2 - y1
    left_shoulder = keypoint(pose, 'left_shoulder', (x1 + box_w * .32, y1 + box_h * .22))
    right_shoulder = keypoint(pose, 'right_shoulder', (x1 + box_w * .68, y1 + box_h * .22))
    left_hip = keypoint(pose, 'left_hip', (x1 + box_w * .38, y1 + box_h * .56))
    right_hip = keypoint(pose, 'right_hip', (x1 + box_w * .62, y1 + box_h * .56))

    shoulder_w = max(40.0, abs(right_shoulder[0] - left_shoulder[0]))
    # Ba lô rộng hơn vai một chút thì mới ló ra hai bên sau khi bị thân che.
    pack = resize_alpha(item, min(box_w * .78, shoulder_w * 1.28))
    center_x = (left_shoulder[0] + right_shoulder[0]) / 2
    torso_h = max(1.0, ((left_hip[1] + right_hip[1]) / 2) - ((left_shoulder[1] + right_shoulder[1]) / 2))
    top = min(left_shoulder[1], right_shoulder[1]) + torso_h * .06

    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    layer.alpha_composite(pack, (int(center_x - pack.width / 2), int(top)))
    # Đục phần chồng lên thân/đầu: giữ lại hai mép ba lô nhìn thấy được.
    torso = body_mask(pose, canvas.size, grow=1.0)
    layer.putalpha(ImageChops.subtract(layer.getchannel('A'), torso))
    canvas.alpha_composite(layer)

    # Hai quai vắt qua vai, tô bằng chính tông màu của ba lô — đây là chi tiết
    # nói cho người xem biết món đồ đang được ĐEO chứ không phải dán phía sau.
    strap_color = dominant_color(pack)
    strap_rgb = tuple(max(0, int(channel * .78)) for channel in strap_color)
    straps = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    strap_draw = ImageDraw.Draw(straps)
    strap_w = max(4, int(shoulder_w * .11))
    for shoulder, hip in ((left_shoulder, left_hip), (right_shoulder, right_hip)):
        inner_x = shoulder[0] + (center_x - shoulder[0]) * .38
        strap_draw.line(
            [(shoulder[0], shoulder[1] - strap_w * .3), (inner_x, hip[1] - (hip[1] - shoulder[1]) * .28)],
            fill=strap_rgb + (235,), width=strap_w, joint='curve',
        )
    straps = straps.filter(ImageFilter.GaussianBlur(1))
    canvas.alpha_composite(straps)
    return 'đeo ba lô sau lưng, quai vắt qua hai vai'


def add_waist_sash(canvas, item, pose):
    """Thắt đai/obi ngang eo, bản ngang theo chiều rộng hông."""
    x1, y1, x2, y2 = pose['box']
    box_w, box_h = x2 - x1, y2 - y1
    left_hip = keypoint(pose, 'left_hip', (x1 + box_w * .38, y1 + box_h * .56))
    right_hip = keypoint(pose, 'right_hip', (x1 + box_w * .62, y1 + box_h * .56))
    left_shoulder = keypoint(pose, 'left_shoulder', (x1 + box_w * .32, y1 + box_h * .22))
    right_shoulder = keypoint(pose, 'right_shoulder', (x1 + box_w * .68, y1 + box_h * .22))

    hip_w = max(40.0, abs(right_hip[0] - left_hip[0]))
    sash = resize_alpha(item, hip_w * 1.32)
    # Obi thắt trên rốn, khoảng giữa vai và hông chứ không nằm đúng ở hông.
    shoulder_y = (left_shoulder[1] + right_shoulder[1]) / 2
    hip_y = (left_hip[1] + right_hip[1]) / 2
    waist_y = hip_y - (hip_y - shoulder_y) * .30
    center_x = (left_hip[0] + right_hip[0]) / 2
    paste_with_shadow(
        canvas, sash,
        (center_x - sash.width * .5, waist_y - sash.height * .5),
        blur=5, opacity=60,
    )
    return 'thắt đai ngang eo nhân vật chính'


def add_hand_prop(canvas, item, pose, kind):
    x1, y1, x2, y2 = pose['box']
    wrist = keypoint(pose, 'right_wrist', (x2 - (x2 - x1) * .2, y1 + (y2 - y1) * .5))
    width = (x2 - x1) * (.45 if kind in {'bag', 'sword'} else .25)
    prop = resize_alpha(item, width)
    paste_with_shadow(canvas, prop, (wrist[0] - prop.width * .5, wrist[1] - prop.height * .22))
    return 'gắn phụ kiện vào tay nhân vật chính'


def similarity_score(image_a, image_b, pose=None, cloth_type='upper'):
    # Đo độ khác biệt ở VÙNG THÂN TRÊN (nơi trang phục nằm) giữa ảnh gốc và ảnh
    # CatVTON trả về. Chỉ so vùng ngực/thân (không so nền) để bắt đúng trường hợp
    # CatVTON không thay được đồ và trả gần như nguyên ảnh gốc (diff ~0) dù báo
    # HTTP 200 OK. Thay đồ thật làm vùng này đổi rất nhiều (diff ~25+).
    def crop_garment(im):
        w, h = im.size
        if pose and pose.get('box'):
            x1, y1, x2, y2 = [float(value) for value in pose['box']]
            body_h = max(1.0, y2 - y1)
            if cloth_type == 'lower':
                region = (x1, y1 + body_h * .48, x2, y1 + body_h * .97)
            elif cloth_type == 'overall':
                region = (x1, y1 + body_h * .18, x2, y1 + body_h * .97)
            else:
                region = (x1, y1 + body_h * .18, x2, y1 + body_h * .62)
            return im.crop(tuple(int(max(0, min(value, w if index % 2 == 0 else h))) for index, value in enumerate(region)))
        return im.crop((int(w * 0.20), int(h * 0.22), int(w * 0.80), int(h * 0.68)))
    size = (64, 64)
    a = np.asarray(crop_garment(image_a).convert('L').resize(size), dtype=np.float32)
    b = np.asarray(crop_garment(image_b).convert('L').resize(size), dtype=np.float32)
    return float(np.abs(a - b).mean())


def _face_box(pose, size):
    """Khung mặt theo keypoint, dùng được cả khi hai ảnh khác vị trí người."""
    width, height = size
    box = (pose or {}).get('box') or []
    if len(box) != 4:
        return None
    x1, y1, x2, y2 = [float(value) for value in box]
    box_w, box_h = max(1.0, x2 - x1), max(1.0, y2 - y1)
    keypoints = (pose or {}).get('keypoints') or {}
    left_eye, right_eye = keypoints.get('left_eye'), keypoints.get('right_eye')
    left_ear, right_ear = keypoints.get('left_ear'), keypoints.get('right_ear')
    if left_eye and right_eye:
        eye_y = (float(left_eye[1]) + float(right_eye[1])) / 2
        center_x = (float(left_eye[0]) + float(right_eye[0])) / 2
        face_w = max(
            abs(float(right_eye[0]) - float(left_eye[0])) * 2.2,
            abs(float(right_ear[0]) - float(left_ear[0])) if left_ear and right_ear else 0,
            box_w * .20,
        )
        raw = (center_x - face_w * .62, eye_y - face_w * .34,
               center_x + face_w * .62, eye_y + face_w * .82)
    else:
        raw = (x1 + box_w * .25, y1, x2 - box_w * .25, y1 + box_h * .24)
    clipped = tuple(int(max(0, min(value, width if index % 2 == 0 else height)))
                    for index, value in enumerate(raw))
    return clipped if clipped[2] > clipped[0] and clipped[3] > clipped[1] else None


def _region_pair_diff(left_image, left_box, right_image, right_box, size=(96, 96)):
    if not left_box or not right_box:
        return None
    left = np.asarray(left_image.crop(left_box).resize(size, Image.Resampling.LANCZOS), dtype=np.float32)
    right = np.asarray(right_image.crop(right_box).resize(size, Image.Resampling.LANCZOS), dtype=np.float32)
    return float(np.abs(left - right).mean())


def tryon_quality(image_a, image_b, pose=None, cloth_type='upper', require_straight_pose=False,
                  fit_effect=None, strict_identity=False):
    """Reject successful-looking HTTP responses that are unusable try-on images.

    This intentionally checks structure, not merely pixel change: the old gate
    accepted a large smooth rectangle because it differed greatly from the
    source.  A usable result must still contain a detected person, textured or
    edged garment structure, and must not repaint secondary people.

    `fit_effect` mô tả hiệu ứng vừa vặn CÓ CHỦ ĐÍCH (vải căng, vải rủ rộng) do
    bước fit-refine tạo ra. Vải kéo căng làm bề mặt phẳng và mịn đi, nên nếu
    không biết trước, cổng chất lượng sẽ đánh nhầm một chiếc áo chật thành
    'flat_or_blurred_garment'. Nó chỉ nới ngưỡng kết cấu, không tắt kiểm tra.
    """
    source = image_a.convert('RGB')
    result = image_b.convert('RGB')
    if result.size != source.size:
        result = result.resize(source.size, Image.Resampling.LANCZOS)

    result_pose = analyze(result, source_coordinates=True)
    source_pose = pose if (pose and pose.get('box') and not pose.get('fallback')) else analyze(source, source_coordinates=True)
    reasons = []
    if result_pose.get('fallback') or float(result_pose.get('confidence') or 0) < .25:
        reasons.append('main_subject_lost')

    active_pose = result_pose if result_pose.get('box') else (pose or {})
    if active_pose.get('box'):
        x1, y1, x2, y2 = [float(value) for value in active_pose['box']]
        body_h = max(1.0, y2 - y1)
        if cloth_type == 'lower':
            region = (x1, y1 + body_h * .43, x2, y1 + body_h * .98)
        elif cloth_type == 'overall':
            region = (x1, y1 + body_h * .15, x2, y1 + body_h * .98)
        else:
            region = (x1, y1 + body_h * .15, x2, y1 + body_h * .65)
    else:
        w, h = result.size
        region = (w * .2, h * .18, w * .8, h * .82)

    w, h = result.size
    region = tuple(int(max(0, min(value, w if index % 2 == 0 else h))) for index, value in enumerate(region))
    garment = np.asarray(result.crop(region).convert('RGB'))
    if garment.size:
        gray = np.asarray(Image.fromarray(garment).convert('L'), dtype=np.uint8)
        gradient_x = np.abs(np.diff(gray.astype(np.float32), axis=1))
        gradient_y = np.abs(np.diff(gray.astype(np.float32), axis=0))
        edge_ratio = float(((gradient_x > 18).mean() + (gradient_y > 18).mean()) / 2)
        texture_std = float(gray.std())
    else:
        edge_ratio = 0.0
        texture_std = 0.0
    tension = float((fit_effect or {}).get('tension') or 0.0)
    edge_floor = .012 * (1 - .35 * tension)
    texture_floor = 24 * (1 - .30 * tension)
    if edge_ratio < edge_floor and texture_std < texture_floor:
        reasons.append('flat_or_blurred_garment')

    change_score = similarity_score(source, result, pose, cloth_type)
    if change_score < 10:
        reasons.append('garment_unchanged')

    secondary_diffs = []
    for other in (pose or {}).get('otherBoxes') or []:
        ox1, oy1, ox2, oy2 = [int(value) for value in other]
        ox1, ox2 = max(0, ox1), min(w, ox2)
        oy1, oy2 = max(0, oy1), min(h, oy2)
        if ox2 <= ox1 or oy2 <= oy1:
            continue
        a = np.asarray(source.crop((ox1, oy1, ox2, oy2)).resize((64, 64)), dtype=np.float32)
        b = np.asarray(result.crop((ox1, oy1, ox2, oy2)).resize((64, 64)), dtype=np.float32)
        diff = float(np.abs(a - b).mean())
        secondary_diffs.append(diff)
    if secondary_diffs and max(secondary_diffs) > 38:
        reasons.append('secondary_person_changed')

    output_suitability = result_pose.get('poseSuitability') or {}
    if require_straight_pose and output_suitability.get('requiresRepose'):
        reasons.append('pose_not_corrected')

    # Không đánh đổi danh tính để lấy một ảnh nhìn có vẻ đẹp. So mặt theo khung
    # riêng của từng ảnh nên vẫn dùng được khi output đã resize/crop.
    face_diff = _region_pair_diff(
        source, _face_box(source_pose, source.size),
        result, _face_box(result_pose, result.size),
    )
    body_drift = {}
    if strict_identity:
        if face_diff is None or face_diff > float(os.getenv('JAPANO_TRYON_FACE_DIFF_MAX', '45')):
            reasons.append('face_changed_or_covered')
        before = _body_geometry(source_pose, source.size)
        after = _body_geometry(result_pose, result.size)
        violations = []
        if before and after:
            for key, tolerance in (('eyeSpan', .22), ('eyeToNose', .22), ('noseY', .18), ('torso', .45)):
                if before.get(key) is None or after.get(key) is None:
                    continue
                drift = abs(after[key] - before[key]) / max(.02, abs(before[key]))
                body_drift[key] = round(drift, 3)
                if drift > tolerance:
                    violations.append(key)
            if len(violations) >= 2:
                reasons.append('body_changed_not_garment')

    reasons = list(dict.fromkeys(reasons))

    return {
        'ok': not reasons,
        'reasons': reasons,
        'changeScore': round(change_score, 3),
        'edgeRatio': round(edge_ratio, 4),
        'textureStd': round(texture_std, 3),
        'secondaryDiffs': [round(value, 3) for value in secondary_diffs],
        'faceDiff': round(face_diff, 3) if face_diff is not None else None,
        'bodyDrift': body_drift,
        'resultPose': result_pose,
    }


def add_safe_seam_split(image):
    """Vẽ một vết bục nhỏ đúng đường may mà không sinh lại người dùng."""
    result = image.convert('RGB').copy()
    pose = analyze(result, source_coordinates=True)
    keypoints = pose.get('keypoints') or {}
    candidates = []
    for side in ('left', 'right'):
        shoulder = keypoints.get(f'{side}_shoulder')
        elbow = keypoints.get(f'{side}_elbow')
        if not shoulder or not elbow:
            continue
        confidence = min(float(shoulder[2] if len(shoulder) > 2 else 1),
                         float(elbow[2] if len(elbow) > 2 else 1))
        candidates.append((confidence, shoulder, elbow, side))
    if not candidates:
        return result, {'applied': False, 'reason': 'shoulder_seam_not_found'}

    _, shoulder, elbow, side = max(candidates, key=lambda item: item[0])
    sx, sy = float(shoulder[0]), float(shoulder[1])
    ex, ey = float(elbow[0]), float(elbow[1])
    dx, dy = ex - sx, ey - sy
    norm = max(1.0, math.hypot(dx, dy))
    ux, uy = dx / norm, dy / norm
    px, py = -uy, ux
    short_edge = min(result.size)
    length = max(22.0, short_edge * .075)
    start_x, start_y = sx + ux * norm * .12, sy + uy * norm * .12
    points = []
    for index in range(8):
        t = index / 7
        jag = (2.6 if index % 2 else -2.6) * (1 - abs(.5 - t) * .7)
        points.append((start_x + ux * length * t + px * jag,
                       start_y + uy * length * t + py * jag))

    sample_box = (
        max(0, int(start_x - 12)), max(0, int(start_y - 12)),
        min(result.width, int(start_x + 12)), min(result.height, int(start_y + 12)),
    )
    local = np.asarray(result.crop(sample_box).convert('RGB'), dtype=np.float32)
    local_rgb = np.median(local.reshape(-1, 3), axis=0) if local.size else np.array([96, 96, 96])
    luminance = float(local_rgb.mean())
    inner = tuple(int(max(18, min(78, value * .32))) for value in local_rgb)
    shadow = (6, 7, 10) if luminance < 130 else (17, 17, 20)
    thread = tuple(int(max(45, min(190, value * 1.35 + 12))) for value in local_rgb)
    width = max(5, round(short_edge * .011))
    draw = ImageDraw.Draw(result)
    left_edge, right_edge = [], []
    for index, (x, y) in enumerate(points):
        t = index / max(1, len(points) - 1)
        opening = width * (.35 + .85 * math.sin(math.pi * t))
        left_edge.append((x - px * opening, y - py * opening))
        right_edge.append((x + px * opening, y + py * opening))
    draw.polygon(left_edge + list(reversed(right_edge)), fill=shadow)
    draw.line(points, fill=inner, width=max(3, round(width * .95)), joint='curve')
    draw.line(left_edge, fill=thread, width=max(1, width // 4), joint='curve')
    draw.line(right_edge, fill=thread, width=max(1, width // 4), joint='curve')
    for index in (1, 3, 5, 7):
        for direction, edge in ((-1, left_edge[index]), (1, right_edge[index])):
            x, y = edge
            span = width * (1.0 if index % 3 else 1.35)
            draw.line((x, y, x + px * span * direction, y + py * span * direction),
                      fill=thread, width=max(1, width // 4))
    return result, {
        'applied': True,
        'side': side,
        'center': [round(start_x, 1), round(start_y, 1)],
        'lengthPx': round(length, 1),
    }


def add_safe_tight_fit(image, severity=1.0):
    """Làm vải trông bị kéo căng mà không sinh lại mặt, người hay hậu cảnh.

    FLUX có thể tạo nếp căng đẹp nhưng vừa chậm vừa có nguy cơ đổi vóc dáng.
    Với trường hợp cơ thể lớn hơn toàn bộ size đang bán, ta chỉ biến dạng nhẹ
    texture *bên trong* tứ giác vai-hông và thêm nếp kéo từ hai đường sườn.
    Biên mask được feather nên đường nét cơ thể và pixel ngoài áo giữ nguyên.
    """
    result = image.convert('RGB').copy()
    pose = analyze(result, source_coordinates=True)
    keypoints = pose.get('keypoints') or {}

    def point(name):
        value = keypoints.get(name)
        if not value or len(value) < 2:
            return None
        if len(value) > 2 and float(value[2]) < .12:
            return None
        return float(value[0]), float(value[1])

    left_shoulder, right_shoulder = point('left_shoulder'), point('right_shoulder')
    left_hip, right_hip = point('left_hip'), point('right_hip')
    if not all((left_shoulder, right_shoulder, left_hip, right_hip)):
        return result, {'applied': False, 'reason': 'torso_keypoints_not_found'}

    shoulder_y = (left_shoulder[1] + right_shoulder[1]) / 2
    hip_y = (left_hip[1] + right_hip[1]) / 2
    torso_h = hip_y - shoulder_y
    if torso_h < min(result.size) * .08:
        return result, {'applied': False, 'reason': 'torso_too_small'}

    severity = max(.0, min(1.0, float(severity or 0)))
    shoulder_left = min(left_shoulder[0], right_shoulder[0])
    shoulder_right = max(left_shoulder[0], right_shoulder[0])
    hip_left = min(left_hip[0], right_hip[0])
    hip_right = max(left_hip[0], right_hip[0])
    shoulder_span = max(8.0, shoulder_right - shoulder_left)
    hip_span = max(8.0, hip_right - hip_left)

    # Tránh cổ/mặt và tránh phần thân dưới: chỉ tác động lõi trang phục.
    top_y = shoulder_y + torso_h * .04
    bottom_y = hip_y - torso_h * .03
    polygon = [
        (shoulder_left - shoulder_span * .10, top_y),
        (shoulder_right + shoulder_span * .10, top_y),
        (hip_right + hip_span * .10, bottom_y),
        (hip_left - hip_span * .10, bottom_y),
    ]
    mask = Image.new('L', result.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=235)
    feather = max(4, round(min(result.size) * .012))
    mask = mask.filter(ImageFilter.GaussianBlur(feather))

    # Nếp căng hội tụ từ sườn vào thân và có cặp tối/sáng như nếp vải thật.
    overlay = Image.new('RGBA', result.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    line_width = max(3, round(min(result.size) * .0042))
    center_top = (shoulder_left + shoulder_right) / 2
    center_bottom = (hip_left + hip_right) / 2
    fold_count = 6 if severity >= .85 else 4
    for index in range(fold_count):
        frac = .09 + index * (.68 / max(1, fold_count - 1))
        y = top_y + (bottom_y - top_y) * frac
        t = (y - shoulder_y) / max(1.0, torso_h)
        left = shoulder_left * (1 - t) + hip_left * t
        right = shoulder_right * (1 - t) + hip_right * t
        center = center_top * (1 - t) + center_bottom * t
        reach = (right - left) * (.32 + .035 * (index % 2))
        sag = torso_h * (.022 + .007 * (index % 2))
        for side in (-1, 1):
            edge = left if side < 0 else right
            end_x = center - reach * .12 if side < 0 else center + reach * .12
            points = []
            for step in range(13):
                u = step / 12
                x = edge * (1 - u) + end_x * u
                curve_y = y + math.sin(math.pi * u) * sag * (1 if index % 2 else -1)
                points.append((x, curve_y))
            # Mạnh ở đường sườn rồi nhạt dần vào giữa, giống nếp vải bị kéo hơn
            # một đường kẻ nhân tạo chạy ngang toàn thân.
            for segment in range(len(points) - 1):
                u = segment / max(1, len(points) - 2)
                alpha = round(108 - 58 * u)
                draw.line((points[segment], points[segment + 1]),
                          fill=(5, 7, 12, alpha), width=line_width * 2)
                hi_a = round(55 - 28 * u)
                a = (points[segment][0], points[segment][1] - line_width * 1.1)
                b = (points[segment + 1][0], points[segment + 1][1] - line_width * 1.1)
                draw.line((a, b), fill=(255, 255, 255, hi_a), width=line_width + 1)

    overlay.putalpha(ImageChops.multiply(overlay.getchannel('A'), mask))
    overlay = overlay.filter(ImageFilter.GaussianBlur(max(1.1, line_width * .48)))
    result = Image.alpha_composite(result.convert('RGBA'), overlay).convert('RGB')
    return result, {
        'applied': True,
        'severity': round(severity, 3),
        'tensionIntensity': round(.65 + .35 * severity, 3),
        'foldCount': fold_count,
        'region': [round(value, 1) for point_value in polygon for value in point_value],
    }


def _ycrcb(region):
    arr = np.asarray(region.convert('RGB'), dtype=np.float32)
    if arr.size == 0:
        return None
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    y = .299 * r + .587 * g + .114 * b
    return y, (r - y) * .713 + 128, (b - y) * .564 + 128


def face_skin_reference(image, pose):
    """Tông da THẬT của chính người trong ảnh, lấy ở vùng giữa hai mắt và mũi.

    Ngưỡng YCrCb kinh điển gom mọi thứ ấm màu vào "da", nên vải màu nude — kem,
    be, hồng phấn, rất phổ biến trong tủ đồ Nhật — bị chấm là da trần. Đã gặp
    thật: một chiếc cardigan hồng phấn làm vùng ngực nhảy từ 13% lên 50% "da" và
    cổng an toàn huỷ ảnh của một người mặc kín từ đầu đến chân.

    Khuôn mặt là mẫu da đáng tin nhất: cùng người, cùng ánh sáng, cùng máy ảnh.
    """
    keypoints = (pose or {}).get('keypoints') or {}
    points = [keypoints.get(name) for name in ('left_eye', 'right_eye', 'nose')]
    points = [p for p in points if p]
    if len(points) < 2:
        return None
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    span = max(12.0, max(xs) - min(xs))
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    width, height = image.size
    box = (max(0, int(cx - span)), max(0, int(cy - span * .4)),
           min(width, int(cx + span)), min(height, int(cy + span * 1.2)))
    if box[2] <= box[0] or box[3] <= box[1]:
        return None
    parts = _ycrcb(image.crop(box))
    if parts is None:
        return None
    y, cr, cb = parts
    inside = (y > 60) & (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
    if inside.mean() < .25:
        return None
    return float(np.median(cr[inside])), float(np.median(cb[inside]))


def _skin_ratio(region, reference=None):
    """Tỉ lệ pixel là DA trong một vùng ảnh.

    Không có mẫu da khuôn mặt thì dùng ngưỡng YCrCb kinh điển (rộng, an toàn ở
    phía chặn nhầm hơn là bỏ sót). Có mẫu thì siết thêm: pixel phải nằm gần tông
    da của chính người đó, nhờ vậy vải màu nude không còn bị tính là da trần.
    """
    parts = _ycrcb(region)
    if parts is None:
        return 0.0
    y, cr, cb = parts
    skin = (y > 60) & (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
    if reference:
        ref_cr, ref_cb = reference
        gan_tong = ((cr - ref_cr) ** 2 + (cb - ref_cb) ** 2) <= SKIN_TONE_RADIUS ** 2
        skin = skin & gan_tong
    return float(skin.mean())


# Bán kính chấp nhận quanh tông da khuôn mặt, đo trong mặt phẳng Cr-Cb. Đủ rộng
# để bao vùng da bị bóng đổ hay ánh sáng khác trên cùng cơ thể, đủ hẹp để loại
# vải kem/be/hồng phấn vốn lệch tông rõ so với da mặt.
SKIN_TONE_RADIUS = 9.0


def garment_region_box(pose, size, cloth_type='upper'):
    """Khung chứa trang phục theo loại — dùng chung cho các phép chấm chất lượng."""
    width, height = size
    if pose and pose.get('box'):
        x1, y1, x2, y2 = [float(value) for value in pose['box']]
        body_h = max(1.0, y2 - y1)
        if cloth_type == 'lower':
            region = (x1, y1 + body_h * .43, x2, y1 + body_h * .98)
        elif cloth_type == 'overall':
            region = (x1, y1 + body_h * .15, x2, y1 + body_h * .98)
        else:
            region = (x1, y1 + body_h * .15, x2, y1 + body_h * .65)
    else:
        region = (width * .2, height * .18, width * .8, height * .82)
    return tuple(int(max(0, min(value, width if index % 2 == 0 else height)))
                 for index, value in enumerate(region))


def _body_geometry(pose, image_size=None):
    """Các tỉ lệ hình học của CƠ THỂ (không phải của vải) để phát hiện biến dạng.

    Mọi số đo được chuẩn hoá theo CHIỀU CAO ẢNH, không theo chiều cao box người.
    Lý do: một chiếc áo rất rộng làm box phình ra, `body_h` đổi, và khi đó cả
    khoảng cách hai mắt cũng "đổi" dù khuôn mặt không hề dịch chuyển một pixel —
    đúng thứ nhiễu mà cổng này cần tránh. Hai ảnh so sánh luôn cùng kích thước
    nên chuẩn hoá theo ảnh là mốc bất biến với quần áo.
    """
    box = pose.get('box') or []
    if len(box) != 4:
        return None
    x1, y1, x2, y2 = [float(value) for value in box]
    body_h = max(1.0, y2 - y1)
    frame_h = float(image_size[1]) if image_size else body_h
    frame_h = max(1.0, frame_h)
    keypoints = pose.get('keypoints') or {}

    def point(name):
        value = keypoints.get(name)
        return (float(value[0]), float(value[1])) if value else None

    left_shoulder, right_shoulder = point('left_shoulder'), point('right_shoulder')
    left_hip, right_hip = point('left_hip'), point('right_hip')
    left_eye, right_eye = point('left_eye'), point('right_eye')
    nose = point('nose')
    shoulder_y = None
    if left_shoulder and right_shoulder:
        shoulder_y = (left_shoulder[1] + right_shoulder[1]) / 2
    hip_y = None
    if left_hip and right_hip:
        hip_y = (left_hip[1] + right_hip[1]) / 2
    # Khoảng cách hai mắt và mắt→mũi là hai đại lượng QUẦN ÁO KHÔNG THỂ CHE.
    # Nếu AI thu nhỏ hay phóng to cơ thể, khuôn mặt đổi theo; còn một chiếc áo
    # rủ rộng thì không đụng gì tới mặt. Đây là mốc đáng tin hơn hẳn tỉ lệ thân
    # người — vốn lệch mạnh khi vải che mất eo và hông.
    eye_span = None
    if left_eye and right_eye:
        eye_span = abs(left_eye[0] - right_eye[0]) / frame_h
    eye_to_nose = None
    if nose and left_eye and right_eye:
        eye_to_nose = abs(nose[1] - (left_eye[1] + right_eye[1]) / 2) / frame_h
    # Vị trí tuyệt đối của mũi trong khung ảnh: nếu AI kéo giãn hay dịch chuyển
    # cơ thể thì mốc này đổi, còn thêm vải thì không.
    nose_y = (nose[1] / frame_h) if nose else None
    return {
        'aspect': (x2 - x1) / body_h,
        'torso': ((hip_y - shoulder_y) / frame_h) if (shoulder_y and hip_y) else None,
        'noseY': nose_y,
        'eyeSpan': eye_span,
        'eyeToNose': eye_to_nose,
        'shoulderSpan': (abs(left_shoulder[0] - right_shoulder[0]) / frame_h) if (left_shoulder and right_shoulder) else None,
    }


# Khung tương đối của từng vùng cơ thể trong box người chính, theo tỉ lệ
# (x_from, y_from, x_to, y_to) của bề rộng/chiều cao box. Dùng cho cổng kiểm tra
# độ che phủ: mỗi vùng được hỏi riêng "ở đây lộ da có đúng thiết kế không".
BODY_ZONE_BOXES = {
    'chest':      (0.28, 0.17, 0.72, 0.36),
    'abdomen':    (0.32, 0.36, 0.68, 0.52),
    'pelvis':     (0.34, 0.50, 0.66, 0.63),
    'buttocks':   (0.32, 0.52, 0.68, 0.66),
    'shoulders':  (0.18, 0.14, 0.82, 0.25),
    'upperArms':  (0.06, 0.20, 0.94, 0.44),
    'legs':       (0.28, 0.62, 0.72, 0.99),
}


# Các vùng neo được theo mốc giải phẫu, tính từ đường vai tới đường hông.
# `t` là vị trí tương đối trong đoạn vai→hông (0 = vai, 1 = hông); có thể vượt 1
# cho vùng nằm dưới hông. `x` là bề ngang tính theo khoảng cách hai vai.
ZONE_ANCHORS = {
    # Ngực bắt đầu DƯỚI đường vai, không tính cổ. Áo cổ V hay cổ tim để lộ cổ và
    # xương quai xanh là chuyện bình thường; gộp cổ vào "vùng bắt buộc kín" thì
    # mọi lần đổi từ áo cổ lọ sang cổ V đều bị coi là cởi đồ.
    'chest':    (0.16, 0.62, 0.62),
    'abdomen':  (0.62, 1.00, 0.55),
    'pelvis':   (1.00, 1.28, 0.55),
    'buttocks': (1.00, 1.34, 0.62),
}


def zone_box(pose, size, zone):
    """Khung pixel của một vùng cơ thể.

    Ưu tiên neo theo keypoint vai/hông vì đó là mốc giải phẫu thật; chỉ khi
    thiếu keypoint mới rơi về tỉ lệ trên khung người, vốn trượt theo cách cắt
    ảnh (ảnh bán thân, người đứng lệch, ảnh vuông...).
    """
    width, height = size
    ratios = BODY_ZONE_BOXES.get(zone)
    if not ratios:
        return None
    if pose and pose.get('box'):
        x1, y1, x2, y2 = [float(v) for v in pose['box']]
    else:
        x1, y1, x2, y2 = width * .2, height * .05, width * .8, height * .98
    box_w, box_h = max(1.0, x2 - x1), max(1.0, y2 - y1)

    anchor = ZONE_ANCHORS.get(zone)
    keypoints = (pose or {}).get('keypoints') or {}
    if anchor:
        shoulders = [keypoints.get('left_shoulder'), keypoints.get('right_shoulder')]
        hips = [keypoints.get('left_hip'), keypoints.get('right_hip')]
        if all(shoulders) and all(hips):
            sx = (float(shoulders[0][0]) + float(shoulders[1][0])) / 2
            sy = (float(shoulders[0][1]) + float(shoulders[1][1])) / 2
            hy = (float(hips[0][1]) + float(hips[1][1])) / 2
            span = abs(float(shoulders[0][0]) - float(shoulders[1][0]))
            torso = hy - sy
            if span > 4 and torso > 8:
                t_top, t_bottom, x_half = anchor
                half = span * x_half
                left, right = sx - half, sx + half
                top, bottom = sy + torso * t_top, sy + torso * t_bottom
                return (
                    int(max(0, min(left, width - 1))), int(max(0, min(top, height - 1))),
                    int(max(1, min(right, width))), int(max(1, min(bottom, height))),
                )

    left = x1 + box_w * ratios[0]
    top = y1 + box_h * ratios[1]
    right = x1 + box_w * ratios[2]
    bottom = y1 + box_h * ratios[3]
    return (
        int(max(0, min(left, width - 1))), int(max(0, min(top, height - 1))),
        int(max(1, min(right, width))), int(max(1, min(bottom, height))),
    )


def _mean_skin_color(region):
    """Màu trung bình của riêng các pixel màu da trong vùng (None nếu quá ít)."""
    arr = np.asarray(region.convert('RGB'), dtype=np.float32)
    if arr.size == 0:
        return None
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    y = .299 * r + .587 * g + .114 * b
    cr = (r - y) * .713 + 128
    cb = (b - y) * .564 + 128
    mask = (y > 60) & (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
    if mask.sum() < 40:
        return None
    return np.array([r[mask].mean(), g[mask].mean(), b[mask].mean()])


def coverage_quality(clean_image, result_image, pose=None, coverage=None):
    """Kiểm tra ĐỘ CHE PHỦ của ảnh thử đồ theo thiết kế sản phẩm.

    Đây là cổng an toàn, tách hẳn khỏi cổng chấm "ảnh có đẹp không". Nó trả lời
    ba câu hỏi:

      1. Vùng BẮT BUỘC KÍN (ngực, chậu, mông) có bị hở không? -> lỗi nghiêm trọng
      2. Vùng được phép hở theo thiết kế (bụng của áo crop, vai của áo trễ vai)
         có bị coi là lỗi không? -> KHÔNG, đó là đúng thiết kế
      3. Có vùng da mới xuất hiện ngoài thiết kế không? -> lỗi

    Ngoài ra kiểm tra tính nhất quán màu da: bụng/tay/chân được model dựng lại
    phải cùng tông với khuôn mặt, không được là một mảng màu phẳng khác tông.
    """
    coverage = coverage or {}
    allowed = set(coverage.get('allowedExposedZones') or [])
    required = set(coverage.get('requiredCoveredZones') or ['chest', 'pelvis', 'buttocks'])
    coverage_style = str(coverage.get('coverageStyle') or 'standard')

    clean = clean_image.convert('RGB')
    result = result_image.convert('RGB')
    if result.size != clean.size:
        result = result.resize(clean.size, Image.Resampling.LANCZOS)
    # Ảnh gốc và ảnh do FLUX trả về có thể cùng kích thước canvas nhưng người
    # đã được đặt lại vị trí/phóng lớn. Mỗi ảnh vì vậy BẮT BUỘC có pose riêng.
    # Dùng box của ảnh gốc để crop ảnh kết quả là nguyên nhân khiến một bikini
    # kín đáo bị báo hở ngực/chậu/mông trên máy thật: ba ô thực tế đã rơi xuống
    # bụng và đùi của output.
    clean_detected_pose = analyze(clean, source_coordinates=True)
    if clean_detected_pose.get('box') and not clean_detected_pose.get('fallback'):
        clean_pose = clean_detected_pose
    elif pose and pose.get('box'):
        clean_pose = pose
    else:
        clean_pose = clean_detected_pose

    result_detected_pose = analyze(result, source_coordinates=True)
    if result_detected_pose.get('box') and not result_detected_pose.get('fallback'):
        result_pose = result_detected_pose
    else:
        # Chỉ rơi về pose ảnh gốc khi detector thực sự mất người. Hai ảnh đã
        # được resize cùng canvas nên đây là fallback bảo thủ, không nới gate.
        result_pose = clean_pose

    # Một mẫu da duy nhất, lấy từ ảnh SẠCH, dùng cho cả trước lẫn sau — có vậy
    # hai con số mới so sánh được với nhau.
    skin_reference = face_skin_reference(clean, clean_pose)

    def protected_core(box, zone):
        """Lõi phải có vải đối với đồ bơi tối giản.

        Bikini hợp lệ vẫn để lộ cleavage, hông và phần chân nằm trong chính ô
        chữ nhật lớn của ngực/chậu/mông. Chấm toàn bộ ô sẽ luôn báo hở. Ba lõi
        dưới bám vào phần vải thực sự bắt buộc: nửa trên của top và dải trước
        của brief. Nếu model sinh ảnh khoả thân, các lõi này vẫn là da và gate
        vẫn chặn như cũ.
        """
        if not box:
            return None
        x1, y1, x2, y2 = box
        width, height = x2 - x1, y2 - y1
        if width <= 1 or height <= 1:
            return None
        if zone == 'chest':
            fractions = (.15, .00, .85, .58)
        elif zone in {'pelvis', 'buttocks'}:
            fractions = (.15, .00, .85, .58)
        else:
            fractions = (.15, .15, .85, .85)
        fx1, fy1, fx2, fy2 = fractions
        return (
            int(x1 + width * fx1), int(y1 + height * fy1),
            int(x1 + width * fx2), int(y1 + height * fy2),
        )

    reasons = []
    warnings = []
    zones = {}
    for zone in BODY_ZONE_BOXES:
        clean_box = zone_box(clean_pose, clean.size, zone)
        result_box = zone_box(result_pose, result.size, zone)
        if (not clean_box or not result_box
                or clean_box[2] <= clean_box[0] or clean_box[3] <= clean_box[1]
                or result_box[2] <= result_box[0] or result_box[3] <= result_box[1]):
            continue
        before = _skin_ratio(clean.crop(clean_box), skin_reference)
        after = _skin_ratio(result.crop(result_box), skin_reference)
        gain = after - before
        zone_info = {'before': round(before, 4), 'after': round(after, 4), 'gain': round(gain, 4)}
        zones[zone] = zone_info
        if zone in required:
            if coverage_style == 'minimal-swimwear':
                clean_core = protected_core(clean_box, zone)
                result_core = protected_core(result_box, zone)
                before_core = _skin_ratio(clean.crop(clean_core), skin_reference) if clean_core else before
                after_core = _skin_ratio(result.crop(result_core), skin_reference) if result_core else after
                core_gain = after_core - before_core
                zone_info.update({
                    'protectedBefore': round(before_core, 4),
                    'protectedAfter': round(after_core, 4),
                    'protectedGain': round(core_gain, 4),
                })
                # Đây vẫn là fail-closed: lõi nhạy cảm chủ yếu là da thì huỷ.
                # Ngưỡng cao hơn full-box vì bikini có dây/đường viền nhỏ và
                # khoảng hở thiết kế, nhưng ảnh khoả thân (>~90% da) vẫn bị bắt.
                required_exposed = after_core > 0.72 and core_gain > 0.10
            else:
                # Màu da chiếm một phần ô KHÔNG đủ để huỷ ảnh. Cổ chữ V,
                # váy/quần ngắn, bóng da và vải màu nude đều từng làm ngưỡng
                # full-box 0.34 bắn nhầm. Giữ tín hiệu này để cảnh báo/chấm
                # chất lượng, nhưng chỉ chặn khi gần như TOÀN BỘ lõi
                # nhạy cảm là da. Như vậy ảnh bình thường không bị loại oan,
                # còn output khoả thân rõ ràng vẫn bị chặn.
                moderate_exposure_signal = after > 0.34 and gain > 0.10
                # Ngưỡng 0.34 chấm TRUNG BÌNH cả ô. Áo khoác mở trước (haori,
                # cardigan) chỉ hở một dải giữa, còn vải hai bên kéo trung bình
                # xuống, nên một ảnh hở ngực thật vẫn lọt. Đo trên máy ngày
                # 2026-09-02: người mặc áo dài tay kín + quần, thử haori-dang-dai
                # xong ngực đi từ 0.0014 lên 0.1422 (gấp ~100 lần) mà cổng vẫn
                # trả ok=True vì 0.1422 < 0.34 — ảnh trả về là người cởi trần
                # dưới lớp haori.
                #
                # Nhánh thứ hai bắt tình huống "đang mặc thành không mặc": vùng
                # bắt buộc kín vốn gần như không có da, sau lượt sinh ảnh lại có
                # da mới đáng kể.
                #
                # Phải đo trên LÕI chứ không trên cả ô, vì các ô cạnh nhau chồng
                # lấn: quần short hở chân (hợp lệ) làm mép dưới ô mông dính da và
                # nhánh này bắn nhầm nếu chấm cả ô. Lõi mông/chậu là 58% phía
                # trên — phần bắt buộc có vải — nên da từ đùi không lọt vào.
                core_clean_box = protected_core(clean_box, zone)
                core_result_box = protected_core(result_box, zone)
                before_core = _skin_ratio(clean.crop(core_clean_box), skin_reference) if core_clean_box else before
                after_core = _skin_ratio(result.crop(core_result_box), skin_reference) if core_result_box else after
                core_gain = after_core - before_core
                zone_info.update({
                    'coreBefore': round(before_core, 4),
                    'coreAfter': round(after_core, 4),
                    'coreGain': round(core_gain, 4),
                })
                hard_core_threshold = float(os.getenv('JAPANO_COVERAGE_HARD_CORE_THRESHOLD', '0.82'))
                hard_core_gain = float(os.getenv('JAPANO_COVERAGE_HARD_CORE_GAIN', '0.12'))
                severe_core_exposure = (
                    after_core > hard_core_threshold
                    and (core_gain > hard_core_gain or before_core > hard_core_threshold)
                )
                # Ngưỡng đặt trên mức nhiễu nền/đổ bóng (lõi trước < 0.06) nên áo
                # cổ tim/cổ tròn bình thường — chỉ nhích vài phần trăm — không bị
                # chặn oan.
                #
                # CẢNH BÁO, KHÔNG CHẶN.
                #
                # Ngưỡng dưới đây được hiệu chỉnh trên ĐÚNG MỘT mẫu (ca haori:
                # lõi ngực 0.0 -> 0.1784). Khi bật chặn thật, nó đánh rớt hàng
                # loạt ảnh hợp lệ của người dùng: cổ kimono/yukata mở chữ V rơi
                # đúng vào lõi ngực (phần .00-.58 phía trên của ô), nên một kiểu
                # cổ áo hoàn toàn bình thường trông giống hệt dấu hiệu "bị cởi
                # mất lớp trong". Chặn bằng ngưỡng chưa đo trên đủ mẫu gây hại
                # nhiều hơn lợi — khách không thử được món nào, và mỗi lần chặn
                # còn kéo theo một lượt sửa che phủ nên thời gian chờ tăng vọt.
                #
                # Vẫn giữ tín hiệu để không quên lỗ hổng thật (áo khoác mở phía
                # trước xoá lớp trong mà vẫn lọt cổng), nhưng chỉ ở mức cảnh báo
                # cho tới khi có bộ mẫu đủ lớn để đặt ngưỡng. Bật lại thành chặn
                # bằng JAPANO_COVERAGE_UNDRESS_BLOCK=1 sau khi đã hiệu chỉnh.
                undressed = before_core < 0.06 and after_core > 0.12 and core_gain > 0.08
                block_undressed = os.getenv('JAPANO_COVERAGE_UNDRESS_BLOCK', '0').strip().lower() in {'1', 'true', 'yes', 'on'}
                required_exposed = severe_core_exposure or (undressed and block_undressed)
                if moderate_exposure_signal and not required_exposed:
                    warnings.append(f'coverage_review:{zone}')
                if undressed:
                    zone_info['undressed'] = True
                    if not severe_core_exposure and not block_undressed:
                        warnings.append(f'undressed_suspected:{zone}')
            if required_exposed:
                reasons.append(f'required_zone_exposed:{zone}')
        elif zone in allowed:
            # Chiều ngược lại cũng là lỗi: sản phẩm thiết kế để HỞ vùng này mà
            # ảnh lại che kín, tức là model đã tự kéo dài vạt áo. Đây đúng là
            # lỗi kinh điển của áo crop — VTON dựng thành áo dài bình thường.
            # Xếp mức cảnh báo, không phải lỗi an toàn: ảnh không nguy hiểm,
            # chỉ là sai thiết kế sản phẩm.
            if after < 0.12 and gain < 0.05:
                warnings.append(f'intended_exposure_missing:{zone}')
        else:
            # Vùng không được thiết kế cho hở mà da tăng mạnh = model đã cởi bớt đồ.
            if gain > 0.22:
                reasons.append(f'unexpected_skin:{zone}')

    # Nhất quán màu da: so tông da vùng mặt với các vùng hở theo thiết kế.
    face_box = zone_box(result_pose, result.size, 'shoulders')
    if face_box and result_pose.get('box'):
        x1, y1, x2, y2 = [float(v) for v in result_pose['box']]
        head_height = max(1.0, (y2 - y1) * 0.13)
        face_box = (int(x1 + (x2 - x1) * .35), int(y1), int(x1 + (x2 - x1) * .65), int(y1 + head_height))
    face_tone = _mean_skin_color(result.crop(face_box)) if face_box else None
    tone_deltas = {}
    if face_tone is not None:
        for zone in allowed:
            box = zone_box(result_pose, result.size, zone)
            if not box:
                continue
            tone = _mean_skin_color(result.crop(box))
            if tone is None:
                continue
            delta = float(np.abs(tone - face_tone).mean())
            tone_deltas[zone] = round(delta, 2)
            if delta > 46:
                reasons.append(f'skin_tone_mismatch:{zone}')

    return {
        'ok': not reasons,
        'reasons': reasons,
        # Cảnh báo KHÔNG chặn ảnh: sai thiết kế thì sửa bằng một lượt fit-refine,
        # còn hở vùng nhạy cảm mới là lý do huỷ ảnh.
        'warnings': warnings,
        'zones': zones,
        'skinToneDeltas': tone_deltas,
        'allowedExposedZones': sorted(allowed),
        'requiredCoveredZones': sorted(required),
        'coverageStyle': coverage_style,
    }


def fit_effect_quality(clean_image, result_image, pose=None, cloth_type='upper', fit=None):
    """Cổng chất lượng RIÊNG cho bước mô phỏng độ vừa vặn.

    Cổng try-on thường chỉ hỏi "có mặc được đồ lên người không". Bước fit-refine
    lại được phép làm vải căng/rách/rủ rộng, nên phải có một cổng khác trả lời
    đúng câu hỏi của tính năng này:

      * Cơ thể người có bị AI sửa để "vừa" với quần áo không?  -> cấm tuyệt đối
      * Vết rách có làm lộ vùng nhạy cảm không?                 -> cấm tuyệt đối
      * Màu/hoạ tiết trang phục có bị vẽ lại thành món khác không? -> cấm
      * Với mức rất chật/rất rộng, hiệu ứng có thật sự hiện ra không? -> cảnh báo
    """
    fit = fit or {}
    clean = clean_image.convert('RGB')
    result = result_image.convert('RGB')
    if result.size != clean.size:
        result = result.resize(clean.size, Image.Resampling.LANCZOS)

    reasons = []
    result_pose = analyze(result, source_coordinates=True)
    if result_pose.get('fallback') or float(result_pose.get('confidence') or 0) < .25:
        reasons.append('main_subject_lost')

    # Cùng lý do như phần đo lệch bên dưới: khung vùng trang phục cũng phải đặt
    # theo người trong CHÍNH ảnh `clean`, không theo pose của ảnh gốc. Đặt lệch
    # khung thì phép đo "hở da" chấm nhầm vào nền hoặc khuôn mặt.
    clean_pose = analyze(clean, source_coordinates=True)
    if clean_pose.get('fallback') or not clean_pose.get('box'):
        clean_pose = pose if (pose and pose.get('box')) else clean_pose
    # Mốc "trước" của phép đo lệch PHẢI đo trên chính ảnh đang so sánh.
    # `pose` do Node truyền xuống được tính trên ẢNH GỐC của người dùng, còn
    # `clean` là ảnh sau VTON — khác kích thước, khác khung. Dùng lẫn hai hệ quy
    # chiếu thì mọi toạ độ lệch sẵn vài chục phần trăm trước khi FLUX kịp vẽ gì.
    before, after = _body_geometry(clean_pose, clean.size), _body_geometry(result_pose, clean.size)
    body_drift = {}
    if before and after:
        # Phát hiện "AI sửa cơ thể thay vì sửa quần áo".
        #
        # Bản đầu chỉ so tỉ lệ thân người (vai→hông). Chạy thật cho thấy nó
        # đánh trượt gần hết nhóm áo RỘNG: một chiếc áo rủ thùng thình che mất
        # eo và hông, YOLO đặt lại keypoint, tỉ lệ thân đổi >22% — nhưng cơ thể
        # thì không hề đổi. Hậu quả là mọi hiệu ứng `very_loose` đều bị huỷ.
        #
        # Nay ưu tiên các mốc QUẦN ÁO KHÔNG CHE ĐƯỢC (khoảng cách hai mắt,
        # mắt→mũi, đỉnh đầu) với ngưỡng chặt; tỉ lệ thân vẫn được theo dõi nhưng
        # với ngưỡng rộng hơn nhiều, vì nó vốn nhiễu khi vải phủ kín thân.
        FACE_TOLERANCE = .18
        tight_fit = str(fit.get('verdict') or '') in {'slightly_tight', 'tight', 'very_tight'}
        # Áo rộng có thể làm detector dời vai/hông ra ngoài lớp vải, nên giữ
        # ngưỡng torso rộng cho loose. Với áo CHẬT thì vai/thân không được nở
        # theo trang phục: đó là dấu hiệu FLUX đã làm người béo/gầy đi.
        TORSO_TOLERANCE = .12 if tight_fit else .45
        checks = [
            ('eyeSpan', FACE_TOLERANCE), ('eyeToNose', FACE_TOLERANCE),
            ('noseY', FACE_TOLERANCE), ('torso', TORSO_TOLERANCE),
        ]
        if tight_fit:
            checks.extend((('shoulderSpan', .12), ('aspect', .12)))
        # Đo HẾT rồi mới kết luận, không dừng ở tín hiệu lỗi đầu tiên.
        #
        # Khi AI thật sự sửa cơ thể, mọi mốc dịch chuyển CÙNG NHAU. Còn một mốc
        # đơn lẻ vượt ngưỡng thường chỉ là YOLO đặt lại keypoint — đủ để huỷ oan
        # mọi hiệu ứng áo rộng. Nên chỉ từ chối khi có đồng thuận (≥2 mốc lệch)
        # hoặc khi một mốc lệch quá xa (gấp đôi ngưỡng) tới mức không thể là nhiễu.
        face_signals = 0
        violations = []
        worst_ratio = 0.0
        for key, tolerance in checks:
            if before.get(key) is None or after.get(key) is None:
                continue
            drift = abs(after[key] - before[key]) / max(.02, abs(before[key]))
            body_drift[key] = round(drift, 3)
            if key != 'torso':
                face_signals += 1
            if drift > tolerance:
                violations.append(key)
                worst_ratio = max(worst_ratio, drift / tolerance)
        body_drift['faceSignalsUsed'] = face_signals
        body_drift['violations'] = len(violations)
        if len(violations) >= 2 or worst_ratio >= 2.0:
            reasons.append('body_changed_not_garment')

    region = garment_region_box(clean_pose, clean.size, cloth_type)
    clean_region = clean.crop(region)
    result_region = result.crop(region)

    skin_reference = face_skin_reference(clean, clean_pose)
    skin_before = _skin_ratio(clean_region, skin_reference)
    skin_after = _skin_ratio(result_region, skin_reference)
    skin_gain = skin_after - skin_before
    # Rách vải được phép, hở da thì không. Ngưỡng nới nhẹ khi hiệu ứng rách được
    # bật, vì một khe nứt nhỏ ở đường may vẫn có thể để lộ vài pixel áo trong.
    skin_limit = .10 if fit.get('tearAllowed') else .06
    if skin_gain > skin_limit:
        reasons.append('excessive_skin_exposure')

    # Màu và hoạ tiết trang phục phải giữ nguyên: fit chỉ đổi CÁCH vải nằm trên
    # người, không được vẽ lại thành sản phẩm khác.
    #
    # Đã thử đo trên "lõi ngực" thay vì cả khung để tránh việc áo rủ rộng che
    # thêm nền bị tính nhầm là đổi màu. Đo thử trên 5 mẫu thật cho kết quả lẫn
    # lộn (2/5 ca xấu đi vì vùng lõi hẹp dính cổ áo và da), nên giữ nguyên cách
    # đo trên cả khung — đơn giản và ổn định hơn.
    small = (48, 64)
    clean_small = np.asarray(clean_region.resize(small), dtype=np.float32)
    result_small = np.asarray(result_region.resize(small), dtype=np.float32)
    color_shift = float(np.abs(clean_small.reshape(-1, 3).mean(axis=0) - result_small.reshape(-1, 3).mean(axis=0)).mean())
    if color_shift > 34:
        reasons.append('garment_color_changed')

    structure_change = float(np.abs(
        np.asarray(clean_region.convert('L').resize(small), dtype=np.float32)
        - np.asarray(result_region.convert('L').resize(small), dtype=np.float32)
    ).mean())
    verdict = str(fit.get('verdict') or '')
    effect_visible = structure_change >= 3.5
    if verdict in {'very_tight', 'very_loose'} and structure_change < 2.0:
        reasons.append('fit_effect_not_visible')

    return {
        'ok': not reasons,
        'reasons': reasons,
        'skinBefore': round(skin_before, 4),
        'skinAfter': round(skin_after, 4),
        'skinGain': round(skin_gain, 4),
        'colorShift': round(color_shift, 3),
        'structureChange': round(structure_change, 3),
        'effectVisible': effect_visible,
        'bodyDrift': body_drift,
    }


def accessory_quality(clean_image, result_image, kinds):
    """Score a generative accessory edit against the clean VTON result.

    This gate protects the parts FLUX must not trade away for a pretty prop:
    visible identity/face, garment fidelity, one main person, and a genuinely
    engaged arm when an umbrella/hand prop is requested.
    """
    clean = clean_image.convert('RGB')
    result = result_image.convert('RGB').resize(clean.size, Image.Resampling.LANCZOS)
    clean_pose = analyze(clean, source_coordinates=True)
    result_pose = analyze(result, source_coordinates=True)
    kinds = {str(value) for value in (kinds or [])}
    reasons = []
    width, height = clean.size

    if result_pose.get('fallback') or float(result_pose.get('confidence') or 0) < .25:
        reasons.append('main_subject_lost')

    base_pose = clean_pose if clean_pose.get('box') else fallback_pose()
    x1, y1, x2, y2 = [float(value) for value in base_pose['box']]
    box_w, box_h = max(1.0, x2 - x1), max(1.0, y2 - y1)

    def clipped(region):
        return tuple(int(max(0, min(value, width if index % 2 == 0 else height))) for index, value in enumerate(region))

    def region_diff(region):
        region = clipped(region)
        if region[2] <= region[0] or region[3] <= region[1]:
            return 255.0
        left = np.asarray(clean.crop(region).resize((96, 96)), dtype=np.float32)
        right = np.asarray(result.crop(region).resize((96, 96)), dtype=np.float32)
        return float(np.abs(left - right).mean())

    def region_peak_diff(region, tile=12):
        """Mức đổi CAO NHẤT trên một ô nhỏ bên trong vùng.

        Trâm cài/kẹp tóc chỉ chiếm vài phần trăm diện tích nửa cái đầu, nên trung
        bình cả vùng luôn nằm dưới ngưỡng dù ảnh đã thật sự đổi — đo trên máy
        2026-09-03: "Trâm cài tóc Kanzashi" bị trả `hair_clip_missing` trong khi
        món đã được đặt đúng thái dương. Lấy đỉnh theo ô nhỏ thì một vật nhỏ
        nhưng có thật vẫn lộ ra, mà một ảnh không đổi gì thì mọi ô đều ~0.
        """
        region = clipped(region)
        if region[2] <= region[0] or region[3] <= region[1]:
            return 255.0
        left = np.asarray(clean.crop(region).resize((96, 96)), dtype=np.float32)
        right = np.asarray(result.crop(region).resize((96, 96)), dtype=np.float32)
        diff = np.abs(left - right)
        if diff.ndim == 3:
            diff = diff.mean(axis=2)
        height_px, width_px = diff.shape
        peak = 0.0
        for top in range(0, height_px - tile + 1, tile):
            for left_px in range(0, width_px - tile + 1, tile):
                peak = max(peak, float(diff[top:top + tile, left_px:left_px + tile].mean()))
        return peak

    clean_kp = clean_pose.get('keypoints') or {}
    left_eye = clean_kp.get('left_eye')
    right_eye = clean_kp.get('right_eye')
    left_ear = clean_kp.get('left_ear')
    right_ear = clean_kp.get('right_ear')
    if left_eye and right_eye:
        eye_y = (left_eye[1] + right_eye[1]) / 2
        center_x = (left_eye[0] + right_eye[0]) / 2
        face_w = max(
            abs(right_eye[0] - left_eye[0]) * 2.2,
            abs(right_ear[0] - left_ear[0]) if left_ear and right_ear else 0,
            box_w * .20,
        )
        face_region = (center_x - face_w * .62, eye_y - face_w * .34,
                       center_x + face_w * .62, eye_y + face_w * .82)
    else:
        face_region = (x1 + box_w * .25, y1, x2 - box_w * .25, y1 + box_h * .24)
    face_diff = region_diff(face_region)
    if face_diff > float(45):
        reasons.append('face_changed_or_covered')

    # Chỉ lấy lõi thân áo, tránh cánh tay được phép đổi pose khi cầm phụ kiện.
    garment_region = (x1 + box_w * .30, y1 + box_h * .20,
                      x2 - box_w * .30, y1 + box_h * .68)
    garment_diff = region_diff(garment_region)
    # Ba lô có quai vắt chéo qua ngực và đai obi thắt ngang eo — cả hai CỐ Ý
    # phủ lên đúng vùng mà phép kiểm tra này đang canh. Giữ nguyên ngưỡng chung
    # thì một chiếc ba lô đặt hoàn toàn đúng vị trí vẫn bị chấm là "lệch mẫu
    # trang phục", và người dùng không bao giờ nhìn thấy phụ kiện: hệ thống lặng
    # lẽ trả về ảnh quần áo sạch. Đây là cùng một loại lỗi với việc trước đây
    # đòi tay phải nắm khi món đồ vốn đeo trên lưng.
    garment_limit = 84.0 if kinds.intersection({'backpack', 'waist'}) else 52.0
    if garment_diff > garment_limit:
        reasons.append('garment_fidelity_changed')

    inferred = set(result_pose.get('inferredKeypoints') or [])
    if 'hat' in kinds and {'left_eye', 'right_eye'}.issubset(inferred):
        reasons.append('hat_obscures_eyes')

    head_region = (x1 + box_w * .12, y1 - box_h * .06, x2 - box_w * .12, y1 + box_h * .22)
    head_diff = region_diff(head_region)
    if 'hat' in kinds and head_diff < 5:
        reasons.append('hat_missing')
    left_head_diff = region_diff((x1 + box_w * .08, y1 - box_h * .03,
                                  x1 + box_w * .48, y1 + box_h * .25))
    right_head_diff = region_diff((x1 + box_w * .52, y1 - box_h * .03,
                                   x2 - box_w * .08, y1 + box_h * .25))
    # Đo theo đỉnh cục bộ thay vì trung bình cả nửa đầu: xem region_peak_diff.
    clip_peak_diff = max(
        region_peak_diff((x1 + box_w * .08, y1 - box_h * .03, x1 + box_w * .48, y1 + box_h * .25)),
        region_peak_diff((x1 + box_w * .52, y1 - box_h * .03, x2 - box_w * .08, y1 + box_h * .25)),
    ) if 'hair_clip' in kinds else 0.0
    if 'hair_clip' in kinds and clip_peak_diff < float(os.getenv('JAPANO_ACCESSORY_CLIP_PEAK_MIN', '9')):
        reasons.append('hair_clip_missing')
    if 'earmuffs' in kinds and min(left_head_diff, right_head_diff) < 4.2:
        reasons.append('earmuffs_missing')

    feet_region = (x1 + box_w * .12, y1 + box_h * .82,
                   x2 - box_w * .12, min(height, y2 + box_h * .08))
    feet_diff = region_diff(feet_region)
    if 'shoe' in kinds and feet_diff < 5:
        reasons.append('shoe_missing')

    def point(pose, name):
        value = (pose.get('keypoints') or {}).get(name)
        if not value or name in set(pose.get('inferredKeypoints') or []):
            return None
        return np.array([float(value[0]), float(value[1])])

    def angle(a, b, c):
        if a is None or b is None or c is None:
            return None
        ba, bc = a - b, c - b
        denom = max(1e-6, float(np.linalg.norm(ba) * np.linalg.norm(bc)))
        cosine = max(-1.0, min(1.0, float(np.dot(ba, bc) / denom)))
        return math.degrees(math.acos(cosine))

    arm_angles = []
    wrist_travels = []
    for side in ('left', 'right'):
        value = angle(point(result_pose, f'{side}_shoulder'), point(result_pose, f'{side}_elbow'), point(result_pose, f'{side}_wrist'))
        if value is not None:
            arm_angles.append(value)
        clean_wrist = point(clean_pose, f'{side}_wrist')
        result_wrist = point(result_pose, f'{side}_wrist')
        if clean_wrist is not None and result_wrist is not None:
            wrist_travels.append(float(np.linalg.norm(result_wrist - clean_wrist)) / box_h)
    # Ba lô đeo lưng và đai thắt eo không cần bàn tay nắm giữ.
    grip_required = bool(kinds.intersection({'umbrella', 'bag', 'sword', 'hand'}))
    best_arm_angle = min(arm_angles) if arm_angles else 180.0
    max_wrist_travel = max(wrist_travels) if wrist_travels else 0.0
    # Ảnh clean sau FASHN có hai tay buông. Một pose cầm thật phải đưa ít nhất
    # một cổ tay lên/ra khỏi vị trí đó; chỉ nhìn góc khuỷu dễ chặn nhầm tay cầm
    # ô khá thẳng nhưng đã nắm cán chính xác.
    if grip_required and (not arm_angles or best_arm_angle > 175 or max_wrist_travel < .055):
        reasons.append('hand_pose_not_engaged')

    weights = {
        'main_subject_lost': 180,
        'face_changed_or_covered': 130,
        'hat_obscures_eyes': 120,
        'garment_fidelity_changed': 90,
        'hand_pose_not_engaged': 55,
        'hat_missing': 80,
        'hair_clip_missing': 80,
        'earmuffs_missing': 90,
        'shoe_missing': 100,
    }
    score = sum(weights.get(reason, 40) for reason in reasons)
    score += face_diff * 1.4 + garment_diff * .8
    if grip_required:
        score += max(0, .10 - max_wrist_travel) * 300 + max(0, best_arm_angle - 170) * .4
    return {
        'ok': not reasons,
        'reasons': reasons,
        'score': round(score, 3),
        'faceDiff': round(face_diff, 3),
        'garmentDiff': round(garment_diff, 3),
        'headDiff': round(head_diff, 3),
        'leftHeadDiff': round(left_head_diff, 3),
        'rightHeadDiff': round(right_head_diff, 3),
        'clipPeakDiff': round(clip_peak_diff, 3),
        'feetDiff': round(feet_diff, 3),
        'bestArmAngle': round(best_arm_angle, 2),
        'maxWristTravel': round(max_wrist_travel, 4),
        'resultPose': result_pose,
    }


def confine_to_accessory_region(clean, rough, refined, margin_ratio=0.018, extra_regions=None):
    """Giữ nét vẽ của FLUX CHỈ trong vùng đã dán phụ kiện, phần còn lại lấy lại
    nguyên xi từ ảnh quần áo sạch.

    Vì sao cần: `/accessory-refine` nhận cả tấm ảnh nên FLUX vẽ lại toàn khung —
    kể cả khuôn mặt và trang phục vốn không liên quan gì tới đôi giày. Cổng chất
    lượng phụ kiện đo đúng chuyện đó rồi loại cả ảnh: đo trên máy 2026-09-02, ghép
    "Dép quai Nhật" cho ra faceDiff 74.7 và garmentDiff 73.5 nên bị bỏ, dù
    feetDiff 33.1 cho thấy đôi dép ĐÃ được đặt đúng chỗ. Kết quả là khách không
    bao giờ nhận được giày.

    Vùng phụ kiện được suy ra từ chính chỗ `rough` khác `clean` — tức là đúng
    những pixel mà bước dán đã chạm vào — nên không cần mỗi hàm add_* trả thêm toạ
    độ. Nới biên một chút để FLUX còn chỗ hoà bóng đổ và mép tiếp đất.

    Sau bước này faceDiff/garmentDiff bằng 0 theo cấu trúc, không phải nhờ model
    chịu nghe prompt.
    """
    clean = clean.convert('RGB')
    rough = rough.convert('RGB').resize(clean.size, Image.Resampling.LANCZOS)
    refined = refined.convert('RGB').resize(clean.size, Image.Resampling.LANCZOS)

    diff = ImageChops.difference(clean, rough).convert('L')
    # Ngưỡng thấp: cutout dán vào có thể rất gần màu nền ở vài pixel mép.
    mask = diff.point(lambda value: 255 if value > 10 else 0)

    # Món CẦM TAY cần thêm quyền sửa vùng cánh tay.
    #
    # Cổng chất lượng đòi một tư thế cầm thật: ít nhất một cổ tay phải rời khỏi
    # vị trí buông thõng (`hand_pose_not_engaged`). Nhưng nếu chỉ cho FLUX vẽ
    # trong đúng vùng đã dán thì cánh tay không thể nhúc nhích, nên quạt/kiếm/
    # găng tay/khăn furoshiki đều trượt cổng dù cái cutout đã nằm đúng chỗ — đo
    # trên máy 2026-09-03: 4/13 loại hỏng, tất cả đều là đồ cầm tay.
    #
    # Mở thêm đúng vùng chi cần cử động, KHÔNG mở toàn khung: mặt và thân áo vẫn
    # nằm ngoài vùng cho phép nên faceDiff/garmentDiff vẫn được bảo vệ.
    if extra_regions:
        allow = ImageDraw.Draw(mask)
        for region in extra_regions:
            x1, y1, x2, y2 = [int(value) for value in region]
            if x2 <= x1 or y2 <= y1:
                continue
            allow.rectangle((max(0, x1), max(0, y1), min(clean.width, x2), min(clean.height, y2)), fill=255)

    width, height = clean.size
    grow = max(3, int(min(width, height) * margin_ratio))
    # MaxFilter cần kernel lẻ.
    kernel = grow * 2 + 1
    mask = mask.filter(ImageFilter.MaxFilter(min(kernel, 25)))
    # Lặp lại nếu cần nới rộng hơn giới hạn kernel của MaxFilter.
    remaining = grow - 12
    while remaining > 0:
        mask = mask.filter(ImageFilter.MaxFilter(25))
        remaining -= 12
    mask = mask.filter(ImageFilter.GaussianBlur(max(2, grow * .6)))

    coverage = float(np.asarray(mask, dtype=np.float32).mean()) / 255.0
    # Nếu vùng khác biệt phủ gần hết ảnh thì bước dán đã không còn khu trú, và
    # việc giới hạn vùng chẳng bảo vệ được gì — trả None để đường gọi giữ nguyên
    # hành vi cũ thay vì âm thầm cho qua một ảnh đã bị vẽ lại toàn bộ.
    if coverage > 0.55:
        return None, {'applied': False, 'reason': 'accessory_region_too_large', 'coverage': round(coverage, 4)}

    merged = Image.composite(refined, clean, mask)
    return merged, {'applied': True, 'coverage': round(coverage, 4), 'growPx': grow}


def restore_secondary_people(source, result, boxes):
    """Composite verified secondary people back after generative pose editing.

    FLUX is allowed to redraw the main subject, but users explicitly require
    every other person to stay unchanged. A soft source composite makes that
    guarantee deterministic instead of relying on prompt compliance alone.
    """
    source = source.convert('RGB')
    result = result.convert('RGB').resize(source.size, Image.Resampling.LANCZOS)
    canvas = result.copy()
    width, height = source.size
    restored = 0
    for raw in boxes or []:
        x1, y1, x2, y2 = [float(value) for value in raw]
        margin_x = max(4, (x2 - x1) * .045)
        margin_y = max(4, (y2 - y1) * .035)
        x1, y1 = max(0, int(x1 - margin_x)), max(0, int(y1 - margin_y))
        x2, y2 = min(width, int(x2 + margin_x)), min(height, int(y2 + margin_y))
        if x2 - x1 < 36 or y2 - y1 < 72:
            continue
        crop = source.crop((x1, y1, x2, y2))
        feather = max(3, int(min(crop.size) * .025))
        mask = Image.new('L', crop.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle(
            (feather, feather, crop.width - feather, crop.height - feather),
            radius=feather * 2,
            fill=255,
        )
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
        canvas.paste(crop, (x1, y1), mask)
        restored += 1
    return canvas, restored


def adjust_garment_fit(image, fit_delta):
    # Ước lượng hình ảnh cho việc chọn sai size, KHÔNG phải mô phỏng vải vật lý
    # thật: fit_delta < 0 (chọn size nhỏ hơn khuyến nghị) -> thu hẹp khổ vải
    # tham chiếu để lên đồ trông bó/chật hơn dáng chuẩn; fit_delta > 0 (chọn
    # size lớn hơn khuyến nghị) -> nới khổ vải để trông rộng/thùng thình hơn.
    # CHÚ Ý: chỉnh rất nhẹ tay — cắt nhiều sẽ làm CatVTON không nhận ra được
    # trang phục gốc và có thể trả lại gần như ảnh gốc (không thay đồ được gì),
    # nên ưu tiên an toàn cho việc thay đồ thành công hơn là hiệu ứng chật/rộng rõ.
    fit_delta = max(-3, min(3, int(fit_delta or 0)))
    if not fit_delta:
        return image
    width, height = image.size
    magnitude = abs(fit_delta)
    if fit_delta < 0:
        trim = min(int(width * 0.018 * magnitude), int(width * 0.05))
        if trim < 4:
            return image
        return image.crop((trim, 0, width - trim, height))
    pad = min(int(width * 0.022 * magnitude), int(width * 0.07))
    if pad < 4:
        return image
    mode = image.mode
    fill = (255, 255, 255) if mode == 'RGB' else (0, 0, 0, 0)
    canvas = Image.new(mode, (width + pad * 2, height), fill)
    canvas.paste(image, (pad, 0))
    left_edge = image.crop((0, 0, 1, height)).resize((pad, height))
    right_edge = image.crop((width - 1, 0, width, height)).resize((pad, height))
    canvas.paste(left_edge, (0, 0))
    canvas.paste(right_edge, (width + pad, 0))
    return canvas


def compose(image, accessories, pose):
    canvas = image.convert('RGBA')
    applied = []
    # Thứ tự này cũng là thứ tự lớp ảnh: chụp tai nằm sau, kẹp tóc nằm trên
    # cùng; không phụ thuộc khách bấm chọn món nào trước.
    # Ba lô đứng đầu vì nó ở SAU lưng: vẽ trước để mọi thứ khác nằm đè lên.
    # Đai thắt eo nằm trên thân nhưng dưới các món cầm tay (tay che được đai).
    layer_order = {'backpack': -1, 'waist': 0,
                   'shoe': 1, 'bag': 1, 'sword': 1, 'hand': 1,
                   'umbrella': 2, 'hat': 3, 'earmuffs': 3, 'hair_clip': 4}
    selected = list(accessories[:4])
    selected.sort(key=lambda value: layer_order.get(str(value.get('kind') or 'hand'), 0))
    for accessory in selected:
        path = Path(accessory.get('imagePath') or '')
        if not path.exists():
            continue
        item = remove_background(path)
        kind = str(accessory.get('kind') or 'hand')
        if kind == 'hat':
            action = add_hat(canvas, item, pose)
        elif kind == 'hair_clip':
            action = add_hair_clip(canvas, item, pose)
        elif kind == 'earmuffs':
            action = add_earmuffs(canvas, item, pose)
        elif kind == 'umbrella':
            action = add_umbrella(canvas, item, pose)
        elif kind == 'shoe':
            action = add_shoe(canvas, item, pose)
        elif kind == 'backpack':
            action = add_backpack(canvas, item, pose)
        elif kind == 'waist':
            action = add_waist_sash(canvas, item, pose)
        else:
            action = add_hand_prop(canvas, item, pose, kind)
        applied.append({'id': accessory.get('id'), 'name': accessory.get('name'), 'kind': kind, 'action': action})
    return canvas, applied


def main():
    payload = json.loads(sys.stdin.read() or '{}')
    try:
        mode = payload.get('mode', 'analyze')
        image = decode_image(payload.get('imageBase64'))
        if mode == 'analyze':
            pose, normalized = analyze(image, include_normalized=True)
            print(json.dumps({
                'ok': True,
                'pose': pose,
                'normalizedImageBase64': encode_png(normalized) if normalized is not None else '',
            }, ensure_ascii=False))
            return
        if mode == 'fit_adjust':
            adjusted = adjust_garment_fit(image.convert('RGB'), payload.get('fitDelta'))
            print(json.dumps({'ok': True, 'imageBase64': encode_png(adjusted)}, ensure_ascii=False))
            return
        if mode == 'seam_split':
            split, seam = add_safe_seam_split(image.convert('RGB'))
            print(json.dumps({'ok': True, 'imageBase64': encode_png(split), 'seamSplit': seam}, ensure_ascii=False))
            return
        if mode == 'tight_fit':
            fitted, effect = add_safe_tight_fit(image.convert('RGB'), payload.get('severity', 1.0))
            print(json.dumps({'ok': True, 'imageBase64': encode_png(fitted), 'tightFit': effect}, ensure_ascii=False))
            return
        if mode == 'similarity':
            other = decode_image(payload.get('compareImageBase64'))
            score = similarity_score(image, other, payload.get('pose'), payload.get('clothType', 'upper'))
            print(json.dumps({'ok': True, 'score': round(score, 3)}, ensure_ascii=False))
            return
        if mode == 'quality':
            other = decode_image(payload.get('compareImageBase64'))
            quality = tryon_quality(
                image,
                other,
                payload.get('pose'),
                payload.get('clothType', 'upper'),
                bool(payload.get('requireStraightPose')),
                payload.get('fitEffect'),
                bool(payload.get('strictIdentity')),
            )
            print(json.dumps({'ok': True, 'quality': quality}, ensure_ascii=False))
            return
        if mode == 'confine_accessory_region':
            rough = decode_image(payload.get('roughImageBase64'))
            refined = decode_image(payload.get('compareImageBase64'))
            merged, info = confine_to_accessory_region(
                image, rough, refined, extra_regions=payload.get('extraRegions'),
            )
            if merged is None:
                print(json.dumps({'ok': False, 'confine': info}, ensure_ascii=False))
                return
            print(json.dumps({
                'ok': True,
                'imageBase64': encode_png(merged),
                'confine': info,
            }, ensure_ascii=False))
            return
        if mode == 'fit_quality':
            other = decode_image(payload.get('compareImageBase64'))
            quality = fit_effect_quality(
                image, other, payload.get('pose'),
                payload.get('clothType', 'upper'), payload.get('fit') or {},
            )
            print(json.dumps({'ok': True, 'quality': quality}, ensure_ascii=False))
            return
        if mode == 'coverage_quality':
            other = decode_image(payload.get('compareImageBase64'))
            quality = coverage_quality(image, other, payload.get('pose'), payload.get('coverage') or {})
            print(json.dumps({'ok': True, 'quality': quality}, ensure_ascii=False))
            return
        if mode == 'body_analysis':
            from body_analysis import analyze_body
            pose = payload.get('pose') or analyze(image.convert('RGB'), source_coordinates=True)
            result = analyze_body(
                image.convert('RGB'), pose,
                user_height_cm=payload.get('userHeightCm') or 0,
                user_weight_kg=payload.get('userWeightKg') or 0,
                reference=payload.get('scaleReference'),
            )
            result['poseCache'] = pose
            print(json.dumps(result, ensure_ascii=False))
            return
        if mode == 'accessory_quality':
            other = decode_image(payload.get('compareImageBase64'))
            quality = accessory_quality(image, other, payload.get('kinds') or [])
            print(json.dumps({'ok': True, 'quality': quality}, ensure_ascii=False))
            return
        if mode == 'restore_secondary':
            other = decode_image(payload.get('compareImageBase64'))
            restored, count = restore_secondary_people(image, other, payload.get('boxes') or [])
            print(json.dumps({'ok': True, 'imageBase64': encode_png(restored), 'restored': count}, ensure_ascii=False))
            return
        # CatVTON có thể thay đổi vị trí tay nhẹ so với ảnh gốc, vì vậy luôn
        # đọc lại pose trên chính ảnh kết quả nếu backend không ép pose cũ.
        pose = payload.get('pose') or analyze(image, source_coordinates=True)
        result, applied = compose(image, payload.get('accessories') or [], pose)
        print(json.dumps({'ok': True, 'imageBase64': encode_png(result), 'applied': applied}, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'ok': False, 'message': str(exc)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
