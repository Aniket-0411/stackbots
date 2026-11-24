#!/usr/bin/env node
// Proves key world-2 maneuvers with the real engine.  node tools/designer-1/prove-w2.js [id] [--v]
'use strict';
const { drive, status } = require('./drive.js');
const v = process.argv.includes('--v');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const enter = (col, order) => [].concat(...order.map((s) => [{ s, go: col }, { s, up: true }]));
const P = {};
// 2-7 with 2 bots: push A to the wall, piggyback up, drop B onto A, everyone climbs the A+B stairs.
P['2-7'] = { slots: [0, 1], cmds: [
  { s: [1, 0], go: [17.125, 16.375], nohop: true },
  { s: 1, jump: 19 }, { s: 0, jump: 18 }, { s: 0, jump: 19 }, { s: 0, jump: 20.5 },
  { s: 0, jump: 23.6 }, { s: 0, go: 19.7, nohop: true },
  { s: 1, go: 16.5 }, { wait: 30 },
  { s: 1, jump: 18 }, { s: 1, jump: 19 }, { s: 1, jump: 20.5 },
  { s: 0, go: 30 }, ...enter(33, [0, 1]) ] };
// 2-8 with 2 bots: little crate through the crawl tunnel into the pothole FIRST, then the big crate off the shelf and over it.
P['2-8'] = { slots: [0, 1], cmds: [
  { s: 1, go: 25.25, nohop: true, limit: 1500 }, { wait: 40 },
  { s: 0, go: 7 }, { s: 0, jump: 9 }, { s: 0, go: 10.375 },
  { s: 1, go: 20.5 }, { s: 1, jump: 19 }, { s: 1, go: 11.125 },
  { s: [1, 0], go: [19.25, 18.5], nohop: true, limit: 900 }, { wait: 30 },
  { s: 1, go: 7 }, { s: 0, go: 6 }, { s: [1, 0], go: [19.125, 18.375] },
  { s: [1, 0], go: [25.125, 24.375], nohop: true, limit: 900 },
  { s: 1, jump: 26.5 }, { s: 1, jump: 28.6 }, { s: 1, go: 32 }, { s: 0, go: 25.125 }, { s: 0, jump: 26.5 }, { s: 0, jump: 28.6 },
  { enter: 38 } ] };

module.exports = P;
if (require.main === module) {
  for (const id of Object.keys(P)) {
    if (only.length && !only.includes(id)) continue;
    const r = drive(id, P[id].cmds, { v, slots: P[id].slots });
    console.log(`${r.cleared ? 'CLEAR' : 'FAIL '} ${id} t=${r.t} ${status(r.world)}`);
    if (!r.cleared) r.log.slice(-2).forEach((l) => console.log('   ' + l));
  }
}
