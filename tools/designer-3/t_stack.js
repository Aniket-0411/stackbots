'use strict';
const sim = require('../sim.js');
const W = 30;
function lvl(map, ents) { return { id: 't', name: 't', hint: '', minPlayers: 2, tether: false, map, entities: ents || [] }; }
function mk(lines) { const m = []; for (let r = 0; r < 18; r++) m.push('.'.repeat(W)); for (const [r, s] of lines) m[r] = s.padEnd(W, '.').slice(0, W); return m; }
const m = mk([[15, '..21*..........3.4...D'], [16, '#'.repeat(W)], [17, '#'.repeat(W)]]);
for (const h of [3, 4, 5, 6, 7, 8]) {
  let onHead = false, mt = 1e9, mb = 1e9;
  sim.run(lvl(m), { ticks: 200, script: [
    { from: 3, to: 20, slot: 1, hold: ['jump'] }, { from: 3, to: 3 + h, slot: 1, hold: ['right'] },
    { from: 60, to: 72, slot: 0, hold: ['right'] },
  ], each: (w, t) => { if (t === 59) onHead = w.players[1].y < 460 && Math.abs(w.players[1].x - w.players[0].x) < 20; if (t > 60) { mb = Math.min(mb, w.players[0].y + 30); mt = Math.min(mt, w.players[1].y + 30); } } });
  console.log('hold', h, 'onHead', onHead, 'bottom rise', ((512 - mb) / 32).toFixed(2), 'top rise', ((512 - mt) / 32).toFixed(2));
}
