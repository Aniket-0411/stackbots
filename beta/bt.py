"""Beta-test helpers (wraps test/client/common.py)."""
import os, sys, json, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'test', 'client'))
from common import *  # noqa
BETA = os.path.dirname(os.path.abspath(__file__))
BSHOTS = os.path.join(BETA, 'shots')
os.makedirs(BSHOTS, exist_ok=True)

# two fake gamepads so P3/P4 can be driven through the real input path
PADS = """
window.__pads = [0,1].map(i => ({connected: true, id: 'Fake Pad '+i, index: i, mapping: 'standard', axes: [0,0,0,0], timestamp: 0,
  buttons: Array.from({length: 17}, () => ({pressed: false, value: 0}))}));
navigator.getGamepads = function () { return [window.__pads[0], window.__pads[1], null, null]; };
window.__pb = function (p, btn, on) { window.__pads[p].buttons[btn] = {pressed: on, value: on ? 1 : 0}; };
window.__pa = function (p, v) { window.__pads[p].axes[0] = v; };
"""

def bshot(page, name):
    path = os.path.join(BSHOTS, name + '.png')
    page.screenshot(path=path)
    return 'beta/shots/' + name + '.png'

def open_page(b, w=960, h=540, pads=False, touch=False, init=None, url=URL):
    kw = dict(viewport={'width': w, 'height': h})
    if touch:
        kw.update(has_touch=True, is_mobile=True)
    ctx = new_context(b, **kw)
    if pads:
        ctx.add_init_script(PADS)
    if init:
        ctx.add_init_script(path=init)
    pg = ctx.new_page()
    watch(pg)
    pg.goto(url)
    wait_for(pg, 'window.SB && SB.Game && SB.Game.state().screen === "title"', msg='title')
    return ctx, pg

def lvidx(pg, lid):
    return pg.evaluate('SB.Game.levels().findIndex(l => l.id === %s)' % json.dumps(lid))

def pl(pg, slot):
    return [p for p in state(pg)['players'] if p['slot'] == slot][0]

# ---- real-input control of slots 0..3: kb1, kb2, pad0, pad1 ----
KB = {0: {'left': 'KeyA', 'right': 'KeyD', 'up': 'KeyW', 'down': 'KeyS', 'jump': 'Space'},
      1: {'left': 'ArrowLeft', 'right': 'ArrowRight', 'up': 'ArrowUp', 'down': 'ArrowDown', 'jump': 'Enter'}}
PADBTN = {'jump': 0, 'up': 12, 'down': 13}

def press(pg, slot, key, on):
    if slot in KB:
        (pg.keyboard.down if on else pg.keyboard.up)(KB[slot][key])
    elif key in ('left', 'right'):
        pg.evaluate('__pa(%d, %d)' % (slot - 2, (-1 if key == 'left' else 1) if on else 0))
    else:
        pg.evaluate('__pb(%d, %d, %s)' % (slot - 2, PADBTN[key], 'true' if on else 'false'))

def tapk(pg, slot, key, ms=90):
    press(pg, slot, key, True); pg.wait_for_timeout(ms); press(pg, slot, key, False)

def walk_to(pg, slot, x, limit=4000, tol=3, jump_when_stuck=False):
    t = 0; last = None; stuck = 0; cur = None
    while t < limit:
        p = pl(pg, slot); dx = x - p['x']
        want = 'right' if dx > tol else 'left' if dx < -tol else None
        if want != cur:
            if cur: press(pg, slot, cur, False)
            if want: press(pg, slot, want, True)
            cur = want
        if not want: break
        if jump_when_stuck and last is not None and abs(p['x'] - last) < 0.3:
            stuck += 1
            if stuck >= 3: tapk(pg, slot, 'jump', 150); stuck = 0
        last = p['x']; pg.wait_for_timeout(40); t += 40
    if cur: press(pg, slot, cur, False)
    return pl(pg, slot)

def local_lobby(pg, n=2):
    pg.click('#b-local'); pg.wait_for_timeout(300)
    for i in range(n - 2):
        pg.evaluate('__pb(%d, 0, true)' % i); pg.wait_for_timeout(120); pg.evaluate('__pb(%d, 0, false)' % i); pg.wait_for_timeout(120)
    return state(pg)['roster']

def pick(pg, lid):
    w, i = [int(v) for v in lid.split('-')]
    if state(pg)['screen'] != 'select':
        pg.click('#b-lobby-start'); pg.wait_for_timeout(300)
    pg.click('.tab >> nth=%d' % (w - 1)); pg.wait_for_timeout(150)
    pg.click('.card >> nth=%d' % (i - 1))
    wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().levelId === %s' % json.dumps(lid))
    pg.wait_for_timeout(300)

def pos(pg):
    return ' '.join('P%d(%d,%d%s)' % (q['slot'] + 1, q['x'], q['y'], '' if q['state'] == 'active' else ':' + q['state'][:3]) for q in state(pg)['players'])
