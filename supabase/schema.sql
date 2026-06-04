create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  manage_token text not null unique,
  guest_token  text not null unique,
  title text not null,
  starts_at timestamptz,
  duration_min int,
  location text not null,
  court_numbers text,
  notes text,
  status text not null default 'active' check (status in ('active','cancelled')),
  lifecycle text not null default 'draft' check (lifecycle in ('draft','finalized')),
  court_cost numeric,
  shuttles_used int,
  price_per_shuttle numeric,
  created_at timestamptz not null default now(),
  constraint sessions_finalized_time_required check (
    lifecycle <> 'finalized'
    or (starts_at is not null and duration_min is not null)
  )
);

create table session_time_options (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int not null,
  label text,
  created_at timestamptz not null default now(),
  unique (id, session_id)
);

create table time_option_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  session_time_option_id uuid not null,
  name text not null,
  participant_token text not null,
  player_id uuid references profiles(id) on delete set null,
  added_by_token text,
  created_at timestamptz not null default now(),
  foreign key (session_time_option_id, session_id)
    references session_time_options(id, session_id)
    on delete cascade
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  rsvp text not null check (rsvp in ('going','maybe','cant')),
  attended boolean not null default false,
  participant_token text,
  player_id uuid references profiles(id) on delete set null,
  added_by_token text,
  created_at timestamptz not null default now()
);

create index sessions_guest_token_idx  on sessions (guest_token);
create index sessions_manage_token_idx on sessions (manage_token);
create index session_time_options_session_idx on session_time_options (session_id);
create index time_option_votes_session_idx on time_option_votes (session_id);
create index time_option_votes_option_idx on time_option_votes (session_time_option_id);
create unique index time_option_votes_device_option_idx
  on time_option_votes (participant_token, session_time_option_id);
create unique index time_option_votes_player_option_idx
  on time_option_votes (player_id, session_time_option_id)
  where player_id is not null;
create index time_option_votes_added_by_idx on time_option_votes (session_id, added_by_token);
create index participants_session_idx  on participants (session_id);
create index participants_added_by_idx on participants (session_id, added_by_token);

-- RLS on; data access is via the server service-role key (bypasses RLS).
-- The anon client is used ONLY for auth flows, never for table reads/writes.
alter table profiles             enable row level security;
alter table sessions             enable row level security;
alter table session_time_options enable row level security;
alter table time_option_votes    enable row level security;
alter table participants         enable row level security;

-- Manual migration for existing Supabase projects:
-- 1. Add the draft/finalized lifecycle and loosen confirmed-session timing.
-- alter table sessions add column lifecycle text;
-- update sessions set lifecycle = 'finalized';
-- alter table sessions alter column lifecycle set default 'draft';
-- alter table sessions alter column starts_at drop not null;
-- alter table sessions alter column duration_min drop not null;
-- alter table sessions add constraint sessions_lifecycle_check
--   check (lifecycle in ('draft','finalized'));
-- alter table sessions add constraint sessions_finalized_time_required
--   check (
--     lifecycle <> 'finalized'
--     or (starts_at is not null and duration_min is not null)
--   );
-- alter table sessions alter column lifecycle set not null;
--
-- 2. Create the poll tables, indexes, and RLS entries from this schema:
-- create table session_time_options (
--   id uuid primary key default gen_random_uuid(),
--   session_id uuid not null references sessions(id) on delete cascade,
--   starts_at timestamptz not null,
--   duration_min int not null,
--   label text,
--   created_at timestamptz not null default now(),
--   unique (id, session_id)
-- );
-- create table time_option_votes (
--   id uuid primary key default gen_random_uuid(),
--   session_id uuid not null references sessions(id) on delete cascade,
--   session_time_option_id uuid not null,
--   name text not null,
--   participant_token text not null,
--   player_id uuid references profiles(id) on delete set null,
--   created_at timestamptz not null default now(),
--   foreign key (session_time_option_id, session_id)
--     references session_time_options(id, session_id)
--     on delete cascade
-- );
-- create index session_time_options_session_idx on session_time_options (session_id);
-- create index time_option_votes_session_idx on time_option_votes (session_id);
-- create index time_option_votes_option_idx on time_option_votes (session_time_option_id);
-- create unique index time_option_votes_device_option_idx
--   on time_option_votes (participant_token, session_time_option_id);
-- create unique index time_option_votes_player_option_idx
--   on time_option_votes (player_id, session_time_option_id)
--   where player_id is not null;
-- alter table session_time_options enable row level security;
-- alter table time_option_votes    enable row level security;
