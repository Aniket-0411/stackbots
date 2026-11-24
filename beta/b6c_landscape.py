"""6c. Phone landscape 844x390 touch, 10-10 spread."""
from bt import *  # noqa
def main():
    with sync_playwright() as p:
        b = launch(p)
        for name, w, h, touch in (('land', 844, 390, True),):
            ctx, pg = open_page(b, w, h, touch=touch)
            pg.evaluate('SB.Game.localStart(%d, 4)' % lvidx(pg, '10-10')); pg.wait_for_timeout(300)
            pg.evaluate('''(() => { const w = SB.Game.world(), sp = [[9, 23], [14, 23], [16, 18], [44, 15]];
              w.players.forEach((p, i) => { p.x = sp[i][0] * 32 + 4; p.y = sp[i][1] * 32 + 2; p.vx = 0; p.vy = 0; }); })()''')
            pg.wait_for_timeout(2500)
            print(name, 'zoom %.2f' % pg.evaluate('SB.Render._cam.z'), pos(pg), bshot(pg, '6b-10-10-spread-' + name))
            ctx.close()
run(main)
