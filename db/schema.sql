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

create index if not exists tasks_user_date_idx on tasks (user_id, date);

alter table tasks enable row level security;
