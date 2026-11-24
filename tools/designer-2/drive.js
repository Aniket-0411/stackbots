#!/usr/bin/env node
'use strict';
// Designer-2 goal-driven bot driver on top of src/engine.js (Node built-ins only).
// Each slot runs a list of tasks in order:
//   ['go', col]          walk to tile column col (center); auto-jumps when blocked
//   ['go', col, {nojump:true}]
//   ['hold', dir, n]     hold a key ('left','right','jump','down','up') for n ticks
//   ['jump', n=14]       hold jump n ticks         ['drop']  down+jump (drop through one-way)
//   ['up']               press Up once (hatch / lever)
//   ['wait', n]          idle n ticks              ['until', fn(world, me)]  idle until fn true
//   ['enter']            walk to the hatch and press Up until inside
//   ['mark', name]       sets marks[name] = tick (other bots can wait on it via ['until', w => M.name])
// run(levelId, plans, {ticks}) -> {cleared, tick, deaths, world, marks, trace}
const path = require('path');
const sim = require(path.join(__dirname, '..', 'sim.js'));
const Engine = sim.Engine;

function run(id, plans, opts = {}) {
  const L = sim.load(id);
  const slots = Object.keys(plans).map(Number);
  const w = Engine.createWorld(L, { slots });
  const st = {}; const M = {}; w._marks = M;
  for (const s of slots) st[s] = { i: 0, t: 0, stuck: 0, jt: 0, lastX: null };
  const maxT = opts.ticks || 6000;
  let deaths = 0; const trace = [];
  const me = s => w.players.find(p => p.slot === s);
  for (let tick = 0; tick < maxT; tick++) {
    const inp = [];
    for (const s of slots) {
      const o = inp[s] = { left: false, right: false, up: false, down: false, jump: false };
      const S = st[s], p = me(s), plan = plans[s];
      if (!p || p.state !== 'active') continue;
      if (S.jt > 0) { o.jump = true; S.jt--; }
      let guard = 0;
      while (S.i < plan.length && guard++ < 5) {
        const task = plan[S.i], kind = task[0];
        let done = false;
        if (kind === 'go' || kind === 'enter') {
          const tx = kind === 'enter' ? w.door.x + w.door.w / 2 : typeof task[1] === 'function' ? task[1](w) : task[1] * 32 + 16;
          const cx = p.x + p.w / 2, dx = tx - cx;
          if (task[2] && task[2].until && task[2].until(w, p, M)) { done = true; S.i++; S.t = 0; S.stuck = 0; continue; }
          const d = w.door, ov = kind === 'enter' && w.door.open && p.x < d.x + d.w && p.x + p.w > d.x && p.y < d.y + d.h && p.y + p.h > d.y;
          if (ov) { if (S.t % 4 === 0) o.up = true; S.t++; }
          else if (Math.abs(dx) < 4 && (p.onGround || kind === 'enter')) {
            if (kind === 'enter') { if (S.t % 4 === 0) o.up = true; S.t++; }
            else done = true;
          } else {
            if (Math.abs(dx) >= 4) { if (dx > 0) o.right = true; else o.left = true; }
            const moved = S.lastX == null ? 99 : Math.abs(p.x - S.lastX);
            if (p.onGround && Math.abs(dx) >= 4 && moved < 0.3) S.stuck++; else S.stuck = 0;
            if (S.stuck > 3 && !(task[2] && task[2].nojump) && S.jt === 0) { S.jt = 16; o.jump = true; S.stuck = -22; }
          }
        } else if (kind === 'hold') {
          o[task[1]] = true; if (++S.t >= task[2]) done = true;
        } else if (kind === 'jump') {
          if (S.t === 0) S.jt = task[1] || 14; o.jump = true; if (++S.t >= 2) done = true;
        } else if (kind === 'leap') {
          // ['leap', col]: jump now and steer toward col; done once landed
          const tx = task[1] * 32 + 16, dx = tx - (p.x + p.w / 2);
          if (S.t === 0) { S.jt = 18; o.jump = true; }
          if (Math.abs(dx) >= 3) { if (dx > 0) o.right = true; else o.left = true; }
          if (++S.t > 6 && p.onGround) done = true;
        } else if (kind === 'runjump') {
          // ['runjump', takeoffCol, landCol]: run toward landCol, jump when passing takeoffCol (center)
          const tx = task[2] * 32 + 16, cx = p.x + p.w / 2, dir = tx > cx ? 1 : -1, to = task[1] * 32 + 16;
          if (dir > 0) o.right = true; else o.left = true;
          if (!S.fired && (dir > 0 ? cx >= to : cx <= to) && p.onGround) { S.fired = true; S.jt = 18; o.jump = true; S.t = 1; }
          if (S.fired && ++S.t > 6 && p.onGround) { S.fired = false; done = true; }
          if (S.fired && Math.abs(tx - cx) < 4) { o.right = o.left = false; }
        } else if (kind === 'drop') {
          o.down = true; if (S.t === 1) o.jump = true; if (++S.t >= 4) done = true;
        } else if (kind === 'up') {
          if (S.t === 0) o.up = true; if (++S.t >= 3) done = true;
        } else if (kind === 'wait') {
          if (++S.t >= task[1]) done = true;
        } else if (kind === 'until') {
          if (task[1](w, p, M)) done = true;
        } else if (kind === 'mark') {
          M[task[1]] = tick; done = true;
        }
        if (done) { S.i++; S.t = 0; S.stuck = 0; continue; }
        break;
      }
      S.lastX = p.x;
    }
    const before = w.phase;
    for (const e of w.entities) if (e.type === 'platform') e._px = e.x;
    Engine.step(w, inp);
    if (before === 'play' && w.phase === 'dead') {
      deaths++;
      trace.push(`t${tick} DEAD slot ${w.deadSlot}`);
      return { cleared: false, tick, deaths, world: w, marks: M, trace, st };
    }
    if (w.phase === 'clear') return { cleared: true, tick, deaths, world: w, marks: M, trace, st };
    if (opts.each) opts.each(w, tick);
  }
  return { cleared: false, tick: maxT, deaths, world: w, marks: M, trace, st };
}

function report(id, r) {
  const w = r.world;
  const bots = w.players.map(p => `${p.slot}:(${Math.floor((p.x + 12) / 32)},${Math.floor((p.y + 29) / 32)})${p.state === 'entered' ? 'IN' : ''}${p.hasKey ? '+K' : ''}`).join(' ');
  const tasks = Object.keys(r.st).map(s => `${s}@${r.st[s].i}`).join(' ');
  return `${id}: ${r.cleared ? 'CLEARED' : 'not cleared'} t=${r.tick} gears=${w.gearsTaken}/${w.gears.length} bots ${bots} tasks ${tasks} ${r.trace.join(' ')}`;
}

module.exports = { run, report };
