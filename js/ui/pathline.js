// Drawing paths as a line: press on one tile and drag to another (or tap one end, then the other). The line runs in any
// of eight directions: straight, diagonal, or a straight stretch then a diagonal one, so it bends cleanly instead of
// zig-zagging. It is previewed with its total cost, and built together with ✓, or dropped with ✕.
// Where the line crosses a path of another kind, that stretch is re-laid in the new kind; the same kind is left alone.
import { PATH_KINDS, TIERS } from '../core/config.js';
import { idx, inMap } from '../core/world.js';

// Tiles from a to b: diagonal steps for the shared part of the run, straight steps for the rest, with the straight part
// first when that leaves the end diagonal (like a road leaving town and then cutting across).
export function lineTiles(a, b) {
  const out = [[a[0], a[1]]];
  let [x, y] = a; const dx = b[0] - x, dy = b[1] - y, sx = Math.sign(dx), sy = Math.sign(dy);
  const diag = Math.min(Math.abs(dx), Math.abs(dy)), straight = Math.max(Math.abs(dx), Math.abs(dy)) - diag, alongX = Math.abs(dx) > Math.abs(dy);
  for (let n = 0; n < straight && out.length < 400; n++) { if (alongX) x += sx; else y += sy; out.push([x, y]); }
  for (let n = 0; n < diag && out.length < 400; n++) { x += sx; y += sy; out.push([x, y]); }
  return out;
}

export const kindOf = k => PATH_KINDS.find(p => p[0] === k) || PATH_KINDS[0];
export const KIND_NAME = { dirt: 'Dirt', gravel: 'Gravel', stone: 'Stone', brick: 'Brick', tile: 'Tile' };

// The plan for a drawn line: which tiles take a new path, which re-lay one, and what it all costs.
export function linePlan(G, line, canPlace, kind = 'dirt') {
  if (!line) return null;
  const [, lvl, each] = kindOf(kind);
  const pathAt = (x, y) => { if (!inMap(x, y)) return null; const id = G.w.occ[idx(x, y)], o = id > 0 && G.bmap.get(id); return o && o.k === 'path' ? o : null; };
  const tiles = lineTiles(line.a, line.b || line.a).map(([x, y]) => {
    const p = pathAt(x, y);
    if (p) return { x, y, ok: false, relay: p.done && (p.lvl || 0) !== lvl ? p : null, same: (p.lvl || 0) === lvl };
    return { x, y, ok: canPlace(x, y) };
  });
  const n = tiles.filter(t => t.ok).length, r = tiles.filter(t => t.relay).length, cost = {};
  for (const [res, c] of Object.entries(each)) cost[res] = c * (n + r);
  return { tiles, n, r, cost, lvl, name: TIERS.path[lvl].name };
}
