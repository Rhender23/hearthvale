// Beauty. Untouched land is neutral (0). Every building with a beauty value spreads it to
// every tile within BEAUTY_RADIUS tiles in each direction, fading with distance:
//   B[tile] = sum over buildings of  value x (1 - d / (BEAUTY_RADIUS + 1))
// d = Chebyshev distance from the building's footprint (0 on it, 1 next to it ... 3 at the edge).
import { N, BUILD, BEAUTY_RADIUS, BEAUTY_LABELS } from './config.js';
import { idx, inMap } from './world.js';
import { beautyOf } from './state.js';

const falloff = d => 1 - d / (BEAUTY_RADIUS + 1);
const distTo = (b, x, y) => Math.max(Math.max(b.x - x, 0, x - (b.x + b.s - 1)), Math.max(b.y - y, 0, y - (b.y + b.s - 1)));

export function computeBeauty(g) {
  const B = g.beauty || (g.beauty = new Float32Array(N * N));
  B.fill(0);
  const R = BEAUTY_RADIUS;
  for (const b of g.buildings) {
    if (!b.done) continue;
    const v = beautyOf(b);
    if (!v) continue;
    for (let y = b.y - R; y < b.y + b.s + R; y++) for (let x = b.x - R; x < b.x + b.s + R; x++) {
      if (inMap(x, y)) B[idx(x, y)] += v * falloff(distTo(b, x, y));
    }
  }
  g.beautyDirty = false;
  return B;
}

// A home's surroundings: the beauty on its own tiles, not counting the home itself.
export function homeScore(g, b) {
  if (!g.beauty) computeBeauty(g);
  let sum = 0;
  for (let j = 0; j < b.s; j++) for (let i = 0; i < b.s; i++) sum += g.beauty[idx(b.x + i, b.y + j)];
  const own = b.done ? beautyOf(b) : 0;
  return sum / (b.s * b.s) - own;
}
export const beautyLabel = score => BEAUTY_LABELS.find(([min]) => score >= min)[1];
export function villageBeauty(g) {
  const homes = g.buildings.filter(b => BUILD[b.k].home && b.done);
  return homes.length ? homes.reduce((s, b) => s + homeScore(g, b), 0) / homes.length : 0;
}
