import { createFigures } from '../render/villagers.js';
// Villagers inside, at true size (1.65 m), in the same cozy style as outdoors: standing, sitting, working, asleep.
// Each villager keeps their own colours (coat, skin, hair).
export function shade(hex, f) {
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
// pose: 'stand' | 'sit' | 'work' (arms forward, a little bob) | 'read' | 'cook'. facing: 1 right, -1 left.
// The 3D-rendered villagers (large sheet), in each villager's colours; until it loads, the drawn figure below.
const BIG = createFigures('art/villager/', true), FIG_POSE = { stand: 'idle', sit: 'sit', read: 'sit', work: 'work', cook: 'work' };
export function person(ctx, V, x, z, v, pose = 'stand', t = 0, facing = 1, seatY = 0.45) {
  if (BIG.ready) {
    const sit = pose === 'sit' || pose === 'read', m = V.m, k = 1.5 * m / BIG.figH, [px, py] = V.pt(x, sit ? Math.max(0, seatY - 0.2) : 0, z);
    if (!sit) { ctx.fillStyle = 'rgba(30,20,10,.14)'; ctx.beginPath(); ctx.ellipse(px, py, 0.24 * m, 0.1 * m, 0, 0, 7); ctx.fill(); }
    return BIG.draw(ctx, v, FIG_POSE[pose] || 'idle', px, py, t + (v.id || 0) * 0.37, facing < 0, k);
  }
  const [sx, sy] = V.pt(x, 0, z), m = V.m;
  const sit = pose === 'sit' || pose === 'read';
  const base = sit ? V.pt(x, seatY, z)[1] : sy, bob = pose === 'work' || pose === 'cook' ? Math.sin(t * 6) * 0.015 * m : 0;
  const coat = v.col || '#7a8ad0', skin = v.skin || '#c08a5d', hair = v.hair || '#3d2b20';
  ctx.fillStyle = 'rgba(30,20,10,.18)'; ctx.beginPath(); ctx.ellipse(sx, sy, 0.28 * m * 0.9, 0.12 * m * 0.9, 0, 0, 7); ctx.fill();
  // legs (standing) or lap (sitting)
  if (sit) { ctx.fillStyle = shade(coat, 0.7); ctx.beginPath(); ctx.roundRect(sx - 0.08 * m * facing - 0.12 * m, base - 0.12 * m, 0.42 * m, 0.14 * m, 0.06 * m); ctx.fill(); ctx.fillRect(sx + 0.16 * m * facing - 0.05 * m, base - 0.02 * m, 0.1 * m, 0.4 * m); }
  else { ctx.fillStyle = shade(coat, 0.6); ctx.fillRect(sx - 0.1 * m, sy - 0.75 * m, 0.08 * m, 0.75 * m); ctx.fillRect(sx + 0.02 * m, sy - 0.75 * m, 0.08 * m, 0.75 * m); }
  const top = (sit ? base - 0.62 * m : sy - 1.38 * m) + bob;
  // body: a soft coat
  ctx.fillStyle = coat; ctx.beginPath(); ctx.roundRect(sx - 0.18 * m, top, 0.36 * m, (sit ? 0.56 : 0.66) * m, 0.12 * m); ctx.fill();
  ctx.fillStyle = shade(coat, 1.15); ctx.fillRect(sx - 0.18 * m, top + 0.05 * m, 0.06 * m, 0.4 * m);
  // arms
  ctx.strokeStyle = coat; ctx.lineWidth = 0.09 * m; ctx.lineCap = 'round'; ctx.beginPath();
  if (pose === 'work' || pose === 'cook') { ctx.moveTo(sx + 0.12 * m * facing, top + 0.15 * m); ctx.lineTo(sx + 0.36 * m * facing, top + 0.36 * m + Math.sin(t * 6) * 0.04 * m); }
  else if (pose === 'read') { ctx.moveTo(sx + 0.14 * m, top + 0.15 * m); ctx.lineTo(sx + 0.22 * m, top + 0.38 * m); ctx.moveTo(sx - 0.14 * m, top + 0.15 * m); ctx.lineTo(sx - 0.02 * m, top + 0.38 * m); }
  else { ctx.moveTo(sx + 0.17 * m, top + 0.12 * m); ctx.lineTo(sx + 0.2 * m, top + 0.5 * m); ctx.moveTo(sx - 0.17 * m, top + 0.12 * m); ctx.lineTo(sx - 0.2 * m, top + 0.5 * m); }
  ctx.stroke();
  if (pose === 'read') { ctx.fillStyle = '#efe6d4'; ctx.fillRect(sx - 0.08 * m, top + 0.3 * m, 0.34 * m, 0.14 * m); ctx.fillStyle = '#9a5a3a'; ctx.fillRect(sx + 0.08 * m, top + 0.3 * m, 0.02 * m, 0.14 * m); }
  // head and hair
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(sx, top - 0.12 * m, 0.13 * m, 0, 7); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(sx - 0.02 * m * facing, top - 0.2 * m, 0.14 * m, 0.08 * m, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(60,30,20,.55)'; ctx.beginPath(); ctx.arc(sx + 0.05 * m * facing, top - 0.12 * m, 0.016 * m, 0, 7); ctx.fill();
}
// Asleep in a bed: a head on the pillow and the quilt drawn up. (x, z) the bed's centre; the head end is at -x when the
// bed is turned (the usual way), at -z otherwise.
export function sleeper(ctx, V, x, z, turned, v, lift = 0) {
  const y = 0.62 + lift, [hx, hy] = turned ? V.pt(x - 0.72, y, z) : V.pt(x, y, z - 0.72), m = V.m;
  ctx.fillStyle = v.skin || '#c08a5d'; ctx.beginPath(); ctx.arc(hx, hy, 0.12 * m, 0, 7); ctx.fill();
  ctx.fillStyle = v.hair || '#3d2b20'; ctx.beginPath(); ctx.ellipse(hx - 0.04 * m, hy - 0.06 * m, 0.12 * m, 0.07 * m, 0, 0, 7); ctx.fill();
  const [bx, by] = V.pt(x, y, z);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(bx, by, 0.4 * m, 0.13 * m, turned ? 0.45 : -0.45, 0, 7); ctx.fill();
}
