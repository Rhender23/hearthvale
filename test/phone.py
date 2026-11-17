"""Phone and iPad check: every menu opens, scrolls, switches tabs and closes, nothing is squeezed out of sight, and
the things on screen don't sit on top of each other.

  python3 -m http.server 8765 &      (from the game folder)
  python3 test/phone.py

Needs Playwright for Python and Chrome. Prints each check and exits non-zero if any fail.
"""
import asyncio, sys
from playwright.async_api import async_playwright

URL = 'http://localhost:8765/'
SIZES = [('phone', 390, 844, True), ('small phone', 360, 640, True), ('iPad', 1024, 768, True), ('desktop', 1280, 800, False)]
fails = 0


def check(name, ok, extra=''):
    global fails
    print(('  ✓ ' if ok else '  ✗ ') + name + (f'  ({extra})' if extra and not ok else ''))
    if not ok: fails += 1


async def overlaps(pg, a, b):
    return await pg.evaluate("""([a, b]) => { const A = document.querySelector(a), B = document.querySelector(b);
      if (!A || !B || A.hidden || B.hidden || !A.offsetParent || !B.offsetParent) return false;
      const r = A.getBoundingClientRect(), q = B.getBoundingClientRect();
      return r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top; }""", [a, b])


async def run(p, label, w, h, touch):
    print(f'{label} {w}×{h}')
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader'])
    pg = await b.new_page(viewport={'width': w, 'height': h}, is_mobile=touch and w < 900, has_touch=touch)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(2500)
    await pg.evaluate("() => { __hv.game.age = 2; }")
    inside = lambda sel: pg.evaluate("""s => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; }""", sel)
    for tab in ('build', 'village', 'book', 'game'):
        await pg.click(f'[data-tab={tab}]'); await pg.wait_for_timeout(350)
        check(f'{tab}: the sheet opens on screen', await inside('.sheet'))
        check(f'{tab}: its close button is on screen', await inside('.sheet .sh-x'))
        check(f'{tab}: the tab bar is not covered', not await overlaps(pg, '#tabbar', '.sheet'))
        check(f'{tab}: no bubble over the sheet', not await overlaps(pg, '#pop', '.sheet'))
        if tab == 'village':
            hs = await pg.evaluate("() => [...document.querySelectorAll('.sh-body .secth, .sh-body .shsub')].map(e => e.offsetHeight)")
            check('village: headings sit close to their lists (no stretched gaps)', all(x < 34 for x in hs), str(hs))
        if tab == 'build':
            hts = await pg.evaluate("() => document.querySelector('.tabs').getBoundingClientRect().height")
            check('build: the category tabs keep their height', hts >= 40, f'{hts}px')
            n = await pg.evaluate("() => document.querySelectorAll('.tabs .tab').length")
            for i in range(min(n, 8)):
                await pg.evaluate(f"() => document.querySelectorAll('.tabs .tab')[{i}].click()"); await pg.wait_for_timeout(80)
            await pg.evaluate("() => { const b = document.querySelector('.sh-body'); b.scrollTop = b.scrollHeight; }"); await pg.wait_for_timeout(150)
            hts = await pg.evaluate("() => document.querySelector('.tabs').getBoundingClientRect().height")
            check('build: after every tab and a scroll, the tabs are still whole', hts >= 40, f'{hts}px')
        await pg.click(f'[data-tab={tab}]'); await pg.wait_for_timeout(300)
        closed = await pg.evaluate("() => document.querySelector('.sheet').hidden || !document.body.classList.contains('sheet-open')")
        check(f'{tab}: tapping its tab again closes it', closed)
    # questions never get lost: New game and Rename from the Game sheet
    await pg.click('[data-tab=game]'); await pg.wait_for_timeout(300)
    await pg.click('.slot .sm button'); await pg.wait_for_timeout(300)
    btns = await pg.query_selector_all('.slot .sm button')
    ren = [b for b in btns if (await b.text_content()) == 'Rename']
    if ren:
        await ren[0].click(); await pg.wait_for_timeout(250)
        f = await pg.query_selector('input.asktext')
        check('game: Rename asks for a name inside the sheet', f is not None)
        if f:
            await f.fill('Willowmere'); await pg.click('.inconfirm .pbtn.primary'); await pg.wait_for_timeout(250)
            check('game: the slot takes its new name', 'Willowmere' in (await pg.text_content('.slot')))
    else: check('game: a saved slot offers Rename', False)
    await pg.evaluate("() => { __hv.game.clock += 432 * 3; }")
    await pg.click('.lrow[data-k=newgame]'); await pg.wait_for_timeout(250)
    q = await pg.query_selector('.inconfirm')
    check('game: New game asks first, inside the sheet', q is not None)
    if q:
        await pg.click('.inconfirm .pbtn.danger'); await pg.wait_for_timeout(600)
        fresh = await pg.evaluate("async () => { const st = await import('/js/core/state.js'); return st.dayNumber(__hv.game) === 1 && !document.body.classList.contains('sheet-open'); }")
        check('game: New game starts a fresh village and closes the menu', fresh)
    await pg.evaluate("() => { for (let i = 0; i < 5; i++) { localStorage.removeItem('hv-slot-' + i); localStorage.removeItem('hv-slot-meta-' + i); } }")
    # stores bar: the five basics and the homes are all visible without scrolling
    fits = await pg.evaluate("""() => { const h = document.getElementById('hud'), r = h.getBoundingClientRect();
      return [...h.children].filter(c => !c.classList.contains('adv') && getComputedStyle(c).display !== 'none').every(c => { const q = c.getBoundingClientRect(); return q.right <= r.right + 1 && q.left >= r.left - 1; }); }""")
    check('the stores bar shows every store without scrolling', fits)
    check('the stores bar and the clock do not overlap', not await overlaps(pg, '#hud', '#clockpill'))
    check('no errors on the page', not errs, '; '.join(errs[:2]))
    await b.close()


async def main():
    async with async_playwright() as p:
        for s in SIZES: await run(p, *s)
    print(f'{"all passed" if not fails else str(fails) + " failed"}')
    sys.exit(1 if fails else 0)

asyncio.run(main())
