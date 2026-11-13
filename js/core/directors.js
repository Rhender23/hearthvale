// Directors. Each owns one part of the village and has:
//   seeks    - what it is trying to achieve
//   rules    - what it never does
//   prefs    - tunable numbers
//   patterns - its routines
//   tick()   - per-frame upkeep of its own domain
//   think()  - once a second: posts wishes (activity weights for villagers) and demands (asks of other Directors)
// Directors influence the world; they never command villagers or address the player with instructions.
import { BUILD, TIERS, AGES, NODE, PRI, MEAL_HOURS, RATION, DAY, WAKE, N, SLIDE_DAYS, SLIDE_MARGIN, SOCIAL, ROLE_NAME, LEAVE_HUNGRY_DAYS, GOODS_USE_DAYS, GOODS, CULTURE, UPGRADES } from './config.js';
import { research, advance } from './commands.js';
import { idx, inMap, isOpen, countNear, walkable, besideRect, DIRS8, buildingNear } from './world.js';
import { hour, isNight, nextAgeCost, have, pay, popCap, notice, cap, bedTotal, beds, addBuilding, removeBuilding, levelName, tierOf, hub, hasMarket, campfire, townCenter } from './state.js';
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
  prefs: { daysOfRations: 2, woodBase: 150, woodPerSite: 60, longWalk: 20 },
  patterns: ['Reads the stores every second', 'Quietly prepares for the next big step: a town center, a marketplace, then each age', 'Notices long walks to drop off goods'],
  needs: {}, walk: {}, from: {}, cd: 30, readyAge: 0, bound: false,
  tick(g, dt) {
    if (!this.bound) { this.bound = true; g.events.on('delivered', ({ res, walk, from }) => { this.walk[res] = (this.walk[res] ?? walk) * 0.8 + walk * 0.2; this.from[res] = from; }); }
    this.cd -= dt;
    if ((this.needs.food > 0.7 || this.needs.water > 0.7) && this.cd <= 0) { this.cd = 240; notice(g, this.needs.water > this.needs.food ? 'The water barrels are running low.' : 'The pantry is running low.'); }
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
    const asked = {}; for (const d of demandsFor(g, 'Economy')) if (d.res) asked[d.res] = (asked[d.res] || 0) + d.amount;
    const need = (k, want) => { const c = cap(g, k), t = Math.min(c, want + (asked[k] || 0)); return r[k] >= c || t <= 0 ? 0 : clamp01((t - r[k]) / t); };
    const n = this.needs = {
      food: need('food', Math.max(rations(g, pop, p.daysOfRations), nx.food || 0)),
      water: need('water', Math.max(rations(g, pop, p.daysOfRations), nx.water || 0)),
      wood: need('wood', Math.max(p.woodBase + p.woodPerSite * sites, nx.wood || 0)),
      stone: need('stone', nx.stone || 0),
      gold: need('gold', nx.gold || 0),
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
    if (has('weaver') && g.res.fiber < 20 && r.fiber < cap(g, 'fiber')) post('Economy', 'fiberfield', g.res.fiber < 6 ? 0.8 : 0.45, g.res.fiber < 6 ? 'the weaver is out of fiber' : 'the weaver needs fiber');
    if (g.buildings.some(b => BUILD[b.k].craft && b.done)) {
      const hn = homeGoodsNeed(g), short = GOODS.find(r => (hn[r] || 0) + (asked[r] || 0) > g.res[r]);
      post('Economy', 'craft', short ? 0.9 : hasMarket(g) ? 0.7 : 0.25, short ? `homes need ${short}` : hasMarket(g) ? 'the merchant will buy it' : 'stocking goods');
    }
    if (n.stone > 0.05) post('Economy', 'stone', 0.15 + 0.6 * n.stone, asked.stone ? 'stone is needed for building' : `preparing for ${goal ? goal.name : 'the future'}`);
    if (n.gold > 0.05) post('Economy', 'gold', 0.15 + 0.6 * n.gold, asked.gold ? 'gold is needed for building' : `preparing for ${goal ? goal.name : 'the future'}`);
    // Storage is requested only when what the village actually needs is more than it can hold.
    const wants = { food: Math.max(rations(g, pop, p.daysOfRations), nx.food || 0) + (asked.food || 0), water: Math.max(rations(g, pop, p.daysOfRations), nx.water || 0) + (asked.water || 0),
      wood: Math.max(p.woodBase + p.woodPerSite * sites, nx.wood || 0) + (asked.wood || 0), stone: (nx.stone || 0) + (asked.stone || 0) };
    for (const k in wants) if (wants[k] > cap(g, k)) demand('Economy', 'Construction', { what: 'storage', amount: wants[k] - cap(g, k), why: `the village needs more ${k} than it can store` });
    for (const k of ['wood', 'stone']) if ((this.walk[k] || 0) > p.longWalk && this.from[k]) demand('Economy', 'Construction', { what: 'storage', near: this.from[k], amount: 1, why: `long walks to drop off ${k}` });
  },
};

// ---------------------------------------------------------------- Villagers
export const Workforce = {
  name: 'Villagers',
  seeks: 'Rested, fed, watered and helpful villagers who spend time together',
  rules: ['The sleep schedule is respected', 'Hunger, thirst and tiredness only slow villagers down, never harm them'],
  prefs: { restWish: 0.12, energyDrain: 1 / 900, energySleep: 1 / 150, mealGain: 0.34, nearTiles: 2 },
  patterns: ['Bed at 11pm, up at 5am', 'Meals at 7:00, 12:00 and 18:00', 'Rests between jobs'],
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
      for (const v of g.villagers) v.social = (v.socialLock || 0) > g.clock ? 1 : Math.max(Math.min(SOCIAL.nearCap, SOCIAL.nearCap * v.comp / SOCIAL.target), Math.min(1, v.tav / SOCIAL.target));
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
  // Every workshop gets one specialist. At most half the village specializes; the rest stay generalists.
  assignRoles(g) {
    for (const v of g.villagers) if (v.job && !g.bmap.has(v.job)) { v.job = null; v.role = null; }
    const shops = g.buildings.filter(b => b.done && BUILD[b.k].craft && !g.villagers.some(v => v.job === b.id));
    if (!shops.length) return;
    const specialists = g.villagers.filter(v => v.job).length;
    if (specialists >= Math.floor(g.villagers.length / 2)) return;
    const free = g.villagers.filter(v => !v.job && !v.held && !(v.act && v.act.src === 'player'));
    if (!free.length) return;
    const b = shops[0], v = free[0], role = BUILD[b.k].craft.role;
    v.job = b.id; v.role = role;
    notice(g, `${v.name} is now the village ${ROLE_NAME[role]}.`);
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
        notice(g, `${v.name} left the village after three days without food.`);
      }
    }
  },
  think(g, post) { post('Villagers', 'rest', this.prefs.restWish, 'taking it easy'); },
};

// ---------------------------------------------------------------- Construction
// Finding a spot: rings outward from an anchor; keeps a one-tile gap around walled buildings so paths stay open.
function spaced(g, k, x, y) {
  const s = BUILD[k].size, flat = BUILD[k].flat || BUILD[k].decor;
  for (const b of g.buildings) {
    if (BUILD[b.k].walk) continue;
    const gap = b.k === 'tc' || b.k === 'campfire' ? 2 : (flat || BUILD[b.k].flat || BUILD[b.k].decor) ? 0 : 1;
    if (x < b.x + b.s + gap && x + s + gap > b.x && y < b.y + b.s + gap && y + s + gap > b.y) return false;
  }
  return true;
}
function findSpot(g, k, ax, ay, opts = {}) {
  const s = BUILD[k].size, tc = hub(g), minR = opts.minR || 0, maxR = opts.maxR || 10;
  let best = null;
  for (let r = minR; r <= maxR && !best; r++) {
    for (let y = ay - r; y <= ay + r; y++) for (let x = ax - r; x <= ax + r; x++) {
      if (Math.max(Math.abs(x - ax), Math.abs(y - ay)) !== r) continue;
      let ok = true;
      for (let j = 0; j < s && ok; j++) for (let i = 0; i < s && ok; i++) if (!isOpen(g.w, x + i, y + j)) ok = false;
      if (!ok || !spaced(g, k, x, y)) continue;
      const score = (opts.score ? opts.score(x, y) : 0) - r;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (!best) return null;
  // Must be reachable from the town center once placed.
  const b = addBuilding(g, k, best.x, best.y, false);
  const reach = bfs(g.w, tc.x - 1, tc.y - 1, (x, y) => besideRect(x, y, b.x, b.y, b.s));
  removeBuilding(g, b); g.nextId--;
  return reach ? best : null;
}
// Highest level a building could reach right now (age and surroundings), ignoring cost.
export function upgradeTarget(g, b) {
  const tiers = TIERS[b.k];
  if (!tiers || !b.done) return b.lvl || 0;
  const score = BUILD[b.k].home ? homeScore(g, b) : 0;
  let to = b.lvl;
  for (let l = b.lvl + 1; l < tiers.length; l++) { if (tiers[l].age > g.age || score < tiers[l].need) break; to = l; }
  return to;
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
      if (sc < need - SLIDE_MARGIN) { const from = levelName(b); b.lvl--; g.beautyDirty = true; notice(g, `The ${from.toLowerCase()} slipped back to a ${levelName(b).toLowerCase()}. Its surroundings had grown ${beautyLabel(sc).toLowerCase()}.`); }
    }
  },
  // Decide whether to start one new building. Returns what it placed (for tests and the Director overlay).
  plan(g) {
    const pop = g.villagers.length, sites = g.buildings.filter(b => !b.done && b.k !== 'tc').length, tc = hub(g);
    this.last = '';
    if (!g.freeWill || sites >= Math.max(1, Math.ceil(pop / this.prefs.sitesPer))) return null;
    const homes = g.buildings.filter(b => BUILD[b.k].home), hx = homes.length ? Math.round(homes.reduce((s, b) => s + b.x, 0) / homes.length) : tc.x, hy = homes.length ? Math.round(homes.reduce((s, b) => s + b.y, 0) / homes.length) : tc.y;
    const beautyAt = (x, y) => (g.beauty ? g.beauty[idx(x, y)] : 0);
    const tryPlace = (k, ax, ay, opts, why) => {
      if (BUILD[k].age > g.age || BUILD[k].placer !== 'village' || (BUILD[k].unlock && !g.unlocked[k]) || !affordable(g, BUILD[k].cost)) return null;
      const spot = findSpot(g, k, ax, ay, opts);
      if (!spot || !pay(g, BUILD[k].cost)) return null;
      const b = addBuilding(g, k, spot.x, spot.y, false);
      this.last = `${BUILD[k].name}: ${why}`;
      g.events.emit('planned', { b, why });
      return b;
    };
    const dem = demandsFor(g, 'Construction');
    // 1. A bed for everyone plus one spare (the spare is what Social needs for newcomers).
    const bedsNow = bedTotal(g), plannedBeds = g.buildings.filter(b => !b.done && BUILD[b.k].home).length * TIERS.house[0].beds;
    if (bedsNow + plannedBeds < pop + 1) return tryPlace('house', hx, hy, { minR: 2, maxR: 9, score: (x, y) => beautyAt(x, y) * 0.5 }, 'everyone needs a bed');
    // 2. Storage where it is full, or near long walks.
    const st = dem.find(d => d.what === 'storage' && d.near) || dem.find(d => d.what === 'storage');
    if (st && !g.buildings.some(b => b.k === 'store' && !b.done)) {
      const [ax, ay] = st.near || [tc.x, tc.y];
      const placed = tryPlace('store', ax, ay, { minR: st.near ? 1 : 3, maxR: 10 }, st.why);
      if (placed) return placed;
    }
    // 3. Farms when food runs short and there are few fields.
    const econ = g.manager.directors.find(d => d.name === 'Economy');
    const farms = g.buildings.filter(b => b.k === 'farm').length;
    if (econ && econ.needs.food > 0.5 && farms < Math.ceil(pop / 3)) { const placed = tryPlace('farm', tc.x, tc.y, { minR: 3, maxR: 9 }, 'food is running short'); if (placed) return placed; }
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
      if (has('weaver') && !has('fiberfield')) { const placed = tryPlace('fiberfield', tc.x, tc.y, { minR: 3, maxR: 10 }, 'the weaver needs fiber'); if (placed) return placed; }
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
      for (const k of ['statue', 'arbor', 'garden', 'lamppost', 'bench', 'flowerbed']) {
        if (BUILD[k].age > g.age || (BUILD[k].unlock && !g.unlocked[k]) || !affordable(g, BUILD[k].cost)) continue;
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
  prefs: { fireWish: 0.5, tavernWish: 0.65, companyTarget: 72, lowSocial: 0.6, arriveChance: 0.5, foodDays: 3 },
  patterns: ['Evenings together from 6pm, at the tavern if there is one', 'Welcomes newcomers when there is room, food and good company'],
  lastLeft: -99,
  tick(g) {
    g.social = g.villagers.length ? g.villagers.reduce((s, v) => s + (v.social ?? 0.4), 0) / g.villagers.length : 0;
    if (crossed(g, WAKE)) this.arrivals(g);
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
    const p2 = bfs(g.w, x, y, (a, b) => besideRect(a, b, tc.x, tc.y, tc.s));
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
    const pop = g.villagers.length, need = rations(g, pop + 1, p.foodDays);
    if (g.res.food < need) demand('Social', 'Economy', { what: 'food for a newcomer', res: 'food', amount: need - g.res.food });
    if (g.res.water < need) demand('Social', 'Economy', { what: 'water for a newcomer', res: 'water', amount: need - g.res.water });
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
    // Culture accrues while villagers are at the fire, the schoolhouse or the theater.
    for (const v of g.villagers) {
      const a = v.act;
      if (a && a.type === 'sit' && a.phase === 'wait' && CULTURE[a.key]) g.culture = (g.culture || 0) + CULTURE[a.key] * dt;
    }
    this.t -= dt;
    if (this.t > 0 || !g.freeWill) return;
    this.t = this.prefs.every;
    const keep = { food: rations(g, g.villagers.length, 1), water: rations(g, g.villagers.length, 1), wood: 40 };
    const spare = cost => Object.entries(cost).every(([r, n]) => g.res[r] - n >= (keep[r] || 0));
    // Next age first: everything else waits while the village is saving up for it.
    const nx = AGES[g.age + 1];
    if (nx && g.ready && g.adv === 0 && spare(nx.cost)) { if (advance(g).ok) notice(g, `The village has decided to grow into the ${nx.name} Age.`); return; }
    if (nx && nx.cost && have(g, nx.cost)) return;
    const u = UPGRADES.filter(u => !g.owned[u.id] && u.age <= g.age && spare(u.cost)).sort((a, b) => b.age - a.age)[0];
    if (u && research(g, u.id).ok) notice(g, `The village took up ${u.name.toLowerCase()}: ${u.desc.toLowerCase()}`);
  },
  think(g, post, demand) {
    const p = this.prefs, h = hour(g), has = k => g.buildings.some(b => b.k === k && b.done);
    if (h >= 8 && h < 17 && has('school')) post('Culture', 'learn', p.learnWish, 'learning something new');
    if (h >= 18 && h < 23 && has('theater')) post('Culture', 'theater', p.theaterWish, 'there is a play tonight');
    if (g.buildings.some(b => b.pending > b.lvl)) post('Culture', 'upgrade', p.ambition, 'the village wants finer homes');
    const nx = AGES[g.age + 1], short = nx && (g.culture || 0) < (nx.culture || 0);
    const ask = (k, why) => { if (BUILD[k].age <= g.age && !g.buildings.some(b => b.k === k)) demand('Culture', 'Construction', { what: 'culture', k, why }); };
    if (townCenter(g)) ask('school', short ? `the ${nx.name} Age needs more culture` : 'a place to learn');
    if (g.age >= 1) { ask('studio', 'the village wants an artist'); if (g.villagers.length >= 5) ask('theater', 'the village wants a stage'); }
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
      const short = want.filter(r => g.res[r] < 1);
      for (const r of want) if (g.res[r] >= 1) { g.res[r] -= 1; used[r] = (used[r] || 0) + 1; g.today.out[r] = (g.today.out[r] || 0) + 1; }
      if (short.length) { const from = levelName(b); b.lvl--; g.beautyDirty = true; slipped.push(`the ${from.toLowerCase()} (no ${short.join(' or ')})`); }
    }
    if (slipped.length) notice(g, `Homes went without goods: ${slipped.join(', ')} slipped back a level.`);
    g.events.emit('goodsday', { used, slipped });
  },
  tick(g) {
    if (crossed(g, WAKE) && g.dawns > 0 && g.dawns % GOODS_USE_DAYS === 0) this.goodsDay(g);
    const isFull = g.villagers.length >= popCap(g);
    if (isFull && !this.full) notice(g, 'The village is full for now.');
    this.full = isFull;
  },
};

const ALL = [Economy, Workforce, Construction, Social, Nature, Culture, Housing];
export const makeDirectors = () => ALL.map(d => {
  const copy = {};
  for (const [k, v] of Object.entries(d)) copy[k] = typeof v === 'function' ? v : structuredClone(v);
  return copy;
});
