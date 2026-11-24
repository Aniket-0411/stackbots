"""5. Phone 400x800 touch: title, local lobby, level select, play 1-3 with touch buttons."""
from bt import *  # noqa
CLIP = """(() => { const W = innerWidth, H = innerHeight, out = [];
  document.querySelectorAll('button, input, .card, h1, h2, .code-text, #hud *').forEach(e => { if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return;
    const r = e.getBoundingClientRect(); if (r.width && (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1)) out.push((e.id || e.className || e.tagName) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round)); });
  return {scrollW: document.documentElement.scrollWidth, out: out.slice(0, 8)}; })()"""

def main():
    with sync_playwright() as p:
        b = launch(p); ctx, pg = open_page(b, 400, 800, touch=True)
        pg.wait_for_timeout(300); print('title', pg.evaluate(CLIP), bshot(pg, '5-title'))
        pg.tap('#b-local'); pg.wait_for_timeout(300); print('lobby', pg.evaluate(CLIP), bshot(pg, '5-lobby'))
        pg.tap('#b-lobby-start'); pg.wait_for_timeout(300); print('select', pg.evaluate(CLIP), bshot(pg, '5-select'))
        pg.tap('.card >> nth=2'); pg.wait_for_timeout(1200)
        print('play', state(pg)['levelId'], 'touch visible', pg.is_visible('#touch'), pg.evaluate(CLIP))
        x0 = pos(pg)
        bx = pg.query_selector('.tb[data-k=right]').bounding_box(); print('right btn box', {k: round(v) for k, v in bx.items()})
        cdp = ctx.new_cdp_session(pg)
        def touch(kind, x, y): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [{'x': x, 'y': y}]})
        touch('touchStart', bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2); pg.wait_for_timeout(700); touch('touchEnd', 0, 0)
        jb = pg.query_selector('.tb.jump').bounding_box()
        pg.wait_for_timeout(100); print('touch right 0.7s:', x0, '->', pos(pg))
        touch('touchStart', jb['x'] + 20, jb['y'] + 20); pg.wait_for_timeout(150); touch('touchEnd', 0, 0); pg.wait_for_timeout(100)
        print('touch jump -> ', pos(pg)); pg.wait_for_timeout(500)
        print(bshot(pg, '5-play'))
        print('errors', pg._sb_errs)
run(main)
