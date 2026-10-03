"""Start the local demo, validate dependencies, then connect Android. No data reset."""
import argparse
import base64
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
HOME = Path.home()


def run(args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, **kwargs)


def get(port, path='/health'):
    with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}', timeout=5) as response:
        return json.load(response)


def start(name, command, port, cwd=ROOT, env=None):
    active = subprocess.run(['systemctl', '--user', 'is-active', '--quiet', name]).returncode == 0
    if active:
        print(f'Giữ dịch vụ đang chạy: {name}', flush=True)
        return
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1', port)) == 0:
            raise RuntimeError(f'Cổng {port} đã có tiến trình ngoài {name}; không mở chồng. Kiểm tra bằng ss -ltnp.')
    subprocess.run(['systemctl', '--user', 'reset-failed', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    args = ['systemd-run', '--user', '--collect', f'--unit={name}', f'--working-directory={cwd}',
            '--property=Restart=on-failure', '--property=RestartSec=3', f'--setenv=PATH={os.environ["PATH"]}']
    args += [f'--setenv={k}={v}' for k, v in (env or {}).items()]
    run(args + command, stdout=subprocess.DEVNULL)


def wait(name, check, timeout=180):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        try:
            if check():
                print(f'OK: {name}', flush=True)
                return
            last = 'dịch vụ trả chưa sẵn sàng'
        except Exception as error:
            last = str(error)
        time.sleep(2)
    raise RuntimeError(f'{name}: {last}. Xem journalctl --user -u japano-* -n 50. Không báo sẵn sàng khi còn lỗi.')


def device_lan_address(serial):
    """Return the phone Wi-Fi address even when ADB itself is connected by USB."""
    if not serial or serial.startswith('emulator-'):
        return None
    if ':' in serial:
        return serial.rsplit(':', 1)[0]
    adb = shutil.which('adb')
    if not adb:
        return None
    result = subprocess.run(
        [adb, '-s', serial, 'shell', 'ip', '-f', 'inet', 'addr', 'show', 'wlan0'],
        capture_output=True, text=True, timeout=5,
    )
    for line in result.stdout.splitlines():
        fields = line.strip().split()
        if len(fields) >= 2 and fields[0] == 'inet':
            return fields[1].split('/', 1)[0]
    return None


def metro_host_for_device(serial):
    """Use LAN Metro whenever a physical phone has Wi-Fi; keep reverse fallback."""
    device_host = device_lan_address(serial)
    if not device_host:
        return '127.0.0.1:8081'
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect((device_host, 9))
            lan_host = probe.getsockname()[0]
    except OSError:
        return '127.0.0.1:8081'
    return f'{lan_host}:8081'


def api_url_for_device(serial):
    """Keep large image uploads off ADB reverse, including during USB debugging."""
    if not device_lan_address(serial):
        return 'http://127.0.0.1:4100'
    return f'http://{metro_host_for_device(serial).rsplit(":", 1)[0]}:4100'


def resolve_android_serial(serial=None):
    """Return one authorized online device, following a changed Wi-Fi ADB port."""
    adb = shutil.which('adb')
    if not adb:
        return None
    devices = subprocess.check_output([adb, 'devices'], text=True)
    online = [line.split()[0] for line in devices.splitlines()[1:] if '\tdevice' in line]
    if not online:
        # Reconnect only devices already paired by the user. Never initiate pairing.
        discovered = subprocess.run([adb, 'mdns', 'services'], capture_output=True, text=True).stdout
        for line in discovered.splitlines():
            if '_adb-tls-connect._tcp' in line:
                try:
                    subprocess.run([adb, 'connect', line.split()[-1]], timeout=10, capture_output=True)
                except subprocess.TimeoutExpired:
                    print('Điện thoại đã ghép đôi không phản hồi; kiểm tra Wi-Fi hoặc cắm USB.')
        devices = subprocess.check_output([adb, 'devices'], text=True)
        online = [line.split()[0] for line in devices.splitlines()[1:] if '\tdevice' in line]
    if not online:
        return None
    if not serial and len(online) != 1:
        raise RuntimeError('Có nhiều điện thoại. Chọn bằng ./run-all.sh --device SERIAL')
    if serial and serial not in online:
        if len(online) != 1:
            raise RuntimeError(f'Điện thoại {serial} chưa online.')
        print(f'ADB Wi-Fi đổi địa chỉ {serial} -> {online[0]}; tự tiếp tục.', flush=True)
        return online[0]
    return serial or online[0]


def android(serial):
    adb = shutil.which('adb')
    if not adb:
        print('Chưa có adb: dịch vụ web đã chạy; cài Android platform-tools để mở điện thoại.')
        return
    serial = resolve_android_serial(serial)
    if not serial:
        raise RuntimeError(
            'Điện thoại chưa online qua ADB. Bật lại Gỡ lỗi không dây trên điện thoại '
            'hoặc cắm USB; launcher không báo sẵn sàng khi scrcpy/app chưa thể mở.'
        )
    args = [adb, '-s', serial]
    for port in (4100, 8081):
        run(args + ['reverse', f'tcp:{port}', f'tcp:{port}'], stdout=subprocess.DEVNULL)
        # Bytes on stdin avoid nested-shell printf losing HTTP CRLF.
        request = b'GET /api/health HTTP/1.0\r\nHost: localhost\r\n\r\n' if port == 4100 else b'GET /status HTTP/1.0\r\nHost: localhost\r\n\r\n'
        response = b''
        # Android can report the reverse rule before the UsbFfs tunnel accepts
        # the first connection, especially immediately after changing USB mode.
        # Retry the real HTTP probe instead of turning that short race into a
        # failed one-command launch.
        for _ in range(3):
            try:
                attempt = subprocess.run(
                    args + ['shell', f'toybox nc -4 -q 1 -w 2 127.0.0.1 {port}'],
                    input=request, capture_output=True, timeout=5,
                )
                response = attempt.stdout
            except subprocess.TimeoutExpired:
                response = b''
            if b'200 OK' in response:
                break
            time.sleep(1)
        if b'200 OK' not in response:
            # Some MIUI builds let application UIDs use adb reverse but the
            # `shell` UID's netcat cannot read the response. The running app
            # has already demonstrated this behavior on Redmi Note 8 Pro. In
            # that case require the exact reverse rule instead of reporting a
            # false launch failure; missing mappings still fail closed.
            mappings = subprocess.check_output(args + ['reverse', '--list'], text=True)
            expected = f'tcp:{port} tcp:{port}'
            if expected not in mappings:
                raise RuntimeError(f'ADB reverse {port} chưa được tạo. Kết nối lại điện thoại rồi chạy lại.')
            print(f'OK: ADB reverse {port} đã được tạo; MIUI shell không trả dữ liệu probe, app sẽ tự kiểm tra API.', flush=True)
    package = 'vn.japano.app'
    installed = subprocess.check_output(args + ['shell', 'pm', 'path', package], text=True)
    if 'package:' not in installed:
        apk = ROOT / 'mobile/android/app/build/outputs/apk/debug/app-debug.apk'
        if not apk.is_file():
            raise RuntimeError('Chưa có APK JAPANO. Build APK debug trước khi chạy trên máy mới.')
        run(args + ['install', '-r', apk])
    # Only change RN development host; retain credentials and every other preference.
    # Wireless ADB reverse is reliable for small API requests, but can stall on
    # Metro's multi-megabyte JS bundle. Let the phone fetch Metro over Wi-Fi.
    metro_host = metro_host_for_device(serial)
    prefs = 'shared_prefs/vn.japano.app_preferences.xml'
    existing = subprocess.run(args + ['exec-out', 'run-as', package, 'cat', prefs], capture_output=True)
    if existing.returncode == 0:
        root = ET.fromstring(existing.stdout)
        setting = next((n for n in root if n.get('name') == 'debug_http_host'), None)
        if setting is None:
            setting = ET.SubElement(root, 'string', name='debug_http_host')
        if setting.text != metro_host:
            setting.text = metro_host
            run(args + ['shell', 'am', 'force-stop', package])
            encoded = base64.b64encode(ET.tostring(root, encoding='utf-8', xml_declaration=True)).decode('ascii')
            absolute_prefs = f'/data/user/0/{package}/{prefs}'
            remote_write = f"run-as {package} sh -c 'echo {encoded} | base64 -d > {absolute_prefs}'"
            run(args + ['shell', remote_write], stdout=subprocess.DEVNULL)
    # An external photo picker (Facebook/Gallery) can remain above MainActivity
    # in JAPANO's Android task. In that state plain `am start` only brings that
    # stale picker task to the foreground. Stop only the JAPANO process first;
    # force-stop does not clear app data, credentials or photos.
    run(args + ['shell', 'am', 'force-stop', package], stdout=subprocess.DEVNULL)
    run(args + ['shell', 'am', 'start', '-n', package + '/.MainActivity'], stdout=subprocess.DEVNULL)
    metro_route = 'Wi-Fi LAN' if metro_host != '127.0.0.1:8081' else 'ADB reverse'
    print(f'OK: điện thoại {serial}, API có ADB dự phòng + Metro qua {metro_route} ({metro_host}). Giữ dữ liệu app; đăng nhập nếu app yêu cầu.')
    watchdog = 'japano-adb-reverse'
    active = subprocess.run(['systemctl', '--user', 'is-active', '--quiet', watchdog]).returncode == 0
    if not active:
        subprocess.run(['systemctl', '--user', 'reset-failed', watchdog], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        run([
            'systemd-run', '--user', '--collect', f'--unit={watchdog}',
            '--property=Restart=always', '--property=RestartSec=3',
            sys.executable, str(ROOT / 'scripts/adb_reverse_watch.py'),
            '--adb', adb, '--serial', serial,
        ], stdout=subprocess.DEVNULL)
    print('OK: watchdog giữ ADB reverse 4100/8081 khi Wi-Fi chập chờn.', flush=True)
    scrcpy = shutil.which('scrcpy') or str(HOME / '.local/bin/scrcpy')
    if os.access(scrcpy, os.X_OK):
        mirror = 'japano-phone-mirror'
        # Restart the transient mirror so its command follows a changed Wi-Fi
        # ADB port. This does not restart the app or clear any app data.
        subprocess.run(['systemctl', '--user', 'stop', mirror], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(['systemctl', '--user', 'reset-failed', mirror], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        run([
            'systemd-run', '--user', '--collect', f'--unit={mirror}',
            scrcpy, '--serial', serial, '--window-title', 'JAPANO Redmi Note 8 Pro', '--stay-awake',
        ], stdout=subprocess.DEVNULL)
        # scrcpy may be active for a fraction of a second while its server is
        # still connecting, then die when wireless ADB has gone offline. Wait
        # beyond that handshake before claiming the desktop mirror is open.
        time.sleep(3)
        mirror_running = subprocess.run(
            ['systemctl', '--user', 'is-active', '--quiet', mirror]
        ).returncode == 0
        device_still_online = serial in (resolve_android_serial(serial) or '')
        if mirror_running and device_still_online:
            print('OK: màn hình ảo scrcpy đang mở trên máy tính.', flush=True)
        else:
            subprocess.run(['systemctl', '--user', 'stop', mirror], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            raise RuntimeError(
                'scrcpy không giữ được kết nối với điện thoại. Bật lại Gỡ lỗi không dây '
                'hoặc cắm USB rồi chạy lại ./run-all.sh.'
            )
    else:
        print('App đã mở; máy chưa cài scrcpy nên chưa thể mở màn hình ảo.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-phone', action='store_true', help='Chỉ khởi động web và AI')
    parser.add_argument('--device', help='ADB serial khi có nhiều thiết bị')
    args = parser.parse_args()
    os.chdir(ROOT)
    node, npm = shutil.which('node'), shutil.which('npm')
    if not node or not npm:
        raise RuntimeError('Cần Node >=20 và npm trong PATH (nvm use 24).')
    image = os.environ.get('JAPANO_IMAGE_PYTHON', str(HOME / 'jp/ai/fashn-vton-1.5/.venv/bin/python'))
    train = os.environ.get('JAPANO_TRAIN_PYTHON', str(HOME / 'Downloads/fanpage-chatbot/.venv/bin/python'))
    ollama = os.environ.get('JAPANO_OLLAMA_BIN', str(HOME / '.local/ollama/bin/ollama'))
    adapter = os.environ.get('JAPANO_CHAT_RUN', str(ROOT / 'backend/ai_training/runs/chat-lora-20260928'))
    vision = os.environ.get('JAPANO_VISION_MODEL', 'qwen3-vl:8b')
    for executable in (image, train, ollama):
        if not os.access(executable, os.X_OK):
            raise RuntimeError(f'Thiếu môi trường đã cài: {executable}')
    if not (Path(adapter) / 'report.json').is_file():
        raise RuntimeError(f'Thiếu adapter đã train: {adapter}')
    run([node, 'scripts/validate_japan_scenes.js'], stdout=subprocess.DEVNULL)
    print('OK: ảnh nền và vị trí đứng khám phá Nhật Bản', flush=True)
    start('japano-ollama', [ollama, 'serve'], 11434, env={'OLLAMA_HOST': '127.0.0.1:11434'})
    wait('Ollama', lambda: 'models' in get(11434, '/api/tags'), 30)
    if not any(m.get('name') == vision for m in get(11434, '/api/tags')['models']):
        print(f'Đang tải mô hình kiểm tra bikini {vision}; lần đầu có thể lâu.', flush=True)
        run([ollama, 'pull', vision], env={**os.environ, 'OLLAMA_HOST': '127.0.0.1:11434'})
    start('japano-body-analysis', [image, 'backend/body_analysis_service.py'], 7863)
    start('japano-fashn', [image, 'backend/fashn_service.py'], 7862)
    start('japano-motion', [image, 'backend/motion_service.py'], 7864)
    start('japano-chat-adapter', [train, 'backend/ai_training/serve_chat_adapter.py', '--run', adapter], 7866)
    start('japano-backend', [node, 'backend/server.js'], 4100, env={
        'JAPANO_CHAT_LANGGRAPH': '1', 'JAPANO_CHAT_ADAPTER_URL': 'http://127.0.0.1:7866',
        'PYTHON_BIN': image, 'JAPANO_ACCESSORY_PYTHON': image, 'JAPANO_VISION_MODEL': vision})
    start('japano-storefront-local', [npm, '--prefix', str(ROOT / 'web'), 'run', 'dev'], 4200,
          env={'JAPANO_API_ORIGIN': 'http://127.0.0.1:4100'})
    checks = [
        ('Database + backend', lambda: get(4100, '/api/health').get('database', {}).get('connected')),
        ('Phân tích ảnh / ghép cảnh', lambda: get(7863).get('ok')),
        ('Thử đồ thường + bikini + đổi tư thế', lambda: all(get(7862).get(k) for k in ('modelReady', 'poseEditorReady', 'fitRefinerReady'))),
        ('Video + CUDA', lambda: all(get(7864).get(k) for k in ('ok', 'modelReady', 'cudaRuntimeReady'))),
        ('Chatbot adapter', lambda: get(7866).get('engineeringGate')),
    ]
    for name, check in checks:
        wait(name, check)
    with urllib.request.urlopen('http://127.0.0.1:4200', timeout=30) as response:
        if response.status != 200:
            raise RuntimeError('Website chưa sẵn sàng.')
    if not args.no_phone:
        # Resolve the live Wi-Fi serial before Metro is started. Without an
        # explicit --device the old order produced 127.0.0.1 here, routing
        # multi-megabyte try-on photos through slow ADB reverse.
        phone_serial = resolve_android_serial(args.device)
        if not phone_serial:
            # Stop an old mirror which would otherwise restart forever against
            # an offline Wi-Fi serial and misleadingly look "activating".
            subprocess.run(
                ['systemctl', '--user', 'stop', 'japano-phone-mirror'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            raise RuntimeError(
                'Không thấy điện thoại ADB online. Bật lại Gỡ lỗi không dây '
                'hoặc cắm USB; web/backend vẫn chạy nhưng app và scrcpy chưa sẵn sàng.'
            )
        api_url = api_url_for_device(phone_serial)
        metro_env = {'EXPO_PUBLIC_API_URL': api_url, 'EXPO_USE_METRO_WORKSPACE_ROOT': '1'}
        # `start()` intentionally keeps healthy services. Metro's public env is
        # compiled into the JS bundle, so a healthy process with a stale API URL
        # must be restarted instead of silently reused.
        current_metro_env = subprocess.run(
            ['systemctl', '--user', 'show', 'japano-metro', '-p', 'Environment', '--value'],
            capture_output=True, text=True,
        ).stdout
        if subprocess.run(['systemctl', '--user', 'is-active', '--quiet', 'japano-metro']).returncode == 0 \
                and f'EXPO_PUBLIC_API_URL={api_url}' not in current_metro_env.split():
            print(f'Đổi Metro API sang {api_url}; khởi động lại bundle cũ.', flush=True)
            subprocess.run(['systemctl', '--user', 'stop', 'japano-metro'], check=True)
        start('japano-metro', [str(Path(npm).with_name('npx')), 'expo', 'start', '--dev-client', '--host', 'lan', '--port', '8081'],
              8081, cwd=ROOT / 'mobile', env=metro_env)
        wait('Metro', lambda: urllib.request.urlopen('http://127.0.0.1:8081/status', timeout=5).read() == b'packager-status:running', 60)
        android(phone_serial)
    print('\nDỊCH VỤ SẴN SÀNG — mô hình tạo ảnh/video nạp khi bấm, GPU chạy theo hàng chờ.')
    print('Web: http://localhost:4200 | Admin: http://localhost:4100/admin/')
    print('Chạy lại cùng lệnh được; không xoá dữ liệu, không tải lại model đã có.')
    print('Readiness không bảo đảm mọi ảnh vượt kiểm tra chất lượng/18+. Không đóng máy chủ khi dùng điện thoại.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.SubprocessError, OSError, ValueError) as error:
        print(f'\nCHƯA SẴN SÀNG: {error}', file=sys.stderr)
        sys.exit(1)
