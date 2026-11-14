import type { NextConfig } from "next";

const prod = process.env.NODE_ENV === "production";
/** Where signing in goes after the sign-in form: Google and Apple's own pages. */
const signIn = "https://accounts.google.com https://appleid.apple.com";

/**
 * A full content policy, reported (in the browser's console) rather than enforced while it proves itself: once it has
 * run quietly everywhere (voice, the AI summary and its lens, signing in, both themes), it can be enforced.
 */
const policy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${signIn}`,
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // The microphone for this site only (speaking tasks); nothing else a page could ask for.
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), display-capture=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Enforced now: no framing, no plugins, no other base, and forms only to here and the sign-in pages.
          { key: "Content-Security-Policy", value: `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' ${signIn}` },
          ...(prod
            ? [
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
                { key: "Content-Security-Policy-Report-Only", value: policy },
              ]
            : []),
        ],
      },
      // What the API answers is the person's own: never kept by a browser or a proxy.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
