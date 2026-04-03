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

  // Try to extract division name from page heading
  let divisionName = '';
  const heading = $('h1, h2, h3').first().text().trim();
  if (heading) divisionName = heading;

  // ── Parse standings table ──
  const standings = [];
  const tables = $('table');

  // The first table is typically the standings table
  if (tables.length > 0) {
    const standingsTable = $(tables[0]);
    standingsTable.find('tbody tr').each((i, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 8) return; // Skip rows that don't have enough columns

      // Determine if first column is a position number or team name
      const firstCellText = $(cells[0]).text().trim();
      const isPositionFirst = /^\d+$/.test(firstCellText);

      let pos, teamName, mp, w, l, d, gf, ga, gd, pts, ppg;

      if (isPositionFirst) {
        // Position | Team | MP | W | L | D | GF | GA | GD | PTS | PPG
        pos      = parseIntSafe(firstCellText);
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
        teamName = firstCellText;
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
        last_synced: new Date().toISOString(),
      });
    });
  }

  // ── Parse match results ──
  // Match results may be in subsequent tables or in a different section
  const matches = [];

  if (tables.length > 1) {
    // Iterate through remaining tables looking for match results
    for (let t = 1; t < tables.length; t++) {
      $(tables[t]).find('tbody tr, tr').each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length < 3) return;

        // Try to parse match rows: typically Date | Home | Score | Away or similar
        const cellTexts = [];
        cells.each((_, td) => cellTexts.push($(td).text().trim()));

        // Look for a score pattern like "2 - 1" or "2-1"
        let scoreIdx = -1;
        for (let c = 0; c < cellTexts.length; c++) {
          if (/^\d+\s*[-–]\s*\d+$/.test(cellTexts[c]) || /^\d+$/.test(cellTexts[c])) {
            // Check if next cell is also a number (home score, away score in separate cells)
            if (/^\d+$/.test(cellTexts[c]) && c + 1 < cellTexts.length && /^\d+$/.test(cellTexts[c + 1])) {
              scoreIdx = c;
              break;
            }
            if (/^\d+\s*[-–]\s*\d+$/.test(cellTexts[c])) {
              scoreIdx = c;
              break;
            }
          }
        }

        // Try to find date pattern
        let matchDate = null;
        let dateIdx = -1;
        for (let c = 0; c < cellTexts.length; c++) {
          const dateMatch = cellTexts[c].match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
          if (dateMatch) {
            const parts = dateMatch[1].split('/');
            const month = parts[0].padStart(2, '0');
            const day   = parts[1].padStart(2, '0');
            const year  = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            matchDate = `${year}-${month}-${day}`;
            dateIdx = c;
            break;
          }
        }

        // Try to extract team names and scores
        // Common patterns: Date | Time | Home | Score | Away | Venue
        // Or: Home | Score | Away
        if (scoreIdx >= 0) {
          let homeTeam = '', awayTeam = '', homeScore = 0, awayScore = 0;

          const scoreText = cellTexts[scoreIdx];
          const combinedScore = scoreText.match(/^(\d+)\s*[-–]\s*(\d+)$/);

          if (combinedScore) {
            homeScore = parseIntSafe(combinedScore[1]);
            awayScore = parseIntSafe(combinedScore[2]);
            // Home team is before score, away team is after
            if (scoreIdx > 0) homeTeam = cellTexts[scoreIdx - 1];
            if (scoreIdx + 1 < cellTexts.length) awayTeam = cellTexts[scoreIdx + 1];
          } else if (/^\d+$/.test(cellTexts[scoreIdx]) && scoreIdx + 1 < cellTexts.length && /^\d+$/.test(cellTexts[scoreIdx + 1])) {
            homeScore = parseIntSafe(cellTexts[scoreIdx]);
            awayScore = parseIntSafe(cellTexts[scoreIdx + 1]);
            if (scoreIdx > 0) homeTeam = cellTexts[scoreIdx - 1];
            if (scoreIdx + 2 < cellTexts.length) awayTeam = cellTexts[scoreIdx + 2];
          }

          // Skip if we couldn't find team names or if scores are dashes (unplayed)
          if (!homeTeam || !awayTeam) return;
          if (homeTeam === '-' || awayTeam === '-') return;

          // Venue might be the last cell
          let venue = '';
          const lastCell = cellTexts[cellTexts.length - 1];
          if (lastCell !== awayTeam && lastCell !== String(awayScore) && !/^\d+$/.test(lastCell)) {
            venue = lastCell;
          }

          // Create result entries for both teams
          const resultForHome = homeScore > awayScore ? 'W' : homeScore < awayScore ? 'L' : 'D';
          const resultForAway = awayScore > homeScore ? 'W' : awayScore < homeScore ? 'L' : 'D';

          matches.push({
            gotsport_group_id: String(groupId),
            gotsport_team_name: homeTeam,
            match_date: matchDate,
            opponent: awayTeam,
            goals_for: homeScore,
            goals_against: awayScore,
            venue,
            is_home: true,
            result: resultForHome,
            season: SEASON,
            last_synced: new Date().toISOString(),
          });

          matches.push({
            gotsport_group_id: String(groupId),
            gotsport_team_name: awayTeam,
            match_date: matchDate,
            opponent: homeTeam,
            goals_for: awayScore,
            goals_against: homeScore,
            venue,
            is_home: false,
            result: resultForAway,
            season: SEASON,
            last_synced: new Date().toISOString(),
          });
        }
      });
    }
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
async function upsertStandings(standings) {
  if (standings.length === 0) return;

  // Resolve team_id for Steamer's Crew teams
  const { data: appTeams } = await sb.from('teams').select('id, gotsport_group_id');
  const groupToTeamId = {};
  if (appTeams) {
    appTeams.forEach(t => {
      if (t.gotsport_group_id) groupToTeamId[t.gotsport_group_id] = t.id;
    });
  }

  const rows = standings.map(s => ({
    ...s,
    team_id: groupToTeamId[s.gotsport_group_id] || null,
  }));

  const { error } = await sb
    .from('league_standings')
    .upsert(rows, { onConflict: 'gotsport_group_id,gotsport_team_name,season' });

  if (error) {
    console.error('  Standings upsert error:', error.message);
  } else {
    console.log(`  Upserted ${rows.length} standings rows.`);
  }
}

async function upsertResults(matches) {
  if (matches.length === 0) return;

  // Resolve team_id
  const { data: appTeams } = await sb.from('teams').select('id, gotsport_group_id');
  const groupToTeamId = {};
  if (appTeams) {
    appTeams.forEach(t => {
      if (t.gotsport_group_id) groupToTeamId[t.gotsport_group_id] = t.id;
    });
  }

  const rows = matches.map(m => ({
    ...m,
    team_id: groupToTeamId[m.gotsport_group_id] || null,
  }));

  const { error } = await sb
    .from('league_results')
    .upsert(rows, { onConflict: 'gotsport_group_id,gotsport_team_name,opponent,match_date,season' });

  if (error) {
    console.error('  Results upsert error:', error.message);
  } else {
    console.log(`  Upserted ${rows.length} match result rows.`);
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
