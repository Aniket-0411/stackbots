"""1. First-time experience: title -> Local Play -> select -> 1-1, play to clear with keyboard."""
from bt import *  # noqa

KEYS = {0: ('KeyA', 'KeyD', 'KeyW', 'Space'), 1: ('ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter')}

def drive(pg, targets, limit=15000):
    """walk each slot toward target x, jumping when stuck. returns elapsed ms."""
    last = {}; stuck = {}; t = 0
    held = set()
    while t < limit:
        st = state(pg)
        if st['screen'] != 'play' or st['phase'] not in (None, 'play'):
            break
        done = True
        for p in st['players']:
            s = p['slot']
            if s not in targets or p['state'] != 'active':
                continue
            L, R, U, J = KEYS[s]
            dx = targets[s] - p['x']
            want = R if dx > 4 else L if dx < -4 else None
            for k in (L, R):
                if k == want and k not in held: pg.keyboard.down(k); held.add(k)
                if k != want and k in held: pg.keyboard.up(k); held.discard(k)
            if want: done = False
            if want and abs(p['x'] - last.get(s, -99)) < 0.5:
                stuck[s] = stuck.get(s, 0) + 1
                if stuck[s] >= 2: tap(pg, J, 120); stuck[s] = 0
            last[s] = p['x']
        if done: break
        pg.wait_for_timeout(50); t += 50
    for k in held: pg.keyboard.up(k)
    return t

def main():
    with sync_playwright() as p:
        b = launch(p)
        ctx, pg = open_page(b)
        pg.wait_for_timeout(400)
        print('title shot', bshot(pg, '01-title'))
        txt = pg.inner_text('#scr-title') if pg.query_selector('#scr-title') else pg.inner_text('body')[:600]
        print('TITLE TEXT:', ' | '.join(txt.split('\n'))[:500])
        pg.click('#b-local'); pg.wait_for_timeout(400)
        print('screen', state(pg)['screen'], 'roster', state(pg)['roster'])
        print('LOBBY TEXT:', ' | '.join(pg.inner_text('body').split('\n'))[:700])
        print(bshot(pg, '02-local-lobby'))
        pg.click('#b-lobby-start'); pg.wait_for_timeout(400)
        print(bshot(pg, '03-select'))
        pg.click('.card >> nth=0'); pg.wait_for_timeout(1000)
        print('play', state(pg)['levelId'], bshot(pg, '04-play-1-1'))
        hud = pg.evaluate("Array.from(document.querySelectorAll('#hud *, .hud *')).map(e=>e.children.length?'':e.textContent.trim()).filter(Boolean).join(' | ')")
        print('HUD:', hud[:300])
        w = pg.evaluate('(() => { const w = SB.Game.world(); return {cell: w.cell && {x: w.cell.x, y: w.cell.y}, hatch: w.hatch && {x: w.hatch.x, y: w.hatch.y}} })()')
        print('world', w)
        t0 = time.time()
        # both walk to the hatch (P1 passes the cell on the way)
        hx = w['hatch']['x'] if w['hatch'] else 928
        drive(pg, {0: hx + 2, 1: hx - 26})
        st = state(pg); print('after walk', [(q['slot'], round(q['x']), round(q['y']), q['state']) for q in st['players']])
        print('cell', pg.evaluate('JSON.stringify(SB.Game.world().cell)'))
        print(bshot(pg, '05-1-1-at-hatch'))
        tap(pg, 'KeyW', 80); pg.wait_for_timeout(200)
        print('after P1 up', [(q['slot'], q['state']) for q in state(pg)['players']])
        # P2 steps into hatch
        drive(pg, {1: hx + 2}, 3000)
        tap(pg, 'ArrowUp', 80)
        try:
            wait_for(pg, 'SB.Game.state().screen === "clear"', 5000)
        except Failure as e:
            print('NO CLEAR', state(pg)); print(bshot(pg, '05b-noclear'))
        print('clear after %.1fs' % (time.time() - t0))
        pg.wait_for_timeout(700)
        print('CLEAR TEXT:', ' | '.join(pg.inner_text('#scr-clear').split('\n'))[:400] if pg.query_selector('#scr-clear') else '')
        print(bshot(pg, '06-clear'))
        pg.click('#b-next'); pg.wait_for_timeout(800)
        print('after next', state(pg)['levelId'], state(pg)['screen'])
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pg.click('#b-pselect'); pg.wait_for_timeout(500)
        print('SELECT CARD0:', pg.inner_text('.card >> nth=0').replace('\n', ' | '), '|| CARD1:', pg.inner_text('.card >> nth=1').replace('\n', ' | '))
        print(bshot(pg, '07-select-progress'))
        print('progress', pg.evaluate('JSON.stringify(SB.Game.progress())'))
        print('errors', pg._sb_errs)
run(main)
