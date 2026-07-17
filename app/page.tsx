"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Carousel3D from "./carousel-3d";

/* ══════════════════════════════════════════════════
   LANDING PAGE — one full-bleed scene, one call to action
══════════════════════════════════════════════════ */
export default function LandingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 550);
    return () => clearTimeout(t);
  }, []);

  // This page's own content decides its height — override the global
  // html/body min-height:100vh (other pages rely on it) so there's no
  // stray empty space once the hero is shorter than a full viewport.
  useEffect(() => {
    const { documentElement: html, body } = document;
    const prevHtml = html.style.minHeight;
    const prevBody = body.style.minHeight;
    html.style.minHeight = "0";
    body.style.minHeight = "0";
    return () => {
      html.style.minHeight = prevHtml;
      body.style.minHeight = prevBody;
    };
  }, []);

  return (
    <>
      {/* ── Loader — dips to ink before the scene reveals itself ── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 90, background: "var(--text-dark)",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: loaded ? 0 : 1, pointerEvents: loaded ? "none" : "auto",
        transition: "opacity 0.7s ease 0.1s",
      }}>
        <span style={{
          fontFamily: "var(--font-display)", fontSize: "2.6rem", color: "#fbfaf7",
          opacity: 0.88, animation: "loaderPulse 1.6s ease-in-out infinite",
        }}>xpressurself</span>
      </div>

      {/* ── Top bar — slim fixed header, logo left, nav right ── */}
      <header className="topbar" style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.8s ease 0.5s" }}>
        <span className="topbar__logo">xpressurself</span>
        <nav className="topbar__nav">
          <button onClick={() => router.push("/play")} className="topbar__navItem">
            <img src="/play-song-wars-keys.png" alt=""/>
            <span>play song wars</span>
          </button>
          <button onClick={() => router.push(session ? "/wheels" : "/auth?callbackUrl=/wheels")} className="topbar__navItem">
            <img src="/wheels-cd-icon.png" alt=""/>
            <span>your wheels</span>
          </button>
          {session && (
            <button onClick={() => router.push("/friends")} className="topbar__navItem">
              <img src="/friends-cat-icon.png" alt=""/>
              <span>friends &amp; messages</span>
            </button>
          )}
          <button onClick={() => router.push(session ? "/account" : "/auth")} className="topbar__navItem">
            <img
              src={session?.user?.image || "/profile-camcorder.png"}
              alt=""
              className={session?.user?.image ? undefined : "topbar__navItem__profileImg"}
            />
            <span>{session ? "profile" : "sign in"}</span>
          </button>
        </nav>
      </header>

      {/* ── Background ── */}
      <img src="/grunge-city-collage.webp" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none", objectFit: "cover", objectPosition: "center",
      }}/>

      {/* ── Stage — wordmark up top, the carousel is the one job of this page ── */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
        gap: 36, padding: "88px 24px 60px", textAlign: "center",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <h1 style={{
            fontFamily: "'Yellowtail', cursive",
            fontSize: "clamp(3.4rem, 11vw, 6.4rem)", margin: 0, lineHeight: 1,
            color: "#e21b1b",
            textShadow: "0 0 14px rgba(226,27,27,0.45), 0 0 2px rgba(255,255,255,0.8)",
            opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 1s ease 0.25s, transform 1s ease 0.25s",
          }}>xpressurself</h1>
        </div>

        {/* ── The carousel — turn it with the arrows, then jump straight in ── */}
        <div style={{ opacity: loaded ? 1 : 0, transition: "opacity 1s ease 0.55s" }}>
          <Carousel3D items={[
            { id: "play",    label: "Play Song Wars",     image: "/play-song-wars-keys.png", href: "/play" },
            { id: "wheels",  label: "Your Wheels",        image: "/wheels-cd-icon.png",   href: session ? "/wheels" : "/auth?callbackUrl=/wheels" },
            ...(session ? [{ id: "friends", label: "Friends & Messages", image: "/friends-cat-icon.png", href: "/friends" }] : []),
            {
              id: "profile", label: session ? "Your Profile" : "Sign In",
              image: "/profile-camcorder.png", href: session ? "/account" : "/auth",
              overlay: session?.user?.image ? {
                // Measured from the source art, then adjusted for the vertical
                // crop object-fit:cover applies at the card's 240x150 ratio.
                src: session.user.image,
                left: "25.1%", top: "13.6%", width: "48.5%", height: "44.1%",
              } : undefined,
            },
          ]}/>
        </div>
      </div>

      <style>{`
        @keyframes loaderPulse{0%,100%{opacity:0.55}50%{opacity:1}}
        .topbar{
          position:fixed;top:0;left:0;right:0;z-index:85;
          display:flex;align-items:center;justify-content:center;gap:64px;
          padding:16px 28px;background:rgb(255,255,255);
          border-bottom:1px solid rgba(255,255,255,0.9);
          box-shadow:0 0 28px rgba(255,255,255,0.85), 0 1px 0 rgba(255,255,255,1);
        }
        .topbar__logo{
          font-family:'Yellowtail', cursive;font-size:1.7rem;color:#e21b1b;
          text-shadow:0 0 10px rgba(226,27,27,0.4), 0 0 2px rgba(255,255,255,0.85);
          letter-spacing:0.01em;user-select:none;
        }
        .topbar__nav{display:flex;align-items:center;justify-content:center;gap:10px;}
        .topbar__navItem{
          background:none;border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:9px;
          padding:6px 14px;border-radius:999px;
          transition:background 0.18s ease;
        }
        .topbar__navItem:hover{background:rgba(30,26,20,0.06);}
        .topbar__navItem img{
          width:30px;height:30px;border-radius:50%;object-fit:cover;
          box-shadow:0 0 0 1px rgba(30,26,20,0.1);
        }
        .topbar__navItem__profileImg{object-position:18% 30%;}
        .topbar__navItem span{
          font-family:var(--font-ui);font-size:12px;letter-spacing:0.03em;
          color:var(--text-dark);white-space:nowrap;
        }
      `}</style>
    </>
  );
}
