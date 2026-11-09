import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema } from "./db";

export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id ?? null;
  if (id) await ensureSchema();
  return id;
}

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export const TASK_COLUMNS = `id, date::text as date, title, description, done, "position", created_at as "createdAt", updated_at as "updatedAt"`;
