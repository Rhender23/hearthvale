// Drawing primitives shared by every part of the renderer, bound to one canvas context.
// st holds what changes every frame: T0 (seconds), dark (0..1 night), sea (season colour index), G (the game).
import { TW, TH } from '../../core/config.js';
import { createSprites } from './sprites.js';
export const iso = (x, y) => [(x - y) * TW / 2, (x + y) * TH / 2];
export function createKit(ctx) {
  const st = { T0: 0, dark: 0, sea: 0, G: null };
  const dia = (cx, cy, hw, hh) => { ctx.beginPath(); ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath(); };
  const poly = (pts, f) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); };
  const upp = (p, u) => [p[0], p[1] - u], mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const cor = b => [iso(b.x - 0.5, b.y - 0.5), iso(b.x + b.w - 0.5, b.y - 0.5), iso(b.x + b.w - 0.5, b.y + b.h - 0.5), iso(b.x - 0.5, b.y + b.h - 0.5)];
  const box = (c, e, h, cl, cr, ct) => { const t = [c[0], c[1] - e * TH], r = [c[0] + e * TW, c[1]], d = [c[0], c[1] + e * TH], l = [c[0] - e * TW, c[1]]; poly([l, d, upp(d, h), upp(l, h)], cl); poly([d, r, upp(r, h), upp(d, h)], cr); poly([upp(t, h), upp(r, h), upp(d, h), upp(l, h)], ct); };
  const walls = (b, h, w) => { const [tp, rt, bt, lf] = cor(b); poly([lf, bt, upp(bt, h), upp(lf, h)], w[0]); poly([bt, rt, upp(rt, h), upp(bt, h)], w[1]); return [tp, rt, bt, lf]; };
  const door = (p, q, w, h, c) => { const d = mid(p, q), s = (q[1] - p[1]) / (q[0] - p[0]); poly([[d[0] - w, d[1] - s * w], [d[0] + w, d[1] + s * w], [d[0] + w, d[1] + s * w - h], [d[0] - w, d[1] - s * w - h]], c); };
  const c0 = b => iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2);
  const sprites = createSprites();
  return { ctx, iso, st, dia, poly, upp, mid, lerp, cor, box, walls, door, c0, sprites };
}
