// VNPay Sandbox — chữ ký/mã hoá thuần tuý, tách khỏi route để dùng chung giữa
// routes/paymentsVnpay.js (tạo URL thanh toán, xác minh return/IPN) mà không
// phụ thuộc Express hay state store.
const crypto = require('crypto');

// Giá trị mặc định là merchant demo công khai của VNPay dùng cho mọi ứng dụng
// thử nghiệm khi chưa đăng ký merchant riêng; đổi qua .env.server khi có merchant thật.
const VNPAY_TMN_CODE = String(process.env.VNPAY_TMN_CODE || 'TD3422D1').trim();
const VNPAY_HASH_SECRET = String(process.env.VNPAY_HASH_SECRET || 'SMKTJ11T9JQDIZQPCF7E8ZIJ6DXV969Z').trim();
const VNPAY_PAY_URL = String(process.env.VNPAY_PAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html').trim();
const VNPAY_API_URL = String(process.env.VNPAY_API_URL || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction').trim();
const VNPAY_RETURN_URL = String(process.env.VNPAY_RETURN_URL || 'https://japano.app/vnpay-return').trim();
const VNPAY_VERSION = '2.1.0';

function vnpayEnabled() {
  return Boolean(VNPAY_TMN_CODE && VNPAY_HASH_SECRET);
}

function vnpayAmount(amount) {
  const value = Number(amount || 0);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

function localVnpayAmount(amount) {
  return Math.round(Number(amount || 0) / 100);
}

// Chuỗi ASCII không dấu cho vnp_OrderInfo — cổng VNPay khuyến nghị tránh ký tự
// có dấu để không lệch chữ ký giữa các trình duyệt/thiết bị.
function vnpayAsciiText(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, (m) => (m === 'đ' ? 'd' : 'D'))
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

function vnpayFormatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// Thuật toán sắp xếp/ký chuẩn theo mẫu Node.js chính thức của VNPay: khoá đã
// encodeURIComponent để so sánh, giá trị encode và đổi %20 thành + trước khi
// nối chuỗi HMAC SHA512.
function vnpaySortParams(params) {
  const sorted = {};
  Object.keys(params).sort().forEach((key) => {
    sorted[key] = encodeURIComponent(String(params[key])).replace(/%20/g, '+');
  });
  return sorted;
}

function vnpaySignData(sortedParams) {
  return Object.entries(sortedParams).map(([key, value]) => `${key}=${value}`).join('&');
}

function vnpayHmac(signData) {
  return crypto.createHmac('sha512', VNPAY_HASH_SECRET).update(Buffer.from(signData, 'utf-8')).digest('hex');
}

function buildVnpayPaymentUrl({ txnRef, amount, orderInfo, ipAddr, bankCode, locale }) {
  const now = new Date();
  const createDate = vnpayFormatDate(now);
  const expireDate = vnpayFormatDate(new Date(now.getTime() + 15 * 60 * 1000));
  const params = {
    vnp_Version: VNPAY_VERSION,
    vnp_Command: 'pay',
    vnp_TmnCode: VNPAY_TMN_CODE,
    vnp_Locale: locale === 'en' ? 'en' : 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: vnpayAsciiText(orderInfo) || `Thanh toan don hang ${txnRef}`,
    vnp_OrderType: 'other',
    vnp_Amount: vnpayAmount(amount),
    vnp_ReturnUrl: VNPAY_RETURN_URL,
    vnp_IpAddr: /^::1$|^::ffff:/.test(String(ipAddr)) ? '127.0.0.1' : String(ipAddr || '127.0.0.1'),
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
  };
  if (bankCode) params.vnp_BankCode = String(bankCode);
  const sorted = vnpaySortParams(params);
  const signData = vnpaySignData(sorted);
  const secureHash = vnpayHmac(signData);
  const paymentUrl = `${VNPAY_PAY_URL}?${signData}&vnp_SecureHash=${secureHash}`;
  return { paymentUrl, createDate, expireDate };
}

// Xác minh chữ ký trả về từ VNPay (return URL app bắt trong WebView, hoặc IPN
// thật khi backend public). Áp dụng cùng thuật toán sắp xếp/ký như lúc tạo URL.
function verifyVnpayParams(query) {
  const params = { ...query };
  const receivedHash = String(params.vnp_SecureHash || '');
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;
  if (!receivedHash) return false;
  const sorted = vnpaySortParams(params);
  const signData = vnpaySignData(sorted);
  const expectedHash = vnpayHmac(signData);
  const a = Buffer.from(expectedHash, 'utf-8');
  const b = Buffer.from(receivedHash.toLowerCase(), 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Ký kiểu pipe cho Merchant WebApi (refund/querydr) — khác thuật toán sắp xếp
// query string dùng cho vnp_Command=pay, theo đúng tài liệu tích hợp VNPay.
function vnpayApiSign(parts) {
  return vnpayHmac(parts.join('|'));
}

module.exports = {
  VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_PAY_URL, VNPAY_API_URL, VNPAY_RETURN_URL, VNPAY_VERSION,
  vnpayEnabled, vnpayAmount, localVnpayAmount, vnpayAsciiText, vnpayFormatDate,
  vnpaySortParams, vnpaySignData, vnpayHmac, buildVnpayPaymentUrl, verifyVnpayParams, vnpayApiSign,
};
