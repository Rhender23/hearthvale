"""Workshops, stores and trade: storehouse, lumber mill, granary, grange, mill, bakery, brewery, potter, carpenter,
weaver, jeweler, chandler, dairy, quarry, clay quarry, gold mine, market and stall.
Fronts face +z; one tile is 1 unit; y is up."""
import numpy as np
from kit import Mesh, window, door
from homes import chimney, frame, windows_z, windows_x


def body(M, x0, x1, z0, z1, h, wall, roof, gable=None, rise=0.4, timber=False):
    """A plain building: walls and a pitched roof, the ridge along x."""
    M.box(wall, x0, 0, z0, x1, h, z1)
    if timber: frame(M, x0, x1, z0, z1, 0, h, n=3)
    M.gable(roof, gable or wall, x0, x1, z0, z1, h, h + rise)


def crate(M, x, z, s=0.12, y=0.0):
    M.box('plank', x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2)


def barrel(M, x, z, r=0.06, h=0.14, y=0.0):
    M.cylinder('barrel', x, z, r, y, y + h, n=8)
    for t in (0.25, 0.75): M.cylinder('iron', x, z, r * 1.04, y + h * t - 0.008, y + h * t + 0.008, n=8, top=False)


def logs(M, x0, x1, z, rows=3, r=0.05):
    for k in range(rows):
        for i in range(rows - k):
            M.rod('wall-log', (x0, r + k * r * 1.7, z + (i - (rows - k - 1) / 2) * r * 2.05), (x1, r + k * r * 1.7, z + (i - (rows - k - 1) / 2) * r * 2.05), r, n=7)


def sign(M, x, y, z, mat='cloth-red'):
    M.rod('dark-wood', (x, y, z), (x, y, z + 0.1), 0.008, n=4)
    M.box(mat, x - 0.005, y - 0.1, z + 0.04, x + 0.005, y - 0.02, z + 0.12)


# ---------------------------------------------------------------- stores
def store(level):
    """2 x 1 (it turns: the turned picture is drawn by the renderer)."""
    M = Mesh()
    roof = ['roof-thatch', 'roof-shingle', 'roof-tile'][level]
    h = 0.42 + 0.1 * level
    M.box('plank', 0.15, 0, 0.18, 1.85, h, 0.82)
    for x in np.linspace(0.15, 1.85, 6): M.box('beam', x - 0.02, 0, 0.8, x + 0.02, h, 0.84)
    M.gable(roof, 'plank', 0.15, 1.85, 0.18, 0.82, h, h + 0.36 + 0.04 * level)
    M.box('dark-wood', 0.8, 0, 0.82, 1.2, 0.3, 0.84)   # big doors
    M.box('dark-wood', 0.99, 0, 0.84, 1.01, 0.3, 0.845)
    crate(M, 0.3, 0.92); crate(M, 0.45, 0.93, 0.1); barrel(M, 1.6, 0.92); barrel(M, 1.75, 0.9)
    if level >= 1: M.box('wood', 1.86, 0, 0.3, 1.98, 0.18, 0.7)   # firewood by the end wall
    if level == 2: M.box(roof, 0.9, h + 0.3, 0.45, 1.1, h + 0.45, 0.55); window(M, 0.4, 0.22, 0.82); window(M, 1.6, 0.22, 0.82)
    return M


def granary():
    M = Mesh()
    M.cylinder('wall-stone', 1.0, 1.0, 0.62, 0, 0.9, n=16)
    M.cylinder('white', 1.0, 1.0, 0.64, 0.86, 0.92, n=16, top=False)
    M.cone('roof-tile', 1.0, 1.0, 0.72, 0.9, 1.5, n=16)
    M.box('dark-wood', 0.92, 0, 1.58, 1.08, 0.32, 1.63); M.box('step', 0.86, 0, 1.6, 1.14, 0.04, 1.72)
    for x, z in ((0.25, 1.75), (1.75, 1.75)): M.rod('hay', (x - 0.1, 0.08, z), (x + 0.1, 0.08, z), 0.08, n=8)
    barrel(M, 1.55, 1.7)
    return M


def grange(level):
    M = Mesh()
    roof = ['roof-thatch', 'roof-shingle', 'roof-slate'][level]
    h = 0.5 + 0.1 * level
    M.box('cloth-red' if level else 'plank', 0.25, 0, 0.3, 1.75, h, 1.6)
    for x in np.linspace(0.25, 1.75, 7): M.box('white' if level else 'beam', x - 0.015, 0, 1.59, x + 0.015, h, 1.62)
    M.gable(roof, 'cloth-red' if level else 'plank', 0.25, 1.75, 0.3, 1.6, h, h + 0.55)
    M.box('dark-wood', 0.8, 0, 1.6, 1.2, 0.42, 1.63)
    for d in (-1, 1): M.rod('white', (1.0 + d * 0.2, 0, 1.635), (1.0 - d * 0.2, 0.42, 1.635), 0.012, n=4)   # the X on the doors
    M.box('white', 0.93, h + 0.18, 1.6, 1.07, h + 0.32, 1.62)   # hay loft door
    if level >= 1: M.box('wood', 1.75, 0, 0.5, 1.95, 0.38, 1.2); M.box(roof, 1.74, 0.38, 0.48, 1.98, 0.42, 1.22)   # a lean-to shed
    if level == 2: M.box('white', 0.94, h + 0.55, 0.9, 1.06, h + 0.72, 1.02); M.hip(roof, 0.92, 1.08, 0.88, 1.04, h + 0.72, h + 0.84, ridge=0, over=0.02)
    for x in (0.2, 0.42): M.rod('hay', (x, 0.08, 1.72), (x, 0.08, 1.9), 0.08, n=8)
    return M


def lumbermill():
    M = Mesh()
    M.box('wood', 0.2, 0, 0.3, 1.2, 0.5, 1.1)
    M.lean('roof-shingle', 0.15, 1.25, 0.25, 1.15, 0.5, 0.75)
    M.box('plank', 0.2, 0, 0.3, 0.24, 0.62, 1.1)
    for x in (0.25, 1.15): M.rod('wood', (x, 0, 1.12), (x, 0.52, 1.12), 0.025)
    logs(M, 1.35, 1.9, 0.6, rows=3, r=0.06)
    logs(M, 1.35, 1.9, 1.3, rows=2, r=0.06)
    for k in range(4): M.box('plank', 0.3, k * 0.03, 1.3, 1.1, k * 0.03 + 0.028, 1.6)   # a plank stack
    M.box('wood', 0.5, 0, 0.55, 0.9, 0.22, 0.75)   # sawhorse bench
    M.cylinder('iron', 0.7, 0.65, 0.09, 0.22, 0.24, n=10)
    return M


def mill(angle=0.0):
    M = Mesh()
    M.cylinder('wall-stone', 0.5, 0.5, 0.3, 0, 0.9, n=10)
    M.cone('roof-shingle', 0.5, 0.5, 0.36, 0.9, 1.25, n=10)
    M.box('dark-wood', 0.42, 0, 0.78, 0.58, 0.28, 0.82); window(M, 0.5, 0.55, 0.8, w=0.08, h=0.1)
    hub = np.array([0.5, 0.95, 0.86])
    M.rod('dark-wood', hub - [0, 0, 0.08], hub + [0, 0, 0.04], 0.03)
    for k in range(4):
        a = angle + k * np.pi / 2; d = np.array([np.cos(a), np.sin(a), 0])
        tip = hub + d * 0.55
        M.rod('wood', hub, tip, 0.012, n=4)
        p = np.array([-np.sin(a), np.cos(a), 0]) * 0.09
        M.quad('cloth-cream', hub + d * 0.15 + [0, 0, 0.02], tip + [0, 0, 0.02], tip + p + [0, 0, 0.02], hub + d * 0.15 + p + [0, 0, 0.02])
        M.quad('cloth-cream', hub + d * 0.15 + p + [0, 0, 0.02], tip + p + [0, 0, 0.02], tip + [0, 0, 0.02], hub + d * 0.15 + [0, 0, 0.02])
    M.box('cloth-cream', 0.75, 0, 0.7, 0.9, 0.14, 0.85)   # a flour sack
    return M


def bakery():
    M = Mesh()
    body(M, 0.14, 0.86, 0.22, 0.8, 0.5, 'wall-plaster', 'roof-tile', 'gable', rise=0.38, timber=True)
    M.box('wall-brick', 0.6, 0, 0.8, 0.86, 0.3, 0.98); M.hip('wall-brick', 0.6, 0.86, 0.8, 0.98, 0.3, 0.4, ridge=0.2, over=0.0)   # the bread oven
    M.box('ember', 0.68, 0.06, 0.98, 0.78, 0.16, 0.985)
    chimney(M, 0.73, 0.36, 0.6, 1.1, w=0.12, mat='wall-brick')
    door(M, 0.36, 0.8); window(M, 0.86, 0.22, 0.5, face='+x')
    M.lean('cloth-red', 0.18, 0.54, 0.8, 0.94, 0.38, 0.46)
    crate(M, 0.2, 0.9, 0.1)
    return M


def brewery():
    M = Mesh()
    body(M, 0.12, 0.88, 0.2, 0.78, 0.55, 'wall-stone', 'roof-shingle', rise=0.4)
    M.box('wall-stone', 0.62, 0.95, 0.4, 0.78, 1.15, 0.56); M.hip('roof-shingle', 0.62, 0.78, 0.4, 0.56, 1.15, 1.25, ridge=0, over=0.03)   # kiln vent
    door(M, 0.4, 0.78, h=0.32); window(M, 0.88, 0.24, 0.5, face='+x')
    for x, z in ((0.7, 0.86), (0.84, 0.88), (0.77, 0.95)): barrel(M, x, z)
    sign(M, 0.88, 0.48, 0.66, 'yellow-flowers')
    return M


def small_shop(wall, roof, awning, timber=True):
    M = Mesh()
    body(M, 0.16, 0.84, 0.22, 0.78, 0.5, wall, roof, 'gable', rise=0.36, timber=timber)
    door(M, 0.34, 0.78); window(M, 0.64, 0.2, 0.78, w=0.18)
    M.lean(awning, 0.5, 0.8, 0.78, 0.92, 0.36, 0.44)
    window(M, 0.84, 0.24, 0.5, face='+x')
    return M


def potter():
    M = small_shop('wall-plaster', 'roof-tile', 'cloth-green')
    chimney(M, 0.3, 0.4, 0.6, 1.02, w=0.1, mat='wall-brick')
    for x, z, s in ((0.9, 0.86, 0.05), (0.93, 0.96, 0.04), (0.82, 0.96, 0.035)): M.cylinder('pottery', x, z, s, 0, s * 2.2, n=8)
    M.cylinder('wood', 0.12, 0.9, 0.06, 0, 0.12, n=8)   # the wheel
    return M


def carpenter(level):
    M = small_shop(['plank', 'wall-plaster', 'wall-stone'][level], ['roof-thatch', 'roof-shingle', 'roof-tile'][level], 'cloth-blue', timber=level < 2)
    M.box('wood', 0.86, 0, 0.3, 0.98, 0.16, 0.7)   # planks leaning
    M.box('dark-wood', 0.06, 0.12, 0.84, 0.28, 0.16, 0.96); [M.box('dark-wood', x, 0, z, x + 0.02, 0.12, z + 0.02) for x in (0.07, 0.25) for z in (0.85, 0.93)]   # a workbench
    if level >= 1: M.box('dark-wood', 0.88, 0, 0.82, 0.96, 0.2, 0.9); M.box('dark-wood', 0.88, 0.1, 0.82, 0.9, 0.3, 0.9)   # a chair
    if level == 2: chimney(M, 0.72, 0.36, 0.6, 1.0, w=0.1, mat='wall-stone')
    return M


def weaver():
    M = small_shop('wall-plaster', 'roof-thatch', 'cloth-blue')
    for k, c in enumerate(('cloth-red', 'cloth-cream', 'cloth-blue')):   # cloth drying on a line
        M.box(c, 0.88 + 0.0, 0.14, 0.35 + k * 0.17, 0.9, 0.3, 0.47 + k * 0.17)
    M.rod('dark-wood', (0.9, 0.3, 0.3), (0.9, 0.3, 0.88), 0.006, n=4); [M.rod('dark-wood', (0.9, 0, z), (0.9, 0.32, z), 0.01, n=4) for z in (0.3, 0.88)]
    return M


def jeweler():
    M = small_shop('wall-stone', 'roof-slate', 'cloth-red', timber=False)
    sign(M, 0.84, 0.46, 0.66, 'gold')
    M.box('dark-wood', 0.62, 0, 0.82, 0.8, 0.14, 0.9); M.box('gold', 0.66, 0.14, 0.84, 0.7, 0.16, 0.88)
    return M


def chandler():
    M = small_shop('wall-plaster', 'roof-shingle', 'cloth-cream')
    for k in range(5): M.rod('wax', (0.88, 0.2, 0.32 + k * 0.08), (0.88, 0.34, 0.32 + k * 0.08), 0.012, n=5)
    M.rod('dark-wood', (0.88, 0.34, 0.28), (0.88, 0.34, 0.72), 0.008, n=4)
    return M


def dairy():
    M = small_shop('white', 'roof-shingle', 'cloth-blue', timber=False)
    for x in (0.86, 0.94): M.cylinder('iron', x, 0.88, 0.035, 0, 0.12, n=8)   # milk churns
    M.cylinder('yellow-flowers', 0.2, 0.9, 0.05, 0, 0.05, n=10)   # a round of cheese
    return M


# ---------------------------------------------------------------- quarries and the mine
def quarry():
    M = Mesh()
    for (x, z, s, h) in ((0.5, 0.5, 0.45, 0.55), (1.1, 0.45, 0.4, 0.75), (1.6, 0.7, 0.32, 0.45), (0.45, 1.05, 0.3, 0.35)):
        M.blob('rock', x, h / 2, z, s, seed=int(x * 10 + z * 7), squash=h / s / 2 * 1.2)
    M.box('rock-dark', 0.9, 0, 1.0, 1.7, 0.05, 1.7)   # the cut floor
    for k in range(3):
        for i in range(3 - k): M.box('rock', 1.0 + i * 0.16 + k * 0.08, k * 0.1, 1.2, 1.14 + i * 0.16 + k * 0.08, k * 0.1 + 0.1, 1.36)   # cut blocks
    M.box('wood', 0.25, 0, 1.5, 0.75, 0.06, 1.8); M.rod('wood', (0.3, 0.06, 1.65), (0.7, 0.06, 1.65), 0.04)   # a sledge
    M.rod('wood', (1.75, 0, 1.6), (1.75, 0.6, 1.6), 0.02); M.rod('wood', (1.75, 0.6, 1.6), (1.45, 0.62, 1.6), 0.015)   # a little crane
    return M


def claypit():
    M = Mesh()
    M.cylinder('mud', 1.0, 1.0, 0.75, 0, 0.04, n=14)
    M.cylinder('clay', 1.0, 1.0, 0.55, 0.0, 0.05, n=14)
    M.blob('clay', 0.5, 0.08, 0.5, 0.22, seed=3, squash=0.5); M.blob('clay', 1.55, 0.06, 0.6, 0.18, seed=5, squash=0.5)
    for k in range(3): M.box('clay', 1.3 + k * 0.13, 0, 1.55, 1.42 + k * 0.13, 0.08, 1.75)   # clay blocks drying
    M.box('wood', 0.3, 0, 1.5, 0.7, 0.04, 1.62); M.rod('wood', (0.35, 0.04, 1.56), (0.62, 0.3, 1.56), 0.012, n=4)   # a board and a spade
    return M


def goldmine():
    M = Mesh()
    M.blob('rock-dark', 0.8, 0.4, 0.7, 0.75, seed=11, squash=0.75)
    M.blob('rock', 1.45, 0.25, 0.55, 0.45, seed=12, squash=0.7)
    M.box('dark-wood', 0.62, 0, 1.2, 1.02, 0.42, 1.28)   # timber frame of the entrance
    M.box('iron', 0.68, 0, 1.24, 0.96, 0.36, 1.27)
    M.box('dark-wood', 0.58, 0.38, 1.18, 1.06, 0.46, 1.32)
    M.box('lamp', 0.98, 0.3, 1.3, 1.02, 0.36, 1.34)
    for k in range(4): M.box('iron', 0.75 + 0.0, 0, 1.3 + k * 0.12, 0.89, 0.015, 1.34 + k * 0.12)   # rails
    M.box('dark-wood', 0.72, 0.03, 1.55, 0.92, 0.15, 1.72); M.blob('gold', 0.82, 0.16, 1.63, 0.07, seed=13, squash=0.6)   # cart of ore
    return M


# ---------------------------------------------------------------- trade
def market(level):
    M = Mesh()
    if level == 0:   # a trading post: a log cabin with a porch and skins
        M.box('wall-log', 0.3, 0, 0.35, 1.5, 0.48, 1.25); M.gable('roof-shingle', 'wall-log', 0.3, 1.5, 0.35, 1.25, 0.48, 0.9)
        M.lean('roof-shingle', 0.3, 1.5, 1.25, 1.55, 0.38, 0.46); [M.rod('wood', (x, 0, 1.53), (x, 0.4, 1.53), 0.02) for x in (0.35, 0.9, 1.45)]
        door(M, 0.9, 1.25, h=0.3); crate(M, 1.65, 1.5); barrel(M, 1.75, 1.3); M.box('mud', 1.55, 0.1, 0.5, 1.56, 0.4, 0.8)
        return M
    # market stalls with striped awnings around a square, and (level 2) a general store behind
    cols = [('cloth-red', 'cloth-cream'), ('cloth-blue', 'cloth-cream'), ('cloth-green', 'cloth-cream')]
    spots = [(0.25, 1.35), (0.95, 1.5), (1.55, 1.05)] if level == 1 else [(0.25, 1.45), (0.95, 1.6), (1.6, 1.25)]
    for k, (x, z) in enumerate(spots):
        M.box('wood', x, 0, z, x + 0.35, 0.16, z + 0.22)
        for px in (x + 0.02, x + 0.33): M.rod('wood', (px, 0, z + 0.02), (px, 0.4, z + 0.02), 0.012, n=4)
        a, b = cols[k % 3]
        for i in range(4): M.lean(a if i % 2 == 0 else b, x - 0.03 + i * 0.1025, x - 0.03 + (i + 1) * 0.1025, z - 0.02, z + 0.3, 0.33, 0.42)
        for i in range(3): M.blob(['yellow-flowers', 'berries', 'leaves-dark'][(i + k) % 3], x + 0.08 + i * 0.1, 0.19, z + 0.12, 0.04, seed=i + k)
    if level == 2:
        body(M, 0.35, 1.65, 0.2, 0.85, 0.6, 'wall-brick', 'roof-slate', rise=0.38)
        door(M, 1.0, 0.85, h=0.34); window(M, 0.6, 0.22, 0.85, w=0.22); window(M, 1.4, 0.22, 0.85, w=0.22)
        M.lean('cloth-red', 0.4, 1.6, 0.85, 1.02, 0.4, 0.5)
    else:
        M.cylinder('wall-stone', 1.0, 0.7, 0.2, 0, 0.12, n=10); M.cylinder('water', 1.0, 0.7, 0.16, 0.06, 0.125, n=10)   # a little well
    crate(M, 1.75, 1.75); barrel(M, 0.15, 0.4)
    return M


def shop(level):
    if level == 0:   # a stall
        M = Mesh()
        M.box('wood', 0.2, 0, 0.4, 0.8, 0.22, 0.7)
        for x in (0.22, 0.78): M.rod('wood', (x, 0, 0.42), (x, 0.55, 0.42), 0.015, n=4)
        for i in range(6): M.lean('cloth-red' if i % 2 == 0 else 'cloth-cream', 0.17 + i * 0.11, 0.28 + i * 0.11, 0.38, 0.82, 0.44, 0.56)
        for i in range(4): M.cylinder('pottery', 0.3 + i * 0.13, 0.55, 0.035, 0.22, 0.29, n=7)
        crate(M, 0.85, 0.85, 0.1)
        return M
    M = small_shop('wall-plaster' if level == 1 else 'wall-brick', 'roof-tile' if level == 1 else 'roof-slate', 'cloth-red', timber=level == 1)
    sign(M, 0.84, 0.46, 0.66, 'cloth-blue')
    crate(M, 0.12, 0.88, 0.1); barrel(M, 0.88, 0.9)
    return M


MODELS = [
    *[(f'building/store/{i}', (lambda i=i: store(i)), {'tiles': [2, 1], 'turn': True}) for i in range(3)],
    ('building/granary', granary, {'tiles': [2, 2]}),
    *[(f'building/grange/{i}', (lambda i=i: grange(i)), {'tiles': [2, 2]}) for i in range(3)],
    ('building/lumbermill', lumbermill, {'tiles': [2, 2]}),
    ('building/mill', mill, {'tiles': [1, 1], 'frames': [lambda k=k: mill(k * np.pi / 8) for k in range(4)], 'fps': 4}),
    ('building/bakery', bakery, {'tiles': [1, 1]}),
    ('building/brewery', brewery, {'tiles': [1, 1]}),
    ('building/potter', potter, {'tiles': [1, 1]}),
    *[(f'building/carpenter/{i}', (lambda i=i: carpenter(i)), {'tiles': [1, 1]}) for i in range(3)],
    ('building/weaver', weaver, {'tiles': [1, 1]}),
    ('building/jeweler', jeweler, {'tiles': [1, 1]}),
    ('building/chandler', chandler, {'tiles': [1, 1]}),
    ('building/dairy', dairy, {'tiles': [1, 1]}),
    ('building/quarry', quarry, {'tiles': [2, 2]}),
    ('building/claypit', claypit, {'tiles': [2, 2]}),
    ('building/goldmine', goldmine, {'tiles': [2, 2]}),
    *[(f'building/market/{i}', (lambda i=i: market(i)), {'tiles': [2, 2]}) for i in range(3)],
    *[(f'building/shop/{i}', (lambda i=i: shop(i)), {'tiles': [1, 1]}) for i in range(3)],
]
