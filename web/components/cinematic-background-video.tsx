"use client";

import { useEffect, useRef } from "react";

export type CinematicVideoState = "loading" | "ready" | "fallback";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

type CinematicBackgroundVideoProps = {
  className: string;
  poster: string;
  src: string;
  onStateChange?: (state: CinematicVideoState) => void;
};

export function CinematicBackgroundVideo({ className, poster, src, onStateChange }: CinematicBackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const navigatorHints = navigator as NavigatorWithConnection;
    let visible = false;
    let state: CinematicVideoState = "loading";

    const report = (nextState: CinematicVideoState) => {
      if (state === nextState) return;
      state = nextState;
      video.dataset.videoStatus = nextState;
      onStateChange?.(nextState);
    };
    const shouldUsePoster = () => motionQuery.matches || Boolean(navigatorHints.connection?.saveData);
    const syncPlayback = () => {
      if (shouldUsePoster() || !visible || document.hidden) {
        video.pause();
        if (shouldUsePoster()) report("fallback");
        return;
      }
      void video.play().then(() => report("ready")).catch(() => report("fallback"));
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    }, { rootMargin: "160px", threshold: 0.01 });
    const onVisibilityChange = () => syncPlayback();
    const onMotionChange = () => syncPlayback();
    const onError = () => report("fallback");

    observer.observe(video);
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);
    video.addEventListener("error", onError);
    syncPlayback();

    return () => {
      video.pause();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      video.removeEventListener("error", onError);
    };
  }, [onStateChange]);

  return <video
    ref={videoRef}
    className={className}
    data-video-status="loading"
    poster={poster}
    src={src}
    muted
    loop
    playsInline
    preload="metadata"
    tabIndex={-1}
    aria-hidden="true"
  />;
}
