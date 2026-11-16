// Hands-on moments: small, optional things to tap. None of them can be failed, and the village never waits on them:
// villagers still harvest, craft and fish on their own. A tap is just quicker, with a little extra.
//
//   ripe fields      a field with a crop shows a sparkle once in a while; tap it to bring in a basketful at once
//   ready goods      now and then a workshop sets aside a bundle of what it made (eggs at the coop); tap to collect
//   fishing          tap a fish shoal and catch when the float dips (an early or late tap still catches something)
//   quilting         piece a quilt at the weaver to match a pattern; it goes on a bed in a home
//   sorting          help the merchant sort the cart into crates; they pay a little for the help
import { BUILD, DAY, KIND_CODE, PANTRY_KIND } from './config.js';
import { canStore, addRes, notice, cap } from './state.js';
import { record } from './state.js';

export const HANDS = {
  ripeEvery: DAY / 4,       // a field can be tapped again a quarter day after the last tap
  basket: 6,                // food from one tap on a field (taken from the crop: the field empties a little faster)
  extra: 2,                 // and this much more, for the care
  readyChance: 0.25,        // of each finished piece of work, a workshop sets some aside
  fishBite: [2, 3],         // a catch: 2 food, 3 for a well-timed one…
  fishBest: 6,              // …and 6 for a perfect one
  quiltCloth: 2, quiltCulture: 6,
  sortPay: 12,              // gold for sorting the cart
};

const foodKind = b => BUILD[b.k].kind ? BUILD[b.k].kind : BUILD[b.k].orchard ? 'fruit' : b.k === 'farm' ? 'vegetables' : null;
function addFood(g, n, kind) {
  n = Math.min(n, Math.max(0, cap(g, 'food') - g.res.food)); if (n <= 0) return 0;
  addRes(g, 'food', n); record(g, 'in', 'food', n);
  const p = g.pantry || (g.pantry = {}), k = kind && PANTRY_KIND[KIND_CODE[kind]] ? PANTRY_KIND[KIND_CODE[kind]] : 'provisions'; p[k] = (p[k] || 0) + n;
  return n;
}

// ---- ripe fields
export const ripe = (g, b) => !!(b && b.done && BUILD[b.k].crop && (b.food || 0) >= 1 && g.clock - (b.tapAt ?? -1e9) >= HANDS.ripeEvery);
export function tapHarvest(g, b) {
  if (!ripe(g, b)) return { ok: false };
  const crop = BUILD[b.k].crop, take = Math.min(HANDS.basket, Math.floor(b.food));
  b.tapAt = g.clock; b.food -= take;
  let n;
  if (crop === 'food') n = addFood(g, take + HANDS.extra, foodKind(b));
  else { n = canStore(g, crop) ? Math.min(take + HANDS.extra, cap(g, crop) - g.res[crop]) : 0; if (n > 0) { addRes(g, crop, n); record(g, 'in', crop, n); } }
  if (!n) { b.food += take; return { ok: false, reason: 'The stores are full.' }; }
  return { ok: true, n, res: crop, kind: foodKind(b) };
}

// ---- ready goods: called when a workshop finishes a piece of work
export function maybeSetAside(g, b, res, n) {
  if (b.ready || res === 'culture' || g.rng() >= HANDS.readyChance) return;
  b.ready = { res, n: Math.max(1, Math.round(n / 2)), kind: BUILD[b.k].craft && BUILD[b.k].craft.kind };
}
export function collectReady(g, b) {
  const R = b && b.ready; if (!R) return { ok: false };
  let n = 0;
  if (R.res === 'food') n = addFood(g, R.n, R.kind);
  else if (canStore(g, R.res)) { n = Math.min(R.n, cap(g, R.res) - g.res[R.res]); if (n > 0) { addRes(g, R.res, n); record(g, 'in', R.res, n); } }
  if (!n) return { ok: false, reason: 'The stores are full.' };
  b.ready = null; return { ok: true, n, res: R.res, kind: R.kind };
}

// ---- fishing: quality 0 (any tap) .. 1 (right as the float dips)
export function landFish(g, i, quality) {
  const w = g.w; if (!(w.A[i] > 0)) return { ok: false, reason: 'The fish have gone from here for now.' };
  const n = quality > 0.85 ? HANDS.fishBest : quality > 0.5 ? HANDS.fishBite[1] : HANDS.fishBite[0];
  w.A[i] = Math.max(0, w.A[i] - 1);
  const got = addFood(g, n, null);
  if (got) { const p = g.pantry; p.provisions = Math.max(0, (p.provisions || 0) - got); p.fish = (p.fish || 0) + got; }
  return { ok: !!got, n: got, reason: got ? '' : 'The pantry is full.' };
}

// ---- quilting: a finished quilt goes on a bed in the home that has fewest
export function finishQuilt(g, colours) {
  if ((g.res.cloth || 0) < HANDS.quiltCloth) return { ok: false, reason: `A quilt takes ${HANDS.quiltCloth} cloth.` };
  g.res.cloth -= HANDS.quiltCloth; record(g, 'out', 'cloth', HANDS.quiltCloth);
  g.culture = (g.culture || 0) + HANDS.quiltCulture;
  const homes = g.buildings.filter(b => b.done && BUILD[b.k].home).sort((a, c) => (a.quilts || []).length - (c.quilts || []).length);
  const h = homes[0]; if (h) (h.quilts = h.quilts || []).push(colours.slice(0, 16));
  notice(g, 'A new quilt, warm on a bed in the village. 🧵');
  return { ok: true, home: h };
}

// ---- sorting the merchant's cart
export function cartSorted(g) {
  const vis = g.merchant && g.merchant.visit;
  if (!vis || vis.phase !== 'trade' || vis.sorted) return { ok: false, reason: 'The merchant is not here just now.' };
  vis.sorted = true; addRes(g, 'gold', HANDS.sortPay); record(g, 'in', 'gold', HANDS.sortPay);
  return { ok: true, n: HANDS.sortPay };
}
