import sys, json, base64, io, urllib.request, traceback
from PIL import Image, ImageDraw, ImageFont, ImageFilter


def data_uri_to_image(data):
    if not data:
        raise ValueError("missing image data")
    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def image_to_data_uri(img):
    out = io.BytesIO()
    img.convert("RGB").save(out, format="PNG", quality=92)
    return "data:image/png;base64," + base64.b64encode(out.getvalue()).decode("ascii")


def fit_cover(img, size):
    w, h = img.size
    tw, th = size
    scale = max(tw / w, th / h)
    nw, nh = int(w * scale), int(h * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def fit_contain(img, max_size):
    w, h = img.size
    mw, mh = max_size
    scale = min(mw / w, mh / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return img.resize((nw, nh), Image.LANCZOS)


def load_url_image(url, timeout=18):
    if not url or not str(url).startswith(("http://", "https://")):
        return None
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def draw_text(draw, xy, text, fill=(255, 255, 255, 255), size=28, bold=False):
    try:
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        font = ImageFont.truetype(font_path, size=size)
    except Exception:
        font = ImageFont.load_default()
    draw.text(xy, text, fill=fill, font=font)


# Square corners only (no rounded corners anywhere, kể cả ảnh preview)
def rect(draw, box, fill, outline=None, width=1):
    draw.rectangle(box, fill=fill, outline=outline, width=width)


def make_preview(payload):
    person = data_uri_to_image(payload.get("personImageBase64", ""))
    product = payload.get("product") or {}
    accessories = payload.get("accessories") or []
    product_image_url = payload.get("productImageUrl") or product.get("firstImage") or product.get("image") or ""
    accessory_urls = payload.get("accessoryImageUrls") or []

    W, H = 900, 1250

    bg = fit_cover(person, (W, H)).filter(ImageFilter.GaussianBlur(1.2))
    overlay = Image.new("RGBA", (W, H), (20, 16, 14, 70))
    canvas = Image.alpha_composite(bg, overlay)

    person_fit = fit_contain(person, (760, 1120))
    px = (W - person_fit.size[0]) // 2
    py = 70
    shadow = Image.new("RGBA", (person_fit.size[0] + 28, person_fit.size[1] + 28), (0, 0, 0, 0))
    shd = Image.new("RGBA", person_fit.size, (0, 0, 0, 120)).filter(ImageFilter.GaussianBlur(18))
    shadow.alpha_composite(shd, (14, 14))
    canvas.alpha_composite(shadow, (px - 14, py - 4))
    canvas.alpha_composite(person_fit, (px, py))

    draw = ImageDraw.Draw(canvas)
    rect(draw, (28, 28, W - 28, 92), (255, 253, 247, 235), (231, 214, 196, 255), 2)
    draw_text(draw, (52, 44), "JAPANO - XEM THU THU DO (preview)", fill=(43, 33, 27, 255), size=26, bold=True)

    # Thẻ đồ chính + ghost overlay lên thân trên
    card_x, card_y, card_w, card_h = 36, H - 372, 332, 320
    rect(draw, (card_x, card_y, card_x + card_w, card_y + card_h), (255, 253, 247, 238), (163, 58, 47, 255), 3)

    product_img = None
    try:
        product_img = load_url_image(product_image_url)
    except Exception:
        product_img = None

    if product_img:
        pfit = fit_cover(product_img, (160, 205))
        rect(draw, (card_x + 18, card_y + 18, card_x + 178, card_y + 223), (247, 239, 227, 255))
        canvas.alpha_composite(pfit, (card_x + 18, card_y + 18))
        ghost = fit_contain(product_img, (260, 260))
        ghost.putalpha(105)
        gx = (W - ghost.size[0]) // 2
        gy = int(H * 0.30)
        canvas.alpha_composite(ghost, (gx, gy))
    else:
        rect(draw, (card_x + 18, card_y + 18, card_x + 178, card_y + 223), (247, 239, 227, 255))
        draw_text(draw, (card_x + 44, card_y + 95), "SHOP", fill=(163, 58, 47, 255), size=26, bold=True)

    draw = ImageDraw.Draw(canvas)
    pname = str(product.get("name") or "San pham shop")
    price = str(product.get("price") or "")
    draw_text(draw, (card_x + 190, card_y + 26), "Do chinh", fill=(163, 58, 47, 255), size=22, bold=True)
    yy = card_y + 62
    line = ""
    for word in pname.split():
        if len(line + " " + word) > 18:
            draw_text(draw, (card_x + 190, yy), line.strip(), fill=(43, 33, 27, 255), size=18, bold=True)
            yy += 26
            line = word
        else:
            line += " " + word
    if line:
        draw_text(draw, (card_x + 190, yy), line.strip(), fill=(43, 33, 27, 255), size=18, bold=True)
    if price:
        draw_text(draw, (card_x + 190, card_y + 176), price + "d", fill=(163, 58, 47, 255), size=22, bold=True)

    # Phụ kiện đã chọn -> ghép thật vào ảnh
    acc_x, acc_y = 392, H - 240
    rect(draw, (acc_x, acc_y, W - 36, H - 50), (255, 253, 247, 238), (231, 214, 196, 255), 2)
    draw_text(draw, (acc_x + 20, acc_y + 16), "Phu kien da chon", fill=(163, 58, 47, 255), size=22, bold=True)

    shown = []
    for a in accessories:
        shown.append({
            "name": a.get("name") or "Phu kien",
            "url": a.get("firstImage") or a.get("image") or (a.get("images") or [""])[0],
            "price": a.get("price") or "",
        })
    if not shown and accessory_urls:
        shown = [{"name": "Phu kien", "url": u, "price": ""} for u in accessory_urls]

    x = acc_x + 20
    y = acc_y + 56
    for a in shown[:4]:
        try:
            ai = load_url_image(a.get("url"))
        except Exception:
            ai = None
        rect(draw, (x, y, x + 104, y + 128), (247, 239, 227, 255), (231, 214, 196, 255), 1)
        if ai:
            ai = fit_cover(ai, (104, 86))
            canvas.alpha_composite(ai, (x, y))
            draw = ImageDraw.Draw(canvas)
        else:
            draw_text(draw, (x + 12, y + 34), "ACC", fill=(163, 58, 47, 255), size=18, bold=True)
        draw_text(draw, (x + 5, y + 92), str(a.get("name"))[:14], fill=(43, 33, 27, 255), size=12, bold=True)
        x += 116

    hint = "Preview ghep: do chinh + phu kien da dua vao anh. Muon anh AI that, can chay CatVTON/Gateway."
    rect(draw, (28, H - 42, W - 28, H - 10), (28, 20, 15, 215))
    draw_text(draw, (48, H - 36), hint[:96], fill=(255, 255, 255, 255), size=15)

    return image_to_data_uri(canvas)


def main():
    try:
        payload = json.load(sys.stdin)
        img = make_preview(payload)
        print(json.dumps({"ok": True, "imageBase64": img}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "message": str(e), "trace": traceback.format_exc()}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
