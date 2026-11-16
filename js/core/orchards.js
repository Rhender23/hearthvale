// Orchards: fruit trees that bear only in their seasons. At the first dawn of a bearing season the trees fill with that
// season's crop (b.food); out of season they rest, and nothing is re-sown. Fruit goes to the pantry as fruit.
import { BUILD, SEASON, DAY } from './config.js';
import { seasonIndex, seasonNo } from './state.js';

export const isOrchard = b => !!(b && BUILD[b.k].orchard);
export const cropNow = (g, k) => (BUILD[k].orchard.seasons[seasonIndex(g)] || 0);
// Each dawn: a new season brings a new crop, or the trees rest.
export function orchardDawn(g) {
  const sn = seasonNo(g);
  for (const b of g.buildings) {
    if (!b.done || !isOrchard(b) || b.season === sn) continue;
    b.season = sn; b.food = cropNow(g, b.k);
  }
}
// A newly planted orchard bears from its first season.
export function plantOrchard(g, b) { b.season = seasonNo(g); b.food = cropNow(g, b.k); }
export const restingWhy = (g, b) => {
  const s = Object.keys(BUILD[b.k].orchard.seasons).map(Number), names = ['spring', 'summer', 'autumn', 'winter'];
  return `The ${BUILD[b.k].orchard.fruit} come in ${s.map(i => names[i]).join(' and ')}.`;
};
// For the planner: food a day, averaged over the year.
export const orchardPerDay = k => Object.values(BUILD[k].orchard.seasons).reduce((s, n) => s + n, 0) / (4 * SEASON / DAY);
