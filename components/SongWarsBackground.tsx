"use client";

// Full-bleed Song Wars backdrop, used identically across /play, /room, and
// /player. Swaps to a portrait-composed image below 700px viewport width —
// object-fit:cover on the single wide (2.1:1) image alone crops away almost
// everything but a thin vertical center strip on a phone, so the portrait
// variant keeps its own detail near the top/bottom edges instead of relying
// on corners that would never be visible there. <picture> picks the source
// natively (no JS, no hydration flicker); the <img>'s own position:fixed
// styling works exactly the same wrapped in <picture> as it did bare.
export default function SongWarsBackground({ zIndex = -1 }: { zIndex?: number }) {
  return (
    <picture>
      <source media="(max-width: 700px)" srcSet="/background-song-wars-portrait.webp" />
      <img src="/background-song-wars.webp" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex, pointerEvents: "none", objectFit: "cover", objectPosition: "center",
      }} />
    </picture>
  );
}
