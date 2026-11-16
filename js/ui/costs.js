// Costs as icons and numbers, red where the village is short, and the next step for a selected building:
// what it becomes, what that costs and what it still needs. Shown whenever something is selected, never hidden.
import { ICON, TIERS } from '../core/config.js';
import { improveInfo } from '../core/commands.js';
import { el } from './dom.js';

export function costEl(G, cost, cls = 'pc') {
  const e = el('span', { className: cls });
  const parts = Object.entries(cost || {}).filter(([, n]) => n);
  if (!parts.length) { e.textContent = 'Free'; return e; }
  for (const [r, n] of parts) e.append(el('span', { className: 'cost' + ((G.res[r] || 0) < n ? ' short' : ''), textContent: `${n}${ICON[r] || ' ' + r} ` }));
  return e;
}
const key = (G, cost) => Object.entries(cost || {}).map(([r, n]) => `${r}${n}${(G.res[r] || 0) < n ? '!' : ''}`).join();

// { title, cost, needs } for a finished building with levels; null otherwise.
export function nextStep(G, b) {
  if (!b || !b.done || !TIERS[b.k]) return null;
  const i = improveInfo(G, b);
  if (!i.next) return { title: i.reason, cost: null, needs: null };
  const cost = i.cost || TIERS[b.k][b.lvl + 1].cost;
  return { title: `Next: ${i.next.name}`, cost, needs: i.reason || null };
}

// The line under a bubble's heading, kept live by refreshStep.
export function stepEl(G, b) {
  const s = nextStep(G, b); if (!s) return null;
  const e = el('div', { className: 'pstep' });
  fillStep(G, e, s); return e;
}
function fillStep(G, e, s) {
  e.dataset.k = s.title + key(G, s.cost) + (s.needs || '');
  e.replaceChildren(el('b', { textContent: s.title + (s.cost ? ' · ' : '') }), ...(s.cost ? [costEl(G, s.cost)] : []), ...(s.needs ? [el('small', { className: 'pneed', textContent: s.needs })] : []));
}
export function refreshStep(G, body, b) {
  const e = body.querySelector('.pstep'), s = nextStep(G, b); if (!e || !s) return;
  if (e.dataset.k !== s.title + key(G, s.cost) + (s.needs || '')) fillStep(G, e, s);
}
