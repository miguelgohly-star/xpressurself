"use client";
import { useState, useRef } from "react";

interface Props {
  onVote: (stars: number) => void;
  disabled?: boolean;
  voted?: boolean;
}

function HalfStar({ fill }: { fill: "empty" | "half" | "full" }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`g-${fill}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="50%" stopColor={fill === "empty" ? "rgba(30,26,20,0.18)" : "#e21b1b"} />
          <stop offset="50%" stopColor={fill === "full" ? "#e21b1b" : "rgba(30,26,20,0.18)"} />
        </linearGradient>
      </defs>
      <text
        x="18" y="28"
        textAnchor="middle"
        fontSize="30"
        fill={`url(#g-${fill})`}
        style={{ userSelect: "none" }}
      >★</text>
    </svg>
  );
}

export default function StarVote({ onVote, disabled, voted }: Props) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  const getValue = (starIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return x < rect.width / 2 ? starIndex - 0.5 : starIndex;
  };

  const active = hovered || selected;

  const fillFor = (i: number): "empty" | "half" | "full" => {
    if (active >= i) return "full";
    if (active >= i - 0.5) return "half";
    return "empty";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            onMouseMove={(e) => { if (!voted && !disabled) setHovered(getValue(s, e)); }}
            onMouseLeave={() => setHovered(0)}
            onClick={(e) => {
              if (disabled || voted) return;
              const v = getValue(s, e);
              setSelected(v);
              onVote(v);
            }}
            style={{
              cursor: voted || disabled ? "default" : "pointer",
              opacity: disabled ? 0.4 : 1,
              transition: "transform 0.1s",
              transform: (hovered === s || hovered === s - 0.5) ? "scale(1.2)" : "scale(1)",
            }}
          >
            <HalfStar fill={fillFor(s)} />
          </div>
        ))}
      </div>

      {!voted && !disabled && active > 0 && (
        <p style={{ color: "var(--cream)", fontSize: 13, fontWeight: 600 }}>
          {active} star{active !== 1 ? "s" : ""}
        </p>
      )}
      {voted && (
        <p style={{ color: "var(--cream)", fontSize: 13, letterSpacing: "0.08em" }}>
          Vote cast ✓
        </p>
      )}
      {!voted && !disabled && active === 0 && (
        <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>
          Rate this song while it plays
        </p>
      )}
    </div>
  );
}
