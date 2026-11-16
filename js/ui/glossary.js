// The glossary: every word in the game, A to Z, with a search box. Built from the game's own tables, so a new
// building, resource or festival shows up here without anyone writing it twice. Concepts (beauty, culture...) are the
// only hand-written entries.
import { BUILD, TIERS, RES, RES_NAME, RES_DESC, ICON, AGES, FESTIVALS, UPGRADES, FOCI, BEAUTY_RADIUS, BUILD_GROUPS } from '../core/config.js';
import { SEASONAL } from '../core/seasons.js';
import { CRITTERS } from '../core/critters.js';
import { el, fmt } from './dom.js';

const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const groupOf = k => (BUILD_GROUPS.find(([, list]) => list.includes(k)) || ['Building'])[0];

// Hand-written: the ideas behind the numbers.
const CONCEPTS = [
  ['Beauty', '🌸', `How lovely a home's surroundings are. Flowers, trees, benches, gardens and ponds within ${BEAUTY_RADIUS} tiles raise it; workshops, fields, quarries and mines nearby lower it. Homes need more beauty to reach finer levels. A home's bubble says what helps it and what holds it back, and the 🌸 map shows it everywhere.`],
  ['Culture', '🎭', 'What the village has done for its heart and mind: schooling, plays, art, festivals and church. Culture is what grows the village into its next Age. Homes left behind the Age and buildings ready to improve let a little culture slip each day.'],
  ['Ages', '⭐', 'Hamlet, Village, Town, Township. Each Age opens new buildings and finer levels. Growing into the next Age takes culture and some resources.'],
  ['Free will', '🧭', 'With free will on, villagers choose their own work and the village plans its own buildings. With it off, they do what you ask and keep to the jobs you give them.'],
  ['Free build', '🔨', 'The village places buildings on its own when it sees a need. You can still place anything yourself.'],
  ['Household water', '💧', 'Every home keeps a barrel of water for the people who sleep there. Water carriers fill homes with room first; at meals everyone drinks at home before the village stores.'],
  ['Storage', '📦', 'Every resource needs somewhere to go. When a store is full, the people who gather it wait for room. The 📦 sheet in the game menu shows how full each store is.'],
  ['Paths', '🟫', 'Paths and roads let villagers walk a little faster. They wear in by use: a well-trodden dirt path becomes a gravel lane, then a cobbled road.'],
  ['Farm slots', '🌾', 'A farmhouse has room for a few fields and a few animal pens. Fields join it in a chain, each touching the farmhouse or a field already joined; pens go within 4 tiles.'],
  ['Wants', '💭', 'Tap a villager or a home to see what it would love next. Wants only show when you tap.'],
  ['Merchant', '🧳', 'With a marketplace, a merchant comes every few days to buy what the workshops make and to sell stone.'],
  ['Night animals', '🌙', 'At night, tap fireflies, moths, frogs, owls and the rarer animals to collect them. Spend them on treasures for homes.'],
  ['Research', '✨', 'Small improvements bought at a building: each tier makes something a little better and opens the next.'],
  ['Rest', '😴', 'Villagers sleep at night and rest when tired. A rested villager works and walks better.'],
  ['Company', '🫶', 'Villagers like time together: around the fire, at the tavern, at plays and at church. Lonely villagers are slower to settle.'],
  ['Hunger and thirst', '🍎', 'Everyone eats and drinks at mealtimes. Three days without food and a villager leaves to find it elsewhere.'],
  ['Focus', '⚖️', 'What the village leans toward: ' + FOCI.map(f => f.name.toLowerCase()).join(', ') + '.'],
];

export function entries() {
  const out = [];
  for (const [name, icon, text] of CONCEPTS) out.push({ name, icon, kind: 'Idea', text });
  for (const r of RES) out.push({ name: RES_NAME[r], icon: ICON[r], kind: 'Resource', text: RES_DESC[r] || '' });
  for (const [k, d] of Object.entries(BUILD)) {
    const lv = TIERS[k] ? ' Levels: ' + TIERS[k].map(t => t.name).join(' → ') + '.' : '';
    out.push({ name: d.name, icon: d.icon || '🏠', kind: groupOf(k), text: `${d.desc || ''} Costs ${fmt(d.cost) || 'nothing'}; from the ${AGES[d.age || 0].name} Age.${lv}`.trim() });
  }
  for (let i = 0; i < AGES.length; i++) out.push({ name: AGES[i].name + ' Age', icon: '⭐', kind: 'Age', text: i ? `Needs ${AGES[i].culture} culture and ${fmt(AGES[i].cost)}.` : 'Where every village begins.' });
  for (const f of FESTIVALS) out.push({ name: f.name, icon: '🎉', kind: 'Festival', text: `A festival of the ${AGES[f.age].name} Age: ${f.culture} culture, and ${f.visitors} visitors come up the road.` });
  for (const f of SEASONAL) out.push({ name: f.name, icon: f.icon, kind: 'Seasonal festival', text: 'Comes round once a year, on its own.' });
  for (const [, C] of Object.entries(CRITTERS)) out.push({ name: cap1(C.name), icon: C.icon, kind: 'Night animal', text: C.desc || 'Out at night. Tap to collect.' });
  const lines = new Map(); for (const u of UPGRADES) { const base = u.name.replace(/ [IV]+$/, ''); if (!lines.has(base)) lines.set(base, u); }
  for (const [base, u] of lines) out.push({ name: base, icon: '✨', kind: 'Research', text: `${u.desc} Five tiers, at the ${(BUILD[u.at] || { name: u.at }).name.toLowerCase()}.` });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function glossarySheet() {
  return body => {
    const all = entries(), input = el('input', { type: 'search', placeholder: 'Search…', className: 'gsearch' });
    input.setAttribute('aria-label', 'Search the glossary');
    const list = el('div', { className: 'glist' });
    const show = () => {
      const q = input.value.trim().toLowerCase(), hits = q ? all.filter(e => (e.name + ' ' + e.kind + ' ' + e.text).toLowerCase().includes(q)) : all;
      let letter = '';
      list.replaceChildren(...hits.flatMap(e => {
        const L = e.name.charAt(0).toUpperCase(), head = !q && L !== letter ? (letter = L, [el('b', { className: 'gletter', textContent: L })]) : [];
        return [...head, el('div', { className: 'wide gentry' }, [el('span', { textContent: `${e.icon || ''} ${e.name}` }), el('small', { className: 'gkind', textContent: e.kind }), el('small', { textContent: e.text })])];
      }));
      if (!hits.length) list.append(el('small', { textContent: 'Nothing by that name.' }));
    };
    input.addEventListener('input', show);
    input.addEventListener('keydown', e => e.stopPropagation());
    body.append(input, list); show();
  };
}
