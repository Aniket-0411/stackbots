"""3c. 4 bots (2 keyboards + 2 fake pads): ride the 4-2 elevator. Also: start a 4+ level with 2 bots."""
from bt import *  # noqa
def main():
    with sync_playwright() as p:
        b = launch(p); ctx, pg = open_page(b, pads=True)
        print('roster', [r['dev'] for r in local_lobby(pg, 4)])
        pick(pg, '4-2')
        plat = lambda: pg.evaluate('(() => { const e = SB.Game.world().entities[0]; return [Math.round(e.x), Math.round(e.y)] })()')
        print('4-2 start', pos(pg), 'platform', plat())
        for s, tx in ((3, 14 * 32 + 100), (2, 14 * 32 + 70), (1, 14 * 32 + 38), (0, 14 * 32 + 6)):
            walk_to(pg, s, 410, 5000); press(pg, s, 'right', True); tapk(pg, s, 'jump', 200); pg.wait_for_timeout(150); press(pg, s, 'right', False)
            walk_to(pg, s, tx, 3000)
        pg.wait_for_timeout(200); print('all aboard?', pos(pg), 'platform', plat())
        tr = []
        for _ in range(6): pg.wait_for_timeout(500); tr.append(plat()[1])
        print('platform y every 0.5s:', tr, pos(pg))
        print(bshot(pg, '3-4-2-lift'))
        # one bot hops off -> lift goes back
        walk_to(pg, 0, 13 * 32, 2000, jump_when_stuck=True); pg.wait_for_timeout(800); print('P1 left the lift:', plat(), pos(pg))
        # 2 bots on a 4+ level
        ctx2, pg2 = open_page(b); local_lobby(pg2, 2)
        pg2.click('#b-lobby-start'); pg2.wait_for_timeout(300); pg2.click('.card >> nth=6'); pg2.wait_for_timeout(700)
        st = state(pg2)
        print('1-7 (4+ bots) with 2 bots -> screen', st['screen'], st['levelId'], 'bots', len(st['players']),
              '| visible text:', ' | '.join(t for t in pg2.evaluate("Array.from(document.querySelectorAll('.toast,.dialog,#dialog,#hud-banner,#hud-hint')).filter(e=>e.offsetParent).map(e=>e.innerText)") if t)[:300])
        print(bshot(pg2, '3-1-7-two-bots'))
        print('errors', pg._sb_errs, pg2._sb_errs)
run(main)
