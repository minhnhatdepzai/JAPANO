export const formatCurrency = (value: number) => new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
}).format(Number(value || 0));

export const formatDate = (value: number | string | Date) => new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
}).format(new Date(value));

export function productImage(product: { image?: string; images?: string[] }) {
  return mediaUrl(product.images?.find(Boolean) || product.image || "/assets/brand/japano-logo-transparent.png");
}

export function productHoverImage(product: { image?: string; images?: string[] }) {
  return product.images?.[1] ? mediaUrl(product.images[1]) : productImage(product);
}

const WIKIMEDIA_PREFIX = "https://upload.wikimedia.org/";

export function mediaUrl(value: string) {
  if (!value) return "/media/assets/brand/japano-logo-transparent.png";
  // Ảnh địa điểm Nhật đến từ Wikimedia. Nhúng thẳng thì trình duyệt nhận cookie
  // bên thứ ba (WMF-Uniq) và ta không kiểm soát được cache. Đi qua BFF
  // same-origin: host đích được ghi cứng trong route nên không mở SSRF, và
  // attribution vẫn hiển thị nguyên vẹn ở trang địa điểm.
  if (value.startsWith(WIKIMEDIA_PREFIX)) return `/media/wikimedia/${value.slice(WIKIMEDIA_PREFIX.length)}`;
  if (/^(?:data:|blob:|https?:\/\/)/.test(value)) return value;
  return `/media${value.startsWith("/") ? value : `/${value}`}`;
}

/**
 * Cloudinary phục vụ đúng định dạng và mức nén tốt nhất cho từng trình duyệt khi
 * URL mang `f_auto,q_auto`. Nếu chỉ đặt trong srcset mà bỏ quên `src` thì trình
 * duyệt không hỗ trợ srcset — và Lighthouse — vẫn tải bản gốc nặng.
 */
export function cloudinaryUrl(url: string, width = 1200) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width},c_limit/`);
}

export function cloudinarySrcSet(url: string) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return undefined;
  return [360, 560, 840, 1200]
    .map((width) => `${url.replace("/upload/", `/upload/f_auto,q_auto,w_${width},c_limit/`)} ${width}w`)
    .join(", ");
}
