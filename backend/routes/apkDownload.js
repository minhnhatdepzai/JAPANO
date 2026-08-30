const fs = require('fs');
const path = require('path');

// Tải APK cho máy thật qua tailnet.
//
// Vì sao nằm trong backend chứ không phải `tailscale serve`: đặt thêm một
// đường dẫn cho serve cần quyền root, mà cài đặt mạng của máy không nên phải
// đổi chỉ để tải một file. Backend đã được proxy sẵn ở cổng 4101 nên nó là chỗ
// rẻ nhất để phục vụ đúng TÊN FILE và đúng MIME — hai thứ quyết định việc
// Android có mở trình cài đặt hay chỉ lưu một file .zip vô nghĩa.
const APK_DIR = path.resolve(__dirname, '../../mobile/android/app/build/outputs/apk/release');
const APK_MIME = 'application/vnd.android.package-archive';

// Chỉ cho phép đúng dạng tên đã build. Không nhận đường dẫn tuỳ ý: thư mục này
// nằm trong repo và một `..` lọt qua sẽ phục vụ được bất kỳ file nào trên máy.
const SAFE_NAME = /^[A-Za-z0-9._-]+\.apk$/;

module.exports = function registerApkRoutes(api) {
  api.get('/apk', (req, res) => {
    let files = [];
    try {
      files = fs.readdirSync(APK_DIR).filter((name) => name.endsWith('.apk'));
    } catch {
      return res.status(503).json({ ok: false, message: 'Chưa build APK nào.' });
    }
    res.json({
      ok: true,
      files: files.map((name) => {
        const stat = fs.statSync(path.join(APK_DIR, name));
        return { name, bytes: stat.size, builtAt: stat.mtime.toISOString(), url: `/api/apk/${name}` };
      }),
    });
  });

  api.get('/apk/:name', (req, res) => {
    const name = String(req.params.name || '');
    if (!SAFE_NAME.test(name)) {
      return res.status(400).json({ ok: false, message: 'Tên file APK không hợp lệ.' });
    }
    const full = path.join(APK_DIR, name);
    // path.join đã chuẩn hoá `..`; kiểm tra lại để chắc chắn vẫn nằm trong thư mục.
    if (!full.startsWith(APK_DIR + path.sep) || !fs.existsSync(full)) {
      return res.status(404).json({ ok: false, message: 'Không thấy APK này.' });
    }
    const stat = fs.statSync(full);
    res.setHeader('Content-Type', APK_MIME);
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    // APK đổi theo mỗi lần build nên không được cache.
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(full).pipe(res);
  });
};
