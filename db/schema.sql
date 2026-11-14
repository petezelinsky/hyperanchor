-- The whole schema, idempotent: run it in the Supabase SQL editor or with `npm run db:migrate`.
-- The app also applies the newer statements itself on first use (src/lib/db.ts), so a deploy never waits on this.

create table if not exists tasks (
  id          uuid primary key,
  user_id     text not null,
  date        date not null,
  title       text not null check (char_length(title) between 1 and 500),
  description text not null default '' check (char_length(description) <= 5000),
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Manual order within a day (drag and drop). Null until a task is moved: it then sorts by creation time.
alter table tasks add column if not exists "position" double precision;

create index if not exists tasks_user_date_idx on tasks (user_id, date);

alter table tasks enable row level security;

-- Everyone who has signed in: Google account ID (as in tasks.user_id), profile, first and latest visit.
create table if not exists users (
  id           text primary key,
  email        text not null default '',
  name         text not null default '',
  image        text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table users enable row level security;

-- Once an account's own daily AI allowance. No longer read: the allowance is 10,000 tokens a day for every account
-- (src/lib/budget.ts). The column stays so older deployments keep working.
alter table users add column if not exists ai_daily_tokens integer;

-- Turning text into tasks (voice): how many requests each person made on a day (UTC), and how much text. The daily
-- allowance is counted here; the words themselves are never stored.
create table if not exists ai_usage (
  user_id  text not null,
  day      date not null,
  requests integer not null default 0,
  chars    integer not null default 0,
  primary key (user_id, day)
);

alter table ai_usage enable row level security;

-- What the sorting cost in tokens (input, cached input included, and output): the account menu's Usage shows the sum.
alter table ai_usage add column if not exists input_tokens bigint not null default 0;
alter table ai_usage add column if not exists output_tokens bigint not null default 0;

-- AI summaries (Analytics): what was written about a period, so it can be read again on any device and kept as history,
-- and how many of the period's tasks were done when it was written: the next one for the same period waits until that
-- many more are done. Deleting one empties it (summary null) but keeps that count, so deleting never gets round the wait.
create table if not exists ai_summaries (
  id         uuid primary key,
  user_id    text not null,
  period     text not null check (period in ('day', 'week', 'month', 'year')),
  start_date date not null,
  end_date   date not null,
  label      text not null default '',
  done_count integer not null default 0,
  summary    jsonb,
  tokens     integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ai_summaries_user_idx on ai_summaries (user_id, created_at desc);

alter table ai_summaries enable row level security;

-- Deleting an account ends every session and app token issued until then, on every device: the moment is kept here
-- (one line per person), and sign-ins made before it no longer count.
create table if not exists revocations (
  user_id text primary key,
  before  timestamptz not null
);

alter table revocations enable row level security;
