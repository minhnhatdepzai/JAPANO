import sys, json, base64, io, urllib.request, math, traceback
from PIL import Image, ImageDraw, ImageFilter


def data_uri_to_image(data):
    if not data:
        return None
    if "," in data:
        data = data.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(data))).convert("RGBA")


def to_data_uri(img):
    out = io.BytesIO()
    img.convert("RGB").save(out, format="PNG", quality=90)
    return "data:image/png;base64," + base64.b64encode(out.getvalue()).decode("ascii")


def load_url(url, timeout=18):
    if not url or not str(url).startswith(("http://", "https://")):
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return Image.open(io.BytesIO(r.read())).convert("RGBA")
    except Exception:
        return None


def fit_contain(img, box):
    w, h = img.size
    s = min(box[0] / w, box[1] / h)
    return img.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)


def fit_cover(img, size):
    w, h = img.size
    s = max(size[0] / w, size[1] / h)
    img = img.resize((int(w * s), int(h * s)), Image.LANCZOS)
    l = (img.size[0] - size[0]) // 2
    t = (img.size[1] - size[1]) // 2
    return img.crop((l, t, l + size[0], t + size[1]))


SKIN = (226, 198, 174, 255)
SKIN_DK = (196, 165, 140, 255)
ACCENT = (163, 58, 47, 255)


def draw_mannequin(W, H, params, side=0.0):
    """side: 0 = front, 0.5 = 3/4, 1 = profile. Trả về ảnh RGBA người mẫu."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    height_cm = float(params.get("height", 165) or 165)
    build = float(params.get("build", 1.0) or 1.0)        # 0.8 gầy ... 1.5 đầy đặn
    shoulder = float(params.get("shoulder", 1.0) or 1.0)
    chest = float(params.get("chest", 1.0) or 1.0)
    waist = float(params.get("waist", 1.0) or 1.0)
    hip = float(params.get("hip", 1.0) or 1.0)

    # chiều cao người mẫu trong khung
    body_h = int(H * min(0.92, max(0.7, 0.62 + (height_cm - 150) / 200.0)))
    top = (H - body_h) // 2
    cx = W // 2
    unit = body_h / 8.0  # 8 "đầu"

    # hệ số bề ngang theo góc nhìn (giả lập xoay): front rộng, profile hẹp
    persp = 1.0 - 0.62 * side
    base_w = unit * 1.05 * build

    def w(mult):
        return max(4, base_w * mult * persp)

    head_r = unit * 0.5
    neck_y = top + unit * 1.0
    shoulder_y = top + unit * 1.35
    chest_y = top + unit * 2.5
    waist_y = top + unit * 3.7
    hip_y = top + unit * 4.5
    knee_y = top + unit * 6.2
    foot_y = top + body_h

    # chân
    leg_w = w(0.42)
    d.line([(cx - leg_w * 0.6, hip_y), (cx - leg_w * 0.7, foot_y)], fill=SKIN, width=int(leg_w))
    d.line([(cx + leg_w * 0.6, hip_y), (cx + leg_w * 0.7, foot_y)], fill=SKIN, width=int(leg_w))
    # thân (vai -> hông) dạng đa giác
    sw = w(1.5 * shoulder)
    cw = w(1.32 * chest)
    ww = w(1.02 * waist)
    hw = w(1.3 * hip)
    torso = [
        (cx - sw, shoulder_y), (cx + sw, shoulder_y),
        (cx + cw, chest_y), (cx + ww, waist_y), (cx + hw, hip_y),
        (cx - hw, hip_y), (cx - ww, waist_y), (cx - cw, chest_y),
    ]
    d.polygon(torso, fill=SKIN)
    # tay
    arm_w = w(0.34)
    d.line([(cx - sw * 0.92, shoulder_y), (cx - sw * 1.05, waist_y)], fill=SKIN_DK, width=int(arm_w))
    d.line([(cx + sw * 0.92, shoulder_y), (cx + sw * 1.05, waist_y)], fill=SKIN_DK, width=int(arm_w))
    # cổ + đầu
    d.line([(cx, neck_y), (cx, shoulder_y)], fill=SKIN, width=int(w(0.42)))
    hr = head_r * (1.0 - 0.25 * side)
    d.ellipse([cx - hr, neck_y - unit * 0.9, cx + hr, neck_y + unit * 0.2], fill=SKIN)

    regions = {
        "shoulder_y": shoulder_y, "chest_y": chest_y, "waist_y": waist_y, "hip_y": hip_y,
        "neck_y": neck_y, "head_y": neck_y - unit * 0.35, "foot_y": foot_y, "cx": cx,
        "shoulder_w": sw, "chest_w": cw, "hip_w": hw, "top": top, "unit": unit, "persp": persp,
    }
    return img, regions


def dress(canvas, regions, garment_img, accessories):
    """Khoác đồ + phụ kiện lên người (mẫu hoặc ảnh)."""
    cx = regions["cx"]
    if garment_img is not None:
        gw = int(regions["chest_w"] * 2.5)
        gh = int((regions["hip_y"] - regions["shoulder_y"]) * 1.15)
        g = garment_img.resize((max(8, gw), max(8, gh)), Image.LANCZOS)
        g = g.copy()
        g.putalpha(g.getchannel("A").point(lambda a: int(a * 0.92)))
        canvas.alpha_composite(g, (int(cx - gw / 2), int(regions["shoulder_y"] - regions["unit"] * 0.1)))

    # phụ kiện: đặt theo loại đoán từ tên
    slots = [
        ("neck", (cx, regions["neck_y"]), 0.9),
        ("hand", (int(cx + regions["hip_w"] * 1.6), int((regions["waist_y"] + regions["hip_y"]) / 2)), 1.1),
        ("head", (cx, int(regions["head_y"] - regions["unit"] * 0.4)), 1.0),
        ("waist", (cx, regions["waist_y"]), 0.8),
    ]
    for idx, acc in enumerate(accessories[:4]):
        ai = load_url(acc.get("url") or acc.get("image") or acc.get("firstImage"))
        if ai is None:
            continue
        name = str(acc.get("name", "")).lower()
        if any(k in name for k in ["non", "nón", "mu", "mũ", "hat", "cap", "kinh", "kính", "glass"]):
            slot = slots[2]
        elif any(k in name for k in ["tui", "túi", "bag", "dong ho", "đồng hồ", "watch", "vong tay", "vòng tay", "bracelet"]):
            slot = slots[1]
        elif any(k in name for k in ["that lung", "thắt lưng", "belt", "vay", "đai"]):
            slot = slots[3]
        else:
            slot = slots[0]
        size = int(regions["unit"] * 1.1 * slot[2])
        ai = fit_contain(ai, (size, size))
        canvas.alpha_composite(ai, (int(slot[1][0] - ai.size[0] / 2), int(slot[1][1] - ai.size[1] / 2)))


def frame_from_photo(person, garment_img, accessories, side, W, H):
    canvas = Image.new("RGBA", (W, H), (245, 240, 234, 255))
    # nền mờ
    bg = fit_cover(person, (W, H)).filter(ImageFilter.GaussianBlur(14))
    canvas.alpha_composite(Image.alpha_composite(bg, Image.new("RGBA", (W, H), (20, 16, 14, 90))))
    # người (giả lập xoay bằng nén ngang)
    p = fit_contain(person, (int(W * 0.78), int(H * 0.9)))
    persp = 1.0 - 0.45 * side
    p = p.resize((max(8, int(p.size[0] * persp)), p.size[1]), Image.LANCZOS)
    px = (W - p.size[0]) // 2
    py = (H - p.size[1]) // 2
    canvas.alpha_composite(p, (px, py))
    # khoác đồ vùng thân trên (ghost)
    if garment_img is not None:
        gw = int(p.size[0] * 0.95)
        gh = int(p.size[1] * 0.42)
        g = garment_img.resize((max(8, gw), max(8, gh)), Image.LANCZOS).copy()
        g.putalpha(g.getchannel("A").point(lambda a: int(a * 0.7)))
        canvas.alpha_composite(g, (int(W / 2 - gw / 2), int(py + p.size[1] * 0.16)))
    # phụ kiện đặt quanh phần trên
    d = ImageDraw.Draw(canvas)
    x = int(W * 0.06)
    y = int(H * 0.1)
    for acc in accessories[:4]:
        ai = load_url(acc.get("url") or acc.get("image") or acc.get("firstImage"))
        if ai is None:
            continue
        ai = fit_contain(ai, (int(W * 0.16), int(W * 0.16)))
        canvas.alpha_composite(ai, (x, y))
        y += int(W * 0.18)
    return canvas


def build(payload):
    W, H = 720, 1080
    n = int(payload.get("frames", 5) or 5)
    n = max(3, min(8, n))
    product = payload.get("product") or {}
    accessories = payload.get("accessories") or []
    garment = load_url(payload.get("productImageUrl") or product.get("firstImage") or product.get("image"))
    person = data_uri_to_image(payload.get("personImageBase64", ""))
    mannequin = payload.get("mannequin") or {}
    use_mannequin = payload.get("useMannequin") or person is None

    frames = []
    for i in range(n):
        # side đi từ 0 -> 1 -> 0 (xoay nửa vòng rồi quay lại) để mượt
        t = i / (n - 1)
        side = abs(0.5 - t) * 2.0  # 0 (front) ... 1 (profile) ... 0
        if use_mannequin:
            canvas = Image.new("RGBA", (W, H), (245, 240, 234, 255))
            d = ImageDraw.Draw(canvas)
            d.rectangle([0, int(H * 0.86), W, H], fill=(225, 215, 205, 255))  # sàn
            man, regions = draw_mannequin(W, H, mannequin, side=side)
            shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            sd = ImageDraw.Draw(shadow)
            sd.ellipse([W * 0.32, H * 0.85, W * 0.68, H * 0.9], fill=(0, 0, 0, 70))
            canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
            dress(man, regions, garment, accessories)
            canvas.alpha_composite(man)
        else:
            canvas = frame_from_photo(person, garment, accessories, side, W, H)

        d = ImageDraw.Draw(canvas)
        d.rectangle([0, 0, W, 54], fill=(28, 20, 15, 220))
        d.text((20, 16), f"JAPANO 3D  -  goc {int(side * 90)}do", fill=(255, 255, 255, 255))
        frames.append(to_data_uri(canvas))

    return {"ok": True, "frames": frames, "imageBase64": frames[0], "mannequin": use_mannequin}


def main():
    try:
        payload = json.load(sys.stdin)
        print(json.dumps(build(payload), ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "message": str(e), "trace": traceback.format_exc()}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
