const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'accessory_pipeline.py');
const PYENV_PYTHON = path.join(os.homedir(), '.pyenv', 'shims', 'python3');
const PYTHON = process.env.JAPANO_ACCESSORY_PYTHON
  || process.env.PYTHON_BIN
  || (fs.existsSync(PYENV_PYTHON) ? PYENV_PYTHON : 'python3');

function runAccessoryPipeline(payload, timeoutMs = 150000) {
  return new Promise((resolve) => {
    let done = false;
    let timer;
    let stdout = '';
    let stderr = '';
    let child;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };
    try {
      child = spawn(PYTHON, [SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ ok: false, message: `Không khởi động được accessory pipeline: ${error.message}` });
      return;
    }
    timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, message: 'Accessory pipeline quá thời gian chờ.' });
    }, timeoutMs);
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (error) => finish({ ok: false, message: error.message }));
    child.on('close', () => {
      try { finish(JSON.parse(stdout.trim() || '{}')); }
      catch { finish({ ok: false, message: stderr || 'Accessory pipeline trả dữ liệu không hợp lệ.' }); }
    });
    // Python có thể kết thúc sớm (thiếu RAM/module hoặc request bị huỷ) trong
    // lúc Node vẫn đang đẩy ảnh base64 lớn. Nếu không bắt lỗi ở stdin, EPIPE là
    // một event không có listener và làm sập toàn bộ backend.
    child.stdin.on('error', (error) => finish({
      ok: false,
      message: `Accessory pipeline ngắt dữ liệu đầu vào: ${error.message}`,
    }));
    try {
      child.stdin.end(JSON.stringify(payload));
    } catch (error) {
      finish({ ok: false, message: `Không gửi được ảnh tới accessory pipeline: ${error.message}` });
    }
  });
}

function accessoryKind(product = {}) {
  const text = `${product.name || ''} ${product.slug || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  if (/(dù|du |ô |umbrella|parasol)/i.test(text)) return 'umbrella';
  if (/(mũ|mu |nón|non |\bhat\b|chụp tai|chup tai|kẹp|kep)/i.test(text)) return 'hat';
  if (/(giày|giay|dép|dep|guốc|guoc|geta|vớ|vo-tat|tất|tat|sandal|shoe|sock)/i.test(text)) return 'shoe';
  if (/(túi|tui|balo|bag)/i.test(text)) return 'bag';
  if (/(kiếm|kiem|sword)/i.test(text)) return 'sword';
  return 'hand';
}

module.exports = { runAccessoryPipeline, accessoryKind };
