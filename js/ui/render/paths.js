// Paths drawn as one joined ribbon. Each path tile draws a band from its middle out to every neighbouring path (eight
// directions; a diagonal only where no straight neighbour already makes the turn), so neighbours meet edge to edge and
// never lie on top of each other. The surface (dirt, gravel, stone setts, brick, tile) is laid on a pattern fixed to the
// ground, not to the tile, so the joins can't be seen.
import { TW, TH } from '../../core/config.js';
import { idx, inMap } from '../../core/world.js';
import { hash } from '../../core/rng.js';

const KIND = ['dirt', 'gravel', 'stone', 'brick', 'tile'];
// half width of the band in tiles, the edge (kerb or worn grass) colour and width, the surface colour
const LOOK = {
  dirt:   { hw: 0.24, edge: 'rgba(150,120,80,.35)', ew: 0.09, base: '#a88a5e' },
  gravel: { hw: 0.28, edge: 'rgba(120,104,78,.45)', ew: 0.05, base: '#cdbd96' },
  stone:  { hw: 0.31, edge: '#6f6a62', ew: 0.04, base: '#8f8a80' },
  brick:  { hw: 0.31, edge: '#6a3426', ew: 0.04, base: '#9a8a76' },
  tile:   { hw: 0.31, edge: '#857a68', ew: 0.04, base: '#d8cbb0' },
};
const STRAIGHT = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export const pathKind = b => KIND[Math.min(KIND.length - 1, b.lvl || 0)];

// Which ways this stretch joins: a list of [dx, dy].
export function arms(G, b) {
  const at = (x, y) => { if (!inMap(x, y)) return false; const id = G.w.occ[idx(x, y)], o = id > 0 && G.bmap.get(id); return !!o && o.k === 'path'; };
  const out = STRAIGHT.filter(([dx, dy]) => at(b.x + dx, b.y + dy));
  for (const [dx, dy] of DIAG) if (at(b.x + dx, b.y + dy) && !at(b.x + dx, b.y) && !at(b.x, b.y + dy)) out.push([dx, dy]);
  return out;
}

// Drawn once per look and kept: the kind, which ways it joins, and one of three variations of its stones. (The pattern
// is fixed to the ground, so tiles with the same key look the same; the variation keeps a long road from repeating.)
const CACHE = new Map(), RES = 3, CW = Math.ceil(TW * 1.8), CH = Math.ceil(TH * 1.8);
export function drawPath(ctx, G, b, c) {
  const kind = pathKind(b), A = arms(G, b), v = Math.floor(hash(b.x * 3 + 1, b.y * 5 + 2) * 3);
  const key = kind + A.map(a => a.join('')).sort().join('|') + v + (b.x & 1) + (b.y & 1);
  let im = CACHE.get(key);
  if (!im && typeof document !== 'undefined') {
    im = document.createElement('canvas'); im.width = CW * RES; im.height = CH * RES;
    const x = im.getContext('2d'); x.scale(RES, RES);
    paint(x, { x: (b.x & 1) + 2 * v, y: (b.y & 1) + 2 * v, lvl: b.lvl }, [CW / 2, CH / 2], kind, A);
    CACHE.set(key, im);
  }
  if (im) ctx.drawImage(im, c[0] - CW / 2, c[1] - CH / 2, CW, CH);
  else paint(ctx, b, c, kind, A);
}

function paint(ctx, b, c, kind, A) {
  const L = LOOK[kind];
  // tile-space offset (u, v) from this tile's middle -> screen
  const P = (u, v) => [c[0] + (u - v) * TW / 2, c[1] + (u + v) * TH / 2];
  const band = hw => {
    ctx.beginPath();
    const ring = 10; for (let k = 0; k < ring; k++) { const a = k / ring * Math.PI * 2, p = P(Math.cos(a) * hw, Math.sin(a) * hw); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.closePath();
    for (const [dx, dy] of A) {
      const len = Math.hypot(dx, dy), px = -dy / len * hw, py = dx / len * hw, ex = dx * 0.5, ey = dy * 0.5;
      // a little past the edge so the two halves overlap by a hair (no seam from anti-aliasing)
      const fx = ex + dx / len * 0.02, fy = ey + dy / len * 0.02;
      const q = [P(-px, -py), P(fx - px, fy - py), P(fx + px, fy + py), P(px, py)];   // same turning as the middle, so they join
      ctx.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]); ctx.closePath();
    }
  };
  ctx.save();
  band(L.hw + L.ew); ctx.fillStyle = L.edge; ctx.fill('nonzero');
  band(L.hw); ctx.fillStyle = L.base; ctx.fill('nonzero');
  ctx.clip('nonzero');
  surface(ctx, kind, b, P);
  ctx.restore();
}

// The surface pattern, fixed to the ground: cells are counted from the map's own grid, so a neighbour drawing the same
// cell draws it identically.
function surface(ctx, kind, b, P) {
  const R = 0.85;   // how far from the middle to lay pattern (covers diagonal arms)
  if (kind === 'dirt') {
    for (let k = 0; k < 14; k++) { const u = (hash(b.x * 31 + k, b.y * 17) - 0.5) * 1.2, v = (hash(b.y * 13 + k, b.x * 7 + 3) - 0.5) * 1.2, p = P(u, v); ctx.fillStyle = k % 3 ? 'rgba(120,94,62,.5)' : '#c4ab82'; ctx.fillRect(p[0], p[1], 1.5, 1); }
    return;
  }
  if (kind === 'gravel') {
    for (let k = 0; k < 40; k++) { const u = (hash(b.x * 97 + k, b.y * 53) - 0.5) * 1.4, v = (hash(b.y * 61 + k, b.x * 29 + 1) - 0.5) * 1.4, p = P(u, v); ctx.fillStyle = ['#b9a883', '#ece0c4', '#a39374', '#d9ccaa'][k % 4]; ctx.fillRect(p[0], p[1], 1.6, 1.1); }
    return;
  }
  // stone setts, bricks and tiles: a grid in ground space
  const n = kind === 'tile' ? 3 : 4, step = 1 / n;
  for (let j = -Math.ceil(R * n); j <= Math.ceil(R * n); j++) for (let i = -Math.ceil(R * n); i <= Math.ceil(R * n); i++) {
    const gx = b.x * n + i, gy = b.y * n + j, h = hash(gx * 7 + 11, gy * 13 + 5);
    if (kind === 'stone') {   // rounded setts in staggered rows
      const off = (gy & 1) ? step / 2 : 0, u = i * step + off, v = j * step, p = P(u, v);
      ctx.fillStyle = ['#b8b2a6', '#a9a397', '#c4beb2', '#9d978b'][Math.floor(h * 4)];
      ctx.beginPath(); ctx.ellipse(p[0], p[1], step * TW * 0.36, step * TH * 0.36, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(p[0] - 1, p[1] - 1, step * TW * 0.16, step * TH * 0.14, 0, 0, 7); ctx.fill();
    } else if (kind === 'brick') {   // running bond: bricks half a cell long across, offset every row
      const off = (gy & 1) ? 0.5 : 0, u0 = (i + off) * step - step / 2 + 0.01, v0 = j * step - step / 2 + 0.012, u1 = u0 + step - 0.02, v1 = v0 + step / 2 - 0.02;
      for (const vv of [v0, v0 + step / 2]) {
        const q = [P(u0, vv), P(u1, vv), P(u1, vv + (v1 - v0)), P(u0, vv + (v1 - v0))];
        ctx.fillStyle = ['#b5523e', '#a84a36', '#c0634a', '#9c4432'][Math.floor(hash(gx * 3 + (vv > v0 ? 1 : 0), gy * 5) * 4)];
        ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]); ctx.closePath(); ctx.fill();
      }
    } else {   // tile: square tiles, a cream and blue-grey check with a darker grout
      const u0 = i * step - step / 2 + 0.012, v0 = j * step - step / 2 + 0.012, s = step - 0.024;
      const q = [P(u0, v0), P(u0 + s, v0), P(u0 + s, v0 + s), P(u0, v0 + s)];
      ctx.fillStyle = ((gx + gy) & 1) ? '#7fa3b0' : '#efe4cc';
      ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]); ctx.closePath(); ctx.fill();
    }
  }
}
