import { ensureSchema, sql } from "./db";
import type { AppUser } from "./types";

/**
 * Records a signed-in visit: the first one adds the person, later ones refresh their profile and last visit
 * (a blank name or email never replaces a known one: Apple shares the name only once).
 */
export async function touchUser(id: string, user: AppUser): Promise<void> {
  try {
    await ensureSchema();
    await sql`
      insert into users (id, email, name, image) values (${id}, ${user.email}, ${user.name}, ${user.image})
      on conflict (id) do update set
        email = coalesce(nullif(excluded.email, ''), users.email),
        name = coalesce(nullif(excluded.name, ''), users.name),
        image = coalesce(excluded.image, users.image),
        last_seen_at = now()`;
  } catch (e) {
    // Never in the way of using the app.
    console.error("Couldn't record the visit", e);
  }
}
