// Directors. Each owns one part of the village and has:
//   seeks    - what it is trying to achieve
//   rules    - what it never does
//   prefs    - tunable numbers
//   patterns - its routines
//   tick()   - per-frame upkeep of its own domain
//   think()  - once a second: posts wishes (activity weights for villagers) and demands (asks of other Directors)
// Directors influence the world; they never command villagers or address the player with instructions.
import { researchCost } from './research.js';
import { dims, BUILD, TIERS, AGES, NODE, PRI, MEAL_HOURS, MEALS, RATION_DAY, RATION, DAY, PACE, CULTURE_DRAIN, WAKE, N, SLIDE_DAYS, SLIDE_MARGIN, SOCIAL, ROLE_NAME, LEAVE_HUNGRY_DAYS, GOODS_USE_DAYS, GOODS, FARM, CULTURE, UPGRADES, FESTIVAL, PANTRY, MERCHANT, SHOP_PRICE, HOME_CULTURE, FARM_REACH, VALUE, KEY_NODE, PATH_FADE } from './config.js';
import { priceOf, surplus } from './merchant.js';
import { festivalWant, wantedFestival, festivalCost, planFestival, affordableFestival } from './festival.js';
import { research, advance } from './commands.js';
import { idx, inMap, isOpen, countNear, walkable, besideRect, DIRS8, buildingNear } from './world.js';
import { hour, isNight, nextAgeCost, have, pay, popCap, notice, cap, bedTotal, beds, addBuilding, removeBuilding, levelName, tierOf, hub, hasMarket, campfire, townCenter, siteOk, slotKind, slotsUsed, farmSlots, flood, keepsWay } from './state.js';
import { homeScore, villageBeauty, beautyLabel } from './beauty.js';
import { action, interrupt, hasAction, createVillager } from './villagers.js';
import { bfs, besideTile, visitorEdge, visitorPassable } from './path.js';
import { stepCost } from './actions.js';
import { drinkFrom, settle } from './household.js';
import { orchardDawn } from './orchards.js';
import { leisureWishes, leisureTick, restBoost } from './leisure.js';
import { churchCulture } from './festival.js';
import { evaluate, PLAN } from './planner.js';

const clamp01 = x => Math.max(0, Math.min(1, x));
const crossed = (g, h) => g.crossed.includes(h);
const rations = (g, pop, days) => RATION_DAY * pop * days;
const demandsFor = (g, to) => (g.manager.lastDemands || []).filter(d => d.to === to);

// Goods the homes will use at the next goods day: 1 of each good per home whose level needs it.
export function homeGoodsNeed(g) {
  const need = {};
  for (const b of g.buildings) if (b.done && BUILD[b.k].home && TIERS[b.k]) for (const r of TIERS[b.k][b.lvl].goods || []) need[r] = (need[r] || 0) + 1;
  return need;
}
export const daysToGoods = g => { const r = g.dawns % GOODS_USE_DAYS; return r === 0 ? 0 : GOODS_USE_DAYS - r; };

// ---------------------------------------------------------------- research payback
// Days for an upgrade to pay for itself: its cost (goods at their merchant price, the rest at 1 each) over what it
// would add in a day, judged from yesterday's income. Walking is about half the day, carrying trips a little less.
const worth = r => MERCHANT.price[r] || 1;
const costWorth = c => Object.entries(c).reduce((s, [r, n]) => s + n * worth(r), 0);
export function payback(g, u) {
  const inc = (g.yday && g.yday.in) || {}, total = Object.entries(inc).reduce((s, [r, n]) => s + n * worth(r), 0);
  const fx = u.fx || {}, crafted = role => g.buildings.filter(b => b.done && BUILD[b.k].craft && BUILD[b.k].craft.role === role).reduce((s, b) => { const c = BUILD[b.k].craft, out = Object.keys(c.out)[0]; return s + (inc[out] || 0) * worth(out) / Math.max(1, g.buildings.filter(o => o.done && BUILD[o.k].craft && Object.keys(BUILD[o.k].craft.out)[0] === out).length); }, 0);
  let gain = 0;
  if (fx.carryAdd) gain += total * 0.4 * fx.carryAdd / ((g.mods.carry || 8) + fx.carryAdd);
  if (fx.speedMul) gain += total * 0.5 * (fx.speedMul - 1);
  if (fx.gather) for (const [node, m] of Object.entries(fx.gather)) { const r = Object.keys(KEY_NODE).find(k => KEY_NODE[k] === +node); if (r) gain += (inc[r === 'berry' || r === 'fish' ? 'food' : r] || 0) * 0.5 * (1 - m) / (r === 'berry' || r === 'fish' ? 3 : 1); }
  const fields = g.buildings.filter(b => b.done && b.k === 'farm').length;
  if (fx.farmFoodAdd && fields) gain += (inc.food || 0) * 0.5 * fx.farmFoodAdd / (g.mods.farmFood || 100);
  if (fx.farmRate && fields) gain += (inc.food || 0) * 0.5 * (1 - fx.farmRate);
  if (fx.penAdd) for (const b of g.buildings) { const an = b.done && BUILD[b.k].animals, c = an && BUILD[b.k].craft; if (c) { const out = Object.keys(c.out)[0]; gain += (inc[out] || 0) * worth(out) * 0.5 * fx.penAdd / (an.cap + (g.mods.penAdd || 0)); } }   // room for more animals
  if (fx.craft) for (const [role, m] of Object.entries(fx.craft)) gain += crafted(role) * (1 - m);
  return gain > 0 ? costWorth(researchCost(g, u)) / gain : Infinity;
}

// ---------------------------------------------------------------- Economy
export const Economy = {
  name: 'Economy',
  seeks: 'Stores that cover today and the future, and efficient work',
  rules: ['Only stockpiles what the village can store', 'Stone and gold are gathered only for a real goal'],
  prefs: { daysOfRations: 4, woodBase: 150, woodPerSite: 60, longWalk: 20, goldBase: 100, goldPerAge: 100 },
  patterns: ['Reads the stores every second', 'Quietly prepares for the next big step: a town center, a marketplace, then each age', 'Notices long walks to drop off goods'],
  needs: {}, walk: {}, from: {}, cd: 30, readyAge: 0, bound: false,
  tick(g, dt) {
    // The pantry: keep the kinds in step with the food total (meals and costs take from every kind evenly).
    { const p = g.pantry || (g.pantry = {}); let sum = 0; for (const k of PANTRY) sum += p[k] || 0;
      if (sum > g.res.food + 0.01) { const f = sum > 0 ? g.res.food / sum : 0; for (const k of PANTRY) p[k] = (p[k] || 0) * f; }
      else if (g.res.food > sum + 0.01) p.provisions = (p.provisions || 0) + g.res.food - sum; }
    if (!this.bound) { this.bound = true; g.events.on('delivered', ({ res, walk, from }) => { this.walk[res] = (this.walk[res] ?? walk) * 0.8 + walk * 0.2; this.from[res] = from; }); }
    this.cd -= dt;
    // (No warnings: the village only shares good news. Economy still acts on low food and water.)
    const goal = this.goal(g), nx = nextAgeCost(g);
    if (goal && have(g, goal.cost) && this.readyFor !== goal.name) { this.readyFor = goal.name; notice(g, `The village has gathered what it needs for ${goal.name}.`); }
    g.ready = !!(nx && have(g, nx) && (g.culture || 0) >= (AGES[g.age + 1].culture || 0) && g.buildings.some(b => b.k === 'tc' && b.done));
  },
  // The next big step the village is preparing for: a town center first, then a marketplace, then the next age.
  goal(g) {
    const built = k => g.buildings.some(b => b.k === k);
    if (!built('tc')) return { name: 'a town center', cost: BUILD.tc.cost };
    // The marketplace: saved up for first (the village places it itself in Free build), then the next age.
    if (!built('market') && !have(g, BUILD.market.cost)) return { name: 'a marketplace', cost: BUILD.market.cost };
    const nx = nextAgeCost(g);
    return nx ? { name: `the ${AGES[g.age + 1].name} Age`, cost: nx } : null;
  },
  think(g, post, demand) {
    const goal = this.goal(g);
    const p = this.prefs, nx = (goal && goal.cost) || {}, pop = g.villagers.length, sites = g.buildings.filter(b => !b.done).length, r = g.res;
    const asked = {}, biggest = {}; for (const d of demandsFor(g, 'Economy')) if (d.res) { asked[d.res] = (asked[d.res] || 0) + d.amount; biggest[d.res] = Math.max(biggest[d.res] || 0, d.amount); }
    const need = (k, want) => { const c = cap(g, k), t = Math.min(c, want + (asked[k] || 0)); return r[k] >= c || t <= 0 ? 0 : clamp01((t - r[k]) / t); };
    const n = this.needs = {
      food: need('food', Math.max(rations(g, pop, p.daysOfRations), nx.food || 0)),
      water: need('water', Math.max(rations(g, pop, p.daysOfRations), nx.water || 0)),
      wood: need('wood', Math.max(p.woodBase + p.woodPerSite * sites, nx.wood || 0)),
      stone: need('stone', nx.stone || 0),
      gold: need('gold', Math.max(nx.gold || 0, p.goldBase + p.goldPerAge * g.age)),   // Economy keeps building a gold reserve
    };
    const room = k => clamp01(1 - r[k] / Math.max(1, cap(g, k)));
    const fw = n.food > 0.3 ? 'food is running low' : n.food > 0 ? 'stocking the pantry' : 'keeping the pantry full';
    post('Economy', 'fish', 0.25 * room('food') + 0.8 * n.food, fw);
    post('Economy', 'berry', 0.22 * room('food') + 0.7 * n.food, fw);
    post('Economy', 'farm', 0.25 * room('food') + 0.8 * n.food, fw);
    post('Economy', 'water', 0.3 * room('water') + 0.9 * n.water, n.water > 0.3 ? 'the water barrels are low' : 'keeping the water barrels full');
    post('Economy', 'wood', 0.32 * room('wood') + 0.8 * n.wood, n.wood > 0.3 ? 'the village needs wood' : 'keeping the woodpile full');
    // Workshops: raw materials for the specialists, and making goods the merchant will buy.
    const has = k => g.buildings.some(b => b.k === k && b.done);
    if (has('potter') && g.res.clay < 20 && r.clay < cap(g, 'clay')) post('Economy', 'clay', g.res.clay < 6 ? 0.8 : 0.45, g.res.clay < 6 ? 'the potter is out of clay' : 'the potter needs clay');
    // Wheat for the brewer and the miller.
    if ((has('brewery') || has('mill')) && g.res.wheat < 30 && r.wheat < cap(g, 'wheat')) post('Economy', 'wheatfield', g.res.wheat < 8 ? 0.8 : 0.5, has('brewery') ? 'the brewer needs wheat' : 'the miller needs wheat');
    if (has('weaver') && g.res.fiber < 20 && r.fiber < cap(g, 'fiber')) post('Economy', 'fiberfield', g.res.fiber < 6 ? 0.8 : 0.45, g.res.fiber < 6 ? 'the weaver is out of fiber' : 'the weaver needs fiber');
    if (g.buildings.some(b => BUILD[b.k].craft && b.done)) {
      const hn = homeGoodsNeed(g), short = [...FARM, ...GOODS].find(r => (hn[r] || 0) + (asked[r] || 0) > g.res[r]);
      post('Economy', 'craft', short ? 0.9 : hasMarket(g) ? 0.7 : 0.25, short ? `homes need ${short}` : hasMarket(g) ? 'the merchant will buy it' : 'stocking goods');
    }
    if (n.stone > 0) post('Economy', 'stone', 0.15 + 0.6 * n.stone, asked.stone ? 'stone is needed for building' : `preparing for ${goal ? goal.name : 'the future'}`);
    if (n.gold > 0) post('Economy', 'gold', 0.15 + 0.6 * n.gold, asked.gold ? 'gold is needed for building' : `preparing for ${goal ? goal.name : 'the future'}`);
    // Storage is requested only when what the village actually needs is more than it can hold.
    // Only one thing is paid for at a time, so the biggest single request counts, not all of them added up
    // (adding them up asked for storehouse after storehouse, each wanting stone to improve).
    const wants = { food: Math.max(rations(g, pop, p.daysOfRations), nx.food || 0) + (biggest.food || 0), water: Math.max(rations(g, pop, p.daysOfRations), nx.water || 0) + (biggest.water || 0),
      wood: Math.max(p.woodBase + p.woodPerSite * sites, nx.wood || 0, biggest.wood || 0), stone: Math.max(nx.stone || 0, biggest.stone || 0) };
    for (const k in wants) if (wants[k] > cap(g, k)) demand('Economy', 'Construction', { what: 'storage', res: k, amount: wants[k] - cap(g, k), why: `the village needs more ${k} than it can store` });
    for (const k of ['wood', 'stone']) if ((this.walk[k] || 0) > p.longWalk && this.from[k]) demand('Economy', 'Construction', { what: 'storage', res: k, near: this.from[k], amount: 1, why: `long walks to drop off ${k}` });
  },
};

// ---------------------------------------------------------------- Villagers
export const Workforce = {
  name: 'Villagers',
  seeks: 'Rested, fed, watered and helpful villagers who spend time together',
  rules: ['The sleep schedule is respected', 'Hunger, thirst and tiredness only slow villagers down, never harm them'],
  prefs: { restWish: 0.12, energyDrain: 1 / 900, energySleep: 1 / 150, mealGain: 0.34, nearTiles: 2 },
  patterns: ['Bed at 11 PM, up at 5 AM', 'Meals at 7 AM, noon and 6 PM', 'Rests between jobs'],
  wasNight: null, ct: 0,
  tick(g, dt) {
    const p = this.prefs, night = isNight(g);
    for (const v of g.villagers) {
      const asleep = v.act && v.act.type === 'sleep' && v.act.phase === 'sleep', resting = v.act && (v.act.type === 'rest' || v.act.type === 'sit');
      const rb = restBoost(g, v);   // a soak at the bathhouse: better sleep and rest
      v.energy = asleep ? Math.min(1, v.energy + dt * p.energySleep * rb) : Math.max(0, Math.min(1, v.energy - dt * p.energyDrain + (resting ? rb * dt / 300 : 0)));
      v.full = Math.max(0, v.full - dt / DAY); v.hyd = Math.max(0, v.hyd - dt / DAY);
      v.eff = 0.6 + 0.4 * Math.min(1, Math.min(v.energy, v.full, v.hyd) / 0.35);
      if (night && !hasAction(v, 'sleep') && !hasAction(v, 'leave')) interrupt(g, v, action('sleep', { pri: PRI.SLEEP, src: 'schedule', why: 'Sleeping.' }));
    }
    // Social, as rolling day totals:
    //   comp = time awake within 2 tiles of someone (gatherings at the campfire count extra at higher campfire levels)
    //   tav  = time spent at the tavern
    //   social = 1 during an event lock, else max(min(0.75, 0.75 x comp/target), min(1, tav/target))
    this.ct += dt;
    if (this.ct >= 0.5) {
      const step = this.ct, decay = Math.exp(-step / PACE);   // company fades at its real-time pace this.ct = 0;
      const awake = g.villagers.filter(v => !v.inside && !(v.act && v.act.type === 'sleep' && v.act.phase === 'sleep'));
      const fireMult = (tierOf(campfire(g)) || { company: 1 }).company || 1;
      for (const v of g.villagers) {
        v.comp = (v.comp ?? 36) * decay; v.tav = (v.tav ?? 0) * decay;
        if (!awake.includes(v)) continue;
        if (v.act && v.act.key === 'tavern' && v.act.phase === 'wait') v.tav += step;
        else if (awake.some(u => u !== v && Math.max(Math.abs(u.x - v.x), Math.abs(u.y - v.y)) <= p.nearTiles)) v.comp += step * (v.act && v.act.key === 'fire' ? fireMult : 1);
      }
      // Between celebrations company alone fills less and less (the tavern and the next festival still lift spirits fully).
      const since = (g.clock - (g.lastCelebration || 0)) / DAY, nearCap = Math.max(SOCIAL.floor, SOCIAL.nearCap - SOCIAL.fadePerDay * Math.max(0, since - SOCIAL.fadeAfter));
      g.socialCap = nearCap;
      for (const v of g.villagers) v.social = (v.socialLock || 0) > g.clock ? 1 : Math.max(Math.min(nearCap, nearCap * v.comp / SOCIAL.target), Math.min(1, v.tav / SOCIAL.target));
      { const L = g.workLog ||= { today: 0, todaySec: 0, yday: 0, ydaySec: 0 }; L.todaySec += step * g.villagers.filter(v => !v.job && !(v.act && v.act.type === 'sleep')).length; }
      this.assignRoles(g);
    }
    for (const [h, n] of MEALS) if (crossed(g, h)) this.meal(g, n);
    if (crossed(g, WAKE)) { this.dawn(g); wearPaths(g); orchardDawn(g); const L = g.workLog; if (L && L.todaySec > 0) { L.yday = L.today; L.ydaySec = L.todaySec; L.today = 0; L.todaySec = 0; } }
    if (this.wasNight !== null && night !== this.wasNight) {
      notice(g, night ? 'Evening settles over the village. Time for bed.' : 'Good morning, Hearthvale.');
      g.events.emit(night ? 'night' : 'morning');
    }
    this.wasNight = night;
  },
  // Specialists, by value. A workshop's value is what it makes in a day × how much the village needs it:
  //   need = 1.0 if homes are held back for it (they use it, or their next level does) + 0.8 if another workshop is
  //          short of it as an input + 1.0 for food + 0.5 for gold or stone + 0.4 for culture (until the last Age)
  //          + 0.2 for beer with an Ordinary; each part × (1 − days of it in stock / 8), at least what Economy is short of.
  // A generalist's value is what the generalists actually brought in yesterday, per head, weighted the same way.
  // Someone takes up a trade when a workshop is worth 10% more than general work; a specialist goes back to general work
  // when general work is worth 10% more than their workshop (a job you gave stays). One change at a time, a few
  // checks apart, so nobody flips back and forth.
  stockDays(g, r) { const use = Math.max((g.yday && g.yday.out[r]) || 0, (g.today.out[r] || 0) / Math.max(0.25, g.tod), 0.01); return g.res[r] / use; },
  needOf(g, r, n) { const f = Math.max(0, 1 - this.stockDays(g, r) / VALUE.stockDays); return Math.max(f, n[r] || 0); },
  shopValue(g, b, n, hn) {
    const c = BUILD[b.k].craft, out = Object.keys(c.out)[0], amt = c.out[out];
    let f = out === 'culture' ? 1 : this.needOf(g, out, n), need = 0;
    // Homes held back: what homes use of it, plus what the homes ready for their next level need of it to get there.
    const held = (hn[out] || 0) + this.heldFor(g, out);
    if (held > g.res[out]) { need += VALUE.home; f = Math.max(f, 1 - g.res[out] / held); }
    if (g.buildings.some(o => o.done && BUILD[o.k].craft && BUILD[o.k].craft.in[out] && g.res[out] < BUILD[o.k].craft.in[out] * 2)) need += VALUE.input;
    if (out === 'food') need += VALUE.food;
    if (out === 'gold' || out === 'stone') need += VALUE.gold;
    if (out === 'culture' && AGES[g.age + 1]) need += VALUE.culture;
    if (out === 'beer' && g.buildings.some(o => o.k === 'tavern' && o.done)) need += VALUE.beer;
    const starved = Object.entries(c.in).some(([r, k]) => g.res[r] < k) ? 0.3 : 1;   // nothing to work with right now
    return (amt * DAY / c.time) * VALUE.workShare * need * (out === 'culture' ? 1 : f) * (MERCHANT.price[out] || 1) * starved;
  },
  // How much of r the homes ready for their next level (age, surroundings and a stall nearby all fine) need to take it.
  heldFor(g, r) {
    let need = 0;
    for (const h of g.buildings) {
      const T = TIERS[h.k]; if (!h.done || !BUILD[h.k].home || !T) continue;
      const nx = T[(h.lvl || 0) + 1]; if (!nx || nx.age > g.age || homeScore(g, h) < nx.need) continue;
      const c = stepCost(h, (h.lvl || 0) + 1);
      need += (c[r] || 0) + ((nx.goods || []).includes(r) ? 1 : 0);
    }
    return need;
  },
  generalValue(g, n) {
    const L = g.workLog; if (!L || !L.ydaySec) return null;   // nothing measured yet (the first day): no changes
    return L.yday / L.ydaySec * DAY;
  },
  assignRoles(g) {
    for (const v of g.villagers) if (v.job && !g.bmap.has(v.job)) { v.job = null; v.role = null; }
    if (!g.freeWill) return;   // with free will off, roles stay as they are
    if ((this.roleCd = (this.roleCd || 0) - 1) > 0) return;
    const econ = g.manager.directors.find(d => d.name === 'Economy'), n = (econ && econ.needs) || {}, hn = homeGoodsNeed(g);
    const gen = this.generalValue(g, n), H = 1 + VALUE.hysteresis;
    if (gen == null) return;
    const way = flood(g), reach = b => { for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) if (inMap(x, y) && way[idx(x, y)]) return true; return false; };
    const shops = g.buildings.filter(b => b.done && BUILD[b.k].craft && reach(b)).map(b => ({ b, val: this.shopValue(g, b, n, hn), who: g.villagers.find(v => v.job === b.id) }));
    g.workValue = { general: Math.round(gen), shops: Object.fromEntries(shops.map(s => [s.b.id, Math.round(s.val)])) };   // for the details panel and tests
    // Back to general work: the least valuable staffed workshop, if general work is clearly worth more.
    const low = shops.filter(s => s.who && !(s.who.duty && s.who.duty.b === s.b.id)).sort((a, c) => a.val - c.val)[0];
    if (low && gen > low.val * H && g.villagers.filter(v => !v.job).length < g.villagers.length) {
      low.who.job = null; low.who.role = null; this.roleCd = 20; g.events.emit('roleLeft', { v: low.who, b: low.b }); return;
    }
    // Take up a trade: the most valuable empty workshop, if clearly worth more than general work.
    const open = shops.filter(s => !s.who).sort((a, c) => c.val - a.val)[0];
    if (!open || open.val <= gen * H) return;
    const free = g.villagers.filter(v => !v.job && !v.held && !v.duty && !(v.act && v.act.src === 'player'));
    if (free.length < 2) return;   // someone has to fetch the water
    const role = BUILD[open.b.k].craft.role, v = free.find(v => v.lastRole === role) || free[0];
    v.job = open.b.id; v.role = role; v.lastRole = role; this.roleCd = 6;
    if (!v.toldRole || v.toldRole !== role) { v.toldRole = role; notice(g, `${v.name} is now the village ${ROLE_NAME[role] || role}.`); }
    g.events.emit('role', { v, role });
  },
  // What the generalists bring in, need-weighted (the measure of general work). Called on each delivery.
  logDelivery(g, v, r, k) {
    if (v.job) return;
    const L = g.workLog ||= { today: 0, todaySec: 0, yday: 0, ydaySec: 0 };
    const econ = g.manager.directors.find(d => d.name === 'Economy'), n = (econ && econ.needs) || {};
    L.today += k * this.needOf(g, r, n) * (MERCHANT.price[r] || 1);
  },
  meal(g, n = RATION.food) {
    settle(g);
    for (const v of g.villagers) { if (g.res.water >= n) drinkFrom(g, v, n); }
    for (const v of g.villagers) for (const [r, f] of [['food', 'full'], ['water', 'hyd']]) {
      if (g.res[r] >= n) { g.res[r] -= n; g.today.out[r] = (g.today.out[r] || 0) + n; v[f] = Math.min(1, v[f] + this.prefs.mealGain * n / (RATION_DAY / MEALS.length)); if (r === 'food') v.ate = (v.ate || 0) + 1; }
    }
  },
  // A day with no food at all counts as a hungry day; three in a row and the villager leaves.
  dawn(g) {
    for (const v of g.villagers) {
      v.hungryDays = (v.ate || 0) === 0 ? (v.hungryDays || 0) + 1 : 0;
      v.ate = 0;
      if (v.hungryDays >= LEAVE_HUNGRY_DAYS && !hasAction(v, 'leave')) {
        v.act = null; v.stack = []; v.queue = []; v.path = []; v.inside = false; v.job = null; v.role = null;
        interrupt(g, v, action('leave', { pri: PRI.SLEEP + 1, src: 'schedule', why: 'Leaving to find food elsewhere.' }));
        
      }
    }
  },
  think(g, post) { post('Villagers', 'rest', this.prefs.restWish, 'taking it easy'); },
};

// ---------------------------------------------------------------- Construction
// Finding a spot: rings outward from an anchor; keeps a one-tile gap around walled buildings so paths stay open.
function spaced(g, k, x, y, rot = 0) {
  const [sw, sh] = dims(k, rot), flat = BUILD[k].flat || BUILD[k].decor;
  for (const b of g.buildings) {
    if (BUILD[b.k].walk) continue;
    const gap = b.k === 'tc' || b.k === 'campfire' ? 2 : (flat || BUILD[b.k].flat || BUILD[b.k].decor) ? 0 : 1;
    if (x < b.x + b.w + gap && x + sw + gap > b.x && y < b.y + b.h + gap && y + sh + gap > b.y) return false;
  }
  return true;
}
function findSpot(g, k, ax, ay, opts = {}) {
  const tc = hub(g), minR = opts.minR || 0, maxR = opts.maxR || 10;
  let best = null;
  for (let r = minR; r <= maxR && !best; r++) {
    for (let y = ay - r; y <= ay + r; y++) for (let x = ax - r; x <= ax + r; x++) {
      if (Math.max(Math.abs(x - ax), Math.abs(y - ay)) !== r) continue;
      for (const rot of BUILD[k].turns ? [0, 1] : [0]) {
        const [sw, sh] = dims(k, rot);
        let ok = true;
        for (let j = 0; j < sh && ok; j++) for (let i = 0; i < sw && ok; i++) if (!isOpen(g.w, x + i, y + j)) ok = false;
        if (!ok || !spaced(g, k, x, y, rot) || !siteOk(g, k, x, y, rot) || !keepsWay(g, x, y, sw, sh)) continue;   // the village never walls anything off itself
        const score = (opts.score ? opts.score(x, y) : 0) - r + (rot ? -0.01 : 0);
        if (!best || score > best.score) best = { x, y, rot, score };
      }
    }
  }
  if (!best) return null;
  // Must be reachable from the town center once placed.
  const b = addBuilding(g, k, best.x, best.y, false, best.rot);
  const st = besideTile(g.w, tc) || [tc.x - 1, tc.y - 1];   // start beside the hub, wherever it stands
  const reach = bfs(g.w, st[0], st[1], (x, y) => besideRect(x, y, b.x, b.y, b.w, b.h));
  removeBuilding(g, b); g.nextId--;
  return reach ? best : null;
}
// Highest level a building could reach right now (age and surroundings), ignoring cost.
export function upgradeTarget(g, b) {
  const tiers = TIERS[b.k];
  if (!tiers || !b.done) return b.lvl || 0;
  if (b.k === 'path') return b.lvl || 0;   // paths wear in by use, not by plan
  const score = BUILD[b.k].home ? homeScore(g, b) : 0;
  let to = b.lvl;
  for (let l = b.lvl + 1; l < tiers.length; l++) { if (tiers[l].age > g.age || score < tiers[l].need) break; if ((tiers[l].goods || []).length && !shopNear(g, b)) break; to = l; }
  return to;
}
// Paths wear in by use (see TIERS.path): at dawn each stretch's wear fades a little, and a stretch worn enough becomes
// the next level, if the village has reached that level's Age.
export function wearPaths(g) {
  const T = TIERS.path;
  for (const b of g.buildings) {
    if (b.k !== 'path' || !b.done) continue;
    b.wear = Math.round((b.wear || 0) * (1 - PATH_FADE));
    const nx = T[(b.lvl || 0) + 1];
    if (nx && nx.age <= g.age && b.wear >= nx.wear) { b.lvl = (b.lvl || 0) + 1; g.beautyDirty = true; g.events.emit('upgraded', b); }
  }
}
// Is there a finished shop in the village to hand out goods? Anywhere will do: homes don't need one close by.
export function shopNear(g) {
  return g.buildings.some(s => s.k === 'shop' && s.done);
}
const reserve = g => ({ food: rations(g, g.villagers.length, 1), water: rations(g, g.villagers.length, 1), wood: 20 });
const affordable = (g, cost) => Object.entries(cost).every(([r, n]) => g.res[r] - n >= (reserve(g)[r] || 0));

export const Construction = {
  name: 'Construction',
  seeks: 'A housed, stable and beautiful village with the buildings it needs to grow',
  rules: ['Never abandons a site', 'Keeps a day of food and water and some wood in reserve', 'Leaves paths open between buildings', 'Places only village-class buildings'],
  prefs: { siteWish: 0.9, upgradeWish: 0.6, planEvery: 8, beautyBase: 1, sitesPer: 4 },
  patterns: ['Houses everyone with a spare bed', 'Adds storage where it fills or where walks are long', 'Adds farms when food runs short', 'Beautifies the plainest homes', 'Improves buildings when surroundings and materials allow', 'Lets homes in shabby surroundings slide down a level'],
  t: 3, last: '',
  tick(g, dt) {
    for (const b of g.buildings) if (b.k === 'well' && b.done) { const t = tierOf(b); b.water = Math.min(t.water, b.water + t.refill * dt / DAY); }
    if (crossed(g, WAKE) && g.dawns > 0 && g.dawns % SLIDE_DAYS === 0) this.slide(g);
    this.t -= dt;
    if (this.t <= 0) { this.t = this.prefs.planEvery; this.plan(g); }
  },
  slide(g) {
    for (const b of g.buildings) {
      if (!BUILD[b.k].home || !TIERS[b.k] || !b.done || b.lvl <= 0) continue;
      const need = TIERS[b.k][b.lvl].need, sc = homeScore(g, b);
      if (sc < need - SLIDE_MARGIN) { const from = levelName(b); b.lvl--; g.beautyDirty = true; }
    }
  },
  // Decide whether to start one new building. The planner (planner.js) scores every candidate by what it would do for
  // the village against what it costs; this part only decides where it goes. Returns what it placed.
  plan(g) {
    const tc = hub(g);
    this.last = ''; this.eval = [];
    if (crossed(g, WAKE) || this.cRate === undefined) { const c = g.culture || 0; if (this.c0 !== undefined) this.cRate = (this.cRate ? this.cRate * 0.5 : 0) + (c - this.c0) * (this.cRate ? 0.5 : 1); else this.cRate = 0; this.c0 = c; }
    if (!g.freeBuild) return null;   // only with Free build
    const dem = demandsFor(g, 'Construction'), storage = dem.filter(d => d.what === 'storage');
    // Storage requests go to the building that holds that resource best: food and its materials to a granary,
    // water to a well, wood to a lumber mill, everything else to a storehouse.
    const storeFor = r => ['food', 'wheat', 'flour', 'milk'].includes(r) ? ['granary', 'store'] : r === 'water' ? ['watertower', 'well'] : r === 'wood' ? ['lumbermill', 'store'] : ['store'];
    const st = []; for (const d of storage) for (const k of storeFor(d.res)) st.push({ ...d, k });
    const list = evaluate(g, { storage: st.map(d => ({ res: d.res, amount: d.amount, why: d.why, k: d.k })), cultureRate: this.cRate, reserve: reserve(g) });
    // storage for a resource only counts for the buildings it is routed to
    const rows = list.filter(c => !c.gains.every(x => x.need === 'storage') || st.some(d => d.k === c.k));
    this.eval = rows.slice(0, 8).map(c => ({ k: c.place, for: c.k, score: c.score, why: c.why }));
    const homes = g.buildings.filter(b => BUILD[b.k].home), hx = homes.length ? Math.round(homes.reduce((s, b) => s + b.x, 0) / homes.length) : tc.x, hy = homes.length ? Math.round(homes.reduce((s, b) => s + b.y, 0) / homes.length) : tc.y;
    const beautyAt = (x, y) => (g.beauty ? g.beauty[idx(x, y)] : 0);
    const tryPlace = (k, ax, ay, opts, why) => {
      if (BUILD[k].age > g.age || BUILD[k].placer !== 'village' || (BUILD[k].unlock && !g.unlocked[k]) || (BUILD[k].needs && !g.buildings.some(b => b.k === BUILD[k].needs && b.done)) || !affordable(g, BUILD[k].cost)) return null;
      const spot = findSpot(g, k, ax, ay, opts);
      if (!spot || !pay(g, BUILD[k].cost)) return null;
      const b = addBuilding(g, k, spot.x, spot.y, false, spot.rot || 0);
      this.last = `${BUILD[k].name}: ${why}`;
      g.events.emit('planned', { b, why });
      return b;
    };
    // Fields and pens go into free slots at a farmhouse; with none free, a new farmhouse comes first.
    const slotPlace = (k, why) => {
      const kind = slotKind(k);
      for (const fh of g.buildings.filter(b => b.k === 'farmhouse' && b.done && slotsUsed(g, b, kind) < farmSlots(b)[kind])) {
        const placed = tryPlace(k, fh.x, fh.y, { minR: 1, maxR: kind === 'fields' ? 12 : FARM_REACH + 1, score: (x, y) => -Math.hypot(x - fh.x, y - fh.y) * 0.1 }, why); if (placed) return placed;
      }
      if (g.buildings.some(b => b.k === 'farmhouse' && !b.done)) return null;   // a farmhouse is on its way
      return tryPlace('farmhouse', tc.x, tc.y, { minR: 4, maxR: 12, score: (x, y) => -beautyAt(x, y) * 0.3 }, `room for ${kind === 'fields' ? 'a field' : 'animals'} (${why})`);
    };
    const nearest = kinds => { let at = [hx, hy], bd = 1e9; for (let i = 0; i < N * N; i++) if (kinds.includes(g.w.R[i]) && g.w.A[i] > 0) { const d = Math.hypot(i % N - tc.x, ((i / N) | 0) - tc.y); if (d < bd) { bd = d; at = [i % N, (i / N) | 0]; } } return at; };
    const fields = g.buildings.filter(b => BUILD[b.k].crop), farmHub = g.buildings.find(b => b.k === 'grange') || (fields[0]) || tc;
    // Where each kind of building goes.
    const site = (k, why, forK, at) => {
      if (slotKind(k)) return slotPlace(k, why);
      const d = BUILD[k], sd = storage.find(x => storeFor(x.res).includes(k) && x.near);
      if (k === 'tc') { const f = g.w.fire; return tryPlace('tc', f.x, f.y, { minR: 3, maxR: 8, score: (x, y) => -Math.abs(Math.hypot(x - f.x, y - f.y) - 4) }, why); }
      if (k === 'house') return tryPlace(k, hx, hy, { minR: 2, maxR: 11, score: (x, y) => beautyAt(x, y) * 0.5 }, why);
      if (k === 'market') return tryPlace(k, tc.x, tc.y, { minR: 3, maxR: 9, score: (x, y) => -Math.hypot(x - tc.x, y - tc.y) * 0.2 }, why);
      if (k === 'granary') return tryPlace(k, tc.x, tc.y, { minR: 3, maxR: 10, score: (x, y) => -beautyAt(x, y) }, why);   // unsightly: away from homes
      if (k === 'store' || k === 'lumbermill') { const [ax, ay] = sd ? sd.near : [tc.x, tc.y]; return tryPlace(k, ax, ay, { minR: sd ? 1 : 3, maxR: 10 }, why); }
      if (k === 'well') { const [ax, ay] = at && at.length ? at : [hx, hy]; return tryPlace(k, ax, ay, { minR: 1, maxR: 3 }, why); }
      if (k === 'potter') { const [ax, ay] = nearest([NODE.CLAY]); return tryPlace(k, ax, ay, { minR: 2, maxR: 9 }, why); }
      if (k === 'quarry') { const [ax, ay] = nearest([NODE.STONE]); return tryPlace(k, ax, ay, { minR: 1, maxR: 14, score: (x, y) => -beautyAt(x, y) * 0.2 }, why); }
      if (k === 'goldmine') { const [ax, ay] = nearest([NODE.GOLD, NODE.STONE]); return tryPlace(k, ax, ay, { minR: 1, maxR: 14, score: (x, y) => -beautyAt(x, y) * 0.2 }, why); }
      if (k === 'claypit') return tryPlace(k, tc.x, tc.y, { minR: 3, maxR: 16, score: (x, y) => -beautyAt(x, y) * 0.2 }, why);
      if (k === 'grange') { const fx = fields.length ? Math.round(fields.reduce((s, b) => s + b.x, 0) / fields.length) : tc.x, fy = fields.length ? Math.round(fields.reduce((s, b) => s + b.y, 0) / fields.length) : tc.y; return tryPlace(k, fx, fy, { minR: 1, maxR: 6 }, why); }
      if (k === 'mill' || k === 'dairy') return tryPlace(k, farmHub.x, farmHub.y, { minR: 2, maxR: 8 }, why);
      if (d.shop) { const want = { x: hx, y: hy }; return tryPlace(k, want.x, want.y, { minR: 1, maxR: 5, score: (x, y) => beautyAt(x, y) * 0.2 }, why); }
      if (d.decor) {
        // beside the home the planner chose (the one this decoration helps most), as close as there is room
        const done = homes.filter(b => b.done && TIERS[b.k]), plain = at ? { x: at[0], y: at[1], w: at[2], h: at[3] } : done.slice().sort((a, b) => homeScore(g, a) - homeScore(g, b))[0] || { x: hx, y: hy, w: 1, h: 1 };
        if (d.spread && g.buildings.some(o => o.k === k && Math.max(Math.abs(o.x - plain.x), Math.abs(o.y - plain.y)) <= d.spread + 3)) return null;   // one bench per area
        const cx = plain.x + ((plain.w || 1) - 1) / 2, cy = plain.y + ((plain.h || 1) - 1) / 2;
        return tryPlace(k, plain.x, plain.y, { minR: 1, maxR: 3, score: (x, y) => -2 * Math.max(Math.abs(x - cx), Math.abs(y - cy)) }, why);
      }
      if (d.culture || k === 'playground' || k === 'tavern' || k === 'lodge') return tryPlace(k, hx, hy, { minR: 2, maxR: 9, score: (x, y) => beautyAt(x, y) * 0.3 }, why);
      return tryPlace(k, hx, hy, { minR: 2, maxR: 9 }, why);   // workshops near the homes they serve
    };
    // The best candidate the village can afford goes ahead. If something more valuable is out of reach, Economy is
    // asked to save for it (so the village works towards what it values most).
    // While Economy is saving for the town center, or for an age the village's culture has nearly earned, other
    // buildings may not dip into those savings.
    const econ = g.manager.directors.find(d => d.name === 'Economy'), goal = econ && econ.goal(g), nxA = AGES[g.age + 1];
    const saving = goal && (goal.name === 'a town center' || (nxA && (g.culture || 0) >= 0.7 * (nxA.culture || 0) && goal.name.includes('Age'))) ? goal.cost : {};
    const keep = { ...reserve(g) }; for (const [r, n] of Object.entries(saving)) if (n <= cap(g, r)) keep[r] = (keep[r] || 0) + n;   // savings the stores can't hold yet don't block the storage that would hold them
    const canPay = (k, c) => Object.entries(c).every(([r, n]) => g.res[r] - n >= (k === 'tc' ? (reserve(g)[r] || 0) : (keep[r] || 0)));
    let asked = false;
    for (const c of rows) {
      if (c.score < PLAN.THRESHOLD) break;
      if (!canPay(c.place, BUILD[c.place].cost)) {
        if (!asked) { asked = true; for (const [r, n] of Object.entries(BUILD[c.place].cost)) if (g.res[r] < n + (reserve(g)[r] || 0)) g.manager.later.push({ from: 'Construction', to: 'Economy', what: `materials for a ${BUILD[c.place].name.toLowerCase()}`, res: r, amount: n }); }
        continue;
      }
      const placed = site(c.place, c.why, c.k, c.at);
      if (placed) { if (c.k === 'tc') notice(g, 'The village has started building its town center!'); return placed; }
    }
    return null;
  },
  think(g, post, demand) {
    if (g.buildings.some(b => !b.done)) post('Construction', 'build', this.prefs.siteWish, 'a building site is waiting');
    let want = false;
    for (const b of g.buildings) {
      const top = upgradeTarget(g, b);
      if (top <= b.lvl) { b.pending = top; b.readyDawn = null; continue; }
      if (b.readyDawn == null) b.readyDawn = g.dawns;   // ready to improve since (culture slips if it waits too long)
      // Climb as far as the stores allow now (a home ready for three levels still takes the first one it can pay for);
      // Economy is asked for what the next step still needs.
      let to = top; while (to > b.lvl && !affordable(g, stepCost(b, to))) to--;
      b.pending = to;
      if (to > b.lvl) want = true;
      else { const c = stepCost(b, b.lvl + 1); for (const [r, n] of Object.entries(c)) if (g.res[r] < n) demand('Construction', 'Economy', { what: `materials to improve the ${levelName(b).toLowerCase()}`, res: r, amount: n - g.res[r] }); }
    }
    if (want) post('Construction', 'upgrade', this.prefs.upgradeWish, 'surroundings are lovely enough for something better');
  },
};

// ---------------------------------------------------------------- Social
export const Social = {
  name: 'Social',
  seeks: 'Connection, gatherings and a growing village',
  rules: ['Never forces anyone to attend'],
  prefs: { fireWish: 0.5, tavernWish: 0.65, companyTarget: 72, lowSocial: 0.6, arriveChance: 0.5, foodDays: 4 },
  patterns: ['Evenings together from 6 PM, at the tavern if there is one', 'Welcomes newcomers when there is room, food and good company', 'Wants a festival more every day; asks Economy to stock up and plans one as soon as the village can afford it'],
  lastLeft: -99,
  tick(g) {
    g.social = g.villagers.length ? g.villagers.reduce((s, v) => s + (v.social ?? 0.4), 0) / g.villagers.length : 0;
    if (crossed(g, WAKE)) this.arrivals(g);
    // Social's favourite thing: once the wish passes 0.6, plan a festival the moment the village can afford one (free will on).
    if (g.freeBuild && !g.festival && festivalWant(g) >= FESTIVAL.declareAt && hour(g) >= 6 && hour(g) < FESTIVAL.startHour - 1 && affordableFestival(g)) planFestival(g, 'Social');
  },
  arrivals(g) {
    const p = this.prefs, pop = g.villagers.length, need = rations(g, pop + 1, p.foodDays);
    const ok = bedTotal(g) > pop && pop < popCap(g) && g.res.food >= need && g.res.water >= need && g.social >= p.lowSocial;
    g.arrivalCheck = { beds: bedTotal(g) > pop, food: g.res.food >= need, water: g.res.water >= need, social: g.social >= p.lowSocial };
    if (!ok || g.rng() >= p.arriveChance) return;
    // A newcomer walks in from the nearest reachable edge of the map.
    // Newcomers find the village through the woods like the caravan does, then appear at its edge on foot.
    const tc = hub(g), start = besideTile(g.w, tc);
    if (!start) return;
    const edge = g.w.roadEnd || visitorEdge(g.w, start[0], start[1]);  // newcomers come up the road
    if (!edge) return;
    // Enter at the tile the villagers can reach that lies nearest that edge.
    let best = start, bd = 1e9;
    bfs(g.w, start[0], start[1], (a, b) => { const d = Math.hypot(a - edge[0], b - edge[1]); if (d < bd) { bd = d; best = [a, b]; } return false; });
    const [x, y] = best;
    const p2 = bfs(g.w, x, y, (a, b) => besideRect(a, b, tc.x, tc.y, tc.w, tc.h));
    if (!p2) return;
    const v = createVillager(g, x, y);
    const end = p2.length ? p2[p2.length - 1] : [x, y];
    v.act = action('move', { x: end[0], y: end[1], pri: PRI.PLAYER, src: 'schedule', key: 'arrive', why: 'Arriving in Hearthvale.' });
    v.why = v.act.why;
    notice(g, `A newcomer named ${v.name} has settled in Hearthvale.`);
    g.events.emit('arrived', v);
  },
  think(g, post, demand) {
    const p = this.prefs, h = hour(g), lonely = (g.social ?? 1) < p.lowSocial, mult = lonely ? 2 : 1;
    if (h >= 18 && h < 23) {
      if (g.buildings.some(b => b.k === 'tavern' && b.done)) post('Social', 'tavern', Math.min(1.4, p.tavernWish * mult), lonely ? 'people need time together' : 'an evening at the tavern');
      else post('Social', 'fire', Math.min(1.4, p.fireWish * mult), lonely ? 'people need time together' : 'evening by the fire');
    }
    const want = festivalWant(g);
    if (!g.festival) post('Social', 'festival', want, want >= FESTIVAL.declareAt ? 'the village longs to celebrate' : 'looking forward to the next festival');
    if (want >= FESTIVAL.declareAt && !g.festival) {
      const f = wantedFestival(g), c = festivalCost(g, f);
      for (const [r, n] of Object.entries(c)) if (g.res[r] < n) demand('Social', 'Economy', { what: `a ${f.name.toLowerCase()}`, res: r, amount: n - g.res[r] });
    }
    const pop = g.villagers.length, need = rations(g, pop + 1, p.foodDays);
    if (g.res.food < need) demand('Social', 'Economy', { what: 'food for a newcomer', res: 'food', amount: need });
    if (g.res.water < need) demand('Social', 'Economy', { what: 'water for a newcomer', res: 'water', amount: need });
  },
};

// ---------------------------------------------------------------- Nature
export const Nature = {
  name: 'Nature',
  seeks: 'A green, living valley that lasts',
  rules: ['Never lets the forest near the village disappear', 'Steers villagers away from the last of anything'],
  prefs: { thinForest: 18, plantWish: 0.3, lowWorld: 0.6, clearWish: 0.4, clearAround: 1 },
  patterns: ['Nearly used-up spots score -30 below 25% and -60 below 10%', 'Wishes for planting when the forest thins', 'Keeps the road and the ground around buildings clear of trees and saplings'],
  start: 0,
  think(g, post) {
    // Path keeping: trees touching a building, saplings within 2 tiles of one, and anything on the road.
    const w = g.w, ob = [];
    for (let i = 0; i < N * N; i++) {
      const tree = w.R[i] === NODE.TREE && w.A[i] > 0, sap = w.G[i] > 0;
      if (!tree && !sap) continue;
      const x = i % N, y = (i / N) | 0;
      if (w.road[i] || buildingNear(w, x, y, sap ? 2 : this.prefs.clearAround)) ob.push(i);
    }
    g.obstruct = ob;
    if (ob.length) post('Nature', 'clear', Math.min(0.8, this.prefs.clearWish + 0.04 * ob.length), ob.some(i => w.road[i]) ? 'the road must stay open' : 'trees are crowding the buildings');
    const t = g.w.tc, near = countNear(g.w, t.x, t.y, NODE.TREE, 9);
    let all = 0; for (let i = 0; i < N * N; i++) if (g.w.R[i] === NODE.TREE && g.w.A[i] > 0) all++;
    if (!this.start) this.start = all;
    if (near < this.prefs.thinForest) post('Nature', 'plant', this.prefs.plantWish, 'the forest near the village is thin');
    else if (all < this.start * this.prefs.lowWorld) post('Nature', 'plant', this.prefs.plantWish, 'the valley is losing its trees');
  },
};

// ---------------------------------------------------------------- Culture
// The village's ambition. Culture wants the village to grow: to learn, make art and gather for performances,
// to put the best tools of its age to use, to live in finer homes, and to reach the next age.
// It acts quietly on the player's behalf (only while free will is on): it researches upgrades the village can
// spare the materials for, and starts the next age once the materials and culture are ready.
export const Culture = {
  name: 'Culture',
  seeks: 'A village that learns, makes art, gathers for performances and keeps moving forward through the ages',
  rules: ['Never spends the last day of food, water or wood', 'Only acts while free will is on'],
  prefs: { learnWish: 0.25, theaterWish: 0.6, ambition: 0.3, every: 15 },
  patterns: ['Lessons at the schoolhouse during the day', 'Stories by the fire and plays at the theater in the evening', 'Wants finer homes', 'Researches the best tools of the age', 'Grows into the next age when ready'],
  t: 5,
  tick(g, dt) {
    // Every morning each home adds culture by its level.
    if (crossed(g, WAKE)) { let c = 0; for (const b of g.buildings) if (b.done && b.k === 'house') c += HOME_CULTURE[b.lvl || 0] || 0; else if (b.done && b.k === 'farmhouse') c += 0.25 * ((b.lvl || 0) + 1); else if (b.done && b.k === 'monument') c += 1.5; g.culture = (g.culture || 0) + c; g.homeCulture = c; }
    // Each morning from the Village Age, culture slips a little for homes behind the age and for buildings that have
    // been ready to improve for a while but haven't been. (Recorded for the town center's suggestions.)
    if (crossed(g, WAKE) && g.age >= 1) {
      const D = CULTURE_DRAIN, want = D.expect[g.age] || 0;
      const behind = g.buildings.filter(b => b.done && b.k === 'house' && (b.lvl || 0) < want), levels = behind.reduce((s, b) => s + want - (b.lvl || 0), 0);
      const idle = g.buildings.filter(b => b.done && b.pending > (b.lvl || 0) && b.readyDawn != null && g.dawns - b.readyDawn >= D.idleDays && !(TIERS[b.k] && TIERS[b.k][0].byUse));   // paths improve by use, not by waiting
      const lost = levels * D.perLevelBehind + idle.length * D.idle;
      g.culture = Math.max(0, (g.culture || 0) - lost);
      g.cultureLog = { ...(g.cultureLog || {}), homes: { n: behind.length, levels, lost: levels * D.perLevelBehind, want }, idle: { n: idle.length, lost: idle.length * D.idle } };
    }
    // Culture accrues while villagers are at the fire, the schoolhouse or the theater.
    for (const v of g.villagers) {
      const a = v.act;
      leisureTick(g, v, dt);
      if (a && a.type === 'sit' && a.phase === 'wait' && CULTURE[a.key]) g.culture = (g.culture || 0) + CULTURE[a.key] * dt * (a.key === 'church' ? churchCulture(g, a.tavern) : 1);
      if (a && a.type === 'sit' && a.phase === 'wait' && a.key === 'play') v.comp = (v.comp || 0) + dt * 0.5;   // laughter is good company
      // Beer at the tavern: spirits (social) rise twice as fast and the evening adds a little culture.
      if (a && a.type === 'sit' && a.phase === 'wait' && a.key === 'tavern' && g.res.beer > 0) { g.res.beer = Math.max(0, g.res.beer - CULTURE.beerPerSec * dt); v.tav = (v.tav || 0) + dt; g.culture = (g.culture || 0) + CULTURE.tavernBeer * dt; }
    }
    this.t -= dt;
    if (this.t > 0 || !g.freeBuild) return;   // researching and advancing ages on their own: only with Free build
    this.t = this.prefs.every;
    // Upgrades are only taken up from a comfortable surplus, and not more than one every couple of minutes.
    const keep = { food: rations(g, g.villagers.length, 2), water: rations(g, g.villagers.length, 2), wood: 150, stone: 40, gold: 100 + 100 * g.age };
    const spare = cost => Object.entries(cost).every(([r, n]) => g.res[r] - n >= (keep[r] || 0));
    // Next age first: everything else waits while the village is saving up for it.
    const nx = AGES[g.age + 1];
    const spareForAge = cost => Object.entries(cost).every(([r, n]) => g.res[r] - n >= (r === 'food' || r === 'water' ? rations(g, g.villagers.length, 1) : 0));
    if (nx && g.ready && g.adv === 0 && spareForAge(nx.cost)) { if (advance(g).ok) notice(g, `The village has decided to grow into the ${nx.name} Age.`); return; }
    if (nx && nx.cost && have(g, nx.cost)) return;
    // Research by payback: the upgrade whose cost the village earns back soonest, if within 8 days.
    const u = UPGRADES.filter(u => !g.owned[u.id] && u.age <= g.age && (!u.req || g.owned[u.req]) && (u.at === 'tc' || g.buildings.some(b => b.k === u.at && b.done)) && spare(researchCost(g, u)))
      .map(u => ({ u, days: payback(g, u) })).filter(o => o.days < VALUE.paybackDays).sort((a, b) => a.days - b.days).map(o => o.u)[0];
    if (u && research(g, u.id).ok) { this.t = 120; notice(g, `The village took up ${u.name.toLowerCase()}: ${u.desc.toLowerCase()}`); }
  },
  think(g, post, demand) {
    const p = this.prefs, h = hour(g), has = k => g.buildings.some(b => b.k === k && b.done);
    if (h >= 8 && h < 17 && has('school')) post('Culture', 'learn', p.learnWish, 'learning something new');
    if (h >= 18 && h < 23 && has('theater')) post('Culture', 'theater', p.theaterWish, 'there is a play tonight');
    if (has('library') && h >= 9 && h < 20) post('Culture', 'read', 0.3, 'a good book');
    if (has('church')) { if (g.dawns % 7 === 0 && h >= 9 && h < 11) post('Culture', 'church', 1.3, 'the weekly service'); else if (h >= 7 && h < 19) post('Culture', 'church', 0.12, 'a quiet moment'); }
    if (has('playground') && h >= 13 && h < 18) post('Social', 'play', 0.35, 'an afternoon at the playground');
    leisureWishes(g, post);
    if (g.buildings.some(b => b.pending > b.lvl)) post('Culture', 'upgrade', p.ambition, 'the village wants finer homes');
    const nx = AGES[g.age + 1], short = nx && (g.culture || 0) < (nx.culture || 0);
    // (Which culture buildings to build is the planner's call: it values each by the culture it adds against the gap to the next age.)
  },
};

// ---------------------------------------------------------------- Housing
export const Housing = {
  name: 'Housing',
  seeks: 'A bed for everyone',
  rules: ['Never moves anyone out'],
  prefs: {},
  patterns: ['Fills beds nearest first', 'Anyone without a bed sleeps by the fire', 'Every 3rd morning each home uses 1 of each good its level needs; a home that goes without slips back a level'],
  full: false,
  goodsDay(g) {
    const used = {}, slipped = [];
    for (const b of g.buildings) {
      if (!b.done || !BUILD[b.k].home || !TIERS[b.k]) continue;
      const want = TIERS[b.k][b.lvl].goods || [];
      const near = shopNear(g, b), short = near ? want.filter(r => g.res[r] < 1) : want;
      if (near) for (const r of want) if (g.res[r] >= 1) { g.res[r] -= 1; used[r] = (used[r] || 0) + 1; g.today.out[r] = (g.today.out[r] || 0) + 1; }
      if (short.length) { const from = levelName(b); b.lvl--; g.beautyDirty = true; slipped.push(`the ${from.toLowerCase()} (no ${short.join(' or ')})`); }
    }
    // Quiet by design: no notice when a home slips back.
    g.events.emit('goodsday', { used, slipped });
  },
  // At noon each shop sells a few spare goods (what the homes will not need) for half the merchant's price.
  shopDay(g) {
    for (const s of g.buildings) {
      if (s.k !== 'shop' || !s.done) continue;
      let left = TIERS.shop[s.lvl || 0].sells, earned = 0; s.sold = {};
      for (const r of Object.keys(MERCHANT.price)) {
        while (left > 0 && surplus(g, r) >= 1) { const p = Math.max(1, Math.round(priceOf(g, r) * SHOP_PRICE)); if (g.res.gold + p > cap(g, 'gold')) break; g.res[r] -= 1; g.res.gold += p; earned += p; left--; s.sold[r] = (s.sold[r] || 0) + 1; }
      }
      s.earned = earned;
      if (earned) { g.today.in.gold = (g.today.in.gold || 0) + earned; g.events.emit('shopSold', { s, earned }); }
    }
  },
  tick(g) {
    // Animals: every other morning each pen gains one (up to its size), sooner when it was fed wheat.
    if (crossed(g, WAKE)) for (const b of g.buildings) { const an = BUILD[b.k].animals; if (!an || !b.done) continue; b.animals = b.animals ?? an.start; if (b.animals < an.cap + (g.mods.penAdd || 0) && (g.dawns % 4 === 0 || (b.fedDay >= g.dawns - 3 && g.dawns % 2 === 0))) b.animals++; }
    if (crossed(g, WAKE) && g.dawns > 0 && g.dawns % GOODS_USE_DAYS === 0) this.goodsDay(g);
    if (crossed(g, 12)) this.shopDay(g);
    const isFull = g.villagers.length >= popCap(g);
    // (Being full is not announced.)
    this.full = isFull;
  },
};

const ALL = [Economy, Workforce, Construction, Social, Nature, Culture, Housing];
export const makeDirectors = () => ALL.map(d => {
  const copy = {};
  for (const [k, v] of Object.entries(d)) copy[k] = typeof v === 'function' ? v : structuredClone(v);
  return copy;
});
