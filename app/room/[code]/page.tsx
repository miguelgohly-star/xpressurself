"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import CDWheel from "@/components/CDWheel";
import YouTubePlayer from "@/components/YouTubePlayer";
import StarVote from "@/components/StarVote";
import SongSearch from "@/components/SongSearch";
import Countdown from "@/components/Countdown";
import VotingScreen from "@/components/VotingScreen";
import SongTimer from "@/components/SongTimer";
import SlideToSkip from "@/components/SlideToSkip";
import WheelsManager from "@/components/WheelsManager";
import SongWarsBackground from "@/components/SongWarsBackground";
import QRCode from "react-qr-code";
import type { Room, TimeLimit, SongDuration, ScreenMode, RoundLimit } from "@/lib/gameState";
import { avgVotes, getCategoryDescription, DEFAULT_CATEGORIES } from "@/lib/gameState";
import { getSocket } from "@/lib/socket";
import TopBar from "@/components/TopBar";
import PlayerAvatar from "@/components/PlayerAvatar";

interface WheelOption { id: string; name: string; categories: { name: string }[]; }
interface FriendUser { id: string; username: string; image: string | null; }

function StartingCountdown() {
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
      transition: "all 0.3s",
    }}>
      {n > 0 ? n : "GO!"}
    </div>
  );
}

function getResults(room: Room) {
  return room.submissions
    .map((s) => ({
      playerId: s.playerId,
      playerName: s.playerName,
      avg: avgVotes(s.votes),
    }))
    .sort((a, b) => b.avg - a.avg);
}

export default function HostRoom() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [room, setRoom] = useState<Room | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [votedSongs, setVotedSongs] = useState<Set<number>>(new Set());
  const [startTimeInput, setStartTimeInput] = useState("");
  const [myWheels, setMyWheels] = useState<WheelOption[]>([]);
  const [selectedWheelId, setSelectedWheelId] = useState<string>("default");
  const [wheelsModalOpen, setWheelsModalOpen] = useState(false);
  const [codeVisible, setCodeVisible] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [friendsList, setFriendsList] = useState<FriendUser[]>([]);
  const [inviteMenuOpen, setInviteMenuOpen] = useState(false);
  const [invitedFriendIds, setInvitedFriendIds] = useState<Set<string>>(new Set());
  const [sessionEnded, setSessionEnded] = useState(false);
  const inviteMenuRef = useRef<HTMLDivElement>(null);
  const tvWrapperRef = useRef<HTMLDivElement>(null);
  const [tvTopCenter, setTvTopCenter] = useState<{ x: number; y: number; width: number } | null>(null);
  const s = useRef(getSocket());

  // Keep the floating star-vote row locked exactly above the TV frame,
  // regardless of viewport size — the TV's own width comes from a flex
  // remainder (pc-main is flex:1 next to a fixed-width side panel), so a
  // hardcoded percentage can't reliably center over it the way a real
  // measurement can.
  useEffect(() => {
    function measure() {
      const el = tvWrapperRef.current;
      const pageEl = el?.closest(".page") as HTMLElement | null;
      if (!el || !pageEl) return;
      const elRect = el.getBoundingClientRect();
      const pageRect = pageEl.getBoundingClientRect();
      // This app applies a legacy CSS `zoom` to html AND body (left as-is —
      // a known, pre-existing quirk). getBoundingClientRect() returns
      // already-zoom-scaled screen pixels, but a `left`/`top` value we set
      // in CSS gets zoomed again by the browser when it renders — so raw
      // rect math here would end up double-scaled. Divide out the combined
      // zoom factor before using these numbers as CSS px values.
      const zoom = (parseFloat(getComputedStyle(document.documentElement).zoom) || 1)
        * (parseFloat(getComputedStyle(document.body).zoom) || 1);
      setTvTopCenter({
        x: (elRect.left - pageRect.left + elRect.width / 2) / zoom,
        // Clamped — the floating row (mic/stars + text + vote count) sits
        // entirely above this point via a translateY(-100%-ish) transform,
        // so it needs its own height's worth of headroom plus the 26px
        // gap. A short song title leaves the TV (and so this point) too
        // close to the top of the page otherwise, clipping the row off
        // the top of the screen. 160px comfortably fits the tallest
        // version of that content (the mic + two-line "this is your
        // song…" text) with room to spare.
        y: Math.max((elRect.top - pageRect.top) / zoom, 160),
        width: elRect.width / zoom,
      });
    }
    measure();
    // Re-check shortly after mount too — this app loads several custom
    // webfonts (Cormorant Garamond, Pinyon Script, Yellowtail) that can
    // reflow the song-header text (and so shift the TV down) after the
    // very first measurement already ran, leaving the star row stranded
    // above where the TV used to be.
    if (typeof document !== "undefined" && "fonts" in document) {
      (document as any).fonts.ready.then(measure).catch(() => {});
    }
    const t1 = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 1000);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  // Different songs have different title lengths — a longer title that wraps
  // to a second line grows the header above the TV and pushes it down, so
  // this needs to re-measure on every song change, not just phase changes.
  }, [room?.phase, room?.currentSongIndex]);

  useEffect(() => {
    const sock = s.current;
    sock.on("room-updated", (r: Room) => setRoom(r));
    sock.on("joined", (r: Room) => setRoom(r));
    sock.on("room-created", (r: Room) => setRoom(r));
    sock.on("submit-error", ({ message }: { message: string }) => {
      setSubmitError(message);
      setSubmitted(false);
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
    // reclaims this host's existing slot server-side (see joinRoom's
    // reclaim-by-name logic, which also restores room.hostId). Using .on
    // instead of .once means this also fires on later reconnects.
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
      sock.off("room-created");
      sock.off("submit-error");
      sock.off("error");
      sock.off("connect", requestRoom);
    };
  }, [code, session?.user?.image]);

  // Fetch user's custom wheels if signed in
  useEffect(() => {
    if (!session) return;
    fetch("/api/wheels").then(r => r.ok ? r.json() : []).then(setMyWheels);
  }, [session]);

  // Fetch friends list if signed in, for the invite menu
  useEffect(() => {
    if (!session) return;
    fetch("/api/friends").then(r => r.ok ? r.json() : null).then(data => {
      if (data) setFriendsList(data.friends);
    });
  }, [session]);

  // Close the invite menu on an outside click
  useEffect(() => {
    if (!inviteMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (inviteMenuRef.current && !inviteMenuRef.current.contains(e.target as Node)) setInviteMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [inviteMenuOpen]);

  // Lock this page in place — no scrolling, same as every other page in the
  // app. The spinning/submitting card is sized to fit without it instead
  // (see the width bump below). The results phase is the exception: its
  // leaderboard + Next Round button can run taller than the viewport
  // (especially with more players, or the desktop zoom scale), so it needs
  // to scroll or the button is unreachable.
  useEffect(() => {
    const { documentElement: html, body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const locked = room?.phase !== "results";
    html.style.overflow = locked ? "hidden" : "";
    body.style.overflow = locked ? "hidden" : "";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [room?.phase]);

  const applyWheel = (wheelId: string) => {
    setSelectedWheelId(wheelId);
    if (wheelId === "default") {
      // Switching back off a custom wheel has to explicitly tell the server
      // to reset room.categories — it doesn't happen on its own, since the
      // server just keeps whatever categories were last set (previously this
      // was a no-op here, so re-selecting "Default" after a custom wheel had
      // been applied left the custom wheel's categories active underneath
      // despite the UI showing Default as selected).
      s.current.emit("set-categories", { code, categories: DEFAULT_CATEGORIES });
      return;
    }
    const wheel = myWheels.find(w => w.id === wheelId);
    if (!wheel) return;
    s.current.emit("set-categories", { code, categories: wheel.categories.map(c => c.name) });
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1800);
    } catch {
      // clipboard unavailable — button silently stays "Invite Friends"
    }
  };

  const inviteFriend = async (friendId: string) => {
    const res = await fetch(`/api/messages/${friendId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "INVITE", roomCode: code }),
    });
    if (res.ok) setInvitedFriendIds(prev => new Set([...prev, friendId]));
  };

  const kickPlayer = (playerId: string) => {
    s.current.emit("kick-player", { code, playerId });
  };

  if (sessionEnded) {
    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "clamp(90px, 8vh, 150px)" }}>
        <SongWarsBackground />
        <TopBar />
        <div className="glass p-8 text-center animate-fade-in" style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 15, marginBottom: 8 }}>This game session has ended.</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Taking you back to start a new one…</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "clamp(90px, 8vh, 150px)" }}>
        <SongWarsBackground />
        <TopBar />
        <div className="glass p-8 text-center animate-fade-in">
          <p style={{ color: "var(--text-secondary)" }}>Connecting…</p>
        </div>
      </div>
    );
  }

  const isHost = room.hostId === s.current.id;

  const spinWheel = () => s.current.emit("spin-wheel", { code });
  const startPlaying = () => s.current.emit("start-playing", { code });
  const nextSong = () => s.current.emit("next-song", { code });
  const newRound = () => {
    setSubmitted(false);
    setYoutubeUrl("");
    setSongTitle("");
    setVotedSongs(new Set());
    s.current.emit("new-round", { code });
  };
  const restartGame = () => {
    setSubmitted(false);
    setYoutubeUrl("");
    setSongTitle("");
    setVotedSongs(new Set());
    s.current.emit("restart-game", { code });
  };

  const castVote = (songIndex: number, stars: number) => {
    s.current.emit("cast-vote", { code, songIndex, stars });
    setVotedSongs((prev) => new Set([...prev, songIndex]));
  };

  const parseStartTime = (val: string): number => {
    const parts = val.trim().split(":").map(Number);
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    if (parts.length === 1) return parts[0] ?? 0;
    return 0;
  };

  const submitSong = () => {
    if (!youtubeUrl.trim()) return setSubmitError("Paste a YouTube link");
    if (!songTitle.trim()) return setSubmitError("Add a song title");
    if (!youtubeUrl.includes("youtu")) return setSubmitError("Must be a YouTube link");
    const startTime = startTimeInput ? parseStartTime(startTimeInput) : 0;
    s.current.emit("submit-song", { code, youtubeUrl: youtubeUrl.trim(), title: songTitle.trim(), startTime });
    setSubmitted(true);
    setSubmitError("");
  };

  const setTimeLimitOption = (limit: TimeLimit) => {
    s.current.emit("set-time-limit", { code, limit });
  };

  const setSongDurationOption = (duration: SongDuration) => {
    s.current.emit("set-song-duration", { code, duration });
  };

  const setScreenModeOption = (mode: ScreenMode) => {
    s.current.emit("set-screen-mode", { code, mode });
  };

  const setRoundLimitOption = (limit: RoundLimit) => {
    s.current.emit("set-round-limit", { code, limit });
  };

  const results = getResults(room);
  const topScore = results[0]?.avg ?? 0;
  const tied = results.filter((r) => r.avg === topScore && topScore > 0);
  const currentSong = room.submissions[room.currentSongIndex];
  const isMyOwnSong = currentSong?.playerId === s.current.id;
  const alreadyVoted = votedSongs.has(room.currentSongIndex);

  // Wheel choices (host only) — "default" plus any wheels this signed-in host owns
  const wheelChoices: WheelOption[] = [{ id: "default", name: "Default (30 categories)", categories: [] }, ...myWheels];

  // LOBBY
  if (room.phase === "lobby") {
    const colLabel: React.CSSProperties = {
      fontSize: 10, letterSpacing: "0.25em", color: "var(--text-faint)",
      textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif", marginBottom: 10,
    };
    const wheelsAuthHref = session ? "/wheels" : "/auth?callbackUrl=/wheels";

    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "clamp(90px, 8vh, 150px)" }}>
        <SongWarsBackground />
        <TopBar />
        <div className="page-wide" style={{ width: "100%" }}>
          <div className="glass room-lobby-card" style={{
            width: "100%", maxWidth: 1180, margin: "0 auto",
            minHeight: 220,
            display: "flex", flexDirection: "column",
            padding: "22px 36px",
          }}>

          {/* Content between the header and the pinned players/status footer */}
          <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>

            {/* Upper section — Room / Settings / Wheels. Only the Wheels column
               scrolls internally (its list can grow arbitrarily long); Room Code
               and Game Settings never need to. */}
            <div className="room-settings-row">

              {/* Left — Room code + invite (~28% at 860px+) */}
              <div className="room-settings-col--left">
                <p style={colLabel}>Room Code</p>
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div
                    className="room-code"
                    style={{
                      filter: codeVisible ? "none" : "blur(9px)",
                      userSelect: codeVisible ? "text" : "none",
                      transition: "filter 0.2s ease",
                    }}
                  >{code}</div>
                  <button
                    onClick={() => setCodeVisible(v => !v)}
                    title={codeVisible ? "Hide room code" : "Show room code"}
                    aria-label={codeVisible ? "Hide room code" : "Show room code"}
                    style={{
                      position: "absolute", left: "100%", top: "50%", transform: "translateY(-50%)",
                      marginLeft: 8,
                      background: "none", border: "none", cursor: "pointer", padding: 4,
                      lineHeight: 1, opacity: 0.6, transition: "opacity 0.15s",
                      color: "var(--text-dark)", display: "flex",
                    }}
                  >
                    {codeVisible ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.32 20.32 0 0 1-3.22 4.44M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <div style={{ background: "white", padding: 8, borderRadius: 2, filter: codeVisible ? "none" : "blur(9px)", transition: "filter 0.2s ease" }}>
                  <QRCode value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${code}`} size={64} />
                </div>
                <p style={{ fontSize: 11, color: "var(--text-faint)", fontStyle: "italic" }}>
                  {codeVisible ? "Scan to join on your phone" : "Hidden — click the eye to reveal"}
                </p>
                <div ref={inviteMenuRef} style={{ position: "relative", width: "100%", marginTop: 2 }}>
                  <button
                    className="btn-glow"
                    onClick={() => session ? setInviteMenuOpen(o => !o) : copyInviteLink()}
                    style={{ width: "100%" }}
                  >
                    {inviteCopied ? "Copied! ✓" : "Invite Friends"}
                  </button>

                  {inviteMenuOpen && (
                    <div className="aero-panel" style={{
                      position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                      width: 230, borderRadius: 12, padding: 14, textAlign: "left", zIndex: 20,
                      animation: "inviteMenuIn 0.18s ease", background: "var(--glass)",
                      boxShadow: "0 2px 0 rgba(255,255,255,0.95) inset, 0 12px 40px var(--shadow-soft), 0 2px 8px var(--shadow-hard)",
                    }}>
                      <p style={{ ...colLabel, marginBottom: 10 }}>Invite a Friend</p>
                      {friendsList.length === 0 ? (
                        <p style={{ fontSize: 12, color: "var(--text-faint)", fontStyle: "italic" }}>
                          No friends yet — <a href="/friends" style={{ color: "var(--cream-ghost)" }}>add some</a>
                        </p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                          {friendsList.map(f => {
                            const invited = invitedFriendIds.has(f.id);
                            return (
                              <button
                                key={f.id}
                                onClick={() => !invited && inviteFriend(f.id)}
                                disabled={invited}
                                style={{
                                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                                  background: "transparent", border: "none", padding: "6px 4px",
                                  textAlign: "left", cursor: invited ? "default" : "pointer",
                                  opacity: invited ? 0.5 : 1,
                                }}
                              >
                                {f.image ? (
                                  <img src={f.image} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                                ) : (
                                  <div style={{
                                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                                    background: "var(--glass-2)", display: "flex", alignItems: "center", justifyContent: "center",
                                    fontFamily: "'Pinyon Script', cursive", fontSize: 13, color: "var(--text-dark)",
                                  }}>{f.username[0]?.toUpperCase()}</div>
                                )}
                                <span style={{ fontSize: 13, color: "var(--text-dark)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {f.username}
                                </span>
                                <span style={{ fontSize: 10, color: invited ? "rgba(226,27,27,0.7)" : "var(--text-faint)", flexShrink: 0 }}>
                                  {invited ? "Invited ✓" : "Invite"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="rule" style={{ margin: "12px 0 10px" }} />
                      <button
                        onClick={copyInviteLink}
                        style={{
                          fontSize: 11, color: "var(--text-faint)", background: "none", border: "none",
                          cursor: "pointer", textDecoration: "underline", padding: 0,
                        }}
                      >
                        {inviteCopied ? "Link copied!" : "Copy invite link instead"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle — Game settings (~40% at 860px+) */}
              <div className="room-settings-col--mid">
                <p style={colLabel}>Game Settings</p>
                {isHost ? (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <p style={{ ...colLabel, marginBottom: 6 }}>Song Selection Limit</p>
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                      {([null, 1, 3, 5] as TimeLimit[]).map((limit) => (
                        <button
                          key={String(limit)}
                          onClick={() => setTimeLimitOption(limit)}
                          style={{
                            flex: 1, padding: "6px 4px", borderRadius: 0, border: "1px solid",
                            borderColor: room.timeLimit === limit ? "rgba(226,27,27,0.5)" : "var(--glass-border2)",
                            background: room.timeLimit === limit ? "rgba(226,27,27,0.08)" : "transparent",
                            color: room.timeLimit === limit ? "var(--cream)" : "var(--text-secondary)",
                            cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                          }}
                        >
                          {limit === null ? "∞" : `${limit}m`}
                        </button>
                      ))}
                    </div>

                    <p style={{ ...colLabel, marginBottom: 6 }}>Max Song Runtime</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {([null, 15, 30, 60] as SongDuration[]).map((dur) => (
                        <button
                          key={String(dur)}
                          onClick={() => setSongDurationOption(dur)}
                          style={{
                            flex: 1, padding: "6px 4px", borderRadius: 0, border: "1px solid",
                            borderColor: room.songDuration === dur ? "rgba(226,27,27,0.5)" : "var(--glass-border2)",
                            background: room.songDuration === dur ? "rgba(226,27,27,0.08)" : "transparent",
                            color: room.songDuration === dur ? "var(--cream)" : "var(--text-secondary)",
                            cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                          }}
                        >
                          {dur === null ? "∞" : dur >= 60 ? "1m" : `${dur}s`}
                        </button>
                      ))}
                    </div>

                    <p style={{ ...colLabel, marginTop: 14, marginBottom: 6 }}>Screen Mode</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {([
                        { mode: "shared" as ScreenMode, label: "One Screen" },
                        { mode: "everyone" as ScreenMode, label: "Everyone's Screen" },
                      ]).map(({ mode, label }) => (
                        <button
                          key={mode}
                          onClick={() => setScreenModeOption(mode)}
                          style={{
                            flex: 1, padding: "6px 4px", borderRadius: 0, border: "1px solid",
                            borderColor: room.screenMode === mode ? "rgba(226,27,27,0.5)" : "var(--glass-border2)",
                            background: room.screenMode === mode ? "rgba(226,27,27,0.08)" : "transparent",
                            color: room.screenMode === mode ? "var(--cream)" : "var(--text-secondary)",
                            cursor: "pointer", fontSize: 11, transition: "all 0.15s",
                            fontFamily: "'Cormorant Garamond', serif",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-faint)", fontStyle: "italic", marginTop: 6 }}>
                      {room.screenMode === "everyone"
                        ? "Every player also gets the video on their own device."
                        : "Only this screen plays the video — players just vote."}
                    </p>

                    <p style={{ ...colLabel, marginTop: 14, marginBottom: 6 }}>Rounds</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {([1, 3, 5, 10] as RoundLimit[]).map((limit) => (
                        <button
                          key={limit}
                          onClick={() => setRoundLimitOption(limit)}
                          style={{
                            flex: 1, padding: "6px 4px", borderRadius: 0, border: "1px solid",
                            borderColor: room.roundLimit === limit ? "rgba(226,27,27,0.5)" : "var(--glass-border2)",
                            background: room.roundLimit === limit ? "rgba(226,27,27,0.08)" : "transparent",
                            color: room.roundLimit === limit ? "var(--cream)" : "var(--text-secondary)",
                            cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                          }}
                        >
                          {limit}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <p style={{ ...colLabel, marginBottom: 6 }}>Song Selection Limit</p>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif" }}>
                        {room.timeLimit === null ? "No limit" : `${room.timeLimit} min`}
                      </p>
                    </div>
                    <div>
                      <p style={{ ...colLabel, marginBottom: 6 }}>Max Song Runtime</p>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif" }}>
                        {room.songDuration === null ? "No limit" : room.songDuration >= 60 ? "1 min" : `${room.songDuration}s`}
                      </p>
                    </div>
                    <div>
                      <p style={{ ...colLabel, marginBottom: 6 }}>Screen Mode</p>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif" }}>
                        {room.screenMode === "everyone" ? "Everyone's Screen" : "One Screen"}
                      </p>
                    </div>
                    <div>
                      <p style={{ ...colLabel, marginBottom: 6 }}>Rounds</p>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif" }}>
                        {room.roundLimit}
                      </p>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-faint)", fontStyle: "italic", marginTop: 4 }}>
                      Only the host can change these.
                    </p>
                  </div>
                )}
              </div>

              {/* Right — Wheels list (~32% at 860px+) — its own independent scroll region there */}
              <div className="room-settings-col--right">
                <p style={{ ...colLabel, flexShrink: 0 }}>Wheels</p>
                {isHost ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                    {wheelChoices.map(w => (
                      <button
                        key={w.id}
                        onClick={() => applyWheel(w.id)}
                        style={{
                          textAlign: "center", cursor: "pointer", border: "1px solid",
                          borderColor: selectedWheelId === w.id ? "rgba(226,27,27,0.45)" : "var(--glass-border2)",
                          background: selectedWheelId === w.id ? "rgba(226,27,27,0.05)" : "transparent",
                          padding: "8px 12px",
                          color: selectedWheelId === w.id ? "var(--cream)" : "var(--text-secondary)",
                          fontFamily: "'Cormorant Garamond', serif",
                          transition: "all 0.2s",
                        }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 300, letterSpacing: "0.04em" }}>{w.name}</p>
                        {w.categories.length > 0 && (
                          <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2, letterSpacing: "0.1em" }}>
                            {w.categories.length} categories
                          </p>
                        )}
                      </button>
                    ))}

                    {session ? (
                      // Opens in-place instead of navigating to /wheels, so
                      // managing wheels mid-setup doesn't pull the host (and
                      // their socket connection) out of the room they're
                      // hosting — see the modal rendered below.
                      <button onClick={() => setWheelsModalOpen(true)} style={{
                        fontSize: 10, color: "var(--text-faint)", marginTop: 4,
                        letterSpacing: "0.18em", textDecoration: "none", textTransform: "uppercase",
                        fontFamily: "'Cormorant Garamond', serif",
                        background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left",
                      }}>
                        + Manage Wheels →
                      </button>
                    ) : (
                      <a href={wheelsAuthHref} style={{
                        fontSize: 10, color: "var(--text-faint)", marginTop: 4,
                        letterSpacing: "0.18em", textDecoration: "none", textTransform: "uppercase",
                        fontFamily: "'Cormorant Garamond', serif",
                      }}>
                        + Manage Wheels →
                      </a>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif" }}>
                      {room.categories.length} categories in play
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-faint)", fontStyle: "italic", marginTop: 8 }}>
                      Chosen by the host
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* end scrollable content — divider, players, and status line below always stay visible */}

          <div className="rule" style={{ width: "100%", margin: "14px 0", flexShrink: 0 }} />

          {/* Players, full width — pinned so it's always visible, never scrolled out of view */}
          <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <p style={{ ...colLabel, marginBottom: 10 }}>Players ({room.players.length}/8)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignContent: "flex-start" }}>
              {room.players.map((p) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  border: "1px solid var(--glass-border2)",
                  padding: "5px 12px 5px 5px",
                  position: "relative",
                }}>
                  <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={26} />
                  <span style={{
                    fontSize: 13, color: "var(--cream-dim)",
                    fontFamily: "'Cormorant Garamond', serif", fontWeight: 300,
                  }}>
                    {p.name}
                  </span>
                  {p.isHost && (
                    <span style={{
                      fontSize: 9, letterSpacing: "0.12em", color: "rgba(226,27,27,0.75)",
                      fontFamily: "'Cormorant Garamond', serif", textTransform: "uppercase",
                    }}>Host</span>
                  )}
                  {isHost && !p.isHost && (
                    <button
                      onClick={() => kickPlayer(p.id)}
                      title={`Remove ${p.name}`}
                      aria-label={`Remove ${p.name}`}
                      style={{
                        position: "absolute", top: -6, right: -6,
                        width: 16, height: 16, borderRadius: "50%",
                        background: "var(--glass)", border: "1px solid var(--glass-border2)",
                        color: "var(--text-faint)", fontSize: 9, lineHeight: 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", padding: 0, transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = "rgba(226,27,27,0.85)"; e.currentTarget.style.borderColor = "rgba(226,27,27,0.4)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-faint)"; e.currentTarget.style.borderColor = "var(--glass-border2)"; }}
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isHost && room.players.length >= 2 && (
            <button className="btn-glow" onClick={spinWheel} style={{ width: "100%", marginTop: 20, flexShrink: 0 }}>
              Spin the Wheel
            </button>
          )}
          {isHost && room.players.length < 2 && (
            <p style={{ color: "var(--text-faint)", textAlign: "center", fontSize: 11, fontStyle: "italic", fontFamily: "'Cormorant Garamond', serif", marginTop: 20, flexShrink: 0 }}>
              Waiting for at least 2 players…
            </p>
          )}
          </div>
        </div>

        {/* Manage Wheels modal — lets the host create/edit/delete their
            custom wheels without leaving this room; closing it just
            dismisses the overlay, same room/socket state the whole time. */}
        {wheelsModalOpen && (
          <div
            onClick={() => setWheelsModalOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(20,16,10,0.55)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto", position: "relative" }}
            >
              <button
                onClick={() => setWheelsModalOpen(false)}
                title="Close"
                style={{
                  position: "absolute", top: 0, right: 0, zIndex: 1,
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--glass)", border: "1px solid rgba(242,236,227,0.15)",
                  color: "var(--text-secondary)", fontSize: 14, lineHeight: 1,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >✕</button>
              <WheelsManager onWheelsChanged={setMyWheels} />
            </div>
          </div>
        )}

        <style>{`
          @keyframes inviteMenuIn{
            from{ opacity:0; transform:translate(-50%, 8px); }
            to{ opacity:1; transform:translate(-50%, 0); }
          }
        `}</style>
      </div>
    );
  }

  // STARTING — 3-second countdown
  if (room.phase === "starting") {
    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "clamp(90px, 8vh, 150px)" }}>
        <SongWarsBackground />
        <TopBar />
        <div className="glass p-12 text-center animate-fade-in" style={{ maxWidth: 400 }}>
          <p style={{ fontSize: 13, letterSpacing: "0.15em", color: "var(--text-secondary)", marginBottom: 16 }}>GET READY</p>
          <StartingCountdown />
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 16 }}>Songs are about to play!</p>
        </div>
      </div>
    );
  }

  // SPINNING + SUBMITTING — show the wheel on host screen
  if (room.phase === "spinning" || room.phase === "submitting") {
    const allSubmitted = room.submissions.length >= room.players.length;
    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "clamp(45px, 6vh, 120px)" }}>
        <SongWarsBackground />
        <TopBar />
        {/* maxWidth here used to be 600 — fine while it only centered the
            header text, but once the wheel+form row renders (flex, wheel
            380px + gap 48px + form up to 960px), 600 was already being
            overflowed rather than actually containing it. Raised to fit
            that row with room to spare instead of quietly ignoring its own cap. */}
        <div style={{ width: "100%", maxWidth: 1450, display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
          <div className="text-center">
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.1em" }}>
              {room.phase === "spinning" ? "SPINNING…" : room.currentCategory?.toUpperCase()}
            </h2>
          </div>

          <div className="submit-grid" style={{ width: "100%" }}>
            <div className="submit-wheel">
              <CDWheel
                spinning={room.phase === "spinning"}
                category={room.currentCategory}
              />
            </div>

          {room.phase === "submitting" && (
            <div className="submit-form" style={{ width: "100%" }}>
              {/* One card for the whole submit flow — song form/confirmation
                  on top, player status + start button below a divider —
                  instead of two separately-bordered glass boxes stacked
                  with a gap between them. This card's full content
                  (countdown + form + player list + button) genuinely runs
                  taller than shorter viewports under this app's site-wide
                  zoom, so the page's scroll lock is turned off for this
                  phase (see the effect above) rather than caging the
                  overflow in a cramped scrollbar inside the card itself. */}
              <div className="glass p-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Countdown */}
                {room.submissionDeadline && (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Countdown deadline={room.submissionDeadline} />
                  </div>
                )}

                {/* Host song submission */}
                {submitted ? (
                  <div className="text-center">
                    <p style={{ color: "var(--cream)", fontWeight: 300, letterSpacing: "0.1em" }}>✓ Your song is in</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>{songTitle}</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>Submit your song</p>
                    {/* Title + start-time share a row now that the card is
                        wide enough — trades one full stacked row's worth of
                        height for the width we already have, rather than
                        just leaving that width empty. */}
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                          SONG TITLE
                        </label>
                        <input
                          value={songTitle}
                          onChange={(e) => { setSongTitle(e.target.value); setSubmitError(""); }}
                          placeholder="Artist – Song Name"
                          maxLength={60}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                          START AT
                        </label>
                        <input
                          value={startTimeInput}
                          onChange={(e) => setStartTimeInput(e.target.value)}
                          placeholder="0:00 or 1:23"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                        YOUTUBE LINK
                      </label>
                      <input
                        value={youtubeUrl}
                        onChange={(e) => { setYoutubeUrl(e.target.value); setSubmitError(""); }}
                        placeholder="https://youtube.com/watch?v=..."
                        type="url"
                      />
                    </div>
                    {submitError && <p style={{ color: "var(--danger)", fontSize: 13 }}>{submitError}</p>}
                    <button className="btn-glow" onClick={submitSong} style={{ width: "100%" }}>
                      Submit Song 🎵
                    </button>
                  </div>
                )}

                {/* Player status */}
                <div className="text-center" style={{ borderTop: "1px solid rgba(242,236,227,0.08)", paddingTop: 10 }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 8 }}>
                    {room.submissions.length} / {room.players.length} submitted
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    {room.players.map((p) => {
                      const hasSubmitted = room.submissions.find((s) => s.playerId === p.id);
                      return (
                        <div key={p.id} style={{
                          padding: "4px 12px",
                          borderRadius: 8,
                          fontSize: 13,
                          border: "1px solid",
                          borderColor: hasSubmitted ? "rgba(226,27,27,0.35)" : "var(--glass-border2)",
                          background: hasSubmitted ? "rgba(226,27,27,0.06)" : "transparent",
                          color: hasSubmitted ? "var(--cream)" : "var(--text-secondary)",
                        }}>
                          {hasSubmitted ? "✓ " : ""}{p.name}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="btn-glow"
                    onClick={startPlaying}
                    style={{ marginTop: 10, width: "100%", opacity: allSubmitted ? 1 : 0.6 }}
                  >
                    {allSubmitted ? "Start Playing ▶" : `Start Anyway (${room.submissions.length} songs)`}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>{/* end submit-grid */}
        </div>
      </div>
    );
  }

  // PLAYING
  if (room.phase === "playing" && currentSong) {
    // "Everyone's Screen" — every player's own device plays the video too,
    // so the host's screen shows the exact same voting UI as /player
    // (shared VotingScreen, skip vote included) instead of its own
    // differently-laid-out version.
    if (room.screenMode === "everyone") {
      return (
        <div className="page" style={{ justifyContent: "flex-start", paddingTop: "clamp(90px, 8vh, 150px)" }}>
          <SongWarsBackground />
          <TopBar hidden />
          <VotingScreen
            currentSong={currentSong}
            currentSongIndex={room.currentSongIndex}
            totalSongs={room.submissions.length}
            currentCategory={room.currentCategory}
            showVideo
            isMyOwnSong={isMyOwnSong}
            alreadyVoted={alreadyVoted}
            onVote={(stars) => castVote(room.currentSongIndex, stars)}
            onVideoReady={() => s.current.emit("video-ready", { code })}
            songDuration={room.songDuration}
            songStartedAt={room.songStartedAt}
            onExpire={isHost ? nextSong : undefined}
            skipVoterIds={room.skipVoterIds}
            totalPlayers={room.players.length}
            myId={s.current.id}
            onSkipVote={() => s.current.emit("skip-vote", { code })}
          />
        </div>
      );
    }

    // "One Screen" — only this screen plays the video, so it keeps its own
    // TV-style layout (video pinned to a measured position, vote row
    // floating above it) rather than the single-column phone layout above.
    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: 40 }}>
        {/* Fixed to the viewport rather than sized with .page's own box —
            this content can grow taller than 100vh (two-column layout on a
            short viewport), and background-size:cover would otherwise scale
            against that overflowed height instead of the actual screen,
            zooming in and cropping the art unrecognizably. Same backdrop as
            the /play page, for visual consistency between the two. */}
        <div className="song-wars-bg-fixed" style={{ position: "fixed", inset: 0, zIndex: -1 }} />
        <TopBar hidden />

        {/* Vote row — no card/box, floats directly on the background, locked
            horizontally centered and sitting just above the TV frame (see
            the tvTopCenter measurement effect above). */}
        {tvTopCenter && (
          <div style={{
            position: "absolute",
            left: tvTopCenter.x, top: tvTopCenter.y,
            transform: "translate(-50%, calc(-100% - 26px))",
            textAlign: "center", zIndex: 2,
          }}>
            {isMyOwnSong ? (
              <div>
                <p style={{ fontSize: 28, marginBottom: 8 }}>🎤</p>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, fontStyle: "italic" }}>
                  This is your song. Others are voting now…
                </p>
              </div>
            ) : (
              <StarVote
                onVote={(stars) => castVote(room.currentSongIndex, stars)}
                voted={alreadyVoted}
                activeColor="#1a1611"
                size={Math.min(42, tvTopCenter.width * 0.16)}
              />
            )}
            <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 10, fontStyle: "italic" }}>
              {room.submissions.reduce((a, s) => a + Object.keys(s.votes).length, 0)} votes cast
            </p>
          </div>
        )}

        <div className="page-wide pc-split">
          {/* LEFT — video */}
          <div className="pc-main" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Song header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: "0.25em", color: "var(--text-faint)", fontFamily: "'Cormorant Garamond', serif", textTransform: "uppercase" }}>
                  Song {room.currentSongIndex + 1} of {room.submissions.length}
                </p>
                <h2 style={{ fontSize: 24, fontWeight: 300, color: "var(--cream)", marginTop: 4, fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.04em" }}>
                  {currentSong.title}
                </h2>
              </div>
              {room.songDuration && (
                <SongTimer key={room.currentSongIndex} duration={room.songDuration} songStartedAt={room.songStartedAt} onExpire={isHost ? nextSong : undefined} />
              )}
            </div>

            <div ref={tvWrapperRef}>
              <YouTubePlayer frame="ipad" youtubeUrl={currentSong.youtubeUrl} startTime={currentSong.startTime} />
            </div>
          </div>

          {/* RIGHT — category / players / next-song */}
          <div className="pc-side" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {/* Category badge */}
            <div className="glass" style={{ width: "100%", boxSizing: "border-box", padding: "22px 20px", textAlign: "center", borderRadius: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--text-faint)", textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif", marginBottom: 8 }}>
                Category
              </p>
              {/* Same font as the "Next Song" button (.btn-glow's var(--font-ui)) — swapped from Consolas, which read fine but didn't match anything else on this card. */}
              <p style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 20, letterSpacing: "0.01em", color: "var(--cream)", lineHeight: 1.35 }}>
                {room.currentCategory}
              </p>
              {getCategoryDescription(room.currentCategory) && (
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.4 }}>
                  {getCategoryDescription(room.currentCategory)}
                </p>
              )}
            </div>

            {/* Players list */}
            <div className="glass" style={{ width: "100%", boxSizing: "border-box", padding: "20px 18px", borderRadius: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: "0.25em", color: "var(--text-faint)", textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif", marginBottom: 10 }}>
                Players
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {room.players.map(p => (
                  <span key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 12, padding: "3px 10px 3px 4px",
                    border: "1px solid var(--glass-border2)",
                    color: "var(--text-secondary)",
                    fontFamily: "'Cormorant Garamond', serif",
                  }}>
                    <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={18} />
                    {p.isHost ? "👑 " : ""}{p.name}
                  </span>
                ))}
              </div>
            </div>

            {(() => {
              const iVotedSkip = room.skipVoterIds.includes(s.current.id ?? "");
              const skipLabel = room.currentSongIndex + 1 >= room.submissions.length ? "Slide to see results" : "Slide to skip";
              const tally = `${room.skipVoterIds.length}/${room.players.length}`;
              return (
                <SlideToSkip
                  label={iVotedSkip ? `Waiting for others… (${tally})` : `${skipLabel} (${tally})`}
                  onConfirm={() => s.current.emit("skip-vote", { code })}
                  disabled={iVotedSkip}
                />
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // RESULTS
  if (room.phase === "results") {
    const tiedIds = tied.length > 1 ? tied.map((t) => t.playerId) : [];
    const leaderboard = [...room.players]
      .map((p) => ({ ...p, avg: p.roundsPlayed > 0 ? p.totalScore / p.roundsPlayed : 0 }))
      .sort((a, b) => b.avg - a.avg);
    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "clamp(90px, 8vh, 150px)" }}>
        <SongWarsBackground />
        <TopBar />
        <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="text-center">
            <h2 style={{ fontSize: 32, fontWeight: 900, color: "var(--cream)" }}>
              {room.gameOver ? "Game Over 🏆" : "Results 🏆"}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{room.currentCategory}</p>
            {getCategoryDescription(room.currentCategory) && (
              <p style={{ color: "var(--text-faint)", fontSize: 12, fontStyle: "italic", fontFamily: "'Cormorant Garamond', serif", marginTop: 2 }}>
                {getCategoryDescription(room.currentCategory)}
              </p>
            )}
            <p style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 4 }}>
              Round {Math.min(room.roundNumber, room.roundLimit)} of {room.roundLimit}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.map((r, i) => (
              <div key={r.playerId} className="glass p-4" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  fontSize: 28,
                  fontWeight: 900,
                  width: 40,
                  textAlign: "center",
                  color: i === 0 ? "gold" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "var(--text-secondary)",
                  textShadow: i === 0 ? "0 0 20px rgba(255,215,0,0.6)" : "none",
                }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{r.playerName}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    {room.submissions.find((s) => s.playerId === r.playerId)?.title}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 22, fontWeight: 900, color: "var(--cream)" }}>
                    {r.avg.toFixed(1)}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>avg ★</p>
                </div>
              </div>
            ))}
          </div>

          {isHost && tiedIds.length > 1 && (
            <button
              className="btn-glow"
              onClick={() => s.current.emit("start-tiebreaker", { code, tiedPlayerIds: tiedIds })}
              style={{ width: "100%", borderColor: "rgba(255,200,0,0.4)" }}
            >
              Tiebreaker Round 🔥
            </button>
          )}

          <div>
            <p style={{
              fontSize: 10, letterSpacing: "0.25em", color: "var(--text-faint)",
              textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif",
              textAlign: "center", marginBottom: 10,
            }}>
              Overall Leaderboard
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leaderboard.map((p, i) => (
                <div key={p.id} className="glass p-3" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    fontSize: 18, fontWeight: 900, width: 28, textAlign: "center",
                    color: i === 0 ? "gold" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "var(--text-secondary)",
                  }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </div>
                  <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={24} />
                  <p style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
                    {p.isHost ? "👑 " : ""}{p.name}
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 900, color: "var(--cream)" }}>
                    {p.avg.toFixed(1)} <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 400 }}>avg</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            room.gameOver ? (
              <button className="btn-glow" onClick={restartGame} style={{ width: "100%" }}>
                🏆 Play Again
              </button>
            ) : (
              <button className="btn-glow" onClick={newRound} style={{ width: "100%" }}>
                Next Round →
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ justifyContent: "flex-start", paddingTop: "clamp(90px, 8vh, 150px)" }}>
      <SongWarsBackground />
      <TopBar />
      <div className="glass p-8 text-center">
        <p style={{ color: "var(--text-secondary)" }}>Phase: {room.phase}</p>
      </div>
    </div>
  );
}
