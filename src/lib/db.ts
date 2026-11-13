import postgres from "postgres";

const globalForSql = globalThis as unknown as { sql?: postgres.Sql; schemaReady?: Promise<void> | null };

// Tuned for Vercel serverless + Supabase transaction pooler (port 6543):
// - `prepare: false`: transaction-mode poolers don't support named prepared statements.
// - `max: 1`: one connection per function instance; the pooler does the pooling.
// - `idle_timeout`: release idle connections so frozen instances don't hold pooler slots.
export const sql =
  globalForSql.sql ??
  postgres(process.env.DATABASE_URL ?? "", { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });

if (process.env.NODE_ENV !== "production") globalForSql.sql = sql;

// What newer code needs from db/schema.sql. Each change runs only when it's missing, so a cold start that finds the
// schema current takes no table locks.
const UPGRADES = `
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'tasks' and column_name = 'position') then
    alter table tasks add column if not exists "position" double precision;
  end if;
  if to_regclass('users') is null then
    create table if not exists users (
      id           text primary key,
      email        text not null default '',
      name         text not null default '',
      image        text,
      created_at   timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    );
    alter table users enable row level security;
  end if;
  if to_regclass('ai_usage') is null then
    create table if not exists ai_usage (
      user_id  text not null,
      day      date not null,
      requests integer not null default 0,
      chars    integer not null default 0,
      primary key (user_id, day)
    );
    alter table ai_usage enable row level security;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'ai_usage' and column_name = 'input_tokens') then
    alter table ai_usage add column if not exists input_tokens bigint not null default 0;
    alter table ai_usage add column if not exists output_tokens bigint not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'users' and column_name = 'ai_daily_tokens') then
    alter table users add column if not exists ai_daily_tokens integer;
  end if;
end $$;
`;

/** Brings the database up to what the code expects, once per server instance; a failure is retried on the next call. */
export function ensureSchema(): Promise<void> {
  globalForSql.schemaReady ??= sql.unsafe(UPGRADES).then(
    () => undefined,
    (e) => {
      globalForSql.schemaReady = null;
      console.error("Schema upgrade failed", e);
    },
  );
  return globalForSql.schemaReady;
}
