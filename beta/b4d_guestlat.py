"""4d. Guest input latency with only host + 1 guest (less CPU contention), relay emulated, no added network delay."""
from bt import *  # noqa
sys.path.insert(0, FAKES)
from mqtt_broker import Broker, refuse
LAT = """(K) => new Promise(res => { setTimeout(() => res(-1), 3000); const me = SB.Game.state().slot, R = SB.Render, f0 = R.frame; let x0 = null, t0 = 0, done = false;
  R.frame = function (w, o) { const q = o && o.pp && o.pp[me], p = w.players.find(p => p.slot === me), x = q ? q.x : p.x;
    if (x0 === null) { x0 = x; t0 = performance.now(); document.dispatchEvent(new KeyboardEvent('keydown', {code: K, key: K, bubbles: true})); }
    else if (!done && Math.abs(x - x0) > 0.5) { done = true; document.dispatchEvent(new KeyboardEvent('keyup', {code: K, key: K, bubbles: true})); R.frame = f0; res(performance.now() - t0); }
    return f0.apply(this, arguments); }; })"""
def main():
    with sync_playwright() as p:
        b = launch(p); ctx = new_context(b, viewport={'width': 960, 'height': 540})
        ctx.route_web_socket('wss://broker.emqx.io:8084/mqtt', refuse)
        for u in ('wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'):
            ctx.route_web_socket(u, Broker(u).handle)
        host, g = ctx.new_page(), ctx.new_page()
        for pg in (host, g): pg.goto(URL); wait_for(pg, 'window.SB && SB.Game && SB.Game.state().screen === "title"')
        host.click('#b-host'); wait_for(host, '!!SB.Game.state().code', 15000)
        g.fill('#in-code', state(host)['code']); g.click('#b-join'); wait_for(g, 'SB.Game.state().slot != null', 20000)
        host.click('#b-lobby-start'); host.wait_for_timeout(300); host.click('.card >> nth=0')
        for pg in (host, g): wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().players.length === 2', 8000)
        host.wait_for_timeout(800)
        print('host own bot (ms):', [round(host.evaluate(LAT, 'ArrowLeft')) for _ in range(3) if not host.wait_for_timeout(300)])
        print('guest own bot (ms):', [round(g.evaluate(LAT, 'ArrowRight')) for _ in range(5) if not g.wait_for_timeout(300)])
run(main)
