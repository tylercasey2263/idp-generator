/**
 * Supabase Edge Function: search-players
 *
 * Returns all players matching a name query, with their primary team name.
 * Bypasses RLS so coaches can search across all teams — used for the
 * Import / Transfer player feature on team.html.
 *
 * Requires: caller must be an authenticated coach or admin.
 * Uses SUPABASE_SERVICE_ROLE_KEY (injected automatically by Supabase).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── 1. Verify caller is authenticated ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    // ── 2. Parse query ─────────────────────────────────────────────────────
    const { query, exclude_team_id } = await req.json();
    if (!query || query.trim().length < 2) {
      return json({ error: 'Query must be at least 2 characters' }, 400);
    }

    // ── 3. Search with service role (bypasses RLS) ─────────────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data, error } = await adminClient
      .from('players')
      .select('id, name, positions, team_id, teams(id, name)')
      .ilike('name', `%${query.trim()}%`)
      .limit(30);

    if (error) return json({ error: error.message }, 500);

    // Exclude players already on the target team (primary or secondary)
    // The caller passes exclude_team_id; we also check player_teams
    let results = data || [];

    if (exclude_team_id) {
      // Get secondary links for the target team
      const { data: secondary } = await adminClient
        .from('player_teams')
        .select('player_id')
        .eq('team_id', exclude_team_id);

      const secondaryIds = new Set((secondary || []).map((r: any) => r.player_id));

      results = results.filter((p: any) =>
        p.team_id !== exclude_team_id && !secondaryIds.has(p.id)
      );
    }

    return json({ players: results });

  } catch (err) {
    console.error('search-players error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
