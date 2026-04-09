# Player IDP — Local Feature Backlog

---

## ⚠️ PENDING MANUAL ACTIONS REQUIRED

### 1. Run GotSport Sync (update match scores)

Bun is already installed. Dependencies are already in `scripts/node_modules`.

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
Re-run any time you want to refresh scores from GotSport.

---

### 2. Deploy the notify-parent Edge Function

This sends parents an email when a new IDP is published for their child.

**Option A — Supabase CLI:**
```
supabase functions deploy notify-parent
```

**Option B — Supabase Dashboard:**
- Go to: **Supabase Dashboard → Edge Functions**
- Click **"Deploy a new function"**
- Upload or point to `supabase/functions/notify-parent/index.ts`

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

## 🔍 Investigate match result dates not populating
- GotSport sync fetches the `/schedules` page and tries to match opponent names to results from the matrix
- Dates are currently coming back null — likely opponent names in the matrix don't exactly match those on the schedule page
- To debug: check the GitHub Actions sync logs for `"Found X schedule entries for group ..."` and `"Schedule: YYYY-MM-DD vs ..."` output
- May need to fuzzy-match opponent names (normalize whitespace, strip trailing numbers, etc.)

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

## 📱 PWA — Progressive Web App (Option 1 Mobile)

Make the app installable on iOS and Android via "Add to Home Screen" — no App Store required.

### Step 1 — Web App Manifest (~30 min)
Create `/manifest.json`:
```json
{
  "name": "Player IDP",
  "short_name": "IDP",
  "start_url": "/dashboard.html",
  "display": "standalone",
  "background_color": "#0D1B2A",
  "theme_color": "#1B8A6B",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
- Add `<link rel="manifest" href="/manifest.json">` to all HTML pages
- Add `<meta name="theme-color" content="#1B8A6B">` to all HTML pages
- Add iOS-specific meta tags to all pages:
  ```html
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Player IDP">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  ```

### Step 2 — App Icons (~1 hour)
Generate icons at these sizes (use a tool like realfavicongenerator.net or Figma):
- `/icons/icon-192.png` — 192×192 (Android home screen)
- `/icons/icon-512.png` — 512×512 (Android splash)
- `/icons/icon-512-maskable.png` — 512×512 with safe zone padding (Android adaptive icon)
- `/icons/icon-180.png` — 180×180 (iOS touch icon)
- `/icons/favicon.ico` — 32×32 (browser tab)

Design: dark navy background (#0D1B2A), teal soccer ball or shield logo

### Step 3 — Service Worker (~1–2 hours)
Create `/sw.js` — cache-first strategy for all static assets so app loads offline:
```js
const CACHE = 'idp-v1';
const PRECACHE = ['/', '/dashboard.html', '/team.html', '/generate.html',
  '/lineup.html', '/team-plan.html', '/view-idp.html', '/parent.html',
  '/js/auth.js', '/js/config.js', '/js/nav.js', '/js/pos-picker.js'];

self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => c.addAll(PRECACHE))
));

self.addEventListener('fetch', e => e.respondWith(
  caches.match(e.request).then(r => r || fetch(e.request))
));
```
- Register in all HTML pages:
  ```html
  <script>
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js');
  </script>
  ```
- Note: Supabase calls and Claude API calls are network-only (skip cache)

### Step 4 — Mobile Layout Pass (~2–4 hours)
Pages that need responsive work before this feels right on phones:
- `dashboard.html` — stats bar may stack oddly, team cards need tap targets
- `team.html` — player list rows, modal forms need bigger inputs on mobile
- `lineup.html` — pitch needs pinch-zoom or at minimum scrolls well; left panel collapses to bottom sheet or hamburger
- `settings.html` — audit form layout
- `players.html` — table/list view on small screens

General rules:
- Tap targets minimum 44×44px
- Font size minimum 16px on inputs (prevents iOS zoom-on-focus)
- No hover-only actions (tok-remove on lineup tokens needs tap equivalent)

### Step 5 — Test & Install (~30 min)
- Open site in Chrome on Android → three-dot menu → "Add to Home Screen"
- Open site in Safari on iOS → share icon → "Add to Home Screen"
- Verify: splash screen, standalone mode (no browser chrome), icons look correct
- Test offline: airplane mode → open app → should load last-cached state

### Nice-to-haves (post-MVP)
- Splash screen customisation for iOS (launch image meta tags)
- Push notifications for when a parent views a plan (requires a backend push service — Supabase Edge Functions + web-push)
- Background sync for saving IDPs when connection drops mid-generate

### Total estimate: 1–2 days

---

## ✅ Google Login — DONE
- Google OAuth configured via Supabase Authentication → Providers
- "Sign in with Google" button on login.html (login tab only)

---

## 📤 IDP Email / Share
**Effort:** Medium (~1 hour)
- "Share IDP" button on view-idp.html
- Generates a public read-only URL (token-based, no login required)
- Or: email the HTML file directly via Resend / SendGrid

---

## ✅ Season / Cohort View — DONE
- `season.html` — per-team timeline of all player IDPs across a season
- Players grouped by phase: Foundation / Assert / Progress / Excel
- Mini dot timeline per player, color-coded by phase with connector lines
- Stats strip: players, IDPs generated, coverage %, leading phase
- Filter pills per phase with live counts
- Accessible from the Team page header via "📅 Season View" button

---

## 🏅 Player Progress Tracker
**Effort:** Large (~3 hours)
- Coach manually rates 1–5 per improvement area after each session
- Sparkline chart per player showing trend over time
- Highlight most improved players on dashboard

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
