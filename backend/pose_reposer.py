import os
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter


TARGET_SIZE = (768, 1024)
INFERENCE_SIZE = (576, 768)


def _point(keypoints, name):
    value = (keypoints or {}).get(name)
    return (float(value[0]), float(value[1])) if value else None


def canonical_pose(person_box, keypoints, size=TARGET_SIZE):
    """Dựng skeleton chính diện, giữ đầu ở vị trí của người chính."""
    x1, y1, x2, y2 = [float(value) for value in person_box]
    box_w, box_h = max(1.0, x2 - x1), max(1.0, y2 - y1)
    center_x = (x1 + x2) / 2
    nose = _point(keypoints, 'nose') or (center_x, y1 + box_h * .14)
    left_eye = _point(keypoints, 'left_eye') or (nose[0] + box_w * .055, nose[1] - box_h * .025)
    right_eye = _point(keypoints, 'right_eye') or (nose[0] - box_w * .055, nose[1] - box_h * .025)
    face_center_x = (nose[0] + left_eye[0] + right_eye[0]) / 3
    shoulder_y = max(nose[1] + box_h * .19, y1 + box_h * .25)
    hip_y = min(y2 - box_h * .30, shoulder_y + box_h * .38)
    knee_y = min(y2 - box_h * .10, hip_y + box_h * .24)
    ankle_y = min(size[1] - 22, y2 - box_h * .025)
    if ankle_y <= knee_y:
        knee_y = hip_y + max(40, (ankle_y - hip_y) * .52)

    pose = {
        'nose': (face_center_x, nose[1]),
        'left_eye': (face_center_x + box_w * .055, left_eye[1]),
        'right_eye': (face_center_x - box_w * .055, right_eye[1]),
        'left_ear': (face_center_x + box_w * .115, nose[1] + box_h * .005),
        'right_ear': (face_center_x - box_w * .115, nose[1] + box_h * .005),
        'neck': (face_center_x, shoulder_y - box_h * .025),
        'left_shoulder': (center_x + box_w * .215, shoulder_y),
        'right_shoulder': (center_x - box_w * .215, shoulder_y),
        'left_elbow': (center_x + box_w * .285, shoulder_y + box_h * .205),
        'right_elbow': (center_x - box_w * .285, shoulder_y + box_h * .205),
        'left_wrist': (center_x + box_w * .30, shoulder_y + box_h * .43),
        'right_wrist': (center_x - box_w * .30, shoulder_y + box_h * .43),
        'left_hip': (center_x + box_w * .13, hip_y),
        'right_hip': (center_x - box_w * .13, hip_y),
        'left_knee': (center_x + box_w * .14, knee_y),
        'right_knee': (center_x - box_w * .14, knee_y),
        'left_ankle': (center_x + box_w * .15, ankle_y),
        'right_ankle': (center_x - box_w * .15, ankle_y),
    }
    # Không để skeleton đi ra ngoài canvas.
    return {name: (max(4, min(size[0] - 4, x)), max(4, min(size[1] - 4, y))) for name, (x, y) in pose.items()}


def draw_openpose(pose, size=TARGET_SIZE):
    image = Image.new('RGB', size, (0, 0, 0))
    draw = ImageDraw.Draw(image)
    limbs = [
        # Đúng thứ tự/màu limb của OpenPose Body-18 mà ControlNet v1.1 học.
        ('neck', 'right_shoulder'), ('neck', 'left_shoulder'),
        ('right_shoulder', 'right_elbow'), ('right_elbow', 'right_wrist'),
        ('left_shoulder', 'left_elbow'), ('left_elbow', 'left_wrist'),
        ('neck', 'right_hip'), ('right_hip', 'right_knee'), ('right_knee', 'right_ankle'),
        ('neck', 'left_hip'), ('left_hip', 'left_knee'), ('left_knee', 'left_ankle'),
        ('neck', 'nose'), ('nose', 'right_eye'), ('right_eye', 'right_ear'),
        ('nose', 'left_eye'), ('left_eye', 'left_ear'),
    ]
    colors = [
        (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0),
        (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85),
        (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
        (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255),
        (255, 0, 170), (255, 0, 85),
    ]
    width = max(5, int(size[0] / 100))
    radius = max(5, int(size[0] / 90))
    for index, (start, end) in enumerate(limbs):
        draw.line((*pose[start], *pose[end]), fill=colors[index], width=width)
    key_order = [
        'nose', 'neck', 'right_shoulder', 'right_elbow', 'right_wrist',
        'left_shoulder', 'left_elbow', 'left_wrist', 'right_hip',
        'right_knee', 'right_ankle', 'left_hip', 'left_knee', 'left_ankle',
        'right_eye', 'left_eye', 'right_ear', 'left_ear',
    ]
    for index, name in enumerate(key_order):
        x, y = pose[name]
        color = colors[index % len(colors)]
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return image


def body_inpaint_mask(person_box, keypoints, canonical, size=TARGET_SIZE):
    x1, y1, x2, y2 = [float(value) for value in person_box]
    box_w, box_h = max(1.0, x2 - x1), max(1.0, y2 - y1)
    center_x = (x1 + x2) / 2
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    # Xoá thân và tay cũ đủ rộng để ControlNet có thể hạ tay xuống tự nhiên.
    body_top = min(canonical['left_shoulder'][1], canonical['right_shoulder'][1]) - box_h * .13
    draw.rounded_rectangle(
        (max(0, x1 - box_w * .08), max(0, body_top), min(size[0], x2 + box_w * .08), min(size[1], y2 + box_h * .025)),
        radius=max(16, int(box_w * .08)), fill=255,
    )
    # Giữ nguyên khuôn mặt/kiểu tóc; tay che trước mặt nằm ngoài ellipse này vẫn bị xoá.
    nose = _point(keypoints, 'nose') or canonical['nose']
    face_rx, face_ry = box_w * .18, box_h * .145
    draw.ellipse((nose[0] - face_rx, nose[1] - face_ry, nose[0] + face_rx, nose[1] + face_ry * .58), fill=0)
    return mask


@dataclass
class ReposeResult:
    image: Image.Image
    keypoints: dict
    box: list


class PoseReposer:
    def __init__(self):
        import torch
        from diffusers import AutoencoderKL, ControlNetModel, DDIMScheduler, StableDiffusionControlNetInpaintPipeline, UNet2DConditionModel
        from transformers import CLIPTextModel, CLIPTokenizer

        dtype = torch.float16
        local = True
        base = 'booksforcharlie/stable-diffusion-inpainting'
        text_base = 'stable-diffusion-v1-5/stable-diffusion-v1-5'
        control_base = 'lllyasviel/control_v11p_sd15_openpose'
        print('=== Loading OpenPose ControlNet reposer for JAPANO... ===', flush=True)
        controlnet = ControlNetModel.from_pretrained(
            control_base, torch_dtype=dtype, variant='fp16', use_safetensors=True, local_files_only=local,
        )
        unet = UNet2DConditionModel.from_pretrained(
            base, subfolder='unet', torch_dtype=dtype, use_safetensors=False, local_files_only=local,
        )
        vae = AutoencoderKL.from_pretrained(
            'stabilityai/sd-vae-ft-mse', torch_dtype=dtype, use_safetensors=True, local_files_only=local,
        )
        text_encoder = CLIPTextModel.from_pretrained(
            text_base, subfolder='text_encoder', torch_dtype=dtype, variant='fp16', use_safetensors=True, local_files_only=local,
        )
        tokenizer = CLIPTokenizer.from_pretrained(text_base, subfolder='tokenizer', local_files_only=local)
        scheduler = DDIMScheduler.from_pretrained(base, subfolder='scheduler', local_files_only=local)
        self.pipe = StableDiffusionControlNetInpaintPipeline(
            vae=vae, text_encoder=text_encoder, tokenizer=tokenizer, unet=unet,
            controlnet=controlnet, scheduler=scheduler, safety_checker=None,
            feature_extractor=None, requires_safety_checker=False,
        )
        self.pipe.enable_attention_slicing('max')
        self.pipe.enable_vae_slicing()
        self.pipe.enable_model_cpu_offload(gpu_id=0)
        self.pipe.set_progress_bar_config(disable=True)
        print('=== OpenPose ControlNet reposer ready. ===', flush=True)

    def __call__(self, image, person_box, keypoints):
        import torch

        original = image.convert('RGB').resize(TARGET_SIZE, Image.Resampling.LANCZOS)
        target = canonical_pose(person_box, keypoints)
        control = draw_openpose(target)
        mask = body_inpaint_mask(person_box, keypoints, target)
        small_image = original.resize(INFERENCE_SIZE, Image.Resampling.LANCZOS)
        small_control = control.resize(INFERENCE_SIZE, Image.Resampling.LANCZOS)
        small_mask = mask.resize(INFERENCE_SIZE, Image.Resampling.LANCZOS)
        generator = torch.Generator(device='cpu').manual_seed(int(os.getenv('JAPANO_REPOSE_SEED', '117')))
        generated = self.pipe(
            prompt=(
                'photorealistic full body photo of the exact same adult person, front facing, '
                'upright relaxed standing pose with straight legs, both arms lowered naturally beside the torso, '
                'hands open and visible, anatomically correct body, fully clothed in a plain gray long sleeve '
                'shirt and plain gray long pants, same indoor background and camera angle'
            ),
            negative_prompt=(
                'different person, changed face, extra person, extra arms, extra hands, missing fingers, '
                'deformed hands, crossed arms, raised arms, holding object, sitting, squatting, kneeling, bent knees, '
                'shirtless, nude, bare chest, cropped body, text, watermark, cartoon'
            ),
            image=small_image,
            mask_image=small_mask,
            control_image=small_control,
            width=INFERENCE_SIZE[0], height=INFERENCE_SIZE[1],
            strength=1.0,
            num_inference_steps=int(os.getenv('JAPANO_REPOSE_STEPS', '40')),
            guidance_scale=float(os.getenv('JAPANO_REPOSE_CFG', '7.5')),
            controlnet_conditioning_scale=float(os.getenv('JAPANO_REPOSE_CONTROL', '1.65')),
            generator=generator,
        ).images[0].resize(TARGET_SIZE, Image.Resampling.LANCZOS)
        # Ngoài vùng người chính giữ nguyên pixel, tránh sửa nền/người phụ.
        feathered = mask.filter(ImageFilter.GaussianBlur(5))
        result = Image.composite(generated, original, feathered)
        output_keypoints = {name: [round(x, 2), round(y, 2), 1.0] for name, (x, y) in target.items() if name != 'neck'}
        torch.cuda.empty_cache()
        return ReposeResult(result, output_keypoints, [float(value) for value in person_box])
