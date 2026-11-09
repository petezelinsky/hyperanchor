import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { badRequest, currentUserId, unauthorized } from "@/lib/api";

/** Deletes the person's tasks and profile for good. The client signs out right after. */
export async function DELETE(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  if (body?.confirm !== "delete") return badRequest("Confirmation required");

  await sql.begin(async (tx) => {
    await tx`delete from tasks where user_id = ${userId}`;
    await tx`delete from users where id = ${userId}`;
  });
  return new NextResponse(null, { status: 204 });
}
