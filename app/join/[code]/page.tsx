"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";

export default function JoinRedirect() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    // Pre-fill the join tab with the code by redirecting to the play page with a query param
    router.replace(`/play?join=${code}`);
  }, [code, router]);

  return (
    <div className="page">
      <TopBar />
      <div className="glass p-8 text-center">
        <p style={{ color: "var(--text-secondary)" }}>Joining room {code}…</p>
      </div>
    </div>
  );
}
