"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SongSearch from "@/components/SongSearch";
import Countdown from "@/components/Countdown";
import VotingScreen from "@/components/VotingScreen";
import type { Room } from "@/lib/gameState";
import { avgVotes } from "@/lib/gameState";
import { getSocket } from "@/lib/socket";
import TopBar from "@/components/TopBar";
import PlayerAvatar from "@/components/PlayerAvatar";

function PlayerCountdown() {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (n <= 0) return;
    const t = setTimeout(() => setN((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div style={{
      fontSize: 96, fontWeight: 900, lineHeight: 1,
      color: "#e21b1b",
      textShadow: "0 0 40px rgba(226,27,27,0.35)",
    }}>
      {n > 0 ? n : "GO!"}
    </div>
  );
}

// Every phase of this page shares the same shell — same backdrop as /play
// and the host's room view (for visual consistency across every screen a
// player might be looking at), same TopBar, same centered "page" layout.
// `hideTopBar` is only used during active gameplay, to cut clutter while
// watching the video.
function PlayerPageShell({ children, hideTopBar = false }: { children: React.ReactNode; hideTopBar?: boolean }) {
  return (
    <div className="page" style={{ justifyContent: "flex-start", paddingTop: "clamp(90px, 8vh, 150px)" }}>
      <img src="/background-song-wars.webp" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: -1, pointerEvents: "none", objectFit: "cover", objectPosition: "center",
      }}/>
      <TopBar hidden={hideTopBar} />
      {children}
    </div>
  );
}

export default function PlayerView() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [room, setRoom] = useState<Room | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [votedSongs, setVotedSongs] = useState<Set<number>>(new Set());
  const [startTimeInput, setStartTimeInput] = useState("");
  const [error, setError] = useState("");
  const [kicked, setKicked] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const s = useRef(getSocket());
  const myId = s.current.id;

  useEffect(() => {
    const sock = s.current;
    sock.on("room-updated", (r: Room) => {
      setRoom(r);
      if (r.phase === "lobby" || r.phase === "spinning") {
        setSubmitted(false);
        setYoutubeUrl("");
        setSongTitle("");
        setVotedSongs(new Set());
      }
    });
    sock.on("joined", (r: Room) => setRoom(r));
    sock.on("submit-error", ({ message }: { message: string }) => {
      setError(message);
      setSubmitted(false);
    });
    sock.on("kicked", () => {
      setKicked(true);
      setTimeout(() => router.push("/play"), 2500);
    });
    // The only thing that emits "error" to this page is a failed reconnect
    // join (the room no longer exists server-side — e.g. after a server
    // restart, since game state is in-memory only). Without this, the page
    // just keeps showing whatever stale room data it last had.
    sock.on("error", () => {
      setSessionEnded(true);
      setTimeout(() => router.push("/play"), 3000);
    });

    // Re-emit join-room (not just get-room) on every connect — a dropped
    // connection reconnects with a brand-new socket id, and only join-room
    // reclaims this player's existing slot server-side (see joinRoom's
    // reclaim-by-name logic). Using .on instead of .once means this also
    // fires on later reconnects, not just the first connection.
    const requestRoom = () => {
      const storedName = sessionStorage.getItem("playerName");
      if (storedName) {
        sock.emit("join-room", { code, playerName: storedName, avatarUrl: session?.user?.image ?? null });
      } else {
        sock.emit("get-room", { code });
      }
    };
    if (sock.connected) {
      requestRoom();
    }
    sock.on("connect", requestRoom);

    return () => {
      sock.off("room-updated");
      sock.off("joined");
      sock.off("submit-error");
      sock.off("kicked");
      sock.off("error");
      sock.off("connect", requestRoom);
    };
  }, [code, router, session?.user?.image]);

  const parseStartTime = (val: string): number => {
    const parts = val.trim().split(":").map(Number);
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    if (parts.length === 1) return parts[0] ?? 0;
    return 0;
  };

  const submitSong = () => {
    if (!youtubeUrl.trim()) return setError("Paste a YouTube link");
    if (!songTitle.trim()) return setError("Add a song title");
    if (!youtubeUrl.includes("youtu")) return setError("Must be a YouTube link");
    const startTime = startTimeInput ? parseStartTime(startTimeInput) : 0;
    s.current.emit("submit-song", { code, youtubeUrl: youtubeUrl.trim(), title: songTitle.trim(), startTime });
    setSubmitted(true);
    setError("");
  };

  const castVote = (songIndex: number, stars: number) => {
    s.current.emit("cast-vote", { code, songIndex, stars });
    setVotedSongs((prev) => new Set([...prev, songIndex]));
  };

  if (kicked) {
    return (
      <PlayerPageShell>
        <div className="glass p-8 text-center" style={{ maxWidth: 360, width: "100%" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>👋</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Removed from the room</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            The host removed you from this room. Taking you back…
          </p>
        </div>
      </PlayerPageShell>
    );
  }

  if (sessionEnded) {
    return (
      <PlayerPageShell>
        <div className="glass p-8 text-center" style={{ maxWidth: 360, width: "100%" }}>
          <p style={{ fontSize: 15, marginBottom: 8 }}>This game session has ended.</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Taking you back to start a new one…</p>
        </div>
      </PlayerPageShell>
    );
  }

  if (!room) {
    return (
      <PlayerPageShell>
        <div className="glass p-8 text-center">
          <p style={{ color: "var(--text-secondary)" }}>Connecting…</p>
        </div>
      </PlayerPageShell>
    );
  }

  const currentSong = room.submissions[room.currentSongIndex];
  const isMyOwnSong = currentSong?.playerId === myId;
  const alreadyVoted = votedSongs.has(room.currentSongIndex);

  // LOBBY
  if (room.phase === "lobby") {
    return (
      <PlayerPageShell>
        <div className="glass p-8 text-center" style={{ maxWidth: 360, width: "100%" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎵</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>You're in!</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
            Room <span style={{ color: "var(--cream)", fontWeight: 700 }}>{code}</span>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {room.players.map((p) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 12px 4px 4px",
                borderRadius: 20,
                background: "var(--glass-2)",
                border: "1px solid var(--glass-border2)",
                fontSize: 13,
              }}>
                <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={20} />
                {p.isHost ? "👑 " : ""}{p.name}
              </div>
            ))}
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 20 }}>
            Waiting for host to spin…
          </p>
        </div>
      </PlayerPageShell>
    );
  }

  // STARTING — 3s countdown
  if (room.phase === "starting") {
    return (
      <PlayerPageShell>
        <div className="glass p-10 text-center animate-fade-in" style={{ maxWidth: 360, width: "100%" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.15em", color: "var(--text-secondary)", marginBottom: 16 }}>GET READY</p>
          <PlayerCountdown />
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 16 }}>Songs are about to play!</p>
        </div>
      </PlayerPageShell>
    );
  }

  // SPINNING
  if (room.phase === "spinning") {
    return (
      <PlayerPageShell>
        <div className="glass p-8 text-center animate-fade-in" style={{ maxWidth: 360, width: "100%" }}>
          <div style={{ fontSize: 60, marginBottom: 16, animation: "cd-spin 1s linear infinite" }}>💿</div>
          <p style={{ fontSize: 18, fontWeight: 700 }}>Spinning the wheel…</p>
          <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 14 }}>Get ready to pick a song!</p>
        </div>
      </PlayerPageShell>
    );
  }

  // SUBMITTING
  if (room.phase === "submitting") {
    const inTiebreaker = room.tiedPlayers.length > 0;
    const isInTiebreaker = inTiebreaker && room.tiedPlayers.includes(myId ?? "");

    if (inTiebreaker && !isInTiebreaker) {
      return (
        <PlayerPageShell>
          <div className="glass p-8 text-center" style={{ maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔥</div>
            <h3 style={{ fontSize: 22, fontWeight: 800 }}>Tiebreaker!</h3>
            <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
              Watch the tiebreaker round
            </p>
          </div>
        </PlayerPageShell>
      );
    }

    if (submitted) {
      return (
        <PlayerPageShell>
          <div className="glass p-8 text-center animate-fade-in" style={{ maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontSize: 20, fontWeight: 800 }}>Song submitted!</h3>
            <p style={{ color: "var(--cream)", fontWeight: 700, marginTop: 8 }}>{songTitle}</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 16 }}>
              Waiting for other players…
              <br />
              {room.submissions.length} / {room.players.length}
            </p>
          </div>
        </PlayerPageShell>
      );
    }

    return (
      <PlayerPageShell>
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="text-center" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--text-secondary)" }}>CATEGORY</p>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--cream)", textShadow: "0 0 20px rgba(226,27,27,0.15)" }}>
              {room.currentCategory}
            </h2>
            {room.submissionDeadline && <Countdown deadline={room.submissionDeadline} />}
          </div>

          <div className="glass p-6" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                SONG TITLE
              </label>
              <input
                value={songTitle}
                onChange={(e) => { setSongTitle(e.target.value); setError(""); }}
                placeholder="Artist – Song Name"
                maxLength={60}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                YOUTUBE LINK
              </label>
              <input
                value={youtubeUrl}
                onChange={(e) => { setYoutubeUrl(e.target.value); setError(""); }}
                placeholder="https://youtube.com/watch?v=..."
                type="url"
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                START AT (optional) — e.g. 1:23
              </label>
              <input
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                placeholder="0:00"
              />
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
            <button className="btn-glow" onClick={submitSong} style={{ width: "100%" }}>
              Submit Song 🎵
            </button>
          </div>
        </div>
      </PlayerPageShell>
    );
  }

  // PLAYING — vote while song plays
  if (room.phase === "playing" && currentSong) {
    return (
      <PlayerPageShell hideTopBar>
        <VotingScreen
          currentSong={currentSong}
          currentSongIndex={room.currentSongIndex}
          totalSongs={room.submissions.length}
          currentCategory={room.currentCategory}
          showVideo={room.screenMode === "everyone"}
          isMyOwnSong={isMyOwnSong}
          alreadyVoted={alreadyVoted}
          onVote={(stars) => castVote(room.currentSongIndex, stars)}
        />
      </PlayerPageShell>
    );
  }

  // RESULTS
  if (room.phase === "results") {
    const results = room.submissions
      .map((s) => ({
        playerId: s.playerId,
        playerName: s.playerName,
        avg: avgVotes(s.votes),
        title: s.title,
      }))
      .sort((a, b) => b.avg - a.avg);
    const leaderboard = [...room.players]
      .map((p) => ({ ...p, avg: p.roundsPlayed > 0 ? p.totalScore / p.roundsPlayed : 0 }))
      .sort((a, b) => b.avg - a.avg);

    return (
      <PlayerPageShell>
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="text-center">
            <h2 style={{ fontSize: 26, fontWeight: 900 }}>{room.gameOver ? "Game Over 🏆" : "Results 🏆"}</h2>
            <p style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 4 }}>
              Round {Math.min(room.roundNumber, room.roundLimit)} of {room.roundLimit}
            </p>
          </div>
          {results.map((r, i) => (
            <div key={r.playerId} className="glass p-4" style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderColor: r.playerId === myId ? "rgba(226,27,27,0.35)" : undefined,
            }}>
              <span style={{ fontSize: 24, minWidth: 32 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700 }}>{r.playerName} {r.playerId === myId ? "(you)" : ""}</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.title}</p>
              </div>
              <p style={{ fontSize: 20, fontWeight: 900, color: "var(--cream)" }}>{r.avg.toFixed(1)}★</p>
            </div>
          ))}

          <div style={{ marginTop: 8 }}>
            <p style={{
              fontSize: 10, letterSpacing: "0.2em", color: "var(--text-faint)",
              textTransform: "uppercase", textAlign: "center", marginBottom: 8,
            }}>
              Overall Leaderboard
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leaderboard.map((p, i) => (
                <div key={p.id} className="glass p-3" style={{
                  display: "flex", alignItems: "center", gap: 12,
                  borderColor: p.id === myId ? "rgba(226,27,27,0.35)" : undefined,
                }}>
                  <span style={{ fontSize: 18, minWidth: 28, textAlign: "center", fontWeight: 900 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={22} />
                  <p style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
                    {p.isHost ? "👑 " : ""}{p.name} {p.id === myId ? "(you)" : ""}
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 900, color: "var(--cream)" }}>{p.avg.toFixed(1)}★</p>
                </div>
              ))}
            </div>
          </div>

          <p style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center", marginTop: 8 }}>
            {room.gameOver ? "Waiting for host to start a new game…" : "Waiting for host…"}
          </p>
        </div>
      </PlayerPageShell>
    );
  }

  return (
    <PlayerPageShell>
      <div className="glass p-8 text-center">
        <p style={{ color: "var(--text-secondary)" }}>Phase: {room?.phase}</p>
      </div>
    </PlayerPageShell>
  );
}
