// Creates a village and advances it in time. This is the only entry point the
// browser layer (or a test) needs: createGame(), update(g, dt), plus commands.js.
import { DAY, ADVANCE_TIME, AGES, WAKE } from './config.js';
import { createWorld, C, layRoad } from './world.js';
import { makeRng } from './rng.js';
import { makeBus, addBuilding, notice, hour } from './state.js';
import { computeBeauty } from './beauty.js';
import { createVillager } from './villagers.js';
import { stepVillager } from './actions.js';
import { autonomyTick } from './autonomy.js';
import { createManager } from './manager.js';
import { makeDirectors } from './directors.js';
import { createLand } from './land.js';
import { createMerchant } from './merchant.js';

export const START = { sandbox: { wood: 2000, stone: 1000, gold: 1000, food: 1000, water: 600, clay: 0, fiber: 0, pottery: 0, cloth: 0, furniture: 0 }, modest: { wood: 100, stone: 0, gold: 0, food: 60, water: 40, clay: 0, fiber: 0, pottery: 0, cloth: 0, furniture: 0 } };

// New games: map generator 2 and a campfire, no town center (you place it).
// classic: true rebuilds the original setup (generator 1, town center already standing) for older saves and tests.
export function createGame({ seed = 0, sandbox = true, rngSeed, gen, classic = false } = {}) {
  gen = gen ?? (classic ? 1 : 2);
  const g = {
    seed, gen, classic, w: createWorld(seed, gen), rng: makeRng(rngSeed ?? seed * 7919 + 17),
    clock: 0, tod: 0.2, res: { ...(sandbox ? START.sandbox : START.modest) },
    age: 0, adv: 0, owned: {}, mods: { gather: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, carry: 8, farmFood: 100, farmRate: 1, speed: 2.4 },
    buildings: [], bmap: new Map(), villagers: [], nextId: 1, nameI: 0,
    rally: null, focus: 0, freeWill: true, sandbox, ready: false,
    unlocked: {}, culture: 0, events: makeBus(), crossed: [], dawns: 0, today: { in: {}, out: {} }, yday: null, beauty: null, beautyDirty: true, beautyT: 0,
  };
  if (classic) addBuilding(g, 'tc', C, C, true);
  addBuilding(g, 'campfire', g.w.fire.x, g.w.fire.y, true);
  ensureRoad(g);
  for (const [x, y] of [[C - 1, C + 1], [C, C + 3], [C + 2, C + 3]]) createVillager(g, x, y);
  g.manager = createManager(makeDirectors());
  g.land = createLand(g);
  g.merchant = createMerchant(g);
  g.manager.arbitrate(g);
  return g;
}

// The merchant road runs from the campfire to the nearest map edge. Re-laid after a load so older saves get one too.
export function ensureRoad(g) {
  g.w.road.fill(0); g.w.roadEnd = null;
  layRoad(g.w, g.w.fire.x, g.w.fire.y);
}

export function update(g, dt) {
  dt = Math.max(0, Math.min(dt, 0.1));
  const h0 = Math.floor(hour(g));
  g.clock += dt;
  g.tod = (g.tod + dt / DAY) % 1;
  const h1 = Math.floor(hour(g));
  g.crossed = h1 !== h0 ? [h1] : [];  // whole hours that began this step (directors react to these)
  if (h1 !== h0 && h1 === WAKE) { g.dawns++; g.yday = g.today; g.today = { in: {}, out: {} }; }
  if (g.adv > 0) {
    g.adv -= dt;
    if (g.adv <= 0) { g.adv = 0; g.age++; g.events.emit('age', g.age); notice(g, `${AGES[g.age].name} Age reached. New buildings and upgrades are available.`); }
  }
  g.land.tick(dt);
  g.merchant.tick(dt);
  g.manager.tick(g, dt);
  for (const v of g.villagers) { autonomyTick(g, v, dt); stepVillager(g, v, dt); }
  if (g.villagers.some(v => v.gone)) { for (const v of g.villagers) if (v.gone) g.events.emit('left', v); g.villagers = g.villagers.filter(v => !v.gone); }
  g.beautyT -= dt;
  if (g.beautyDirty && g.beautyT <= 0) { computeBeauty(g); g.beautyT = 2; }
}

// Run the simulation forward quickly (tests, catch-up).
export function simulate(g, seconds, step = 0.05) { for (let t = 0; t < seconds; t += step) update(g, step); }
