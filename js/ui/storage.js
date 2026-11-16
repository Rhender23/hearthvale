// Storage at a glance: a fill line under each resource in the bar (amber from 80%, red when full), a short line when
// something is full and what that holds up, and the Storage sheet: every resource, how full, and which buildings hold it.
import { BUILD, ICON, RES, RES_NAME } from '../core/config.js';
import { cap, storeOf } from '../core/state.js';
import { el } from './dom.js';

export const fillOf = (G, r) => { const c = cap(G, r); return c > 0 ? Math.min(1, (G.res[r] || 0) / c) : 0; };
export const fillClass = f => (f >= 0.999 ? 'full' : f >= 0.8 ? 'high' : '');

// What a full store holds up, in plain words.
const HOLDS = { wood: 'woodcutters', stone: 'stone miners', gold: 'gold miners', food: 'farmers, fishers and foragers', water: 'water carriers', clay: 'clay diggers', fiber: 'fiber fields' };
export function fullLine(G) {
  const full = RES.filter(r => cap(G, r) > 0 && fillOf(G, r) >= 0.999 && ((G.today && G.today.in[r]) || HOLDS[r]));
  if (!full.length) return '';
  const names = full.map(r => `${ICON[r]} ${RES_NAME[r].toLowerCase()}`).join(', ');
  const held = full.map(r => HOLDS[r]).filter(Boolean);
  return `Full: ${names}.` + (held.length ? ` The ${held.slice(0, 2).join(' and ')} are waiting for room.` : '') + ' More storage lets them carry on.';
}

// The bar: add a fill line to each resource and keep it current.
export function addFill(item) { const f = el('i', { className: 'fill' }, [el('i')]); item.append(f); return f; }
export function syncFill(G, r, item) {
  const f = item.querySelector('.fill'); if (!f) return;
  const v = fillOf(G, r), c = fillClass(v), w = Math.round(v * 100) + '%';
  if (f.firstChild.style.width !== w) f.firstChild.style.width = w;
  if (f.dataset.c !== c) { f.dataset.c = c; f.className = 'fill ' + c; }
}

// The Storage sheet.
export function storageSheet(G) {
  return body => {
    body.append(el('small', { textContent: 'How full each store is, and which buildings hold it. Tap a building on the map to see what it keeps.' }));
    for (const r of RES) {
      const c = Math.floor(cap(G, r)); if (!c && !(G.res[r] >= 1)) continue;
      const n = Math.floor(G.res[r] || 0), v = fillOf(G, r);
      const by = new Map(); for (const b of G.buildings) { const s = storeOf(G, b, r); if (s) by.set(b.k, (by.get(b.k) || 0) + s); }
      const where = [...by].sort((a, b) => b[1] - a[1]).map(([k, s]) => `${BUILD[k].name.toLowerCase()} ${Math.round(100 * s / Math.max(1, c))}%`).join(' · ');
      body.append(el('div', { className: 'wide strow' }, [
        el('span', { textContent: `${ICON[r]} ${RES_NAME[r]}  ${n} / ${c}` }),
        el('i', { className: 'fill ' + fillClass(v) }, [el('i', { style: `width:${Math.round(v * 100)}%` })]),
        el('small', { textContent: where || 'Nowhere to keep it yet.' })]));
    }
  };
}
