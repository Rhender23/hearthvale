// Drawing. Reads the game state and the view; never changes the game.
import { N, TW, TH, BUILD, NODE, SEASON } from '../core/config.js';
import { idx, inMap, nodeKind, WATER, SAND } from '../core/world.js';
import { darkness, hour, isNight, seasonIndex } from '../core/state.js';
import { hash } from '../core/rng.js';

export const iso = (x, y) => [(x - y) * TW / 2, (x + y) * TH / 2];
const AW = [['#e8d2a6', '#d4b887'], ['#ece0c4', '#d8c6a0'], ['#efe6d6', '#d9ccb6'], ['#f3ecdf', '#ddd2bf']];
const RA = [['#c9684a', '#a9503a'], ['#b9583f', '#98432f'], ['#4e7ca0', '#3b6283'], ['#7a5aa0', '#5f4584']];
// One look per home level: wall pair, roof pair, wall height, roof height, extras.
const HOME_LOOK = [
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
const SG = [[134, 184, 98], [118, 170, 84], [178, 150, 76], [224, 233, 238]];
const SF = [[[90, 154, 74], [106, 173, 88], [123, 189, 104]], [[79, 143, 74], [95, 163, 85], [109, 177, 95]], [[201, 119, 47], [217, 152, 58], [229, 178, 74]], [[127, 154, 134], [169, 191, 176], [232, 240, 238]]];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
  let gc = SG[0], fol = SF[0].map(rgb), sea = 0, T0 = 0, ui_dark = 0, G = null;

  const dia = (cx, cy, hw, hh) => { ctx.beginPath(); ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath(); };
  const poly = (pts, f) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); };
  const upp = (p, u) => [p[0], p[1] - u], mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const cor = b => [iso(b.x - 0.5, b.y - 0.5), iso(b.x + b.s - 0.5, b.y - 0.5), iso(b.x + b.s - 0.5, b.y + b.s - 0.5), iso(b.x - 0.5, b.y + b.s - 0.5)];
  const box = (c, e, h, cl, cr, ct) => { const t = [c[0], c[1] - e * TH], r = [c[0] + e * TW, c[1]], d = [c[0], c[1] + e * TH], l = [c[0] - e * TW, c[1]]; poly([l, d, upp(d, h), upp(l, h)], cl); poly([d, r, upp(r, h), upp(d, h)], cr); poly([upp(t, h), upp(r, h), upp(d, h), upp(l, h)], ct); };
  const walls = (b, h, w) => { const [tp, rt, bt, lf] = cor(b); poly([lf, bt, upp(bt, h), upp(lf, h)], w[0]); poly([bt, rt, upp(rt, h), upp(bt, h)], w[1]); return [tp, rt, bt, lf]; };
  const door = (p, q, w, h, c) => { const d = mid(p, q), s = (q[1] - p[1]) / (q[0] - p[0]); poly([[d[0] - w, d[1] - s * w], [d[0] + w, d[1] + s * w], [d[0] + w, d[1] + s * w - h], [d[0] - w, d[1] - s * w - h]], c); };
  const heightOf = (b, age) => ({ tc: 38 + age * 7, house: HOME_LOOK[b.lvl || 0].h + HOME_LOOK[b.lvl || 0].rf - 20, store: 22 + (b.lvl || 0) * 6, lodge: 26 + age * 3, market: 34, monument: 80, lamppost: 30, arbor: 30, school: 46, studio: 30, theater: 40, tavern: 34, well: 16, statue: 34, bench: 6, potter: 22, carpenter: 22, weaver: 24, campfire: 4 }[b.k] || 0);

  const DB = {
    tc(b, age) {
      const h = heightOf(b, age), [tp, rt, bt, lf] = walls(b, h, AW[age]), ap = iso(b.x + 0.5, b.y + 0.5), ax = [ap[0], ap[1] - h - 34];
      poly([upp(lf, h), upp(bt, h), ax], RA[age][0]); poly([upp(bt, h), upp(rt, h), ax], RA[age][1]);
      const dp = iso(b.x + 1.5, b.y + 0.5); poly([[dp[0] - 9, dp[1]], [dp[0] + 9, dp[1] - 5], [dp[0] + 9, dp[1] - 27], [dp[0] - 9, dp[1] - 22]], '#7a5638');
      ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax[0], ax[1]); ctx.lineTo(ax[0], ax[1] - 30); ctx.stroke();
      poly([[ax[0], ax[1] - 30], [ax[0] + 18, ax[1] - 25 + Math.sin(T0 * 3) * 3], [ax[0], ax[1] - 19]], '#d9534f');
      if (age > 0) for (let i = 0; i < 3; i++) { const q = (T0 * 0.5 + i / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - q)})`; ctx.beginPath(); ctx.arc(ax[0] + 14 + Math.sin(q * 6) * 3, ax[1] + 14 - q * 34, 4 + q * 5, 0, 7); ctx.fill(); }
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
      box(iso(b.x + 0.62, b.y - 0.15), 0.1, 8, '#c99a5a', '#b3844a', '#dcb070'); if (lv >= 1) box(iso(b.x + 0.62, b.y + 0.2), 0.08, 6, '#9a6a3e', '#85582f', '#b88556');
    },
    lodge(b, age) { const h = heightOf(b, age), [tp, rt, bt, lf] = walls(b, h, ['#cdb48a', '#b99c72']), R1 = upp(mid(tp, rt), h + 24), R2 = upp(mid(lf, bt), h + 24), c = iso(b.x + 0.5, b.y + 0.5); poly([upp(lf, h), upp(bt, h), R2], '#cdb48a'); poly([upp(bt, h), upp(rt, h), R1, R2], '#4a7554'); door(lf, bt, 9, 18, '#5a4028'); box([c[0] - 14, c[1] - h - 10], 0.1, 22, '#8a7360', '#745f4e', '#a08a76'); box([c[0] + 12, c[1] - h - 6], 0.1, 26, '#8a7360', '#745f4e', '#a08a76'); },
    market(b) { const [tp, rt, bt, lf] = cor(b), h = 34, L = upp(lf, h), B = upp(bt, h), R = upp(rt, h), T = upp(tp, h); poly([tp, rt, bt, lf], '#d8b98a'); box(iso(b.x + 0.1, b.y + 0.9), 0.2, 12, '#c99a5a', '#b3844a', '#e3b660'); box(iso(b.x + 0.9, b.y + 0.1), 0.16, 9, '#9a6a3e', '#85582f', '#b88556'); ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 3; for (const p of [lf, bt, rt]) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - h); ctx.stroke(); } for (let i = 0; i < 6; i++) poly([lerp(L, B, i / 6), lerp(L, B, (i + 1) / 6), lerp(T, R, (i + 1) / 6), lerp(T, R, i / 6)], i % 2 ? '#f3e6c4' : '#c9553d'); },
    monument(b) { const c = iso(b.x + 0.5, b.y + 0.5), t = [c[0], c[1] - 80]; box(c, 0.95, 14, '#cfc7b8', '#b9b0a0', '#ddd6c8'); box([c[0], c[1] - 14], 0.62, 20, '#d8d1c3', '#c2baab', '#e6e0d3'); box([c[0], c[1] - 34], 0.34, 46, '#e6dfd2', '#cfc7b8', '#f1ece1'); poly([[t[0] - 0.34 * TW, t[1]], [t[0], t[1] + 0.34 * TH], [t[0], t[1] - 36]], '#d9a441'); poly([[t[0], t[1] + 0.34 * TH], [t[0] + 0.34 * TW, t[1]], [t[0], t[1] - 36]], '#b8862c'); },
    farm(b) { const c = iso(b.x + 0.5, b.y + 0.5); ctx.fillStyle = '#8a6a3e'; dia(c[0], c[1], TW, TH); ctx.fill(); ctx.strokeStyle = b.food > 0 ? (sea === 2 ? '#d9b44a' : sea === 3 ? '#a89a80' : '#8fbf55') : '#6a5030'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = iso(b.x - 0.35 + i * 0.5, b.y - 0.35), e = iso(b.x - 0.35 + i * 0.5, b.y + 1.35); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); } },
    well(b) {
      const c = iso(b.x, b.y);
      if ((b.lvl || 0) >= 1) { // fountain
        box(c, 0.42, 8, '#c9c2b4', '#b2ab9c', '#7fb3d0');
        box([c[0], c[1] - 8], 0.12, 18, '#ddd6c8', '#c9c2b4', '#e6e0d3');
        ctx.strokeStyle = 'rgba(180,220,245,.9)'; ctx.lineWidth = 2;
        for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(c[0], c[1] - 26); ctx.quadraticCurveTo(c[0] + s2 * 10, c[1] - 30 - Math.sin(T0 * 4) * 2, c[0] + s2 * 14, c[1] - 6); ctx.stroke(); }
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
      [['#e86a8a', -10, -1], ['#f2c94c', -3, 3], ['#b58be0', 5, -2], ['#ffffff', 11, 1], ['#e86a8a', 2, -5], ['#f08fa4', -6, -5]].forEach(([q, dx, dy]) => { ctx.fillStyle = '#5f9a4a'; ctx.fillRect(c[0] + dx - 0.5, c[1] + dy - 4, 1.5, 5); ctx.fillStyle = sea === 3 ? '#e8eef0' : q; ctx.beginPath(); ctx.arc(c[0] + dx, c[1] + dy - 5, 2.8, 0, 7); ctx.fill(); });
    },
    bench(b) {
      const c = iso(b.x, b.y);
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2;
      for (const dx of [-12, 12]) { ctx.beginPath(); ctx.moveTo(c[0] + dx, c[1] + dx * -0.25); ctx.lineTo(c[0] + dx, c[1] + dx * -0.25 - 7); ctx.stroke(); }
      poly([[c[0] - 15, c[1] - 4], [c[0] + 15, c[1] - 11], [c[0] + 15, c[1] - 7], [c[0] - 15, c[1]]], '#a8784a');
      poly([[c[0] - 15, c[1] - 12], [c[0] + 15, c[1] - 19], [c[0] + 15, c[1] - 15], [c[0] - 15, c[1] - 8]], '#94673e');
    },
    path(b) { const c = iso(b.x, b.y); ctx.fillStyle = '#cfc4ad'; dia(c[0], c[1], TW / 2 - 1, TH / 2 - 0.5); ctx.fill(); ctx.fillStyle = '#bdb19a'; for (const [dx, dy] of [[-10, 0], [8, -3], [0, 5], [-2, -6], [12, 4]]) { ctx.beginPath(); ctx.ellipse(c[0] + dx, c[1] + dy, 5, 2.6, 0, 0, 7); ctx.fill(); } },
    lamppost(b) {
      const c = iso(b.x, b.y), lit = ui_dark > 0.2;
      if (lit) { const gr = ctx.createRadialGradient(c[0], c[1] - 28, 2, c[0], c[1] - 20, 30); gr.addColorStop(0, 'rgba(255,214,130,0.55)'); gr.addColorStop(1, 'rgba(255,214,130,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c[0], c[1] - 20, 30, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#4a4a52'; ctx.fillRect(c[0] - 4, c[1] - 3, 8, 3); ctx.fillRect(c[0] - 1.5, c[1] - 26, 3, 24);
      ctx.fillStyle = lit ? '#ffe2a0' : '#e8e0c8'; ctx.fillRect(c[0] - 4, c[1] - 33, 8, 8);
      ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 1.2; ctx.strokeRect(c[0] - 4, c[1] - 33, 8, 8);
      poly([[c[0] - 6, c[1] - 33], [c[0], c[1] - 38], [c[0] + 6, c[1] - 33]], '#3a3a42');
    },
    arbor(b) {
      const c = iso(b.x, b.y), win = sea === 3;
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
      const nightGlow = ui_dark > 0.3 ? '#ffd27a' : '#f3e6c4';
      door(lf, bt, 6, 8, nightGlow); const wp = lerp(bt, rt, 0.78); poly([[wp[0] - 6, wp[1] - 14], [wp[0] + 6, wp[1] - 17], [wp[0] + 6, wp[1] - 25], [wp[0] - 6, wp[1] - 22]], nightGlow);
      const sp = lerp(bt, rt, 0.2); ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sp[0], sp[1] - h + 4); ctx.lineTo(sp[0] + 14, sp[1] - h + 1); ctx.stroke();
      poly([[sp[0] + 6, sp[1] - h + 3], [sp[0] + 16, sp[1] - h + 1], [sp[0] + 16, sp[1] - h + 11], [sp[0] + 6, sp[1] - h + 13]], '#d9a441');
    },
    campfire(b) {
      const lv = b.lvl || 0, c = iso(b.x, b.y);
      if (lv >= 1) for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + 0.3, p = [c[0] + Math.cos(a) * 24, c[1] + Math.sin(a) * 11]; ctx.fillStyle = '#8a6a44'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 7, 3.2, a, 0, 7); ctx.fill(); ctx.fillStyle = '#a8845a'; ctx.beginPath(); ctx.ellipse(p[0] + 4 * Math.cos(a), p[1] + 2 * Math.sin(a), 2.4, 2, 0, 0, 7); ctx.fill(); }
      drawFire(G);
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
      door(bt, rt, 5, 12, '#6a4a2c'); door(lf, bt, 5, 7, ui_dark > 0.3 ? '#ffd27a' : '#bcd6e6');
      const t = lerp(R2, R1, 0.5); box([t[0], t[1] + 4], 0.09, 12, '#efe2c6', '#d9c8a6', '#b5523e');
      ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.arc(t[0], t[1] - 4, 2.6, 0, 7); ctx.fill();
      poly([[t[0] - 7, t[1] - 8], [t[0], t[1] - 17], [t[0] + 7, t[1] - 8]], '#9a4232');
    },
    studio(b) {
      const h = 18, [tp, rt, bt, lf] = walls(b, h, ['#e6d8e8', '#cdbcd2']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 14];
      poly([upp(lf, h), upp(bt, h), ap], '#5f7f9a'); poly([upp(bt, h), upp(rt, h), ap], '#4e6c85');
      poly([lerp(upp(bt, h), ap, 0.25), lerp(upp(rt, h), ap, 0.25), lerp(upp(rt, h), ap, 0.6), lerp(upp(bt, h), ap, 0.6)], ui_dark > 0.3 ? '#ffd27a' : '#bfe0ee'); // skylight
      door(lf, bt, 5, 12, '#6a4a2c');
      const e = [c[0] + 22, c[1] + 6]; ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(e[0] - 5, e[1]); ctx.lineTo(e[0], e[1] - 18); ctx.lineTo(e[0] + 5, e[1]); ctx.moveTo(e[0], e[1] - 18); ctx.lineTo(e[0] + 1, e[1] + 1); ctx.stroke();
      ctx.fillStyle = '#fbf6ea'; ctx.fillRect(e[0] - 6, e[1] - 16, 12, 9);
      for (const [dx, dy, q] of [[-3, -13, '#e86a8a'], [1, -11, '#4f9a7a'], [3, -14, '#f2c94c']]) { ctx.fillStyle = q; ctx.beginPath(); ctx.arc(e[0] + dx, e[1] + dy, 1.8, 0, 7); ctx.fill(); }
    },
    theater(b) {
      const [tp, rt, bt, lf] = cor(b), c = iso(b.x + 0.5, b.y + 0.5), lit = ui_dark > 0.3;
      poly([tp, rt, bt, lf], '#c9b48e');
      const back = [lerp(lf, tp, 0.15), lerp(tp, rt, 0.85)], h = 36;
      poly([back[0], back[1], upp(back[1], h), upp(back[0], h)], '#7a4a3a');           // back wall
      poly([upp(back[0], h), upp(back[1], h), upp(back[1], h + 12), upp(mid(back[0], back[1]), h + 22), upp(back[0], h + 12)], '#8a5a3a');
      const st = [lerp(lf, tp, 0.15), lerp(tp, rt, 0.85), lerp(rt, bt, 0.45), lerp(lf, bt, 0.45)];
      poly([st[3], st[2], upp(st[2], 6), upp(st[3], 6)], '#9a6a3e'); poly(st.map(p => upp(p, 6)), lit ? '#e8c98a' : '#c99a5a'); // stage
      for (const [f, f2] of [[0.02, 0.22], [0.98, 0.78]]) { const p = lerp(back[0], back[1], f), p2 = lerp(back[0], back[1], f2), q = lerp(st[3], st[2], f); poly([upp(p, 6), upp(p2, 6), upp(p2, h), upp(p, h)], '#b03a3a'); ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] - h); ctx.stroke(); }
      for (let i = 0; i < 5; i++) { const p = upp(lerp(back[0], back[1], 0.1 + i * 0.2), h + 4); ctx.fillStyle = ['#f2c94c', '#e86a8a', '#4f9a7a', '#b58be0', '#5aa9e6'][i]; poly([[p[0] - 4, p[1]], [p[0] + 4, p[1] - 2], [p[0], p[1] + 7]], ctx.fillStyle); }
      if (lit) { const gr = ctx.createRadialGradient(c[0], c[1] - 14, 4, c[0], c[1] - 10, 50); gr.addColorStop(0, 'rgba(255,214,130,0.35)'); gr.addColorStop(1, 'rgba(255,214,130,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c[0], c[1] - 10, 50, 0, 7); ctx.fill(); }
    },
    potter(b) {
      const h = 18, [tp, rt, bt, lf] = walls(b, h, ['#d9b48a', '#c49c70']), c = iso(b.x, b.y), ap = [c[0], c[1] - h - 16];
      poly([upp(lf, h), upp(bt, h), ap], '#a8603a'); poly([upp(bt, h), upp(rt, h), ap], '#8e4e2e'); door(bt, rt, 5, 12, '#6a4a2c');
      ctx.fillStyle = '#b5643c'; ctx.beginPath(); ctx.ellipse(c[0] - 18, c[1] + 2, 7, 5, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(c[0] - 25, c[1] + 1, 14, 3); // kiln
      for (const [dx, col] of [[14, '#c97a4a'], [20, '#a85a34']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(c[0] + dx, c[1] + 8, 3.5, 4.5, 0, 0, 7); ctx.fill(); }
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
      for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) { const p = iso(b.x - 0.3 + i * 0.5, b.y - 0.3 + j * 0.42); ctx.strokeStyle = '#6f9a50'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 7); ctx.stroke(); if (b.food > 0 && sea < 3) { ctx.fillStyle = '#7fa6e0'; ctx.beginPath(); ctx.arc(p[0], p[1] - 8, 2, 0, 7); ctx.fill(); } }
    },
    garden(b) { const c = iso(b.x, b.y); ctx.fillStyle = '#7fae5a'; dia(c[0], c[1], TW / 2 - 3, TH / 2 - 2); ctx.fill(); [['#e86a8a', -9, -2], ['#f2c94c', 0, 3], ['#b58be0', 9, -1], ['#ffffff', -3, -5]].forEach(([q, dx, dy]) => { ctx.fillStyle = sea === 3 ? '#e8eef0' : q; ctx.beginPath(); ctx.arc(c[0] + dx, c[1] + dy, 3.2, 0, 7); ctx.fill(); }); },
  };

  function bar(b, age, g) {
    const p = iso(b.x + (b.s - 1) / 2, b.y + (b.s - 1) / 2), y = p[1] - heightOf(b, age) - 40, w = 46, q = Math.min(1, b.prog / b.time);
    const active = g.villagers.some(v => v.act && v.act.type === 'build' && v.act.b === b.id && v.act.phase === 'work');
    ctx.fillStyle = 'rgba(60,45,30,.55)'; ctx.beginPath(); ctx.roundRect(p[0] - w / 2, y, w, 8, 4); ctx.fill();
    ctx.fillStyle = active ? '#f2c14e' : '#b9ab8c'; ctx.beginPath(); ctx.roundRect(p[0] - w / 2 + 1, y + 1, Math.max(0, (w - 2) * q), 6, 3); ctx.fill();
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(active ? '🔨' : '⏸️', p[0], y - 3);
  }
  function drawBuilding(b, g) {
    ctx.globalAlpha = b.done ? 1 : 0.4 + 0.6 * b.prog / b.time;
    DB[b.k](b, g.age);
    ctx.globalAlpha = 1;
    if (!b.done) bar(b, g.age, g);
    else if (b.pending > b.lvl) { // a small gold spark: this building is ready to be improved
      const p = iso(b.x + (b.s - 1) / 2, b.y + (b.s - 1) / 2), y = p[1] - heightOf(b, g.age) - 34 - Math.sin(T0 * 2 + b.x) * 2;
      ctx.fillStyle = '#f2c14e'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✦', p[0], y);
    }
  }
  function drawTree(x, y, amt, grow = 1) {
    const [sx, sy] = iso(x, y), s = (0.7 + 0.3 * amt / 40) * grow, sw = Math.sin(T0 * 1.3 + x * 0.9) * 1.2;
    ctx.fillStyle = 'rgba(40,70,40,.22)'; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 16 * s, 7 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a5638'; ctx.fillRect(sx - 3 * grow, sy - 14 * s, 6 * grow, 16 * s);
    [[0, -24, 15, fol[0]], [sw - 3, -34, 12, fol[1]], [sw + 3, -27, 11, fol[2]]].forEach(([a, b2, r, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx + a * s, sy + b2 * s, r * s, 0, 7); ctx.fill(); });
  }
  function drawNode(g, x, y) {
    const i = idx(x, y), k = nodeKind(g.w, i);
    if (k === NODE.TREE) return drawTree(x, y, g.w.A[i]);
    const [sx, sy] = iso(x, y);
    if (k === NODE.FISH) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; const p = (T0 * 0.6 + x * 0.37) % 1; ctx.beginPath(); ctx.ellipse(sx, sy, 6 + p * 10, 3 + p * 5, 0, 0, 7); ctx.stroke(); ctx.fillStyle = '#f4b86a'; ctx.beginPath(); ctx.ellipse(sx + Math.sin(T0 * 2 + x) * 5, sy, 5, 2.5, 0, 0, 7); ctx.fill(); return; }
    ctx.fillStyle = 'rgba(40,60,40,.22)'; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 14, 6, 0, 0, 7); ctx.fill();
    if (k === NODE.BERRY) { [[-7, -5], [6, -6], [0, -12]].forEach(([a, b]) => { ctx.fillStyle = sea === 3 ? '#7f9a86' : '#4f8f4a'; ctx.beginPath(); ctx.arc(sx + a, sy + b, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#d6455d'; ctx.beginPath(); ctx.arc(sx + a + 2, sy + b, 2.5, 0, 7); ctx.fill(); }); return; }
    if (k === NODE.CLAY) { ctx.fillStyle = '#a8603a'; ctx.beginPath(); ctx.ellipse(sx, sy - 2, 13, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#7d4428'; ctx.beginPath(); ctx.ellipse(sx + 2, sy - 2, 7, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#c47a4e'; ctx.beginPath(); ctx.arc(sx - 8, sy - 6, 4, 0, 7); ctx.fill(); return; }
    const c = k === NODE.STONE ? ['#a9a49a', '#c9c4b8'] : ['#c98a3a', '#f0c860'];
    [[-6, -4, 8], [6, -5, 7], [0, -10, 9]].forEach(([a, b, r], j) => { ctx.fillStyle = c[j % 2]; ctx.beginPath(); ctx.arc(sx + a, sy + b, r, 0, 7); ctx.fill(); });
  }
  // The traveling merchant: a rider in a teal cloak and wide hat on a horse, pulling something that grows with the age:
  // a pack mule (Hamlet), a small cart (Village), a covered wagon (Town), a painted wagon with a pennant (Township).
  function drawCaravan(m) {
    const [sx, sy] = iso(m.x, m.y), d = m.dir || 1, moving = m.path && m.path.length, bob = moving ? Math.abs(Math.sin(T0 * 9)) * -2 : 0, back = -d;
    const wx = sx + back * 26, wy = sy - back * 4;
    ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.beginPath(); ctx.ellipse(sx + back * 12, sy + 2, 30, 7, 0, 0, 7); ctx.fill();
    const age = m.age || 0;
    if (age === 0) { // pack mule with bundles
      ctx.fillStyle = '#8f8a80'; ctx.beginPath(); ctx.roundRect(wx - 9, wy - 14 + bob, 18, 8, 4); ctx.fill(); ctx.fillRect(wx - 7, wy - 7, 2, 7); ctx.fillRect(wx + 5, wy - 7, 2, 7);
      ctx.fillStyle = '#c9a171'; ctx.beginPath(); ctx.arc(wx - 4, wy - 17 + bob, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#a85a34'; ctx.beginPath(); ctx.arc(wx + 4, wy - 17 + bob, 5, 0, 7); ctx.fill();
    } else { // cart or wagon
      const w = age >= 2 ? 24 : 18, h = age >= 2 ? 10 : 7;
      ctx.fillStyle = '#7a5638'; ctx.fillRect(wx - w / 2, wy - 10 - h, w, h);
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 2; for (const ox of [-w / 3, w / 3]) { ctx.beginPath(); ctx.arc(wx + ox, wy - 5, 5, 0, 7); ctx.stroke(); }
      if (age === 1) { ctx.fillStyle = '#c9a171'; ctx.beginPath(); ctx.arc(wx - 4, wy - 13 - h, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#9ab06a'; ctx.beginPath(); ctx.arc(wx + 4, wy - 13 - h, 4, 0, 7); ctx.fill(); }
      if (age >= 2) { ctx.fillStyle = age >= 3 ? '#e6c870' : '#efe6d6'; ctx.beginPath(); ctx.moveTo(wx - w / 2, wy - 10 - h); ctx.quadraticCurveTo(wx, wy - 34 - h, wx + w / 2, wy - 10 - h); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(120,90,60,.5)'; ctx.lineWidth = 1; ctx.stroke(); }
      if (age >= 3) { ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + w / 2, wy - 10 - h); ctx.lineTo(wx + w / 2, wy - 40 - h); ctx.stroke(); poly([[wx + w / 2, wy - 40 - h], [wx + w / 2 + 14, wy - 36 - h + Math.sin(T0 * 4) * 2], [wx + w / 2, wy - 32 - h]], '#3f8f8a'); }
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + d * w / 2, wy - 12); ctx.lineTo(sx - d * 6, sy - 12); ctx.stroke();
    }
    // horse
    ctx.fillStyle = '#7a4e2e'; ctx.beginPath(); ctx.roundRect(sx - 11, sy - 18 + bob, 22, 9, 4); ctx.fill();
    for (const ox of [-8, -3, 4, 8]) ctx.fillRect(sx + ox, sy - 10, 2, 10 - (moving && ox % 2 ? Math.abs(Math.sin(T0 * 9)) * 3 : 0));
    ctx.beginPath(); ctx.moveTo(sx + d * 9, sy - 15 + bob); ctx.lineTo(sx + d * 17, sy - 25 + bob); ctx.lineTo(sx + d * 20, sy - 22 + bob); ctx.lineTo(sx + d * 12, sy - 12 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a2e1c'; ctx.fillRect(sx + d * 10 - 1, sy - 22 + bob, 2, 6);
    // rider: teal cloak, wide-brimmed hat, distinct from villagers
    ctx.fillStyle = '#2f7f7a'; ctx.beginPath(); ctx.roundRect(sx - 5, sy - 31 + bob, 10, 13, 4); ctx.fill();
    ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.arc(sx, sy - 34 + bob, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(sx, sy - 37 + bob, 10, 3, 0, 0, 7); ctx.fill(); ctx.fillRect(sx - 4, sy - 43 + bob, 8, 6);
  }
  function drawSapling(g, x, y) { const grow = 0.35 + 0.65 * Math.min(1, g.w.G[idx(x, y)] / 150); drawTree(x, y, 20, grow * 0.8); }
  function drawFire(g) {
    const f = g.w.fire, p = iso(f.x, f.y), h = hour(g), lit = h >= 18.5 || h < 6.5;
    ctx.fillStyle = 'rgba(40,60,40,.22)'; ctx.beginPath(); ctx.ellipse(p[0], p[1] + 2, 14, 6, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; ctx.fillStyle = i % 2 ? '#9a948a' : '#b4aea2'; ctx.beginPath(); ctx.arc(p[0] + Math.cos(a) * 11, p[1] + Math.sin(a) * 5, 3.2, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p[0] - 7, p[1] + 2); ctx.lineTo(p[0] + 7, p[1] - 3); ctx.moveTo(p[0] - 7, p[1] - 3); ctx.lineTo(p[0] + 7, p[1] + 2); ctx.stroke();
    if (lit) { const fl = Math.sin(T0 * 13) * 2; ctx.fillStyle = '#f2a33a'; ctx.beginPath(); ctx.moveTo(p[0] - 6, p[1]); ctx.quadraticCurveTo(p[0] - 4, p[1] - 14 + fl, p[0], p[1] - 20 + fl); ctx.quadraticCurveTo(p[0] + 4, p[1] - 14 - fl, p[0] + 6, p[1]); ctx.fill(); ctx.fillStyle = '#ffd873'; ctx.beginPath(); ctx.moveTo(p[0] - 3, p[1]); ctx.quadraticCurveTo(p[0], p[1] - 10, p[0] + 3, p[1]); ctx.fill(); }
  }
  function drawVillager(g, v, ui, ghost) {
    if (v.inside) return;
    const [sx, sy] = iso(v.x, v.y), sel = ui.sel.has(v);
    if (v.act && v.act.type === 'sleep' && v.act.phase === 'sleep') {
      ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 13, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = v.col; ctx.beginPath(); ctx.roundRect(sx - 10, sy - 7, 20, 8, 4); ctx.fill();
      ctx.fillStyle = v.skin || '#c08a5d'; ctx.beginPath(); ctx.arc(sx - 12, sy - 4, 5, 0, 7); ctx.fill(); ctx.fillStyle = v.hair || '#3d2b20'; ctx.beginPath(); ctx.arc(sx - 14, sy - 5, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', sx + 3, sy - 13 - Math.sin(T0 * 2 + v.x) * 3);
      return;
    }
    const bob = v.moving ? Math.abs(Math.sin(T0 * 12)) * -2.5 : 0;
    if (!ghost) { ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 8, 4, 0, 0, 7); ctx.fill(); }
    if (sel) { ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 13, 6.5, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = v.col; ctx.beginPath(); ctx.roundRect(sx - 5, sy - 17 + bob, 10, 14, 4); ctx.fill();
    ctx.fillStyle = v.skin || '#c08a5d'; ctx.beginPath(); ctx.arc(sx, sy - 21 + bob, 5, 0, 7); ctx.fill();
    ctx.fillStyle = v.hair || '#3d2b20'; ctx.beginPath(); ctx.ellipse(sx, sy - 24 + bob, 6.5, 2.6, 0, 0, 7); ctx.fill();
    const working = v.act && !v.moving && (v.act.phase === 'work') && ['gather', 'build', 'farm', 'plant', 'water', 'upgrade', 'craft'].includes(v.act.type);
    if (working) { const a = Math.sin(T0 * 14) * 0.8; ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx + 5 * v.dir, sy - 12); ctx.lineTo(sx + (5 + 9 * Math.cos(a)) * v.dir, sy - 12 - 9 * Math.sin(a) - 4); ctx.stroke(); }
    if (v.carry > 0) { ctx.fillStyle = ({ clay: '#a8603a', fiber: '#7fa6e0', pottery: '#c97a4a', cloth: '#efe6d6', furniture: '#9a6a3e' })[v.carryRes] || (v.carryRes === 'food' ? '#c9553d' : v.carryRes === 'water' ? '#5aa9e6' : null) || v.carryRes === 'stone' ? '#a9a49a' : v.carryRes === 'gold' ? '#e0b040' : '#9a6a3e'; ctx.fillRect(sx - 9 * v.dir - 3, sy - 13 + bob, 6, 6); }
    if (sel && !ghost) { ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,45,30,.8)'; ctx.fillStyle = '#fff'; ctx.strokeText(v.name, sx, sy - 33); ctx.fillText(v.name, sx, sy - 33); }
  }
  // A villager is hidden when a taller building is drawn in front of it.
  function occluded(g, v) {
    const pv = iso(v.x, v.y), dv = v.x + v.y;
    return g.buildings.some(b => {
      if (BUILD[b.k].flat) return false;
      if (b.x + b.y + b.s - 1 <= dv) return false;
      const pc = iso(b.x + (b.s - 1) / 2, b.y + (b.s - 1) / 2), h = heightOf(b, g.age) + 30;
      return Math.abs(pv[0] - pc[0]) < b.s * TW / 2 - 4 && pv[1] < pc[1] + b.s * TH / 2 && pv[1] > pc[1] - b.s * TH / 2 - h;
    });
  }

  function seasonColors(g) {
    const sp = g.clock / SEASON, si = Math.floor(sp) % 4, sj = (si + 1) % 4, fr = Math.max(0, (sp % 1 - 0.8) / 0.2);
    sea = si; gc = mix(SG[si], SG[sj], fr); fol = SF[si].map((c, i) => rgb(mix(c, SF[sj][i], fr)));
  }

  function draw(g, view, ui, now) {
    T0 = now / 1000; seasonColors(g); ui_dark = darkness(g); G = g;
    const { W, H, dpr, cam } = view, Z = cam.z, w = g.w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2); ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
    const x0 = cam.x - W / 2 / Z - TW, x1 = cam.x + W / 2 / Z + TW, y0 = cam.y - H / 2 / Z - 90, y1 = cam.y + H / 2 / Z + TH + 90;
    const objs = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [sx, sy] = iso(x, y);
      if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue;
      const i = idx(x, y), t = w.T[i], hh = hash(x, y) * 12;
      let c;
      if (t === WATER) { const s = Math.sin(T0 * 1.4 + x * 0.8 + y * 0.5) * 7; c = `rgb(${104 + s | 0},${172 + s | 0},${198 + s | 0})`; }
      else if (t === SAND) c = `rgb(${228 + hh / 2 | 0},${208 + hh / 2 | 0},156)`;
      else c = `rgb(${gc[0] + hh | 0},${gc[1] + hh | 0},${gc[2] + hh / 2 | 0})`;
      ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1; dia(sx, sy, TW / 2, TH / 2); ctx.fill(); ctx.stroke();
      if (w.road[i]) { // the merchant road: packed earth with two faint wheel ruts
        ctx.fillStyle = sea === 3 ? '#d9d4c8' : '#b89a6c'; dia(sx, sy, TW / 2 - 3, TH / 2 - 1.5); ctx.fill();
        ctx.fillStyle = sea === 3 ? '#c9c2b4' : '#a3875c'; for (const [dx, dy] of [[-12, -1], [10, 2], [-2, 4], [4, -4]]) { ctx.beginPath(); ctx.ellipse(sx + dx + (hash(x, y) - 0.5) * 6, sy + dy, 4, 1.8, 0, 0, 7); ctx.fill(); }
      }
      if (t === 0 && w.A[i] <= 0 && w.occ[i] === 0 && hash(x + 5, y + 9) > 0.82) { const q = hash(x, y + 3); ctx.fillStyle = sea === 3 ? '#ffffff' : q < 0.33 ? '#f4d35e' : q < 0.66 ? '#f08fa4' : '#c7a6ee'; ctx.beginPath(); ctx.arc(sx + (hash(x, y) - 0.5) * 20, sy + (hash(y, x) - 0.5) * 8, 2.2, 0, 7); ctx.fill(); }
      if (w.A[i] > 0 && w.R[i]) objs.push([x + y, 0, x, y]);
      else if (w.G[i] > 0) objs.push([x + y, 4, x, y]);
    }
    // Beauty overlay: untinted = neutral, rose = beautiful (deeper = lovelier), blue = unsightly
    if (ui.overlay === 'beauty' && g.beauty) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = g.beauty[idx(x, y)];
        if (Math.abs(v) < 0.15) continue;
        const [sx, sy] = iso(x, y);
        if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue;
        ctx.fillStyle = v > 0 ? `rgba(226,${Math.max(40, 120 - v * 12) | 0},${Math.max(90, 170 - v * 8) | 0},${Math.min(0.75, 0.15 + v * 0.09)})` : `rgba(70,100,210,${Math.min(0.7, 0.15 - v * 0.15)})`;
        dia(sx, sy, TW / 2, TH / 2); ctx.fill();
      }
    }
    if (ui.selN) { const p = iso(ui.selN.i % N, (ui.selN.i / N) | 0); ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 3; dia(p[0], p[1], TW / 2 - 2, TH / 2 - 1); ctx.stroke(); }
    // Overlays on the ground: placement ghost, hover, selection
    if (ui.place) {
      const s = BUILD[ui.place].size, okp = ui.canPlace(ui.hover[0], ui.hover[1]);
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const [gx, gy] = iso(ui.hover[0] + i, ui.hover[1] + j); ctx.fillStyle = okp ? 'rgba(255,255,200,.55)' : 'rgba(220,70,60,.5)'; dia(gx, gy, TW / 2, TH / 2); ctx.fill(); }
    } else if (ui.hoverCells) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; for (const [cx, cy] of ui.hoverCells) { const p = iso(cx, cy); dia(p[0], p[1], TW / 2 - 2, TH / 2 - 1); ctx.stroke(); } }
    if (ui.selB) { ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 3; const b = ui.selB; for (let j = 0; j < b.s; j++) for (let i = 0; i < b.s; i++) { const p = iso(b.x + i, b.y + j); dia(p[0], p[1], TW / 2 - 2, TH / 2 - 1); ctx.stroke(); } }

    for (const b of g.buildings) objs.push([b.x + b.y + b.s - 1, 1, b]);
    for (const v of g.villagers) objs.push([v.x + v.y + 0.01, 2, v]);
    if (g.merchant && g.merchant.visit) objs.push([g.merchant.visit.x + g.merchant.visit.y + 0.02, 5, g.merchant.visit]);
    objs.sort((a, b) => a[0] - b[0]);
    for (const o of objs) {
      if (o[1] === 0) drawNode(g, o[2], o[3]);
      else if (o[1] === 1) drawBuilding(o[2], g);
      else if (o[1] === 2) drawVillager(g, o[2], ui);
      else if (o[1] === 3) drawFire(g);
      else if (o[1] === 5) drawCaravan(o[2]);
      else drawSapling(g, o[2], o[3]);
    }
    // Villagers behind buildings show through faintly.
    for (const v of g.villagers) if (!v.inside && occluded(g, v)) { ctx.globalAlpha = 0.5; drawVillager(g, v, ui, true); ctx.globalAlpha = 1; }
    // Rally flag while the town center is selected.
    if (g.rally && ui.selB && (ui.selB.k === 'tc' || ui.selB.k === 'campfire')) {
      const r = g.rally, rb = r.type === 'farm' ? g.bmap.get(r.id) : null;
      const q = r.type === 'tile' ? [r.x, r.y] : r.type === 'node' ? [r.i % N, (r.i / N) | 0] : rb ? [rb.x + 0.5, rb.y + 0.5] : null;
      if (q) { const p = iso(q[0], q[1]); ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 26); ctx.stroke(); poly([[p[0], p[1] - 26], [p[0] + 14, p[1] - 21], [p[0], p[1] - 16]], '#e86a5a'); }
    }
    // Command ping
    if (ui.ping) { const q = (now - ui.ping.t) / 700; if (q >= 1) ui.ping = null; else { const p = iso(ui.ping.x, ui.ping.y); ctx.strokeStyle = ui.ping.c; ctx.globalAlpha = 1 - q; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p[0], p[1], 10 + q * 22, 5 + q * 11, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; } }
    // Butterflies on mild days
    const nt = darkness(g);
    if (sea < 3 && nt < 0.6) for (let i = 0; i < 8; i++) { const s = i * 1.7, c = w.tc, p = iso(c.x + Math.sin(g.clock * 0.11 + s) * 9 + Math.sin(s * 5) * 6, c.y + Math.cos(g.clock * 0.09 + s * 1.3) * 9 + Math.cos(s * 3) * 6), wg = 1.5 + Math.abs(Math.sin(T0 * 14 + s * 3)) * 2.5, hy = p[1] - 18 - Math.sin(T0 * 2 + s) * 5; ctx.fillStyle = ['#f4a0b5', '#f4d35e', '#9ac8f0', '#c7a6ee'][i % 4]; ctx.beginPath(); ctx.ellipse(p[0] - 3, hy, 3, wg, -0.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(p[0] + 3, hy, 3, wg, 0.5, 0, 7); ctx.fill(); }
    // Night
    if (nt > 0.05) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = `rgba(18,28,70,${0.5 * nt})`; ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2); ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of g.buildings) { if (!b.done || BUILD[b.k].flat || BUILD[b.k].decor || b.k === 'monument' || b.k === 'well' || b.k === 'campfire') continue; const p = iso(b.x + (b.s - 1) / 2, b.y + (b.s - 1) / 2), gr = ctx.createRadialGradient(p[0], p[1] - 14, 2, p[0], p[1] - 14, 46); gr.addColorStop(0, `rgba(255,190,90,${0.2 * nt})`); gr.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = gr; ctx.fillRect(p[0] - 46, p[1] - 62, 92, 92); }
      { const p = iso(w.fire.x, w.fire.y), gr = ctx.createRadialGradient(p[0], p[1] - 6, 2, p[0], p[1] - 6, 70); gr.addColorStop(0, `rgba(255,170,70,${0.45 * nt})`); gr.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = gr; ctx.fillRect(p[0] - 70, p[1] - 76, 140, 140); }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (isNight(g)) for (const b of g.buildings) if (b.sleepers > 0) { const p = iso(b.x + (b.s - 1) / 2, b.y + (b.s - 1) / 2); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', p[0] + 10, p[1] - 50 - Math.sin(T0 * 2 + b.x) * 3); }
  }
  return { draw, iso };
}
