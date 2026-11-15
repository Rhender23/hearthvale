// "Someone is working here": a small badge over a building while villagers are at work at it, inside or on its
// doorstep, so a busy workshop reads as busy even when the worker is hidden behind it.
// The badge shows the trade's icon (a hammer for building or improving), and a count when more than one is at it.
import { BUILD } from '../../core/config.js';
import { besideRect } from '../../core/world.js';

export const TRADE_ICON = { potter: '🏺', carpenter: '🪚', weaver: '🧶', artist: '🎨', stonecutter: '⛏️', 'clay digger': '🪣', miner: '⛏️',
  jeweler: '💍', miller: '🌾', baker: '🍞', brewer: '🍺', 'hen keeper': '🐔', shepherd: '🐑', cowherd: '🐄', cheesemaker: '🧀', beekeeper: '🐝', chandler: '🕯️' };
const BUILDING = new Set(['build', 'upgrade']);   // putting up or improving the building itself

// Who is at work at each building right now: building id → { n, icon, names }.
export function workersAt(g) {
  const at = new Map();
  for (const v of g.villagers) {
    const a = v.act; if (!a || a.b == null || v.path.length || a.type === 'sleep') continue;
    const b = g.bmap.get(a.b); if (!b || BUILD[b.k].home) continue;
    if (!v.inside && !besideRect(Math.round(v.x), Math.round(v.y), b.x, b.y, b.w, b.h)) continue;
    if (a.phase && !/work|wait|learn|read|play|watch|pray|sing|here/.test(a.phase)) continue;
    const c = BUILD[b.k].craft;
    const icon = BUILDING.has(a.type) ? '🔨' : (a.type === 'craft' && c && TRADE_ICON[c.role]) || '✨';
    const e = at.get(b.id) || { n: 0, icon, names: [] }; e.n++; e.names.push(v.name); at.set(b.id, e);
  }
  return at;
}

export function createWorkerBadges(K, heightOf) {
  const { ctx, iso } = K;
  return function drawWorkBadges(g) {
    for (const [id, e] of workersAt(g)) {
      const b = g.bmap.get(id); if (!b || !b.done) continue;
      const p = iso(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2), y = p[1] - heightOf(b, g.age) - 30, w = e.n > 1 ? 34 : 22;
      ctx.fillStyle = 'rgba(255,250,236,.92)'; ctx.strokeStyle = 'rgba(90,64,40,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(p[0] - w / 2, y - 11, w, 20, 10); ctx.fill(); ctx.stroke();
      ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(e.icon, p[0] - (e.n > 1 ? 6 : 0), y);
      if (e.n > 1) { ctx.fillStyle = '#5a4028'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(String(e.n), p[0] + 9, y + 0.5); }
      ctx.textBaseline = 'alphabetic';
    }
  };
}
