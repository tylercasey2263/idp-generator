# Player IDP — Coaching Platform

A full-stack web app for youth football coaches to generate AI-powered Individual Development Plans (IDPs), manage teams and players, run Team Development Plans (TDPs), build and save lineups, log training sessions, and share published plans with parents — all backed by Supabase and Claude AI.

## Live Site

[https://shimmering-biscochitos-72e009.netlify.app](https://shimmering-biscochitos-72e009.netlify.app)

---

## Pages & Features

### 🏠 Dashboard (`dashboard.html`)
- Overview of all your assigned teams with a live stats bar (total players, IDPs generated, coverage %, Due for Review count)
- Create and delete teams
- Search/filter teams by name
- "Due for Review" amber highlight when players have IDPs older than the configured review period
- Admins see all teams; coaches see only their assigned teams

### 👥 Team Page (`team.html`)
- Full player roster for a selected team with IDP status badges (Published / Draft + relative timestamp)
- Add, edit, and delete players with position picker
- **Player photos** — click a player's avatar to upload a photo (stored in Supabase `player-photos` bucket); initials fallback with 📷 hover overlay
- **Secondary teams** — edit a player to assign them to additional teams via checkboxes; links stored in `player_teams`
- Coach notes field on each player (with 🎙 microphone dictation)
- CSV import for bulk player creation
- **Import / Transfer player** — search any existing club player by name, add them as a secondary team link (they stay on their original team) or transfer their primary team
- Training Sessions log — add date, focus area, and freeform notes (with 🎙 mic), view history, delete sessions
- **League Results** — live standings (position, W/L/D/GF/GA/PTS) and collapsible match results pulled from SLYSA GotSport; team name shows the app team name (not the GotSport internal name); direct link to the division page
- **Coaching Staff** — coaches linked to this team; admins can assign/remove coaches; coaches can self-link via "Link me to this team"
- **📅 Season View** button → opens Season / Cohort View for that team
- **✦ Team Plan** button → opens Team Development Plan generator
- Quick links to generate/view IDPs and open the lineup manager
- ⏰ "Due for Review" amber banner when players are overdue for a new IDP

### ✦ IDP Generator (`generate.html`)
- Paste or dictate a voice memo transcript for any player
- Fill in name, position(s), plan duration, and focus area(s)
- **Clean & Generate** — sends to Claude (`claude-sonnet-4-20250514`) for grammar cleanup + structured extraction
- **Generate As-Is** — skips AI, builds directly from raw text
- Rendered dark-theme infographic: strengths, improvements, 30-day development plan, micro-habits, 12-month vision, parent note
- In-place **Edit mode** — click any text element to edit it directly before publishing
- Download as standalone HTML or Save as PDF (print dialog)
- Every publish creates a **new version** — full history preserved, never overwrites
- 🎙 Microphone dictation on the transcript field
- **Parent notification** — automatically emails linked parents when an IDP is published (requires Resend setup)

### 📊 View IDP (`view-idp.html`)
Five-tab layout per player:

**Season tab**
- Live league standings and match results for all of the player's teams pulled from GotSport
- Flat match-by-match results: date, opponent, Home/Away badge, score, W/L/D badge

**IDPs tab**
- Full IDP history sorted newest-first
- **⇄ What Changed** diff panel between consecutive versions
- Publish, edit, share (token link), or print any IDP
- **⎘ Copy IDP** — duplicate any IDP as a new draft

**Progress tab**
- Visual chronological timeline of all IDPs
- Delta chips between entries (▲ +1 strength / ▼ fewer / — same)

**Coach Notes tab**
- Private journal per player — never shared with parents
- Timestamped entries; tab badge shows live count

**Parent Feedback tab**
- Async messages from parents; unread count badge
- Feedback marked read automatically on tab open

### 👨‍👩‍👧 Parent Portal (`parent.html`)
- Parents see published IDPs for their linked child/children
- **Multi-child tab bar** — when a parent has multiple children, tabs appear at the top with each child's name and avatar
- **New IDP badge** — amber "● New" badge on the child tab when an IDP has been published since the parent last visited; clears on click
- **"IDP coming soon"** empty state explains that the parent will receive an email when their child's first IDP is published
- **Player photo** — parents can upload/update a photo for their child
- **Message your coach** — per-player feedback form with 🎙 mic dictation
- View and Save-as-PDF any published plan
- Version tabs when multiple IDPs exist for the same player
- Two access paths: invite token (no account needed) or logged-in Supabase session

### 🏆 Team Development Plan (`team-plan.html`)
- Aggregates all published player IDPs for a team
- Coach adds optional context notes (with 🎙 mic)
- Claude synthesises: team strengths, collective improvements, training themes, player spotlights, game week focus, season vision, coach note
- Every save creates a new version (same versioning model as IDPs)
- Team name pre-populated from URL param; player list loaded automatically
- Save & Publish to Supabase `team_plans` table

### ⚽ Lineup Manager (`lineup.html`)
- SVG football pitch with accurate markings
- Drag-and-drop player tokens; supports secondary-team players
- Formations: 11v11, 9v9, 7v7, plus Custom free-place mode
- Save, load, and delete named lineups scoped per team
- Print-friendly output

### 📅 Season / Cohort View (`season.html`)
- Per-team timeline showing every player's IDP history across a season
- Players grouped into phase columns: Foundation / Assert / Progress / Excel
- Mini dot timeline per player, colour-coded by phase with connector lines
- Stats strip: players, IDPs generated, coverage %, leading phase
- Filter pills per phase with live counts

### 🙋 All Players (`players.html`)
- Club-wide player list with search and position filter
- Add, edit, delete players
- Links to individual player IDP history

### 👤 Users (`users.html`) — Admin only
- View all registered users with role badges
- Filter by role (Admin / Coach / Parent)
- Change any user's role via dropdown
- **Manage Teams** — per-coach modal with live checkboxes to assign or unassign teams
- Invite new users via email (Resend) or copy invite link
- Delete users (removes team assignments, parent links, and notes)
- Invite history with resend and delete actions

### ⚙️ Settings (`settings.html`)
- **My Profile** — all coaches; update display name and upload avatar
- **Club Information** — admin only; club name and logo
- **Theme Colors** — admin only; 9 presets plus free color picker; live preview; applied site-wide
- **API Key** — admin only; Anthropic Claude API key
- **User Management** link — admin only

### 🔐 Login (`login.html`)
- Email/password sign-in and account creation
- **Google Sign-In** for one-click OAuth login
- Invite token auto-redeems role and links parent players on first login

### ❓ Help (`help.html`)
- Getting started guide with role-tagged steps
- CSV import format reference
- Roles & Permissions explainer
- Interactive page tours
- FAQ

---

## Roles & Permissions

| Capability | Admin | Coach | Parent |
|---|:---:|:---:|:---:|
| View all teams | ✅ | ✅ (assigned only) | — |
| Create / delete teams | ✅ | ✅ | — |
| Add / edit / delete players | ✅ | ✅ (own teams) | — |
| Generate & publish IDPs | ✅ | ✅ (own teams) | — |
| View IDP history & notes | ✅ | ✅ (own teams) | — |
| Import player from another team | ✅ | ✅ | — |
| Invite parents | ✅ | ✅ | — |
| Generate Team Development Plan | ✅ | ✅ (own teams) | — |
| Lineup Manager | ✅ | ✅ | — |
| View child's published IDPs | — | — | ✅ |
| Leave parent feedback | — | — | ✅ |
| Print / PDF IDP | ✅ | ✅ | ✅ |
| Upload player photo | ✅ | ✅ | ✅ |
| Manage users & roles | ✅ | — | — |
| Assign coaches to teams | ✅ | — | — |
| Edit club settings & API key | ✅ | — | — |

Role changes take effect on the user's next sign-in (profile cache clears on sign-out).

---

## Microphone Dictation

Available on all multi-sentence text fields throughout the app (transcript, coach notes, session notes, coaching notes, parent feedback). Click 🎙 to start, click again to stop. Uses the browser Web Speech API — works best in Chrome.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework |
| Fonts | Google Fonts — Barlow Condensed + Inter |
| Auth & DB | Supabase (PostgreSQL + PostgREST + RLS) |
| Storage | Supabase Storage (`player-photos`, `avatars` — both public) |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) via direct browser fetch |
| Email | Resend (via Supabase Edge Functions) |
| Hosting | Netlify (static) |
| League sync | Bun + Cheerio scraper → Supabase |

---

## Database Tables

| Table | Purpose |
|---|---|
| `profiles` | User accounts — role (`admin` / `coach` / `parent`), name, avatar, email |
| `teams` | Teams per club (includes `gotsport_group_id` for league sync) |
| `coach_teams` | Many-to-many coach↔team assignments |
| `players` | Players per team (includes `notes`, `photo_url`) |
| `player_teams` | Many-to-many player↔team links (secondary team assignments) |
| `idps` | Generated IDPs — all versions kept; `published`, `share_token` |
| `team_plans` | Team Development Plans — all versions kept |
| `player_notes` | Private coach journal entries per player (coach-scoped RLS) |
| `parent_players` | Player↔parent connections; `invite_token`, `invite_email`, `accepted` |
| `parent_feedback` | Async parent messages to coaches; per-player |
| `invites` | Invite tokens for coach/admin/parent onboarding |
| `lineups` | Named saved lineups per team |
| `training_sessions` | Session logs per team |
| `settings` | Club-level settings (name, logo, API key, review period, theme) |
| `league_standings` | Cached SLYSA standings per team from GotSport |
| `league_results` | Cached match results per team from GotSport |
| `team_coaches` | Coaching staff per team synced from GotSport roster |

---

## Supabase Setup

### 1. Run SQL migrations (in order)

Run these files in the **Supabase SQL Editor** for a fresh setup:

| File | Purpose |
|---|---|
| `supabase-schema.sql` | Core tables and base RLS policies |
| `sql/fix-coach-permissions.sql` | Extended RLS, player_teams, league tables, share tokens |
| `sql/add-parent-feedback.sql` | parent_feedback table |
| `sql/add-photos-coaches.sql` | Storage bucket RLS for player-photos and avatars |
| `sql/add-team-plans.sql` | team_plans table |
| `sql/rbac-phase1-critical.sql` | Security hardening: self-promotion block, settings write lock, invite security, share token function |
| `sql/rbac-phase2-scoping.sql` | Full RBAC scoping: coach→own teams, parent auth paths, admin policies |

### 2. Storage Buckets

Create two **public** buckets in Supabase Dashboard → Storage:
- `player-photos`
- `avatars`

### 3. Edge Functions

Deploy both functions from the `supabase/functions/` directory:

```bash
supabase functions deploy send-invite
supabase functions deploy notify-parent
```

Add the following secrets in **Dashboard → Edge Functions → [function name] → Secrets**:

| Secret | Used by | Value |
|---|---|---|
| `RESEND_API_KEY` | `send-invite`, `notify-parent` | From resend.com → API Keys |
| `RESEND_FROM` | `send-invite`, `notify-parent` | Optional — e.g. `"Player IDP <noreply@yourdomain.com>"` |

---

## League Sync (GotSport / SLYSA)

Match results, standings, and coaching staff for Steamer's Crew teams are synced from the SLYSA GotSport platform.

### Run manually

```bash
# 1. Copy the env example and fill in your service role key
copy scripts\.env.example scripts\.env

# 2. Run the sync (Bun is required — https://bun.sh)
bun run scripts/sync-gotsport.js
```

Get the `SUPABASE_SERVICE_KEY` from: **Supabase Dashboard → Project Settings → API → service_role**.

### Automated sync (GitHub Actions)

The workflow at `.github/workflows/sync-gotsport.yml` runs every **Tuesday at 4am CST**.

Add these secrets in **GitHub → Settings → Secrets → Actions**:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service_role key |

You can also trigger it manually: **Actions → Sync GotSport League Results → Run workflow**.

### New season setup

Update `EVENT_ID` and `KNOWN_GROUPS` in `scripts/sync-gotsport.js` with the new GotSport event ID and group IDs.

---

## Local Development

No build step — serve with any static file server:

```bash
python3 -m http.server 3000
# or
npx serve .
```

Supabase credentials are loaded from `js/config.js` (gitignored — copy from `js/config.example.js`).
The Claude API key is fetched from the `settings` table at runtime (entered by an admin in the Settings page).

---

## Security & Privacy

- **Row-Level Security** enforced on every table — coaches only see their assigned teams' data, parents only see their own child's published IDPs
- **Role self-promotion blocked** at the database level — no user can elevate their own role via the API
- **IDP share links** use a `SECURITY DEFINER` Postgres function (`get_idp_by_share_token`) — only the exact matching published IDP is returned; all other IDPs are never exposed
- **Settings writes** are admin-only at the RLS level — coaches cannot overwrite the API key from the browser console
- **Parent invite security** — a parent can only claim an invite row that is unclaimed and can only set their own user ID on it
- Claude API calls go **directly** from the browser to `api.anthropic.com` — no proxy
- No analytics, no third-party tracking
- Parent accounts can only see published plans for their linked child — no cross-family data access
