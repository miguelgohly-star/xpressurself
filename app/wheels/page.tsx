"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import WheelsManager from "@/components/WheelsManager";

export default function WheelsPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth?callbackUrl=/wheels");
  }, [status]);

  // Lock the page — no vertical scroll while on the wheels tab
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
      <img src="/my-wheels-background.webp" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none", objectFit: "cover", objectPosition: "center",
      }}/>

      <div className="page" style={{ justifyContent: "flex-start", paddingTop: 84, paddingBottom: 60 }}>
        <TopBar />
        <WheelsManager />
      </div>
    </>
  );
}
