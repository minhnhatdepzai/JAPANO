import sys, json, base64, io, os, urllib.request, traceback
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def data_uri_to_image(data):
    if not data:
        raise ValueError("missing image data")
    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    return img

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

def draw_text(draw, xy, text, fill=(255,255,255,255), size=28, bold=False):
    try:
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        font = ImageFont.truetype(font_path, size=size)
    except:
        font = ImageFont.load_default()
    draw.text(xy, text, fill=fill, font=font)

def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    try:
        draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    except:
        draw.rectangle(box, fill=fill, outline=outline, width=width)

def make_preview(payload):
    person = data_uri_to_image(payload.get("personImageBase64", ""))
    product = payload.get("product") or {}
    accessories = payload.get("accessories") or []
    product_image_url = payload.get("productImageUrl") or product.get("firstImage") or product.get("image") or ""
    accessory_urls = payload.get("accessoryImageUrls") or []

    W, H = 900, 1250

    bg = fit_cover(person, (W, H))
    bg = bg.filter(ImageFilter.GaussianBlur(1.2))
    overlay = Image.new("RGBA", (W, H), (255, 247, 251, 75))
    canvas = Image.alpha_composite(bg, overlay)

    # person center layer
    person_fit = fit_contain(person, (760, 1120))
    px = (W - person_fit.size[0]) // 2
    py = 70
    shadow = Image.new("RGBA", (person_fit.size[0] + 28, person_fit.size[1] + 28), (0,0,0,0))
    shd = Image.new("RGBA", person_fit.size, (0,0,0,120)).filter(ImageFilter.GaussianBlur(18))
    shadow.alpha_composite(shd, (14, 14))
    canvas.alpha_composite(shadow, (px - 14, py - 4))
    canvas.alpha_composite(person_fit, (px, py))

    draw = ImageDraw.Draw(canvas)
    # header chip
    rounded_rect(draw, (28, 28, W-28, 94), 28, (255,255,255,235), (251,207,232,255), 2)
    draw_text(draw, (56, 46), "JAPANO AI TRY-ON PREVIEW", fill=(131,24,67,255), size=28, bold=True)

    # product card
    card_x, card_y, card_w, card_h = 36, H - 370, 330, 320
    rounded_rect(draw, (card_x, card_y, card_x+card_w, card_y+card_h), 28, (255,255,255,238), (236,72,153,255), 3)

    product_img = None
    try:
        product_img = load_url_image(product_image_url)
    except Exception:
        product_img = None

    if product_img:
        pfit = fit_cover(product_img, (160, 205))
        rounded_rect(draw, (card_x+18, card_y+18, card_x+178, card_y+223), 20, (253,242,248,255))
        canvas.alpha_composite(pfit, (card_x+18, card_y+18))
        # fake garment overlay marker on upper body
        ghost = fit_contain(product_img, (250, 250))
        ghost.putalpha(95)
        gx = (W - ghost.size[0]) // 2
        gy = int(H * 0.31)
        canvas.alpha_composite(ghost, (gx, gy))
    else:
        rounded_rect(draw, (card_x+18, card_y+18, card_x+178, card_y+223), 20, (253,242,248,255))
        draw_text(draw, (card_x+48, card_y+95), "SHOP", fill=(190,24,93,255), size=26, bold=True)

    pname = str(product.get("name") or "Sản phẩm shop")
    price = str(product.get("price") or "")
    draw_text(draw, (card_x+190, card_y+28), "Đồ chính", fill=(157,23,77,255), size=22, bold=True)
    # wrap product name
    words = pname.split()
    line = ""
    yy = card_y + 64
    for word in words:
        if len(line + " " + word) > 20:
            draw_text(draw, (card_x+190, yy), line.strip(), fill=(17,24,39,255), size=19, bold=True)
            yy += 27
            line = word
        else:
            line += " " + word
    if line:
        draw_text(draw, (card_x+190, yy), line.strip(), fill=(17,24,39,255), size=19, bold=True)
    if price:
        draw_text(draw, (card_x+190, card_y+178), f"{price}đ", fill=(190,24,93,255), size=22, bold=True)

    # accessories card strip
    acc_x, acc_y = 390, H - 240
    rounded_rect(draw, (acc_x, acc_y, W-36, H-50), 28, (255,255,255,238), (251,207,232,255), 2)
    draw_text(draw, (acc_x+20, acc_y+18), "Phụ kiện đã chọn", fill=(157,23,77,255), size=22, bold=True)

    shown = []
    for a in accessories:
        shown.append({
            "name": a.get("name") or "Phụ kiện",
            "url": a.get("firstImage") or a.get("image") or (a.get("images") or [""])[0],
            "price": a.get("price") or ""
        })
    if not shown and accessory_urls:
        shown = [{"name": "Phụ kiện", "url": u, "price": ""} for u in accessory_urls]

    x = acc_x + 20
    y = acc_y + 58
    for i, a in enumerate(shown[:4]):
        try:
            ai = load_url_image(a.get("url"))
        except Exception:
            ai = None
        rounded_rect(draw, (x, y, x+104, y+128), 16, (253,242,248,255), (251,207,232,255), 1)
        if ai:
            ai = fit_cover(ai, (104, 86))
            canvas.alpha_composite(ai, (x, y))
        else:
            draw_text(draw, (x+14, y+34), "ACC", fill=(190,24,93,255), size=18, bold=True)
        nm = str(a.get("name") or "Phụ kiện")[:14]
        draw_text(draw, (x+5, y+92), nm, fill=(17,24,39,255), size=12, bold=True)
        if a.get("price"):
            draw_text(draw, (x+5, y+110), str(a.get("price")) + "đ", fill=(190,24,93,255), size=12, bold=True)
        x += 116

    # position hints
    hint = "Preview fallback: sản phẩm shop + phụ kiện đã được đưa vào ảnh. Muốn ảnh AI thật, cần Gateway/model tạo ảnh."
    rounded_rect(draw, (28, H-42, W-28, H-10), 14, (17,24,39,210))
    draw_text(draw, (48, H-36), hint[:92], fill=(255,255,255,255), size=16)

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
