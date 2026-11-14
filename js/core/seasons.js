// Seasonal festivals: one in every season, free, and they happen whatever the village has.
//   spring  🐣 Egg hunt      eggs hidden around the village and an Easter bunny to chase
//   summer  🌊 Summer swim   everyone goes down to the water, jumps in, then picnics on the bank
//   autumn  🎃 Halloween     pumpkins by every house, trick-or-treating door to door in costume, then the tavern
//   winter  🎄 Christmas     a decorated tree in the village, everyone gathers round it to sing
// The village chips in what it can spare (food and beer, and more as it grows). The more it gives, the longer spirits
// stay high afterwards and the more culture the day brings. Nothing is ever required.
// g.seasonal: null, or { id, name, icon, sk, phase: 'soon' | 'on', t, ... }. g.seasonalDone: the season it last ran in.
import { SEASON, DAY, PRI, N, RATION } from './config.js';
import { notice, hour, isNight, seasonIndex, hub, campfire, townCenter } from './state.js';
import { walkable, isShore, inMap, idx, besideRect, DIRS8, WATER } from './world.js';
import { action, interrupt } from './villagers.js';
import { registerAction, go } from './actions.js';

export const SEASONAL = [
  { id: 'easter', name: 'Spring egg hunt', icon: '🐣' },
  { id: 'summer', name: 'Summer swim', icon: '🌊' },
  { id: 'halloween', name: 'Halloween', icon: '🎃' },
  { id: 'christmas', name: 'Christmas', icon: '🎄' },
];
export const SEASONAL_TIME = 170;          // seconds the celebration lasts (about 5 hours of the day)
const RUN = 0, DONE = 1;
const on = (g, id) => g.seasonal && g.seasonal.phase === 'on' && (!id || g.seasonal.id === id);
const cheb = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));

export function createSeasons(g) {

  // ---- what villagers do
  registerAction('egghunt', (g, v, a) => {
    const F = g.seasonal; if (!on(g, 'easter')) return DONE;
    let e = a.egg != null && F.eggs[a.egg];
    if (!e || e.found) {
      let best = -1, bd = 1e9; F.eggs.forEach((q, i) => { if (q.found || q.by && q.by !== v.id) return; const d = Math.abs(q.x - v.x) + Math.abs(q.y - v.y); if (d < bd) { bd = d; best = i; } });
      if (best < 0) { // every egg is found or spoken for: chase the bunny
        if (!v.path.length) { const bx = Math.round(F.bunny.x), by = Math.round(F.bunny.y); go(g, v, a, (x, y) => cheb(x, y, bx, by) <= 1); a.tries = 0; }
        return RUN;
      }
      a.egg = best; F.eggs[best].by = v.id; a.tries = 0; v.path = []; e = F.eggs[best];
    }
    const s = go(g, v, a, (x, y) => x === e.x && y === e.y);
    if (s === 'fail') { e.by = null; e.found = true; a.egg = null; return RUN; }
    if (s === 'arrived') { e.found = true; F.found = (F.found || 0) + 1; v.eggs = (v.eggs || 0) + 1; a.egg = null; g.events.emit('egg', v); }
    return RUN;
  });
  registerAction('swim', (g, v, a, dt) => {
    if (!on(g, 'summer')) { v.swim = false; return DONE; }
    if (a.phase === 'start') { a.phase = 'go'; a.t = 0; }
    if (a.phase === 'go') { const s = go(g, v, a, (x, y) => x === a.shore[0] && y === a.shore[1]); if (s === 'fail') { a.phase = 'picnic'; return RUN; } if (s === 'arrived') { a.phase = 'swim'; a.t = 0; v.swim = true; v.x = a.water[0]; v.y = a.water[1]; g.events.emit('splash', v); } return RUN; }
    a.t += dt;
    if (a.phase === 'swim') { v.x = a.water[0] + Math.sin(a.t * 0.8 + v.id) * 0.25; v.y = a.water[1] + Math.cos(a.t * 0.6 + v.id) * 0.2; if (a.t > a.dur) { a.phase = 'picnic'; v.swim = false; v.x = a.shore[0]; v.y = a.shore[1]; } return RUN; }
    return RUN;   // picnic on the bank until the day is done
  });
  registerAction('trick', (g, v, a, dt) => {
    if (!on(g, 'halloween')) return DONE;
    if (a.k < a.doors.length) {
      const b = g.bmap.get(a.doors[a.k]); if (!b) { a.k++; return RUN; }
      if (a.wait > 0) { a.wait -= dt; if (a.wait <= 0) { a.k++; a.tries = 0; v.treats = (v.treats || 0) + 1; } return RUN; }
      const s = go(g, v, a, (x, y) => besideRect(x, y, b.x, b.y, b.w, b.h));
      if (s === 'fail') { a.k++; a.tries = 0; } else if (s === 'arrived') a.wait = 3;
      return RUN;
    }
    // then off to the tavern (or the fire) in costume
    if (!a.end) { const tv = g.buildings.find(b => b.k === 'tavern' && b.done); const f = tv ? null : g.w.fire; a.end = tv ? { b: tv } : { x: f.x, y: f.y }; }
    const t = a.end;
    const s = go(g, v, a, t.b ? (x, y) => besideRect(x, y, t.b.x, t.b.y, t.b.w, t.b.h) : (x, y) => cheb(x, y, t.x, t.y) === 1);
    if (s === 'fail') a.tries = 0;
    return RUN;
  });
  registerAction('carol', (g, v, a) => {
    if (!on(g, 'christmas')) return DONE;
    if (!a.lost && go(g, v, a, (x, y) => x === a.spot[0] && y === a.spot[1]) === 'fail') a.lost = true;
    return RUN;
  });

  // ---- setting up each celebration
  function freeTilesNear(cx, cy, rMin, rMax, ok = (x, y) => walkable(g.w, x, y)) {
    const out = [];
    for (let r = rMin; r <= rMax; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (cheb(x, y, cx, cy) === r && inMap(x, y) && ok(x, y)) out.push([x, y]);
    return out;
  }
  function contribute(F) {
    // The village chips in what it can spare beyond a day of meals.
    const n = Math.max(1, g.villagers.length), day = RATION.food * 3 * n;
    const want = { food: 4 * n, beer: g.age >= 1 ? n : 0, gold: g.age >= 2 ? 5 * n : 0 }, given = {};
    let share = 0, parts = 0;
    for (const r in want) { if (!want[r]) continue; const spare = Math.max(0, g.res[r] - (r === 'food' ? day : 0)), take = Math.min(want[r], spare); g.res[r] -= take; given[r] = Math.round(take); share += take / want[r]; parts++; if (take) g.today.out[r] = (g.today.out[r] || 0) + take; }
    F.given = given; F.share = parts ? share / parts : 0;
  }
  function begin(F) {
    contribute(F);
    F.phase = 'on'; F.t = 0;
    // With free will off nobody is pulled away: the decorations go up, but villagers keep to what you asked.
    const h = hub(g), vs = g.freeWill ? g.villagers.filter(v => !(v.act && (v.act.type === 'leave' || v.act.type === 'festival'))) : [];
    const pri = PRI.SOCIAL + 0.5, base = { pri, src: 'schedule' };
    if (F.id === 'easter') {
      const spots = freeTilesNear(h.x, h.y, 2, 9).filter(([x, y]) => g.w.occ[idx(x, y)] === 0);
      const want = Math.min(spots.length, 4 + 2 * vs.length);
      F.eggs = []; for (let i = 0; i < want; i++) { const k = g.rng.int(spots.length), [x, y] = spots.splice(k, 1)[0]; F.eggs.push({ x, y, c: i % 5, found: false }); }
      F.bunny = { x: h.x + 2, y: h.y + 2, hop: 0, dir: 1 };
      for (const v of vs) interrupt(g, v, action('egghunt', { ...base, key: 'egghunt', why: 'Hunting for Easter eggs!' }));
    } else if (F.id === 'summer') {
      const shore = []; for (let i = 0; i < N * N; i++) { const x = i % N, y = (i / N) | 0; if (walkable(g.w, x, y) && isShore(g.w, x, y)) shore.push([x, y]); }
      shore.sort((p, q) => Math.hypot(p[0] - h.x, p[1] - h.y) - Math.hypot(q[0] - h.x, q[1] - h.y));
      F.picnics = [];
      vs.forEach((v, i) => {
        const s = shore[Math.min(shore.length - 1, i * 2)]; if (!s) return;
        const wt = DIRS8.map(([dx, dy]) => [s[0] + dx, s[1] + dy]).find(([x, y]) => inMap(x, y) && g.w.T[idx(x, y)] === WATER);
        if (!wt) return;
        F.picnics.push(s);
        interrupt(g, v, action('swim', { ...base, key: 'swim', why: 'Off to the water for a swim!', shore: s, water: wt, dur: 8 + g.rng() * 6 }));
      });
    } else if (F.id === 'halloween') {
      const homes = g.buildings.filter(b => b.done && b.k === 'house');
      for (const v of vs) { const doors = [...homes].sort(() => g.rng() - 0.5).slice(0, 3).map(b => b.id); interrupt(g, v, action('trick', { ...base, key: 'trick', why: 'Trick or treat!', doors, k: 0, wait: 0 })); }
    } else if (F.id === 'christmas') {
      const near = freeTilesNear(h.x, h.y, 2, 4).filter(([x, y]) => g.w.occ[idx(x, y)] === 0 && !g.w.road[idx(x, y)]);
      F.tree = near[0] || [h.x + 2, h.y + 2];
      const ring = freeTilesNear(F.tree[0], F.tree[1], 1, 2);
      vs.forEach((v, i) => interrupt(g, v, action('carol', { ...base, key: 'carol', why: 'Singing carols round the tree.', spot: ring[i % Math.max(1, ring.length)] || F.tree })));
    }
    notice(g, `${F.icon} ${F.name} today! ` + ({ easter: 'The eggs are hidden and the bunny is out.', summer: 'Everyone is heading down to the water.', halloween: 'Pumpkins are out and costumes are on.', christmas: 'The tree is up in the village.' })[F.id]);
    g.events.emit('seasonal', F);
  }
  function end(F) {
    const k = 0.5 + F.share;                              // 0.5 with nothing to spare, up to 1.5 when the village gave freely
    for (const v of g.villagers) { v.socialLock = Math.max(v.socialLock || 0, g.clock + DAY * k); v.swim = false; }
    const culture = Math.round(6 + 14 * F.share + (F.found || 0) * 0.5);
    g.culture = (g.culture || 0) + culture;
    notice(g, `${F.icon} What a lovely ${F.name.toLowerCase()}!` + (F.id === 'easter' && F.found ? ` ${F.found} eggs found.` : ''));
    g.seasonal = null; g.lastCelebration = g.clock;
    g.events.emit('seasonalEnd', F);
  }

  return {
    tick(dt) {
      const sk = Math.floor(g.clock / SEASON), F = g.seasonal;
      if (!F) {
        if (g.seasonalDone !== sk) { const def = SEASONAL[seasonIndex(g)]; g.seasonal = { ...def, sk, phase: 'soon' }; }
        return;
      }
      if (F.phase === 'soon') {
        if (F.sk !== sk) { g.seasonal = null; g.seasonalDone = F.sk; return; }   // the season passed at night; next one
        const h = hour(g);
        if (h >= 9 && h < 19 && !isNight(g) && !(g.festival && g.festival.phase !== 'planned')) { g.seasonalDone = sk; begin(F); }
        return;
      }
      F.t += dt;
      if (F.id === 'easter' && F.bunny) { // the bunny hops about and darts away from anyone close
        const b = F.bunny; b.hop -= dt;
        if (b.hop <= 0) {
          b.hop = 0.7 + g.rng() * 0.8;
          const near = g.villagers.find(v => Math.hypot(v.x - b.x, v.y - b.y) < 1.6);
          const opts = DIRS8.map(([dx, dy]) => [b.x + dx, b.y + dy]).filter(([x, y]) => walkable(g.w, Math.round(x), Math.round(y)));
          if (opts.length) { const [x, y] = near ? opts.sort((p, q) => Math.hypot(q[0] - near.x, q[1] - near.y) - Math.hypot(p[0] - near.x, p[1] - near.y))[0] : opts[g.rng.int(opts.length)]; b.dir = x > b.x ? 1 : -1; b.x = x; b.y = y; }
        }
      }
      if (F.t >= SEASONAL_TIME || isNight(g) || (F.id === 'easter' && F.eggs && F.eggs.every(e => e.found) && F.t > SEASONAL_TIME * 0.6)) end(F);
    },
  };
}
