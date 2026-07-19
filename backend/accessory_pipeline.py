import base64
import io
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

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
        'garmentRegion': {
            'ok': False,
            'reason': 'no_person',
            'message': 'Chưa nhận rõ người chính trong ảnh. Hãy dùng ảnh sáng hơn và để người chiếm phần lớn khung hình.',
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


def analyze(image, include_normalized=False):
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
        return (pose, None) if include_normalized else pose

    boxes = result.boxes.xyxy.cpu().numpy()
    confidences = result.boxes.conf.cpu().numpy()
    points = result.keypoints.xy.cpu().numpy() if result.keypoints is not None else np.zeros((len(boxes), 17, 2))
    point_conf = result.keypoints.conf.cpu().numpy() if result.keypoints is not None and result.keypoints.conf is not None else np.ones((len(boxes), 17))
    center = np.array([width / 2, height / 2])
    diagonal = max(1.0, math.hypot(width, height))
    scored = []
    for index, box in enumerate(boxes):
        x1, y1, x2, y2 = box
        area = max(1.0, (x2 - x1) * (y2 - y1)) / max(1.0, width * height)
        box_center = np.array([(x1 + x2) / 2, (y1 + y2) / 2])
        centrality = max(0.0, 1.0 - np.linalg.norm(box_center - center) / diagonal)
        contains_center = 1.0 if x1 <= center[0] <= x2 and y1 <= center[1] <= y2 else 0.0
        score = area * 5.0 + centrality * 2.0 + contains_center * 2.5 + float(confidences[index])
        scored.append((score, index))
    _, selected = max(scored)

    names = ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder',
             'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
             'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle']
    crop = subject_crop(width, height, boxes[selected], points[selected], point_conf[selected])
    normalized = crop_and_pad(rgb, crop)
    transformed = {}
    raw_kp = {}
    for index, name in enumerate(names):
        conf = float(point_conf[selected][index])
        x, y = points[selected][index]
        # Bỏ hẳn điểm quá yếu (nhiễu), nhưng giữ ngưỡng thấp cho việc phát hiện
        # tay che ngực để bắt được cả tư thế tay khó (chắp tay, ôm đồ trước ngực).
        if conf < 0.06:
            continue
        tx, ty = target_transform(crop, float(x), float(y))
        raw_kp[name] = [round(tx, 2), round(ty, 2), round(conf, 3)]
        if conf >= 0.18:
            transformed[name] = [round(tx, 2), round(ty, 2), round(conf, 3)]
    x1, y1 = target_transform(crop, boxes[selected][0], boxes[selected][1])
    x2, y2 = target_transform(crop, boxes[selected][2], boxes[selected][3])
    box = [max(0, round(x1, 2)), max(0, round(y1, 2)), min(768, round(x2, 2)), min(1024, round(y2, 2))]
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
        ox1, oy1 = target_transform(crop, other[0], other[1])
        ox2, oy2 = target_transform(crop, other[2], other[3])
        transformed_other = [max(0, round(ox1, 2)), max(0, round(oy1, 2)), min(768, round(ox2, 2)), min(1024, round(oy2, 2))]
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
        'confidence': round(float(confidences[selected]), 3),
        'fallback': False,
        'inferredKeypoints': inferred,
        'normalization': {
            'sourceSize': [width, height],
            'crop': [round(value, 2) for value in crop],
            'targetSize': list(TARGET_SIZE),
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
    # Chọn chân ở dưới thấp hơn trong khung hình (gần ống kính hơn / trụ chính)
    # để đặt giày/dép/vớ đúng vào bàn chân thay vì gắn nhầm lên tay.
    ankle = left_ankle if left_ankle[1] >= right_ankle[1] else right_ankle
    shoe = resize_alpha(item, max(70, min(260, box_w * .32)))
    paste_with_shadow(canvas, shoe, (ankle[0] - shoe.width * .5, ankle[1] - shoe.height * .32), blur=6, opacity=70)
    return 'đặt đúng vị trí bàn chân'


def add_hand_prop(canvas, item, pose, kind):
    x1, y1, x2, y2 = pose['box']
    wrist = keypoint(pose, 'right_wrist', (x2 - (x2 - x1) * .2, y1 + (y2 - y1) * .5))
    width = (x2 - x1) * (.45 if kind in {'bag', 'sword'} else .25)
    prop = resize_alpha(item, width)
    paste_with_shadow(canvas, prop, (wrist[0] - prop.width * .18, wrist[1] - prop.height * .18))
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


def tryon_quality(image_a, image_b, pose=None, cloth_type='upper', require_straight_pose=False):
    """Reject successful-looking HTTP responses that are unusable try-on images.

    This intentionally checks structure, not merely pixel change: the old gate
    accepted a large smooth rectangle because it differed greatly from the
    source.  A usable result must still contain a detected person, textured or
    edged garment structure, and must not repaint secondary people.
    """
    source = image_a.convert('RGB')
    result = image_b.convert('RGB')
    if result.size != source.size:
        result = result.resize(source.size, Image.Resampling.LANCZOS)

    result_pose = analyze(result)
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
    if edge_ratio < .012 and texture_std < 24:
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

    return {
        'ok': not reasons,
        'reasons': reasons,
        'changeScore': round(change_score, 3),
        'edgeRatio': round(edge_ratio, 4),
        'textureStd': round(texture_std, 3),
        'secondaryDiffs': [round(value, 3) for value in secondary_diffs],
        'resultPose': result_pose,
    }


def accessory_quality(clean_image, result_image, kinds):
    """Score a generative accessory edit against the clean VTON result.

    This gate protects the parts FLUX must not trade away for a pretty prop:
    visible identity/face, garment fidelity, one main person, and a genuinely
    engaged arm when an umbrella/hand prop is requested.
    """
    clean = clean_image.convert('RGB')
    result = result_image.convert('RGB').resize(clean.size, Image.Resampling.LANCZOS)
    clean_pose = analyze(clean)
    result_pose = analyze(result)
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
    if garment_diff > float(52):
        reasons.append('garment_fidelity_changed')

    inferred = set(result_pose.get('inferredKeypoints') or [])
    if 'hat' in kinds and {'left_eye', 'right_eye'}.issubset(inferred):
        reasons.append('hat_obscures_eyes')

    head_region = (x1 + box_w * .18, y1 - box_h * .06, x2 - box_w * .18, y1 + box_h * .17)
    head_diff = region_diff(head_region)
    if 'hat' in kinds and head_diff < 5:
        reasons.append('hat_missing')

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
        'bestArmAngle': round(best_arm_angle, 2),
        'maxWristTravel': round(max_wrist_travel, 4),
        'resultPose': result_pose,
    }


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
    for accessory in accessories[:4]:
        path = Path(accessory.get('imagePath') or '')
        if not path.exists():
            continue
        item = remove_background(path)
        kind = str(accessory.get('kind') or 'hand')
        if kind == 'hat':
            action = add_hat(canvas, item, pose)
        elif kind == 'umbrella':
            action = add_umbrella(canvas, item, pose)
        elif kind == 'shoe':
            action = add_shoe(canvas, item, pose)
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
            )
            print(json.dumps({'ok': True, 'quality': quality}, ensure_ascii=False))
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
        pose = payload.get('pose') or analyze(image)
        result, applied = compose(image, payload.get('accessories') or [], pose)
        print(json.dumps({'ok': True, 'imageBase64': encode_png(result), 'applied': applied}, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'ok': False, 'message': str(exc)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
