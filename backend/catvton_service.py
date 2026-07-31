import os
import sys
import time
import traceback
import threading
import json
from pathlib import Path

CATVTON_HOME = Path(os.environ.get('JAPANO_CATVTON_HOME', str(Path.home() / 'jp/ai/CatVTON'))).resolve()
if str(CATVTON_HOME) not in sys.path:
    sys.path.insert(0, str(CATVTON_HOME))

# app.py đọc argv ngay khi import.
sys.argv = [
    'app.py',
    '--output_dir=resource/demo/output',
    '--mixed_precision=bf16',
    '--allow_tf32',
]

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import torch
import uvicorn

print('=== Loading CatVTON model for JAPANO API, please wait... ===', flush=True)
import app as catvton_app

# CatVTON inference.py chính thức cũng chạy với skip_safety_check=True. Safety
# checker SD 1.5 hay chặn nhầm ảnh thời trang/đồng phục và trả NSFW.jpg như thể
# là kết quả thành công. Input của endpoint này chỉ ghép ảnh người + hàng catalog.
catvton_app.pipeline.skip_safety_check = True
catvton_app.pipeline.safety_checker = None
catvton_app.pipeline.feature_extractor = None
torch.cuda.empty_cache()

UPLOAD_DIR = CATVTON_HOME / 'resource/japano_upload'
OUTPUT_DIR = CATVTON_HOME / 'resource/japano_output'
NSFW_IMAGE = CATVTON_HOME / 'resource/img/NSFW.jpg'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
INFERENCE_LOCK = threading.Lock()
REPOSER = None

api = FastAPI(title='JAPANO CatVTON Real Try-On API')


@api.get('/health')
def health():
    return {
        'ok': True,
        'service': 'JAPANO CatVTON Real Try-On API',
        'fixed': {
            'steps': int(os.getenv('JAPANO_CATVTON_STEPS', '90')),
            'cfg': float(os.getenv('JAPANO_CATVTON_CFG', '4.0')),
            'seed': int(os.getenv('JAPANO_CATVTON_SEED', '70')),
        },
        'falsePositiveGuard': True,
        'mainSubjectLock': True,
        'poseTransfer': 'controlnet-openpose',
        'poseTransferLoaded': REPOSER is not None,
    }


async def save_upload(upload: UploadFile, prefix: str) -> Path:
    suffix = Path(upload.filename or '').suffix.lower()
    if suffix not in {'.jpg', '.jpeg', '.png', '.webp'}:
        suffix = '.png'
    path = UPLOAD_DIR / f'{prefix}_{int(time.time() * 1000)}{suffix}'
    data = await upload.read()
    if not data:
        raise ValueError(f'Upload {prefix} rỗng')
    path.write_bytes(data)
    return path


def is_nsfw_placeholder(image: Image.Image) -> bool:
    if not NSFW_IMAGE.exists():
        return False
    warning = Image.open(NSFW_IMAGE).convert('RGB').resize(image.size)
    return ImageChops.difference(image.convert('RGB'), warning).getbbox() is None


def _kp_point(keypoints, name):
    value = (keypoints or {}).get(name)
    if not value:
        return None
    return (float(value[0]), float(value[1]))


def _estimated_pose(keypoints, person_box):
    """Trả landmarks thật hoặc ước lượng trong box khi khớp bị che/khuất."""
    x1, y1, x2, y2 = [float(v) for v in person_box]
    width, height = max(1.0, x2 - x1), max(1.0, y2 - y1)
    def point(name, rx, ry):
        return _kp_point(keypoints, name) or (x1 + width * rx, y1 + height * ry)
    return {
        'left_shoulder': point('left_shoulder', .31, .24),
        'right_shoulder': point('right_shoulder', .69, .24),
        'left_hip': point('left_hip', .40, .57),
        'right_hip': point('right_hip', .60, .57),
        'left_knee': point('left_knee', .41, .77),
        'right_knee': point('right_knee', .59, .77),
        'left_ankle': point('left_ankle', .41, .96),
        'right_ankle': point('right_ankle', .59, .96),
    }


def garment_region(keypoints, person_box, cloth_type):
    pose = _estimated_pose(keypoints, person_box)
    if cloth_type == 'lower':
        top_left, top_right = pose['left_hip'], pose['right_hip']
        bottom_left, bottom_right = pose['left_ankle'], pose['right_ankle']
    elif cloth_type == 'overall':
        top_left, top_right = pose['left_shoulder'], pose['right_shoulder']
        bottom_left, bottom_right = pose['left_ankle'], pose['right_ankle']
    else:
        top_left, top_right = pose['left_shoulder'], pose['right_shoulder']
        bottom_left, bottom_right = pose['left_hip'], pose['right_hip']

    x1, y1, x2, y2 = [float(v) for v in person_box]
    box_w = max(1.0, x2 - x1)
    # Pose nghiêng có hai vai gần nhau; giữ chiều rộng tối thiểu dựa trên box để
    # mask không co thành một vệt mỏng.
    center_x = sum(point[0] for point in (top_left, top_right, bottom_left, bottom_right)) / 4.0
    min_half_width = box_w * (.20 if cloth_type == 'lower' else .24)
    top = sorted((top_left, top_right), key=lambda point: point[0])
    bottom = sorted((bottom_left, bottom_right), key=lambda point: point[0])
    points = [top[0], top[1], bottom[1], bottom[0]]
    expanded = []
    for index, (px, py) in enumerate(points):
        delta = px - center_x
        if abs(delta) < min_half_width:
            delta = (-1 if index in (0, 3) else 1) * min_half_width
        expanded.append((center_x + delta * 1.08, py))
    region_box = (
        min(point[0] for point in expanded), min(point[1] for point in expanded),
        max(point[0] for point in expanded), max(point[1] for point in expanded),
    )
    return expanded, region_box


def garment_polygon_mask(size, keypoints, person_box, cloth_type):
    # Chỉ mask từ vai/hông trở xuống, không chạm đầu và không lan sang người phụ.
    poly, region_box = garment_region(keypoints, person_box, cloth_type)
    region_h = max(1.0, region_box[3] - region_box[1])
    poly[0] = (poly[0][0], poly[0][1] - region_h * .035)
    poly[1] = (poly[1][0], poly[1][1] - region_h * .035)
    poly[2] = (poly[2][0], poly[2][1] + region_h * .035)
    poly[3] = (poly[3][0], poly[3][1] + region_h * .035)
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    return mask


def garment_coverage(clothing_mask, keypoints, person_box, cloth_type):
    _, box = garment_region(keypoints, person_box, cloth_type)
    x1, y1, x2, y2 = [int(v) for v in box]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(clothing_mask.width, x2), min(clothing_mask.height, y2)
    if x2 <= x1 or y2 <= y1:
        return 1.0
    region = clothing_mask.crop((x1, y1, x2, y2))
    import numpy as _np
    arr = _np.asarray(region, dtype=_np.uint8)
    return float((arr > 127).mean())


def get_reposer():
    global REPOSER
    if REPOSER is None:
        from pose_reposer import PoseReposer
        REPOSER = PoseReposer()
    return REPOSER


def prepare_catalog_cloth(cloth_path, cloth_type, target_size):
    """Tách trang phục khỏi người mẫu/nền của ảnh catalog trước khi CatVTON."""
    cloth = Image.open(cloth_path).convert('RGB')
    fitted = catvton_app.resize_and_crop(cloth, target_size)
    parsed = catvton_app.automasker(fitted, cloth_type)
    # `parsed['mask']` là vùng cần XOÁ trên người khi try-on (convex hull), không
    # phải mask vải catalog. Dùng nhãn SCHP quần áo thuần để loại mặt, tay, hoa,
    # túi và nền khỏi ảnh tham chiếu.
    from model.cloth_masker import ATR_MAPPING, LIP_MAPPING, MASK_CLOTH_PARTS, part_mask_of
    import cv2
    import numpy as _np
    atr = _np.asarray(parsed['schp_atr'])
    lip = _np.asarray(parsed['schp_lip'])
    cloth_parts = MASK_CLOTH_PARTS[cloth_type]
    cloth_mask = part_mask_of(cloth_parts, atr, ATR_MAPPING) | part_mask_of(cloth_parts, lip, LIP_MAPPING)
    kernel = _np.ones((5, 5), _np.uint8)
    cloth_mask = cv2.morphologyEx((cloth_mask > 0).astype(_np.uint8), cv2.MORPH_CLOSE, kernel, iterations=2)
    cloth_mask = cv2.dilate(cloth_mask, _np.ones((3, 3), _np.uint8), iterations=1)
    mask = Image.fromarray(cloth_mask * 255, mode='L')
    bbox = mask.getbbox()
    if bbox is None:
        return cloth_path
    coverage = float((_np.asarray(mask, dtype=_np.uint8) > 0).mean())
    if not .025 <= coverage <= .88:
        return cloth_path
    x1, y1, x2, y2 = bbox
    pad_x = max(8, int((x2 - x1) * .06))
    pad_y = max(8, int((y2 - y1) * .035))
    crop_box = (max(0, x1 - pad_x), max(0, y1 - pad_y), min(target_size[0], x2 + pad_x), min(target_size[1], y2 + pad_y))
    garment = Image.new('RGB', target_size, (255, 255, 255))
    garment.paste(fitted, (0, 0), mask.filter(ImageFilter.GaussianBlur(1.2)))
    garment = garment.crop(crop_box)
    prepared_path = UPLOAD_DIR / f'prepared_cloth_{int(time.time() * 1000)}.png'
    garment.save(prepared_path)
    return prepared_path


def _run_catvton_locked(person_path: Path, cloth_path: Path, cloth_type: str, main_person_box=None, keypoints=None, repose=False):
    cloth_type = cloth_type if cloth_type in {'upper', 'lower', 'overall'} else 'upper'
    person = Image.open(person_path).convert('RGB')
    mask_path = UPLOAD_DIR / f'mask_{int(time.time() * 1000)}.png'
    if main_person_box and len(main_person_box) == 4:
        target_size = (int(catvton_app.args.width), int(catvton_app.args.height))
        target_person = catvton_app.resize_and_crop(person, target_size)
        person_box = [float(v) for v in main_person_box]
        reposed = False
        if repose:
            repose_result = get_reposer()(target_person, person_box, keypoints or {})
            target_person = repose_result.image
            person_box = repose_result.box
            keypoints = repose_result.keypoints
            person_path = UPLOAD_DIR / f'reposed_{int(time.time() * 1000)}.png'
            target_person.save(person_path)
            reposed = True
        clothing_mask = catvton_app.automasker(target_person, cloth_type)['mask'].convert('L')
        # Khi vùng áo bị che (tay/vật ôm trước ngực) automask sẽ thủng lỗ chỗ ->
        # đắp thêm đa giác thân người để AI vẫn mặc áo lên trọn thân. Ảnh bình
        # thường (automask đã phủ đủ) KHÔNG bị đụng tới.
        if keypoints and os.getenv('JAPANO_POLYMASK', '0') == '1':
            coverage = garment_coverage(clothing_mask, keypoints, person_box, cloth_type)
            threshold = 0.30 if cloth_type == 'overall' else 0.35
            if coverage < threshold:
                pose_mask = garment_polygon_mask(target_size, keypoints, person_box, cloth_type)
                clothing_mask = ImageChops.lighter(clothing_mask, pose_mask)
        x1, y1, x2, y2 = person_box
        pad_x = max(8, (x2 - x1) * .035)
        pad_y = max(8, (y2 - y1) * .025)
        subject = Image.new('L', target_size, 0)
        ImageDraw.Draw(subject).rounded_rectangle(
            (max(0, x1 - pad_x), max(0, y1 - pad_y), min(target_size[0], x2 + pad_x), min(target_size[1], y2 + pad_y)),
            radius=18,
            fill=255,
        )
        clothing_mask = ImageChops.multiply(clothing_mask, subject)
        if clothing_mask.getbbox() is None:
            raise ValueError('Không tạo được mask cho nhân vật chính.')
        clothing_mask.save(mask_path)
    else:
        raise ValueError('Thiếu vùng nhân vật chính; từ chối thay đồ lên nhiều người.')
    prepared_cloth_path = prepare_catalog_cloth(cloth_path, cloth_type, target_size) if os.getenv('JAPANO_PREPARE_CLOTH', '1') == '1' else cloth_path
    fn = getattr(catvton_app.submit_function, '__wrapped__', catvton_app.submit_function)
    result = fn(
        {'background': str(person_path), 'layers': [str(mask_path)]},
        str(prepared_cloth_path),
        cloth_type,
        int(os.getenv('JAPANO_CATVTON_STEPS', '90')),
        float(os.getenv('JAPANO_CATVTON_CFG', '4.0')),
        int(os.getenv('JAPANO_CATVTON_SEED', '70')),
        'result only',
    )
    if is_nsfw_placeholder(result):
        raise RuntimeError('CatVTON trả ảnh cảnh báo thay vì kết quả thử đồ.')
    return result, reposed


def run_catvton(person_path: Path, cloth_path: Path, cloth_type: str, main_person_box=None, keypoints=None, repose=False):
    # Re-pose, automask và CatVTON đều dùng GPU; khóa trọn chuỗi để hai request
    # không giẫm VRAM hoặc thay pose nhầm cho nhau.
    with INFERENCE_LOCK:
        return _run_catvton_locked(person_path, cloth_path, cloth_type, main_person_box, keypoints, repose)


@api.post('/tryon')
async def tryon(
    person: UploadFile = File(...),
    cloth: UploadFile = File(...),
    cloth_type: str = Form('upper'),
    main_person_box: str = Form(''),
    keypoints: str = Form(''),
    repose: str = Form('false'),
):
    try:
        person_path = await save_upload(person, 'person')
        cloth_path = await save_upload(cloth, 'cloth')
        box = json.loads(main_person_box) if main_person_box else None
        kp = json.loads(keypoints) if keypoints else None
        should_repose = str(repose).strip().lower() in {'1', 'true', 'yes', 'on'}
        result, reposed = await run_in_threadpool(run_catvton, person_path, cloth_path, cloth_type, box, kp, should_repose)
        out_path = OUTPUT_DIR / f'result_{int(time.time() * 1000)}.png'
        result.save(out_path)
        return FileResponse(
            str(out_path), media_type='image/png', filename='japano_catvton_result.png',
            headers={'X-Japano-Reposed': 'true' if reposed else 'false'},
        )
    except Exception:
        detail = traceback.format_exc()
        print(detail, flush=True)
        return JSONResponse({'ok': False, 'message': detail}, status_code=500)


if __name__ == '__main__':
    uvicorn.run(api, host='0.0.0.0', port=7861)
