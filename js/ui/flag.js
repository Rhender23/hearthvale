// The village flag: a field colour, a pattern in a second colour, and an emblem. Designed under Village → Village flag;
// flown on the flagpole and the town center, hung in the great hall, and shown on save slots.
//   drawFlag(ctx, flag, x, y, w, h, t)   x, y: the top of the edge at the pole; waves with time t (0 for still)
export const FLAG_COLOURS = ['#4f7fb5', '#b5523e', '#5f8a44', '#e0b040', '#7a5a9a', '#f3ead8', '#3a4a5a', '#c97a4a', '#7fa3b0', '#e86a8a'];
export const PATTERNS = ['plain', 'stripe', 'bands', 'cross', 'chevron', 'quarters', 'border', 'diagonal'];
export const EMBLEMS = ['none', 'leaf', 'star', 'sun', 'moon', 'heart', 'acorn', 'fish', 'house', 'flower'];
export const DEFAULT_FLAG = { bg: '#4f7fb5', fg: '#f3ead8', pattern: 'bands', emblem: 'leaf', ec: '#e0b040' };

// Emblem shapes on a unit square (0..1), filled with the emblem colour.
function emblem(ctx, kind, cx, cy, s) {
  ctx.beginPath();
  const P = (u, v) => [cx + (u - 0.5) * s, cy + (v - 0.5) * s];
  const poly = pts => { pts.forEach(([u, v], i) => { const [x, y] = P(u, v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };
  switch (kind) {
    case 'leaf': { const [a, b] = P(0.2, 0.8), [c, d] = P(0.8, 0.2); ctx.moveTo(a, b); ctx.quadraticCurveTo(...P(0.1, 0.1), c, d); ctx.quadraticCurveTo(...P(0.9, 0.9), a, b); break; }
    case 'star': poly(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.22 : 0.5, a = -Math.PI / 2 + i * Math.PI / 5; return [0.5 + Math.cos(a) * r, 0.52 + Math.sin(a) * r]; })); break;
    case 'sun': { const [x, y] = P(0.5, 0.5); ctx.arc(x, y, s * 0.24, 0, 7); ctx.fill(); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.3); ctx.lineTo(x + Math.cos(a + 0.2) * s * 0.46, y + Math.sin(a + 0.2) * s * 0.46); ctx.lineTo(x + Math.cos(a - 0.2) * s * 0.46, y + Math.sin(a - 0.2) * s * 0.46); } break; }
    case 'moon': { const [x, y] = P(0.5, 0.5); ctx.arc(x, y, s * 0.4, 0.6, 5.7); ctx.arc(x + s * 0.16, y - s * 0.04, s * 0.32, 5.4, 0.9, true); break; }
    case 'heart': { const [x, y] = P(0.5, 0.82); ctx.moveTo(x, y); ctx.bezierCurveTo(...P(0.05, 0.5), ...P(0.15, 0.1), ...P(0.5, 0.32)); ctx.bezierCurveTo(...P(0.85, 0.1), ...P(0.95, 0.5), x, y); break; }
    case 'acorn': { const [x, y] = P(0.5, 0.6); ctx.ellipse(x, y, s * 0.22, s * 0.28, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(x, y - s * 0.2, s * 0.28, s * 0.13, 0, Math.PI, 0); const [sx, sy] = P(0.5, 0.18); ctx.rect(sx - s * 0.03, sy, s * 0.06, s * 0.1); break; }
    case 'fish': { const [x, y] = P(0.42, 0.5); ctx.ellipse(x, y, s * 0.3, s * 0.17, 0, 0, 7); ctx.fill(); ctx.beginPath(); poly([[0.68, 0.5], [0.92, 0.3], [0.92, 0.7]]); break; }
    case 'house': poly([[0.18, 0.5], [0.5, 0.18], [0.82, 0.5], [0.74, 0.5], [0.74, 0.84], [0.26, 0.84], [0.26, 0.5]]); break;
    case 'flower': { const [x, y] = P(0.5, 0.5); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.moveTo(x, y); ctx.ellipse(x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.2, s * 0.15, s * 0.15, 0, 0, 7); } break; }
    default: return;
  }
  ctx.fill();
}

// The design on a flat w×h rectangle at (0, 0).
export function paintFlag(ctx, f, w, h) {
  f = f || DEFAULT_FLAG;
  ctx.fillStyle = f.bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = f.fg;
  switch (f.pattern) {
    case 'stripe': ctx.fillRect(0, h * 0.4, w, h * 0.2); break;
    case 'bands': ctx.fillRect(0, 0, w, h / 3); ctx.fillRect(0, h * 2 / 3, w, h / 3); break;
    case 'cross': ctx.fillRect(w * 0.3, 0, w * 0.14, h); ctx.fillRect(0, h * 0.42, w, h * 0.16); break;
    case 'chevron': ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.42, h / 2); ctx.lineTo(0, h); ctx.fill(); break;
    case 'quarters': ctx.fillRect(0, 0, w / 2, h / 2); ctx.fillRect(w / 2, h / 2, w / 2, h / 2); break;
    case 'border': { const b = Math.min(w, h) * 0.12; ctx.fillRect(0, 0, w, h); ctx.fillStyle = f.bg; ctx.fillRect(b, b, w - 2 * b, h - 2 * b); break; }
    case 'diagonal': ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.3); ctx.lineTo(w * 0.3, h); ctx.fill(); break;
  }
  if (f.emblem && f.emblem !== 'none') { ctx.fillStyle = f.ec; const cx = f.pattern === 'cross' ? w * 0.37 : f.pattern === 'chevron' ? w * 0.16 : w / 2; emblem(ctx, f.emblem, cx, h / 2, Math.min(w, h) * (f.pattern === 'chevron' ? 0.36 : 0.62)); }
}

// Flown from a pole: drawn in vertical slices, each nudged by a gentle wave that grows toward the free end.
let tmp = null;
export function drawFlag(ctx, f, x, y, w, h, t = 0, dir = 1) {
  const W = Math.ceil(w * 2), H = Math.ceil(h * 2);
  if (!tmp) tmp = document.createElement('canvas');
  if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
  const c = tmp.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, w, h); paintFlag(c, f, w, h);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const u = i / n, dy = t ? Math.sin(t * 3 - u * 5) * u * h * 0.12 : 0, shade = t ? 0.06 * Math.cos(t * 3 - u * 5) : 0;
    const dx = dir > 0 ? x + u * w : x - (u + 1 / n) * w;
    ctx.drawImage(tmp, (dir > 0 ? u : 1 - u - 1 / n) * W, 0, W / n + 1, H, dx, y + dy, w / n + 0.5, h);
    if (shade) { ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`; ctx.fillRect(dx, y + dy, w / n + 0.5, h); }
  }
}
