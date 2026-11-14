import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema } from "./db";
import { readMobileToken } from "./mobileToken";
import { stillValid } from "./revocations";

/** When the web session was signed in (seconds; 0 for sessions from before this was recorded). */
export const signedInAt = (session: unknown) => {
  const v = (session as { signedInAt?: unknown } | null)?.signedInAt;
  return typeof v === "number" ? v : 0;
};

/**
 * The signed-in user: the iOS app sends `Authorization: Bearer <token>`, the web its Auth.js session cookie. A request
 * that another site started (Fetch Metadata says so) never acts with the cookie, and nothing signed in before the
 * account was deleted counts any more (revocations.ts).
 */
export async function currentUserId(): Promise<string | null> {
  const h = await headers();
  const authorization = h.get("authorization");
  let id: string | null;
  let issued: number;
  // A bearer token decides on its own: an invalid one never falls back to a cookie.
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = await readMobileToken(authorization.slice(7).trim());
    id = token?.sub ?? null;
    issued = token?.iat ?? 0;
  } else {
    // The cookie travels with requests other sites make, too: only the app's own pages (or a typed address) use it.
    const site = h.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return null;
    const session = await auth();
    id = session?.user?.id ?? null;
    issued = signedInAt(session);
  }
  if (!id) return null;
  // Both clients read and write the newer columns, so the schema is brought up to date first.
  await ensureSchema();
  return (await stillValid(id, issued)) ? id : null;
}

/** JSON bodies only: a plain-text body (which a form on another site could send) is turned away. */
export const isJson = (req: Request) => (req.headers.get("content-type") ?? "").toLowerCase().includes("application/json");

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export const TASK_COLUMNS = `id, date::text as date, title, description, done, "position", created_at as "createdAt", updated_at as "updatedAt"`;
