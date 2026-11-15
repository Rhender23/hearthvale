// Writes the catalog of art slots: art/slots.json (read by tools/trim.py for target sizes) and art/SLOTS.md (to read).
//   node tools/slots.mjs
// Sizes are for art drawn at 2×: a ground tile is 128×64 in the file and 64×32 on screen.
import { writeFileSync, mkdirSync } from 'node:fs';
import { BUILD, TIERS } from '../js/core/config.js';
import { CRITTERS } from '../js/core/critters.js';

const out = [];   // { slot, group, w, h, ground, note }
const add = (slot, group, w, h, ground, note = '') => out.push({ slot, group, w, h, ground, note });

add('ground/grass', 'Ground', 128, 64, 'tile centre', 'add /spring … /winter for seasons; several variants in one sheet with "random": true');
add('ground/sand', 'Ground', 128, 64, 'tile centre');
add('ground/water', 'Ground', 128, 64, 'tile centre', 'a few frames for a shimmer');
add('ground/road', 'Ground', 128, 64, 'tile centre', 'drawn over the ground tile');

add('node/tree', 'Nature', 96, 128, 'base of the trunk', 'add /spring … /winter; variants with "random": true');
add('node/sapling', 'Nature', 96, 128, 'base of the trunk', 'drawn small and grows to full size');
for (const k of ['stone', 'gold', 'clay', 'berry']) add(`node/${k}`, 'Nature', 96, 80, 'bottom centre', 'stages: /0 full, /1 half, /2 nearly gone');
add('node/fish', 'Nature', 96, 48, 'tile centre (bottom of the image)', 'a ripple; a few frames');

for (const [k, d] of Object.entries(BUILD)) {
  const w = (d.w || d.size), h = (d.h || d.size), px = (w + h) * 64, tall = Math.round(px * (w * h > 1 ? 1.1 : 1.6));
  const levels = TIERS[k] ? TIERS[k].map((t, i) => `/${i} ${t.name}`).join(' · ') : '';
  if (TIERS[k]) TIERS[k].forEach((t, i) => add(`building/${k}/${i}`, 'Buildings', px, tall, 'front point of the footprint', `${t.name}${i ? '' : ` (${d.name})`}`));
  else add(`building/${k}`, 'Buildings', px, tall, 'front point of the footprint', d.name);
}
for (const [w, h] of [[1, 1], [2, 1], [2, 2]]) add(`site/${w}x${h}`, 'Buildings', (w + h) * 64, (w + h) * 64, 'front point of the footprint', 'under construction (or site/<kind> for one building)');

for (const p of ['idle', 'walk', 'work', 'carry']) add(`villager/${p}`, 'Villagers', 40, 64, 'feet', p === 'walk' ? 'facing right; 4 frames' : p === 'work' ? '2–4 frames' : '');
for (const [k, C] of Object.entries(CRITTERS)) add(`critter/${k}`, 'Animals', C.night ? (k === 'bear' ? 72 : 52) : 24, C.night ? (k === 'bear' ? 56 : 40) : 24, C.night ? 'feet' : 'its centre', `${C.icon} facing right`);

const SEASONAL = { egg: [20, 24, 'pattern /0 … /4'], bunny: [40, 48, 'facing right'], pumpkin: [32, 28, 'and pumpkin-lit for night'], 'pumpkin-lit': [32, 28, ''], scarecrow: [48, 80, ''], leaves: [32, 16, ''], bat: [40, 20, 'flying'],
  tree: [80, 140, 'the Christmas tree'], snowman: [40, 80, ''], santa: [40, 90, 'facing right'], sleigh: [64, 48, ''], parasol: [56, 64, 'beach day'] };
for (const [k, [w, h, note]] of Object.entries(SEASONAL)) add(`seasonal/${k}`, 'Festivals', w, h, 'bottom centre', note);

mkdirSync(new URL('../art/', import.meta.url), { recursive: true });
writeFileSync(new URL('../art/slots.json', import.meta.url), JSON.stringify(Object.fromEntries(out.map(o => [o.slot, { w: o.w, h: o.h, ground: o.ground, group: o.group }])), null, 1));
const md = ['# Hearthvale art slots', '', 'Each slot is one image (PNG, transparent background). Sizes are suggestions at 2× (the game halves them on screen); tools/trim.py scales to the width shown. The image\'s bottom centre sits on the ground point unless the manifest gives an anchor.', '',
  'Any slot can also have: `/<season>` (spring, summer, autumn, winter) for a seasonal version · `<slot>-snow` drawn on top in winter · `<slot>-night` drawn on top after dusk (lit windows).', ''];
for (const grp of [...new Set(out.map(o => o.group))]) {
  md.push(`## ${grp}`, '', '| slot | size (px) | ground point | note |', '|---|---|---|---|');
  for (const o of out.filter(o => o.group === grp)) md.push(`| \`${o.slot}\` | ${o.w}×${o.h} | ${o.ground} | ${o.note} |`);
  md.push('');
}
writeFileSync(new URL('../art/SLOTS.md', import.meta.url), md.join('\n'));
console.log(`${out.length} slots → art/slots.json, art/SLOTS.md`);
