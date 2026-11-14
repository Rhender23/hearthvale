// Night critters: something gentle to do while the village sleeps. Tap one to catch it for the collection.
//   firefly  spring and summer, drifting near trees and water (glows)
//   moth     spring to autumn, fluttering around lit windows and lamp posts
//   frog     spring to autumn, sitting on pond banks, hopping now and then
//   owl      any season, perched in a tree
// Catching 10 fireflies unlocks the firefly lantern decoration. Critters are not saved; the collection is.
import { N, NODE, BUILD } from './config.js';
import { isNight, seasonIndex, notice, levelName } from './state.js';
import { idx, inMap, isShore } from './world.js';

export const CRITTERS = {
  firefly: { name: 'firefly', icon: '✨', seasons: [0, 1], max: 10 },
  moth:    { name: 'moth', icon: '🦋', seasons: [0, 1, 2], max: 4 },
  frog:    { name: 'frog', icon: '🐸', seasons: [0, 1, 2], max: 3 },
  owl:     { name: 'owl', icon: '🦉', seasons: [0, 1, 2, 3], max: 2 },
};
export const LANTERN_UNLOCK = 10;
// Treasures for inside a home, made from caught critters (they are used up). Each home can have one of each.
export const HOME_DECOR = {
  lantern:  { name: 'Firefly lantern', critter: 'firefly', n: 5, desc: 'A jar of fireflies that glows by the bed.' },
  aquarium: { name: 'Frog aquarium', critter: 'frog', n: 3, desc: 'A little glass tank with a frog and some pond weed.' },
  owlcage:  { name: 'Owl in a cage', critter: 'owl', n: 2, desc: 'A tame owl on a perch in a hanging cage.' },
};
export const critterLeft = (g, type) => (g.caught[type] || 0) - ((g.spent || {})[type] || 0);
export function decorateHome(g, b, id) {
  const d = HOME_DECOR[id];
  if (!d || !b || !BUILD[b.k].home || !b.done) return { ok: false };
  if ((b.decor || []).includes(id)) return { ok: false, reason: 'This home already has one.' };
  if (critterLeft(g, d.critter) < d.n) return { ok: false, reason: `Catch ${d.n - critterLeft(g, d.critter)} more ${CRITTERS[d.critter].name}${d.n - critterLeft(g, d.critter) === 1 ? '' : 's'} first.` };
  g.spent = g.spent || {}; g.spent[d.critter] = (g.spent[d.critter] || 0) + d.n;
  (b.decor = b.decor || []).push(id); g.beautyDirty = true;
  notice(g, `A ${d.name.toLowerCase()} now brightens the ${levelName(b).toLowerCase()}.`);
  return { ok: true };
}   // fireflies caught before the firefly lantern can be built

export function createCritters(g) {
  let nextId = 1, t = 0;
  g.critters = [];
  g.caught = g.caught || {};
  const near = (x, y, test, r = 2) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (inMap(x + i, y + j) && test(x + i, y + j)) return true; return false; };
  function spot(type) {
    const w = g.w;
    for (let n = 0; n < 30; n++) {
      const x = g.rng.int(N), y = g.rng.int(N), i = idx(x, y);
      if (type === 'firefly' && w.T[i] !== 1 && near(x, y, (a, b) => (w.R[idx(a, b)] === NODE.TREE && w.A[idx(a, b)] > 0) || w.T[idx(a, b)] === 1)) return [x + g.rng() - 0.5, y + g.rng() - 0.5];
      if (type === 'frog' && isShore(w, x, y) && w.occ[i] === 0) return [x, y];
      if (type === 'owl' && w.R[i] === NODE.TREE && w.A[i] > 0) return [x, y];
      if (type === 'moth') { const lit = g.buildings.filter(b => b.done && BUILDLIT.has(b.k)), b = lit.length && lit[g.rng.int(lit.length)]; if (b) return [b.x + g.rng() * b.w, b.y + g.rng() * b.h]; }
    }
    return null;
  }
  return {
    tick(dt) {
      if (!isNight(g)) { if (g.critters.length) g.critters = []; return; }
      const sea = seasonIndex(g);
      for (const c of g.critters) {
        c.t += dt;
        if (c.type === 'firefly' || c.type === 'moth') { c.a += (g.rng() - 0.5) * 2 * dt; const sp = c.type === 'moth' ? 0.9 : 0.35; c.x += Math.cos(c.a) * sp * dt; c.y += Math.sin(c.a) * sp * dt; if (Math.hypot(c.x - c.hx, c.y - c.hy) > 1.6) c.a = Math.atan2(c.hy - c.y, c.hx - c.x); }
        if (c.type === 'frog' && c.t > c.next) { c.next = c.t + 3 + g.rng() * 5; const nx = Math.round(c.hx) + g.rng.int(3) - 1, ny = Math.round(c.hy) + g.rng.int(3) - 1; if (inMap(nx, ny) && isShore(g.w, nx, ny)) { c.x = nx; c.y = ny; } c.hop = 0.4; }
        if (c.hop > 0) c.hop -= dt;
      }
      t += dt; if (t < 2) return; t = 0;
      for (const type in CRITTERS) {
        const C = CRITTERS[type]; if (!C.seasons.includes(sea)) continue;
        if (g.critters.filter(c => c.type === type).length >= C.max || g.rng() > 0.5) continue;
        const p = spot(type); if (p) g.critters.push({ id: nextId++, type, x: p[0], y: p[1], hx: p[0], hy: p[1], a: g.rng() * 6.28, t: 0, next: 2, hop: 0 });
      }
    },
    catch(id) {
      const c = g.critters.find(c => c.id === id); if (!c) return { ok: false };
      g.critters = g.critters.filter(o => o !== c);
      const n = g.caught[c.type] = (g.caught[c.type] || 0) + 1;
      if (n === 1) notice(g, `${CRITTERS[c.type].icon} Your first ${CRITTERS[c.type].name}! It's in the collection now.`);
      if (c.type === 'firefly' && n === LANTERN_UNLOCK && !g.unlocked.fireflylamp) { g.unlocked.fireflylamp = true; notice(g, '✨ Ten fireflies! The village can now build firefly lanterns.'); }
      g.events.emit('caught', c);
      return { ok: true, c };
    },
  };
}
const BUILDLIT = new Set(['house', 'tavern', 'lamppost', 'lodge', 'tc', 'shop', 'bakery', 'school']);
