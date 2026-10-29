import { createHash } from "node:crypto";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";

// Sign-in tokens from Google and Apple (for the iOS app), and the Apple REST calls the server makes
// on the user's behalf: exchanging an authorization code and revoking tokens when an account is deleted.

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const APPLE_ISSUER = "https://appleid.apple.com";

/** The iOS app's bundle ID: the `aud` of Apple tokens issued to the app, and its Apple client ID. */
export const appleBundleId = () => process.env.APPLE_BUNDLE_ID || "app.hyperanchor";

export type Identity = { sub: string; email: string; name: string | null; image: string | null };

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Verifies a Google ID token issued to the iOS or the web OAuth client. */
export async function verifyGoogleIdToken(idToken: string, nonce?: string): Promise<Identity> {
  const audience = [process.env.GOOGLE_IOS_CLIENT_ID, process.env.AUTH_GOOGLE_ID].filter((v): v is string => !!v);
  if (!audience.length) throw new Error("Google sign-in is not configured");
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience,
  });
  if (nonce && payload.nonce !== nonce) throw new Error("Nonce mismatch");
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Missing subject");
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    name: typeof payload.name === "string" ? payload.name : null,
    image: typeof payload.picture === "string" ? payload.picture : null,
  };
}

/** Verifies an Apple identity token issued to the iOS app (`aud` = bundle ID). The app sends the raw nonce; Apple signs its SHA-256. */
export async function verifyAppleIdToken(idToken: string, nonce?: string): Promise<Identity> {
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, { issuer: APPLE_ISSUER, audience: appleBundleId() });
  if (nonce && payload.nonce !== sha256(nonce)) throw new Error("Nonce mismatch");
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Missing subject");
  return { sub: payload.sub, email: typeof payload.email === "string" ? payload.email : "", name: null, image: null };
}

// ── Apple client secret ────────────────────────────────────────────────────────

const secrets = new Map<string, { value: string; expires: number }>();

/** Whether a signing key for Apple's REST API is configured (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY). */
export const appleKeyConfigured = () => !!(process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY);

/**
 * The client secret Apple expects: a short-lived ES256 JWT signed with the team's Sign in with Apple key.
 * Falls back to a pre-generated AUTH_APPLE_SECRET (web Services ID only) when no key is configured.
 */
export async function appleClientSecret(clientId: string): Promise<string | null> {
  if (!appleKeyConfigured()) return clientId === process.env.AUTH_APPLE_ID ? (process.env.AUTH_APPLE_SECRET ?? null) : null;
  const cached = secrets.get(clientId);
  if (cached && cached.expires > Date.now() + 60_000) return cached.value;
  // Env files often store the PEM on one line with literal \n.
  const pem = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  const lifetime = 60 * 60 * 24; // a day; regenerated as needed
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setSubject(clientId)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${lifetime}s`)
    .sign(key);
  secrets.set(clientId, { value, expires: Date.now() + lifetime * 1000 });
  return value;
}

async function appleRequest(path: string, clientId: string, params: Record<string, string>) {
  const secret = await appleClientSecret(clientId);
  if (!secret) throw new Error("Sign in with Apple is not configured on the server");
  const res = await fetch(`${APPLE_ISSUER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: secret, ...params }),
  });
  if (!res.ok) throw new Error(`Apple ${path} failed (${res.status})`);
  return res;
}

/** Exchanges an authorization code from the iOS app for Apple tokens; returns the refresh token. */
export async function exchangeAppleCode(code: string): Promise<string> {
  const res = await appleRequest("/auth/token", appleBundleId(), { code, grant_type: "authorization_code" });
  const body = (await res.json()) as { refresh_token?: string; access_token?: string };
  const token = body.refresh_token ?? body.access_token;
  if (!token) throw new Error("Apple returned no token");
  return token;
}

/** Revokes an Apple refresh token, so the app no longer appears under the user's Apple ID. */
export async function revokeAppleToken(token: string, clientId: string) {
  await appleRequest("/auth/revoke", clientId, { token, token_type_hint: "refresh_token" });
}
