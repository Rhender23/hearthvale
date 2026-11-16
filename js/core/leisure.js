// New places to spend time, in one table: the bandstand (evening music) and the bathhouse (a warm soak after work).
// Each entry says when villagers want to go, who posts the wish, how long they stay, and what it does for them.
// The older gathering places (tavern, school, theater, church, library, playground) still live in their own spots;
// they could move into this table too.
export const LEISURE = {
  bandstand: { key: 'music', from: 17, to: 22, wish: 0.45, dir: 'Social', why: 'music at the bandstand', dur: [18, 14], culture: 0.008, company: 0.6, doing: 'Listening to the band at the bandstand' },
  bathhouse: { key: 'bathe', from: 16, to: 21, wish: 0.35, tired: 0.5, dir: 'Villagers', why: 'a warm soak after work', dur: [14, 10], doing: 'Soaking at the bathhouse', bathe: true },
};
export const LEISURE_KEY = Object.fromEntries(Object.entries(LEISURE).map(([k, L]) => [L.key, { k, ...L }]));
export const BATH_REST = 1.5;   // sleep and rest restore this much faster the night after a soak

const has = (g, k) => g.buildings.some(b => b.k === k && b.done);
const hour = g => (g.tod * 24 + 6) % 24;

// Each director's wishes for these places (called from the directors' think).
export function leisureWishes(g, post) {
  const h = hour(g);
  for (const [k, L] of Object.entries(LEISURE)) {
    if (!has(g, k) || h < L.from || h >= L.to) continue;
    const tired = L.tired ? L.tired * (1 - g.villagers.reduce((s, v) => s + v.energy, 0) / Math.max(1, g.villagers.length)) : 0;
    post(L.dir, L.key, L.wish + tired, L.why);
  }
}
// While a villager is there: culture, company, and the soak remembered for tonight's rest.
export function leisureTick(g, v, dt) {
  const a = v.act; if (!a || a.type !== 'sit' || a.phase !== 'wait') return;
  const L = LEISURE_KEY[a.key]; if (!L) return;
  if (L.culture) g.culture = (g.culture || 0) + L.culture * dt;
  if (L.company) v.comp = (v.comp || 0) + dt * L.company;
  if (L.bathe) v.bathed = g.dawns;
}
// How much faster this villager restores tonight.
export const restBoost = (g, v) => (v.bathed != null && g.dawns - v.bathed <= 1 ? BATH_REST : 1);
