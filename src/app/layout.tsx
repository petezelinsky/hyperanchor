import type { Metadata, Viewport } from "next";
import { Fragment_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-instrument", display: "swap" });
const mono = Fragment_Mono({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-fragment", display: "swap" });

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
