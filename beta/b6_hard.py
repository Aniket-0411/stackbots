"""6. Hard levels: what does the camera show at the start and at a key spot? (bots moved by test hook only to aim the camera)"""
from bt import *  # noqa
SPOTS = [('7-10', None), ('7-10', (40, 5)), ('9-10', None), ('9-10', (25, 15)), ('10-10', (22, 18)), ('10-10', (45, 15))]
def main():
    with sync_playwright() as p:
        b = launch(p); ctx, pg = open_page(b)
        for lid, spot in SPOTS:
            pg.evaluate('SB.Game.localStart(%d, 4)' % lvidx(pg, lid)); pg.wait_for_timeout(300)
            if spot:
                pg.evaluate('''(() => { const w = SB.Game.world(); w.players.forEach((p, i) => { p.x = (%d + i) * 32 + 4; p.y = %d * 32 + 2; p.vx = 0; p.vy = 0; }); })()''' % spot)
            pg.wait_for_timeout(1500)
            print(lid, spot, 'zoom %.2f' % pg.evaluate('SB.Render._cam.z'), pos(pg), bshot(pg, '6-%s-%s' % (lid, 'start' if not spot else '%d' % spot[0])))
        print('errors', pg._sb_errs)
run(main)
