'use strict';
// Designer-3: scripted checks of key world-6 maneuvers.  node tools/designer-3/t_w6.js [id]
const sim = require('../sim.js');
const only = process.argv[2];
const E = sim.Engine;
// closed-loop controller: fn(w, t, inp) fills inp[slot] = {left,right,jump,up,down}; returns 'stop' to end
function ctl(id, ticks, fn, slots) {
  const w = E.createWorld(sim.load(id), { slots: slots || [0, 1, 2, 3] });
  let deaths = 0;
  for (let t = 0; t < ticks; t++) {
    const inp = []; for (const s of w.slots) inp[s] = {};
    if (fn(w, t, inp) === 'stop') break;
    const ph = w.phase; E.step(w, inp);
    if (ph === 'play' && w.phase === 'dead') deaths++;
    if (w.phase === 'clear') return { w, deaths, cleared: true, t };
  }
  return { w, deaths, cleared: w.phase === 'clear' };
}
const P = (w, s) => w.players.find(p => p.slot === s);
const tx = p => (p.x + p.w / 2) / 32, ty = p => (p.y + p.h - 1) / 32;
// walk slot s toward tile column c (center), returns true when there
function walkTo(w, inp, s, c, tol) { const p = P(w, s), d = c + 0.5 - tx(p); tol = tol || 0.12; if (Math.abs(d) <= tol) return true; inp[s][d > 0 ? 'right' : 'left'] = true; return false; }

// hop slot a onto slot b's head (closed loop, call every tick; returns true when standing on b)
const hopState = {};
function hop(w, inp, a, b, t) {
  const pa = P(w, a), pb = P(w, b), k = a + '>' + b;
  if (pa.onGround && Math.abs(pa.y + 30 - pb.y) < 1.5 && Math.abs(pa.x - pb.x) < 6) { delete hopState[k]; return true; }
  if (!hopState[k]) hopState[k] = { t0: t };
  const h = hopState[k];
  if (t - h.t0 > 90) { h.t0 = t; }
  if (t - h.t0 < 22) inp[a].jump = true;
  const d = pb.x - pa.x;
  if (Math.abs(d) > 3 && (t - h.t0 > 4 || !pa.onGround)) inp[a][d > 0 ? 'right' : 'left'] = true;
  return false;
}
const tests = {
  '6-10': () => {
    let st = 0, t0 = 0, log = [];
    const plat = w => w.entities.find(e => e.type === 'platform');
    const r = ctl('6-10', 4000, (w, t, inp) => {
      const p2 = P(w, 2), p3 = P(w, 3);
      const go = (n) => { log.push(t + ':' + n); st = n; t0 = t; };
      if (st === 0 && t > 2) go(1);
      if (st === 1) { if (hop(w, inp, 2, 3, t)) go(2); }
      if (st === 2) { if (walkTo(w, inp, 3, 14, 0.3)) go(3); }
      if (st === 3) { if (p2.y + 30 < 390 || tx(p2) > 14.6) inp[2].right = true; if (p2.onGround && tx(p2) > 15.3 && p2.y + 30 <= 385) go(4); if (t - t0 > 300) go(99); }
      if (st >= 4 && st < 6) { // riders into pit, flyer to lever
        walkTo(w, inp, 0, 21, 0.3); walkTo(w, inp, 1, 22, 0.3); walkTo(w, inp, 3, 23, 0.3);
        if (st === 4 && walkTo(w, inp, 2, 16, 0.2)) go(5);
        if (st === 5 && plat(w).riders >= 3) { inp[2].up = true; go(6); }
      }
      if (st === 6) { if (plat(w).y <= 12 * 32 + 0.5) go(7); }
      if (st === 7) { if (!w._o) w._o = [0, 1, 2, 3].sort((a, b) => P(w, a).x - P(w, b).x); const o = w._o; let ok = true; for (let k = 0; k < 4; k++) if (!walkTo(w, inp, o[k], 24 + k, 0.15)) ok = false; if (ok && w.channels.B) go(8); if (t - t0 > 600) go(98); }
      const o = w._o || [0, 1, 2, 3];
      if (st === 8) { const a = hop(w, inp, o[1], o[0], t), b = hop(w, inp, o[3], o[2], t); if (a && b) go(9); }
      if (st === 9) { const pa = P(w, o[0]), pb = P(w, o[2]); if (pb.x - (pa.x + 24) > 0.6) inp[o[0]].right = true; else go(10); }
      if (st === 10) { inp[o[0]].right = true; inp[o[2]].right = true; if (tx(P(w, o[2])) > 48.5) go(11); }
      if (st === 11) { inp[o[0]].right = true; if (tx(P(w, o[0])) > 46.6) go(12); }
      if (st === 12) { // riders hop down behind; line up L->R: o[1],o[3]? use final order rider1, base0, rider3, base2
        let ok = true; const want = {}; want[o[2]] = 49; want[o[0]] = 48; want[o[3]] = 47; want[o[1]] = 46;
        for (const k of [o[2], o[0], o[3], o[1]]) { const p = P(w, k); if (!(p.onGround && Math.abs(tx(p) - want[k] - 0.5) < 0.3)) { ok = false; if ((k === o[3] || k === o[1]) && p.y + 30 < 380) inp[k].left = true; else walkTo(w, inp, k, want[k], 0.2); } }
        if (ok) go(13); if (t - t0 > 500) go(97);
      }
      if (st === 13) { for (let k = 0; k < 4; k++) inp[k].right = true; const c = w.entities.find(e => e.type === 'crate'); if (c.x >= 54 * 32 - 0.5) go(14); if (t - t0 > 600) go(96); }
      if (st === 14) { for (let k = 0; k < 4; k++) { const p = P(w, k); if (p.state !== 'active') continue; inp[k].right = true; if (tx(p) > 53.5 && tx(p) < 55.5 && (t + k * 7) % 40 < 20) inp[k].jump = true; if (tx(p) > 57.8) { inp[k].right = false; if (t % 2) inp[k].up = true; } } }
    });
    return `cleared=${r.cleared} deaths=${r.deaths} st=${st} log=${log.join(' ')} gears=${r.w.gearsTaken}`;
  },
  '6-9': () => {
    let st = 0, t0 = 0;
    const r = ctl('6-9', 1500, (w, t, inp) => {
      if (t > 2 && t < 260) { inp[0].left = true; inp[1].left = true; }
      const p = P(w, 3);
      if (st === 0) { if (walkTo(w, inp, 3, 18, 0.25) || tx(p) > 18.2) st = 1; }
      if (st === 1) { if (p.y + 30 < 318 || tx(p) > 18.7) inp[3].right = true; if (p.onGround && tx(p) > 19) st = 2; }
      if (st === 2) { inp[3].right = true; if (tx(p) > 25.9) st = 3; }
      if (t % 50 === 0 && process.env.DBG) console.log(t, st, tx(p).toFixed(2), (p.y + 30).toFixed(1), p.onGround);
    });
    const cr = r.w.entities.filter(e => e.type === 'crate').map(c => (c.x / 32).toFixed(1) + ',' + (c.y / 32).toFixed(1));
    const g = r.w.entities.find(e => e.type === 'gate');
    return `crates ${cr.join(' ')} gate open=${g.open} Lilac holds cell=${P(r.w, 3).hasKey} deaths=${r.deaths}`;
  },
  '6-8': () => {
    let st = 0, t0 = 0, minF = 1e9;
    const r = ctl('6-8', 2400, (w, t, inp) => {
      if (st === 0) { let ok = true; for (let k = 0; k < 4; k++) if (!walkTo(w, inp, k, 4 + k, 0.15)) ok = false; if (ok) { st = 1; t0 = t; } }
      if (st === 1) { const a = hop(w, inp, 1, 0, t), b = hop(w, inp, 3, 2, t); if (a && b) st = 2; }
      if (st === 2) { const p0 = P(w, 0), p2 = P(w, 2); if (p2.x - (p0.x + 24) > 0.6) inp[0].right = true; else st = 3; }
      if (st === 3) { inp[0].right = true; inp[2].right = true; if (tx(P(w, 0)) > 31) st = 4; }
      if (st === 4) { // dismount and walk to cell / spring gear test: pair 2+3 onto spring at 37
        if (!walkTo(w, inp, 2, 37, 0.2)) {} else { st = 5; t0 = t; }
      }
      if (st === 5) { minF = Math.min(minF, P(w, 3).y); if (t - t0 > 120) { st = 6; } }
      if (st === 6) { // everyone to hatch, Coral carries cell (at 33 on the way)
        inp[2].left = true; if (tx(P(w, 2)) < 36) st = 7;
      }
      if (st === 7) { for (const k of [0, 1, 2, 3]) { const p = P(w, k); if (p.state === 'active') { if (walkTo(w, inp, k, 41, 0.25)) inp[k].up = (t % 2 === 0); } } }
    });
    return `cleared=${r.cleared} st=${st} gears=${r.w.gearsTaken}/${r.w.gears.length} deaths=${r.deaths} topMinY=${minF.toFixed(0)} cell holder=${r.w.key.holder} used=${r.w.key.used}`;
  },
  '6-5': () => {
    const r = ctl('6-5', 700, (w, t, inp) => { if (t > 2 && t < 200) { inp[2].right = true; inp[3].right = true; } });
    const c = r.w.entities.find(e => e.type === 'crate');
    return `crate x=${(c.x / 32).toFixed(2)} y=${(c.y / 32).toFixed(2)} (want on lower floor y=16) bots y=${r.w.players.map(p => ty(p).toFixed(1)).join(',')} deaths=${r.deaths}`;
  },
  '6-6': () => {
    // Lilac walks to B (col 25) and leans left against the bump for 200 ticks; check plate stays pressed
    let pressedTicks = 0, st = 0;
    const r = ctl('6-6', 900, (w, t, inp) => {
      walkTo(w, inp, 0, 2, 0.3); if (tx(P(w, 0)) < 2.8) inp[0].left = true;
      if (st === 0) { // walk over bump: go right, jump at bump
        const p = P(w, 3); inp[3].right = true; if (tx(p) > 22.6 && tx(p) < 24) inp[3].jump = true; if (tx(p) > 25.6) st = 1;
      } else { inp[3].left = true; const b = w.entities.find(e => e.type === 'button' && e.x === 25 * 32); if (b && b.pressed) pressedTicks++; st++; if (st > 300) return 'stop'; }
    });
    return `B pressed ${pressedTicks}/300 ticks while leaning; Lilac at col ${tx(P(r.w, 3)).toFixed(2)}`;
  },
  '6-7': () => {
    let st = 0, t0 = 0;
    const r = ctl('6-7', 900, (w, t, inp) => {
      walkTo(w, inp, 3, 19);
      const p = P(w, 0);
      if (st === 0 && t > 100) st = 1;
      if (st === 1) { if (walkTo(w, inp, 0, 8, 0.2) || ty(p) < 15.5) { st = 2; t0 = t; } }
      if (st === 2) { if (p.y + 30 < 380) inp[0].left = true; if (p.onGround && p.y + 30 <= 385 && tx(p) < 8) return 'stop'; if (t - t0 > 300) return 'stop'; }
    });
    const p = P(r.w, 0);
    return `Coral at col ${tx(p).toFixed(2)} feet ${(p.y + 30).toFixed(1)} (deck top 384) grounded=${p.onGround} deaths=${r.deaths}`;
  },
  '6-4': () => {
    // Lilac (3) is the base, Marigold (2) hops on, Lilac walks onto the spring, Marigold steers onto the slab
    let st = 0, t0 = 0, best = 1e9;
    const r = ctl('6-4', 900, (w, t, inp) => {
      const a = P(w, 3), b = P(w, 2);
      best = Math.min(best, b.y + 30);
      if (st === 0 && t > 2) { t0 = t; st = 1; }
      if (st === 1) { inp[2].jump = t - t0 < 20; if (t - t0 < 7) inp[2].right = true; if (t - t0 > 40) st = 2; }
      if (st === 2) { if (walkTo(w, inp, 3, 14, 0.3)) { st = 3; t0 = t; } }
      if (st === 3) { if (b.y + 30 < 335 || tx(b) > 14.6) inp[2].right = true; if (b.onGround && tx(b) > 16.5) return 'stop'; if (t - t0 > 200) return 'stop'; }
    });
    const b = P(r.w, 2);
    return `top bot feet y=${(b.y + 30).toFixed(1)} tileX=${tx(b).toFixed(2)} grounded=${b.onGround} (slab top = 320) bestFeet=${best.toFixed(1)} deaths=${r.deaths}`;
  },
  '6-3': () => {
    const r = sim.run('6-3', { ticks: 600, stopOnClear: false, script: [
      { from: 2, to: 110, slot: 2, hold: ['right'] }, { from: 2, to: 110, slot: 3, hold: ['right'] },
      { from: 110, to: 300, slot: 2, hold: ['left'] }, { from: 110, to: 300, slot: 3, hold: ['left'] }] });
    const c = r.world.entities.find(e => e.type === 'crate');
    return `crate at x=${c.x.toFixed(1)} y=${c.y.toFixed(1)} (want 640,384) deaths=${r.deaths}`;
  },
};
for (const k of Object.keys(tests)) if (!only || k === only) console.log(k, tests[k]());
