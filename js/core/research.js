// What a piece of research costs now: a third less once the observatory stands.
export const OBSERVATORY_DISCOUNT = 2 / 3;
export function researchCost(g, u) {
  if (!g.buildings.some(b => b.k === 'observatory' && b.done)) return u.cost;
  return Object.fromEntries(Object.entries(u.cost).map(([r, n]) => [r, Math.max(1, Math.round(n * OBSERVATORY_DISCOUNT))]));
}
