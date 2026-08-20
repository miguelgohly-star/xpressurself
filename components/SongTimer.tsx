"use client";
import { useEffect, useState, useRef } from "react";

// Counts down from `duration` seconds, anchored to `songStartedAt` (a
// server timestamp broadcast to every screen in the room) rather than a
// local mount time — so every device's countdown agrees with the others,
// and setInterval drift or tab-backgrounding on any one device doesn't
// skew when it actually fires. `songStartedAt` is null until the server
// decides the countdown may begin — in "everyone" screen mode that's only
// once every player's own video has reported ready (see the "video-ready"
// socket handler in server.ts), so nobody's timer can expire before their
// video has even started loading.
export default function SongTimer({
  duration, songStartedAt, onExpire,
}: { duration: number; songStartedAt: number | null; onExpire?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const calledRef = useRef(false);

  useEffect(() => {
    if (!songStartedAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [songStartedAt]);

  const remaining = songStartedAt
    ? Math.max(0, Math.ceil(duration - (now - songStartedAt) / 1000))
    : duration;

  useEffect(() => {
    if (songStartedAt && remaining <= 0 && !calledRef.current) {
      calledRef.current = true;
      onExpire?.();
    }
  }, [remaining, songStartedAt, onExpire]);

  if (!songStartedAt) {
    return (
      <p style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
        Waiting for everyone's video to load…
      </p>
    );
  }

  const pct = (remaining / duration) * 100;
  const urgent = remaining <= 5;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(30,26,20,0.1)", overflow: "hidden", width: 200 }}>
        <div style={{
          height: "100%", borderRadius: 2,
          width: `${pct}%`,
          background: urgent ? "var(--danger)" : "var(--cream)",
          transition: "width 0.25s linear, background 0.3s",
        }} />
      </div>
      <p style={{ fontSize: 12, color: urgent ? "var(--danger)" : "var(--text-secondary)", marginTop: 4 }}>
        {remaining}s remaining
      </p>
    </div>
  );
}
