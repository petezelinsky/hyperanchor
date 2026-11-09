import { ensureSchema, sql } from "./db";
import type { AppUser } from "./types";

/** Records a signed-in visit: the first one adds the person, later ones refresh their profile and last visit. */
export async function touchUser(id: string, user: AppUser) {
  try {
    await ensureSchema();
    await sql`
      insert into users (id, email, name, image) values (${id}, ${user.email}, ${user.name}, ${user.image})
      on conflict (id) do update set email = excluded.email, name = excluded.name, image = excluded.image, last_seen_at = now()`;
  } catch (e) {
    // Never in the way of using the app.
    console.error("Couldn't record the visit", e);
  }
}
