"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import TopBar from "@/components/TopBar";

interface FriendUser { id: string; username: string; image: string | null; }
interface PendingEntry { friendshipId: string; user: FriendUser; }
interface Msg {
  id: string; senderId: string; receiverId: string; content: string;
  type: "TEXT" | "INVITE"; roomCode: string | null; createdAt: string;
  liked: boolean; readAt: string | null;
}

const lbl: React.CSSProperties = {
  fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase",
  color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300, display: "block", marginBottom: 10,
};

function Avatar({ user, size = 36 }: { user: FriendUser; size?: number }) {
  return user.image ? (
    <img src={user.image} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}/>
  ) : (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "var(--glass-2)", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Pinyon Script', cursive", fontSize: size * 0.5, color: "var(--text-dark)",
    }}>{user.username[0]?.toUpperCase()}</div>
  );
}

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const myId = session?.user?.id;

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<PendingEntry[]>([]);
  const [outgoing, setOutgoing] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendUser[]>([]);
  const [addError, setAddError] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [inviting, setInviting] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth?callbackUrl=/friends");
    if (status === "authenticated") fetchFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Identify to the socket server so friends can reach my personal room (typing indicators)
  useEffect(() => {
    if (!session?.user?.id) return;
    const s = getSocket();
    s.emit("identify", { userId: session.user.id });
  }, [session?.user?.id]);

  // Listen for the selected friend typing
  useEffect(() => {
    const s = getSocket();
    const onTyping = ({ from }: { from: string }) => {
      if (!selected || from !== selected.id) return;
      setFriendTyping(true);
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
      typingClearRef.current = setTimeout(() => setFriendTyping(false), 3000);
    };
    s.on("friend-typing", onTyping);
    return () => { s.off("friend-typing", onTyping); };
  }, [selected]);

  useEffect(() => {
    setFriendTyping(false);
  }, [selected]);

  // Lock the page — no vertical scroll while on the friends tab
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

  // Close the account-search popover on an outside click
  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [searchOpen]);

  const fetchFriends = async () => {
    setLoading(true);
    const res = await fetch("/api/friends");
    if (res.ok) {
      const data = await res.json();
      setFriends(data.friends);
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
    }
    setLoading(false);
  };

  // search-by-username, debounced
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const sendRequest = async (username: string) => {
    setAddError("");
    const res = await fetch("/api/friends", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) { setAddError((await res.json()).error); return; }
    const entry = await res.json();
    setOutgoing(p => [entry, ...p]);
    setQuery(""); setResults([]);
  };

  const accept = async (friendshipId: string) => {
    await fetch(`/api/friends/${friendshipId}`, { method: "PATCH" });
    fetchFriends();
  };

  const removeFriendship = async (friendshipId: string) => {
    await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
    fetchFriends();
  };

  const fetchMessages = useCallback(async (friendId: string) => {
    const res = await fetch(`/api/messages/${friendId}`);
    if (res.ok) setMessages(await res.json());
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetchMessages(selected.id);
    pollRef.current = setInterval(() => fetchMessages(selected.id), 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchMessages]);

  const send = async (content: string) => {
    if (!selected || !content.trim()) return;
    setText("");
    const res = await fetch(`/api/messages/${selected.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages(p => [...p, msg]);
    }
  };

  const notifyTyping = () => {
    if (!selected || !myId) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 1500) return;
    lastTypingEmitRef.current = now;
    getSocket().emit("typing", { to: selected.id, from: myId });
  };

  const toggleLike = async (m: Msg) => {
    if (!selected) return;
    const liked = !m.liked;
    setMessages(p => p.map(x => x.id === m.id ? { ...x, liked } : x));
    if (liked) {
      setReactingId(m.id);
      setTimeout(() => setReactingId(id => (id === m.id ? null : id)), 700);
    }
    await fetch(`/api/messages/${selected.id}/${m.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liked }),
    });
  };

  const inviteToGame = () => {
    if (!selected) return;
    setInviting(true);
    const displayName = session?.user?.name || (session?.user as any)?.username || "Player";
    const s = getSocket();
    s.emit("create-room", { hostName: displayName });
    s.once("room-created", async (room: any) => {
      sessionStorage.setItem("playerId", s.id!);
      sessionStorage.setItem("playerName", displayName);
      const res = await fetch(`/api/messages/${selected.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "INVITE", roomCode: room.code }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(p => [...p, msg]);
      }
      router.push(`/room/${room.code}`);
    });
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="page">
        <div className="glass" style={{ padding: "32px 40px" }}>
          <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <img src="/friends-bg.webp" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none", objectFit: "cover", objectPosition: "center",
      }}/>

      <div className="page" style={{ justifyContent: "flex-start", paddingTop: 84, paddingBottom: 60 }}>
      <TopBar />
      <div style={{ width: "100%", maxWidth: 840, display: "flex", flexDirection: "column", gap: 16 }}>

        <h1 style={{ fontFamily: "'Pinyon Script', cursive", fontSize: "clamp(2.5rem, 6vw, 4rem)", color: "var(--text-dark)", lineHeight: 0.9, margin: 0 }}>
          Friends &amp; Messages
        </h1>

        <div className="rule" />

        {/* One window — friends on the left, chat on the right, account
           search tucked into a corner icon instead of its own panel. */}
        <div className="glass" style={{ padding: 0, display: "flex", flexDirection: "column", height: 520, overflow: "hidden" }}>

          {/* Corner search */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 14px 0" }}>
            <div ref={searchRef} style={{ position: "relative" }}>
              <button
                onClick={() => setSearchOpen(o => !o)}
                title="Search accounts"
                style={{
                  width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
                  border: "1px solid rgba(30,26,20,0.12)",
                  background: searchOpen ? "rgba(30,26,20,0.08)" : "rgba(255,255,255,0.55)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, color: "var(--text-dark)", transition: "background 0.15s ease",
                }}
              >
                🔍
              </button>
              {searchOpen && (
                <div className="aero-panel" style={{
                  position: "absolute", top: 38, right: 0, width: 260, borderRadius: 12,
                  padding: 16, textAlign: "left", zIndex: 5, animation: "fadeIn 0.18s ease",
                }}>
                  <label style={lbl}>Search accounts</label>
                  <input
                    autoFocus
                    value={query} onChange={e => { setQuery(e.target.value); setAddError(""); }}
                    placeholder="search by username"
                  />
                  {addError && <p style={{ color: "var(--danger)", fontSize: 12, fontStyle: "italic", marginTop: 8 }}>{addError}</p>}
                  {results.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12, maxHeight: 220, overflowY: "auto" }}>
                      {results.map(u => (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <Avatar user={u} size={28}/>
                            <span style={{ fontSize: 13, color: "var(--text-dark)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.username}</span>
                          </div>
                          <button className="btn-glow" onClick={() => sendRequest(u.username)} style={{ padding: "6px 14px", fontSize: 11, flexShrink: 0 }}>Add</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {/* Left — pending requests + friends list */}
            <div style={{ width: 240, flexShrink: 0, borderRight: "1px solid rgba(242,236,227,0.08)", padding: "8px 16px 16px", overflowY: "auto" }}>
              {(incoming.length > 0 || outgoing.length > 0) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                  {incoming.length > 0 && (
                    <div>
                      <label style={lbl}>Requests for you</label>
                      {incoming.map(p => (
                        <div key={p.friendshipId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <Avatar user={p.user} size={24}/>
                            <span style={{ fontSize: 12, color: "var(--text-dark)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.user.username}</span>
                          </div>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button className="btn-glow" onClick={() => accept(p.friendshipId)} style={{ padding: "4px 8px", fontSize: 10 }}>Accept</button>
                            <button onClick={() => removeFriendship(p.friendshipId)} style={{
                              background: "transparent", border: "1px solid rgba(200,30,30,0.2)", color: "rgba(200,30,30,0.6)",
                              padding: "4px 8px", cursor: "pointer", fontFamily: "'Cormorant Garamond', serif", fontSize: 10,
                            }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {outgoing.length > 0 && (
                    <div>
                      <label style={lbl}>Sent requests</label>
                      {outgoing.map(p => (
                        <div key={p.friendshipId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <Avatar user={p.user} size={24}/>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.user.username}</span>
                          </div>
                          <span style={{ fontSize: 10, color: "var(--text-faint)", fontStyle: "italic", flexShrink: 0 }}>pending…</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label style={lbl}>Friends ({friends.length})</label>
              {loading ? (
                <p style={{ color: "var(--text-faint)", fontStyle: "italic", fontSize: 12 }}>Loading…</p>
              ) : friends.length === 0 ? (
                <p style={{ color: "var(--text-faint)", fontStyle: "italic", fontSize: 12 }}>No friends yet — use the search icon above</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {friends.map(f => (
                    <button key={f.id} onClick={() => setSelected(f)} onMouseDown={e => e.preventDefault()} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 6px",
                      background: selected?.id === f.id ? "rgba(30,26,20,0.06)" : "transparent",
                      border: "none", cursor: "pointer", textAlign: "left", borderRadius: 4,
                    }}>
                      <Avatar user={f} size={28}/>
                      <span style={{ fontSize: 13, color: "var(--text-dark)" }}>{f.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right — chat, old glossy-blue Instagram DM chrome */}
            <div style={{ flex: 1, minWidth: 300, display: "flex", flexDirection: "column" }}>
            {!selected ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "var(--text-faint)", fontStyle: "italic", fontSize: 13 }}>
                  Pick a friend to start chatting
                </p>
              </div>
            ) : (
              <>
                <div className="ig-header">
                  <button className="ig-icon-btn" onClick={() => setSelected(null)} title="Back">‹</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center", minWidth: 0 }}>
                    <Avatar user={selected} size={30}/>
                    <div style={{ minWidth: 0 }}>
                      <div className="ig-header__name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.username}</div>
                      {friendTyping && <div className="ig-header__status">typing…</div>}
                    </div>
                  </div>
                  <button className="ig-icon-btn" onClick={inviteToGame} disabled={inviting} title="Invite to game">
                    <img src="/wheels-cd-icon.png" alt="" style={{ width: 17, height: 17, borderRadius: "50%" }}/>
                  </button>
                  <button className="ig-icon-btn" onClick={() => fetchMessages(selected.id)} title="Refresh">⟳</button>
                </div>
                <div className="ig-thread" style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {messages.map((m, i) => {
                    const mine = m.senderId === myId;
                    const isLastMine = mine && i === messages.length - 1;
                    if (m.type === "INVITE") {
                      return (
                        <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                          <a href={`/join/${m.roomCode}`} className="btn-glow" style={{
                            display: "block", textDecoration: "none", textAlign: "center", padding: "10px 16px", fontSize: 12,
                          }}>
                            ▶ Join game — room {m.roomCode}
                          </a>
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                        <div
                          className={`ig-bubble ${mine ? "ig-bubble--mine" : "ig-bubble--theirs"}`}
                          onDoubleClick={() => toggleLike(m)}
                        >
                          {m.content}
                          {m.liked && (
                            <span className={`ig-heart-badge ${mine ? "ig-heart-badge--mine" : "ig-heart-badge--theirs"}`}>❤️</span>
                          )}
                          {reactingId === m.id && <span className="ig-heart-pop">❤️</span>}
                        </div>
                        {isLastMine && m.readAt && (
                          <div style={{ textAlign: "right", fontSize: 10, color: "var(--text-faint)", marginTop: 3, fontFamily: "var(--font-ui)" }}>Seen</div>
                        )}
                      </div>
                    );
                  })}
                  {friendTyping && (
                    <div style={{ alignSelf: "flex-start" }}>
                      <div className="ig-bubble ig-bubble--theirs">
                        <span className="ig-typing-dots"><span/><span/><span/></span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="ig-input-bar">
                  <input
                    value={text}
                    onChange={e => { setText(e.target.value); notifyTyping(); }}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), send(text))}
                    placeholder="Message..."
                  />
                  {text.trim() ? (
                    <button className="ig-send-btn" onClick={() => send(text)} title="Send">➤</button>
                  ) : (
                    <button className="ig-send-btn ig-send-btn--heart" onClick={() => send("❤️")} title="Send a heart">❤️</button>
                  )}
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
