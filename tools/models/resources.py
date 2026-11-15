"""What the land gives: trees (four kinds, picked by place for variety), saplings, and stone, gold, clay and berry
bushes, each at three stages as they're used up (0 = plenty … 2 = nearly gone). Leaves change with the seasons
and fall in winter, except on the pines."""
import numpy as np
from kit import Mesh


def branches(M, top, spread, seed):
    """Boughs and twigs inside the crown: hidden by the leaves most of the year, the shape of the tree in winter."""
    rng = np.random.default_rng(seed)
    for k in range(7):
        a = 2 * np.pi * k / 7 + rng.uniform(-0.3, 0.3)
        base = np.array([0.5, top * rng.uniform(0.6, 0.9), 0.5])
        d = np.array([np.cos(a) * spread * rng.uniform(1.2, 1.8), rng.uniform(0.3, 0.5), np.sin(a) * spread * rng.uniform(1.2, 1.8)])
        M.rod('trunk', base, base + d, 0.022, n=5, taper=0.45)
        for t in (0.55, 0.85):   # twigs off each bough
            p = base + d * t; e = np.array([np.cos(a + 0.9) * 0.08, 0.12, np.sin(a + 0.9) * 0.08])
            M.rod('trunk', p, p + e, 0.009, n=4, taper=0.4)
    M.rod('trunk', (0.5, top * 0.8, 0.5), (0.5, top + 0.55, 0.5), 0.028, n=5, taper=0.3)


def oak(seed=1):
    M = Mesh()
    M.cylinder('trunk', 0.5, 0.5, 0.065, 0, 0.55, n=7)
    branches(M, 0.6, 0.18, seed)
    rng = np.random.default_rng(seed)
    M.blob('leaves', 0.5, 0.8, 0.5, 0.32, seed=seed)
    for k in range(3):
        a = rng.uniform(0, 2 * np.pi); M.blob('leaves', 0.5 + 0.18 * np.cos(a), 0.7 + rng.uniform(-0.05, 0.12), 0.5 + 0.18 * np.sin(a), 0.2, seed=seed + k + 1)
    return M


def birch(seed=2):
    M = Mesh()
    M.cylinder('white', 0.5, 0.5, 0.045, 0, 0.7, n=7)
    for y in (0.2, 0.42, 0.6): M.cylinder('dark-wood', 0.5, 0.5, 0.047, y, y + 0.015, n=7, top=False)
    branches(M, 0.75, 0.14, seed)
    for k, (dy, r) in enumerate(((0.75, 0.2), (0.95, 0.17), (1.1, 0.12))): M.blob('leaves', 0.5, dy, 0.5, r, seed=seed + k, squash=1.05)
    return M


def pine(seed=3):
    M = Mesh()
    M.cylinder('trunk', 0.5, 0.5, 0.05, 0, 0.3, n=6)
    for k, (y0, y1, r) in enumerate(((0.18, 0.62, 0.3), (0.42, 0.88, 0.23), (0.66, 1.15, 0.15))): M.cone('pine', 0.5, 0.5, r, y0, y1, n=8)
    return M


def round_tree(seed=4):
    M = Mesh()
    M.cylinder('trunk', 0.5, 0.5, 0.055, 0, 0.42, n=7)
    branches(M, 0.45, 0.14, seed)
    M.blob('leaves', 0.5, 0.66, 0.5, 0.27, seed=seed, squash=0.95)
    M.blob('leaves', 0.42, 0.56, 0.58, 0.16, seed=seed + 9)
    return M


def sapling():
    M = Mesh()
    M.rod('trunk', (0.5, 0, 0.5), (0.5, 0.3, 0.5), 0.02, n=5, taper=0.6)
    M.blob('leaves', 0.5, 0.34, 0.5, 0.1, seed=5)
    M.blob('leaves', 0.46, 0.26, 0.54, 0.06, seed=6)
    return M


def stone(stage):
    M = Mesh()
    rocks = [(0.5, 0.5, 0.26), (0.32, 0.62, 0.17), (0.68, 0.4, 0.18), (0.62, 0.68, 0.12)][:4 - stage]
    for k, (x, z, r) in enumerate(rocks): M.blob('rock' if k % 2 == 0 else 'rock-dark', x, r * 0.55, z, r * (1 - 0.18 * stage), seed=10 + k, squash=0.75)
    return M


def gold(stage):
    M = stone(stage)
    rng = np.random.default_rng(7)
    for k in range(6 - 2 * stage):
        a = rng.uniform(0, 2 * np.pi); M.blob('gold', 0.5 + 0.18 * np.cos(a), 0.12 + rng.uniform(0, 0.12), 0.5 + 0.18 * np.sin(a), 0.04, seed=k)
    return M


def clay(stage):
    M = Mesh()
    M.blob('clay', 0.5, 0.04, 0.5, 0.34 - 0.06 * stage, seed=21, squash=0.35)
    for k in range(3 - stage): M.blob('clay', 0.36 + k * 0.14, 0.08, 0.42 + (k % 2) * 0.16, 0.1, seed=22 + k, squash=0.6)
    M.blob('mud', 0.66, 0.02, 0.66, 0.08, seed=30, squash=0.4)
    return M


def berry(stage):
    M = Mesh()
    for k, (x, z, r) in enumerate(((0.5, 0.5, 0.24), (0.34, 0.6, 0.15), (0.64, 0.38, 0.14))):
        M.blob('bush', x, r * 0.85, z, r, seed=40 + k)
    rng = np.random.default_rng(3)
    for k in range(14 - 5 * stage):   # berries (fewer as they're picked)
        a = rng.uniform(0, 2 * np.pi); y = rng.uniform(0.1, 0.36)
        M.blob('berries', 0.5 + 0.22 * np.cos(a), y, 0.5 + 0.22 * np.sin(a), 0.03, seed=k, squash=1.0)
    return M


MODELS = [
    ('node/tree', oak, {'tiles': [1, 1], 'anchor': 'centre', 'seasons': True, 'random': True,
                        'frames': [lambda: oak(1), lambda: birch(2), lambda: round_tree(4), lambda: oak(8), lambda: pine(3)]}),
    ('node/sapling', sapling, {'tiles': [1, 1], 'anchor': 'centre', 'seasons': True}),
    *[(f'node/stone/{i}', (lambda i=i: stone(i)), {'tiles': [1, 1], 'anchor': 'centre'}) for i in range(3)],
    *[(f'node/gold/{i}', (lambda i=i: gold(i)), {'tiles': [1, 1], 'anchor': 'centre'}) for i in range(3)],
    *[(f'node/clay/{i}', (lambda i=i: clay(i)), {'tiles': [1, 1], 'anchor': 'centre'}) for i in range(3)],
    *[(f'node/berry/{i}', (lambda i=i: berry(i)), {'tiles': [1, 1], 'anchor': 'centre'}) for i in range(3)],
]
