"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";

interface Props {
  youtubeUrl: string;
  startTime?: number;
  onReady?: () => void;
  autoplay?: boolean; // defaults to device-based detection — see isMobileDevice()
  bare?: boolean; // skip the built-in TV background art — just the video + CRT overlays, sized to fill the parent
  frame?: "tv" | "ipad"; // which built-in frame art to use when bare is false — see FRAMES below
}

// Two frame variants, each measured from its own source artwork by
// pixel-scanning for the screen area's bounding box:
//
// "tv" (public/tv-border-alpha-v2.webp, 1483x1061) — the screen cutout is a
// real transparent hole in the frame, so the frame can sit ON TOP of the
// video with its edges genuinely overlapping/covering the video's edges.
//
// "ipad" (public/tv-border-ipad-v3.webp, 1347x1020) — derived from the original
// upload (public/tv border.webp, 1448x1086), which had a fully opaque white
// canvas and loose ink-splatter/bird artwork surrounding the device, plus a
// baked-in checkerboard (not real transparency) standing in for the screen.
// Processed with sharp: cropped to the device's actual bounding box (found
// by scanning for sustained runs of dark pixels, since the splatter marks
// are scattered widely enough that a naive first-non-white-pixel scan picks
// up stray dots instead of the real edge) at content-box coords (50,30) in
// the original image, then given a real alpha channel via a whiteness ramp
// (transparent above luminance 246, opaque below 216) — this cleans up the
// rounded-corner slivers left by the rectangular crop along with the rest
// of the margin. The measured screen rectangle itself is additionally
// forced to alpha 0 unconditionally (the checkerboard's light-gray squares
// didn't cross the whiteness ramp on their own, leaving a faint residual
// checker pattern under the video otherwise). Still rendered video-ON-TOP
// rather than through the hole, just to keep both frame variants' layering
// consistent — not a functional requirement at this point.
//
// The art also had a baked-in fake lock screen above the video area — an
// "iPad" label plus a static "20:01 / Thursday, January 1, 2016". Those
// glyphs were clone-stamped out with sharp (composited over with real
// background pixels sampled from clear parts of the same gradient bands,
// avoiding the icons and the screen's right edge) so IpadStatusOverlay
// below can render a live label/clock in their place instead. Renamed
// v2 -> v3 on that edit (rather than overwriting the v2 file in place)
// so browsers/CDNs already caching the old bytes at the old URL are
// forced to fetch the patched image instead of serving stale iPad/2016
// text out of cache underneath the live overlay.
const FRAMES = {
  tv: {
    src: "/tv-border-alpha-v2.webp",
    aspectRatio: "1483/1061",
    screen: { left: 20.77, top: 16.97, width: 59.95, height: 56.93 },
    videoOnTop: false,
  },
  ipad: {
    src: "/tv-border-ipad-v3.webp",
    aspectRatio: "1347/1020",
    // width/height nudged slightly past the measured screen bounds (88.05%
    // / 59.71%) per a real-render check — the video sat about a pixel short
    // of the frame's screen edge on the bottom and right.
    screen: { left: 6.01, top: 22.25, width: 88.35, height: 60.01 },
    videoOnTop: true,
  },
} as const;

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Fills the blank spot the "ipad" frame's clone-stamped lock screen left
// behind — a live label plus each player's own local clock, instead of the
// frozen "iPad" / "20:01, Thursday, January 1, 2016" that used to be baked
// into the art. Positions are percentages of the 1347x1020 source image,
// matching where that original baked-in text sat. Font size rides on the
// frame wrapper's own container-query width (see containerType below) so
// it scales with the frame at any render size instead of the viewport.
// `Date.now()` as the snapshot (not `new Date()`) — useSyncExternalStore
// compares snapshots with Object.is, and two fresh Date objects are never
// equal even at the same millisecond, which would trip its "getSnapshot
// should be cached" infinite-loop guard. A number compares fine.
function subscribeToClock(callback: () => void) {
  const id = setInterval(callback, 30_000);
  return () => clearInterval(id);
}
const getClockSnapshot = () => Date.now();
// No real clock on the server — render nothing until mounted rather than
// guess, so there's no wrong-timezone flash and nothing to hydrate-mismatch.
const getServerClockSnapshot = () => null;

function IpadStatusOverlay() {
  const nowMs = useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);
  if (nowMs === null) return null;

  const now = new Date(nowMs);
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const textShadow = "0 1px 2px rgba(0,0,0,0.5)";

  return (
    <>
      <div style={{
        position: "absolute", left: "5.9%", top: "8.1%", transform: "translateY(-50%)",
        fontFamily: "var(--font-ui)", fontWeight: 600, color: "#f2f2f2", textShadow,
        fontSize: "clamp(8px, 2.1cqw, 15px)", letterSpacing: "0.01em", whiteSpace: "nowrap",
        zIndex: 6, pointerEvents: "none",
      }}>xpressurself</div>
      <div style={{
        position: "absolute", left: "49.3%", top: "13.8%", transform: "translate(-50%, -50%)",
        fontFamily: "var(--font-ui)", fontWeight: 300, color: "#fff", textShadow,
        fontSize: "clamp(16px, 6.2cqw, 46px)", letterSpacing: "0.01em", whiteSpace: "nowrap",
        zIndex: 6, pointerEvents: "none",
      }}>{time}</div>
      <div style={{
        position: "absolute", left: "49.4%", top: "18.7%", transform: "translate(-50%, -50%)",
        fontFamily: "var(--font-ui)", fontWeight: 400, color: "rgba(255,255,255,0.88)", textShadow,
        fontSize: "clamp(9px, 3cqw, 20px)", letterSpacing: "0.01em", whiteSpace: "nowrap",
        zIndex: 6, pointerEvents: "none",
      }}>{date}</div>
    </>
  );
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

export default function YouTubePlayer({ youtubeUrl, startTime = 0, onReady, autoplay, bare = false, frame = "tv" }: Props) {
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

  const { src, aspectRatio, screen: SCREEN, videoOnTop } = FRAMES[frame];

  return (
    <div style={{
      width: "100%", maxWidth: 720, margin: "0 auto", position: "relative", aspectRatio,
      // Lets IpadStatusOverlay's text size ride on this box's own rendered
      // width (cqw) instead of the viewport's, so it scales correctly
      // however small the parent squeezes the frame down to.
      containerType: "inline-size",
    } as React.CSSProperties}>
      {/* Frame artwork — on top (z-index 5) when it has a real transparent
          hole the video shows through ("tv"); behind (z-index 1, same layer
          as the screen box below) when it doesn't ("ipad"), since there's
          nothing to see through otherwise. */}
      <img
        src={src}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: videoOnTop ? 1 : 5, pointerEvents: "none" }}
      />

      {frame === "ipad" && <IpadStatusOverlay />}

      {/* Screen area — filled by the video */}
      <div style={{
        position: "absolute",
        left: `${SCREEN.left}%`, top: `${SCREEN.top}%`,
        width: `${SCREEN.width}%`, height: `${SCREEN.height}%`,
        background: "#050402",
        overflow: "hidden",
        zIndex: videoOnTop ? 5 : 1,
      }}>
        {/* True 16:9 video, letterboxed/centered within the (slightly taller) cutout */}
        <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", aspectRatio: "16/9", transform: "translateY(-50%)" }}>
          {videoWithOverlays}
        </div>
      </div>
    </div>
  );
}
