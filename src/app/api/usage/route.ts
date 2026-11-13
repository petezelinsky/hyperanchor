import { NextResponse } from "next/server";
import { currentUserId, unauthorized } from "@/lib/api";
import { today } from "@/lib/budget";
import type { Usage } from "@/lib/types";

/**
 * The signed-in account's AI allowance for today (UTC): tokens used, tokens left and the whole of it. Hearing speech,
 * sorting it into tasks and the summary in Progress all draw on it.
 */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const usage: Usage = { today: await today(userId) };
  return NextResponse.json(usage, { headers: { "Cache-Control": "no-store" } });
}
