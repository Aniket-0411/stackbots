#!/usr/bin/env node
'use strict';
// Runs every test/*.test.js in its own child process and prints a summary table.
//   node test/run.js            all tests
//   node test/run.js mech       only files whose name matches /mech/
//   node test/run.js -v         also stream each file's full output
// Exit code 1 if any test fails or a test file crashes.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = __dirname;
const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const filters = args.filter(a => !a.startsWith('-'));

let files = [];
try { files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort(); } catch (e) { /* no dir */ }
if (filters.length) files = files.filter(f => filters.some(p => f.includes(p)));
if (!files.length) {
  console.log('No test/*.test.js files found' + (filters.length ? ` matching ${filters.join(', ')}` : '') + ' - nothing to run.');
  process.exit(0);
}

const rows = [];
let anyFail = false;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, f)], { cwd: path.resolve(dir, '..'), encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  const ms = Date.now() - t0;
  const out = (r.stdout || '') + (r.stderr ? '\n' + r.stderr : '');
  let summary = null;
  const m = /^##QA (.*)$/m.exec(r.stdout || '');
  if (m) { try { summary = JSON.parse(m[1]); } catch (e) { /* ignore */ } }
  let status, pass = 0, failN = 0, skip = 0, note = '';
  if (r.error) { status = 'CRASH'; note = r.error.code === 'ETIMEDOUT' ? 'timed out' : String(r.error.message); }
  else if (summary) {
    pass = summary.pass; failN = summary.fail; skip = summary.skip;
    if (summary.skipped) { status = 'SKIP'; note = summary.skipped; }
    else status = failN ? 'FAIL' : (r.status === 0 ? 'PASS' : 'FAIL');
    if (status === 'FAIL' && !failN) note = `exit code ${r.status}`;
  } else {
    status = r.status === 0 ? 'PASS?' : 'CRASH';
    note = r.status === 0 ? 'no ##QA summary line' : `exit ${r.status}: ` + out.trim().split('\n').slice(-3).join(' | ').slice(0, 200);
  }
  if (status === 'FAIL' || status === 'CRASH') anyFail = true;
  if (summary && summary.warn) note = (note ? note + '; ' : '') + `${summary.warn} warning(s)`;
  rows.push({ f, status, pass, fail: failN, skip, ms, note, failed: summary ? summary.results.filter(x => x.status === 'fail') : [], warned: summary ? summary.results.filter(x => x.status === 'warn') : [] });
  if (verbose) { console.log(`\n----- ${f} -----`); console.log(out.replace(/^##QA .*$/m, '').trimEnd()); }
}

const pad = (s, n) => String(s).padEnd(n);
console.log('\n' + pad('test file', 26) + pad('status', 8) + pad('pass', 6) + pad('fail', 6) + pad('skip', 6) + pad('time', 8) + 'note');
console.log('-'.repeat(80));
for (const r of rows) console.log(pad(r.f, 26) + pad(r.status, 8) + pad(r.pass, 6) + pad(r.fail, 6) + pad(r.skip, 6) + pad((r.ms / 1000).toFixed(1) + 's', 8) + r.note);
const tot = rows.reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail, skip: a.skip + r.skip }), { pass: 0, fail: 0, skip: 0 });
console.log('-'.repeat(80));
console.log(pad('TOTAL', 34) + pad(tot.pass, 6) + pad(tot.fail, 6) + pad(tot.skip, 6));
const failedTests = [].concat(...rows.map(r => r.failed.map(x => `  ${r.f}: ${x.name}\n      ${x.msg.split('\n')[0].slice(0, 300)}`)));
const warned = [].concat(...rows.map(r => r.warned.map(x => `  ${r.f}: ${x.name}: ${x.msg.slice(0, 200)}`)));
if (warned.length) { console.log('\nWarnings:'); console.log(warned.join('\n')); }
if (failedTests.length) { console.log('\nFailed tests:'); console.log(failedTests.join('\n')); }
console.log(anyFail ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(anyFail ? 1 : 0);
