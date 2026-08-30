"use client";

import { useCallback, useRef } from "react";
import { CinematicBackgroundVideo, type CinematicVideoState } from "@/components/cinematic-background-video";

export function HeroThreeScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const updateState = useCallback((state: CinematicVideoState) => {
    if (hostRef.current) hostRef.current.dataset.threeStatus = state;
  }, []);

  return <div ref={hostRef} className="hero-three" data-three-status="loading" aria-hidden="true">
    <img
      className="sakura-video-poster"
      src="/media/cinematic/sakura-petal-rain.webp"
      alt=""
      width="960"
      height="540"
      decoding="async"
    />
    <CinematicBackgroundVideo
      className="sakura-scene-video"
      src="/media/cinematic/sakura-petal-rain.mp4"
      poster="/media/cinematic/sakura-petal-rain.webp"
      onStateChange={updateState}
    />
    <span className="cinematic-scene-shade" />
    <span className="sakura-scene-mark">桜</span>
    <span className="scene-footage-label">SAKURA · PETAL RAIN</span>
  </div>;
}
