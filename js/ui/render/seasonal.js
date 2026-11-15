// Seasonal art. Two layers:
//   decorations  up at dawn the day before each festival, down at dawn the morning after:
//                spring flower boxes and garlands · summer bunting · autumn pumpkins, scarecrows and leaf piles ·
//                winter wreaths, twinkling string lights, a snowman and the village tree
//   festival day the celebration itself: painted eggs and the Easter bunny with baskets and bunny ears ·
//                swimmers, parasols and picnic blankets · costumes, glowing lanterns and bats · carolers in hats
//                and scarves round the tree with presents · Santa with his sack and a sleigh of presents leading the parade
// Drawing only: reads the game, never changes it.
import { TW, TH, DAY, SEASON } from '../../core/config.js';
import { seasonIndex, isNight, hub } from '../../core/state.js';
import { hash } from '../../core/rng.js';
import { iso } from './kit.js';
import { posAt } from '../../core/festival.js';
import { chain } from './sprites.js';
import { HOME_LOOK } from './buildings.js';

export function createSeasonal(K, extra) {
  const { ctx, dia, poly, upp, mid, lerp, cor, box, walls, door, c0, st } = K, { confetti } = extra;
  const on = (g, id) => g.seasonal && g.seasonal.phase === 'on' && g.seasonal.id === id;
  const PASTEL = ['#f2c94c', '#e86a8a', '#5aa9e6', '#8ad06a', '#b58be0'];
  const glow = (x, y, r, c, a) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c.replace('A', a)); gr.addColorStop(1, c.replace('A', 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  // ---- people
  function costume(v, sx, sy) {
    const k = v.id % 4;
    if (k === 0) { ctx.fillStyle = 'rgba(250,250,250,.95)'; ctx.beginPath(); ctx.moveTo(sx - 9, sy - 1); ctx.quadraticCurveTo(sx - 10, sy - 33, sx, sy - 34); ctx.quadraticCurveTo(sx + 10, sy - 33, sx + 9, sy - 1); ctx.lineTo(sx + 5, sy - 5); ctx.lineTo(sx + 1.5, sy - 1); ctx.lineTo(sx - 2, sy - 5); ctx.lineTo(sx - 5.5, sy - 1); ctx.fill(); ctx.fillStyle = '#222'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx + s * 3, sy - 24, 1.6, 2.2, 0, 0, 7); ctx.fill(); } ctx.beginPath(); ctx.ellipse(sx, sy - 19, 1.5, 2, 0, 0, 7); ctx.fill(); }   // a ghost
    else if (k === 1) { ctx.fillStyle = '#3a2a4a'; ctx.beginPath(); ctx.moveTo(sx - 7, sy - 4); ctx.lineTo(sx + 7, sy - 4); ctx.lineTo(sx + 5, sy - 17); ctx.lineTo(sx - 5, sy - 17); ctx.fill(); poly([[sx - 10, sy - 25], [sx + 10, sy - 25], [sx + 2, sy - 46]], '#2a2a3a'); ctx.fillStyle = '#2a2a3a'; ctx.beginPath(); ctx.ellipse(sx, sy - 25, 12, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b58be0'; ctx.fillRect(sx - 6, sy - 28, 12, 2.5); ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx + 8, sy - 2); ctx.lineTo(sx + 12, sy - 22); ctx.stroke(); ctx.fillStyle = '#c9a25a'; for (let i = 0; i < 4; i++) ctx.fillRect(sx + 6 + i * 1.5, sy - 2, 1.2, 4); }   // a witch: robe, hat and broom
    else if (k === 2) { for (const s of [-1, 1]) poly([[sx + s * 1.5, sy - 25], [sx + s * 6.5, sy - 25], [sx + s * 5, sy - 33]], '#3a3030'); for (const s of [-1, 1]) poly([[sx + s * 2.5, sy - 25.5], [sx + s * 5.5, sy - 25.5], [sx + s * 4.6, sy - 30]], '#e8a0b0'); ctx.strokeStyle = '#3a3030'; ctx.lineWidth = 1; for (const s of [-1, 1]) for (const dy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx + s * 2, sy - 20); ctx.lineTo(sx + s * 9, sy - 20 + dy * 1.5); ctx.stroke(); } ctx.strokeStyle = '#3a3030'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 5, sy - 6); ctx.quadraticCurveTo(sx - 13, sy - 10, sx - 11, sy - 18); ctx.stroke(); }   // a cat: ears, whiskers, tail
    else { ctx.fillStyle = '#e8873a'; ctx.beginPath(); ctx.ellipse(sx, sy - 23, 8.5, 7, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#c96a2a'; ctx.lineWidth = 1; for (const dx of [-3.5, 0, 3.5]) { ctx.beginPath(); ctx.ellipse(sx + dx, sy - 23, 2.5, 6.8, 0, 0, 7); ctx.stroke(); } const lit = '#ffd27a'; poly([[sx - 4.5, sy - 24], [sx - 2, sy - 27], [sx - 1.5, sy - 24]], lit); poly([[sx + 4.5, sy - 24], [sx + 2, sy - 27], [sx + 1.5, sy - 24]], lit); poly([[sx - 4, sy - 20], [sx + 4, sy - 20], [sx + 2.5, sy - 18], [sx, sy - 19.5], [sx - 2.5, sy - 18]], lit); ctx.fillStyle = '#4f8a44'; ctx.fillRect(sx - 1, sy - 32, 2, 3.5); }   // a pumpkin head
  }
  // What each villager wears on the day (and the basket or bag they carry).
  function outfit(g, v, sx, sy) {
    const F = g.seasonal; if (!F || F.phase !== 'on') return;
    if (F.id === 'halloween') {
      costume(v, sx, sy);
      ctx.fillStyle = '#e8873a'; ctx.beginPath(); ctx.ellipse(sx - 8, sy - 9, 3.5, 3, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx - 8, sy - 12, 3, Math.PI, 0); ctx.stroke();   // treat bucket
      if (v.treats) { ctx.fillStyle = PASTEL[v.id % 5]; ctx.beginPath(); ctx.arc(sx - 8, sy - 12, 1.3, 0, 7); ctx.fill(); }
    } else if (F.id === 'christmas') {
      poly([[sx - 6.5, sy - 24], [sx + 6.5, sy - 24], [sx + 5, sy - 34], [sx + 9, sy - 30]], '#c9553d');
      ctx.fillStyle = '#fff'; ctx.fillRect(sx - 7, sy - 25.5, 14, 3); ctx.beginPath(); ctx.arc(sx + 9, sy - 30, 2.2, 0, 7); ctx.fill();   // hat
      ctx.fillStyle = v.id % 2 ? '#3a7a44' : '#4f7fb5'; ctx.fillRect(sx - 5.5, sy - 17, 11, 3); ctx.fillRect(sx + 1, sy - 15, 3, 7);   // scarf
      if (v.act && v.act.type === 'carol') { ctx.fillStyle = '#efe6d6'; ctx.fillRect(sx - 9, sy - 13, 6, 5); ctx.strokeStyle = '#9a7a5a'; ctx.lineWidth = 0.6; ctx.strokeRect(sx - 9, sy - 13, 6, 5); if (Math.sin(st.T0 * 2 + v.id) > 0.6) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '9px serif'; ctx.textAlign = 'center'; ctx.fillText('♪', sx + 9, sy - 30 - (st.T0 * 8 + v.id * 5) % 10); } }   // song sheet and notes
    } else if (F.id === 'easter') {
      ctx.fillStyle = '#f6f2ea'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx + s * 3, sy - 32, 1.8, 5.5, s * 0.2, 0, 7); ctx.fill(); } ctx.fillStyle = '#e8a0b0'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx + s * 3, sy - 32, 0.8, 3.8, s * 0.2, 0, 7); ctx.fill(); }   // bunny ears
      ctx.fillStyle = '#c99a5a'; ctx.beginPath(); ctx.ellipse(sx + 8, sy - 8, 4.5, 3, 0, 0, Math.PI); ctx.fill(); ctx.strokeStyle = '#9a6a3e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx + 8, sy - 8, 4, Math.PI, 0); ctx.stroke();   // basket
      for (let i = 0; i < Math.min(3, v.eggs || 0); i++) { ctx.fillStyle = PASTEL[(v.id + i) % 5]; ctx.beginPath(); ctx.ellipse(sx + 6 + i * 2, sy - 9, 1.4, 1.8, 0, 0, 7); ctx.fill(); }
    } else if (F.id === 'summer' && !v.swim) {
      ctx.fillStyle = '#e8d08a'; ctx.beginPath(); ctx.ellipse(sx, sy - 25, 10, 3, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(sx, sy - 27, 5, 3.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#d9534f'; ctx.fillRect(sx - 5, sy - 26.5, 10, 1.5);   // straw hat
    }
  }

  // ---- things
  function pumpkin(x, y, s = 1, lit = false) {
    if (lit) glow(x, y - 4 * s, 16 * s, 'rgba(255,190,90,A)', 0.35 + 0.1 * Math.sin(st.T0 * 3 + x));
    ctx.fillStyle = '#e8873a'; ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 7 * s, 5 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c96a2a'; ctx.lineWidth = 1; for (const dx of [-2.5, 2.5]) { ctx.beginPath(); ctx.ellipse(x + dx * s, y - 4 * s, 2.5 * s, 4.8 * s, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#4f8a44'; ctx.fillRect(x - 1, y - 11 * s, 2, 3 * s);
    if (lit) { const c = '#ffd27a'; poly([[x - 3.5 * s, y - 5 * s], [x - 1.5 * s, y - 7 * s], [x - 1.5 * s, y - 5 * s]], c); poly([[x + 3.5 * s, y - 5 * s], [x + 1.5 * s, y - 7 * s], [x + 1.5 * s, y - 5 * s]], c); ctx.fillStyle = c; ctx.fillRect(x - 3 * s, y - 3.2 * s, 6 * s, 1.4 * s); }
  }
  function egg(x, y, c, s = 1) {
    ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 0.5, 4.5 * s, 1.8 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = PASTEL[c]; ctx.beginPath(); ctx.ellipse(x, y - 5 * s, 4.2 * s, 5.6 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 5.5 * s); ctx.quadraticCurveTo(x - 2 * s, y - 7.5 * s, x, y - 5.5 * s); ctx.quadraticCurveTo(x + 2 * s, y - 3.5 * s, x + 4 * s, y - 5.5 * s); ctx.stroke();
    ctx.fillStyle = PASTEL[(c + 2) % 5]; for (const dx of [-2, 2]) { ctx.beginPath(); ctx.arc(x + dx * s, y - 2.5 * s, 0.9 * s, 0, 7); ctx.fill(); }
    if (Math.sin(st.T0 * 2.2 + x) > 0.85) { ctx.fillStyle = 'rgba(255,255,240,.9)'; ctx.fillRect(x + 2 * s, y - 9 * s, 1.5, 1.5); }   // a glint so they can be spotted
  }
  function bunny(x, y, dir) {
    const hop = Math.abs(Math.sin(st.T0 * 6)) * 6, s = 1.6;
    ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 9, 3.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f6f2ea'; ctx.beginPath(); ctx.ellipse(x, y - 5 * s - hop, 6 * s, 4.5 * s, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 5 * s * dir, y - 9 * s - hop, 3.6 * s, 0, 7); ctx.fill();
    for (const e of [0, 2.5]) { ctx.fillStyle = '#f6f2ea'; ctx.beginPath(); ctx.ellipse(x + (4 + e) * s * dir, y - 15.5 * s - hop, 1.4 * s, 4.2 * s, 0.2 * dir, 0, 7); ctx.fill(); ctx.fillStyle = '#e8a0b0'; ctx.beginPath(); ctx.ellipse(x + (4 + e) * s * dir, y - 15.5 * s - hop, 0.6 * s, 3 * s, 0.2 * dir, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 6 * s * dir, y - 6 * s - hop, 2.2 * s, 0, 7); ctx.fill();   // tail
    ctx.fillStyle = '#3a2a2a'; ctx.beginPath(); ctx.arc(x + 6.5 * s * dir, y - 10 * s - hop, 0.8 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8a0b0'; ctx.beginPath(); ctx.arc(x + 8.4 * s * dir, y - 8.6 * s - hop, 0.9 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#5aa9e6'; ctx.fillRect(x + 2 * s * dir - 3, y - 7 * s - hop, 6, 2);   // a blue bow
  }
  function xmasTree(x, y, festive, night) {
    if (night) glow(x, y - 30, 46, 'rgba(255,220,140,A)', 0.28);
    ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 3, y - 9, 6, 9);
    for (let i = 0; i < 4; i++) { poly([[x - 19 + i * 3.5, y - 6 - i * 12], [x + 19 - i * 3.5, y - 6 - i * 12], [x, y - 26 - i * 12]], i % 2 ? '#2f6a3a' : '#3a7a44'); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 17 + i * 3.5, y - 7 - i * 12, 34 - i * 7, 1.5); }   // snow on the boughs
    const cols = ['#f2c94c', '#e86a8a', '#5aa9e6', '#f3ecdc', '#ff9a4a'];
    for (let k = 0; k < 20; k++) { const t = k / 20, px = x + Math.sin(k * 2.4) * (15 - t * 13), py = y - 10 - t * 44; ctx.fillStyle = cols[k % 5]; ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(st.T0 * 2 + k)); ctx.beginPath(); ctx.arc(px, py, 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    poly([[x, y - 64], [x + 2.4, y - 58], [x + 7, y - 58], [x + 3.3, y - 54.5], [x + 4.6, y - 49], [x, y - 52.5], [x - 4.6, y - 49], [x - 3.3, y - 54.5], [x - 7, y - 58], [x - 2.4, y - 58]], '#f2d36a');
    if (night) glow(x, y - 56, 12, 'rgba(255,230,120,A)', 0.6);
    if (festive) for (const [dx, dy, c2, w] of [[-12, 0, '#c9553d', 7], [9, 1, '#4f7fb5', 6], [-2, 3, '#8ad06a', 8], [15, -2, '#b58be0', 5], [-18, -2, '#f2c94c', 5]]) { ctx.fillStyle = c2; ctx.fillRect(x + dx - w / 2, y - 5 + dy, w, 6); ctx.fillStyle = '#f3ecdc'; ctx.fillRect(x + dx - 0.6, y - 5 + dy, 1.2, 6); ctx.fillRect(x + dx - w / 2, y - 2.6 + dy, w, 1.2); }   // presents
  }
  function snowman(x, y) {
    ctx.fillStyle = 'rgba(40,60,80,.2)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 9, 3.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f7f9fb'; for (const [dy, r] of [[-6, 7.5], [-17, 5.5], [-25.5, 4]]) { ctx.beginPath(); ctx.arc(x, y + dy, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 4, y - 31, 8, 1.5); ctx.fillRect(x - 2.6, y - 37, 5.2, 6);   // hat
    ctx.fillStyle = '#e8873a'; poly([[x, y - 26], [x + 6, y - 25], [x, y - 24.4]], '#e8873a');
    ctx.fillStyle = '#c9553d'; ctx.fillRect(x - 4.5, y - 22, 9, 2.2); ctx.fillRect(x + 1.5, y - 21, 2.2, 5);
    ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1.2; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 5, y - 17); ctx.lineTo(x + s * 12, y - 22); ctx.stroke(); }
  }
  function scarecrow(x, y) {
    ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.moveTo(x - 11, y - 20); ctx.lineTo(x + 11, y - 20); ctx.stroke();
    ctx.fillStyle = '#8a5a3a'; ctx.fillRect(x - 5, y - 23, 10, 12); ctx.fillStyle = '#e8c27a'; for (const s of [-1, 1]) ctx.fillRect(x + s * 11 - 1.5, y - 21, 3, 4);
    ctx.fillStyle = '#e8d08a'; ctx.beginPath(); ctx.arc(x, y - 28, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#6a4a2c'; ctx.beginPath(); ctx.ellipse(x, y - 31.5, 8, 2, 0, 0, 7); ctx.fill(); ctx.fillRect(x - 3.5, y - 36, 7, 4.5);
    ctx.fillStyle = '#3a2a2a'; for (const s of [-1, 1]) ctx.fillRect(x + s * 1.8 - 0.6, y - 29, 1.2, 1.2);
  }
  function leaves(x, y) { for (let k = 0; k < 7; k++) { ctx.fillStyle = ['#c9553d', '#e8873a', '#d9a03a'][k % 3]; ctx.beginPath(); ctx.ellipse(x + Math.sin(k * 2.1) * 6, y - 1 - (k % 3), 2.6, 1.4, k, 0, 7); ctx.fill(); } }
  function parasol(x, y, c) {
    ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 26); ctx.stroke();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f3ecdc' : c; ctx.beginPath(); ctx.moveTo(x - 2, y - 30); ctx.arc(x - 2, y - 26, 13, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6); ctx.fill(); }
  }
  function bat(x, y, t) {
    const f = Math.sin(t * 14) * 4; ctx.fillStyle = '#2a2430';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 5, y - 4 - f, x - 10, y - f); ctx.quadraticCurveTo(x - 6, y + 1, x, y + 2); ctx.quadraticCurveTo(x + 6, y + 1, x + 10, y - f); ctx.quadraticCurveTo(x + 5, y - 4 - f, x, y); ctx.fill();
  }

  // Decorations on a house: along its two front eaves and on its door.
  function houseDecor(g, b, sk, night) {
    const L = HOME_LOOK[b.lvl || 0], h = L.h, [tp, rt, bt, lf] = cor(b), eL = [upp(lf, h), upp(bt, h)], eR = [upp(bt, h), upp(rt, h)];
    const along = (fn, n) => { for (const [p, q] of [eL, eR]) for (let i = 0; i <= n; i++) fn(lerp(p, q, i / n), i); };
    const dm = mid(bt, rt), dTop = [dm[0], dm[1] - Math.min(14, h - 4) - 4];
    if (sk === 0) {   // spring: a flower box under the window and a pastel garland
      const p = lerp(lf, bt, 0.5); ctx.fillStyle = '#8a5a3a'; ctx.fillRect(p[0] - 6, p[1] - 9, 12, 3);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = PASTEL[(i + b.id) % 5]; ctx.beginPath(); ctx.arc(p[0] - 5 + i * 2.5, p[1] - 10.5, 1.6, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#8ad06a'; ctx.lineWidth = 1; for (const [p2, q2] of [eL, eR]) { ctx.beginPath(); ctx.moveTo(p2[0], p2[1] + 2); ctx.quadraticCurveTo((p2[0] + q2[0]) / 2, (p2[1] + q2[1]) / 2 + 6, q2[0], q2[1] + 2); ctx.stroke(); }
      along((p2, i) => { ctx.fillStyle = PASTEL[(i + b.id) % 5]; ctx.beginPath(); ctx.arc(p2[0], p2[1] + 2 + Math.sin(i / 6 * Math.PI) * 4, 1.5, 0, 7); ctx.fill(); }, 6);
    } else if (sk === 1) {   // summer: bunting
      along((p2, i) => { const y = p2[1] + 2 + Math.sin(i / 6 * Math.PI) * 4; if (i < 6) poly([[p2[0] - 2.2, y], [p2[0] + 2.2, y + 0.6], [p2[0], y + 5]], ['#d9534f', '#f2c94c', '#5aa9e6', '#f3ecdc'][(i + b.id) % 4]); }, 6);
    } else if (sk === 2) {   // autumn: a harvest wreath on the door
      ctx.strokeStyle = '#c9553d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(dTop[0], dTop[1], 4, 0, 7); ctx.stroke(); ctx.strokeStyle = '#e8a03a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(dTop[0], dTop[1], 4, 0.5, 2.5); ctx.stroke();
    } else {   // winter: a wreath with a red bow, snow on the roof edge, string lights that twinkle at night
      ctx.strokeStyle = '#2f6a3a'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(dTop[0], dTop[1], 4.2, 0, 7); ctx.stroke(); ctx.fillStyle = '#c9553d'; poly([[dTop[0] - 3, dTop[1] + 3], [dTop[0], dTop[1] + 4.5], [dTop[0] + 3, dTop[1] + 3], [dTop[0], dTop[1] + 6]], '#c9553d');
      along((p2, i) => { const c = ['#f2c94c', '#e86a8a', '#5aa9e6', '#8ad06a'][(i + b.id) % 4], tw = 0.5 + 0.5 * Math.sin(st.T0 * 3 + i * 1.7 + b.id); if (night) glow(p2[0], p2[1] + 2, 5, c === '#f2c94c' ? 'rgba(255,220,120,A)' : 'rgba(255,200,200,A)', 0.35 * tw); ctx.fillStyle = c; ctx.globalAlpha = night ? 0.5 + 0.5 * tw : 0.9; ctx.beginPath(); ctx.arc(p2[0], p2[1] + 2, 1.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }, 7);
    }
  }

  // ---- what goes into the scene
  function drawSeasonalGround(g) {
    const F = g.seasonal;
    if (!F || F.phase !== 'on') return;
    if (F.picnics) F.picnics.forEach(([px, py], n) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i + j) % 2 ? '#f3ecdc' : ['#d9534f', '#5aa9e6', '#8ad06a'][n % 3]; const a = iso(px - 0.3 + i * 0.15, py - 0.3 + j * 0.15); dia(a[0], a[1], TW * 0.075, TH * 0.075); ctx.fill(); } });
  }
  function seasonalObjects(g, objs) {
    const F = g.seasonal; if (!F || !['decor', 'on', 'after'].includes(F.phase)) return;   // up the day before, down the morning after
    const sk = ['easter', 'summer', 'halloween', 'christmas'].indexOf(F.id), night = st.dark > 0.35, h = hub(g);
    for (const b of g.buildings) {
      if (!b.done) continue;
      if (b.k === 'house') objs.push([b.x + b.y + (b.w + b.h) / 2 - 1 + 0.005, 7, { k: 'house', b, sk, night }]);
      if (sk === 2 && b.k === 'house') { objs.push([b.x + b.y + 0.9, 7, { k: 'pumpkin', x: b.x + 0.55, y: b.y + 0.45 }]); if (b.id % 2) objs.push([b.x + b.y + 0.9, 7, { k: 'pumpkin', x: b.x + 0.45, y: b.y + 0.6, s: 0.7 }]); }
      if (sk === 2 && BUILD_CROP.has(b.k)) objs.push([b.x + b.y + 1, 7, { k: 'scarecrow', x: b.x + 0.5, y: b.y + 0.5 }]);
    }
    if (sk === 2 && h) for (let n = 0; n < 6; n++) { const x = h.x - 3 + (hash(n, 7) * 8 | 0), y = h.y - 3 + (hash(7, n) * 8 | 0); objs.push([x + y - 0.5, 7, { k: 'leaves', x, y }]); }
    if (sk === 3 && h) objs.push([h.x + h.y - 2, 7, { k: 'snowman', x: h.x - 1.6, y: h.y - 0.2 }]);
    const t = sk === 3 && (F.tree || g.xmasTree); if (t) objs.push([t[0] + t[1], 7, { k: 'tree', x: t[0], y: t[1], festive: true, night }]);
    if (F.eggs) for (const e of F.eggs) if (!e.found) objs.push([e.x + e.y - 0.01, 7, { k: 'egg', x: e.x + (hash(e.x, e.y) - 0.5) * 0.4, y: e.y, c: e.c }]);
    if (F.bunny) objs.push([F.bunny.x + F.bunny.y + 0.02, 7, { k: 'bunny', x: F.bunny.x, y: F.bunny.y, dir: F.bunny.dir }]);
    if (F.santa) { objs.push([F.santa.x + F.santa.y + 0.03, 7, { k: 'santa', x: F.santa.x, y: F.santa.y, dir: F.santa.dir, walking: !F.santa.done }]); if (!F.santa.done && F.route && F.santa.s > 1.2) { const [x, y] = posAt(F.route, F.santa.s - 1.1); objs.push([x + y + 0.02, 7, { k: 'sleigh', x, y, dir: F.santa.dir }]); } }
    if (F.phase !== 'on') return;
    if (F.picnics) F.picnics.forEach(([x, y], n) => { if (n % 2 === 0) objs.push([x + y + 0.3, 7, { k: 'parasol', x: x + 0.3, y: y + 0.1, c: ['#d9534f', '#5aa9e6', '#f2c94c'][n % 3] }]); });
    if (F.id === 'halloween' && h) for (let n = 0; n < 4; n++) objs.push([999, 7, { k: 'bat', x: h.x + Math.sin(st.T0 * 0.6 + n * 1.6) * 4, y: h.y + Math.cos(st.T0 * 0.5 + n * 2.1) * 3, n }]);
  }
  function santa(x, y, dir, walking) {
    const bob = walking ? Math.abs(Math.sin(st.T0 * 9)) * -2 : 0;
    ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 10, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.ellipse(x - 8 * dir, y - 14 + bob, 6, 8, 0, 0, 7); ctx.fill();   // the sack
    ctx.fillStyle = '#c9302c'; ctx.beginPath(); ctx.roundRect(x - 7, y - 20 + bob, 14, 18, 6); ctx.fill();          // the coat
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 7, y - 11 + bob, 14, 2.5); ctx.fillStyle = '#f2c94c'; ctx.fillRect(x - 1.5, y - 11.5 + bob, 3, 3.5);   // belt and buckle
    ctx.fillStyle = '#f6f2ea'; ctx.fillRect(x - 7, y - 4 + bob, 14, 2.5);
    ctx.fillStyle = '#e8b08a'; ctx.beginPath(); ctx.arc(x, y - 25 + bob, 5.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f6f2ea'; ctx.beginPath(); ctx.ellipse(x, y - 21 + bob, 5.5, 5, 0, 0, Math.PI); ctx.fill();     // beard
    poly([[x - 6, y - 28 + bob], [x + 6, y - 28 + bob], [x + 7 * dir, y - 38 + bob]], '#c9302c'); ctx.fillStyle = '#f6f2ea'; ctx.fillRect(x - 6.5, y - 29.5 + bob, 13, 3); ctx.beginPath(); ctx.arc(x + 7 * dir, y - 38 + bob, 2.2, 0, 7); ctx.fill();
    if (walking && Math.sin(st.T0 * 1.5) > 0.7) { ctx.font = 'bold 10px serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,45,30,.7)'; ctx.fillStyle = '#fff'; ctx.strokeText('Ho ho ho!', x, y - 46); ctx.fillText('Ho ho ho!', x, y - 46); }
  }
  function sleigh(x, y, dir) {
    ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 16, 5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c9a25a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 15, y); ctx.lineTo(x + 13, y); ctx.quadraticCurveTo(x + 18, y, x + 17 * 1, y - 5); ctx.stroke();
    ctx.fillStyle = '#b8302c'; ctx.beginPath(); ctx.moveTo(x - 14, y - 3); ctx.lineTo(x + 12, y - 3); ctx.quadraticCurveTo(x + 16, y - 12, x + 10, y - 16); ctx.lineTo(x - 12, y - 14); ctx.closePath(); ctx.fill();
    for (const [dx, c2] of [[-8, '#4f7fb5'], [-1, '#8ad06a'], [5, '#f2c94c']]) { ctx.fillStyle = c2; ctx.fillRect(x + dx - 3, y - 22, 6, 7); ctx.fillStyle = '#c9553d'; ctx.fillRect(x + dx - 0.6, y - 22, 1.2, 7); }
  }
  function drawSeasonalObj(o) {
    const [x, y] = iso(o.x || 0, o.y || 0);
    // Art slots: seasonal/<piece>, e.g. seasonal/pumpkin, seasonal/egg/<0-4>, seasonal/bunny, seasonal/tree, seasonal/santa.
    if (o.k !== 'house' && K.sprites.draw(ctx, o.k === 'egg' ? chain('seasonal/egg', o.c) : o.k === 'pumpkin' && st.dark > 0.25 ? ['seasonal/pumpkin-lit', 'seasonal/pumpkin'] : ['seasonal/' + o.k], x, o.k === 'bat' ? y - 70 : y, { t: st.T0 + (o.n || 0), flip: (o.dir || 1) < 0, mul: o.s || 1 })) return;
    if (o.k === 'house') houseDecor(st.G, o.b, o.sk, o.night);
    else if (o.k === 'pumpkin') pumpkin(x, y, o.s || 1, st.dark > 0.25);
    else if (o.k === 'egg') egg(x, y, o.c, 1.2);
    else if (o.k === 'bunny') bunny(x, y, o.dir);
    else if (o.k === 'tree') xmasTree(x, y, o.festive, o.night);
    else if (o.k === 'snowman') snowman(x, y);
    else if (o.k === 'scarecrow') scarecrow(x, y);
    else if (o.k === 'leaves') leaves(x, y);
    else if (o.k === 'parasol') parasol(x, y, o.c);
    else if (o.k === 'santa') santa(x, y, o.dir, o.walking);
    else if (o.k === 'sleigh') sleigh(x, y, o.dir);
    else if (o.k === 'bat') bat(x, y - 70 - Math.sin(st.T0 * 2 + o.n) * 8, st.T0 + o.n);
  }
  const BUILD_CROP = new Set(['farm', 'wheatfield', 'fiberfield']);
  return { costume, outfit, pumpkin, drawSeasonalGround, seasonalObjects, drawSeasonalObj };
}
