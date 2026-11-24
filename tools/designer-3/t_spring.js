'use strict';
// Designer-3 engine probes for world 6 mechanics.
const sim = require('../sim.js');
function lvl(map, ents) { return { id: 't', name: 't', hint: '', minPlayers: 2, tether: false, map, entities: ents || [] }; }
const W = 30;
const row = s => s.padEnd(W, '.');
const base = [];
for (let r = 0; r < 18; r++) base.push(row(''));
function mk(lines) { const m = base.slice(); for (const [r, s] of lines) m[r] = s.padEnd(W, '.').slice(0, W); return m; }
// Probe 1: spring apex. spring at col 5 row 15, floor row 16.
let m = mk([[15, '.1234*..............D'], [16, '#'.repeat(W)], [17, '#'.repeat(W)]]);
let minY = 1e9;
let r = sim.run(lvl(m), { ticks: 200, script: [{ from: 0, to: 18, slot: 3, hold: ['right'] }], each: w => { const p = w.players[3]; minY = Math.min(minY, p.y + p.h); } });
console.log('P1 spring apex: feet min y', minY.toFixed(1), '-> tiles above floor(512):', ((512 - minY) / 32).toFixed(2));
// Probe 2: Teal on Coral's head, Coral walks onto spring
m = mk([[15, '..21*..........3.4...D'], [16, '#'.repeat(W)], [17, '#'.repeat(W)]]);
let mt = 1e9, mb = 1e9, mid = [];
r = sim.run(lvl(m), { ticks: 260, script: [
  { at: 0, slot: 1, press: 'jump' }, { from: 0, to: 12, slot: 1, hold: ['right'] },
  { from: 50, to: 62, slot: 0, hold: ['right'] }, { from: 50, to: 62, slot: 1, hold: ['right'] },
], each: (w, t) => { mb = Math.min(mb, w.players[0].y + 30); mt = Math.min(mt, w.players[1].y + 30); if (t === 49) mid.push('t49 s1 y', w.players[1].y.toFixed(1), 's0 y', w.players[0].y.toFixed(1)); } });
console.log('P2', mid.join(' '), '| min feet: bottom', ((512 - mb) / 32).toFixed(2), 'top', ((512 - mt) / 32).toFixed(2), 'tiles');
// Probe 3: crumble timing
m = mk([[12, '.1234...'], [13, '.====...'], [15, '...................D'], [16, '#'.repeat(W)], [17, '#'.repeat(W)]]);
let goneAt = -1;
r = sim.run(lvl(m), { ticks: 400, each: (w, t) => { if (goneAt < 0 && w.crumble['1,13'] && w.crumble['1,13'].gone) goneAt = t; } });
console.log('P3 crumble gone at tick', goneAt, 'state', JSON.stringify(r.world.crumble['1,13']));
// Probe 4: conveyor against walking speed
m = mk([[15, '.1234...............D'], [16, '##<<<<<<<<<<<<<<<<<<<<<<<#####'], [17, '#'.repeat(W)]]);
r = sim.run(lvl(m), { ticks: 120, script: [{ from: 0, to: 120, slot: 3, hold: ['right'] }] });
console.log('P4 slot3 walking right on < for 120 ticks: x', r.world.players[3].x.toFixed(1), 'start', 32 * 4 + 4);
