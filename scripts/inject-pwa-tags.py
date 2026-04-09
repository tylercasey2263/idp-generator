"""
Inject PWA meta tags into all app HTML pages.
Run: python3 scripts/inject-pwa-tags.py
"""

import os, re

ROOT = os.path.join(os.path.dirname(__file__), '..')

# Pages to update (skip index.html demo, player-view.html has no auth,
# skip tslib etc. in node_modules)
PAGES = [
    'dashboard.html', 'team.html', 'generate.html', 'view-idp.html',
    'team-plan.html', 'lineup.html', 'season.html', 'players.html',
    'parent.html', 'users.html', 'settings.html', 'help.html',
    'login.html', 'player-view.html', 'teams.html',
]

PWA_TAGS = '''\
  <!-- PWA -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#1B8A6B">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Player IDP">
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png">'''

SW_SCRIPT = '''\
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  );
}
</script>'''

def inject(path):
    with open(path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Skip if already injected
    if 'rel="manifest"' in html:
        print(f'  skip (already has manifest): {os.path.basename(path)}')
        return

    # Insert PWA meta tags before </head>
    if '</head>' not in html:
        print(f'  WARN no </head> found: {os.path.basename(path)}')
        return

    html = html.replace('</head>', PWA_TAGS + '\n</head>', 1)

    # Insert SW registration just before </body>
    if '</body>' in html and 'serviceWorker' not in html:
        html = html.replace('</body>', SW_SCRIPT + '\n</body>', 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'  OK {os.path.basename(path)}')

if __name__ == '__main__':
    print('Injecting PWA tags...')
    for page in PAGES:
        full = os.path.join(ROOT, page)
        if os.path.exists(full):
            inject(full)
        else:
            print(f'  MISS {page}')
    print('Done.')
