"""Shared helpers for the STACKBOTS client Playwright tests."""
import os, sys, time, json

os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DIST = os.path.join(ROOT, 'dist', 'stackbots.html')
URL = 'file://' + DIST
SHOTS = os.path.join(ROOT, 'test', 'client', 'shots')
FAKES = os.path.join(ROOT, 'test', 'fakes')
os.makedirs(SHOTS, exist_ok=True)

# Fonts/CDNs are unreachable in the sandbox: block them fast so pages don't hang, and ignore their console noise.
BLOCK_HOSTS = ('fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com')
IGNORABLE = ('fonts.googleapis', 'fonts.gstatic', 'net::ERR', 'Failed to load resource')


class Failure(Exception):
    pass


def check(cond, msg):
    if not cond:
        raise Failure(msg)
    print('  ok  ' + msg)


def launch(p):
    return p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])


def new_context(browser, **kw):
    ctx = browser.new_context(**kw)

    def route(r):
        if any(h in r.request.url for h in BLOCK_HOSTS):
            return r.abort()
        return r.continue_()
    ctx.route('**/*', route)
    return ctx


def watch(page, tag=''):
    """Collect console errors / page errors on a page."""
    errs = []
    page.on('console', lambda m: errs.append('%s console.%s: %s' % (tag, m.type, m.text)) if m.type in ('error',) and not any(s in m.text for s in IGNORABLE) else None)
    page.on('pageerror', lambda e: errs.append('%s pageerror: %s' % (tag, e)))
    page._sb_errs = errs
    return errs


def state(page):
    return page.evaluate('SB.Game.state()')


def wait_for(page, js, timeout=8000, msg=None):
    t0 = time.time()
    while time.time() - t0 < timeout / 1000.0:
        try:
            if page.evaluate(js):
                return True
        except Exception:
            pass
        page.wait_for_timeout(50)
    raise Failure(msg or ('timed out waiting for: ' + js))


def hold(page, keys, ms):
    for k in keys:
        page.keyboard.down(k)
    page.wait_for_timeout(ms)
    for k in keys:
        page.keyboard.up(k)


def tap(page, key, ms=60):
    page.keyboard.down(key)
    page.wait_for_timeout(ms)
    page.keyboard.up(key)


def set_name(page, name):
    page.fill('#in-name', name)
    page.dispatch_event('#in-name', 'change')


def shot(page, name):
    path = os.path.join(SHOTS, name + '.png')
    page.screenshot(path=path)
    return path


def run(main):
    t0 = time.time()
    try:
        main()
    except Failure as e:
        print('FAIL ' + str(e))
        sys.exit(1)
    print('PASS (%.1fs)' % (time.time() - t0))
