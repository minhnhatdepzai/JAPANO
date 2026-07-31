import sys
import json
import base64
import io

from PIL import Image


def decode_data_uri(value):
    text = str(value or '')
    if ',' in text and text.strip().startswith('data:'):
        text = text.split(',', 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(text))).convert('RGBA')


def encode_png(img):
    buf = io.BytesIO()
    img.convert('RGB').save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('ascii')


def dominant_color(img):
    small = img.convert('RGB').resize((32, 32))
    pixels = list(small.getdata())
    count = len(pixels) or 1
    red = sum(pixel[0] for pixel in pixels) // count
    green = sum(pixel[1] for pixel in pixels) // count
    blue = sum(pixel[2] for pixel in pixels) // count
    return '#%02x%02x%02x' % (red, green, blue)


def main():
    payload = json.loads(sys.stdin.read() or '{}')
    mode = payload.get('mode', '')
    try:
        if mode == 'dominant_color':
            image = decode_data_uri(payload['imageBase64'])
            print(json.dumps({'ok': True, 'hex': dominant_color(image)}))
            return
        print(json.dumps({
            'ok': False,
            'message': 'Chế độ ghép ảnh sản phẩm lên người đã bị vô hiệu hóa; chỉ chấp nhận kết quả từ model thử đồ AI.',
        }))
    except Exception as exc:  # luôn trả JSON để backend không treo
        print(json.dumps({'ok': False, 'message': str(exc)}))


if __name__ == '__main__':
    main()
