import { ensureSchema, sql } from "./db";
import type { AppUser, ProInterest } from "./types";

/**
 * Records a signed-in visit: the first one adds the person, later ones refresh their profile and last visit
 * (a blank name or email never replaces a known one: Apple shares the name only once).
 */
export async function touchUser(id: string, user: AppUser): Promise<{ proInterest: ProInterest }> {
  try {
    await ensureSchema();
    const [row] = await sql<{ pro_interest: string | null }[]>`
      insert into users (id, email, name, image) values (${id}, ${user.email}, ${user.name}, ${user.image})
      on conflict (id) do update set
        email = coalesce(nullif(excluded.email, ''), users.email),
        name = coalesce(nullif(excluded.name, ''), users.name),
        image = coalesce(excluded.image, users.image),
        last_seen_at = now()
      returning pro_interest`;
    return { proInterest: asProInterest(row?.pro_interest) };
  } catch (e) {
    // Never in the way of using the app.
    console.error("Couldn't record the visit", e);
    return { proInterest: null };
  }
}

/** The billing someone picked when asking to hear about Pro; null: they haven't asked. */
export const asProInterest = (v: unknown): ProInterest => (v === "yearly" || v === "monthly" ? v : null);

/** Pro isn't open yet: this notes who wants to hear when it is (and with which billing), or takes the note back. */
export async function setProInterest(id: string, plan: ProInterest) {
  await sql`update users set pro_interest = ${plan}, pro_interest_at = ${plan ? sql`now()` : null} where id = ${id}`;
}
