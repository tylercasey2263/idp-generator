# Player IDP — Local Feature Backlog

---

## ⚠️ PENDING MANUAL ACTIONS REQUIRED

### 1. Run GotSport Sync (update match scores + dates)

Bun is already installed. Dependencies are already in `scripts/node_modules`.
The date-population bug has been fixed — match dates should now populate correctly.

**Step 1 — Create your .env file:**
```
copy scripts\.env.example scripts\.env
```
Open `scripts/.env` and fill in your service role key:
- Go to: **Supabase Dashboard → Project Settings → API**
- Copy the `service_role` key (not the anon key)
- Paste it as the value for `SUPABASE_SERVICE_KEY`

**Step 2 — Run the sync:**
```
bun run scripts/sync-gotsport.js
```

**Expected output:** 16 teams processed, standings + match results upserted for each.
Look for `Merged schedule data into X/Y match rows` per team — if X < Y, the
unmatched opponent names will be logged as `No schedule match for opponent: "..."`.
Re-run any time you want to refresh scores from GotSport.

---

### 2. Rethink data import: PlayMetrics players/teams + GotSport scores

The weekly GotSport workflow was auto-disabled by GitHub (inactivity) and failed May–June while Supabase was paused. Plan a fresh import of players and teams from PlayMetrics, assign players to teams, then re-sync standings/scores.

---

### 3. Configure Resend for parent email notifications

Without this, IDPs still publish fine — emails just won't be sent.

**Step 1 — Get a Resend API key:**
- Sign up / log in at https://resend.com
- Go to: **API Keys → Create API Key**
- Copy the key (starts with `re_`)

**Step 2 — Add to Supabase Edge Function secrets:**
- Go to: **Supabase Dashboard → Edge Functions → notify-parent → Secrets**
- Add secret: `RESEND_API_KEY` = `re_your_key_here`
- Optional: add `RESEND_FROM` = `"Player IDP <noreply@yourdomain.com>"` (requires a verified domain in Resend — skip this to use the default Resend sender)

> Note: `RESEND_API_KEY` should also be set on the `send-invite` function if not already done (same dashboard location, different function).

---

## ✅ RLS + security hardening — DONE (2026-10-08)
- RLS enabled on all public tables (`sql/fix-rls-enable.sql`), profiles recursion fixed (`sql/fix-rls-recursion.sql`)
- Anonymous access only via token-scoped RPCs (`sql/fix-anon-token-access.sql`)
- New sign-ups are parents; coach/admin only via `redeem_invite()`; coach_teams insert staff-only (`sql/fix-signup-roles.sql`)
- `notify-parent` edge function deployed; publish from generate + view-idp both notify

---

## ✅ Match result dates not populating — FIXED
- Root cause 1: schedule parser assumed column 0 was always a numeric game ID — now dynamically detects the date column by scanning for a month name, works regardless of column layout
- Root cause 2: H2H matrix uses abbreviated opponent names; schedule page uses full names — fixed with Jaccard token-overlap fuzzy matching (≥2 shared tokens + score ≥ 0.35)
- 18/18 unit tests passing; run the sync (item 1 above) to populate dates in the DB

---

## ✅ Fix match results — DONE
- Result rows on view-idp.html (Season tab) now use expandable cards matching team.html
- Rows show Opponent · Score · W/L/D badge; click to expand and reveal Date, Home/Away, Venue
- Results ordered by match_date (nulls last), then opponent
- sync-gotsport.js now also scrapes the GotSport games page (`/games?group=...`) to populate match_date, is_home, venue — run the sync to get dates

## ✅ Add players to multiple teams — DONE
- Edit Player modal now has an "Additional Teams" section — checkboxes for all other club teams
- Pre-checked based on existing player_teams records; saving adds/removes entries automatically
- view-idp.html: "⎘ Copy IDP" button in the viewer toolbar duplicates any IDP as a new unpublished draft, useful for adapting a plan for a different team or season context

## ✅ Guest player added to lineup manager — DONE

## ✅ Email invites — DONE
- Invites now send automatically via Resend (Supabase Edge Function `send-invite`)
- Nicely formatted HTML email with club name, role, and accept button
- Fallback: "Open in email app" link still available if edge function fails
- Resend button on invite list also uses the edge function
- Login page pre-fills email + name from invite token
- **Setup required:** Add `RESEND_API_KEY` to Supabase Edge Function secrets (Dashboard → Edge Functions → send-invite → Secrets). Optional: set `RESEND_FROM` to a verified sender address.

## ✅ Coaching dashboard & coach assignment — DONE
- Dashboard already filters to show only the coach's assigned teams (via `coach_teams` + RLS)
- Admins see all teams; coaches see only their assigned teams
- team.html coaching staff section: admin can assign any coach via dropdown, remove coaches
- Coaches can self-link to a team via "Link me to this team" button on team page

## ✅ Fix edit player modal — DONE
- Added `max-height: 90vh; overflow-y: auto` to `.modal` so it never overflows the viewport

## ✅ Import / Transfer player in team view — DONE
- "⇄ Import Player" button in team page header
- Search any existing player by name (excludes players already on this team)
- **+ Add**: adds player as a secondary team link — they stay on their original team AND appear here
- **⇄ Transfer**: moves player's primary team to this one, with an inline confirm step showing which team they're leaving
- After either action, roster refreshes automatically

## ✅ UI: All Teams tab in sidebar — DONE
- Already present in nav.js for both admin and coach roles

## ✅ PWA — Progressive Web App — DONE
- `manifest.json` created with name, icons, theme colour, standalone display
- Icons generated via `scripts/generate-icons.py` (Pillow): 96, 192, 512, 512-maskable, 180, favicon-32, favicon-16
- `sw.js` created: cache-first for static assets, network-only for Supabase/Claude/Resend APIs, offline fallback to dashboard
- PWA meta tags + SW registration injected into all 15 HTML pages via `scripts/inject-pwa-tags.py`
- "↓ Install App" button added to sidebar (shown only when Chrome fires `beforeinstallprompt`)
- Mobile CSS pass done on: dashboard, team, players, settings, generate, team-plan, view-idp
- Remaining nice-to-haves (post-MVP): iOS launch images, push notifications, background sync

---

## ✅ Google Login — DONE
- Google OAuth configured via Supabase Authentication → Providers
- "Sign in with Google" button on login.html (login tab only)

---

## ✅ IDP Share Link — DONE
- "⤴ Share IDP" button in the IDP viewer toolbar generates a token-based public URL (no login required)
- Share modal: URL box (click to copy), email mailto link, native OS share sheet on mobile
- "Revoke & generate new link" immediately invalidates the old token and creates a fresh one
- Public share page (`player-view.html`) shows club logo, player photo/initials, IDP published date, full plan, and confidentiality footer

---

## ✅ Season / Cohort View — DONE
- `season.html` — per-team timeline of all player IDPs across a season
- Players grouped by phase: Foundation / Assert / Progress / Excel
- Mini dot timeline per player, color-coded by phase with connector lines
- Stats strip: players, IDPs generated, coverage %, leading phase
- Filter pills per phase with live counts
- Accessible from the Team page header via "📅 Season View" button

---

## ✅ IDP Progress Tracker — DONE
- Tab on view-idp.html showing IDPs chronologically oldest→newest
- Visual timeline with dots, focus badges, strength/improvement tags per IDP
- Delta indicator (▲ +1 strength / ▼ fewer) comparing each IDP to the previous
- "Latest" highlight on most recent entry; "View full IDP →" link into the IDPs tab

---

## ✅ Player Notes / Coach Journal — DONE
- Tab on view-idp.html: private notes per player, never shown to parents
- Add note textarea + timestamp; newest notes shown first
- Delete with confirmation; tab badge updates live (e.g. "Coach Notes (3)")
- New `player_notes` table in Supabase with RLS (coach sees only their own notes)

---

## ✅ IDP Expiry / "Due for Review" Flag — DONE
- Settings page: "IDP Review Period (days)" field, saved as `idp_review_days` setting (default 60)
- Dashboard: "Due for Review" stat (replaces Published %) — amber highlight when count > 0
- Team page: amber banner "N players are due for an IDP review" above the roster
- Per-player ⏰ Due badge in the Latest IDP column for overdue players

---

## ✅ Session History on Team Page — DONE
- Session cards now show full weekday date format (e.g. Wed, April 2, 2026)
- "IDPs generated" chip row at the bottom of each session card — teal chips linking to each player's IDP page
- Chips matched by session date ±1 day to catch timezone edge cases
- IDP date index (`teamIDPsByDate`) built once in `loadPlayers()` and reused by `loadSessions()`

---

## 🏢 Multi-Club / Organisation Support
**Effort:** Large (~1 day+)
- Allow one admin account to manage multiple clubs (e.g., a coaching consultancy)
- Each club has its own branding, settings, and user pool
- Currently hard-wired to one club in settings table
