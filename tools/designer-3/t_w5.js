'use strict';
// Designer-3: scripted checks of key world-5 maneuvers.  node tools/designer-3/t_w5.js
const sim = require('../sim.js');
const E = sim.Engine;
function variant(id, edit) { const lv = JSON.parse(JSON.stringify(sim.find(id).json)); edit(lv); return lv; }
function setRow(lv, r, c, str) { const row = lv.map[r].split(''); for (let i = 0; i < str.length; i++) row[c + i] = str[i]; lv.map[r] = row.join(''); }
function clearDigits(lv) { lv.map = lv.map.map(r => r.replace(/[1-4]/g, '.')); }
// 5-8: bots placed on the lift in stripe order rise; wrong order stalls
for (const [label, order] of [['right order', '2.4.1.3.'], ['wrong order', '1.2.3.4.']]) {
  const lv = variant('5-8', lv => { clearDigits(lv); setRow(lv, 17, 12, order); });
  const r = sim.run(lv, { ticks: 600, stopOnClear: false });
  const pl = r.world.entities.find(e => e.type === 'platform');
  console.log('5-8', label, ': lift top y tile', (pl.y / 32).toFixed(2), '(target 6) bots feet rows', r.world.players.map(p => ((p.y + 30) / 32).toFixed(1)).join(','));
}
// 5-2 with 2 bots: Teal carries Coral over the coral bridge, swap on the pillar, Coral carries Teal over teal.
{
  const H = require('./simhelp.js');
  let st = 0; const log = [];
  const r = H.ctl('5-2', 3000, (w, t, inp) => {
    const c = H.P(w, 0), tl = H.P(w, 1);
    const go = n => { st = n; log.push(t + ':' + n); };
    if (st === 0) { if (H.hop(w, inp, 0, 1, t)) go(1); }
    if (st === 1) { if (H.walkTo(w, inp, 1, 15, 0.2)) go(2); }
    if (st === 2) { if (H.walkTo(w, inp, 0, 16, 0.2) && c.onGround && Math.abs(c.y - tl.y) < 1) go(3); }
    if (st === 3) { if (H.hop(w, inp, 1, 0, t)) go(4); }
    if (st === 4) { if (H.walkTo(w, inp, 0, 24, 0.3)) go(5); }
    if (st === 5) { for (const k of [0, 1]) { const p = H.P(w, k); if (p.state === 'active') { if (k === 1 && !p.onGround) {} if (H.walkTo(w, inp, k, k === 0 ? 28 : 37, 0.3) && k === 1) inp[k].up = t % 2 === 0; } } if (H.P(w, 1).hasKey === false && w.door.open) go(6); }
    if (st === 6) { for (const k of [0, 1]) { const p = H.P(w, k); if (p.state === 'active' && H.walkTo(w, inp, k, 37, 0.3)) inp[k].up = t % 2 === 0; } }
  }, [0, 1]);
  console.log('5-2 (2 bots) cleared=' + r.cleared + ' deaths=' + r.deaths + ' st=' + st + ' ' + log.join(' '));
}
// 5-10 bridge: both pairs swap carrier on a color boundary while standing on the trapdoor bridge.
{
  const H = require('./simhelp.js');
  for (const [a, b, swapCol] of [[0, 1, 27], [2, 3, 35]]) { // rider a on carrier b first; swap when carrier reaches swapCol
    const lv = variant('5-10', lv => { clearDigits(lv); const row = lv.map[17].split(''); const o = a === 0 ? '3412' : '1234'; for (let i = 0; i < 4; i++) row[19 + i] = o[i]; lv.map[17] = row.join(''); });
    // carrier must be the one in front (right): rider = left one
    const rider = Math.min(a, b) === a ? a : b;
    let st = 0; const log = [];
    const r = H.ctl(lv, 3000, (w, t, inp) => {
      const go = n => { st = n; log.push(t + ':' + n); };
      // carrier: for pair (0,1): Teal(1) carries Coral(0) over a; for pair (2,3): Lilac(3) carries Marigold(2) over a,b,c
      const car = a === 0 ? 1 : 3, rid = a === 0 ? 0 : 2;
      const others = [0, 1, 2, 3].filter(k => k !== car && k !== rid);
      if (st === 0) { if (H.hop(w, inp, rid, car, t)) go(1); }
      if (st === 1) { if (H.walkTo(w, inp, car, swapCol, 0.15)) go(2); }
      if (st === 2) { const pr = H.P(w, rid), pc = H.P(w, car); if (H.walkTo(w, inp, rid, swapCol + 1, 0.15) && pr.onGround && Math.abs(pr.y - pc.y) < 1) go(3); }
      if (st === 3) { if (H.hop(w, inp, car, rid, t)) go(4); }
      if (st === 4) { if (H.walkTo(w, inp, rid, 41, 0.3)) go(5); }
      if (st === 5) return 'stop';
    });
    const pc = H.P(r.w, a === 0 ? 1 : 3), pr = H.P(r.w, a === 0 ? 0 : 2);
    console.log(`5-10 bridge pair ${a}/${b}: st=${st} deaths=${r.deaths} rider col ${H.tx(pr).toFixed(1)} carrier col ${H.tx(pc).toFixed(1)} ${log.join(' ')}`);
  }
}
// 5-4: 3-tower in the nook (Coral base, Lilac middle, Marigold top); Marigold pops up through the 'cc' ceiling.
{
  const H = require('./simhelp.js');
  const lv = variant('5-4', lv => { clearDigits(lv); setRow(lv, 14, 2, '2'); setRow(lv, 14, 14, '413'); });
  let st = 0; const log = [];
  const r = H.ctl(lv, 1500, (w, t, inp) => {
    const go = n => { st = n; log.push(t + ':' + n); };
    const m = H.P(w, 2);
    if (st === 0) { const a = H.walkTo(w, inp, 2, 18, 0.1), b = H.walkTo(w, inp, 0, 17, 0.1); if (a && b) go(1); }
    if (st === 1) { if (H.hop(w, inp, 3, 0, t)) go(3); }
    if (st === 3) { if (H.hop(w, inp, 2, 3, t)) go(4); }
    if (st === 4) { inp[2].jump = true; if (m.y + 30 < 350) go(5); if (t > 1400) go(9); }
    if (st === 5) { inp[2].jump = true; inp[2].left = true; if (m.onGround) go(6); }
    if (st === 6) { if (H.walkTo(w, inp, 2, 10, 0.2)) go(7); }
    if (st === 7) return 'stop';
  });
  const m = H.P(r.w, 2), btn = r.w.entities.find(e => e.type === 'button');
  console.log(`5-4 nook tower: st=${st} Marigold col ${H.tx(m).toFixed(1)} feet ${(m.y + 30).toFixed(0)} (floor 352) latch on=${btn.on} deaths=${r.deaths} ${log.join(' ')}`);
}
