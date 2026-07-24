// Bus thông báo toàn cục: mọi nơi (context, màn hình) gọi toast.show(...) được.
export type ToastType = 'success' | 'info' | 'wishlist' | 'cart' | 'error';

export type ToastInput = {
  title: string;
  message?: string;
  type?: ToastType;
  icon?: string;
  duration?: number;
};

type Listener = (t: ToastInput & { id: number }) => void;

let counter = 0;
const listeners = new Set<Listener>();

export const toast = {
  show(input: ToastInput) {
    counter += 1;
    const payload = { id: counter, type: 'success' as ToastType, duration: 2600, ...input };
    listeners.forEach((fn) => {
      try { fn(payload); } catch {}
    });
    return payload.id;
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Tiện ích nhanh
export const toastCart = (name: string) => toast.show({ type: 'cart', icon: 'shopping-bag', title: 'Đã thêm vào giỏ', message: name });
export const toastWishlistOn = (name: string) => toast.show({ type: 'wishlist', icon: 'heart', title: 'Đã thêm vào yêu thích', message: name });
export const toastWishlistOff = (name: string) => toast.show({ type: 'info', icon: 'heart', title: 'Đã bỏ yêu thích', message: name });
export const toastSuccess = (title: string, message?: string) => toast.show({ type: 'success', icon: 'check-circle', title, message });
export const toastError = (title: string, message?: string) => toast.show({ type: 'error', icon: 'alert-triangle', title, message, duration: 3200 });
