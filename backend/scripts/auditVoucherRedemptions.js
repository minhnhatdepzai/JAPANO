#!/usr/bin/env node
// Rà soát và (khi được yêu cầu rõ ràng) vá sổ đổi voucher.
//
// MẶC ĐỊNH LÀ DRY-RUN. Không có `--apply` thì script chỉ ĐỌC và in báo cáo.
//
// Vì sao cần: dữ liệu cũ được tạo bởi phiên bản cộng `voucher.used` ngay lúc
// tạo đơn và không bao giờ trả lại. Các bản ghi đó không có `status`, và
// `voucher.used` có thể đã lệch khỏi số lượt thật sự được tiêu.
//
// Nguyên tắc:
//   - Bản ghi thiếu `status` được đọc BẢO THỦ là đã tiêu (`consumed`). Không
//     bao giờ tự giảm `used` cho chúng — đoán sai theo hướng đó là tặng thêm
//     quyền lợi tài chính cho khách.
//   - Chỉ vá những gì chứng minh được: đơn đã huỷ/thanh toán thất bại mà lượt
//     dùng vẫn bị giữ, voucher goal cũ chưa có phạm vi sản phẩm.
//   - Không in PII: chỉ mã voucher, id đơn và id bản ghi.
//   - Chạy hai lần cho cùng kết quả.
const fs = require('fs');
const path = require('path');
const { createStore } = require('../lib/store');
const { statusOf, voucherScope, CONSUMED, RELEASED } = require('../lib/voucherLifecycle');
const { normalizeGoalVoucherScope } = require('../lib/goalFund');

const APPLY = process.argv.includes('--apply');
const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const TERMINAL_ORDER_STATUSES = ['cancelled'];
const FAILED_PAYMENT_STATUSES = ['failed', 'cancelled', 'expired'];

function orderById(state, id) {
  return (state.orders || []).find((order) => String(order.id) === String(id)) || null;
}

function audit(state) {
  const report = {
    scannedVouchers: (state.vouchers || []).length,
    scannedRedemptions: (state.voucherRedemptions || []).length,
    legacyWithoutStatus: 0,
    duplicateRedemptions: [],
    orphanRedemptions: [],
    releasableReservations: [],
    usedMismatch: [],
    goalVouchersMissingScope: [],
    goalVouchersMissingProduct: [],
  };

  const byOrder = new Map();
  for (const row of state.voucherRedemptions || []) {
    if (!row.status) report.legacyWithoutStatus += 1;
    const key = String(row.orderId || '');
    const list = byOrder.get(key) || [];
    list.push(row);
    byOrder.set(key, list);
  }
  byOrder.forEach((rows, orderId) => {
    if (rows.length > 1) report.duplicateRedemptions.push({ orderId, ids: rows.map((row) => row.id) });
    if (!orderById(state, orderId)) report.orphanRedemptions.push({ orderId, ids: rows.map((row) => row.id) });
  });

  for (const row of state.voucherRedemptions || []) {
    if (statusOf(row) !== 'reserved') continue;
    const order = orderById(state, row.orderId);
    if (!order) continue;
    const orderDead = TERMINAL_ORDER_STATUSES.includes(String(order.status));
    const paymentDead = FAILED_PAYMENT_STATUSES.includes(String(order.payment?.status || ''));
    if (orderDead || paymentDead) {
      report.releasableReservations.push({
        id: row.id, orderId: row.orderId, code: row.code,
        reason: orderDead ? `order:${order.status}` : `payment:${order.payment?.status}`,
      });
    }
  }

  for (const voucher of state.vouchers || []) {
    const consumed = (state.voucherRedemptions || [])
      .filter((row) => String(row.code || '').toUpperCase() === String(voucher.code || '').toUpperCase())
      .filter((row) => statusOf(row) === CONSUMED).length;
    const used = finite(voucher.used, 0);
    if (used !== consumed) report.usedMismatch.push({ code: voucher.code, used, consumedRedemptions: consumed });
    if (String(voucher.source || '') === 'goal-fund') {
      if (voucherScope(voucher) === 'product' && !voucher.scope) report.goalVouchersMissingScope.push(voucher.code);
      const ids = Array.isArray(voucher.eligibleProductIds) ? voucher.eligibleProductIds : [];
      if (!ids.length && !voucher.goalProductId) report.goalVouchersMissingProduct.push(voucher.code);
    }
  }
  return report;
}

// Chỉ vá những gì chứng minh được. Idempotent: chạy lần hai không đổi gì thêm.
function repair(state, report, now = Date.now()) {
  const changes = { released: 0, scoped: 0 };
  for (const row of report.releasableReservations) {
    const record = (state.voucherRedemptions || []).find((item) => String(item.id) === String(row.id));
    if (!record || statusOf(record) !== 'reserved') continue;
    record.status = RELEASED;
    record.releasedAt = now;
    record.releaseReason = `audit:${row.reason}`;
    changes.released += 1;
  }
  for (const voucher of state.vouchers || []) {
    if (String(voucher.source || '') !== 'goal-fund') continue;
    if (voucher.scope === 'product' && Array.isArray(voucher.eligibleProductIds) && voucher.eligibleProductIds.length) continue;
    const goal = (state.goals || []).find((item) => String(item.id) === String(voucher.goalId));
    normalizeGoalVoucherScope(voucher, goal || null);
    changes.scoped += 1;
  }
  return changes;
}

function printReport(report, changes) {
  const lines = [
    `voucher quét            : ${report.scannedVouchers}`,
    `bản ghi đổi quét        : ${report.scannedRedemptions}`,
    `thiếu status (đọc = đã tiêu): ${report.legacyWithoutStatus}`,
    `trùng theo đơn          : ${report.duplicateRedemptions.length}`,
    `mồ côi (không thấy đơn) : ${report.orphanRedemptions.length}`,
    `đang giữ chỗ mà đơn đã chết: ${report.releasableReservations.length}`,
    `used lệch số lượt đã tiêu  : ${report.usedMismatch.length}`,
    `voucher goal thiếu scope   : ${report.goalVouchersMissingScope.length}`,
    `voucher goal thiếu sản phẩm: ${report.goalVouchersMissingProduct.length}`,
  ];
  report.releasableReservations.slice(0, 20).forEach((row) => {
    lines.push(`  giữ chỗ treo: ${row.id} · đơn ${row.orderId} · ${row.code} · ${row.reason}`);
  });
  report.usedMismatch.slice(0, 20).forEach((row) => {
    lines.push(`  used lệch: ${row.code} · used=${row.used} · đã tiêu=${row.consumedRedemptions}`);
  });
  if (changes) lines.push(`ĐÃ VÁ: nhả ${changes.released} chỗ giữ · chuẩn hoá ${changes.scoped} voucher goal`);
  else lines.push('DRY-RUN — không ghi gì. Thêm --apply để thực sự vá.');
  return lines.join('\n');
}

async function main() {
  const file = process.env.JAPANO_DB_FILE || path.resolve(__dirname, '../data/db.json');

  // DRY-RUN đọc THẲNG tệp, không dựng store.
  //
  // `store.initialize()` chuẩn hoá lược đồ và GHI LẠI — chạy nó ở chế độ chỉ-đọc
  // đã sửa `schemaVersion` 6→8 và thêm trường mới vào db.json thật. Một lệnh
  // "rà soát" không được để lại bất kỳ dấu vết nào.
  if (!APPLY) {
    const raw = fs.readFileSync(file, 'utf8');
    console.log(printReport(audit(JSON.parse(raw)), null));
    return;
  }
  const store = createStore(file);
  await store.initialize();
  const state = store.read();
  const report = audit(state);
  let changes = null;
  store.update((next) => {
    changes = repair(next, audit(next));
    return next;
  });
  console.log(printReport(report, changes));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('LỖI:', error.message);
    process.exit(1);
  });
}

module.exports = { audit, repair, printReport };
