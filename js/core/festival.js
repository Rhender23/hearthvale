// Festivals: Social's favourite thing. A parade from the town center to the marketplace to the campfire and back,
// half the village marching in pairs behind a banner (and floats, in later ages) while the rest and visitors from
// up the road line the route and cheer. Then a feast by the fire until bedtime.
//
// g.festival: null, or { id, name, day, phase: 'planned' | 'gather' | 'parade' | 'feast', route, s, marchers, cheer, visitors, floats }
import { FESTIVAL, FESTIVALS, SOCIAL, DAY, PRI, BEDTIME } from './config.js';
import { have, pay, notice, townCenter, campfire, hour, bedTotal, popCap, clock12 } from './state.js';
import { bfs, besideTile, bfsVisitor } from './path.js';
import { walkable, besideRect, DIRS8, inMap } from './world.js';
import { action, interrupt, createVillager } from './villagers.js';
import { registerAction, go } from './actions.js';

const RUN = 0, DONE = 1, FAIL = 2;

// What a festival costs this village: its fixed cost plus food for everyone.
export function festivalCost(g, f) { const n = Math.max(1, g.villagers.length), c = { ...f.cost }; for (const r in f.per || {}) c[r] = (c[r] || 0) + f.per[r] * n; return c; }
// The grandest festival this age allows (Social wants this one).
export const wantedFestival = g => [...FESTIVALS].reverse().find(f => f.age <= g.age);
// The grandest festival the village can afford right now.
// Food for the feast comes on top of two days of meals, so a festival never leaves the pantry bare.
const withReserve = (g, c) => ({ ...c, food: (c.food || 0) + 2 * 9 * g.villagers.length, water: (c.water || 0) + 2 * 9 * g.villagers.length });
export const affordableFestival = g => [...FESTIVALS].reverse().find(f => f.age <= g.age && have(g, withReserve(g, festivalCost(g, f))));
export const festivalWant = g => Math.min(1, Math.max(0, g.dawns - (g.lastFestival ?? 0)) * FESTIVAL.wantPerDay);

// Plan a festival for this evening (or tomorrow if it is already late). Used by the player and by Social.
export function planFestival(g, who = 'player') {
  if (g.festival) return { ok: false, reason: `A ${g.festival.name.toLowerCase()} is already planned.` };
  const f = affordableFestival(g);
  if (!f) { const w = wantedFestival(g); return { ok: false, reason: `A ${w.name.toLowerCase()} needs ` + Object.entries(festivalCost(g, w)).map(([r, n]) => `${n} ${r}`).join(', ') + '.' }; }
  const late = hour(g) >= FESTIVAL.startHour - 1 || hour(g) < 5;
  g.festival = { id: f.id, name: f.name, day: g.dawns + (late ? 1 : 0), phase: 'planned', by: who };
  notice(g, `🎉 ${late ? 'Tomorrow evening' : 'This evening'}: a ${f.name.toLowerCase()}! Everyone gathers at ${clock12(FESTIVAL.startHour)}.`);
  return { ok: true, f };
}

function stations(g) {
  const tc = townCenter(g), mk = g.buildings.find(b => b.k === 'market' && b.done), cf = campfire(g);
  return [tc, mk, cf, tc].filter(Boolean).filter((b, i, a) => i === 0 || b !== a[i - 1]);
}
// The parade route: a walkable tile path visiting each station in turn.
function buildRoute(g) {
  const st = stations(g), cf = campfire(g);
  const main = st.length >= 2 ? stationRoute(g, st) : null;
  if (main) return main;
  // No town center yet, or the stations sit side by side: just the loop around the campfire.
  const start = ['-2,-2', '0,-2', '2,-2', '2,0', '2,2', '0,2', '-2,2', '-2,0'].map(k => k.split(',').map(Number)).map(([dx, dy]) => [g.w.fire.x + dx, g.w.fire.y + dy]).find(([x, y]) => walkable(g.w, x, y));
  if (!start) return null;
  const route = [start, ...circleFire(g, start)];
  return route.length > 3 ? route : null;
}
// One full circle around the campfire, starting and ending at `from` (every parade does this).
function circleFire(g, from) {
  const f = g.w.fire, ring = [[-2, -2], [0, -2], [2, -2], [2, 0], [2, 2], [0, 2], [-2, 2], [-2, 0]].map(([dx, dy]) => [f.x + dx, f.y + dy]).filter(([x, y]) => walkable(g.w, x, y));
  if (!ring.length) return [];
  let k = 0, bd = 1e9; ring.forEach(([x, y], i) => { const d = Math.hypot(x - from[0], y - from[1]); if (d < bd) { bd = d; k = i; } });
  const order = [...ring.slice(k), ...ring.slice(0, k), ring[k]], out = []; let cur = from;
  for (const t of order) { const p = bfs(g.w, cur[0], cur[1], (x, y) => x === t[0] && y === t[1]); if (p && p.length) { out.push(...p); cur = t; } }
  const back = bfs(g.w, cur[0], cur[1], (x, y) => x === from[0] && y === from[1]); if (back) out.push(...back);
  return out;
}
function stationRoute(g, st) {
  let cur = besideTile(g.w, st[0]); if (!cur) return null;
  const route = [cur];
  for (let i = 1; i < st.length; i++) {
    const b = st[i], p = bfs(g.w, cur[0], cur[1], (x, y) => besideRect(x, y, b.x, b.y, b.w, b.h));
    if (!p) continue;
    route.push(...p); if (p.length) cur = p[p.length - 1];
    if (b === campfire(g)) { const loop = circleFire(g, cur); route.push(...loop); if (loop.length) cur = loop[loop.length - 1]; }
  }
  return route.length > 3 ? route : null;
}
const posAt = (route, s) => {
  const c = Math.max(0, Math.min(route.length - 1, s)), i = Math.min(route.length - 2, Math.floor(c)), t = c - i;
  return [route[i][0] + (route[i + 1][0] - route[i][0]) * t, route[i][1] + (route[i + 1][1] - route[i][1]) * t];
};
// Places along the route for onlookers: walkable tiles beside the route, spread out.
function cheerSpots(g, route, n) {
  const on = new Set(route.map(([x, y]) => x * 100 + y)), out = [], used = new Set();
  for (let k = 0; k < n * 3 && out.length < n; k++) {
    const [rx, ry] = route[Math.floor((k + 0.5) * route.length / (n * 3))];
    for (const [dx, dy] of DIRS8) { const x = rx + dx, y = ry + dy, key = x * 100 + y; if (inMap(x, y) && walkable(g.w, x, y) && !on.has(key) && !used.has(key)) { used.add(key); out.push([x, y]); break; } }
  }
  return out;
}

export function createFestivals(g) {
  // The villager side: one action that follows the festival's phase.
  registerAction('festival', (g, v, a, dt) => {
    const F = g.festival;
    if (!F || F.phase === 'planned') return DONE;
    if (F.phase === 'feast') { a.next = action('sit', { dur: Math.max(10, (BEDTIME - hour(g)) * DAY / 24), key: 'fire', pri: PRI.SOCIAL, src: 'auto', why: 'Feasting by the fire.' }); return DONE; }
    if (a.role === 'march') {
      if (F.phase === 'gather') { if (!a.lost) { const [x, y] = F.route[0]; if (go(g, v, a, (px, py) => Math.max(Math.abs(px - x), Math.abs(py - y)) <= 1) === 'fail') a.lost = true; } return RUN; }
      // Parade: walk in pairs behind the leader.
      const row = Math.floor(a.rank / 2), side = a.rank % 2 ? 0.28 : -0.28, s = F.s - row * FESTIVAL.rowGap;
      const [x, y] = posAt(F.route, s), [nx, ny] = posAt(F.route, s + 0.3), dx = nx - x, dy = ny - y, d = Math.hypot(dx, dy) || 1;
      v.path = []; v.moving = s > 0 && s < F.route.length - 1;
      if (Math.abs(dx) > 0.01) v.dir = dx > 0 ? 1 : -1;
      v.x = x - dy / d * side; v.y = y + dx / d * side;
      return RUN;
    }
    // Onlookers: go to a spot along the route and cheer as the parade passes.
    const [x, y] = a.spot;
    if (!a.lost && go(g, v, a, (px, py) => px === x && py === y) === 'fail') a.lost = true;
    return RUN;
  });

  function begin(F) {
    const f = FESTIVALS.find(x => x.id === F.id), cost = festivalCost(g, f);
    F.route = buildRoute(g);
    if (!F.route || !pay(g, cost)) { g.festival = null; return; } // quietly try another day
    for (const r in cost) g.today.out[r] = (g.today.out[r] || 0) + cost[r];
    F.phase = 'gather'; F.t = 0; F.s = 0; F.floats = f.floats; F.lanterns = !!f.lanterns; F.culture = f.culture;
    const vs = [...g.villagers].filter(v => !(v.act && v.act.type === 'leave')), marchers = vs.filter((_, i) => i % 2 === 0), cheer = vs.filter((_, i) => i % 2 === 1);
    F.rows = Math.ceil(marchers.length / 2);
    const spots = cheerSpots(g, F.route, cheer.length + f.visitors);
    marchers.forEach((v, rank) => interrupt(g, v, action('festival', { role: 'march', rank, pri: PRI.SOCIAL + 1.5, src: 'schedule', key: 'festival', why: rank === 0 ? 'Leading the parade!' : 'Marching in the parade.' })));
    cheer.forEach((v, i) => interrupt(g, v, action('festival', { role: 'cheer', spot: spots[i % Math.max(1, spots.length)] || F.route[0], pri: PRI.SOCIAL + 1.5, src: 'schedule', key: 'festival', why: 'Cheering on the parade.' })));
    // Visitors from neighbouring settlements come up the road to watch.
    F.visitors = [];
    const edge = g.w.roadEnd;
    for (let i = 0; i < f.visitors && edge; i++) {
      const spot = spots[(cheer.length + i) % Math.max(1, spots.length)]; if (!spot) break;
      const p = bfsVisitor(g.w, edge[0], edge[1], (x, y) => x === spot[0] && y === spot[1]);
      if (p) F.visitors.push({ x: edge[0], y: edge[1], path: p, wait: i * 2.5, dir: 1, moving: false, visitor: true, act: null, carry: 0, col: ['#e0a03a', '#5aa9a0', '#c45a8a', '#7a8ad0', '#8ab04a', '#d0704a'][i % 6], skin: g.rng.pick(SKIN_POOL), hair: g.rng.pick(HAIR_POOL), name: 'Visitor' });
    }
    g.events.emit('festival', F);
  }
  function end(F) {
    for (const v of g.villagers) v.socialLock = g.clock + SOCIAL.eventDays * DAY;
    g.culture = (g.culture || 0) + F.culture;
    g.lastFestival = g.dawns; g.lastCelebration = g.clock;
    notice(g, `What a night! The ${F.name.toLowerCase()} filled Hearthvale with joy.`);
    g.festival = null;
    g.events.emit('festivalEnd', F);
  }
  function moveVisitors(F, dt) {
    if (F.visitors) F.visitors = F.visitors.filter(p => !p.gone);
    for (const p of F.visitors || []) {
      if (p.wait > 0) { p.wait -= dt; continue; }
      if (!p.path.length) { p.moving = false; if (p.leaving) p.gone = true; continue; }
      const [tx, ty] = p.path[0], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), st = 1.6 * dt;
      p.moving = true; if (Math.abs(dx) > 0.01) p.dir = dx > 0 ? 1 : -1;
      if (d <= st) { p.x = tx; p.y = ty; p.path.shift(); } else { p.x += dx / d * st; p.y += dy / d * st; }
    }
  }

  return {
    tick(dt) {
      const F = g.festival;
      if (!F) return;
      const h = hour(g);
      if (F.phase === 'planned') { if (g.dawns >= F.day && h >= FESTIVAL.startHour && h < BEDTIME - 1) begin(F); return; }
      moveVisitors(F, dt);
      F.t += dt;
      if (F.phase === 'gather' && F.t > 25) { F.phase = 'parade'; F.t = 0; }
      else if (F.phase === 'parade') {
        F.s += FESTIVAL.speed * dt;
        if (F.s > F.route.length - 1 + F.rows * FESTIVAL.rowGap + F.floats * 1.6 + 1) {
          F.phase = 'feast'; F.t = 0;
          // Visitors wave goodbye and walk home down the road (one or two may come back to stay, see end()).
          const edge = g.w.roadEnd;
          for (const p of F.visitors || []) {
            if (bedTotal(g) > g.villagers.length && g.villagers.length < popCap(g) && g.rng() < FESTIVAL.stayChance) {
              const nv = createVillager(g, Math.round(p.x), Math.round(p.y), { skin: p.skin, hair: p.hair });
              notice(g, `${nv.name}, a visitor, loved the festival so much they decided to stay.`); g.events.emit('arrived', nv); p.gone = true; continue;
            }
            const path = edge && bfsVisitor(g.w, Math.round(p.x), Math.round(p.y), (x, y) => x === edge[0] && y === edge[1]); p.path = path || []; p.leaving = true; p.wait = g.rng() * 3; }
        }
      }
      if (F.phase !== 'planned' && (g.crossed.includes(BEDTIME) || h < 5)) end(F);
    },
    // Positions of the floats (they roll behind the marchers).
    floats() { const F = g.festival; if (!F || F.phase !== 'parade' || !F.floats) return []; return Array.from({ length: F.floats }, (_, k) => posAt(F.route, F.s - F.rows * FESTIVAL.rowGap - 1.6 * (k + 1))).filter((_, k) => F.s - F.rows * FESTIVAL.rowGap - 1.6 * (k + 1) > 0); },
    leader() { const F = g.festival; return F && F.phase === 'parade' ? posAt(F.route, F.s) : null; },
  };
}
import { SKINS as SKIN_POOL, HAIRS as HAIR_POOL } from './config.js';
