-- ═══════════════════════════════════════════════════════════════════════════
--  Player photos, user avatars, and GotSport coach sync
--  Run this in the Supabase SQL Editor. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. SCHEMA ADDITIONS ────────────────────────────────────────────────────

-- Player profile photo (stored in Supabase Storage bucket 'player-photos')
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS photo_url text;

-- User profile avatar (stored in Supabase Storage bucket 'avatars')
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Coaches scraped from GotSport per team/group
CREATE TABLE IF NOT EXISTS public.team_coaches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  gotsport_group_id  text NOT NULL,
  name               text NOT NULL,
  role               text NOT NULL DEFAULT 'Coach',
  last_synced        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gotsport_group_id, name)
);
ALTER TABLE public.team_coaches DISABLE ROW LEVEL SECURITY;


-- ─── 2. SUPABASE STORAGE SETUP ──────────────────────────────────────────────
-- ⚠️  Buckets cannot be created via SQL — do these steps in the Supabase dashboard:
--
--   Storage → New bucket → Name: "player-photos"  → Public: ON
--   Storage → New bucket → Name: "avatars"         → Public: ON
--
-- The Storage RLS policies below allow any authenticated user to upload to their
-- own path and read from all paths (since buckets are public).


-- ─── 3. STORAGE RLS POLICIES ────────────────────────────────────────────────
-- Applied to storage.objects (Supabase's built-in storage RLS table).

-- Drop old policies if re-running
DROP POLICY IF EXISTS "player-photos: auth upload"  ON storage.objects;
DROP POLICY IF EXISTS "player-photos: auth update"  ON storage.objects;
DROP POLICY IF EXISTS "player-photos: public read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars: auth upload"         ON storage.objects;
DROP POLICY IF EXISTS "avatars: auth update"         ON storage.objects;
DROP POLICY IF EXISTS "avatars: public read"         ON storage.objects;

-- player-photos: any authenticated user can upload/update; everyone can read
CREATE POLICY "player-photos: auth upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-photos');

CREATE POLICY "player-photos: auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-photos');

CREATE POLICY "player-photos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'player-photos');

-- avatars: same rules
CREATE POLICY "avatars: auth upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars: auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
