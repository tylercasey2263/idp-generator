-- ═══════════════════════════════════════════════════════════════════════════
--  fix-rls-recursion.sql
--
--  Run after fix-rls-enable.sql.
--  • profiles admin policies queried profiles from inside profiles' own policy,
--    causing "infinite recursion detected in policy" once RLS was enabled.
--    Fix: SECURITY DEFINER helpers that check the caller's role without RLS.
--  • settings was readable anonymously (OR auth.uid() IS NULL), exposing
--    claude_api_key. Fix: only branding keys are public; the rest is staff-only.
--  Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') $$;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('coach', 'admin')) $$;


-- ─── profiles: non-recursive admin policies ─────────────────────────────────

DROP POLICY IF EXISTS "profiles: admin read"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin write" ON public.profiles;

CREATE POLICY "profiles: admin read"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "profiles: admin write"
  ON public.profiles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── settings: branding public, secrets staff-only ──────────────────────────

DROP POLICY IF EXISTS "settings: auth read"            ON public.settings;
DROP POLICY IF EXISTS "settings: coach read"           ON public.settings;
DROP POLICY IF EXISTS "settings: admin write"          ON public.settings;
DROP POLICY IF EXISTS "settings: public branding read" ON public.settings;
DROP POLICY IF EXISTS "settings: staff read"           ON public.settings;

-- Login page and public parent/player pages need club branding.
CREATE POLICY "settings: public branding read"
  ON public.settings FOR SELECT
  USING (key IN ('club_name', 'club_logo', 'theme_primary'));

-- Coaches and admins can read everything (incl. claude_api_key, idp_review_days).
CREATE POLICY "settings: staff read"
  ON public.settings FOR SELECT
  USING (public.is_staff());

CREATE POLICY "settings: admin write"
  ON public.settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
