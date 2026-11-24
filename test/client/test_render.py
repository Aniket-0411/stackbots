"""Render showcase: injects a test-only world that uses every tile and entity type, renders it in all 10 themes
(screenshots to shots/20-theme-*.png), also drives a tether level, a death and a clear, and checks for errors.
Also checks the artifact build file shape."""
import json
from common import *  # noqa

THEMES = ['meadow', 'workshop', 'switchyard', 'skyway', 'prism', 'bouncy', 'ropeway', 'foundry', 'hazard', 'summit']
MAP = [
    "..................................",
    "..................................",
    "..................................",
    "..................................",
    "..................................",
    "........o.........................",
    ".......----.......................",
    "..............=====....aabbccdd...",
    "..............#####....aabbccdd...",
    "..K...........#####....aabbccdd...",
    "..............#####....aabbccdd...",
    "..............#####........^^^..D.",
    "..1234...*....#####...<<<<>>>>###.",
    "##################################",
    "##################################",
]
ENTS = [
    {"type": "crate", "x": 6, "y": 11, "w": 1, "h": 2, "need": 3},
    {"type": "crate", "x": 7, "y": 12, "need": 1, "weight": 2},
    {"type": "button", "x": 11, "y": 12, "w": 2, "channel": "A", "need": 2, "mode": "hold"},
    {"type": "button", "x": 20, "y": 12, "channel": "B", "mode": "timer"},
    {"type": "lever", "x": 13, "y": 12, "channel": "C", "on": True},
    {"type": "gate", "x": 19, "y": 9, "w": 1, "h": 3, "channel": "A"},
    {"type": "gate", "x": 24, "y": 6, "w": 3, "h": 1, "channel": "C", "invert": True},
    {"type": "platform", "x": 1, "y": 6, "w": 3, "path": [[1, 6], [1, 2]], "need": 2},
    {"type": "platform", "x": 26, "y": 4, "w": 2, "path": [[26, 4], [31, 4]], "channel": "B"},
    {"type": "saw", "x": 16, "y": 4, "path": [[16, 4], [21, 4]], "speed": 1.5},
    {"type": "laser", "x": 33, "y": 2, "dir": "l", "on": 90, "off": 60},
    {"type": "laser", "x": 30, "y": 7, "dir": "d", "channel": "D"},
]


def world(theme, i):
    return {"world": 90 + i, "name": "Test " + theme, "theme": theme, "levels": [
        {"id": "T-%d" % (i + 1), "name": "Showcase " + theme, "hint": "", "minPlayers": 2, "tether": theme == 'ropeway', "tetherLength": 4,
         "map": MAP, "entities": ENTS}]}


def main():
    extra = [world(t, i) for i, t in enumerate(THEMES)]
    with sync_playwright() as p:
        b = launch(p)
        ctx = new_context(b, viewport={'width': 1280, 'height': 720})
        ctx.add_init_script('window.__SB_EXTRA_LEVELS = %s;' % json.dumps(extra))
        pg = ctx.new_page()
        errs = watch(pg, 'render')
        pg.goto(URL)
        wait_for(pg, 'SB.Game.state().screen === "title"')
        levels = pg.evaluate('SB.Game.levels()')
        base = len(levels) - len(THEMES)
        for i, t in enumerate(THEMES):
            pg.evaluate('SB.Game.localStart(%d, 4)' % (base + i))
            wait_for(pg, 'SB.Game.state().screen === "play"')
            pg.wait_for_timeout(500 if i else 900)
            shot(pg, '20-theme-%02d-%s' % (i + 1, t))
        check(len(pg.evaluate('SB.Game.state().players')) == 4, 'showcase level runs with 4 bots')
        # stack + walk + jump a bit for motion poses
        pg.keyboard.down('d')
        pg.wait_for_timeout(300)
        pg.keyboard.press('Space')
        pg.wait_for_timeout(120)
        shot(pg, '21-motion')
        pg.keyboard.up('d')
        check(errs == [], 'no console errors while rendering every theme: %s' % errs[:5])
        b.close()

    # artifact shape
    art = open(os.path.join(ROOT, 'dist', 'artifact.html'), encoding='utf8').read()
    check(art.startswith('<title>Stackbots</title>\n<link href="https://fonts.googleapis.com/'), 'artifact.html starts with <title> then the Google Fonts link')
    low = art.lower()
    check('<!doctype' not in low and '<html' not in low and '<head' not in low and '<body' not in low, 'artifact.html has no document wrapper tags')
    check('<style>' in art[:400], 'artifact.html has <style> right after the font link')
    for bad in ('alert(', 'confirm(', 'prompt(', ' download'):
        check(bad not in art.replace('window.prompt', ''), 'artifact contains no "%s"' % bad.strip())
    size = os.path.getsize(os.path.join(ROOT, 'dist', 'stackbots.html'))
    check(size < 1024 * 1024, 'standalone build under 1 MB (%d KiB)' % (size // 1024))


if __name__ == '__main__':
    run(main)
