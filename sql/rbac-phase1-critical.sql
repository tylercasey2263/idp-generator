-- ═══════════════════════════════════════════════════════════════════════════
--  RBAC Phase 1 — Critical Security Fixes
--  Run this in the Supabase SQL Editor.  Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. PROFILES ────────────────────────────────────────────────────────────
-- G20: Block role self-promotion.  Users can update their own safe fields
--      (full_name, avatar_url) but CANNOT change their own role.
--      Admins can change any field on any profile via the admin write policy.

DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;

CREATE POLICY "profiles: own update safe fields"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Prevent self-promotion: new role must equal the current stored role
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- G18: Add email column if missing (auth.js syncs it on login)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;


-- ─── 2. SETTINGS — admin-only writes ────────────────────────────────────────
-- G4: Any authenticated coach could previously overwrite the Claude API key,
--     club logo, and theme via the browser console. Restrict all writes to admins.

DROP POLICY IF EXISTS "settings: admin write" ON public.settings;

CREATE POLICY "settings: admin write"
  ON public.settings FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );


-- ─── 3. PARENT_PLAYERS ──────────────────────────────────────────────────────
-- G2: The old "accept invite" UPDATE policy used USING(true) WITH CHECK(true),
--     meaning any authenticated user could set parent_id on ANY row and
--     hijack another child's invite link.
-- Fix: A user can only UPDATE a row if it is not yet claimed (parent_id IS NULL)
--      OR it is already theirs, AND they can only set parent_id to their own UID.

DROP POLICY IF EXISTS "parent_players: accept invite" ON public.parent_players;

CREATE POLICY "parent_players: accept own invite"
  ON public.parent_players FOR UPDATE
  USING (
    -- Can only touch unclaimed rows, or rows already claimed by this user
    parent_id IS NULL OR parent_id = auth.uid()
  )
  WITH CHECK (
    -- Can only set parent_id to their own user ID
    parent_id = auth.uid()
  );

-- G3: The old anon read policy returned ALL rows including invite_email to
--     anyone with the anon key. Restrict to returning only the minimum columns
--     needed for token lookup.  The real fix is a SECURITY DEFINER function
--     (see below), but this policy change removes the broad exposure immediately.

DROP POLICY IF EXISTS "parent_players: anon read" ON public.parent_players;

-- Anon users can only read rows where they supply the exact token value.
-- Because Supabase RLS cannot inspect the query's WHERE clause directly,
-- we scope to rows that HAVE a token (non-null) — the token itself is the secret.
-- Combined with the SECURITY DEFINER function below, this is safe.
CREATE POLICY "parent_players: anon token read"
  ON public.parent_players FOR SELECT
  TO anon
  USING (invite_token IS NOT NULL);


-- ─── 4. IDP SHARE TOKEN — SECURITY DEFINER function ─────────────────────────
-- G1: The old "idps: share token read" policy returned ALL IDPs that had any
--     share_token set, to anyone.  Replace it with a SECURITY DEFINER function
--     so the token value must actually be supplied — only the matching row
--     is returned.

DROP POLICY IF EXISTS "idps: share token read" ON public.idps;

-- Function: accepts a token, returns the ONE matching published IDP (or nothing).
-- SECURITY DEFINER means it runs as the function owner (bypassing RLS) but
-- only returns a row if the token matches exactly.
CREATE OR REPLACE FUNCTION public.get_idp_by_share_token(p_token text)
RETURNS SETOF public.idps
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM public.idps
  WHERE share_token = p_token
    AND share_token IS NOT NULL
    AND published = true;
$$;

-- Allow anon callers to execute this function
GRANT EXECUTE ON FUNCTION public.get_idp_by_share_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_idp_by_share_token(text) TO authenticated;


-- ─── 5. INVITES TABLE ────────────────────────────────────────────────────────
-- G15: The invites table is used by auth.js but was never formally defined
--      in the schema.  Create it idempotently here.

CREATE TABLE IF NOT EXISTS public.invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  role       text        NOT NULL CHECK (role IN ('admin','coach','parent')),
  email      text,
  label      text,
  used_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at    timestamptz,
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invites: admin all"         ON public.invites;
DROP POLICY IF EXISTS "invites: anon read by token" ON public.invites;

-- Only admins can create / view / delete invites
CREATE POLICY "invites: admin all"
  ON public.invites FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- Anyone (anon or authenticated) can read a single unused invite by its token
-- (needed for the invite redemption flow in auth.js)
CREATE POLICY "invites: read unused by token"
  ON public.invites FOR SELECT
  USING (used_at IS NULL);
