'use strict';
// Tiny map-authoring DSL for designer-1 (Node built-ins only).
class M {
  constructor(w, h) {
    this.w = w; this.h = h; this.ents = [];
    this.g = [];
    for (let r = 0; r < h; r++) this.g.push(Array(w).fill('.'));
  }
  set(c, r, ch) {
    if (c < 0 || c >= this.w || r < 0 || r >= this.h) throw new Error(`set out of bounds ${c},${r}`);
    this.g[r][c] = ch; return this;
  }
  fill(c0, r0, c1, r1, ch = '#') { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, ch); return this; }
  ground(c0, c1, top, ch = '#') { return this.fill(c0, top, c1, this.h - 1, ch); }
  clear(c0, r0, c1, r1) { return this.fill(c0, r0, c1, r1, '.'); }
  spawns(c, r) { for (let i = 0; i < 4; i++) this.set(c + i, r, String(i + 1)); return this; }
  // crate: x,y = top-left tile; rests on row y+h
  crate(x, y, w = 1, h = 1, need = 1) { this.ents.push({ type: 'crate', x, y, w, h, need, weight: 1 }); return this; }
  ent(o) { this.ents.push(o); return this; }
  laser(x, y, dir, o = {}) { return this.ent(Object.assign({ type: 'laser', x, y, dir }, o)); }
  button(x, y, channel, o = {}) { return this.ent(Object.assign({ type: 'button', x, y, w: 1, channel, need: 1, mode: 'hold' }, o)); }
  gate(x, y, w, h, channel, o = {}) { return this.ent(Object.assign({ type: 'gate', x, y, w, h, channel }, o)); }
  lever(x, y, channel, on = false) { return this.ent({ type: 'lever', x, y, channel, on }); }
  rows() { return this.g.map((r) => r.join('')); }
}
// tiles covered by a crate placed at (x,y,w,h) — for checker scenarios
function box(x, y, w = 1, h = 1) { const out = []; for (let c = x; c < x + w; c++) for (let r = y; r < y + h; r++) out.push([c, r]); return out; }
module.exports = { M, box };
