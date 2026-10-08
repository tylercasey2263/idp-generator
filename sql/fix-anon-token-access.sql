-- ═══════════════════════════════════════════════════════════════════════════
--  fix-anon-token-access.sql
--
--  Run after fix-rls-recursion.sql.
--  Public pages (share links, parent token links, invite sign-up) used broad
--  anon SELECT policies that let anyone list ALL players, published IDPs,
--  parent invite tokens and unused invites. Replace them with SECURITY DEFINER
--  lookups that require the token, then drop the broad policies.
--  Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Token-scoped lookup functions ──────────────────────────────────────────

-- player-view.html: player header for a shared IDP link
CREATE OR REPLACE FUNCTION public.get_share_player(p_token text) RETURNS json
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT json_build_object('name', p.name, 'positions', p.positions, 'photo_url', p.photo_url)
  FROM public.idps i JOIN public.players p ON p.id = i.player_id
  WHERE i.share_token::text = p_token AND i.published = true
  LIMIT 1
$$;

-- login.html / auth.js: look up one unused invite by its token
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text) RETURNS json
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT json_build_object('id', id, 'role', role, 'email', email, 'label', label)
  FROM public.invites
  WHERE token = p_token AND used_at IS NULL
  LIMIT 1
$$;

-- parent.html token mode: linked players for the given parent invite tokens
CREATE OR REPLACE FUNCTION public.get_parent_links_by_tokens(p_tokens text[]) RETURNS json
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT coalesce(json_agg(json_build_object(
           'player_id', pp.player_id,
           'invite_token', pp.invite_token,
           'players', json_build_object('id', p.id, 'name', p.name, 'positions', p.positions, 'photo_url', p.photo_url)
         )), '[]'::json)
  FROM public.parent_players pp JOIN public.players p ON p.id = pp.player_id
  WHERE pp.invite_token = ANY (p_tokens)
$$;

-- parent.html token mode: published IDPs for players linked to those tokens
CREATE OR REPLACE FUNCTION public.get_published_idps_by_tokens(p_tokens text[]) RETURNS SETOF public.idps
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT i.* FROM public.idps i
  WHERE i.published = true
    AND i.player_id IN (SELECT player_id FROM public.parent_players WHERE invite_token = ANY (p_tokens))
  ORDER BY i.updated_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_share_player(text)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_links_by_tokens(text[])    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_published_idps_by_tokens(text[])  TO anon, authenticated;


-- ─── players: staff only (was: OR auth.uid() IS NULL) ───────────────────────

DROP POLICY IF EXISTS "players: staff read all" ON public.players;
CREATE POLICY "players: staff read all"
  ON public.players FOR SELECT
  USING (public.is_staff());


-- ─── idps: no blanket anon read (share links use get_idp_by_share_token) ────

DROP POLICY IF EXISTS "idps: anon published read" ON public.idps;


-- ─── invites: no blanket read of unused invites ─────────────────────────────

DROP POLICY IF EXISTS "invites: read unused by token" ON public.invites;


-- ─── parent_players: no blanket anon read; scope self-claiming to own email ─

DROP POLICY IF EXISTS "parent_players: anon token read"       ON public.parent_players;
DROP POLICY IF EXISTS "parent_players: own pending read"      ON public.parent_players;
DROP POLICY IF EXISTS "parent_players: accept own invite"     ON public.parent_players;

-- auth.js checkPendingParentLinks: a signed-in parent can see unclaimed rows for their email
CREATE POLICY "parent_players: own pending read"
  ON public.parent_players FOR SELECT TO authenticated
  USING (parent_id IS NULL AND lower(invite_email) = lower(auth.jwt() ->> 'email'));

-- Previously any signed-in user could claim ANY unclaimed row.
CREATE POLICY "parent_players: accept own invite"
  ON public.parent_players FOR UPDATE TO authenticated
  USING (parent_id = auth.uid()
         OR (parent_id IS NULL AND lower(invite_email) = lower(auth.jwt() ->> 'email')))
  WITH CHECK (parent_id = auth.uid());
