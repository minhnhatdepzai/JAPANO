// Gửi email thật cho luồng quên mật khẩu. Nếu .env.server có cấu hình SMTP
// thật (SMTP_HOST/PORT/USER/PASS) thì dùng luôn; nếu không, tự tạo một tài
// khoản Ethereal (hộp thư giả lập của chính Nodemailer, dùng cho dev/test) —
// cùng tinh thần "sandbox thật" như Stripe Test Mode/VNPay Sandbox: email
// được gửi và có thể xem lại thật (qua link preview), chỉ là không tới hộp
// thư ngoài đời vì môi trường này không có SMTP thật để cấu hình.
const nodemailer = require('nodemailer');
const { logger } = require('./logger');

const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const MAIL_FROM = String(process.env.MAIL_FROM || 'JAPANO <no-reply@japano.vn>');

let transporterPromise = null;
let usingEthereal = false;

function buildTransporter() {
  if (SMTP_HOST) {
    usingEthereal = false;
    return Promise.resolve(nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    }));
  }
  usingEthereal = true;
  return nodemailer.createTestAccount().then((account) => {
    logger.info({ user: account.user }, 'Không cấu hình SMTP thật — dùng hộp thư Ethereal (sandbox) để gửi email quên mật khẩu.');
    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });
  });
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
  return { ok: true, previewUrl, sandbox: usingEthereal };
}

module.exports = { sendMail };
