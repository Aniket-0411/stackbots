'use strict';
// Designer-5 helper: build level maps programmatically (exact coordinates), emit world JSON.
// Node built-ins only.
const fs = require('fs');
const path = require('path');

class Lvl {
  constructor(id, name, w, h, opts = {}) {
    this.id = id; this.name = name; this.w = w; this.h = h;
    this.hint = opts.hint || ''; this.minPlayers = opts.minPlayers || 2;
    this.tether = !!opts.tether; this.tetherLength = opts.tetherLength || 5;
    this.m = Array.from({ length: h }, () => Array(w).fill('.'));
    this.ents = [];
  }
  chk(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) throw new Error(`${this.id}: (${x},${y}) out of map`); }
  // fill rect x..x+w-1, y..y+h-1
  rect(x, y, w, h, ch = '#') { for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) { this.chk(c, r); this.m[r][c] = ch; } return this; }
  // fill inclusive box x0..x1, y0..y1
  box(x0, y0, x1, y1, ch = '#') { return this.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, ch); }
  set(x, y, ch) { this.chk(x, y); this.m[y][x] = ch; return this; }
  str(x, y, s) { for (let i = 0; i < s.length; i++) this.set(x + i, y, s[i]); return this; }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? '#' : this.m[y][x]; }
  ent(o) { this.ents.push(o); return this; }
  crate(x, y, o = {}) { return this.ent(Object.assign({ type: 'crate', x, y, w: 1, h: 1, need: 1 }, o)); }
  button(x, y, channel, o = {}) { return this.ent(Object.assign({ type: 'button', x, y, w: 1, channel, need: 1, mode: 'hold' }, o)); }
  lever(x, y, channel, on = false) { return this.ent({ type: 'lever', x, y, channel, on }); }
  gate(x, y, w, h, channel, o = {}) { return this.ent(Object.assign({ type: 'gate', x, y, w, h, channel }, o)); }
  platform(x, y, w, pathPts, o = {}) { return this.ent(Object.assign({ type: 'platform', x, y, w, path: pathPts, speed: 1.0 }, o)); }
  saw(x, y, pathPts, speed, o = {}) { const e = { type: 'saw', x, y }; if (pathPts) { e.path = pathPts; e.speed = speed; e.mode = o.mode || 'pingpong'; } return this.ent(e); }
  laser(x, y, dir, o = {}) { return this.ent(Object.assign({ type: 'laser', x, y, dir }, o)); }
  toJSON() {
    return { id: this.id, name: this.name, hint: this.hint, minPlayers: this.minPlayers, tether: this.tether,
      tetherLength: this.tetherLength, map: this.m.map(r => r.join('')), entities: this.ents };
  }
  print() {
    const tens = Array.from({ length: this.w }, (_, i) => (i % 10 === 0 ? String((i / 10) % 10) : ' ')).join('');
    const ones = Array.from({ length: this.w }, (_, i) => String(i % 10)).join('');
    const lines = [`${this.id} ${this.name} ${this.w}x${this.h}`, '   ' + tens, '   ' + ones];
    const ov = this.m.map(r => r.slice());
    for (const e of this.ents) {
      const mark = { crate: 'C', button: '_', lever: 'L', gate: '|', platform: 'P', saw: 'S', laser: 'Z' }[e.type];
      const w = e.type === 'gate' || e.type === 'crate' || e.type === 'platform' || e.type === 'button' ? (e.w || 1) : 1;
      const h = e.type === 'gate' || e.type === 'crate' ? (e.h || 1) : 1;
      for (let r = e.y; r < e.y + h; r++) for (let c = e.x; c < e.x + w; c++) if (ov[r] && ov[r][c] !== undefined) ov[r][c] = mark;
      if (e.type === 'saw' && e.path) for (const p of e.path.slice(1)) if (ov[p[1]] && ov[p[1]][p[0]] === '.') ov[p[1]][p[0]] = 's';
      if (e.type === 'platform') for (const p of e.path.slice(1)) for (let c = p[0]; c < p[0] + e.w; c++) if (ov[p[1]] && ov[p[1]][c] === '.') ov[p[1]][c] = 'p';
    }
    ov.forEach((r, i) => lines.push(String(i).padStart(2) + ' ' + r.join('')));
    return lines.join('\n');
  }
}

function fmtWorld(world) {
  const out = [];
  out.push('{');
  out.push(`  "world": ${world.world},`);
  out.push(`  "name": ${JSON.stringify(world.name)},`);
  out.push(`  "theme": ${JSON.stringify(world.theme)},`);
  out.push('  "levels": [');
  world.levels.forEach((L, i) => {
    const j = L.toJSON();
    out.push('    {');
    for (const k of ['id', 'name', 'hint', 'minPlayers', 'tether', 'tetherLength']) out.push(`      ${JSON.stringify(k)}: ${JSON.stringify(j[k])},`);
    out.push('      "map": [');
    j.map.forEach((row, ri) => out.push(`        ${JSON.stringify(row)}${ri < j.map.length - 1 ? ',' : ''}`));
    out.push('      ],');
    out.push('      "entities": [');
    j.entities.forEach((e, ei) => out.push(`        ${JSON.stringify(e).replace(/,"/g, ', "').replace(/":/g, '": ')}${ei < j.entities.length - 1 ? ',' : ''}`));
    out.push('      ]');
    out.push(`    }${i < world.levels.length - 1 ? ',' : ''}`);
  });
  out.push('  ]');
  out.push('}');
  return out.join('\n') + '\n';
}

function writeWorld(world, file) {
  fs.writeFileSync(file, fmtWorld(world));
}

module.exports = { Lvl, fmtWorld, writeWorld, ROOT: path.resolve(__dirname, '..', '..') };
