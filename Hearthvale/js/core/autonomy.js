// Utility AI. A free villager scores every reachable thing to do:
//   score = 100 x wish weight (from the Manager) + quality - distance penalty + a little noise
// then picks among the top few so the village never looks robotic.
// Autonomy only ever fills an empty slot or replaces another autonomous choice.
import { NODE_INFO, KEY_NODE, BUILD, FARM_MAX_WORKERS } from './config.js';
import { scan, bfs } from './path.js';
import { inMap, idx, DIRS8, nodeKind, isOpen, buildingNear, WATER } from './world.js';
import { farmers, canStore } from './state.js';
import { action, choose } from './villagers.js';
import { recipeFor } from './actions.js';
import { dutyBonus, resumeDuty } from './duty.js';

const GATHER_KEYS = ['wood', 'stone', 'gold', 'berry', 'fish', 'clay'];

function probeFor(g) {
  const w = g.w, f = w.fire;
  return (x, y) => {
    let out = null;
    for (const [dx, dy] of DIRS8) {
      const a = x + dx, b = y + dy;
      if (!inMap(a, b)) continue;
      const i = idx(a, b), k = nodeKind(w, i);
      if (k) { const f = w.A[i] / NODE_INFO[k].amt; (out = out || []).push([NODE_INFO[k].key + (f < 0.1 ? '_last' : f < 0.25 ? '_low' : ''), i]); }
      if (w.T[i] === WATER && (dx === 0 || dy === 0)) (out = out || []).push(['shore', null]);
      const id = w.occ[i];
      if (id > 0) {
        const bl = g.bmap.get(id);
        if (!bl) continue;
        if (bl.done && BUILD[bl.k].crop && farmers(g, bl) < FARM_MAX_WORKERS) (out = out || []).push([bl.k, id]);   // farm, wheatfield, fiberfield
        else if (!bl.done) (out = out || []).push(['build', id]);
        if (bl.done && bl.pending > bl.lvl && !g.villagers.some(u => u.act && u.act.type === 'upgrade' && u.act.b === id)) (out = out || []).push(['upgrade', id]);
        if (bl.k === 'well' && bl.done && bl.water >= 1) (out = out || []).push(['well', id]);
        if (bl.k === 'tavern' && bl.done) (out = out || []).push(['tavern', id]);
        if (bl.k === 'school' && bl.done) (out = out || []).push(['learn', id]);
        if (bl.k === 'theater' && bl.done) (out = out || []).push(['theater', id]);
        if (bl.k === 'church' && bl.done) (out = out || []).push(['church', id]);
        if (bl.k === 'library' && bl.done) (out = out || []).push(['read', id]);
        if (bl.k === 'playground' && bl.done) (out = out || []).push(['play', id]);
        if (bl.k === 'bench' && bl.done) (out = out || []).push(['bench', id]);
      }
      if (f && a === f.x && b === f.y) (out = out || []).push(['fire', null]);
    }
    return out;
  };
}

// Returns scored options, best first: [{ key, score, d, target }]
export function options(g, v) {
  const m = g.manager, W = m.W, S = m.slots, px = Math.round(v.x), py = Math.round(v.y);
  const found = scan(g.w, px, py, probeFor(g));
  const hunger = g.res.food < 1 ? Math.pow(1 - v.full, 2) * 40 : 0;
  const out = [];
  const add = (key, d, quality, target) => {
    const wgt = W[key];
    if (!wgt) return;
    if (S[key] !== undefined && S[key] <= m.count(g, key, v)) return;
    out.push({ key, d, target, score: 100 * wgt + quality + dutyBonus(v, key, target) - Math.min(40, d * 1.5) + (g.rng() * 8 - 4) });
  };
  // The villager's own job (a field or workshop you gave them) is always on the list, wherever it is.
  { const dj = v.duty, b = dj && dj.b && g.bmap.get(dj.b); if (b && b.done && (dj.type === 'farm' || dj.type === 'craft') && (dj.type !== 'craft' || recipeFor(g, b))) add(dj.key, Math.hypot(b.x - v.x, b.y - v.y), 0, b.id); }
  add('rest', found.bench ? Math.min(found.bench.d, 10) : 0, 60 * Math.pow(1 - v.energy, 2) + (found.bench ? 8 : 0), found.bench ? found.bench.target : null);
  // Nature's steering: nearly used-up spots score lower, so villagers walk further for a healthy one.
  const NATURE = { '': 0, _low: -30, _last: -60 };
  for (const key of GATHER_KEYS) {
    if (!canStore(g, NODE_INFO[KEY_NODE[key]].res)) continue;
    const k = KEY_NODE[key], q = (1 - (g.mods.gather[k] || 1)) * 40 + (key === 'fish' || key === 'berry' ? hunger : 0);
    const best = ['', '_low', '_last'].map(sfx => found[key + sfx] && { sfx, hit: found[key + sfx] }).filter(Boolean)
      .sort((a, b) => (NATURE[b.sfx] - Math.min(40, b.hit.d * 1.5)) - (NATURE[a.sfx] - Math.min(40, a.hit.d * 1.5)))[0];
    if (best) add(key, best.hit.d, q + NATURE[best.sfx], best.hit.target);
  }
  if (found.farm && canStore(g, 'food')) add('farm', found.farm.d, hunger, found.farm.target);
  if (found.fiberfield && canStore(g, 'fiber')) add('fiberfield', found.fiberfield.d, 0, found.fiberfield.target);
  if (found.wheatfield && canStore(g, 'wheat')) add('wheatfield', found.wheatfield.d, 0, found.wheatfield.target);
  // A specialist strongly prefers their own workshop while it has materials and room for its goods.
  const shop = v.job && g.bmap.get(v.job), c = shop && shop.done && BUILD[shop.k].craft;
  if (c && recipeFor(g, shop) && (c.out.culture || canStore(g, Object.keys(c.out)[0]))) add('craft', Math.hypot(shop.x - v.x, shop.y - v.y), 40, shop.id);
  if (canStore(g, 'water')) {
    const thirst = g.res.water < 1 ? Math.pow(1 - v.hyd, 2) * 40 : 0;
    if (found.well && (!found.shore || found.well.d <= found.shore.d + 6)) add('water', found.well.d, 15 + thirst, { well: found.well.target });
    else if (found.shore) add('water', found.shore.d, thirst, { shore: true });
  }
  if (found.upgrade) add('upgrade', found.upgrade.d, 0, found.upgrade.target);
  if (found.tavern) add('tavern', found.tavern.d, 0, found.tavern.target);
  if (found.learn) add('learn', found.learn.d, 0, found.learn.target);
  if (found.theater) add('theater', found.theater.d, 0, found.theater.target);
  for (const k of ['church', 'read', 'play']) if (found[k]) add(k, found[k].d, 0, found[k].target);
  if (found.build) add('build', found.build.d, 0, found.build.target);
  if (found.fire) add('fire', found.fire.d, 0, null);
  if (W.plant) add('plant', 5, 0, null);
  if (W.clear && g.obstruct && g.obstruct.length) {
    let best = -1, bd = 1e9;
    for (const i of g.obstruct) { const d = Math.hypot(i % 40 - v.x, ((i / 40) | 0) - v.y); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) add('clear', bd, 0, best);
  }
  return out.sort((a, b) => b.score - a.score);
}

const nearPhrase = (key, d) => (d > 6 ? '' : key === 'fish' ? ', and the water is close by' : key === 'wood' ? ', and the trees are close by' : key === 'farm' ? ', and the field is close by' : '');

function makeAction(g, v, o) {
  const reason = g.manager.reasons[o.key] || '';
  const label = { wood: 'Chopping', stone: 'Mining stone', gold: 'Mining gold', berry: 'Gathering berries', fish: 'Fishing', water: 'Fetching water',
    farm: 'Tending the vegetables', fiberfield: 'Tending the fiber', wheatfield: 'Bringing in the wheat', craft: 'At the workshop', clay: 'Digging clay', build: 'Building', fire: 'Telling stories by the fire', tavern: 'At the tavern', learn: 'At the schoolhouse', theater: 'At the theater', church: 'At church', read: 'Reading at the library', play: 'Playing at the playground', egghunt: 'Hunting for eggs', swim: 'Swimming', picnic: 'Picnicking by the water', trick: 'Trick-or-treating', carol: 'Singing by the Christmas tree', upgrade: 'Improving a building', plant: 'Planting a tree', clear: 'Clearing the way', rest: 'Taking a breather' }[o.key];
  const why = label + (reason ? ': ' + reason : '') + nearPhrase(o.key, o.d) + '.';
  if (KEY_NODE[o.key]) return action('gather', { kind: KEY_NODE[o.key], node: o.target, key: o.key, why });
  if (o.key === 'farm') return action('farm', { b: o.target, key: 'farm', why });
  if (o.key === 'fiberfield') return action('farm', { b: o.target, key: 'fiberfield', why });
  if (o.key === 'wheatfield') return action('farm', { b: o.target, key: 'wheatfield', why });
  if (o.key === 'craft') return action('craft', { b: o.target, key: 'craft', why });
  if (o.key === 'water') return action('water', { well: o.target && o.target.well, key: 'water', why });
  if (o.key === 'upgrade') { const b = g.bmap.get(o.target); return b ? action('upgrade', { b: b.id, to: b.pending, key: 'upgrade', why }) : null; }
  if (o.key === 'tavern') return action('sit', { tavern: o.target, dur: 20 + g.rng() * 15, key: 'tavern', why });
  if (o.key === 'learn') return action('sit', { tavern: o.target, dur: 20 + g.rng() * 10, key: 'learn', why });
  if (o.key === 'theater') return action('sit', { tavern: o.target, dur: 25 + g.rng() * 15, key: 'theater', why });
  if (o.key === 'church') return action('sit', { tavern: o.target, dur: 30 + g.rng() * 20, key: 'church', why });
  if (o.key === 'read') return action('sit', { tavern: o.target, dur: 25 + g.rng() * 15, key: 'read', why });
  if (o.key === 'play') return action('sit', { tavern: o.target, dur: 15 + g.rng() * 10, key: 'play', why });
  if (o.key === 'build') return action('build', { b: o.target, key: 'build', why });
  if (o.key === 'fire') return action('sit', { dur: 14 + g.rng() * 10, key: 'fire', why });
  if (o.key === 'rest') return action('rest', { dur: 6 + g.rng() * 10, wander: g.rng() < 0.5, bench: o.target, key: 'rest', why: v.energy < 0.3 ? 'Taking a breather: feeling tired.' : 'Taking a moment to enjoy the day.' });
  if (o.key === 'clear') return action('clear', { i: o.target, key: 'clear', why });
  if (o.key === 'plant') {
    const t = g.w.tc;
    for (let n = 0; n < 14; n++) {
      const x = t.x + g.rng.int(19) - 9, y = t.y + g.rng.int(19) - 9;
      if (!isOpen(g.w, x, y) || buildingNear(g.w, x, y, 2)) continue;
      if (bfs(g.w, Math.round(v.x), Math.round(v.y), (a, b) => Math.max(Math.abs(a - x), Math.abs(b - y)) === 1)) return action('plant', { x, y, key: 'plant', why });
    }
    return null;
  }
  return null;
}

// The best piece of real work for this villager right now (no leisure): used by "Back to work".
const WORK = new Set(['farm', 'fiberfield', 'wheatfield', 'craft', 'water', 'build', 'upgrade', 'clear']);
export function workFor(g, v) {
  for (const o of options(g, v)) if (KEY_NODE[o.key] || WORK.has(o.key)) { const a = makeAction(g, v, o); if (a) return a; }
  return null;
}

export function decide(g, v) {
  const opts = options(g, v);
  if (!opts.length) return false;
  const top = opts[0].score, pool = opts.slice(0, 3).map(o => [o, Math.exp((o.score - top) / 10)]);
  let r = g.rng() * pool.reduce((s, p) => s + p[1], 0), pick = pool[0][0];
  for (const [o, wgt] of pool) { r -= wgt; if (r <= 0) { pick = o; break; } }
  for (const o of [pick, ...opts.filter(o => o !== pick)]) {
    const a = makeAction(g, v, o);
    if (a) { choose(g, v, a); return true; }
  }
  return false;
}

// Called every frame for each villager.
export function autonomyTick(g, v, dt) {
  if (!g.freeWill) { if (!v.act) resumeDuty(g, v); return; }   // No free will: only orders, and the job they were given
  if (v.held) return;
  if (!v.act) {
    v.decideT -= dt;
    if (v.decideT > 0) return;
    v.decideT = 1 + g.rng() * 1.5;
    if (!decide(g, v)) v.why = 'Looking for something to do.';
    return;
  }
  // Re-evaluate long autonomous work now and then: switch only if something is clearly better.
  const a = v.act;
  if (a.src !== 'auto' || !(a.type === 'gather' || a.type === 'farm' || a.type === 'water')) return;
  v.reevalT -= dt;
  if (v.reevalT > 0) return;
  v.reevalT = 8 + g.rng() * 4;
  const opts = options(g, v), cur = opts.find(o => o.key === a.key);
  if (opts[0] && opts[0].key !== a.key && (!cur || opts[0].score - cur.score > 30)) {
    const na = makeAction(g, v, opts[0]);
    if (na) choose(g, v, na);
  }
}
