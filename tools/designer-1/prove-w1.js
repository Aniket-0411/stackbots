#!/usr/bin/env node
// Proves world-1 solutions with the real engine via the drive.js autopilot.  node tools/designer-1/prove-w1.js [id] [--v]
'use strict';
const { drive, status } = require('./drive.js');
const v = process.argv.includes('--v');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ALL = [0, 1, 2, 3];
// everyone files in one at a time (order = nearest to the hatch first)
const enterAll = (col, order = ALL) => [].concat(...order.map((s) => [{ s, go: col }, { s, up: true }]));
const P = {};
P['1-1'] = [{ s: 0, go: 14 }, { s: ALL, go: [29, 28, 27, 26] }, ...enterAll(29)];
module.exports = P;
if (require.main === module) {
  for (const id of Object.keys(P)) {
    if (only.length && !only.includes(id)) continue;
    const r = drive(id, P[id], { v });
    console.log(`${r.cleared ? 'CLEAR' : 'FAIL '} ${id} t=${r.t} ${status(r.world)}`);
    if (!r.cleared) r.log.slice(-3).forEach((l) => console.log('   ' + l));
  }
}
