// Prints the handoff's data tables (buildings, levels) straight from config.js, so the doc never drifts from the code.
import { BUILD, TIERS, AGES } from '../js/core/config.js';
const f = c => Object.entries(c || {}).map(([r, n]) => `${r} ${n}`).join(', ') || '—';
const out = ['| key | name | w×h | age | cost | beauty | stores | craft |', '|---|---|---|---|---|---|---|---|'];
for (const [k, d] of Object.entries(BUILD)) {
  const c = d.craft ? `${d.craft.role}: ${f(d.craft.in)} → ${f(d.craft.out)}${d.craft.kind ? ' [' + d.craft.kind + ']' : ''}, ${d.craft.time}s${d.craft.graze ? ', graze ' + d.craft.graze : ''}` : '';
  out.push(`| ${k} | ${d.name} | ${d.w || d.size}×${d.h || d.size} | ${d.age} | ${f(d.cost)} | ${d.beauty || 0} | ${d.store ? f(d.store) : '—'} | ${c} |`);
}
out.push('', '`need` is the home-score threshold; −99 means none.');
for (const [k, ts] of Object.entries(TIERS)) out.push(`- ${k}: ` + ts.map(t => `${t.name} (age ${t.age}, need ${t.need ?? -99}, cost ${f(t.cost)}${t.beds ? ', beds ' + t.beds : ''}${t.goods ? ', goods ' + t.goods.join('/') : ''})`).join(' → '));
console.log(out.join('\n'));
