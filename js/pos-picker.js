// ─── SOCCER POSITION PICKER ───────────────────────────────────────────────
// Shared by team.html and players.html
//
// Usage:
//   HTML:  <div id="myPicker" class="pos-picker"></div>
//          <input type="hidden" id="myInput" />
//   Init:  initPosPicker('myPicker', 'myInput')
//   Open add:  resetPosPicker('myPicker')
//   Open edit: setPosValue('myPicker', 'CM / CAM / RW')
//   Read:  document.getElementById('myInput').value  (updated live)

const POS_GROUPS = [
  {
    label: 'Goalkeeper',
    positions: ['Goalkeeper (GK)']
  },
  {
    label: 'Defenders',
    positions: [
      'Center Back (CB)', 'Right Back (RB)', 'Left Back (LB)',
      'Right Wing Back (RWB)', 'Left Wing Back (LWB)', 'Sweeper (SW)'
    ]
  },
  {
    label: 'Midfielders',
    positions: [
      'Defensive Mid (CDM)', 'Central Mid (CM)', 'Box-to-Box (B2B)',
      'Attacking Mid (CAM)', 'Right Mid (RM)', 'Left Mid (LM)'
    ]
  },
  {
    label: 'Forwards',
    positions: [
      'Striker (ST)', 'Center Forward (CF)', 'Second Striker (SS)',
      'Right Winger (RW)', 'Left Winger (LW)'
    ]
  }
];

// All known position strings for matching
const ALL_POS = POS_GROUPS.flatMap(g => g.positions);

// State map: { pickerId: { selected: Set<string>, inputId: string } }
const _posState = {};

// Stable ID safe for use in DOM ids
function _posKey(str) {
  return str.replace(/[^a-z0-9]/gi, '_');
}

function initPosPicker(pickerId, inputId) {
  const container = document.getElementById(pickerId);
  if (!container) return;
  _posState[pickerId] = { selected: new Set(), inputId };

  container.innerHTML =
    '<div class="pos-trigger" id="' + pickerId + '_trigger" onclick="togglePosPicker(\'' + pickerId + '\')">' +
      '<div class="pos-chips-wrap" id="' + pickerId + '_chips">' +
        '<span class="pos-ph">Select positions\u2026</span>' +
      '</div>' +
      '<svg class="pos-caret" id="' + pickerId + '_caret" width="10" height="6" viewBox="0 0 10 6" fill="none">' +
        '<path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
    '</div>' +
    '<div class="pos-panel" id="' + pickerId + '_panel" style="display:none;">' +
      POS_GROUPS.map(function(g) {
        return '<div class="pos-group">' +
          '<div class="pos-group-lbl">' + g.label + '</div>' +
          '<div class="pos-group-opts">' +
            g.positions.map(function(p) {
              var cbId = pickerId + '_cb_' + _posKey(p);
              return '<label class="pos-opt" for="' + cbId + '">' +
                '<input type="checkbox" id="' + cbId + '" value="' + p + '" ' +
                  'onchange="posCheckChange(\'' + pickerId + '\', this)">' +
                p +
              '</label>';
            }).join('') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
}

function togglePosPicker(id) {
  var panel   = document.getElementById(id + '_panel');
  var trigger = document.getElementById(id + '_trigger');
  var caret   = document.getElementById(id + '_caret');
  if (!panel) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (trigger) trigger.classList.toggle('open', !isOpen);
  if (caret)   caret.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function closePosPicker(id) {
  var panel   = document.getElementById(id + '_panel');
  var trigger = document.getElementById(id + '_trigger');
  var caret   = document.getElementById(id + '_caret');
  if (!panel) return;
  panel.style.display = 'none';
  if (trigger) trigger.classList.remove('open');
  if (caret)   caret.style.transform = '';
}

function posCheckChange(id, cb) {
  var state = _posState[id];
  if (!state) return;
  if (cb.checked) state.selected.add(cb.value);
  else            state.selected.delete(cb.value);
  _renderPosChips(id);
  _syncPosInput(id);
}

function posRemove(id, val) {
  var state = _posState[id];
  if (!state) return;
  state.selected.delete(val);
  var cb = document.getElementById(id + '_cb_' + _posKey(val));
  if (cb) cb.checked = false;
  _renderPosChips(id);
  _syncPosInput(id);
}

function _renderPosChips(id) {
  var state = _posState[id];
  var wrap  = document.getElementById(id + '_chips');
  if (!wrap) return;
  if (state.selected.size === 0) {
    wrap.innerHTML = '<span class="pos-ph">Select positions\u2026</span>';
  } else {
    wrap.innerHTML = Array.from(state.selected).map(function(p) {
      var safeVal = p.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return '<span class="pos-chip">' + p +
        '<button type="button" class="pos-chip-x" ' +
          'onclick="posRemove(\'' + id + '\',\'' + safeVal + '\')" title="Remove">\xD7</button>' +
        '</span>';
    }).join('');
  }
}

function _syncPosInput(id) {
  var state = _posState[id];
  if (!state) return;
  var input = document.getElementById(state.inputId);
  if (input) input.value = Array.from(state.selected).join(' / ');
}

// Set picker from a stored string (e.g. "CM / CAM" or legacy free text)
function setPosValue(id, str) {
  var state = _posState[id];
  if (!state) return;
  state.selected.clear();

  // Uncheck all checkboxes
  ALL_POS.forEach(function(p) {
    var cb = document.getElementById(id + '_cb_' + _posKey(p));
    if (cb) cb.checked = false;
  });

  if (str && str.trim()) {
    str.split('/').map(function(s) { return s.trim(); }).filter(Boolean).forEach(function(s) {
      // Check for exact match against known positions
      var matched = false;
      ALL_POS.forEach(function(p) {
        if (p === s) {
          matched = true;
          state.selected.add(p);
          var cb = document.getElementById(id + '_cb_' + _posKey(p));
          if (cb) cb.checked = true;
        }
      });
      // Legacy free-text — add as-is so it shows as a chip
      if (!matched) state.selected.add(s);
    });
  }

  _renderPosChips(id);
  _syncPosInput(id);
}

function resetPosPicker(id) {
  setPosValue(id, '');
}

// Close any open picker when clicking outside
document.addEventListener('click', function(e) {
  Object.keys(_posState).forEach(function(id) {
    var container = document.getElementById(id);
    if (container && !container.contains(e.target)) {
      closePosPicker(id);
    }
  });
});
