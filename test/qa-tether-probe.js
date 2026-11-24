'use strict';
// QA probe (not part of test/run.js): can a tether rope haul a bot up over a ledge lip?
// SPEC §7 only promises "a grounded bot can anchor a dangling partner"; world-7 levels assume hauling/reeling works.
// Usage: node test/qa-tether-probe.js
const { loadEngine, Sim, MapB, feet } = require('./qa-lib.js');
const { E, why } = loadEngine();
if (!E) { console.log('SKIP: ' + why); process.exit(0); }

function pit(len, anchorUp) {
  // flat floor top y=320 (row 10); 2-wide pit at cols 30-31; optional 1-tile step under the anchor (cols 0-27)
  let ok = 0, tried = 0, best = 1e9;
  for (const aj of [0, 10, 25, 40]) for (const dl of [0, 1]) for (const dj of [0, 7, 20]) {
    tried++;
    const mb = new MapB(60, 22, 10); mb.fill(30, 10, 31, 19, '.'); mb.fill(30, 20, 31, 21, '#');
    if (anchorUp) mb.fill(0, 9, 27, 9, '#');
    mb.set(5, anchorUp ? 8 : 9, 'D').sp(0, 26, anchorUp ? 8 : 9).sp(1, 29, 9).sp(2, 2, anchorUp ? 8 : 9).sp(3, 3, anchorUp ? 8 : 9);
    const s = new Sim(E, mb.level({ tether: true, tetherLength: len }), [0, 1]);
    s.place(0, 26 * 32 + 4, anchorUp ? 288 : 320); s.place(1, 30 * 32 + 4, 320); s.step(82);
    s.hold(0, 'left'); if (dl) s.hold(1, 'left');
    for (let t = 0; t < 500; t++) {
      if (aj && t % aj === 0) s.press(0, 'jump'); if (dj && t % dj === 0) s.press(1, 'jump');
      s.step(1); best = Math.min(best, feet(s.p(1)) - 320);
      if (s.p(1).onGround && feet(s.p(1)) <= 320.5) { ok++; break; }
      if (s.w.phase !== 'play') break;
    }
  }
  return `rope ${len}, anchor ${anchorUp ? '1 tile ABOVE' : 'level with'} the lip: dangler hauled out in ${ok}/${tried} input variants (closest: feet ${best.toFixed(1)} px below the lip)`;
}
for (const len of [4, 5, 6]) console.log(pit(len, false));
for (const len of [5]) console.log(pit(len, true));
