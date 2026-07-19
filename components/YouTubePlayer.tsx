"use client";
import { useEffect, useRef } from "react";

interface Props {
  youtubeUrl: string;
  startTime?: number;
  onReady?: () => void;
  autoplay?: boolean; // defaults to device-based detection — see isMobileDevice()
  bare?: boolean; // skip the built-in TV background art — just the video + CRT overlays, sized to fill the parent
}

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Mobile browsers block unmuted autoplay of embedded iframes outright — no
// playerVars or JS-driven play() call can override that. Desktop browsers
// are far more permissive. Rather than disabling autoplay everywhere, only
// skip it on devices where it would silently fail anyway.
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function YouTubePlayer({ youtubeUrl, startTime = 0, onReady, autoplay, bare = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const videoId = extractVideoId(youtubeUrl);
  const shouldAutoplay = autoplay ?? !isMobileDevice();

  useEffect(() => {
    if (!videoId || !containerRef.current) return;
    const start = Math.floor(startTime ?? 0);

    const initPlayer = () => {
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
      const container = containerRef.current;
      if (!container) return;
      const div = document.createElement("div");
      container.innerHTML = "";
      container.appendChild(div);
      playerRef.current = new window.YT.Player(div, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: shouldAutoplay ? 1 : 0, controls: 1, rel: 0, start },
        events: {
          onReady: (e: any) => {
            if (start > 0) e.target.seekTo(start, true);
            if (shouldAutoplay) e.target.playVideo();
            onReady?.();
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [videoId, startTime, shouldAutoplay]);

  if (!videoId) {
    return (
      <div className="glass p-6 text-center" style={{ color: "var(--text-faint)" }}>
        Invalid YouTube URL
      </div>
    );
  }

  const videoWithOverlays = (
    <>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Scanlines overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.14) 2px, rgba(0,0,0,0.14) 4px)",
        pointerEvents: "none",
        zIndex: 2,
      }} />

      {/* Warm vignette */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at center, transparent 55%, rgba(8,6,4,0.65) 100%)",
        pointerEvents: "none",
        zIndex: 3,
      }} />

      {/* Subtle warm top glare */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: "25%",
        background: "linear-gradient(180deg, rgba(242,236,227,0.025) 0%, transparent 100%)",
        pointerEvents: "none",
        zIndex: 4,
      }} />
    </>
  );

  // Caller (e.g. a full-screen background layout) supplies its own art and
  // positioning — we just fill whatever box we're given with the video and
  // the CRT-style overlays.
  if (bare) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {videoWithOverlays}
      </div>
    );
  }

  // Measured from the source artwork (public/tv-border-alpha.webp, 1483x1061):
  // the screen cutout is a real transparent hole in the frame (found by
  // flood-filling the enclosed near-white region and taking its bounding
  // box), so the frame can sit ON TOP of the video and its edges genuinely
  // overlap/cover the video's edges, instead of the video having to be
  // layered over a flat painted-on rectangle.
  const SCREEN = { left: 20.77, top: 16.97, width: 59.95, height: 56.93 };

  return (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", position: "relative", aspectRatio: "1483/1061" }}>
      {/* Screen cutout — sits behind the frame, filled by the video */}
      <div style={{
        position: "absolute",
        left: `${SCREEN.left}%`, top: `${SCREEN.top}%`,
        width: `${SCREEN.width}%`, height: `${SCREEN.height}%`,
        background: "#050402",
        overflow: "hidden",
        zIndex: 1,
      }}>
        {/* True 16:9 video, letterboxed/centered within the (slightly taller) cutout */}
        <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", aspectRatio: "16/9", transform: "translateY(-50%)" }}>
          {videoWithOverlays}
        </div>
      </div>

      {/* Frame artwork on top — transparent screen hole lets the video show through */}
      <img
        src="/tv-border-alpha.webp"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 5, pointerEvents: "none" }}
      />
    </div>
  );
}
