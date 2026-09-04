"use client";

import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson } from "@/lib/client-api";

type StylistAction = {
  id: "open_shop"|"open_checkout"|"open_cart"|"open_wishlist"|"open_orders"|"open_explore_japan"|"open_tryon"|"open_product";
  label: string;
  auto: boolean;
  productId?: string;
};
type Message = { role: "user" | "assistant"; text: string; actions?: StylistAction[] };

export function AiStylist() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "Chào bạn, Ori có thể tìm sản phẩm, phối đồ và giải thích size từ dữ liệu thật của JAPANO." }]);

  const runAction = (action: StylistAction) => {
    const routes: Record<StylistAction["id"], string> = {
      open_shop: "/san-pham",
      open_checkout: "/thanh-toan",
      open_cart: "/gio-hang",
      open_wishlist: "/yeu-thich",
      open_orders: "/tai-khoan/don-hang",
      open_explore_japan: "/du-lich-nhat-ban",
      open_tryon: action.productId ? `/thu-do?productId=${encodeURIComponent(action.productId)}` : "/thu-do",
      open_product: action.productId ? `/san-pham/${encodeURIComponent(action.productId)}` : "/san-pham",
    };
    setOpen(false);
    router.push(routes[action.id]);
  };

  useEffect(() => {
    if (!open) return;
    void postJson("/api/stylist/chat/warmup", {}, 35_000).catch(() => undefined);
  }, [open]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setLoading(true);
    try {
      const response = await postJson<{ message?: string; reply?: string; actions?: StylistAction[] }>("/api/stylist/chat", { userId: "guest-web", message, history: messages.map((item) => ({ role: item.role, content: item.text })) }, 60_000);
      const actions = Array.isArray(response.actions) ? response.actions : [];
      setMessages((current) => [...current, { role: "assistant", text: response.message || response.reply || "Ori chưa tìm thấy câu trả lời phù hợp.", actions }]);
      const automatic = actions.find((action) => action.auto);
      if (automatic) setTimeout(() => runAction(automatic), 280);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "Chưa kết nối được Ori. Hãy thử lại." }]);
    } finally {
      setLoading(false);
    }
  };

  return <div className="stylist-root" style={{ viewTransitionName: "stylist-popover" }}>
    <AnimatePresence>{open && <motion.section className="stylist-panel" role="dialog" aria-modal="false" aria-labelledby="stylist-title" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
      <header><div><span className="eyebrow"><Sparkles aria-hidden="true" /> AI Stylist</span><h2 id="stylist-title">Hỏi Ori</h2></div><button className="icon-button" aria-label="Đóng trợ lý Ori" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></header>
      <div className="stylist-messages" aria-live="polite">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`message ${message.role}`}><span>{message.text}</span>{!!message.actions?.length && <div className="stylist-actions">{message.actions.filter((action) => !action.auto).map((action) => <button key={`${action.id}-${action.productId || ""}`} type="button" onClick={() => runAction(action)}>{action.label}</button>)}</div>}</div>)}{loading && <div className="message assistant loading-dots">Ori đang tìm trong catalog<span>•••</span></div>}</div>
      <form onSubmit={send}><label className="sr-only" htmlFor="ori-message">Câu hỏi cho Ori</label><input id="ori-message" name="message" autoComplete="off" placeholder="Ví dụ: phối áo haori đi Đà Lạt…" value={input} onChange={(event) => setInput(event.target.value)} /><button aria-label="Gửi câu hỏi" disabled={loading || !input.trim()}><Send aria-hidden="true" /></button></form>
    </motion.section>}</AnimatePresence>
    <button className="stylist-toggle" aria-label={open ? "Hỏi Ori — đóng trợ lý thời trang" : "Hỏi Ori — mở trợ lý thời trang"} aria-expanded={open} onClick={() => setOpen((value) => !value)}><MessageCircle aria-hidden="true" /><span>Hỏi Ori</span></button>
  </div>;
}
