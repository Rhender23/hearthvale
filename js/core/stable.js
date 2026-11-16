// The stable's carts: a villager who loads up within 2 tiles of a path or road, with a stable in the village,
// carries twice as much (the cart takes the load along the way).
import { idx, inMap } from './world.js';

const hasStable = g => g.buildings.some(b => b.k === 'stable' && b.done);
const nearRoad = (g, x, y) => {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const a = x + dx, b = y + dy; if (!inMap(a, b)) continue;
    const id = g.w.occ[idx(a, b)], o = id > 0 && g.bmap.get(id);
    if (o && o.k === 'path' && o.done) return true;
  }
  return false;
};
export function carryOf(g, v) {
  const base = g.mods.carry;
  return hasStable(g) && nearRoad(g, Math.round(v.x), Math.round(v.y)) ? base * 2 : base;
}
