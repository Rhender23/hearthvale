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


MODELS = [
    ('building/flowerbed', flowerbed, {'tiles': [1, 1]}),
    ('building/bench', bench, {'tiles': [1, 1]}),
    ('building/statue', statue, {'tiles': [1, 1]}),
    ('building/garden', garden, {'tiles': [1, 1]}),
    ('building/arbor', arbor, {'tiles': [1, 1], 'seasons': True}),
    ('building/fireflylamp', fireflylamp, {'tiles': [1, 1]}),
    *[(f'building/well/{i}', (lambda i=i: well(i)), {'tiles': [1, 1]}) for i in range(3)],
    *[(f'building/campfire/{i}', (lambda i=i: campfire(i)), {'tiles': [1, 1]}) for i in range(3)],
]
