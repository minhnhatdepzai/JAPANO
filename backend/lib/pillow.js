const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'tryon_preview.py');
const PYENV_PYTHON = path.join(os.homedir(), '.pyenv', 'shims', 'python3');
const PY = process.env.PYTHON_BIN
  || process.env.JAPANO_ACCESSORY_PYTHON
  || (fs.existsSync(PYENV_PYTHON) ? PYENV_PYTHON : 'python3');

// Gọi tiến trình Python (Pillow) như một "AI service" nội bộ, nhẹ, không cần GPU/model tải về.
// Luôn resolve (không bao giờ reject) để route gọi nó không bao giờ bị treo hay crash server.
function runPillow(payload, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (result) => { if (!settled) { settled = true; if (timer) clearTimeout(timer); resolve(result); } };
    let child;
    try {
      child = spawn(PY, [SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      finish({ ok: false, message: `Không khởi động được Python: ${error.message}` });
      return;
    }
    let out = '';
    let err = '';
    timer = setTimeout(() => { child.kill(); finish({ ok: false, message: 'Pillow preview quá thời gian chờ.' }); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (error) => finish({ ok: false, message: `Cần cài Python 3 + Pillow (pip install pillow). Chi tiết: ${error.message}` }));
    child.on('close', () => {
      try { finish(JSON.parse((out || '').trim() || '{}')); }
      catch { finish({ ok: false, message: err || 'Pillow preview lỗi không rõ.' }); }
    });
    child.stdin.on('error', (error) => finish({ ok: false, message: `Pillow preview ngắt dữ liệu đầu vào: ${error.message}` }));
    try {
      child.stdin.end(JSON.stringify(payload));
    } catch (error) {
      finish({ ok: false, message: `Không gửi được ảnh tới Pillow preview: ${error.message}` });
    }
  });
}

module.exports = { runPillow };
