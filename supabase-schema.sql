-- ═══════════════════════════════════════════════════════
--  IDP Generator — Supabase Schema
--  Run this once in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════

-- ─── PROFILES (extends auth.users) ───────────────────
create table public.profiles (
  id        uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  role      text not null default 'coach'
              check (role in ('coach', 'parent', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'coach')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── TEAMS ────────────────────────────────────────────
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  season     text,
  created_at timestamptz default now()
);

-- ─── COACH ↔ TEAM ─────────────────────────────────────
create table public.coach_teams (
  coach_id uuid references public.profiles(id) on delete cascade,
  team_id  uuid references public.teams(id)    on delete cascade,
  primary key (coach_id, team_id)
);

-- ─── PLAYERS ──────────────────────────────────────────
create table public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  positions  text,
  team_id    uuid references public.teams(id) on delete set null,
  created_at timestamptz default now()
);

-- ─── PARENT ↔ PLAYER (invite links) ──────────────────
create table public.parent_players (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.profiles(id) on delete cascade,
  player_id    uuid references public.players(id)  on delete cascade,
  invite_token text unique default gen_random_uuid()::text,
  accepted     boolean default false,
  created_at   timestamptz default now()
);

-- ─── IDPs ─────────────────────────────────────────────
create table public.idps (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid references public.players(id)  on delete cascade,
  created_by uuid references public.profiles(id),
  data       jsonb not null,
  published  boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── SETTINGS (stores the Claude API key for coaches) ─
create table public.settings (
  key   text primary key,
  value text not null
);

-- After running this schema, insert your Claude API key:
-- insert into public.settings (key, value) values ('claude_api_key', 'sk-ant-YOUR-KEY-HERE');


-- ═══════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════

alter table public.profiles      enable row level security;
alter table public.teams         enable row level security;
alter table public.coach_teams   enable row level security;
alter table public.players       enable row level security;
alter table public.parent_players enable row level security;
alter table public.idps          enable row level security;
alter table public.settings      enable row level security;

-- ─── PROFILES ─────────────────────────────────────────
create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- ─── TEAMS ────────────────────────────────────────────
-- Coaches see only their assigned teams
create policy "teams: coach read"
  on public.teams for select
  using (
    id in (select team_id from public.coach_teams where coach_id = auth.uid())
  );

create policy "teams: coach insert"
  on public.teams for insert
  with check (
    auth.uid() in (select id from public.profiles where role in ('coach','admin'))
  );

create policy "teams: coach update"
  on public.teams for update
  using (
    id in (select team_id from public.coach_teams where coach_id = auth.uid())
  );

create policy "teams: coach delete"
  on public.teams for delete
  using (
    id in (select team_id from public.coach_teams where coach_id = auth.uid())
  );

-- ─── COACH_TEAMS ──────────────────────────────────────
create policy "coach_teams: own read"
  on public.coach_teams for select
  using (coach_id = auth.uid());

create policy "coach_teams: own insert"
  on public.coach_teams for insert
  with check (coach_id = auth.uid());

create policy "coach_teams: own delete"
  on public.coach_teams for delete
  using (coach_id = auth.uid());

-- ─── PLAYERS ──────────────────────────────────────────
-- Coaches see players on their teams; parents see their kid
create policy "players: coach read"
  on public.players for select
  using (
    team_id in (select team_id from public.coach_teams where coach_id = auth.uid())
    or id in (select player_id from public.parent_players where parent_id = auth.uid() and accepted = true)
  );

create policy "players: coach insert"
  on public.players for insert
  with check (
    team_id in (select team_id from public.coach_teams where coach_id = auth.uid())
  );

create policy "players: coach update"
  on public.players for update
  using (
    team_id in (select team_id from public.coach_teams where coach_id = auth.uid())
  );

create policy "players: coach delete"
  on public.players for delete
  using (
    team_id in (select team_id from public.coach_teams where coach_id = auth.uid())
  );

-- ─── PARENT_PLAYERS ───────────────────────────────────
-- Coaches create invite links for their players; coaches and parents can read
create policy "parent_players: coach insert"
  on public.parent_players for insert
  with check (
    player_id in (
      select p.id from public.players p
      join public.coach_teams ct on ct.team_id = p.team_id
      where ct.coach_id = auth.uid()
    )
  );

create policy "parent_players: read"
  on public.parent_players for select
  using (
    parent_id = auth.uid()
    or player_id in (
      select p.id from public.players p
      join public.coach_teams ct on ct.team_id = p.team_id
      where ct.coach_id = auth.uid()
    )
  );

-- Parents accept their own invite (update accepted + parent_id)
create policy "parent_players: accept invite"
  on public.parent_players for update
  using (true)
  with check (true);

-- ─── IDPs ─────────────────────────────────────────────
-- Coaches can do everything for players on their teams
create policy "idps: coach all"
  on public.idps for all
  using (
    player_id in (
      select p.id from public.players p
      join public.coach_teams ct on ct.team_id = p.team_id
      where ct.coach_id = auth.uid()
    )
  );

-- Parents can read published IDPs for their accepted players
create policy "idps: parent read"
  on public.idps for select
  using (
    published = true
    and player_id in (
      select player_id from public.parent_players
      where parent_id = auth.uid() and accepted = true
    )
  );

-- ─── SETTINGS ─────────────────────────────────────────
-- Only coaches and admins can read settings (e.g. the Claude API key)
create policy "settings: coach read"
  on public.settings for select
  using (
    auth.uid() in (select id from public.profiles where role in ('coach','admin'))
  );
