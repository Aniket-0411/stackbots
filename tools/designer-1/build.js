#!/usr/bin/env node
// Builds levels/world01.json and levels/world02.json from tools/designer-1/src/*.js
// Usage: node tools/designer-1/build.js [--print]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

function fmtLevel(lv) {
  const lines = [];
  lines.push('    {');
  lines.push(`      "id": ${JSON.stringify(lv.id)},`);
  lines.push(`      "name": ${JSON.stringify(lv.name)},`);
  lines.push(`      "hint": ${JSON.stringify(lv.hint)},`);
  lines.push(`      "minPlayers": ${lv.minPlayers},`);
  lines.push(`      "tether": false,`);
  lines.push(`      "tetherLength": 5,`);
  lines.push('      "map": [');
  lv.map.forEach((r, i) => lines.push(`        ${JSON.stringify(r)}${i < lv.map.length - 1 ? ',' : ''}`));
  lines.push('      ],');
  if (!lv.entities.length) lines.push('      "entities": []');
  else {
    lines.push('      "entities": [');
    lv.entities.forEach((e, i) => lines.push(`        ${JSON.stringify(e)}${i < lv.entities.length - 1 ? ',' : ''}`));
    lines.push('      ]');
  }
  lines.push('    }');
  return lines.join('\n');
}

function build(file, print) {
  const src = require(path.join(__dirname, 'src', file));
  const levels = src.levels.map((L) => {
    const m = L.build();
    return { id: L.id, name: L.name, hint: L.hint, minPlayers: L.minPlayers, map: m.rows(), entities: m.ents };
  });
  const out = '{\n' +
    `  "world": ${src.world},\n  "name": ${JSON.stringify(src.name)},\n  "theme": ${JSON.stringify(src.theme)},\n` +
    '  "levels": [\n' + levels.map(fmtLevel).join(',\n') + '\n  ]\n}\n';
  JSON.parse(out); // sanity
  const dest = path.join(ROOT, 'levels', `world${String(src.world).padStart(2, '0')}.json`);
  fs.writeFileSync(dest, out);
  console.log(`wrote ${path.relative(ROOT, dest)} (${levels.length} levels)`);
  if (print) levels.forEach((lv) => { console.log(`\n${lv.id} ${lv.name}`); lv.map.forEach((r, i) => console.log(String(i).padStart(2) + ' ' + r)); lv.entities.forEach((e) => console.log('   ' + JSON.stringify(e))); });
}

const print = process.argv.includes('--print');
const only = process.argv.filter((a) => /^world\d\d\.js$/.test(a));
for (const f of (only.length ? only : ['world01.js', 'world02.js', 'world08.js'])) {
  if (fs.existsSync(path.join(__dirname, 'src', f))) build(f, print);
}
