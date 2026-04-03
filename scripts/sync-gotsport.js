/**
 * sync-gotsport.js
 *
 * Fetches league standings and match results from GotSport for all
 * Steamer's Crew teams in the SLYSA Spring 2026 event, then upserts
 * the data into the Supabase `league_standings` and `league_results` tables.
 *
 * Usage:
 *   SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node sync-gotsport.js
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

// ─── Config ────────────────────────────────────────────────────────────────
const GOTSPORT_BASE = 'https://system.gotsport.com';
const EVENT_ID      = '50274';
const CLUB_ID       = '10769';
const SEASON        = 'Spring 2026';

// Hardcoded fallback: verified Steamer's Crew teams and their group IDs
const KNOWN_GROUPS = {
  '448125': "Steamer's Crew U12 2014G Green",
  '448076': "Steamer's Crew U10 2016B YDP Serbia",
  '448135': "Steamer's Crew U13 2013B Gray",
  '448120': "Steamer's Crew U12 2014G Blue",
  '448071': "Steamer's Crew U10 2016B YDP Cameroon",
  '448126': "Steamer's Crew U12 2014G White",
  '466265': "Steamer's Crew U9 2017B YDP England",
  '448141': "Steamer's Crew U13 2013G Blue",
  '466545': "Steamer's Crew U10 2016B YDP Netherlands",
  '462891': "Steamer's Crew U11 2015B Gray",
  '448140': "Steamer's Crew U13 2013G White",
  '448079': "Steamer's Crew U10 2016B YDP Belgium",
  '448129': "Steamer's Crew U13 2013B Blue",
  '448093': "Steamer's Crew U11 2015B Blue",
  '448134': "Steamer's Crew U13 2013B White",
  '448074': "Steamer's Crew U10 2016B YDP Peru",
};

// ─── Supabase client ───────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are required.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ───────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseIntSafe(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

function parseFloatSafe(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Extract U-age, year+gender code, and team keyword from a GotSport team name.
 * E.g. "Steamer's Crew U13 2013B Gray" => { age: 'U13', yearGender: '2013B', keyword: 'Gray' }
 * The yearGender code ("2013B" / "2014G") uniquely identifies boys vs girls.
 */
function extractTeamIdentifiers(name) {
  const ageMatch = name.match(/U\d+/i);
  const age = ageMatch ? ageMatch[0].toUpperCase() : null;

  // Extract year+gender token like "2013B" or "2014G"
  const ygMatch = name.match(/\b(20\d{2}[BG])\b/i);
  const yearGender = ygMatch ? ygMatch[1].toUpperCase() : null;

  // The keyword is typically the last word in the team name
  const parts = name.trim().split(/\s+/);
  const keyword = parts.length > 0 ? parts[parts.length - 1] : null;

  return { age, yearGender, keyword };
}

// ─── Fetch & Parse ─────────────────────────────────────────────────────────

/**
 * Fetch the results page for a given group and parse standings + match results.
 *
 * GotSport results pages have exactly 2 tables:
 *   Table 1 — Standings: Team | MP | W | L | D | GF | GA | GD | PTS | PPG
 *   Table 2 — Head-to-head matrix: row=team, col=opponent, cell="X-Y" or "-"
 *
 * There are NO individual match rows with dates/times/venues on this page.
 * Scores come exclusively from the matrix cells.
 */
async function fetchGroupResults(groupId) {
  const url = `${GOTSPORT_BASE}/org_event/events/${EVENT_ID}/results?group=${groupId}`;
  console.log(`  Fetching: ${url}`);

  let html;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IDP-Sync/1.0)',
        'Accept': 'text/html',
      },
      timeout: 15000,
    });
    if (!res.ok) {
      console.warn(`  WARNING: HTTP ${res.status} for group ${groupId}`);
      return { standings: [], matches: [], divisionName: '' };
    }
    html = await res.text();
  } catch (err) {
    console.warn(`  WARNING: fetch error for group ${groupId}: ${err.message}`);
    return { standings: [], matches: [], divisionName: '' };
  }

  const $ = cheerio.load(html);
  const now = new Date().toISOString();

  // Try to extract division name from any heading on the page
  let divisionName = '';
  $('h1, h2, h3, h4').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !divisionName) divisionName = text;
  });

  const tables = $('table');
  const standings = [];
  const matches = [];

  // ── Table 1: Standings ─────────────────────────────────────────────────────
  // Format: Team | MP | W | L | D | GF | GA | GD | PTS | PPG  (no position col)
  // Some leagues may add a position column as the first cell.
  if (tables.length > 0) {
    const standingsTable = $(tables[0]);

    // Prefer tbody rows; fall back to all rows minus the first (header)
    let rows = standingsTable.find('tbody tr');
    if (rows.length === 0) rows = standingsTable.find('tr').slice(1);

    rows.each((i, tr) => {
      const cells = $(tr).find('td, th');
      if (cells.length < 8) return;

      const firstText = $(cells[0]).text().trim();

      // Skip any residual header rows
      if (!firstText || /^(team|#|pos|rank)$/i.test(firstText)) return;

      const isPositionFirst = /^\d+$/.test(firstText);
      let pos, teamName, mp, w, l, d, gf, ga, gd, pts, ppg;

      if (isPositionFirst) {
        pos      = parseIntSafe(firstText);
        teamName = $(cells[1]).text().trim();
        mp       = parseIntSafe($(cells[2]).text().trim());
        w        = parseIntSafe($(cells[3]).text().trim());
        l        = parseIntSafe($(cells[4]).text().trim());
        d        = parseIntSafe($(cells[5]).text().trim());
        gf       = parseIntSafe($(cells[6]).text().trim());
        ga       = parseIntSafe($(cells[7]).text().trim());
        gd       = parseIntSafe($(cells[8]).text().trim());
        pts      = parseIntSafe($(cells[9]).text().trim());
        ppg      = parseFloatSafe($(cells[10])?.text()?.trim());
      } else {
        // Team | MP | W | L | D | GF | GA | GD | PTS | PPG
        pos      = i + 1;
        teamName = firstText;
        mp       = parseIntSafe($(cells[1]).text().trim());
        w        = parseIntSafe($(cells[2]).text().trim());
        l        = parseIntSafe($(cells[3]).text().trim());
        d        = parseIntSafe($(cells[4]).text().trim());
        gf       = parseIntSafe($(cells[5]).text().trim());
        ga       = parseIntSafe($(cells[6]).text().trim());
        gd       = parseIntSafe($(cells[7]).text().trim());
        pts      = parseIntSafe($(cells[8]).text().trim());
        ppg      = parseFloatSafe($(cells[9])?.text()?.trim());
      }

      if (!teamName) return;

      standings.push({
        gotsport_group_id: String(groupId),
        gotsport_team_name: teamName,
        division_name: divisionName,
        gotsport_url: url,
        position: pos,
        mp, w, l, d, gf, ga, gd, pts, ppg,
        season: SEASON,
        last_synced: now,
      });
    });
  }

  // ── Table 2: Head-to-Head Matrix ───────────────────────────────────────────
  // The matrix is an N×N grid.
  // First row (header): "Team Name" | TeamA | TeamB | TeamC | ...
  // Data rows:          TeamA       | -     | 4-4   | 5-3   | ...
  //                     TeamB       | 4-4   | -     | ...
  // Cell value "X-Y" means row-team scored X, column-team scored Y.
  // Cell value "-"   means the game hasn't been played yet (or diagonal).
  if (tables.length > 1) {
    const matrixTable = $(tables[1]);

    // Get column headers — first row of the table (thead or first tr)
    const colHeaders = [];
    let headerRow = matrixTable.find('thead tr').first();
    if (headerRow.length === 0) headerRow = matrixTable.find('tr').first();
    headerRow.find('th, td').each((_, cell) => {
      colHeaders.push($(cell).text().trim());
    });
    // colHeaders[0] = "Team Name" (row-label header)
    // colHeaders[1..N] = opponent team names

    // Parse data rows
    let dataRows = matrixTable.find('tbody tr');
    if (dataRows.length === 0) dataRows = matrixTable.find('tr').slice(1);

    dataRows.each((_, tr) => {
      const cells = $(tr).find('td, th');
      if (cells.length < 2) return;

      const rowTeamName = $(cells[0]).text().trim();
      if (!rowTeamName) return;

      cells.each((colIdx, td) => {
        if (colIdx === 0) return; // skip row-label cell

        const cellText = $(td).text().trim();
        if (!cellText || cellText === '-') return; // unplayed or diagonal

        // Expect "X-Y" with a plain ASCII hyphen
        const scoreMatch = cellText.match(/^(\d+)-(\d+)$/);
        if (!scoreMatch) return;

        const opponentName = colHeaders[colIdx] || '';
        if (!opponentName || opponentName === rowTeamName) return;

        const goalsFor     = parseIntSafe(scoreMatch[1]);
        const goalsAgainst = parseIntSafe(scoreMatch[2]);
        const result       = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';

        matches.push({
          gotsport_group_id: String(groupId),
          gotsport_team_name: rowTeamName,
          opponent: opponentName,
          goals_for: goalsFor,
          goals_against: goalsAgainst,
          result,
          match_date: null,   // not available on GotSport results page
          is_home: null,      // not available on GotSport results page
          venue: null,
          season: SEASON,
          last_synced: now,
        });
      });
    });
  }

  console.log(`  Found ${standings.length} standings rows, ${matches.length} match rows`);
  return { standings, matches, divisionName };
}

// ─── Auto-match teams ──────────────────────────────────────────────────────
async function autoMatchTeams() {
  console.log('\n--- Auto-matching GotSport teams to app teams ---');

  const { data: appTeams, error } = await sb.from('teams').select('id, name, gotsport_group_id');
  if (error) {
    console.warn('  Could not fetch app teams:', error.message);
    return;
  }
  if (!appTeams || appTeams.length === 0) {
    console.log('  No teams in app to match against.');
    return;
  }

  let matched = 0;
  for (const [groupId, gsName] of Object.entries(KNOWN_GROUPS)) {
    const { age, yearGender, keyword } = extractTeamIdentifiers(gsName);
    if (!age || !keyword) continue;

    // Find app teams that match U-age + keyword, using yearGender to break ties
    const candidates = appTeams.filter(t => {
      const nameLower = (t.name || '').toLowerCase();
      return nameLower.includes(age.toLowerCase()) && nameLower.includes(keyword.toLowerCase());
    });

    let match = null;
    if (candidates.length === 1) {
      match = candidates[0];
    } else if (candidates.length > 1 && yearGender) {
      // Use year+gender code (e.g. "2013B" or "2014G") to pick the right one
      const narrowed = candidates.filter(t =>
        (t.name || '').toUpperCase().includes(yearGender)
      );
      if (narrowed.length === 1) {
        match = narrowed[0];
      } else {
        console.log(`  Ambiguous match for "${gsName}" (${age} + ${yearGender} + ${keyword}): ${candidates.map(c => c.name).join(', ')}`);
      }
    }

    if (match) {
      if (match.gotsport_group_id === groupId) continue; // Already matched

      const { error: upErr } = await sb
        .from('teams')
        .update({ gotsport_group_id: groupId })
        .eq('id', match.id);

      if (upErr) {
        console.warn(`  Failed to link ${match.name}: ${upErr.message}`);
      } else {
        console.log(`  Linked: "${match.name}" => group ${groupId} (${gsName})`);
        matched++;
      }
    }
  }

  console.log(`  Auto-matched ${matched} new team(s).`);
}

// ─── Upsert data ───────────────────────────────────────────────────────────

/**
 * Build a groupId → appTeamId lookup from the teams table.
 */
async function buildGroupToTeamId() {
  const { data: appTeams } = await sb.from('teams').select('id, gotsport_group_id');
  const map = {};
  if (appTeams) appTeams.forEach(t => { if (t.gotsport_group_id) map[t.gotsport_group_id] = t.id; });
  return map;
}

/**
 * Upsert only our team's standings row for this group.
 * Other teams in the division are discarded — we only track Steamer's Crew.
 */
async function upsertStandings(standings) {
  if (standings.length === 0) return;

  // Filter to just Steamer's Crew rows
  const ours = standings.filter(s =>
    s.gotsport_team_name && s.gotsport_team_name.toLowerCase().includes("steamer's crew")
  );
  if (ours.length === 0) {
    console.log("  No Steamer's Crew row found in standings — skipping.");
    return;
  }

  const groupToTeamId = await buildGroupToTeamId();
  const rows = ours.map(s => ({ ...s, team_id: groupToTeamId[s.gotsport_group_id] || null }));

  const { error } = await sb
    .from('league_standings')
    .upsert(rows, { onConflict: 'gotsport_group_id,gotsport_team_name,season' });

  if (error) {
    console.error('  Standings upsert error:', error.message);
  } else {
    console.log(`  Upserted standings for: ${rows.map(r => r.gotsport_team_name).join(', ')}`);
  }
}

/**
 * Replace all results for this group with fresh data from the matrix.
 * We delete-then-insert because match_date is null (from the matrix) and
 * cannot be used as a unique conflict key.
 * Only Steamer's Crew rows are stored.
 */
async function upsertResults(matches) {
  if (matches.length === 0) return;

  // Filter to just Steamer's Crew rows
  const ours = matches.filter(m =>
    m.gotsport_team_name && m.gotsport_team_name.toLowerCase().includes("steamer's crew")
  );
  if (ours.length === 0) {
    console.log("  No Steamer's Crew results found — skipping.");
    return;
  }

  const groupToTeamId = await buildGroupToTeamId();
  const rows = ours.map(m => ({ ...m, team_id: groupToTeamId[m.gotsport_group_id] || null }));

  // Delete existing results for this group+team, then insert fresh
  const groupId  = rows[0].gotsport_group_id;
  const teamName = rows[0].gotsport_team_name;

  const { error: delErr } = await sb
    .from('league_results')
    .delete()
    .eq('gotsport_group_id', groupId)
    .eq('gotsport_team_name', teamName);

  if (delErr) {
    console.warn('  Warning: could not clear old results:', delErr.message);
  }

  const { error } = await sb.from('league_results').insert(rows);

  if (error) {
    console.error('  Results insert error:', error.message);
  } else {
    console.log(`  Inserted ${rows.length} results for ${teamName}.`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== GotSport League Sync ===');
  console.log(`Event: SLYSA ${SEASON} (${EVENT_ID})`);
  console.log(`Club: Steamer's Crew (${CLUB_ID})`);
  console.log(`Groups to sync: ${Object.keys(KNOWN_GROUPS).length}\n`);

  // Step 1: Auto-match GotSport teams to app teams
  await autoMatchTeams();

  // Step 2: Fetch and upsert data for each group
  let totalStandings = 0;
  let totalMatches   = 0;

  const groupIds = Object.keys(KNOWN_GROUPS);

  for (let i = 0; i < groupIds.length; i++) {
    const groupId = groupIds[i];
    const teamLabel = KNOWN_GROUPS[groupId];
    console.log(`\n[${i + 1}/${groupIds.length}] ${teamLabel} (group ${groupId})`);

    const { standings, matches } = await fetchGroupResults(groupId);

    if (standings.length > 0) {
      await upsertStandings(standings);
      totalStandings += standings.length;
    }

    if (matches.length > 0) {
      await upsertResults(matches);
      totalMatches += matches.length;
    }

    // Be polite to GotSport servers
    if (i < groupIds.length - 1) await sleep(1000);
  }

  console.log('\n=== Sync Complete ===');
  console.log(`Total standings upserted: ${totalStandings}`);
  console.log(`Total match results upserted: ${totalMatches}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
