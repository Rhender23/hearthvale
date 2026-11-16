"""3D → 2D: render 3D models into the game's art slots.

Each model listed in tools/models/models.json is rendered in headless Chrome by tools/render3d/render.html, in the
game's own view (2:1 isometric, light from the upper left, a soft shadow on the ground, transparent background), and
installed into art/ and art/manifest.json as:

  <slot>              the model in spring, summer and autumn (buildings), or per season (trees: "seasons": true)
  <slot>/winter       with snow on everything facing up (and bare branches for leafy trees)
  <slot>-night        what glows after dark (windows, lamps), with a soft halo: the game fades it in at dusk
  <slot>/turned/...   the model turned to face the other way (buildings with "turn": true), drawn, not mirrored

models.json entries:
  { "file": "cottage.glb", "slot": "building/house/1", "tiles": [1, 1], "front": "+z", "turn": true,
    "fit": false, "seasons": false, "anchor": "front" }
  fit      true for models from image-to-3D tools (Meshy, Tripo, Hunyuan3D…): scales them into their footprint
  front    which way the model's door faces as it comes in (+z, -z, +x, -x)
  anchor   "front" (buildings: the front corner of the footprint) or "centre" (trees, bushes: the tile's middle)

  python3 tools/render3d.py                  render everything in models.json and install it
  python3 tools/render3d.py cottage.glb      just that one
  python3 tools/render3d.py --preview-only   write previews (tools/previews/3d-*.png), install nothing
"""
import argparse, asyncio, base64, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ART = os.path.join(ROOT, 'art')
MODELS = os.path.join(HERE, 'models')
PAGE = 'file://' + os.path.join(HERE, 'render3d', 'render.html')
CHROME = '/usr/bin/google-chrome'


def variants(m):
    """Every picture a model makes: (slot key, render options)."""
    base = {'tiles': m.get('tiles', [1, 1]), 'front': m.get('front', '+z'), 'fit': m.get('fit', False),
            'anchor': m.get('anchor', 'front'), 'evergreen': m.get('evergreen', False)}
    slot, out = m['slot'], []
    turns = [False, True] if m.get('turn') else [False]
    for turned in turns:
        s = slot.replace('building/', 'building/', 1)
        if turned:   # building/house/1 → building/house/turned/1
            parts = slot.split('/'); s = '/'.join(parts[:2] + ['turned'] + parts[2:])
        o = {**base, 'turn': turned}
        if m.get('indoor'):   # insides: one picture (no snow, and the game lights the room itself)
            out.append((s, {**o, 'season': 'summer', 'evergreen': True})); continue
        if m.get('seasons'):
            for season in ('spring', 'summer', 'autumn', 'winter'): out.append((f'{s}/{season}', {**o, 'season': season}))
        else:
            out.append((s, {**o, 'season': 'summer'}))
            out.append((f'{s}/winter', {**o, 'season': 'winter'}))
        out.append((f'{s}-night', {**o, 'night': True}))
    return out


def b64png(r):
    return base64.b64decode(r['image'].split(',', 1)[1])


def join_frames(rs):
    """Frames side by side on one sheet, every frame the same size with its anchor in the same place."""
    from PIL import Image
    import io
    ims = [Image.open(io.BytesIO(b64png(r))).convert('RGBA') for r in rs]
    left = max(r['anchor'][0] for r in rs); right = max(r['w'] - r['anchor'][0] for r in rs)
    top = max(r['anchor'][1] for r in rs); below = max(r['h'] - r['anchor'][1] for r in rs)
    fw, fh = left + right, top + below
    sheet = Image.new('RGBA', (fw * len(ims), fh), (0, 0, 0, 0))
    for k, (im, r) in enumerate(zip(ims, rs)): sheet.alpha_composite(im, (k * fw + left - r['anchor'][0], top - r['anchor'][1]))
    buf = io.BytesIO(); sheet.save(buf, 'PNG')
    return {'image': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), 'anchor': [left, top], 'w': fw * len(ims), 'h': fh, 'frames': len(ims)}


async def run(models, preview_only):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'])
        page = await b.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(PAGE)
        results = []
        for m in models:
            files = m.get('frames') or [m['file']]
            datas = [base64.b64encode(open(os.path.join(MODELS, f), 'rb').read()).decode() for f in files]
            for key, opts in variants(m):
                rs = []
                for data in datas:
                    r = await page.evaluate("""async ([b64, o]) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return render(u.buffer, o); }""", [data, opts])
                    if errors: raise SystemExit(f'{key}: render failed: ' + errors[-1])
                    rs.append(r)
                if all(r.get('empty') for r in rs): continue   # nothing glows: no night picture
                r = join_frames(rs) if len(rs) > 1 else rs[0]
                r['meta'] = {k: m[k] for k in ('random', 'fps') if k in m}; r['indoor'] = bool(m.get('indoor'))
                results.append((key, r))
                print(f'  {key:40s} {r["w"]}×{r["h"]}  anchor {r["anchor"]}' + (f'  {r["frames"]} frames' if r.get('frames') else ''))
        await b.close()
    os.makedirs(os.path.join(HERE, 'previews'), exist_ok=True)
    # Outdoor art goes to art/ (loaded with the game); insides go to art/interior/ (loaded when a door is first opened).
    mans = {}
    def manifest(indoor):
        d = os.path.join(ART, 'interior') if indoor else ART
        if d not in mans: p = os.path.join(d, 'manifest.json'); os.makedirs(d, exist_ok=True); mans[d] = json.load(open(p)) if os.path.exists(p) else {'scale': 0.5, 'slots': {}}
        return d, mans[d]
    for key, r in results:
        png = b64png(r)
        name = key.replace('/', '-') + '.png'
        open(os.path.join(HERE, 'previews', '3d-' + name), 'wb').write(png)
        if preview_only: continue
        d, man = manifest(r.get('indoor'))
        open(os.path.join(d, name), 'wb').write(png)
        man['slots'][key] = {'file': name, 'anchor': r['anchor'], **({'frames': r['frames']} if r.get('frames') else {}), **r.get('meta', {}), 'from': '3d'}
    if not preview_only:
        for d, man in mans.items(): json.dump(man, open(os.path.join(d, 'manifest.json'), 'w'), indent=1)
        # the game draws from atlases: pack them again so the new pictures are in (tools/pack_atlas.py)
        import pack_atlas
        for d in mans: pack_atlas.pack(d)
        print(f'installed {len(results)} pictures into ' + ', '.join(os.path.relpath(d, ROOT) for d in mans))
    return results


def contact_sheet(results, path):
    """All the pictures on grass, side by side, to look at in one go."""
    from PIL import Image
    import io
    ims = [(k, Image.open(io.BytesIO(b64png(r))).convert('RGBA')) for k, r in results if not k.endswith('-night') and '/turned' not in k]
    per = 10; rows = [ims[i:i + per] for i in range(0, len(ims), per)]
    W = max(sum(im.width for _, im in row) + 12 * (len(row) + 1) for row in rows); hs = [max(im.height for _, im in row) + 12 for row in rows]
    sheet = Image.new('RGBA', (W, sum(hs) + 12), (156, 194, 126, 255)); y = 12
    for row, h in zip(rows, hs):
        x = 12
        for k, im in row: sheet.alpha_composite(im, (x, y + h - 12 - im.height)); x += im.width + 12
        y += h
    sheet.save(path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('only', nargs='*', help='groups (homes, workshops…) or slots to render (default: all in models.json)')
    ap.add_argument('--preview-only', action='store_true')
    o = ap.parse_args()
    models = json.load(open(os.path.join(MODELS, 'models.json')))['models']
    if o.only: models = [m for m in models if m.get('group') in o.only or m['slot'] in o.only]
    if not models: sys.exit('no models to render')
    res = asyncio.run(run(models, o.preview_only))
    sheet = os.path.join(HERE, 'previews', '3d-sheet-' + (('-'.join(o.only) if len(o.only) < 4 else f'{len(o.only)}-slots') if o.only else 'all').replace('/', '_') + '.png'); contact_sheet(res, sheet); print('contact sheet:', sheet)
