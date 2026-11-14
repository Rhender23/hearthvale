// Shared state helpers used by every core module: resources, buildings, time, events.
import { dims, BUILD, TIERS, DAY, SEASON, BEDTIME, WAKE, AGES, RES, STORE_MULT_SANDBOX } from './config.js';
import { idx } from './world.js';

export function makeBus() {
  const subs = {};
  return {
    on(name, fn) { (subs[name] = subs[name] || []).push(fn); return () => { subs[name] = subs[name].filter(f => f !== fn); }; },
    emit(name, payload) { for (const fn of subs[name] || []) fn(payload); },
  };
}
export const notice = (g, text) => g.events.emit('notice', text);

// Resources
export const have = (g, cost) => !!cost && RES.every(r => g.res[r] >= (cost[r] || 0));
export function pay(g, cost) { if (!have(g, cost)) return false; for (const r of RES) g.res[r] -= cost[r] || 0; return true; }
export function addRes(g, r, n) { g.res[r] = Math.max(0, g.res[r] + n); }
// Daily bookkeeping: what came in and what was used up (rations, repairs, re-sowing).
export function record(g, dir, r, n) { const t = g.today[dir]; t[r] = (t[r] || 0) + n; }
export const net = (g, day, r) => (day.in[r] || 0) - (day.out[r] || 0);

// Levels
export const tierOf = b => (TIERS[b.k] ? TIERS[b.k][b.lvl || 0] : null);
export const levelName = b => (tierOf(b) ? tierOf(b).name : BUILD[b.k].name);
export const beautyOf = b => { const t = tierOf(b); return t && t.beauty !== undefined ? t.beauty : BUILD[b.k].beauty || 0; };

// Storage. Unfinished buildings hold nothing. Levels can replace or multiply a building's storage.
export function storeOf(g, b, r) {
  if (!b.done) return 0;
  if (b.k === 'campfire' && g.buildings.some(o => o.k === 'tc' && o.done)) return 0; // the camp stockpile moves into the town center
  const t = tierOf(b), s = (t && t.store) || BUILD[b.k].store;
  if (!s || !s[r]) return 0;
  return s[r] * ((t && t.storeMult) || 1) * (g.sandbox ? STORE_MULT_SANDBOX : 1);
}
export const cap = (g, r) => g.buildings.reduce((n, b) => n + storeOf(g, b, r), 0);
export const canStore = (g, r) => g.res[r] < cap(g, r);
export const acceptsAt = (g, b, r) => storeOf(g, b, r) > 0;

// Time. `tod` is the fraction of the day; hour 0 is midnight.
export const hour = g => (g.tod * 24 + 6) % 24;
// American 12-hour time: 17 -> '5 PM', 17.5 -> '5:30 PM', 0 -> '12 AM'.
export const clock12 = (h, m = 0, short = true) => { const hh = Math.floor(h) % 24, h12 = hh % 12 || 12, ap = hh < 12 ? 'AM' : 'PM'; return m || !short ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12} ${ap}`; };
export const isNight = g => { const h = hour(g); return h >= BEDTIME || h < WAKE; };
export const dayNumber = g => Math.floor(g.clock / DAY + 0.2) + 1;
export const seasonIndex = g => Math.floor(g.clock / SEASON) % 4;
export const darkness = g => Math.max(0, Math.min(1, 0.5 - Math.sin(g.tod * 6.2832) * 0.9));

// Buildings
export const bById = (g, id) => g.bmap.get(id);
// The village's hub: the town center once it is built, the campfire until then.
export const townCenter = g => g.buildings.find(b => b.k === 'tc' && b.done);
export const campfire = g => g.buildings.find(b => b.k === 'campfire');
export const hub = g => townCenter(g) || campfire(g);
export const hasMarket = g => g.buildings.some(b => b.k === 'market' && b.done);
export function addBuilding(g, k, x, y, done, rot = 0) {
  const def = BUILD[k], [bw, bh] = dims(k, rot), b = { id: g.nextId++, k, x, y, rot, w: bw, h: bh, s: Math.max(bw, bh), done: !!done, prog: done ? def.time : 0, time: def.time, food: def.food || 0, water: def.water || 0, sleepers: 0, lvl: 0 };
  g.buildings.push(b); g.bmap.set(b.id, b);
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) { g.w.occ[idx(x + i, y + j)] = b.id; g.w.wk[idx(x + i, y + j)] = def.walk ? 1 : 0; }
  g.beautyDirty = true;
  return b;
}
export function removeBuilding(g, b) {
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) { g.w.occ[idx(b.x + i, b.y + j)] = 0; g.w.wk[idx(b.x + i, b.y + j)] = 0; }
  g.buildings = g.buildings.filter(o => o !== b); g.bmap.delete(b.id);
  g.beautyDirty = true;
}
export function completeBuilding(g, b) {
  if (b.done) return;
  b.done = true; b.prog = b.time; g.beautyDirty = true;
  if (BUILD[b.k].crop) b.food = b.k === 'farm' ? g.mods.farmFood : BUILD[b.k].food;
  g.events.emit('built', b);
  if (b.k === 'monument') { g.culture = (g.culture || 0) + 50; notice(g, 'The monument stands complete. Hearthvale thrives!'); }
  else if (!BUILD[b.k].decor) notice(g, `The ${BUILD[b.k].name.toLowerCase()} is finished.`);
}
export const beds = b => { if (!b.done) return 0; const t = tierOf(b); return (t && t.beds) || BUILD[b.k].beds || 0; };
export const popCap = g => { const tc = g.buildings.some(o => o.k === 'tc' && o.done); return g.buildings.reduce((n, b) => n + (b.done && !(b.k === 'campfire' && tc) ? (BUILD[b.k].pop || 0) + (BUILD[b.k].home && !BUILD[b.k].pop ? beds(b) : 0) : 0), 0); };
export const bedTotal = g => g.buildings.reduce((n, b) => n + beds(b), 0);
export const sites = g => g.buildings.filter(b => !b.done);
export const nextAgeCost = g => (AGES[g.age + 1] ? AGES[g.age + 1].cost : null);
export const builders = (g, b) => g.villagers.filter(v => v.act && v.act.type === 'build' && v.act.b === b.id).length;
export const farmers = (g, b) => g.villagers.filter(v => v.act && v.act.type === 'farm' && v.act.b === b.id).length;

// Taking a building down: every bit of its cost goes back to the stores. Used by villagers (demolish) and the editor.
export const canTakeDown = b => !!b && !BUILD[b.k].fixed && !(b.k === 'tc' && b.done);
export function takeDown(g, b) {
  if (!canTakeDown(b) || !g.bmap.has(b.id)) return false;
  for (const v of g.villagers) if (v.job === b.id) { v.job = null; v.role = null; }
  for (const r of RES) if (BUILD[b.k].cost[r]) addRes(g, r, BUILD[b.k].cost[r]);
  for (const v of g.villagers) if (v.act && v.act.bed === b.id) { v.inside = false; v.act.bed = null; v.act.phase = 'start'; }
  if (g.rally && g.rally.type === 'farm' && g.rally.id === b.id) g.rally = null;
  removeBuilding(g, b);
  notice(g, `The ${BUILD[b.k].name.toLowerCase()} was taken down. Its materials are back in the stores.`);
  g.events.emit('takenDown', b);
  return true;
}

// Extra placement rules beyond "the ground is open": e.g. a quarry must be near water.
export function siteOk(g, k, x, y, rot = 0) {
  const def = BUILD[k], [w, h] = dims(k, rot);
  if (def.nearWater) {
    const r = def.nearWater; let wet = false;
    for (let j = -r; j < h + r && !wet; j++) for (let i = -r; i < w + r && !wet; i++) { const a = x + i, b = y + j; if (a >= 0 && b >= 0 && a < 40 && b < 40 && g.w.T[idx(a, b)] === 1) wet = true; }
    if (!wet) return false;
  }
  return true;
}
// Move a building somewhere else (any time). Keeps its level, progress and everything in it.
export function relocate(g, b, x, y, rot = b.rot || 0, isOpenFn) {
  if (BUILD[b.k].fixed) return { ok: false, reason: 'The campfire stays where the village began.' };
  const [w, h] = dims(b.k, rot), old = { x: b.x, y: b.y, rot: b.rot || 0, w: b.w, h: b.h };
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) { g.w.occ[idx(b.x + i, b.y + j)] = 0; g.w.wk[idx(b.x + i, b.y + j)] = 0; }
  let ok = siteOk(g, b.k, x, y, rot);
  for (let j = 0; j < h && ok; j++) for (let i = 0; i < w && ok; i++) if (!isOpenFn(x + i, y + j)) ok = false;
  const put = p => { Object.assign(b, p, { s: Math.max(p.w, p.h) }); for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) { g.w.occ[idx(b.x + i, b.y + j)] = b.id; g.w.wk[idx(b.x + i, b.y + j)] = BUILD[b.k].walk ? 1 : 0; } };
  if (!ok) { put(old); return { ok: false, reason: BUILD[b.k].nearWater ? 'It needs open ground near water.' : 'That spot is not free.' }; }
  put({ x, y, rot, w, h });
  for (const v of g.villagers) if (v.inside && v.act && v.act.bed === b.id) v.inside = false;
  g.beautyDirty = true;
  g.events.emit('moved', b);
  return { ok: true };
}
