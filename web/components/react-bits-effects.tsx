"use client";

import { type HTMLAttributes, type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";

type FadeContentProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section";
  blur?: boolean;
  children: ReactNode;
  delay?: number;
  duration?: number;
  offset?: number;
  threshold?: number;
};

/**
 * Adapted from React Bits' FadeContent. Uses the platform animation API so the
 * storefront does not need another runtime dependency, and stays visible when
 * JavaScript or IntersectionObserver is unavailable.
 */
export function ReactBitsFadeContent({
  as: Tag = "div",
  blur = true,
  children,
  className = "",
  delay = 0,
  duration = 720,
  offset = 18,
  threshold = 0.12,
  ...props
}: FadeContentProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      element.dataset.fadeState = "visible";
      return;
    }

    element.dataset.fadeState = "pending";
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      element.dataset.fadeState = "visible";
      const animation = element.animate([
        { opacity: 0, filter: blur ? "blur(10px)" : "blur(0)", transform: `translate3d(0, ${offset}px, 0)` },
        { opacity: 1, filter: "blur(0)", transform: "translate3d(0, 0, 0)" },
      ], { duration, delay, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
      animation.finished.finally(() => {
        element.style.removeProperty("will-change");
      }).catch(() => undefined);
    }, { threshold });
    element.style.willChange = "opacity, filter, transform";
    observer.observe(element);
    return () => observer.disconnect();
  }, [blur, delay, duration, offset, threshold]);

  return <Tag ref={ref as never} className={`react-bits-fade-content ${className}`.trim()} {...props}>{children}</Tag>;
}

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  spotlightColor?: string;
};

/** Adapted from React Bits' SpotlightCard; applied only to non-critical trust cards. */
export function ReactBitsSpotlightCard({ children, className = "", spotlightColor = "rgba(196, 53, 48, 0.14)", ...props }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || event.pointerType === "touch") return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    element.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
    element.style.setProperty("--spotlight-color", spotlightColor);
  };

  return <div ref={ref} className={`react-bits-spotlight ${className}`.trim()} onPointerMove={onPointerMove} {...props}>{children}</div>;
}
