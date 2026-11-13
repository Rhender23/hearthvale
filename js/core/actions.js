// What villagers can do. Each action is a small step machine: it sets a path,
// waits to arrive, works, and returns RUN, DONE or FAIL.
import { NODE_INFO, BUILD, TIERS, RESOW_COST, WATER_RATE, UPGRADE_TIME, N, RES } from './config.js';
import { bfs } from './path.js';
import { walkable, inMap, idx, tx, ty, DIRS8, besideRect, isOpen, nodeKind, isShore } from './world.js';
import { addRes, isNight, completeBuilding, canStore, acceptsAt, record, pay, have, notice, beds, levelName, cap } from './state.js';
import { finish, action } from './villagers.js';

const RUN = 0, DONE = 1, FAIL = 2;
const FARM_KIND = 6;
const at = v => [Math.round(v.x), Math.round(v.y)];
const cheb = (x, y, a, b) => Math.max(Math.abs(x - a), Math.abs(y - b));
const phase = (a, p) => { a.phase = p; a.t = 0; a.tries = 0; return RUN; };

// Walk until goal(x,y) holds where the villager stands.
function go(g, v, a, goal) {
  if (v.path.length) return 'walking';
  const [px, py] = at(v);
  if (goal(px, py)) return 'arrived';
  if (a.tries++ > 4) return 'fail';
  const p = bfs(g.w, px, py, goal);
  if (!p) return 'fail';
  v.path = p;
  return p.length ? 'walking' : 'arrived';
}
function adjKind(w, x, y, k, ok) {
  for (const [dx, dy] of DIRS8) { const a = x + dx, b = y + dy; if (inMap(a, b) && nodeKind(w, idx(a, b)) === k && (!ok || ok(idx(a, b)))) return idx(a, b); }
  return -1;
}
const isDropoff = (g, x, y, r) => g.buildings.some(b => acceptsAt(g, b, r) && besideRect(x, y, b.x, b.y, b.s));
// Carry goods to the nearest building that holds them. Returns 'done', 'walking', 'fail' or 'full'.
function haul(g, v, a) {
  if (v.carry <= 0) return 'done';
  if (!canStore(g, v.carryRes)) { v.why = 'The stores are full.'; return 'full'; }
  if (!a.haulT0) { a.haulT0 = g.clock; a.from = [Math.round(v.x), Math.round(v.y)]; }
  const s = go(g, v, a, (x, y) => isDropoff(g, x, y, v.carryRes));
  if (s !== 'arrived') return s;
  addRes(g, v.carryRes, v.carry); record(g, 'in', v.carryRes, v.carry);
  g.events.emit('delivered', { v, res: v.carryRes, n: v.carry, walk: g.clock - a.haulT0, from: a.from });
  a.haulT0 = 0;
  v.carry = 0; v.carryRes = null; v.carryKind = 0;
  return 'done';
}
// Before switching to different work, put down goods that have nowhere to go.
function setDownIfFull(g, v) { if (v.carry > 0 && !canStore(g, v.carryRes)) { v.carry = 0; v.carryRes = null; v.carryKind = 0; } }
const hauling = (g, v, a, next) => {
  const s = haul(g, v, a);
  if (s === 'fail') return FAIL;
  if (s === 'full') return a.src === 'auto' ? DONE : RUN; // player orders wait for space
  if (s !== 'done') return RUN;
  if (a.src === 'auto' && a.started) return DONE; // one trip, then re-decide
  a.started = true;
  return phase(a, next);
};
function face(v, x, y) { const d = (x - v.x) - (y - v.y); if (d) v.dir = d > 0 ? 1 : -1; }

const H = {
  gather(g, v, a, dt) {
    const w = g.w, k = a.kind, info = NODE_INFO[k];
    switch (a.phase) {
      case 'start':
        if (v.carry > 0 && v.carryKind !== k) setDownIfFull(g, v);
        return phase(a, v.carry > 0 && v.carryKind !== k ? 'haul' : 'find');
      case 'find': {
        if (a.node != null && nodeKind(w, a.node) === k) return phase(a, 'go');
        // Prefer healthy spots (Nature's steering): only fall back to nearly used-up ones if nothing else is reachable.
        const [px, py] = at(v), healthy = i => w.A[i] >= NODE_INFO[k].amt * 0.25;
        const here = adjKind(w, px, py, k, healthy);
        if (here >= 0) { a.node = here; return phase(a, 'go'); }
        let p = bfs(w, px, py, (x, y) => adjKind(w, x, y, k, healthy) >= 0), pick = healthy;
        if (!p) { p = bfs(w, px, py, (x, y) => adjKind(w, x, y, k) >= 0); pick = null; }
        if (!p) return v.carry > 0 ? phase(a, 'haul') : FAIL;
        const end = p.length ? p[p.length - 1] : [px, py];
        a.node = adjKind(w, end[0], end[1], k, pick); v.path = p;
        return phase(a, 'go');
      }
      case 'go': {
        if (nodeKind(w, a.node) !== k) { a.node = null; return phase(a, 'find'); }
        const nx = tx(a.node), ny = ty(a.node), s = go(g, v, a, (x, y) => cheb(x, y, nx, ny) === 1);
        if (s === 'fail') { a.node = null; a.fails = (a.fails || 0) + 1; return a.fails > 3 ? FAIL : phase(a, 'find'); }
        if (s === 'arrived') { face(v, nx, ny); return phase(a, 'work'); }
        return RUN;
      }
      case 'work': {
        if (nodeKind(w, a.node) !== k) { a.node = null; return phase(a, 'find'); }
        a.t += dt;
        if (a.t < info.rate * (g.mods.gather[k] || 1)) return RUN;
        a.t = 0;
        if (--w.A[a.node] <= 0) { w.A[a.node] = 0; w.R[a.node] = 0; w.F[a.node] = 0; g.events.emit('depleted', { i: a.node, k }); a.node = null; }
        if (v.carryKind !== k) v.carry = 0;
        v.carryKind = k; v.carryRes = info.res; v.carry++;
        g.events.emit('gathered', { v, k });
        if (v.carry >= g.mods.carry) return phase(a, 'haul');
        if (a.node == null) return phase(a, 'find');
        return RUN;
      }
      case 'haul': return hauling(g, v, a, 'find');
    }
    return FAIL;
  },

  farm(g, v, a, dt) {
    const b = g.bmap.get(a.b);
    const crop = b && BUILD[b.k].crop;
    if (!b || !b.done || !crop) return FAIL;
    switch (a.phase) {
      case 'start': if (v.carry > 0 && v.carryRes !== crop) setDownIfFull(g, v); return phase(a, v.carry > 0 && v.carryRes !== crop ? 'haul' : 'go');
      case 'go': {
        const s = go(g, v, a, (x, y) => besideRect(x, y, b.x, b.y, b.s));
        if (s === 'fail') return FAIL;
        if (s === 'arrived') { face(v, b.x + 0.5, b.y + 0.5); return phase(a, 'work'); }
        return RUN;
      }
      case 'work': {
        if (b.food <= 0) {
          if (g.res.wood < RESOW_COST) { v.why = 'Waiting for wood to re-sow the field.'; return FAIL; }
          g.res.wood -= RESOW_COST; record(g, 'out', 'wood', RESOW_COST); b.food = b.k === 'farm' ? g.mods.farmFood : BUILD[b.k].food; g.events.emit('resown', b);
        }
        a.t += dt;
        if (a.t < 0.9 * g.mods.farmRate) return RUN;
        a.t = 0; b.food--;
        if (v.carryRes !== crop) v.carry = 0;
        v.carryKind = FARM_KIND; v.carryRes = crop; v.carry++;
        return v.carry >= g.mods.carry ? phase(a, 'haul') : RUN;
      }
      case 'haul': return hauling(g, v, a, 'go');
    }
    return FAIL;
  },

  // Fetch water from a well (fast, limited) or any shoreline tile (slower, endless).
  water(g, v, a, dt) {
    const w = g.w, well = () => { const b = a.well && g.bmap.get(a.well); return b && b.done && b.water >= 1 ? b : null; };
    switch (a.phase) {
      case 'start':
        if (v.carry > 0 && v.carryRes !== 'water') setDownIfFull(g, v);
        return phase(a, v.carry > 0 && v.carryRes !== 'water' ? 'haul' : 'find');
      case 'find': {
        if (a.well && !well()) a.well = null;
        if (a.well || a.shore) return phase(a, 'go');
        const [px, py] = at(v);
        const wellAt = (x, y) => g.buildings.find(b => b.k === 'well' && b.done && b.water >= 1 && besideRect(x, y, b.x, b.y, b.s));
        const p = bfs(w, px, py, (x, y) => !!wellAt(x, y) || isShore(w, x, y));
        if (!p) return v.carry > 0 ? phase(a, 'haul') : FAIL;
        const [ex, ey] = p.length ? p[p.length - 1] : [px, py], b = wellAt(ex, ey);
        if (b) a.well = b.id; else a.shore = [ex, ey];
        v.path = p;
        return phase(a, 'go');
      }
      case 'go': {
        const b = well(), sh = a.shore;
        if (a.well && !b) { a.well = null; return phase(a, 'find'); }
        const s = b ? go(g, v, a, (x, y) => besideRect(x, y, b.x, b.y, b.s)) : go(g, v, a, (x, y) => x === sh[0] && y === sh[1]);
        if (s === 'fail') { a.well = null; a.shore = null; a.fails = (a.fails || 0) + 1; return a.fails > 3 ? FAIL : phase(a, 'find'); }
        return s === 'arrived' ? phase(a, 'work') : RUN;
      }
      case 'work': {
        const b = well();
        if (a.well && !b) { a.well = null; return phase(a, 'find'); }
        a.t += dt;
        if (a.t < (b ? WATER_RATE.well : WATER_RATE.shore)) return RUN;
        a.t = 0;
        if (b) b.water -= 1;
        if (v.carryRes !== 'water') v.carry = 0;
        v.carryRes = 'water'; v.carryKind = 7; v.carry++;
        return v.carry >= g.mods.carry ? phase(a, 'haul') : RUN;
      }
      case 'haul': return hauling(g, v, a, 'find');
    }
    return FAIL;
  },

  // A specialist works their workshop: takes the inputs from the stores, works, carries the goods to storage.
  craft(g, v, a, dt) {
    const b = g.bmap.get(a.b), c = b && BUILD[b.k].craft;
    if (!b || !b.done || !c) return FAIL;
    const outRes = Object.keys(c.out)[0];
    switch (a.phase) {
      case 'start': if (v.carry > 0 && v.carryRes !== outRes) setDownIfFull(g, v); return phase(a, v.carry > 0 && v.carryRes !== outRes ? 'haul' : 'go');
      case 'go': {
        const s = go(g, v, a, (x, y) => besideRect(x, y, b.x, b.y, b.s));
        if (s === 'fail') return FAIL;
        if (s !== 'arrived') return RUN;
        if (outRes !== 'culture' && !canStore(g, outRes)) { v.why = `The stores have no room for more ${outRes}.`; return a.src === 'auto' ? DONE : RUN; }
        if (!pay(g, c.in)) { v.why = `Waiting for ${Object.keys(c.in).join(' and ')}.`; return a.src === 'auto' ? DONE : RUN; }
        for (const r in c.in) record(g, 'out', r, c.in[r]);
        face(v, b.x, b.y);
        return phase(a, 'work');
      }
      case 'work':
        a.t += dt;
        if (a.t < c.time) return RUN;
        if (outRes === 'culture') { g.culture = (g.culture || 0) + c.out.culture; g.events.emit('crafted', { v, b, res: outRes, n: c.out.culture }); return a.src === 'auto' ? DONE : phase(a, 'go'); }
        v.carry = c.out[outRes]; v.carryRes = outRes; v.carryKind = 9;
        g.events.emit('crafted', { v, b, res: outRes, n: v.carry });
        return phase(a, 'haul');
      case 'haul': {
        const s = haul(g, v, a);
        if (s === 'fail') return FAIL;
        if (s === 'full') return a.src === 'auto' ? DONE : RUN;
        if (s !== 'done') return RUN;
        return a.src === 'auto' ? DONE : phase(a, 'go');
      }
    }
    return FAIL;
  },

  // Improve a building to a higher level. The cost of every level climbed is paid when the work starts.
  upgrade(g, v, a, dt) {
    const b = g.bmap.get(a.b), tiers = b && TIERS[b.k];
    if (!b || !b.done || !tiers || a.to <= b.lvl || !tiers[a.to]) return a.phase === 'work' ? DONE : FAIL;
    if (a.phase === 'start') return phase(a, 'go');
    if (a.phase === 'go') {
      const s = go(g, v, a, (x, y) => besideRect(x, y, b.x, b.y, b.s));
      if (s === 'fail') return FAIL;
      if (s !== 'arrived') return RUN;
      const c = stepCost(b, a.to);
      if (!pay(g, c)) { v.why = 'Waiting for materials to improve the ' + levelName(b).toLowerCase() + '.'; return FAIL; }
      for (const r of RES) if (c[r]) record(g, 'out', r, c[r]);
      face(v, b.x, b.y);
      return phase(a, 'work');
    }
    a.t += dt;
    if (a.t < UPGRADE_TIME * (a.to - b.lvl)) return RUN;
    const from = levelName(b);
    b.lvl = a.to; g.beautyDirty = true;
    const t = tiers[b.lvl];
    if (t.water !== undefined) b.water = Math.min(t.water, b.water + (t.water - tiers[0].water));
    g.events.emit('upgraded', b);
    notice(g, `${v.name} turned the ${from.toLowerCase()} into a ${t.name.toLowerCase()}.`);
    return DONE;
  },

  // Walk to the nearest edge of the map and leave the village.
  leave(g, v, a) {
    const s = go(g, v, a, (x, y) => x === 0 || y === 0 || x === N - 1 || y === N - 1);
    if (s === 'fail') { v.gone = true; return DONE; }
    if (s === 'arrived') { v.gone = true; return DONE; }
    return RUN;
  },

  build(g, v, a, dt) {
    const b = g.bmap.get(a.b);
    if (!b) return FAIL;
    if (b.done) { // someone else finished it; a player-sent builder still takes up the new field
      if (b.k === 'farm' && a.src === 'player') a.next = action('farm', { b: b.id, src: a.src, pri: a.pri, key: 'farm', why: 'Tending the new field.' });
      return DONE;
    }
    if (a.phase === 'start') return phase(a, 'go');
    if (a.phase === 'go') {
      const s = go(g, v, a, (x, y) => besideRect(x, y, b.x, b.y, b.s));
      if (s === 'fail') return FAIL;
      if (s === 'arrived') { face(v, b.x, b.y); return phase(a, 'work'); }
      return RUN;
    }
    b.prog += dt;
    if (b.prog >= b.time) {
      completeBuilding(g, b);
      if (b.k === 'farm') a.next = action('farm', { b: b.id, src: a.src, pri: a.pri, key: 'farm', why: 'Tending the new field.' });
      return DONE;
    }
    return RUN;
  },

  // Nature's path keeping: fell a tree or pull a sapling that crowds a building or the road. Wood goes to the stores.
  clear(g, v, a, dt) {
    const w = g.w, i = a.i, x = tx(i), y = ty(i), there = () => w.G[i] > 0 || (w.R[i] === 1 && w.A[i] > 0);
    if (!there()) return a.phase === 'work' ? DONE : FAIL;
    if (a.phase === 'start') return phase(a, 'go');
    if (a.phase === 'go') {
      const s = go(g, v, a, (px, py) => cheb(px, py, x, y) === 1);
      if (s === 'fail') return FAIL;
      if (s === 'arrived') { face(v, x, y); return phase(a, 'work'); }
      return RUN;
    }
    a.t += dt * v.eff;
    if (a.t < (w.G[i] > 0 ? 2 : 5)) return RUN;
    if (w.R[i] === 1 && w.A[i] > 0) { const n = Math.min(w.A[i], Math.max(0, cap(g, 'wood') - g.res.wood)); if (n > 0) { addRes(g, 'wood', n); record(g, 'in', 'wood', n); } }
    w.R[i] = 0; w.A[i] = 0; w.G[i] = 0; w.F[i] = 0;
    g.events.emit('cleared', i);
    return DONE;
  },

  plant(g, v, a, dt) {
    if (a.phase === 'start') return isOpen(g.w, a.x, a.y) ? phase(a, 'go') : FAIL;
    if (a.phase === 'go') {
      const s = go(g, v, a, (x, y) => cheb(x, y, a.x, a.y) === 1);
      if (s === 'fail') return FAIL;
      if (s === 'arrived') { face(v, a.x, a.y); return phase(a, 'work'); }
      return RUN;
    }
    a.t += dt;
    if (a.t < 2) return RUN;
    if (isOpen(g.w, a.x, a.y)) { g.w.G[idx(a.x, a.y)] = 1; g.events.emit('planted', { x: a.x, y: a.y }); }
    return DONE;
  },

  move(g, v, a) {
    const s = go(g, v, a, (x, y) => x === a.x && y === a.y);
    return s === 'arrived' ? DONE : s === 'fail' ? FAIL : RUN;
  },

  rest(g, v, a, dt) {
    if (a.phase === 'start') {
      const bench = a.bench && g.bmap.get(a.bench);
      if (bench && bench.done) {
        const p = bfs(g.w, Math.round(v.x), Math.round(v.y), (x, y) => besideRect(x, y, bench.x, bench.y, 1));
        if (p) { v.path = p; return phase(a, 'wait'); }
      }
      if (a.wander) {
        const [px, py] = at(v);
        for (let n = 0; n < 6; n++) {
          const x = px + g.rng.int(9) - 4, y = py + g.rng.int(9) - 4;
          if (walkable(g.w, x, y)) { const p = bfs(g.w, px, py, (a2, b2) => a2 === x && b2 === y); if (p) { v.path = p; break; } }
        }
      }
      return phase(a, 'wait');
    }
    a.t += dt;
    return a.t >= a.dur ? DONE : RUN;
  },

  sit(g, v, a, dt) {
    const tv = a.tavern && g.bmap.get(a.tavern), f = tv ? { x: tv.x + 0.5, y: tv.y + 0.5 } : g.w.fire;
    if (a.phase === 'start') {
      const spots = tv ? [] : DIRS8.map(([dx, dy]) => [f.x + dx, f.y + dy]).filter(([x, y]) => walkable(g.w, x, y));
      if (tv) for (let y = tv.y - 1; y <= tv.y + tv.s; y++) for (let x = tv.x - 1; x <= tv.x + tv.s; x++) if (besideRect(x, y, tv.x, tv.y, tv.s) && walkable(g.w, x, y)) spots.push([x, y]);
      if (!spots.length) return FAIL;
      [a.x, a.y] = g.rng.pick(spots);
      return phase(a, 'go');
    }
    if (a.phase === 'go') {
      const s = go(g, v, a, (x, y) => x === a.x && y === a.y);
      if (s === 'fail') return FAIL;
      if (s === 'arrived') { face(v, f.x, f.y); return phase(a, 'wait'); }
      return RUN;
    }
    a.t += dt;
    return a.t >= a.dur ? DONE : RUN;
  },

  sleep(g, v, a) {
    if (!isNight(g)) return DONE;
    if (a.bed && !g.bmap.has(a.bed)) { a.bed = null; v.inside = false; return phase(a, 'start'); }
    if (a.phase === 'start') {
      const [px, py] = at(v);
      let best = null, bd = 1e9;
      for (const b of g.buildings) {
        const cap = beds(b);
        if (!cap || b.sleepers >= cap) continue;
        const d = Math.hypot(b.x - px, b.y - py);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) { best.sleepers++; a.bed = best.id; }
      else {
        const f = g.w.fire, taken = g.villagers.filter(u => u !== v && u.act && u.act.type === 'sleep' && !u.act.bed).length;
        const ring = DIRS8.map(([dx, dy]) => [f.x + dx, f.y + dy]).filter(([x, y]) => walkable(g.w, x, y));
        [a.x, a.y] = ring.length ? ring[taken % ring.length] : [px, py];
      }
      return phase(a, 'go');
    }
    if (a.phase === 'go') {
      const b = a.bed && g.bmap.get(a.bed);
      const s = b ? go(g, v, a, (x, y) => besideRect(x, y, b.x, b.y, b.s)) : go(g, v, a, (x, y) => x === a.x && y === a.y);
      if (s === 'fail') { if (b) { b.sleepers--; a.bed = null; } return phase(a, 'start'); }
      if (s === 'arrived') { if (b) v.inside = true; return phase(a, 'sleep'); }
      return RUN;
    }
    return RUN; // sleeping until morning
  },
};

function move(g, v, dt) {
  const [nx, ny] = v.path[0];
  if (!walkable(g.w, nx, ny)) { v.path = []; v.moving = false; return; }
  const onPath = g.w.wk[idx(Math.round(v.x), Math.round(v.y))] === 1, dx = nx - v.x, dy = ny - v.y, d = Math.hypot(dx, dy), st = g.mods.speed * dt * (onPath ? 1.2 : 1);
  v.moving = true;
  if (dx - dy !== 0) v.dir = dx - dy > 0 ? 1 : -1;
  if (d <= st) { v.x = nx; v.y = ny; v.path.shift(); if (!v.path.length) v.moving = false; }
  else { v.x += dx / d * st; v.y += dy / d * st; }
}

export function stepVillager(g, v, dt) {
  const e = dt * v.eff;
  if (v.path.length) move(g, v, e);
  if (!v.act || v.path.length) return;
  const a = v.act, st = H[a.type](g, v, a, e);
  if (st === RUN) return;
  if (st === FAIL && a.src === 'player') { v.why = "Couldn't reach that."; g.events.emit('failed', { v, a }); }
  if (st === DONE && a.next) { v.act = a.next; v.why = a.next.why || v.why; return; }
  finish(g, v);
}
export const ACTION_TYPES = Object.keys(H);

// Total cost of climbing from a building's current level to level `to`.
export function stepCost(b, to) {
  const c = {}, tiers = TIERS[b.k];
  for (let l = b.lvl + 1; l <= to; l++) for (const r in tiers[l].cost) c[r] = (c[r] || 0) + tiers[l].cost[r];
  // A home moving up needs one of each good its new level uses, in stock.
  for (const r of tiers[to].goods || []) c[r] = (c[r] || 0) + 1;
  return c;
}
