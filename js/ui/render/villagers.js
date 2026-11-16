// Villagers from the 3D-rendered sheet (tools/villagers3d.py): one figure in every pose, split into layers so each
// villager wears their own colours. Each villager's tinted frames are made once and kept (the most recent 160).
//   const fig = createFigures(); fig.draw(ctx, v, pose, x, y, t, flip) -> false until the sheet has loaded
import { hash } from '../../core/rng.js';

const LEGS = ['#5a4a3a', '#4a4f5a', '#6a5a44', '#3f4a3a', '#5a4048', '#4a3b2a'];   // trousers and skirts, muted
export const legsOf = v => LEGS[Math.floor(hash(v.id * 7 + 3, 11) * LEGS.length)];

export function createFigures(base = 'art/villager/', big = false) {
  let man = null, img = null;
  const cache = new Map(), MAX = big ? 60 : 600;
  try {
    fetch(base + 'manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(m => {
      if (!m) return; const M = big ? m.big : m; if (!M) return;
      const i = new Image(); i.onload = () => { man = M; img = i; }; i.src = base + (M.file || 'sheet.png');
    }).catch(() => {});
  } catch (e) { /* tests: no fetch */ }

  // One frame in one villager's colours: the base, then each layer multiplied by its colour. Kept for reuse.
  function frame(cols, f) {
    const key = cols.join() + '|' + f;
    let c = cache.get(key);
    if (c) { cache.delete(key); cache.set(key, c); return c; }
    const W = man.w, H = man.h, sx = f * W;
    c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), t = document.createElement('canvas'); t.width = W; t.height = H; const tx = t.getContext('2d');
    x.drawImage(img, sx, 0, W, H, 0, 0, W, H);
    cols.forEach((col, k) => {
      tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, W, H); tx.drawImage(img, sx, (k + 1) * H, W, H, 0, 0, W, H);
      tx.globalCompositeOperation = 'multiply'; tx.fillStyle = col; tx.fillRect(0, 0, W, H);
      tx.globalCompositeOperation = 'destination-in'; tx.drawImage(img, sx, (k + 1) * H, W, H, 0, 0, W, H);
      x.drawImage(t, 0, 0);
    });
    cache.set(key, c);
    if (cache.size > MAX) cache.delete(cache.keys().next().value);
    return c;
  }

  return {
    get ready() { return !!man; },
    get figH() { return man ? man.figH : 0; },
    has: pose => !!(man && man.poses[pose]),
    // At ground point (x, y). k: pixels on screen per sheet pixel (default the art scale); or give height in pixels.
    draw(ctx, v, pose, x, y, t, flip, k) {
      if (!man) return false;
      const P = man.poses[pose] || man.poses.idle;
      const f = P.start + (P.frames > 1 ? Math.floor(t * P.fps) % P.frames : 0);
      const im = frame([v.skin || '#c08a5d', v.col || '#b5523e', legsOf(v), v.hair || '#3d2b20'], f);
      k = k || man.scale || 0.5; const [ax, ay] = man.anchor, w = man.w, h = man.h;
      if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(im, -ax * k, -ay * k, w * k, h * k); ctx.restore(); }
      else ctx.drawImage(im, x - ax * k, y - ay * k, w * k, h * k);
      return true;
    },
  };
}
