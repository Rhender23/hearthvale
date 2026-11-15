#!/usr/bin/env python3
"""Hearthvale art trimmer: takes a picture with a background, removes the background, trims it, sizes it for its art
slot and installs it in art/ (image + manifest entry). Run from the game folder.

  python3 tools/trim.py picture.png --slot building/house/0
  python3 tools/trim.py walk-sheet.png --slot villager/walk --frames 4 --fps 8
  python3 tools/trim.py grass.png --slot ground/grass/summer --frames 3 --random
  python3 tools/trim.py picture.png --slot node/tree --preview-only        # check it first, install nothing

How the background is found
  - A picture that already has transparency keeps it; only the trimming and sizing happen.
  - Otherwise the colours along the picture's edges are the background: one colour (a white or flat backdrop) or two
    (a grey-and-white checkerboard, as some tools export "transparent" images). Every pixel close to those colours
    (within --tolerance) AND connected to the edge is removed, so the same colour inside the object (white windows,
    a white beard) stays. --holes also clears enclosed background patches (the gap inside a wreath or an arch).
  - Edges are softened and the backdrop's colour is taken back out of the half-transparent rim, so no white halo.

Sizing: the width comes from art/slots.json (node tools/slots.mjs) for the slot, or --width; height follows the
picture. Sprite sheets (--frames N) are N frames side by side, all trimmed to the same box.
The image's bottom centre sits on the slot's ground point; --anchor X,Y overrides (in the output's pixels).
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
ART = os.path.join(GAME, 'art')


def border_pixels(rgb, ring=3):
    h, w, _ = rgb.shape
    return np.concatenate([rgb[:ring].reshape(-1, 3), rgb[-ring:].reshape(-1, 3), rgb[:, :ring].reshape(-1, 3), rgb[:, -ring:].reshape(-1, 3)]).astype(float)


def backdrop_colours(rgb, tol):
    """The one or two colours that make up most of the picture's edge (a flat backdrop or a checkerboard)."""
    px = border_pixels(rgb)
    q = (px // 8).astype(int)
    keys, counts = np.unique(q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2], return_counts=True)
    order = np.argsort(-counts)
    cols, covered = [], np.zeros(len(px), bool)
    for k in order[:6]:
        sel = (q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2]) == keys[k]
        c = px[sel].mean(0)
        if any(np.linalg.norm(c - o) < tol for o in cols):
            continue
        cols.append(c)
        covered |= np.linalg.norm(px - c, axis=1) < tol
        if covered.mean() > 0.9 or len(cols) == 2:
            break
    return cols, covered.mean()


def remove_background(img, tol, holes=False):
    rgba = np.asarray(img.convert('RGBA')).astype(float)
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    corners = [alpha[0, 0], alpha[0, -1], alpha[-1, 0], alpha[-1, -1]]
    if min(corners) < 16:                       # already transparent: keep it
        return rgba, 'already transparent'
    cols, cover = backdrop_colours(rgb.astype(np.uint8), tol)
    if cover < 0.6:
        print(f'  note: the edge is only {cover:.0%} one backdrop colour; removing what matches it', file=sys.stderr)
    dist = np.min([np.linalg.norm(rgb - c, axis=2) for c in cols], axis=0)
    near = dist < tol
    lab, n = ndimage.label(near, structure=np.ones((3, 3)))
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    if holes:   # enclosed backdrop patches bigger than a few pixels
        sizes = ndimage.sum(near, lab, range(1, n + 1))
        bg |= np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 24])
    # Soft rim: pixels just inside the object fade by how close they are to the backdrop colour.
    rim = ndimage.binary_dilation(bg, iterations=2) & ~bg
    a = np.where(bg, 0.0, 1.0)
    soft = np.clip((dist - tol * 0.5) / (tol * 1.5), 0, 1)
    a = np.where(rim, np.minimum(a, np.maximum(soft, 0.15)), a)
    # Take the backdrop colour back out of half-transparent rim pixels (no light halo on dark grass).
    bgc = cols[0]
    a3 = a[..., None]
    rgb_out = np.where(a3 > 0.01, (rgb - (1 - a3) * bgc) / np.maximum(a3, 0.01), rgb)
    out = np.dstack([np.clip(rgb_out, 0, 255), a * alpha])
    return out, f'backdrop {"/".join("#%02x%02x%02x" % tuple(int(v) for v in c) for c in cols)} removed'


def trim_box(alpha, pad=2):
    ys, xs = np.where(alpha > 10)
    if not len(xs):
        sys.exit('  nothing left after removing the background: try a lower --tolerance')
    h, w = alpha.shape
    return max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + 1 + pad), min(h, ys.max() + 1 + pad)


def resize_premultiplied(arr, w, h):
    a = arr[..., 3:4] / 255.0
    pm = np.dstack([arr[..., :3] * a, arr[..., 3:4]]).astype(np.float32)
    chans = [np.asarray(Image.fromarray(pm[..., i]).resize((w, h), Image.LANCZOS)) for i in range(4)]
    out = np.dstack(chans)
    al = np.clip(out[..., 3:4], 0, 255) / 255.0
    rgb = np.where(al > 0.004, out[..., :3] / np.maximum(al, 0.004), 0)
    return np.dstack([np.clip(rgb, 0, 255), np.clip(out[..., 3:4], 0, 255)]).astype(np.uint8)


def slot_width(slot):
    try:
        cat = json.load(open(os.path.join(ART, 'slots.json')))
    except OSError:
        return None
    parts = slot.split('/')
    for n in range(len(parts), 0, -1):   # building/house/2/winter → building/house/2 → building/house …
        if '/'.join(parts[:n]) in cat:
            return cat['/'.join(parts[:n])]['w']
    base = slot.rsplit('-', 1)[0]        # building/house/0-night → building/house/0
    return slot_width(base) if base != slot else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('picture')
    ap.add_argument('--slot', required=True, help='art slot, e.g. building/house/0 (see art/SLOTS.md)')
    ap.add_argument('--frames', type=int, default=1, help='frames side by side in a sprite sheet')
    ap.add_argument('--fps', type=float, help='animation speed (frames per second)')
    ap.add_argument('--random', action='store_true', help='frames are variants picked by position, not animation')
    ap.add_argument('--width', type=int, help='output width per frame in px (default: the slot\'s size)')
    ap.add_argument('--tolerance', type=float, default=28, help='how close to the backdrop colour counts as backdrop (0–255)')
    ap.add_argument('--holes', action='store_true', help='also clear enclosed backdrop patches')
    ap.add_argument('--anchor', help='X,Y in the output (one frame) that sits on the ground point; default bottom centre')
    ap.add_argument('--keep-size', action='store_true', help='trim only, do not resize')
    ap.add_argument('--preview-only', action='store_true', help='write a preview, install nothing')
    o = ap.parse_args()

    img = Image.open(o.picture)
    arr, how = remove_background(img, o.tolerance, o.holes)
    H, W = arr.shape[:2]
    fw = W // o.frames
    frames = [arr[:, i * fw:(i + 1) * fw] for i in range(o.frames)]
    boxes = [trim_box(f[..., 3]) for f in frames]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    frames = [f[y0:y1, x0:x1] for f in frames]
    tw = None if o.keep_size else (o.width or slot_width(o.slot))
    if tw:
        th = max(1, round(frames[0].shape[0] * tw / frames[0].shape[1]))
        frames = [resize_premultiplied(f, tw, th) for f in frames]
    sheet = np.concatenate(frames, axis=1).astype(np.uint8)
    out_img = Image.fromarray(sheet, 'RGBA')
    fh, fwid = sheet.shape[0], sheet.shape[1] // o.frames
    name = o.slot.replace('/', '-') + '.png'
    print(f'  {how}; trimmed to {x1 - x0}×{y1 - y0}' + (f', scaled to {fwid}×{fh}' if tw else '') + (f' × {o.frames} frames' if o.frames > 1 else ''))

    # Preview on a checkerboard, with the ground point marked, so the cut can be checked by eye.
    pv = Image.new('RGBA', (sheet.shape[1] + 20, fh + 20), (255, 255, 255, 255))
    ck = np.indices((pv.height // 8 + 1, pv.width // 8 + 1)).sum(0) % 2
    pv = Image.fromarray(np.kron(ck, np.ones((8, 8)))[:pv.height, :pv.width].astype(np.uint8) * 40 + 190).convert('RGBA')
    pv.alpha_composite(out_img, (10, 10))
    ax, ay = (map(float, o.anchor.split(',')) if o.anchor else (fwid / 2, fh))
    px = np.asarray(pv).copy()
    for f in range(o.frames):
        cx, cy = int(10 + f * fwid + ax), int(10 + ay)
        px[max(0, cy - 2):cy + 3, max(0, cx - 2):cx + 3] = (220, 40, 40, 255)
    preview = os.path.join(HERE, 'previews', 'preview-' + name)   # kept beside the tools, never published with the game
    os.makedirs(os.path.dirname(preview), exist_ok=True)
    Image.fromarray(px).save(preview)
    print(f'  preview: {preview}')
    if o.preview_only:
        return

    os.makedirs(ART, exist_ok=True)
    out_img.save(os.path.join(ART, name), optimize=True)
    mpath = os.path.join(ART, 'manifest.json')
    try:
        man = json.load(open(mpath))
    except OSError:
        man = {'scale': 0.5, 'slots': {}}
    entry = {'file': name}
    if o.frames > 1:
        entry['frames'] = o.frames
    if o.fps:
        entry['fps'] = o.fps
    if o.random:
        entry['random'] = True
    if o.anchor:
        entry['anchor'] = [float(v) for v in o.anchor.split(',')]
    man.setdefault('slots', {})[o.slot] = entry
    man['slots'] = dict(sorted(man['slots'].items()))
    json.dump(man, open(mpath, 'w'), indent=1)
    print(f'  installed: art/{name} → slot {o.slot}')


if __name__ == '__main__':
    main()
