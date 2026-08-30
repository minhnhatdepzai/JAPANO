"use client";

import { useCallback, useRef } from "react";
import { CinematicBackgroundVideo, type CinematicVideoState } from "@/components/cinematic-background-video";

export function FujiCinematic() {
  const hostRef = useRef<HTMLDivElement>(null);
  const updateState = useCallback((state: CinematicVideoState) => {
    if (hostRef.current) hostRef.current.dataset.fujiStatus = state;
  }, []);

  return <div ref={hostRef} className="fuji-cinematic" data-fuji-status="loading" aria-hidden="true">
    <img
      className="fuji-video-poster"
      src="/media/cinematic/fuji-birds-lake.webp"
      alt=""
      width="1280"
      height="720"
      loading="lazy"
      decoding="async"
    />
    <CinematicBackgroundVideo
      className="fuji-scene-video"
      src="/media/cinematic/fuji-birds-lake.mp4"
      poster="/media/cinematic/fuji-birds-lake.webp"
      onStateChange={updateState}
    />
    <span className="fuji-vertical-type">富 士 の 風</span>
    <span className="fuji-caption">FUJI · LAKE KAWAGUCHI · 35.3606° N</span>
    <span className="fuji-film-grain" />
  </div>;
}
