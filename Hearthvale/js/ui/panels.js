// What the interface says about a building, villager or resource spot. Pure text from the game state; no DOM.
//   summary(...)  one short line for the bubble
//   details(...)  every line, for the Details sheet
import { BUILD, TIERS, ICON, RES, RES_NAME, ROLE_NAME, MERCHANT, FOCI, NODE_INFO } from '../core/config.js';
import { popCap, isNight, beds, storeOf, levelName, townCenter, beautyOf, farmSlots, slotsUsed } from '../core/state.js';
import { daysToMerchant, priceOf } from '../core/merchant.js';
import { daysToGoods, shopNear } from '../core/directors.js';
import { wantedFestival, festivalCost } from '../core/festival.js';
import { homeScore, beautyLabel } from '../core/beauty.js';
import { improveInfo } from '../core/commands.js';
import { describe } from '../core/activity.js';
import { dutyName } from '../core/duty.js';
import { fmt } from './dom.js';

export const NODE_NAME = { 1: 'Tree', 2: 'Stone', 3: 'Gold', 4: 'Berry bush', 5: 'Fish', 6: 'Clay' };
const holds = (G, b) => RES.filter(r => storeOf(G, b, r) > 0).map(r => Math.round(storeOf(G, b, r)) + ICON[r]).join(' ');

export function buildingTitle(b) { return b.done ? levelName(b) : BUILD[b.k].name; }

export function buildingSummary(G, b) {
  const def = BUILD[b.k];
  if (!b.done) return `Being built: ${Math.round(100 * b.prog / b.time)}%`;
  if (b.k === 'farmhouse') { const s = farmSlots(b); return `Fields ${slotsUsed(G, b, 'fields')} of ${s.fields} · Animals ${slotsUsed(G, b, 'animals')} of ${s.animals}`; }
  if (def.craft) { const who = G.villagers.find(v => v.job === b.id); return who ? `${who.name} works here` : 'Waiting for a worker: tap it with a villager selected'; }
  if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) return `Villagers ${G.villagers.length} of ${popCap(G)} · Spirits ${Math.round((G.social || 0) * 100)}%`;
  if (b.k === 'well') return `Water ${Math.floor(b.water)} of ${TIERS.well ? (TIERS.well[b.lvl || 0].water ?? def.water) : def.water}`;
  if (def.crop) return `${RES_NAME[def.crop] || 'Harvest'} left: ${Math.max(0, Math.round(b.food))}`;
  if (def.home) return `Surroundings: ${beautyLabel(homeScore(G, b))} · beds ${beds(b)}`;
  if (b.k === 'market') { const vis = G.merchant.visit; return vis ? (vis.phase === 'trade' ? 'The merchant is here' : 'The merchant is on the road') : `Next merchant in ${daysToMerchant(G) || MERCHANT.everyDays} days`; }
  const h = holds(G, b); if (h) return 'Holds ' + h;
  return def.desc;
}

export function buildingDetails(G, b) {
  const def = BUILD[b.k], parts = [];
  if (!b.done) return [`Being built: ${Math.round(100 * b.prog / b.time)}%`, def.desc];
  parts.push(def.desc);
  if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) parts.push(`Villagers: ${G.villagers.length} of ${popCap(G)} · Focus: ${FOCI[G.focus].name}`);
  if (b.k === 'campfire' && !townCenter(G)) parts.push('Build a town center to grow beyond a hamlet.');
  if (b.k === 'farmhouse') { const s = farmSlots(b); parts.push(`Fields ${slotsUsed(G, b, 'fields')} of ${s.fields} · Animals ${slotsUsed(G, b, 'animals')} of ${s.animals}. Fields and pens go within 4 tiles; a higher level has more room.`); }
  if (def.craft) { const c = def.craft, who = G.villagers.find(v => v.job === b.id), [o] = Object.keys(c.out);
    parts.push(`${who ? who.name + ' works here' : 'No worker yet: select a villager, then tap this building'} · makes ${c.out[o]} ${o} from ${Object.entries(c.in).map(([r, n]) => n + ' ' + r).join(' and ')}`); }
  if (b.k === 'market') { parts.push('Buys spare ' + Object.keys(MERCHANT.price).map(r => `${r} ${priceOf(G, r)}${ICON.gold}`).join(', ') + ' (homes keep what they need).'); }
  if (b.k === 'shop') { const t = TIERS.shop[b.lvl || 0]; parts.push(`Hands goods to homes within ${t.reach} tiles · sells up to ${t.sells} spare goods a day`); if (b.earned) parts.push(`Sold today for ${b.earned}${ICON.gold}`); }
  if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) { const f = wantedFestival(G); if (f && !G.festival) parts.push(`🎉 ${f.name}: ${fmt(festivalCost(G, f))}`); else if (G.festival) parts.push(`🎉 ${G.festival.name} planned`); if (G.seasonal) parts.push(`${G.seasonal.icon} ${G.seasonal.name}${G.seasonal.phase === 'on' ? ' today!' : ' coming'}`); parts.push(`Spirits ${Math.round((G.social || 0) * 100)}%`); }
  if (def.animals) parts.push(`${def.animals.kind === 'bees' ? 'Hives' : 'Animals'}: ${b.animals ?? def.animals.start} of ${def.animals.cap + (G.mods.penAdd || 0)}`);
  if (b.k === 'tavern') parts.push(G.res.beer >= 1 ? 'Beer in the cellar: evenings here lift spirits twice as fast' : 'Brewing beer would make evenings here livelier');
  if (b.k === 'well') parts.push(`Water: ${Math.floor(b.water)}`);
  if (def.beds) parts.push(`Beds: ${beds(b)}` + (isNight(G) ? ` · sleeping now: ${b.sleepers}` : ''));
  if (def.home && TIERS[b.k] && !shopNear(G, b) && TIERS[b.k].some(t => (t.goods || []).length)) parts.push('A shop nearby lets this home reach finer levels.');
  if (def.home) { const sc = homeScore(G, b); parts.push(`Surroundings: ${beautyLabel(sc)} (${sc.toFixed(1)})`);
    const gd = TIERS[b.k] && TIERS[b.k][b.lvl].goods; if (gd && gd.length) { const dd = daysToGoods(G); parts.push(`Uses 1 ${gd.join(', 1 ')} ${dd ? `in ${dd} day${dd === 1 ? '' : 's'}` : 'tomorrow morning'}`); } }
  { const bv = beautyOf(b); if (bv && !def.home) parts.push(bv > 0 ? `Adds ${bv} beauty nearby` : `Unsightly: ${bv} beauty nearby`); }
  { const h = holds(G, b); if (h) parts.push('Holds ' + h); }
  if (TIERS[b.k]) { const i = improveInfo(G, b); parts.push(`Level ${b.lvl + 1} of ${TIERS[b.k].length}` + (i.next ? ` · next: ${i.next.name}` + (i.reason ? ` (${i.reason.replace(/\.$/, '')})` : ' (ready)') : '')); }
  return parts;
}

export function villagerTitle(vs) { return vs.length > 1 ? `${vs.length} villagers` : vs[0].name + (vs[0].role ? ', the ' + (ROLE_NAME[vs[0].role] || vs[0].role) : ''); }
export function villagerSummary(G, vs) {
  if (vs.length > 1) return 'Tap a tree, field or building site to give them work.';
  const v = vs[0], d = describe(G, v).replace(/\.$/, '');
  return d + (v.carry && !d.startsWith('Carrying') ? ` · carrying ${v.carry}${ICON[v.carryRes] || ''}` : '');
}
export const villagerJob = (G, v) => v.duty ? 'Job: ' + dutyName(G, v.duty) : 'No job yet: tap work for them';

export function nodeSummary(G, n) {
  const w = G.w;
  if (n.type === 'sapling') return `Grows into a tree in about ${Math.max(0, Math.ceil(150 - w.G[n.i]))}s (it rests in winter).`;
  return w.A[n.i] > 0 ? `${w.A[n.i]} ${RES_NAME[NODE_INFO[w.R[n.i]].res].toLowerCase()} left` : 'Gone';
}
