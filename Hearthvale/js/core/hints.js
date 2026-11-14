// Friendly feedback lines: what a villager is about to do when you tell them, what a building will mean where you are
// about to place it, how to make something possible, and a one-time tip the first time you build each kind of thing.
// Positive and practical only: never warnings. Pure text from the game state, so it is tested without a browser.
import { BUILD, TIERS, FARM_REACH } from './config.js';
import { slotKind, farmFor, farmSlots, slotsUsed } from './state.js';
import { canPlace } from './commands.js';

const GATHER_VERB = { 1: 'chop wood', 2: 'mine stone', 3: 'mine gold', 4: 'pick berries', 5: 'fish', 6: 'dig clay' };
const lower = s => s.toLowerCase();
export function who(vs) {
  if (!vs || !vs.length) return 'Someone';
  if (vs.length === 1) return vs[0].name;
  if (vs.length === 2) return `${vs[0].name} and ${vs[1].name}`;
  return `${vs.length} villagers`;
}
const isAre = vs => (vs && vs.length > 1 ? 'are' : 'is');
const nameOf = b => lower(BUILD[b.k].name);

// The first time each kind of thing is built: one line about how it connects to the rest.
const FIRST = {
  field: 'Fields belong to a farmhouse: each one takes a field slot. A bigger farmhouse has room for more.',
  pen: 'Animals take an animal slot at a farmhouse. Their keeper works the pen like a workshop.',
  workshop: 'A workshop needs a worker: select a villager and tap it. Its goods go to a storehouse.',
  home: 'Homes level up when their surroundings are lovely: gardens and benches help, workshops and fields don\'t.',
  storage: 'The granary keeps food and water, the lumber mill wood, the storehouse everything finished.',
  culture: 'Culture buildings fill evenings and lessons with culture, which the village needs for the next age.',
};
const firstKind = k => slotKind(k) === 'fields' ? 'field' : slotKind(k) === 'animals' ? 'pen' : BUILD[k].craft ? 'workshop' : BUILD[k].home ? 'home'
  : ['granary', 'lumbermill', 'store'].includes(k) ? 'storage' : ['school', 'theater', 'church', 'library', 'studio'].includes(k) ? 'culture' : null;
export function firstTip(g, k) {
  const f = firstKind(k);
  if (!f) return '';
  g.tipsSeen = g.tipsSeen || {};
  if (g.tipsSeen[f]) return '';
  g.tipsSeen[f] = true;
  return FIRST[f];
}

// Said when you give villagers something to do.
export function orderNote(g, kind, vs, b, nodeK) {
  const w = who(vs);
  switch (kind) {
    case 'build': return `${w} will build the ${nameOf(b)}.`;
    case 'farm': return `${w} will tend the ${nameOf(b)}${g.freeWill ? '' : ', every day'}.`;
    case 'craft': return `${w} ${isAre(vs)} now working at the ${nameOf(b)}.`;
    case 'gather': return `${w} ${isAre(vs)} off to ${GATHER_VERB[nodeK] || 'gather'}${g.freeWill ? '' : ', and will keep at it'}.`;
    case 'move': return `${w} ${isAre(vs)} on the way.`;
    case 'nowork': return `The ${nameOf(b)} has no work for them. Here it is.`;
    case 'place': { const t = firstTip(g, b.k); return `The ${nameOf(b)} is planned. ${w} will build it.` + (t ? ' ' + t : ''); }
  }
  return '';
}

// Under the ✓ Place bubble, updated as you move it: what it will mean here, or how to make it possible.
export function placeHint(g, k, x, y, rot, ok) {
  const def = BUILD[k];
  if (!ok) {
    const sk = slotKind(k);
    if (sk && !farmFor(g, k, x, y, rot)) {
      const fhs = g.buildings.filter(b => b.k === 'farmhouse' && b.done), what = sk === 'fields' ? 'field' : 'animal';
      if (!fhs.length) return sk === 'fields' ? 'Fields belong to a farm: build a farmhouse first, then fields go within 4 tiles of it.' : 'Animals live on a farm: build a farmhouse first, then pens go within 4 tiles of it.';
      const free = fhs.filter(b => slotsUsed(g, b, sk) < farmSlots(b)[sk]);
      if (!free.length) { const next = TIERS.farmhouse.find(t => (t.slots || {})[sk] > farmSlots(fhs[0])[sk]); return `Every farmhouse ${what} slot is in use.` + (next ? ` A ${lower(next.name)} has room for ${next.slots[sk]}.` : ' A second farmhouse has room for more.'); }
      return `Bring it within ${FARM_REACH} tiles of a farmhouse with a free ${what} slot.`;
    }
    if (def.needs && !g.buildings.some(b => b.k === def.needs && b.done)) return `It needs a ${lower(BUILD[def.needs].name)} first.`;
    if (def.nearWater) return 'It needs open ground beside water.';
    return 'Something is in the way here. Try open ground nearby.';
  }
  const parts = [];
  const sk = slotKind(k), fh = sk && farmFor(g, k, x, y, rot);
  if (fh) parts.push(`${sk === 'fields' ? 'Field' : 'Animal'} slot ${slotsUsed(g, fh, sk) + 1} of ${farmSlots(fh)[sk]} at this farmhouse`);
  const bv = def.beauty || 0;
  if (bv > 0) parts.push(`Brightens nearby homes (+${bv} beauty)`);
  else if (bv <= -1.5) parts.push(`Unsightly (${bv} beauty): best kept away from homes`);
  else if (bv < 0) parts.push(`A little unsightly (${bv} beauty)`);
  parts.push('Tap ✓, or tap the same spot again');
  return parts.join(' · ');
}

export { canPlace };
