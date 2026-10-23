import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { badRequest, currentUserId, unauthorized, TASK_COLUMNS } from "@/lib/api";
import { isDate, isUuid, parsePatch } from "@/lib/validate";
import type { Task } from "@/lib/types";

const MAX_RANGE_DAYS = 800; // a year plus the previous one, for analytics comparisons

export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isDate(from) || !isDate(to) || from > to) return badRequest("Invalid range");
  if ((Date.parse(to) - Date.parse(from)) / 864e5 > MAX_RANGE_DAYS) return badRequest("Range is too large");

  const tasks = await sql<Task[]>`
    select ${sql.unsafe(TASK_COLUMNS)} from tasks
    where user_id = ${userId} and date between ${from} and ${to}
    order by created_at`;
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!isUuid(body?.id)) return badRequest("Invalid id");
  const parsed = parsePatch(body);
  if ("error" in parsed) return badRequest(parsed.error);
  const { title, description = "", date, done = false } = parsed.patch;
  if (!title || !date) return badRequest("Title and date are required");

  const [task] = await sql<Task[]>`
    insert into tasks (id, user_id, date, title, description, done)
    values (${body.id}, ${userId}, ${date}, ${title}, ${description}, ${done})
    on conflict (id) do nothing
    returning ${sql.unsafe(TASK_COLUMNS)}`;
  if (!task) return NextResponse.json({ error: "Task already exists" }, { status: 409 });
  return NextResponse.json({ task }, { status: 201 });
}
