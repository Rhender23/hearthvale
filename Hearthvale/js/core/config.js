// Static game data. No logic, no state. Every other module reads from here.
export const N = 40, TW = 64, TH = 32;
export const DAY = 864;        // seconds of real time per game day (midnight to 5am lasts 180s)
export const SEASON = 6 * 864;   // seconds per season: six days, so a year is 24 days; each seasonal festival comes once a year
export const BEDTIME = 23, WAKE = 5;
export const SAVE_KEY = 'hearthvale-v2', LEGACY_KEY = 'hearthvale';

export const BASICS = ['wood', 'stone', 'gold', 'food', 'water'];
export const GOODS = ['clay', 'fiber', 'pottery', 'cloth', 'furniture', 'jewelry', 'candles'];   // raw materials for workshops, and what they make
export const FARM = ['wheat', 'flour', 'beer', 'wool', 'milk', 'wax'];   // from the fields: wheat, milled into flour or brewed into beer
export const RES = [...BASICS, ...FARM, ...GOODS];
// The pantry: `food` is the total; these are the kinds it is made of (shown when you open the food count).
export const PANTRY = ['provisions', 'berries', 'fish', 'vegetables', 'bread', 'eggs', 'cheese', 'honey'];
export const PANTRY_ICON = { provisions: '🧺', berries: '🫐', fish: '🐟', vegetables: '🥕', bread: '🍞', eggs: '🥚', cheese: '🧀', honey: '🍯' };
export const PANTRY_KIND = { 4: 'berries', 5: 'fish', 6: 'vegetables', 9: 'bread', 10: 'eggs', 11: 'cheese', 12: 'honey' };   // by what a villager carried in
export const KIND_CODE = { bread: 9, eggs: 10, cheese: 11, honey: 12 };   // by what a villager carried in
// Every resource at 0; new resources only need adding to the lists above.
export const zeroRes = () => Object.fromEntries(RES.map(r => [r, 0]));
export const ICON = { wood: '🪵', stone: '🪨', gold: '🪙', food: '🍎', water: '💧', clay: '🟤', fiber: '🌿', pottery: '🏺', cloth: '🧵', furniture: '🪑', jewelry: '💍', wheat: '🌾', flour: '🥣', beer: '🍺', wool: '🧶', milk: '🥛', wax: '🟨', candles: '🕯️' };
export const RES_NAME = { wood: 'Wood', stone: 'Stone', gold: 'Gold', food: 'Food', water: 'Water', clay: 'Clay', fiber: 'Fiber', pottery: 'Pottery', cloth: 'Cloth', furniture: 'Furniture', jewelry: 'Jewelry', wheat: 'Wheat', flour: 'Flour', beer: 'Beer', wool: 'Wool', milk: 'Milk', wax: 'Beeswax', candles: 'Candles' };

// Resource nodes on the map.
export const NODE = { TREE: 1, STONE: 2, GOLD: 3, BERRY: 4, FISH: 5, CLAY: 6 };
export const NODE_INFO = {
  1: { key: 'wood',  res: 'wood',  amt: 40, rate: 1.0, verb: 'Chopping wood' },
  2: { key: 'stone', res: 'stone', amt: 200, rate: 0.45, verb: 'Mining stone' },   // big outcrops: stone does not regrow
  3: { key: 'gold',  res: 'gold',  amt: 40, rate: 1.5, verb: 'Mining gold' },
  4: { key: 'berry', res: 'food',  amt: 30, rate: 0.7, verb: 'Gathering berries' },
  5: { key: 'fish',  res: 'food',  amt: 60, rate: 0.9, verb: 'Fishing' },
  6: { key: 'clay',  res: 'clay',  amt: 40, rate: 1.1, verb: 'Digging clay' },
};
export const KEY_NODE = { wood: 1, stone: 2, gold: 3, berry: 4, fish: 5, clay: 6 };

// Buildings.
//   size   footprint (tiles)   time  build seconds   cost  resources   store  storage it adds
//   beauty how much it beautifies everything within BEAUTY_RADIUS tiles (negative = unsightly)
//   placer 'village' (Construction may place it on its own) or 'player' (only you)
//   flat   no walls (drawn on the ground)   walk  villagers can walk over it
//   Buildings with a TIERS entry start at level 0 and can be improved (see TIERS below).
// Fields and penned animals belong to a farmhouse: each takes one of its slots, and must sit within FARM_REACH tiles of it.
export const FARM_SLOT = { farm: 'fields', wheatfield: 'fields', fiberfield: 'fields', coop: 'animals', sheepfold: 'animals', pasture: 'animals', apiary: 'animals' };
export const FARM_REACH = 4;
export const BUILD = {
  campfire: { name: 'Campfire', size: 1, time: 1, cost: {}, age: 0, pop: 3, placer: 'none', fixed: true,
              store: { wood: 100, stone: 40, gold: 20, food: 60, water: 40, clay: 30, fiber: 30, pottery: 20, cloth: 20, furniture: 10, wheat: 20, beer: 5 },
              desc: 'Where the village began. Until there is a town center, villagers are trained and gather here.' },
  tc:       { name: 'Town center', size: 2, time: 30, cost: { wood: 150, stone: 40 }, age: 0, pop: 5, placer: 'village', beauty: 1, hub: true,
              store: { wood: 200, stone: 100, gold: 400, food: 100, water: 60, clay: 40, fiber: 40, pottery: 30, cloth: 30, furniture: 20, jewelry: 10, wheat: 30, flour: 20, beer: 10, wool: 20, milk: 20, wax: 10, candles: 10 },
              desc: 'The heart of the village. Needed to grow beyond a hamlet. Trains villagers, researches upgrades and advances the age.' },
  house:    { name: 'House', size: 1, faces: true, time: 8, cost: { wood: 25 }, age: 0, home: true, placer: 'village',
              desc: 'A home. It improves as its surroundings grow lovelier.' },
  // Storehouse: 2x1, and can be turned to 1x2. Holds a lot, but only a little food (the granary and grange are for food).
  store:    { name: 'Storehouse', size: 2, w: 2, h: 1, turns: true, time: 10, cost: { wood: 60 }, age: 0, placer: 'village', beauty: -1.5, icon: '📦',
              store: { wood: 60, stone: 80, gold: 100, food: 15, water: 30, clay: 80, fiber: 80, pottery: 90, cloth: 90, furniture: 50, jewelry: 40, beer: 60, candles: 60, wool: 60, wax: 40 }, desc: 'Mainly for finished goods: pottery, cloth, furniture, jewelry, beer, candles. Only a little wood, stone and food.' },
  lumbermill: { name: 'Lumber mill', size: 2, time: 10, cost: { wood: 40 }, age: 0, placer: 'village', beauty: -2.5, icon: '🪵',
              store: { wood: 600 }, desc: 'Stacks of logs and planks. Holds a great deal of wood, so woodcutters walk less.' },
  farm:     { name: 'Vegetable field', size: 2, time: 8, cost: { wood: 60 }, age: 0, flat: true, food: 100, crop: 'food', placer: 'village', beauty: -2,
              desc: 'Rows of carrots, cabbages and beans. Grows food. Re-sown for a little wood when it runs out.' },
  wheatfield:{ name: 'Wheat field', size: 2, time: 8, cost: { wood: 50 }, age: 0, flat: true, food: 80, crop: 'wheat', placer: 'village', beauty: -1.5,
              desc: 'Golden wheat. Milled into flour for bread, or brewed into beer. Re-sown for a little wood when it runs out.' },
  // Farm buildings. The grange is the farmers' hub: they bring the harvest there. The granary keeps food.
  grange:   { name: 'Grange', size: 2, time: 14, cost: { wood: 80, stone: 10 }, age: 0, placer: 'village', beauty: -1,
              store: { food: 150, wheat: 150, flour: 60, fiber: 100, beer: 20, wool: 60, milk: 40, wax: 30 }, desc: 'The farmers\' hall. Harvests come here, so fields near it need fewer long walks.' },
  granary:  { name: 'Granary', size: 2, time: 16, cost: { wood: 80, stone: 30 }, age: 0, placer: 'village', beauty: -4, icon: '🛢️',
              store: { food: 1500, wheat: 400, flour: 200, milk: 100 }, desc: 'One great round silo. Holds an enormous amount of food and what food is made from (wheat, flour, milk). Very unsightly: keep it away from homes.' },
    // The farmhouse: a home for farming folk. Only 2 beds, but it keeps food, rises with little regard for beauty,
  // holds the farming upgrades, and the village needs one before it can keep penned animals.
  farmhouse:{ name: 'Farmhouse', size: 2, time: 14, cost: { wood: 70, stone: 10 }, age: 0, home: true, placer: 'village', beauty: 0.5, icon: '🏡',
              store: { food: 200, wheat: 80, milk: 30 }, desc: 'A roomy farm home for two. Keeps food, needs no fancy surroundings to improve, and must stand before pens can be built.' },
  mill:     { name: 'Mill', size: 1, time: 14, cost: { wood: 70, stone: 20 }, age: 0, placer: 'village', beauty: -2,
              craft: { role: 'miller', in: { wheat: 2 }, out: { flour: 2 }, time: 8 }, desc: 'A miller grinds wheat into flour.' },
  bakery:   { name: 'Bakery', size: 1, time: 12, cost: { wood: 60, stone: 15 }, age: 0, placer: 'village', beauty: -2,
              craft: { role: 'baker', in: { flour: 2, wood: 1 }, out: { food: 8 }, kind: 'bread', time: 10 }, desc: 'A baker turns flour into bread: much more food than the wheat alone.' },
  brewery:  { name: 'Brewery', size: 1, time: 12, cost: { wood: 60, stone: 10 }, age: 0, placer: 'village', beauty: 0,
              craft: { role: 'brewer', in: { wheat: 3 }, out: { beer: 1 }, time: 12 }, desc: 'A brewer makes beer from wheat. Homes, the tavern and festivals all want it.' },
  well:     { name: 'Well', size: 1, time: 6, cost: { wood: 10, stone: 20 }, age: 0, placer: 'village', water: 60, refill: 40, beauty: 1,
              desc: 'Fresh water close to home.' },
  flowerbed:{ name: 'Flower bed', size: 1, time: 2, cost: { wood: 5 }, age: 0, flat: true, placer: 'village', decor: true, beauty: 2,
              desc: 'A splash of color. Makes the area around it prettier.' },
  bench:    { name: 'Bench', size: 1, time: 3, cost: { wood: 10 }, age: 0, placer: 'village', decor: true, beauty: 1.5, oneEach: true, spread: 2,
              desc: 'A place to rest and enjoy the view.' },
  path:     { name: 'Path', size: 1, time: 1, cost: { stone: 2 }, age: 0, flat: true, walk: true, placer: 'village', decor: true, beauty: 0.5,
              desc: 'A stone path. Pretty underfoot.' },
  statue:   { name: 'Statue', size: 1, time: 8, cost: { stone: 40 }, age: 1, placer: 'village', decor: true, beauty: 4,
              desc: 'A carved stone figure. Greatly beautifies the area.' },
  garden:   { name: 'Garden', size: 1, time: 4, cost: { wood: 30, stone: 10 }, age: 1, flat: true, placer: 'village', decor: true, beauty: 3,
              desc: 'Tended flower beds that make the village lovely.' },
  lamppost: { name: 'Lamp post', size: 1, time: 3, cost: { wood: 5, gold: 3 }, age: 0, placer: 'village', decor: true, beauty: 2, unlock: true,
              desc: 'A glass lamp on an iron post. Glows warmly at night.' },
  arbor:    { name: 'Rose arbor', size: 1, time: 5, cost: { wood: 15, gold: 5 }, age: 1, placer: 'village', decor: true, beauty: 3.5, unlock: true,
              desc: 'An arch of climbing roses. Lovely in every season but winter.' },
  fireflylamp: { name: 'Firefly lantern', size: 1, time: 3, cost: { wood: 8, gold: 2 }, age: 0, placer: 'village', decor: true, beauty: 2.5, unlock: true,
              desc: 'A glass jar of fireflies on a little post. Glows softly at night. (Catch 10 fireflies to unlock.)' },
  tavern:   { name: 'Tavern', size: 2, time: 16, cost: { wood: 80, stone: 40 }, age: 1, placer: 'player', beauty: 2,
              store: { gold: 50, food: 80, water: 80, beer: 40 }, desc: 'Where villagers gather in the evening. With beer in the cellar, evenings here lift spirits and culture more.' },
  lodge:    { name: 'Lodge', size: 2, time: 14, cost: { wood: 80, stone: 20 }, age: 1, pop: 12, beds: 12, home: true, placer: 'player', beauty: 1,
              store: { gold: 20, food: 60, water: 60 }, desc: 'A large home with 12 beds.' },
  market:   { name: 'Trading post', size: 2, time: 12, cost: { wood: 60, stone: 20 }, age: 0, placer: 'player', beauty: 1.5,
              store: { gold: 600, pottery: 40, cloth: 40, furniture: 20, jewelry: 20, candles: 20, wool: 20 }, desc: 'A traveling merchant visits every few days to buy what the village makes. You can also swap resources here.' },
  fiberfield:{ name: 'Fiber field', size: 2, time: 6, cost: { wood: 40 }, age: 0, flat: true, food: 60, crop: 'fiber', placer: 'village', beauty: -1.5,
              desc: 'Tall fiber plants for the weaver to spin and weave. Re-sown for a little wood when it runs out.' },
  shop:     { name: 'Stall', size: 1, time: 8, cost: { wood: 40 }, age: 0, placer: 'village', beauty: 1, shop: true,
              store: { pottery: 10, furniture: 5, cloth: 10, jewelry: 5, beer: 10, candles: 10 }, desc: 'Hands pottery, furniture, cloth, jewelry and beer to the homes around it, and sells a little of what is spare each day.' },
  potter:   { name: "Potter's workshop", size: 1, time: 10, cost: { wood: 40, stone: 10 }, age: 0, placer: 'village', beauty: -2,
              craft: { role: 'potter', in: { clay: 2 }, out: { pottery: 1 }, time: 6 }, desc: 'A potter turns clay into pottery.' },
  carpenter:{ name: "Carpenter's shop", size: 1, time: 10, cost: { wood: 50, stone: 10 }, age: 0, placer: 'village', beauty: -2,
              craft: { role: 'carpenter', in: { wood: 4 }, out: { furniture: 1 }, time: 8 }, desc: 'A carpenter turns wood into furniture.' },
  weaver:   { name: "Weaver's cottage", size: 1, time: 10, cost: { wood: 40, stone: 10 }, age: 1, placer: 'village', beauty: -2,
              craft: { role: 'weaver', in: { fiber: 2 }, alt: { wool: 2 }, out: { cloth: 1 }, time: 7 }, desc: 'A weaver turns fiber into cloth.' },
  // Mines and quarries: from the Town Age, very costly in wood and gold, and they work forever.
  quarry:   { name: 'Stone quarry', size: 2, time: 24, cost: { wood: 300, gold: 150 }, age: 2, placer: 'village', beauty: -5, nearWater: 3,
              craft: { role: 'stonecutter', in: {}, out: { stone: 2 }, time: 12 }, desc: 'A stonecutter cuts stone from the bedrock, steadily and forever. Noisy and dusty: keep it away from homes. Must be within 3 tiles of water.' },
  claypit:  { name: 'Clay quarry', size: 2, time: 20, cost: { wood: 250, gold: 120 }, age: 2, placer: 'village', beauty: -4, nearWater: 2,
              craft: { role: 'clay digger', in: {}, out: { clay: 2 }, time: 10 }, desc: 'A digger works a deep clay bed, steadily and forever. Muddy and unsightly. Must be within 2 tiles of water.' },
  goldmine: { name: 'Gold mine', size: 2, time: 30, cost: { wood: 400, gold: 250 }, age: 2, placer: 'village', beauty: -5,
              craft: { role: 'miner', in: {}, out: { gold: 1 }, time: 14 }, desc: 'A miner brings up a little gold every few seconds, forever. Dark and dusty: keep it away from homes.' },
  jeweler:  { name: "Jeweler's workshop", size: 1, time: 14, cost: { wood: 60, stone: 40, gold: 20 }, age: 2, placer: 'village', beauty: -1.5,
              craft: { role: 'jeweler', in: { gold: 2, clay: 1 }, out: { jewelry: 1 }, time: 20 }, desc: 'A jeweler makes rings and brooches. Manors need them, and the merchant pays well.' },
  // Culture. Time spent at these (and stories by the fire) adds to the village's culture, which each new age requires.
  school:   { name: 'Schoolhouse', size: 1, time: 12, cost: { wood: 60, stone: 15 }, age: 0, placer: 'village', beauty: 1, culture: true,
              desc: 'Lessons in letters, numbers and crafts. Learning here adds to the village\'s culture.' },
  studio:   { name: "Artist's studio", size: 1, time: 12, cost: { wood: 60, stone: 20 }, age: 1, placer: 'village', beauty: 2, culture: true,
              craft: { role: 'artist', in: { wood: 3 }, out: { culture: 1 }, time: 30 }, desc: 'An artist paints and carves here. Every finished piece adds to the village\'s culture.' },
  theater:  { name: 'Theater', size: 2, time: 20, cost: { wood: 120, stone: 60 }, age: 1, placer: 'village', beauty: 2.5, culture: true,
              desc: 'Plays, music and dancing in the evenings. An audience adds to the village\'s culture.' },
  monument: { name: 'Monument', size: 2, time: 40, cost: { wood: 300, stone: 300, gold: 200 }, age: 3, placer: 'player', beauty: 8, culture: true, icon: '🗿',
              desc: 'A grand landmark that crowns your village. Adds 50 culture when finished and 3 more every morning.' },
  church:   { name: 'Church', size: 2, time: 24, cost: { wood: 120, stone: 80 }, age: 1, placer: 'village', beauty: 2.5, culture: true, icon: '⛪',
              desc: 'A quiet place by day. Every seventh morning the whole village gathers for a service: company and culture.' },
  library:  { name: 'Library', size: 2, time: 22, cost: { wood: 140, stone: 80, gold: 40 }, age: 2, placer: 'village', beauty: 2, culture: true, icon: '📚',
              desc: 'Shelves of books and a reading room. Villagers who read here add more culture than lessons do.' },
  playground:{ name: 'Playground', size: 2, time: 10, cost: { wood: 60 }, age: 0, placer: 'village', beauty: 1.5, icon: '🛝',
              desc: 'Swings, a seesaw and a sandpit. Villagers come in the afternoon to play and laugh together.' },
  // Animals. Pens hold animals that slowly multiply (a new one every couple of days, up to `cap`). The keeper feeds them
  // wheat when there is some (or lets them graze, more slowly) and collects what they give.
  coop:     { name: 'Chicken coop', size: 1, time: 8, cost: { wood: 50 }, age: 0, placer: 'village', beauty: -1.5, icon: '🐔', animals: { kind: 'hen', cap: 6, start: 3 },
              craft: { role: 'hen keeper', in: { wheat: 1 }, out: { food: 3 }, kind: 'eggs', time: 12, graze: 2 }, desc: 'Hens that lay eggs. Fed on wheat, or left to peck about (slower).' },
  sheepfold:{ name: 'Sheep pasture', size: 2, time: 10, cost: { wood: 80 }, age: 1, placer: 'village', beauty: -1.5, icon: '🐑', flat: true, animals: { kind: 'sheep', cap: 5, start: 2 },
              craft: { role: 'shepherd', in: { wheat: 1 }, out: { wool: 2 }, time: 14, graze: 2 }, desc: 'Sheep for wool. The weaver can make cloth from wool as well as fiber.' },
  pasture:  { name: 'Dairy pasture', size: 2, time: 10, cost: { wood: 90 }, age: 1, placer: 'village', beauty: -2, icon: '🐄', flat: true, animals: { kind: 'cow', cap: 4, start: 2 },
              craft: { role: 'cowherd', in: { wheat: 1 }, out: { milk: 2 }, time: 14, graze: 2 }, desc: 'Cows and goats for milk. The dairy turns milk into cheese.' },
  dairy:    { name: 'Dairy', size: 1, time: 12, cost: { wood: 60, stone: 20 }, age: 1, placer: 'village', beauty: -2, icon: '🧀',
              craft: { role: 'cheesemaker', in: { milk: 2 }, out: { food: 6 }, kind: 'cheese', time: 12 }, desc: 'A cheesemaker turns milk into cheese for the pantry.' },
  apiary:   { name: 'Beehives', size: 1, time: 6, cost: { wood: 40 }, age: 1, placer: 'village', beauty: -0.5, icon: '🐝', animals: { kind: 'bees', cap: 4, start: 2 }, noWinter: true,
              craft: { role: 'beekeeper', in: {}, out: { food: 2 }, kind: 'honey', extra: { wax: 1 }, time: 14 }, desc: 'Hives for honey and beeswax. The bees rest in winter.' },
  chandler: { name: 'Chandler', size: 1, time: 12, cost: { wood: 60, stone: 15 }, age: 1, placer: 'village', beauty: -2, icon: '🕯️',
              craft: { role: 'chandler', in: { wax: 2 }, out: { candles: 1 }, time: 10 }, desc: 'A chandler makes candles from beeswax. Fine homes love them, and the merchant buys them.' },
};
// Footprint in tiles: width (x) and height (y). Most buildings are square (size x size).
// rot = 1 turns a rectangular building (w and h swap).
export const dims = (k, rot = 0) => { const w = BUILD[k].w || BUILD[k].size, h = BUILD[k].h || BUILD[k].size; return rot ? [h, w] : [w, h]; };

// The build menu, grouped by kind.
export const BUILD_GROUPS = [
  ['Homes and village', ['tc', 'house', 'farmhouse', 'lodge', 'well'], '🏠'],
  ['Storage', ['store', 'granary', 'lumbermill'], '📦'],
  ['Farming', ['farm', 'wheatfield', 'fiberfield', 'grange', 'mill', 'bakery', 'brewery'], '🌾'],
  ['Animals', ['coop', 'sheepfold', 'pasture', 'dairy', 'apiary', 'chandler'], '🐑'],
  ['Crafts and industry', ['potter', 'carpenter', 'weaver', 'jeweler'], '🔨'],
  ['Quarries and mines', ['quarry', 'claypit', 'goldmine'], '⛏️'],
  ['Trade', ['market', 'shop'], '⚖️'],
  ['Culture and gathering', ['school', 'library', 'studio', 'theater', 'church', 'tavern', 'playground', 'monument'], '🎭'],
  ['Decoration', ['flowerbed', 'bench', 'path', 'lamppost', 'fireflylamp', 'statue', 'garden', 'arbor'], '🌸'],
];
// Short descriptions for every resource icon (resource panel tooltips).
export const RES_DESC = {
  wood: 'Chopped from trees. Used for almost every building.', stone: 'Mined from rocky outcrops or cut at a quarry. For sturdier buildings.',
  gold: 'Mined, or earned from the merchant and shops. For fine homes, plans and festivals.', food: 'Everything the village eats. Open the resources to see what the pantry holds.',
  water: 'From wells and the pond shore. Everyone drinks at mealtimes.', wheat: 'Grown in wheat fields. Milled into flour or brewed into beer.',
  flour: 'Ground from wheat at the mill. The baker turns it into bread.', beer: 'Brewed from wheat. Homes, the tavern and festivals want it.',
  clay: 'Dug from clay pits by the ponds. The potter shapes it.', fiber: 'Grown in fiber fields. The weaver turns it into cloth.',
  pottery: 'Made by the potter. Homes from Cozy cottage up use it.', cloth: 'Woven by the weaver. Stone houses and up use it.',
  furniture: 'Made by the carpenter. Timber houses and up use it.', wool: 'Shorn from sheep. The weaver turns it into cloth.', milk: 'From the dairy pasture. The cheesemaker turns it into cheese.',
  wax: 'From the beehives. The chandler makes candles from it.', candles: 'Made by the chandler. Fine homes glow with them; the merchant buys them.', jewelry: 'Made by the jeweler from gold and clay. Manors use it; the merchant pays well.',
};
export const BUILD_ORDER = ['tc', 'house', 'farmhouse', 'store', 'lumbermill', 'farm', 'well', 'market', 'shop', 'wheatfield', 'grange', 'granary', 'mill', 'bakery', 'brewery', 'potter', 'carpenter', 'fiberfield', 'weaver', 'quarry', 'claypit', 'goldmine', 'jeweler', 'school', 'library', 'studio', 'theater', 'church', 'playground', 'coop', 'sheepfold', 'pasture', 'dairy', 'apiary', 'chandler', 'flowerbed', 'bench', 'path', 'lamppost', 'fireflylamp', 'statue', 'garden', 'arbor', 'tavern', 'lodge', 'monument'];
export const ROLE_NAME = { potter: 'potter', carpenter: 'carpenter', weaver: 'weaver', artist: 'artist', stonecutter: 'stonecutter', 'clay digger': 'clay digger', miner: 'miner', jeweler: 'jeweler', miller: 'miller', baker: 'baker', brewer: 'brewer', 'hen keeper': 'hen keeper', shepherd: 'shepherd', cowherd: 'cowherd', cheesemaker: 'cheesemaker', beekeeper: 'beekeeper', chandler: 'chandler' };
export const STORE_MULT_SANDBOX = 10;

// Levels. A building rises to the highest level whose age and beauty requirement are met,
// paying the cost of every step it climbs. Homes judge beauty by their surroundings (excluding themselves).
//   age   village age needed   need  minimum surroundings score   cost  paid when a villager does the work
//   beds, store, beauty  what the building has at this level
const H = (name, age, need, cost, beds, food, beauty, goods = []) => ({ name, age, need, cost, beds, beauty, goods, store: { gold: 5 + beds * 2, food, water: food } });
const P = ['pottery', 'beer'], PF = ['pottery', 'beer', 'furniture'], PFL = [...PF, 'cloth'], PFLJ = [...PFL, 'jewelry'];   // every home from Cozy cottage up wants beer
export const TIERS = {
  house: [
    H('Hut', 0, 0, {}, 3, 20, 0),
    H('Cottage', 0, 1, { wood: 30 }, 4, 30, 0.5),
    H('Cozy cottage', 0, 2, { wood: 40, food: 20 }, 5, 40, 1, P),
    H('Timber house', 1, 2.5, { wood: 60, stone: 20 }, 6, 50, 1.5, PF),
    H('Fine timber house', 1, 3.5, { wood: 60, stone: 40 }, 7, 60, 2, PF),
    H('Stone house', 2, 4, { wood: 40, stone: 80 }, 8, 70, 2.5, PFL),
    H('Fine stone house', 2, 5, { stone: 100, gold: 10 }, 9, 80, 3, PFL),
    H('Manor', 3, 6, { stone: 120, gold: 40 }, 10, 90, 3.5, PFLJ),
    H('Grand manor', 3, 7.5, { stone: 150, gold: 80 }, 12, 100, 4, PFLJ),
  ],
  well: [
    { name: 'Well', age: 0, need: -99, cost: {}, water: 60, refill: 40, beauty: 1, store: { water: 60 } },
    { name: 'Fountain', age: 1, need: 2, cost: { stone: 50 }, water: 100, refill: 70, beauty: 3, store: { water: 120 } },
    { name: 'Water tower', age: 2, need: 1, cost: { wood: 120, stone: 80 }, water: 400, refill: 220, beauty: 1, store: { water: 300 } },
  ],
  campfire: [
    { name: 'Campfire', age: 0, need: -99, cost: {}, beauty: 0.5, company: 1 },
    { name: 'Fire circle', age: 1, need: -99, cost: { wood: 30 }, beauty: 1.5, company: 1.5 },
    { name: 'Lantern green', age: 2, need: -99, cost: { wood: 40, gold: 20 }, beauty: 3, company: 2 },
  ],
  store: [
    { name: 'Storehouse', age: 0, need: -99, cost: {}, storeMult: 1, beauty: -1.5 },
    { name: 'Large storehouse', age: 1, need: -99, cost: { wood: 80, stone: 40 }, storeMult: 1.6, beauty: -1 },
    { name: 'Grand storehouse', age: 2, need: -99, cost: { wood: 120, stone: 80 }, storeMult: 2.4, beauty: -0.5 },
  ],
  farmhouse: [
    { name: 'Farmhouse', age: 0, need: -99, cost: {}, beds: 2, storeMult: 1, beauty: 0.5, slots: { fields: 2, animals: 1 } },
    { name: 'Large farmhouse', age: 1, need: 0, cost: { wood: 80, stone: 20 }, beds: 2, storeMult: 1.5, beauty: 1, slots: { fields: 3, animals: 2 } },
    { name: 'Manor farm', age: 2, need: 0.5, cost: { wood: 120, stone: 60, gold: 20 }, beds: 2, storeMult: 2, beauty: 1.5, slots: { fields: 4, animals: 3 } },
  ],
  grange: [
    { name: 'Grange', age: 0, need: -99, cost: {}, storeMult: 1, beauty: -1 },
    { name: 'Large grange', age: 1, need: -99, cost: { wood: 80, stone: 30 }, storeMult: 1.6, beauty: -0.5 },
    { name: 'Great grange', age: 2, need: -99, cost: { wood: 120, stone: 60 }, storeMult: 2.2, beauty: 0 },
  ],
  // The marketplace grows through three ranks. Each rank holds more and gets the merchant to pay 10% more.
  market: [
    { name: 'Trading post', age: 0, need: -99, cost: {}, storeMult: 1, beauty: 1, priceBonus: 0 },
    { name: 'Market', age: 1, need: -99, cost: { wood: 80, stone: 40 }, storeMult: 1.5, beauty: 1.5, priceBonus: 0.1 },
    { name: 'General store', age: 2, need: -99, cost: { wood: 120, stone: 80, gold: 40 }, storeMult: 2, beauty: 2, priceBonus: 0.2 },
  ],
  // Shops hand goods to the homes around them (reach, in tiles) and sell a few spare goods each day (sells per day).
  shop: [
    { name: 'Stall', age: 0, need: -99, cost: {}, beauty: 1, reach: 6, sells: 2 },
    { name: 'Shop', age: 1, need: -99, cost: { wood: 60, stone: 20 }, beauty: 1.5, reach: 8, sells: 4 },
    { name: 'Emporium', age: 2, need: -99, cost: { stone: 60, gold: 20 }, beauty: 2.5, reach: 10, sells: 6 },
  ],
};
export const SHOP_PRICE = 0.5;   // shops sell spare goods at half what the merchant pays
export const UPGRADE_TIME = 5;        // seconds of work per level climbed
export const SLIDE_DAYS = 5;          // every 5th dawn, homes in surroundings far below their level slide down one
export const SLIDE_MARGIN = 1;
export const GOODS_USE_DAYS = 3;      // every 3rd dawn each home uses 1 of each good its level needs; short = slides back a level        // "far below" = more than this under the level's requirement

// Living economy
export const MEAL_HOURS = [7, 12, 18];
export const RATION = { food: 3, water: 3 };
export const WATER_RATE = { well: 0.5, shore: 0.8 };
export const LEAVE_HUNGRY_DAYS = 3;   // a villager who gets no food at all for 3 days in a row leaves the village

// Beauty: every source reaches this many tiles in every direction, fading with distance.
export const BEAUTY_RADIUS = 3;
export const BEAUTY_LABELS = [[6, 'Enchanting'], [3, 'Lovely'], [1, 'Pleasant'], [-1e9, 'Plain']];

// Land (engine, not a Director): how the land heals.
export const REGROW_PER_DAY = 0.05;   // a partly used node regrows 5% of its full amount per day
export const STUMP_SAPLING = 0.15;    // a felled tree leaves a sapling 15% of the time

// Social: time near others (awake, within 2 tiles) fills social up to 75%; the tavern can fill it to 100%;
// a village event locks it high for a few days.
// Spirits fade between celebrations: after `fadeAfter` days without a festival, company alone fills less and less
// (down to `floor`), so only the tavern or the next festival lifts them right up again.
export const SOCIAL = { nearCap: 0.75, target: 72, eventDays: 3, fadeAfter: 3, fadePerDay: 0.04, floor: 0.4 };

// Festivals. Social wants one more every day (+0.2 a day, up to 1). The biggest festival the village can afford for its age is held.
// The parade runs town center -> marketplace -> campfire -> town center, then everyone feasts at the campfire until bedtime.
// Afterwards: everyone's social stays full for SOCIAL.eventDays days, culture rises, and visitors may decide to stay.
export const FESTIVAL = { startHour: 17, wantPerDay: 0.2, declareAt: 0.6, perVillagerFood: 15, speed: 1.0, rowGap: 1.2, stayChance: 0.25 };
export const FESTIVALS = [
  // cost: fixed; per: for each villager. Each age's festival is much grander, and much dearer.
  { id: 'feast',   name: 'Harvest feast',  age: 0, cost: { wood: 40 }, per: { food: 15, water: 10 },                                                     culture: 15, visitors: 2, floats: 0 },
  { id: 'lantern', name: 'Lantern parade', age: 1, cost: { wood: 60, cloth: 15, pottery: 10, gold: 80 }, per: { food: 20, water: 15, beer: 4 },           culture: 30, visitors: 4, floats: 0, lanterns: true },
  { id: 'grand',   name: 'Grand parade',   age: 2, cost: { wood: 160, cloth: 30, furniture: 20, jewelry: 5, gold: 250 }, per: { food: 25, water: 20, beer: 6 }, culture: 50, visitors: 6, floats: 2, lanterns: true },
  { id: 'gala',    name: 'Grand gala',     age: 3, cost: { wood: 240, cloth: 40, jewelry: 15, candles: 20, gold: 600 }, per: { food: 30, water: 25, beer: 8 },  culture: 80, visitors: 8, floats: 3, lanterns: true },
];

// The traveling merchant: arrives every few days at 9:00 if there is a marketplace, buys the village's goods for gold.
export const MERCHANT = { everyDays: 3, hour: 9, stay: 120, speed: 1.6, price: { pottery: 4, cloth: 6, furniture: 8, jewelry: 18, beer: 3, wool: 2, candles: 5 }, ageBonus: 0.25,
  // What the merchant sells while at the marketplace (you buy; prices in gold, scaled by age for repeatable wares).
  wares: [
    { id: 'stone', name: 'Cut stone', desc: '10 stone, delivered to the stores.', gives: { stone: 10 }, price: 8, repeat: true },
    { id: 'lamppost', name: 'Lamp post plans', desc: 'Lets the village build lamp posts.', unlock: 'lamppost', price: 60 },
    { id: 'arbor', name: 'Rose arbor plans', desc: 'Lets the village build rose arbors.', unlock: 'arbor', price: 90, age: 1 },
  ] };

export const AGES = [
  { name: 'Hamlet', cost: null },
  { name: 'Village', cost: { food: 150, wood: 100 }, culture: 20 },
  { name: 'Town', cost: { food: 250, wood: 150, stone: 100, gold: 100 }, culture: 250 },
  { name: 'Township', cost: { food: 350, wood: 200, stone: 150, gold: 350 }, culture: 700 },
];
// Culture per second for each villager doing the activity; the artist adds the studio's craft output per piece.
// Culture is a running total that never goes down; each age needs the total above (not spent).
// Culture each home adds every morning, by level (Hut .. Grand manor): finer homes are a main road to the next age.
export const HOME_CULTURE = [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5];
export const CULTURE = { fire: 0.004, learn: 0.01, theater: 0.01, read: 0.016, church: 0.008, tavernBeer: 0.006, beerPerSec: 0.02 };
export const ADVANCE_TIME = 10;

// Upgrades modify g.mods. `apply` is pure data so saves only store owned ids.
// Upgrades: small steps in tiers. Each lives on the building it belongs to (`at`) and needs the tier before it (`req`).
// fx: gather {nodeKind: multiplier on seconds per unit}, carryAdd, farmFoodAdd, farmRate (multiplier), speedMul, craft {buildingKey: multiplier}.
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const tiers = (base, at, name, list) => list.map(([age, cost, desc, fx], i) => ({ id: base + (i + 1), at, name: `${name} ${ROMAN[i]}`, age, cost, desc, fx, req: i ? base + i : null }));
// Five tiers for every line: the same small step each time, dearer and later as the tiers rise.
const AGES5 = [0, 1, 1, 2, 3], SCALE5 = [1, 1.8, 2.6, 3.6, 5];
const five = (base, at, name, startAge, cost, desc, fx) => tiers(base, at, name, AGES5.map((a, i) => [Math.max(startAge, a) + (startAge && i === 0 ? 0 : 0), Object.fromEntries(Object.entries(cost).map(([r, n]) => [r, Math.round(n * SCALE5[i] / 5) * 5]).concat(i >= 2 && !cost.gold ? [['gold', 20 * (i - 1)]] : [])), desc, fx]));
const CRAFTERS = { potter: "potter", carpenter: "carpenter", weaver: "weaver", jeweler: "jeweler", mill: "miller", bakery: "baker", brewery: "brewer", studio: "artist", quarry: "stonecutter", claypit: "clay digger", goldmine: "miner", dairy: "cheesemaker", chandler: "chandler", coop: "hen keeper", sheepfold: "shepherd", pasture: "cowherd", apiary: "beekeeper" };
const ALL6 = { 1: 0.96, 2: 0.96, 3: 0.96, 4: 0.96, 5: 0.96, 6: 0.96 };
export const UPGRADES = [
  // Town center
  ...five('baskets', 'tc', 'Bigger Baskets', 0, { wood: 60, food: 60 }, 'Carry 1 more of everything.', { carryAdd: 1 }),
  ...five('boots', 'tc', 'Sturdy Boots', 1, { food: 120, gold: 30 }, 'Villagers walk 4% faster.', { speedMul: 1.04 }),
  ...five('tools', 'tc', 'Better Tools', 1, { wood: 150, stone: 60 }, 'Gather everything 4% faster.', { gather: ALL6 }),
  // Lumber mill and storehouse
  ...five('axes', 'lumbermill', 'Sharper Axes', 0, { wood: 80 }, 'Chop wood 8% faster.', { gather: { 1: 0.92 } }),
  ...five('picks', 'store', 'Stone Picks', 0, { wood: 120 }, 'Mine stone and gold 8% faster.', { gather: { 2: 0.92, 3: 0.92 } }),
  // Farmhouse: everything farming
  ...five('soil', 'farmhouse', 'Rich Soil', 0, { wood: 100, food: 40 }, 'Fields hold 12 more and grow 6% faster.', { farmFoodAdd: 12, farmRate: 0.94 }),
  ...five('breeding', 'farmhouse', 'Good Breeding', 0, { wood: 80, food: 60 }, 'Every pen holds one more animal.', { penAdd: 1 }),
  // Granary
  ...five('nets', 'granary', 'Wide Nets', 0, { wood: 80, food: 30 }, 'Fish and gather berries 8% faster.', { gather: { 4: 0.92, 5: 0.92 } }),
  // Every workshop
  ...Object.entries(CRAFTERS).flatMap(([k, role]) => five('kit-' + k + '-', k, 'Finer Equipment', 0, { wood: 60, gold: 15 }, `The ${role} works 6% faster.`, { craft: { [k]: 0.94 } })),
];
// Ids from older saves.
export const LEGACY_UPGRADE = { axes: 'axes1', baskets: 'baskets1', picks: 'picks1', soil: 'soil1', nets: 'nets1', boots: 'boots1', tools: 'tools1' };

export const VILLAGER_COST = { food: 50 };
export const RESOW_COST = 15;
export const TRADE = { give: 100, get: 75 };
export const FARM_MAX_WORKERS = 2;

export const NAMES = ['Pip', 'Willa', 'Bram', 'Tansy', 'Odo', 'Maple', 'Fenn', 'Lark', 'Juniper', 'Rowan',
  'Hazel', 'Wren', 'Clover', 'Basil', 'Nell', 'Thistle', 'Moss', 'Posy', 'Ember', 'Briar'];
export const COLORS = ['#c9553d', '#4f7fb5', '#8a5fb0', '#d19a3a', '#4f9a7a'];
// Villagers come in every skin tone and hair color; each newcomer is picked at random.
export const SKINS = ['#3b2219', '#5a3825', '#7a4a2e', '#8d5a3b', '#a8714a', '#c08a5d', '#d6a77a', '#e8c09a', '#f3d3b5', '#6b4430'];
export const HAIRS = ['#1e1a18', '#2e2420', '#3d2b20', '#5a3a26', '#7a5638', '#a0522d', '#c9a060', '#8a8580', '#e2ddd5'];

export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

// Village focus dial (set by the player at the town center).
export const FOCI = [
  { id: 'balanced', icon: '⚖️', name: 'Balanced', mult: {} },
  { id: 'food',     icon: '🍎', name: 'Food',     mult: { fish: 1.6, berry: 1.6, farm: 1.6, wood: 0.8, build: 0.8 } },
  { id: 'wood',     icon: '🪵', name: 'Wood',     mult: { wood: 1.6, fish: 0.8, berry: 0.8 } },
  { id: 'building', icon: '🔨', name: 'Building', mult: { build: 1.6, wood: 1.2 } },
  { id: 'relaxed',  icon: '☕', name: 'Relaxed',  mult: { rest: 2.2, fire: 1.5, fish: 0.7, berry: 0.7, farm: 0.7, wood: 0.7, build: 0.7, plant: 0.7, stone: 0.7, gold: 0.7 } },
];

// Action priorities for the override stack. Higher preempts lower.
export const PRI = { AUTO: 1, SOCIAL: 2, PLAYER: 3, SLEEP: 4 };
