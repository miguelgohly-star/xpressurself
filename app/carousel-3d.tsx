"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type Carousel3DItem = {
  id: string;
  label: string;
  image: string;
  href: string;
  // Positions a photo (e.g. a player's avatar) over a spot on `image`,
  // as percentages of the card's own box — measured from the source art.
  overlay?: { src: string; left: string; top: string; width: string; height: string };
};

/* ─── Carousel3D — a ring of cards in 3D space. It only turns when you
   press one of the two arrow buttons: each press steps exactly one
   card forward or back, with a smooth eased turn. No auto-rotate,
   no drag — the arrows are the only way to move it. ─── */
export default function Carousel3D({
  items,
  radius = 340,
  cardWidth = 240,
  cardHeight = 150,
}: {
  items: Carousel3DItem[];
  radius?: number;
  cardWidth?: number;
  cardHeight?: number;
}) {
  const router = useRouter();
  // `turn` counts steps taken and is never wrapped, so pressing an arrow
  // always keeps spinning further in that same direction — no snapping
  // back the other way once you're at the "last" or "first" card.
  const [turn, setTurn] = useState(0);
  const n = items.length;
  const angleStep = 360 / n;
  const index = ((turn % n) + n) % n;
  const stageRotation = -turn * angleStep;

  // Start assuming full desktop width (matches the server-rendered
  // markup so hydration doesn't mismatch), then correct to the real
  // viewport right after mount. The ring's geometry (radius drives a
  // translateZ in px) can't be shrunk with CSS alone, so on narrow
  // phone screens every dimension below is scaled down together —
  // otherwise the card stage is wider than the phone and gets clipped.
  const [viewportWidth, setViewportWidth] = useState(1200);
  // The site renders at html/body { zoom: 1.35 } (or 1 on phones — see
  // globals.css) — window.innerWidth is the real, unzoomed viewport,
  // while cardWidth/radius are authored px that get multiplied by
  // zoom on screen. Dividing by the live zoom converts the viewport
  // into that same authored space so the fit check is correct at
  // either zoom level, not just whichever one this was last tuned on.
  const [pageZoom, setPageZoom] = useState(1);
  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      setPageZoom(parseFloat(getComputedStyle(document.documentElement).zoom || "1") || 1);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const arrowsAndGaps = 38 * 2 + 18 * 2;
  const sidePadding = 48;
  const authoredViewport = viewportWidth / pageZoom;
  const availableWidth = Math.max(160, authoredViewport - arrowsAndGaps - sidePadding);
  const naturalStageWidth = cardWidth + radius * 0.9;
  const scale = Math.min(1, availableWidth / naturalStageWidth);
  const scaledCardWidth = cardWidth * scale;
  const scaledCardHeight = cardHeight * scale;
  const scaledRadius = radius * scale;

  const step = (dir: 1 | -1) => setTurn(t => t + dir);

  const goTo = (i: number) => {
    // Jump to card i by the shortest path, so a direct click doesn't
    // spin all the way around the ring.
    let delta = i - index;
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;
    setTurn(t => t + delta);
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 18,
        width: "100%", maxWidth: scaledCardWidth + scaledRadius * 1.6,
      }}>
        <button onClick={() => step(-1)} aria-label="previous" className="carousel3d-arrow">‹</button>

        <div style={{
          // Rotating around Y never changes a card's vertical extent, so
          // this only needs headroom for shadow/glow bleed — not the
          // radius-scaled buffer the width needs for the horizontal swing.
          flex: "0 0 auto", width: scaledCardWidth + scaledRadius * 0.9, height: scaledCardHeight + 70,
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
          perspective: 1400,
        }}>
          <div style={{
            transformStyle: "preserve-3d", position: "relative",
            width: scaledCardWidth, height: scaledCardHeight,
            transform: `rotateY(${stageRotation}deg)`,
            transition: "transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)",
          }}>
            {items.map((item, i) => (
              <div
                key={item.id}
                style={{
                  position: "absolute", inset: 0, transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                  transform: `rotateY(${i * angleStep}deg) translateZ(${scaledRadius}px)`,
                }}
              >
                <button
                  onClick={() => (i === index ? router.push(item.href) : goTo(i))}
                  className={`carousel3d-card${i === index ? " carousel3d-card--active" : ""}`}
                  style={{ width: scaledCardWidth, height: scaledCardHeight }}
                >
                  <div className="carousel3d-card__clip">
                    <img src={item.image} alt={item.label} className="carousel3d-card__img"/>
                    {item.overlay && (
                      <img
                        src={item.overlay.src}
                        alt=""
                        className="carousel3d-card__overlay"
                        style={{
                          left: item.overlay.left, top: item.overlay.top,
                          width: item.overlay.width, height: item.overlay.height,
                        }}
                      />
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => step(1)} aria-label="next" className="carousel3d-arrow">›</button>
      </div>

      <style>{`
        .carousel3d-arrow{
          flex:0 0 auto; width:38px; height:38px; border-radius:50%; border:none; cursor:pointer;
          background:#fbfaf7; color:var(--text-dark); font-size:18px; line-height:1;
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 1px 0 rgba(255,255,255,0.9) inset,0 2px 4px rgba(30,26,20,0.12),0 8px 18px rgba(30,26,20,0.18);
          transition:transform 0.15s ease, box-shadow 0.15s ease;
        }
        .carousel3d-arrow:hover{ transform:scale(1.08); box-shadow:0 1px 0 rgba(255,255,255,0.9) inset,0 2px 4px rgba(30,26,20,0.14),0 10px 22px rgba(30,26,20,0.24); }
        .carousel3d-arrow:active{ transform:scale(0.94); }
        .carousel3d-card{
          width:100%;height:100%;padding:0;border:none;cursor:pointer;
          background:#fbfaf7;border-radius:14px;position:relative;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 1px 0 rgba(255,255,255,0.9) inset,0 2px 4px rgba(30,26,20,0.12),0 18px 34px rgba(30,26,20,0.22);
          transition:box-shadow 0.25s ease, opacity 0.4s ease;
          opacity:0.55;
        }
        .carousel3d-card--active{ opacity:1; cursor:pointer; }
        .carousel3d-card:hover{ box-shadow:0 1px 0 rgba(255,255,255,0.9) inset,0 2px 4px rgba(30,26,20,0.14),0 22px 40px rgba(30,26,20,0.28); }
        .carousel3d-card__clip{ position:absolute; inset:0; border-radius:inherit; overflow:hidden; }
        .carousel3d-card__img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; pointer-events:none; }
        .carousel3d-card__overlay{ position:absolute; object-fit:cover; pointer-events:none; }
      `}</style>
    </div>
  );
}
