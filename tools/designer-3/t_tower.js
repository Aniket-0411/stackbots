'use strict';
// Designer-3 probe: N-bot stack walks onto a spring next to a wall whose top is H tiles above the spring floor;
// the top bot steers right at the apex. Prints whether the top bot ends up on the ledge.
const sim = require('../sim.js');
const W = 30, R = 24;
function test(n, H) {
  const m = []; for (let r = 0; r < R; r++) m.push('.'.repeat(W));
  const floor = 21; // spring row 21, floor row 22
  const s = Array(W).fill('.');
  s[2] = '1'; s[1] = '2'; s[0] = '3'; s[4] = '4'; // will reorder spawns below
  m[floor] = '.'.repeat(W); m[22] = '#'.repeat(W); m[23] = '#'.repeat(W);
  for (let r = floor + 1 - H; r <= floor; r++) m[r] = m[r].slice(0, 6) + '#'.repeat(W - 6);
  const row = m[floor].split('');
  row[5] = '*';
  // bottom = slot0 at col 3; climbers slot1..n-1 at cols 2,1,0 ; spare at col 4?
  row[3] = '1'; row[2] = '2'; row[1] = '3'; row[0] = '4';
  m[floor] = row.join('');
  m[floor - H] = m[floor - H].slice(0, 20) + 'D' + m[floor - H].slice(21);
  const lv = { id: 't', name: 't', hint: '', minPlayers: 2, tether: false, map: m, entities: [] };
  // climb: slot k jumps right onto stack (k=1..n-1), each lands on previous
  const script = []; let t = 5;
  for (let k = 1; k < n; k++) {
    script.push({ from: t, to: t + 22, slot: k, hold: ['jump'] });
    script.push({ from: t, to: t + 11 + k, slot: k, hold: ['right'] });
    t += 45;
  }
  // bottom walks onto spring carrying riders
  const go = t + 10;
  script.push({ from: go, to: go + 26, slot: 0, hold: ['right'] });
  // top steers right from launch on
  script.push({ from: go + 40, to: go + 160, slot: n - 1, hold: ['right'] });
  let stackOk = false, minFeet = 1e9;
  const r = sim.run(lv, { slots: [0, 1, 2, 3], ticks: go + 260, script, each: (w, tt) => {
    if (tt === go - 1) { const P = w.players; stackOk = true; for (let k = 1; k < n; k++) if (Math.abs(P[k].y + 30 - P[k - 1].y) > 1 || Math.abs(P[k].x - P[0].x) > 16) stackOk = false; }
    minFeet = Math.min(minFeet, w.players[n - 1].y + 30);
  } });
  const top = r.world.players[n - 1];
  const onLedge = top.onGround && top.x > 6 * 32 && Math.abs(top.y + 30 - (floor + 1 - H) * 32) < 1;
  console.log(`n=${n} H=${H} stackBuilt=${stackOk} topFeetRise=${((704 - minFeet) / 32).toFixed(2)} onLedge=${onLedge} deaths=${r.deaths}`);
}
for (const [n, H] of [[1, 5], [1, 6], [2, 6], [2, 7], [3, 7], [3, 8], [4, 8], [4, 9]]) test(n, H);
