"use client";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/* ── Shared top bar — same look as the landing page's own header,
   reused across every other page. Hidden (faded, non-interactive)
   during active gameplay via the `hidden` prop. ── */
export default function TopBar({ hidden = false }: { hidden?: boolean }) {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <header className="topbar" style={{
      opacity: hidden ? 0 : 1, pointerEvents: hidden ? "none" : "auto",
      transition: "opacity 0.4s ease",
    }}>
      <button onClick={() => router.push("/")} className="topbar__logo">xpressurself</button>
      <nav className="topbar__nav">
        <button onClick={() => router.push("/play")} className="topbar__navItem" aria-label="play song wars">
          <img src="/play-song-wars-keys.webp" alt=""/>
          <span>play song wars</span>
        </button>
        <button onClick={() => router.push(session ? "/wheels" : "/auth?callbackUrl=/wheels")} className="topbar__navItem" aria-label="your wheels">
          <img src="/wheels-cd-icon.webp" alt=""/>
          <span>your wheels</span>
        </button>
        {session && (
          <button onClick={() => router.push("/friends")} className="topbar__navItem" aria-label="friends & messages">
            <img src="/friends-cat-icon.webp" alt=""/>
            <span>friends &amp; messages</span>
          </button>
        )}
        <button onClick={() => router.push(session ? "/account" : "/auth")} className="topbar__navItem" aria-label={session ? "profile" : "sign in"}>
          <img
            src={session?.user?.image || "/profile-camcorder.webp"}
            alt=""
            className={session?.user?.image ? undefined : "topbar__navItem__profileImg"}
          />
          <span>{session ? "profile" : "sign in"}</span>
        </button>
      </nav>
    </header>
  );
}
