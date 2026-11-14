import { hkdfSync } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { AppUser } from "./types";

// Bearer tokens for the iOS app. The web keeps its Auth.js cookie session; both resolve to the same
// user id (`google:<sub>`, `apple:<sub>`), so tasks are shared between the site and the app.

const ISSUER = "https://hyperanchor.app";
const AUDIENCE = "hyperanchor-ios";
const LIFETIME = "90d";

let cachedKey: { secret: string; key: Uint8Array } | null = null;

/** HMAC key derived from AUTH_SECRET, kept separate from the key Auth.js derives for its cookies. */
function signingKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  if (cachedKey?.secret !== secret) {
    cachedKey = { secret, key: new Uint8Array(hkdfSync("sha256", secret, "", "hyperanchor mobile token v1", 32)) };
  }
  return cachedKey.key;
}

export async function signMobileToken(uid: string, user: AppUser) {
  return new SignJWT({ name: user.name, email: user.email, picture: user.image })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(uid)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(LIFETIME)
    .sign(signingKey());
}

/** The user id in a valid, unexpired token, and when the token was issued (seconds); null otherwise. */
export async function readMobileToken(token: string): Promise<{ sub: string; iat: number } | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    return typeof payload.sub === "string" && payload.sub ? { sub: payload.sub, iat: typeof payload.iat === "number" ? payload.iat : 0 } : null;
  } catch {
    return null;
  }
}

/** The user id in a valid, unexpired token; null otherwise. */
export async function verifyMobileToken(token: string): Promise<string | null> {
  return (await readMobileToken(token))?.sub ?? null;
}
