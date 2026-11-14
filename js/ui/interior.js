// Looking inside a building: a small cutaway room on its own canvas.
//
// The room is drawn in one-point perspective: a back wall, two side walls, a ceiling and a floor that comes toward you.
// Everything is placed in metres on the floor (u = left to right 0..1, d = back to front 0..1) or on the back wall,
// and sized from real proportions (a villager is 1.65 m tall, a bed 2 m long, a table 0.75 m high), so the room keeps
// one scale whatever it holds. What you see follows the building's level and what the village has in store; villagers
// who are inside (asleep, at work, at the tavern) appear too. Homes can be given treasures from the critter collection.
import { BUILD, TIERS, ICON, RES } from '../core/config.js';
import { storeOf, cap, levelName, beds, hour, isNight } from '../core/state.js';
import { CRITTERS, critterLeft } from '../core/critters.js';
import { PIECES, FURNITURE, TREASURES, spotsFor, pieceAt, settleTreasures, canAfford, placePiece, movePiece, turnPiece, putAway, isHome } from '../core/furnish.js';
import { fmt } from './dom.js';

// Buildings you can look into: anything with walls that is finished.
export const hasInside = b => b && b.done && !BUILD[b.k].flat && !BUILD[b.k].decor && !['campfire', 'quarry', 'claypit', 'goldmine', 'well', 'monument', 'playground', 'apiary'].includes(b.k);

// Wall, floor and trim by quality (0 = humble, 4 = grand).
const LOOK = [
  { wall: '#7a5a3c', side: '#6a4c32', floor: '#8a6e4a', ceil: '#4a3424', trim: '#5a4028', logs: true },
  { wall: '#a07a50', side: '#8e6a44', floor: '#9a7a50', ceil: '#6a4a2c', trim: '#6a4a2c', logs: true },
  { wall: '#e8d8b8', side: '#d4c09c', floor: '#a8804e', ceil: '#7a5638', trim: '#6a4a2c', beams: true },
  { wall: '#cbc4b6', side: '#b4ac9e', floor: '#b8a68a', ceil: '#8a8478', trim: '#5a5a62', stone: true },
  { wall: '#dccdae', side: '#c9b894', floor: '#8a5a3a', ceil: '#6a4a30', trim: '#4a3020', paper: true },
];
function quality(b) {
  if (b.k === 'house') return [0, 1, 1, 2, 2, 3, 3, 4, 4][b.lvl || 0];
  if (b.k === 'tc') return 2 + Math.min(2, b.lvl || 0);
  if (TIERS[b.k]) return Math.min(4, 1 + (b.lvl || 0));
  return BUILD[b.k].age >= 2 ? 3 : BUILD[b.k].age >= 1 ? 2 : 1;
}

// Room geometry, shared by drawing and by taps on the room.
function geom(W, H) {
  const bx0 = W * 0.16, bx1 = W * 0.84, by0 = H * 0.08, by1 = H * 0.6, mBack = (by1 - by0) / 2.7;
  const M = d => mBack * (1 + d * (W / (bx1 - bx0) - 1));
  const P = (u, d) => { const xb = bx0 + u * (bx1 - bx0), xf = u * W; return [xb + (xf - xb) * d, by1 + (H - by1) * d]; };
  return { bx0, bx1, by0, by1, mBack, M, P };
}

export function openInterior(g, b, onClose) {
  const mk = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const wrap = mk('div'); wrap.id = 'inside';
  const box = mk('div', 'dlg'), head = mk('div', 'in-head'), title = mk('b'), close = mk('button', 'sh-x', '✕');
  close.setAttribute('aria-label', 'Close');
  const cv = mk('canvas'), cap1 = mk('div', 'cap'), tools = mk('div', 'in-tools');
  head.append(title, close); box.append(head, cv, cap1, tools); wrap.append(box); document.body.append(wrap);
  const W = Math.min(window.innerWidth - 40, 560), H = Math.round(W * 0.66), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let open = true, raf = 0, toolsKey = '';
  const done = () => { if (!open) return; open = false; cancelAnimationFrame(raf); wrap.remove(); document.removeEventListener('keydown', key); onClose && onClose(); };
  const key = e => { if (e.key === 'Escape') { if (st.mode || st.sel) { st.mode = null; st.sel = null; st.piece = null; toolsKey = ''; } else done(); } };
  close.onclick = done; wrap.addEventListener('pointerdown', e => { if (e.target === wrap) done(); }); document.addEventListener('keydown', key);

  // Furnishing (homes only): pick a piece, tap a glowing spot. Tap a placed piece to move, turn or put it away.
  const st = { mode: null, piece: null, sel: null, tab: 'furniture', open: false, msg: '' };
  if (isHome(b)) settleTreasures(b);
  const say = t => { st.msg = t; toolsKey = ''; };
  const btn = (txt, cls, on) => { const e = mk('button', cls, txt); e.onclick = on; return e; };
  function drawTools() {
    if (!isHome(b)) { tools.hidden = true; return; }
    const k = [st.mode, st.piece, st.sel, st.tab, st.open, st.msg, FURNITURE.concat(TREASURES).map(id => +canAfford(g, id)).join(''), (b.furn || []).length].join('|');
    if (k === toolsKey) return; toolsKey = k;
    const kids = [];
    if (st.msg) kids.push(mk('small', 'in-msg', st.msg));
    if (st.sel) {
      const f = pieceAt(b, st.sel), p = f && PIECES[f.id];
      if (!p) { st.sel = null; return drawTools(); }
      kids.push(mk('b', null, p.name));
      kids.push(Object.assign(mk('div', 'pop-yn'), {}));
      kids[kids.length - 1].append(
        btn('✕', 'pbtn', () => { st.sel = null; st.mode = null; say(''); }),
        btn('📦 Put away', 'pbtn', () => { putAway(g, b, st.sel); st.sel = null; say(p.treasure ? 'Put away. The critters are back in your collection.' : 'Put away. What it cost is back in the stores.'); }),
        btn('🔄 Turn', 'pbtn', () => { turnPiece(b, st.sel); }),
        btn(st.mode === 'move' ? '✋ Tap a spot…' : '✋ Move', 'pbtn primary', () => { st.mode = 'move'; say('Tap a glowing spot to move it there.'); }));
    } else if (st.mode === 'place') {
      kids.push(mk('b', null, `${PIECES[st.piece].icon} ${PIECES[st.piece].name}`));
      const row = mk('div', 'pop-yn'); row.append(btn('✕ Cancel', 'pbtn', () => { st.mode = null; st.piece = null; say(''); })); kids.push(row);
    } else if (!st.open) {
      const row = mk('div', 'pop-yn'); row.append(btn('🛋️ Furnish', 'pbtn primary', () => { st.open = true; say('Choose a piece, then tap a glowing spot in the room. Tap anything you placed to move it.'); })); kids.push(row);
    } else {
      const tabs = mk('div', 'tabs');
      for (const [id, label] of [['furniture', 'Furniture'], ['treasures', 'Treasures']]) { const t = btn(label, 'tab' + (st.tab === id ? ' on' : ''), () => { st.tab = id; toolsKey = ''; }); tabs.append(t); }
      tabs.append(btn('Done', 'tab', () => { st.open = false; say(''); }));
      kids.push(tabs);
      const grid = mk('div', 'cards');
      for (const id of st.tab === 'furniture' ? FURNITURE : TREASURES) {
        const p = PIECES[id], c = mk('button', 'card');
        const price = p.treasure ? `${HOME_DECOR_N(id)} ${CRITTERS[p.critter].icon} (you have ${critterLeft(g, p.critter)})` : fmt(p.cost);
        c.append(mk('span', 'cn', `${p.icon} ${p.name}`), mk('small', null, p.age > g.age ? 'Comes with a later age' : price));
        c.disabled = !canAfford(g, id) || (p.treasure && (b.decor || []).includes(id));
        c.onclick = () => { st.mode = 'place'; st.piece = id; st.sel = null; say(`Tap a glowing spot ${p.spot === 'back' ? 'against the back wall' : 'on the floor'}.`); };
        grid.append(c);
      }
      kids.push(grid);
    }
    tools.replaceChildren(...kids);
  }
  const G = geom(W, H);
  const spotXY = s => { const [x, y] = G.P(s.u, s.d); return [x, y - (s.kind === 'back' ? 0.5 : 0.15) * G.M(s.d)]; };
  cv.addEventListener('pointerdown', e => {
    if (!isHome(b)) return;
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let best = null, bd = 1e9;
    for (const s of spotsFor(b)) { const [x, y] = spotXY(s), d = Math.hypot(px - x, py - y); if (d < Math.max(26, 0.7 * G.M(s.d)) && d < bd) { bd = d; best = s; } }
    if (!best) { if (st.sel && st.mode !== 'move') { st.sel = null; say(''); } return; }
    if (st.mode === 'place') { const res = placePiece(g, b, st.piece, best.id); if (res.ok) { const p = PIECES[st.piece]; st.mode = null; st.piece = null; say(`${p.name} placed.`); } else say(res.reason); return; }
    if (st.mode === 'move' && st.sel) { const res = movePiece(g, b, st.sel, best.id); if (res.ok) { st.mode = null; st.sel = best.id; say('Moved.'); } else say(res.reason); return; }
    if (pieceAt(b, best.id)) { st.sel = best.id; st.mode = null; st.open = false; say(''); }
  });
  const frame = t => {
    if (!open) return;
    if (!g.bmap.has(b.id)) return done();
    title.textContent = levelName(b);
    cap1.textContent = draw(ctx, g, b, W, H, t / 1000, st);
    drawTools();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return done;
}
const HOME_DECOR_N = id => ({ lantern: 5, aquarium: 3, owlcage: 2 })[id] || 0;

// ---------------------------------------------------------------- the room
function draw(c, g, b, W, H, T, st) {
  const q = quality(b), L = LOOK[q];
  // Back wall rectangle and the floor trapezoid in front of it; M(d) is pixels per metre at depth d (0 back, 1 front).
  const G = geom(W, H), { bx0, bx1, by0, by1, mBack } = G;
  const R = { c, g, b, W, H, T, L, q, notes: [], bx0, bx1, by0, by1, mBack, st: st || {} };
  R.M = G.M; R.P = G.P;
  R.Wl = (u, h) => [bx0 + u * (bx1 - bx0), by1 - h * mBack];   // a point on the back wall, h metres up
  shell(R);
  const def = BUILD[b.k];
  if (def.home) home(R);
  else if (def.craft) workshop(R);
  else if (b.k === 'tavern') tavern(R);
  else if (b.k === 'school') school(R);
  else if (b.k === 'theater') theater(R);
  else if (b.k === 'market' || b.k === 'shop') shop(R);
  else if (b.k === 'tc') hall(R);
  else if (b.k === 'church') church(R);
  else if (b.k === 'library') library(R);
  else storage(R);
  // Evening light: the room dims and the hearth and lamps glow (drawn by each piece).
  if (R.night) { c.fillStyle = 'rgba(30,25,50,.28)'; c.fillRect(0, 0, W, H); for (const gl of R.glows || []) { const gr = c.createRadialGradient(gl[0], gl[1], 2, gl[0], gl[1], gl[2]); gr.addColorStop(0, 'rgba(255,200,120,.38)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = gr; c.fillRect(gl[0] - gl[2], gl[1] - gl[2], gl[2] * 2, gl[2] * 2); } }
  return R.notes.join(' · ');
}

const poly = (c, pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); };
const rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const emoji = (c, e, x, y, s) => { c.font = `${Math.max(8, s)}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, x, y); };
function shade(hex, f) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, k = v => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${k(r)},${k(g)},${k(b)})`; }

function shell(R) {
  const { c, W, H, L, q, bx0, bx1, by0, by1, mBack, g } = R;
  // ceiling, side walls, back wall, floor
  poly(c, [[0, 0], [W, 0], [bx1, by0], [bx0, by0]], L.ceil);
  poly(c, [[0, 0], [bx0, by0], [bx0, by1], [0, H]], L.side);
  poly(c, [[W, 0], [bx1, by0], [bx1, by1], [W, H]], shade(L.side, 0.92));
  rect(c, bx0, by0, bx1 - bx0, by1 - by0, L.wall);
  poly(c, [[bx0, by1], [bx1, by1], [W, H], [0, H]], L.floor);
  // wall finish
  c.save(); c.beginPath(); c.rect(bx0, by0, bx1 - bx0, by1 - by0); c.clip();
  if (L.logs) for (let h = 0.25; h < 2.7; h += 0.3) rect(c, bx0, by1 - h * mBack, bx1 - bx0, 2.5, shade(L.wall, 0.82));
  if (L.beams) { for (let u = 0; u <= 1.001; u += 0.25) rect(c, bx0 + u * (bx1 - bx0) - 3, by0, 6, by1 - by0, L.trim); }
  if (L.stone) for (let h = 0; h < 2.7; h += 0.35) for (let u = ((h / 0.35) % 2) * 0.05; u < 1; u += 0.1) { c.strokeStyle = shade(L.wall, 0.86); c.lineWidth = 1; c.strokeRect(bx0 + u * (bx1 - bx0), by1 - (h + 0.35) * mBack, 0.1 * (bx1 - bx0), 0.35 * mBack); }
  if (L.paper) { rect(c, bx0, by1 - 0.9 * mBack, bx1 - bx0, 0.9 * mBack, '#a8584a'); rect(c, bx0, by1 - 0.95 * mBack, bx1 - bx0, 0.06 * mBack, L.trim); for (let u = 0.03; u < 1; u += 0.07) for (let h = 1.2; h < 2.6; h += 0.35) { c.fillStyle = 'rgba(150,100,60,.25)'; c.beginPath(); c.arc(bx0 + u * (bx1 - bx0), by1 - h * mBack, 2.4, 0, 7); c.fill(); } }
  c.restore();
  // floor finish: boards run toward you; stone gets tiles; a hut has packed earth
  c.save(); c.beginPath(); c.moveTo(bx0, by1); c.lineTo(bx1, by1); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.clip();
  c.strokeStyle = 'rgba(0,0,0,.13)'; c.lineWidth = 1;
  if (q === 0) for (let i = 0; i < 40; i++) { const p = R.P((i * 0.137) % 1, (i * 0.291) % 1); c.fillStyle = 'rgba(60,40,20,.18)'; c.beginPath(); c.arc(p[0], p[1], 1.5 + 2 * ((i * 0.291) % 1), 0, 7); c.fill(); }
  else { for (let u = 0; u <= 1.001; u += 1 / 12) { const a = R.P(u, 0), e = R.P(u, 1); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(e[0], e[1]); c.stroke(); } if (q === 3) for (let d = 0.12; d < 1; d *= 1.55) { const a = R.P(0, d), e = R.P(1, d); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(e[0], e[1]); c.stroke(); } }
  c.restore();
  // skirting where the walls meet the floor
  rect(c, bx0, by1 - 3, bx1 - bx0, 3, L.trim);
  // daylight or night through the windows
  const h = hour(g); R.night = isNight(g) || h >= 20 || h < 6; R.sky = R.night ? '#26305a' : h < 8 || h > 18 ? '#f2b98a' : '#a8d4f0'; R.glows = [];
}

// A window on the back wall, centred at u, 0.8 m wide and 1.0 m tall, 1.0 m up.
function windowAt(R, u, curtains) {
  const { c, L, mBack } = R, [x, y] = R.Wl(u, 2.0), w = 0.8 * mBack, h = 1.0 * mBack;
  rect(c, x - w / 2 - 3, y - 3, w + 6, h + 6, L.trim); rect(c, x - w / 2, y, w, h, R.sky);
  if (R.night) { c.fillStyle = '#f3ecc8'; c.beginPath(); c.arc(x + w * 0.22, y + h * 0.28, w * 0.1, 0, 7); c.fill(); }
  rect(c, x - 1.5, y, 3, h, L.trim); rect(c, x - w / 2, y + h / 2 - 1.5, w, 3, L.trim);
  if (curtains) for (const s of [-1, 1]) { c.fillStyle = curtains; c.beginPath(); const ex = x + s * (w / 2 + 6); c.moveTo(ex, y - 6); c.quadraticCurveTo(x + s * w * 0.25, y + h * 0.5, ex - s * 2, y + h + 8); c.lineTo(ex + s * 6, y + h + 8); c.lineTo(ex + s * 6, y - 6); c.fill(); }
}
// A box standing on the floor at (u, d): w wide, h high, with a shallow top (all in metres).
function floorBox(R, u, d, w, h, col, top) {
  const { c } = R, [x, y] = R.P(u, d), m = R.M(d), dw = w * m, dh = h * m, dt = 0.35 * m * 0.45;
  rect(c, x - dw / 2, y - dh, dw, dh, col);
  poly(c, [[x - dw / 2, y - dh], [x + dw / 2, y - dh], [x + dw / 2 - dt * 0.4, y - dh - dt], [x - dw / 2 + dt * 0.4, y - dh - dt]], top || shade(col, 1.15));
  return [x, y - dh - dt * 0.5, m];
}
function person(R, u, d, v, pose = 'stand') {
  const { c } = R, [x, y] = R.P(u, d), m = R.M(d), s = m / 38;
  c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(x, y, 0.3 * m, 0.08 * m, 0, 0, 7); c.fill();
  const body = pose === 'sit' ? 0.75 : 1.0, top = y - (pose === 'sit' ? 0.95 : 1.4) * m;
  c.fillStyle = v.col || '#7a8ad0'; c.beginPath(); c.roundRect(x - 0.2 * m, top, 0.4 * m, body * 0.55 * m * 1.6, 0.12 * m); c.fill();
  c.fillStyle = v.skin || '#c08a5d'; c.beginPath(); c.arc(x, top - 0.13 * m, 0.13 * m, 0, 7); c.fill();
  c.fillStyle = v.hair || '#3d2b20'; c.beginPath(); c.ellipse(x, top - 0.22 * m, 0.14 * m, 0.065 * m, 0, 0, 7); c.fill();
}
function hearth(R, u, fit = true) {
  const { c, T, q, L, mBack } = R, fl = Math.sin(T * 9) * 0.04;
  if (q === 0 && fit) { // a fire pit on the floor
    const [x, y] = R.P(u, 0.35), m = R.M(0.35);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; c.fillStyle = '#8a8478'; c.beginPath(); c.ellipse(x + Math.cos(a) * 0.45 * m, y + Math.sin(a) * 0.15 * m, 0.1 * m, 0.07 * m, 0, 0, 7); c.fill(); }
    flame(c, x, y - 0.05 * m, m * 0.9, fl); R.glows.push([x, y - 0.4 * m, 3 * m]);
    return;
  }
  const [x, y] = R.Wl(u, 0), w = 1.4 * mBack, h = 1.2 * mBack;
  rect(c, x - w / 2, y - h, w, h, q >= 3 ? '#b8b0a2' : '#9a8a74'); rect(c, x - 0.3 * w, y - 0.65 * h, 0.6 * w, 0.65 * h, '#2a2018');
  rect(c, x - w / 2 - 4, y - h - 6, w + 8, 7, L.trim);                                       // mantel
  rect(c, x - 0.22 * w, R.by0, 0.44 * w, y - h - 6 - R.by0, q >= 3 ? '#a9a194' : '#8a7a64');  // chimney breast
  flame(c, x, y - 2, mBack * 0.8, fl); R.glows.push([x, y - 0.4 * mBack, 2.6 * mBack]);
  R.mantel = [x, y - h - 6];
}
function flame(c, x, y, m, fl) {
  c.fillStyle = '#f2a33a'; c.beginPath(); c.moveTo(x - 0.25 * m, y); c.quadraticCurveTo(x - 0.15 * m, y - 0.4 * m + fl * m, x, y - 0.6 * m + fl * m); c.quadraticCurveTo(x + 0.15 * m, y - 0.4 * m - fl * m, x + 0.25 * m, y); c.fill();
  c.fillStyle = '#ffd873'; c.beginPath(); c.moveTo(x - 0.12 * m, y); c.quadraticCurveTo(x, y - 0.3 * m, x + 0.12 * m, y); c.fill();
}
function shelf(R, u, h, w) { const { c, L, mBack } = R, [x, y] = R.Wl(u, h); rect(c, x - w * mBack / 2, y, w * mBack, 4, L.trim); return [x, y, mBack]; }

// ---------------------------------------------------------------- homes
function home(R) {
  const { c, g, b, W, H, q, L, mBack } = R, lvl = b.lvl || 0, t = TIERS[b.k] ? TIERS[b.k][lvl] : { goods: [] }, goods = t.goods || [];
  const has = r => g.res[r] >= 1, uses = r => goods.includes(r), decor = b.decor || [];
  const nWin = 1 + Math.floor(q / 2), curtains = uses('cloth') && has('cloth') ? '#c9553d' : null;
  hearth(R, 0.14);
  for (let i = 0; i < nWin; i++) windowAt(R, 0.42 + i * (0.5 / Math.max(1, nWin)), curtains);
  if (q >= 2) { const [x, y] = R.Wl(0.34, 1.55); rect(c, x - 0.35 * mBack, y - 0.45 * mBack, 0.7 * mBack, 0.45 * mBack, L.trim); rect(c, x - 0.3 * mBack, y - 0.4 * mBack, 0.6 * mBack, 0.35 * mBack, '#7fae5a'); c.fillStyle = '#f2c94c'; c.beginPath(); c.arc(x + 0.12 * mBack, y - 0.28 * mBack, 0.06 * mBack, 0, 7); c.fill(); }
  { const [x, y, m] = shelf(R, 0.9, 1.3, 0.7); if (uses('pottery') && has('pottery')) for (let i = 0; i < 3; i++) emoji(c, '🏺', x - 0.22 * m + i * 0.22 * m, y - 0.13 * m, 0.24 * m); if (uses('jewelry') && has('jewelry')) emoji(c, '💍', x, y - 0.5 * m, 0.2 * m); }
  if (q >= 4) { const [x] = R.Wl(0.5, 0), m = R.M(0.3); c.strokeStyle = '#8a7040'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H * 0.12); c.stroke(); rect(c, x - 0.4 * m, H * 0.12, 0.8 * m, 4, '#b8963a'); for (const dx of [-0.32, 0, 0.32]) { c.fillStyle = '#ffe2a0'; c.beginPath(); c.arc(x + dx * m, H * 0.12 - 3, 3, 0, 7); c.fill(); R.glows.push([x + dx * m, H * 0.12, 0.8 * m]); } }
  // floor: rug, then everything from the back to the front
  if (q >= 2) { const [x, y] = R.P(0.47, 0.45), m = R.M(0.45); c.fillStyle = q >= 4 ? '#8a3a3a' : '#b5823a'; c.beginPath(); c.ellipse(x, y, (q >= 4 ? 1.6 : 1.1) * m, 0.42 * m, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,240,200,.35)'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, (q >= 4 ? 1.4 : 0.95) * m, 0.34 * m, 0, 0, 7); c.stroke(); }
  const items = [];
  // beds against the right wall, 2 m long, one behind another (up to 6 shown)
  const nBeds = beds(b), quilt = curtains ? ['#c9553d', '#4f7fb5', '#d19a3a', '#8a5fb0'] : ['#c9b48e'];
  const sleepers = g.villagers.filter(v => v.inside && v.act && v.act.type === 'sleep' && v.act.bed === b.id);
  const SPOTS = [[0.86, 0.06], [0.62, 0.06], [0.88, 0.42], [0.88, 0.8]], shown = Math.min(SPOTS.length, nBeds);   // the rest are upstairs
  for (let i = 0; i < shown; i++) items.push({ d: SPOTS[i][1], f: () => bed(R, SPOTS[i][0], SPOTS[i][1], quilt[i % quilt.length], sleepers[i]) });
  // Placed pieces (the player's furnishing); a bare room gets its plain table and stool.
  const placed = b.furn || [];
  for (const f of placed) { const s = spotsFor(b).find(x => x.id === f.spot); if (s) items.push({ d: s.d + 0.001, f: () => piece(R, f, s) }); }
  const fine = q >= 2 && (!uses('furniture') || has('furniture'));
  if (!placed.some(f => !PIECES[f.id].treasure)) items.push({ d: 0.5, f: () => {
    const p = g.pantry || {};
    if (fine) { floorBox(R, 0.28, 0.42, 0.45, 0.45, '#7a4a2c'); const [x, y, m] = floorBox(R, 0.4, 0.5, 1.2, 0.75, '#8a5a3a'); floorBox(R, 0.52, 0.58, 0.45, 0.45, '#7a4a2c'); tableTop(R, x, y, m, p, uses, has); }
    else { const [x, y, m] = floorBox(R, 0.4, 0.5, 0.6, 0.45, '#8a6a44'); tableTop(R, x, y, m, p, uses, has); }
  } });
  items.sort((a, z) => a.d - z.d).forEach(i => i.f());
  spotsGlow(R);
  R.notes.push(`${beds(b)} beds` + (beds(b) > 4 ? ' (some upstairs)' : ''));
  R.notes.push(goods.length ? goods.map(r => `${ICON[r]} ${has(r) ? '✓' : '·'}`).join(' ') : 'Plain and snug');
  if (placed.length) R.notes.push(`${placed.length} piece${placed.length === 1 ? '' : 's'} placed`);
  if (sleepers.length) R.notes.push(`${sleepers.length} asleep`);
}
// Glowing spots while choosing where a piece goes; a ring round the selected piece.
function spotsGlow(R) {
  const { c, b, st, T } = R;
  if (!st || (!st.mode && !st.sel)) return;
  const kind = st.mode === 'place' ? PIECES[st.piece].spot : st.sel ? PIECES[(pieceAt(b, st.sel) || {}).id || 'chair'].spot : null;
  for (const s of spotsFor(b)) {
    const [x, y] = R.P(s.u, s.d), m = R.M(s.d), mine = s.id === st.sel, fits = st.mode && s.kind === kind && (!pieceAt(b, s.id) || st.mode === 'move');
    if (!mine && !fits) continue;
    c.strokeStyle = mine ? '#f2c14e' : `rgba(255,236,160,${0.55 + 0.35 * Math.sin(T * 4)})`; c.lineWidth = mine ? 3 : 2.5;
    c.beginPath(); c.ellipse(x, y, 0.5 * m, 0.16 * m, 0, 0, 7); c.stroke();
    if (fits && !mine) { c.fillStyle = 'rgba(255,236,160,.22)'; c.fill(); }
  }
}
// One placed piece, drawn to scale at its spot (mirrored when turned).
function piece(R, f, s) {
  const { c, T } = R, p = PIECES[f.id], [x0] = R.P(s.u, s.d);
  c.save(); if (f.flip) { c.translate(x0 * 2, 0); c.scale(-1, 1); }
  const [x, y] = R.P(s.u, s.d), m = R.M(s.d);
  switch (f.id) {
    case 'chair': { floorBox(R, s.u, s.d, 0.45, 0.45, p.col); rect(c, x + 0.15 * m, y - 1.0 * m, 0.07 * m, 0.6 * m, shade(p.col, 0.85)); rect(c, x - 0.22 * m, y - 1.0 * m, 0.44 * m, 0.08 * m, shade(p.col, 0.85)); break; }
    case 'stool': floorBox(R, s.u, s.d, 0.4, 0.45, p.col); break;
    case 'table': { const [tx, ty, tm] = floorBox(R, s.u, s.d, 1.1, 0.75, p.col); emoji(c, '🕯️', tx, ty - 0.12 * tm, 0.2 * tm); break; }
    case 'chest': { floorBox(R, s.u, s.d, 0.9, 0.55, p.col); rect(c, x - 0.45 * m, y - 0.38 * m, 0.9 * m, 0.05 * m, '#c9a14a'); rect(c, x - 0.04 * m, y - 0.36 * m, 0.08 * m, 0.1 * m, '#e2c26a'); break; }
    case 'rug': { c.fillStyle = p.col; c.beginPath(); c.ellipse(x, y, 0.85 * m, 0.24 * m, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,240,200,.45)'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, 0.7 * m, 0.18 * m, 0, 0, 7); c.stroke(); break; }
    case 'plant': { floorBox(R, s.u, s.d, 0.32, 0.3, '#b5653d'); c.fillStyle = p.col; for (const [dx, dy, r] of [[0, -0.55, 0.18], [-0.12, -0.45, 0.13], [0.12, -0.48, 0.14]]) { c.beginPath(); c.arc(x + dx * m, y + dy * m, r * m, 0, 7); c.fill(); } break; }
    case 'bookcase': { const cols = ['#c9553d', '#4f7fb5', '#d19a3a', '#5f9e4a', '#8a5fb0']; floorBox(R, s.u, s.d, 1.0, 1.9, p.col); for (let r2 = 0; r2 < 4; r2++) for (let k = 0; k < 7; k++) rect(c, x - 0.42 * m + k * 0.12 * m, y - (0.4 + r2 * 0.42) * m - 0.3 * m, 0.09 * m, 0.3 * m, cols[(k + r2) % 5]); break; }
    case 'cupboard': { floorBox(R, s.u, s.d, 1.0, 1.6, p.col); rect(c, x - 0.02 * m, y - 0.85 * m, 0.04 * m, 0.8 * m, shade(p.col, 0.7)); for (let k = 0; k < 3; k++) emoji(c, '🏺', x - 0.3 * m + k * 0.3 * m, y - 1.3 * m, 0.22 * m); rect(c, x - 0.48 * m, y - 1.1 * m, 0.96 * m, 0.04 * m, shade(p.col, 0.7)); break; }
    case 'wardrobe': { floorBox(R, s.u, s.d, 1.1, 2.0, p.col); rect(c, x - 0.02 * m, y - 1.9 * m, 0.04 * m, 1.85 * m, shade(p.col, 0.7)); for (const dx of [-0.1, 0.1]) { c.fillStyle = '#e2c26a'; c.beginPath(); c.arc(x + dx * m, y - 1.0 * m, 0.035 * m, 0, 7); c.fill(); } break; }
    case 'lantern': { floorBox(R, s.u, s.d, 0.4, 0.7, '#7a5638'); const ly = y - 0.75 * m; rect(c, x - 0.1 * m, ly - 0.3 * m, 0.2 * m, 0.28 * m, 'rgba(200,230,240,.6)'); for (let k = 0; k < 3; k++) { c.fillStyle = `rgba(240,255,170,${0.5 + 0.5 * Math.abs(Math.sin(T * 2 + k * 2))})`; c.beginPath(); c.arc(x - 0.05 * m + k * 0.05 * m, ly - 0.16 * m - (k % 2) * 0.06 * m, 0.025 * m, 0, 7); c.fill(); } R.glows.push([x, ly - 0.16 * m, 0.9 * m]); break; }
    case 'aquarium': { floorBox(R, s.u, s.d, 0.5, 0.55, '#6a4a2c'); const top = y - 0.55 * m; c.fillStyle = 'rgba(150,200,220,.55)'; c.fillRect(x - 0.24 * m, top - 0.38 * m, 0.48 * m, 0.36 * m); c.fillStyle = '#4f8a44'; for (let k = 0; k < 3; k++) c.fillRect(x - 0.18 * m + k * 0.12 * m, top - 0.2 * m, 0.03 * m, 0.18 * m); c.fillStyle = '#5f9e4a'; c.beginPath(); c.ellipse(x + 0.06 * m, top - 0.08 * m, 0.07 * m, 0.045 * m, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.strokeRect(x - 0.24 * m, top - 0.38 * m, 0.48 * m, 0.36 * m); break; }
    case 'owlcage': { rect(c, x - 0.03 * m, y - 1.1 * m, 0.06 * m, 1.1 * m, '#8a7040'); const cy = y - 1.3 * m; c.strokeStyle = '#8a7040'; c.lineWidth = 1.2; for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(x + k * 0.07 * m, cy - 0.28 * m); c.lineTo(x + k * 0.07 * m, cy + 0.22 * m); c.stroke(); } c.beginPath(); c.ellipse(x, cy - 0.28 * m, 0.22 * m, 0.08 * m, 0, Math.PI, 0); c.stroke(); c.fillStyle = '#8a6a4a'; c.beginPath(); c.ellipse(x, cy, 0.09 * m, 0.13 * m, 0, 0, 7); c.fill(); c.fillStyle = '#f2d36a'; for (const sg of [-1, 1]) { c.beginPath(); c.arc(x + sg * 0.04 * m, cy - 0.05 * m, 0.025 * m, 0, 7); c.fill(); } break; }
  }
  c.restore();
}
function bed(R, u, d, quilt, sleeper) {
  const { c, q, L } = R, [x, y] = R.P(u, d), m = R.M(d), len = 2.0 * m, hgt = (q === 0 ? 0.15 : 0.45) * m;
  if (q > 0) rect(c, x + len / 2 - 0.06 * m, y - 0.9 * m, 0.08 * m, 0.9 * m, L.trim);           // headboard
  c.fillStyle = q === 0 ? '#c9b48e' : quilt; c.beginPath(); c.roundRect(x - len / 2, y - hgt, len, hgt, 0.08 * m); c.fill();
  c.fillStyle = '#f3ecdc'; c.beginPath(); c.roundRect(x + len / 2 - 0.5 * m, y - hgt - 0.1 * m, 0.4 * m, 0.16 * m, 0.06 * m); c.fill();
  if (sleeper) { c.fillStyle = sleeper.skin || '#c08a5d'; c.beginPath(); c.arc(x + len / 2 - 0.3 * m, y - hgt - 0.08 * m, 0.12 * m, 0, 7); c.fill(); c.fillStyle = sleeper.hair || '#3d2b20'; c.beginPath(); c.arc(x + len / 2 - 0.22 * m, y - hgt - 0.12 * m, 0.1 * m, 0, 7); c.fill(); c.fillStyle = shade(quilt, 0.9); c.beginPath(); c.roundRect(x - len / 2 + 0.1 * m, y - hgt - 0.12 * m, len - 0.65 * m, 0.16 * m, 0.08 * m); c.fill(); }
}
function tableTop(R, x, y, m, p, uses, has) {
  const { c } = R;
  if ((p.bread || 0) >= 1) emoji(c, '🍞', x - 0.3 * m, y - 0.1 * m, 0.28 * m);
  if (uses('beer') && has('beer')) emoji(c, '🍺', x + 0.05 * m, y - 0.12 * m, 0.24 * m);
  if ((p.vegetables || 0) >= 1) emoji(c, '🥕', x + 0.32 * m, y - 0.08 * m, 0.2 * m);
}

// ---------------------------------------------------------------- other rooms
function storage(R) {
  const { c, g, b, mBack } = R, held = RES.filter(r => storeOf(g, b, r) > 0);
  const cols = Math.min(5, Math.max(3, Math.ceil(held.length / 2))), rows = Math.ceil(held.length / cols);
  held.forEach((r, i) => {
    const u = (i % cols + 0.5) / cols, h = 0.35 + Math.floor(i / cols) * (2.1 / Math.max(1, rows)), fill = Math.min(1, g.res[r] / Math.max(1, cap(g, r)));
    const [x, y, m] = shelf(R, u, h, 0.95 * 6.6 / cols);
    const n = Math.round(fill * 4); for (let k = 0; k < n; k++) emoji(c, ICON[r], x - 0.33 * m + (k % 4) * 0.22 * m, y - 0.14 * m, 0.24 * m);
  });
  for (let i = 0; i < 6; i++) { const u = 0.1 + i * 0.16, d = 0.25 + (i % 2) * 0.35; i % 2 ? floorBox(R, u, d, 0.5, 0.5, '#9a6a3e') : sack(R, u, d); }
  R.notes.push(held.slice(0, 6).map(r => `${ICON[r]} ${Math.floor(g.res[r])}/${Math.floor(cap(g, r))}`).join('  '));
}
function sack(R, u, d) { const { c } = R, [x, y] = R.P(u, d), m = R.M(d); c.fillStyle = '#c9b48e'; c.beginPath(); c.ellipse(x, y - 0.28 * m, 0.26 * m, 0.3 * m, 0, 0, 7); c.fill(); c.fillStyle = '#a8946e'; c.fillRect(x - 0.06 * m, y - 0.62 * m, 0.12 * m, 0.08 * m); }

const TOOL = { potter: '⚱️', carpenter: '🪚', weaver: '🧶', artist: '🎨', jeweler: '💎', miller: '⚙️', baker: '🥖', brewer: '🛢️', 'hen keeper': '🥚', cheesemaker: '🧀', chandler: '🕯️' };
function workshop(R) {
  const { c, g, b } = R, cr = BUILD[b.k].craft;
  windowAt(R, 0.5, null);
  if (cr.role === 'baker') hearth(R, 0.82, false);
  const ins = Object.keys(cr.in), out = Object.keys(cr.out)[0], oi = out === 'culture' ? '🖼️' : out === 'food' ? '🍞' : ICON[out];
  { const [x, y, m] = shelf(R, 0.18, 1.2, 0.9); ins.forEach((r, i) => { const n = Math.min(4, Math.ceil((g.res[r] || 0) / 5)); for (let k = 0; k < n; k++) emoji(c, ICON[r], x - 0.3 * m + k * 0.2 * m, y - 0.14 * m - i * 0.32 * m, 0.24 * m); }); }
  if (cr.role !== 'baker') { const [x, y, m] = shelf(R, 0.82, 1.2, 0.9); const n = out === 'culture' ? 3 : Math.min(4, Math.ceil((g.res[out] || 0) / 5)); for (let k = 0; k < n; k++) emoji(c, oi, x - 0.3 * m + k * 0.2 * m, y - 0.14 * m, 0.24 * m); }
  const worker = g.villagers.find(v => v.job === b.id), busy = worker && worker.act && worker.act.type === 'craft' && worker.act.b === b.id && worker.act.phase === 'work';
  if (busy) person(R, 0.5, 0.35, worker);
  const [x, y, m] = floorBox(R, 0.5, 0.55, 1.6, 0.85, '#8a5a3a');
  emoji(c, TOOL[cr.role] || '🔨', x, y - 0.2 * m, 0.38 * m);
  R.notes.push(worker ? `${worker.name}, the ${cr.role}` + (busy ? ', at work' : '') : 'Waiting for a specialist');
  R.notes.push(`${ins.map(r => cr.in[r] + ICON[r]).join(' ') || '·'} → ${cr.out[out]}${oi}`);
}
function tavern(R) {
  const { c, g, b } = R;
  hearth(R, 0.85, false); windowAt(R, 0.55, null);
  { const [x, y, m] = shelf(R, 0.22, 1.3, 1.3); const kegs = Math.min(4, Math.ceil(g.res.beer / 10)); for (let i = 0; i < kegs; i++) { c.fillStyle = '#9a6a3e'; c.beginPath(); c.ellipse(x - 0.45 * m + i * 0.3 * m, y - 0.18 * m, 0.13 * m, 0.17 * m, 0, 0, 7); c.fill(); } }
  floorBox(R, 0.22, 0.25, 2.0, 1.05, '#7a4a2c', '#9a6a3e');                          // the bar
  const here = g.villagers.filter(v => v.act && v.act.type === 'sit' && v.act.tavern === b.id && v.act.phase === 'wait').slice(0, 6);
  for (const [i, [u, d]] of [[0.55, 0.45], [0.78, 0.68]].entries()) {
    here.filter((_, k) => k % 2 === i).forEach((v, k) => person(R, u - 0.12 + k * 0.12, d - 0.05, v, 'sit'));
    const [x, y, m] = floorBox(R, u, d, 0.8, 0.75, '#8a5a3a'); if (g.res.beer >= 1) emoji(c, '🍺', x, y - 0.12 * m, 0.24 * m);
  }
  R.notes.push(g.res.beer >= 1 ? `🍺 ${Math.floor(g.res.beer)} in the cellar` : 'The cellar is dry'); R.notes.push(`${here.length} here now`);
}
function school(R) {
  const { c, g, b, mBack } = R;
  windowAt(R, 0.85, null);
  { const [x, y] = R.Wl(0.42, 1.0); rect(c, x - 1.0 * mBack, y - 0.9 * mBack, 2.0 * mBack, 0.9 * mBack, '#2f4a3a'); c.fillStyle = '#f3ecdc'; c.font = `${0.22 * mBack}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('A B C  1 2 3', x, y - 0.45 * mBack); }
  const pupils = g.villagers.filter(v => v.act && v.act.type === 'sit' && v.act.tavern === b.id && v.act.phase === 'wait');
  [[0.3, 0.4], [0.62, 0.4], [0.3, 0.72], [0.62, 0.72]].forEach(([u, d], i) => { if (pupils[i]) person(R, u, d - 0.08, pupils[i], 'sit'); floorBox(R, u, d, 0.9, 0.7, '#8a5a3a'); });
  R.notes.push(pupils.length ? `${pupils.length} at lessons` : 'Quiet for now'); R.notes.push(`🎭 culture ${Math.floor(g.culture || 0)}`);
}
function theater(R) {
  const { c, g, b, T, bx0, bx1, by0, by1 } = R;
  rect(c, bx0, by0, bx1 - bx0, by1 - by0, '#4a2a2a');
  c.fillStyle = '#b03a3a'; for (const s of [0, 1]) { const x = s ? bx1 : bx0, mid = (bx0 + bx1) / 2 + (s ? 40 : -40); c.beginPath(); c.moveTo(x, by0); c.quadraticCurveTo(mid, (by0 + by1) / 2, x, by1); c.lineTo(x + (s ? -12 : 12), by1); c.lineTo(x + (s ? -12 : 12), by0); c.fill(); }
  { const a = R.P(0, 0), e = R.P(1, 0.18); poly(c, [a, [R.P(1, 0)[0], a[1]], [e[0], e[1] - 0.5 * R.M(0.18)], [R.P(0, 0.18)[0], e[1] - 0.5 * R.M(0.18)]], '#9a6a3e'); }
  const crowd = g.villagers.filter(v => v.act && v.act.type === 'sit' && v.act.tavern === b.id && v.act.phase === 'wait');
  if (crowd.length) emoji(c, '🎻', (bx0 + bx1) / 2, by1 - 0.9 * R.mBack + Math.sin(T * 3) * 3, 0.5 * R.mBack);
  for (const [r, d] of [[0, 0.5], [1, 0.8]].entries()) { crowd.slice(r * 4, r * 4 + 4).forEach((v, i) => person(R, 0.25 + i * 0.17, d[1] - 0.04, v, 'sit')); floorBox(R, 0.5, d[1], 4.2, 0.45, '#8a5a3a'); }
  R.notes.push(crowd.length ? `${crowd.length} watching a play` : 'The stage is quiet');
}
function shop(R) {
  const { c, g, b } = R, goods = ['pottery', 'furniture', 'cloth', 'jewelry', 'beer'].filter(r => g.res[r] >= 1);
  for (const h of [0.9, 1.6]) { const [x, y, m] = shelf(R, 0.5, h, 4.0); goods.forEach((r, i) => { for (let k = 0; k < 2; k++) emoji(c, ICON[r], x - 1.6 * m + i * (3.2 / Math.max(1, goods.length)) * m + k * 0.22 * m, y - 0.14 * m, 0.24 * m); }); }
  const [x, y, m] = floorBox(R, 0.5, 0.42, 3.2, 0.95, '#8a5a3a', '#9a6a3e');
  goods.slice(0, 3).forEach((r, i) => emoji(c, ICON[r], x - 0.8 * m + i * 0.8 * m, y - 0.16 * m, 0.3 * m));
  if (b.k === 'market') R.notes.push(g.merchant.visit ? 'The merchant is in town' : 'Waiting for the merchant');
  else if (b.earned) R.notes.push(`Sold today for ${b.earned}${ICON.gold}`);
  R.notes.push(goods.length ? goods.map(r => `${ICON[r]} ${Math.floor(g.res[r])}`).join('  ') : 'Shelves waiting for goods');
}
function hall(R) {
  const { c, g, b, mBack, L } = R;
  hearth(R, 0.82, false);
  for (let i = 0; i < 3; i++) { const [x, y] = R.Wl(0.16 + i * 0.16, 2.4); rect(c, x - 0.22 * mBack, y, 0.44 * mBack, 0.9 * mBack, ['#c9553d', '#4f7fb5', '#d19a3a'][i]); poly(c, [[x - 0.22 * mBack, y + 0.9 * mBack], [x, y + 0.7 * mBack], [x + 0.22 * mBack, y + 0.9 * mBack]], L.wall); }
  const [x, y, m] = floorBox(R, 0.45, 0.55, 2.6, 0.78, '#8a5a3a');
  emoji(c, '🗺️', x, y - 0.12 * m, 0.4 * m);
  R.notes.push(`${g.villagers.length} villagers`); R.notes.push(`🎭 culture ${Math.floor(g.culture || 0)}`);
  const held = RES.filter(r => storeOf(g, b, r) > 0).slice(0, 5); if (held.length) R.notes.push('Holds ' + held.map(r => ICON[r]).join(' '));
}

function church(R) {
  const { c, g, b, mBack } = R;
  for (const u of [0.25, 0.75]) { const [x, y] = R.Wl(u, 2.2), w = 0.6 * mBack, h = 1.3 * mBack; c.fillStyle = R.night ? '#3a3a6a' : '#a8c4e0'; c.beginPath(); c.moveTo(x - w / 2, y + h); c.lineTo(x - w / 2, y + 0.3 * h); c.quadraticCurveTo(x, y - 0.2 * h, x + w / 2, y + 0.3 * h); c.lineTo(x + w / 2, y + h); c.fill(); for (const [k, col] of [[0, '#c9553d'], [1, '#f2c94c'], [2, '#4f7fb5']]) { c.fillStyle = col; c.globalAlpha = 0.35; c.fillRect(x - w / 2 + k * w / 3, y + 0.4 * h, w / 3, 0.6 * h); c.globalAlpha = 1; } }
  { const [x, y] = R.Wl(0.5, 0); rect(c, x - 0.6 * mBack, y - 0.9 * mBack, 1.2 * mBack, 0.9 * mBack, '#efe6d4'); rect(c, x - 0.04 * mBack, y - 1.9 * mBack, 0.08 * mBack, 0.8 * mBack, '#d9a441'); rect(c, x - 0.25 * mBack, y - 1.7 * mBack, 0.5 * mBack, 0.07 * mBack, '#d9a441'); for (const dx of [-0.45, 0.45]) { rect(c, x + dx * mBack - 0.03 * mBack, y - 1.15 * mBack, 0.06 * mBack, 0.25 * mBack, '#f3ecdc'); R.glows.push([x + dx * mBack, y - 1.2 * mBack, 0.6 * mBack]); } }
  const here = g.villagers.filter(v => v.act && v.act.type === 'sit' && v.act.tavern === b.id && v.act.phase === 'wait');
  [0.4, 0.62, 0.84].forEach((d, r) => { for (const u of [0.28, 0.72]) { here.slice(r * 4 + (u > 0.5 ? 2 : 0), r * 4 + (u > 0.5 ? 4 : 2)).forEach((v, i) => person(R, u - 0.06 + i * 0.12, d - 0.04, v, 'sit')); floorBox(R, u, d, 1.6, 0.5, '#8a5a3a'); } });
  R.notes.push(here.length ? `${here.length} here` : 'Quiet and peaceful'); R.notes.push(g.dawns % 7 === 0 ? 'Service this morning' : `Next service in ${7 - (g.dawns % 7)} days`);
}
function library(R) {
  const { c, g, b, mBack } = R, cols = ['#c9553d', '#4f7fb5', '#d19a3a', '#5f9e4a', '#8a5fb0', '#7a4a2c'];
  for (const u of [0.18, 0.5, 0.82]) for (const h of [0.4, 0.9, 1.4, 1.9]) { const [x, y] = shelf(R, u, h, 1.6); for (let k = 0; k < 12; k++) rect(c, x - 0.75 * mBack + k * 0.125 * mBack, y - 0.38 * mBack + (k % 3) * 0.02 * mBack, 0.1 * mBack, 0.38 * mBack - (k % 3) * 0.02 * mBack, cols[(k + h * 10) % 6]); }
  const readers = g.villagers.filter(v => v.act && v.act.type === 'sit' && v.act.tavern === b.id && v.act.phase === 'wait');
  [[0.35, 0.6], [0.65, 0.6]].forEach(([u, d], i) => { if (readers[i]) person(R, u, d - 0.06, readers[i], 'sit'); const [x, y, m] = floorBox(R, u, d, 1.0, 0.75, '#8a5a3a'); emoji(c, '📖', x, y - 0.1 * m, 0.25 * m); });
  R.notes.push(readers.length ? `${readers.length} reading` : 'Hushed and waiting for readers'); R.notes.push(`🎭 culture ${Math.floor(g.culture || 0)}`);
}
