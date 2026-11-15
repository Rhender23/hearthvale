"""Shared pieces for Hearthvale's 3D models: a mesh builder, the palette and a .glb writer. See village.py."""
import json, os, struct
import numpy as np

class Mesh:
    def __init__(self):
        self.parts = {}   # material name -> list of triangles (3x3 arrays)

    def tri(self, mat, a, b, c):
        self.parts.setdefault(mat, []).append(np.array([a, b, c], dtype=np.float32))

    def quad(self, mat, a, b, c, d):   # counter-clockwise seen from outside
        self.tri(mat, a, b, c); self.tri(mat, a, c, d)

    def box(self, mat, x0, y0, z0, x1, y1, z1, top=True, bottom=False):
        p = lambda x, y, z: (x, y, z)
        self.quad(mat, p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1))   # +z
        self.quad(mat, p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0))   # -z
        self.quad(mat, p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1))   # +x
        self.quad(mat, p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0))   # -x
        if top: self.quad(mat, p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0))
        if bottom: self.quad(mat, p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1))

    def gable(self, roof, gable, x0, x1, z0, z1, y0, y1, over=0.08):
        """A pitched roof whose ridge runs along x (gable ends face -x and +x)."""
        zm = (z0 + z1) / 2
        X0, X1, Z0, Z1 = x0 - over, x1 + over, z0 - over, z1 + over
        self.quad(roof, (X0, y0, Z1), (X1, y0, Z1), (X1, y1, zm), (X0, y1, zm))      # front slope
        self.quad(roof, (X1, y0, Z0), (X0, y0, Z0), (X0, y1, zm), (X1, y1, zm))      # back slope
        self.tri(gable, (x1, y0, z1), (x1, y0, z0), (x1, y1, zm))                    # gable ends
        self.tri(gable, (x0, y0, z0), (x0, y0, z1), (x0, y1, zm))
        # roof thickness at the eaves
        t = 0.04
        self.quad(roof, (X0, y0 - t, Z1), (X1, y0 - t, Z1), (X1, y0, Z1), (X0, y0, Z1))
        self.quad(roof, (X1, y0 - t, Z1), (X1, y0 - t, Z0), (X1, y0, Z0), (X1, y0, Z1))
        self.quad(roof, (X0, y0 - t, Z0), (X0, y0 - t, Z1), (X0, y0, Z1), (X0, y0, Z0))

    def cone(self, mat, cx, cz, r, y0, y1, n=10):
        for i in range(n):
            a, b = 2 * np.pi * i / n, 2 * np.pi * (i + 1) / n
            p0 = (cx + r * np.cos(a), y0, cz + r * np.sin(a)); p1 = (cx + r * np.cos(b), y0, cz + r * np.sin(b))
            self.tri(mat, p1, p0, (cx, y1, cz))

    def cylinder(self, mat, cx, cz, r, y0, y1, n=8, top=True):
        for i in range(n):
            a, b = 2 * np.pi * i / n, 2 * np.pi * (i + 1) / n
            p0, p1 = (cx + r * np.cos(a), cz + r * np.sin(a)), (cx + r * np.cos(b), cz + r * np.sin(b))
            self.quad(mat, (p1[0], y0, p1[1]), (p0[0], y0, p0[1]), (p0[0], y1, p0[1]), (p1[0], y1, p1[1]))
            if top: self.tri(mat, (p0[0], y1, p0[1]), (cx, y1, cz), (p1[0], y1, p1[1]))

    def rod(self, mat, a, b, r, n=6, taper=1.0, caps=True):
        """A round post or log from point a to point b (any direction)."""
        a, b = np.array(a, float), np.array(b, float); d = b - a
        ref = np.array([0, 0, 1.0]) if abs(d[2]) < 0.9 * np.linalg.norm(d) else np.array([1.0, 0, 0])
        u = np.cross(d, ref); u /= np.linalg.norm(u); w = np.cross(d, u); w /= np.linalg.norm(w)
        ring = lambda c, rr, t: c + rr * (np.cos(t) * u + np.sin(t) * w)
        for i in range(n):
            t0, t1 = 2 * np.pi * i / n, 2 * np.pi * (i + 1) / n
            self.quad(mat, ring(a, r, t1), ring(a, r, t0), ring(b, r * taper, t0), ring(b, r * taper, t1))
            if caps:
                self.tri(mat, ring(b, r * taper, t0), b, ring(b, r * taper, t1))
                self.tri(mat, ring(a, r, t1), a, ring(a, r, t0))

    def hip(self, mat, x0, x1, z0, z1, y0, y1, over=0.06, ridge=0.5):
        """A hipped roof: four slopes; the ridge runs along x for `ridge` of the length (0 = a pyramid)."""
        X0, X1, Z0, Z1 = x0 - over, x1 + over, z0 - over, z1 + over
        zm, xm, hl = (z0 + z1) / 2, (x0 + x1) / 2, (x1 - x0) * ridge / 2
        r0, r1 = (xm - hl, y1, zm), (xm + hl, y1, zm)
        self.quad(mat, (X0, y0, Z1), (X1, y0, Z1), r1, r0)
        self.quad(mat, (X1, y0, Z0), (X0, y0, Z0), r0, r1)
        self.tri(mat, (X1, y0, Z1), (X1, y0, Z0), r1)
        self.tri(mat, (X0, y0, Z0), (X0, y0, Z1), r0)

    def lean(self, mat, x0, x1, z0, z1, ylo, yhi, t=0.03):
        """A sloping board (an awning or a lean-to roof): high at z0, low at z1."""
        self.quad(mat, (x0, ylo, z1), (x1, ylo, z1), (x1, yhi, z0), (x0, yhi, z0))
        self.quad(mat, (x1, ylo - t, z1), (x0, ylo - t, z1), (x0, yhi - t, z0), (x1, yhi - t, z0))
        self.quad(mat, (x0, ylo - t, z1), (x1, ylo - t, z1), (x1, ylo, z1), (x0, ylo, z1))

    def fence(self, mat, pts, h=0.16, post=0.02, rails=2, closed=True):
        """Posts at each corner and along the sides, with rails between them."""
        P = [np.array(p, float) for p in pts] + ([np.array(pts[0], float)] if closed else [])
        for p, q in zip(P, P[1:]):
            L = np.linalg.norm(q - p); n = max(1, int(L / 0.22))
            for i in range(n + 1):
                c = p + (q - p) * i / n
                self.box(mat, c[0] - post, 0, c[1] - post, c[0] + post, h, c[1] + post)
            for k in range(rails):
                y = h * (0.45 + 0.45 * k / max(1, rails - 1))
                self.rod(mat, (p[0], y, p[1]), (q[0], y, q[1]), post * 0.6, n=4, caps=False)

    def blob(self, mat, cx, cy, cz, r, seed=0, squash=0.85):
        """A lumpy low-poly ball (an icosphere, nudged): tree crowns and bushes."""
        t = (1 + 5 ** 0.5) / 2
        v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
        f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
             (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
        v = [np.array(p) / np.linalg.norm(p) for p in v]
        mid = {}
        def m(i, j):
            k = (min(i, j), max(i, j))
            if k not in mid: v.append((v[i] + v[j]) / np.linalg.norm(v[i] + v[j])); mid[k] = len(v) - 1
            return mid[k]
        f2 = []
        for a, b, c in f:
            ab, bc, ca = m(a, b), m(b, c), m(c, a)
            f2 += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        rng = np.random.default_rng(seed)
        jit = 1 + rng.uniform(-0.12, 0.12, len(v))
        P = [np.array([cx + r * p[0] * j, cy + r * p[1] * j * squash, cz + r * p[2] * j]) for p, j in zip(v, jit)]
        for a, b, c in f2: self.tri(mat, P[a], P[b], P[c])


MATS = {   # base colour (sRGB), emissive (sRGB) — one cozy palette for every model
    'wall-plaster': ((0.93, 0.87, 0.74), None), 'wall-timber': ((0.55, 0.38, 0.24), None), 'wall-stone': ((0.70, 0.67, 0.62), None),
    'wall-log': ((0.62, 0.44, 0.27), None), 'beam': ((0.42, 0.28, 0.17), None), 'roof-thatch': ((0.80, 0.66, 0.38), None),
    'roof-tile': ((0.72, 0.36, 0.26), None), 'roof-slate': ((0.42, 0.45, 0.52), None), 'gable': ((0.88, 0.80, 0.65), None),
    'door': ((0.48, 0.30, 0.18), None), 'window': ((0.30, 0.36, 0.45), (1.0, 0.78, 0.42)), 'sill': ((0.95, 0.93, 0.88), None),
    'chimney': ((0.66, 0.40, 0.32), None), 'step': ((0.66, 0.63, 0.58), None), 'flowers': ((0.91, 0.45, 0.55), None),
    'trunk': ((0.47, 0.33, 0.22), None), 'leaves': ((0.42, 0.62, 0.30), None), 'bush': ((0.36, 0.55, 0.28), None),
    'wall-brick': ((0.70, 0.40, 0.32), None), 'roof-shingle': ((0.52, 0.40, 0.30), None), 'wood': ((0.62, 0.45, 0.29), None),
    'plank': ((0.74, 0.58, 0.38), None), 'dark-wood': ((0.36, 0.25, 0.16), None), 'iron': ((0.32, 0.32, 0.34), None),
    'rock': ((0.62, 0.60, 0.56), None), 'rock-dark': ((0.46, 0.45, 0.43), None), 'gold': ((0.95, 0.76, 0.25), None),
    'clay': ((0.72, 0.47, 0.32), None), 'mud': ((0.50, 0.38, 0.26), None), 'water': ((0.42, 0.66, 0.80), None),
    'hay': ((0.88, 0.76, 0.42), None), 'cloth-red': ((0.80, 0.33, 0.30), None), 'cloth-blue': ((0.36, 0.52, 0.72), None),
    'cloth-cream': ((0.95, 0.90, 0.78), None), 'cloth-green': ((0.42, 0.62, 0.40), None), 'grass': ((0.55, 0.72, 0.40), None),
    'soil': ((0.55, 0.40, 0.27), None), 'fence': ((0.70, 0.56, 0.38), None), 'bell': ((0.82, 0.66, 0.30), None),
    'berries': ((0.82, 0.18, 0.24), None), 'pink-flowers': ((0.95, 0.60, 0.70), None), 'yellow-flowers': ((0.98, 0.84, 0.36), None),
    'blue-flowers': ((0.60, 0.62, 0.95), None), 'white': ((0.96, 0.95, 0.92), None), 'marble': ((0.90, 0.88, 0.84), None),
    'glow': ((0.95, 0.85, 0.55), (1.0, 0.82, 0.45)), 'lamp': ((0.95, 0.85, 0.55), (1.0, 0.76, 0.40)), 'pottery': ((0.78, 0.48, 0.32), None),
    'barrel': ((0.58, 0.40, 0.24), None), 'ember': ((0.55, 0.30, 0.18), (1.0, 0.45, 0.15)), 'sand': ((0.92, 0.84, 0.64), None),
    'leaves-dark': ((0.30, 0.48, 0.24), None), 'pine': ((0.24, 0.42, 0.28), None), 'wax': ((0.97, 0.90, 0.70), None),
    'hive': ((0.90, 0.74, 0.40), None),
}


def window(M, x, y, z, w=0.16, h=0.18, face='+z'):
    d = 0.012
    if face == '+z':
        M.quad('window', (x - w / 2, y, z + d), (x + w / 2, y, z + d), (x + w / 2, y + h, z + d), (x - w / 2, y + h, z + d))
        M.box('sill', x - w / 2 - 0.02, y - 0.03, z, x + w / 2 + 0.02, y, z + 0.04)
    else:   # +x
        M.quad('window', (x + d, y, z + w / 2), (x + d, y, z - w / 2), (x + d, y + h, z - w / 2), (x + d, y + h, z + w / 2))
        M.box('sill', x, y - 0.03, z - w / 2 - 0.02, x + 0.04, y, z + w / 2 + 0.02)


def door(M, x, z, w=0.16, h=0.3):
    d = 0.012
    M.quad('door', (x - w / 2, 0.03, z + d), (x + w / 2, 0.03, z + d), (x + w / 2, h, z + d), (x - w / 2, h, z + d))
    M.box('step', x - w / 2 - 0.03, 0, z, x + w / 2 + 0.03, 0.03, z + 0.07)


# ---------------------------------------------------------------- .glb writer (flat shaded, one primitive per material)
def lin(c): return [((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c]


def write_glb(M, path, name):
    mats, prims, bufs, views, accs = [], [], [], [], []
    off = 0
    def add(arr, target):
        nonlocal off
        b = arr.tobytes(); pad = (-len(b)) % 4
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b), 'target': target})
        bufs.append(b + b'\0' * pad); off += len(b) + pad
        return len(views) - 1
    for mi, (mat, tris) in enumerate(M.parts.items()):
        T = np.stack(tris)                      # (n, 3, 3)
        n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
        pos = T.reshape(-1, 3).astype(np.float32); nor = np.repeat(n, 3, axis=0).astype(np.float32)
        vp, vn = add(pos, 34962), add(nor, 34962)
        accs.append({'bufferView': vp, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3', 'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()})
        accs.append({'bufferView': vn, 'componentType': 5126, 'count': len(nor), 'type': 'VEC3'})
        base, emis = MATS[mat]
        m = {'name': mat, 'pbrMetallicRoughness': {'baseColorFactor': lin(base) + [1], 'metallicFactor': 0, 'roughnessFactor': 1}, 'doubleSided': True}
        if emis: m['emissiveFactor'] = lin(emis)
        mats.append(m)
        prims.append({'attributes': {'POSITION': len(accs) - 2, 'NORMAL': len(accs) - 1}, 'material': mi})
    gl = {'asset': {'version': '2.0', 'generator': 'hearthvale make-samples'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
          'nodes': [{'mesh': 0, 'name': name}], 'meshes': [{'name': name, 'primitives': prims}], 'materials': mats,
          'buffers': [{'byteLength': off}], 'bufferViews': views, 'accessors': accs}
    js = json.dumps(gl, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
    binb = b''.join(bufs)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(binb), 0x004E4942)); f.write(binb)


