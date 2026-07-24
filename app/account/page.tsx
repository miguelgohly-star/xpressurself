"use client";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";

const label: React.CSSProperties = {
  fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase",
  color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300, display: "block", marginBottom: 10,
};
const hint: React.CSSProperties = {
  fontSize: 11, color: "var(--text-faint)", fontStyle: "italic",
  marginTop: 6, fontFamily: "'Cormorant Garamond', serif",
};
const errStyle: React.CSSProperties = {
  fontSize: 11, color: "rgba(200,30,30,0.85)", marginTop: 6,
  fontFamily: "'Cormorant Garamond', serif",
};
const ok: React.CSSProperties = {
  fontSize: 11, color: "rgba(160,200,140,0.85)", marginTop: 6,
  fontFamily: "'Cormorant Garamond', serif",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid rgba(242,236,227,0.07)", paddingTop: 28, marginTop: 28 }}>
      <p style={{ fontSize: 9, letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--text-faint)", fontFamily: "'Cormorant Garamond', serif", marginBottom: 22 }}>{title}</p>
      {children}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function AccountPage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();

  // Redirect if not signed in
  useEffect(() => {
    if (session === null) router.push("/auth?callbackUrl=/account");
  }, [session, router]);

  // Lock the page — no vertical scroll while on the account tab
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

  const username = (session?.user as any)?.username ?? "";
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameMsg, setUsernameMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);

  const [nickname, setNickname] = useState(session?.user?.name ?? "");
  const [nicknameMsg, setNicknameMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [nicknameLoading, setNicknameLoading] = useState(false);

  const [bio, setBio] = useState("");
  const [bioMsg, setBioMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const initialised = useRef(false);

  // Auto-grow the bio field to fit its content instead of reserving fixed rows.
  // Re-measures after the web font finishes loading too — a fallback-font
  // measurement taken before the swap can otherwise lock in the wrong height.
  useEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    resize();
    document.fonts?.ready?.then(resize);
  }, [bio]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"nickname" | "password" | "username">("nickname");

  // Populate from session only on first load — don't overwrite local state on re-renders
  useEffect(() => {
    if (session?.user && !initialised.current) {
      initialised.current = true;
      setUsernameInput((session.user as any).username ?? "");
      setNickname(session.user.name ?? "");
      setAvatar(session.user.image ?? null);
    }
  }, [session]);

  // Fetch bio from DB (not in session by default)
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/account/bio").then(r => r.ok ? r.json() : null).then(d => { if (d?.bio) setBio(d.bio); });
  }, [session?.user?.id]);

  const saveBio = async () => {
    setBioLoading(true); setBioMsg(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    });
    const data = await res.json();
    setBioLoading(false);
    if (!res.ok) return setBioMsg({ text: data.error, ok: false });
    setBioMsg({ text: "Bio saved", ok: true });
  };

  const saveUsername = async () => {
    setUsernameLoading(true); setUsernameMsg(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput }),
    });
    const data = await res.json();
    setUsernameLoading(false);
    if (!res.ok) return setUsernameMsg({ text: data.error, ok: false });
    setUsernameInput(data.username);
    await updateSession({ username: data.username });
    setUsernameMsg({ text: "Username saved", ok: true });
  };

  const saveNickname = async () => {
    setNicknameLoading(true); setNicknameMsg(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    const data = await res.json();
    setNicknameLoading(false);
    if (!res.ok) return setNicknameMsg({ text: data.error, ok: false });
    await updateSession({ name: data.name });
    setNicknameMsg({ text: "Nickname saved", ok: true });
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (newPw !== confirmPw) return setPwMsg({ text: "Passwords don't match", ok: false });
    if (newPw.length < 6) return setPwMsg({ text: "Password must be at least 6 characters", ok: false });
    setPwLoading(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    const data = await res.json();
    setPwLoading(false);
    if (!res.ok) return setPwMsg({ text: data.error, ok: false });
    setCurPw(""); setNewPw(""); setConfirmPw("");
    setPwMsg({ text: "Password updated", ok: true });
  };

  const uploadAvatar = async (file: File) => {
    setAvatarLoading(true); setAvatarMsg(null);
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch("/api/account/avatar", { method: "POST", body: form });
    const data = await res.json();
    setAvatarLoading(false);
    if (!res.ok) return setAvatarMsg({ text: data.error, ok: false });
    setAvatar(data.image);
    await updateSession({ image: data.image });
    setAvatarMsg({ text: "Photo updated", ok: true });
  };

  if (!session) return null;

  const displayName = session.user?.name || username;

  return (
    <>
      <img src="/profile-bg.webp" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none", objectFit: "cover", objectPosition: "center",
      }}/>

      <div className="page" style={{ paddingTop: 152, justifyContent: "flex-start" }}>
      <TopBar />

      {/* ── Main card — wide, short: photo left, bio right ── */}
      <div className="glass animate-fade-in w-full" style={{ maxWidth: 680, padding: "36px 40px", position: "relative" }}>
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          style={{
            position: "absolute", top: 20, right: 20,
            width: 34, height: 34, borderRadius: "50%",
            background: "rgba(242,236,227,0.06)", border: "1px solid rgba(242,236,227,0.15)",
            color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.25s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(242,236,227,0.35)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(242,236,227,0.15)"; }}
        >
          <SettingsIcon />
        </button>

        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Avatar circle */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 100, height: 100, borderRadius: "50%", flexShrink: 0,
              border: "1px solid rgba(242,236,227,0.15)",
              overflow: "hidden", cursor: "pointer", position: "relative",
              background: "rgba(242,236,227,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {avatar
              ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 34, color: "var(--text-faint)", fontFamily: "'Cormorant Garamond', serif" }}>
                  {(displayName || username)?.[0]?.toUpperCase() ?? "?"}
                </span>
            }
            {/* Hover overlay */}
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0, transition: "opacity 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
            >
              <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--cream)", fontFamily: "'Cormorant Garamond', serif" }}>
                {avatarLoading ? "…" : "CHANGE"}
              </span>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
          />

          {/* Bio */}
          <div style={{ flex: "1 1 260px", minWidth: 260, paddingTop: 4 }}>
            <p style={{ fontSize: 10, letterSpacing: "0.25em", color: "var(--text-faint)", fontFamily: "'Cormorant Garamond', serif" }}>
              @{username}
            </p>
            <p style={{ fontFamily: "'Pinyon Script', cursive", fontSize: 28, color: "var(--cream)", lineHeight: 1, margin: "4px 0 18px" }}>
              {displayName || username}
            </p>
            <span style={label}>Bio</span>
            <textarea
              ref={bioRef}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Say something about yourself…"
              maxLength={200}
              rows={1}
              style={{
                width: "100%", background: "transparent",
                border: "none", borderBottom: "1px solid rgba(242,236,227,0.15)",
                color: "var(--cream)", fontFamily: "'Cormorant Garamond', serif",
                fontSize: 15, fontStyle: "italic", padding: "8px 0", resize: "none",
                outline: "none", letterSpacing: "0.04em", lineHeight: 1.6, overflow: "hidden",
                fieldSizing: "content",
              } as React.CSSProperties}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, gap: 12 }}>
              <div>
                {avatarMsg && <p style={avatarMsg.ok ? ok : errStyle}>{avatarMsg.text}</p>}
                {bioMsg && <p style={bioMsg.ok ? ok : errStyle}>{bioMsg.text}</p>}
              </div>
              <p style={{ ...hint, textAlign: "right", flexShrink: 0 }}>{bio.length}/200</p>
            </div>
            <button className="btn-glow" onClick={saveBio} disabled={bioLoading} style={{ marginTop: 14, padding: "8px 24px" }}>
              {bioLoading ? "…" : "Save Bio"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Settings modal — nickname, password, session ── */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(20,16,10,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            className="glass"
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto", padding: "32px 32px 36px", position: "relative" }}
          >
            <button
              onClick={() => setSettingsOpen(false)}
              title="Close"
              style={{
                position: "absolute", top: 18, right: 18,
                width: 28, height: 28, borderRadius: "50%",
                background: "transparent", border: "1px solid rgba(242,236,227,0.15)",
                color: "var(--text-secondary)", fontSize: 14, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              ✕
            </button>

            <p style={{ fontFamily: "'Pinyon Script', cursive", fontSize: 28, color: "var(--cream)", marginBottom: 4 }}>Settings</p>

            {/* ── Tab strip — nickname / password / username ── */}
            <div style={{ display: "flex", gap: 4, marginTop: 22, borderBottom: "1px solid rgba(242,236,227,0.1)" }}>
              {([
                { id: "nickname", label: "Nickname" },
                { id: "password", label: "Password" },
                { id: "username", label: "Username" },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setSettingsTab(t.id)}
                  style={{
                    flex: 1, background: "none", border: "none", cursor: "pointer",
                    padding: "0 0 10px", fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase",
                    color: settingsTab === t.id ? "var(--cream)" : "var(--text-faint)",
                    borderBottom: settingsTab === t.id ? "1.5px solid var(--cream)" : "1.5px solid transparent",
                    marginBottom: -1, transition: "color 0.2s ease, border-color 0.2s ease",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {settingsTab === "nickname" && (
              <div style={{ paddingTop: 24 }}>
                <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="How others see you in games" maxLength={30} />
                <p style={hint}>Shown instead of @{username} during games</p>
                {nicknameMsg && <p style={nicknameMsg.ok ? ok : errStyle}>{nicknameMsg.text}</p>}
                <button className="btn-glow" onClick={saveNickname} disabled={nicknameLoading} style={{ width: "100%", marginTop: 14 }}>
                  {nicknameLoading ? "…" : "Save Nickname"}
                </button>
              </div>
            )}

            {settingsTab === "password" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 24 }}>
                <div>
                  <span style={label}>Current Password</span>
                  <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="••••••••" />
                </div>
                <div>
                  <span style={label}>New Password</span>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="min. 6 characters" />
                </div>
                <div>
                  <span style={label}>Confirm New Password</span>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••"
                    onKeyDown={e => e.key === "Enter" && changePassword()} />
                </div>
                {pwMsg && <p style={pwMsg.ok ? ok : errStyle}>{pwMsg.text}</p>}
                <button className="btn-glow" onClick={changePassword} disabled={pwLoading} style={{ width: "100%" }}>
                  {pwLoading ? "…" : "Update Password"}
                </button>
              </div>
            )}

            {settingsTab === "username" && (
              <div style={{ paddingTop: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--text-faint)", fontFamily: "'Cormorant Garamond', serif" }}>@</span>
                  <input
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value.toLowerCase())}
                    placeholder="your_handle"
                    maxLength={20}
                    onKeyDown={e => e.key === "Enter" && saveUsername()}
                  />
                </div>
                <p style={hint}>3–20 chars · lowercase letters, numbers, underscores</p>
                {usernameMsg && <p style={usernameMsg.ok ? ok : errStyle}>{usernameMsg.text}</p>}
                <button className="btn-glow" onClick={saveUsername} disabled={usernameLoading} style={{ width: "100%", marginTop: 14 }}>
                  {usernameLoading ? "…" : "Save Username"}
                </button>
              </div>
            )}

            {/* ── Sign Out ── */}
            <Section title="Session">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={hint}>{session.user?.email}</p>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  style={{
                    width: "100%", padding: "11px 0", background: "transparent",
                    border: "1px solid rgba(200,30,30,0.25)", color: "rgba(200,30,30,0.75)",
                    fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase",
                    fontFamily: "'Cormorant Garamond', serif", fontWeight: 300,
                    cursor: "pointer", transition: "all 0.3s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,30,30,0.6)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(200,30,30,1)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,30,30,0.25)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(200,30,30,0.75)";
                  }}
                >
                  Sign Out
                </button>
              </div>
            </Section>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
