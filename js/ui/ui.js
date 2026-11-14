// The interface: what was tapped, which bubble or sheet is open, the resource bar, tips and messages.
// Buttons live in actions.js (one table), text about things in panels.js, the bubble in popover.js, the sheet in sheet.js.
//
//   tap a villager  -> bubble above their head (Build, Unload, Back to work, More)
//   tap a building  -> bubble above its roof (its own actions, Details, More)
//   with villagers selected, tap a tree, field, workshop or site -> they get to work (a short note says so)
//   Build -> sheet of buildings -> tap the ground to see it there -> ✓ Place (or tap the same spot again)
//   Take down, Say goodbye, New game -> asked once, inside the bubble
import { BUILD_GROUPS, RES_DESC, PANTRY, PANTRY_ICON, FARM, BUILD, BUILD_ORDER, ICON, RES, RES_NAME, BASICS, GOODS, AGES, UPGRADES, SEASONS, TRADE, N, NODE_INFO } from '../core/config.js';
import { idx, inMap, nodeKind, WATER, walkable } from '../core/world.js';
import { have, popCap, hour, dayNumber, seasonIndex, darkness, cap, hub, clock12 } from '../core/state.js';
import { waresFor, warePrice } from '../core/merchant.js';
import { beautyLabel, villageBeauty } from '../core/beauty.js';
import * as cmd from '../core/commands.js';
import { openInterior } from './interior.js';
import { $, el, fmt, val, buzz } from './dom.js';
import { createPopover } from './popover.js';
import { createSheet } from './sheet.js';
import { createActions, OWNS, PRIMARY } from './actions.js';
import { NODE_NAME, buildingTitle, buildingSummary, buildingDetails, villagerTitle, villagerSummary, villagerJob, nodeSummary } from './panels.js';
import { placeHint, orderNote } from '../core/hints.js';
import { createCoach } from './coach.js';
import { VERSION } from '../core/config.js';

export { OWNS };

export function createUI(ctx) {
  const { getGame, view, settings, audio } = ctx;
  const ui = { sel: new Set(), selB: null, selN: null, overlay: 'off', place: null, ghost: null, mode: null, menuOpen: false, hudOpen: false, modal: false, hover: [-9, -9], hoverCells: null, ping: null, plantI: 0, idleI: 0, give: 'wood', get: 'food', rot: 0, more: false };
  const g = () => getGame();
  const pop = createPopover(), sheet = createSheet();

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

  // ---------- where things are on screen ----------
  const toScreen = (wx, wy) => [(wx - view.cam.x) * view.cam.z + view.W / 2, (wy - view.cam.y) * view.cam.z + view.H / 2];
  const isoW = (x, y) => [(x - y) * 32, (x + y) * 16];
  function anchorVillagers() {
    const vs = [...ui.sel]; if (!vs.length) return null;
    const v = vs[0], [wx, wy] = isoW(v.x, v.y), [sx, sy] = toScreen(wx, wy), z = view.cam.z;
    return { x: sx, top: sy - 52 * z, bottom: sy + 10 * z };
  }
  function anchorBuilding(b, rx = b.x, ry = b.y, w = b.w, h = b.h) {
    const [wx, wy] = isoW(rx + (w - 1) / 2, ry + (h - 1) / 2), [sx, sy] = toScreen(wx, wy), z = view.cam.z, top = b ? (ctx.heightOf ? ctx.heightOf(b, g().age) : 30) : 20;
    return { x: sx, top: sy - (top + 22) * z, bottom: sy + 16 * z };
  }
  function anchorTile(x, y) { const [wx, wy] = isoW(x, y), [sx, sy] = toScreen(wx, wy), z = view.cam.z; return { x: sx, top: sy - 36 * z, bottom: sy + 14 * z }; }

  // ---------- short notes at the spot that was tapped ----------
  const sayEl = el('div', { id: 'say', role: 'status' }); document.body.append(sayEl);
  let sayT = 0;
  function say(text, at) {
    if (!text) return;
    const p = at || ui.lastTap || [innerWidth / 2, innerHeight / 2];
    sayEl.textContent = text; sayEl.classList.remove('show'); void sayEl.offsetWidth;
    const w = Math.min(280, innerWidth - 24); sayEl.style.maxWidth = w + 'px';
    const r = sayEl.getBoundingClientRect();
    let top = p[1] - r.height - 64; if (top < 60) top = p[1] + 40;
    const left = Math.max(12, Math.min(innerWidth - r.width - 12, p[0] - r.width / 2));
    if (!pop.root.hidden) {   // never on top of the open bubble: slide above or below it
      const q = pop.root.getBoundingClientRect();
      if (left < q.right && left + r.width > q.left && top < q.bottom && top + r.height > q.top) top = q.bottom + 10 + r.height < innerHeight - 70 ? q.bottom + 10 : Math.max(60, q.top - r.height - 10);
    }
    sayEl.style.left = left + 'px'; sayEl.style.top = top + 'px';
    sayEl.classList.add('show'); clearTimeout(sayT); sayT = setTimeout(() => sayEl.classList.remove('show'), 2600);
  }

  // ---------- village news: the top message, with an optional action (Undo) ----------
  let toastT = 0;
  function toast(text, action) {
    const t = $('toast'); t.replaceChildren(el('span', { textContent: text }));
    if (action) { const b = el('button', { className: 'tbtn', textContent: action.label }); b.onclick = () => { action.run(); t.classList.remove('show', 'act'); }; t.append(b); }
    t.classList.toggle('act', !!action); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show', 'act'), action ? 5000 : 4200);
  }

  // ---------- the actions and their buttons ----------
  const api = { ui, g, settings, audio, toast, say, pop, sheet, save: ctx.save, newGame: ctx.newGame };
  const ACT = createActions(api);
  const coach = api.coach = createCoach({ ui, g, view, settings, toScreen, pop });
  // Short captions under bubble buttons: icons are easier to learn with a word beside them.
  const LABEL = { build: 'Build', unload: 'Unload', work: 'To work', plant: 'Plant', add: 'Group', rename: 'Name', clearjob: 'Clear job', remove: 'Remove', train: 'Villager', age: 'Age', festival: 'Festival', upgrades: 'Upgrades', rally: 'Rally', all: 'Everyone', idle: 'Idle', focus: 'Focus', improve: 'Improve', inside: 'Inside', move: 'Move', rotate: 'Turn', trade: 'Trade', info: 'Details', more: 'More', free: 'Free will', speed: 'Speed', pause: 'Pause', sound: 'Sound', overlay: 'Maps', album: 'Critters', save: 'Save', sandbox: 'Sandbox', newgame: 'New game', hints: 'Hints' };
  const rows = [];
  function button(k) {
    const a = ACT[k], b = el('button', { className: 'ic' + (a.danger ? ' danger' : '') + (k === 'more' ? ' more' : '') }); b.dataset.tip = k;
    b.setAttribute('aria-label', val(a.tip)[0]);
    b.onclick = () => { buzz(6); a.run(); syncButtons(); };
    const w = el('div', { className: 'bw' }, [b, el('small', { textContent: LABEL[k] || val(a.tip)[0] })]);
    rows.push([b, k, w]); return w;
  }
  function syncButtons() {
    for (let i = rows.length - 1; i >= 0; i--) {
      const [b, k, w] = rows[i]; if (!b.isConnected) { rows.splice(i, 1); continue; }
      const a = ACT[k]; b.textContent = val(a.icon); b.disabled = a.dis ? !!a.dis() : false;
      w.hidden = a.hide ? !!a.hide() : false;
      b.classList.toggle('on', a.on ? !!a.on() : false); b.classList.toggle('ready', a.ready ? !!a.ready() : false);
    }
  }
  // A bubble's buttons: the first few shown, the rest under ••• More (a second row).
  function actionRows(keys, extra = []) {
    const shown = keys.filter(k => !(ACT[k].hide && ACT[k].hide()));
    const first = shown.slice(0, PRIMARY), rest = shown.slice(PRIMARY);
    const row1 = el('div', { className: 'prow' }, [...first.map(button), ...extra.map(button), ...(rest.length ? [button('more')] : [])]);
    const row2 = rest.length && ui.more ? el('div', { className: 'prow more-row' }, rest.map(button)) : null;
    return [row1, row2];
  }
  api.toggleMore = () => { ui.more = !ui.more; pop.close(); };   // reopened next frame with or without the second row

  // ---------- the bubble for what is selected ----------
  function head(title, sub, sub2) {
    return el('div', { className: 'pop-head' }, [el('b', { className: 'pt', textContent: title }), el('small', { className: 'ps', textContent: sub || '' }), sub2 != null ? el('small', { className: 'ps2', textContent: sub2 }) : null]);
  }
  const setText = (body, cls, t) => { const e = body.querySelector('.' + cls); if (e && e.textContent !== t) e.textContent = t; };
  function bubbleSpec() {
    const G = g();
    if (ui.place) {
      const k = ui.place, x = ui.ghost;
      if (!x) return null;
      return { key: `place:${k}:${x[0]},${x[1]}:${ui.rot}:${ui.canPlace(x[0], x[1])}`,
        at: () => anchorBuilding({ k, lvl: 0, w: 1, h: 1 }, x[0], x[1], ...cmdDims()),
        build: b => {
          const ok = ui.canPlace(x[0], x[1]), turn = BUILD[k].turns || BUILD[k].faces;
          const yes = el('button', { className: 'pbtn primary', textContent: ui.moving ? '✓ Move here' : '✓ Place' }); yes.disabled = !ok; yes.onclick = confirmPlace;
          const rot = el('button', { className: 'pbtn', textContent: '🔄' }); rot.setAttribute('aria-label', 'Turn'); rot.onclick = () => { ui.rot = ui.rot ? 0 : 1; };
          const no = el('button', { className: 'pbtn', textContent: '✕' }); no.setAttribute('aria-label', 'Cancel'); no.onclick = cancelPlace;
          b.append(head(ui.moving ? 'Move the ' + buildingTitle(ui.moving).toLowerCase() : BUILD[k].name, placeHint(G, k, x[0], x[1], ui.rot, ok)), el('div', { className: 'pop-yn' }, [no, ...(turn ? [rot] : []), yes]));
        } };
    }
    if (ui.sel.size) {
      const vs = [...ui.sel], key = 'v:' + vs.map(v => v.id).join() + ':' + ui.more;
      return { key, at: anchorVillagers,
        build: b => { const [r1, r2] = actionRows(vs.length > 1 ? OWNS.villagers : OWNS.villager); b.append(...[head(villagerTitle(vs), villagerSummary(G, vs), vs.length === 1 ? villagerJob(G, vs[0]) : null), r1, r2].filter(Boolean)); },
        refresh: b => { setText(b, 'pt', villagerTitle(vs)); setText(b, 'ps', villagerSummary(g(), vs)); if (vs.length === 1) setText(b, 'ps2', villagerJob(g(), vs[0])); } };
    }
    if (ui.selB) {
      const b0 = ui.selB, keys = !b0.done ? OWNS.site : b0.k === 'campfire' ? (G.buildings.some(o => o.k === 'tc' && o.done) ? OWNS.campfireLater : OWNS.campfire) : OWNS[b0.k] || OWNS.building;
      return { key: 'b:' + b0.id + ':' + b0.done + ':' + ui.more, at: () => anchorBuilding(b0),
        build: b => { const [r1, r2] = actionRows(keys, ['info']); b.append(...[head(buildingTitle(b0), buildingSummary(G, b0)), r1, r2].filter(Boolean)); },
        refresh: b => { setText(b, 'pt', buildingTitle(b0)); setText(b, 'ps', buildingSummary(g(), b0)); } };
    }
    if (ui.selN) {
      const n = ui.selN, x = n.i % N, y = (n.i / N) | 0;
      return { key: 'n:' + n.type + n.i, at: () => anchorTile(x, y),
        build: b => { b.append(head(n.type === 'sapling' ? 'Sapling' : NODE_NAME[G.w.R[n.i]] || 'Nothing', nodeSummary(G, n)), el('div', { className: 'prow' }, [button('remove')])); },
        refresh: b => setText(b, 'ps', nodeSummary(g(), n)) };
    }
    if (ui.menuOpen) return { key: 'game', at: () => $('fab'), build: buildGameMenu, refresh: b => setText(b, 'ps', gameLine()) };
    return null;
  }
  const cmdDims = () => { const k = ui.place, d = BUILD[k], w = d.w || d.size, h = d.h || d.size; return ui.rot ? [h, w] : [w, h]; };

  // ---------- the game menu: a bubble from its button ----------
  const gameLine = () => { const G = g(), h = hour(G); return `Day ${dayNumber(G)} · ${SEASONS[seasonIndex(G)]} · ${AGES[G.age].name} Age · ${clock12(Math.floor(h), Math.floor((h % 1) * 60), false)} · Beauty: ${beautyLabel(villageBeauty(G))}`; };
  function buildGameMenu(b) {
    b.append(head(`Hearthvale · v${VERSION}`, gameLine()), el('div', { className: 'prow wrap' }, OWNS.game.map(button)));
    if (settings.sound) {
      const vol = el('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round((settings.volume ?? 0.7) * 100)) });
      vol.setAttribute('aria-label', 'Volume');
      vol.oninput = () => { settings.volume = vol.value / 100; audio.setVolume(settings.volume); settings.persist(); };
      b.append(el('label', { className: 'volrow' }, [el('span', { textContent: '🔉' }), vol]));
    }
  }
  api.refreshGame = () => { if (pop.key === 'game') pop.close(); };
  $('fab').onclick = () => { const was = ui.menuOpen; clearSel(); ui.menuOpen = !was; };
  $('buildbtn').onclick = () => { if (ui.place) { cancelPlace(); return; } if (sheet.key === 'build') { sheet.close(); return; } ui.menuOpen = false; ui.selB = null; ui.selN = null; api.openBuild(); };
  $('hudbtn').onclick = () => { ui.hudMode = ((ui.hudMode || 0) + 1) % 3; ui.hudOpen = ui.hudMode > 0; };

  // ---------- sheets: build menu, upgrades, market, details ----------
  const CARD_TIPS = {};
  for (const k of BUILD_ORDER) CARD_TIPS['card-' + k] = { tip: [BUILD[k].name, BUILD[k].desc], cost: BUILD[k].cost };
  for (const r of RES) CARD_TIPS['res-' + r] = { tip: [`${ICON[r]} ${RES_NAME[r]}`, RES_DESC[r] || ''] };
  const PANTRY_NAME = { provisions: 'Provisions (mixed stores)', berries: 'Berries', fish: 'Fish', vegetables: 'Vegetables', bread: 'Bread', eggs: 'Eggs', cheese: 'Cheese', honey: 'Honey' };
  for (const k of PANTRY) CARD_TIPS['pan-' + k] = { tip: [`${PANTRY_ICON[k]} ${PANTRY_NAME[k] || k}`, 'Part of the food in the pantry.'] };
  CARD_TIPS['res-pop'] = { tip: ['🏠 Villagers', 'How many live here, and how many the village has room for.'] };
  CARD_TIPS['res-age'] = { tip: ['Age, culture and season', 'The village age; 🎭 culture now and needed for the next age; the season.'] };
  CARD_TIPS.hud = { tip: ['Resources', 'Tap once for the basics, again for everything, a third time to close.'] };

  api.openBuild = () => {
    const vs = [...ui.sel]; pop.close();
    sheet.open({ key: 'build', title: 'Build', build: buildSheet, refresh: syncCards, onClose: () => { if (!ui.place) ui.buildOpen = false; } });
    ui.buildOpen = true; ui.sel = new Set(vs);
  };
  function buildSheet(body) {
    const G = g();
    const ks = BUILD_ORDER.filter(k => BUILD[k].age <= G.age && !(BUILD[k].unlock && !G.unlocked[k]) && !(k === 'tc' && G.buildings.some(b => b.k === 'tc')));
    const avail = new Set(ks), groups = BUILD_GROUPS.map(([label, list, icon]) => ({ label, icon, here: list.filter(k => avail.has(k)) }));
    if (!groups.some(gp => gp.label === ui.buildCat && gp.here.length)) ui.buildCat = (groups.find(gp => gp.here.length) || {}).label;
    const tabs = el('div', { className: 'tabs' });
    for (const gp of groups) {
      const b = el('button', { className: 'tab' + (ui.buildCat === gp.label ? ' on' : '') }, [el('span', { textContent: gp.icon }), el('small', { textContent: gp.label })]);
      b.disabled = !gp.here.length; b.onclick = () => { ui.buildCat = gp.label; sheet.rebuild(); };
      tabs.append(b);
    }
    const gp = groups.find(x => x.label === ui.buildCat), grid = el('div', { className: 'cards' });
    if (gp) for (const k of gp.here) grid.append(card(k));
    body.append(tabs, grid);
    syncCards(body);
  }
  function card(k) {
    const d = BUILD[k], b = el('button', { className: 'card' }, [el('span', { className: 'cn', textContent: (d.icon ? d.icon + ' ' : '') + d.name }), el('small', { textContent: fmt(d.cost) || 'Free' }), d.needs || BUILD_FARM(k) ? el('small', { className: 'cneed', textContent: BUILD_FARM(k) || `Needs a ${BUILD[d.needs].name.toLowerCase()}` }) : null]);
    b.dataset.k = k; b.dataset.tip = 'card-' + k;
    b.onclick = () => { ui.place = k; ui.rot = 0; ui.ghost = null; sheet.close(); toast('Tap the ground where it should go.'); };
    return b;
  }
  const BUILD_FARM = k => ({ farm: 1, wheatfield: 1, fiberfield: 1, coop: 1, sheepfold: 1, pasture: 1, apiary: 1 })[k] ? 'Goes within 4 tiles of a farmhouse' : '';
  function syncCards(body) { for (const b of body.querySelectorAll('button.card')) { const d = BUILD[b.dataset.k]; b.disabled = !have(g(), d.cost) || (d.needs && !g().buildings.some(o => o.k === d.needs && o.done)); } }

  api.openUpgrades = () => {
    const b0 = ui.selB, at = b0 && (b0.k === 'campfire' ? 'tc' : b0.k);
    sheet.open({ key: 'up' + b0.id, title: 'Upgrades: ' + buildingTitle(b0), build: body => {
      const G = g(), list = UPGRADES.filter(u => u.at === at && (!u.req || G.owned[u.req]));
      for (const u of list) {
        const owned = G.owned[u.id], b = el('button', { className: 'wide' }, [el('span', { textContent: u.name + (owned ? ' ✓' : '  ' + fmt(u.cost)) }), el('small', { textContent: u.desc + (u.age > G.age ? ` Opens in the ${AGES[u.age].name} Age.` : '') })]);
        b.disabled = owned || u.age > G.age || !have(G, u.cost);
        b.onclick = () => { cmd.research(G, u.id); say(`${u.name}: done. ✨`); sheet.rebuild(); };
        body.append(b);
      }
      if (!list.length) body.append(el('small', { textContent: 'Nothing more for now.' }));
    } });
  };
  api.openMarket = () => {
    sheet.open({ key: 'market', title: 'Marketplace', build: body => {
      const G = g();
      const pick = (label, cur, set) => el('div', { className: 'row' }, [el('span', { textContent: label, className: 'lbl' }), ...RES.filter(r => cap(G, r) > 0).map(r => { const b = el('button', { className: 'ic sm' + (cur === r ? ' on' : ''), textContent: ICON[r] }); b.onclick = () => { set(r); sheet.rebuild(); }; return b; })]);
      const go = el('button', { className: 'pbtn primary', textContent: `Trade ${TRADE.give}${ICON[ui.give]} for ${TRADE.get}${ICON[ui.get]}` });
      go.disabled = ui.give === ui.get || G.res[ui.give] < TRADE.give;
      go.onclick = () => { cmd.trade(G, ui.give, ui.get); sheet.rebuild(); };
      body.append(pick('Give', ui.give, r => { ui.give = r; }), pick('Get', ui.get, r => { ui.get = r; }), go);
      const vis = G.merchant.visit;
      if (vis && vis.phase === 'trade') {
        body.append(el('b', { textContent: 'The merchant sells' }));
        for (const w of waresFor(G)) {
          const price = warePrice(G, w), b = el('button', { className: 'wide' }, [el('span', { textContent: `${w.name}  ${price}${ICON.gold}` }), el('small', { textContent: w.desc })]);
          b.disabled = G.res.gold < price;
          b.onclick = () => { const r = cmd.buyWare(G, w.id); if (!r.ok) say(r.reason); sheet.rebuild(); };
          body.append(b);
        }
      } else body.append(el('small', { textContent: 'When the merchant is here, their wares show up here.' }));
    } });
  };
  api.openDetails = () => {
    const b0 = ui.selB; if (!b0) return;
    sheet.open({ key: 'info' + b0.id, title: buildingTitle(b0), build: body => { body.append(el('ul', { className: 'details' }, buildingDetails(g(), b0).map(t => el('li', { textContent: t })))); },
      refresh: body => { const ul = body.querySelector('ul'), lines = buildingDetails(g(), b0); if (ul && ul.dataset.k !== lines.join('|')) { ul.dataset.k = lines.join('|'); ul.replaceChildren(...lines.map(t => el('li', { textContent: t }))); } } });
  };
  api.openInside = b => { if (ui.modal || !b) return; ui.modal = true; pop.close(); openInterior(g(), b, () => { ui.modal = false; }); };

  // ---------- placing and moving: preview, then ✓ ----------
  api.startMove = b => { ui.moving = b; ui.place = b.k; ui.rot = b.rot || 0; ui.ghost = [b.x, b.y]; ui.selB = null; say('Tap where it should go, then ✓.'); };
  function confirmPlace() {
    const G = g(), x = ui.ghost; if (!x || !ui.place) return;
    if (ui.moving) {
      const b = ui.moving, from = [b.x, b.y, b.rot || 0], r = cmd.moveBuilding(G, b, x[0], x[1], ui.rot);
      if (!r.ok) { say(r.reason || 'That spot is not free.'); return; }
      ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#f2c14e'); buzz();
      const name = buildingTitle(b).toLowerCase();
      toast(`The ${name} has a new spot.`, { label: 'Undo', run: () => { if (G.bmap.has(b.id)) cmd.moveBuilding(G, b, from[0], from[1], from[2]); } });
      clearSel(); return;
    }
    // Built by the villagers chosen, or else by whoever is nearest and awake.
    let vs = [...ui.sel];
    if (!vs.length) { const v = G.villagers.filter(v => !v.inside && !(v.act && (v.act.type === 'sleep' || v.act.type === 'leave'))).sort((a, b) => Math.hypot(a.x - x[0], a.y - x[1]) - Math.hypot(b.x - x[0], b.y - x[1]))[0] || G.villagers[0]; if (v) vs = [v]; }
    const r = cmd.place(G, ui.place, x[0], x[1], vs, ui.rot);
    if (!r.ok) { say(r.reason); return; }
    ping(x[0] + (r.b.w - 1) / 2, x[1] + (r.b.h - 1) / 2, '#f2c14e'); buzz(); ui.coachPlaced = true;
    say(orderNote(G, 'place', vs, r.b), ui.lastTap);
    clearSel();
  }
  function cancelPlace() { const was = ui.moving; ui.place = null; ui.ghost = null; ui.moving = null; if (was) selectBuilding(was); }

  // ---------- rename dialog ----------
  api.openRename = v => {
    if (ui.modal || !v) return;
    ui.modal = true; pop.close();
    const input = el('input', { maxLength: 16, value: v.name });
    const done = okk => { if (okk) cmd.rename(g(), v, input.value); o.remove(); ui.modal = false; };
    const ok = el('button', { className: 'pbtn primary', textContent: 'OK' }), no = el('button', { className: 'pbtn', textContent: 'Cancel' });
    ok.onclick = () => done(true); no.onclick = () => done(false);
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    const o = el('div', { id: 'nm' }, [el('div', { className: 'dlg' }, [el('b', { textContent: 'Name this villager' }), input, el('div', { className: 'pop-yn' }, [no, ok])])]);
    document.body.append(o); setTimeout(() => { input.focus(); input.select(); }, 50);
  };

  // ---------- selection ----------
  function syncHeld() { for (const v of g().villagers) v.held = ui.sel.has(v); }
  function clearSel() { ui.sel = new Set(); ui.selB = null; ui.selN = null; ui.place = null; ui.ghost = null; ui.moving = null; ui.buildOpen = false; ui.mode = null; ui.more = false; ui.menuOpen = false; syncHeld(); }
  const idleList = () => g().villagers.filter(v => !v.act && !v.inside);
  function center(x, y) { const p = isoW(x, y); view.cam.x = p[0]; view.cam.y = p[1]; }
  function nextIdle() { const l = idleList(); if (!l.length) return; const v = l[ui.idleI++ % l.length]; clearSel(); ui.sel.add(v); syncHeld(); center(v.x, v.y); ping(v.x, v.y, '#fff3c4'); }
  function selectBuilding(b) { clearSel(); ui.selB = b; ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#fff3c4'); }
  const ping = (x, y, c) => { ui.ping = { x, y, c, t: performance.now() }; };
  Object.assign(api, { clearSel, syncHeld, idleList, nextIdle });

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
      const sx = (v.x - v.y) * 32, sy = (v.x + v.y) * 16, d = Math.hypot(wx - sx, (wy - (sy - 12)) * 0.8), r = Math.max(22, 26 / view.cam.z);   // a finger-sized target
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
    ui.lastTap = toScreen(wx, wy);
    if (sheet.key && !ui.place) { sheet.close(); return; }   // a tap outside a sheet just closes it
    const G = g(), vs = [...ui.sel];
    if (ui.place) {   // placing or moving: the first tap shows it there, ✓ (or the same spot again) places it
      if (ui.ghost && ui.ghost[0] === rx && ui.ghost[1] === ry) { confirmPlace(); return; }
      ui.ghost = [rx, ry]; return;
    }
    if (ui.mode === 'rally') {
      const fb = buildingAt(rx, ry), n = nodeAt(rx, ry);
      if (fb && fb.k === 'farm' && fb.done) cmd.setRally(G, { type: 'farm', id: fb.id });
      else if (n >= 0) cmd.setRally(G, { type: 'node', i: n });
      else if (walkable(G.w, rx, ry)) cmd.setRally(G, { type: 'tile', x: rx, y: ry });
      else { say('Pick a tree, field or open ground.'); return; }
      ui.mode = null; ping(rx, ry, '#e86a5a'); say('New villagers will head here first. 🚩'); return;
    }
    const hitV = villagerAt(wx, wy);
    if (ui.mode === 'plant' && !hitV) {
      if (!vs.length) { ui.mode = null; return; }
      const v = vs[ui.plantI++ % vs.length];
      if (cmd.orderPlant(G, v, rx, ry)) { ping(rx, ry, '#8fd16a'); say(`${v.name} will plant a sapling here. 🌱`); } else say('Saplings need open grass, a little away from buildings.');
      return;
    }
    const vis = (G.festival && G.festival.visitors || []).find(p => { const sx = (p.x - p.y) * 32, sy = (p.x + p.y) * 16; return Math.hypot(wx - sx, (wy - (sy - 12)) * 0.8) < Math.max(22, 26 / view.cam.z); });
    if (vis) { say('A visitor from up the road, here for the festival. 🎉'); return; }
    const hitC = critterAt(wx, wy);
    if (hitC) { const r = cmd.catchCritter(G, hitC.id); if (r.ok) { ping(hitC.x, hitC.y, '#fff3a0'); audio && audio.sfx && audio.sfx('tap'); } return; }
    if (hitV) {
      if (ui.mode === 'add') { if (ui.sel.has(hitV)) ui.sel.delete(hitV); else ui.sel.add(hitV); }
      else if (ui.sel.size === 1 && ui.sel.has(hitV)) { clearSel(); return; }
      else { clearSel(); ui.sel = new Set([hitV]); }
      ui.selB = null; ui.selN = null; ui.menuOpen = false;
      syncHeld(); ping(hitV.x, hitV.y, '#fff3c4'); return;
    }
    const b = buildingAt(rx, ry), n = nodeAt(rx, ry);
    if (vs.length) {   // villagers selected: give them work where they tapped
      let note = null;
      if (b && !b.done) { cmd.orderBuild(G, vs, b); ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#f2c14e'); note = orderNote(G, 'build', vs, b); }
      else if (b && BUILD[b.k].crop && b.done) { cmd.orderFarm(G, vs, b); ping(b.x + 0.5, b.y + 0.5, '#8fd16a'); note = orderNote(G, 'farm', vs, b); }
      else if (b && BUILD[b.k].craft && b.done) { cmd.orderCraft(G, vs, b); ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#8fd16a'); note = orderNote(G, 'craft', vs, b); }
      else if (n >= 0) { cmd.orderGather(G, vs, n); ping(n % N, (n / N) | 0, '#8fd16a'); note = orderNote(G, 'gather', vs, null, nodeKind(G.w, n)); }
      else if (b) { selectBuilding(b); say(orderNote(G, 'nowork', vs, b)); return; }
      else if (inMap(rx, ry) && G.w.T[idx(rx, ry)] !== WATER) { if (cmd.orderMove(G, vs, rx, ry)) { ping(rx, ry, '#ffffff'); note = orderNote(G, 'move', vs); } }
      else note = 'They can\'t walk on water. Tap the shore to fish or fetch water.';
      say(note); clearSel(); return;
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

  // ---------- tips: hover with a mouse, press and hold on touch ----------
  const tipEl = $('tip'); let tipT = 0, lpT = 0, lpFired = false;
  function showTip(b) {
    const k = b.dataset.tip, a = ACT[k] || CARD_TIPS[k]; if (!a || !a.tip) return;
    const [name, desc] = val(a.tip); const c = a.cost ? val(a.cost) : null;
    tipEl.replaceChildren(el('b', { textContent: name }), el('div', { textContent: desc }), ...(c ? [el('small', { textContent: fmt(c) })] : []));
    tipEl.hidden = false;
    // Clear of the bubble or panel it came from: above it, else below, else beside it.
    const r = b.getBoundingClientRect(), box = b.closest('#pop, #sheet, #hud, #dir'), R = box ? box.getBoundingClientRect() : r, th = tipEl.offsetHeight, tw = 240;
    let left = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)), top;
    if (R.top - th - 8 >= 8) top = R.top - th - 8;
    else if (R.bottom + th + 8 <= innerHeight - 8) top = R.bottom + 8;
    else { top = Math.max(8, Math.min(innerHeight - th - 8, r.top)); left = R.left >= tw + 16 ? R.left - tw - 8 : Math.min(innerWidth - tw - 8, R.right + 8); }
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
    clearTimeout(tipT); tipT = setTimeout(() => { tipEl.hidden = true; }, 4000);
  }
  const tipTarget = e => e.target.closest && e.target.closest('[data-tip]');
  document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') { const b = tipTarget(e); if (b) showTip(b); } });
  document.addEventListener('pointerout', e => { if (e.pointerType === 'mouse' && tipTarget(e)) tipEl.hidden = true; });
  document.addEventListener('pointerdown', e => { tipEl.hidden = true; if (e.pointerType === 'mouse') return; const b = tipTarget(e); clearTimeout(lpT); lpFired = false; if (b) lpT = setTimeout(() => { lpFired = true; showTip(b); buzz(8); }, 450); });
  document.addEventListener('pointerup', () => clearTimeout(lpT));
  document.addEventListener('click', e => { if (lpFired && tipTarget(e)) { lpFired = false; e.stopPropagation(); e.preventDefault(); } }, true);

  // ---------- resource bar ----------
  { const h = $('hud'), item = (r, adv) => { const e = el('span', { id: 's-' + r, className: adv ? 'adv' : '' }, [ICON[r] + ' ', el('b', { id: 'r-' + r })]); e.dataset.tip = 'res-' + r; return e; }, grp = (id, label) => el('span', { id: 'g-' + id, className: 'grp adv' }, [label]);
    h.replaceChildren(...BASICS.map(r => item(r)), el('span', { id: 'pantry', className: 'grp sub adv' }), grp('farm', 'Farm'), ...FARM.map(r => item(r, true)), grp('goods', 'Goods'), ...GOODS.map(r => item(r, true)), el('span', { className: 'grp' }, ['']), (() => { const e = el('span', {}, ['🏠 ', el('b', { id: 'r-pop' })]); e.dataset.tip = 'res-pop'; return e; })(), (() => { const e = el('span', { id: 'r-age' }); e.dataset.tip = 'res-age'; return e; })());
    h.addEventListener('click', e => { const t = e.target.closest('[data-tip]'); if (t) showTip(t); }); }

  // ---------- Director overlay (for the curious) ----------
  function drawDirectors() {
    const m = g().manager, d = $('dir'); d.replaceChildren(el('b', { textContent: 'Directors' }));
    for (const dir of m.directors) {
      const wishes = m.wishes.filter(w => w.dir === dir.name).sort((a, b) => b.w - a.w), dem = (m.demands || []).filter(x => x.from === dir.name);
      const box2 = el('div', { className: 'dirbox' }, [el('div', { className: 'dn', textContent: dir.name }), el('small', { textContent: dir.seeks || '' })]);
      for (const w of wishes) box2.append(el('div', { className: 'wl', textContent: `${w.key} ${w.w.toFixed(2)} · ${w.why}` }));
      for (const x of dem) box2.append(el('div', { className: 'wl dem', textContent: `asks ${x.to} for ${x.what}${x.why ? ' (' + x.why + ')' : ''}` }));
      if (!wishes.length && !dem.length) box2.append(el('div', { className: 'wl', textContent: 'content for now' }));
      d.append(box2);
    }
  }

  // ---------- every frame ----------
  function sync() {
    const G = g();
    for (const v of ui.sel) if (!G.villagers.includes(v) || v.inside || (v.act && v.act.type === 'sleep' && v.act.phase === 'sleep')) ui.sel.delete(v);
    if (ui.selB && !G.bmap.has(ui.selB.id)) ui.selB = null;
    if (ui.moving && !G.bmap.has(ui.moving.id)) { ui.moving = null; ui.place = null; ui.ghost = null; }
    if (ui.selN && !(ui.selN.type === 'sapling' ? G.w.G[ui.selN.i] > 0 : G.w.A[ui.selN.i] > 0)) ui.selN = null;
    // The bubble: open what is selected, keep it pointing at its target.
    if (!ui.modal) { const s = bubbleSpec(); if (!s) pop.close(); else pop.open(s); pop.tick(); }
    else pop.close();
    sheet.tick();
    $('hud').hidden = !ui.hudOpen; $('hud').classList.toggle('simple', ui.hudMode === 1); document.body.classList.toggle('hud-open', !!ui.hudOpen);
    $('fab').classList.toggle('on', !!ui.menuOpen);
    for (const r of RES) {
      const c = Math.floor(cap(G, r)), n = Math.floor(G.res[r]);
      $('r-' + r).textContent = `${n}/${c}`;
      $('s-' + r).hidden = (GOODS.includes(r) || FARM.includes(r)) && !c && !n;
    }
    for (const [id, list] of [['farm', FARM], ['goods', GOODS]]) $('g-' + id).hidden = list.every(r => $('s-' + r).hidden);
    { const p = G.pantry || {}, kinds = PANTRY.filter(k => (p[k] || 0) >= 1); $('pantry').hidden = !kinds.length; const key = kinds.map(k => k + Math.floor(p[k])).join(); if ($('pantry').dataset.k !== key) { $('pantry').dataset.k = key; $('pantry').replaceChildren(...kinds.map(k => { const e = el('span', { textContent: `${PANTRY_ICON[k]} ${Math.floor(p[k])}  ` }); e.dataset.tip = 'pan-' + k; return e; })); } }
    $('dir').hidden = ui.overlay !== 'directors';
    if (ui.overlay === 'directors' && (ui.dirT = (ui.dirT || 0) + 1) % 30 === 1) drawDirectors();
    $('r-pop').textContent = `${G.villagers.length}/${popCap(G)}`;
    $('r-age').textContent = `${AGES[G.age].name} Age · 🎭 ${Math.floor(G.culture || 0)}${AGES[G.age + 1] ? '/' + AGES[G.age + 1].culture : ''} · ${SEASONS[seasonIndex(G)]}${darkness(G) > 0.6 ? ' 🌙' : ''}`;
    $('buildbtn').classList.toggle('on', sheet.key === 'build' || !!ui.place);
    coach.tick();
    syncButtons();
  }

  // ---------- keyboard ----------
  addEventListener('keydown', e => {
    if (ui.modal || (e.target && e.target.tagName === 'INPUT')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'p') { ACT.pause.run(); return; }
    if (k === 'r' && (ui.place || ui.selB)) { ACT.rotate.run(); return; }
    if (k === 'enter' && ui.place) { confirmPlace(); return; }
    if (k === 'b') api.openBuild();
    else if (k === 'm') { const was = ui.menuOpen; clearSel(); ui.menuOpen = !was; }
    else if (k === 'h') { const tc = hub(g()); selectBuilding(tc); center(tc.x + 0.5, tc.y + 0.5); }
    else if (k === '.') nextIdle();
    else if (k === 'escape') { if (pop.confirming) pop.close(); else if (sheet.key) sheet.close(); else if (ui.place) cancelPlace(); else clearSel(); }
  });

  g().events.on('notice', t => toast(t));
  return Object.assign(ui, { tap, hoverAt, sync, toast, say, clearSel, rebind() { g().events.on('notice', t => toast(t)); clearSel(); sheet.close(); } });
}
