// Player commands: the only way the interface changes the village.
// Player orders always win over autonomy and lock it until the task ends.
import { dims, BUILD, TIERS, UPGRADES, AGES, ADVANCE_TIME, VILLAGER_COST, TRADE, KEY_NODE, NODE_INFO } from './config.js';
import { bfs } from './path.js';
import { idx, isOpen, nodeKind, besideRect, walkable, inMap, DIRS8 } from './world.js';
import { siteOk, relocate, canTakeDown, takeDown, have, pay, addBuilding, removeBuilding, popCap, notice, addRes, levelName, hub, townCenter, hasMarket } from './state.js';
import { upgradeTarget } from './directors.js';
import { stepCost } from './actions.js';
import { homeScore, beautyLabel } from './beauty.js';
import { PRI, RES } from './config.js';
import { action, command, enqueue, createVillager, finish } from './villagers.js';

const SPREAD = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

export function orderGather(g, vs, node) {
  const k = nodeKind(g.w, node);
  if (!k) return false;
  for (const v of vs) command(g, v, action('gather', { kind: k, node, key: NODE_INFO[k].key, why: 'Following your lead.' }));
  return true;
}
export function orderFarm(g, vs, b) { for (const v of vs) command(g, v, action('farm', { b: b.id, key: 'farm', why: 'Following your lead.' })); return true; }
export function orderBuild(g, vs, b) { for (const v of vs) command(g, v, action('build', { b: b.id, key: 'build', why: 'Building what you asked for.' })); return true; }
export function orderPlant(g, v, x, y) {
  if (!isOpen(g.w, x, y)) return false;
  command(g, v, action('plant', { x, y, key: 'plant', why: 'Planting where you asked.' }));
  return true;
}
export function orderMove(g, vs, x, y) {
  let any = false;
  vs.forEach((v, n) => {
    let tx2 = null, ty2 = null;
    for (let o = 0; o < SPREAD.length; o++) {
      const [dx, dy] = SPREAD[(n + o) % SPREAD.length];
      if (walkable(g.w, x + dx, y + dy)) { tx2 = x + dx; ty2 = y + dy; break; }
    }
    if (tx2 === null) { // blocked: walk to the reachable tile nearest the spot instead
      const p = bfs(g.w, Math.round(v.x), Math.round(v.y), (a, b) => Math.max(Math.abs(a - x), Math.abs(b - y)) <= 2);
      if (p) [tx2, ty2] = p.length ? p[p.length - 1] : [Math.round(v.x), Math.round(v.y)];
    }
    if (tx2 !== null) { command(g, v, action('move', { x: tx2, y: ty2, why: 'Heading where you asked.' })); any = true; }
  });
  return any;
}

export const canPlace = (g, k, x, y, rot = 0) => {
  const [w, h] = dims(k, rot);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!isOpen(g.w, x + i, y + j)) return false;
  return siteOk(g, k, x, y, rot);
};
// Pick a building up and set it down somewhere else.
export const moveBuilding = (g, b, x, y, rot) => relocate(g, b, x, y, rot, (a, c) => isOpen(g.w, a, c));
// Returns { ok, reason, b }
export function place(g, k, x, y, vs, rot = 0) {
  const def = BUILD[k];
  if (!def || def.age > g.age) return { ok: false, reason: 'Not available yet.' };
  if (def.unlock && !g.unlocked[k]) return { ok: false, reason: 'The merchant sells the plans for this.' };
  if (def.needs && !g.buildings.some(b => b.k === def.needs && b.done)) return { ok: false, reason: `Build a ${BUILD[def.needs].name.toLowerCase()} first.` };
  if (k === 'tc' && g.buildings.some(b => b.k === 'tc')) return { ok: false, reason: 'The village already has a town center.' };
  if (!vs.length) return { ok: false, reason: 'Select a villager to build.' };
  if (!canPlace(g, k, x, y, rot)) return { ok: false, reason: def.nearWater ? 'It needs open ground near water.' : 'That spot is not free.' };
  if (!have(g, def.cost)) return { ok: false, reason: 'Not enough resources yet.' };
  const b = addBuilding(g, k, x, y, false, rot);
  const reach = vs.filter(v => bfs(g.w, Math.round(v.x), Math.round(v.y), (a, c) => besideRect(a, c, x, y, b.w, b.h)));
  if (!reach.length) { removeBuilding(g, b); return { ok: false, reason: 'Your villagers cannot reach that spot.' }; }
  pay(g, def.cost);
  for (const v of reach) enqueue(g, v, action('build', { b: b.id, key: 'build', why: 'Building what you asked for.' }));
  return { ok: true, b };
}

export function train(g) {
  if (g.villagers.length >= popCap(g)) return { ok: false, reason: 'The village is full for now.' };
  if (!pay(g, VILLAGER_COST)) return { ok: false, reason: 'Not enough food yet.' };
  const tc = hub(g);
  const p = bfs(g.w, tc.x, tc.y, (x, y) => besideRect(x, y, tc.x, tc.y, tc.w, tc.h) && walkable(g.w, x, y));
  const [sx, sy] = p && p.length ? p[p.length - 1] : [tc.x - 1, tc.y + 1];
  const v = createVillager(g, sx, sy);
  g.events.emit('trained', v);
  if (g.rally) applyRally(g, v);
  return { ok: true, v };
}
function applyRally(g, v) {
  const r = g.rally;
  if (r.type === 'node' && nodeKind(g.w, r.i)) command(g, v, action('gather', { kind: nodeKind(g.w, r.i), node: r.i, key: NODE_INFO[nodeKind(g.w, r.i)].key, why: 'Heading to the rally point.' }));
  else if (r.type === 'farm' && g.bmap.get(r.id)) command(g, v, action('farm', { b: r.id, key: 'farm', why: 'Heading to the rally point.' }));
  else if (r.type === 'tile') command(g, v, action('move', { x: r.x, y: r.y, why: 'Heading to the rally point.' }));
}
export function setRally(g, target) { g.rally = target; }

export function advance(g) {
  const a = AGES[g.age + 1];
  if (!a || g.adv > 0) return { ok: false };
  if (!townCenter(g)) return { ok: false, reason: 'Build a town center to grow beyond a hamlet.' };
  if ((g.culture || 0) < (a.culture || 0)) return { ok: false, reason: `The village needs more culture first (${Math.floor(g.culture || 0)} of ${a.culture}).` };
  if (!pay(g, a.cost)) return { ok: false, reason: 'Not enough resources yet.' };
  g.adv = ADVANCE_TIME; g.ready = false;
  return { ok: true };
}

export function applyUpgrade(g, u) {
  const fx = u.fx;
  const m = g.mods;
  if (fx.gather) for (const k in fx.gather) m.gather[k] = (m.gather[k] || 1) * fx.gather[k];
  if (fx.carryAdd) m.carry += fx.carryAdd;
  if (fx.farmFoodAdd) m.farmFood += fx.farmFoodAdd;
  if (fx.farmRate) m.farmRate *= fx.farmRate;
  if (fx.speedMul) m.speed *= fx.speedMul;
  if (fx.penAdd) m.penAdd = (m.penAdd || 0) + fx.penAdd;
  if (fx.craft) for (const k in fx.craft) (m.craft || (m.craft = {}))[k] = (m.craft[k] || 1) * fx.craft[k];
}
export function research(g, id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u || g.owned[id] || u.age > g.age) return { ok: false };
  if (u.req && !g.owned[u.req]) return { ok: false, reason: 'Needs the tier before it first.' };
  if (u.at && u.at !== 'tc' && !g.buildings.some(b => b.k === u.at && b.done)) return { ok: false, reason: `Needs a ${BUILD[u.at].name.toLowerCase()}.` };
  if (!pay(g, u.cost)) return { ok: false, reason: 'Not enough resources yet.' };
  g.owned[id] = true; applyUpgrade(g, u);
  g.events.emit('researched', u);
  return { ok: true };
}

export function trade(g, give, get) {
  if (give === get || g.res[give] < TRADE.give || !hasMarket(g)) return { ok: false };
  g.res[give] -= TRADE.give; g.res[get] += TRADE.get;
  return { ok: true };
}

export const buyWare = (g, id) => g.merchant.buy(id);
export const catchCritter = (g, id) => g.nightlife.catch(id);
export { decorateHome } from './critters.js';
export { planFestival as holdFestival } from './festival.js';

export function rename(g, v, name) { const t = String(name).trim().slice(0, 16); if (t) v.name = t; }
export function cycleFocus(g) { g.focus = (g.focus + 1) % 5; g.manager.arbitrate(g); }
// Free will off: villagers stop what they chose themselves (they keep your orders, sleep and meals) and choose nothing new.
export function setFreeWill(g, on) {
  g.freeWill = on;
  if (!on) for (const v of g.villagers) {
    v.stack = v.stack.filter(a => a.src !== 'auto'); v.queue = v.queue.filter(a => a.src !== 'auto');
    if (v.act && (v.act.src === 'auto' || ['egghunt', 'swim', 'trick', 'carol'].includes(v.act.type))) { v.swim = false; finish(g, v); }
  }
}

// Delete or sell anything. Buildings refund their full cost; villagers walk off the map.
// Villagers take a building down: they walk over, work a while (half its build time, at least 3 s), and its full cost returns.
export function orderDemolish(g, vs, b) {
  if (!canTakeDown(b)) return { ok: false, reason: b && b.k === 'campfire' ? 'The campfire stays: it is where the village began.' : 'The town center stays.' };
  if (!vs.length) return { ok: false, reason: 'Select a villager first.' };
  for (const v of vs) command(g, v, action('demolish', { b: b.id, key: 'demolish', why: `Taking down the ${BUILD[b.k].name.toLowerCase()}.` }));
  b.demolish = true;
  return { ok: true };
}
export function removeThing(g, t) {
  if (t.type === 'building') {
    const b = t.b;
    if (!canTakeDown(b) || !g.bmap.has(b.id)) return { ok: false, reason: b && b.k === 'campfire' ? 'The campfire stays: it is where the village began.' : 'The town center stays.' };
    // The nearest villager walks over and takes it down (or it simply goes, if nobody is around).
    const v = [...g.villagers].filter(v => !(v.act && v.act.type === 'leave')).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
    if (v && orderDemolish(g, [v], b).ok) return { ok: true, v };
    takeDown(g, b);
    return { ok: true };
  }
  if (t.type === 'villager') {
    const v = t.v;
    if (!v || v.gone) return { ok: false };
    v.queue = []; v.stack = []; v.path = []; v.inside = false; v.act = null; v.held = false;
    command(g, v, action('leave', { why: 'Saying goodbye and heading off.' }));
    v.act.pri = PRI.SLEEP + 1;
    notice(g, `${v.name} says goodbye and heads off.`);
    return { ok: true };
  }
  if (t.type === 'node') { g.w.A[t.i] = 0; g.w.R[t.i] = 0; g.beautyDirty = true; return { ok: true }; }
  if (t.type === 'sapling') { g.w.G[t.i] = 0; return { ok: true }; }
  return { ok: false };
}

// What it would take to improve a building right now: { to, cost, reason } (reason is set when it can't).
export function improveInfo(g, b) {
  const tiers = TIERS[b.k];
  if (!tiers || !b.done) return { reason: 'This building has no levels.' };
  if (b.lvl >= tiers.length - 1) return { reason: 'Already at its finest.' };
  const next = tiers[b.lvl + 1], to = upgradeTarget(g, b);
  if (to <= b.lvl) {
    if (next.age > g.age) return { next, reason: `The ${next.name.toLowerCase()} arrives in the ${AGES[next.age].name} Age.` };
    return { next, reason: `Needs ${beautyLabel(next.need).toLowerCase()} surroundings (${next.need}); now ${homeScore(g, b).toFixed(1)}.` };
  }
  const cost = stepCost(b, to);
  const noGoods = (tiers[to].goods || []).filter(r => g.res[r] < 1);
  return { to, next: tiers[to], cost, reason: have(g, cost) ? null : noGoods.length ? `Needs ${noGoods.join(' and ')} in the stores.` : 'Not enough materials yet.' };
}
// Player asks for an improvement: the nearest awake villager goes to do it.
export function improve(g, b) {
  const info = improveInfo(g, b);
  if (info.reason) return { ok: false, reason: info.reason };
  const vs = g.villagers.filter(v => !v.inside && !(v.act && v.act.type === 'sleep' && v.act.phase === 'sleep'));
  if (!vs.length) return { ok: false, reason: 'Everyone is asleep.' };
  const v = vs.sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
  command(g, v, action('upgrade', { b: b.id, to: info.to, key: 'upgrade', why: `Improving the ${levelName(b).toLowerCase()}, as you asked.` }));
  return { ok: true, v, to: info.to };
}
