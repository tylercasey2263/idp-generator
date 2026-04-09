-- ═══════════════════════════════════════════════════════════════════════════
--  RBAC Phase 2 — Team / Player / IDP Scoping + Parent Auth Path
--  Run AFTER rbac-phase1-critical.sql.  Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. TEAMS ────────────────────────────────────────────────────────────────
-- G6: Coaches could update OR delete any team.
-- Fix: Coaches can only UPDATE teams they are assigned to.
--      Only admins can DELETE teams.

DROP POLICY IF EXISTS "teams: staff update" ON public.teams;
DROP POLICY IF EXISTS "teams: staff delete" ON public.teams;
DROP POLICY IF EXISTS "teams: admin write"  ON public.teams;

-- Admins have full control over all teams
CREATE POLICY "teams: admin all"
  ON public.teams FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- Coaches can update only their assigned teams (no delete)
CREATE POLICY "teams: coach update assigned"
  ON public.teams FOR UPDATE
  USING (
    id IN (SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid())
  );

-- Coaches can still insert new teams (they auto-assign themselves in the app)
-- "teams: staff insert" policy from fix-coach-permissions.sql remains valid.


-- ─── 2. PLAYERS ──────────────────────────────────────────────────────────────
-- G7: Coaches could update OR delete any player in the system.
-- Fix: Coaches can only update/delete players on their assigned teams.
--      Also add parent read path (G12).

DROP POLICY IF EXISTS "players: staff update" ON public.players;
DROP POLICY IF EXISTS "players: staff delete" ON public.players;
DROP POLICY IF EXISTS "players: parent read"  ON public.players;

-- Admins handled by "players: staff read all" + new admin write policy below.
-- Coaches: update players on their teams (primary team OR secondary via player_teams)
CREATE POLICY "players: coach update"
  ON public.players FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach','admin'))
    AND (
      team_id IN (SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid())
      OR id IN (
        SELECT pt.player_id FROM public.player_teams pt
        JOIN public.coach_teams ct ON ct.team_id = pt.team_id
        WHERE ct.coach_id = auth.uid()
      )
    )
  );

-- Coaches: delete only from their primary team
CREATE POLICY "players: coach delete"
  ON public.players FOR DELETE
  USING (
    team_id IN (SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid())
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- G12: Authenticated parents can read their own children's player records
CREATE POLICY "players: parent read"
  ON public.players FOR SELECT
  USING (
    id IN (
      SELECT player_id FROM public.parent_players
      WHERE parent_id = auth.uid() AND accepted = true
    )
  );


-- ─── 3. IDPs ─────────────────────────────────────────────────────────────────
-- G5: Every coach could read/edit/delete any IDP regardless of team assignment.
-- Fix: Split into admin (full) and coach (scoped to own teams' players).
--      Also add parent read path (G11).

DROP POLICY IF EXISTS "idps: staff all"   ON public.idps;
DROP POLICY IF EXISTS "idps: parent read" ON public.idps;

-- Admins can do everything
CREATE POLICY "idps: admin all"
  ON public.idps FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- Coaches can read/write IDPs only for players on their assigned teams
CREATE POLICY "idps: coach scoped"
  ON public.idps FOR ALL
  USING (
    player_id IN (
      -- Primary team assignment
      SELECT p.id FROM public.players p
      JOIN public.coach_teams ct ON ct.team_id = p.team_id
      WHERE ct.coach_id = auth.uid()
      UNION
      -- Secondary team assignment (player_teams many-to-many)
      SELECT pt.player_id FROM public.player_teams pt
      JOIN public.coach_teams ct ON ct.team_id = pt.team_id
      WHERE ct.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    player_id IN (
      SELECT p.id FROM public.players p
      JOIN public.coach_teams ct ON ct.team_id = p.team_id
      WHERE ct.coach_id = auth.uid()
      UNION
      SELECT pt.player_id FROM public.player_teams pt
      JOIN public.coach_teams ct ON ct.team_id = pt.team_id
      WHERE ct.coach_id = auth.uid()
    )
  );

-- G11: Authenticated parents can read published IDPs for their accepted children
CREATE POLICY "idps: parent read"
  ON public.idps FOR SELECT
  USING (
    published = true
    AND player_id IN (
      SELECT player_id FROM public.parent_players
      WHERE parent_id = auth.uid() AND accepted = true
    )
  );


-- ─── 4. TEAM PLANS ───────────────────────────────────────────────────────────
-- G9: No admin RLS policy existed on team_plans.

DROP POLICY IF EXISTS "team_plans: admin all"   ON public.team_plans;
DROP POLICY IF EXISTS "team_plans: coach all"   ON public.team_plans;

CREATE POLICY "team_plans: admin all"
  ON public.team_plans FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

CREATE POLICY "team_plans: coach scoped"
  ON public.team_plans FOR ALL
  USING (
    team_id IN (SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid())
  )
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.coach_teams WHERE coach_id = auth.uid())
  );


-- ─── 5. COACH_TEAMS ──────────────────────────────────────────────────────────
-- G10: Admins couldn't assign coaches to teams because the INSERT policy
--      required coach_id = auth.uid() (i.e., coaches can only add themselves).
-- Fix: Allow admins to insert any row.

DROP POLICY IF EXISTS "coach_teams: own insert" ON public.coach_teams;

CREATE POLICY "coach_teams: insert"
  ON public.coach_teams FOR INSERT
  WITH CHECK (
    -- Coaches can add themselves; admins can assign anyone
    coach_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );


-- ─── 6. PARENT FEEDBACK ──────────────────────────────────────────────────────
-- G8: Any coach could read/update feedback for any player, not just their own.
-- G17: No DELETE policy existed.
-- Fix: Scope coach access to their own teams' players.  Add admin full access.

DROP POLICY IF EXISTS "parent_feedback: staff select" ON public.parent_feedback;
DROP POLICY IF EXISTS "parent_feedback: staff update" ON public.parent_feedback;
DROP POLICY IF EXISTS "parent_feedback: admin all"    ON public.parent_feedback;
DROP POLICY IF EXISTS "parent_feedback: coach select" ON public.parent_feedback;
DROP POLICY IF EXISTS "parent_feedback: coach update" ON public.parent_feedback;
DROP POLICY IF EXISTS "parent_feedback: coach delete" ON public.parent_feedback;

-- Admins can do everything
CREATE POLICY "parent_feedback: admin all"
  ON public.parent_feedback FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- Coaches see only feedback for their own teams' players
CREATE POLICY "parent_feedback: coach select"
  ON public.parent_feedback FOR SELECT
  USING (
    player_id IN (
      SELECT p.id FROM public.players p
      JOIN public.coach_teams ct ON ct.team_id = p.team_id
      WHERE ct.coach_id = auth.uid()
      UNION
      SELECT pt.player_id FROM public.player_teams pt
      JOIN public.coach_teams ct ON ct.team_id = pt.team_id
      WHERE ct.coach_id = auth.uid()
    )
  );

CREATE POLICY "parent_feedback: coach update"
  ON public.parent_feedback FOR UPDATE
  USING (
    player_id IN (
      SELECT p.id FROM public.players p
      JOIN public.coach_teams ct ON ct.team_id = p.team_id
      WHERE ct.coach_id = auth.uid()
      UNION
      SELECT pt.player_id FROM public.player_teams pt
      JOIN public.coach_teams ct ON ct.team_id = pt.team_id
      WHERE ct.coach_id = auth.uid()
    )
  );

-- G17: Allow coaches (and admins above) to delete feedback for their players
CREATE POLICY "parent_feedback: coach delete"
  ON public.parent_feedback FOR DELETE
  USING (
    player_id IN (
      SELECT p.id FROM public.players p
      JOIN public.coach_teams ct ON ct.team_id = p.team_id
      WHERE ct.coach_id = auth.uid()
      UNION
      SELECT pt.player_id FROM public.player_teams pt
      JOIN public.coach_teams ct ON ct.team_id = pt.team_id
      WHERE ct.coach_id = auth.uid()
    )
  );
