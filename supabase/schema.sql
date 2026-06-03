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
  starts_at timestamptz not null,
  duration_min int not null,
  location text not null,
  court_numbers text,
  notes text,
  status text not null default 'active' check (status in ('active','cancelled')),
  court_cost numeric,
  shuttles_used int,
  price_per_shuttle numeric,
  created_at timestamptz not null default now()
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  rsvp text not null check (rsvp in ('going','maybe','cant')),
  attended boolean not null default false,
  participant_token text not null,
  player_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index sessions_guest_token_idx  on sessions (guest_token);
create index sessions_manage_token_idx on sessions (manage_token);
create index participants_session_idx  on participants (session_id);

-- RLS on; data access is via the server service-role key (bypasses RLS).
-- The anon client is used ONLY for auth flows, never for table reads/writes.
alter table profiles     enable row level security;
alter table sessions     enable row level security;
alter table participants enable row level security;
