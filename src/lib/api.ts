import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyMobileToken } from "./mobileToken";

/** The signed-in user: the iOS app sends `Authorization: Bearer <token>`, the web its Auth.js session cookie. */
export async function currentUserId(): Promise<string | null> {
  const authorization = (await headers()).get("authorization");
  // A bearer token decides on its own: an invalid one never falls back to a cookie.
  if (authorization?.toLowerCase().startsWith("bearer ")) return verifyMobileToken(authorization.slice(7).trim());
  const session = await auth();
  return session?.user?.id ?? null;
}

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export const TASK_COLUMNS = `id, date::text as date, title, description, done, created_at as "createdAt", updated_at as "updatedAt"`;
