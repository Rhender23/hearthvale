"""Insides of buildings, in metres (1 unit = 1 m), rendered in the game's own isometric view.

A room is a cutaway: the floor and the two back walls (the left wall runs along x = 0, the back wall along z = 0; the
front two are cut away so you can see in). Everything that never changes is modelled here: walls, floor, hearth,
windows, beams. Furniture is modelled one piece at a time ("props"), each standing on its own footprint
(x 0..w, z 0..d, front facing +z), so the game can place, move and turn it. What changes from moment to moment (fire,
light, people, food, goods, fill levels) is drawn live by the game on top.

ROOMS also says where the live things go (the hearth's firebox, the windows): written to art/interior/rooms.json so the
game and the models never disagree.

  python3 tools/models/catalogue.py interiors      write the models
  python3 tools/render3d.py room/... prop/...       render them into art/interior/
"""
import json, os
import numpy as np
from kit import Mesh

H = 2.6      # wall height
T = 0.18     # wall thickness


# ---------------------------------------------------------------- room styles
# size [width x, depth z]; wall, floor; trim; what the walls are made of; the hearth (on the left wall at z = hz)
ROOMS = {
    'hut':      {'size': [4.5, 4.0], 'wall': 'wall-log', 'floor': 'soil', 'trim': 'dark-wood', 'finish': 'logs', 'hearth': 'pit', 'windows': 1},
    'cottage':  {'size': [5.0, 4.5], 'wall': 'wall-plaster', 'floor': 'plank', 'trim': 'beam', 'finish': 'beams', 'hearth': 'stone', 'windows': 1},
    'cozy':     {'size': [5.5, 5.0], 'wall': 'wall-plaster', 'floor': 'plank', 'trim': 'beam', 'finish': 'wainscot', 'hearth': 'stone', 'windows': 2},
    'timber':   {'size': [6.0, 5.0], 'wall': 'wall-plaster', 'floor': 'plank', 'trim': 'beam', 'finish': 'timber', 'hearth': 'brick', 'windows': 2},
    'stone':    {'size': [6.5, 5.5], 'wall': 'wall-stone', 'floor': 'flagstone', 'trim': 'dark-wood', 'finish': 'stone', 'hearth': 'stone-big', 'windows': 2},
    'manor':    {'size': [7.0, 6.0], 'wall': 'wallpaper', 'floor': 'floor-polish', 'trim': 'white', 'finish': 'panel', 'hearth': 'marble', 'windows': 3},
    # upstairs rooms: the same walls, no hearth
    'timber-up': {'size': [6.0, 5.0], 'wall': 'wall-plaster', 'floor': 'plank', 'trim': 'beam', 'finish': 'timber', 'hearth': None, 'windows': 2},
    'stone-up':  {'size': [6.5, 5.5], 'wall': 'wall-plaster', 'floor': 'plank', 'trim': 'dark-wood', 'finish': 'wainscot', 'hearth': None, 'windows': 2},
    'attic':     {'size': [6.5, 5.5], 'wall': 'plank', 'floor': 'plank', 'trim': 'beam', 'finish': 'attic', 'hearth': None, 'windows': 1, 'low': True},
    'manor-up':  {'size': [7.0, 6.0], 'wall': 'wallpaper-rose', 'floor': 'floor-polish', 'trim': 'white', 'finish': 'panel', 'hearth': 'marble-small', 'windows': 3},
    # everything else
    'workshop': {'size': [5.0, 4.5], 'wall': 'wall-timber', 'floor': 'plank', 'trim': 'beam', 'finish': 'timber', 'hearth': None, 'windows': 1},
    'forge':    {'size': [5.0, 4.5], 'wall': 'wall-stone', 'floor': 'soil', 'trim': 'dark-wood', 'finish': 'stone', 'hearth': None, 'windows': 1},
    'tavern':   {'size': [7.0, 6.0], 'wall': 'wall-plaster', 'floor': 'plank', 'trim': 'beam', 'finish': 'timber', 'hearth': 'stone-big', 'windows': 2},
    'hall':     {'size': [8.0, 6.5], 'wall': 'wall-stone', 'floor': 'flagstone', 'trim': 'dark-wood', 'finish': 'stone', 'hearth': 'stone-big', 'windows': 3},
    'church':   {'size': [8.0, 6.5], 'wall': 'wall-stone', 'floor': 'flagstone', 'trim': 'white', 'finish': 'stone', 'hearth': None, 'windows': 3, 'tall': True},
    'school':   {'size': [6.0, 5.0], 'wall': 'wall-plaster', 'floor': 'plank', 'trim': 'beam', 'finish': 'wainscot', 'hearth': 'stone', 'windows': 2},
    'library':  {'size': [7.0, 6.0], 'wall': 'wall-plaster', 'floor': 'floor-polish', 'trim': 'dark-wood', 'finish': 'panel', 'hearth': 'stone', 'windows': 2},
    'theater':  {'size': [8.0, 6.5], 'wall': 'paint-red', 'floor': 'plank', 'trim': 'dark-wood', 'finish': 'panel', 'hearth': None, 'windows': 0},
    'store':    {'size': [6.0, 5.0], 'wall': 'plank', 'floor': 'plank', 'trim': 'beam', 'finish': 'timber', 'hearth': None, 'windows': 1},
    'shop':     {'size': [5.5, 4.5], 'wall': 'wall-plaster', 'floor': 'plank', 'trim': 'beam', 'finish': 'wainscot', 'hearth': None, 'windows': 2},
    'bath':     {'size': [6.0, 5.0], 'wall': 'tile', 'floor': 'flagstone', 'trim': 'paint-blue', 'finish': 'tiles', 'hearth': None, 'windows': 2},
    'stable':   {'size': [6.0, 5.0], 'wall': 'wall-timber', 'floor': 'straw', 'trim': 'beam', 'finish': 'timber', 'hearth': None, 'windows': 1},
    'glass':    {'size': [6.0, 5.0], 'wall': 'glass', 'floor': 'flagstone', 'trim': 'white', 'finish': 'glass', 'hearth': None, 'windows': 0},
    'observatory': {'size': [5.5, 5.5], 'wall': 'wall-stone', 'floor': 'floor-polish', 'trim': 'white', 'finish': 'stone', 'hearth': None, 'windows': 1, 'tall': True},
}


def windows_for(style):
    """Where the windows go: on the back wall (z = 0), spread along x. [(x centre, sill height, width, height)]."""
    r = ROOMS[style]; W = r['size'][0]; n = r['windows']
    if not n: return []
    if r.get('low'): return [(W * 0.55, 1.26, 0.6, 0.66)]
    tall = r.get('tall')
    xs = [W * (i + 1) / (n + 1) + (0.3 if r['hearth'] and n == 1 else 0) for i in range(n)]
    return [(x, 1.0 if tall else 0.95, 0.8 if not tall else 0.9, 1.0 if not tall else 1.5) for x in xs]


def hearth_spot(style):
    """The firebox: where the game draws the flames. Left wall (x = 0) at z = hz, or out on the floor for a pit."""
    r = ROOMS[style]; k = r['hearth']
    if not k: return None
    D = r['size'][1]
    if k == 'pit': return {'x': 1.0, 'y': 0.05, 'z': 1.4, 'w': 0.6, 'kind': 'pit'}
    hz = D * 0.4
    big = k in ('stone-big', 'marble') or (k == 'brick')
    return {'x': 0.12, 'y': 0.12, 'z': hz, 'w': 0.9 if big else 0.7, 'kind': k}


def room(style):
    r = ROOMS[style]; W, D = r['size']; M = Mesh()
    if r.get('low'): return attic(style)
    wall, floor, trim, fin = r['wall'], r['floor'], r['trim'], r['finish']
    # floor, then the two walls with their tops showing
    M.box(floor, 0, -0.08, 0, W, 0, D)
    M.box(wall, -T, -0.08, -T, 0, H, D)       # left wall
    M.box(wall, 0, -0.08, -T, W, H, 0)        # back wall
    M.box(trim, -T - 0.01, H, -T - 0.01, 0.01, H + 0.04, D)
    M.box(trim, -0.01, H, -T - 0.01, W, H + 0.04, 0.01)
    # floor finish
    if floor in ('plank', 'floor-polish'):
        for z in np.arange(0.3, D, 0.3): M.box('beam' if floor == 'plank' else 'dark-wood', 0, 0, z - 0.006, W, 0.004, z + 0.006)
    if floor == 'flagstone':
        for z in np.arange(0.6, D, 0.6):
            M.box('rock-dark', 0, 0, z - 0.01, W, 0.004, z + 0.01)
            for x in np.arange(0.5 + (z * 1.7) % 0.5, W, 0.8): M.box('rock-dark', x - 0.01, 0, z - 0.6, x + 0.01, 0.004, z)
    if floor == 'straw':
        rng = np.random.default_rng(3)
        for _ in range(40): x, z = rng.uniform(0.2, W - 0.2), rng.uniform(0.2, D - 0.2); M.box('hay', x, 0, z, x + 0.3, 0.02, z + 0.04)
    # wall finish
    if fin == 'logs':
        for y in np.arange(0.15, H, 0.3):
            M.rod('wall-log', (0.02, y, -0.02), (0.02, y, D), 0.12, n=6)
            M.rod('wall-log', (0, y, 0.02), (W, y, 0.02), 0.12, n=6)
    if fin in ('beams', 'timber'):
        step = 1.2 if fin == 'timber' else 1.6
        for z in np.arange(0, D + 0.01, step): M.box(trim, 0, 0, z - 0.06, 0.04, H, z + 0.06)
        for x in np.arange(0, W + 0.01, step): M.box(trim, x - 0.06, 0, 0, x + 0.06, H, 0.04)
        M.box(trim, 0, H - 0.18, 0, 0.05, H, D); M.box(trim, 0, H - 0.18, 0, W, H, 0.05)
        if fin == 'timber':
            M.box(trim, 0, 0.9, 0, 0.045, 1.0, D); M.box(trim, 0, 0.9, 0, W, 1.0, 0.045)
    if fin in ('wainscot', 'panel'):
        low = 'plank' if fin == 'wainscot' else 'dark-wood'
        M.box(low, 0, 0, 0, 0.03, 0.95, D); M.box(low, 0, 0, 0, W, 0.95, 0.03)
        M.box(trim, 0, 0.95, 0, 0.05, 1.0, D); M.box(trim, 0, 0.95, 0, W, 1.0, 0.05)
        if fin == 'panel':
            for z in np.arange(0.4, D, 0.8): M.box(trim, 0.03, 0.15, z - 0.3, 0.045, 0.8, z + 0.3, top=False)
            for x in np.arange(0.4, W, 0.8): M.box(trim, x - 0.3, 0.15, 0.03, x + 0.3, 0.8, 0.045, top=False)
            M.box(trim, 0, H - 0.12, 0, 0.08, H, D); M.box(trim, 0, H - 0.12, 0, W, H, 0.08)   # cornice
        M.box(trim, 0, 0, 0, 0.05, 0.12, D); M.box(trim, 0, 0, 0, W, 0.12, 0.05)   # skirting
    if fin == 'tiles':
        for y in np.arange(0.3, H, 0.3): M.box('paint-blue', 0, y - 0.01, 0, 0.02, y + 0.01, D); M.box('paint-blue', 0, y - 0.01, 0, W, y + 0.01, 0.02)
    if fin == 'glass':
        M.box('wall-brick', -T, 0, -T, 0.02, 0.6, D); M.box('wall-brick', 0, 0, -T, W, 0.6, 0.02)
        for z in np.arange(0, D + 0.01, 1.0): M.box('white', 0, 0.6, z - 0.03, 0.04, H, z + 0.03)
        for x in np.arange(0, W + 0.01, 1.0): M.box('white', x - 0.03, 0.6, 0, x + 0.03, H, 0.04)
    if fin == 'stone':
        rng = np.random.default_rng(7)
        for y in np.arange(0.35, H, 0.35):
            M.box('rock-dark', 0, y - 0.012, 0, 0.012, y + 0.012, D); M.box('rock-dark', 0, y - 0.012, 0, W, y + 0.012, 0.012)
            for x in np.arange(0.3 + rng.uniform(0, 0.4), W, 0.7): M.box('rock-dark', x - 0.012, y - 0.35, 0, x + 0.012, y, 0.012)
            for z in np.arange(0.3 + rng.uniform(0, 0.4), D, 0.7): M.box('rock-dark', 0, y - 0.35, z - 0.012, 0.012, y, z + 0.012)
    # windows in the back wall: frame, sill and panes
    for (x, sill, w, h) in windows_for(style):
        if r.get('tall'):   # tall arched church windows
            M.box(trim, x - w / 2 - 0.06, sill - 0.06, 0, x + w / 2 + 0.06, sill + h + 0.06, 0.05)
            M.box('glass', x - w / 2, sill, 0.0, x + w / 2, sill + h, 0.06)
            M.box(trim, x - 0.02, sill, 0.06, x + 0.02, sill + h, 0.07)
        else:
            M.box(trim, x - w / 2 - 0.07, sill - 0.07, 0, x + w / 2 + 0.07, sill + h + 0.07, 0.05)
            M.box('glass', x - w / 2, sill, 0.0, x + w / 2, sill + h, 0.06)
            M.box(trim, x - 0.02, sill, 0.06, x + 0.02, sill + h, 0.075); M.box(trim, x - w / 2, sill + h / 2 - 0.02, 0.06, x + w / 2, sill + h / 2 + 0.02, 0.075)
            M.box(trim, x - w / 2 - 0.1, sill - 0.1, 0, x + w / 2 + 0.1, sill - 0.05, 0.14)   # sill
    # the hearth on the left wall
    hs = hearth_spot(style)
    if hs:
        k, hz = hs['kind'], hs['z']
        if k == 'pit':
            for i in range(9): a = 2 * np.pi * i / 9; M.blob('rock', hs['x'] + 0.38 * np.cos(a), 0.06, hz + 0.38 * np.sin(a), 0.1, seed=i, squash=0.7)
            M.box('soot', hs['x'] - 0.3, 0, hz - 0.3, hs['x'] + 0.3, 0.01, hz + 0.3)
        else:
            mat = {'stone': 'hearthstone', 'stone-big': 'hearthstone', 'brick': 'wall-brick', 'marble': 'marble', 'marble-small': 'marble'}[k]
            hw = hs['w'] + 0.5; hh = 1.3 if k in ('stone-big', 'marble') else 1.1
            M.box(mat, 0, 0, hz - hw / 2, 0.45, hh, hz + hw / 2)                        # the surround
            M.box('soot', 0.3, 0.12, hz - hs['w'] / 2, 0.46, hh * 0.62, hz + hs['w'] / 2)  # the firebox
            M.box('hearthstone', 0, 0, hz - hw / 2 - 0.15, 0.85, 0.06, hz + hw / 2 + 0.15)  # hearthstone
            M.box(trim if k != 'marble' else 'marble', 0, hh, hz - hw / 2 - 0.1, 0.55, hh + 0.08, hz + hw / 2 + 0.1)   # mantel
            M.box(mat, 0, hh + 0.08, hz - hw / 2 + 0.15, 0.35, H, hz + hw / 2 - 0.15)   # chimney breast
            for dz in (-0.25, 0.25): M.box('iron', 0.38, 0.06, hz + dz - 0.03, 0.62, 0.1, hz + dz + 0.03)   # firedogs
    return M


def attic(style):
    """Up under the roof: low knee walls, the rafters sloping up overhead, a round window in the gable."""
    r = ROOMS[style]; W, D = r['size']; M = Mesh(); kh = 1.0
    M.box('plank', 0, -0.08, 0, W, 0, D)
    for z in np.arange(0.3, D, 0.3): M.box('beam', 0, 0, z - 0.006, W, 0.004, z + 0.006)
    M.box('plank', -T, -0.08, -T, 0, kh, D); M.box('plank', 0, -0.08, -T, W, H + 0.6, 0)   # knee wall, and the gable end
    for z in np.arange(0.2, D, 0.9): M.rod('beam', (0.05, kh, z), (1.9, H + 0.5, z), 0.07, n=4)          # rafters rising from the knee wall
    M.box('beam', 1.85, H + 0.4, 0, 1.95, H + 0.55, D)                                                    # the ridge purlin
    M.box('beam', 0, kh - 0.05, 0, 0.08, kh + 0.05, D)
    x = W * 0.55; M.cylinder('beam', x, 0.04, 0.42, 1.2, 1.24, n=16, top=False)
    for k in range(16):
        a0, a1 = 2 * np.pi * k / 16, 2 * np.pi * (k + 1) / 16
        M.quad('glass', (x + 0.36 * np.cos(a0), 1.6 + 0.36 * np.sin(a0), 0.03), (x + 0.36 * np.cos(a1), 1.6 + 0.36 * np.sin(a1), 0.03), (x, 1.6, 0.03), (x, 1.6, 0.03))
    M.box('beam', x - 0.02, 1.24, 0.03, x + 0.02, 1.96, 0.05); M.box('beam', x - 0.36, 1.58, 0.03, x + 0.36, 1.62, 0.05)
    return M


# ---------------------------------------------------------------- props (each on its own footprint, front +z)
def bed(quilt='linen', pallet=False):
    M = Mesh()
    if pallet:   # a straw pallet on the floor with a blanket
        M.box('straw', 0, 0, 0, 0.9, 0.14, 1.9); M.box('cloth-cream' if quilt == 'linen' else quilt, 0.05, 0.14, 0.6, 0.85, 0.18, 1.85); M.box('linen', 0.15, 0.14, 0.1, 0.75, 0.22, 0.45)
        return M
    for x in (0.03, 0.87):
        for z in (0.03, 1.87): M.box('dark-wood', x, 0, z, x + 0.1, 0.42, z + 0.1)
    M.box('dark-wood', 0.03, 0.42, 0.0, 0.97, 1.05, 0.08)            # headboard
    M.box('dark-wood', 0.03, 0.42, 1.92, 0.97, 0.62, 2.0)            # footboard
    M.box('wood', 0.05, 0.3, 0.05, 0.95, 0.38, 1.95)                 # frame
    M.box('linen', 0.07, 0.38, 0.08, 0.93, 0.52, 1.92)               # mattress
    M.box(quilt, 0.05, 0.52, 0.55, 0.95, 0.58, 1.94)                 # quilt
    M.box(quilt, 0.04, 0.3, 0.55, 0.06, 0.58, 1.94); M.box(quilt, 0.94, 0.3, 0.55, 0.96, 0.58, 1.94)
    M.box('linen', 0.15, 0.52, 0.1, 0.85, 0.66, 0.45)                # pillow
    return M


def bunk(quilts=('cloth-red', 'cloth-blue')):
    """Bunk beds: two beds, one above the other, and a ladder at the foot."""
    M = Mesh()
    for x in (0.03, 0.87):
        for z in (0.03, 1.87): M.box('wood', x, 0, z, x + 0.1, 1.75, z + 0.1)
    for y, q in ((0.3, quilts[0]), (1.15, quilts[1])):
        M.box('wood', 0.05, y, 0.05, 0.95, y + 0.08, 1.95); M.box('linen', 0.07, y + 0.08, 0.08, 0.93, y + 0.2, 1.92)
        M.box(q, 0.05, y + 0.2, 0.55, 0.95, y + 0.26, 1.94); M.box('linen', 0.15, y + 0.2, 0.1, 0.85, y + 0.32, 0.45)
    M.box('wood', 0.03, 1.3, 0.0, 0.97, 1.55, 0.08); M.box('wood', 0.03, 1.3, 1.92, 0.97, 1.5, 2.0)    # rails up top
    for y in (0.5, 0.8, 1.1, 1.4): M.box('wood', 0.9, y, 1.6, 1.0, y + 0.04, 1.85)                    # the ladder
    return M


def ladder():
    """A ladder up to the attic hatch."""
    M = Mesh()
    for z in (0.05, 0.5): M.rod('wood', (0.05, 0, z), (0.05, 2.6, z), 0.03, n=4)
    for y in np.arange(0.3, 2.6, 0.3): M.rod('wood', (0.05, y, 0.05), (0.05, y, 0.5), 0.018, n=4)
    return M


def hatch():
    """In the attic: the hatch where the ladder comes up."""
    M = Mesh(); M.box('soot', 0, -0.02, 0, 0.9, 0.0, 0.9); M.box('wood', -0.04, 0, -0.04, 0.94, 0.05, 0.0); M.box('wood', -0.04, 0, 0.9, 0.94, 0.05, 0.94)
    M.box('plank', 0.92, 0, 0, 0.98, 0.7, 0.9); return M


def table(fine=False, w=1.2, d=0.8):
    M = Mesh(); top = 'floor-polish' if fine else 'wood'
    M.box(top, 0, 0.72, 0, w, 0.77, d)
    for x in (0.06, w - 0.12):
        for z in (0.06, d - 0.12): M.box('dark-wood' if fine else 'wood', x, 0, z, x + 0.06, 0.72, z + 0.06)
    if fine: M.box('dark-wood', 0.06, 0.62, 0.06, w - 0.06, 0.72, 0.1); M.box('dark-wood', 0.06, 0.62, d - 0.1, w - 0.06, 0.72, d - 0.06)
    return M


def stool():
    M = Mesh(); M.cylinder('wood', 0.2, 0.2, 0.17, 0.42, 0.46, n=10)
    for a in (0.3, 2.4, 4.5): M.rod('wood', (0.2 + 0.1 * np.cos(a), 0.42, 0.2 + 0.1 * np.sin(a)), (0.2 + 0.15 * np.cos(a), 0, 0.2 + 0.15 * np.sin(a)), 0.018, n=4)
    return M


def windsor():
    """A Windsor chair: saddle seat, splayed legs, a hoop of spindles at the back (back at z = 0)."""
    M = Mesh(); M.box('wood', 0.04, 0.44, 0.06, 0.46, 0.48, 0.46)
    for x, z in ((0.08, 0.1), (0.42, 0.1), (0.08, 0.42), (0.42, 0.42)): M.rod('wood', (x, 0.44, z), (x + (x - 0.25) * 0.25, 0, z + (z - 0.26) * 0.25), 0.017, n=4)
    for k in range(7):
        x = 0.08 + k * 0.057; M.rod('wood', (x, 0.48, 0.08), (x - (x - 0.25) * 0.1, 0.98 - abs(x - 0.25) * 0.6, 0.02), 0.009, n=4)
    for k in range(8):
        a0, a1 = np.pi * k / 8, np.pi * (k + 1) / 8
        M.rod('wood', (0.25 - 0.2 * np.cos(a0), 0.8 + 0.18 * np.sin(a0), 0.02), (0.25 - 0.2 * np.cos(a1), 0.8 + 0.18 * np.sin(a1), 0.02), 0.014, n=4)
    return M


def chest():
    M = Mesh(); M.box('paint-blue', 0, 0, 0, 0.9, 0.5, 0.5); M.box('dark-wood', -0.01, 0.5, -0.01, 0.91, 0.56, 0.51)
    for x in (0.12, 0.78): M.box('iron', x - 0.02, 0.06, 0.5, x + 0.02, 0.56, 0.52)
    M.box('gold', 0.42, 0.36, 0.5, 0.48, 0.44, 0.52); return M


def dresser():
    """A Welsh dresser: cupboard below, open plate shelves above (the game puts the household's pottery on them)."""
    M = Mesh(); M.box('dark-wood', 0, 0, 0, 1.4, 0.85, 0.5); M.box('floor-polish', -0.02, 0.85, -0.02, 1.42, 0.9, 0.52)
    for x in (0.05, 0.72): M.box('wood', x, 0.1, 0.5, x + 0.63, 0.75, 0.52)
    M.box('dark-wood', 0, 0.9, 0, 1.4, 2.0, 0.08); M.box('dark-wood', 0, 0.9, 0, 0.05, 2.0, 0.3); M.box('dark-wood', 1.35, 0.9, 0, 1.4, 2.0, 0.3)
    for y in (1.25, 1.6, 1.98): M.box('dark-wood', 0, y, 0, 1.4, y + 0.04, 0.3)
    return M


def bookcase(tall=2.0, w=1.0):
    M = Mesh(); M.box('dark-wood', 0, 0, 0, w, tall, 0.06); M.box('dark-wood', 0, 0, 0, 0.05, tall, 0.35); M.box('dark-wood', w - 0.05, 0, 0, w, tall, 0.35)
    cols = ['cloth-red', 'cloth-blue', 'cloth-ochre', 'cloth-green', 'cloth-plum', 'dark-wood']
    rng = np.random.default_rng(int(tall * 10 + w * 7))
    for i, y in enumerate(np.arange(0.05, tall - 0.2, 0.42)):
        M.box('dark-wood', 0, y, 0, w, y + 0.04, 0.35)
        x = 0.07
        while x < w - 0.12:
            bw, bh = rng.uniform(0.04, 0.08), rng.uniform(0.24, 0.34)
            M.box(cols[rng.integers(len(cols))], x, y + 0.04, 0.08, x + bw, y + 0.04 + bh, 0.3); x += bw + 0.005
    M.box('dark-wood', 0, tall - 0.04, 0, w, tall, 0.36); return M


def cupboard():
    M = Mesh(); M.box('paint-green', 0, 0, 0, 1.0, 1.7, 0.45); M.box('dark-wood', -0.02, 1.7, -0.02, 1.02, 1.76, 0.47)
    M.box('dark-wood', 0.49, 0.1, 0.45, 0.51, 1.6, 0.47)
    for x in (0.44, 0.56): M.box('iron', x - 0.01, 0.85, 0.46, x + 0.01, 0.95, 0.48)
    return M


def wardrobe():
    M = Mesh(); M.box('dark-wood', 0, 0, 0, 1.1, 2.0, 0.55); M.box('floor-polish', -0.03, 2.0, -0.03, 1.13, 2.08, 0.58)
    for x in (0.08, 0.58): M.box('floor-polish', x, 0.12, 0.55, x + 0.44, 1.85, 0.57)
    for x in (0.5, 0.6): M.box('gold', x - 0.01, 1.0, 0.57, x + 0.01, 1.08, 0.59)
    return M


def spinning_wheel():
    M = Mesh(); M.box('wood', 0.1, 0.35, 0.15, 0.9, 0.42, 0.3)
    for x, z in ((0.15, 0.2), (0.85, 0.2), (0.5, 0.42)): M.rod('wood', (x, 0.36, z), (x, 0, z + 0.05), 0.02, n=4)
    for k in range(16):
        a0, a1 = 2 * np.pi * k / 16, 2 * np.pi * (k + 1) / 16
        M.rod('wood', (0.35 + 0.28 * np.cos(a0), 0.75 + 0.28 * np.sin(a0), 0.22), (0.35 + 0.28 * np.cos(a1), 0.75 + 0.28 * np.sin(a1), 0.22), 0.012, n=4)
    for k in range(6): a = np.pi * k / 6; M.rod('wood', (0.35 - 0.28 * np.cos(a), 0.75 - 0.28 * np.sin(a), 0.22), (0.35 + 0.28 * np.cos(a), 0.75 + 0.28 * np.sin(a), 0.22), 0.006, n=3)
    M.rod('wood', (0.35, 0.42, 0.22), (0.35, 0.75, 0.22), 0.02, n=4); M.box('wood', 0.78, 0.42, 0.18, 0.84, 0.62, 0.26); M.blob('cloth-cream', 0.82, 0.68, 0.22, 0.05, seed=2)
    return M


def churn():
    M = Mesh(); M.cylinder('barrel', 0.2, 0.2, 0.16, 0, 0.75, n=10)
    for y in (0.15, 0.6): M.cylinder('iron', 0.2, 0.2, 0.165, y, y + 0.02, n=10, top=False)
    M.rod('wood', (0.2, 0.75, 0.2), (0.2, 1.15, 0.2), 0.015, n=4); return M


def tallclock():
    M = Mesh(); M.box('floor-polish', 0, 0, 0, 0.5, 0.5, 0.35); M.box('floor-polish', 0.06, 0.5, 0.04, 0.44, 1.55, 0.31)
    M.box('floor-polish', 0, 1.55, 0, 0.5, 2.15, 0.36); M.cylinder('linen', 0.25, 0.37, 0.16, 1.7, 1.71, n=14)
    M.box('dark-wood', 0.22, 1.85, 0.37, 0.28, 1.86, 0.38); M.box('dark-wood', 0.245, 1.72, 0.37, 0.255, 1.86, 0.38)
    M.box('gold', 0.18, 0.75, 0.31, 0.32, 1.35, 0.32); M.box('dark-wood', -0.02, 2.15, -0.02, 0.52, 2.22, 0.38)
    return M


def settle():
    """A high-backed settle: the seat by the fire, its back keeping off the draughts."""
    M = Mesh(); M.box('dark-wood', 0, 0, 0, 1.5, 1.4, 0.08); M.box('dark-wood', 0, 0.42, 0.08, 1.5, 0.47, 0.5)
    for x in (0, 1.44): M.box('dark-wood', x, 0, 0, x + 0.06, 0.95, 0.5)
    M.box('cloth-red', 0.08, 0.47, 0.1, 1.42, 0.52, 0.48); return M


def rocker():
    M = Mesh(); M.box('wood', 0.05, 0.42, 0.08, 0.5, 0.46, 0.5)
    for x in (0.07, 0.48):
        for k in range(6):
            a0, a1 = -0.5 + k / 6, -0.5 + (k + 1) / 6
            M.rod('wood', (x, 0.05 + 0.2 * (1 - np.cos(a0)), 0.28 + 0.5 * np.sin(a0)), (x, 0.05 + 0.2 * (1 - np.cos(a1)), 0.28 + 0.5 * np.sin(a1)), 0.015, n=4)
        M.rod('wood', (x, 0.07, 0.15), (x, 0.44, 0.12), 0.015, n=4); M.rod('wood', (x, 0.07, 0.42), (x, 0.44, 0.45), 0.015, n=4)
        M.rod('wood', (x, 0.44, 0.08), (x, 1.05, 0.0), 0.02, n=4)
    for y in (0.65, 0.85, 1.0): M.box('wood', 0.07, y, 0.02 + (1.05 - y) * 0.1, 0.48, y + 0.06, 0.05 + (1.05 - y) * 0.1)
    M.box('cloth-ochre', 0.08, 0.46, 0.1, 0.47, 0.5, 0.48); return M


def washstand():
    M = Mesh(); M.box('wood', 0, 0.7, 0, 0.6, 0.75, 0.45)
    for x, z in ((0.03, 0.03), (0.53, 0.03), (0.03, 0.38), (0.53, 0.38)): M.box('wood', x, 0, z, x + 0.04, 0.7, z + 0.04)
    M.cylinder('linen', 0.3, 0.22, 0.17, 0.75, 0.82, n=12); M.cylinder('linen', 0.45, 0.12, 0.06, 0.75, 0.98, n=10)
    M.box('linen', 0.0, 0.58, 0.44, 0.6, 0.72, 0.46); return M


def desk():
    M = Mesh(); M.box('floor-polish', 0, 0, 0, 1.2, 0.76, 0.6)
    M.box('floor-polish', 0, 0.76, 0, 1.2, 1.1, 0.25); M.box('dark-wood', 0.1, 0.78, 0.25, 0.4, 0.8, 0.45)
    for x in (0.3, 0.9): M.box('gold', x - 0.02, 0.4, 0.6, x + 0.02, 0.44, 0.62)
    M.cylinder('soot', 0.95, 0.4, 0.04, 0.76, 0.84, n=8); M.rod('linen', (0.95, 0.84, 0.4), (1.05, 1.05, 0.36), 0.008, n=3)
    return M


def highboy():
    M = Mesh(); M.box('floor-polish', 0, 0.3, 0, 1.0, 2.0, 0.5)
    for x, z in ((0.05, 0.05), (0.88, 0.05), (0.05, 0.38), (0.88, 0.38)): M.box('floor-polish', x, 0, z, x + 0.07, 0.3, z + 0.07)
    for y in np.arange(0.4, 1.95, 0.3): M.box('dark-wood', 0.05, y, 0.5, 0.95, y + 0.22, 0.52); M.box('gold', 0.47, y + 0.09, 0.52, 0.53, y + 0.13, 0.54)
    M.box('dark-wood', -0.03, 2.0, -0.03, 1.03, 2.1, 0.53); return M


def armchair():
    M = Mesh(); M.box('cloth-green', 0.05, 0.25, 0.05, 0.75, 0.48, 0.7); M.box('cloth-green', 0.05, 0.48, 0.0, 0.75, 1.1, 0.16)
    for x in (0.0, 0.65): M.box('cloth-green', x, 0.25, 0.05, x + 0.12, 0.7, 0.7)
    for x, z in ((0.07, 0.08), (0.65, 0.08), (0.07, 0.62), (0.65, 0.62)): M.box('dark-wood', x, 0, z, x + 0.06, 0.25, z + 0.06)
    return M


def harpsichord():
    M = Mesh(); M.box('floor-polish', 0, 0.75, 0, 0.9, 0.98, 2.0)
    for x, z in ((0.05, 0.1), (0.8, 0.1), (0.05, 1.85), (0.8, 1.85)): M.box('floor-polish', x, 0, z, x + 0.06, 0.75, z + 0.06)
    M.box('linen', 0.1, 0.98, 1.75, 0.8, 1.0, 1.95)
    for k in range(10): M.box('soot', 0.12 + k * 0.07, 1.0, 1.8, 0.14 + k * 0.07, 1.01, 1.9)
    M.lean('floor-polish', 0.0, 0.9, 0.2, 1.6, 0.98, 1.6); return M


def barrel(r=0.3, h=0.8):
    """The household water barrel (open: the game draws the water at its level)."""
    M = Mesh()
    n = 14
    for i in range(n):
        a, b = 2 * np.pi * i / n, 2 * np.pi * (i + 1) / n
        p0, p1 = (r + r * np.cos(a), r + r * np.sin(a)), (r + r * np.cos(b), r + r * np.sin(b))
        M.quad('barrel', (p1[0], 0, p1[1]), (p0[0], 0, p0[1]), (p0[0], h, p0[1]), (p1[0], h, p1[1]))
    for y in (0.12, h - 0.15): M.cylinder('iron', r, r, r * 1.03, y, y + 0.03, n=n, top=False)
    M.cylinder('soot', r, r, r * 0.95, 0.1, 0.11, n=n)
    return M


def stairs(n=8, w=0.9):
    """Stairs up to the next floor, rising toward the back wall."""
    M = Mesh()
    for k in range(n): M.box('wood', 0, 0, (n - 1 - k) * 0.28, w, (k + 1) * 0.3, (n - k) * 0.28)
    M.box('dark-wood', w, 0, 0, w + 0.05, n * 0.3 + 0.9, 0.05)
    for k in range(n): M.box('dark-wood', w, k * 0.3 + 0.3, (n - 1 - k) * 0.28 + 0.12, w + 0.03, k * 0.3 + 1.2, (n - 1 - k) * 0.28 + 0.15)
    M.rod('dark-wood', (w + 0.02, 1.2, n * 0.28), (w + 0.02, n * 0.3 + 0.9, 0.05), 0.025, n=4)
    return M


def stairwell():
    """Upstairs: the opening where the stairs come up, with a rail round it."""
    M = Mesh(); M.box('soot', 0, -0.02, 0, 1.0, 0.0, 2.2)
    for (a, b) in (((0, 2.2), (1.0, 2.2)), ((1.0, 2.2), (1.0, 0))):
        M.rod('dark-wood', (a[0], 0.9, a[1]), (b[0], 0.9, b[1]), 0.03, n=4)
        for t in np.linspace(0, 1, 6): M.box('dark-wood', a[0] + (b[0] - a[0]) * t - 0.02, 0, a[1] + (b[1] - a[1]) * t - 0.02, a[0] + (b[0] - a[0]) * t + 0.02, 0.9, a[1] + (b[1] - a[1]) * t + 0.02)
    return M


def basket():
    M = Mesh(); M.cylinder('straw', 0.2, 0.2, 0.18, 0, 0.22, n=12); M.cylinder('hay', 0.2, 0.2, 0.15, 0.2, 0.22, n=12); return M


def broom():
    M = Mesh(); M.rod('wood', (0.1, 0.2, 0.1), (0.05, 1.4, 0.02), 0.015, n=4); M.cone('straw', 0.1, 0.1, 0.12, 0, 0.3, n=8); return M


def bench(w=1.4):
    M = Mesh(); M.box('wood', 0, 0.42, 0, w, 0.47, 0.35)
    for x in (0.1, w - 0.15): M.box('wood', x, 0, 0.05, x + 0.05, 0.42, 0.3)
    return M


# treasures from the night-critter collection
def lantern_post():
    M = Mesh(); M.rod('dark-wood', (0.2, 0, 0.2), (0.2, 1.2, 0.2), 0.02, n=4); M.box('dark-wood', 0.2, 1.18, 0.18, 0.4, 1.22, 0.22)
    M.box('glass', 0.33, 0.85, 0.12, 0.47, 1.1, 0.28); return M


def aquarium():
    M = Mesh(); M.box('dark-wood', 0, 0, 0, 0.7, 0.55, 0.45); M.box('glass', 0.05, 0.55, 0.05, 0.65, 0.95, 0.4)
    M.box('water', 0.07, 0.55, 0.07, 0.63, 0.85, 0.38); M.blob('leaves', 0.2, 0.65, 0.2, 0.06, seed=3); M.blob('paint-green', 0.45, 0.58, 0.25, 0.05, seed=4)
    return M


def owlcage():
    M = Mesh(); M.rod('dark-wood', (0.25, 0, 0.25), (0.25, 1.1, 0.25), 0.02, n=4); M.cylinder('wood', 0.25, 0.25, 0.2, 1.1, 1.12, n=10)
    for k in range(10): a = 2 * np.pi * k / 10; M.rod('gold', (0.25 + 0.2 * np.cos(a), 1.12, 0.25 + 0.2 * np.sin(a)), (0.25 + 0.06 * np.cos(a), 1.7, 0.25 + 0.06 * np.sin(a)), 0.006, n=3)
    M.blob('clay', 0.25, 1.3, 0.25, 0.1, seed=5, squash=1.4); return M


def critter(M, x, z, s, coat, belly, tail_tip, face=1, lying=True):
    """A fox or a wolf at scale s (1 = grown), lying curled or sitting, facing +x (face=1) or -x."""
    if lying:
        M.blob(coat, x, 0.12 * s, z, 0.24 * s, seed=int(x * 10 + z), squash=0.55)
        M.blob(belly, x + 0.1 * s * face, 0.1 * s, z + 0.08 * s, 0.12 * s, seed=3, squash=0.6)
        M.blob(coat, x + 0.24 * s * face, 0.16 * s, z + 0.05 * s, 0.11 * s, seed=4)                 # head
        for dz in (-0.04, 0.05): M.cone(coat, x + 0.24 * s * face, z + 0.05 * s + dz * s, 0.035 * s, 0.24 * s, 0.33 * s, n=4)   # ears
        M.rod(coat, (x - 0.2 * s * face, 0.08 * s, z), (x - 0.05 * s * face, 0.08 * s, z + 0.24 * s), 0.07 * s, n=6, taper=0.6)
        M.blob(tail_tip, x - 0.03 * s * face, 0.08 * s, z + 0.26 * s, 0.05 * s, seed=5)
    else:
        M.blob(coat, x, 0.22 * s, z, 0.17 * s, seed=6, squash=1.3)
        M.blob(belly, x + 0.08 * s * face, 0.24 * s, z, 0.09 * s, seed=7, squash=1.4)
        M.blob(coat, x + 0.06 * s * face, 0.48 * s, z, 0.11 * s, seed=8)
        M.rod(coat, (x + 0.1 * s * face, 0.46 * s, z), (x + 0.22 * s * face, 0.42 * s, z), 0.045 * s, n=5, taper=0.5)   # muzzle
        for dz in (-0.05, 0.05): M.cone(coat, x + 0.05 * s * face, z + dz * s, 0.035 * s, 0.56 * s, 0.68 * s, n=4)
        M.rod(coat, (x - 0.12 * s * face, 0.08 * s, z), (x - 0.32 * s * face, 0.05 * s, z + 0.1 * s), 0.07 * s, n=6, taper=0.6)
        M.blob(tail_tip, x - 0.34 * s * face, 0.05 * s, z + 0.11 * s, 0.05 * s, seed=9)


FOX = ('cloth-ochre', 'white', 'white')
WOLF = ('rock', 'cloth-cream', 'rock-dark')


def foxbasket(stage=0):
    """The fox family by the hearth: a mother with three cubs, the cubs growing up (stage 0, 1, 2)."""
    M = Mesh(); M.cylinder('cloth-red', 0.5, 0.4, 0.48, 0, 0.03, n=16)
    critter(M, 0.45, 0.35, 1.0, *FOX)
    cub = [0.42, 0.62, 0.85][stage]
    spots = [(0.78, 0.55, -1), (0.22, 0.65, 1), (0.6, 0.72, -1)] if stage < 2 else [(0.8, 0.6, -1)]
    for x, z, f in spots: critter(M, x, z, cub, *FOX, face=f, lying=stage == 0)
    return M


def wolfbasket(stage=0):
    """The wolf: a cub in its basket, a gangly young wolf, then a grown wolf lying by the hearth (stage 0, 1, 2)."""
    M = Mesh()
    if stage == 0:
        M.cylinder('straw', 0.4, 0.35, 0.35, 0, 0.2, n=14); M.cylinder('cloth-red', 0.4, 0.35, 0.3, 0.2, 0.22, n=14)
        critter(M, 0.4, 0.3, 0.55, *WOLF); M.box('plank', 0, 0, 0, 0.01, 0.01, 0.01)
    elif stage == 1:
        M.cylinder('cloth-red', 0.45, 0.4, 0.42, 0, 0.03, n=14); critter(M, 0.45, 0.4, 0.8, *WOLF, lying=False)
    else:
        M.box('cloth-red', 0.0, 0, 0.0, 1.2, 0.04, 0.8); critter(M, 0.6, 0.35, 1.25, *WOLF)
    return M


def curio():
    M = Mesh(); M.box('dark-wood', 0, 0, 0, 0.9, 1.6, 0.4); M.box('glass', 0.05, 0.3, 0.4, 0.85, 1.5, 0.42)
    for y in (0.65, 1.05): M.box('dark-wood', 0.05, y, 0.05, 0.85, y + 0.03, 0.38)
    M.blob('rock-dark', 0.7, 1.72, 0.2, 0.12, seed=4); return M


def bearnook():
    M = bookcase(tall=0.9, w=1.1); M.box('paint-green', 0.1, 0, 0.45, 1.0, 0.1, 0.95); M.blob('clay', 0.55, 0.3, 0.7, 0.2, seed=7); M.blob('clay', 0.55, 0.55, 0.7, 0.12, seed=8)
    return M


def plant():
    M = Mesh(); M.cylinder('clay', 0.2, 0.2, 0.14, 0, 0.3, n=10); M.blob('leaves', 0.2, 0.5, 0.2, 0.2, seed=2); return M


# ---------------------------------------------------------------- workplaces and halls
def workbench(w=1.6):
    M = Mesh(); M.box('wood', 0, 0.8, 0, w, 0.88, 0.7)
    for x in (0.05, w - 0.12):
        for z in (0.05, 0.58): M.box('wood', x, 0, z, x + 0.07, 0.8, z + 0.07)
    M.box('wood', 0.05, 0.2, 0.05, w - 0.05, 0.24, 0.65); return M


def potters_wheel():
    M = Mesh(); M.box('wood', 0, 0, 0, 0.9, 0.4, 0.9); M.cylinder('wood', 0.45, 0.45, 0.3, 0.4, 0.45, n=14); M.cylinder('clay', 0.45, 0.45, 0.12, 0.45, 0.62, n=10)
    return M


def kiln():
    M = Mesh(); M.cylinder('wall-brick', 0.5, 0.5, 0.48, 0, 1.0, n=12, top=False); M.cone('wall-brick', 0.5, 0.5, 0.48, 1.0, 1.5, n=12)
    M.box('soot', 0.35, 0.1, 0.92, 0.65, 0.45, 0.99); return M


def loom():
    M = Mesh()
    for x in (0, 1.3):
        for z in (0, 0.9): M.box('wood', x, 0, z, x + 0.08, 1.6, z + 0.08)
    for y in (0.75, 1.6): M.box('wood', 0, y, 0.0, 1.38, y + 0.06, 0.08); M.box('wood', 0, y - 0.1, 0.9, 1.38, y - 0.04, 0.98)
    for k in range(30): x = 0.12 + k * 0.038; M.rod('cloth-cream', (x, 0.8, 0.05), (x, 0.75, 0.95), 0.004, n=3, caps=False)
    M.box('cloth-ochre', 0.1, 0.72, 0.65, 1.28, 0.76, 0.95); M.box('wood', 0.1, 0.42, 1.0, 1.28, 0.48, 1.3)
    return M


def forge():
    M = Mesh(); M.box('wall-brick', 0, 0, 0, 1.2, 0.85, 1.0); M.box('soot', 0.2, 0.85, 0.2, 1.0, 0.88, 0.8)
    M.box('wall-brick', 0.3, 0.85, 0.0, 0.9, 2.4, 0.4); M.cone('wall-brick', 0.6, 0.45, 0.6, 1.6, 2.0, n=4)
    M.box('cloth-cream', 1.2, 0.5, 0.2, 1.6, 0.8, 0.7)   # bellows
    return M


def anvil():
    M = Mesh(); M.cylinder('wood', 0.3, 0.3, 0.22, 0, 0.5, n=10); M.box('iron', 0.1, 0.5, 0.2, 0.5, 0.62, 0.4); M.box('iron', 0.0, 0.62, 0.18, 0.62, 0.72, 0.42)
    return M


def millstones():
    M = Mesh(); M.box('wood', 0, 0, 0, 1.4, 0.6, 1.4); M.cylinder('rock', 0.7, 0.7, 0.6, 0.6, 0.78, n=16); M.cylinder('rock-dark', 0.7, 0.7, 0.58, 0.78, 0.95, n=16)
    M.box('wood', 0.65, 0.95, 0.65, 0.75, 2.4, 0.75); M.box('wood', 0.55, 1.8, 0.0, 0.85, 2.4, 0.15)   # the shaft and the hopper
    return M


def oven():
    M = Mesh(); M.box('wall-brick', 0, 0, 0, 1.4, 0.9, 1.2); M.blob('wall-brick', 0.7, 0.9, 0.6, 0.65, seed=3, squash=0.6)
    M.box('soot', 0.45, 0.35, 1.18, 0.95, 0.75, 1.21); M.box('wood', 1.45, 0, 0.2, 1.75, 0.5, 1.0); return M


def vat():
    M = Mesh(); M.cylinder('barrel', 0.6, 0.6, 0.58, 0, 1.0, n=16)
    for y in (0.2, 0.8): M.cylinder('iron', 0.6, 0.6, 0.6, y, y + 0.04, n=16, top=False)
    M.cylinder('clay', 0.6, 0.6, 0.53, 0.94, 0.96, n=16); return M


def shelves(w=2.0, rows=3):
    """Wall shelves (the game puts what's in store on them)."""
    M = Mesh()
    for x in (0, w - 0.05): M.box('wood', x, 0, 0, x + 0.05, 0.45 + rows * 0.5, 0.45)
    for k in range(rows + 1): M.box('wood', 0, 0.1 + k * 0.5, 0, w, 0.14 + k * 0.5, 0.45)
    M.box('wood', 0, 0, 0, w, 0.45 + rows * 0.5, 0.04); return M


def counter(w=2.4):
    M = Mesh(); M.box('dark-wood', 0, 0, 0, w, 1.0, 0.6); M.box('floor-polish', -0.03, 1.0, -0.03, w + 0.03, 1.06, 0.66); return M


def pew(w=2.2):
    M = Mesh(); M.box('dark-wood', 0, 0.42, 0.1, w, 0.47, 0.5); M.box('dark-wood', 0, 0.47, 0.0, w, 1.0, 0.08)
    for x in (0, w - 0.06): M.box('dark-wood', x, 0, 0, x + 0.06, 0.95, 0.5)
    return M


def altar():
    M = Mesh(); M.box('flagstone', 0, 0, 0, 2.4, 0.2, 1.4); M.box('linen', 0.6, 0.2, 0.3, 1.8, 1.0, 0.9); M.box('cloth-red', 0.58, 0.85, 0.28, 1.82, 1.02, 0.92)
    for x in (0.8, 1.6): M.cylinder('gold', x, 0.6, 0.03, 1.02, 1.25, n=6)
    M.box('gold', 1.17, 1.02, 0.55, 1.23, 1.5, 0.61); M.box('gold', 1.05, 1.32, 0.55, 1.35, 1.38, 0.61); return M


def pulpit():
    M = Mesh(); M.cylinder('dark-wood', 0.4, 0.4, 0.38, 0, 1.2, n=8); M.box('dark-wood', 0.1, 1.2, 0.1, 0.7, 1.3, 0.7); M.box('linen', 0.2, 1.3, 0.3, 0.6, 1.32, 0.6)
    return M


def school_desk():
    M = Mesh(); M.box('wood', 0, 0.7, 0, 1.1, 0.75, 0.5); M.box('wood', 0, 0, 0, 0.05, 0.7, 0.5); M.box('wood', 1.05, 0, 0, 1.1, 0.7, 0.5)
    M.box('wood', 0, 0.4, 0.7, 1.1, 0.45, 1.0); M.box('wood', 0, 0, 0.75, 0.05, 0.4, 0.95); M.box('wood', 1.05, 0, 0.75, 1.1, 0.4, 0.95)
    for x in (0.15, 0.6): M.box('soot', x, 0.75, 0.1, x + 0.3, 0.76, 0.35)   # slates
    return M


def blackboard():
    M = Mesh(); M.box('dark-wood', 0, 0.8, 0, 2.0, 2.0, 0.06); M.box('soot', 0.08, 0.88, 0.06, 1.92, 1.92, 0.07); M.box('dark-wood', 0, 0.8, 0.0, 2.0, 0.85, 0.15)
    return M


def bar(w=3.0):
    M = counter(w)
    for k in range(4): M.cylinder('pewter', 0.4 + k * 0.6, 0.3, 0.05, 1.06, 1.2, n=8)
    return M


def keg_rack():
    M = Mesh(); M.box('wood', 0, 0, 0, 1.8, 0.4, 0.7)
    for k in range(3): M.rod('barrel', (0.3 + k * 0.6, 0.65, 0.05), (0.3 + k * 0.6, 0.65, 0.65), 0.26, n=10); M.box('iron', 0.28 + k * 0.6, 0.55, 0.65, 0.32 + k * 0.6, 0.6, 0.72)
    return M


def stage():
    M = Mesh(); M.box('plank', 0, 0, 0, 8.0, 0.6, 2.2); M.box('dark-wood', 0, 0, 2.2, 8.0, 0.6, 2.26)
    M.box('cloth-red', 0, 0.6, 0.05, 1.2, 2.6, 0.25); M.box('cloth-red', 6.8, 0.6, 0.05, 8.0, 2.6, 0.25); M.box('cloth-red', 0, 2.3, 0.05, 8.0, 2.6, 0.3)
    return M


def tub():
    M = Mesh(); M.cylinder('barrel', 0.7, 0.55, 0.65, 0, 0.6, n=16); M.cylinder('water', 0.7, 0.55, 0.6, 0.5, 0.52, n=16)
    for y in (0.15, 0.45): M.cylinder('iron', 0.7, 0.55, 0.67, y, y + 0.03, n=16, top=False)
    return M


def telescope():
    M = Mesh()
    for a in (0.3, 2.4, 4.5): M.rod('dark-wood', (0.6, 0.9, 0.6), (0.6 + 0.45 * np.cos(a), 0, 0.6 + 0.45 * np.sin(a)), 0.03, n=4)
    M.rod('gold', (0.25, 0.75, 0.9), (1.0, 1.8, 0.2), 0.1, n=10); M.rod('dark-wood', (0.25, 0.75, 0.9), (0.18, 0.66, 0.96), 0.04, n=6)
    return M


def horse(M, x, z):
    """A cart horse standing in its stall, facing +x."""
    for dx in (-0.35, 0.3):
        for dz in (-0.12, 0.12): M.rod('horse', (x + dx, 0.75, z + dz), (x + dx, 0, z + dz), 0.045, n=5, taper=0.8); M.box('mane', x + dx - 0.05, 0, z + dz - 0.05, x + dx + 0.05, 0.08, z + dz + 0.05)
    M.rod('horse', (x - 0.45, 0.95, z), (x + 0.4, 0.95, z), 0.24, n=8)                  # body
    M.blob('horse', x - 0.42, 0.95, z, 0.24, seed=1, squash=1.0); M.blob('horse', x + 0.38, 0.97, z, 0.25, seed=2, squash=1.0)
    M.rod('horse', (x + 0.45, 1.0, z), (x + 0.68, 1.45, z), 0.11, n=6)                   # neck
    M.rod('horse', (x + 0.65, 1.48, z), (x + 0.92, 1.3, z), 0.09, n=6, taper=0.7)        # head
    M.rod('mane', (x + 0.44, 1.12, z), (x + 0.66, 1.56, z), 0.04, n=4)
    M.rod('mane', (x - 0.62, 1.0, z), (x - 0.72, 0.55, z), 0.05, n=4, taper=0.5)          # tail


def horse_stall():
    M = Mesh()
    for z in (0, 2.0): M.box('dark-wood', 0, 0, z, 2.2, 1.3, z + 0.08)
    M.box('dark-wood', 0, 0, 0, 0.08, 1.3, 2.08)
    M.box('wood', 1.9, 0.9, 0.2, 2.2, 1.15, 1.9)                                          # the manger
    M.box('hay', 1.92, 1.0, 0.25, 2.18, 1.12, 1.85); M.box('hay', 0.15, 0, 1.3, 0.7, 0.4, 1.9)
    horse(M, 1.0, 1.04)
    return M


def crate():
    M = Mesh(); M.box('plank', 0, 0, 0, 0.6, 0.5, 0.6)
    for y in (0.0, 0.46): M.box('wood', -0.01, y, -0.01, 0.61, y + 0.04, 0.61)
    return M


def sacks():
    M = Mesh()
    for i, (x, z) in enumerate(((0.3, 0.3), (0.75, 0.32), (0.52, 0.7))):
        M.cylinder('burlap', x, z, 0.2, 0, 0.42, n=10, top=False); M.blob('burlap', x, 0.42, z, 0.2, seed=i, squash=0.5)
        M.cylinder('burlap', x, z, 0.08, 0.5, 0.58, n=6); M.cylinder('cloth-cream', x, z, 0.085, 0.46, 0.49, n=6, top=False)   # tied at the neck
    return M


def long_table(w=4.0):
    """A long trestle table with a bench down each side (2 m deep in all)."""
    M = Mesh(); M.box('wood', 0, 0.72, 0.5, w, 0.77, 1.5)
    for x in (0.2, w - 0.3): M.box('wood', x, 0, 0.6, x + 0.1, 0.72, 1.4)
    for z in (0.0, 1.6):
        M.box('wood', 0.1, 0.42, z, w - 0.1, 0.47, z + 0.4)
        for x in (0.3, w - 0.4): M.box('wood', x, 0, z + 0.05, x + 0.06, 0.42, z + 0.35)
    return M


def reading_table():
    M = table(fine=True, w=1.8, d=1.0); M.box('linen', 0.3, 0.77, 0.3, 0.7, 0.79, 0.6); M.box('cloth-red', 1.0, 0.77, 0.2, 1.4, 0.85, 0.5); return M


def potting_bench():
    M = workbench(2.0)
    for k in range(5): M.cylinder('clay', 0.2 + k * 0.38, 0.35, 0.08, 0.88, 1.0, n=8); M.blob('leaves', 0.2 + k * 0.38, 1.08, 0.35, 0.09, seed=k)
    return M


PROPS = {
    'bed': lambda: bed('linen'), 'bed-red': lambda: bed('cloth-red'), 'bed-blue': lambda: bed('cloth-blue'), 'bed-ochre': lambda: bed('cloth-ochre'),
    'bed-plum': lambda: bed('cloth-plum'), 'bed-green': lambda: bed('cloth-green'), 'pallet': lambda: bed('linen', pallet=True),
    'bunk': bunk, 'bunk-2': lambda: bunk(('cloth-ochre', 'cloth-green')), 'bunk-3': lambda: bunk(('cloth-plum', 'cloth-red')), 'bunk-plain': lambda: bunk(('linen', 'cloth-cream')),
    'ladder': ladder, 'hatch': hatch,
    'table': table, 'table-fine': lambda: table(True, 1.6, 0.9), 'stool': stool, 'windsor': windsor, 'chest': chest, 'dresser': dresser,
    'bookcase': bookcase, 'cupboard': cupboard, 'wardrobe': wardrobe, 'spinning-wheel': spinning_wheel, 'churn': churn, 'tallclock': tallclock,
    'settle': settle, 'rocker': rocker, 'washstand': washstand, 'desk': desk, 'highboy': highboy, 'armchair': armchair, 'harpsichord': harpsichord,
    'barrel': barrel, 'stairs': stairs, 'stairwell': stairwell, 'basket': basket, 'broom': broom, 'bench': bench, 'plant': plant,
    'lantern': lantern_post, 'aquarium': aquarium, 'owlcage': owlcage, 'curio': curio, 'bearnook': bearnook,
    'foxhearth': foxbasket, 'foxhearth-1': lambda: foxbasket(1), 'foxhearth-2': lambda: foxbasket(2),
    'wolfbasket': wolfbasket, 'wolfbasket-1': lambda: wolfbasket(1), 'wolfbasket-2': lambda: wolfbasket(2),
    'workbench': workbench, 'potters-wheel': potters_wheel, 'kiln': kiln, 'loom': loom, 'forge': forge, 'anvil': anvil, 'millstones': millstones,
    'oven': oven, 'vat': vat, 'shelves': shelves, 'counter': counter, 'pew': pew, 'altar': altar, 'pulpit': pulpit, 'school-desk': school_desk,
    'blackboard': blackboard, 'bar': bar, 'keg-rack': keg_rack, 'stage': stage, 'tub': tub, 'telescope': telescope, 'horse-stall': horse_stall,
    'crate': crate, 'sacks': sacks, 'long-table': long_table, 'reading-table': reading_table, 'potting-bench': potting_bench,
    'bookcase-tall': lambda: bookcase(2.4, 1.6),
}


def footprint(M):
    """The prop's footprint in whole tenths of a metre (what the renderer calls tiles), from its own extent."""
    pts = np.concatenate([np.concatenate(t) for t in M.parts.values()])
    w, d = max(0.1, float(pts[:, 0].max())), max(0.1, float(pts[:, 2].max()))
    return [round(w, 2), round(d, 2)]


def spec():
    """What the game needs to know about each room and prop (written to art/interior/rooms.json)."""
    rooms = {k: {'size': r['size'], 'wallH': H, 'hearth': hearth_spot(k), 'windows': [{'x': x, 'y': y, 'w': w, 'h': h} for x, y, w, h in windows_for(k)]} for k, r in ROOMS.items()}
    props = {k: {'size': footprint(f())} for k, f in PROPS.items()}
    return {'rooms': rooms, 'props': props}


def write_spec(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(spec(), open(path, 'w'), indent=1)


MODELS = [(f'room/{k}', (lambda k=k: room(k)), {'tiles': ROOMS[k]['size'], 'indoor': True}) for k in ROOMS] + \
         [(f'prop/{k}', f, {'tiles': footprint(f()), 'indoor': True, 'turn': True}) for k, f in PROPS.items()]
