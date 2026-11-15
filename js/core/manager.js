// The Village Manager: a quiet steward acting on the player's behalf.
// Directors never act on villagers and never address the player. Once a second
// each Director posts weighted wishes; the Manager sums them, applies the player's
// focus dial, and publishes:
//   W       - how much the village wants each kind of activity (0..1.5)
//   slots   - how many villagers may do each kind at once (stops everyone dogpiling)
//   reasons - the strongest Director's reason for each kind (shown as the villager's "why")
// Villagers then make their own choices inside that landscape (see autonomy.js).
import { FOCI } from './config.js';

export function createManager(directors) {
  return {
    directors, W: {}, slots: {}, reasons: {}, wishes: [], demands: [], lastDemands: [], later: [], t: 1,
    tick(g, dt) {
      for (const d of this.directors) if (d.tick) d.tick(g, dt);
      this.t += dt;
      if (this.t >= 1) { this.t = 0; this.arbitrate(g); }
    },
    arbitrate(g) {
      // Demands are read by other Directors on the next arbitration (lastDemands), so the order Directors think in never matters.
      const wishes = [], demands = this.later.splice(0), post = (dir, key, w, why) => { if (w > 0) wishes.push({ dir, key, w, why }); };
      const demand = (from, to, d) => demands.push({ from, to, ...d });
      for (const d of this.directors) if (d.think) d.think(g, post, demand);
      this.demands = this.lastDemands = demands;
      const W = {}, best = {};
      for (const p of wishes) {
        W[p.key] = (W[p.key] || 0) + p.w;
        if (!best[p.key] || p.w > best[p.key].w) best[p.key] = p;
      }
      const mult = FOCI[g.focus].mult;
      for (const k in W) W[k] = Math.min(1.5, W[k] * (mult[k] || 1));
      this.W = W; this.wishes = wishes;
      this.reasons = {}; for (const k in best) this.reasons[k] = best[k].why || '';
      const pop = g.villagers.length, farms = g.buildings.filter(b => b.k === 'farm' && b.done).length, sites = g.buildings.filter(b => !b.done).length;
      this.slots = { fish: Math.ceil(pop * 0.5), berry: Math.ceil(pop * 0.4), wood: Math.ceil(pop * 0.6), water: Math.ceil(pop * 0.4), stone: Math.max(1, Math.ceil(pop * 0.2)), gold: Math.max(1, Math.ceil(pop * 0.2)), plant: 1, clear: 1, learn: 1, read: 2, play: 3, church: g.dawns % 7 === 0 ? pop : 1, farm: farms * 2, fiberfield: g.buildings.filter(b => b.k === 'fiberfield' && b.done).length * 2, wheatfield: g.buildings.filter(b => b.k === 'wheatfield' && b.done).length * 2, clay: Math.max(1, Math.ceil(pop * 0.25)), build: sites * 3, upgrade: Math.max(1, Math.ceil(pop / 3)) };
    },
    count(g, key, except) { return g.villagers.filter(u => u !== except && u.act && u.act.src === 'auto' && u.act.key === key).length; },
  };
}
