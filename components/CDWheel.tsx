"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  spinning: boolean;
  category: string | null;
  categories: string[];
}

export default function CDWheel({ spinning, category, categories }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const shimmerRef = useRef(0);
  const spinRef = useRef(false);
  const speedRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [displayCategory, setDisplayCategory] = useState<string | null>(null);

  useEffect(() => {
    if (spinning) {
      spinRef.current = true;
      setDisplayCategory(null);
    } else if (category) {
      spinRef.current = false;
      setDisplayCategory(category);
    }
  }, [spinning, category]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const S = canvas.width;
    const cx = S / 2, cy = S / 2;
    const r = S * 0.46;
    const inner = S * 0.085;

    const draw = () => {
      ctx.clearRect(0, 0, S, S);

      const a = shimmerRef.current;

      // ── Base disc gradient (frosted paper/sage/lavender) ──
      const stops: [number, string][] = [
        [0,    "rgba(30,26,20,0.55)"],
        [0.15, "rgba(247,243,234,0.88)"],
        [0.24, "rgba(228,222,206,0.78)"],
        [0.33, "rgba(140,162,130,0.4)"],
        [0.42, "rgba(216,221,208,0.7)"],
        [0.52, "rgba(175,165,205,0.4)"],
        [0.63, "rgba(221,216,232,0.68)"],
        [0.74, "rgba(232,228,240,0.6)"],
        [0.85, "rgba(247,243,234,0.82)"],
        [1,    "rgba(30,26,20,0.5)"],
      ];

      const gx1 = cx + Math.cos(a) * r, gy1 = cy + Math.sin(a) * r;
      const gx2 = cx + Math.cos(a + Math.PI) * r, gy2 = cy + Math.sin(a + Math.PI) * r;
      const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
      stops.forEach(([p, c]) => grad.addColorStop(p, c));

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // ── Orthogonal shimmer pass ──
      const b = a + Math.PI / 2;
      const grad2 = ctx.createLinearGradient(
        cx + Math.cos(b) * r, cy + Math.sin(b) * r,
        cx + Math.cos(b + Math.PI) * r, cy + Math.sin(b + Math.PI) * r
      );
      grad2.addColorStop(0,   "rgba(255,248,236,0)");
      grad2.addColorStop(0.38,"rgba(255,248,236,0.10)");
      grad2.addColorStop(0.5, "rgba(255,248,236,0.22)");
      grad2.addColorStop(0.62,"rgba(255,248,236,0.10)");
      grad2.addColorStop(1,   "rgba(255,248,236,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad2;
      ctx.fill();

      // ── Data track rings ──
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 0.5;
      for (let ri = inner + 6; ri < r - 2; ri += 3) {
        ctx.beginPath();
        ctx.arc(cx, cy, ri, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Category segment dividers + text ──
      if (categories.length > 0) {
        const segAngle = (Math.PI * 2) / categories.length;

        // Divider lines
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angleRef.current);
        ctx.strokeStyle = "rgba(30,26,20,0.28)";
        ctx.lineWidth = 0.8;
        for (let i = 0; i < categories.length; i++) {
          ctx.beginPath();
          ctx.moveTo(inner + 4, 0);
          ctx.lineTo(r - 4, 0);
          ctx.stroke();
          ctx.rotate(segAngle);
        }
        ctx.restore();

        // Category labels
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angleRef.current);
        categories.forEach((cat, i) => {
          const midAngle = i * segAngle + segAngle / 2;
          ctx.save();
          ctx.rotate(midAngle);
          ctx.translate(r * 0.58, 0);
          ctx.rotate(Math.PI / 2);
          const fs = Math.max(7, Math.min(11, 200 / categories.length));
          ctx.font = `300 ${fs}px 'Cormorant Garamond', serif`;
          ctx.fillStyle = "rgba(30,26,20,0.6)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const label = cat.length > 13 ? cat.slice(0, 12) + "…" : cat;
          ctx.fillText(label, 0, 0);
          ctx.restore();
        });
        ctx.restore();
      }

      // ── Centre hub ──
      const hub = ctx.createRadialGradient(cx, cy, 0, cx, cy, inner);
      hub.addColorStop(0, "#1c1814");
      hub.addColorStop(0.55, "#100d0a");
      hub.addColorStop(1, "#1c1814");
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx.fillStyle = hub;
      ctx.fill();

      // Hub ring — thin cream line
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(242,236,227,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Centre hole
      ctx.beginPath();
      ctx.arc(cx, cy, S * 0.024, 0, Math.PI * 2);
      ctx.fillStyle = "#07060504";
      ctx.fill();

      // ── Outer edge ──
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(30,26,20,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── Pointer triangle (brand red — the signature spin moment) ──
      ctx.save();
      ctx.fillStyle = "#e21b1b";
      ctx.shadowColor = "rgba(226,27,27,0.6)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(cx, 6);
      ctx.lineTo(cx - 7, 20);
      ctx.lineTo(cx + 7, 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const animate = () => {
      const target = spinRef.current ? 0.055 : 0;
      speedRef.current += (target - speedRef.current) * 0.04;
      angleRef.current += speedRef.current;
      shimmerRef.current += 0.007; // always shimmer slowly
      draw();
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [categories]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div className="animate-float">
        <canvas
          ref={canvasRef}
          width={380}
          height={380}
          style={{
            borderRadius: "50%",
            filter: "drop-shadow(0 0 40px rgba(200,180,150,0.18)) drop-shadow(0 8px 30px rgba(0,0,0,0.7))",
          }}
        />
      </div>

      {displayCategory && (
        <div className="glass animate-fade-in" style={{ padding: "14px 32px", textAlign: "center" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 8, fontFamily: "'Cormorant Garamond', serif" }}>
            Category
          </p>
          <p style={{
            fontSize: 26,
            fontFamily: "'Pinyon Script', cursive",
            color: "var(--cream)",
            textShadow: "0 0 30px rgba(242,236,227,0.2)",
          }}>
            {displayCategory}
          </p>
        </div>
      )}

      {spinning && (
        <p style={{ color: "var(--text-faint)", fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif" }}>
          Spinning…
        </p>
      )}
    </div>
  );
}
