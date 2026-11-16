"""Small pleasures: flower bed, bench, statue, garden, rose arbor, firefly lantern, the well (three levels) and the
campfire (three levels; its flames and glow stay drawn by the game, so they flicker)."""
import numpy as np
from kit import Mesh


def flowerbed():
    M = Mesh()
    M.box('wood', 0.22, 0, 0.22, 0.78, 0.07, 0.78)
    M.box('soil', 0.25, 0.0, 0.25, 0.75, 0.08, 0.75)
    for i, c in enumerate(('pink-flowers', 'yellow-flowers', 'blue-flowers', 'flowers', 'white', 'pink-flowers')):
        x, z = 0.34 + (i % 3) * 0.16, 0.38 + (i // 3) * 0.24
        M.rod('leaves', (x, 0.08, z), (x, 0.16, z), 0.008, n=4)
        M.blob(c, x, 0.17, z, 0.05, seed=i, squash=0.7)
    return M


def bench():
    M = Mesh()
    M.box('wood', 0.22, 0.14, 0.42, 0.78, 0.17, 0.58)
    M.box('wood', 0.22, 0.2, 0.4, 0.78, 0.32, 0.43)
    for x in (0.26, 0.74):
        M.box('iron', x - 0.015, 0, 0.44, x + 0.015, 0.14, 0.56); M.box('iron', x - 0.015, 0.14, 0.4, x + 0.015, 0.32, 0.42)
    M.blob('bush', 0.12, 0.08, 0.3, 0.09, seed=3)
    return M


def statue():
    M = Mesh()
    M.box('rock', 0.3, 0, 0.3, 0.7, 0.18, 0.7); M.box('marble', 0.35, 0.18, 0.35, 0.65, 0.24, 0.65)
    M.rod('marble', (0.5, 0.24, 0.5), (0.5, 0.52, 0.5), 0.07, n=8, taper=0.7)   # a robed figure
    M.blob('marble', 0.5, 0.6, 0.5, 0.07, seed=1, squash=1.0)
    M.rod('marble', (0.5, 0.46, 0.52), (0.62, 0.62, 0.56), 0.02, n=5)   # a raised arm
    return M


def garden():
    M = Mesh()
    M.box('grass', 0.1, 0, 0.1, 0.9, 0.03, 0.9)
    M.box('sand', 0.45, 0.0, 0.1, 0.55, 0.035, 0.9)
    for (x, z, c) in ((0.25, 0.25, 'pink-flowers'), (0.25, 0.55, 'yellow-flowers'), (0.25, 0.8, 'blue-flowers'), (0.75, 0.25, 'flowers'), (0.75, 0.55, 'white'), (0.75, 0.8, 'pink-flowers')):
        M.blob('bush', x, 0.06, z, 0.09, seed=int(x * 50 + z * 9), squash=0.7)
        for k in range(3): M.blob(c, x - 0.05 + k * 0.05, 0.12, z + (k - 1) * 0.03, 0.03, seed=k)
    return M


def arbor():
    M = Mesh()
    for x in (0.3, 0.7):
        for z in (0.4, 0.6): M.box('white', x - 0.015, 0, z - 0.015, x + 0.015, 0.5, z + 0.015)
    for k in range(5):
        a0, a1 = np.pi * k / 5, np.pi * (k + 1) / 5
        for z in (0.4, 0.6): M.rod('white', (0.5 - 0.2 * np.cos(a0), 0.5 + 0.12 * np.sin(a0), z), (0.5 - 0.2 * np.cos(a1), 0.5 + 0.12 * np.sin(a1), z), 0.012, n=4)
    for i in range(9):   # climbing roses (their leaves fall in winter)
        a = np.pi * i / 8; x, y = 0.5 - 0.2 * np.cos(a), 0.5 + 0.12 * np.sin(a)
        M.blob('leaves', x, y, 0.5, 0.06, seed=i, squash=0.9)
        if i % 2 == 0: M.blob('pink-flowers', x, y + 0.03, 0.56, 0.025, seed=i + 20)
    for x in (0.3, 0.7): M.blob('leaves', x, 0.15, 0.5, 0.07, seed=int(x * 10))
    return M


def fireflylamp():
    M = Mesh()
    M.rod('dark-wood', (0.5, 0, 0.5), (0.5, 0.42, 0.5), 0.015, n=5)
    M.rod('dark-wood', (0.5, 0.42, 0.5), (0.58, 0.42, 0.5), 0.01, n=4)
    M.cylinder('glow', 0.58, 0.5, 0.04, 0.3, 0.4, n=8)
    M.cylinder('iron', 0.58, 0.5, 0.045, 0.39, 0.415, n=8)
    M.blob('bush', 0.4, 0.06, 0.6, 0.07, seed=4)
    return M


def well(level):
    M = Mesh()
    if level == 0:
        M.cylinder('wall-stone', 0.5, 0.5, 0.2, 0, 0.18, n=12); M.cylinder('water', 0.5, 0.5, 0.15, 0.1, 0.17, n=12)
        for x in (0.32, 0.68): M.box('wood', x - 0.015, 0.1, 0.49, x + 0.015, 0.5, 0.51)
        M.gable('roof-shingle', 'roof-shingle', 0.3, 0.7, 0.4, 0.6, 0.48, 0.6, over=0.04)
        M.rod('wood', (0.32, 0.38, 0.5), (0.68, 0.38, 0.5), 0.015, n=5); M.box('barrel', 0.46, 0.22, 0.46, 0.54, 0.3, 0.54)
    elif level == 1:   # a fountain
        M.cylinder('wall-stone', 0.5, 0.5, 0.36, 0, 0.12, n=16); M.cylinder('water', 0.5, 0.5, 0.31, 0.06, 0.125, n=16)
        M.cylinder('marble', 0.5, 0.5, 0.05, 0.1, 0.36, n=8); M.cylinder('marble', 0.5, 0.5, 0.14, 0.34, 0.38, n=12)
        M.cylinder('water', 0.5, 0.5, 0.11, 0.36, 0.385, n=12); M.blob('marble', 0.5, 0.42, 0.5, 0.04, seed=2)
    else:   # a water tower
        for x in (0.28, 0.72):
            for z in (0.28, 0.72): M.rod('wood', (x, 0, z), (0.5 + (x - 0.5) * 0.8, 0.7, 0.5 + (z - 0.5) * 0.8), 0.025, n=5)
        M.cylinder('barrel', 0.5, 0.5, 0.26, 0.7, 1.05, n=14)
        for y in (0.78, 0.97): M.cylinder('iron', 0.5, 0.5, 0.27, y - 0.01, y + 0.01, n=14, top=False)
        M.cone('roof-shingle', 0.5, 0.5, 0.3, 1.05, 1.25, n=14)
        M.rod('iron', (0.5, 0.1, 0.68), (0.5, 0.7, 0.68), 0.012, n=5); M.box('wall-stone', 0.38, 0, 0.62, 0.62, 0.12, 0.8)
    return M


def campfire(level):
    """The ring only: the game draws the flames and the glow on top, so they flicker."""
    M = Mesh()
    for k in range(9):
        a = 2 * np.pi * k / 9
        M.blob('rock', 0.5 + 0.2 * np.cos(a), 0.035, 0.5 + 0.2 * np.sin(a), 0.05, seed=k, squash=0.7)
    if level >= 1:
        for k in range(4):   # log seats around the fire
            a = 2 * np.pi * k / 4 + 0.4
            c = np.array([0.5 + 0.38 * np.cos(a), 0.05, 0.5 + 0.38 * np.sin(a)]); d = np.array([-np.sin(a), 0, np.cos(a)]) * 0.1
            M.rod('wall-log', c - d, c + d, 0.04, n=6)
    if level == 2:
        for (x, z) in ((0.08, 0.08), (0.92, 0.08), (0.08, 0.92), (0.92, 0.92)):   # lanterns on posts
            M.rod('dark-wood', (x, 0, z), (x, 0.38, z), 0.012, n=4); M.box('lamp', x - 0.03, 0.32, z - 0.03, x + 0.03, 0.4, z + 0.03)
    return M



# ---------------------------------------------------------------- v45: the botanical garden
def botanical():
    """3x3: winding gravel walks, beds of every colour, a little glasshouse and a fountain."""
    M = Mesh()
    M.box('grass', 0.05, 0, 0.05, 2.95, 0.01, 2.95)
    for x0, z0, x1, z1 in ((1.42, 0.05, 1.58, 2.95), (0.05, 1.42, 2.95, 1.58)): M.box('sand', x0, 0.0, z0, x1, 0.02, z1)
    M.cylinder('wall-stone', 1.5, 1.5, 0.28, 0, 0.12, n=12); M.cylinder('water', 1.5, 1.5, 0.24, 0.1, 0.125, n=12); M.cylinder('wall-stone', 1.5, 1.5, 0.05, 0.12, 0.35, n=8)
    beds = ('pink-flowers', 'yellow-flowers', 'blue-flowers', 'flowers', 'white', 'blossom')
    for i, (cx, cz) in enumerate(((0.7, 0.7), (2.3, 0.7), (0.7, 2.3))):
        for k in range(7):
            a = k * 0.9; M.blob('bush', cx + 0.4 * np.cos(a), 0.06, cz + 0.4 * np.sin(a), 0.1, seed=i * 9 + k, squash=0.7)
            M.blob(beds[(i + k) % len(beds)], cx + 0.4 * np.cos(a), 0.14, cz + 0.4 * np.sin(a), 0.05, seed=k)
        M.cylinder('trunk', cx, cz, 0.04, 0, 0.3, n=6); M.blob('leaves', cx, 0.45, cz, 0.2, seed=i)
    # the little glasshouse
    M.box('wall-brick', 1.9, 0, 1.9, 2.8, 0.08, 2.8); M.box('glass', 1.92, 0.08, 1.92, 2.78, 0.45, 2.78)
    M.gable('glass', 'glass', 1.9, 2.8, 1.9, 2.8, 0.45, 0.72, over=0.02)
    for x in np.linspace(1.92, 2.78, 5): M.box('white', x - 0.01, 0.08, 2.78, x + 0.01, 0.46, 2.8)
    for x in (0.4, 2.6): M.box('wood', x - 0.15, 0, 1.25, x + 0.15, 0.1, 1.33)   # benches
    return M

# ---------------------------------------------------------------- v47: more small pleasures (their flames are drawn by the game)
def torch():
    M = Mesh()
    M.rod('dark-wood', (0.5, 0, 0.5), (0.5, 0.36, 0.5), 0.018, n=5)
    M.cylinder('iron', 0.5, 0.5, 0.035, 0.34, 0.4, n=8)      # the iron cup the flame sits in
    M.cylinder('lamp', 0.5, 0.5, 0.025, 0.4, 0.43, n=6)
    for k, a in enumerate((0.3, 2.4, 4.4)): M.box('rock', 0.5 + 0.09 * np.cos(a) - 0.03, 0, 0.5 + 0.09 * np.sin(a) - 0.03, 0.5 + 0.09 * np.cos(a) + 0.03, 0.04, 0.5 + 0.09 * np.sin(a) + 0.03)
    return M


def firelamp():
    M = Mesh()
    M.box('rock', 0.42, 0, 0.42, 0.58, 0.05, 0.58)
    M.rod('iron', (0.5, 0.05, 0.5), (0.5, 0.6, 0.5), 0.014, n=6)
    for a in (0, 1.57, 3.14, 4.71): M.rod('iron', (0.5, 0.6, 0.5), (0.5 + 0.06 * np.cos(a), 0.66, 0.5 + 0.06 * np.sin(a)), 0.006, n=4)
    M.cylinder('iron', 0.5, 0.5, 0.075, 0.66, 0.68, n=8)
    M.cylinder('glow', 0.5, 0.5, 0.06, 0.68, 0.8, n=8)
    M.cone('iron', 0.5, 0.5, 0.085, 0.8, 0.88, n=8)
    M.rod('iron', (0.5, 0.88, 0.5), (0.5, 0.92, 0.5), 0.01, n=4)
    return M


def trough():
    M = Mesh()
    M.box('wood', 0.2, 0, 0.36, 0.8, 0.04, 0.64)   # the floor and four plank sides around the water
    M.box('wood', 0.2, 0, 0.36, 0.8, 0.17, 0.39); M.box('wood', 0.2, 0, 0.61, 0.8, 0.17, 0.64)
    M.box('wood', 0.2, 0, 0.36, 0.23, 0.17, 0.64); M.box('wood', 0.77, 0, 0.36, 0.8, 0.17, 0.64)
    M.box('water', 0.23, 0.04, 0.39, 0.77, 0.14, 0.61, top=True)
    for x in (0.24, 0.76): M.box('dark-wood', x - 0.03, 0, 0.32, x + 0.03, 0.06, 0.68)
    M.blob('bush', 0.86, 0.04, 0.7, 0.06, seed=21)
    return M


def weathervane():
    M = Mesh()
    M.box('rock', 0.4, 0, 0.4, 0.6, 0.08, 0.6)
    M.rod('dark-wood', (0.5, 0.08, 0.5), (0.5, 0.7, 0.5), 0.016, n=5)
    M.rod('iron', (0.5, 0.7, 0.5), (0.5, 0.86, 0.5), 0.008, n=4)
    M.rod('iron', (0.4, 0.8, 0.5), (0.6, 0.8, 0.5), 0.005, n=4); M.rod('iron', (0.5, 0.8, 0.4), (0.5, 0.8, 0.6), 0.005, n=4)   # N S E W
    M.box('iron', 0.42, 0.84, 0.495, 0.6, 0.88, 0.505)   # the arrow
    M.blob('iron', 0.53, 0.9, 0.5, 0.035, seed=3, squash=0.8)   # a little rooster on top
    return M


def sundial():
    M = Mesh()
    M.cylinder('rock', 0.5, 0.5, 0.16, 0, 0.04, n=10)
    M.cylinder('marble', 0.5, 0.5, 0.07, 0.04, 0.3, n=8)
    M.cylinder('marble', 0.5, 0.5, 0.13, 0.3, 0.33, n=12)
    M.quad('bell', (0.5, 0.33, 0.44), (0.5, 0.33, 0.58), (0.5, 0.42, 0.44), (0.5, 0.42, 0.44))
    M.box('bell', 0.495, 0.33, 0.44, 0.505, 0.41, 0.56)
    return M


def signpost():
    M = Mesh()
    M.rod('dark-wood', (0.5, 0, 0.5), (0.5, 0.62, 0.5), 0.02, n=5)
    M.box('plank', 0.5, 0.48, 0.47, 0.78, 0.55, 0.49); M.box('plank', 0.22, 0.38, 0.51, 0.5, 0.45, 0.53)
    M.box('plank', 0.47, 0.28, 0.5, 0.49, 0.35, 0.76)
    M.blob('flowers', 0.42, 0.04, 0.58, 0.05, seed=31)
    return M


def flowerbox():
    M = Mesh()
    for x0 in (0.18, 0.54):
        M.box('paint-blue', x0, 0, 0.4, x0 + 0.28, 0.12, 0.6)
        M.box('soil', x0 + 0.02, 0.1, 0.42, x0 + 0.26, 0.13, 0.58)
        for i, c in enumerate(('pink-flowers', 'yellow-flowers', 'white')): M.blob(c, x0 + 0.06 + i * 0.08, 0.17, 0.5, 0.045, seed=40 + i + int(x0 * 10), squash=0.7)
    return M


def birdhouse():
    M = Mesh()
    M.rod('dark-wood', (0.5, 0, 0.5), (0.5, 0.56, 0.5), 0.016, n=5)
    M.box('paint-red', 0.42, 0.56, 0.44, 0.58, 0.7, 0.56)
    M.gable('roof-shingle', 'paint-red', 0.4, 0.6, 0.42, 0.58, 0.7, 0.78, over=0.02)
    M.cylinder('soot', 0.5, 0.565, 0.025, 0.6, 0.64, n=6)
    M.blob('flowers', 0.44, 0.04, 0.56, 0.05, seed=50)
    return M


def scarecrow():
    M = Mesh()
    M.rod('dark-wood', (0.5, 0, 0.5), (0.5, 0.62, 0.5), 0.016, n=5)
    M.rod('dark-wood', (0.32, 0.46, 0.5), (0.68, 0.46, 0.5), 0.012, n=5)
    M.box('cloth-blue', 0.42, 0.3, 0.46, 0.58, 0.5, 0.54)                 # the shirt
    M.box('cloth-red', 0.32, 0.42, 0.47, 0.42, 0.48, 0.53); M.box('cloth-red', 0.58, 0.42, 0.47, 0.68, 0.48, 0.53)
    M.blob('burlap', 0.5, 0.58, 0.5, 0.06, seed=60, squash=1.0)          # sack head
    M.cylinder('straw', 0.5, 0.5, 0.1, 0.63, 0.645, n=10); M.cone('straw', 0.5, 0.5, 0.055, 0.645, 0.72, n=8)   # hat
    for x in (0.31, 0.69): M.blob('hay', x, 0.45, 0.5, 0.025, seed=int(x * 100))
    return M


def hayrick():
    M = Mesh()
    M.cylinder('hay', 0.5, 0.5, 0.3, 0, 0.32, n=12)
    M.cone('hay', 0.5, 0.5, 0.33, 0.32, 0.62, n=12)
    M.rod('dark-wood', (0.5, 0.6, 0.5), (0.5, 0.7, 0.5), 0.01, n=4)
    for y in (0.12, 0.24): M.cylinder('straw', 0.5, 0.5, 0.305, y, y + 0.015, n=12)
    return M


def rainbarrel():
    M = Mesh()
    M.cylinder('wood', 0.5, 0.5, 0.15, 0, 0.32, n=10)
    for y in (0.06, 0.24): M.cylinder('iron', 0.5, 0.5, 0.155, y, y + 0.02, n=10)
    M.cylinder('water', 0.5, 0.5, 0.13, 0.3, 0.31, n=10)
    M.box('dark-wood', 0.34, 0, 0.66, 0.42, 0.04, 0.74)   # a little dipper
    M.blob('bush', 0.3, 0.04, 0.32, 0.06, seed=70)
    return M


# ---------------------------------------------------------------- the village flag: a pole and a blank flag; the game paints the design
def flagpole():
    M = Mesh()
    M.box('rock', 0.4, 0, 0.4, 0.6, 0.06, 0.6)
    M.rod('white', (0.5, 0.06, 0.5), (0.5, 1.15, 0.5), 0.013, n=6)
    M.blob('gold', 0.5, 1.17, 0.5, 0.025, seed=5)
    return M


MODELS = [
    ('building/flowerbed', flowerbed, {'tiles': [1, 1]}),
    ('building/bench', bench, {'tiles': [1, 1]}),
    ('building/statue', statue, {'tiles': [1, 1]}),
    ('building/garden', garden, {'tiles': [1, 1]}),
    ('building/arbor', arbor, {'tiles': [1, 1], 'seasons': True}),
    ('building/fireflylamp', fireflylamp, {'tiles': [1, 1]}),
    ('building/torch', torch, {'tiles': [1, 1]}),
    ('building/firelamp', firelamp, {'tiles': [1, 1]}),
    ('building/trough', trough, {'tiles': [1, 1]}),
    ('building/weathervane', weathervane, {'tiles': [1, 1]}),
    ('building/sundial', sundial, {'tiles': [1, 1]}),
    ('building/signpost', signpost, {'tiles': [1, 1]}),
    ('building/flowerbox', flowerbox, {'tiles': [1, 1]}),
    ('building/birdhouse', birdhouse, {'tiles': [1, 1]}),
    ('building/scarecrow', scarecrow, {'tiles': [1, 1]}),
    ('building/hayrick', hayrick, {'tiles': [1, 1]}),
    ('building/rainbarrel', rainbarrel, {'tiles': [1, 1]}),
    ('building/flagpole', flagpole, {'tiles': [1, 1]}),
    ('building/botanical', botanical, {'tiles': [3, 3]}),
    *[(f'building/well/{i}', (lambda i=i: well(i)), {'tiles': [1, 1]}) for i in range(3)],
    *[(f'building/campfire/{i}', (lambda i=i: campfire(i)), {'tiles': [1, 1]}) for i in range(3)],
]
