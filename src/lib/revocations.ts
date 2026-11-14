import type { TransactionSql } from "postgres";
import { sql } from "./db";

/**
 * Sessions and app tokens that no longer count: when an account is deleted, every session (web cookie) and every iOS
 * token issued up to that moment stops working at once, on every device, so a laptop left signed in can't quietly
 * bring the account back. One line per person: the moment before which nothing they signed in with counts.
 *
 * Read on every signed-in request, so each server instance remembers the answer for a minute.
 */

const TTL = 60_000;
const known = new Map<string, { before: number; at: number }>();

/** Seconds since 1970 up to which this person's sign-ins no longer count (0: all count). */
export async function revokedBefore(userId: string): Promise<number> {
  const hit = known.get(userId);
  if (hit && Date.now() - hit.at < TTL) return hit.before;
  const [row] = await sql<{ before: string }[]>`select floor(extract(epoch from before))::bigint::text as before from revocations where user_id = ${userId}`;
  const before = row ? Number(row.before) : 0;
  if (known.size > 10_000) known.clear();
  known.set(userId, { before, at: Date.now() });
  return before;
}

/** Whether a sign-in made at `issuedAt` (seconds; 0: unknown, from before this was kept) still counts. */
export async function stillValid(userId: string, issuedAt: number): Promise<boolean> {
  const before = await revokedBefore(userId);
  return !before || issuedAt > before;
}

/** Everything signed in until now stops counting (inside the transaction that deletes the account). */
export async function revokeAll(tx: TransactionSql, userId: string) {
  await tx`insert into revocations (user_id, before) values (${userId}, now()) on conflict (user_id) do update set before = now()`;
  known.delete(userId);
}
