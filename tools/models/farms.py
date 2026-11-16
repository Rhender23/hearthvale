"""Animals and their homes: chicken coop, sheep pasture, dairy pasture, beehives.
(The fields, vegetables, wheat and fiber, stay drawn in the game: their crops grow and change with the seasons, and
they lie flat on the ground.) The animals themselves are drawn by the game, walking about inside the fences."""
import numpy as np
from homes import frame
from kit import Mesh, door
from workshops import barrel


def coop():
    M = Mesh()
    M.box('cloth-red', 0.3, 0.08, 0.32, 0.72, 0.38, 0.66)
    for x, z in ((0.32, 0.64), (0.7, 0.64), (0.7, 0.34), (0.32, 0.34)): M.box('dark-wood', x - 0.015, 0, z - 0.015, x + 0.015, 0.1, z + 0.015)
    M.gable('roof-shingle', 'cloth-red', 0.3, 0.72, 0.32, 0.66, 0.38, 0.56)
    M.box('dark-wood', 0.46, 0.12, 0.66, 0.56, 0.24, 0.67)
    M.quad('plank', (0.46, 0.12, 0.67), (0.56, 0.12, 0.67), (0.56, 0.0, 0.84), (0.46, 0.0, 0.84))   # the ramp
    M.fence('fence', [(0.12, 0.12), (0.92, 0.12), (0.92, 0.92), (0.12, 0.92)], h=0.12, rails=2)
    M.cylinder('hay', 0.22, 0.8, 0.05, 0, 0.04, n=8)
    return M


def pen(kind):
    M = Mesh()
    M.fence('fence', [(0.1, 0.1), (1.9, 0.1), (1.9, 1.9), (0.1, 1.9)], h=0.18, rails=2)
    if kind == 'sheep':
        M.box('plank', 0.25, 0, 0.25, 0.75, 0.32, 0.65); M.lean('roof-shingle', 0.22, 0.78, 0.22, 0.68, 0.3, 0.42)   # a shelter
        M.rod('hay', (1.5, 0.08, 0.4), (1.5, 0.08, 0.62), 0.08, n=8)
    else:
        M.box('wood', 0.25, 0, 0.25, 0.85, 0.4, 0.7); M.gable('roof-shingle', 'wood', 0.25, 0.85, 0.25, 0.7, 0.4, 0.6)   # a byre
        M.box('wood', 1.4, 0, 0.3, 1.8, 0.08, 0.42); M.box('water', 1.42, 0.05, 0.32, 1.78, 0.085, 0.4)   # a trough
        barrel(M, 1.75, 0.6)
    M.blob('bush', 1.75, 0.1, 1.75, 0.1, seed=2)
    return M


def apiary():
    M = Mesh()
    for (x, z) in ((0.3, 0.35), (0.66, 0.35), (0.3, 0.7), (0.66, 0.7)):
        M.box('dark-wood', x - 0.1, 0, z - 0.08, x + 0.1, 0.06, z + 0.08)
        for k in range(3): M.box('hive' if k % 2 == 0 else 'wax', x - 0.08, 0.06 + k * 0.07, z - 0.065, x + 0.08, 0.13 + k * 0.07, z + 0.065)
        M.gable('roof-shingle', 'white', x - 0.08, x + 0.08, z - 0.065, z + 0.065, 0.27, 0.33, over=0.02)
    M.blob('yellow-flowers', 0.86, 0.04, 0.9, 0.06, seed=1); M.blob('pink-flowers', 0.12, 0.04, 0.92, 0.05, seed=2)
    return M



# ---------------------------------------------------------------- v45: orchards, greenhouse, stable
FRUIT = {'apple': ('pink-flowers', 'apple', 2), 'pear': ('white', 'pear', 1), 'cherry': ('blossom', 'berries', 1), 'plum': ('white', 'plum', 2)}
TREES = ((0.5, 0.5), (1.5, 0.5), (0.5, 1.5), (1.5, 1.5))


def orchard(kind, season):
    """A 2x2 orchard: four fruit trees on a mown square. season: 'bare' (winter and the fallback), 'spring' (blossom),
    'summer' (green, fruit if it bears then), 'autumn' (russet leaves, fruit if it bears then)."""
    bloom, fruit, when = FRUIT[kind]
    M = Mesh()
    M.box('grass', 0.05, 0, 0.05, 1.95, 0.01, 1.95)
    for i, (x, z) in enumerate(TREES):
        x += (i % 2) * 0.04 - 0.02; z += (i // 2) * 0.04 - 0.02
        M.cylinder('trunk', x, z, 0.05, 0, 0.36, n=7)
        for k in range(5):
            a = 2 * np.pi * k / 5 + i
            M.rod('trunk', (x, 0.3, z), (x + 0.2 * np.cos(a), 0.52, z + 0.2 * np.sin(a)), 0.016, n=4, taper=0.5)
        if season == 'bare': continue
        crown = 'russet' if season == 'autumn' else 'leaves'
        M.blob(crown, x, 0.6, z, 0.27, seed=i + 3, squash=0.8)
        if season == 'spring':
            for k in range(9): a = k * 0.7 + i; M.blob(bloom, x + 0.22 * np.cos(a), 0.6 + 0.12 * np.sin(k * 1.7), z + 0.22 * np.sin(a), 0.045, seed=k)
        bears = (season == 'summer' and when == 1) or (season == 'autumn' and when == 2)
        if bears:
            for k in range(8): a = k * 0.8 + i * 0.5; M.blob(fruit, x + 0.24 * np.cos(a), 0.5 + 0.1 * np.sin(k * 1.3), z + 0.24 * np.sin(a), 0.035, seed=k, squash=1.0)
    if season == 'autumn' and when == 2:
        for k in range(3): M.box('plank', 0.9 + k * 0.1, 0, 1.82, 0.98 + k * 0.1, 0.07, 1.9)   # baskets of fruit
    return M


def greenhouse():
    M = Mesh()
    M.box('wall-brick', 0.2, 0, 0.35, 1.8, 0.12, 1.65)
    M.box('glass', 0.22, 0.12, 0.37, 1.78, 0.55, 1.63)
    for x in np.linspace(0.22, 1.78, 7): M.box('white', x - 0.012, 0.12, 0.36, x + 0.012, 0.56, 1.64)
    M.gable('glass', 'glass', 0.2, 1.8, 0.35, 1.65, 0.55, 0.9, over=0.02)
    for x in np.linspace(0.22, 1.78, 7): M.rod('white', (x, 0.55, 0.35), (x, 0.9, 1.0), 0.01, n=4); M.rod('white', (x, 0.55, 1.65), (x, 0.9, 1.0), 0.01, n=4)
    for x in (0.4, 0.8, 1.2, 1.6): M.blob('leaves', x, 0.25, 0.8, 0.1, seed=int(x * 10)); M.blob('leaves', x, 0.25, 1.2, 0.1, seed=int(x * 10) + 1)
    door(M, 1.0, 1.65, w=0.18, h=0.32)
    for x in (0.35, 0.5): M.cylinder('pottery', x, 1.82, 0.05, 0, 0.08, n=8)
    return M


def stable():
    M = Mesh()
    M.box('wall-timber', 0.2, 0, 0.3, 1.8, 0.55, 1.3)
    frame(M, 0.2, 1.8, 0.3, 1.3, 0, 0.55, n=4)
    M.gable('roof-shingle', 'wall-timber', 0.2, 1.8, 0.3, 1.3, 0.55, 0.95)
    for x in (0.5, 1.0, 1.5): M.box('dark-wood', x - 0.16, 0, 1.3, x + 0.16, 0.36, 1.32); M.box('plank', x - 0.16, 0.18, 1.32, x + 0.16, 0.2, 1.34)   # stall doors
    M.box('hay', 0.3, 0, 1.45, 0.55, 0.16, 1.7)
    # a handcart
    M.box('plank', 1.2, 0.12, 1.5, 1.6, 0.2, 1.75); M.cylinder('dark-wood', 1.25, 1.62, 0.09, 0.02, 0.04, n=10)
    M.rod('dark-wood', (1.6, 0.16, 1.55), (1.82, 0.12, 1.5), 0.012, n=4); M.rod('dark-wood', (1.6, 0.16, 1.7), (1.82, 0.12, 1.75), 0.012, n=4)
    for x in (0.8,): M.blob('mud', x, 0.0, 1.6, 0.08, seed=2, squash=0.3)
    M.fence('fence', [(0.1, 1.38), (0.1, 1.9), (0.95, 1.9)], closed=False)
    return M

MODELS = [
    ('building/coop', coop, {'tiles': [1, 1]}),
    ('building/sheepfold', lambda: pen('sheep'), {'tiles': [2, 2]}),
    ('building/pasture', lambda: pen('cows'), {'tiles': [2, 2]}),
    ('building/apiary', apiary, {'tiles': [1, 1]}),
    *[(f'building/orchard_{k}' + ('' if s == 'bare' else '/' + s), (lambda k=k, s=s: orchard(k, s)), {'tiles': [2, 2]}) for k in FRUIT for s in ('bare', 'spring', 'summer', 'autumn')],
    ('building/greenhouse', greenhouse, {'tiles': [2, 2]}),
    ('building/stable', stable, {'tiles': [2, 2]}),
]
