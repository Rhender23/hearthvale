// Every other room: workshops (the real tools of each trade, their stock from the stores, the work in motion),
// gathering places (who is there now), halls, stores (shelves as full as the stores), and the rest.
// Each scene returns the same shape as a home: { style, items, walls, floorLive, people, live, notes, hearth }.
// Items: { id, u, d, turn } placed by the room (u along the back wall, d out from it; turned pieces face +x).
import { BUILD, RES, ICON } from '../../../core/config.js';
import { storeOf, cap } from '../../../core/state.js';
import { visitors } from '../../../core/leisure.js';
import { WORK, shelfGoods, steam } from '../live.js';

const it = (id, u, d, turn = false, extra) => ({ id, u, d, turn, fixed: true, ...(extra || {}) });
const base = (style, o = {}) => ({ style, items: [], walls: [], floorLive: [], people: [], live: [], candles: [], notes: [], hearth: true, ...o });
const seat = (list, people, pose = 'sit') => list.forEach((v, i) => people[i] && Object.assign(people[i], { v, pose }));
const GOODS_COL = { pottery: ['#b5653d', '#c98a5a'], cloth: ['#b5523d', '#4f7fb5', '#d19a3a'], furniture: ['#8a5a3a'], jewelry: ['#e2c26a', '#c0c8d0'], candles: ['#efe6d0'], bricks: ['#b5523e', '#a84a36'], tools: ['#8a8f96', '#6a4a2c'], beer: ['#9a6a3e'], flour: ['#efe6d0'], food: ['#c8894a', '#f0cf6a', '#e07a2a'], wool: ['#efe6d6'], wax: ['#d9b84a'], cheese: ['#f0cf6a'] };
const fillOf = (g, r) => { const c = cap(g, r); return c ? Math.min(1, (g.res[r] || 0) / c) : 0; };

// ---------------------------------------------------------------- workshops: tools, stock and the work going on
const TRADE = {
  potter:     { style: 'workshop', items: [it('potters-wheel', 0.45, 0.45), it('kiln', 0.82, 0.12), it('shelves', 0.2, 0.05), it('workbench', 0.06, 0.6, true)], at: [0.45, 0.62], live: (c, V, T, gl, R) => WORK.wheel(c, V, R.x('potters-wheel') , 0.62, R.z('potters-wheel'), T), stock: 'pottery' },
  carpenter:  { style: 'workshop', items: [it('workbench', 0.4, 0.4), it('workbench', 0.06, 0.65, true), it('shelves', 0.75, 0.05), it('crate', 0.85, 0.75)], at: [0.4, 0.62], stock: 'furniture' },
  weaver:     { style: 'workshop', items: [it('loom', 0.42, 0.42), it('spinning-wheel', 0.15, 0.7), it('shelves', 0.8, 0.05), it('basket', 0.75, 0.75)], at: [0.42, 0.7], live: (c, V, T, gl, R) => WORK.shuttle(c, V, R.x('loom') - 0.6, 0.78, R.z('loom') + 0.2, 1.2, T), stock: 'cloth' },
  jeweler:    { style: 'shop', items: [it('desk', 0.45, 0.06), it('workbench', 0.06, 0.5, true), it('shelves', 0.8, 0.05)], at: [0.45, 0.25], stock: 'jewelry', hearth: false },
  chandler:   { style: 'workshop', items: [it('vat', 0.3, 0.4), it('workbench', 0.65, 0.45), it('shelves', 0.8, 0.05)], at: [0.5, 0.65], live: (c, V, T, gl, R) => steam(c, V, R.x('vat'), 1.0, R.z('vat'), T), stock: 'candles' },
  'hen keeper': { style: 'stable', items: [it('basket', 0.3, 0.4), it('basket', 0.5, 0.5), it('crate', 0.8, 0.15), it('sacks', 0.15, 0.15)], at: [0.4, 0.6] },
  shepherd:   { style: 'stable', items: [it('sacks', 0.2, 0.2), it('basket', 0.6, 0.5), it('spinning-wheel', 0.4, 0.7)], at: [0.5, 0.6] },
  cowherd:    { style: 'stable', items: [it('churn', 0.3, 0.4), it('churn', 0.4, 0.42), it('vat', 0.7, 0.3)], at: [0.4, 0.6] },
  beekeeper:  { style: 'workshop', items: [it('shelves', 0.3, 0.05), it('workbench', 0.5, 0.5)], at: [0.5, 0.7], stock: 'wax' },
  cheesemaker:{ style: 'workshop', items: [it('vat', 0.3, 0.45), it('churn', 0.55, 0.4), it('shelves', 0.75, 0.05), it('workbench', 0.06, 0.6, true)], at: [0.45, 0.68], stock: 'food' },
  miller:     { style: 'workshop', items: [it('millstones', 0.45, 0.4), it('sacks', 0.85, 0.2), it('sacks', 0.8, 0.75)], at: [0.45, 0.75], live: (c, V, T, gl, R) => WORK.turn(c, V, R.x('millstones'), 0.96, R.z('millstones'), 0.55, T), stock: 'flour' },
  baker:      { style: 'workshop', items: [it('oven', 0.25, 0.25), it('workbench', 0.65, 0.45), it('shelves', 0.85, 0.05), it('sacks', 0.15, 0.75)], at: [0.62, 0.66], live: (c, V, T, gl, R) => WORK.glow(c, V, R.x('oven'), 0.55, R.z('oven') + 0.62, 0.6, gl), stock: 'food', hearth: false },
  brewer:     { style: 'workshop', items: [it('vat', 0.25, 0.3), it('vat', 0.55, 0.3), it('keg-rack', 0.45, 0.8)], at: [0.4, 0.55], live: (c, V, T, gl, R) => steam(c, V, R.x('vat'), 1.0, R.z('vat'), T), stock: 'beer' },
  artist:     { style: 'cozy', items: [it('workbench', 0.06, 0.6, true), it('desk', 0.6, 0.05), it('stool', 0.45, 0.55)], at: [0.45, 0.45], easel: true },
  blacksmith: { style: 'forge', items: [it('forge', 0.2, 0.2), it('anvil', 0.5, 0.5), it('workbench', 0.06, 0.75, true), it('shelves', 0.8, 0.05)], at: [0.5, 0.72], live: (c, V, T, gl, R) => { WORK.glow(c, V, R.x('forge'), 0.9, R.z('forge'), 0.7, gl); WORK.sparks(c, V, R.x('anvil'), 0.75, R.z('anvil'), T, gl); }, stock: 'tools', hearth: false },
  bricklayer: { style: 'forge', items: [it('oven', 0.22, 0.22), it('workbench', 0.55, 0.45), it('crate', 0.82, 0.2), it('crate', 0.82, 0.32), it('sacks', 0.15, 0.78)], at: [0.55, 0.66], live: (c, V, T, gl, R) => WORK.glow(c, V, R.x('oven'), 0.55, R.z('oven') + 0.62, 0.6, gl), stock: 'bricks' },
  stonecutter:{ style: 'forge', items: [it('workbench', 0.4, 0.4), it('crate', 0.8, 0.2), it('crate', 0.2, 0.8)], at: [0.4, 0.62] },
  'clay digger': { style: 'forge', items: [it('basket', 0.4, 0.4), it('sacks', 0.7, 0.2)], at: [0.4, 0.6] },
  miner:      { style: 'forge', items: [it('crate', 0.4, 0.4), it('sacks', 0.7, 0.2), it('workbench', 0.06, 0.6, true)], at: [0.4, 0.62] },
  gardener:   { style: 'glass', items: [it('potting-bench', 0.3, 0.05), it('potting-bench', 0.06, 0.55, true), it('plant', 0.6, 0.5), it('plant', 0.7, 0.6), it('plant', 0.55, 0.7), it('barrel', 0.85, 0.85)], at: [0.4, 0.3], hearth: false },
};
export function workshop(g, b) {
  const c = BUILD[b.k].craft, T = TRADE[c.role] || TRADE.carpenter, out = base(T.style, { hearth: T.hearth ?? false });
  out.items.push(...T.items.map(x => ({ ...x })));
  const worker = g.villagers.find(v => v.job === b.id), busy = worker && worker.act && worker.act.type === 'craft' && worker.act.b === b.id && worker.act.phase === 'work';
  if (busy) out.people.push({ v: worker, u: T.at[0], d: T.at[1], pose: 'work', facing: -1 });
  if (busy && T.live) out.live.push(T.live);
  if (T.stock) { const sh = out.items.find(x => x.id === 'shelves'); if (sh) out.live.push((cx, V, Tm, gl, R) => shelfGoods(cx, V, R.x0('shelves'), R.z0('shelves'), 2.0, 3, fillOf(g, T.stock), GOODS_COL[T.stock] || ['#9a6a3e'])); }
  out.walls.push({ what: 'herbs', wall: 'left', at: 0.3, y: 1.8 });
  const [o] = Object.keys(c.out);
  out.notes.push(worker ? `${worker.name}, the ${c.role}` + (busy ? ', at work' : '') : 'Waiting for a worker');
  out.notes.push(`${Object.entries(c.in).map(([r, n]) => n + ICON[r]).join(' ') || '·'} → ${c.out[o]}${ICON[o] || (o === 'culture' ? '🎭' : '')}`);
  return out;
}

// ---------------------------------------------------------------- gathering places: who is there now
function rowsOf(n, cols, u0, u1, d0, d1) { const out = []; for (let i = 0; i < n; i++) out.push([u0 + (u1 - u0) * ((i % cols) + 0.5) / cols, d0 + (d1 - d0) * Math.floor(i / cols) / Math.max(1, Math.ceil(n / cols) - 1 || 1)]); return out; }
export function tavern(g, b) {
  const out = base('tavern'), here = visitors(g, b);
  out.items.push(it('bar', 0.6, 0.06), it('keg-rack', 0.18, 0.05), it('settle', 0.12, 0.62, true), it('table', 0.45, 0.5), it('table', 0.7, 0.72), it('bench', 0.45, 0.66), it('bench', 0.7, 0.88), it('stool', 0.32, 0.5), it('stool', 0.82, 0.6));
  const spots = [[0.45, 0.66], [0.7, 0.88], [0.32, 0.5], [0.82, 0.6], [0.55, 0.66], [0.6, 0.88], [0.15, 0.62], [0.4, 0.2]];
  here.slice(0, spots.length).forEach((v, i) => out.people.push({ v, u: spots[i][0], d: spots[i][1], pose: 'sit' }));
  out.food = { beer: (g.res.beer || 0) >= 1, bread: true }; out.tables = ['table'];
  out.walls.push({ what: 'map', wall: 'back', at: 0.2, y: 1.4 }, { what: 'herbs', wall: 'left', at: 0.8, y: 1.8 });
  out.candles.push({ on: 'table' });
  out.notes.push(g.res.beer >= 1 ? `🍺 ${Math.floor(g.res.beer)} in the cellar` : 'The cellar is dry', `${here.length} here now`);
  return out;
}
export function school(g, b) {
  const out = base('school'), here = visitors(g, b);
  out.items.push(it('blackboard', 0.5, 0.04), it('desk', 0.15, 0.2), it('bookcase', 0.04, 0.7, true));
  const desks = [[0.35, 0.45], [0.7, 0.45], [0.35, 0.75], [0.7, 0.75]];
  for (const [u, d] of desks) out.items.push(it('school-desk', u, d));
  here.slice(0, 8).forEach((v, i) => out.people.push({ v, u: desks[i % 4][0] - 0.06 + Math.floor(i / 4) * 0.12, d: desks[i % 4][1] + 0.1, pose: 'sit' }));
  out.walls.push({ what: 'slates', wall: 'back', at: 0.5, y: 0.9 }, { what: 'map', wall: 'left', at: 0.35, y: 1.3 });
  out.notes.push(here.length ? `${here.length} at lessons` : 'Quiet for now', `🎭 culture ${Math.floor(g.culture || 0)}`);
  return out;
}
export function theater(g, b) {
  const out = base('theater', { hearth: false }), here = visitors(g, b);
  out.items.push(it('stage', 0.5, 0.17));
  const rows = [[0.5, 0.62], [0.5, 0.85]];
  for (const [u, d] of rows) { out.items.push(it('bench', u - 0.2, d), it('bench', u + 0.15, d)); }
  here.slice(0, 8).forEach((v, i) => out.people.push({ v, u: 0.22 + (i % 4) * 0.17, d: rows[Math.floor(i / 4) % 2][1] + 0.04, pose: 'sit' }));
  if (here.length) out.live.push((c, V, T) => { const [px, py] = V.pt(V.W * 0.5, 0.6, 1.2); c.fillStyle = '#4f7fb5'; c.beginPath(); c.roundRect(px - 0.15 * V.m, py - 1.2 * V.m - Math.abs(Math.sin(T * 3)) * 0.1 * V.m, 0.3 * V.m, 0.6 * V.m, 0.1 * V.m); c.fill(); c.fillStyle = '#e0b898'; c.beginPath(); c.arc(px, py - 1.35 * V.m, 0.12 * V.m, 0, 7); c.fill(); });
  out.candles.push({ x: 1.0, y: 0.6, z: 2.2 }, { x: 7.0, y: 0.6, z: 2.2 });
  out.notes.push(here.length ? `${here.length} watching a play` : 'The stage is quiet');
  return out;
}
export function church(g, b) {
  const out = base('church', { hearth: false }), here = visitors(g, b), steeple = (b.lvl || 0) >= 1;
  out.items.push(it('altar', 0.5, 0.08), it('pulpit', 0.15, 0.25));
  const pews = [[0.3, 0.45], [0.7, 0.45], [0.3, 0.65], [0.7, 0.65], [0.3, 0.85], [0.7, 0.85]];
  for (const [u, d] of pews) out.items.push(it('pew', u, d));
  here.slice(0, 18).forEach((v, i) => out.people.push({ v, u: pews[i % 6][0] - 0.1 + Math.floor(i / 6) * 0.1, d: pews[i % 6][1] + 0.03, pose: 'sit' }));
  out.candles.push({ on: 'altar' });
  if (steeple) out.live.push((c, V, T) => { const [px, py] = V.pt(V.W - 0.3, 2.6, 0.3), [qx, qy] = V.pt(V.W - 0.3, 0.9 + Math.sin(T) * 0.05, 0.3); c.strokeStyle = '#b8963a'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); c.lineTo(qx, qy); c.stroke(); c.fillStyle = '#b5523d'; c.fillRect(qx - 3, qy - 8, 6, 14); });
  out.notes.push(here.length ? `${here.length} here` : 'Quiet and peaceful', g.dawns % 7 === 0 ? 'Service this morning' : `Next service in ${7 - (g.dawns % 7)} days`);
  if (steeple) out.notes.push('The bell rope hangs from the steeple');
  return out;
}
export function library(g, b) {
  const out = base('library'), here = visitors(g, b);
  out.items.push(it('bookcase-tall', 0.25, 0.05), it('bookcase-tall', 0.72, 0.05), it('bookcase-tall', 0.04, 0.82, true), it('reading-table', 0.45, 0.5), it('armchair', 0.2, 0.62), it('armchair', 0.75, 0.75));
  const seats = [[0.38, 0.45], [0.55, 0.62], [0.2, 0.68], [0.75, 0.8]];
  here.slice(0, 4).forEach((v, i) => out.people.push({ v, u: seats[i][0], d: seats[i][1], pose: 'read' }));
  out.candles.push({ on: 'table' }); out.tables = ['reading-table'];
  out.walls.push({ what: 'portrait', wall: 'left', at: 0.4, y: 1.4 });
  out.notes.push(here.length ? `${here.length} reading` : 'Hushed and waiting for readers', `🎭 culture ${Math.floor(g.culture || 0)}`);
  return out;
}
export function bathhouse(g, b) {
  const out = base('bath', { hearth: false }), here = visitors(g, b);
  out.items.push(it('tub', 0.3, 0.4), it('tub', 0.7, 0.4), it('bench', 0.5, 0.85), it('basket', 0.1, 0.85));
  const tubs = [[0.3, 0.4], [0.7, 0.4]];
  out.live.push((c, V, T) => tubs.forEach(([u, d]) => steam(c, V, u * V.W, 0.6, d * V.D, T)));
  here.slice(0, 2).forEach((v, i) => out.live.push((c, V) => { const [px, py] = V.pt(tubs[i][0] * V.W, 0.6, tubs[i][1] * V.D); c.fillStyle = v.skin || '#c08a5d'; c.beginPath(); c.arc(px, py - 0.12 * V.m, 0.13 * V.m, 0, 7); c.fill(); c.fillStyle = v.hair || '#3d2b20'; c.beginPath(); c.ellipse(px, py - 0.2 * V.m, 0.13 * V.m, 0.07 * V.m, 0, 0, 7); c.fill(); }));
  here.slice(2, 5).forEach((v, i) => out.people.push({ v, u: 0.4 + i * 0.1, d: 0.85, pose: 'sit' }));
  out.notes.push(here.length ? `${here.length} soaking` : 'Warm water waiting');
  return out;
}
// The town center and the great hall: a long table, banners, the village map. At a festival the hall's tables are laid.
export function hall(g, b) {
  const great = b.k === 'greathall', out = base('hall');
  if (great) { out.items.push(it('long-table', 0.45, 0.35), it('long-table', 0.45, 0.75)); out.tables = ['long-table']; }
  else { out.items.push(it('table-fine', 0.5, 0.5), it('windsor', 0.5, 0.38), it('chest', 0.85, 0.06), it('bookcase', 0.04, 0.8, true), it('desk', 0.62, 0.06)); out.tables = ['table-fine']; }
  out.walls.push({ what: 'banner', wall: 'back', at: 0.15, y: 1.3, col: '#b5523d' }, ...(g.buildings.some(o => o.k === 'flagpole') ? [{ what: 'flag', wall: 'back', at: 0.4, y: 1.45, col: g.flag || null }] : [{ what: 'banner', wall: 'back', at: 0.38, y: 1.3, col: '#4f7fb5' }]), { what: 'map', wall: 'left', at: 0.75, y: 1.3 });
  const feast = great && g.festival && g.festival.phase !== 'planned';
  out.food = feast ? { bread: true, cheese: true, fruit: true, beer: true, vegetables: true, plates: true } : great ? { plates: true } : {};
  if (feast) { const here = g.villagers.slice(0, 16); here.forEach((v, i) => out.people.push({ v, u: 0.2 + (i % 8) * 0.075, d: i < 8 ? 0.3 : 0.7, pose: 'sit' })); }
  out.candles.push({ on: 'table' });
  out.notes.push(great ? (feast ? 'A feast in the great hall!' : 'Festivals gather here, and give twice the culture') : `${g.villagers.length} villagers · 🎭 ${Math.floor(g.culture || 0)}`);
  return out;
}

// ---------------------------------------------------------------- stores and shops: shelves as full as the stores
// The colours each kind of stock shows on a shelf.
const RES_COL = { wood: ['#a8784a', '#8a5a3a'], stone: ['#a9a397', '#8f8a80'], gold: ['#e2c26a'], food: ['#c8894a', '#f0cf6a', '#e07a2a'], water: ['#7fb8c8'],
  wheat: ['#e8c86a'], flour: ['#efe6d0'], beer: ['#9a6a3e'], wool: ['#efe6d6'], milk: ['#f6f3ea'], wax: ['#d9b84a'], seedlings: ['#6a9a4a'], clay: ['#b5653d'], fiber: ['#9aba6a'],
  pottery: ['#b5653d', '#c98a5a'], cloth: ['#b5523d', '#4f7fb5', '#d19a3a'], furniture: ['#8a5a3a'], jewelry: ['#e2c26a', '#c0c8d0'], candles: ['#efe6d0'], tools: ['#8a8f96', '#6a4a2c'], bricks: ['#b5523e', '#a84a36'] };
// Each resource gets half a shelf; its half fills as the village's store of it fills.
function stockShelf(c, V, s, kinds) {
  kinds.forEach(([fill, cols], i) => {
    const row = Math.floor(i / 2) % 3, half = i % 2, n = fill > 0 ? Math.max(1, Math.round(fill * 5)) : 0;
    for (let k = 0; k < n; k++) {
      const t = (half * 5 + k + 0.5) / 10, y = 0.14 + row * 0.5;
      const [px, py] = s.turn ? V.pt(s.x0 + 0.22, y, s.z0 + t * s.d) : V.pt(s.x0 + t * s.w, y, s.z0 + 0.22);
      c.fillStyle = cols[k % cols.length]; c.beginPath(); c.roundRect(px - 0.07 * V.m, py - 0.24 * V.m, 0.14 * V.m, 0.24 * V.m, 0.03 * V.m); c.fill();
    }
  });
}
export function storage(g, b) {
  const held = RES.filter(r => storeOf(g, b, r) > 0);
  const out = base(b.k === 'shop' || b.k === 'market' ? 'shop' : 'store', { hearth: false });
  const shop = b.k === 'shop' || b.k === 'market';
  if (shop) out.items.push(it('counter', 0.5, 0.55));
  const shelves = [[0.25, 0.05], [0.7, 0.05], [0.04, 0.7, true]];
  shelves.forEach(([u, d, t], i) => out.items.push(it('shelves', u, d, !!t, { shelfOf: held.filter((_, k) => k % 3 === i) })));
  // crates and sacks in proportion to how full the big stores are
  const bulk = held.filter(r => ['wood', 'stone', 'food', 'wheat', 'flour', 'clay', 'fiber', 'wool'].includes(r));
  const full = bulk.length ? bulk.reduce((s, r) => s + Math.min(1, (g.res[r] || 0) / Math.max(1, storeOf(g, b, r))), 0) / bulk.length : 0;
  const n = Math.round(full * 8);
  for (let i = 0; i < n; i++) out.items.push(it(i % 2 ? 'crate' : 'sacks', 0.3 + (i % 4) * 0.15, 0.55 + Math.floor(i / 4) * 0.2));
  // how full this building is of each thing it keeps (the village's stock, up to what this building holds)
  const here = r => Math.min(1, (g.res[r] || 0) / Math.max(1, storeOf(g, b, r)));
  out.live.push((c, V, T, gl, R) => { for (const s of R.placed.filter(p => p.shelfOf)) stockShelf(c, V, s, s.shelfOf.map(r => [here(r), RES_COL[r] || ['#b9a883']])); });
  out.notes.push(held.slice(0, 6).map(r => `${ICON[r]} ${Math.floor(g.res[r])}/${Math.floor(cap(g, r))}`).join('  '));
  return out;
}

// ---------------------------------------------------------------- the rest
export function observatory(g, b) {
  const out = base('observatory', { hearth: false });
  out.items.push(it('telescope', 0.5, 0.45), it('desk', 0.2, 0.05), it('bookcase', 0.04, 0.7, true), it('stool', 0.35, 0.6));
  out.stars = true;
  out.notes.push('Research costs a third less');
  return out;
}
export function stable(g, b) {
  const out = base('stable', { hearth: false });
  out.items.push(it('horse-stall', 0.25, 0.3), it('horse-stall', 0.6, 0.3), it('sacks', 0.85, 0.75), it('crate', 0.15, 0.85));
  out.notes.push('Cart horses: twice the load along the paths');
  return out;
}
export function waystation(g, b) {
  const out = tavern(g, b); out.notes = ['Travellers rest here; the merchant comes every other day']; return out;
}
