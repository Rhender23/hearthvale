// Drawing paths as a line: press on one tile and drag to another (or tap one end, then the other). The tiles between
// are joined by straight steps (no diagonals, so the track reads as one path), previewed with their total cost, and
// built together with ✓, or dropped with ✗.
import { BUILD } from '../core/config.js';

// Tiles from a to b, one orthogonal step at a time, spread evenly like a drawn line.
export function lineTiles(a, b) {
  const out = [[a[0], a[1]]];
  let [x, y] = a; const dx = Math.abs(b[0] - x), dy = Math.abs(b[1] - y), sx = Math.sign(b[0] - x), sy = Math.sign(b[1] - y);
  let ex = 0, ey = 0;
  for (let n = 0; n < dx + dy && n < 400; n++) {
    // step along whichever axis is furthest behind its share of the line
    const px = ex < dx ? (ex + 0.5) / dx : Infinity, py = ey < dy ? (ey + 0.5) / dy : Infinity;
    if (px <= py) { x += sx; ex++; } else { y += sy; ey++; }
    out.push([x, y]);
  }
  return out;
}

// The plan for a drawn line: which tiles can take a path, and what those cost all together.
export function linePlan(G, line, canPlace) {
  if (!line) return null;
  const tiles = lineTiles(line.a, line.b || line.a).map(([x, y]) => ({ x, y, ok: canPlace(x, y) }));
  const n = tiles.filter(t => t.ok).length, cost = {};
  for (const [r, c] of Object.entries(BUILD.path.cost || {})) cost[r] = c * n;
  return { tiles, n, cost };
}
