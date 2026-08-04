"use client";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.25em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  display: "block",
  marginBottom: 10,
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-faint)",
  fontStyle: "italic",
  marginTop: 6,
  fontFamily: "'Cormorant Garamond', serif",
};

function Divider({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, height: 1, background: "rgba(242,236,227,0.08)" }} />
      <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--text-faint)", fontFamily: "'Cormorant Garamond', serif" }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(242,236,227,0.08)" }} />
    </div>
  );
}

function SocialBtn({ icon, label: lbl, onClick, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      width: "100%", padding: "11px 20px",
      background: "transparent", border: "1px solid rgba(242,236,227,0.12)",
      color: disabled ? "var(--text-faint)" : "var(--cream-dim)",
      fontSize: 13, fontFamily: "'Cormorant Garamond', serif", fontWeight: 300,
      letterSpacing: "0.08em", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.3s",
    }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = "rgba(242,236,227,0.3)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(242,236,227,0.12)"; }}
    >
      {icon}
      <span>{lbl}</span>
      {disabled && <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-faint)", marginLeft: "auto" }}>AT LAUNCH</span>}
    </button>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [tab, setTab] = useState<"signin" | "register">(
    searchParams.get("tab") === "register" ? "register" : "signin"
  );

  // Sign-in fields
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Register fields
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  // Lock the page — no vertical scroll while on the auth tab
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

  const clearErrors = () => { setFieldError({}); setGlobalError(""); };

  const handleSignIn = async () => {
    if (!siEmail || !siPassword) return setGlobalError("Please fill all fields");
    setLoading(true); clearErrors();
    const res = await signIn("credentials", { email: siEmail, password: siPassword, redirect: false });
    setLoading(false);
    if (res?.error) return setGlobalError("Invalid email or password");
    router.push(callbackUrl);
  };

  const handleRegister = async () => {
    clearErrors();
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = "Username required";
    if (!regEmail.trim()) errs.email = "Email required";
    if (!regPassword) errs.password = "Password required";
    if (Object.keys(errs).length) return setFieldError(errs);

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), nickname: nickname.trim() || null, email: regEmail.trim(), password: regPassword }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { /* non-json body */ }
      if (!res.ok) {
        setLoading(false);
        if (data.field) return setFieldError({ [data.field]: data.error });
        return setGlobalError(data.error || "Something went wrong. Please try again.");
      }
      const signInRes = await signIn("credentials", { email: regEmail.trim(), password: regPassword, redirect: false });
      setLoading(false);
      if (signInRes?.error) { setSuccess("Account created! Please sign in."); setTab("signin"); return; }
      router.push(callbackUrl);
    } catch (err) {
      setLoading(false);
      setGlobalError("Network error — please check your connection and try again.");
    }
  };

  return (
    <>
      <img src="/profile-bg.webp" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none", objectFit: "cover", objectPosition: "center",
      }}/>

      <div className="page" style={{ paddingTop: 152, justifyContent: "flex-start" }}>
      <TopBar />

      <div className="glass animate-fade-in w-full" style={{ maxWidth: 400, padding: "36px 32px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", marginBottom: 32, borderBottom: "1px solid rgba(242,236,227,0.08)" }}>
          {(["signin", "register"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); clearErrors(); setSuccess(""); }}
              style={{
                flex: 1, padding: "9px 0", border: "none",
                borderBottom: tab === t ? "1px solid rgba(242,236,227,0.5)" : "1px solid transparent",
                marginBottom: -1, background: "transparent",
                color: tab === t ? "var(--cream)" : "var(--text-secondary)",
                fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
                fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, cursor: "pointer", transition: "all 0.3s",
              }}>
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {success && <p style={{ color: "var(--cream-dim)", fontSize: 13, textAlign: "center", marginBottom: 16, fontStyle: "italic" }}>{success}</p>}

        {tab === "signin" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input value={siEmail} onChange={e => { setSiEmail(e.target.value); clearErrors(); }} placeholder="you@example.com" type="email" />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input value={siPassword} onChange={e => { setSiPassword(e.target.value); clearErrors(); }} placeholder="••••••••" type="password"
                onKeyDown={e => e.key === "Enter" && handleSignIn()} />
            </div>
            {globalError && <p style={{ color: "var(--danger)", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>{globalError}</p>}
            <button className="btn-glow" onClick={handleSignIn} disabled={loading} style={{ width: "100%", marginTop: 4 }}>
              {loading ? "…" : "Sign In"}
            </button>
            <Divider text="or" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SocialBtn icon={<GoogleIcon />} label="Continue with Google" disabled onClick={() => signIn("google", { callbackUrl })} />
              <SocialBtn icon={<AppleIcon />} label="Continue with Apple" disabled />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Username */}
            <div>
              <label style={labelStyle}>Username</label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: 2, top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-faint)", fontSize: 15, pointerEvents: "none",
                  fontFamily: "'Cormorant Garamond', serif",
                }}>@</span>
                <input
                  value={username}
                  onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); clearErrors(); }}
                  placeholder="your_handle"
                  maxLength={20}
                  style={{ paddingLeft: 18 }}
                />
              </div>
              {fieldError.username
                ? <p style={{ ...hintStyle, color: "var(--danger)", fontStyle: "normal" }}>{fieldError.username}</p>
                : <p style={hintStyle}>3–20 chars · letters, numbers, underscores · permanent</p>
              }
            </div>

            {/* Nickname */}
            <div>
              <label style={labelStyle}>Nickname <span style={{ color: "var(--text-faint)", fontSize: 9 }}>optional</span></label>
              <input
                value={nickname}
                onChange={e => { setNickname(e.target.value); clearErrors(); }}
                placeholder="How you want to appear in games"
                maxLength={30}
              />
              <p style={hintStyle}>Shown to other players instead of your username — you can change this anytime</p>
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email</label>
              <input value={regEmail} onChange={e => { setRegEmail(e.target.value); clearErrors(); }} placeholder="you@example.com" type="email" />
              {fieldError.email && <p style={{ ...hintStyle, color: "var(--danger)", fontStyle: "normal" }}>{fieldError.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <input value={regPassword} onChange={e => { setRegPassword(e.target.value); clearErrors(); }} placeholder="min. 6 characters" type="password"
                onKeyDown={e => e.key === "Enter" && handleRegister()} />
              {fieldError.password && <p style={{ ...hintStyle, color: "var(--danger)", fontStyle: "normal" }}>{fieldError.password}</p>}
            </div>

            {globalError && <p style={{ color: "var(--danger)", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>{globalError}</p>}

            <button className="btn-glow" onClick={handleRegister} disabled={loading} style={{ width: "100%", marginTop: 4 }}>
              {loading ? "…" : "Create Account"}
            </button>
            <Divider text="or" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SocialBtn icon={<GoogleIcon />} label="Continue with Google" disabled onClick={() => signIn("google", { callbackUrl })} />
              <SocialBtn icon={<AppleIcon />} label="Continue with Apple" disabled />
            </div>
          </div>
        )}
      </div>
      <p style={{ color: "var(--text-faint)", fontSize: 10, marginTop: 28, letterSpacing: "0.15em", fontFamily: "'Cormorant Garamond', serif" }}>
        Google & Apple sign-in available at full launch
      </p>
      </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgba(242,236,227,0.35)" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(242,236,227,0.3)" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="rgba(242,236,227,0.25)" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(242,236,227,0.3)" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(242,236,227,0.35)">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}
