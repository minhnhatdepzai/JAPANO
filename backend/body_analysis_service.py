"""Worker thường trú cho bước phân tích cơ thể.

Vì sao tồn tại: `runAccessoryPipeline` sinh MỘT TIẾN TRÌNH PYTHON MỚI cho mỗi
request. Đo trên máy thật, một request phân tích cơ thể mất 4.12 giây, trong đó:

    nạp YOLOv8n-pose      0.85s
    nạp U2Net (rembg)     ~1.4s
    suy luận thật         ~1.2s
    spawn + JSON qua Node ~0.7s

Tức là hơn một nửa thời gian dùng để nạp lại đúng hai model không hề thay đổi.
Giữ chúng thường trú đưa phần nạp về 0 ở mọi lượt sau lượt đầu.

Đây là HTTP server thư viện chuẩn, không thêm dependency, không giữ ảnh trên đĩa
và không ghi ảnh vào log. Node luôn có đường lùi về `runAccessoryPipeline` nếu
worker không chạy, nên bật/tắt service này không làm hỏng tính năng.

    JAPANO_BODY_WORKER_PORT=7863 python3 backend/body_analysis_service.py
"""

import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

PORT = int(os.getenv('JAPANO_BODY_WORKER_PORT', '7863'))
MAX_BODY_BYTES = int(os.getenv('JAPANO_BODY_WORKER_MAX_BYTES', str(48 * 1024 * 1024)))


def warm_up():
    """Nạp sẵn cả hai model để request đầu tiên không phải trả giá."""
    import numpy as np
    from PIL import Image

    import body_analysis as BA
    from accessory_pipeline import analyze

    start = time.time()
    blank = Image.fromarray(np.zeros((640, 480, 3), dtype=np.uint8))
    try:
        analyze(blank, source_coordinates=True)
    except Exception as error:
        print(f'[body-worker] cảnh báo: không nạp trước được pose: {error}', flush=True)
    try:
        BA.rembg_session()
    except Exception as error:
        print(f'[body-worker] cảnh báo: không nạp trước được rembg: {error}', flush=True)
    BA.load_trained_estimator()
    BA.load_girth_estimators()
    BA.load_bmi_estimator()
    BA.load_population_calibration()
    print(f'[body-worker] sẵn sàng sau {time.time() - start:.1f}s, cổng {PORT}', flush=True)


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *args):
        """Im lặng: log mặc định in cả query, không đáng rủi ro rò dữ liệu ảnh."""

    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip('/') in ('/health', ''):
            self._send(200, {'ok': True, 'service': 'japano-body-analysis', 'port': PORT})
        else:
            self._send(404, {'ok': False, 'message': 'not found'})

    def do_POST(self):
        if self.path.rstrip('/') != '/analyze':
            self._send(404, {'ok': False, 'message': 'not found'})
            return
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_BODY_BYTES:
            self._send(413, {'ok': False, 'message': 'payload rỗng hoặc quá lớn'})
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except Exception as error:
            self._send(400, {'ok': False, 'message': f'JSON không hợp lệ: {error}'})
            return

        from accessory_pipeline import decode_image, analyze
        import body_analysis as BA

        started = time.time()
        try:
            image = decode_image(payload.get('imageBase64'))
            if image is None:
                self._send(400, {'ok': False, 'message': 'Không đọc được ảnh.'})
                return
            image = image.convert('RGB')
            pose = payload.get('pose') or analyze(image, source_coordinates=True)
            result = BA.analyze_body(
                image, pose,
                user_height_cm=payload.get('userHeightCm') or 0,
                user_weight_kg=payload.get('userWeightKg') or 0,
                reference=payload.get('scaleReference'),
                sex=payload.get('sex') or 'unknown',
            )
            result['poseCache'] = pose
            result['durationMs'] = int((time.time() - started) * 1000)
            result['servedBy'] = 'warm-worker'
            self._send(200, result)
        except Exception as error:
            self._send(500, {'ok': False, 'message': f'{type(error).__name__}: {error}'})


def main():
    warm_up()
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    # Một GPU/một model: phục vụ tuần tự để hai request không tranh nhau ONNX session.
    server.daemon_threads = True
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
