// Buildings: one drawing function per kind (DB), their heights (for bubbles and labels), farm pens and animals,
// the campfire, and construction progress bars.
import { TW, TH, BUILD, ICON, PANTRY_ICON } from '../../core/config.js';

import { hour } from '../../core/state.js';
import { hash } from '../../core/rng.js';
import { iso } from './kit.js';
import { drawPath } from './paths.js';
import { drawFlag } from '../flag.js';
import { ripe } from '../../core/handson.js';
import { chain, SEASON_NAMES } from './sprites.js';
const AW = [['#e8d2a6', '#d4b887'], ['#ece0c4', '#d8c6a0'], ['#efe6d6', '#d9ccb6'], ['#f3ecdf', '#ddd2bf']];
const RA = [['#c9684a', '#a9503a'], ['#b9583f', '#98432f'], ['#4e7ca0', '#3b6283'], ['#7a5aa0', '#5f4584']];
// One look per home level: wall pair, roof pair, wall height, roof height, extras.
export const HOME_LOOK = [
  { wall: ['#b08a5e', '#9a7650'], roof: ['#c9a25a', '#b08a46'], h: 12, rf: 18, door: '#6a4a2c', glass: '#5a4a3a', rows: 0, chimneys: 0 },
  { wall: ['#e8d2a6', '#d4b887'], roof: ['#b8874a', '#9c703a'], h: 18, rf: 24, door: '#7a5638', glass: '#6f8fa8', rows: 0, chimneys: 1, chim: ['#9a7a66', '#85654f', '#b08c78'] },
  { wall: ['#f3e3c3', '#dcc8a0'], roof: ['#c9684a', '#a9503a'], h: 20, rf: 26, door: '#7a5638', glass: '#8fb3cc', rows: 1, flowers: true, chimneys: 1, chim: ['#9a7a66', '#85654f', '#b08c78'] },
  { wall: ['#f5ede0', '#ddd2bf'], roof: ['#6a4a3a', '#553a2c'], h: 26, rf: 26, door: '#5a3a24', glass: '#8fb3cc', rows: 1, beams: '#6a4a2c', chimneys: 1, chim: ['#9a7a66', '#85654f', '#b08c78'] },
  { wall: ['#f5ede0', '#ddd2bf'], roof: ['#4e7a5a', '#3e6448'], h: 32, rf: 28, door: '#5a3a24', glass: '#8fb3cc', rows: 2, beams: '#6a4a2c', flowers: true, chimneys: 1, chim: ['#9a7a66', '#85654f', '#b08c78'] },
  { wall: ['#c9c2b4', '#b2ab9c'], roof: ['#5f6f7f', '#4c5a68'], h: 28, rf: 26, door: '#5a3a24', glass: '#9fc3dc', rows: 1, stone: true, chimneys: 1, chim: ['#a9a49a', '#8f8a80', '#bdb8ae'] },
  { wall: ['#d5cfc2', '#bdb6a8'], roof: ['#4e6f9a', '#3e5a80'], h: 34, rf: 28, door: '#4a2e1c', glass: '#9fc3dc', rows: 2, stone: true, flowers: true, chimneys: 1, chim: ['#a9a49a', '#8f8a80', '#bdb8ae'] },
  { wall: ['#e6e0d3', '#cfc7b8'], roof: ['#6a4f8a', '#55406f'], h: 40, rf: 30, door: '#4a2e1c', glass: '#b5d3e6', rows: 2, stone: true, flowers: true, chimneys: 2, chim: ['#bdb8ae', '#a39e94', '#cfcac0'] },
  { wall: ['#f1ece1', '#d9d2c4'], roof: ['#7a5aa0', '#5f4584'], h: 44, rf: 32, door: '#4a2e1c', glass: '#cfe3ef', rows: 3, stone: true, flowers: true, trim: '#d9a441', chimneys: 2, chim: ['#cfcac0', '#b5b0a6', '#e0dbd1'] },
];
export function createBuildings(K) {
  const { ctx, dia, poly, upp, mid, lerp, cor, box, walls, door, c0, st } = K;
  const heightOf = (b, age) => ({ tc: 38 + age * 7, house: HOME_LOOK[b.lvl || 0].h + HOME_LOOK[b.lvl || 0].rf - 20, store: 22 + (b.lvl || 0) * 6, lodge: 26 + age * 3, market: 34, monument: 80, arbor: 30, school: 46, studio: 30, theater: 40, quarry: 34, claypit: 20, goldmine: 40, coop: 24, sheepfold: 10, pasture: 10, dairy: 28, apiary: 14, chandler: 28, church: 70, library: 44, playground: 22, jeweler: 32, fireflylamp: 20, grange: 46, granary: 80, lumbermill: 24, farmhouse: 52, mill: 54, bakery: 30, brewery: 30, shop: 26 + (b.lvl || 0) * 6, tavern: 34, well: (b.lvl || 0) >= 2 ? 78 : 16, statue: 34, bench: 6, potter: 22, carpenter: 22, weaver: 24, campfire: 4, watertower: 80, greenhouse: 34, stable: 40, blacksmith: 34, waystation: 40, bathhouse: 40, bandstand: 36, church: 70 + (b.lvl || 0) * 30, greathall: 70, observatory: 80, botanical: 20, orchard_apple: 34, orchard_pear: 36, orchard_cherry: 32, orchard_plum: 32 }[b.k] || 0);
  function drawFire(g) {
    const f = g.w.fire, p = iso(f.x, f.y), h = hour(g), lit = h >= 18.5 || h < 6.5;
    ctx.fillStyle = 'rgba(40,60,40,.22)'; ctx.beginPath(); ctx.ellipse(p[0], p[1] + 2, 14, 6, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; ctx.fillStyle = i % 2 ? '#9a948a' : '#b4aea2'; ctx.beginPath(); ctx.arc(p[0] + Math.cos(a) * 11, p[1] + Math.sin(a) * 5, 3.2, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p[0] - 7, p[1] + 2); ctx.lineTo(p[0] + 7, p[1] - 3); ctx.moveTo(p[0] - 7, p[1] - 3); ctx.lineTo(p[0] + 7, p[1] + 2); ctx.stroke();
    if (lit) { const fl = Math.sin(st.T0 * 13) * 2; ctx.fillStyle = '#f2a33a'; ctx.beginPath(); ctx.moveTo(p[0] - 6, p[1]); ctx.quadraticCurveTo(p[0] - 4, p[1] - 14 + fl, p[0], p[1] - 20 + fl); ctx.quadraticCurveTo(p[0] + 4, p[1] - 14 - fl, p[0] + 6, p[1]); ctx.fill(); ctx.fillStyle = '#ffd873'; ctx.beginPath(); ctx.moveTo(p[0] - 3, p[1]); ctx.quadraticCurveTo(p[0], p[1] - 10, p[0] + 3, p[1]); ctx.fill(); }
  }
  // ---- Festival dressing: confetti, posts with bunting or lanterns along the route, floats.
  function pen(b, grass) {
    const [tp, rt, bt, lf] = cor(b); poly([tp, rt, bt, lf], st.sea === 3 ? '#dcd8cc' : grass);
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2;
    for (const [p, q] of [[tp, rt], [rt, bt], [bt, lf], [lf, tp]]) { for (const hgt of [5, 10]) { ctx.beginPath(); ctx.moveTo(p[0], p[1] - hgt); ctx.lineTo(q[0], q[1] - hgt); ctx.stroke(); } for (let k = 0; k <= 4; k++) { const m = lerp(p, q, k / 4); ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(m[0], m[1] - 12); ctx.stroke(); } }
  }
  // Animals wander slowly about a centre point; each has its own little loop.
  function herd(b, kind, c, rx, ry) {
    const def = BUILD[b.k].animals, n = b.animals ?? def.start;
    const list = [];
    for (let i = 0; i < n; i++) { const t = st.T0 * (kind === 'hen' ? 0.35 : 0.12) + i * 1.9 + b.id; list.push([c[0] + Math.sin(t) * rx * 0.55 + Math.sin(i * 2.3) * rx * 0.35, c[1] + Math.cos(t * 1.3) * ry * 0.5 + Math.cos(i * 1.7) * ry * 0.4, Math.cos(t) > 0 ? 1 : -1, i]); }
    list.sort((p, q) => p[1] - q[1]);
    for (const [x, y, dir, i] of list) animal(kind, x, y, dir, i);
  }
  function animal(kind, x, y, dir, i) {
    ctx.fillStyle = 'rgba(40,60,40,.2)'; ctx.beginPath(); ctx.ellipse(x, y + 1, kind === 'hen' ? 4 : 8, kind === 'hen' ? 1.6 : 3, 0, 0, 7); ctx.fill();
    if (kind === 'hen') { const peck = Math.sin(st.T0 * 5 + i) > 0.6 ? 2 : 0; ctx.fillStyle = i % 3 ? '#f3ecdc' : '#c9894a'; ctx.beginPath(); ctx.ellipse(x, y - 4, 4, 3, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x + 3 * dir, y - 7 + peck, 2.2, 0, 7); ctx.fill(); ctx.fillStyle = '#d9534f'; ctx.fillRect(x + 2.5 * dir - 0.8, y - 10 + peck, 1.6, 1.6); ctx.fillStyle = '#e8a03a'; ctx.fillRect(x + 5 * dir - (dir < 0 ? 1.5 : 0), y - 7 + peck, 1.5, 1); }
    else if (kind === 'sheep') { ctx.fillStyle = '#f6f2ea'; for (const [dx, dy] of [[-3, 0], [2, -1], [0, -3], [-1, 1], [4, 1]]) { ctx.beginPath(); ctx.arc(x + dx, y - 6 + dy, 3.6, 0, 7); ctx.fill(); } ctx.fillStyle = '#3a3030'; ctx.beginPath(); ctx.ellipse(x + 7 * dir, y - 7, 2.4, 2, 0, 0, 7); ctx.fill(); ctx.fillRect(x - 3, y - 3, 1.5, 3); ctx.fillRect(x + 2, y - 3, 1.5, 3); }
    else if (kind === 'cow') { ctx.fillStyle = i % 2 ? '#f3ecdc' : '#a0724a'; ctx.beginPath(); ctx.ellipse(x, y - 7, 8, 4.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = i % 2 ? '#3a3030' : '#f3ecdc'; ctx.beginPath(); ctx.arc(x - 2, y - 8, 2, 0, 7); ctx.fill(); ctx.fillStyle = i % 2 ? '#3a3030' : '#7a5232'; ctx.beginPath(); ctx.ellipse(x + 8 * dir, y - 8, 3, 2.6, 0, 0, 7); ctx.fill(); for (const lx of [-5, -1, 3, 6]) ctx.fillRect(x + lx, y - 3, 1.6, 4); }
  }
  // ---- Seasonal festivals
  const DB = {
    tc(b, age) {
      const h = heightOf(b, age), [tp, rt, bt, lf] = walls(b, h, AW[age]), ap = iso(b.x + 0.5, b.y + 0.5), ax = [ap[0], ap[1] - h - 34];
      poly([upp(lf, h), upp(bt, h), ax], RA[age][0]); poly([upp(bt, h), upp(rt, h), ax], RA[age][1]);
      const dp = iso(b.x + 1.5, b.y + 0.5); poly([[dp[0] - 9, dp[1]], [dp[0] + 9, dp[1] - 5], [dp[0] + 9, dp[1] - 27], [dp[0] - 9, dp[1] - 22]], '#7a5638');
      ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax[0], ax[1]); ctx.lineTo(ax[0], ax[1] - 30); ctx.stroke();
      poly([[ax[0], ax[1] - 30], [ax[0] + 18, ax[1] - 25 + Math.sin(st.T0 * 3) * 3], [ax[0], ax[1] - 19]], '#d9534f');
      if (age > 0) for (let i = 0; i < 3; i++) { const q = (st.T0 * 0.5 + i / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - q)})`; ctx.beginPath(); ctx.arc(ax[0] + 14 + Math.sin(q * 6) * 3, ax[1] + 14 - q * 34, 4 + q * 5, 0, 7); ctx.fill(); }
    },
    // Homes look different at every level (see TIERS.house in config.js).
    house(b) {
      const L = HOME_LOOK[b.lvl || 0], h = L.h, [tp, rt, bt, lf] = walls(b, h, L.wall), c = iso(b.x, b.y), ap = [c[0], c[1] - h - L.rf];
      if (L.beams) { ctx.strokeStyle = L.beams; ctx.lineWidth = 2; for (const t of [0.2, 0.8]) { const p = lerp(lf, bt, t), q = lerp(bt, rt, t); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - h); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] - h); ctx.stroke(); } const m1 = upp(lf, h / 2), m2 = upp(bt, h / 2), m3 = upp(rt, h / 2); ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.lineTo(m3[0], m3[1]); ctx.stroke(); }
      if (L.stone) { ctx.fillStyle = 'rgba(80,70,60,.18)'; for (let i = 0; i < 6; i++) { const p = lerp(lf, bt, (i % 3) / 3 + 0.1); ctx.fillRect(p[0], p[1] - 6 - ((i / 3) | 0) * 10 - (i % 2) * 4, 6, 3); } }
      for (let row = 0; row < L.rows; row++) { const p = lerp(lf, bt, 0.5), y0 = p[1] - 8 - row * 13; poly([[p[0] - 4, y0 + 2], [p[0] + 4, y0 + 6], [p[0] + 4, y0 - 2], [p[0] - 4, y0 - 6]], L.glass); if (L.flowers) { ctx.fillStyle = '#e86a8a'; ctx.fillRect(p[0] - 4, y0 + 2, 8, 2); } }
      door(bt, rt, 5, Math.min(14, h - 4), L.door);
      poly([upp(lf, h), upp(bt, h), ap], L.roof[0]); poly([upp(bt, h), upp(rt, h), ap], L.roof[1]);
      if (L.trim) { ctx.strokeStyle = L.trim; ctx.lineWidth = 2; const a1 = upp(lf, h), a2 = upp(bt, h), a3 = upp(rt, h); ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.lineTo(a3[0], a3[1]); ctx.stroke(); ctx.fillStyle = L.trim; ctx.beginPath(); ctx.arc(ap[0], ap[1] - 2, 2.5, 0, 7); ctx.fill(); }
      for (let i = 0; i < L.chimneys; i++) box([c[0] + 10 - i * 18, c[1] - h - 6 - i * 3], 0.11, 20 + (L.rf - 20) * 0.6, L.chim[0], L.chim[1], L.chim[2]);
    },
    store(b) {
      const lv = b.lvl || 0, h = 22 + lv * 6, wallC = lv >= 2 ? ['#c9c2b4', '#b2ab9c'] : ['#c9a171', '#b58a5c'], [tp, rt, bt, lf] = walls(b, h, wallC), R1 = upp(mid(lf, tp), h + 22), R2 = upp(mid(bt, rt), h + 22);
      if (lv === 1) { ctx.fillStyle = '#a9a49a'; poly([lf, bt, upp(bt, 6), upp(lf, 6)], '#a9a49a'); poly([bt, rt, upp(rt, 6), upp(bt, 6)], '#938e84'); }
      poly([upp(bt, h), upp(rt, h), R2], wallC[1]); poly([upp(lf, h), upp(bt, h), R2, R1], lv >= 2 ? '#5f6f7f' : '#8a5a3a'); door(bt, rt, 11, 20, '#5a3a24');
      box(iso(b.x + 1.62, b.y - 0.15), 0.1, 8, '#c99a5a', '#b3844a', '#dcb070'); if (lv >= 1) box(iso(b.x + 1.62, b.y + 0.2), 0.08, 6, '#9a6a3e', '#85582f', '#b88556');
    },
    lodge(b, age) { const h = heightOf(b, age), [tp, rt, bt, lf] = walls(b, h, ['#cdb48a', '#b99c72']), R1 = upp(mid(tp, rt), h + 24), R2 = upp(mid(lf, bt), h + 24), c = iso(b.x + 0.5, b.y + 0.5); poly([upp(lf, h), upp(bt, h), R2], '#cdb48a'); poly([upp(bt, h), upp(rt, h), R1, R2], '#4a7554'); door(lf, bt, 9, 18, '#5a4028'); box([c[0] - 14, c[1] - h - 10], 0.1, 22, '#8a7360', '#745f4e', '#a08a76'); box([c[0] + 12, c[1] - h - 6], 0.1, 26, '#8a7360', '#745f4e', '#a08a76'); },
    market(b) {
      const lv = b.lvl || 0;
      if (lv === 0) { // Trading post: a log hut with a counter, crates and a pennant
        const h = 18, [tp, rt, bt, lf] = walls(b, h, ['#a07a50', '#8a6640']), R1 = upp(mid(tp, rt), h + 16), R2 = upp(mid(lf, bt), h + 16);
        for (let k = 1; k < 4; k++) { ctx.strokeStyle = 'rgba(70,50,30,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...upp(lf, k * 5)); ctx.lineTo(...upp(bt, k * 5)); ctx.lineTo(...upp(rt, k * 5)); ctx.stroke(); }
        poly([upp(lf, h), upp(bt, h), R2], '#a07a50'); poly([upp(bt, h), upp(rt, h), R1, R2], '#6a5a3a');
        const cn = lerp(bt, rt, 0.5); box([cn[0], cn[1] + 4], 0.2, 8, '#c99a6a', '#b58a5c', '#d9b07a');
        box(iso(b.x + 1.7, b.y + 0.2), 0.14, 9, '#c99a5a', '#b3844a', '#dcb070');
        const fp = upp(tp, h + 10); ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fp[0], fp[1] + 10); ctx.lineTo(fp[0], fp[1] - 16); ctx.stroke(); poly([[fp[0], fp[1] - 16], [fp[0] + 14, fp[1] - 12 + Math.sin(st.T0 * 3) * 1.5], [fp[0], fp[1] - 8]], '#5aa9a0');
        return;
      }
      if (lv >= 2) { // General store: a proper shopfront with a porch and a sign
        const h = 32, [tp, rt, bt, lf] = walls(b, h, ['#e8d3a8', '#cfb88c']), R1 = upp(mid(tp, rt), h + 20), R2 = upp(mid(lf, bt), h + 20);
        poly([upp(lf, h), upp(bt, h), R2], '#e8d3a8'); poly([upp(bt, h), upp(rt, h), R1, R2], '#3f6f8a');
        door(bt, rt, 7, 16, '#5a3a24'); for (const f of [0.25, 0.75]) { const wp = lerp(lf, bt, f); poly([[wp[0] - 8, wp[1] - 6], [wp[0] + 8, wp[1] + 2], [wp[0] + 8, wp[1] - 14], [wp[0] - 8, wp[1] - 22]], st.dark > 0.3 ? '#ffd27a' : '#cfe3ee'); }
        const sg = upp(mid(lf, bt), h + 2); poly([[sg[0] - 18, sg[1] - 4], [sg[0] + 18, sg[1] + 6], [sg[0] + 18, sg[1] - 4], [sg[0] - 18, sg[1] - 14]], '#7a4a2c');
        ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(sg[0], sg[1] - 4, 2.5, 0, 7); ctx.fill();
        box(iso(b.x + 1.75, b.y + 0.3), 0.14, 9, '#c99a5a', '#b3844a', '#dcb070'); box(iso(b.x + 1.75, b.y + 0.75), 0.12, 7, '#9a6a3e', '#85582f', '#b88556');
        return;
      }
      const [tp, rt, bt, lf] = cor(b), h = 34, L = upp(lf, h), B = upp(bt, h), R = upp(rt, h), T = upp(tp, h); poly([tp, rt, bt, lf], '#d8b98a'); box(iso(b.x + 0.1, b.y + 0.9), 0.2, 12, '#c99a5a', '#b3844a', '#e3b660'); box(iso(b.x + 0.9, b.y + 0.1), 0.16, 9, '#9a6a3e', '#85582f', '#b88556'); ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 3; for (const p of [lf, bt, rt]) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - h); ctx.stroke(); } for (let i = 0; i < 6; i++) poly([lerp(L, B, i / 6), lerp(L, B, (i + 1) / 6), lerp(T, R, (i + 1) / 6), lerp(T, R, i / 6)], i % 2 ? '#f3e6c4' : '#c9553d'); },
    monument(b) { const c = iso(b.x + 0.5, b.y + 0.5), t = [c[0], c[1] - 80]; box(c, 0.95, 14, '#cfc7b8', '#b9b0a0', '#ddd6c8'); box([c[0], c[1] - 14], 0.62, 20, '#d8d1c3', '#c2baab', '#e6e0d3'); box([c[0], c[1] - 34], 0.34, 46, '#e6dfd2', '#cfc7b8', '#f1ece1'); poly([[t[0] - 0.34 * TW, t[1]], [t[0], t[1] + 0.34 * TH], [t[0], t[1] - 36]], '#d9a441'); poly([[t[0], t[1] + 0.34 * TH], [t[0] + 0.34 * TW, t[1]], [t[0], t[1] - 36]], '#b8862c'); },
    farm(b) { const c = iso(b.x + 0.5, b.y + 0.5); ctx.fillStyle = '#8a6a3e'; dia(c[0], c[1], TW, TH); ctx.fill(); ctx.strokeStyle = b.food > 0 ? (st.sea === 2 ? '#d9b44a' : st.sea === 3 ? '#a89a80' : '#8fbf55') : '#6a5030'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = iso(b.x - 0.35 + i * 0.5, b.y - 0.35), e = iso(b.x - 0.35 + i * 0.5, b.y + 1.35); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); }
      if (b.food > 0 && st.sea < 3) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const p = iso(b.x - 0.35 + i * 0.5, b.y - 0.2 + j * 0.45); ctx.fillStyle = (i + j) % 3 === 0 ? '#e8873a' : (i + j) % 3 === 1 ? '#5f9e4a' : '#b5d06a'; ctx.beginPath(); ctx.arc(p[0], p[1] - 2, 2.6, 0, 7); ctx.fill(); } },
    pumpkin(b) {   // vines over dark soil; in autumn, orange pumpkins among the leaves (fewer as they are picked)
      const c = iso(b.x + 0.5, b.y + 0.5), sea = st.sea; ctx.fillStyle = '#7a5a36'; dia(c[0], c[1], TW, TH); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.08)'; dia(c[0], c[1], TW - 6, TH - 3); ctx.fill();
      const leaf = sea === 3 ? null : sea === 0 ? '#8fbf55' : sea === 2 ? '#7a9a3e' : '#5f9a44', ripe = sea === 2 && b.food > 0, left = Math.min(1, (b.food || 0) / 140);
      const spots = []; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) spots.push([b.x - 0.35 + i * 0.42 + (hash(i, j + b.x) - 0.5) * 0.12, b.y - 0.35 + j * 0.42 + (hash(j, i + b.y) - 0.5) * 0.12, hash(i * 7 + b.x, j * 3 + b.y)]);
      if (leaf) {
        ctx.strokeStyle = sea === 2 ? '#8a8a3e' : '#4f8a3a'; ctx.lineWidth = 1.2;   // the runners, row to row
        for (let j = 0; j < 5; j++) { ctx.beginPath(); for (let i = 0; i < 5; i++) { const p = iso(spots[i * 5 + j][0], spots[i * 5 + j][1]); i ? ctx.lineTo(p[0], p[1] - 2) : ctx.moveTo(p[0], p[1] - 2); } ctx.stroke(); }
        for (const [x, y, h] of spots) { const p = iso(x, y), r = sea === 0 ? 2.5 : 4.2; ctx.fillStyle = leaf; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(p[0] + (k - 1) * r * 0.8, p[1] - 3 - (k % 2) * 2, r, r * 0.6, 0, 0, 7); ctx.fill(); } }
      } else for (const [x, y] of spots) { const p = iso(x, y); ctx.fillStyle = '#b39a64'; ctx.fillRect(p[0] - 3, p[1] - 1, 6, 1.2); }   // straw over the bare beds
      if (sea === 1 || ripe) for (const [x, y, h] of spots) {
        if (h > (ripe ? left : 0.35)) continue;
        const p = iso(x + 0.1, y + 0.1), r = ripe ? 3.6 + h * 2.6 : 2.2;
        ctx.fillStyle = ripe ? (h > 0.5 ? '#e0832a' : '#ec9a3a') : '#9ab84a'; ctx.beginPath(); ctx.ellipse(p[0], p[1] - r * 0.5, r * 1.15, r * 0.8, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(120,60,20,.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(p[0], p[1] - r * 0.5, r * 0.45, r * 0.8, 0, 0, 7); ctx.stroke();
        ctx.fillStyle = '#5a7a2a'; ctx.fillRect(p[0] - 0.6, p[1] - r * 1.35, 1.4, 2.2);
      }
    },
    wheatfield(b) {
      const c = iso(b.x + 0.5, b.y + 0.5); ctx.fillStyle = '#9a7a46'; dia(c[0], c[1], TW, TH); ctx.fill();
      const ripe = b.food > 0 && st.sea < 3, col = st.sea === 0 ? '#9cc25a' : '#e3c35a', head = st.sea === 0 ? '#b8d070' : '#f2d77a';
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const p = iso(b.x - 0.4 + i * 0.36, b.y - 0.4 + j * 0.36), sw = Math.sin(st.T0 * 1.5 + i * 0.7 + j) * 1.2;
        ctx.strokeStyle = ripe ? col : '#a08a60'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + sw, p[1] - (ripe ? 10 : 3)); ctx.stroke();
        if (ripe) { ctx.fillStyle = head; ctx.beginPath(); ctx.ellipse(p[0] + sw, p[1] - 11, 1.6, 3, 0, 0, 7); ctx.fill(); } }
    },
    grange(b) {
      const lv = b.lvl || 0, h = 24, [tp, rt, bt, lf] = walls(b, h, ['#b5523e', '#9a4232']), R1 = upp(mid(tp, rt), h + 26), R2 = upp(mid(lf, bt), h + 26);
      poly([upp(lf, h), upp(bt, h), R2], '#b5523e'); poly([upp(bt, h), upp(rt, h), R1, R2], '#6a4a3a');
      const d = mid(bt, rt); poly([[d[0] - 10, d[1] - 5], [d[0] + 10, d[1] + 5], [d[0] + 10, d[1] - 17], [d[0] - 10, d[1] - 27]], '#f3e6c4'); poly([[d[0] - 8, d[1] - 5], [d[0] + 8, d[1] + 3], [d[0] + 8, d[1] - 15], [d[0] - 8, d[1] - 23]], '#7a4a2c');
      ctx.strokeStyle = '#f3e6c4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(d[0] - 8, d[1] - 23); ctx.lineTo(d[0] + 8, d[1] + 3); ctx.moveTo(d[0] - 8, d[1] - 5); ctx.lineTo(d[0] + 8, d[1] - 15); ctx.stroke();
      if (lv >= 1) { const s = iso(b.x - 0.6, b.y + 1.2); box(s, 0.2, 40 + lv * 6, '#c9c2b4', '#b2ab9c', '#8a5a3a'); poly([[s[0] - 0.2 * TW, s[1] - 40 - lv * 6], [s[0], s[1] - 52 - lv * 6], [s[0] + 0.2 * TW, s[1] - 40 - lv * 6]], '#8a5a3a'); }
      for (const [dx, dy] of [[-30, 8], [-22, 12]]) { ctx.fillStyle = '#e3c35a'; ctx.beginPath(); ctx.ellipse(c0(b)[0] + dx, c0(b)[1] + dy, 6, 4, 0, 0, 7); ctx.fill(); }
    },
    // One great round silo with a conical roof and a little door.
    granary(b) {
      const c = iso(b.x + 0.5, b.y + 0.5), r = 0.62 * TW, ry = r * 0.5, h = 46;
      ctx.fillStyle = '#a9a49a'; ctx.beginPath(); ctx.ellipse(c[0], c[1] + 2, r + 4, ry + 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e3d3b0'; ctx.beginPath(); ctx.moveTo(c[0] - r, c[1]); ctx.lineTo(c[0] - r, c[1] - h); ctx.ellipse(c[0], c[1] - h, r, ry, 0, Math.PI, 0, true); ctx.lineTo(c[0] + r, c[1]); ctx.ellipse(c[0], c[1], r, ry, 0, 0, Math.PI); ctx.fill();
      const gr = ctx.createLinearGradient(c[0] - r, 0, c[0] + r, 0); gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.22)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(c[0] - r, c[1]); ctx.lineTo(c[0] - r, c[1] - h); ctx.ellipse(c[0], c[1] - h, r, ry, 0, Math.PI, 0, true); ctx.lineTo(c[0] + r, c[1]); ctx.ellipse(c[0], c[1], r, ry, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(120,100,70,.35)'; ctx.lineWidth = 1.5; for (const hh of [12, 24, 36]) { ctx.beginPath(); ctx.ellipse(c[0], c[1] - hh, r, ry, 0, 0, Math.PI); ctx.stroke(); }
      poly([[c[0] - r - 4, c[1] - h], [c[0], c[1] - h - 34], [c[0] + r + 4, c[1] - h]], '#8a5a3a');
      ctx.fillStyle = '#7a4a2c'; ctx.beginPath(); ctx.ellipse(c[0], c[1] - h, r + 4, ry + 2, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#5a3a24'; ctx.fillRect(c[0] - 6, c[1] + ry - 18, 12, 16); ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(c[0], c[1] - h - 30, 2.5, 0, 7); ctx.fill();
    },
    lumbermill(b) {
      const [tp, rt, bt, lf] = cor(b), c = iso(b.x + 0.5, b.y + 0.5), h = 22;
      poly([tp, rt, bt, lf], '#b89a6c');
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 3; for (const p of [lf, bt, rt, tp]) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - h); ctx.stroke(); }
      poly([upp(lf, h), upp(bt, h), upp(rt, h), upp(tp, h)], 'rgba(122,74,44,.85)');
      for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) { const x = c[0] - 22 + k * 11 + row * 5.5, y = c[1] + 4 - row * 8; ctx.fillStyle = '#9a6a3e'; ctx.fillRect(x - 5, y - 6, 10, 6); ctx.fillStyle = '#d9b07a'; ctx.beginPath(); ctx.ellipse(x + 5, y - 3, 2.5, 3, 0, 0, 7); ctx.fill(); }
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#c99a5a' : '#b3844a'; ctx.fillRect(c[0] + 6, c[1] - 6 - k * 4, 26, 3.5); }
      ctx.fillStyle = '#8a8478'; ctx.beginPath(); ctx.arc(c[0] + 34, c[1] - 14, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#5a5a62'; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28 + st.T0; ctx.fillRect(c[0] + 34 + Math.cos(a) * 6 - 1, c[1] - 14 + Math.sin(a) * 6 - 1, 2, 2); }
    },
    farmhouse(b, age) {
      const lv = b.lvl || 0, h = 24 + lv * 4, [tp, rt, bt, lf] = walls(b, h, lv >= 2 ? ['#e8dcc4', '#d4c4a6'] : ['#efe2c6', '#dccaa6']), R1 = upp(mid(tp, rt), h + 24), R2 = upp(mid(lf, bt), h + 24);
      poly([upp(lf, h), upp(bt, h), R2], lv >= 2 ? '#e8dcc4' : '#efe2c6'); poly([upp(bt, h), upp(rt, h), R1, R2], '#a8584a');
      door(bt, rt, 7, 16, '#6a4a2c'); const lit = st.dark > 0.3 ? '#ffd27a' : '#bcd6e6';
      for (const f of [0.3, 0.7]) poly((() => { const w = lerp(lf, bt, f); return [[w[0] - 5, w[1] - 7], [w[0] + 5, w[1] - 2], [w[0] + 5, w[1] - 13], [w[0] - 5, w[1] - 18]]; })(), lit);
      const ch = upp(lerp(R2, R1, 0.25), -6); box([ch[0], ch[1] + 4], 0.06, 14, '#a9a49a', '#938e84', '#b8b3a8');
      const pc = lerp(lf, bt, 0.5); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(pc[0] - 30 + k * 7, pc[1] + 10 + k * 3.5); ctx.lineTo(pc[0] - 30 + k * 7, pc[1] + 3 + k * 3.5); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(pc[0] - 30, pc[1] + 5); ctx.lineTo(pc[0] - 2, pc[1] + 19); ctx.stroke();
      for (const [dx, dy] of [[-40, 6]]) { ctx.fillStyle = '#e3c35a'; ctx.beginPath(); ctx.ellipse(pc[0] + dx, pc[1] + dy, 7, 5, 0, 0, 7); ctx.fill(); }
    },
    mill(b) {
      const c = iso(b.x, b.y); box(c, 0.32, 34, '#efe2c6', '#d9c8a6', '#c9b48e'); poly([[c[0] - 0.32 * TW, c[1] - 34], [c[0], c[1] - 50], [c[0] + 0.32 * TW, c[1] - 34]], '#8a5a3a');
      const hub = [c[0] + 4, c[1] - 36], a0 = st.T0 * 0.8; ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2, e = [hub[0] + Math.cos(a) * 24, hub[1] + Math.sin(a) * 24]; ctx.beginPath(); ctx.moveTo(hub[0], hub[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); const m = [hub[0] + Math.cos(a) * 14, hub[1] + Math.sin(a) * 14], n = [-Math.sin(a) * 5, Math.cos(a) * 5]; poly([[hub[0] + Math.cos(a) * 6, hub[1] + Math.sin(a) * 6], [e[0], e[1]], [e[0] + n[0], e[1] + n[1]], [hub[0] + Math.cos(a) * 6 + n[0], hub[1] + Math.sin(a) * 6 + n[1]]], '#f3e6c4'); }
      ctx.fillStyle = '#6a4a2c'; ctx.beginPath(); ctx.arc(hub[0], hub[1], 2.5, 0, 7); ctx.fill();
    },
    bakery(b) {
      const h = 18, [tp, rt, bt, lf] = walls(b, h, ['#f0d9b5', '#d9bf98']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 14];
      poly([upp(lf, h), upp(bt, h), ap], '#c96a4a'); poly([upp(bt, h), upp(rt, h), ap], '#a85a3e'); door(bt, rt, 5, 12, '#6a4a2c');
      box([c[0] + 9, c[1] - h - 4], 0.06, 14, '#a9a49a', '#938e84', '#b8b3a8');
      for (let k = 0; k < 3; k++) { const t = (st.T0 * 0.5 + k / 3) % 1; ctx.fillStyle = `rgba(240,240,240,${0.5 * (1 - t)})`; ctx.beginPath(); ctx.arc(c[0] + 9 + Math.sin(t * 6) * 3, c[1] - h - 20 - t * 22, 3 + t * 4, 0, 7); ctx.fill(); }
      const sg = lerp(lf, bt, 0.5); ctx.fillStyle = '#d9a25a'; ctx.beginPath(); ctx.ellipse(sg[0] - 2, sg[1] - 14, 6, 3.5, -0.3, 0, 7); ctx.fill();
    },
    brewery(b) {
      const h = 20, [tp, rt, bt, lf] = walls(b, h, ['#d8c4a0', '#c2ab84']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 12];
      poly([upp(lf, h), upp(bt, h), ap], '#5f6f4a'); poly([upp(bt, h), upp(rt, h), ap], '#4e5c3c'); door(bt, rt, 5, 12, '#5a3a24');
      for (const [dx, dy] of [[-22, 6], [-16, 10]]) { ctx.fillStyle = '#9a6a3e'; ctx.beginPath(); ctx.ellipse(c[0] + dx, c[1] + dy - 5, 5, 6.5, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c[0] + dx - 5, c[1] + dy - 7); ctx.lineTo(c[0] + dx + 5, c[1] + dy - 7); ctx.moveTo(c[0] + dx - 5, c[1] + dy - 3); ctx.lineTo(c[0] + dx + 5, c[1] + dy - 3); ctx.stroke(); }
      ctx.fillStyle = st.sea === 3 ? '#8a9a82' : '#6fa04a'; for (let k = 0; k < 5; k++) { const p = lerp(upp(lf, 4), upp(lf, h), k / 5); ctx.beginPath(); ctx.arc(p[0] + 3, p[1], 2.4, 0, 7); ctx.fill(); }
    },
    shop(b) {
      const lv = b.lvl || 0, c = iso(b.x, b.y);
      if (lv === 0) { // a market stall: a counter with a striped awning
        box([c[0], c[1] + 2], 0.34, 10, '#b58a5c', '#9a7048', '#c99a6a');
        ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 2; for (const dx of [-18, 18]) { ctx.beginPath(); ctx.moveTo(c[0] + dx, c[1] + 2); ctx.lineTo(c[0] + dx, c[1] - 24); ctx.stroke(); }
        for (let i = 0; i < 5; i++) poly([[c[0] - 22 + i * 9, c[1] - 24], [c[0] - 13 + i * 9, c[1] - 24], [c[0] - 13 + i * 9, c[1] - 18], [c[0] - 22 + i * 9, c[1] - 18]], i % 2 ? '#f3e6c4' : '#4f8ab5');
        for (const [dx, q] of [[-8, '#c97a4a'], [0, '#efe6d6'], [8, '#d9a441']]) { ctx.fillStyle = q; ctx.beginPath(); ctx.arc(c[0] + dx, c[1] - 9, 3, 0, 7); ctx.fill(); }
        return;
      }
      const h = 20 + lv * 6, [tp, rt, bt, lf] = walls(b, h, lv >= 2 ? ['#e6dfd2', '#cfc7b8'] : ['#e8d3a8', '#cfb88c']), ap = [c[0], c[1] - h - 14];
      poly([upp(lf, h), upp(bt, h), ap], lv >= 2 ? '#3f6f8a' : '#4f8ab5'); poly([upp(bt, h), upp(rt, h), ap], lv >= 2 ? '#335c74' : '#3f7099');
      door(bt, rt, 5, 12, '#5a3a24'); door(lf, bt, 7, 9, st.dark > 0.3 ? '#ffd27a' : '#cfe3ee');
      const a1 = lerp(lf, bt, 0.15), a2 = lerp(lf, bt, 0.85); for (let i = 0; i < 4; i++) poly([upp(lerp(a1, a2, i / 4), 15), upp(lerp(a1, a2, (i + 1) / 4), 15), [lerp(a1, a2, (i + 1) / 4)[0] - 4, lerp(a1, a2, (i + 1) / 4)[1] - 9], [lerp(a1, a2, i / 4)[0] - 4, lerp(a1, a2, i / 4)[1] - 9]], i % 2 ? '#f3e6c4' : '#d9534f');
    },
    well(b) {
      const c = iso(b.x, b.y);
      if ((b.lvl || 0) >= 2) { // water tower: a round wooden tank on four legs, with a ladder
        ctx.fillStyle = 'rgba(40,60,40,.22)'; ctx.beginPath(); ctx.ellipse(c[0], c[1] + 2, 22, 10, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 3;
        for (const [dx, dy] of [[-14, -3], [14, -3], [-8, 5], [8, 5]]) { ctx.beginPath(); ctx.moveTo(c[0] + dx, c[1] + dy); ctx.lineTo(c[0] + dx * 0.8, c[1] + dy - 46); ctx.stroke(); }
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c[0] - 13, c[1] - 14); ctx.lineTo(c[0] + 13, c[1] - 30); ctx.moveTo(c[0] + 13, c[1] - 14); ctx.lineTo(c[0] - 13, c[1] - 30); ctx.stroke();
        const ty = c[1] - 48, rx = 20, ry = 9, th = 26;
        ctx.fillStyle = '#9a6a42'; ctx.beginPath(); ctx.ellipse(c[0], ty, rx, ry, 0, 0, Math.PI); ctx.lineTo(c[0] - rx, ty - th); ctx.ellipse(c[0], ty - th, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 2; for (const f of [0.25, 0.75]) { ctx.beginPath(); ctx.ellipse(c[0], ty - th * f, rx, ry, 0, 0, Math.PI); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(90,58,36,.45)'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { const x = c[0] + i * 6; ctx.beginPath(); ctx.moveTo(x, ty - th + ry * Math.sqrt(1 - (i * 6 / rx) ** 2)); ctx.lineTo(x, ty + ry * Math.sqrt(1 - (i * 6 / rx) ** 2)); ctx.stroke(); }
        poly([[c[0] - rx - 3, ty - th], [c[0], ty - th - 18], [c[0] + rx + 3, ty - th]], '#7a4a32');
        ctx.fillStyle = '#7fb3d0'; ctx.beginPath(); ctx.ellipse(c[0], ty - th, rx - 3, ry - 2, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#c9a171'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c[0] + 17, c[1] - 2); ctx.lineTo(c[0] + 17, ty + 4); ctx.moveTo(c[0] + 22, c[1] - 4); ctx.lineTo(c[0] + 22, ty + 2); ctx.stroke();
        for (let y = c[1] - 8; y > ty + 4; y -= 6) { ctx.beginPath(); ctx.moveTo(c[0] + 17, y); ctx.lineTo(c[0] + 22, y - 2); ctx.stroke(); }
        return;
      }
      if ((b.lvl || 0) >= 1) { // fountain
        box(c, 0.42, 8, '#c9c2b4', '#b2ab9c', '#7fb3d0');
        box([c[0], c[1] - 8], 0.12, 18, '#ddd6c8', '#c9c2b4', '#e6e0d3');
        ctx.strokeStyle = 'rgba(180,220,245,.9)'; ctx.lineWidth = 2;
        for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(c[0], c[1] - 26); ctx.quadraticCurveTo(c[0] + s2 * 10, c[1] - 30 - Math.sin(st.T0 * 4) * 2, c[0] + s2 * 14, c[1] - 6); ctx.stroke(); }
        return;
      }
      box(c, 0.28, 12, '#a9a49a', '#8f8a80', '#5f8fb0');
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 3;
      for (const dx of [-12, 12]) { ctx.beginPath(); ctx.moveTo(c[0] + dx, c[1] - 6); ctx.lineTo(c[0] + dx, c[1] - 34); ctx.stroke(); }
      poly([[c[0] - 18, c[1] - 30], [c[0], c[1] - 44], [c[0] + 18, c[1] - 30], [c[0], c[1] - 24]], '#8a5a3a');
      ctx.fillStyle = '#7a5638'; ctx.fillRect(c[0] - 3, c[1] - 26, 6, 6);
    },
    flowerbed(b) {
      const c = iso(b.x, b.y); ctx.fillStyle = '#8a6a3e'; dia(c[0], c[1], TW / 2 - 8, TH / 2 - 4); ctx.fill();
      [['#e86a8a', -10, -1], ['#f2c94c', -3, 3], ['#b58be0', 5, -2], ['#ffffff', 11, 1], ['#e86a8a', 2, -5], ['#f08fa4', -6, -5]].forEach(([q, dx, dy]) => { ctx.fillStyle = '#5f9a4a'; ctx.fillRect(c[0] + dx - 0.5, c[1] + dy - 4, 1.5, 5); ctx.fillStyle = st.sea === 3 ? '#e8eef0' : q; ctx.beginPath(); ctx.arc(c[0] + dx, c[1] + dy - 5, 2.8, 0, 7); ctx.fill(); });
    },
    bench(b) {
      const c = iso(b.x, b.y);
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2;
      for (const dx of [-12, 12]) { ctx.beginPath(); ctx.moveTo(c[0] + dx, c[1] + dx * -0.25); ctx.lineTo(c[0] + dx, c[1] + dx * -0.25 - 7); ctx.stroke(); }
      poly([[c[0] - 15, c[1] - 4], [c[0] + 15, c[1] - 11], [c[0] + 15, c[1] - 7], [c[0] - 15, c[1]]], '#a8784a');
      poly([[c[0] - 15, c[1] - 12], [c[0] + 15, c[1] - 19], [c[0] + 15, c[1] - 15], [c[0] - 15, c[1] - 8]], '#94673e');
    },
    path(b) { drawPath(ctx, st.G, b, iso(b.x, b.y)); },
    fireflylamp(b) {
      const c = iso(b.x, b.y), lit = st.dark > 0.15;
      ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0], c[1] - 20); ctx.lineTo(c[0] + 6, c[1] - 20); ctx.stroke();
      if (lit) { const gr = ctx.createRadialGradient(c[0] + 6, c[1] - 12, 1, c[0] + 6, c[1] - 12, 22); gr.addColorStop(0, 'rgba(220,255,150,.45)'); gr.addColorStop(1, 'rgba(220,255,150,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c[0] + 6, c[1] - 12, 22, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(200,230,240,.55)'; ctx.beginPath(); ctx.roundRect(c[0] + 2, c[1] - 18, 8, 10, 2); ctx.fill(); ctx.fillStyle = '#9a7a50'; ctx.fillRect(c[0] + 2, c[1] - 19, 8, 2);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = lit ? `rgba(240,255,170,${0.5 + 0.5 * Math.abs(Math.sin(st.T0 * 2 + k * 2))})` : '#c9d28a'; ctx.beginPath(); ctx.arc(c[0] + 4 + k * 2, c[1] - 12 - (k % 2) * 3, 1.2, 0, 7); ctx.fill(); }
    },
    arbor(b) {
      const c = iso(b.x, b.y), win = st.sea === 3;
      ctx.strokeStyle = '#8a6440'; ctx.lineWidth = 3;
      for (const dx of [-13, 13]) { ctx.beginPath(); ctx.moveTo(c[0] + dx, c[1] + dx * -0.2); ctx.lineTo(c[0] + dx, c[1] + dx * -0.2 - 20); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(c[0], c[1] - 20, 13, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = win ? '#8a9a82' : '#4f8a44';
      for (let a = 0; a <= 10; a++) { const t = Math.PI + a * Math.PI / 10, px = c[0] + Math.cos(t) * 13, py = c[1] - 20 + Math.sin(t) * 13; ctx.beginPath(); ctx.arc(px, py, 4, 0, 7); ctx.fill(); }
      for (const dx of [-13, 13]) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(c[0] + dx + (k % 2 ? 2 : -2), c[1] - 4 - k * 6 + dx * -0.2, 3.2, 0, 7); ctx.fill(); }
      if (!win) { ctx.fillStyle = '#e86a8a'; for (const [dx, dy] of [[-11, -26], [-4, -32], [6, -31], [12, -24], [-14, -12], [14, -14], [0, -34]]) { ctx.beginPath(); ctx.arc(c[0] + dx, c[1] + dy, 2.2, 0, 7); ctx.fill(); } }
    },
    statue(b) {
      const c = iso(b.x, b.y);
      box(c, 0.3, 10, '#b9b0a0', '#a39a8a', '#cfc7b8');
      const t = [c[0], c[1] - 10];
      poly([[t[0] - 6, t[1]], [t[0] + 6, t[1] - 3], [t[0] + 4, t[1] - 26], [t[0] - 4, t[1] - 24]], '#ddd6c8');
      ctx.fillStyle = '#e6e0d3'; ctx.beginPath(); ctx.arc(t[0], t[1] - 30, 6, 0, 7); ctx.fill();
      poly([[t[0] + 4, t[1] - 20], [t[0] + 14, t[1] - 30], [t[0] + 12, t[1] - 32], [t[0] + 3, t[1] - 24]], '#cfc7b8');
    },
    tavern(b, age) {
      const h = heightOf(b, age), [tp, rt, bt, lf] = walls(b, h, ['#e3c79a', '#c9a874']), R1 = upp(mid(tp, rt), h + 26), R2 = upp(mid(lf, bt), h + 26);
      poly([upp(lf, h), upp(bt, h), R2], '#e3c79a'); poly([upp(bt, h), upp(rt, h), R1, R2], '#7a4a3a');
      door(bt, rt, 9, 18, '#5a3a24');
      const nightGlow = st.dark > 0.3 ? '#ffd27a' : '#f3e6c4';
      door(lf, bt, 6, 8, nightGlow); const wp = lerp(bt, rt, 0.78); poly([[wp[0] - 6, wp[1] - 14], [wp[0] + 6, wp[1] - 17], [wp[0] + 6, wp[1] - 25], [wp[0] - 6, wp[1] - 22]], nightGlow);
      const sp = lerp(bt, rt, 0.2); ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sp[0], sp[1] - h + 4); ctx.lineTo(sp[0] + 14, sp[1] - h + 1); ctx.stroke();
      poly([[sp[0] + 6, sp[1] - h + 3], [sp[0] + 16, sp[1] - h + 1], [sp[0] + 16, sp[1] - h + 11], [sp[0] + 6, sp[1] - h + 13]], '#d9a441');
    },
    campfire(b) {
      const lv = b.lvl || 0, c = iso(b.x, b.y);
      if (lv >= 1) for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + 0.3, p = [c[0] + Math.cos(a) * 24, c[1] + Math.sin(a) * 11]; ctx.fillStyle = '#8a6a44'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 7, 3.2, a, 0, 7); ctx.fill(); ctx.fillStyle = '#a8845a'; ctx.beginPath(); ctx.ellipse(p[0] + 4 * Math.cos(a), p[1] + 2 * Math.sin(a), 2.4, 2, 0, 0, 7); ctx.fill(); }
      drawFire(st.G);
      if (lv >= 2) { // lantern green: posts with strings of warm lights
        const posts = [[-34, -6], [0, -22], [34, -6], [0, 14]].map(([dx, dy]) => [c[0] + dx, c[1] + dy]);
        ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2;
        for (const p of posts) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 30); ctx.stroke(); }
        for (let i = 0; i < 4; i++) { const a = posts[i], z = posts[(i + 1) % 4]; ctx.strokeStyle = 'rgba(90,70,50,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1] - 30); ctx.quadraticCurveTo((a[0] + z[0]) / 2, (a[1] + z[1]) / 2 - 22, z[0], z[1] - 30); ctx.stroke();
          for (let k = 1; k < 6; k++) { const t = k / 6, x = a[0] + (z[0] - a[0]) * t, y = (a[1] - 30) + ((z[1] - 30) - (a[1] - 30)) * t + 8 * Math.sin(t * Math.PI) - 8; ctx.fillStyle = ['#ffd27a', '#f6a6c1', '#a6d8f6'][k % 3]; ctx.beginPath(); ctx.arc(x, y + 6, 2.2, 0, 7); ctx.fill(); } }
      }
    },
    school(b) {
      const h = 20, [tp, rt, bt, lf] = walls(b, h, ['#efe2c6', '#d9c8a6']), R1 = upp(mid(tp, rt), h + 16), R2 = upp(mid(lf, bt), h + 16);
      poly([upp(lf, h), upp(bt, h), R2], '#efe2c6'); poly([upp(bt, h), upp(rt, h), R1, R2], '#b5523e');
      door(bt, rt, 5, 12, '#6a4a2c'); door(lf, bt, 5, 7, st.dark > 0.3 ? '#ffd27a' : '#bcd6e6');
      const t = lerp(R2, R1, 0.5); box([t[0], t[1] + 4], 0.09, 12, '#efe2c6', '#d9c8a6', '#b5523e');
      ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.arc(t[0], t[1] - 4, 2.6, 0, 7); ctx.fill();
      poly([[t[0] - 7, t[1] - 8], [t[0], t[1] - 17], [t[0] + 7, t[1] - 8]], '#9a4232');
    },
    studio(b) {
      const h = 18, [tp, rt, bt, lf] = walls(b, h, ['#e6d8e8', '#cdbcd2']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 14];
      poly([upp(lf, h), upp(bt, h), ap], '#5f7f9a'); poly([upp(bt, h), upp(rt, h), ap], '#4e6c85');
      poly([lerp(upp(bt, h), ap, 0.25), lerp(upp(rt, h), ap, 0.25), lerp(upp(rt, h), ap, 0.6), lerp(upp(bt, h), ap, 0.6)], st.dark > 0.3 ? '#ffd27a' : '#bfe0ee'); // skylight
      door(lf, bt, 5, 12, '#6a4a2c');
      const e = [c[0] + 22, c[1] + 6]; ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(e[0] - 5, e[1]); ctx.lineTo(e[0], e[1] - 18); ctx.lineTo(e[0] + 5, e[1]); ctx.moveTo(e[0], e[1] - 18); ctx.lineTo(e[0] + 1, e[1] + 1); ctx.stroke();
      ctx.fillStyle = '#fbf6ea'; ctx.fillRect(e[0] - 6, e[1] - 16, 12, 9);
      for (const [dx, dy, q] of [[-3, -13, '#e86a8a'], [1, -11, '#4f9a7a'], [3, -14, '#f2c94c']]) { ctx.fillStyle = q; ctx.beginPath(); ctx.arc(e[0] + dx, e[1] + dy, 1.8, 0, 7); ctx.fill(); }
    },
    theater(b) {
      const [tp, rt, bt, lf] = cor(b), c = iso(b.x + 0.5, b.y + 0.5), lit = st.dark > 0.3;
      poly([tp, rt, bt, lf], '#c9b48e');
      const back = [lerp(lf, tp, 0.15), lerp(tp, rt, 0.85)], h = 36;
      poly([back[0], back[1], upp(back[1], h), upp(back[0], h)], '#7a4a3a');           // back wall
      poly([upp(back[0], h), upp(back[1], h), upp(back[1], h + 12), upp(mid(back[0], back[1]), h + 22), upp(back[0], h + 12)], '#8a5a3a');
      const stage = [lerp(lf, tp, 0.15), lerp(tp, rt, 0.85), lerp(rt, bt, 0.45), lerp(lf, bt, 0.45)];
      poly([stage[3], stage[2], upp(stage[2], 6), upp(stage[3], 6)], '#9a6a3e'); poly(stage.map(p => upp(p, 6)), lit ? '#e8c98a' : '#c99a5a'); // stage
      for (const [f, f2] of [[0.02, 0.22], [0.98, 0.78]]) { const p = lerp(back[0], back[1], f), p2 = lerp(back[0], back[1], f2), q = lerp(stage[3], stage[2], f); poly([upp(p, 6), upp(p2, 6), upp(p2, h), upp(p, h)], '#b03a3a'); ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] - h); ctx.stroke(); }
      for (let i = 0; i < 5; i++) { const p = upp(lerp(back[0], back[1], 0.1 + i * 0.2), h + 4); ctx.fillStyle = ['#f2c94c', '#e86a8a', '#4f9a7a', '#b58be0', '#5aa9e6'][i]; poly([[p[0] - 4, p[1]], [p[0] + 4, p[1] - 2], [p[0], p[1] + 7]], ctx.fillStyle); }
      if (lit) { const gr = ctx.createRadialGradient(c[0], c[1] - 14, 4, c[0], c[1] - 10, 50); gr.addColorStop(0, 'rgba(255,214,130,0.35)'); gr.addColorStop(1, 'rgba(255,214,130,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c[0], c[1] - 10, 50, 0, 7); ctx.fill(); }
    },
    potter(b) {
      const h = 18, [tp, rt, bt, lf] = walls(b, h, ['#d9b48a', '#c49c70']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 16];
      poly([upp(lf, h), upp(bt, h), ap], '#a8603a'); poly([upp(bt, h), upp(rt, h), ap], '#8e4e2e'); door(bt, rt, 5, 12, '#6a4a2c');
      ctx.fillStyle = '#b5643c'; ctx.beginPath(); ctx.ellipse(c[0] - 18, c[1] + 2, 7, 5, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(c[0] - 25, c[1] + 1, 14, 3); // kiln
      for (const [dx, col] of [[14, '#c97a4a'], [20, '#a85a34']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(c[0] + dx, c[1] + 8, 3.5, 4.5, 0, 0, 7); ctx.fill(); }
    },
    quarry(b) {
      const [tp, rt, bt, lf] = cor(b), c = iso(b.x + 0.5, b.y + 0.5);
      poly([tp, rt, bt, lf], '#a9a49a');
      poly([lerp(tp, c, 0.25), lerp(rt, c, 0.25), lerp(bt, c, 0.25), lerp(lf, c, 0.25)], '#8f8a80');
      poly([lerp(tp, c, 0.55), lerp(rt, c, 0.55), lerp(bt, c, 0.55), lerp(lf, c, 0.55)], '#77736a');
      for (const [dx, dy] of [[-30, 4], [-22, 9], [24, 6]]) box([c[0] + dx, c[1] + dy], 0.12, 7, '#d6d0c4', '#bfb8aa', '#e6e1d6');
      const m = [c[0] + 16, c[1] - 6]; ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(m[0], m[1] - 34); ctx.lineTo(m[0] - 22, m[1] - 26); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m[0] - 22, m[1] - 26); ctx.lineTo(m[0] - 22, m[1] - 10); ctx.stroke();
      box([m[0] - 22, m[1] - 4], 0.08, 6, '#d6d0c4', '#bfb8aa', '#e6e1d6');
    },
    // ---- animals: they wander inside their pens
    coop(b) {
      const h = 14, [tp, rt, bt, lf] = walls(b, h, ['#c9a171', '#b58a5c']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 12];
      poly([upp(lf, h), upp(bt, h), ap], '#8a5a3a'); poly([upp(bt, h), upp(rt, h), ap], '#7a4a2c');
      const d = mid(bt, rt); poly([[d[0] - 3, d[1] - 1], [d[0] + 3, d[1] + 1], [d[0] + 3, d[1] - 7], [d[0] - 3, d[1] - 9]], '#3a2818');
      ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(d[0] + 3, d[1]); ctx.lineTo(d[0] + 14, d[1] + 8); ctx.stroke();
      herd(b, 'hen', c, 34, 14);
    },
    sheepfold(b) { pen(b, '#9ac06a'); herd(b, 'sheep', iso(b.x + 0.5, b.y + 0.5), 46, 18); },
    pasture(b) { pen(b, '#8fbf55'); const c = iso(b.x + 0.5, b.y + 0.5); ctx.fillStyle = '#c9a171'; ctx.fillRect(c[0] + 18, c[1] - 4, 14, 6); herd(b, 'cow', c, 44, 16); },
    apiary(b) {
      const c = iso(b.x, b.y), win = st.sea === 3;
      for (const [dx, dy] of [[-12, 2], [2, -3], [14, 4]]) { box([c[0] + dx, c[1] + dy], 0.1, 10, '#f3e6c4', '#e3d3b0', '#c9a171'); ctx.fillStyle = '#d9a441'; ctx.fillRect(c[0] + dx - 3, c[1] + dy - 4, 6, 1.5); }
      if (!win) { const n = 3 + (b.animals || 2) * 2; ctx.fillStyle = '#3a3020'; for (let k = 0; k < n; k++) { const t = st.T0 * (1.5 + k * 0.1) + k * 2.1; ctx.beginPath(); ctx.arc(c[0] + Math.sin(t) * 18, c[1] - 14 + Math.cos(t * 1.3) * 8, 1.2, 0, 7); ctx.fill(); } }
    },
    dairy(b) {
      const h = 18, [tp, rt, bt, lf] = walls(b, h, ['#f3ecdc', '#ddd3bf']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 12];
      poly([upp(lf, h), upp(bt, h), ap], '#5f7f9a'); poly([upp(bt, h), upp(rt, h), ap], '#4e6c85'); door(bt, rt, 5, 12, '#6a4a2c');
      for (const [dx, dy] of [[-20, 6], [-13, 9]]) { ctx.fillStyle = '#c9c2b4'; ctx.fillRect(c[0] + dx - 3, c[1] + dy - 9, 6, 9); ctx.fillStyle = '#e3ddd0'; ctx.beginPath(); ctx.ellipse(c[0] + dx, c[1] + dy - 9, 3, 1.2, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(c[0] + 18, c[1] + 6, 4, 0, Math.PI); ctx.fill();
    },
    chandler(b) {
      const h = 18, [tp, rt, bt, lf] = walls(b, h, ['#e3d3b0', '#cdbb94']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 12];
      poly([upp(lf, h), upp(bt, h), ap], '#8a5a3a'); poly([upp(bt, h), upp(rt, h), ap], '#7a4a2c'); door(bt, rt, 5, 12, '#5a3a24');
      const w = lerp(lf, bt, 0.5); for (let k = 0; k < 3; k++) { ctx.fillStyle = '#f3ecdc'; ctx.fillRect(w[0] - 6 + k * 5, w[1] - 14, 2.5, 7); ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.ellipse(w[0] - 4.8 + k * 5, w[1] - 16 + Math.sin(st.T0 * 8 + k) * 0.5, 1.2, 2, 0, 0, 7); ctx.fill(); }
    },
    // ---- culture and gathering
    church(b) {
      const h = 30, [tp, rt, bt, lf] = walls(b, h, ['#efe6d4', '#d9cdb5']), R1 = upp(mid(tp, rt), h + 26), R2 = upp(mid(lf, bt), h + 26);
      poly([upp(lf, h), upp(bt, h), R2], '#efe6d4'); poly([upp(bt, h), upp(rt, h), R1, R2], '#6a5a6a');
      door(bt, rt, 7, 18, '#6a4a2c');
      for (const f of [0.3, 0.7]) { const wp = lerp(lf, bt, f); ctx.fillStyle = st.dark > 0.3 ? '#ffd27a' : '#a8c4e0'; ctx.beginPath(); ctx.moveTo(wp[0] - 4, wp[1] - 8); ctx.lineTo(wp[0] - 4, wp[1] - 18); ctx.quadraticCurveTo(wp[0], wp[1] - 24, wp[0] + 4, wp[1] - 16); ctx.lineTo(wp[0] + 4, wp[1] - 6); ctx.fill(); }
      const t = upp(lerp(bt, rt, 0.85), h); box([t[0], t[1] + 6], 0.18, 34, '#efe6d4', '#d9cdb5', '#6a5a6a');
      poly([[t[0] - 0.18 * TW, t[1] - 28], [t[0], t[1] - 54], [t[0] + 0.18 * TW, t[1] - 28]], '#6a5a6a');
      ctx.fillStyle = '#d9a441'; ctx.fillRect(t[0] - 1, t[1] - 64, 2, 10); ctx.fillRect(t[0] - 4, t[1] - 61, 8, 2);
    },
    library(b) {
      const h = 28, [tp, rt, bt, lf] = walls(b, h, ['#d8d1c3', '#c2baab']), R1 = upp(mid(tp, rt), h + 18), R2 = upp(mid(lf, bt), h + 18);
      poly([upp(lf, h), upp(bt, h), R2], '#d8d1c3'); poly([upp(bt, h), upp(rt, h), R1, R2], '#3f5f4a');
      door(bt, rt, 7, 16, '#5a3a24');
      for (const f of [0.2, 0.5, 0.8]) { const wp = lerp(lf, bt, f); poly([[wp[0] - 5, wp[1] - 6], [wp[0] + 5, wp[1] - 1], [wp[0] + 5, wp[1] - 16], [wp[0] - 5, wp[1] - 21]], st.dark > 0.3 ? '#ffd27a' : '#cfe3ee'); }
      for (const f of [0.15, 0.4, 0.65, 0.9]) { const p = lerp(bt, rt, f); ctx.fillStyle = '#efe9dc'; ctx.fillRect(p[0] - 2, p[1] - h, 4, h); }   // columns
    },
    playground(b) {
      const [tp, rt, bt, lf] = cor(b), c = iso(b.x + 0.5, b.y + 0.5);
      poly([tp, rt, bt, lf], '#d9c08a');
      ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 2.5; const s0 = [c[0] - 26, c[1] - 2];
      ctx.beginPath(); ctx.moveTo(s0[0] - 10, s0[1] + 6); ctx.lineTo(s0[0], s0[1] - 26); ctx.lineTo(s0[0] + 10, s0[1] + 6); ctx.moveTo(s0[0] + 14, s0[1] + 10); ctx.lineTo(s0[0] + 24, s0[1] - 22); ctx.lineTo(s0[0] + 34, s0[1] + 10); ctx.moveTo(s0[0], s0[1] - 26); ctx.lineTo(s0[0] + 24, s0[1] - 22); ctx.stroke();
      const sw = Math.sin(st.T0 * 2.5) * 4; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s0[0] + 12, s0[1] - 25); ctx.lineTo(s0[0] + 12 + sw, s0[1] - 6); ctx.stroke(); ctx.fillStyle = '#c9553d'; ctx.fillRect(s0[0] + 8 + sw, s0[1] - 7, 8, 2.5);
      ctx.strokeStyle = '#4f7fb5'; ctx.lineWidth = 3; const tilt = Math.sin(st.T0 * 1.6) * 5; ctx.beginPath(); ctx.moveTo(c[0] + 6, c[1] + 10 + tilt); ctx.lineTo(c[0] + 34, c[1] + 4 - tilt); ctx.stroke(); ctx.fillStyle = '#8a5a3a'; ctx.fillRect(c[0] + 18, c[1] + 6, 4, 6);
      ctx.fillStyle = '#e8d29a'; ctx.beginPath(); ctx.ellipse(c[0] + 6, c[1] - 14, 12, 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#c9553d'; ctx.fillRect(c[0] + 4, c[1] - 18, 4, 3);
    },
    claypit(b) {
      const [tp, rt, bt, lf] = cor(b), c = iso(b.x + 0.5, b.y + 0.5);
      poly([tp, rt, bt, lf], '#9a6a4a');
      poly([lerp(tp, c, 0.3), lerp(rt, c, 0.3), lerp(bt, c, 0.3), lerp(lf, c, 0.3)], '#7a4a32');
      poly([lerp(tp, c, 0.6), lerp(rt, c, 0.6), lerp(bt, c, 0.6), lerp(lf, c, 0.6)], '#5f9eb5');   // a puddle at the bottom
      for (const [dx, dy] of [[-28, 6], [24, 10]]) { ctx.fillStyle = '#a8603a'; ctx.beginPath(); ctx.ellipse(c[0] + dx, c[1] + dy, 8, 5, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(c[0] + 18, c[1] - 2); ctx.lineTo(c[0] + 30, c[1] - 22); ctx.stroke();
      poly([[c[0] + 26, c[1] - 24], [c[0] + 36, c[1] - 20], [c[0] + 33, c[1] - 14]], '#8a8478');
    },
    goldmine(b) {
      const c = iso(b.x + 0.5, b.y + 0.5);
      ctx.fillStyle = '#8a8478'; ctx.beginPath(); ctx.moveTo(c[0] - 46, c[1] + 8); ctx.quadraticCurveTo(c[0] - 30, c[1] - 40, c[0], c[1] - 46); ctx.quadraticCurveTo(c[0] + 34, c[1] - 40, c[0] + 46, c[1] + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a9a49a'; ctx.beginPath(); ctx.moveTo(c[0] - 30, c[1] - 4); ctx.quadraticCurveTo(c[0] - 18, c[1] - 34, c[0] + 4, c[1] - 38); ctx.lineTo(c[0] - 4, c[1] - 4); ctx.fill();
      ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.moveTo(c[0] - 12, c[1] + 6); ctx.lineTo(c[0] - 12, c[1] - 12); ctx.quadraticCurveTo(c[0], c[1] - 24, c[0] + 12, c[1] - 12); ctx.lineTo(c[0] + 12, c[1] + 6); ctx.fill();
      ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c[0] - 14, c[1] + 6); ctx.lineTo(c[0] - 14, c[1] - 14); ctx.quadraticCurveTo(c[0], c[1] - 28, c[0] + 14, c[1] - 14); ctx.lineTo(c[0] + 14, c[1] + 6); ctx.stroke();
      ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 2; for (const dy of [12, 18]) { ctx.beginPath(); ctx.moveTo(c[0] - 6, c[1] + dy - 6); ctx.lineTo(c[0] + 30, c[1] + dy + 10); ctx.stroke(); }
      box([c[0] + 24, c[1] + 16], 0.1, 7, '#7a5638', '#6a4a2c', '#e0b040');
    },
    jeweler(b) {
      const h = 20, [tp, rt, bt, lf] = walls(b, h, ['#d8d1c3', '#c2baab']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 14];
      poly([upp(lf, h), upp(bt, h), ap], '#6a5a8a'); poly([upp(bt, h), upp(rt, h), ap], '#57497a');
      door(bt, rt, 5, 12, '#5a3a24');
      const a1 = lerp(lf, bt, 0.25), a2 = lerp(lf, bt, 0.8); poly([upp(a1, 14), upp(a2, 14), [a2[0] - 3, a2[1] - 8], [a1[0] - 3, a1[1] - 8]], '#9a7fc4'); // awning
      const tw = Math.abs(Math.sin(st.T0 * 3 + b.x)); ctx.fillStyle = `rgba(255,236,150,${0.4 + tw * 0.6})`; ctx.beginPath(); const s = [c[0] - 12, c[1] - h - 4]; ctx.moveTo(s[0], s[1] - 5); ctx.lineTo(s[0] + 1.5, s[1] - 1.5); ctx.lineTo(s[0] + 5, s[1]); ctx.lineTo(s[0] + 1.5, s[1] + 1.5); ctx.lineTo(s[0], s[1] + 5); ctx.lineTo(s[0] - 1.5, s[1] + 1.5); ctx.lineTo(s[0] - 5, s[1]); ctx.lineTo(s[0] - 1.5, s[1] - 1.5); ctx.fill();
    },
    carpenter(b) {
      const c = iso(b.x, b.y), [tp, rt, bt, lf] = cor(b), h = 22;
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 3; for (const p of [lf, bt, rt]) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - h); ctx.stroke(); }
      poly([upp(lf, h), upp(bt, h), upp(rt, h), upp(tp, h), [c[0], c[1] - h - 14]], '#7a5638');
      for (let i = 0; i < 3; i++) poly([[c[0] - 14, c[1] - 2 - i * 3], [c[0] + 4, c[1] - 9 - i * 3], [c[0] + 4, c[1] - 7 - i * 3], [c[0] - 14, c[1] - i * 3]], i % 2 ? '#c49a62' : '#b08850');
      ctx.fillStyle = '#9a6a3e'; ctx.fillRect(c[0] + 8, c[1] - 8, 7, 2); ctx.fillRect(c[0] + 8, c[1] - 8, 2, 8); ctx.fillRect(c[0] + 13, c[1] - 8, 2, 8); ctx.fillRect(c[0] + 13, c[1] - 14, 2, 8); // chair
    },
    weaver(b) {
      const h = 20, [tp, rt, bt, lf] = walls(b, h, ['#efe2c8', '#d8c9aa']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 18];
      poly([upp(lf, h), upp(bt, h), ap], '#6f8fb0'); poly([upp(bt, h), upp(rt, h), ap], '#5a7896'); door(bt, rt, 5, 12, '#6a4a2c');
      ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 2; const p = [c[0] - 20, c[1] + 4]; ctx.strokeRect(p[0], p[1] - 14, 10, 12); // loom
      ctx.strokeStyle = '#e6dcc6'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(p[0] + i * 2, p[1] - 14); ctx.lineTo(p[0] + i * 2, p[1] - 2); ctx.stroke(); }
    },
    fiberfield(b) {
      const c = iso(b.x + 0.5, b.y + 0.5); ctx.fillStyle = '#8a7a4e'; dia(c[0], c[1], TW, TH); ctx.fill();
      for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) { const p = iso(b.x - 0.3 + i * 0.5, b.y - 0.3 + j * 0.42); ctx.strokeStyle = '#6f9a50'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 7); ctx.stroke(); if (b.food > 0 && st.sea < 3) { ctx.fillStyle = '#7fa6e0'; ctx.beginPath(); ctx.arc(p[0], p[1] - 8, 2, 0, 7); ctx.fill(); } }
    },
    garden(b) { const c = iso(b.x, b.y); ctx.fillStyle = '#7fae5a'; dia(c[0], c[1], TW / 2 - 3, TH / 2 - 2); ctx.fill(); [['#e86a8a', -9, -2], ['#f2c94c', 0, 3], ['#b58be0', 9, -1], ['#ffffff', -3, -5]].forEach(([q, dx, dy]) => { ctx.fillStyle = st.sea === 3 ? '#e8eef0' : q; ctx.beginPath(); ctx.arc(c[0] + dx, c[1] + dy, 3.2, 0, 7); ctx.fill(); }); },
  };

  function bar(b, age, g) {
    const p = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2), y = p[1] - heightOf(b, age) - 40, w = 46, q = Math.min(1, b.prog / b.time);
    const active = g.villagers.some(v => v.act && v.act.type === 'build' && v.act.b === b.id && v.act.phase === 'work');
    ctx.fillStyle = 'rgba(60,45,30,.55)'; ctx.beginPath(); ctx.roundRect(p[0] - w / 2, y, w, 8, 4); ctx.fill();
    ctx.fillStyle = active ? '#f2c14e' : '#b9ab8c'; ctx.beginPath(); ctx.roundRect(p[0] - w / 2 + 1, y + 1, Math.max(0, (w - 2) * q), 6, 3); ctx.fill();
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(active ? '🔨' : '⏸️', p[0], y - 3);
  }
  // Anything without art or a drawer of its own: a plain timber building on its footprint.
  function generic(b) {
    const c = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2), s = Math.max(b.w, b.h), h = 18 + s * 8;
    box(c, 0.32 * s, h, '#d9c4a0', '#c4ad86', '#e8d6b4');
    poly([[c[0] - 0.34 * s * TW, c[1] - h], [c[0], c[1] - h - 14 * s], [c[0] + 0.34 * s * TW, c[1] - h], [c[0], c[1] - h + 0.34 * s * TH]], '#a8584a');
  }
  // Live touches on top of the art: torch and lamp flames (and their glow after dark), the village flag.
  const UNIT = 46;   // screen pixels per model unit of height
  function flame(x, y, size) {
    const t = st.T0, f = 1 + Math.sin(t * 13 + x) * 0.12 + Math.sin(t * 7.3 + y) * 0.08, d = st.dark;
    if (d > 0.1) {
      const r = 26 * size * (0.9 + 0.1 * f), gr = ctx.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(255,200,110,${0.55 * d})`); gr.addColorStop(1, 'rgba(255,190,100,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#f2a03a'; ctx.beginPath(); ctx.moveTo(x - 3 * size, y); ctx.quadraticCurveTo(x - 3.2 * size, y - 5 * size * f, x + Math.sin(st.T0 * 9) * size, y - 9 * size * f); ctx.quadraticCurveTo(x + 3.2 * size, y - 5 * size * f, x + 3 * size, y); ctx.fill();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.ellipse(x, y - 2.5 * size, 1.5 * size, 3 * size * f, 0, 0, 7); ctx.fill();
  }
  function groundGlow(x, y, r) { const d = st.dark; if (d < 0.1) return; const gr = ctx.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, `rgba(255,205,120,${0.32 * d})`); gr.addColorStop(1, 'rgba(255,205,120,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, r, r / 2, 0, 0, 7); ctx.fill(); }
  function extras(b, g, gx, gy) {
    const c = iso(b.x, b.y), F = BUILD[b.k].flame;
    // Hands-on: a ripe field twinkles; a bundle set aside floats over its workshop in a little bubble.
    if (ripe(g, b)) { const m = iso(b.x + 0.5, b.y + 0.5), k = (st.T0 * 1.3 + b.x * 0.7) % 3; for (let i = 0; i < 3; i++) { const a = Math.max(0, Math.sin((k + i) * 2.1 + st.T0 * 3)), px = m[0] + (i - 1) * 16, py = m[1] - 12 - i % 2 * 6; if (a < 0.2) continue; ctx.fillStyle = `rgba(255,248,200,${a})`; ctx.beginPath(); ctx.moveTo(px, py - 5 * a); ctx.lineTo(px + 1.4, py - 1.4); ctx.lineTo(px + 5 * a, py); ctx.lineTo(px + 1.4, py + 1.4); ctx.lineTo(px, py + 5 * a); ctx.lineTo(px - 1.4, py + 1.4); ctx.lineTo(px - 5 * a, py); ctx.lineTo(px - 1.4, py - 1.4); ctx.fill(); } }
    if (b.ready) { const top = gy - heightOf(b, g.age) - 18 + Math.sin(st.T0 * 2.4 + b.x) * 2.5, ic = b.ready.res === 'food' ? (PANTRY_ICON[b.ready.kind] || ICON.food) : ICON[b.ready.res];
      ctx.fillStyle = 'rgba(255,247,230,.95)'; ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, top, 11, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(gx - 4, top + 9); ctx.lineTo(gx, top + 15); ctx.lineTo(gx + 4, top + 9); ctx.fill();
      ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(ic || '✨', gx, top + 1); ctx.textBaseline = 'alphabetic'; }
    if (F === 1) { groundGlow(c[0], c[1], 46); flame(c[0], c[1] - 0.43 * UNIT, 1); }
    else if (F === 2) { groundGlow(c[0], c[1], 64); const y = c[1] - 0.74 * UNIT; if (st.dark > 0.1) flame(c[0], y + 4, 0.7); else { ctx.fillStyle = 'rgba(255,224,150,.5)'; ctx.beginPath(); ctx.ellipse(c[0], y, 2, 3, 0, 0, 7); ctx.fill(); } }
    if (b.k === 'flagpole') drawFlag(ctx, g.flag, c[0] + 1, c[1] - 1.12 * UNIT, 26, 17, st.T0);
  }
  function drawBuilding(b, g) {
    ctx.globalAlpha = b.done ? 1 : 0.4 + 0.6 * b.prog / b.time;
    // Art slot first: building/<kind>/<level>/<season> (… down to building/<kind>); sites: site/<kind>, site/<w>x<h>, site.
    // Ground point: the footprint's front (bottom) point, centred across it. Turned houses are mirrored.
    const season = SEASON_NAMES[st.sea], gx = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2)[0], gy = iso(b.x + b.w - 0.5, b.y + b.h - 0.5)[1];
    const lv = b.k === 'tc' ? g.age : (b.lvl || 0);   // the town center's look follows the Age
    const base = b.k === 'house' && b.brick && (lv === 5 || lv === 6) ? 'building/house-brick' : 'building/' + b.k, turned = b.done && b.rot && (BUILD[b.k].turns || BUILD[b.k].faces) ? chain(base + '/turned', lv, season) : [];
    const hasTurned = turned.length && K.sprites.has(turned);   // turned art is drawn as it is; without it a turned house's art is mirrored
    const keys0 = !b.done ? ['site/' + b.k, `site/${b.w}x${b.h}`, 'site'] : hasTurned ? turned : BUILD[b.k].turns && b.rot ? [...turned, ...chain(base, lv, season)] : chain(base, lv, season);
    const keys = base === 'building/house-brick' && b.done ? [...keys0, ...chain('building/house/turned', lv, season), ...chain('building/house', lv, season)] : keys0;   // brick art first, stone art if it is missing
    if (K.sprites.draw(ctx, keys, gx, gy, { t: st.T0, flip: !hasTurned && !!(BUILD[b.k].faces && b.rot), winter: st.sea === 3, night: st.dark })) { /* drawn from art */ }
    else if (BUILD[b.k].faces && b.rot) { // a turned house: mirrored so its front faces the other way
      const cx = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2)[0];
      ctx.save(); ctx.translate(cx * 2, 0); ctx.scale(-1, 1); DB[b.k](b, g.age); ctx.restore();
    } else (DB[b.k] || generic)(b, g.age);
    ctx.globalAlpha = 1;
    if (b.done) extras(b, g, gx, gy);
    if (!b.done) bar(b, g.age, g);
    if (b.demolish && b.demo) { // taking down: the bar empties as the villager works
      const p = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2), y = p[1] - heightOf(b, g.age) - 40, w = 46, q = 1 - b.demo / b.demoNeed;
      ctx.fillStyle = 'rgba(60,45,30,.55)'; ctx.beginPath(); ctx.roundRect(p[0] - w / 2, y, w, 8, 4); ctx.fill();
      ctx.fillStyle = '#c9a171'; ctx.beginPath(); ctx.roundRect(p[0] - w / 2 + 1, y + 1, Math.max(0, (w - 2) * q), 6, 3); ctx.fill();
      ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('⛏️', p[0], y - 3);
    }
    else if (b.pending > b.lvl) { // a small gold spark: this building is ready to be improved
      const p = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2), y = p[1] - heightOf(b, g.age) - 34 - Math.sin(st.T0 * 2 + b.x) * 2;
      ctx.fillStyle = '#f2c14e'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✦', p[0], y);
    }
  }
  // After dark, over the night tint: the warm pools of torch and lamp light, and the flames bright again on top.
  const lit = { sig: '', list: [] };
  function nightLights(g) {
    const d = st.dark; if (d < 0.1) return;
    // the torches and lamps, found again only when buildings come or go (or finish)
    const sig = g.buildings.length + ':' + g.buildings.reduce((n, b) => n + (b.done ? 1 : 0), 0);
    if (lit.sig !== sig) { lit.sig = sig; lit.list = g.buildings.filter(b => b.done && BUILD[b.k].flame); }
    for (const b of lit.list) { const F = BUILD[b.k].flame; if (!g.bmap.has(b.id)) continue;
      const c = iso(b.x, b.y), y = c[1] - (F === 1 ? 0.43 : 0.74) * UNIT, r = F === 1 ? 70 : 96, f = 1 + Math.sin(st.T0 * 11 + b.x) * 0.06;
      ctx.globalCompositeOperation = 'lighter';
      let gr = ctx.createRadialGradient(c[0], c[1], 2, c[0], c[1], r * f); gr.addColorStop(0, `rgba(255,170,80,${0.42 * d})`); gr.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(c[0], c[1], r * f, r * f / 2, 0, 0, 7); ctx.fill();
      gr = ctx.createRadialGradient(c[0], y, 1, c[0], y, 22); gr.addColorStop(0, `rgba(255,220,140,${0.7 * d})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c[0], y, 22, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      flame(c[0], F === 1 ? y : y + 4, F === 1 ? 1 : 0.7);
    }
  }
  return { DB, heightOf, drawBuilding, drawFire, bar, pen, herd, animal, HOME_LOOK, nightLights };
}
