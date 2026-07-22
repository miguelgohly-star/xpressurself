"use client";
import { useState, useRef } from "react";

interface Props {
  onVote: (stars: number) => void;
  disabled?: boolean;
  voted?: boolean;
  activeColor?: string;
  size?: number;
}

// Custom grunge-style star icon (public/star-icon.webp) used as a CSS mask —
// its own pixels are solid white on a transparent background, so masking a
// colored div with it works the same whether the browser treats the mask as
// alpha- or luminance-based, and we get the exact app accent red rather than
// fighting CSS filters to recolor a black-line-art PNG.
const maskStyle: React.CSSProperties = {
  WebkitMaskImage: "url(/star-icon.webp)",
  maskImage: "url(/star-icon.webp)",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
};

function HalfStar({ fill, size = 36, color = "#e21b1b" }: { fill: "empty" | "half" | "full"; size?: number; color?: string }) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* Black outline "halo" — same mask shape, scaled up slightly and
          rendered behind the white fill, so it peeks out around the edges
          as a stroke. mask-image has no native stroke/outline of its own. */}
      <div style={{ position: "absolute", inset: 0, background: "#000", transform: "scale(1.16)", ...maskStyle }} />
      <div style={{ position: "absolute", inset: 0, background: "#fff", ...maskStyle }} />
      {fill !== "empty" && (
        <div style={{
          position: "absolute", inset: 0,
          background: color,
          clipPath: fill === "half" ? "inset(0 50% 0 0)" : "inset(0 0 0 0)",
          ...maskStyle,
        }} />
      )}
    </div>
  );
}

export default function StarVote({ onVote, disabled, voted, activeColor, size = 36 }: Props) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const gap = Math.round(size / 4);

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
      <div style={{ display: "flex", gap }}>
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
            <HalfStar fill={fillFor(s)} color={activeColor} size={size} />
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
