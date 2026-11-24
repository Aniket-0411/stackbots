#!/usr/bin/env python3
"""Run every STACKBOTS client test: build, then Playwright suites. Exits non-zero on any failure.
usage: python3 test/client/run_all.py [--no-build]"""
import os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SUITES = [
    ['test_smoke.py'],
    ['test_render.py'],
    ['test_online.py', 'tabs'],
    ['test_online.py', 'room'],
    ['test_online.py', 'peer'],
    ['test_online.py', 'relay'],
    ['test_flow.py'],
    ['test_feel.py'],
    ['test_unavailable.py'],
]


def main():
    env = dict(os.environ)
    env.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
    if '--no-build' not in sys.argv:
        r = subprocess.run(['node', os.path.join(ROOT, 'build.js')], cwd=ROOT)
        if r.returncode:
            print('BUILD FAILED'); return 1
    results = []
    for s in SUITES:
        name = ' '.join(s)
        print('\n=== %s ===' % name, flush=True)
        t0 = time.time()
        try:
            r = subprocess.run([sys.executable, os.path.join(HERE, s[0])] + s[1:], cwd=HERE, env=env, timeout=300)
            code = r.returncode
        except subprocess.TimeoutExpired:
            print('TIMEOUT'); code = 124
        results.append((name, code, time.time() - t0))
    print('\n=== summary ===')
    for name, code, dt in results:
        print('%-22s %s  (%.1fs)' % (name, 'PASS' if code == 0 else 'FAIL', dt))
    failed = [n for n, c, _ in results if c]
    print('ALL PASS' if not failed else '%d FAILED: %s' % (len(failed), ', '.join(failed)))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
