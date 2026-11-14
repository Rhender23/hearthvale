// Directors. Each owns one part of the village and has:
//   seeks    - what it is trying to achieve
//   rules    - what it never does
//   prefs    - tunable numbers
//   patterns - its routines
//   tick()   - per-frame upkeep of its own domain
//   think()  - once a second: posts wishes (activity weights for villagers) and demands (asks of other Directors)
// Directors influence the world; they never command villagers or address the player with instructions.
import { dims, BUILD, TIERS, AGES, NODE, PRI, MEAL_HOURS, RATION, DAY, WAKE, N, SLIDE_DAYS, SLIDE_MARGIN, SOCIAL, ROLE_NAME, LEAVE_HUNGRY_DAYS, GOODS_USE_DAYS, GOODS, FARM, CULTURE, UPGRADES, FESTIVAL, PANTRY, MERCHANT, SHOP_PRICE, HOME_CULTURE, FARM_REACH } from './config.js';
import { priceOf, surplus } from './merchant.js';
import { festivalWant, wantedFestival, festivalCost, planFestival, affordableFestival } from './festival.js';
import { research, advance } from './commands.js';
import { idx, inMap, isOpen, countNear, walkable, besideRect, DIRS8, buildingNear } from './world.js';
import { hour, isNight, nextAgeCost, have, pay, popCap, notice, cap, bedTotal, beds, addBuilding, removeBuilding, levelName, tierOf, hub, hasMarket, campfire, townCenter, siteOk, slotKind, slotsUsed, farmSlots } from './state.js';
import { homeScore, villageBeauty, beautyLabel } from './beauty.js';
import { action, interrupt, hasAction, createVillager } from './villagers.js';
import { bfs, besideTile, visitorEdge, visitorPassable } from './path.js';
import { stepCost } from './actions.js';

const clamp01 = x => Math.max(0, Math.min(1, x));
const crossed = (g, h) => g.crossed.includes(h);
const rations = (g, pop, days) => RATION.food * MEAL_HOURS.length * pop * days;
const demandsFor = (g, to) => (g.manager.lastDemands || []).filter(d => d.to === to);

// Goods the homes will use at the next goods day: 1 of each good per home whose level needs it.
export function homeGoodsNeed(g) {
  const need = {};
  for (const b of g.buildings) if (b.done && BUILD[b.k].home && TIERS[b.k]) for (const r of TIERS[b.k][b.lvl].goods || []) need[r] = (need[r] || 0) + 1;
  return need;
}
export const daysToGoods = g => { const r = g.dawns % GOODS_USE_DAYS; return r === 0 ? 0 : GOODS_USE_DAYS - r; };

// ---------------------------------------------------------------- Economy
export const Economy = {
  name: 'Economy',
  seeks: 'Stores that cover today and the future, and efficient work',
  rules: ['Only stockpiles what the village can store', 'Stone and gold are gathered only for a real goal'],
  prefs: { daysOfRations: 2, woodBase: 150, woodPerSite: 60, longWalk: 20, goldBase: 100, goldPerAge: 100 },
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
    // The marketplace is yours to place; once its materials are saved up, the village moves on to the next age.
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
    if (n.stone > 0.05) post('Economy', 'stone', 0.15 + 0.6 * n.stone, asked.stone ? 'stone is needed for building' : `preparing for ${goal ? goal.name : 'the future'}`);
    if (n.gold > 0.05) post('Economy', 'gold', 0.15 + 0.6 * n.gold, asked.gold ? 'gold is needed for building' : `preparing for ${goal ? goal.name : 'the future'}`);
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
      v.energy = asleep ? Math.min(1, v.energy + dt * p.energySleep) : Math.max(0, Math.min(1, v.energy - dt * p.energyDrain + (resting ? dt / 300 : 0)));
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
      const step = this.ct, decay = Math.exp(-step / DAY); this.ct = 0;
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
      this.assignRoles(g);
    }
    for (const h of MEAL_HOURS) if (crossed(g, h)) this.meal(g);
    if (crossed(g, WAKE)) this.dawn(g);
    if (this.wasNight !== null && night !== this.wasNight) {
      notice(g, night ? 'Evening settles over the village. Time for bed.' : 'Good morning, Hearthvale.');
      g.events.emit(night ? 'night' : 'morning');
    }
    this.wasNight = night;
  },
  // Specialists, decided by the Directors' needs rather than a fixed cap:
  //   - each workshop gets a priority: what the homes need from it, food when the pantry is low, gold/stone/clay when Economy is short
  //   - the village keeps enough generalists for what Economy says it needs now (more when food, water or wood run low)
  //   - workshops are staffed in priority order; when generalists are short, the lowest-priority specialist goes back to general work
  //     (they keep their place in line and are the first asked back)
  shopPriority(g, b) {
    const c = BUILD[b.k].craft, out = Object.keys(c.out)[0], econ = g.manager.directors.find(d => d.name === 'Economy'), n = (econ && econ.needs) || {};
    const hn = homeGoodsNeed(g);
    let p = 0.3;
    if ((hn[out] || 0) > g.res[out]) p += 0.6;
    if (out === 'food') p += 0.5 * (n.food || 0) + 0.2;
    if (out === 'beer') p += 0.3;
    if (out === 'gold' || out === 'stone') p += 0.4 * (n[out] || 0) + 0.1;
    if (out === 'culture') p += 0.25;
    if (g.buildings.some(o => o.done && BUILD[o.k].craft && BUILD[o.k].craft.in[out])) p += 0.4;   // feeds another workshop (wheat to flour to bread)
    if (hasMarket(g) && MERCHANT.price[out]) p += 0.15;
    for (const r in c.in) if (g.res[r] < c.in[r]) p -= 0.15;   // nothing to work with right now
    return p;
  },
  assignRoles(g) {
    for (const v of g.villagers) if (v.job && !g.bmap.has(v.job)) { v.job = null; v.role = null; }
    if (!g.freeWill) return;   // with free will off, roles stay as they are
    if ((this.roleCd = (this.roleCd || 0) - 1) > 0) return;   // roles change at most every ~10 checks, so nobody flips back and forth
    const pop = g.villagers.length, econ = g.manager.directors.find(d => d.name === 'Economy'), n = (econ && econ.needs) || {};
    const press = Math.max(n.food || 0, n.water || 0, (n.wood || 0) * 0.7);
    const keepGeneral = Math.min(pop, Math.ceil(pop * (0.25 + 0.45 * press)) + 1);
    const shops = g.buildings.filter(b => b.done && BUILD[b.k].craft).map(b => ({ b, p: this.shopPriority(g, b), who: g.villagers.find(v => v.job === b.id) })).sort((a, c) => c.p - a.p);
    const specialists = shops.filter(s => s.who).length, room = pop - keepGeneral;
    if (specialists > room + 1) { // clearly too few hands for everyday work: the lowest-priority specialist helps out for now
      const s = [...shops].reverse().find(s => s.who && !(s.who.duty && s.who.duty.b === s.b.id));   // a job you gave stays
      if (s) { s.who.job = null; s.who.role = null; this.roleCd = 120; g.events.emit('roleLeft', { v: s.who, b: s.b }); }
      return;
    }
    if (specialists >= room) return;
    const open = shops.find(s => !s.who && s.p > 0.2);
    if (!open) return;
    const free = g.villagers.filter(v => !v.job && !v.held && !v.duty && !(v.act && v.act.src === 'player'));
    if (!free.length) return;
    const role = BUILD[open.b.k].craft.role, v = free.find(v => v.lastRole === role) || free[0];
    v.job = open.b.id; v.role = role; v.lastRole = role; this.roleCd = 6;
    if (!v.toldRole || v.toldRole !== role) { v.toldRole = role; notice(g, `${v.name} is now the village ${ROLE_NAME[role] || role}.`); }
    g.events.emit('role', { v, role });
  },
  meal(g) {
    for (const v of g.villagers) for (const [r, f] of [['food', 'full'], ['water', 'hyd']]) {
      if (g.res[r] >= RATION[r]) { g.res[r] -= RATION[r]; g.today.out[r] = (g.today.out[r] || 0) + RATION[r]; v[f] = Math.min(1, v[f] + this.prefs.mealGain); if (r === 'food') v.ate = (v.ate || 0) + 1; }
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
        if (!ok || !spaced(g, k, x, y, rot) || !siteOk(g, k, x, y, rot)) continue;
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
  const score = BUILD[b.k].home ? homeScore(g, b) : 0;
  let to = b.lvl;
  for (let l = b.lvl + 1; l < tiers.length; l++) { if (tiers[l].age > g.age || score < tiers[l].need) break; if ((tiers[l].goods || []).length && !shopNear(g, b)) break; to = l; }
  return to;
}
// Is a finished shop close enough to hand this home its goods?
export function shopNear(g, h) {
  return g.buildings.some(s => s.k === 'shop' && s.done && Math.max(Math.abs(s.x - h.x), Math.abs(s.y - h.y)) <= TIERS.shop[s.lvl || 0].reach);
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
  // Decide whether to start one new building. Returns what it placed (for tests and the Director overlay).
  plan(g) {
    const pop = g.villagers.length, sites = g.buildings.filter(b => !b.done && b.k !== 'tc').length, tc = hub(g);
    this.last = '';
    if (!g.freeBuild || sites >= Math.max(1, Math.ceil(pop / this.prefs.sitesPer))) return null;   // only with Free build
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
    // Fields and pens go into free slots at a farmhouse; with none free, a new farmhouse comes first (one per six villagers at most).
    const slotPlace = (k, why) => {
      const kind = slotKind(k);
      for (const fh of g.buildings.filter(b => b.k === 'farmhouse' && b.done && slotsUsed(g, b, kind) < farmSlots(b)[kind])) {
        const placed = tryPlace(k, fh.x, fh.y, { minR: 1, maxR: FARM_REACH + 1, score: (x, y) => -Math.hypot(x - fh.x, y - fh.y) * 0.1 }, why); if (placed) return placed;
      }
      const fhs = g.buildings.filter(b => b.k === 'farmhouse');
      if (fhs.some(b => !b.done)) return null;   // a new farmhouse only when every slot is in use (no head-count cap)
      return tryPlace('farmhouse', tc.x, tc.y, { minR: 4, maxR: 12, score: (x, y) => -beautyAt(x, y) * 0.3 }, `room for more ${kind === 'fields' ? 'fields' : 'animals'}`);
    };
    const dem = demandsFor(g, 'Construction');
    // 0. The town center: once Economy has gathered what it needs, the village builds it themselves (a little way from the fire).
    if (!g.buildings.some(b => b.k === 'tc') && affordable(g, BUILD.tc.cost)) {
      const f = g.w.fire, placed = tryPlace('tc', f.x, f.y, { minR: 3, maxR: 8, score: (x, y) => -Math.abs(Math.hypot(x - f.x, y - f.y) - 4) }, 'the village is ready for a town center');
      if (placed) { notice(g, 'The village has started building its town center!'); return placed; }
    }
    // 1. A bed for everyone plus one spare (the spare is what Social needs for newcomers).
    const bedsNow = bedTotal(g), plannedBeds = g.buildings.filter(b => !b.done && BUILD[b.k].home).length * TIERS.house[0].beds;
    if (bedsNow + plannedBeds < pop + 1) { const placed = tryPlace('house', hx, hy, { minR: 2, maxR: 11, score: (x, y) => beautyAt(x, y) * 0.5 }, 'everyone needs a bed'); if (placed) return placed; }   // no spot? carry on with the rest
    // 2. Storage where it is full, or near long walks.
    const st = dem.find(d => d.what === 'storage' && d.near) || dem.find(d => d.what === 'storage');
    // Food and what it is made from go to a granary, water to a well, wood to a lumber mill, everything else to a storehouse.
    const storeK = st && ['food', 'wheat', 'flour', 'milk'].includes(st.res) ? 'granary' : st && st.res === 'water' ? 'well' : st && st.res === 'wood' ? 'lumbermill' : 'store';
    if (st && !g.buildings.some(b => b.k === storeK && !b.done)) {
      const [ax, ay] = st.near || [tc.x, tc.y];
      const placed = tryPlace(storeK, ax, ay, { minR: st.near ? 1 : 3, maxR: 10, ...(storeK === 'granary' ? { score: (x, y) => -beautyAt(x, y) } : {}) }, st.why);   // the unsightly granary keeps its distance from homes
      if (placed) return placed;
    }
    // 3. Farms when food runs short and there are few fields.
    const econ = g.manager.directors.find(d => d.name === 'Economy');
    const farms = g.buildings.filter(b => b.k === 'farm').length;
    if (econ && econ.needs.food > 0.5 && farms < Math.ceil(pop / 3)) { const placed = slotPlace('farm', 'food is running short'); if (placed) return placed; }
    // 4. A well near the homes once the village has grown.
    if (pop >= 4 && !g.buildings.some(b => b.k === 'well')) {
      if (affordable(g, BUILD.well.cost)) { const placed = tryPlace('well', hx, hy, { minR: 1, maxR: 6 }, 'water closer to home'); if (placed) return placed; }
      else g.manager.later.push({ from: 'Construction', to: 'Economy', what: 'materials for a well', res: 'stone', amount: BUILD.well.cost.stone });
    }
    // 5. Workshops once there is a marketplace for their goods (and a fiber field for the weaver).
    if (hasMarket(g)) {
      const has = k => g.buildings.some(b => b.k === k);
      const clayNear = (() => { let best = null, bd = 1e9; for (let i = 0; i < N * N; i++) if (g.w.R[i] === NODE.CLAY && g.w.A[i] > 0) { const d = Math.hypot(i % N - tc.x, ((i / N) | 0) - tc.y); if (d < bd) { bd = d; best = [i % N, (i / N) | 0]; } } return best; })();
      if (!has('potter') && clayNear) { const placed = tryPlace('potter', clayNear[0], clayNear[1], { minR: 2, maxR: 9 }, 'clay can become pottery for the merchant'); if (placed) return placed; }
      if (!has('carpenter') && g.res.wood >= 100) { const placed = tryPlace('carpenter', hx, hy, { minR: 2, maxR: 9 }, 'wood can become furniture for the merchant'); if (placed) return placed; }
      if (g.age >= 1 && !has('weaver')) { const placed = tryPlace('weaver', hx, hy, { minR: 2, maxR: 9 }, 'fiber can become cloth for the merchant'); if (placed) return placed; }
      if (has('weaver') && !has('fiberfield')) { const placed = slotPlace('fiberfield', 'the weaver needs fiber'); if (placed) return placed; }
    }
    // 5a. Gold: from the Town Age a gold mine, once Economy's reserve runs short and the village can afford it.
    if (g.age >= 2 && econ && econ.needs.gold > 0.3 && !g.buildings.some(b => b.k === 'goldmine') && affordable(g, BUILD.goldmine.cost)) {
      let at = [hx, hy], bd = 1e9; for (let i = 0; i < N * N; i++) if ((g.w.R[i] === NODE.GOLD || g.w.R[i] === NODE.STONE) && g.w.A[i] > 0) { const d = Math.hypot(i % N - tc.x, ((i / N) | 0) - tc.y); if (d < bd) { bd = d; at = [i % N, (i / N) | 0]; } }
      const placed = tryPlace('goldmine', at[0], at[1], { minR: 1, maxR: 14, score: (x, y) => -beautyAt(x, y) * 0.2 }, 'the village wants a steady supply of gold'); if (placed) return placed;
    }
    // 5a2. A clay quarry from the Town Age when the potter or jeweler keeps running out of clay.
    if (g.age >= 2 && g.res.clay < 10 && g.buildings.some(b => (b.k === 'potter' || b.k === 'jeweler') && b.done) && !g.buildings.some(b => b.k === 'claypit') && affordable(g, BUILD.claypit.cost)) {
      const placed = tryPlace('claypit', tc.x, tc.y, { minR: 3, maxR: 16 }, 'a steady supply of clay'); if (placed) return placed;
    }
    // 5b. A stone quarry (Town Age on) when the village needs more stone than it has; built near the nearest outcrop.
    if (g.age >= 2 && !g.buildings.some(b => b.k === 'quarry') && econ && (econ.goal(g)?.cost?.stone || 0) > g.res.stone) {
      let at = [hx, hy], bd = 1e9; for (let i = 0; i < N * N; i++) if (g.w.R[i] === NODE.STONE && g.w.A[i] > 0) { const d = Math.hypot(i % N - tc.x, ((i / N) | 0) - tc.y); if (d < bd) { bd = d; at = [i % N, (i / N) | 0]; } }
      if (affordable(g, BUILD.quarry.cost)) { const placed = tryPlace('quarry', at[0], at[1], { minR: 1, maxR: 14 }, 'the village needs a steady supply of stone'); if (placed) return placed; }
      else g.manager.later.push({ from: 'Construction', to: 'Economy', what: 'materials for a quarry', res: g.res.wood < BUILD.quarry.cost.wood ? 'wood' : 'gold', amount: g.res.wood < BUILD.quarry.cost.wood ? BUILD.quarry.cost.wood : BUILD.quarry.cost.gold });
    }
    // 5c. A jeweler in the Town Age, once there is gold to work with.
    if (g.age >= 2 && hasMarket(g) && !g.buildings.some(b => b.k === 'jeweler') && g.res.gold >= 60) { const placed = tryPlace('jeweler', hx, hy, { minR: 2, maxR: 9 }, 'the manors will want jewelry'); if (placed) return placed; }
    // 5d. Farming: wheat and a brewer for beer, a mill and bakery for bread, a grange as the farmers' hub.
    {
      const count = k => g.buildings.filter(b => b.k === k).length, has = k => count(k) > 0;
      const fields = g.buildings.filter(b => BUILD[b.k].crop);
      const fx = fields.length ? Math.round(fields.reduce((s, b) => s + b.x, 0) / fields.length) : tc.x, fy = fields.length ? Math.round(fields.reduce((s, b) => s + b.y, 0) / fields.length) : tc.y;
      const anchor = g.buildings.find(b => b.k === 'grange') || { x: tc.x, y: tc.y };
      if (pop >= 4 && !has('wheatfield')) { const placed = slotPlace('wheatfield', 'wheat for bread and beer'); if (placed) return placed; }
      if (has('wheatfield') && !has('brewery')) { const placed = tryPlace('brewery', hx, hy, { minR: 2, maxR: 9 }, 'every home wants beer'); if (placed) return placed; }
      if (fields.length >= 2 && !has('grange')) { const placed = tryPlace('grange', fx, fy, { minR: 1, maxR: 6 }, 'a hub for the farmers'); if (placed) return placed; }
      if (pop >= 6 && has('wheatfield') && !has('mill')) { const placed = tryPlace('mill', anchor.x, anchor.y, { minR: 2, maxR: 8 }, 'flour for bread'); if (placed) return placed; }
      if (has('mill') && !has('bakery')) { const placed = tryPlace('bakery', hx, hy, { minR: 2, maxR: 8 }, 'fresh bread'); if (placed) return placed; }
      // A farmhouse once there are fields: homes for farming folk, the farming upgrades, and needed before any pens.
      // Animals: hens early; sheep once there is a weaver; cows and a dairy, bees and a chandler in the Village Age.
      if (pop >= 4 && has('wheatfield') && !has('coop')) { const placed = slotPlace('coop', 'fresh eggs'); if (placed) return placed; }
      if (g.age >= 1 && has('weaver') && !has('sheepfold')) { const placed = slotPlace('sheepfold', 'wool for the weaver'); if (placed) return placed; }
      if (g.age >= 1 && pop >= 7 && !has('pasture')) { const placed = slotPlace('pasture', 'milk for cheese'); if (placed) return placed; }
      if (has('pasture') && !has('dairy')) { const placed = tryPlace('dairy', anchor.x, anchor.y, { minR: 2, maxR: 8 }, 'a cheesemaker for the milk'); if (placed) return placed; }
      if (g.age >= 1 && pop >= 6 && !has('apiary')) { const placed = slotPlace('apiary', 'honey and beeswax'); if (placed) return placed; }
      if (has('apiary') && !has('chandler')) { const placed = tryPlace('chandler', hx, hy, { minR: 2, maxR: 8 }, 'candles from the beeswax'); if (placed) return placed; }
      const wheatWanted = 1 + (has('mill') ? 1 : 0) + (has('coop') || has('sheepfold') || has('pasture') ? 1 : 0) + Math.floor(pop / 8);
      if (has('brewery') && count('wheatfield') < wheatWanted && g.res.wheat < 20) { const placed = slotPlace('wheatfield', 'more wheat'); if (placed) return placed; }
    }
    // 5e. A stall (shop) within reach of homes that want goods, so they can be handed out.
    {
      const t = TIERS.house, want = g.buildings.find(h => h.done && h.k === 'house' && !shopNear(g, h) && ((t[h.lvl].goods || []).length || (h.lvl + 1 < t.length && (t[h.lvl + 1].goods || []).length && homeScore(g, h) >= t[h.lvl + 1].need)));
      if (want && !g.buildings.some(b => b.k === 'shop' && !b.done)) { const placed = tryPlace('shop', want.x, want.y, { minR: 1, maxR: 5, score: (x, y) => beautyAt(x, y) * 0.2 }, 'homes nearby want goods'); if (placed) return placed; }
    }
    // 6. Culture buildings Culture has asked for (a schoolhouse, an artist's studio, a theater).
    for (const d of dem.filter(d => d.what === 'culture')) {
      if (g.buildings.some(b => b.k === d.k)) continue;
      const placed = tryPlace(d.k, hx, hy, { minR: 2, maxR: 9, score: (x, y) => beautyAt(x, y) * 0.3 }, d.why);
      if (placed) return placed;
      if (!affordable(g, BUILD[d.k].cost)) for (const [r, n] of Object.entries(BUILD[d.k].cost)) if (g.res[r] < n + (reserve(g)[r] || 0)) g.manager.later.push({ from: 'Construction', to: 'Economy', what: `materials for a ${BUILD[d.k].name.toLowerCase()}`, res: r, amount: n });
    }
    // 7. Beauty: decorate around the plainest home until the village reaches its target.
    const target = this.prefs.beautyBase + g.age;
    const done = homes.filter(b => b.done);
    if (done.length && villageBeauty(g) < target) {
      const plain = done.slice().sort((a, b) => homeScore(g, a) - homeScore(g, b))[0];
      for (const k of ['statue', 'arbor', 'garden', 'fireflylamp', 'lamppost', 'bench', 'flowerbed']) {
        if (BUILD[k].age > g.age || (BUILD[k].unlock && !g.unlocked[k]) || !affordable(g, BUILD[k].cost)) continue;
        if (BUILD[k].spread && g.buildings.some(o => o.k === k && Math.max(Math.abs(o.x - plain.x), Math.abs(o.y - plain.y)) <= BUILD[k].spread + 3)) continue;   // one bench per area
        const placed = tryPlace(k, plain.x, plain.y, { minR: 1, maxR: 3 }, `the ${levelName(plain).toLowerCase()} has ${beautyLabel(homeScore(g, plain)).toLowerCase()} surroundings`);
        if (placed) return placed;
      }
    }
    return null;
  },
  think(g, post, demand) {
    if (g.buildings.some(b => !b.done)) post('Construction', 'build', this.prefs.siteWish, 'a building site is waiting');
    let want = false;
    for (const b of g.buildings) {
      b.pending = upgradeTarget(g, b);
      if (b.pending <= b.lvl) continue;
      const c = stepCost(b, b.pending);
      if (affordable(g, c)) want = true;
      else for (const [r, n] of Object.entries(c)) if (g.res[r] < n) demand('Construction', 'Economy', { what: `materials to improve the ${levelName(b).toLowerCase()}`, res: r, amount: n - g.res[r] });
    }
    if (want) post('Construction', 'upgrade', this.prefs.upgradeWish, 'surroundings are lovely enough for something better');
  },
};

// ---------------------------------------------------------------- Social
export const Social = {
  name: 'Social',
  seeks: 'Connection, gatherings and a growing village',
  rules: ['Never forces anyone to attend'],
  prefs: { fireWish: 0.5, tavernWish: 0.65, companyTarget: 72, lowSocial: 0.6, arriveChance: 0.5, foodDays: 2 },
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
    if (crossed(g, WAKE)) { let c = 0; for (const b of g.buildings) if (b.done && b.k === 'house') c += HOME_CULTURE[b.lvl || 0] || 0; else if (b.done && b.k === 'farmhouse') c += 0.5 * ((b.lvl || 0) + 1); else if (b.done && b.k === 'monument') c += 3; g.culture = (g.culture || 0) + c; g.homeCulture = c; }
    // Culture accrues while villagers are at the fire, the schoolhouse or the theater.
    for (const v of g.villagers) {
      const a = v.act;
      if (a && a.type === 'sit' && a.phase === 'wait' && CULTURE[a.key]) g.culture = (g.culture || 0) + CULTURE[a.key] * dt;
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
    const u = UPGRADES.filter(u => !g.owned[u.id] && u.age <= g.age && (!u.req || g.owned[u.req]) && (u.at === 'tc' || g.buildings.some(b => b.k === u.at && b.done)) && spare(u.cost)).sort((a, b) => a.age - b.age)[0];
    if (u && research(g, u.id).ok) { this.t = 120; notice(g, `The village took up ${u.name.toLowerCase()}: ${u.desc.toLowerCase()}`); }
  },
  think(g, post, demand) {
    const p = this.prefs, h = hour(g), has = k => g.buildings.some(b => b.k === k && b.done);
    if (h >= 8 && h < 17 && has('school')) post('Culture', 'learn', p.learnWish, 'learning something new');
    if (h >= 18 && h < 23 && has('theater')) post('Culture', 'theater', p.theaterWish, 'there is a play tonight');
    if (has('library') && h >= 9 && h < 20) post('Culture', 'read', 0.3, 'a good book');
    if (has('church')) { if (g.dawns % 7 === 0 && h >= 9 && h < 11) post('Culture', 'church', 1.3, 'the weekly service'); else if (h >= 7 && h < 19) post('Culture', 'church', 0.12, 'a quiet moment'); }
    if (has('playground') && h >= 13 && h < 18) post('Social', 'play', 0.35, 'an afternoon at the playground');
    if (g.buildings.some(b => b.pending > b.lvl)) post('Culture', 'upgrade', p.ambition, 'the village wants finer homes');
    const nx = AGES[g.age + 1], short = nx && (g.culture || 0) < (nx.culture || 0);
    const ask = (k, why) => { if (BUILD[k].age <= g.age && !g.buildings.some(b => b.k === k)) demand('Culture', 'Construction', { what: 'culture', k, why }); };
    if (townCenter(g)) ask('school', short ? `the ${nx.name} Age needs more culture` : 'a place to learn');
    if (g.age >= 1) { ask('studio', 'the village wants an artist'); if (g.villagers.length >= 5) ask('theater', 'the village wants a stage'); if (g.villagers.length >= 6) ask('church', 'a place to gather each week'); }
    if (g.age >= 2) ask('library', 'books for everyone');
    if (g.villagers.length >= 5 && townCenter(g)) ask('playground', 'somewhere to play');
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
    if (crossed(g, WAKE)) for (const b of g.buildings) { const an = BUILD[b.k].animals; if (!an || !b.done) continue; b.animals = b.animals ?? an.start; if (b.animals < an.cap + (g.mods.penAdd || 0) && (g.dawns % 2 === 0 || b.fedDay >= g.dawns - 1)) b.animals++; }
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
