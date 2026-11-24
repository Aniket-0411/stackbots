"""5b. Real CDP touch hold on the Right button: which pointer events fire, and how far does the bot walk?"""
from bt import *  # noqa
def main():
    with sync_playwright() as p:
        b = launch(p); ctx, pg = open_page(b, 400, 800, touch=True)
        pg.tap('#b-local'); pg.wait_for_timeout(200); pg.tap('#b-lobby-start'); pg.wait_for_timeout(200); pg.tap('.card >> nth=2'); pg.wait_for_timeout(1000)
        pg.evaluate("""window.__ev = []; const t0 = performance.now(); ['pointerdown','pointerup','pointercancel','pointerout','pointerleave','touchstart','touchend','touchcancel','contextmenu','lostpointercapture']
          .forEach(n => window.addEventListener(n, e => __ev.push(n + '@' + Math.round(performance.now() - t0) + (e.pointerType ? ':' + e.pointerType : '')), true))""")
        bx = pg.query_selector('.tb[data-k=right]').bounding_box(); cdp = ctx.new_cdp_session(pg)
        x, y = bx['x'] + 34, bx['y'] + 34
        for hold, moves in ((1200, False), (1200, True)):
            x0 = pl(pg, 0)['x']
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            for i in range(hold // 100):
                pg.wait_for_timeout(100)
                if moves: cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + (i % 2), 'y': y}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            pg.wait_for_timeout(200)
            print('hold %d ms, finger %s: P1 x %d -> %d; events %s' % (hold, 'wiggling' if moves else 'still', x0, pl(pg, 0)['x'], pg.evaluate('__ev.splice(0)')))
            pg.keyboard.press('KeyR'); pg.wait_for_timeout(400)
run(main)
