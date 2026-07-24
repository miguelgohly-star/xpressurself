import Link from "next/link";
import TopBar from "@/components/TopBar";

export const metadata = {
  title: "Page Not Found — xpressurself",
};

export default function NotFound() {
  return (
    <div className="page" style={{ paddingTop: 152 }}>
      <TopBar />
      <img
        src="/404.png"
        alt="404 — page not found. Never stop searching for it."
        style={{ width: "100%", maxWidth: 880, height: "auto" }}
      />
      <Link href="/" className="btn-glow" style={{ marginTop: 20, textDecoration: "none", display: "inline-block" }}>
        Back to xpressurself
      </Link>
    </div>
  );
}
