'use strict';
/* Designer-3 map builder helpers (Node built-ins only). */
const fs = require('fs');
const path = require('path');

function grid(W, H) {
  const g = [];
  for (let r = 0; r < H; r++) g.push(Array(W).fill('.'));
  const chk = (c, r) => { if (c < 0 || r < 0 || c >= W || r >= H) throw new Error('out of bounds ' + c + ',' + r); };
  const o = {
    W, H, g, ents: [],
    rect(c0, r0, c1, r1, ch) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { chk(c, r); g[r][c] = ch; } return o; },
    put(c, r, s) { for (let i = 0; i < s.length; i++) { chk(c + i, r); g[r][c + i] = s[i]; } return o; },
    e(obj) { o.ents.push(obj); return o; },
    map() { return g.map(r => r.join('')); },
  };
  return o;
}

function level(id, name, hint, minPlayers, G) {
  return { id, name, hint, minPlayers, tether: false, tetherLength: 5, map: G.map(), entities: G.ents };
}

function fmtLevel(lv) {
  const out = ['    {'];
  out.push('      "id": ' + JSON.stringify(lv.id) + ',');
  out.push('      "name": ' + JSON.stringify(lv.name) + ',');
  out.push('      "hint": ' + JSON.stringify(lv.hint) + ',');
  out.push('      "minPlayers": ' + lv.minPlayers + ',');
  out.push('      "tether": ' + lv.tether + ',');
  out.push('      "tetherLength": ' + lv.tetherLength + ',');
  out.push('      "map": [');
  lv.map.forEach((row, i) => out.push('        ' + JSON.stringify(row) + (i < lv.map.length - 1 ? ',' : '')));
  out.push('      ],');
  if (!lv.entities.length) out.push('      "entities": []');
  else {
    out.push('      "entities": [');
    lv.entities.forEach((e, i) => out.push('        ' + JSON.stringify(e) + (i < lv.entities.length - 1 ? ',' : '')));
    out.push('      ]');
  }
  out.push('    }');
  return out.join('\n');
}

function writeWorld(n, name, theme, levels) {
  const file = path.join(__dirname, '..', '..', 'levels', 'world' + String(n).padStart(2, '0') + '.json');
  const txt = '{\n  "world": ' + n + ',\n  "name": ' + JSON.stringify(name) + ',\n  "theme": ' + JSON.stringify(theme) +
    ',\n  "levels": [\n' + levels.map(fmtLevel).join(',\n') + '\n  ]\n}\n';
  JSON.parse(txt);
  fs.writeFileSync(file, txt);
  console.log('wrote ' + file + ' (' + levels.length + ' levels)');
}

module.exports = { grid, level, writeWorld };
