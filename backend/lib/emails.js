// Email giao dịch của JAPANO: cảnh báo đăng nhập, biên nhận thanh toán, và
// xác nhận hoàn tiền. Dùng chung một khung thư có thương hiệu để ba loại email
// trông cùng một nhà, và dùng chung lib/mailer.js (SMTP thật nếu .env.server có
// SMTP_HOST, không thì hộp thư sandbox Ethereal — xem lib/mailer.js).
//
// Nguyên tắc: gửi email KHÔNG BAO GIỜ được làm hỏng thao tác chính. Mọi hàm ở
// đây đều tự nuốt lỗi và chỉ ghi log — khách vẫn thanh toán/đăng nhập/nhận hoàn
// tiền được kể cả khi máy chủ thư đang chết.
const { sendMail } = require('./mailer');
const { logger } = require('./logger');

const BRAND = 'JAPANO';
const C = { washi: '#F4EDE1', shu: '#C8452F', ink: '#1A1410', muted: '#7A6F63', line: '#E4D9C6' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const money = (value, currency) => {
  const amount = Math.round(Number(value) || 0);
  if (String(currency || 'vnd').toLowerCase() !== 'vnd') return `${amount.toLocaleString('vi-VN')} ${String(currency).toUpperCase()}`;
  return `${amount.toLocaleString('vi-VN')}₫`;
};
const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const when = (at) => new Date(Number(at) || Date.now()).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });

// Email client (Gmail, Outlook…) bỏ qua phần lớn CSS ngoài thẻ, nên khung thư
// phải dùng bảng + style nội tuyến thì mới hiển thị đúng ở mọi nơi.
function layout({ heading, intro, rows = [], note, footer }) {
  const rowsHtml = rows.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0;border:1px solid ${C.line};border-radius:10px;overflow:hidden">
      ${rows.map(([label, value], index) => `
      <tr style="background:${index % 2 ? '#FFFFFF' : '#FBF7EF'}">
        <td style="padding:10px 14px;font-size:13px;color:${C.muted};white-space:nowrap">${esc(label)}</td>
        <td style="padding:10px 14px;font-size:13px;color:${C.ink};font-weight:600;text-align:right">${value}</td>
      </tr>`).join('')}
    </table>` : '';
  return `<!doctype html><html lang="vi"><body style="margin:0;padding:0;background:${C.washi}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.washi};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${C.line};border-radius:16px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
      <tr><td style="background:${C.shu};padding:18px 24px">
        <span style="color:#FFFFFF;font-size:19px;font-weight:700;letter-spacing:2px">ジ ${BRAND}</span>
      </td></tr>
      <tr><td style="padding:24px">
        <h1 style="margin:0 0 10px;font-size:19px;color:${C.ink}">${esc(heading)}</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${C.ink}">${intro}</p>
        ${rowsHtml}
        ${note ? `<p style="margin:16px 0 0;font-size:12.5px;line-height:1.6;color:${C.muted}">${note}</p>` : ''}
      </td></tr>
      <tr><td style="padding:14px 24px;border-top:1px solid ${C.line};background:#FBF7EF">
        <p style="margin:0;font-size:11.5px;line-height:1.6;color:${C.muted}">${footer || `Email tự động từ ${BRAND} — vui lòng không trả lời thư này.`}</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

async function deliver(kind, { to, subject, html, text }) {
  if (!EMAIL_RE.test(String(to || ''))) {
    logger.warn({ kind, to }, 'Bỏ qua email giao dịch: địa chỉ người nhận không hợp lệ.');
    return { ok: false, skipped: 'invalid-recipient' };
  }
  try {
    const result = await sendMail({ to, subject, html, text });
    logger.info({ kind, to, sandbox: result.sandbox, previewUrl: result.previewUrl || undefined }, 'Đã gửi email giao dịch.');
    return result;
  } catch (error) {
    // Nuốt lỗi có chủ đích — xem chú thích đầu file.
    logger.warn({ kind, to, err: error }, 'Không gửi được email giao dịch — bỏ qua, không chặn thao tác chính.');
    return { ok: false, error: error.message };
  }
}

const itemLines = (items = []) => (items || [])
  .map((item) => `${esc(item.name || item.slug || 'Sản phẩm')} × ${Number(item.qty) || 1}${item.size ? ` · ${esc(item.size)}` : ''}${item.colorName ? ` · ${esc(item.colorName)}` : ''}`)
  .join('<br>');

const orderTotal = (order, payment) => Number(
  payment?.amount ?? order?.total ?? order?.amount
  ?? (order?.items || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0),
);

// Luôn lấy snapshot địa chỉ trên đơn, không đọc lại sổ địa chỉ hiện tại của
// người dùng: khách có thể đổi địa chỉ sau khi mua nhưng hoá đơn cũ phải giữ
// nguyên nơi giao tại thời điểm đặt hàng.
function orderAddress(order) {
  const plain = String(order?.address || '').trim();
  if (plain) return plain;
  const detail = order?.addressDetails && typeof order.addressDetails === 'object' ? order.addressDetails : {};
  return [detail.street, detail.ward, detail.district, detail.province]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(', ');
}

// ctx-aware như makeSendPushToUser trong lib/push.js: tự tra email của user từ
// state, để route chỉ cần truyền userId.
function makeMailNotifier({ read }) {
  const findUser = (userId) => (read().users || []).find((row) => String(row.id) === String(userId)) || null;

  // Cảnh báo đăng nhập — gửi mỗi lần đăng nhập thành công. Đặt
  // JAPANO_LOGIN_ALERT_MIN_INTERVAL_MS (ms) nếu muốn gộp các lần đăng nhập liên
  // tiếp của cùng một người, ví dụ khi trình diễn liên tục; mặc định 0 = luôn gửi.
  async function sendLoginAlert(user, { ip, userAgent, at = Date.now() } = {}) {
    if (!user?.email) return { ok: false, skipped: 'no-email' };
    return deliver('login-alert', {
      to: user.email,
      subject: `${BRAND} — Có phiên đăng nhập mới vào tài khoản của bạn`,
      html: layout({
        heading: 'Đăng nhập thành công',
        intro: `Xin chào ${esc(user.name || '')}, tài khoản ${BRAND} của bạn vừa được đăng nhập. Nếu đây là bạn thì không cần làm gì thêm.`,
        rows: [
          ['Thời điểm', esc(when(at))],
          ['Địa chỉ IP', esc(ip || 'không xác định')],
          ['Thiết bị', esc(String(userAgent || 'không xác định').slice(0, 120))],
        ],
        note: `Nếu <b>không phải bạn</b> thực hiện, hãy đổi mật khẩu ngay trong mục Cài đặt của ứng dụng, hoặc dùng chức năng “Quên mật khẩu” để đặt lại.`,
      }),
      text: `Tài khoản JAPANO của bạn vừa đăng nhập lúc ${when(at)} từ IP ${ip || 'không xác định'}. Nếu không phải bạn, hãy đổi mật khẩu ngay.`,
    });
  }

  // Báo mật khẩu vừa bị đổi. Đây là tín hiệu DUY NHẤT để chủ tài khoản kịp
  // phản ứng nếu người đổi không phải họ, nên gửi ngay cả khi việc đổi là hợp lệ.
  async function sendPasswordChangedAlert(user, { ip, userAgent, at = Date.now() } = {}) {
    if (!user?.email) return { ok: false, skipped: 'no-email' };
    return deliver('password-changed', {
      to: user.email,
      subject: `${BRAND} — Mật khẩu tài khoản của bạn vừa được đổi`,
      html: layout({
        heading: 'Mật khẩu đã được đổi',
        intro: `Xin chào ${esc(user.name || '')}, mật khẩu tài khoản ${BRAND} của bạn vừa được đặt lại thành công.`,
        rows: [
          ['Thời điểm', esc(when(at))],
          ['Địa chỉ IP', esc(ip || 'không xác định')],
          ['Thiết bị', esc(String(userAgent || 'không xác định').slice(0, 120))],
        ],
        note: 'Nếu <b>không phải bạn</b> thực hiện, hãy dùng ngay chức năng “Quên mật khẩu” để lấy lại quyền kiểm soát tài khoản, và liên hệ hotline của cửa hàng.',
      }),
      text: `Mật khẩu JAPANO của bạn vừa được đổi lúc ${when(at)} từ IP ${ip || 'không xác định'}. Nếu không phải bạn, hãy đặt lại mật khẩu ngay.`,
    });
  }

  // Biên nhận thanh toán — gửi khi một khoản thanh toán chuyển sang 'paid'
  // (Stripe webhook/reconcile, VNPay return/IPN).
  async function sendPaymentReceipt(userId, { order, payment } = {}) {
    const user = findUser(userId);
    const to = user?.email || order?.customer?.email;
    if (!to) return { ok: false, skipped: 'no-email' };
    const currency = payment?.currency || order?.payment?.currency || 'vnd';
    const total = orderTotal(order, payment);
    const code = order?.code || payment?.orderCode || order?.id || '';
    const address = orderAddress(order);
    return deliver('payment-receipt', {
      to,
      subject: `${BRAND} — Đã nhận thanh toán đơn #${code}`,
      html: layout({
        heading: 'Thanh toán thành công 🎉',
        intro: `Cảm ơn ${esc(user?.name || order?.customer?.name || 'bạn')}! ${BRAND} đã nhận được thanh toán cho đơn hàng của bạn và đang chuẩn bị hàng để gửi đi.`,
        rows: [
          ['Mã đơn hàng', `#${esc(code)}`],
          ['Sản phẩm', itemLines(order?.items) || '—'],
          ['Địa chỉ trên hoá đơn', esc(address || 'Chưa cung cấp')],
          ['Phương thức', esc(payment?.method || order?.payment?.method || 'Trực tuyến')],
          ['Mã giao dịch', esc(payment?.transactionCode || payment?.txn || order?.payment?.txn || '—')],
          ['Thời điểm', esc(when(payment?.updatedAt || payment?.createdAt))],
          ['Tổng thanh toán', `<span style="color:${C.shu};font-size:15px">${esc(money(total, currency))}</span>`],
        ],
        note: 'Bạn có thể theo dõi tiến trình giao hàng trong mục <b>Đơn hàng</b> của ứng dụng. Hoá đơn này cũng là bằng chứng thanh toán khi cần đổi/trả.',
      }),
      text: `JAPANO đã nhận thanh toán ${money(total, currency)} cho đơn #${code}. Địa chỉ trên hoá đơn: ${address || 'Chưa cung cấp'}. Cảm ơn bạn!`,
    });
  }

  // Xác nhận hoàn tiền — gửi khi yêu cầu huỷ/trả hàng chuyển sang 'refunded',
  // cả đường hoàn qua cổng thanh toán lẫn hoàn thủ công của cửa hàng.
  async function sendRefundNotice(userId, { returnRequest, order, amount, manual = false } = {}) {
    const user = findUser(userId);
    const to = user?.email || order?.customer?.email;
    if (!to) return { ok: false, skipped: 'no-email' };
    const currency = returnRequest?.currency || 'vnd';
    const value = Number(amount ?? returnRequest?.amount ?? 0);
    const code = returnRequest?.orderCode || order?.code || '';
    const isCancel = String(returnRequest?.kind || '') === 'cancel';
    const address = orderAddress(order);
    return deliver('refund-notice', {
      to,
      subject: `${BRAND} — Đã hoàn tiền đơn #${code}`,
      html: layout({
        heading: 'Đã hoàn tiền cho bạn',
        intro: `Xin chào ${esc(user?.name || 'bạn')}, ${BRAND} đã xử lý xong yêu cầu ${isCancel ? 'huỷ đơn' : 'trả hàng'} và hoàn lại số tiền dưới đây.`,
        rows: [
          ['Mã đơn hàng', `#${esc(code)}`],
          ['Mã yêu cầu', esc(returnRequest?.code || '—')],
          ['Loại yêu cầu', isCancel ? 'Huỷ đơn' : 'Trả hàng'],
          ['Địa chỉ trên hoá đơn', esc(address || 'Chưa cung cấp')],
          ...(returnRequest?.items?.length ? [['Sản phẩm hoàn', itemLines(returnRequest.items)]] : []),
          ['Thời điểm', esc(when(returnRequest?.updatedAt))],
          ['Số tiền hoàn', `<span style="color:${C.shu};font-size:15px">${esc(money(value, currency))}</span>`],
        ],
        note: manual
          ? 'Khoản này được cửa hàng hoàn <b>thủ công</b> (chuyển khoản/tiền mặt). Nếu sau 24 giờ bạn chưa nhận được, hãy liên hệ hotline để được hỗ trợ.'
          : 'Tiền được hoàn về đúng phương thức bạn đã thanh toán. Ngân hàng thường cần <b>5–10 ngày làm việc</b> để ghi có vào tài khoản của bạn.',
      }),
      text: `JAPANO đã hoàn ${money(value, currency)} cho đơn #${code}. Địa chỉ trên hoá đơn: ${address || 'Chưa cung cấp'}.`,
    });
  }

  return { sendLoginAlert, sendPasswordChangedAlert, sendPaymentReceipt, sendRefundNotice };
}

module.exports = { makeMailNotifier, orderAddress };
