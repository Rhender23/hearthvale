// Upgrade trees: one diagram of everything that unlocks what. Three views of the same tables:
//   Ages      the four Ages in a row, and what each opens
//   Buildings every building, its levels laid out under the Age each arrives in, joined by arrows
//   Research  every line of research, tier by tier
// Each item is marked done (✓), ready (glowing) or locked (🔒); a tap says what it needs.
import { researchCost } from '../core/research.js';
import { BUILD, TIERS, AGES, UPGRADES, BUILD_GROUPS } from '../core/config.js';
import { buildNeeds, upgradeNeeds, ageNeeds } from '../core/requires.js';
import { el, fmt } from './dom.js';

const STATE_MARK = { done: '✓', ready: '●', locked: '🔒' };
function chip(label, state, why, onTap, sub) {
  const b = el('button', { className: 'tchip ' + state }, [el('span', { textContent: (state === 'locked' ? '🔒 ' : state === 'done' ? '✓ ' : '') + label }), sub ? el('small', { textContent: sub }) : null]);
  b.title = why || (state === 'done' ? 'Done.' : 'Ready.');
  b.onclick = () => onTap(why || (state === 'done' ? `${label}: done.` : `${label}: ready.`));
  return b;
}
const arrow = () => el('span', { className: 'tarrow', textContent: '→' });

// The finest level of k anywhere in the village (-1 if there is none finished).
const bestLevel = (G, k) => G.buildings.filter(b => b.k === k && b.done).reduce((m, b) => Math.max(m, b.lvl || 0), -1);

function agesView(G, say) {
  const row = el('div', { className: 'trow tages' });
  AGES.forEach((a, i) => {
    if (i) row.append(arrow());
    const st = i <= G.age ? 'done' : i === G.age + 1 && !ageNeeds(G) ? 'ready' : 'locked';
    const opens = Object.values(BUILD).filter(d => (d.age || 0) === i).length;
    row.append(chip(a.name, st, st === 'locked' ? (i === G.age + 1 ? ageNeeds(G) : `Comes after the ${AGES[i - 1].name} Age.`) : null, say, i ? `🎭 ${a.culture} · ${fmt(a.cost)} · opens ${opens}` : `opens ${opens}`));
  });
  return [row];
}

function buildingsView(G, say) {
  const out = [el('div', { className: 'tgrid thead' }, [el('span'), ...AGES.map(a => el('small', { textContent: a.name }))])];
  for (const [label, list, icon] of BUILD_GROUPS) {
    out.push(el('b', { className: 'tgroup', textContent: `${icon} ${label}` }));
    for (const k of list) {
      const d = BUILD[k]; if (!d) continue;
      const lv = bestLevel(G, k), tiers = TIERS[k] || [{ name: d.name, age: d.age || 0 }];
      const cols = AGES.map(() => el('div', { className: 'tcell' }));
      tiers.forEach((t, i) => {
        const age = Math.max(d.age || 0, t.age || 0);
        let st, why = null;
        if (i <= lv) st = 'done';
        else if (i === 0) { why = buildNeeds(G, k); st = why ? 'locked' : 'ready'; }
        else if (age > G.age) { st = 'locked'; why = `${t.name}: arrives in the ${AGES[age].name} Age.`; }
        else if (lv < 0) { st = 'locked'; why = `Build a ${d.name.toLowerCase()} first.`; }
        else if (i > lv + 1) { st = 'locked'; why = `Comes after the ${tiers[i - 1].name.toLowerCase()}.`; }
        else { st = 'ready'; why = `${t.name}: ${fmt(t.cost) || 'free'}` + (t.need > 0 ? `, and ${t.need} beauty around it.` : '.'); }
        const c = cols[age]; if (c.childNodes.length) c.append(arrow());
        c.append(chip(t.name, st, why, say));
      });
      out.push(el('div', { className: 'tgrid' }, [el('small', { className: 'tname', textContent: d.name }), ...cols]));
    }
  }
  return out;
}

function researchView(G, say) {
  const out = [], byAt = new Map();
  for (const u of UPGRADES) { if (!byAt.has(u.at)) byAt.set(u.at, new Map()); const base = u.name.replace(/ [IV]+$/, ''), m = byAt.get(u.at); if (!m.has(base)) m.set(base, []); m.get(base).push(u); }
  for (const [at, lines] of byAt) {
    out.push(el('b', { className: 'tgroup', textContent: (BUILD[at] || { name: at }).name }));
    for (const [base, us] of lines) {
      const row = el('div', { className: 'trow' }, [el('small', { className: 'tname', textContent: base })]);
      us.forEach((u, i) => {
        if (i) row.append(arrow());
        const why = upgradeNeeds(G, u), st = G.owned[u.id] ? 'done' : why ? 'locked' : 'ready';
        row.append(chip(u.name.slice(base.length + 1), st, why ? why : st === 'ready' ? `${u.name}: ${fmt(researchCost(G, u))}. ${u.desc}` : null, say));
      });
      out.push(row);
    }
  }
  return out;
}

export function treeSheet(G, say, ui) {
  return body => {
    const views = [['Ages', agesView, '⭐'], ['Buildings', buildingsView, '🏠'], ['Research', researchView, '✨']];
    ui.treeTab = ui.treeTab || 'Buildings';
    const tabs = el('div', { className: 'tabs' }, views.map(([name, , icon]) => { const b = el('button', { className: 'tab' + (ui.treeTab === name ? ' on' : '') }, [el('span', { textContent: icon }), el('small', { textContent: name })]); b.onclick = () => { ui.treeTab = name; body.replaceChildren(); treeSheet(G, say, ui)(body); }; return b; }));
    const legend = el('small', { className: 'tlegend', textContent: `${STATE_MARK.done} done · glowing: ready · ${STATE_MARK.locked} locked (tap to see what it needs)` });
    const view = views.find(([n]) => n === ui.treeTab)[1];
    body.append(tabs, legend, el('div', { className: 'tree' }, view(G, say)));
  };
}
