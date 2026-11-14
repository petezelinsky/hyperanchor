// Everyone who has signed up, oldest first: `npm run users` (reads DATABASE_URL from .env.local or .env).
// People who used the site before the users table existed (9 Nov 2026) and haven't been back are listed by
// account ID: their email was never stored and appears on their next visit.
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set: add it to .env.local, or run DATABASE_URL=... npm run users");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });

try {
  const rows = await sql`
    with activity as (
      select user_id as id, count(*)::int as tasks, min(created_at) as first_task
      from tasks group by user_id
    )
    select ids.id, u.email, u.name, u.created_at, u.last_seen_at, a.first_task,
           coalesce(a.tasks, 0) as tasks
    from (select id from users union select id from activity) ids
    left join users u on u.id = ids.id
    left join activity a on a.id = ids.id
    order by coalesce(u.created_at, a.first_task), ids.id`;

  const day = (d) => (d ? d.toISOString().slice(0, 10) : "");
  const table = rows.map((r) => ({
    email: r.email || `(no email: ${r.id})`,
    name: r.name ?? "",
    since: day(r.created_at ?? r.first_task),
    seen: day(r.last_seen_at),
    tasks: String(r.tasks),
  }));
  const head = { email: "Email", name: "Name", since: "Since", seen: "Last visit", tasks: "Tasks" };
  const cols = Object.keys(head);
  const width = Object.fromEntries(cols.map((c) => [c, Math.max(head[c].length, ...table.map((r) => r[c].length))]));
  const line = (r) => cols.map((c) => (c === "tasks" ? r[c].padStart(width[c]) : r[c].padEnd(width[c]))).join("  ").trimEnd();

  console.log(line(head));
  for (const r of table) console.log(line(r));

  const withEmail = rows.filter((r) => r.email).length;
  console.log(`\n${rows.length} accounts, ${withEmail} with email`);
  if (withEmail < rows.length) {
    console.log(`${rows.length - withEmail} used the site before emails were recorded: theirs appear on their next visit`);
  }
} finally {
  await sql.end();
}
