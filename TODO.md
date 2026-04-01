# Player IDP — Feature Backlog

## 🔐 Google Login
**Effort:** Medium (~45 min, mostly Google Cloud Console setup)

### Steps when ready:
1. Go to https://console.cloud.google.com → New Project → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web Application
3. Add authorized redirect URI: `https://uarsodrarfnkodnfoclt.supabase.co/auth/v1/callback`
4. Copy Client ID + Client Secret
5. In Supabase → Authentication → Providers → Google → paste both values → Enable
6. Add "Sign in with Google" button to login.html

---

## 📤 IDP Email / Share
**Effort:** Medium (~1 hour)

- "Share IDP" button on view-idp.html
- Generates a public read-only URL (token-based, no login required)
- Or: email the HTML file directly via a transactional email service (Resend, SendGrid)

---

## 📅 Season / Cohort View
**Effort:** Medium (~2 hours)

- Timeline view showing all IDPs for a team across a season
- Group by phase (Foundation / Assert / Progress / Excel)
- Useful for parent evenings and season reviews

---

## 🏅 Player Progress Tracker
**Effort:** Large (~3 hours)

- Track improvement scores across IDP versions (e.g. a coach manually rates 1–5 per improvement area after each session)
- Sparkline chart per player showing trend over time
- Highlight most improved players on the dashboard

---

## ✅ Completed

### Core App
- [x] Inline IDP edit mode
- [x] Netlify → GitHub Pages deployment
- [x] Supabase auth (email/password)
- [x] Coach dashboard + team management
- [x] Player management (add, edit, delete, CSV import)
- [x] Club-wide All Players page with search & filter
- [x] IDP generator with Claude AI (`claude-sonnet-4-20250514`)
- [x] Save & Publish IDPs to Supabase
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

### Lineup Manager
- [x] SVG pitch with full field markings
- [x] Drag-and-drop player tokens
- [x] Formation presets: 11v11 (7), 9v9 (5), 7v7 (5)
- [x] Custom free-place mode
- [x] Assign-picker on click
- [x] Save named lineups to Supabase (`lineups` table)
- [x] Load saved lineups per team (restores format, formation, positions)
- [x] Delete saved lineups
- [x] Print view

### Team Development Plan
- [x] Two-panel layout (inputs + infographic)
- [x] Claude AI aggregates all player IDPs into team-level plan
- [x] Team strengths, improvements, training themes, player spotlights, game week focus, season vision
- [x] Save & Publish to `team_plans` table

### UX Improvements
- [x] Dashboard stats bar (players, IDPs generated, % published)
- [x] IDP age/timestamp on team page badges
- [x] Team summary line (player count, IDP coverage)
- [x] Parent portal step-by-step empty state
- [x] Player notes scratchpad (coach-only, on edit modal)
- [x] IDP "What Changed" diff view between versions
- [x] Training session log (date, focus, notes) per team
- [x] Mobile responsive layout (generate.html, team-plan.html)
- [x] Toast notifications (dashboard, team, players pages)
- [x] Delete confirmation modals (players, team page)
- [x] 🎙 Microphone dictation on all note/transcript fields
