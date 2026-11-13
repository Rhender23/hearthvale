// Breadth-first pathfinding on the 8-connected tile grid.
// Buffers are reused between calls so pathing never allocates per tile.
import { N } from './config.js';
import { walkable, DIRS8, inMap, WATER } from './world.js';

const par = new Int32Array(N * N), seen = new Uint32Array(N * N), dist = new Uint16Array(N * N), q = new Int32Array(N * N);
let stamp = 0;

function step(w, cx, cy, dx, dy) {
  const nx = cx + dx, ny = cy + dy;
  if (!walkable(w, nx, ny)) return false;
  if (dx && dy && (!walkable(w, cx + dx, cy) || !walkable(w, cx, cy + dy))) return false; // no corner cutting
  return true;
}
function build(end) {
  const p = [];
  let n = end;
  while (par[n] !== -1) { p.push([n % N, (n / N) | 0]); n = par[n]; }
  return p.reverse();
}

// Shortest path from (sx,sy) to the first tile where goal(x,y,i) is true.
// Returns an array of [x,y] steps (empty if already there) or null.
export function bfs(w, sx, sy, goal) {
  stamp++;
  const s = sy * N + sx;
  let head = 0, tail = 0;
  q[tail++] = s; seen[s] = stamp; par[s] = -1;
  while (head < tail) {
    const c = q[head++], cx = c % N, cy = (c / N) | 0;
    if (goal(cx, cy, c)) return build(c);
    for (const [dx, dy] of DIRS8) {
      if (!step(w, cx, cy, dx, dy)) continue;
      const ni = (cy + dy) * N + cx + dx;
      if (seen[ni] === stamp) continue;
      seen[ni] = stamp; par[ni] = c; q[tail++] = ni;
    }
  }
  return null;
}

// One sweep that finds the nearest tile for many categories at once.
// `probe(x,y,i)` returns a list of [category, target] pairs available from that tile.
// Result: { category: { d, target, path } } for the first (closest) hit of each category.
export function scan(w, sx, sy, probe, maxDist = 1e9) {
  stamp++;
  const s = sy * N + sx, out = {};
  let head = 0, tail = 0;
  q[tail++] = s; seen[s] = stamp; par[s] = -1; dist[s] = 0;
  const hits = [];
  while (head < tail) {
    const c = q[head++], cx = c % N, cy = (c / N) | 0;
    if (dist[c] > maxDist) break;
    const found = probe(cx, cy, c);
    if (found) for (const [cat, target] of found) if (!out[cat]) { out[cat] = { d: dist[c], target, end: c }; hits.push(cat); }
    for (const [dx, dy] of DIRS8) {
      if (!step(w, cx, cy, dx, dy)) continue;
      const ni = (cy + dy) * N + cx + dx;
      if (seen[ni] === stamp) continue;
      seen[ni] = stamp; par[ni] = c; dist[ni] = dist[c] + 1; q[tail++] = ni;
    }
  }
  for (const cat of hits) out[cat].path = build(out[cat].end);
  return out;
}

// Nearest map-edge tile reachable from (x, y), or null. Used by visitors and newcomers to find a way in.
export function reachableEdge(w, x, y) {
  const p = bfs(w, x, y, (a, b) => a === 0 || b === 0 || a === N - 1 || b === N - 1);
  return p ? (p.length ? p[p.length - 1] : [x, y]) : null;
}
// A walkable tile right beside a building (start point for searches from it).
export function besideTile(w, b, ok = walkable) {
  for (let y = b.y - 1; y <= b.y + b.s; y++) for (let x = b.x - 1; x <= b.x + b.s; x++) {
    const inside = x >= b.x && x < b.x + b.s && y >= b.y && y < b.y + b.s;
    if (!inside && ok(w, x, y)) return [x, y];
  }
  return null;
}

// Visitors (the caravan, newcomers) follow old roads through the woods: trees and bushes do not block them,
// only water and buildings do.
export const visitorPassable = (w, x, y) => { if (!inMap(x, y)) return false; const i = y * N + x; return w.T[i] !== WATER && (w.occ[i] === 0 || w.wk[i] === 1); };
export function bfsVisitor(w, sx, sy, goal) {
  stamp++;
  const s = sy * N + sx;
  let head = 0, tail = 0;
  q[tail++] = s; seen[s] = stamp; par[s] = -1;
  while (head < tail) {
    const c = q[head++], cx = c % N, cy = (c / N) | 0;
    if (goal(cx, cy, c)) return build(c);
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx, ny = cy + dy;
      if (!visitorPassable(w, nx, ny) || (dx && dy && (!visitorPassable(w, cx + dx, cy) || !visitorPassable(w, cx, cy + dy)))) continue;
      const ni = ny * N + nx;
      if (seen[ni] === stamp) continue;
      seen[ni] = stamp; par[ni] = c; q[tail++] = ni;
    }
  }
  return null;
}
export function visitorEdge(w, x, y) {
  const p = bfsVisitor(w, x, y, (a, b) => a === 0 || b === 0 || a === N - 1 || b === N - 1);
  return p ? (p.length ? p[p.length - 1] : [x, y]) : null;
}
