"""Pack the art pictures into a few large sheets (atlases).

  python3 tools/pack_atlas.py

Every picture listed in art/manifest.json and art/interior/manifest.json is packed, as it is, into atlas-0.png,
atlas-1.png… (at most 4096 px a side) in the same folder, and its manifest entry gains "atlas": n and "rect":
[x, y, w, h]. The game draws from the atlases when they are there (one download instead of hundreds); the single
pictures stay as the source, so tools that write them (render3d.py, trim.py) need nothing new: run this afterwards.
"""
import json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
MAX = 4096; PAD = 2


def pack(folder):
    mp = os.path.join(folder, 'manifest.json'); man = json.load(open(mp))
    slots = man['slots']
    files = sorted({s['file'] for s in slots.values()}, key=lambda f: -Image.open(os.path.join(folder, f)).size[1])
    ims = {f: Image.open(os.path.join(folder, f)).convert('RGBA') for f in files}
    sheets, where = [], {}
    cur, x, y, row = None, 0, 0, 0
    def new():
        nonlocal cur, x, y, row
        cur = []; sheets.append(cur); x = y = row = 0
    new()
    for f in files:
        w, h = ims[f].size
        if x + w > MAX: x = 0; y += row + PAD; row = 0
        if y + h > MAX: new()
        cur.append((f, x, y)); where[f] = (len(sheets) - 1, x, y, w, h)
        x += w + PAD; row = max(row, h)
    for old in [n for n in os.listdir(folder) if n.startswith('atlas-') and n.endswith('.png')]: os.remove(os.path.join(folder, old))
    for k, items in enumerate(sheets):
        W = max(x + ims[f].size[0] for f, x, y in items); H = max(y + ims[f].size[1] for f, x, y in items)
        S = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for f, x, y in items: S.paste(ims[f], (x, y))
        S.save(os.path.join(folder, f'atlas-{k}.png'), optimize=True)
    for s in slots.values():
        a, x, y, w, h = where[s['file']]; s['atlas'] = a; s['rect'] = [x, y, w, h]
    man['atlases'] = len(sheets)
    json.dump(man, open(mp, 'w'), indent=1)
    print(f'{os.path.relpath(folder, ROOT)}: {len(files)} pictures → {len(sheets)} atlas sheets')


if __name__ == '__main__':
    for d in ('art', os.path.join('art', 'interior')): pack(os.path.join(ROOT, d))
