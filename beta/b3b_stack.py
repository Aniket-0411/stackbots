"""3b. 2-bot stack jump in 1-3: P1 at the pillar, P2 on its head, P1 jumps; then the rider jumps off the stack."""
from bt import *  # noqa
def main():
    with sync_playwright() as p:
        b = launch(p); ctx, pg = open_page(b); local_lobby(pg, 2); pick(pg, '1-3')
        walk_to(pg, 0, 100); walk_to(pg, 1, 158)
        press(pg, 1, 'left', True); tapk(pg, 1, 'jump', 250); pg.wait_for_timeout(250); press(pg, 1, 'left', False); pg.wait_for_timeout(500)
        print('P2 on head:', pos(pg))
        walk_to(pg, 0, 240); pg.wait_for_timeout(300); print('P1 walks right carrying P2:', pos(pg))
        ys = []; press(pg, 0, 'jump', True)
        for _ in range(10): pg.wait_for_timeout(40); ys.append(tuple(int(q['y']) for q in state(pg)['players']))
        press(pg, 0, 'jump', False); pg.wait_for_timeout(800)
        print('stack-jump y trace (P1,P2):', ys[::2], 'landed:', pos(pg))
        # jump-buffer feel: press jump 60 ms before landing
        tapk(pg, 1, 'jump', 60); pg.wait_for_timeout(380); tapk(pg, 1, 'jump', 60); pg.wait_for_timeout(900)
        print('double tap near landing:', pos(pg))
run(main)
