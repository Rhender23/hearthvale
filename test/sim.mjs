// Headless village run: prints what the village built, when and why, plus a daily summary.
//   node test/sim.mjs [seed=8] [days=24] [freeBuild=1]
import { createGame, update } from '../js/core/game.js';
import { DAY, WAKE } from '../js/core/config.js';
import { levelName } from '../js/core/state.js';
const [seed = 8, days = 24, fb = 1] = process.argv.slice(2).map(Number);
const g = createGame({ seed, sandbox: false });
g.freeBuild = !!fb; g.freeWill = true;
const log = [];
g.events.on('planned', ({ b, why }) => log.push(`d${(g.clock / DAY).toFixed(1)} ${b.k} — ${why}`));
g.events.on('age', a => log.push(`d${(g.clock / DAY).toFixed(1)} *** AGE ${a}`));
let lastDay = -1; const t0 = Date.now();
while (g.clock < days * DAY) {
  update(g, 0.05);
  const d = Math.floor(g.clock / DAY);
  if (d !== lastDay && d % 4 === 0) { lastDay = d; const homes = g.buildings.filter(b => b.k === 'house' && b.done).map(b => b.lvl); log.push(`== day ${d} pop ${g.villagers.length} age ${g.age} culture ${Math.floor(g.culture)} homes [${homes.join(',')}] food ${Math.floor(g.res.food)} wood ${Math.floor(g.res.wood)} stone ${Math.floor(g.res.stone)} gold ${Math.floor(g.res.gold)} furn ${Math.floor(g.res.furniture)}`); }
}
const count = {}; for (const b of g.buildings) count[b.k] = (count[b.k] || 0) + 1;
console.log(log.join('\n')); console.log('buildings', JSON.stringify(count)); console.log('secs', ((Date.now() - t0) / 1000).toFixed(0));
const { homeScore } = await import('../js/core/beauty.js');
const { TIERS } = await import('../js/core/config.js');
const { shopNear } = await import('../js/core/directors.js');
for (const h of g.buildings.filter(b => b.k === 'house' && b.done)) { const t = TIERS.house, nx = t[h.lvl + 1]; console.log(`home@${h.x},${h.y} lvl ${h.lvl} score ${homeScore(g, h).toFixed(2)} next need ${nx && nx.need} goods ${nx && (nx.goods || []).join('/')} shop ${shopNear(g, h)} pending ${h.pending}`); }
const C = g.manager.directors.find(d => d.name === 'Construction'); console.log('top candidates', JSON.stringify((C.eval || []).map(c => `${c.k}${c.for !== c.k ? '<' + c.for : ''} ${c.score.toFixed(2)} ${c.why}`), null, 1));
console.log('res', JSON.stringify(Object.fromEntries(Object.entries(g.res).map(([k, v]) => [k, Math.floor(v)]))));
