// The traveling merchant. Not a villager and not a Director: a visitor the engine schedules.
// Every MERCHANT.everyDays at MERCHANT.hour, if the village has a finished marketplace, a caravan
// rides in from the map edge, buys finished goods for gold (as much as the gold stores can hold),
// stays a while, then rides away. The caravan's look grows with the village's age.
// It only buys the surplus: goods the homes will use at the next goods day stay in the stores.
// While it is at the marketplace you can buy its wares (stone, decoration plans) for gold.
// It arrives along the road from the map edge.
import { N, MERCHANT, GOODS, BUILD } from './config.js';
import { walkable, besideRect, idx } from './world.js';
import { notice, cap, hasMarket, canStore } from './state.js';
import { homeGoodsNeed } from './directors.js';
import { bfsVisitor, visitorEdge, visitorPassable, besideTile } from './path.js';

export const priceOf = (g, r) => Math.round(MERCHANT.price[r] * (1 + MERCHANT.ageBonus * g.age));
export const warePrice = (g, w) => w.repeat ? Math.round(w.price * (1 + MERCHANT.ageBonus * g.age)) : w.price;
// Wares on offer: repeatable goods, plus plans the village does not have yet (and whose age has come).
export const waresFor = g => MERCHANT.wares.filter(w => (w.age || 0) <= g.age && !(w.unlock && g.unlocked[w.unlock]));
export const surplus = (g, r) => Math.max(0, Math.floor(g.res[r]) - (homeGoodsNeed(g)[r] || 0));
export const daysToMerchant = g => { const r = g.dawns % MERCHANT.everyDays; return r === 0 ? 0 : MERCHANT.everyDays - r; };

export function createMerchant(g) {
  const M = {
    visit: null, // { x, y, path, phase: 'arrive' | 'trade' | 'leave', t, age }
    tick(dt) {
      const v = this.visit;
      if (!v) {
        if (g.crossed.includes(MERCHANT.hour) && g.dawns > 0 && g.dawns % MERCHANT.everyDays === 0 && hasMarket(g)) this.arrive();
        return;
      }
      if (v.path.length) {
        const [nx, ny] = v.path[0];
        if (!visitorPassable(g.w, nx, ny)) { v.path = []; return; }
        const dx = nx - v.x, dy = ny - v.y, d = Math.hypot(dx, dy), st = MERCHANT.speed * dt;
        if (dx - dy !== 0) v.dir = dx - dy > 0 ? 1 : -1;
        if (d <= st) { v.x = nx; v.y = ny; v.path.shift(); } else { v.x += dx / d * st; v.y += dy / d * st; }
        return;
      }
      const market = g.buildings.find(b => b.k === 'market' && b.done);
      if (v.phase === 'arrive') {
        if (!market) { this.leave(); return; }
        if (besideRect(Math.round(v.x), Math.round(v.y), market.x, market.y, market.s)) { v.phase = 'trade'; v.t = MERCHANT.stay; this.trade(); }
        else { const p = bfsVisitor(g.w, Math.round(v.x), Math.round(v.y), (x, y) => besideRect(x, y, market.x, market.y, market.s)); if (p) v.path = p; else this.leave(); }
      } else if (v.phase === 'trade') {
        v.t -= dt;
        if (v.t <= 0) this.leave();
      } else if (v.phase === 'leave') {
        this.visit = null;
      }
    },
    arrive() {
      const market = g.buildings.find(b => b.k === 'market' && b.done), start = market && besideTile(g.w, market, visitorPassable);
      const edge = g.w.roadEnd || (start && visitorEdge(g.w, start[0], start[1]));
      const p = edge && bfsVisitor(g.w, edge[0], edge[1], (a, b) => besideRect(a, b, market.x, market.y, market.s));
      if (!p) { notice(g, 'A merchant caravan could not find a road to the marketplace.'); return; }
      const [x, y] = edge;
      this.visit = { x, y, path: p, phase: 'arrive', t: 0, age: g.age, dir: 1, home: [x, y] };
      notice(g, 'A merchant caravan is on the road to the marketplace.');
      g.events.emit('merchant', 'arrive');
    },
    trade() {
      const sold = {}; let earned = 0;
      for (const r of GOODS) {
        if (!MERCHANT.price[r]) continue;
        const p = priceOf(g, r);
        let left = surplus(g, r);
        while (left-- >= 1 && g.res.gold + p <= cap(g, 'gold')) { g.res[r] -= 1; g.res.gold += p; earned += p; sold[r] = (sold[r] || 0) + 1; }
      }
      g.today.in.gold = (g.today.in.gold || 0) + earned;
      const list = Object.entries(sold).map(([r, n]) => `${n} ${r}`);
      notice(g, list.length ? `The merchant bought ${list.join(', ')} for ${earned} gold.` : (GOODS.some(r => MERCHANT.price[r] && surplus(g, r) >= 1) ? 'The merchant would buy more, but there is no room left for gold.' : GOODS.some(r => MERCHANT.price[r] && g.res[r] >= 1) ? 'The merchant found nothing to spare: the homes need every good in the stores.' : 'The merchant found nothing to buy this time.'));
      g.events.emit('merchant', 'trade', { sold, earned });
      this.lastTrade = { sold, earned, day: g.dawns };
    },
    // Buy one of the merchant's wares. Only while the caravan is at the marketplace.
    buy(id) {
      const v = this.visit, w = MERCHANT.wares.find(x => x.id === id);
      if (!v || v.phase !== 'trade') return { ok: false, reason: 'The merchant is not at the marketplace.' };
      if (!w || !waresFor(g).includes(w)) return { ok: false, reason: 'The merchant does not have that.' };
      const p = warePrice(g, w);
      if (g.res.gold < p) return { ok: false, reason: `That costs ${p} gold.` };
      if (w.gives) for (const r in w.gives) if (g.res[r] + w.gives[r] > cap(g, r)) return { ok: false, reason: `There is no room for more ${r}.` };
      g.res.gold -= p; g.today.out.gold = (g.today.out.gold || 0) + p;
      if (w.gives) for (const r in w.gives) { g.res[r] += w.gives[r]; g.today.in[r] = (g.today.in[r] || 0) + w.gives[r]; }
      if (w.unlock) { g.unlocked[w.unlock] = true; notice(g, `The village can now build ${BUILD[w.unlock].name.toLowerCase()}s.`); }
      g.events.emit('bought', w);
      return { ok: true };
    },
    leave() {
      const v = this.visit; if (!v) return;
      v.phase = 'leave';
      const [hx, hy] = v.home, p = bfsVisitor(g.w, Math.round(v.x), Math.round(v.y), (x, y) => x === hx && y === hy);
      v.path = p || [];
      if (!p) this.visit = null;
    },
  };
  return M;
}
