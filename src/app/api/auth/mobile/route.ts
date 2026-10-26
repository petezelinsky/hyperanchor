import { NextResponse, type NextRequest } from "next/server";
import { badRequest } from "@/lib/api";
import { verifyAppleIdToken, verifyGoogleIdToken, type Identity } from "@/lib/identity";
import { signMobileToken } from "@/lib/mobileToken";
import type { AppUser } from "@/lib/types";

/**
 * Sign-in for the iOS app: `{ provider: "google" | "apple", idToken, nonce?, name? }` → `{ token, user }`.
 * The provider's ID token is verified against its public keys; the user id has the web's format
 * (`google:<sub>`, `apple:<sub>`), so the app and the site see the same tasks. Providers are never merged by email.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const provider = body?.provider;
  if (provider !== "google" && provider !== "apple") return badRequest("Invalid provider");
  if (typeof body.idToken !== "string" || !body.idToken) return badRequest("Missing idToken");
  const nonce = typeof body.nonce === "string" && body.nonce ? body.nonce : undefined;

  let identity: Identity;
  try {
    identity = provider === "google" ? await verifyGoogleIdToken(body.idToken, nonce) : await verifyAppleIdToken(body.idToken, nonce);
  } catch {
    return NextResponse.json({ error: "Invalid sign-in token" }, { status: 401 });
  }

  // Apple shares the name only on the first sign-in, in the app; it arrives separately.
  const given = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const user: AppUser = { name: identity.name || given || identity.email, email: identity.email, image: identity.image };
  const token = await signMobileToken(`${provider}:${identity.sub}`, user);
  return NextResponse.json({ token, user });
}
