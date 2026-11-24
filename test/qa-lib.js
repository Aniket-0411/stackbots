'use strict';
// Shared helpers for QA tests (owned by QA). Node built-ins only.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_PATH = path.join(ROOT, 'src', 'engine.js');
const SIM_PATH = path.join(ROOT, 'tools', 'sim.js');

function loadEngine() {
  if (!fs.existsSync(ENGINE_PATH)) return { E: null, why: 'src/engine.js does not exist yet' };
  try {
    const mod = require(ENGINE_PATH);
    const E = (mod && mod.parseLevel) ? mod : (mod && mod.Engine) ? mod.Engine : (globalThis.SB && globalThis.SB.Engine);
    if (!E || typeof E.parseLevel !== 'function') return { E: null, why: 'src/engine.js loaded but exports no Engine with parseLevel()' };
    return { E };
  } catch (e) {
    return { E: null, why: 'src/engine.js failed to load: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) };
  }
}

// ---------------- tiny test framework ----------------
function makeRunner(title) {
  const tests = [];
  const results = [];
  const only = process.env.QA_ONLY ? new RegExp(process.env.QA_ONLY, 'i') : null;
  function test(name, fn) { tests.push({ name, fn }); }
  function skipAll(why) {
    console.log(`SKIP ${title}: ${why}`);
    console.log('##QA ' + JSON.stringify({ title, pass: 0, fail: 0, skip: 1, skipped: why, results: [] }));
    process.exit(0);
  }
  async function run() {
    console.log(`# ${title}`);
    for (const t of tests) {
      if (only && !only.test(t.name)) continue;
      const t0 = Date.now();
      let ok = true, msg = '';
      try {
        const r = await t.fn();
        if (r && r.skip) { results.push({ name: t.name, status: 'skip', msg: r.skip }); console.log(`skip - ${t.name}: ${r.skip}`); continue; }
        if (r && r.warn) { results.push({ name: t.name, status: 'warn', msg: r.warn, ms: Date.now() - t0 }); console.log(`WARN - ${t.name}: ${r.warn}`); continue; }
      } catch (e) {
        ok = false;
        msg = e && e.qa ? e.message : (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e));
      }
      const ms = Date.now() - t0;
      results.push({ name: t.name, status: ok ? 'pass' : 'fail', msg, ms });
      console.log(`${ok ? 'ok  ' : 'FAIL'} - ${t.name}${ok ? '' : '\n       ' + msg.replace(/\n/g, '\n       ')}`);
    }
    const warn = results.filter(r => r.status === 'warn').length;
    const pass = results.filter(r => r.status === 'pass' || r.status === 'warn').length, fail = results.filter(r => r.status === 'fail').length, skip = results.filter(r => r.status === 'skip').length;
    console.log(`\n${title}: ${pass} passed (${warn} with warnings), ${fail} failed, ${skip} skipped`);
    console.log('##QA ' + JSON.stringify({ title, pass, fail, skip, warn, results }));
    process.exitCode = fail ? 1 : 0;
  }
  return { test, run, skipAll, results };
}

class QAError extends Error { constructor(m) { super(m); this.qa = true; } }
function fail(msg) { throw new QAError(msg); }
function check(cond, msg) { if (!cond) fail(msg); }
const r1 = v => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
function near(actual, expected, tol, what) {
  if (typeof actual !== 'number' || !isFinite(actual) || Math.abs(actual - expected) > tol) fail(`${what}: expected ${r1(expected)} (±${tol}), actual ${r1(actual)}`);
}

// ---------------- map builder ----------------
// Default: W x H map, floor rows [floorRow .. H-1] solid. Spawns default on row floorRow-1 at cols 1..4.
class MapB {
  constructor(w, h, floorRow) {
    this.w = w || 40; this.h = h || 16;
    this.g = Array.from({ length: this.h }, () => Array(this.w).fill('.'));
    this.floorRow = floorRow === undefined ? this.h - 2 : floorRow;
    if (this.floorRow !== null) this.fill(0, this.floorRow, this.w - 1, this.h - 1, '#');
    this.ents = [];
    this.spawn = {};
  }
  fill(c0, r0, c1, r1, ch) { for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) if (r >= 0 && r < this.h && c >= 0 && c < this.w) this.g[r][c] = ch === undefined ? '#' : ch; return this; }
  set(c, r, ch) { this.g[r][c] = ch; return this; }
  sp(slot, c, r) { this.spawn[slot] = [c, r]; return this; }
  ent(e) { this.ents.push(e); return this; }
  level(extra) {
    const g = this.g.map(r => r.slice());
    const used = new Set(Object.values(this.spawn).map(p => p.join(',')));
    for (let s = 0; s < 4; s++) {
      let p = this.spawn[s];
      if (!p) { // park an unused spawn on the far left floor
        for (let c = 1; c < this.w && !p; c++) for (let r = this.h - 2; r >= 1 && !p; r--) {
          if (g[r][c] === '.' && g[r + 1][c] === '#' && !used.has(c + ',' + r)) p = [c, r];
        }
      }
      used.add(p.join(','));
      g[p[1]][p[0]] = String(s + 1);
    }
    return Object.assign({ id: '0-99', name: 'QA synthetic', hint: '', minPlayers: 2, tether: false, tetherLength: 5, map: g.map(r => r.join('')), entities: JSON.parse(JSON.stringify(this.ents)) }, extra || {});
  }
}

// ---------------- simulation wrapper ----------------
const KEYS = ['left', 'right', 'up', 'down', 'jump'];
class Sim {
  constructor(E, levelJson, slots, meta) {
    this.E = E;
    this.levelJson = levelJson;
    this.level = E.parseLevel(JSON.parse(JSON.stringify(levelJson)), meta);
    this.slots = slots || [0, 1, 2, 3];
    this.w = E.createWorld(this.level, { slots: this.slots });
    this.held = {}; this.once = {}; this.extra = {};
    for (const s of this.slots) { this.held[s] = new Set(); this.once[s] = new Set(); this.extra[s] = {}; }
    this.events = [];
    this.deaths = 0;
    this.trace = null;
  }
  p(slot) { const p = this.w.players.find(q => q.slot === slot); if (!p) fail(`no player with slot ${slot} in world.players`); return p; }
  hold(slot, ...keys) { for (const k of keys.flat()) this.held[slot].add(k); return this; }
  release(slot, ...keys) { if (!keys.length) this.held[slot].clear(); for (const k of keys.flat()) this.held[slot].delete(k); return this; }
  releaseAll() { for (const s of this.slots) this.held[s].clear(); return this; }
  // key held for exactly the next tick (a press), unless it is also held
  press(slot, key) { this.once[slot].add(key); return this; }
  inputs() {
    const inp = [];
    for (const s of this.slots) {
      const o = {};
      for (const k of KEYS) o[k] = this.held[s].has(k) || this.once[s].has(k);
      Object.assign(o, this.extra[s]);
      inp[s] = o;
    }
    return inp;
  }
  step(n, each) {
    n = n === undefined ? 1 : n;
    for (let i = 0; i < n; i++) {
      const inp = this.inputs();
      for (const s of this.slots) this.once[s].clear();
      const before = this.w.phase;
      this.E.step(this.w, inp);
      if (Array.isArray(this.w.events)) for (const ev of this.w.events) this.events.push(Object.assign({ tick: this.w.tick }, ev));
      if (before === 'play' && this.w.phase === 'dead') this.deaths++;
      if (each && each(this, i) === false) return i + 1;
    }
    return n;
  }
  // step until pred true (or max ticks); returns ticks used or -1
  until(pred, max) {
    for (let i = 0; i < max; i++) { if (pred(this)) return i; this.step(1); }
    return pred(this) ? max : -1;
  }
  place(slot, x, feetY) { const p = this.p(slot); p.x = x; p.y = feetY - p.h; p.vx = 0; p.vy = 0; return p; }
  ent(pred) { return this.w.entities.find(typeof pred === 'function' ? pred : (e => e.id === pred)); }
  ents(type) { return this.w.entities.filter(e => e.type === type); }
  get tick() { return this.w.tick; }
}
const feet = p => p.y + p.h;
const cx = p => p.x + p.w / 2;
const fmtP = p => `slot${p.slot} x=${r1(p.x)} y=${r1(p.y)} vx=${r1(p.vx)} vy=${r1(p.vy)} onGround=${p.onGround} state=${p.state}`;

function snapSize(E, w) { return JSON.stringify(E.snapshot(w)).length; }

function listWorldFiles() {
  const dir = path.join(ROOT, 'levels');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^world\d+\.json$/.test(f)).sort().map(f => path.join(dir, f));
}

module.exports = { ROOT, ENGINE_PATH, SIM_PATH, loadEngine, makeRunner, fail, check, near, MapB, Sim, feet, cx, fmtP, r1, snapSize, listWorldFiles, QAError };
