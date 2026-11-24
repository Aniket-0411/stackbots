#!/usr/bin/env node
'use strict';
// STACKBOTS headless simulation harness (SPEC §9).
//   const sim = require('./tools/sim.js');
//   const r = sim.run('1-3', {slots:[0,1,2,3], ticks: 900, script: [
//     {from: 0, to: 120, slot: 0, hold: ['right']},   // held on ticks [from, to)
//     {at: 130, slot: 0, press: 'jump'}               // held for exactly one tick
//   ]});  // -> {world, phase, cleared, deaths, log, ticks, clearTick, level}
// `run` also accepts an inline level object instead of an id.
// Script ticks are relative to the start of the run (0 = the first step).
// Options: slots, ticks, script, stopOnClear (default true), stopOnDeath (default false),
//          autoReset (default true; false = stop at the first death), each(world, t) callback,
//          logEvents (default true), meta (merged into parseLevel).
// CLI: node tools/sim.js <id> [--ticks N] [--slots 0,1,2,3] [--script file.json] [--json]
const fs = require('fs');
const path = require('path');
const Engine = require('../src/engine.js');

const ROOT = path.resolve(__dirname, '..');
const LEVEL_DIR = path.join(ROOT, 'levels');
const KEYS = ['left', 'right', 'up', 'down', 'jump'];

function worldFiles() {
  let files = [];
  try { files = fs.readdirSync(LEVEL_DIR).filter(f => /^world\d+\.json$/.test(f)).sort(); } catch (e) { /* none */ }
  if (fs.existsSync(path.join(LEVEL_DIR, '_examples.json'))) files.push('_examples.json');
  return files.map(f => path.join(LEVEL_DIR, f));
}

// all levels: [{id, json, meta, file}]
function loadAll() {
  const out = [];
  for (const file of worldFiles()) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(path.basename(file) + ': invalid JSON: ' + e.message); }
    const levels = Array.isArray(data.levels) ? data.levels : [];
    levels.forEach((lv, index) => out.push({
      id: String(lv.id), json: lv, file,
      meta: { world: data.world, theme: data.theme, worldName: data.name, index }
    }));
  }
  return out;
}

function find(id) {
  const hit = loadAll().find(l => l.id === String(id));
  if (!hit) throw new Error('level ' + id + ' not found in ' + worldFiles().map(f => path.basename(f)).join(', '));
  return hit;
}

// parsed Level for an id or inline object
function load(idOrLevel, meta) {
  if (idOrLevel && typeof idOrLevel === 'object') return idOrLevel.cat ? idOrLevel : Engine.parseLevel(idOrLevel, meta);
  const hit = find(idOrLevel);
  return Engine.parseLevel(hit.json, Object.assign({}, hit.meta, meta || {}));
}

function inputsAt(script, t, slots) {
  const inp = [];
  for (const s of slots) inp[s] = { left: false, right: false, up: false, down: false, jump: false };
  for (const e of script || []) {
    const o = inp[e.slot];
    if (!o) continue;
    if (e.hold && t >= (e.from || 0) && t < (e.to == null ? Infinity : e.to)) {
      for (const k of [].concat(e.hold)) if (KEYS.includes(k)) o[k] = true;
    }
    if (e.press && t === e.at) for (const k of [].concat(e.press)) if (KEYS.includes(k)) o[k] = true;
  }
  return inp;
}

function runLevel(level, opts) {
  opts = opts || {};
  const L = load(level, opts.meta);
  const slots = opts.slots || [0, 1, 2, 3];
  const ticks = opts.ticks == null ? 600 : opts.ticks;
  const stopOnClear = opts.stopOnClear !== false;
  const world = Engine.createWorld(L, { slots });
  const log = [];
  let deaths = 0, clearTick = -1, t = 0;
  for (; t < ticks; t++) {
    const before = world.phase;
    Engine.step(world, inputsAt(opts.script, t, slots));
    if (opts.logEvents !== false) for (const ev of world.events) log.push(Object.assign({ tick: t }, ev));
    if (before === 'play' && world.phase === 'dead') {
      deaths++;
      if (opts.stopOnDeath || opts.autoReset === false) { t++; break; }
    }
    if (before === 'play' && world.phase === 'clear') { clearTick = t; if (stopOnClear) { t++; break; } }
    if (opts.each && opts.each(world, t) === false) { t++; break; }
  }
  return { world, phase: world.phase, cleared: clearTick >= 0, clearTick, deaths, log, ticks: t, level: L };
}

function run(idOrLevel, opts) { return runLevel(idOrLevel, opts); }

function summary(r) {
  const w = r.world;
  const lines = [];
  lines.push(`level ${w.level.id} "${w.level.name}"  ${w.level.cols}x${w.level.rows}  slots ${w.slots.join(',')}`);
  lines.push(`ran ${r.ticks} ticks  phase=${r.phase}  cleared=${r.cleared}${r.cleared ? ' @' + r.clearTick : ''}  deaths=${r.deaths}  gears=${w.gearsTaken}/${w.gears.length}`);
  for (const p of w.players) {
    lines.push(`  bot ${p.slot}: x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} tile=(${Math.floor((p.x + p.w / 2) / 32)},${Math.floor((p.y + p.h - 1) / 32)}) ${p.state}${p.onGround ? ' grounded' : ''}${p.hasKey ? ' +cell' : ''}`);
  }
  if (w.key) lines.push(`  cell: holder=${w.key.holder} used=${w.key.used}  hatch open=${w.door.open}`);
  const counts = {};
  for (const e of r.log) counts[e.t] = (counts[e.t] || 0) + 1;
  lines.push('  events: ' + (Object.keys(counts).map(k => k + ' ' + counts[k]).join(', ') || 'none'));
  lines.push('  snapshot bytes: ' + JSON.stringify(Engine.snapshot(w)).length);
  return lines.join('\n');
}

module.exports = { run, runLevel, load, find, loadAll, worldFiles, inputsAt, summary, Engine };

if (require.main === module) {
  const args = process.argv.slice(2);
  const get = (name, d) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
  const id = args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')));
  if (!id || args.includes('--help')) {
    console.log('usage: node tools/sim.js <level-id> [--ticks N] [--slots 0,1,2,3] [--script file.json] [--json]');
    console.log('levels: ' + loadAll().map(l => l.id).join(' '));
    process.exit(id ? 0 : 1);
  }
  const opts = {
    ticks: +get('--ticks', 600),
    slots: get('--slots', '0,1,2,3').split(',').map(Number),
    script: get('--script') ? JSON.parse(fs.readFileSync(get('--script'), 'utf8')) : []
  };
  try {
    const r = run(id, opts);
    if (args.includes('--json')) console.log(JSON.stringify({ phase: r.phase, cleared: r.cleared, clearTick: r.clearTick, deaths: r.deaths, ticks: r.ticks, snapshot: Engine.snapshot(r.world) }));
    else console.log(summary(r));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
