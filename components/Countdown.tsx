"use client";
import { useEffect, useState } from "react";

interface Props {
  deadline: number | null;
  onExpire?: () => void;
}

export default function Countdown({ deadline, onExpire }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) { setRemaining(null); return; }
    const tick = () => {
      const diff = Math.max(0, deadline - Date.now());
      setRemaining(diff);
      if (diff === 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  if (remaining === null) return null;

  const totalSecs = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const isUrgent = totalSecs <= 30;

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 14px",
      borderRadius: 0,
      background: isUrgent ? "var(--danger-soft)" : "transparent",
      border: `1px solid ${isUrgent ? "var(--danger)" : "var(--glass-border2)"}`,
      color: isUrgent ? "var(--danger)" : "var(--cream-dim)",
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 300,
      fontSize: 18,
      letterSpacing: "0.15em",
      fontStyle: "italic",
    }}>
      {mins}:{secs.toString().padStart(2, "0")}
    </div>
  );
}
