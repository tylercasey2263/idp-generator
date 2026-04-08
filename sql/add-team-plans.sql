-- ─── TEAM PLANS ────────────────────────────────────────
-- Run this in the Supabase SQL editor to create the team_plans table

create table if not exists public.team_plans (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid references public.teams(id) on delete cascade,
  created_by uuid references public.profiles(id),
  data       jsonb not null,
  published  boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.team_plans enable row level security;

-- Coaches can do everything for team plans on their teams
create policy "team_plans: coach all"
  on public.team_plans for all
  using (
    team_id in (
      select team_id from public.coach_teams where coach_id = auth.uid()
    )
  )
  with check (
    team_id in (
      select team_id from public.coach_teams where coach_id = auth.uid()
    )
  );
