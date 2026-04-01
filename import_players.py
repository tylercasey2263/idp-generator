"""
Bulk import teams and players from all-players.csv into Supabase.
Skips parent emails. Creates teams, links them to the admin coach, then inserts players.
"""
import csv, requests, sys

SUPABASE_URL = 'https://uarsodrarfnkodnfoclt.supabase.co'
ANON_KEY     = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6'
                'InVhcnNvZHJhcmZua29kbmZvY2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTc2'
                'MzAsImV4cCI6MjA5MDQ5MzYzMH0.MMJT6W4ffRT9NEnLTgCcGDueeYuVG6gFNVOaM3oqVd8')

HEADERS = {
    'apikey':        ANON_KEY,
    'Authorization': f'Bearer {ANON_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
}

def get(table, params=None):
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{table}', headers=HEADERS, params=params or {})
    r.raise_for_status()
    return r.json()

def post_minimal(table, data):
    h = {**HEADERS, 'Prefer': 'return=minimal'}
    r = requests.post(f'{SUPABASE_URL}/rest/v1/{table}', headers=h, json=data)
    return r

def post_repr(table, data):
    r = requests.post(f'{SUPABASE_URL}/rest/v1/{table}', headers=HEADERS, json=data)
    r.raise_for_status()
    return r.json()

# ── 1. Parse CSV ──────────────────────────────────────────────────────────────
CSV_PATH = r'C:\Users\tyler\OneDrive\Desktop\all-players.csv'
players_by_team = {}   # team_name -> list of player full names

with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        team   = row['team'].strip()
        name   = f"{row['player_first_name'].strip()} {row['player_last_name'].strip()}"
        players_by_team.setdefault(team, []).append(name)

total_players = sum(len(v) for v in players_by_team.values())
print(f"CSV parsed — {len(players_by_team)} teams, {total_players} players\n")

# ── 2. Find admin coach ID ────────────────────────────────────────────────────
admins = get('profiles', {'role': 'eq.admin', 'select': 'id,email,full_name'})
if not admins:
    print("ERROR: No admin profile found in the database. Exiting.")
    sys.exit(1)
admin = admins[0]
admin_id = admin['id']
print(f"Admin: {admin.get('full_name')} ({admin.get('email')})  id={admin_id}\n")

# ── 3. Load existing teams ────────────────────────────────────────────────────
existing_teams = get('teams', {'select': 'id,name'})
existing_map   = {t['name']: t['id'] for t in existing_teams}
print(f"Existing teams in DB: {len(existing_map)}")

# ── 4. Create missing teams ───────────────────────────────────────────────────
team_id_map = dict(existing_map)  # will hold ALL team name -> id mappings
new_team_names = [t for t in players_by_team if t not in existing_map]
print(f"New teams to create: {len(new_team_names)}")

for name in new_team_names:
    result  = post_repr('teams', {'name': name, 'season': None})
    team    = result[0] if isinstance(result, list) else result
    team_id_map[name] = team['id']
    print(f"  + Created team: {name}")

print(f"\nTotal teams available: {len(team_id_map)}")

# ── 5. Link all new teams to the admin coach ──────────────────────────────────
existing_ct  = get('coach_teams', {'coach_id': f'eq.{admin_id}', 'select': 'team_id'})
existing_ct_ids = {r['team_id'] for r in existing_ct}

ct_batch = [
    {'coach_id': admin_id, 'team_id': tid}
    for name, tid in team_id_map.items()
    if tid not in existing_ct_ids
]
if ct_batch:
    for i in range(0, len(ct_batch), 50):
        post_minimal('coach_teams', ct_batch[i:i+50])
    print(f"Linked {len(ct_batch)} new teams to admin coach")
else:
    print("All teams already linked to admin coach")

# ── 6. Load existing players to skip duplicates ───────────────────────────────
existing_players = get('players', {'select': 'name,team_id'})
existing_set = {(p['name'], p['team_id']) for p in existing_players}
print(f"\nExisting players in DB: {len(existing_set)}")

# ── 7. Build insert list ──────────────────────────────────────────────────────
to_insert = []
skipped   = 0
for team_name, names in players_by_team.items():
    tid = team_id_map.get(team_name)
    if not tid:
        print(f"  WARNING — no team ID for: {team_name}")
        continue
    for name in names:
        if (name, tid) in existing_set:
            skipped += 1
        else:
            to_insert.append({'name': name, 'team_id': tid, 'positions': None})

print(f"Players to insert: {len(to_insert)}  (skipping {skipped} duplicates)\n")

# ── 8. Insert in batches of 50 ────────────────────────────────────────────────
BATCH = 50
created = 0
errors  = 0

for i in range(0, len(to_insert), BATCH):
    batch = to_insert[i:i + BATCH]
    r = post_minimal('players', batch)
    if r.ok:
        created += len(batch)
    else:
        print(f"  ERROR on batch {i//BATCH + 1}: {r.status_code} {r.text[:120]}")
        errors += len(batch)
    done = min(i + BATCH, len(to_insert))
    print(f"  {done}/{len(to_insert)} players processed…")

print(f"\n{'='*50}")
print(f"Done!  Created {created} players, {errors} errors, {skipped} skipped (already existed).")
