// The Directors overlay (Village → Overlays, for the curious): what each Director wants, asks of the others, and plans.
import { BUILD } from '../core/config.js';
import { el } from './dom.js';

export function directorView(G, d) {
  const m = G.manager; d.replaceChildren(el('b', { textContent: 'Directors' }));
  for (const dir of m.directors) {
    const wishes = m.wishes.filter(w => w.dir === dir.name).sort((a, b) => b.w - a.w), dem = (m.demands || []).filter(x => x.from === dir.name);
    const box = el('div', { className: 'dirbox' }, [el('div', { className: 'dn', textContent: dir.name }), el('small', { textContent: dir.seeks || '' })]);
    for (const w of wishes) box.append(el('div', { className: 'wl', textContent: `${w.key} ${w.w.toFixed(2)} · ${w.why}` }));
    for (const x of dem) box.append(el('div', { className: 'wl dem', textContent: `asks ${x.to} for ${x.what}${x.why ? ' (' + x.why + ')' : ''}` }));
    if (dir.eval && dir.eval.length) for (const c of dir.eval.slice(0, 5)) box.append(el('div', { className: 'wl', textContent: `plans ${BUILD[c.k].name.toLowerCase()} ${c.score.toFixed(2)} · ${c.why}` }));
    if (!wishes.length && !dem.length && !(dir.eval && dir.eval.length)) box.append(el('div', { className: 'wl', textContent: 'content for now' }));
    d.append(box);
  }
}
