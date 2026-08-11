#!/usr/bin/env node
// Kiểm tra cấu hình email trong .env.server rồi gửi thử một thư thật.
//
//   npm run mail:test                      → gửi về JAPANO_ADMIN_EMAIL
//   npm run mail:test -- ban@gmail.com     → gửi về địa chỉ chỉ định
//
// Tách bạch hai loại hỏng thường gặp: KẾT NỐI (sai host/cổng/mật khẩu ứng dụng)
// và GỬI (kết nối được nhưng nhà cung cấp từ chối nhận thư).
require('../instrument');
const { verifyMailer, mailerMode } = require('../lib/mailer');
const { makeMailNotifier } = require('../lib/emails');

const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const YELLOW = '\x1b[33m'; const OFF = '\x1b[0m';

async function main() {
  const to = String(process.argv[2] || process.env.JAPANO_ADMIN_EMAIL || '').trim();
  const mode = mailerMode();

  console.log('\n=== CẤU HÌNH EMAIL JAPANO ===');
  console.log('Chế độ       :', mode === 'smtp' ? `${GREEN}SMTP thật${OFF}` : `${YELLOW}Ethereal (hộp thư giả lập)${OFF}`);
  console.log('SMTP_HOST    :', process.env.SMTP_HOST || '(chưa đặt)');
  console.log('SMTP_PORT    :', process.env.SMTP_PORT || '(mặc định 587)');
  console.log('SMTP_USER    :', process.env.SMTP_USER || '(chưa đặt)');
  console.log('SMTP_PASS    :', process.env.SMTP_PASS ? '(đã đặt)' : '(chưa đặt)');
  console.log('MAIL_FROM    :', process.env.MAIL_FROM || 'JAPANO <no-reply@japano.vn>');
  console.log('Gửi thử tới  :', to || '(chưa có — truyền địa chỉ làm tham số)');

  if (mode !== 'smtp') {
    console.log(`\n${YELLOW}Chưa đặt SMTP_HOST nên đang dùng hộp thư giả lập.${OFF}`);
    console.log('Email vẫn gửi được và xem lại được qua link preview, nhưng KHÔNG tới hộp thư thật.');
    console.log('Muốn dùng Gmail thật, thêm vào .env.server:');
    console.log('  SMTP_HOST=smtp.gmail.com');
    console.log('  SMTP_PORT=587');
    console.log('  SMTP_USER=<email Gmail của bạn>');
    console.log('  SMTP_PASS=<App Password 16 ký tự, KHÔNG phải mật khẩu Gmail>');
    console.log('  MAIL_FROM=JAPANO <email Gmail của bạn>');
    console.log('\nApp Password lấy tại: https://myaccount.google.com/apppasswords (cần bật 2FA trước).\n');
  }

  console.log('\n--- Bước 1/2: kết nối máy chủ thư ---');
  let info;
  try {
    info = await verifyMailer();
    console.log(`${GREEN}✓ Kết nối OK${OFF}`, `(${info.mode}, ${info.host})`);
  } catch (error) {
    console.error(`${RED}✗ Kết nối THẤT BẠI:${OFF}`, error.message);
    process.exit(1);
  }

  // Cấu hình SMTP sai thì mailer tự rơi về sandbox để email hệ thống không chết
  // — nhưng phải nói to, nếu không người vận hành tưởng thư đã tới hộp thư thật.
  if (info.smtpFailure) {
    console.log(`\n${YELLOW}⚠ SMTP thật KHÔNG dùng được, đang chạy bằng hộp thư sandbox.${OFF}`);
    console.log(`  Lý do: ${info.smtpFailure}`);
    console.log(`  ${YELLOW}Thư sẽ KHÔNG tới hộp thư ngoài đời${OFF} cho tới khi sửa xong SMTP.`);
  }

  if (!to) {
    console.log(`\n${YELLOW}Không có địa chỉ nhận nên bỏ qua bước gửi thử.${OFF}`);
    console.log('Chạy lại kèm địa chỉ:  npm run mail:test -- ban@gmail.com\n');
    process.exit(0);
  }

  console.log('\n--- Bước 2/2: gửi thư thật ---');
  const mailer = makeMailNotifier({ read: () => ({ users: [] }) });
  const result = await mailer.sendLoginAlert(
    { name: 'Kiểm tra cấu hình', email: to },
    { ip: '127.0.0.1', userAgent: 'npm run mail:test' },
  );

  if (result.ok) {
    console.log(`${GREEN}✓ Đã gửi tới ${to}${OFF}`);
    if (result.previewUrl) console.log('  Xem lại (sandbox):', result.previewUrl);
    else console.log('  Kiểm tra hộp thư (kể cả thư mục Spam/Quảng cáo).');
    console.log();
    process.exit(0);
  }
  console.error(`${RED}✗ Gửi thất bại:${OFF}`, result.error || result.skipped);
  process.exit(1);
}

main().catch((error) => { console.error(`${RED}Lỗi:${OFF}`, error.message); process.exit(1); });
