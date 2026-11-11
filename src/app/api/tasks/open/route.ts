import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { badRequest, currentUserId, unauthorized, TASK_COLUMNS } from "@/lib/api";
import { isDate } from "@/lib/validate";
import type { Task } from "@/lib/types";

const LIMIT = 500;

/** Every task still open before `before` (the person's today), most recent first: what Today offers to bring along. */
export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const before = req.nextUrl.searchParams.get("before") ?? "";
  if (!isDate(before)) return badRequest("Invalid date");

  const tasks = await sql<Task[]>`
    select ${sql.unsafe(TASK_COLUMNS)} from tasks
    where user_id = ${userId} and not done and date < ${before}
    order by date desc, created_at desc
    limit ${LIMIT}`;
  return NextResponse.json({ tasks });
}
