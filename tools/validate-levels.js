#!/usr/bin/env node
'use strict';
/*
 * STACKBOTS level validator (owned by QA). Node built-ins only, no engine dependency.
 *
 *   node tools/validate-levels.js                  all levels/world*.json
 *   node tools/validate-levels.js world03 7        one or more world files (world03 / 03 / 3 / a path)
 *   node tools/validate-levels.js 3-4 3-5          only these level ids
 *   node tools/validate-levels.js --examples       also check levels/_examples.json
 *   node tools/validate-levels.js --json           machine-readable output on stdout
 *   node tools/validate-levels.js --errors         print ERRORs only
 *   node tools/validate-levels.js --no-heur        skip the reachability heuristic (fast)
 *   node tools/validate-levels.js --partial        a world with < 10 levels is a WARN instead of an ERROR (work in progress)
 *   node tools/validate-levels.js --show 3-4[:s]   print map of level 3-4 with a reachability overlay for slot s (0-3)
 *
 * Severities
 *   ERROR  breaks the SPEC contract (engine may reject the level, or it is plainly broken). Exit code 1.
 *   WARN   probably wrong, or against a SPEC design rule. Please review.
 *   HEUR   reachability heuristic: an OPTIMISTIC model of SPEC §3.1 (gates open, crates anywhere they can slide,
 *          platforms connect their whole path, towers whenever enough bots can reach the base). If even this
 *          optimistic model says "unreachable", the level is very likely broken; still, a human must review.
 *          NOT modelled (so these show up as false alarms): tether rope hauls, a crate dropped onto another crate,
 *          a crate carried up by a lift, a rider launched by a spring on top of its partner (pogo).
 *
 * Positions are printed as [col,row] (= [x,y] tile coords, 0-based from the top-left), like entity x/y in JSON.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEVELS_DIR = path.join(ROOT, 'levels');

// ---- SPEC §3 constants used by the heuristic ----
const T = 32, PH = 30, G = 0.55, MAX_FALL = 12, RUN = 2.6;
const JUMP_V = 9.6, SPRING_V = 14, SPRING_TOP = 12, SAW_R = 14, SAW_FORGIVE = 2;
const JUMP_APEX = JUMP_V * JUMP_V / (2 * G);      // 83.8 px
const SPRING_APEX = SPRING_V * SPRING_V / (2 * G); // 178.2 px

const WORLD_TABLE = {
  1: { name: 'Boot Up', theme: 'meadow' },
  2: { name: 'Heavy Lifting', theme: 'workshop' },
  3: { name: 'Switchyard', theme: 'switchyard' },
  4: { name: 'Skyway', theme: 'skyway' },
  5: { name: 'Prism', theme: 'prism' },
  6: { name: 'Bounce House', theme: 'bouncy' },
  7: { name: 'Tied Together', theme: 'ropeway' },
  8: { name: 'Foundry', theme: 'foundry' },
  9: { name: 'Hazard Zone', theme: 'hazard' },
  10: { name: 'Summit', theme: 'summit' },
};
const THEMES = new Set(Object.values(WORLD_TABLE).map(w => w.theme));
const LEGAL = new Set('.#-^*=<>abcdKDo1234'.split(''));
const COLOR_SLOT = { a: 0, b: 1, c: 2, d: 3 };
const SLOT_NAME = ['bot 1 Coral', 'bot 2 Teal', 'bot 3 Marigold', 'bot 4 Lilac'];
const CHANNELS = new Set('ABCDEFGH'.split(''));
const SOLID_GROUND = new Set(['#', '=', '<', '>']);

// mechanic -> [world that introduces it (§8), label]
const MECH = {
  spikes: [1, "spikes '^'"], gears: [1, "gears 'o'"],
  crate: [2, 'crates'],
  button: [3, 'buttons'], gate: [3, 'gates'], lever: [3, 'levers'],
  platform: [4, 'moving platforms / elevators'], oneway: [4, "one-way platforms '-'"],
  color: [5, 'color walls a-d'],
  spring: [6, "springs '*'"], crumble: [6, "crumble blocks '='"], conveyor: [6, "conveyors '<' '>'"],
  tether: [7, 'tether'],
  laser: [8, 'lasers'],
  laserCycle: [9, 'cycling lasers (on/off)'], saw: [9, 'saws'],
};

const ENTITY_FIELDS = {
  crate: { req: ['x', 'y'], opt: ['w', 'h', 'need', 'weight'] },
  button: { req: ['x', 'y', 'channel'], opt: ['w', 'need', 'mode', 'time'] },
  lever: { req: ['x', 'y', 'channel'], opt: ['on'] },
  gate: { req: ['x', 'y', 'channel'], opt: ['w', 'h', 'logic', 'invert'] },
  platform: { req: ['x', 'y', 'path'], opt: ['w', 'speed', 'mode', 'channel', 'need', 'logic'] },
  saw: { req: ['x', 'y'], opt: ['path', 'speed', 'mode'] },
  laser: { req: ['x', 'y', 'dir'], opt: ['channel', 'invert', 'on', 'off', 'phase', 'logic'] },
};
const SOURCE_TYPES = new Set(['button', 'lever']);
const TARGET_TYPES = new Set(['gate', 'platform', 'laser']);

const SEV_ORDER = { ERROR: 0, WARN: 1, HEUR: 2 };

const pos = (c, r) => `[${c},${r}]`;
const isInt = v => Number.isInteger(v);
const isNum = v => typeof v === 'number' && isFinite(v);

// ---------------------------------------------------------------------------------------------
// Finding sink
// ---------------------------------------------------------------------------------------------
function makeSink(file) {
  const items = [];
  return {
    items,
    add(sev, scope, code, msg, opt) {
      opt = opt || {};
      items.push({
        sev, file, level: scope.id || null, name: scope.name || null,
        c: opt.c === undefined ? null : opt.c, r: opt.r === undefined ? null : opt.r,
        code, msg, fix: opt.fix || null,
      });
    },
  };
}

// ---------------------------------------------------------------------------------------------
// World file
// ---------------------------------------------------------------------------------------------
function worldNumFromFile(file) {
  const m = /world(\d+)\.json$/i.exec(path.basename(file));
  return m ? parseInt(m[1], 10) : null;
}

function validateWorldFile(file, opts) {
  opts = opts || {};
  const rel = path.relative(ROOT, file) || file;
  const sink = makeSink(rel);
  const result = { file: rel, world: null, levels: [], findings: sink.items };
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) {
    sink.add('ERROR', {}, 'read', `cannot read file: ${e.message}`);
    return result;
  }
  let obj;
  try { obj = JSON.parse(txt); } catch (e) {
    let where = '';
    const m = /position (\d+)/.exec(e.message);
    if (m) {
      const p = +m[1]; const before = txt.slice(0, p); const line = before.split('\n').length;
      const col = p - before.lastIndexOf('\n');
      where = ` (line ${line}, column ${col})`;
    }
    sink.add('ERROR', {}, 'json', `invalid JSON${where}: ${e.message}`, { fix: 'fix the JSON syntax (trailing commas and comments are not allowed)' });
    return result;
  }
  validateWorldObject(obj, sink, Object.assign({}, opts, { fileWorld: worldNumFromFile(file), isExamples: /_examples\.json$/.test(file) }), result);
  return result;
}

function validateWorldObject(obj, sink, opts, result) {
  opts = opts || {};
  result = result || { levels: [], findings: sink.items };
  const W = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    sink.add('ERROR', W, 'world-shape', 'world file must be a JSON object {world, name, theme, levels}');
    return result;
  }
  const examples = !!opts.isExamples;
  const wn = obj.world;
  result.world = wn;
  if (!isInt(wn)) sink.add('ERROR', W, 'world-num', `"world" must be an integer, got ${JSON.stringify(wn)}`);
  else if (opts.fileWorld != null && wn !== opts.fileWorld) sink.add('ERROR', W, 'world-num', `"world": ${wn} but the file name says world ${opts.fileWorld}`, { fix: `set "world": ${opts.fileWorld}` });
  else if (!examples && !WORLD_TABLE[wn]) sink.add('ERROR', W, 'world-num', `world ${wn} is not in the SPEC §8 table (1-10)`);
  const spec = WORLD_TABLE[wn];
  if (typeof obj.name !== 'string' || !obj.name) sink.add('ERROR', W, 'world-name', 'missing world "name"', spec ? { fix: `"name": "${spec.name}"` } : {});
  else if (spec && !examples && obj.name !== spec.name) sink.add('WARN', W, 'world-name', `world name "${obj.name}" differs from SPEC §8 "${spec.name}"`, { fix: `"name": "${spec.name}"` });
  if (typeof obj.theme !== 'string') sink.add('ERROR', W, 'theme', 'missing "theme"', spec ? { fix: `"theme": "${spec.theme}"` } : {});
  else if (!THEMES.has(obj.theme)) sink.add('ERROR', W, 'theme', `unknown theme "${obj.theme}"`, { fix: `one of ${[...THEMES].join(', ')}` });
  else if (spec && !examples && obj.theme !== spec.theme) sink.add('ERROR', W, 'theme', `theme "${obj.theme}" but SPEC §7/§8 says world ${wn} is "${spec.theme}"`, { fix: `"theme": "${spec.theme}"` });
  const known = new Set(['world', 'name', 'theme', 'levels']);
  for (const k of Object.keys(obj)) if (!known.has(k)) sink.add('WARN', W, 'world-field', `unknown world field "${k}"`);
  if (!Array.isArray(obj.levels)) { sink.add('ERROR', W, 'levels', '"levels" must be an array'); return result; }
  if (!examples && obj.levels.length !== 10) sink.add(opts.partial && obj.levels.length < 10 ? 'WARN' : 'ERROR', W, 'levels-count', `world has ${obj.levels.length} levels, expected 10`, { fix: 'each world file holds exactly 10 levels W-1..W-10' });

  const names = new Map();
  obj.levels.forEach((lv, i) => {
    const ctx = { sink, worldNum: isInt(wn) ? wn : null, index: i, opts, examples, theme: obj.theme };
    const lr = validateLevel(lv, ctx);
    if (lr) result.levels.push(lr);
    if (lv && typeof lv.name === 'string') {
      const key = lv.name.trim().toLowerCase();
      if (names.has(key)) sink.add('ERROR', { id: lv.id, name: lv.name }, 'name-dup', `name "${lv.name}" is already used by ${names.get(key)} in this world`, { fix: 'give every level a unique name' });
      else names.set(key, lv.id);
    }
  });
  return result;
}

// ---------------------------------------------------------------------------------------------
// Level
// ---------------------------------------------------------------------------------------------
function validateLevel(lv, ctx) {
  const { sink, worldNum, index, opts } = ctx;
  const scope = { id: lv && typeof lv.id === 'string' ? lv.id : `#${index + 1}`, name: lv && typeof lv.name === 'string' ? lv.name : null };
  const E = (code, msg, o) => sink.add('ERROR', scope, code, msg, o);
  const Wn = (code, msg, o) => sink.add('WARN', scope, code, msg, o);
  const Hn = (code, msg, o) => sink.add('HEUR', scope, code, msg, o);
  if (opts.idFilter && opts.idFilter.size && !opts.idFilter.has(scope.id)) return null;
  if (!lv || typeof lv !== 'object' || Array.isArray(lv)) { E('level-shape', 'level must be an object'); return null; }
  const t0 = Date.now();

  // ---- header fields ----
  const expectedId = worldNum != null ? `${worldNum}-${index + 1}` : null;
  if (typeof lv.id !== 'string') E('id', 'missing "id"', expectedId ? { fix: `"id": "${expectedId}"` } : {});
  else if (expectedId && lv.id !== expectedId) E('id-order', `id "${lv.id}" but this is level #${index + 1} of world ${worldNum}`, { fix: `use "id": "${expectedId}" (ids W-1..W-10 in file order)` });
  if (typeof lv.name !== 'string' || !lv.name.trim()) E('name', 'missing or empty "name"');
  else if (lv.name.length > 22) E('name-long', `name "${lv.name}" is ${lv.name.length} chars (max 22)`, { fix: 'shorten the name to 22 characters or fewer' });
  if (lv.hint === undefined) Wn('hint-missing', 'no "hint" field', { fix: 'add "hint": "" (or a hint of max 70 chars on levels that introduce a mechanic)' });
  else if (typeof lv.hint !== 'string') E('hint-type', '"hint" must be a string');
  else if (lv.hint.length > 70) E('hint-long', `hint is ${lv.hint.length} chars (max 70): "${lv.hint}"`, { fix: 'shorten the hint to 70 characters or fewer' });
  if (index === 0 && worldNum >= 1 && !ctx.examples && typeof lv.hint === 'string' && !lv.hint) Wn('hint-intro', 'level 1 of a world introduces its mechanic, but has no hint', { fix: 'add a short hint (max 70 chars)' });
  const minP = lv.minPlayers;
  if (!isInt(minP) || minP < 2 || minP > 4) E('minPlayers', `minPlayers must be an integer 2-4, got ${JSON.stringify(minP)}`, { fix: '"minPlayers": 2 (or 3 / 4)' });
  if (lv.tether === undefined) Wn('tether-missing', 'no "tether" field (defaults to false)', { fix: 'add "tether": false' });
  else if (typeof lv.tether !== 'boolean') E('tether', `"tether" must be true/false, got ${JSON.stringify(lv.tether)}`);
  if (lv.tetherLength !== undefined && (!isNum(lv.tetherLength) || lv.tetherLength < 1)) E('tetherLength', `"tetherLength" must be a positive number, got ${JSON.stringify(lv.tetherLength)}`);
  else if (lv.tether === true && isNum(lv.tetherLength) && (lv.tetherLength < 3 || lv.tetherLength > 12)) Wn('tetherLength', `tetherLength ${lv.tetherLength} is unusual (default 5)`, { fix: 'use 3-12 tiles' });
  const knownLv = new Set(['id', 'name', 'hint', 'minPlayers', 'tether', 'tetherLength', 'map', 'entities']);
  for (const k of Object.keys(lv)) if (!knownLv.has(k)) Wn('level-field', `unknown level field "${k}" (typo?)`);

  // ---- map ----
  const info = checkMap(lv, scope, E, Wn);
  const result = { id: scope.id, name: scope.name, minPlayers: minP, ms: 0, reach: null };
  if (!info) return result;
  info.id = scope.id;
  info.minPlayers = isInt(minP) && minP >= 2 && minP <= 4 ? minP : 4;
  info.tether = lv.tether === true;

  // ---- entities ----
  if (lv.entities === undefined) Wn('entities-missing', 'no "entities" field', { fix: 'add "entities": []' });
  else if (!Array.isArray(lv.entities)) E('entities', '"entities" must be an array');
  info.ents = checkEntities(Array.isArray(lv.entities) ? lv.entities : [], info, E, Wn);

  // ---- hazards vs spawns / hatch / cell ----
  checkHazards(info, E, Wn);

  // ---- mechanic scope per world ----
  if (worldNum >= 1 && worldNum <= 10 && !ctx.examples) checkScope(lv, info, worldNum, E, Wn);

  // ---- minPlayers sanity ----
  if (isInt(minP)) {
    for (const ch of info.colorsUsed) {
      const k = COLOR_SLOT[ch];
      if (minP <= k) Wn('minplayers-color', `color wall '${ch}' belongs to ${SLOT_NAME[k]}, but minPlayers is ${minP}: with ${minP} bots slot ${k} is absent and every '${ch}' tile is solid for everyone`, { fix: `raise minPlayers to ${k + 1}, or make sure the level never needs to pass '${ch}'`, c: info.colorFirst[ch][0], r: info.colorFirst[ch][1] });
    }
  }

  // ---- reachability heuristic ----
  if (!opts.noHeur) {
    if (!info.reachOK) Hn('reach-skip', 'reachability heuristic skipped: fix the spawn/hatch ERRORs first');
    else {
      try {
        result.reach = reportReach(info, Hn, Wn, opts);
      } catch (e) {
        Hn('reach-crash', `reachability heuristic crashed: ${e.stack.split('\n').slice(0, 2).join(' ')}`);
      }
    }
  }
  result.ms = Date.now() - t0;
  return result;
}

// ---------------------------------------------------------------------------------------------
// Map checks
// ---------------------------------------------------------------------------------------------
function checkMap(lv, scope, E, Wn) {
  const m = lv.map;
  if (!Array.isArray(m) || !m.length || m.some(r => typeof r !== 'string')) {
    E('map', '"map" must be a non-empty array of strings');
    return null;
  }
  const rows = m.length;
  const cols = m[0].length;
  let shapeOK = true;
  m.forEach((row, r) => {
    if (row.length !== cols) {
      shapeOK = false;
      E('row-length', `row ${r} has ${row.length} chars, row 0 has ${cols}`, { r, fix: `make every row exactly ${cols} chars (pad with '.')` });
    }
  });
  if (cols < 24 || cols > 96) E('map-width', `map is ${cols} wide (allowed 24-96)`);
  if (rows < 14 || rows > 26) E('map-height', `map is ${rows} tall (allowed 14-26)`);
  // pad for analysis
  const grid = m.map(row => (row + '.'.repeat(Math.max(0, cols - row.length))).slice(0, cols));
  const at = (c, r) => (c < 0 || c >= cols) ? '#' : (r < 0 || r >= rows) ? '.' : grid[r][c];

  // illegal chars
  const bad = new Map();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = grid[r][c];
    if (!LEGAL.has(ch)) {
      if (!bad.has(ch)) bad.set(ch, []);
      bad.get(ch).push([c, r]);
    }
  }
  for (const [ch, list] of bad) {
    const shown = list.slice(0, 4).map(p => pos(p[0], p[1])).join(' ');
    const more = list.length > 4 ? ` (+${list.length - 4} more)` : '';
    const name = ch === ' ' ? 'space' : JSON.stringify(ch);
    E('bad-char', `illegal map char ${name} x${list.length} at ${shown}${more}`, { c: list[0][0], r: list[0][1], fix: ch === ' ' ? "use '.' for empty tiles, never spaces" : "legal chars: . # - ^ * = < > a b c d K D o 1 2 3 4" });
  }

  const info = { rows, cols, grid, at, spawns: [null, null, null, null], door: null, key: null, gears: [], springs: [], colorsUsed: new Set(), colorFirst: {}, chars: new Set(), reachOK: true, shapeOK };
  const doors = [], keys = [], digits = { 1: [], 2: [], 3: [], 4: [] };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = grid[r][c];
    info.chars.add(ch);
    if (ch === 'D') doors.push([c, r]);
    else if (ch === 'K') keys.push([c, r]);
    else if (ch === 'o') info.gears.push([c, r]);
    else if (ch === '*') info.springs.push([c, r]);
    else if (digits[ch]) digits[ch].push([c, r]);
    else if (ch in COLOR_SLOT) { info.colorsUsed.add(ch); if (!info.colorFirst[ch]) info.colorFirst[ch] = [c, r]; }
  }
  // hatch
  if (doors.length !== 1) {
    E('door-count', `found ${doors.length} hatch tiles 'D', need exactly 1` + (doors.length ? ` at ${doors.map(p => pos(p[0], p[1])).join(' ')}` : ''), { fix: "place exactly one 'D' (the hatch's bottom tile)" });
    info.reachOK = false;
  }
  if (doors.length >= 1) {
    const [c, r] = doors[0];
    info.door = { c, r };
    const above = at(c, r - 1), below = at(c, r + 1);
    if (r === 0) E('door-above', `hatch 'D' at ${pos(c, r)} is in row 0; the hatch is 2 tiles tall`, { c, r, fix: 'move D down so the tile above it is inside the map' });
    else if (above !== '.') E('door-above', `tile above hatch 'D' ${pos(c, r)} is '${above}', must be '.' (hatch is 1x2)`, { c, r: r - 1, fix: `put '.' at ${pos(c, r - 1)}` });
    if (r + 1 >= info.rows || !SOLID_GROUND.has(below)) { E('door-below', `tile below hatch 'D' ${pos(c, r)} is '${r + 1 >= rows ? 'out of map' : below}', must be solid (# = < >)`, { c, r: r + 1, fix: `put '#' at ${pos(c, r + 1)}` }); info.reachOK = false; }
    else if (below === '=') Wn('door-crumble', `hatch ${pos(c, r)} stands on a crumble block; it will vanish under bots waiting to enter`, { c, r: r + 1, fix: "use '#' under the hatch" });
  }
  // key
  if (keys.length > 1) E('key-count', `found ${keys.length} Power Cells 'K' (max 1) at ${keys.map(p => pos(p[0], p[1])).join(' ')}`, { fix: "keep a single 'K'" });
  if (keys.length) info.key = { c: keys[0][0], r: keys[0][1] };
  // spawns
  for (let d = 1; d <= 4; d++) {
    const list = digits[d];
    if (list.length !== 1) {
      E('spawn-count', `spawn '${d}' appears ${list.length} times (need exactly 1)` + (list.length ? ` at ${list.map(p => pos(p[0], p[1])).join(' ')}` : ''), { fix: `place exactly one '${d}' on an empty tile with '#' below` });
      info.reachOK = false;
      if (!list.length) continue;
    }
    const [c, r] = list[0];
    info.spawns[d - 1] = { c, r };
    const below = at(c, r + 1);
    if (r + 1 >= rows) { E('spawn-floor', `spawn '${d}' at ${pos(c, r)} is on the bottom row (no ground below)`, { c, r, fix: 'move it up onto ground' }); info.reachOK = false; }
    else if (SOLID_GROUND.has(below)) {
      if (below === '=') Wn('spawn-crumble', `spawn '${d}' at ${pos(c, r)} stands on a crumble block: it vanishes 0.5 s after the level starts`, { c, r: r + 1, fix: `put '#' at ${pos(c, r + 1)}` });
      if (below === '<' || below === '>') Wn('spawn-conveyor', `spawn '${d}' at ${pos(c, r)} stands on a conveyor: the bot drifts right away`, { c, r: r + 1 });
    } else if (below in COLOR_SLOT) {
      if (COLOR_SLOT[below] === d - 1) { E('spawn-floor', `spawn '${d}' at ${pos(c, r)} stands on its OWN color wall '${below}' and falls through it`, { c, r: r + 1, fix: `put '#' at ${pos(c, r + 1)}` }); }
      else Wn('spawn-colorfloor', `spawn '${d}' at ${pos(c, r)} stands on color wall '${below}' (solid for this bot only while ${SLOT_NAME[COLOR_SLOT[below]]} ...); prefer '#'`, { c, r: r + 1 });
    } else if (below === '-') Wn('spawn-oneway', `spawn '${d}' at ${pos(c, r)} stands on a one-way platform; SPEC asks for solid ground`, { c, r: r + 1, fix: `put '#' at ${pos(c, r + 1)}` });
    else { E('spawn-floor', `spawn '${d}' at ${pos(c, r)} has '${below}' below it; spawns need solid ground directly below (# = < >)`, { c, r: r + 1, fix: `put '#' at ${pos(c, r + 1)} or move the spawn down onto ground` }); }
    const l = at(c - 1, r), rr = at(c + 1, r);
    if (l === '^' || rr === '^') Wn('spawn-spike', `spawn '${d}' at ${pos(c, r)} is right next to spikes`, { c, r, fix: 'leave at least one safe tile between spawns and spikes' });
    if (at(c, r - 1) === '^') Wn('spawn-spike', `spikes directly above spawn '${d}' at ${pos(c, r)} (a jump kills)`, { c, r: r - 1 });
  }
  // springs need solid below
  for (const [c, r] of info.springs) {
    const below = at(c, r + 1);
    if (r + 1 >= rows || !(SOLID_GROUND.has(below) || below in COLOR_SLOT)) E('spring-floor', `spring '*' at ${pos(c, r)} has '${r + 1 >= rows ? 'nothing' : below}' below; springs need solid ground below`, { c, r, fix: `put '#' at ${pos(c, r + 1)}` });
  }
  // spikes usually on solid ground
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r][c] !== '^') continue;
    const below = at(c, r + 1);
    if (r + 1 < rows && !(SOLID_GROUND.has(below) || below in COLOR_SLOT || below === '^')) Wn('spike-floating', `spikes at ${pos(c, r)} float (tile below is '${below}')`, { c, r, fix: 'spikes usually sit on solid ground' });
  }
  return info;
}

// ---------------------------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------------------------
function checkEntities(list, info, E, Wn) {
  const { rows, cols, at } = info;
  const out = [];
  const ids = new Set();
  const sources = new Map(), targets = new Map();
  const solidTile = ch => SOLID_GROUND.has(ch) || ch in COLOR_SLOT;
  list.forEach((e, i) => {
    const tag = `entity #${i}` + (e && e.type ? ` (${e.type}${e.id ? ' "' + e.id + '"' : ''})` : '');
    if (!e || typeof e !== 'object' || Array.isArray(e)) { E('ent-shape', `${tag} must be an object`); return; }
    const spec = ENTITY_FIELDS[e.type];
    if (!spec) { E('ent-type', `${tag}: unknown type ${JSON.stringify(e.type)}`, { fix: `one of ${Object.keys(ENTITY_FIELDS).join(', ')}` }); return; }
    const at0 = isInt(e.x) && isInt(e.y) ? { c: e.x, r: e.y } : {};
    let ok = true;
    for (const f of spec.req) {
      if (e[f] === undefined) {
        if (e.type === 'platform' && f === 'path') { Wn('ent-field', `${tag}: no "path" (platform never moves)`, at0); continue; }
        E('ent-field', `${tag}: missing required field "${f}"`, at0); ok = false;
      }
    }
    const allowed = new Set(['type', 'id'].concat(spec.req, spec.opt));
    for (const k of Object.keys(e)) if (!allowed.has(k)) Wn('ent-unknown-field', `${tag}: unknown field "${k}" (typo? allowed: ${[...allowed].join(', ')})`, at0);
    if (e.id !== undefined) {
      if (typeof e.id !== 'string') Wn('ent-id', `${tag}: "id" should be a string`, at0);
      else if (ids.has(e.id)) Wn('ent-id-dup', `${tag}: duplicate id "${e.id}"`, at0);
      else ids.add(e.id);
    }
    if (!ok) return;
    if (!isInt(e.x) || !isInt(e.y)) { E('ent-coord', `${tag}: x/y must be integer tile coords, got ${JSON.stringify([e.x, e.y])}`); return; }
    const w = e.w === undefined ? 1 : e.w, h = e.h === undefined ? 1 : e.h;
    if (spec.opt.includes('w') && (!isInt(w) || w < 1)) { E('ent-size', `${tag}: w must be a positive integer, got ${JSON.stringify(e.w)}`, at0); return; }
    if (spec.opt.includes('h') && (!isInt(h) || h < 1)) { E('ent-size', `${tag}: h must be a positive integer, got ${JSON.stringify(e.h)}`, at0); return; }
    const ew = spec.opt.includes('w') ? w : 1, eh = spec.opt.includes('h') ? h : 1;
    if (e.x < 0 || e.y < 0 || e.x + ew > cols || e.y + eh > rows) { E('ent-bounds', `${tag}: ${ew}x${eh} at ${pos(e.x, e.y)} is outside the ${cols}x${rows} map`, at0); return; }
    const chanOK = (fieldReq) => {
      const ch = e.channel;
      if (ch === undefined || ch === null) { if (fieldReq) { E('channel', `${tag}: needs a "channel" A-H`, at0); return false; } return true; }
      if (typeof ch !== 'string' || !CHANNELS.has(ch)) { E('channel', `${tag}: channel ${JSON.stringify(ch)} is not one of "A".."H"`, at0); return false; }
      return true;
    };
    const cells = [];
    for (let r = e.y; r < e.y + eh; r++) for (let c = e.x; c < e.x + ew; c++) cells.push([c, r]);
    const n = { type: e.type, id: e.id, x: e.x, y: e.y, w: ew, h: eh, idx: i, tag };

    switch (e.type) {
      case 'crate': {
        n.need = e.need === undefined ? 1 : e.need;
        n.weight = e.weight === undefined ? 1 : e.weight;
        if (!isInt(n.need) || n.need < 1) E('crate-need', `${tag}: need must be a positive integer, got ${JSON.stringify(e.need)}`, at0);
        else if (n.need > 4) Wn('crate-need', `${tag}: need ${n.need} > 4 is clamped to the bot count`, at0);
        if (!isNum(n.weight) || n.weight <= 0) E('crate-weight', `${tag}: weight must be > 0, got ${JSON.stringify(e.weight)}`, at0);
        for (const [c, r] of cells) {
          const ch = at(c, r);
          if (solidTile(ch) || ch === '-') E('crate-solid', `${tag}: overlaps '${ch}' tile at ${pos(c, r)}`, { c, r, fix: 'crates must start in empty space' });
          else if (ch === 'D' || /[1-4]/.test(ch)) E('crate-overlap', `${tag}: overlaps ${ch === 'D' ? 'the hatch' : "spawn '" + ch + "'"} at ${pos(c, r)}`, { c, r });
          else if (ch === 'K' || ch === 'o' || ch === '^' || ch === '*') Wn('crate-overlap', `${tag}: overlaps '${ch}' at ${pos(c, r)}`, { c, r });
        }
        break;
      }
      case 'button': {
        chanOK(true);
        n.channel = e.channel; n.need = e.need === undefined ? 1 : e.need; n.mode = e.mode === undefined ? 'hold' : e.mode;
        n.time = e.time === undefined ? 180 : e.time;
        if (!isInt(n.need) || n.need < 1) E('button-need', `${tag}: need must be a positive integer, got ${JSON.stringify(e.need)}`, at0);
        else if (n.need > 4) Wn('button-need', `${tag}: need ${n.need} > 4 is clamped to the bot count`, at0);
        if (!['hold', 'latch', 'timer'].includes(n.mode)) E('button-mode', `${tag}: mode ${JSON.stringify(e.mode)} must be "hold", "latch" or "timer"`, at0);
        if (n.mode === 'timer' && (!isNum(n.time) || n.time <= 0)) E('button-time', `${tag}: timer "time" must be > 0 ticks`, at0);
        else if (n.mode === 'timer' && n.time < 60) Wn('button-time', `${tag}: timer of ${n.time} ticks (< 1 s) is very short`, at0);
        if (e.time !== undefined && n.mode !== 'timer') Wn('button-time', `${tag}: "time" is ignored unless mode is "timer"`, at0);
        for (const [c, r] of cells) {
          const ch = at(c, r), below = at(c, r + 1);
          if (solidTile(ch) || ch === '-') E('button-solid', `${tag}: plate tile ${pos(c, r)} is inside '${ch}'`, { c, r, fix: 'buttons lie in an empty tile on top of solid ground' });
          if (r + 1 >= rows || !(SOLID_GROUND.has(below) || below in COLOR_SLOT)) E('button-floor', `${tag}: no solid floor under plate tile ${pos(c, r)} (below is '${r + 1 >= rows ? 'out of map' : below}')`, { c, r: r + 1, fix: `put '#' at ${pos(c, r + 1)} or move the button down` });
          else if (below in COLOR_SLOT) Wn('button-floor', `${tag}: plate at ${pos(c, r)} rests on color wall '${below}' (its owner falls through)`, { c, r: r + 1 });
          else if (below === '=') Wn('button-floor', `${tag}: plate at ${pos(c, r)} rests on a crumble block`, { c, r: r + 1 });
        }
        if (n.channel) { if (!sources.has(n.channel)) sources.set(n.channel, []); sources.get(n.channel).push(n); }
        break;
      }
      case 'lever': {
        chanOK(true);
        n.channel = e.channel; n.on = e.on === undefined ? false : e.on;
        if (typeof n.on !== 'boolean') E('lever-on', `${tag}: "on" must be true/false`, at0);
        const ch = at(e.x, e.y), below = at(e.x, e.y + 1);
        if (solidTile(ch) || ch === '-') E('lever-solid', `${tag}: lever tile ${pos(e.x, e.y)} is inside '${ch}'`, at0);
        if (e.y + 1 >= rows || !(SOLID_GROUND.has(below) || below in COLOR_SLOT)) E('lever-floor', `${tag}: lever at ${pos(e.x, e.y)} is not standing on solid floor (below is '${below}')`, { c: e.x, r: e.y + 1, fix: `put '#' at ${pos(e.x, e.y + 1)}` });
        if (n.channel) { if (!sources.has(n.channel)) sources.set(n.channel, []); sources.get(n.channel).push(n); }
        break;
      }
      case 'gate': {
        chanOK(true);
        n.channel = e.channel; n.logic = e.logic === undefined ? 'all' : e.logic; n.invert = e.invert === undefined ? false : e.invert;
        if (!['all', 'any'].includes(n.logic)) E('logic', `${tag}: logic ${JSON.stringify(e.logic)} must be "all" or "any"`, at0);
        if (typeof n.invert !== 'boolean') E('invert', `${tag}: "invert" must be true/false`, at0);
        for (const [c, r] of cells) {
          const ch = at(c, r);
          if (solidTile(ch)) E('gate-solid', `${tag}: gate overlaps solid '${ch}' at ${pos(c, r)}`, { c, r, fix: 'gates must sit in empty tiles (they are the barrier)' });
          else if (ch === 'D' || /[1-4]/.test(ch)) E('gate-overlap', `${tag}: gate covers ${ch === 'D' ? 'the hatch' : "spawn '" + ch + "'"} at ${pos(c, r)}`, { c, r });
          else if (ch !== '.') Wn('gate-overlap', `${tag}: gate covers '${ch}' at ${pos(c, r)}`, { c, r });
        }
        if (n.channel) { if (!targets.has(n.channel)) targets.set(n.channel, []); targets.get(n.channel).push(n); }
        break;
      }
      case 'platform': {
        chanOK(false);
        n.channel = e.channel == null ? null : e.channel; n.need = e.need === undefined ? 0 : e.need;
        n.speed = e.speed === undefined ? 1 : e.speed; n.mode = e.mode === undefined ? 'pingpong' : e.mode;
        if (!isInt(n.need) || n.need < 0) E('platform-need', `${tag}: need must be an integer >= 0`, at0);
        else if (n.need > 4) Wn('platform-need', `${tag}: need ${n.need} > 4 is clamped to the bot count`, at0);
        if (!isNum(n.speed) || n.speed <= 0) E('platform-speed', `${tag}: speed must be > 0`, at0);
        else if (n.speed > 3) Wn('platform-speed', `${tag}: speed ${n.speed} px/tick is very fast (default 1.0)`, at0);
        if (!['pingpong', 'loop'].includes(n.mode)) E('platform-mode', `${tag}: mode ${JSON.stringify(e.mode)} must be "pingpong" or "loop"`, at0);
        if (n.need > 0 && n.channel) Wn('platform-mode', `${tag}: has both need>0 and a channel; SPEC: need wins, channel is ignored`, at0);
        n.logic = e.logic === undefined ? 'all' : e.logic;
        if (!['all', 'any'].includes(n.logic)) E('logic', `${tag}: logic ${JSON.stringify(e.logic)} must be "all" or "any"`, at0);
        else if (e.logic !== undefined && !n.channel) Wn('logic', `${tag}: "logic" is ignored without a channel`, at0);
        n.path = checkPath(e, tag, info, ew, E, Wn, true);
        if (n.path && n.path.length < 2) Wn('platform-static', `${tag}: path has ${n.path.length} waypoint(s), so the platform never moves`, at0);
        if (n.channel) { if (!targets.has(n.channel)) targets.set(n.channel, []); targets.get(n.channel).push(n); }
        break;
      }
      case 'saw': {
        n.speed = e.speed === undefined ? 1 : e.speed; n.mode = e.mode === undefined ? 'pingpong' : e.mode;
        if (!isNum(n.speed) || n.speed <= 0) E('saw-speed', `${tag}: speed must be > 0`, at0);
        else if (n.speed > 2) Wn('saw-speed', `${tag}: speed ${n.speed} > 2 px/tick (SPEC guideline: saws max 2)`, at0, { fix: 'use speed <= 2' });
        if (!['pingpong', 'loop'].includes(n.mode)) E('saw-mode', `${tag}: mode ${JSON.stringify(e.mode)} must be "pingpong" or "loop"`, at0);
        n.path = e.path === undefined ? [[e.x, e.y]] : checkPath(e, tag, info, 1, E, Wn, false);
        break;
      }
      case 'laser': {
        chanOK(false);
        n.dir = e.dir; n.channel = e.channel == null ? null : e.channel; n.invert = e.invert === undefined ? false : e.invert;
        if (!['r', 'l', 'u', 'd'].includes(e.dir)) E('laser-dir', `${tag}: dir ${JSON.stringify(e.dir)} must be "r", "l", "u" or "d"`, at0);
        if (typeof n.invert !== 'boolean') E('invert', `${tag}: "invert" must be true/false`, at0);
        const hasOn = e.on !== undefined, hasOff = e.off !== undefined;
        if (hasOn !== hasOff) Wn('laser-cycle', `${tag}: give both "on" and "off" (only ${hasOn ? 'on' : 'off'} is set)`, at0);
        if (hasOn && (!isNum(e.on) || e.on <= 0)) E('laser-cycle', `${tag}: "on" must be > 0 ticks`, at0);
        if (hasOff && (!isNum(e.off) || e.off <= 0)) E('laser-cycle', `${tag}: "off" must be > 0 ticks`, at0);
        else if (hasOff && e.off < 60) Wn('laser-off', `${tag}: OFF window is ${e.off} ticks (< 60 = 1 s); very hard to pass, especially for 4 bots`, Object.assign({ fix: 'use "off" >= 60' }, at0));
        if (e.phase !== undefined && !isNum(e.phase)) E('laser-phase', `${tag}: "phase" must be a number`, at0);
        if (n.channel && (hasOn || hasOff)) Wn('laser-cycle', `${tag}: has a channel AND on/off; SPEC: channel wins, on/off ignored`, at0);
        n.logic = e.logic === undefined ? 'all' : e.logic;
        if (!['all', 'any'].includes(n.logic)) E('logic', `${tag}: logic ${JSON.stringify(e.logic)} must be "all" or "any"`, at0);
        n.cycle = !n.channel && hasOn && hasOff ? { on: e.on, off: e.off, phase: e.phase || 0 } : null;
        n.always = !n.channel && !n.cycle;
        if (n.channel) { if (!targets.has(n.channel)) targets.set(n.channel, []); targets.get(n.channel).push(n); }
        break;
      }
    }
    out.push(n);
  });
  // channel cross-check
  for (const [ch, ts] of targets) if (!sources.has(ch)) {
    for (const t of ts) E('channel-nosource', `${t.tag}: listens to channel ${ch} but no button/lever drives channel ${ch}`, { c: t.x, r: t.y, fix: `add a button/lever on channel "${ch}" or fix the channel letter` });
  }
  for (const [ch, ss] of sources) if (!targets.has(ch)) {
    for (const s of ss) Wn('channel-notarget', `${s.tag}: drives channel ${ch} but no gate/platform/laser listens to it`, { c: s.x, r: s.y, fix: 'fix the channel letter or remove the source' });
  }
  // timer buttons: can a bot even run from the plate to the gate before it closes?
  for (const btn of out.filter(n => n.type === 'button' && n.mode === 'timer' && isNum(n.time))) {
    for (const g of (targets.get(btn.channel) || []).filter(t => t.type === 'gate')) {
      const dx = Math.max(0, g.x - (btn.x + btn.w), btn.x - (g.x + g.w));
      const ticks = Math.ceil(dx * T / RUN);
      if (ticks > btn.time) Wn('timer-short', `${btn.tag}: timer ${btn.time} ticks, but running flat-out to ${g.tag} at ${pos(g.x, g.y)} takes >= ${ticks} ticks`, { c: btn.x, r: btn.y, fix: `raise "time" to at least ${Math.ceil(ticks * 1.5)}` });
    }
  }
  // overlapping sources / sources inside gates
  const gates = out.filter(n => n.type === 'gate');
  for (const s of out.filter(n => n.type === 'button' || n.type === 'lever')) {
    for (const g of gates) {
      if (s.x < g.x + g.w && s.x + s.w > g.x && s.y >= g.y && s.y < g.y + g.h) Wn('source-in-gate', `${s.tag} at ${pos(s.x, s.y)} is inside ${g.tag}`, { c: s.x, r: s.y });
    }
  }
  info.sources = sources; info.targets = targets;
  return out;
}

function checkPath(e, tag, info, w, E, Wn, isPlatform) {
  const { rows, cols, at } = info;
  const at0 = { c: e.x, r: e.y };
  if (!Array.isArray(e.path) || !e.path.length) { E('path', `${tag}: "path" must be a non-empty array of [x,y] waypoints`, at0); return null; }
  const pts = [];
  for (const p of e.path) {
    if (!Array.isArray(p) || p.length !== 2 || !isNum(p[0]) || !isNum(p[1])) { E('path', `${tag}: bad waypoint ${JSON.stringify(p)} (use [x,y])`, at0); return null; }
    if (!isInt(p[0]) || !isInt(p[1])) Wn('path', `${tag}: waypoint ${JSON.stringify(p)} is not on whole tiles`, at0);
    if (p[0] < 0 || p[1] < 0 || p[0] + w > cols || p[1] >= rows) { E('path-bounds', `${tag}: waypoint ${pos(p[0], p[1])} is outside the map`, { c: p[0], r: p[1] }); return null; }
    pts.push([p[0], p[1]]);
  }
  if (pts[0][0] !== e.x || pts[0][1] !== e.y) (isPlatform ? E : Wn)('path-start', `${tag}: first waypoint ${pos(pts[0][0], pts[0][1])} must equal (x,y) ${pos(e.x, e.y)}`, Object.assign({ fix: `make path[0] = [${e.x},${e.y}]` }, at0));
  if (!isPlatform) return pts;
  const flushColor = () => {
    const l = info._pathColor && info._pathColor.get(tag); if (!l) return;
    const desc = l.map(([c, r, ch]) => `'${ch}'${pos(c, r)}`).join(' ');
    Wn('path-color', `${tag}: path passes through color wall(s) ${desc}; only the matching bot can ride through each one, otherwise the platform stops (no-crush). OK if intended.`, { c: l[0][0], r: l[0][1] });
    info._pathColor.delete(tag);
  };
  // sweep segments (and the closing segment for loops)
  const segs = [];
  for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
  if (e.mode === 'loop' && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
  const reported = new Set();
  for (const [a, b] of segs) {
    if (a[0] !== b[0] && a[1] !== b[1]) Wn('path-diagonal', `${tag}: segment ${pos(a[0], a[1])}->${pos(b[0], b[1])} is diagonal; prefer axis-aligned paths`, { c: a[0], r: a[1] });
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 4 || 1;
    for (let s = 0; s <= steps; s++) {
      const px = a[0] + (b[0] - a[0]) * s / steps, py = a[1] + (b[1] - a[1]) * s / steps;
      // platform occupies the top 12 px of its tile row: rows floor(py) (and py+12/32 if fractional)
      const r0 = Math.floor(py), r1 = Math.floor(py + 11.9 / 32);
      const c0 = Math.floor(px), c1 = Math.ceil(px + w) - 1;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const ch = at(c, r); const k = c + ',' + r;
        if (reported.has(k)) continue;
        if (ch in COLOR_SLOT) { reported.add(k); (info._pathColor || (info._pathColor = new Map())).set(tag, ((info._pathColor.get(tag)) || []).concat([[c, r, ch]])); }
        else if (SOLID_GROUND.has(ch)) { reported.add(k); E('path-solid', `${tag}: path passes through solid '${ch}' at ${pos(c, r)}`, { c, r, fix: 'keep the whole platform (w tiles) in empty space along its path' }); }
        else if (ch === '-' || ch === '^' || ch === '*' || ch === 'D') { reported.add(k); Wn('path-overlap', `${tag}: path passes through '${ch}' at ${pos(c, r)}`, { c, r }); }
      }
    }
  }
  flushColor();
  return pts;
}

// ---------------------------------------------------------------------------------------------
// Hazards vs spawns / hatch / cell (static, at level start)
// ---------------------------------------------------------------------------------------------
function initialChannels(info) {
  const n = 4; // worst case: idle with all 4 bots; buttons pressed by bots on spawn or crates at start
  const src = new Map();
  for (const e of info.ents) {
    if (e.type === 'lever') { if (!src.has(e.channel)) src.set(e.channel, []); src.get(e.channel).push(!!e.on); }
    if (e.type === 'button') {
      let load = 0;
      for (const s of info.spawns) if (s && s.r === e.y && s.c >= e.x && s.c < e.x + e.w) load += 1;
      for (const c of info.ents) if (c.type === 'crate' && c.y + c.h - 1 === e.y && c.x < e.x + e.w && c.x + c.w > e.x) load += c.weight || 1;
      if (!src.has(e.channel)) src.set(e.channel, []);
      src.get(e.channel).push(load >= Math.min(e.need || 1, n));
    }
  }
  return src;
}
function reading(src, ch, logic) {
  const l = src.get(ch) || [];
  return logic === 'any' ? l.some(Boolean) : l.length > 0 && l.every(Boolean);
}
function laserBeam(info, L, gatesClosed, crates) {
  const d = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] }[L.dir];
  if (!d) return [];
  const cells = [];
  let c = L.x + d[0], r = L.y + d[1];
  const blocked = (c, r) => {
    const ch = info.at(c, r);
    if (SOLID_GROUND.has(ch) || ch in COLOR_SLOT) return true;
    for (const g of gatesClosed) if (c >= g.x && c < g.x + g.w && r >= g.y && r < g.y + g.h) return true;
    for (const k of crates) if (c >= k.x && c < k.x + k.w && r >= k.y && r < k.y + k.h) return true;
    return false;
  };
  while (c >= 0 && c < info.cols && r >= 0 && r < info.rows && !blocked(c, r)) { cells.push([c, r]); c += d[0]; r += d[1]; }
  return cells;
}
function sawDist(sx, sy, c, r) { // distance from saw center (px) to the AABB of a bot standing in tile (c,r)
  const x0 = c * T + 4, x1 = c * T + 28, y0 = r * T + 2, y1 = r * T + 32;
  const dx = Math.max(x0 - sx, 0, sx - x1), dy = Math.max(y0 - sy, 0, sy - y1);
  return Math.hypot(dx, dy);
}
function sawSamples(e) {
  const pts = e.path && e.path.length ? e.path : [[e.x, e.y]];
  const out = [];
  const segs = pts.length === 1 ? [[pts[0], pts[0]]] : pts.slice(1).map((p, i) => [pts[i], p]);
  if (e.mode === 'loop' && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
  for (const [a, b] of segs) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 8));
    for (let i = 0; i <= n; i++) out.push([(a[0] + (b[0] - a[0]) * i / n) * T + 16, (a[1] + (b[1] - a[1]) * i / n) * T + 16]);
  }
  return out;
}
function checkHazards(info, E, Wn) {
  const src = initialChannels(info);
  info.initialSrc = src;
  const gatesClosed = info.ents.filter(g => g.type === 'gate' && !(reading(src, g.channel, g.logic) !== !!g.invert));
  const crates = info.ents.filter(e => e.type === 'crate');
  info.beams = [];
  const spots = [];
  info.spawns.forEach((s, i) => { if (s) spots.push({ c: s.c, r: s.r, what: `spawn '${i + 1}'`, spawn: true }); });
  if (info.door) spots.push({ c: info.door.c, r: info.door.r, what: 'the hatch', door: true });
  if (info.key) spots.push({ c: info.key.c, r: info.key.r, what: 'the Power Cell' });
  for (const L of info.ents.filter(e => e.type === 'laser')) {
    const cells = laserBeam(info, L, gatesClosed, crates);
    info.beams.push({ L, cells });
    if (!cells.length && ['r', 'l', 'u', 'd'].includes(L.dir)) Wn('laser-blocked', `${L.tag}: beam is blocked right at the emitter (length 0)`, { c: L.x, r: L.y });
    let initiallyOn;
    if (L.channel) initiallyOn = reading(src, L.channel, L.logic) === !!L.invert;
    else initiallyOn = true;
    for (const sp of spots) {
      if (!cells.some(([c, r]) => c === sp.c && r === sp.r)) continue;
      const msg = `${L.tag}: beam crosses ${sp.what} at ${pos(sp.c, sp.r)}`;
      if (sp.spawn && (L.always || L.cycle || initiallyOn)) E('laser-spawn', `${msg}; idle bots die${L.cycle ? ' when it cycles on' : ''}`, { c: sp.c, r: sp.r, fix: 'move the spawn or the laser / block the beam with a wall' });
      else if (sp.door && L.always) E('laser-door', `${msg} and is always on: nobody can enter`, { c: sp.c, r: sp.r });
      else Wn('laser-spot', msg + (L.channel ? ` (channel ${L.channel})` : L.cycle ? ' (cycling)' : ' (always on)'), { c: sp.c, r: sp.r });
    }
  }
  for (const S of info.ents.filter(e => e.type === 'saw')) {
    const samples = sawSamples(S);
    for (const sp of spots) {
      let best = Infinity;
      for (const [sx, sy] of samples) best = Math.min(best, sawDist(sx, sy, sp.c, sp.r));
      if (best < SAW_R - SAW_FORGIVE) (sp.spawn ? E : Wn)('saw-spot', `${S.tag}: saw ${S.path && S.path.length > 1 ? 'path ' : ''}hits ${sp.what} at ${pos(sp.c, sp.r)}${sp.spawn ? ' (bot dies idle)' : ''}`, { c: sp.c, r: sp.r, fix: 'keep saws at least 1 tile away from spawns/hatch' });
      else if (best < SAW_R + 20 && (sp.spawn || sp.door)) Wn('saw-near', `${S.tag}: saw passes within ${Math.round(best - SAW_R)} px of ${sp.what} at ${pos(sp.c, sp.r)}`, { c: sp.c, r: sp.r });
    }
  }
  // hatch / cell in spikes
  if (info.door) {
    const { c, r } = info.door;
    if (info.at(c - 1, r) === '^' || info.at(c + 1, r) === '^') Wn('door-spike', `hatch ${pos(c, r)} has spikes right next to it`, { c, r });
  }
  // K / gears covered by gates or crates
  for (const [c, r, what] of [].concat(info.key ? [[info.key.c, info.key.r, 'Power Cell']] : [], info.gears.map(g => [g[0], g[1], 'gear']))) {
    for (const g of info.ents.filter(e => e.type === 'gate' || e.type === 'crate')) {
      if (c >= g.x && c < g.x + g.w && r >= g.y && r < g.y + g.h) Wn('item-covered', `${what} at ${pos(c, r)} is inside ${g.tag}`, { c, r });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Mechanic scope per world (§8)
// ---------------------------------------------------------------------------------------------
function checkScope(lv, info, wn, E, Wn) {
  const used = new Set();
  if (info.chars.has('^')) used.add('spikes');
  if (info.chars.has('o')) used.add('gears');
  if (info.chars.has('-')) used.add('oneway');
  if (info.colorsUsed.size) used.add('color');
  if (info.chars.has('*')) used.add('spring');
  if (info.chars.has('=')) used.add('crumble');
  if (info.chars.has('<') || info.chars.has('>')) used.add('conveyor');
  for (const e of info.ents) {
    if (e.type === 'laser') { used.add('laser'); if (e.cycle) used.add('laserCycle'); }
    else used.add(e.type);
  }
  if (lv.tether === true) used.add('tether');
  for (const m of used) {
    const [intro, label] = MECH[m];
    if (intro > wn) Wn('scope', `uses ${label}, which world ${intro} introduces (this is world ${wn})`, { fix: `remove it or check with the lead (SPEC §8)` });
  }
  if (wn === 1 && Array.isArray(lv.entities) && lv.entities.length) E('scope-w1', `world 1 levels must have no entities (has ${lv.entities.length})`, { fix: 'world 1 is map-only: stacking, gaps, spikes, gears' });
  if (wn === 7 && lv.tether !== true) E('scope-w7', 'world 7 (Tied Together): every level must have "tether": true');
  if (wn === 8 && lv.tether === true) E('scope-w8', 'world 8 (Foundry) levels must have "tether": false');
}

// =============================================================================================
// Reachability heuristic
// =============================================================================================
const STAND = 1, SPRING = 2;

function fallTime(d) {
  if (d <= 0) return 0;
  const dmax = MAX_FALL * MAX_FALL / (2 * G);
  return d <= dmax ? Math.sqrt(2 * d / G) : MAX_FALL / G + (d - dmax) / MAX_FALL;
}
// Time (ticks) from takeoff until the feet descend through height `land` (px above takeoff floor), having reached
// `need`; h0 = initial feet height, v0 = launch speed, cap = max feet height allowed by ceilings. null = impossible.
function flightTime(h0, v0, cap, need, land) {
  if (cap < h0 - 0.01) return null;
  const apexFree = h0 + v0 * v0 / (2 * G);
  const apex = Math.min(apexFree, cap);
  if (apex + 0.01 < need || apex + 0.01 < land) return null;
  let tUp;
  if (apexFree <= cap) tUp = v0 / G;
  else { const disc = v0 * v0 - 2 * G * (cap - h0); tUp = (v0 - Math.sqrt(Math.max(0, disc))) / G; }
  return tUp + fallTime(apex - land);
}

function analyzeReach(info, present) {
  const { rows, cols, at } = info;
  const n = present.length;
  const pres = new Set(present);
  const N = rows * cols;
  const idx = (c, r) => r * cols + c;
  const ents = info.ents || [];
  const hasCrates = ents.some(e => e.type === 'crate');

  // ---- deadly cells (static hazards only; moving/cycling hazards are timing puzzles -> passable) ----
  const deadly = new Uint8Array(N);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === '^') deadly[idx(c, r)] = 1;
  for (const S of ents.filter(e => e.type === 'saw' && (!e.path || e.path.length < 2))) {
    for (let r = Math.max(0, S.y - 1); r <= Math.min(rows - 1, S.y + 1); r++) for (let c = Math.max(0, S.x - 1); c <= Math.min(cols - 1, S.x + 1); c++) {
      if (sawDist(S.x * T + 16, S.y * T + 16, c, r) < SAW_R - SAW_FORGIVE) deadly[idx(c, r)] = 1;
    }
  }
  if (!hasCrates) for (const b of info.beams || []) if (b.L.always) for (const [c, r] of b.cells) deadly[idx(c, r)] = 1;

  // ---- crate reachable positions (optimistic: pushers always available, gates open) ----
  const crateTop = new Uint8Array(N);
  const crateFree = (c, r) => { const ch = at(c, r); return !(SOLID_GROUND.has(ch) || ch in COLOR_SLOT || ch === '-'); };
  for (const K of ents.filter(e => e.type === 'crate')) {
    const fits = (x, y) => { for (let r = y; r < y + K.h; r++) for (let c = x; c < x + K.w; c++) { if (c < 0 || c >= cols) return false; if (r >= 0 && r < rows && !crateFree(c, r)) return false; } return true; };
    const supported = (x, y) => { const r = y + K.h; if (r >= rows) return false; for (let c = x; c < x + K.w; c++) { const ch = at(c, r); if (SOLID_GROUND.has(ch) || ch in COLOR_SLOT || ch === '-') return true; } return false; };
    const settle = (x, y) => { let yy = y; while (yy + K.h <= rows && !supported(x, yy)) { if (!fits(x, yy + 1)) return yy; yy++; if (yy + K.h > rows) return null; } return yy + K.h <= rows ? yy : null; };
    const seen = new Set();
    const y0 = settle(K.x, K.y);
    if (y0 == null) continue;
    const q = [[K.x, y0]]; seen.add(K.x + ',' + y0);
    while (q.length && seen.size < 3000) {
      const [x, y] = q.shift();
      for (let c = x; c < x + K.w; c++) if (y - 1 >= 0) crateTop[idx(c, y - 1)] = 1;
      for (const dx of [-1, 1]) {
        if (!fits(x + dx, y)) continue;
        const ny = settle(x + dx, y);
        if (ny == null) continue;
        const key = (x + dx) + ',' + ny;
        if (!seen.has(key)) { seen.add(key); q.push([x + dx, ny]); }
      }
    }
  }
  // ---- platform stand cells (optimistic: every position along the path) ----
  const platOf = new Int16Array(N).fill(-1);
  const platCells = [];
  ents.filter(e => e.type === 'platform').forEach((P, pi) => {
    const pts = P.path && P.path.length ? P.path : [[P.x, P.y]];
    const cells = new Set();
    const addPos = (px, py) => { const r = Math.round(py) - 1; if (r < 0 || r >= rows) return; for (let c = Math.round(px); c < Math.round(px) + P.w; c++) if (c >= 0 && c < cols) cells.add(idx(c, r)); };
    addPos(pts[0][0], pts[0][1]);
    const segs = pts.slice(1).map((p, i) => [pts[i], p]);
    if (P.mode === 'loop' && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
    for (const [a, b] of segs) {
      const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      for (let s = 0; s <= steps; s++) addPos(a[0] + (b[0] - a[0]) * s / (steps || 1), a[1] + (b[1] - a[1]) * s / (steps || 1));
    }
    platCells.push([...cells]);
    for (const k of cells) platOf[k] = pi;
  });

  // ---- graph per color signature ----
  const graphCache = new Map();
  const sigOf = s => (info.colorsUsed.has('abcd'[s]) && pres.has(s)) ? s : -1;
  function graph(s) {
    const sig = sigOf(s);
    if (graphCache.has(sig)) return graphCache.get(sig);
    const solid = ch => SOLID_GROUND.has(ch) || (ch in COLOR_SLOT && COLOR_SLOT[ch] !== sig);
    const pass = new Uint8Array(N);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = idx(c, r); pass[k] = !solid(at(c, r)) && !deadly[k] ? 1 : 0; }
    const SKY = 8;
    const head = new Uint8Array(N);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const k = idx(c, r); head[k] = pass[k] ? Math.min(20, (r === 0 ? SKY : head[idx(c, r - 1)]) + 1) : 0; }
    const P = (c, r) => (c < 0 || c >= cols) ? false : (r < 0 || r >= rows) ? true : pass[idx(c, r)] === 1;
    const Hd = (c, r) => (c < 0 || c >= cols) ? 0 : r < 0 ? SKY : r >= rows ? SKY : head[idx(c, r)];
    const colClear = (c, rTop, rBot) => { for (let r = rTop; r <= rBot; r++) if (!P(c, r)) return false; return true; };
    const rowClear = (r, ca, cb) => { const lo = Math.min(ca, cb), hi = Math.max(ca, cb); for (let c = lo; c <= hi; c++) if (!P(c, r)) return false; return true; };
    const minHead = (r, ca, cb) => { const lo = Math.min(ca, cb), hi = Math.max(ca, cb); let m = 99; for (let c = lo; c <= hi; c++) m = Math.min(m, Hd(c, r)); return m; };
    const type = new Uint8Array(N);
    const byCol = Array.from({ length: cols }, () => []);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = idx(c, r);
      if (!pass[k]) continue;
      const ch = at(c, r);
      if (ch === '*') { type[k] = SPRING; byCol[c].push(k); continue; }
      const below = r + 1 < rows ? at(c, r + 1) : null;
      // carry: a bot can ride on a friend across its OWN color floor (solid for the friend, not for itself)
      const carry = below !== null && below in COLOR_SLOT && COLOR_SLOT[below] === sig && n >= 2;
      const sup = (below !== null && (solid(below) || below === '-')) || platOf[k] >= 0 || crateTop[k] || carry;
      if (sup) { type[k] = STAND; byCol[c].push(k); }
    }
    // can a body at (c1,r1) with initial feet height h0 / launch v0 get to stand at (c2,r2)?
    function canFly(c1, r1, c2, r2, h0, v0, coyote) {
      const dx = Math.abs(c2 - c1), dir = Math.sign(c2 - c1);
      const land = T * (r1 - r2);
      const needH = dx === 0 ? -Infinity : T * (dx - 1) + 4;
      const fits = (cap, need) => {
        const vars = coyote ? [[h0, 0], [h0 - 6, 10]] : [[h0, 0]];
        for (const [hh, bonus] of vars) {
          const t = flightTime(hh, v0, cap, need, land);
          if (t !== null && RUN * t + 23 + bonus >= needH) return true;
        }
        return false;
      };
      const top = Math.min(r1, r2);
      for (let j = 0; j <= 3; j++) {
        const rf = top - j;
        if (!colClear(c1, rf, r1)) break;
        if (!rowClear(rf, c1, c2)) continue;
        if (!colClear(c2, rf, r2)) continue;
        const cap = T * (r1 - rf) + T * minHead(rf, c1, c2) - PH;
        if (fits(cap, T * (r1 - rf))) return true;
      }
      if (r2 > r1 && dx >= 1) { // step off, fall, glide in under an overhang
        const cn = c1 + dir;
        if (rowClear(r1, c1, cn) && colClear(cn, r1, r2) && rowClear(r2, cn, c2)) {
          const cap = T * minHead(r1, c1, cn) - PH;
          if (fits(cap, 0)) return true;
        }
      }
      return false;
    }
    const edges = new Array(N);
    const maxUp = k => Math.floor((30 * k + JUMP_APEX) / T);
    for (let c1 = 0; c1 < cols; c1++) for (const u of byCol[c1]) {
      const r1 = (u - c1) / cols;
      const list = [];
      const isSpring = type[u] === SPRING;
      for (let c2 = Math.max(0, c1 - 8); c2 <= Math.min(cols - 1, c1 + 8); c2++) {
        const dxa = Math.abs(c2 - c1);
        for (const v of byCol[c2]) {
          if (v === u) continue;
          const r2 = (v - c2) / cols;
          const dh = r1 - r2;
          if (dh >= 0 && dxa > (isSpring ? 6 : 4)) continue;
          if (isSpring) {
            if (dh <= 5 && canFly(c1, r1, c2, r2, SPRING_TOP, SPRING_V, false)) list.push(v, 0);
            continue;
          }
          if (dh <= 2 && canFly(c1, r1, c2, r2, 0, JUMP_V, true)) { list.push(v, 0); continue; }
          if (dh < 1) continue;
          for (let k = 1; k <= n - 1; k++) {
            if (dh > maxUp(k)) continue;
            // tower of k bots + jumper must fit in column c1
            if (Hd(c1, r1) * T < PH * (k + 1)) break;
            if (canFly(c1, r1, c2, r2, PH * k, JUMP_V, false)) { list.push(v, k); break; }
          }
        }
      }
      // crumble drop-through (optimistic: it vanishes under you)
      if (r1 + 1 < rows && at(c1, r1 + 1) === '=') {
        for (let r = r1 + 1; r < rows; r++) {
          const ch = at(c1, r);
          if (ch === '=') continue;
          if (!P(c1, r)) break;
          const k = idx(c1, r);
          if (type[k]) { list.push(k, 0); if (!(r + 1 < rows && at(c1, r + 1) === '=')) break; }
        }
      }
      // ride a platform along its path
      if (platOf[u] >= 0) for (const k of platCells[platOf[u]]) if (k !== u && type[k]) list.push(k, 0);
      edges[u] = Int32Array.from(list);
    }
    const g = { sig, pass, type, byCol, edges, P, colClear, rowClear, Hd };
    graphCache.set(sig, g);
    return g;
  }

  // ---- 0-1 BFS (cost = number of boosted climbs). helpersAt(u) = bots other than s that can be at u ----
  function search(g, sources, helpersAt) {
    const dist = new Int16Array(N).fill(-1), par = new Int32Array(N).fill(-1), pk = new Int8Array(N);
    const dq = new Int32Array(N * 4); let head = N * 2, tail = N * 2;
    const done = new Uint8Array(N);
    for (const s of sources) if (g.type[s]) { dist[s] = 0; dq[tail++] = s; }
    while (head < tail) {
      const u = dq[head++];
      if (done[u]) continue; done[u] = 1;
      const e = g.edges[u]; if (!e) continue;
      let hcount = -1;
      for (let i = 0; i < e.length; i += 2) {
        const v = e[i], k = e[i + 1];
        if (k > 0) { if (hcount < 0) hcount = helpersAt(u); if (hcount < k) continue; }
        const nd = dist[u] + (k > 0 ? 1 : 0);
        if (dist[v] === -1 || nd < dist[v]) {
          dist[v] = nd; par[v] = u; pk[v] = k;
          if (k > 0) dq[tail++] = v; else dq[--head] = v;
        }
      }
    }
    return { dist, par, pk };
  }
  function reverseReach(g, target, kLimit) {
    const radj = Array.from({ length: N }, () => null);
    for (let u = 0; u < N; u++) { const e = g.edges[u]; if (!e) continue; for (let i = 0; i < e.length; i += 2) if (e[i + 1] <= kLimit) { const v = e[i]; (radj[v] || (radj[v] = [])).push(u); } }
    const seen = new Uint8Array(N); const q = [target]; seen[target] = 1;
    while (q.length) { const v = q.pop(); const l = radj[v]; if (l) for (const u of l) if (!seen[u]) { seen[u] = 1; q.push(u); } }
    return seen;
  }
  // can a bot standing at node u (with k helpers / spring) touch tile (tc,tr)?
  function touches(g, u, tc, tr, k) {
    const c = u % cols, r = (u - c) / cols;
    if (Math.abs(c - tc) > 2 || r < tr) return false;
    // engine pickup box: item center +-10 px vs bot AABB -> bot top must rise above (item center + 10)
    const rise = g.type[u] === SPRING ? SPRING_TOP + SPRING_APEX : PH * k + JUMP_APEX;
    if (T * (r - tr) - 24 >= rise) return false;
    return g.colClear(c, tr, r) && g.rowClear(tr, c, tc);
  }

  const res = { present, slots: {} };
  const D = idx(info.door.c, info.door.r);
  const G_ = {}; for (const s of present) G_[s] = graph(s);
  const spawnIdx = s => idx(info.spawns[s].c, info.spawns[s].r);
  for (const s of present) if (!G_[s].type[spawnIdx(s)]) res.badSpawn = (res.badSpawn || []).concat(s);
  // fixpoint over helper availability
  let R = {};
  for (const s of present) R[s] = search(G_[s], [spawnIdx(s)], () => 0);
  const count = r => { let m = 0; for (let i = 0; i < N; i++) if (r.dist[i] >= 0) m++; return m; };
  for (let it = 0; it < 8; it++) {
    const helpers = s => u => { let h = 0; for (const t of present) if (t !== s && R[t].dist[u] >= 0) h++; return h; };
    const R2 = {}; let changed = false;
    for (const s of present) { R2[s] = search(G_[s], [spawnIdx(s)], helpers(s)); if (count(R2[s]) !== count(R[s])) changed = true; }
    R = R2;
    if (!changed) break;
  }
  const helpersFinal = s => u => { let h = 0; for (const t of present) if (t !== s && R[t].dist[u] >= 0) h++; return h; };
  const coSolo = {}, coTeam = {};
  for (const s of present) { coSolo[s] = reverseReach(G_[s], D, 0); coTeam[s] = reverseReach(G_[s], D, n - 1); }
  // "safe" = from node u, bot s can still reach the hatch using only climbs whose helpers are themselves safe at the
  // tower base (least fixpoint, starting from solo routes; chained rescues like 4-tower then 3-tower are accepted).
  const radjK = {};
  for (const s of present) {
    const g = G_[s], ra = new Array(N);
    for (let u = 0; u < N; u++) { const e = g.edges[u]; if (!e) continue; for (let i = 0; i < e.length; i += 2) { const v = e[i]; (ra[v] || (ra[v] = [])).push(u, e[i + 1]); } }
    radjK[s] = ra;
  }
  let safeSet = coSolo;
  for (let it = 0; it < 4; it++) {
    const next = {}; let grew = false;
    for (const s of present) {
      const seen = new Uint8Array(N); seen[D] = 1; const q = [D];
      while (q.length) {
        const v = q.pop(); const l = radjK[s][v]; if (!l) continue;
        for (let i = 0; i < l.length; i += 2) {
          const u = l[i], k = l[i + 1]; if (seen[u]) continue;
          if (k > 0) { let h = 0; for (const t of present) if (t !== s && R[t].dist[u] >= 0 && safeSet[t][u]) h++; if (h < k) continue; }
          seen[u] = 1; q.push(u);
        }
      }
      for (let i = 0; i < N && !grew; i++) if (seen[i] && !safeSet[s][i]) grew = true;
      next[s] = seen;
    }
    safeSet = next;
    if (!grew) break;
  }
  for (const s of present) {
    const g = G_[s], r = R[s];
    const helpersAt = helpersFinal(s);
    const safeHelpers = u => { let h = 0; for (const t of present) if (t !== s && R[t].dist[u] >= 0 && safeSet[t][u]) h++; return h; };
    const safe = search(g, [spawnIdx(s)], safeHelpers);
    const o = { reachD: r.dist[D] >= 0, soloD: r.dist[D] === 0, safeD: safe.dist[D] >= 0, nodes: 0, soloNodes: 0, boosts: [], keyTouch: [], gears: [] };
    for (let i = 0; i < N; i++) if (r.dist[i] >= 0) { o.nodes++; if (r.dist[i] === 0) o.soloNodes++; }
    // boosted climbs on the cheapest route to the hatch
    if (o.reachD && !o.soloD) {
      let v = D; const seen = new Set();
      while (r.par[v] >= 0 && !seen.has(v)) { seen.add(v); if (r.pk[v] > 0) o.boosts.unshift({ from: r.par[v], to: v, k: r.pk[v] }); v = r.par[v]; }
    }
    // nearest reachable node to the hatch (for messages)
    if (!o.reachD) {
      let best = null, bd = 1e9;
      for (let i = 0; i < N; i++) if (r.dist[i] >= 0) { const c = i % cols, rr = (i - c) / cols; const d = Math.abs(c - info.door.c) + Math.abs(rr - info.door.r); if (d < bd) { bd = d; best = i; } }
      o.nearestD = best;
    }
    // power cell
    if (info.key) {
      for (let i = 0; i < N; i++) if (r.dist[i] >= 0 && touches(g, i, info.key.c, info.key.r, Math.min(n - 1, helpersAt(i)))) o.keyTouch.push(i);
      if (o.keyTouch.length) {
        const h = search(g, o.keyTouch, helpersAt);
        o.keyToD = h.dist[D] >= 0;
      }
    }
    for (const [gc, gr] of info.gears) {
      let ok = false;
      for (let i = 0; i < N && !ok; i++) if (r.dist[i] >= 0 && touches(g, i, gc, gr, Math.min(n - 1, helpersAt(i)))) ok = true;
      o.gears.push(ok);
    }
    // pockets: solo-reachable cells from which the hatch is not solo-reachable
    if (o.soloD) {
      o.pocketBoost = []; o.pocketDead = [];
      for (let i = 0; i < N; i++) if (r.dist[i] === 0 && !coSolo[s][i]) (coTeam[s][i] ? o.pocketBoost : o.pocketDead).push(i);
    }
    o.topRow = false;
    for (let c = 0; c < cols; c++) if (r.dist[idx(c, 0)] >= 0 && g.type[idx(c, 0)] === STAND) o.topRow = true;
    o.dist = r.dist;
    res.slots[s] = o;
  }
  return res;
}

function clusters(cells, cols) {
  const set = new Set(cells), out = [], seen = new Set();
  for (const s of cells) {
    if (seen.has(s)) continue;
    const comp = [], q = [s]; seen.add(s);
    while (q.length) {
      const u = q.pop(); comp.push(u);
      const c = u % cols, r = (u - c) / cols;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const v = (r + dr) * cols + (c + dc);
        if (c + dc < 0 || c + dc >= cols || !set.has(v) || seen.has(v)) continue;
        seen.add(v); q.push(v);
      }
    }
    let c0 = 1e9, c1 = -1, r0 = 1e9, r1 = -1;
    for (const u of comp) { const c = u % cols, r = (u - c) / cols; c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
    out.push({ cells: comp, c0, c1, r0, r1 });
  }
  return out;
}

function reportReach(info, Hn, Wn, opts) {
  const cols = info.cols;
  const cr = i => { const c = i % cols; return [c, (i - c) / cols]; };
  const P = i => { const [c, r] = cr(i); return pos(c, r); };
  const sets = [[0, 1, 2, 3]];
  if (info.minPlayers < 4) sets.push([...Array(info.minPlayers).keys()]);
  const summary = { sets: [] };
  const already = new Set();
  const limits = [];
  if (info.tether) limits.push('rope hauls');
  if ((info.ents || []).some(e => e.type === 'crate')) limits.push('crates stacked on crates / riding lifts');
  if (info.springs.length) limits.push('2-stack spring pogo');
  const lim = limits.length ? ` [not modelled here: ${limits.join(', ')}]` : '';
  const say = (sev, code, msg, o) => { const k = code + '|' + msg; if (already.has(k)) return; already.add(k); (sev === 'WARN' ? Wn : Hn)(code, sev === 'HEUR' && code !== 'reach-crash' ? msg + lim : msg, o); };
  for (const present of sets) {
    const A = analyzeReach(info, present);
    const lab = present.length === 4 ? '4 bots' : `${present.length} bots (minPlayers; slots ${present.join(',')})`;
    const sum = { present, slots: {} };
    summary.sets.push(sum);
    if (A.badSpawn) { say('HEUR', 'reach-spawn', `[${lab}] spawn of ${A.badSpawn.map(s => SLOT_NAME[s]).join(', ')} is not a standable cell (blocked/hazard); skipping`); continue; }
    const bad = [];
    for (const s of present) {
      const o = A.slots[s];
      sum.slots[s] = { reachD: o.reachD, soloD: o.soloD, safeD: o.safeD, nodes: o.nodes, key: o.keyTouch ? o.keyTouch.length > 0 : null };
      if (!o.reachD) bad.push(s);
    }
    if (bad.length) {
      const near = A.slots[bad[0]].nearestD;
      const nearTxt = near != null ? `; closest reachable spot to the hatch is ${P(near)}` : '';
      const who = bad.length === present.length ? 'NO bot can' : bad.map(s => SLOT_NAME[s]).join(', ') + ' cannot';
      say('HEUR', 'reach-hatch', `[${lab}] ${who} reach the hatch at ${pos(info.door.c, info.door.r)} even optimistically (gates open, crates anywhere, towers up to ${present.length})${nearTxt}`, { c: info.door.c, r: info.door.r, fix: 'check the route: gaps <= 3, climbs <= 2 (+1 per stacked bot), springs <= 5' });
    }
    // power cell
    if (info.key) {
      const holders = present.filter(s => A.slots[s].keyTouch.length);
      if (!holders.length) say('HEUR', 'reach-key', `[${lab}] no bot can reach the Power Cell at ${pos(info.key.c, info.key.r)} even optimistically`, { c: info.key.c, r: info.key.r });
      else if (!holders.some(s => A.slots[s].keyToD)) say('HEUR', 'reach-key-door', `[${lab}] bots can reach the Power Cell at ${pos(info.key.c, info.key.r)} but the carrier (${holders.map(s => SLOT_NAME[s]).join('/')}) cannot get from there to the hatch`, { c: info.key.c, r: info.key.r });
    }
    // stranded: hatch reachable only through boosted climbs whose helpers have no way up of their own
    const stranded = present.filter(s => A.slots[s].reachD && !A.slots[s].safeD);
    if (stranded.length) {
      const o = A.slots[stranded[0]];
      const climbs = o.boosts.map(b => `${b.k + 1}-bot tower at ${P(b.from)} -> ${P(b.to)}`).join(', ');
      const who = stranded.length === present.length ? 'every bot' : stranded.map(s => SLOT_NAME[s]).join(', ');
      say('HEUR', 'stranded', `[${lab}] ${who} can only reach the hatch via boosted climbs (${climbs || 'tower'}); the bottom bot of the last tower has no way up of its own -> stranded (SPEC 3.1 "Nobody may be stranded")`, { c: o.boosts.length ? cr(o.boosts[0].from)[0] : null, r: o.boosts.length ? cr(o.boosts[0].from)[1] : null, fix: 'give the bottom bot another way up (latch button / lever -> elevator or gate, crate step, spring, one-way ledge)' });
    }
    // pockets (only reported for the 4-bot set, merged across slots)
    if (present.length === 4) {
      const merged = new Map();
      for (const s of present) {
        const o = A.slots[s];
        if (!o.pocketBoost) continue;
        for (const [kind, cells] of [['boost', o.pocketBoost], ['dead', o.pocketDead]]) {
          for (const cl of clusters(cells, cols)) {
            const key = kind + ':' + cl.c0 + ',' + cl.r0 + ',' + cl.c1 + ',' + cl.r1;
            if (!merged.has(key)) merged.set(key, { kind, cl, slots: [] });
            merged.get(key).slots.push(s);
          }
        }
      }
      let shown = 0; const all = [...merged.values()].sort((a, b) => b.cl.cells.length - a.cl.cells.length);
      for (const p of all) {
        if (shown >= 4) { say('HEUR', 'pocket', `(+${all.length - shown} more pocket(s) not shown)`); break; }
        shown++;
        const who = p.slots.length === 4 ? 'a bot' : p.slots.map(s => SLOT_NAME[s]).join('/');
        const area = p.cl.c0 === p.cl.c1 && p.cl.r0 === p.cl.r1 ? pos(p.cl.c0, p.cl.r0) : `cols ${p.cl.c0}-${p.cl.c1}, rows ${p.cl.r0}-${p.cl.r1}`;
        if (p.kind === 'boost') say('HEUR', 'pocket', `stranding pocket at ${area}: ${who} that walks/drops in here can only get back on the route with a boost from another bot (the last one in it is stranded)`, { c: p.cl.c0, r: p.cl.r0, fix: 'ok if players never need to go there; otherwise add a way out (step, spring, one-way ledge)' });
        else say('HEUR', 'pocket', `dead-end pocket at ${area}: ${who} that gets in here can never reach the hatch again (needs Restart)`, { c: p.cl.c0, r: p.cl.r0, fix: 'fine for optional detours/traps; make sure the intended route never goes through it' });
      }
      // gears
      info.gears.forEach(([gc, gr], gi) => {
        if (!present.some(s => A.slots[s].gears[gi])) say('HEUR', 'reach-gear', `gear at ${pos(gc, gr)} looks unreachable (optional bonus, but players will try)`, { c: gc, r: gr });
      });
      if (present.some(s => A.slots[s].topRow)) say('WARN', 'top-clearance', 'bots can stand in row 0; SPEC 7: leave at least 2 empty rows above the highest standable surface', { r: 0 });
    }
    sum.A = opts.keepAnalysis ? A : undefined;
  }
  return summary;
}

// ---------------------------------------------------------------------------------------------
// --show : print a map with a reachability overlay
// ---------------------------------------------------------------------------------------------
function showLevel(info, slot, out) {
  const present = [0, 1, 2, 3];
  const A = analyzeReach(info, present);
  const o = A.slots[slot];
  const { rows, cols } = info;
  const pocket = new Set([].concat(o.pocketBoost || [], o.pocketDead || []));
  let ruler1 = '     ', ruler2 = '     ';
  for (let c = 0; c < cols; c++) { ruler1 += c % 10 === 0 ? String(Math.floor(c / 10) % 10) : ' '; ruler2 += String(c % 10); }
  out.push(ruler1, ruler2);
  for (let r = 0; r < rows; r++) {
    let line = String(r).padStart(3) + '  ';
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c, ch = info.grid[r][c];
      let m = ch;
      if (ch === '.') {
        if (o.dist[i] === 0) m = pocket.has(i) ? '!' : '+';
        else if (o.dist[i] > 0) m = String(Math.min(9, o.dist[i]));
      }
      line += m;
    }
    out.push(line);
  }
  out.push(`legend (slot ${slot}, 4 bots): + reachable alone, 1-9 = needs that many boosted climbs, ! = stranding/dead-end pocket; untouched '.' = not a reachable standing spot`);
  out.push(`hatch: ${o.reachD ? (o.soloD ? 'reachable alone' : o.safeD ? 'reachable with safe boosts' : 'reachable only with boosts (stranding risk)') : 'NOT reachable'}` + (info.key ? `; power cell: ${o.keyTouch.length ? 'reachable' : 'NOT reachable'}` : ''));
}

// ---------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------
function formatText(results, opts) {
  opts = opts || {};
  const lines = [];
  let nE = 0, nW = 0, nH = 0, nLv = 0;
  for (const res of results) {
    nLv += res.levels.length;
    const items = res.findings.filter(f => !opts.errorsOnly || f.sev === 'ERROR');
    for (const f of res.findings) { if (f.sev === 'ERROR') nE++; else if (f.sev === 'WARN') nW++; else nH++; }
    const cnt = s => res.findings.filter(f => f.sev === s).length;
    lines.push('');
    lines.push(`== ${res.file}  (${res.levels.length} levels checked: ${cnt('ERROR')} errors, ${cnt('WARN')} warnings, ${cnt('HEUR')} heuristic)`);
    const groups = new Map();
    for (const f of items) { const k = f.level || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
    const order = [...groups.keys()].sort((a, b) => {
      if (!a) return -1; if (!b) return 1;
      const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
      return (pa[0] - pb[0]) || (pa[1] - pb[1]) || a.localeCompare(b);
    });
    for (const k of order) {
      const fs_ = groups.get(k).sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
      lines.push(k ? `  ${k} "${fs_[0].name || ''}"` : '  (world file)');
      for (const f of fs_) {
        const where = f.c != null && f.r != null ? pos(f.c, f.r) : f.r != null ? `row ${f.r}` : '';
        lines.push(`    ${f.sev.padEnd(5)} ${where.padEnd(8)} ${f.msg}`);
        if (f.fix) lines.push(`    ${''.padEnd(5)} ${''.padEnd(8)}   fix: ${f.fix}`);
      }
    }
  }
  lines.push('');
  lines.push(`${results.length} file(s), ${nLv} level(s): ${nE} ERROR, ${nW} WARN, ${nH} HEUR (heuristic, review by hand)`);
  lines.push(nE ? 'RESULT: FAIL (fix the ERRORs)' : 'RESULT: OK (no errors)');
  return lines.join('\n');
}

function listFiles(args, opts) {
  const files = [];
  const idFilter = new Set();
  const all = () => fs.existsSync(LEVELS_DIR) ? fs.readdirSync(LEVELS_DIR).filter(f => /^world\d+\.json$/.test(f)).sort().map(f => path.join(LEVELS_DIR, f)) : [];
  for (const a of args) {
    let m;
    if ((m = /^(\d+)-(\d+)$/.exec(a))) {
      idFilter.add(a);
      const f = path.join(LEVELS_DIR, `world${String(m[1]).padStart(2, '0')}.json`);
      if (m[1] === '0') { const ex = path.join(LEVELS_DIR, '_examples.json'); if (!files.includes(ex)) files.push(ex); }
      else if (!files.includes(f)) files.push(f);
    } else if ((m = /^(?:world)?(\d{1,2})(?:\.json)?$/i.exec(a))) {
      const f = path.join(LEVELS_DIR, `world${String(m[1]).padStart(2, '0')}.json`);
      if (!files.includes(f)) files.push(f);
    } else if (fs.existsSync(a)) files.push(path.resolve(a));
    else files.push(path.resolve(a)); // reported as unreadable
  }
  if (!args.length) files.push(...all());
  if (opts.examples) { const ex = path.join(LEVELS_DIR, '_examples.json'); if (!files.includes(ex)) files.push(ex); }
  return { files, idFilter };
}

function validateFiles(files, opts) {
  return files.map(f => validateWorldFile(f, opts));
}

function main(argv) {
  const args = [], opts = { idFilter: null };
  let show = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--examples') opts.examples = true;
    else if (a === '--errors') opts.errorsOnly = true;
    else if (a === '--no-heur') opts.noHeur = true;
    else if (a === '--partial') opts.partial = true;
    else if (a === '--show') show = argv[++i];
    else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 24).map(l => l.replace(/^ \* ?/, '')).join('\n')); return 0; }
    else args.push(a);
  }
  if (show) {
    const [id, sl] = show.split(':');
    const wn = parseInt(id.split('-')[0], 10);
    const file = wn === 0 ? path.join(LEVELS_DIR, '_examples.json') : path.join(LEVELS_DIR, `world${String(wn).padStart(2, '0')}.json`);
    const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    const lv = obj.levels.find(l => l.id === id);
    if (!lv) { console.error(`level ${id} not found in ${file}`); return 2; }
    const sink = makeSink(file);
    const scope = { id, name: lv.name };
    const info = checkMap(lv, scope, () => {}, () => {});
    info.ents = checkEntities(lv.entities || [], info, () => {}, () => {});
    checkHazards(info, () => {}, () => {});
    info.minPlayers = lv.minPlayers || 4;
    const out = [`${id} "${lv.name}"  ${info.cols}x${info.rows}  minPlayers ${lv.minPlayers}`];
    if (!info.reachOK) out.push('(spawn/hatch errors: cannot analyse)');
    else showLevel(info, parseInt(sl || '0', 10), out);
    console.log(out.join('\n'));
    void sink;
    return 0;
  }
  const { files, idFilter } = listFiles(args, opts);
  opts.idFilter = idFilter;
  if (!files.length) {
    if (opts.json) console.log(JSON.stringify({ ok: true, files: [], findings: [], note: 'no level files found' }));
    else console.log('No levels/world*.json files found (use --examples to check levels/_examples.json).');
    return 0;
  }
  const results = validateFiles(files, opts);
  // cross-file: duplicate ids / names
  const seenId = new Map(), seenName = new Map();
  for (const r of results) for (const lv of r.levels) {
    if (seenId.has(lv.id)) r.findings.push({ sev: 'ERROR', file: r.file, level: lv.id, name: lv.name, c: null, r: null, code: 'id-dup', msg: `level id "${lv.id}" also used in ${seenId.get(lv.id)}`, fix: null });
    else seenId.set(lv.id, r.file);
    if (lv.name) {
      const k = lv.name.trim().toLowerCase();
      if (seenName.has(k) && seenName.get(k).file !== r.file) r.findings.push({ sev: 'WARN', file: r.file, level: lv.id, name: lv.name, c: null, r: null, code: 'name-dup-global', msg: `name "${lv.name}" is also used by ${seenName.get(k).id}`, fix: 'level names should be unique across the game' });
      else if (!seenName.has(k)) seenName.set(k, { file: r.file, id: lv.id });
    }
  }
  const all = [].concat(...results.map(r => r.findings));
  const nE = all.filter(f => f.sev === 'ERROR').length;
  if (opts.json) {
    console.log(JSON.stringify({
      ok: nE === 0,
      counts: { files: results.length, levels: results.reduce((a, r) => a + r.levels.length, 0), ERROR: nE, WARN: all.filter(f => f.sev === 'WARN').length, HEUR: all.filter(f => f.sev === 'HEUR').length },
      levels: [].concat(...results.map(r => r.levels.map(l => ({ file: r.file, id: l.id, name: l.name, ms: l.ms, reach: l.reach })))),
      findings: all,
    }, null, 1));
  } else {
    console.log('STACKBOTS level validator — positions are [col,row] (= entity x,y). ERROR = must fix, WARN = review, HEUR = heuristic, review by hand.');
    console.log(formatText(results, opts));
  }
  return nE ? 1 : 0;
}

module.exports = { validateFiles, validateWorldFile, validateWorldObject, validateLevel, analyzeReach, checkMap, checkEntities, checkHazards, formatText, makeSink, WORLD_TABLE, flightTime };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
