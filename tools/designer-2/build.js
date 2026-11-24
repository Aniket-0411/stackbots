#!/usr/bin/env node
'use strict';
// Designer-2 level builder: turns tools/designer-2/w03.js / w04.js (maps with entity marker
// letters + a legend) into levels/world03.json / world04.json. Node built-ins only.
//   node tools/designer-2/build.js            build both worlds
//   node tools/designer-2/build.js 3 --show   build + print maps with column ruler
// Marker letters: any uppercase letter except K and D. Each letter = one entity; its cells
// must form a filled rectangle (= x, y, w, h). Legend {type:'wp'} = single-cell waypoint for
// platform paths (path: ['Q', [x,y], ...]; the start is prepended automatically).
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const LEGAL = new Set('.#-^*=<>abcdKDo1234'.split(''));

function buildLevel(src) {
  const errs = [];
  let map = src.map;
  if (src.draw) {
    // draw: [[ch, x, y, w=1, h=1], ...] painted in order onto a W x H grid of '.'
    const g = Array.from({ length: src.H }, () => Array(src.W).fill('.'));
    for (const [ch, x, y, w = 1, h = 1] of src.draw) {
      for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) {
        if (r < 0 || r >= src.H || c < 0 || c >= src.W) { errs.push(`draw ${ch} out of map at [${c},${r}]`); continue; }
        g[r][c] = ch;
      }
    }
    map = g.map(r => r.join(''));
  }
  const W = map[0].length;
  map.forEach((r, i) => { if (r.length !== W) errs.push(`row ${i} len ${r.length} != ${W}`); });
  const cells = {};
  const out = map.map((row, r) => row.split('').map((ch, c) => {
    if (LEGAL.has(ch)) return ch;
    if (/[A-Z]/.test(ch) && src.legend && src.legend[ch]) {
      (cells[ch] = cells[ch] || []).push([c, r]);
      return src.legend[ch].under || '.';
    }
    errs.push(`bad char '${ch}' at [${c},${r}]`);
    return ch;
  }).join(''));
  const box = (k) => {
    const cs = cells[k];
    if (!cs) { errs.push(`legend ${k} has no cells`); return null; }
    const xs = cs.map(p => p[0]), ys = cs.map(p => p[1]);
    const b = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
    if (b.w * b.h !== cs.length) errs.push(`marker ${k} is not a filled rectangle`);
    return b;
  };
  const ents = [];
  for (const k of Object.keys(src.legend || {})) {
    const L = src.legend[k];
    if (L.type === 'wp') continue;
    const b = box(k); if (!b) continue;
    const e = { type: L.type };
    if (L.id) e.id = L.id;
    e.x = b.x; e.y = b.y;
    switch (L.type) {
      case 'button':
        if (b.h !== 1) errs.push(`button ${k} h != 1`);
        e.w = b.w; e.channel = L.channel; e.need = L.need || 1; e.mode = L.mode || 'hold';
        if (e.mode === 'timer') e.time = L.time || 180;
        break;
      case 'lever':
        e.channel = L.channel; e.on = !!L.on; break;
      case 'gate':
        e.w = b.w; e.h = b.h; e.channel = L.channel; e.logic = L.logic || 'all'; e.invert = !!L.invert; break;
      case 'crate':
        e.w = b.w; e.h = b.h; e.need = L.need || 1; e.weight = L.weight || 1; break;
      case 'platform': {
        if (b.h !== 1) errs.push(`platform ${k} h != 1`);
        e.w = b.w;
        const p = [[b.x, b.y]];
        for (const q of L.path || []) {
          if (Array.isArray(q)) p.push(q);
          else { const wb = box(q); if (wb) p.push([wb.x, wb.y]); }
        }
        e.path = p; e.speed = L.speed || 1.0; e.mode = L.mode || 'pingpong';
        e.channel = L.channel || null; e.need = L.need || 0;
        if (L.logic) e.logic = L.logic;
        break;
      }
      default: errs.push(`unknown type ${L.type}`);
    }
    ents.push(e);
  }
  for (const e of src.ents || []) ents.push(Object.assign({}, e));
  return { lv: { id: src.id, name: src.name, hint: src.hint || '', minPlayers: src.minPlayers, tether: false, tetherLength: 5, map: out, entities: ents }, errs };
}

function fmtWorld(w) {
  const L = [];
  L.push('{');
  L.push(`  "world": ${w.world},`);
  L.push(`  "name": ${JSON.stringify(w.name)},`);
  L.push(`  "theme": ${JSON.stringify(w.theme)},`);
  L.push('  "levels": [');
  w.levels.forEach((lv, i) => {
    L.push('    {');
    for (const k of ['id', 'name', 'hint', 'minPlayers', 'tether', 'tetherLength']) L.push(`      ${JSON.stringify(k)}: ${JSON.stringify(lv[k])},`);
    L.push('      "map": [');
    lv.map.forEach((r, j) => L.push(`        ${JSON.stringify(r)}${j < lv.map.length - 1 ? ',' : ''}`));
    L.push('      ],');
    L.push('      "entities": [' + (lv.entities.length ? '' : ']'));
    lv.entities.forEach((e, j) => L.push(`        ${JSON.stringify(e).replace(/,"/g, ', "').replace(/":/g, '": ')}${j < lv.entities.length - 1 ? ',' : ''}`));
    if (lv.entities.length) L.push('      ]');
    L.push('    }' + (i < w.levels.length - 1 ? ',' : ''));
  });
  L.push('  ]');
  L.push('}');
  return L.join('\n') + '\n';
}

function show(lv) {
  const W = lv.map[0].length;
  let t = '    ', o = '    ';
  for (let c = 0; c < W; c++) { t += c % 10 === 0 ? String(c / 10 % 10) : ' '; o += String(c % 10); }
  console.log(`\n${lv.id} ${lv.name} (${W}x${lv.map.length})\n${t}\n${o}`);
  lv.map.forEach((r, i) => console.log(String(i).padStart(3) + ' ' + r));
  lv.entities.forEach(e => console.log('   ', JSON.stringify(e)));
}

const args = process.argv.slice(2);
const which = args.filter(a => /^\d+$/.test(a)).map(Number);
const worlds = which.length ? which : [3, 4];
let bad = 0;
for (const n of worlds) {
  const src = require(`./w0${n}.js`);
  const levels = [];
  for (const s of src.levels) {
    const { lv, errs } = buildLevel(s);
    if (errs.length) { bad++; console.log(`${s.id}: ${errs.join('; ')}`); }
    levels.push(lv);
    if (args.includes('--show')) show(lv);
  }
  const file = path.join(ROOT, 'levels', `world0${n}.json`);
  const txt = fmtWorld({ world: src.world, name: src.name, theme: src.theme, levels });
  JSON.parse(txt);
  fs.writeFileSync(file, txt);
  console.log(`wrote ${path.relative(ROOT, file)} (${levels.length} levels)`);
}
process.exit(bad ? 1 : 0);
