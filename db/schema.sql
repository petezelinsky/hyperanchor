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
