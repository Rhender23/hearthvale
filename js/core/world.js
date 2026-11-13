// The land: terrain, resource nodes, saplings and building occupancy.
import { N, NODE, NODE_INFO } from './config.js';
import { hash, valueNoise as vn, makeRng } from './rng.js';

export const WATER = 1, SAND = 2, GRASS = 0;
export const C = N >> 1;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
export const idx = (x, y) => y * N + x;
export const tx = i => i % N, ty = i => (i / N) | 0;
export const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// gen 1: the original generator (big lakes). Seed 0 reproduces the very first map exactly.
// gen 2: mostly land with scattered ponds and small lakes, clay pits on their banks.
export function createWorld(seed = 0, gen = 1) {
  const ox = seed ? (seed % 997) * 13.37 : 0, oy = seed ? (Math.floor(seed / 997) % 997) * 7.71 + seed % 113 : 0;
  const h = (x, y) => hash(x + ox, y + oy), n = (x, y, s) => vn(x + ox, y + oy, s);
  const T = new Uint8Array(N * N), R = new Uint8Array(N * N), A = new Int16Array(N * N);
  const G = new Float32Array(N * N), E = new Float32Array(N * N), occ = new Int16Array(N * N), wk = new Uint8Array(N * N), F = new Float32Array(N * N), road = new Uint8Array(N * N);
  if (gen === 1) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - C, y - C), e = n(x, y, 8) * 0.65 + n(x + 9, y + 4, 3.5) * 0.35;
    T[idx(x, y)] = (e < 0.36 && d > 7) ? WATER : GRASS;
  } else {
    // Ponds: 5-7 blobs of radius 1.4-3 plus one small lake of radius 3.5-4.5, never within 9 tiles of the center.
    const rng = makeRng(seed * 31 + 7), blobs = [];
    const count = 5 + rng.int(3);
    for (let tries = 0; blobs.length < count + 1 && tries < 400; tries++) {
      const big = blobs.length === 0, r = big ? 3.5 + rng() : 1.4 + rng() * 1.6, x = 3 + rng() * (N - 6), y = 3 + rng() * (N - 6);
      if (Math.hypot(x - C, y - C) < 9 + r || blobs.some(b => Math.hypot(b.x - x, b.y - y) < b.r + r + 3)) continue;
      blobs.push({ x, y, r });
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const wob = (n(x * 1.7, y * 1.7, 2.5) - 0.5) * 1.6;
      if (blobs.some(b => Math.hypot(x - b.x, y - b.y) < b.r + wob)) T[idx(x, y)] = WATER;
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    if (T[i] === GRASS && DIRS4.some(([a, b]) => inMap(x + a, y + b) && T[idx(x + a, y + b)] === WATER)) T[i] = SAND;
  }
  const put = (i, k) => { R[i] = k; A[i] = NODE_INFO[k].amt; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y), d = Math.hypot(x - C, y - C);
    if (T[i] === GRASS && d > 4.5 && n(x + 40, y + 17, 4.5) > 0.57 && h(x, y) > 0.4) put(i, NODE.TREE);
    else if (T[i] === GRASS && d > 5.5 && n(x + 90, y + 30, 5) > 0.8 && h(x + 3, y) > 0.6) put(i, NODE.STONE);
    else if (T[i] === GRASS && d > 6 && n(x + 13, y + 70, 6) > 0.82 && h(x, y + 5) > 0.7) put(i, NODE.GOLD);
    else if (T[i] === GRASS && d > 3.5 && n(x + 70, y + 90, 4) > 0.7 && h(x + 7, y) > 0.45) put(i, NODE.BERRY);
    else if (T[i] === WATER && h(x, y) > (gen === 1 ? 0.6 : 0.45) && DIRS4.some(([a, b]) => inMap(x + a, y + b) && T[idx(x + a, y + b)] === SAND)) put(i, NODE.FISH);
    else if (gen > 1 && T[i] === SAND && h(x + 11, y + 3) > 0.85) put(i, NODE.CLAY);
  }
  if (gen > 1) { // at least 6 clay pits on the pond banks
    let c = 0; for (let i = 0; i < N * N; i++) if (R[i] === NODE.CLAY && A[i] > 0) c++;
    for (let i = 0; i < N * N && c < 6; i++) if (T[i] === SAND && A[i] <= 0 && h(i % N + 5, (i / N | 0) + 9) > 0.3) { put(i, NODE.CLAY); c++; }
  }
  // Guarantee a small amount of stone and gold so every age is reachable.
  for (const [k, want, ox2, oy2] of [[NODE.STONE, 8, 9, 0], [NODE.GOLD, 5, -8, 7]]) {
    let c = 0; for (let i = 0; i < N * N; i++) if (R[i] === k && A[i] > 0) c++;
    for (let r = 7; r < N && c < want; r++) for (let t = 0; t < 40 && c < want; t++) {
      const x = Math.round(C + ox2 + Math.cos(t) * r * 0.3), y = Math.round(C + oy2 + Math.sin(t) * r * 0.3), i = idx(x, y);
      if (inMap(x, y) && T[i] === GRASS && A[i] <= 0 && Math.hypot(x - C, y - C) > 6) { put(i, k); c++; }
    }
  }
  const w = { seed, gen, T, R, A, G, E, F, occ, wk, road, roadEnd: null, tc: { x: C, y: C }, fire: null, hash: h };
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) occ[idx(C + i, C + j)] = -1; // reserve for the town center
  for (const [dx, dy] of [[-2, 3], [3, 3], [-2, -1], [3, -1], [0, 4], [-3, 2]]) {
    if (walkable(w, C + dx, C + dy)) { w.fire = { x: C + dx, y: C + dy }; break; }
  }
  if (!w.fire) w.fire = { x: C - 1, y: C + 3 };
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) occ[idx(C + i, C + j)] = 0;
  return w;
}

export const hasNode = (w, i) => w.A[i] > 0 && w.R[i] > 0;
export const nodeKind = (w, i) => (w.A[i] > 0 ? w.R[i] : 0);
export function walkable(w, x, y) {
  if (!inMap(x, y)) return false;
  const i = idx(x, y);
  return w.T[i] !== WATER && w.A[i] <= 0 && (w.occ[i] === 0 || w.wk[i] === 1);
}
// A walkable tile next to fresh water (where villagers can fetch water).
export function isShore(w, x, y) {
  if (!walkable(w, x, y)) return false;
  for (const [dx, dy] of DIRS4) { const a = x + dx, b = y + dy; if (inMap(a, b) && w.T[idx(a, b)] === WATER) return true; }
  return false;
}
export const isFire = (w, x, y) => w.fire && w.fire.x === x && w.fire.y === y;
// Open grass with nothing on it (used for planting, regrowth and placing buildings).
export function isOpen(w, x, y) {
  if (!inMap(x, y)) return false;
  const i = idx(x, y);
  return w.T[i] === GRASS && w.A[i] <= 0 && w.G[i] === 0 && w.occ[i] === 0 && !w.road[i] && !isFire(w, x, y);
}
export function countNear(w, x, y, kind, r) {
  let c = 0;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const a = x + i, b = y + j;
    if (inMap(a, b) && nodeKind(w, idx(a, b)) === kind) c++;
  }
  return c;
}
export function buildingNear(w, x, y, r) {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const a = x + i, b = y + j;
    if (inMap(a, b) && w.occ[idx(a, b)] !== 0) return true;
  }
  return false;
}
// Tile next to (Chebyshev distance 1) the given rectangle, and not inside it.
export const besideRect = (x, y, rx, ry, s) => x >= rx - 1 && x <= rx + s && y >= ry - 1 && y <= ry + s && !(x >= rx && x < rx + s && y >= ry && y < ry + s);

// The road: a dirt track from the map edge into the village. Nothing grows or is built on it; walking on it is quicker.
// Laid along the shortest dry route (trees are cleared, water is avoided), from the tile beside (fx, fy) to the nearest edge.
export function layRoad(w, fx, fy) {
  const passable = (x, y) => inMap(x, y) && w.T[idx(x, y)] !== WATER && (w.occ[idx(x, y)] === 0 || w.wk[idx(x, y)] === 1);
  const par = new Int32Array(N * N).fill(-2), q = [];
  for (const [dx, dy] of DIRS4) { const x = fx + dx, y = fy + dy; if (passable(x, y)) { const i = idx(x, y); par[i] = -1; q.push(i); } }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % N, cy = (c / N) | 0;
    if (cx === 0 || cy === 0 || cx === N - 1 || cy === N - 1) {
      for (let n = c; n !== -1; n = par[n]) { w.road[n] = 1; w.A[n] = 0; w.R[n] = 0; w.G[n] = 0; }
      w.roadEnd = [cx, cy];
      return true;
    }
    for (const [dx, dy] of DIRS4) { const x = cx + dx, y = cy + dy, i = idx(x, y); if (passable(x, y) && par[i] === -2) { par[i] = c; q.push(i); } }
  }
  return false;
}
