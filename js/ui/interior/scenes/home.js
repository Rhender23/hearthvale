// Homes. The room is built of what the house is built of (its level), holds every bed and every piece the household
// has placed, and fills with the things a household gathers as it grows: about 6 in a hut, 40 and more in a grand manor.
// Everything shown follows the game: goods in the stores (pottery on the dresser, cloth as curtains and quilts, candles,
// jewelry, beer), today's pantry on the table, the water barrel's level, critter treasures, the season and the hour.
import { TIERS, SEASON, DAY } from '../../../core/config.js';
import { beds, seasonIndex } from '../../../core/state.js';
import { itemsOn, floorsOf, syncLayout, BACK_D, growStage, FLOOR_NAMES } from '../../../core/furnish.js';
import { homeWater, homeWaterCap } from '../../../core/household.js';

// Placed pieces drawn as which rendered prop (the rest share their names).
const PROP_OF = { chair: 'windsor' };

// The room's walls and floor, by home level (house 0..8), matching each level's 3D house.
const STYLE = ['hut', 'cottage', 'cozy', 'timber', 'timber', 'stone', 'stone', 'manor', 'manor'];
export function homeStyle(b, floor) {
  const s = b.k === 'house' ? STYLE[b.lvl || 0] : b.k === 'farmhouse' ? ['cottage', 'cozy', 'timber'][b.lvl || 0] : 'timber';
  return floor >= 2 ? 'attic' : floor ? ({ timber: 'timber-up', stone: 'stone-up', manor: 'manor-up' }[s] || 'timber-up') : s;
}
// How grand the household is, 0..8 (farmhouses and the lodge count as middling homes).
const rank = b => (b.k === 'house' ? b.lvl || 0 : b.k === 'farmhouse' ? 1 + (b.lvl || 0) : 3);

// The things a household gathers, in the order they arrive: [prop, u, d, turned, from rank, upstairs?].
// u runs along the back wall (left to right), d out from it; turned pieces stand against the left wall facing in.
// The things a household gathers, in the order they arrive: [prop, u, d, turned, from rank, floor].
// u runs along the back wall (left to right), d out from it; turned pieces stand against the left wall facing in.
// Where something would crowd a bed, a walkway or another piece, the room finds it the nearest free spot (roomgrid.js).
const DECOR = [
  ['barrel', 0.07, 0.6, false, 0, 0],          // the water barrel
  ['basket', 0.42, 0.06, false, 0, 0],
  ['broom', 0.53, 0.05, false, 0, 0],
  ['chest', 0.47, 0.06, false, 1, 0],
  ['dresser', 0.04, 0.12, true, 2, 0],          // pottery on the plate shelves
  ['spinning-wheel', 0.3, 0.75, false, 2, 0],
  ['churn', 0.62, 0.08, false, 3, 0],
  ['settle', 0.12, 0.25, true, 3, 0],
  ['rocker', 0.3, 0.62, false, 3, 0],
  ['washstand', 0.5, 0.05, false, 3, 1],
  ['wardrobe', 0.04, 0.62, true, 3, 1],
  ['cupboard', 0.8, 0.06, false, 4, 0],
  ['tallclock', 0.04, 0.82, true, 5, 0],
  ['bookcase', 0.6, 0.05, false, 5, 0],
  ['chest', 0.6, 0.4, false, 5, 1],
  ['armchair', 0.75, 0.55, false, 6, 0],
  ['desk', 0.62, 0.05, false, 7, 0],
  ['highboy', 0.04, 0.4, true, 7, 1],
  ['harpsichord', 0.8, 0.45, true, 8, 0],
  ['armchair', 0.85, 0.75, false, 8, 0],
  // the attic: what a big household keeps under the roof
  ['chest', 0.3, 0.06, false, 7, 2], ['crate', 0.12, 0.85, false, 7, 2], ['sacks', 0.85, 0.85, false, 7, 2], ['spinning-wheel', 0.45, 0.45, false, 7, 2], ['basket', 0.7, 0.08, false, 7, 2],
];
// On the walls: [what, wall, along (0..1), height, from rank, upstairs?]
const WALLS = [
  ['herbs', 'left', 0.75, 1.7, 0, 0], ['shelf', 'back', 0.22, 1.5, 1, 0], ['sampler', 'back', 0.5, 1.6, 2, 0], ['sampler', 'left', 0.2, 1.5, 3, 1],
  ['landscape', 'back', 0.5, 1.55, 4, 0], ['portrait', 'left', 0.85, 1.4, 5, 0], ['mirror', 'back', 0.48, 1.4, 5, 1], ['portrait', 'back', 0.85, 1.5, 7, 0],
  ['portrait', 'left', 0.55, 1.45, 7, 1], ['landscape', 'left', 0.12, 1.5, 8, 0], ['herbs', 'left', 0.5, 0.6, 7, 2],
];

// A quilt sewn by the player lies on one of the beds: the rendered bed whose cover is nearest its main colour.
const SEWN = { '#b5523e': 'bed-red', '#4f7fb5': 'bed-blue', '#e0b040': 'bed-ochre', '#5f8a44': 'bed-green', '#7a5a9a': 'bed-plum', '#efe4cc': 'bed' };
const sewnBed = q => { const n = {}; for (const c of q) n[c] = (n[c] || 0) + 1; const top = Object.keys(n).sort((a, c) => n[c] - n[a])[0]; return SEWN[top] || 'bed'; };

export function home(g, b, c) {
  const sewn = i => (b.quilts && b.quilts[i]) ? sewnBed(b.quilts[i]) : null;
  syncLayout(b);
  const floor = c.floor || 0, up = floor > 0, r = rank(b), t = TIERS[b.k] ? TIERS[b.k][b.lvl || 0] : { goods: [] }, goods = t.goods || [];
  const has = res => (g.res[res] || 0) >= 1, uses = res => goods.includes(res);
  const cloth = uses('cloth') && has('cloth'), quilts = cloth ? ['bed-red', 'bed-blue', 'bed-ochre', 'bed-plum', 'bed-green'] : r === 0 ? ['pallet'] : ['bed'];
  const out = { style: homeStyle(b, floor), items: [], walls: [], floorLive: [], people: [], candles: [], notes: [], table: null, home: true, floor, floors: floorsOf(b) };
  const sleepers = g.villagers.filter(v => v.inside && v.act && v.act.type === 'sleep' && v.act.bed === b.id);
  // every bed and every placed piece, where the household put them (core/furnish.js)
  // sleepers fill the beds in order: one to a bed, two to a bunk
  let si = 0; const sleeperFor = []; for (const f of b.beds || []) { sleeperFor.push(sleepers.slice(si, si + (f.n || 1))); si += f.n || 1; }
  const bunks = cloth ? ['bunk', 'bunk-2', 'bunk-3'] : ['bunk-plain'];
  for (const it of itemsOn(b, floor)) {
    if (it.kind === 'bed') out.items.push({ id: (it.ref.n || 1) > 1 ? bunks[it.i % bunks.length] : sewn(it.i) || quilts[it.i % quilts.length], u: it.ref.u, d: it.ref.d, turn: !it.ref.flip, item: it, sleepers: sleeperFor[it.i] || [], bunk: (it.ref.n || 1) > 1 });
    else if (it.ref.id === 'rug') out.floorLive.push({ rug: true, u: it.ref.u, d: it.ref.d, rx: 0.8, rz: 0.55, col: '#b5523d', item: it });
    else { const st = growStage(g, it.ref); out.items.push({ id: (PROP_OF[it.ref.id] || it.ref.id) + (st ? '-' + st : ''), u: it.ref.u, d: it.ref.d, turn: !!it.ref.flip, item: it }); }
  }
  // the stairs: up from downstairs, the stairwell above, and a ladder up to the attic hatch
  const floors = floorsOf(b);
  if (floors > 1) out.items.push(floor === 0 ? { id: 'stairs', u: 0.93, d: 0.4, turn: false, fixed: true, keep: true } : floor === 1 ? { id: 'stairwell', u: 0.92, d: 0.4, turn: false, fixed: true, keep: true } : { id: 'hatch', u: 0.85, d: 0.4, turn: false, fixed: true, keep: true });
  if (floors > 2 && floor === 1) out.items.push({ id: 'ladder', u: 0.02, d: 0.08, turn: true, fixed: true, keep: true });
  // the household's own things, as many as its rank brings
  for (const [id, u, d, turn, from, fl] of DECOR) if (r >= from && fl === floor) out.items.push({ id, u, d, turn, fixed: true, barrel: id === 'barrel' });
  // the table and chairs downstairs (unless the household placed its own table)
  if (!up && !(b.furn || []).some(f => f.id === 'table' && !f.floor)) {
    const tu = floorsOf(b) > 1 ? 0.3 : 0.36, fine = r >= 5;
    out.items.push({ id: fine ? 'table-fine' : 'table', u: tu, d: 0.5, turn: false, fixed: true, table: true });
    out.items.push({ id: r >= 2 ? 'windsor' : 'stool', u: tu, d: 0.36, turn: false, fixed: true });
    out.items.push({ id: 'stool', u: tu + 0.1, d: 0.66, turn: false, fixed: true });
    if (r >= 3) out.items.push({ id: 'windsor', u: tu - 0.16, d: 0.5, turn: true, fixed: true });
  }
  // walls, rugs, curtains
  for (const [what, wall, at, y, from, fl] of WALLS) if (r >= from && fl === floor) out.walls.push({ what, wall, at, y });
  if (!up && uses('pottery')) out.walls.push({ what: 'shelf', wall: 'back', at: 0.22, y: 1.5, n: has('pottery') ? 4 : 1 });
  if (r >= 2 && floor < 2) out.floorLive.push({ rug: true, u: 0.42, d: 0.55, rx: 0.9 + r * 0.08, rz: 0.6 + r * 0.05, fine: r >= 7, col: r >= 7 ? '#8a3a3a' : '#b5823a' });
  out.curtains = cloth ? (r >= 7 ? '#5a6a9a' : '#b5523d') : null;
  // the season indoors
  const sea = seasonIndex(g);
  if (sea === 3 && r >= 1) out.walls.push({ what: 'wreath', wall: 'left', at: 0.4, y: 1.75 });
  // Paintings from the village artist, downstairs first.
  (b.art || []).forEach((seed, i) => { const [wall, at, y, fl] = [['left', 0.36, 1.45, 0], ['back', 0.72, 1.5, 0], ['left', 0.7, 1.45, Math.min(1, floorsOf(b) - 1)]][i] || []; if (wall && fl === floor) out.walls.push({ what: 'painting', wall, at, y, n: seed }); });
  out.season = sea;
  // pantry on the table (what the village has today) and beer for homes that drink it
  const p = g.pantry || {};
  out.food = { bread: (p.bread || 0) >= 1, cheese: (p.cheese || 0) >= 1, eggs: (p.eggs || 0) >= 1, honey: (p.honey || 0) >= 1, fruit: (p.fruit || 0) >= 1, vegetables: (p.vegetables || 0) >= 1, beer: uses('beer') && has('beer'), plates: r >= 3 };
  // light: candles in finer homes when the village has them
  const candles = has('candles') && r >= 4;
  if (candles || r >= 7) out.candles.push({ on: 'table' }, { on: 'mantel' });
  out.jewelry = uses('jewelry') && has('jewelry');
  // the barrel's water
  const cap = homeWaterCap(g, b); out.water = cap ? homeWater(b) / cap : 0;
  // who is home and what they're doing
  const h = c.h;
  out.sleepers = sleepers;
  // The household (whoever slept here last) at home: breakfast on the fire at dawn, round the table at mealtimes,
  // reading and spinning by the fire in the evening. Asleep at night (drawn in their beds).
  const fam = g.villagers.filter(v => v.homeId === b.id && !sleepers.includes(v) && !(v.act && v.act.type === 'leave'));
  const awake = [];
  if (!up && fam.length && !sleepers.length) {
    const meal = [[6.5, 7.5], [11.75, 12.5], [17.5, 18.5]].some(([a, z]) => h >= a && h < z);
    if (h >= 5 && h < 6.5) awake.push({ v: fam[0], pose: 'cook', at: 'hearth' });
    else if (meal) fam.slice(0, 4).forEach((v, i) => awake.push({ v, pose: 'sit', at: 'table', i }));
    else if (h >= 19 && h < 23) { awake.push({ v: fam[0], pose: 'read', at: 'fireside' }); if (fam[1] && r >= 2) awake.push({ v: fam[1], pose: 'work', at: 'wheel' }); }
  }
  out.notes.push(`${beds(b)} bed${beds(b) === 1 ? '' : 's'}` + (floors > 1 ? ` · ${FLOOR_NAMES[floor]}` : ''));
  if (cap) out.notes.push(`💧 ${homeWater(b)} / ${cap}`);
  out.notes.push(goods.length ? goods.map(res => `${has(res) ? '✓' : '·'} ${res}`).join('  ') : 'Plain and snug');
  if (sleepers.length) out.notes.push(`${sleepers.length} asleep`);
  out.awake = awake; out.rank = r; out.hearth = floor === 0 || out.style === 'manor-up';
  return out;
}
