// The land heals on its own. This is part of the engine, not a Director:
//   - a partly used node (berries, fish, trees, clay, but never stone or gold) regrows REGROW_PER_DAY of its full amount per day
//   - a node taken to 0 is gone; a felled tree leaves a sapling STUMP_SAPLING of the time
//   - saplings grow into trees; forests creep outward; berry bushes appear on long-empty grass near forest
// Nothing grows in winter.
import { N, NODE, NODE_INFO, DAY, REGROW_PER_DAY, STUMP_SAPLING } from './config.js';
import { idx, tx, ty, isOpen, countNear, buildingNear } from './world.js';
// Nature keeps paths clear: nothing new grows on the road or within LAND.clearAround tiles of a building.
import { seasonIndex } from './state.js';

export const LAND = { saplingTime: 900, spreadChance: 0.004, berryChance: 0.03, berryMax: 14, clearAround: 2 };  // slow on purpose
const RENEWS = { [NODE.TREE]: true, [NODE.BERRY]: true, [NODE.FISH]: true, [NODE.CLAY]: true };

export function createLand(g) {
  let t = 0;
  g.events.on('depleted', ({ i, k }) => { if (k === NODE.TREE && !g.w.road[i] && !buildingNear(g.w, tx(i), ty(i), LAND.clearAround) && g.rng() < STUMP_SAPLING) g.w.G[i] = 1; });
  return {
    tick(dt) {
      const w = g.w, winter = seasonIndex(g) === 3;
      for (let i = 0; i < N * N; i++) {
        if (!winter) {
          if (w.G[i] > 0) { w.G[i] += dt; if (w.G[i] >= LAND.saplingTime) { w.G[i] = 0; w.R[i] = NODE.TREE; w.A[i] = NODE_INFO[NODE.TREE].amt; g.events.emit('grown', i); } }
          else if (w.A[i] > 0 && RENEWS[w.R[i]]) {
            const full = NODE_INFO[w.R[i]].amt;
            if (w.A[i] < full) { w.F[i] += full * REGROW_PER_DAY * dt / DAY; if (w.F[i] >= 1) { const n = Math.floor(w.F[i]); w.A[i] = Math.min(full, w.A[i] + n); w.F[i] -= n; } }
          }
        }
        if (isOpen(w, tx(i), ty(i))) w.E[i] += dt; else w.E[i] = 0;
      }
      t += dt;
      if (t < 4 || winter) return;
      t = 0;
      let berries = 0;
      for (let i = 0; i < N * N; i++) if (w.R[i] === NODE.BERRY && w.A[i] > 0) berries++;
      for (let n = 0; n < 8; n++) {
        const x = g.rng.int(N), y = g.rng.int(N), i = idx(x, y);
        if (!isOpen(w, x, y) || w.E[i] < 240 || buildingNear(w, x, y, LAND.clearAround)) continue; // nothing grows within 2 tiles of a building
        const trees = countNear(w, x, y, NODE.TREE, 2);
        if (trees >= 1 && trees <= 7 && g.rng() < LAND.spreadChance * (g.landBoost || 1)) w.G[i] = 1;
        else if (w.E[i] > 480 && countNear(w, x, y, NODE.TREE, 3) >= 2 && countNear(w, x, y, NODE.BERRY, 3) === 0 && berries < LAND.berryMax && !buildingNear(w, x, y, 2) && g.rng() < LAND.berryChance) {
          w.R[i] = NODE.BERRY; w.A[i] = NODE_INFO[NODE.BERRY].amt; w.E[i] = 0; berries++;
        }
      }
    },
  };
}
