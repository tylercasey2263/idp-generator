-- ═══════════════════════════════════════════════════════════════════════════
--  Parent Feedback — Run this in the Supabase SQL Editor
--  Safe to run multiple times (fully idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. TABLE ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_feedback (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  invite_token text,                                          -- set for anon/token-based parents
  parent_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL, -- set for logged-in parents
  message      text        NOT NULL,
  is_read      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_feedback ENABLE ROW LEVEL SECURITY;

-- ─── 2. DROP OLD POLICIES (safe no-op if they don't exist yet) ───────────────
DROP POLICY IF EXISTS "parent_feedback: anyone insert"  ON public.parent_feedback;
DROP POLICY IF EXISTS "parent_feedback: staff select"   ON public.parent_feedback;
DROP POLICY IF EXISTS "parent_feedback: staff update"   ON public.parent_feedback;

-- ─── 3. POLICIES ─────────────────────────────────────────────────────────────

-- Any visitor (anon token-based parent OR logged-in parent) can submit feedback
CREATE POLICY "parent_feedback: anyone insert"
  ON public.parent_feedback FOR INSERT
  WITH CHECK (true);

-- Only coaches and admins can read feedback
CREATE POLICY "parent_feedback: staff select"
  ON public.parent_feedback FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );

-- Coaches and admins can mark feedback as read (UPDATE is_read only)
CREATE POLICY "parent_feedback: staff update"
  ON public.parent_feedback FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('coach', 'admin'))
  );
