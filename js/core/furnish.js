// Furnishing homes. Pieces are bought with furniture (🪑, from the furniture maker), sometimes cloth or pottery, and set
// in the room by hand. They are for looks only: a furnished home works exactly like a bare one. (Homes still use up
// furniture on their own as one of their goods, and climbing a level costs furniture too: see TIERS.house.)
// Treasures from the critter collection are placed the same way; they keep their small beauty bonus (b.decor).
//
// A room has spots: 'back' spots stand against the back wall (bookcases, cupboards, treasures), 'floor' spots out in
// the room (tables, chairs, chests, rugs). A grander home has more of them. Positions are in room units: u runs left to
// right (0..1), d from the back wall (0) to the front (1).
//   b.furn = [{ id, spot, flip }]
import { BUILD } from './config.js';
import { HOME_DECOR, critterLeft, CRITTERS } from './critters.js';
import { pay, have, addRes, notice, levelName } from './state.js';

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
};
export const FURNITURE = Object.keys(PIECES).filter(k => !PIECES[k].treasure);
export const TREASURES = Object.keys(PIECES).filter(k => PIECES[k].treasure);
export const costOf = id => PIECES[id].treasure ? null : PIECES[id].cost;
const critterCost = id => HOME_DECOR[id] ? HOME_DECOR[id].n : 0;

// Every spot a room could have, in the order they open up as the home grows.
const ALL_SPOTS = [
  { id: 'b1', kind: 'back', u: 0.36, d: 0.04 }, { id: 'f1', kind: 'floor', u: 0.36, d: 0.52 }, { id: 'f2', kind: 'floor', u: 0.18, d: 0.72 },
  { id: 'f3', kind: 'floor', u: 0.56, d: 0.66 }, { id: 'b2', kind: 'back', u: 0.6, d: 0.04 }, { id: 'f4', kind: 'floor', u: 0.5, d: 0.88 },
  { id: 'f5', kind: 'floor', u: 0.26, d: 0.34 }, { id: 'b3', kind: 'back', u: 0.74, d: 0.04 }, { id: 'f6', kind: 'floor', u: 0.72, d: 0.88 },
  { id: 'f7', kind: 'floor', u: 0.1, d: 0.9 }, { id: 'b4', kind: 'back', u: 0.48, d: 0.04 }, { id: 'f8', kind: 'floor', u: 0.4, d: 0.24 },
];
const SPOTS_BY_LEVEL = [4, 5, 6, 7, 8, 9, 10, 11, 12];
export const isHome = b => !!b && b.done && !!BUILD[b.k].home;
export function spotsFor(b) {
  if (!isHome(b)) return [];
  const n = b.k === 'house' ? SPOTS_BY_LEVEL[Math.min(SPOTS_BY_LEVEL.length - 1, b.lvl || 0)] : 6;
  return ALL_SPOTS.slice(0, n);
}
const furn = b => (b.furn = b.furn || []);
export const pieceAt = (b, spot) => furn(b).find(f => f.spot === spot) || null;
export const freeSpots = (b, kind) => spotsFor(b).filter(s => (!kind || s.kind === kind) && !pieceAt(b, s.id));

// Older saves: treasures given before furnishing existed get a spot of their own.
export function settleTreasures(b) {
  if (!isHome(b)) return;
  for (const id of b.decor || []) if (!furn(b).some(f => f.id === id)) { const s = freeSpots(b, PIECES[id].spot)[0] || freeSpots(b)[0]; if (s) furn(b).push({ id, spot: s.id, flip: false }); }
}

export function canAfford(g, id) {
  const p = PIECES[id];
  if (p.age > g.age) return false;
  if (p.treasure) return critterLeft(g, p.critter) >= critterCost(id);
  return have(g, p.cost);
}
export function whyNot(g, b, id, spot) {
  const p = PIECES[id];
  if (!p) return 'There is no such piece.';
  if (!isHome(b)) return 'Only homes are furnished.';
  if (p.age > g.age) return `The ${p.name.toLowerCase()} comes with a later age.`;
  if (p.treasure && (b.decor || []).includes(id)) return 'This home already has one.';
  const s = spotsFor(b).find(x => x.id === spot);
  if (!s) return 'Pick a glowing spot in the room.';
  if (s.kind !== p.spot) return p.spot === 'back' ? 'That goes against the back wall.' : 'That goes out on the floor.';
  if (pieceAt(b, spot)) return 'Something is already there.';
  if (p.treasure && critterLeft(g, p.critter) < critterCost(id)) { const need = critterCost(id) - critterLeft(g, p.critter); return `Catch ${need} more ${CRITTERS[p.critter].name}${need === 1 ? '' : 's'} at night first.`; }
  if (!p.treasure && !have(g, p.cost)) return p.cost.furniture ? 'The furniture maker needs to make more 🪑 first.' : 'Not enough in the stores yet.';
  return null;
}

export function placePiece(g, b, id, spot) {
  const why = whyNot(g, b, id, spot);
  if (why) return { ok: false, reason: why };
  const p = PIECES[id];
  if (p.treasure) { g.spent = g.spent || {}; g.spent[p.critter] = (g.spent[p.critter] || 0) + critterCost(id); (b.decor = b.decor || []).push(id); g.beautyDirty = true; notice(g, `A ${p.name.toLowerCase()} now brightens the ${levelName(b).toLowerCase()}.`); }
  else pay(g, p.cost);
  furn(b).push({ id, spot, flip: false });
  return { ok: true };
}
export function movePiece(g, b, from, to) {
  const f = pieceAt(b, from), s = spotsFor(b).find(x => x.id === to);
  if (!f || !s) return { ok: false, reason: 'Pick a glowing spot in the room.' };
  if (s.kind !== PIECES[f.id].spot) return { ok: false, reason: PIECES[f.id].spot === 'back' ? 'That goes against the back wall.' : 'That goes out on the floor.' };
  const other = pieceAt(b, to);
  if (other && other !== f) { if (PIECES[other.id].spot !== spotsFor(b).find(x => x.id === from).kind) return { ok: false, reason: 'Something is already there.' }; other.spot = from; }   // swap like for like
  f.spot = to;
  return { ok: true };
}
export function turnPiece(b, spot) { const f = pieceAt(b, spot); if (f) f.flip = !f.flip; return { ok: !!f }; }
// Put away: everything it cost comes back (critters too, for a treasure).
export function putAway(g, b, spot) {
  const f = pieceAt(b, spot);
  if (!f) return { ok: false };
  const p = PIECES[f.id];
  if (p.treasure) { g.spent[p.critter] = Math.max(0, (g.spent[p.critter] || 0) - critterCost(f.id)); b.decor = (b.decor || []).filter(x => x !== f.id); g.beautyDirty = true; }
  else for (const r in p.cost) addRes(g, r, p.cost[r]);
  b.furn = furn(b).filter(x => x !== f);
  return { ok: true };
}
