'use strict';
// Designer-3 closed-loop sim helpers (used by t_w5.js).
const sim = require('../sim.js');
const E = sim.Engine;
function ctl(level, ticks, fn, slots) {
  const w = E.createWorld(typeof level === 'string' ? sim.load(level) : E.parseLevel(level), { slots: slots || [0, 1, 2, 3] });
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
function walkTo(w, inp, s, c, tol) { const p = P(w, s), d = c + 0.5 - tx(p); tol = tol || 0.12; if (Math.abs(d) <= tol) return true; inp[s][d > 0 ? 'right' : 'left'] = true; return false; }
const hs = {};
function hop(w, inp, a, b, t) {
  const pa = P(w, a), pb = P(w, b), k = a + '>' + b;
  if (pa.onGround && Math.abs(pa.y + 30 - pb.y) < 1.5 && Math.abs(pa.x - pb.x) < 6) { delete hs[k]; return true; }
  if (!hs[k]) hs[k] = { t0: t };
  const h = hs[k];
  if (t - h.t0 > 90) h.t0 = t;
  if (t - h.t0 < 22) inp[a].jump = true;
  const d = pb.x - pa.x;
  if (Math.abs(d) > 3 && (t - h.t0 > 4 || !pa.onGround)) inp[a][d > 0 ? 'right' : 'left'] = true;
  return false;
}
module.exports = { sim, E, ctl, P, tx, ty, walkTo, hop };
