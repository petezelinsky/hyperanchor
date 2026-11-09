import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PREFS_BOOT } from "@/components/prefs";
import { Tooltips } from "@/components/Tooltips";
import "./globals.css";

// SF Pro is used on Apple devices; Inter is the closest match elsewhere.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://hyperanchor.app"),
  title: "Hyperanchor",
  description: "A calm, fast planner: your day, week and month on one quiet screen, and a focus mode for one thing at a time.",
  applicationName: "Hyperanchor",
  appleWebApp: { capable: true, title: "Hyperanchor", statusBarStyle: "default" },
  twitter: { card: "summary_large_image" },
  openGraph: {
    title: "Hyperanchor",
    description: "Own your day, week and month. A calm, fast planner.",
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
      <body>
        {children}
        <Tooltips />
      </body>
    </html>
  );
}
