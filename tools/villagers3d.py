"""Villagers, rendered from 3D: a small round-headed figure in every pose the game uses, ready to be recoloured.

  python3 tools/villagers3d.py

Each pose's frames are rendered twice in the game's own view: once lit (the parts the game recolours are white), and
once in flat colours that say which part each pixel belongs to. The two are split into layers, one row each:

  row 0  base     what never changes colour (shoes, eyes, cheeks, belt) and the shadow on the ground
  row 1  skin     row 2  shirt     row 3  legs     row 4  hair

The game multiplies each villager's own colours into rows 1-4 and lays them over row 0 (js/ui/render/villagers.js).
Written to art/villager/sheet.png and art/villager/manifest.json.
"""
import asyncio, base64, io, json, math, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'models'))
from kit import Mesh, write_glb

OUT = os.path.join(ROOT, 'art', 'villager')
LAYERS = ['skin', 'shirt', 'legs', 'hair']
IDS = {'v-skin': [1, 0, 0], 'v-shirt': [0, 1, 0], 'v-legs': [0, 0, 1], 'v-hair': [1, 1, 0]}

# ---------------------------------------------------------------- the figure. It faces +x; the game mirrors it.
CX, CZ = 0.5, 0.5
HIP, SHOULDER, NECK, HEAD_R = 0.17, 0.36, 0.39, 0.115


def figure(legs=(0, 0), arms=((0.0, -0.17), (0.0, -0.17)), lift=0.0, lean=0.0, sit=False, head_tilt=0.0, hat=False):
    """legs: forward swing of each foot (x); arms: each hand's (forward x, height below the shoulder); lift: whole body
    up (a bob); lean: forward lean of the body top."""
    M = Mesh(); y0 = lift
    hip = HIP + y0 - (0.09 if sit else 0)
    for side, sw in zip((-1, 1), legs):            # legs and shoes
        z = CZ + side * 0.045
        if sit:
            M.rod('v-legs', (CX, hip, z), (CX + 0.15, hip, z), 0.034, n=6)
            M.rod('v-legs', (CX + 0.15, hip, z), (CX + 0.16, y0 + 0.02, z), 0.032, n=6)
            M.box('v-shoe', CX + 0.14, y0, z - 0.03, CX + 0.21, y0 + 0.035, z + 0.03)
        else:
            foot = (CX + sw, y0 + 0.02 + max(0, -sw) * 0.25, z)
            M.rod('v-legs', (CX, hip, z), foot, 0.035, n=6, taper=0.9)
            M.box('v-shoe', foot[0] - 0.03, foot[1] - 0.02, z - 0.03, foot[0] + 0.045, foot[1] + 0.02, z + 0.03)
    # body: a soft tapered shirt, wider at the hem, with a belt
    top = SHOULDER + hip - HIP
    M.rod('v-shirt', (CX, hip - 0.01, CZ), (CX + lean, top, CZ), 0.085, n=10, taper=0.78)
    M.cylinder('v-belt', CX + lean * 0.15, CZ, 0.087, hip + 0.035, hip + 0.055, n=10, top=False)
    M.blob('v-shirt', CX + lean, top - 0.01, CZ, 0.07, seed=3, squash=0.6)   # shoulders
    # arms: sleeve to the elbow, then skin; small round hands
    for side, (fx, dy) in zip((-1, 1), arms):
        sh = np.array([CX + lean, top - 0.02, CZ + side * 0.085])
        hand = np.array([sh[0] + fx, sh[1] + dy, sh[2] + side * 0.02])
        elbow = sh + (hand - sh) * 0.5 + np.array([-0.01, 0, side * 0.015])
        M.rod('v-shirt', sh, elbow, 0.028, n=6); M.rod('v-skin', elbow, hand, 0.022, n=6)
        M.blob('v-skin', hand[0], hand[1], hand[2], 0.026, seed=5, squash=1.0)
    # head: a big round head, hair over the back and top, two dot eyes and rosy cheeks on the +x side
    hy = top + 0.03 + HEAD_R
    hx = CX + lean * 1.2 + head_tilt
    M.rod('v-skin', (CX + lean, top - 0.01, CZ), (hx, hy - HEAD_R * 0.7, CZ), 0.035, n=6)
    M.blob('v-skin', hx, hy, CZ, HEAD_R, seed=11, squash=0.95)
    M.blob('v-hair', hx - 0.04, hy + 0.05, CZ, HEAD_R * 1.0, seed=12, squash=0.72)       # the crown
    M.blob('v-hair', hx - 0.06, hy - 0.02, CZ, HEAD_R * 0.86, seed=13, squash=1.0)        # the back
    for side in (-1, 1):
        M.box('v-eye', hx + HEAD_R * 0.9, hy - 0.005, CZ + side * 0.042 - 0.011, hx + HEAD_R * 0.98, hy + 0.025, CZ + side * 0.042 + 0.011)
        M.blob('v-cheek', hx + HEAD_R * 0.8, hy - 0.022, CZ + side * 0.065, 0.013, seed=20 + side, squash=0.6)
    if hat:
        M.cylinder('v-hair', hx - 0.01, CZ, HEAD_R * 1.25, hy + 0.07, hy + 0.085, n=12)
        M.cylinder('v-hair', hx - 0.01, CZ, HEAD_R * 0.75, hy + 0.085, hy + 0.15, n=10)
    return M


def poses():
    s = lambda k, n: math.sin(2 * math.pi * k / n)
    P = {}
    P['idle'] = [figure(lift=0.0), figure(lift=0.004, arms=((0.01, -0.165), (0.01, -0.165)))]
    P['walk'] = [figure(legs=(0.07 * s(k, 4), -0.07 * s(k, 4)), arms=((-0.06 * s(k, 4), -0.15), (0.06 * s(k, 4), -0.15)), lift=0.012 * abs(s(k, 4)), lean=0.015) for k in range(4)]
    P['carry'] = [figure(legs=(0.06 * s(k, 4), -0.06 * s(k, 4)), arms=((0.11, -0.03), (0.11, -0.03)), lift=0.01 * abs(s(k, 4)), lean=0.01) for k in range(4)]
    P['work'] = [figure(arms=((0.02, -0.16), (0.04 + 0.08 * (1 - a), 0.14 * a - 0.12)), lean=0.03 * (1 - a), legs=(0.03, -0.03)) for a in (1.0, 0.55, 0.0)]
    P['cheer'] = [figure(arms=((0.02, 0.17 + d), (0.02, 0.17 - d)), lift=l) for d, l in ((0.02, 0.02), (-0.02, 0.0))]
    P['sit'] = [figure(sit=True, arms=((0.1, -0.12), (0.1, -0.12)))]
    return P


# ---------------------------------------------------------------- render and split into layers
async def render_all(P, zoom=1):
    from playwright.async_api import async_playwright
    tmp = os.path.join(HERE, 'models', 'out'); os.makedirs(tmp, exist_ok=True)
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'])
        page = await b.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('file://' + os.path.join(HERE, 'render3d', 'render.html'))
        for name, frames in P.items():
            out[name] = []
            for k, M in enumerate(frames):
                f = os.path.join(tmp, f'villager-{name}-{k}.glb'); write_glb(M, f, f'villager-{name}-{k}')
                data = base64.b64encode(open(f, 'rb').read()).decode()
                pair = []
                for ids in (None, IDS):
                    o = {'tiles': [1, 1], 'anchor': 'centre', 'keepPlace': True, 'season': 'summer', 'ss': 4 if zoom == 1 else 2, 'zoom': zoom, **({'ids': ids} if ids else {})}
                    r = await page.evaluate("""async ([b64, o]) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return render(u.buffer, o); }""", [data, o])
                    if errors: raise SystemExit('render failed: ' + errors[-1])
                    pair.append(r)
                out[name].append(pair)
        await b.close()
    return out


def split(lit, ids, shadow=True):
    """Lit picture + flat part colours -> [base, skin, shirt, legs, hair] (RGBA arrays of the same size)."""
    from PIL import Image
    L = np.array(Image.open(io.BytesIO(base64.b64decode(lit['image'].split(',', 1)[1]))).convert('RGBA')).astype(np.float32)
    I = np.array(Image.open(io.BytesIO(base64.b64decode(ids['image'].split(',', 1)[1]))).convert('RGBA')).astype(np.float32)
    rgb, a = I[..., :3] / 255, I[..., 3] / 255
    # which part: the nearest of the flat colours (black = a part that keeps its colour)
    keys = [np.array([0, 0, 0])] + [np.array(IDS['v-' + n]) for n in LAYERS]
    d = np.stack([np.linalg.norm(rgb - k, axis=-1) for k in keys], -1)
    part = np.argmin(d, -1); part[a < 0.05] = 0   # no figure there: the ground shadow, kept in the base
    if not shadow: L[..., 3] = np.where(a < 0.05, 0, L[..., 3])   # indoors the room is lit by the game: no sun shadow
    layers = []
    for i in range(len(keys)):
        x = L.copy(); x[..., 3] = np.where(part == i, L[..., 3], 0); layers.append(x)
    return layers


def main():
    build(1, 'sheet', True)
    build(3, 'sheet-big', False)   # for the interiors, where people are drawn much larger


def build(zoom, sheetname, preview):
    from PIL import Image
    P = poses()
    R = asyncio.run(render_all(P, zoom))
    # one frame size for everything, every anchor in the same place
    allr = [pr[0] for v in R.values() for pr in v]
    left = max(r['anchor'][0] for r in allr); right = max(r['w'] - r['anchor'][0] for r in allr)
    top = max(r['anchor'][1] for r in allr); below = max(r['h'] - r['anchor'][1] for r in allr)
    fw, fh = left + right, top + below
    n = sum(len(v) for v in R.values())
    sheet = np.zeros((fh * 5, fw * n, 4), np.float32)
    man = {'scale': 0.5, 'w': fw, 'h': fh, 'anchor': [left, top], 'layers': ['base'] + LAYERS, 'poses': {}}
    col = 0
    for name, frames in R.items():
        man['poses'][name] = {'start': col, 'frames': len(frames), 'fps': {'walk': 7, 'carry': 6, 'work': 5, 'idle': 1.2, 'cheer': 4, 'sit': 1}[name]}
        for lit, ids in frames:
            ls = split(lit, ids, shadow=zoom == 1)
            ox, oy = col * fw + left - lit['anchor'][0], top - lit['anchor'][1]
            for row, x in enumerate(ls):
                h, w = x.shape[:2]; sheet[row * fh + oy: row * fh + oy + h, ox: ox + w] = x
            col += 1
    os.makedirs(OUT, exist_ok=True)
    # the standing figure's height in pixels (feet to crown), so a scene can size it to its own metres
    a0 = sheet[fh * 1: fh * 5, :fw, 3].max(0) if False else np.maximum.reduce([sheet[r * fh:(r + 1) * fh, :fw, 3] for r in range(1, 5)])
    rows = np.where(a0.max(1) > 40)[0]; man['figH'] = int(top - rows[0]) if len(rows) else fh
    Image.fromarray(np.clip(sheet, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, sheetname + '.png'), optimize=True)
    mp = os.path.join(OUT, 'manifest.json'); M = json.load(open(mp)) if os.path.exists(mp) and sheetname != 'sheet' else {}
    if sheetname == 'sheet': M = man
    else: M = {**M, 'big': {**man, 'file': sheetname + '.png'}}
    json.dump(M, open(mp, 'w'), indent=1)
    if not preview: return
    # a preview: a few villagers in their colours, on grass
    prev = Image.new('RGBA', (fw * n, fh * 3), (156, 194, 126, 255))
    S = Image.open(os.path.join(OUT, 'sheet.png'))
    for r, cols in enumerate([['#e8b48a', '#b5523e', '#5a4a3a', '#6a4a2c'], ['#c08a5d', '#4f7fb5', '#4a3b2a', '#2a1a10'], ['#8a5a3a', '#5f8a44', '#6a5a4a', '#d9b46a']]):
        for c in range(n):
            base = S.crop((c * fw, 0, (c + 1) * fw, fh)); fig = base.copy()
            for li, hexc in enumerate(cols):
                lay = np.array(S.crop((c * fw, (li + 1) * fh, (c + 1) * fw, (li + 2) * fh))).astype(np.float32)
                rgb = np.array([int(hexc[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
                lay[..., :3] = lay[..., :3] * rgb / 255
                fig.alpha_composite(Image.fromarray(lay.astype(np.uint8), 'RGBA'))
            prev.alpha_composite(fig, (c * fw, r * fh))
    prev = prev.resize((prev.width * 2, prev.height * 2), Image.NEAREST)
    prev.save(os.path.join(HERE, 'previews', 'villagers.png'))
    print(f'{n} frames, {fw}×{fh} each → art/villager/sheet.png; preview tools/previews/villagers.png')


if __name__ == '__main__':
    main()
