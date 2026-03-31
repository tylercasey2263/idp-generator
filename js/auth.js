// ─── SUPABASE CONFIG ──────────────────────────────────
// After creating your Supabase project, replace these two values.
// Find them in: Supabase Dashboard → Settings → API
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── SESSION HELPERS ──────────────────────────────────

async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

async function getProfile(userId) {
  const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
  return data;
}

// Redirect to login if no active session. Returns session or null.
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?next=${next}`;
    return null;
  }
  return session;
}

// Require coach or admin role. Returns { session, profile } or null.
async function requireCoach() {
  const session = await requireAuth();
  if (!session) return null;
  const profile = await getProfile(session.user.id);
  if (!profile || !['coach', 'admin'].includes(profile.role)) {
    window.location.href = '/login.html';
    return null;
  }
  return { session, profile };
}

// Require parent role (or any authenticated user for invite acceptance).
async function requireParent() {
  const session = await requireAuth();
  if (!session) return null;
  const profile = await getProfile(session.user.id);
  return { session, profile };
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = '/login.html';
}

// ─── CLAUDE API KEY ───────────────────────────────────
// Fetches the Claude API key from the settings table.
// Only succeeds if the user is an authenticated coach/admin.
async function getClaudeApiKey() {
  const { data, error } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'claude_api_key')
    .single();
  if (error || !data) return null;
  return data.value;
}
