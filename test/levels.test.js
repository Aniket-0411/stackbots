'use strict';
// Per-level smoke tests for every level in levels/world*.json (owned by QA).
//  - validator: no ERRORs (runs even without the engine)
//  - parseLevel; createWorld with [0,1,2,3] and [0..minPlayers-1]
//  - 600 idle ticks: no exception, no death, phase 'play', bots inside the map
//  - snapshot < 3000 bytes at start and after 600 ticks; applySnapshot round trip
//  - average step() time
// Env: QA_LEVELS=regex to filter level ids, QA_TICKS to change the idle tick count.
const path = require('path');
const fs = require('fs');
const { loadEngine, makeRunner, check, fail, r1, listWorldFiles, ROOT } = require('./qa-lib.js');
const V = require(path.join(ROOT, 'tools', 'validate-levels.js'));

const R = makeRunner('levels (all levels/world*.json)');
const files = listWorldFiles();
if (!files.length) R.skipAll('no levels/world*.json files yet');
const { E, why } = loadEngine();
const TICKS = +process.env.QA_TICKS || 600;
const filt = process.env.QA_LEVELS ? new RegExp(process.env.QA_LEVELS) : null;
const timing = [];

for (const f of files) {
  const base = path.basename(f);
  let obj = null, perr = null;
  try { obj = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { perr = e; }
  const vres = V.validateWorldFile(f, { noHeur: true });
  // An incomplete world (< 10 levels) is a WARN while designers are still writing; everything else is an ERROR.
  const partial = obj && Array.isArray(obj.levels) && obj.levels.length < 10;
  const fileErrs = vres.findings.filter(x => x.sev === 'ERROR' && !x.level && !(partial && x.code === 'levels-count'));
  R.test(`${base}: world file valid (validator, file-level)`, () => {
    if (perr) fail(`JSON parse error: ${perr.message}`);
    check(!fileErrs.length, fileErrs.map(x => x.msg).join('; '));
    if (partial) return { warn: `incomplete world: ${obj.levels.length}/10 levels (designer still writing?)` };
  });
  if (!obj || !Array.isArray(obj.levels)) continue;
  obj.levels.forEach((lv, i) => {
    const id = lv && lv.id ? lv.id : `${base}#${i + 1}`;
    if (filt && !filt.test(id)) return;
    const errs = vres.findings.filter(x => x.sev === 'ERROR' && x.level === id);
    R.test(`${id}: validator has no ERRORs`, () => {
      check(!errs.length, errs.map(x => `${x.c != null ? '[' + x.c + ',' + x.r + '] ' : ''}${x.msg}`).join('; '));
    });
    R.test(`${id}: engine parse / create / ${TICKS} idle ticks / snapshot`, () => {
      if (!E) return { skip: why };
      const meta = { world: obj.world, theme: obj.theme, worldName: obj.name, index: i };
      let level;
      try { level = E.parseLevel(JSON.parse(JSON.stringify(lv)), meta); } catch (e) { fail(`parseLevel threw: ${e.message}`); }
      const minP = Math.max(2, Math.min(4, lv.minPlayers | 0 || 4));
      const sets = [[0, 1, 2, 3]];
      if (minP < 4) sets.push([...Array(minP).keys()]);
      const cols = lv.map[0].length, rows = lv.map.length;
      for (const slots of sets) {
        const tag = `slots [${slots}]`;
        let w;
        try { w = E.createWorld(level, { slots }); } catch (e) { fail(`${tag}: createWorld threw: ${e.message}`); }
        check(w.players.length === slots.length, `${tag}: ${w.players.length} players created`);
        const s0 = JSON.stringify(E.snapshot(w));
        check(s0.length < 3000, `${tag}: snapshot at start is ${s0.length} bytes (limit 3000)`);
        const t0 = process.hrtime.bigint();
        for (let t = 0; t < TICKS; t++) {
          try { E.step(w, []); } catch (e) { fail(`${tag}: step threw at tick ${w.tick}: ${e.stack.split('\n').slice(0, 2).join(' | ')}`); }
          if (w.phase !== 'play') {
            const p = w.players.find(q => q.slot === w.deadSlot);
            fail(`${tag}: phase became '${w.phase}' at tick ${w.tick} while idle` + (w.phase === 'dead' ? ` (deadSlot ${w.deadSlot}${p ? ` at tile [${Math.floor((p.x + 12) / 32)},${Math.floor((p.y + 29) / 32)}]` : ''}) - a bot dies standing still` : ''));
          }
        }
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        timing.push({ id, slots: slots.length, ms: ms / TICKS });
        for (const p of w.players) {
          const inside = p.x >= -0.01 && p.x + p.w <= cols * 32 + 0.01 && p.y + p.h <= rows * 32 + 0.01 && p.y > -64;
          check(inside, `${tag}: slot ${p.slot} outside the map after ${TICKS} ticks: x=${r1(p.x)} y=${r1(p.y)}`);
          check(p.state === 'active', `${tag}: slot ${p.slot} state ${p.state}`);
        }
        const snap = E.snapshot(w);
        const s1 = JSON.stringify(snap);
        check(s1.length < 3000, `${tag}: snapshot after ${TICKS} ticks is ${s1.length} bytes (limit 3000)`);
        const w2 = E.createWorld(level, { slots });
        E.applySnapshot(w2, JSON.parse(s1));
        const pos = ww => ww.players.map(p => `${p.slot}:${Math.round(p.x * 10)}:${Math.round(p.y * 10)}:${p.state}`).join(' ');
        check(pos(w2) === pos(w) || w2.players.every((p, k) => Math.abs(p.x - w.players[k].x) <= 0.06 && Math.abs(p.y - w.players[k].y) <= 0.06), `${tag}: applySnapshot round trip mismatch: ${pos(w2)} vs ${pos(w)}`);
        check(w2.tick === w.tick && w2.phase === w.phase, `${tag}: applySnapshot tick/phase ${w2.tick}/${w2.phase} vs ${w.tick}/${w.phase}`);
        const s2 = JSON.stringify(E.snapshot(w2));
        const strip = s => s.replace(/"(ev|events|e)":\[[^\]]*\]/g, '');
        check(strip(s2) === strip(s1), `${tag}: snapshot(applySnapshot(snap)) differs from snap (first diff near char ${[...strip(s1)].findIndex((c, k) => c !== strip(s2)[k])})`);
      }
    });
  });
}

R.test('timing: average Engine.step() ms per tick (informational, fails only if > 2 ms)', () => {
  if (!E) return { skip: why };
  if (!timing.length) return { skip: 'no levels simulated' };
  const avg = timing.reduce((a, t) => a + t.ms, 0) / timing.length;
  const worst = timing.slice().sort((a, b) => b.ms - a.ms).slice(0, 3).map(t => `${t.id}(${t.slots}p) ${t.ms.toFixed(3)}`).join(', ');
  console.log(`  step() average ${avg.toFixed(4)} ms/tick over ${timing.length} runs; slowest: ${worst}`);
  check(avg < 2, `average step ${avg.toFixed(3)} ms is too slow for 60 Hz on weak devices`);
});

R.run();
