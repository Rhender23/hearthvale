// Menus, panels and tap handling.
// MENU RULES (owner -> options). Every panel is drawn from OWNS; nothing else adds buttons.
//   game menu  -> game settings and conditions
//   villager   -> build, add to selection, plant, rename
//   town center-> train, age, upgrades, rally, select all, select idle, focus, free will
//   market     -> trade; homes and farms show their own information
import { BUILD_GROUPS, RES_DESC, PANTRY, PANTRY_ICON, FARM, BUILD, TIERS, BUILD_ORDER, ICON, RES, RES_NAME, BASICS, GOODS, ROLE_NAME, MERCHANT, AGES, UPGRADES, FOCI, SEASONS, VILLAGER_COST, TRADE, N, NODE_INFO } from '../core/config.js';
import { idx, inMap, nodeKind, WATER, walkable } from '../core/world.js';
import { have, popCap, hour, dayNumber, seasonIndex, darkness, beds, isNight, cap, storeOf, levelName, tierOf, hub, townCenter, hasMarket, beautyOf, clock12 } from '../core/state.js';
import { daysToMerchant, priceOf, waresFor, warePrice } from '../core/merchant.js';
import { daysToGoods, shopNear } from '../core/directors.js';
import { wantedFestival, affordableFestival, festivalCost } from '../core/festival.js';
import { homeScore, beautyLabel, villageBeauty, computeBeauty } from '../core/beauty.js';
import * as cmd from '../core/commands.js';
import { openInterior, hasInside } from './interior.js';
import { CRITTERS, LANTERN_UNLOCK } from '../core/critters.js';

const $ = id => document.getElementById(id);
const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) e.append(k); return e; };
const fmt = c => Object.entries(c).filter(([, v]) => v).map(([k, v]) => v + ICON[k]).join(' ');
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

export const OWNS = {
  game: ['pause', 'free', 'sound', 'save', 'speed', 'overlay', 'album', 'sandbox', 'newgame'],
  villager: ['build', 'rotate', 'add', 'plant', 'demolish', 'rename', 'remove'],
  tc: ['train', 'age', 'festival', 'upgrades', 'rally', 'all', 'idle', 'focus', 'free', 'move', 'inside'],
  campfire: ['train', 'festival', 'upgrades', 'rally', 'all', 'idle', 'focus', 'free', 'improve'], // until the town center is built
  campfireLater: ['improve'],                                                          // after: just a gathering place
  market: ['trade', 'improve', 'move', 'remove', 'inside'],
  shop: ['improve', 'move', 'remove', 'inside'],
  grange: ['improve', 'upgrades', 'move', 'remove', 'inside'],
  house: ['improve', 'move', 'remove', 'inside'],
  well: ['improve', 'move', 'remove'],
  store: ['improve', 'upgrades', 'move', 'rotate', 'remove', 'inside'],
  building: ['upgrades', 'move', 'rotate', 'remove', 'inside'],   // every other building; 'look inside' always last
  node: ['remove'],       // trees, rocks, bushes, fish, saplings
};
const NODE_NAME = { 1: 'Tree', 2: 'Stone', 3: 'Gold', 4: 'Berry bush', 5: 'Fish', 6: 'Clay pit' };

export function createUI(ctx) {
  const { getGame, view, settings, save, newGame, audio } = ctx;
  const ui = { sel: new Set(), selB: null, selN: null, overlay: 'off', confirmAt: 0, place: null, mode: null, buildOpen: false, menuOpen: false, hudOpen: false, modal: false, hover: [-9, -9], hoverCells: null, ping: null, panelKey: '', plantI: 0, idleI: 0, upOpen: false, mkOpen: false, give: 'wood', get: 'food' };
  const g = () => getGame();
  ui.rot = 0;
  // While moving a building its own tiles count as free.
  ui.canPlace = (x, y) => {
    const G = g();
    if (!ui.moving) return cmd.canPlace(G, ui.place, x, y, ui.rot);
    const b = ui.moving, saved = [];
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) { const t = idx(b.x + i, b.y + j); saved.push([t, G.w.occ[t]]); G.w.occ[t] = 0; }
    const ok = cmd.canPlace(G, b.k, x, y, ui.rot);
    for (const [t, o] of saved) G.w.occ[t] = o;
    return ok;
  };
  const turnable = () => { const k = ui.moving ? ui.moving.k : ui.place || (ui.selB && ui.selB.k); return !!(k && BUILD[k].turns); };
  const fineMouse = () => { try { return matchMedia('(pointer: fine)').matches; } catch (e) { return false; } };

  // ---------- actions available to buttons ----------
  const ACT = {
    sound:   { icon: () => settings.sound ? '🔊' : '🔇', tip: ['Sound', 'Turn the sound on or off.'], run: () => { settings.sound = !settings.sound; audio.setOn(settings.sound); settings.persist(); } },
    save:    { icon: '💾', tip: ['Save', 'Save your village now. It also saves on its own.'], run: () => { save(); toast('Village saved.'); } },
    sandbox: { icon: '🧪', tip: ['Sandbox', 'New games start with plenty of resources. Turn off for a modest start.'], on: () => settings.sandbox, run: () => { settings.sandbox = !settings.sandbox; settings.persist(); toast(settings.sandbox ? 'Sandbox on for the next new game.' : 'Sandbox off. The next new game starts modestly.'); } },
    newgame: { icon: '🔄', tip: ['New game', 'Start a new village on a fresh map. Tap twice to confirm.'], run: () => { if (Date.now() - (ui.newAt || 0) < 3000) newGame(); else { ui.newAt = Date.now(); toast('Tap New game again to start over on a fresh map.'); } } },
    build:   { icon: '🔨', tip: ['Build', 'Choose a building, then tap the ground. Tap again or press Escape when done.'], on: () => ui.buildOpen || !!ui.place, run: () => { if (ui.place || ui.buildOpen) { ui.place = null; ui.buildOpen = false; } else { ui.buildOpen = true; ui.mode = null; } } },
    add:     { icon: '➕', tip: ['Add villagers', 'Tap more villagers to add them to, or remove them from, the selection.'], on: () => ui.mode === 'add', run: () => { ui.mode = ui.mode === 'add' ? null : 'add'; } },
    demolish: { icon: '⛏️', tip: ['Take down', 'Tap a building and the selected villagers take it down. Everything it cost goes back to the stores.'], on: () => ui.mode === 'demolish', run: () => { ui.mode = ui.mode === 'demolish' ? null : 'demolish'; if (ui.mode) toast('Tap the building to take down.'); } },
    inside:  { icon: '🚪', tip: ['Look inside', 'Open the door and peek in. What you see grows with the building and what the village has in store.'], dis: () => !hasInside(ui.selB),
               run: () => { if (ui.modal || !hasInside(ui.selB)) return; ui.modal = true; openInterior(g(), ui.selB, () => { ui.modal = false; }); } },
    move:    { icon: '✋', tip: ['Move', 'Pick this up and tap where it should go. It keeps everything: its level, its stores, its progress.'], on: () => !!ui.moving,
               dis: () => !ui.selB || BUILD[ui.selB.k].fixed,
               run: () => { if (ui.moving) { ui.moving = null; ui.place = null; return; } ui.moving = ui.selB; ui.place = ui.selB.k; ui.rot = ui.selB.rot || 0; toast('Tap where it should go.'); } },
    rotate:  { icon: '🔄', tip: ['Turn', 'Turn it a quarter turn (press R on a keyboard).'], dis: () => !turnable(),
               run: () => { if (ui.place || ui.moving) { ui.rot = ui.rot ? 0 : 1; return; } const b = ui.selB; if (b) { const r = cmd.moveBuilding(g(), b, b.x, b.y, b.rot ? 0 : 1); if (!r.ok) toast('There is no room to turn it here.'); } } },
    album:   { icon: '🦋', tip: ['Night critters', 'Your collection. At night, tap fireflies, moths, frogs and owls to catch them.'],
               run: () => { const c = g().caught || {}, lines = Object.entries(CRITTERS).map(([k, C]) => `${C.icon} ${c[k] || 0}`); toast('Collection: ' + lines.join('  ·  ') + ((c.firefly || 0) < LANTERN_UNLOCK ? `  ·  ${LANTERN_UNLOCK - (c.firefly || 0)} more fireflies for a firefly lantern` : '')); } },
    plant:   { icon: '🌱', tip: ['Plant trees', 'Tap open grass and a sapling is planted there.'], on: () => ui.mode === 'plant', run: () => { ui.mode = ui.mode === 'plant' ? null : 'plant'; toast(ui.mode ? 'Tap open grass to plant. Tap the sapling button again when done.' : 'Finished planting.'); } },
    rename:  { icon: '✏️', tip: ['Rename', 'Give this villager a name.'], dis: () => ui.sel.size !== 1, run: () => openRename([...ui.sel][0]) },
    train:   { icon: '🧑‍🌾', tip: ['Villager', 'Train a new villager.'], cost: () => VILLAGER_COST, dis: () => !have(g(), VILLAGER_COST) || g().villagers.length >= popCap(g()), run: () => { const r = cmd.train(g()); if (!r.ok) toast(r.reason); } },
    age:     { icon: () => g().adv > 0 ? Math.ceil(g().adv) + 's' : '⭐', tip: () => g().age >= 3 ? ['Final age', 'Your village has reached its final age.'] : ['Advance age', `Grow into the ${AGES[g().age + 1].name} Age. Unlocks new buildings and upgrades. Needs ${AGES[g().age + 1].culture} culture (the village has ${Math.floor(g().culture || 0)}).`], cost: () => AGES[g().age + 1] && AGES[g().age + 1].cost, ready: () => g().ready && g().adv === 0, dis: () => g().age >= 3 || g().adv > 0 || !townCenter(g()) || !have(g(), AGES[g().age + 1].cost) || (g().culture || 0) < AGES[g().age + 1].culture, run: () => { const r = cmd.advance(g()); if (!r.ok && r.reason) toast(r.reason); } },
    upgrades:{ icon: '✨', tip: ['Upgrades', 'Small improvements for this building and the villagers who use it, in tiers.'], dis: () => { const at = ui.selB && (ui.selB.k === 'campfire' ? 'tc' : ui.selB.k); return !UPGRADES.some(u => u.at === at); }, on: () => ui.upOpen, run: () => { ui.upOpen = !ui.upOpen; ui.mkOpen = false; drawUpgrades(); } },
    rally:   { icon: '🚩', tip: ['Rally point', 'Tap a tree, field or spot. New villagers head there first.'], on: () => ui.mode === 'rally', run: () => { ui.mode = ui.mode === 'rally' ? null : 'rally'; if (ui.mode) toast('Tap a tree, field or spot for the rally point.'); } },
    all:     { icon: '👥', tip: ['Select all', 'Select every villager who is awake.'], run: () => { ui.sel = new Set(g().villagers.filter(v => !v.inside && !(v.act && v.act.type === 'sleep'))); ui.selB = null; syncHeld(); } },
    idle:    { icon: '💤', tip: ['Find idle', 'Jump to a villager with nothing to do.'], dis: () => !idleList().length, run: () => nextIdle() },
    festival: { icon: '🎉', tip: () => { const G = g(), f = G.festival ? null : wantedFestival(G); return G.festival ? ['Festival planned', `A ${G.festival.name.toLowerCase()} is coming. Everyone gathers at 5 PM.`] : ['Hold a festival', `A ${f.name.toLowerCase()}: a parade from the town center to the marketplace and the campfire, then a feast. Everyone's spirits stay high for days.`]; },
               cost: () => { const G = g(), f = !G.festival && (affordableFestival(G) || wantedFestival(G)); return f ? festivalCost(G, f) : null; },
               ready: () => !g().festival && !!affordableFestival(g()), dis: () => !!g().festival || !affordableFestival(g()),
               run: () => { const r = cmd.holdFestival(g()); if (!r.ok && r.reason) toast(r.reason); } },
    focus:   { icon: () => FOCI[g().focus].icon, tip: () => ['Village focus: ' + FOCI[g().focus].name, 'Tap to change what the village leans toward: balanced, food, wood, building or relaxed.'], run: () => { cmd.cycleFocus(g()); toast('Village focus: ' + FOCI[g().focus].name + '.'); } },
    free:    { icon: '🕊️', tip: ['Free will', 'When on, villagers choose useful work on their own. Turn off to run things yourself.'], on: () => g().freeWill, run: () => { cmd.setFreeWill(g(), !g().freeWill); toast(g().freeWill ? 'Villagers are choosing their own work again.' : 'Free will is off. Villagers only do what you ask.'); } },
    pause:   { icon: () => ui.paused ? '▶️' : '⏸️', tip: () => ui.paused ? ['Resume', 'Carry on (Space).'] : ['Pause', 'Stop time; you can still look around, look inside and plan (Space).'], on: () => ui.paused, run: () => { ui.paused = !ui.paused; toast(ui.paused ? 'Paused.' : 'Carrying on.'); } },
    speed:   { icon: () => settings.speed + '×', tip: ['Game speed', 'Tap to switch between 1×, 2× and 4× speed.'], run: () => { settings.speed = settings.speed === 1 ? 2 : settings.speed === 2 ? 4 : 1; settings.persist(); } },
    overlay: { icon: () => ({ off: '🗺️', beauty: '🌸', directors: '🧭' })[ui.overlay], tip: ['Overlays', 'Tap to cycle: beauty map (rose is lovely, blue unsightly, no tint neutral), what each Director wants, then off.'], on: () => ui.overlay !== 'off', run: () => { ui.overlay = ui.overlay === 'off' ? 'beauty' : ui.overlay === 'beauty' ? 'directors' : 'off'; if (ui.overlay === 'beauty') computeBeauty(g()); toast({ beauty: 'Beauty map: rose is lovely, blue is unsightly, no tint is neutral.', directors: 'Showing what each Director wants right now.', off: 'Overlays off.' }[ui.overlay]); } },
    improve: { icon: '⬆️', tip: () => { const i = ui.selB && cmd.improveInfo(g(), ui.selB); return !i ? ['Improve', ''] : i.reason ? ['Improve', i.reason] : ['Improve', `Becomes a ${i.next.name.toLowerCase()}. A villager will do the work.`]; },
               cost: () => { const i = ui.selB && cmd.improveInfo(g(), ui.selB); return i && i.cost; },
               ready: () => ui.selB && ui.selB.pending > ui.selB.lvl,
               run: () => { const r = cmd.improve(g(), ui.selB); toast(r.ok ? `${r.v.name} is on the way to improve it.` : r.reason); } },
    remove:  { icon: () => Date.now() - ui.confirmAt < 3000 ? '❓' : '🗑️', tip: () => ui.selB ? ['Take down', 'The nearest villager takes this down. Everything it cost goes back to the stores.'] : ui.selN ? ['Clear', 'Remove it. You get nothing from it.'] : ['Say goodbye', 'This villager leaves the village.'],
               dis: () => (ui.selB && (ui.selB.k === 'campfire' || (ui.selB.k === 'tc' && ui.selB.done))) || (!ui.selB && !ui.selN && ui.sel.size !== 1),
               run: () => {
                 if (Date.now() - ui.confirmAt >= 3000) { ui.confirmAt = Date.now(); toast('Tap 🗑️ again to confirm.'); return; }
                 ui.confirmAt = 0;
                 const t = ui.selB ? { type: 'building', b: ui.selB } : ui.selN ? ui.selN : { type: 'villager', v: [...ui.sel][0] };
                 const r = cmd.removeThing(g(), t); if (!r.ok && r.reason) toast(r.reason);
                 clearSel();
               } },
    trade:   { icon: '⚖️', tip: ['Trade', `Swap ${TRADE.give} of one resource for ${TRADE.get} of another.`], on: () => ui.mkOpen, run: () => { ui.mkOpen = !ui.mkOpen; ui.upOpen = false; drawMarket(); } },
  };
  const val = (f) => typeof f === 'function' ? f() : f;
  const rows = [];
  function actRow(keys) {
    const row = el('div', { className: 'row' });
    for (const k of keys) { const a = ACT[k], b = el('button', { className: 'ic' }); b.dataset.tip = k; b.onclick = () => { a.run(); syncButtons(); }; row.append(b); rows.push([b, k]); }
    return row;
  }
  function syncButtons() {
    for (const [b, k] of rows) {
      if (!b.isConnected) continue;
      const a = ACT[k]; b.textContent = val(a.icon); b.disabled = a.dis ? !!a.dis() : false;
      if (k === 'upgrades' || k === 'rotate' || k === 'inside') b.hidden = b.disabled;   // only shown where they apply
      b.classList.toggle('on', a.on ? !!a.on() : false); b.classList.toggle('ready', a.ready ? !!a.ready() : false);
    }
  }

  // ---------- Director overlay: what each Director wants right now ----------
  function drawDirectors() {
    const m = g().manager, d = $('dir'); d.replaceChildren(el('b', { textContent: 'Directors' }));
    for (const dir of m.directors) {
      const wishes = m.wishes.filter(w => w.dir === dir.name).sort((a, b) => b.w - a.w), dem = (m.demands || []).filter(x => x.from === dir.name);
      const box2 = el('div', { className: 'dirbox' }, [el('div', { className: 'dn', textContent: dir.name }), el('small', { textContent: dir.seeks || '' })]);
      for (const w of wishes) box2.append(el('div', { className: 'wl', textContent: `${w.key} ${w.w.toFixed(2)} · ${w.why}` }));
      for (const x of dem) box2.append(el('div', { className: 'wl dem', textContent: `asks ${x.to} for ${x.what}${x.why ? ' (' + x.why + ')' : ''}` }));
      if (dir.last) box2.append(el('div', { className: 'wl dem', textContent: 'last placed: ' + dir.last }));
      if (!wishes.length && !dem.length && !dir.last) box2.append(el('div', { className: 'wl', textContent: 'content for now' }));
      d.append(box2);
    }
  }
  // Resources in groups: basics, the pantry (what the food is made of), farm goods, workshop goods. Empty groups stay hidden.
  { const h = $('hud'), item = r => { const e = el('span', { id: 's-' + r }, [ICON[r] + ' ', el('b', { id: 'r-' + r })]); e.dataset.tip = 'res-' + r; return e; }, grp = (id, label) => el('span', { id: 'g-' + id, className: 'grp' }, [label]);
    h.replaceChildren(...BASICS.map(item), el('span', { id: 'pantry', className: 'grp sub' }), grp('farm', 'Farm'), ...FARM.map(item), grp('goods', 'Goods'), ...GOODS.map(item), el('span', { className: 'grp' }, ['']), (() => { const e = el('span', {}, ['🏠 ', el('b', { id: 'r-pop' })]); e.dataset.tip = 'res-pop'; return e; })(), (() => { const e = el('span', { id: 'r-age' }); e.dataset.tip = 'res-age'; return e; })());
    h.addEventListener('click', e => { const t = e.target.closest('[data-tip]'); if (t) showTip(t); }); }

  // ---------- static chrome ----------
  const gm = $('gm'); gm.append(actRow(OWNS.game), el('div', { id: 'gmc' }));
  { // Volume
    const vol = el('input', { type: 'range', id: 'vol', min: '0', max: '100', step: '1', value: String(Math.round((settings.volume ?? 0.7) * 100)) });
    vol.setAttribute('aria-label', 'Volume');
    vol.oninput = () => { settings.volume = vol.value / 100; audio.setVolume(settings.volume); settings.persist(); };
    gm.append(el('label', { className: 'volrow', htmlFor: 'vol' }, [el('span', { textContent: '🔉 Volume' }), vol]));
  }
  $('fab').onclick = () => { ui.menuOpen = !ui.menuOpen; };
  $('hudbtn').onclick = () => { ui.hudOpen = !ui.hudOpen; };
  $('pausebtn').onclick = () => ACT.pause.run();

  // ---------- first-run hint: gone after the first touch anywhere, or after 15 seconds ----------
  const hideHint = () => $('hint').classList.add('gone');
  document.addEventListener('pointerdown', hideHint, { once: true }); setTimeout(hideHint, 15000);

  // ---------- toast ----------
  let toastT = 0;
  function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 4200); }

  // ---------- tooltips (hover on desktop, long-press on touch) ----------
  const tipEl = $('tip'); let tipT = 0, lpT = 0, lpFired = false;
  function showTip(b) {
    const k = b.dataset.tip, a = ACT[k] || CARD_TIPS[k]; if (!a || !a.tip) return;
    const [name, desc] = val(a.tip); const c = a.cost ? val(a.cost) : null;
    tipEl.replaceChildren(el('b', { textContent: name }), el('div', { textContent: desc }), ...(c ? [el('small', { textContent: fmt(c) })] : []));
    tipEl.hidden = false;
    const r = b.getBoundingClientRect();
    tipEl.style.left = Math.max(8, Math.min(innerWidth - 248, r.left)) + 'px';
    tipEl.style.top = Math.max(8, r.top - tipEl.offsetHeight - 8) + 'px';
    clearTimeout(tipT); tipT = setTimeout(() => { tipEl.hidden = true; }, 4000);
  }
  const tipTarget = e => e.target.closest && e.target.closest('[data-tip]');
  document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') { const b = tipTarget(e); if (b) showTip(b); } });
  document.addEventListener('pointerout', e => { if (e.pointerType === 'mouse' && tipTarget(e)) tipEl.hidden = true; });
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; const b = tipTarget(e); clearTimeout(lpT); lpFired = false; if (b) lpT = setTimeout(() => { lpFired = true; showTip(b); }, 450); });
  document.addEventListener('pointerup', () => clearTimeout(lpT));
  document.addEventListener('click', e => { if (lpFired && tipTarget(e)) { lpFired = false; e.stopPropagation(); e.preventDefault(); } }, true);

  // ---------- build cards ----------
  const CARD_TIPS = {};
  for (const k of BUILD_ORDER) CARD_TIPS['card-' + k] = { tip: [BUILD[k].name, BUILD[k].desc], cost: BUILD[k].cost };
  // Resource panel: every icon says what it is (hover, long-press, or tap).
  for (const r of RES) CARD_TIPS['res-' + r] = { tip: [`${ICON[r]} ${RES_NAME[r]}`, RES_DESC[r] || ''] };
  const PANTRY_NAME = { provisions: 'Provisions (mixed stores)', berries: 'Berries', fish: 'Fish', vegetables: 'Vegetables', bread: 'Bread' };
  for (const k of PANTRY) CARD_TIPS['pan-' + k] = { tip: [`${PANTRY_ICON[k]} ${PANTRY_NAME[k]}`, 'Part of the food in the pantry.'] };
  CARD_TIPS['res-pop'] = { tip: ['🏠 Villagers', 'How many live here, and how many the village has room for.'] };
  CARD_TIPS['res-age'] = { tip: ['Age, culture and season', 'The village age; 🎭 culture now and needed for the next age; the season.'] };
  let cardsKey = '';
  // The build menu: a row of category icons; tapping one drops down that category's buildings.
  function syncCards() {
    const c = $('bc'), show = ui.buildOpen && ui.sel.size && !ui.selB && !ui.place;
    c.hidden = !show; if (!show) { cardsKey = ''; return; }
    const ks = BUILD_ORDER.filter(k => BUILD[k].age <= g().age && !(BUILD[k].unlock && !g().unlocked[k]) && !(k === 'tc' && g().buildings.some(b => b.k === 'tc')));
    const avail = new Set(ks), groups = BUILD_GROUPS.map(([label, list, icon]) => ({ label, icon, here: list.filter(k => avail.has(k)) }));
    if (!groups.some(gp => gp.label === ui.buildCat && gp.here.length)) ui.buildCat = null;
    const key = ks.join() + '|' + ui.buildCat;
    if (key !== cardsKey) {
      cardsKey = key; c.replaceChildren();
      const row = el('div', { className: 'row cats' });
      for (const gp of groups) {
        const b = el('button', { className: 'ic' + (ui.buildCat === gp.label ? ' on' : ''), textContent: gp.icon }); b.disabled = !gp.here.length; b.dataset.tip = 'cat-' + gp.label;
        CARD_TIPS['cat-' + gp.label] = { tip: [gp.label, gp.here.length ? gp.here.map(k => BUILD[k].name).join(', ') : 'Nothing to build here yet in this age.'] };
        b.onclick = () => { ui.buildCat = ui.buildCat === gp.label ? null : gp.label; syncCards(); };
        row.append(b);
      }
      c.append(row);
      const gp = groups.find(x => x.label === ui.buildCat);
      if (gp) { c.append(el('div', { className: 'bgrp', textContent: gp.label })); for (const k of gp.here) c.append(card(k)); }
      else c.append(el('small', { className: 'bhint', textContent: 'Choose a kind of building.' }));
    }
    for (const b of c.querySelectorAll('button.card')) { const d = BUILD[b.dataset.k]; b.disabled = !have(g(), d.cost) || (d.needs && !g().buildings.some(o => o.k === d.needs && o.done)); }
  }
  function card(k) {
    { const b = el('button', { className: 'card' }, [el('span', { textContent: (BUILD[k].icon ? BUILD[k].icon + '  ' : '') + BUILD[k].name }), el('small', { textContent: fmt(BUILD[k].cost) + (BUILD[k].needs ? `  · needs a ${BUILD[BUILD[k].needs].name.toLowerCase()}` : '') })]); b.dataset.k = k; b.dataset.tip = 'card-' + k; b.onclick = () => { ui.place = k; ui.rot = 0; ui.buildOpen = false; toast(fineMouse() ? 'Click the ground to place it.' + (BUILD[k].turns ? ' Press R to turn it.' : '') : 'Tap the ground to place it. Tap 🔨 when done.'); }; return b; }
  }

  // ---------- upgrades and market ----------
  function drawUpgrades() {
    const at = ui.selB && (ui.selB.k === 'campfire' ? 'tc' : ui.selB.k), list = UPGRADES.filter(u => u.at === at && (!u.req || g().owned[u.req]));
    const p = $('up'); p.hidden = !ui.upOpen || !list.length; if (p.hidden) return;
    p.replaceChildren(el('b', { textContent: 'Upgrades' }));
    for (const u of list) {
      const owned = g().owned[u.id], b = el('button', { className: 'wide' }, [el('span', { textContent: u.name + (owned ? ' ✓' : '  ' + fmt(u.cost)) }), el('small', { textContent: u.desc + (u.age > g().age ? ` Unlocks in the ${AGES[u.age].name} Age.` : '') })]);
      b.disabled = owned || u.age > g().age || !have(g(), u.cost);
      b.onclick = () => { cmd.research(g(), u.id); drawUpgrades(); };
      p.append(b);
    }
  }
  function drawMarket() {
    const p = $('mk'); p.hidden = !ui.mkOpen || !(ui.selB && ui.selB.k === 'market'); if (p.hidden) return;
    const pick = (label, cur, set) => el('div', { className: 'row' }, [el('span', { textContent: label, className: 'lbl' }), ...RES.map(r => { const b = el('button', { className: 'ic' + (cur === r ? ' on' : ''), textContent: ICON[r] }); b.onclick = () => { set(r); drawMarket(); }; return b; })]);
    const go = el('button', { className: 'wide', textContent: `Trade ${TRADE.give}${ICON[ui.give]} for ${TRADE.get}${ICON[ui.get]}` });
    go.disabled = ui.give === ui.get || g().res[ui.give] < TRADE.give;
    go.onclick = () => { cmd.trade(g(), ui.give, ui.get); drawMarket(); };
    const kids = [el('b', { textContent: 'Market' }), pick('Give', ui.give, r => { ui.give = r; }), pick('Get', ui.get, r => { ui.get = r; }), go];
    // The merchant's wares, while the caravan is at the marketplace.
    const vis = g().merchant.visit;
    if (vis && vis.phase === 'trade') {
      kids.push(el('b', { textContent: 'The merchant sells' }));
      for (const w of waresFor(g())) {
        const price = warePrice(g(), w), b = el('button', { className: 'wide' }, [el('span', { textContent: `${w.name}  ${price}${ICON.gold}` }), el('small', { textContent: w.desc })]);
        b.disabled = g().res.gold < price;
        b.onclick = () => { const r = cmd.buyWare(g(), w.id); if (!r.ok) toast(r.reason); drawMarket(); };
        kids.push(b);
      }
    } else kids.push(el('small', { textContent: 'When the merchant is here, their wares appear here.' }));
    p.replaceChildren(...kids);
  }

  // ---------- context panel ----------
  function panelKey() { return ui.selB ? 'b' + ui.selB.id + ui.selB.done : ui.selN ? 'n' + ui.selN.type + ui.selN.i : ui.sel.size ? 'v' + [...ui.sel].map(v => v.id).join() : ''; }
  function buildPanel() {
    const p = $('bp'); p.replaceChildren();
    rows.splice(0, rows.length, ...rows.filter(([b]) => b.isConnected));
    if (ui.selB) {
      const b = ui.selB, def = BUILD[b.k];
      p.append(el('b', { id: 'bpt', textContent: b.done ? levelName(b) : def.name }), el('div', { id: 'bps', className: 'sub' }));
      const keys = !b.done ? OWNS.building : b.k === 'campfire' ? (townCenter(g()) ? OWNS.campfireLater : OWNS.campfire) : OWNS[b.k] || OWNS.building;
      if (keys.length) p.append(actRow(keys));
      p.hidden = false; return;
    }
    if (ui.selN) {
      const n = ui.selN;
      p.append(el('b', { textContent: n.type === 'sapling' ? 'Sapling' : NODE_NAME[g().w.R[n.i]] || 'Nothing' }), el('div', { id: 'bps', className: 'sub' }), actRow(OWNS.node));
      p.hidden = false; return;
    }
    if (ui.sel.size) {
      const vs = [...ui.sel];
      p.append(el('b', { textContent: vs.length > 1 ? plural(vs.length, 'villager', 'villagers') : vs[0].name + (vs[0].role ? ', the ' + ROLE_NAME[vs[0].role] : '') }), el('div', { id: 'bps', className: 'sub' }), actRow(OWNS.villager));
      p.hidden = false; return;
    }
    p.hidden = true;
  }
  function panelText() {
    const s = $('bps'); if (!s) return;
    const G = g();
    if (ui.selB) {
      const b = ui.selB, def = BUILD[b.k], parts = [];
      if ($('bpt') && b.done) $('bpt').textContent = levelName(b);
      if (!b.done) parts.push(`Under construction: ${Math.round(100 * b.prog / b.time)}%`);
      else {
        if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) parts.push(`Villagers: ${G.villagers.length} of ${popCap(G)} · Focus: ${FOCI[G.focus].name}`);
        if (b.k === 'campfire' && !townCenter(G)) parts.push('Build a town center to grow beyond a hamlet');
        if (b.k === 'campfire' && townCenter(G)) parts.push('A gathering place for evenings together');
        if (BUILD[b.k].craft) { const c = BUILD[b.k].craft, who = G.villagers.find(v => v.job === b.id), [o] = Object.keys(c.out);
          parts.push(`${who ? who.name + ' works here' : 'Waiting for a specialist'} · makes ${c.out[o]} ${o} from ${Object.entries(c.in).map(([r, n]) => n + ' ' + r).join(' and ')}`); }
        if (b.k === 'market') { const vis = G.merchant.visit; parts.push(vis ? (vis.phase === 'trade' ? 'The merchant is here' : 'The merchant is on the road') : `Next merchant in ${daysToMerchant(G) || MERCHANT.everyDays} day${(daysToMerchant(G) || MERCHANT.everyDays) === 1 ? '' : 's'}`);
          parts.push('Buys spare ' + Object.keys(MERCHANT.price).map(r => `${r} ${priceOf(G, r)}${ICON.gold}`).join(', ') + ' (homes keep what they need)'); }
        if (b.k === 'school') parts.push('Lessons by day add to the village\'s culture');
        if (b.k === 'theater') parts.push('Plays in the evening add to the village\'s culture');
        if (b.k === 'fiberfield') parts.push(`Fiber left: ${Math.max(0, Math.round(b.food))} of ${BUILD.fiberfield.food}`);
        if (b.k === 'farm') parts.push(`Vegetables left: ${Math.max(0, Math.round(b.food))} of ${G.mods.farmFood}`);
        if (b.k === 'wheatfield') parts.push(`Wheat left: ${Math.max(0, Math.round(b.food))} of ${BUILD.wheatfield.food}`);
        if (b.k === 'shop') { const t = TIERS.shop[b.lvl || 0]; parts.push(`Hands goods to homes within ${t.reach} tiles · sells up to ${t.sells} spare goods a day`); if (b.earned) parts.push(`Sold today for ${b.earned}${ICON.gold}`); }
        if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) { const f = wantedFestival(G); if (f && !G.festival) parts.push(`🎉 ${f.name}: ${fmt(festivalCost(G, f))}`); else if (G.festival) parts.push(`🎉 ${G.festival.name} planned`); if (G.seasonal) parts.push(`${G.seasonal.icon} ${G.seasonal.name}${G.seasonal.phase === 'on' ? ' today!' : ' coming'}`); }
        if (def.animals) parts.push(`${def.animals.kind === 'bees' ? 'Hives' : 'Animals'}: ${b.animals ?? def.animals.start} of ${def.animals.cap + (G.mods.penAdd || 0)}`);
        if (b.k === 'tc' || (b.k === 'campfire' && !townCenter(G))) parts.push(`Spirits ${Math.round((G.social || 0) * 100)}%` + (G.socialCap < 0.75 ? ' · it has been a while since the last celebration' : ''));
        if (b.k === 'tavern') parts.push(G.res.beer >= 1 ? 'Beer in the cellar: evenings here lift spirits twice as fast' : 'No beer in the cellar yet');
        if (b.k === 'well') parts.push(`Water: ${Math.floor(b.water)} of ${def.water}`);
        if (def.beds) parts.push(`Beds: ${beds(b)}` + (isNight(G) ? ` · sleeping now: ${b.sleepers}` : ''));
        if (def.home && TIERS[b.k] && !shopNear(G, b) && TIERS[b.k].some(t => (t.goods || []).length)) parts.push('No shop nearby yet: finer levels need one');
        if (def.home) { const sc = homeScore(G, b); parts.push(`Surroundings: ${beautyLabel(sc)} (${sc.toFixed(1)})`);
          const gd = TIERS[b.k] && TIERS[b.k][b.lvl].goods; if (gd && gd.length) { const dd = daysToGoods(G); parts.push(`Uses 1 ${gd.join(', 1 ')} ${dd ? `in ${dd} day${dd === 1 ? '' : 's'}` : 'tomorrow morning'}` + (gd.some(r => G.res[r] < 1) ? ` (short on ${gd.filter(r => G.res[r] < 1).join(' and ')})` : '')); } }
        { const bv = beautyOf(b); if (bv && !def.home) parts.push(bv > 0 ? `Adds ${bv} beauty nearby` : `A little unsightly (${bv} beauty nearby)`); }
        const st = RES.filter(r => storeOf(G, b, r) > 0).map(r => Math.round(storeOf(G, b, r)) + ICON[r]);
        if (st.length) parts.push('Holds ' + st.join(' '));
        if (TIERS[b.k]) { const i = cmd.improveInfo(g(), b); parts.push(`Level ${b.lvl + 1} of ${TIERS[b.k].length}` + (i.next ? ` · next: ${i.next.name}` + (i.reason ? ` (${i.reason.replace(/\.$/, '')})` : ' (ready)') : '')); }
        if (!parts.length) parts.push(def.desc);
      }
      s.textContent = parts.join(' · ');
      return;
    }
    if (ui.selN) {
      const n = ui.selN, w = G.w;
      s.textContent = n.type === 'sapling' ? `Grows into a tree in about ${Math.max(0, Math.ceil(150 - w.G[n.i]))}s (it rests in winter).` : w.A[n.i] > 0 ? `${w.A[n.i]} ${RES_NAME[NODE_INFO[w.R[n.i]].res].toLowerCase()} left.` : 'Gone.';
      return;
    }
    const vs = [...ui.sel];
    if (vs.length === 1) { const v = vs[0]; s.textContent = (v.why || 'Looking for something to do.') + (v.carry ? ` Carrying ${v.carry}${ICON[v.carryRes]}.` : ''); }
    else s.textContent = 'Tap a tree, field or building site to give them work.';
  }

  // ---------- rename dialog (locks everything else) ----------
  function openRename(v) {
    if (ui.modal || !v) return;
    ui.modal = true;
    const input = el('input', { maxLength: 16, value: v.name });
    const done = okk => { if (okk) cmd.rename(g(), v, input.value); o.remove(); ui.modal = false; ui.panelKey = ''; };
    const ok = el('button', { textContent: 'OK' }), no = el('button', { textContent: 'Cancel' });
    ok.onclick = () => done(true); no.onclick = () => done(false);
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    const o = el('div', { id: 'nm' }, [el('div', { className: 'dlg' }, [el('b', { textContent: 'Name this villager' }), input, el('div', { className: 'row end' }, [no, ok])])]);
    document.body.append(o); setTimeout(() => { input.focus(); input.select(); }, 50);
  }

  // ---------- selection helpers ----------
  function syncHeld() { for (const v of g().villagers) v.held = ui.sel.has(v); }
  function clearSel() { ui.sel = new Set(); ui.selB = null; ui.selN = null; ui.place = null; ui.moving = null; ui.buildOpen = false; ui.mode = null; ui.upOpen = false; ui.mkOpen = false; syncHeld(); }
  const idleList = () => g().villagers.filter(v => !v.act && !v.inside);
  function center(x, y) { const p = [(x - y) * 32, (x + y) * 16]; view.cam.x = p[0]; view.cam.y = p[1]; }
  function nextIdle() { const l = idleList(); if (!l.length) return; const v = l[ui.idleI++ % l.length]; clearSel(); ui.sel.add(v); syncHeld(); center(v.x, v.y); ping(v.x, v.y, '#fff3c4'); }
  function selectBuilding(b) { clearSel(); ui.selB = b; ui.selN = null; ui.menuOpen = false; ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#fff3c4'); }
  const ping = (x, y, c) => { ui.ping = { x, y, c, t: performance.now() }; };

  // ---------- hit testing ----------
  function critterAt(wx, wy) {
    let best = null, bd = 1e9;
    for (const c of g().critters || []) { const sx = (c.x - c.y) * 32, sy = (c.x + c.y) * 16 - (c.type === 'owl' ? 40 : c.type === 'frog' ? 0 : 18), d = Math.hypot(wx - sx, wy - sy), r = Math.max(22, 26 / view.cam.z); if (d < r && d < bd) { bd = d; best = c; } }
    return best;
  }
  function villagerAt(wx, wy) {
    let best = null, bd = 1e9;
    for (const v of g().villagers) {
      if (v.inside) continue;
      // Generous finger-sized target (about 44px on screen), centred on the body.
      const sx = (v.x - v.y) * 32, sy = (v.x + v.y) * 16, d = Math.hypot(wx - sx, (wy - (sy - 12)) * 0.8), r = Math.max(22, 26 / view.cam.z);
      if (d < r && d < bd) { bd = d; best = v; }
    }
    return best;
  }
  function buildingAt(rx, ry) {
    for (const k of [1, 0]) {
      const a = rx + k, c = ry + k;
      if (!inMap(a, c)) continue;
      const id = g().w.occ[idx(a, c)];
      if (id > 0) { const b = g().bmap.get(id); if (b && (k === 0 || !BUILD[b.k].flat)) return b; }
    }
    return null;
  }
  function nodeAt(rx, ry) { for (const k of [1, 0]) { const a = rx + k, c = ry + k; if (inMap(a, c) && nodeKind(g().w, idx(a, c))) return idx(a, c); } return -1; }

  // ---------- taps on the map ----------
  function tap(rx, ry, wx, wy) {
    if (ui.modal) return;
    $('hint').classList.add('gone');
    const G = g(), vs = [...ui.sel];
    if (ui.moving) {
      const b = ui.moving, r = cmd.moveBuilding(G, b, rx, ry, ui.rot);
      if (r.ok) { ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#f2c14e'); ui.moving = null; ui.place = null; } else toast(r.reason);
      return;
    }
    if (ui.place) {
      const r = cmd.place(G, ui.place, rx, ry, vs, ui.rot);
      if (r.ok) { ping(rx + (r.b.w - 1) / 2, ry + (r.b.h - 1) / 2, '#f2c14e'); if (fineMouse()) ui.place = null; } else toast(r.reason);
      return;
    }
    if (ui.mode === 'rally') {
      const fb = buildingAt(rx, ry), n = nodeAt(rx, ry);
      if (fb && fb.k === 'farm' && fb.done) cmd.setRally(G, { type: 'farm', id: fb.id });
      else if (n >= 0) cmd.setRally(G, { type: 'node', i: n });
      else if (walkable(G.w, rx, ry)) cmd.setRally(G, { type: 'tile', x: rx, y: ry });
      else { toast('Pick a tree, field or open ground.'); return; }
      ui.mode = null; ping(rx, ry, '#e86a5a'); toast('Rally point set.'); return;
    }
    if (ui.mode === 'demolish') {
      const b = buildingAt(rx, ry);
      if (!b) { toast('Tap a building to take down.'); return; }
      const r = cmd.orderDemolish(G, vs, b);
      if (r.ok) { ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#c9a171'); ui.mode = null; clearSel(); } else toast(r.reason);
      return;
    }
    if (ui.mode === 'plant') {
      if (!vs.length) { ui.mode = null; return; }
      const v = vs[ui.plantI++ % vs.length];
      if (cmd.orderPlant(G, v, rx, ry)) ping(rx, ry, '#8fd16a'); else toast('That spot is not free.');
      return;
    }
    const vis = (G.festival && G.festival.visitors || []).find(p => { const sx = (p.x - p.y) * 32, sy = (p.x + p.y) * 16; return Math.hypot(wx - sx, (wy - (sy - 12)) * 0.8) < Math.max(22, 26 / view.cam.z); });
    if (vis && !ui.place) { toast('A visitor from up the road, here for the festival. 🎉'); return; }
    const hitC = critterAt(wx, wy);
    if (hitC && !ui.place) { const r = cmd.catchCritter(G, hitC.id); if (r.ok) { ping(hitC.x, hitC.y, '#fff3a0'); audio && audio.sfx && audio.sfx('tap'); } return; }
    const hitV = villagerAt(wx, wy);
    if (hitV) {
      if (ui.mode === 'add') { if (ui.sel.has(hitV)) ui.sel.delete(hitV); else ui.sel.add(hitV); }
      else if (ui.sel.size === 1 && ui.sel.has(hitV)) ui.sel = new Set();
      else ui.sel = new Set([hitV]);
      ui.selB = null; ui.selN = null; ui.buildOpen = false; ui.upOpen = false; ui.mkOpen = false;
      syncHeld(); ping(hitV.x, hitV.y, '#fff3c4'); return;
    }
    const b = buildingAt(rx, ry), n = nodeAt(rx, ry);
    if (vs.length) {
      if (b && !b.done) { cmd.orderBuild(G, vs, b); ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#f2c14e'); }
      else if (b && BUILD[b.k].crop && b.done) { cmd.orderFarm(G, vs, b); ping(b.x + 0.5, b.y + 0.5, '#8fd16a'); }
      else if (n >= 0) { cmd.orderGather(G, vs, n); ping(n % N, (n / N) | 0, '#8fd16a'); }
      else if (b) { selectBuilding(b); return; }
      else if (inMap(rx, ry) && G.w.T[idx(rx, ry)] !== WATER) { if (cmd.orderMove(G, vs, rx, ry)) ping(rx, ry, '#ffffff'); }
      clearSel(); return;
    }
    if (b) { selectBuilding(b); return; }
    if (n >= 0) { clearSel(); ui.selN = { type: 'node', i: n }; ping(n % N, (n / N) | 0, '#fff3c4'); return; }
    if (inMap(rx, ry) && G.w.G[idx(rx, ry)] > 0) { clearSel(); ui.selN = { type: 'sapling', i: idx(rx, ry) }; ping(rx, ry, '#fff3c4'); return; }
    clearSel();
  }
  function hoverAt(rx, ry) {
    ui.hover = [rx, ry];
    if (!ui.sel.size || ui.place) { ui.hoverCells = null; return; }
    const n = nodeAt(rx, ry), b = buildingAt(rx, ry);
    ui.hoverCells = n >= 0 ? [[n % N, (n / N) | 0]] : b && b.k !== 'tc' ? Array.from({ length: b.w * b.h }, (_, i) => [b.x + i % b.w, b.y + ((i / b.w) | 0)]) : null;
  }

  // ---------- per-frame sync ----------
  function sync() {
    const G = g();
    for (const v of ui.sel) if (!G.villagers.includes(v) || v.inside || (v.act && v.act.type === 'sleep' && v.act.phase === 'sleep')) ui.sel.delete(v);
    if (ui.selB && !G.bmap.has(ui.selB.id)) ui.selB = null;
    $('hud').hidden = !ui.hudOpen; document.body.classList.toggle('hud-open', ui.hudOpen);
    $('gm').hidden = !ui.menuOpen; $('fab').classList.toggle('on', ui.menuOpen);
    { const pb = $('pausebtn'); pb.textContent = ui.paused ? '▶️' : '⏸️'; pb.classList.toggle('on', !!ui.paused); pb.setAttribute('aria-label', ui.paused ? 'Resume' : 'Pause'); }
    { const vr = document.querySelector('.volrow'); if (vr) vr.hidden = !settings.sound; }
    // How much the village has / how much it can hold. Workshop goods appear once the village can store or has them.
    for (const r of RES) {
      const c = Math.floor(cap(G, r)), n = Math.floor(G.res[r]);
      $('r-' + r).textContent = `${n}/${c}`;
      $('s-' + r).hidden = (GOODS.includes(r) || FARM.includes(r)) && !c && !n;
    }
    for (const [id, list] of [['farm', FARM], ['goods', GOODS]]) $('g-' + id).hidden = list.every(r => $('s-' + r).hidden);
    { const p = G.pantry || {}, kinds = PANTRY.filter(k => (p[k] || 0) >= 1); $('pantry').hidden = !kinds.length; const key = kinds.map(k => k + Math.floor(p[k])).join(); if ($('pantry').dataset.k !== key) { $('pantry').dataset.k = key; $('pantry').replaceChildren(...kinds.map(k => { const e = el('span', { textContent: `${PANTRY_ICON[k]} ${Math.floor(p[k])}  ` }); e.dataset.tip = 'pan-' + k; return e; })); } }
    if (ui.selN && !(ui.selN.type === 'sapling' ? G.w.G[ui.selN.i] > 0 : G.w.A[ui.selN.i] > 0)) ui.selN = null;
    $('dir').hidden = ui.overlay !== 'directors';
    if (ui.overlay === 'directors' && (ui.dirT = (ui.dirT || 0) + 1) % 30 === 1) drawDirectors();
    $('r-pop').textContent = `${G.villagers.length}/${popCap(G)}`;
    const h = hour(G), hh = Math.floor(h), mm = Math.floor((h % 1) * 60);
    $('r-age').textContent = `${AGES[G.age].name} Age · 🎭 ${Math.floor(G.culture || 0)}${AGES[G.age + 1] ? '/' + AGES[G.age + 1].culture : ''} · ${SEASONS[seasonIndex(G)]}${darkness(G) > 0.6 ? ' 🌙' : ''}`;
    $('gmc').textContent = `Day ${dayNumber(G)} · ${SEASONS[seasonIndex(G)]} · ${AGES[G.age].name} Age · ${clock12(hh, mm, false)} · Village beauty: ${beautyLabel(villageBeauty(G))}`;
    const key = panelKey(); if (key !== ui.panelKey) { ui.panelKey = key; buildPanel(); if (!ui.selB || (ui.selB.k !== 'tc' && ui.selB.k !== 'campfire')) ui.upOpen = false; if (!ui.selB || ui.selB.k !== 'market') ui.mkOpen = false; }
    panelText(); syncCards(); syncButtons();
    $('up').hidden = !ui.upOpen; $('mk').hidden = !ui.mkOpen;
    if (ui.upOpen && (ui.tick = (ui.tick || 0) + 1) % 30 === 0) drawUpgrades();
    if (ui.mkOpen && ui.tick % 30 === 0) drawMarket();
  }

  // ---------- keyboard ----------
  addEventListener('keydown', e => {
    if (ui.modal || (e.target && e.target.tagName === 'INPUT')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'p') { ACT.pause.run(); return; }
    if (k === 'r' && (ui.place || ui.moving || ui.selB)) { ACT.rotate.run(); return; }
    if (k === 'b') { if (ui.sel.size) ACT.build.run(); else toast('Select a villager to build.'); }
    else if (k === 'm') ui.menuOpen = !ui.menuOpen;
    else if (k === 'h') { const tc = hub(g()); selectBuilding(tc); center(tc.x + 0.5, tc.y + 0.5); }
    else if (k === '.') nextIdle();
    else if (k === 'escape') { clearSel(); ui.menuOpen = false; }
  });

  g().events.on('notice', toast);
  return Object.assign(ui, { tap, hoverAt, sync, toast, clearSel, rebind() { g().events.on('notice', toast); clearSel(); } });
}
