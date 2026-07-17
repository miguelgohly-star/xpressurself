import type { Metadata } from "next";
import "./globals.css";
import { SessionProviderWrapper } from "./session-provider";

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
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
