#!/usr/bin/env node
// Proves world-8 solutions with the real engine (tools/designer-1/drive.js autopilot).
//   node tools/designer-1/prove-w8.js [id ...] [--v]
'use strict';
const { drive, status } = require('./drive.js');
const v = process.argv.includes('--v');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const enter = (col, order) => [{ enter: col, order }];
const P = {};
const add = (id, slots, cmds) => { (P[id] = P[id] || []).push({ slots, cmds }); };

// 8-1: push the crate onto the belt; it delivers itself to the wall; crate + wall = stairs.
const up81 = (s) => [{ s, go: 20.125 }, { s, jump: 21 }, { s, jump: 22.6 }];
add('8-1', [0, 1, 2, 3], [{ s: 3, go: 9.0, nohop: true }, { wait: 200 },
  ...up81(3), { s: 3, go: 35 }, ...up81(2), { s: 2, go: 33 }, ...up81(1), { s: 1, go: 32 }, ...up81(0), ...enter(37, [3, 2, 1, 0])]);
add('8-1', [0, 1], [{ s: 1, go: 9.0, nohop: true }, { wait: 200 }, ...up81(1), { s: 1, go: 34 }, ...up81(0), ...enter(37, [1, 0])]);

// 8-2: hold the near button, cross, hold the far button, the first holder crosses.
add('8-2', [0, 1], [{ s: 1, go: 14 }, { s: 0, go: 22 }, { s: 1, go: 30 }, { s: 0, go: 33 }, ...enter(35, [1, 0])]);
add('8-2', [0, 1, 2, 3], [{ s: 3, go: 14 }, { s: 2, go: 22 }, { s: 1, go: 30 }, { s: 0, go: 31 }, { s: 3, go: 32 },
  { s: 2, go: 33 }, ...enter(35, [1, 0, 3, 2])]);

// 8-3: drop into the corridor, shove the shield crate past the shaft, pop up the shaft.
const out83 = (s) => [{ s, go: 28 }, { s, jump: 29.6 }];
add('8-3', [0, 1], [{ s: 1, go: 16.25 }, { s: 0, go: 15.5 }, { s: [1, 0], go: [28, 27.25], nohop: true },
  ...out83(1), { s: 1, go: 33 }, ...out83(0), ...enter(40, [1, 0])]);
add('8-3', [0, 1, 2, 3], [{ s: 3, go: 16.25 }, { s: 2, go: 15.5 }, { s: 1, go: 14.75 }, { s: 0, go: 14 },
  { s: [3, 2, 1, 0], go: [28, 27.25, 26.5, 25.75], nohop: true },
  ...out83(3), { s: 3, go: 36 }, ...out83(2), { s: 2, go: 35 }, ...out83(1), { s: 1, go: 34 }, ...out83(0), ...enter(40, [3, 2, 1, 0])]);

// 8-4: base under the shelf's left end, presser climbs onto the timer button; crossers go; presser dashes.
add('8-4', [0, 1], [{ s: 0, go: 5 }, { s: 1, jump: 5 }, { s: 1, jump: 7 }, { s: 0, go: 37 },
  { s: 1, go: 36 }, ...enter(39, [0, 1])]);
add('8-4', [0, 1, 2, 3], [{ s: 3, go: 5 }, { s: 2, jump: 5 }, { s: 2, jump: 7 },
  { s: 3, go: 38 }, { s: 1, go: 37 }, { s: 0, go: 36 }, { s: 2, go: 33 }, ...enter(39, [3, 1, 0, 2])]);

// 8-5: over the block, crate to the shutter, flip the lever, shove the crate into the room for the cell.
const back85 = (s, c) => [{ s, go: c }];
add('8-5', [0, 1], [{ s: 0, go: 22 }, { s: 1, go: 23 }, { s: [0, 1], go: [19.875, 20.625], nohop: true },
  { s: 1, go: 23 }, { s: 1, jump: 24.4 }, { s: 1, up: true }, { s: 1, go: 21 },
  { s: [0, 1], go: [4.875, 5.625], nohop: true }, { s: 1, go: 26 }, { s: 0, go: 27 }, ...enter(29, [1, 0])]);
add('8-5', [0, 1, 2, 3], [{ s: 0, go: 22 }, { s: 1, go: 23 }, { s: [0, 1], go: [19.875, 20.625], nohop: true },
  { s: 1, go: 23 }, { s: 1, jump: 24.4 }, { s: 1, up: true }, { s: 1, go: 21 },
  { s: [0, 1], go: [4.875, 5.625], nohop: true }, { s: 1, go: 26 }, { s: 0, go: 27 }, ...enter(29, [1, 0, 2, 3])]);

// 8-6: piggyback onto the shelf, shove the crate off onto the belt; it rides through the guard beam onto the button.
add('8-6', [0, 1], [{ s: 0, go: 13 }, { s: 1, jump: 13 }, { s: 1, jump: 12 }, { s: 1, go: 8.6, nohop: true },
  { wait: 240 }, { s: 1, go: 16 }, { s: 0, go: 33 }, { s: 1, go: 30 }, ...enter(37, [1, 0])]);
add('8-6', [0, 1, 2, 3], [{ s: 0, go: 13 }, { s: 1, jump: 13 }, { s: 1, jump: 12 }, { s: 1, go: 8.6, nohop: true },
  { wait: 240 }, { s: 1, go: 16 }, { s: 3, go: 35 }, { s: 2, go: 34 }, { s: 0, go: 33 }, { s: 1, go: 31 },
  ...enter(37, [1, 3, 2, 0])]);

// 8-7: everyone shoves the riot shield to the end wall, then hops onto it and out of the shaft.
const out87 = (s) => [{ s, go: 31.125 }, { s, jump: 32.5 }, { s, jump: 35 }];
add('8-7', [0, 1], [{ s: [1, 0], go: [31.125, 30.375], nohop: true, limit: 1400 }, { s: 1, jump: 32.5 }, { s: 1, jump: 35 }, { s: 1, go: 37 },
  ...out87(0), { s: 0, go: 41 }, { s: 1, go: 39.9 }, { s: 1, jump: 41 }, { s: 1, jump: 42 }, { s: 1, go: 39 }, ...enter(38, [1, 0])]);
add('8-7', [0, 1, 2, 3], [{ s: [3, 2, 1, 0], go: [31.125, 30.375, 29.625, 28.875], nohop: true, limit: 1400 },
  { s: 3, jump: 32.5 }, { s: 3, jump: 35 }, { s: 3, go: 41 }, ...out87(2), { s: 2, go: 39.9 }, { s: 2, jump: 41 }, { s: 2, jump: 42 },
  ...out87(1), { s: 1, go: 36 }, ...out87(0), { s: 0, go: 35 }, { s: 2, go: 40 }, ...enter(38, [2, 3, 1, 0])]);

// 8-8: push the crate onto the lift (it parks against the far wall) and ride up behind it; the crate
//      stays aboard as a permanent umbrella, so the lift can shuttle the rest (crate + 1 bot = 2 riders).
const trip88 = (s, first) => [{ s, go: 15.125, nohop: true }, { wait: 250 }, { s, go: first ? 9 : 10 }, { wait: 240 }];
add('8-8', [0, 1], [...trip88(1, true), { s: 1, go: 4 }, ...trip88(0), { s: 0, go: 2 }, { s: 1, jump: 2 }, { s: 1, jump: 0.5 },
  { s: 1, go: 4 }, ...enter(6, [1, 0])]);
add('8-8', [0, 1, 2, 3], [...trip88(3, true), { s: 3, go: 2 }, ...trip88(2), { s: 2, go: 3.2 }, { s: 2, jump: 2 }, { s: 2, jump: 0.5 }, { s: 2, go: 4 },
  ...trip88(1), { s: 1, go: 8 }, ...trip88(0), ...enter(6, [2, 3, 1, 0])]);

// 8-9: tower of 3 puts a bot on clock 3, a piggyback puts one on clock 1, one hops into the pit (clock 2);
//      everyone releases together and runs the hallway.
add('8-9', [0, 1, 2, 3], [{ s: 3, go: 20 }, { s: 2, go: 19 }, { s: 2, jump: 20 }, { s: 1, go: 19 }, { s: 1, jump: 20 },
  { s: 1, jump: 22 }, { s: 3, go: 7 }, { s: 2, go: 8 }, { s: 2, jump: 7 }, { s: 2, jump: 5 }, { s: 3, go: 15 },
  { s: 0, go: 26 }, { s: [1, 2, 3, 0], go: [38, 37, 39, 41], limit: 900 }, ...enter(42, [0, 3, 1, 2])]);
add('8-9', [0, 1, 2], [{ s: 2, go: 20 }, { s: 1, go: 19 }, { s: 1, jump: 20 }, { s: 0, go: 19 }, { s: 0, jump: 20 },
  { s: 0, jump: 22 }, { s: 2, go: 7 }, { s: 1, go: 8 }, { s: 1, jump: 7 }, { s: 1, jump: 5 }, { s: 2, go: 15 },
  { s: [0, 1, 2], go: [38, 37, 41], limit: 900 }, ...enter(42, [2, 0, 1])]);

// 8-10: belt step, heavy shield onto the button, out of the shaft, slow-mo hallway, four-bot tower.
const up810 = (s, c) => [{ s, go: 12.125 }, { s, jump: 13 }, { s, jump: 14.6 }, { s, go: c }];
add('8-10', [0, 1, 2, 3], [{ s: 3, go: 5.3, nohop: true }, { wait: 150 },
  ...up810(3, 19), ...up810(2, 18.25), ...up810(1, 17.5), ...up810(0, 16.75),
  { s: [3, 2, 1, 0], go: [35.125, 34.375, 33.625, 32.875], nohop: true, limit: 1400 },
  { s: 3, jump: 36.5 }, { s: 3, go: 56 }, { s: 2, go: 34.9 }, { s: 2, jump: 36.5 }, { s: 2, go: 55 }, { s: 2, jump: 56 },
  { s: 1, go: 34.9 }, { s: 1, jump: 36.5 }, { s: 1, go: 54 }, { s: 0, go: 34.9 }, { s: 0, jump: 36.5 },
  { s: 0, go: 52.9 }, { s: 0, jump: 54 }, { s: 1, jump: 56 }, { s: 0, jump: 57 }, { s: 0, go: 58 }, { wait: 30 }, { s: 0, go: 54 }, ...enter(53, [3, 2, 1, 0])]);

module.exports = P;
if (require.main === module) {
  let bad = 0;
  for (const id of Object.keys(P)) {
    if (only.length && !only.includes(id)) continue;
    for (const run of P[id]) {
      const r = drive(id, run.cmds, { v, slots: run.slots });
      if (!r.cleared) bad++;
      console.log(`${r.cleared ? 'CLEAR' : 'FAIL '} ${id} [${run.slots}] t=${r.t} ${status(r.world)}`);
      if (!r.cleared) r.log.slice(-2).forEach((l) => console.log('   ' + l.slice(0, 220)));
    }
  }
  process.exitCode = bad ? 1 : 0;
}
