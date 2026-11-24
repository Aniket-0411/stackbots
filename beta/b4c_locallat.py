"""4c. Reference: local-play input latency (keydown -> first drawn frame where P2 moved), same method as the guest number in b4_online."""
from bt import *  # noqa
def main():
    with sync_playwright() as p:
        b = launch(p); ctx, pg = open_page(b); local_lobby(pg, 2); pick(pg, '1-1'); pg.wait_for_timeout(500)
        pg.evaluate("""(() => { window.__fr = []; const R = SB.Render, f = R.frame; R.frame = function (w, o) { const p = w.players.find(p => p.slot === 1);
          window.__fr.push([performance.now(), p.x]); return f.apply(this, arguments); }; })()""")
        res = []
        for i in range(3):
            res.append(pg.evaluate("""() => new Promise(res => { const x0 = SB.Game.world().players.find(p => p.slot === 1).x; window.__fr = []; const t0 = performance.now();
              document.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowRight', key: 'ArrowRight', bubbles: true}));
              const iv = setInterval(() => { const f = window.__fr.find(f => Math.abs(f[1] - x0) > 0.5); if (f || performance.now() - t0 > 2000) { clearInterval(iv);
                document.dispatchEvent(new KeyboardEvent('keyup', {code: 'ArrowRight', key: 'ArrowRight', bubbles: true})); res(f ? f[0] - t0 : -1); } }, 5); })"""))
            pg.wait_for_timeout(300)
        print('local keydown -> P2 drawn moving (ms):', [round(r) for r in res])
run(main)
