// Beauty. Untouched land is neutral (0). Every building with a beauty value spreads it to
// every tile within BEAUTY_RADIUS tiles in each direction, fading with distance:
//   B[tile] = sum over buildings of  value x (1 - d / (BEAUTY_RADIUS + 1))
// d = Chebyshev distance from the building's footprint (0 on it, 1 next to it ... 3 at the edge).
import { N, BUILD, BEAUTY_RADIUS, BEAUTY_LABELS } from './config.js';
import { idx, inMap } from './world.js';
import { beautyOf } from './state.js';

const falloff = d => 1 - d / (BEAUTY_RADIUS + 1);
const distTo = (b, x, y) => Math.max(Math.max(b.x - x, 0, x - (b.x + b.w - 1)), Math.max(b.y - y, 0, y - (b.y + b.h - 1)));

export function computeBeauty(g) {
  const B = g.beauty || (g.beauty = new Float32Array(N * N));
  B.fill(0);
  const R = BEAUTY_RADIUS, one = g._oneEach || (g._oneEach = new Float32Array(N * N));
  one.fill(0);
  for (const b of g.buildings) {
    if (!b.done) continue;
    const v = beautyOf(b);
    if (!v) continue;
    // Benches don't add up: a spot near several benches gets the beauty of the best one.
    const single = BUILD[b.k].oneEach;
    for (let y = b.y - R; y < b.y + b.h + R; y++) for (let x = b.x - R; x < b.x + b.w + R; x++) {
      if (!inMap(x, y)) continue;
      const add = v * falloff(distTo(b, x, y)), i = idx(x, y);
      if (single) one[i] = Math.max(one[i], add); else B[i] += add;
    }
  }
  for (let i = 0; i < N * N; i++) B[i] += one[i];
  g.beautyDirty = false;
  return B;
}

// A home's surroundings: the beauty on its own tiles, not counting the home itself.
export function homeScore(g, b) {
  if (!g.beauty) computeBeauty(g);
  let sum = 0;
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) sum += g.beauty[idx(b.x + i, b.y + j)];
  const own = b.done ? beautyOf(b) : 0;
  // Treasures from the night-critter collection make a home lovelier from the inside.
  return sum / (b.w * b.h) - own + (b.decor ? b.decor.length * HOME_DECOR_BEAUTY : 0);
}
export const HOME_DECOR_BEAUTY = 0.4;
export const beautyLabel = score => BEAUTY_LABELS.find(([min]) => score >= min)[1];
export function villageBeauty(g) {
  const homes = g.buildings.filter(b => BUILD[b.k].home && b.done);
  return homes.length ? homes.reduce((s, b) => s + homeScore(g, b), 0) / homes.length : 0;
}
