-- ═══════════════════════════════════════════════════════════════════════════
--  fix-signup-roles.sql
--
--  Run after fix-anon-token-access.sql.
--  • Sign-up no longer trusts the client-supplied role (anyone could sign up
--    as admin). Open sign-ups become 'parent'; coach/admin come from invites.
--  • redeem_invite(): applies an invite's role server-side (the old client-side
--    update was silently blocked by RLS) and marks the invite used.
--  • coach_teams: only coaches/admins can assign themselves to teams
--    (parents could previously self-assign and read that team's IDPs).
--  Existing users' roles are not changed. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── New users always start as parent ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name', 'parent')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Client-side profile creation (auth.js ensureProfile fallback) may only create a parent
DROP POLICY IF EXISTS "profiles: own insert" ON public.profiles;
CREATE POLICY "profiles: own insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND role = 'parent');


-- ─── Invite redemption ──────────────────────────────────────────────────────
-- Upgrades the caller's role to the invite's role (never demotes) and marks the
-- invite used. If the invite was sent to a specific email, the caller's login
-- email must match it.

CREATE OR REPLACE FUNCTION public.redeem_invite(p_token text) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
DECLARE
  inv       public.invites%ROWTYPE;
  cur_role  text;
  rank      jsonb := '{"parent":1,"coach":2,"admin":3}';
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO inv FROM public.invites
  WHERE token = p_token AND used_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF inv.email IS NOT NULL AND inv.email <> ''
     AND lower(inv.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) THEN
    RETURN NULL;
  END IF;

  SELECT role INTO cur_role FROM public.profiles WHERE id = auth.uid();

  IF coalesce((rank ->> inv.role)::int, 0) > coalesce((rank ->> cur_role)::int, 0) THEN
    UPDATE public.profiles SET role = inv.role WHERE id = auth.uid();
    cur_role := inv.role;
  END IF;

  UPDATE public.invites SET used_by = auth.uid(), used_at = now() WHERE id = inv.id;
  RETURN cur_role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invite(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;


-- ─── coach_teams: staff only ────────────────────────────────────────────────

DROP POLICY IF EXISTS "coach_teams: insert" ON public.coach_teams;
CREATE POLICY "coach_teams: insert"
  ON public.coach_teams FOR INSERT
  WITH CHECK (public.is_admin() OR (coach_id = auth.uid() AND public.is_staff()));
