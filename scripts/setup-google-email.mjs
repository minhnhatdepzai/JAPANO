#!/usr/bin/env node
// Nối Google Sign-In và email thật vào JAPANO chỉ bằng một lệnh.
//
//   npm run setup:auth
//
// Hai giá trị bên dưới phải điền vào ĐÚNG HAI NƠI mới chạy, và đó chính là chỗ
// dễ sai nhất khi làm tay:
//   · Google Client ID -> .env.server (backend đối chiếu audience)
//                      -> mobile/app.json (app dựng yêu cầu OAuth)
//   · App Password     -> .env.server
//
// Script sao lưu trước khi ghi, giữ nguyên mọi khoá khác, và không in bí mật ra
// màn hình.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env.server');
const APP_JSON = path.join(ROOT, 'mobile', 'app.json');

const G = '\x1b[32m'; const R = '\x1b[31m'; const Y = '\x1b[33m'; const D = '\x1b[2m'; const O = '\x1b[0m';
const ok = (m) => console.log(`${G}✓${O} ${m}`);
const warn = (m) => console.log(`${Y}!${O} ${m}`);

function backup(file) {
  if (!fs.existsSync(file)) return null;
  const target = `${file}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(file, target);
  return target;
}

// .env.server KHÔNG chỉ được dotenv đọc — start-all.sh còn `source` nó bằng
// bash. Nên giá trị phải hợp lệ với cả hai. Ví dụ MAIL_FROM có dạng
// `JAPANO <ban@gmail.com>`: để trần thì bash hiểu `<` và `>` là chuyển hướng
// tập tin và cả script chết ngay từ dòng source. Bọc nháy kép cho mọi giá trị
// có ký tự đặc biệt — dotenv tự bóc nháy, bash cũng hiểu đúng.
// Dùng NHÁY ĐƠN chứ không phải nháy kép. Trong nháy kép, bash diễn giải \$ \" \`
// còn dotenv thì giữ nguyên dấu gạch chéo — hai bên đọc ra hai giá trị khác nhau
// với mật khẩu chứa $ hoặc ". Trong nháy đơn thì CẢ HAI đều lấy nguyên văn, nên
// đó là dạng duy nhất hai bên chắc chắn đồng ý.
function envValue(value) {
  const raw = String(value);
  if (/^[A-Za-z0-9_.@/:+-]*$/.test(raw)) return raw;
  if (raw.includes("'")) {
    // Không có cách viết nào để bash và dotenv cùng hiểu đúng dấu nháy đơn —
    // báo lỗi còn hơn ghi ra một giá trị mà một trong hai bên đọc sai.
    throw new Error(`Giá trị chứa dấu nháy đơn ('), không ghi an toàn vào .env.server được: ${raw.slice(0, 12)}…`);
  }
  return `'${raw}'`;
}

// Cập nhật tại chỗ để giữ nguyên thứ tự dòng và chú thích của .env.server;
// ghi đè cả file sẽ làm mất những khoá mà script này không biết tới.
function upsertEnv(text, key, value) {
  const line = `${key}=${envValue(value)}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, line);
  return `${text.replace(/\s*$/, '')}\n${line}\n`;
}

async function main() {
  console.log(`\n=== CÀI ĐẶT GOOGLE LOGIN + EMAIL THẬT CHO JAPANO ===\n`);
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`${R}Không thấy .env.server${O} — hãy chạy script từ thư mục gốc dự án.`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, hint) => {
    if (hint) console.log(`${D}${hint}${O}`);
    const answer = (await rl.question(`${q} `)).trim();
    return answer;
  };

  console.log('Bỏ trống rồi Enter để bỏ qua phần đó.\n');

  console.log('--- 1/2 · ĐĂNG NHẬP GOOGLE ---');
  const clientId = await ask(
    'Android OAuth Client ID:',
    'Lấy tại https://console.cloud.google.com/apis/credentials → Create credentials\n'
    + '→ OAuth client ID → Android.\n'
    + '  Package name : vn.japano.app\n'
    + '  SHA-1        : 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25\n'
    + 'Dán chuỗi dạng 1234...apps.googleusercontent.com',
  );

  console.log('\n--- 2/2 · EMAIL THẬT (Gmail) ---');
  const gmail = await ask(
    'Địa chỉ Gmail:',
    'Cần bật xác thực 2 bước trước, rồi tạo App Password 16 ký tự tại\n'
    + 'https://myaccount.google.com/apppasswords',
  );
  const appPassword = gmail ? await ask('App Password (16 ký tự):') : '';
  await rl.close();

  if (!clientId && !gmail) {
    warn('Không nhập gì cả — chưa thay đổi file nào.');
    process.exit(0);
  }

  // ---- ghi .env.server -----------------------------------------------------
  const envBackup = backup(ENV_FILE);
  let env = fs.readFileSync(ENV_FILE, 'utf8');
  if (clientId) {
    env = upsertEnv(env, 'GOOGLE_CLIENT_ID_ANDROID', clientId);
    ok('.env.server → GOOGLE_CLIENT_ID_ANDROID');
  }
  if (gmail && appPassword) {
    env = upsertEnv(env, 'SMTP_HOST', 'smtp.gmail.com');
    env = upsertEnv(env, 'SMTP_PORT', '587');
    env = upsertEnv(env, 'SMTP_USER', gmail);
    env = upsertEnv(env, 'SMTP_PASS', appPassword.replace(/\s+/g, ''));
    env = upsertEnv(env, 'MAIL_FROM', `JAPANO <${gmail}>`);
    ok('.env.server → SMTP_HOST / PORT / USER / PASS / MAIL_FROM');
  }
  fs.writeFileSync(ENV_FILE, env, { mode: 0o600 });
  fs.chmodSync(ENV_FILE, 0o600); // giữ quyền chỉ chủ sở hữu đọc được
  if (envBackup) console.log(`${D}  (sao lưu: ${path.basename(envBackup)})${O}`);

  // ---- ghi mobile/app.json -------------------------------------------------
  if (clientId) {
    const appBackup = backup(APP_JSON);
    const appConfig = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
    appConfig.expo.extra ||= {};
    appConfig.expo.extra.google ||= {};
    appConfig.expo.extra.google.androidClientId = clientId;
    fs.writeFileSync(APP_JSON, `${JSON.stringify(appConfig, null, 2)}\n`);
    ok('mobile/app.json → extra.google.androidClientId');
    if (appBackup) console.log(`${D}  (sao lưu: ${path.basename(appBackup)})${O}`);
  }

  console.log(`\n${G}Đã ghi xong.${O} Bước tiếp theo:\n`);
  if (gmail && appPassword) {
    console.log(`  1. Kiểm tra email thật:   ${Y}npm run mail:test -- ${gmail}${O}`);
  }
  if (clientId) {
    console.log(`  2. Khởi động lại backend: ${Y}./start-all.sh${O}`);
    console.log(`  3. Build lại dev client:  ${Y}cd mobile && npx expo run:android${O}`);
    console.log(`     ${D}(bắt buộc một lần — dev client hiện thiếu expo-web-browser/expo-crypto)${O}`);
  }
  console.log();
}

main().catch((error) => { console.error(`${R}Lỗi:${O}`, error.message); process.exit(1); });
