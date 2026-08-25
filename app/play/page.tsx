"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { getSocket } from "@/lib/socket";
import TopBar from "@/components/TopBar";

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--text-secondary)",
  letterSpacing: "0.25em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 10,
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
};

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [hostName, setHostName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [tab, setTab] = useState<"host" | "join">("host");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-fill name from session (nickname if set, else username)
  useEffect(() => {
    if (session?.user) {
      const displayName = session.user.name || (session.user as any).username || "";
      if (displayName && !hostName) setHostName(displayName);
      if (displayName && !joinName) setJoinName(displayName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const code = searchParams.get("join");
    if (code) {
      setJoinCode(code.toUpperCase());
      setTab("join");
    }
  }, [searchParams]);

  // Lock this page in place — no scrolling.
  useEffect(() => {
    const { documentElement: html, body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const handleHost = () => {
    if (!hostName.trim()) return setError("Enter your name");
    setLoading(true);
    const s = getSocket();
    s.emit("create-room", { hostName: hostName.trim(), avatarUrl: session?.user?.image ?? null });
    s.once("room-created", (room: any) => {
      sessionStorage.setItem("playerId", s.id!);
      sessionStorage.setItem("playerName", hostName.trim());
      router.push(`/room/${room.code}`);
    });
  };

  const handleJoin = () => {
    if (!joinName.trim()) return setError("Enter your name");
    if (!joinCode.trim()) return setError("Enter room code");
    setLoading(true);
    const s = getSocket();
    s.emit("join-room", { code: joinCode.trim().toUpperCase(), playerName: joinName.trim(), avatarUrl: session?.user?.image ?? null });
    s.once("joined", (room: any) => {
      sessionStorage.setItem("playerId", s.id!);
      sessionStorage.setItem("playerName", joinName.trim());
      router.push(`/player/${room.code}`);
    });
    s.once("error", (e: any) => {
      setError(e.message);
      setLoading(false);
    });
  };

  return (
    <>
      <img src="/background-song-wars.webp" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none", objectFit: "cover", objectPosition: "center",
      }}/>

      <div className="page" style={{ padding: "88px 24px 20px", justifyContent: "flex-start", position: "relative", zIndex: 1 }}>
      <TopBar />
      {/* Header */}
      <div className="text-center animate-fade-in">
        <h1 style={{
          fontFamily: "'Pinyon Script', cursive",
          fontSize: "clamp(4.5rem, 12vw, 8rem)",
          color: "var(--text-dark)",
          lineHeight: 0.9,
          marginBottom: 24,
        }}>
          song wars
        </h1>
        <div className="rule" />
      </div>

      {/* Card */}
      <div className="glass w-full" style={{ maxWidth: 380, padding: "40px 36px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", marginBottom: 40, borderBottom: "1px solid rgba(242,236,227,0.08)" }}>
          {(["host", "join"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1,
                padding: "10px 0",
                border: "none",
                borderBottom: tab === t ? "1px solid rgba(242,236,227,0.5)" : "1px solid transparent",
                marginBottom: -1,
                background: "transparent",
                color: tab === t ? "var(--cream)" : "var(--text-secondary)",
                fontWeight: 300,
                cursor: "pointer",
                transition: "all 0.4s",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontSize: 10,
                fontFamily: "'Cormorant Garamond', serif",
              }}
            >
              {t === "host" ? "Host" : "Join"}
            </button>
          ))}
        </div>

        {tab === "host" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div>
              <label style={labelStyle}>Your Name</label>
              <input
                value={hostName}
                onChange={(e) => { setHostName(e.target.value); setError(""); }}
                placeholder="enter your name"
                onKeyDown={(e) => e.key === "Enter" && handleHost()}
                maxLength={20}
                disabled={!!session?.user}
                style={session?.user ? { opacity: 0.6 } : undefined}
              />
              {session?.user && (
                <p style={{ fontSize: 10, color: "var(--text-faint)", fontStyle: "italic", marginTop: 6 }}>
                  Signed in as {hostName} — sign out to play under a different name
                </p>
              )}
            </div>
            <button className="btn-glow" onClick={handleHost} disabled={loading} style={{ width: "100%", marginTop: 8 }}>
              {loading ? "Creating…" : "Create Room"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div>
              <label style={labelStyle}>Your Name</label>
              <input
                value={joinName}
                onChange={(e) => { setJoinName(e.target.value); setError(""); }}
                placeholder="enter your name"
                maxLength={20}
                disabled={!!session?.user}
                style={session?.user ? { opacity: 0.6 } : undefined}
              />
              {session?.user && (
                <p style={{ fontSize: 10, color: "var(--text-faint)", fontStyle: "italic", marginTop: 6 }}>
                  Signed in as {joinName} — sign out to play under a different name
                </p>
              )}
            </div>
            <div>
              <label style={labelStyle}>Room Code</label>
              <input
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
                placeholder="AB3XY"
                maxLength={5}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                style={{ textTransform: "uppercase", letterSpacing: "0.3em" }}
              />
            </div>
            <button className="btn-glow" onClick={handleJoin} disabled={loading} style={{ width: "100%", marginTop: 8 }}>
              {loading ? "Joining…" : "Join Room"}
            </button>
          </div>
        )}

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 20, textAlign: "center", fontStyle: "italic", letterSpacing: "0.05em" }}>{error}</p>
        )}
      </div>

      {/* Footer */}
      <p style={{ color: "var(--text-faint)", fontSize: 10, marginTop: 40, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontVariantNumeric: "lining-nums" }}>
        2–8 players · YouTube · Star voting
      </p>
      </div>
    </>
  );
}
