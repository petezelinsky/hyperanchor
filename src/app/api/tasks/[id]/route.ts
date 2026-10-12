import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { badRequest, currentUserId, notFound, unauthorized, TASK_COLUMNS } from "@/lib/api";
import { isUuid, parsePatch } from "@/lib/validate";
import type { Task } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const parsed = parsePatch(await req.json().catch(() => null));
  if ("error" in parsed) return badRequest(parsed.error);
  const keys = Object.keys(parsed.patch) as (keyof typeof parsed.patch)[];
  if (!keys.length) return badRequest("Nothing to update");

  const [task] = await sql<Task[]>`
    update tasks set ${sql(parsed.patch, keys)}, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning ${sql.unsafe(TASK_COLUMNS)}`;
  if (!task) return notFound();
  return NextResponse.json({ task });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const rows = await sql`delete from tasks where id = ${id} and user_id = ${userId} returning id`;
  if (!rows.length) return notFound();
  return new NextResponse(null, { status: 204 });
}
