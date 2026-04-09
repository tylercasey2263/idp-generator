// ─── SUPABASE CONFIG ──────────────────────────────────
// Values are loaded from js/config.js (gitignored).
// See js/config.example.js for the required structure.
// js/config.js must be loaded BEFORE this file in every HTML page.
const sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// ─── SESSION HELPERS ──────────────────────────────────

async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

// ─── PROFILE CACHE (sessionStorage) ───────────────────
// Caches the profile for the duration of the browser tab session so we
// don't re-fetch it on every page navigation (saves 3-5 DB round trips).
function _profileKey(uid)  { return `idp_prof_${uid}`; }
const _SYNC_KEY  = uid => `idp_synced_${uid}`;
const _SETTINGS_KEY = 'idp_settings';

function _getCachedProfile(uid) {
  try { const r = sessionStorage.getItem(_profileKey(uid)); return r ? JSON.parse(r) : null; }
  catch(e) { return null; }
}
function _setCachedProfile(uid, profile) {
  try { sessionStorage.setItem(_profileKey(uid), JSON.stringify(profile)); } catch(e) {}
}
// Call after role changes so the stale cache is evicted
window.invalidateProfileCache = function(uid) {
  try {
    if (uid) { sessionStorage.removeItem(_profileKey(uid)); sessionStorage.removeItem(_SYNC_KEY(uid)); }
    sessionStorage.removeItem(_SETTINGS_KEY);
  } catch(e) {}
};

async function getProfile(userId) {
  const cached = _getCachedProfile(userId);
  if (cached) return cached;
  const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (data) _setCachedProfile(userId, data);
  return data;
}

// Ensures a profile row always exists for the current user.
// Runs only ONCE per browser-tab session (guarded by sessionStorage flag)
// to avoid redundant DB writes on every page navigation.
async function ensureProfile(session) {
  const { user } = session;
  const syncKey = _SYNC_KEY(user.id);
  if (sessionStorage.getItem(syncKey)) return; // already synced this session
  const name = user.user_metadata?.full_name || user.email;
  // Insert if not exists (ignoreDuplicates preserves the existing role)
  await sb.from('profiles').upsert({
    id:        user.id,
    full_name: name,
    role:      user.user_metadata?.role || 'coach',
  }, { onConflict: 'id', ignoreDuplicates: true });
  // Sync email (safe — email column added in rbac-phase1-critical.sql)
  await sb.from('profiles').update({ email: user.email }).eq('id', user.id).select();
  sessionStorage.setItem(syncKey, '1');
}

// If the URL contains ?invite=TOKEN, apply the role from the invite and mark it used.
// Respects role hierarchy — never demotes a higher-level user.
async function processInvite(userId, token) {
  if (!token) return;
  const { data: invite } = await sb.from('invites')
    .select('id, role')
    .eq('token', token)
    .is('used_at', null)
    .maybeSingle();
  if (!invite) return;

  const hierarchy = { admin: 3, coach: 2, parent: 1 };
  const { data: profile } = await sb.from('profiles').select('role').eq('id', userId).maybeSingle();
  if ((hierarchy[invite.role] || 0) > (hierarchy[profile?.role] || 0)) {
    await sb.from('profiles').update({ role: invite.role }).eq('id', userId);
  }
  await sb.from('invites')
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq('id', invite.id);
}

// If a coach pre-linked this email to any players, complete the association now.
// Returns true if any new links were found (so redirectAfterLogin can route to /parent.html).
// Never downgrades a coach or admin — highest permission always wins.
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
  // Only set role to parent if they aren't already a coach or admin
  const { data: profile } = await sb.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile && !['coach', 'admin'].includes(profile.role)) {
    await sb.from('profiles').update({ role: 'parent' }).eq('id', userId);
  }
  return true;
}

// Compute the app's base path so redirects work on both localhost
// (served from /) and GitHub Pages subdirectories (/idp-generator/).
function appBase() {
  // Strip the filename (and anything after) from the current path
  return window.location.pathname.replace(/\/[^/]*$/, '');
}

// Redirect to login if no active session. Returns session or null.
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${appBase()}/login.html?next=${next}`;
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
    window.location.href = `${appBase()}/login.html`;
    return null;
  }
  return { session, profile };
}

// Require admin role only. Redirects coaches/parents to dashboard.
// Returns { session, profile } or null.
async function requireAdmin() {
  const ctx = await requireCoach();
  if (!ctx) return null;
  if (ctx.profile.role !== 'admin') {
    window.location.href = `${appBase()}/dashboard.html`;
    return null;
  }
  return ctx;
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
  const session = await getSession();
  if (session) window.invalidateProfileCache(session.user.id);
  await sb.auth.signOut();
  window.location.href = `${appBase()}/login.html`;
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

async function getClaudeModel() {
  const { data } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'claude_model')
    .maybeSingle();
  return data?.value || 'claude-sonnet-4-5';
}
