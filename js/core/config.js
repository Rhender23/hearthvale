// Static game data. No logic, no state. Every other module reads from here.
export const N = 40, TW = 64, TH = 32;
export const DAY = 864;        // seconds of real time per game day (midnight to 5am lasts 180s)
export const SEASON = 480;     // seconds per season
export const BEDTIME = 23, WAKE = 5;
export const SAVE_KEY = 'hearthvale-v2', LEGACY_KEY = 'hearthvale';

export const BASICS = ['wood', 'stone', 'gold', 'food', 'water'];
export const GOODS = ['clay', 'fiber', 'pottery', 'cloth', 'furniture'];   // raw materials for workshops, and what they make
export const RES = [...BASICS, ...GOODS];
export const ICON = { wood: '🪵', stone: '🪨', gold: '🪙', food: '🍎', water: '💧', clay: '🟤', fiber: '🌿', pottery: '🏺', cloth: '🧵', furniture: '🪑' };
export const RES_NAME = { wood: 'Wood', stone: 'Stone', gold: 'Gold', food: 'Food', water: 'Water', clay: 'Clay', fiber: 'Fiber', pottery: 'Pottery', cloth: 'Cloth', furniture: 'Furniture' };

// Resource nodes on the map.
export const NODE = { TREE: 1, STONE: 2, GOLD: 3, BERRY: 4, FISH: 5, CLAY: 6 };
export const NODE_INFO = {
  1: { key: 'wood',  res: 'wood',  amt: 40, rate: 1.0, verb: 'Chopping wood' },
  2: { key: 'stone', res: 'stone', amt: 50, rate: 1.3, verb: 'Mining stone' },
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
export const BUILD = {
  campfire: { name: 'Campfire', size: 1, time: 1, cost: {}, age: 0, pop: 3, placer: 'none', fixed: true,
              store: { wood: 100, stone: 40, gold: 20, food: 60, water: 40, clay: 30, fiber: 30, pottery: 20, cloth: 20, furniture: 10 },
              desc: 'Where the village began. Until there is a town center, villagers are trained and gather here.' },
  tc:       { name: 'Town center', size: 2, time: 30, cost: { wood: 150, stone: 40 }, age: 0, pop: 5, placer: 'player', beauty: 1, hub: true,
              store: { wood: 200, stone: 100, gold: 400, food: 100, water: 60, clay: 40, fiber: 40, pottery: 30, cloth: 30, furniture: 20 },
              desc: 'The heart of the village. Needed to grow beyond a hamlet. Trains villagers, researches upgrades and advances the age.' },
  house:    { name: 'House', size: 1, time: 8, cost: { wood: 25 }, age: 0, home: true, placer: 'village',
              desc: 'A home. It improves as its surroundings grow lovelier.' },
  store:    { name: 'Storehouse', size: 1, time: 10, cost: { wood: 40 }, age: 0, placer: 'village', beauty: -1,
              store: { wood: 300, stone: 200, gold: 150, food: 150, water: 50, clay: 100, fiber: 100, pottery: 40, cloth: 40, furniture: 20 }, desc: 'Holds everything the village gathers and makes, so villagers walk less.' },
  farm:     { name: 'Farm', size: 2, time: 8, cost: { wood: 60 }, age: 0, flat: true, food: 100, crop: 'food', placer: 'village', beauty: -1,
              desc: 'A field that grows food. Re-sown for a little wood when it runs out.' },
  well:     { name: 'Well', size: 1, time: 6, cost: { wood: 10, stone: 20 }, age: 0, placer: 'village', water: 60, refill: 40, beauty: 1,
              desc: 'Fresh water close to home.' },
  flowerbed:{ name: 'Flower bed', size: 1, time: 2, cost: { wood: 5 }, age: 0, flat: true, placer: 'village', decor: true, beauty: 2,
              desc: 'A splash of color. Makes the area around it prettier.' },
  bench:    { name: 'Bench', size: 1, time: 3, cost: { wood: 10 }, age: 0, placer: 'village', decor: true, beauty: 1.5,
              desc: 'A place to rest and enjoy the view.' },
  path:     { name: 'Path', size: 1, time: 1, cost: { stone: 2 }, age: 0, flat: true, walk: true, placer: 'village', decor: true, beauty: 0.5,
              desc: 'A stone path. Villagers walk a little faster on it.' },
  statue:   { name: 'Statue', size: 1, time: 8, cost: { stone: 40 }, age: 1, placer: 'village', decor: true, beauty: 4,
              desc: 'A carved stone figure. Greatly beautifies the area.' },
  garden:   { name: 'Garden', size: 1, time: 4, cost: { wood: 30, stone: 10 }, age: 1, flat: true, placer: 'village', decor: true, beauty: 3,
              desc: 'Tended flower beds that make the village lovely.' },
  lamppost: { name: 'Lamp post', size: 1, time: 3, cost: { wood: 5, gold: 3 }, age: 0, placer: 'village', decor: true, beauty: 2, unlock: true,
              desc: 'A glass lamp on an iron post. Glows warmly at night.' },
  arbor:    { name: 'Rose arbor', size: 1, time: 5, cost: { wood: 15, gold: 5 }, age: 1, placer: 'village', decor: true, beauty: 3.5, unlock: true,
              desc: 'An arch of climbing roses. Lovely in every season but winter.' },
  tavern:   { name: 'Tavern', size: 2, time: 16, cost: { wood: 80, stone: 40 }, age: 1, placer: 'player', beauty: 2,
              store: { gold: 50, food: 80, water: 80 }, desc: 'Where villagers gather in the evening.' },
  lodge:    { name: 'Lodge', size: 2, time: 14, cost: { wood: 80, stone: 20 }, age: 1, pop: 12, beds: 12, home: true, placer: 'player', beauty: 1,
              store: { gold: 20, food: 60, water: 60 }, desc: 'A large home with 12 beds.' },
  market:   { name: 'Marketplace', size: 2, time: 12, cost: { wood: 60, stone: 20 }, age: 0, placer: 'player', beauty: 1.5,
              store: { gold: 600, pottery: 40, cloth: 40, furniture: 20 }, desc: 'A traveling merchant visits every few days to buy what the village makes. You can also swap resources here.' },
  fiberfield:{ name: 'Fiber field', size: 2, time: 6, cost: { wood: 40 }, age: 0, flat: true, food: 60, crop: 'fiber', placer: 'village', beauty: 0,
              desc: 'Tall fiber plants for the weaver to spin and weave. Re-sown for a little wood when it runs out.' },
  potter:   { name: "Potter's workshop", size: 1, time: 10, cost: { wood: 40, stone: 10 }, age: 0, placer: 'village', beauty: 0.5,
              craft: { role: 'potter', in: { clay: 2 }, out: { pottery: 1 }, time: 6 }, desc: 'A potter turns clay into pottery.' },
  carpenter:{ name: "Carpenter's shop", size: 1, time: 10, cost: { wood: 50, stone: 10 }, age: 0, placer: 'village', beauty: 0.5,
              craft: { role: 'carpenter', in: { wood: 4 }, out: { furniture: 1 }, time: 8 }, desc: 'A carpenter turns wood into furniture.' },
  weaver:   { name: "Weaver's cottage", size: 1, time: 10, cost: { wood: 40, stone: 10 }, age: 1, placer: 'village', beauty: 0.5,
              craft: { role: 'weaver', in: { fiber: 2 }, out: { cloth: 1 }, time: 7 }, desc: 'A weaver turns fiber into cloth.' },
  // Culture. Time spent at these (and stories by the fire) adds to the village's culture, which each new age requires.
  school:   { name: 'Schoolhouse', size: 1, time: 12, cost: { wood: 60, stone: 15 }, age: 0, placer: 'village', beauty: 1, culture: true,
              desc: 'Lessons in letters, numbers and crafts. Learning here adds to the village\'s culture.' },
  studio:   { name: "Artist's studio", size: 1, time: 12, cost: { wood: 60, stone: 20 }, age: 1, placer: 'village', beauty: 2, culture: true,
              craft: { role: 'artist', in: { wood: 3 }, out: { culture: 1 }, time: 30 }, desc: 'An artist paints and carves here. Every finished piece adds to the village\'s culture.' },
  theater:  { name: 'Theater', size: 2, time: 20, cost: { wood: 120, stone: 60 }, age: 1, placer: 'village', beauty: 2.5, culture: true,
              desc: 'Plays, music and dancing in the evenings. An audience adds to the village\'s culture.' },
  monument: { name: 'Monument', size: 2, time: 40, cost: { wood: 300, stone: 300, gold: 200 }, age: 3, placer: 'player', beauty: 8,
              desc: 'A grand landmark that crowns your village.' },
};
export const BUILD_ORDER = ['tc', 'house', 'store', 'farm', 'well', 'market', 'potter', 'carpenter', 'fiberfield', 'weaver', 'school', 'studio', 'theater', 'flowerbed', 'bench', 'path', 'lamppost', 'statue', 'garden', 'arbor', 'tavern', 'lodge', 'monument'];
export const ROLE_NAME = { potter: 'potter', carpenter: 'carpenter', weaver: 'weaver', artist: 'artist' };
export const STORE_MULT_SANDBOX = 10;

// Levels. A building rises to the highest level whose age and beauty requirement are met,
// paying the cost of every step it climbs. Homes judge beauty by their surroundings (excluding themselves).
//   age   village age needed   need  minimum surroundings score   cost  paid when a villager does the work
//   beds, store, beauty  what the building has at this level
const H = (name, age, need, cost, beds, food, beauty, goods = []) => ({ name, age, need, cost, beds, beauty, goods, store: { gold: 5 + beds * 2, food, water: food } });
const P = ['pottery'], PF = ['pottery', 'furniture'], PFL = ['pottery', 'furniture', 'cloth'];
export const TIERS = {
  house: [
    H('Hut', 0, 0, {}, 3, 20, 0),
    H('Cottage', 0, 1, { wood: 30 }, 4, 30, 0.5),
    H('Cozy cottage', 0, 2, { wood: 40, food: 20 }, 5, 40, 1, P),
    H('Timber house', 1, 2.5, { wood: 60, stone: 20 }, 6, 50, 1.5, PF),
    H('Fine timber house', 1, 3.5, { wood: 60, stone: 40 }, 7, 60, 2, PF),
    H('Stone house', 2, 4, { wood: 40, stone: 80 }, 8, 70, 2.5, PFL),
    H('Fine stone house', 2, 5, { stone: 100, gold: 10 }, 9, 80, 3, PFL),
    H('Manor', 3, 6, { stone: 120, gold: 40 }, 10, 90, 3.5, PFL),
    H('Grand manor', 3, 7.5, { stone: 150, gold: 80 }, 12, 100, 4, PFL),
  ],
  well: [
    { name: 'Well', age: 0, need: -99, cost: {}, water: 60, refill: 40, beauty: 1 },
    { name: 'Fountain', age: 1, need: 2, cost: { stone: 50 }, water: 100, refill: 70, beauty: 3 },
  ],
  campfire: [
    { name: 'Campfire', age: 0, need: -99, cost: {}, beauty: 0.5, company: 1 },
    { name: 'Fire circle', age: 1, need: -99, cost: { wood: 30 }, beauty: 1.5, company: 1.5 },
    { name: 'Lantern green', age: 2, need: -99, cost: { wood: 40, gold: 20 }, beauty: 3, company: 2 },
  ],
  store: [
    { name: 'Storehouse', age: 0, need: -99, cost: {}, storeMult: 1, beauty: -1 },
    { name: 'Large storehouse', age: 1, need: -99, cost: { wood: 80, stone: 40 }, storeMult: 1.6, beauty: -0.5 },
    { name: 'Grand storehouse', age: 2, need: -99, cost: { wood: 120, stone: 80 }, storeMult: 2.4, beauty: 0 },
  ],
};
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
export const SOCIAL = { nearCap: 0.75, target: 72, eventDays: 3 };

// The traveling merchant: arrives every few days at 9:00 if there is a marketplace, buys the village's goods for gold.
export const MERCHANT = { everyDays: 3, hour: 9, stay: 120, speed: 1.6, price: { pottery: 4, cloth: 6, furniture: 8 }, ageBonus: 0.25,
  // What the merchant sells while at the marketplace (you buy; prices in gold, scaled by age for repeatable wares).
  wares: [
    { id: 'stone', name: 'Cut stone', desc: '10 stone, delivered to the stores.', gives: { stone: 10 }, price: 8, repeat: true },
    { id: 'lamppost', name: 'Lamp post plans', desc: 'Lets the village build lamp posts.', unlock: 'lamppost', price: 60 },
    { id: 'arbor', name: 'Rose arbor plans', desc: 'Lets the village build rose arbors.', unlock: 'arbor', price: 90, age: 1 },
  ] };

export const AGES = [
  { name: 'Hamlet', cost: null },
  { name: 'Village', cost: { food: 150, wood: 100 }, culture: 15 },
  { name: 'Town', cost: { food: 250, wood: 150, stone: 100 }, culture: 120 },
  { name: 'Township', cost: { food: 350, wood: 200, stone: 150, gold: 100 }, culture: 300 },
];
// Culture per second for each villager doing the activity; the artist adds the studio's craft output per piece.
// Culture is a running total that never goes down; each age needs the total above (not spent).
export const CULTURE = { fire: 0.004, learn: 0.01, theater: 0.01 };
export const ADVANCE_TIME = 10;

// Upgrades modify g.mods. `apply` is pure data so saves only store owned ids.
export const UPGRADES = [
  { id: 'axes',    name: 'Sharper Axes',   age: 0, cost: { wood: 100 },                       desc: 'Chop wood 25% faster.',                fx: { gather: { 1: 0.75 } } },
  { id: 'baskets', name: 'Wicker Baskets', age: 0, cost: { wood: 50, food: 100 },             desc: 'Carry 12 instead of 8.',               fx: { carry: 12 } },
  { id: 'picks',   name: 'Stone Picks',    age: 1, cost: { wood: 150 },                       desc: 'Mine stone and gold 25% faster.',      fx: { gather: { 2: 0.75, 3: 0.75 } } },
  { id: 'soil',    name: 'Rich Soil',      age: 1, cost: { wood: 120, stone: 50 },            desc: 'Farms hold 150 food and yield faster.', fx: { farmFood: 150, farmRate: 0.75 } },
  { id: 'nets',    name: 'Wide Nets',      age: 1, cost: { wood: 100, food: 50 },             desc: 'Fish 25% faster.',                     fx: { gather: { 5: 0.75 } } },
  { id: 'boots',   name: 'Swift Boots',    age: 2, cost: { food: 150, gold: 60 },             desc: 'Villagers walk 25% faster.',           fx: { speed: 3 } },
  { id: 'tools',   name: 'Master Tools',   age: 3, cost: { wood: 200, stone: 150, gold: 100 }, desc: 'Gather everything 20% faster.',       fx: { gather: { 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8 } } },
];

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
