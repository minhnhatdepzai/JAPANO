// Gửi email giao dịch. Có hai chế độ:
//   · SMTP thật  — khi .env.server có SMTP_HOST (+ USER/PASS). Thư tới hộp thư
//                  ngoài đời.
//   · Ethereal   — hộp thư giả lập của chính Nodemailer. Thư vẫn được gửi thật
//                  qua SMTP và xem lại được qua link preview, chỉ là không tới
//                  hộp thư ngoài đời.
//
// Điểm quan trọng: cấu hình SMTP SAI thì TỰ RƠI VỀ Ethereal chứ không làm chết
// toàn bộ email. Trước đây chỉ cần đặt SMTP_HOST kèm mật khẩu sai là mọi email
// của hệ thống ngừng hoạt động — mà lỗi lại nằm im trong log, tệ hơn cả khi
// không cấu hình gì. Rơi về sandbox giữ cho quên-mật-khẩu, biên nhận thanh
// toán, xác nhận hoàn tiền vẫn chạy; còn lý do hỏng thì được ghi log ở mức
// warn và trả về trong kết quả gửi để trang quản trị/CLI nhìn thấy.
const nodemailer = require('nodemailer');
const { logger } = require('./logger');

const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const MAIL_FROM = String(process.env.MAIL_FROM || 'JAPANO <no-reply@japano.vn>');

let transporterPromise = null;
let usingEthereal = false;
// Vì sao SMTP thật không dùng được (nếu có) — giữ lại để báo cho người vận hành.
let smtpFailure = '';

function createSmtpTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

async function createEtherealTransport(reason) {
  const account = await nodemailer.createTestAccount();
  usingEthereal = true;
  logger.info({ user: account.user, reason }, 'Dùng hộp thư Ethereal (sandbox) — email gửi được và xem lại qua link preview, nhưng không tới hộp thư ngoài đời.');
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
}

// Gmail trả 535 khi bị đưa mật khẩu tài khoản thay vì App Password 16 ký tự —
// lỗi phổ biến nhất, nên nói thẳng cách sửa thay vì để nguyên chuỗi khó hiểu.
function explainSmtpError(error) {
  const message = String(error?.message || error);
  if (/535|invalid login|username and password not accepted|badcredentials/i.test(message)) {
    return `${message} — Gmail từ chối mật khẩu thường; cần App Password 16 ký tự (myaccount.google.com/apppasswords, phải bật 2FA trước).`;
  }
  return message;
}

async function buildTransporter() {
  if (!SMTP_HOST) return createEtherealTransport('chưa cấu hình SMTP_HOST');

  const transport = createSmtpTransport();
  try {
    // Bắt tay trước khi dùng: phát hiện sai mật khẩu/cổng ngay lúc này thay vì
    // để từng email một rơi rụng về sau.
    await transport.verify();
    usingEthereal = false;
    smtpFailure = '';
    logger.info({ host: SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), user: process.env.SMTP_USER || '(không xác thực)' },
      'Dùng SMTP thật — email sẽ tới hộp thư ngoài đời.');
    return transport;
  } catch (error) {
    smtpFailure = explainSmtpError(error);
    logger.warn({ host: SMTP_HOST, err: smtpFailure },
      'SMTP thật không dùng được — tạm chuyển sang hộp thư sandbox để email của hệ thống không ngừng hoạt động.');
    return createEtherealTransport(`SMTP thật lỗi: ${smtpFailure}`);
  }
}

function getTransporter() {
  transporterPromise ||= buildTransporter().catch((error) => {
    transporterPromise = null;
    throw error;
  });
  return transporterPromise;
}

async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({ from: MAIL_FROM, to, subject, html, text });
  const previewUrl = usingEthereal ? nodemailer.getTestMessageUrl(info) || '' : '';
  if (previewUrl) logger.info({ to, subject, previewUrl }, 'Đã gửi email (sandbox Ethereal) — xem nội dung tại previewUrl.');
  return { ok: true, previewUrl, sandbox: usingEthereal, smtpFailure: smtpFailure || undefined };
}

// Bắt tay với máy chủ thư mà KHÔNG gửi gì — dùng cho scripts/testMail.js để
// tách bạch "sai mật khẩu/sai cổng" với "gửi được nhưng thư không tới".
async function verifyMailer() {
  const transporter = await getTransporter();
  await transporter.verify();
  return {
    ok: true,
    mode: usingEthereal ? 'ethereal-sandbox' : 'smtp',
    host: usingEthereal ? 'ethereal' : SMTP_HOST,
    from: MAIL_FROM,
    smtpFailure: smtpFailure || undefined,
  };
}

// Chế độ THỰC TẾ đang chạy (chỉ chắc chắn sau lần gửi/verify đầu tiên) — khác
// với "có cấu hình SMTP hay không", vì cấu hình sai sẽ rơi về sandbox.
const mailerMode = () => (SMTP_HOST && !usingEthereal ? 'smtp' : 'ethereal-sandbox');
const mailerConfiguredHost = () => SMTP_HOST;
const mailerFailure = () => smtpFailure;

module.exports = { sendMail, verifyMailer, mailerMode, mailerConfiguredHost, mailerFailure };
