// Furnishing homes. Pieces are bought with furniture (🪑, from the furniture maker), sometimes cloth or pottery, and set
// in the room by hand. They are for looks only: a furnished home works exactly like a bare one. (Homes still use up
// furniture on their own as one of their goods, and climbing a level costs furniture too: see TIERS.house.)
// Treasures from the critter collection are placed the same way; they keep their small beauty bonus (b.decor).
//
// Everything in a home stands where the player puts it: 'back' pieces against the back wall (bookcases, cupboards,
// treasures), the rest anywhere on the floor (tables, chairs, chests, rugs). Beds are part of the layout too, one for
// every bed the home has, and can be moved, turned and taken away like anything else. Homes from the Timber house up
// have an upstairs, and the biggest an attic too. Positions are in room units: u runs left to right (0..1), d from the back wall (0) to the
// front (1); floor 0 is downstairs.
//   b.furn = [{ id, u, d, floor, flip, at }]      b.beds = [{ u, d, floor, flip, n }] (n: 1 a single bed, 2 a bunk)
import { DAY, BUILD } from './config.js';
import { HOME_DECOR, critterLeft, CRITTERS } from './critters.js';
import { pay, have, addRes, notice, levelName, beds } from './state.js';

export const PIECES = {
  chair:    { name: 'Chair', icon: '🪑', cost: { furniture: 1 }, spot: 'floor', w: 0.45, h: 0.9, col: '#7a4a2c', age: 0 },
  stool:    { name: 'Stool', icon: '🪵', cost: { furniture: 1 }, spot: 'floor', w: 0.4, h: 0.45, col: '#8a6a44', age: 0 },
  table:    { name: 'Table', icon: '🍽️', cost: { furniture: 2 }, spot: 'floor', w: 1.1, h: 0.75, col: '#8a5a3a', age: 0 },
  chest:    { name: 'Chest', icon: '🧳', cost: { furniture: 2 }, spot: 'floor', w: 0.9, h: 0.55, col: '#9a6a3e', age: 0 },
  rug:      { name: 'Rug', icon: '🟥', cost: { cloth: 2 }, spot: 'floor', w: 1.6, h: 0, col: '#b5523d', age: 1, flat: true },
  plant:    { name: 'Potted plant', icon: '🪴', cost: { pottery: 1 }, spot: 'floor', w: 0.4, h: 0.7, col: '#5f9e4a', age: 0 },
  bookcase: { name: 'Bookcase', icon: '📚', cost: { furniture: 3 }, spot: 'back', w: 1.0, h: 1.9, col: '#6a4a2c', age: 0 },
  cupboard: { name: 'Cupboard', icon: '🗄️', cost: { furniture: 3, pottery: 1 }, spot: 'back', w: 1.0, h: 1.6, col: '#7a5638', age: 0 },
  wardrobe: { name: 'Wardrobe', icon: '🚪', cost: { furniture: 4, cloth: 2 }, spot: 'back', w: 1.1, h: 2.0, col: '#5a3a24', age: 2 },
  // treasures (paid in critters)
  lantern:  { name: 'Firefly lantern', icon: '🏮', critter: 'firefly', spot: 'back', w: 0.3, h: 0.4, treasure: true, age: 0 },
  aquarium: { name: 'Frog aquarium', icon: '🐸', critter: 'frog', spot: 'floor', w: 0.6, h: 0.9, treasure: true, age: 0 },
  owlcage:  { name: 'Owl in a cage', icon: '🦉', critter: 'owl', spot: 'back', w: 0.5, h: 1.5, treasure: true, age: 0 },
  foxhearth:  { name: 'Fox family', icon: '🦊', critter: 'fox', spot: 'floor', w: 0.8, h: 0.4, treasure: true, age: 0, grows: true },
  curio:      { name: 'Raccoon curio cabinet', icon: '🦝', critter: 'raccoon', spot: 'back', w: 0.9, h: 1.6, treasure: true, age: 0 },
  wolfbasket: { name: 'Wolf cub', icon: '🐺', critter: 'wolf', spot: 'floor', w: 0.8, h: 0.5, treasure: true, age: 0, grows: true },
  bearnook:   { name: 'Bear-cub reading nook', icon: '🐻', critter: 'bear', spot: 'back', w: 1.1, h: 1.6, treasure: true, age: 0 },
};
export const FURNITURE = Object.keys(PIECES).filter(k => !PIECES[k].treasure);
export const TREASURES = Object.keys(PIECES).filter(k => PIECES[k].treasure);
export const costOf = id => PIECES[id].treasure ? null : PIECES[id].cost;
const critterCost = id => HOME_DECOR[id] ? HOME_DECOR[id].n : 0;

export const isHome = b => !!b && b.done && !!BUILD[b.k].home;
const furn = b => (b.furn = b.furn || []);

// How many floors: one for huts and cottages; an upstairs from the Timber house (level 3); an attic as well in the
// manor, the grand manor and the lodge.
export const floorsOf = b => (!isHome(b) ? 1 : b.k === 'lodge' || (b.k === 'house' && (b.lvl || 0) >= 7) ? 3 : b.k === 'house' && (b.lvl || 0) >= 3 ? 2 : 1);
export const FLOOR_NAMES = ['downstairs', 'upstairs', 'the attic'];

// Beds stand in frames: a single bed (n: 1) or a bunk (n: 2). Cottages and cozy cottages sleep in bunks; the hut has
// straw pallets. In homes with an upstairs, downstairs is kitchen and parlour, and every bed is upstairs (and in the
// attic): six frames to a floor, bunks once there are more beds than that.
//   b.beds = [{ u, d, floor, flip, n }]
const ROWS = [0.14, 0.38, 0.62, 0.86];
const SLOTS_ONE = ROWS.map(d => [0.8, d]);                                       // down the right-hand side
const SLOTS_UP = [...ROWS.map(d => [0.2, d]), [0.8, 0.14], [0.8, 0.86]];         // both sides, clear of the stairwell (right, middle)
export const PER_FLOOR = 6;
const bunkHome = b => b.k === 'house' && (b.lvl || 0) >= 1 && (b.lvl || 0) <= 2;
export const bedCount = b => (b.beds || []).reduce((s, f) => s + (f.n || 1), 0);

// A fresh layout: where every bed goes.
function planBeds(b, want) {
  const floors = floorsOf(b), out = [];
  if (floors === 1) {
    const frames = bunkHome(b) ? Math.ceil(want / 2) : Math.min(want, SLOTS_ONE.length + 2);
    for (let i = 0; i < frames; i++) { const [u, d] = SLOTS_ONE[i] || [0.3, 0.86 - (i - 4) * 0.24]; out.push({ u, d, floor: 0, flip: false, n: 1 }); }
  } else {
    for (let fl = 1; fl < floors; fl++) for (const [u, d] of SLOTS_UP) out.push({ u, d, floor: fl, flip: false, n: 1 });
    out.length = Math.min(out.length, want);
  }
  // more beds than frames: frames become bunks, upstairs first
  let extra = want - out.length;
  for (const f of out) { if (extra <= 0) break; f.n = 2; extra--; }
  return out;
}
// Older saves placed pieces at numbered spots; this is where those spots were.
const OLD_SPOTS = { b1: [0.36, 0.04], f1: [0.36, 0.52], f2: [0.18, 0.72], f3: [0.56, 0.66], b2: [0.6, 0.04], f4: [0.5, 0.88], f5: [0.26, 0.34], b3: [0.74, 0.04], f6: [0.72, 0.88], f7: [0.1, 0.9], b4: [0.48, 0.04], f8: [0.4, 0.24] };
export const BACK_D = 0.04;
const clamp = (v, a, z) => Math.max(a, Math.min(z, v));

// Bring a home's layout up to date: old spot saves, the right number of beds, nothing left on a floor it no longer has.
export function syncLayout(b) {
  if (!isHome(b)) return;
  const floors = floorsOf(b);
  for (const f of furn(b)) {
    if (f.u == null) { const o = OLD_SPOTS[f.spot] || [0.5, 0.6]; f.u = o[0]; f.d = o[1]; f.floor = 0; delete f.spot; }
    if ((f.floor || 0) >= floors) f.floor = 0;
  }
  // A home whose floors changed lays its beds out afresh (the bedrooms move up). Otherwise beds are added or taken
  // away one at a time, keeping where the household put the rest. (Furniture stays.)
  const want = beds(b);
  if ((b.bedFloors || 1) !== floors || !b.beds) b.beds = planBeds(b, want);
  b.bedFloors = floors;
  const list = b.beds;
  for (const f of list) { f.n = f.n || 1; if ((f.floor || 0) >= floors) f.floor = floors - 1; if (floors > 1 && !f.floor) f.floor = 1; }
  while (bedCount(b) > want) { const f = list[list.length - 1]; if (f.n > 1) f.n--; else list.pop(); }
  while (bedCount(b) < want) {
    const fresh = planBeds(b, want).find(p => !list.some(x => x.floor === p.floor && Math.abs(x.u - p.u) < 0.2 && Math.abs(x.d - p.d) < 0.12));
    const onFloor = fl => list.filter(x => x.floor === fl).length;
    if (fresh && (floors === 1 || onFloor(fresh.floor) < PER_FLOOR) && !(bunkHome(b) && list.some(x => x.n === 1))) list.push({ ...fresh, n: 1 });
    else { const single = list.find(x => x.n === 1); if (single) single.n = 2; else list.push({ u: 0.5, d: 0.5, floor: floors - 1, flip: false, n: 1 }); }
  }
}
// Take a bed away (a bunk becomes a single): one less person can live here. At least one bed always stays.
export function removeBed(b, frame) {
  if (beds(b) <= 1) return { ok: false, reason: 'Every home keeps at least one bed.' };
  b.bedsOff = (b.bedsOff || 0) + 1;
  if ((frame.n || 1) > 1) frame.n--; else b.beds = b.beds.filter(f => f !== frame);
  return { ok: true };
}
// Put a bed back (up to the level's own number of beds).
export function addBed(b) { if (!(b.bedsOff > 0)) return { ok: false }; b.bedsOff--; syncLayout(b); return { ok: true }; }
// Everything on one floor, as { kind: 'bed'|'piece', ref, i }.
export function itemsOn(b, floor) {
  syncLayout(b);
  const out = [];
  (b.beds || []).forEach((ref, i) => { if ((ref.floor || 0) === floor) out.push({ kind: 'bed', ref, i }); });
  for (const ref of furn(b)) if ((ref.floor || 0) === floor) out.push({ kind: 'piece', ref });
  return out;
}
// Where a piece may stand: back pieces keep to the back wall.
export function fitPos(kind, u, d) { return kind === 'back' ? [clamp(u, 0.08, 0.92), BACK_D] : [clamp(u, 0.08, 0.92), clamp(d, 0.1, 0.96)]; }
const kindOf = item => (item.kind === 'bed' ? 'floor' : PIECES[item.ref.id].spot);

// Older saves: treasures given before furnishing existed get a place of their own.
export function settleTreasures(b) {
  if (!isHome(b)) return;
  syncLayout(b);
  for (const id of b.decor || []) if (!furn(b).some(f => f.id === id)) { const [u, d] = fitPos(PIECES[id].spot, 0.3 + 0.1 * furn(b).length % 0.6, 0.6); furn(b).push({ id, u, d, floor: 0, flip: false }); }
}

export function canAfford(g, id) {
  const p = PIECES[id];
  if (p.age > g.age) return false;
  if (p.treasure) return critterLeft(g, p.critter) >= critterCost(id);
  return have(g, p.cost);
}
export function whyNot(g, b, id) {
  const p = PIECES[id];
  if (!p) return 'There is no such piece.';
  if (!isHome(b)) return 'Only homes are furnished.';
  if (p.age > g.age) return `The ${p.name.toLowerCase()} comes with a later age.`;
  if (p.treasure && (b.decor || []).includes(id)) return 'This home already has one.';
  if (p.treasure && critterLeft(g, p.critter) < critterCost(id)) { const need = critterCost(id) - critterLeft(g, p.critter); return `Catch ${need} more ${CRITTERS[p.critter].name}${need === 1 ? '' : 's'} at night first.`; }
  if (!p.treasure && !have(g, p.cost)) return p.cost.furniture ? 'The furniture maker needs to make more 🪑 first.' : 'Not enough in the stores yet.';
  return null;
}

export function placePiece(g, b, id, u, d, floor = 0) {
  const why = whyNot(g, b, id);
  if (why) return { ok: false, reason: why };
  const p = PIECES[id];
  if (p.treasure) { g.spent = g.spent || {}; g.spent[p.critter] = (g.spent[p.critter] || 0) + critterCost(id); (b.decor = b.decor || []).push(id); g.beautyDirty = true; notice(g, `A ${p.name.toLowerCase()} now brightens the ${levelName(b).toLowerCase()}.`); }
  else pay(g, p.cost);
  const [pu, pd] = fitPos(p.spot, u, d), f = { id, u: pu, d: pd, floor: Math.min(floor, floorsOf(b) - 1), flip: false, at: g.clock };   // at: when it arrived (the cubs grow from then)
  furn(b).push(f);
  return { ok: true, f };
}
// Move a bed or a piece (an item from itemsOn) to (u, d), on this floor or another.
export function moveItem(b, item, u, d, floor) {
  const [pu, pd] = fitPos(kindOf(item), u, d);
  item.ref.u = pu; item.ref.d = pd;
  if (floor != null) item.ref.floor = Math.max(0, Math.min(floorsOf(b) - 1, floor));
  return { ok: true };
}
export function turnItem(item) { item.ref.flip = !item.ref.flip; return { ok: true }; }
// Put away a piece: everything it cost comes back (critters too, for a treasure). Beds stay.
export function putAway(g, b, item) {
  if (!item || item.kind !== 'piece') return { ok: false };
  const f = item.ref, p = PIECES[f.id];
  if (p.treasure) { g.spent[p.critter] = Math.max(0, (g.spent[p.critter] || 0) - critterCost(f.id)); b.decor = (b.decor || []).filter(x => x !== f.id); g.beautyDirty = true; }
  else for (const r in p.cost) addRes(g, r, p.cost[r]);
  b.furn = furn(b).filter(x => x !== f);
  return { ok: true };
}

// The fox cubs and the wolf cub grow up over a year: cubs, then young, then grown (0, 1, 2).
export const GROW_DAYS = 8;   // days at each stage (a year is 24 days)
export const growStage = (g, f) => { if (!PIECES[f.id] || !PIECES[f.id].grows) return 0; if (f.at == null) f.at = g.clock; return Math.min(2, Math.floor(Math.max(0, g.clock - f.at) / (GROW_DAYS * DAY))); };   // older saves start growing now
