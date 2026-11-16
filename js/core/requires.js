// What something still needs. Every greyed-out button asks here, so it can always say why: the age, a building that
// must stand first, an earlier tier, fireflies caught, a free farm slot, or exactly how much more of each
// material. Each function returns null when nothing is missing, else one short sentence.
import { researchCost } from './research.js';
import { MAX_VILLAGERS, BUILD, AGES, UPGRADES, TIERS, VILLAGER_COST } from './config.js';
import { townCenter, popCap, farmSlots, slotKind, slotsUsed } from './state.js';

const NAME = { wood: 'wood', stone: 'stone', gold: 'gold', food: 'food', water: 'water', clay: 'clay', fiber: 'fiber', pottery: 'pottery', cloth: 'cloth', furniture: 'furniture', jewelry: 'jewelry', candles: 'candles', wheat: 'wheat', flour: 'flour', beer: 'beer', wool: 'wool', milk: 'milk', wax: 'wax' };
const a = k => /^[aeiou]/i.test(BUILD[k].name) ? 'an' : 'a';
const bname = k => `${a(k)} ${BUILD[k].name.toLowerCase()}`;
const list = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];

// "Needs 40 more wood and 10 more stone." or null.
export function shortOf(g, cost) {
  if (!cost) return null;
  const miss = Object.entries(cost).filter(([r, n]) => (g.res[r] || 0) < n).map(([r, n]) => `${Math.ceil(n - (g.res[r] || 0))} more ${NAME[r] || r}`);
  return miss.length ? `Needs ${list(miss)}.` : null;
}

// An upgrade (research) at a building.
export function upgradeNeeds(g, u) {
  if (g.owned[u.id]) return null;
  const parts = [];
  if (u.age > g.age) parts.push(`opens in the ${AGES[u.age].name} Age`);
  if (u.req && !g.owned[u.req]) { const r = UPGRADES.find(x => x.id === u.req); parts.push(`needs ${r ? r.name : 'the tier before it'} first`); }
  if (u.at && u.at !== 'tc' && !g.buildings.some(b => b.k === u.at && b.done)) parts.push(`needs ${bname(u.at)} finished`);
  if (parts.length) return cap1(list(parts)) + '.';
  return shortOf(g, researchCost(g, u));
}

// A building in the Build menu.
export function buildNeeds(g, k) {
  const d = BUILD[k];
  if (d.age > g.age) return `Opens in the ${AGES[d.age].name} Age.`;
  if (d.unlock && !g.unlocked[k]) return k === 'fireflylamp' ? `Catch 10 fireflies at night first (${Math.min(10, (g.caught && g.caught.firefly) || 0)} so far).` : 'Not available yet.';
  if (k === 'tc' && g.buildings.some(b => b.k === 'tc')) return 'The village has its town center.';
  if (d.needs && !g.buildings.some(b => b.k === d.needs && b.done)) return `Needs ${bname(d.needs)} finished first.`;
  const kind = slotKind(k);
  if (kind) {
    const fhs = g.buildings.filter(b => b.k === 'farmhouse' && b.done);
    if (!fhs.length) return (kind === 'fields' ? 'Needs a finished farmhouse first (fields join it in a chain).' : 'Needs a finished farmhouse first (it goes within 4 tiles of one).');
    if (!fhs.some(fh => slotsUsed(g, fh, kind) < farmSlots(fh)[kind])) return `Every farmhouse has all its ${kind === 'fields' ? 'fields' : 'animals'}: build another farmhouse, or improve one for more room.`;
  }
  return shortOf(g, d.cost);
}

// Growing into the next age.
export function ageNeeds(g) {
  const nx = AGES[g.age + 1];
  if (!nx) return 'Your village has reached its final age.';
  if (g.adv > 0) return 'The village is growing into the next age now.';
  if (!townCenter(g)) return 'Needs a finished town center first.';
  const parts = [];
  if ((g.culture || 0) < (nx.culture || 0)) parts.push(`${Math.ceil(nx.culture - (g.culture || 0))} more culture (🎭 ${Math.floor(g.culture || 0)} of ${nx.culture})`);
  const s = shortOf(g, nx.cost); if (s) parts.push(s.slice(6, -1));
  return parts.length ? `Needs ${list(parts)}.` : null;
}

// A new villager.
export function villagerNeeds(g) {
  if (g.villagers.length >= MAX_VILLAGERS) return `Hearthvale is home to ${MAX_VILLAGERS} villagers: as many as it will ever hold.`;
  if (g.villagers.length >= popCap(g)) return 'No room for anyone else: homes or a town center raise the limit.';
  return shortOf(g, VILLAGER_COST);
}

const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
