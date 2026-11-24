'use strict';
// Designer-4 scripted playthrough helper (Node built-ins only).
// Each bot runs a list of commands; a command finishes before the next starts:
//   ['go', x]          walk until the bot's center x (tiles) passes x (±0.15)
//   ['goj', x]         same, but hold jump while walking (jumps up steps / gaps)
//   ['jump', n]        hold jump for n ticks (default 18), with optional dir: ['jump', n, 'right']
//   ['hold', dir, n]   hold a direction for n ticks
//   ['wait', n]        idle n ticks
//   ['until', fn]      idle until fn(world) is true
//   ['up']             press up once (enter hatch / lever)
//   ['sync', name]     wait until every bot listing this sync name has reached it
// Usage: const r = play(levelId, {0: [...], 1: [...]}, {ticks}); r.cleared, r.deaths, r.log
const sim = require('../sim.js');
const Engine = sim.Engine;

function play(id, plans, opts) {
  opts = opts || {};
  const slots = Object.keys(plans).map(Number).sort();
  const L = sim.load(id);
  const w = Engine.createWorld(L, { slots });
  const st = {}; slots.forEach(s => { st[s] = { i: 0, t: 0 }; });
  const syncs = {};
  const maxT = opts.ticks || 3000;
  let deaths = 0, cleared = false, t = 0; const log = [];
  const cx = p => (p.x + p.w / 2) / 32;
  for (; t < maxT; t++) {
    const inp = [];
    for (const s of slots) {
      const o = inp[s] = { left: false, right: false, up: false, down: false, jump: false };
      const p = w.players.find(q => q.slot === s);
      const S = st[s]; const plan = plans[s];
      let guard = 0;
      while (S.i < plan.length && guard++ < 5) {
        const c = plan[S.i];
        let done = false;
        if (c[0] === 'go' || c[0] === 'goj') {
          const d = c[1] - cx(p);
          if (S.t === 0) S.dir = Math.sign(d);
          if (Math.abs(d) < 0.15 || (c[0] === 'goj' && d * S.dir < 0)) done = true;
          else { o[d > 0 ? 'right' : 'left'] = true; if (c[0] === 'goj') o.jump = (S.t % 30) < 20; }
        } else if (c[0] === 'jump') {
          if (S.t === 0 && !p.onGround && !c[3]) { S.t = -1; }          // wait until grounded (c[3] = allow air)
          else if (S.t >= (c[1] || 18) + 1) done = true; else { o.jump = S.t >= 1; if (c[2]) o[c[2]] = true; }  // 1 released tick so the press registers
        } else if (c[0] === 'hold') {
          if (S.t >= c[2]) done = true; else o[c[1]] = true;
        } else if (c[0] === 'wait') {
          if (S.t >= c[1]) done = true;
        } else if (c[0] === 'until') {
          if (c[1](w)) done = true;
        } else if (c[0] === 'up') {
          if (S.t === 0) o.up = true; else if (S.t >= 2) done = true;
        } else if (c[0] === 'sync') {
          (syncs[c[1]] = syncs[c[1]] || new Set()).add(s);
          const need = slots.filter(q => plans[q].some(k => k[0] === 'sync' && k[1] === c[1]));
          if (need.every(q => syncs[c[1]].has(q))) done = true;
        }
        if (done) { S.i++; S.t = 0; if (opts.trace) log.push(`${t} s${s} done ${JSON.stringify(c[0] === 'until' ? 'until' : c)} @(${cx(p).toFixed(2)},${(p.y / 32).toFixed(2)})`); continue; }
        S.t++; break;
      }
    }
    const before = w.phase;
    Engine.step(w, inp);
    if (before === 'play' && w.phase === 'dead') { deaths++; log.push(`${t} DEATH slot ${w.deadSlot}`); break; }
    if (w.phase === 'clear') { cleared = true; break; }
  }
  const pos = w.players.map(p => `${p.slot}:(${cx(p).toFixed(2)},${(p.y / 32).toFixed(2)})${p.onGround ? 'g' : 'a'}${p.state === 'entered' ? 'E' : ''}${p.hasKey ? 'K' : ''}`).join(' ');
  const stuck = slots.filter(s => st[s].i < plans[s].length).map(s => `s${s}@cmd${st[s].i}:${JSON.stringify(plans[s][st[s].i][0] === 'until' ? 'until' : plans[s][st[s].i])}`);
  return { cleared, deaths, ticks: t, pos, stuck, log, world: w, gears: w.gearsTaken + '/' + w.gears.length };
}

function report(name, r) {
  console.log(`${name}: ${r.cleared ? 'CLEAR' : 'FAIL'} t=${r.ticks} deaths=${r.deaths} gears=${r.gears} | ${r.pos}${r.stuck.length ? ' | stuck ' + r.stuck.join(' ') : ''}`);
  if (!r.cleared && r.log.length) console.log('   ' + r.log.slice(-6).join('\n   '));
}

module.exports = { play, report };
