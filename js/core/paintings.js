// Paintings: now and then the artist's studio finishes a picture and hangs it in a home that has a bare wall.
// A home holds one painting, two from a cozy cottage up, three from a timber house up. Each is just a number (its seed);
// the interior draws the picture from it: a landscape, flowers in a jug, the sea, or an orchard.
import { BUILD } from './config.js';
import { notice } from './state.js';

export const PAINT_CHANCE = 1 / 3;   // of each finished piece of studio work
export const wallsFor = b => (b.lvl || 0) >= 3 ? 3 : (b.lvl || 0) >= 2 ? 2 : 1;
export const SUBJECTS = ['landscape', 'flowers', 'sea', 'orchard'];

export function maybePaint(g, studio) {
  if (g.rng() >= PAINT_CHANCE) return null;
  const homes = g.buildings.filter(b => b.done && BUILD[b.k].home && (b.art || []).length < wallsFor(b));
  if (!homes.length) return null;
  homes.sort((a, c) => (a.art || []).length - (c.art || []).length || Math.hypot(a.x - studio.x, a.y - studio.y) - Math.hypot(c.x - studio.x, c.y - studio.y));
  const h = homes[0], seed = 1 + Math.floor(g.rng() * 9999);
  (h.art = h.art || []).push(seed);
  notice(g, `The artist hung a new painting of ${['the hills', 'flowers in a jug', 'the sea', 'the orchard'][seed % 4]} in a home.`);
  return h;
}
