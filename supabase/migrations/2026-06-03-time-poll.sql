-- Migration: draft session time polls (run once in the Supabase SQL editor).
-- Matches supabase/schema.sql for projects created before the time-poll feature.

-- 1. Add the draft/finalized lifecycle and loosen confirmed-session timing.
alter table sessions add column lifecycle text;
update sessions set lifecycle = 'finalized';
alter table sessions alter column lifecycle set default 'draft';
alter table sessions alter column starts_at drop not null;
alter table sessions alter column duration_min drop not null;
alter table sessions add constraint sessions_lifecycle_check
  check (lifecycle in ('draft','finalized'));
alter table sessions add constraint sessions_finalized_time_required
  check (
    lifecycle <> 'finalized'
    or (starts_at is not null and duration_min is not null)
  );
alter table sessions alter column lifecycle set not null;

-- 2. Create the poll tables, indexes, and RLS entries.
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
  created_at timestamptz not null default now(),
  foreign key (session_time_option_id, session_id)
    references session_time_options(id, session_id)
    on delete cascade
);

create index session_time_options_session_idx on session_time_options (session_id);
create index time_option_votes_session_idx on time_option_votes (session_id);
create index time_option_votes_option_idx on time_option_votes (session_time_option_id);
create unique index time_option_votes_device_option_idx
  on time_option_votes (participant_token, session_time_option_id);
create unique index time_option_votes_player_option_idx
  on time_option_votes (player_id, session_time_option_id)
  where player_id is not null;

alter table session_time_options enable row level security;
alter table time_option_votes    enable row level security;
