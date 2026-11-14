import { NextResponse } from "next/server";
import { currentUserId, notFound, unauthorized } from "@/lib/api";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/validate";

/**
 * Deletes a summary from the history. Its words are erased at once; the line itself stays, emptied, with the count of
 * tasks done when it was written, so the period's next summary still waits for that many more (deleting is never a way
 * round the wait). Deleting the account removes the lines too.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const rows = await sql`
    update ai_summaries set summary = null, label = '', deleted_at = now()
    where id = ${id} and user_id = ${userId} and deleted_at is null
    returning id`;
  if (!rows.length) return notFound();
  return new NextResponse(null, { status: 204 });
}
