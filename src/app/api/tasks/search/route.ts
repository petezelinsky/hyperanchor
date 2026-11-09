import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { badRequest, currentUserId, unauthorized, TASK_COLUMNS } from "@/lib/api";
import type { Task } from "@/lib/types";

const LIMIT = 50;

/** Every task of the person whose title or notes contain `q`, newest dates first. */
export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length > 200) return badRequest("Invalid query");
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const tasks = await sql<Task[]>`
    select ${sql.unsafe(TASK_COLUMNS)} from tasks
    where user_id = ${userId} and (title ilike ${like} or description ilike ${like})
    order by date desc, created_at desc
    limit ${LIMIT}`;
  return NextResponse.json({ tasks });
}
