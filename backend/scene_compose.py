"""Ghép người vào ảnh phong cảnh Nhật Bản — đường nhanh, chạy trên CPU.

Đây KHÔNG phải mô hình sinh ảnh. Nó tách người bằng U2Net (phiên đã ấm sẵn
trong body_analysis_service) rồi đặt lên ảnh nền có thật của địa điểm. Vì vậy
khuôn mặt, cơ thể, màu da và trang phục giữ nguyên từng pixel — thứ duy nhất
thay đổi là nền phía sau.

Vì sao không dùng thẳng model sinh ảnh cho đường mặc định: một lượt FLUX tốn
40-80 giây và luôn có rủi ro vẽ lại khuôn mặt. Ghép hình học tốn dưới 5 giây và
không thể đổi danh tính, nên nó là mặc định.

BÀI HỌC TỪ BẢN TRƯỚC. Bản đầu đặt người vào giữa khung, sát mép dưới, với một
tỉ lệ chiều cao cố định. Cách đó chỉ đúng khi mọi ảnh nền đều có mặt đất ở đáy
khung. Ảnh Naoshima cũ chụp từ ngoài biển: 45% dưới khung là nước, nên người bị
dán đứng giữa mặt biển, quá to, che landmark và không có bóng. Bây giờ mọi vị
trí đều lấy từ metadata riêng của từng scene (`backend/lib/japanScenes.js`):

  * `footAnchor`        — hai bàn chân đặt đúng điểm này, đã được xác nhận nằm
                          trên mặt đất bằng `groundPolygon`;
  * `personHeightRatio` — người cao bao nhiêu phần khung ở đúng chỗ đó;
  * `lightDirection`/`shadowAngle` — bóng đổ ngả ngược hướng nguồn sáng;
  * `lightTemperature` — kéo sắc người về phía ánh sáng của cảnh.

Ba chi tiết quyết định ảnh trông "ghép" hay "chụp thật":
  * biên mặt nạ phải được làm mềm, nếu không sẽ thấy đường cắt răng cưa;
  * tông màu người phải kéo về gần tông nền, nếu không người sáng rực trên nền
    chiều tà;
  * phải có bóng đổ ở chân, nếu không người trông như đang lơ lửng.
"""

import io
import math

import numpy as np
from PIL import Image, ImageFilter

# Hướng nguồn sáng -> vector bóng đổ (bóng ngả về phía ngược lại).
LIGHT_VECTORS = {
    'upper-left': (1.0, 0.35),
    'upper-right': (-1.0, 0.35),
    'left': (1.0, 0.1),
    'right': (-1.0, 0.1),
    'front': (0.0, 0.4),
    'back': (0.0, 0.25),
    'top': (0.0, 0.15),
}

# Nhiệt màu của cảnh -> hệ số nhân theo kênh RGB áp lên người.
TEMPERATURE_GAIN = {
    'warm': (1.045, 1.0, 0.955),
    'neutral': (1.0, 1.0, 1.0),
    'cool': (0.96, 0.99, 1.05),
    'golden': (1.07, 1.01, 0.92),
    'neon': (1.02, 0.98, 1.06),
}


def _feathered_alpha(mask, radius=2.0):
    """Alpha 0-255 từ mặt nạ nhị phân, biên được làm mềm."""
    alpha = Image.fromarray((mask.astype(np.uint8) * 255), mode='L')
    # Co vào một chút trước khi làm mềm: rembg thường để lại một viền nền mỏng
    # quanh tóc và vai, và viền đó sẽ thành quầng sáng trên nền tối.
    alpha = alpha.filter(ImageFilter.MinFilter(3))
    return alpha.filter(ImageFilter.GaussianBlur(radius))


def _tone_match(person_rgb, alpha_np, background_rgb, strength=0.35, temperature='neutral'):
    """Kéo tông màu người về phía tông nền, có kiềm chế.

    Chỉ khớp trung bình và độ lệch chuẩn theo từng kênh, và chỉ đi `strength`
    phần đường. Khớp hoàn toàn sẽ nhuộm người theo màu nền và làm hỏng màu da.
    """
    person = person_rgb.astype(np.float32)
    weight = (alpha_np.astype(np.float32) / 255.0)[:, :, None]
    total = float(weight.sum()) + 1e-6
    if total < 32:
        return person_rgb

    person_mean = (person * weight).sum(axis=(0, 1)) / total
    person_var = ((person - person_mean) ** 2 * weight).sum(axis=(0, 1)) / total
    person_std = np.sqrt(np.maximum(person_var, 1e-6))

    background = background_rgb.astype(np.float32)
    bg_mean = background.mean(axis=(0, 1))
    bg_std = background.std(axis=(0, 1)) + 1e-6

    # Giới hạn hệ số co giãn: ảnh nền tương phản rất thấp (sương, tuyết) có thể
    # nén người thành một khối phẳng nếu để tự do.
    gain = np.clip(bg_std / person_std, 0.85, 1.18)
    target = (person - person_mean) * gain + bg_mean
    blended = person * (1.0 - strength) + target * strength
    # Nhiệt màu áp sau cùng: hoàng hôn ấm và neon lạnh cần sắc khác nhau, và
    # khớp trung bình/độ lệch không diễn tả được điều đó.
    blended *= np.asarray(TEMPERATURE_GAIN.get(temperature, (1.0, 1.0, 1.0)), dtype=np.float32)
    return np.clip(blended, 0, 255).astype(np.uint8)


def _directional_shadow(size, placed_alpha, ground_y, spread, light_direction,
                        angle_deg, opacity, blur):
    """Bóng tiếp xúc dưới chân, ngả theo hướng sáng của cảnh.

    Bóng dựng từ chính dải chân của mặt nạ rồi bẹt xuống, nên nó theo đúng dáng
    đứng. Một vệt elip chung chung sẽ lộ ngay rằng người được dán vào.
    """
    width, height = size
    shadow = Image.new('L', (width, height), 0)
    top = max(0, ground_y - spread)
    bottom = min(height, ground_y + 2)
    if bottom - top <= 1:
        return shadow

    foot_band = placed_alpha.crop((0, top, width, bottom))
    flattened = foot_band.resize((width, max(2, spread // 2)), Image.Resampling.BILINEAR)

    dx, dy = LIGHT_VECTORS.get(light_direction, (0.0, 0.3))
    offset_x = int(dx * spread * 0.8 + math.sin(math.radians(angle_deg)) * spread * 0.4)
    offset_y = int(dy * spread * 0.5)
    shadow.paste(flattened, (offset_x, min(height - 2, ground_y - spread // 4 + offset_y)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(3, blur)))
    return shadow.point(lambda value: int(value * opacity))


def _cover(background, frame, anchor=None):
    """Phủ kín khung, cắt phần thừa quanh ĐIỂM ĐẶT CHÂN.

    Trả `(ảnh, anchor đã đổi sang toạ độ khung)`.

    Vì sao không cắt giữa: metadata của scene đo trên ảnh GỐC. Ảnh phong cảnh
    thường là 3:2 ngang, còn khung xuất là 2:3 dọc, nên cắt giữa chỉ giữ lại
    khoảng 40% bề ngang. Toạ độ x=0.22 đo trên ảnh gốc khi đó trỏ vào một chỗ
    hoàn toàn khác trong khung — lần chạy thật đã đặt người đứng ngay trên một
    chiếc nón giao thông. Cắt bám theo anchor giữ đúng vùng đã được duyệt.
    """
    scale = max(frame[0] / background.width, frame[1] / background.height)
    resized = background.resize(
        (max(1, math.ceil(background.width * scale)), max(1, math.ceil(background.height * scale))),
        Image.Resampling.LANCZOS)

    if anchor is None:
        left = (resized.width - frame[0]) // 2
        top = (resized.height - frame[1]) // 2
    else:
        # Đưa anchor về giữa khung rồi kẹp lại để không lộ mép ảnh.
        left = int(round(anchor[0] * resized.width - frame[0] / 2))
        top = int(round(anchor[1] * resized.height - frame[1] * 0.86))
        left = max(0, min(resized.width - frame[0], left))
        top = max(0, min(resized.height - frame[1], top))

    canvas = resized.crop((left, top, left + frame[0], top + frame[1]))
    if anchor is None:
        return canvas, None
    mapped = ((anchor[0] * resized.width - left) / frame[0],
              (anchor[1] * resized.height - top) / frame[1])
    return canvas, mapped


def compose_scene(person_image, background_image, mask, *, composition=None,
                  height_ratio=None, anchor_x=None, output_width=1024, output_height=1536):
    """Đặt người (theo `mask`) lên `background_image` theo metadata của scene.

    Trả về `(ảnh, thông tin đặt người)`.

    `composition` là khối `composition` của scene. Thiếu nó thì rơi về vị trí
    giữa-đáy khung như bản cũ — chỉ dùng cho ảnh nền tự do, không dùng cho scene
    đã được duyệt.
    """
    composition = composition or {}
    anchor = composition.get('footAnchor') or {'x': 0.5, 'y': 0.97}
    ratios = composition.get('personHeightRatio') or {'min': 0.35, 'preferred': 0.64, 'max': 0.80}

    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    if not rows.any() or not cols.any():
        raise ValueError('mặt nạ rỗng: không tách được người khỏi nền')
    y1, y2 = int(np.argmax(rows)), int(len(rows) - np.argmax(rows[::-1]))
    x1, x2 = int(np.argmax(cols)), int(len(cols) - np.argmax(cols[::-1]))

    alpha_full = _feathered_alpha(mask)
    person_rgba = person_image.convert('RGB')
    person_rgba.putalpha(alpha_full)
    # Cắt đúng bounding box THẬT của người: scale theo khung ảnh gốc sẽ sai mỗi
    # khi người không lấp đầy ảnh, và đó là trường hợp thường gặp.
    cutout = person_rgba.crop((x1, y1, x2, y2))

    frame = (output_width, output_height)
    # Cắt nền bám theo điểm đặt chân TRƯỚC, rồi mới tính vị trí dán: làm ngược
    # lại thì toạ độ đo trên ảnh gốc sẽ trỏ nhầm chỗ sau khi cắt.
    source_anchor = (
        float(anchor_x if anchor_x is not None else anchor['x']),
        float(anchor['y']),
    )
    canvas, mapped_anchor = _cover(background_image.convert('RGB'), frame, source_anchor)

    # Chiều cao mong muốn, kẹp trong khoảng scene cho phép để người dùng không
    # kéo ra một kết quả phi thực tế.
    wanted = float(height_ratio if height_ratio is not None else ratios['preferred'])
    wanted = min(float(ratios['max']), max(float(ratios['min']), wanted))
    target_h = max(64, int(frame[1] * wanted))
    target_w = max(32, int(round(cutout.width * (target_h / cutout.height))))
    if target_w > frame[0] * 0.94:
        target_w = int(frame[0] * 0.94)
        target_h = max(64, int(round(cutout.height * (target_w / cutout.width))))
    cutout = cutout.resize((target_w, target_h), Image.Resampling.LANCZOS)

    # Bàn chân rơi đúng footAnchor (đã đổi sang toạ độ khung sau khi cắt); đầu
    # suy ra từ đó. Không còn dán sát đáy khung.
    foot_x, foot_y = mapped_anchor if mapped_anchor else (0.5, 0.97)
    paste_x = max(0, min(frame[0] - target_w, int(round(foot_x * frame[0] - target_w / 2))))
    paste_y = max(0, min(frame[1] - target_h, int(round(foot_y * frame[1] - target_h))))

    person_np = np.asarray(cutout.convert('RGB'))
    alpha_np = np.asarray(cutout.split()[-1])
    toned = _tone_match(person_np, alpha_np, np.asarray(canvas),
                        temperature=composition.get('lightTemperature', 'neutral'))
    toned_image = Image.fromarray(toned, mode='RGB')
    toned_image.putalpha(Image.fromarray(alpha_np, mode='L'))

    placed_alpha = Image.new('L', frame, 0)
    placed_alpha.paste(Image.fromarray(alpha_np, mode='L'), (paste_x, paste_y))
    shadow = _directional_shadow(
        frame, placed_alpha,
        ground_y=paste_y + target_h,
        spread=max(8, target_h // 14),
        light_direction=composition.get('lightDirection', 'front'),
        angle_deg=float(composition.get('shadowAngle', 0)),
        opacity=float(composition.get('shadowOpacity', 0.35)),
        blur=int(composition.get('shadowBlur', 18)),
    )
    canvas = Image.composite(Image.new('RGB', frame, (26, 24, 22)), canvas, shadow)
    canvas.paste(toned_image, (paste_x, paste_y), toned_image)

    placement = {
        'personBox': {'x': paste_x, 'y': paste_y, 'width': target_w, 'height': target_h},
        'footAnchor': {'x': round(foot_x, 4), 'y': round(foot_y, 4)},
        'heightRatio': round(target_h / frame[1], 3),
    }
    return canvas, placement


def encode_jpeg(image, quality=90):
    buffer = io.BytesIO()
    image.convert('RGB').save(buffer, 'JPEG', quality=quality, optimize=True, progressive=True)
    return buffer.getvalue()
