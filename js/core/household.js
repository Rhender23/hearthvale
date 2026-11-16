// Household water. Each home keeps its own barrel (b.hw), part of the village's water but set aside for the people
// who sleep there. Water carriers fill homes that have room before they top up the wells; at meals, villagers drink
// from the home they slept in first, then from the village stores.
import { BUILD } from './config.js';
import { storeOf } from './state.js';
import { besideRect } from './world.js';

export const isHome = b => b && b.done && BUILD[b.k].home;
export const homeWaterCap = (g, b) => (isHome(b) ? Math.floor(storeOf(g, b, 'water')) : 0);
export const homeWater = b => Math.floor(b.hw || 0);
export const roomFor = (g, b) => homeWaterCap(g, b) - (b.hw || 0) >= 1;

// Is (x,y) beside a home whose barrel has room?
export const besideThirstyHome = (g, x, y) => g.buildings.some(b => isHome(b) && roomFor(g, b) && besideRect(x, y, b.x, b.y, b.w, b.h));
export const anyThirstyHome = g => g.buildings.some(b => isHome(b) && roomFor(g, b));

// A carrier just set down n water at (x,y): fill the home beside them, if any.
export function fillHomeAt(g, x, y, n) {
  const b = g.buildings.find(o => isHome(o) && roomFor(g, o) && besideRect(x, y, o.x, o.y, o.w, o.h));
  if (b) b.hw = Math.min(homeWaterCap(g, b), (b.hw || 0) + n);
}

// The barrels can never hold more than the village has (water also goes on newcomers and the like).
export function settle(g) {
  const homes = g.buildings.filter(b => b.hw > 0);
  for (const b of homes) b.hw = Math.min(b.hw, homeWaterCap(g, b));
  const total = homes.reduce((s, b) => s + b.hw, 0), have = g.res.water || 0;
  if (total > have && total > 0) for (const b of homes) b.hw *= have / total;
}

// A villager drinks n water: from their home's barrel when it has some. The village total goes down either way.
export function drinkFrom(g, v, n) {
  const b = v.homeId && g.bmap.get(v.homeId);
  if (b && (b.hw || 0) >= n) b.hw -= n;
}
