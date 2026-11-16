// Looking inside a building. A cutaway room in the game's own isometric view: the room and its furniture are
// rendered from 3D (art.js), placed by the building's scene (scenes/), and everything that changes is drawn live on
// top (live.js, people.js). Homes can be rearranged (arrange.js).
//
//   room      iso.js     the view: metres to screen and back, drawing on the walls and floor
//   art       art.js     the rendered rooms and pieces, loaded the first time a door is opened
//   scenes    scenes/    what each building holds and who is there: home.js, places.js
//   live      live.js    fire, light, windows, rugs, food, goods, work in motion
//   people    people.js  villagers at true size
import { BUILD } from '../../core/config.js';
import { levelName, hour } from '../../core/state.js';
import { isHome, floorsOf, settleTreasures, FLOOR_NAMES } from '../../core/furnish.js';
import { loadInteriorArt, art, roomSpec, propSize, blit, has } from './art.js';
import { createView } from './iso.js';
import { person, sleeper } from './people.js';
import { windowsSky, sunbeams, hearthFire, candle, nightLight, onWall, WALL, rug, tableTop, waterIn } from './live.js';
import { home } from './scenes/home.js';
import * as P from './scenes/places.js';
import { createArrange } from './arrange.js';
import { createGrid, homeAisles } from './roomgrid.js';

// Buildings you can look into: anything with walls that is finished.
const NO_INSIDE = ['campfire', 'quarry', 'claypit', 'goldmine', 'well', 'monument', 'playground', 'apiary', 'watertower', 'bandstand'];
export const hasInside = b => b && b.done && !BUILD[b.k].flat && !BUILD[b.k].decor && !NO_INSIDE.includes(b.k) && !BUILD[b.k].orchard;

// Which scene shows a building.
function sceneFor(g, b, c) {
  const d = BUILD[b.k];
  if (d.home) return home(g, b, c);
  if (b.k === 'tc' || b.k === 'greathall') return P.hall(g, b, c);
  if (P[b.k]) return P[b.k](g, b, c);
  if (d.craft) return P.workshop(g, b, c);
  return P.storage(g, b, c);
}

export function openInterior(g, b, onClose) {
  loadInteriorArt();
  const mk = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const wrap = mk('div'); wrap.id = 'inside';
  const box = mk('div', 'dlg'), head = mk('div', 'in-head'), title = mk('b'), close = mk('button', 'sh-x', '✕');
  close.setAttribute('aria-label', 'Close');
  const cv = mk('canvas'), cap1 = mk('div', 'cap'), tools = mk('div', 'in-tools');
  head.append(title, close); box.append(head, cv, cap1, tools); wrap.append(box); document.body.append(wrap);
  const CW = Math.min(window.innerWidth - 40, 620), CH = Math.round(CW * 0.74), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = CW * dpr; cv.height = CH * dpr; cv.style.width = CW + 'px'; cv.style.height = CH + 'px';
  const ctx = cv.getContext('2d');
  let open = true, raf = 0;
  const st = { mode: null, piece: null, sel: null, tab: 'furniture', open: false, msg: '', floor: 0 };
  const done = () => { if (!open) return; open = false; cancelAnimationFrame(raf); wrap.remove(); document.removeEventListener('keydown', key); onClose && onClose(); };
  const key = e => { if (e.key === 'Escape') { if (st.mode || st.sel || st.open) { st.mode = null; st.sel = null; st.piece = null; st.open = false; A && A.refresh(); } else done(); } };
  close.onclick = done; wrap.addEventListener('pointerdown', e => { if (e.target === wrap) done(); }); document.addEventListener('keydown', key);
  if (isHome(b)) settleTreasures(b);
  const say = t => { st.msg = t; A && A.refresh(); };
  const R = { V: null, placed: [] };   // the last frame's view and where everything stood (for taps and drags)
  try { window.__room = R; } catch (e) { /* tests */ }   // handy in the console
  const A = isHome(b) ? createArrange({ g, b, cv, R, st, say, mk }) : null;
  if (A) { cv.addEventListener('pointerdown', A.down); cv.addEventListener('pointermove', A.move); cv.addEventListener('pointerup', A.up); cv.addEventListener('pointercancel', A.up); cv.style.touchAction = 'none'; }
  else tools.hidden = true;
  const frame = t => {
    if (!open) return;
    if (!g.bmap.has(b.id)) return done();
    title.textContent = levelName(b) + (floorsOf(b) > 1 ? ' · ' + FLOOR_NAMES[st.floor || 0] : '');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cap1.textContent = draw(ctx, g, b, CW, CH, t / 1000, st, R, dpr);
    if (A) A.tools(tools);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return done;
}

// ---------------------------------------------------------------- one frame
function draw(ctx, g, b, CW, CH, T, st, R, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const h = hour(g), c = { floor: st.floor || 0, h, T };
  const S = sceneFor(g, b, c), rs = roomSpec(S.style), [W, D] = rs.size;
  // fit the room: its full width is 64·(W + D) art pixels; its height 32·(W + D) plus the walls
  const k = Math.min(CW * 0.94 / (64 * (W + D) + 30), CH * 0.92 / (32 * (W + D) + 78.4 * (rs.wallH + 0.2)));
  const V = createView(W, D, k, CW / 2 + k * 32 * (W - D), CH - CH * 0.04, dpr);
  R.V = V;
  ctx.fillStyle = '#2a2420'; ctx.fillRect(0, 0, CW, CH);
  const glows = [];
  // the room itself
  const [fx, fy] = V.pt(W, 0, D);
  if (!blit(ctx, 'room/' + S.style, fx, fy, k)) plainRoom(ctx, V, rs);
  // walls: the sky in the windows, curtains, pictures and shelves
  const wins = rs.windows || [], night = h >= 21 || h < 5;
  windowsSky(ctx, V, wins, h, T);
  if (S.stars && night) for (const w of wins) onWall(ctx, V, 'back', cx => { cx.fillStyle = '#fff'; for (let i = 0; i < 20; i++) cx.fillRect(w.x - w.w / 2 + ((i * 41) % 97) / 97 * w.w, w.y + ((i * 67) % 89) / 89 * w.h, 0.015, 0.015); });
  if (S.curtains) for (const w of wins) onWall(ctx, V, 'back', cx => WALL.curtains(cx, w, night, S.curtains));
  for (const w of S.walls || []) {
    // keep pictures off the windows and the chimney: slide along to the nearest clear stretch of wall
    let at = (w.wall === 'back' ? W : D) * w.at;
    if (w.wall === 'back') for (const wn of wins) if (Math.abs(at - wn.x) < wn.w / 2 + 0.45) at = wn.x + (at < wn.x ? -1 : 1) * (wn.w / 2 + 0.5);
    if (w.wall === 'left' && rs.hearth && rs.hearth.kind !== 'pit' && Math.abs(at - rs.hearth.z) < 0.95) at = rs.hearth.z + (at < rs.hearth.z ? -1 : 1) * 1.05;
    const fn = WALL[w.what]; if (fn) onWall(ctx, V, w.wall, cx => fn(cx, at, w.y, w.n ?? w.col ?? 0, w.col));
  }
  // the floor: daylight and rugs
  sunbeams(ctx, V, wins, h);
  for (const r of S.floorLive || []) if (r.rug) rug(ctx, V, r.u * W, r.d * D, r.rx, r.rz, r.col, r.fine);
  // the hearth's fire (it sits in the wall, behind everything)
  if (S.hearth !== false && rs.hearth) hearthFire(ctx, V, rs.hearth, h, T, glows);
  if (rs.hearth && S.candles && S.candles.some(x => x.on === 'mantel') && rs.hearth.kind !== 'pit') { const hz = rs.hearth.z; candle(ctx, V, 0.25, 1.38, hz - 0.45, T, night || h >= 18, glows); candle(ctx, V, 0.25, 1.38, hz + 0.45, T, night || h >= 18, glows); }
  // place everything, then draw back to front
  // Every piece takes its slots on the room's grid; the walkway and the doorway stay clear (roomgrid.js). The stairs
  // go first, then the household's beds and placed pieces, then the house's own things, each finding the nearest free
  // spot if its own is taken. Beds and pieces that had to move keep their new place.
  const grid = createGrid(W, D), placed = [];
  if (S.home) for (const a of homeAisles(W, D, S.floor, S.floors, S.hearth !== false ? rs.hearth : null)) grid.take(...a, 'aisle');
  else if (S.hearth !== false && rs.hearth && rs.hearth.kind !== 'pit') grid.take(0, rs.hearth.z - rs.hearth.w / 2 - 0.25, 1.0, rs.hearth.w + 0.5, 'hearth');
  const order = [...S.items.filter(i => i.keep), ...S.items.filter(i => !i.keep && i.item), ...S.items.filter(i => !i.keep && !i.item)];
  for (const it of order) {
    const [w, d] = propSize(it.id, it.turn), tag = it.item ? it.item.ref : it;
    let x = clamp(it.x ?? it.u * W, w / 2, W - w / 2), z = clamp(it.z ?? it.d * D, d / 2, D - d / 2);
    if (!grid.free(x - w / 2, z - d / 2, w, d, tag)) {
      const spot = grid.nearest(x, z, w, d, tag);
      if (spot) { [x, z] = spot; if (it.item && !st.drag) { it.item.ref.u = x / W; it.item.ref.d = z / D; } }
      else if (!it.keep && !it.item) continue;   // the house's own odds and ends: left out if there is no room
    }
    grid.take(x - w / 2, z - d / 2, w, d, tag);
    placed.push({ ...it, x, z, w, d, x0: x - w / 2, z0: z - d / 2 });
  }
  R.grid = grid;
  // the front door (downstairs in homes)
  if (S.home && S.floor === 0) onWall(ctx, V, 'left', cx => { const z = D - 0.65; cx.fillStyle = '#5a3a24'; cx.fillRect(z - 0.45, 0, 0.9, 2.0); cx.fillStyle = '#6a4a2c'; cx.fillRect(z - 0.38, 0.08, 0.36, 0.85); cx.fillRect(z + 0.02, 0.08, 0.36, 0.85); cx.fillRect(z - 0.38, 1.05, 0.36, 0.85); cx.fillRect(z + 0.02, 1.05, 0.36, 0.85); cx.fillStyle = '#b8963a'; cx.beginPath(); cx.arc(z + 0.3, 1.0, 0.04, 0, 7); cx.fill(); });
  // placed rugs can be picked up and moved too
  for (const r of S.floorLive || []) if (r.item) { const [cx, cy] = V.pt(r.u * W, 0, r.d * D), rx = (r.rx + r.rz) * 64 * k; placed.push({ item: r.item, x: r.u * W, z: r.d * D, w: 0.01, d: 0.01, x0: 0, z0: 0, rugOnly: true, box: [cx - rx, cy - rx / 2, cx + rx, cy + rx / 2] }); }
  R.placed = placed;
  const byId = id => placed.find(p => p.id === id) || { x: W / 2, z: D / 2, x0: 0, z0: 0 };
  const LR = { x: id => byId(id).x, z: id => byId(id).z, x0: id => byId(id).x0, z0: id => byId(id).z0, placed };
  const people = (S.people || []).map(p => ({ ...p, x: p.x ?? p.u * W, z: p.z ?? p.d * D }));
  // the household at home (homes): by the fire, at the table, at the wheel
  for (const a of S.awake || []) {
    const tbl = placed.find(p => p.table), hz = rs.hearth ? rs.hearth.z : D / 2;
    if (a.at === 'hearth') people.push({ v: a.v, x: 1.1, z: hz + 0.2, pose: 'cook', facing: -1 });
    if (a.at === 'fireside') people.push({ v: a.v, x: 1.3, z: hz - 0.6, pose: 'read' });
    if (a.at === 'wheel') { const w = placed.find(p => p.id === 'spinning-wheel'); if (w) people.push({ v: a.v, x: w.x + 0.2, z: w.z + 0.55, pose: 'work', facing: -1 }); }
    if (a.at === 'table' && tbl) people.push({ v: a.v, x: tbl.x0 + 0.25 + (a.i % 2) * (tbl.w - 0.5), z: a.i < 2 ? tbl.z0 - 0.2 : tbl.z0 + tbl.d + 0.2, pose: 'sit' });
  }
  const list = [...placed.filter(p => !p.rugOnly).map(p => ({ k: p.x + p.z, p })), ...people.map(q => ({ k: q.x + q.z + 0.3, q }))].sort((a, z) => a.k - z.k);
  for (const e of list) {
    if (e.q) { person(ctx, V, e.q.x, e.q.z, e.q.v, e.q.pose, T, e.q.facing || 1); continue; }
    const p = e.p, [ax, ay] = V.pt(p.x0 + p.w, 0, p.z0 + p.d), keyName = 'prop/' + p.id + (p.turn ? '/turned' : '');
    if (!blit(ctx, keyName, ax, ay, k)) plainBox(ctx, V, p);
    p.box = spriteBox(keyName, ax, ay, k) || [ax - 40, ay - 60, ax + 10, ay];
    (p.sleepers || []).forEach((v, i) => sleeper(ctx, V, p.x, p.z, p.turn, v, i ? 0.85 : 0));
    if (p.barrel) waterIn(ctx, V, p.x, p.z, 0.3, 0.8, S.water ?? 0.7);
    if (p.table || (S.tables || []).includes(p.id)) {
      tableTop(ctx, V, p.x, 0.78, p.z, S.food || {});
      if (S.candles && S.candles.some(c => c.on === 'table')) candle(ctx, V, p.x + 0.1, 0.78, p.z - 0.15, T, night || h >= 18, glows);
    }
    if (p.id === 'altar' && S.candles) { candle(ctx, V, p.x - 0.4, 1.02, p.z, T, true, glows); candle(ctx, V, p.x + 0.4, 1.02, p.z, T, true, glows); }
    if (p.id === 'dresser' && S.jewelry) { const [jx, jy] = V.pt(p.x + 0.1, 0.92, p.z); ctx.fillStyle = '#b8963a'; ctx.fillRect(jx - 6, jy - 6, 12, 7); }
    if (st.sel && p.item && p.item.ref === st.sel.ref) ring(ctx, V, p, T, st.blocked);
  }
  for (const c of S.candles || []) if (c.x != null) candle(ctx, V, c.x, c.y, c.z, T, true, glows);
  for (const fn of S.live || []) fn(ctx, V, T, glows, LR);
  V.reset(ctx); nightLight(ctx, V, CW, CH, h, glows);
  if (st.mode === 'place') hintFloor(ctx, V, T);
  return (S.notes || []).join(' · ');
}

const clamp = (v, a, z) => Math.max(a, Math.min(z, v));
function spriteBox(key, ax, ay, k) { const s = art().slots[key]; return s ? [ax - s.anchor[0] * k, ay - s.anchor[1] * k, ax + (s.w - s.anchor[0]) * k, ay + (s.h - s.anchor[1]) * k * 0.2] : null; }
function ring(ctx, V, p, T, blocked) {
  const [cx, cy] = V.pt(p.x, 0, p.z), rx = (p.w + p.d) * 0.36 * V.k * 90, ry = rx / 2;
  ctx.strokeStyle = blocked ? 'rgba(220,70,60,.9)' : `rgba(242,193,78,${0.7 + 0.3 * Math.sin(T * 5)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.stroke();
}
function hintFloor(ctx, V, T) {
  const a = V.pt(0, 0, 0), b = V.pt(V.W, 0, 0), c = V.pt(V.W, 0, V.D), d = V.pt(0, 0, V.D);
  ctx.strokeStyle = `rgba(255,236,160,${0.5 + 0.3 * Math.sin(T * 4)})`; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
}
// Drawn plainly while the art loads (or if a picture is missing).
function plainRoom(ctx, V, rs) {
  const [W, D] = rs.size, H = rs.wallH, poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill(); };
  poly([V.pt(0, 0, 0), V.pt(W, 0, 0), V.pt(W, 0, D), V.pt(0, 0, D)], '#a8804e');
  poly([V.pt(0, 0, 0), V.pt(0, H, 0), V.pt(0, H, D), V.pt(0, 0, D)], '#d4c09c');
  poly([V.pt(0, 0, 0), V.pt(0, H, 0), V.pt(W, H, 0), V.pt(W, 0, 0)], '#e8d8b8');
}
function plainBox(ctx, V, p) {
  const h = 0.8, x0 = p.x0, z0 = p.z0, x1 = p.x0 + p.w, z1 = p.z0 + p.d, poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.closePath(); ctx.fill(); };
  poly([V.pt(x0, h, z0), V.pt(x1, h, z0), V.pt(x1, h, z1), V.pt(x0, h, z1)], '#a8784a');
  poly([V.pt(x0, 0, z1), V.pt(x1, 0, z1), V.pt(x1, h, z1), V.pt(x0, h, z1)], '#8a5a3a');
  poly([V.pt(x1, 0, z0), V.pt(x1, 0, z1), V.pt(x1, h, z1), V.pt(x1, h, z0)], '#7a4a2c');
}
export { has as hasArt };
