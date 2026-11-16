// Every place villagers go to spend time, in one table. Each entry is a building kind and says:
//   key      the activity's name (what the villagers' options and wishes are called)
//   wish     when villagers want to go and how much: [from, to] hours, a weight, the director who posts it, and why.
//            `when(g, ctx)` instead, for places with their own rhythm (the weekly service, a lonely evening).
//   dur      how long they stay: [at least, plus up to] seconds
//   culture  culture per second for each villager there      company  company (good spirits) per second
//   doing    what their bubble says while they're there        social   how much the planner values it for company
//   attend   the share of a day's visiting the planner counts for culture (default all)    gather  the planner's reason
//   scene    which interior scene shows it (js/ui/interior/scenes)
// Adding a new gathering place is one entry here, plus its building in config.js.
import { CULTURE } from './config.js';

const hour = g => (g.tod * 24 + 6) % 24;
const avgEnergy = g => g.villagers.reduce((s, v) => s + v.energy, 0) / Math.max(1, g.villagers.length);
const lonely = g => (g.social ?? 1) < 0.6;

export const LEISURE = {
  tavern: { key: 'tavern', dur: [20, 15], doing: 'Having a drink at the tavern', social: 0.6, gather: 'evenings together at the tavern', scene: 'tavern', beer: true,
    // Evenings from 6 PM; twice as wanted when spirits are low.
    when: (g, c) => (c.h >= 18 && c.h < 23 ? { dir: 'Social', wish: Math.min(1.4, 0.65 * (lonely(g) ? 2 : 1)), why: lonely(g) ? 'people need time together' : 'an evening at the tavern' } : null) },
  school: { key: 'learn', dur: [20, 10], culture: CULTURE.learn, doing: 'At lessons in the schoolhouse', scene: 'school',
    wish: { from: 8, to: 17, w: 0.25, dir: 'Culture', why: 'learning something new' } },
  theater: { key: 'theater', dur: [25, 15], culture: CULTURE.theater, doing: 'Watching a play at the theater', social: 0.4, scene: 'theater',
    wish: { from: 18, to: 23, w: 0.6, dir: 'Culture', why: 'there is a play tonight' } },
  church: { key: 'church', dur: [30, 20], culture: CULTURE.church, doing: 'At church', social: 0.4, attend: 0.6, scene: 'church', service: true,
    // The whole village gathers every seventh morning; otherwise a quiet moment now and then.
    when: (g, c) => (g.dawns % 7 === 0 && c.h >= 9 && c.h < 11 ? { dir: 'Culture', wish: 1.3, why: 'the weekly service' } : c.h >= 7 && c.h < 19 ? { dir: 'Culture', wish: 0.12, why: 'a quiet moment' } : null) },
  library: { key: 'read', dur: [25, 15], culture: CULTURE.read, doing: 'Reading at the library', scene: 'library',
    wish: { from: 9, to: 20, w: 0.3, dir: 'Culture', why: 'a good book' } },
  playground: { key: 'play', dur: [15, 10], company: 0.5, doing: 'Playing at the playground', social: 0.5, gather: 'somewhere to play', scene: null,
    wish: { from: 13, to: 18, w: 0.35, dir: 'Social', why: 'an afternoon at the playground' } },
  bandstand: { key: 'music', dur: [18, 14], culture: 0.008, company: 0.6, doing: 'Listening to the band at the bandstand', social: 0.4, attend: 0.5, gather: 'music at the bandstand', scene: null,
    wish: { from: 17, to: 22, w: 0.45, dir: 'Social', why: 'music at the bandstand' } },
  bathhouse: { key: 'bathe', dur: [14, 10], doing: 'Soaking at the bathhouse', social: 0.4, gather: 'a warm soak after work', scene: 'bathhouse', bathe: true,
    // A soak is wanted more the more tired the village is.
    when: (g, c) => (c.h >= 16 && c.h < 21 ? { dir: 'Villagers', wish: 0.35 + 0.5 * (1 - avgEnergy(g)), why: 'a warm soak after work' } : null) },
};
export const LEISURE_KEY = Object.fromEntries(Object.entries(LEISURE).map(([k, L]) => [L.key, { k, ...L }]));
export const BATH_REST = 1.5;   // sleep and rest restore this much faster the night after a soak

const has = (g, k) => g.buildings.some(b => b.k === k && b.done);

// Each director's wishes for these places (called from the directors' think).
export function leisureWishes(g, post) {
  const c = { h: hour(g) };
  for (const [k, L] of Object.entries(LEISURE)) {
    if (!has(g, k)) continue;
    const w = L.when ? L.when(g, c) : (c.h >= L.wish.from && c.h < L.wish.to ? { dir: L.wish.dir, wish: L.wish.w, why: L.wish.why } : null);
    if (w) post(w.dir, L.key, w.wish, w.why);
  }
}
// The action a villager takes to go there.
export const leisureAction = (g, key, target) => { const L = LEISURE_KEY[key]; return { tavern: target, dur: L.dur[0] + g.rng() * L.dur[1], key }; };
// While a villager is there: culture, company, beer at the tavern, and a soak remembered for tonight's rest.
// churchCulture: the church's own multiplier by level (the grand steeple adds half again).
export function leisureTick(g, v, dt, churchCulture = () => 1) {
  const a = v.act; if (!a || a.type !== 'sit' || a.phase !== 'wait') return;
  const L = LEISURE_KEY[a.key]; if (!L) return;
  if (L.culture) g.culture = (g.culture || 0) + L.culture * dt * (L.service ? churchCulture(g, a.tavern) : 1);
  if (L.company) v.comp = (v.comp || 0) + dt * L.company;
  if (L.bathe) v.bathed = g.dawns;
  // Beer at the tavern: spirits rise twice as fast and the evening adds a little culture.
  if (L.beer && g.res.beer > 0) { g.res.beer = Math.max(0, g.res.beer - CULTURE.beerPerSec * dt); v.tav = (v.tav || 0) + dt; g.culture = (g.culture || 0) + CULTURE.tavernBeer * dt; }
}
// How much faster this villager restores tonight.
export const restBoost = (g, v) => (v.bathed != null && g.dawns - v.bathed <= 1 ? BATH_REST : 1);
// Who is at a place right now (for its interior).
export const visitors = (g, b) => g.villagers.filter(v => v.act && v.act.type === 'sit' && v.act.tavern === b.id && v.act.phase === 'wait');
