// Fishing: the float bobs on the water; after a little while it dips and a ring shows around it. Tap while it is down.
// Any tap catches something; a tap right as it dips catches the most. Then cast again, or close.
import { el } from '../dom.js';
import { openPlay } from './overlay.js';
import { landFish } from '../../core/handson.js';

export function openFishing({ g, ui, i, say, buzz }) {
  const o = openPlay({ title: 'Fishing', sub: 'Tap when the float dips.', ui });
  const W = 300, H = 200, cv = el('canvas', { className: 'play-canvas' }); cv.width = W * 2; cv.height = H * 2; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const msg = el('div', { className: 'play-msg', textContent: 'Waiting for a bite…' });
  o.body.append(cv, msg);
  const ctx = cv.getContext('2d'); ctx.scale(2, 2);
  let t0 = performance.now(), biteAt = 1.6 + Math.random() * 2.6, state = 'wait', landed = 0, raf = 0, splash = 0;
  const cast = () => { t0 = performance.now(); biteAt = 1.4 + Math.random() * 2.8; state = 'wait'; msg.textContent = 'Waiting for a bite…'; };
  function draw() {
    const t = (performance.now() - t0) / 1000;
    if (state === 'wait' && t > biteAt + 1.4) state = 'wait', biteAt = t + 1 + Math.random() * 2;   // missed the dip: it will bite again
    const dip = state === 'wait' ? Math.max(0, 1 - Math.abs(t - biteAt - 0.35) / 0.35) : 0;
    // water, reeds, the far bank
    const g2 = ctx.createLinearGradient(0, 0, 0, H); g2.addColorStop(0, '#9cc4d4'); g2.addColorStop(1, '#5f8fa8'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#7aa65a'; ctx.beginPath(); ctx.moveTo(0, 40); ctx.quadraticCurveTo(W * 0.4, 22, W, 36); ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.fill();
    for (let k = 0; k < 6; k++) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; const y = 60 + k * 24, x = (k * 53 + t * 12) % (W + 60) - 30; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y - 3, x + 30, y); ctx.stroke(); }
    ctx.strokeStyle = '#4f7a3a'; ctx.lineWidth = 2; for (let k = 0; k < 7; k++) { const x = 12 + k * 7; ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + Math.sin(t + k) * 4, H - 30, x + 2, H - 50 - (k % 3) * 10); ctx.stroke(); }
    // the line and float
    const fx = W * 0.6, fy = 120 + Math.sin(t * 2.2) * 2 + dip * 9;
    ctx.strokeStyle = 'rgba(60,45,30,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(W, 10); ctx.quadraticCurveTo(W * 0.8, 40, fx, fy - 8); ctx.stroke();
    if (dip > 0.05) { ctx.strokeStyle = `rgba(255,255,255,${0.8 * dip})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fx, fy + 4, 14 + (1 - dip) * 12, 5 + (1 - dip) * 4, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#efe6d6'; ctx.beginPath(); ctx.ellipse(fx, fy, 5, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.ellipse(fx, fy - 3, 5, 4, 0, Math.PI, 0); ctx.fill();
    if (splash > 0) { splash -= 0.03; ctx.fillStyle = `rgba(255,255,255,${splash})`; for (let k = 0; k < 8; k++) { const a = k * 0.8; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 18 * (1 - splash), fy - 10 * Math.sin(a * 0.5) * (1 - splash) * 2, 2.5, 0, 7); ctx.fill(); } }
    ctx.fillStyle = '#4a3b2a'; ctx.font = '13px Georgia, serif'; ctx.fillText(`Caught today: ${landed} 🐟`, 10, H - 10);
    if (o.card.isConnected) raf = requestAnimationFrame(draw);
    draw.dip = dip; draw.t = t;
  }
  cv.addEventListener('pointerdown', () => {
    if (state !== 'wait') { cast(); return; }
    const t = draw.t || 0, q = draw.dip || (t > biteAt - 0.4 && t < biteAt + 1.2 ? 0.3 : 0);
    const r = landFish(g, i, q);
    if (!r.ok) { msg.textContent = r.reason; state = 'done'; return; }
    landed += r.n; splash = 1; buzz && buzz(q > 0.85 ? 20 : 8);
    msg.textContent = q > 0.85 ? `A beauty! +${r.n} 🐟 Tap to cast again.` : q > 0.5 ? `A good one. +${r.n} 🐟 Tap to cast again.` : `A little one. +${r.n} 🐟 Tap to cast again.`;
    state = 'caught';
  });
  draw();
  return o;
}
