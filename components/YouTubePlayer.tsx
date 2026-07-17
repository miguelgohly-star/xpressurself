"use client";
import { useEffect, useRef } from "react";

interface Props {
  youtubeUrl: string;
  startTime?: number;
  onReady?: () => void;
}

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function YouTubePlayer({ youtubeUrl, startTime = 0, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const videoId = extractVideoId(youtubeUrl);

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
        playerVars: { autoplay: 1, controls: 1, rel: 0, start },
        events: {
          onReady: (e: any) => {
            if (start > 0) e.target.seekTo(start, true);
            e.target.playVideo();
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
  }, [videoId, startTime]);

  if (!videoId) {
    return (
      <div className="glass p-6 text-center" style={{ color: "var(--text-faint)" }}>
        Invalid YouTube URL
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
      {/* TV outer shell — warm dark wood/bakelite */}
      <div style={{
        background: "linear-gradient(160deg, #1a1714 0%, #0c0a08 55%, #141210 100%)",
        borderRadius: 4,
        padding: "24px 28px 32px",
        boxShadow:
          "0 0 0 1px rgba(242,236,227,0.06), 0 0 0 2px #07060504, 0 40px 120px rgba(0,0,0,0.97), inset 0 1px 0 rgba(242,236,227,0.04)",
        position: "relative",
      }}>
        {/* Top brand area */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
          gap: 16,
        }}>
          <div style={{ height: 1, flex: 1, background: "rgba(242,236,227,0.06)" }} />
          <span style={{
            fontFamily: "'Yellowtail', cursive",
            fontSize: 17,
            color: "rgba(226,27,27,0.55)",
            textShadow: "0 0 8px rgba(226,27,27,0.25)",
            letterSpacing: "0.04em",
          }}>
            xpressurself
          </span>
          <div style={{ height: 1, flex: 1, background: "rgba(242,236,227,0.06)" }} />
        </div>

        {/* Screen bezel */}
        <div style={{
          background: "#050402",
          borderRadius: 2,
          padding: 4,
          boxShadow:
            "inset 0 0 0 1px rgba(242,236,227,0.04), inset 0 0 40px rgba(0,0,0,0.9)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* The actual video */}
          <div style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/9",
            borderRadius: 1,
            overflow: "hidden",
          }}>
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
          </div>
        </div>

        {/* TV base controls row */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
          marginTop: 18,
        }}>
          {/* Power LED — brand red glow */}
          <div style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "rgba(226,60,60,0.85)",
            boxShadow: "0 0 6px 2px rgba(226,27,27,0.4)",
            animation: "pulse-led 3s ease-in-out infinite",
          }} />
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "rgba(242,236,227,0.08)",
              border: "1px solid rgba(242,236,227,0.04)",
            }} />
          ))}
          <div style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #231e1a, #0e0b09)",
            border: "1px solid rgba(242,236,227,0.07)",
            boxShadow: "inset 0 1px 0 rgba(242,236,227,0.04)",
          }} />
        </div>

        {/* Bottom vent lines */}
        <div style={{ display: "flex", gap: 5, marginTop: 12, justifyContent: "center" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              width: 18,
              height: 1,
              background: "rgba(242,236,227,0.04)",
              borderRadius: 1,
            }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse-led {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
