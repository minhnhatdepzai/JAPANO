"use client";

import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import {
  CART_MOTION_EVENT,
  ORDER_SUCCESS_EVENT,
  type CartMotionDetail,
} from "@/lib/motion-events";

type OrderSuccessDetail = { orderId?: string; done: () => void };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CinematicMotion() {
  const pathname = usePathname();
  const firstPath = useRef(true);
  const routeRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const routeOverlay = routeRef.current;
    const successOverlay = successRef.current;
    document.documentElement.dataset.cinematicMotion = "ready";

    const onPointerDown = (event: PointerEvent) => {
      if (prefersReducedMotion() || event.button !== 0) return;
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("a[href], button");
      if (!target || target.matches(":disabled") || target.closest("[data-no-ink-click]")) return;
      const ink = document.createElement("span");
      ink.className = "cinematic-click-ink";
      ink.setAttribute("aria-hidden", "true");
      document.body.appendChild(ink);
      gsap.fromTo(ink,
        { x: event.clientX, y: event.clientY, scale: 0.25, opacity: 0.34 },
        { scale: 5.8, opacity: 0, duration: 0.48, ease: "power3.out", onComplete: () => ink.remove() },
      );
    };

    const onCartMotion = (event: Event) => {
      if (prefersReducedMotion()) return;
      const detail = (event as CustomEvent<CartMotionDetail>).detail;
      const target = document.querySelector<HTMLElement>("[data-cart-target]");
      if (!detail || !target) return;
      const to = target.getBoundingClientRect();
      const image = document.createElement("img");
      image.className = "cinematic-cart-flight";
      image.src = detail.imageUrl;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      document.body.appendChild(image);

      const width = Math.min(detail.from.width, 150);
      const height = width * 1.25;
      const startLeft = detail.from.left + (detail.from.width - width) / 2;
      const startTop = detail.from.top + (detail.from.height - height) / 2;
      const destinationX = to.left + to.width / 2 - startLeft - width / 2;
      const destinationY = to.top + to.height / 2 - startTop - height / 2;

      gsap.set(image, { left: startLeft, top: startTop, width, height });
      gsap.timeline({ onComplete: () => image.remove() })
        .to(image, { scale: 1.04, rotation: -2, duration: 0.1, ease: "power1.out" })
        .to(image, {
          x: destinationX,
          y: destinationY,
          scale: 0.12,
          rotation: 10,
          opacity: 0.28,
          duration: 0.42,
          ease: "power3.inOut",
        })
        .fromTo(target, { scale: 1 }, { scale: 1.22, duration: 0.13, yoyo: true, repeat: 1, ease: "power2.out" }, "-=0.13");

      const announcer = document.getElementById("store-announcer");
      if (announcer) announcer.textContent = `${detail.label} đã được thêm vào giỏ hàng.`;
    };

    const onOrderSuccess = (event: Event) => {
      const detail = (event as CustomEvent<OrderSuccessDetail>).detail;
      const overlay = successRef.current;
      if (!detail || !overlay || prefersReducedMotion()) {
        detail?.done();
        return;
      }
      const seal = overlay.querySelector(".order-success-seal");
      const copy = overlay.querySelector(".order-success-copy");
      const orderCode = overlay.querySelector<HTMLElement>(".order-success-code");
      if (orderCode) orderCode.textContent = detail.orderId ? `Mã đơn ${detail.orderId}` : "Đơn hàng đã được ghi nhận";

      gsap.timeline({ onComplete: detail.done })
        .set(overlay, { autoAlpha: 1, pointerEvents: "auto" })
        .fromTo(overlay, { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(150% at 50% 50%)", duration: 0.46, ease: "power3.inOut" })
        .fromTo(seal, { scale: 0.45, rotation: -16 }, { scale: 1, rotation: 0, duration: 0.38, ease: "back.out(1.6)" }, "-=0.14")
        .fromTo(copy, { y: 18 }, { y: 0, duration: 0.32, ease: "power3.out" }, "-=0.24")
        .to(overlay, { autoAlpha: 0, pointerEvents: "none", duration: 0.3, delay: 0.56, ease: "power2.in" });
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener(CART_MOTION_EVENT, onCartMotion);
    document.addEventListener(ORDER_SUCCESS_EVENT, onOrderSuccess);
    return () => {
      delete document.documentElement.dataset.cinematicMotion;
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener(CART_MOTION_EVENT, onCartMotion);
      document.removeEventListener(ORDER_SUCCESS_EVENT, onOrderSuccess);
      gsap.killTweensOf([routeOverlay, successOverlay]);
      document.querySelectorAll(".cinematic-click-ink,.cinematic-cart-flight").forEach((element) => element.remove());
    };
  }, []);

  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    const overlay = routeRef.current;
    if (!overlay || prefersReducedMotion()) return;
    const main = document.getElementById("main-content");
    const timeline = gsap.timeline();
    timeline
      .set(overlay, { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" })
      .to(overlay, { clipPath: "inset(0 0% 0 0)", duration: 0.2, ease: "power3.inOut" })
      .fromTo(main, { y: 9 }, { y: 0, duration: 0.34, ease: "power3.out" }, "-=0.03")
      .to(overlay, { clipPath: "inset(0 0 0 100%)", duration: 0.28, ease: "power3.inOut" }, "-=0.22")
      .set(overlay, { autoAlpha: 0 });
    return () => { timeline.kill(); };
  }, [pathname]);

  return <>
    <div ref={routeRef} className="cinematic-route-brush" aria-hidden="true">
      <span className="route-brush-mark">間</span><span className="route-brush-line" />
    </div>
    <div ref={successRef} className="order-success-overlay" role="status" aria-live="polite" aria-atomic="true">
      <div className="order-success-seal"><span>済</span></div>
      <div className="order-success-copy"><span>注文完了 · HOÀN TẤT</span><h2>Đơn hàng đã được đặt.</h2><p className="order-success-code">Đơn hàng đã được ghi nhận</p></div>
    </div>
  </>;
}
