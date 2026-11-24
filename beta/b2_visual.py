"""2. Visual pass: one level per world with 4 bots, screenshot after ~1 s."""
from bt import *  # noqa
IDS = sys.argv[1:] or ['1-3', '2-4', '3-5', '4-2', '5-5', '6-3', '7-2', '8-3', '9-2', '10-10']

def main():
    with sync_playwright() as p:
        b = launch(p)
        ctx, pg = open_page(b)
        for lid in IDS:
            i = lvidx(pg, lid)
            pg.evaluate('SB.Game.localStart(%d, 4)' % i)
            pg.wait_for_timeout(1000)
            w = pg.evaluate('(() => { const w = SB.Game.world(); const c = SB.Render._cam; return {cols: w.level ? w.level.cols : null, z: c.z, ents: (w.entities||[]).map(e => e.type).join(","), hint: (document.querySelector("#hud-hint")||{}).textContent} })()')
            print(lid, json.dumps(w)[:300], bshot(pg, '2-' + lid))
        print('errors', pg._sb_errs)
run(main)
