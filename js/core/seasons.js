// Seasonal festivals: one in every season, on its 2nd day. Decorations go up at dawn the day before (the eve) and come
// down at dawn the morning after. The village chips in what it can; an event short of its minimum supplies still
// happens (smaller) and, from the Village Age on, costs a little culture.
//
//   spring  🐣 Egg hunt   the night before, the Easter bunny hops through the village laying eggs. From dawn, villagers
//                        hunt the eggs first; with every egg found they chase the bunny, which keeps laying eggs as it
//                        dodges them. Caught the first time, it wriggles free and bounds off, dropping a couple of eggs;
//                        caught a second time, it vanishes and the hunt is over.
//   summer  🌊 Beach day  10 AM to 5 PM: swimming, then a picnic on the bank. Costs a day of meals each (and a beer each
//                        from the Village Age).
//   autumn  🎃 Halloween  noon to 11 PM: trick-or-treating door to door in costume, then the tavern or the fire.
//   winter  🎄 Christmas  9 AM: Santa leads a parade around the village; then everyone sings round the tree until 11 PM.
//
// g.seasonal: null, or { id, name, icon, sk, phase: 'soon' | 'decor' | 'on' | 'after', ... }; g.seasonalDone: the last
// season (seasonNo) whose festival has finished.
import { SEASON, DAY, PRI, N, RATION_DAY, BEDTIME, WAKE } from './config.js';
import { notice, hour, isNight, seasonIndex, seasonNo, dayOfSeason, hub, campfire, townCenter, calDay } from './state.js';
import { walkable, isShore, inMap, idx, besideRect, DIRS8, WATER } from './world.js';
import { action, interrupt } from './villagers.js';
import { registerAction, go } from './actions.js';
import { buildRoute, posAt } from './festival.js';
import { step } from './path.js';

export const SEASONAL = [
  { id: 'easter', name: 'Spring egg hunt', the: 'the spring egg hunt', icon: '🐣', from: WAKE + 0.5, to: BEDTIME },   // once everyone is up
  { id: 'summer', name: 'Beach day', the: 'the beach day', icon: '🌊', from: 10, to: 17 },
  { id: 'halloween', name: 'Halloween', the: 'Halloween', icon: '🎃', from: 12, to: BEDTIME },
  { id: 'christmas', name: 'Christmas', the: 'Christmas', icon: '🎄', from: 9, to: BEDTIME },
];
export const FESTIVAL_DAY = 1;             // which day of the season it falls on (0 = the first); the eve is the day before
// Minimum supplies, per villager (beer from the Village Age). Short of them: the event is smaller and culture dips.
export const SEASONAL_SUPPLY = { easter: { food: 1 }, summer: { food: 5, beer: 1 }, halloween: { food: 1 }, christmas: { food: 2, beer: 1 } };
export const SHORT_CULTURE = 15;           // culture lost for an event with none of its minimum supplies (in proportion)
const EGG_EVERY = 12;                      // seconds between eggs the bunny lays
const SANTA_SPEED = 0.9;                   // tiles per second
const RUN = 0, DONE = 1;
const on = (g, id) => g.seasonal && g.seasonal.phase === 'on' && (!id || g.seasonal.id === id);
const cheb = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));
const EVE = { easter: 'Someone has been painting eggs, and there are tiny footprints by the fire.', summer: 'Picnic baskets are being packed.', halloween: 'Pumpkins are going up on every doorstep.', christmas: 'The tree is up and someone in red is expected in the morning.' };
const START = { easter: 'The eggs are hidden all over the village. Find them, then catch the bunny!', summer: 'Everyone is heading down to the water.', halloween: 'Costumes on: trick-or-treating door to door!', christmas: 'Santa is leading a parade through the village!' };

export function createSeasons(g) {

  // ---- what villagers do
  registerAction('egghunt', (g, v, a, dt) => {
    const F = g.seasonal; if (!on(g, 'easter') || !F.bunny) return DONE;
    let e = a.egg != null && F.eggs[a.egg];
    if (!e || e.found) {
      let best = -1, bd = 1e9; F.eggs.forEach((q, i) => { if (q.found || q.by && q.by !== v.id) return; const d = Math.abs(q.x - v.x) + Math.abs(q.y - v.y); if (d < bd) { bd = d; best = i; } });
      if (best < 0) {   // every egg found or spoken for: after the bunny
        const bx = Math.round(F.bunny.x), by = Math.round(F.bunny.y);
        // Close enough to grab: a lucky grab gets likelier as the bunny tires (about a minute of chasing, more with few villagers).
        if (cheb(Math.round(v.x), Math.round(v.y), bx, by) <= 1 && !(F.bunny.away > 0) && g.rng() < dt * (0.15 + (F.t || 0) / 1000)) {   // fresh from a wriggle it can't be grabbed for a little while
          // The first time, it wriggles free and bounds off, dropping a couple of eggs; the second time it is caught.
          if (!F.escaped) { F.escaped = v.name; Object.assign(F.bunny, { slip: 2, lay: 0.8, hop: 0, away: 10 }); g.events.emit('bunnyEscaped', v); notice(g, `🐇 ${v.name} had the bunny for a moment, but it wriggled free!`); }
          else F.caughtBy = v.name;
          return RUN;
        }
        if (!v.path.length || a.chase !== bx * 100 + by) { a.chase = bx * 100 + by; v.path = []; a.tries = 0; go(g, v, a, (x, y) => cheb(x, y, bx, by) <= 1); }
        else go(g, v, a, (x, y) => cheb(x, y, bx, by) <= 1);
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
    return RUN;   // picnic on the bank until 5 PM
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
    if (!a.end) { const tv = g.buildings.find(b => b.k === 'tavern' && b.done); const f = g.w.fire; a.end = tv ? { b: tv } : { x: f.x, y: f.y }; }
    const t = a.end;
    const s = go(g, v, a, t.b ? (x, y) => besideRect(x, y, t.b.x, t.b.y, t.b.w, t.b.h) : (x, y) => cheb(x, y, t.x, t.y) === 1);
    if (s === 'fail') a.tries = 0;
    return RUN;
  });
  // Christmas: march behind Santa in pairs, then sing round the tree.
  registerAction('carol', (g, v, a) => {
    const F = g.seasonal; if (!on(g, 'christmas')) return DONE;
    if (F.santa && !F.santa.done && F.route) {
      const row = Math.floor(a.rank / 2), side = a.rank % 2 ? 0.28 : -0.28, s = F.santa.s - 1.4 - row * 1.2;
      if (s <= 0) { const [x, y] = F.route[0]; if (!a.lost && go(g, v, a, (px, py) => cheb(px, py, x, y) <= 1) === 'fail') a.lost = true; return RUN; }
      const [x, y] = posAt(F.route, s), [nx, ny] = posAt(F.route, s + 0.3), dx = nx - x, dy = ny - y, d = Math.hypot(dx, dy) || 1;
      v.path = []; v.moving = true; if (Math.abs(dx) > 0.01) v.dir = dx > 0 ? 1 : -1;
      v.x = x - dy / d * side; v.y = y + dx / d * side; a.marched = true;
      return RUN;
    }
    if (a.marched) { a.marched = false; v.x = Math.round(v.x); v.y = Math.round(v.y); v.path = []; a.tries = 0; }
    if (!a.lost && go(g, v, a, (x, y) => x === a.spot[0] && y === a.spot[1]) === 'fail') a.lost = true;
    return RUN;
  });

  // ---- setting up
  function freeTilesNear(cx, cy, rMin, rMax, ok = (x, y) => walkable(g.w, x, y)) {
    const out = [];
    for (let r = rMin; r <= rMax; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (cheb(x, y, cx, cy) === r && inMap(x, y) && ok(x, y)) out.push([x, y]);
    return out;
  }
  // The village gives what it can toward the minimum supplies (beyond a day of meals).
  function contribute(F) {
    const n = Math.max(1, g.villagers.length), keepFood = RATION_DAY * n, given = {}, want = {};
    for (const [r, per] of Object.entries(SEASONAL_SUPPLY[F.id])) if (r !== 'beer' || g.age >= 1) want[r] = per * n;
    let share = 0, parts = 0;
    for (const r in want) { const spare = Math.max(0, Math.floor(g.res[r] - (r === 'food' ? keepFood : 0))), take = Math.min(want[r], spare); g.res[r] -= take; given[r] = take; share += take / want[r]; parts++; if (take) g.today.out[r] = (g.today.out[r] || 0) + take; }
    F.given = given; F.want = want; F.share = parts ? share / parts : 1;
    if (g.age >= 1 && F.share < 1) { const lost = Math.round(SHORT_CULTURE * (1 - F.share)); g.culture = Math.max(0, (g.culture || 0) - lost); g.cultureLog = { ...(g.cultureLog || {}), event: { name: F.name, lost, short: Object.keys(want).filter(r => given[r] < want[r]) } }; }
  }
  function treeSpot() {
    const h = hub(g), near = freeTilesNear(h.x, h.y, 2, 4).filter(([x, y]) => g.w.occ[idx(x, y)] === 0 && !g.w.road[idx(x, y)]);
    return near[0] || [h.x + 2, h.y + 2];
  }
  // The eve: decorations go up (and, for the egg hunt, the bunny comes out at bedtime).
  function decorate(F) {
    F.phase = 'decor';
    if (F.id === 'christmas') { F.tree = treeSpot(); g.xmasTree = F.tree; }
    if (F.id === 'easter') { const h = hub(g); F.eggs = []; F.bunny = null; villageReach(F); F.spots = freeTilesNear(h.x, h.y, 2, 9).filter(([x, y]) => g.w.occ[idx(x, y)] === 0 && reachable(F, x, y)); }
    if (dayOfSeason(g) < FESTIVAL_DAY) notice(g, `${F.icon} Tomorrow is ${F.the}! ${EVE[F.id]}`);
    g.events.emit('seasonalEve', F);
  }
  function layEgg(F, x, y) {
    if (!walkable(g.w, x, y) || g.w.occ[idx(x, y)] !== 0 || F.eggs.some(e => !e.found && e.x === x && e.y === y)) return;
    F.eggs.push({ x, y, c: F.eggs.length % 5, found: false });
  }
  function begin(F) {
    contribute(F);
    F.phase = 'on'; F.t = 0;
    const h = hub(g), vs = g.villagers.filter(v => !(v.act && (v.act.type === 'leave' || v.act.type === 'festival')));
    const pri = PRI.PLAYER + 0.5, base = { pri, src: 'schedule' };
    // A smaller event when supplies run short: fewer doors, a shorter swim.
    const scale = 0.5 + 0.5 * F.share;
    if (F.id === 'easter') {
      villageReach(F);   // afresh at dawn: the village may have changed in the night
      if (!F.bunny || !reachable(F, F.bunny.x, F.bunny.y)) placeBunny(F, EGG_EVERY);
      if (!F.eggs.length) for (const [x, y] of (F.spots || []).slice(0, 2 + vs.length)) layEgg(F, x, y);
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
        interrupt(g, v, action('swim', { ...base, key: 'swim', why: 'A day at the beach!', shore: s, water: wt, dur: (20 + g.rng() * 20) * scale }));
      });
    } else if (F.id === 'halloween') {
      const homes = g.buildings.filter(b => b.done && BUILD_HOME(b));
      const n = Math.max(1, Math.round(6 * scale));
      for (const v of vs) { const doors = [...homes].sort(() => g.rng() - 0.5).slice(0, n).map(b => b.id); interrupt(g, v, action('trick', { ...base, key: 'trick', why: 'Trick or treat!', doors, k: 0, wait: 0 })); }
    } else if (F.id === 'christmas') {
      if (!F.tree) { F.tree = treeSpot(); g.xmasTree = F.tree; }
      F.route = buildRoute(g);
      if (F.route) { const end = F.route[F.route.length - 1]; F.santa = { s: 0, done: false, x: F.route[0][0], y: F.route[0][1], dir: 1 }; }
      const ring = freeTilesNear(F.tree[0], F.tree[1], 1, 2);
      vs.forEach((v, i) => interrupt(g, v, action('carol', { ...base, key: 'carol', rank: i, why: F.route ? 'In the Christmas parade behind Santa!' : 'Singing carols round the tree.', spot: ring[i % Math.max(1, ring.length)] || F.tree })));
    }
    notice(g, `${F.icon} ${F.name} today! ${START[F.id]}`);
    g.events.emit('seasonal', F);
  }
  function end(F) {
    const k = 0.5 + F.share;   // 0.5 with nothing to spare, up to 1.5 when fully supplied
    for (const v of g.villagers) { v.socialLock = Math.max(v.socialLock || 0, g.clock + DAY * k); v.swim = false; }
    const culture = Math.round(6 + 14 * F.share + (F.found || 0) * 0.5);
    g.culture = (g.culture || 0) + culture;
    const extra = F.id === 'easter' ? (F.caughtBy ? ` ${F.caughtBy} caught the bunny, and ${F.found || 0} eggs were found.` : ` ${F.found || 0} eggs were found.`) : '';
    notice(g, `${F.icon} What a lovely ${F.id === 'halloween' || F.id === 'christmas' ? F.name : F.name.toLowerCase()}!${extra}`);
    F.phase = 'after'; F.bunny = null; F.santa = null; g.lastCelebration = g.clock; g.seasonalDone = F.sk;
    g.events.emit('seasonalEnd', F);
  }

  return {
    tick(dt) {
      const sk = seasonNo(g), day = dayOfSeason(g), h = hour(g), dawn = g.crossed.includes(WAKE);
      let F = g.seasonal;
      if (F && F.phase === 'after' && (dawn || F.sk !== sk)) { g.seasonal = null; F = null; if (g.xmasTree) g.xmasTree = null; }   // decorations come down at dawn
      if (!F) {
        if (g.seasonalDone === sk) return;
        if (seasonIndex(g) === 0 && sk < 4) { g.seasonalDone = sk; return; }   // no egg hunt in the village's first year
        const def = SEASONAL[seasonIndex(g)]; F = g.seasonal = { ...def, sk, phase: 'soon' };
      }
      if (F.sk !== sk) { g.seasonal = null; return; }                                  // its season passed (a long pause or a load)
      if (day > FESTIVAL_DAY && F.phase !== 'after') { F.phase = 'after'; g.seasonalDone = sk; return; }   // missed: on to the next one
      if (F.phase === 'soon') { if (day >= FESTIVAL_DAY - 1 && !(day === FESTIVAL_DAY - 1 && h < WAKE)) decorate(F); return; }
      if (F.phase === 'decor') {
        // The egg-hunt eve: the bunny comes out at bedtime and lays eggs through the night.
        if (F.id === 'easter' && day === FESTIVAL_DAY - 1 && isNight(g) && (h >= BEDTIME || h < WAKE)) {
          if (!F.bunny) placeBunny(F, 2);
          hopBunny(F, dt, false);
        }
        if (day === FESTIVAL_DAY && h >= F.from && h < F.to && !(g.festival && g.festival.phase !== 'planned')) begin(F);
        return;
      }
      if (F.phase !== 'on') return;
      F.t += dt;
      if (F.id === 'easter' && F.bunny) {
        hopBunny(F, dt, true);
        if (F.caughtBy) { g.events.emit('bunnyCaught', F); return end(F); }
      }
      if (F.santa && !F.santa.done) {
        F.santa.s += SANTA_SPEED * dt;
        const [x, y] = posAt(F.route, F.santa.s), [px] = [F.santa.x]; F.santa.dir = x >= px ? 1 : -1; F.santa.x = x; F.santa.y = y;
        if (F.santa.s >= F.route.length - 1 + 2) { F.santa.done = true; F.santa.x = F.tree[0] + 1; F.santa.y = F.tree[1] + 1; notice(g, '🎅 Santa has stopped by the tree. Time for carols!'); }
      }
      if (h >= F.to || (F.to === BEDTIME && isNight(g))) end(F);
    },
  };

  // The bunny hops about, darting away from the nearest villager, and lays an egg every few seconds.
  // At night it wanders the village; by day it tires a little as the chase goes on.
  // The tiles near the hub that the villagers can actually walk to (water and woods can cut some off). The bunny
  // keeps to them and lays its eggs there, so it can always be reached.
  function villageReach(F) {
    const h = hub(g), seen = new Uint8Array(N * N), q = [];
    const near = (x, y) => inMap(x, y) && cheb(x, y, h.x, h.y) <= 10 && walkable(g.w, x, y);
    const seed = (x, y) => { for (const [dx, dy] of [[0, 0], ...DIRS8]) { const a = x + dx, c = y + dy; if (near(a, c) && !seen[idx(a, c)]) { seen[idx(a, c)] = 1; q.push([a, c]); } } };
    for (const v of g.villagers) seed(Math.round(v.x), Math.round(v.y));
    seed(g.w.fire.x, g.w.fire.y);
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of DIRS8) { const a = x + dx, c = y + dy; if (near(a, c) && step(g.w, x, y, dx, dy) && !seen[idx(a, c)]) { seen[idx(a, c)] = 1; q.push([a, c]); } } }   // as the villagers walk: no squeezing between corners
    return (F.reach = seen);
  }
  function reachable(F, x, y) { return inMap(x, y) && (F.reach || villageReach(F))[idx(x, y)] === 1; }
  function placeBunny(F, lay) {
    const h = hub(g), spot = freeTilesNear(h.x, h.y, 1, 10, (x, y) => reachable(F, x, y))[0] || [h.x + 2, h.y + 2];
    F.bunny = { x: spot[0], y: spot[1], hop: 0, dir: 1, lay };
  }

  function hopBunny(F, dt, day) {
    const b = F.bunny; b.hop -= dt; b.lay -= dt; if (b.away > 0) b.away -= dt;
    if (b.lay <= 0) {
      b.lay = b.slip > 0 ? 0.8 : day ? EGG_EVERY * 2.5 : EGG_EVERY;   // fewer eggs by day, so the chase can end
      if (b.slip > 0) { b.slip--; layEgg(F, Math.round(b.x), Math.round(b.y)); }   // eggs dropped as it runs off
      else if (F.eggs.filter(e => !e.found).length < 2 + g.villagers.length) layEgg(F, Math.round(b.x), Math.round(b.y));
    }
    if (b.hop > 0) return;
    b.hop = b.slip > 0 ? 0.4 : day ? 1.2 + Math.min(1.0, (F.t || 0) / 80) : 0.9;   // an easy-going hop, slower as the chase goes on
    const near = day && g.villagers.filter(v => !v.inside).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
    const opts = DIRS8.map(([dx, dy]) => [b.x + dx, b.y + dy]).filter(([x, y]) => reachable(F, x, y) && walkable(g.w, x, y));
    if (!opts.length) return;
    // Away from everyone close by (not just the nearest), and a double bound when someone is right beside it.
    const chasers = day ? g.villagers.filter(v => !v.inside && Math.hypot(v.x - b.x, v.y - b.y) < 6) : [];
    const away = ([x, y]) => chasers.reduce((s, v) => s + 1 / Math.max(0.5, Math.hypot(v.x - x, v.y - y)), 0);
    let [x, y] = chasers.length ? opts.sort((p, q) => away(p) - away(q))[0] : opts[g.rng.int(opts.length)];
    if (near && (b.slip > 0 || Math.hypot(near.x - b.x, near.y - b.y) < 1.8)) { const nx = x + (x - b.x), ny = y + (y - b.y); if (reachable(F, nx, ny) && walkable(g.w, nx, ny)) { x = nx; y = ny; } }
    b.dir = x > b.x ? 1 : -1; b.x = x; b.y = y;
  }
}
const BUILD_HOME = b => b.k === 'house' || b.k === 'farmhouse' || b.k === 'lodge';
