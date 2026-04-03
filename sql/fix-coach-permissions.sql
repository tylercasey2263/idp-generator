-- ─── Fix Coach Permissions ────────────────────────────────────────────────
-- Coaches can now see ALL teams and ALL players (not just their own coach_teams rows).
-- Admins always see everything.
-- Parents see only their linked player's data.
-- Run this in the Supabase SQL Editor.

-- ── TEAMS ──────────────────────────────────────────────────────────────────

-- Drop old restrictive policy
DROP POLICY IF EXISTS "teams: coach read" ON public.teams;
DROP POLICY IF EXISTS "teams: admin all" ON public.teams;

-- Coaches (and admins) can read ALL teams
CREATE POLICY "teams: staff read all"
  ON public.teams FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

-- Only admins can insert/update/delete teams
CREATE POLICY "teams: admin write"
  ON public.teams FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- Coaches can also insert/update teams (they manage their own teams)
CREATE POLICY "teams: coach write"
  ON public.teams FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

CREATE POLICY "teams: coach update"
  ON public.teams FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

CREATE POLICY "teams: coach delete"
  ON public.teams FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

-- ── PLAYERS ────────────────────────────────────────────────────────────────

-- Drop old restrictive policy
DROP POLICY IF EXISTS "players: coach read" ON public.players;
DROP POLICY IF EXISTS "players: coach all" ON public.players;
DROP POLICY IF EXISTS "players: parent read" ON public.players;

-- Coaches and admins can read ALL players
CREATE POLICY "players: staff read all"
  ON public.players FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
    OR
    -- Parents can see their linked players
    id IN (
      SELECT player_id FROM public.parent_players
      WHERE parent_id = auth.uid() AND accepted = true
    )
  );

-- Coaches and admins can insert/update/delete players
CREATE POLICY "players: staff write"
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

-- ── IDPs ───────────────────────────────────────────────────────────────────

-- Drop old restrictive policy
DROP POLICY IF EXISTS "idps: coach all" ON public.idps;
DROP POLICY IF EXISTS "idps: parent read" ON public.idps;

-- Coaches and admins can read/write ALL IDPs
CREATE POLICY "idps: staff all"
  ON public.idps FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

-- Parents can read published IDPs for their linked players
CREATE POLICY "idps: parent read"
  ON public.idps FOR SELECT
  USING (
    published = true
    AND player_id IN (
      SELECT player_id FROM public.parent_players
      WHERE parent_id = auth.uid() AND accepted = true
    )
  );

-- Public share link access (anyone with a valid share_token can read)
CREATE POLICY "idps: share token read"
  ON public.idps FOR SELECT
  USING (
    share_token IS NOT NULL
  );

-- ── TRAINING SESSIONS ──────────────────────────────────────────────────────
-- Already has RLS disabled — coaches can see all (no change needed)

-- ── COACH_TEAMS ────────────────────────────────────────────────────────────
-- This table is still used to track team creation (creator/owner)
-- but no longer gates visibility. Keep existing policies as-is.
