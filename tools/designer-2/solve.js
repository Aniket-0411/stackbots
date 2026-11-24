#!/usr/bin/env node
'use strict';
// Scripted solutions for worlds 3-4 (designer-2), run through tools/designer-2/drive.js.
//   node tools/designer-2/solve.js [ids...]
const { run, report } = require('./drive.js');
const X = c => c * 32;                       // tile col -> px
const past = (s, c) => (w) => { const p = w.players.find(q => q.slot === s); return p.state !== 'active' || p.x > X(c); };
const allPast = (ss, c) => (w) => ss.every(s => past(s, c)(w));
const inside = s => w => w.players.find(q => q.slot === s).state === 'entered';
const chan = ch => w => !!(w.channels[ch] || (w.chanAny && w.chanAny[ch]));
const M = w => (w._marks = w._marks || {});
const P = {};
P['3-1'] = {
  0: [['go', 13], ['until', allPast([1, 2, 3], 18)], ['until', w => w.channels.A], ['go', 23], ['enter']],
  1: [['go', 21], ['until', past(0, 18)], ['enter']],
  2: [['go', 23], ['enter']],
  3: [['go', 24], ['enter']],
};
P['3-2'] = {
  0: [['go', 3], ['until', chan('A')], ['go', 22], ['enter']],
  1: [['go', 3], ['go', 1], ['up'], ['until', chan('A')], ['go', 23], ['enter']],
  2: [['until', chan('A')], ['go', 25], ['enter']],
  3: [['until', chan('A')], ['go', 24], ['enter']],
};
const gateOpen = (i = 0) => w => w.entities.filter(e => e.type === 'gate')[i].open;
P['3-3'] = {
  3: [['go', 14.1, { nojump: true }], ['until', w => !!M(w).doneB], ['go', 21], ['go', 23], ['enter']],
  2: [['go', 14.1, { nojump: true, until: gateOpen() }], ['go', 22], ['go', 34], ['enter']],
  0: [['until', gateOpen()], ['go', 29], ['leap', 30.5], ['go', 32.2], ['wait', 5], ['go', 26.3, { nojump: true, until: past(3, 21) }], ['until', past(3, 21)], ['wait', 60], ['go', 34], ['enter']],
  1: [['until', gateOpen()], ['wait', 20], ['go', 29], ['until', past(0, 32)], ['leap', 30.5], ['go', 33.2], ['wait', 30], ['go', 27.3, { nojump: true, until: w => w.entities.filter(e => e.type === 'button')[1].load >= 3 }], ['mark', 'doneB'], ['wait', 60], ['go', 35], ['enter']],
};
P['3-4'] = {
  2: [['go', 8], ['until', chan('A')], ['wait', 20], ['go', 19], ['leap', 23], ['go', 30.1], ['leap', 34], ['enter']],
  3: [['go', 9], ['until', chan('A')], ['wait', 20], ['go', 19], ['leap', 22], ['go', 30.1], ['leap', 34], ['enter']],
  0: [['until', chan('A')], ['go', 19], ['leap', 23], ['go', 30.1], ['leap', 34], ['enter']],
  1: [['until', chan('A')], ['wait', 10], ['go', 19], ['leap', 23], ['go', 30.1], ['leap', 35], ['enter']],
};
P['3-5'] = {
  3: [['go', 21], ['until', w => !!M(w).flip2], ['go', 33], ['enter']],
  2: [['go', 21], ['jump', 18], ['go', 23], ['up'], ['until', w => w.key.holder === 0 && past(0, 8)(w)], ['up'], ['mark', 'flip2'], ['go', 26], ['enter']],
  0: [['until', chan('A')], ['go', 2], ['go', 10], ['until', w => !w.channels.A], ['go', 34], ['enter']],
  1: [['until', w => !!M(w).flip2], ['go', 32], ['enter']],
};
P['3-6'] = {
  0: [['go', 7], ['until', allPast([2, 3], 15)], ['until', chan('B')], ['go', 1], ['go', 17], ['go', 18], ['jump', 18], ['go', 19], ['go', 30], ['enter']],
  1: [['go', 10], ['until', allPast([2, 3], 15)], ['until', chan('B')], ['wait', 40], ['go', 1], ['go', 17], ['go', 18], ['jump', 18], ['go', 19], ['go', 31], ['enter']],
  2: [['go', 12], ['until', chan('A')], ['go', 17], ['leap', 20], ['go', 26], ['go', 32], ['enter']],
  3: [['go', 12], ['until', chan('A')], ['go', 17], ['leap', 20], ['go', 23], ['enter']],
};
const only = process.argv.slice(2);
const crateAt = (lo, hi, i = 0) => w => { const c = w.entities.filter(e => e.type === 'crate')[i]; return c.x >= X(lo) - 1 && c.x <= X(hi) + 1; };
P['3-7'] = {
  0: [['go', 9], ['until', allPast([1, 2, 3], 14)], ['until', w => w.entities.filter(e => e.type === 'button')[1].pressed], ['go', 31], ['enter']],
  1: [['go', 11], ['until', gateOpen()], ['go', 14], ['until', crateAt(14.8, 15.5)], ['wait', 20], ['go', 18.2], ['until', past(0, 20)], ['go', 29], ['go', 33], ['enter']],
  2: [['go', 10.5], ['until', gateOpen()], ['go', 13], ['until', crateAt(14.8, 15.5)], ['wait', 50], ['go', 17.4], ['until', past(0, 20)], ['go', 32], ['enter']],
  3: [['go', 11.5], ['until', gateOpen()], ['go', 23.5], ['leap', 26.5], ['go', 15.88, { nojump: true }], ['until', past(0, 20)], ['go', 30], ['enter']],
};
P['3-8'] = {
  3: [['go', 5], ['until', gateOpen(0)], ['go', 22], ['until', gateOpen(2)], ['go', 32], ['go', 40], ['enter']],
  2: [['go', 5], ['jump', 18], ['go', 9], ['until', allPast([0, 1, 3], 13)], ['until', gateOpen(1)], ['go', 25], ['go', 21], ['until', allPast([0, 1, 3], 25)], ['until', gateOpen(3)], ['go', 32], ['go', 35], ['go', 42], ['enter']],
  0: [['until', past(3, 6)], ['until', gateOpen(0)], ['go', 20], ['until', gateOpen(2)], ['go', 30], ['go', 39], ['enter']],
  1: [['until', past(0, 6)], ['until', gateOpen(0)], ['go', 15], ['until', past(2, 19.5)], ['go', 27], ['until', past(2, 31)], ['go', 38], ['enter']],
};
const placed = crateAt(20.9, 21.2);
const plate = w => w.entities.find(e => e.type === 'button').pressed;
const run9 = (k) => [['until', plate], ['wait', k], ['go', 23], ['runjump', 25.2, 28.5], ['go', 36 + k / 15], ['enter']];
P['3-9'] = {
  3: [['go', 20.1, { nojump: true }], ['go', 9]].concat(run9(0)),
  2: [['go', 20.1, { nojump: true, until: placed }], ['go', 8]].concat(run9(15)),
  1: [['until', placed], ['go', 7]].concat(run9(30)),
  0: [['until', placed], ['go', 6]].concat(run9(45)),
};
const btnOn = i => w => w.entities.filter(e => e.type === 'button')[i].on;
P['3-10'] = {
  3: [['go', 6], ['until', gateOpen(0)], ['go', 21], ['until', gateOpen(1)], ['go', 36], ['until', allPast([0, 1, 2], 41)], ['until', w => w.entities.find(e => e.type === 'lever').on], ['go', 43], ['until', gateOpen(3)], ['go', 57], ['enter']],
  2: [['go', 6], ['jump', 18], ['go', 8], ['go', 11], ['until', past(3, 20.4)], ['go', 21], ['jump', 18], ['go', 23], ['until', btnOn(1)], ['go', 27], ['go', 33], ['until', gateOpen(2)], ['go', 45], ['until', gateOpen(3)], ['go', 58], ['enter']],
  0: [['until', gateOpen(0)], ['go', 16], ['until', gateOpen(1)], ['go', 34], ['until', gateOpen(2)], ['go', 46], ['up'], ['until', past(3, 41.5)], ['wait', 10], ['up'], ['until', gateOpen(3)], ['go', 59], ['enter']],
  1: [['until', gateOpen(0)], ['go', 17], ['until', gateOpen(1)], ['go', 35], ['until', gateOpen(2)], ['go', 44], ['until', gateOpen(3)], ['go', 58], ['enter']],
};
// ---------------- world 4 ----------------
const plat = (w, i) => w.entities.filter(e => e.type === 'platform')[i];
const onPlat = (i, off) => w => plat(w, i).x + off * 32 + 16;          // go-target that follows a platform
const platIn = (i, x0, x1, y0 = -1e9, y1 = 1e9) => w => { const q = plat(w, i); return q.x >= X(x0) - 1 && q.x <= X(x1) + 1 && q.y >= X(y0) - 1 && q.y <= X(y1) + 1; };
const platDir = (i) => w => { const q = plat(w, i); return q.x - (q._px == null ? q.x : q._px); };
const unlocked = w => w.door.open;
const climb41 = (off, k) => [['until', platIn(0, 26.6, 27.1)], ['go', off], ['wait', k], ['jump', 18], ['wait', 40], ['go', 33.6], ['jump', 18], ['wait', 40], ['runjump', 34.3, 37], ['enter']];
const board41 = (col) => [['go', col], ['until', w => platIn(0, 7.9, 8.7)(w) && platDir(0)(w) < 0], ['jump', 18], ['wait', 30]];
P['4-1'] = {
  3: board41(11).concat(climb41(34.3, 0)),
  2: board41(10).concat(climb41(33.3, 150)),
  1: board41(9).concat(climb41(32.3, 300)),
  0: board41(8).concat(climb41(31.3, 450)),
};
const hasKey = w => w.key && w.key.holder >= 0;
const top = (i, y) => w => plat(w, i).y <= X(y) + 1;
P['4-2'] = {
  0: [['go', 3], ['until', hasKey], ['go', 14], ['jump', 18], ['wait', 30], ['until', top(0, 7)], ['go', 30], ['enter']],
  1: [['go', 3], ['go', 1], ['go', 5], ['go', 15], ['jump', 18], ['wait', 30], ['until', top(0, 7)], ['go', 31], ['enter']],
  2: [['go', 16], ['jump', 18], ['wait', 30], ['until', top(0, 7)], ['go', 32], ['enter']],
  3: [['go', 17], ['jump', 18], ['wait', 30], ['until', top(0, 7)], ['go', 33], ['enter']],
};
const climb43 = [['go', 18.5], ['jump', 18], ['wait', 40], ['runjump', 17.1, 14.5], ['wait', 10], ['jump', 18], ['wait', 40]];
P['4-3'] = {
  0: [['go', 9], ['drop'], ['wait', 40], ['go', 3], ['go', 9], ['until', w => w.entities.filter(e => e.type === 'button')[1].pressed]].concat(climb43, [['go', 31], ['enter']]),
  1: [['until', gateOpen()], ['go', 34], ['until', unlocked], ['enter']],
  2: [['until', gateOpen()], ['go', 29], ['until', past(0, 28)], ['go', 31], ['until', unlocked], ['enter']],
  3: [['until', gateOpen()], ['go', 35], ['until', unlocked], ['enter']],
};
const onP = (s, i) => w => { const p = w.players.find(q => q.slot === s), q = plat(w, i); return p.onGround && Math.abs(p.y + p.h - q.y) < 2 && p.x + p.w > q.x && p.x < q.x + q.w; };
P['4-4'] = {
  3: [['go', 15], ['until', platIn(0, 23.9, 24.1)], ['go', 31], ['until', w => onP(0, 0)(w) && platIn(0, 12.9, 13.1)(w)], ['go', 33], ['until', past(0, 27.5)], ['go', 35], ['enter']],
  2: [['go', 14], ['until', platIn(0, 23.9, 24.1)], ['go', 30], ['go', 36], ['enter']],
  1: [['go', 13], ['until', platIn(0, 23.9, 24.1)], ['go', 29], ['go', 37], ['enter']],
  0: [['until', w => [1, 2, 3].every(s => onP(s, 0)(w))], ['go', 2], ['until', w => [1, 2, 3].every(s => past(s, 27.5)(w))], ['go', 5], ['until', platIn(0, 12.9, 13.1)], ['go', 13.5], ['until', platIn(0, 23.9, 24.1)], ['go', 34], ['enter']],
};
P['4-5'] = {
  3: [['go', 13], ['jump', 18], ['wait', 40], ['until', w => M(w).s0], ['until', top(0, 8)], ['go', 30], ['enter']],
  2: [['until', hasKey], ['wait', 60], ['go', 11], ['until', w => M(w).s0], ['wait', 20], ['runjump', 11.3, 13], ['until', top(0, 8)], ['go', 31], ['enter']],
  1: [['go', 3], ['go', 1], ['go', 5], ['until', past(2, 10.5)], ['wait', 30], ['go', 11], ['wait', 30], ['mark', 's1'], ['until', top(0, 8)], ['go', 32], ['enter']],
  0: [['go', 3], ['until', hasKey], ['until', w => M(w).s1], ['go', 11], ['wait', 30], ['mark', 's0'], ['until', top(0, 8)], ['go', 33], ['enter']],
};
const placed6 = crateAt(18.8, 19.1);
P['4-6'] = {
  3: [['go', 18.1, { nojump: true }], ['until', top(0, 9)], ['wait', 10], ['go', 31.1, { nojump: true }], ['until', w => M(w).at], ['wait', 30], ['go', 35], ['enter']],
  2: [['go', 18.1, { nojump: true, until: placed6 }], ['until', top(0, 9)], ['wait', 10], ['go', 30.3, { nojump: true, until: crateAt(31.85, 32.1) }], ['mark', 'at'], ['go', 34], ['enter']],
  0: [['until', placed6], ['go', 15], ['mark', 'base0'], ['until', w => M(w).up1], ['wait', 20], ['go', 16.2], ['until', top(0, 9)], ['wait', 30], ['go', 27], ['until', w => M(w).at], ['wait', 90], ['go', 34], ['enter']],
  1: [['until', w => M(w).base0], ['go', 15], ['wait', 20], ['mark', 'up1'], ['until', top(0, 9)], ['wait', 60], ['until', w => M(w).at], ['wait', 60], ['go', 36], ['enter']],
};
// 4-7: loop lifts. 'arriving' = a platform on the bottom segment about to reach the left ground.
const plats = w => w.entities.filter(e => e.type === 'platform');
const arriving = (x0, x1) => w => plats(w).some(q => q.y >= X(17) - 1 && q.x >= X(x0) && q.x <= X(x1) && q.x - q._px < 0);
const nearPlat = (s, off) => w => { const p = w.players.find(q => q.slot === s); let best = null, bd = 1e9; for (const q of plats(w)) { const d = Math.abs(q.x + 32 - p.x) + Math.abs(q.y - p.y - 30); if (d < bd) { bd = d; best = q; } } return best.x + off * 32 + 16; };
const myPlatAtEnd = s => w => { const p = w.players.find(q => q.slot === s); return plats(w).some(q => q.x >= X(19.8) && q.y <= X(7) + 2 && Math.abs(q.y - (p.y + p.h)) < 3 && p.x + p.w > q.x && p.x < q.x + q.w); };
const ride47 = (s, off) => [['go', nearPlat(s, off)], ['until', myPlatAtEnd(s)], ['go', 24]];
const boarded = s => w => { const p = w.players.find(q => q.slot === s); return plats(w).some(q => p.onGround && Math.abs(q.y - (p.y + p.h)) < 3 && p.x + p.w > q.x && p.x < q.x + q.w); };
P['4-7'] = {
  3: [['go', 9], ['until', arriving(10, 10.3)], ['go', nearPlat(3, 0.5)], ['until', myPlatAtEnd(3)], ['go', 24], ['go', 27], ['until', past(0, 31)], ['go', 35], ['enter']],
  2: [['until', boarded(3)], ['go', 9], ['wait', 30], ['until', arriving(10, 10.3)], ['go', nearPlat(2, 0.5)], ['until', myPlatAtEnd(2)], ['go', 24], ['go', 26], ['until', past(0, 31)], ['go', 34], ['enter']],
  1: [['until', boarded(2)], ['go', 6], ['wait', 60], ['go', 9], ['until', arriving(10, 10.3)], ['go', nearPlat(1, 0.5)], ['until', myPlatAtEnd(1)], ['go', 24], ['go', 33], ['enter']],
  0: [['until', boarded(2)], ['go', 5], ['until', w => past(2, 25.5)(w) && past(1, 22)(w)], ['go', 8.5], ['until', arriving(10.5, 11)], ['go', 9], ['until', arriving(10, 10.3)], ['go', nearPlat(0, 0.5)], ['until', myPlatAtEnd(0)], ['go', 24], ['go', 32], ['enter']],
};
const overPillar = (s, c0) => w => { const p = w.players.find(q => q.slot === s); const cx = p.x + p.w / 2; return cx >= X(c0) + 16 && cx <= X(c0) + 48; };
const platOver = (c0, dir) => w => { const q = plat(w, 0); const d = q.x - q._px; return q.x <= X(c0) + 8 && q.x + q.w >= X(c0) + 56 && d * dir > 0; };
const atEnd8 = w => platIn(0, 30.9, 31.1)(w);
const dive = (s, c0, off) => [['until', overPillar(s, c0)], ['drop'], ['wait', 30], ['until', w => M(w).zeroOff && platOver(c0, 1)(w)], ['jump', 18], ['wait', 26], ['go', onPlat(0, off)], ['until', atEnd8]];
P['4-8'] = {
  1: [['go', 5.8], ['until', w => platIn(0, 6.1, 6.6)(w) && platDir(0)(w) < 0], ['jump', 18], ['wait', 30]].concat(dive(1, 13, 2), [['go', 35], ['go', 40], ['enter']]),
  2: [['go', 6.6], ['until', w => platIn(0, 6.1, 6.6)(w) && platDir(0)(w) < 0], ['jump', 18], ['wait', 30]].concat(dive(2, 18, 1), [['go', 34], ['go', 42], ['enter']]),
  3: [['go', 7.4], ['until', w => platIn(0, 6.1, 6.6)(w) && platDir(0)(w) < 0], ['jump', 18], ['wait', 30]].concat(dive(3, 23, 0), [['go', 33], ['go', 41], ['enter']]),
  0: [['go', 2], ['until', w => past(1, 12)(w)], ['go', 7.4], ['until', w => platIn(0, 6.1, 6.6)(w) && platDir(0)(w) < 0], ['jump', 18], ['wait', 30], ['go', onPlat(0, 2)], ['until', atEnd8], ['go', 36], ['mark', 'zeroOff'], ['until', w => [1, 2, 3].every(q => past(q, 31.5)(w))], ['go', 39], ['enter']],
};
const bottom = (i, y) => w => plat(w, i).y >= X(y) - 1;
const latched = w => w.entities.filter(e => e.type === 'button')[1].on;
P['4-9'] = {
  0: [['go', 3], ['until', w => latched(w) && bottom(0, 17)(w) && [1, 2, 3].every(q => w.players.find(p => p.slot === q).y > X(12))], ['go', 18.3], ['until', top(0, 8)], ['go', 33], ['enter']],
  3: [['go', 19.6, { nojump: true, until: crateAt(19.9, 20.1) }], ['until', top(0, 8)], ['go', 26.1, { nojump: true }], ['go', 22], ['go', 19.6], ['wait', 30], ['until', top(0, 8)], ['go', 35], ['enter']],
  2: [['until', crateAt(19.9, 20.1)], ['go', 18.3], ['until', top(0, 8)], ['until', crateAt(21.5, 30)], ['go', 23.2], ['until', latched], ['go', 19.3], ['wait', 30], ['until', top(0, 8)], ['go', 34], ['enter']],
  1: [['until', crateAt(19.9, 20.1)], ['wait', 30], ['go', 19], ['until', top(0, 8)], ['until', crateAt(21.5, 30)], ['go', 22.4], ['until', latched], ['wait', 40], ['go', 18.5], ['wait', 30], ['until', top(0, 8)], ['go', 36], ['enter']],
};
const ferryHome = w => platIn(0, 6, 6.7)(w) && platDir(0)(w) < 0;
const ferryEnd = platIn(0, 19.8, 20.1);
const trolleyHome = platIn(2, 37.9, 38.1);
const trolleyEnd = platIn(2, 44.9, 45.1);
const stacked = (s) => w => { const p = w.players.find(q => q.slot === s); return p.onGround && p.y < X(18) - 20; };
P['4-10'] = {
  3: [['go', 7], ['until', w => stacked(1)(w) && stacked(0)(w) && ferryHome(w)], ['jump', 18], ['wait', 30], ['until', ferryEnd], ['go', 24], ['go', 27], ['go', 29], ['jump', 18], ['wait', 30],
      ['until', top(1, 9)], ['wait', 20], ['go', 38.5], ['until', trolleyEnd], ['go', 49], ['go', 52.5], ['drop'], ['wait', 30], ['enter']],
  2: [['go', 6.2], ['until', w => stacked(1)(w) && stacked(0)(w) && ferryHome(w)], ['jump', 18], ['wait', 30], ['until', ferryEnd], ['go', 22.5], ['until', w => onP(3, 1)(w)], ['go', 26.6], ['go', 28], ['jump', 18], ['wait', 30],
      ['until', top(1, 9)], ['wait', 20], ['go', 33], ['until', w => past(3, 47.5)(w) && trolleyHome(w)], ['go', 38.5], ['until', trolleyEnd], ['go', 48.5], ['go', 51.5], ['drop'], ['wait', 30], ['enter']],
  1: [['until', past(3, 6.8)], ['go', 7], ['until', w => past(3, 47.5)(w) && w.players.find(q => q.slot === 3).onGround], ['wait', 10], ['go', 49.5], ['go', 54], ['drop'], ['wait', 30], ['enter']],
  0: [['until', past(2, 6)], ['go', 6.2], ['until', w => past(2, 47.5)(w) && w.players.find(q => q.slot === 2).onGround], ['wait', 10], ['go', 53.3], ['drop'], ['wait', 30], ['enter']],
};
if (require.main === module) for (const id of Object.keys(P)) {
  if (only.length && !only.includes(id)) continue;
  const r = run(id, P[id], { ticks: 8000 });
  console.log(report(id, r));
}
module.exports = { P };
