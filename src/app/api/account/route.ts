import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { currentUserId, unauthorized } from "@/lib/api";
import { sql } from "@/lib/db";
import { exchangeAppleCode, revokeAppleToken, appleBundleId } from "@/lib/identity";

/**
 * Deletes the account: every task of the signed-in user. For Sign in with Apple the token is revoked too
 * (App Store guideline 5.1.1(v)): the iOS app sends a fresh `authorizationCode`, the web keeps Apple's
 * refresh token in its session. Data is deleted even if Apple can't be reached; `revoked` says how that went.
 */
export async function DELETE(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);

  let revoked: boolean | null = null; // null: nothing to revoke (Google)
  if (userId.startsWith("apple:")) {
    revoked = false;
    try {
      if (typeof body?.authorizationCode === "string" && body.authorizationCode) {
        await revokeAppleToken(await exchangeAppleCode(body.authorizationCode), appleBundleId());
        revoked = true;
      } else {
        const secureCookie = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
        const session = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie });
        if (typeof session?.appleRefreshToken === "string" && process.env.AUTH_APPLE_ID) {
          await revokeAppleToken(session.appleRefreshToken, process.env.AUTH_APPLE_ID);
          revoked = true;
        }
      }
    } catch (e) {
      console.error("Apple token revocation failed:", e instanceof Error ? e.message : e);
    }
  }

  const rows = await sql`delete from tasks where user_id = ${userId} returning id`;
  return NextResponse.json({ deleted: rows.length, revoked });
}
