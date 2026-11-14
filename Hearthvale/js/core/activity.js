// What a villager is doing right now, in plain words, read from their current action and whether they are walking.
// Shown when a villager is selected. A hold-up the action reported (stores full, waiting for materials) wins.
import { BUILD, RES_NAME, PANTRY_KIND } from './config.js';
import { levelName } from './state.js';

const GATHER = { wood: ['chop wood', 'Chopping wood', 'the trees'], stone: ['mine stone', 'Mining stone', 'the rocks'], gold: ['mine gold', 'Mining gold', 'the gold seam'],
  berry: ['pick berries', 'Picking berries', 'the berry bushes'], fish: ['fish', 'Fishing', 'the water'], clay: ['dig clay', 'Digging clay', 'the clay bank'] };
const FIELD = { farm: 'Tending the vegetables', wheatfield: 'Harvesting wheat', fiberfield: 'Harvesting fiber' };
const SIT = { tavern: 'Having a drink at the tavern', learn: 'At lessons in the schoolhouse', theater: 'Watching a play at the theater', church: 'At church',
  read: 'Reading at the library', play: 'Playing at the playground', fire: 'Telling stories by the fire' };
const FOOD_NAME = { bread: 'bread', cheese: 'cheese', eggs: 'eggs', honey: 'honey' };
// Workshops whose work is not "making" something.
const CRAFT_DOING = { studio: 'Painting', coop: 'Collecting eggs', pasture: 'Milking the cows', sheepfold: 'Shearing the sheep', apiary: 'Tending the bees' };

const name = (g, id) => { const b = id != null && g.bmap.get(id); return b ? (b.done ? levelName(b) : BUILD[b.k].name).toLowerCase() : null; };
const what = (v) => v.carryRes === 'food' ? PANTRY_KIND[v.carryKind] || 'food' : (RES_NAME[v.carryRes] || v.carryRes || 'goods').toLowerCase();
const carrying = v => `Carrying ${v.carry} ${what(v)} to the stores`;

export function describe(g, v) {
  const a = v.act, walk = v.moving;
  if (!a) return v.why && /^(Waiting|The stores|Couldn't)/.test(v.why) ? v.why : g.freeWill ? 'Deciding what to do next' : 'Waiting for your next task';
  if (v.why && /^(Waiting|The stores|Couldn't|The bees)/.test(v.why)) return v.why;
  if (a.phase === 'haul' || a.type === 'unload') return v.carry > 0 ? carrying(v) : 'Heading back';
  const at = name(g, a.b ?? a.tavern ?? a.bench);
  switch (a.type) {
    case 'gather': { const k = Object.keys(GATHER).find(k => (a.key || '').startsWith(k)) || 'wood', [verb, doing, place] = GATHER[k];
      return walk ? `Walking to ${place} to ${verb}` : doing; }
    case 'farm': return walk ? `Walking to the ${at || 'field'}` : FIELD[a.key] || 'Working the field';
    case 'water': return walk ? (a.phase === 'go' || a.phase === 'find' ? (a.well ? 'Walking to the well' : 'Walking to the water\'s edge') : 'Walking') : 'Drawing water';
    case 'craft': { const b = g.bmap.get(a.b), c = b && BUILD[b.k].craft, out = c ? (FOOD_NAME[c.kind] || (RES_NAME[Object.keys(c.out)[0]] || Object.keys(c.out)[0]).toLowerCase()) : 'goods';
      return walk ? `Walking to the ${at || 'workshop'}` : b && CRAFT_DOING[b.k] ? `${CRAFT_DOING[b.k]} at the ${at}` : `Making ${out} at the ${at || 'workshop'}`; }
    case 'build': return walk ? `Walking to build the ${at || 'new building'}` : `Building the ${at || 'new building'}`;
    case 'upgrade': return walk ? `Walking to improve the ${at || 'building'}` : `Improving the ${at || 'building'}`;
    case 'demolish': return walk ? `Walking to take down the ${at || 'building'}` : `Taking down the ${at || 'building'}`;
    case 'clear': return walk ? 'Walking to clear the way' : 'Clearing the way';
    case 'plant': return walk ? 'Walking to plant a tree' : 'Planting a sapling';
    case 'move': return a.key === 'arrive' ? 'Arriving in Hearthvale' : walk ? 'Walking where you pointed' : 'Standing where you pointed';
    case 'rest': return a.bench && !walk ? 'Resting on a bench' : walk ? (a.bench ? 'Walking to a bench' : 'Taking a stroll') : 'Taking a breather';
    case 'sit': { const doing = SIT[a.key] || (at ? `At the ${at}` : 'Sitting with friends');
      return walk ? (at ? `Walking to the ${at}` : a.key === 'fire' ? 'Walking to the campfire' : 'Walking') : doing; }
    case 'sleep': return a.phase === 'sleep' ? 'Asleep' : 'Heading home to bed';
    case 'leave': return 'Heading off down the road';
    case 'festival': return a.role === 'cheer' ? 'Cheering on the parade' : 'Marching in the parade';
    case 'egghunt': return 'Hunting for eggs';
    case 'swim': return v.swim ? 'Swimming' : walk ? 'Walking to the water' : 'Picnicking by the water';
    case 'trick': return 'Trick-or-treating';
    case 'carol': return 'Singing by the Christmas tree';
    default: return walk ? 'Walking' : 'Busy';
  }
}
