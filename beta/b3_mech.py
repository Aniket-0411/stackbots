"""3a. Mechanic feel, 2 bots on the keyboard: stack jump (1-3), crate push (2-2), button+gate (3-1), spikes (1-4), Esc/R/M."""
from bt import *  # noqa

def main():
    with sync_playwright() as p:
        b = launch(p)
        ctx, pg = open_page(b)
        local_lobby(pg, 2)
        # --- 1-3 stack jump: P2 hops onto P1, then P1 jumps -> both rise
        pick(pg, '1-3')
        press(pg, 1, 'left', True); tapk(pg, 1, 'jump', 200); pg.wait_for_timeout(250); press(pg, 1, 'left', False); pg.wait_for_timeout(500)
        print('1-3 P2 on head:', pos(pg))
        ys = []; press(pg, 0, 'jump', True)
        for _ in range(9): pg.wait_for_timeout(45); ys.append(tuple(int(q['y']) for q in state(pg)['players']))
        press(pg, 0, 'jump', False); pg.wait_for_timeout(700)
        print(' stack-jump y trace (P1,P2):', ys[::2], 'after:', pos(pg))
        # walk together while stacked
        walk_to(pg, 0, 330); pg.wait_for_timeout(300); print(' carried while walking:', pos(pg))
        # --- 2-2: P2 alone vs P1+P2 chain
        pg.keyboard.press('Escape'); pg.wait_for_timeout(250); print(bshot(pg, '3-pause')); pg.click('#b-pselect'); pg.wait_for_timeout(300)
        pick(pg, '2-2')
        cx = lambda: round(pg.evaluate('SB.Game.world().entities[0].x'))
        c0 = cx(); walk_to(pg, 1, c0 - 26, 3000); press(pg, 1, 'right', True); pg.wait_for_timeout(1000)
        print('2-2 P2 alone 1s: crate', c0, '->', cx(), pos(pg))
        walk_to(pg, 0, pl(pg, 1)['x'] - 26, 3000); press(pg, 0, 'right', True)
        xs = []
        for _ in range(8): pg.wait_for_timeout(200); xs.append(cx())
        print(' P1 joins (chain): crate xs every 0.2s', xs)
        print(bshot(pg, '3-2-2-push'))
        press(pg, 0, 'right', False); press(pg, 1, 'right', False)
        # --- 3-1: P2 holds button 13, P1 hops over and goes through the gate
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200); pg.click('#b-pselect'); pg.wait_for_timeout(300)
        pick(pg, '3-1')
        gate = lambda: pg.evaluate('(() => { const e = SB.Game.world().entities; return [e[0].on, e[2].open, Math.round((e[2].openAmt||0)*100)/100] })()')
        walk_to(pg, 1, 13 * 32 + 4); pg.wait_for_timeout(150); g1 = gate(); pg.wait_for_timeout(500)
        print('3-1 P2 on button: [btn,gateOpen,amt]', g1, '0.5s later', gate())
        walk_to(pg, 0, 22 * 32, 6000, jump_when_stuck=True); print(' P1 through the gate?', pos(pg))
        print(bshot(pg, '3-3-1-button'))
        walk_to(pg, 1, 15 * 32); pg.wait_for_timeout(600); print(' P2 off button, P1 on far button:', gate(), pos(pg))
        # --- 1-4 spikes: run right without jumping
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200); pg.click('#b-pselect'); pg.wait_for_timeout(300)
        pick(pg, '1-4')
        press(pg, 1, 'right', True); t0 = time.time()
        wait_for(pg, 'SB.Game.state().phase === "dead"', 4000); press(pg, 1, 'right', False)
        pg.wait_for_timeout(250)
        print('1-4 died; banner:', repr(pg.inner_text('#hud-banner')), bshot(pg, '3-1-4-scrapped'))
        t1 = time.time(); wait_for(pg, 'SB.Game.state().phase === "play"', 5000)
        print(' auto-restart after %.2fs; positions %s' % (time.time() - t1 + 0.25, pos(pg)))
        # --- R / M
        walk_to(pg, 0, 120); pg.keyboard.press('KeyR'); pg.wait_for_timeout(150); print('R restart ->', pos(pg), state(pg)['phase'])
        pg.keyboard.press('KeyM'); pg.wait_for_timeout(200)
        toast = pg.evaluate("Array.from(document.querySelectorAll('.toast, #toast, [class*=toast]')).map(e => e.textContent).join('|')")
        print('M -> toast:', repr(toast), 'muted ls:', pg.evaluate("localStorage.getItem('sb.muted')"))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        print('pause text:', pg.inner_text('#b-pmute'), '| paused', state(pg)['paused'])
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200); print('Esc again -> paused', state(pg)['paused'])
        pg.keyboard.press('KeyM')
        print('errors', pg._sb_errs)
run(main)
