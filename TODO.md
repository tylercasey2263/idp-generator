# Player IDP — Feature Backlog

## 🔐 Google Login
**Effort:** Medium (~45 min, mostly Google Cloud Console setup)

### Steps when ready:
1. Go to https://console.cloud.google.com → New Project → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web Application
3. Add authorized redirect URI: `https://uarsodrarfnkodnfoclt.supabase.co/auth/v1/callback`
4. Copy Client ID + Client Secret
5. In Supabase → Authentication → Providers → Google → paste both values → Enable
6. Claude adds "Sign in with Google" button to login.html (5 min)

---

## 📋 TDP — Team Development Plan
**Effort:** Medium (1-2 hours)

Generate a team-level plan by aggregating all player IDPs on a team.
- Button on team page: "Generate Team Plan"
- Fetches latest IDP for each player
- Sends combined data to Claude with a team-focused prompt
- Output: team strengths, collective weaknesses, suggested training themes
- Save/publish same as individual IDPs

---

## 📧 Coach & Admin Invite Links
**Effort:** Medium (~1 hour)

- Admin generates invite link with a pre-set role (Coach or Admin)
- Token stored in new `invites` table in Supabase
- User signs up via `/login.html?invite=TOKEN`
- After signup, role is automatically assigned from the token
- Manage active invites in Settings page

### SQL needed:
```sql
CREATE TABLE public.invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text UNIQUE DEFAULT gen_random_uuid()::text,
  role       text NOT NULL CHECK (role IN ('coach','admin')),
  label      text,
  created_by uuid REFERENCES public.profiles(id),
  used_by    uuid REFERENCES public.profiles(id),
  used_at    timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.invites DISABLE ROW LEVEL SECURITY;
```

---

## ⚽ Custom Lineup Manager (replace Coach Assist iframe)
**Effort:** Large (~2-3 hours)

Build a fully integrated lineup/formation tool using our own teams and players.

### Features:
- SVG soccer pitch (field lines, goals, center circle, penalty areas)
- Drag-and-drop player tokens positioned on the field
- Formation presets: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2
- Bench area for unplaced players
- Team selector pulling from real Supabase teams
- Player roster auto-loaded from selected team
- Save lineup to Supabase (loadable next session)
- Print / export formation view

### SQL needed:
```sql
CREATE TABLE public.lineups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name       text NOT NULL DEFAULT 'Lineup',
  formation  text,
  positions  jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.lineups DISABLE ROW LEVEL SECURITY;
```

---

## ✅ Completed
- [x] Inline IDP edit mode
- [x] Netlify deployment
- [x] Supabase auth (email/password)
- [x] Coach dashboard + team management
- [x] Player management (add, edit, delete, CSV import)
- [x] Club-wide All Players page with search & filter
- [x] IDP generator with Claude AI
- [x] Save & Publish IDPs
- [x] Parent portal with invite links
- [x] Sidebar navigation (all pages)
- [x] Settings page (admin only) — club name, logo, API key, user management
- [x] Help & How-To page with FAQ
- [x] First-visit onboarding tooltips
- [x] View IDP page (coach preview, IDP history by date)
- [x] Fix duplicate IDPs on parent portal
- [x] Team search on dashboard
- [x] API key masked in settings (last 4 chars only)
- [x] Root URL redirects to login
- [x] Custom Lineup Manager (replacing Coach Assist iframe) ← IN PROGRESS
