'use strict';
// Independent acceptance tests of src/engine.js against SPEC §3-§6 and §9 (owned by QA).
// Each test builds a tiny synthetic level inline. Tests encode the SPEC; if the engine disagrees, the test FAILS.
// Run: node test/mechanics.test.js      (QA_ONLY=regex to run a subset)
const fs = require('fs');
const { loadEngine, makeRunner, fail, check, near, MapB, Sim, feet, cx, fmtP, r1, snapSize, ENGINE_PATH } = require('./qa-lib.js');

const R = makeRunner('mechanics (SPEC §3-§6, §9)');
const { E, why } = loadEngine();
if (!E) R.skipAll(why);

const T = 32;
const mk = (w, h, fr) => new MapB(w || 40, h || 16, fr);
const S = (mb, slots, extra) => new Sim(E, mb.level(extra), slots || [0, 1, 2, 3]);
const FR = 14, FY = FR * T; // default floor row / floor top for 16-row maps

// place slots bottom->top as a tower at x on floor y
function tower(s, slots, x, floorY) { slots.forEach((sl, i) => s.place(sl, x, floorY - 30 * i)); }
function assertTower(s, slots, what) {
  for (let i = 1; i < slots.length; i++) {
    const lo = s.p(slots[i - 1]), hi = s.p(slots[i]);
    if (Math.abs(feet(hi) - lo.y) > 0.6 || Math.abs(hi.x - lo.x) > 12) fail(`${what}: could not build a ${slots.length}-bot tower by placing bots (engine moved them): ${slots.map(q => fmtP(s.p(q))).join(' ; ')}`);
  }
}
const dead = s => s.w.phase === 'dead' || s.deaths > 0;
const onTop = (p, topY, minCx) => Math.abs(feet(p) - topY) < 0.6 && cx(p) > minCx;
const ev = (s, t) => s.events.filter(e => e.t === t);

// ======================================================================================
// §9 API surface
// ======================================================================================
R.test('API: Engine exposes C, parseLevel, createWorld, reset, step, snapshot, applySnapshot, tileAt, isSolidFor', () => {
  const missing = ['parseLevel', 'createWorld', 'reset', 'step', 'snapshot', 'applySnapshot', 'tileAt', 'isSolidFor'].filter(k => typeof E[k] !== 'function');
  check(!missing.length, `missing functions: ${missing.join(', ')}`);
  check(E.C && typeof E.C === 'object', 'Engine.C missing');
});

R.test('API: Engine.C matches SPEC §3 constants', () => {
  const want = { T: 32, PW: 24, PH: 30, GRAVITY: 0.55, MAX_FALL: 12, RUN: 2.6, ACC_GROUND: 0.5, DEC_GROUND: 0.6, ACC_AIR: 0.35, JUMP_V: -9.6, JUMP_CUT: -4, COYOTE: 4, JUMP_BUFFER: 6, SPRING_V: -14, CRATE_SPEED: 1.2, CONVEYOR: 1.4, PLATFORM_SPEED: 1.0, DEAD_TICKS: 60, CLEAR_TICKS: 120, LEASH_X: 1280 };
  const bad = Object.keys(want).filter(k => E.C[k] !== want[k]).map(k => `${k}: expected ${want[k]}, actual ${E.C[k]}`);
  check(!bad.length, bad.join('; '));
});

R.test('API: parseLevel throws Error("<id>: <problem>") for an invalid level (no hatch)', () => {
  const lv = mk().level({ id: '9-9' });
  lv.map = lv.map.map(r => r.replace('D', '.'));
  let err = null;
  try { E.parseLevel(lv); } catch (e) { err = e; }
  check(err instanceof Error, 'parseLevel accepted a level without a hatch D');
  check(String(err.message).startsWith('9-9:'), `error message should start with "9-9:", got "${err.message}"`);
});

R.test('API: createWorld initial state (spawn positions §4, phase play, players per slot)', () => {
  const mb = mk(); mb.set(30, FR - 1, 'D').sp(0, 5, FR - 1).sp(1, 7, FR - 1).sp(2, 9, FR - 1).sp(3, 11, FR - 1);
  const s = S(mb, [0, 2]);
  check(s.w.phase === 'play', `phase ${s.w.phase}`);
  check(s.w.players.length === 2, `expected 2 players for slots [0,2], got ${s.w.players.length}`);
  for (const [sl, c] of [[0, 5], [2, 9]]) {
    const p = s.p(sl);
    near(p.x, T * c + 4, 0.01, `slot ${sl} spawn x`); near(p.y, T * (FR - 1) + 2, 0.01, `slot ${sl} spawn y`);
    check(p.w === 24 && p.h === 30, `hitbox ${p.w}x${p.h}, expected 24x30`);
    check(p.state === 'active', `state ${p.state}`);
  }
  check(s.w.door && s.w.door.open === true, 'level without K: hatch should start unlocked (door.open true)');
  near(s.w.door.x, 30 * T, 0.01, 'door.x px'); near(s.w.door.y, (FR - 2) * T, 0.01, 'door.y px (top of 2-tall hatch)');
});

R.test('API: tileAt / isSolidFor basics (out of bounds: sides solid, sky empty)', () => {
  const mb = mk(); mb.set(30, FR - 1, 'D').set(12, FR - 1, 'a').set(13, FR - 1, '-');
  const s = S(mb, [0, 1, 2, 3]);
  check(E.tileAt(s.w, 0, FR) === '#', `tileAt floor = ${E.tileAt(s.w, 0, FR)}`);
  check(E.tileAt(s.w, 13, FR - 1) === '-', `tileAt one-way = ${E.tileAt(s.w, 13, FR - 1)}`);
  check(E.isSolidFor(s.w, -1, 5, 0) === true, 'column -1 must be solid');
  check(E.isSolidFor(s.w, 40, 5, 0) === true, 'column == cols must be solid');
  check(!E.isSolidFor(s.w, 5, -3, 0), 'row < 0 must be empty sky');
  check(E.isSolidFor(s.w, 12, FR - 1, 0) === false, "'a' must be passable for slot 0");
  check(E.isSolidFor(s.w, 12, FR - 1, 1) === true, "'a' must be solid for slot 1");
  check(E.isSolidFor(s.w, 12, FR - 1, -1) === true, "'a' must be solid for crates (slot -1)");
});

// ======================================================================================
// Movement basics
// ======================================================================================
R.test('run: max horizontal speed RUN=2.6 px/tick', () => {
  const mb = mk(60); mb.set(55, FR - 1, 'D').sp(0, 3, FR - 1);
  const s = S(mb, [0, 1]);
  s.hold(0, 'right'); s.step(40);
  const x0 = s.p(0).x; s.step(20);
  near((s.p(0).x - x0) / 20, 2.6, 0.01, 'px/tick after 40 ticks of holding right');
});

R.test('jump: apex ≈ 83.8 px (full hold), JUMP_CUT gives a short hop on tap', () => {
  const run = (holdTicks) => {
    const mb = mk(); mb.set(30, FR - 1, 'D').sp(0, 10, FR - 1);
    const s = S(mb, [0, 1]); s.step(3);
    const y0 = feet(s.p(0)); let best = 0;
    const m = () => { best = Math.max(best, y0 - feet(s.p(0))); };
    s.hold(0, 'jump'); s.step(holdTicks, m); s.release(0);
    s.step(60, m);
    return Math.max(best, 0);
  };
  const full = run(60), tap = run(1);
  check(full >= 78 && full <= 90, `full jump apex ${r1(full)} px, expected ≈ 83.8 (78..90)`);
  check(tap < 40, `tapped jump apex ${r1(tap)} px, expected a short hop (JUMP_CUT) < 40`);
});

R.test('Up = jump when nothing to interact with; holding Up = holding jump', () => {
  const mb = mk(); mb.set(30, FR - 1, 'D').sp(0, 10, FR - 1);
  const s = S(mb, [0, 1]); s.step(3);
  const y0 = feet(s.p(0)); let best = 0;
  s.hold(0, 'up'); s.step(60, () => { best = Math.max(best, y0 - feet(s.p(0))); });
  check(best >= 78, `holding Up rose only ${r1(best)} px (expected full jump ≈ 83.8)`);
});

R.test('coyote time: jump 3 ticks after leaving a ledge works, 8 ticks after does not', () => {
  const trial = (k) => {
    const mb = mk(40, 18, 16); mb.fill(0, 12, 14, 15, '#'); mb.set(35, 15, 'D').sp(0, 10, 11);
    const s = S(mb, [0, 1]); s.step(2);
    s.hold(0, 'right');
    let off = -1;
    for (let i = 0; i < 200 && off < 0; i++) { s.step(1); if (!s.p(0).onGround && s.p(0).x > 14 * T) off = s.tick; }
    check(off > 0, 'bot never left the ledge');
    s.step(k - 1);
    const vyBefore = s.p(0).vy;
    s.hold(0, 'jump'); s.step(1);
    return { vy: s.p(0).vy, vyBefore };
  };
  const a = trial(3), b = trial(8);
  check(a.vy < -5, `jump 3 ticks after leaving ground: vy=${r1(a.vy)} (expected a jump, vy ≈ -9)`);
  check(b.vy > 0, `jump 8 ticks after leaving ground: vy=${r1(b.vy)} (expected no jump, still falling)`);
});

R.test('jump buffer: press 3 ticks before landing jumps on landing; press 12 ticks before does not', () => {
  const build = () => { const mb = mk(); mb.set(30, FR - 1, 'D').sp(0, 10, FR - 1); const s = S(mb, [0, 1]); s.step(2); s.place(0, 10 * T + 4, FY - 100); return s; };
  const dry = build(); let land = -1;
  for (let i = 0; i < 120 && land < 0; i++) { dry.step(1); if (dry.p(0).onGround) land = i + 1; }
  check(land > 5, `bot dropped from 100px never landed (land=${land})`);
  const trial = (before) => {
    const s = build(); s.step(land - before); s.hold(0, 'jump');
    let rose = 0, landed = false; const y0 = FY;
    s.step(before + 30, () => { if (s.p(0).onGround || feet(s.p(0)) >= y0 - 0.5) landed = true; if (landed) rose = Math.max(rose, y0 - feet(s.p(0))); });
    return rose;
  };
  const a = trial(3), b = trial(12);
  check(a > 40, `jump pressed 3 ticks before landing: rose ${r1(a)} px after landing (expected buffered jump)`);
  check(b < 5, `jump pressed 12 ticks before landing (held): rose ${r1(b)} px (buffer is 6 ticks; expected no jump)`);
});

// ======================================================================================
// §3.1 design rules: climbing & gaps
// ======================================================================================
function climbTrial(height, helpers) {
  const fr = 16, cw = 20;
  const mb = new MapB(40, 18, fr);
  mb.fill(cw, fr - height, 39, fr - 1, '#');
  mb.set(35, fr - height - 1, 'D');
  for (let i = 0; i < 4; i++) mb.sp(i, 2 + i * 2, fr - 1);
  const s = S(mb, [0, 1, 2, 3]);
  const slots = [...Array(helpers + 1).keys()];
  tower(s, slots, cw * T - 24 - 0.5, fr * T);
  for (const sl of slots) s.hold(sl, 'right');
  s.step(20);
  assertTower(s, slots, `climb ${height} with ${helpers} helper(s)`);
  const top = slots[slots.length - 1];
  s.hold(top, 'jump'); s.step(110);
  s.releaseAll(); s.step(40);
  return { ok: onTop(s.p(top), (fr - height) * T, cw * T + 2) && !dead(s), p: fmtP(s.p(top)) };
}
for (const [h, k, yes] of [[2, 0, true], [3, 0, false], [3, 1, true], [4, 1, false], [4, 2, true], [5, 2, false], [5, 3, true], [6, 3, false]]) {
  R.test(`climb: ${h}-tile wall with ${k} bot(s) stacked below -> ${yes ? 'possible' : 'impossible'}`, () => {
    const r = climbTrial(h, k);
    check(r.ok === yes, `expected ${yes ? 'to reach' : 'NOT to reach'} the top of a ${h}-tile wall with a ${k + 1}-bot tower; jumper ended: ${r.p}`);
  });
}

function gapTrial(g, k) {
  const L = 20, mb = new MapB(48, 16, FR);
  mb.fill(L, FR, L + g - 1, 15, '.');
  mb.set(44, FR - 1, 'D').sp(0, 12, FR - 1).sp(1, 2, FR - 1);
  const s = S(mb, [0, 1]);
  s.hold(0, 'right');
  let trig = false;
  s.step(260, (q) => {
    if (!trig && q.p(0).x >= L * T - 24 + k) { trig = true; q.hold(0, 'jump'); }
    if (dead(q)) return false;
  });
  const p = s.p(0);
  return !dead(s) && Math.abs(feet(p) - FY) < 0.6 && cx(p) > (L + g) * T;
}
R.test('gap: a 3-tile gap can be jumped (some takeoff timing works)', () => {
  const ks = []; for (let k = -40; k <= 20; k++) if (gapTrial(3, k)) ks.push(k);
  check(ks.length > 0, 'no takeoff timing in -40..+20 px around the edge cleared a 3-tile gap');
});
R.test('gap: a 4-tile gap cannot be jumped (no takeoff timing works, even with coyote)', () => {
  const ks = []; for (let k = -40; k <= 20; k++) if (gapTrial(4, k)) ks.push(k);
  check(ks.length === 0, `a 4-tile gap was cleared with takeoff offsets ${ks.join(',')} px (SPEC §3.1: 4+ cannot be jumped)`);
});

// ======================================================================================
// Bots solid to each other / stacking
// ======================================================================================
R.test('bots: horizontal contact blocks, no shoving', () => {
  const mb = mk(); mb.set(35, FR - 1, 'D').sp(0, 5, FR - 1).sp(1, 12, FR - 1);
  const s = S(mb, [0, 1]);
  const x1 = s.p(1).x;
  s.hold(0, 'right'); s.step(120);
  near(s.p(1).x, x1, 0.01, 'idle bot x after being walked into');
  check(s.p(0).x + s.p(0).w <= s.p(1).x + 0.01, `walker overlaps idle bot: ${fmtP(s.p(0))} / ${fmtP(s.p(1))}`);
  check(s.p(0).x + s.p(0).w > s.p(1).x - 1, `walker stopped early: ${fmtP(s.p(0))}`);
});

R.test('stacking: rider is carried by a walking support (same dx, stays on top)', () => {
  const mb = mk(50); mb.set(45, FR - 1, 'D').sp(0, 5, FR - 1).sp(1, 3, FR - 1);
  const s = S(mb, [0, 1]);
  tower(s, [0, 1], 10 * T, FY); s.step(10); assertTower(s, [0, 1], 'rider');
  const off = s.p(1).x - s.p(0).x;
  s.hold(0, 'right'); let worst = 0, worstY = 0;
  s.step(80, () => { worst = Math.max(worst, Math.abs(s.p(1).x - s.p(0).x - off)); worstY = Math.max(worstY, Math.abs(feet(s.p(1)) - s.p(0).y)); });
  check(s.p(0).x > 10 * T + 100, `support did not walk (${fmtP(s.p(0))})`);
  check(worst < 0.5, `rider slipped ${r1(worst)} px relative to the walking support`);
  check(worstY < 0.6, `rider lost contact with the support (max gap ${r1(worstY)} px)`);
});

R.test('stacking: 4-bot tower is stable for 600 idle ticks (no drift)', () => {
  const mb = mk(); mb.set(35, FR - 1, 'D');
  const s = S(mb, [0, 1, 2, 3]);
  tower(s, [0, 1, 2, 3], 18 * T, FY); s.step(20); assertTower(s, [0, 1, 2, 3], '4-tower');
  const before = s.w.players.map(p => [p.slot, p.x, p.y]);
  s.step(600);
  check(!dead(s), 'a death happened');
  const bad = before.map(([sl, x, y]) => { const p = s.p(sl); return (Math.abs(p.x - x) > 0.01 || Math.abs(p.y - y) > 0.01) ? `slot${sl} moved (${r1(x)},${r1(y)})->(${r1(p.x)},${r1(p.y)})` : null; }).filter(Boolean);
  check(!bad.length, bad.join('; '));
});

R.test('stacking: stack jump carries the rider up', () => {
  const mb = mk(); mb.set(35, FR - 1, 'D');
  const s = S(mb, [0, 1]);
  tower(s, [0, 1], 18 * T, FY); s.step(10); assertTower(s, [0, 1], 'stack jump');
  const y1 = feet(s.p(1)); let rise = 0, overlap = 0;
  s.hold(0, 'jump');
  s.step(70, () => { rise = Math.max(rise, y1 - feet(s.p(1))); overlap = Math.max(overlap, feet(s.p(1)) - s.p(0).y); });
  s.release(0); s.step(30);
  check(rise > 60, `rider rose only ${r1(rise)} px when its support jumped (expected ≈ 84)`);
  check(overlap < 0.6, `rider and support interpenetrated by ${r1(overlap)} px`);
  check(Math.abs(feet(s.p(1)) - s.p(0).y) < 0.6, `rider not back on the support after landing: ${fmtP(s.p(1))} / ${fmtP(s.p(0))}`);
});

R.test('stacking: stack jump stops when the top hits a ceiling (no overlap, no death)', () => {
  const mb = mk(); mb.set(35, FR - 1, 'D'); mb.fill(14, 10, 24, 10, '#'); // ceiling bottom y = 352, 96 px above floor
  const s = S(mb, [0, 1]);
  tower(s, [0, 1], 18 * T, FY); s.step(10); assertTower(s, [0, 1], 'ceiling');
  let minTop = 1e9, rise = 0, overlap = 0; const y1 = s.p(1).y;
  s.hold(0, 'jump');
  s.step(70, () => { minTop = Math.min(minTop, s.p(1).y); rise = Math.max(rise, y1 - s.p(1).y); overlap = Math.max(overlap, feet(s.p(1)) - s.p(0).y); });
  check(!dead(s), 'death');
  check(minTop >= 11 * T - 0.5, `rider's head went into the ceiling (top y ${r1(minTop)} < ${11 * T})`);
  check(overlap < 0.6, `rider and support interpenetrated by ${r1(overlap)} px under the ceiling`);
  check(rise > 20, `stack only rose ${r1(rise)} px (expected to rise ~36 px until the ceiling)`);
});

R.test('bots fit through a gap exactly 1 tile tall', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').fill(16, 0, 22, FR - 2, '#').sp(0, 10, FR - 1).sp(1, 2, FR - 1);
  const s = S(mb, [0, 1]); s.hold(0, 'right'); s.step(220);
  check(s.p(0).x > 23 * T, `bot did not get through a 1-tile-tall tunnel: ${fmtP(s.p(0))}`);
});

// ======================================================================================
// Crates
// ======================================================================================
function crateMap(opts) {
  const mb = mk(48); mb.set(46, FR - 1, 'D');
  const ents = opts.crates || [{ type: 'crate', x: 16, y: FR - 1, need: opts.need || 1 }];
  ents.forEach(e => mb.ent(Object.assign({ type: 'crate' }, e)));
  return mb;
}
const crates = s => s.ents('crate');
R.test('crate: need 2 -> one pusher cannot move it (4 bots in game)', () => {
  const mb = crateMap({ need: 2 }); mb.sp(0, 14, FR - 1);
  const s = S(mb, [0, 1, 2, 3]); const x0 = crates(s)[0].x;
  check(Math.abs(x0 - 16 * T) < 0.01, `crate.x should be in px (${16 * T}), got ${x0}`);
  s.hold(0, 'right'); s.step(90);
  near(crates(s)[0].x, x0, 0.5, 'crate x with 1 pusher (need 2)');
});
R.test('crate: need 2 -> a chain of two pushers moves it at CRATE_SPEED 1.2', () => {
  const mb = crateMap({ need: 2 }); mb.sp(0, 12, FR - 1).sp(1, 14, FR - 1);
  const s = S(mb, [0, 1, 2, 3]);
  s.hold(0, 'right').hold(1, 'right'); s.step(50);
  const x0 = crates(s)[0].x; s.step(60);
  const v = (crates(s)[0].x - x0) / 60;
  near(v, 1.2, 0.05, 'crate speed px/tick with 2 chained pushers');
});
R.test('crate: need clamps to bot count (need 4, 2 bots in game -> 2 pushers move it)', () => {
  const mb = crateMap({ need: 4 }); mb.sp(0, 12, FR - 1).sp(1, 14, FR - 1);
  const s = S(mb, [0, 1]); const x0 = crates(s)[0].x;
  s.hold(0, 'right').hold(1, 'right'); s.step(110);
  check(crates(s)[0].x - x0 > 40, `crate moved ${r1(crates(s)[0].x - x0)} px with 2 pushers, need 4 clamped to 2 bots`);
});
R.test('crate: a bot standing on a pushed crate rides along', () => {
  const mb = crateMap({ need: 1 }); mb.sp(0, 14, FR - 1).sp(1, 5, FR - 1);
  const s = S(mb, [0, 1]);
  s.place(1, 16 * T + 4, FY - T); s.step(10);
  check(Math.abs(feet(s.p(1)) - (FY - T)) < 0.6, `could not place bot on the crate: ${fmtP(s.p(1))}`);
  const off = s.p(1).x - crates(s)[0].x;
  s.hold(0, 'right'); s.step(100);
  const moved = crates(s)[0].x - 16 * T;
  check(moved > 40, `crate did not move (${r1(moved)} px)`);
  near(s.p(1).x - crates(s)[0].x, off, 0.6, 'rider offset on moving crate');
});
R.test('crate: falls off a ledge with gravity and lands on the floor below', () => {
  const mb = crateMap({ crates: [{ x: 17, y: 10 }] }); mb.fill(0, 11, 19, 13, '#'); mb.sp(0, 14, 10).sp(1, 2, 10);
  const s = S(mb, [0, 1]);
  s.hold(0, 'right'); s.step(150); s.releaseAll(); s.step(60);
  const c = crates(s)[0];
  check(c && c.x >= 20 * T - 0.5, `crate did not leave the ledge: ${c && r1(c.x)}`);
  near(c.y, FY - T, 0.6, 'crate y after falling (resting on floor)');
});
R.test('crate: falling out of the map destroys it', () => {
  const mb = crateMap({ crates: [{ x: 17, y: FR - 1 }] }); mb.fill(20, FR, 23, 15, '.'); mb.sp(0, 14, FR - 1).sp(1, 2, FR - 1);
  const s = S(mb, [0, 1]);
  s.hold(0, 'right'); s.step(150, () => { if (s.p(0).x > 19 * T + 14) s.release(0); }); s.releaseAll(); s.step(200);
  const c = crates(s)[0];
  const gone = !c || c.dead || c.gone || c.destroyed || c.removed || c.alive === false || c.active === false;
  check(gone, `crate still in world.entities after falling out of the map: x=${c && r1(c.x)} y=${c && r1(c.y)} (rows*32=${16 * T})`);
  check(!dead(s), 'pusher died');
});
R.test('crate: cannot push another crate (blocked)', () => {
  const mb = crateMap({ crates: [{ x: 16, y: FR - 1 }, { x: 19, y: FR - 1 }] }); mb.sp(0, 14, FR - 1);
  const s = S(mb, [0, 1]);
  const bx = crates(s)[1].x;
  s.hold(0, 'right'); s.step(200);
  const [a, b] = crates(s);
  near(b.x, bx, 0.5, 'second crate x (must not be pushed by the first)');
  check(a.x + a.w <= b.x + 0.01, `crates overlap: ${r1(a.x)}+${a.w} > ${r1(b.x)}`);
  check(a.x > 16 * T + 40, `first crate did not move up to the second (${r1(a.x)})`);
});
R.test('crate: cannot enter a closed gate', () => {
  const mb = crateMap({ crates: [{ x: 16, y: FR - 1 }] }); mb.sp(0, 14, FR - 1).sp(1, 2, FR - 1);
  mb.ent({ type: 'gate', x: 20, y: FR - 2, h: 2, channel: 'A' }).ent({ type: 'button', x: 30, y: FR - 1, channel: 'A' });
  const s = S(mb, [0, 1]);
  s.hold(0, 'right'); s.step(200);
  const c = crates(s)[0];
  check(c.x + c.w <= 20 * T + 0.01, `crate entered the closed gate: x=${r1(c.x)}`);
  check(c.x > 16 * T + 40, `crate did not move toward the gate (${r1(c.x)})`);
});

// ======================================================================================
// Buttons, levers, gates
// ======================================================================================
function switchMap(btn, gate) {
  const mb = mk(48); mb.set(46, FR - 1, 'D');
  mb.ent(Object.assign({ type: 'button', x: 6, y: FR - 1, channel: 'A' }, btn || {}));
  mb.ent(Object.assign({ type: 'gate', x: 30, y: FR - 2, h: 2, channel: 'A' }, gate || {}));
  return mb;
}
const button = s => s.ents('button')[0];
const gate = s => s.ents('gate')[0];
for (const mode of ['hold', 'latch', 'timer']) {
  R.test(`button: mode ${mode}`, () => {
    const mb = switchMap({ mode, time: 100 }); mb.sp(0, 6, FR - 1).sp(1, 2, FR - 1);
    const s = S(mb, [0, 1]);
    s.step(5);
    check(button(s).pressed === true && button(s).on === true, `bot on plate: pressed=${button(s).pressed} on=${button(s).on} load=${button(s).load}`);
    check(s.w.channels.A === true, `channels.A = ${s.w.channels.A} while pressed`);
    s.hold(0, 'left'); let left = -1;
    for (let i = 0; i < 60 && left < 0; i++) { s.step(1); if (!button(s).pressed) left = s.tick; }
    s.release(0);
    check(left > 0, 'button still pressed after walking off');
    if (mode === 'hold') { s.step(3); check(button(s).on === false, `hold: still on 3 ticks after release`); }
    if (mode === 'latch') { s.step(300); check(button(s).on === true, 'latch: turned off after release'); }
    if (mode === 'timer') {
      s.step(90 - (s.tick - left)); check(button(s).on === true, `timer 100: already off ${s.tick - left} ticks after release`);
      s.step(20); check(button(s).on === false, `timer 100: still on ${s.tick - left} ticks after release`);
    }
  });
}
R.test('button: need clamps to bot count (need 3, 2 bots both on plate -> pressed)', () => {
  const mb = switchMap({ need: 3, w: 2 }); mb.sp(0, 6, FR - 1).sp(1, 7, FR - 1);
  const s = S(mb, [0, 1]); s.step(5);
  check(button(s).pressed === true, `need 3 with 2 bots in game, both on plate: pressed=${button(s).pressed} load=${button(s).load}`);
});
R.test('button: need 3 with 4 bots: 2 on plate -> off, 3 -> on', () => {
  const mb = switchMap({ need: 3, w: 3 }); mb.sp(0, 6, FR - 1).sp(1, 7, FR - 1).sp(2, 12, FR - 1).sp(3, 14, FR - 1);
  const s = S(mb, [0, 1, 2, 3]); s.step(5);
  check(button(s).pressed === false, `2 of need 3 on the plate: pressed=${button(s).pressed} load=${button(s).load}`);
  s.place(2, 8 * T + 4, FY); s.step(5);
  check(button(s).pressed === true, `3 of need 3 on the plate: pressed=${button(s).pressed} load=${button(s).load}`);
});
R.test('button: a bot standing on another bot does not count', () => {
  const mb = switchMap({ need: 2 }); mb.sp(0, 6, FR - 1).sp(1, 2, FR - 1);
  const s = S(mb, [0, 1, 2, 3]);
  s.place(1, 6 * T + 4, FY - 30); s.step(8);
  check(Math.abs(feet(s.p(1)) - s.p(0).y) < 0.6, `could not stack bot on bot: ${fmtP(s.p(1))}`);
  check(button(s).pressed === false, `need 2: one bot on plate + one on its head counted as pressed (load=${button(s).load})`);
});
R.test('button: crate weight counts (weight 2 presses need 2; weight 1 does not, even with a bot on it)', () => {
  let mb = switchMap({ need: 2 }); mb.ent({ type: 'crate', x: 6, y: FR - 1, weight: 2 });
  let s = S(mb, [0, 1, 2, 3]); s.step(5);
  check(button(s).pressed === true, `crate weight 2 on need-2 plate: pressed=${button(s).pressed} load=${button(s).load}`);
  mb = switchMap({ need: 2 }); mb.ent({ type: 'crate', x: 6, y: FR - 1, weight: 1 }); mb.sp(0, 3, FR - 1);
  s = S(mb, [0, 1, 2, 3]); s.place(0, 6 * T + 4, FY - T); s.step(8);
  check(Math.abs(feet(s.p(0)) - (FY - T)) < 0.6, `could not put bot on crate: ${fmtP(s.p(0))}`);
  check(button(s).pressed === false, `crate weight 1 + bot on the crate counted as pressed (load=${button(s).load}); only things touching the plate count`);
});
R.test('lever: Up toggles once per press, does not jump; channel follows', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').sp(0, 8, FR - 1).sp(1, 2, FR - 1);
  mb.ent({ type: 'lever', x: 8, y: FR - 1, channel: 'B' }).ent({ type: 'gate', x: 30, y: FR - 2, h: 2, channel: 'B' });
  const s = S(mb, [0, 1]); s.step(3);
  const lever = () => s.ents('lever')[0];
  check(lever().on === false, 'lever initial on=false');
  const y0 = s.p(0).y; let minY = y0;
  s.hold(0, 'up'); s.step(30, () => { minY = Math.min(minY, s.p(0).y); });
  check(lever().on === true, `after Up press lever.on=${lever().on}`);
  check(s.w.channels.B === true, `channels.B=${s.w.channels.B} with lever on`);
  check(minY > y0 - 0.5, `bot jumped (rose ${r1(y0 - minY)} px) when pressing Up on a lever`);
  s.release(0); s.step(3); s.press(0, 'up'); s.step(5);
  check(lever().on === false, 'second Up press did not toggle the lever back');
  check(gate(s).open === false || gate(s).open === 0, 'gate on channel B should be closed again');
});
function gateCase(logic, invert, pressedCount) {
  const mb = mk(48); mb.set(46, FR - 1, 'D');
  mb.ent({ type: 'button', x: 6, y: FR - 1, channel: 'A' }).ent({ type: 'button', x: 9, y: FR - 1, channel: 'A' });
  mb.ent({ type: 'gate', x: 30, y: FR - 2, h: 2, channel: 'A', logic, invert });
  mb.sp(0, pressedCount >= 1 ? 6 : 1, FR - 1).sp(1, pressedCount >= 2 ? 9 : 2, FR - 1).sp(2, 25, FR - 1).sp(3, 3, FR - 1);
  const s = S(mb, [0, 1, 2, 3]); s.step(10);
  return s;
}
for (const [logic, invert, n, open] of [['all', false, 0, false], ['all', false, 1, false], ['all', false, 2, true], ['any', false, 0, false], ['any', false, 1, true], ['all', true, 0, true], ['all', true, 2, false], ['any', true, 1, false]]) {
  R.test(`gate: logic ${logic}${invert ? ' invert' : ''}, ${n}/2 buttons pressed -> ${open ? 'open' : 'closed'}`, () => {
    const s = gateCase(logic, invert, n);
    check(!!gate(s).open === open, `gate.open=${gate(s).open}, expected ${open}`);
    s.hold(2, 'right'); s.step(120);
    const p = s.p(2);
    if (open) check(p.x > 31 * T, `bot did not pass the open gate: ${fmtP(p)}`);
    else check(p.x + p.w <= 30 * T + 0.01, `bot passed/entered the closed gate: ${fmtP(p)}`);
  });
}
R.test('gate: never closes onto a bot (waits until clear, then closes)', () => {
  const mb = switchMap({ mode: 'hold' }); mb.sp(0, 6, FR - 1).sp(1, 26, FR - 1);
  const s = S(mb, [0, 1]); s.step(10);
  check(!!gate(s).open, 'gate should be open while the button is held');
  s.place(1, 30 * T + 4, FY); s.step(5);
  s.hold(0, 'left'); s.step(30); s.release(0); s.step(30);
  check(!button(s).pressed, 'button still pressed');
  check(!!gate(s).open, 'gate closed onto a bot standing in it');
  check(!dead(s), 'bot standing in the gate died');
  near(s.p(1).x, 30 * T + 4, 0.5, 'bot in gate x (must not be shoved)');
  s.hold(1, 'right'); s.step(30); s.release(1); s.step(30);
  check(!gate(s).open, 'gate did not close after the bot left it');
});

// ======================================================================================
// Platforms
// ======================================================================================
const plat = s => s.ents('platform')[0];
R.test('platform: pingpong at speed 1, carries a rider', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').ent({ type: 'platform', x: 5, y: 10, w: 2, path: [[5, 10], [10, 10]], speed: 1 });
  const s = S(mb, [0, 1]);
  check(Math.abs(plat(s).x - 160) < 0.01 && Math.abs(plat(s).y - 320) < 0.01, `platform start should be px (160,320), got (${plat(s).x},${plat(s).y})`);
  s.place(0, 5 * T + 4, 10 * T);
  const xs = {}; let slip = 0;
  s.step(330, (q) => { const t = q.tick; if ([80, 160, 240, 320].includes(t)) xs[t] = plat(q).x; if (t > 5) slip = Math.max(slip, Math.abs(q.p(0).x - plat(q).x - 4), Math.abs(feet(q.p(0)) - plat(q).y)); });
  near(xs[80], 240, 4, 'x at tick 80'); near(xs[160], 320, 4, 'x at tick 160 (end)'); near(xs[240], 240, 4, 'x at tick 240 (returning)'); near(xs[320], 160, 4, 'x at tick 320 (back)');
  check(slip < 0.8, `rider drifted ${r1(slip)} px relative to the platform`);
});
R.test('platform: loop returns from last waypoint straight to the first', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').ent({ type: 'platform', x: 5, y: 8, w: 1, path: [[5, 8], [9, 8], [9, 5], [5, 5]], speed: 1, mode: 'loop' });
  const s = S(mb, [0, 1]); s.step(400);
  near(plat(s).x, 160, 4, 'x at tick 400 (loop: on the closing segment [5,5]->[5,8])');
  near(plat(s).y, 208, 4, 'y at tick 400 (loop)');
});
R.test('platform: channel-driven (forward while active, stops at end, back when inactive)', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').sp(0, 14, FR - 1).sp(1, 2, FR - 1);
  mb.ent({ type: 'button', x: 3, y: FR - 1, channel: 'A' }).ent({ type: 'platform', x: 20, y: 10, w: 2, path: [[20, 10], [20, 5]], channel: 'A' });
  const s = S(mb, [0, 1]); s.step(60);
  near(plat(s).y, 320, 0.5, 'channel platform y while channel inactive');
  s.place(0, 3 * T + 4, FY); s.step(122);
  near(plat(s).y, 200, 5, 'y ~120 ticks after channel on');
  s.step(150); near(plat(s).y, 160, 0.5, 'y after reaching last waypoint (must stop there)');
  s.place(0, 12 * T + 4, FY); s.step(250);
  near(plat(s).y, 320, 0.5, 'y after channel off (back at first waypoint)');
});
R.test('platform: elevator need 2 (4 bots) - 1 rider no move, rider-on-rider counts, returns when empty', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').ent({ type: 'platform', x: 20, y: 12, w: 2, path: [[20, 12], [20, 6]], need: 2 });
  const s = S(mb, [0, 1, 2, 3]);
  s.place(1, 20 * T + 4, 12 * T); s.step(60);
  near(plat(s).y, 384, 0.5, 'elevator y with 1 rider (need 2)');
  check(Math.abs(feet(s.p(1)) - plat(s).y) < 0.6, `rider not on elevator: ${fmtP(s.p(1))}`);
  s.place(2, 20 * T + 4, s.p(1).y); s.step(60);
  check(plat(s).y < 384 - 40, `elevator did not rise with a bot standing on a rider bot (y=${r1(plat(s).y)})`);
  s.place(1, 10 * T, FY); s.place(2, 12 * T, FY); s.step(300);
  near(plat(s).y, 384, 0.5, 'elevator y after riders left (should return to first waypoint)');
});
R.test('platform: elevator need clamps to bot count (need 3, 2 bots)', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').ent({ type: 'platform', x: 20, y: 12, w: 2, path: [[20, 12], [20, 6]], need: 3 });
  const s = S(mb, [0, 1]);
  s.place(0, 20 * T + 2, 12 * T); s.place(1, 20 * T + 34, 12 * T); s.step(80);
  check(plat(s).y < 384 - 40, `need 3 elevator did not move with both bots of a 2-bot game on it (y=${r1(plat(s).y)})`);
});
R.test('platform: does not crush a rider against a ceiling', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').fill(17, 6, 24, 6, '#').ent({ type: 'platform', x: 20, y: 12, w: 2, path: [[20, 12], [20, 7]], need: 1 });
  const s = S(mb, [0, 1]);
  s.place(0, 20 * T + 4, 12 * T); let minTop = 1e9;
  s.step(400, () => { minTop = Math.min(minTop, s.p(0).y); });
  check(!dead(s), 'rider died (crushed)');
  check(minTop >= 7 * T - 0.5, `rider pushed into the ceiling (top ${r1(minTop)} < ${7 * T})`);
  check(plat(s).y < 300, `platform never rose (y=${r1(plat(s).y)})`);
  if (Math.abs(feet(s.p(0)) - plat(s).y) < 1) check(plat(s).y >= 7 * T + 30 - 0.5, `platform y ${r1(plat(s).y)} would crush the rider`);
});

// ======================================================================================
// One-way, springs, crumble, conveyors
// ======================================================================================
R.test("one-way '-': land from above, jump up through, Down+Jump drops through, Jump alone jumps", () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').fill(10, 12, 14, 12, '-').sp(0, 12, FR - 1).sp(1, 2, FR - 1);
  let s = S(mb, [0, 1]); s.step(2);
  s.hold(0, 'jump'); s.step(80); s.release(0); s.step(10);
  near(feet(s.p(0)), 12 * T, 0.6, 'feet after jumping up through the one-way (should stand on it)');
  s = S(mb, [0, 1]); s.place(0, 12 * T + 4, 10 * T); s.step(40);
  near(feet(s.p(0)), 12 * T, 0.6, 'feet after falling onto the one-way');
  const y = feet(s.p(0)); let minF = y;
  s.hold(0, 'jump'); s.step(20, () => { minF = Math.min(minF, feet(s.p(0))); }); s.release(0); s.step(60, () => { minF = Math.min(minF, feet(s.p(0))); });
  check(minF < y - 40, 'Jump (without Down) on a one-way did not jump');
  near(feet(s.p(0)), 12 * T, 0.6, 'landed back on the one-way');
  s.hold(0, 'down'); s.press(0, 'jump'); s.step(40); s.release(0);
  near(feet(s.p(0)), FY, 0.6, 'feet after Down+Jump (should drop through to the floor)');
});
R.test('one-way: Down+Jump drops through a moving platform', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').ent({ type: 'platform', x: 20, y: 11, w: 2, path: [[20, 11], [20, 6]], need: 4 });
  const s = S(mb, [0, 1, 2, 3]); s.place(0, 20 * T + 4, 11 * T); s.step(10);
  check(Math.abs(feet(s.p(0)) - 11 * T) < 0.6, `not standing on platform: ${fmtP(s.p(0))}`);
  s.hold(0, 'down'); s.press(0, 'jump'); s.step(50); s.release(0);
  near(feet(s.p(0)), FY, 0.6, 'feet after Down+Jump on a platform');
});
function springTrial(h) {
  const mb = new MapB(40, 20, 18); mb.set(10, 17, '*').fill(11, 18 - h, 25, 17, '#').set(35, 17, 'D');
  const s = S(mb, [0, 1]); s.place(0, 10 * T + 4, 15 * T); s.hold(0, 'right'); s.step(200);
  return { ok: onTop(s.p(0), (18 - h) * T, 11 * T + 2), p: fmtP(s.p(0)), springs: ev(s, 'spring').length };
}
R.test('spring: launches up to a 5-tile ledge', () => { const r = springTrial(5); check(r.ok, `did not reach a 5-tile ledge from a spring: ${r.p} (spring events: ${r.springs})`); });
R.test('spring: cannot reach a 6-tile ledge', () => { const r = springTrial(6); check(!r.ok, `reached a 6-tile ledge from a spring: ${r.p}`); });
R.test("crumble '=': vanishes 30 ticks after being stood on, reappears 180 ticks later", () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').fill(6, 10, 11, 10, '#').set(12, 10, '=');
  const s = S(mb, [0, 1]); s.place(0, 12 * T + 4, 10 * T);
  let t0 = -1, tg = -1, tb = -1;
  s.step(400, (q) => {
    const t = E.tileAt(q.w, 12, 10);
    if (t0 < 0 && q.p(0).onGround) t0 = q.tick;
    if (tg < 0 && t === '.') tg = q.tick;
    if (tg > 0 && tb < 0 && t === '=') tb = q.tick;
  });
  check(t0 >= 0, 'bot never stood on the crumble block');
  check(tg > 0, "crumble tile never vanished (tileAt never reported '.')");
  check(tg - t0 >= 27 && tg - t0 <= 34, `vanished ${tg - t0} ticks after being stood on (expected 30)`);
  check(tb > 0, 'crumble tile never reappeared');
  check(tb - tg >= 176 && tb - tg <= 184, `reappeared ${tb - tg} ticks after vanishing (expected 180)`);
  near(feet(s.p(0)), FY, 0.6, 'bot fell to the floor');
});
R.test("conveyor '>' / '<': moves a standing bot at 1.4 px/tick; also crates", () => {
  for (const [ch, sign] of [['>', 1], ['<', -1]]) {
    const mb = mk(48); mb.set(46, FR - 1, 'D').fill(10, FR, 30, FR, ch).ent({ type: 'crate', x: 24, y: FR - 1 });
    const s = S(mb, [0, 1]); s.place(0, 17 * T + 4, FY); s.step(5);
    const x0 = s.p(0).x, c0 = crates(s)[0].x; s.step(60);
    near((s.p(0).x - x0) / 60, 1.4 * sign, 0.05, `bot speed on '${ch}'`);
    check(Math.abs(crates(s)[0].x - c0) > 30, `crate on '${ch}' moved only ${r1(crates(s)[0].x - c0)} px in 60 ticks`);
  }
});
R.test('no momentum inheritance: jumping off a conveyor / a walking bot keeps x constant in the air', () => {
  let mb = mk(48); mb.set(46, FR - 1, 'D').fill(10, FR, 30, FR, '>');
  let s = S(mb, [0, 1]); s.place(0, 17 * T + 4, FY); s.step(5);
  s.hold(0, 'jump'); let drift = 0, prev = null;
  s.step(25, (q) => { const p = q.p(0); if (!p.onGround && prev !== null && prev.air) drift = Math.max(drift, Math.abs(p.x - prev.x)); prev = { x: p.x, air: !p.onGround }; });
  check(drift < 0.01, `bot drifted ${r1(drift)} px/tick in the air after jumping off a conveyor`);
  mb = mk(60); mb.set(56, FR - 1, 'D');
  s = S(mb, [0, 1]); tower(s, [0, 1], 10 * T, FY); s.step(10); s.hold(0, 'right'); s.step(30);
  s.hold(1, 'jump'); drift = 0; prev = null;
  s.step(20, (q) => { const p = q.p(1); if (!p.onGround && prev !== null && prev.air) drift = Math.max(drift, Math.abs(p.x - prev.x)); prev = { x: p.x, air: !p.onGround }; });
  check(drift < 0.01, `rider drifted ${r1(drift)} px/tick in the air after jumping off a walking bot`);
});

// ======================================================================================
// Color walls
// ======================================================================================
R.test('color walls: each letter passable only by its slot', () => {
  const bad = [];
  for (let wl = 0; wl < 4; wl++) for (let sl = 0; sl < 4; sl++) {
    const mb = mk(48); mb.set(46, FR - 1, 'D').fill(14, FR - 3, 14, FR - 1, 'abcd'[wl]);
    const others = [0, 1, 2, 3].filter(q => q !== sl); mb.sp(sl, 10, FR - 1); others.forEach((q, i) => mb.sp(q, 2 + i, FR - 1));
    const s = S(mb, [0, 1, 2, 3]); s.hold(sl, 'right'); s.step(80);
    const passed = s.p(sl).x > 15 * T;
    if (passed !== (wl === sl)) bad.push(`slot ${sl} vs '${'abcd'[wl]}': ${passed ? 'passed' : 'blocked'} (${fmtP(s.p(sl))})`);
  }
  check(!bad.length, bad.join('; '));
});
R.test('color walls: absent slot\'s wall is solid for everyone; present slot passes', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').fill(14, FR - 3, 14, FR - 1, 'c');
  let s = S(mb, [0, 1]);
  check(E.isSolidFor(s.w, 14, FR - 1, 2) === true, "slot 2 absent: isSolidFor('c', slot 2) should be true");
  check(E.isSolidFor(s.w, 14, FR - 1, 0) === true, "'c' must be solid for slot 0");
  s = S(mb, [0, 1, 2, 3]);
  check(E.isSolidFor(s.w, 14, FR - 1, 2) === false, "slot 2 present: isSolidFor('c', slot 2) should be false");
});
R.test('color walls: block crates and lasers', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').fill(20, FR - 3, 20, FR - 1, 'a').sp(0, 14, FR - 1).sp(1, 2, FR - 1);
  mb.ent({ type: 'crate', x: 16, y: FR - 1 }).ent({ type: 'laser', x: 24, y: FR - 3, dir: 'l' });
  const s = S(mb, [0, 1]); s.hold(0, 'right'); s.step(200);
  const c = crates(s)[0];
  check(c.x + c.w <= 20 * T + 0.01, `crate entered color wall 'a' (x=${r1(c.x)})`);
  const L = s.ents('laser')[0];
  check(L.x2 !== undefined, 'laser has no x2 (beam end)');
  near(L.x2, 21 * T, 2, "beam end x2 of a laser firing left into an 'a' column");
});

// ======================================================================================
// Hazards & death/reset
// ======================================================================================
function hazardRun(setup, slot) {
  const mb = mk(48); mb.set(46, FR - 1, 'D').sp(0, 8, FR - 1).sp(1, 2, FR - 1); setup(mb);
  const s = S(mb, [0, 1]); s.hold(0, 'right');
  s.step(200, (q) => { if (q.w.phase === 'dead') return false; });
  return s;
}
for (const [name, setup] of [
  ['spikes', mb => mb.set(15, FR - 1, '^')],
  ['static saw', mb => mb.ent({ type: 'saw', x: 15, y: FR - 1 })],
  ['always-on laser (vertical beam)', mb => mb.ent({ type: 'laser', x: 15, y: 8, dir: 'd' })],
  ['bottomless pit', mb => mb.fill(15, FR, 18, 15, '.')],
]) {
  R.test(`death: ${name} kills; phase 'dead', deadSlot set, 'die' event`, () => {
    const s = hazardRun(setup);
    check(s.w.phase === 'dead', `bot walked into ${name}: phase=${s.w.phase} ${fmtP(s.p(0))}`);
    check(s.w.deadSlot === 0, `deadSlot=${s.w.deadSlot}, expected 0`);
    check(ev(s, 'die').length >= 1, "no 'die' event");
  });
}
R.test('death: spikes hitbox has 4 px side margins (standing next to the tile is safe)', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').set(15, FR - 1, '^').sp(0, 8, FR - 1).sp(1, 2, FR - 1);
  const s = S(mb, [0, 1]); s.place(0, 15 * T + 3 - 24, FY); s.step(60);
  check(!dead(s), 'bot whose right edge is 3 px into the spike tile died (hitbox is x+4..x+28)');
});
R.test('death: pit death happens when the body top passes rows*32+64', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').fill(15, FR, 18, 15, '.');
  const s = S(mb, [0, 1]); s.place(0, 16 * T + 4, 10 * T);
  let lastY = 0; s.step(200, (q) => { if (q.w.phase === 'dead') return false; lastY = q.p(0).y; });
  check(s.w.phase === 'dead', 'never died in the pit');
  check(lastY <= 16 * T + 64 + 0.01, `body top reached ${r1(lastY)} before death (limit ${16 * T + 64})`);
  check(lastY > 16 * T + 64 - 13, `died too early: body top was ${r1(lastY)} (limit ${16 * T + 64})`);
});
R.test('death: auto reset after DEAD_TICKS restores positions, cell, gears', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').set(10, FR - 1, 'K').set(12, FR - 1, 'o').set(16, FR - 1, '^').sp(0, 6, FR - 1).sp(1, 30, FR - 1);
  const s = S(mb, [0, 1]); s.hold(0, 'right').hold(1, 'left');
  let td = -1; s.step(200, (q) => { if (q.w.phase === 'dead') { td = q.tick; return false; } });
  check(td > 0, 'bot did not die on spikes');
  check(s.w.key.holder === 0, `cell holder before death = ${s.w.key.holder}`);
  check(s.w.gearsTaken === 1, `gearsTaken before death = ${s.w.gearsTaken}`);
  let tp = -1; s.step(120, (q) => { if (tp < 0 && q.w.phase === 'play') tp = q.tick; });
  check(tp > 0, 'never returned to play');
  check(tp - td >= 57 && tp - td <= 63, `dead phase lasted ${tp - td} ticks (DEAD_TICKS 60)`);
  const fresh = S(mb, [0, 1]);
  const s2 = S(mb, [0, 1]); s2.hold(0, 'right').hold(1, 'left');
  s2.step(400, (q) => { if (q.deaths && q.w.phase === 'play') { q.releaseAll(); return false; } });
  for (const sl of [0, 1]) { near(s2.p(sl).x, fresh.p(sl).x, 3, `slot ${sl} x after reset`); near(s2.p(sl).y, fresh.p(sl).y, 1, `slot ${sl} y after reset`); }
  check(s2.w.key.holder === -1 && !s2.w.key.used, `cell after reset: holder=${s2.w.key.holder} used=${s2.w.key.used}`);
  near(s2.w.key.x, fresh.w.key.x, 0.5, 'cell x after reset');
  check(s2.w.gearsTaken === 0 && !s2.w.gears[0].taken, `gears after reset: gearsTaken=${s2.w.gearsTaken}`);
});
R.test('laser: crate blocks the beam (bot behind it is safe, x2 at the crate)', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').sp(0, 12, FR - 1).sp(1, 1, FR - 1);
  mb.ent({ type: 'laser', x: 4, y: FR - 1, dir: 'r' }).ent({ type: 'crate', x: 8, y: FR - 1 });
  const s = S(mb, [0, 1]); s.step(120);
  check(!dead(s), `bot behind a crate died (beam not blocked); deadSlot=${s.w.deadSlot}`);
  const L = s.ents('laser')[0];
  check(L.beamOn === true, `beamOn=${L.beamOn}`);
  near(L.x2, 8 * T, 2, 'beam end x2 (crate left edge)');
});
R.test('laser: on/off cycle (on 120, off 60, phase 0)', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').sp(0, 2, FR - 1).sp(1, 1, FR - 1).ent({ type: 'laser', x: 10, y: 8, dir: 'r', on: 120, off: 60, phase: 0 });
  const s = S(mb, [0, 1]); const got = [];
  const want = { 10: true, 100: true, 130: false, 170: false, 190: true, 290: true, 310: false };
  s.step(320, (q) => { if (want[q.tick] !== undefined) got.push(`${q.tick}:${q.ents('laser')[0].beamOn}`); });
  const bad = got.filter(g => { const [t, v] = g.split(':'); return String(want[t]) !== v; });
  check(got.length === Object.keys(want).length, `ticks sampled: ${got.join(' ')} (world.tick did not advance 1/step?)`);
  check(!bad.length, `beamOn wrong at ${bad.join(' ')} (expected ${JSON.stringify(want)})`);
});
R.test('laser: channel laser is OFF while channel active, ON while inactive; invert flips', () => {
  for (const invert of [false, true]) {
    const mb = mk(48); mb.set(46, FR - 1, 'D').sp(0, 2, FR - 1).sp(1, 1, FR - 1);
    mb.ent({ type: 'button', x: 6, y: FR - 1, channel: 'C' }).ent({ type: 'laser', x: 10, y: 8, dir: 'r', channel: 'C', invert });
    const s = S(mb, [0, 1]); s.step(5);
    const L = () => s.ents('laser')[0];
    check(L().beamOn === !invert, `invert=${invert}, channel inactive: beamOn=${L().beamOn}`);
    s.place(0, 6 * T + 4, FY); s.step(5);
    check(L().beamOn === invert, `invert=${invert}, channel active: beamOn=${L().beamOn}`);
  }
});

// ======================================================================================
// Power cell, hatch, clear
// ======================================================================================
R.test('cell & hatch: pick up -> unlock on contact -> Up enters (no jump) -> Down exits -> all in -> clear', () => {
  const mb = mk(48); mb.set(8, FR - 1, 'K').set(16, FR - 1, 'D').sp(0, 3, FR - 1).sp(1, 1, FR - 1);
  const s = S(mb, [0, 1]);
  check(s.w.door.open === false, 'hatch should start locked when the level has a K');
  check(s.w.key && s.w.key.holder === -1, `key.holder at start = ${s.w.key && s.w.key.holder}`);
  s.hold(0, 'right'); s.until(q => q.p(0).x >= 16 * T + 2, 300); s.release(0); s.step(10);
  check(s.p(0).hasKey === true || s.w.key.used === true, `bot 0 hasKey=${s.p(0).hasKey} key=${JSON.stringify(s.w.key)}`);
  check(ev(s, 'key').length >= 1, "no 'key' event on pickup");
  check(s.w.door.open === true, `hatch did not unlock when the cell carrier reached it (door=${JSON.stringify(s.w.door)})`);
  check(ev(s, 'unlock').length >= 1, "no 'unlock' event");
  const y0 = s.p(0).y; let minY = y0;
  s.press(0, 'up'); s.step(3, () => { minY = Math.min(minY, s.p(0).y); });
  check(s.p(0).state === 'entered', `Up at unlocked hatch: state=${s.p(0).state}`);
  check(minY > y0 - 0.5, 'bot jumped while entering the hatch');
  const xe = s.p(0).x; s.hold(0, 'left', 'jump'); s.step(20); s.release(0);
  check(s.p(0).state === 'entered' && Math.abs(s.p(0).x - xe) < 0.01, `entered bot reacted to left/jump: ${fmtP(s.p(0))}`);
  s.press(0, 'down'); s.step(5);
  check(s.p(0).state === 'active', `Down did not step the bot out (state=${s.p(0).state})`);
  check(Math.abs(cx(s.p(0)) - (16 * T + 16)) <= 32 && Math.abs(feet(s.p(0)) - FY) < 1, `exited bot not in front of the hatch: ${fmtP(s.p(0))}`);
  check(ev(s, 'exit').length >= 1, "no 'exit' event");
  s.step(5); s.press(0, 'up'); s.step(3);
  check(s.p(0).state === 'entered', 're-enter failed');
  check(s.w.phase === 'play', `phase ${s.w.phase} with only 1 of 2 bots inside`);
  s.hold(1, 'right'); s.until(q => q.p(1).x >= 16 * T + 2, 400); s.release(1); s.step(10);
  s.press(1, 'up'); s.step(3);
  check(s.p(1).state === 'entered', `bot 1 could not enter: ${fmtP(s.p(1))}`);
  check(s.w.phase === 'clear', `all bots entered but phase=${s.w.phase}`);
  check(ev(s, 'clear').length >= 1, "no 'clear' event");
});
R.test('hatch: Up at a LOCKED hatch is a jump, not an enter', () => {
  const mb = mk(48); mb.set(30, FR - 1, 'K').set(16, FR - 1, 'D').sp(0, 14, FR - 1).sp(1, 1, FR - 1);
  const s = S(mb, [0, 1]); s.place(0, 16 * T + 4, FY); s.step(3);
  s.press(0, 'up'); s.step(3);
  check(s.p(0).state === 'active', 'entered a locked hatch');
  check(s.p(0).vy < 0, `Up at locked hatch did not jump (vy=${r1(s.p(0).vy)})`);
});
R.test('gears: walking over a gear takes it (gearsTaken, gear event)', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').set(10, FR - 1, 'o').sp(0, 6, FR - 1).sp(1, 1, FR - 1);
  const s = S(mb, [0, 1]); check(s.w.gears.length === 1 && !s.w.gears[0].taken, 'gears at start');
  s.hold(0, 'right'); s.step(60);
  check(s.w.gears[0].taken === true && s.w.gearsTaken === 1, `gear not taken: ${JSON.stringify(s.w.gears)} gearsTaken=${s.w.gearsTaken}`);
  check(ev(s, 'gear').length === 1, `'gear' events: ${ev(s, 'gear').length}`);
});

// ======================================================================================
// Leash & tether
// ======================================================================================
R.test('leash: leftmost/rightmost bots never exceed LEASH_X = 1280 px apart', () => {
  const mb = mk(96, 16); mb.set(94, FR - 1, 'D').sp(0, 46, FR - 1).sp(1, 50, FR - 1).sp(2, 47, FR - 1).sp(3, 49, FR - 1);
  const s = S(mb, [0, 1, 2, 3]); s.hold(0, 'left').hold(1, 'right');
  let maxD = 0; s.step(600, (q) => { maxD = Math.max(maxD, cx(q.p(1)) - cx(q.p(0))); });
  check(maxD <= 1280 + 0.01, `centers got ${r1(maxD)} px apart (LEASH_X 1280)`);
  check(maxD >= 1270, `leash stopped bots too early: max distance ${r1(maxD)} px`);
});
R.test('tether: rope (length 5) pulls the partner along', () => {
  const mb = mk(60); mb.set(56, FR - 1, 'D').sp(0, 10, FR - 1).sp(1, 12, FR - 1);
  const s = S(mb, [0, 1], { tether: true, tetherLength: 5 });
  check(Array.isArray(s.w.ropes) && s.w.ropes.some(r => r[0] === 0 && r[1] === 1), `world.ropes = ${JSON.stringify(s.w.ropes)}`);
  const x0 = s.p(0).x; s.hold(1, 'right'); let maxD = 0;
  s.step(300, (q) => { maxD = Math.max(maxD, Math.hypot(cx(q.p(1)) - cx(q.p(0)), q.p(1).y - q.p(0).y)); });
  check(s.p(0).x - x0 > 30, `partner was not pulled along (moved ${r1(s.p(0).x - x0)} px)`);
  check(maxD <= 160 + 8, `rope stretched to ${r1(maxD)} px (length 160)`);
});
R.test('tether: an idle grounded bot anchors a dangling partner (no fall, no death)', () => {
  const mb = mk(48, 20, 18); mb.fill(20, 18, 47, 19, '.'); mb.set(5, 17, 'D').sp(0, 16, 17).sp(1, 18, 17);
  const s = S(mb, [0, 1], { tether: true, tetherLength: 5 });
  s.hold(1, 'right'); s.step(30); s.release(1); s.step(300);
  check(!dead(s), `team died: anchor ${fmtP(s.p(0))} / dangler ${fmtP(s.p(1))}`);
  check(Math.abs(feet(s.p(0)) - 18 * T) < 0.6 && s.p(0).x + s.p(0).w <= 20 * T + 20, `anchor dragged off the ledge: ${fmtP(s.p(0))}`);
  check(feet(s.p(1)) > 18 * T + 10, `partner not dangling: ${fmtP(s.p(1))}`);
});

// ======================================================================================
// Network input counters, snapshots, determinism, reset
// ======================================================================================
R.test('input counters: jc increase = jump press; uc increase = Up press (lever)', () => {
  const mb = mk(48); mb.set(46, FR - 1, 'D').sp(0, 8, FR - 1).sp(1, 20, FR - 1);
  mb.ent({ type: 'lever', x: 8, y: FR - 1, channel: 'B' }).ent({ type: 'gate', x: 30, y: FR - 2, h: 2, channel: 'B' });
  const s = S(mb, [0, 1]);
  s.extra[1] = { jc: 0 }; s.step(10);
  s.extra[1] = { jc: 1 }; s.step(1);
  check(s.p(1).vy < -5, `jc 0->1 did not jump (vy=${r1(s.p(1).vy)})`);
  s.step(80); check(s.p(1).onGround, 'did not land');
  const y = s.p(1).y; s.step(20);
  check(Math.abs(s.p(1).y - y) < 0.01, 'unchanged jc re-triggered a jump');
  s.extra[1] = { jc: 2 }; s.step(1);
  check(s.p(1).vy < -5, `jc 1->2 did not jump (vy=${r1(s.p(1).vy)})`);
  s.extra[0] = { uc: 0 }; s.step(5); s.extra[0] = { uc: 1 }; s.step(3);
  check(s.ents('lever')[0].on === true, 'uc 0->1 did not flip the lever');
  s.step(10); check(s.ents('lever')[0].on === true, 'unchanged uc flipped the lever again');
});

function busyLevel() {
  const mb = mk(60, 18, 16); mb.set(56, 15, 'D').set(30, 15, 'K').set(20, 15, 'o').set(22, 15, 'o').set(35, 15, '=').set(36, 15, '=')
    .sp(0, 3, 15).sp(1, 5, 15).sp(2, 7, 15).sp(3, 9, 15);
  mb.ent({ type: 'crate', x: 12, y: 15, need: 2 }).ent({ type: 'button', x: 16, y: 15, channel: 'A', mode: 'timer', time: 90 })
    .ent({ type: 'gate', x: 40, y: 13, h: 3, channel: 'A' }).ent({ type: 'platform', x: 44, y: 12, w: 2, path: [[44, 12], [50, 12]] })
    .ent({ type: 'saw', x: 25, y: 10, path: [[25, 10], [30, 10]], speed: 1.5 }).ent({ type: 'laser', x: 52, y: 6, dir: 'd', on: 90, off: 90 });
  return mb.level({ id: '0-98' });
}
function scripted(s, n) {
  for (let i = 0; i < n; i++) {
    const t = s.tick;
    s.releaseAll();
    const has = q => s.slots.includes(q);
    if (t % 200 < 120) { if (has(0)) s.hold(0, 'right'); if (has(1)) s.hold(1, 'right'); } else if (has(0)) s.hold(0, 'left');
    if (t % 90 === 30 && has(2)) s.press(2, 'jump');
    if (has(3)) { if (t % 150 < 60) s.hold(3, 'right'); else if (t % 150 < 100) s.hold(3, 'left'); }
    if (t % 77 === 5 && has(3)) s.press(3, 'up');
    s.step(1);
  }
}
R.test('snapshot: JSON-safe, < 3000 bytes (busy synthetic level, start and after 600 ticks)', () => {
  const s = new Sim(E, busyLevel(), [0, 1, 2, 3]);
  const a = snapSize(E, s.w); scripted(s, 600); const b = snapSize(E, s.w);
  const snap = E.snapshot(s.w);
  check(JSON.stringify(JSON.parse(JSON.stringify(snap))) === JSON.stringify(snap), 'snapshot is not JSON round-trip safe');
  check(a < 3000 && b < 3000, `snapshot bytes: start ${a}, after 600 ticks ${b}`);
});
R.test('snapshot: applySnapshot makes a fresh world match (players, cell, door, entities, tick, phase)', () => {
  const lv = busyLevel();
  const A = new Sim(E, lv, [0, 1, 2, 3]); scripted(A, 333);
  const B = new Sim(E, lv, [0, 1, 2, 3]);
  E.applySnapshot(B.w, E.snapshot(A.w));
  const diffs = [];
  const cmp = (what, a, b, tol) => { if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > (tol || 0)) diffs.push(`${what}: ${r1(a)} vs ${r1(b)}`); } else if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${what}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); };
  cmp('tick', A.w.tick, B.w.tick); cmp('phase', A.w.phase, B.w.phase);
  for (const p of A.w.players) { const q = B.p(p.slot); for (const k of ['x', 'y']) cmp(`p${p.slot}.${k}`, p[k], q[k], 0.06); for (const k of ['state', 'hasKey', 'facing']) cmp(`p${p.slot}.${k}`, p[k], q[k]); }
  cmp('key.holder', A.w.key.holder, B.w.key.holder); cmp('key.used', A.w.key.used, B.w.key.used); cmp('door.open', A.w.door.open, B.w.door.open);
  cmp('gearsTaken', A.w.gearsTaken, B.w.gearsTaken);
  A.w.entities.forEach((e, i) => { const f = B.w.entities[i]; if (!f) { diffs.push(`entity ${i} missing`); return; } for (const k of ['x', 'y']) cmp(`${e.type}${i}.${k}`, e[k], f[k], 0.06); for (const k of ['open', 'on', 'pressed', 'beamOn']) if (k in e) cmp(`${e.type}${i}.${k}`, e[k], f[k]); });
  for (const k of Object.keys(A.w.crumble || {})) cmp(`crumble ${k}.gone`, !!A.w.crumble[k].gone, !!(B.w.crumble[k] || {}).gone);
  check(!diffs.length, diffs.slice(0, 12).join('; '));
});
R.test('determinism: same inputs -> identical worlds; no Math.random/Date in engine source', () => {
  const lv = busyLevel();
  const A = new Sim(E, lv, [0, 1, 2, 3]), B = new Sim(E, lv, [0, 1, 2, 3]);
  scripted(A, 700); scripted(B, 700);
  const sa = JSON.stringify(A.w.players) + JSON.stringify(A.w.entities), sb = JSON.stringify(B.w.players) + JSON.stringify(B.w.entities);
  check(sa === sb, 'two identical runs diverged');
  const src = fs.readFileSync(ENGINE_PATH, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const bad = ['Math.random', 'Date.now', 'new Date', 'performance.now', 'document.'].filter(k => src.includes(k));
  check(!bad.length, `engine source uses: ${bad.join(', ')}`);
});
R.test('reset: Engine.reset restores the initial state (same slots)', () => {
  const lv = busyLevel();
  const A = new Sim(E, lv, [0, 2]); const init = JSON.stringify(A.w.players.map(p => [p.slot, p.x, p.y]));
  scripted(A, 300); E.reset(A.w);
  check(JSON.stringify(A.w.players.map(p => [p.slot, p.x, p.y])) === init, `players after reset ${JSON.stringify(A.w.players.map(p => [p.slot, r1(p.x), r1(p.y)]))} vs ${init}`);
  check(A.w.phase === 'play' && A.w.key.holder === -1 && A.w.gearsTaken === 0, `after reset: phase=${A.w.phase} holder=${A.w.key.holder} gears=${A.w.gearsTaken}`);
  check(Math.abs(A.ents('crate')[0].x - 12 * T) < 0.01, `crate after reset at ${A.ents('crate')[0].x}`);
});

// ======================================================================================
// Level-dependency regressions: mechanics the shipped levels rely on (6-4/6-10, 4-6/4-9/8-8/10-4, world 7)
// ======================================================================================
R.test('[level-dep] spring pogo: a rider on a bot that hits a spring reaches a 6-tile ledge (6-4, 6-10)', () => {
  const mb = new MapB(40, 20, 18); mb.set(10, 17, '*').fill(11, 12, 25, 17, '#').set(35, 17, 'D');
  const s = S(mb, [0, 1]); s.place(0, 7 * T + 4, 18 * T); s.place(1, 7 * T + 4, 18 * T - 30); s.step(5);
  s.hold(0, 'right'); let ok = false;
  s.step(200, (q, i) => { if (i === 40) q.hold(1, 'right'); if (i === 90) q.release(0); if (onTop(q.p(1), 12 * T, 11 * T + 2)) { ok = true; return false; } });
  check(ok && !dead(s), `rider did not land on the 6-high ledge: ${fmtP(s.p(1))} (bottom ${fmtP(s.p(0))})`);
});
R.test('[level-dep] a crate standing on a need-N elevator rides it and counts as a rider (4-6, 8-8, 10-4)', () => {
  const mb = mk(48); mb.fill(24, 6, 47, FR - 1, '#').fill(20, FR, 23, 15, '.').fill(20, 15, 23, 15, '#').set(40, 5, 'D');
  mb.ent({ type: 'platform', x: 20, y: 14, w: 4, path: [[20, 14], [20, 6]], need: 2 }).ent({ type: 'crate', x: 22, y: 13 });
  const s = S(mb, [0, 1, 2, 3]); s.step(5);
  near(s.ents('crate')[0].y, 13 * T, 0.6, 'crate y on the elevator before anyone boards');
  s.place(0, 20 * T + 4, 14 * T); s.step(300);
  const P = plat(s), c = s.ents('crate')[0];
  check(P.y <= 6 * T + 0.5, `need-2 elevator with 1 bot + 1 crate did not rise to the top (y=${r1(P.y)}, riders=${P.riders})`);
  near(c.y + c.h, P.y, 0.6, 'crate bottom vs platform top after the ride');
});
R.test('[level-dep] tether haul: anchor 1 tile above the lip reels a bot out of a pit, ease off, hop up (world 7)', () => {
  // terrace (top y=288) cols 0-27; lip (row 10, top y=320) cols 28-29; pit cols 30-31 rows 10-19
  const mb = new MapB(60, 22, 10); mb.fill(30, 10, 31, 19, '.'); mb.fill(30, 20, 31, 21, '#'); mb.fill(0, 9, 27, 9, '#');
  mb.set(5, 8, 'D').sp(0, 24, 8).sp(1, 2, 8).sp(2, 3, 8).sp(3, 4, 8);
  const s = S(mb, [0, 1], { tether: true, tetherLength: 6 });
  s.place(0, 26 * T + 4, 288); s.place(1, 30 * T + 4, 320); s.step(80);
  check(!dead(s) && feet(s.p(1)) > 400, `dangler did not hang in the pit: ${fmtP(s.p(1))}`);
  s.hold(0, 'left'); s.step(70); s.release(0);
  s.hold(0, 'right'); s.step(8); s.release(0); s.step(20);
  s.hold(1, 'left', 'jump'); let ok = false;
  s.step(120, (q) => { const p = q.p(1); if (p.onGround && feet(p) <= 288.5 && p.x < 28 * T) { ok = true; return false; } });
  check(ok && !dead(s), `pit bot not on the terrace after reel / ease off / hop: ${fmtP(s.p(1))} anchor ${fmtP(s.p(0))}`);
});

R.run();
