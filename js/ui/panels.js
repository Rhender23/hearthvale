// What the interface says about a building, villager or resource spot. Pure text from the game state; no DOM.
//   summary(...)  one short line for the bubble
//   details(...)  every line, for the Details sheet
import { waiting, progress } from '../core/recruit.js';
import { isGrand, stageLine, stagesOf, stageOf, nextStageCost } from '../core/grand.js';
import { isOrchard, restingWhy } from '../core/orchards.js';
import { homeWater, homeWaterCap } from '../core/household.js';
import { shortOf } from '../core/requires.js';
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
import { ageNeeds } from '../core/requires.js';
import { AGES, DAY } from '../core/config.js';
import { workersAt } from './render/workers.js';
import { homeLines } from './homehints.js';
const fmtN = n => (Math.round(n * 100) / 100).toString();

const cap1 = t => t.charAt(0).toUpperCase() + t.slice(1);
export const NODE_NAME = { 1: 'Tree', 2: 'Stone', 3: 'Gold', 4: 'Berry bush', 5: 'Fish', 6: 'Clay' };
const holds = (G, b) => RES.filter(r => storeOf(G, b, r) > 0).map(r => Math.round(storeOf(G, b, r)) + ICON[r]).join(' ');

export function buildingTitle(b) { return b.done ? levelName(b) : BUILD[b.k].name; }

export function buildingSummary(G, b) {
  const def = BUILD[b.k];
  if (!b.done) return isGrand(b.k) ? `${stageLine(b)}: ${b.waiting ? 'waiting for ' + (shortOf(G, nextStageCost(b)) || 'the builders').replace(/^Needs /, '').replace(/\.$/, '') : Math.round(100 * b.prog / b.time) + '%'}` : `Being built: ${Math.round(100 * b.prog / b.time)}%`;
  if (isOrchard(b)) return b.food >= 1 ? `${cap1(def.orchard.fruit)} to pick: ${Math.round(b.food)}` : restingWhy(G, b);
  if (b.k === 'farmhouse') { const s = farmSlots(b); return `Fields ${slotsUsed(G, b, 'fields')} of ${s.fields} · Animals ${slotsUsed(G, b, 'animals')} of ${s.animals}`; }
  if (def.craft) { const who = G.villagers.find(v => v.job === b.id); return who ? `${who.name} works here` : 'Waiting for a worker: tap it with a villager selected'; }
  if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) return `Villagers ${G.villagers.length} of ${popCap(G)} · Spirits ${Math.round((G.social || 0) * 100)}%` + (waiting(G) ? ` · Welcoming ${waiting(G)}: ${Math.round(progress(G) * 100)}%` : '');
  if (b.k === 'well') return `Water ${Math.floor(b.water)} of ${TIERS.well ? (TIERS.well[b.lvl || 0].water ?? def.water) : def.water}`;
  if (def.crop) return `${RES_NAME[def.crop] || 'Harvest'} left: ${Math.max(0, Math.round(b.food))}`;
  if (def.home) return `Surroundings: ${beautyLabel(homeScore(G, b))} · beds ${beds(b)}`;
  if (b.k === 'market') { const vis = G.merchant.visit; return vis ? (vis.phase === 'trade' ? 'The merchant is here' : 'The merchant is on the road') : `Next merchant in ${daysToMerchant(G) || MERCHANT.everyDays} days`; }
  const h = holds(G, b); if (h) return 'Holds ' + h;
  return def.desc;
}

export function buildingDetails(G, b) {
  const def = BUILD[b.k], parts = [];
  if (!b.done) return isGrand(b.k) ? [`${stageLine(b)}: ${Math.round(100 * b.prog / b.time)}%`, ...stagesOf(b.k).map((s, i) => `${i < stageOf(b) ? '✓' : i === stageOf(b) ? '●' : '○'} Stage ${i + 1}: ${fmt(s.cost)}`), def.desc] : [`Being built: ${Math.round(100 * b.prog / b.time)}%`, def.desc];
  parts.push(def.desc);
  if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) parts.push(`Villagers: ${G.villagers.length} of ${popCap(G)} · Focus: ${FOCI[G.focus].name}`);
  if (b.k === 'campfire' && !townCenter(G)) parts.push('Build a town center to grow beyond a hamlet.');
  if (b.k === 'farmhouse') { const s = farmSlots(b); parts.push(`Fields ${slotsUsed(G, b, 'fields')} of ${s.fields} · Animals ${slotsUsed(G, b, 'animals')} of ${s.animals}. Fields join it in a chain, touching it or each other; pens go within 4 tiles. A higher level has more room.`); }
  if (def.craft) { const c = def.craft, who = G.villagers.find(v => v.job === b.id), [o] = Object.keys(c.out);
    parts.push(`${who ? who.name + ' works here' : 'No worker yet: select a villager, then tap this building'} · makes ${c.out[o]} ${o} from ${Object.entries(c.in).map(([r, n]) => n + ' ' + r).join(' and ')}`); }
  if (b.k === 'market') { parts.push('Buys spare ' + Object.keys(MERCHANT.price).map(r => `${r} ${priceOf(G, r)}${ICON.gold}`).join(', ') + ' (homes keep what they need).'); }
  if (b.k === 'shop') { const t = TIERS.shop[b.lvl || 0]; parts.push(`Hands goods to every home · sells up to ${t.sells} spare goods a day`); if (b.earned) parts.push(`Sold today for ${b.earned}${ICON.gold}`); }
  if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) { const f = wantedFestival(G); if (f && !G.festival) parts.push(`🎉 ${f.name}: ${fmt(festivalCost(G, f))}`); else if (G.festival) parts.push(`🎉 ${G.festival.name} planned`); if (G.seasonal) parts.push(`${G.seasonal.icon} ${G.seasonal.name}${G.seasonal.phase === 'on' ? ' today!' : ' coming'}`); parts.push(`Spirits ${Math.round((G.social || 0) * 100)}%`); }
  if (def.animals) parts.push(`${def.animals.kind === 'bees' ? 'Hives' : 'Animals'}: ${b.animals ?? def.animals.start} of ${def.animals.cap + (G.mods.penAdd || 0)}`);
  if (b.k === 'tavern') parts.push(G.res.beer >= 1 ? 'Beer in the cellar: evenings here lift spirits twice as fast' : 'Brewing beer would make evenings here livelier');
  if (b.k === 'well') parts.push(`Water: ${Math.floor(b.water)}`);
  if (def.beds) parts.push(`Beds: ${beds(b)}` + (isNight(G) ? ` · sleeping now: ${b.sleepers}` : ''));
  if (def.home && TIERS[b.k] && !shopNear(G, b) && TIERS[b.k].some(t => (t.goods || []).length)) parts.push('A shop in the village lets this home reach finer levels.');
  if (def.home) { const c = homeWaterCap(G, b); if (c) parts.push(`Household water: ${homeWater(b)} of ${c}`); }
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

// ---- What it would like (shown only in the bubble of the thing you tapped) ----
// A villager: their own comforts, cozy wording, never a warning.
// Where a villager couldn't find a way to (the last hour or so), in words.
const WHERE = { wood: 'the trees', stone: 'the stone', gold: 'the gold', food: 'the berry bushes', water: 'the water', fish: 'the fishing spot', clay: 'the clay', berry: 'the berry bushes' };
export function noWayLine(G, v) {
  const n = v.noWay; if (!n || G.clock - n.t > DAY / 12) return null;
  const b = n.b != null && G.bmap.get(n.b);
  const where = b ? `the ${BUILD[b.k].name.toLowerCase()}` : WHERE[n.key] || (n.type === 'move' ? 'where you sent them' : 'where they were going');
  return `Can't find a way to ${where}: something walls it off.`;
}
export function villagerWants(G, v) {
  const nw = noWayLine(G, v);
  if (nw) return nw + ' ' + villagerWants0(G, v);
  return villagerWants0(G, v);
}
function villagerWants0(G, v) {
  const w = [];
  if ((v.full ?? 1) < 0.45) w.push('a good meal');
  if ((v.hyd ?? 1) < 0.45) w.push('a drink of water');
  if ((v.energy ?? 1) < 0.3) w.push('a rest');
  if ((v.social ?? 1) < 0.6) w.push(G.buildings.some(b => b.k === 'tavern' && b.done) ? 'an evening at the tavern' : 'an evening with friends by the fire');
  const bedsAll = G.buildings.reduce((n, b) => n + beds(b), 0);
  if (bedsAll < G.villagers.length && G.villagers.indexOf(v) >= bedsAll) w.push('a bed of their own');
  if (G.seasonal && G.seasonal.phase === 'soon') w.push(`the ${G.seasonal.name.toLowerCase()}`);
  return w.length ? 'Would love ' + list(w) + '.' : 'Content for now.';
}
// A home: everything between it and its next level. A workshop: what it is missing to work.
export function buildingWants(G, b) {
  const w = buildingWants0(G, b), e = b.done && workersAt(G).get(b.id);
  const who = e ? `Working here: ${e.names.join(', ')}.` : null;
  return [who, w, ...homeLines(G, b)].filter(Boolean).join(' ') || null;
}
function buildingWants0(G, b) {
  if (!b.done) return null;
  const d = BUILD[b.k];
  // The town center (or the campfire before there is one): what stands between the village and its next age.
  if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) {
    const nx = AGES[G.age + 1]; if (!nx) return 'Hearthvale has reached its final age.';
    const parts = [], need = ageNeeds(G), L = G.cultureLog || {};
    if (need) parts.push(need.replace(/^Needs /, '').replace(/\.$/, ''));
    if (L.homes && L.homes.n) parts.push(`${L.homes.n} home${L.homes.n > 1 ? 's' : ''} behind the age (culture −${fmtN(L.homes.lost)} a day)`);
    if (L.idle && L.idle.n) parts.push(`${L.idle.n} building${L.idle.n > 1 ? 's' : ''} ready to improve (−${fmtN(L.idle.lost)} a day)`);
    if (L.event && L.event.lost) parts.push(`the ${L.event.name.toLowerCase()} was short of ${L.event.short.join(' and ')} (−${L.event.lost})`);
    return parts.length ? `For the ${nx.name} Age: ${list(parts)}.` : `Ready to grow into the ${nx.name} Age.`;
  }
  if (d.home && TIERS[b.k]) {
    const t = TIERS[b.k], nx = t[(b.lvl || 0) + 1];
    if (!nx) return 'As fine as a home can be.';
    const parts = [];
    if (nx.age > G.age) return `Dreams of becoming a ${nx.name.toLowerCase()} in the ${['Hamlet', 'Village', 'Town', 'Township'][nx.age]} Age.`;
    const sc = homeScore(G, b); if (sc < nx.need) parts.push(`${beautyLabel(nx.need).toLowerCase()} surroundings (${sc.toFixed(1)} of ${nx.need})`);
    const goods = nx.goods || [];
    if (goods.length && !shopNear(G, b)) parts.push('a stall in the village');
    const noGoods = goods.filter(r => (G.res[r] || 0) < 1); if (noGoods.length) parts.push(noGoods.join(' and ') + ' in the stores');
    const info = improveInfo(G, b); if (!parts.length && info && info.reason) parts.push(info.reason.replace(/^Needs /, '').replace(/\.$/, ''));
    return parts.length ? `To become a ${nx.name.toLowerCase()}: ${list(parts)}.` : `Ready to become a ${nx.name.toLowerCase()}.`;
  }
  if (d.craft) {
    const miss = Object.keys(d.craft.in).filter(r => (G.res[r] || 0) < d.craft.in[r]);
    const alt = d.craft.alt && Object.keys(d.craft.alt).some(r => (G.res[r] || 0) >= d.craft.alt[r]);
    const parts = [];
    if (!G.villagers.some(v => v.job === b.id)) parts.push('someone to work here');
    if (miss.length && !alt && !d.craft.graze) parts.push(miss.map(r => RES_NAME[r] ? RES_NAME[r].toLowerCase() : r).join(' and ') + ' to work with');
    return parts.length ? 'Would like ' + list(parts) + '.' : null;
  }
  return null;
}
const list = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
