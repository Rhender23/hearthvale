// Saving and loading. Only plain data is stored; actions are not, so villagers
// simply re-decide what to do after a load. Unfinished buildings keep their progress.
import { UPGRADES, LEGACY_UPGRADE, BUILD, NODE_INFO, zeroRes } from './config.js';
import { createGame, ensureRoad } from './game.js';
import { addBuilding, removeBuilding } from './state.js';
import { createVillager } from './villagers.js';
import { applyUpgrade } from './commands.js';

export const VERSION = 5;
const b64 = arr => { let s = ''; const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
const unb64 = (str, Type) => { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Type(u.buffer); };

export function serialize(g) {
  return JSON.stringify({
    v: VERSION, seed: g.seed, gen: g.gen, classic: g.classic, sandbox: g.sandbox, clock: g.clock, tod: g.tod, res: g.res, age: g.age, adv: g.adv,
    culture: g.culture || 0, lastFestival: g.lastFestival || 0, caught: g.caught || {}, spent: g.spent || {}, seasonalDone: g.seasonalDone, lastCelebration: g.lastCelebration || 0, pantry: g.pantry || {}, festival: g.festival && g.festival.phase === 'planned' ? g.festival : null, owned: Object.keys(g.owned), unlocked: Object.keys(g.unlocked || {}), rally: g.rally, focus: g.focus, freeWill: g.freeWill, nameI: g.nameI, rng: g.rng.state(), dawns: g.dawns, today: g.today, yday: g.yday,
    R: b64(g.w.R), A: b64(g.w.A), G: b64(g.w.G),
    B: g.buildings.map(b => ({ id: b.id, k: b.k, x: b.x, y: b.y, rot: b.rot || 0, done: b.done, prog: b.prog, food: b.food, water: b.water, lvl: b.lvl, decor: b.decor, animals: b.animals })),
    V: g.villagers.map(v => ({ name: v.name, x: Math.round(v.x), y: Math.round(v.y), col: v.col, energy: v.energy, full: v.full, hyd: v.hyd, comp: v.comp, tav: v.tav, ate: v.ate, hungryDays: v.hungryDays, skin: v.skin, hair: v.hair, role: v.role, jobAt: v.job && g.bmap.get(v.job) ? [g.bmap.get(v.job).x, g.bmap.get(v.job).y] : null, carry: v.carry, carryRes: v.carryRes, carryKind: v.carryKind })),
  });
}

function finishLoad(g, d) {
  for (const raw of d.owned || []) { const id = LEGACY_UPGRADE[raw] || raw, u = UPGRADES.find(x => x.id === id); if (u && !g.owned[id]) { g.owned[id] = true; applyUpgrade(g, u); } }
  g.manager.arbitrate(g);
  return g;
}

export function deserialize(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json;
  // Older saves used flax and linen; they are now fiber and cloth.
  if (d.res) for (const [a, b] of [['flax', 'fiber'], ['linen', 'cloth']]) if (a in d.res) { d.res[b] = (d.res[b] || 0) + d.res[a]; delete d.res[a]; }
  for (const s of d.B || []) if (s.k === 'flaxfield') s.k = 'fiberfield';
  for (const s of d.V || []) if (s.carryRes === 'flax') s.carryRes = 'fiber'; else if (s.carryRes === 'linen') s.carryRes = 'cloth';
  if (![2, 3, 4, VERSION].includes(d.v)) throw new Error('Unknown save version');
  // Saves before v5 come from villages that started with a town center on the original map.
  const old = d.v < 5, g = createGame({ seed: d.seed, sandbox: d.sandbox, gen: old ? 1 : d.gen, classic: old ? true : !!d.classic });
  if (!old) { for (const b of [...g.buildings]) removeBuilding(g, b); }
  Object.assign(g, { clock: d.clock, tod: d.tod, res: { ...zeroRes(), water: 60, ...d.res }, age: d.age, adv: d.adv, culture: d.culture || 0, lastFestival: d.lastFestival ?? d.dawns ?? 0, caught: d.caught || {}, spent: d.spent || {}, seasonalDone: d.seasonalDone ?? -1, lastCelebration: d.lastCelebration ?? d.clock ?? 0, pantry: d.pantry || {}, festival: d.festival || null, rally: d.rally, focus: d.focus || 0, freeWill: d.freeWill !== false, nameI: d.nameI || 0, dawns: d.dawns || 0, today: d.today || { in: {}, out: {} }, yday: d.yday || null });
  if (d.rng) g.rng.setState(d.rng);
  g.w.R.set(unb64(d.R, Uint8Array)); g.w.A.set(unb64(d.A, Int16Array)); g.w.G.set(unb64(d.G, Float32Array));
  const idMap = new Map();
  for (const s of d.B) { if (!BUILD[s.k]) continue; const b = addBuilding(g, s.k, s.x, s.y, s.done, s.rot || 0); b.prog = s.prog; b.food = s.food; if (s.water != null) b.water = s.water; b.lvl = s.lvl || 0; if (s.decor) b.decor = s.decor; if (s.animals != null) b.animals = s.animals; if (s.ruin) { b.done = true; b.prog = b.time; } idMap.set(s.id, b.id); }
  if (g.rally && g.rally.type === 'farm') g.rally.id = idMap.get(g.rally.id);
  g.villagers = [];
  for (const s of d.V) createVillager(g, s.x, s.y, { name: s.name, col: s.col, energy: s.energy, full: s.full, hyd: s.hyd ?? 0.85, comp: s.comp ?? 36, tav: s.tav || 0, ate: s.ate ?? 1, hungryDays: s.hungryDays || 0, ...(s.skin ? { skin: s.skin, hair: s.hair } : {}), role: s.role || null, jobAt: s.jobAt || null, carry: s.carry, carryRes: s.carryRes, carryKind: s.carryKind });
  for (const v of g.villagers) { if (v.jobAt) { const id = g.w.occ[v.jobAt[1] * 40 + v.jobAt[0]]; v.job = id > 0 ? id : null; if (!v.job) v.role = null; } delete v.jobAt; }
  g.nameI = d.nameI || g.villagers.length;
  g.unlocked = {}; for (const k of d.unlocked || []) g.unlocked[k] = true;
  ensureRoad(g);
  return finishLoad(g, d);
}

// The first version of the game stored a different shape under another key.
export function migrateLegacy(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json;
  const g = createGame({ seed: 0, sandbox: true, classic: true });
  const [wood, stone, gold, food] = d.r;
  Object.assign(g, { res: { ...zeroRes(), wood, stone, gold, food, water: 60 }, age: d.age || 0, adv: d.adv || 0, clock: d.clock || 0, tod: d.tod ?? 0.2 });
  if (d.TR && d.TR.length === g.w.A.length) {
    for (let i = 0; i < g.w.A.length; i++) { g.w.A[i] = d.TR[i] > 0 ? d.TR[i] : 0; g.w.R[i] = d.TR[i] > 0 ? (d.RK ? d.RK[i] : 1) : 0; }
    if (d.GS) g.w.G.set(d.GS);
  }
  const ids = [];
  for (const [k, x, y, f, done, p] of d.B || []) { if (!BUILD[k]) continue; const b = addBuilding(g, k, x, y, done !== 0); b.food = f ?? b.food; b.prog = done === 0 ? p || 0 : b.time; ids.push(b.id); }
  g.villagers = [];
  const ckRes = { 1: 'wood', 2: 'stone', 3: 'gold', 4: 'food', 5: 'food' };
  for (const [x, y, col, carry, ck, , , name] of d.V || []) createVillager(g, x, y, { col, name: name || undefined, carry: carry || 0, carryRes: carry ? ckRes[ck] || 'food' : null, carryKind: carry ? ck : 0 });
  for (let i = 0; i < g.villagers.length; i++) if (!g.villagers[i].name) g.villagers[i].name = 'Villager ' + (i + 1);
  g.nameI = g.villagers.length;
  if (d.rally) {
    if (d.rally.t === 'tree') g.rally = { type: 'node', i: d.rally.i };
    else if (d.rally.t === 'move') g.rally = { type: 'tile', x: d.rally.x, y: d.rally.y };
    else if (d.rally.t === 'farm' && ids[d.rally.i - 1]) g.rally = { type: 'farm', id: ids[d.rally.i - 1] };
  }
  return finishLoad(g, { owned: Object.keys(d.own || {}) });
}
