// Every button in the game, in one table. Menus (bubbles, sheets) only list keys from OWNS; nothing else adds buttons.
//   icon, tip [name, description], cost, on (lit), dis (greyed), ready (glows), hide (not shown here), run
// `api` is filled in by ui.js: the selection, the bubble, the sheet, and the helpers that open things.
import { BUILD, UPGRADES, AGES, FOCI, VILLAGER_COST, TRADE } from '../core/config.js';
import { have, popCap, townCenter } from '../core/state.js';
import { wantedFestival, affordableFestival, festivalCost } from '../core/festival.js';
import { computeBeauty } from '../core/beauty.js';
import * as cmd from '../core/commands.js';
import { hasInside } from './interior.js';
import { CRITTERS, LANTERN_UNLOCK } from '../core/critters.js';
import { buildingTitle } from './panels.js';

// Who shows what. The first few become the bubble's buttons; the rest go under ••• More.
export const OWNS = {
  game: ['free', 'speed', 'pause', 'sound', 'hints', 'overlay', 'album', 'save', 'sandbox', 'newgame'],
  villager: ['build', 'unload', 'work', 'plant', 'add', 'rename', 'clearjob', 'remove'],
  villagers: ['build', 'work', 'unload', 'plant', 'add'],
  tc: ['train', 'age', 'festival', 'upgrades', 'rally', 'all', 'idle', 'focus', 'move', 'inside'],
  campfire: ['train', 'festival', 'upgrades', 'improve', 'rally', 'all', 'idle', 'focus'],   // until the town center is built
  campfireLater: ['improve'],                                                               // after: just a gathering place
  market: ['trade', 'improve', 'move', 'inside', 'remove'],
  shop: ['improve', 'move', 'inside', 'remove'],
  grange: ['improve', 'upgrades', 'move', 'inside', 'remove'],
  house: ['improve', 'rotate', 'inside', 'move', 'remove'],
  well: ['improve', 'move', 'remove'],
  store: ['improve', 'upgrades', 'inside', 'move', 'rotate', 'remove'],
  building: ['improve', 'upgrades', 'inside', 'move', 'rotate', 'remove'],
  site: ['move', 'remove'],    // still being built
  node: ['remove'],
};
export const PRIMARY = 4;   // buttons shown in a bubble before ••• More

export function createActions(api) {
  const { ui, g, settings, audio, toast } = api;
  const selB = () => ui.selB, one = () => ui.sel.size === 1 ? [...ui.sel][0] : null, vs = () => [...ui.sel];
  const turnable = () => { const k = ui.moving ? ui.moving.k : ui.place || (ui.selB && ui.selB.k); return !!(k && (BUILD[k].turns || BUILD[k].faces)); };
  const upAt = () => ui.selB && (ui.selB.k === 'campfire' ? 'tc' : ui.selB.k);
  const ACT = {
    // ---- game menu
    sound:   { icon: () => settings.sound ? '🔊' : '🔇', tip: ['Sound', 'Turn the sound on or off.'], run: () => { settings.sound = !settings.sound; audio.setOn(settings.sound); settings.persist(); api.refreshGame(); } },
    save:    { icon: '💾', tip: ['Save', 'Save your village now. It also saves on its own.'], run: () => { api.save(); toast('Village saved.'); } },
    sandbox: { icon: '🧪', tip: ['Sandbox', 'New games start with plenty of resources. Turn off for a modest start.'], on: () => settings.sandbox, run: () => { settings.sandbox = !settings.sandbox; settings.persist(); toast(settings.sandbox ? 'Sandbox on for the next new game.' : 'Sandbox off. The next new game starts modestly.'); } },
    newgame: { icon: '🌄', tip: ['New game', 'Start a new village on a fresh map.'], danger: true,
               run: () => api.pop.confirm({ text: 'Start a new village?', sub: 'This village is replaced by a fresh map.', ok: 'New game', onOk: () => { api.pop.close(); api.newGame(); } }) },
    free:    { icon: () => ['🧍', '🕊️', '🏗️'][cmd.willLevel(g())], on: () => cmd.willLevel(g()) > 0,
               tip: () => [['No free will', 'Villagers do what you ask and keep at the jobs you give them, day after day. Tap for Free will.'], ['Free will', 'Villagers choose their own work, improve their homes and join festivals. They don\'t build new things. Tap for Free build.'], ['Free build', 'Villagers do everything: choose work, plan and place buildings, take up upgrades, advance the age and hold festivals. Tap for No free will.']][cmd.willLevel(g())],
               run: () => { const n = (cmd.willLevel(g()) + 1) % 3; cmd.setWill(g(), n); toast(['No free will: villagers keep to the jobs you give them.', 'Free will: villagers choose their own work, but leave the building to you.', 'Free build: the village plans and builds on its own too.'][n]); } },
    pause:   { icon: () => ui.paused ? '▶️' : '⏸️', tip: () => ui.paused ? ['Resume', 'Carry on (Space).'] : ['Pause', 'Stop time; you can still look around, look inside and plan (Space).'], on: () => ui.paused, run: () => { ui.paused = !ui.paused; toast(ui.paused ? 'Paused.' : 'Carrying on.'); } },
    speed:   { icon: () => settings.speed + '×', tip: ['Game speed', 'Tap to switch between 1×, 2× and 4× speed.'], run: () => { settings.speed = settings.speed === 1 ? 2 : settings.speed === 2 ? 4 : 1; settings.persist(); } },
    overlay: { icon: () => ({ off: '🗺️', beauty: '🌸', directors: '🧭' })[ui.overlay], tip: ['Overlays', 'Tap to cycle: beauty map (rose is lovely, blue unsightly), what each Director wants, then off.'], on: () => ui.overlay !== 'off', run: () => { ui.overlay = ui.overlay === 'off' ? 'beauty' : ui.overlay === 'beauty' ? 'directors' : 'off'; if (ui.overlay === 'beauty') computeBeauty(g()); toast({ beauty: 'Beauty map: rose is lovely, blue is unsightly, no tint is neutral.', directors: 'Showing what each Director wants right now.', off: 'Overlays off.' }[ui.overlay]); } },
    album:   { icon: '🦋', tip: ['Night critters', 'Your collection. At night, tap fireflies, moths, frogs and owls to catch them. They become treasures for homes.'],
               run: () => { const G = g(), c = G.caught || {}, sp = G.spent || {}, lines = Object.entries(CRITTERS).map(([k, C]) => `${C.icon} ${(c[k] || 0) - (sp[k] || 0)}`); toast('To spend: ' + lines.join('  ·  ') + ((c.firefly || 0) < LANTERN_UNLOCK ? `  ·  ${LANTERN_UNLOCK - (c.firefly || 0)} more fireflies for a firefly lantern` : '')); } },
    // ---- villagers
    build:   { icon: '🔨', tip: ['Build', 'Choose a building, then tap the ground to see it there. Tap ✓ to place it. These villagers will build it.'], run: () => api.openBuild() },
    unload:  { icon: '📦', tip: ['Unload', 'Take what they carry to the stores.'], dis: () => !vs().some(v => v.carry > 0),
               run: () => { const n = cmd.orderUnload(g(), vs()); api.say(n ? (n > 1 ? 'Taking it all to the stores.' : `${one() ? one().name + ' is t' : 'T'}aking it to the stores.`) : 'The stores are full of that for now: a storehouse would make room.'); } },
    work:    { icon: '🧺', tip: () => ['Back to work', one() && one().duty ? 'Back to their job.' : 'Pick up the most useful work there is.'],
               run: () => { const list = vs(), n = cmd.backToWork(g(), list); if (n) { api.say(list.length === 1 ? `${list[0].name} is back to work.` : 'Back to work.'); api.clearSel(); } else api.say('Nothing needs doing just now.'); } },
    plant:   { icon: '🌱', tip: ['Plant trees', 'Tap open grass and a sapling is planted there.'], on: () => ui.mode === 'plant', run: () => { ui.mode = ui.mode === 'plant' ? null : 'plant'; api.pop.close(); toast(ui.mode ? 'Tap open grass to plant. Tap the villager again when done.' : 'Finished planting.'); } },
    add:     { icon: '➕', tip: ['Add villagers', 'Tap more villagers to add them to, or take them out of, the group.'], on: () => ui.mode === 'add', run: () => { ui.mode = ui.mode === 'add' ? null : 'add'; if (ui.mode) toast('Tap more villagers to add them.'); } },
    rename:  { icon: '✏️', tip: ['Rename', 'Give this villager a name.'], dis: () => !one(), run: () => api.openRename(one()) },
    clearjob:{ icon: '🧹', tip: ['Clear job', 'Let go of the job they were given.'], hide: () => !(one() && one().duty),
               run: () => { const v = one(); cmd.clearDuty(g(), [v]); api.say(`${v.name} is free of their job.`); } },
    // ---- buildings
    train:   { icon: '🧑‍🌾', tip: ['Villager', 'Welcome a new villager.'], cost: () => VILLAGER_COST, dis: () => !have(g(), VILLAGER_COST) || g().villagers.length >= popCap(g()), run: () => { const r = cmd.train(g()); if (!r.ok) api.say(r.reason); } },
    age:     { icon: () => g().adv > 0 ? Math.ceil(g().adv) + 's' : '⭐', tip: () => g().age >= 3 ? ['Final age', 'Your village has reached its final age.'] : ['Advance age', `Grow into the ${AGES[g().age + 1].name} Age. Unlocks new buildings and upgrades. Needs ${AGES[g().age + 1].culture} culture (the village has ${Math.floor(g().culture || 0)}).`], cost: () => AGES[g().age + 1] && AGES[g().age + 1].cost, ready: () => g().ready && g().adv === 0, dis: () => g().age >= 3 || g().adv > 0 || !townCenter(g()) || !have(g(), AGES[g().age + 1].cost) || (g().culture || 0) < AGES[g().age + 1].culture, run: () => { const r = cmd.advance(g()); if (!r.ok && r.reason) api.say(r.reason); } },
    upgrades:{ icon: '✨', tip: ['Upgrades', 'Small improvements for this building and the villagers who use it, in tiers.'], hide: () => !UPGRADES.some(u => u.at === upAt()), run: () => api.openUpgrades() },
    rally:   { icon: '🚩', tip: ['Rally point', 'Tap a tree, field or spot. New villagers head there first.'], on: () => ui.mode === 'rally', run: () => { ui.mode = ui.mode === 'rally' ? null : 'rally'; if (ui.mode) { api.pop.close(); toast('Tap a tree, field or spot for the rally point.'); } } },
    all:     { icon: '👥', tip: ['Select all', 'Select every villager who is awake.'], run: () => { api.clearSel(); ui.sel = new Set(g().villagers.filter(v => !v.inside && !(v.act && v.act.type === 'sleep'))); api.syncHeld(); } },
    idle:    { icon: '💤', tip: ['Find idle', 'Jump to a villager with nothing to do.'], dis: () => !api.idleList().length, run: () => api.nextIdle() },
    festival:{ icon: '🎉', tip: () => { const G = g(), f = G.festival ? null : wantedFestival(G); return G.festival ? ['Festival planned', `A ${G.festival.name.toLowerCase()} is coming. Everyone gathers at 5 PM.`] : ['Hold a festival', `A ${f.name.toLowerCase()}: a parade around the village and the campfire, then a feast. Spirits stay high for days.`]; },
               cost: () => { const G = g(), f = !G.festival && (affordableFestival(G) || wantedFestival(G)); return f ? festivalCost(G, f) : null; },
               ready: () => !g().festival && !!affordableFestival(g()), dis: () => !!g().festival || !affordableFestival(g()),
               run: () => { const r = cmd.holdFestival(g()); if (!r.ok && r.reason) api.say(r.reason); else api.say('A festival is planned for 5 PM. 🎉'); } },
    focus:   { icon: () => FOCI[g().focus].icon, tip: () => ['Village focus: ' + FOCI[g().focus].name, 'Tap to change what the village leans toward: balanced, food, wood, building or relaxed.'], run: () => { cmd.cycleFocus(g()); api.say('Village focus: ' + FOCI[g().focus].name + '.'); } },
    improve: { icon: '⬆️', tip: () => { const i = selB() && cmd.improveInfo(g(), selB()); return !i ? ['Improve', ''] : i.reason ? ['Improve', i.reason] : ['Improve', `Becomes a ${i.next.name.toLowerCase()}. A villager will do the work.`]; },
               hide: () => { const i = selB() && cmd.improveInfo(g(), selB()); return !i || (!i.next && !i.reason); },
               cost: () => { const i = selB() && cmd.improveInfo(g(), selB()); return i && i.cost; },
               ready: () => selB() && selB().pending > selB().lvl, dis: () => { const i = selB() && cmd.improveInfo(g(), selB()); return !i || !i.next || !!i.reason; },
               run: () => { const r = cmd.improve(g(), selB()); api.say(r.ok ? `${r.v.name} is on the way to improve it.` : r.reason); } },
    inside:  { icon: '🚪', tip: ['Look inside', 'Open the door and peek in.'], hide: () => !hasInside(selB()), run: () => api.openInside(selB()) },
    move:    { icon: '✋', tip: ['Move', 'Pick it up and tap where it should go. It keeps its level, its stores and its progress.'], hide: () => !selB() || BUILD[selB().k].fixed, run: () => api.startMove(selB()) },
    rotate:  { icon: '🔄', tip: () => { const k = ui.place || (selB() && selB().k); return k && BUILD[k].faces ? ['Turn', 'Turn the house so its front faces the other way (R).'] : ['Turn', 'Turn it a quarter turn (R).']; }, hide: () => !turnable(),
               run: () => { if (ui.place || ui.moving) { ui.rot = ui.rot ? 0 : 1; return; } const b = selB(); if (b) { const r = cmd.moveBuilding(g(), b, b.x, b.y, b.rot ? 0 : 1); if (!r.ok) api.say('There is no room to turn it here.'); } } },
    trade:   { icon: '⚖️', tip: ['Trade', `Swap ${TRADE.give} of one resource for ${TRADE.get} of another, and buy from the merchant.`], run: () => api.openMarket() },
    info:    { icon: 'ⓘ', tip: ['Details', 'Everything about it.'], run: () => api.openDetails() },
    remove:  { icon: '🗑️', danger: true,
               tip: () => selB() ? ['Take down', 'The nearest villager takes it down. Everything it cost goes back to the stores.'] : ui.selN ? ['Clear', 'Remove it. You get nothing from it.'] : ['Say goodbye', 'This villager leaves the village.'],
               hide: () => (selB() && (selB().k === 'campfire' || (selB().k === 'tc' && selB().done))) || (!selB() && !ui.selN && ui.sel.size !== 1),
               run: () => {
                 const b = selB(), n = ui.selN, v = one();
                 const t = b ? { type: 'building', b } : n ? n : { type: 'villager', v };
                 const q = b ? { text: `Take down the ${buildingTitle(b).toLowerCase()}?`, sub: b.done ? 'Everything it cost comes back to the stores.' : 'What was spent on it comes back.', ok: 'Take down' }
                   : n ? { text: n.type === 'sapling' ? 'Pull up this sapling?' : 'Clear this away?', sub: 'You get nothing from it.', ok: 'Clear' }
                   : { text: `Say goodbye to ${v.name}?`, sub: 'They walk off down the road and leave the village.', ok: 'Say goodbye' };
                 api.pop.confirm({ ...q, onOk: () => { const r = cmd.removeThing(g(), t); if (!r.ok && r.reason) api.say(r.reason); else if (b) api.say(`A villager is on the way to take down the ${buildingTitle(b).toLowerCase()}.`); api.clearSel(); } });
               } },
    hints:   { icon: '💡', tip: () => settings.hints ? ['Hints are on', 'Short tips that show how to play. Tap to turn them off.'] : ['Hints are off', 'Tap to turn the first-steps hints back on (they start again from the beginning).'], on: () => !!settings.hints,
               run: () => { if (settings.hints) { settings.hints = false; settings.persist(); toast('Hints off. Turn them back on here any time.'); } else { api.coach.restart(); toast('Hints on.'); } } },
    more:    { icon: '•••', tip: ['More', 'More things to do.'], run: () => api.toggleMore() },
  };
  return ACT;
}
