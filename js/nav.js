/**
 * nav.js — Shared sidebar navigation + first-visit onboarding tooltips
 * Include AFTER supabase-js and auth.js on every authenticated page.
 * Usage: await initNav('dashboard');
 */
(function () {

  /* ─── INJECT SIDEBAR + ONBOARDING CSS ─────────────────────────────── */
  const CSS = `
    /* ── Reset body margin ── */
    body { margin: 0; }

    /* ── Shell ── */
    .main-content { margin-left: 240px; min-height: 100vh; }

    /* ── Sidebar ── */
    .idp-sidebar {
      width: 240px; background: #07111C;
      border-right: 1px solid rgba(255,255,255,0.07);
      display: flex; flex-direction: column;
      position: fixed; top: 0; left: 0; bottom: 0;
      z-index: 200; transition: transform .25s ease;
      overflow: hidden;
    }

    /* Header */
    .sb-header {
      padding: 1.1rem 1rem .9rem; display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
    }
    .sb-logo-wrap {
      width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
      background: rgba(27,138,107,.18); border: 1px solid rgba(27,138,107,.3);
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    }
    .sb-logo-wrap img { width: 100%; height: 100%; object-fit: cover; }
    .sb-club-name {
      font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 800;
      color: #EDF2F7; line-height: 1.2; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .sb-club-sub { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: .08em; }

    /* Nav */
    .sb-nav {
      flex: 1; padding: .6rem .6rem; display: flex; flex-direction: column;
      gap: 2px; overflow-y: auto;
    }
    .sb-nav::-webkit-scrollbar { width: 4px; }
    .sb-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }
    .sb-section-label {
      font-size: 10px; font-weight: 700; color: #334155; text-transform: uppercase;
      letter-spacing: .1em; padding: 8px 10px 3px;
    }
    .sb-divider { height: 1px; background: rgba(255,255,255,.05); margin: 6px 0; }
    .sb-item {
      display: flex; align-items: center; gap: 9px; padding: 8px 10px;
      border-radius: 7px; font-size: 13px; font-weight: 500; color: #64748B;
      text-decoration: none; transition: background .15s, color .15s;
      cursor: pointer; border: 1px solid transparent;
      font-family: 'Inter', sans-serif; white-space: nowrap;
    }
    .sb-item:hover { background: rgba(255,255,255,.04); color: #94A3B8; }
    .sb-item.active {
      background: rgba(27,138,107,.14); color: #22A882;
      border-color: rgba(27,138,107,.22);
    }
    .sb-icon { width: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }

    /* Footer */
    .sb-footer { padding: .85rem; border-top: 1px solid rgba(255,255,255,.06); flex-shrink: 0; }
    .sb-user {
      display: flex; align-items: center; gap: 9px; padding: 6px 6px 10px;
    }
    .sb-avatar {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background: rgba(27,138,107,.25); border: 1px solid rgba(27,138,107,.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800; color: #22A882;
    }
    .sb-user-name {
      font-size: 13px; font-weight: 600; color: #CBD5E1; line-height: 1.2;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .sb-role-badge {
      display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; padding: 2px 6px; border-radius: 3px; margin-top: 2px;
    }
    .role-admin  { background: rgba(212,135,10,.2);  color: #F0A020; }
    .role-coach  { background: rgba(27,138,107,.2);  color: #22A882; }
    .role-parent { background: rgba(100,116,139,.2); color: #94A3B8; }
    .sb-signout {
      width: 100%; padding: 7px; border-radius: 6px; background: none;
      border: 1px solid rgba(255,255,255,.08); color: #475569;
      font-size: 12px; font-weight: 600; cursor: pointer;
      font-family: 'Inter', sans-serif; transition: color .15s, border-color .15s;
    }
    .sb-signout:hover { color: #94A3B8; border-color: rgba(255,255,255,.15); }

    /* Mobile topbar */
    .sb-topbar {
      display: none; align-items: center; gap: 12px; padding: 0 1rem;
      height: 52px; background: #07111C; border-bottom: 1px solid rgba(255,255,255,.07);
      position: sticky; top: 0; z-index: 201;
    }
    .sb-hamburger {
      background: none; border: none; color: #94A3B8; cursor: pointer;
      padding: 5px; border-radius: 6px; transition: background .15s; line-height: 1;
    }
    .sb-hamburger:hover { background: rgba(255,255,255,.05); }
    .sb-topbar-title { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 800; color: #EDF2F7; }
    .sb-topbar-title em { color: #22A882; font-style: normal; }
    .sb-overlay {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 199;
    }

    @media (max-width: 820px) {
      .idp-sidebar { transform: translateX(-100%); box-shadow: none; }
      .idp-sidebar.open { transform: translateX(0); box-shadow: 6px 0 30px rgba(0,0,0,.5); }
      .main-content { margin-left: 0 !important; }
      .sb-topbar { display: flex; }
      .sb-overlay.show { display: block; }
    }

    /* ── ONBOARDING ── */
    .ob-backdrop {
      position: fixed; inset: 0; z-index: 9000; pointer-events: none;
      background: transparent;
    }
    .ob-cutout {
      position: fixed; border-radius: 10px; z-index: 9001; pointer-events: none;
      box-shadow: 0 0 0 9999px rgba(0,0,0,.72);
      transition: all .3s cubic-bezier(.4,0,.2,1);
    }
    .ob-tooltip {
      position: fixed; z-index: 9002; width: 290px;
      background: #1A2E44; border: 1px solid rgba(34,168,130,.4);
      border-radius: 12px; padding: 1.2rem 1.3rem;
      box-shadow: 0 12px 40px rgba(0,0,0,.6); pointer-events: all;
      animation: obFadeIn .2s ease;
    }
    @keyframes obFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .ob-step-label { font-size: 10px; font-weight: 700; color: #22A882; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 5px; }
    .ob-title { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 800; color: #EDF2F7; margin-bottom: 5px; }
    .ob-body { font-size: 13px; color: #94A3B8; line-height: 1.6; margin-bottom: 14px; }
    .ob-footer { display: flex; align-items: center; gap: 8px; }
    .ob-dots { display: flex; gap: 4px; flex: 1; }
    .ob-dot { width: 5px; height: 5px; border-radius: 50%; background: #243B55; }
    .ob-dot.on { background: #22A882; }
    .ob-skip-btn {
      background: none; border: none; color: #475569; font-size: 12px;
      cursor: pointer; padding: 5px 8px; border-radius: 5px;
      font-family: 'Inter', sans-serif; transition: color .15s;
    }
    .ob-skip-btn:hover { color: #64748B; }
    .ob-next-btn {
      background: #1B8A6B; border: none; color: #fff; font-size: 12px; font-weight: 700;
      cursor: pointer; padding: 7px 15px; border-radius: 6px;
      font-family: 'Barlow Condensed', sans-serif; letter-spacing: .06em; text-transform: uppercase;
      transition: background .15s;
    }
    .ob-next-btn:hover { background: #22A882; }
  `;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);

  /* ─── SVG ICONS ──────────────────────────────────────────────────── */
  const IC = {
    dashboard: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" fill="currentColor"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" fill="currentColor"/></svg>`,
    players:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5.5" cy="4" r="2.5" fill="currentColor"/><path d="M1 13c0-2.5 2-4.5 4.5-4.5S10 10.5 10 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="11.5" cy="4" r="2" fill="currentColor" opacity=".5"/><path d="M13.5 13c0-2-1.3-3.7-3-4.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".5"/></svg>`,
    lineup:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1.5" y="1.5" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><circle cx="4.5" cy="7.5" r="1.3" fill="currentColor"/><circle cx="7.5" cy="4.5" r="1.3" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.3" fill="currentColor"/><circle cx="7.5" cy="10.5" r="1.3" fill="currentColor"/></svg>`,
    settings:  `<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="2.2" stroke="currentColor" stroke-width="1.4"/><path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.1 3.1l1 1M10.9 10.9l1 1M3.1 11.9l1-1M10.9 4.1l1-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    help:      `<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M5.8 5.8a1.8 1.8 0 0 1 3.4.8c0 1.2-1.7 1.5-1.7 2.9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="7.5" cy="11" r=".8" fill="currentColor"/></svg>`,
    soccer:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.4"/><polygon points="7.5,4 9.2,6.2 7.5,8.4 5.8,6.2" stroke="currentColor" stroke-width="1" fill="currentColor" opacity=".4"/></svg>`,
  };

  /* ─── RENDER SIDEBAR ─────────────────────────────────────────────── */
  window.renderSidebar = async function (activePage) {
    const mount = document.getElementById('sidebarMount');
    if (!mount) return;

    // Get user context
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    const role = profile?.role || 'coach';
    const name = profile?.full_name || session.user.email;
    const initial = name.charAt(0).toUpperCase();

    // Get club settings
    const { data: settings } = await sb.from('settings').select('key,value').in('key', ['club_name','club_logo']);
    const clubName = settings?.find(r => r.key === 'club_name')?.value || 'Player Development';
    const clubLogo = settings?.find(r => r.key === 'club_logo')?.value || '';

    // Expose globally and update page title
    window._clubName = clubName;
    window._clubLogo = clubLogo;
    const titleParts = document.title.split(' — ');
    document.title = (titleParts.length > 1 ? titleParts[0] + ' — ' : '') + clubName + ' Player Development';

    const logoHTML = clubLogo
      ? `<img src="${clubLogo}" alt="Club Logo">`
      : IC.soccer;

    function item(page, href, icon, label, roles) {
      if (!roles.includes(role)) return '';
      const active = activePage === page ? ' active' : '';
      return `<a href="${href}" class="sb-item${active}"><span class="sb-icon">${icon}</span>${label}</a>`;
    }

    mount.innerHTML = `
      <aside class="idp-sidebar" id="idpSidebar">
        <div class="sb-header">
          <div class="sb-logo-wrap">${logoHTML}</div>
          <div style="min-width:0">
            <div class="sb-club-name">${esc(clubName)}</div>
            <div class="sb-club-sub">Player Development</div>
          </div>
        </div>

        <nav class="sb-nav">
          ${item('dashboard', '/dashboard.html', IC.dashboard, 'Dashboard',       ['admin','coach','parent'])}
          ${item('players',   '/players.html',   IC.players,   'All Players',     ['admin','coach'])}
          ${item('lineup',    '/lineup.html',    IC.lineup,    'Lineup Manager',  ['admin','coach'])}

          ${role === 'admin' ? `
            <div class="sb-divider"></div>
            <div class="sb-section-label">Admin</div>
            ${item('settings', '/settings.html', IC.settings, 'Settings', ['admin'])}
          ` : ''}

          <div class="sb-divider"></div>
          ${item('help', '/help.html', IC.help, 'Help & How-To', ['admin','coach','parent'])}
        </nav>

        <div class="sb-footer">
          <div class="sb-user">
            <div class="sb-avatar">${initial}</div>
            <div style="min-width:0">
              <div class="sb-user-name">${esc(name)}</div>
              <span class="sb-role-badge role-${role}">${role}</span>
            </div>
          </div>
          <button class="sb-signout" onclick="signOut()">Sign Out</button>
        </div>
      </aside>

      <div class="sb-topbar">
        <button class="sb-hamburger" onclick="toggleSidebar()" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <span class="sb-topbar-title">${esc(clubName)} <em>PD</em></span>
      </div>
      <div class="sb-overlay" id="sbOverlay" onclick="closeSidebar()"></div>
    `;

    // Trigger onboarding for first-time visitors
    window._sbRole = role;
    maybeStartTour(activePage);
  };

  window.toggleSidebar = function () {
    const sb = document.getElementById('idpSidebar');
    const ov = document.getElementById('sbOverlay');
    if (!sb) return;
    const open = sb.classList.toggle('open');
    ov && ov.classList.toggle('show', open);
  };
  window.closeSidebar = function () {
    document.getElementById('idpSidebar')?.classList.remove('open');
    document.getElementById('sbOverlay')?.classList.remove('show');
  };

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ─── ONBOARDING TOURS ───────────────────────────────────────────── */
  const TOURS = {
    dashboard: [
      {
        title: 'Welcome to Player Development! 👋',
        body: 'This is your coaching hub. Manage teams, generate individual development plans, and share them with players and parents — all in one place.',
        target: null,
      },
      {
        title: 'Sidebar Navigation',
        body: 'Use the sidebar to move between sections. Dashboard for your teams, All Players for a club-wide roster view, and Lineup Manager for formations.',
        target: '.idp-sidebar',
      },
      {
        title: 'Your Teams',
        body: 'Your teams show as cards here. Click any card to manage players and generate IDPs.',
        target: '.page-header',
      },
      {
        title: "You're ready! 🎉",
        body: 'Start by clicking "+ Add Team". Generate IDPs, build lineups, and share player plans. You can revisit this tour anytime from the Help page.',
        target: null,
      },
    ],
    players: [
      {
        title: 'Club-Wide Roster',
        body: 'Every player in the club appears here. Search by name or filter by team to find anyone instantly.',
        target: '.toolbar',
      },
      {
        title: 'Import from CSV',
        body: 'Have a roster spreadsheet? Click "Import CSV" to bulk-add players to any team in seconds.',
        target: '.btn-amber',
      },
      {
        title: 'Edit & Reassign',
        body: 'Use the Edit button on any player row to update their name, position, or move them to a different team.',
        target: null,
      },
    ],
    settings: [
      {
        title: 'Club Settings',
        body: 'Set your club name and upload a logo — these appear in the sidebar on every page.',
        target: '.settings-section',
      },
      {
        title: 'Claude API Key',
        body: 'Paste your Anthropic API key here to enable AI-powered IDP generation for all coaches.',
        target: null,
      },
      {
        title: 'User Management',
        body: 'See all registered users here. Change roles between Admin, Coach, and Parent as needed.',
        target: null,
      },
    ],
  };

  let _steps = [], _idx = 0, _tourKey = '';

  window.maybeStartTour = function (page) {
    const key = 'idp_tour_v1_' + page;
    if (!localStorage.getItem(key) && TOURS[page]) {
      setTimeout(() => startTour(page), 700);
    }
  };

  window.startTour = function (page) {
    if (!TOURS[page]) return;
    _steps = TOURS[page];
    _idx = 0;
    _tourKey = 'idp_tour_v1_' + page;
    showStep();
  };

  window.obNext = function () { _idx++; showStep(); };
  window.obEnd  = function () {
    document.getElementById('obCutout')?.remove();
    document.getElementById('obTip')?.remove();
    if (_tourKey) localStorage.setItem(_tourKey, '1');
  };

  function showStep() {
    document.getElementById('obCutout')?.remove();
    document.getElementById('obTip')?.remove();
    if (_idx >= _steps.length) { window.obEnd(); return; }

    const step  = _steps[_idx];
    const total = _steps.length;
    const isLast = _idx === total - 1;

    // Spotlight
    const cutout = document.createElement('div');
    cutout.id = 'obCutout';
    cutout.className = 'ob-cutout';
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        const p = 8;
        cutout.style.cssText = `top:${r.top-p}px;left:${r.left-p}px;width:${r.width+p*2}px;height:${r.height+p*2}px;`;
      } else {
        cutout.style.cssText = 'top:0;left:0;width:0;height:0;';
      }
    } else {
      cutout.style.cssText = 'top:0;left:0;width:0;height:0;';
    }
    document.body.appendChild(cutout);

    // Tooltip
    const dots = Array.from({length: total}, (_, i) =>
      `<div class="ob-dot${i === _idx ? ' on' : ''}"></div>`).join('');

    const tip = document.createElement('div');
    tip.id = 'obTip';
    tip.className = 'ob-tooltip';
    tip.innerHTML = `
      <div class="ob-step-label">Step ${_idx + 1} of ${total}</div>
      <div class="ob-title">${step.title}</div>
      <div class="ob-body">${step.body}</div>
      <div class="ob-footer">
        <div class="ob-dots">${dots}</div>
        <button class="ob-skip-btn" onclick="obEnd()">Skip</button>
        <button class="ob-next-btn" onclick="obNext()">${isLast ? 'Done ✓' : 'Next →'}</button>
      </div>
    `;
    document.body.appendChild(tip);

    // Position tooltip near target
    requestAnimationFrame(() => {
      const tr = tip.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      let top, left;
      if (step.target) {
        const cr = cutout.getBoundingClientRect();
        top  = cr.bottom + 14;
        left = cr.left;
        if (top + tr.height > vh - 16) top = cr.top - tr.height - 14;
        if (left + tr.width > vw - 16) left = vw - tr.width - 16;
        if (left < 16) left = 16;
      } else {
        top  = vh / 2 - tr.height / 2;
        left = vw / 2 - tr.width  / 2;
      }
      tip.style.top  = Math.max(16, top)  + 'px';
      tip.style.left = Math.max(16, left) + 'px';
    });
  }

})();
