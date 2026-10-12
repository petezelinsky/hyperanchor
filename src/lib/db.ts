import postgres from "postgres";

const globalForSql = globalThis as unknown as { sql?: postgres.Sql };

// Tuned for Vercel serverless + Supabase transaction pooler (port 6543):
// - `prepare: false`: transaction-mode poolers don't support named prepared statements.
// - `max: 1`: one connection per function instance; the pooler does the pooling.
// - `idle_timeout`: release idle connections so frozen instances don't hold pooler slots.
export const sql =
  globalForSql.sql ??
  postgres(process.env.DATABASE_URL ?? "", { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 10 });

if (process.env.NODE_ENV !== "production") globalForSql.sql = sql;
