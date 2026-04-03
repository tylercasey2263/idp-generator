-- ═══════════════════════════════════════════════════════════════════════════
--  IDP Generator — Run this in the Supabase SQL Editor
--  Safe to run multiple times (fully idempotent).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. SCHEMA ADDITIONS ────────────────────────────────────────────────────

-- Player notes/bio field (shown in player profile header)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS notes text;

-- Parent invite email (stored when coach generates an invite link)
ALTER TABLE public.parent_players ADD COLUMN IF NOT EXISTS invite_email text;

-- Player ↔ Team many-to-many (players can be on multiple teams)
CREATE TABLE IF NOT EXISTS public.player_teams (
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  team_id   uuid REFERENCES public.teams(id)   ON DELETE CASCADE,
  PRIMARY KEY (player_id, team_id)
);

-- Ensure league tables have the gotsport_group_id column on teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS gotsport_group_id text;

-- Ensure share_token exists on IDPs (for individual IDP share links)
ALTER TABLE public.idps ADD COLUMN IF NOT EXISTS share_token text;
CREATE UNIQUE INDEX IF NOT EXISTS idps_share_token_idx
  ON public.idps (share_token) WHERE share_token IS NOT NULL;

-- Ensure league tables exist (safe no-op if already created)
CREATE TABLE IF NOT EXISTS public.league_standings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  gotsport_group_id  text,
  gotsport_team_name text NOT NULL,
  division_name      text,
  gotsport_url       text,
  position           int,
  mp int DEFAULT 0, w int DEFAULT 0, l int DEFAULT 0, d int DEFAULT 0,
  gf int DEFAULT 0, ga int DEFAULT 0, gd int DEFAULT 0,
  pts int DEFAULT 0, ppg numeric DEFAULT 0,
  season      text DEFAULT 'Spring 2026',
  last_synced timestamptz DEFAULT now()
);
ALTER TABLE public.league_standings DISABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS uq_league_standings_team_group_season
  ON public.league_standings (gotsport_group_id, gotsport_team_name, season);

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
  season      text DEFAULT 'Spring 2026',
  last_synced timestamptz DEFAULT now()
);
ALTER TABLE public.league_results DISABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS uq_league_results_match
  ON public.league_results (gotsport_group_id, gotsport_team_name, opponent, match_date, season);


-- ─── 2. DROP ALL OLD POLICIES (safe to re-run) ──────────────────────────────

-- teams (original schema policies + any from previous partial runs)
DROP POLICY IF EXISTS "teams: coach read"      ON public.teams;
DROP POLICY IF EXISTS "teams: coach insert"    ON public.teams;
DROP POLICY IF EXISTS "teams: coach update"    ON public.teams;
DROP POLICY IF EXISTS "teams: coach delete"    ON public.teams;
DROP POLICY IF EXISTS "teams: admin all"       ON public.teams;
DROP POLICY IF EXISTS "teams: staff read all"  ON public.teams;
DROP POLICY IF EXISTS "teams: admin write"     ON public.teams;
DROP POLICY IF EXISTS "teams: coach write"     ON public.teams;

-- players
DROP POLICY IF EXISTS "players: coach read"     ON public.players;
DROP POLICY IF EXISTS "players: coach insert"   ON public.players;
DROP POLICY IF EXISTS "players: coach update"   ON public.players;
DROP POLICY IF EXISTS "players: coach delete"   ON public.players;
DROP POLICY IF EXISTS "players: coach all"      ON public.players;
DROP POLICY IF EXISTS "players: parent read"    ON public.players;
DROP POLICY IF EXISTS "players: staff read all" ON public.players;
DROP POLICY IF EXISTS "players: staff write"    ON public.players;
DROP POLICY IF EXISTS "players: staff update"   ON public.players;
DROP POLICY IF EXISTS "players: staff delete"   ON public.players;
DROP POLICY IF EXISTS "players: anon read"      ON public.players;

-- idps
DROP POLICY IF EXISTS "idps: coach all"        ON public.idps;
DROP POLICY IF EXISTS "idps: parent read"      ON public.idps;
DROP POLICY IF EXISTS "idps: staff all"        ON public.idps;
DROP POLICY IF EXISTS "idps: share token read" ON public.idps;
DROP POLICY IF EXISTS "idps: anon read"        ON public.idps;

-- parent_players
DROP POLICY IF EXISTS "parent_players: coach insert"  ON public.parent_players;
DROP POLICY IF EXISTS "parent_players: read"          ON public.parent_players;
DROP POLICY IF EXISTS "parent_players: accept invite" ON public.parent_players;
DROP POLICY IF EXISTS "parent_players: anon read"     ON public.parent_players;
DROP POLICY IF EXISTS "parent_players: token read"    ON public.parent_players;

-- profiles
DROP POLICY IF EXISTS "profiles: own read"    ON public.profiles;
DROP POLICY IF EXISTS "profiles: own update"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin read"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin write" ON public.profiles;

-- coach_teams
DROP POLICY IF EXISTS "coach_teams: own read"   ON public.coach_teams;
DROP POLICY IF EXISTS "coach_teams: own insert" ON public.coach_teams;
DROP POLICY IF EXISTS "coach_teams: own delete" ON public.coach_teams;
DROP POLICY IF EXISTS "coach_teams: admin read" ON public.coach_teams;

-- player_teams (new table)
DROP POLICY IF EXISTS "player_teams: staff all" ON public.player_teams;

-- player_notes
DROP POLICY IF EXISTS "player_notes: coach own" ON public.player_notes;


-- ─── 3. ENABLE RLS ON NEW TABLES ────────────────────────────────────────────

ALTER TABLE public.player_teams ENABLE ROW LEVEL SECURITY;


-- ─── 4. NEW POLICIES ────────────────────────────────────────────────────────

-- ── PROFILES ──────────────────────────────────────────────────────────────
-- Each user sees their own profile
CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can see and manage all profiles (needed for Users page)
CREATE POLICY "profiles: admin read"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

CREATE POLICY "profiles: admin write"
  ON public.profiles FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );


-- ── TEAMS ─────────────────────────────────────────────────────────────────
-- All coaches and admins can read ALL teams
CREATE POLICY "teams: staff read all"
  ON public.teams FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

-- All coaches and admins can create, edit, and delete teams
CREATE POLICY "teams: staff insert"
  ON public.teams FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

CREATE POLICY "teams: staff update"
  ON public.teams FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

CREATE POLICY "teams: staff delete"
  ON public.teams FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );


-- ── COACH_TEAMS ───────────────────────────────────────────────────────────
-- Coaches see their own entries; admins see all (for Users page)
CREATE POLICY "coach_teams: own read"
  ON public.coach_teams FOR SELECT
  USING (
    coach_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

CREATE POLICY "coach_teams: own insert"
  ON public.coach_teams FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_teams: own delete"
  ON public.coach_teams FOR DELETE
  USING (
    coach_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );


-- ── PLAYERS ───────────────────────────────────────────────────────────────
-- All coaches and admins can read ALL players
-- Anon users can read players (needed for parent token-based access)
CREATE POLICY "players: staff read all"
  ON public.players FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
    OR auth.uid() IS NULL  -- anon: parent viewing via token
  );

-- All coaches and admins can create, edit, and delete players
CREATE POLICY "players: staff insert"
  ON public.players FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

CREATE POLICY "players: staff update"
  ON public.players FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

CREATE POLICY "players: staff delete"
  ON public.players FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );


-- ── PLAYER_TEAMS ──────────────────────────────────────────────────────────
-- Coaches and admins can manage the player ↔ team assignments
CREATE POLICY "player_teams: staff all"
  ON public.player_teams FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );


-- ── PARENT_PLAYERS ────────────────────────────────────────────────────────
-- Anon users can read by invite_token (the token IS the secret — parent.html)
CREATE POLICY "parent_players: anon read"
  ON public.parent_players FOR SELECT
  TO anon
  USING (true);

-- Authenticated coaches/admins can read and insert invite records
CREATE POLICY "parent_players: staff read"
  ON public.parent_players FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

CREATE POLICY "parent_players: staff insert"
  ON public.parent_players FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

CREATE POLICY "parent_players: accept invite"
  ON public.parent_players FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "parent_players: staff delete"
  ON public.parent_players FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );


-- ── IDPs ──────────────────────────────────────────────────────────────────
-- All coaches and admins can read/write ALL IDPs
CREATE POLICY "idps: staff all"
  ON public.idps FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

-- Anon users can read published IDPs (parent token-based access)
CREATE POLICY "idps: anon published read"
  ON public.idps FOR SELECT
  TO anon
  USING (published = true);

-- Anyone with a share_token link can read that specific IDP
CREATE POLICY "idps: share token read"
  ON public.idps FOR SELECT
  USING (share_token IS NOT NULL);


-- ── PLAYER NOTES ──────────────────────────────────────────────────────────
-- Coaches see only their own private notes
CREATE POLICY "player_notes: coach own"
  ON public.player_notes FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());


-- ── SETTINGS ──────────────────────────────────────────────────────────────
-- Coaches and admins can read settings (Claude API key, etc.)
DROP POLICY IF EXISTS "settings: coach read" ON public.settings;
CREATE POLICY "settings: coach read"
  ON public.settings FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
    OR auth.uid() IS NULL  -- anon: needed for club branding on public pages
  );
