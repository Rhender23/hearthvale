"""The village's shared places: the town center (one look per Age), tavern, schoolhouse, artist's studio, theater,
church, library, playground, monument, and the construction sites every building starts as."""
import numpy as np
from kit import Mesh, window, door
from homes import chimney, frame, windows_z, windows_x
from workshops import barrel, crate, sign


def tc(age):
    """The town center: a timber hall that grows grander with each Age, with the village flag."""
    M = Mesh()
    wall = ['wall-plaster', 'wall-plaster', 'wall-stone', 'wall-brick'][age]
    roof = ['roof-thatch', 'roof-tile', 'roof-slate', 'roof-slate'][age]
    h = 0.62 + 0.12 * age
    M.box('wall-stone', 0.2, 0, 0.3, 1.8, 0.12, 1.55)
    M.box(wall, 0.2, 0.12, 0.3, 1.8, h, 1.55)
    if age < 2: frame(M, 0.2, 1.8, 0.3, 1.55, 0.12, h, n=5)
    M.gable(roof, 'gable' if age < 2 else wall, 0.2, 1.8, 0.3, 1.55, h, h + 0.6)
    door(M, 1.0, 1.55, w=0.22, h=0.4); M.lean(roof, 0.82, 1.18, 1.55, 1.72, 0.42, 0.52)
    windows_z(M, (0.45, 0.7, 1.3, 1.55), 0.3, 1.55, w=0.14, h=0.2); windows_x(M, (0.6, 0.95, 1.3), 0.3, 1.8, w=0.14, h=0.2)
    if age >= 1: windows_z(M, (0.6, 1.0, 1.4), h - 0.24, 1.55, w=0.12, h=0.14)
    if age >= 2:   # a clock tower over the door
        M.box(wall, 0.88, h - 0.1, 1.1, 1.12, h + 0.75, 1.34); M.hip(roof, 0.88, 1.12, 1.1, 1.34, h + 0.75, h + 0.98, ridge=0, over=0.04)
        M.cylinder('white', 1.0, 1.345, 0.07, h + 0.5, h + 0.51, n=12); M.box('white', 0.94, h + 0.44, 1.34, 1.06, h + 0.58, 1.35)
    if age == 3: chimney(M, 0.4, 0.9, h + 0.2, h + 0.85, w=0.14, mat='wall-brick'); chimney(M, 1.6, 0.9, h + 0.2, h + 0.85, w=0.14, mat='wall-brick')
    top = h + (0.98 if age >= 2 else 0.6)
    M.rod('dark-wood', (1.0, top, 0.92 if age < 2 else 1.22), (1.0, top + 0.4, 0.92 if age < 2 else 1.22), 0.012, n=4)
    z = 0.92 if age < 2 else 1.22
    M.box('cloth-red', 0.995, top + 0.26, z, 1.005, top + 0.4, z + 0.2)   # the flag
    for x in (0.1, 1.9): M.blob('bush', x, 0.1, 1.65, 0.1, seed=int(x * 10))
    return M


def tavern():
    M = Mesh()
    M.box('wall-stone', 0.25, 0, 0.3, 1.75, 0.3, 1.5); M.box('wall-plaster', 0.22, 0.3, 0.27, 1.78, 0.75, 1.53)
    frame(M, 0.22, 1.78, 0.27, 1.53, 0.3, 0.75, n=5)
    M.gable('roof-tile', 'gable', 0.22, 1.78, 0.27, 1.53, 0.75, 1.3)
    chimney(M, 0.5, 0.8, 0.9, 1.45, w=0.16, mat='wall-stone'); chimney(M, 1.5, 0.8, 0.9, 1.45, w=0.14, mat='wall-brick')
    door(M, 1.0, 1.5, w=0.22, h=0.32)
    windows_z(M, (0.45, 0.7, 1.3, 1.55), 0.12, 1.5, w=0.16, h=0.13); windows_z(M, (0.45, 0.75, 1.25, 1.55), 0.45, 1.53, w=0.14, h=0.16)
    windows_x(M, (0.6, 1.0, 1.3), 0.12, 1.75, w=0.16, h=0.13)
    sign(M, 1.75, 0.58, 1.3, 'yellow-flowers')
    for x, z in ((0.35, 1.68), (0.5, 1.72), (1.6, 1.7)): barrel(M, x, z)
    M.box('wood', 1.2, 0.14, 1.62, 1.5, 0.17, 1.78); [M.box('wood', x, 0, 1.64, x + 0.03, 0.14, 1.76) for x in (1.22, 1.45)]   # an outside table
    return M


def school():
    M = Mesh()
    M.box('cloth-red', 0.18, 0, 0.22, 0.82, 0.52, 0.8)
    M.gable('roof-shingle', 'white', 0.18, 0.82, 0.22, 0.8, 0.52, 0.86)
    M.box('white', 0.42, 0.78, 0.4, 0.58, 0.98, 0.56); M.hip('roof-shingle', 0.42, 0.58, 0.4, 0.56, 0.98, 1.1, ridge=0, over=0.03)   # the bell tower
    M.cylinder('bell', 0.5, 0.48, 0.035, 0.84, 0.92, n=8)
    door(M, 0.5, 0.8, h=0.32); windows_z(M, (0.28, 0.72), 0.22, 0.8, w=0.12, h=0.2); windows_x(M, (0.36, 0.64), 0.22, 0.82, w=0.12, h=0.2)
    M.box('step', 0.38, 0, 0.8, 0.62, 0.04, 0.88)
    return M


def studio():
    M = Mesh()
    M.box('wall-plaster', 0.16, 0, 0.24, 0.84, 0.5, 0.78)
    M.lean('roof-shingle', 0.13, 0.87, 0.2, 0.82, 0.5, 0.78)
    door(M, 0.32, 0.78); window(M, 0.64, 0.18, 0.78, w=0.2, h=0.24); window(M, 0.84, 0.18, 0.5, w=0.2, h=0.24, face='+x')
    for k in range(3): M.rod('dark-wood', (0.9, 0, 0.88), (0.86 + 0.04 * (k - 1), 0.36, 0.8), 0.008, n=4)   # an easel
    M.box('cloth-cream', 0.84, 0.18, 0.82, 0.86, 0.36, 0.94); M.box('blue-flowers', 0.86, 0.22, 0.84, 0.865, 0.3, 0.92)
    return M


def theater():
    M = Mesh()
    M.box('wall-stone', 0.3, 0, 0.2, 1.7, 0.85, 1.05)
    M.gable('roof-slate', 'wall-stone', 0.3, 1.7, 0.2, 1.05, 0.85, 1.25)
    M.box('dark-wood', 0.4, 0, 1.05, 1.6, 0.2, 1.55)   # the stage, out front
    M.box('cloth-red', 0.4, 0.2, 1.04, 0.5, 0.75, 1.1); M.box('cloth-red', 1.5, 0.2, 1.04, 1.6, 0.75, 1.1)   # curtains
    M.box('cloth-red', 0.4, 0.68, 1.04, 1.6, 0.78, 1.1)
    for x in (0.45, 1.55): M.rod('white', (x, 0.2, 1.52), (x, 0.7, 1.52), 0.02)
    M.lean('cloth-red', 0.4, 1.6, 1.05, 1.6, 0.68, 0.76)
    for x in (0.55, 1.45): M.box('lamp', x - 0.025, 0.2, 1.5, x + 0.025, 0.26, 1.55)
    for k in range(3): M.box('wood', 0.5 + k * 0.4, 0, 1.7, 0.8 + k * 0.4, 0.08, 1.78)   # benches for the audience
    windows_x(M, (0.45, 0.8), 0.4, 1.7, w=0.12, h=0.22)
    return M


def church():
    M = Mesh()
    M.box('wall-stone', 0.25, 0, 0.6, 1.4, 0.68, 1.5)
    M.gable('roof-slate', 'wall-stone', 0.25, 1.4, 0.6, 1.5, 0.68, 1.15)
    M.box('wall-stone', 1.4, 0, 0.75, 1.82, 1.3, 1.17)   # the tower
    M.box('white', 1.38, 1.26, 0.73, 1.84, 1.32, 1.19)
    M.hip('roof-slate', 1.4, 1.82, 0.75, 1.17, 1.32, 1.9, ridge=0, over=0.04)
    M.rod('bell', (1.61, 1.9, 0.96), (1.61, 2.04, 0.96), 0.01, n=4); M.box('bell', 1.56, 1.98, 0.955, 1.66, 2.0, 0.965)
    window(M, 1.82, 1.0, 0.96, w=0.12, h=0.16, face='+x'); window(M, 1.61, 1.0, 1.17, w=0.12, h=0.16)
    door(M, 1.61, 1.17, w=0.18, h=0.38)
    for x in (0.45, 0.75, 1.05): window(M, x, 0.25, 1.5, w=0.1, h=0.3)
    M.box('step', 1.48, 0, 1.17, 1.74, 0.05, 1.3)
    for x in (0.2, 0.32): M.box('rock', x, 0, 1.75, x + 0.06, 0.12, 1.79)   # little stones in the churchyard
    return M


def library():
    M = Mesh()
    M.box('wall-brick', 0.25, 0, 0.3, 1.75, 0.8, 1.45)
    M.box('white', 0.23, 0.78, 0.28, 1.77, 0.83, 1.47)
    M.hip('roof-slate', 0.25, 1.75, 0.3, 1.45, 0.83, 1.2, ridge=0.6)
    for x in (0.75, 1.25): M.rod('white', (x, 0, 1.6), (x, 0.7, 1.6), 0.035, n=8)
    M.box('white', 0.68, 0.7, 1.45, 1.32, 0.76, 1.66); M.lean('roof-slate', 0.66, 1.34, 1.45, 1.68, 0.76, 0.86)   # the portico
    door(M, 1.0, 1.45, w=0.2, h=0.36); M.box('step', 0.66, 0, 1.45, 1.34, 0.05, 1.72)
    windows_z(M, (0.45, 0.6, 1.4, 1.55), 0.18, 1.45, w=0.1, h=0.4); windows_x(M, (0.55, 0.85, 1.15), 0.18, 1.75, w=0.12, h=0.4)
    return M


def playground():
    M = Mesh()
    M.box('sand', 0.2, 0, 1.2, 0.8, 0.03, 1.8); M.box('wood', 0.18, 0, 1.18, 0.82, 0.05, 1.2); M.box('wood', 0.18, 0, 1.8, 0.82, 0.05, 1.82)
    for x in (1.1, 1.8):   # swings
        M.rod('wood', (x, 0, 0.3), (x, 0.6, 0.45), 0.02); M.rod('wood', (x, 0, 0.6), (x, 0.6, 0.45), 0.02)
    M.rod('wood', (1.1, 0.6, 0.45), (1.8, 0.6, 0.45), 0.02)
    for x in (1.3, 1.6):
        M.rod('iron', (x, 0.6, 0.45), (x, 0.18, 0.45), 0.004, n=3); M.box('wood', x - 0.06, 0.16, 0.42, x + 0.06, 0.18, 0.48)
    M.rod('cloth-red', (0.3, 0.1, 0.6), (0.9, 0.28, 0.6), 0.03, n=5); M.box('wood', 0.56, 0, 0.56, 0.64, 0.2, 0.64)   # a seesaw
    M.blob('leaves', 1.6, 0.4, 1.5, 0.25, seed=3); M.cylinder('trunk', 1.6, 1.5, 0.04, 0, 0.3, n=6)
    return M


def monument():
    M = Mesh()
    M.box('rock', 0.4, 0, 0.4, 1.6, 0.12, 1.6); M.box('rock', 0.55, 0.12, 0.55, 1.45, 0.24, 1.45)
    M.box('marble', 0.8, 0.24, 0.8, 1.2, 0.44, 1.2)
    M.rod('marble', (1.0, 0.44, 1.0), (1.0, 1.7, 1.0), 0.12, n=4, taper=0.55)   # an obelisk
    M.cone('gold', 1.0, 1.0, 0.07, 1.7, 1.82, n=4)
    for (x, z) in ((0.5, 1.5), (1.5, 1.5), (1.5, 0.5)): M.blob('pink-flowers', x, 0.16, z, 0.08, seed=int(x * 10 + z))
    return M


def site(w, h):
    """A building site: a stone footing, stacked materials and a scaffold of poles."""
    M = Mesh()
    M.box('rock', 0.12, 0, 0.12, w - 0.12, 0.06, h - 0.12)
    for (x, z) in ((0.15, 0.15), (w - 0.15, 0.15), (w - 0.15, h - 0.15), (0.15, h - 0.15)): M.rod('wood', (x, 0, z), (x, 0.55, z), 0.018, n=5)
    M.rod('wood', (0.15, 0.5, h - 0.15), (w - 0.15, 0.5, h - 0.15), 0.014, n=4); M.rod('wood', (w - 0.15, 0.5, 0.15), (w - 0.15, 0.5, h - 0.15), 0.014, n=4)
    M.rod('wood', (0.15, 0.06, h - 0.15), (w - 0.15, 0.5, h - 0.15), 0.01, n=4)
    for k in range(3): M.box('plank', 0.3, 0.06 + k * 0.03, h / 2 - 0.15, 0.3 + min(0.7, w - 0.6), 0.09 + k * 0.03, h / 2 + 0.05)
    M.box('rock', w - 0.45, 0.06, 0.3, w - 0.3, 0.16, 0.45)
    return M


MODELS = [
    *[(f'building/tc/{a}', (lambda a=a: tc(a)), {'tiles': [2, 2]}) for a in range(4)],
    ('building/tavern', tavern, {'tiles': [2, 2]}),
    ('building/school', school, {'tiles': [1, 1]}),
    ('building/studio', studio, {'tiles': [1, 1]}),
    ('building/theater', theater, {'tiles': [2, 2]}),
    ('building/church', church, {'tiles': [2, 2]}),
    ('building/library', library, {'tiles': [2, 2]}),
    ('building/playground', playground, {'tiles': [2, 2]}),
    ('building/monument', monument, {'tiles': [2, 2]}),
    ('site/1x1', lambda: site(1, 1), {'tiles': [1, 1]}),
    ('site/2x1', lambda: site(2, 1), {'tiles': [2, 1]}),
    ('site/2x2', lambda: site(2, 2), {'tiles': [2, 2]}),
]
