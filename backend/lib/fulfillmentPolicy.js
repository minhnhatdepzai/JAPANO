// NGUỒN SỰ THẬT DUY NHẤT cho quy trình mua → giao → nhận → đổi/trả của JAPANO.
//
// Trước đây mỗi nơi mô tả quy trình một kiểu: app viết một đoạn chính sách,
// admin viết một đoạn khác, backend lại chuyển trạng thái theo cách thứ ba —
// nên "ai xác nhận bước nào" không rõ. File này định nghĩa đúng một lần: ai là
// người chịu trách nhiệm ở mỗi bước (khách / đơn vị vận chuyển / cửa hàng /
// cổng thanh toán), mốc thời gian, và điều kiện chuyển trạng thái. App, trang
// quản trị và API /api/policies/fulfillment đều đọc từ đây.

// Số ngày khách có để kiểm hàng sau khi đơn vị vận chuyển báo đã giao. Hết hạn
// mà khách không bấm xác nhận thì hệ thống tự chốt để tiền không treo vô hạn.
const AUTO_CONFIRM_DAYS = Math.max(1, Number(process.env.JAPANO_AUTO_CONFIRM_DAYS || 7));
// Cửa sổ đổi/trả tính từ lúc đơn hoàn tất (khách đã nhận và xác nhận).
const RETURN_WINDOW_DAYS = Math.max(1, Number(process.env.JAPANO_RETURN_WINDOW_DAYS || 30));
// Sau khi được duyệt trả hàng, khách có bấy nhiêu ngày để gửi hàng về.
const SHIP_BACK_DAYS = Math.max(1, Number(process.env.JAPANO_SHIP_BACK_DAYS || 7));
// Thời gian cửa hàng cam kết kiểm hàng trả và ra quyết định hoàn tiền.
const INSPECTION_DAYS = Math.max(1, Number(process.env.JAPANO_RETURN_INSPECTION_DAYS || 3));
// Thời gian tiền thực về tài khoản khách sau khi cửa hàng bấm hoàn tiền.
const REFUND_SETTLEMENT_DAYS = Math.max(1, Number(process.env.JAPANO_REFUND_SETTLEMENT_DAYS || 7));

const ACTORS = Object.freeze({
  customer: 'Khách hàng',
  shop: 'Cửa hàng JAPANO',
  carrier: 'Đơn vị vận chuyển (bên thứ ba)',
  gateway: 'Cổng thanh toán (Stripe/VNPay)',
});

// Trạng thái đơn hàng theo đúng thứ tự vòng đời. `actor` là bên DUY NHẤT được
// phép đưa đơn vào trạng thái đó.
const ORDER_STAGES = Object.freeze([
  {
    status: 'pending_payment',
    label: 'Chờ thanh toán',
    actor: 'customer',
    description: 'Đơn thanh toán trực tuyến đã được tạo, đang chờ khách hoàn tất trên cổng Stripe/VNPay. Hàng chưa được giữ cho tới khi thanh toán thành công.',
    optional: true,
  },
  {
    status: 'pending',
    label: 'Chờ cửa hàng xác nhận',
    actor: 'shop',
    description: 'Khách đã đặt hàng thành công. Cửa hàng kiểm tra tồn kho, địa chỉ và số điện thoại người nhận trước khi xác nhận.',
    customerCan: ['Yêu cầu huỷ đơn (cần cửa hàng duyệt)'],
  },
  {
    status: 'confirmed',
    label: 'Đã xác nhận · đang đóng gói',
    actor: 'shop',
    description: 'Cửa hàng đã nhận đơn và đang soạn, kiểm và đóng gói hàng.',
    customerCan: ['Yêu cầu huỷ đơn (cần cửa hàng duyệt)'],
  },
  {
    status: 'shipping',
    label: 'Đã bàn giao đơn vị vận chuyển',
    actor: 'carrier',
    description: 'Cửa hàng đã bàn giao kiện hàng cho đơn vị vận chuyển. Từ thời điểm này trách nhiệm vận chuyển thuộc bên thứ ba và đơn không còn huỷ được — nếu không muốn nhận, khách dùng đổi/trả sau khi nhận hàng.',
    customerCan: ['Theo dõi vận đơn'],
  },
  {
    status: 'delivered',
    label: 'Đơn vị vận chuyển báo đã giao',
    actor: 'carrier',
    description: `Bên thứ ba xác nhận đã giao hàng tới địa chỉ nhận. Khách có ${AUTO_CONFIRM_DAYS} ngày để kiểm hàng và bấm "Đã nhận hàng". Quá hạn, hệ thống tự chốt đơn hoàn tất.`,
    customerCan: ['Bấm "Đã nhận hàng" để xác nhận', 'Báo chưa nhận được hàng cho cửa hàng'],
    timerDays: AUTO_CONFIRM_DAYS,
  },
  {
    status: 'completed',
    label: 'Khách đã xác nhận nhận hàng',
    actor: 'customer',
    description: `Khách xác nhận đã nhận đúng hàng (hoặc hệ thống tự chốt sau ${AUTO_CONFIRM_DAYS} ngày). Đơn COD được ghi nhận đã thanh toán. Cửa sổ đổi/trả ${RETURN_WINDOW_DAYS} ngày bắt đầu tính từ mốc này.`,
    customerCan: ['Đánh giá sản phẩm', `Yêu cầu đổi/trả trong ${RETURN_WINDOW_DAYS} ngày`],
    timerDays: RETURN_WINDOW_DAYS,
  },
]);

const ORDER_TERMINAL_STAGES = Object.freeze([
  { status: 'cancelled', label: 'Đã huỷ', actor: 'shop', description: 'Đơn bị huỷ trước khi bàn giao vận chuyển. Tiền đã thanh toán trực tuyến được hoàn qua đúng cổng đã dùng.' },
  { status: 'returned', label: 'Đã trả hàng & hoàn tiền', actor: 'shop', description: 'Toàn bộ sản phẩm trong đơn đã được trả về và hoàn tiền xong.' },
]);

// Quy trình đổi/trả — có bước bên thứ ba (vận chuyển chiều về) tách riêng khỏi
// bước cửa hàng nhận, để không nhập nhằng "khách đã gửi" với "shop đã nhận".
const RETURN_STAGES = Object.freeze([
  {
    status: 'requested',
    label: 'Khách gửi yêu cầu',
    actor: 'customer',
    description: `Khách chọn từng sản phẩm cần trả, nêu lý do và đính kèm tối thiểu 1 ảnh thực tế. Chỉ áp dụng trong ${RETURN_WINDOW_DAYS} ngày kể từ khi đơn hoàn tất.`,
  },
  {
    status: 'approved',
    label: 'Cửa hàng duyệt yêu cầu',
    actor: 'shop',
    description: `Cửa hàng xem lý do và ảnh rồi duyệt hoặc từ chối. Khi được duyệt, khách có ${SHIP_BACK_DAYS} ngày để gửi hàng về.`,
    timerDays: SHIP_BACK_DAYS,
  },
  {
    status: 'shipped_back',
    label: 'Khách đã gửi hàng về',
    actor: 'customer',
    description: 'Khách gửi hàng qua đơn vị vận chuyển và nhập mã vận đơn chiều về. Mã vận đơn là bằng chứng bên thứ ba đã nhận kiện hàng.',
  },
  {
    status: 'received',
    label: 'Cửa hàng nhận & kiểm hàng đạt',
    actor: 'shop',
    description: `Cửa hàng nhận kiện hàng trả, kiểm tra tình trạng trong tối đa ${INSPECTION_DAYS} ngày làm việc. Hàng đúng điều kiện mới chuyển sang bước hoàn tiền.`,
    timerDays: INSPECTION_DAYS,
  },
  {
    status: 'refunded',
    label: 'Đã hoàn tiền',
    actor: 'gateway',
    description: `Tiền hoàn về đúng phương thức đã thanh toán. Stripe/VNPay xử lý trong khoảng ${REFUND_SETTLEMENT_DAYS} ngày làm việc; đơn thanh toán khi nhận hàng (COD) được cửa hàng chuyển khoản thủ công.`,
    timerDays: REFUND_SETTLEMENT_DAYS,
  },
]);

const RETURN_TERMINAL_STAGES = Object.freeze([
  { status: 'rejected', label: 'Bị từ chối', actor: 'shop', description: 'Yêu cầu không đủ điều kiện. Cửa hàng ghi rõ lý do; hàng (nếu đã gửi về) sẽ được gửi trả lại khách.' },
  { status: 'cancelled', label: 'Khách rút yêu cầu', actor: 'customer', description: 'Khách tự huỷ yêu cầu khi chưa được duyệt.' },
  { status: 'refund_failed', label: 'Hoàn tiền lỗi', actor: 'gateway', description: 'Cổng thanh toán từ chối lệnh hoàn. Cửa hàng sẽ hoàn thủ công và liên hệ lại với khách.' },
]);

const RETURN_CONDITIONS = Object.freeze([
  'Sản phẩm còn nguyên tem, nhãn, phụ kiện đi kèm và bao bì; chưa qua giặt, sửa hoặc làm bẩn.',
  'Có ảnh thực tế của sản phẩm/kiện hàng kèm theo yêu cầu để cửa hàng đối chiếu.',
  'Đồ lót, phụ kiện tóc và sản phẩm đặt may riêng chỉ đổi/trả khi có lỗi từ nhà sản xuất.',
  'Lỗi do nhà sản xuất hoặc giao sai/thiếu: cửa hàng chịu toàn bộ phí vận chuyển chiều về.',
  'Đổi ý, không còn nhu cầu, chọn nhầm size/màu: khách chịu phí vận chuyển chiều về.',
  'Trả một phần đơn: chỉ hoàn tiền hàng của đúng những món được trả, phí vận chuyển chỉ hoàn khi trả toàn bộ đơn.',
]);

const CANCEL_POLICY = Object.freeze({
  allowedStatuses: ['pending', 'pending_payment', 'confirmed'],
  description: 'Khách chỉ huỷ được khi đơn CHƯA bàn giao đơn vị vận chuyển. Yêu cầu luôn cần lý do và phải được cửa hàng duyệt. Đơn đã thanh toán trực tuyến sẽ được hoàn tiền qua đúng cổng đã dùng ngay khi huỷ được chấp nhận. Đơn đã bàn giao vận chuyển hoặc đã giao thì dùng đổi/trả thay cho huỷ.',
});

const FULFILLMENT_POLICY = Object.freeze({
  version: '2026-08-10',
  actors: ACTORS,
  timers: {
    autoConfirmDays: AUTO_CONFIRM_DAYS,
    returnWindowDays: RETURN_WINDOW_DAYS,
    shipBackDays: SHIP_BACK_DAYS,
    inspectionDays: INSPECTION_DAYS,
    refundSettlementDays: REFUND_SETTLEMENT_DAYS,
  },
  order: { stages: ORDER_STAGES, terminal: ORDER_TERMINAL_STAGES },
  return: { stages: RETURN_STAGES, terminal: RETURN_TERMINAL_STAGES, conditions: RETURN_CONDITIONS },
  cancel: CANCEL_POLICY,
});

// Trạng thái đơn hàng hợp lệ và bước kế tiếp mà cửa hàng được phép đẩy tới.
const ORDER_STATUS_FLOW = Object.freeze({
  pending_payment: ['pending', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'completed'],
  delivered: ['completed'],
  completed: ['returned'],
  cancelled: [],
  returned: [],
});

const PRE_SHIP_STATUSES = CANCEL_POLICY.allowedStatuses;
// Khách chỉ yêu cầu trả hàng được sau khi hàng đã thực sự tới tay.
const RETURNABLE_ORDER_STATUSES = ['delivered', 'completed'];

function returnWindowMs() {
  return RETURN_WINDOW_DAYS * 86400000;
}

// Mốc bắt đầu đếm hạn đổi/trả: ưu tiên lúc khách xác nhận, lùi dần về lúc đơn
// vị vận chuyển báo giao, cuối cùng mới tới ngày tạo đơn.
function returnWindowStartedAt(order) {
  return Number(
    order.completedAt
    || order.history?.find((entry) => entry.s === 'completed')?.at
    || order.deliveredAt
    || order.history?.find((entry) => entry.s === 'delivered')?.at
    || order.createdAt
    || 0,
  );
}

// Khách không bấm xác nhận thì đơn tự hoàn tất sau AUTO_CONFIRM_DAYS kể từ lúc
// đơn vị vận chuyển báo đã giao. Chạy idempotent mỗi lần state được đụng tới.
function autoCompleteDeliveredOrders(state, now = Date.now(), onComplete = null) {
  const completed = [];
  for (const order of state.orders || []) {
    if (order.status !== 'delivered') continue;
    const deliveredAt = Number(order.deliveredAt || order.history?.find((entry) => entry.s === 'delivered')?.at || 0);
    if (!deliveredAt || now - deliveredAt < AUTO_CONFIRM_DAYS * 86400000) continue;
    order.status = 'completed';
    order.completedAt = now;
    order.autoCompleted = true;
    order.history ||= [];
    order.history.push({ s: 'completed', at: now, note: `Tự động xác nhận sau ${AUTO_CONFIRM_DAYS} ngày` });
    if (order.payment?.method === 'COD' && order.payment.status !== 'paid') {
      order.payment.status = 'paid';
      order.payment.paidAt ||= now;
    }
    completed.push(order);
    if (onComplete) onComplete(order);
  }
  return completed;
}

module.exports = {
  FULFILLMENT_POLICY,
  ORDER_STATUS_FLOW,
  PRE_SHIP_STATUSES,
  RETURNABLE_ORDER_STATUSES,
  AUTO_CONFIRM_DAYS,
  RETURN_WINDOW_DAYS,
  SHIP_BACK_DAYS,
  returnWindowMs,
  returnWindowStartedAt,
  autoCompleteDeliveredOrders,
};
