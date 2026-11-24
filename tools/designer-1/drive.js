#!/usr/bin/env node
// Closed-loop "autopilot" for proving maneuvers with the real engine (designer-1).
//   const { drive } = require('./drive.js');
//   drive('1-8', [ {s:0, go:18}, {s:1, go:17}, {s:1, jump:18}, ... ], {slots:[0,1,2,3]})
// Commands run one after another. Each command:
//   {s, go: col}            walk (and fall) until bot s stands centred in column col
//   {s:[a,b], go:[c1,c2]}   several bots walk in parallel
//   {s, jump: col}          full-height jump steering to column col; done when landed & settled
//   {s, up: true}           one Up press (enter hatch); {s, down:true} one Down press
//   {wait: n}               idle ticks
// Returns {ok, failed, world, t}. Prints a trace with --v.
'use strict';
const path = require('path');
const sim = require('../sim.js');
const Engine = sim.Engine;

function ctrl(p, tx, inAir) {
  const dx = tx - p.x, v = p.vx;
  const dec = inAir ? 0.35 : 0.6;
  const brake = (v * v) / (2 * dec);
  const inp = {};
  if (Math.abs(dx) < 1.2 && Math.abs(v) < 0.35) return inp;
  if (dx > 0) { if (dx > brake + 0.6) inp.right = true; else if (v > 0.05 && inAir) inp.left = true; }
  else { if (-dx > brake + 0.6) inp.left = true; else if (v < -0.05 && inAir) inp.right = true; }
  return inp;
}

function drive(idOrLevel, cmds, opts) {
  opts = opts || {};
  const slots = opts.slots || [0, 1, 2, 3];
  const level = sim.load(idOrLevel);
  const world = Engine.createWorld(level, { slots });
  const P = (s) => world.players.find((p) => p.slot === s);
  let t = 0;
  const log = [];
  const say = (m) => { log.push(`[${t}] ${m}`); if (opts.v) console.log(`[${t}] ${m}`); };
  // expand {enter: col}: the cell carrier first, then everyone else, each walks to the hatch and presses Up
  const expanded = [];
  for (const c of cmds) {
    if (c.enter == null) { expanded.push(c); continue; }
    expanded.push({ enterAll: c.enter, order: c.order });
  }
  cmds = expanded;
  for (let ci = 0; ci < cmds.length; ci++) {
    let c = cmds[ci];
    if (c.enterAll != null) {
      const order = (c.order || slots).slice().sort((a, b) => (P(b).hasKey ? 1 : 0) - (P(a).hasKey ? 1 : 0));
      const seq = [].concat(...order.map((s) => [{ s, go: c.enterAll }, { s, up: true }, { wait: 3 }]));
      cmds = cmds.slice(0, ci).concat(seq, cmds.slice(ci + 1));
      c = cmds[ci];
    }
    const who = c.s == null ? [] : [].concat(c.s);
    const tgt = c.go != null ? [].concat(c.go) : c.jump != null ? [c.jump] : [];
    let ticks = 0, left = false, done = false;
    const limit = c.limit || 600;
    while (!done && ticks < limit) {
      const inputs = {};
      if (c.wait != null) { if (ticks >= c.wait) { done = true; break; } }
      else if (c.up || c.down) {
        if (ticks === 0) inputs[who[0]] = c.up ? { up: true } : { down: true };
        if (ticks >= 2) { done = true; break; }
      } else if (c.go != null) {
        let all = true;
        who.forEach((s, i) => {
          const p = P(s), tx = (tgt[i] != null ? tgt[i] : tgt[0]) * 32 + 4;
          const inp = ctrl(p, tx, !p.onGround);
          // auto-hop: blocked while walking on the ground -> jump (holds jump while rising)
          const k = 'stuck' + s;
          if (p.onGround && (inp.left || inp.right) && Math.abs(p.vx) < 0.15) c[k] = (c[k] || 0) + 1; else if (p.onGround) c[k] = 0;
          if (c[k] >= 3 && !c.nohop) { inp.jump = true; c['hop' + s] = 30; c[k] = 0; }
          if (c['hop' + s] > 0) { inp.jump = true; c['hop' + s]--; if (p.onGround && c['hop' + s] < 28) c['hop' + s] = 0; }
          inputs[s] = inp;
          if (!(p.onGround && Math.abs(tx - p.x) < 1.5 && Math.abs(p.vx) < 0.35)) all = false;
        });
        if (all && ticks > 1) { done = true; break; }
      } else if (c.leap != null) {
        // running jump: run toward c.leap, take off when the trailing edge is about to leave column c.edge
        const p = P(who[0]), tx = c.leap * 32 + 4, dir = tx > p.x ? 1 : -1;
        const inp = {};
        if (!c.took) {
          inp[dir > 0 ? 'right' : 'left'] = true;
          const gone = dir > 0 ? p.x >= (c.edge + 1) * 32 - 3 : p.x + 24 <= c.edge * 32 + 3;
          if (gone || (!p.onGround && ticks > 0)) { inp.jump = true; c.took = ticks; }
        } else {
          Object.assign(inp, ctrl(p, tx, !p.onGround));
          if (ticks - c.took < 40) inp.jump = true;
          if (!p.onGround) left = true;
          if (left && p.onGround && Math.abs(tx - p.x) < 2 && Math.abs(p.vx) < 0.35) done = true;
        }
        inputs[who[0]] = inp;
        if (done) break;
      } else if (c.jump != null) {
        const p = P(who[0]), tx = c.jump * 32 + 4;
        // tick 0: release everything (so the press registers), tick 1: press jump, hold while rising
        const inp = ticks < 3 ? {} : ctrl(p, tx, true);
        if (ticks >= 1 && (ticks === 1 || (ticks < 40 && !c.short && !(left && p.onGround)))) inp.jump = true;
        if (ticks >= 1 && ticks < 3 && Math.abs(tx - p.x) > 4) inp[tx > p.x ? 'right' : 'left'] = true;
        if (!p.onGround) left = true;
        if (left && p.onGround && Math.abs(tx - p.x) < 2 && Math.abs(p.vx) < 0.35) { done = true; }
        if (left && p.onGround && ticks > 120) done = true;
        inputs[who[0]] = inp;
        if (done) break;
      }
      Engine.step(world, inputs);
      t++; ticks++;
      if (opts.each) opts.each(world, t);
      if (world.phase === 'dead') { say(`DEAD slot ${world.deadSlot} during cmd ${ci} ${JSON.stringify(c)}`); return { ok: false, failed: ci, world, t, log }; }
      if (world.phase === 'clear') { say('CLEAR'); return { ok: true, world, t, log, cleared: true }; }
    }
    if (!done) { say(`TIMEOUT cmd ${ci} ${JSON.stringify(c)} ` + who.map((s) => `s${s}@(${(P(s).x / 32).toFixed(2)},${(P(s).y / 32).toFixed(2)}) g${P(s).onGround}`).join(' ')); return { ok: false, failed: ci, world, t, log }; }
    if (opts.v) say(`ok ${JSON.stringify(c)} -> ` + who.map((s) => `s${s}@(${((P(s).x - 4) / 32).toFixed(2)},${((P(s).y - 2) / 32).toFixed(2)})`).join(' '));
  }
  // settle
  for (let i = 0; i < 200 && world.phase === 'play'; i++) { Engine.step(world, {}); t++; }
  return { ok: world.phase === 'clear', world, t, log, cleared: world.phase === 'clear' };
}

function status(world) {
  return world.players.map((p) => `s${p.slot}:${p.state}@(${((p.x - 4) / 32).toFixed(1)},${((p.y - 2) / 32).toFixed(1)})${p.hasKey ? 'K' : ''}`).join(' ') +
    ` gears ${world.gearsTaken}/${world.gears.length} door ${world.door.open ? 'open' : 'locked'} phase ${world.phase}`;
}

module.exports = { drive, status, Engine, sim };
