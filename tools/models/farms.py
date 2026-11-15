"""Animals and their homes: chicken coop, sheep pasture, dairy pasture, beehives.
(The fields, vegetables, wheat and fiber, stay drawn in the game: their crops grow and change with the seasons, and
they lie flat on the ground.) The animals themselves are drawn by the game, walking about inside the fences."""
from kit import Mesh
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


MODELS = [
    ('building/coop', coop, {'tiles': [1, 1]}),
    ('building/sheepfold', lambda: pen('sheep'), {'tiles': [2, 2]}),
    ('building/pasture', lambda: pen('cows'), {'tiles': [2, 2]}),
    ('building/apiary', apiary, {'tiles': [1, 1]}),
]
