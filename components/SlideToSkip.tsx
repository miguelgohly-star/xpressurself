"use client";
import { useEffect, useRef, useState } from "react";

const FIRE_THRESHOLD = 0.82;
const THUMB_SIZE = 44;
const TRACK_PADDING = 4;
const TRACK_HEIGHT = 56;

// A literal slide-to-confirm control, styled after the classic iOS
// "slide to unlock". There's deliberately no onClick anywhere in here —
// `percent` only ever advances from real pointer movement during an active
// drag (see onPointerMove), so a plain tap registers as ~0% and can never
// cross FIRE_THRESHOLD. Releasing short of the threshold springs the thumb
// back to the start instead of confirming.
export default function SlideToSkip({
  label, onConfirm, disabled = false,
}: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startPercentRef = useRef(0);
  // Mirrors `percent` but is readable synchronously (state updates aren't
  // guaranteed to have landed by the time a pointerup handler runs) — used
  // so finishDrag can decide whether to fire without reaching into a
  // setState updater callback, which React's Strict Mode double-invokes in
  // dev and would call onConfirm() twice per drag.
  const percentRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [percent, setPercent] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // Measure synchronously right away — ResizeObserver's own first callback
    // is async (fires around the next paint), which would otherwise leave a
    // brief (or, on a tab that never actually paints, permanent) window
    // where trackWidth is still 0 and dragging can't register at all.
    setTrackWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setTrackWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // How far the thumb's center can actually travel inside the track, once
  // its own size and the track's inner padding are subtracted.
  const travel = Math.max(0, trackWidth - THUMB_SIZE - TRACK_PADDING * 2);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || travel <= 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    startXRef.current = e.clientX;
    startPercentRef.current = percentRef.current;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    const next = Math.min(1, Math.max(0, startPercentRef.current + dx / travel));
    percentRef.current = next;
    setPercent(next);
  };

  const finishDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const reached = percentRef.current >= FIRE_THRESHOLD;
    percentRef.current = reached ? 1 : 0;
    setPercent(percentRef.current);
    if (reached) onConfirm();
  };

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative", width: "100%", maxWidth: 400, height: TRACK_HEIGHT,
        borderRadius: 999,
        background: "linear-gradient(180deg, rgba(30,26,20,0.94) 0%, rgba(18,15,11,0.94) 100%)",
        border: "1.5px solid rgba(255,255,255,0.08)",
        boxShadow: "0 2px 0 rgba(255,255,255,0.05) inset, 0 10px 26px rgba(0,0,0,0.28)",
        overflow: "hidden",
        opacity: disabled ? 0.5 : 1,
        touchAction: "none",
      }}
    >
      {/* filled trail behind the thumb, grows only as the thumb actually moves */}
      <div style={{
        position: "absolute", inset: 0,
        width: `${TRACK_PADDING + THUMB_SIZE + percent * travel}px`,
        background: "linear-gradient(90deg, rgba(200,30,30,0.4), rgba(226,27,27,0.6))",
        transition: dragging ? "none" : "width 0.3s ease",
      }} />

      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.5)",
        opacity: Math.max(0, 1 - percent * 1.8),
        pointerEvents: "none", userSelect: "none",
      }}>
        {label}
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent * 100)}
        style={{
          position: "absolute", top: TRACK_PADDING, left: TRACK_PADDING,
          width: THUMB_SIZE, height: TRACK_HEIGHT - TRACK_PADDING * 2,
          borderRadius: "50%",
          background: "linear-gradient(180deg, #fff 0%, #ece7e0 100%)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, color: "var(--cream)",
          cursor: disabled ? "default" : dragging ? "grabbing" : "grab",
          transform: `translateX(${percent * travel}px)`,
          transition: dragging ? "none" : "transform 0.3s ease",
          touchAction: "none",
        }}
      >
        ›
      </div>
    </div>
  );
}
