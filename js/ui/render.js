// Drawing. Reads the game state and the view; never changes the game.
import { N, TW, TH, BUILD, NODE, SEASON, DAY, dims } from '../core/config.js';
import { idx, inMap, nodeKind, WATER, SAND } from '../core/world.js';
import { darkness, hour, isNight, seasonIndex } from '../core/state.js';
import { hash } from '../core/rng.js';
import { createKit } from './render/kit.js';
import { chain, SEASON_NAMES } from './render/sprites.js';
import { createBuildings, HOME_LOOK } from './render/buildings.js';
import { createWorkerBadges } from './render/workers.js';
import { createSeasonal } from './render/seasonal.js';

export { iso } from './render/kit.js';
import { iso } from './render/kit.js';
const SG = [[134, 184, 98], [118, 170, 84], [178, 150, 76], [224, 233, 238]];
const SF = [[[90, 154, 74], [106, 173, 88], [123, 189, 104]], [[79, 143, 74], [95, 163, 85], [109, 177, 95]], [[201, 119, 47], [217, 152, 58], [229, 178, 74]], [[127, 154, 134], [169, 191, 176], [232, 240, 238]]];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
  let gc = SG[0], fol = SF[0].map(rgb);
  const K = createKit(ctx), { st, dia, poly, upp, mid, lerp, cor, box, walls, door, c0 } = K, S = K.sprites;
  const { DB, heightOf, drawBuilding, drawFire, bar, pen, herd, animal } = createBuildings(K);
  const drawWorkBadges = createWorkerBadges(K, heightOf);

  function drawTree(x, y, amt, grow = 1, sapling = false) {
    if (S.draw(ctx, sapling ? chain('node/sapling', SEASON_NAMES[st.sea]) : chain('node/tree', SEASON_NAMES[st.sea]), ...iso(x, y), { t: st.T0, seed: (hash(x, y) * 997) | 0, mul: sapling ? grow : 1 })) return;
    const [sx, sy] = iso(x, y), s = (0.7 + 0.3 * amt / 40) * grow, sw = Math.sin(st.T0 * 1.3 + x * 0.9) * 1.2;
    ctx.fillStyle = 'rgba(40,70,40,.22)'; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 16 * s, 7 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a5638'; ctx.fillRect(sx - 3 * grow, sy - 14 * s, 6 * grow, 16 * s);
    [[0, -24, 15, fol[0]], [sw - 3, -34, 12, fol[1]], [sw + 3, -27, 11, fol[2]]].forEach(([a, b2, r, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx + a * s, sy + b2 * s, r * s, 0, 7); ctx.fill(); });
  }
  function drawNode(g, x, y) {
    const i = idx(x, y), k = nodeKind(g.w, i);
    if (k === NODE.TREE) return drawTree(x, y, g.w.A[i]);
    const [sx, sy] = iso(x, y);
    // Art slots: node/<kind>/<stage>/<season>; stage 0 full, 1 about half, 2 nearly gone.
    const kind = { [NODE.STONE]: 'stone', [NODE.GOLD]: 'gold', [NODE.BERRY]: 'berry', [NODE.FISH]: 'fish', [NODE.CLAY]: 'clay' }[k], full = { [NODE.STONE]: 200, [NODE.GOLD]: 40, [NODE.BERRY]: 30, [NODE.FISH]: 60, [NODE.CLAY]: 40 }[k] || 1, left = g.w.A[i] / full;
    if (kind && S.draw(ctx, chain('node/' + kind, left > 0.66 ? 0 : left > 0.33 ? 1 : 2, SEASON_NAMES[st.sea]), sx, sy, { t: st.T0, seed: (hash(x, y) * 997) | 0 })) return;
    if (k === NODE.FISH) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; const p = (st.T0 * 0.6 + x * 0.37) % 1; ctx.beginPath(); ctx.ellipse(sx, sy, 6 + p * 10, 3 + p * 5, 0, 0, 7); ctx.stroke(); ctx.fillStyle = '#f4b86a'; ctx.beginPath(); ctx.ellipse(sx + Math.sin(st.T0 * 2 + x) * 5, sy, 5, 2.5, 0, 0, 7); ctx.fill(); return; }
    ctx.fillStyle = 'rgba(40,60,40,.22)'; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 14, 6, 0, 0, 7); ctx.fill();
    if (k === NODE.BERRY) { [[-7, -5], [6, -6], [0, -12]].forEach(([a, b]) => { ctx.fillStyle = st.sea === 3 ? '#7f9a86' : '#4f8f4a'; ctx.beginPath(); ctx.arc(sx + a, sy + b, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#d6455d'; ctx.beginPath(); ctx.arc(sx + a + 2, sy + b, 2.5, 0, 7); ctx.fill(); }); return; }
    if (k === NODE.CLAY) { ctx.fillStyle = '#a8603a'; ctx.beginPath(); ctx.ellipse(sx, sy - 2, 13, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#7d4428'; ctx.beginPath(); ctx.ellipse(sx + 2, sy - 2, 7, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#c47a4e'; ctx.beginPath(); ctx.arc(sx - 8, sy - 6, 4, 0, 7); ctx.fill(); return; }
    const c = k === NODE.STONE ? ['#a9a49a', '#c9c4b8'] : ['#c98a3a', '#f0c860'];
    [[-6, -4, 8], [6, -5, 7], [0, -10, 9]].forEach(([a, b, r], j) => { ctx.fillStyle = c[j % 2]; ctx.beginPath(); ctx.arc(sx + a, sy + b, r, 0, 7); ctx.fill(); });
  }
  // The traveling merchant: a rider in a teal cloak and wide hat on a horse, pulling something that grows with the age:
  // a pack mule (Hamlet), a small cart (Village), a covered wagon (Town), a painted wagon with a pennant (Township).
  function drawCaravan(m) {
    const [sx, sy] = iso(m.x, m.y), d = m.dir || 1, moving = m.path && m.path.length, bob = moving ? Math.abs(Math.sin(st.T0 * 9)) * -2 : 0, back = -d;
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
      if (age >= 3) { ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + w / 2, wy - 10 - h); ctx.lineTo(wx + w / 2, wy - 40 - h); ctx.stroke(); poly([[wx + w / 2, wy - 40 - h], [wx + w / 2 + 14, wy - 36 - h + Math.sin(st.T0 * 4) * 2], [wx + w / 2, wy - 32 - h]], '#3f8f8a'); }
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + d * w / 2, wy - 12); ctx.lineTo(sx - d * 6, sy - 12); ctx.stroke();
    }
    // horse
    ctx.fillStyle = '#7a4e2e'; ctx.beginPath(); ctx.roundRect(sx - 11, sy - 18 + bob, 22, 9, 4); ctx.fill();
    for (const ox of [-8, -3, 4, 8]) ctx.fillRect(sx + ox, sy - 10, 2, 10 - (moving && ox % 2 ? Math.abs(Math.sin(st.T0 * 9)) * 3 : 0));
    ctx.beginPath(); ctx.moveTo(sx + d * 9, sy - 15 + bob); ctx.lineTo(sx + d * 17, sy - 25 + bob); ctx.lineTo(sx + d * 20, sy - 22 + bob); ctx.lineTo(sx + d * 12, sy - 12 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a2e1c'; ctx.fillRect(sx + d * 10 - 1, sy - 22 + bob, 2, 6);
    // rider: teal cloak, wide-brimmed hat, distinct from villagers
    ctx.fillStyle = '#2f7f7a'; ctx.beginPath(); ctx.roundRect(sx - 5, sy - 31 + bob, 10, 13, 4); ctx.fill();
    ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.arc(sx, sy - 34 + bob, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(sx, sy - 37 + bob, 10, 3, 0, 0, 7); ctx.fill(); ctx.fillRect(sx - 4, sy - 43 + bob, 8, 6);
  }
  function drawSapling(g, x, y) { const grow = 0.35 + 0.65 * Math.min(1, g.w.G[idx(x, y)] / 150); drawTree(x, y, 20, grow * 0.8, true); }
  const CONF = [], CONF_COL = ['#f2c94c', '#e86a8a', '#5aa9e6', '#8ad06a', '#b58be0', '#ff9a4a'];
  function confetti(x, y) { if (CONF.length < 400) CONF.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 50, c: CONF_COL[(Math.random() * 6) | 0], t: 0 }); }
  let confLast = 0;
  function drawConfetti() {
    const dt = Math.min(0.05, st.T0 - confLast); confLast = st.T0;
    for (let i = CONF.length - 1; i >= 0; i--) {
      const p = CONF[i]; p.t += dt; p.vy += 90 * dt; p.vx *= 0.98; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t > 1.6) { CONF.splice(i, 1); continue; }
      ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, (1.6 - p.t) * 2); ctx.fillRect(p.x, p.y, 3, 2 + Math.abs(Math.sin(p.t * 12)) * 2);
    }
    ctx.globalAlpha = 1;
  }
  function drawRouteDecor(g) {
    const F = g.festival; if (!F || !F.route || F.phase === 'planned') return;
    const posts = F.route.filter((_, i) => i % 3 === 0), lit = F.lanterns && st.dark > 0.15;
    let prev = null;
    posts.forEach(([x, y], k) => {
      const [px, py] = iso(x + 0.35, y - 0.35), top = [px, py - 24];
      ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(top[0], top[1]); ctx.stroke();
      if (prev) {
        ctx.strokeStyle = 'rgba(90,70,50,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.quadraticCurveTo((prev[0] + top[0]) / 2, (prev[1] + top[1]) / 2 + 8, top[0], top[1]); ctx.stroke();
        for (let j = 1; j < 4; j++) { const t = j / 4, mx = prev[0] + (top[0] - prev[0]) * t, my = prev[1] + (top[1] - prev[1]) * t + Math.sin(Math.PI * t) * 7;
          if (F.lanterns) { if (lit) { ctx.fillStyle = 'rgba(255,214,130,.35)'; ctx.beginPath(); ctx.arc(mx, my + 3, 6, 0, 7); ctx.fill(); } ctx.fillStyle = lit ? '#ffd27a' : CONF_COL[(k + j) % 6]; ctx.beginPath(); ctx.arc(mx, my + 3, 2.6, 0, 7); ctx.fill(); }
          else poly([[mx - 3, my], [mx + 3, my], [mx, my + 6]], CONF_COL[(k + j) % 6]); }
      }
      prev = top;
    });
  }
  // Night animals: a soft glow so they can be spotted in the dark, a gentle amble.
  const NIGHT_LOOK = { fox: { body: '#d9772e', belly: '#f6efe2', s: 0.9, ears: 'pointed', tail: '#e8873a' }, raccoon: { body: '#8a8a8a', belly: '#c9c9c9', s: 0.85, ears: 'round', mask: true, tail: 'rings' },
    wolf: { body: '#8f949a', belly: '#d8dce0', s: 1.15, ears: 'pointed', tail: '#7a7f86' }, bear: { body: '#6a4630', belly: '#8a5a3a', s: 1.6, ears: 'round', tail: null } };
  function nightAnimal(c, x, y) {
    const L = NIGHT_LOOK[c.type], s = L.s, d = c.dir || 1, step = c.tx != null ? Math.abs(Math.sin(st.T0 * 8 + c.id)) * 1.5 : 0;
    const gr = ctx.createRadialGradient(x, y - 8 * s, 0, x, y - 8 * s, 22 * s); gr.addColorStop(0, 'rgba(255,240,200,.28)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 8 * s, 22 * s, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(20,30,30,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 11 * s, 3.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = L.body; for (const lx of [-5, 4]) ctx.fillRect(x + lx * s * d - 1.2 * s, y - 6 * s - (lx > 0 ? step : 0), 2.4 * s, 6 * s);   // legs
    if (L.tail === 'rings') { for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#3a3a3a' : '#9a9a9a'; ctx.beginPath(); ctx.ellipse(x - (9 + k * 2.5) * s * d, y - (9 + k) * s, 2.4 * s, 2 * s, 0, 0, 7); ctx.fill(); } }
    else if (L.tail) { ctx.fillStyle = L.tail; ctx.beginPath(); ctx.ellipse(x - 10 * s * d, y - 10 * s, 6 * s, 2.6 * s, -0.5 * d, 0, 7); ctx.fill(); if (c.type === 'fox') { ctx.fillStyle = '#f6efe2'; ctx.beginPath(); ctx.arc(x - 15 * s * d, y - 13 * s, 1.8 * s, 0, 7); ctx.fill(); } }
    ctx.fillStyle = L.body; ctx.beginPath(); ctx.ellipse(x, y - 9 * s - step * 0.3, 8 * s, 4.6 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = L.belly; ctx.beginPath(); ctx.ellipse(x + 1 * s * d, y - 7.5 * s, 5 * s, 2.2 * s, 0, 0, 7); ctx.fill();
    const hx = x + 8 * s * d, hy = y - 12 * s - step * 0.3; ctx.fillStyle = L.body; ctx.beginPath(); ctx.arc(hx, hy, 3.8 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 3 * s * d, hy + 1 * s, 2.6 * s, 1.8 * s, 0, 0, 7); ctx.fill();   // snout
    if (L.ears === 'pointed') for (const e of [-1.6, 1.6]) poly([[hx + (e - 1.3) * s, hy - 2.5 * s], [hx + (e + 1.3) * s, hy - 2.5 * s], [hx + e * s, hy - 7 * s]], L.body);
    else for (const e of [-2.4, 2.4]) { ctx.beginPath(); ctx.arc(hx + e * s, hy - 3.2 * s, 1.5 * s, 0, 7); ctx.fill(); }
    if (L.mask) { ctx.fillStyle = '#2a2a2a'; ctx.fillRect(hx - 2.5 * s, hy - 1.2 * s, 5.5 * s, 1.8 * s); }
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(hx + 5.3 * s * d, hy + 0.8 * s, 0.9 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(hx + 1.5 * s * d, hy - 0.6 * s, 0.75 * s, 0, 7); ctx.fill();   // a bright eye
  }
  function drawCritters(g) {
    for (const c of g.critters || []) {
      const [x, y] = iso(c.x, c.y);
      // Art slot: critter/<type>, at its feet (fireflies and moths at their height in the air, owls up in the tree).
      if (S.draw(ctx, ['critter/' + c.type], x, y - ({ firefly: 18, moth: 22, owl: 40 }[c.type] || 0), { t: st.T0 + c.id, flip: (c.dir || 1) < 0 })) continue;
      if (NIGHT_LOOK[c.type]) { nightAnimal(c, x, y); continue; }
      if (c.type === 'firefly') { const on = 0.4 + 0.6 * Math.abs(Math.sin(st.T0 * 2 + c.id)), yy = y - 18 + Math.sin(st.T0 * 1.3 + c.id) * 4;
        const gr = ctx.createRadialGradient(x, yy, 0, x, yy, 10); gr.addColorStop(0, `rgba(230,255,140,${0.7 * on})`); gr.addColorStop(1, 'rgba(230,255,140,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, yy, 10, 0, 7); ctx.fill(); ctx.fillStyle = `rgba(250,255,200,${on})`; ctx.beginPath(); ctx.arc(x, yy, 1.8, 0, 7); ctx.fill(); }
      else if (c.type === 'moth') { const yy = y - 22 + Math.sin(st.T0 * 6 + c.id) * 3, f = Math.abs(Math.sin(st.T0 * 18 + c.id)); ctx.fillStyle = '#e8dcc4'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 3, yy, 3 * f + 0.6, 2.2, s * 0.4, 0, 7); ctx.fill(); } ctx.fillStyle = '#7a6a50'; ctx.fillRect(x - 0.6, yy - 2, 1.2, 4); }
      else if (c.type === 'frog') { const yy = y - (c.hop > 0 ? Math.sin(c.hop / 0.4 * Math.PI) * 6 : 0); ctx.fillStyle = '#5f9e4a'; ctx.beginPath(); ctx.ellipse(x, yy - 3, 5, 3.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f3e6c4'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 2.5, yy - 6, 1.6, 0, 7); ctx.fill(); } ctx.fillStyle = '#222'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 2.5, yy - 6, 0.7, 0, 7); ctx.fill(); } }
      else if (c.type === 'owl') { const yy = y - 40, bl = (st.T0 + c.id) % 4 < 0.15; ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.ellipse(x, yy, 5, 7, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#c9a77a'; ctx.beginPath(); ctx.ellipse(x, yy + 2, 3, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = bl ? '#8a6a4a' : '#f2d36a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 2.2, yy - 3, 1.7, 0, 7); ctx.fill(); } poly([[x - 4, yy - 6], [x - 2, yy - 9], [x - 1, yy - 6]], '#8a6a4a'); poly([[x + 4, yy - 6], [x + 2, yy - 9], [x + 1, yy - 6]], '#8a6a4a'); }
    }
  }
  // A fenced field for animals.
  const { outfit, drawSeasonalGround, seasonalObjects, drawSeasonalObj } = createSeasonal(K, { confetti });
  function drawFloat(p) {
    const [x, y] = iso(p[0], p[1]);
    for (const dx of [-12, 12]) { ctx.fillStyle = '#5a4028'; ctx.beginPath(); ctx.arc(x + dx, y + 2, 4, 0, 7); ctx.fill(); }
    box([x, y - 3], 0.3, 8, '#c99a5a', '#b3844a', '#e8c98a');
    for (let k = 0; k < 9; k++) { ctx.fillStyle = CONF_COL[k % 6]; ctx.beginPath(); ctx.arc(x - 14 + (k % 5) * 7, y - 13 - ((k / 5) | 0) * 5 - Math.sin(st.T0 * 3 + k) * 1, 3.2, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#7a5638'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 40); ctx.stroke();
    poly([[x, y - 40], [x + 14, y - 36], [x, y - 32]], '#5aa9e6');
    if (Math.random() < 0.15) confetti(x, y - 30);
  }
  function drawVillager(g, v, ui, ghost) {
    if (v.inside) return;
    const [sx, sy] = iso(v.x, v.y), sel = ui.sel.has(v);
    if (v.swim) { // in the water: just a head and ripples
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; for (const r of [7, 11]) { ctx.beginPath(); ctx.ellipse(sx, sy - 2, r + Math.sin(st.T0 * 3 + r) * 1.5, (r + 1) / 2.4, 0, 0, 7); ctx.stroke(); }
      ctx.fillStyle = v.skin || '#c08a5d'; ctx.beginPath(); ctx.arc(sx, sy - 5, 5, 0, 7); ctx.fill(); ctx.fillStyle = v.hair || '#3d2b20'; ctx.beginPath(); ctx.ellipse(sx, sy - 8, 6, 2.6, 0, 0, 7); ctx.fill();
      if (Math.random() < 0.03) confetti(sx, sy - 6);
      return;
    }
    if (v.act && v.act.type === 'sleep' && v.act.phase === 'sleep') {
      ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 13, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = v.col; ctx.beginPath(); ctx.roundRect(sx - 10, sy - 7, 20, 8, 4); ctx.fill();
      ctx.fillStyle = v.skin || '#c08a5d'; ctx.beginPath(); ctx.arc(sx - 12, sy - 4, 5, 0, 7); ctx.fill(); ctx.fillStyle = v.hair || '#3d2b20'; ctx.beginPath(); ctx.arc(sx - 14, sy - 5, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', sx + 3, sy - 13 - Math.sin(st.T0 * 2 + v.x) * 3);
      return;
    }
    const F = g.festival, cheering = F && F.phase === 'parade' && !v.moving && ((v.act && v.act.type === 'festival' && v.act.role === 'cheer') || v.visitor);
    const bob = cheering ? -Math.abs(Math.sin(st.T0 * 8 + v.x * 3)) * 6 : v.moving ? Math.abs(Math.sin(st.T0 * 12)) * -2.5 : 0;
    if (cheering && !ghost) { ctx.strokeStyle = v.skin || '#c08a5d'; ctx.lineWidth = 2; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx + s * 4, sy - 15 + bob); ctx.lineTo(sx + s * 8, sy - 25 + bob + Math.sin(st.T0 * 10 + s) * 2); ctx.stroke(); } if (Math.random() < 0.08) confetti(sx, sy - 26 + bob); }
    if (F && F.phase === 'parade' && v.act && v.act.type === 'festival' && v.act.role === 'march' && v.act.rank === 0) { // the banner
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx + 7, sy - 8); ctx.lineTo(sx + 7, sy - 46); ctx.stroke();
      const wv = Math.sin(st.T0 * 4) * 2; poly([[sx + 7, sy - 46], [sx + 27, sy - 44 + wv], [sx + 25, sy - 34 + wv], [sx + 7, sy - 32]], '#d9534f'); poly([[sx + 7, sy - 41], [sx + 26, sy - 40 + wv], [sx + 25.5, sy - 37 + wv], [sx + 7, sy - 37]], '#f2c94c');
    }
    if (!ghost) { ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 8, 4, 0, 0, 7); ctx.fill(); }
    if (sel) { ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 13, 6.5, 0, 0, 7); ctx.stroke(); }
    // Art slots: villager/work, villager/walk, villager/carry, villager/idle (→ villager), at the feet, mirrored when facing left.
    const pose = v.act && !v.moving && v.act.phase === 'work' ? 'work' : v.moving ? (v.carry > 0 ? 'carry' : 'walk') : 'idle';
    if (!S.draw(ctx, ['villager/' + pose, ...(pose === 'carry' ? ['villager/walk'] : []), 'villager'], sx, sy + bob, { t: st.T0 + v.id * 0.37, flip: v.dir < 0 })) {
      ctx.fillStyle = v.col; ctx.beginPath(); ctx.roundRect(sx - 5, sy - 17 + bob, 10, 14, 4); ctx.fill();
      ctx.fillStyle = v.skin || '#c08a5d'; ctx.beginPath(); ctx.arc(sx, sy - 21 + bob, 5, 0, 7); ctx.fill();
      ctx.fillStyle = v.hair || '#3d2b20'; ctx.beginPath(); ctx.ellipse(sx, sy - 24 + bob, 6.5, 2.6, 0, 0, 7); ctx.fill();
    }
    outfit(g, v, sx, sy + bob);   // festival-day clothes: costumes, hats, bunny ears, baskets
    const working = v.act && !v.moving && (v.act.phase === 'work') && ['gather', 'build', 'farm', 'plant', 'water', 'upgrade', 'craft'].includes(v.act.type);
    if (working) { const a = Math.sin(st.T0 * 14) * 0.8; ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx + 5 * v.dir, sy - 12); ctx.lineTo(sx + (5 + 9 * Math.cos(a)) * v.dir, sy - 12 - 9 * Math.sin(a) - 4); ctx.stroke(); }
    if (v.carry > 0) { ctx.fillStyle = ({ clay: '#a8603a', fiber: '#8fb06a', pottery: '#c97a4a', cloth: '#efe6d6', furniture: '#9a6a3e', jewelry: '#b58be0', stone: '#a9a49a' })[v.carryRes] || (v.carryRes === 'food' ? '#c9553d' : v.carryRes === 'water' ? '#5aa9e6' : null) || v.carryRes === 'stone' ? '#a9a49a' : v.carryRes === 'gold' ? '#e0b040' : '#9a6a3e'; ctx.fillRect(sx - 9 * v.dir - 3, sy - 13 + bob, 6, 6); }
    if (sel && !ghost) { ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,45,30,.8)'; ctx.fillStyle = '#fff'; ctx.strokeText(v.name, sx, sy - 33); ctx.fillText(v.name, sx, sy - 33); }
  }
  // A villager is hidden when a taller building is drawn in front of it.
  function occluded(g, v) {
    const pv = iso(v.x, v.y), dv = v.x + v.y;
    return g.buildings.some(b => {
      if (BUILD[b.k].flat) return false;
      if (b.x + b.y + (b.w + b.h) / 2 - 1 <= dv) return false;
      const pc = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2), h = heightOf(b, g.age) + 30;
      return Math.abs(pv[0] - pc[0]) < (b.w + b.h) * TW / 4 - 4 && pv[1] < pc[1] + (b.w + b.h) * TH / 4 && pv[1] > pc[1] - (b.w + b.h) * TH / 4 - h;
    });
  }

  function seasonColors(g) {
    const sp = (g.clock / DAY + 0.2 + 1 / 24) / (SEASON / DAY), si = Math.floor(sp) % 4, sj = (si + 1) % 4, fr = Math.max(0, (sp % 1 - 0.8) / 0.2);
    st.sea = si; gc = mix(SG[si], SG[sj], fr); fol = SF[si].map((c, i) => rgb(mix(c, SF[sj][i], fr)));
  }

  function draw(g, view, ui, now) {
    st.T0 = now / 1000; seasonColors(g); st.dark = darkness(g); st.G = g;
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
      if (t === WATER) { const s = Math.sin(st.T0 * 1.4 + x * 0.8 + y * 0.5) * 7; c = `rgb(${104 + s | 0},${172 + s | 0},${198 + s | 0})`; }
      else if (t === SAND) c = `rgb(${228 + hh / 2 | 0},${208 + hh / 2 | 0},156)`;
      else c = `rgb(${gc[0] + hh | 0},${gc[1] + hh | 0},${gc[2] + hh / 2 | 0})`;
      // Art slots: ground/water, ground/sand, ground/grass/<season>, ground/road (centred on the tile).
      const gk = t === WATER ? chain('ground/water', SEASON_NAMES[st.sea]) : t === SAND ? chain('ground/sand', SEASON_NAMES[st.sea]) : chain('ground/grass', SEASON_NAMES[st.sea]), seed = (hash(x, y) * 997) | 0;
      if (!S.draw(ctx, gk, sx, sy, { t: st.T0, centre: true, seed })) { ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1; dia(sx, sy, TW / 2, TH / 2); ctx.fill(); ctx.stroke(); }
      if (w.road[i] && S.draw(ctx, chain('ground/road', SEASON_NAMES[st.sea]), sx, sy, { centre: true, seed })) { /* road from art */ }
      else if (w.road[i]) { // the merchant road: packed earth with two faint wheel ruts
        ctx.fillStyle = st.sea === 3 ? '#d9d4c8' : '#b89a6c'; dia(sx, sy, TW / 2 - 3, TH / 2 - 1.5); ctx.fill();
        ctx.fillStyle = st.sea === 3 ? '#c9c2b4' : '#a3875c'; for (const [dx, dy] of [[-12, -1], [10, 2], [-2, 4], [4, -4]]) { ctx.beginPath(); ctx.ellipse(sx + dx + (hash(x, y) - 0.5) * 6, sy + dy, 4, 1.8, 0, 0, 7); ctx.fill(); }
      }
      if (t === 0 && w.A[i] <= 0 && w.occ[i] === 0 && hash(x + 5, y + 9) > 0.82) { const q = hash(x, y + 3); ctx.fillStyle = st.sea === 3 ? '#ffffff' : q < 0.33 ? '#f4d35e' : q < 0.66 ? '#f08fa4' : '#c7a6ee'; ctx.beginPath(); ctx.arc(sx + (hash(x, y) - 0.5) * 20, sy + (hash(y, x) - 0.5) * 8, 2.2, 0, 7); ctx.fill(); }
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
      const gh = ui.ghost || ui.hover, [pw, ph] = dims(ui.place, ui.rot || 0), okp = ui.canPlace(gh[0], gh[1]);   // the preview: where it was tapped, or under the mouse
      for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) { const [gx, gy] = iso(gh[0] + i, gh[1] + j); ctx.fillStyle = okp ? 'rgba(255,255,200,.55)' : 'rgba(220,70,60,.5)'; dia(gx, gy, TW / 2, TH / 2); ctx.fill(); }
    } else if (ui.hoverCells) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; for (const [cx, cy] of ui.hoverCells) { const p = iso(cx, cy); dia(p[0], p[1], TW / 2 - 2, TH / 2 - 1); ctx.stroke(); } }
    if (ui.selB) { ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 3; const b = ui.selB; for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) { const p = iso(b.x + i, b.y + j); dia(p[0], p[1], TW / 2 - 2, TH / 2 - 1); ctx.stroke(); } }

    drawRouteDecor(g);
    drawSeasonalGround(g);
    for (const b of g.buildings) objs.push([b.x + b.y + (b.w + b.h) / 2 - 1, 1, b]);
    for (const v of g.villagers) objs.push([v.x + v.y + 0.01, 2, v]);
    if (g.merchant && g.merchant.visit) objs.push([g.merchant.visit.x + g.merchant.visit.y + 0.02, 5, g.merchant.visit]);
    if (g.festival && g.festival.visitors) for (const v of g.festival.visitors) if (v.wait <= 0) objs.push([v.x + v.y + 0.01, 2, v]);
    if (g.festivals) for (const p of g.festivals.floats()) objs.push([p[0] + p[1] + 0.03, 6, p]);
    seasonalObjects(g, objs);
    objs.sort((a, b) => a[0] - b[0]);
    for (const o of objs) {
      if (o[1] === 0) drawNode(g, o[2], o[3]);
      else if (o[1] === 1) drawBuilding(o[2], g);
      else if (o[1] === 2) drawVillager(g, o[2], ui);
      else if (o[1] === 3) drawFire(g);
      else if (o[1] === 5) drawCaravan(o[2]);
      else if (o[1] === 6) drawFloat(o[2]);
      else if (o[1] === 7) drawSeasonalObj(o[2]);
      else drawSapling(g, o[2], o[3]);
    }
    // Villagers behind buildings show through faintly.
    drawConfetti();
    drawCritters(g);
    drawWorkBadges(g);   // who's at work where
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
    if (st.sea < 3 && nt < 0.6) for (let i = 0; i < 8; i++) { const s = i * 1.7, c = w.tc, p = iso(c.x + Math.sin(g.clock * 0.11 + s) * 9 + Math.sin(s * 5) * 6, c.y + Math.cos(g.clock * 0.09 + s * 1.3) * 9 + Math.cos(s * 3) * 6), wg = 1.5 + Math.abs(Math.sin(st.T0 * 14 + s * 3)) * 2.5, hy = p[1] - 18 - Math.sin(st.T0 * 2 + s) * 5; ctx.fillStyle = ['#f4a0b5', '#f4d35e', '#9ac8f0', '#c7a6ee'][i % 4]; ctx.beginPath(); ctx.ellipse(p[0] - 3, hy, 3, wg, -0.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(p[0] + 3, hy, 3, wg, 0.5, 0, 7); ctx.fill(); }
    // Night
    if (nt > 0.05) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = `rgba(18,28,70,${0.5 * nt})`; ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2); ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of g.buildings) { if (!b.done || BUILD[b.k].flat || BUILD[b.k].decor || b.k === 'monument' || b.k === 'well' || b.k === 'campfire') continue; const p = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2), gr = ctx.createRadialGradient(p[0], p[1] - 14, 2, p[0], p[1] - 14, 46); gr.addColorStop(0, `rgba(255,190,90,${0.2 * nt})`); gr.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = gr; ctx.fillRect(p[0] - 46, p[1] - 62, 92, 92); }
      { const p = iso(w.fire.x, w.fire.y), gr = ctx.createRadialGradient(p[0], p[1] - 6, 2, p[0], p[1] - 6, 70); gr.addColorStop(0, `rgba(255,170,70,${0.45 * nt})`); gr.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = gr; ctx.fillRect(p[0] - 70, p[1] - 76, 140, 140); }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (isNight(g)) for (const b of g.buildings) if (b.sleepers > 0) { const p = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', p[0] + 10, p[1] - 50 - Math.sin(st.T0 * 2 + b.x) * 3); }
  }
  return { draw, iso, heightOf };
}
