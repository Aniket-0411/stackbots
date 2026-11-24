#!/usr/bin/env node
/* Designer-3 quick checker (Node built-ins only).
 *   node tools/designer-3/check.js [levels/world05.json ...] [--show] [--reach]
 * Static format checks from SPEC §5–§7 plus a rough per-bot reachability BFS
 * (tile-level approximation of §3.1: climb 2 + stack bonus, gaps <= 3, springs 5).
 * It is a sanity tool, not a physics proof — real verification uses tools/sim.js. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const SHOW = args.includes('--show');
const REACH = args.includes('--reach');
const ONLY = (args.find(a => a.startsWith('--id=')) || '').slice(5);
let files = args.filter(a => !a.startsWith('--'));
if (!files.length) files = ['levels/world05.json', 'levels/world06.json'];

const LEGAL = new Set('.#-^*=<>abcdKDo1234'.split(''));
const SOLID = new Set(['#', '=', '<', '>']);
const COLOR = { a: 0, b: 1, c: 2, d: 3 };
const TYPES = new Set(['crate', 'button', 'lever', 'gate', 'platform', 'saw', 'laser']);
const SOURCES = new Set(['button', 'lever']);
const TARGETS = new Set(['gate', 'platform', 'laser']);

let errors = 0, warns = 0;
function err(id, m) { errors++; console.log('  ERROR ' + id + ': ' + m); }
function warn(id, m) { warns++; console.log('  warn  ' + id + ': ' + m); }

function ruler(map) {
  const w = map[0].length;
  let t = '    ', o = '    ';
  for (let c = 0; c < w; c++) { t += c % 10 === 0 ? String((c / 10) | 0) : ' '; o += String(c % 10); }
  const out = [t, o];
  map.forEach((row, r) => out.push(String(r).padStart(3) + ' ' + row));
  return out.join('\n');
}

function checkLevel(lv, worldNo, idx) {
  const id = lv.id || ('?' + idx);
  const expId = worldNo + '-' + (idx + 1);
  if (lv.id !== expId) err(id, 'id should be ' + expId);
  if (typeof lv.name !== 'string' || !lv.name.length || lv.name.length > 22) err(id, 'name length ' + (lv.name || '').length);
  if (typeof lv.hint !== 'string' || lv.hint.length > 70) err(id, 'hint length ' + (lv.hint || '').length);
  if (![2, 3, 4].includes(lv.minPlayers)) err(id, 'minPlayers ' + lv.minPlayers);
  if (typeof lv.tether !== 'boolean') err(id, 'tether not boolean');
  const map = lv.map;
  if (!Array.isArray(map) || !map.length) { err(id, 'no map'); return; }
  const H = map.length, W = map[0].length;
  if (W < 24 || W > 96) err(id, 'width ' + W);
  if (H < 14 || H > 26) err(id, 'height ' + H);
  map.forEach((row, r) => {
    if (row.length !== W) err(id, 'row ' + r + ' length ' + row.length + ' != ' + W);
    for (let c = 0; c < row.length; c++) if (!LEGAL.has(row[c])) err(id, 'illegal char "' + row[c] + '" at ' + c + ',' + r);
  });
  const at = (c, r) => (r < 0 ? '.' : (c < 0 || c >= W) ? '#' : r >= H ? '.' : map[r][c]);
  let D = [], K = [], gears = [], spawns = {}, colorsUsed = new Set();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = map[r][c];
    if (ch === 'D') D.push([c, r]);
    if (ch === 'K') K.push([c, r]);
    if (ch === 'o') gears.push([c, r]);
    if ('1234'.includes(ch)) (spawns[ch] = spawns[ch] || []).push([c, r]);
    if (ch in COLOR) colorsUsed.add(ch);
    if (ch === '*' && !SOLID.has(at(c, r + 1))) err(id, 'spring at ' + c + ',' + r + ' without solid below');
    if (ch === '*' && at(c, r + 1) === '=') warn(id, 'spring on crumble at ' + c + ',' + r);
  }
  if (D.length !== 1) err(id, 'D count ' + D.length);
  else {
    const [c, r] = D[0];
    if (at(c, r - 1) !== '.') err(id, 'tile above D is "' + at(c, r - 1) + '"');
    if (!SOLID.has(at(c, r + 1))) err(id, 'tile below D not solid');
  }
  if (K.length > 1) err(id, 'K count ' + K.length);
  if (gears.length < 1 || gears.length > 3) warn(id, 'gears ' + gears.length);
  for (const d of '1234') {
    const s = spawns[d] || [];
    if (s.length !== 1) { err(id, 'spawn ' + d + ' count ' + s.length); continue; }
    const [c, r] = s[0];
    const below = at(c, r + 1);
    if (!(below === '#' || below === '<' || below === '>')) err(id, 'spawn ' + d + ' not on solid ground (below "' + below + '")');
  }
  if (colorsUsed.has('c') && lv.minPlayers < 3) warn(id, 'uses c walls but minPlayers ' + lv.minPlayers);
  if (colorsUsed.has('d') && lv.minPlayers < 4) warn(id, 'uses d walls but minPlayers ' + lv.minPlayers);
  // headroom: highest solid tile row
  let top = H;
  for (let r = 0; r < H && top === H; r++) for (let c = 0; c < W; c++) if (map[r][c] !== '.' && map[r][c] !== 'o') { top = r; break; }
  if (top < 2) warn(id, 'non-empty tile in row ' + top + ' (keep 2 empty rows above standable surfaces)');

  // entities
  const chanSrc = {}, chanTgt = {};
  const ents = lv.entities || [];
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  for (const e of ents) {
    const tag = e.type + '@' + e.x + ',' + e.y;
    if (!TYPES.has(e.type)) { err(id, 'unknown entity ' + e.type); continue; }
    if (!Number.isInteger(e.x) || !Number.isInteger(e.y) || !inB(e.x, e.y)) err(id, tag + ' bad coords');
    if (e.channel != null && !/^[A-H]$/.test(e.channel)) err(id, tag + ' bad channel ' + e.channel);
    if (SOURCES.has(e.type)) (chanSrc[e.channel] = chanSrc[e.channel] || []).push(e);
    if (TARGETS.has(e.type) && e.channel) (chanTgt[e.channel] = chanTgt[e.channel] || []).push(e);
    const w = e.w || 1, h = e.h || 1;
    if (e.type === 'button') {
      for (let i = 0; i < w; i++) {
        if (!SOLID.has(at(e.x + i, e.y + 1))) err(id, tag + ' plate tile ' + (e.x + i) + ' has no solid below');
        if (at(e.x + i, e.y) !== '.') err(id, tag + ' plate tile not empty: "' + at(e.x + i, e.y) + '"');
      }
      if (!['hold', 'latch', 'timer', undefined].includes(e.mode)) err(id, tag + ' bad mode');
    }
    if (e.type === 'lever') {
      if (at(e.x, e.y) !== '.') err(id, tag + ' lever tile not empty');
      if (!SOLID.has(at(e.x, e.y + 1))) err(id, tag + ' lever without floor');
    }
    if (e.type === 'gate' || e.type === 'crate') {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
        const ch = at(e.x + i, e.y + j);
        if (ch !== '.') err(id, tag + ' overlaps tile "' + ch + '" at ' + (e.x + i) + ',' + (e.y + j));
      }
    }
    if (e.type === 'crate') {
      let grounded = false;
      for (let i = 0; i < w; i++) if (SOLID.has(at(e.x + i, e.y + h)) || 'abcd'.includes(at(e.x + i, e.y + h))) grounded = true;
      for (const o of ents) if (o !== e && o.type === 'crate' && o.y === e.y + h && o.x < e.x + w && o.x + (o.w || 1) > e.x) grounded = true;
      for (const o of ents) if (o.type === 'button' && o.y === e.y + h - 1 && o.x < e.x + w && o.x + (o.w || 1) > e.x) grounded = grounded || SOLID.has(at(o.x, o.y + 1));
      if (!grounded) warn(id, tag + ' crate not resting on solid');
    }
    if (e.type === 'platform') {
      if (!Array.isArray(e.path) || !e.path.length) err(id, tag + ' no path');
      else {
        if (e.path[0][0] !== e.x || e.path[0][1] !== e.y) err(id, tag + ' path[0] != x,y');
        for (const p of e.path) if (!inB(p[0], p[1]) || !inB(p[0] + w - 1, p[1])) err(id, tag + ' waypoint out of bounds');
        for (let k = 1; k < e.path.length; k++) {
          const [x0, y0] = e.path[k - 1], [x1, y1] = e.path[k];
          if (x0 !== x1 && y0 !== y1) warn(id, tag + ' diagonal path segment');
        }
      }
    }
  }
  for (const ch of Object.keys(chanTgt)) if (!chanSrc[ch]) err(id, 'channel ' + ch + ' has targets but no source');
  for (const ch of Object.keys(chanSrc)) if (!chanTgt[ch]) err(id, 'channel ' + ch + ' has sources but no target');
  if (SHOW) console.log(ruler(map));
  if (REACH) reach(lv, map, W, H, at);
}

/* ---------- rough reachability ---------- */
function reach(lv, map, W, H, at) {
  const ents = lv.entities || [];
  const nPl = 4;
  function build(slot, opts) {
    const solidT = (c, r) => {
      if (r >= H) return false;
      const ch = at(c, r);
      if (SOLID.has(ch)) return true;
      if (ch in COLOR) return COLOR[ch] !== slot || slot >= opts.players;
      for (const g of ents) if (g.type === 'gate' && !opts.gatesOpen && c >= g.x && c < g.x + (g.w || 1) && r >= g.y && r < g.y + (g.h || 1)) return true;
      if (opts.crates) for (const g of ents) if (g.type === 'crate' && c >= g.x && c < g.x + (g.w || 1) && r >= g.y && r < g.y + (g.h || 1)) return true;
      return false;
    };
    const platTop = new Set();
    for (const p of ents) if (p.type === 'platform') {
      const pts = [];
      for (let k = 0; k < p.path.length; k++) {
        const [x1, y1] = p.path[k];
        if (k === 0) pts.push([x1, y1]);
        else {
          let [x0, y0] = p.path[k - 1];
          while (x0 !== x1 || y0 !== y1) { x0 += Math.sign(x1 - x0); y0 += Math.sign(y1 - y0); pts.push([x0, y0]); }
        }
      }
      p._pts = pts;
      for (const [x, y] of pts) for (let i = 0; i < (p.w || 1); i++) platTop.add((x + i) + ',' + y);
    }
    const pass = (c, r) => r < H + 1 && !solidT(c, r) && at(c, r) !== '^';
    const floorUnder = (c, r) => solidT(c, r + 1) || at(c, r + 1) === '-' || platTop.has(c + ',' + (r + 1));
    const stand = (c, r) => c >= 0 && c < W && r >= 0 && r < H && pass(c, r) && (floorUnder(c, r) || at(c, r) === '*');
    return { pass, stand, solidT, platTop };
  }
  function bfs(slot, start, Hc, opts) {
    const { pass, stand } = build(slot, opts);
    const seen = new Set();
    const key = (c, r) => c + ',' + r;
    const q = [];
    function fallFrom(c, r) { // bot in (c,r) without floor: falls
      while (r < H) {
        if (!pass(c, r)) return null;
        if (stand(c, r)) return [c, r];
        r++;
      }
      return null; // fell out
    }
    function push(p) { if (p && !seen.has(key(p[0], p[1]))) { seen.add(key(p[0], p[1])); q.push(p); } }
    push(fallFrom(start[0], start[1]));
    while (q.length) {
      const [c, r] = q.shift();
      const spring = at(c, r) === '*';
      const up = spring ? 5 : Hc;
      if (!spring) {
        for (const dc of [-1, 1]) if (pass(c + dc, r)) push(fallFrom(c + dc, r));
        if (at(c, r + 1) === '-') push(fallFrom(c, r + 2) ? fallFrom(c, r + 1 + 1) : null);
      }
      // jumps / launches
      for (let r2 = Math.max(0, r - up); r2 < H; r2++) for (let c2 = c - 4; c2 <= c + 4; c2++) {
        if (c2 === c && r2 === r) continue;
        if (!stand(c2, r2)) continue;
        const dy = r - r2, dx = Math.abs(c2 - c);
        let maxDx = dy <= 0 ? 4 : dy === 1 ? 3 : dy === 2 ? 2 : 1;
        if (spring) maxDx = dy <= 0 ? 4 : 2;
        if (dx > maxDx) continue;
        if (dy < -1) continue; // big drops are handled by walk+fall
        const s = Math.sign(c2 - c);
        let ok = false;
        if (dy > 0) {
          ok = true;
          for (let rr = r; rr >= r2; rr--) if (!pass(c, rr)) ok = false;
          for (let cc = c; cc !== c2 && ok; cc += s) if (!pass(cc + s, r2)) ok = false;
        } else {
          for (const row of [r, r - 1]) {
            let o = true;
            if (row === r - 1 && (!pass(c, r - 1) || !pass(c2, r - 1))) o = false;
            for (let cc = c; cc !== c2 && o; cc += s) if (!pass(cc + s, row)) o = false;
            for (let rr = row; rr <= r2 && o; rr++) if (!pass(c2, rr)) o = false;
            if (o) ok = true;
          }
        }
        if (ok) push([c2, r2]);
      }
      // ride platforms
      for (const p of ents) if (p.type === 'platform') {
        const onIt = p._pts.some(([x, y]) => y === r + 1 && c >= x && c < x + (p.w || 1));
        if (!onIt) continue;
        for (const [x, y] of p._pts) for (let i = 0; i < (p.w || 1); i++) if (pass(x + i, y - 1)) push([x + i, y - 1]);
      }
    }
    return seen;
  }
  const spawns = {};
  let D = null, K = null;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = map[r][c];
    if ('1234'.includes(ch)) spawns[+ch - 1] = [c, r];
    if (ch === 'D') D = [c, r];
    if (ch === 'K') K = [c, r];
  }
  const players = 4;
  const lines = [];
  for (const [label, Hc, gatesOpen] of [['solo,gates-closed', 2, false], ['solo,gates-open', 2, true], ['tower5,gates-open', 5, true]]) {
    let s = label.padEnd(20);
    for (let slot = 0; slot < players; slot++) {
      const seen = bfs(slot, spawns[slot], Hc, { players, gatesOpen, crates: true });
      const hasD = seen.has(D[0] + ',' + D[1]);
      const hasK = K ? [...seen].some(k => { const [c, r] = k.split(',').map(Number); return Math.abs(c - K[0]) <= 0 && (r === K[1] || r === K[1] + 1 || r === K[1] - 1); }) : true;
      s += ' s' + slot + ':' + (hasD ? 'D' : '-') + (hasK ? 'K' : '-');
    }
    lines.push(s);
  }
  console.log('    reach ' + lv.id + ' | ' + lines.join(' | '));
}

for (const f of files) {
  const p = path.isAbsolute(f) ? f : path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log(f + ': missing'); continue; }
  let w;
  try { w = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.log(f + ': BAD JSON ' + e.message); errors++; continue; }
  console.log(f + ': world ' + w.world + ' "' + w.name + '" theme ' + w.theme + ', ' + w.levels.length + ' levels');
  if (w.levels.length !== 10) warn(f, 'level count ' + w.levels.length);
  w.levels.forEach((lv, i) => { if (!ONLY || lv.id === ONLY) checkLevel(lv, w.world, i); });
}
console.log(errors + ' error(s), ' + warns + ' warning(s)');
process.exit(errors ? 1 : 0);
