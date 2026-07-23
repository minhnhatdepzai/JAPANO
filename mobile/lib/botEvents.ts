export type BotCartItem = {
  slug: string;
  color: string;
  size: string;
  qty: number;
};

export type BotEvent =
  | { type: 'cart_removed'; item: BotCartItem }
  | { type: 'checkout_failed'; reason: string; paymentMethod?: 'cod' | 'card' }
  | { type: 'open_bot'; message?: string };

type Listener = (event: BotEvent) => void;
const listeners = new Set<Listener>();

export function emitBotEvent(event: BotEvent) {
  listeners.forEach(listener => listener(event));
}

export function subscribeBotEvents(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
