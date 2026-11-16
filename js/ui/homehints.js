// Extra lines in a home's bubble: its water barrel, and what makes its surroundings lovely or not.
import { BUILD, TIERS, BEAUTY_RADIUS } from '../core/config.js';
import { beautyNear, homeScore } from '../core/beauty.js';
import { homeWater, homeWaterCap } from '../core/household.js';

const nameOf = k => BUILD[k].name.toLowerCase();
const few = list => list.slice(0, 2).map(e => nameOf(e.k)).join(' and ');

export function homeLines(G, b) {
  if (!b.done || !BUILD[b.k].home) return [];
  const out = [], cap = homeWaterCap(G, b);
  if (cap) out.push(`💧 ${homeWater(b)} / ${cap}`);
  const t = TIERS[b.k], nx = t && t[(b.lvl || 0) + 1];
  const { helps, hurts } = beautyNear(G, b);
  const bits = [];
  if (helps.length) bits.push(`Lovelier for the ${few(helps)}`);
  if (hurts.length) bits.push(`spoiled a little by the ${few(hurts)}`);
  if (bits.length) out.push(bits.join('; ') + '.');
  if (nx && homeScore(G, b) < nx.need) out.push(`Flowers, trees, benches and ponds within ${BEAUTY_RADIUS} tiles help it grow${hurts.length ? '; workshops and farms nearby hold it back' : ''}.`);
  return out;
}
