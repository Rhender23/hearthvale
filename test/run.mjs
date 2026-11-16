// Targeted checks, headless (about 30 s). Run: node test/run.mjs   (and node test/render-smoke.mjs for drawing)
// Each check is small and names the rule it protects.
import { createGame, update, simulate } from '../js/core/game.js';
import { DAY, SEASON, BUILD, UPGRADES, AGES, MEALS, TIERS, MERCHANT, NAMES } from '../js/core/config.js';
import { createVillager } from '../js/core/villagers.js';
import { CRITTERS, NIGHT_ANIMALS, HOME_DECOR } from '../js/core/critters.js';
import { addBuilding, completeBuilding, hour, calDay, keepsWay, farmFor } from '../js/core/state.js';
import { isOpen } from '../js/core/world.js';
import { orderGather, canPlace } from '../js/core/commands.js';
import { go, footing } from '../js/core/actions.js';
import { besideRect, walkable } from '../js/core/world.js';
import { workersAt } from '../js/ui/render/workers.js';
import { popCap } from '../js/core/state.js';
import { villagerWants, buildingWants } from '../js/ui/panels.js';
import { NODE } from '../js/core/config.js';
import { serialize, deserialize } from '../js/core/save.js';
import { syncLayout, floorsOf, itemsOn, moveItem, turnItem, placePiece } from '../js/core/furnish.js';
import { beds, takeDown } from '../js/core/state.js';
import { orchardDawn } from '../js/core/orchards.js';
import { stageDone, canWork, beginNext } from '../js/core/grand.js';
import { carryOf } from '../js/core/stable.js';
import { researchCost } from '../js/core/research.js';
import { everyDays } from '../js/core/merchant.js';
import { restBoost } from '../js/core/leisure.js';
import { festivalCulture } from '../js/core/festival.js';
import { outputPerDay } from '../js/core/planner.js';
import { place } from '../js/core/commands.js';
import { buildNeeds, upgradeNeeds, ageNeeds, villagerNeeds, shortOf } from '../js/core/requires.js';
import { improveInfo, skipToFestival } from '../js/core/commands.js';
import { evaluate } from '../js/core/planner.js';
import { payback } from '../js/core/directors.js';

let pass = 0, fail = 0;
const check = (name, ok, more = '') => { if (ok) pass++; else fail++; console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : '  ' + more}`); };
const modest = (seed = 8) => createGame({ seed, sandbox: false });

// ---------------------------------------------------------------- what greyed-out things need
{
  const g = modest();
  check('town center card says what is short', buildNeeds(g, 'tc') === 'Needs 100 more wood and 40 more stone.', buildNeeds(g, 'tc'));
  check('affordable card needs nothing', buildNeeds(g, 'house') === null, buildNeeds(g, 'house'));
  check('age-locked card names the age', buildNeeds(g, 'statue') === 'Opens in the Village Age.', buildNeeds(g, 'statue'));
  check('firefly lantern says how to unlock it', /fireflies/.test(buildNeeds(g, 'fireflylamp') || ''), buildNeeds(g, 'fireflylamp'));
  check('a field without a farmhouse says so', /farmhouse/.test(buildNeeds(g, 'wheatfield') || ''), buildNeeds(g, 'wheatfield'));
  check('next age without a town center says so', /town center/.test(ageNeeds(g) || ''), ageNeeds(g));
  const later = UPGRADES.find(u => u.age > 0);
  check('age-locked upgrade says when', /Age/.test(upgradeNeeds(g, later) || ''), upgradeNeeds(g, later));
  const chained = UPGRADES.find(u => u.req);
  check('second tier names the first', (upgradeNeeds(g, chained) || '').includes('first') || chained.age > 0, upgradeNeeds(g, chained));
  const elsewhere = UPGRADES.find(u => u.at !== 'tc' && u.age === 0 && !u.req);
  if (elsewhere) check('upgrade at a missing building says which', /finished/.test(upgradeNeeds(g, elsewhere) || ''), upgradeNeeds(g, elsewhere));
  check('every greyed upgrade explains itself', UPGRADES.every(u => g.owned[u.id] || upgradeNeeds(g, u) !== '' ), '');
  check('shortOf lists each material', shortOf({ res: { wood: 5, stone: 0 } }, { wood: 10, stone: 3 }) === 'Needs 5 more wood and 3 more stone.');
  check('villager reason when there is food', villagerNeeds(g) === null || typeof villagerNeeds(g) === 'string');
}

// ---------------------------------------------------------------- the planner (Free build)
let simG, log = [];
{
  const g = simG = modest(8); g.freeBuild = true;
  const openAt = [];
  g.events.on('planned', ({ b }) => { log.push({ k: b.k, d: g.clock / DAY }); openAt.push(g.buildings.filter(o => !o.done && o.k === b.k && o !== b).length); });
  simulate(g, 14 * DAY, 0.05);   // two weeks of the halved clock (the same real time as one old week)
  const at = k => log.findIndex(e => e.k === k), has = k => g.buildings.some(b => b.k === k);
  check('town center comes first among big buildings, early', at('tc') >= 0 && log[at('tc')].d < 3, JSON.stringify(log.slice(0, 6)));
  check('a home is built for the newcomers', has('house'));
  check('furniture maker once homes need furniture (Village Age)', has('carpenter'), JSON.stringify(log.map(e => e.k)));
  check('chain order: farmhouse before wheat field before brewery', at('farmhouse') < at('wheatfield') && at('wheatfield') < at('brewery') || !has('brewery'), JSON.stringify(log.map(e => e.k)));
  check('never two of the same storage under way at once', log.every((e, i) => !['store', 'granary', 'lumbermill'].includes(e.k) || openAt[i] === 0));
  check('no flower-bed flood (≤ 12 decorations in two weeks)', g.buildings.filter(b => BUILD[b.k].decor).length <= 12, g.buildings.filter(b => BUILD[b.k].decor).length);
  check('village reaches the Village Age within two weeks', g.age >= 1, `age ${g.age}`);
  const homes = g.buildings.filter(b => b.k === 'house' && b.done);
  check('home reasons are specific, never vague', homes.every(h => { const i = improveInfo(g, h); return !i.reason || !/Not enough materials yet/.test(i.reason); }), homes.map(h => improveInfo(g, h).reason).join(' | '));
  const ev = evaluate(g, { cultureRate: 10 });
  check('planner scores are finite and explained', ev.length > 0 && ev.every(c => Number.isFinite(c.score) && c.why), ev.slice(0, 3).map(c => c.k + c.score).join());
}
{
  const g = modest(8);   // Free will (not Free build): the village plans nothing
  simulate(g, 1 * DAY, 0.05);
  check('without Free build the village places nothing', !g.buildings.some(b => b.k !== 'campfire'), g.buildings.map(b => b.k).join());
}

// ---------------------------------------------------------------- seasonal festivals (v38)
{
  const g0 = createGame({ seed: 4, sandbox: true }), n0 = []; g0.events.on('notice', t => n0.push(t));
  simulate(g0, DAY * 1.6, 0.1);
  check('no egg hunt in the village\'s first year', !n0.some(t => /egg hunt/.test(t)), n0.filter(t => /egg/.test(t)).join(' / '));
  const g = createGame({ seed: 4, sandbox: true });
  g.clock += DAY * 24 - DAY * 0.4;   // the second spring
  const notes = []; g.events.on('notice', t => notes.push(`${calDay(g)}|${hour(g).toFixed(1)}|${t}`));
  simulate(g, DAY * 2, 0.1);
  const eve = notes.find(t => /Tomorrow is the spring egg hunt/.test(t)), day1 = notes.find(t => /Spring egg hunt today/.test(t));
  const start = day1 && +day1.split('|')[1], end = notes.find(t => /caught the bunny/.test(t));
  check('the hunt is over within about two game hours', start && end && +end.split('|')[1] - start <= 3, `${start} → ${end && end.split('|')[1]}`);
  check('the second spring has its egg hunt, announced the day before', !!eve && !!day1 && +eve.split('|')[0] === +day1.split('|')[0] - 1, notes.filter(t => /egg/.test(t)).join(' / '));
  check('the bunny is caught and eggs were found', notes.some(t => /caught the bunny/.test(t) && !/ 0 eggs/.test(t)), notes.filter(t => /lovely/.test(t)).join(' / '));
  const slip = notes.findIndex(t => /wriggled free/.test(t)), caught = notes.findIndex(t => /caught the bunny/.test(t));
  check('the bunny slips free once before it is caught', slip >= 0 && caught > slip && notes.filter(t => /wriggled free/.test(t)).length === 1, notes.filter(t => /bunny/.test(t)).join(' / '));
  const seen = [], hours = {};
  for (let n = 0; n < 4; n++) {
    skipToFestival(g);
    let decorBefore = false;
    for (let k = 0; k < 4000 && !(g.seasonal && g.seasonal.phase === 'on'); k++) { if (g.seasonal && g.seasonal.phase === 'decor') decorBefore = true; update(g, 0.25); }
    const F = g.seasonal; seen.push(F ? F.id : 'none'); hours[F.id] = hour(g);
    check(`${F.id}: decorations are up before it starts`, decorBefore);
    if (F.id === 'christmas') check('Santa leads the Christmas parade', !!F.santa);
    for (let k = 0; k < 4000 && g.seasonal && g.seasonal.phase === 'on'; k++) update(g, 0.25);
    check(`${F.id}: it ends the same day`, g.seasonal && g.seasonal.phase === 'after');
    for (let k = 0; k < 4000 && g.seasonal; k++) update(g, 0.25);
    check(`${F.id}: decorations come down the next morning`, !g.seasonal && hour(g) >= 5 && hour(g) < 6, hour(g));
  }
  check('skip reaches each festival in turn', seen.join() === 'summer,halloween,christmas,easter', seen.join());
  check('festival hours: beach 10, Halloween noon, Christmas 9', Math.floor(hours.summer) === 10 && Math.floor(hours.halloween) === 12 && Math.floor(hours.christmas) === 9, JSON.stringify(hours));
  const g2 = deserialize(serialize(g));
  check('save keeps the festival bookkeeping', g2.seasonalDone === g.seasonalDone);
  check('skip is sandbox only', skipToFestival(modest()).ok === false);
}

// ---------------------------------------------------------------- v38: clock, meals, wells, culture, Free build, night animals
{
  check('a game hour is 18 s and a day 7.2 min', DAY === 432);
  check('meals are whole numbers: 2, 1, 2', MEALS.map(m => m[1]).join() === '2,1,2' && MEALS.every(m => Number.isInteger(m[1])));
  const g = modest(); const before = g.res.food; for (const v of g.villagers) v.full = 0.5;
  g.manager.directors.find(d => d.name === 'Villagers').meal(g, 2);
  check('a breakfast takes 2 food per villager', before - g.res.food === 2 * g.villagers.length, before - g.res.food);
  check('wells hold 100 and refill 50 a game hour', TIERS.well[0].water === 100 && TIERS.well[0].refill / 24 === 50);
}
{
  const g = createGame({ seed: 8, sandbox: true }); g.age = 1;
  const h = addBuilding(g, 'house', 20, 28, true); h.lvl = 0;
  const c0 = g.culture = 50; simulate(g, DAY, 0.1);
  check('a home behind the age costs a little culture each morning', g.cultureLog && g.cultureLog.homes && g.cultureLog.homes.n >= 1 && g.cultureLog.homes.lost > 0, JSON.stringify(g.cultureLog));
  const h0 = createGame({ seed: 8, sandbox: true }); h0.culture = 50; addBuilding(h0, 'house', 20, 28, true); simulate(h0, DAY, 0.1);
  check('no culture drain before the Village Age', !h0.cultureLog || !h0.cultureLog.homes);
}
{
  check('Free build may place the tavern, lodge, trading post and monument', ['tavern', 'lodge', 'market', 'monument'].every(k => BUILD[k].placer === 'village'));
  let rolls = { fox: 0, raccoon: 0, wolf: 0, bear: 0, none: 0 };
  for (let s = 0; s < 400; s++) { const g = createGame({ seed: s, sandbox: true }); addBuilding(g, 'house', 20, 22, true); g.tod = (22.9 - 6) / 24; for (let k = 0; k < 40; k++) update(g, 0.1); const a = (g.critters || []).find(c => CRITTERS[c.type].night); rolls[a ? a.type : 'none']++; }
  check('night animals: fox most often, bear rarest (one a night at most)', rolls.fox > rolls.raccoon && rolls.raccoon > rolls.wolf && rolls.wolf > rolls.bear && rolls.none > 0, JSON.stringify(rolls));
  check('each night animal has a home treasure', NIGHT_ANIMALS.every(k => Object.values(HOME_DECOR).some(d => d.critter === k)));
}

{
  const g = createGame({ seed: 8, sandbox: true }); g.age = 2;
  check('the merchant sells no plans', !MERCHANT.wares.some(w => w.unlock));
}

// ---------------------------------------------------------------- workshops by value, research by payback (v41)
{
  const g = createGame({ seed: 8, sandbox: false }); g.freeBuild = true; g.freeWill = true;
  simulate(g, DAY * 14, 0.1);
  check('general work is measured and compared with each workshop', g.workValue && Number.isFinite(g.workValue.general), JSON.stringify(g.workValue));
  check('gold does not pile up (under 1000 by day 14)', g.res.gold < 1000, g.res.gold);
  check('furniture does not pile up', g.res.furniture < 40, g.res.furniture);
  check('homes reach the cozy cottage by day 14 (timber houses wait for tools)', g.buildings.some(b => b.k === 'house' && b.lvl >= 2), g.buildings.filter(b => b.k === 'house').map(b => b.lvl).join());
  const basket = UPGRADES.find(u => u.fx && u.fx.carryAdd);
  check('an upgrade with no income behind it never pays back', payback(createGame({ seed: 1 }), basket) === Infinity);
  check('bigger baskets pay back in a working village', payback(g, basket) < 50, payback(g, basket));
  const g2 = deserialize(serialize(g));
  check('the measure of general work is saved', g2.workLog && g2.workLog.ydaySec === g.workLog.ydaySec);
}

// ---------------------------------------------------------------- jobs kept overnight; nothing walled off (v41)
for (const fw of [false, true]) {
  const g = createGame({ seed: 5, sandbox: false }); g.freeWill = fw;
  const v = g.villagers[0];
  let tree = -1; for (let i = 0; i < 1600; i++) if (g.w.R[i] === NODE.TREE && g.w.A[i] > 0 && Math.hypot(i % 40 - v.x, ((i / 40) | 0) - v.y) < 8) { tree = i; break; }
  simulate(g, 30, 0.1); orderGather(g, [v], tree);
  while (calDay(g) < 2 || hour(g) < 9.5) update(g, 0.1);   // day 2 (day 1 is the egg hunt)
  check(`a woodcutter is back at the trees the next morning (free will ${fw ? 'on' : 'off'})`, v.duty && v.act && v.act.key === 'wood', v.act && (v.act.key || v.act.type));
}
{
  const g = createGame({ seed: 5, sandbox: true });
  const b = addBuilding(g, 'well', g.w.fire.x + 4, g.w.fire.y, true);
  for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) if (g.w.A[y * 40 + x] > 0) g.w.A[y * 40 + x] = 0;   // clear trees and rocks around it
  const ring = []; for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) if (isOpen(g.w, x, y)) ring.push([x, y]);
  const last = ring.pop(); for (const [x, y] of ring) addBuilding(g, 'flowerbed', x, y, true);
  g.clock += 1;   // a new moment: the reach is worked out afresh
  check('the village never picks a spot that walls something in', ring.length > 0 && !keepsWay(g, last[0], last[1], 1, 1), ring.length);
  check('...but you may build there', canPlace(g, 'flowerbed', last[0], last[1]));
  addBuilding(g, 'flowerbed', last[0], last[1], true);
  const v = g.villagers[0], a = { type: 'fetch', key: 'water', b: b.id, tries: 0 }; v.path = [];
  go(g, v, a, (x, y) => besideRect(x, y, b.x, b.y, b.w, b.h));
  check('a villager who can\'t get there says so in their bubble', /Can't find a way to the well/.test(villagerWants(g, v)), villagerWants(g, v));
  check('...but open ground elsewhere is fine', keepsWay(g, g.w.fire.x - 6, g.w.fire.y - 6, 1, 1));
}

// ---------------------------------------------------------------- names (v41)
{
  check('at least 200 names to draw from, all different', NAMES.length >= 200 && new Set(NAMES).size === NAMES.length, NAMES.length);
  const g = createGame({ seed: 12, sandbox: true });
  for (let i = 0; i < 250; i++) createVillager(g, g.w.fire.x, g.w.fire.y + 1);   // (it joins the village itself)
  check('no two living villagers share a name, even past 200', new Set(g.villagers.map(v => v.name)).size === g.villagers.length, g.villagers.length);
  const a = createGame({ seed: 1 }).villagers.map(v => v.name).join(), b = createGame({ seed: 2 }).villagers.map(v => v.name).join();
  check('each village draws its names in its own order', a !== b, a + ' / ' + b);
}

// ---------------------------------------------------------------- paths wear into roads by use
{
  check('paths are a little quicker underfoot: 1%, 2%, 3%', TIERS.path.map(t => t.speed).join() === '1.01,1.02,1.03');
  const g = createGame({ seed: 8, sandbox: false }); g.freeWill = true; g.freeBuild = true;
  simulate(g, DAY * 4, 0.1);
  const f = g.w.fire, paths = [];
  for (let y = f.y - 5; y <= f.y + 5; y++) for (let x = f.x - 5; x <= f.x + 5; x++) if (isOpen(g.w, x, y)) paths.push(addBuilding(g, 'path', x, y, true));
  const stone = g.res.stone;
  simulate(g, DAY * 8, 0.1);
  const up = paths.filter(b => b.lvl > 0), quiet = paths.filter(b => !b.lvl);
  const avg = l => l.reduce((s, b) => s + (b.wear || 0), 0) / Math.max(1, l.length);
  check('the busiest stretches wear into gravel lanes', up.length > 0 && up.length < paths.length, `${up.length} of ${paths.length}`);
  check('...and they are the ones walked most', avg(up) > avg(quiet), `${avg(up).toFixed(0)} vs ${avg(quiet).toFixed(0)}`);
  const g2 = deserialize(serialize(g)), p2 = g2.buildings.find(b => b.k === 'path' && b.lvl > 0);
  check('path wear is saved', p2 && p2.wear > 0);
}

// ---------------------------------------------------------------- v44: walking through the woods, the campfire, work badges
{
  const g = createGame({ seed: 5, sandbox: true });
  let tree = -1; for (let i = 0; i < 1600; i++) if (g.w.A[i] > 0 && g.w.T[i] === 0) { tree = i; break; }
  check('villagers can walk through trees, rocks and bushes', tree >= 0 && walkable(g.w, tree % 40, (tree / 40) | 0));
  check('the campfire houses no one', BUILD.campfire.pop === 0 && popCap(createGame({ seed: 1, sandbox: false })) === 0);
  const g2 = createGame({ seed: 8, sandbox: false }); g2.freeBuild = true; g2.freeWill = true;
  let seen = 0; for (let t = 0; t < DAY * 10; t += 0.1) { update(g2, 0.1); if (t % 20 < 0.1) seen += workersAt(g2).size; }
  check('busy workshops show who is at work', seen > 0, seen);
}

// ---------------------------------------------------------------- v45: a leaner start, open rules, field chains
{
  const g = modest();
  check('the village starts with 50 wood', g.res.wood === 50, g.res.wood);
  check('a storehouse takes 10 stone', BUILD.store.cost.stone === 10 && BUILD.store.cost.wood === 60);
  check('quarries and mines from the first age', ['quarry', 'claypit', 'goldmine'].every(k => BUILD[k].age === 0) && !BUILD.quarry.nearWater && BUILD.goldmine.cost.wood === 500 && BUILD.goldmine.cost.stone === 150);
}
{
  const g = createGame({ seed: 3, sandbox: true });
  const fh = addBuilding(g, 'farmhouse', 40, 40, true), ox = 40, oy = 40;
  check('a field joins a farmhouse it touches', farmFor(g, 'farm', ox + fh.w, oy) === fh);
  check('a field apart from the farm will not go', !farmFor(g, 'farm', ox + fh.w + 3, oy));
  const f = { k: 'farm', x: ox + fh.w, y: oy, w: 2, h: 2, farmId: fh.id }; g.buildings.push(f);
  check('a field joins the chain by touching a field', farmFor(g, 'farm', ox + fh.w + 2, oy) === fh);
  check('pens still go within reach', farmFor(g, 'coop', ox + fh.w + 3, oy) === fh);
  g.buildings.splice(g.buildings.indexOf(f), 1);
}

{
  const g = createGame({ seed: 5, sandbox: false }); g.freeBuild = true; g.freeWill = true;
  for (let i = 0; i < 1e6 && g.clock < DAY * 8; i++) update(g, 0.05);
  const homes = g.buildings.filter(b => b.done && BUILD[b.k].home);
  const filled = homes.filter(b => (b.hw || 0) >= 1).length, total = homes.reduce((s, b) => s + (b.hw || 0), 0);
  check('water carriers fill household barrels', filled > 0, `${filled} of ${homes.length}`);
  check('barrels never hold more than the village has', total <= g.res.water + 0.01, `${total} > ${g.res.water}`);
  const h = homes[0]; check('a home bubble shows its water', h && /💧 \d+ \/ \d+/.test(buildingWants(g, h) || ''), h && buildingWants(g, h));
  const s = deserialize(serialize(g)); check('household water is saved', s.buildings.some(b => (b.hw || 0) >= 1));
}

{
  const g = createGame({ seed: 4, sandbox: true });
  const h = addBuilding(g, 'house', 30, 30, true); h.lvl = 2; syncLayout(h);
  check('every bed has a place in the room', h.beds.length === beds(h) && floorsOf(h) === 1, `${h.beds.length} of ${beds(h)}`);
  h.lvl = 8; syncLayout(h);
  check('a grand manor has two floors and all its beds', floorsOf(h) === 2 && h.beds.length === beds(h) && h.beds.some(x => x.floor === 1), JSON.stringify(h.beds.map(x => x.floor)));
  g.res.furniture = 5; const it = itemsOn(h, 0)[0]; moveItem(h, it, 0.3, 0.5); turnItem(it);
  const r = placePiece(g, h, 'chair', 0.5, 0.7, 1);
  const s = deserialize(serialize(g)), h2 = s.buildings.find(b => b.x === 30 && b.y === 30);
  check('a rearranged home keeps its layout', h2.beds.some(x => Math.abs(x.u - 0.3) < 1e-6 && x.flip) && h2.furn.some(f => f.id === 'chair' && f.floor === 1), r.reason);
  h.lvl = 1; syncLayout(h);
  check('a home that slips back brings everything downstairs', h.beds.every(x => !x.floor) && h.furn.every(f => !f.floor) && h.beds.length === beds(h));
}

// ---------------------------------------------------------------- v45: new buildings and grand projects
{
  const g = createGame({ seed: 6, sandbox: true });
  const o = addBuilding(g, 'orchard_apple', 44, 44, false); completeBuilding(g, o);
  const sea = Math.floor(g.clock / SEASON) % 4;
  check('an apple orchard rests until autumn', sea === 2 ? o.food > 0 : o.food === 0, `${sea} ${o.food}`);
  g.clock += SEASON * ((2 - sea + 4) % 4 || 4); orchardDawn(g);
  check('and bears in autumn', o.food === BUILD.orchard_apple.orchard.seasons[2], o.food);
  check('orchards count as food for the planner', outputPerDay('orchard_apple').food > 0);
}
{
  const g = createGame({ seed: 6, sandbox: true });
  g.age = 2; const v = g.villagers[0]; let gx = 40, gy = 40; for (let t = 0; t < 400 && !canPlace(g, 'greathall', gx, gy); t++) { gx = 10 + (t * 7) % 40; gy = 10 + Math.floor(t / 6) % 40; }
  const r = place(g, 'greathall', gx, gy, [v]);
  const b = r.b; check('a grand project starts by paying its first stage', r.ok && g.res.wood === 2000 - BUILD.greathall.stages[0].cost.wood, r.reason);
  b.prog = b.time; check('a finished stage pays for and begins the next', stageDone(g, b) === 'next' && b.stage === 1 && b.prog === 0);
  for (const k in g.res) g.res[k] = 0; b.prog = b.time;
  check('and waits when the stores fall short', stageDone(g, b) === 'wait' && b.waiting && !canWork(g, b));
  g.res.stone = 1000; g.res.gold = 1000; g.res.cloth = 100; g.res.furniture = 100;
  check('carrying on when they are filled', canWork(g, b) && beginNext(g, b) && b.stage === 2);
  takeDown(g, b); check('taking one down returns every stage paid', g.res.wood === BUILD.greathall.stages[0].cost.wood + BUILD.greathall.stages[1].cost.wood, g.res.wood);
}
{
  const g = createGame({ seed: 6, sandbox: true }), v = g.villagers[0];
  const base = g.mods.carry; v.x = 30; v.y = 30;
  addBuilding(g, 'path', 31, 30, true);
  check('no stable: the usual load', carryOf(g, v) === base);
  addBuilding(g, 'stable', 20, 20, true);
  check('a stable doubles the load near a path', carryOf(g, v) === base * 2);
  v.x = 50; v.y = 50; check('but not far from one', carryOf(g, v) === base);
}
{
  const g = createGame({ seed: 6, sandbox: true });
  const u = UPGRADES.find(x => x.cost.wood >= 30), c0 = researchCost(g, u).wood;
  addBuilding(g, 'observatory', 20, 20, true);
  check('the observatory makes research a third cheaper', researchCost(g, u).wood === Math.round(c0 * 2 / 3), `${c0} → ${researchCost(g, u).wood}`);
  check('better research tiers need tools', UPGRADES.some(x => x.cost.tools) && !UPGRADES.filter(x => x.id.endsWith('1')).some(x => x.cost.tools));
  check('timber houses and up need tools', TIERS.house.slice(3).every(t => t.cost.tools) && !TIERS.house.slice(0, 3).some(t => t.cost.tools));
}
{
  const g = createGame({ seed: 6, sandbox: true });
  const before = everyDays(g); addBuilding(g, 'waystation', 20, 20, true);
  check('a waystation brings the merchant every other day', before === 3 && everyDays(g) === 2);
  const v = g.villagers[0]; v.bathed = g.dawns; check('a soak means better rest tonight', restBoost(g, v) > 1);
  check('festivals give twice the culture with a great hall', festivalCulture(g, 30) === 30 && (addBuilding(g, 'greathall', 30, 30, true), festivalCulture(g, 30) === 60));
  check('the church raises a grand steeple, dear in stone', TIERS.church && TIERS.church[1].name === 'Grand steeple' && TIERS.church[1].bell && TIERS.church[1].cost.stone >= 400);
  for (let i = 0; i < 30; i++) addBuilding(g, 'lodge', 2 + (i % 10) * 3, 2 + Math.floor(i / 10) * 3, true);
  check('the village holds 215 villagers at most', popCap(g) === 215, popCap(g));
  check('the well\'s top level is the pump house', TIERS.well[2].name === 'Pump house' && BUILD.watertower.store.water > 0);
  check('the blacksmith makes tools from wood and stone', BUILD.blacksmith.craft.out.tools && BUILD.blacksmith.craft.in.wood && BUILD.blacksmith.craft.in.stone);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
