-- ═══════════════════════════════════════════════════════════════════════════
--  fix-rls-enable.sql
--
--  Resolves all Supabase security-advisor RLS errors:
--
--  Category A — "Policy Exists, RLS Disabled"
--    Tables have correct policies defined but RLS was never (re-)enabled.
--    Fix: ALTER TABLE ... ENABLE ROW LEVEL SECURITY.
--    Affected: profiles, teams, players, coach_teams
--
--  Category B — "RLS Disabled in Public"
--    Tables were created with DISABLE ROW LEVEL SECURITY and have no policies.
--    Fix: Enable RLS and add scoped read/write policies.
--    Affected: league_standings, league_results, training_sessions, lineups,
--              team_coaches
--
--  Notes:
--  • The GotSport sync script uses the service_role key which bypasses RLS,
--    so league_standings, league_results, and team_coaches need only SELECT
--    policies for authenticated users.
--  • All INSERT/UPDATE/DELETE on league tables is handled by the sync script.
--  • Safe to run multiple times (idempotent via DROP POLICY IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── CATEGORY A: Re-enable RLS on tables with existing policies ──────────────
-- These tables already have the correct policies from fix-coach-permissions.sql
-- and rbac-phase1/2. We just need to flip the RLS switch back on.

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_teams ENABLE ROW LEVEL SECURITY;


-- ─── CATEGORY B-1: league_standings ─────────────────────────────────────────

ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_standings: staff read" ON public.league_standings;

-- Coaches and admins can view all standings rows.
-- Service role (sync script) handles all writes — bypasses RLS.
CREATE POLICY "league_standings: staff read"
  ON public.league_standings FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('coach', 'admin')
    )
  );


-- ─── CATEGORY B-2: league_results ───────────────────────────────────────────

ALTER TABLE public.league_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_results: staff read" ON public.league_results;

-- Coaches and admins can view all match results.
-- Service role (sync script) handles all writes — bypasses RLS.
CREATE POLICY "league_results: staff read"
  ON public.league_results FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('coach', 'admin')
    )
  );


-- ─── CATEGORY B-3: training_sessions ────────────────────────────────────────
-- Columns used by the app: id, team_id, coach_id, session_date, focus, notes

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_sessions: staff read"   ON public.training_sessions;
DROP POLICY IF EXISTS "training_sessions: staff insert" ON public.training_sessions;
DROP POLICY IF EXISTS "training_sessions: staff update" ON public.training_sessions;
DROP POLICY IF EXISTS "training_sessions: staff delete" ON public.training_sessions;

-- Coaches can read sessions for their assigned teams; admins see all.
CREATE POLICY "training_sessions: staff read"
  ON public.training_sessions FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR team_id IN (
      SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid()
    )
  );

-- Coaches can log sessions only for their assigned teams.
CREATE POLICY "training_sessions: staff insert"
  ON public.training_sessions FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR team_id IN (
      SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid()
    )
  );

-- Coaches can update session notes for their assigned teams.
CREATE POLICY "training_sessions: staff update"
  ON public.training_sessions FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR team_id IN (
      SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid()
    )
  );

-- Coaches can delete sessions for their assigned teams; admins can delete any.
CREATE POLICY "training_sessions: staff delete"
  ON public.training_sessions FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR team_id IN (
      SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid()
    )
  );


-- ─── CATEGORY B-4: lineups ──────────────────────────────────────────────────
-- Columns used by the app: id, team_id, name, formation, positions, created_at

ALTER TABLE public.lineups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lineups: staff read"   ON public.lineups;
DROP POLICY IF EXISTS "lineups: staff insert" ON public.lineups;
DROP POLICY IF EXISTS "lineups: staff update" ON public.lineups;
DROP POLICY IF EXISTS "lineups: staff delete" ON public.lineups;

-- Coaches can read lineups for their assigned teams; admins see all.
CREATE POLICY "lineups: staff read"
  ON public.lineups FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR team_id IN (
      SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid()
    )
  );

-- Coaches can save new lineups for their assigned teams.
CREATE POLICY "lineups: staff insert"
  ON public.lineups FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR team_id IN (
      SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid()
    )
  );

-- Coaches can rename/update lineups for their assigned teams.
CREATE POLICY "lineups: staff update"
  ON public.lineups FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR team_id IN (
      SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid()
    )
  );

-- Coaches can delete lineups for their assigned teams; admins can delete any.
CREATE POLICY "lineups: staff delete"
  ON public.lineups FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR team_id IN (
      SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid()
    )
  );


-- ─── CATEGORY B-5: team_coaches ─────────────────────────────────────────────
-- Populated exclusively by the sync script (service_role key — bypasses RLS).
-- App reads this table to display coaching staff on the team page.

ALTER TABLE public.team_coaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_coaches: staff read" ON public.team_coaches;

-- Coaches and admins can view coaching staff entries.
CREATE POLICY "team_coaches: staff read"
  ON public.team_coaches FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('coach', 'admin')
    )
  );
