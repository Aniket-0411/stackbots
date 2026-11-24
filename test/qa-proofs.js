#!/usr/bin/env node
'use strict';
// QA level proofs (owned by QA): sim checks of the key moves that the reachability heuristic cannot model or that
// depend on timing. Not part of test/run.js (level-specific: re-run after any level/engine change).
//   node test/qa-proofs.js            all proofs
//   node test/qa-proofs.js 7- 10-10   only proofs whose id starts with one of these prefixes
// Each line: PASS/FAIL <id> <what> : <evidence>. "x/y" = input variants that worked (robustness, not a pass ratio).
const fs = require('fs');
const path = require('path');
const { loadEngine, Sim, feet } = require('./qa-lib.js');
const { E, why } = loadEngine();
if (!E) { console.log('SKIP: ' + why); process.exit(0); }
const T = 32;
const LV = {};
const L = id => {
  if (!LV[id]) { const [w, i] = id.split('-').map(Number); LV[id] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'levels', `world${String(w).padStart(2, '0')}.json`), 'utf8')).levels[i - 1]; }
  return LV[id];
};
const only = process.argv.slice(2);
const proofs = [];
const P = (id, what, fn, min) => proofs.push({ id, what, fn, min: min === undefined ? 1 : min });

// ---- generic helpers ----
function haul(id, slots, A, D, a, d, dir, goalY, goalX, setup) { // reel, ease off, hop (world 7)
  let n = 0, ok = 0;
  for (const walk of [40, 70, 100, 140]) for (const back of [5, 10, 20, 30]) for (const tap of [10, 20]) {
    n++; const s = new Sim(E, L(id), slots); if (setup) setup(s);
    s.place(D, d[0], d[1]); s.place(A, a[0], a[1]); s.step(5);
    s.hold(A, dir); s.step(walk); s.release(A); s.hold(A, dir === 'right' ? 'left' : 'right'); s.step(back); s.release(A); s.step(30);
    s.hold(D, dir); let done = false;
    for (let t = 0; t < 200; t++) { if (t % (tap * 3) < tap) s.hold(D, 'jump'); else s.release(D, 'jump'); s.step(1); const p = s.p(D);
      if (p.onGround && feet(p) <= goalY + 0.5 && (dir === 'right' ? p.x >= goalX : p.x <= goalX)) { done = true; break; } if (s.w.phase !== 'play') break; }
    if (done && !s.deaths) ok++;
  }
  return [ok, n];
}
function well(id, slots, setup) { // anchor 0 on terrace edge col 10 (feet 288), diver 1 into col-13 well; then haul onto the lip
  let n = 0, ok = 0;
  for (const walk of [40, 60, 80, 100, 130]) for (const back of [0, 10, 20]) {
    n++; const s = new Sim(E, L(id), slots); if (setup) setup(s);
    s.place(0, 10 * T + 6, 288); s.place(1, 12 * T + 4, 320); s.step(3);
    s.hold(1, 'right'); s.step(40); s.release(1); s.step(60);
    const got = s.w.key && s.w.key.holder === 1;
    s.hold(0, 'left'); s.step(walk); s.release(0); if (back) { s.hold(0, 'right'); s.step(back); s.release(0); }
    s.step(80); s.releaseAll(); s.step(30);
    const p = s.p(1); if (got && !s.deaths && p.onGround && feet(p) <= 320.5 && p.x < 13 * T) ok++;
  }
  return [ok, n];
}

// ---- world 2 ----
P('2-3', 'one 2-wide crate pushed right drops into trench 1 and paves it (fixed soft-lock)', () => {
  const s = new Sim(E, L('2-3'), [0, 1]); s.hold(1, 'right'); s.step(280); s.releaseAll(); s.step(40);
  const c = s.ents('crate')[0]; const ok = !s.deaths && c.y >= 13 * T - 1 && c.x >= 15 * T - 1 && c.x <= 17 * T;
  return [ok ? 1 : 0, 1, `crate at ${(c.x / T).toFixed(1)},${(c.y / T).toFixed(1)}`];
});
// ---- world 4 ----
P('4-5', '4-tower (pair on pair) hops onto the 1-wide need-4 lift and rides to the top', () => {
  let ok = 0, n = 0;
  for (const x0 of [12 * T - 4, 12 * T + 2, 12 * T + 6]) for (const hold of [6, 14]) {
    n++; const s = new Sim(E, L('4-5'), [0, 1, 2, 3]);
    s.place(0, x0, 608); s.place(1, x0, 578); s.place(2, x0 - 80, 608); s.place(3, x0 - 80, 578); s.step(5);
    s.hold(2, 'right', 'jump'); for (let t = 0; t < 60; t++) { s.step(1); if (s.p(2).x >= x0 - 6) s.release(2, 'right'); } s.release(2); s.step(20);
    s.hold(0, 'jump', 'right'); s.step(hold); s.release(0, 'jump'); for (let k = 0; k < 40; k++) { s.step(1); if (s.p(0).x >= 13 * T + 2) s.release(0, 'right'); }
    s.release(0); s.step(430);
    if (!s.deaths && s.w.players.every(p => feet(p) <= 8 * T + 1)) ok++;
  }
  return [ok, n];
});
P('4-6', 'crate pushed onto the need-4 elevator rides up and counts as a rider', () => {
  const s = new Sim(E, L('4-6'), [0, 1, 2, 3]);
  s.place(0, 6 * T, 608); s.place(1, 7 * T + 4, 608); s.place(2, 3 * T, 608); s.place(3, 4 * T, 608);
  s.hold(0, 'right').hold(1, 'right'); s.step(300); s.releaseAll(); s.hold(2, 'right').hold(3, 'right'); s.step(200); s.releaseAll(); s.step(500);
  const c = s.ents('crate')[0], pl = s.ents('platform')[0];
  return [pl.y <= 9 * T + 0.5 && c.y + c.h <= pl.y + 0.6 && !s.deaths ? 1 : 0, 1, `platform row ${(pl.y / T).toFixed(1)}, crate row ${(c.y / T).toFixed(1)}`];
});
// ---- world 6 ----
for (const id of ['6-4', '6-10']) P(id, '2-stack spring pogo puts the rider on the 6-high slab', () => {
  const lv = L(id), floorY = id === '6-4' ? 512 : 576, slabY = floorY - 192;
  let ok = 0, n = 0;
  for (const d of [24, 30, 40, 50, 60]) {
    n++; const s = new Sim(E, lv, [0, 1]); s.place(0, 11 * T + 4, floorY); s.place(1, 11 * T + 4, floorY - 30);
    for (let t = 0; t < 300; t++) { if (t < 200) s.hold(0, 'right'); else s.release(0, 'right'); if (t >= d && t < 250) s.hold(1, 'right'); else s.release(1, 'right'); s.step(1);
      const p = s.p(1); if (p.onGround && Math.abs(feet(p) - slabY) < 1 && p.x >= 15 * T - 12) { ok++; break; } if (s.w.phase !== 'play') break; }
  }
  return [ok, n];
});
// ---- world 7 ----
P('7-2', 'well haul: diver grabs the cell, anchor reels it onto the lip', () => well('7-2', [0, 1]));
P('7-9', 'lid fishing: holder on button, diver grabs cell, anchor reels it out', () => well('7-9', [0, 1, 2], s => s.place(2, 11 * T + 4, 320)));
P('7-10', 'stage 1 well haul', () => well('7-10', [0, 1]));
P('7-3', 'heave-ho up the 3-high wall (reel, ease off, hop)', () => haul('7-3', [0, 1], 1, 0, [18 * T + 4, 384], [16 * T - 26, 512], 'right', 384, 18 * T - 8));
P('7-5', 'heave-ho at the 3-high shelf', () => haul('7-5', [0, 1], 1, 0, [39 * T + 4, 352], [37 * T - 26, 480], 'right', 352, 39 * T - 8));
P('7-10', 'stage 3 heave-ho up the cliff', () => haul('7-10', [0, 1], 1, 0, [40 * T + 4, 192], [38 * T - 26, 320], 'right', 192, 40 * T - 8));
P('7-7', 'plate holder hauled out of the 3-deep pit and past the timer gate', () => haul('7-7', [0, 1], 0, 1, [20 * T, 352], [16 * T, 480], 'right', 352, 19 * T - 4));
P('7-6', 'two roped 2-stacks cross the 14-wide crumble bridge back to back', () => {
  let ok = 0, n = 0;
  for (const gap of [0, 16, 40]) { n++; const s = new Sim(E, L('7-6'), [0, 1, 2, 3]);
    s.place(0, 12 * T, 384); s.place(1, 12 * T, 354); s.place(2, 12 * T - 24 - gap, 384); s.place(3, 12 * T - 24 - gap, 354); s.step(5);
    s.hold(0, 'right'); s.hold(2, 'right');
    for (let t = 0; t < 400; t++) { s.step(1); if (s.w.phase !== 'play') break; if (s.w.players.every(p => p.x > 28 * T)) { ok++; break; } } }
  return [ok, n];
});
P('7-8', 'all four ride the 2-wide lever ferry (lever bot hops on last)', () => {
  let ok = 0, n = 0;
  for (const d of [0, 10, 20]) { n++; const s = new Sim(E, L('7-8'), [0, 1, 2, 3]);
    s.place(0, 12 * T, 384); s.place(1, 12 * T, 354); s.place(2, 13 * T + 8, 384); s.place(3, 11 * T + 4, 384); s.step(5);
    s.press(3, 'up'); s.step(1 + d); s.hold(3, 'right', 'jump'); s.step(14); s.release(3, 'jump');
    for (let t = 0; t < 60; t++) { s.step(1); if (s.p(3).x >= s.p(2).x) s.release(3, 'right'); } s.releaseAll();
    for (let t = 0; t < 500; t++) { s.step(1); if (s.w.phase !== 'play' || s.ents('platform')[0].x >= 20 * T) break; }
    if (!s.deaths && s.ents('platform')[0].x >= 20 * T && s.w.players.every(p => feet(p) <= 12 * T + 1)) ok++; }
  return [ok, n];
});
// ---- world 9 ----
P('9-5', 'single bot in the pit survives the beam; a 2-stack top bot does not', () => {
  const a = new Sim(E, L('9-5'), [0, 1]); a.place(0, 12 * T + 4, 448); a.place(1, 14 * T + 4, 448); a.step(400);
  const b = new Sim(E, L('9-5'), [0, 1]); b.place(0, 14 * T + 4, 448); b.place(1, 14 * T + 4, 418); b.step(5);
  return [a.deaths === 0 && b.deaths === 1 ? 1 : 0, 1, `singles deaths ${a.deaths}, stack deaths ${b.deaths}`];
});
P('9-6', 'two 2-stacks cross the crumble and pass the laser door within the 300-tick timer', () => {
  let ok = 0, n = 0;
  for (const build of [30, 60]) { n++; const s = new Sim(E, L('9-6'), [0, 1, 2, 3]);
    [5, 6, 7, 8].forEach((c, i) => s.place(i, c * T + 4, 13 * T)); s.step(10);
    s.place(0, 8 * T + 4, 13 * T); s.place(1, 8 * T + 4, 13 * T - 30); s.place(2, 7 * T - 2, 13 * T); s.place(3, 7 * T - 2, 13 * T - 30); s.step(build);
    for (let t = 0; t < 400; t++) { s.hold(0, 'right'); s.hold(2, 'right'); s.step(1); if (s.w.phase !== 'play') break; if (s.w.players.every(p => p.x > 21 * T)) { ok++; break; } } }
  return [ok, n];
});
P('9-10', '3-tower climb under the sweeping saw latches A (start-delay variants)', () => {
  let ok = 0, n = 0;
  for (let wait = 0; wait < 460; wait += 20) { n++; const s = new Sim(E, L('9-10'), [0, 1, 2, 3]); [0, 1, 2].forEach(k => s.place(k, 15 * T - 2, 640 - 30 * k)); s.step(2 + wait);
    if (s.deaths) continue; s.hold(2, 'jump', 'right'); for (let t = 0; t < 90; t++) { s.step(1); if (s.w.phase !== 'play') break; } s.release(2); s.step(20);
    if (!s.deaths && s.ents('button')[0].on) ok++; }
  return [ok, n];
}, 8);
P('9-10', 'need-3 lift ride through the blinking beam (boarding-tick variants)', () => {
  let ok = 0, n = 0;
  for (let b = 0; b < 240; b += 15) { n++; const s = new Sim(E, L('9-10'), [0, 1, 2, 3]); s.place(3, 24 * T, 512); s.step(b);
    s.place(0, 18 * T + 2, 640); s.place(1, 19 * T + 4, 640); s.place(2, 20 * T + 6, 640); for (let t = 0; t < 200; t++) { s.step(1); if (s.w.phase !== 'play') break; } if (!s.deaths) ok++; }
  return [ok, n];
}, 4);
// ---- world 10 ----
P('10-5', 'each colour lane is passable solo (lane b with wait-for-OFF)', () => {
  const lanes = [[0, 224, 'a'], [1, 352, 'b'], [2, 480, 'c'], [3, 608, 'd']]; const res = [];
  let all = 1;
  for (const [slot, fy, ch] of lanes) { let ok = 0;
    for (let delay = 0; delay < 400; delay += 20) { const s = new Sim(E, L('10-5'), [0, 1, 2, 3]); s.place(slot, 11 * T + 4, fy); s.step(1 + delay);
      const Ls = s.ents('laser'); const off = [0, 0, 0]; let jt = 0, done = false;
      for (let t = 0; t < 1500; t++) { const p = s.p(slot); let go = true;
        if (ch === 'b') { Ls.forEach((l, i) => { off[i] = l.beamOn ? 0 : off[i] + 1; if (p.x + 24 > l.x - 10 && p.x < l.x + 4 && !(off[i] > 0 && off[i] < 55)) go = false; }); }
        if (ch === 'c') for (const bc of [21, 27, 33]) if (p.onGround && p.x + 24 > bc * T - 14 && p.x + 24 < bc * T) { s.hold(slot, 'jump'); jt = 14; }
        if (jt > 0 && --jt === 0) s.release(slot, 'jump');
        if (go) s.hold(slot, 'right'); else s.release(slot, 'right');
        s.step(1); if (s.w.phase !== 'play') break; if (s.p(slot).x > 42 * T) { done = true; break; } }
      if (done) ok++; }
    res.push(`${ch}:${ok}/20`); if (!ok) all = 0; }
  return [all, 1, res.join(' ')];
});
P('10-8', 'lever-lift straight ride survives the two blinking beams (flip-tick window)', () => {
  let ok = 0, n = 0;
  for (let st = 0; st < 240; st += 8) { n++; const s = new Sim(E, L('10-8'), [0, 1, 2, 3]);
    s.place(0, 18 * T + 4, 768); s.place(1, 19 * T + 4, 768); s.place(2, 20 * T + 4, 768); s.place(3, 12 * T + 4, 768); s.step(st + 1); s.press(3, 'up'); s.step(1);
    for (let t = 0; t < 700; t++) { s.step(1); if (s.w.phase !== 'play' || s.ents('platform')[0].y <= 5 * T) break; }
    if (s.w.phase === 'play' && s.ents('platform')[0].y <= 5 * T) ok++; }
  return [ok, n];
}, 5);
P('10-9', 'KNOWN ISSUE: gear (54,11) reachable by running/jumping off the upper track (expect 0)', () => {
  let ok = 0, n = 0;
  for (const start of [46, 48, 50]) for (const jumpAt of [-1, 0, 4, 8]) for (const brake of [0, 6, 12]) {
    n++; const s = new Sim(E, L('10-9'), [0, 1]); s.place(0, start * T, 288); s.place(1, 2 * T, 608); s.step(3); s.hold(0, 'right'); let left = false, t0 = 0;
    for (let t = 0; t < 200; t++) { if (!left && s.p(0).x >= 51 * T - 16) { left = true; t0 = t; } if (left && t === t0 + jumpAt) s.press(0, 'jump'); if (left && brake && t === t0 + brake) s.release(0, 'right');
      s.step(1); if (s.w.gears.some(g => g.taken && Math.abs(g.x - (54 * T + 16)) < 1)) { ok++; break; } if (s.w.phase !== 'play') break; } }
  return [ok, n];
}, 0);
P('10-10', '4-tower by pair-on-pair under the walkway; top bot latches A (no mid-air swap needed)', () => {
  let ok = 0, n = 0;
  for (const x0 of [12 * T, 13 * T + 4]) for (const runup of [40, 60, 80]) { n++; const s = new Sim(E, L('10-10'), [0, 1, 2, 3]);
    s.place(0, x0, 768); s.place(1, x0, 738); s.place(2, x0 - runup - 24, 768); s.place(3, x0 - runup - 24, 738); s.step(5);
    s.hold(2, 'right', 'jump'); for (let t = 0; t < 50; t++) { s.step(1); if (s.p(2).x >= x0 - 4) s.release(2, 'right'); } s.release(2); s.step(30);
    s.hold(3, 'jump'); s.step(30); s.release(3); s.step(20); s.hold(3, 'right'); s.step(150); s.release(3); s.step(10);
    if (!s.deaths && s.ents('button')[0].on) ok++; }
  return [ok, n];
});
P('10-10', 'saw-lined need-4 lift: 3 side by side in cols 45-47 + 1 on a head, no deaths', () => {
  let ok = 0, n = 0;
  for (const top of [0, 1, 2]) { n++; const s = new Sim(E, L('10-10'), [0, 1, 2, 3]);
    s.place(0, 45 * T + 4, 512); s.place(1, 46 * T + 4, 512); s.place(2, 47 * T + 4, 512); s.place(3, s.p(top).x, 482); s.step(400);
    if (!s.deaths && s.ents('platform')[0].y <= 6 * T + 0.5) ok++; }
  return [ok, n];
});

// ---- run ----
let fails = 0;
for (const pr of proofs) {
  if (only.length && !only.some(o => pr.id.startsWith(o))) continue;
  let r; try { r = pr.fn(); } catch (e) { r = [0, 1, 'CRASH ' + e.message]; }
  const [ok, n, note] = r;
  const pass = pr.min === 0 ? ok === 0 : ok >= pr.min;
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${pr.id.padEnd(6)} ${pr.what} : ${ok}/${n}${note ? ' ' + note : ''}`);
}
console.log(fails ? `\n${fails} proof(s) FAILED` : '\nall proofs passed');
process.exitCode = fails ? 1 : 0;
