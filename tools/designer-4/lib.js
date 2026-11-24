'use strict';
// Designer-4 helpers: build maps from rectangles, write world files with one map row per line.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

function grid(W, H) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const chk = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) throw new Error(`out of bounds ${x},${y} (${W}x${H})`); };
  const api = {
    W, H,
    fill(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { chk(x, y); g[y][x] = ch; } return api; },
    put(x, y, s) { for (let i = 0; i < s.length; i++) { chk(x + i, y); g[y][x + i] = s[i]; } return api; },
    col(x, y, s) { for (let i = 0; i < s.length; i++) { chk(x, y + i); g[y + i][x] = s[i]; } return api; },
    at(x, y) { return g[y][x]; },
    rows() { return g.map(r => r.join('')); },
  };
  return api;
}

function fmtLevel(lv) {
  const head = ['id', 'name', 'hint', 'minPlayers', 'tether', 'tetherLength']
    .map(k => `      ${JSON.stringify(k)}: ${JSON.stringify(lv[k])}`).join(',\n');
  const map = lv.map.map(r => `        ${JSON.stringify(r)}`).join(',\n');
  const ents = lv.entities.length ? '\n' + lv.entities.map(e => `        ${JSON.stringify(e)}`).join(',\n') + '\n      ' : '';
  return `    {\n${head},\n      "map": [\n${map}\n      ],\n      "entities": [${ents}]\n    }`;
}

function writeWorld(file, world, name, theme, levels) {
  const out = `{\n  "world": ${world},\n  "name": ${JSON.stringify(name)},\n  "theme": ${JSON.stringify(theme)},\n  "levels": [\n${levels.map(fmtLevel).join(',\n')}\n  ]\n}\n`;
  JSON.parse(out);
  fs.writeFileSync(path.join(ROOT, 'levels', file), out);
  console.log(`wrote levels/${file} (${levels.length} levels)`);
}

// rope distance helper (tile coords of standing bots -> tiles between centers)
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

module.exports = { grid, writeWorld, dist, ROOT };
