// ─── SUPABASE CONFIG ──────────────────────────────────
// After creating your Supabase project, replace these two values.
// Find them in: Supabase Dashboard → Settings → API
const SUPABASE_URL      = 'https://uarsodrarfnkodnfoclt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcnNvZHJhcmZua29kbmZvY2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTc2MzAsImV4cCI6MjA5MDQ5MzYzMH0.MMJT6W4ffRT9NEnLTgCcGDueeYuVG6gFNVOaM3oqVd8';

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

// Ensures a profile row always exists for the current user.
// Safe to call on every login — upserts so it never duplicates.
// Also keeps the email field in sync without touching the role.
async function ensureProfile(session) {
  const { user } = session;
  const name = user.user_metadata?.full_name || user.email;
  // Insert if not exists (ignoreDuplicates preserves the existing role)
  await sb.from('profiles').upsert({
    id:        user.id,
    full_name: name,
    role:      user.user_metadata?.role || 'coach',
  }, { onConflict: 'id', ignoreDuplicates: true });
  // Always sync email separately — safe because it doesn't touch role
  await sb.from('profiles').update({ email: user.email }).eq('id', user.id);
}

// If a coach pre-linked this email to any players, complete the association now.
// Returns true if any new links were found (so redirectAfterLogin can route to /parent.html).
async function checkPendingParentLinks(userId, email) {
  if (!email) return false;
  const normalised = email.toLowerCase();
  const { data: pending } = await sb
    .from('parent_players')
    .select('id')
    .eq('invite_email', normalised)
    .is('parent_id', null);
  if (!pending || pending.length === 0) return false;
  const ids = pending.map(r => r.id);
  await sb.from('parent_players')
    .update({ parent_id: userId, accepted: true })
    .in('id', ids);
  // Promote this user to the parent role
  await sb.from('profiles').update({ role: 'parent' }).eq('id', userId);
  return true;
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
  await ensureProfile(session);
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
  await ensureProfile(session);
  await checkPendingParentLinks(session.user.id, session.user.email);
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
