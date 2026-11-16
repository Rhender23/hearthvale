"""Homes: the house at all nine levels (Hut … Grand manor), the farmhouse at three, and the lodge.
Every home faces +z (the door side); one tile is 1 unit; y is up. See kit.py for the shapes."""
from kit import Mesh, window, door


def windows_z(M, xs, y, z, **k):
    for x in xs: window(M, x, y, z, **k)


def windows_x(M, zs, y, x, **k):
    for z in zs: window(M, x, y, z, face='+x', **k)


def chimney(M, x, z, y0, y1, w=0.1, mat='chimney'):
    M.box(mat, x - w / 2, y0, z - w / 2, x + w / 2, y1, z + w / 2)
    M.box(mat, x - w / 2 - 0.012, y1 - 0.03, z - w / 2 - 0.012, x + w / 2 + 0.012, y1, z + w / 2 + 0.012)


def frame(M, x0, x1, z0, z1, y0, y1, n=3, mat='beam'):
    """Timber framing on the two faces the camera sees (+z and +x)."""
    t = 0.022
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n; M.box(mat, x - t, y0, z1 - 0.005, x + t, y1, z1 + 0.025)
        z = z0 + (z1 - z0) * i / n; M.box(mat, x1 - 0.005, y0, z - t, x1 + 0.025, y1, z + t)
    M.box(mat, x0 - 0.01, y1 - 0.03, z1 - 0.005, x1 + 0.01, y1 + 0.01, z1 + 0.03)
    M.box(mat, x1 - 0.005, y1 - 0.03, z0 - 0.01, x1 + 0.03, y1 + 0.01, z1 + 0.01)


def flowerbox(M, x0, x1, z):
    M.box('flowers', x0, 0, z, x1, 0.06, z + 0.06)


# ---------------------------------------------------------------- the house, level by level
def hut():
    M = Mesh()
    M.box('wall-log', 0.22, 0, 0.25, 0.78, 0.36, 0.75)
    for y in (0.08, 0.17, 0.26):   # log ends at the corners
        M.rod('wall-log', (0.78, y, 0.24), (0.78, y, 0.76), 0.035, n=6)
        M.rod('wall-log', (0.21, y, 0.75), (0.79, y, 0.75), 0.035, n=6)
    M.gable('roof-thatch', 'roof-thatch', 0.22, 0.78, 0.25, 0.75, 0.34, 0.78, over=0.1)
    door(M, 0.5, 0.75, h=0.26)
    window(M, 0.78, 0.15, 0.5, w=0.12, h=0.1, face='+x')
    M.box('wood', 0.05, 0, 0.6, 0.18, 0.08, 0.72)   # a chopping block
    return M


def cottage():
    M = Mesh()
    M.box('wall-plaster', 0.15, 0, 0.22, 0.85, 0.48, 0.78)
    for x in (0.15, 0.85):
        for z in (0.22, 0.78): M.box('beam', x - 0.025, 0, z - 0.025, x + 0.025, 0.48, z + 0.025)
    M.box('beam', 0.14, 0.46, 0.77, 0.86, 0.5, 0.8)
    M.gable('roof-thatch', 'gable', 0.15, 0.85, 0.22, 0.78, 0.48, 0.92)
    chimney(M, 0.71, 0.43, 0.6, 1.0)
    door(M, 0.36, 0.78)
    window(M, 0.64, 0.2, 0.78); window(M, 0.85, 0.2, 0.5, face='+x')
    flowerbox(M, 0.52, 0.76, 0.8)
    return M


def cozy_cottage():
    M = Mesh()
    M.box('wall-stone', 0.1, 0, 0.18, 0.9, 0.22, 0.82)
    M.box('wall-plaster', 0.1, 0.22, 0.18, 0.9, 0.58, 0.82)
    for x in (0.1, 0.36, 0.64, 0.9): M.box('beam', x - 0.022, 0.22, 0.8, x + 0.022, 0.58, 0.84)
    for z in (0.18, 0.5, 0.82): M.box('beam', 0.88, 0.22, z - 0.022, 0.92, 0.58, z + 0.022)
    M.box('beam', 0.09, 0.56, 0.81, 0.91, 0.6, 0.85)
    M.gable('roof-tile', 'gable', 0.1, 0.9, 0.18, 0.82, 0.58, 1.08)
    chimney(M, 0.26, 0.4, 0.7, 1.22, w=0.12)
    door(M, 0.5, 0.82, h=0.34)
    M.box('beam', 0.4, 0.34, 0.82, 0.6, 0.37, 0.9)
    windows_z(M, (0.24, 0.76), 0.3, 0.82); windows_x(M, (0.34, 0.66), 0.3, 0.9)
    flowerbox(M, 0.16, 0.38, 0.84); flowerbox(M, 0.62, 0.84, 0.84)
    M.blob('bush', 0.94, 0.08, 0.9, 0.08, seed=4)
    return M


def timber_house():
    M = Mesh()
    M.box('wall-stone', 0.12, 0, 0.18, 0.88, 0.12, 0.82)
    M.box('wall-plaster', 0.12, 0.12, 0.18, 0.88, 0.86, 0.82)
    frame(M, 0.12, 0.88, 0.18, 0.82, 0.12, 0.48, n=3); frame(M, 0.12, 0.88, 0.18, 0.82, 0.48, 0.86, n=3)
    M.gable('roof-tile', 'gable', 0.12, 0.88, 0.18, 0.82, 0.86, 1.32)
    chimney(M, 0.74, 0.36, 1.0, 1.46, w=0.12)
    door(M, 0.5, 0.82, h=0.32)
    windows_z(M, (0.26, 0.74), 0.24, 0.82); windows_z(M, (0.26, 0.5, 0.74), 0.6, 0.82, w=0.13, h=0.16)
    windows_x(M, (0.34, 0.66), 0.24, 0.88); windows_x(M, (0.5,), 0.6, 0.88, w=0.13, h=0.16)
    flowerbox(M, 0.18, 0.4, 0.84)
    return M


def fine_timber_house():
    M = Mesh()
    M.box('wall-stone', 0.12, 0, 0.18, 0.88, 0.14, 0.82)
    M.box('wall-plaster', 0.12, 0.14, 0.18, 0.88, 0.5, 0.82)
    M.box('wall-plaster', 0.09, 0.5, 0.15, 0.91, 0.9, 0.86)   # the upper floor jutting out
    frame(M, 0.12, 0.88, 0.18, 0.82, 0.14, 0.5, n=4); frame(M, 0.09, 0.91, 0.15, 0.86, 0.5, 0.9, n=4)
    M.gable('roof-tile', 'gable', 0.09, 0.91, 0.15, 0.86, 0.9, 1.38)
    M.box('wall-plaster', 0.42, 0.95, 0.66, 0.58, 1.16, 0.9); M.gable('roof-tile', 'gable', 0.42, 0.58, 0.66, 0.9, 1.16, 1.28, over=0.03)   # dormer
    window(M, 0.5, 1.0, 0.9, w=0.1, h=0.1)
    chimney(M, 0.24, 0.34, 1.0, 1.52, w=0.12); chimney(M, 0.78, 0.4, 1.0, 1.46, w=0.1)
    door(M, 0.5, 0.82, h=0.34); M.box('beam', 0.4, 0.34, 0.82, 0.6, 0.37, 0.92)
    windows_z(M, (0.24, 0.76), 0.24, 0.82); windows_z(M, (0.24, 0.5, 0.76), 0.64, 0.86, w=0.13, h=0.17)
    windows_x(M, (0.34, 0.66), 0.24, 0.88); windows_x(M, (0.32, 0.68), 0.64, 0.91, w=0.13, h=0.17)
    flowerbox(M, 0.16, 0.38, 0.84); flowerbox(M, 0.62, 0.84, 0.84)
    M.blob('bush', 0.07, 0.07, 0.9, 0.07, seed=6)
    return M


def stone_house():
    M = Mesh()
    M.box('wall-stone', 0.12, 0, 0.2, 0.88, 0.88, 0.8)
    for x, z in ((0.12, 0.8), (0.88, 0.8), (0.88, 0.2)): M.box('rock', x - 0.035, 0, z - 0.035, x + 0.035, 0.88, z + 0.035)   # quoins
    M.gable('roof-slate', 'wall-stone', 0.12, 0.88, 0.2, 0.8, 0.88, 1.3)
    chimney(M, 0.16, 0.5, 0.86, 1.46, w=0.12, mat='wall-stone'); chimney(M, 0.84, 0.5, 0.86, 1.46, w=0.12, mat='wall-stone')
    door(M, 0.5, 0.8, h=0.34)
    M.box('step', 0.36, 0, 0.8, 0.64, 0.05, 0.9)
    windows_z(M, (0.25, 0.75), 0.22, 0.8); windows_z(M, (0.25, 0.5, 0.75), 0.58, 0.8, w=0.13, h=0.18)
    windows_x(M, (0.35, 0.65), 0.22, 0.88); windows_x(M, (0.35, 0.65), 0.58, 0.88, w=0.13, h=0.18)
    M.blob('bush', 0.08, 0.08, 0.88, 0.08, seed=7); M.blob('bush', 0.94, 0.08, 0.86, 0.07, seed=8)
    return M


def fine_stone_house():
    M = stone_house()
    # a bay window and a little porch with columns
    M.box('wall-stone', 0.16, 0, 0.8, 0.36, 0.42, 0.9); M.lean('roof-slate', 0.14, 0.38, 0.8, 0.92, 0.42, 0.5)
    window(M, 0.26, 0.16, 0.9, w=0.14, h=0.18)
    for x in (0.4, 0.6): M.rod('white', (x, 0, 0.92), (x, 0.4, 0.92), 0.018)
    M.box('white', 0.37, 0.4, 0.8, 0.63, 0.44, 0.95); M.lean('roof-slate', 0.36, 0.64, 0.8, 0.96, 0.44, 0.52)
    M.box('wall-stone', 0.42, 0.9, 0.66, 0.58, 1.08, 0.86); M.gable('roof-slate', 'wall-stone', 0.42, 0.58, 0.66, 0.86, 1.08, 1.2, over=0.03)
    window(M, 0.5, 0.93, 0.86, w=0.09, h=0.1)
    M.blob('pink-flowers', 0.72, 0.05, 0.9, 0.06, seed=9)
    return M


def manor():
    M = Mesh()
    M.box('wall-brick', 0.08, 0, 0.18, 0.92, 0.96, 0.82)
    M.box('white', 0.06, 0.94, 0.16, 0.94, 0.99, 0.84)   # cornice
    for x, z in ((0.08, 0.82), (0.92, 0.82), (0.92, 0.18)): M.box('white', x - 0.03, 0, z - 0.03, x + 0.03, 0.96, z + 0.03)
    M.hip('roof-slate', 0.08, 0.92, 0.18, 0.82, 0.99, 1.36, ridge=0.35)
    chimney(M, 0.24, 0.5, 1.0, 1.52, w=0.12, mat='wall-brick'); chimney(M, 0.76, 0.5, 1.0, 1.52, w=0.12, mat='wall-brick')
    door(M, 0.5, 0.82, h=0.36); M.box('white', 0.42, 0.36, 0.82, 0.58, 0.4, 0.86)
    M.box('step', 0.34, 0, 0.82, 0.66, 0.04, 0.92); M.box('step', 0.38, 0.04, 0.82, 0.62, 0.07, 0.88)
    windows_z(M, (0.2, 0.36, 0.64, 0.8), 0.22, 0.82, w=0.11, h=0.19); windows_z(M, (0.2, 0.36, 0.5, 0.64, 0.8), 0.6, 0.82, w=0.11, h=0.19)
    windows_x(M, (0.3, 0.5, 0.7), 0.22, 0.92, w=0.11, h=0.19); windows_x(M, (0.3, 0.5, 0.7), 0.6, 0.92, w=0.11, h=0.19)
    for x in (0.12, 0.88): M.blob('bush', x, 0.08, 0.9, 0.08, seed=int(x * 100))
    return M


def grand_manor():
    M = Mesh()
    M.box('wall-brick', 0.06, 0, 0.2, 0.94, 1.0, 0.8)
    M.box('wall-stone', 0.32, 0, 0.8, 0.68, 1.14, 0.88)   # the centre bay steps forward
    M.box('white', 0.04, 0.98, 0.18, 0.96, 1.03, 0.82)
    for x in (0.06, 0.94, 0.32, 0.68): M.box('white', x - 0.03, 0, 0.8 - 0.03, x + 0.03, 1.0, 0.8 + 0.03)
    M.hip('roof-slate', 0.06, 0.94, 0.2, 0.8, 1.03, 1.38, ridge=0.5)
    M.gable('roof-slate', 'white', 0.32, 0.68, 0.66, 0.92, 1.14, 1.36, over=0.03)   # pediment over the centre bay
    # a little cupola on the ridge
    M.box('white', 0.44, 1.32, 0.44, 0.56, 1.5, 0.56); M.hip('roof-slate', 0.44, 0.56, 0.44, 0.56, 1.5, 1.66, ridge=0, over=0.03)
    M.rod('bell', (0.5, 1.66, 0.5), (0.5, 1.76, 0.5), 0.008)
    chimney(M, 0.14, 0.5, 1.0, 1.56, w=0.12, mat='wall-brick'); chimney(M, 0.86, 0.5, 1.0, 1.56, w=0.12, mat='wall-brick')
    door(M, 0.5, 0.88, h=0.4); M.box('step', 0.3, 0, 0.88, 0.7, 0.05, 0.98)
    for x in (0.38, 0.62): M.rod('white', (x, 0.05, 0.94), (x, 0.5, 0.94), 0.02)
    M.box('white', 0.33, 0.5, 0.86, 0.67, 0.55, 0.98)
    windows_z(M, (0.14, 0.24, 0.76, 0.86), 0.24, 0.8, w=0.08, h=0.2); windows_z(M, (0.14, 0.24, 0.76, 0.86), 0.62, 0.8, w=0.08, h=0.2)
    windows_z(M, (0.42, 0.58), 0.66, 0.88, w=0.09, h=0.22)
    windows_x(M, (0.3, 0.5, 0.7), 0.24, 0.94, w=0.1, h=0.2); windows_x(M, (0.3, 0.5, 0.7), 0.62, 0.94, w=0.1, h=0.2)
    for x in (0.12, 0.88): M.cone('pine', x, 0.92, 0.06, 0.02, 0.3, n=7)
    return M


# ---------------------------------------------------------------- v47: the stone houses built in brick instead
def brick_house():
    M = Mesh()
    M.box('wall-brick', 0.12, 0, 0.2, 0.88, 0.88, 0.8)
    for x, z in ((0.12, 0.8), (0.88, 0.8), (0.88, 0.2)): M.box('white', x - 0.03, 0, z - 0.03, x + 0.03, 0.88, z + 0.03)   # pale quoins
    M.box('white', 0.1, 0.86, 0.18, 0.9, 0.9, 0.82)   # a pale band under the eaves
    M.gable('roof-slate', 'wall-brick', 0.12, 0.88, 0.2, 0.8, 0.9, 1.32)
    chimney(M, 0.16, 0.5, 0.86, 1.48, w=0.12, mat='wall-brick'); chimney(M, 0.84, 0.5, 0.86, 1.48, w=0.12, mat='wall-brick')
    door(M, 0.5, 0.8, h=0.34); M.box('white', 0.41, 0.34, 0.8, 0.59, 0.38, 0.84)
    M.box('step', 0.36, 0, 0.8, 0.64, 0.05, 0.9)
    windows_z(M, (0.25, 0.75), 0.22, 0.8); windows_z(M, (0.25, 0.5, 0.75), 0.58, 0.8, w=0.13, h=0.18)
    windows_x(M, (0.35, 0.65), 0.22, 0.88); windows_x(M, (0.35, 0.65), 0.58, 0.88, w=0.13, h=0.18)
    flowerbox(M, 0.17, 0.33, 0.8); flowerbox(M, 0.67, 0.83, 0.8)
    M.blob('bush', 0.08, 0.08, 0.88, 0.08, seed=17); M.blob('bush', 0.94, 0.08, 0.86, 0.07, seed=18)
    return M


def fine_brick_house():
    M = brick_house()
    # a white porch with columns, a dormer, a little bay window
    for x in (0.4, 0.6): M.rod('white', (x, 0, 0.94), (x, 0.4, 0.94), 0.018)
    M.box('white', 0.37, 0.4, 0.8, 0.63, 0.44, 0.97); M.lean('roof-slate', 0.36, 0.64, 0.8, 0.98, 0.44, 0.52)
    M.box('wall-brick', 0.16, 0, 0.8, 0.34, 0.42, 0.9); M.lean('roof-slate', 0.14, 0.36, 0.8, 0.92, 0.42, 0.5)
    window(M, 0.25, 0.16, 0.9, w=0.12, h=0.18)
    M.box('wall-brick', 0.42, 0.92, 0.66, 0.58, 1.1, 0.86); M.gable('roof-slate', 'white', 0.42, 0.58, 0.66, 0.86, 1.1, 1.22, over=0.03)
    window(M, 0.5, 0.95, 0.86, w=0.09, h=0.1)
    M.blob('pink-flowers', 0.74, 0.05, 0.9, 0.06, seed=19)
    return M


HOUSE = [hut, cottage, cozy_cottage, timber_house, fine_timber_house, stone_house, fine_stone_house, manor, grand_manor]


# ---------------------------------------------------------------- the farmhouse (2x2) and the lodge (2x2)
def farmhouse(level):
    M = Mesh()
    w = 1.2 + 0.2 * level
    x0, x1, z0, z1 = 1.0 - w / 2, 1.0 + w / 2, 0.55, 1.45
    wall = ['wall-plaster', 'wall-plaster', 'wall-stone'][level]
    M.box(wall, x0, 0, z0, x1, 0.55 + 0.15 * level, z1)
    yt = 0.55 + 0.15 * level
    if level < 2: frame(M, x0, x1, z0, z1, 0, yt, n=4)
    M.gable(['roof-thatch', 'roof-tile', 'roof-slate'][level], 'gable' if level < 2 else wall, x0, x1, z0, z1, yt, yt + 0.48)
    chimney(M, x1 - 0.2, 0.9, yt + 0.1, yt + 0.62, w=0.12)
    door(M, 0.85, z1, h=0.32)
    windows_z(M, [x0 + 0.2, 1.15, x1 - 0.2] if level else [x0 + 0.25, x1 - 0.25], 0.22, z1)
    windows_x(M, (0.8, 1.2), 0.22, x1)
    if level: windows_z(M, (x0 + 0.3, x1 - 0.3), 0.5 + 0.1 * level, z1, w=0.12, h=0.14)
    # the yard: a fence, a hay bale, a water trough
    M.fence('fence', [(0.08, 1.6), (1.92, 1.6), (1.92, 0.2)], closed=False)
    M.rod('hay', (0.25, 0.09, 1.72), (0.25, 0.09, 1.9), 0.09, n=8)
    M.box('wood', 1.55, 0, 1.7, 1.85, 0.08, 1.82); M.box('water', 1.57, 0.05, 1.72, 1.83, 0.085, 1.8, top=True)
    if level == 2: M.box('wood', x0 - 0.35, 0, z0 + 0.1, x0, 0.4, z0 + 0.5); M.lean('roof-slate', x0 - 0.38, x0, z0 + 0.06, z0 + 0.54, 0.38, 0.5)
    return M


def lodge():
    M = Mesh()
    M.box('wall-log', 0.2, 0, 0.35, 1.8, 0.6, 1.5)
    for y in (0.1, 0.22, 0.34, 0.46):
        M.rod('wall-log', (1.8, y, 0.33), (1.8, y, 1.52), 0.04, n=6); M.rod('wall-log', (0.18, y, 1.5), (1.82, y, 1.5), 0.04, n=6)
    M.gable('roof-shingle', 'wall-log', 0.2, 1.8, 0.35, 1.5, 0.6, 1.15)
    chimney(M, 0.45, 0.9, 0.7, 1.32, w=0.16, mat='wall-stone'); chimney(M, 1.55, 0.9, 0.7, 1.32, w=0.16, mat='wall-stone')
    door(M, 1.0, 1.5, w=0.2, h=0.36)
    M.lean('roof-shingle', 0.7, 1.3, 1.5, 1.72, 0.36, 0.46); [M.rod('wood', (x, 0, 1.7), (x, 0.38, 1.7), 0.02) for x in (0.74, 1.26)]
    windows_z(M, (0.4, 0.62, 1.38, 1.6), 0.26, 1.5); windows_x(M, (0.6, 1.0, 1.3), 0.26, 1.8)
    M.box('wood', 1.85, 0, 0.5, 1.98, 0.3, 1.0)   # a woodpile
    return M
