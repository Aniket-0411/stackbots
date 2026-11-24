#!/usr/bin/env node
'use strict';
// Engine smoke tests (dev-engine). Tiny inline levels; exit code 1 on failure.
//   node test/engine.smoke.test.js
const path = require('path');
const E = require(path.join(__dirname, '..', 'src', 'engine.js'));
const sim = require(path.join(__dirname, '..', 'tools', 'sim.js'));
const T = 32;

let pass = 0, failN = 0;
const results = [];
function test(name, fn) {
  let msg = '';
  try { fn(); } catch (e) { msg = e && e.message ? e.message : String(e); if (!e.soft) msg += ' | ' + String(e.stack).split('\n')[1]; }
  results.push({ name, status: msg ? 'fail' : 'pass', msg });
  if (msg) { failN++; console.log('FAIL - ' + name + '\n       ' + msg); } else { pass++; console.log('ok   - ' + name); }
}
function check(c, m) { if (!c) { const e = new Error(m); e.soft = true; throw e; } }

// ---- tiny map builder: W x H, solid floor rows from `fr` down ----
function grid(W, H, fr) {
  const g = Array.from({ length: H }, (_, r) => Array(W).fill(r >= fr ? '#' : '.'));
  const api = {
    g, fr,
    fill(c0, r0, c1, r1, ch) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; return api; },
    set(c, r, ch) { g[r][c] = ch; return api; },
    level(spawns, extra) {
      const m = g.map(r => r.slice());
      spawns.forEach((p, i) => { m[p[1]][p[0]] = String(i + 1); });
      let hasD = m.some(r => r.includes('D'));
      if (!hasD) m[fr - 1][W - 2] = 'D';
      return Object.assign({ id: 'smoke', name: 'smoke', hint: '', minPlayers: 2, tether: false, tetherLength: 5, map: m.map(r => r.join('')), entities: [] }, extra || {});
    }
  };
  return api;
}
// default 4 spawns on the far left so they never interfere
function spawns4(fr, extra) {
  const s = [null, null, null, null], used = new Set();
  (extra || []).forEach((p, i) => { if (p) { s[i] = p; used.add(p[0]); } });
  for (let i = 0, c = 1; i < 4; i++) if (!s[i]) { while (used.has(c)) c++; s[i] = [c, fr - 1]; used.add(c); }
  return s;
}

class W {
  constructor(lv, slots) { this.w = E.createWorld(E.parseLevel(lv), { slots: slots || [0, 1, 2, 3] }); this.held = {}; this.once = {}; this.deaths = 0; this.events = []; }
  p(s) { return this.w.players.find(p => p.slot === s); }
  hold(s, ...k) { (this.held[s] = this.held[s] || new Set()); k.forEach(x => this.held[s].add(x)); return this; }
  rel(s, ...k) { if (!this.held[s]) return this; if (!k.length) this.held[s].clear(); k.forEach(x => this.held[s].delete(x)); return this; }
  press(s, k) { (this.once[s] = this.once[s] || new Set()).add(k); return this; }
  step(n, each) {
    for (let i = 0; i < (n || 1); i++) {
      const inp = [];
      for (let s = 0; s < 4; s++) {
        const o = {};
        for (const k of ['left', 'right', 'up', 'down', 'jump']) o[k] = !!((this.held[s] && this.held[s].has(k)) || (this.once[s] && this.once[s].has(k)));
        inp[s] = o;
      }
      this.once = {};
      const b = this.w.phase;
      E.step(this.w, inp);
      for (const ev of this.w.events) this.events.push(ev);
      if (b === 'play' && this.w.phase === 'dead') this.deaths++;
      if (each) each(this);
    }
    return this;
  }
  place(s, x, feetY) { const p = this.p(s); p.x = x; p.y = feetY - p.h; p.vx = p.vy = 0; return p; }
  ents(t) { return this.w.entities.filter(e => e.type === t); }
}
const feet = p => p.y + p.h;

// ---------------------------------------------------------------- (a)(b) climbing
// wall of height h starting at column 20; `below` bots stacked under the jumper against the wall
function climb(h, below) {
  const FR = 14, FY = FR * T;
  // try several takeoff offsets (distance from wall) and jump timings
  for (const startGap of [0, 4, 12, 30, 60]) {
    const g = grid(40, 16, FR).fill(20, FR - h, 39, FR - 1, '#').set(37, FR - h - 1, 'D');
    const s = new W(g.level(spawns4(FR)));
    const x = 20 * T - 24 - startGap;
    for (let i = 0; i < below; i++) s.place(i + 1, 20 * T - 24, FY - i * 30);
    s.place(0, below ? 20 * T - 24 : x, FY - below * 30);
    s.step(5);
    s.hold(0, 'jump', 'right'); s.step(90); s.rel(0); s.step(20);
    const p = s.p(0);
    if (p.x >= 20 * T && Math.abs(feet(p) - (FY - h * T)) < 0.6) return true;
    if (below) break;
  }
  return false;
}
test('(a) lone bot climbs a 2-tile wall', () => check(climb(2, 0), 'could not climb 2 tiles'));
test('(a) lone bot cannot climb a 3-tile wall', () => check(!climb(3, 0), 'climbed 3 tiles alone'));
test('(b) on one bot: 3 tiles yes, 4 no', () => { check(climb(3, 1), '2-tower failed 3 tiles'); check(!climb(4, 1), '2-tower climbed 4'); });
test('(b) 3-tower: 4 tiles yes, 5 no', () => { check(climb(4, 2), '3-tower failed 4 tiles'); check(!climb(5, 2), '3-tower climbed 5'); });
test('(b) 4-tower: 5 tiles yes, 6 no', () => { check(climb(5, 3), '4-tower failed 5 tiles'); check(!climb(6, 3), '4-tower climbed 6'); });

test('(b) 4-tower stable idle, while walking, and when the bottom jumps (ceiling stops it)', () => {
  const FR = 14, FY = FR * T;
  const g = grid(48, 16, FR).fill(25, 0, 30, 5, '#');
  const s = new W(g.level(spawns4(FR)));
  for (let i = 0; i < 4; i++) s.place(i, 10 * T + 4, FY - i * 30);
  s.step(300);
  for (let i = 0; i < 4; i++) { check(Math.abs(s.p(i).x - (10 * T + 4)) < 0.01 && Math.abs(feet(s.p(i)) - (FY - i * 30)) < 0.01, `idle tower drifted: slot ${i} ${s.p(i).x},${s.p(i).y}`); }
  s.hold(0, 'right');
  let worst = 0;
  s.step(120, q => { for (let i = 1; i < 4; i++) worst = Math.max(worst, Math.abs(q.p(i).x - q.p(0).x), Math.abs(feet(q.p(i)) - q.p(i - 1).y)); });
  check(worst < 0.01, `walking tower slipped ${worst}`);
  s.rel(0); s.step(30);
  // under the ceiling (rows 0..5 solid at cols 25..30): bottom at x≈... move under it first
  const x0 = s.p(0).x;
  s.hold(0, 'jump'); let minTop = 1e9, overlap = false;
  s.step(40, q => { minTop = Math.min(minTop, q.p(3).y); for (let i = 1; i < 4; i++) if (q.p(i).y + q.p(i).h > q.p(i - 1).y + 0.01) overlap = true; });
  s.rel(0); s.step(60);
  check(!overlap, 'stack members overlapped while jumping');
  check(minTop < FY - 4 * 30 - 20, `stack did not go up together (top min y ${minTop})`);
  for (let i = 1; i < 4; i++) check(Math.abs(feet(s.p(i)) - s.p(i - 1).y) < 0.01, 'stack did not re-settle after the jump');
  check(Math.abs(s.p(0).x - x0) < 0.01, 'bottom drifted');
  // now under a ceiling
  const g2 = grid(48, 16, FR).fill(8, 0, 14, 4, '#');
  const s2 = new W(g2.level(spawns4(FR)));
  for (let i = 0; i < 4; i++) s2.place(i, 10 * T + 4, FY - i * 30);
  s2.step(5); s2.hold(0, 'jump'); let top = 1e9;
  s2.step(40, q => { top = Math.min(top, q.p(3).y); }); s2.rel(0); s2.step(60);
  check(top >= 5 * T - 0.01, `top bot went into the ceiling (y ${top})`);
  check(s2.w.phase === 'play', 'tower died under a ceiling');
  for (let i = 1; i < 4; i++) check(Math.abs(feet(s2.p(i)) - s2.p(i - 1).y) < 0.01, 'stack broken under ceiling');
});

// ---------------------------------------------------------------- (c) gaps
function gapJump(n) {
  const FR = 12;
  for (let t = 20; t < 140; t++) {
    const g = grid(40, 16, FR).fill(14, FR, 14 + n - 1, 15, '.');
    const s = new W(g.level(spawns4(FR, [[4, FR - 1]])));
    s.hold(0, 'right'); s.step(t); s.hold(0, 'jump'); s.step(80);
    if (s.w.phase === 'play' && feet(s.p(0)) === FR * T && s.p(0).x > (14 + n) * T - 24) return true;
  }
  return false;
}
test('(c) 3-tile gap jumpable', () => check(gapJump(3), '3-tile gap failed'));
test('(c) 4-tile gap not jumpable (any takeoff tick, incl. coyote)', () => check(!gapJump(4), '4-tile gap jumped'));

// ---------------------------------------------------------------- (d) riders
test('(d) rider carried by a walking support', () => {
  const FR = 14, FY = FR * T, s = new W(grid(48, 16, FR).level(spawns4(FR)));
  s.place(0, 10 * T, FY); s.place(1, 10 * T, FY - 30); s.step(3); s.hold(0, 'right');
  let slip = 0; s.step(100, q => { slip = Math.max(slip, Math.abs(q.p(1).x - q.p(0).x), Math.abs(feet(q.p(1)) - q.p(0).y)); });
  check(s.p(0).x > 10 * T + 200 && slip < 0.01, `slip ${slip}`);
});

// ---------------------------------------------------------------- (e) crates
test('(e) crate need 2: 1 pusher no, 2 (chained) yes; falls into a pit', () => {
  const FR = 14, FY = FR * T;
  const g = grid(48, 18, FR).fill(30, FR, 31, 17, '.');
  const lv = g.level(spawns4(FR), { entities: [{ type: 'crate', x: 20, y: FR - 1, need: 2 }] });
  const s = new W(lv); const c = () => s.ents('crate')[0];
  s.place(0, 20 * T - 24, FY); s.place(1, 15 * T, FY); s.step(2);
  s.hold(0, 'right'); s.step(60);
  check(Math.abs(c().x - 20 * T) < 0.01, `crate moved with 1 pusher (${c().x})`);
  s.hold(1, 'right'); s.step(120);
  check(c().x > 20 * T + 20, `crate did not move with 2 chained pushers (${c().x})`);
  check(c().pushers === 2 && Math.abs(c().vx - E.C.CRATE_SPEED) < 1e-9, `pushers ${c().pushers} vx ${c().vx}`);
  s.step(400, q => { if (c().x >= 30 * T) q.rel(0).rel(1); });
  check(s.w.phase === 'play', 'pushers fell in');
  check(c().gone === true || c().y > FY, `crate did not fall into the pit (${c().x},${c().y})`);
});

// ---------------------------------------------------------------- (f) buttons & gates
test('(f) buttons hold/latch/timer', () => {
  const FR = 14, FY = FR * T;
  const lv = grid(48, 16, FR).level(spawns4(FR), { entities: [
    { type: 'button', x: 10, y: FR - 1, channel: 'A', mode: 'hold' },
    { type: 'button', x: 14, y: FR - 1, channel: 'B', mode: 'latch' },
    { type: 'button', x: 18, y: FR - 1, channel: 'C', mode: 'timer', time: 30 }] });
  const s = new W(lv); const b = s.ents('button');
  s.place(0, 10 * T + 4, FY); s.place(1, 14 * T + 4, FY); s.place(2, 18 * T + 4, FY); s.step(2);
  check(b[0].on && b[1].on && b[2].on && s.w.channels.A && s.w.channels.B && s.w.channels.C, 'buttons not on when pressed');
  s.place(0, 25 * T, FY); s.place(1, 27 * T, FY); s.place(2, 29 * T, FY); s.step(2);
  check(!b[0].on && b[1].on && b[2].on, 'hold should release, latch/timer stay');
  s.step(30);
  check(!b[2].on && b[1].on, 'timer should expire after 30 ticks; latch stays');
});
function gateWorld(logic, invert, n) {
  const FR = 14, FY = FR * T;
  const lv = grid(48, 16, FR).level(spawns4(FR), { entities: [
    { type: 'button', x: 10, y: FR - 1, channel: 'A' }, { type: 'button', x: 12, y: FR - 1, channel: 'A' },
    { type: 'gate', x: 30, y: FR - 3, h: 3, channel: 'A', logic, invert }] });
  const s = new W(lv);
  if (n >= 1) s.place(0, 10 * T + 4, FY);
  if (n >= 2) s.place(1, 12 * T + 4, FY);
  s.step(3); return s;
}
test('(f) gate all/any/invert', () => {
  const cases = [['all', false, 1, false], ['all', false, 2, true], ['any', false, 0, false], ['any', false, 1, true], ['all', true, 0, true], ['all', true, 2, false], ['any', true, 1, false]];
  for (const [lg, inv, n, open] of cases) { const s = gateWorld(lg, inv, n); check(s.ents('gate')[0].open === open, `gate ${lg} inv=${inv} n=${n} open=${s.ents('gate')[0].open}`); }
  const s = gateWorld('all', false, 0); s.place(2, 28 * T, 14 * T); s.hold(2, 'right'); s.step(60);
  check(s.p(2).x + 24 <= 30 * T + 0.01, 'walked through a closed gate');
});
test('(f) gate never closes onto a bot', () => {
  const FR = 14, FY = FR * T;
  const s = gateWorld('all', false, 2);
  s.place(2, 30 * T + 4, FY); s.place(1, 20 * T, FY); s.step(5);
  const g = s.ents('gate')[0];
  check(g.open, 'gate closed onto a bot');
  s.place(2, 35 * T, FY); s.step(2);
  check(!g.open, 'gate did not close after the bot left');
  s.step(10); check(g.openAmt === 0, 'openAmt did not animate to 0');
});

// ---------------------------------------------------------------- (g) platforms
test('(g) elevator need 2: 1 rider stays, 2 riders go up; returns when empty', () => {
  const FR = 14, FY = FR * T;
  const lv = grid(48, 16, FR).level(spawns4(FR), { entities: [{ type: 'platform', x: 20, y: 13, w: 2, path: [[20, 13], [20, 8]], need: 2 }] });
  const s = new W(lv); const e = s.ents('platform')[0];
  s.place(0, 20 * T + 4, 13 * T); s.step(60);
  check(Math.abs(e.y - 13 * T) < 0.01, `elevator moved with 1 rider (${e.y})`);
  s.place(1, 20 * T + 36, 13 * T); s.step(200);
  check(Math.abs(e.y - 8 * T) < 0.01 && Math.abs(feet(s.p(0)) - 8 * T) < 0.01 && Math.abs(feet(s.p(1)) - 8 * T) < 0.01, `elevator not up with riders (${e.y})`);
  s.place(0, 10 * T, FY); s.place(1, 12 * T, FY); s.step(200);
  check(Math.abs(e.y - 13 * T) < 0.01, 'elevator did not return');
});
test('(g) channel platform moves while channel active', () => {
  const FR = 14, FY = FR * T;
  const lv = grid(48, 16, FR).level(spawns4(FR), { entities: [{ type: 'button', x: 10, y: FR - 1, channel: 'D' }, { type: 'platform', x: 20, y: 10, w: 2, path: [[20, 10], [26, 10]], channel: 'D' }] });
  const s = new W(lv); const e = s.ents('platform')[0];
  s.step(30); check(e.x === 20 * T, 'moved while inactive');
  s.place(0, 10 * T + 4, FY); s.step(100); check(Math.abs(e.x - (20 * T + 100)) < 1.5, `forward ${e.x}`);
  s.step(200); check(e.x === 26 * T, 'did not stop at end');
  s.place(0, 5 * T, FY); s.step(250); check(e.x === 20 * T, 'did not return');
});

// ---------------------------------------------------------------- (h) cell & hatch
test('(h) cell pickup -> unlock -> Up enters -> Down exits -> all in = clear', () => {
  const FR = 14, FY = FR * T;
  const g = grid(40, 16, FR).set(8, FR - 1, 'K').set(14, FR - 1, 'D');
  const s = new W(g.level(spawns4(FR, [[3, FR - 1], [1, FR - 1]])), [0, 1]);
  check(!s.w.door.open, 'door should start locked');
  s.hold(0, 'right'); s.step(200, q => { if (q.p(0).x > 14 * T + 2) q.rel(0); });
  check(s.events.some(e => e.t === 'key') && s.events.some(e => e.t === 'unlock') && s.w.door.open && s.w.key.used, 'cell/unlock failed');
  const y = s.p(0).y; s.press(0, 'up'); s.step(1);
  check(s.p(0).state === 'entered' && s.p(0).y === y, 'Up did not enter');
  s.press(0, 'down'); s.step(2);
  check(s.p(0).state === 'active', 'Down did not exit');
  s.press(0, 'up'); s.step(1);
  s.hold(1, 'right'); s.step(260, q => { if (q.p(1).x > 14 * T + 2) q.rel(1); });
  check(s.w.phase === 'play', 'cleared too early');
  s.press(1, 'up'); s.step(1);
  check(s.w.phase === 'clear' && s.events.some(e => e.t === 'clear'), `not clear: ${s.w.phase}`);
});

// ---------------------------------------------------------------- (i) death
test('(i) spikes -> dead phase -> auto reset after DEAD_TICKS', () => {
  const FR = 14;
  const g = grid(40, 16, FR).set(10, FR - 1, '^');
  const s = new W(g.level(spawns4(FR, [[7, FR - 1]])));
  const x0 = s.p(0).x;
  s.hold(0, 'right'); let t = 0; s.step(100, q => { if (q.w.phase === 'dead' && !t) t = q.w.tick; });
  check(t > 0 && s.w.deadSlot === -1 || s.deaths === 1, 'no death');
  const s2 = new W(g.level(spawns4(FR, [[7, FR - 1]]))); s2.hold(0, 'right');
  let td = 0, tp = 0; s2.step(200, q => { if (!td && q.w.phase === 'dead') { td = q.w.tick; check(q.w.deadSlot === 0, 'deadSlot'); q.rel(0); } if (td && !tp && q.w.phase === 'play') tp = q.w.tick; });
  check(td && tp - td === E.C.DEAD_TICKS, `dead phase lasted ${tp - td}`);
  check(s2.p(0).x === x0, 'not reset to spawn');
});

// ---------------------------------------------------------------- (j) spring
function springTo(h) {
  const FR = 14, FY = FR * T;
  const g = grid(40, 16, FR).set(10, FR - 1, '*').fill(11, FR - h, 39, FR - 1, '#');
  const s = new W(g.level(spawns4(FR)));
  s.place(0, 10 * T + 4, FY - 40); s.step(3); s.hold(0, 'right', 'jump'); s.step(120);
  return Math.abs(feet(s.p(0)) - (FY - h * T)) < 0.6 && s.p(0).x > 11 * T;
}
test('(j) spring reaches a 5-tile ledge, not 6', () => { check(springTo(5), 'spring failed 5'); check(!springTo(6), 'spring reached 6'); });

// ---------------------------------------------------------------- (k) color walls
test('(k) color walls pass only their owner', () => {
  const FR = 14;
  const g = grid(40, 16, FR).fill(20, FR - 3, 20, FR - 1, 'b');
  for (let slot = 0; slot < 4; slot++) {
    const sp = spawns4(FR); sp[slot] = [17, FR - 1];
    const s = new W(g.level(sp)); s.hold(slot, 'right'); s.step(80);
    const through = s.p(slot).x > 21 * T;
    check(through === (slot === 1), `slot ${slot} through=${through}`);
  }
  check(E.isSolidFor(new W(g.level(spawns4(FR)), [0, 2]).w, 20, FR - 1, 1) === true, 'absent slot wall must be solid');
});

// ---------------------------------------------------------------- (l)(m) tether & leash
test('(l) tether pulls the partner', () => {
  const FR = 14;
  const s = new W(grid(60, 16, FR).level(spawns4(FR, [[10, FR - 1], [12, FR - 1]]), { tether: true, tetherLength: 5 }), [0, 1]);
  const x0 = s.p(0).x; s.hold(1, 'right'); let mx = 0;
  s.step(200, q => { mx = Math.max(mx, Math.hypot(q.p(1).x - q.p(0).x, q.p(1).y - q.p(0).y)); });
  check(s.p(0).x - x0 > 100 && mx <= 160 + 4, `pulled ${s.p(0).x - x0}, max dist ${mx}`);
});
test('(m) leash blocks at LEASH_X', () => {
  const FR = 14;
  const s = new W(grid(96, 16, FR).level(spawns4(FR, [[45, FR - 1], [50, FR - 1]])), [0, 1]);
  s.hold(0, 'left'); s.hold(1, 'right'); let mx = 0;
  s.step(500, q => { mx = Math.max(mx, (q.p(1).x + 12) - (q.p(0).x + 12)); });
  check(mx <= 1280.001 && mx > 1275, `max distance ${mx}`);
});

// ---------------------------------------------------------------- (n)(o) snapshot & determinism
function scripted(lv, slots, n) {
  const w = E.createWorld(E.parseLevel(lv), { slots });
  for (let t = 0; t < n; t++) {
    const inp = [];
    for (const s of slots) inp[s] = { right: (t + s * 37) % 200 < 120, left: (t + s * 37) % 200 >= 150, jump: (t + s * 13) % 70 < 20, up: (t % 90) === 40, down: false };
    E.step(w, inp);
  }
  return w;
}
test('(n) snapshot/applySnapshot round trip, size < 3000 on example levels', () => {
  for (const id of ['0-1', '0-2']) {
    const lv = sim.find(id).json;
    const a = scripted(lv, [0, 1, 2, 3], 400);
    const snap = E.snapshot(a); const str = JSON.stringify(snap);
    check(str.length < 3000, `${id} snapshot ${str.length} bytes`);
    const b = E.createWorld(E.parseLevel(lv), { slots: [0, 1, 2, 3] });
    E.applySnapshot(b, JSON.parse(str));
    const s2 = JSON.stringify(E.snapshot(b));
    const strip = s => s.replace(/,"v":\[.*\]\}$/, '}');
    check(strip(s2) === strip(str), `${id} round trip differs`);
    check(b.tick === a.tick && b.phase === a.phase, 'tick/phase');
  }
});
test('(o) determinism: same script twice -> identical snapshot', () => {
  const lv = sim.find('0-2').json;
  check(JSON.stringify(E.snapshot(scripted(lv, [0, 1, 2, 3], 700))) === JSON.stringify(E.snapshot(scripted(lv, [0, 1, 2, 3], 700))), 'diverged');
});
test('sim.run: inline level + script, CLI helpers', () => {
  const FR = 14;
  // a 3-tile wall right of the hatch stops both walkers inside the hatch area
  const lv = grid(40, 16, FR).set(8, FR - 1, 'K').set(14, FR - 1, 'D').fill(15, FR - 3, 15, FR - 1, '#').level(spawns4(FR, [[3, FR - 1], [2, FR - 1]]));
  const script = [{ from: 0, to: 140, slot: 0, hold: ['right'] }, { from: 0, to: 140, slot: 1, hold: ['right'] }];
  // stop at the hatch: compute via each
  const r = sim.run(lv, { slots: [0, 1], ticks: 400, script: script.concat([{ at: 150, slot: 0, press: 'up' }, { at: 151, slot: 1, press: 'up' }]) });
  check(r.cleared && r.phase === 'clear' && r.deaths === 0 && r.log.some(e => e.t === 'enter'), `sim run: ${r.phase} cleared=${r.cleared}`);
});
test('perf: avg step < 0.3 ms (4 bots, 96x26 level with entities)', () => {
  const FR = 24;
  const g = grid(96, 26, FR).fill(40, 18, 50, 18, '-').fill(60, 20, 62, 23, '=').fill(70, 23, 75, 23, '>');
  const lv = g.level(spawns4(FR), { tether: true, entities: [
    { type: 'crate', x: 20, y: 23 }, { type: 'crate', x: 30, y: 22, w: 2, h: 2, need: 2 },
    { type: 'button', x: 12, y: 23, channel: 'A' }, { type: 'gate', x: 35, y: 20, h: 4, channel: 'A' },
    { type: 'platform', x: 52, y: 20, w: 3, path: [[52, 20], [52, 12]], need: 2 },
    { type: 'platform', x: 80, y: 15, w: 2, path: [[80, 15], [88, 15]] },
    { type: 'saw', x: 65, y: 10, path: [[65, 10], [70, 10]] }, { type: 'laser', x: 90, y: 5, dir: 'd', on: 60, off: 60 }] });
  scripted(lv, [0, 1, 2, 3], 300);
  const t0 = process.hrtime.bigint(); const N = 3000; scripted(lv, [0, 1, 2, 3], N);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  console.log(`       avg step ${ms.toFixed(4)} ms`);
  check(ms < 0.3, `avg step ${ms} ms`);
});

console.log(`\nengine smoke: ${pass} passed, ${failN} failed`);
console.log('##QA ' + JSON.stringify({ title: 'engine smoke', pass, fail: failN, skip: 0, results }));
process.exitCode = failN ? 1 : 0;
