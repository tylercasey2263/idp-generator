# Player IDP — Coaching Platform

A full-stack web app for youth football coaches to generate AI-powered Individual Development Plans (IDPs), manage teams and players, run a Team Development Plan (TDP), build and save lineups, log training sessions, and share published plans with parents — all backed by Supabase and Claude AI.

## Live Site

[https://tylercasey2263.github.io/idp-generator/](https://tylercasey2263.github.io/idp-generator/)

---

## Pages & Features

### 🏠 Dashboard (`dashboard.html`)
- Overview of all your teams with a live stats bar (total players, IDPs generated, % published)
- Create and delete teams
- Search/filter teams by name
- Toast notifications on all actions

### 👥 Team Page (`team.html`)
- Full player roster for a selected team with IDP status badges (Published / Draft + relative timestamp)
- Add, edit, and delete players with position picker
- **Player photos** — click a player's avatar to upload a photo (stored in Supabase `player-photos` bucket); shows initials fallback with 📷 hover overlay
- **Secondary teams** — edit a player to assign them to additional teams via checkboxes; links are stored in `player_teams`
- Coach notes field on each player (with 🎙 microphone dictation)
- CSV import for bulk player creation
- Training Sessions log — add date, focus area, and freeform notes (with 🎙 mic), view history, delete sessions
- **League Results** — live standings (position, W/L/D/GF/GA/PTS) and match-by-match results pulled from SLYSA GotSport, with expandable rows showing date, home/away, venue when available; direct link to the division page
- **Coaching Staff** — team coaches synced from GotSport roster; coaches can click "Link me to this team" to associate their profile account
- Quick links to generate/view IDPs and open the lineup manager
- Team summary line: player count, IDP coverage at a glance

### ✦ IDP Generator (`generate.html`)
- Paste or dictate a voice memo transcript for any player
- Fill in name, position(s), plan duration, and focus area(s)
- **Clean & Generate** — sends to Claude (`claude-sonnet-4-20250514`) for grammar cleanup + structured extraction
- **Generate As-Is** — skips AI, builds directly from raw text
- Rendered dark-theme infographic: strengths, improvements, 30-day development plan, micro-habits, 12-month vision, parent note
- In-place **Edit mode** — click any text element to edit it directly
- Download as standalone HTML or Save as PDF (print dialog)
- Save as Draft or Publish to Supabase; published plans are visible to linked parents
- 🎙 Microphone dictation on the transcript field

### 📊 View IDP (`view-idp.html`)
Five-tab layout per player:

**Season tab**
- Live league standings and match results for all of the player's teams pulled from GotSport
- Shows team position, W/L/D record, goals for/against, points
- Expandable match-by-match results: opponent, score, W/L/D badge — click a row to reveal date, home/away, and venue when available; sorted by match date

**IDPs tab**
- Full IDP history sorted newest-first
- **⇄ What Changed** diff panel between consecutive versions — highlights new strengths, resolved improvements, focus/mantra/duration changes
- Publish, edit, share, or print any IDP
- **⎘ Copy IDP** — duplicate any IDP as a new draft to adapt for a different team or session context

**Progress tab**
- Visual timeline showing all IDPs in chronological order (oldest → newest)
- Each entry shows: focus area, strength tags (green), improvement tags (amber), player mantra
- Delta chip between entries (▲ +1 strength / ▼ fewer / — same) so growth is immediately visible
- "View full IDP →" jumps directly to that plan in the IDPs tab

**Coach Notes tab**
- Private journal per player — visible only to the coach who wrote each note, never shared with parents
- Timestamped entries; add with a textarea, delete with confirmation
- Tab badge shows live count (e.g. `Coach Notes (3)`)

**Parent Feedback tab**
- Asynchronous messages from parents about their child
- Unread count badge on the tab; opening the tab marks all messages as read
- Feedback shows date and "New" chip on unread items

**Player photos**
- Click the player's avatar circle at the top to upload a photo (coaches can update; stored in `player-photos`)
- Shows initials + teal background as fallback

### 👨‍👩‍👧 Parent Portal (`parent.html`)
- Parents see published IDPs for their linked child/children
- **Player photo** — parents can upload/update a photo for their child
- **Message your coach** — per-player feedback form; messages are delivered to the coach's Parent Feedback tab on view-idp.html
- Step-by-step empty state guides parents on how to get connected
- View and save-as-PDF any published plan
- Coaches invite parents by email — Supabase sends a magic link automatically; manual invite link also available

### ⚙️ Settings (`settings.html`)
- **My Profile** — visible to all coaches; update your display name and upload a profile avatar (stored in Supabase `avatars` bucket)
- Club name and logo *(admin only)*
- API key management *(admin only)*
- User management — invite coaches, manage roles *(admin only)*

### 🏆 Team Development Plan (`team-plan.html`)
- Aggregates all published player IDPs for a team
- Claude synthesises: team strengths, collective improvements, training themes, player spotlights, game week focus, season vision, coach note
- Save & Publish to Supabase `team_plans` table

### ⚽ Lineup Manager (`lineup.html`)
- SVG football pitch with accurate markings
- Drag-and-drop player tokens; supports players linked via secondary teams
- Formations for 11v11, 9v9, 7v7, plus Custom free-place mode
- Save, load, and delete named lineups scoped per team
- Print-friendly output

### 🙋 All Players (`players.html`)
- Club-wide player list with search and position filter
- Add, edit, delete players
- Links to individual player IDP history

### 🔐 Login (`login.html`)
- Email/password sign-in and account creation
- **Google Sign-In** button for one-click OAuth login (login tab only)

### ❓ Help (`help.html`)
- FAQ and how-to guide

---

## Authentication

Email/password and Google OAuth via Supabase. Role-based: **Admin** and **Coach**.

- Coaches see their own teams
- Admins see Settings and all users
- Parents authenticate via invite link (no password required); they only see their child's published IDPs

---

## Microphone Dictation

Available on notes and transcript fields throughout the app. Click 🎙 to start, click again to stop. Uses the browser's Web Speech API — works best in Chrome.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS, no framework |
| Fonts | Google Fonts — Barlow Condensed + Inter |
| Auth & DB | Supabase (PostgreSQL + PostgREST) |
| Storage | Supabase Storage (`player-photos`, `avatars` buckets — both public) |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) via direct browser fetch |
| Hosting | GitHub Pages (static) |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Coach/admin users (includes `avatar_url`) |
| `teams` | Teams per coach (includes `gotsport_group_id` for league sync) |
| `players` | Players per team (includes `notes`, `photo_url`) |
| `player_teams` | Many-to-many player↔team links (secondary team assignments) |
| `idps` | Generated IDPs (draft + published, includes `share_token`) |
| `player_notes` | Private coach journal entries per player |
| `parent_feedback` | Async parent messages to coaches; per-player, token or parent-id linked |
| `team_plans` | Team Development Plans |
| `lineups` | Named saved lineups per team |
| `training_sessions` | Session logs per team |
| `parent_links` | Player↔parent connections |
| `invites` | Invite tokens for coach/parent onboarding |
| `settings` | Club-level settings (name, logo, API key) |
| `league_standings` | Cached SLYSA standings per team from GotSport |
| `league_results` | Cached match results per team from GotSport (includes `match_date`, `is_home`, `venue`) |
| `team_coaches` | Coaching staff per team synced from GotSport roster |
| `coach_teams` | Many-to-many coach profile↔team links |

---

## Supabase Setup

### Storage Buckets
Create two **public** buckets in the Supabase dashboard → Storage:
- `player-photos` — player profile photos
- `avatars` — coach/user profile avatars

Then run `sql/add-photos-coaches.sql` to add the required RLS policies.

### Parent Feedback
Run `sql/add-parent-feedback.sql` to create the `parent_feedback` table with appropriate RLS (anyone can INSERT, only authenticated staff can SELECT/UPDATE).

### Core Tables
Run the SQL in the existing migration files if setting up from scratch. All core tables have RLS disabled except `player_notes` and `parent_feedback`.

---

## League Sync (GotSport / SLYSA)

Match results, standings, and coaching staff for Steamer's Crew are automatically pulled from the SLYSA GotSport platform every **Tuesday at 4am CST** via a GitHub Actions workflow.

### How it works
- `scripts/sync-gotsport.js` fetches all Steamer's Crew divisions from `system.gotsport.com`
- **Standings** → upserted into `league_standings`
- **Match results** (from head-to-head matrix) → upserted into `league_results`
- **Schedule** (games page) → scraped in parallel to populate `match_date`, `is_home`, `venue` on results
- **Coaching staff** (roster page) → upserted into `team_coaches`
- Each team is auto-matched to the app's `teams` table via `gotsport_group_id`

### Manual trigger
Go to **Actions → Sync GotSport League Results → Run workflow** in GitHub to sync on demand.

### Required GitHub Secrets
| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service_role key |

### New season setup
Update `EVENT_ID` and `KNOWN_GROUPS` in `scripts/sync-gotsport.js` with the new event ID and group IDs from GotSport.

---

## Local Development

No build step — serve with any static file server:

```bash
python3 -m http.server 3000
# or
npx serve .
```

Supabase credentials are loaded from `js/auth.js`. The Claude API key is fetched from the `settings` table at runtime (entered by an admin in the Settings page).

---

## Privacy & Security

- Claude API calls go **directly** from the browser to `api.anthropic.com` — no proxy
- The API key is stored encrypted in the Supabase `settings` table and only decrypted in-session
- No analytics, no third-party tracking
- Parent accounts can only see published plans for their linked child — no cross-family data access
- Parent feedback uses invite tokens so parents never need to create an account
