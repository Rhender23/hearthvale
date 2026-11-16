// The village planner: what is worth building next, and why. No fixed order and no head-count or age thresholds
// beyond what a building's own age needs; every candidate is scored by the same rule each planning cycle.
//
//   score(k) = Σ over needs   weight × urgency × coverage(k)        what it would do for the village
//            − COST  × costShare(k)                                   share of spare materials it would use up
//            − LABOUR × labour(k)                                     builders' days already promised to open sites
//            − STAFF  × staff(k)                                      workshops need a specialist the village can spare
//
//   urgency   0..1, how pressing the need is now (a shortfall in beds, days of food left, homes held back, …)
//   coverage  0..1, the share of that shortfall this building would close (its beds, output per day, beauty, …)
//
// Production chains: a building whose inputs have no source (no node in the world, no stock, no producer yet)
// brings its upstream producers into the candidate: their costs are added and the first missing link is what gets
// placed. So bread brings a mill, which brings a wheat field, which brings a farmhouse; the village builds supply
// first, and the next cycle re-scores everything with the new building counted.
//
// Unfinished buildings count as if done (their beds, storage and output), so the village never doubles up on
// something already under way.
import { LEISURE } from './leisure.js';
import { orchardPerDay } from './orchards.js';
import { BUILD, TIERS, AGES, NODE, RATION_DAY, PACE, GOODS_USE_DAYS, CULTURE, DAY, N, MERCHANT, GOODS, FARM } from './config.js';
import { tierOf, cap, bedTotal, hub, hasMarket, slotKind, townCenter } from './state.js';
import { homeScore } from './beauty.js';
import { isShore, walkable } from './world.js';

// Day-based estimates are written for the original 864 s day and scaled to the current DAY, so the planner judges in
// real time whatever the clock speed.
const DAYS = PACE / DAY;   // game days per original day (2 since v38)
export const PLAN = {
  weights: { hub: 1.6, beds: 1.3, food: 1.2, water: 1.0, storage: 0.9, goods: 1.0, supply: 0.8, culture: 0.7, beauty: 0.6, social: 0.4, gold: 0.5 },
  COST: 0.35, LABOUR: 0.25, STAFF: 0.6, THRESHOLD: 0.15,
  workSeconds: 300 / DAYS,       // productive seconds a staffed workshop or field puts in per game day (estimate)
  stockDays: 4 * DAYS,           // stock counts as supply spread over this many game days
  foodComfortDays: 4 * DAYS,     // food urgency falls to 0 with this many game days of meals in store
  cultureHorizon: 8 * DAYS,      // game days to the next age at which culture urgency reaches 1
  attendSeconds: 60 / DAYS,      // seconds a villager spends at a culture building per game day (estimate)
  harvestsPerDay: 1 / DAYS,      // fields bring in about one harvest per original day
};

const clamp01 = x => Math.max(0, Math.min(1, x));
const RAW = { wood: NODE.TREE, stone: NODE.STONE, gold: NODE.GOLD, clay: NODE.CLAY };
const mealsPerDay = pop => RATION_DAY * pop;

// Output of a building per day, by resource (staffed, at its base level).
export function outputPerDay(k) {
  const d = BUILD[k], out = {};
  if (d.orchard) out.food = (out.food || 0) + orchardPerDay(k);
  else if (d.crop) out[d.crop] = (out[d.crop] || 0) + (d.food || 0) * PLAN.harvestsPerDay;
  if (d.craft) for (const [r, n] of Object.entries(d.craft.out)) out[r] = (out[r] || 0) + n / d.craft.time * PLAN.workSeconds * (d.animals ? 0.75 : 1);
  return out;
}
// Inputs a building needs per day (required inputs only: grazing animals and alternatives don't count).
export function inputPerDay(k) {
  const c = BUILD[k].craft; if (!c || c.graze) return {};
  const o = {}; for (const [r, n] of Object.entries(c.in)) o[r] = n / c.time * PLAN.workSeconds; return o;
}
const PRODUCERS = {};
for (const k of Object.keys(BUILD)) for (const r of Object.keys(outputPerDay(k))) (PRODUCERS[r] = PRODUCERS[r] || []).push(k);
export const producersOf = r => PRODUCERS[r] || [];

const available = (g, k) => { const d = BUILD[k]; return d && d.placer === 'village' && d.age <= g.age && (!d.unlock || g.unlocked[k]); };
const costSum = c => Object.values(c).reduce((s, n) => s + n, 0);

// Everything the planner reads about the village, gathered once per cycle.
function survey(g) {
  const pop = Math.max(1, g.villagers.length), all = g.buildings, has = k => all.some(b => b.k === k);
  const homes = all.filter(b => b.done && BUILD[b.k].home && TIERS[b.k]);
  const pendingBeds = all.filter(b => !b.done && BUILD[b.k].home).reduce((s, b) => s + ((TIERS[b.k] ? TIERS[b.k][0].beds : BUILD[b.k].beds) || 0), 0);
  const nodes = {}; for (let i = 0; i < N * N; i++) if (g.w.A[i] > 0) nodes[g.w.R[i]] = (nodes[g.w.R[i]] || 0) + g.w.A[i];
  // Supply per day of each resource from buildings (done or under way).
  const supply = {}, supplyDone = {}, supplyPending = {};
  for (const b of all) for (const [r, n] of Object.entries(outputPerDay(b.k))) { supply[r] = (supply[r] || 0) + n; const o = b.done ? supplyDone : supplyPending; o[r] = (o[r] || 0) + n; }
  // Goods homes use, and goods holding a home back from its next level (it has the surroundings but not the goods).
  const goodsUse = {}, blocked = {}, levelGoods = {};   // levelGoods: goods a home's next level costs (furniture, tools)
  for (const h of homes) {
    const t = TIERS[h.k], cur = t[h.lvl || 0], nx = t[(h.lvl || 0) + 1];
    for (const r of cur.goods || []) goodsUse[r] = (goodsUse[r] || 0) + 1 / GOODS_USE_DAYS;
    if (nx && nx.age <= g.age && homeScore(g, h) >= nx.need) {
      for (const r of nx.goods || []) if ((g.res[r] || 0) < 1 && !(cur.goods || []).includes(r)) blocked[r] = (blocked[r] || 0) + 1;
      for (const r of GOODS) { const f = (nx.cost && nx.cost[r]) || 0; if (f > (g.res[r] || 0)) { const L = levelGoods[r] = levelGoods[r] || { homes: 0, amount: 0 }; L.homes++; L.amount += f; } }
    }
  }
  // Inputs workshops will draw, scaled by how much of their output is actually wanted (a potter making pottery for
  // four homes uses a little clay, not a full day's worth). Three passes carry demand up chains (bread → flour → wheat).
  const meals = mealsPerDay(pop), wantOut = r => r === 'food' ? Math.max(0, meals - ((g.yday && g.yday.in.food) || 0)) + meals * 0.25
    : (goodsUse[r] || 0) + (blocked[r] || 0) / GOODS_USE_DAYS + (levelGoods[r] ? levelGoods[r].amount / GOODS_USE_DAYS : 0) + (MERCHANT.price[r] ? 1 : 0);
  let use = {};
  for (let pass = 0; pass < 3; pass++) {
    const u = {};
    for (const b of all) {
      const ins = inputPerDay(b.k); if (!Object.keys(ins).length) continue;
      const outs = Object.keys(outputPerDay(b.k)), util = Math.max(0.15, Math.min(1, Math.max(...outs.map(r => (wantOut(r) + (use[r] || 0)) / Math.max(1, supply[r] || 1)))));
      for (const [r, n] of Object.entries(ins)) u[r] = (u[r] || 0) + n * util;
    }
    use = u;
  }
  const econ = g.manager.directors.find(d => d.name === 'Economy'), needs = (econ && econ.needs) || {};
  const specialists = all.filter(b => BUILD[b.k].craft).length;
  const openWork = all.filter(b => !b.done).reduce((s, b) => s + Math.max(0, b.time - b.prog), 0);
  return { pop, homes, pendingBeds, supplyDone, supplyPending, nodes, supply, use, goodsUse, blocked, levelGoods, needs, has, specialists, openWork };
}

// Is there a source for resource r (a node, stock, or a producer already standing or under way)?
function sourced(g, S, r) {
  if (RAW[r] && S.nodes[RAW[r]] > 0) return true;
  if (r === 'food') return true;
  return (S.supply[r] || 0) > 0 || (g.res[r] || 0) >= 10;
}
// The chain of buildings k needs before it can work: upstream producers for inputs with no source, cheapest first.
function chainFor(g, S, k, seen = new Set()) {
  if (seen.has(k)) return null; seen.add(k);
  const c = BUILD[k].craft, links = [];
  if (c && !c.graze) for (const r of Object.keys(c.in)) {
    if (sourced(g, S, r) || (c.alt && Object.keys(c.alt).some(a => sourced(g, S, a)))) continue;
    const opts = producersOf(r).filter(p => available(g, p)).map(p => ({ p, up: chainFor(g, S, p, new Set(seen)) })).filter(o => o.up);
    if (!opts.length) return null;   // nothing in this age can supply it yet
    opts.sort((a, b) => costSum(BUILD[a.p].cost) - costSum(BUILD[b.p].cost));
    links.push(...opts[0].up, opts[0].p);
  }
  return links;
}

// What building k would do for each of the village's needs: [{ need, urgency, coverage, why }].
function gains(g, S, k) {
  const d = BUILD[k], out = [], add = (need, urgency, coverage, why, at) => { if (urgency > 0 && coverage > 0) out.push({ need, urgency: clamp01(urgency), coverage: clamp01(coverage), why, at }); };
  const pop = S.pop, outD = outputPerDay(k);
  // The town center: every age needs it.
  if (k === 'tc' && !S.has('tc')) add('hub', 1, 1, 'the village is ready for a town center');
  // Beds: one for everyone, plus one spare so a newcomer can settle (Social wants the village to grow).
  if (d.home && (TIERS[k] || d.beds)) {
    const beds = (TIERS[k] ? TIERS[k][0].beds : d.beds) || 0, short = pop - bedTotal(g) - S.pendingBeds;
    if (short > 0) add('beds', 1, beds / short, 'everyone needs a bed');
    else if (short > -1) add('beds', 0.6, beds, 'room for a newcomer');
  }
  // Food: how many days of meals are in store, and how far yesterday's food fell short of what was eaten.
  if (outD.food) {
    const meals = mealsPerDay(pop), days = (g.res.food || 0) / meals, made = (g.yday && g.yday.in.food) || 0;
    const urgency = 1 - days / PLAN.foodComfortDays, short = meals * 1.25 - Math.max(made, S.supplyDone.food || 0) - (S.supplyPending.food || 0);
    if (short > 0) add('food', urgency, outD.food / short, days < 2 ? 'food is running short' : 'more food for the pantry');
  }
  // Water: a well where the walk to water from home is long.
  if (k === 'well') {
    // the home with the longest walk to water gets a well beside it
    const wells = g.buildings.filter(b => b.k === 'well'), homes = S.homes.length ? S.homes : [hub(g)];
    let far = 0, home = homes[0]; for (const h of homes) { const w = waterWalk(g, h, wells); if (w > far) { far = w; home = h; } }
    add('water', (far - 3) / 8, 1, 'water closer to home', [home.x, home.y, home.w, home.h]);
  }
  // Storage Economy has asked for (what the village needs is more than it can hold).
  if (!d.home) for (const dm of S.storage.filter(x => x.k === k)) {
    const each = storeAmount(g, k, dm.res); if (!each) continue;
    const pending = g.buildings.filter(b => !b.done && b.k === k).length * each;
    const short = dm.amount - pending; if (short <= 0) continue;
    add('storage', ['food', 'water', 'wood'].includes(dm.res) ? 1 : 0.7, Math.min(each, short) / short, dm.why);
  }
  // Goods homes use, need to level up, or the merchant (and shops) will buy.
  for (const r of [...GOODS, ...FARM]) {
    if (!outD[r] || RAW[r]) continue;
    const demand = (S.goodsUse[r] || 0) + (S.blocked[r] || 0) / GOODS_USE_DAYS + (S.levelGoods[r] ? S.levelGoods[r].amount / GOODS_USE_DAYS : 0) + (S.use[r] || 0);
    const supply = (S.supply[r] || 0) + (g.res[r] || 0) / PLAN.stockDays, short = demand - supply;
    const held = (S.blocked[r] || 0) + (S.levelGoods[r] ? S.levelGoods[r].homes : 0);
    if (short > 0) add(S.use[r] ? 'supply' : 'goods', Math.max(held / Math.max(1, S.homes.length), S.use[r] ? 0.6 : 0.3), outD[r] / short,
      held ? `homes need ${r} to grow` : S.use[r] ? `${r} for the ${S.users[r] || 'workshops'}` : `homes use ${r}`);
    else if (MERCHANT.price[r] && (hasMarket(g) || S.has('shop'))) add('gold', S.needs.gold || 0, 0.5, `${r} sells well`);
  }
  // Raw materials from mines and pits (they work forever): for when the nodes are scarce or Economy is short.
  for (const r of ['stone', 'gold', 'clay']) if (outD[r] && !S.has(k)) {
    const left = S.nodes[RAW[r]] || 0, want = r === 'clay' ? (S.use.clay || 0) * 10 : 300 + 200 * g.age;
    add('supply', Math.max(S.needs[r] || 0, 1 - left / Math.max(1, want)), 1, `a steady supply of ${r}`);
  }
  // Culture: more matters the further the next age is at today's pace.
  if (d.culture || d.craft && d.craft.out.culture) {
    const nx = AGES[g.age + 1], gap = nx ? (nx.culture || 0) - (g.culture || 0) : 0;
    if (gap > 0 && !S.has(k)) {
      const rate = Math.max(0.5, S.cultureRate || 0), days = gap / rate, per = cultureOf(k, pop);
      add('culture', days / PLAN.cultureHorizon, per / (rate + per), nx ? `the ${nx.name} Age needs more culture` : 'culture');
    }
  }
  // Places to gather (play, plays, the weekly service): company when spirits are low.
  if (['playground', 'theater', 'church', 'tavern'].includes(k) && !S.has(k)) add('social', 1 - (g.social ?? 1), k === 'tavern' ? 0.6 : k === 'playground' ? 0.5 : 0.4, k === 'tavern' ? 'evenings together at the tavern' : k === 'playground' ? 'somewhere to play' : 'somewhere to gather');
  // A trading post: the merchant comes every few days to buy what the workshops make and sell stone.
  if (k === 'market' && !S.has(k)) { const made = [...GOODS, ...FARM].some(r => MERCHANT.price[r] && ((S.supply[r] || 0) > 0 || (g.res[r] || 0) >= 5)); add('gold', Math.max(0.4, S.needs.gold || 0), made ? 1 : 0.5, 'the merchant will come to trade'); }
  // A shop within reach of homes whose level wants goods, once there are goods to hand out.
  if (d.shop) {
    const want = S.homes.filter(h => { const t = TIERS[h.k]; return ((t[h.lvl].goods || []).length || (t[h.lvl + 1] && (t[h.lvl + 1].goods || []).length && homeScore(g, h) >= t[h.lvl + 1].need)) && !shopReach(g, h); });
    const goodsMade = [...GOODS, ...FARM].some(r => (S.supply[r] || 0) > 0 || g.res[r] >= 1);
    if (want.length && goodsMade && !g.buildings.some(b => b.k === k && !b.done)) add('goods', 0.6 + 0.4 * want.length / Math.max(1, S.homes.length), 1, 'homes want goods handed out');   // a home with no shop can't grow at all
  }
  // v45: carts, the waystation, the bathhouse and bandstand.
  if (k === 'stable' && !S.has(k) && g.buildings.some(b => b.k === 'path' && b.done)) add('supply', Math.min(1, pop / 12), 0.5, 'carts to carry more along the paths');
  if (k === 'waystation' && !S.has(k) && hasMarket(g)) add('gold', Math.max(0.3, S.needs.gold || 0), 0.6, 'the merchant would come more often');
  if (LEISURE[k] && !S.has(k)) add('social', 1 - (g.social ?? 1) + 0.2, 0.4, LEISURE[k].why);
  // Beauty: the home closest to its next level, by how much of the gap this decoration would close beside it.
  if (d.decor) {
    let best = 0, gapBest = 0, home = null;
    for (const h of S.homes) {
      const t = TIERS[h.k], nx = t[(h.lvl || 0) + 1]; if (!nx || nx.age > g.age) continue;
      if ((nx.goods || []).length && !shopReach(g, h)) continue;   // a shop is what it lacks, not beauty
      let gap = nx.need - homeScore(g, h);
      for (const o of g.buildings) if (!o.done && BUILD[o.k].decor) { const dd = Math.max(0, Math.max(o.x - h.x, h.x - o.x) - 1, Math.max(o.y - h.y, h.y - o.y) - 1); if (dd <= 3) gap -= (BUILD[o.k].beauty || 0) * (1 - dd / 4); }
      if (gap <= 0) continue;
      const c = 0.75 * (d.beauty || 0) / gap; if (c > best) { best = c; gapBest = gap; home = h; }
    }
    if (best > 0) add('beauty', 0.4 + 0.6 * Math.min(1, 1 / (gapBest + 0.5)), best, `the ${(TIERS[home.k][home.lvl || 0].name || 'home').toLowerCase()} would be lovelier for it`, [home.x, home.y, home.w, home.h]);
  }
  return out;
}
const cultureOf = (k, pop) => {
  const key = { school: 'learn', theater: 'theater', library: 'read', church: 'church' }[k];
  if (key) return CULTURE[key] * pop * PLAN.attendSeconds * (k === 'church' ? 0.6 : 1);
  if (k === 'monument') return 1.5 + 50 / PLAN.cultureHorizon;   // a little each day, and 50 when it is finished
  if (LEISURE[k] && LEISURE[k].culture) return LEISURE[k].culture * pop * PLAN.attendSeconds * 0.5;
  if (k === 'greathall') return 30 / PLAN.cultureHorizon;   // festivals give twice the culture
  const c = BUILD[k].craft; return c && c.out.culture ? c.out.culture / c.time * PLAN.workSeconds : 0;
};
function storeAmount(g, k, r) { const t = TIERS[k] ? TIERS[k][0] : null, s = (t && t.store) || BUILD[k].store; return s && s[r] ? s[r] * ((t && t.storeMult) || 1) * (g.sandbox ? 10 : 1) : 0; }
function shopReach(g) { return g.buildings.some(s => s.k === 'shop'); }   // anywhere in the village
function waterWalk(g, h, wells) {
  let d = 99;
  for (const w of wells) d = Math.min(d, Math.max(Math.abs(w.x - h.x), Math.abs(w.y - h.y)));
  for (let r = 1; r < Math.min(d, 14); r++) {
    for (let y = h.y - r; y <= h.y + r; y++) for (let x = h.x - r; x <= h.x + r; x++) if (Math.max(Math.abs(x - h.x), Math.abs(y - h.y)) === r && walkable(g.w, x, y) && isShore(g.w, x, y)) return Math.min(d, r);
  }
  return Math.min(d, 14);
}

// Score every candidate. Returns the list best-first, each { k, place, chain, score, value, cost, labour, staff, why, gains }.
export function evaluate(g, ctx = {}) {
  const S = survey(g);
  S.storage = ctx.storage || [];
  S.cultureRate = ctx.cultureRate || 0;
  S.users = {}; for (const b of g.buildings) for (const r of Object.keys(inputPerDay(b.k))) S.users[r] = BUILD[b.k].name.toLowerCase();
  const W = PLAN.weights, spare = r => Math.max(1, (g.res[r] || 0) - (ctx.reserve && ctx.reserve[r] || 0));
  const list = [];
  for (const k of Object.keys(BUILD)) {
    if (!available(g, k)) continue;
    const gs = gains(g, S, k); if (!gs.length) continue;
    const chain = chainFor(g, S, k); if (!chain) continue;
    const links = [...chain, k], place = links.find(p => p === k || !g.buildings.some(b => b.k === p)) || k;
    const cost = {}; for (const p of links) if (p === k || !g.buildings.some(b => b.k === p)) for (const [r, n] of Object.entries(BUILD[p].cost)) cost[r] = (cost[r] || 0) + n;
    const value = gs.reduce((s, x) => s + (W[x.need] || 0.5) * x.urgency * x.coverage, 0);
    const costShare = Object.entries(cost).reduce((m, [r, n]) => Math.max(m, n / spare(r)), 0);
    const builders = Math.max(1, g.villagers.length);
    const labour = (S.openWork + links.reduce((s, p) => s + BUILD[p].time, 0)) / (builders * 60);
    const crafts = links.filter(p => BUILD[p].craft && !g.buildings.some(b => b.k === p && p !== k)).length;
    const staff = crafts ? clamp01((S.specialists + crafts) / Math.max(1, g.villagers.length * 0.5) - 0.5) : 0;
    const score = value - PLAN.COST * Math.min(2, costShare) - PLAN.LABOUR * labour - PLAN.STAFF * staff;
    const top = gs.slice().sort((a, b) => (W[b.need] || 0.5) * b.urgency * b.coverage - (W[a.need] || 0.5) * a.urgency * a.coverage)[0];
    list.push({ k, place, chain, cost, score, value, costShare, labour, staff, at: (gs.find(x => x.at) || {}).at, why: place === k ? top.why : `${BUILD[k].name.toLowerCase()}: ${top.why}`, gains: gs });
  }
  return list.sort((a, b) => b.score - a.score);
}
