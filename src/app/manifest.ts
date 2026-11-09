import type { MetadataRoute } from "next";

/** Lets phones and computers install Hyperanchor as an app (home screen, dock) that opens without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hyperanchor",
    short_name: "Hyperanchor",
    description: "A calm, fast planner for your day, week and month.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
