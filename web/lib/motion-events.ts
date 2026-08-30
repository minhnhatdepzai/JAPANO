export const CART_MOTION_EVENT = "japano:cart-motion";
export const ORDER_SUCCESS_EVENT = "japano:order-success";

export type CartMotionDetail = {
  label: string;
  imageUrl: string;
  from: { left: number; top: number; width: number; height: number };
};

type OrderSuccessDetail = {
  orderId?: string;
  done: () => void;
};

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Yêu cầu lớp cinematic bay ảnh sản phẩm tới giỏ. Hàm trả về khoảng chờ trước
 * khi mở drawer; khi thiết bị giảm chuyển động hoặc source không khả dụng thì
 * mở ngay, không làm luồng mua hàng phụ thuộc animation.
 */
export function requestCartMotion(source: HTMLImageElement | null | undefined, label: string, imageUrl: string) {
  if (typeof document === "undefined" || !source || reducedMotion()) return 0;
  const rect = source.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return 0;
  document.dispatchEvent(new CustomEvent<CartMotionDetail>(CART_MOTION_EVENT, {
    detail: {
      label,
      imageUrl: source.currentSrc || source.src || imageUrl,
      from: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    },
  }));
  return 460;
}

/** Chỉ gọi sau khi backend đã tạo đơn COD thật. */
export function playOrderSuccess(orderId?: string) {
  if (typeof document === "undefined" || reducedMotion() || document.documentElement.dataset.cinematicMotion !== "ready") {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      resolve();
    };
    const fallback = window.setTimeout(finish, 2_200);
    document.dispatchEvent(new CustomEvent<OrderSuccessDetail>(ORDER_SUCCESS_EVENT, {
      detail: { orderId, done: finish },
    }));
  });
}

