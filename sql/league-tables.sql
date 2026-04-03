-- ─── GotSport League Sync: Database Tables ───────────────────────────────
-- Run this in the Supabase SQL Editor to create the required tables.

-- ─── Fix: share_token for player IDP share links ──────────────────────────
ALTER TABLE public.idps ADD COLUMN IF NOT EXISTS share_token text;
CREATE UNIQUE INDEX IF NOT EXISTS idps_share_token_idx
  ON public.idps (share_token) WHERE share_token IS NOT NULL;

-- Add gotsport_group_id to teams table for linking
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS gotsport_group_id text;

-- League standings (one row per team per group per season)
CREATE TABLE IF NOT EXISTS public.league_standings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  gotsport_group_id  text,
  gotsport_team_name text NOT NULL,
  division_name      text,
  gotsport_url       text,
  position           int,
  mp                 int DEFAULT 0,
  w                  int DEFAULT 0,
  l                  int DEFAULT 0,
  d                  int DEFAULT 0,
  gf                 int DEFAULT 0,
  ga                 int DEFAULT 0,
  gd                 int DEFAULT 0,
  pts                int DEFAULT 0,
  ppg                numeric DEFAULT 0,
  season             text DEFAULT 'Spring 2026',
  last_synced        timestamptz DEFAULT now()
);

ALTER TABLE public.league_standings DISABLE ROW LEVEL SECURITY;

-- Unique constraint: one standing row per team name per group per season
CREATE UNIQUE INDEX IF NOT EXISTS uq_league_standings_team_group_season
  ON public.league_standings (gotsport_group_id, gotsport_team_name, season);

-- Individual match results
CREATE TABLE IF NOT EXISTS public.league_results (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  gotsport_group_id  text,
  gotsport_team_name text NOT NULL,
  division_name      text,
  match_date         date,
  opponent           text,
  goals_for          int,
  goals_against      int,
  venue              text,
  is_home            boolean,
  result             char(1),
  season             text DEFAULT 'Spring 2026',
  last_synced        timestamptz DEFAULT now()
);

ALTER TABLE public.league_results DISABLE ROW LEVEL SECURITY;

-- Unique constraint: one result row per team + opponent + date per group
CREATE UNIQUE INDEX IF NOT EXISTS uq_league_results_match
  ON public.league_results (gotsport_group_id, gotsport_team_name, opponent, match_date, season);
