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

// Mỗi món phải neo vào ĐÚNG bộ phận cơ thể. Phân loại sai là ảnh sai rõ ràng:
// chiếc ba lô từng bị xếp chung nhóm "túi" nên nhân vật cầm nó trên tay thay vì
// đeo sau lưng, còn đai obi thì bị cầm lủng lẳng thay vì thắt ngang eo.
//
//   backpack  → đeo sau lưng, quai vắt qua hai vai
//   bag       → túi xách, cầm/quàng ở tay
//   waist     → thắt ngang eo (đai obi, thắt lưng)
//   hand      → cầm tay (quạt, gấu bông, khăn furoshiki…)
//   hat / hair_clip / earmuffs → trên đầu, ba điểm neo khác nhau
//   shoe      → hai bàn chân
function accessoryKind(product = {}) {
  const text = `${product.name || ''} ${product.slug || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  // Ba lô xét trước mọi thứ: "ba lô" chứa cả chuỗi con khớp với mẫu dù và mẫu túi.
  if (/(ba ?lô|ba ?lo|balo|backpack|rucksack|knapsack)/i.test(text)) return 'backpack';
  // "dù" và "ô" phải đứng RIÊNG thành một từ. Mẫu cũ là /(dù|du |ô |...)/ nên
  // bất kỳ tên nào có một từ kết thúc bằng "ô" rồi tới dấu cách đều bị nhận là
  // cái dù — "Ba lô da bò" chẳng hạn. Dùng ranh giới từ thay cho dấu cách trần.
  if (/(^|[\s\-_])(dù|du|ô|o)([\s\-_]|$)/i.test(text) || /(umbrella|parasol)/i.test(text)) return 'umbrella';
  // Kẹp tóc và chụp tai không phải mũ: mỗi món có điểm neo và vùng kiểm tra
  // riêng. Gom cả hai vào `hat` từng làm chúng bị đặt lơ lửng trên đỉnh đầu.
  if (/(chụp tai|chup tai|earmuff)/i.test(text)) return 'earmuffs';
  if (/(kẹp nơ|kep no|kẹp tóc|kep toc|trâm|tram|kanzashi|hair.?clip|hairpin)/i.test(text)) return 'hair_clip';
  if (/(mũ|mu |nón|non |\bhat\b)/i.test(text)) return 'hat';
  if (/(giày|giay|dép|dep|guốc|guoc|geta|vớ|vo-tat|tất|tat|tabi|sandal|shoe|sock|zori)/i.test(text)) return 'shoe';
  // Ba lô phải đứng TRƯỚC túi: "balo vải" khớp cả hai mẫu, và đeo lưng mới đúng.
  if (/(ba ?lô|ba ?lo|balo|backpack|rucksack|knapsack)/i.test(text)) return 'backpack';
  if (/(túi|tui|bag|purse|handbag)/i.test(text)) return 'bag';
  if (/(đai|dai |obi|thắt lưng|that lung|belt|sash)/i.test(text)) return 'waist';
  if (/(kiếm|kiem|sword|katana|bokken)/i.test(text)) return 'sword';
  return 'hand';
}

module.exports = { runAccessoryPipeline, accessoryKind };
