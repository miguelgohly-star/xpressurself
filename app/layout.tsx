import type { Metadata } from "next";
import "./globals.css";
import { SessionProviderWrapper } from "./session-provider";
import { GlassFilter } from "@/components/ui/liquid-glass";

export const metadata: Metadata = {
  title: "xpressurself — Song Wars",
  description: "The creative music battle party game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Yellowtail&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* Hidden SVG filter def powering the liquid-glass refraction on
            the top bar (and anything else using `filter: url(#glass-distortion)`) —
            rendered once, globally, so every page can reference it. */}
        <GlassFilter />
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
