import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { currentUserId, unauthorized } from "@/lib/api";

type Row = { date: string; title: string; description: string; done: boolean; createdAt: Date; updatedAt: Date };

/**
 * One cell. A value a spreadsheet would read as a formula (=, +, -, @, a tab or a return first) gets a leading quote, so
 * a task title pasted from somewhere can never run as one when the file is opened.
 */
const cell = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** All of the person's tasks as a CSV file (opens in any spreadsheet). */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const rows = await sql<Row[]>`
    select date::text as date, title, description, done, created_at as "createdAt", updated_at as "updatedAt"
    from tasks where user_id = ${userId}
    order by date, created_at`;
  const lines = [
    "date,title,notes,done,created,updated",
    ...rows.map((r) => [r.date, cell(r.title), cell(r.description), r.done ? "yes" : "no", r.createdAt.toISOString(), r.updatedAt.toISOString()].join(",")),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  // The byte-order mark makes Excel read the file as UTF-8.
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hyperanchor-tasks-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
