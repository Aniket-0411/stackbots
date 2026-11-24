'use strict';
// Designer-5 closed-loop driver: run a level with per-tick scripted "programs" per bot.
// Each program is a list of steps; a step is one of:
//   {to: tileX}           walk until the bot's center is within 3 px of tile center (or blocked 30 ticks)
//   {hold: ['right'], n}  hold keys for n ticks        {jump: true}  press jump once (1 tick)
//   {wait: n}             idle n ticks                 {until: fn(world)}  idle until fn true
//   {up: true}            press up once (interact)      {fn: (world, me) => void}  side effect
const path = require('path');
const Engine = require(path.join(__dirname, '..', '..', 'src', 'engine.js'));
const sim = require(path.join(__dirname, '..', 'sim.js'));

function run(id, programs, opts = {}) {
  const level = sim.load(id);
  const slots = opts.slots || [0, 1, 2, 3];
  const w = Engine.createWorld(level, { slots });
  const st = {}; for (const s of slots) st[s] = { i: 0, t: 0, stuck: 0, lastx: null };
  const log = []; let deaths = 0;
  const T = opts.ticks || 3000;
  for (let tick = 0; tick < T; tick++) {
    const inp = [];
    for (const s of slots) {
      const prog = programs[s] || [], S = st[s], p = w.players.find(q => q.slot === s);
      const k = { left: false, right: false, up: false, down: false, jump: false };
      let step = prog[S.i];
      while (step) {
        let done = false;
        if (step.to !== undefined) {
          const cx = p.x + p.w / 2, tx = step.to * 32 + 16, d = tx - cx;
          if ((Math.abs(d) <= (step.tol || 6) && Math.abs(p.vx) < 1.2) || ++S.t > (step.max || 120)) done = true;
          else { if (d > 0) k.right = true; else k.left = true; if (step.jump) k.jump = (S.t % 16) < 8;
            if (S.lastx !== null && Math.abs(p.x - S.lastx) < 0.01) S.stuck++; else S.stuck = 0;
            if (S.stuck > 30) done = true; }
          if (Math.abs(d) < 12 && Math.abs(d) > (step.tol || 6)) { // brake: tap only
            if (Math.abs(p.vx) > 1) { k.left = k.right = false; }
          }
        } else if (step.onto !== undefined || step.leap) {
          // closed loop: jump (pulsed) and steer toward a target bot's head / a target tile
          let tx, ty;
          if (step.leap) { tx = step.leap[0] * 32 + 16; ty = (step.leap[1] + 1) * 32; }
          else { const q = w.players.find(o => o.slot === step.onto); tx = q.x + q.w / 2; ty = q.y; }
          const cx = p.x + p.w / 2, feet = p.y + p.h, d = tx - cx;
          if (p.onGround && Math.abs(feet - ty) < 3 && Math.abs(d) < 12) done = true;
          else if (++S.t > (step.max || 240)) done = true;
          else {
            const above = feet < ty - 2;
            if (p.onGround) { if (Math.abs(d) > (step.walk || (step.leap ? 110 : 40)) && !(step.leap && Math.abs(feet - ty) < 3)) { if (d > 0) k.right = true; else k.left = true; } k.jump = (S.t % 12) < 6; }
            else if (above || Math.abs(d) > 30) { if (d > 4) k.right = true; else if (d < -4) k.left = true; k.jump = true; }
            else k.jump = true;
          }
        } else if (step.hold) { step.hold.forEach(h => k[h] = true); if (++S.t >= step.n) done = true; }
        else if (step.jump) { if (S.t === 0) { k.jump = true; S.t = 1; } else { done = true; } }
        else if (step.up) { if (S.t === 0) { k.up = true; S.t = 1; } else { done = true; } }
        else if (step.wait !== undefined) { if (++S.t >= step.wait) done = true; }
        else if (step.until) { if (step.until(w, p)) done = true; }
        else if (step.fn) { step.fn(w, p); done = true; }
        else done = true;
        if (done) { S.i++; S.t = 0; S.stuck = 0; step = prog[S.i]; if (step && (step.to !== undefined || step.hold || step.wait !== undefined || step.until || step.onto !== undefined || step.leap)) { /* start next on next tick */ break; } continue; }
        break;
      }
      S.lastx = p.x;
      inp[s] = k;
    }
    Engine.step(w, inp);
    for (const e of w.events) if (['die', 'key', 'unlock', 'enter', 'clear', 'spring', 'crumble', 'gate', 'press', 'lever'].includes(e.t)) log.push([w.tick, e.t, e.slot, Math.round(e.x / 32), Math.round(e.y / 32)]);
    if (w.events.some(e => e.t === 'die')) { deaths++; if (opts.stopOnDeath !== false) break; }
    if (w.phase === 'clear') break;
    if (opts.each) opts.each(w, tick);
  }
  return { w, log, deaths, phase: w.phase, tick: w.tick };
}
const pos = p => `s${p.slot}(${(p.x / 32).toFixed(1)},${(p.y / 32).toFixed(1)}${p.state === 'entered' ? ' IN' : ''})`;
module.exports = { run, pos, Engine };
