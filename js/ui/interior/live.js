import { paintFlag, DEFAULT_FLAG } from '../flag.js';
// What is drawn live on top of the rendered room: light and dark, the sky in the windows, sunbeams, fire, candles,
// pictures and shelves on the walls, rugs, food on the table, the water in the barrel, steam, and the moving parts of
// work (the potter's wheel, the loom's shuttle, the forge). All positions in metres; V is the room's view (iso.js).
import { shade } from './people.js';

const lerpC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// The sky through the window by the hour.
export function skyColour(h) {
  if (h < 5 || h >= 21) return '#1e2a50';
  if (h < 7) return '#f2b98a';
  if (h < 18) return '#a8d4f0';
  if (h < 20) return '#f0a878';
  return '#3a3a70';
}
export function windowsSky(ctx, V, wins, h, T) {
  const sky = skyColour(h), night = h < 5 || h >= 21;
  for (const w of wins) {
    V.onBack(ctx, 0.07);
    ctx.globalAlpha = 0.72; ctx.fillStyle = sky; ctx.fillRect(w.x - w.w / 2, w.y, w.w, w.h);
    if (night) { ctx.fillStyle = '#f3ecc8'; ctx.beginPath(); ctx.arc(w.x + w.w * 0.22, w.y + w.h * 0.72, 0.06, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) ctx.fillRect(w.x - w.w / 2 + ((i * 37) % 70) / 100 * w.w, w.y + ((i * 53) % 90) / 100 * w.h, 0.012, 0.012); }
    else if (h >= 7 && h < 18) { ctx.fillStyle = 'rgba(120,170,90,.8)'; ctx.fillRect(w.x - w.w / 2, w.y, w.w, w.h * 0.18); }
    ctx.globalAlpha = 1; V.reset(ctx);
  }
}
// Daylight falling through each window onto the floor.
export function sunbeams(ctx, V, wins, h) {
  if (h < 7 || h >= 18) return;
  const a = 0.13 * Math.sin(Math.PI * (h - 7) / 11);
  V.onFloor(ctx);
  ctx.fillStyle = `rgba(255,240,190,${a})`;
  for (const w of wins) { const sk = (h - 12.5) * 0.12; ctx.beginPath(); ctx.moveTo(w.x - w.w / 2, 0.05); ctx.lineTo(w.x + w.w / 2, 0.05); ctx.lineTo(w.x + w.w / 2 + sk, 1.4); ctx.lineTo(w.x - w.w / 2 + sk, 1.4); ctx.fill(); }
  V.reset(ctx);
}
// A flame at a point (metres), size in metres.
export function flame(ctx, V, x, y, z, size, T, glows) {
  const [px, py] = V.pt(x, y, z), m = V.m * size, f = Math.sin(T * 9 + x) * 0.08;
  ctx.fillStyle = '#f2a33a'; ctx.beginPath(); ctx.moveTo(px - 0.3 * m, py); ctx.quadraticCurveTo(px - 0.2 * m, py - 0.5 * m + f * m, px, py - 0.85 * m + f * m); ctx.quadraticCurveTo(px + 0.2 * m, py - 0.5 * m - f * m, px + 0.3 * m, py); ctx.fill();
  ctx.fillStyle = '#ffd873'; ctx.beginPath(); ctx.moveTo(px - 0.15 * m, py); ctx.quadraticCurveTo(px, py - 0.45 * m, px + 0.15 * m, py); ctx.fill();
  if (glows) glows.push([px, py - 0.3 * m, 6 * m]);
}
// The hearth's fire, burning low by day and bright in the evening and at mealtimes.
export function hearthFire(ctx, V, hs, h, T, glows) {
  if (!hs) return;
  const big = h >= 17 || h < 8 || (h >= 11.5 && h < 13) ? 1 : 0.6, n = hs.kind === 'pit' ? 3 : 3;
  const cx = hs.kind === 'pit' ? hs.x : 0.36, cz = hs.z;
  // logs
  const [lx, ly] = V.pt(cx, hs.y, cz); ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.ellipse(lx, ly, 0.22 * V.m, 0.06 * V.m, 0.4, 0, 7); ctx.fill();
  for (let i = 0; i < n; i++) flame(ctx, V, cx, hs.y + 0.02, cz - hs.w * 0.25 + i * hs.w * 0.25, (0.35 + 0.12 * (i % 2)) * big, T + i, i === 1 ? glows : null);
  if (glows) glows.push([lx, ly - 0.4 * V.m, 3.5 * V.m * big]);
}
export function candle(ctx, V, x, y, z, T, lit, glows) {
  const [px, py] = V.pt(x, y, z), m = V.m;
  ctx.fillStyle = '#efe6d0'; ctx.fillRect(px - 0.025 * m, py - 0.16 * m, 0.05 * m, 0.16 * m);
  ctx.fillStyle = '#b8963a'; ctx.beginPath(); ctx.ellipse(px, py, 0.07 * m, 0.025 * m, 0, 0, 7); ctx.fill();
  if (lit) flame(ctx, V, x, y + 0.16, z, 0.09, T, null), glows && glows.push([px, py - 0.2 * m, 1.6 * m]);
}
// Dark after sunset, glows where there is fire or candlelight.
export function nightLight(ctx, V, W, H, h, glows) {
  const d = h >= 21 || h < 5 ? 0.5 : h >= 19 ? (h - 19) / 2 * 0.5 : h < 6 ? 0.5 - (h - 5) * 0.5 : 0;
  if (d <= 0) return;
  V.reset(ctx);
  ctx.fillStyle = `rgba(25,22,48,${d})`; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r] of glows) { const g = ctx.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, `rgba(255,190,110,${0.5 * d + 0.08})`); g.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- on the walls (drawn in the wall's own plane)
// wall: 'back' (along x) or 'left' (along z); at: position along the wall; y: height of the bottom edge (metres).
export function onWall(ctx, V, wall, fn) { (wall === 'back' ? V.onBack : V.onLeft)(ctx, 0.05); fn(ctx); V.reset(ctx); }
const frame = (ctx, at, y, w, h, col = '#6a4a2c') => { ctx.fillStyle = col; ctx.fillRect(at - w / 2 - 0.04, y - 0.04, w + 0.08, h + 0.08); };
export const WALL = {
  // A cross-stitch sampler: letters and a border in red and green on linen.
  sampler: (ctx, at, y) => { frame(ctx, at, y, 0.4, 0.32); ctx.fillStyle = '#efe6d0'; ctx.fillRect(at - 0.2, y, 0.4, 0.32); ctx.fillStyle = '#b5523d'; for (let i = 0; i < 6; i++) ctx.fillRect(at - 0.16 + i * 0.06, y + 0.2, 0.035, 0.035); ctx.fillStyle = '#5f8a4a'; ctx.fillRect(at - 0.16, y + 0.06, 0.32, 0.03); ctx.fillRect(at - 0.02, y + 0.09, 0.04, 0.08); },
  // A painted portrait in a gilt frame.
  portrait: (ctx, at, y, seed = 0) => { frame(ctx, at, y, 0.5, 0.65, '#b8963a'); ctx.fillStyle = ['#3a4a3a', '#4a3a3a', '#3a3a4a'][seed % 3]; ctx.fillRect(at - 0.25, y, 0.5, 0.65); ctx.fillStyle = ['#2a2a40', '#5a2a2a', '#2a4030'][seed % 3]; ctx.beginPath(); ctx.ellipse(at, y + 0.15, 0.16, 0.18, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#e0b898'; ctx.beginPath(); ctx.arc(at, y + 0.42, 0.08, 0, 7); ctx.fill(); },
  // A landscape: hills and sky.
  landscape: (ctx, at, y) => { frame(ctx, at, y, 0.7, 0.45, '#b8963a'); ctx.fillStyle = '#a8c8d8'; ctx.fillRect(at - 0.35, y, 0.7, 0.45); ctx.fillStyle = '#6a8a4a'; ctx.beginPath(); ctx.moveTo(at - 0.35, y); ctx.quadraticCurveTo(at - 0.1, y + 0.3, at + 0.1, y + 0.12); ctx.quadraticCurveTo(at + 0.25, y + 0.22, at + 0.35, y + 0.1); ctx.lineTo(at + 0.35, y); ctx.fill(); },
  // A painting from the village artist: drawn from its seed, so it is the same picture every time you look.
  painting: (ctx, at, y, seed = 1) => {
    const kind = seed % 4, w = 0.62, h = 0.46, x0 = at - w / 2, r = k => ((seed * 9301 + k * 49297) % 233280) / 233280;
    frame(ctx, at, y, w, h, ['#b8963a', '#6a4a2c', '#8a6a3e'][seed % 3]);
    const sky = ['#a8c8d8', '#e8c9a0', '#b8d0e0', '#c8d8b8'][(seed >> 2) % 4];
    ctx.fillStyle = kind === 1 ? ['#4a5a4a', '#5a4a3a', '#3a4a5a'][seed % 3] : sky; ctx.fillRect(x0, y, w, h);
    if (kind === 0) {   // hills under a low sun
      ctx.fillStyle = '#f2d77a'; ctx.beginPath(); ctx.arc(x0 + w * (0.2 + r(1) * 0.6), y + h * 0.7, 0.05, 0, 7); ctx.fill();
      for (const [col, lift] of [['#7a9a5a', 0.45], ['#5f8a44', 0.25]]) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0, y + h * (lift + r(2) * 0.15)); ctx.quadraticCurveTo(x0 + w * 0.4, y + h * (lift + 0.25), x0 + w * 0.7, y + h * lift); ctx.lineTo(x0 + w, y + h * (lift - 0.1 + r(3) * 0.15)); ctx.lineTo(x0 + w, y); ctx.fill(); }
    } else if (kind === 1) {   // flowers in a jug
      ctx.fillStyle = '#8a6a3e'; ctx.fillRect(x0, y, w, h * 0.18);
      ctx.fillStyle = ['#c97a4a', '#4f7fb5', '#e8dcc4'][seed % 3]; ctx.beginPath(); ctx.ellipse(at, y + h * 0.3, 0.07, 0.11, 0, 0, 7); ctx.fill();
      for (let k = 0; k < 7; k++) { ctx.fillStyle = ['#e86a8a', '#f2c94c', '#ffffff', '#b58be0'][(k + seed) % 4]; ctx.beginPath(); ctx.arc(at + (r(k + 4) - 0.5) * 0.24, y + h * (0.58 + r(k + 11) * 0.3), 0.035, 0, 7); ctx.fill(); }
    } else if (kind === 2) {   // the sea and a little boat
      ctx.fillStyle = '#4f7fa5'; ctx.fillRect(x0, y, w, h * 0.45); ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 4; k++) ctx.fillRect(x0 + r(k) * w * 0.8, y + h * (0.1 + k * 0.08), 0.08, 0.008);
      const bx = x0 + w * (0.3 + r(5) * 0.4); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(bx - 0.06, y + h * 0.42, 0.12, 0.03); ctx.fillStyle = '#f3ead8'; ctx.beginPath(); ctx.moveTo(bx, y + h * 0.45); ctx.lineTo(bx, y + h * 0.8); ctx.lineTo(bx + 0.07, y + h * 0.48); ctx.fill();
    } else {   // an orchard in blossom
      ctx.fillStyle = '#8fbf55'; ctx.fillRect(x0, y, w, h * 0.35);
      for (let k = 0; k < 4; k++) { const tx = x0 + w * (0.15 + k * 0.23); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(tx - 0.008, y + h * 0.3, 0.016, h * 0.18); ctx.fillStyle = (seed + k) % 2 ? '#f6c8d4' : '#ffffff'; ctx.beginPath(); ctx.arc(tx, y + h * 0.6, 0.065, 0, 7); ctx.fill(); }
    }
  },
  // The village flag, hung flat on the wall (null: the first design until one is chosen).
  flag: (ctx, at, y, f) => { const w = 0.7, h = 0.46; frame(ctx, at, y, w, h, '#6a4a2c'); ctx.save(); ctx.translate(at - w / 2, y + h); ctx.scale(1, -1); paintFlag(ctx, f && f.bg ? f : DEFAULT_FLAG, w, h); ctx.restore(); },
  mirror: (ctx, at, y) => { frame(ctx, at, y, 0.45, 0.7, '#b8963a'); ctx.fillStyle = '#c8d8e0'; ctx.fillRect(at - 0.22, y, 0.45, 0.7); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(at - 0.15, y + 0.3, 0.06, 0.32); },
  // Bunches of herbs drying from a pole under the ceiling.
  herbs: (ctx, at, y) => { ctx.fillStyle = '#6a4a2c'; ctx.fillRect(at - 0.6, y + 0.4, 1.2, 0.03); for (let i = 0; i < 6; i++) { const x = at - 0.5 + i * 0.2; ctx.fillStyle = ['#7a9a4a', '#a89a5a', '#6a8a5a'][i % 3]; ctx.beginPath(); ctx.moveTo(x, y + 0.4); ctx.lineTo(x - 0.06, y + 0.1); ctx.lineTo(x + 0.06, y + 0.1); ctx.fill(); } },
  // A plate shelf with whatever pottery the household has.
  shelf: (ctx, at, y, n = 3, col = '#b5653d') => { ctx.fillStyle = '#6a4a2c'; ctx.fillRect(at - 0.5, y, 1.0, 0.04); for (let i = 0; i < n; i++) { const x = at - 0.38 + i * 0.25; ctx.fillStyle = i % 2 ? shade(col, 1.15) : col; ctx.beginPath(); ctx.ellipse(x, y + 0.11, 0.07, 0.1, 0, 0, 7); ctx.fill(); ctx.fillRect(x - 0.03, y + 0.18, 0.06, 0.05); } },
  // Curtains either side of a window (cloth homes), drawn closed at night.
  curtains: (ctx, w, closed, col = '#b5523d') => { ctx.fillStyle = col; const half = closed ? w.w / 2 + 0.06 : 0.16; ctx.fillRect(w.x - w.w / 2 - 0.12, w.y - 0.05, half, w.h + 0.18); ctx.fillRect(w.x + w.w / 2 + 0.12 - half, w.y - 0.05, half, w.h + 0.18); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(w.x - w.w / 2 - 0.2, w.y + w.h + 0.12, w.w + 0.4, 0.035); },
  wreath: (ctx, at, y) => { ctx.strokeStyle = '#3e6a3a'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.arc(at, y + 0.2, 0.17, 0, 7); ctx.stroke(); ctx.fillStyle = '#b5323d'; ctx.beginPath(); ctx.arc(at, y + 0.04, 0.05, 0, 7); ctx.fill(); },
  banner: (ctx, at, y, col = '#b5523d') => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(at - 0.3, y + 1.0); ctx.lineTo(at + 0.3, y + 1.0); ctx.lineTo(at + 0.3, y); ctx.lineTo(at, y + 0.15); ctx.lineTo(at - 0.3, y); ctx.fill(); ctx.fillStyle = '#e2c26a'; ctx.fillRect(at - 0.1, y + 0.55, 0.2, 0.2); },
  map: (ctx, at, y) => { frame(ctx, at, y, 0.9, 0.6); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(at - 0.45, y, 0.9, 0.6); ctx.strokeStyle = '#6a8a9a'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(at - 0.4, y + 0.2); ctx.quadraticCurveTo(at, y + 0.45, at + 0.4, y + 0.3); ctx.stroke(); ctx.fillStyle = '#9a5a3a'; for (let i = 0; i < 5; i++) ctx.fillRect(at - 0.3 + i * 0.14, y + 0.1 + (i % 2) * 0.12, 0.04, 0.04); },
  slates: (ctx, at, y) => { ctx.fillStyle = '#efe6d0'; ctx.font = '0.18px serif'; ctx.save(); ctx.scale(1, -1); ctx.textAlign = 'center'; ctx.fillText('A B C  1 2 3', at, -(y + 0.5)); ctx.restore(); },
};
// A braided rag rug on the floor (an oval), at (x, z), r metres across.
export function rug(ctx, V, x, z, rx, rz, col = '#b5823a', fine = false) {
  V.onFloor(ctx, 0.006);
  for (let i = 0; i < (fine ? 1 : 4); i++) { ctx.fillStyle = fine ? col : [col, shade(col, 0.8), shade(col, 1.15), shade(col, 0.9)][i]; ctx.beginPath(); ctx.ellipse(x, z, rx * (1 - i * 0.22), rz * (1 - i * 0.22), 0, 0, 7); ctx.fill(); }
  if (fine) { ctx.strokeStyle = 'rgba(240,220,160,.6)'; ctx.lineWidth = 0.05; ctx.strokeRect(x - rx * 0.85, z - rz * 0.85, rx * 1.7, rz * 1.7); ctx.fillStyle = 'rgba(240,220,160,.35)'; ctx.beginPath(); ctx.ellipse(x, z, rx * 0.35, rz * 0.35, 0, 0, 7); ctx.fill(); }
  V.reset(ctx);
}
// Food on a table top (y metres up), at (x, z): bread, cheese, eggs, honey, fruit, vegetables, beer, as the pantry has them.
export function tableTop(ctx, V, x, y, z, food) {
  const m = V.m, at = (dx, dz) => V.pt(x + dx, y, z + dz);
  const items = [];
  if (food.bread) items.push(([px, py]) => { ctx.fillStyle = '#c8894a'; ctx.beginPath(); ctx.ellipse(px, py - 0.05 * m, 0.13 * m, 0.07 * m, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#9a6030'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - 0.06 * m, py - 0.08 * m); ctx.lineTo(px - 0.02 * m, py - 0.02 * m); ctx.moveTo(px + 0.02 * m, py - 0.08 * m); ctx.lineTo(px + 0.06 * m, py - 0.02 * m); ctx.stroke(); });
  if (food.cheese) items.push(([px, py]) => { ctx.fillStyle = '#f0cf6a'; ctx.beginPath(); ctx.moveTo(px - 0.1 * m, py); ctx.lineTo(px + 0.1 * m, py); ctx.lineTo(px + 0.06 * m, py - 0.09 * m); ctx.closePath(); ctx.fill(); });
  if (food.eggs) items.push(([px, py]) => { ctx.fillStyle = '#a07a50'; ctx.beginPath(); ctx.ellipse(px, py - 0.02 * m, 0.11 * m, 0.04 * m, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f6efe2'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(px - 0.05 * m + i * 0.05 * m, py - 0.05 * m, 0.025 * m, 0.035 * m, 0, 0, 7); ctx.fill(); } });
  if (food.honey) items.push(([px, py]) => { ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.roundRect(px - 0.05 * m, py - 0.12 * m, 0.1 * m, 0.12 * m, 0.03 * m); ctx.fill(); ctx.fillStyle = '#efe6d0'; ctx.fillRect(px - 0.055 * m, py - 0.13 * m, 0.11 * m, 0.03 * m); });
  if (food.fruit) items.push(([px, py]) => { ctx.fillStyle = '#b8894a'; ctx.beginPath(); ctx.ellipse(px, py - 0.03 * m, 0.13 * m, 0.05 * m, 0, 0, 7); ctx.fill(); for (const [dx, c] of [[-0.05, '#c8423a'], [0.04, '#c8b84a'], [0, '#9a3a5a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px + dx * m, py - 0.08 * m, 0.04 * m, 0, 7); ctx.fill(); } });
  if (food.vegetables) items.push(([px, py]) => { ctx.fillStyle = '#e07a2a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(px - 0.04 * m + i * 0.04 * m, py - 0.03 * m, 0.02 * m, 0.07 * m, 0.6, 0, 7); ctx.fill(); } ctx.fillStyle = '#5f9a4a'; ctx.fillRect(px - 0.06 * m, py - 0.1 * m, 0.12 * m, 0.02 * m); });
  if (food.beer) items.push(([px, py]) => { ctx.fillStyle = '#8a8f96'; ctx.fillRect(px - 0.04 * m, py - 0.12 * m, 0.08 * m, 0.12 * m); ctx.fillStyle = '#f3ecd8'; ctx.fillRect(px - 0.04 * m, py - 0.13 * m, 0.08 * m, 0.02 * m); });
  if (food.plates) items.push(([px, py]) => { ctx.fillStyle = '#c8ccd0'; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(px - 0.08 * m + i * 0.16 * m, py, 0.08 * m, 0.03 * m, 0, 0, 7); ctx.fill(); } });
  const spots = [[-0.35, -0.15], [0, -0.2], [0.35, -0.12], [-0.25, 0.15], [0.12, 0.15], [0.4, 0.12], [-0.05, 0]];
  items.forEach((f, i) => f(at(...spots[i % spots.length])));
}
// The water in the household barrel, at its level (0..1).
export function waterIn(ctx, V, x, z, r, h, level) {
  if (level <= 0.02) return;
  const [px, py] = V.pt(x, 0.1 + (h - 0.15) * level, z);
  ctx.fillStyle = 'rgba(90,150,190,.9)'; ctx.beginPath(); ctx.ellipse(px, py, r * 0.92 * V.k * 90.5, r * 0.92 * V.k * 45, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(px - r * 20 * V.k, py - r * 6 * V.k, r * 30 * V.k, r * 8 * V.k, 0, 0, 7); ctx.fill();
}
export function steam(ctx, V, x, y, z, T) {
  const [px, py] = V.pt(x, y, z), m = V.m;
  for (let i = 0; i < 4; i++) { const p = (T * 0.4 + i / 4) % 1; ctx.fillStyle = `rgba(255,255,255,${0.25 * (1 - p)})`; ctx.beginPath(); ctx.arc(px + Math.sin(T + i) * 0.1 * m, py - p * 0.9 * m, (0.08 + p * 0.15) * m, 0, 7); ctx.fill(); }
}
// Work in motion.
export const WORK = {
  wheel: (ctx, V, x, y, z, T) => { const [px, py] = V.pt(x, y, z), m = V.m, a = T * 8; ctx.strokeStyle = 'rgba(80,50,30,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * 0.25 * m, py + Math.sin(a) * 0.12 * m); ctx.lineTo(px - Math.cos(a) * 0.25 * m, py - Math.sin(a) * 0.12 * m); ctx.stroke(); },
  shuttle: (ctx, V, x, y, z, w, T) => { const p = (Math.sin(T * 3) + 1) / 2, [px, py] = V.pt(x + p * w, y, z); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(px - 0.08 * V.m, py - 0.03 * V.m, 0.16 * V.m, 0.05 * V.m); },
  sparks: (ctx, V, x, y, z, T, glows) => { const [px, py] = V.pt(x, y, z), m = V.m; for (let i = 0; i < 6; i++) { const p = (T * 1.5 + i / 6) % 1; ctx.fillStyle = `rgba(255,${180 + i * 10},80,${1 - p})`; ctx.fillRect(px + Math.sin(i * 2.3) * p * 0.4 * m, py - p * 0.6 * m, 2, 2); } glows && glows.push([px, py, 2.4 * m]); },
  glow: (ctx, V, x, y, z, r, glows) => { const [px, py] = V.pt(x, y, z); const g = ctx.createRadialGradient(px, py, 1, px, py, r * V.m); g.addColorStop(0, 'rgba(255,140,60,.55)'); g.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = g; ctx.fillRect(px - r * V.m, py - r * V.m, r * 2 * V.m, r * 2 * V.m); glows && glows.push([px, py, r * 1.5 * V.m]); },
  turn: (ctx, V, x, y, z, r, T) => { const [px, py] = V.pt(x, y, z), m = V.m, a = T * 1.2; ctx.strokeStyle = 'rgba(60,55,50,.6)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const b = a + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(b) * r * m * 0.8, py + Math.sin(b) * r * m * 0.4); ctx.stroke(); } },
};
// Goods on a set of shelves: rows of little shapes, as many as the stores hold (fill 0..1).
export function shelfGoods(ctx, V, x0, z0, w, rows, fill, cols, along = 'x') {
  const n = Math.round(fill * 8 * rows);
  for (let i = 0; i < n; i++) {
    const row = i % rows, k = Math.floor(i / rows), t = (k + 0.5) / 8;
    const [px, py] = along === 'x' ? V.pt(x0 + t * w, 0.14 + row * 0.5, z0 + 0.22) : V.pt(x0 + 0.22, 0.14 + row * 0.5, z0 + t * w);
    ctx.fillStyle = cols[(i + row) % cols.length]; ctx.beginPath(); ctx.roundRect(px - 0.07 * V.m, py - 0.22 * V.m, 0.14 * V.m, 0.22 * V.m, 0.03 * V.m); ctx.fill();
  }
}
