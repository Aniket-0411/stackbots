#!/usr/bin/env node
// Designer-1 level checker (Node built-ins only).
// Usage: node tools/designer-1/check.js [levels/world01.json ...] [--verbose]
// Structural checks + a coarse tile-graph reachability model:
//   solo climb 2, gaps <= 3 (rising 2 => gap <= 2), towers add ~1 tile per bot below.
// Optional per-level "checkWith" scenarios live in tools/designer-1/src/*.js (not in JSON):
//   extra solid tiles that model crates at their intended final positions.
'use strict';
const fs = require('fs');
const path = require('path');

const LEGAL = new Set('.#-^*=<>abcdKDo1234'.split(''));
const SOLID = new Set('#=<>'.split(''));

function charAt(map, c, r) {
  if (c < 0 || c >= map[0].length) return '#';
  if (r < 0 || r >= map.length) return '.';
  return map[r][c];
}

function makeGrid(level, extraSolid) {
  const solid = new Set();
  (extraSolid || []).forEach(([c, r]) => solid.add(c + ',' + r));
  return {
    rows: level.map.length,
    cols: level.map[0].length,
    isSolid(c, r) { return solid.has(c + ',' + r) || SOLID.has(charAt(level.map, c, r)) || (c < 0 || c >= level.map[0].length); },
    isSpike(c, r) { return charAt(level.map, c, r) === '^'; },
    isFree(c, r) { return !this.isSolid(c, r) && !this.isSpike(c, r); },
    standable(c, r) {
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
      return this.isFree(c, r) && (this.isSolid(c, r + 1) || charAt(level.map, c, r + 1) === '-');
    },
  };
}

// fall from (c, r) straight down; returns landing row or null (death)
function fall(g, c, r) {
  for (let y = r; y < g.rows + 2; y++) {
    if (g.isSpike(c, y)) return null;
    if (g.isSolid(c, y)) return null;
    if (g.standable(c, y)) return y;
  }
  return null;
}

// max horizontal tile distance (|dc|) for a jump rising `rise` tiles (relative to start height)
function maxDx(rise) {
  if (rise >= 3) return -1;
  if (rise === 2) return 3; // gap <= 2
  return 4;                  // gap <= 3 (same level, 1 up, or lower)
}

function colClear(g, c, r0, r1) { // rows r0..r1 inclusive free (r0 <= r1)
  for (let y = Math.min(r0, r1); y <= Math.max(r0, r1); y++) if (!g.isFree(c, y)) return false;
  return true;
}

// reachable standing tiles from (c, r). boost = number of bots stacked below the jumper (tower).
// Tower climbs: only near-vertical (|dc| <= 2) and need headroom for the whole tower.
function reach(g, start, boost) {
  const seen = new Set();
  const q = [start];
  seen.add(start.join(','));
  const push = (c, r) => {
    const k = c + ',' + r;
    if (!seen.has(k) && g.standable(c, r)) { seen.add(k); q.push([c, r]); }
  };
  while (q.length) {
    const [c, r] = q.shift();
    for (const d of [-1, 1]) {
      const nc = c + d;
      if (g.isSolid(nc, r)) continue;
      if (g.standable(nc, r)) { push(nc, r); continue; }
      const land = fall(g, nc, r);
      if (land != null) push(nc, land);
    }
    for (let b = 0; b <= boost; b++) {
      // need headroom above the base for the tower of b bots + jumper
      if (!colClear(g, c, r - b, r)) break;
      for (let tr = r - 2 - b; tr <= r + 6; tr++) {
        const rise = r - tr - b; // rise relative to the jumper's feet
        const md = b > 0 ? Math.min(maxDx(rise), 2) : maxDx(rise);
        if (md < 0) continue;
        for (let dc = -md; dc <= md; dc++) {
          if (dc === 0 && tr === r) continue;
          const tc = c + dc;
          if (!g.standable(tc, tr)) continue;
          const top = Math.min(r - b, tr) - 1; // arc top row
          if (!colClear(g, c, top, r)) continue;
          let ok = true;
          const s = Math.sign(dc);
          for (let x = c + s; x !== tc + s && dc !== 0; x += s) {
            const lowRow = x === tc ? tr : Math.min(r, tr) - 1; // mid-air columns: only above the feet row
            if (lowRow >= top && !colClear(g, x, top, lowRow)) { ok = false; break; }
          }
          if (ok) push(tc, tr);
        }
      }
    }
  }
  return seen;
}

function checkLevel(level, opts) {
  const errs = [], warns = [], info = [];
  const id = level.id;
  const m = level.map;
  if (!Array.isArray(m) || !m.length) { errs.push('no map'); return { errs, warns, info }; }
  const W = m[0].length, H = m.length;
  if (W < 24 || W > 96) errs.push('width ' + W);
  if (H < 14 || H > 26) errs.push('height ' + H);
  m.forEach((row, r) => {
    if (row.length !== W) errs.push(`row ${r} length ${row.length} != ${W}`);
    for (const ch of row) if (!LEGAL.has(ch)) errs.push(`row ${r} illegal char '${ch}'`);
  });
  if (typeof level.name !== 'string' || !level.name || level.name.length > 22) errs.push('name len ' + (level.name || '').length);
  if (typeof level.hint !== 'string' || level.hint.length > 70) errs.push('hint len ' + (level.hint || '').length);
  if (![2, 3, 4].includes(level.minPlayers)) errs.push('minPlayers ' + level.minPlayers);
  if (level.tether !== false) warns.push('tether not false');
  const find = (ch) => { const out = []; m.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === ch) out.push([c, r]); }); return out; };
  const doors = find('D');
  if (doors.length !== 1) errs.push('D count ' + doors.length);
  const keys = find('K');
  if (keys.length > 1) errs.push('K count ' + keys.length);
  const gears = find('o');
  if (gears.length < 1 || gears.length > 3) warns.push('gears ' + gears.length);
  for (const ch of (opts.forbid || '')) if (find(ch).length) errs.push(`forbidden tile '${ch}'`);
  if ((level.entities || []).length && opts.noEntities) errs.push('entities not allowed');
  const g0 = makeGrid(level, []);
  if (doors.length === 1) {
    const [c, r] = doors[0];
    if (charAt(m, c, r - 1) !== '.') errs.push('tile above D not empty');
    if (!SOLID.has(charAt(m, c, r + 1))) errs.push('tile below D not solid');
  }
  const spawns = [];
  for (const d of '1234') {
    const s = find(d);
    if (s.length !== 1) { errs.push(`spawn ${d} count ${s.length}`); continue; }
    if (!SOLID.has(charAt(m, s[0][0], s[0][1] + 1))) errs.push(`spawn ${d} not on solid ground`);
    spawns.push(s[0]);
  }
  // headroom: highest solid tile with free space above should leave >= 2 empty rows above a standing bot
  let topStand = H;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (g0.standable(c, r)) topStand = Math.min(topStand, r);
  if (topStand < 2) errs.push('standable row ' + topStand + ' too close to top');
  info.push(`size ${W}x${H}, gears ${gears.length}, top standing row ${topStand}`);
  // entities
  const crates = [];
  (level.entities || []).forEach((e, i) => {
    const w = e.w || 1, h = e.h || 1;
    if (e.x < 0 || e.y < 0 || e.x + w > W || e.y + h > H) errs.push(`entity ${i} out of bounds`);
    if (e.type === 'crate') {
      for (let x = e.x; x < e.x + w; x++) for (let y = e.y; y < e.y + h; y++) {
        const ch = charAt(m, x, y);
        if (ch !== '.') errs.push(`crate ${i} overlaps '${ch}' at ${x},${y}`);
      }
      crates.push({ i, x: e.x, y: e.y, w, h });
    } else if (opts.cratesOnly) errs.push(`entity ${i} type ${e.type} not allowed`);
  });
  crates.forEach((a) => {
    let rest = false;
    for (let x = a.x; x < a.x + a.w; x++) if (SOLID.has(charAt(m, x, a.y + a.h))) rest = true;
    crates.forEach((b) => { if (b !== a && b.y === a.y + a.h && b.x < a.x + a.w && a.x < b.x + b.w) rest = true; });
    if (!rest) errs.push(`crate ${a.i} not resting on floor`);
    crates.forEach((b) => { if (b !== a && b.x < a.x + a.w && a.x < b.x + b.w && b.y < a.y + a.h && a.y < b.y + b.h) errs.push(`crate ${a.i} overlaps crate ${b.i}`); });
  });
  // reachability
  const scenarios = [{ name: 'as-is', solid: [] }].concat(level._checkWith || []);
  for (const sc of scenarios) {
    if (sc.name === 'as-is' && (level.entities || []).length) continue;
    const g = makeGrid(level, sc.solid);
    const dk = doors.length ? doors[0].join(',') : null;
    const kk = keys.length ? keys[0].join(',') : null;
    const startSet = sc.from ? [sc.from] : spawns;
    let anyKey = false;
    startSet.forEach((s, i) => {
      const solo = reach(g, s, 0);
      if (dk && !solo.has(dk)) (sc.soft ? warns : errs).push(`[${sc.name}] start ${s} cannot reach D solo`);
      const tower = reach(g, s, (sc.boost != null ? sc.boost : level.minPlayers - 1));
      if (kk && tower.has(kk)) anyKey = true;
    });
    if (kk && !anyKey && !sc.noKey) (sc.soft ? warns : errs).push(`[${sc.name}] K unreachable even with towers`);
    if (kk) {
      const solo = reach(g, keys[0], 0);
      if (dk && !solo.has(dk) && !sc.noKey) (sc.soft ? warns : errs).push(`[${sc.name}] cannot reach D from K solo`);
      // how many bots are needed to reach K
      let need = null;
      for (let b = 0; b <= 3 && need == null; b++) if (startSet.some((s) => reach(g, s, b).has(kk))) need = b + 1;
      info.push(`[${sc.name}] K needs tower of ${need}`);
    }
    if (opts.verbose) {
      gears.forEach(([c, r]) => {
        let need = null;
        for (let b = 0; b <= 3 && need == null; b++) if (startSet.some((s) => { const R = reach(g, s, b); return R.has(c + ',' + r) || R.has(c + ',' + (r + 1)) || R.has(c + ',' + (r + 2)); })) need = b + 1;
        info.push(`[${sc.name}] gear ${c},${r} needs tower of ${need} (approx)`);
      });
    }
  }
  return { errs, warns, info };
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  let files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) files = ['levels/world01.json', 'levels/world02.json'];
  let bad = 0;
  for (const f of files) {
    const world = JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
    const src = world.__src || null;
    const opts = {
      verbose,
      noEntities: world.world === 1,
      forbid: 'abcd*=<>-',
      cratesOnly: true,
    };
    const ids = new Set();
    world.levels.forEach((lv, i) => {
      if (lv.id !== `${world.world}-${i + 1}`) console.log(`${f}: level ${i} id ${lv.id} unexpected`);
      ids.add(lv.id);
      const extra = (global.__checkWith && global.__checkWith[lv.id]) || [];
      const res = checkLevel(Object.assign({}, lv, { _checkWith: extra }), opts);
      const tag = res.errs.length ? 'FAIL' : 'ok  ';
      if (res.errs.length) bad++;
      console.log(`${tag} ${lv.id} "${lv.name}" min${lv.minPlayers} ${res.info.join(' | ')}`);
      res.errs.forEach((e) => console.log('   ERR  ' + e));
      res.warns.forEach((e) => console.log('   warn ' + e));
    });
    void src;
  }
  process.exitCode = bad ? 1 : 0;
}

module.exports = { checkLevel, reach, makeGrid };
if (require.main === module) {
  // load checkWith scenarios from the designer source files if present
  global.__checkWith = {};
  for (const f of ['world01.js', 'world02.js']) {
    const p = path.join(__dirname, 'src', f);
    if (fs.existsSync(p)) {
      const w = require(p);
      w.levels.forEach((lv) => { if (lv.checkWith) global.__checkWith[lv.id] = lv.checkWith; });
    }
  }
  main();
}
