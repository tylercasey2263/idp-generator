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
- Coach notes field on each player (with 🎙 microphone dictation)
- CSV import for bulk player creation
- Training Sessions log — add date, focus area, and freeform notes (with 🎙 mic), view history, delete sessions
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
- Full IDP history for a player, sorted newest-first
- **⇄ What Changed** diff panel between any two consecutive IDP versions — highlights new strengths, resolved improvements, focus/mantra/duration changes
- Download or print any historical IDP

### 🏆 Team Development Plan (`team-plan.html`)
- Aggregates all published player IDPs for a team
- Two-panel layout: left for inputs (season, phase, coach notes with 🎙 mic), right for generated infographic
- Claude synthesises: team strengths, collective improvements, training themes, player spotlights, game week focus, season vision, coach note
- Save & Publish to Supabase `team_plans` table

### ⚽ Lineup Manager (`lineup.html`)
- SVG football pitch with accurate markings (penalty areas, arcs, centre circle, goals)
- Drag-and-drop player tokens from bench onto the pitch, or click to open an assign picker
- Repositioning by dragging an existing token; remove via the ✕ hover button
- Formations for **11v11** (7 presets), **9v9** (5 presets), **7v7** (5 presets), plus Custom free-place mode
- **Save Lineup** — name it and persist to Supabase; saved lineups are scoped to each team
- **Load Saved** dropdown — restore any saved lineup (format, formation, and all player positions)
- Delete saved lineups
- Print-friendly: hides sidebar and controls, renders pitch only

### 👨‍👩‍👧 Parent Portal (`parent.html`)
- Parents see published IDPs for their linked child/children
- Step-by-step empty state guides parents on how to get connected
- View and save-as-PDF any published plan

### ⚙️ Settings (`settings.html`)
- Club name and logo
- API key management (masked, last 4 chars shown)
- User management (admin only) — invite coaches, manage roles

### 🙋 All Players (`players.html`)
- Club-wide player list with search and position filter
- Add, edit, delete players (with delete confirmation modal and toast notifications)
- Links to individual player IDP history

### ❓ Help (`help.html`)
- FAQ and how-to guide

---

## Authentication

Email/password auth via Supabase. Role-based: **Admin** and **Coach**.

- Coaches see their own teams
- Admins see the Settings page and all users
- Parents authenticate via invite link (no password required); they only see their child's published IDPs

---

## Microphone Dictation

Available on any notes or transcript field throughout the app. Click 🎙 to start, click again (or the button turns red while active) to stop. Transcribed text appends to the field. Uses the browser's Web Speech API — works best in Chrome.

Fields with mic support:
- Transcript (generate.html)
- Coach notes on player edit modal (team.html)
- Session notes on training log modal (team.html)
- Coach notes on Team Plan (team-plan.html)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS, no framework |
| Fonts | Google Fonts — Barlow Condensed + Inter |
| Auth & DB | Supabase (PostgreSQL + PostgREST) |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) via direct browser fetch |
| Hosting | GitHub Pages (static) |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Coach/admin users |
| `teams` | Teams per coach |
| `players` | Players per team (with notes column) |
| `player_teams` | Many-to-many player↔team links |
| `idps` | Generated IDPs (draft + published) |
| `team_plans` | Team Development Plans |
| `lineups` | Named saved lineups per team |
| `training_sessions` | Session logs per team |
| `parent_links` | Player↔parent connections |
| `invites` | Invite tokens for coach/parent onboarding |
| `settings` | Club-level settings (name, logo, API key) |

---

## Supabase Setup (SQL)

All tables have RLS disabled. Run these if setting up from scratch:

```sql
-- Players notes column (if upgrading)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS notes text;

-- Training sessions
CREATE TABLE public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.profiles(id),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  focus text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.training_sessions DISABLE ROW LEVEL SECURITY;

-- Lineups
CREATE TABLE public.lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Lineup',
  formation text,
  positions jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.lineups DISABLE ROW LEVEL SECURITY;

-- Invites (for coach onboarding via Settings)
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE DEFAULT gen_random_uuid()::text,
  role text NOT NULL CHECK (role IN ('coach','admin')),
  label text,
  created_by uuid REFERENCES public.profiles(id),
  used_by uuid REFERENCES public.profiles(id),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.invites DISABLE ROW LEVEL SECURITY;
```

---

## Local Development

No build step — open any `.html` file directly, or serve with any static file server:

```bash
npx serve .
# or
python -m http.server 8080
```

Supabase credentials are loaded from `js/auth.js`. The Claude API key is fetched from the `settings` table at runtime (entered by an admin in the Settings page).

---

## Privacy & Security

- Claude API calls go **directly** from the browser to `api.anthropic.com` — no proxy
- The API key is stored encrypted in the Supabase `settings` table and only decrypted in-session
- No analytics, no third-party tracking
- Parent accounts can only see published plans for their linked child — no cross-family data access
