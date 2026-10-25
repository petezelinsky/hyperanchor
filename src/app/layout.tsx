import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PREFS_BOOT } from "@/components/prefs";
import "./globals.css";

// SF Pro is used on Apple devices; Inter is the closest match elsewhere.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://hyperanchor.app"),
  title: "Hyperanchor",
  description:
    "A calm, focused planner. Plan each day in a clean table, see your week and month at a glance, and understand how you get things done.",
  openGraph: {
    title: "Hyperanchor",
    description: "Your whole week on one screen.",
    url: "https://hyperanchor.app",
    siteName: "Hyperanchor",
    type: "website",
  },
};

// theme-color follows the chosen theme; PREFS_BOOT sets it.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The boot script sets data-theme / data-accent on <html> before React hydrates.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
